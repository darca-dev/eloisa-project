import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  ETIQUETA_PACIENTE,
  RUTAS_PACIENTE_SELF,
  consultarCitasPaciente,
  consultarResumenPaciente,
  consultarVisitasPaciente,
  type FalloPacienteSelf,
} from './pacienteSelfClient';

/**
 * Cliente self-scope del Paciente (spec 021 §6.6-e, §6.7 a §6.11).
 *
 * Se prueba sin jsdom y sin red, inyectando una implementación de `fetch`.
 * Todos los valores son FICTICIOS.
 *
 * Lo que estas pruebas vigilan, además de que el cliente funcione:
 *
 * 1. que NO exista forma de nombrar un sujeto —ni en la firma, ni en la URL, ni
 *    en el cuerpo, ni en una cabecera—;
 * 2. que la minimización sea observable: el conjunto de campos aceptados es
 *    EXACTO, y una respuesta con un campo de más se rechaza entera;
 * 3. que ningún fallo se confunda con un dato, y que la lista vacía no sea un
 *    error.
 */

const DIRECTORIO = fileURLToPath(new URL('.', import.meta.url));
const FUENTE = readFileSync(`${DIRECTORIO}pacienteSelfClient.ts`, 'utf8');

/**
 * Código SIN comentarios.
 *
 * Las guardias estructurales se aplican sobre lo que el módulo HACE, no sobre
 * lo que su documentación NOMBRA: el encabezado explica precisamente por qué no
 * persiste nada y por qué la credencial es implícita, y esas frases no pueden
 * hacer caer la guardia que las respalda.
 */
const CODIGO = FUENTE.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/^\s*\/\/.*$/gmu, '');

/** Doble de `fetch` que registra cada llamada y responde lo que se le diga. */
function fetchDoble(responder: () => Response | Promise<Response>): {
  readonly impl: typeof fetch;
  readonly llamadas: { url: string; init: RequestInit }[];
} {
  const llamadas: { url: string; init: RequestInit }[] = [];

  const impl = (async (entrada: unknown, init: RequestInit = {}) => {
    llamadas.push({ url: String(entrada), init });

    return responder();
  }) as unknown as typeof fetch;

  return { impl, llamadas };
}

function respuestaJson(cuerpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Resumen FICTICIO, con los tres campos exactos del contrato. */
const RESUMEN_VALIDO = {
  givenName: 'Rosalba',
  initials: 'RG',
  label: ETIQUETA_PACIENTE,
} as const;

/** Cita FICTICIA, con los tres campos exactos del contrato. */
const CITA_VALIDA = {
  scheduledStart: '2026-09-02T14:00:00.000Z',
  modality: 'VIRTUAL',
  status: 'ASSIGNED',
} as const;

/** Visita FICTICIA, con los tres campos exactos del contrato. */
const VISITA_VALIDA = {
  scheduledStart: '2026-09-03T09:30:00.000Z',
  modality: 'HOME',
  status: 'SCHEDULED',
} as const;

/** Las tres operaciones, para recorrer reglas comunes sin repetirlas. */
const OPERACIONES = [
  ['resumen', RUTAS_PACIENTE_SELF.resumen, consultarResumenPaciente],
  ['citas', RUTAS_PACIENTE_SELF.citas, consultarCitasPaciente],
  ['visitas', RUTAS_PACIENTE_SELF.visitas, consultarVisitasPaciente],
] as const;

/* ========================================================================== */
/* Las tres rutas, y ninguna más                                               */
/* ========================================================================== */

describe('superficie self-scope del Paciente', () => {
  it('declara EXACTAMENTE las tres rutas del contrato', () => {
    expect(Object.values(RUTAS_PACIENTE_SELF)).toStrictEqual([
      '/api/v1/patient-self/summary',
      '/api/v1/patient-self/appointments',
      '/api/v1/patient-self/visits',
    ]);
  });

  it.each(OPERACIONES)(
    '%s consulta su ruta por GET, con la sesión implícita y sin caché',
    async (_nombre, ruta, consultar) => {
      const doble = fetchDoble(() =>
        ruta === RUTAS_PACIENTE_SELF.resumen
          ? respuestaJson(RESUMEN_VALIDO)
          : respuestaJson({ items: [] }),
      );

      await consultar(doble.impl);

      const llamada = doble.llamadas[0];

      expect(doble.llamadas).toHaveLength(1);
      expect(new URL(llamada?.url ?? '').pathname).toBe(ruta);
      expect(llamada?.init.method).toBe('GET');
      // La credencial la administra el navegador: no se escribe ninguna cabecera.
      expect(llamada?.init.credentials).toBe('include');
      expect(llamada?.init.cache).toBe('no-store');
      expect(llamada?.init.headers).toStrictEqual({ Accept: 'application/json' });
      expect(llamada?.init.body).toBeUndefined();
    },
  );
});

/* ========================================================================== */
/* CERO selectores de sujeto                                                   */
/* ========================================================================== */

describe('ausencia de selectores de sujeto', () => {
  it.each(OPERACIONES)(
    '%s no envía consulta, ni cuerpo, ni identificador alguno',
    async (_nombre, ruta, consultar) => {
      const doble = fetchDoble(() =>
        ruta === RUTAS_PACIENTE_SELF.resumen
          ? respuestaJson(RESUMEN_VALIDO)
          : respuestaJson({ items: [] }),
      );

      await consultar(doble.impl);

      const url = new URL(doble.llamadas[0]?.url ?? '');
      const peticion = JSON.stringify(doble.llamadas[0]);

      expect([...url.searchParams.keys()]).toStrictEqual([]);
      expect(url.search).toBe('');
      expect(doble.llamadas[0]?.init.body).toBeUndefined();

      for (const prohibido of [
        'patientId',
        'personId',
        'subject',
        'tenantId',
        'institutionId',
        'documentNumber',
        'humanAccountId',
        'professionalId',
      ]) {
        expect(peticion).not.toContain(prohibido);
      }
    },
  );

  it('las tres funciones solo aceptan transporte y cancelación', () => {
    /*
     * La firma es la frontera. `fetchImpl` y `signal` son las DOS entradas, y
     * ninguna nombra a nadie: no hay parámetro por el que un identificador
     * ajeno pudiera colarse ni por descuido ni a propósito.
     */
    for (const consultar of [
      consultarResumenPaciente,
      consultarCitasPaciente,
      consultarVisitasPaciente,
    ]) {
      expect(consultar.length).toBe(0);
    }

    const firmas = [
      ...CODIGO.matchAll(
        /export async function consultar\w+\(\s*(?<firma>[\s\S]*?)\): Promise/gu,
      ),
    ].map((coincidencia) => coincidencia.groups?.firma ?? '');

    expect(firmas).toHaveLength(3);

    for (const firma of firmas) {
      const parametros = [...firma.matchAll(/(?<nombre>\w+)\??:/gu)].map(
        (coincidencia) => coincidencia.groups?.nombre ?? '',
      );

      expect(parametros).toStrictEqual(['fetchImpl', 'signal']);
    }
  });

  it('el código no nombra ningún identificador de sujeto ni de tenant', () => {
    for (const prohibido of [
      'patientId',
      'personId',
      'tenantId',
      'institutionId',
      'careAssignmentId',
      'documentNumber',
      'subject',
      'searchParams',
      'URLSearchParams',
    ]) {
      expect(CODIGO).not.toContain(prohibido);
    }
  });

  it('no persiste nada en el navegador ni toca la credencial', () => {
    expect(/localStorage|sessionStorage|indexedDB/u.test(CODIGO)).toBe(false);
    expect(/document\s*\.\s*cookie/u.test(CODIGO)).toBe(false);
    expect(/['"]Cookie['"]|['"]Authorization['"]/iu.test(CODIGO)).toBe(false);
  });
});

/* ========================================================================== */
/* Resumen                                                                     */
/* ========================================================================== */

describe('resumen propio', () => {
  it('devuelve los tres campos aprobados y ninguno más', async () => {
    const doble = fetchDoble(() => respuestaJson(RESUMEN_VALIDO));
    const resultado = await consultarResumenPaciente(doble.impl);

    expect(resultado).toStrictEqual({ estado: 'ok', datos: { ...RESUMEN_VALIDO } });

    if (resultado.estado === 'ok') {
      expect(Object.keys(resultado.datos).sort()).toStrictEqual([
        'givenName',
        'initials',
        'label',
      ]);
      expect(resultado.datos.label).toBe('Paciente');
    }
  });

  it('un CUARTO campo invalida la respuesta entera: no se acepta a medias', async () => {
    const doble = fetchDoble(() =>
      respuestaJson({ ...RESUMEN_VALIDO, documentNumber: '00000000' }),
    );

    await expect(consultarResumenPaciente(doble.impl)).resolves.toStrictEqual({
      estado: 'respuesta-invalida',
    });
  });

  it('un campo faltante, vacío o con etiqueta distinta se rechaza', async () => {
    const invalidos: readonly unknown[] = [
      { givenName: 'Rosalba', initials: 'RG' },
      { givenName: '', initials: 'RG', label: ETIQUETA_PACIENTE },
      { givenName: 'Rosalba', initials: 'RG', label: 'Profesional' },
      { givenName: 'Rosalba', initials: 4, label: ETIQUETA_PACIENTE },
      [RESUMEN_VALIDO],
      null,
      'Rosalba',
    ];

    for (const cuerpo of invalidos) {
      const doble = fetchDoble(() => respuestaJson(cuerpo));

      await expect(consultarResumenPaciente(doble.impl)).resolves.toStrictEqual({
        estado: 'respuesta-invalida',
      });
    }
  });
});

/* ========================================================================== */
/* Citas y visitas                                                             */
/* ========================================================================== */

describe('citas propias', () => {
  it('devuelve la lista con los tres campos de cada cita', async () => {
    const doble = fetchDoble(() => respuestaJson({ items: [CITA_VALIDA] }));

    await expect(consultarCitasPaciente(doble.impl)).resolves.toStrictEqual({
      estado: 'ok',
      datos: [{ ...CITA_VALIDA }],
    });
  });

  it('la lista VACÍA es un desenlace válido, nunca un error', async () => {
    const doble = fetchDoble(() => respuestaJson({ items: [] }));

    await expect(consultarCitasPaciente(doble.impl)).resolves.toStrictEqual({
      estado: 'ok',
      datos: [],
    });
  });

  it('un campo de más en una cita invalida la respuesta entera', async () => {
    const doble = fetchDoble(() =>
      respuestaJson({ items: [{ ...CITA_VALIDA, patientName: 'Otra persona' }] }),
    );

    await expect(consultarCitasPaciente(doble.impl)).resolves.toStrictEqual({
      estado: 'respuesta-invalida',
    });
  });

  it('un valor fuera del catálogo se rechaza, y no se muestra a medias', async () => {
    const invalidos: readonly unknown[] = [
      { items: [{ ...CITA_VALIDA, modality: 'TELEPATHY' }] },
      { items: [{ ...CITA_VALIDA, status: 'COMPLETED' }] },
      { items: [{ ...CITA_VALIDA, scheduledStart: '' }] },
      { items: [CITA_VALIDA, { ...CITA_VALIDA, status: 'DESCONOCIDO' }] },
      { items: {} },
      { items: [], total: 0 },
      [CITA_VALIDA],
    ];

    for (const cuerpo of invalidos) {
      const doble = fetchDoble(() => respuestaJson(cuerpo));

      await expect(consultarCitasPaciente(doble.impl)).resolves.toStrictEqual({
        estado: 'respuesta-invalida',
      });
    }
  });
});

describe('visitas propias', () => {
  it('devuelve la lista con los tres campos de cada visita', async () => {
    const doble = fetchDoble(() => respuestaJson({ items: [VISITA_VALIDA] }));

    await expect(consultarVisitasPaciente(doble.impl)).resolves.toStrictEqual({
      estado: 'ok',
      datos: [{ ...VISITA_VALIDA }],
    });
  });

  it('la lista VACÍA es un desenlace válido, nunca un error', async () => {
    const doble = fetchDoble(() => respuestaJson({ items: [] }));

    await expect(consultarVisitasPaciente(doble.impl)).resolves.toStrictEqual({
      estado: 'ok',
      datos: [],
    });
  });

  it('la modalidad de una visita solo puede ser HOME', async () => {
    const doble = fetchDoble(() =>
      respuestaJson({ items: [{ ...VISITA_VALIDA, modality: 'VIRTUAL' }] }),
    );

    await expect(consultarVisitasPaciente(doble.impl)).resolves.toStrictEqual({
      estado: 'respuesta-invalida',
    });
  });

  it('no acepta identidad institucional ni historial de transiciones', async () => {
    const doble = fetchDoble(() =>
      respuestaJson({
        items: [{ ...VISITA_VALIDA, performedBy: 'profesional-ficticio' }],
      }),
    );

    await expect(consultarVisitasPaciente(doble.impl)).resolves.toStrictEqual({
      estado: 'respuesta-invalida',
    });
  });
});

/* ========================================================================== */
/* Fallos: cada uno con su desenlace, ninguno confundido con un dato           */
/* ========================================================================== */

describe('desenlaces de fallo', () => {
  it.each(OPERACIONES)(
    '%s traduce 401, 403, 429 y 503 a desenlaces distintos',
    async (_nombre, _ruta, consultar) => {
      const esperado: readonly (readonly [number, FalloPacienteSelf])[] = [
        [401, 'sin-sesion'],
        [403, 'sin-contexto'],
        [429, 'demasiados-intentos'],
        [503, 'no-disponible'],
        [500, 'no-disponible'],
      ];

      for (const [status, desenlace] of esperado) {
        const doble = fetchDoble(() => respuestaJson({}, status));

        await expect(consultar(doble.impl)).resolves.toStrictEqual({ estado: desenlace });
      }
    },
  );

  it('«sin sesión» y «sin contexto» NO se confunden entre sí', async () => {
    /*
     * El servidor ya los distingue con `401` y `403`, y la acción de la persona
     * es distinta: volver a entrar, frente a no tener esta experiencia. Ninguno
     * de los dos revela si existe un paciente asociado.
     */
    const sinSesion = fetchDoble(() => respuestaJson({}, 401));
    const sinContexto = fetchDoble(() => respuestaJson({}, 403));

    const uno = await consultarCitasPaciente(sinSesion.impl);
    const otro = await consultarCitasPaciente(sinContexto.impl);

    expect(uno.estado).toBe('sin-sesion');
    expect(otro.estado).toBe('sin-contexto');
    expect(uno.estado).not.toBe(otro.estado);
  });

  it.each(OPERACIONES)(
    '%s traduce el fallo de red sin lanzar',
    async (_nombre, _ruta, consultar) => {
      const impl = (async () => {
        throw new TypeError('Failed to connect');
      }) as unknown as typeof fetch;

      await expect(consultar(impl)).resolves.toStrictEqual({ estado: 'no-disponible' });
    },
  );

  it.each(OPERACIONES)(
    '%s traduce un cuerpo ilegible a respuesta inválida',
    async (_nombre, _ruta, consultar) => {
      const doble = fetchDoble(() => new Response('no es json', { status: 200 }));

      await expect(consultar(doble.impl)).resolves.toStrictEqual({
        estado: 'respuesta-invalida',
      });
    },
  );

  it.each(OPERACIONES)(
    '%s devuelve «cancelado» ante un aborto, sin error espurio',
    async (_nombre, _ruta, consultar) => {
      const controller = new AbortController();
      const impl = (async () => {
        const error = new Error('abortada');

        error.name = 'AbortError';

        throw error;
      }) as unknown as typeof fetch;

      controller.abort();

      await expect(consultar(impl, controller.signal)).resolves.toStrictEqual({
        estado: 'cancelado',
      });
    },
  );

  it('una respuesta que llega tras el aborto no entrega datos', async () => {
    const controller = new AbortController();
    const doble = fetchDoble(() => {
      controller.abort();

      return respuestaJson({ items: [CITA_VALIDA] });
    });

    await expect(consultarCitasPaciente(doble.impl, controller.signal)).resolves.toStrictEqual(
      { estado: 'cancelado' },
    );
  });

  it.each(OPERACIONES)(
    '%s propaga la señal de cancelación a la petición',
    async (_nombre, ruta, consultar) => {
      const controller = new AbortController();
      const doble = fetchDoble(() =>
        ruta === RUTAS_PACIENTE_SELF.resumen
          ? respuestaJson(RESUMEN_VALIDO)
          : respuestaJson({ items: [] }),
      );

      await consultar(doble.impl, controller.signal);

      expect(doble.llamadas[0]?.init.signal).toBe(controller.signal);
    },
  );

  it('ningún fallo entrega datos: la unión tipada no lo permite', async () => {
    const doble = fetchDoble(() => respuestaJson({}, 503));
    const resultado = await consultarResumenPaciente(doble.impl);

    expect(resultado.estado).not.toBe('ok');
    expect(Object.keys(resultado)).toStrictEqual(['estado']);
    expect('datos' in resultado).toBe(false);
  });
});

/* ========================================================================== */
/* Reutilización: una sola copia de la seguridad                               */
/* ========================================================================== */

describe('reutilización del cliente humano compartido', () => {
  it('reutiliza el transporte del módulo compartido en vez de reescribirlo', () => {
    expect(CODIGO).toContain("from '@/features/auth/humanSessionClient'");
    expect(CODIGO).toContain('peticionHumana');
    expect(CODIGO).toContain('esCancelacion');
  });

  it('no reimplementa las opciones de la petición ni la detección del aborto', () => {
    expect(CODIGO).not.toContain("credentials: 'include'");
    expect(CODIGO).not.toContain("cache: 'no-store'");
    expect(CODIGO).not.toContain("error.name === 'AbortError'");
  });

  it('no cachea ni deduplica: cada consulta sale de verdad al servidor', async () => {
    const doble = fetchDoble(() => respuestaJson({ items: [] }));

    await consultarCitasPaciente(doble.impl);
    await consultarCitasPaciente(doble.impl);

    expect(doble.llamadas).toHaveLength(2);
  });
});
