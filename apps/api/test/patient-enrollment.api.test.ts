import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, inject, it } from 'vitest';

import { AppModule } from '../src/app.module';
import { type PrismaClient } from '../src/generated/prisma/client';
import { MalformedJsonFilter } from '../src/patients/malformed-json.filter';
import {
  generateSessionToken,
  hashSessionToken,
} from '../src/enrollment-sessions/enrollment-session.tokens';

import { createTestPrismaClient, unavailableBanner } from './database-availability';
import {
  DEPARTMENT_CODE,
  MUNICIPALITY_CODE,
  cleanupTestData,
  enrollmentBody,
  ensureOtherTenant,
  nextTestDocument,
  sessionTokenFromSetCookie,
  territorialUnitId,
} from './enrollment-fixtures';

/**
 * Pruebas de extremo a extremo de la API de inscripción
 * (TASK-MVP-CORE-01 §12, sección «API/e2e»).
 *
 * Ejercitan la aplicación NestJS completa contra PostgreSQL real. Si la base no
 * está disponible, la suite se marca como NO EJECUTADA con un motivo visible:
 * no se sustituye por dobles de prueba.
 */

const COOKIE_NAME = 'merdn_enrollment_session';

const availability = inject('databaseAvailability');
const puedeEjecutarse = availability.available && availability.migrated;

if (!puedeEjecutarse) {
  // eslint-disable-next-line no-console
  console.warn(`\n${unavailableBanner(availability)}\n`);
}

/*
 * El motor de desarrollo WebAssembly aborta el proceso al escribir bajo un rol
 * no propietario con RLS y claves foráneas compuestas (comprobado y reportado).
 * Para poder ejercitar el resto del contrato de la API en ese motor, la
 * aplicación se arranca con el rol runtime desactivado y se deja constancia.
 *
 * Las garantías de RLS NO se dan por verificadas aquí: se comprueban en
 * `core-01-hardening.db.test.ts`, que exige un servidor PostgreSQL real.
 */
const rolRuntimeAplicado =
  availability.engine === 'postgresql-server' &&
  process.env['RUNTIME_DATABASE_URL'] !== undefined;

if (puedeEjecutarse && !rolRuntimeAplicado) {
  process.env['MERDN_RUNTIME_ROLE'] = 'disabled';
  // eslint-disable-next-line no-console
  console.warn(
    '\nAVISO: las pruebas de API se ejecutan con MERDN_RUNTIME_ROLE=disabled porque ' +
      'el motor conectado no sostiene Row Level Security bajo el rol runtime. ' +
      'El aislamiento por base de datos NO queda verificado en esta ejecución.\n',
  );
}

async function crearAplicacion(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  app.useGlobalFilters(new MalformedJsonFilter());
  await app.init();
  return app;
}

describe.skipIf(!puedeEjecutarse)('API de inscripción de paciente', () => {
  let app: INestApplication;
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = createTestPrismaClient();
    await cleanupTestData(prisma);
    app = await crearAplicacion();
  });

  afterAll(async () => {
    if (app !== undefined) {
      await app.close();
    }
    if (prisma !== undefined) {
      await cleanupTestData(prisma);
      await prisma.$disconnect();
    }
  });

  afterEach(async () => {
    await cleanupTestData(prisma);
  });

  /** Inscribe y devuelve la respuesta junto con el token de sesión emitido. */
  async function inscribir(
    body: Record<string, unknown> = enrollmentBody(),
  ): Promise<{
    readonly status: number;
    readonly body: Record<string, unknown>;
    readonly setCookie: string[];
    readonly token: string | null;
  }> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/patients/enrollments')
      .send(body);

    const raw = response.headers['set-cookie'];
    const setCookie = Array.isArray(raw) ? raw : typeof raw === 'string' ? [raw] : [];

    return {
      status: response.status,
      body: response.body as Record<string, unknown>,
      setCookie,
      token: sessionTokenFromSetCookie(setCookie, COOKIE_NAME),
    };
  }

  /* --------------------------------- 201 --------------------------------- */

  describe('inscripción correcta', () => {
    it('devuelve 201 con la representación mínima del paciente', async () => {
      const resultado = await inscribir();

      expect(resultado.status).toBe(201);
      expect(resultado.body).toMatchObject({
        status: 'ACTIVE',
        givenNames: 'Ana María',
        familyNames: 'Ejemplo Ficticio',
        epsCode: 'NUEVA_EPS',
        epsName: 'Nueva EPS',
      });
      expect(typeof resultado.body['enrolledAt']).toBe('string');
      expect(typeof resultado.body['age']).toBe('number');
    });

    it('no devuelve documento, dirección exacta, teléfono, correo ni token', async () => {
      const documento = nextTestDocument();
      const resultado = await inscribir(
        enrollmentBody({ documentNumber: documento, email: 'ana@correo.ficticio' }),
      );

      const serializado = JSON.stringify(resultado.body);

      expect(serializado).not.toContain(documento);
      expect(serializado).not.toContain('Cra 45');
      expect(serializado).not.toContain('311 220 3355');
      expect(serializado).not.toContain('ana@correo.ficticio');
      expect(serializado).not.toContain('Casa azul');
      expect(serializado).not.toContain(resultado.token ?? '@@nunca@@');
      expect(serializado).not.toContain('tokenHash');
      expect(serializado).not.toContain('patientId');
      expect(serializado).not.toContain('tenantId');
    });

    it('emite una cookie HttpOnly con expiración y SameSite', async () => {
      const resultado = await inscribir();
      const cookie = resultado.setCookie.find((entry) => entry.startsWith(COOKIE_NAME));

      expect(cookie).toBeDefined();
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('Path=/');
      expect(cookie).toContain('SameSite=Lax');
      expect(cookie).toMatch(/Max-Age=\d+/);
      // La cookie no transporta identificadores ni datos personales.
      expect(cookie?.toLowerCase()).not.toContain('ana');
      expect(cookie?.toLowerCase()).not.toContain('9999');
    });

    it('persiste en PostgreSQL todo lo exigido por la transacción', async () => {
      const documento = nextTestDocument();
      await inscribir(enrollmentBody({ documentNumber: documento }));

      // Cada tabla se consulta por separado: la prueba comprueba filas reales,
      // no la capacidad del cliente para componer relaciones anidadas.
      const persona = await prisma.person.findFirst({
        where: { documentNumberNormalized: documento },
        select: { id: true, documentNumber: true, email: true, tenantId: true },
      });

      expect(persona).not.toBeNull();
      expect(persona?.email).toBeNull();
      expect(persona?.documentNumber).toBe(documento);

      const paciente = await prisma.patient.findFirst({
        where: { personId: persona?.id },
        select: {
          id: true,
          origin: true,
          status: true,
          createdByUserId: true,
          tenantId: true,
        },
      });

      expect(paciente?.origin).toBe('PUBLIC_SELF_ENROLLMENT');
      expect(paciente?.status).toBe('ACTIVE');
      expect(paciente?.createdByUserId).toBeNull();
      expect(paciente?.tenantId).toBe(persona?.tenantId);

      const direccion = await prisma.patientAddress.findFirst({
        where: { patientId: paciente?.id },
      });

      expect(direccion?.exactAddress).toBe('Cra 45 # 32-16');
      expect(direccion?.localityPendingNormalization).toBe(true);
      expect(direccion?.localityUnverifiedText).toBe('La Esperanza');
      expect(direccion?.settlementUnverifiedText).toBe('San Cristóbal');
      expect(direccion?.localUnitId).toBeNull();

      const consentimientos = await prisma.consentRecord.findMany({
        where: { patientId: paciente?.id },
      });

      expect(consentimientos).toHaveLength(1);
      expect(consentimientos[0]?.consentVersion).toBe('paciente-tratamiento-datos-v1');
      expect(consentimientos[0]?.consentType).toBe(
        'PERSONAL_AND_HEALTH_DATA_PROCESSING',
      );
      expect(consentimientos[0]?.acceptedAt).toBeInstanceOf(Date);

      expect(
        await prisma.enrollmentSession.count({ where: { patientId: paciente?.id } }),
      ).toBe(1);
      expect(
        await prisma.patientPopulationMembership.count({
          where: { patientId: paciente?.id },
        }),
      ).toBe(1);

      const auditoria = await prisma.auditEvent.findFirst({
        where: { resourceType: 'Patient', resourceId: paciente?.id },
      });
      expect(auditoria?.eventType).toBe('PATIENT_ENROLLMENT_CREATED');
      expect(auditoria?.actorType).toBe('PUBLIC_SELF_ENROLLMENT');
      expect(JSON.stringify(auditoria)).not.toContain(documento);
      expect(JSON.stringify(auditoria)).not.toContain('Cra 45');
    });

    it('almacena únicamente el hash de la sesión emitida', async () => {
      const documento = nextTestDocument();
      const resultado = await inscribir(enrollmentBody({ documentNumber: documento }));

      const sesion = await prisma.enrollmentSession.findFirst({
        where: { patient: { person: { documentNumberNormalized: documento } } },
        select: { tokenHash: true },
      });

      expect(resultado.token).not.toBeNull();
      expect(sesion?.tokenHash).toBe(hashSessionToken(resultado.token!));
      expect(sesion?.tokenHash).not.toBe(resultado.token);
    });

    it('acepta la inscripción sin correo y con correo válido', async () => {
      const sinCorreo = await inscribir(enrollmentBody());
      const conCorreo = await inscribir(
        enrollmentBody({ email: 'Ana.Ejemplo@Correo.Ficticio' }),
      );

      expect(sinCorreo.status).toBe(201);
      expect(conCorreo.status).toBe(201);

      const persona = await prisma.person.findFirst({
        where: { email: { not: null } },
        select: { email: true },
      });
      expect(persona?.email).toBe('ana.ejemplo@correo.ficticio');
    });
  });

  /* ------------------------------ Poblaciones ---------------------------- */

  describe('pertenencias poblacionales', () => {
    const MAYOR = '1958-04-12';
    const MENOR = '1990-05-05';

    const combinaciones = [
      { birthDate: MAYOR, declaradas: [], esperadas: ['OLDER_ADULT_60_PLUS'] },
      { birthDate: MENOR, declaradas: ['DISABILITY'], esperadas: ['DISABILITY'] },
      {
        birthDate: MENOR,
        declaradas: ['HOME_CARE_REQUIRED'],
        esperadas: ['HOME_CARE_REQUIRED'],
      },
      {
        birthDate: MAYOR,
        declaradas: ['DISABILITY'],
        esperadas: ['OLDER_ADULT_60_PLUS', 'DISABILITY'],
      },
      {
        birthDate: MAYOR,
        declaradas: ['HOME_CARE_REQUIRED'],
        esperadas: ['OLDER_ADULT_60_PLUS', 'HOME_CARE_REQUIRED'],
      },
      {
        birthDate: MENOR,
        declaradas: ['DISABILITY', 'HOME_CARE_REQUIRED'],
        esperadas: ['DISABILITY', 'HOME_CARE_REQUIRED'],
      },
      {
        birthDate: MAYOR,
        declaradas: ['DISABILITY', 'HOME_CARE_REQUIRED'],
        esperadas: ['OLDER_ADULT_60_PLUS', 'DISABILITY', 'HOME_CARE_REQUIRED'],
      },
    ] as const;

    it('persiste las siete combinaciones no vacías', async () => {
      expect(combinaciones).toHaveLength(7);

      for (const caso of combinaciones) {
        const documento = nextTestDocument();
        const resultado = await inscribir(
          enrollmentBody({
            documentNumber: documento,
            birthDate: caso.birthDate,
            declaredPopulations: [...caso.declaradas],
          }),
        );

        expect(resultado.status).toBe(201);

        const persistidas = await prisma.patientPopulationMembership.findMany({
          where: { patient: { person: { documentNumberNormalized: documento } } },
          select: { populationType: true, source: true },
        });

        expect(new Set(persistidas.map((entrada) => entrada.populationType))).toStrictEqual(
          new Set(caso.esperadas),
        );

        const mayor = persistidas.find(
          (entrada) => entrada.populationType === 'OLDER_ADULT_60_PLUS',
        );
        if (mayor !== undefined) {
          expect(mayor.source).toBe('DERIVED_BIRTH_DATE');
        }
      }
    });

    it('deriva la persona mayor aunque el cliente no la declare', async () => {
      const documento = nextTestDocument();
      await inscribir(
        enrollmentBody({ documentNumber: documento, birthDate: '1940-01-01' }),
      );

      const derivada = await prisma.patientPopulationMembership.findFirst({
        where: {
          patient: { person: { documentNumberNormalized: documento } },
          populationType: 'OLDER_ADULT_60_PLUS',
        },
      });

      expect(derivada?.source).toBe('DERIVED_BIRTH_DATE');
    });

    it('rechaza con 422 una inscripción sin ninguna pertenencia', async () => {
      const resultado = await inscribir(
        enrollmentBody({ birthDate: '1990-05-05', declaredPopulations: [] }),
      );

      expect(resultado.status).toBe(422);
      expect(resultado.body['code']).toBe('ENROLLMENT_VALIDATION_FAILED');
    });
  });

  /* ------------------------------ Territorio ----------------------------- */

  describe('territorio', () => {
    it('guarda identificadores del catálogo, no los nombres del cliente', async () => {
      const documento = nextTestDocument();
      const resultado = await inscribir(enrollmentBody({ documentNumber: documento }));

      const departamento = await territorialUnitId(prisma, 'DEPARTMENT', DEPARTMENT_CODE);
      const municipio = await territorialUnitId(prisma, 'MUNICIPALITY', MUNICIPALITY_CODE);

      const direccion = await prisma.patientAddress.findFirst({
        where: { patient: { person: { documentNumberNormalized: documento } } },
        select: { departmentUnitId: true, municipalityUnitId: true, areaType: true },
      });

      expect(direccion?.departmentUnitId).toBe(departamento);
      expect(direccion?.municipalityUnitId).toBe(municipio);
      // El área es la declarada por la persona, no una inferencia del servidor.
      expect(direccion?.areaType).toBe('URBAN');

      expect(resultado.body['territory']).toMatchObject({
        departmentCode: DEPARTMENT_CODE,
        departmentName: 'ANTIOQUIA',
        municipalityCode: MUNICIPALITY_CODE,
        municipalityName: 'MEDELLÍN',
        localityName: null,
        localityPendingNormalization: true,
        areaType: 'URBAN',
      });
    });

    it('rechaza con 422 un municipio que no pertenece al departamento', async () => {
      const resultado = await inscribir(
        enrollmentBody({ territory: { departmentCode: '05', municipalityCode: '25754' } }),
      );

      expect(resultado.status).toBe(422);
      expect(resultado.body['fields']).toContain('territory.municipalityCode');
    });

    it('rechaza con 422 un código territorial inexistente en el catálogo', async () => {
      const resultado = await inscribir(
        enrollmentBody({ territory: { departmentCode: '99', municipalityCode: '99999' } }),
      );

      expect(resultado.status).toBe(422);
    });

    it('rechaza con 422 una unidad local que no existe para el tenant', async () => {
      const resultado = await inscribir(
        enrollmentBody({
          territory: {
            localUnitId: '019287a1-0000-7000-8000-0000000000aa',
            localityDeclaredText: undefined,
          },
        }),
      );

      expect(resultado.status).toBe(422);
      expect(resultado.body['fields']).toContain('territory.localUnitId');
    });

    it('no crea unidades territoriales a partir del texto declarado', async () => {
      const antes = await prisma.territorialUnit.count();
      await inscribir(
        enrollmentBody({ territory: { localityDeclaredText: 'Vereda Nueva Ficticia' } }),
      );
      const despues = await prisma.territorialUnit.count();

      expect(despues).toBe(antes);
      expect(
        await prisma.territorialUnit.count({
          where: { displayName: 'Vereda Nueva Ficticia' },
        }),
      ).toBe(0);
    });
  });

  /* --------------------------------- 409 --------------------------------- */

  describe('documento duplicado', () => {
    it('devuelve 409 con código estable y sin revelar el registro existente', async () => {
      const documento = nextTestDocument();
      const primera = await inscribir(enrollmentBody({ documentNumber: documento }));
      const segunda = await inscribir(
        enrollmentBody({
          documentNumber: documento,
          givenNames: 'Otro Nombre',
          familyNames: 'Distinto Ficticio',
        }),
      );

      expect(primera.status).toBe(201);
      expect(segunda.status).toBe(409);
      expect(segunda.body['code']).toBe('PATIENT_DOCUMENT_CONFLICT');

      const serializado = JSON.stringify(segunda.body);
      expect(serializado).not.toContain('Ana María');
      expect(serializado).not.toContain(documento);
      expect(serializado).not.toContain('Cra 45');
      expect(serializado).not.toContain('enrolledAt');
      expect(segunda.setCookie).toHaveLength(0);
    });

    it('no fusiona ni sobrescribe el registro existente', async () => {
      const documento = nextTestDocument();
      await inscribir(enrollmentBody({ documentNumber: documento }));
      await inscribir(
        enrollmentBody({ documentNumber: documento, givenNames: 'Sobrescritura' }),
      );

      const personas = await prisma.person.findMany({
        where: { documentNumberNormalized: documento },
        select: { givenNames: true },
      });

      expect(personas).toHaveLength(1);
      expect(personas[0]?.givenNames).toBe('Ana María');
    });

    it('detecta el duplicado aunque cambie la presentación del documento', async () => {
      const documento = nextTestDocument();
      const conPuntos = `${documento.slice(0, 2)}.${documento.slice(2)}`;

      expect((await inscribir(enrollmentBody({ documentNumber: documento }))).status).toBe(
        201,
      );
      expect((await inscribir(enrollmentBody({ documentNumber: conPuntos }))).status).toBe(
        409,
      );
    });

    it('bajo concurrencia crea una sola inscripción', async () => {
      const documento = nextTestDocument();

      // Dos altas simultáneas del MISMO documento a través de la API.
      const respuestas = await Promise.all([
        request(app.getHttpServer())
          .post('/api/v1/patients/enrollments')
          .send(enrollmentBody({ documentNumber: documento })),
        request(app.getHttpServer())
          .post('/api/v1/patients/enrollments')
          .send(enrollmentBody({ documentNumber: documento })),
      ]);

      const estados = respuestas.map((respuesta) => respuesta.status);
      expect(estados.filter((estado) => estado === 201)).toHaveLength(1);
      expect(estados.filter((estado) => estado === 409)).toHaveLength(1);

      expect(
        await prisma.person.count({ where: { documentNumberNormalized: documento } }),
      ).toBe(1);
    });
  });

  /* ------------------------------ 400 y 422 ------------------------------ */

  describe('cuerpos inválidos', () => {
    it('devuelve 400 ante JSON mal formado y no devuelve su contenido', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/patients/enrollments')
        .set('Content-Type', 'application/json')
        .send('{"documentNumber": "9999012345", ');

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({ code: 'INVALID_REQUEST_BODY' });
      expect(JSON.stringify(response.body)).not.toContain('9999012345');
    });

    it('devuelve 400 ante una propiedad desconocida', async () => {
      const resultado = await inscribir({ ...enrollmentBody(), tenantId: 'ajeno' });

      expect(resultado.status).toBe(400);
      expect(resultado.body['fields']).toContain('tenantId');
    });

    it('rechaza los campos que solo puede fijar el servidor', async () => {
      for (const campo of ['origin', 'status', 'age', 'createdBy', 'enrolledAt']) {
        const resultado = await inscribir({ ...enrollmentBody(), [campo]: 'x' });
        expect(resultado.status).toBe(400);
        expect(resultado.body['fields']).toContain(campo);
      }
    });

    it('devuelve 422 ante valores de catálogo falsos', async () => {
      for (const invalido of [
        { documentType: 'REGISTRO_INVENTADO' },
        { sexGenderCode: 'X' },
        { epsCode: 'EPS_QUE_NO_EXISTE' },
      ]) {
        const resultado = await inscribir(enrollmentBody(invalido));
        expect(resultado.status).toBe(422);
        expect(resultado.body['code']).toBe('ENROLLMENT_VALIDATION_FAILED');
      }
    });

    it('devuelve 400 cuando falta la zona urbana o rural', async () => {
      const resultado = await inscribir(
        enrollmentBody({ territory: { areaType: undefined } }),
      );

      expect(resultado.status).toBe(400);
      expect(resultado.body['fields']).toContain('territory.areaType');
    });

    it('devuelve 422 ante una zona fuera del catálogo', async () => {
      const resultado = await inscribir(
        enrollmentBody({ territory: { areaType: 'SEMIURBANA' } }),
      );

      expect(resultado.status).toBe(422);
      expect(resultado.body['fields']).toContain('territory.areaType');
    });

    it('devuelve 422 sin consentimiento', async () => {
      const resultado = await inscribir(enrollmentBody({ consentAccepted: false }));

      expect(resultado.status).toBe(422);
      expect(resultado.body['fields']).toContain('consentAccepted');
    });

    it('devuelve 422 ante una fecha de nacimiento futura', async () => {
      const resultado = await inscribir(enrollmentBody({ birthDate: '2099-01-01' }));

      expect(resultado.status).toBe(422);
      expect(resultado.body['fields']).toContain('birthDate');
    });

    it('los errores nunca contienen datos personales ni trazas', async () => {
      const resultado = await inscribir(
        enrollmentBody({
          documentNumber: '99999#####',
          givenNames: 'Nombre Que No Debe Aparecer',
        }),
      );

      const serializado = JSON.stringify(resultado.body);
      expect(serializado).not.toContain('Nombre Que No Debe Aparecer');
      expect(serializado).not.toContain('99999#####');
      expect(serializado).not.toContain('prisma');
      expect(serializado).not.toContain('stack');
      expect(serializado.toLowerCase()).not.toContain('postgres');
    });

    it('no crea ninguna fila cuando la petición es inválida', async () => {
      const antesPersonas = await prisma.person.count();
      await inscribir(enrollmentBody({ epsCode: 'EPS_QUE_NO_EXISTE' }));
      expect(await prisma.person.count()).toBe(antesPersonas);
    });
  });

  /* ------------------------------- GET /me ------------------------------- */

  describe('GET /api/v1/patients/me', () => {
    it('recupera el paciente con la cookie emitida', async () => {
      const documento = nextTestDocument();
      const creado = await inscribir(enrollmentBody({ documentNumber: documento }));

      const response = await request(app.getHttpServer())
        .get('/api/v1/patients/me')
        .set('Cookie', `${COOKIE_NAME}=${creado.token}`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        status: 'ACTIVE',
        givenNames: 'Ana María',
        familyNames: 'Ejemplo Ficticio',
      });
    });

    it('sigue recuperando el paciente con una instancia nueva de la aplicación', async () => {
      const documento = nextTestDocument();
      const creado = await inscribir(enrollmentBody({ documentNumber: documento }));

      // Equivale a reiniciar el proceso de la API y recargar el navegador: se
      // cierra la aplicación anterior antes de crear la nueva, de modo que nada
      // del paciente pueda provenir de memoria.
      await app.close();
      app = await crearAplicacion();

      const response = await request(app.getHttpServer())
        .get('/api/v1/patients/me')
        .set('Cookie', `${COOKIE_NAME}=${creado.token}`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ givenNames: 'Ana María' });
    });

    it('no devuelve documento, dirección exacta, contacto ni consentimiento', async () => {
      const documento = nextTestDocument();
      const creado = await inscribir(
        enrollmentBody({ documentNumber: documento, email: 'ana@correo.ficticio' }),
      );

      const response = await request(app.getHttpServer())
        .get('/api/v1/patients/me')
        .set('Cookie', `${COOKIE_NAME}=${creado.token}`);

      const serializado = JSON.stringify(response.body);
      expect(serializado).not.toContain(documento);
      expect(serializado).not.toContain('Cra 45');
      expect(serializado).not.toContain('Casa azul');
      expect(serializado).not.toContain('311 220 3355');
      expect(serializado).not.toContain('ana@correo.ficticio');
      expect(serializado).not.toContain('consentVersion');
      expect(serializado).not.toContain('tokenHash');
    });

    it('devuelve 401 sin cookie, con cookie vacía o con token inventado', async () => {
      for (const cookie of [
        undefined,
        `${COOKIE_NAME}=`,
        `${COOKIE_NAME}=token-inventado`,
        `${COOKIE_NAME}=${generateSessionToken()}`,
      ]) {
        const peticion = request(app.getHttpServer()).get('/api/v1/patients/me');
        const response =
          cookie === undefined ? await peticion : await peticion.set('Cookie', cookie);

        expect(response.status).toBe(401);
        expect(response.body).toMatchObject({ code: 'ENROLLMENT_SESSION_REQUIRED' });
      }
    });

    it('devuelve 401 con una sesión expirada', async () => {
      const documento = nextTestDocument();
      const creado = await inscribir(enrollmentBody({ documentNumber: documento }));

      // La restricción de la base exige `expiresAt > createdAt`: para simular una
      // sesión caducada se retrasan ambas marcas, como si se hubiera creado ayer.
      const ayer = new Date(Date.now() - 24 * 60 * 60 * 1000);
      await prisma.enrollmentSession.updateMany({
        where: { patient: { person: { documentNumberNormalized: documento } } },
        data: { createdAt: ayer, expiresAt: new Date(ayer.getTime() + 1000) },
      });

      const response = await request(app.getHttpServer())
        .get('/api/v1/patients/me')
        .set('Cookie', `${COOKIE_NAME}=${creado.token}`);

      expect(response.status).toBe(401);
    });

    it('devuelve 401 con una sesión revocada', async () => {
      const documento = nextTestDocument();
      const creado = await inscribir(enrollmentBody({ documentNumber: documento }));

      await prisma.enrollmentSession.updateMany({
        where: { patient: { person: { documentNumberNormalized: documento } } },
        data: { revokedAt: new Date() },
      });

      const response = await request(app.getHttpServer())
        .get('/api/v1/patients/me')
        .set('Cookie', `${COOKIE_NAME}=${creado.token}`);

      expect(response.status).toBe(401);
    });

    it('registra el último uso de una sesión válida', async () => {
      const documento = nextTestDocument();
      const creado = await inscribir(enrollmentBody({ documentNumber: documento }));

      await request(app.getHttpServer())
        .get('/api/v1/patients/me')
        .set('Cookie', `${COOKIE_NAME}=${creado.token}`);

      const sesion = await prisma.enrollmentSession.findFirst({
        where: { patient: { person: { documentNumberNormalized: documento } } },
        select: { lastUsedAt: true },
      });

      expect(sesion?.lastUsedAt).not.toBeNull();
    });

    it('cada sesión recupera únicamente su propio paciente', async () => {
      const primera = await inscribir(
        enrollmentBody({ givenNames: 'Primera', familyNames: 'Ficticia Uno' }),
      );
      const segunda = await inscribir(
        enrollmentBody({ givenNames: 'Segunda', familyNames: 'Ficticia Dos' }),
      );

      const respuestaPrimera = await request(app.getHttpServer())
        .get('/api/v1/patients/me')
        .set('Cookie', `${COOKIE_NAME}=${primera.token}`);
      const respuestaSegunda = await request(app.getHttpServer())
        .get('/api/v1/patients/me')
        .set('Cookie', `${COOKIE_NAME}=${segunda.token}`);

      expect(respuestaPrimera.body['givenNames']).toBe('Primera');
      expect(respuestaSegunda.body['givenNames']).toBe('Segunda');
    });
  });

  /* --------------------------- Aislamiento tenant ------------------------- */

  describe('modo de aislamiento efectivo', () => {
    it('declara si el rol runtime estuvo aplicado durante esta ejecución', () => {
      // Esta prueba no afirma seguridad: documenta en qué modo corrió la suite
      // para que un resultado verde no se confunda con RLS verificada.
      expect(['enforce', 'disabled']).toContain(
        process.env['MERDN_RUNTIME_ROLE'] ?? 'enforce',
      );
      expect(rolRuntimeAplicado).toBe(
        availability.engine === 'postgresql-server' &&
          process.env['RUNTIME_DATABASE_URL'] !== undefined,
      );
    });
  });

  describe('aislamiento institucional', () => {
    it('una sesión de otro tenant no recupera su paciente', async () => {
      const otroTenantId = await ensureOtherTenant(prisma);
      const documento = nextTestDocument();
      const token = generateSessionToken();
      const departamento = await territorialUnitId(prisma, 'DEPARTMENT', DEPARTMENT_CODE);
      const municipio = await territorialUnitId(prisma, 'MUNICIPALITY', MUNICIPALITY_CODE);

      await prisma.$transaction(async (tx) => {
        const persona = await tx.person.create({
          data: {
            tenantId: otroTenantId,
            documentType: 'CEDULA_CIUDADANIA',
            documentNumber: documento,
            documentNumberNormalized: documento,
            givenNames: 'Paciente',
            familyNames: 'De Otra Institución',
            birthDate: new Date(Date.UTC(1955, 0, 1)),
            sexGenderCode: 'FEMENINO',
          },
          select: { id: true },
        });

        const paciente = await tx.patient.create({
          data: {
            tenantId: otroTenantId,
            personId: persona.id,
            epsCode: 'NUEVA_EPS',
            epsNameControlled: 'Nueva EPS',
            origin: 'PUBLIC_SELF_ENROLLMENT',
          },
          select: { id: true },
        });

        await tx.patientAddress.create({
          data: {
            tenantId: otroTenantId,
            patientId: paciente.id,
            departmentUnitId: departamento,
            municipalityUnitId: municipio,
            localUnitId: null,
            areaType: 'RURAL',
            localityPendingNormalization: true,
            localityUnverifiedText: 'Otra localidad',
            exactAddress: 'Calle Ficticia 1',
          },
        });

        await tx.enrollmentSession.create({
          data: {
            tenantId: otroTenantId,
            patientId: paciente.id,
            tokenHash: hashSessionToken(token),
            expiresAt: new Date(Date.now() + 3_600_000),
          },
        });
      });

      const response = await request(app.getHttpServer())
        .get('/api/v1/patients/me')
        .set('Cookie', `${COOKIE_NAME}=${token}`);

      expect(response.status).toBe(401);
      expect(JSON.stringify(response.body)).not.toContain('De Otra Institución');
      expect(JSON.stringify(response.body)).not.toContain('Calle Ficticia');
    });

    it('toda inscripción pertenece al tenant resuelto por el servidor', async () => {
      const documento = nextTestDocument();
      await inscribir(enrollmentBody({ documentNumber: documento }));

      const tenantActivo = await prisma.tenant.findUnique({
        where: { code: process.env['MERDN_ACTIVE_TENANT_CODE'] ?? 'merdn-mvp' },
        select: { id: true },
      });

      const persona = await prisma.person.findFirst({
        where: { documentNumberNormalized: documento },
        select: { tenantId: true, patient: { select: { tenantId: true } } },
      });

      expect(persona?.tenantId).toBe(tenantActivo?.id);
      expect(persona?.patient?.tenantId).toBe(tenantActivo?.id);
    });
  });
});
