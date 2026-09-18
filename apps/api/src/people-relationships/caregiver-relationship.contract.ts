/**
 * Contrato de la relación Paciente–Cuidador
 * (IDENTITY-RELATIONSHIPS-CORE-01 §6, §8.2, AD-05).
 *
 * LO QUE REPRESENTA: una autorización OPERATIVA, declarada por un operador
 * institucional en un MVP controlado, con finalidad, vigencia y un alcance único
 * de SOLO LECTURA sobre visitas.
 *
 * LO QUE NO REPRESENTA, y debe seguir sin representar: representación legal,
 * tutela, parentesco, consentimiento informado de la persona paciente,
 * verificación de identidad de la persona cuidadora, acceso clínico o permiso
 * de exportación. Ninguna de esas capacidades está modelada y ninguna debe
 * deducirse de una relación activa.
 */

/** Único tipo de relación admitido (AD-05). */
export const CAREGIVER_RELATIONSHIP_TYPE = 'DECLARED_CARE_SUPPORT' as const;

/** Única finalidad admitida (AD-05). */
export const CAREGIVER_RELATIONSHIP_PURPOSE = 'HOME_CARE_COORDINATION' as const;

/**
 * Única procedencia de validación admitida (AD-05).
 *
 * Su nombre lo dice de forma deliberada: es una ASERCIÓN DE OPERADOR en un MVP
 * CONTROLADO. No es verificación de identidad, no es autorización legal y no
 * acredita representación de la persona paciente.
 */
export const CAREGIVER_VALIDATION_SOURCE = 'CONTROLLED_MVP_OPERATOR_ASSERTION' as const;

/**
 * Único alcance concedido (AD-05).
 *
 * Es de SOLO LECTURA sobre visitas. NO existe comodín, `VISITS_CONTRIBUTE` ni
 * `VISITS_EXECUTE` para una persona cuidadora, y esta Task no crea ningún
 * endpoint genérico que permita conceder otro alcance.
 */
export const CAREGIVER_SCOPE_VISITS_VIEW = 'VISITS_VIEW' as const;

/** Motivos CERRADOS de revocación. No admiten texto libre. */
export const CAREGIVER_REVOCATION_REASONS = [
  'AUTHORIZATION_WITHDRAWN',
  'RELATIONSHIP_ENDED',
  'CREATED_IN_ERROR',
] as const;

export type CaregiverRevocationReason = (typeof CAREGIVER_REVOCATION_REASONS)[number];

/** Estados de la relación. `REVOKED` y `EXPIRED` son TERMINALES. */
export const CAREGIVER_RELATIONSHIP_STATUSES = [
  'PENDING_VALIDATION',
  'ACTIVE',
  'REVOKED',
  'EXPIRED',
] as const;

export type CaregiverRelationshipStatus =
  (typeof CAREGIVER_RELATIONSHIP_STATUSES)[number];

/** Códigos de error del contrato de relaciones. */
export const CAREGIVER_ERROR_CODES = {
  /** Cuerpo o parámetro con forma no admitida. */
  invalidRequest: 'CAREGIVER_INVALID_REQUEST',
  /**
   * Recurso no encontrado. IDÉNTICO para inexistente, de otra institución o
   * fuera del alcance de quien pregunta: distinguirlos confirmaría la
   * existencia de un registro ajeno.
   */
  notFound: 'CAREGIVER_RELATIONSHIP_NOT_FOUND',
  /** La versión esperada no coincide con la almacenada. */
  versionConflict: 'CAREGIVER_VERSION_CONFLICT',
  /** La transición pedida no es válida desde el estado actual. */
  invalidTransition: 'CAREGIVER_INVALID_TRANSITION',
  /** Ya existe una relación ACTIVE solapada para la misma combinación. */
  overlappingRelationship: 'CAREGIVER_OVERLAPPING_RELATIONSHIP',
  /** Fallo interno controlado. Nunca describe la topología. */
  unavailable: 'CAREGIVER_SERVICE_UNAVAILABLE',
} as const;

/**
 * Forma admitida de la referencia de autorización.
 *
 * Es OPACA y allowlisted: mayúsculas, dígitos y separadores, de 1 a 100
 * caracteres. NUNCA texto libre. Un campo libre acabaría conteniendo el nombre
 * de una persona, un número de documento o una descripción clínica, y la
 * referencia solo debe identificar un soporte documental externo.
 *
 * El MISMO patrón vive como CHECK en la base: la validación de la aplicación es
 * la primera barrera, no la única.
 */
export const CAREGIVER_AUTHORIZATION_REFERENCE_PATTERN = /^[A-Z0-9][A-Z0-9._:-]{0,99}$/u;

/** Forma admitida de un identificador opaco. */
export const CAREGIVER_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

/** Ruta base de la superficie de gestión de relaciones. */
export const CAREGIVER_RELATIONSHIPS_PATH = 'api/v1/caregiver-relationships';
