import { describe, expect, it } from 'vitest';

import {
  HOSPITAL_FILTROS_VACIOS,
  RUTAS_HOSPITAL_PACIENTES,
  consultarAnalitica,
  consultarDetalle,
  consultarListado,
  filtrosActivos,
  filtrosVacios,
  serializarFiltros,
  serializarListado,
  type HospitalFiltros,
} from './hospitalPatientsClient';

/**
 * Cliente de Hospital · Pacientes (TASK-HOSPITAL-CORE-01 §12.3).
 *
 * Se prueba sin jsdom y sin red, inyectando una implementación de `fetch`: así
 * puede verificarse EXACTAMENTE qué se envía, con qué opciones y cómo se traduce
 * cada código de estado, que es lo que importa para la minimización.
 *
 * Todos los datos son ficticios.
 */

/** Doble de `fetch` que registra las llamadas y devuelve lo indicado. */
function fetchDoble(
  responder: (url: string, init: RequestInit) => Response | Promise<Response>,
): {
  readonly impl: typeof fetch;
  readonly llamadas: { url: string; init: RequestInit }[];
} {
  const llamadas: { url: string; init: RequestInit }[] = [];

  const impl = (async (entrada: unknown, init: RequestInit = {}) => {
    const url = String(entrada);

    llamadas.push({ url, init });

    return responder(url, init);
  }) as unknown as typeof fetch;

  return { impl, llamadas };
}

/** Respuesta JSON correcta. */
function ok(cuerpo: unknown): Response {
  return new Response(JSON.stringify(cuerpo), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Respuesta de error sin cuerpo útil. */
function fallo(status: number): Response {
  return new Response(JSON.stringify({ code: 'X', message: 'Y' }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const FILTROS_COMPLETOS: HospitalFiltros = {
  search: '  Ana   María  ',
  ageMin: '60',
  ageMax: '90',
  epsCode: 'NUEVA_EPS',
  populationType: 'DISABILITY',
  older60: true,
  municipalityOfficialCode: '05001',
  areaType: 'URBAN',
};

describe('serialización de la consulta', () => {
  it('envía únicamente la allowlist del servidor', () => {
    const params = serializarFiltros(FILTROS_COMPLETOS);

    expect([...params.keys()].sort()).toStrictEqual([
      'ageMax',
      'ageMin',
      'areaType',
      'epsCode',
      'municipalityOfficialCode',
      'older60',
      'populationType',
      'search',
    ]);
  });

  it('NUNCA envía tenant, persona ni selección de columnas', () => {
    const consulta = serializarListado(FILTROS_COMPLETOS, 2, 25, 'age', 'desc').toString();

    for (const prohibido of ['tenantId', 'personId', 'select', 'fields', 'orderBy', 'role']) {
      expect(consulta).not.toContain(prohibido);
    }
  });

  it('omite los valores vacíos en lugar de enviarlos en blanco', () => {
    // Enviar `epsCode=` produciría un 400, no «sin filtro de EPS».
    expect(serializarFiltros(HOSPITAL_FILTROS_VACIOS).toString()).toBe('');
  });

  it('normaliza el término de búsqueda antes de enviarlo', () => {
    expect(serializarFiltros(FILTROS_COMPLETOS).get('search')).toBe('Ana María');
  });

  it('solo envía `older60` cuando el chip está activo', () => {
    // Enviar `older60=false` significaría «solo menores de 60»: otro filtro.
    expect(serializarFiltros({ ...FILTROS_COMPLETOS, older60: false }).has('older60')).toBe(
      false,
    );
    expect(serializarFiltros(FILTROS_COMPLETOS).get('older60')).toBe('true');
  });

  it('el listado añade paginación y orden; la analítica no los lleva', () => {
    const listado = serializarListado(HOSPITAL_FILTROS_VACIOS, 3, 100, 'status', 'desc');

    expect(listado.get('page')).toBe('3');
    expect(listado.get('pageSize')).toBe('100');
    expect(listado.get('sort')).toBe('status');
    expect(listado.get('direction')).toBe('desc');

    const analitica = serializarFiltros(HOSPITAL_FILTROS_VACIOS);

    for (const excluido of ['page', 'pageSize', 'sort', 'direction']) {
      expect(analitica.has(excluido)).toBe(false);
    }
  });

  it('cuenta y detecta los filtros activos para el contador visible', () => {
    expect(filtrosVacios(HOSPITAL_FILTROS_VACIOS)).toBe(true);
    expect(filtrosActivos(HOSPITAL_FILTROS_VACIOS)).toBe(0);
    expect(filtrosVacios(FILTROS_COMPLETOS)).toBe(false);
    expect(filtrosActivos(FILTROS_COMPLETOS)).toBe(8);
    // Un término de solo espacios no es un filtro.
    expect(filtrosVacios({ ...HOSPITAL_FILTROS_VACIOS, search: '   ' })).toBe(true);
  });
});

describe('opciones de la petición', () => {
  it('usa credenciales, no-store y solo acepta JSON', async () => {
    const doble = fetchDoble(() => ok({ items: [] }));

    await consultarListado(new URLSearchParams({ page: '1' }), doble.impl);

    const init = doble.llamadas[0]?.init ?? {};

    expect(init.credentials).toBe('include');
    expect(init.cache).toBe('no-store');
    expect(init.method).toBe('GET');
    expect(init.headers).toStrictEqual({ Accept: 'application/json' });
    // La cookie institucional es HttpOnly: este código no puede tocarla.
    expect(JSON.stringify(init)).not.toContain('Cookie');
    expect(JSON.stringify(init)).not.toContain('Authorization');
  });

  it('consulta las tres rutas aprobadas y ninguna más', async () => {
    const doble = fetchDoble(() => ok({}));

    await consultarListado(new URLSearchParams(), doble.impl);
    await consultarAnalitica(new URLSearchParams(), doble.impl);
    await consultarDetalle('019218ab-0000-7000-8000-000000000001', doble.impl);

    const rutas = doble.llamadas.map(({ url }) => new URL(url).pathname);

    expect(rutas).toStrictEqual([
      RUTAS_HOSPITAL_PACIENTES.listado,
      RUTAS_HOSPITAL_PACIENTES.analitica,
      RUTAS_HOSPITAL_PACIENTES.detalle('019218ab-0000-7000-8000-000000000001'),
    ]);
  });

  it('la analítica sin filtros no arrastra una interrogación vacía', async () => {
    const doble = fetchDoble(() => ok({}));

    await consultarAnalitica(new URLSearchParams(), doble.impl);

    expect(doble.llamadas[0]?.url.endsWith('/analytics')).toBe(true);
  });

  it('codifica el identificador del detalle', async () => {
    const doble = fetchDoble(() => ok({}));

    await consultarDetalle('con espacio/y-barra', doble.impl);

    expect(doble.llamadas[0]?.url).toContain('con%20espacio%2Fy-barra');
  });
});

describe('traducción de los desenlaces', () => {
  const casos = [
    [400, 'consulta-invalida'],
    [401, 'sin-sesion'],
    [403, 'sin-permiso'],
    [404, 'no-encontrado'],
    [500, 'error'],
    [503, 'error'],
  ] as const;

  it.each(casos)('traduce %i a «%s»', async (status, esperado) => {
    const doble = fetchDoble(() => fallo(status));
    const resultado = await consultarListado(new URLSearchParams(), doble.impl);

    expect(resultado.kind).toBe(esperado);
  });

  it('devuelve los datos servidos cuando la respuesta es correcta', async () => {
    const cuerpo = { source: 'ELOISA_POSTGRESQL', totalItems: 3, items: [] };
    const doble = fetchDoble(() => ok(cuerpo));
    const resultado = await consultarListado(new URLSearchParams(), doble.impl);

    expect(resultado).toStrictEqual({ kind: 'ok', datos: cuerpo });
  });

  it('un fallo de red no lanza: devuelve «error»', async () => {
    const doble = fetchDoble(() => {
      throw new TypeError('Failed to fetch');
    });

    await expect(consultarListado(new URLSearchParams(), doble.impl)).resolves.toStrictEqual({
      kind: 'error',
    });
  });

  it('un cuerpo que no es JSON válido devuelve «error», no datos a medias', async () => {
    const doble = fetchDoble(
      () => new Response('no-es-json', { status: 200, headers: { 'Content-Type': 'text/plain' } }),
    );

    await expect(consultarListado(new URLSearchParams(), doble.impl)).resolves.toStrictEqual({
      kind: 'error',
    });
  });
});

describe('cancelación', () => {
  it('una consulta abortada devuelve «cancelado», no «error»', async () => {
    const controller = new AbortController();
    const doble = fetchDoble(() => {
      const error = new Error('The operation was aborted.');

      error.name = 'AbortError';

      throw error;
    });

    controller.abort();

    const resultado = await consultarListado(
      new URLSearchParams(),
      doble.impl,
      controller.signal,
    );

    /*
     * La distinción importa: un cambio de filtro cancela la consulta anterior, y
     * pintar «reintentar» en ese momento sería un error de la interfaz, no del
     * servidor.
     */
    expect(resultado.kind).toBe('cancelado');
  });

  it('una respuesta que llega tras el abort se descarta', async () => {
    const controller = new AbortController();
    const doble = fetchDoble(() => {
      // La respuesta llega, pero la señal ya fue abortada entretanto.
      controller.abort();

      return ok({ totalItems: 99 });
    });

    const resultado = await consultarListado(
      new URLSearchParams(),
      doble.impl,
      controller.signal,
    );

    // Una respuesta tardía NO sustituye el estado actual.
    expect(resultado.kind).toBe('cancelado');
  });

  it('propaga la señal a la petición para que el navegador pueda abortarla', async () => {
    const controller = new AbortController();
    const doble = fetchDoble(() => ok({}));

    await consultarListado(new URLSearchParams(), doble.impl, controller.signal);

    expect(doble.llamadas[0]?.init.signal).toBe(controller.signal);
  });
});
