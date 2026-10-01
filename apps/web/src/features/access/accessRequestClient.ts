/**
 * Cliente tipado de `POST /api/v1/access-requests` (SPEC 038, MP02-C2).
 *
 * FRONTERA ÚNICA entre la rama `accion=registro` de `/acceso` y la API. Reglas:
 * - llama SOLO a `POST /api/v1/access-requests`. No hay lectura, ni reintento
 *   automático, ni ruta alternativa, ni URL con parámetros;
 * - usa `resolvePublicApiBaseUrl()`: la URL interna entre contenedores no puede
 *   usarse en el navegador y no es un secreto;
 * - envía exclusivamente los diez campos del contrato cerrado. NO envía
 *   consentimiento legal, tenant, estado, origen, referencia, rol, decisión,
 *   aprovisionamiento ni texto libre, y el servidor rechaza cualquier clave no
 *   declarada;
 * - `password` SÍ viaja (OD-11), porque es la credencial FICTICIA con la que la
 *   persona entrará después. Este módulo la recibe y la serializa, y nada más:
 *   no la guarda, no la registra, no la concatena con otras claves y no la
 *   devuelve en ningún desenlace. El texto de los errores habla de CAMPOS, nunca
 *   de valores;
 * - NO envía cookie explícita ni token, y NO persiste nada en `localStorage`,
 *   `sessionStorage`, IndexedDB ni en la URL. Este endpoint no crea sesión: no
 *   hay nada que conservar;
 * - no hay FALLBACK de datos ficticios. Si la API no responde, la interfaz dice
 *   que no está disponible. Un registro simulado en memoria sería la vía por la
 *   que una demostración anunciaría una solicitud que el servidor nunca vio.
 *
 * NEUTRALIDAD: el desenlace distingue los cuatro fallos que la interfaz debe
 * tratar distinto (campos, origen, límite, indisponibilidad) y no expone código
 * técnico, mensaje del servidor, constraint, tenant ni dato personal. El
 * `message` del servidor no se copia: un cliente no debe seguir la prosa de otra
 * capa, y un mensaje futuro podría contener algo que hoy no contiene.
 */

import { resolvePublicApiBaseUrl } from '@/config/environment';

/* -------------------------------------------------------------------------- */
/* Contrato                                                                    */
/* -------------------------------------------------------------------------- */

/** Perfil que la persona declara querer. Solo elige el perfil: no crea ninguno. */
export type RequestedProfile = 'PATIENT' | 'CAREGIVER' | 'FIELD_PROFESSIONAL';

export type AccessRequestDocumentType =
  | 'CEDULA_CIUDADANIA'
  | 'CEDULA_EXTRANJERIA'
  | 'PASAPORTE'
  | 'PERMISO_PROTECCION_TEMPORAL'
  | 'OTRO';

export type AccessRequestSexGender = 'FEMENINO' | 'MASCULINO' | 'OTRO' | 'PREFIERE_NO_DECIRLO';

/**
 * Los nueve campos que el FORMULARIO posee.
 *
 * La credencial no está aquí a propósito, y no es un olvido: los perfiles de
 * demostración (`accessRequestDemoFixtures.ts`) se declaran con este tipo, y un
 * fixture con una `password` sería una credencial escrita en el repositorio —
 * aunque fuera ficticia— más un valor que la persona debería reescribir cada
 * vez que carga un perfil. El borrador no sabe nada de credenciales; la
 * credencial se añade en el momento exacto de salir.
 */
export interface AccessRequestSubmission {
  readonly requestedProfile: RequestedProfile;
  readonly documentType: AccessRequestDocumentType;
  readonly documentNumber: string;
  readonly givenNames: string;
  readonly familyNames: string;
  readonly birthDate: string;
  readonly sexGenderCode: AccessRequestSexGender;
  readonly phone?: string;
  readonly email?: string;
}

/**
 * El cuerpo que SÍ viaja: borrador + credencial ficticia + expediente. Once
 * claves cuando el flujo guiado aporta `registration`.
 *
 * `password` es obligatoria desde MP04 (OD-11). El servidor la conserva
 * únicamente durante la llamada que crea el usuario deshabilitado en el
 * proveedor local: no la persiste, no la devuelve, no la audita y no la
 * incorpora a ningún error. Aquí se valida ANTES de serializar para que un fallo
 * local no viaje, y para que la interfaz pueda señalar el campo sin mostrar el
 * valor.
 *
 * `registration` es el expediente ficticio de la rama, ya normalizado. Nunca
 * incluye la credencial: viaja como propiedad hermana, no anidada.
 */
export interface AccessRequestWithCredential extends AccessRequestSubmission {
  readonly password: string;
  readonly registration?: Record<string, unknown>;
}

/**
 * Los tres campos de la respuesta `202`, y nada más.
 *
 * `status` y `source` son LITERALES, no cadenas abiertas: este endpoint solo
 * emite `PENDING` y `TEST_DATA`. Tiparlos así convierte una diferencia de
 * contrato en un error de compilación aquí y no en una referencia que la
 * interfaz presenta como vigente.
 */
export interface AccessRequestAccepted {
  readonly reference: string;
  readonly status: 'PENDING';
  readonly source: 'TEST_DATA';
}

/**
 * Desenlace del envío.
 *
 * `accepted` SOLO existe tras un `202` bien formado. `invalid` lleva los NOMBRES
 * de campo con problema, nunca los valores recibidos. `forbidden`, `rateLimited`
 * y `unavailable` no llevan detalle: la interfaz ya tiene un texto propio para
 * cada uno y no necesita que la API se lo dicte.
 */
export type AccessRequestOutcome =
  | { readonly kind: 'accepted'; readonly accepted: AccessRequestAccepted }
  | { readonly kind: 'invalid'; readonly fields: readonly string[] }
  | { readonly kind: 'forbidden' }
  | { readonly kind: 'rateLimited' }
  | { readonly kind: 'unavailable' };

/* -------------------------------------------------------------------------- */
/* Catálogos de la interfaz                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Los tres perfiles que el formulario ofrece.
 *
 * El RÓTULO es la denominación visible aprobada por el Product Owner el
 * 2026-09-29 para este entorno de pruebas. El VALOR técnico no cambia: quien
 * elige «Visitador médico» sigue declarando `FIELD_PROFESSIONAL`, y es el
 * servidor el que decide qué significa esa solicitud.
 */
export const ACCESS_REQUEST_PROFILES: ReadonlyArray<{
  readonly code: RequestedProfile;
  readonly label: string;
}> = [
  { code: 'PATIENT', label: 'Paciente' },
  { code: 'CAREGIVER', label: 'Cuidador' },
  { code: 'FIELD_PROFESSIONAL', label: 'Visitador médico' },
];

export const ACCESS_REQUEST_DOCUMENT_TYPES: ReadonlyArray<{
  readonly code: AccessRequestDocumentType;
  readonly label: string;
}> = [
  { code: 'CEDULA_CIUDADANIA', label: 'Cédula de ciudadanía' },
  { code: 'CEDULA_EXTRANJERIA', label: 'Cédula de extranjería' },
  { code: 'PASAPORTE', label: 'Pasaporte' },
  { code: 'PERMISO_PROTECCION_TEMPORAL', label: 'Permiso por Protección Temporal' },
  { code: 'OTRO', label: 'Otro' },
];

export const ACCESS_REQUEST_SEX_GENDERS: ReadonlyArray<{
  readonly code: AccessRequestSexGender;
  readonly label: string;
}> = [
  { code: 'FEMENINO', label: 'Femenino' },
  { code: 'MASCULINO', label: 'Masculino' },
  { code: 'OTRO', label: 'Otro' },
  { code: 'PREFIERE_NO_DECIRLO', label: 'Prefiere no decirlo' },
];

/* -------------------------------------------------------------------------- */
/* OD-11: credencial ficticia                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Los mismos límites que `access-request.contract.ts` en la API.
 *
 * Se repiten aquí —no se importan— porque el navegador no debe acoplar su
 * contrato de validación a un módulo de servidor: estos dos números son la
 * parte del contrato que la INTERFAZ necesita para fallar antes de viajar, y
 * cambiarlos en un solo sitio sería aceptar que un cliente y un servidor puedan
 * discrepar en silencio sobre qué es una contraseña válida.
 */
export const ACCESS_REQUEST_PASSWORD_MIN_LENGTH = 8;
export const ACCESS_REQUEST_PASSWORD_MAX_LENGTH = 72;

/**
 * Motivo por el que la credencial no cumple el contrato.
 *
 * Son CATEGORÍAS, nunca valores: ni la lista ni el mensaje llegan a contener lo
 * que la persona escribió. La distinción existe para que el aviso pueda decir
 * «falta un número» sin necesidad de repetir la contraseña en la pantalla ni en
 * un `aria-describedby`.
 */
export type AccessRequestPasswordProblem =
  | 'tooShort'
  | 'tooLong'
  | 'missingLetter'
  | 'missingDigit'
  | 'controlCharacter';

const PASSWORD_LETTER_PATTERN = /\p{L}/u;
const PASSWORD_DIGIT_PATTERN = /\p{N}/u;

/**
 * Valida la credencial ficticia EXACTAMENTE como la API.
 *
 * Sin recortar y sin normalizar: la persona entra con lo que escribió, o no
 * entra, pero nunca con otra cosa. Devuelve el motivo o `null` si cumple. El
 * valor NUNCA se devuelve, se acumula en un estado aparte ni se refleja en el
 * desenlace.
 */
export function accessRequestPasswordProblem(
  value: string,
): AccessRequestPasswordProblem | null {
  if (value.length < ACCESS_REQUEST_PASSWORD_MIN_LENGTH) {
    return 'tooShort';
  }

  if (value.length > ACCESS_REQUEST_PASSWORD_MAX_LENGTH) {
    return 'tooLong';
  }

  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);

    if (code <= 0x1f || code === 0x7f) {
      return 'controlCharacter';
    }
  }

  if (!PASSWORD_LETTER_PATTERN.test(value)) {
    return 'missingLetter';
  }

  if (!PASSWORD_DIGIT_PATTERN.test(value)) {
    return 'missingDigit';
  }

  return null;
}

/* -------------------------------------------------------------------------- */
/* Llamada                                                                     */
/* -------------------------------------------------------------------------- */

const ACCESS_REQUESTS_PATH = '/api/v1/access-requests';

/** Forma de la referencia opaca emitida por el servidor. */
const REFERENCE_PATTERN = /^AR-[0-9A-F]{24}$/u;

/**
 * Estado y fuente que este endpoint emite y que el cliente admite.
 *
 * Se comparan por IDENTIDAD y no por forma. Aceptar «cualquier texto no vacío»
 * en estos dos campos haría que la interfaz anunciara un estado que este paquete
 * no puede emitir —o una procedencia que no es de prueba— como si lo hiciera.
 */
const ACCEPTED_STATUS = 'PENDING';
const ACCEPTED_SOURCE = 'TEST_DATA';

function isAccepted(value: unknown): value is AccessRequestAccepted {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidato = value as Record<string, unknown>;

  /*
   * Se exigen EXACTAMENTE tres claves. Una respuesta con un campo de más
   * indicaría que la capa intermedia añadió algo —un identificador interno, un
   * tenant— y presentarla como un registro de interés sin más comprobar sería
   * dejar que otra capa amplíe el contrato por la puerta de atrás.
   */
  if (Object.keys(candidato).length !== 3) {
    return false;
  }

  return (
    typeof candidato['reference'] === 'string' &&
    REFERENCE_PATTERN.test(candidato['reference']) &&
    candidato['status'] === ACCEPTED_STATUS &&
    candidato['source'] === ACCEPTED_SOURCE
  );
}

/**
 * Extrae los nombres de campo de un `400`.
 *
 * Solo acepta una lista real de cadenas. Cualquier otra forma —ausente, objeto,
 * número, lista con un valor que no sea texto— se degrada a lista vacía: la
 * interfaz puede entonces señalar el formulario completo, pero nunca pinta un
 * valor recibido como si fuera un nombre de campo.
 */
function fieldsFrom(value: unknown): readonly string[] {
  if (typeof value !== 'object' || value === null) {
    return [];
  }

  const crudo = (value as Record<string, unknown>)['fields'];

  if (!Array.isArray(crudo)) {
    return [];
  }

  return crudo.filter((item): item is string => typeof item === 'string');
}

/**
 * Envía la solicitud de acceso. Nunca lanza: devuelve siempre un desenlace
 * tipado para que la interfaz pueda mostrar un estado accesible, conservar el
 * formulario y permitir el reintento.
 */
export async function submitAccessRequest(
  submission: AccessRequestWithCredential,
  fetchImpl: typeof fetch = fetch,
): Promise<AccessRequestOutcome> {
  let response: Response;

  try {
    response = await fetchImpl(`${resolvePublicApiBaseUrl()}${ACCESS_REQUESTS_PATH}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(submission),
    });
  } catch {
    // Fallo de red: no hay nada que interpretar y nada que descartar.
    return { kind: 'unavailable' };
  }

  if (response.status === 400) {
    try {
      return { kind: 'invalid', fields: fieldsFrom(await response.json()) };
    } catch {
      return { kind: 'invalid', fields: [] };
    }
  }

  if (response.status === 403) {
    return { kind: 'forbidden' };
  }

  if (response.status === 429) {
    return { kind: 'rateLimited' };
  }

  if (response.status === 503) {
    return { kind: 'unavailable' };
  }

  if (response.status !== 202) {
    // Cualquier otro estado —incluido un 200 de un proxy mal configurado— no es
    // un registro de interés y no puede presentarse como tal.
    return { kind: 'unavailable' };
  }

  try {
    const cuerpo: unknown = await response.json();

    if (!isAccepted(cuerpo)) {
      return { kind: 'unavailable' };
    }

    return {
      kind: 'accepted',
      accepted: {
        reference: cuerpo.reference,
        status: cuerpo.status,
        source: cuerpo.source,
      },
    };
  } catch {
    return { kind: 'unavailable' };
  }
}
