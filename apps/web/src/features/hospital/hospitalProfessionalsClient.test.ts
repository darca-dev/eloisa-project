import { describe, expect, it } from 'vitest';

import {
  HOSPITAL_PROFESIONALES_FILTROS_VACIOS,
  RUTAS_HOSPITAL_PROFESIONALES,
  consultarProfesional,
  consultarProfesionales,
  filtrosProfesionalesActivos,
  filtrosProfesionalesVacios,
  serializarFiltrosProfesionales,
  serializarProfesionales,
  type HospitalProfesionalesFiltros,
} from './hospitalProfessionalsClient';

/**
 * Cliente de Hospital · Profesionales
 * (TASK-HOSPITAL-CORE-02, paquete final de corrección §6.2).
 *
 * Se prueba sin jsdom y sin red, inyectando una implementación de `fetch`: así
 * puede verificarse EXACTAMENTE qué se envía, con qué opciones y cómo se traduce
 * cada código de estado, que es lo que importa para la minimización.
 *
 * Todos los datos son ficticios.
 */

/** Doble de `fetch` que registra las llamadas y devuelve lo indicado. */
function fetchDoble(responder: (url: string, init: RequestInit) => Response): {
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

function ok(cuerpo: unknown): Response {
  return new Response(JSON.stringify(cuerpo), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function fallo(status: number): Response {
  return new Response(JSON.stringify({ code: 'X', message: 'Y' }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const FILTROS_COMPLETOS: HospitalProfesionalesFiltros = {
  search: '  Ana   María  ',
  professionCode: 'MEDICINA_GENERAL',
  affiliationType: 'EMPLOYEE',
  status: 'ACTIVE',
};

const LISTA = {
  source: 'ELOISA_POSTGRESQL',
  generatedAt: '2026-08-22T15:04:05.000Z',
  page: 1,
  pageSize: 25,
  totalItems: 1,
  totalPages: 1,
  items: [
    {
      professionalId: '019287a1-0000-7000-8000-000000000001',
      fullName: 'Ana María Ejemplo Ficticio',
      initials: 'AE',
      professionCode: 'MEDICINA_GENERAL',
      professionName: 'Medicina general',
      status: 'ACTIVE',
      activeAffiliation: {
        engagementType: 'EMPLOYEE',
        status: 'ACTIVE',
        startsOn: '2026-01-15',
        endsOn: null,
      },
      activePatientCount: 2,
      todayAppointmentCount: 1,
      nextAppointmentAt: '2026-08-22T15:00:00.000Z',
      ratingAvailability: 'No disponible',
    },
  ],
};

describe('serialización de la consulta del directorio', () => {
  it('serializa exactamente la allowlist del servidor', () => {
    const params = serializarFiltrosProfesionales(FILTROS_COMPLETOS);

    expect([...params.entries()].sort()).toStrictEqual([
      ['affiliationType', 'EMPLOYEE'],
      ['professionCode', 'MEDICINA_GENERAL'],
      ['search', 'Ana María'],
      ['status', 'ACTIVE'],
    ]);
  });

  it('OMITE los valores vacíos en lugar de enviarlos en blanco', () => {
    const params = serializarFiltrosProfesionales(HOSPITAL_PROFESIONALES_FILTROS_VACIOS);

    expect([...params.keys()]).toStrictEqual([]);
  });

  it('nunca envía tenant, rol, actor ni identificador de persona', () => {
    const consulta = serializarProfesionales(
      FILTROS_COMPLETOS,
      2,
      50,
      'profession',
      'desc',
    ).toString();

    for (const prohibido of [
      'tenantId',
      'identityId',
      'personId',
      'role',
      'actor',
      'select',
      'fields',
      'rating',
      'zona',
      'availability',
    ]) {
      expect(consulta).not.toContain(prohibido);
    }

    expect(consulta).toContain('page=2');
    expect(consulta).toContain('pageSize=50');
    expect(consulta).toContain('sort=profession');
    expect(consulta).toContain('direction=desc');
  });

  it('cuenta los criterios activos y reconoce la consulta vacía', () => {
    expect(filtrosProfesionalesVacios(HOSPITAL_PROFESIONALES_FILTROS_VACIOS)).toBe(true);
    expect(filtrosProfesionalesVacios({ ...HOSPITAL_PROFESIONALES_FILTROS_VACIOS, search: '  ' })).toBe(
      true,
    );
    expect(filtrosProfesionalesActivos(HOSPITAL_PROFESIONALES_FILTROS_VACIOS)).toBe(0);
    expect(filtrosProfesionalesActivos(FILTROS_COMPLETOS)).toBe(4);
  });
});

describe('consulta del directorio', () => {
  it('llama a la ruta aprobada con credenciales y sin caché', async () => {
    const { impl, llamadas } = fetchDoble(() => ok(LISTA));
    const params = serializarProfesionales(
      HOSPITAL_PROFESIONALES_FILTROS_VACIOS,
      1,
      25,
      'name',
      'asc',
    );

    const resultado = await consultarProfesionales(params, impl);

    expect(resultado).toStrictEqual({ kind: 'ok', datos: LISTA });
    expect(llamadas).toHaveLength(1);
    expect(llamadas[0]?.url).toContain(RUTAS_HOSPITAL_PROFESIONALES.listado);
    expect(llamadas[0]?.init.method).toBe('GET');
    expect(llamadas[0]?.init.credentials).toBe('include');
    expect(llamadas[0]?.init.cache).toBe('no-store');
    // La cookie institucional la administra el navegador: no se escribe aquí.
    expect(JSON.stringify(llamadas[0]?.init.headers)).not.toContain('Cookie');
  });

  it('traduce cada código de estado a su desenlace tipado', async () => {
    const esperado = [
      [400, 'consulta-invalida'],
      [401, 'sin-sesion'],
      [403, 'sin-permiso'],
      [404, 'no-encontrado'],
      [503, 'no-disponible'],
      [500, 'error'],
    ] as const;

    for (const [status, kind] of esperado) {
      const { impl } = fetchDoble(() => fallo(status));
      const resultado = await consultarProfesionales(new URLSearchParams(), impl);

      expect(resultado.kind).toBe(kind);
    }
  });

  it('un fallo de red y una respuesta inválida son error, no datos', async () => {
    const red = (async () => {
      throw new TypeError('sin conexión');
    }) as unknown as typeof fetch;

    expect((await consultarProfesionales(new URLSearchParams(), red)).kind).toBe('error');

    const { impl } = fetchDoble(
      () => new Response('no es json', { status: 200 }),
    );

    expect((await consultarProfesionales(new URLSearchParams(), impl)).kind).toBe('error');
  });

  it('propaga el `AbortSignal` y distingue la cancelación del error', async () => {
    const control = new AbortController();
    const { impl, llamadas } = fetchDoble(() => ok(LISTA));

    control.abort();

    const resultado = await consultarProfesionales(new URLSearchParams(), impl, control.signal);

    expect(resultado.kind).toBe('cancelado');
    expect(llamadas[0]?.init.signal).toBe(control.signal);
  });

  it('una excepción de aborto tampoco se presenta como error', async () => {
    const abortado = (async () => {
      const error = new Error('abort');

      error.name = 'AbortError';
      throw error;
    }) as unknown as typeof fetch;

    expect((await consultarProfesionales(new URLSearchParams(), abortado)).kind).toBe(
      'cancelado',
    );
  });
});

describe('consulta del detalle profesional', () => {
  const ID = '019287a1-0000-7000-8000-000000000001';

  it('sin ventana deja que el SERVIDOR use su día actual', async () => {
    const { impl, llamadas } = fetchDoble(() => ok({ ...LISTA.items[0], window: {} }));

    await consultarProfesional(ID, null, impl);

    expect(llamadas[0]?.url).toContain(RUTAS_HOSPITAL_PROFESIONALES.detalle(ID));
    expect(llamadas[0]?.url).not.toContain('from=');
    expect(llamadas[0]?.url).not.toContain('to=');
  });

  it('con ventana envía exactamente `from` y `to`', async () => {
    const { impl, llamadas } = fetchDoble(() => ok({}));

    await consultarProfesional(ID, { from: '2026-08-01', to: '2026-08-31' }, impl);

    expect(llamadas[0]?.url).toContain('from=2026-08-01');
    expect(llamadas[0]?.url).toContain('to=2026-08-31');
  });

  it('codifica el identificador y devuelve 404 como no encontrado', async () => {
    const { impl, llamadas } = fetchDoble(() => fallo(404));

    const resultado = await consultarProfesional('a b/c', null, impl);

    expect(resultado.kind).toBe('no-encontrado');
    expect(llamadas[0]?.url).toContain('a%20b%2Fc');
  });
});
