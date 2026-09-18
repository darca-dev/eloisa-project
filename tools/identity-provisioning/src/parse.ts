import {
  ACTION_FIELDS,
  ISSUER_MAX_LENGTH,
  PROVISIONING_ACTIONS,
  type ProvisioningAction,
  SUBJECT_MAX_LENGTH,
  TENANT_CODE_PATTERN,
  UUID_PATTERN,
} from './contract.ts';

/**
 * Análisis ESTRICTO del archivo de operaciones.
 *
 * Reglas, todas por construcción y no por filtrado posterior:
 *
 * - allowlist CERRADA de campos por acción. Cualquier nombre no declarado
 *   invalida el archivo completo; en particular `status`, `humanAccountId` en
 *   `LINK`, `personId` en `UNLINK` o cualquier campo de auditoría, que los fija
 *   el comando y no el archivo;
 * - `issuer` se coteja contra una allowlist EXACTA del entorno. No hay forma,
 *   sufijo ni comodín: un emisor no declarado no se aprovisiona;
 * - `subject` se acepta OPACO, tal como lo emite el proveedor, y solo se acota
 *   su longitud. Normalizarlo cambiaría el valor que OIDC verificó;
 * - un archivo con una sola operación inválida NO se aplica en parte: el
 *   análisis termina antes de abrir ninguna transacción.
 */

/** Error de forma del archivo. Nombra el campo, NUNCA su valor. */
export class ProvisioningFileError extends Error {
  public readonly pointer: string;

  constructor(pointer: string, reason: string) {
    super(`Operación inválida en ${pointer}: ${reason}.`);
    this.name = 'ProvisioningFileError';
    this.pointer = pointer;
  }
}

export interface LinkOperation {
  readonly action: 'LINK';
  readonly tenantCode: string;
  readonly personId: string;
  readonly issuer: string;
  readonly subject: string;
}

export interface UnlinkOperation {
  readonly action: 'UNLINK';
  readonly tenantCode: string;
  readonly issuer: string;
  readonly subject: string;
}

export interface DisableAccountOperation {
  readonly action: 'DISABLE_ACCOUNT';
  readonly tenantCode: string;
  readonly humanAccountId: string;
}

export type ProvisioningOperation =
  | LinkOperation
  | UnlinkOperation
  | DisableAccountOperation;

/**
 * Allowlist de emisores tomada del entorno.
 *
 * FALLA CERRADO: ausente o vacía devuelve una lista vacía y el llamador debe
 * rechazar el archivo entero. El emisor se compara sin barras finales, igual
 * que hace la configuración de la API, para que las dos hablen del mismo valor.
 */
export function parseIssuerAllowlist(raw: string | undefined): readonly string[] {
  if (raw === undefined) {
    return [];
  }

  return raw
    .split(',')
    .map((entry) => entry.trim().replace(/\/+$/u, ''))
    .filter((entry) => entry.length > 0);
}

/**
 * Analiza el contenido del archivo.
 *
 * Admite un objeto único o un arreglo de objetos. Un arreglo vacío se rechaza:
 * ejecutar un archivo sin operaciones sería una aplicación silenciosa de nada.
 */
export function parseOperationsFile(
  content: string,
  allowedIssuers: readonly string[],
): readonly ProvisioningOperation[] {
  let parsed: unknown;

  try {
    parsed = JSON.parse(content);
  } catch {
    // El motivo no repite el contenido: podría llevar un `subject` o un
    // identificador a la salida del comando.
    throw new ProvisioningFileError('archivo', 'no contiene JSON válido');
  }

  const entries = Array.isArray(parsed) ? parsed : [parsed];

  if (entries.length === 0) {
    throw new ProvisioningFileError('archivo', 'no declara ninguna operación');
  }

  return entries.map((entry, index) =>
    parseOperation(entry, `operación #${index + 1}`, allowedIssuers),
  );
}

function parseOperation(
  raw: unknown,
  pointer: string,
  allowedIssuers: readonly string[],
): ProvisioningOperation {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new ProvisioningFileError(pointer, 'debe ser un objeto JSON');
  }

  const body = raw as Readonly<Record<string, unknown>>;
  const action = body['action'];

  if (
    typeof action !== 'string' ||
    !(PROVISIONING_ACTIONS as readonly string[]).includes(action)
  ) {
    throw new ProvisioningFileError(
      pointer,
      `«action» debe ser uno de: ${PROVISIONING_ACTIONS.join(', ')}`,
    );
  }

  const allowed = ACTION_FIELDS[action as ProvisioningAction];

  for (const name of Object.keys(body)) {
    if (!allowed.includes(name)) {
      throw new ProvisioningFileError(
        pointer,
        `«${name}» no está admitido en la acción ${action}`,
      );
    }
  }

  const tenantCode = requireTenantCode(body, pointer);

  if (action === 'DISABLE_ACCOUNT') {
    return {
      action: 'DISABLE_ACCOUNT',
      tenantCode,
      humanAccountId: requireUuid(body, 'humanAccountId', pointer),
    };
  }

  const issuer = requireIssuer(body, pointer, allowedIssuers);
  const subject = requireSubject(body, pointer);

  if (action === 'UNLINK') {
    return { action: 'UNLINK', tenantCode, issuer, subject };
  }

  return {
    action: 'LINK',
    tenantCode,
    personId: requireUuid(body, 'personId', pointer),
    issuer,
    subject,
  };
}

function requireTenantCode(
  body: Readonly<Record<string, unknown>>,
  pointer: string,
): string {
  const value = body['tenantCode'];

  if (typeof value !== 'string' || !TENANT_CODE_PATTERN.test(value)) {
    throw new ProvisioningFileError(
      pointer,
      '«tenantCode» debe ser un código en minúsculas, dígitos o guion',
    );
  }

  return value;
}

function requireUuid(
  body: Readonly<Record<string, unknown>>,
  field: string,
  pointer: string,
): string {
  const value = body[field];

  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    throw new ProvisioningFileError(
      pointer,
      `«${field}» debe ser un identificador válido`,
    );
  }

  return value.toLowerCase();
}

function requireIssuer(
  body: Readonly<Record<string, unknown>>,
  pointer: string,
  allowedIssuers: readonly string[],
): string {
  const value = body['issuer'];

  if (typeof value !== 'string' || value.length === 0 || value.length > ISSUER_MAX_LENGTH) {
    throw new ProvisioningFileError(pointer, '«issuer» debe ser una cadena no vacía');
  }

  const normalized = value.replace(/\/+$/u, '');

  if (!allowedIssuers.includes(normalized)) {
    /*
     * El mensaje NO repite el emisor recibido ni enumera la allowlist: la
     * primera lo llevaría a la salida del comando y la segunda describiría la
     * topología del despliegue a quien solo debía aportar un archivo.
     */
    throw new ProvisioningFileError(
      pointer,
      '«issuer» no pertenece a la allowlist de emisores de aprovisionamiento',
    );
  }

  return normalized;
}

function requireSubject(
  body: Readonly<Record<string, unknown>>,
  pointer: string,
): string {
  const value = body['subject'];

  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > SUBJECT_MAX_LENGTH
  ) {
    throw new ProvisioningFileError(
      pointer,
      `«subject» debe ser una cadena de 1 a ${SUBJECT_MAX_LENGTH} caracteres`,
    );
  }

  // Se conserva OPACO y sin normalizar: es el valor que el proveedor verifica.
  return value;
}
