/**
 * Análisis del cuerpo de la ÚNICA mutación autorizada por
 * TASK-HOSPITAL-CORE-02 (§4.2 y §6.3).
 *
 * El cuerpo admitido es EXACTAMENTE:
 *
 * ```json
 * { "professionalId": "uuid", "scheduledStart": "ISO-8601±offset", "expectedVersion": 1 }
 * ```
 *
 * Reglas, todas por construcción y no por filtrado posterior:
 *
 * - ALLOWLIST CERRADA de tres campos. Cualquier otro nombre produce `400`, y
 *   eso incluye `tenantId`, `identityId`, `personId`, `patientId`, `actor`,
 *   `role`, `status` y `version`: el contexto institucional y el estado los
 *   resuelve el SERVIDOR y el navegador no es autoridad sobre ninguno;
 * - los tres campos son OBLIGATORIOS. `expectedVersion` no tiene valor por
 *   defecto a propósito: una asignación sin versión esperada sería una escritura
 *   ciega, y el control optimista dejaría de proteger nada;
 * - `scheduledStart` exige desplazamiento horario EXPLÍCITO. Un instante sin
 *   offset se interpretaría con la zona del servidor, y la hora de una cita no
 *   puede depender de dónde esté desplegada la aplicación.
 *
 * NOTA sobre claves repetidas: `JSON.parse` conserva la ÚLTIMA aparición de una
 * clave duplicada y descarta las anteriores, de modo que la repetición no llega
 * hasta aquí como tal. Lo que sí se garantiza es que ningún campo fuera de la
 * allowlist sobrevive, y que el valor resultante debe satisfacer su forma.
 */

/** Error de validación del cuerpo. Nombra el campo, nunca su valor. */
export class HospitalAssignmentBodyError extends Error {
  public readonly field: string;

  constructor(field: string, reason: string) {
    super(`El campo «${field}» ${reason}.`);
    this.name = 'HospitalAssignmentBodyError';
    this.field = field;
  }
}

/** Campos EXACTOS admitidos en el cuerpo. Cualquier otro produce `400`. */
export const HOSPITAL_ASSIGNMENT_BODY_FIELDS = [
  'professionalId',
  'scheduledStart',
  'expectedVersion',
] as const;

/** Forma admitida de un identificador opaco. */
export const HOSPITAL_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

/**
 * Instante ISO-8601 con desplazamiento EXPLÍCITO.
 *
 * Admite `Z` o `±HH:MM`. No admite un instante «flotante» sin zona, ni una
 * fecha sin hora: las dos formas obligarían al servidor a elegir una zona por
 * su cuenta.
 */
const ISO_INSTANT_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/u;

/** Cuerpo ya validado y normalizado. Es lo ÚNICO que llega al servicio. */
export interface HospitalAssignmentRequest {
  readonly professionalId: string;
  /** Instante absoluto ya resuelto. La zona del cliente no se conserva. */
  readonly scheduledStart: Date;
  readonly expectedVersion: number;
}

/** Analiza y normaliza el cuerpo recibido, sin confiar en nada de él. */
export function parseAssignmentBody(raw: unknown): HospitalAssignmentRequest {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new HospitalAssignmentBodyError('body', 'debe ser un objeto JSON');
  }

  const cuerpo = raw as Readonly<Record<string, unknown>>;

  for (const nombre of Object.keys(cuerpo)) {
    if (!(HOSPITAL_ASSIGNMENT_BODY_FIELDS as readonly string[]).includes(nombre)) {
      throw new HospitalAssignmentBodyError(nombre, 'no está admitido en esta operación');
    }
  }

  const professionalId = cuerpo['professionalId'];

  if (typeof professionalId !== 'string' || !HOSPITAL_UUID_PATTERN.test(professionalId)) {
    throw new HospitalAssignmentBodyError(
      'professionalId',
      'debe ser un identificador válido',
    );
  }

  const scheduledStart = cuerpo['scheduledStart'];

  if (typeof scheduledStart !== 'string' || !ISO_INSTANT_PATTERN.test(scheduledStart)) {
    throw new HospitalAssignmentBodyError(
      'scheduledStart',
      'debe ser un instante ISO-8601 con desplazamiento horario explícito',
    );
  }

  const instante = new Date(scheduledStart);

  if (Number.isNaN(instante.getTime())) {
    throw new HospitalAssignmentBodyError(
      'scheduledStart',
      'no corresponde a un instante real del calendario',
    );
  }

  const expectedVersion = cuerpo['expectedVersion'];

  if (
    typeof expectedVersion !== 'number' ||
    !Number.isSafeInteger(expectedVersion) ||
    expectedVersion < 1
  ) {
    throw new HospitalAssignmentBodyError(
      'expectedVersion',
      'debe ser un número entero mayor o igual que 1',
    );
  }

  return { professionalId, scheduledStart: instante, expectedVersion };
}
