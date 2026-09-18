/**
 * Contrato de la identidad y la sesión institucional mínimas
 * (TASK-MUNICIPALITY-CORE-01, FR-13, FR-14 y OD-01).
 *
 * ALCANCE DECLARADO: esto NO es el sistema completo de usuarios, roles y
 * permisos de MERDN. Es una identidad de INSTITUCIÓN con un único rol de
 * consulta agregada, sin registro público, sin recuperación de cuenta, sin
 * directorio de personas y sin ningún dato personal.
 *
 * Los códigos de error son estables y deliberadamente pobres en información:
 * una denegación no revela si la sesión faltaba, expiró, fue revocada o
 * pertenece a otra institución.
 */

/**
 * Roles institucionales implementados. Coincide con el enum de la base.
 *
 * TASK-HOSPITAL-CORE-01 anade `HOSPITAL_PATIENT_VIEWER` y TASK-HOSPITAL-CORE-02
 * anade `HOSPITAL_SCHEDULER`, ambos de forma ADITIVA.
 *
 * Los TRES roles son DISJUNTOS: ninguna superficie acepta otro rol que el suyo,
 * `HOSPITAL_PATIENT_VIEWER` conserva su caracter de SOLO LECTURA sobre Hospital
 * Pacientes y no gana ninguna escritura, `HOSPITAL_SCHEDULER` no alcanza
 * Hospital Pacientes ni los agregados municipales, y ninguno de los tres
 * identifica a una persona trabajadora concreta.
 */
export const INSTITUTIONAL_ROLES = [
  'MUNICIPAL_VIEWER',
  'HOSPITAL_PATIENT_VIEWER',
  'HOSPITAL_SCHEDULER',
  'CAREGIVER_RELATIONSHIP_MANAGER',
] as const;

export type InstitutionalRoleCode = (typeof INSTITUTIONAL_ROLES)[number];

/** Códigos de error del contrato institucional. */
export const INSTITUTIONAL_ERROR_CODES = {
  /** Cuerpo ausente o mal formado en el establecimiento de sesión. */
  invalidRequestBody: 'INSTITUTIONAL_INVALID_REQUEST_BODY',
  /** Credencial no válida. Idéntico para cualquier causa. */
  invalidCredentials: 'INSTITUTIONAL_INVALID_CREDENTIALS',
  /** No hay sesión institucional vigente. */
  sessionRequired: 'INSTITUTIONAL_SESSION_REQUIRED',
  /** La identidad autenticada carece del rol requerido. */
  forbidden: 'INSTITUTIONAL_ROLE_REQUIRED',
  /** Demasiados intentos desde el mismo origen. */
  rateLimited: 'INSTITUTIONAL_RATE_LIMITED',
  /** Fallo interno controlado. Nunca describe la topología. */
  internal: 'INSTITUTIONAL_SERVICE_UNAVAILABLE',
} as const;

/**
 * Nombre de la cookie institucional.
 *
 * Es DISTINTO del de la cookie de autoinscripción de paciente a propósito: una
 * sesión de paciente jamás autentica a Alcaldía y una sesión institucional
 * jamás da acceso a un paciente concreto.
 */
export const INSTITUTIONAL_SESSION_COOKIE_NAME = 'merdn_institutional_session';

/** Vigencia por defecto de la sesión institucional: 8 horas. */
export const INSTITUTIONAL_SESSION_DEFAULT_TTL_SECONDS = 8 * 60 * 60;

/** Vigencia máxima admitida. Una sesión institucional no es identidad permanente. */
export const INSTITUTIONAL_SESSION_MAX_TTL_SECONDS = 24 * 60 * 60;

/** Código por defecto de la identidad institucional de consulta municipal. */
export const MUNICIPAL_VIEWER_IDENTITY_CODE = 'municipal-viewer';

/** Código por defecto de la identidad institucional de consulta hospitalaria. */
export const HOSPITAL_PATIENT_VIEWER_IDENTITY_CODE = 'hospital-patient-viewer';

/*
 * IDENTITY-RELATIONSHIPS-CORE-01 (AD-03) añade
 * `CAREGIVER_RELATIONSHIP_MANAGER`, también DISJUNTO de los tres anteriores.
 *
 * Reutiliza `InstitutionalIdentity`, `InstitutionalSession`, el
 * aprovisionamiento por configuración y el patrón de guards ya existentes: NO
 * crea un segundo sistema de sesión y NO es una identidad HUMANA. Su auditoría
 * es institucional y OPACA: no identifica a ninguna persona trabajadora.
 *
 * No obtiene poderes de Scheduler, no accede a Hospital Pacientes y no accede a
 * los agregados municipales. Y a la inversa: ninguno de los otros tres puede
 * crear, activar ni revocar una relación de cuidado.
 *
 * Igual que la agenda, NO tiene código por defecto.
 */

/*
 * La identidad de agenda hospitalaria (`HOSPITAL_SCHEDULER`) NO tiene código
 * por defecto y no debe tenerlo: su código se aprovisiona exclusivamente por
 * `MERDN_HOSPITAL_SCHEDULER_CODE`. Sin código configurado y válido —y sin
 * credencial configurada y válida— esa identidad NO se aprovisiona. No existe
 * literal, derivación del rol ni reutilización de otro código que la habilite.
 */

/**
 * Forma admitida de un código de identidad institucional.
 *
 * El código NO es un secreto y NO transporta rol ni tenant: solo selecciona
 * cuál credencial se verifica dentro del tenant que el servidor ya resolvió.
 * Se acota su forma para que un valor arbitrario del cliente no llegue nunca a
 * una consulta ni a un registro.
 */
export const INSTITUTIONAL_IDENTITY_CODE_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/u;

/** Longitud mínima exigida a la credencial aprovisionada por configuración. */
export const INSTITUTIONAL_SECRET_MIN_LENGTH = 16;

/** Longitud máxima aceptada en el cuerpo de establecimiento de sesión. */
export const INSTITUTIONAL_SECRET_MAX_LENGTH = 512;

/* -------------------------------------------------------------------------- */
/* Variables de entorno del aprovisionamiento                                  */
/* -------------------------------------------------------------------------- */

/**
 * Variables leídas por este módulo.
 *
 * Se declaran aquí, y no en `config/environment.ts`, porque son propias del
 * aprovisionamiento institucional y ese archivo no forma parte de los archivos
 * autorizados de esta Task. Ninguna se registra ni se devuelve jamás.
 *
 * Si `MERDN_MUNICIPAL_VIEWER_SECRET` no está definida —o es demasiado corta—,
 * la identidad NO se aprovisiona y todos los endpoints municipales responden
 * como no autenticados. Es el comportamiento FAIL-CLOSED deseado: nunca se
 * inventa una credencial por defecto.
 */
export const INSTITUTIONAL_ENV = {
  municipalViewerSecret: 'MERDN_MUNICIPAL_VIEWER_SECRET',
  municipalViewerCode: 'MERDN_MUNICIPAL_VIEWER_CODE',
  hospitalPatientViewerSecret: 'MERDN_HOSPITAL_PATIENT_VIEWER_SECRET',
  hospitalPatientViewerCode: 'MERDN_HOSPITAL_PATIENT_VIEWER_CODE',
  hospitalSchedulerSecret: 'MERDN_HOSPITAL_SCHEDULER_SECRET',
  hospitalSchedulerCode: 'MERDN_HOSPITAL_SCHEDULER_CODE',
  caregiverRelationshipManagerSecret: 'MERDN_CAREGIVER_RELATIONSHIP_MANAGER_SECRET',
  caregiverRelationshipManagerCode: 'MERDN_CAREGIVER_RELATIONSHIP_MANAGER_CODE',
  sessionTtlSeconds: 'MERDN_INSTITUTIONAL_SESSION_TTL_SECONDS',
} as const;

/**
 * Texto del actor devuelto por el contexto de sesión.
 *
 * Es DELIBERADAMENTE impersonal. La identidad institucional mínima es una
 * credencial COMPARTIDA por la institución: no representa a ninguna persona
 * trabajadora y no debe presentarse como si lo hiciera. Convertirla en un
 * nombre propio —ficticio o no— seria afirmar una atribucion que el sistema no
 * puede sostener.
 */
export const INSTITUTIONAL_ACTOR_DISPLAY = 'Acceso institucional';
