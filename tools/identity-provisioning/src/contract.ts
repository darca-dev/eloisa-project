/**
 * Contrato del comando administrativo de aprovisionamiento de identidad
 * (IDENTITY-RELATIONSHIPS-CORE-01 §9, continuación §4).
 *
 * QUÉ ES: el ÚNICO camino por el que un `subject` verificado por el proveedor
 * OIDC queda asociado a una `Person` de MERDN. Es un comando administrativo que
 * vive FUERA de la API en ejecución.
 *
 * QUÉ NO ES, deliberadamente:
 * - NO existe endpoint público ni privado de vinculación. Añadirlo convertiría
 *   la identidad en algo que se puede pedir por HTTP;
 * - NO empareja por correo, documento, nombre ni ningún claim del proveedor. Un
 *   emparejamiento por correo permitiría suplantar a una persona sin más que
 *   cambiar ese correo en el proveedor;
 * - NO crea `Person`, `Patient`, `EnrollmentSession` ni ninguna participación:
 *   solo asocia una identidad externa a una persona que YA existe;
 * - NO habilita una cuenta deshabilitada: `DISABLE_ACCOUNT` es explícito y no
 *   tiene operación inversa en este comando.
 */

/** Variable con la cadena de conexión ADMINISTRATIVA. Nunca se registra. */
export const DATABASE_URL_ENV = 'DATABASE_URL';

/**
 * Allowlist de emisores admitidos, separados por coma.
 *
 * FALLA CERRADO: sin esta variable no se admite NINGÚN emisor y el comando
 * termina sin tocar la base. Un aprovisionamiento sin allowlist aceptaría
 * vincular personas contra un proveedor cualquiera.
 */
export const PROVISIONING_ISSUERS_ENV = 'MERDN_IDENTITY_PROVISIONING_ISSUERS';

/**
 * Rol de ejecución de mínimo privilegio. Debe coincidir EXACTAMENTE con el
 * declarado por la migración de endurecimiento y por `PrismaService`.
 */
export const RUNTIME_ROLE_NAME = 'merdn_runtime';

/** Acciones admitidas. Es un catálogo CERRADO: no hay ninguna otra. */
export const PROVISIONING_ACTIONS = ['LINK', 'UNLINK', 'DISABLE_ACCOUNT'] as const;

export type ProvisioningAction = (typeof PROVISIONING_ACTIONS)[number];

/** Campos EXACTOS de cada acción. Cualquier otro nombre invalida el archivo. */
export const ACTION_FIELDS: Readonly<Record<ProvisioningAction, readonly string[]>> = {
  LINK: ['action', 'tenantCode', 'personId', 'issuer', 'subject'],
  UNLINK: ['action', 'tenantCode', 'issuer', 'subject'],
  DISABLE_ACCOUNT: ['action', 'tenantCode', 'humanAccountId'],
};

/** Forma admitida de un identificador. No se acepta ninguna otra. */
export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

/** Forma admitida del código de tenant. Es configuración, no dato personal. */
export const TENANT_CODE_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/u;

/** Longitud máxima del `subject`, coherente con el CHECK de la migración. */
export const SUBJECT_MAX_LENGTH = 255;

/** Longitud máxima del `issuer`, coherente con el CHECK de la migración. */
export const ISSUER_MAX_LENGTH = 2048;

/**
 * Desenlaces posibles de una operación.
 *
 * Se distinguen `APPLIED` y `UNCHANGED` porque la idempotencia debe ser
 * VISIBLE: repetir un archivo ya aplicado no puede parecer una escritura nueva.
 */
export const OPERATION_OUTCOMES = [
  /** La operación escribió (o escribiría, en dry-run). */
  'APPLIED',
  /** Ya estaba en el estado pedido. No hay escritura. */
  'UNCHANGED',
  /** El vínculo pedido pertenece a otra `Person`. Cero cambios. */
  'CONFLICT',
  /** Tenant, persona, vínculo o cuenta inexistentes en este tenant. */
  'NOT_FOUND',
  /** El archivo o el entorno no cumplen el contrato. Cero cambios. */
  'REJECTED',
] as const;

export type OperationOutcome = (typeof OPERATION_OUTCOMES)[number];

/** Ruta lógica registrada en la auditoría. No lleva parámetros ni valores. */
export const AUDIT_ENDPOINT = 'cli identity:provision';

/** Tipos de recurso de los eventos escritos por este comando. */
export const AUDIT_RESOURCE = {
  binding: 'ExternalAuthIdentity',
  account: 'HumanAccount',
  session: 'HumanSession',
} as const;
