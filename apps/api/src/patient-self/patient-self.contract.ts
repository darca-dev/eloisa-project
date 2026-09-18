/**
 * Contrato de la superficie self-scope del Paciente (spec 021 §6.6-e, §6.6-f,
 * §7; `contracts/paciente-self-scope.contract.md`).
 *
 * Este archivo declara EXCLUSIVAMENTE tipos de SALIDA y constantes de ruta.
 * Deliberadamente NO existe ningún tipo de ENTRADA, y esa ausencia es la primera
 * garantía del contrato: no hay DTO, no hay parámetro, no hay consulta y no hay
 * cuerpo en el que pudiera colarse `patientId`, `personId`, `subject`,
 * documento, tenant o institución. Lo que no se declara no se puede pasar por
 * descuido.
 */

/** Ruta base. Las tres rutas cuelgan de aquí y no hay ninguna más (§1.1). */
export const PATIENT_SELF_BASE_PATH = 'api/v1/patient-self';

/**
 * Etiqueta FIJA del resumen (spec 021 §6.7, §17.C-2).
 *
 * Es una constante del contrato: no se deriva de ningún dato, no varía por
 * persona y no comunica ningún estado.
 */
export const PATIENT_SELF_LABEL = 'Paciente' as const;

/**
 * Códigos de error de la superficie. Son OPACOS y UNIFORMES a propósito: no
 * distinguen ausencia, caducidad, revocación, cuenta deshabilitada ni
 * inexistencia de paciente. Distinguirlas permitiría deducir el estado de una
 * cuenta ajena o la existencia de un paciente (§3.4).
 */
export const PATIENT_SELF_ERROR_CODES = {
  /** No hay principal humano resoluble. Idéntico en todas sus causas. */
  sessionRequired: 'PATIENT_SELF_SESSION_REQUIRED',
  /** Hay sesión humana pero no contexto `PATIENT`. No revela si existe paciente. */
  contextRequired: 'PATIENT_SELF_CONTEXT_REQUIRED',
  /** Contexto de ejecución de base de datos no seguro. Fail-closed. */
  unavailable: 'PATIENT_SELF_UNAVAILABLE',
} as const;

/**
 * Resumen del Paciente. Lista CERRADA de TRES campos (§4.2, spec 021 §17.C-2).
 *
 * Un cuarto campo está fuera de la decisión aprobada del Product Owner y es una
 * STOP CONDITION (spec 021 §19.12), no una ampliación menor.
 */
export interface PatientSelfSummaryView {
  /** Nombre de pila. */
  readonly givenName: string;
  /** Iniciales de presentación. No es un identificador ni una clave. */
  readonly initials: string;
  /** Etiqueta fija `Paciente`. */
  readonly label: typeof PATIENT_SELF_LABEL;
}

/** Modalidades de cita. Reflejo del catálogo ya existente, no uno nuevo. */
export type PatientSelfModality = 'ON_SITE' | 'HOME' | 'VIRTUAL';

/** Estados de cita. Reflejo del catálogo ya existente. */
export type PatientSelfAppointmentStatus = 'REQUESTED' | 'ASSIGNED' | 'CANCELLED';

/** Estados de visita domiciliaria. Reflejo del catálogo ya existente. */
export type PatientSelfVisitStatus =
  | 'SCHEDULED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'NOT_COMPLETED';

/**
 * Una cita propia. TRES campos y ninguno más (§4.3).
 *
 * Sin `id`, sin `patientId`, sin `careAssignmentId` y sin dato de terceros: la
 * pantalla aprobada no los pinta, luego no viajan (§4.1).
 */
export interface PatientSelfAppointmentView {
  /** Fecha y hora programadas, en ISO-8601 UTC. */
  readonly scheduledStart: string;
  readonly modality: PatientSelfModality;
  readonly status: PatientSelfAppointmentStatus;
}

/**
 * Una visita propia. TRES campos y ninguno más (§4.4).
 *
 * `modality` es la constante `HOME`: una visita domiciliaria materializa siempre
 * una cita `HOME`, de modo que la modalidad la fija el filtro de la consulta y
 * no se refleja de una columna.
 */
export interface PatientSelfVisitView {
  /** Fecha y hora de la CITA, única agenda del sistema. ISO-8601 UTC. */
  readonly scheduledStart: string;
  readonly modality: 'HOME';
  readonly status: PatientSelfVisitStatus;
}

/** Envoltura de lista. Vacío es `items: []` y NUNCA un error (§4.6). */
export interface PatientSelfListView<TItem> {
  readonly items: readonly TItem[];
}

/**
 * Cota superior FIJA del servidor para las dos listas (§4.5).
 *
 * No es influible por el cliente: no existe parámetro de paginación, de tamaño
 * ni de ventana. Acota la respuesta de una pantalla de orientación, que no es
 * un listado exhaustivo ni un instrumento de consulta.
 */
export const PATIENT_SELF_MAX_ITEMS = 20;
