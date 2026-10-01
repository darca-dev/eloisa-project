import { resolvePublicApiBaseUrl } from '@/config/environment';

export const HOSPITAL_ACCESS_REQUESTS_PATH = '/api/v1/hospital/access-requests';

export const ACCESS_REQUEST_PROFILES = ['PATIENT', 'CAREGIVER', 'FIELD_PROFESSIONAL'] as const;
export type AccessRequestProfile = (typeof ACCESS_REQUEST_PROFILES)[number];

export const ACCESS_REQUEST_STATUSES = [
  'PENDING',
  'APPROVED_PENDING_PROVISIONING',
  'APPROVED',
  'REJECTED',
  'PROVISIONING_FAILED',
  'SUSPENDED',
  'REVOKED',
] as const;
export type AccessRequestStatus = (typeof ACCESS_REQUEST_STATUSES)[number];

/**
 * Estados que el servidor acepta como FILTRO del listado.
 *
 * Catálogo cerrado y de UNA entrada: `access-request-review.contract.ts` devuelve
 * `400` para cualquier otro valor. Enviar `status` SIN omitirlo es exactamente lo
 * que la bandeja anterior hacía, y por eso solo PENDING estaba a la vista. Sin el
 * parámetro, el servidor devuelve TODOS los estados del tenant —es la única forma
 * de llegar a `PROVISIONING_FAILED`, `APPROVED` o `SUSPENDED`—.
 */
export const ACCESS_REQUEST_LIST_FILTER_STATUSES = ['PENDING'] as const;
export type AccessRequestListFilterStatus = (typeof ACCESS_REQUEST_LIST_FILTER_STATUSES)[number];

export const ACCESS_REQUEST_PROVISIONING_STATUSES = [
  'NOT_STARTED',
  'PENDING',
  'SUCCEEDED',
  'FAILED',
] as const;
export type AccessRequestProvisioningStatus =
  (typeof ACCESS_REQUEST_PROVISIONING_STATUSES)[number];
const PROVISIONING_STATUSES = ACCESS_REQUEST_PROVISIONING_STATUSES;
const DOCUMENT_TYPES = [
  'CEDULA_CIUDADANIA',
  'CEDULA_EXTRANJERIA',
  'PASAPORTE',
  'PERMISO_PROTECCION_TEMPORAL',
  'OTRO',
] as const;
const SEX_GENDER_CODES = ['FEMENINO', 'MASCULINO', 'OTRO', 'PREFIERE_NO_DECIRLO'] as const;
const REASON_CODES = [
  'DEMO_ELIGIBLE',
  'DEMO_NOT_ELIGIBLE',
  'DEMO_PROVISIONING_RETRIED',
  'DEMO_ACCESS_SUSPENDED',
  'DEMO_ACCESS_REACTIVATED',
  'DEMO_ACCESS_REVOKED',
] as const;

/**
 * Códigos de diagnóstico de provisión.
 *
 * Se muestran, no se interpretan. El límite es el del CHECK de la columna —de 1
 * a 64 caracteres— y no un catálogo copiado: la bandeja es una pantalla, no una
 * autoridad sobre esos códigos, y toda la lógica que importa (¿queda reintento?)
 * se apoya en `provisioningAttempts`, que sí es un número.
 */
const PROVISIONING_ERROR_CODE_PATTERN = /^[A-Za-z0-9_]{1,64}$/u;

/**
 * Límite de intentos de provisión, en espejo de `ACCESS_PROVISIONING_MAX_ATTEMPTS`.
 *
 * Es un espejo de PRESENTACIÓN: el servidor es quien lo aplica y quien responde
 * `ACCESS_PROVISIONING_RETRY_LIMIT`. Sirve para no ofrecer un `RETRY_PROVISIONING`
 * que el servidor va a rechazar —`provisioningAttempts` existe en el detalle justo
 * para eso—, nunca para conceder nada.
 */
export const ACCESS_PROVISIONING_MAX_ATTEMPTS = 5;

/**
 * Acciones institucionales. Catálogo CERRADO, en espejo de
 * `ACCESS_REQUEST_REVIEW_ACTIONS`.
 */
export const ACCESS_REQUEST_ACTIONS = [
  'APPROVE',
  'REJECT',
  'RETRY_PROVISIONING',
  'SUSPEND',
  'REACTIVATE',
  'REVOKE',
] as const;
export type AccessRequestAction = (typeof ACCESS_REQUEST_ACTIONS)[number];

/**
 * Motivo por acción. Correspondencia CERRADA, en espejo de
 * `ACCESS_REQUEST_DECISION`: `Record` COMPLETO del tipo, así que añadir una
 * acción sin su motivo no compila y ningún `else` puede aprobar con el motivo
 * del rechazo.
 */
export const ACCESS_REQUEST_ACTION_REASON: Readonly<Record<AccessRequestAction, (typeof REASON_CODES)[number]>> = {
  APPROVE: 'DEMO_ELIGIBLE',
  REJECT: 'DEMO_NOT_ELIGIBLE',
  RETRY_PROVISIONING: 'DEMO_PROVISIONING_RETRIED',
  SUSPEND: 'DEMO_ACCESS_SUSPENDED',
  REACTIVATE: 'DEMO_ACCESS_REACTIVATED',
  REVOKE: 'DEMO_ACCESS_REVOKED',
};

/**
 * Estados de origen que cada acción admite, en espejo de `ACCESS_REQUEST_DECISION`.
 *
 * La bandeja calcula con esto las acciones VÁLIDAS para el estado que muestra:
 * no es autorización —el servidor vuelve a exigir origen, versión y rol—, es
 * dejar de ofrecer botones que terminarían en `409`.
 */
export const ACCESS_REQUEST_ACTION_SOURCE_STATUSES: Readonly<
  Record<AccessRequestAction, readonly AccessRequestStatus[]>
> = {
  APPROVE: ['PENDING'],
  REJECT: ['PENDING', 'PROVISIONING_FAILED'],
  RETRY_PROVISIONING: ['PROVISIONING_FAILED'],
  SUSPEND: ['APPROVED'],
  REACTIVATE: ['SUSPENDED'],
  REVOKE: ['APPROVED', 'SUSPENDED'],
};


export interface AccessRequestListItem {
  readonly requestId: string;
  readonly reference: string;
  readonly requestedProfile: AccessRequestProfile;
  readonly status: AccessRequestStatus;
  readonly version: number;
  readonly submittedAt: string;
  readonly givenNames: string;
  readonly familyNames: string;
}

export interface AccessRequestPage {
  readonly items: readonly AccessRequestListItem[];
  readonly nextCursor: string | null;
}

export interface AccessRequestDetail extends AccessRequestListItem {
  readonly documentType: (typeof DOCUMENT_TYPES)[number];
  readonly documentNumber: string;
  readonly birthDate: string;
  readonly sexGenderCode: (typeof SEX_GENDER_CODES)[number];
  readonly phone: string | null;
  readonly email: string | null;
  readonly provisioningStatus: (typeof PROVISIONING_STATUSES)[number];
  /** Intentos de provisión ya ejecutados. Cero si nunca se intentó. */
  readonly provisioningAttempts: number;
  /** Código del último fallo según el CHECK de la columna, o `null` sin fallo. */
  readonly provisioningErrorCode: string | null;
  readonly decidedAt: string | null;
  readonly decisionReasonCode: (typeof REASON_CODES)[number] | null;
  /**
   * Versión del esquema del expediente ficticio, o `null` sin expediente.
   * Ausente en respuestas anteriores al flujo guiado: se normaliza a `null`.
   */
  readonly registrationSchemaVersion: number | null;
  /**
   * Expediente ficticio declarado, o `null` sin expediente. Se renderiza por
   * secciones y etiquetas, nunca como JSON crudo.
   */
  readonly registration: Record<string, unknown> | null;
}

export interface AccessRequestDecision {
  readonly requestId: string;
  readonly reference: string;
  readonly status: (typeof ACCESS_REQUEST_STATUSES)[number];
  readonly version: number;
  readonly decisionReasonCode: (typeof REASON_CODES)[number];
  readonly decidedAt: string;
}

export type AccessRequestClientFailure =
  | 'invalid-request'
  | 'session-required'
  | 'forbidden'
  | 'not-found'
  | 'conflict'
  | 'unavailable'
  | 'cancelled';

export type AccessRequestClientResult<T> =
  | { readonly kind: 'ok'; readonly data: T }
  | { readonly kind: AccessRequestClientFailure };

export interface AccessRequestListFilters {
  readonly q?: string;
  readonly profile?: AccessRequestProfile;
  /**
   * Filtro de estado. Solo `PENDING` está en el catálogo del servidor.
   *
   * Ausente —el valor por defecto— significa «todos los estados», que es la
   * única forma de que la bandeja vea una provisión fallida o una suspensión:
   * con el parámetro presente, esas filas no existirían para el revisor.
   */
  readonly status?: AccessRequestListFilterStatus;
  readonly cursor?: string;
}

/**
 * Acciones que la bandeja puede ofertar para una fila concreta.
 *
 * Es una PRESENTACIÓN, no autorización: el servidor vuelve a exigir rol, origen,
 * versión vigente y motivo. Devolver una lista vacía significa que la única cosa
 * que queda por hacer con esa fila es leerla.
 */
export function validActionsFor(
  status: AccessRequestStatus,
  provisioningAttempts: number,
): readonly AccessRequestAction[] {
  return ACCESS_REQUEST_ACTIONS.filter(
    (action) =>
      ACCESS_REQUEST_ACTION_SOURCE_STATUSES[action].includes(status) &&
      (action !== 'RETRY_PROVISIONING' ||
        provisioningAttempts < ACCESS_PROVISIONING_MAX_ATTEMPTS),
  );
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const REFERENCE = /^AR-[0-9A-F]{24}$/u;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/u;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  return actual.length === expected.length && actual.every((key, index) => key === [...expected].sort()[index]);
}

function isEnum<T extends string>(value: unknown, values: readonly T[]): value is T {
  return typeof value === 'string' && values.includes(value as T);
}

function isIsoDateTime(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

const LIST_ITEM_KEYS = [
  'requestId', 'reference', 'requestedProfile', 'status', 'version', 'submittedAt',
  'givenNames', 'familyNames',
] as const;

function isListItem(value: unknown): value is AccessRequestListItem {
  if (!isRecord(value) || !hasExactKeys(value, LIST_ITEM_KEYS)) return false;
  return typeof value.requestId === 'string' && UUID.test(value.requestId)
    && typeof value.reference === 'string' && REFERENCE.test(value.reference)
    && isEnum(value.requestedProfile, ACCESS_REQUEST_PROFILES)
    && isEnum(value.status, ACCESS_REQUEST_STATUSES)
    && Number.isInteger(value.version) && (value.version as number) > 0
    && isIsoDateTime(value.submittedAt)
    && typeof value.givenNames === 'string' && value.givenNames.trim() !== ''
    && typeof value.familyNames === 'string' && value.familyNames.trim() !== '';
}

function parsePage(value: unknown): AccessRequestPage | null {
  if (!isRecord(value) || !hasExactKeys(value, ['items', 'nextCursor'])) return null;
  if (!Array.isArray(value.items) || !value.items.every(isListItem)) return null;
  if (value.nextCursor !== null && (typeof value.nextCursor !== 'string' || value.nextCursor === '')) return null;
  return { items: value.items, nextCursor: value.nextCursor as string | null };
}

const DETAIL_KEYS = [
  ...LIST_ITEM_KEYS,
  'documentType', 'documentNumber', 'birthDate', 'sexGenderCode', 'phone', 'email',
  'provisioningStatus', 'provisioningAttempts', 'provisioningErrorCode',
  'decidedAt', 'decisionReasonCode',
] as const;

/**
 * Claves del expediente. OPCIONALES por compatibilidad: las respuestas
 * anteriores al flujo guiado no las traen y se normalizan a `null`. Cuando
 * vienen, ambas o ninguna: el servidor las emite juntas por su CHECK.
 */
const REGISTRATION_KEYS = ['registrationSchemaVersion', 'registration'] as const;

function isRegistration(value: Record<string, unknown>): boolean {
  const version = value['registrationSchemaVersion'];
  const data = value['registration'];

  // Compatibilidad: las respuestas anteriores al flujo guiado no traen las claves.
  if (version === undefined && data === undefined) {
    return true;
  }

  // Coherencia del servidor: ambos nulos o versión con objeto no vacío.
  if (version === null || version === undefined) {
    return data === null || data === undefined;
  }

  if (typeof version !== 'number' || !Number.isInteger(version) || version <= 0) {
    return false;
  }

  return isRecord(data) && Object.keys(data).length > 0;
}

function withRegistration(value: Record<string, unknown>): AccessRequestDetail {
  return {
    ...(value as unknown as AccessRequestDetail),
    registrationSchemaVersion:
      typeof value['registrationSchemaVersion'] === 'number'
        ? (value['registrationSchemaVersion'] as number)
        : null,
    registration: isRecord(value['registration']) ? (value['registration'] as Record<string, unknown>) : null,
  };
}

function parseDetail(value: unknown): AccessRequestDetail | null {
  if (!isRecord(value) || !isListItem(pickListItem(value))) return null;

  const resto = Object.fromEntries(
    Object.entries(value).filter(([key]) => !LIST_ITEM_KEYS.includes(key as never)),
  );

  const esperadas = [...DETAIL_KEYS.filter((key) => !LIST_ITEM_KEYS.includes(key as never))];
  const presentes = Object.keys(resto);

  const sinExpediente = presentes.every((key) => esperadas.includes(key as never)) &&
    esperadas.every((key) => presentes.includes(key));
  const conExpediente = [...esperadas, ...REGISTRATION_KEYS].every((key) =>
    presentes.includes(key),
  ) && presentes.length === esperadas.length + REGISTRATION_KEYS.length;

  if (!sinExpediente && !conExpediente) return null;
  if (!isRegistration(value)) return null;
  if (!isEnum(value.documentType, DOCUMENT_TYPES)
    || typeof value.documentNumber !== 'string' || value.documentNumber.trim() === ''
    || typeof value.birthDate !== 'string' || !DATE_ONLY.test(value.birthDate)
    || isNaN(Date.parse(`${value.birthDate}T00:00:00.000Z`))
    || !isEnum(value.sexGenderCode, SEX_GENDER_CODES)
    || !isNullableString(value.phone) || !isNullableString(value.email)
    || !isEnum(value.provisioningStatus, PROVISIONING_STATUSES)
    || !Number.isInteger(value.provisioningAttempts) || (value.provisioningAttempts as number) < 0
    || (value.provisioningErrorCode !== null
      && (typeof value.provisioningErrorCode !== 'string'
        || !PROVISIONING_ERROR_CODE_PATTERN.test(value.provisioningErrorCode)))
    || (value.decidedAt !== null && !isIsoDateTime(value.decidedAt))
    || (value.decisionReasonCode !== null && !isEnum(value.decisionReasonCode, REASON_CODES))) return null;
  return withRegistration(value);
}

function pickListItem(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(LIST_ITEM_KEYS.map((key) => [key, value[key]]));
}

function parseDecision(value: unknown): AccessRequestDecision | null {
  const keys = ['requestId', 'reference', 'status', 'version', 'decisionReasonCode', 'decidedAt'] as const;
  if (!isRecord(value) || !hasExactKeys(value, keys)) return null;
  if (typeof value.requestId !== 'string' || !UUID.test(value.requestId)
    || typeof value.reference !== 'string' || !REFERENCE.test(value.reference)
    || !isEnum(value.status, ACCESS_REQUEST_STATUSES)
    || !Number.isInteger(value.version) || (value.version as number) <= 0
    || !isEnum(value.decisionReasonCode, REASON_CODES)
    || !isIsoDateTime(value.decidedAt)) return null;
  return value as unknown as AccessRequestDecision;
}

function mapStatus(status: number): AccessRequestClientFailure {
  if (status === 400) return 'invalid-request';
  if (status === 401) return 'session-required';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not-found';
  if (status === 409) return 'conflict';
  return 'unavailable';
}

function failureOf(error: unknown): AccessRequestClientFailure {
  return error instanceof DOMException && error.name === 'AbortError' ? 'cancelled' : 'unavailable';
}

async function read<T>(response: Response, parser: (value: unknown) => T | null): Promise<AccessRequestClientResult<T>> {
  if (!response.ok) return { kind: mapStatus(response.status) };
  try {
    const parsed = parser(await response.json());
    return parsed === null ? { kind: 'unavailable' } : { kind: 'ok', data: parsed };
  } catch {
    return { kind: 'unavailable' };
  }
}

export async function listHospitalAccessRequests(
  filters: AccessRequestListFilters = {},
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<AccessRequestClientResult<AccessRequestPage>> {
  const params = new URLSearchParams({ limit: '20' });
  /*
   * `status` NO se envía por defecto. El servidor devuelve todos los estados del
   * tenant cuando el parámetro ausente, y es lo único que permite ver una
   * provisión fallida, una suspensión o una revocación. Enviar `status=PENDING`
   * —como hacía la bandeja anterior— oculta exactamente las filas sobre las que
   * MP04 pide poder actuar.
   */
  if (filters.status !== undefined) params.set('status', filters.status);
  if (filters.profile !== undefined) params.set('profile', filters.profile);
  if (filters.q !== undefined && filters.q.trim() !== '') params.set('q', filters.q.trim());
  if (filters.cursor !== undefined && filters.cursor !== '') params.set('cursor', filters.cursor);
  try {
    const response = await fetchImpl(`${resolvePublicApiBaseUrl()}${HOSPITAL_ACCESS_REQUESTS_PATH}?${params.toString()}`, {
      method: 'GET', credentials: 'include', cache: 'no-store', signal,
    });
    return read(response, parsePage);
  } catch (error) {
    return { kind: failureOf(error) };
  }
}

export async function getHospitalAccessRequest(
  requestId: string,
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<AccessRequestClientResult<AccessRequestDetail>> {
  if (!UUID.test(requestId)) return { kind: 'invalid-request' };
  try {
    const response = await fetchImpl(`${resolvePublicApiBaseUrl()}${HOSPITAL_ACCESS_REQUESTS_PATH}/${encodeURIComponent(requestId)}`, {
      method: 'GET', credentials: 'include', cache: 'no-store', signal,
    });
    return read(response, parseDetail);
  } catch (error) {
    return { kind: failureOf(error) };
  }
}

export async function decideHospitalAccessRequest(
  requestId: string,
  action: AccessRequestAction,
  expectedVersion: number,
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<AccessRequestClientResult<AccessRequestDecision>> {
  if (!UUID.test(requestId) || !Number.isInteger(expectedVersion) || expectedVersion <= 0) return { kind: 'invalid-request' };
  if (!(ACCESS_REQUEST_ACTIONS as readonly string[]).includes(action)) return { kind: 'invalid-request' };
  /*
   * El motivo sale del CATÁLOGO y nunca del texto de la acción ni de un
   * parámetro del llamante: una decisión con el motivo de otra acción es
   * rechazada por el servidor, y calcularlo aquí evita ese viaje.
   */
  const reasonCode = ACCESS_REQUEST_ACTION_REASON[action];
  try {
    const response = await fetchImpl(`${resolvePublicApiBaseUrl()}${HOSPITAL_ACCESS_REQUESTS_PATH}/${encodeURIComponent(requestId)}/decision`, {
      method: 'POST', credentials: 'include', cache: 'no-store', signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, expectedVersion, reasonCode }),
    });
    return read(response, parseDecision);
  } catch (error) {
    return { kind: failureOf(error) };
  }
}
