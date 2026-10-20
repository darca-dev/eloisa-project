/*
 * Credenciales institucionales FICTICIAS de la suite. Deben quedar definidas
 * ANTES de importar la aplicación: el módulo institucional lee su configuración
 * una sola vez, al construirse.
 *
 * Se configuran LAS DOS —Alcaldía y Hospital— para poder ejercitar la matriz
 * completa de permisos entre roles disjuntos.
 */
process.env['MERDN_MUNICIPAL_VIEWER_SECRET'] =
  'credencial-ficticia-de-pruebas-alcaldia-0001';
process.env['MERDN_MUNICIPAL_VIEWER_CODE'] = 'municipal-viewer-pruebas';
process.env['MERDN_HOSPITAL_PATIENT_VIEWER_SECRET'] =
  'credencial-ficticia-de-pruebas-hospital-0002';
process.env['MERDN_HOSPITAL_PATIENT_VIEWER_CODE'] = 'hospital-patient-viewer-pruebas';

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
  DEPARTMENT_CODE,
  MUNICIPALITY_CODE,
  OTHER_DEPARTMENT_CODE,
  OTHER_MUNICIPALITY_CODE,
  cleanupTestData,
  crearSesionInscripcionHistorica,
  ensureLocalUnit,
  ensureOtherTenant,
  territorialUnitId,
} from './enrollment-fixtures';
import {
  CAMPOS_PROHIBIDOS,
  CODIGO_IDENTIDAD_HOSPITAL,
  CREDENCIAL_HOSPITAL_FICTICIA,
  VALORES_PROHIBIDOS,
  cookieDe,
  crearPacienteHospital,
  nacimientoParaEdad,
} from './hospital-fixtures';
import { limpiarIdentidadesInstitucionales } from './municipality-fixtures';

/**
 * Superficie Hospital de Pacientes, de extremo a extremo
 * (TASK-HOSPITAL-CORE-01 §12.2).
 *
 * Este archivo cubre autorización, lectura, aislamiento entre instituciones,
 * analítica y auditoría. El ESTABLECIMIENTO de sesión —compatibilidad municipal,
 * selección de identidad e indistinguibilidad de los fallos— vive en
 * `hospital-institutional-auth.api.test.ts`, en un archivo aparte porque el
 * control de abuso del inicio de sesión cuenta intentos por proceso y ambos
 * conjuntos juntos lo agotarían.
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
const CURRENT_PATH = '/api/v1/institutional/sessions/current';
const LIST_PATH = '/api/v1/hospital/patients';
const ANALYTICS_PATH = '/api/v1/hospital/patients/analytics';
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
 * en `runtime-fail-closed.db.test.ts` y en `core-01-hardening.db.test.ts`.
 */
const rolRuntimeAplicado =
  availability.engine === 'postgresql-server' &&
  process.env['RUNTIME_DATABASE_URL'] !== undefined;

if (puedeEjecutarse && !rolRuntimeAplicado) {
  process.env['MERDN_RUNTIME_ROLE'] = 'disabled';
  // eslint-disable-next-line no-console
  console.warn(
    '\nAVISO: las pruebas hospitalarias de API se ejecutan con MERDN_RUNTIME_ROLE=disabled ' +
      'porque el motor conectado no sostiene Row Level Security bajo el rol runtime. ' +
      'El aislamiento por base de datos NO queda verificado en esta ejecución; los ' +
      'filtros explícitos por tenant de la aplicación SÍ.\n',
  );
}

describe.skipIf(!puedeEjecutarse)('API Hospital · Pacientes', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let tenantId: string;
  let otroTenantId: string;
  let departmentId: string;
  let municipalityId: string;
  let otherDepartmentId: string;
  let otherMunicipalityId: string;
  let barrioId: string;
  let cookieHospital: string;
  let cookieMunicipal: string;

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
    otroTenantId = await ensureOtherTenant(prisma);
    departmentId = await territorialUnitId(prisma, 'DEPARTMENT', DEPARTMENT_CODE);
    municipalityId = await territorialUnitId(prisma, 'MUNICIPALITY', MUNICIPALITY_CODE);
    otherDepartmentId = await territorialUnitId(
      prisma,
      'DEPARTMENT',
      OTHER_DEPARTMENT_CODE,
    );
    otherMunicipalityId = await territorialUnitId(
      prisma,
      'MUNICIPALITY',
      OTHER_MUNICIPALITY_CODE,
    );

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new MalformedJsonFilter());
    await app.init();

    cookieHospital = await abrirSesionHospital();
    cookieMunicipal = await abrirSesionMunicipal();
  });

  beforeEach(async () => {
    await cleanupTestData(prisma);
    barrioId = await ensureLocalUnit(prisma, tenantId, municipalityId, 'Barrio Ficticio');
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

  /** Abre una sesión HOSPITALARIA y devuelve el valor de su cookie. */
  async function abrirSesionHospital(): Promise<string> {
    const respuesta = await request(app.getHttpServer())
      .post(SESSIONS_PATH)
      .set('Origin', ORIGEN_WEB_AUTORIZADO)
      .send({
        accessSecret: CREDENCIAL_HOSPITAL_FICTICIA,
        identityCode: CODIGO_IDENTIDAD_HOSPITAL,
      })
      .expect(201);

    const cookie = cookieDe(respuesta.headers['set-cookie']);

    if (cookie === null) {
      throw new Error('La respuesta no entregó la cookie institucional.');
    }

    return cookie;
  }

  /**
   * Abre una sesión MUNICIPAL sin enviar `identityCode`.
   *
   * Es exactamente la llamada del cliente Alcaldía ya existente. Que siga
   * funcionando se comprueba a fondo en `hospital-institutional-auth.api.test.ts`;
   * aquí sirve para ejercitar la matriz de permisos entre roles disjuntos.
   */
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

  /** Petición GET autenticada como Hospital. */
  function comoHospital(path: string): request.Test {
    return request(app.getHttpServer())
      .get(path)
      .set('Cookie', `${INSTITUTIONAL_COOKIE}=${cookieHospital}`);
  }

  /** Corte de referencia para construir edades deterministas. */
  const CORTE = new Date();

  /** Crea un conjunto sintético estable en el tenant activo. */
  async function poblarConjunto(): Promise<{
    readonly mayorDiscapacidad: string;
    readonly joven: string;
  }> {
    const mayorDiscapacidad = await crearPacienteHospital(prisma, {
      tenantId,
      givenNames: 'Ana María',
      familyNames: 'Ejemplo Ficticio',
      birthDate: nacimientoParaEdad(76, CORTE),
      disabilityDeclared: true,
      territorio: {
        departmentUnitId: departmentId,
        municipalityUnitId: municipalityId,
        areaType: 'URBAN',
        localUnitId: barrioId,
      },
    });

    const joven = await crearPacienteHospital(prisma, {
      tenantId,
      givenNames: 'Bruno',
      familyNames: 'Prueba Ficticia',
      birthDate: nacimientoParaEdad(30, CORTE),
      epsCode: 'SANITAS',
      epsNameControlled: 'Sanitas',
      homeCareRequiredDeclared: true,
      territorio: {
        departmentUnitId: departmentId,
        municipalityUnitId: municipalityId,
        areaType: 'RURAL',
        localUnitId: null,
      },
    });

    // Tercera persona sin territorio: comprueba que no se le inventa municipio.
    await crearPacienteHospital(prisma, {
      tenantId,
      givenNames: 'Carmen',
      familyNames: 'Tercera Ficticia',
      birthDate: nacimientoParaEdad(65, CORTE),
    });

    return {
      mayorDiscapacidad: mayorDiscapacidad.patientId,
      joven: joven.patientId,
    };
  }

  /* ====================================================================== */
  /* Matriz de autorización                                                  */
  /* ====================================================================== */

  describe('matriz 401/403', () => {
    const RUTAS = [LIST_PATH, ANALYTICS_PATH];

    it('sin cookie devuelve 401 y ningún dato', async () => {
      for (const ruta of RUTAS) {
        const respuesta = await request(app.getHttpServer()).get(ruta).expect(401);

        expect(respuesta.body.code).toBe('INSTITUTIONAL_SESSION_REQUIRED');
        expect(respuesta.body).not.toHaveProperty('items');
        expect(respuesta.body).not.toHaveProperty('keyFigures');
      }
    });

    it('una sesión MUNICIPAL recibe 403 en Hospital', async () => {
      for (const ruta of RUTAS) {
        const respuesta = await request(app.getHttpServer())
          .get(ruta)
          .set('Cookie', `${INSTITUTIONAL_COOKIE}=${cookieMunicipal}`)
          .expect(403);

        expect(respuesta.body.code).toBe('INSTITUTIONAL_ROLE_REQUIRED');
        expect(respuesta.body).not.toHaveProperty('items');
      }
    });

    it('una sesión HOSPITALARIA recibe 403 en Municipality', async () => {
      const respuesta = await request(app.getHttpServer())
        .get(POPULATION_PATH)
        .set('Cookie', `${INSTITUTIONAL_COOKIE}=${cookieHospital}`)
        .expect(403);

      expect(respuesta.body.code).toBe('INSTITUTIONAL_ROLE_REQUIRED');
      expect(respuesta.body).not.toHaveProperty('uniqueRegistered');
    });

    it('la cookie de paciente recibe 401 en Hospital', async () => {
      const patient = await crearPacienteHospital(prisma, {
        tenantId,
        givenNames: 'Paciente',
        familyNames: 'Sesión Histórica Ficticia',
        birthDate: new Date(Date.UTC(1978, 0, 15)),
      });
      const tokenPaciente = await crearSesionInscripcionHistorica(
        prisma,
        tenantId,
        patient.patientId,
      );

      await request(app.getHttpServer())
        .get(LIST_PATH)
        .set('Cookie', `${PATIENT_COOKIE}=${tokenPaciente}`)
        .expect(401);

      // Y a la inversa: la sesión hospitalaria no abre el registro individual.
      await request(app.getHttpServer())
        .get('/api/v1/patients/me')
        .set('Cookie', `${INSTITUTIONAL_COOKIE}=${cookieHospital}`)
        .expect(401);
    });

    it('un token manipulado recibe 401', async () => {
      const manipulado = `${cookieHospital.slice(0, -1)}${
        cookieHospital.endsWith('a') ? 'b' : 'a'
      }`;

      await request(app.getHttpServer())
        .get(LIST_PATH)
        .set('Cookie', `${INSTITUTIONAL_COOKIE}=${manipulado}`)
        .expect(401);
    });

    it('una sesión expirada, revocada o con identidad deshabilitada recibe 401', async () => {
      const cookie = await abrirSesionHospital();
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
      const otra = await abrirSesionHospital();

      await prisma.institutionalIdentity.updateMany({
        where: { tenantId, code: CODIGO_IDENTIDAD_HOSPITAL },
        data: { status: 'DISABLED' },
      });

      await request(app.getHttpServer())
        .get(LIST_PATH)
        .set('Cookie', `${INSTITUTIONAL_COOKIE}=${otra}`)
        .expect(401);

      await prisma.institutionalIdentity.updateMany({
        where: { tenantId, code: CODIGO_IDENTIDAD_HOSPITAL },
        data: { status: 'ACTIVE' },
      });
    });
  });

  /* ====================================================================== */
  /* Contexto de sesión                                                      */
  /* ====================================================================== */

  describe('contexto de sesión', () => {
    it('devuelve el nombre real del tenant, el rol y un actor impersonal', async () => {
      const respuesta = await request(app.getHttpServer())
        .get(CURRENT_PATH)
        .set('Cookie', `${INSTITUTIONAL_COOKIE}=${cookieHospital}`)
        .expect(200);

      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { name: true },
      });

      expect(respuesta.body).toStrictEqual({
        role: 'HOSPITAL_PATIENT_VIEWER',
        expiresAt: expect.any(String),
        institution: { name: tenant?.name },
        actorDisplay: 'Acceso institucional',
      });
    });

    it('no devuelve tenantId, identidad ni ninguna persona demostrativa', async () => {
      const respuesta = await request(app.getHttpServer())
        .get(CURRENT_PATH)
        .set('Cookie', `${INSTITUTIONAL_COOKIE}=${cookieHospital}`)
        .expect(200);

      const serializado = JSON.stringify(respuesta.body);

      for (const prohibido of [
        tenantId,
        'tenantId',
        'identityId',
        CODIGO_IDENTIDAD_HOSPITAL,
        'Claudia Vargas',
        'Hospital San Rafael',
        'ESE',
        'Soacha',
      ]) {
        expect(serializado).not.toContain(prohibido);
      }
    });

    it('admite ambos roles pero NO concede acceso a ninguna superficie', async () => {
      // Una sesión municipal también obtiene su contexto...
      const municipal = await request(app.getHttpServer())
        .get(CURRENT_PATH)
        .set('Cookie', `${INSTITUTIONAL_COOKIE}=${cookieMunicipal}`)
        .expect(200);

      expect(municipal.body.role).toBe('MUNICIPAL_VIEWER');

      // ...pero sigue sin poder leer Hospital.
      await request(app.getHttpServer())
        .get(LIST_PATH)
        .set('Cookie', `${INSTITUTIONAL_COOKIE}=${cookieMunicipal}`)
        .expect(403);
    });

    it('sin sesión devuelve 401 uniforme', async () => {
      const respuesta = await request(app.getHttpServer()).get(CURRENT_PATH).expect(401);

      expect(respuesta.body.code).toBe('INSTITUTIONAL_SESSION_REQUIRED');
    });

    it('no queda en ninguna caché compartida', async () => {
      const respuesta = await request(app.getHttpServer())
        .get(CURRENT_PATH)
        .set('Cookie', `${INSTITUTIONAL_COOKIE}=${cookieHospital}`)
        .expect(200);

      expect(respuesta.headers['cache-control']).toBe('private, no-store');
      expect(respuesta.headers['pragma']).toBe('no-cache');
      expect(respuesta.headers['vary']).toBe('Cookie');
    });
  });

  /* ====================================================================== */
  /* Listado                                                                 */
  /* ====================================================================== */

  describe('listado', () => {
    it('devuelve procedencia real, paginación y solo los campos autorizados', async () => {
      await poblarConjunto();

      const respuesta = await comoHospital(LIST_PATH).expect(200);

      expect(respuesta.headers['cache-control']).toBe('private, no-store');
      expect(respuesta.headers['pragma']).toBe('no-cache');
      expect(respuesta.headers['vary']).toBe('Cookie');
      expect(respuesta.body.source).toBe('ELOISA_POSTGRESQL');
      expect(respuesta.body.asOfDate).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
      expect(respuesta.body.page).toBe(1);
      expect(respuesta.body.pageSize).toBe(50);
      expect(respuesta.body.totalItems).toBe(3);
      expect(respuesta.body.totalPages).toBe(1);
      expect(respuesta.body.items).toHaveLength(3);

      const item = respuesta.body.items[0];

      expect(Object.keys(item).sort()).toStrictEqual([
        'age',
        'documentMasked',
        'epsCode',
        'epsName',
        'fullName',
        'initials',
        'patientId',
        'priorities',
        'status',
        'statusLabel',
        'territory',
      ]);
    });

    it('no filtra NUNCA contacto, dirección, documento completo ni persona', async () => {
      const { mayorDiscapacidad } = await poblarConjunto();
      const persona = await prisma.patient.findUnique({
        where: { id: mayorDiscapacidad },
        select: { personId: true, person: { select: { documentNumberNormalized: true } } },
      });

      const respuesta = await comoHospital(LIST_PATH).expect(200);
      const serializado = JSON.stringify(respuesta.body);

      for (const prohibido of [...CAMPOS_PROHIBIDOS, ...VALORES_PROHIBIDOS]) {
        expect(serializado).not.toContain(prohibido);
      }

      expect(serializado).not.toContain(persona?.personId ?? 'personId-ausente');
      expect(serializado).not.toContain(
        persona?.person.documentNumberNormalized ?? 'documento-ausente',
      );
      // El documento sí aparece enmascarado.
      expect(serializado).toContain('···');
    });

    it('deriva la edad de la fecha de nacimiento, no de una pertenencia', async () => {
      await poblarConjunto();

      const respuesta = await comoHospital(LIST_PATH).expect(200);
      const ana = respuesta.body.items.find(
        (item: { readonly fullName: string }) => item.fullName === 'Ana María Ejemplo Ficticio',
      );

      expect(ana.age).toBe(76);
      expect(ana.priorities.older60).toBe(true);
      // No se persistió `OLDER_ADULT_60_PLUS` en ninguna fixture.
      await expect(
        prisma.patientPopulationMembership.count({
          where: { tenantId, populationType: 'OLDER_ADULT_60_PLUS' },
        }),
      ).resolves.toBe(0);
    });

    it('aplica los filtros con AND y devuelve exactamente el conjunto esperado', async () => {
      await poblarConjunto();

      const mayores = await comoHospital(`${LIST_PATH}?older60=true`).expect(200);
      expect(mayores.body.totalItems).toBe(2);

      const discapacidad = await comoHospital(
        `${LIST_PATH}?populationType=DISABILITY`,
      ).expect(200);
      expect(discapacidad.body.totalItems).toBe(1);

      // AND: 60+ Y discapacidad.
      const combinado = await comoHospital(
        `${LIST_PATH}?older60=true&populationType=DISABILITY`,
      ).expect(200);
      expect(combinado.body.totalItems).toBe(1);

      // AND que no puede satisfacerse.
      const vacio = await comoHospital(
        `${LIST_PATH}?older60=false&populationType=DISABILITY`,
      ).expect(200);
      expect(vacio.body.totalItems).toBe(0);
      expect(vacio.body.items).toStrictEqual([]);

      const porEps = await comoHospital(`${LIST_PATH}?epsCode=SANITAS`).expect(200);
      expect(porEps.body.totalItems).toBe(1);

      const rural = await comoHospital(`${LIST_PATH}?areaType=RURAL`).expect(200);
      expect(rural.body.totalItems).toBe(1);

      const municipio = await comoHospital(
        `${LIST_PATH}?municipalityOfficialCode=${MUNICIPALITY_CODE}`,
      ).expect(200);
      // La tercera persona no tiene dirección: no se le atribuye territorio.
      expect(municipio.body.totalItems).toBe(2);

      const rango = await comoHospital(`${LIST_PATH}?ageMin=60&ageMax=70`).expect(200);
      expect(rango.body.totalItems).toBe(1);
    });

    it('la búsqueda normalizada encuentra por nombre y por documento', async () => {
      const { mayorDiscapacidad } = await poblarConjunto();
      const persona = await prisma.patient.findUnique({
        where: { id: mayorDiscapacidad },
        select: { person: { select: { documentNumberNormalized: true } } },
      });
      const documento = persona?.person.documentNumberNormalized ?? '';

      const porNombre = await comoHospital(`${LIST_PATH}?search=ana%20ejemplo`).expect(200);
      expect(porNombre.body.totalItems).toBe(1);

      const porApellido = await comoHospital(`${LIST_PATH}?search=FICTICIA`).expect(200);
      expect(porApellido.body.totalItems).toBe(2);

      const porDocumento = await comoHospital(`${LIST_PATH}?search=${documento}`).expect(200);
      expect(porDocumento.body.totalItems).toBe(1);
      // Buscar por documento NO lo revela: sigue enmascarado.
      expect(JSON.stringify(porDocumento.body)).not.toContain(documento);

      const sinResultados = await comoHospital(`${LIST_PATH}?search=zzz-no-existe`).expect(200);
      expect(sinResultados.body.totalItems).toBe(0);
    });

    it('ordena de forma determinista y pagina sin duplicados ni omisiones', async () => {
      /*
       * Treinta personas con el MISMO apellido y la MISMA edad: fuerza el
       * desempate del orden. Sin un criterio de desempate total, PostgreSQL no
       * garantiza un orden estable ante empates y una misma persona podría
       * aparecer dos veces —o desaparecer— al pasar de página.
       */
      for (let indice = 0; indice < 30; indice += 1) {
        await crearPacienteHospital(prisma, {
          tenantId,
          givenNames: `Persona${String(indice).padStart(2, '0')}`,
          familyNames: 'Apellido Repetido Ficticio',
          birthDate: nacimientoParaEdad(40, CORTE),
        });
      }

      const vistos = new Set<string>();
      let total = 0;

      for (const pagina of [1, 2]) {
        const respuesta = await comoHospital(
          `${LIST_PATH}?pageSize=25&page=${String(pagina)}&sort=name&direction=asc`,
        ).expect(200);

        total = respuesta.body.totalItems;

        for (const item of respuesta.body.items as { readonly patientId: string }[]) {
          expect(vistos.has(item.patientId)).toBe(false);
          vistos.add(item.patientId);
        }
      }

      expect(total).toBe(30);
      expect(vistos.size).toBe(30);
    });

    it('corrige de forma determinista una página fuera de rango', async () => {
      await poblarConjunto();

      const respuesta = await comoHospital(`${LIST_PATH}?page=9999`).expect(200);

      expect(respuesta.body.page).toBe(1);
      expect(respuesta.body.items).toHaveLength(3);
    });

    it('ordena por edad de forma coherente con la fecha de nacimiento', async () => {
      await poblarConjunto();

      const asc = await comoHospital(`${LIST_PATH}?sort=age&direction=asc`).expect(200);
      const edades = (asc.body.items as { readonly age: number }[]).map((item) => item.age);

      expect(edades).toStrictEqual([...edades].sort((a, b) => a - b));

      const desc = await comoHospital(`${LIST_PATH}?sort=age&direction=desc`).expect(200);
      const descendentes = (desc.body.items as { readonly age: number }[]).map(
        (item) => item.age,
      );

      expect(descendentes).toStrictEqual([...descendentes].sort((a, b) => b - a));
    });

    it('rechaza parámetros desconocidos, repetidos y fuera de rango', async () => {
      for (const consulta of [
        'tenantId=otro',
        'personId=abc',
        'select=phone',
        'page=1&page=2',
        'pageSize=10000',
        'ageMin=200',
        'ageMin=80&ageMax=20',
        'sort=proxima',
        'epsCode=EPS_INVENTADA',
        'municipalityOfficialCode=MEDELLIN',
        'older60=1',
      ]) {
        const respuesta = await comoHospital(`${LIST_PATH}?${consulta}`).expect(400);

        expect(respuesta.body.code).toBe('HOSPITAL_PATIENTS_INVALID_QUERY');
        expect(respuesta.body).not.toHaveProperty('items');
      }
    });

    it('el error de consulta no devuelve SQL, esquema ni el valor recibido', async () => {
      const respuesta = await comoHospital(`${LIST_PATH}?epsCode=EPS_SECRETA`).expect(400);
      const serializado = JSON.stringify(respuesta.body);

      expect(serializado).not.toContain('EPS_SECRETA');
      expect(serializado).not.toContain('SELECT');
      expect(serializado).not.toContain('prisma');
      expect(serializado).not.toContain('stack');
    });
  });

  /* ====================================================================== */
  /* Detalle                                                                 */
  /* ====================================================================== */

  describe('detalle', () => {
    it('devuelve los campos autorizados y declara el contacto no disponible', async () => {
      const { mayorDiscapacidad } = await poblarConjunto();

      const respuesta = await comoHospital(`${LIST_PATH}/${mayorDiscapacidad}`).expect(200);

      expect(respuesta.body.patientId).toBe(mayorDiscapacidad);
      expect(respuesta.body.fullName).toBe('Ana María Ejemplo Ficticio');
      expect(respuesta.body.contactAvailability).toBe('No disponible con el permiso actual');
      expect(respuesta.body.documentMasked).toContain('···');
      expect(respuesta.body.territory.localUnitName).toBe('Barrio Ficticio');
      expect(respuesta.body.territory.pendingNormalization).toBe(false);
    });

    it('no devuelve texto territorial libre en un registro pendiente', async () => {
      const { joven } = await poblarConjunto();

      const respuesta = await comoHospital(`${LIST_PATH}/${joven}`).expect(200);

      expect(respuesta.body.territory.pendingNormalization).toBe(true);
      expect(respuesta.body.territory.localUnitName).toBeNull();
      expect(JSON.stringify(respuesta.body)).not.toContain('Localidad Ficticia');
    });

    it('no devuelve contacto, dirección, documento completo ni persona', async () => {
      const { mayorDiscapacidad } = await poblarConjunto();
      const persona = await prisma.patient.findUnique({
        where: { id: mayorDiscapacidad },
        select: { personId: true, person: { select: { documentNumberNormalized: true } } },
      });

      const respuesta = await comoHospital(`${LIST_PATH}/${mayorDiscapacidad}`).expect(200);
      const serializado = JSON.stringify(respuesta.body);

      for (const prohibido of [...CAMPOS_PROHIBIDOS, ...VALORES_PROHIBIDOS]) {
        expect(serializado).not.toContain(prohibido);
      }

      expect(serializado).not.toContain(persona?.personId ?? 'ausente');
      expect(serializado).not.toContain(
        persona?.person.documentNumberNormalized ?? 'ausente',
      );
    });

    it('un identificador mal formado devuelve 400', async () => {
      await comoHospital(`${LIST_PATH}/no-es-un-uuid`).expect(400);
    });

    it('un identificador inexistente devuelve 404 uniforme', async () => {
      const respuesta = await comoHospital(
        `${LIST_PATH}/00000000-0000-4000-8000-000000000000`,
      ).expect(404);

      expect(respuesta.body.code).toBe('HOSPITAL_PATIENT_NOT_FOUND');
    });

    it('la ruta estática `analytics` no colisiona con el detalle', async () => {
      await poblarConjunto();

      // Si `analytics` se interpretara como identificador, esto sería 400.
      const respuesta = await comoHospital(ANALYTICS_PATH).expect(200);

      expect(respuesta.body.definitionVersion).toBe('population-v1');
    });
  });

  /* ====================================================================== */
  /* Aislamiento entre instituciones                                         */
  /* ====================================================================== */

  describe('aislamiento entre tenants', () => {
    it('un paciente de otro tenant no aparece y su detalle da 404 uniforme', async () => {
      await poblarConjunto();

      const ajeno = await crearPacienteHospital(prisma, {
        tenantId: otroTenantId,
        givenNames: 'Persona',
        familyNames: 'De Otra Institucion Ficticia',
        birthDate: nacimientoParaEdad(70, CORTE),
        territorio: {
          departmentUnitId: otherDepartmentId,
          municipalityUnitId: otherMunicipalityId,
        },
      });

      const listado = await comoHospital(LIST_PATH).expect(200);

      expect(listado.body.totalItems).toBe(3);
      expect(JSON.stringify(listado.body)).not.toContain('De Otra Institucion Ficticia');
      expect(JSON.stringify(listado.body)).not.toContain(ajeno.patientId);

      // El detalle de un identificador REAL de otro tenant da 404, no 403: la
      // respuesta jamás confirma que el registro exista en otra institución.
      const detalle = await comoHospital(`${LIST_PATH}/${ajeno.patientId}`).expect(404);

      expect(detalle.body.code).toBe('HOSPITAL_PATIENT_NOT_FOUND');

      // Indistinguible de un identificador que no existe en ninguna parte.
      const inexistente = await comoHospital(
        `${LIST_PATH}/00000000-0000-4000-8000-000000000000`,
      ).expect(404);

      expect(detalle.body).toStrictEqual(inexistente.body);
    });

    it('la búsqueda y la analítica tampoco cruzan el tenant', async () => {
      await poblarConjunto();
      await crearPacienteHospital(prisma, {
        tenantId: otroTenantId,
        givenNames: 'Ana María',
        familyNames: 'De Otra Institucion Ficticia',
        birthDate: nacimientoParaEdad(76, CORTE),
      });

      const busqueda = await comoHospital(`${LIST_PATH}?search=Ana`).expect(200);

      expect(busqueda.body.totalItems).toBe(1);

      const analitica = await comoHospital(ANALYTICS_PATH).expect(200);

      expect(analitica.body.activeUniverse).toBe(3);
      expect(analitica.body.filteredUniverse).toBe(3);
    });
  });

  /* ====================================================================== */
  /* Analítica                                                               */
  /* ====================================================================== */

  describe('analítica', () => {
    it('reconcilia el universo con las ocho intersecciones y las distribuciones', async () => {
      await poblarConjunto();

      const respuesta = await comoHospital(ANALYTICS_PATH).expect(200);
      const universo = respuesta.body.filteredUniverse;

      expect(universo).toBe(3);
      expect(respuesta.body.intersections).toHaveLength(8);

      const suma = (respuesta.body.intersections as { readonly value: number }[]).reduce(
        (total, celda) => total + celda.value,
        0,
      );

      expect(suma).toBe(universo);

      for (const distribucion of respuesta.body.distributions as {
        readonly cells: { readonly value: number }[];
      }[]) {
        const sumaDistribucion = distribucion.cells.reduce(
          (total, celda) => total + celda.value,
          0,
        );

        expect(sumaDistribucion).toBe(universo);
      }
    });

    it('reconcilia con el listado para el MISMO conjunto filtrado', async () => {
      await poblarConjunto();

      for (const filtro of ['', '?older60=true', '?areaType=RURAL', '?epsCode=SANITAS']) {
        const listado = await comoHospital(`${LIST_PATH}${filtro}`).expect(200);
        const analitica = await comoHospital(`${ANALYTICS_PATH}${filtro}`).expect(200);

        expect(analitica.body.filteredUniverse).toBe(listado.body.totalItems);
      }
    });

    it('un denominador cero produce percentage nulo, jamás un cero', async () => {
      // Sin ninguna persona en el conjunto filtrado.
      const respuesta = await comoHospital(`${ANALYTICS_PATH}?search=zzz-no-existe`).expect(
        200,
      );

      expect(respuesta.body.filteredUniverse).toBe(0);

      for (const celda of respuesta.body.keyFigures as {
        readonly value: number;
        readonly percentage: number | null;
      }[]) {
        expect(celda.value).toBe(0);
        expect(celda.percentage).toBeNull();
      }
    });

    it('no devuelve cifras de dominios ausentes de CORE-01', async () => {
      await poblarConjunto();

      const respuesta = await comoHospital(ANALYTICS_PATH).expect(200);
      const serializado = JSON.stringify(respuesta.body).toLowerCase();

      for (const ausente of [
        'cuidador',
        'caregiver',
        'profesional',
        'patolog',
        'programa',
        'atencion',
        'semaforo',
        'alerta',
      ]) {
        expect(serializado).not.toContain(ausente);
      }
    });

    it('rechaza paginación y orden', async () => {
      for (const consulta of ['page=1', 'pageSize=25', 'sort=name', 'direction=asc']) {
        await comoHospital(`${ANALYTICS_PATH}?${consulta}`).expect(400);
      }
    });
  });

  /* ====================================================================== */
  /* Auditoría                                                               */
  /* ====================================================================== */

  describe('auditoría', () => {
    it('registra el acceso al listado con actor opaco, rol y sin recurso', async () => {
      await poblarConjunto();

      const antes = await prisma.auditEvent.count({
        where: { tenantId, eventType: 'HOSPITAL_PATIENT_LIST_ACCESS_GRANTED' },
      });

      await comoHospital(`${LIST_PATH}?search=Ana&older60=true`).expect(200);

      const eventos = await prisma.auditEvent.findMany({
        where: { tenantId, eventType: 'HOSPITAL_PATIENT_LIST_ACCESS_GRANTED' },
        orderBy: { occurredAt: 'desc' },
        take: 1,
      });

      expect(
        await prisma.auditEvent.count({
          where: { tenantId, eventType: 'HOSPITAL_PATIENT_LIST_ACCESS_GRANTED' },
        }),
      ).toBe(antes + 1);

      const evento = eventos[0]!;

      expect(evento.actorType).toBe('INSTITUTIONAL_IDENTITY');
      expect(evento.actorRole).toBe('HOSPITAL_PATIENT_VIEWER');
      expect(evento.outcome).toBe('SUCCESS');
      expect(evento.resourceType).toBe('HospitalPatientList');
      expect(evento.resourceId).toBeNull();
      expect(evento.endpoint).toBe(`GET ${LIST_PATH}`);

      // Ni la búsqueda, ni los filtros, ni el conteo, ni el token.
      const serializado = JSON.stringify(evento);

      expect(serializado).not.toContain('Ana');
      expect(serializado).not.toContain('older60');
      expect(serializado).not.toContain(cookieHospital);
      expect(serializado).not.toContain(CREDENCIAL_HOSPITAL_FICTICIA);
    });

    it('el detalle registra el patientId OPACO y nunca el personId', async () => {
      const { mayorDiscapacidad } = await poblarConjunto();
      const persona = await prisma.patient.findUnique({
        where: { id: mayorDiscapacidad },
        select: { personId: true },
      });

      await comoHospital(`${LIST_PATH}/${mayorDiscapacidad}`).expect(200);

      const evento = (
        await prisma.auditEvent.findMany({
          where: { tenantId, eventType: 'HOSPITAL_PATIENT_DETAIL_ACCESS_GRANTED' },
          orderBy: { occurredAt: 'desc' },
          take: 1,
        })
      )[0]!;

      expect(evento.resourceType).toBe('HospitalPatientDetail');
      expect(evento.resourceId).toBe(mayorDiscapacidad);
      expect(evento.resourceId).not.toBe(persona?.personId);
      expect(evento.endpoint).toBe(`GET ${LIST_PATH}/:patientId`);
      expect(JSON.stringify(evento)).not.toContain('Ana María');
    });

    it('la analítica registra su propio evento diferenciado', async () => {
      await poblarConjunto();
      await comoHospital(ANALYTICS_PATH).expect(200);

      const evento = (
        await prisma.auditEvent.findMany({
          where: { tenantId, eventType: 'HOSPITAL_PATIENT_ANALYTICS_ACCESS_GRANTED' },
          orderBy: { occurredAt: 'desc' },
          take: 1,
        })
      )[0]!;

      expect(evento.resourceType).toBe('HospitalPatientAnalytics');
      expect(evento.resourceId).toBeNull();
    });

    it('registra la denegación sin recurso y sin causa detallada', async () => {
      const antes = await prisma.auditEvent.count({
        where: { tenantId, eventType: 'HOSPITAL_PATIENT_ACCESS_DENIED' },
      });

      // Sin sesión: actor desconocido.
      await request(app.getHttpServer()).get(LIST_PATH).expect(401);

      // Con sesión municipal: actor conocido, rol conocido, permiso ausente.
      await request(app.getHttpServer())
        .get(LIST_PATH)
        .set('Cookie', `${INSTITUTIONAL_COOKIE}=${cookieMunicipal}`)
        .expect(403);

      const eventos = await prisma.auditEvent.findMany({
        where: { tenantId, eventType: 'HOSPITAL_PATIENT_ACCESS_DENIED' },
        orderBy: { occurredAt: 'desc' },
        take: 2,
      });

      expect(
        await prisma.auditEvent.count({
          where: { tenantId, eventType: 'HOSPITAL_PATIENT_ACCESS_DENIED' },
        }),
      ).toBe(antes + 2);

      for (const evento of eventos) {
        expect(evento.outcome).toBe('DENIED');
        expect(evento.resourceId).toBeNull();
      }

      const conRol = eventos.find((evento) => evento.actorRole === 'MUNICIPAL_VIEWER');
      const sinActor = eventos.find((evento) => evento.actorType === 'UNAUTHENTICATED');

      expect(conRol).toBeDefined();
      expect(sinActor?.actorUserId).toBeNull();
      expect(sinActor?.actorRole).toBeNull();
    });

    it('la denegación del detalle no revela el identificador intentado', async () => {
      const ajeno = '11111111-1111-4111-8111-111111111111';

      await request(app.getHttpServer())
        .get(`${LIST_PATH}/${ajeno}`)
        .set('Cookie', `${INSTITUTIONAL_COOKIE}=${cookieMunicipal}`)
        .expect(403);

      const evento = (
        await prisma.auditEvent.findMany({
          where: { tenantId, eventType: 'HOSPITAL_PATIENT_ACCESS_DENIED' },
          orderBy: { occurredAt: 'desc' },
          take: 1,
        })
      )[0]!;

      expect(evento.endpoint).toBe(`GET ${LIST_PATH}/:patientId`);
      expect(JSON.stringify(evento)).not.toContain(ajeno);
    });

    it('la auditoría es append-only: no puede modificarse ni borrarse', async () => {
      await poblarConjunto();
      await comoHospital(LIST_PATH).expect(200);

      const evento = (
        await prisma.auditEvent.findMany({
          where: { tenantId, eventType: 'HOSPITAL_PATIENT_LIST_ACCESS_GRANTED' },
          orderBy: { occurredAt: 'desc' },
          take: 1,
        })
      )[0]!;

      await expect(
        prisma.auditEvent.update({
          where: { id: evento.id },
          data: { outcome: 'DENIED' },
        }),
      ).rejects.toThrow();

      await expect(
        prisma.auditEvent.delete({ where: { id: evento.id } }),
      ).rejects.toThrow();
    });
  });
});
