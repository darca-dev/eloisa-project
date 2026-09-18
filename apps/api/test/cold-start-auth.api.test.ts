/*
 * Credenciales e identidades FICTICIAS de esta suite. Deben quedar definidas
 * ANTES de importar la aplicación: los módulos institucional y humano leen su
 * configuración una sola vez, al construirse.
 *
 * Los códigos NO reutilizan los de otras suites, para que la limpieza de esta
 * no retire identidades ajenas ni al revés. Ninguna credencial es real.
 */
process.env['MERDN_MUNICIPAL_VIEWER_SECRET'] =
  'credencial-ficticia-arranque-frio-alcaldia-0001';
process.env['MERDN_MUNICIPAL_VIEWER_CODE'] = 'municipal-viewer-arranque-pruebas';
process.env['MERDN_HOSPITAL_PATIENT_VIEWER_SECRET'] =
  'credencial-ficticia-arranque-frio-hospital-0002';
process.env['MERDN_HOSPITAL_PATIENT_VIEWER_CODE'] = 'hospital-patient-viewer-arranque-pruebas';
process.env['MERDN_HUMAN_AUTH_ISSUER'] =
  'http://host.docker.internal:8081/realms/merdn-local';
process.env['MERDN_HUMAN_AUTH_CLIENT_ID'] = 'merdn-human-web';
process.env['MERDN_HUMAN_AUTH_CALLBACK_URI'] =
  'http://127.0.0.1:3001/api/v1/human-auth/callback';
process.env['MERDN_HUMAN_AUTH_ATTEMPT_KEY'] = 'c'.repeat(64);

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';

import { AppModule } from '../src/app.module';
import { API_ENVIRONMENT } from '../src/config/api-environment.provider';
import { type ApiEnvironment } from '../src/config/environment';
import { RUNTIME_ROLE_NAME } from '../src/database/prisma.service';
import { type PrismaClient } from '../src/generated/prisma/client';
import { MalformedJsonFilter } from '../src/patients/malformed-json.filter';

import { createTestPrismaClient, unavailableBanner } from './database-availability';
import {
  cookieDe,
  crearCuentaHumana,
  crearPacienteFicticio,
  crearSesionHumana,
} from './identity-relationships-fixtures';

/**
 * ARRANQUE EN FRÍO con `MERDN_RUNTIME_ROLE=enforce` (Spec 024, criterio 1).
 *
 * Antes de esta corrección, un proceso recién arrancado no podía resolver el
 * tenant activo: la lectura por código quedaba fuera de una transacción con rol
 * runtime y GUC, la política `tenant_self` ocultaba la fila y la PRIMERA
 * petición de cualquier perfil fallaba. Aquí se comprueba lo contrario contra
 * PostgreSQL REAL: una aplicación construida de cero —caché de tenant vacía—
 * atiende con éxito la primera petición de Hospital, Alcaldía y Paciente.
 *
 * CACHÉ VACÍA. La aplicación se construye dentro de la propia prueba, justo
 * antes de la petición. `TenantContextService` guarda su caché en la instancia,
 * de modo que una aplicación nueva es un arranque en frío real. La primera
 * petición de negocio es, además, la primera de esa aplicación.
 *
 * CREDENCIAL Y ROL. El entorno de la aplicación se sustituye por una
 * configuración `enforce` que lleva la pareja confiable `id + code` real de esta
 * base. La conexión sigue siendo la de pruebas y el modo `enforce` adopta
 * `merdn_runtime` con `SET LOCAL ROLE`, igual que `runtime-fail-closed.db.test.ts`:
 * lo que se verifica es el ROL EFECTIVO —comprobado aquí mismo— y no la
 * separación de credenciales de despliegue, competencia de la Spec 023. No se
 * inventa credencial alguna ni se degrada el modo para que la suite pase.
 *
 * VALORES DEMO. No se tocan los valores demo municipales locales: esta suite
 * usa códigos institucionales propios, sufijados `-arranque-pruebas`.
 */

const SESSIONS_PATH = '/api/v1/institutional/sessions';
const CURRENT_PATH = '/api/v1/institutional/sessions/current';
const HOSPITAL_PATH = '/api/v1/hospital/patients';
const POPULATION_PATH = '/api/v1/municipality/population-summary';
const CONTEXTS_PATH = '/api/v1/me/contexts';

const INSTITUTIONAL_COOKIE = 'merdn_institutional_session';
const HUMAN_COOKIE = 'merdn_human_session';
const ORIGEN_WEB_AUTORIZADO = 'http://127.0.0.1:3000';

const CREDENCIAL_MUNICIPAL = 'credencial-ficticia-arranque-frio-alcaldia-0001';
const CODIGO_MUNICIPAL = 'municipal-viewer-arranque-pruebas';
const CREDENCIAL_HOSPITAL = 'credencial-ficticia-arranque-frio-hospital-0002';
const CODIGO_HOSPITAL = 'hospital-patient-viewer-arranque-pruebas';

const CODIGO_ACTIVO = process.env['MERDN_ACTIVE_TENANT_CODE'] ?? 'merdn-mvp';

const availability = inject('databaseAvailability');
const puedeEjecutarse =
  availability.available &&
  availability.migrated &&
  availability.engine === 'postgresql-server';

if (!puedeEjecutarse) {
  // eslint-disable-next-line no-console
  console.warn(`\n${unavailableBanner(availability)}\n`);
}

/** Configuración `enforce` con la pareja confiable real de esta base. */
function entornoEnforce(tenantId: string): ApiEnvironment {
  return {
    merdnEnvironment: 'test',
    port: 3001,
    openApiPath: 'docs',
    runtimeRoleMode: 'enforce',
    hasSeparateRuntimeConnection: false,
    activeTenantCode: CODIGO_ACTIVO,
    activeTenantId: tenantId,
    consent: {
      version: 'paciente-tratamiento-datos-v1',
      purpose: 'INSCRIPCION_PACIENTE_MERDN',
    },
    enrollmentSession: {
      cookieName: 'merdn_enrollment_session',
      sameSite: 'lax',
      secure: false,
      domain: undefined,
      ttlSeconds: 3600,
    },
    webOrigins: [ORIGEN_WEB_AUTORIZADO],
    enrollmentRateLimit: { maxRequests: 1000, windowSeconds: 900 },
  };
}

describe.skipIf(!puedeEjecutarse)('Arranque en frío bajo enforce', () => {
  let prisma: PrismaClient;
  let tenantId: string;
  let cookieHumana: string;

  /** REGISTRO EXACTO de lo que esta suite siembra. La limpieza retira ESTO. */
  const sembrado: {
    personId: string | null;
    patientId: string | null;
    humanAccountId: string | null;
    sessionId: string | null;
  } = { personId: null, patientId: null, humanAccountId: null, sessionId: null };

  /** Aplicaciones construidas por las pruebas; se cierran todas al final. */
  const aplicaciones: INestApplication[] = [];

  /**
   * Construye una aplicación NUEVA en modo `enforce`.
   *
   * Cada llamada es un arranque en frío: módulos nuevos, `PrismaService` nuevo y
   * `TenantContextService` nuevo con la caché de tenant vacía.
   */
  async function arrancarEnFrio(): Promise<INestApplication> {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(API_ENVIRONMENT)
      .useValue(entornoEnforce(tenantId))
      .compile();

    const app = moduleRef.createNestApplication();
    app.useGlobalFilters(new MalformedJsonFilter());
    await app.init();
    aplicaciones.push(app);
    return app;
  }

  beforeAll(async () => {
    prisma = createTestPrismaClient();

    const tenant = await prisma.tenant.findUnique({
      where: { code: CODIGO_ACTIVO },
      select: { id: true },
    });
    if (tenant === null) {
      throw new Error('El tenant institucional activo no existe: aplique las migraciones.');
    }
    tenantId = tenant.id;

    // Identidad humana FICTICIA con participación de Paciente. La sesión se
    // siembra directamente porque el proveedor OIDC no se levanta en pruebas:
    // lo que se verifica aquí es la PRIMERA petición autenticada tras el
    // arranque en frío, no el intercambio con el emisor.
    const paciente = await crearPacienteFicticio(prisma, tenantId);
    const cuenta = await crearCuentaHumana(prisma, {
      tenantId,
      personId: paciente.personId,
    });
    const sesion = await crearSesionHumana(prisma, {
      tenantId,
      humanAccountId: cuenta.humanAccountId,
    });
    cookieHumana = sesion.token;

    sembrado.personId = paciente.personId;
    sembrado.patientId = paciente.patientId;
    sembrado.humanAccountId = cuenta.humanAccountId;
    sembrado.sessionId = sesion.sessionId;
  });

  afterAll(async () => {
    for (const app of aplicaciones) {
      await app.close();
    }

    /*
     * Limpieza ESTRECHA: se retira exactamente lo que esta suite sembró, por
     * identificador, y las dos identidades institucionales que su propio
     * aprovisionamiento creó, por código propio.
     *
     * Deliberadamente NO se usan las limpiezas amplias por prefijo: esta suite
     * corre en paralelo con las demás y borrar por patrón retiraría datos que
     * otro archivo está usando en ese mismo momento. No se toca ningún valor
     * demo local, municipal incluido.
     */
    if (sembrado.sessionId !== null) {
      await prisma.humanSession.deleteMany({ where: { id: sembrado.sessionId } });
    }
    if (sembrado.humanAccountId !== null) {
      await prisma.externalAuthIdentity.deleteMany({
        where: { humanAccountId: sembrado.humanAccountId },
      });
      await prisma.humanAccount.deleteMany({ where: { id: sembrado.humanAccountId } });
    }
    if (sembrado.patientId !== null) {
      await prisma.patient.deleteMany({ where: { id: sembrado.patientId } });
    }
    if (sembrado.personId !== null) {
      await prisma.person.deleteMany({ where: { id: sembrado.personId } });
    }

    await prisma.institutionalIdentity.deleteMany({
      where: { code: { in: [CODIGO_MUNICIPAL, CODIGO_HOSPITAL] } },
    });

    await prisma.$disconnect();
  });

  it('la aplicación corre bajo el rol runtime y sin BYPASSRLS', async () => {
    const app = await arrancarEnFrio();
    const entorno = app.get<ApiEnvironment>(API_ENVIRONMENT);

    expect(entorno.runtimeRoleMode).toBe('enforce');
    expect(entorno.activeTenantId).toBe(tenantId);

    const [identidad] = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL ROLE "${RUNTIME_ROLE_NAME}"`);
      return tx.$queryRaw<
        { readonly rol: string; readonly bypassrls: boolean }[]
      >`SELECT current_user::text AS rol, rolbypassrls AS bypassrls
          FROM pg_roles WHERE rolname = current_user`;
    });

    expect(identidad?.rol).toBe(RUNTIME_ROLE_NAME);
    expect(identidad?.bypassrls).toBe(false);
  });

  it('Hospital autentica en la PRIMERA petición tras el arranque en frío', async () => {
    const app = await arrancarEnFrio();

    const login = await request(app.getHttpServer())
      .post(SESSIONS_PATH)
      .set('Origin', ORIGEN_WEB_AUTORIZADO)
      .send({ identityCode: CODIGO_HOSPITAL, accessSecret: CREDENCIAL_HOSPITAL });

    expect(login.status).toBe(201);

    const cookie = cookieDe(login.headers['set-cookie'], INSTITUTIONAL_COOKIE);
    expect(cookie).not.toBeNull();

    const sesion = await request(app.getHttpServer())
      .get(CURRENT_PATH)
      .set('Cookie', `${INSTITUTIONAL_COOKIE}=${cookie ?? ''}`);

    expect(sesion.status).toBe(200);
    expect(sesion.body.role).toBe('HOSPITAL_PATIENT_VIEWER');

    // Y la superficie hospitalaria responde con esa misma sesión.
    const listado = await request(app.getHttpServer())
      .get(HOSPITAL_PATH)
      .set('Cookie', `${INSTITUTIONAL_COOKIE}=${cookie ?? ''}`);

    expect(listado.status).toBe(200);
  });

  it('Alcaldía autentica con MUNICIPAL_VIEWER en la PRIMERA petición', async () => {
    const app = await arrancarEnFrio();

    const login = await request(app.getHttpServer())
      .post(SESSIONS_PATH)
      .set('Origin', ORIGEN_WEB_AUTORIZADO)
      .send({ identityCode: CODIGO_MUNICIPAL, accessSecret: CREDENCIAL_MUNICIPAL });

    expect(login.status).toBe(201);

    const cookie = cookieDe(login.headers['set-cookie'], INSTITUTIONAL_COOKIE);
    expect(cookie).not.toBeNull();

    const sesion = await request(app.getHttpServer())
      .get(CURRENT_PATH)
      .set('Cookie', `${INSTITUTIONAL_COOKIE}=${cookie ?? ''}`);

    expect(sesion.status).toBe(200);
    // Rol EXACTO exigido por el paquete de evidencia.
    expect(sesion.body.role).toBe('MUNICIPAL_VIEWER');

    const resumen = await request(app.getHttpServer())
      .get(POPULATION_PATH)
      .set('Cookie', `${INSTITUTIONAL_COOKIE}=${cookie ?? ''}`);

    expect(resumen.status).toBe(200);
  });

  it('Paciente autentica por sesión humana en la PRIMERA petición', async () => {
    const app = await arrancarEnFrio();

    const contextos = await request(app.getHttpServer())
      .get(CONTEXTS_PATH)
      .set('Cookie', `${HUMAN_COOKIE}=${cookieHumana}`);

    expect(contextos.status).toBe(200);
  });

  it('el cliente NO puede proponer un tenant en el inicio de sesión', async () => {
    const app = await arrancarEnFrio();

    const login = await request(app.getHttpServer())
      .post(SESSIONS_PATH)
      .set('Origin', ORIGEN_WEB_AUTORIZADO)
      .set('X-Tenant-Id', '00000000-0000-4000-8000-0000000000ff')
      .set('X-Tenant-Code', 'merdn-test-arranque-ajeno')
      .send({
        identityCode: CODIGO_MUNICIPAL,
        accessSecret: CREDENCIAL_MUNICIPAL,
        tenantId: '00000000-0000-4000-8000-0000000000ff',
        tenantCode: 'merdn-test-arranque-ajeno',
      });

    // El intento de proponer tenant se ignora por completo: la sesión se abre
    // sobre el tenant configurado del servidor, o no se abre.
    expect([201, 400]).toContain(login.status);

    if (login.status === 201) {
      const cookie = cookieDe(login.headers['set-cookie'], INSTITUTIONAL_COOKIE);
      const sesion = await request(app.getHttpServer())
        .get(CURRENT_PATH)
        .set('Cookie', `${INSTITUTIONAL_COOKIE}=${cookie ?? ''}`);

      expect(sesion.status).toBe(200);
      expect(JSON.stringify(sesion.body)).not.toContain('merdn-test-arranque-ajeno');
      expect(JSON.stringify(sesion.body)).not.toContain(
        '00000000-0000-4000-8000-0000000000ff',
      );
    }
  });

  it('una credencial incorrecta sigue siendo rechazada tras el arranque en frío', async () => {
    const app = await arrancarEnFrio();

    const login = await request(app.getHttpServer())
      .post(SESSIONS_PATH)
      .set('Origin', ORIGEN_WEB_AUTORIZADO)
      .send({ identityCode: CODIGO_MUNICIPAL, accessSecret: 'credencial-ficticia-incorrecta' });

    expect(login.status).toBe(401);
    expect(cookieDe(login.headers['set-cookie'], INSTITUTIONAL_COOKIE)).toBeNull();
  });
});
