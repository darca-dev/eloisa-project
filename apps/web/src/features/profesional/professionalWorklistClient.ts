import { resolvePublicApiBaseUrl } from '@/config/environment';
import { esCancelacion, peticionHumana } from '@/features/auth/humanSessionClient';

/**
 * Cliente de la worklist del profesional de terreno (SPEC 038, MP04 §12).
 *
 * Consume UNA ruta y ninguna más:
 *
 * - `GET /api/v1/professional/visits?from=AAAA-MM-DD&to=AAAA-MM-DD`
 *
 * MP04 cierra `/profesional`: el portal deja de mostrar las visitas estáticas
 * que tenía en memoria y pasa a preguntar al servidor qué tiene ASIGNADO. Una
 * persona sin perfil, sin afiliación vigente, sin asignación o sin citas
 * recibe `items: []`, y esa lista vacía es la worklist vacía que la spec exige
 * —nunca revela si otra persona sí tiene citas.
 *
 * NO HAY NINGÚN OTRO FILTRO. El cliente no envía profesional, paciente,
 * institución, asignación, estado, actor ni rol: la única entrada declarada es
 * la ventana de calendario, y por firma no se le puede pasar nada más. El
 * servidor resuelve la autorización ÍNTEGRAMENTE desde la sesión humana.
 *
 * LA VENTANA SE DECLARA, NO SE DEDUCE AQUÍ. `ventanaUtc` construye el rango a
 * partir de un instante EXPLÍCITO que recibe quien llama, de modo que la
 * función es pura y las pruebas no dependen del reloj de la máquina.
 *
 * NUNCA LANZA. Todo desenlace —incluido el fallo de red y la cancelación— se
 * devuelve tipado, para que el portal muestre un estado accesible y ofrezca
 * reintentar en vez de romperse.
 *
 * NADA SE CACHEA. Cada llamada sale de verdad al servidor y el estado de carga
 * lo lleva quien llama: cerrada la sesión no queda nada recuperable.
 */

/* -------------------------------------------------------------------------- */
/* Ruta y catálogos                                                            */
/* -------------------------------------------------------------------------- */

/** La ÚNICA ruta que este cliente toca. */
export const RUTA_WORKLIST_PROFESIONAL = '/api/v1/professional/visits';

/** Ventana máxima en días, inclusive, que el servidor acepta. */
export const MAX_VENTANA_DIAS = 31;

/** Modalidad única de esta superficie. La fija el servidor, no el cliente. */
export const MODALIDAD_WORKLIST = 'HOME';

/** Estados de visita domiciliaria. Reflejo del catálogo del servidor. */
export const ESTADOS_VISITA_PROFESIONAL = [
  'SCHEDULED',
  'IN_PROGRESS',
  'COMPLETED',
  'NOT_COMPLETED',
] as const;

export type EstadoVisitaProfesional = (typeof ESTADOS_VISITA_PROFESIONAL)[number];

/* -------------------------------------------------------------------------- */
/* Contrato de salida                                                          */
/* -------------------------------------------------------------------------- */

/** Ventana solicitada, devuelta tal cual por el servidor. */
export interface VentanaWorklist {
  readonly from: string;
  readonly to: string;
}

/**
 * Persona atendida, minimizada a nombre mostrable e iniciales.
 *
 * La lista de claves es EXACTA: ni identificador, ni documento, ni contacto,
 * ni dirección, ni nada clínico. Un campo de más rechaza la respuesta entera
 * en lugar de pintarse.
 */
export interface PersonaWorklist {
  readonly displayName: string;
  readonly initials: string;
}

/** Visita ya materializada, u `null` cuando la agenda aún no la creó. */
export interface VisitaWorklist {
  readonly homeVisitId: string;
  readonly status: EstadoVisitaProfesional;
  readonly version: number;
  readonly startedAt: string | null;
  readonly endedAt: string | null;
  readonly updatedAt: string;
}

/** Una cita HOME asignada de la persona autenticada. */
export interface ItemWorklist {
  readonly appointmentId: string;
  readonly scheduledStart: string;
  readonly modality: typeof MODALIDAD_WORKLIST;
  readonly patient: PersonaWorklist;
  readonly visit: VisitaWorklist | null;
}

/** Worklist completa de la ventana solicitada. */
export interface WorklistProfesional {
  readonly window: VentanaWorklist;
  readonly items: readonly ItemWorklist[];
}

/**
 * Los CUATRO fallos posibles.
 *
 * `sin-sesion` y `respuesta-invalida` se separan porque la acción distinta que
 * habilitan es distinta —volver a entrar, frente a reintentar—; `cancelado`
 * no es un fallo, es que la pantalla dejó de estar interesada.
 * `no-disponible` cubre por igual el `503`, cualquier otro estado y el fallo
 * de red: en los tres casos no hay nada que afirmar y se falla CERRADO.
 */
export type FalloWorklist = 'sin-sesion' | 'no-disponible' | 'respuesta-invalida' | 'cancelado';

/** O datos completos y válidos, o un fallo nombrado. Nunca datos parciales. */
export type ResultadoWorklist =
  | { readonly estado: 'ok'; readonly worklist: WorklistProfesional }
  | { readonly estado: FalloWorklist };

/* -------------------------------------------------------------------------- */
/* Ventana de calendario                                                       */
/* -------------------------------------------------------------------------- */

function diaUtc(instante: Date): string {
  return instante.toISOString().slice(0, 10);
}

/**
 * Ventana de `dias` días inclusivos terminada en `hoy`, en UTC.
 *
 * El instante EXPLÍCITO es la única forma en la que este módulo acepta «ahora»:
 * no hay `Date.now()` ni `new Date()` sin argumentos, de modo que la función es
 * determinista y la ventana no depende de la zona horaria del navegador.
 */
export function ventanaUtc(dias: number, hoy: Date): VentanaWorklist {
  const limite = Math.max(1, Math.min(Math.trunc(dias), MAX_VENTANA_DIAS));
  const inicio = new Date(hoy.getTime() - (limite - 1) * 24 * 60 * 60 * 1000);

  return { from: diaUtc(inicio), to: diaUtc(hoy) };
}

/* -------------------------------------------------------------------------- */
/* Validación de la respuesta                                                  */
/* -------------------------------------------------------------------------- */

type Registro = Readonly<Record<string, unknown>>;

function esRegistro(valor: unknown): valor is Registro {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

/**
 * Igualdad EXACTA del conjunto de claves.
 *
 * Sobrar una clave rechaza la respuesta entera: un campo nuevo del servidor no
 * puede llegar a la pantalla sin decisión, y es lo que hace observable la
 * minimización del contrato.
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

function esEnteroPositivo(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isInteger(valor) && valor >= 1;
}

function esNuloOTexto(valor: unknown): valor is string | null {
  return valor === null || typeof valor === 'string';
}

function esDeCatalogo<TValor extends string>(
  valor: unknown,
  catalogo: readonly TValor[],
): valor is TValor {
  return typeof valor === 'string' && catalogo.some((admitido) => admitido === valor);
}

function leerPersona(cuerpo: unknown): PersonaWorklist | undefined {
  if (
    !esRegistro(cuerpo) ||
    !clavesExactas(cuerpo, ['displayName', 'initials']) ||
    !esTextoNoVacio(cuerpo.displayName) ||
    !esTextoNoVacio(cuerpo.initials)
  ) {
    return undefined;
  }

  return { displayName: cuerpo.displayName, initials: cuerpo.initials };
}

function leerVisita(cuerpo: unknown): VisitaWorklist | null | undefined {
  if (cuerpo === null) {
    return null;
  }

  if (
    !esRegistro(cuerpo) ||
    !clavesExactas(cuerpo, [
      'homeVisitId',
      'status',
      'version',
      'startedAt',
      'endedAt',
      'updatedAt',
    ]) ||
    !esTextoNoVacio(cuerpo.homeVisitId) ||
    !esDeCatalogo(cuerpo.status, ESTADOS_VISITA_PROFESIONAL) ||
    !esEnteroPositivo(cuerpo.version) ||
    !esNuloOTexto(cuerpo.startedAt) ||
    !esNuloOTexto(cuerpo.endedAt) ||
    !esTextoNoVacio(cuerpo.updatedAt)
  ) {
    return undefined;
  }

  return {
    homeVisitId: cuerpo.homeVisitId,
    status: cuerpo.status,
    version: cuerpo.version,
    startedAt: cuerpo.startedAt,
    endedAt: cuerpo.endedAt,
    updatedAt: cuerpo.updatedAt,
  };
}

function leerItem(cuerpo: unknown): ItemWorklist | undefined {
  if (!esRegistro(cuerpo)) {
    return undefined;
  }

  const visita = leerVisita(cuerpo.visit);

  if (
    !clavesExactas(cuerpo, ['appointmentId', 'scheduledStart', 'modality', 'patient', 'visit']) ||
    !esTextoNoVacio(cuerpo.appointmentId) ||
    !esTextoNoVacio(cuerpo.scheduledStart) ||
    cuerpo.modality !== MODALIDAD_WORKLIST ||
    visita === undefined
  ) {
    return undefined;
  }

  const patient = leerPersona(cuerpo.patient);

  if (patient === undefined) {
    return undefined;
  }

  return {
    appointmentId: cuerpo.appointmentId,
    scheduledStart: cuerpo.scheduledStart,
    modality: MODALIDAD_WORKLIST,
    patient,
    visit: visita,
  };
}

function leerVentana(cuerpo: unknown): VentanaWorklist | undefined {
  if (
    !esRegistro(cuerpo) ||
    !clavesExactas(cuerpo, ['from', 'to']) ||
    !esTextoNoVacio(cuerpo.from) ||
    !esTextoNoVacio(cuerpo.to)
  ) {
    return undefined;
  }

  return { from: cuerpo.from, to: cuerpo.to };
}

/** Worklist completa, o `undefined` si algún elemento no cumple el contrato. */
export function leerWorklist(cuerpo: unknown): WorklistProfesional | undefined {
  if (!esRegistro(cuerpo) || !clavesExactas(cuerpo, ['window', 'items'])) {
    return undefined;
  }

  const window = leerVentana(cuerpo.window);

  if (window === undefined || !Array.isArray(cuerpo.items)) {
    return undefined;
  }

  const items: ItemWorklist[] = [];

  for (const crudo of cuerpo.items) {
    const item = leerItem(crudo);

    if (item === undefined) {
      return undefined;
    }

    items.push(item);
  }

  return { window, items };
}

/* -------------------------------------------------------------------------- */
/* Consulta                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Consulta la worklist de la ventana declarada.
 *
 * `ventana` es la ÚNICA entrada. No se compone ningún otro parámetro, no se
 * envía cuerpo y no se escribe cabecera de identidad: la credencial viaja en la
 * cookie `HttpOnly` que administra el navegador y que este código no lee.
 */
export async function consultarWorklistProfesional(
  ventana: VentanaWorklist,
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<ResultadoWorklist> {
  const url = new URL(`${resolvePublicApiBaseUrl()}${RUTA_WORKLIST_PROFESIONAL}`);

  url.searchParams.set('from', ventana.from);
  url.searchParams.set('to', ventana.to);

  let response: Response;

  try {
    response = await fetchImpl(url.toString(), peticionHumana('GET', signal));
  } catch (error) {
    return esCancelacion(error, signal)
      ? { estado: 'cancelado' }
      : { estado: 'no-disponible' };
  }

  if (signal?.aborted === true) {
    return { estado: 'cancelado' };
  }

  if (response.status === 401) {
    return { estado: 'sin-sesion' };
  }

  if (response.status === 400) {
    return { estado: 'respuesta-invalida' };
  }

  if (!response.ok) {
    return { estado: 'no-disponible' };
  }

  let crudo: unknown;

  try {
    crudo = await response.json();
  } catch {
    return { estado: 'respuesta-invalida' };
  }

  const worklist = leerWorklist(crudo);

  return worklist === undefined ? { estado: 'respuesta-invalida' } : { estado: 'ok', worklist };
}
