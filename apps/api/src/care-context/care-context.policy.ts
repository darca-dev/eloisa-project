import { Inject, Injectable } from '@nestjs/common';

import { type PrismaTransaction } from '../database/prisma-transaction';
import { type HumanPrincipal } from '../identity-access/human-principal';
import { IdentityAccessService } from '../identity-access/identity-access.service';

import {
  type AuthorizedCareContext,
  CARE_PURPOSE,
  CARE_SESSION_LIMITS,
  type CareContextPermission,
  type CareContextResource,
  type CareSessionLimits,
  PATIENT_SELF_PERMISSIONS,
} from './care-context.contract';

/**
 * Decisión de la política. Una denegación lleva la organización SOLO cuando ya
 * se resolvió de forma confiable en el tenant; si no, `null`, para que la
 * auditoría nunca convierta una organización ajena en FK.
 */
export type CareContextDecision =
  | { readonly kind: 'granted'; readonly authorized: AuthorizedCareContext }
  | { readonly kind: 'denied'; readonly organizationId: string | null };

/** Acciones clínicas que exigen competencia declarada vigente. */
const COMPETENCE_PERMISSIONS: readonly CareContextPermission[] = ['MANAGE_RULES', 'REVIEW_ALARMS'];

/** Acciones que un revisor institucional puede ejercer. */
const REVIEWER_PERMISSIONS: readonly CareContextPermission[] = ['VIEW_RECORDS', 'REVIEW_ALARMS'];

/**
 * Orden de evaluación por tipo de actor. Es parte del orden de bloqueos:
 * relación → asignación → perfil → afiliación → competencia, sin retroceder
 * aunque una cuenta tenga concesiones de varios tipos.
 */
const ACTOR_ORDER = ['CAREGIVER', 'PROFESSIONAL', 'HOSPITAL_REVIEWER'] as const;

interface LockedGrant {
  readonly id: string;
  readonly actorKind: string;
  readonly caregiverRelationshipId: string | null;
  readonly careAssignmentId: string | null;
  readonly competenceAttestationId: string | null;
  readonly grantedByHumanAccountId: string;
  readonly createdAt: Date;
}

interface Scope {
  readonly principal: HumanPrincipal;
  readonly binding: string;
  readonly organizationId: string;
  readonly contextId: string;
  readonly patientId: string;
  readonly permission: CareContextPermission;
  readonly now: Date;
}

/**
 * Política transaccional de custodia de cuidado (SPEC 055 / MP01 §4).
 *
 * Se ejecuta DENTRO de la transacción del consumidor, con tenant y organización
 * ya fijados: decisión, trabajo y auditoría comparten un único commit, y los
 * bloqueos `FOR SHARE` se mantienen hasta terminar. No prevalida en otra
 * transacción ni cachea decisiones.
 *
 * ORDEN DE BLOQUEOS, siempre el mismo: cuenta (con su sesión y su vínculo
 * exacto) → organización → contexto → concesiones (por id) →
 * relación/asignación → perfil/afiliación → competencia. Una revocación
 * concurrente que tome `FOR UPDATE` sobre cualquiera de esas filas espera a que
 * termine el trabajo, o gana antes y la decisión la ve.
 *
 * NUNCA concede por: ser manager, tener `VISITS_VIEW` u
 * `HOME_CARE_COORDINATION`, tener perfil profesional o asignación, tener una
 * experiencia aprobada, ni pertenecer a una organización `MUNICIPALITY`.
 */
@Injectable()
export class CareContextPolicy {
  constructor(
    @Inject(IdentityAccessService) private readonly identity: IdentityAccessService,
    @Inject(CARE_SESSION_LIMITS) private readonly limits: CareSessionLimits | null,
  ) {}

  public async decideWithin(
    tx: PrismaTransaction,
    principal: HumanPrincipal,
    resource: CareContextResource,
    permission: CareContextPermission,
    now: Date,
  ): Promise<CareContextDecision> {
    const binding = principal.externalAuthIdentityId;

    if (binding === undefined || this.limits === null || !(await this.sessionHolds(tx, principal, binding, now))) {
      // No se bloquea nada más. Solo se averigua, sin bloquear, si la
      // organización solicitada es atribuible para la auditoría.
      return { kind: 'denied', organizationId: await this.attributableOrganization(tx, principal, resource) };
    }

    const organization = await this.lockOrganization(tx, principal, resource.organizationId);

    if (organization === null) {
      return { kind: 'denied', organizationId: null };
    }

    const denied: CareContextDecision = { kind: 'denied', organizationId: organization.id };

    // Una organización municipal queda representada pero NUNCA habilita
    // acciones clínicas o nominales de cuidado en MP01, ni con concesión.
    if (organization.status !== 'ACTIVE' || organization.kind === 'MUNICIPALITY') {
      return denied;
    }

    const context = await this.lockContext(tx, principal, organization.id, resource.contextId);

    if (context === null) {
      return denied;
    }

    const scope: Scope = {
      principal,
      binding,
      organizationId: organization.id,
      contextId: context.id,
      patientId: context.patientId,
      permission,
      now,
    };

    const own = await this.authorizeOwnPatient(tx, scope);

    if (own !== null) {
      return { kind: 'granted', authorized: own };
    }

    const grants = await this.lockGrants(tx, scope);

    for (const actorKind of ACTOR_ORDER) {
      for (const grant of grants.filter((candidate) => candidate.actorKind === actorKind)) {
        const authorized = await this.authorizeGrant(tx, scope, grant, actorKind);

        if (authorized !== null) {
          return { kind: 'granted', authorized };
        }
      }
    }

    return denied;
  }

  /**
   * Cuenta EXACTA de la sesión, la sesión misma y su vínculo externo, en ese
   * orden y bloqueados: deshabilitar, recuperar, cerrar sesión o desvincular
   * en paralelo espera a que termine el trabajo, o gana antes y aquí se ve.
   * La sesión debe estar sin revocar, dentro de su caducidad absoluta y de
   * inactividad, y haber sido emitida después del corte de autenticación.
   */
  /** Expuesta para la administración del gestor (MP05b): misma comprobación y bloqueos. */
  public async sessionHoldsWithin(tx: PrismaTransaction, principal: HumanPrincipal, now: Date): Promise<boolean> {
    const binding = principal.externalAuthIdentityId;
    return binding !== undefined && this.limits !== null && this.sessionHolds(tx, principal, binding, now);
  }

  private async sessionHolds(
    tx: PrismaTransaction,
    principal: HumanPrincipal,
    binding: string,
    now: Date,
  ): Promise<boolean> {
    const accounts = await tx.$queryRaw<{ readonly authenticationNotBefore: Date | null }[]>`
      SELECT "authenticationNotBefore"
        FROM "human_account"
       WHERE "id" = ${principal.humanAccountId}::uuid
         AND "tenantId" = ${principal.tenantId}::uuid
         AND "personId" = ${principal.personId}::uuid
         AND "status" = 'ACTIVE'
         AND NOT "passwordRecoveryBlocked"
       FOR SHARE
    `;
    const account = accounts.length === 1 ? accounts[0] : undefined;

    if (account === undefined) {
      return false;
    }

    const sessions = await tx.$queryRaw<
      { readonly createdAt: Date; readonly lastUsedAt: Date | null; readonly expiresAt: Date }[]
    >`
      SELECT "createdAt", "lastUsedAt", "expiresAt"
        FROM "human_session"
       WHERE "id" = ${principal.sessionId}::uuid
         AND "tenantId" = ${principal.tenantId}::uuid
         AND "humanAccountId" = ${principal.humanAccountId}::uuid
         AND "externalAuthIdentityId" = ${binding}::uuid
         AND "revokedAt" IS NULL
         AND "expiresAt" > ${now}::timestamptz
       FOR SHARE
    `;
    const session = sessions.length === 1 ? sessions[0] : undefined;

    if (session === undefined || this.limits === null || session.expiresAt.getTime() <= now.getTime()) {
      return false;
    }

    const lastActivity = session.lastUsedAt ?? session.createdAt;

    if (now.getTime() - lastActivity.getTime() >= this.limits.idleSeconds * 1000) {
      return false;
    }

    const notBefore = account.authenticationNotBefore;

    if (notBefore !== null && session.createdAt.getTime() <= notBefore.getTime()) {
      return false;
    }

    const bindings = await tx.$queryRaw<{ readonly id: string }[]>`
      SELECT "id"
        FROM "external_auth_identity"
       WHERE "id" = ${binding}::uuid
         AND "tenantId" = ${principal.tenantId}::uuid
         AND "humanAccountId" = ${principal.humanAccountId}::uuid
         AND "status" = 'ACTIVE'
       FOR SHARE
    `;

    return bindings.length === 1;
  }

  /**
   * Solo para auditar una denegación temprana: ¿existe la organización
   * solicitada en ESTE tenant y bajo el ámbito fijado? Sin bloqueo y sin
   * devolver nada más que su id.
   */
  private async attributableOrganization(
    tx: PrismaTransaction,
    principal: HumanPrincipal,
    resource: CareContextResource,
  ): Promise<string | null> {
    const organization = await tx.organization.findFirst({
      where: { id: resource.organizationId, tenantId: principal.tenantId },
      select: { id: true },
    });

    return organization?.id ?? null;
  }

  /**
   * La organización solicitada, solo si existe en ESTE tenant y es visible bajo
   * el ámbito fijado. Una organización de otro tenant, inexistente o distinta
   * del ámbito resulta indistinguible: `null`.
   */
  private async lockOrganization(
    tx: PrismaTransaction,
    principal: HumanPrincipal,
    organizationId: string,
  ): Promise<{ readonly id: string; readonly kind: string; readonly status: string } | null> {
    const rows = await tx.$queryRaw<
      { readonly id: string; readonly kind: string; readonly status: string }[]
    >`
      SELECT "id", "kind"::text AS "kind", "status"::text AS "status"
        FROM "organization"
       WHERE "id" = ${organizationId}::uuid
         AND "tenantId" = ${principal.tenantId}::uuid
       FOR SHARE
    `;

    return rows.length === 1 ? (rows[0] ?? null) : null;
  }

  private async lockContext(
    tx: PrismaTransaction,
    principal: HumanPrincipal,
    organizationId: string,
    contextId: string,
  ): Promise<{ readonly id: string; readonly patientId: string } | null> {
    const rows = await tx.$queryRaw<{ readonly id: string; readonly patientId: string }[]>`
      SELECT "id", "patientId"
        FROM "patient_care_context"
       WHERE "id" = ${contextId}::uuid
         AND "tenantId" = ${principal.tenantId}::uuid
         AND "organizationId" = ${organizationId}::uuid
         AND "status" = 'ACTIVE'
       FOR SHARE
    `;

    return rows.length === 1 ? (rows[0] ?? null) : null;
  }

  /**
   * Paciente propio: experiencia PATIENT aprobada exacta y participación activa
   * de ESTE paciente. Solo ver, aportar y pedir ayuda; nunca reglas ni revisión.
   */
  private async authorizeOwnPatient(
    tx: PrismaTransaction,
    scope: Scope,
  ): Promise<AuthorizedCareContext | null> {
    if (!PATIENT_SELF_PERMISSIONS.includes(scope.permission)) {
      return null;
    }

    const patient = await this.identity.resolveApprovedPatientWithin(tx, scope.principal);

    if (patient === null || patient.patientId !== scope.patientId) {
      return null;
    }

    return authorizedFrom(scope, 'PATIENT', {
      careAuthorizationId: null,
      caregiverRelationshipId: null,
      careAssignmentId: null,
      competenceAttestationId: null,
    });
  }

  /** Concesiones vigentes de ESTA cuenta, acción y finalidad, bloqueadas por id. */
  private async lockGrants(tx: PrismaTransaction, scope: Scope): Promise<readonly LockedGrant[]> {
    return tx.$queryRaw<LockedGrant[]>`
      SELECT "id",
             "actorKind"::text AS "actorKind",
             "caregiverRelationshipId",
             "careAssignmentId",
             "competenceAttestationId",
             "grantedByHumanAccountId",
             "createdAt"
        FROM "care_authorization"
       WHERE "tenantId" = ${scope.principal.tenantId}::uuid
         AND "organizationId" = ${scope.organizationId}::uuid
         AND "contextId" = ${scope.contextId}::uuid
         AND "patientId" = ${scope.patientId}::uuid
         AND "humanAccountId" = ${scope.principal.humanAccountId}::uuid
         AND "permission"::text = ${scope.permission}
         AND "purpose"::text = ${CARE_PURPOSE}
         AND "status" = 'ACTIVE'
         AND "startsAt" <= ${scope.now}::timestamptz
         AND ("endsAt" IS NULL OR "endsAt" > ${scope.now}::timestamptz)
       ORDER BY "id"
       FOR SHARE
    `;
  }

  private async authorizeGrant(
    tx: PrismaTransaction,
    scope: Scope,
    grant: LockedGrant,
    actorKind: (typeof ACTOR_ORDER)[number],
  ): Promise<AuthorizedCareContext | null> {
    if (!(await this.issuedByManager(tx, scope, grant))) {
      return null;
    }

    const references = {
      careAuthorizationId: grant.id,
      caregiverRelationshipId: grant.caregiverRelationshipId,
      careAssignmentId: grant.careAssignmentId,
      competenceAttestationId: grant.competenceAttestationId,
    };

    switch (actorKind) {
      case 'CAREGIVER':
        return (await this.caregiverHolds(tx, scope, grant))
          ? authorizedFrom(scope, 'CAREGIVER', references)
          : null;
      case 'PROFESSIONAL':
        return (await this.professionalHolds(tx, scope, grant))
          ? authorizedFrom(scope, 'PROFESSIONAL', references)
          : null;
      case 'HOSPITAL_REVIEWER':
        return REVIEWER_PERMISSIONS.includes(scope.permission) &&
          (await this.competenceHolds(tx, scope, grant.competenceAttestationId))
          ? authorizedFrom(scope, 'HOSPITAL_REVIEWER', references)
          : null;
    }
  }

  /**
   * El emisor era manager de ESTA organización en el instante de emisión. No se
   * cancela retroactivamente una concesión porque el emisor deje el cargo
   * después; sí se rechaza una emitida fuera de su periodo de manager. Nadie se
   * concede a sí mismo reglas ni revisión.
   */
  private async issuedByManager(
    tx: PrismaTransaction,
    scope: Scope,
    grant: LockedGrant,
  ): Promise<boolean> {
    if (
      grant.grantedByHumanAccountId === scope.principal.humanAccountId &&
      COMPETENCE_PERMISSIONS.includes(scope.permission)
    ) {
      return false;
    }

    const manager = await tx.organizationCareManager.findFirst({
      where: {
        tenantId: scope.principal.tenantId,
        organizationId: scope.organizationId,
        humanAccountId: grant.grantedByHumanAccountId,
        startsAt: { lte: grant.createdAt },
        AND: [
          { OR: [{ endsAt: null }, { endsAt: { gt: grant.createdAt } }] },
          { OR: [{ revokedAt: null }, { revokedAt: { gt: grant.createdAt } }] },
        ],
      },
      select: { id: true },
    });

    return manager !== null;
  }

  /**
   * Cuidador: experiencia CAREGIVER aprobada exacta y relación ACTIVE vigente
   * del MISMO paciente y de la MISMA persona. La relación es prueba de vínculo;
   * el fundamento es la concesión con su finalidad propia.
   */
  private async caregiverHolds(
    tx: PrismaTransaction,
    scope: Scope,
    grant: LockedGrant,
  ): Promise<boolean> {
    if (COMPETENCE_PERMISSIONS.includes(scope.permission) || grant.caregiverRelationshipId === null) {
      return false;
    }

    if (!(await this.hasApprovedProfile(tx, scope, 'CAREGIVER'))) {
      return false;
    }

    const relationships = await tx.$queryRaw<{ readonly id: string }[]>`
      SELECT "id"
        FROM "patient_caregiver_relationship"
       WHERE "id" = ${grant.caregiverRelationshipId}::uuid
         AND "tenantId" = ${scope.principal.tenantId}::uuid
         AND "patientId" = ${scope.patientId}::uuid
         AND "caregiverPersonId" = ${scope.principal.personId}::uuid
         AND "status" = 'ACTIVE'
         AND "startsAt" <= ${scope.now}::timestamptz
         AND ("endsAt" IS NULL OR "endsAt" > ${scope.now}::timestamptz)
       FOR SHARE
    `;

    return relationships.length === 1;
  }

  /**
   * Profesional: experiencia FIELD_PROFESSIONAL aprobada exacta, asignación
   * ACTIVE vigente al MISMO paciente, perfil ACTIVE de la MISMA persona y al
   * menos una afiliación vigente. Reglas y revisión exigen además competencia.
   */
  private async professionalHolds(
    tx: PrismaTransaction,
    scope: Scope,
    grant: LockedGrant,
  ): Promise<boolean> {
    if (grant.careAssignmentId === null) {
      return false;
    }

    if (!(await this.hasApprovedProfile(tx, scope, 'FIELD_PROFESSIONAL'))) {
      return false;
    }

    const assignments = await tx.$queryRaw<{ readonly professionalId: string }[]>`
      SELECT "professionalId"
        FROM "care_assignment"
       WHERE "id" = ${grant.careAssignmentId}::uuid
         AND "tenantId" = ${scope.principal.tenantId}::uuid
         AND "patientId" = ${scope.patientId}::uuid
         AND "status" = 'ACTIVE'
         AND "startsAt" <= ${scope.now}::timestamptz
         AND ("endsAt" IS NULL OR "endsAt" > ${scope.now}::timestamptz)
       FOR SHARE
    `;

    const professionalId = assignments.length === 1 ? assignments[0]?.professionalId : undefined;

    if (professionalId === undefined) {
      return false;
    }

    const profiles = await tx.$queryRaw<{ readonly id: string }[]>`
      SELECT "id"
        FROM "professional_profile"
       WHERE "id" = ${professionalId}::uuid
         AND "tenantId" = ${scope.principal.tenantId}::uuid
         AND "personId" = ${scope.principal.personId}::uuid
         AND "status" = 'ACTIVE'
       FOR SHARE
    `;

    if (profiles.length !== 1) {
      return false;
    }

    const today = toUtcDate(scope.now);
    const affiliations = await tx.$queryRaw<{ readonly id: string }[]>`
      SELECT "id"
        FROM "professional_affiliation"
       WHERE "professionalId" = ${professionalId}::uuid
         AND "tenantId" = ${scope.principal.tenantId}::uuid
         AND "status" = 'ACTIVE'
         AND "startsOn" <= ${today}::date
         AND ("endsOn" IS NULL OR "endsOn" >= ${today}::date)
       ORDER BY "id"
       FOR SHARE
    `;

    if (affiliations.length === 0) {
      return false;
    }

    return COMPETENCE_PERMISSIONS.includes(scope.permission)
      ? this.competenceHolds(tx, scope, grant.competenceAttestationId)
      : true;
  }

  /**
   * Competencia DECLARADA vigente de esta misma cuenta y organización, validada
   * por otra persona. No se deduce de perfil, asignación ni notas.
   */
  private async competenceHolds(
    tx: PrismaTransaction,
    scope: Scope,
    competenceAttestationId: string | null,
  ): Promise<boolean> {
    if (competenceAttestationId === null) {
      return false;
    }

    const attestations = await tx.$queryRaw<{ readonly id: string }[]>`
      SELECT "id"
        FROM "clinical_competence_attestation"
       WHERE "id" = ${competenceAttestationId}::uuid
         AND "tenantId" = ${scope.principal.tenantId}::uuid
         AND "organizationId" = ${scope.organizationId}::uuid
         AND "humanAccountId" = ${scope.principal.humanAccountId}::uuid
         AND "validatedByHumanAccountId" <> ${scope.principal.humanAccountId}::uuid
         AND "status" = 'ACTIVE'
         AND "startsAt" <= ${scope.now}::timestamptz
         AND ("endsAt" IS NULL OR "endsAt" > ${scope.now}::timestamptz)
       FOR SHARE
    `;

    return attestations.length === 1;
  }

  /** Experiencia aprobada exacta para la cuenta, persona y vínculo de la sesión. */
  private async hasApprovedProfile(
    tx: PrismaTransaction,
    scope: Scope,
    requestedProfile: 'CAREGIVER' | 'FIELD_PROFESSIONAL',
  ): Promise<boolean> {
    const approved = await tx.accessRequest.findFirst({
      where: {
        tenantId: scope.principal.tenantId,
        personId: scope.principal.personId,
        humanAccountId: scope.principal.humanAccountId,
        externalAuthIdentityId: scope.binding,
        requestedProfile,
        status: 'APPROVED',
        externalIdentity: {
          id: scope.binding,
          tenantId: scope.principal.tenantId,
          humanAccountId: scope.principal.humanAccountId,
          status: 'ACTIVE',
        },
      },
      select: { id: true },
    });

    return approved !== null;
  }
}

function authorizedFrom(
  scope: Scope,
  actorKind: AuthorizedCareContext['actorKind'],
  references: Pick<
    AuthorizedCareContext,
    'careAuthorizationId' | 'caregiverRelationshipId' | 'careAssignmentId' | 'competenceAttestationId'
  >,
): AuthorizedCareContext {
  return {
    tenantId: scope.principal.tenantId,
    organizationId: scope.organizationId,
    contextId: scope.contextId,
    patientId: scope.patientId,
    humanAccountId: scope.principal.humanAccountId,
    actorKind,
    permission: scope.permission,
    ...references,
  };
}

function toUtcDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}
