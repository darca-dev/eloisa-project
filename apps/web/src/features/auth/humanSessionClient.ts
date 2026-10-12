import { resolvePublicApiBaseUrl } from '@/config/environment';

/**
 * Cliente COMPARTIDO de la sesión HUMANA (spec 021 §17.D-3, `MOVE TO SHARED`,
 * sobre IDENTITY-RELATIONSHIPS-CORE-01 §8.1 y
 * HUMAN-PROFESSIONAL-SESSION-MINIMUM-UI).
 *
 * Es el MISMO cliente que Hospital ya usaba, movido a un módulo compartido para
 * que la experiencia de Paciente lo REUTILICE en vez de duplicar seguridad. El
 * único grado de libertad añadido es CUÁL contexto exige quien pregunta: el
 * transporte, el fallo cerrado y la interpretación son una sola cosa y viven
 * aquí.
 *
 * QUÉ HACE, exactamente:
 *
 * - compone la URL absoluta del inicio OIDC para que la interfaz NAVEGUE hacia
 *   ella. El inicio de sesión NO se pide por red desde este código: el flujo
 *   OIDC responde con una redirección hacia un tercero, y pedirla en segundo
 *   plano la rompería;
 * - consulta el estado de la sesión vigente y lo reduce a CINCO desenlaces;
 * - revoca la sesión vigente.
 *
 * QUÉ NO HACE, y no puede hacer:
 *
 * - NO existe un segundo mecanismo de acceso. No hay credencial propia de
 *   MERDN, no hay acceso de desarrollo, no hay cabecera de identidad fabricada
 *   y no hay repliegue: si la superficie humana no está disponible, esto falla
 *   CERRADO;
 * - NO lee, escribe ni copia la credencial de sesión. Viaja en una cookie
 *   `HttpOnly` que el navegador administra y que este código no puede ver, y
 *   por eso toda petición pide `credentials: 'include'`;
 * - NO guarda nada en el navegador y pide `cache: 'no-store'`;
 * - NO envía —ni acepta— identificador de autoridad alguno: ni institución, ni
 *   cuenta, ni persona, ni paciente, ni perfil, ni ningún dato del proveedor de
 *   identidad. El servidor resuelve el contexto ÍNTEGRAMENTE desde la sesión;
 * - NO toca la sesión INSTITUCIONAL ni la cookie de autoinscripción. Son
 *   entidades disjuntas: ni una autentica a la otra, ni cerrar una cierra la
 *   otra;
 * - NUNCA lanza: devuelve un desenlace tipado para que la interfaz muestre un
 *   estado accesible y permita reintentar.
 *
 * LOS CONTEXTOS NO SE SUMAN. Preguntar por `PATIENT` y preguntar por
 * `PROFESSIONAL` son preguntas distintas: una sesión que solo trae uno de los
 * dos NO satisface al otro, y esa diferencia se prueba.
 *
 * TENER CONTEXTO NO ES TENER PERMISO. Que la sesión declare un contexto solo
 * dice que la persona tiene esa participación viva. Cada acción vuelve a exigir
 * su propia autorización en el servidor, y esa respuesta es la única que
 * habilita algo.
 *
 * `fetchImpl` se recibe por parámetro, con `fetch` como valor por defecto: es
 * lo que permite probar rutas, método, cancelación y cada código de estado sin
 * jsdom y sin red.
 */

/* -------------------------------------------------------------------------- */
/* Rutas                                                                       */
/* -------------------------------------------------------------------------- */

/** Las TRES rutas humanas que esta superficie usa. Ninguna más. */
export const RUTAS_SESION_HUMANA = {
  login: '/api/v1/human-auth/login',
  sesion: '/api/v1/human-auth/session',
  logout: '/api/v1/human-auth/logout',
} as const;

/**
 * Destino posterior al login.
 *
 * Es el ÚNICO valor de la allowlist CERRADA del servidor que esta superficie
 * usa. No se compone, no se deduce de la ubicación actual y no se recibe por
 * parámetro: un destino distinto sería descartado por el servidor, y fabricarlo
 * aquí solo invitaría a creer que la interfaz elige a dónde vuelve.
 *
 * Desde MP04 es `/acceso`, no `/`: el servidor añadió esa ruta a
 * `HUMAN_AUTH_RETURN_TARGETS` a propósito, y el selector de experiencias vive
 * ahí. Devolver a `/` dejaría a la persona en el portal central con una sesión
 * abierta y sin decidir a qué portada entrar.
 */
export const DESTINO_RETORNO_HUMANO = '/acceso';

/**
 * Ruta de las EXPERIENCIAS aprobadas de la cuenta.
 *
 * Es la CUARTA ruta que esta superficie toca, y no es una ruta de sesión: la
 * sesión dice que hay persona; esta dice qué portadas le aprobó la
 * institución. Se declara aparte de `RUTAS_SESION_HUMANA` porque pertenece a
 * otro controlador (`/api/v1/me`) y mezclarlas daría a entender que cerrar
 * sesión cierra algo más.
 */
export const RUTA_EXPERIENCIAS_HUMANAS = '/api/v1/me/experiences';

/* -------------------------------------------------------------------------- */
/* Contrato de la sesión                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Los TRES contextos humanos que hoy exige alguna superficie de MERDN.
 *
 * No es el catálogo del servidor —que además puede no devolver ninguno—: es la
 * lista de los que una interfaz puede pedir. Ampliarla es habilitar una
 * experiencia nueva, y eso exige una spec, no una constante.
 *
 * MP04 §12 es esa spec para `CAREGIVER`: `/cuidador` debe distinguir «con
 * relación» de «sin relación» y mostrar en el segundo caso una portada neutra
 * SIN datos nominales. Sin pedir el contexto no hay forma de hacerlo en la
 * interfaz, y decidirlo en el navegador a partir de la experiencia aprobada
 * sería exactamente lo que la spec prohíbe: una experiencia dice a QUÉ portada
 * se entra, no sobre QUIÉN se cuida. El servidor sigue siendo la autoridad —
 * `HumanContextsService` solo emite `CAREGIVER` con una relación activa—.
 */
export const CONTEXTOS_HUMANOS = {
  paciente: 'PATIENT',
  cuidador: 'CAREGIVER',
  profesional: 'PROFESSIONAL',
} as const;

/** Contexto que una superficie puede exigir al preguntar por la sesión. */
export type ContextoHumanoRequerido =
  (typeof CONTEXTOS_HUMANOS)[keyof typeof CONTEXTOS_HUMANOS];

/**
 * Cuerpo de la consulta de sesión, EXACTAMENTE como el servidor lo declara.
 *
 * Tres campos y ninguno más. El servidor no devuelve identidad, institución,
 * persona, paciente ni perfil, y este tipo no deja hueco para que ninguno de
 * esos valores aparezca por accidente.
 */
export interface SesionHumanaDto {
  readonly expiresAt: string;
  readonly idleExpiresInSeconds: number;
  readonly contexts: readonly string[];
}

/**
 * Desenlace de la consulta, ya reducido a lo que la interfaz debe decidir.
 *
 * `activa-sin-contexto` se distingue de `sin-sesion` a propósito: hay sesión
 * personal, pero no trae el contexto que esta superficie exige, y la acción de
 * quien la usa es distinta en cada caso. `no-disponible` cubre por igual el
 * `503`, el fallo de red y el cuerpo ilegible: en los tres casos no hay estado
 * que afirmar, y se falla CERRADO.
 */
export type EstadoSesionHumana =
  | 'activa-con-contexto'
  | 'activa-sin-contexto'
  | 'sin-sesion'
  | 'cancelado'
  | 'no-disponible';

/**
 * Desenlace del cierre.
 *
 * `sin-sesion` NO es un fallo: significa que en el servidor ya no había nada
 * que revocar, y por tanto confirma el cierre igual que el `204`. Cualquier
 * otro desenlace deja la sesión EN PIE, y la interfaz debe decirlo en lugar de
 * ocultarla: esconder en pantalla una sesión que el servidor conserva haría
 * creer que se cerró.
 */
export type CierreSesionHumana =
  | 'ok'
  | 'sin-sesion'
  | 'origen-rechazado'
  | 'demasiados-intentos'
  | 'cancelado'
  | 'no-disponible';

/* -------------------------------------------------------------------------- */
/* Inicio del flujo OIDC                                                       */
/* -------------------------------------------------------------------------- */

/**
 * URL ABSOLUTA del inicio de sesión humano.
 *
 * La interfaz NAVEGA hacia ella; no la pide en segundo plano. La respuesta del
 * servidor es una redirección hacia el proveedor de identidad, y además de la
 * redirección deja en el navegador la cookie transitoria del intento: pedirla
 * fuera de una navegación real rompería el flujo y no abriría ninguna sesión.
 *
 * Es la MISMA URL para Paciente y para Profesional: no existe un inicio por
 * rol. Los contextos los deriva el servidor después, y esta interfaz no los
 * anuncia ni los pide de antemano.
 */
export function urlDeLoginHumano(): string {
  return `${resolvePublicApiBaseUrl()}${RUTAS_SESION_HUMANA.login}?returnTo=${DESTINO_RETORNO_HUMANO}`;
}

/* -------------------------------------------------------------------------- */
/* Transporte                                                                  */
/* -------------------------------------------------------------------------- */

/** Distingue un abort deliberado de un fallo real de red. */
export function esCancelacion(error: unknown, signal?: AbortSignal): boolean {
  if (signal?.aborted === true) {
    return true;
  }

  return error instanceof Error && error.name === 'AbortError';
}

/** Opciones comunes: sesión por cookie, sin caché y sin cabecera fabricada. */
export function peticionHumana(method: 'GET' | 'POST', signal?: AbortSignal): RequestInit {
  return {
    method,
    // La credencial de sesión la administra el navegador: no se escribe aquí.
    credentials: 'include',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
    ...(signal === undefined ? {} : { signal }),
  };
}

/* -------------------------------------------------------------------------- */
/* Operaciones                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Consulta la sesión humana vigente y devuelve solo su ESTADO respecto del
 * contexto que exige la superficie que pregunta.
 *
 * El cuerpo del servidor se lee para saber si `contexts` incluye ese contexto,
 * y NADA de él se propaga a la interfaz: ni la caducidad absoluta, ni los
 * segundos de inactividad, ni la lista completa. Publicar esos valores sería
 * exponer detalle técnico sin utilidad para quien usa la pantalla, y revelaría
 * además qué otras participaciones tiene la persona.
 *
 * `401` se traduce a `sin-sesion` sin deducir más: el servidor responde
 * IDÉNTICO ante ausencia, malformación, caducidad, revocación, cuenta
 * deshabilitada o identidad externa desvinculada, y la interfaz no debe
 * inventar la diferencia.
 */
export async function consultarSesionHumana(
  contextoRequerido: ContextoHumanoRequerido,
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<EstadoSesionHumana> {
  let response: Response;

  try {
    response = await fetchImpl(
      `${resolvePublicApiBaseUrl()}${RUTAS_SESION_HUMANA.sesion}`,
      peticionHumana('GET', signal),
    );
  } catch (error) {
    return esCancelacion(error, signal) ? 'cancelado' : 'no-disponible';
  }

  if (signal?.aborted === true) {
    return 'cancelado';
  }

  if (response.status === 401) {
    return 'sin-sesion';
  }

  if (!response.ok) {
    return 'no-disponible';
  }

  let datos: SesionHumanaDto;

  try {
    datos = (await response.json()) as SesionHumanaDto;
  } catch {
    return 'no-disponible';
  }

  /*
   * FAIL-CLOSED en la lectura: un cuerpo sin `contexts`, o con algo que no sea
   * una lista, NO se interpreta como sesión con contexto. La ausencia del
   * contexto nunca se completa por inferencia.
   */
  const contextos = Array.isArray(datos.contexts) ? datos.contexts : [];

  return contextos.includes(contextoRequerido)
    ? 'activa-con-contexto'
    : 'activa-sin-contexto';
}

/* -------------------------------------------------------------------------- */
/* Experiencias aprobadas (MP04)                                               */
/* -------------------------------------------------------------------------- */

/**
 * Catálogo CERRADO de experiencias que el servidor puede emitir.
 *
 * No es una lista de permisos: una experiencia decide únicamente a QUÉ portada
 * se puede entrar. Mantenerla cerrada aquí es lo que impide que un valor
 * desconocido —una experiencia de un paquete futuro, o un cuerpo alterado— se
 * convierta en un enlace que la interfaz siga.
 */
export const EXPERIENCIAS_APROBADAS = ['PATIENT', 'CAREGIVER', 'FIELD_PROFESSIONAL', 'HOSPITAL', 'MUNICIPALITY'] as const;

export type ExperienciaAprobada = (typeof EXPERIENCIAS_APROBADAS)[number];

/** Las TRES portadas que una experiencia puede abrir. Ninguna otra. */
export const RUTAS_EXPERIENCIA: Readonly<Record<ExperienciaAprobada, string>> = {
  PATIENT: '/paciente',
  CAREGIVER: '/cuidador',
  FIELD_PROFESSIONAL: '/profesional',
  HOSPITAL: '/hospital',
  MUNICIPALITY: '/municipality',
};

/**
 * Desenlace de la consulta de experiencias.
 *
 * `sin-sesion` es además el desenlace de una PRIMERA visita: sin sesión no hay
 * nada que enrutar y la pantalla muestra el acceso normal, no una denegación.
 * `ninguna` —lista vacía con sesión vigente— sí es la denegación neutral: hay
 * persona, y ninguna aprobación.
 */
export type DesenlaceExperiencias =
  | { readonly kind: 'ok'; readonly experiencias: readonly ExperienciaAprobada[] }
  | { readonly kind: 'sin-sesion' }
  | { readonly kind: 'cancelado' }
  | { readonly kind: 'no-disponible' };

/** Descarta todo lo que no esté en el catálogo: FAIL-CLOSED, no se infiere. */
function filtrarExperiencias(crudo: unknown): readonly ExperienciaAprobada[] {
  if (!Array.isArray(crudo)) {
    return [];
  }

  const validas: ExperienciaAprobada[] = [];

  for (const item of crudo) {
    if (
      typeof item === 'string' &&
      (EXPERIENCIAS_APROBADAS as readonly string[]).includes(item)
    ) {
      validas.push(item as ExperienciaAprobada);
    }
  }

  return validas;
}

/**
 * Consulta qué experiencias aprobó la institución para la cuenta de la sesión.
 *
 * Mismas reglas que la consulta de sesión: cookie administrada por el navegador,
 * sin caché, sin cabecera de identidad, sin lanzar nunca. La respuesta se
 * REDUCE a la lista de catálogo: ni caducidad, ni identificadores, ni motivo de
 * una lista vacía —el servidor deliberadamente no lo sabe decir—.
 */
export async function consultarExperienciasAprobadas(
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<DesenlaceExperiencias> {
  let response: Response;

  try {
    response = await fetchImpl(
      `${resolvePublicApiBaseUrl()}${RUTA_EXPERIENCIAS_HUMANAS}`,
      peticionHumana('GET', signal),
    );
  } catch (error) {
    return esCancelacion(error, signal) ? { kind: 'cancelado' } : { kind: 'no-disponible' };
  }

  if (signal?.aborted === true) {
    return { kind: 'cancelado' };
  }

  if (response.status === 401) {
    return { kind: 'sin-sesion' };
  }

  if (!response.ok) {
    return { kind: 'no-disponible' };
  }

  let datos: { readonly experiences?: unknown };

  try {
    datos = (await response.json()) as { readonly experiences?: unknown };
  } catch {
    return { kind: 'no-disponible' };
  }

  /*
   * FAIL-CLOSED: un cuerpo SIN `experiences` no es una lista vacía de
   * experiencias, es una respuesta que no se entiende. Solo la ausencia
   * EXPLÍCITA de aprobaciones —`[]`— significa «ninguna».
   */
  if (!Array.isArray(datos.experiences)) {
    return { kind: 'no-disponible' };
  }

  return { kind: 'ok', experiencias: filtrarExperiencias(datos.experiences) };
}

/**
 * Revoca la sesión humana vigente.
 *
 * `POST` porque cambia estado, y el servidor lo protege además con una
 * comprobación de origen: el navegador declara `Origin` por su cuenta y este
 * código no lo fabrica ni lo suplanta.
 *
 * NO nombra contexto alguno: cerrar sesión es cerrar la sesión de la persona,
 * no la de un rol. Y NO toca la sesión institucional ni la cookie de
 * autoinscripción: son otras entidades, con otra cookie y otra ruta.
 */
export async function cerrarSesionHumana(
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<CierreSesionHumana> {
  let response: Response;

  try {
    response = await fetchImpl(
      `${resolvePublicApiBaseUrl()}${RUTAS_SESION_HUMANA.logout}`,
      peticionHumana('POST', signal),
    );
  } catch (error) {
    return esCancelacion(error, signal) ? 'cancelado' : 'no-disponible';
  }

  if (signal?.aborted === true) {
    return 'cancelado';
  }

  switch (response.status) {
    case 401:
      return 'sin-sesion';
    case 403:
      return 'origen-rechazado';
    case 429:
      return 'demasiados-intentos';
    default:
      break;
  }

  return response.ok ? 'ok' : 'no-disponible';
}

/**
 * `true` únicamente cuando el servidor confirmó que ya no hay sesión humana.
 *
 * Son las DOS respuestas que lo confirman —revocada y ya inexistente— y
 * ninguna más. Función PURA: la regla se prueba sin navegador. Es la que impide
 * el FALSO ÉXITO: mientras devuelva `false`, la sesión sigue en pie y la
 * pantalla no puede decir que se cerró.
 */
export function cierreHumanoConfirmado(cierre: CierreSesionHumana): boolean {
  return cierre === 'ok' || cierre === 'sin-sesion';
}
