/*
 * Credencial institucional FICTICIA de la suite. Debe quedar definida ANTES de
 * importar la aplicación: el módulo institucional lee su configuración una sola
 * vez, al construirse.
 */
process.env['MERDN_MUNICIPAL_VIEWER_SECRET'] =
  'credencial-ficticia-de-pruebas-alcaldia-0001';
process.env['MERDN_MUNICIPAL_VIEWER_CODE'] = 'municipal-viewer-pruebas';

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';

import { AppModule } from '../src/app.module';
import { hashSessionToken } from '../src/enrollment-sessions/enrollment-session.tokens';
import { type PrismaClient } from '../src/generated/prisma/client';
import { MalformedJsonFilter } from '../src/patients/malformed-json.filter';

import { createTestPrismaClient, unavailableBanner } from './database-availability';
import { municipalManagementApiCases } from './municipality-management.api.cases';
import {
  DEPARTMENT_CODE,
  MUNICIPALITY_CODE,
  cleanupTestData,
  enrollmentBody,
  sessionTokenFromSetCookie,
  territorialUnitId,
} from './enrollment-fixtures';
import {
  CREDENCIAL_INSTITUCIONAL_FICTICIA,
  cookieInstitucionalDe,
  crearPacienteSintetico,
  limpiarIdentidadesInstitucionales,
} from './municipality-fixtures';

/**
 * Superficie municipal agregada de extremo a extremo
 * (TASK-MUNICIPALITY-CORE-01, pruebas T-05, T-05A, T-06, T-09 y T-13).
 *
 * Ejercita la aplicación NestJS completa contra PostgreSQL real. Si la base no
 * está disponible, la suite se marca como NO EJECUTADA con un motivo visible:
 * no se sustituye por dobles de prueba.
 */

const INSTITUTIONAL_COOKIE = 'merdn_institutional_session';
const PATIENT_COOKIE = 'merdn_enrollment_session';
const POPULATION_PATH = '/api/v1/municipality/population-summary';
const TERRITORY_PATH = '/api/v1/municipality/territory-summary';
const SESSIONS_PATH = '/api/v1/institutional/sessions';
/**
 * Origen web autorizado por la configuración por defecto del entorno.
 *
 * La apertura y el cierre de la sesión institucional exigen un origen
 * declarado y autorizado: sin él la petición se rechaza con `403`.
 */
const ORIGEN_WEB_AUTORIZADO = 'http://127.0.0.1:3000';

const availability = inject('databaseAvailability');
const puedeEjecutarse = availability.available && availability.migrated;
municipalManagementApiCases(puedeEjecutarse);

if (!puedeEjecutarse) {
  // eslint-disable-next-line no-console
  console.warn(`\n${unavailableBanner(availability)}\n`);
}

/*
 * El motor de desarrollo WebAssembly no sostiene escrituras bajo un rol no
 * propietario con RLS y claves foráneas compuestas (limitación comprobada y
 * documentada en CORE-01). Para poder ejercitar el contrato de la API en ese
 * motor, la aplicación se arranca con el rol runtime desactivado y se deja
 * constancia. Las garantías de RLS NO se dan por verificadas aquí: se
 * comprueban en `municipality-aggregates.db.test.ts`.
 */
const rolRuntimeAplicado =
  availability.engine === 'postgresql-server' &&
  process.env['RUNTIME_DATABASE_URL'] !== undefined;

if (puedeEjecutarse && !rolRuntimeAplicado) {
  process.env['MERDN_RUNTIME_ROLE'] = 'disabled';
  // eslint-disable-next-line no-console
  console.warn(
    '\nAVISO: las pruebas municipales de API se ejecutan con MERDN_RUNTIME_ROLE=disabled ' +
      'porque el motor conectado no sostiene Row Level Security bajo el rol runtime. ' +
      'El aislamiento por base de datos NO queda verificado en esta ejecución.\n',
  );
}

describe.skipIf(!puedeEjecutarse)('API municipal agregada', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let tenantId: string;
  let departmentId: string;
  let municipalityId: string;
  let cookieInstitucional: string;

  beforeAll(async () => {
    prisma = createTestPrismaClient();
    await cleanupTestData(prisma);
    await limpiarIdentidadesInstitucionales(prisma);

    const tenant = await prisma.tenant.findUnique({
      where: { code: process.env['MERDN_ACTIVE_TENANT_CODE'] ?? 'merdn-mvp' },
      select: { id: true },
    });

    if (tenant === null) {
      throw new Error('El tenant institucional MVP no existe: aplique las migraciones.');
    }

    tenantId = tenant.id;
    departmentId = await territorialUnitId(prisma, 'DEPARTMENT', DEPARTMENT_CODE);
    municipalityId = await territorialUnitId(prisma, 'MUNICIPALITY', MUNICIPALITY_CODE);

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new MalformedJsonFilter());
    await app.init();

    cookieInstitucional = await abrirSesion();
  });

  beforeEach(async () => {
    await cleanupTestData(prisma);
  });

  afterAll(async () => {
    if (app !== undefined) {
      await app.close();
    }

    if (prisma !== undefined) {
      await cleanupTestData(prisma);
      await limpiarIdentidadesInstitucionales(prisma);
      await prisma.$disconnect();
    }
  });

  /** Abre una sesión institucional y devuelve el valor de su cookie. */
  async function abrirSesion(): Promise<string> {
    const respuesta = await request(app.getHttpServer())
      .post(SESSIONS_PATH)
      .set('Origin', ORIGEN_WEB_AUTORIZADO)
      .send({ accessSecret: CREDENCIAL_INSTITUCIONAL_FICTICIA })
      .expect(201);

    const cookie = cookieInstitucionalDe(respuesta.headers['set-cookie']);

    if (cookie === null) {
      throw new Error('La respuesta no entregó la cookie institucional.');
    }

    return cookie;
  }

  async function crear(cantidad: number, mayor: boolean): Promise<void> {
    for (let indice = 0; indice < cantidad; indice += 1) {
      await crearPacienteSintetico(prisma, {
        tenantId,
        departmentUnitId: departmentId,
        municipalityUnitId: municipalityId,
        condiciones: { mayor, discapacidad: false, cuidadoEnCasa: false },
      });
    }
  }

  describe('sesión institucional (T-05A)', () => {
    it('entrega una cookie HttpOnly y no devuelve el token ni la credencial', async () => {
      const respuesta = await request(app.getHttpServer())
        .post(SESSIONS_PATH)
        .set('Origin', ORIGEN_WEB_AUTORIZADO)
        .send({ accessSecret: CREDENCIAL_INSTITUCIONAL_FICTICIA })
        .expect(201);

      const cabeceras = respuesta.headers['set-cookie'] as unknown as string[];
      const cookie = cabeceras.find((cabecera) =>
        cabecera.startsWith(INSTITUTIONAL_COOKIE),
      );

      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('Path=/');
      expect(respuesta.body).toStrictEqual({
        role: 'MUNICIPAL_VIEWER',
        expiresAt: expect.any(String),
      });

      const serializado = JSON.stringify(respuesta.body);

      expect(serializado).not.toContain(CREDENCIAL_INSTITUCIONAL_FICTICIA);
      expect(serializado).not.toContain('token');
      expect(serializado).not.toContain('tenant');
    });

    it('rechaza una credencial incorrecta sin distinguir la causa', async () => {
      const respuesta = await request(app.getHttpServer())
        .post(SESSIONS_PATH)
        .set('Origin', ORIGEN_WEB_AUTORIZADO)
        .send({ accessSecret: 'credencial-ficticia-que-no-corresponde' })
        .expect(401);

      expect(respuesta.body.code).toBe('INSTITUTIONAL_INVALID_CREDENTIALS');
      expect(JSON.stringify(respuesta.body)).not.toContain('identidad');
    });

    it('rechaza un cuerpo sin credencial', async () => {
      await request(app.getHttpServer())
        .post(SESSIONS_PATH)
        .set('Origin', ORIGEN_WEB_AUTORIZADO)
        .send({})
        .expect(401);
    });

    it('almacena solo el hash del token, nunca el token en claro', async () => {
      const sesiones = await prisma.institutionalSession.findMany({
        where: { tenantId },
        select: { tokenHash: true },
      });

      expect(sesiones.length).toBeGreaterThan(0);

      for (const sesion of sesiones) {
        expect(sesion.tokenHash).toMatch(/^[0-9a-f]{64}$/u);
        expect(sesion.tokenHash).not.toBe(cookieInstitucional);
      }

      expect(
        sesiones.some((sesion) => sesion.tokenHash === hashSessionToken(cookieInstitucional)),
      ).toBe(true);
    });

    it('almacena la credencial únicamente como derivación', async () => {
      const identidad = await prisma.institutionalIdentity.findFirst({
        where: { tenantId, code: 'municipal-viewer-pruebas' },
        select: { accessSecretHash: true, accessSecretSalt: true },
      });

      expect(identidad?.accessSecretHash).toMatch(/^[0-9a-f]{128}$/u);
      expect(identidad?.accessSecretSalt).toMatch(/^[0-9a-f]{32}$/u);
    });
  });

  describe('autorización de los agregados (T-05)', () => {
    it('sin cookie devuelve 401 y ningún agregado', async () => {
      for (const ruta of [POPULATION_PATH, TERRITORY_PATH]) {
        const respuesta = await request(app.getHttpServer()).get(ruta).expect(401);

        expect(respuesta.body.code).toBe('INSTITUTIONAL_SESSION_REQUIRED');
        expect(respuesta.body).not.toHaveProperty('uniqueRegistered');
        expect(respuesta.body).not.toHaveProperty('municipalities');
      }
    });

    it('la cookie de autoinscripción de paciente NO autentica a Alcaldía', async () => {
      const inscripcion = await request(app.getHttpServer())
        .post('/api/v1/patients/enrollments')
        .send(enrollmentBody())
        .expect(201);

      const tokenPaciente = sessionTokenFromSetCookie(
        inscripcion.headers['set-cookie'],
      );

      expect(tokenPaciente).not.toBeNull();

      await request(app.getHttpServer())
        .get(POPULATION_PATH)
        .set('Cookie', `${PATIENT_COOKIE}=${tokenPaciente ?? ''}`)
        .expect(401);

      // Y a la inversa: la sesión institucional no abre el registro individual.
      await request(app.getHttpServer())
        .get('/api/v1/patients/me')
        .set('Cookie', `${INSTITUTIONAL_COOKIE}=${cookieInstitucional}`)
        .expect(401);
    });

    it('un token manipulado no autoriza', async () => {
      const manipulado = `${cookieInstitucional.slice(0, -1)}${
        cookieInstitucional.endsWith('a') ? 'b' : 'a'
      }`;

      await request(app.getHttpServer())
        .get(POPULATION_PATH)
        .set('Cookie', `${INSTITUTIONAL_COOKIE}=${manipulado}`)
        .expect(401);
    });

    it('una sesión expirada o revocada deja de autorizar', async () => {
      const cookie = await abrirSesion();
      const tokenHash = hashSessionToken(cookie);

      await request(app.getHttpServer())
        .get(POPULATION_PATH)
        .set('Cookie', `${INSTITUTIONAL_COOKIE}=${cookie}`)
        .expect(200);

      /*
       * La base exige `expiresAt > createdAt`: para simular una sesión ya
       * caducada hay que retrasar ambos instantes, no solo la caducidad. Que la
       * restricción impida lo contrario es, en sí mismo, una garantía.
       */
      await prisma.$executeRaw`
        UPDATE "institutional_session"
           SET "createdAt" = now() - interval '2 hours',
               "expiresAt" = now() - interval '1 hour'
         WHERE "tokenHash" = ${tokenHash}`;

      await request(app.getHttpServer())
        .get(POPULATION_PATH)
        .set('Cookie', `${INSTITUTIONAL_COOKIE}=${cookie}`)
        .expect(401);

      await prisma.$executeRaw`
        UPDATE "institutional_session"
           SET "expiresAt" = now() + interval '1 hour',
               "revokedAt" = now()
         WHERE "tokenHash" = ${tokenHash}`;

      await request(app.getHttpServer())
        .get(POPULATION_PATH)
        .set('Cookie', `${INSTITUTIONAL_COOKIE}=${cookie}`)
        .expect(401);
    });

    it('la revocación explícita cierra la sesión y conserva su fila', async () => {
      const cookie = await abrirSesion();

      await request(app.getHttpServer())
        .delete(`${SESSIONS_PATH}/current`)
        .set('Origin', ORIGEN_WEB_AUTORIZADO)
        .set('Cookie', `${INSTITUTIONAL_COOKIE}=${cookie}`)
        .expect(204);

      await request(app.getHttpServer())
        .get(TERRITORY_PATH)
        .set('Cookie', `${INSTITUTIONAL_COOKIE}=${cookie}`)
        .expect(401);

      const sesion = await prisma.institutionalSession.findFirst({
        where: { tokenHash: hashSessionToken(cookie) },
        select: { revokedAt: true },
      });

      expect(sesion?.revokedAt).not.toBeNull();
    });
  });

  describe('agregados servidos (T-06, T-09, T-13)', () => {
    it('devuelve el agregado de población del tenant resuelto en el servidor', async () => {
      await crear(9, true);

      const respuesta = await request(app.getHttpServer())
        .get(POPULATION_PATH)
        .set('Cookie', `${INSTITUTIONAL_COOKIE}=${cookieInstitucional}`)
        .expect(200);

      expect(respuesta.headers['cache-control']).toBe('private, no-store');
      expect(respuesta.body.source).toBe('ELOISA_POSTGRESQL');
      expect(respuesta.body.uniqueRegistered).toStrictEqual({
        status: 'EXACT',
        value: 9,
        display: '9',
      });
      expect(respuesta.body.populations.olderAdult60Plus.value).toBe(9);
    });

    it('los agregados cambian al inscribir a otra persona (T-13)', async () => {
      await crear(9, true);

      const antes = await request(app.getHttpServer())
        .get(POPULATION_PATH)
        .set('Cookie', `${INSTITUTIONAL_COOKIE}=${cookieInstitucional}`)
        .expect(200);

      expect(antes.body.uniqueRegistered.value).toBe(9);

      await request(app.getHttpServer())
        .post('/api/v1/patients/enrollments')
        .send(enrollmentBody())
        .expect(201);

      const despues = await request(app.getHttpServer())
        .get(POPULATION_PATH)
        .set('Cookie', `${INSTITUTIONAL_COOKIE}=${cookieInstitucional}`)
        .expect(200);

      expect(despues.body.uniqueRegistered.value).toBe(10);

      const territorio = await request(app.getHttpServer())
        .get(TERRITORY_PATH)
        .set('Cookie', `${INSTITUTIONAL_COOKIE}=${cookieInstitucional}`)
        .expect(200);

      expect(territorio.body.municipalities).toHaveLength(1);
      expect(territorio.body.municipalities[0].metrics.uniquePeople.value).toBe(10);
    });

    it('declara las métricas oficiales como no disponibles, sin porcentaje', async () => {
      await crear(9, true);

      const respuesta = await request(app.getHttpServer())
        .get(POPULATION_PATH)
        .set('Cookie', `${INSTITUTIONAL_COOKIE}=${cookieInstitucional}`)
        .expect(200);

      for (const metrica of respuesta.body.officialMetrics) {
        expect(metrica.status).toBe('UNAVAILABLE');
        expect(metrica.value).toBeNull();
      }

      // Sin denominador oficial no se calcula ningún porcentaje ni barra.
      const serializado = JSON.stringify(respuesta.body);

      expect(serializado).not.toContain('percentage');
      expect(serializado).not.toContain('porcentaje');
      expect(serializado).not.toContain('%');
    });

    it('no devuelve ningún dato individual en ninguno de los dos agregados (T-06)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/patients/enrollments')
        .send(enrollmentBody({ givenNames: 'Ana María' }))
        .expect(201);

      await crear(8, true);

      for (const ruta of [POPULATION_PATH, TERRITORY_PATH]) {
        const respuesta = await request(app.getHttpServer())
          .get(ruta)
          .set('Cookie', `${INSTITUTIONAL_COOKIE}=${cookieInstitucional}`)
          .expect(200);

        const serializado = JSON.stringify(respuesta.body);

        for (const prohibido of [
          'Ana María',
          'Ejemplo Ficticio',
          'Cra 45',
          'La Esperanza',
          'San Cristóbal',
          '99990',
          'patientId',
          'personId',
          'birthDate',
          'documentNumber',
          'phone',
          'email',
          'tenantId',
          'epsCode',
        ]) {
          expect(serializado).not.toContain(prohibido);
        }
      }
    });
  });

  describe('auditoría del acceso municipal', () => {
    it('registra el acceso concedido con actor opaco y sin conteos', async () => {
      await crear(6, true);

      const antes = await prisma.auditEvent.count({
        where: { tenantId, eventType: 'MUNICIPAL_AGGREGATE_ACCESS_GRANTED' },
      });

      await request(app.getHttpServer())
        .get(POPULATION_PATH)
        .set('Cookie', `${INSTITUTIONAL_COOKIE}=${cookieInstitucional}`)
        .expect(200);

      const eventos = await prisma.auditEvent.findMany({
        where: { tenantId, eventType: 'MUNICIPAL_AGGREGATE_ACCESS_GRANTED' },
        orderBy: { occurredAt: 'desc' },
        take: 1,
      });

      expect(
        await prisma.auditEvent.count({
          where: { tenantId, eventType: 'MUNICIPAL_AGGREGATE_ACCESS_GRANTED' },
        }),
      ).toBe(antes + 1);

      const evento = eventos[0]!;

      expect(evento.actorType).toBe('INSTITUTIONAL_IDENTITY');
      expect(evento.actorRole).toBe('MUNICIPAL_VIEWER');
      expect(evento.outcome).toBe('SUCCESS');
      expect(evento.resourceType).toBe('MunicipalPopulationSummary');
      expect(evento.resourceId).toBeNull();
      expect(evento.endpoint).toBe(`GET ${POPULATION_PATH}`);
      expect(JSON.stringify(evento)).not.toContain(cookieInstitucional);
    });

    it('registra el acceso denegado sin identificar a nadie', async () => {
      const antes = await prisma.auditEvent.count({
        where: { tenantId, eventType: 'MUNICIPAL_AGGREGATE_ACCESS_DENIED' },
      });

      await request(app.getHttpServer()).get(TERRITORY_PATH).expect(401);

      const eventos = await prisma.auditEvent.findMany({
        where: { tenantId, eventType: 'MUNICIPAL_AGGREGATE_ACCESS_DENIED' },
        orderBy: { occurredAt: 'desc' },
        take: 1,
      });

      expect(
        await prisma.auditEvent.count({
          where: { tenantId, eventType: 'MUNICIPAL_AGGREGATE_ACCESS_DENIED' },
        }),
      ).toBe(antes + 1);

      const evento = eventos[0]!;

      expect(evento.actorType).toBe('UNAUTHENTICATED');
      expect(evento.actorUserId).toBeNull();
      expect(evento.actorRole).toBeNull();
      expect(evento.outcome).toBe('DENIED');
      expect(evento.resourceType).toBe('MunicipalTerritorySummary');
    });

    it('registra la creación y la revocación de la sesión institucional', async () => {
      const antesCreadas = await prisma.auditEvent.count({
        where: { tenantId, eventType: 'INSTITUTIONAL_SESSION_CREATED' },
      });

      const cookie = await abrirSesion();

      await request(app.getHttpServer())
        .delete(`${SESSIONS_PATH}/current`)
        .set('Origin', ORIGEN_WEB_AUTORIZADO)
        .set('Cookie', `${INSTITUTIONAL_COOKIE}=${cookie}`)
        .expect(204);

      expect(
        await prisma.auditEvent.count({
          where: { tenantId, eventType: 'INSTITUTIONAL_SESSION_CREATED' },
        }),
      ).toBe(antesCreadas + 1);

      expect(
        await prisma.auditEvent.count({
          where: { tenantId, eventType: 'INSTITUTIONAL_SESSION_REVOKED' },
        }),
      ).toBeGreaterThan(0);
    });
  });
});
