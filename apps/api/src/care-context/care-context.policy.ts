import { Inject, Injectable } from '@nestjs/common';

import { type PrismaTransaction } from '../database/prisma-transaction';
import { Prisma } from '../generated/prisma/client';
import { type HumanPrincipal } from '../identity-access/human-principal';
import { IdentityAccessService, type ResolvedPatient } from '../identity-access/identity-access.service';

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

/**
 * Fuentes de autorización bloqueadas `FOR SHARE` ANTES de decidir una
 * asignación de alarma (MP07A / A09), para el actor y el destinatario a la vez.
 * Mientras existan, la decisión y la elegibilidad solo consideran estas filas:
 * nada que no se bloqueó en el orden contractual entra después.
 */
export interface PinnedReviewSources {
  readonly bindingIds: readonly string[];
  readonly grantIds: readonly string[];
  readonly assignmentIds: readonly string[];
  readonly profileIds: readonly string[];
  readonly affiliationIds: readonly string[];
  readonly competenceIds: readonly string[];
}

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
  readonly permission: string;
  readonly actorKind: string;
  readonly caregiverRelationshipId: string | null;
  readonly careAssignmentId: string | null;
  readonly competenceAttestationId: string | null;
  readonly grantedByHumanAccountId: string;
  readonly createdAt: Date;
}

/**
 * Persona y cuenta cuyas fuentes se comprueban: el actor de la sesión o, en una
 * asignación, el destinatario. Nunca la aporta el cliente: el actor sale del
 * principal del guard y el destinatario de la fila de cuenta bloqueada.
 */
interface Subject {
  readonly tenantId: string;
  readonly humanAccountId: string;
  readonly personId: string;
}

/** Ámbito de una decisión sin la acción: lo que comparten todas las de un contexto. */
type GrantScope = Omit<Scope, 'permission'>;

interface Scope {
  readonly subject: Subject;
  readonly binding: string;
  readonly organizationId: string;
  readonly contextId: string;
  readonly patientId: string;
  readonly permission: CareContextPermission;
  readonly now: Date;
  readonly pinned: PinnedReviewSources | null;
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
 * ASIGNACIÓN (MP07A / A09): el mismo orden por CLASE de fila se aplica a actor y
 * destinatario juntos, antes del directorio y del advisory del contexto: cuentas
 * {actor, destinatario} → sesión del actor → vínculos → organización → contexto
 * → concesiones REVIEW_ALARMS de ambos → asignaciones → perfiles →
 * afiliaciones → competencias, cada clase por id ascendente. Así dos
 * asignaciones cruzadas A→B y B→A toman las mismas filas en el mismo orden.
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
    pinned: PinnedReviewSources | null = null,
  ): Promise<CareContextDecision> {
    const binding = principal.externalAuthIdentityId;

    if (
      binding === undefined ||
      this.limits === null ||
      !(await this.sessionHolds(tx, principal, binding, now, pinned))
    ) {
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
      subject: subjectOf(principal),
      binding,
      organizationId: organization.id,
      contextId: context.id,
      patientId: context.patientId,
      permission,
      now,
      pinned,
    };

    const own = await this.authorizeOwnPatient(tx, principal, scope);

    if (own !== null) {
      return { kind: 'granted', authorized: own };
    }

    const grants = await this.lockGrants(tx, scope, [permission]);

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
   * Decide VARIAS acciones sobre UN contexto en una sola pasada, para el
   * directorio y la cola (MP07B / B06). Concede exactamente lo mismo que
   * `decideWithin` llamado por cada acción en esta transacción con el mismo
   * `now`, pero sin repetir lo que no depende de la acción: sesión,
   * organización, contexto y paciente propio se comprueban una vez —repetirlos
   * solo volvía a leer filas ya bloqueadas `FOR SHARE` hasta el commit— y las
   * concesiones de todas las acciones pendientes se bloquean juntas por id,
   * antes de sus fuentes, conforme al orden de MP01. Cada acción se decide
   * después solo con SUS concesiones. Sin fijación de A09: no sirve para
   * asignar. Devuelve únicamente las acciones concedidas, en el orden pedido.
   */
  public async decideManyWithin(
    tx: PrismaTransaction,
    principal: HumanPrincipal,
    resource: CareContextResource,
    permissions: readonly CareContextPermission[],
    now: Date,
  ): Promise<ReadonlyMap<CareContextPermission, AuthorizedCareContext>> {
    const granted = new Map<CareContextPermission, AuthorizedCareContext>();
    const binding = principal.externalAuthIdentityId;

    if (
      permissions.length === 0 ||
      binding === undefined ||
      this.limits === null ||
      !(await this.sessionHolds(tx, principal, binding, now, null))
    ) {
      return granted;
    }

    const organization = await this.lockOrganization(tx, principal, resource.organizationId);

    if (organization === null || organization.status !== 'ACTIVE' || organization.kind === 'MUNICIPALITY') {
      return granted;
    }

    const context = await this.lockContext(tx, principal, organization.id, resource.contextId);

    if (context === null) {
      return granted;
    }

    const base: GrantScope = {
      subject: subjectOf(principal),
      binding,
      organizationId: organization.id,
      contextId: context.id,
      patientId: context.patientId,
      now,
      pinned: null,
    };

    const patient = permissions.some((permission) => PATIENT_SELF_PERMISSIONS.includes(permission))
      ? await this.identity.resolveApprovedPatientWithin(tx, principal)
      : null;
    const pending: CareContextPermission[] = [];

    for (const permission of permissions) {
      const own = ownPatientFrom({ ...base, permission }, patient);

      if (own === null) {
        pending.push(permission);
      } else {
        granted.set(permission, own);
      }
    }

    const grants = pending.length === 0 ? [] : await this.lockGrants(tx, base, pending);

    for (const permission of pending) {
      const scope: Scope = { ...base, permission };

      decide: for (const actorKind of ACTOR_ORDER) {
        for (const grant of grants.filter((candidate) => candidate.permission === permission && candidate.actorKind === actorKind)) {
          const authorized = await this.authorizeGrant(tx, scope, grant, actorKind);

          if (authorized !== null) {
            granted.set(permission, authorized);
            break decide;
          }
        }
      }
    }

    // Mismo orden que las acciones pedidas, también para las del paciente propio.
    return new Map(permissions.flatMap((permission) => {
      const authorized = granted.get(permission);
      return authorized === undefined ? [] : [[permission, authorized] as const];
    }));
  }

  /**
   * Primer paso de una ASIGNACIÓN (MP07A / A09): bloquea las cuentas
   * {actor, destinatario} del tenant por id, ANTES del directorio que también
   * resuelve la cuenta del actor. Sin filtro de estado previo al bloqueo: el
   * estado se evalúa después con la fila ya bloqueada. Ids deduplicados.
   */
  public async prelockAccountsWithin(tx: PrismaTransaction, tenantId: string, accountIds: readonly string[]): Promise<void> {
    const ids = [...new Set(accountIds)].sort();

    await tx.$queryRaw<{ readonly id: string }[]>`
      SELECT "id"
        FROM "human_account"
       WHERE "tenantId" = ${tenantId}::uuid
         AND "id" = ANY(${ids}::uuid[])
       ORDER BY "id"
       FOR SHARE
    `;
  }

  /**
   * Resto del prebloqueo de una asignación, con la organización ya fijada y
   * antes del advisory del contexto: sesión exacta del actor, vínculos (el del
   * actor y los candidatos del destinatario), organización, contexto,
   * concesiones REVIEW_ALARMS de ambas cuentas, asignaciones, perfiles,
   * afiliaciones y competencias. Todo `FOR SHARE` por id y retenido hasta el
   * commit. Bloquear no decide: la decisión y la elegibilidad vienen después.
   */
  public async prelockReviewSourcesWithin(
    tx: PrismaTransaction,
    principal: HumanPrincipal,
    resource: CareContextResource,
    recipientAccountId: string,
  ): Promise<PinnedReviewSources> {
    const tenantId = principal.tenantId;
    const actorBinding = principal.externalAuthIdentityId ?? null;
    const accounts = [...new Set([principal.humanAccountId, recipientAccountId])];

    await tx.$queryRaw<{ readonly id: string }[]>`
      SELECT "id"
        FROM "human_session"
       WHERE "id" = ${principal.sessionId}::uuid
         AND "tenantId" = ${tenantId}::uuid
         AND "humanAccountId" = ${principal.humanAccountId}::uuid
       FOR SHARE
    `;

    const bindings = await tx.$queryRaw<{ readonly id: string }[]>`
      SELECT "id"
        FROM "external_auth_identity"
       WHERE "tenantId" = ${tenantId}::uuid
         AND (("id" = ${actorBinding}::uuid AND "humanAccountId" = ${principal.humanAccountId}::uuid)
              OR "humanAccountId" = ${recipientAccountId}::uuid)
       ORDER BY "id"
       FOR SHARE
    `;

    await tx.$queryRaw<{ readonly id: string }[]>`
      SELECT "id"
        FROM "organization"
       WHERE "id" = ${resource.organizationId}::uuid
         AND "tenantId" = ${tenantId}::uuid
       FOR SHARE
    `;

    await tx.$queryRaw<{ readonly id: string }[]>`
      SELECT "id"
        FROM "patient_care_context"
       WHERE "id" = ${resource.contextId}::uuid
         AND "tenantId" = ${tenantId}::uuid
         AND "organizationId" = ${resource.organizationId}::uuid
       FOR SHARE
    `;

    const grants = await tx.$queryRaw<
      { readonly id: string; readonly careAssignmentId: string | null; readonly competenceAttestationId: string | null }[]
    >`
      SELECT "id", "careAssignmentId", "competenceAttestationId"
        FROM "care_authorization"
       WHERE "tenantId" = ${tenantId}::uuid
         AND "organizationId" = ${resource.organizationId}::uuid
         AND "contextId" = ${resource.contextId}::uuid
         AND "humanAccountId" = ANY(${accounts}::uuid[])
         AND "permission" = 'REVIEW_ALARMS'
       ORDER BY "id"
       FOR SHARE
    `;

    const assignmentIds = distinct(grants.map((grant) => grant.careAssignmentId));
    const assignments = await tx.$queryRaw<{ readonly id: string; readonly professionalId: string }[]>`
      SELECT "id", "professionalId"
        FROM "care_assignment"
       WHERE "tenantId" = ${tenantId}::uuid
         AND "id" = ANY(${assignmentIds}::uuid[])
       ORDER BY "id"
       FOR SHARE
    `;

    const professionalIds = distinct(assignments.map((assignment) => assignment.professionalId));
    const profiles = await tx.$queryRaw<{ readonly id: string }[]>`
      SELECT "id"
        FROM "professional_profile"
       WHERE "tenantId" = ${tenantId}::uuid
         AND "id" = ANY(${professionalIds}::uuid[])
       ORDER BY "id"
       FOR SHARE
    `;

    const profileIds = profiles.map((profile) => profile.id);
    const affiliations = await tx.$queryRaw<{ readonly id: string }[]>`
      SELECT "id"
        FROM "professional_affiliation"
       WHERE "tenantId" = ${tenantId}::uuid
         AND "professionalId" = ANY(${profileIds}::uuid[])
       ORDER BY "id"
       FOR SHARE
    `;

    const competenceIds = distinct(grants.map((grant) => grant.competenceAttestationId));
    const competences = await tx.$queryRaw<{ readonly id: string }[]>`
      SELECT "id"
        FROM "clinical_competence_attestation"
       WHERE "tenantId" = ${tenantId}::uuid
         AND "organizationId" = ${resource.organizationId}::uuid
         AND "id" = ANY(${competenceIds}::uuid[])
       ORDER BY "id"
       FOR SHARE
    `;

    return {
      bindingIds: bindings.map((row) => row.id),
      grantIds: grants.map((row) => row.id),
      assignmentIds: assignments.map((row) => row.id),
      profileIds,
      affiliationIds: affiliations.map((row) => row.id),
      competenceIds: competences.map((row) => row.id),
    };
  }

  /**
   * Elegibilidad COMPLETA del destinatario de una asignación para REVIEW_ALARMS
   * en el contexto ya autorizado al actor (MP07A / A09). No exige una sesión
   * interactiva ni construye un principal: exige que la cuenta pueda obtener
   * acceso válido con sus capacidades actuales. Cuenta ACTIVE y no bloqueada,
   * persona exacta, vínculo ACTIVE, concesión vigente con finalidad y emisor
   * manager histórico, y competencia vigente; para PROFESSIONAL además un
   * vínculo que coincida EXACTAMENTE con su experiencia FIELD_PROFESSIONAL
   * aprobada, asignación al paciente, perfil y afiliación. Solo considera las
   * filas ya bloqueadas en `pinned`.
   */
  public async reviewRecipientHoldsWithin(
    tx: PrismaTransaction,
    authorized: AuthorizedCareContext,
    recipientAccountId: string,
    pinned: PinnedReviewSources,
    now: Date,
  ): Promise<boolean> {
    if (this.limits === null) {
      return false;
    }

    const accounts = await tx.$queryRaw<{ readonly personId: string }[]>`
      SELECT "personId"
        FROM "human_account"
       WHERE "id" = ${recipientAccountId}::uuid
         AND "tenantId" = ${authorized.tenantId}::uuid
         AND "status" = 'ACTIVE'
         AND NOT "passwordRecoveryBlocked"
       FOR SHARE
    `;
    const personId = accounts.length === 1 ? accounts[0]?.personId : undefined;

    if (personId === undefined) {
      return false;
    }

    const bindings = await tx.$queryRaw<{ readonly id: string }[]>`
      SELECT "id"
        FROM "external_auth_identity"
       WHERE "tenantId" = ${authorized.tenantId}::uuid
         AND "humanAccountId" = ${recipientAccountId}::uuid
         AND "status" = 'ACTIVE'
         AND "id" = ANY(${[...pinned.bindingIds]}::uuid[])
       ORDER BY "id"
       FOR SHARE
    `;

    if (bindings.length === 0) {
      return false;
    }

    const subject: Subject = { tenantId: authorized.tenantId, humanAccountId: recipientAccountId, personId };
    const base = {
      subject,
      organizationId: authorized.organizationId,
      contextId: authorized.contextId,
      patientId: authorized.patientId,
      permission: 'REVIEW_ALARMS' as const,
      now,
      pinned,
    };
    const grants = await this.lockGrants(tx, { ...base, binding: bindings[0]?.id ?? '' }, ['REVIEW_ALARMS']);

    for (const actorKind of ACTOR_ORDER) {
      for (const grant of grants.filter((candidate) => candidate.actorKind === actorKind)) {
        // El destinatario necesita UN vínculo con el que su acceso sea válido; en
        // el profesional, el que coincide exactamente con su experiencia aprobada.
        for (const binding of bindings) {
          if ((await this.authorizeGrant(tx, { ...base, binding: binding.id }, grant, actorKind)) !== null) {
            return true;
          }
        }
      }
    }

    return false;
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
    return binding !== undefined && this.limits !== null && this.sessionHolds(tx, principal, binding, now, null);
  }

  private async sessionHolds(
    tx: PrismaTransaction,
    principal: HumanPrincipal,
    binding: string,
    now: Date,
    pinned: PinnedReviewSources | null,
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

    if (pinned !== null && !pinned.bindingIds.includes(binding)) {
      // En una asignación el vínculo del actor debió quedar prebloqueado.
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
    principal: HumanPrincipal,
    scope: Scope,
  ): Promise<AuthorizedCareContext | null> {
    if (!PATIENT_SELF_PERMISSIONS.includes(scope.permission)) {
      return null;
    }

    return ownPatientFrom(scope, await this.identity.resolveApprovedPatientWithin(tx, principal));
  }

  /** Concesiones vigentes de ESTA cuenta, acciones y finalidad, bloqueadas por id. */
  private async lockGrants(
    tx: PrismaTransaction,
    scope: GrantScope,
    permissions: readonly CareContextPermission[],
  ): Promise<readonly LockedGrant[]> {
    return tx.$queryRaw<LockedGrant[]>`
      SELECT "id",
             "permission"::text AS "permission",
             "actorKind"::text AS "actorKind",
             "caregiverRelationshipId",
             "careAssignmentId",
             "competenceAttestationId",
             "grantedByHumanAccountId",
             "createdAt"
        FROM "care_authorization"
       WHERE "tenantId" = ${scope.subject.tenantId}::uuid
         AND "organizationId" = ${scope.organizationId}::uuid
         AND "contextId" = ${scope.contextId}::uuid
         AND "patientId" = ${scope.patientId}::uuid
         AND "humanAccountId" = ${scope.subject.humanAccountId}::uuid
         AND "permission"::text = ANY(${[...permissions]}::text[])
         AND "purpose"::text = ${CARE_PURPOSE}
         AND "status" = 'ACTIVE'
         AND "startsAt" <= ${scope.now}::timestamptz
         AND ("endsAt" IS NULL OR "endsAt" > ${scope.now}::timestamptz)
         ${pinnedTo(scope.pinned?.grantIds)}
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
      grant.grantedByHumanAccountId === scope.subject.humanAccountId &&
      COMPETENCE_PERMISSIONS.includes(scope.permission)
    ) {
      return false;
    }

    const manager = await tx.organizationCareManager.findFirst({
      where: {
        tenantId: scope.subject.tenantId,
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
         AND "tenantId" = ${scope.subject.tenantId}::uuid
         AND "patientId" = ${scope.patientId}::uuid
         AND "caregiverPersonId" = ${scope.subject.personId}::uuid
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
         AND "tenantId" = ${scope.subject.tenantId}::uuid
         AND "patientId" = ${scope.patientId}::uuid
         AND "status" = 'ACTIVE'
         AND "startsAt" <= ${scope.now}::timestamptz
         AND ("endsAt" IS NULL OR "endsAt" > ${scope.now}::timestamptz)
         ${pinnedTo(scope.pinned?.assignmentIds)}
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
         AND "tenantId" = ${scope.subject.tenantId}::uuid
         AND "personId" = ${scope.subject.personId}::uuid
         AND "status" = 'ACTIVE'
         ${pinnedTo(scope.pinned?.profileIds)}
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
         AND "tenantId" = ${scope.subject.tenantId}::uuid
         AND "status" = 'ACTIVE'
         AND "startsOn" <= ${today}::date
         AND ("endsOn" IS NULL OR "endsOn" >= ${today}::date)
         ${pinnedTo(scope.pinned?.affiliationIds)}
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
         AND "tenantId" = ${scope.subject.tenantId}::uuid
         AND "organizationId" = ${scope.organizationId}::uuid
         AND "humanAccountId" = ${scope.subject.humanAccountId}::uuid
         AND "validatedByHumanAccountId" <> ${scope.subject.humanAccountId}::uuid
         AND "status" = 'ACTIVE'
         AND "startsAt" <= ${scope.now}::timestamptz
         AND ("endsAt" IS NULL OR "endsAt" > ${scope.now}::timestamptz)
         ${pinnedTo(scope.pinned?.competenceIds)}
       FOR SHARE
    `;

    return attestations.length === 1;
  }

  /**
   * Experiencia aprobada exacta para la cuenta, persona y vínculo dados. Se lee
   * SIN bloqueo de fila bajo la cuenta ya bloqueada: los flujos de revisión de
   * solicitudes toman primero esa fila y después la cuenta.
   */
  private async hasApprovedProfile(
    tx: PrismaTransaction,
    scope: Scope,
    requestedProfile: 'CAREGIVER' | 'FIELD_PROFESSIONAL',
  ): Promise<boolean> {
    const approved = await tx.accessRequest.findFirst({
      where: {
        tenantId: scope.subject.tenantId,
        personId: scope.subject.personId,
        humanAccountId: scope.subject.humanAccountId,
        externalAuthIdentityId: scope.binding,
        requestedProfile,
        status: 'APPROVED',
        externalIdentity: {
          id: scope.binding,
          tenantId: scope.subject.tenantId,
          humanAccountId: scope.subject.humanAccountId,
          status: 'ACTIVE',
        },
      },
      select: { id: true },
    });

    return approved !== null;
  }
}

/**
 * Paciente propio: experiencia PATIENT aprobada exacta y participación activa
 * de ESTE paciente, ya resuelta en la transacción. Solo ver, aportar y pedir
 * ayuda; nunca reglas ni revisión.
 */
function ownPatientFrom(scope: Scope, patient: ResolvedPatient | null): AuthorizedCareContext | null {
  if (!PATIENT_SELF_PERMISSIONS.includes(scope.permission) || patient === null || patient.patientId !== scope.patientId) {
    return null;
  }

  return authorizedFrom(scope, 'PATIENT', {
    careAuthorizationId: null,
    caregiverRelationshipId: null,
    careAssignmentId: null,
    competenceAttestationId: null,
  });
}

function subjectOf(principal: HumanPrincipal): Subject {
  return { tenantId: principal.tenantId, humanAccountId: principal.humanAccountId, personId: principal.personId };
}

/** Restringe a filas prebloqueadas en una asignación; sin efecto fuera de ella. */
function pinnedTo(ids: readonly string[] | undefined): Prisma.Sql {
  return ids === undefined ? Prisma.empty : Prisma.sql`AND "id" = ANY(${[...ids]}::uuid[])`;
}

function distinct(values: readonly (string | null)[]): string[] {
  return [...new Set(values.filter((value): value is string => value !== null))].sort();
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
    tenantId: scope.subject.tenantId,
    organizationId: scope.organizationId,
    contextId: scope.contextId,
    patientId: scope.patientId,
    humanAccountId: scope.subject.humanAccountId,
    actorKind,
    permission: scope.permission,
    ...references,
  };
}

function toUtcDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}
