/**
 * Validación del cuerpo de `POST /api/v1/access-requests` (SPEC 038, MP02-C1).
 *
 * COMO EN EL RESTO DE LA API: funciones puras, sin decoradores, sin acceso a
 * configuración y sin efectos. La allowlist es ESTRICTA: cualquier clave que no
 * esté declarada abajo se rechaza nombrando la clave y NUNCA su valor. Así, un
 * mensaje de error no puede acabar filtrando un dato personal, y un cliente que
 * intente auto-declarar tenant, estado, fuente o rol se rechaza en el borde en
 * lugar de ser ignorado en silencio.
 *
 * DIFERENCIA CON `enrollment.validation.ts` QUE ES DELIBERADA: aquí no se
 * distingue `400` de `422`. El handoff vigente (v51) fija un único código
 * `ACCESS_REQUEST_INVALID_BODY` para toda desviación del cuerpo cerrado, y esta
 * API no expone dos códigos distintos para el mismo formulario. Se devuelve la
 * lista de campos con problema para que la interfaz pueda señalar el formulario,
 * pero nunca el valor recibido.
 *
 * LO QUE ESTE MÓDULO NO HACE —por diseño—: no comprueba unicidad, no consulta el
 * tenant, no invoca servicios externos y no inventa reglas de negocio. La
 * unicidad es una carrera de escritura y se resuelve en la transacción
 * (`access-request.service.ts`), no antes.
 */

import {
  DOCUMENT_TYPE_CODES,
  SEX_GENDER_CODES,
  type DocumentTypeCode,
  type SexGenderCodeValue,
} from '../patients/enrollment.contract';
import { normalizeDocumentNumber } from '../patients/document-normalization';
import { parseIsoCalendarDate, toUtcMidnight } from '../patients/population-derivation';

import {
  ACCESS_REQUEST_EMAIL_MAX_LENGTH,
  ACCESS_REQUEST_NAME_MAX_LENGTH,
  ACCESS_REQUEST_PASSWORD_MAX_LENGTH,
  ACCESS_REQUEST_PASSWORD_MIN_LENGTH,
  ACCESS_REQUEST_PASSWORD_REQUIRED_CLASSES,
  ACCESS_REQUEST_PHONE_MAX_LENGTH,
  REQUESTED_PROFILE_CODES,
  type RequestedProfileCode,
} from './access-request.contract';

/**
 * Propiedades admitidas en la raíz del cuerpo. Es una lista CERRADA y su
 * contenido es la decisión del handoff v58, no una enumeración derivada del
 * modelo: si mañana el modelo acepta más campos, esta API sigue aceptando
 * exactamente los diez de abajo.
 *
 * Explícitamente AUSENTES, y rechazadas como clave desconocida: `tenantId`,
 * `status`, `source`, `reference`, `version`, `reviewedBy`, `decisionReasonCode`,
 * `provisioningStatus`, `provisioningReference`, `token`, `cookie`, `sub`,
 * `roles`, `permissions` y cualquier texto libre no declarado.
 *
 * `password` SÍ está admitida desde MP04: es la décima clave de OD-11. Su valor
 * no se conserva en `ValidatedAccessRequest` más allá de la llamada, no se
 * comparte con el servicio de registro como parte de un objeto auditable y no
 * aparece en ningún mensaje de error.
 */
const ALLOWED_ROOT_KEYS = [
  'requestedProfile',
  'documentType',
  'documentNumber',
  'givenNames',
  'familyNames',
  'birthDate',
  'sexGenderCode',
  'phone',
  'email',
  'password',
] as const;

/** Cuerpo validado y normalizado, listo para la transacción. */
export interface ValidatedAccessRequest {
  readonly requestedProfile: RequestedProfileCode;
  readonly documentType: DocumentTypeCode;
  /** Documento tal como lo declara la persona. Se conserva para trazabilidad. */
  readonly documentNumberDeclared: string;
  /** Documento ya normalizado. Es el valor con el que se busca la `Person`. */
  readonly documentNumberNormalized: string;
  readonly givenNames: string;
  readonly familyNames: string;
  readonly birthDate: Date;
  readonly sexGenderCode: SexGenderCodeValue;
  readonly phone: string | null;
  readonly email: string | null;
  /**
   * Contraseña ficticia, tal y como la escribió la persona.
   *
   * NO se recorta, NO se colapsa y NO se normaliza: cualquier transformación
   * cambiaría el secreto que después se enviará al proveedor y dejaría a la
   * persona sin poder iniciar sesión con lo que escribió. Únicamente se comprueban
   * longitud, clases de caracteres y ausencia de espacios de control.
   *
   * Vive en este objeto el TIEMPO EXACTO de una llamada: el servicio lo consume
   * al preparar la identidad y lo descarta. No se copia a un evento de
   * auditoría, a una excepción, a un log ni a la respuesta.
   */
  readonly password: string;
}

export interface AccessRequestValidationSuccess {
  readonly ok: true;
  readonly value: ValidatedAccessRequest;
}

export interface AccessRequestValidationFailure {
  readonly ok: false;
  /** Nombres de campo con problema. Nunca contiene valores recibidos. */
  readonly fields: readonly string[];
}

export type AccessRequestValidationResult =
  | AccessRequestValidationSuccess
  | AccessRequestValidationFailure;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u;
// Se admiten dígitos y separadores de presentación; no se asume un plan de
// numeración concreto, igual que en la inscripción ya aprobada.
const PHONE_PATTERN = /^[\d+.\s()-]+$/u;
/**
 * ¿Contiene el texto algún carácter de control?
 *
 * Se recorre por puntos de código en lugar de usar una expresión regular porque
 * el conjunto que se busca ES un conjunto de caracteres de control, y la regla de
 * lint que prohíbe escribirlos en una expresión regular existiría para evitar
 * colarlos por descuido en un patrón. Aquí se buscan a propósito: un `\n` o un
 * `\0` en un nombre o un documento rompería la Storage de PostgreSQL o inyectaría
 * líneas en la traza, y ambos son defectos reales que esta capa debe cerrar.
 */
function hasControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);

    if (code <= 0x1f || code === 0x7f) {
      return true;
    }
  }

  return false;
}
const NAMES_PATTERN = /^[\p{L}\p{M}\p{Zs}.'-]+$/u;

/**
 * Valida la contraseña ficticia de OD-11.
 *
 * SEPARADA DEL RESTO y sin recortar, porque aquí NO se aplica `readTrimmedText`:
 * ese helper colapsa espacios interiores y recorta los extremos, y hacerlo con
 * un secreto cambiaría el valor que después se enviará al proveedor. Una persona
 * que escriba `clave con  espacios` debe poder iniciar sesión con exactamente lo
 * que escribió, o no debe poder registrarse, pero nunca con otra cosa.
 *
 * Tres reglas, ninguna derivada del valor:
 * - longitud entre 8 y 72 inclusive;
 * - al menos una letra y al menos un número, comprobados con propiedades
 *   Unicode y no con rangos ASCII: `ñ`, `é` o un dígito sobrante no deben
 *   decidir la validación de forma distinta según la codificación;
 * - ningún carácter de control (0x00–0x1F, 0x7F).
 *
 * NO se exigen mayúsculas, símbolos, entropía ni diccionario. Devuelve el valor
 * tal cual si cumple y `null` si no; el FALLA solo añade el nombre del campo, y
 * jamás el valor recibido, a la lista de campos con problema.
 */
function validarPassword(bruto: unknown): string | null {
  if (typeof bruto !== 'string') {
    return null;
  }

  if (bruto.length < ACCESS_REQUEST_PASSWORD_MIN_LENGTH) {
    return null;
  }

  if (bruto.length > ACCESS_REQUEST_PASSWORD_MAX_LENGTH) {
    return null;
  }

  for (let index = 0; index < bruto.length; index += 1) {
    const code = bruto.charCodeAt(index);

    if (code <= 0x1f || code === 0x7f) {
      return null;
    }
  }

  const clases = {
    letter: /\p{L}/u,
    digit: /\p{N}/u,
  } as const;

  for (const clase of ACCESS_REQUEST_PASSWORD_REQUIRED_CLASSES) {
    if (!clases[clase].test(bruto)) {
      return null;
    }
  }

  return bruto;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function unknownKeys(source: Record<string, unknown>): string[] {
  return Object.keys(source).filter(
    (key) => !(ALLOWED_ROOT_KEYS as readonly string[]).includes(key),
  );
}

/**
 * Lee un texto de forma estricta: exige que sea un `string` real, sin caracteres
 * de control, colapsando espacios interiores y dentro del límite declarado.
 */
function readTrimmedText(
  source: Record<string, unknown>,
  key: string,
  maxLength: number,
): string | null {
  const raw = source[key];

  if (typeof raw !== 'string') {
    return null;
  }

  if (hasControlCharacter(raw)) {
    return null;
  }

  const collapsed = raw.trim().replace(/\s+/gu, ' ');

  if (collapsed.length === 0 || collapsed.length > maxLength) {
    return null;
  }

  return collapsed;
}

function isOneOf<T extends string>(value: string, allowed: readonly T[]): value is T {
  return (allowed as readonly string[]).includes(value);
}

/**
 * Valida y normaliza el cuerpo completo.
 *
 * @param body Cuerpo ya deserializado. Nunca debe ser un objeto con prototype
 *             ajeno; el filtro de JSON mal formado actúa antes que el controlador.
 * @param now  Instante del servidor. Define qué fecha de nacimiento es futura.
 */
export function validateAccessRequestBody(
  body: unknown,
  now: Date,
): AccessRequestValidationResult {
  if (!isPlainObject(body)) {
    return { ok: false, fields: ['body'] };
  }

  const fields = new Set<string>(unknownKeys(body));

  // --- `requestedProfile`: obligatorio y del catálogo cerrado -------------
  const requestedProfileRaw = readTrimmedText(body, 'requestedProfile', 64);
  if (
    requestedProfileRaw === null ||
    !isOneOf(requestedProfileRaw, REQUESTED_PROFILE_CODES)
  ) {
    fields.add('requestedProfile');
  }

  // --- `documentType`: obligatorio y del catálogo de inscripción ---------
  const documentTypeRaw = readTrimmedText(body, 'documentType', 64);
  if (documentTypeRaw === null || !isOneOf(documentTypeRaw, DOCUMENT_TYPE_CODES)) {
    fields.add('documentType');
  }

  // --- `documentNumber`: obligatorio, con el MISMO criterio de la inscripción
  const documentNumberRaw = readTrimmedText(body, 'documentNumber', 64);
  if (documentNumberRaw === null) {
    fields.add('documentNumber');
  }

  // --- Nombres: ambos obligatorios ---------------------------------------
  const givenNames = readTrimmedText(body, 'givenNames', ACCESS_REQUEST_NAME_MAX_LENGTH);
  if (givenNames === null || !NAMES_PATTERN.test(givenNames)) {
    fields.add('givenNames');
  }

  const familyNames = readTrimmedText(body, 'familyNames', ACCESS_REQUEST_NAME_MAX_LENGTH);
  if (familyNames === null || !NAMES_PATTERN.test(familyNames)) {
    fields.add('familyNames');
  }

  // --- `birthDate`: obligatoria, ISO calendario, nunca futura ------------
  const birthDateRaw = readTrimmedText(body, 'birthDate', 10);
  let birthDate: Date | null = null;
  if (birthDateRaw === null) {
    fields.add('birthDate');
  } else {
    const parsed = parseIsoCalendarDate(birthDateRaw);
    if (parsed === null) {
      fields.add('birthDate');
    } else {
      const midnight = toUtcMidnight(parsed);
      if (midnight.getTime() > now.getTime()) {
        fields.add('birthDate');
      } else {
        birthDate = midnight;
      }
    }
  }

  // --- `sexGenderCode`: obligatorio y del catálogo -----------------------
  const sexGenderCodeRaw = readTrimmedText(body, 'sexGenderCode', 64);
  if (sexGenderCodeRaw === null || !isOneOf(sexGenderCodeRaw, SEX_GENDER_CODES)) {
    fields.add('sexGenderCode');
  }

  // --- Contacto: ambos opcionales, pero AL MENOS UNO obligatorio ---------
  //
  // No se elige un contacto preferente ni se infiere ninguno: si la persona no
  // declara ninguno, la solicitud se rechaza en lugar de guardarse inútil.
  const phone = readTrimmedText(body, 'phone', ACCESS_REQUEST_PHONE_MAX_LENGTH);
  const email = readTrimmedText(body, 'email', ACCESS_REQUEST_EMAIL_MAX_LENGTH);

  if (body['phone'] !== undefined && body['phone'] !== null) {
    if (phone === null || !PHONE_PATTERN.test(phone)) {
      fields.add('phone');
    }
  }

  if (body['email'] !== undefined && body['email'] !== null) {
    if (email === null || !EMAIL_PATTERN.test(email)) {
      fields.add('email');
    }
  }

  if (phone === null && email === null) {
    fields.add('phone');
    fields.add('email');
  }

  // --- `password`: obligatoria, regla cerrada de OD-11 --------------------
  //
  // Se valida AQUÍ y no más tarde porque es parte del contrato de entrada: una
  // contraseña inutilizable no debe llegar ni siquiera a la transacción. El
  // valor validado se conserva SOLO en el resultado de esta función y nunca se
  // añade a `fields`, a un mensaje ni a un objeto que pueda registrarse.
  const password = validarPassword(body['password']);
  if (password === null) {
    fields.add('password');
  }

  // --- Normalización documental -----------------------------------------
  //
  // Se hace AQUÍ y no en el servicio para que la clave de búsqueda de la
  // `Person` sea la misma en el camino de creación y en el de relectura de
  // idempotencia. Un documento mal formado se rechaza con el nombre del campo
  // y nunca se envía a la base de datos.
  let documentNumberNormalized: string | null = null;
  if (
    documentTypeRaw !== null &&
    isOneOf(documentTypeRaw, DOCUMENT_TYPE_CODES) &&
    documentNumberRaw !== null
  ) {
    const normalized = normalizeDocumentNumber(documentTypeRaw, documentNumberRaw);
    if (!normalized.ok) {
      fields.add('documentNumber');
    } else {
      documentNumberNormalized = normalized.normalized;
    }
  }

  if (fields.size > 0) {
    return { ok: false, fields: [...fields].sort() };
  }

  return {
    ok: true,
    value: {
      requestedProfile: requestedProfileRaw as RequestedProfileCode,
      documentType: documentTypeRaw as DocumentTypeCode,
      documentNumberDeclared: documentNumberRaw as string,
      documentNumberNormalized: documentNumberNormalized as string,
      givenNames: givenNames as string,
      familyNames: familyNames as string,
      birthDate: birthDate as Date,
      sexGenderCode: sexGenderCodeRaw as SexGenderCodeValue,
      phone,
      email,
      password: password as string,
    },
  };
}
