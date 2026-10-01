import { resolvePublicApiBaseUrl } from '@/config/environment';

/**
 * Cliente COMPARTIDO de la sesión INSTITUCIONAL (spec 022, «Decisión técnica
 * cerrada: reutilización del cliente institucional», sobre
 * TASK-HOSPITAL-CORE-01 §8.0 y §10.10).
 *
 * Es el MISMO cliente que Hospital ya usaba, movido a un módulo compartido para
 * que la experiencia de Alcaldía lo REUTILICE en vez de duplicar transporte,
 * validación y mensajes de seguridad. En Hospital queda una FACHADA compatible
 * que delega aquí, de modo que ningún componente de Hospital cambia una sola
 * importación. La extracción NO cambia endpoints, cookie, backend ni
 * arquitectura de autenticación: cambia de sitio, y nada más.
 *
 * QUÉ HACE, exactamente:
 *
 * - consulta el ÚNICO endpoint que describe la sesión vigente. Lo que devuelve
 *   es deliberadamente pobre: rol efectivo, caducidad, nombre real de la
 *   institución y un texto de actor IMPERSONAL;
 * - abre una sesión con un código de identidad y su credencial;
 * - cierra la sesión vigente, y decide —con funciones PURAS— cuándo una
 *   revocación quedó CONFIRMADA.
 *
 * Lo que NO devuelve, y por tanto ninguna interfaz puede mostrar: identificador
 * de tenant, identificador de identidad, código interno, secreto, nombre de una
 * persona trabajadora, tipo o municipio de la institución, logo y permisos
 * derivados. La credencial institucional es COMPARTIDA: convertirla en un
 * nombre propio —aunque fuera ficticio— afirmaría una atribución que el sistema
 * no puede sostener.
 *
 * QUÉ NO HACE, y no puede hacer:
 *
 * - NO lee, escribe ni copia la credencial de sesión. Viaja en una cookie
 *   `HttpOnly` que el navegador administra y que este código no puede ver, y
 *   por eso toda petición pide `credentials: 'include'`;
 * - NO guarda nada en el navegador y pide `cache: 'no-store'`;
 * - NO fabrica un segundo mecanismo de acceso, ni repliegue a fixtures: si el
 *   servicio no está disponible, esto falla CERRADO;
 * - NO toca la sesión HUMANA. Son entidades disjuntas: ni una autentica a la
 *   otra, ni cerrar una cierra la otra;
 * - NUNCA lanza: devuelve un desenlace tipado para que la interfaz muestre un
 *   estado accesible y permita reintentar.
 *
 * TENER CONTEXTO NO ES TENER PERMISO. Este endpoint NO concede acceso a ninguna
 * superficie: obtener contexto y tener permiso son cosas distintas, y cada
 * dominio conserva su propio guard, en el servidor. Que Hospital y Alcaldía
 * compartan este transporte no mezcla sus autorizaciones: los roles son
 * DISJUNTOS y cada superficie exige el suyo.
 *
 * `fetchImpl` se recibe por parámetro, con `fetch` como valor por defecto: es
 * lo que permite probar rutas, método, cancelación y cada código de estado sin
 * jsdom y sin red.
 */

/**
 * Roles institucionales que la interfaz sabe rotular.
 *
 * Son los tres que el contrato del servidor declara y que alguna superficie
 * Hospital o Municipality atiende hoy. Un rol implementado en el servidor pero
 * no rotulado aquí NO es un error: cae en la etiqueta neutra, que es preferible
 * a inventarle un nombre.
 *
 * Rotular un rol no concede nada: la autorización vive en el guard de cada
 * superficie y los roles son DISJUNTOS entre sí.
 */
export type RolInstitucional =
  | 'MUNICIPAL_VIEWER'
  | 'HOSPITAL_PATIENT_VIEWER'
  | 'HOSPITAL_SCHEDULER'
  | 'HOSPITAL_ACCESS_REVIEWER';

export interface SesionInstitucionalDto {
  readonly role: RolInstitucional;
  readonly expiresAt: string;
  readonly institution: { readonly name: string };
  readonly actorDisplay: string;
}

/** Desenlace de la consulta de contexto. */
export type ResultadoSesion =
  | { readonly kind: 'ok'; readonly datos: SesionInstitucionalDto }
  | { readonly kind: 'sin-sesion' }
  | { readonly kind: 'cancelado' }
  | { readonly kind: 'error' };

export const RUTA_SESION_INSTITUCIONAL = '/api/v1/institutional/sessions/current';

/** Etiqueta visible de cada rol. No promete capacidades que no existan. */
export const ETIQUETA_ROL_INSTITUCIONAL: Record<RolInstitucional, string> = {
  HOSPITAL_PATIENT_VIEWER: 'Consulta de pacientes',
  HOSPITAL_SCHEDULER: 'Agenda hospitalaria',
  HOSPITAL_ACCESS_REVIEWER: 'Revisión de solicitudes de acceso',
  MUNICIPAL_VIEWER: 'Consulta municipal agregada',
};

/**
 * Etiqueta del rol, o un texto neutro si el servidor devolviera uno futuro.
 *
 * No se inventa un nombre: un rol que la interfaz no conoce se rotula como
 * institucional y nada más.
 */
export function etiquetaDeRol(role: string): string {
  return (
    ETIQUETA_ROL_INSTITUCIONAL[role as RolInstitucional] ?? 'Acceso institucional'
  );
}

/**
 * Consulta el contexto de la sesión vigente.
 *
 * No lanza nunca: devuelve un desenlace tipado. `sin-sesion` cubre por igual la
 * ausencia, la expiración, la revocación y la manipulación, porque el servidor
 * responde lo mismo en los cuatro casos y la interfaz no debe deducir más.
 */
export async function consultarSesionInstitucional(
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<ResultadoSesion> {
  let response: Response;

  try {
    response = await fetchImpl(`${resolvePublicApiBaseUrl()}${RUTA_SESION_INSTITUCIONAL}`, {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      ...(signal === undefined ? {} : { signal }),
    });
  } catch (error) {
    if (signal?.aborted === true || (error instanceof Error && error.name === 'AbortError')) {
      return { kind: 'cancelado' };
    }

    return { kind: 'error' };
  }

  if (signal?.aborted === true) {
    return { kind: 'cancelado' };
  }

  // `403` no puede ocurrir aquí: el endpoint admite cualquier rol implementado.
  if (response.status === 401) {
    return { kind: 'sin-sesion' };
  }

  if (!response.ok) {
    return { kind: 'error' };
  }

  try {
    return { kind: 'ok', datos: (await response.json()) as SesionInstitucionalDto };
  } catch {
    return { kind: 'error' };
  }
}

/**
 * Caducidad redactada a partir de la cadena ISO del servidor.
 *
 * Se compone con operaciones de CADENA y no con la fecha del sistema: la
 * caducidad es un dato del servidor y la interfaz no debe recalcularla, ni
 * desplazarla por la zona horaria del navegador, ni afirmar cuánto falta.
 * Ante una cadena con forma inesperada devuelve `null` en lugar de inventar.
 */
export function textoCaducidad(expiresAt: string): string | null {
  const coincidencia = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/u.exec(expiresAt);

  if (coincidencia === null) {
    return null;
  }

  const [, anio, mes, dia, hora, minuto] = coincidencia;

  return `Sesión vigente hasta ${dia}/${mes}/${anio} ${hora}:${minuto} UTC`;
}

/* -------------------------------------------------------------------------- */
/* Apertura y cierre de la sesión institucional                                */
/* -------------------------------------------------------------------------- */

/**
 * Colección de sesiones institucionales.
 *
 * `POST` abre la sesión y `DELETE /current` la cierra. Ambas operaciones
 * CAMBIAN estado y el servidor las protege además con una comprobación de
 * origen: el navegador declara `Origin` por su cuenta y este código no lo
 * fabrica ni lo suplanta.
 */
export const RUTA_SESIONES_INSTITUCIONALES = '/api/v1/institutional/sessions';

/**
 * Forma admitida del código de identidad institucional.
 *
 * Réplica EXACTA de la forma que valida el servidor. La comprobación local no
 * es un control de seguridad —la autoridad es siempre la API— sino un aviso
 * inmediato que evita enviar una credencial cuando el código no puede ser
 * válido de ninguna manera.
 *
 * El código NO es una credencial y NO transporta rol ni institución: solo
 * selecciona cuál credencial verifica el servidor dentro del tenant que él ya
 * resolvió.
 */
export const PATRON_CODIGO_IDENTIDAD = /^[a-z0-9][a-z0-9._-]{0,63}$/u;

/** Longitud máxima que el servidor acepta para la credencial de acceso. */
export const LONGITUD_MAXIMA_CREDENCIAL = 512;

/** Motivos por los que el formulario no puede enviarse todavía. */
export type MotivoCredencialInvalida =
  | 'codigo-requerido'
  | 'codigo-invalido'
  | 'credencial-requerida'
  | 'credencial-excedida';

/**
 * Avisos de la validación local.
 *
 * Describen la FORMA del dato escrito, nunca si existe la identidad, si está
 * habilitada o si la credencial coincide: eso solo lo sabe el servidor y su
 * respuesta es deliberadamente uniforme.
 */
export const MENSAJE_CREDENCIAL: Record<MotivoCredencialInvalida, string> = {
  'codigo-requerido': 'Escriba el código de identidad institucional.',
  'codigo-invalido':
    'El código de identidad institucional solo admite minúsculas, dígitos, punto, guion y guion bajo.',
  'credencial-requerida': 'Escriba la credencial de acceso institucional.',
  'credencial-excedida': 'La credencial de acceso supera la longitud admitida.',
};

/**
 * Valida la FORMA de lo escrito antes de enviarlo. `null` significa enviable.
 *
 * No compara, no deduce y no adelanta ningún desenlace: dos entradas con forma
 * válida producen exactamente la misma llamada, sea cual sea su contenido.
 */
export function validarAcceso(
  identityCode: string,
  accessSecret: string,
): MotivoCredencialInvalida | null {
  if (identityCode.length === 0) {
    return 'codigo-requerido';
  }

  if (!PATRON_CODIGO_IDENTIDAD.test(identityCode)) {
    return 'codigo-invalido';
  }

  if (accessSecret.length === 0) {
    return 'credencial-requerida';
  }

  return accessSecret.length > LONGITUD_MAXIMA_CREDENCIAL ? 'credencial-excedida' : null;
}

/** Desenlace de la apertura de sesión. */
export type ResultadoApertura =
  | { readonly kind: 'ok' }
  | { readonly kind: 'credenciales-invalidas' }
  | { readonly kind: 'solicitud-invalida' }
  | { readonly kind: 'origen-rechazado' }
  | { readonly kind: 'demasiados-intentos' }
  | { readonly kind: 'cancelado' }
  | { readonly kind: 'error' };

/** Desenlaces de apertura que la interfaz debe explicar a quien la usa. */
export type FalloApertura = Exclude<ResultadoApertura['kind'], 'cancelado' | 'ok'>;

/**
 * Textos de cada fallo de apertura.
 *
 * `credenciales-invalidas` NO distingue si el código no existe, si la identidad
 * no está aprovisionada, si está deshabilitada o si la credencial no coincide:
 * el servidor responde igual en los cuatro casos y la interfaz no debe deducir
 * más de lo que se le dijo.
 */
export const MENSAJE_APERTURA: Record<FalloApertura, string> = {
  'credenciales-invalidas':
    'No fue posible abrir la sesión institucional con los datos escritos.',
  'solicitud-invalida': 'Revise el código y la credencial e inténtelo de nuevo.',
  'origen-rechazado':
    'Esta pantalla no está autorizada para abrir la sesión institucional. Avise a la administración de la institución.',
  'demasiados-intentos':
    'Demasiados intentos desde este equipo. Espere unos minutos e inténtelo de nuevo.',
  error: 'El servicio de acceso institucional no está disponible en este momento.',
};

/** Aviso cuando la sesión se abrió pero el contexto no pudo confirmarse. */
export const MENSAJE_SIN_CONFIRMAR =
  'No fue posible confirmar la sesión institucional. Vuelva a intentarlo.';

/**
 * Abre una sesión institucional con un código de identidad y su credencial.
 *
 * NO devuelve nada del cuerpo de la respuesta, y es deliberado: la identidad
 * mostrada se toma SIEMPRE del contexto que devuelve `current`, que es la única
 * fuente que describe la sesión efectivamente establecida. El rol que viaja en
 * la respuesta de apertura no se propaga a la interfaz para que exista una sola
 * procedencia de la identidad visible.
 *
 * El token de sesión NO pasa por este código: viaja en una cookie `HttpOnly`
 * que el navegador administra y que el JavaScript de la página no puede leer.
 * La credencial recibida se usa una vez, en el cuerpo de esta petición, y no se
 * guarda, no se registra y no se devuelve.
 *
 * No lanza nunca: devuelve un desenlace tipado.
 */
export async function abrirSesionInstitucional(
  identityCode: string,
  accessSecret: string,
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<ResultadoApertura> {
  let response: Response;

  try {
    response = await fetchImpl(
      `${resolvePublicApiBaseUrl()}${RUTA_SESIONES_INSTITUCIONALES}`,
      {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        cache: 'no-store',
        // EXACTAMENTE los dos campos del contrato: ni rol, ni tenant, ni actor.
        body: JSON.stringify({ identityCode, accessSecret }),
        ...(signal === undefined ? {} : { signal }),
      },
    );
  } catch (error) {
    if (signal?.aborted === true || (error instanceof Error && error.name === 'AbortError')) {
      return { kind: 'cancelado' };
    }

    return { kind: 'error' };
  }

  if (signal?.aborted === true) {
    return { kind: 'cancelado' };
  }

  switch (response.status) {
    case 400:
      return { kind: 'solicitud-invalida' };
    case 401:
      return { kind: 'credenciales-invalidas' };
    case 403:
      return { kind: 'origen-rechazado' };
    case 429:
      return { kind: 'demasiados-intentos' };
    default:
      break;
  }

  return response.ok ? { kind: 'ok' } : { kind: 'error' };
}

/** Desenlace del cierre de sesión. */
export type ResultadoCierre =
  | { readonly kind: 'ok' }
  | { readonly kind: 'sin-sesion' }
  | { readonly kind: 'origen-rechazado' }
  | { readonly kind: 'cancelado' }
  | { readonly kind: 'error' };

/** Confirmación tras cerrar la sesión para entrar con otra credencial. */
export const MENSAJE_CAMBIO =
  'Sesión cerrada. Puede entrar con otra credencial institucional.';

/** Confirmación tras cerrar la sesión y salir. */
export const MENSAJE_CIERRE =
  'Sesión cerrada. Ya no hay identidad institucional en esta pantalla.';

/**
 * Aviso cuando el servidor NO confirmó la revocación.
 *
 * La sesión NO se retira de la interfaz en ese caso: si el servidor la
 * conserva, esconderla en pantalla no la cierra y haría creer que sí. Mientras
 * la revocación no se confirme tampoco se puede entrar con otra credencial: el
 * acceso queda bloqueado hasta que el cierre se confirme.
 */
export const MENSAJE_CIERRE_NO_CONFIRMADO =
  'No fue posible confirmar el cierre en el servidor. La sesión sigue abierta y no se puede cambiar todavía. Inténtelo de nuevo.';

/**
 * Cierra la sesión institucional vigente.
 *
 * `sin-sesion` no es un fallo desde la interfaz: significa que en el servidor ya
 * no había nada que cerrar. `error` y `origen-rechazado` sí lo son, y la
 * interfaz debe decirlo: retirar la identidad de la pantalla no revoca por sí
 * mismo una sesión que el servidor conserva.
 */
export async function cerrarSesionInstitucional(
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<ResultadoCierre> {
  let response: Response;

  try {
    response = await fetchImpl(`${resolvePublicApiBaseUrl()}${RUTA_SESION_INSTITUCIONAL}`, {
      method: 'DELETE',
      credentials: 'include',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      ...(signal === undefined ? {} : { signal }),
    });
  } catch (error) {
    if (signal?.aborted === true || (error instanceof Error && error.name === 'AbortError')) {
      return { kind: 'cancelado' };
    }

    return { kind: 'error' };
  }

  if (signal?.aborted === true) {
    return { kind: 'cancelado' };
  }

  switch (response.status) {
    case 401:
      return { kind: 'sin-sesion' };
    case 403:
      return { kind: 'origen-rechazado' };
    default:
      break;
  }

  return response.ok ? { kind: 'ok' } : { kind: 'error' };
}

/* -------------------------------------------------------------------------- */
/* Decisión del cierre: solo una revocación CONFIRMADA retira la sesión        */
/* -------------------------------------------------------------------------- */

/** Qué se pretendía al cerrar: entrar con otra credencial, o simplemente salir. */
export type IntencionCierre = 'cambiar' | 'cerrar';

/**
 * Qué debe hacer la interfaz tras un intento de cierre.
 *
 * Se resuelve con una función PURA para poder probar la regla sin navegador:
 * `retirarSesion` solo puede ser `true` cuando el servidor confirmó que ya no
 * hay sesión que cerrar.
 */
export interface ResolucionCierre {
  /** `true` únicamente cuando el servidor confirmó que la sesión ya no existe. */
  readonly retirarSesion: boolean;
  /** `true` cuando falta reconfirmar el contexto antes de decidir. */
  readonly reconfirmar: boolean;
  /** Aviso a mostrar, o `null` mientras la decisión no está tomada. */
  readonly aviso: string | null;
}

/**
 * Decide qué hacer con la respuesta del `DELETE`.
 *
 * SOLO `204` (`ok`) y `401` (`sin-sesion`) confirman que en el servidor ya no
 * hay sesión: son las dos únicas respuestas que autorizan a retirarla de la
 * interfaz. Cualquier otro desenlace —origen rechazado, fallo del servicio,
 * red caída, petición cancelada— deja la sesión EN PIE y obliga a reconfirmar,
 * porque una sesión que el servidor conserva sigue existiendo aunque la
 * pantalla deje de mostrarla, y ocultarla haría creer que se cerró.
 */
export function resolverCierre(
  cierre: ResultadoCierre['kind'],
  intencion: IntencionCierre,
): ResolucionCierre {
  if (cierre === 'ok' || cierre === 'sin-sesion') {
    return {
      retirarSesion: true,
      reconfirmar: false,
      aviso: intencion === 'cambiar' ? MENSAJE_CAMBIO : MENSAJE_CIERRE,
    };
  }

  return { retirarSesion: false, reconfirmar: true, aviso: null };
}

/**
 * Decide qué hacer tras RECONFIRMAR el contexto de una revocación no confirmada.
 *
 * `sin-sesion` cierra el asunto: el servidor dice que ya no hay sesión, de modo
 * que retirarla es exacto. En cualquier otro caso —contexto vigente, servicio
 * caído o consulta cancelada— la sesión se CONSERVA y el cambio de sesión sigue
 * bloqueado: sin confirmación no se puede afirmar que la anterior terminó, y
 * dejar entrar con otra credencial encima de una sesión viva sería falso.
 */
export function resolverReconfirmacion(
  contexto: ResultadoSesion['kind'],
  intencion: IntencionCierre,
): ResolucionCierre {
  if (contexto === 'sin-sesion') {
    return {
      retirarSesion: true,
      reconfirmar: false,
      aviso: intencion === 'cambiar' ? MENSAJE_CAMBIO : MENSAJE_CIERRE,
    };
  }

  return {
    retirarSesion: false,
    reconfirmar: false,
    aviso: MENSAJE_CIERRE_NO_CONFIRMADO,
  };
}
