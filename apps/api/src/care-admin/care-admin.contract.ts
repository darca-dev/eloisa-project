/**
 * Contrato HTTP de la administración de permisos de cuidado (SPEC 055 / MP05b,
 * decisión del PO «Pantalla del gestor»). Las personas se identifican por su
 * documento EXACTO: no hay listados de pacientes ni de cuentas del tenant.
 */

export const CARE_ADMIN_BASE_PATH = 'api/v1/care/admin';

export type DocumentTypeCode =
  | 'CEDULA_CIUDADANIA'
  | 'CEDULA_EXTRANJERIA'
  | 'PASAPORTE'
  | 'PERMISO_PROTECCION_TEMPORAL'
  | 'OTRO';

export type AdminActorKind = 'CAREGIVER' | 'PROFESSIONAL' | 'HOSPITAL_REVIEWER';
export type AdminPermission = 'VIEW_RECORDS' | 'CONTRIBUTE_RECORDS' | 'REQUEST_ALARM' | 'MANAGE_RULES' | 'REVIEW_ALARMS';

export interface PersonReference {
  readonly documentType: DocumentTypeCode;
  readonly documentNumber: string;
}

export interface ManagedOrganizationView {
  readonly organizationId: string;
  readonly name: string;
  readonly kind: string;
}

export interface AdminGrantView {
  readonly id: string;
  readonly actorKind: AdminActorKind;
  readonly permission: AdminPermission;
  readonly personLabel: string;
  readonly status: 'ACTIVE' | 'REVOKED';
  readonly startsAt: string;
  readonly endsAt: string | null;
  readonly authorizationReference: string;
}

export interface AdminContextView {
  readonly contextId: string;
  readonly patientLabel: string;
  readonly status: 'ACTIVE' | 'REVOKED';
  readonly authorizationReference: string;
  readonly createdAt: string;
  readonly grants: readonly AdminGrantView[];
}

export interface AdminCompetenceView {
  readonly id: string;
  readonly personLabel: string;
  readonly status: 'ACTIVE' | 'REVOKED';
  readonly evidenceReference: string;
  readonly startsAt: string;
  readonly endsAt: string | null;
}

export interface AdminOverviewView {
  readonly organizationId: string;
  readonly organizationName: string;
  readonly contexts: readonly AdminContextView[];
  readonly competences: readonly AdminCompetenceView[];
}

export interface CreateContextInput {
  readonly patient: PersonReference;
  readonly authorizationReference: string;
}

export interface GrantInput {
  readonly actorKind: AdminActorKind;
  readonly permission: AdminPermission;
  readonly person: PersonReference;
  readonly authorizationReference: string;
  readonly endsAt: Date | null;
}

export interface CompetenceInput {
  readonly person: PersonReference;
  readonly evidenceReference: string;
  readonly endsAt: Date | null;
}
