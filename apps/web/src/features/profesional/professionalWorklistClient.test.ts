import { describe, expect, it } from 'vitest';

import {
  ESTADOS_VISITA_PROFESIONAL,
  MAX_VENTANA_DIAS,
  MODALIDAD_WORKLIST,
  RUTA_WORKLIST_PROFESIONAL,
  consultarWorklistProfesional,
  leerWorklist,
  ventanaUtc,
  type VentanaWorklist,
} from './professionalWorklistClient';

/**
 * Cliente de la worklist profesional (SPEC 038, MP04 §12).
 *
 * Lo que se protege aquí es que `/profesional` deje de inventar visitas: la
 * única fuente es `GET /api/v1/professional/visits`, la ventana es la única
 * entrada declarada, y una respuesta que no sea EXACTAMENTE el contrato se
 * rechaza entera en lugar de pintarse a medias.
 */

const VENTANA: VentanaWorklist = { from: '2026-08-24', to: '2026-08-30' };

const ITEM_SIN_VISITA = {
  appointmentId: 'cita-1',
  scheduledStart: '2026-08-24T16:00:00.000Z',
  modality: 'HOME',
  patient: { displayName: 'Persona Ejemplo Ficticio', initials: 'PE' },
  visit: null,
};

const ITEM_CON_VISITA = {
  appointmentId: 'cita-2',
  scheduledStart: '2026-08-25T10:00:00.000Z',
  modality: 'HOME',
  patient: { displayName: 'Otra Persona Ficticia', initials: 'OP' },
  visit: {
    homeVisitId: 'visita-1',
    status: 'SCHEDULED',
    version: 1,
    startedAt: null,
    endedAt: null,
    updatedAt: '2026-08-24T16:00:00.000Z',
  },
};

function cuerpoValido(items: readonly unknown[] = [ITEM_SIN_VISITA, ITEM_CON_VISITA]): string {
  return JSON.stringify({ window: VENTANA, items });
}

function respuestaJson(cuerpo: string, status = 200): Response {
  return new Response(cuerpo, {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

interface Doble {
  readonly impl: typeof fetch;
  readonly llamadas: readonly { readonly url: string; readonly init: RequestInit }[];
}

function fetchDoble(responder: () => Response): Doble {
  const llamadas: { url: string; init: RequestInit }[] = [];

  const impl = ((entrada: RequestInfo | URL, init?: RequestInit) => {
    llamadas.push({
      url: typeof entrada === 'string' ? entrada : entrada.toString(),
      init: init ?? {},
    });

    return Promise.resolve(responder());
  }) as unknown as typeof fetch;

  return { impl, llamadas };
}

describe('ventana de calendario', () => {
  it('construye una ventana inclusiva de N días en UTC, a partir de un instante explícito', () => {
    const hoy = new Date('2026-08-30T23:30:00.000Z');

    expect(ventanaUtc(1, hoy)).toStrictEqual({ from: '2026-08-30', to: '2026-08-30' });
    expect(ventanaUtc(7, hoy)).toStrictEqual({ from: '2026-08-24', to: '2026-08-30' });
  });

  it('nunca supera el máximo del servidor ni cae por debajo de un día', () => {
    const hoy = new Date('2026-08-30T00:00:00.000Z');

    expect(ventanaUtc(MAX_VENTANA_DIAS + 40, hoy)).toStrictEqual({
      from: '2026-07-31',
      to: '2026-08-30',
    });
    expect(ventanaUtc(0, hoy)).toStrictEqual({ from: '2026-08-30', to: '2026-08-30' });
    expect(ventanaUtc(-5, hoy)).toStrictEqual({ from: '2026-08-30', to: '2026-08-30' });
  });

  it('no lee el reloj de la máquina: el instante siempre se recibe', () => {
    // Determinismo: la misma entrada produce siempre la misma ventana.
    const hoy = new Date('2026-01-01T12:00:00.000Z');

    expect(ventanaUtc(3, hoy)).toStrictEqual(ventanaUtc(3, hoy));
  });
});

describe('consulta de la worklist', () => {
  it('pregunta por la ruta profesional con la ventana como ÚNICO parámetro', async () => {
    const doble = fetchDoble(() => respuestaJson(cuerpoValido()));

    await consultarWorklistProfesional(VENTANA, doble.impl);

    const llamada = doble.llamadas[0];
    const url = new URL(llamada?.url ?? '');

    expect(doble.llamadas).toHaveLength(1);
    expect(url.pathname).toBe(RUTA_WORKLIST_PROFESIONAL);
    expect([...url.searchParams.entries()]).toStrictEqual([
      ['from', '2026-08-24'],
      ['to', '2026-08-30'],
    ]);
    expect(llamada?.init.method).toBe('GET');
    expect(llamada?.init.credentials).toBe('include');
    expect(llamada?.init.cache).toBe('no-store');
    expect(llamada?.init.body).toBeUndefined();
    expect(llamada?.init.headers).toStrictEqual({ Accept: 'application/json' });
  });

  it('lee la worklist completa, incluida la visita todavía no materializada', async () => {
    const doble = fetchDoble(() => respuestaJson(cuerpoValido()));

    await expect(consultarWorklistProfesional(VENTANA, doble.impl)).resolves.toStrictEqual({
      estado: 'ok',
      worklist: {
        window: VENTANA,
        items: [
          {
            appointmentId: 'cita-1',
            scheduledStart: '2026-08-24T16:00:00.000Z',
            modality: MODALIDAD_WORKLIST,
            patient: { displayName: 'Persona Ejemplo Ficticio', initials: 'PE' },
            visit: null,
          },
          {
            appointmentId: 'cita-2',
            scheduledStart: '2026-08-25T10:00:00.000Z',
            modality: MODALIDAD_WORKLIST,
            patient: { displayName: 'Otra Persona Ficticia', initials: 'OP' },
            visit: {
              homeVisitId: 'visita-1',
              status: 'SCHEDULED',
              version: 1,
              startedAt: null,
              endedAt: null,
              updatedAt: '2026-08-24T16:00:00.000Z',
            },
          },
        ],
      },
    });
  });

  it('una lista vacía es OK: es la worklist vacía, no un error', async () => {
    const doble = fetchDoble(() => respuestaJson(cuerpoValido([])));

    const resultado = await consultarWorklistProfesional(VENTANA, doble.impl);

    expect(resultado.estado).toBe('ok');
    expect(resultado.estado === 'ok' ? resultado.worklist.items : null).toStrictEqual([]);
  });

  it('la modalidad y los estados son los del catálogo del servidor', () => {
    expect(MODALIDAD_WORKLIST).toBe('HOME');
    expect([...ESTADOS_VISITA_PROFESIONAL]).toStrictEqual([
      'SCHEDULED',
      'IN_PROGRESS',
      'COMPLETED',
      'NOT_COMPLETED',
    ]);
  });
});

describe('contrato cerrado: nada que la spec no aprobó llega a la pantalla', () => {
  it('rechaza una clave de más en cualquier nivel', () => {
    const conClaveDeMas = {
      window: VENTANA,
      items: [{ ...ITEM_SIN_VISITA, edad: 78 }],
    };

    expect(leerWorklist(conClaveDeMas)).toBeUndefined();

    expect(leerWorklist({ ...conClaveDeMas, total: 1 })).toBeUndefined();
    expect(
      leerWorklist({ window: { ...VENTANA, timezone: 'America/Bogota' }, items: [] }),
    ).toBeUndefined();
    expect(
      leerWorklist({ window: VENTANA, items: [{ ...ITEM_SIN_VISITA, patient: { ...ITEM_SIN_VISITA.patient, documentNumber: '123' } }] }),
    ).toBeUndefined();
    expect(
      leerWorklist({
        window: VENTANA,
        items: [
          {
            ...ITEM_CON_VISITA,
            visit: { ...ITEM_CON_VISITA.visit, clinicalNote: 'algo' },
          },
        ],
      }),
    ).toBeUndefined();
  });

  it('rechaza modalidad, estado o versión fuera de catálogo', () => {
    expect(
      leerWorklist({ window: VENTANA, items: [{ ...ITEM_SIN_VISITA, modality: 'VIRTUAL' }] }),
    ).toBeUndefined();
    expect(
      leerWorklist({
        window: VENTANA,
        items: [{ ...ITEM_CON_VISITA, visit: { ...ITEM_CON_VISITA.visit, status: 'CANCELLED' } }],
      }),
    ).toBeUndefined();
    expect(
      leerWorklist({
        window: VENTANA,
        items: [{ ...ITEM_CON_VISITA, visit: { ...ITEM_CON_VISITA.visit, version: 0 } }],
      }),
    ).toBeUndefined();
  });

  it('un cuerpo ilegible o con un elemento inválido invalida la respuesta ENTERA', () => {
    expect(leerWorklist(undefined)).toBeUndefined();
    expect(leerWorklist([])).toBeUndefined();
    expect(leerWorklist({ window: VENTANA })).toBeUndefined();
    expect(leerWorklist({ window: VENTANA, items: 'no' })).toBeUndefined();
    // Un solo elemento inválido no se descarta en silencio.
    expect(leerWorklist({ window: VENTANA, items: [ITEM_SIN_VISITA, { appointmentId: 'x' }] })).toBeUndefined();
  });
});

describe('desenlaces de la consulta', () => {
  it('un 401 devuelve «sin-sesion» sin distinguir la causa', async () => {
    const doble = fetchDoble(() => respuestaJson('{}', 401));

    await expect(consultarWorklistProfesional(VENTANA, doble.impl)).resolves.toStrictEqual({
      estado: 'sin-sesion',
    });
  });

  it('un 400 es «respuesta-invalida»: la ventana no fue admitida', async () => {
    const doble = fetchDoble(() => respuestaJson('{}', 400));

    await expect(consultarWorklistProfesional(VENTANA, doble.impl)).resolves.toStrictEqual({
      estado: 'respuesta-invalida',
    });
  });

  it('un 503, un fallo de red y un cuerpo ilegible son fallo cerrado', async () => {
    const caido = (async () => {
      throw new TypeError('Failed to connect');
    }) as unknown as typeof fetch;

    await expect(consultarWorklistProfesional(VENTANA, caido)).resolves.toStrictEqual({
      estado: 'no-disponible',
    });

    const error = fetchDoble(() => respuestaJson('{}', 503));
    await expect(consultarWorklistProfesional(VENTANA, error.impl)).resolves.toStrictEqual({
      estado: 'no-disponible',
    });

    const malformado = fetchDoble(() => new Response('no es json', { status: 200 }));
    await expect(consultarWorklistProfesional(VENTANA, malformado.impl)).resolves.toStrictEqual({
      estado: 'respuesta-invalida',
    });
  });

  it('un aborto devuelve «cancelado» y no se confunde con un fallo', async () => {
    const controller = new AbortController();
    const impl = (async () => {
      const error = new Error('abortada');

      error.name = 'AbortError';

      throw error;
    }) as unknown as typeof fetch;

    controller.abort();

    await expect(consultarWorklistProfesional(VENTANA, impl, controller.signal)).resolves.toStrictEqual(
      { estado: 'cancelado' },
    );
  });

  it('no envía identidad, no persiste nada y no filtra por sujeto', async () => {
    const doble = fetchDoble(() => respuestaJson(cuerpoValido()));

    await consultarWorklistProfesional(VENTANA, doble.impl);

    const texto = JSON.stringify(doble.llamadas);

    for (const prohibido of [
      'professionalId',
      'patientId',
      'tenantId',
      'institutionId',
      'actor',
      'role',
      'Authorization',
      'Cookie',
    ]) {
      expect(texto).not.toContain(prohibido);
    }
  });
});
