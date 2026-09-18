import { ForbiddenException, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { AuditService } from '../audit/audit.service';
import { type PrismaService } from '../database/prisma.service';
import { RuntimeContextUnavailableError } from '../database/runtime-context.error';
import { HUMAN_PRINCIPAL_KEY, type HumanPrincipal } from '../identity-access/human-principal';
import { type IdentityAccessService } from '../identity-access/identity-access.service';
import { type RequestWithHumanSession } from '../human-auth/human-session.guard';

import { PatientSelfController } from './patient-self.controller';
import { PATIENT_SELF_MAX_ITEMS } from './patient-self.contract';
import { PatientSelfService } from './patient-self.service';

/**
 * Pruebas FOCALES de la lectura self-scope del Paciente (spec 021 MP02, §16;
 * `contracts/paciente-self-scope.contract.md`).
 *
 * QUÉ SE PRUEBA AQUÍ: la DECISIÓN y la PROYECCIÓN. `PrismaService` y
 * `IdentityAccessService` se sustituyen por dobles que registran el `where`, el
 * `select`, el `orderBy` y el `take` recibidos, y el `AuditService` es el REAL:
 * lo que importa no es que Prisma persista, sino que la consulta lleve las dos
 * barreras de aislamiento, que la respuesta tenga EXACTAMENTE los campos
 * aprobados, y que el evento de auditoría se escriba dentro de la misma
 * transacción y sin PII.
 *
 * QUÉ NO SE PRUEBA AQUÍ, y por qué: la Row Level Security REAL contra PostgreSQL
 * pertenece al Micro-packet 3 —«DB / RLS / multitenant / IDOR, demostrado por
 * prueba ejecutada»— y su archivo está fuera de la allowlist de este paquete.
 * Aquí se demuestra que la consulta PIDE el aislamiento; allí se demostrará que
 * la base lo IMPONE.
 *
 * Todos los identificadores y nombres son FICTICIOS y opacos.
 */

const TENANT = '00000000-0000-0000-0000-0000000000a1';
const OTRO_TENANT = '00000000-0000-0000-0000-0000000000f9';
const PERSONA = '00000000-0000-0000-0000-0000000000a2';
const CUENTA = '00000000-0000-0000-0000-0000000000a3';
const SESION = '00000000-0000-0000-0000-0000000000a4';
const PACIENTE = '00000000-0000-0000-0000-0000000000b1';
/** Identificador de OTRA persona. Solo se usa para intentar colarlo. */
const PACIENTE_AJENO = '00000000-0000-0000-0000-0000000000c9';

const PRINCIPAL: HumanPrincipal = {
  sessionId: SESION,
  humanAccountId: CUENTA,
  personId: PERSONA,
  tenantId: TENANT,
};

const AHORA = new Date('2026-08-26T15:00:00.000Z');

/** Persona ficticia. Nombre compuesto a propósito: prueba el «nombre de pila». */
const PERSONA_FILA = {
  person: { givenNames: 'Ana María', familyNames: 'Pérez Gómez' },
};

const CITA_FILA = {
  id: '00000000-0000-0000-0000-0000000000d1',
  scheduledStart: new Date('2026-09-01T14:00:00.000Z'),
  modality: 'ON_SITE' as const,
  status: 'ASSIGNED' as const,
};

const VISITA_FILA = {
  id: '00000000-0000-0000-0000-0000000000e1',
  status: 'COMPLETED' as const,
  appointment: { scheduledStart: new Date('2026-08-20T13:00:00.000Z') },
};

/** Un evento de auditoría tal como lo escribió el `AuditService` real. */
interface EventoRegistrado {
  readonly [campo: string]: unknown;
}

interface Espia {
  readonly service: PatientSelfService;
  readonly controller: PatientSelfController;
  /** Tenants con los que se abrió `withTenant`, en orden. */
  readonly tenants: string[];
  /** Argumentos recibidos por cada consulta de negocio, por modelo. */
  readonly consultas: { modelo: string; args: Record<string, unknown> }[];
  /** Eventos de auditoría escritos, en orden. */
  readonly eventos: EventoRegistrado[];
}

interface OpcionesEspia {
  /** Resultado de `resolvePatient`. `null` = sin contexto PATIENT. */
  readonly paciente?: { readonly patientId: string } | null;
  /** Filas devueltas por cada modelo. */
  readonly filaPaciente?: unknown;
  readonly citas?: unknown[];
  readonly visitas?: unknown[];
  /** Hace fallar `withTenant` con un contexto de ejecución no seguro. */
  readonly contextoInseguro?: boolean;
  /** Hace fallar la escritura del evento de auditoría OBLIGATORIO. */
  readonly auditoriaRota?: boolean;
}

function espiar(opciones: OpcionesEspia = {}): Espia {
  const tenants: string[] = [];
  const consultas: { modelo: string; args: Record<string, unknown> }[] = [];
  const eventos: EventoRegistrado[] = [];

  const registrar =
    (modelo: string, resultado: unknown) =>
    async (args: Record<string, unknown>) => {
      consultas.push({ modelo, args });

      return resultado;
    };

  const tx = {
    patient: {
      findFirst: registrar(
        'patient',
        opciones.filaPaciente === undefined ? PERSONA_FILA : opciones.filaPaciente,
      ),
    },
    appointment: { findMany: registrar('appointment', opciones.citas ?? [CITA_FILA]) },
    homeVisit: { findMany: registrar('homeVisit', opciones.visitas ?? [VISITA_FILA]) },
    auditEvent: {
      create: async (args: { data: EventoRegistrado }) => {
        if (opciones.auditoriaRota === true) {
          throw new Error('audit_event no se pudo escribir.');
        }

        eventos.push(args.data);

        return { id: '00000000-0000-0000-0000-0000000000ff' };
      },
    },
  };

  const prisma = {
    withTenant: async <T,>(tenantId: string, trabajo: (tx: unknown) => Promise<T>): Promise<T> => {
      tenants.push(tenantId);

      if (opciones.contextoInseguro === true) {
        throw new RuntimeContextUnavailableError('rol runtime no adoptado');
      }

      return trabajo(tx);
    },
  } as unknown as PrismaService;

  const identity = {
    resolvePatient: async (): Promise<{ readonly patientId: string } | null> =>
      opciones.paciente === undefined ? { patientId: PACIENTE } : opciones.paciente,
  } as unknown as IdentityAccessService;

  const service = new PatientSelfService(prisma, identity, new AuditService());

  return {
    service,
    controller: new PatientSelfController(service),
    tenants,
    consultas,
    eventos,
  };
}

/** Petición con principal ya adjuntado por el guard. */
function peticionConSesion(extra: Record<string, unknown> = {}): RequestWithHumanSession {
  return {
    [HUMAN_PRINCIPAL_KEY]: PRINCIPAL,
    ...extra,
  } as unknown as RequestWithHumanSession;
}

/** Petición SIN principal: el guard no la habría dejado pasar. */
function peticionSinSesion(): RequestWithHumanSession {
  return {} as unknown as RequestWithHumanSession;
}

/** `where` de la primera consulta al modelo indicado. */
function whereDe(espia: Espia, modelo: string): Record<string, unknown> {
  const consulta = espia.consultas.find((c) => c.modelo === modelo);

  expect(consulta, `no hubo consulta a ${modelo}`).toBeDefined();

  return (consulta as { args: Record<string, unknown> }).args['where'] as Record<
    string,
    unknown
  >;
}

describe('Resumen self-scope — conjunto CERRADO de tres campos (§4.2, spec 021 §17.C-2)', () => {
  it('devuelve EXACTAMENTE nombre de pila, iniciales y la etiqueta fija', async () => {
    const espia = espiar();

    const resumen = await espia.service.readSummary(PRINCIPAL, 'corr-1', AHORA);

    // IGUALDAD DE CONJUNTO, no inclusión: un cuarto campo hace fallar la prueba.
    expect(Object.keys(resumen).sort()).toEqual(['givenName', 'initials', 'label']);
    expect(resumen).toEqual({
      givenName: 'Ana',
      initials: 'AP',
      label: 'Paciente',
    });
  });

  it('la etiqueta es FIJA y no se deriva de ningún dato de la persona', async () => {
    const primero = await espiar().service.readSummary(PRINCIPAL, 'corr-1', AHORA);
    const segundo = await espiar({
      filaPaciente: { person: { givenNames: 'Otro', familyNames: 'Distinto' } },
    }).service.readSummary(PRINCIPAL, 'corr-2', AHORA);

    expect(primero.label).toBe('Paciente');
    expect(segundo.label).toBe('Paciente');
  });

  it('NO devuelve documento, nacimiento, sexo, EPS, territorio, clínica ni identificadores', async () => {
    const espia = espiar();

    const resumen = (await espia.service.readSummary(
      PRINCIPAL,
      'corr-1',
      AHORA,
    )) as unknown as Record<string, unknown>;

    for (const prohibido of [
      'documentType',
      'documentNumber',
      'birthDate',
      'sexGenderCode',
      'epsCode',
      'epsNameControlled',
      'territory',
      'address',
      'phone',
      'email',
      'diagnoses',
      'patientId',
      'personId',
      'humanAccountId',
      'tenantId',
      'id',
      'familyNames',
      'consent',
    ]) {
      expect(resumen[prohibido], `el resumen expuso "${prohibido}"`).toBeUndefined();
    }
  });

  it('la consulta NO selecciona ninguna columna sensible de la persona', async () => {
    const espia = espiar();

    await espia.service.readSummary(PRINCIPAL, 'corr-1', AHORA);

    const select = espia.consultas[0]?.args['select'];

    // Se piden DOS columnas de nombre y nada más: ni documento, ni EPS, ni contacto.
    expect(select).toEqual({
      person: { select: { givenNames: true, familyNames: true } },
    });
  });
});

describe('Citas propias — conjunto CERRADO de tres campos (§4.3)', () => {
  it('devuelve EXACTAMENTE fecha y hora, modalidad y estado', async () => {
    const espia = espiar();

    const citas = await espia.service.readAppointments(PRINCIPAL, 'corr-1', AHORA);

    expect(Object.keys(citas)).toEqual(['items']);
    expect(citas.items).toHaveLength(1);
    expect(Object.keys(citas.items[0] as object).sort()).toEqual([
      'modality',
      'scheduledStart',
      'status',
    ]);
    expect(citas.items[0]).toEqual({
      scheduledStart: '2026-09-01T14:00:00.000Z',
      modality: 'ON_SITE',
      status: 'ASSIGNED',
    });
  });

  it('NO expone ningún identificador técnico ni dato de terceros', async () => {
    const espia = espiar();

    const citas = await espia.service.readAppointments(PRINCIPAL, 'corr-1', AHORA);
    const serializado = JSON.stringify(citas);

    for (const prohibido of [CITA_FILA.id, PACIENTE, PERSONA, CUENTA, TENANT, SESION]) {
      expect(serializado, `la respuesta filtró "${prohibido}"`).not.toContain(prohibido);
    }

    for (const clave of ['id', 'patientId', 'careAssignmentId', 'appointmentId', 'version']) {
      expect((citas.items[0] as unknown as Record<string, unknown>)[clave]).toBeUndefined();
    }
  });

  it('«próximas» lo fija el servidor: filtra por el instante del servidor y ordena estable', async () => {
    const espia = espiar();

    await espia.service.readAppointments(PRINCIPAL, 'corr-1', AHORA);

    const consulta = espia.consultas[0];

    expect((consulta?.args['where'] as Record<string, unknown>)['scheduledStart']).toEqual({
      gte: AHORA,
    });
    expect(consulta?.args['orderBy']).toEqual([{ scheduledStart: 'asc' }, { id: 'asc' }]);
    expect(consulta?.args['take']).toBe(PATIENT_SELF_MAX_ITEMS);
  });

  it('sin citas devuelve lista VACÍA y no un error (§4.6)', async () => {
    const espia = espiar({ citas: [] });

    await expect(espia.service.readAppointments(PRINCIPAL, 'corr-1', AHORA)).resolves.toEqual({
      items: [],
    });
  });
});

describe('Visitas propias — conjunto CERRADO de tres campos (§4.4)', () => {
  it('devuelve EXACTAMENTE fecha y hora, modalidad HOME y estado', async () => {
    const espia = espiar();

    const visitas = await espia.service.readVisits(PRINCIPAL, 'corr-1', AHORA);

    expect(Object.keys(visitas)).toEqual(['items']);
    expect(Object.keys(visitas.items[0] as object).sort()).toEqual([
      'modality',
      'scheduledStart',
      'status',
    ]);
    expect(visitas.items[0]).toEqual({
      scheduledStart: '2026-08-20T13:00:00.000Z',
      modality: 'HOME',
      status: 'COMPLETED',
    });
  });

  it('NO expone identificadores, identidad institucional ni historial de transiciones', async () => {
    const espia = espiar();

    const visitas = await espia.service.readVisits(PRINCIPAL, 'corr-1', AHORA);
    const serializado = JSON.stringify(visitas);

    expect(serializado).not.toContain(VISITA_FILA.id);
    expect(serializado).not.toContain(PACIENTE);

    for (const clave of [
      'id',
      'homeVisitId',
      'appointmentId',
      'patientId',
      'careAssignmentId',
      'createdByInstitutionalIdentityId',
      'transitions',
      'startedAt',
      'endedAt',
      'version',
    ]) {
      expect((visitas.items[0] as unknown as Record<string, unknown>)[clave]).toBeUndefined();
    }

    // La consulta tampoco PIDE el historial ni la identidad institucional.
    const select = JSON.stringify(espia.consultas[0]?.args['select']);
    expect(select).not.toContain('transitions');
    expect(select).not.toContain('createdByInstitutionalIdentityId');
  });

  it('«recientes» lo fija el servidor: cita ya ocurrida, orden descendente y cota fija', async () => {
    const espia = espiar();

    await espia.service.readVisits(PRINCIPAL, 'corr-1', AHORA);

    const consulta = espia.consultas[0];
    const where = consulta?.args['where'] as Record<string, unknown>;

    expect((where['appointment'] as Record<string, unknown>)['scheduledStart']).toEqual({
      lte: AHORA,
    });
    expect(consulta?.args['take']).toBe(PATIENT_SELF_MAX_ITEMS);
  });
});

describe('Self-scope, tenant y RLS — dos barreras y no una (§3.1, §3.2)', () => {
  it('las tres lecturas abren withTenant con el tenant del PRINCIPAL', async () => {
    const resumen = espiar();
    const citas = espiar();
    const visitas = espiar();

    await resumen.service.readSummary(PRINCIPAL, 'c', AHORA);
    await citas.service.readAppointments(PRINCIPAL, 'c', AHORA);
    await visitas.service.readVisits(PRINCIPAL, 'c', AHORA);

    expect(resumen.tenants).toEqual([TENANT]);
    expect(citas.tenants).toEqual([TENANT]);
    expect(visitas.tenants).toEqual([TENANT]);
  });

  it('la consulta repite el filtro explícito por tenant ADEMÁS de RLS', async () => {
    const citas = espiar();
    const visitas = espiar();

    await citas.service.readAppointments(PRINCIPAL, 'c', AHORA);
    await visitas.service.readVisits(PRINCIPAL, 'c', AHORA);

    const whereCitas = whereDe(citas, 'appointment');
    expect(whereCitas['tenantId']).toBe(TENANT);
    expect((whereCitas['patient'] as Record<string, unknown>)['tenantId']).toBe(TENANT);

    const whereVisitas = whereDe(visitas, 'homeVisit');
    expect(whereVisitas['tenantId']).toBe(TENANT);
    expect((whereVisitas['appointment'] as Record<string, unknown>)['tenantId']).toBe(TENANT);
  });

  it('el sujeto se reafirma en la fila: patientId resuelto, personId del principal y ACTIVE', async () => {
    const citas = espiar();

    await citas.service.readAppointments(PRINCIPAL, 'c', AHORA);

    const where = whereDe(citas, 'appointment');

    expect(where['patientId']).toBe(PACIENTE);
    expect(where['patient']).toEqual({
      id: PACIENTE,
      tenantId: TENANT,
      personId: PERSONA,
      status: 'ACTIVE',
    });
  });

  it('NUNCA consulta con un tenant distinto del principal', async () => {
    const espia = espiar();

    await espia.service.readVisits(PRINCIPAL, 'c', AHORA);

    expect(espia.tenants).not.toContain(OTRO_TENANT);
    expect(JSON.stringify(espia.consultas)).not.toContain(OTRO_TENANT);
  });
});

describe('CERO selectores de sujeto — sobre el contrato, no solo el comportamiento (§2)', () => {
  it('ninguna ruta declara @Param, @Query, @Body ni @Headers', () => {
    /*
     * Comprobación sobre el CONTRATO: Nest guarda bajo `__routeArguments__` un
     * mapa cuyas claves son `<tipo>:<índice>`. El tipo `0` es REQUEST; `3`, `4`,
     * `5` y `6` son BODY, QUERY, PARAM y HEADERS. Si alguna ruta declarara uno
     * de esos, aparecería aquí aunque el cuerpo del método lo ignorara.
     */
    for (const ruta of ['summary', 'appointments', 'visits']) {
      const metadatos = (Reflect.getMetadata(
        '__routeArguments__',
        PatientSelfController,
        ruta,
      ) ?? {}) as Record<string, unknown>;

      const tipos = Object.keys(metadatos).map((clave) => clave.split(':')[0]);

      expect(tipos.length, `la ruta ${ruta} no declara la petición`).toBeGreaterThan(0);

      for (const tipo of tipos) {
        expect(tipo, `la ruta ${ruta} declara un argumento de tipo ${tipo}`).toBe('0');
      }
    }
  });

  it('las tres rutas reciben UN solo argumento: la petición', () => {
    expect(PatientSelfController.prototype.summary.length).toBe(1);
    expect(PatientSelfController.prototype.appointments.length).toBe(1);
    expect(PatientSelfController.prototype.visits.length).toBe(1);
  });

  it('un patientId ajeno en consulta, cuerpo o cabecera produce una respuesta IDÉNTICA', async () => {
    const limpia = espiar();
    const contaminada = espiar();

    const sinSelector = await limpia.controller.appointments(peticionConSesion());
    const conSelector = await contaminada.controller.appointments(
      peticionConSesion({
        query: { patientId: PACIENTE_AJENO, tenantId: OTRO_TENANT },
        body: { personId: PACIENTE_AJENO, subject: PACIENTE_AJENO },
        headers: { 'x-patient-id': PACIENTE_AJENO },
        params: { patientId: PACIENTE_AJENO },
      }),
    );

    // IDOR: misma respuesta, exactamente.
    expect(conSelector).toEqual(sinSelector);

    // Y el identificador ajeno no llegó a ninguna consulta.
    expect(JSON.stringify(contaminada.consultas)).not.toContain(PACIENTE_AJENO);
    expect(JSON.stringify(contaminada.consultas)).not.toContain(OTRO_TENANT);
    expect(contaminada.tenants).toEqual([TENANT]);
  });

  it('el resumen también ignora por completo un selector ajeno', async () => {
    const limpia = espiar();
    const contaminada = espiar();

    const sinSelector = await limpia.controller.summary(peticionConSesion());
    const conSelector = await contaminada.controller.summary(
      peticionConSesion({ query: { patientId: PACIENTE_AJENO } }),
    );

    expect(conSelector).toEqual(sinSelector);
    expect(JSON.stringify(contaminada.consultas)).not.toContain(PACIENTE_AJENO);
  });
});

describe('Denegaciones uniformes y fail-closed (§3.4, §3.5)', () => {
  it('401 cuando no hay principal humano, y SIN evento de auditoría', async () => {
    const espia = espiar();

    await expect(espia.controller.summary(peticionSinSesion())).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    // Sin principal resoluble NO se inventa un actor (§9.2-1, §9.2-2).
    expect(espia.eventos).toHaveLength(0);
    expect(espia.consultas).toHaveLength(0);
  });

  it('403 sin contexto PATIENT, y la respuesta no revela si existe paciente', async () => {
    const espia = espiar({ paciente: null });

    await expect(espia.controller.appointments(peticionConSesion())).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    // No se ejecutó ninguna consulta de negocio.
    expect(espia.consultas).toHaveLength(0);
  });

  it('un paciente NO ACTIVE es fail-closed: mismo 403, sin filas y sin revelar existencia', async () => {
    /*
     * `resolvePatient` exige `status = 'ACTIVE'`, de modo que un paciente dado
     * de baja devuelve `null`. El desenlace debe ser INDISTINGUIBLE del de una
     * persona sin participación de paciente.
     */
    const inactivo = espiar({ paciente: null });
    const sinParticipacion = espiar({ paciente: null });

    const capturar = async (espia: Espia): Promise<unknown> => {
      try {
        await espia.controller.visits(peticionConSesion());
      } catch (error) {
        return (error as ForbiddenException).getResponse();
      }

      throw new Error('la lectura no debió conceder acceso');
    };

    expect(await capturar(inactivo)).toEqual(await capturar(sinParticipacion));
    expect(inactivo.consultas).toHaveLength(0);
  });

  it('las tres rutas deniegan IGUAL: mismo código y mismo cuerpo', async () => {
    const cuerpos: unknown[] = [];

    for (const ruta of ['summary', 'appointments', 'visits'] as const) {
      const espia = espiar({ paciente: null });

      try {
        await espia.controller[ruta](peticionConSesion());
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenException);
        cuerpos.push((error as ForbiddenException).getResponse());
      }
    }

    expect(cuerpos).toHaveLength(3);
    expect(cuerpos[1]).toEqual(cuerpos[0]);
    expect(cuerpos[2]).toEqual(cuerpos[0]);
  });

  it('503 cuando el contexto de ejecución no es seguro, y NUNCA una lista vacía', async () => {
    const espia = espiar({ contextoInseguro: true });

    const fallo = await espia.controller
      .appointments(peticionConSesion())
      .then(
        (resultado) => resultado as unknown,
        (error: unknown) => error,
      );

    expect(fallo).toBeInstanceOf(ServiceUnavailableException);
    // Un `[]` afirmaría «no tienes citas»; eso no es lo que ocurrió.
    expect(fallo).not.toEqual({ items: [] });
  });
});

describe('Auditoría obligatoria — fundación del Micro-packet 1 (§5)', () => {
  it('una lectura concedida registra GRANTED con su resourceType y su endpoint', async () => {
    const resumen = espiar();
    const citas = espiar();
    const visitas = espiar();

    await resumen.service.readSummary(PRINCIPAL, 'corr-r', AHORA);
    await citas.service.readAppointments(PRINCIPAL, 'corr-c', AHORA);
    await visitas.service.readVisits(PRINCIPAL, 'corr-v', AHORA);

    expect(resumen.eventos).toHaveLength(1);
    expect(resumen.eventos[0]).toMatchObject({
      eventType: 'PATIENT_SELF_ACCESS_GRANTED',
      outcome: 'SUCCESS',
      actorType: 'HUMAN_ACCOUNT',
      actorUserId: CUENTA,
      actorRole: null,
      resourceType: 'PatientSelfSummary',
      resourceId: null,
      endpoint: '/api/v1/patient-self/summary',
      tenantId: TENANT,
      correlationId: 'corr-r',
      occurredAt: AHORA,
    });

    // Las TRES proyecciones se diferencian por resourceType y endpoint, NUNCA
    // por valores distintos del enum.
    expect(citas.eventos[0]).toMatchObject({
      eventType: 'PATIENT_SELF_ACCESS_GRANTED',
      resourceType: 'PatientSelfAppointments',
      endpoint: '/api/v1/patient-self/appointments',
    });
    expect(visitas.eventos[0]).toMatchObject({
      eventType: 'PATIENT_SELF_ACCESS_GRANTED',
      resourceType: 'PatientSelfVisits',
      endpoint: '/api/v1/patient-self/visits',
    });
  });

  it('una denegación CON principal resoluble registra DENIED', async () => {
    const espia = espiar({ paciente: null });

    await expect(
      espia.service.readVisits(PRINCIPAL, 'corr-d', AHORA),
    ).rejects.toBeInstanceOf(Error);

    expect(espia.eventos).toHaveLength(1);
    expect(espia.eventos[0]).toMatchObject({
      eventType: 'PATIENT_SELF_ACCESS_DENIED',
      outcome: 'DENIED',
      actorType: 'HUMAN_ACCOUNT',
      actorUserId: CUENTA,
      actorRole: null,
      resourceId: null,
    });
  });

  /**
   * ATRIBUCIÓN DEL INTENTO DENEGADO.
   *
   * La correspondencia `resourceType` ↔ `endpoint` es CERRADA y uno a uno
   * (§9.1, §17.D-1). Atribuir toda denegación previa al resumen registraría
   * contra `/summary` un intento hecho contra `/appointments` o `/visits`: la
   * traza describiría un acceso que nunca ocurrió y perdería el que sí. Cada
   * ruta debe registrar SU proyección, también cuando deniega.
   */
  describe('el evento DENIED atribuye la proyección REALMENTE solicitada', () => {
    const CASOS = [
      {
        ruta: 'readSummary',
        resourceType: 'PatientSelfSummary',
        endpoint: '/api/v1/patient-self/summary',
      },
      {
        ruta: 'readAppointments',
        resourceType: 'PatientSelfAppointments',
        endpoint: '/api/v1/patient-self/appointments',
      },
      {
        ruta: 'readVisits',
        resourceType: 'PatientSelfVisits',
        endpoint: '/api/v1/patient-self/visits',
      },
    ] as const;

    for (const caso of CASOS) {
      it(`${caso.ruta} denegada registra ${caso.resourceType} y ${caso.endpoint}`, async () => {
        const espia = espiar({ paciente: null });

        await expect(
          espia.service[caso.ruta](PRINCIPAL, 'corr-d', AHORA),
        ).rejects.toBeInstanceOf(Error);

        expect(espia.eventos).toHaveLength(1);
        expect(espia.eventos[0]).toMatchObject({
          eventType: 'PATIENT_SELF_ACCESS_DENIED',
          outcome: 'DENIED',
          resourceType: caso.resourceType,
          endpoint: caso.endpoint,
          actorType: 'HUMAN_ACCOUNT',
          actorUserId: CUENTA,
          actorRole: null,
          resourceId: null,
          tenantId: TENANT,
          correlationId: 'corr-d',
          occurredAt: AHORA,
        });
      });
    }

    it('las tres denegaciones producen resourceType y endpoint DISTINTOS entre sí', async () => {
      const registrados: { resourceType: unknown; endpoint: unknown }[] = [];

      for (const caso of CASOS) {
        const espia = espiar({ paciente: null });

        await espia.service[caso.ruta](PRINCIPAL, 'corr-d', AHORA).catch(() => undefined);

        const evento = espia.eventos[0] as EventoRegistrado;

        registrados.push({
          resourceType: evento['resourceType'],
          endpoint: evento['endpoint'],
        });
      }

      // Ninguna ruta puede quedar atribuida a otra: tres valores, tres distintos.
      expect(new Set(registrados.map((r) => r.resourceType)).size).toBe(3);
      expect(new Set(registrados.map((r) => r.endpoint)).size).toBe(3);
    });

    it('denegar /appointments y /visits NO registra la proyección del resumen', async () => {
      for (const ruta of ['readAppointments', 'readVisits'] as const) {
        const espia = espiar({ paciente: null });

        await espia.service[ruta](PRINCIPAL, 'corr-d', AHORA).catch(() => undefined);

        const evento = espia.eventos[0] as EventoRegistrado;

        expect(evento['resourceType'], `${ruta} se atribuyó al resumen`).not.toBe(
          'PatientSelfSummary',
        );
        expect(evento['endpoint'], `${ruta} se atribuyó al endpoint del resumen`).not.toBe(
          '/api/v1/patient-self/summary',
        );
      }
    });

    it('la atribución correcta NO revela el motivo: el evento sigue sin decir si existe paciente', async () => {
      const espia = espiar({ paciente: null });

      await espia.service.readVisits(PRINCIPAL, 'corr-d', AHORA).catch(() => undefined);

      const evento = espia.eventos[0] as EventoRegistrado;
      const valores = Object.values(evento).map((valor) => String(valor));

      // El `resourceType` describe la RUTA llamada, no el motivo de la denegación.
      expect(Object.keys(evento)).not.toContain('reason');
      expect(Object.keys(evento)).not.toContain('denialReason');
      expect(valores).not.toContain('NO_PATIENT_CONTEXT');
      expect(valores).not.toContain(PACIENTE);
      expect(valores).not.toContain(PERSONA);
    });
  });

  it('el evento NO contiene PII ni contenido de la cita o de la visita', async () => {
    const espia = espiar();

    await espia.service.readAppointments(PRINCIPAL, 'corr-c', AHORA);

    const evento = espia.eventos[0] as EventoRegistrado;
    const valores = Object.values(evento).map((valor) => String(valor));

    // La aserción recorre el CONJUNTO de campos, no uno solo (§16, T4.17).
    for (const prohibido of [
      'Ana María',
      'Ana',
      'Pérez Gómez',
      'AP',
      'ON_SITE',
      'ASSIGNED',
      PERSONA,
      PACIENTE,
      CITA_FILA.id,
      '2026-09-01T14:00:00.000Z',
    ]) {
      expect(valores, `el evento filtró "${prohibido}"`).not.toContain(prohibido);
    }

    // Y tampoco un conteo de filas.
    expect(Object.keys(evento)).not.toContain('count');
  });

  it('si la auditoría obligatoria falla, la petición FALLA y no devuelve datos', async () => {
    for (const ruta of ['readSummary', 'readAppointments', 'readVisits'] as const) {
      const espia = espiar({ auditoriaRota: true });

      await expect(
        espia.service[ruta](PRINCIPAL, 'corr-x', AHORA),
        `${ruta} sirvió datos con la traza perdida`,
      ).rejects.toBeInstanceOf(Error);

      expect(espia.eventos).toHaveLength(0);
    }
  });

  it('el módulo solo CREA eventos: no actualiza ni borra auditoría', async () => {
    const espia = espiar();

    await espia.service.readSummary(PRINCIPAL, 'corr-r', AHORA);

    // El doble solo expone `create`. Cualquier `update`/`delete` habría lanzado.
    expect(espia.eventos).toHaveLength(1);
  });
});
