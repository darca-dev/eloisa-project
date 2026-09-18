import { describe, expect, it } from 'vitest';

import {
  RUTAS_AGREGADOS,
  fetchPopulationSummary,
  fetchTerritorySummary,
} from './municipalityAggregatesClient';

/**
 * Cliente de los agregados municipales
 * (TASK-MUNICIPALITY-CORE-01, FR-02, FR-11, FR-12 y prueba T-10).
 *
 * Se verifica el contrato de la llamada y la traducción de cada desenlace. No
 * se abre ninguna conexión real: el `fetch` se sustituye por un doble que
 * registra lo que el cliente pidió.
 */

interface Llamada {
  readonly url: string;
  readonly init: RequestInit;
}

function fetchDoble(
  responder: () => Response | Promise<Response>,
  llamadas: Llamada[] = [],
): { readonly fetchImpl: typeof fetch; readonly llamadas: Llamada[] } {
  const fetchImpl = (async (
    entrada: string | URL | Request,
    init: RequestInit = {},
  ): Promise<Response> => {
    llamadas.push({ url: String(entrada), init });

    return responder();
  }) as unknown as typeof fetch;

  return { fetchImpl, llamadas };
}

function respuestaJson(datos: unknown, status = 200): Response {
  return new Response(JSON.stringify(datos), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('contrato de la llamada', () => {
  it('consulta la ruta agregada con la cookie institucional y sin caché', async () => {
    const { fetchImpl, llamadas } = fetchDoble(() =>
      respuestaJson({ source: 'ELOISA_POSTGRESQL' }),
    );

    await fetchPopulationSummary(fetchImpl);

    const llamada = llamadas[0]!;

    expect(llamada.url).toContain(RUTAS_AGREGADOS.poblacion);
    expect(llamada.init.method).toBe('GET');
    expect(llamada.init.credentials).toBe('include');
    expect(llamada.init.cache).toBe('no-store');
  });

  it('no envía tenant, municipio, filtro ni cuerpo', async () => {
    const { fetchImpl, llamadas } = fetchDoble(() => respuestaJson({}));

    await fetchTerritorySummary(fetchImpl);

    const llamada = llamadas[0]!;

    expect(llamada.url).toBe(`http://127.0.0.1:3001${RUTAS_AGREGADOS.territorio}`);
    expect(llamada.url).not.toContain('?');
    expect(llamada.init.body).toBeUndefined();
    expect(JSON.stringify(llamada.init.headers)).not.toContain('tenant');
  });

  it('propaga la señal de cancelación cuando se aporta', async () => {
    const controller = new AbortController();
    const { fetchImpl, llamadas } = fetchDoble(() => respuestaJson({}));

    await fetchPopulationSummary(fetchImpl, controller.signal);

    expect(llamadas[0]?.init.signal).toBe(controller.signal);
  });
});

describe('traducción de desenlaces', () => {
  it('devuelve los datos cuando la respuesta es correcta', async () => {
    const datos = { source: 'ELOISA_POSTGRESQL', asOfDate: '2026-08-22' };
    const { fetchImpl } = fetchDoble(() => respuestaJson(datos));

    const resultado = await fetchPopulationSummary(fetchImpl);

    expect(resultado.kind).toBe('ok');

    if (resultado.kind === 'ok') {
      expect(resultado.datos.source).toBe('ELOISA_POSTGRESQL');
    }
  });

  it('trata 401 y 403 como sesión no vigente, sin distinguirlos', async () => {
    for (const status of [401, 403]) {
      const { fetchImpl } = fetchDoble(() => respuestaJson({ code: 'X' }, status));

      await expect(fetchTerritorySummary(fetchImpl)).resolves.toStrictEqual({
        kind: 'no-autorizado',
      });
    }
  });

  it('trata cualquier otro fallo como error recuperable', async () => {
    for (const status of [400, 429, 500, 503]) {
      const { fetchImpl } = fetchDoble(() => respuestaJson({}, status));

      await expect(fetchPopulationSummary(fetchImpl)).resolves.toStrictEqual({
        kind: 'error',
      });
    }
  });

  it('no lanza cuando la red falla', async () => {
    const fetchImpl = (async () => {
      throw new Error('fallo de red simulado');
    }) as unknown as typeof fetch;

    await expect(fetchTerritorySummary(fetchImpl)).resolves.toStrictEqual({
      kind: 'error',
    });
  });

  it('no lanza cuando el cuerpo no es JSON válido', async () => {
    const { fetchImpl } = fetchDoble(
      () => new Response('no es json', { status: 200 }),
    );

    await expect(fetchPopulationSummary(fetchImpl)).resolves.toStrictEqual({
      kind: 'error',
    });
  });

  it('nunca devuelve un repliegue a datos de diseño', async () => {
    const { fetchImpl } = fetchDoble(() => respuestaJson({}, 500));

    const resultado = await fetchPopulationSummary(fetchImpl);

    expect(resultado).not.toHaveProperty('datos');
  });
});
