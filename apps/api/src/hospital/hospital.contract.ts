import { institutionalAuditActor } from '../institutional-auth/institutional-audit-actor';
/**
 * Contrato de la superficie hospitalaria de Pacientes
 * (TASK-HOSPITAL-CORE-01 §8).
 *
 * Los tipos se declaran aquí y NO se derivan de Prisma: la respuesta hospitalaria
 * es un contrato propio, no un reflejo del almacenamiento.
 *
 * Datos PROHIBIDOS en cualquier punto de este contrato, de sus errores y de sus
 * registros: `personId`, documento completo, teléfono, correo, dirección exacta,
 * indicaciones para llegar, texto libre de localidad o corregimiento,
 * consentimiento, `tenantId`, identificadores internos relacionados, historia
 * clínica, diagnóstico y cualquier dominio que CORE-01 no modela.
 *
 * LO QUE ESTA SUPERFICIE NO ES: no es una Historia Clínica Electrónica, no
 * emite diagnósticos, no evalúa rangos clínicos, no genera alertas ni semáforos
 * y no acredita relación de atención con ninguna persona. Que un registro
 * aparezca aquí NO demuestra asignación profesional, necesidad individual de
 * conocer ni derecho de acceso a más información.
 */

import { type InstitutionalRoleCode } from '../institutional-auth/institutional-auth.contract';

/**
 * Procedencia declarada de los datos.
 *
 * Identifica que el dato proviene de los registros persistidos de la propia
 * plataforma. NO es una estadística oficial, no procede de ninguna EPS, de ADRES
 * ni de ninguna historia clínica, y no afirma ninguna consulta externa.
 */
export const HOSPITAL_PATIENTS_SOURCE = 'ELOISA_POSTGRESQL';

export type HospitalPatientsSource = typeof HOSPITAL_PATIENTS_SOURCE;

/**
 * Versión de las definiciones métricas de la analítica.
 *
 * Es la MISMA etiqueta `population-v1` que la experiencia Hospital ya usaba para
 * su analítica poblacional: KPI, rangos e intersecciones conservan su
 * significado. Lo que cambia es la FUENTE, que pasa a ser PostgreSQL.
 */
export const HOSPITAL_POPULATION_DEFINITION_VERSION = 'population-v1';

/** Códigos de error del contrato hospitalario. Estables y poco informativos. */
export const HOSPITAL_ERROR_CODES = {
  /** Parámetro desconocido, repetido, mal formado o fuera de rango. */
  invalidQuery: 'HOSPITAL_PATIENTS_INVALID_QUERY',
  /** El paciente no existe o no pertenece al tenant. Uniforme a propósito. */
  notFound: 'HOSPITAL_PATIENT_NOT_FOUND',
  /** Fallo interno controlado. Nunca describe la topología. */
  internal: 'HOSPITAL_PATIENTS_SERVICE_UNAVAILABLE',
} as const;

/* -------------------------------------------------------------------------- */
/* Allowlist de consulta                                                       */
/* -------------------------------------------------------------------------- */

/** Tamaños de página admitidos. Cualquier otro valor es `400`. */
export const HOSPITAL_PAGE_SIZES = [25, 50, 100] as const;

export type HospitalPageSize = (typeof HOSPITAL_PAGE_SIZES)[number];

export const HOSPITAL_DEFAULT_PAGE_SIZE: HospitalPageSize = 50;

/**
 * Criterios de orden admitidos.
 *
 * `proxima` (Próxima atención) NO aparece: la agenda no existe en CORE-01 y
 * ordenar por un dato no modelado produciría un orden inventado.
 */
export const HOSPITAL_SORT_FIELDS = ['name', 'age', 'status'] as const;

export type HospitalSortField = (typeof HOSPITAL_SORT_FIELDS)[number];

export const HOSPITAL_SORT_DIRECTIONS = ['asc', 'desc'] as const;

export type HospitalSortDirection = (typeof HOSPITAL_SORT_DIRECTIONS)[number];

/**
 * Pertenencias poblacionales filtrables.
 *
 * `OLDER_ADULT_60_PLUS` NO es filtrable por pertenencia: la condición de 60 o
 * más se DERIVA siempre de la fecha de nacimiento contra la fecha de corte,
 * porque la pertenencia persistida queda obsoleta cuando alguien cumple 60
 * después de inscribirse. Para eso existe `older60`.
 */
export const HOSPITAL_POPULATION_FILTERS = ['DISABILITY', 'HOME_CARE_REQUIRED'] as const;

export type HospitalPopulationFilter = (typeof HOSPITAL_POPULATION_FILTERS)[number];

export const HOSPITAL_AREA_TYPES = ['URBAN', 'RURAL'] as const;

export type HospitalAreaType = (typeof HOSPITAL_AREA_TYPES)[number];

/** Estados de paciente que CORE-01 modela. Hoy solo existe `ACTIVE`. */
export const HOSPITAL_PATIENT_STATUSES = ['ACTIVE'] as const;

export type HospitalPatientStatus = (typeof HOSPITAL_PATIENT_STATUSES)[number];

/** Edad mínima y máxima admitidas en el filtro de rango. */
export const HOSPITAL_MIN_AGE = 0;
export const HOSPITAL_MAX_AGE = 130;

/** Longitud máxima del término de búsqueda. */
export const HOSPITAL_SEARCH_MAX_LENGTH = 100;

/** Umbral de persona mayor, coherente con la derivación de CORE-01. */
export const HOSPITAL_OLDER_ADULT_THRESHOLD_YEARS = 60;

/** Nombres EXACTOS de los parámetros admitidos. Cualquier otro es `400`. */
export const HOSPITAL_QUERY_PARAMETERS = [
  'page',
  'pageSize',
  'search',
  'ageMin',
  'ageMax',
  'epsCode',
  'populationType',
  'older60',
  'municipalityOfficialCode',
  'areaType',
  'patientStatus',
  'sort',
  'direction',
] as const;

/**
 * Parámetros que la analítica NO admite.
 *
 * La analítica describe el conjunto filtrado COMPLETO: paginarlo u ordenarlo
 * carecería de sentido y podría sugerir que la cifra corresponde a una página.
 */
export const HOSPITAL_ANALYTICS_EXCLUDED_PARAMETERS = [
  'page',
  'pageSize',
  'sort',
  'direction',
] as const;

/* -------------------------------------------------------------------------- */
/* Respuesta                                                                   */
/* -------------------------------------------------------------------------- */

/** Sobre de procedencia común a las tres lecturas. */
export interface HospitalProvenance {
  readonly source: HospitalPatientsSource;
  /** Fecha de corte `AAAA-MM-DD` en UTC con la que se derivó toda edad. */
  readonly asOfDate: string;
  /** Instante de generación de la respuesta. */
  readonly generatedAt: string;
}

/**
 * Territorio canónico publicado.
 *
 * `pendingNormalization` significa exactamente que la localidad declarada
 * todavía no corresponde a una unidad canónica. Su TEXTO LIBRE nunca se
 * devuelve: no es territorio oficial y publicarlo lo convertiría en uno.
 */
export interface HospitalTerritory {
  readonly municipalityOfficialCode: string | null;
  readonly municipalityName: string | null;
  readonly areaType: HospitalAreaType | null;
  readonly localUnitName: string | null;
  readonly pendingNormalization: boolean;
}

export interface HospitalPatientListItem {
  /** Identificador OPACO del paciente. NUNCA es `personId`. */
  readonly patientId: string;
  readonly fullName: string;
  readonly initials: string;
  /** Documento SIEMPRE enmascarado. El valor completo no sale del servidor. */
  readonly documentMasked: string;
  /** Edad cumplida derivada de la fecha de nacimiento a la fecha de corte. */
  readonly age: number;
  readonly epsCode: string;
  readonly epsName: string;
  readonly priorities: HospitalPriorities;
  readonly territory: HospitalTerritory;
  readonly status: HospitalPatientStatus;
  /** Etiqueta NO clínica del estado del registro. */
  readonly statusLabel: string;
}

/**
 * Las tres condiciones prioritarias representadas.
 *
 * `older60` se DERIVA de la fecha de nacimiento. `disabilityDeclared` y
 * `homeCareRequiredDeclared` son datos DECLARADOS por la persona en su
 * inscripción: no son diagnósticos, certificaciones oficiales de discapacidad ni
 * valoraciones de dependencia.
 */
export interface HospitalPriorities {
  readonly older60: boolean;
  readonly disabilityDeclared: boolean;
  readonly homeCareRequiredDeclared: boolean;
}

export interface HospitalPatientList extends HospitalProvenance {
  readonly page: number;
  readonly pageSize: number;
  readonly totalItems: number;
  readonly totalPages: number;
  readonly items: readonly HospitalPatientListItem[];
}

export interface HospitalPatientDetail extends HospitalProvenance {
  readonly patientId: string;
  readonly fullName: string;
  readonly initials: string;
  readonly documentType: string;
  readonly documentTypeLabel: string;
  readonly documentMasked: string;
  readonly birthDate: string;
  readonly age: number;
  readonly epsCode: string;
  readonly epsName: string;
  readonly priorities: HospitalPriorities;
  readonly territory: HospitalTerritory;
  readonly status: HospitalPatientStatus;
  readonly statusLabel: string;
  /**
   * Contacto NO disponible con el rol institucional compartido de este slice.
   *
   * Es un texto FIJO, no un dato vacío: la identidad institucional mínima no
   * demuestra necesidad individual de conocer teléfono ni correo, de modo que el
   * servidor ni siquiera los selecciona de la base.
   */
  readonly contactAvailability: string;
}

/* -------------------------------------------------------------------------- */
/* Analítica                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Celda de una distribución.
 *
 * `percentage` es `null` cuando el denominador es cero. Nunca se escribe `0`:
 * un cero se leería como un hecho y la ausencia de universo no lo es.
 */
export interface HospitalAnalyticsCell {
  readonly key: string;
  readonly label: string;
  readonly value: number;
  readonly percentage: number | null;
}

export interface HospitalAnalyticsDistribution {
  readonly id: string;
  readonly label: string;
  readonly cells: readonly HospitalAnalyticsCell[];
}

/** Rangos de edad mutuamente excluyentes. El orden es vinculante. */
export const HOSPITAL_AGE_RANGES: readonly {
  readonly id: string;
  readonly label: string;
  readonly from: number;
  readonly to: number | null;
}[] = [
  { id: '0-17', label: '0–17', from: 0, to: 17 },
  { id: '18-39', label: '18–39', from: 18, to: 39 },
  { id: '40-59', label: '40–59', from: 40, to: 59 },
  { id: '60-74', label: '60–74', from: 60, to: 74 },
  { id: '75-84', label: '75–84', from: 75, to: 84 },
  { id: '85+', label: '85+', from: 85, to: null },
];

/**
 * Las OCHO combinaciones disjuntas de las tres condiciones.
 *
 * Cada persona cae en exactamente una, de modo que la suma reconcilia el
 * universo filtrado y nadie se cuenta dos veces. Los KPI solapados NO deben
 * sumarse para obtener el total.
 */
export const HOSPITAL_INTERSECTIONS: readonly {
  readonly id: string;
  readonly label: string;
  readonly older60: boolean;
  readonly disabilityDeclared: boolean;
  readonly homeCareRequiredDeclared: boolean;
}[] = [
  { id: 'solo-60', label: 'Solo 60+', older60: true, disabilityDeclared: false, homeCareRequiredDeclared: false },
  { id: '60-discapacidad', label: '60+ y discapacidad', older60: true, disabilityDeclared: true, homeCareRequiredDeclared: false },
  { id: '60-cuidados', label: '60+ y cuidados en casa', older60: true, disabilityDeclared: false, homeCareRequiredDeclared: true },
  { id: 'discapacidad-cuidados', label: 'Discapacidad y cuidados en casa', older60: false, disabilityDeclared: true, homeCareRequiredDeclared: true },
  { id: 'las-tres', label: 'Las tres condiciones', older60: true, disabilityDeclared: true, homeCareRequiredDeclared: true },
  { id: 'solo-discapacidad', label: 'Solo discapacidad', older60: false, disabilityDeclared: true, homeCareRequiredDeclared: false },
  { id: 'solo-cuidados', label: 'Solo cuidados en casa', older60: false, disabilityDeclared: false, homeCareRequiredDeclared: true },
  { id: 'ninguna', label: 'Ninguna de las tres', older60: false, disabilityDeclared: false, homeCareRequiredDeclared: false },
];

export interface HospitalAnalyticsIntersection extends HospitalAnalyticsCell {
  readonly older60: boolean;
  readonly disabilityDeclared: boolean;
  readonly homeCareRequiredDeclared: boolean;
}

export interface HospitalPatientAnalytics extends HospitalProvenance {
  /** Versión de las definiciones métricas aplicadas. */
  readonly definitionVersion: typeof HOSPITAL_POPULATION_DEFINITION_VERSION;
  /** Universo del tenant ANTES de aplicar filtros, con el estado por defecto. */
  readonly activeUniverse: number;
  /** Universo del conjunto FILTRADO. Es el denominador de todo porcentaje. */
  readonly filteredUniverse: number;
  /**
   * Las cuatro cifras que CORE-01 permite calcular honestamente.
   *
   * Se llaman `keyFigures` y NO `indicators` a propósito: en MERDN un indicador
   * institucional es un dominio propio que exige fuente, formula, periodo,
   * propietario, version y linaje. Estas cuatro son CONTEOS de los registros
   * persistidos, con su fecha de corte y su version de definicion, y publicarlas
   * bajo el nombre de indicador las haria pasar por lo que no son.
   */
  readonly keyFigures: readonly HospitalAnalyticsCell[];
  readonly distributions: readonly HospitalAnalyticsDistribution[];
  readonly intersections: readonly HospitalAnalyticsIntersection[];
}

/** Fecha de corte `AAAA-MM-DD` en UTC. La edad no depende de la zona horaria. */
export function toAsOfDate(instant: Date): string {
  return instant.toISOString().slice(0, 10);
}

/* ========================================================================== */
/* Operaciones hospitalarias: Profesionales y Agenda                          */
/* (TASK-HOSPITAL-CORE-02 §6)                                                 */
/* ========================================================================== */

/**
 * Contrato de la superficie hospitalaria de OPERACIONES: directorio mínimo de
 * profesionales, agenda derivada de citas persistidas y la ÚNICA mutación
 * autorizada, que asigna una solicitud existente a un profesional existente.
 *
 * LO QUE ESTA SUPERFICIE NO ES:
 *
 * - no es un registro de talento humano: no acredita título, tarjeta
 *   profesional, RETHUS, habilitación, contrato, nómina, honorarios ni pago;
 * - no es una agenda con disponibilidad: no modela turnos, sedes, salas,
 *   duración, desplazamiento, ruta ni solapamiento por intervalos, y por tanto
 *   NUNCA afirma que un profesional «está libre»;
 * - no es una autorización clínica: asignar no concede acceso a historia
 *   clínica, no acredita necesidad individual de conocer y no habilita ninguna
 *   decisión asistencial;
 * - no abre Visitas domiciliarias, Consultas virtuales, Finanzas, Reportes,
 *   Membresías ni Personal. `modality` es una CLASIFICACIÓN de agenda.
 *
 * Datos PROHIBIDOS en cualquier punto de este contrato, de sus errores y de sus
 * registros: `personId`, documento —completo o enmascarado—, teléfono, correo,
 * dirección, indicaciones, motivo, diagnóstico, alerta, cuidador, consentimiento,
 * `tenantId`, calificación, disponibilidad, salario, honorarios y documentos.
 */

/** Códigos de error del contrato de operaciones. Estables y poco informativos. */
export const HOSPITAL_OPERATIONS_ERROR_CODES = {
  /** Parámetro desconocido, repetido, mal formado o fuera de rango. */
  invalidQuery: 'HOSPITAL_OPERATIONS_INVALID_QUERY',
  /** Cuerpo ausente, con campos desconocidos, repetidos o mal formados. */
  invalidBody: 'HOSPITAL_OPERATIONS_INVALID_BODY',
  /** El profesional no existe o no pertenece al tenant. Uniforme a propósito. */
  professionalNotFound: 'HOSPITAL_PROFESSIONAL_NOT_FOUND',
  /** La cita no existe o no pertenece al tenant. Uniforme a propósito. */
  appointmentNotFound: 'HOSPITAL_APPOINTMENT_NOT_FOUND',
  /** La versión enviada ya no es la vigente: otra operación llegó antes. */
  versionConflict: 'APPOINTMENT_VERSION_CONFLICT',
  /** Estado, profesional o instante no permiten esta transición. */
  notAssignable: 'APPOINTMENT_NOT_ASSIGNABLE',
  /** Fallo interno controlado. Nunca describe la topología. */
  internal: 'HOSPITAL_OPERATIONS_SERVICE_UNAVAILABLE',
} as const;

/* -------------------------------------------------------------------------- */
/* Catálogo controlado de profesiones                                          */
/* -------------------------------------------------------------------------- */

/**
 * Catálogo MÍNIMO de profesiones controlado por el servidor.
 *
 * NO es un registro oficial, no procede de RETHUS ni de ninguna autoridad
 * sanitaria y no acredita habilitación. Existe únicamente para que el nombre de
 * la profesión sea un valor controlado y no texto libre del navegador.
 */
export const HOSPITAL_PROFESSIONS: readonly {
  readonly code: string;
  readonly name: string;
}[] = [
  { code: 'MEDICINA_GENERAL', name: 'Medicina general' },
  { code: 'ENFERMERIA', name: 'Enfermería' },
  { code: 'FISIOTERAPIA', name: 'Fisioterapia' },
  { code: 'TERAPIA_OCUPACIONAL', name: 'Terapia ocupacional' },
  { code: 'PSICOLOGIA', name: 'Psicología' },
  { code: 'NUTRICION_Y_DIETETICA', name: 'Nutrición y dietética' },
  { code: 'TRABAJO_SOCIAL', name: 'Trabajo social' },
];

/** Códigos admitidos, para validar sin recorrer el catálogo en cada llamada. */
export const HOSPITAL_PROFESSION_CODES: readonly string[] = HOSPITAL_PROFESSIONS.map(
  (profession) => profession.code,
);

/** Profesión del catálogo, o `undefined` si el código no pertenece a él. */
export function findProfessionByCode(
  code: string,
): { readonly code: string; readonly name: string } | undefined {
  return HOSPITAL_PROFESSIONS.find((profession) => profession.code === code);
}

/* -------------------------------------------------------------------------- */
/* Allowlist de consulta                                                       */
/* -------------------------------------------------------------------------- */

/** Tamaños de página admitidos por el directorio. Cualquier otro es `400`. */
export const HOSPITAL_PROFESSIONAL_PAGE_SIZES = [25, 50] as const;

export type HospitalProfessionalPageSize =
  (typeof HOSPITAL_PROFESSIONAL_PAGE_SIZES)[number];

export const HOSPITAL_PROFESSIONAL_DEFAULT_PAGE_SIZE: HospitalProfessionalPageSize = 25;

/**
 * Criterios de orden admitidos.
 *
 * NO existe orden por «carga», «calificación» ni «disponibilidad»: dos de esos
 * dominios no están modelados y el tercero no es un atributo del profesional.
 */
export const HOSPITAL_PROFESSIONAL_SORT_FIELDS = ['name', 'profession'] as const;

export type HospitalProfessionalSortField =
  (typeof HOSPITAL_PROFESSIONAL_SORT_FIELDS)[number];

export const HOSPITAL_PROFESSIONAL_STATUSES = ['ACTIVE', 'INACTIVE'] as const;

export type HospitalProfessionalStatus =
  (typeof HOSPITAL_PROFESSIONAL_STATUSES)[number];

export const HOSPITAL_ENGAGEMENT_TYPES = [
  'EMPLOYEE',
  'INDEPENDENT',
  'THIRD_PARTY',
] as const;

export type HospitalEngagementType = (typeof HOSPITAL_ENGAGEMENT_TYPES)[number];

export const HOSPITAL_AFFILIATION_STATUSES = ['ACTIVE', 'INACTIVE', 'ENDED'] as const;

export type HospitalAffiliationStatus = (typeof HOSPITAL_AFFILIATION_STATUSES)[number];

export const HOSPITAL_APPOINTMENT_MODALITIES = ['ON_SITE', 'HOME', 'VIRTUAL'] as const;

export type HospitalAppointmentModality =
  (typeof HOSPITAL_APPOINTMENT_MODALITIES)[number];

export const HOSPITAL_APPOINTMENT_STATUSES = [
  'REQUESTED',
  'ASSIGNED',
  'CANCELLED',
] as const;

export type HospitalAppointmentStatus = (typeof HOSPITAL_APPOINTMENT_STATUSES)[number];

/** Nombres EXACTOS de los parámetros admitidos por el directorio. */
export const HOSPITAL_PROFESSIONAL_QUERY_PARAMETERS = [
  'page',
  'pageSize',
  'search',
  'professionCode',
  'affiliationType',
  'status',
  'sort',
  'direction',
] as const;

/** Nombres EXACTOS de los parámetros admitidos por el detalle profesional. */
export const HOSPITAL_PROFESSIONAL_DETAIL_QUERY_PARAMETERS = ['from', 'to'] as const;

/** Nombres EXACTOS de los parámetros admitidos por la agenda. */
export const HOSPITAL_AGENDA_QUERY_PARAMETERS = ['from', 'to'] as const;

/** Longitud máxima del término de búsqueda del directorio. */
export const HOSPITAL_PROFESSIONAL_SEARCH_MAX_LENGTH = 100;

/**
 * Amplitud MÁXIMA de una ventana de agenda, en días naturales inclusivos.
 *
 * Acota el coste de la consulta y, sobre todo, impide convertir la agenda en
 * una exportación completa del calendario institucional.
 */
export const HOSPITAL_AGENDA_MAX_WINDOW_DAYS = 31;

/* -------------------------------------------------------------------------- */
/* Proyecciones minimizadas                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Paciente MINIMIZADO tal como lo publica esta superficie.
 *
 * Exactamente identificador opaco, nombre e iniciales. Ni documento —tampoco
 * enmascarado—, ni contacto, ni dirección, ni edad, ni EPS, ni condición
 * declarada, ni alerta, ni cuidador, ni motivo: agendar no requiere conocer
 * nada de eso, y publicarlo sería recolección sin finalidad.
 */
export interface HospitalMinimalPatient {
  readonly patientId: string;
  readonly fullName: string;
  readonly initials: string;
}

/** Profesional MINIMIZADO: identificador opaco, nombre, iniciales y profesión. */
export interface HospitalMinimalProfessional {
  readonly professionalId: string;
  readonly fullName: string;
  readonly initials: string;
  readonly professionCode: string;
  readonly professionName: string;
}

/**
 * Vínculo operativo publicado.
 *
 * Es DECLARADO. No acredita relación laboral, contrato, habilitación, pago ni
 * documento, y por eso el contrato no ofrece ningún campo donde afirmarlo.
 */
export interface HospitalAffiliationSummary {
  readonly engagementType: HospitalEngagementType;
  readonly status: HospitalAffiliationStatus;
  readonly startsOn: string;
  readonly endsOn: string | null;
}

/** Sobre de procedencia de las lecturas de operaciones. */
export interface HospitalOperationsProvenance {
  readonly source: HospitalPatientsSource;
  readonly generatedAt: string;
}

/**
 * Fila del directorio de profesionales.
 *
 * `activePatientCount`, `todayAppointmentCount` y `nextAppointmentAt` se DERIVAN
 * de `CareAssignment` y `Appointment` persistidos. NO son disponibilidad, NO son
 * capacidad y NO son rendimiento: son conteos de lo registrado.
 */
export interface HospitalProfessionalListItem extends HospitalMinimalProfessional {
  readonly status: HospitalProfessionalStatus;
  /** Vínculo ACTIVO vigente, o `null` cuando no hay ninguno registrado. */
  readonly activeAffiliation: HospitalAffiliationSummary | null;
  readonly activePatientCount: number;
  readonly todayAppointmentCount: number;
  /** Próxima cita asignada a partir del instante de la consulta. */
  readonly nextAppointmentAt: string | null;
  /**
   * Calificación NO disponible. Es un texto FIJO, no un dato vacío: la
   * plataforma no modela calificaciones y una cifra aquí sería inventada.
   */
  readonly ratingAvailability: string;
}

export interface HospitalProfessionalList extends HospitalOperationsProvenance {
  readonly page: number;
  readonly pageSize: number;
  readonly totalItems: number;
  readonly totalPages: number;
  readonly items: readonly HospitalProfessionalListItem[];
}

/** Cita publicada por la agenda o por el detalle profesional. */
export interface HospitalScheduledAppointment {
  readonly appointmentId: string;
  readonly patient: HospitalMinimalPatient;
  readonly modality: HospitalAppointmentModality;
  readonly status: HospitalAppointmentStatus;
  readonly scheduledStart: string | null;
}

export interface HospitalProfessionalDetail
  extends HospitalProfessionalListItem,
    HospitalOperationsProvenance {
  /** Ventana efectivamente consultada, ya normalizada por el servidor. */
  readonly window: HospitalAgendaWindow;
  /** Pacientes de las asignaciones ACTIVAS. Nunca de las terminadas. */
  readonly assignedPatients: readonly HospitalMinimalPatient[];
  readonly appointments: readonly HospitalScheduledAppointment[];
}

/** Ventana de agenda normalizada, en fechas `AAAA-MM-DD` UTC inclusivas. */
export interface HospitalAgendaWindow {
  readonly from: string;
  readonly to: string;
}

/** Solicitud pendiente de asignación. */
export interface HospitalAgendaRequest {
  readonly appointmentId: string;
  /** Versión vigente. La mutación la exige para el control optimista. */
  readonly version: number;
  readonly patient: HospitalMinimalPatient;
  readonly modality: HospitalAppointmentModality;
  readonly requestedAt: string;
}

/** Cita asignada dentro de la ventana consultada. */
export interface HospitalAgendaAppointment extends HospitalScheduledAppointment {
  readonly professional: HospitalMinimalProfessional;
}

/** Conteo de un día de la ventana. Cero significa exactamente cero registros. */
export interface HospitalAgendaDayCount {
  readonly date: string;
  readonly total: number;
}

/** Conteo por modalidad. Deriva de las MISMAS citas de la ventana. */
export interface HospitalAgendaModalityCount {
  readonly modality: HospitalAppointmentModality;
  readonly total: number;
}

export interface HospitalAgendaView extends HospitalOperationsProvenance {
  readonly window: HospitalAgendaWindow;
  readonly requests: readonly HospitalAgendaRequest[];
  /** Profesionales asignables: perfil ACTIVO con afiliación ACTIVA. */
  readonly assignableProfessionals: readonly HospitalMinimalProfessional[];
  readonly appointments: readonly HospitalAgendaAppointment[];
  readonly dailyCounts: readonly HospitalAgendaDayCount[];
  readonly modalityCounts: readonly HospitalAgendaModalityCount[];
  readonly totalAppointments: number;
}

/** Cita ya asignada, devuelta por la única mutación autorizada. */
export interface HospitalAssignedAppointment extends HospitalOperationsProvenance {
  readonly appointmentId: string;
  readonly version: number;
  readonly status: HospitalAppointmentStatus;
  readonly modality: HospitalAppointmentModality;
  readonly scheduledStart: string;
  readonly patient: HospitalMinimalPatient;
  readonly professional: HospitalMinimalProfessional;
  /** `true` solo cuando esta operación CREÓ el vínculo paciente-profesional. */
  readonly careAssignmentCreated: boolean;
}

/* -------------------------------------------------------------------------- */
/* Textos fijos de indisponibilidad                                            */
/* -------------------------------------------------------------------------- */

/**
 * Textos FIJOS que declaran ausencia de dominio.
 *
 * No son datos vacíos ni valores por defecto: dicen exactamente que la
 * plataforma no modela esa información, para que la interfaz no pueda
 * presentarla como un cero, un guion o una cifra de demostración.
 */
export const HOSPITAL_OPERATIONS_UNAVAILABLE = {
  rating: 'No disponible',
  documents: 'No disponibles en este módulo',
} as const;

/* -------------------------------------------------------------------------- */
/* Auditoría                                                                   */
/* -------------------------------------------------------------------------- */

/** Recursos auditables de la superficie de operaciones. */
export const HOSPITAL_OPERATIONS_RESOURCES = {
  professionalList: 'HospitalProfessionalList',
  professionalDetail: 'HospitalProfessionalDetail',
  agenda: 'HospitalAgenda',
  careAssignment: 'CareAssignment',
  appointment: 'Appointment',
} as const;

export type HospitalOperationsResource =
  (typeof HOSPITAL_OPERATIONS_RESOURCES)[keyof typeof HOSPITAL_OPERATIONS_RESOURCES];

/** Eventos que esta superficie escribe. Coinciden con el enum de la base. */
export type HospitalOperationsEventType =
  | 'HOSPITAL_PROFESSIONAL_LIST_ACCESS_GRANTED'
  | 'HOSPITAL_PROFESSIONAL_DETAIL_ACCESS_GRANTED'
  | 'HOSPITAL_AGENDA_ACCESS_GRANTED'
  | 'CARE_ASSIGNMENT_CREATED'
  | 'APPOINTMENT_ASSIGNED'
  | 'HOSPITAL_OPERATIONS_ACCESS_DENIED';

export interface HospitalOperationsAuditInput {
  readonly tenantId: string;
  /** Identificador OPACO de la identidad institucional, o `null` si no la hubo. */
  readonly humanAccountId?: string;
  readonly identityId: string | null;
  readonly role: InstitutionalRoleCode | null;
  readonly eventType: HospitalOperationsEventType;
  readonly resourceType: HospitalOperationsResource;
  /** `null` cuando el evento describe un ACCESO y no un recurso concreto. */
  readonly resourceId: string | null;
  /** Ruta lógica. NUNCA la cadena de consulta, el cuerpo ni los filtros. */
  readonly endpoint: string;
  readonly correlationId: string;
  readonly occurredAt: Date;
}

/**
 * Construye el evento de auditoría de la superficie de operaciones.
 *
 * Es una función PURA: no escribe nada. Cada servicio la usa dentro de SU
 * transacción, de modo que el evento y el dato comparten destino —o ambos se
 * confirman, o ninguno—, y la lógica del evento vive en un solo sitio.
 *
 * NO copia nombres, documentos, pacientes, término de búsqueda, filtros,
 * conteos, cuerpos, tokens, credenciales ni identificadores de otro tenant.
 */
export function buildHospitalOperationsAudit(input: HospitalOperationsAuditInput): {
  readonly tenantId: string;
  readonly eventType: HospitalOperationsEventType;
  readonly actorType: 'HUMAN_ACCOUNT' | 'INSTITUTIONAL_IDENTITY' | 'UNAUTHENTICATED';
  readonly actorUserId: string | null;
  readonly actorRole: InstitutionalRoleCode | null;
  readonly resourceType: HospitalOperationsResource;
  readonly resourceId: string | null;
  readonly outcome: 'SUCCESS' | 'DENIED';
  readonly endpoint: string;
  readonly correlationId: string;
  readonly occurredAt: Date;
} {
  const denegado = input.eventType === 'HOSPITAL_OPERATIONS_ACCESS_DENIED';

  return {
    tenantId: input.tenantId,
    eventType: input.eventType,
    ...institutionalAuditActor(input),
    resourceType: input.resourceType,
    /*
     * Una DENEGACIÓN nunca nombra el recurso: hacerlo permitiría deducir qué
     * identificador se intentó leer y si existe.
     */
    resourceId: denegado ? null : input.resourceId,
    outcome: denegado ? 'DENIED' : 'SUCCESS',
    endpoint: input.endpoint,
    correlationId: input.correlationId,
    occurredAt: input.occurredAt,
  };
}

/* -------------------------------------------------------------------------- */
/* Proyección de identidad                                                     */
/* -------------------------------------------------------------------------- */

/** Nombre completo mostrable. No incluye documento ni ningún otro dato. */
export function personFullName(givenNames: string, familyNames: string): string {
  return `${givenNames} ${familyNames}`.replace(/\s+/gu, ' ').trim();
}

/**
 * Iniciales de la persona.
 *
 * Se calculan con la primera letra del primer nombre y la del primer apellido.
 * Es una abreviatura de PRESENTACIÓN, no un identificador.
 */
export function personInitials(givenNames: string, familyNames: string): string {
  const primera = (valor: string): string =>
    (valor.trim().split(/\s+/u)[0] ?? '').slice(0, 1).toLocaleUpperCase('es-CO');

  return `${primera(givenNames)}${primera(familyNames)}`;
}

/* -------------------------------------------------------------------------- */
/* Ventanas de fecha                                                           */
/* -------------------------------------------------------------------------- */

/** Fecha `AAAA-MM-DD` en UTC. La ventana no depende de la zona del navegador. */
export function toUtcDate(instant: Date): string {
  return instant.toISOString().slice(0, 10);
}

/** Instante de inicio del día UTC indicado. */
export function startOfUtcDay(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

/**
 * Instante EXCLUSIVO de fin del día UTC indicado.
 *
 * Se usa una cota exclusiva —el inicio del día siguiente— en lugar de
 * `23:59:59.999`: así ninguna cita programada en el último milisegundo del día
 * queda fuera de la ventana por un redondeo.
 */
export function endOfUtcDayExclusive(date: string): Date {
  const inicio = startOfUtcDay(date);

  return new Date(inicio.getTime() + 24 * 60 * 60 * 1000);
}

/** Días naturales inclusivos entre dos fechas `AAAA-MM-DD` UTC. */
export function inclusiveDaySpan(from: string, to: string): number {
  const diferencia = startOfUtcDay(to).getTime() - startOfUtcDay(from).getTime();

  return Math.floor(diferencia / (24 * 60 * 60 * 1000)) + 1;
}

/** Lista de fechas `AAAA-MM-DD` UTC de la ventana, en orden ascendente. */
export function utcDatesOfWindow(from: string, to: string): readonly string[] {
  const fechas: string[] = [];
  const total = inclusiveDaySpan(from, to);
  const inicio = startOfUtcDay(from).getTime();

  for (let indice = 0; indice < total; indice += 1) {
    fechas.push(new Date(inicio + indice * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
  }

  return fechas;
}
