/*
 * Credenciales institucionales FICTICIAS de la suite. Deben quedar definidas
 * ANTES de importar la aplicación: el módulo institucional lee su configuración
 * una sola vez, al construirse.
 *
 * Se configuran LAS DOS —Alcaldía y Hospital— para poder comprobar que cada rol
 * se aprovisiona por separado y que ninguna credencial abre la sesión del otro.
 */
process.env['MERDN_MUNICIPAL_VIEWER_SECRET'] =
  'credencial-ficticia-de-pruebas-alcaldia-0001';
process.env['MERDN_MUNICIPAL_VIEWER_CODE'] = 'municipal-viewer-pruebas';
process.env['MERDN_HOSPITAL_PATIENT_VIEWER_SECRET'] =
  'credencial-ficticia-de-pruebas-hospital-0002';
process.env['MERDN_HOSPITAL_PATIENT_VIEWER_CODE'] = 'hospital-patient-viewer-pruebas';
/*
 * MP-TODAY-01 anade la identidad de AGENDA, que es la segunda que debe poder
 * cerrar su sesion. Su codigo es el mismo que usa la suite de agenda para que
 * la limpieza existente lo retire y ninguna otra prueba herede la identidad.
 */
process.env['MERDN_HOSPITAL_SCHEDULER_SECRET'] =
  'credencial-ficticia-de-pruebas-agenda-0003';
process.env['MERDN_HOSPITAL_SCHEDULER_CODE'] = 'hospital-scheduler-ficticio';

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';

import { AppModule } from '../src/app.module';
import { type PrismaClient } from '../src/generated/prisma/client';
import { type InstitutionalRoleCode } from '../src/institutional-auth/institutional-auth.contract';
import { MalformedJsonFilter } from '../src/patients/malformed-json.filter';

import { createTestPrismaClient, unavailableBanner } from './database-availability';
import { cleanupTestData } from './enrollment-fixtures';
import {
  CODIGO_IDENTIDAD_SCHEDULER,
  CREDENCIAL_SCHEDULER_FICTICIA,
  limpiarIdentidadAgenda,
} from './hospital-core-02-fixtures';
import {
  CODIGO_IDENTIDAD_HOSPITAL,
  CREDENCIAL_HOSPITAL_FICTICIA,
  cookieDe,
} from './hospital-fixtures';
import { limpiarIdentidadesInstitucionales } from './municipality-fixtures';

/**
 * Establecimiento de la sesión institucional con roles disjuntos
 * (TASK-HOSPITAL-CORE-01 §4.1.2, §4.1.3, §9.2, §9.3 y §12.2).
 *
 * Vive en un archivo APARTE del resto de las pruebas hospitalarias por una razón
 * concreta: el control de abuso del inicio de sesión cuenta intentos por proceso
 * y por origen, y agrupar aquí todos los intentos —incluidos los que DEBEN
 * fallar— agotaría la ventana del otro archivo. Separarlos mantiene ambos
 * conjuntos deterministas sin relajar el control.
 *
 * Lo que se verifica:
 * 1. el cliente Alcaldía existente sigue funcionando SIN enviar `identityCode`;
 * 2. Hospital abre su sesión con su propio código y obtiene su propio rol;
 * 3. ninguna credencial abre la identidad del otro rol;
 * 4. código inexistente, credencial incorrecta y código mal formado son
 *    INDISTINGUIBLES entre sí;
 * 5. el cliente NO puede pedir un rol ni un tenant.
 *
 * Todas las credenciales son ficticias y de uso exclusivamente local.
 */

const INSTITUTIONAL_COOKIE = 'merdn_institutional_session';
const SESSIONS_PATH = '/api/v1/institutional/sessions';
const CURRENT_PATH = '/api/v1/institutional/sessions/current';
const LIST_PATH = '/api/v1/hospital/patients';
const POPULATION_PATH = '/api/v1/municipality/population-summary';

/**
 * Origen web autorizado por la configuración por defecto del entorno.
 *
 * Abrir y cerrar la sesión institucional exigen un origen declarado y
 * autorizado: sin ninguna de las dos cabeceras la petición se rechaza.
 */
const ORIGEN_WEB_AUTORIZADO = 'http://127.0.0.1:3000';

const CREDENCIAL_MUNICIPAL_FICTICIA = 'credencial-ficticia-de-pruebas-alcaldia-0001';
const CODIGO_IDENTIDAD_MUNICIPAL = 'municipal-viewer-pruebas';

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

describe.skipIf(!puedeEjecutarse)('Sesión institucional con roles disjuntos', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let tenantId: string;

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
      await cleanupTestData(prisma);
      await limpiarIdentidadesInstitucionales(prisma);
      await prisma.$disconnect();
    }
  });

  function abrir(body: Record<string, unknown>): request.Test {
    return request(app.getHttpServer())
      .post(SESSIONS_PATH)
      .set('Origin', ORIGEN_WEB_AUTORIZADO)
      .send(body);
  }

  /* ====================================================================== */
  /* Compatibilidad municipal                                                */
  /* ====================================================================== */

  it('el cliente Alcaldía existente sigue funcionando sin enviar identityCode', async () => {
    const respuesta = await abrir({ accessSecret: CREDENCIAL_MUNICIPAL_FICTICIA }).expect(
      201,
    );

    expect(respuesta.body.role).toBe('MUNICIPAL_VIEWER');

    const cookie = cookieDe(respuesta.headers['set-cookie']) ?? '';

    // Y la sesión municipal accede a Municipality, no a Hospital.
    await request(app.getHttpServer())
      .get(POPULATION_PATH)
      .set('Cookie', `${INSTITUTIONAL_COOKIE}=${cookie}`)
      .expect(200);

    await request(app.getHttpServer())
      .get(LIST_PATH)
      .set('Cookie', `${INSTITUTIONAL_COOKIE}=${cookie}`)
      .expect(403);
  });

  /* ====================================================================== */
  /* Sesión hospitalaria                                                     */
  /* ====================================================================== */

  it('Hospital abre su sesión con su propio código y accede solo a Hospital', async () => {
    const respuesta = await abrir({
      accessSecret: CREDENCIAL_HOSPITAL_FICTICIA,
      identityCode: CODIGO_IDENTIDAD_HOSPITAL,
    }).expect(201);

    expect(respuesta.body).toStrictEqual({
      role: 'HOSPITAL_PATIENT_VIEWER',
      expiresAt: expect.any(String),
    });

    const cabeceras = respuesta.headers['set-cookie'] as unknown as string[];
    const cabecera = cabeceras.find((valor) => valor.startsWith(INSTITUTIONAL_COOKIE));

    // Cookie segura: HttpOnly, acotada y sin ningún dato dentro.
    expect(cabecera).toContain('HttpOnly');
    expect(cabecera).toContain('Path=/');
    expect(cabecera).toContain('SameSite=');
    expect(cabecera).not.toContain('HOSPITAL_PATIENT_VIEWER');
    expect(cabecera).not.toContain(tenantId);

    // Ni la credencial ni el tenant viajan en el cuerpo.
    const serializado = JSON.stringify(respuesta.body);

    expect(serializado).not.toContain(CREDENCIAL_HOSPITAL_FICTICIA);
    expect(serializado).not.toContain(tenantId);
    expect(serializado).not.toContain('tenant');
    expect(serializado).not.toContain('token');

    const cookie = cookieDe(respuesta.headers['set-cookie']) ?? '';

    await request(app.getHttpServer())
      .get(LIST_PATH)
      .set('Cookie', `${INSTITUTIONAL_COOKIE}=${cookie}`)
      .expect(200);

    await request(app.getHttpServer())
      .get(POPULATION_PATH)
      .set('Cookie', `${INSTITUTIONAL_COOKIE}=${cookie}`)
      .expect(403);
  });

  it('almacena la credencial hospitalaria únicamente como derivación', async () => {
    const identidad = await prisma.institutionalIdentity.findFirst({
      where: { tenantId, code: CODIGO_IDENTIDAD_HOSPITAL },
      select: { role: true, accessSecretHash: true, accessSecretSalt: true },
    });

    expect(identidad?.role).toBe('HOSPITAL_PATIENT_VIEWER');
    expect(identidad?.accessSecretHash).toMatch(/^[0-9a-f]{128}$/u);
    expect(identidad?.accessSecretSalt).toMatch(/^[0-9a-f]{32}$/u);
    expect(identidad?.accessSecretHash).not.toContain(CREDENCIAL_HOSPITAL_FICTICIA);
  });

  it('las dos identidades coexisten sin invalidarse', async () => {
    const identidades = await prisma.institutionalIdentity.findMany({
      where: { tenantId, code: { contains: 'pruebas' } },
      select: { code: true, role: true, status: true },
      orderBy: { code: 'asc' },
    });

    expect(identidades).toStrictEqual([
      {
        code: CODIGO_IDENTIDAD_HOSPITAL,
        role: 'HOSPITAL_PATIENT_VIEWER',
        status: 'ACTIVE',
      },
      { code: CODIGO_IDENTIDAD_MUNICIPAL, role: 'MUNICIPAL_VIEWER', status: 'ACTIVE' },
    ]);
  });

  /* ====================================================================== */
  /* Indistinguibilidad de los fallos                                        */
  /* ====================================================================== */

  it('ninguna credencial abre la identidad del otro rol', async () => {
    // Credencial de Hospital contra el código municipal.
    await abrir({
      accessSecret: CREDENCIAL_HOSPITAL_FICTICIA,
      identityCode: CODIGO_IDENTIDAD_MUNICIPAL,
    }).expect(401);

    // Credencial de Alcaldía contra el código hospitalario.
    await abrir({
      accessSecret: CREDENCIAL_MUNICIPAL_FICTICIA,
      identityCode: CODIGO_IDENTIDAD_HOSPITAL,
    }).expect(401);
  });

  it('código inexistente y credencial incorrecta son indistinguibles', async () => {
    const inexistente = await abrir({
      accessSecret: CREDENCIAL_HOSPITAL_FICTICIA,
      identityCode: 'identidad-que-no-existe',
    }).expect(401);

    const credencialMala = await abrir({
      accessSecret: 'credencial-ficticia-que-no-corresponde',
      identityCode: CODIGO_IDENTIDAD_HOSPITAL,
    }).expect(401);

    expect(inexistente.body).toStrictEqual(credencialMala.body);
    expect(inexistente.body.code).toBe('INSTITUTIONAL_INVALID_CREDENTIALS');
    // La respuesta no describe la causa ni nombra la identidad.
    expect(JSON.stringify(inexistente.body)).not.toContain('identidad-que-no-existe');
  });

  it('un identityCode con forma no admitida se rechaza sin tocar la base', async () => {
    const antes = await prisma.person.count();

    const respuesta = await abrir({
      accessSecret: CREDENCIAL_HOSPITAL_FICTICIA,
      identityCode: `Hospital${String.fromCharCode(39)}; DROP TABLE person; --`,
    }).expect(401);

    expect(respuesta.body.code).toBe('INSTITUTIONAL_INVALID_CREDENTIALS');
    // La tabla sigue existiendo: la comprobación es literal, no retórica.
    await expect(prisma.person.count()).resolves.toBe(antes);
  });

  /* ====================================================================== */
  /* El cliente no elige rol ni tenant                                       */
  /* ====================================================================== */

  it('un rol o un tenant enviados por el cliente se ignoran por completo', async () => {
    const respuesta = await abrir({
      accessSecret: CREDENCIAL_MUNICIPAL_FICTICIA,
      identityCode: CODIGO_IDENTIDAD_MUNICIPAL,
      role: 'HOSPITAL_PATIENT_VIEWER',
      tenantId: '00000000-0000-4000-8000-000000000000',
    }).expect(201);

    // El rol lo fija la identidad persistida, nunca la petición.
    expect(respuesta.body.role).toBe('MUNICIPAL_VIEWER');

    const cookie = cookieDe(respuesta.headers['set-cookie']) ?? '';

    // Y con esa sesión Hospital sigue cerrada.
    await request(app.getHttpServer())
      .get(LIST_PATH)
      .set('Cookie', `${INSTITUTIONAL_COOKIE}=${cookie}`)
      .expect(403);

    // La sesión pertenece al tenant del servidor, no al enviado.
    const sesiones = await prisma.institutionalSession.findMany({
      where: { tenantId },
      select: { tenantId: true },
      take: 1,
    });

    expect(sesiones[0]?.tenantId).toBe(tenantId);
  });

  it('la creación de sesión registra el rol efectivo en la auditoría', async () => {
    const eventos = await prisma.auditEvent.findMany({
      where: { tenantId, eventType: 'INSTITUTIONAL_SESSION_CREATED' },
      orderBy: { occurredAt: 'desc' },
      take: 8,
      select: { actorRole: true, actorType: true, outcome: true },
    });

    const roles = new Set(eventos.map((evento) => evento.actorRole));

    expect(roles.has('HOSPITAL_PATIENT_VIEWER')).toBe(true);
    expect(roles.has('MUNICIPAL_VIEWER')).toBe(true);

    for (const evento of eventos) {
      expect(evento.actorType).toBe('INSTITUTIONAL_IDENTITY');
      expect(evento.outcome).toBe('SUCCESS');
    }
  });
});

/**
 * MP-TODAY-01 — cierre de la sesión institucional desde Hospital.
 *
 * Antes de esta tarea el cierre exigía el rol `MUNICIPAL_VIEWER`, de modo que
 * ninguna identidad hospitalaria podía cerrar la suya: recibía `403` con una
 * sesión perfectamente válida y la sesión seguía viva. Lo que se comprueba aquí:
 *
 * 1. Viewer hospitalario: login → contexto → cierre → `401`;
 * 2. Scheduler hospitalario: login → contexto → cierre → `401`;
 * 3. una petición que declara un origen ajeno se rechaza con `403`, tanto al
 *    abrir como al cerrar, y en el cierre la sesión sigue vigente después;
 * 4. una credencial incorrecta sigue devolviendo `401`.
 *
 * Además se verifica que el cierre CONSERVA lo ya aprobado: borra la cookie,
 * revoca la fila sin eliminarla y registra el evento de auditoría con el rol
 * efectivo.
 *
 * Este bloque construye su PROPIA aplicación a propósito. El control de abuso
 * del inicio de sesión cuenta intentos por proceso y por origen; una instancia
 * separada le da una ventana limpia y evita que estas comprobaciones agoten la
 * del bloque anterior. El límite NO se relaja: sigue exactamente igual.
 */
describe.skipIf(!puedeEjecutarse)('MP-TODAY-01 — cierre de sesión institucional', () => {
  const ORIGEN_AUTORIZADO = ORIGEN_WEB_AUTORIZADO;
  /** Origen NO autorizado. Es un dominio reservado: no resuelve a ningún sitio. */
  const ORIGEN_AJENO = 'http://sitio-ajeno.invalid';

  let app: INestApplication;
  let prisma: PrismaClient;
  let tenantId: string;

  beforeAll(async () => {
    prisma = createTestPrismaClient();
    await limpiarIdentidadesInstitucionales(prisma);
    await limpiarIdentidadAgenda(prisma);

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
      await limpiarIdentidadesInstitucionales(prisma);
      await limpiarIdentidadAgenda(prisma);
      await prisma.$disconnect();
    }
  });

  /** Abre sesión desde el origen autorizado y devuelve el valor de la cookie. */
  async function iniciarSesion(
    accessSecret: string,
    identityCode: string,
    rolEsperado: InstitutionalRoleCode,
  ): Promise<string> {
    const respuesta = await request(app.getHttpServer())
      .post(SESSIONS_PATH)
      .set('Origin', ORIGEN_AUTORIZADO)
      .send({ accessSecret, identityCode })
      .expect(201);

    expect(respuesta.body.role).toBe(rolEsperado);

    const cookie = cookieDe(respuesta.headers['set-cookie']);

    expect(cookie).not.toBeNull();

    return cookie ?? '';
  }

  /**
   * Ciclo completo de una identidad institucional cualquiera.
   *
   * Es el mismo recorrido para los dos roles a propósito: cerrar la sesión
   * pertenece a la sesión misma y no puede depender de qué rol la abrió.
   */
  async function cicloDeSesion(
    accessSecret: string,
    identityCode: string,
    rolEsperado: InstitutionalRoleCode,
  ): Promise<void> {
    const cookie = await iniciarSesion(accessSecret, identityCode, rolEsperado);
    const cabeceraCookie = `${INSTITUTIONAL_COOKIE}=${cookie}`;

    // 1. La sesión existe y se describe con su rol efectivo.
    const contexto = await request(app.getHttpServer())
      .get(CURRENT_PATH)
      .set('Cookie', cabeceraCookie)
      .expect(200);

    expect(contexto.body.role).toBe(rolEsperado);

    // 2. Un cierre pedido desde un origen ajeno NO cierra nada.
    const ajeno = await request(app.getHttpServer())
      .delete(CURRENT_PATH)
      .set('Origin', ORIGEN_AJENO)
      .set('Cookie', cabeceraCookie)
      .expect(403);

    expect(ajeno.body.code).toBe('INSTITUTIONAL_ORIGIN_REJECTED');

    await request(app.getHttpServer())
      .get(CURRENT_PATH)
      .set('Cookie', cabeceraCookie)
      .expect(200);

    // 3. El cierre legítimo responde 204 y BORRA la cookie.
    const cierre = await request(app.getHttpServer())
      .delete(CURRENT_PATH)
      .set('Origin', ORIGEN_AUTORIZADO)
      .set('Cookie', cabeceraCookie)
      .expect(204);

    const cabeceras = cierre.headers['set-cookie'] as unknown as string[];
    const borrado = cabeceras.find((valor) => valor.startsWith(INSTITUTIONAL_COOKIE));

    expect(borrado).toContain(`${INSTITUTIONAL_COOKIE}=;`);
    expect(borrado).toContain('Max-Age=0');
    expect(borrado).toContain('HttpOnly');

    // 4. La sesión ya no vale para nada, y el desenlace es 401, no 403.
    await request(app.getHttpServer())
      .get(CURRENT_PATH)
      .set('Cookie', cabeceraCookie)
      .expect(401);

    const repetido = await request(app.getHttpServer())
      .delete(CURRENT_PATH)
      .set('Origin', ORIGEN_AUTORIZADO)
      .set('Cookie', cabeceraCookie)
      .expect(401);

    expect(repetido.body.code).toBe('INSTITUTIONAL_SESSION_REQUIRED');

    // 5. La fila se CONSERVA revocada y el evento de auditoría queda registrado.
    const revocadas = await prisma.institutionalSession.count({
      where: { tenantId, revokedAt: { not: null } },
    });

    expect(revocadas).toBeGreaterThan(0);

    const evento = await prisma.auditEvent.findFirst({
      where: {
        tenantId,
        eventType: 'INSTITUTIONAL_SESSION_REVOKED',
        actorRole: rolEsperado,
      },
      orderBy: { occurredAt: 'desc' },
      select: {
        actorType: true,
        outcome: true,
        endpoint: true,
        resourceType: true,
      },
    });

    expect(evento).not.toBeNull();
    expect(evento?.actorType).toBe('INSTITUTIONAL_IDENTITY');
    expect(evento?.outcome).toBe('SUCCESS');
    expect(evento?.resourceType).toBe('InstitutionalSession');
    expect(evento?.endpoint).toBe('DELETE /api/v1/institutional/sessions/current');
  }

  it('Viewer hospitalario: login, contexto, cierre y 401', async () => {
    await cicloDeSesion(
      CREDENCIAL_HOSPITAL_FICTICIA,
      CODIGO_IDENTIDAD_HOSPITAL,
      'HOSPITAL_PATIENT_VIEWER',
    );
  });

  it('Scheduler hospitalario: login, contexto, cierre y 401', async () => {
    await cicloDeSesion(
      CREDENCIAL_SCHEDULER_FICTICIA,
      CODIGO_IDENTIDAD_SCHEDULER,
      'HOSPITAL_SCHEDULER',
    );
  });

  it('una apertura declarada desde un origen ajeno se rechaza con 403', async () => {
    const respuesta = await request(app.getHttpServer())
      .post(SESSIONS_PATH)
      .set('Origin', ORIGEN_AJENO)
      .send({
        accessSecret: CREDENCIAL_HOSPITAL_FICTICIA,
        identityCode: CODIGO_IDENTIDAD_HOSPITAL,
      })
      .expect(403);

    expect(respuesta.body.code).toBe('INSTITUTIONAL_ORIGIN_REJECTED');
    // Ni se emite cookie ni se describe la causa real.
    expect(respuesta.headers['set-cookie']).toBeUndefined();
    expect(JSON.stringify(respuesta.body)).not.toContain(CREDENCIAL_HOSPITAL_FICTICIA);
  });

  it('una apertura sin Origin ni Referer se rechaza con 403', async () => {
    const respuesta = await request(app.getHttpServer())
      .post(SESSIONS_PATH)
      .send({
        accessSecret: CREDENCIAL_HOSPITAL_FICTICIA,
        identityCode: CODIGO_IDENTIDAD_HOSPITAL,
      })
      .expect(403);

    expect(respuesta.body.code).toBe('INSTITUTIONAL_ORIGIN_REJECTED');
    // Ni se emite cookie ni se describe la causa real.
    expect(respuesta.headers['set-cookie']).toBeUndefined();
    expect(JSON.stringify(respuesta.body)).not.toContain(CREDENCIAL_HOSPITAL_FICTICIA);
  });

  it('un cierre sin Origin ni Referer se rechaza con 403 y la sesión sigue viva', async () => {
    const cookie = await iniciarSesion(
      CREDENCIAL_HOSPITAL_FICTICIA,
      CODIGO_IDENTIDAD_HOSPITAL,
      'HOSPITAL_PATIENT_VIEWER',
    );
    const cabeceraCookie = `${INSTITUTIONAL_COOKIE}=${cookie}`;

    const rechazado = await request(app.getHttpServer())
      .delete(CURRENT_PATH)
      .set('Cookie', cabeceraCookie)
      .expect(403);

    expect(rechazado.body.code).toBe('INSTITUTIONAL_ORIGIN_REJECTED');
    // El cierre rechazado NO borra la cookie del cliente.
    expect(rechazado.headers['set-cookie']).toBeUndefined();

    // Y la sesión sigue vigente: el contexto se sigue entregando.
    const contexto = await request(app.getHttpServer())
      .get(CURRENT_PATH)
      .set('Cookie', cabeceraCookie)
      .expect(200);

    expect(contexto.body.role).toBe('HOSPITAL_PATIENT_VIEWER');
  });

  it('una credencial incorrecta desde el origen autorizado sigue devolviendo 401', async () => {
    const respuesta = await request(app.getHttpServer())
      .post(SESSIONS_PATH)
      .set('Origin', ORIGEN_AUTORIZADO)
      .send({
        accessSecret: 'credencial-ficticia-que-no-corresponde',
        identityCode: CODIGO_IDENTIDAD_HOSPITAL,
      })
      .expect(401);

    expect(respuesta.body.code).toBe('INSTITUTIONAL_INVALID_CREDENTIALS');
    expect(respuesta.headers['set-cookie']).toBeUndefined();
  });
});
