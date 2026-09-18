/**
 * Contrato público de la inscripción de paciente (TASK-MVP-CORE-01 §6).
 *
 * Este archivo define exclusivamente tipos y códigos estables. No importa
 * Prisma, no conoce la base de datos y no contiene lógica: es la frontera que
 * el frontend puede replicar sin acoplarse a la persistencia.
 *
 * El cliente NUNCA es autoridad sobre `tenantId`, `origin`, `status`, `age`,
 * `createdBy`, `enrolledAt` ni la pertenencia poblacional de 60 años o más.
 */

/** Ruta base versionada de la API de pacientes. */
export const PATIENTS_API_BASE_PATH = 'api/v1/patients';

/** Códigos de error estables devueltos por la API. */
export const ENROLLMENT_ERROR_CODES = {
  /** JSON mal formado o cuerpo con forma inválida. */
  invalidRequestBody: 'INVALID_REQUEST_BODY',
  /** Validación semántica fallida. */
  validationFailed: 'ENROLLMENT_VALIDATION_FAILED',
  /** Documento ya registrado en el tenant. */
  documentConflict: 'PATIENT_DOCUMENT_CONFLICT',
  /** Sesión ausente, inválida, expirada o revocada. */
  sessionRequired: 'ENROLLMENT_SESSION_REQUIRED',
  /** Demasiadas peticiones al endpoint público. */
  rateLimited: 'ENROLLMENT_RATE_LIMITED',
  /** Fallo interno; nunca incluye detalle técnico ni datos personales. */
  internal: 'INTERNAL_ERROR',
} as const;

export type EnrollmentErrorCode =
  (typeof ENROLLMENT_ERROR_CODES)[keyof typeof ENROLLMENT_ERROR_CODES];

/** Tipos documentales admitidos. Coinciden con el formulario aprobado. */
export const DOCUMENT_TYPE_CODES = [
  'CEDULA_CIUDADANIA',
  'CEDULA_EXTRANJERIA',
  'PASAPORTE',
  'PERMISO_PROTECCION_TEMPORAL',
  'OTRO',
] as const;

export type DocumentTypeCode = (typeof DOCUMENT_TYPE_CODES)[number];

/** Valores de sexo/género admitidos. No es una categoría clínica. */
export const SEX_GENDER_CODES = [
  'FEMENINO',
  'MASCULINO',
  'OTRO',
  'PREFIERE_NO_DECIRLO',
] as const;

export type SexGenderCodeValue = (typeof SEX_GENDER_CODES)[number];

/** Poblaciones que el cliente puede declarar. */
export const DECLARABLE_POPULATION_CODES = ['DISABILITY', 'HOME_CARE_REQUIRED'] as const;

export type DeclarablePopulationCode = (typeof DECLARABLE_POPULATION_CODES)[number];

/** Poblaciones que puede devolver la API, incluida la derivada por el servidor. */
export const POPULATION_CODES = [
  'OLDER_ADULT_60_PLUS',
  ...DECLARABLE_POPULATION_CODES,
] as const;

export type PopulationCode = (typeof POPULATION_CODES)[number];

export type PopulationSourceCode = 'DECLARED' | 'DERIVED_BIRTH_DATE';

/** Área de la dirección declarada. */
export const AREA_TYPE_CODES = ['URBAN', 'RURAL'] as const;

export type AreaTypeCode = (typeof AREA_TYPE_CODES)[number];

/**
 * Valor canónico admitido en `localUnitId` cuando la localidad declarada no
 * corresponde a ninguna unidad del catálogo controlado del tenant.
 *
 * Usarlo NO crea una unidad territorial: conserva el texto declarado aparte y
 * marca la dirección como pendiente de normalización administrativa.
 */
export const LOCAL_UNIT_PENDING_NORMALIZATION = 'OTHER_PENDING_NORMALIZATION';

/** Territorio declarado en la inscripción. */
export interface EnrollmentTerritoryRequest {
  /** Código oficial DIVIPOLA de dos dígitos. */
  readonly departmentCode: string;
  /** Código oficial DIVIPOLA de cinco dígitos, hijo del departamento. */
  readonly municipalityCode: string;
  /**
   * Identificador de la unidad local del catálogo del tenant, o la constante
   * `OTHER_PENDING_NORMALIZATION`.
   */
  readonly localUnitId: string;
  /** Barrio o vereda declarado. Obligatorio con `OTHER_PENDING_NORMALIZATION`. */
  readonly localityDeclaredText?: string;
  /** Corregimiento declarado. Texto no canónico y opcional. */
  readonly settlementDeclaredText?: string;
  /**
   * Área urbana o rural. OBLIGATORIA y declarada por la persona: el servidor no
   * la infiere. Si además hay unidad local canónica, ambas deben concordar.
   */
  readonly areaType: AreaTypeCode;
  /** Dirección exacta. Dato personal sensible. */
  readonly exactAddress: string;
  /** Indicaciones para llegar. Opcional y minimizado. */
  readonly directions?: string;
}

/** Cuerpo aceptado por `POST /api/v1/patients/enrollments`. */
export interface PatientEnrollmentRequest {
  readonly documentType: DocumentTypeCode;
  readonly documentNumber: string;
  readonly givenNames: string;
  readonly familyNames: string;
  /** Fecha ISO `AAAA-MM-DD`. No puede ser futura. */
  readonly birthDate: string;
  readonly sexGenderCode: SexGenderCodeValue;
  readonly phone: string;
  /** Correo opcional. */
  readonly email?: string;
  /** Código del catálogo de EPS controlado por el servidor. */
  readonly epsCode: string;
  /**
   * Poblaciones declaradas. La pertenencia de 60 años o más NO se declara: la
   * deriva el servidor desde `birthDate`.
   */
  readonly declaredPopulations: readonly DeclarablePopulationCode[];
  readonly territory: EnrollmentTerritoryRequest;
  /** Aceptación de la versión de consentimiento vigente configurada. */
  readonly consentAccepted: boolean;
}

/** Pertenencia poblacional devuelta por la API. */
export interface PatientPopulationResponse {
  readonly populationType: PopulationCode;
  readonly source: PopulationSourceCode;
}

/**
 * Representación mínima del paciente.
 *
 * Excluye deliberadamente documento completo, dirección exacta, token, hash de
 * sesión y detalle interno del consentimiento (TASK-MVP-CORE-01 §6).
 */
export interface PatientSummaryResponse {
  readonly status: 'ACTIVE';
  readonly enrolledAt: string;
  readonly givenNames: string;
  readonly familyNames: string;
  /** Edad derivada de la fecha de nacimiento en la fecha de consulta. */
  readonly age: number;
  readonly populations: readonly PatientPopulationResponse[];
  readonly territory: {
    readonly departmentCode: string;
    readonly departmentName: string;
    readonly municipalityCode: string;
    readonly municipalityName: string;
    readonly localityName: string | null;
    readonly localityPendingNormalization: boolean;
    readonly areaType: AreaTypeCode;
  };
  readonly epsCode: string;
  readonly epsName: string;
}

/** Cuerpo de la respuesta `201`. */
export type PatientEnrollmentCreatedResponse = PatientSummaryResponse;

/** Cuerpo de error. Nunca contiene PII, trazas ni detalle de base de datos. */
export interface ApiErrorResponse {
  readonly code: EnrollmentErrorCode;
  readonly message: string;
  /** Campos con problema semántico. Solo nombres de campo, nunca valores. */
  readonly fields?: readonly string[];
}
