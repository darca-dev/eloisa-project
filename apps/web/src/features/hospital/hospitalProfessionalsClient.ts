import { resolvePublicApiBaseUrl } from '@/config/environment';

/**
 * Cliente tipado de la superficie Hospital · Profesionales
 * (TASK-HOSPITAL-CORE-02 §6.1; paquete final de corrección §4.1).
 *
 * Frontera ÚNICA entre la vista Hospital → Profesionales y la API. Mismas
 * reglas que el cliente de Pacientes ya aprobado:
 *
 * - NO envía tenant, institución, rol, actor ni identificador de persona: el
 *   contexto lo resuelve íntegramente el servidor y la API rechaza esos
 *   parámetros;
 * - serializa EXCLUSIVAMENTE la allowlist declarada aquí, y omite todo valor
 *   vacío: un parámetro que el servidor no espera produce `400`;
 * - NO contiene secretos: la sesión institucional viaja en una cookie
 *   `HttpOnly` que este código no puede leer ni escribir;
 * - NO guarda nada en ningún almacenamiento del navegador y pide
 *   `cache: 'no-store'`, porque la respuesta es nominal;
 * - NUNCA lanza: devuelve un desenlace tipado para que la interfaz muestre un
 *   estado accesible y permita reintentar;
 * - NO tiene repliegue a fixtures: un fallo es un fallo, y así se comunica.
 *
 * `fetchImpl` se recibe por parámetro, con `fetch` como valor por defecto: es
 * lo que permite probar serialización, cancelación y cada código de estado sin
 * jsdom y sin red.
 */

/* -------------------------------------------------------------------------- */
/* Contrato de respuesta                                                       */
/* -------------------------------------------------------------------------- */

export interface HospitalProcedenciaOperacionesDto {
  readonly source: string;
  readonly generatedAt: string;
}

export interface HospitalVinculoDto {
  readonly engagementType: 'EMPLOYEE' | 'INDEPENDENT' | 'THIRD_PARTY';
  readonly status: 'ACTIVE' | 'INACTIVE' | 'ENDED';
  readonly startsOn: string;
  readonly endsOn: string | null;
}

export interface HospitalPacienteMinimoDto {
  readonly patientId: string;
  readonly fullName: string;
  readonly initials: string;
}

export interface HospitalProfesionalMinimoDto {
  readonly professionalId: string;
  readonly fullName: string;
  readonly initials: string;
  readonly professionCode: string;
  readonly professionName: string;
}

export interface HospitalProfesionalListadoDto extends HospitalProfesionalMinimoDto {
  readonly status: 'ACTIVE' | 'INACTIVE';
  readonly activeAffiliation: HospitalVinculoDto | null;
  readonly activePatientCount: number;
  readonly todayAppointmentCount: number;
  readonly nextAppointmentAt: string | null;
  /** Texto FIJO de indisponibilidad. Nunca una cifra. */
  readonly ratingAvailability: string;
}

export interface HospitalProfesionalesListaDto extends HospitalProcedenciaOperacionesDto {
  readonly page: number;
  readonly pageSize: number;
  readonly totalItems: number;
  readonly totalPages: number;
  readonly items: readonly HospitalProfesionalListadoDto[];
}

export interface HospitalVentanaDto {
  readonly from: string;
  readonly to: string;
}

export interface HospitalCitaProfesionalDto {
  readonly appointmentId: string;
  readonly patient: HospitalPacienteMinimoDto;
  readonly modality: 'ON_SITE' | 'HOME' | 'VIRTUAL';
  readonly status: 'REQUESTED' | 'ASSIGNED' | 'CANCELLED';
  readonly scheduledStart: string | null;
}

export interface HospitalProfesionalDetalleDto
  extends HospitalProfesionalListadoDto,
    HospitalProcedenciaOperacionesDto {
  readonly window: HospitalVentanaDto;
  readonly assignedPatients: readonly HospitalPacienteMinimoDto[];
  readonly appointments: readonly HospitalCitaProfesionalDto[];
}

/* -------------------------------------------------------------------------- */
/* Consulta                                                                    */
/* -------------------------------------------------------------------------- */

/** Tamaños de página admitidos por el servidor. Cualquier otro produce `400`. */
export const HOSPITAL_PROFESIONALES_TAMANOS = [25, 50] as const;

export const HOSPITAL_PROFESIONALES_TAMANO_INICIAL = 25;

/** Criterios de orden SOPORTADOS por la API. */
export const HOSPITAL_PROFESIONALES_ORDENES = ['name', 'profession'] as const;

export type HospitalProfesionalesOrdenId =
  (typeof HOSPITAL_PROFESIONALES_ORDENES)[number];

export type HospitalProfesionalesSentido = 'asc' | 'desc';

/**
 * Filtros que la API acepta.
 *
 * Es la lista COMPLETA de lo que la vista puede enviar. Zona, disponibilidad y
 * calificación NO figuran a propósito: no están modeladas, y enviarlas
 * produciría un `400` además de sugerir un dominio inexistente.
 */
export interface HospitalProfesionalesFiltros {
  readonly search: string;
  readonly professionCode: string;
  readonly affiliationType: '' | 'EMPLOYEE' | 'INDEPENDENT' | 'THIRD_PARTY';
  readonly status: '' | 'ACTIVE' | 'INACTIVE';
}

export const HOSPITAL_PROFESIONALES_FILTROS_VACIOS: HospitalProfesionalesFiltros = {
  search: '',
  professionCode: '',
  affiliationType: '',
  status: '',
};

/** `true` cuando la consulta no aplica ningún recorte. */
export function filtrosProfesionalesVacios(
  filtros: HospitalProfesionalesFiltros,
): boolean {
  return (
    filtros.search.trim() === '' &&
    filtros.professionCode === '' &&
    filtros.affiliationType === '' &&
    filtros.status === ''
  );
}

/** Número de criterios activos. Alimenta el contador visible de la vista. */
export function filtrosProfesionalesActivos(
  filtros: HospitalProfesionalesFiltros,
): number {
  return [
    filtros.search.trim(),
    filtros.professionCode,
    filtros.affiliationType,
    filtros.status,
  ].filter((valor) => valor !== '').length;
}

/**
 * Serializa los filtros a la allowlist del servidor.
 *
 * Un valor vacío se OMITE en lugar de enviarse en blanco: la API rechaza los
 * parámetros mal formados, de modo que `status=` produciría un `400` en vez de
 * «sin filtro de estado».
 */
export function serializarFiltrosProfesionales(
  filtros: HospitalProfesionalesFiltros,
): URLSearchParams {
  const params = new URLSearchParams();
  const search = filtros.search.replace(/\s+/gu, ' ').trim();

  if (search !== '') {
    params.set('search', search);
  }

  for (const [nombre, valor] of [
    ['professionCode', filtros.professionCode],
    ['affiliationType', filtros.affiliationType],
    ['status', filtros.status],
  ] as const) {
    if (valor !== '') {
      params.set(nombre, valor);
    }
  }

  return params;
}

/** Consulta completa del directorio, con paginación y orden. */
export function serializarProfesionales(
  filtros: HospitalProfesionalesFiltros,
  pagina: number,
  tamano: number,
  orden: HospitalProfesionalesOrdenId,
  sentido: HospitalProfesionalesSentido,
): URLSearchParams {
  const params = serializarFiltrosProfesionales(filtros);

  params.set('page', String(pagina));
  params.set('pageSize', String(tamano));
  params.set('sort', orden);
  params.set('direction', sentido);

  return params;
}

/* -------------------------------------------------------------------------- */
/* Desenlaces                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Desenlace de una consulta, ya traducido a lenguaje de interfaz.
 *
 * `cancelado` es un desenlace de primera clase: una consulta abortada por un
 * cambio de filtro NO es un error y no debe pintar un estado de fallo.
 */
export type ResultadoOperaciones<T> =
  | { readonly kind: 'ok'; readonly datos: T }
  | { readonly kind: 'sin-sesion' }
  | { readonly kind: 'sin-permiso' }
  | { readonly kind: 'no-encontrado' }
  | { readonly kind: 'consulta-invalida' }
  | { readonly kind: 'no-disponible' }
  | { readonly kind: 'cancelado' }
  | { readonly kind: 'error' };

const BASE = '/api/v1/hospital/professionals';

/** Rutas consultadas, expuestas para las pruebas de contrato. */
export const RUTAS_HOSPITAL_PROFESIONALES = {
  listado: BASE,
  detalle: (professionalId: string): string =>
    `${BASE}/${encodeURIComponent(professionalId)}`,
} as const;

/** Distingue un abort deliberado de un fallo real de red. */
export function esCancelacionOperaciones(
  error: unknown,
  signal?: AbortSignal,
): boolean {
  if (signal?.aborted === true) {
    return true;
  }

  return error instanceof Error && error.name === 'AbortError';
}

/** Traduce el estado HTTP al desenlace tipado del contrato. */
export function desenlaceDeEstado<T>(estado: number): ResultadoOperaciones<T> | null {
  /*
   * `401` y `403` se distinguen porque la acción de la persona es distinta: sin
   * sesión hay que abrirla; con sesión pero sin permiso, no hay nada que hacer
   * desde la interfaz. Ninguno de los dos revela por qué.
   */
  switch (estado) {
    case 401:
      return { kind: 'sin-sesion' };
    case 403:
      return { kind: 'sin-permiso' };
    case 404:
      return { kind: 'no-encontrado' };
    case 400:
      return { kind: 'consulta-invalida' };
    case 503:
      return { kind: 'no-disponible' };
    default:
      return null;
  }
}

async function consultar<T>(
  path: string,
  fetchImpl: typeof fetch,
  signal?: AbortSignal,
): Promise<ResultadoOperaciones<T>> {
  let response: Response;

  try {
    response = await fetchImpl(`${resolvePublicApiBaseUrl()}${path}`, {
      method: 'GET',
      // La cookie institucional `HttpOnly` la administra el navegador.
      credentials: 'include',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      ...(signal === undefined ? {} : { signal }),
    });
  } catch (error) {
    return esCancelacionOperaciones(error, signal)
      ? { kind: 'cancelado' }
      : { kind: 'error' };
  }

  if (signal?.aborted === true) {
    return { kind: 'cancelado' };
  }

  const desenlace = desenlaceDeEstado<T>(response.status);

  if (desenlace !== null) {
    return desenlace;
  }

  if (!response.ok) {
    return { kind: 'error' };
  }

  try {
    return { kind: 'ok', datos: (await response.json()) as T };
  } catch {
    return { kind: 'error' };
  }
}

/** Consulta la página del directorio con los filtros indicados. */
export async function consultarProfesionales(
  params: URLSearchParams,
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<ResultadoOperaciones<HospitalProfesionalesListaDto>> {
  return consultar<HospitalProfesionalesListaDto>(
    `${RUTAS_HOSPITAL_PROFESIONALES.listado}?${params.toString()}`,
    fetchImpl,
    signal,
  );
}

/**
 * Consulta el detalle de un profesional por su identificador OPACO.
 *
 * La ventana es opcional: cuando se omite, el SERVIDOR usa su día actual. El
 * reloj del navegador no decide qué registros se leen.
 */
export async function consultarProfesional(
  professionalId: string,
  ventana: HospitalVentanaDto | null,
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<ResultadoOperaciones<HospitalProfesionalDetalleDto>> {
  const ruta = RUTAS_HOSPITAL_PROFESIONALES.detalle(professionalId);
  const consulta =
    ventana === null
      ? ''
      : `?${new URLSearchParams({ from: ventana.from, to: ventana.to }).toString()}`;

  return consultar<HospitalProfesionalDetalleDto>(
    `${ruta}${consulta}`,
    fetchImpl,
    signal,
  );
}
