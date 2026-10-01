/*
 * Aprovisionamiento FICTICIO del proveedor OIDC. Debe quedar definido ANTES de
 * importar la aplicación: el módulo humano lee su configuración una sola vez,
 * al construirse.
 *
 * El emisor es el canónico LOCAL de desarrollo y solo se admite porque el
 * entorno de pruebas es `test`. La clave es ficticia y no cifra nada real; el
 * descubrimiento OIDC NO se ejecuta en estas pruebas, que no llegan a tocar el
 * proveedor.
 */
process.env['MERDN_HUMAN_AUTH_ISSUER'] =
  'http://host.docker.internal:8081/realms/merdn-local';
process.env['MERDN_HUMAN_AUTH_CLIENT_ID'] = 'merdn-human-web';
process.env['MERDN_HUMAN_AUTH_CALLBACK_URI'] =
  'http://127.0.0.1:3001/api/v1/human-auth/callback';
process.env['MERDN_HUMAN_AUTH_ATTEMPT_KEY'] = 'b'.repeat(64);
process.env['MERDN_CAREGIVER_RELATIONSHIP_MANAGER_SECRET'] =
  'credencial-ficticia-de-pruebas-relaciones-0004';
process.env['MERDN_CAREGIVER_RELATIONSHIP_MANAGER_CODE'] =
  'caregiver-relationship-manager-pruebas';
process.env['MERDN_HOSPITAL_SCHEDULER_SECRET'] =
  'credencial-ficticia-de-pruebas-agenda-0005';
process.env['MERDN_HOSPITAL_SCHEDULER_CODE'] = 'hospital-scheduler-pruebas';

import { randomUUID } from 'node:crypto';

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';

import { AppModule } from '../src/app.module';
import { type PrismaClient } from '../src/generated/prisma/client';
import {
  HUMAN_AUTH_ATTEMPT_COOKIE_NAME,
  HUMAN_SESSION_COOKIE_NAME,
} from '../src/human-auth/human-auth.contract';
import { MalformedJsonFilter } from '../src/patients/malformed-json.filter';

import { createTestPrismaClient, unavailableBanner } from './database-availability';
import { cleanupTestData } from './enrollment-fixtures';
import {
  cookieDe,
  crearCuentaHumana,
  crearPacienteFicticio,
  crearPersona,
  crearProfesionalFicticio,
  crearRelacion,
  crearSesionHumana,
  limpiarIdentidadYRelaciones,
  OTRO_EMISOR_FICTICIO,
} from './identity-relationships-fixtures';
import { limpiarIdentidadesInstitucionales } from './municipality-fixtures';

/*
 * El comando administrativo de aprovisionamiento vive FUERA de la API. Se
 * importa aquí —y no se reimplementa— porque lo que estas pruebas verifican es
 * que la revocación que ESE comando escribe cierre el acceso de la API de
 * inmediato. Reproducir sus escrituras a mano probaría la copia, no el comando.
 */
import { type SqlRunner } from '../../../tools/identity-provisioning/src/database.ts';
import { runOperation } from '../../../tools/identity-provisioning/src/operations.ts';
import { type ProvisioningOperation } from '../../../tools/identity-provisioning/src/parse.ts';

/**
 * Superficie HTTP de identidad humana y de relaciones
 * (IDENTITY-RELATIONSHIPS-CORE-01 §8, continuación §6.2).
 *
 * Lo que se verifica:
 *
 * 1. sin sesión humana la superficie responde `401` y la respuesta es IDÉNTICA
 *    ante ausencia, malformación, caducidad absoluta, caducidad por
 *    inactividad, revocación, cuenta deshabilitada y vínculo desvinculado;
 * 2. las tres cookies —autoinscripción, institucional y humana— NO se
 *    sustituyen entre sí en ninguna dirección;
 * 3. las respuestas personales llevan `Cache-Control: private, no-store` y no
 *    devuelven tenant, cuenta, persona, paciente, emisor ni `subject`;
 * 4. el callback termina SIEMPRE en redirección, borra la cookie del intento y
 *    no distingue el motivo del fallo;
 * 5. la superficie de relaciones exige el rol
 *    `CAREGIVER_RELATIONSHIP_MANAGER`: una sesión de agenda recibe `403` y una
 *    sesión humana recibe `401`;
 * 6. crear, activar y revocar respetan el control optimista de versión y los
 *    estados terminales.
 *
 * Todas las credenciales, personas y `subject` son FICTICIOS y locales.
 */

const SESSION_PATH = '/api/v1/human-auth/session';
const CONTEXTS_PATH = '/api/v1/me/contexts';
const LOGOUT_PATH = '/api/v1/human-auth/logout';
const CALLBACK_PATH = '/api/v1/human-auth/callback';
const RELATIONSHIPS_PATH = '/api/v1/caregiver-relationships';
const INSTITUTIONAL_SESSIONS_PATH = '/api/v1/institutional/sessions';
const ORIGEN_AUTORIZADO = 'http://127.0.0.1:3000';

/** Superficie mínima de la conexión que necesita el comando administrativo. */
interface EjecutorSql {
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>;
}

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
}

describe.skipIf(!puedeEjecutarse)('Superficie humana y de relaciones', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let tenantId: string;

  beforeAll(async () => {
    prisma = createTestPrismaClient();
    await limpiarIdentidadYRelaciones(prisma);
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

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new MalformedJsonFilter());
    await app.init();
  });

  afterAll(async () => {
    if (app !== undefined) {
      await app.close();
    }

    if (prisma !== undefined) {
      await limpiarIdentidadYRelaciones(prisma);
      await cleanupTestData(prisma);
      await limpiarIdentidadesInstitucionales(prisma);
      await prisma.$disconnect();
    }
  });

  beforeEach(async () => {
    await limpiarIdentidadYRelaciones(prisma);
    await cleanupTestData(prisma);
  });

  /** Siembra persona, cuenta, vínculo y sesión, y devuelve el token en claro. */
  async function sesionViva(
    overrides: {
      readonly accountStatus?: 'ACTIVE' | 'DISABLED';
      readonly bindingStatus?: 'ACTIVE' | 'UNLINKED';
      readonly expiresAt?: Date;
      readonly createdAt?: Date;
      readonly lastUsedAt?: Date | null;
      readonly revokedAt?: Date | null;
    } = {},
  ): Promise<{ readonly token: string; readonly personId: string }> {
    const { personId } = await crearPersona(prisma, tenantId);
    const cuenta = await crearCuentaHumana(prisma, {
      tenantId,
      personId,
      accountStatus: overrides.accountStatus,
      bindingStatus: overrides.bindingStatus,
    });

    const sesion = await crearSesionHumana(prisma, {
      tenantId,
      humanAccountId: cuenta.humanAccountId,
      expiresAt: overrides.expiresAt,
      createdAt: overrides.createdAt,
      lastUsedAt: overrides.lastUsedAt,
      revokedAt: overrides.revokedAt,
    });

    return { token: sesion.token, personId };
  }

  function conSesion(path: string, token: string): request.Test {
    return request(app.getHttpServer())
      .get(path)
      .set('Cookie', `${HUMAN_SESSION_COOKIE_NAME}=${token}`);
  }

  describe('validez de la sesión humana', () => {
    it('devuelve la vigencia y los contextos sin ningún identificador', async () => {
      const { token } = await sesionViva();

      const respuesta = await conSesion(SESSION_PATH, token).expect(200);

      expect(respuesta.headers['cache-control']).toBe('private, no-store');
      expect(respuesta.headers['vary']).toContain('Cookie');
      expect(typeof respuesta.body.expiresAt).toBe('string');
      expect(respuesta.body.idleExpiresInSeconds).toBeLessThanOrEqual(1800);
      expect(respuesta.body.contexts).toEqual([]);

      const cuerpo = JSON.stringify(respuesta.body);

      for (const prohibido of [
        'tenantId',
        'humanAccountId',
        'personId',
        'patientId',
        'issuer',
        'subject',
        'sessionId',
      ]) {
        expect(cuerpo).not.toContain(prohibido);
      }
    });

    it('declara el contexto CAREGIVER solo cuando hay relación vigente', async () => {
      const { personId } = await crearPersona(prisma, tenantId, 'Cuidadora');
      const cuenta = await crearCuentaHumana(prisma, { tenantId, personId });
      const sesion = await crearSesionHumana(prisma, {
        tenantId,
        humanAccountId: cuenta.humanAccountId,
      });

      const sinRelacion = await conSesion(CONTEXTS_PATH, sesion.token).expect(200);
      expect(sinRelacion.body.contexts).toEqual([]);

      const paciente = await crearPacienteFicticio(prisma, tenantId);
      await crearRelacion(prisma, {
        tenantId,
        patientId: paciente.patientId,
        caregiverPersonId: personId,
        status: 'ACTIVE',
      });

      const conRelacion = await conSesion(CONTEXTS_PATH, sesion.token).expect(200);
      expect(conRelacion.body.contexts).toEqual(['CAREGIVER']);
    });

    it('deniega de forma IDÉNTICA en todas las causas de invalidez', async () => {
      const ahora = Date.now();

      const casos: readonly { readonly nombre: string; readonly token: string }[] = [
        { nombre: 'sin cookie', token: '' },
        { nombre: 'malformada', token: 'no-es-un-token' },
        {
          nombre: 'caducidad absoluta',
          token: (
            await sesionViva({
              createdAt: new Date(ahora - 9 * 60 * 60 * 1000),
              expiresAt: new Date(ahora - 60 * 1000),
            })
          ).token,
        },
        {
          nombre: 'inactividad',
          token: (
            await sesionViva({
              createdAt: new Date(ahora - 2 * 60 * 60 * 1000),
              lastUsedAt: new Date(ahora - 31 * 60 * 1000),
            })
          ).token,
        },
        {
          nombre: 'revocada',
          token: (await sesionViva({ revokedAt: new Date(ahora - 1000) })).token,
        },
        {
          nombre: 'cuenta deshabilitada',
          token: (await sesionViva({ accountStatus: 'DISABLED' })).token,
        },
        {
          nombre: 'vínculo desvinculado',
          token: (await sesionViva({ bindingStatus: 'UNLINKED' })).token,
        },
      ];

      const cuerpos = new Set<string>();

      for (const caso of casos) {
        const peticion = request(app.getHttpServer()).get(SESSION_PATH);

        if (caso.token.length > 0) {
          peticion.set('Cookie', `${HUMAN_SESSION_COOKIE_NAME}=${caso.token}`);
        }

        const respuesta = await peticion.expect(401);

        expect(respuesta.headers['cache-control']).toBe('private, no-store');
        cuerpos.add(JSON.stringify(respuesta.body));
      }

      // Un solo cuerpo para las siete causas: no hay enumeración posible.
      expect(cuerpos.size).toBe(1);
    });

    it('usar la sesión NO prolonga su vigencia absoluta', async () => {
      const creada = new Date(Date.now() - 7 * 60 * 60 * 1000);
      const caduca = new Date(creada.getTime() + 8 * 60 * 60 * 1000);
      /*
       * Actividad RECIENTE a propósito: lo que aquí se mide es la caducidad
       * ABSOLUTA, y una sesión creada hace siete horas sin uso registrado
       * caducaría antes por inactividad. Con el uso vigente, la única frontera
       * que queda en juego es `expiresAt`.
       */
      const { token } = await sesionViva({
        createdAt: creada,
        expiresAt: caduca,
        lastUsedAt: new Date(Date.now() - 60 * 1000),
      });

      const primera = await conSesion(SESSION_PATH, token).expect(200);
      const segunda = await conSesion(SESSION_PATH, token).expect(200);

      expect(segunda.body.expiresAt).toBe(primera.body.expiresAt);
      expect(new Date(String(segunda.body.expiresAt)).getTime()).toBe(caduca.getTime());
    });
  });

  describe('separación de cookies', () => {
    it('la cookie institucional NO autentica la superficie humana', async () => {
      const { token } = await sesionViva();

      await request(app.getHttpServer())
        .get(SESSION_PATH)
        .set('Cookie', `merdn_institutional_session=${token}`)
        .expect(401);

      await request(app.getHttpServer())
        .get(SESSION_PATH)
        .set('Cookie', `merdn_enrollment_session=${token}`)
        .expect(401);
    });

    it('la cookie humana NO autentica la superficie de relaciones', async () => {
      const { token } = await sesionViva();

      await request(app.getHttpServer())
        .get(`${RELATIONSHIPS_PATH}/00000000-0000-4000-8000-000000000001`)
        .set('Cookie', `${HUMAN_SESSION_COOKIE_NAME}=${token}`)
        .expect(401);
    });

    it('presentar las tres cookies a la vez no produce ambigüedad', async () => {
      const { token } = await sesionViva();

      const respuesta = await request(app.getHttpServer())
        .get(SESSION_PATH)
        .set('Cookie', [
          `merdn_enrollment_session=${token}`,
          `merdn_institutional_session=${token}`,
          `${HUMAN_SESSION_COOKIE_NAME}=${token}`,
        ])
        .expect(200);

      expect(respuesta.body.contexts).toEqual([]);
    });
  });

  describe('cierre de sesión', () => {
    it('revoca la sesión, borra la cookie y no la reutiliza', async () => {
      const { token } = await sesionViva();

      await request(app.getHttpServer())
        .post(LOGOUT_PATH)
        .set('Origin', ORIGEN_AUTORIZADO)
        .set('Cookie', `${HUMAN_SESSION_COOKIE_NAME}=${token}`)
        .expect(204);

      await conSesion(SESSION_PATH, token).expect(401);
    });

    it('exige origen autorizado', async () => {
      const { token } = await sesionViva();

      await request(app.getHttpServer())
        .post(LOGOUT_PATH)
        .set('Origin', 'http://sitio-ajeno.invalid')
        .set('Cookie', `${HUMAN_SESSION_COOKIE_NAME}=${token}`)
        .expect(403);

      // La sesión sigue viva: un origen ajeno no cierra la sesión de nadie.
      await conSesion(SESSION_PATH, token).expect(200);
    });

    it('sin sesión responde 401', async () => {
      await request(app.getHttpServer())
        .post(LOGOUT_PATH)
        .set('Origin', ORIGEN_AUTORIZADO)
        .expect(401);
    });
  });

  describe('callback OIDC', () => {
    it('redirige y borra el intento sin distinguir el motivo del fallo', async () => {
      const casos = [
        { nombre: 'sin cookie de intento', cookies: [] as string[], query: '?code=x&state=y' },
        {
          nombre: 'intento inexistente',
          cookies: [`${HUMAN_AUTH_ATTEMPT_COOKIE_NAME}=${'a'.repeat(43)}`],
          query: '?code=x&state=y',
        },
        {
          nombre: 'sin state',
          cookies: [`${HUMAN_AUTH_ATTEMPT_COOKIE_NAME}=${'a'.repeat(43)}`],
          query: '?code=x',
        },
        {
          nombre: 'token de intento malformado',
          cookies: [`${HUMAN_AUTH_ATTEMPT_COOKIE_NAME}=corto`],
          query: '?code=x&state=y',
        },
      ];

      for (const caso of casos) {
        const peticion = request(app.getHttpServer()).get(
          `${CALLBACK_PATH}${caso.query}`,
        );

        if (caso.cookies.length > 0) {
          peticion.set('Cookie', caso.cookies);
        }

        const respuesta = await peticion.expect(302);

        expect(respuesta.headers['location']).toBe(`${ORIGEN_AUTORIZADO}/`);
        expect(respuesta.headers['cache-control']).toBe('private, no-store');

        const borrado = respuesta.headers['set-cookie'];
        expect(String(borrado)).toContain(`${HUMAN_AUTH_ATTEMPT_COOKIE_NAME}=;`);
        // NUNCA se emite una sesión humana en un callback fallido.
        expect(cookieDe(borrado, HUMAN_SESSION_COOKIE_NAME)).toBeNull();
      }
    });
  });

  describe('superficie de relaciones', () => {
    async function abrirSesionInstitucional(
      code: string,
      secret: string,
    ): Promise<string> {
      const respuesta = await request(app.getHttpServer())
        .post(INSTITUTIONAL_SESSIONS_PATH)
        .set('Origin', ORIGEN_AUTORIZADO)
        .send({ identityCode: code, accessSecret: secret })
        .expect(201);

      const cookie = cookieDe(
        respuesta.headers['set-cookie'],
        'merdn_institutional_session',
      );

      if (cookie === null) {
        throw new Error('La sesión institucional no emitió cookie.');
      }

      return cookie;
    }

    async function sesionManager(): Promise<string> {
      return abrirSesionInstitucional(
        'caregiver-relationship-manager-pruebas',
        'credencial-ficticia-de-pruebas-relaciones-0004',
      );
    }

    it('una identidad de AGENDA no gestiona relaciones', async () => {
      const scheduler = await abrirSesionInstitucional(
        'hospital-scheduler-pruebas',
        'credencial-ficticia-de-pruebas-agenda-0005',
      );

      await request(app.getHttpServer())
        .get(`${RELATIONSHIPS_PATH}/00000000-0000-4000-8000-000000000001`)
        .set('Cookie', `merdn_institutional_session=${scheduler}`)
        .expect(403);
    });

    it('crea, activa y revoca respetando la versión esperada', async () => {
      const manager = await sesionManager();
      const paciente = await crearPacienteFicticio(prisma, tenantId);
      const cuidadora = await crearPersona(prisma, tenantId, 'Cuidadora');

      const creada = await request(app.getHttpServer())
        .post(RELATIONSHIPS_PATH)
        .set('Origin', ORIGEN_AUTORIZADO)
        .set('Cookie', `merdn_institutional_session=${manager}`)
        .send({
          patientId: paciente.patientId,
          caregiverPersonId: cuidadora.personId,
          startsAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
          endsAt: null,
          authorizationReference: 'SOPORTE.FICTICIO-0002',
        })
        .expect(201);

      expect(creada.body.status).toBe('PENDING_VALIDATION');
      expect(creada.body.version).toBe(1);
      expect(creada.body.scopes).toEqual(['VISITS_VIEW']);
      // El servidor fija tipo, finalidad y fuente; el cliente no los envía.
      expect(creada.body.relationshipType).toBe('DECLARED_CARE_SUPPORT');
      expect(creada.body.purpose).toBe('HOME_CARE_COORDINATION');
      expect(creada.body.validationSource).toBe('CONTROLLED_MVP_OPERATOR_ASSERTION');
      expect(JSON.stringify(creada.body)).not.toContain('SOPORTE.FICTICIO-0002');

      const relationshipId = String(creada.body.relationshipId);

      // Versión equivocada: conflicto SIN escritura.
      await request(app.getHttpServer())
        .patch(`${RELATIONSHIPS_PATH}/${relationshipId}/activate`)
        .set('Origin', ORIGEN_AUTORIZADO)
        .set('Cookie', `merdn_institutional_session=${manager}`)
        .send({ expectedVersion: 99 })
        .expect(409);

      const activada = await request(app.getHttpServer())
        .patch(`${RELATIONSHIPS_PATH}/${relationshipId}/activate`)
        .set('Origin', ORIGEN_AUTORIZADO)
        .set('Cookie', `merdn_institutional_session=${manager}`)
        .send({ expectedVersion: 1 })
        .expect(200);

      expect(activada.body.status).toBe('ACTIVE');
      expect(activada.body.version).toBe(2);

      const revocada = await request(app.getHttpServer())
        .patch(`${RELATIONSHIPS_PATH}/${relationshipId}/revoke`)
        .set('Origin', ORIGEN_AUTORIZADO)
        .set('Cookie', `merdn_institutional_session=${manager}`)
        .send({ expectedVersion: 2, reason: 'AUTHORIZATION_WITHDRAWN' })
        .expect(200);

      expect(revocada.body.status).toBe('REVOKED');
      expect(revocada.body.revocationReason).toBe('AUTHORIZATION_WITHDRAWN');

      // `REVOKED` es TERMINAL: no se reabre ni se reactiva.
      await request(app.getHttpServer())
        .patch(`${RELATIONSHIPS_PATH}/${relationshipId}/activate`)
        .set('Origin', ORIGEN_AUTORIZADO)
        .set('Cookie', `merdn_institutional_session=${manager}`)
        .send({ expectedVersion: 3 })
        .expect(409);
    });

    it('rechaza campos de autoridad enviados por el cliente', async () => {
      const manager = await sesionManager();
      const paciente = await crearPacienteFicticio(prisma, tenantId);
      const cuidadora = await crearPersona(prisma, tenantId, 'Cuidadora');

      await request(app.getHttpServer())
        .post(RELATIONSHIPS_PATH)
        .set('Origin', ORIGEN_AUTORIZADO)
        .set('Cookie', `merdn_institutional_session=${manager}`)
        .send({
          patientId: paciente.patientId,
          caregiverPersonId: cuidadora.personId,
          startsAt: new Date().toISOString(),
          endsAt: null,
          authorizationReference: 'SOPORTE.FICTICIO-0003',
          status: 'ACTIVE',
        })
        .expect(400);
    });

    it('la revocación cierra el acceso de la persona cuidadora de inmediato', async () => {
      const manager = await sesionManager();
      const paciente = await crearPacienteFicticio(prisma, tenantId);
      const { personId } = await crearPersona(prisma, tenantId, 'Cuidadora');
      const cuenta = await crearCuentaHumana(prisma, { tenantId, personId });
      const sesion = await crearSesionHumana(prisma, {
        tenantId,
        humanAccountId: cuenta.humanAccountId,
      });

      const relationshipId = await crearRelacion(prisma, {
        tenantId,
        patientId: paciente.patientId,
        caregiverPersonId: personId,
        status: 'ACTIVE',
      });

      const antes = await conSesion(CONTEXTS_PATH, sesion.token).expect(200);
      expect(antes.body.contexts).toEqual(['CAREGIVER']);

      const actual = await prisma.patientCaregiverRelationship.findUniqueOrThrow({
        where: { id: relationshipId },
        select: { version: true },
      });

      await request(app.getHttpServer())
        .patch(`${RELATIONSHIPS_PATH}/${relationshipId}/revoke`)
        .set('Origin', ORIGEN_AUTORIZADO)
        .set('Cookie', `merdn_institutional_session=${manager}`)
        .send({ expectedVersion: actual.version, reason: 'RELATIONSHIP_ENDED' })
        .expect(200);

      // La sesión humana sigue viva, pero el contexto ya no está disponible.
      const despues = await conSesion(CONTEXTS_PATH, sesion.token).expect(200);
      expect(despues.body.contexts).toEqual([]);
    });

    it('un identificador de otra institución responde 404 uniforme', async () => {
      const manager = await sesionManager();

      await request(app.getHttpServer())
        .get(`${RELATIONSHIPS_PATH}/00000000-0000-4000-8000-0000000000ff`)
        .set('Cookie', `merdn_institutional_session=${manager}`)
        .expect(404);
    });
  });

  describe('vínculo de identidad externa', () => {
    it('el emisor forma parte de la clave del vínculo', async () => {
      const { personId } = await crearPersona(prisma, tenantId);
      const primera = await crearCuentaHumana(prisma, { tenantId, personId });

      // MISMO `subject`, OTRO emisor: es otro vínculo y otra cuenta.
      const segunda = await crearCuentaHumana(prisma, {
        tenantId,
        personId,
        issuer: OTRO_EMISOR_FICTICIO,
        subject: primera.subject,
      });

      expect(segunda.humanAccountId).not.toBe(primera.humanAccountId);
    });
  });

  describe('contexto PROFESIONAL y revocación inmediata', () => {
    /**
     * Adaptador del `SqlRunner` del comando sobre la conexión de pruebas.
     *
     * Las sentencias que devuelven filas se ejecutan como consulta; las que solo
     * escriben, como sentencia. Todo ocurre dentro de UNA transacción, igual que
     * en el comando real, para que el bloqueo de la cuenta y la revocación de
     * sus sesiones no puedan separarse.
     */
    function runnerDe(tx: EjecutorSql): SqlRunner {
      return {
        async query(text: string, values: readonly unknown[] = []) {
          if (/^\s*SELECT/iu.test(text) || /RETURNING/iu.test(text)) {
            return (await tx.$queryRawUnsafe(text, ...values)) as never;
          }

          await tx.$executeRawUnsafe(text, ...values);

          return [] as never;
        },
      };
    }

    /** Ejecuta una operación del comando administrativo contra la base real. */
    async function aprovisionar(
      operation: ProvisioningOperation,
      tenant: string = tenantId,
    ): Promise<{ readonly outcome: string; readonly revokedSessions: number }> {
      const resultado = await prisma.$transaction(async (tx) =>
        runOperation(runnerDe(tx as unknown as EjecutorSql), tenant, operation, randomUUID()),
      );

      return {
        outcome: resultado.outcome,
        revokedSessions: resultado.revokedSessions,
      };
    }

    /** Persona con perfil profesional vigente, cuenta humana y sesión abierta. */
    async function sesionProfesional(): Promise<{
      readonly token: string;
      readonly humanAccountId: string;
      readonly issuer: string;
      readonly subject: string;
      readonly personId: string;
      readonly professionalId: string;
    }> {
      const { personId, professionalId } = await crearProfesionalFicticio(prisma, tenantId);
      const cuenta = await crearCuentaHumana(prisma, { tenantId, personId });
      const sesion = await crearSesionHumana(prisma, {
        tenantId,
        humanAccountId: cuenta.humanAccountId,
      });

      return {
        token: sesion.token,
        humanAccountId: cuenta.humanAccountId,
        issuer: cuenta.issuer,
        subject: cuenta.subject,
        personId,
        professionalId,
      };
    }

    it('declara PROFESSIONAL sin exponer persona, profesional, emisor ni subject', async () => {
      const profesional = await sesionProfesional();

      const respuesta = await conSesion(CONTEXTS_PATH, profesional.token).expect(200);

      expect(respuesta.body.contexts).toEqual(['PROFESSIONAL']);
      expect(respuesta.headers['cache-control']).toBe('private, no-store');

      // Los identificadores que SOSTIENEN el contexto se quedan en el servidor.
      const cuerpo = JSON.stringify(respuesta.body);
      for (const prohibido of [
        profesional.personId,
        profesional.professionalId,
        profesional.humanAccountId,
        profesional.issuer,
        profesional.subject,
        'personId',
        'professionalId',
        'issuer',
        'subject',
      ]) {
        expect(cuerpo).not.toContain(prohibido);
      }
    });

    it('UNLINK revoca la sesión: el token anterior responde 401 y el contexto desaparece', async () => {
      const profesional = await sesionProfesional();

      // El contexto existía justo antes de desvincular.
      const antes = await conSesion(CONTEXTS_PATH, profesional.token).expect(200);
      expect(antes.body.contexts).toEqual(['PROFESSIONAL']);

      const resultado = await aprovisionar({
        action: 'UNLINK',
        tenantCode: 'merdn-mvp',
        issuer: profesional.issuer,
        subject: profesional.subject,
      });

      expect(resultado.outcome).toBe('APPLIED');
      expect(resultado.revokedSessions).toBe(1);

      // El mismo token deja de servir: no hay periodo de gracia.
      await conSesion(SESSION_PATH, profesional.token).expect(401);
      await conSesion(CONTEXTS_PATH, profesional.token).expect(401);
    });

    it('DISABLE_ACCOUNT revoca la sesión: el token anterior responde 401 y el contexto desaparece', async () => {
      const profesional = await sesionProfesional();

      const antes = await conSesion(CONTEXTS_PATH, profesional.token).expect(200);
      expect(antes.body.contexts).toEqual(['PROFESSIONAL']);

      const resultado = await aprovisionar({
        action: 'DISABLE_ACCOUNT',
        tenantCode: 'merdn-mvp',
        humanAccountId: profesional.humanAccountId,
      });

      expect(resultado.outcome).toBe('APPLIED');
      expect(resultado.revokedSessions).toBe(1);

      await conSesion(SESSION_PATH, profesional.token).expect(401);
      await conSesion(CONTEXTS_PATH, profesional.token).expect(401);
    });

    it('UNLINK es idempotente y no alcanza a otro tenant', async () => {
      const profesional = await sesionProfesional();
      const operacion = {
        action: 'UNLINK',
        tenantCode: 'merdn-mvp',
        issuer: profesional.issuer,
        subject: profesional.subject,
      } as const;

      // Tenant ajeno: el vínculo no existe para él y la sesión sigue viva.
      const ajeno = await aprovisionar(operacion, randomUUID());
      expect(ajeno.outcome).toBe('NOT_FOUND');
      expect(ajeno.revokedSessions).toBe(0);
      await conSesion(SESSION_PATH, profesional.token).expect(200);

      expect(await aprovisionar(operacion)).toEqual({
        outcome: 'APPLIED',
        revokedSessions: 1,
      });

      // Repetir no vuelve a revocar ni finge una escritura nueva.
      expect(await aprovisionar(operacion)).toEqual({
        outcome: 'UNCHANGED',
        revokedSessions: 0,
      });
    });

    it('DISABLE_ACCOUNT es idempotente y no alcanza a otro tenant', async () => {
      const profesional = await sesionProfesional();
      const operacion = {
        action: 'DISABLE_ACCOUNT',
        tenantCode: 'merdn-mvp',
        humanAccountId: profesional.humanAccountId,
      } as const;

      const ajeno = await aprovisionar(operacion, randomUUID());
      expect(ajeno.outcome).toBe('NOT_FOUND');
      expect(ajeno.revokedSessions).toBe(0);
      await conSesion(SESSION_PATH, profesional.token).expect(200);

      expect(await aprovisionar(operacion)).toEqual({
        outcome: 'APPLIED',
        revokedSessions: 1,
      });

      // Ya deshabilitada y sin sesiones vivas: nada que cerrar.
      expect(await aprovisionar(operacion)).toEqual({
        outcome: 'UNCHANGED',
        revokedSessions: 0,
      });
    });
  });
});
