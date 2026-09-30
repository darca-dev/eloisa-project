/**
 * Contrato cerrado de `POST /api/v1/access-requests` (SPEC 038; MP02-C1, ampliado por MP04).
 *
 * ESTE MÓDULO ES LA FRONTERA NORMATIVA DEL PAQUETE. No importa Prisma, no lee
 * configuración y no ejecuta efectos: solo declara códigos, catálogos y tipos.
 * La validación que lo aplica es `access-request.validation.ts`; la escritura
 * que lo respeta es `access-request.service.ts`.
 *
 * ALCANCE DECLARADO: este paquete NO implementa decisión, revisión, cuenta,
 * sesión ni perfil. Un `AccessRequest` creado aquí siempre nace `PENDING` y
 * `NOT_STARTED`, con `source = TEST_DATA`. Los estados posteriores pertenecen a
 * paquetes ya aprobados (MP03–MP06) y este archivo NO los anticipa ni los simula.
 *
 * LO QUE ESTE CONTRATO ES: un formulario de datos personales mínimos para
 * registrar el INTERÉS de una persona en el entorno funcional. NO es una
 * inscripción en el sentido de TASK-MVP-CORE-01: no crea `Patient`, no exige
 * territorio, EPS ni consentimiento, y no otorga acceso a ningún servicio.
 *
 * MP04 AÑADE UNA DÉCIMA CLAVE al cuerpo: `password`. Es la credencial FICTICIA
 * que la persona usará después, contra el realm local. Su regla vive aquí porque
 * es parte del contrato de ENTRADA, y su secreteza no: la contraseña no se
 * persiste, no se devuelve, no se audita y no aparece en ningún error, y por eso
 * este archivo solo declara sus límites y jamás un valor.
 */

/** Códigos de error estables devueltos por este endpoint. */
export const ACCESS_REQUEST_ERROR_CODES = {
  /** Cuerpo ausente, mal formado, con claves desconocidas o con reglas incumplidas. */
  invalidBody: 'ACCESS_REQUEST_INVALID_BODY',
  /** Petición desde un origen web no configurado. No describe la lista admitida. */
  originRejected: 'ACCESS_REQUEST_ORIGIN_REJECTED',
  /** Demasiadas peticiones desde el mismo cliente en la ventana vigente. */
  rateLimited: 'ACCESS_REQUEST_RATE_LIMITED',
  /** Fallo interno o de contexto institucional. Nunca incluye detalle técnico. */
  unavailable: 'ACCESS_REQUEST_UNAVAILABLE',
} as const;

export type AccessRequestErrorCode =
  (typeof ACCESS_REQUEST_ERROR_CODES)[keyof typeof ACCESS_REQUEST_ERROR_CODES];

/**
 * Perfiles que la persona MAYOR pedir. Es exactamente el enum persistido
 * `AccessRequestProfile`: una solicitud que declara un perfil inexistente en el
 * esquema no debe poder escribirse.
 */
export const REQUESTED_PROFILE_CODES = [
  'PATIENT',
  'CAREGIVER',
  'FIELD_PROFESSIONAL',
] as const;

export type RequestedProfileCode = (typeof REQUESTED_PROFILE_CODES)[number];

/**
 * Estados que la migración considera ABIERTOS.
 *
 * La fuente de verdad es el predicado del índice parcial
 * `access_request_open_per_person_profile_unique`
 * (`prisma/migrations/20260928190000_access_request_foundation/migration.sql`):
 *
 *   WHERE "status" IN ('PENDING', 'APPROVED_PENDING_PROVISIONING', 'PROVISIONING_FAILED')
 *
 * La lista se mantiene sincronizada con ese predicado a propósito. Si divergiera,
 * una segunda escritura de este paquete fallaría por violación de unicidad en
 * lugar de devolver la referencia ya emitida, que es exactamente el defecto que
 * la idempotencia debe evitar.
 */
export const OPEN_ACCESS_REQUEST_STATUSES = [
  'PENDING',
  'APPROVED_PENDING_PROVISIONING',
  'PROVISIONING_FAILED',
] as const;

export type OpenAccessRequestStatus = (typeof OPEN_ACCESS_REQUEST_STATUSES)[number];

/** Prefijo de la referencia opaca. No contiene dato personal ni formato de negocio. */
export const ACCESS_REQUEST_REFERENCE_PREFIX = 'AR';

/** Longitud de la referencia opaca, prefijo incluido. */
export const ACCESS_REQUEST_REFERENCE_LENGTH = 27;

/** Forma exacta de la referencia emitida por este paquete. */
export const ACCESS_REQUEST_REFERENCE_PATTERN = /^AR-[0-9A-F]{24}$/u;

/** Longitud de las personas nombradas. Reutiliza el límite ya aprobado. */
export const ACCESS_REQUEST_NAME_MAX_LENGTH = 120;

/** Longitud máxima del teléfono declarado. */
export const ACCESS_REQUEST_PHONE_MAX_LENGTH = 32;

/** Longitud máxima del correo declarado (límite de la práctica común, no del RFC). */
export const ACCESS_REQUEST_EMAIL_MAX_LENGTH = 254;

/* -------------------------------------------------------------------------- */
/* Contraseña ficticia (OD-11, MP04)                                            */
/* -------------------------------------------------------------------------- */

/**
 * Longitud mínima de la contraseña.
 *
 * Ocho es el mínimo que un proveedor local acepta por defecto y el que una
 * persona puede recordar sin ayuda. No es una política de fortaleza: esta
 * contraseña protege una cuenta FICTICIA dentro de un realm local de
 * demostración, y pretender más significaría pedirle a quien llena el formulario que
 * resuelva una regla que ningún sistema real de la plataforma va a aplicar.
 */
export const ACCESS_REQUEST_PASSWORD_MIN_LENGTH = 8;

/** Longitud máxima. Coincide con el límite que admiten los proveedores comunes. */
export const ACCESS_REQUEST_PASSWORD_MAX_LENGTH = 72;

/**
 * Requisito de forma: al menos una letra y al menos un dígito.
 *
 * Es el único requisito que se comprueba aquí, y se comprueba sobre el valor
 * recibido sin derivar nada de él. No se exigen mayúsculas, símbolos, secuencias
 * no repetidas ni diccionarios: cada regla adicional aumentaría la superficie de
 * un formulario público sin aportar protección a un realm ficticio.
 */
export const ACCESS_REQUEST_PASSWORD_REQUIRED_CLASSES = ['letter', 'digit'] as const;

/** Resultado público y MÍNIMO de la creación idempotente. */
export interface AccessRequestResultDto {
  /** Referencia opaca emitida por el servidor. Es el único dato devuelto. */
  readonly reference: string;
  /** Estado vigente de la solicitud. */
  readonly status: string;
  /** Origen de la solicitud. Siempre `TEST_DATA` en este paquete. */
  readonly source: string;
}
