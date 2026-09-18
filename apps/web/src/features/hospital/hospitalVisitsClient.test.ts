import { describe, expect, it } from 'vitest';

import {
  HOSPITAL_VISITA_DESTINOS,
  RUTAS_HOSPITAL_VISITAS,
  cambiarEstadoVisita,
  consultarVisitaProfesional,
  desenlaceDeEstadoVisita,
  materializarVisita,
  mensajeDeVisita,
  requiereRefrescoDeVisita,
  type ResultadoVisita,
} from './hospitalVisitsClient';

/**
 * Cliente de Visitas domiciliarias
 * (HOSPITAL-VISITS-01 packet A, sobre VISITS-CORE-01 MP04).
 *
 * Se prueba sin jsdom y sin red, inyectando una implementación de `fetch`: así
 * puede verificarse EXACTAMENTE qué ruta se llama, con qué método, qué cuerpo
 * viaja y cómo se traduce cada código de estado, que es lo que importa para la
 * minimización y para que la interfaz nunca vea un detalle técnico.
 *
 * Todos los identificadores son ficticios.
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

function respuesta(status: number, cuerpo: unknown): Response {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Fallo del servidor, con el cuerpo estable del contrato. */
function fallo(status: number, code: string): Response {
  return respuesta(status, { code, message: 'Mensaje del servidor.' });
}

const VISITA_ID = '0191f1a0-0000-7000-8000-000000000010';
const CITA_ID = '0191f1a0-0000-7000-8000-000000000001';

const MATERIALIZADA = {
  homeVisitId: VISITA_ID,
  appointmentId: CITA_ID,
  status: 'SCHEDULED',
  version: 1,
  creationTransitionId: '0191f1a0-0000-7000-8000-000000000020',
  createdAt: '2026-08-24T16:00:00.000Z',
};

const VISITA = {
  homeVisitId: VISITA_ID,
  appointmentId: CITA_ID,
  status: 'SCHEDULED',
  version: 1,
  startedAt: null,
  endedAt: null,
  createdAt: '2026-08-24T16:00:00.000Z',
  updatedAt: '2026-08-24T16:00:00.000Z',
};

const TRANSICION = {
  homeVisitId: VISITA_ID,
  fromStatus: 'SCHEDULED',
  toStatus: 'IN_PROGRESS',
  version: 2,
  transitionId: '0191f1a0-0000-7000-8000-000000000021',
  occurredAt: '2026-08-24T16:30:00.000Z',
};

/**
 * Campos de AUTORIDAD que ninguna petición puede llevar.
 *
 * El servidor los rechaza con `400`, pero la garantía real es que este cliente
 * no tiene forma de producirlos: `professionalId` sería exactamente la vía por
 * la que alguien ejecutaría la visita de otra persona.
 */
const CAMPOS_DE_AUTORIDAD = [
  'tenantId',
  'patientId',
  'professionalId',
  'identityId',
  'careAssignmentId',
  'actor',
  'role',
  'now',
  'occurredAt',
  'startedAt',
  'endedAt',
  'reason',
  'note',
  'evidence',
];

describe('rutas de MP04', () => {
  it('son EXACTAMENTE las tres del contrato', () => {
    expect(RUTAS_HOSPITAL_VISITAS.materializar).toBe('/api/v1/visits/materialize');
    expect(RUTAS_HOSPITAL_VISITAS.visita(VISITA_ID)).toBe(
      `/api/v1/professional/visits/${VISITA_ID}`,
    );
    expect(RUTAS_HOSPITAL_VISITAS.estado(VISITA_ID)).toBe(
      `/api/v1/professional/visits/${VISITA_ID}/status`,
    );
  });

  it('codifica el identificador recibido en lugar de interpolarlo crudo', () => {
    expect(RUTAS_HOSPITAL_VISITAS.visita('a b/c')).toContain('a%20b%2Fc');
    expect(RUTAS_HOSPITAL_VISITAS.estado('a b/c')).toContain('a%20b%2Fc');
  });

  it('no expone ninguna operación de listado ni de búsqueda', () => {
    expect(Object.keys(RUTAS_HOSPITAL_VISITAS).sort()).toStrictEqual([
      'estado',
      'materializar',
      'visita',
    ]);
  });
});

describe('materialización de la visita', () => {
  it('llama a la ruta aprobada con credenciales, sin caché y con el cuerpo exacto', async () => {
    const { impl, llamadas } = fetchDoble(() => respuesta(201, MATERIALIZADA));

    const resultado = await materializarVisita(CITA_ID, impl);

    expect(resultado).toStrictEqual({ kind: 'ok', datos: MATERIALIZADA });
    expect(llamadas).toHaveLength(1);
    expect(llamadas[0]?.url).toContain(RUTAS_HOSPITAL_VISITAS.materializar);
    expect(llamadas[0]?.init.method).toBe('POST');
    expect(llamadas[0]?.init.credentials).toBe('include');
    expect(llamadas[0]?.init.cache).toBe('no-store');
    expect(llamadas[0]?.init.body).toBe(JSON.stringify({ appointmentId: CITA_ID }));
    // La cookie institucional la administra el navegador: no se escribe aquí.
    expect(JSON.stringify(llamadas[0]?.init.headers)).not.toContain('Cookie');
  });

  it('el cuerpo lleva UN solo campo y ninguno de autoridad', async () => {
    const { impl, llamadas } = fetchDoble(() => respuesta(201, MATERIALIZADA));

    await materializarVisita(CITA_ID, impl);

    const cuerpo = JSON.parse(String(llamadas[0]?.init.body)) as Record<string, unknown>;

    expect(Object.keys(cuerpo)).toStrictEqual(['appointmentId']);

    for (const prohibido of CAMPOS_DE_AUTORIDAD) {
      expect(Object.keys(cuerpo)).not.toContain(prohibido);
    }
  });

  it('traduce cada código de estado a su desenlace tipado', async () => {
    const esperado = [
      [400, 'solicitud-invalida'],
      [401, 'sin-sesion'],
      [403, 'sin-permiso'],
      [404, 'no-encontrado'],
      [409, 'conflicto'],
      [503, 'no-disponible'],
      [500, 'no-disponible'],
    ] as const;

    for (const [status, kind] of esperado) {
      const { impl } = fetchDoble(() => fallo(status, 'CODIGO_ESTABLE'));

      expect((await materializarVisita(CITA_ID, impl)).kind).toBe(kind);
    }
  });

  it('los DOS conflictos de materialización comparten desenlace y mensaje', async () => {
    /*
     * `HOME_VISIT_APPOINTMENT_NOT_MATERIALIZABLE` y
     * `HOME_VISIT_ALREADY_MATERIALIZED` no se distinguen en la interfaz: ninguno
     * describe qué regla concreta falló, y la acción es la misma en ambos.
     */
    const noMaterializable = fetchDoble(() =>
      fallo(409, 'HOME_VISIT_APPOINTMENT_NOT_MATERIALIZABLE'),
    );
    const yaMaterializada = fetchDoble(() => fallo(409, 'HOME_VISIT_ALREADY_MATERIALIZED'));

    const uno = await materializarVisita(CITA_ID, noMaterializable.impl);
    const otro = await materializarVisita(CITA_ID, yaMaterializada.impl);

    expect(uno).toStrictEqual({ kind: 'conflicto' });
    expect(otro).toStrictEqual({ kind: 'conflicto' });
    expect(mensajeDeVisita(uno)).toBe(mensajeDeVisita(otro));
  });
});

describe('consulta de la visita profesional', () => {
  it('llama a la ruta aprobada, sin cuerpo y sin ningún parámetro de consulta', async () => {
    const { impl, llamadas } = fetchDoble(() => respuesta(200, VISITA));

    const resultado = await consultarVisitaProfesional(VISITA_ID, impl);

    expect(resultado).toStrictEqual({ kind: 'ok', datos: VISITA });
    expect(llamadas[0]?.url).toContain(RUTAS_HOSPITAL_VISITAS.visita(VISITA_ID));
    expect(llamadas[0]?.url).not.toContain('?');
    expect(llamadas[0]?.init.method).toBe('GET');
    expect(llamadas[0]?.init.credentials).toBe('include');
    expect(llamadas[0]?.init.cache).toBe('no-store');
    expect(llamadas[0]?.init.body).toBeUndefined();
  });

  it('la URL no lleva profesional, paciente ni institución', async () => {
    const { impl, llamadas } = fetchDoble(() => respuesta(200, VISITA));

    await consultarVisitaProfesional(VISITA_ID, impl);

    for (const prohibido of CAMPOS_DE_AUTORIDAD) {
      expect(llamadas[0]?.url).not.toContain(prohibido);
    }
  });

  it('devuelve estado y versión tal como los da el servidor', async () => {
    const { impl } = fetchDoble(() => respuesta(200, { ...VISITA, status: 'IN_PROGRESS', version: 2 }));

    const resultado = await consultarVisitaProfesional(VISITA_ID, impl);

    expect(resultado.kind).toBe('ok');

    if (resultado.kind === 'ok') {
      expect(resultado.datos.status).toBe('IN_PROGRESS');
      expect(resultado.datos.version).toBe(2);
    }
  });

  it('traduce cada código de estado a su desenlace tipado', async () => {
    const esperado = [
      [400, 'solicitud-invalida'],
      [401, 'sin-sesion'],
      [403, 'sin-permiso'],
      [404, 'no-encontrado'],
      [503, 'no-disponible'],
      [500, 'no-disponible'],
    ] as const;

    for (const [status, kind] of esperado) {
      const { impl } = fetchDoble(() => fallo(status, 'CODIGO_ESTABLE'));

      expect((await consultarVisitaProfesional(VISITA_ID, impl)).kind).toBe(kind);
    }
  });

  it('un `404` no confirma ni niega la existencia de la visita', async () => {
    const { impl } = fetchDoble(() => fallo(404, 'HOME_VISIT_NOT_FOUND'));

    const resultado = await consultarVisitaProfesional(VISITA_ID, impl);

    expect(resultado).toStrictEqual({ kind: 'no-encontrado' });
    expect(mensajeDeVisita(resultado)).toBe('La visita no está disponible en este momento.');
  });
});

describe('cambio de estado de la visita', () => {
  it('envía EXACTAMENTE `status` y `expectedVersion`', async () => {
    const { impl, llamadas } = fetchDoble(() => respuesta(200, TRANSICION));

    const resultado = await cambiarEstadoVisita(VISITA_ID, 'IN_PROGRESS', 1, impl);

    expect(resultado).toStrictEqual({ kind: 'ok', datos: TRANSICION });
    expect(llamadas[0]?.url).toContain(RUTAS_HOSPITAL_VISITAS.estado(VISITA_ID));
    expect(llamadas[0]?.init.method).toBe('PATCH');
    expect(llamadas[0]?.init.credentials).toBe('include');
    expect(llamadas[0]?.init.cache).toBe('no-store');

    const cuerpo = JSON.parse(String(llamadas[0]?.init.body)) as Record<string, unknown>;

    expect(Object.keys(cuerpo).sort()).toStrictEqual(['expectedVersion', 'status']);
    expect(cuerpo['status']).toBe('IN_PROGRESS');
    expect(cuerpo['expectedVersion']).toBe(1);
  });

  it('ningún campo de autoridad viaja en el cuerpo, sea cual sea el destino', async () => {
    for (const destino of HOSPITAL_VISITA_DESTINOS) {
      const { impl, llamadas } = fetchDoble(() => respuesta(200, TRANSICION));

      await cambiarEstadoVisita(VISITA_ID, destino, 3, impl);

      const cuerpo = String(llamadas[0]?.init.body);

      expect(cuerpo).toContain(destino);

      for (const prohibido of CAMPOS_DE_AUTORIDAD) {
        expect(cuerpo).not.toContain(prohibido);
      }
    }
  });

  it('los tres destinos son los del contrato y `SCHEDULED` no está entre ellos', () => {
    expect([...HOSPITAL_VISITA_DESTINOS]).toStrictEqual([
      'IN_PROGRESS',
      'COMPLETED',
      'NOT_COMPLETED',
    ]);
    expect([...HOSPITAL_VISITA_DESTINOS]).not.toContain('SCHEDULED');
  });

  it('devuelve la versión YA incrementada para el siguiente intento', async () => {
    const { impl } = fetchDoble(() => respuesta(200, TRANSICION));

    const resultado = await cambiarEstadoVisita(VISITA_ID, 'IN_PROGRESS', 1, impl);

    expect(resultado.kind).toBe('ok');

    if (resultado.kind === 'ok') {
      expect(resultado.datos.version).toBe(2);
      expect(resultado.datos.fromStatus).toBe('SCHEDULED');
      expect(resultado.datos.toStatus).toBe('IN_PROGRESS');
    }
  });

  it('traduce cada código de estado a su desenlace tipado', async () => {
    const esperado = [
      [400, 'solicitud-invalida'],
      [401, 'sin-sesion'],
      [403, 'sin-permiso'],
      [404, 'no-encontrado'],
      [409, 'conflicto'],
      [503, 'no-disponible'],
      [500, 'no-disponible'],
    ] as const;

    for (const [status, kind] of esperado) {
      const { impl } = fetchDoble(() => fallo(status, 'CODIGO_ESTABLE'));

      expect((await cambiarEstadoVisita(VISITA_ID, 'COMPLETED', 2, impl)).kind).toBe(kind);
    }
  });

  it('los DOS conflictos de transición comparten desenlace y exigen refrescar', async () => {
    const version = fetchDoble(() => fallo(409, 'HOME_VISIT_VERSION_CONFLICT'));
    const noAdmitida = fetchDoble(() => fallo(409, 'HOME_VISIT_TRANSITION_NOT_ALLOWED'));

    const uno = await cambiarEstadoVisita(VISITA_ID, 'COMPLETED', 1, version.impl);
    const otro = await cambiarEstadoVisita(VISITA_ID, 'COMPLETED', 1, noAdmitida.impl);

    expect(uno).toStrictEqual({ kind: 'conflicto' });
    expect(otro).toStrictEqual({ kind: 'conflicto' });
    expect(requiereRefrescoDeVisita(uno)).toBe(true);
    expect(requiereRefrescoDeVisita(otro)).toBe(true);
  });

  it('un `409` con cuerpo ilegible sigue siendo conflicto', async () => {
    const { impl } = fetchDoble(() => new Response('vacio', { status: 409 }));

    const resultado = await cambiarEstadoVisita(VISITA_ID, 'COMPLETED', 1, impl);

    expect(resultado).toStrictEqual({ kind: 'conflicto' });
  });

  it('reenviar la MISMA versión no repite la operación: el servidor la rechaza', async () => {
    let llamada = 0;
    const { impl } = fetchDoble(() => {
      llamada += 1;

      return llamada === 1
        ? respuesta(200, TRANSICION)
        : fallo(409, 'HOME_VISIT_VERSION_CONFLICT');
    });

    expect((await cambiarEstadoVisita(VISITA_ID, 'IN_PROGRESS', 1, impl)).kind).toBe('ok');
    expect((await cambiarEstadoVisita(VISITA_ID, 'IN_PROGRESS', 1, impl)).kind).toBe(
      'conflicto',
    );
  });
});

describe('fallos de transporte y cancelación', () => {
  it('un fallo de red no se presenta como datos', async () => {
    const red = (async () => {
      throw new TypeError('sin conexión');
    }) as unknown as typeof fetch;

    expect((await materializarVisita(CITA_ID, red)).kind).toBe('no-disponible');
    expect((await consultarVisitaProfesional(VISITA_ID, red)).kind).toBe('no-disponible');
    expect((await cambiarEstadoVisita(VISITA_ID, 'COMPLETED', 1, red)).kind).toBe(
      'no-disponible',
    );
  });

  it('una respuesta correcta pero ilegible tampoco produce datos', async () => {
    const { impl } = fetchDoble(() => new Response('no es json', { status: 200 }));

    expect((await consultarVisitaProfesional(VISITA_ID, impl)).kind).toBe('no-disponible');
  });

  it('propaga el `AbortSignal` y distingue la cancelación del fallo', async () => {
    const control = new AbortController();
    const { impl, llamadas } = fetchDoble(() => respuesta(200, VISITA));

    control.abort();

    const resultado = await consultarVisitaProfesional(VISITA_ID, impl, control.signal);

    expect(resultado.kind).toBe('cancelado');
    expect(llamadas[0]?.init.signal).toBe(control.signal);
  });

  it('una excepción de aborto tampoco se presenta como fallo', async () => {
    const abortado = (async () => {
      const error = new Error('abort');

      error.name = 'AbortError';
      throw error;
    }) as unknown as typeof fetch;

    expect((await materializarVisita(CITA_ID, abortado)).kind).toBe('cancelado');
    expect((await cambiarEstadoVisita(VISITA_ID, 'COMPLETED', 1, abortado)).kind).toBe(
      'cancelado',
    );
  });
});

describe('textos de producto', () => {
  const FALLOS: readonly ResultadoVisita<unknown>[] = [
    { kind: 'solicitud-invalida' },
    { kind: 'sin-sesion' },
    { kind: 'sin-permiso' },
    { kind: 'no-encontrado' },
    { kind: 'conflicto' },
    { kind: 'no-disponible' },
  ];

  it('cada fallo tiene un mensaje propio, no vacío y distinto de los demás', () => {
    const mensajes = FALLOS.map((resultado) => mensajeDeVisita(resultado));

    for (const mensaje of mensajes) {
      expect(typeof mensaje).toBe('string');
      expect(String(mensaje).length).toBeGreaterThan(10);
    }

    expect(new Set(mensajes).size).toBe(FALLOS.length);
  });

  it('ningún mensaje expone código técnico, ruta ni detalle interno', () => {
    /*
     * La interfaz no debe poder mostrar un código estable del servidor, un
     * verbo HTTP, una ruta, ni el nombre de ninguna capa interna.
     */
    const prohibidos = [
      'HOME_VISIT',
      'VISITS_',
      '/api/',
      'HTTP',
      '400',
      '401',
      '403',
      '404',
      '409',
      '503',
      'fetch',
      'SQL',
      'CORE',
      'API',
      'null',
      'undefined',
    ];

    for (const resultado of FALLOS) {
      const mensaje = String(mensajeDeVisita(resultado));

      for (const prohibido of prohibidos) {
        expect(mensaje).not.toContain(prohibido);
      }
    }
  });

  it('el éxito y la cancelación NO producen mensaje de error', () => {
    expect(mensajeDeVisita({ kind: 'ok', datos: VISITA })).toBeNull();
    expect(mensajeDeVisita({ kind: 'cancelado' })).toBeNull();
  });

  it('solo el conflicto obliga a refrescar', () => {
    expect(requiereRefrescoDeVisita({ kind: 'conflicto' })).toBe(true);

    for (const resultado of [
      ...FALLOS.filter((candidato) => candidato.kind !== 'conflicto'),
      { kind: 'cancelado' } as const,
      { kind: 'ok', datos: VISITA } as const,
    ]) {
      expect(requiereRefrescoDeVisita(resultado)).toBe(false);
    }
  });
});

describe('traducción de estados, aislada del transporte', () => {
  it('devuelve `null` para los estados que el transporte debe resolver', () => {
    expect(desenlaceDeEstadoVisita(200)).toBeNull();
    expect(desenlaceDeEstadoVisita(201)).toBeNull();
    expect(desenlaceDeEstadoVisita(503)).toBeNull();
    expect(desenlaceDeEstadoVisita(500)).toBeNull();
  });

  it('mapea los cinco estados que el contrato declara', () => {
    expect(desenlaceDeEstadoVisita(400)).toStrictEqual({ kind: 'solicitud-invalida' });
    expect(desenlaceDeEstadoVisita(401)).toStrictEqual({ kind: 'sin-sesion' });
    expect(desenlaceDeEstadoVisita(403)).toStrictEqual({ kind: 'sin-permiso' });
    expect(desenlaceDeEstadoVisita(404)).toStrictEqual({ kind: 'no-encontrado' });
    expect(desenlaceDeEstadoVisita(409)).toStrictEqual({ kind: 'conflicto' });
  });
});

describe('cero repliegue a datos demostrativos', () => {
  it('ningún fallo devuelve datos', async () => {
    for (const status of [400, 401, 403, 404, 409, 500, 503]) {
      const { impl } = fetchDoble(() => fallo(status, 'CODIGO_ESTABLE'));

      const resultado = await consultarVisitaProfesional(VISITA_ID, impl);

      expect(resultado.kind).not.toBe('ok');
      expect(resultado).not.toHaveProperty('datos');
    }
  });

  it('el cliente no importa las fixtures de la vista demostrativa', async () => {
    const { readFileSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');

    const codigo = readFileSync(
      fileURLToPath(new URL('./hospitalVisitsClient.ts', import.meta.url)),
      'utf8',
    );

    expect(codigo).not.toContain("from './hospitalVisitsConfig'");
    expect(codigo).not.toContain('HospitalVisitaFila');
  });
});
