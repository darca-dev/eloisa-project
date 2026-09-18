import { resolvePublicApiBaseUrl } from '@/config/environment';

/**
 * Cliente tipado de la superficie Hospital · Pacientes
 * (TASK-HOSPITAL-CORE-01 §8 y §10).
 *
 * Frontera ÚNICA entre la vista Hospital → Pacientes y la API. Reglas:
 *
 * - NO envía tenant, institución ni identificador de persona: el contexto lo
 *   resuelve íntegramente el servidor y la API rechaza esos parámetros;
 * - serializa EXCLUSIVAMENTE la allowlist declarada aquí, y omite todo valor
 *   vacío: un parámetro que el servidor no espera produce `400`, de modo que
 *   enviarlo «por si acaso» rompería la consulta;
 * - NO contiene secretos: la sesión institucional viaja en una cookie
 *   `HttpOnly` que este código no puede leer ni escribir;
 * - NO guarda nada en ningún almacenamiento web del navegador, en ninguna
 *   caché de trabajador de servicio ni en la URL, y pide `cache: 'no-store'`
 *   para que la respuesta —que es NOMINAL— no quede en ninguna caché
 *   compartida;
 * - NUNCA lanza: devuelve un desenlace tipado para que la interfaz muestre un
 *   estado accesible y permita reintentar;
 * - NO tiene repliegue a fixtures: un fallo es un fallo, y así se comunica. La
 *   vista jamás sustituye un error por cifras de demostración.
 *
 * `fetchImpl` se recibe por parámetro, con `fetch` como valor por defecto. Es
 * lo que permite probar la serialización, la cancelación y el manejo de cada
 * código de estado sin jsdom y sin red, que es como se prueba el resto del
 * frontend de este repositorio.
 */

/* -------------------------------------------------------------------------- */
/* Contrato de respuesta                                                       */
/* -------------------------------------------------------------------------- */

/** Procedencia común a las tres lecturas. La fija SIEMPRE el servidor. */
export interface HospitalProcedenciaDto {
  readonly source: string;
  /** Fecha de corte `AAAA-MM-DD` en UTC. La UI no la calcula ni la inventa. */
  readonly asOfDate: string;
  readonly generatedAt: string;
}

export interface HospitalPrioridadesDto {
  readonly older60: boolean;
  readonly disabilityDeclared: boolean;
  readonly homeCareRequiredDeclared: boolean;
}

export interface HospitalTerritorioDto {
  readonly municipalityOfficialCode: string | null;
  readonly municipalityName: string | null;
  readonly areaType: 'URBAN' | 'RURAL' | null;
  readonly localUnitName: string | null;
  readonly pendingNormalization: boolean;
}

export interface HospitalPacienteListadoDto {
  readonly patientId: string;
  readonly fullName: string;
  readonly initials: string;
  readonly documentMasked: string;
  readonly age: number;
  readonly epsCode: string;
  readonly epsName: string;
  readonly priorities: HospitalPrioridadesDto;
  readonly territory: HospitalTerritorioDto;
  readonly status: string;
  readonly statusLabel: string;
}

export interface HospitalListadoDto extends HospitalProcedenciaDto {
  readonly page: number;
  readonly pageSize: number;
  readonly totalItems: number;
  readonly totalPages: number;
  readonly items: readonly HospitalPacienteListadoDto[];
}

export interface HospitalDetalleDto extends HospitalProcedenciaDto {
  readonly patientId: string;
  readonly fullName: string;
  readonly initials: string;
  readonly documentType: string;
  readonly documentTypeLabel: string;
  readonly documentMasked: string;
  readonly birthDate: string;
  readonly age: number;
  readonly epsCode: string;
  readonly epsName: string;
  readonly priorities: HospitalPrioridadesDto;
  readonly territory: HospitalTerritorioDto;
  readonly status: string;
  readonly statusLabel: string;
  readonly contactAvailability: string;
}

export interface HospitalCeldaDto {
  readonly key: string;
  readonly label: string;
  readonly value: number;
  /** `null` cuando el denominador es cero. La UI escribe «Sin datos». */
  readonly percentage: number | null;
}

export interface HospitalDistribucionDto {
  readonly id: string;
  readonly label: string;
  readonly cells: readonly HospitalCeldaDto[];
}

export interface HospitalInterseccionDto extends HospitalCeldaDto {
  readonly older60: boolean;
  readonly disabilityDeclared: boolean;
  readonly homeCareRequiredDeclared: boolean;
}

export interface HospitalAnaliticaDto extends HospitalProcedenciaDto {
  readonly definitionVersion: string;
  readonly activeUniverse: number;
  readonly filteredUniverse: number;
  readonly keyFigures: readonly HospitalCeldaDto[];
  readonly distributions: readonly HospitalDistribucionDto[];
  readonly intersections: readonly HospitalInterseccionDto[];
}

/* -------------------------------------------------------------------------- */
/* Consulta                                                                    */
/* -------------------------------------------------------------------------- */

/** Tamaños de página admitidos por el servidor. */
export const HOSPITAL_TAMANOS_PAGINA = [25, 50, 100] as const;

export const HOSPITAL_TAMANO_PAGINA_INICIAL = 50;

/** Criterios de orden SOPORTADOS por la API. */
export const HOSPITAL_ORDENES = ['name', 'age', 'status'] as const;

export type HospitalOrdenId = (typeof HOSPITAL_ORDENES)[number];

export type HospitalSentido = 'asc' | 'desc';

/**
 * Filtros que la API acepta.
 *
 * Es la lista COMPLETA de lo que la vista puede enviar. Los filtros de la
 * composición aprobada que dependen de dominios ausentes de CORE-01
 * —patología, profesional, cuidador, programa— NO figuran aquí a propósito:
 * permanecen visibles y deshabilitados en la interfaz y jamás se serializan.
 */
export interface HospitalFiltros {
  readonly search: string;
  readonly ageMin: string;
  readonly ageMax: string;
  readonly epsCode: string;
  readonly populationType: '' | 'DISABILITY' | 'HOME_CARE_REQUIRED';
  readonly older60: boolean;
  readonly municipalityOfficialCode: string;
  readonly areaType: '' | 'URBAN' | 'RURAL';
}

/** Consulta vacía: sin recorte alguno. */
export const HOSPITAL_FILTROS_VACIOS: HospitalFiltros = {
  search: '',
  ageMin: '',
  ageMax: '',
  epsCode: '',
  populationType: '',
  older60: false,
  municipalityOfficialCode: '',
  areaType: '',
};

/** `true` cuando la consulta no aplica ningún recorte. */
export function filtrosVacios(filtros: HospitalFiltros): boolean {
  return (
    filtros.search.trim() === '' &&
    filtros.ageMin === '' &&
    filtros.ageMax === '' &&
    filtros.epsCode === '' &&
    filtros.populationType === '' &&
    !filtros.older60 &&
    filtros.municipalityOfficialCode === '' &&
    filtros.areaType === ''
  );
}

/** Número de criterios activos. Alimenta el contador visible de la vista. */
export function filtrosActivos(filtros: HospitalFiltros): number {
  return (
    [
      filtros.search.trim(),
      filtros.ageMin,
      filtros.ageMax,
      filtros.epsCode,
      filtros.populationType,
      filtros.municipalityOfficialCode,
      filtros.areaType,
    ].filter((valor) => valor !== '').length + (filtros.older60 ? 1 : 0)
  );
}

/**
 * Serializa los filtros a la allowlist del servidor.
 *
 * Un valor vacío se OMITE en lugar de enviarse en blanco: la API rechaza los
 * parámetros mal formados, de modo que enviar `epsCode=` produciría un `400` en
 * vez de «sin filtro de EPS».
 *
 * `older60` solo se envía cuando está activo. El chip de la interfaz es un
 * interruptor de dos posiciones —aplicado o no aplicado—, no un selector de
 * tres, y enviar `older60=false` significaría «solo menores de 60», que es un
 * filtro distinto del que la persona activó.
 */
export function serializarFiltros(filtros: HospitalFiltros): URLSearchParams {
  const params = new URLSearchParams();
  const search = filtros.search.replace(/\s+/gu, ' ').trim();

  if (search !== '') {
    params.set('search', search);
  }

  for (const [nombre, valor] of [
    ['ageMin', filtros.ageMin],
    ['ageMax', filtros.ageMax],
    ['epsCode', filtros.epsCode],
    ['populationType', filtros.populationType],
    ['municipalityOfficialCode', filtros.municipalityOfficialCode],
    ['areaType', filtros.areaType],
  ] as const) {
    if (valor !== '') {
      params.set(nombre, valor);
    }
  }

  if (filtros.older60) {
    params.set('older60', 'true');
  }

  return params;
}

/** Consulta completa del listado, con paginación y orden. */
export function serializarListado(
  filtros: HospitalFiltros,
  pagina: number,
  tamano: number,
  orden: HospitalOrdenId,
  sentido: HospitalSentido,
): URLSearchParams {
  const params = serializarFiltros(filtros);

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
export type ResultadoHospital<T> =
  | { readonly kind: 'ok'; readonly datos: T }
  | { readonly kind: 'sin-sesion' }
  | { readonly kind: 'sin-permiso' }
  | { readonly kind: 'no-encontrado' }
  | { readonly kind: 'consulta-invalida' }
  | { readonly kind: 'cancelado' }
  | { readonly kind: 'error' };

const BASE = '/api/v1/hospital/patients';

/** Rutas consultadas, expuestas para las pruebas de contrato. */
export const RUTAS_HOSPITAL_PACIENTES = {
  listado: BASE,
  analitica: `${BASE}/analytics`,
  detalle: (patientId: string): string => `${BASE}/${encodeURIComponent(patientId)}`,
} as const;

async function consultar<T>(
  path: string,
  fetchImpl: typeof fetch,
  signal?: AbortSignal,
): Promise<ResultadoHospital<T>> {
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
    /*
     * Una cancelación no es un fallo: ocurre en cada cambio de filtro. Se
     * distingue del error de red para que la vista no muestre «reintentar»
     * cuando en realidad ya hay otra consulta en curso.
     */
    return esCancelacion(error, signal) ? { kind: 'cancelado' } : { kind: 'error' };
  }

  if (signal?.aborted === true) {
    return { kind: 'cancelado' };
  }

  /*
   * `401` y `403` se distinguen porque la acción de la persona es distinta: sin
   * sesión hay que abrirla; con sesión pero sin permiso, no hay nada que hacer
   * desde la interfaz. Ninguno de los dos revela por qué.
   */
  if (response.status === 401) {
    return { kind: 'sin-sesion' };
  }

  if (response.status === 403) {
    return { kind: 'sin-permiso' };
  }

  if (response.status === 404) {
    return { kind: 'no-encontrado' };
  }

  if (response.status === 400) {
    return { kind: 'consulta-invalida' };
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

/** Distingue un abort deliberado de un fallo real de red. */
function esCancelacion(error: unknown, signal?: AbortSignal): boolean {
  if (signal?.aborted === true) {
    return true;
  }

  return error instanceof Error && error.name === 'AbortError';
}

/** Consulta la página del listado con los filtros indicados. */
export async function consultarListado(
  params: URLSearchParams,
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<ResultadoHospital<HospitalListadoDto>> {
  return consultar<HospitalListadoDto>(
    `${RUTAS_HOSPITAL_PACIENTES.listado}?${params.toString()}`,
    fetchImpl,
    signal,
  );
}

/** Consulta la analítica del MISMO conjunto filtrado que el listado. */
export async function consultarAnalitica(
  params: URLSearchParams,
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<ResultadoHospital<HospitalAnaliticaDto>> {
  const consulta = params.toString();

  return consultar<HospitalAnaliticaDto>(
    consulta === ''
      ? RUTAS_HOSPITAL_PACIENTES.analitica
      : `${RUTAS_HOSPITAL_PACIENTES.analitica}?${consulta}`,
    fetchImpl,
    signal,
  );
}

/** Consulta el detalle de un paciente por su identificador OPACO. */
export async function consultarDetalle(
  patientId: string,
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<ResultadoHospital<HospitalDetalleDto>> {
  return consultar<HospitalDetalleDto>(
    RUTAS_HOSPITAL_PACIENTES.detalle(patientId),
    fetchImpl,
    signal,
  );
}
