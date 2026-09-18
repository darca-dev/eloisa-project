import { resolvePublicApiBaseUrl } from '@/config/environment';

import type { PopulationSummary, TerritorySummary } from './municipalityAggregates';

/**
 * Cliente tipado de los agregados municipales
 * (TASK-MUNICIPALITY-CORE-01, FR-02, FR-11 y FR-12).
 *
 * Frontera única entre la experiencia Alcaldía y la API. Reglas:
 * - NO envía tenant, municipio, identificador ni filtro alguno: el contexto lo
 *   resuelve íntegramente el servidor;
 * - NO contiene secretos: la sesión institucional viaja en una cookie
 *   `HttpOnly` que este código no puede leer ni escribir;
 * - NO guarda la respuesta en ningún almacenamiento del navegador ni en la URL,
 *   y pide `cache: 'no-store'` para que tampoco quede en la caché HTTP;
 * - NUNCA lanza: devuelve un desenlace tipado para que la interfaz muestre un
 *   estado accesible y permita reintentar;
 * - NO tiene repliegue a fixtures: un fallo es un fallo, y así se comunica.
 */

const POPULATION_PATH = '/api/v1/municipality/population-summary';
const TERRITORY_PATH = '/api/v1/municipality/territory-summary';

/** Desenlace de una consulta agregada, ya traducido a lenguaje de interfaz. */
export type ResultadoAgregado<T> =
  | { readonly kind: 'ok'; readonly datos: T }
  | { readonly kind: 'no-autorizado' }
  | { readonly kind: 'error' };

async function consultar<T>(
  path: string,
  fetchImpl: typeof fetch,
  signal?: AbortSignal,
): Promise<ResultadoAgregado<T>> {
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
  } catch {
    return { kind: 'error' };
  }

  // `401` y `403` se comunican igual a la interfaz: en ambos casos la persona
  // debe recuperar una sesión institucional válida, y la diferencia no aporta
  // nada que deba deducirse desde el navegador.
  if (response.status === 401 || response.status === 403) {
    return { kind: 'no-autorizado' };
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

/** Consulta el agregado de población beneficiaria del tenant activo. */
export async function fetchPopulationSummary(
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<ResultadoAgregado<PopulationSummary>> {
  return consultar<PopulationSummary>(POPULATION_PATH, fetchImpl, signal);
}

/** Consulta el agregado territorial del tenant activo. */
export async function fetchTerritorySummary(
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<ResultadoAgregado<TerritorySummary>> {
  return consultar<TerritorySummary>(TERRITORY_PATH, fetchImpl, signal);
}

/** Rutas consultadas, expuestas para las pruebas de contrato. */
export const RUTAS_AGREGADOS = {
  poblacion: POPULATION_PATH,
  territorio: TERRITORY_PATH,
} as const;
