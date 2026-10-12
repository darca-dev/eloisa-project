import { randomUUID } from 'node:crypto';

import { Inject, Injectable, Logger, Optional, type OnModuleInit } from '@nestjs/common';
import { readCookie } from '../enrollment-sessions/enrollment-session.cookie';
import { HUMAN_SESSION_COOKIE_NAME } from '../human-auth/human-auth.contract';
import { InstitutionalAdministratorService } from './institutional-administrator.service';
import { experienceForRole } from './institutional-administrator.contract';

import { API_ENVIRONMENT, type ApiEnvironmentProvider } from '../config/api-environment.provider';
import { PrismaService } from '../database/prisma.service';
import { TenantContextService } from '../database/tenant-context.service';
import {
  generateSessionToken,
  hashSessionToken,
  hashesMatch,
  isWellFormedSessionToken,
} from '../enrollment-sessions/enrollment-session.tokens';

import { InstitutionalAuditService } from './institutional-audit.service';
import {
  type InstitutionalAuthConfig,
  loadInstitutionalAuthConfig,
} from './institutional-auth.config';
import {
  INSTITUTIONAL_IDENTITY_CODE_PATTERN,
  INSTITUTIONAL_SECRET_MAX_LENGTH,
  type InstitutionalRoleCode,
} from './institutional-auth.contract';
import {
  buildInstitutionalSessionClearCookie,
  buildInstitutionalSessionCookie,
} from './institutional-session.cookie';
import { deriveSecret, verifySecret } from './institutional-secret';

/**
 * Ciclo de vida de la identidad y la sesión institucional
 * (TASK-MUNICIPALITY-CORE-01, FR-13, FR-14 y sección de permisos; generalizado
 * de forma ADITIVA por TASK-HOSPITAL-CORE-01 §4.1.2, §4.1.3 y §9).
 *
 * Garantías:
 * - el tenant se resuelve SIEMPRE en el servidor; el navegador nunca lo envía;
 * - toda consulta pasa por `PrismaService.withTenant()`, de modo que el rol
 *   `merdn_runtime` y Row Level Security respaldan los filtros por `tenantId`;
 * - el token en claro solo existe en memoria y en la cookie `HttpOnly`;
 * - cada establecimiento de sesión genera un token NUEVO: no existe fijación,
 *   porque el servidor jamás acepta un identificador de sesión del cliente;
 * - la validación es indistinguible entre ausencia, malformación, expiración,
 *   revocación, identidad deshabilitada y pertenencia a otra institución;
 * - la credencial en claro no se registra, no se audita y no se devuelve.
 *
 * UNA SOLA SESIÓN, VARIOS ROLES: sigue existiendo UNA cookie y UNA tabla de
 * sesión institucional. Lo único que aporta el cliente es un `identityCode`
 * OPACO que selecciona cuál credencial se verifica dentro del tenant activo. El
 * rol y el tenant se leen SIEMPRE de la identidad persistida, nunca de la
 * petición: enviar un código no concede el rol asociado, solo elige contra qué
 * credencial compararse.
 *
 * Los primitivos criptográficos del token se reutilizan del módulo de sesión de
 * inscripción: son funciones genéricas —generación aleatoria, SHA-256 y
 * comparación en tiempo constante— y NO aportan ninguna semántica de paciente.
 * La sesión, la cookie, la tabla y la autorización son entidades separadas.
 */

export interface InstitutionalPrincipal {
  readonly humanAccountId?: string;
  readonly sessionId: string;
  readonly identityId: string;
  readonly tenantId: string;
  readonly role: InstitutionalRoleCode;
}

export interface EstablishedInstitutionalSession {
  readonly principal: InstitutionalPrincipal;
  /** Cabecera `Set-Cookie` lista para la respuesta. */
  readonly setCookieHeader: string;
  /** Caducidad de la sesión. Es la única metainformación devuelta al cliente. */
  readonly expiresAt: Date;
}

/**
 * Contexto de sesión devuelto a la interfaz institucional
 * (TASK-HOSPITAL-CORE-01 §8.0).
 *
 * Contiene EXCLUSIVAMENTE el rol efectivo, la caducidad y el nombre real del
 * tenant. NO contiene `tenantId`, `identityId`, código interno, secreto, actor
 * personal, tipo o municipio de la institución, logo ni permiso derivado: nada
 * de eso está modelado y nada de eso debe deducirse desde el navegador.
 */
export interface InstitutionalSessionContext {
  readonly role: InstitutionalRoleCode;
  readonly expiresAt: Date;
  readonly institutionName: string;
}

/**
 * Credencial señuelo del aprovisionamiento fallido.
 *
 * Cuando el código solicitado no resuelve ninguna identidad, la comprobación
 * sigue derivando una credencial contra un material inexistente para que el
 * coste temporal de «código desconocido» y «credencial incorrecta» sea
 * comparable. Sin esto, medir el tiempo de respuesta revelaría qué códigos
 * existen (TASK-HOSPITAL-CORE-01 §9.3).
 */
const SENUELO_HASH = 'f'.repeat(128);
const SENUELO_SALT = '0'.repeat(32);

@Injectable()
export class InstitutionalAuthService implements OnModuleInit {
  private readonly logger = new Logger(InstitutionalAuthService.name);

  private readonly config: InstitutionalAuthConfig;

  /** Aprovisionamiento en curso, para no derivar las credenciales en paralelo. */
  private provisioning: Promise<ReadonlyMap<string, string>> | null = null;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TenantContextService) private readonly tenants: TenantContextService,
    @Inject(InstitutionalAuditService) private readonly audit: InstitutionalAuditService,
    @Inject(API_ENVIRONMENT) environment: ApiEnvironmentProvider,
    @Optional() @Inject(InstitutionalAdministratorService) private readonly administrators?: InstitutionalAdministratorService,
  ) {
    this.config = loadInstitutionalAuthConfig(process.env, environment);
  }

  public onModuleInit(): void {
    for (const omitida of this.config.provisioning.skipped) {
      // El motivo nombra la variable, nunca su valor.
      this.logger.warn(omitida.reason);
    }

    for (const identidad of this.config.provisioning.identities) {
      // Se registra el ROL, jamás el código ni la credencial.
      this.logger.log(
        `Identidad institucional con rol ${identidad.role} aprovisionable desde configuración.`,
      );
    }

    if (this.config.provisioning.identities.length === 0) {
      this.logger.warn(
        'Ninguna identidad institucional está configurada: todas las superficies ' +
          'institucionales responden como no autenticadas.',
      );
    }
  }

  /** Cabecera `Set-Cookie` que borra la cookie institucional. */
  public clearCookieHeader(): string {
    return buildInstitutionalSessionClearCookie(this.config.cookie);
  }

  /**
   * Establece una sesión institucional a partir de la credencial recibida.
   *
   * `identityCode` selecciona qué credencial se verifica. Cuando la petición no
   * lo envía se usa el código municipal configurado, de modo que el cliente
   * Alcaldía existente sigue funcionando sin cambios y sus sesiones abiertas no
   * se invalidan.
   *
   * Devuelve `null` de forma INDISTINGUIBLE cuando el código no existe, la
   * identidad no está aprovisionada, está deshabilitada o la credencial no
   * coincide. Ninguna de esas causas viaja al cliente ni al registro.
   */
  public async establishSession(
    accessSecret: unknown,
    identityCode: unknown,
    now: Date,
    correlationId: string,
    endpoint: string,
  ): Promise<EstablishedInstitutionalSession | null> {
    if (
      typeof accessSecret !== 'string' ||
      accessSecret.length === 0 ||
      accessSecret.length > INSTITUTIONAL_SECRET_MAX_LENGTH
    ) {
      return null;
    }

    const codigo = this.resolveRequestedIdentityCode(identityCode);
    if (codigo === null) {
      return null;
    }

    const provisioned = await this.ensureProvisionedIdentities();
    const identityId = provisioned.get(codigo) ?? null;
    const { tenantId } = await this.tenants.resolveActiveTenant();

    const identity =
      identityId === null
        ? null
        : await this.prisma.withTenant(tenantId, async (tx) =>
            tx.institutionalIdentity.findFirst({
              where: { id: identityId, tenantId },
              select: {
                id: true,
                role: true,
                status: true,
                accessSecretHash: true,
                accessSecretSalt: true,
              },
            }),
          );

    const closed = identity !== null && await this.isRegistrationConfirmed(tenantId, identity.role);
    if (identity === null || identity.status !== 'ACTIVE' || closed || identity.accessSecretHash === null || identity.accessSecretSalt === null) {
      // Coste comparable al de una credencial incorrecta: no se distingue un
      // código inexistente de una identidad deshabilitada ni de un secreto malo.
      await verifySecret(accessSecret, { hash: SENUELO_HASH, salt: SENUELO_SALT });

      return null;
    }

    const matches = await verifySecret(accessSecret, {
      hash: identity.accessSecretHash,
      salt: identity.accessSecretSalt,
    });

    if (!matches) {
      return null;
    }

    const token = generateSessionToken();
    const expiresAt = new Date(now.getTime() + this.config.sessionTtlSeconds * 1000);

    const session = await this.prisma.withTenant(tenantId, async (tx) => {
      const created = await tx.institutionalSession.create({
        data: {
          tenantId,
          identityId: identity.id,
          tokenHash: hashSessionToken(token),
          expiresAt,
        },
        select: { id: true },
      });

      await this.audit.recordSessionCreatedWithin(
        tx,
        {
          tenantId,
          identityId: identity.id,
          role: identity.role,
          sessionId: created.id,
          endpoint,
          correlationId,
        },
        now,
      );

      return created;
    });

    return {
      principal: {
        sessionId: session.id,
        identityId: identity.id,
        tenantId,
        role: identity.role,
      },
      setCookieHeader: buildInstitutionalSessionCookie(token, this.config.cookie),
      expiresAt,
    };
  }

  /**
   * Valida el token recibido por cookie.
   *
   * Devuelve `null` de forma indistinguible ante ausencia, malformación,
   * inexistencia, expiración, revocación, identidad deshabilitada o tenant
   * ajeno. La denegación no debe permitir deducir cuál de esas condiciones
   * ocurrió ni si existe algún dato detrás.
   */
  public async validate(
    token: string | null,
    now: Date,
    cookie?: string,
    requiredRole?: InstitutionalRoleCode,
  ): Promise<InstitutionalPrincipal | null> {
    if (cookie !== undefined && readCookie(cookie, HUMAN_SESSION_COOKIE_NAME) !== null) {
      return requiredRole === undefined || this.administrators === undefined ? null : this.administrators.resolveForRole(cookie, requiredRole, now);
    }
    if (token === null || !isWellFormedSessionToken(token)) {
      return null;
    }

    const tokenHash = hashSessionToken(token);
    const { tenantId } = await this.tenants.resolveActiveTenant();

    return this.prisma.withTenant(tenantId, async (tx) => {
      const session = await tx.institutionalSession.findFirst({
        where: { tokenHash, tenantId },
        select: {
          id: true,
          tenantId: true,
          tokenHash: true,
          expiresAt: true,
          revokedAt: true,
          identity: { select: { id: true, role: true, status: true, tenantId: true } },
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

      // Redundante con Row Level Security, y deliberadamente conservado: el
      // aislamiento institucional no debe depender de una sola capa.
      if (session.tenantId !== tenantId || session.identity.tenantId !== tenantId) {
        return null;
      }

      if (session.identity.status !== 'ACTIVE') {
        return null;
      }

      const registered = await tx.institutionalAdministratorRegistration.findUnique({ where: { tenantId_experience: { tenantId, experience: experienceForRole(session.identity.role) } }, select: { status: true } });
      if (registered?.status === 'CONFIRMED') return null;

      await tx.institutionalSession.update({
        where: { id: session.id },
        data: { lastUsedAt: now },
      });

      return {
        sessionId: session.id,
        identityId: session.identity.id,
        tenantId,
        role: session.identity.role,
      };
    });
  }

  /**
   * Contexto mínimo de la sesión vigente (TASK-HOSPITAL-CORE-01 §8.0).
   *
   * Lee el nombre REAL del tenant dentro de `withTenant()`, de modo que la
   * política de tenant lo respalda: la sesión solo puede leer la fila de su
   * propia institución. Devuelve `null` si el tenant no existe, en lugar de
   * inventar un nombre.
   */
  public async sessionContext(
    principal: InstitutionalPrincipal,
    expiresAt: Date,
  ): Promise<InstitutionalSessionContext | null> {
    const tenant = await this.prisma.withTenant(principal.tenantId, async (tx) =>
      tx.tenant.findFirst({
        where: { id: principal.tenantId },
        select: { name: true },
      }),
    );

    if (tenant === null) {
      return null;
    }

    return { role: principal.role, expiresAt, institutionName: tenant.name };
  }

  /** Caducidad de la sesión vigente. Es la única metainformación temporal. */
  public async sessionExpiry(principal: InstitutionalPrincipal): Promise<Date | null> {
    const session = await this.prisma.withTenant(principal.tenantId, async (tx) =>
      tx.institutionalSession.findFirst({
        where: { id: principal.sessionId, tenantId: principal.tenantId },
        select: { expiresAt: true },
      }),
    );

    return session?.expiresAt ?? null;
  }

  /** Revoca la sesión. La fila se conserva para trazabilidad histórica. */
  public async revoke(
    principal: InstitutionalPrincipal,
    now: Date,
    correlationId: string,
    endpoint: string,
  ): Promise<void> {
    await this.prisma.withTenant(principal.tenantId, async (tx) => {
      const revoked = await tx.institutionalSession.updateMany({
        where: { id: principal.sessionId, tenantId: principal.tenantId, revokedAt: null },
        data: { revokedAt: now },
      });

      if (revoked.count === 0) {
        return;
      }

      await this.audit.recordSessionRevokedWithin(
        tx,
        {
          tenantId: principal.tenantId,
          identityId: principal.identityId,
          role: principal.role,
          sessionId: principal.sessionId,
          endpoint,
          correlationId,
        },
        now,
      );
    });
  }

  /**
   * Código de identidad solicitado por la petición.
   *
   * Solo se admite una cadena con la forma acotada del contrato. Cualquier otro
   * valor —objeto, número, cadena con forma inesperada— se rechaza ANTES de
   * tocar la base de datos: el cliente no puede inyectar un valor arbitrario en
   * una consulta ni en un registro. Su ausencia resuelve el código municipal
   * configurado, que es la vía de compatibilidad autorizada.
   */
  private resolveRequestedIdentityCode(identityCode: unknown): string | null {
    if (identityCode === undefined || identityCode === null) {
      return this.config.provisioning.compatibilityIdentityCode;
    }

    if (
      typeof identityCode !== 'string' ||
      !INSTITUTIONAL_IDENTITY_CODE_PATTERN.test(identityCode)
    ) {
      return null;
    }

    return identityCode;
  }

  /**
   * Crea o actualiza TODAS las identidades institucionales configuradas.
   *
   * Se ejecuta la primera vez que se necesita, y no en el arranque, para que la
   * API pueda arrancar y responder `GET /health` aunque PostgreSQL todavía no
   * esté disponible. Cada derivación usa una sal nueva.
   *
   * El aprovisionamiento es ADITIVO: actualiza la identidad de cada rol
   * configurado y NO toca ni deshabilita las identidades de los roles que no lo
   * están, de modo que añadir Hospital no invalida las sesiones municipales ya
   * abiertas.
   *
   * Devuelve el mapa `código → identityId` de lo efectivamente aprovisionado.
   * Un código ausente del mapa significa exactamente que no hay identidad y que
   * el acceso queda cerrado.
   */
  private async ensureProvisionedIdentities(): Promise<ReadonlyMap<string, string>> {
    if (this.config.provisioning.identities.length === 0) {
      return new Map();
    }

    if (this.provisioning !== null) {
      return this.provisioning;
    }

    const attempt = (async (): Promise<ReadonlyMap<string, string>> => {
      const { tenantId } = await this.tenants.resolveActiveTenant();
      const aprovisionadas = new Map<string, string>();

      for (const identidad of this.config.provisioning.identities) {
        if (await this.isRegistrationConfirmed(tenantId, identidad.role)) continue;
        const derived = await deriveSecret(identidad.accessSecret);

        const id = await this.prisma.withTenant(tenantId, async (tx) => {
          const existing = await tx.institutionalIdentity.findFirst({
            where: { tenantId, code: identidad.identityCode },
            select: { id: true, administratorRegistrationId: true },
          });

          if (existing !== null) {
            if (existing.administratorRegistrationId !== null) throw new Error('La configuración no puede modificar capacidades administrativas.');
            await tx.institutionalIdentity.update({
              where: { id: existing.id },
              data: {
                role: identidad.role,
                status: 'ACTIVE',
                accessSecretHash: derived.hash,
                accessSecretSalt: derived.salt,
              },
            });

            return existing.id;
          }

          const created = await tx.institutionalIdentity.create({
            data: {
              id: randomUUID(),
              tenantId,
              code: identidad.identityCode,
              role: identidad.role,
              status: 'ACTIVE',
              accessSecretHash: derived.hash,
              accessSecretSalt: derived.salt,
            },
            select: { id: true },
          });

          return created.id;
        });

        aprovisionadas.set(identidad.identityCode, id);
      }

      return aprovisionadas;
    })();

    this.provisioning = attempt.catch((error: unknown) => {
      // Un fallo de aprovisionamiento no debe quedar memorizado: el siguiente
      // intento vuelve a probarlo. El detalle se registra sin la credencial.
      this.provisioning = null;
      this.logger.error(
        error instanceof Error
          ? `No fue posible aprovisionar las identidades institucionales: ${error.name}.`
          : 'No fue posible aprovisionar las identidades institucionales.',
      );

      throw error;
    });

    return this.provisioning;
  }

  private async isRegistrationConfirmed(tenantId: string, role: InstitutionalRoleCode): Promise<boolean> {
    return this.prisma.withTenant(tenantId, async tx => {
      const registration = await tx.institutionalAdministratorRegistration.findUnique({ where: { tenantId_experience: { tenantId, experience: experienceForRole(role) } }, select: { status: true } });
      return registration?.status === 'CONFIRMED';
    });
  }
}
