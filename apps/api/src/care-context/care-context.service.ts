import { Inject, Injectable, Optional } from '@nestjs/common';

import { API_ENVIRONMENT, type ApiEnvironmentProvider } from '../config/api-environment.provider';
import { type PrismaTransaction } from '../database/prisma-transaction';
import { PrismaService, RUNTIME_ROLE_NAME } from '../database/prisma.service';
import { RuntimeContextUnavailableError } from '../database/runtime-context.error';
import { type HumanPrincipal } from '../identity-access/human-principal';

import { CareContextAuditService } from './care-context-audit.service';
import {
  type AuthorizedCareContext,
  CareContextAccessDeniedError,
  type CareContextPermission,
  type CareContextResource,
  CareContextUnavailableError,
  isCanonicalUuid,
  isCarePermission,
  sanitizeCorrelationId,
} from './care-context.contract';
import {
  type AuthorizedDirectoryPage,
  CareContextDirectoryService,
  type CareDirectoryPage,
} from './care-context-directory.service';
import { type CareContextDecision, CareContextPolicy } from './care-context.policy';

/** Error del trabajo del consumidor: se propaga tal cual, no es indisponibilidad. */
class WorkFailure {
  constructor(public readonly error: unknown) {}
}

/** Organización administrada, ya verificada dentro de la transacción. */
export interface ManagedOrganization {
  readonly tenantId: string;
  readonly organizationId: string;
  readonly organizationName: string;
  readonly managerId: string;
  readonly humanAccountId: string;
}

type Outcome<T> = { readonly granted: true; readonly result: T } | { readonly granted: false };

/**
 * Operación autorizada sobre un contexto de cuidado (SPEC 055 / MP01 §3–§5).
 *
 * Abre UNA transacción `withTenant` con el tenant del principal y, dentro de
 * ella, fija la organización solicitada con alcance transaccional. Toda la
 * decisión, el trabajo y su auditoría ocurren en esa transacción:
 *
 * - CONCEDIDO: se escribe `CARE_CONTEXT_ACCESS_GRANTED` y después se ejecuta el
 *   trabajo. Si el trabajo falla, se revierte TODO, también el evento.
 * - DENEGADO: se escribe el evento de denegación, se confirma la transacción y
 *   SOLO entonces se lanza `CareContextAccessDeniedError`, idéntico en todos
 *   los casos. El trabajo no se ejecuta.
 * - INDISPONIBLE: contexto, política o auditoría que no pueden completarse se
 *   propagan como `CareContextUnavailableError`. Nunca equivalen a permiso.
 *
 * La organización y el contexto identifican lo que se pide; no son autoridad.
 * El principal lo construye `HumanSessionGuard`; este servicio no acepta
 * identidad, tenant ni rol de ninguna otra fuente.
 */
@Injectable()
export class CareContextService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(API_ENVIRONMENT) private readonly environment: ApiEnvironmentProvider,
    @Inject(CareContextPolicy) private readonly policy: CareContextPolicy,
    @Inject(CareContextAuditService) private readonly audit: CareContextAuditService,
    @Optional() @Inject(CareContextDirectoryService) private readonly directory?: CareContextDirectoryService,
  ) {}

  public async withAuthorizedContext<T>(
    principal: HumanPrincipal,
    resource: CareContextResource,
    permission: CareContextPermission,
    correlationId: string,
    now: Date,
    work: (tx: PrismaTransaction, authorized: AuthorizedCareContext) => Promise<T>,
  ): Promise<T> {
    return this.run(principal, resource.contextId, { kind: 'given', organizationId: resource.organizationId }, [permission], correlationId, now, work);
  }

  /**
   * Igual que `withAuthorizedContext`, pero el recurso es SOLO el contexto
   * nombrado en la ruta: la organización se resuelve con el directorio de
   * metadatos propios de la cuenta, nunca a partir de un valor del cliente.
   * Admite varias acciones posibles en orden de preferencia; se concede la
   * primera que la política confirme y se audita UNA sola decisión.
   */
  public async withAuthorizedOwnContext<T>(
    principal: HumanPrincipal,
    contextId: string,
    permissions: readonly CareContextPermission[],
    correlationId: string,
    now: Date,
    work: (tx: PrismaTransaction, authorized: AuthorizedCareContext) => Promise<T>,
  ): Promise<T> {
    if (this.directory === undefined) {
      throw new CareContextUnavailableError('directorio de contextos no disponible');
    }

    return this.run(principal, contextId, { kind: 'own' }, permissions, correlationId, now, work);
  }

  /**
   * Asignación de una alarma (MP07A / A09). El actor necesita REVIEW_ALARMS en
   * el contexto de la ruta y el destinatario su elegibilidad COMPLETA, todo en
   * UNA transacción y con las fuentes de ambos bloqueadas en el orden
   * contractual ANTES del directorio y del advisory del contexto (ver
   * `CareContextPolicy`). El actor se deniega primero y de forma uniforme; la
   * elegibilidad del destinatario llega al trabajo como booleano, sin
   * proyectar su estado. El destinatario no necesita sesión abierta.
   */
  public async withAuthorizedReviewAssignment<T>(
    principal: HumanPrincipal,
    contextId: string,
    recipientAccountId: string,
    correlationId: string,
    now: Date,
    work: (tx: PrismaTransaction, authorized: AuthorizedCareContext, recipientEligible: boolean) => Promise<T>,
  ): Promise<T> {
    if (this.directory === undefined) {
      throw new CareContextUnavailableError('directorio de contextos no disponible');
    }

    return this.run(
      principal,
      contextId,
      { kind: 'own' },
      ['REVIEW_ALARMS'],
      correlationId,
      now,
      (tx, authorized, recipientEligible) => work(tx, authorized, recipientEligible === true),
      { recipientAccountId },
    );
  }

  /**
   * Página del directorio de contextos propios, auditada como una lectura sin
   * organización. Ningún contexto se proyecta sin que MP01 conceda al menos una
   * acción sobre él.
   */
  public async listDirectory(
    principal: HumanPrincipal,
    cursor: string | null,
    limit: number,
    correlationId: string,
    now: Date,
  ): Promise<CareDirectoryPage> {
    if (!isCanonicalUuid(principal.tenantId) || !isCanonicalUuid(principal.humanAccountId)) {
      throw new CareContextUnavailableError('principal no utilizable');
    }

    const directory = this.directory;

    if (directory === undefined) {
      throw new CareContextUnavailableError('directorio de contextos no disponible');
    }

    // El controlador ya validó el cursor (MP07B / A06): uno mal formado aquí es
    // un defecto, nunca un regreso silencioso a la primera página.
    const safeCursor = cursor === null ? null : normalizeUuid(cursor);

    if (cursor !== null && safeCursor === null) {
      throw new CareContextUnavailableError('cursor no utilizable');
    }

    try {
      return await this.prisma.withTenant(principal.tenantId, async (tx) => {
        const page = await directory.listWithin(tx, principal, safeCursor, limit, now);
        await this.audit.recordDirectoryReadWithin(
          tx,
          {
            tenantId: principal.tenantId,
            humanAccountId: principal.humanAccountId,
            correlationId: sanitizeCorrelationId(correlationId),
          },
          now,
        );
        return page;
      });
    } catch (error) {
      throw new CareContextUnavailableError(
        error instanceof RuntimeContextUnavailableError ? 'contexto de ejecución' : 'directorio o auditoría',
        { cause: error },
      );
    }
  }

  /**
   * Ejecuta `work` con UNA página de contextos propios en los que MP01 concede
   * REVIEW_ALARMS, decididos y bloqueados en la misma transacción (MP07B /
   * A06). Cada página vuelve a decidir; el cursor solo dice desde dónde seguir.
   * Se audita como una lectura del directorio, sin organización.
   */
  public async withReviewableContexts<T>(
    principal: HumanPrincipal,
    cursor: string | null,
    limit: number,
    correlationId: string,
    now: Date,
    work: (tx: PrismaTransaction, page: AuthorizedDirectoryPage) => Promise<T>,
  ): Promise<T> {
    if (!isCanonicalUuid(principal.tenantId) || !isCanonicalUuid(principal.humanAccountId)) {
      throw new CareContextUnavailableError('principal no utilizable');
    }

    const directory = this.directory;

    if (directory === undefined) {
      throw new CareContextUnavailableError('directorio de contextos no disponible');
    }

    // El controlador ya validó el cursor; uno mal formado aquí es un defecto.
    const safeCursor = cursor === null ? null : normalizeUuid(cursor);

    if (cursor !== null && safeCursor === null) {
      throw new CareContextUnavailableError('cursor no utilizable');
    }

    try {
      return await this.prisma.withTenant(principal.tenantId, async (tx) => {
        const page = await directory.listAuthorizedPageWithin(tx, principal, 'REVIEW_ALARMS', safeCursor, limit, now);
        await this.audit.recordDirectoryReadWithin(
          tx,
          { tenantId: principal.tenantId, humanAccountId: principal.humanAccountId, correlationId: sanitizeCorrelationId(correlationId) },
          now,
        );
        try {
          return await work(tx, page);
        } catch (error) {
          throw new WorkFailure(error);
        }
      });
    } catch (error) {
      if (error instanceof WorkFailure) {
        throw error.error;
      }
      throw new CareContextUnavailableError(
        error instanceof RuntimeContextUnavailableError ? 'contexto de ejecución' : 'directorio o auditoría',
        { cause: error },
      );
    }
  }

  /**
   * Operación del GESTOR de una organización (SPEC 055 / MP05b). Verifica en la
   * MISMA transacción, con bloqueos: sesión, cuenta y vínculo exactos; la
   * organización ACTIVE y no municipal; y la fila de gestor ACTIVE vigente de
   * esta cuenta. Ser gestor NO concede acceso clínico: `work` solo administra.
   * La denegación se audita con el evento genérico, sin FK de organización.
   */
  public async withManagedOrganization<T>(
    principal: HumanPrincipal,
    requestedOrganizationId: string,
    correlationId: string,
    now: Date,
    work: (tx: PrismaTransaction, managed: ManagedOrganization) => Promise<T>,
  ): Promise<T> {
    if (!isCanonicalUuid(principal.tenantId) || !isCanonicalUuid(principal.humanAccountId)) {
      throw new CareContextUnavailableError('principal no utilizable');
    }

    const organizationId = normalizeUuid(requestedOrganizationId);
    const correlation = sanitizeCorrelationId(correlationId);
    let outcome: Outcome<T>;

    try {
      outcome = await this.prisma.withTenant(principal.tenantId, async (tx): Promise<Outcome<T>> => {
        const denied = async (): Promise<Outcome<T>> => {
          await tx.auditEvent.create({
            data: {
              tenantId: principal.tenantId,
              eventType: 'EXPERIENCE_ACCESS_DENIED',
              actorType: 'HUMAN_ACCOUNT',
              actorUserId: principal.humanAccountId,
              resourceType: 'CareOrganizationAdministration',
              outcome: 'DENIED',
              endpoint: 'internal:care-admin.authorize',
              correlationId: correlation,
              occurredAt: now,
            },
            select: { id: true },
          });
          return { granted: false };
        };

        if (organizationId === null || !(await this.policy.sessionHoldsWithin(tx, principal, now))) {
          return denied();
        }

        await this.enterOrganization(tx, principal.tenantId, organizationId);

        const organizations = await tx.$queryRaw<{ readonly id: string; readonly displayName: string }[]>`
          SELECT "id", "displayName"
            FROM "organization"
           WHERE "id" = ${organizationId}::uuid
             AND "tenantId" = ${principal.tenantId}::uuid
             AND "status" = 'ACTIVE'
             AND "kind" <> 'MUNICIPALITY'
           FOR SHARE`;
        const organization = organizations.length === 1 ? organizations[0] : undefined;

        if (organization === undefined) {
          return denied();
        }

        const managers = await tx.$queryRaw<{ readonly id: string }[]>`
          SELECT "id"
            FROM "organization_care_manager"
           WHERE "tenantId" = ${principal.tenantId}::uuid
             AND "organizationId" = ${organizationId}::uuid
             AND "humanAccountId" = ${principal.humanAccountId}::uuid
             AND "status" = 'ACTIVE'
             AND "startsAt" <= ${now}::timestamptz
             AND ("endsAt" IS NULL OR "endsAt" > ${now}::timestamptz)
           FOR SHARE`;
        const manager = managers.length === 1 ? managers[0] : undefined;

        if (manager === undefined) {
          return denied();
        }

        try {
          return {
            granted: true,
            result: await work(tx, {
              tenantId: principal.tenantId,
              organizationId,
              organizationName: organization.displayName,
              managerId: manager.id,
              humanAccountId: principal.humanAccountId,
            }),
          };
        } catch (error) {
          throw new WorkFailure(error);
        }
      });
    } catch (error) {
      if (error instanceof WorkFailure) {
        throw error.error;
      }
      throw new CareContextUnavailableError(
        error instanceof RuntimeContextUnavailableError ? 'contexto de ejecución' : 'administración o auditoría',
        { cause: error },
      );
    }

    if (!outcome.granted) {
      throw new CareContextAccessDeniedError();
    }

    return outcome.result;
  }

  /** Organizaciones que la PROPIA cuenta gestiona hoy (metadatos mínimos). */
  public async listManagedOrganizations(
    principal: HumanPrincipal,
    now: Date,
  ): Promise<readonly { readonly organizationId: string; readonly name: string; readonly kind: string }[]> {
    if (!isCanonicalUuid(principal.tenantId) || !isCanonicalUuid(principal.humanAccountId)) {
      throw new CareContextUnavailableError('principal no utilizable');
    }

    try {
      return await this.prisma.withTenant(principal.tenantId, async (tx) => {
        if (!(await this.policy.sessionHoldsWithin(tx, principal, now))) {
          return [];
        }

        await tx.$executeRaw`SELECT set_config('merdn.discovery_account_id', ${principal.humanAccountId}, true)`;
        try {
          return await tx.$queryRaw<{ readonly organizationId: string; readonly name: string; readonly kind: string }[]>`
            SELECT o."id" AS "organizationId", o."displayName" AS "name", o."kind"::text AS "kind"
              FROM "organization" o
              JOIN "organization_care_manager" m ON m."organizationId" = o."id" AND m."tenantId" = o."tenantId"
             WHERE o."tenantId" = ${principal.tenantId}::uuid
               AND o."status" = 'ACTIVE'
               AND o."kind" <> 'MUNICIPALITY'
               AND m."humanAccountId" = ${principal.humanAccountId}::uuid
               AND m."status" = 'ACTIVE'
               AND m."startsAt" <= ${now}::timestamptz
               AND (m."endsAt" IS NULL OR m."endsAt" > ${now}::timestamptz)
             ORDER BY o."displayName", o."id"`;
        } finally {
          await tx.$executeRaw`SELECT set_config('merdn.discovery_account_id', '', true)`;
        }
      });
    } catch (error) {
      throw new CareContextUnavailableError('organizaciones gestionadas', { cause: error });
    }
  }

  private async run<T>(
    principal: HumanPrincipal,
    requestedContextId: string,
    organizationSource: { readonly kind: 'given'; readonly organizationId: string } | { readonly kind: 'own' },
    permissions: readonly CareContextPermission[],
    correlationId: string,
    now: Date,
    work: (tx: PrismaTransaction, authorized: AuthorizedCareContext, recipientEligible: boolean | null) => Promise<T>,
    assignment: { readonly recipientAccountId: string } | null = null,
  ): Promise<T> {
    if (
      !isCanonicalUuid(principal.tenantId) ||
      !isCanonicalUuid(principal.humanAccountId) ||
      !isCanonicalUuid(principal.personId) ||
      !isCanonicalUuid(principal.sessionId)
    ) {
      // Un principal así no lo emite el guard; no hay actor atribuible.
      throw new CareContextUnavailableError('principal no utilizable');
    }

    if (permissions.length === 0 || !permissions.every((permission) => isCarePermission(permission))) {
      // La acción la fija el código consumidor, nunca el cliente: una fuera del
      // catálogo cerrado es un defecto, no una denegación de la persona.
      throw new CareContextUnavailableError('acción fuera del catálogo');
    }

    const correlation = sanitizeCorrelationId(correlationId);
    const contextId = normalizeUuid(requestedContextId);
    const givenOrganization =
      organizationSource.kind === 'given' ? normalizeUuid(organizationSource.organizationId) : undefined;
    // Un destinatario mal formado no se bloquea ni se consulta: no es elegible.
    const recipient = assignment === null ? null : normalizeUuid(assignment.recipientAccountId);

    let outcome: Outcome<T>;

    try {
      outcome = await this.prisma.withTenant(principal.tenantId, async (tx): Promise<Outcome<T>> => {
        const unresolved = async (): Promise<Outcome<T>> => {
          await this.audit.recordUnresolvedOrganizationDeniedWithin(
            tx,
            { tenantId: principal.tenantId, humanAccountId: principal.humanAccountId, correlationId: correlation },
            now,
          );
          return { granted: false };
        };

        if (contextId === null || givenOrganization === null) {
          // Nada mal formado llega a un GUC ni a una consulta.
          return unresolved();
        }

        if (assignment !== null) {
          // A09: cuentas {actor, destinatario} bloqueadas antes del directorio.
          await this.policy.prelockAccountsWithin(
            tx,
            principal.tenantId,
            recipient === null ? [principal.humanAccountId] : [principal.humanAccountId, recipient],
          );
        }

        const organizationId =
          givenOrganization ?? (await this.directory?.resolveOrganizationWithin(tx, principal, contextId)) ?? null;

        if (organizationId === null) {
          return unresolved();
        }

        await this.enterOrganization(tx, principal.tenantId, organizationId);

        // A09: resto de fuentes de ambos, por clase y por id, antes de decidir.
        const pinned =
          assignment === null
            ? null
            : await this.policy.prelockReviewSourcesWithin(
                tx,
                principal,
                { organizationId, contextId },
                recipient ?? principal.humanAccountId,
              );

        let decision: CareContextDecision | undefined;

        for (const permission of permissions) {
          decision = await this.policy.decideWithin(tx, principal, { organizationId, contextId }, permission, now, pinned);

          if (decision.kind === 'granted' || decision.organizationId === null) {
            break;
          }
        }

        if (decision === undefined || decision.kind === 'denied') {
          const deniedOrganization = decision?.organizationId ?? null;

          if (deniedOrganization === null) {
            return unresolved();
          }

          await this.audit.recordDeniedWithin(
            tx,
            {
              tenantId: principal.tenantId,
              organizationId: deniedOrganization,
              humanAccountId: principal.humanAccountId,
              correlationId: correlation,
            },
            now,
          );

          return { granted: false };
        }

        await this.audit.recordGrantedWithin(
          tx,
          {
            tenantId: principal.tenantId,
            organizationId: decision.authorized.organizationId,
            contextId: decision.authorized.contextId,
            humanAccountId: principal.humanAccountId,
            correlationId: correlation,
          },
          now,
        );

        // A09: elegibilidad del destinatario con las fuentes ya bloqueadas. Un
        // fallo aquí es indisponibilidad, nunca elegibilidad.
        const recipientEligible =
          pinned === null
            ? null
            : recipient !== null &&
              (await this.policy.reviewRecipientHoldsWithin(tx, decision.authorized, recipient, pinned, now));

        try {
          return { granted: true, result: await work(tx, decision.authorized, recipientEligible) };
        } catch (error) {
          throw new WorkFailure(error);
        }
      });
    } catch (error) {
      if (error instanceof WorkFailure) {
        throw error.error;
      }

      throw new CareContextUnavailableError(
        error instanceof RuntimeContextUnavailableError ? 'contexto de ejecución' : 'decisión o auditoría',
        { cause: error },
      );
    }

    if (!outcome.granted) {
      throw new CareContextAccessDeniedError();
    }

    return outcome.result;
  }

  /**
   * Fija la organización solicitada como ámbito institucional de ESTA
   * transacción y comprueba que quedó aplicada junto con rol y tenant. El valor
   * ya es un UUID canónico; se pasa parametrizado, nunca interpolado.
   */
  private async enterOrganization(
    tx: PrismaTransaction,
    tenantId: string,
    organizationId: string,
  ): Promise<void> {
    await tx.$executeRaw`SELECT set_config('merdn.organization_id', ${organizationId}, true)`;

    const [context] = await tx.$queryRaw<
      { readonly rol: string; readonly tenant: string | null; readonly organization: string | null }[]
    >`SELECT current_user::text AS rol,
             current_setting('merdn.tenant_id', true) AS tenant,
             current_setting('merdn.organization_id', true) AS organization`;

    if (context === undefined || context.organization !== organizationId || context.tenant !== tenantId) {
      throw new RuntimeContextUnavailableError('el ámbito institucional no quedó fijado en la transacción');
    }

    if (this.environment.runtimeRoleMode === 'enforce' && context.rol !== RUNTIME_ROLE_NAME) {
      throw new RuntimeContextUnavailableError(`el rol efectivo no es ${RUNTIME_ROLE_NAME}`);
    }
  }
}

/** UUID canónico en minúsculas, o `null` si no es un UUID. */
function normalizeUuid(value: unknown): string | null {
  const lowered = typeof value === 'string' ? value.toLowerCase() : null;
  return isCanonicalUuid(lowered) ? lowered : null;
}
