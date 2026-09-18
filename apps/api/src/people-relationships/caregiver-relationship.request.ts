import {
  CAREGIVER_AUTHORIZATION_REFERENCE_PATTERN,
  CAREGIVER_REVOCATION_REASONS,
  CAREGIVER_UUID_PATTERN,
  type CaregiverRevocationReason,
} from './caregiver-relationship.contract';

/**
 * Análisis de los cuerpos de la superficie de relaciones
 * (IDENTITY-RELATIONSHIPS-CORE-01 §8.2).
 *
 * Reglas, todas por construcción y no por filtrado posterior:
 *
 * - ALLOWLIST CERRADA de campos por operación. Cualquier otro nombre produce
 *   `400`, y eso incluye de forma expresa `tenantId`, `status`,
 *   `relationshipType`, `purpose`, `validationSource`, `scope`, `version`,
 *   `validatedBy`, `revokedBy`, `actor` y `role`: TODOS los fija el SERVIDOR y
 *   el navegador no es autoridad sobre ninguno;
 * - los campos declarados son OBLIGATORIOS salvo `endsAt`, que admite `null`
 *   explícito para expresar vigencia abierta. Omitirlo NO es lo mismo que
 *   enviarlo nulo: una vigencia sin declarar sería una decisión del servidor;
 * - `expectedVersion` no tiene valor por defecto a propósito: activar o revocar
 *   sin versión esperada sería una escritura ciega y el control optimista
 *   dejaría de proteger nada;
 * - los instantes exigen desplazamiento horario EXPLÍCITO. Un instante sin
 *   offset se interpretaría con la zona del servidor, y la vigencia de una
 *   autorización no puede depender de dónde esté desplegada la aplicación.
 *
 * NOTA sobre claves repetidas: `JSON.parse` conserva la ÚLTIMA aparición de una
 * clave duplicada y descarta las anteriores, de modo que la repetición no llega
 * hasta aquí como tal. Lo que sí se garantiza es que ningún campo fuera de la
 * allowlist sobrevive.
 */

/** Error de validación del cuerpo. Nombra el campo, NUNCA su valor. */
export class CaregiverBodyError extends Error {
  public readonly field: string;

  constructor(field: string, reason: string) {
    super(`El campo «${field}» ${reason}.`);
    this.name = 'CaregiverBodyError';
    this.field = field;
  }
}

/** Campos EXACTOS admitidos al crear. */
export const CAREGIVER_CREATE_FIELDS = [
  'patientId',
  'caregiverPersonId',
  'startsAt',
  'endsAt',
  'authorizationReference',
] as const;

/** Campos EXACTOS admitidos al activar. */
export const CAREGIVER_ACTIVATE_FIELDS = ['expectedVersion'] as const;

/** Campos EXACTOS admitidos al revocar. */
export const CAREGIVER_REVOKE_FIELDS = ['expectedVersion', 'reason'] as const;

/**
 * Instante ISO-8601 con desplazamiento EXPLÍCITO.
 *
 * Admite `Z` o `±HH:MM`. No admite un instante «flotante» sin zona ni una fecha
 * sin hora: las dos formas obligarían al servidor a elegir una zona por su
 * cuenta.
 */
const ISO_INSTANT_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/u;

/** Cuerpo de creación ya validado. Es lo ÚNICO que llega al servicio. */
export interface CaregiverCreateRequest {
  readonly patientId: string;
  readonly caregiverPersonId: string;
  readonly startsAt: Date;
  readonly endsAt: Date | null;
  readonly authorizationReference: string;
}

export interface CaregiverActivateRequest {
  readonly expectedVersion: number;
}

export interface CaregiverRevokeRequest {
  readonly expectedVersion: number;
  readonly reason: CaregiverRevocationReason;
}

function asObject(raw: unknown, allowed: readonly string[]): Readonly<Record<string, unknown>> {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new CaregiverBodyError('body', 'debe ser un objeto JSON');
  }

  const cuerpo = raw as Readonly<Record<string, unknown>>;

  for (const nombre of Object.keys(cuerpo)) {
    if (!allowed.includes(nombre)) {
      throw new CaregiverBodyError(nombre, 'no está admitido en esta operación');
    }
  }

  return cuerpo;
}

function requireUuid(cuerpo: Readonly<Record<string, unknown>>, field: string): string {
  const value = cuerpo[field];

  if (typeof value !== 'string' || !CAREGIVER_UUID_PATTERN.test(value)) {
    throw new CaregiverBodyError(field, 'debe ser un identificador válido');
  }

  return value;
}

function requireInstant(cuerpo: Readonly<Record<string, unknown>>, field: string): Date {
  const value = cuerpo[field];

  if (typeof value !== 'string' || !ISO_INSTANT_PATTERN.test(value)) {
    throw new CaregiverBodyError(
      field,
      'debe ser un instante ISO-8601 con desplazamiento horario explícito',
    );
  }

  const instante = new Date(value);

  if (Number.isNaN(instante.getTime())) {
    throw new CaregiverBodyError(field, 'no corresponde a un instante real del calendario');
  }

  return instante;
}

function requireExpectedVersion(cuerpo: Readonly<Record<string, unknown>>): number {
  const value = cuerpo['expectedVersion'];

  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) {
    throw new CaregiverBodyError(
      'expectedVersion',
      'debe ser un número entero mayor o igual que 1',
    );
  }

  return value;
}

/** Analiza el cuerpo de creación, sin confiar en nada de él. */
export function parseCreateBody(raw: unknown): CaregiverCreateRequest {
  const cuerpo = asObject(raw, CAREGIVER_CREATE_FIELDS);

  const patientId = requireUuid(cuerpo, 'patientId');
  const caregiverPersonId = requireUuid(cuerpo, 'caregiverPersonId');
  const startsAt = requireInstant(cuerpo, 'startsAt');

  /*
   * `endsAt` debe estar PRESENTE, y puede ser `null`. La distinción importa:
   * `null` es una vigencia abierta declarada por quien opera, mientras que
   * omitir el campo dejaría al servidor decidiendo por su cuenta la duración de
   * una autorización sobre datos de otra persona.
   */
  if (!Object.prototype.hasOwnProperty.call(cuerpo, 'endsAt')) {
    throw new CaregiverBodyError(
      'endsAt',
      'es obligatorio y admite null para declarar una vigencia abierta',
    );
  }

  const endsAtRaw = cuerpo['endsAt'];
  const endsAt = endsAtRaw === null ? null : requireInstant(cuerpo, 'endsAt');

  if (endsAt !== null && endsAt.getTime() <= startsAt.getTime()) {
    throw new CaregiverBodyError('endsAt', 'debe ser posterior a startsAt');
  }

  const authorizationReference = cuerpo['authorizationReference'];

  if (
    typeof authorizationReference !== 'string' ||
    !CAREGIVER_AUTHORIZATION_REFERENCE_PATTERN.test(authorizationReference)
  ) {
    /*
     * El motivo describe la FORMA admitida y no repite el valor recibido: una
     * referencia mal formada puede contener datos personales, y devolverla en un
     * mensaje de error la copiaría a un registro o a una pantalla.
     */
    throw new CaregiverBodyError(
      'authorizationReference',
      'debe tener entre 1 y 100 caracteres de mayúsculas, dígitos, punto, dos puntos, ' +
        'guion o guion bajo, y no admite texto libre',
    );
  }

  return { patientId, caregiverPersonId, startsAt, endsAt, authorizationReference };
}

/** Analiza el cuerpo de activación. */
export function parseActivateBody(raw: unknown): CaregiverActivateRequest {
  const cuerpo = asObject(raw, CAREGIVER_ACTIVATE_FIELDS);

  return { expectedVersion: requireExpectedVersion(cuerpo) };
}

/** Analiza el cuerpo de revocación. */
export function parseRevokeBody(raw: unknown): CaregiverRevokeRequest {
  const cuerpo = asObject(raw, CAREGIVER_REVOKE_FIELDS);

  const expectedVersion = requireExpectedVersion(cuerpo);
  const reason = cuerpo['reason'];

  if (
    typeof reason !== 'string' ||
    !(CAREGIVER_REVOCATION_REASONS as readonly string[]).includes(reason)
  ) {
    throw new CaregiverBodyError(
      'reason',
      `debe ser uno de: ${CAREGIVER_REVOCATION_REASONS.join(', ')}`,
    );
  }

  return { expectedVersion, reason: reason as CaregiverRevocationReason };
}

/** Comprueba la forma del identificador recibido por la ruta. */
export function parseRelationshipId(raw: unknown): string {
  if (typeof raw !== 'string' || !CAREGIVER_UUID_PATTERN.test(raw)) {
    throw new CaregiverBodyError('relationshipId', 'debe ser un identificador válido');
  }

  return raw;
}
