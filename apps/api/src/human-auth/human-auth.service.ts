import { randomUUID } from 'node:crypto';

import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';

import { IdentityAuditService } from '../audit/identity-audit.service';
import { API_ENVIRONMENT, type ApiEnvironmentProvider } from '../config/api-environment.provider';
import { PrismaService } from '../database/prisma.service';
import { TenantContextService } from '../database/tenant-context.service';
import {
  generateSessionToken,
  hashSessionToken,
  hashesMatch,
  isWellFormedSessionToken,
} from '../enrollment-sessions/enrollment-session.tokens';
import { type HumanPrincipal } from '../identity-access/human-principal';

import {
  attemptHashesMatch,
  deriveAttemptNonce,
  generateAttemptToken,
  hashAttemptValue,
  isWellFormedAttemptToken,
  openVerifier,
  sealVerifier,
} from './human-auth-attempt.crypto';
import {
  type HumanAuthConfig,
  type HumanAuthEnabledConfig,
  loadHumanAuthConfig,
} from './human-auth.config';
import {
  HUMAN_AUTH_DEFAULT_RETURN_TARGET,
  type HumanAuthReturnTarget,
  isAllowedReturnTarget,
} from './human-auth.contract';
import {
  buildHumanAuthAttemptClearCookie,
  buildHumanAuthAttemptCookie,
  buildHumanSessionClearCookie,
  buildHumanSessionCookie,
} from './human-session.cookie';
import { OidcAdapter } from './oidc.adapter';

/**
 * Ciclo de vida de la identidad y la sesión HUMANA
 * (IDENTITY-RELATIONSHIPS-CORE-01 §4.4, AD-01, AD-06).
 *
 * Garantías:
 * - el tenant se resuelve SIEMPRE en el servidor; el navegador nunca lo envía;
 * - toda consulta pasa por `PrismaService.withTenant()`, de modo que el rol
 *   `merdn_runtime` y Row Level Security respaldan los filtros por `tenantId`;
 * - el token en claro solo existe en memoria y en la cookie `HttpOnly`;
 * - un `subject` no aprovisionado NO crea cuenta: no hay registro implícito,
 *   no hay autovinculación por claims y la respuesta no permite enumerar;
 * - la sesión, su rotación y su evento de auditoría se confirman de forma
 *   ATÓMICA: no puede existir una sesión válida sin su evento;
 * - `code`, ID token, access token, claims y verifier se descartan en cuanto se
 *   extraen `issuer` y `subject`. Nada de eso se persiste ni se registra.
 */

/** Resultado del inicio de sesión: a dónde redirigir y qué cookie emitir. */
export interface HumanLoginStart {
  readonly authorizationUrl: string;
  readonly setCookieHeader: string;
}

/** Resultado de un callback correcto. */
export interface HumanLoginResult {
  readonly principal: HumanPrincipal;
  /** Cabeceras `Set-Cookie`: emite la sesión y borra el intento. */
  readonly setCookieHeaders: readonly string[];
  readonly returnTarget: HumanAuthReturnTarget;
}

/** Vigencia de la sesión devuelta a la interfaz. Sin identificadores. */
export interface HumanSessionValidity {
  /** Caducidad ABSOLUTA. No se renueva usando la sesión. */
  readonly expiresAt: Date;
  /** Segundos que restan antes de que la inactividad cierre la sesión. */
  readonly idleExpiresInSeconds: number;
}

/** El módulo humano no está aprovisionado. Falla cerrado, no degradado. */
export class HumanAuthUnavailableError extends Error {
  constructor() {
    super(
      'La autenticación humana no está aprovisionada en este despliegue. ' +
        'No existe ningún acceso alternativo.',
    );
    this.name = 'HumanAuthUnavailableError';
  }
}

@Injectable()
export class HumanAuthService implements OnModuleInit {
  private readonly logger = new Logger(HumanAuthService.name);

  private readonly config: HumanAuthConfig;

  private readonly adapter: OidcAdapter | null;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TenantContextService) private readonly tenants: TenantContextService,
    @Inject(IdentityAuditService) private readonly audit: IdentityAuditService,
    @Inject(API_ENVIRONMENT) environment: ApiEnvironmentProvider,
  ) {
    /*
     * La configuración se carga UNA vez, en la construcción. Una configuración
     * PROHIBIDA para el entorno —issuer HTTP fuera de desarrollo, realm local en
     * `mvp`, comodín en redirect u origen— lanza aquí y, por tanto, IMPIDE EL
     * ARRANQUE de la aplicación. Es deliberado: no debe poder desplegarse un
     * proveedor de juguete delante de datos que no lo son.
     */
    this.config = loadHumanAuthConfig(process.env, environment);
    this.adapter = this.config.enabled ? new OidcAdapter(this.config.oidc) : null;
  }

  public onModuleInit(): void {
    if (!this.config.enabled) {
      // El motivo nombra las variables, nunca sus valores.
      this.logger.warn(this.config.reason);

      return;
    }

    // Se registra el HECHO, jamás el issuer, el cliente ni la clave.
    this.logger.log(
      'Autenticación humana aprovisionada con un único proveedor OIDC ' +
        '(Authorization Code + PKCE S256).',
    );
  }

  /** Indica si la superficie humana está disponible en este despliegue. */
  public get isEnabled(): boolean {
    return this.config.enabled;
  }

  /** Cabecera `Set-Cookie` que borra la cookie de sesión humana. */
  public clearSessionCookieHeader(): string {
    return buildHumanSessionClearCookie(this.enabled().cookie);
  }

  /**
   * Cabecera `Set-Cookie` que borra la cookie del intento.
   *
   * El callback la emite TAMBIÉN cuando falla: un intento fallido no debe dejar
   * en el navegador una cookie que invite a reintentar con el mismo material.
   */
  public clearAttemptCookieHeader(): string {
    return buildHumanAuthAttemptClearCookie(this.enabled().cookie);
  }

  /** Orígenes admitidos en operaciones que cambian estado. */
  public get allowedOrigins(): readonly string[] {
    return this.config.enabled ? this.config.allowedOrigins : [];
  }

  /** Configuración del control de abuso del inicio de sesión. */
  public get rateLimit(): { readonly maxRequests: number; readonly windowSeconds: number } {
    return this.config.enabled
      ? this.config.rateLimit
      : { maxRequests: 1, windowSeconds: 60 };
  }

  /**
   * Inicia el flujo OIDC.
   *
   * Persiste el intento server-side —`state` y `nonce` hasheados, verifier PKCE
   * cifrado— y devuelve al navegador ÚNICAMENTE un token opaco en una cookie
   * transitoria. El navegador no custodia ningún material criptográfico.
   *
   * `returnTo` se coteja contra una allowlist CERRADA. Un destino no admitido no
   * produce error: se sustituye por el destino por defecto, de modo que un
   * enlace manipulado no revele qué rutas existen.
   */
  public async startLogin(returnTo: unknown, now: Date, stepUp?: HumanPrincipal): Promise<HumanLoginStart> {
    const config = this.enabled();
    const adapter = this.requireAdapter();

    const returnTarget: HumanAuthReturnTarget = isAllowedReturnTarget(returnTo)
      ? returnTo
      : HUMAN_AUTH_DEFAULT_RETURN_TARGET;

    /*
     * El identificador se genera AQUÍ, y no en la base, porque el `nonce` se
     * deriva de él: hace falta antes de construir la URL de autorización.
     */
    const attemptId = randomUUID();
    const nonce = deriveAttemptNonce(attemptId, config.attemptKey);

    // Explicit portal entries ask for credentials rather than silently reusing
    // another experience's SSO. This alone does not establish privileged step-up.
    const portalEntry = returnTarget === '/acceso' || returnTarget === '/hospital' || returnTarget === '/municipality';
    const request = await adapter.buildAuthorizationRequest(nonce, stepUp !== undefined || portalEntry);

    const browserToken = generateAttemptToken();
    const sealed = sealVerifier(request.codeVerifier, config.attemptKey);
    const { tenantId } = await this.tenants.resolveActiveTenant();

    await this.prisma.withTenant(tenantId, async (tx) => {
      if (stepUp !== undefined) {
        if (stepUp.tenantId !== tenantId || stepUp.externalAuthIdentityId === undefined) throw new HumanAuthUnavailableError();
        const original = await tx.humanSession.findFirst({ where: {
          id: stepUp.sessionId, tenantId, humanAccountId: stepUp.humanAccountId,
          externalAuthIdentityId: stepUp.externalAuthIdentityId, revokedAt: null, expiresAt: { gt: now },
          account: { status: 'ACTIVE', passwordRecoveryBlocked: false }, externalIdentity: { status: 'ACTIVE' },
        }, select: { id: true } });
        if (original === null) throw new HumanAuthUnavailableError();
      }
      await tx.humanAuthAttempt.create({
        data: {
          id: attemptId,
          tenantId,
          browserTokenHash: hashAttemptValue(browserToken),
          stateHash: hashAttemptValue(request.state),
          nonceHash: hashAttemptValue(nonce),
          pkceVerifierCiphertext: sealed.ciphertext,
          pkceVerifierIv: sealed.iv,
          pkceVerifierAuthTag: sealed.authTag,
          returnTarget,
          expiresAt: new Date(now.getTime() + config.attemptTtlSeconds * 1000),
          ...(stepUp === undefined ? {} : {
            freshAuthenticationRequestedAt: now, stepUpSessionId: stepUp.sessionId,
            stepUpHumanAccountId: stepUp.humanAccountId, stepUpExternalIdentityId: stepUp.externalAuthIdentityId,
          }),
        },
        select: { id: true },
      });
    });

    return {
      authorizationUrl: request.authorizationUrl,
      setCookieHeader: buildHumanAuthAttemptCookie(
        browserToken,
        config.cookie,
        config.attemptTtlSeconds,
      ),
    };
  }

  /**
   * Completa el flujo OIDC y establece la sesión humana (§4.4).
   *
   * Secuencia, en este orden exacto:
   *
   *  1. consumir el intento de forma ATÓMICA, comparando `state` recibido y
   *     token del navegador contra sus hashes;
   *  2. verificar el código y el ID token con el adapter, que comprueba firma,
   *     `kid`, emisor, audiencia, algoritmo, vigencia, `nonce` y PKCE;
   *  3. resolver el vínculo EXACTO `(tenant, issuer, subject)` en estado ACTIVE;
   *  4. exigir cuenta `ACTIVE` y `Person` del MISMO tenant;
   *  5. revocar toda sesión humana viva de esa cuenta —máximo una activa—;
   *  6. crear la sesión nueva con vigencia absoluta;
   *  7. escribir `HUMAN_SESSION_CREATED`;
   *  8. confirmar 5, 6 y 7 en una sola transacción.
   *
   * Devuelve `null` de forma INDISTINGUIBLE ante cualquier fallo. En particular,
   * un `subject` verificado pero NO aprovisionado NO crea cuenta y responde
   * igual que un código manipulado: no hay enumeración de personas.
   */
  public async completeLogin(
    browserToken: string | null,
    receivedParameters: URLSearchParams,
    now: Date,
    correlationId: string,
    endpoint: string,
  ): Promise<HumanLoginResult | null> {
    const config = this.enabled();
    const adapter = this.requireAdapter();

    const clearAttempt = buildHumanAuthAttemptClearCookie(config.cookie);

    if (browserToken === null || !isWellFormedAttemptToken(browserToken)) {
      return null;
    }

    const receivedState = receivedParameters.get('state');

    if (receivedState === null || receivedState.length === 0) {
      return null;
    }

    const { tenantId } = await this.tenants.resolveActiveTenant();

    const attempt = await this.consumeAttempt(tenantId, browserToken, receivedState, now);

    if (attempt === null) {
      return null;
    }

    const codeVerifier = openVerifier(
      {
        ciphertext: attempt.pkceVerifierCiphertext,
        iv: attempt.pkceVerifierIv,
        authTag: attempt.pkceVerifierAuthTag,
      },
      config.attemptKey,
    );

    if (codeVerifier === null) {
      return null;
    }

    const identity = await adapter.exchangeAndVerify(receivedParameters, {
      state: receivedState,
      nonce: attempt.nonce,
      codeVerifier,
      ...(attempt.freshAuthenticationRequestedAt === null ? {} : { freshAuthenticationRequestedAt: attempt.freshAuthenticationRequestedAt }),
    });

    if (identity === null) {
      return null;
    }

    if (attempt.freshAuthenticationRequestedAt !== null && identity.authenticatedAt === undefined) return null;

    /*
     * A partir de aquí el material OIDC ya no existe: solo viajan `issuer` y
     * `subject`, ambos opacos. No se persiste ningún token y no hay refresh.
     */
    const established = await this.establishSession(
      tenantId,
      identity.issuer,
      identity.subject,
      now,
      correlationId,
      endpoint,
      attempt.createdAt,
      attempt.freshAuthenticationRequestedAt === null ? undefined : {
        authenticatedAt: identity.authenticatedAt!, sessionId: attempt.stepUpSessionId!,
        accountId: attempt.stepUpHumanAccountId!, bindingId: attempt.stepUpExternalIdentityId!,
      },
    );

    if (established === null) {
      return null;
    }

    return {
      principal: established.principal,
      setCookieHeaders: [
        buildHumanSessionCookie(established.token, config.cookie, config.sessionTtlSeconds),
        clearAttempt,
      ],
      returnTarget: attempt.returnTarget,
    };
  }

  /**
   * Consume el intento de forma atómica.
   *
   * `updateMany` con `consumedAt: null` en el filtro es la operación clave: dos
   * callbacks concurrentes con el mismo token compiten sobre la MISMA fila y
   * exactamente uno obtiene `count = 1`. El otro recibe `0` y termina, de modo
   * que un `code` reproducido no puede consumirse dos veces.
   *
   * El `state` recibido se compara en tiempo constante contra su hash
   * almacenado: no basta con presentar la cookie del intento, hay que presentar
   * además el `state` que le corresponde.
   */
  private async consumeAttempt(
    tenantId: string,
    browserToken: string,
    receivedState: string,
    now: Date,
  ): Promise<{
    readonly nonce: string;
    readonly pkceVerifierCiphertext: string;
    readonly pkceVerifierIv: string;
    readonly pkceVerifierAuthTag: string;
    readonly returnTarget: HumanAuthReturnTarget;
    readonly createdAt: Date;
    readonly freshAuthenticationRequestedAt: Date | null;
    readonly stepUpSessionId: string | null;
    readonly stepUpHumanAccountId: string | null;
    readonly stepUpExternalIdentityId: string | null;
  } | null> {
    const config = this.enabled();
    const browserTokenHash = hashAttemptValue(browserToken);
    const stateHash = hashAttemptValue(receivedState);

    return this.prisma.withTenant(tenantId, async (tx) => {
      const stored = await tx.humanAuthAttempt.findFirst({
        where: { browserTokenHash, tenantId },
        select: {
          id: true,
          stateHash: true,
          nonceHash: true,
          pkceVerifierCiphertext: true,
          pkceVerifierIv: true,
          pkceVerifierAuthTag: true,
          returnTarget: true,
          expiresAt: true,
          consumedAt: true,
          createdAt: true,
          freshAuthenticationRequestedAt: true, stepUpSessionId: true,
          stepUpHumanAccountId: true, stepUpExternalIdentityId: true,
        },
      });

      if (stored === null) {
        return null;
      }

      if (stored.consumedAt !== null || stored.expiresAt.getTime() <= now.getTime()) {
        return null;
      }

      if (!attemptHashesMatch(stored.stateHash, stateHash)) {
        return null;
      }

      const consumed = await tx.humanAuthAttempt.updateMany({
        where: { id: stored.id, tenantId, consumedAt: null },
        data: { consumedAt: now },
      });

      if (consumed.count === 0) {
        // Otro callback ganó la carrera. Este intento ya no vale.
        return null;
      }

      if (!isAllowedReturnTarget(stored.returnTarget)) {
        // Defensa explícita: la base ya lo restringe con un CHECK.
        return null;
      }

      /*
       * El `nonce` en claro NO está almacenado: solo su hash. Se RECALCULA a
       * partir del identificador del intento y de la clave del servidor, y acto
       * seguido se comprueba que su hash coincide con el persistido.
       *
       * Esa comprobación no es ceremonial: si alguien alterase `nonceHash` en la
       * base para aceptar un `nonce` elegido por él, el valor recalculado ya no
       * cuadraría y el intento se descartaría. Sin la clave, el `nonce` es
       * impredecible aunque se conozca el identificador.
       */
      const nonce = deriveAttemptNonce(stored.id, config.attemptKey);

      if (!attemptHashesMatch(stored.nonceHash, hashAttemptValue(nonce))) {
        return null;
      }

      return {
        nonce,
        pkceVerifierCiphertext: stored.pkceVerifierCiphertext,
        pkceVerifierIv: stored.pkceVerifierIv,
        pkceVerifierAuthTag: stored.pkceVerifierAuthTag,
        returnTarget: stored.returnTarget,
        createdAt: stored.createdAt,
        freshAuthenticationRequestedAt: stored.freshAuthenticationRequestedAt ?? null,
        stepUpSessionId: stored.stepUpSessionId ?? null,
        stepUpHumanAccountId: stored.stepUpHumanAccountId ?? null,
        stepUpExternalIdentityId: stored.stepUpExternalIdentityId ?? null,
      };
    });
  }

  /**
   * Resuelve el vínculo y establece la sesión, todo dentro de una transacción.
   *
   * Un `subject` verificado pero sin vínculo ACTIVE, con cuenta deshabilitada o
   * con la persona en otro tenant devuelve `null` SIN crear nada: el
   * aprovisionamiento es la única vía de alta (AD-02).
   */
  private async establishSession(
    tenantId: string,
    issuer: string,
    subject: string,
    now: Date,
    correlationId: string,
    endpoint: string,
    attemptCreatedAt: Date,
    stepUp?: { readonly authenticatedAt: Date; readonly sessionId: string; readonly accountId: string; readonly bindingId: string },
  ): Promise<{ readonly principal: HumanPrincipal; readonly token: string } | null> {
    const config = this.enabled();
    const token = generateSessionToken();
    const expiresAt = new Date(now.getTime() + config.sessionTtlSeconds * 1000);

    return this.prisma.withTenant(tenantId, async (tx) => {
      const binding = await tx.externalAuthIdentity.findFirst({
        // Filtro explícito por tenant ADEMÁS de Row Level Security.
        where: { tenantId, issuer, subject, status: 'ACTIVE' },
        select: {
          id: true,
          humanAccountId: true,
          account: {
            select: { id: true, status: true, personId: true, tenantId: true, passwordRecoveryBlocked: true },
          },
        },
      });

      if (binding === null || binding.account.status !== 'ACTIVE' || binding.account.passwordRecoveryBlocked === true) {
        return null;
      }

      // Redundante con Row Level Security y deliberadamente conservado: el
      // aislamiento institucional no debe depender de una sola capa.
      if (binding.account.tenantId !== tenantId) {
        return null;
      }

      const person = await tx.person.findFirst({
        where: { id: binding.account.personId, tenantId },
        select: { id: true },
      });

      if (person === null) {
        return null;
      }

      /*
       * SERIALIZACIÓN DE LA CUENTA (continuación §5).
       *
       * `SELECT ... FOR UPDATE` sobre la fila de `human_account` es lo que
       * convierte «revocar y crear» en una operación realmente exclusiva. Sin
       * este bloqueo, dos callbacks simultáneos de la MISMA cuenta pueden leer
       * a la vez el conjunto de sesiones vivas, no ver ninguna que revocar y
       * confirmar los dos una sesión activa: el invariante de AD-06 —máximo una
       * sesión activa por cuenta— quedaría roto sin que ninguna restricción de
       * la base lo advirtiera.
       *
       * Con el bloqueo, la segunda transacción ESPERA a que la primera confirme
       * y solo entonces vuelve a mirar. Encuentra la sesión recién creada, la
       * revoca y crea la suya: el resultado es exactamente una sesión válida y
       * el token del inicio anterior deja de servir.
       *
       * Es un bloqueo de FILA dentro de la transacción que ya existe: no hay
       * bloqueo global, no hay exclusión en memoria y no se abre ninguna
       * conexión adicional. El identificador viaja PARAMETRIZADO y nunca se
       * interpola en el texto SQL.
       */
      const bloqueadas = await tx.$queryRaw<{ readonly id: string }[]>`
        SELECT "id"
          FROM "human_account"
         WHERE "id" = ${binding.account.id}::uuid
           AND "tenantId" = ${tenantId}::uuid
         FOR UPDATE
      `;

      if (bloqueadas.length !== 1) {
        return null;
      }

      /*
       * REVALIDACIÓN DESPUÉS DEL BLOQUEO. Entre la primera lectura y la
       * adquisición del bloqueo pudo confirmarse una desvinculación o una
       * deshabilitación de la cuenta. Volver a comprobarlas aquí impide que un
       * inicio de sesión en curso «gane» a una revocación que ya está escrita.
       */
      const revalidado = await tx.externalAuthIdentity.findFirst({
        where: { tenantId, issuer, subject, status: 'ACTIVE' },
        select: {
          humanAccountId: true,
          account: { select: { id: true, status: true, tenantId: true, passwordRecoveryBlocked: true, authenticationNotBefore: true } },
        },
      });

      if (
        revalidado === null ||
        revalidado.humanAccountId !== binding.account.id ||
        revalidado.account.status !== 'ACTIVE' ||
        revalidado.account.passwordRecoveryBlocked === true ||
        revalidado.account.tenantId !== tenantId
      ) {
        return null;
      }

      // The IdP response may have been verified before recovery revoked access.
      // Recheck its persisted attempt boundary under the account lock, even
      // after recovery has completed and the account is ACTIVE again.
      if (revalidado.account.authenticationNotBefore !== null && revalidado.account.authenticationNotBefore !== undefined &&
        (!(attemptCreatedAt instanceof Date) || attemptCreatedAt.getTime() <= revalidado.account.authenticationNotBefore.getTime())) return null;

      if (stepUp !== undefined) {
        if (binding.id !== stepUp.bindingId || binding.account.id !== stepUp.accountId) return null;
        const original = await tx.humanSession.findFirst({ where: {
          id: stepUp.sessionId, tenantId, humanAccountId: stepUp.accountId,
          externalAuthIdentityId: stepUp.bindingId, revokedAt: null, expiresAt: { gt: now },
        }, select: { createdAt: true, lastUsedAt: true } });
        if (original === null || now.getTime() - (original.lastUsedAt ?? original.createdAt).getTime() >= config.sessionIdleSeconds * 1000) return null;
      }

      /*
       * MÁXIMO UNA SESIÓN ACTIVA POR CUENTA (AD-06). La sesión anterior se
       * revoca en la MISMA transacción que crea la nueva y bajo el bloqueo de
       * la cuenta: dos inicios de sesión concurrentes no pueden dejar dos
       * sesiones válidas.
       */
      const vivas = await tx.humanSession.findMany({
        where: { tenantId, humanAccountId: binding.account.id, revokedAt: null },
        select: { id: true },
      });

      if (vivas.length > 0) {
        await tx.humanSession.updateMany({
          where: { tenantId, humanAccountId: binding.account.id, revokedAt: null },
          data: { revokedAt: now },
        });

        for (const anterior of vivas) {
          await this.audit.recordHumanSessionRevokedWithin(
            tx,
            { tenantId, endpoint, correlationId },
            { humanAccountId: binding.account.id, sessionId: anterior.id },
            now,
          );
        }
      }

      const created = await tx.humanSession.create({
        data: {
          tenantId,
          humanAccountId: binding.account.id,
          externalAuthIdentityId: binding.id,
          freshAuthenticatedAt: stepUp?.authenticatedAt ?? null,
          tokenHash: hashSessionToken(token),
          expiresAt,
        },
        select: { id: true },
      });

      await this.audit.recordHumanSessionCreatedWithin(
        tx,
        { tenantId, endpoint, correlationId },
        { humanAccountId: binding.account.id, sessionId: created.id },
        now,
      );

      // Spec 027: Revocar enrollment_session si existe para este paciente
      const enrollmentSession = await tx.enrollmentSession.findFirst({
        where: {
          patient: { personId: binding.account.personId },
          tenantId,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        select: { id: true, patientId: true },
      });
      if (enrollmentSession) {
        await tx.enrollmentSession.update({
          where: { id: enrollmentSession.id },
          data: { revokedAt: now },
        });
        await this.audit.recordEnrollmentSessionRevokedWithin(
          tx,
          { tenantId, endpoint, correlationId },
          { enrollmentSessionId: enrollmentSession.id, patientId: enrollmentSession.patientId },
          now,
        );
      }

      return {
        principal: {
          sessionId: created.id,
          humanAccountId: binding.account.id,
          personId: binding.account.personId,
          tenantId,
          externalAuthIdentityId: binding.id,
        },
        token,
      };
    });
  }

  /**
   * Valida el token recibido por cookie y devuelve el principal humano.
   *
   * Devuelve `null` de forma indistinguible ante ausencia, malformación,
   * inexistencia, caducidad ABSOLUTA, caducidad por INACTIVIDAD, revocación,
   * cuenta deshabilitada, vínculo desvinculado o tenant ajeno.
   *
   * `lastUsedAt` se actualiza para sostener la ventana de inactividad, y NUNCA
   * toca `expiresAt`: usar la sesión no prolonga su vigencia absoluta.
   */
  public async validate(
    token: string | null,
    now: Date,
  ): Promise<{ readonly principal: HumanPrincipal; readonly validity: HumanSessionValidity } | null> {
    if (!this.config.enabled) {
      return null;
    }

    const config = this.config;

    if (token === null || !isWellFormedSessionToken(token)) {
      return null;
    }

    const tokenHash = hashSessionToken(token);
    const { tenantId } = await this.tenants.resolveActiveTenant();

    return this.prisma.withTenant(tenantId, async (tx) => {
      const session = await tx.humanSession.findFirst({
        where: { tokenHash, tenantId },
        select: {
          id: true,
          tenantId: true,
          tokenHash: true,
          externalAuthIdentityId: true,
          expiresAt: true,
          createdAt: true,
          lastUsedAt: true,
          revokedAt: true,
          account: {
            select: { id: true, status: true, personId: true, tenantId: true, passwordRecoveryBlocked: true },
          },
        },
      });

      if (session === null) {
        return null;
      }

      // Comparación en tiempo constante aunque la búsqueda sea por índice único:
      // conserva la propiedad si la estrategia de búsqueda cambiara.
      if (!hashesMatch(session.tokenHash, tokenHash)) {
        return null;
      }

      if (session.revokedAt !== null || session.expiresAt.getTime() <= now.getTime()) {
        return null;
      }

      const ultimaActividad = session.lastUsedAt ?? session.createdAt;
      const inactividadMs = now.getTime() - ultimaActividad.getTime();

      if (inactividadMs >= config.sessionIdleSeconds * 1000) {
        return null;
      }

      if (session.tenantId !== tenantId || session.account.tenantId !== tenantId) {
        return null;
      }

      if (session.account.status !== 'ACTIVE' || session.account.passwordRecoveryBlocked === true) {
        return null;
      }

      /*
       * VÍNCULO VIVO EXIGIDO EN CADA OPERACIÓN. Desvincular la identidad externa
       * debe cerrar el acceso de inmediato, sin esperar a que caduque la sesión
       * y sin depender de que el proceso de desvinculación acertara a revocarla.
       */
      const vinculosActivos = await tx.externalAuthIdentity.count({
        where: { tenantId, humanAccountId: session.account.id, status: 'ACTIVE', ...(session.externalAuthIdentityId === null || session.externalAuthIdentityId === undefined ? {} : { id: session.externalAuthIdentityId }) },
      });

      if (vinculosActivos === 0) {
        return null;
      }

      await tx.humanSession.update({
        where: { id: session.id },
        // `expiresAt` NO se toca: la vigencia absoluta no se renueva.
        data: { lastUsedAt: now },
      });

      /*
       * Esta misma petición acaba de renovar la ventana de inactividad, de modo
       * que lo que resta es la ventana completa. Se acota además por la
       * caducidad ABSOLUTA: la sesión termina en lo que ocurra primero, y
       * anunciar más tiempo del que la vigencia absoluta permite sería falso.
       */
      const segundosHastaCaducidadAbsoluta = Math.max(
        0,
        Math.floor((session.expiresAt.getTime() - now.getTime()) / 1000),
      );

      const idleExpiresInSeconds = Math.min(
        config.sessionIdleSeconds,
        segundosHastaCaducidadAbsoluta,
      );

      return {
        principal: {
          sessionId: session.id,
          humanAccountId: session.account.id,
          personId: session.account.personId,
          tenantId,
          ...(session.externalAuthIdentityId === null || session.externalAuthIdentityId === undefined ? {} : { externalAuthIdentityId: session.externalAuthIdentityId }),
        },
        validity: { expiresAt: session.expiresAt, idleExpiresInSeconds },
      };
    });
  }

  /**
   * Revoca la sesión humana vigente.
   *
   * La fila se CONSERVA para trazabilidad histórica: no se elimina ningún
   * registro, y el rol runtime ni siquiera tiene DELETE sobre la tabla.
   */
  public async logout(
    principal: HumanPrincipal,
    now: Date,
    correlationId: string,
    endpoint: string,
  ): Promise<void> {
    await this.prisma.withTenant(principal.tenantId, async (tx) => {
      const revoked = await tx.humanSession.updateMany({
        where: { id: principal.sessionId, tenantId: principal.tenantId, revokedAt: null },
        data: { revokedAt: now },
      });

      if (revoked.count === 0) {
        return;
      }

      await this.audit.recordHumanSessionRevokedWithin(
        tx,
        { tenantId: principal.tenantId, endpoint, correlationId },
        { humanAccountId: principal.humanAccountId, sessionId: principal.sessionId },
        now,
      );
    });
  }

  /** Configuración habilitada, o error explícito. Nunca un repliegue. */
  private enabled(): HumanAuthEnabledConfig {
    if (!this.config.enabled) {
      throw new HumanAuthUnavailableError();
    }

    return this.config;
  }

  private requireAdapter(): OidcAdapter {
    if (this.adapter === null) {
      throw new HumanAuthUnavailableError();
    }

    return this.adapter;
  }
}
