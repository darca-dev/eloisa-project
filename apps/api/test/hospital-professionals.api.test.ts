/*
 * Credenciales institucionales FICTICIAS de la suite. Deben quedar definidas
 * ANTES de importar la aplicación: el módulo institucional lee su configuración
 * una sola vez, al construirse.
 *
 * Se configuran LAS TRES —Alcaldía, Hospital Pacientes y Agenda hospitalaria—
 * para poder ejercitar la matriz completa de permisos entre roles disjuntos.
 */
process.env['MERDN_MUNICIPAL_VIEWER_SECRET'] =
  'credencial-ficticia-de-pruebas-alcaldia-0001';
process.env['MERDN_MUNICIPAL_VIEWER_CODE'] = 'municipal-viewer-pruebas';
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
import { hashSessionToken } from '../src/enrollment-sessions/enrollment-session.tokens';
import { type PrismaClient } from '../src/generated/prisma/client';
import { MalformedJsonFilter } from '../src/patients/malformed-json.filter';

import { createTestPrismaClient, unavailableBanner } from './database-availability';
import {
  cleanupTestData,
  enrollmentBody,
  ensureOtherTenant,
  sessionTokenFromSetCookie,
} from './enrollment-fixtures';
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
  VALORES_PROHIBIDOS_OPERACIONES,
  crearCitaAsignada,
  crearProfesional,
  limpiarIdentidadAgenda,
  limpiarOperacionesHospitalarias,
} from './hospital-core-02-fixtures';
import { limpiarIdentidadesInstitucionales } from './municipality-fixtures';

/**
 * Directorio hospitalario de Profesionales, de extremo a extremo
 * (TASK-HOSPITAL-CORE-02 §11.2).
 *
 * Cubre autorización, aislamiento entre instituciones, allowlist de consulta,
 * minimización, cabeceras y auditoría. La Agenda y la ÚNICA mutación autorizada
 * viven en `hospital-agenda.api.test.ts`, en un archivo aparte porque el control
 * de abuso del inicio de sesión cuenta intentos por proceso.
 *
 * Ejercita la aplicación NestJS completa contra PostgreSQL real. Si la base no
 * está disponible, la suite se marca como NO EJECUTADA con un motivo visible:
 * no se sustituye por dobles de prueba.
 *
 * Todas las personas son FICTICIAS. Ninguna prueba usa datos reales de salud.
 */

const INSTITUTIONAL_COOKIE = 'merdn_institutional_session';
const PATIENT_COOKIE = 'merdn_enrollment_session';
const SESSIONS_PATH = '/api/v1/institutional/sessions';
/**
 * Origen web autorizado por la configuración por defecto del entorno.
 *
 * La apertura y el cierre de la sesión institucional exigen un origen
 * declarado y autorizado: sin él la petición se rechaza con `403`.
 */
const ORIGEN_WEB_AUTORIZADO = 'http://127.0.0.1:3000';
const LIST_PATH = '/api/v1/hospital/professionals';
const AGENDA_PATH = '/api/v1/hospital/agenda';
const PATIENTS_PATH = '/api/v1/hospital/patients';
const POPULATION_PATH = '/api/v1/municipality/population-summary';

const CREDENCIAL_MUNICIPAL_FICTICIA = 'credencial-ficticia-de-pruebas-alcaldia-0001';

const availability = inject('databaseAvailability');
const puedeEjecutarse = availability.available && availability.migrated;

if (!puedeEjecutarse) {
  // eslint-disable-next-line no-console
  console.warn(`\n${unavailableBanner(availability)}\n`);
}

/*
 * El motor de desarrollo WebAssembly no sostiene escrituras bajo un rol no
 * propietario con RLS y claves foráneas compuestas (limitación comprobada y
 * documentada en CORE-01). Para poder ejercitar el contrato de la API en ese
 * motor, la aplicación se arranca con el rol runtime desactivado y se deja
 * constancia. Las garantías de RLS NO se dan por verificadas aquí: se comprueban
 * en `hospital-core-02.db.test.ts`.
 */
const rolRuntimeAplicado =
  availability.engine === 'postgresql-server' &&
  process.env['RUNTIME_DATABASE_URL'] !== undefined;

if (puedeEjecutarse && !rolRuntimeAplicado) {
  process.env['MERDN_RUNTIME_ROLE'] = 'disabled';
  // eslint-disable-next-line no-console
  console.warn(
    '\nAVISO: las pruebas de operaciones hospitalarias se ejecutan con ' +
      'MERDN_RUNTIME_ROLE=disabled porque el motor conectado no sostiene Row Level ' +
      'Security bajo el rol runtime. El aislamiento por base de datos NO queda ' +
      'verificado en esta ejecución; los filtros explícitos por tenant de la ' +
      'aplicación SÍ.\n',
  );
}

describe.skipIf(!puedeEjecutarse)('API Hospital · Profesionales', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let tenantId: string;
  let otroTenantId: string;
  let identityId: string;
  let cookieAgenda: string;
  let cookieViewer: string;
  let cookieMunicipal: string;

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

    cookieAgenda = await abrirSesion(CREDENCIAL_SCHEDULER_FICTICIA, CODIGO_IDENTIDAD_SCHEDULER);
    cookieViewer = await abrirSesion(CREDENCIAL_HOSPITAL_FICTICIA, CODIGO_IDENTIDAD_HOSPITAL);
    cookieMunicipal = await abrirSesionMunicipal();

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

  async function abrirSesionMunicipal(): Promise<string> {
    const respuesta = await request(app.getHttpServer())
      .post(SESSIONS_PATH)
      .set('Origin', ORIGEN_WEB_AUTORIZADO)
      .send({ accessSecret: CREDENCIAL_MUNICIPAL_FICTICIA })
      .expect(201);

    const cookie = cookieDe(respuesta.headers['set-cookie']);

    if (cookie === null) {
      throw new Error('La respuesta no entregó la cookie institucional.');
    }

    return cookie;
  }

  /** Petición GET autenticada con el rol de agenda. */
  function comoAgenda(path: string): request.Test {
    return request(app.getHttpServer())
      .get(path)
      .set('Cookie', `${INSTITUTIONAL_COOKIE}=${cookieAgenda}`);
  }

  /** Crea el conjunto sintético estable del tenant activo. */
  async function poblarEquipo(): Promise<{
    readonly medica: string;
    readonly enfermero: string;
    readonly inactiva: string;
  }> {
    const medica = await crearProfesional(prisma, {
      tenantId,
      givenNames: 'Ana María',
      familyNames: 'Ejemplo Ficticio',
      professionCode: 'MEDICINA_GENERAL',
      professionName: 'Medicina general',
    });

    const enfermero = await crearProfesional(prisma, {
      tenantId,
      givenNames: 'Bruno',
      familyNames: 'Prueba Ficticia',
      professionCode: 'ENFERMERIA',
      professionName: 'Enfermería',
      affiliation: { engagementType: 'INDEPENDENT' },
    });

    // Perfil INACTIVO y sin vínculo: existe, pero no es asignable.
    const inactiva = await crearProfesional(prisma, {
      tenantId,
      givenNames: 'Carmen',
      familyNames: 'Tercera Ficticia',
      professionCode: 'FISIOTERAPIA',
      professionName: 'Fisioterapia',
      status: 'INACTIVE',
      affiliation: null,
    });

    return {
      medica: medica.professionalId,
      enfermero: enfermero.professionalId,
      inactiva: inactiva.professionalId,
    };
  }

  /* ====================================================================== */
  /* Matriz de autorización                                                  */
  /* ====================================================================== */

  describe('matriz 401/403', () => {
    it('sin cookie devuelve 401 y ningún dato', async () => {
      const respuesta = await request(app.getHttpServer()).get(LIST_PATH).expect(401);

      expect(respuesta.body.code).toBe('INSTITUTIONAL_SESSION_REQUIRED');
      expect(respuesta.body).not.toHaveProperty('items');
    });

    it('una sesión MUNICIPAL recibe 403 en el directorio', async () => {
      const respuesta = await request(app.getHttpServer())
        .get(LIST_PATH)
        .set('Cookie', `${INSTITUTIONAL_COOKIE}=${cookieMunicipal}`)
        .expect(403);

      expect(respuesta.body.code).toBe('INSTITUTIONAL_ROLE_REQUIRED');
      expect(respuesta.body).not.toHaveProperty('items');
    });

    /*
     * `HOSPITAL_PATIENT_VIEWER` conserva EXACTAMENTE su carácter de solo
     * lectura sobre Pacientes: no gana lectura de profesionales, no gana agenda
     * y, sobre todo, no gana ninguna escritura.
     */
    it('una sesión de consulta de Pacientes recibe 403 en operaciones', async () => {
      for (const ruta of [LIST_PATH, `${AGENDA_PATH}?from=2026-08-01&to=2026-08-31`]) {
        const respuesta = await request(app.getHttpServer())
          .get(ruta)
          .set('Cookie', `${INSTITUTIONAL_COOKIE}=${cookieViewer}`)
          .expect(403);

        expect(respuesta.body.code).toBe('INSTITUTIONAL_ROLE_REQUIRED');
      }
    });

    /* Y a la inversa: la agenda no obtiene ninguna superficie ajena. */
    it('la sesión de AGENDA no accede a Pacientes ni a Alcaldía', async () => {
      await comoAgenda(PATIENTS_PATH).expect(403);

      const municipal = await comoAgenda(POPULATION_PATH).expect(403);

      expect(municipal.body.code).toBe('INSTITUTIONAL_ROLE_REQUIRED');
    });

    it('la cookie de paciente recibe 401 en operaciones', async () => {
      const inscripcion = await request(app.getHttpServer())
        .post('/api/v1/patients/enrollments')
        .send(enrollmentBody())
        .expect(201);

      const tokenPaciente = sessionTokenFromSetCookie(inscripcion.headers['set-cookie']);

      expect(tokenPaciente).not.toBeNull();

      await request(app.getHttpServer())
        .get(LIST_PATH)
        .set('Cookie', `${PATIENT_COOKIE}=${tokenPaciente ?? ''}`)
        .expect(401);
    });

    it('un token manipulado recibe 401', async () => {
      const manipulado = `${cookieAgenda.slice(0, -1)}${
        cookieAgenda.endsWith('a') ? 'b' : 'a'
      }`;

      await request(app.getHttpServer())
        .get(LIST_PATH)
        .set('Cookie', `${INSTITUTIONAL_COOKIE}=${manipulado}`)
        .expect(401);
    });

    it('una sesión expirada, revocada o con identidad deshabilitada recibe 401', async () => {
      const cookie = await abrirSesion(
        CREDENCIAL_SCHEDULER_FICTICIA,
        CODIGO_IDENTIDAD_SCHEDULER,
      );
      const tokenHash = hashSessionToken(cookie);

      await request(app.getHttpServer())
        .get(LIST_PATH)
        .set('Cookie', `${INSTITUTIONAL_COOKIE}=${cookie}`)
        .expect(200);

      // Expirada. La base exige `expiresAt > createdAt`: se retrasan ambos.
      await prisma.$executeRaw`
        UPDATE "institutional_session"
           SET "createdAt" = now() - interval '2 hours',
               "expiresAt" = now() - interval '1 hour'
         WHERE "tokenHash" = ${tokenHash}`;

      await request(app.getHttpServer())
        .get(LIST_PATH)
        .set('Cookie', `${INSTITUTIONAL_COOKIE}=${cookie}`)
        .expect(401);

      // Revocada.
      await prisma.$executeRaw`
        UPDATE "institutional_session"
           SET "expiresAt" = now() + interval '1 hour',
               "revokedAt" = now()
         WHERE "tokenHash" = ${tokenHash}`;

      await request(app.getHttpServer())
        .get(LIST_PATH)
        .set('Cookie', `${INSTITUTIONAL_COOKIE}=${cookie}`)
        .expect(401);

      // Identidad deshabilitada: la sesión vigente deja de autenticar.
      await prisma.institutionalIdentity.updateMany({
        where: { tenantId, code: CODIGO_IDENTIDAD_SCHEDULER },
        data: { status: 'DISABLED' },
      });

      await request(app.getHttpServer())
        .get(LIST_PATH)
        .set('Cookie', `${INSTITUTIONAL_COOKIE}=${cookieAgenda}`)
        .expect(401);

      await prisma.institutionalIdentity.updateMany({
        where: { tenantId, code: CODIGO_IDENTIDAD_SCHEDULER },
        data: { status: 'ACTIVE' },
      });
    });
  });

  /* ====================================================================== */
  /* Allowlist de consulta                                                   */
  /* ====================================================================== */

  describe('allowlist de consulta', () => {
    it('rechaza un parámetro desconocido con 400', async () => {
      const respuesta = await comoAgenda(`${LIST_PATH}?rating=5`).expect(400);

      expect(respuesta.body.code).toBe('HOSPITAL_OPERATIONS_INVALID_QUERY');
    });

    it('rechaza `tenantId` inyectado por el navegador', async () => {
      for (const parametro of ['tenantId', 'identityId', 'personId', 'role', 'actor']) {
        const respuesta = await comoAgenda(
          `${LIST_PATH}?${parametro}=${otroTenantId}`,
        ).expect(400);

        expect(respuesta.body.code).toBe('HOSPITAL_OPERATIONS_INVALID_QUERY');
      }
    });

    it('rechaza un parámetro repetido y uno fuera de rango', async () => {
      await comoAgenda(`${LIST_PATH}?page=1&page=2`).expect(400);
      await comoAgenda(`${LIST_PATH}?pageSize=100`).expect(400);
      await comoAgenda(`${LIST_PATH}?page=0`).expect(400);
      await comoAgenda(`${LIST_PATH}?sort=rating`).expect(400);
      await comoAgenda(`${LIST_PATH}?professionCode=INVENTADA`).expect(400);
      await comoAgenda(`${LIST_PATH}?status=DELETED`).expect(400);
      await comoAgenda(`${LIST_PATH}?search=${'x'.repeat(101)}`).expect(400);
    });

    it('rechaza una ventana inválida en el detalle profesional', async () => {
      const { medica } = await poblarEquipo();

      // Fecha con forma correcta pero inexistente en el calendario.
      await comoAgenda(`${LIST_PATH}/${medica}?from=2026-02-31&to=2026-03-01`).expect(400);
      // Invertida.
      await comoAgenda(`${LIST_PATH}/${medica}?from=2026-08-31&to=2026-08-01`).expect(400);
      // Más de 31 días.
      await comoAgenda(`${LIST_PATH}/${medica}?from=2026-08-01&to=2026-09-02`).expect(400);
      // Solo una de las dos.
      await comoAgenda(`${LIST_PATH}/${medica}?from=2026-08-01`).expect(400);
    });

    it('rechaza un identificador mal formado con 400, no con 404', async () => {
      const respuesta = await comoAgenda(`${LIST_PATH}/no-es-un-uuid`).expect(400);

      expect(respuesta.body.code).toBe('HOSPITAL_OPERATIONS_INVALID_QUERY');
    });
  });

  /* ====================================================================== */
  /* Lectura y minimización                                                  */
  /* ====================================================================== */

  describe('directorio', () => {
    it('sin profesionales devuelve un vacío honesto, no una demostración', async () => {
      const respuesta = await comoAgenda(LIST_PATH).expect(200);

      expect(respuesta.body.totalItems).toBe(0);
      expect(respuesta.body.items).toStrictEqual([]);
      expect(respuesta.body.source).toBe('ELOISA_POSTGRESQL');
    });

    it('devuelve identidad minimizada, profesión controlada y vínculo declarado', async () => {
      await poblarEquipo();

      const respuesta = await comoAgenda(`${LIST_PATH}?sort=name&direction=asc`).expect(200);

      expect(respuesta.body.totalItems).toBe(3);

      const primera = respuesta.body.items[0];

      expect(primera.fullName).toBe('Ana María Ejemplo Ficticio');
      expect(primera.initials).toBe('AE');
      expect(primera.professionCode).toBe('MEDICINA_GENERAL');
      expect(primera.professionName).toBe('Medicina general');
      expect(primera.status).toBe('ACTIVE');
      expect(primera.activeAffiliation).toMatchObject({
        engagementType: 'EMPLOYEE',
        status: 'ACTIVE',
        startsOn: '2026-01-15',
        endsOn: null,
      });
      // Sin dominios que no existen.
      expect(primera.ratingAvailability).toBe('No disponible');
      expect(primera).not.toHaveProperty('rating');
      expect(primera).not.toHaveProperty('availability');
    });

    it('un profesional sin vínculo publica `null`, no un vínculo inventado', async () => {
      await poblarEquipo();

      const respuesta = await comoAgenda(`${LIST_PATH}?status=INACTIVE`).expect(200);

      expect(respuesta.body.items).toHaveLength(1);
      expect(respuesta.body.items[0].activeAffiliation).toBeNull();
      expect(respuesta.body.items[0].status).toBe('INACTIVE');
    });

    it('filtra por profesión, vínculo, estado y nombre en el servidor', async () => {
      await poblarEquipo();

      const porProfesion = await comoAgenda(
        `${LIST_PATH}?professionCode=ENFERMERIA`,
      ).expect(200);
      expect(porProfesion.body.totalItems).toBe(1);

      const porVinculo = await comoAgenda(
        `${LIST_PATH}?affiliationType=INDEPENDENT`,
      ).expect(200);
      expect(porVinculo.body.totalItems).toBe(1);

      const porEstado = await comoAgenda(`${LIST_PATH}?status=ACTIVE`).expect(200);
      expect(porEstado.body.totalItems).toBe(2);

      const porNombre = await comoAgenda(`${LIST_PATH}?search=Ana%20Ejemplo`).expect(200);
      expect(porNombre.body.totalItems).toBe(1);
      expect(porNombre.body.items[0].fullName).toBe('Ana María Ejemplo Ficticio');

      const sinResultados = await comoAgenda(`${LIST_PATH}?search=Inexistente`).expect(200);
      expect(sinResultados.body.totalItems).toBe(0);
      expect(sinResultados.body.items).toStrictEqual([]);
    });

    it('pagina en el servidor y corrige una página fuera de rango', async () => {
      await poblarEquipo();

      const pagina = await comoAgenda(`${LIST_PATH}?page=9&pageSize=25`).expect(200);

      expect(pagina.body.page).toBe(1);
      expect(pagina.body.totalPages).toBe(1);
      expect(pagina.body.items).toHaveLength(3);
    });

    it('deriva conteos y próxima cita de los registros persistidos', async () => {
      const { medica } = await poblarEquipo();

      const paciente = await crearPacienteHospital(prisma, {
        tenantId,
        givenNames: 'Delia',
        familyNames: 'Paciente Ficticia',
        birthDate: new Date(Date.UTC(1950, 3, 10)),
      });

      // Una hora después puede ser mañana UTC. Comprobar por separado la
      // actividad del día y la próxima cita evita esa dependencia horaria.
      const hoy = new Date();
      hoy.setUTCHours(0, 0, 0, 0);
      const futuro = new Date(hoy.getTime() + 25 * 60 * 60 * 1000);

      await crearCitaAsignada(prisma, {
        tenantId,
        patientId: paciente.patientId,
        professionalId: medica,
        identityId,
        scheduledStart: hoy,
      });

      await crearCitaAsignada(prisma, {
        tenantId,
        patientId: paciente.patientId,
        professionalId: medica,
        identityId,
        scheduledStart: futuro,
      });

      const respuesta = await comoAgenda(`${LIST_PATH}?search=Ana`).expect(200);
      const ficha = respuesta.body.items[0];

      expect(ficha.activePatientCount).toBe(1);
      expect(ficha.todayAppointmentCount).toBe(1);
      expect(ficha.nextAppointmentAt).toBe(futuro.toISOString());
    });
  });

  /* ====================================================================== */
  /* Detalle                                                                 */
  /* ====================================================================== */

  describe('detalle profesional', () => {
    it('reconcilia pacientes a cargo y agenda con lo persistido', async () => {
      const { medica } = await poblarEquipo();

      const paciente = await crearPacienteHospital(prisma, {
        tenantId,
        givenNames: 'Delia',
        familyNames: 'Paciente Ficticia',
        birthDate: new Date(Date.UTC(1950, 3, 10)),
      });

      const inicio = new Date(Date.UTC(2026, 7, 22, 15, 0, 0));

      await crearCitaAsignada(prisma, {
        tenantId,
        patientId: paciente.patientId,
        professionalId: medica,
        identityId,
        scheduledStart: inicio,
        modality: 'VIRTUAL',
      });

      const respuesta = await comoAgenda(
        `${LIST_PATH}/${medica}?from=2026-08-01&to=2026-08-31`,
      ).expect(200);

      expect(respuesta.body.window).toStrictEqual({ from: '2026-08-01', to: '2026-08-31' });
      expect(respuesta.body.assignedPatients).toHaveLength(1);
      expect(respuesta.body.assignedPatients[0]).toStrictEqual({
        patientId: paciente.patientId,
        fullName: 'Delia Paciente Ficticia',
        initials: 'DP',
      });
      expect(respuesta.body.appointments).toHaveLength(1);
      expect(respuesta.body.appointments[0]).toMatchObject({
        modality: 'VIRTUAL',
        status: 'ASSIGNED',
        scheduledStart: inicio.toISOString(),
      });
    });

    it('una ventana sin citas devuelve la lista vacía, no otro periodo', async () => {
      const { medica } = await poblarEquipo();

      const respuesta = await comoAgenda(
        `${LIST_PATH}/${medica}?from=2026-01-01&to=2026-01-31`,
      ).expect(200);

      expect(respuesta.body.appointments).toStrictEqual([]);
      expect(respuesta.body.window.from).toBe('2026-01-01');
    });

    it('sin ventana usa el día actual del SERVIDOR', async () => {
      const { medica } = await poblarEquipo();

      const respuesta = await comoAgenda(`${LIST_PATH}/${medica}`).expect(200);
      const hoy = new Date().toISOString().slice(0, 10);

      expect(respuesta.body.window).toStrictEqual({ from: hoy, to: hoy });
    });
  });

  /* ====================================================================== */
  /* Aislamiento entre instituciones                                         */
  /* ====================================================================== */

  describe('aislamiento entre instituciones', () => {
    it('no devuelve profesionales de otro tenant y su detalle es 404 uniforme', async () => {
      await poblarEquipo();

      const ajeno = await crearProfesional(prisma, {
        tenantId: otroTenantId,
        givenNames: 'Elena',
        familyNames: 'Ajena Ficticia',
      });

      const listado = await comoAgenda(LIST_PATH).expect(200);

      expect(listado.body.totalItems).toBe(3);
      expect(JSON.stringify(listado.body)).not.toContain('Ajena Ficticia');
      expect(JSON.stringify(listado.body)).not.toContain(ajeno.professionalId);

      const detalle = await comoAgenda(`${LIST_PATH}/${ajeno.professionalId}`).expect(404);

      expect(detalle.body.code).toBe('HOSPITAL_PROFESSIONAL_NOT_FOUND');

      // El identificador inexistente produce EXACTAMENTE la misma respuesta.
      const inexistente = await comoAgenda(
        `${LIST_PATH}/019287a1-0000-7000-8000-00000000dead`,
      ).expect(404);

      expect(inexistente.body).toStrictEqual(detalle.body);
    });
  });

  /* ====================================================================== */
  /* Cabeceras, minimización y auditoría                                     */
  /* ====================================================================== */

  describe('cabeceras, minimización y auditoría', () => {
    it('ninguna respuesta, ni de éxito ni de error, es cacheable', async () => {
      const ok = await comoAgenda(LIST_PATH).expect(200);
      const error = await comoAgenda(`${LIST_PATH}?desconocido=1`).expect(400);
      const sinSesion = await request(app.getHttpServer()).get(LIST_PATH).expect(401);

      for (const respuesta of [ok, error, sinSesion]) {
        expect(respuesta.headers['cache-control']).toBe('private, no-store');
        expect(respuesta.headers['pragma']).toBe('no-cache');
        expect(respuesta.headers['vary']).toContain('Cookie');
      }
    });

    it('la respuesta no contiene ningún campo ni valor prohibido', async () => {
      const { medica } = await poblarEquipo();

      const paciente = await crearPacienteHospital(prisma, {
        tenantId,
        givenNames: 'Delia',
        familyNames: 'Paciente Ficticia',
        birthDate: new Date(Date.UTC(1950, 3, 10)),
      });

      await crearCitaAsignada(prisma, {
        tenantId,
        patientId: paciente.patientId,
        professionalId: medica,
        identityId,
        scheduledStart: new Date(Date.UTC(2026, 7, 22, 15, 0, 0)),
      });

      const listado = await comoAgenda(LIST_PATH).expect(200);
      const detalle = await comoAgenda(
        `${LIST_PATH}/${medica}?from=2026-08-01&to=2026-08-31`,
      ).expect(200);

      for (const cuerpo of [JSON.stringify(listado.body), JSON.stringify(detalle.body)]) {
        for (const prohibido of CAMPOS_PROHIBIDOS_OPERACIONES) {
          expect(cuerpo).not.toContain(prohibido);
        }

        for (const valor of VALORES_PROHIBIDOS_OPERACIONES) {
          expect(cuerpo).not.toContain(valor);
        }
      }
    });

    it('registra el acceso concedido sin filtros, conteos ni datos personales', async () => {
      const { medica } = await poblarEquipo();

      const antes = new Date();

      await comoAgenda(`${LIST_PATH}?search=Ana`).expect(200);
      await comoAgenda(`${LIST_PATH}/${medica}`).expect(200);

      const eventos = await prisma.auditEvent.findMany({
        where: { tenantId, occurredAt: { gte: antes } },
        select: {
          eventType: true,
          actorType: true,
          actorUserId: true,
          actorRole: true,
          resourceType: true,
          resourceId: true,
          outcome: true,
          endpoint: true,
          correlationId: true,
        },
        orderBy: { occurredAt: 'asc' },
      });

      const tipos = eventos.map((evento) => evento.eventType);

      expect(tipos).toContain('HOSPITAL_PROFESSIONAL_LIST_ACCESS_GRANTED');
      expect(tipos).toContain('HOSPITAL_PROFESSIONAL_DETAIL_ACCESS_GRANTED');

      const listado = eventos.find(
        (evento) => evento.eventType === 'HOSPITAL_PROFESSIONAL_LIST_ACCESS_GRANTED',
      );

      expect(listado).toMatchObject({
        actorType: 'INSTITUTIONAL_IDENTITY',
        actorUserId: identityId,
        actorRole: 'HOSPITAL_SCHEDULER',
        resourceType: 'HospitalProfessionalList',
        // Un acceso a una superficie no crea recurso.
        resourceId: null,
        outcome: 'SUCCESS',
        endpoint: 'GET /api/v1/hospital/professionals',
      });

      // El término de búsqueda NUNCA se registra.
      expect(JSON.stringify(eventos)).not.toContain('Ana');
      expect(JSON.stringify(eventos)).not.toContain('search');

      const detalle = eventos.find(
        (evento) => evento.eventType === 'HOSPITAL_PROFESSIONAL_DETAIL_ACCESS_GRANTED',
      );

      // El detalle SÍ nombra el recurso opaco al que se accedió.
      expect(detalle?.resourceId).toBe(medica);
      expect(detalle?.endpoint).toBe('GET /api/v1/hospital/professionals/:professionalId');
    });

    it('registra la denegación sin nombrar el recurso intentado', async () => {
      const antes = new Date();

      await request(app.getHttpServer())
        .get(`${LIST_PATH}/019287a1-0000-7000-8000-00000000dead`)
        .set('Cookie', `${INSTITUTIONAL_COOKIE}=${cookieViewer}`)
        .expect(403);

      const eventos = await prisma.auditEvent.findMany({
        where: {
          tenantId,
          occurredAt: { gte: antes },
          eventType: 'HOSPITAL_OPERATIONS_ACCESS_DENIED',
        },
        select: {
          actorRole: true,
          resourceType: true,
          resourceId: true,
          outcome: true,
          endpoint: true,
        },
      });

      expect(eventos).toHaveLength(1);
      expect(eventos[0]).toMatchObject({
        actorRole: 'HOSPITAL_PATIENT_VIEWER',
        resourceId: null,
        outcome: 'DENIED',
        endpoint: 'GET /api/v1/hospital/professionals/:professionalId',
      });

      // La traza no revela QUÉ identificador se intentó leer.
      expect(JSON.stringify(eventos)).not.toContain('00000000dead');
    });
  });
});
