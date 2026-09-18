/*
 * Credenciales institucionales FICTICIAS de la suite. Deben quedar definidas
 * ANTES de importar la aplicación: el módulo institucional lee su configuración
 * una sola vez, al construirse.
 */
process.env['MERDN_HOSPITAL_PATIENT_VIEWER_SECRET'] =
  'credencial-ficticia-de-pruebas-hospital-0002';
process.env['MERDN_HOSPITAL_PATIENT_VIEWER_CODE'] = 'hospital-patient-viewer-pruebas';
process.env['MERDN_HOSPITAL_SCHEDULER_SECRET'] =
  'credencial-ficticia-de-pruebas-agenda-0003';
process.env['MERDN_HOSPITAL_SCHEDULER_CODE'] = 'hospital-scheduler-ficticio';

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';

import { AppModule } from '../src/app.module';
import { type PrismaClient } from '../src/generated/prisma/client';
import { MalformedJsonFilter } from '../src/patients/malformed-json.filter';

import { createTestPrismaClient, unavailableBanner } from './database-availability';
import { cleanupTestData, ensureOtherTenant } from './enrollment-fixtures';
import {
  CODIGO_IDENTIDAD_HOSPITAL,
  CREDENCIAL_HOSPITAL_FICTICIA,
  cookieDe,
  crearPacienteHospital,
} from './hospital-fixtures';
import {
  CAMPOS_PROHIBIDOS_OPERACIONES,
  CODIGO_IDENTIDAD_SCHEDULER,
  CREDENCIAL_SCHEDULER_FICTICIA,
  crearCitaAsignada,
  crearProfesional,
  crearSolicitud,
  limpiarIdentidadAgenda,
  limpiarOperacionesHospitalarias,
} from './hospital-core-02-fixtures';
import { limpiarIdentidadesInstitucionales } from './municipality-fixtures';

/**
 * Agenda hospitalaria y ÚNICA mutación autorizada, de extremo a extremo
 * (TASK-HOSPITAL-CORE-02 §11.2).
 *
 * Cubre la ventana de agenda, la reconciliación de conteos, el aislamiento
 * entre instituciones, la comprobación de origen, el control optimista, la
 * colisión mecánica de instante, la atomicidad de la auditoría y la ausencia de
 * toda otra mutación.
 *
 * Ejercita la aplicación NestJS completa contra PostgreSQL real. Si la base no
 * está disponible, la suite se marca como NO EJECUTADA con un motivo visible.
 *
 * Todas las personas son FICTICIAS. Ninguna prueba usa datos reales de salud.
 */

const INSTITUTIONAL_COOKIE = 'merdn_institutional_session';
const SESSIONS_PATH = '/api/v1/institutional/sessions';
/**
 * Origen web autorizado por la configuración por defecto del entorno.
 *
 * La apertura y el cierre de la sesión institucional exigen un origen
 * declarado y autorizado: sin él la petición se rechaza con `403`.
 */
const ORIGEN_WEB_AUTORIZADO = 'http://127.0.0.1:3000';
const AGENDA_PATH = '/api/v1/hospital/agenda';
const APPOINTMENTS_PATH = '/api/v1/hospital/appointments';

/** Origen web autorizado por la configuración por defecto del entorno. */
const ORIGEN_AUTORIZADO = 'http://127.0.0.1:3000';

const availability = inject('databaseAvailability');
const puedeEjecutarse = availability.available && availability.migrated;

if (!puedeEjecutarse) {
  // eslint-disable-next-line no-console
  console.warn(`\n${unavailableBanner(availability)}\n`);
}

const rolRuntimeAplicado =
  availability.engine === 'postgresql-server' &&
  process.env['RUNTIME_DATABASE_URL'] !== undefined;

if (puedeEjecutarse && !rolRuntimeAplicado) {
  process.env['MERDN_RUNTIME_ROLE'] = 'disabled';
  // eslint-disable-next-line no-console
  console.warn(
    '\nAVISO: las pruebas de Agenda se ejecutan con MERDN_RUNTIME_ROLE=disabled ' +
      'porque el motor conectado no sostiene Row Level Security bajo el rol runtime. ' +
      'El aislamiento por base de datos NO queda verificado en esta ejecución; los ' +
      'filtros explícitos por tenant de la aplicación SÍ.\n',
  );
}

/**
 * El motor de desarrollo WebAssembly serializa el acceso: una carrera REAL solo
 * es concluyente contra un servidor PostgreSQL. La prueba de concurrencia se
 * ejecuta igualmente —el control optimista debe ganar en los dos motores—, pero
 * su carácter concluyente se declara aquí para no confundir los dos casos.
 */
const concurrenciaReal = availability.engine === 'postgresql-server';

describe.skipIf(!puedeEjecutarse)('API Hospital · Agenda y asignación', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let tenantId: string;
  let otroTenantId: string;
  let identityId: string;
  let cookieAgenda: string;
  let cookieViewer: string;

  beforeAll(async () => {
    prisma = createTestPrismaClient();
    await limpiarOperacionesHospitalarias(prisma);
    await cleanupTestData(prisma);
    await limpiarIdentidadAgenda(prisma);
    await limpiarIdentidadesInstitucionales(prisma);

    const tenant = await prisma.tenant.findUnique({
      where: { code: process.env['MERDN_ACTIVE_TENANT_CODE'] ?? 'merdn-mvp' },
      select: { id: true },
    });

    if (tenant === null) {
      throw new Error('El tenant institucional MVP no existe: aplique las migraciones.');
    }

    tenantId = tenant.id;
    otroTenantId = await ensureOtherTenant(prisma);

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new MalformedJsonFilter());
    await app.init();

    cookieAgenda = await abrirSesion(
      CREDENCIAL_SCHEDULER_FICTICIA,
      CODIGO_IDENTIDAD_SCHEDULER,
    );
    cookieViewer = await abrirSesion(
      CREDENCIAL_HOSPITAL_FICTICIA,
      CODIGO_IDENTIDAD_HOSPITAL,
    );

    const identidad = await prisma.institutionalIdentity.findFirst({
      where: { tenantId, code: CODIGO_IDENTIDAD_SCHEDULER },
      select: { id: true },
    });

    if (identidad === null) {
      throw new Error('La identidad institucional de agenda no se aprovisionó.');
    }

    identityId = identidad.id;
  });

  beforeEach(async () => {
    await limpiarOperacionesHospitalarias(prisma);
    await cleanupTestData(prisma);
  });

  afterAll(async () => {
    if (app !== undefined) {
      await app.close();
    }

    if (prisma !== undefined) {
      await limpiarOperacionesHospitalarias(prisma);
      await cleanupTestData(prisma);
      await limpiarIdentidadAgenda(prisma);
      await limpiarIdentidadesInstitucionales(prisma);
      await prisma.$disconnect();
    }
  });

  async function abrirSesion(accessSecret: string, identityCode: string): Promise<string> {
    const respuesta = await request(app.getHttpServer())
      .post(SESSIONS_PATH)
      .set('Origin', ORIGEN_WEB_AUTORIZADO)
      .send({ accessSecret, identityCode })
      .expect(201);

    const cookie = cookieDe(respuesta.headers['set-cookie']);

    if (cookie === null) {
      throw new Error('La respuesta no entregó la cookie institucional.');
    }

    return cookie;
  }

  function comoAgenda(path: string): request.Test {
    return request(app.getHttpServer())
      .get(path)
      .set('Cookie', `${INSTITUTIONAL_COOKIE}=${cookieAgenda}`);
  }

  /** PATCH de asignación con sesión y origen válidos. */
  function asignar(appointmentId: string, cuerpo: unknown): request.Test {
    return request(app.getHttpServer())
      .patch(`${APPOINTMENTS_PATH}/${appointmentId}/assignment`)
      .set('Cookie', `${INSTITUTIONAL_COOKIE}=${cookieAgenda}`)
      .set('Origin', ORIGEN_AUTORIZADO)
      .send(cuerpo as object);
  }

  /** Escenario mínimo: un profesional asignable y una solicitud pendiente. */
  async function escenario(): Promise<{
    readonly professionalId: string;
    readonly patientId: string;
    readonly appointmentId: string;
  }> {
    const profesional = await crearProfesional(prisma, {
      tenantId,
      givenNames: 'Ana María',
      familyNames: 'Ejemplo Ficticio',
    });

    const paciente = await crearPacienteHospital(prisma, {
      tenantId,
      givenNames: 'Delia',
      familyNames: 'Paciente Ficticia',
      birthDate: new Date(Date.UTC(1950, 3, 10)),
    });

    const appointmentId = await crearSolicitud(prisma, {
      tenantId,
      patientId: paciente.patientId,
      modality: 'HOME',
    });

    return {
      professionalId: profesional.professionalId,
      patientId: paciente.patientId,
      appointmentId,
    };
  }

  /* ====================================================================== */
  /* Agenda                                                                  */
  /* ====================================================================== */

  describe('agenda', () => {
    it('exige la ventana y rechaza una inválida', async () => {
      await comoAgenda(AGENDA_PATH).expect(400);
      await comoAgenda(`${AGENDA_PATH}?from=2026-08-01`).expect(400);
      await comoAgenda(`${AGENDA_PATH}?from=2026-08-31&to=2026-08-01`).expect(400);
      await comoAgenda(`${AGENDA_PATH}?from=2026-08-01&to=2026-09-02`).expect(400);
      await comoAgenda(`${AGENDA_PATH}?from=2026-02-31&to=2026-03-01`).expect(400);

      const desconocido = await comoAgenda(
        `${AGENDA_PATH}?from=2026-08-01&to=2026-08-31&view=mes`,
      ).expect(400);

      expect(desconocido.body.code).toBe('HOSPITAL_OPERATIONS_INVALID_QUERY');
    });

    it('una ventana sin citas devuelve ceros honestos, no un mes de demostración', async () => {
      const respuesta = await comoAgenda(
        `${AGENDA_PATH}?from=2026-08-01&to=2026-08-31`,
      ).expect(200);

      expect(respuesta.body.totalAppointments).toBe(0);
      expect(respuesta.body.appointments).toStrictEqual([]);
      expect(respuesta.body.dailyCounts).toHaveLength(31);
      expect(
        respuesta.body.dailyCounts.every(
          (dia: { readonly total: number }) => dia.total === 0,
        ),
      ).toBe(true);
      expect(respuesta.body.modalityCounts).toHaveLength(3);
      // Los conteos por modalidad también son cero, no ausentes.
      expect(
        respuesta.body.modalityCounts.every(
          (modalidad: { readonly total: number }) => modalidad.total === 0,
        ),
      ).toBe(true);
    });

    it('reconcilia solicitudes, citas y conteos con lo persistido', async () => {
      const { professionalId, patientId, appointmentId } = await escenario();

      const otroPaciente = await crearPacienteHospital(prisma, {
        tenantId,
        givenNames: 'Elena',
        familyNames: 'Segunda Ficticia',
        birthDate: new Date(Date.UTC(1955, 1, 2)),
      });

      await crearCitaAsignada(prisma, {
        tenantId,
        patientId: otroPaciente.patientId,
        professionalId,
        identityId,
        modality: 'VIRTUAL',
        scheduledStart: new Date(Date.UTC(2026, 7, 22, 15, 0, 0)),
      });

      const respuesta = await comoAgenda(
        `${AGENDA_PATH}?from=2026-08-01&to=2026-08-31`,
      ).expect(200);

      expect(respuesta.body.requests).toHaveLength(1);
      expect(respuesta.body.requests[0]).toMatchObject({
        appointmentId,
        version: 1,
        modality: 'HOME',
      });
      expect(respuesta.body.requests[0].patient).toStrictEqual({
        patientId,
        fullName: 'Delia Paciente Ficticia',
        initials: 'DP',
      });

      expect(respuesta.body.assignableProfessionals).toHaveLength(1);
      expect(respuesta.body.assignableProfessionals[0].professionalId).toBe(professionalId);

      expect(respuesta.body.totalAppointments).toBe(1);
      expect(respuesta.body.appointments[0].professional.professionalId).toBe(
        professionalId,
      );

      // Los conteos derivan de las MISMAS citas publicadas.
      const suma = respuesta.body.dailyCounts.reduce(
        (total: number, dia: { readonly total: number }) => total + dia.total,
        0,
      );

      expect(suma).toBe(respuesta.body.totalAppointments);

      const virtuales = respuesta.body.modalityCounts.find(
        (modalidad: { readonly modality: string }) => modalidad.modality === 'VIRTUAL',
      );

      expect(virtuales.total).toBe(1);

      const dia22 = respuesta.body.dailyCounts.find(
        (dia: { readonly date: string }) => dia.date === '2026-08-22',
      );

      expect(dia22.total).toBe(1);
    });

    it('una cita fuera de la ventana no aparece ni se cuenta', async () => {
      const { professionalId } = await escenario();

      const otroPaciente = await crearPacienteHospital(prisma, {
        tenantId,
        givenNames: 'Elena',
        familyNames: 'Segunda Ficticia',
        birthDate: new Date(Date.UTC(1955, 1, 2)),
      });

      await crearCitaAsignada(prisma, {
        tenantId,
        patientId: otroPaciente.patientId,
        professionalId,
        identityId,
        scheduledStart: new Date(Date.UTC(2026, 8, 15, 15, 0, 0)),
      });

      const respuesta = await comoAgenda(
        `${AGENDA_PATH}?from=2026-08-01&to=2026-08-31`,
      ).expect(200);

      expect(respuesta.body.totalAppointments).toBe(0);
    });

    it('un profesional sin vínculo vigente no es asignable', async () => {
      await crearProfesional(prisma, {
        tenantId,
        givenNames: 'Carmen',
        familyNames: 'Sin Vinculo Ficticia',
        affiliation: null,
      });

      await crearProfesional(prisma, {
        tenantId,
        givenNames: 'Diana',
        familyNames: 'Vinculo Terminado',
        affiliation: { status: 'ENDED' },
      });

      const respuesta = await comoAgenda(
        `${AGENDA_PATH}?from=2026-08-01&to=2026-08-31`,
      ).expect(200);

      expect(respuesta.body.assignableProfessionals).toStrictEqual([]);
    });

    it('no filtra datos de otra institución', async () => {
      const ajeno = await crearProfesional(prisma, {
        tenantId: otroTenantId,
        givenNames: 'Elena',
        familyNames: 'Ajena Ficticia',
      });

      const pacienteAjeno = await crearPacienteHospital(prisma, {
        tenantId: otroTenantId,
        givenNames: 'Fabio',
        familyNames: 'Ajeno Ficticio',
        birthDate: new Date(Date.UTC(1948, 5, 5)),
      });

      await crearSolicitud(prisma, {
        tenantId: otroTenantId,
        patientId: pacienteAjeno.patientId,
      });

      const respuesta = await comoAgenda(
        `${AGENDA_PATH}?from=2026-08-01&to=2026-08-31`,
      ).expect(200);

      const cuerpo = JSON.stringify(respuesta.body);

      expect(respuesta.body.requests).toStrictEqual([]);
      expect(respuesta.body.assignableProfessionals).toStrictEqual([]);
      expect(cuerpo).not.toContain('Ajena Ficticia');
      expect(cuerpo).not.toContain('Ajeno Ficticio');
      expect(cuerpo).not.toContain(ajeno.professionalId);
    });

    it('la respuesta no contiene ningún campo prohibido y no es cacheable', async () => {
      await escenario();

      const respuesta = await comoAgenda(
        `${AGENDA_PATH}?from=2026-08-01&to=2026-08-31`,
      ).expect(200);

      const cuerpo = JSON.stringify(respuesta.body);

      for (const prohibido of CAMPOS_PROHIBIDOS_OPERACIONES) {
        expect(cuerpo).not.toContain(prohibido);
      }

      expect(respuesta.headers['cache-control']).toBe('private, no-store');
      expect(respuesta.headers['vary']).toContain('Cookie');
    });
  });

  /* ====================================================================== */
  /* Asignación: autorización y validación                                   */
  /* ====================================================================== */

  describe('asignación · autorización y validación', () => {
    it('sin sesión responde 401 y con rol de solo lectura responde 403', async () => {
      const { professionalId, appointmentId } = await escenario();
      const cuerpo = {
        professionalId,
        scheduledStart: '2026-08-22T15:00:00.000Z',
        expectedVersion: 1,
      };

      await request(app.getHttpServer())
        .patch(`${APPOINTMENTS_PATH}/${appointmentId}/assignment`)
        .set('Origin', ORIGEN_AUTORIZADO)
        .send(cuerpo)
        .expect(401);

      /*
       * `HOSPITAL_PATIENT_VIEWER` es de SOLO LECTURA y NO gana esta escritura.
       * Es el punto exacto que TASK-HOSPITAL-CORE-02 §3.1 protege.
       */
      const denegado = await request(app.getHttpServer())
        .patch(`${APPOINTMENTS_PATH}/${appointmentId}/assignment`)
        .set('Cookie', `${INSTITUTIONAL_COOKIE}=${cookieViewer}`)
        .set('Origin', ORIGEN_AUTORIZADO)
        .send(cuerpo)
        .expect(403);

      expect(denegado.body.code).toBe('INSTITUTIONAL_ROLE_REQUIRED');

      // Y la solicitud sigue intacta: ninguna denegación escribió nada.
      const cita = await prisma.appointment.findUnique({
        where: { id: appointmentId },
        select: { status: true, version: true, careAssignmentId: true },
      });

      expect(cita).toMatchObject({ status: 'REQUESTED', version: 1, careAssignmentId: null });
    });

    it('rechaza la petición cuando el origen no está configurado', async () => {
      const { professionalId, appointmentId } = await escenario();
      const cuerpo = {
        professionalId,
        scheduledStart: '2026-08-22T15:00:00.000Z',
        expectedVersion: 1,
      };

      for (const origen of ['https://sitio-ajeno.invalid', 'null']) {
        const respuesta = await request(app.getHttpServer())
          .patch(`${APPOINTMENTS_PATH}/${appointmentId}/assignment`)
          .set('Cookie', `${INSTITUTIONAL_COOKIE}=${cookieAgenda}`)
          .set('Origin', origen)
          .send(cuerpo)
          .expect(403);

        expect(respuesta.body.code).toBe('INSTITUTIONAL_ROLE_REQUIRED');
      }

      // Sin `Origin` ni `Referer`: denegación por defecto.
      await request(app.getHttpServer())
        .patch(`${APPOINTMENTS_PATH}/${appointmentId}/assignment`)
        .set('Cookie', `${INSTITUTIONAL_COOKIE}=${cookieAgenda}`)
        .send(cuerpo)
        .expect(403);

      const cita = await prisma.appointment.findUnique({
        where: { id: appointmentId },
        select: { status: true, version: true },
      });

      expect(cita).toMatchObject({ status: 'REQUESTED', version: 1 });
    });

    it('rechaza cuerpos con campos desconocidos, ausentes o mal formados', async () => {
      const { professionalId, appointmentId } = await escenario();
      const valido = {
        professionalId,
        scheduledStart: '2026-08-22T15:00:00.000Z',
        expectedVersion: 1,
      };

      const invalidos: readonly unknown[] = [
        {},
        { ...valido, tenantId: otroTenantId },
        { ...valido, identityId },
        { ...valido, role: 'HOSPITAL_SCHEDULER' },
        { ...valido, status: 'ASSIGNED' },
        { professionalId, scheduledStart: valido.scheduledStart },
        { ...valido, expectedVersion: 0 },
        { ...valido, expectedVersion: '1' },
        { ...valido, professionalId: 'no-es-uuid' },
        // Instante SIN desplazamiento horario explícito.
        { ...valido, scheduledStart: '2026-08-22T15:00:00' },
        { ...valido, scheduledStart: '2026-08-22' },
      ];

      for (const cuerpo of invalidos) {
        const respuesta = await asignar(appointmentId, cuerpo).expect(400);

        expect(respuesta.body.code).toBe('HOSPITAL_OPERATIONS_INVALID_BODY');
      }

      // Un identificador de cita mal formado es 400, no 404.
      const malFormado = await asignar('no-es-uuid', valido).expect(400);

      expect(malFormado.body.code).toBe('HOSPITAL_OPERATIONS_INVALID_QUERY');
    });

    it('devuelve 404 uniforme ante cita o profesional inexistente o ajeno', async () => {
      const { professionalId, appointmentId } = await escenario();

      const inexistente = await asignar('019287a1-0000-7000-8000-00000000dead', {
        professionalId,
        scheduledStart: '2026-08-22T15:00:00.000Z',
        expectedVersion: 1,
      }).expect(404);

      expect(inexistente.body.code).toBe('HOSPITAL_APPOINTMENT_NOT_FOUND');

      const ajeno = await crearProfesional(prisma, {
        tenantId: otroTenantId,
        givenNames: 'Elena',
        familyNames: 'Ajena Ficticia',
      });

      const cruzado = await asignar(appointmentId, {
        professionalId: ajeno.professionalId,
        scheduledStart: '2026-08-22T15:00:00.000Z',
        expectedVersion: 1,
      }).expect(404);

      expect(cruzado.body.code).toBe('HOSPITAL_PROFESSIONAL_NOT_FOUND');
    });

    it('un profesional inactivo o sin vínculo no es asignable, con 404 uniforme', async () => {
      const { appointmentId } = await escenario();

      const inactivo = await crearProfesional(prisma, {
        tenantId,
        givenNames: 'Carmen',
        familyNames: 'Inactiva Ficticia',
        status: 'INACTIVE',
      });

      const sinVinculo = await crearProfesional(prisma, {
        tenantId,
        givenNames: 'Diana',
        familyNames: 'Sin Vinculo Ficticia',
        affiliation: null,
      });

      for (const professionalId of [inactivo.professionalId, sinVinculo.professionalId]) {
        const respuesta = await asignar(appointmentId, {
          professionalId,
          scheduledStart: '2026-08-22T15:00:00.000Z',
          expectedVersion: 1,
        }).expect(404);

        expect(respuesta.body.code).toBe('HOSPITAL_PROFESSIONAL_NOT_FOUND');
      }
    });
  });

  /* ====================================================================== */
  /* Asignación: comportamiento                                              */
  /* ====================================================================== */

  describe('asignación · comportamiento', () => {
    it('crea el vínculo, actualiza la cita y audita, todo o nada', async () => {
      const { professionalId, patientId, appointmentId } = await escenario();
      const antes = new Date();

      const respuesta = await asignar(appointmentId, {
        professionalId,
        scheduledStart: '2026-08-22T15:00:00.000Z',
        expectedVersion: 1,
      }).expect(200);

      expect(respuesta.body).toMatchObject({
        appointmentId,
        version: 2,
        status: 'ASSIGNED',
        modality: 'HOME',
        scheduledStart: '2026-08-22T15:00:00.000Z',
        careAssignmentCreated: true,
      });
      expect(respuesta.body.professional.professionalId).toBe(professionalId);
      expect(respuesta.body.patient.patientId).toBe(patientId);
      expect(respuesta.headers['cache-control']).toBe('private, no-store');

      const asignacion = await prisma.careAssignment.findFirst({
        where: { tenantId, patientId },
        select: {
          professionalId: true,
          role: true,
          status: true,
          createdByIdentityId: true,
        },
      });

      expect(asignacion).toMatchObject({
        professionalId,
        role: 'PRIMARY',
        status: 'ACTIVE',
        // El actor es la identidad institucional OPACA, nunca la profesional.
        createdByIdentityId: identityId,
      });

      const cita = await prisma.appointment.findUnique({
        where: { id: appointmentId },
        select: { status: true, version: true, careAssignmentId: true, scheduledStart: true },
      });

      expect(cita?.status).toBe('ASSIGNED');
      expect(cita?.version).toBe(2);
      expect(cita?.careAssignmentId).not.toBeNull();

      const eventos = await prisma.auditEvent.findMany({
        where: { tenantId, occurredAt: { gte: antes } },
        select: {
          eventType: true,
          actorUserId: true,
          actorRole: true,
          resourceType: true,
          resourceId: true,
          outcome: true,
          endpoint: true,
        },
      });

      const tipos = eventos.map((evento) => evento.eventType);

      expect(tipos).toContain('CARE_ASSIGNMENT_CREATED');
      expect(tipos).toContain('APPOINTMENT_ASSIGNED');

      const asignada = eventos.find((evento) => evento.eventType === 'APPOINTMENT_ASSIGNED');

      expect(asignada).toMatchObject({
        actorUserId: identityId,
        actorRole: 'HOSPITAL_SCHEDULER',
        resourceType: 'Appointment',
        resourceId: appointmentId,
        outcome: 'SUCCESS',
        endpoint: 'PATCH /api/v1/hospital/appointments/:appointmentId/assignment',
      });
    });

    it('reutiliza el vínculo existente en lugar de duplicarlo', async () => {
      const { professionalId, patientId, appointmentId } = await escenario();

      await asignar(appointmentId, {
        professionalId,
        scheduledStart: '2026-08-22T15:00:00.000Z',
        expectedVersion: 1,
      }).expect(200);

      const segunda = await crearSolicitud(prisma, { tenantId, patientId });

      const respuesta = await asignar(segunda, {
        professionalId,
        scheduledStart: '2026-08-23T15:00:00.000Z',
        expectedVersion: 1,
      }).expect(200);

      expect(respuesta.body.careAssignmentCreated).toBe(false);

      const asignaciones = await prisma.careAssignment.count({
        where: { tenantId, patientId },
      });

      expect(asignaciones).toBe(1);
    });

    it('rechaza reasignar a otro profesional: terminar el vínculo es otra Task', async () => {
      const { professionalId, patientId, appointmentId } = await escenario();

      await asignar(appointmentId, {
        professionalId,
        scheduledStart: '2026-08-22T15:00:00.000Z',
        expectedVersion: 1,
      }).expect(200);

      const otro = await crearProfesional(prisma, {
        tenantId,
        givenNames: 'Bruno',
        familyNames: 'Segundo Ficticio',
      });

      const segunda = await crearSolicitud(prisma, { tenantId, patientId });

      const respuesta = await asignar(segunda, {
        professionalId: otro.professionalId,
        scheduledStart: '2026-08-24T15:00:00.000Z',
        expectedVersion: 1,
      }).expect(409);

      expect(respuesta.body.code).toBe('APPOINTMENT_NOT_ASSIGNABLE');
    });

    it('reenviar la versión anterior NO repite ni duplica la operación', async () => {
      const { professionalId, appointmentId } = await escenario();
      const cuerpo = {
        professionalId,
        scheduledStart: '2026-08-22T15:00:00.000Z',
        expectedVersion: 1,
      };

      await asignar(appointmentId, cuerpo).expect(200);

      const repetida = await asignar(appointmentId, cuerpo).expect(409);

      expect(repetida.body.code).toBe('APPOINTMENT_VERSION_CONFLICT');

      const cita = await prisma.appointment.findUnique({
        where: { id: appointmentId },
        select: { version: true, status: true },
      });

      expect(cita).toMatchObject({ version: 2, status: 'ASSIGNED' });
    });

    it('bloquea el mismo instante del mismo profesional sin revelar la cita', async () => {
      const { professionalId, appointmentId } = await escenario();
      const instante = '2026-08-22T15:00:00.000Z';

      await asignar(appointmentId, {
        professionalId,
        scheduledStart: instante,
        expectedVersion: 1,
      }).expect(200);

      const otroPaciente = await crearPacienteHospital(prisma, {
        tenantId,
        givenNames: 'Elena',
        familyNames: 'Segunda Ficticia',
        birthDate: new Date(Date.UTC(1955, 1, 2)),
      });

      const segunda = await crearSolicitud(prisma, {
        tenantId,
        patientId: otroPaciente.patientId,
      });

      const respuesta = await asignar(segunda, {
        professionalId,
        scheduledStart: instante,
        expectedVersion: 1,
      }).expect(409);

      expect(respuesta.body.code).toBe('APPOINTMENT_NOT_ASSIGNABLE');
      // No revela qué cita colisionó ni de qué persona es.
      expect(JSON.stringify(respuesta.body)).not.toContain(appointmentId);
      expect(JSON.stringify(respuesta.body)).not.toContain('Delia');

      // Un instante distinto SÍ se admite: no se modela duración ni solapamiento.
      await asignar(segunda, {
        professionalId,
        scheduledStart: '2026-08-22T15:01:00.000Z',
        expectedVersion: 1,
      }).expect(200);
    });

    it('ante dos peticiones con la MISMA versión esperada, exactamente una gana', async () => {
      const { professionalId, appointmentId } = await escenario();
      const cuerpo = {
        professionalId,
        scheduledStart: '2026-08-22T15:00:00.000Z',
        expectedVersion: 1,
      };

      const [primera, segunda] = await Promise.all([
        asignar(appointmentId, cuerpo),
        asignar(appointmentId, cuerpo),
      ]);

      const estados = [primera.status, segunda.status].sort((a, b) => a - b);

      expect(estados).toStrictEqual([200, 409]);

      const cita = await prisma.appointment.findUnique({
        where: { id: appointmentId },
        select: { version: true, status: true },
      });

      // La versión avanzó UNA sola vez: la perdedora no escribió nada.
      expect(cita).toMatchObject({ version: 2, status: 'ASSIGNED' });

      const asignaciones = await prisma.careAssignment.count({ where: { tenantId } });

      expect(asignaciones).toBe(1);

      if (!concurrenciaReal) {
        // eslint-disable-next-line no-console
        console.warn(
          '\nAVISO: el motor conectado serializa las transacciones. El control ' +
            'optimista queda comprobado, pero la CARRERA real no: repítase contra un ' +
            'servidor PostgreSQL antes de considerarla verificada.\n',
        );
      }
    });

    /*
     * Atomicidad de la auditoría. Se instala una restricción TEMPORAL que impide
     * registrar el evento de asignación; la mutación debe revertirse ENTERA.
     *
     * La restricción se declara `NOT VALID` para que no examine las filas ya
     * escritas —`audit_event` es append-only y no se reinterpreta— y se retira
     * en el `finally`, de modo que el esquema queda exactamente como estaba.
     */
    it('si la auditoría falla, la mutación completa se revierte', async () => {
      const { professionalId, patientId, appointmentId } = await escenario();

      await prisma.$executeRawUnsafe(
        `ALTER TABLE "audit_event"
           ADD CONSTRAINT "tmp_core02_bloquea_auditoria"
           CHECK ("eventType"::text <> 'APPOINTMENT_ASSIGNED') NOT VALID`,
      );

      try {
        const respuesta = await asignar(appointmentId, {
          professionalId,
          scheduledStart: '2026-08-22T15:00:00.000Z',
          expectedVersion: 1,
        });

        expect(respuesta.status).toBeGreaterThanOrEqual(500);
      } finally {
        await prisma.$executeRawUnsafe(
          `ALTER TABLE "audit_event" DROP CONSTRAINT "tmp_core02_bloquea_auditoria"`,
        );
      }

      const cita = await prisma.appointment.findUnique({
        where: { id: appointmentId },
        select: { status: true, version: true, careAssignmentId: true },
      });

      expect(cita).toMatchObject({ status: 'REQUESTED', version: 1, careAssignmentId: null });

      const asignaciones = await prisma.careAssignment.count({
        where: { tenantId, patientId },
      });

      expect(asignaciones).toBe(0);
    });
  });

  /* ====================================================================== */
  /* Alcance negativo                                                        */
  /* ====================================================================== */

  describe('alcance negativo', () => {
    it('no existe reprogramar, rechazar, cancelar, crear ni desasignar', async () => {
      const { appointmentId } = await escenario();
      const servidor = app.getHttpServer();

      const rutas: readonly [
        'post' | 'put' | 'delete' | 'patch',
        string,
      ][] = [
        ['post', APPOINTMENTS_PATH],
        ['put', `${APPOINTMENTS_PATH}/${appointmentId}/assignment`],
        ['delete', `${APPOINTMENTS_PATH}/${appointmentId}/assignment`],
        ['patch', `${APPOINTMENTS_PATH}/${appointmentId}/reschedule`],
        ['patch', `${APPOINTMENTS_PATH}/${appointmentId}/cancel`],
        ['post', '/api/v1/hospital/professionals'],
        ['patch', '/api/v1/hospital/agenda'],
        ['post', '/api/v1/hospital/visits'],
        ['post', '/api/v1/hospital/virtual-consultations'],
      ];

      for (const [metodo, ruta] of rutas) {
        const agente = request(servidor);
        const peticion =
          metodo === 'post'
            ? agente.post(ruta)
            : metodo === 'put'
              ? agente.put(ruta)
              : metodo === 'delete'
                ? agente.delete(ruta)
                : agente.patch(ruta);

        const respuesta = await peticion
          .set('Cookie', `${INSTITUTIONAL_COOKIE}=${cookieAgenda}`)
          .set('Origin', ORIGEN_AUTORIZADO)
          .send({});

        // La ruta NO existe: no es 401, no es 403 y desde luego no es 200.
        expect(respuesta.status).toBe(404);
      }
    });
  });
});
