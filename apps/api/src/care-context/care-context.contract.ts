import { type CarePermission } from '../generated/prisma/client';

/**
 * Contrato interno de la custodia institucional de cuidado (SPEC 055 / MP01).
 *
 * NO es una superficie HTTP: MP01 no crea endpoints. Lo consumirán los paquetes
 * de bitácoras y alarmas a partir de MP02, siempre con un principal resuelto
 * por `HumanSessionGuard` y nunca con identidad, tenant o rol aportados por el
 * cliente.
 */

/** Acciones de cuidado cerradas. Reflejan exactamente el enum de la base. */
export const CARE_PERMISSIONS = [
  'VIEW_RECORDS',
  'CONTRIBUTE_RECORDS',
  'REQUEST_ALARM',
  'MANAGE_RULES',
  'REVIEW_ALARMS',
] as const satisfies readonly CarePermission[];

export type CareContextPermission = (typeof CARE_PERMISSIONS)[number];

/**
 * Acciones que el paciente propio puede ejercer sin concesión explícita. Nunca
 * incluye reglas ni revisión: la condición de paciente no administra.
 */
export const PATIENT_SELF_PERMISSIONS: readonly CareContextPermission[] = [
  'VIEW_RECORDS',
  'CONTRIBUTE_RECORDS',
  'REQUEST_ALARM',
];

/** Única finalidad que habilita una concesión de cuidado. */
export const CARE_PURPOSE = 'CARE_RECORDING_AND_ALERTS' as const;

/**
 * Recurso SOLICITADO. La organización y el contexto identifican qué se pide;
 * NO son autoridad: la decisión se resuelve contra la base dentro de la misma
 * transacción que ejecuta el trabajo.
 */
export interface CareContextResource {
  readonly organizationId: string;
  readonly contextId: string;
}

/** Vía por la que se concedió el acceso. */
export type CareContextActorKind = 'PATIENT' | 'CAREGIVER' | 'PROFESSIONAL' | 'HOSPITAL_REVIEWER';

/**
 * Referencias MÍNIMAS autorizadas que recibe el trabajo. Son identificadores
 * opacos ya verificados; no contienen entidad personal alguna.
 */
export interface AuthorizedCareContext {
  readonly tenantId: string;
  readonly organizationId: string;
  readonly contextId: string;
  readonly patientId: string;
  readonly humanAccountId: string;
  readonly actorKind: CareContextActorKind;
  readonly permission: CareContextPermission;
  /** Nulo solo para el paciente propio, que no necesita concesión. */
  readonly careAuthorizationId: string | null;
  readonly caregiverRelationshipId: string | null;
  readonly careAssignmentId: string | null;
  readonly competenceAttestationId: string | null;
}

/** Límites de la sesión humana que la política revalida en cada operación. */
export interface CareSessionLimits {
  readonly idleSeconds: number;
}

/** Token de inyección de los límites de sesión. `null` = autenticación humana no aprovisionada. */
export const CARE_SESSION_LIMITS = Symbol('CARE_SESSION_LIMITS');

/** Valores constantes de la auditoría de esta familia. */
export const CARE_CONTEXT_AUDIT = {
  resourceType: 'CareContext',
  endpoint: 'internal:care-context.authorize',
} as const;

/**
 * Denegación UNIFORME. No dice qué referencia faltó, si el contexto existe ni
 * a qué organización pertenece. Se lanza DESPUÉS de confirmar la transacción
 * que persistió su evento de auditoría.
 */
export class CareContextAccessDeniedError extends Error {
  constructor() {
    super('Acceso al contexto de cuidado denegado.');
    this.name = 'CareContextAccessDeniedError';
  }
}

/**
 * Indisponibilidad: contexto de ejecución, política o auditoría no pudieron
 * completarse. Nunca equivale a permiso. El mensaje es técnico y sin datos.
 */
export class CareContextUnavailableError extends Error {
  constructor(reason: string, options?: { readonly cause?: unknown }) {
    super(`Contexto de cuidado no disponible: ${reason}.`, options);
    this.name = 'CareContextUnavailableError';
  }
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;

/** UUID canónico en minúsculas. Se valida ANTES de fijar cualquier GUC. */
export function isCanonicalUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

export function isCarePermission(value: unknown): value is CareContextPermission {
  return typeof value === 'string' && (CARE_PERMISSIONS as readonly string[]).includes(value);
}

const CORRELATION_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/u;

/** Correlación opaca acotada; cualquier otra forma no se persiste. */
export function sanitizeCorrelationId(value: unknown): string | null {
  return typeof value === 'string' && CORRELATION_PATTERN.test(value) ? value : null;
}
