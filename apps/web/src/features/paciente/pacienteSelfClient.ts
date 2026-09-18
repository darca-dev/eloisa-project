import { resolvePublicApiBaseUrl } from '@/config/environment';
import { esCancelacion, peticionHumana } from '@/features/auth/humanSessionClient';

/**
 * Cliente de la superficie SELF-SCOPE del Paciente (spec 021 §6.6-e, §6.7 a
 * §6.11, §17.D-2; `contracts/paciente-self-scope.contract.md`).
 *
 * Consume las TRES rutas de solo lectura que la API ya publica y ninguna más:
 *
 * - `GET /api/v1/patient-self/summary`
 * - `GET /api/v1/patient-self/appointments`
 * - `GET /api/v1/patient-self/visits`
 *
 * NINGÚN SELECTOR DE SUJETO, Y SE VE EN LA FIRMA. Las tres funciones reciben
 * EXCLUSIVAMENTE la implementación de `fetch` y una señal de cancelación. No
 * hay parámetro de paciente, de persona, de sujeto, de documento, de tenant ni
 * de institución, no se compone ninguna cadena de consulta y no se envía cuerpo
 * alguno: lo que no se declara no se puede pasar por descuido. El servidor
 * resuelve el sujeto ÍNTEGRAMENTE desde la sesión humana, y esta capa no tiene
 * forma de proponerle otro.
 *
 * TAMPOCO ENVÍA IDENTIDAD. La credencial viaja en la cookie `HttpOnly` de la
 * sesión humana, que el navegador administra y que este código no lee, no
 * escribe y no copia; por eso toda petición pide `credentials: 'include'` y
 * ninguna escribe cabecera de identidad. Las opciones de transporte son las
 * MISMAS del cliente de sesión humana —se reutilizan, no se reescriben—, de
 * modo que la regla de no-caché y de credencial implícita es una sola.
 *
 * NO GUARDA NADA Y NO CACHEA. No hay memoria de resultados, no hay
 * deduplicación de peticiones y no hay `localStorage`, `sessionStorage` ni
 * IndexedDB: el estado de carga lo lleva quien llama, y cada llamada sale de
 * verdad al servidor. En un dispositivo compartido eso es lo que permite que,
 * cerrada la sesión, no quede ningún dato propio recuperable.
 *
 * NUNCA LANZA. Todo desenlace —incluido el fallo de red y la cancelación— se
 * devuelve tipado, para que la pantalla muestre un estado accesible y ofrezca
 * reintentar en vez de romperse.
 *
 * CONTRATOS CERRADOS. Los tres tipos de salida reproducen EXACTAMENTE los del
 * servidor: tres campos el resumen, tres cada cita y tres cada visita. Una
 * respuesta con un campo de más, con un campo de menos o con un valor fuera del
 * catálogo NO se acepta a medias: se trata como respuesta inválida. Aceptar un
 * campo no declarado sería estrenar en la pantalla un dato que nadie aprobó.
 */

/* -------------------------------------------------------------------------- */
/* Rutas                                                                       */
/* -------------------------------------------------------------------------- */

/** Las TRES rutas self-scope del contrato. La lista es CERRADA. */
export const RUTAS_PACIENTE_SELF = {
  resumen: '/api/v1/patient-self/summary',
  citas: '/api/v1/patient-self/appointments',
  visitas: '/api/v1/patient-self/visits',
} as const;

/* -------------------------------------------------------------------------- */
/* Contratos de salida                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Etiqueta FIJA del resumen (spec 021 §17.C-2).
 *
 * Es una constante del contrato: no se deriva de ningún dato, no varía por
 * persona y no comunica ningún estado.
 */
export const ETIQUETA_PACIENTE = 'Paciente';

/**
 * Resumen propio. Lista CERRADA de TRES campos.
 *
 * Un cuarto campo está fuera de la decisión aprobada del Product Owner y es una
 * STOP CONDITION (spec 021 §19.12), no una ampliación menor.
 */
export interface ResumenPacienteView {
  readonly givenName: string;
  readonly initials: string;
  readonly label: typeof ETIQUETA_PACIENTE;
}

/** Modalidades de cita. Reflejo del catálogo existente, no uno nuevo. */
export const MODALIDADES_CITA = ['ON_SITE', 'HOME', 'VIRTUAL'] as const;

export type ModalidadCita = (typeof MODALIDADES_CITA)[number];

/** Estados de cita. Reflejo del catálogo existente. */
export const ESTADOS_CITA = ['REQUESTED', 'ASSIGNED', 'CANCELLED'] as const;

export type EstadoCita = (typeof ESTADOS_CITA)[number];

/** Estados de visita domiciliaria. Reflejo del catálogo existente. */
export const ESTADOS_VISITA = [
  'SCHEDULED',
  'IN_PROGRESS',
  'COMPLETED',
  'NOT_COMPLETED',
] as const;

export type EstadoVisita = (typeof ESTADOS_VISITA)[number];

/** Una cita propia. TRES campos y ninguno más. */
export interface CitaPacienteView {
  readonly scheduledStart: string;
  readonly modality: ModalidadCita;
  readonly status: EstadoCita;
}

/**
 * Una visita propia. TRES campos y ninguno más.
 *
 * `modality` es la constante `HOME`: la fija el filtro de la consulta en el
 * servidor y no se refleja de una columna.
 */
export interface VisitaPacienteView {
  readonly scheduledStart: string;
  readonly modality: 'HOME';
  readonly status: EstadoVisita;
}

/* -------------------------------------------------------------------------- */
/* Desenlaces                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Los SEIS fallos posibles, cada uno con la acción distinta que habilita en la
 * pantalla.
 *
 * `sin-sesion` y `sin-contexto` se distinguen porque lo que la persona puede
 * hacer es distinto —volver a entrar, frente a no tener esta experiencia—, y
 * porque el propio servidor ya los distingue con `401` y `403`. Ninguno de los
 * dos revela si existe un paciente asociado. `no-disponible` cubre por igual el
 * `503`, cualquier otro estado inesperado y el fallo de red: en los tres casos
 * no hay dato que afirmar, y se falla CERRADO.
 */
export type FalloPacienteSelf =
  | 'sin-sesion'
  | 'sin-contexto'
  | 'demasiados-intentos'
  | 'no-disponible'
  | 'respuesta-invalida'
  | 'cancelado';

/**
 * Desenlace de cada consulta.
 *
 * O hay datos completos y válidos, o hay un fallo nombrado. No existe estado
 * intermedio y no se devuelven datos parciales: media respuesta pintada sería
 * indistinguible de una respuesta real.
 */
export type ResultadoPacienteSelf<TDatos> =
  | { readonly estado: 'ok'; readonly datos: TDatos }
  | { readonly estado: FalloPacienteSelf };

/* -------------------------------------------------------------------------- */
/* Validación de la respuesta                                                  */
/* -------------------------------------------------------------------------- */

/** Registro plano, sin comprometerse todavía con ningún campo. */
type Registro = Readonly<Record<string, unknown>>;

function esRegistro(valor: unknown): valor is Registro {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

/**
 * Igualdad EXACTA del conjunto de claves.
 *
 * No es una comprobación de presencia: sobra una clave y la respuesta se
 * rechaza. Es lo que impide que un campo nuevo del servidor llegue a la
 * pantalla sin decisión, y lo que hace observable la minimización.
 */
function clavesExactas(registro: Registro, esperadas: readonly string[]): boolean {
  const claves = Object.keys(registro).sort((a, b) => a.localeCompare(b, 'es-CO'));
  const referencia = [...esperadas].sort((a, b) => a.localeCompare(b, 'es-CO'));

  return (
    claves.length === referencia.length &&
    claves.every((clave, indice) => clave === referencia[indice])
  );
}

function esTextoNoVacio(valor: unknown): valor is string {
  return typeof valor === 'string' && valor.trim().length > 0;
}

function esDeCatalogo<TValor extends string>(
  valor: unknown,
  catalogo: readonly TValor[],
): valor is TValor {
  return typeof valor === 'string' && catalogo.some((admitido) => admitido === valor);
}

/** Lee el resumen, o `undefined` si no es EXACTAMENTE el contrato aprobado. */
function leerResumen(cuerpo: unknown): ResumenPacienteView | undefined {
  if (!esRegistro(cuerpo) || !clavesExactas(cuerpo, ['givenName', 'initials', 'label'])) {
    return undefined;
  }

  if (
    !esTextoNoVacio(cuerpo.givenName) ||
    !esTextoNoVacio(cuerpo.initials) ||
    cuerpo.label !== ETIQUETA_PACIENTE
  ) {
    return undefined;
  }

  return {
    givenName: cuerpo.givenName,
    initials: cuerpo.initials,
    label: ETIQUETA_PACIENTE,
  };
}

/**
 * Lee una envoltura de lista, o `undefined` si algún elemento no cumple.
 *
 * Un solo elemento inválido invalida la respuesta ENTERA: descartarlo en
 * silencio mostraría una agenda incompleta con apariencia de completa.
 * `items: []` sí es válido, y es el estado vacío, que no es un error.
 */
function leerLista<TItem>(
  cuerpo: unknown,
  leerItem: (item: unknown) => TItem | undefined,
): readonly TItem[] | undefined {
  if (!esRegistro(cuerpo) || !clavesExactas(cuerpo, ['items'])) {
    return undefined;
  }

  const crudos = cuerpo.items;

  if (!Array.isArray(crudos)) {
    return undefined;
  }

  const items: TItem[] = [];

  for (const crudo of crudos) {
    const item = leerItem(crudo);

    if (item === undefined) {
      return undefined;
    }

    items.push(item);
  }

  return items;
}

function leerCita(item: unknown): CitaPacienteView | undefined {
  if (
    !esRegistro(item) ||
    !clavesExactas(item, ['scheduledStart', 'modality', 'status']) ||
    !esTextoNoVacio(item.scheduledStart) ||
    !esDeCatalogo(item.modality, MODALIDADES_CITA) ||
    !esDeCatalogo(item.status, ESTADOS_CITA)
  ) {
    return undefined;
  }

  return {
    scheduledStart: item.scheduledStart,
    modality: item.modality,
    status: item.status,
  };
}

function leerVisita(item: unknown): VisitaPacienteView | undefined {
  if (
    !esRegistro(item) ||
    !clavesExactas(item, ['scheduledStart', 'modality', 'status']) ||
    !esTextoNoVacio(item.scheduledStart) ||
    item.modality !== 'HOME' ||
    !esDeCatalogo(item.status, ESTADOS_VISITA)
  ) {
    return undefined;
  }

  return {
    scheduledStart: item.scheduledStart,
    modality: 'HOME',
    status: item.status,
  };
}

/* -------------------------------------------------------------------------- */
/* Transporte                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Tronco común de las tres consultas.
 *
 * Toma la ruta y el lector del contrato, y devuelve el desenlace. No admite
 * parámetro adicional alguno: la firma es la frontera que impide que un selector
 * de sujeto entre por aquí.
 */
async function consultar<TDatos>(
  ruta: string,
  leer: (cuerpo: unknown) => TDatos | undefined,
  fetchImpl: typeof fetch,
  signal?: AbortSignal,
): Promise<ResultadoPacienteSelf<TDatos>> {
  let response: Response;

  try {
    response = await fetchImpl(
      `${resolvePublicApiBaseUrl()}${ruta}`,
      peticionHumana('GET', signal),
    );
  } catch (error) {
    return { estado: esCancelacion(error, signal) ? 'cancelado' : 'no-disponible' };
  }

  if (signal?.aborted === true) {
    return { estado: 'cancelado' };
  }

  switch (response.status) {
    case 401:
      return { estado: 'sin-sesion' };
    case 403:
      return { estado: 'sin-contexto' };
    case 429:
      return { estado: 'demasiados-intentos' };
    default:
      break;
  }

  if (!response.ok) {
    return { estado: 'no-disponible' };
  }

  let cuerpo: unknown;

  try {
    cuerpo = await response.json();
  } catch {
    return { estado: 'respuesta-invalida' };
  }

  const datos = leer(cuerpo);

  return datos === undefined ? { estado: 'respuesta-invalida' } : { estado: 'ok', datos };
}

/* -------------------------------------------------------------------------- */
/* Operaciones                                                                 */
/* -------------------------------------------------------------------------- */

/** Resumen propio: nombre de pila, iniciales y la etiqueta fija `Paciente`. */
export async function consultarResumenPaciente(
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<ResultadoPacienteSelf<ResumenPacienteView>> {
  return consultar(RUTAS_PACIENTE_SELF.resumen, leerResumen, fetchImpl, signal);
}

/** Citas propias. Lista vacía es un desenlace válido, no un error. */
export async function consultarCitasPaciente(
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<ResultadoPacienteSelf<readonly CitaPacienteView[]>> {
  return consultar(
    RUTAS_PACIENTE_SELF.citas,
    (cuerpo) => leerLista(cuerpo, leerCita),
    fetchImpl,
    signal,
  );
}

/** Visitas domiciliarias propias. Lista vacía es un desenlace válido. */
export async function consultarVisitasPaciente(
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<ResultadoPacienteSelf<readonly VisitaPacienteView[]>> {
  return consultar(
    RUTAS_PACIENTE_SELF.visitas,
    (cuerpo) => leerLista(cuerpo, leerVisita),
    fetchImpl,
    signal,
  );
}
