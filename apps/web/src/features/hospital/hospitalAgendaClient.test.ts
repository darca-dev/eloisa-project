import { describe, expect, it } from 'vitest';

import {
  HOSPITAL_AGENDA_ESCALAS,
  HOSPITAL_AGENDA_MAX_DIAS,
  RUTAS_HOSPITAL_AGENDA,
  asignarCita,
  consultarAgenda,
  esFechaCalendario,
  fechaCalendarioDe,
  instanteDeFechaHora,
  ventanaDeEscala,
} from './hospitalAgendaClient';

/**
 * Cliente de Hospital · Agenda y de la ÚNICA mutación autorizada
 * (TASK-HOSPITAL-CORE-02, paquete final de corrección §6.2).
 *
 * Se prueba sin jsdom y sin red, inyectando una implementación de `fetch`.
 * Todos los datos son ficticios.
 */

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

function fallo(status: number, code = 'X'): Response {
  return new Response(JSON.stringify({ code, message: 'Y' }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const AGENDA = {
  source: 'ELOISA_POSTGRESQL',
  generatedAt: '2026-08-22T15:04:05.000Z',
  window: { from: '2026-08-01', to: '2026-08-31' },
  requests: [],
  assignableProfessionals: [],
  appointments: [],
  dailyCounts: [],
  modalityCounts: [],
  totalAppointments: 0,
};

const ASIGNADA = {
  source: 'ELOISA_POSTGRESQL',
  generatedAt: '2026-08-22T15:04:05.000Z',
  appointmentId: '019287a1-0000-7000-8000-0000000000a1',
  version: 2,
  status: 'ASSIGNED',
  modality: 'HOME',
  scheduledStart: '2026-08-22T15:00:00.000Z',
  patient: { patientId: 'p1', fullName: 'Delia Paciente Ficticia', initials: 'DP' },
  professional: {
    professionalId: 'x1',
    fullName: 'Ana María Ejemplo Ficticio',
    initials: 'AE',
    professionCode: 'MEDICINA_GENERAL',
    professionName: 'Medicina general',
  },
  careAssignmentCreated: true,
};

/* ========================================================================== */
/* Ventana derivada de la fecha activa                                        */
/* ========================================================================== */

describe('ventana de calendario', () => {
  it('reconoce una fecha calendario real y rechaza las que no existen', () => {
    expect(esFechaCalendario('2026-08-22')).toBe(true);
    expect(esFechaCalendario('2026-02-31')).toBe(false);
    expect(esFechaCalendario('22-08-2026')).toBe(false);
    expect(esFechaCalendario('')).toBe(false);
  });

  it('convierte un instante a fecha calendario UTC', () => {
    expect(fechaCalendarioDe(new Date('2026-08-22T23:59:59.000Z'))).toBe('2026-08-22');
  });

  it('deriva la ventana de cada escala sin leer el reloj', () => {
    expect(ventanaDeEscala('2026-08-22', 'dia')).toStrictEqual({
      from: '2026-08-22',
      to: '2026-08-22',
    });

    // 22 de agosto de 2026 es sábado: la semana va de lunes 17 a domingo 23.
    expect(ventanaDeEscala('2026-08-22', 'semana')).toStrictEqual({
      from: '2026-08-17',
      to: '2026-08-23',
    });

    expect(ventanaDeEscala('2026-08-22', 'mes')).toStrictEqual({
      from: '2026-08-01',
      to: '2026-08-31',
    });
  });

  it('la escala mes nunca supera el máximo que la API admite', () => {
    for (const mes of [0, 1, 3, 11]) {
      const fecha = new Date(Date.UTC(2026, mes, 15)).toISOString().slice(0, 10);
      const ventana = ventanaDeEscala(fecha, 'mes');
      const dias =
        (new Date(`${ventana.to}T00:00:00.000Z`).getTime() -
          new Date(`${ventana.from}T00:00:00.000Z`).getTime()) /
          86_400_000 +
        1;

      expect(dias).toBeLessThanOrEqual(HOSPITAL_AGENDA_MAX_DIAS);
    }

    expect([...HOSPITAL_AGENDA_ESCALAS]).toStrictEqual(['dia', 'semana', 'mes']);
  });

  it('compone un instante con desplazamiento explícito y rechaza lo inválido', () => {
    const instante = instanteDeFechaHora('2026-08-22', '15:00');

    expect(instante).not.toBeNull();
    expect(instante).toMatch(/Z$/u);

    for (const [fecha, hora] of [
      ['2026-02-31', '15:00'],
      ['2026-08-22', '25:00'],
      ['2026-08-22', '15:99'],
      ['2026-08-22', ''],
      ['', '15:00'],
    ] as const) {
      expect(instanteDeFechaHora(fecha, hora)).toBeNull();
    }
  });
});

/* ========================================================================== */
/* Consulta de agenda                                                         */
/* ========================================================================== */

describe('consulta de agenda', () => {
  it('exige la ventana y la envía con credenciales y sin caché', async () => {
    const { impl, llamadas } = fetchDoble(() => ok(AGENDA));

    const resultado = await consultarAgenda({ from: '2026-08-01', to: '2026-08-31' }, impl);

    expect(resultado).toStrictEqual({ kind: 'ok', datos: AGENDA });
    expect(llamadas[0]?.url).toContain(RUTAS_HOSPITAL_AGENDA.agenda);
    expect(llamadas[0]?.url).toContain('from=2026-08-01');
    expect(llamadas[0]?.url).toContain('to=2026-08-31');
    expect(llamadas[0]?.init.method).toBe('GET');
    expect(llamadas[0]?.init.credentials).toBe('include');
    expect(llamadas[0]?.init.cache).toBe('no-store');
  });

  it('no envía tenant, rol ni actor', async () => {
    const { impl, llamadas } = fetchDoble(() => ok(AGENDA));

    await consultarAgenda({ from: '2026-08-01', to: '2026-08-31' }, impl);

    for (const prohibido of ['tenantId', 'identityId', 'role', 'actor', 'personId']) {
      expect(llamadas[0]?.url).not.toContain(prohibido);
    }
  });

  it('traduce cada código de estado y la cancelación', async () => {
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

      expect((await consultarAgenda({ from: '2026-08-01', to: '2026-08-01' }, impl)).kind).toBe(
        kind,
      );
    }

    const control = new AbortController();
    const { impl } = fetchDoble(() => ok(AGENDA));

    control.abort();

    expect(
      (await consultarAgenda({ from: '2026-08-01', to: '2026-08-01' }, impl, control.signal))
        .kind,
    ).toBe('cancelado');
  });

  it('una respuesta ilegible es error, nunca datos de demostración', async () => {
    const { impl } = fetchDoble(() => new Response('no es json', { status: 200 }));

    expect((await consultarAgenda({ from: '2026-08-01', to: '2026-08-01' }, impl)).kind).toBe(
      'error',
    );
  });
});

/* ========================================================================== */
/* Única mutación autorizada                                                  */
/* ========================================================================== */

describe('asignación de una solicitud', () => {
  const ID = '019287a1-0000-7000-8000-0000000000a1';
  const CUERPO = {
    professionalId: '019287a1-0000-7000-8000-000000000001',
    scheduledStart: '2026-08-22T15:00:00.000Z',
    expectedVersion: 1,
  };

  it('envía PATCH con el JSON EXACTO del contrato y nada más', async () => {
    const { impl, llamadas } = fetchDoble(() => ok(ASIGNADA));

    const resultado = await asignarCita(ID, CUERPO, impl);

    expect(resultado).toStrictEqual({ kind: 'ok', datos: ASIGNADA });
    expect(llamadas[0]?.url).toContain(RUTAS_HOSPITAL_AGENDA.asignacion(ID));
    expect(llamadas[0]?.init.method).toBe('PATCH');
    expect(llamadas[0]?.init.credentials).toBe('include');
    expect(llamadas[0]?.init.cache).toBe('no-store');

    const enviado = JSON.parse(String(llamadas[0]?.init.body)) as Record<string, unknown>;

    expect(Object.keys(enviado).sort()).toStrictEqual([
      'expectedVersion',
      'professionalId',
      'scheduledStart',
    ]);
    expect(enviado).toStrictEqual(CUERPO);
  });

  it('un campo extra del estado de la vista NO viaja al servidor', async () => {
    const { impl, llamadas } = fetchDoble(() => ok(ASIGNADA));

    await asignarCita(
      ID,
      { ...CUERPO, tenantId: 'ajeno', role: 'HOSPITAL_SCHEDULER' } as never,
      impl,
    );

    const enviado = String(llamadas[0]?.init.body);

    expect(enviado).not.toContain('tenantId');
    expect(enviado).not.toContain('role');
  });

  it('distingue conflicto de versión de no asignable', async () => {
    const version = fetchDoble(() => fallo(409, 'APPOINTMENT_VERSION_CONFLICT'));
    const noAsignable = fetchDoble(() => fallo(409, 'APPOINTMENT_NOT_ASSIGNABLE'));

    expect((await asignarCita(ID, CUERPO, version.impl)).kind).toBe('conflicto-version');
    expect((await asignarCita(ID, CUERPO, noAsignable.impl)).kind).toBe('no-asignable');
  });

  it('un `409` ilegible se trata como el desenlace más conservador', async () => {
    const { impl } = fetchDoble(() => new Response('vacio', { status: 409 }));

    expect((await asignarCita(ID, CUERPO, impl)).kind).toBe('conflicto-version');
  });

  it('traduce el resto de estados sin revelar la causa', async () => {
    const esperado = [
      [400, 'datos-invalidos'],
      [401, 'sin-sesion'],
      [403, 'sin-permiso'],
      [404, 'no-encontrado'],
      [503, 'no-disponible'],
      [500, 'error'],
    ] as const;

    for (const [status, kind] of esperado) {
      const { impl } = fetchDoble(() => fallo(status));

      expect((await asignarCita(ID, CUERPO, impl)).kind).toBe(kind);
    }
  });

  /*
   * Reenviar la MISMA versión no repite la operación: el servidor responde 409
   * y el cliente lo comunica como conflicto. La segunda petición no produce un
   * segundo éxito ni una segunda asignación.
   */
  it('un doble envío con la misma versión no produce dos éxitos', async () => {
    let llamada = 0;
    const { impl } = fetchDoble(() => {
      llamada += 1;

      return llamada === 1 ? ok(ASIGNADA) : fallo(409, 'APPOINTMENT_VERSION_CONFLICT');
    });

    const primera = await asignarCita(ID, CUERPO, impl);
    const segunda = await asignarCita(ID, CUERPO, impl);

    expect(primera.kind).toBe('ok');
    expect(segunda.kind).toBe('conflicto-version');
  });

  it('la cancelación y el fallo de red no se confunden', async () => {
    const control = new AbortController();
    const { impl } = fetchDoble(() => ok(ASIGNADA));

    control.abort();

    expect((await asignarCita(ID, CUERPO, impl, control.signal)).kind).toBe('cancelado');

    const red = (async () => {
      throw new TypeError('sin conexión');
    }) as unknown as typeof fetch;

    expect((await asignarCita(ID, CUERPO, red)).kind).toBe('error');
  });
});
