/*
 * Aprovisionamiento FICTICIO del entorno. Debe quedar definido ANTES de
 * importar la aplicación: los módulos institucional y humano leen su
 * configuración UNA sola vez, al construirse.
 *
 * TODAS las credenciales son ficticias, locales y no coinciden con ninguna
 * credencial real ni desplegada. El descubrimiento OIDC NO se ejecuta en estas
 * pruebas, que no llegan a tocar el proveedor: las sesiones humanas se siembran
 * directamente, que es lo que persistiría el aprovisionamiento administrativo.
 */
process.env['MERDN_HOSPITAL_SCHEDULER_SECRET'] =
  'credencial-ficticia-de-pruebas-visitas-0006';
process.env['MERDN_HOSPITAL_SCHEDULER_CODE'] = 'hospital-scheduler-visitas-pruebas';
process.env['MERDN_HOSPITAL_PATIENT_VIEWER_SECRET'] =
  'credencial-ficticia-de-pruebas-visitas-0007';
process.env['MERDN_HOSPITAL_PATIENT_VIEWER_CODE'] =
  'hospital-patient-viewer-visitas-pruebas';
process.env['MERDN_HUMAN_AUTH_ISSUER'] =
  'http://host.docker.internal:8081/realms/merdn-local';
process.env['MERDN_HUMAN_AUTH_CLIENT_ID'] = 'merdn-human-web';
process.env['MERDN_HUMAN_AUTH_CALLBACK_URI'] =
  'http://127.0.0.1:3001/api/v1/human-auth/callback';
process.env['MERDN_HUMAN_AUTH_ATTEMPT_KEY'] = 'c'.repeat(64);

import { randomBytes, randomUUID } from 'node:crypto';

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, inject, it } from 'vitest';

import { AppModule } from '../src/app.module';
import { RuntimeContextUnavailableError } from '../src/database/runtime-context.error';
import { type PrismaClient } from '../src/generated/prisma/client';
import { buildOpenApiDocument } from '../src/openapi/openapi';
import { MalformedJsonFilter } from '../src/patients/malformed-json.filter';
import { HomeVisitMaterializationService } from '../src/visits/home-visit-materialization.service';
import { HomeVisitTransitionService } from '../src/visits/home-visit-transition.service';
import { ProfessionalVisitQueryService } from '../src/visits/professional-visit-query.service';
import { ProfessionalVisitWorklistService } from '../src/visits/professional-visit-worklist.service';

import { createTestPrismaClient, unavailableBanner } from './database-availability';
import { ensureOtherTenant } from './enrollment-fixtures';
import { crearCitaAsignada, crearSolicitud } from './hospital-core-02-fixtures';
import {
  cookieDe,
  crearCuentaHumana,
  crearPacienteFicticio,
  crearPersona,
  crearProfesionalFicticio,
  crearSesionHumana,
} from './identity-relationships-fixtures';

/**
 * API PROTEGIDA de Visitas domiciliarias, de extremo a extremo
 * (VISITS-CORE-01 MP04).
 *
 * ALCANCE EXACTO: las TRES operaciones que MP04 crea, y ninguna más. NO vuelve a
 * probar el dominio de MP02 ni la máquina de MP03 —que tienen sus propias
 * pruebas contra PostgreSQL—: aquí se verifica el BORDE, es decir que la API
 *
 *   1. materializa SOLO con sesión institucional de agenda y origen autorizado;
 *   2. resuelve la identidad y la autorización EXCLUSIVAMENTE en el servidor,
 *      desde la cookie, y NUNCA desde `professionalId`, `patientId`, `tenantId`,
 *      actor, rol ni marca de tiempo enviados por el cliente;
 *   3. devuelve `404` UNIFORME ante inexistente, de otra institución y sin
 *      asignación vigente, sin filtrar la existencia de un registro ajeno;
 *   4. devuelve `409` ante versión obsoleta y transición ilegal o terminal;
 *   5. rechaza cuerpos con campos desconocidos, identificadores mal formados,
 *      estados no admitidos y versiones que no son enteros positivos;
 *   6. no admite que la cookie institucional o la de autoinscripción sustituyan
 *      a la humana, ni al revés;
 *   7. comprueba el origen en las dos operaciones que cambian estado;
 *   8. marca TODA respuesta como no cacheable y no devuelve NINGÚN dato personal;
 *   9. falla CERRADO cuando el contexto de ejecución seguro no se confirma.
 *
 * Ejercita la aplicación NestJS completa contra PostgreSQL real. Si la base no
 * está disponible, la suite se marca como NO EJECUTADA con un motivo visible.
 *
 * TODAS las personas, pacientes, profesionales, cuentas, citas e identidades son
 * FICTICIAS. Ninguna prueba usa datos reales de salud.
 *
 * LIMPIEZA ACOTADA: se retiran EXCLUSIVAMENTE las filas cuyos identificadores
 * esta prueba registró al sembrarlas. Deliberadamente NO se usa
 * `deleteMany({})` sobre ninguna tabla compartida ni sobre las de Visitas: esos
 * datos pertenecen a otros paquetes y a otras pruebas. `audit_event` es
 * append-only y NO se borra NUNCA.
 */

const INSTITUTIONAL_COOKIE = 'merdn_institutional_session';
const HUMAN_COOKIE = 'merdn_human_session';
const ENROLLMENT_COOKIE = 'merdn_enrollment_session';

const SESSIONS_PATH = '/api/v1/institutional/sessions';
const MATERIALIZE_PATH = '/api/v1/visits/materialize';
const PROFESSIONAL_PATH = '/api/v1/professional/visits';

/** Origen web autorizado por la configuración por defecto del entorno. */
const ORIGEN_AUTORIZADO = 'http://127.0.0.1:3000';
const ORIGEN_AJENO = 'http://sitio-ficticio-ajeno.invalid';

const CODIGO_SCHEDULER = 'hospital-scheduler-visitas-pruebas';
const CREDENCIAL_SCHEDULER = 'credencial-ficticia-de-pruebas-visitas-0006';
const CODIGO_VIEWER = 'hospital-patient-viewer-visitas-pruebas';
const CREDENCIAL_VIEWER = 'credencial-ficticia-de-pruebas-visitas-0007';

/** Identidad institucional OPACA sembrada en el OTRO tenant. */
const CODIGO_OTRO_TENANT = 'hospital-scheduler-otro-tenant-visitas-pruebas';

/** Instante base de las citas sembradas. Fecha ficticia y determinista. */
const HORARIO = new Date(Date.UTC(2026, 7, 24, 16, 0, 0));

/** Dia UTC de `HORARIO`. La worklist NO tiene ventana por defecto. */
const DIA = '2026-08-24';

/** Ventana de un solo dia, declarada SIEMPRE de forma explicita. */
const VENTANA = `?from=${DIA}&to=${DIA}`;

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
    '\nAVISO: las pruebas de la API de Visitas se ejecutan con ' +
      'MERDN_RUNTIME_ROLE=disabled porque el motor conectado no sostiene Row Level ' +
      'Security bajo el rol runtime. El aislamiento por BASE DE DATOS no queda ' +
      'verificado en esta ejecución; los filtros explícitos por tenant y la ' +
      'autorización server-side de la aplicación SÍ.\n',
  );
}

/**
 * REGISTRO EXACTO de lo que esta prueba siembra.
 *
 * La limpieza retira ESTOS identificadores y NINGUNO más.
 */
interface Sembrado {
  readonly visitas: Set<string>;
  readonly citas: Set<string>;
  readonly asignaciones: Set<string>;
  readonly pacientes: Set<string>;
  readonly profesionales: Set<string>;
  readonly cuentas: Set<string>;
  readonly personas: Set<string>;
}

const sembrado: Sembrado = {
  visitas: new Set<string>(),
  citas: new Set<string>(),
  asignaciones: new Set<string>(),
  pacientes: new Set<string>(),
  profesionales: new Set<string>(),
  cuentas: new Set<string>(),
  personas: new Set<string>(),
};

/** `{ id: { in: [...] } }`, o `null` cuando no hay nada que retirar. */
function porId(ids: ReadonlySet<string>): { id: { in: string[] } } | null {
  return ids.size === 0 ? null : { id: { in: [...ids] } };
}

/**
 * Retira EXCLUSIVAMENTE lo sembrado, en el orden que exigen las claves foráneas.
 *
 * NO borra eventos de auditoría ni identidades institucionales: las primeras son
 * append-only y las segundas viven toda la suite porque autentican las
 * peticiones y las asignaciones las referencian.
 */
async function retirarLoSembrado(prisma: PrismaClient): Promise<void> {
  if (sembrado.visitas.size > 0) {
    const visitas = [...sembrado.visitas];
    await prisma.homeVisitTransition.deleteMany({ where: { homeVisitId: { in: visitas } } });
    await prisma.homeVisit.deleteMany({ where: { id: { in: visitas } } });
  }

  const citas = porId(sembrado.citas);
  if (citas !== null) {
    await prisma.appointment.deleteMany({ where: citas });
  }

  const asignaciones = porId(sembrado.asignaciones);
  if (asignaciones !== null) {
    await prisma.careAssignment.deleteMany({ where: asignaciones });
  }

  const pacientes = porId(sembrado.pacientes);
  if (pacientes !== null) {
    await prisma.patient.deleteMany({ where: pacientes });
  }

  if (sembrado.profesionales.size > 0) {
    const profesionales = [...sembrado.profesionales];
    await prisma.professionalAffiliation.deleteMany({
      where: { professionalId: { in: profesionales } },
    });
    await prisma.professionalProfile.deleteMany({ where: { id: { in: profesionales } } });
  }

  if (sembrado.cuentas.size > 0) {
    const cuentas = [...sembrado.cuentas];
    await prisma.humanSession.deleteMany({ where: { humanAccountId: { in: cuentas } } });
    await prisma.externalAuthIdentity.deleteMany({ where: { humanAccountId: { in: cuentas } } });
    await prisma.humanAccount.deleteMany({ where: { id: { in: cuentas } } });
  }

  const personas = porId(sembrado.personas);
  if (personas !== null) {
    await prisma.person.deleteMany({ where: personas });
  }

  for (const conjunto of Object.values(sembrado)) {
    conjunto.clear();
  }
}

/**
 * Retira los residuos que una ejecución ANTERIOR de esta misma prueba pudo
 * dejar si se interrumpió antes de su limpieza.
 *
 * El criterio es estrictamente MP04: se parte de las identidades
 * institucionales cuyo código es el reservado de este archivo y se desciende por
 * las asignaciones, citas, visitas, historial y cuentas humanas que ESAS
 * identidades originaron. Nada más se toca.
 */
async function retirarResiduos(prisma: PrismaClient): Promise<void> {
  const identidades = await prisma.institutionalIdentity.findMany({
    where: { code: { in: [CODIGO_SCHEDULER, CODIGO_VIEWER, CODIGO_OTRO_TENANT] } },
    select: { id: true },
  });

  if (identidades.length === 0) {
    return;
  }

  const identidadIds = identidades.map((identidad) => identidad.id);

  const asignaciones = await prisma.careAssignment.findMany({
    where: { createdByIdentityId: { in: identidadIds } },
    select: { id: true, professionalId: true, patientId: true },
  });
  const asignacionIds = asignaciones.map((asignacion) => asignacion.id);

  const visitas = await prisma.homeVisit.findMany({
    where: {
      OR: [
        { createdByInstitutionalIdentityId: { in: identidadIds } },
        ...(asignacionIds.length > 0 ? [{ careAssignmentId: { in: asignacionIds } }] : []),
      ],
    },
    select: { id: true },
  });
  const visitaIds = visitas.map((visita) => visita.id);

  if (visitaIds.length > 0) {
    await prisma.homeVisitTransition.deleteMany({ where: { homeVisitId: { in: visitaIds } } });
    await prisma.homeVisit.deleteMany({ where: { id: { in: visitaIds } } });
  }

  if (asignacionIds.length > 0) {
    await prisma.appointment.deleteMany({ where: { careAssignmentId: { in: asignacionIds } } });
    await prisma.careAssignment.deleteMany({ where: { id: { in: asignacionIds } } });
  }

  /*
   * Las cuentas humanas de las profesionales de ESAS asignaciones son las que
   * esta prueba creó para poder atribuir cada transición. Se localizan por la
   * persona del perfil profesional, y no por un barrido de `human_account`.
   */
  const profesionalIds = asignaciones.map((asignacion) => asignacion.professionalId);

  if (profesionalIds.length > 0) {
    const perfiles = await prisma.professionalProfile.findMany({
      where: { id: { in: profesionalIds } },
      select: { personId: true },
    });
    const personIds = perfiles.map((perfil) => perfil.personId);

    if (personIds.length > 0) {
      const cuentas = await prisma.humanAccount.findMany({
        where: { personId: { in: personIds } },
        select: { id: true },
      });
      const cuentaIds = cuentas.map((cuenta) => cuenta.id);

      if (cuentaIds.length > 0) {
        await prisma.humanSession.deleteMany({ where: { humanAccountId: { in: cuentaIds } } });
        await prisma.externalAuthIdentity.deleteMany({
          where: { humanAccountId: { in: cuentaIds } },
        });
        await prisma.humanAccount.deleteMany({ where: { id: { in: cuentaIds } } });
      }
    }
  }

  // Las sesiones institucionales caen en cascada con su identidad.
  await prisma.institutionalIdentity.deleteMany({ where: { id: { in: identidadIds } } });
}

describe.skipIf(!puedeEjecutarse)('API protegida de Visitas domiciliarias', () => {
  let app: INestApplication;
  /** Aplicación GEMELA cuyos servicios de Visitas fallan el contexto seguro. */
  let appSinContexto: INestApplication;
  let prisma: PrismaClient;

  let tenantId: string;
  let otroTenantId: string;
  let identidadSchedulerId: string;
  let identidadOtroTenantId: string;

  let cookieScheduler: string;
  let cookieViewer: string;

  beforeAll(async () => {
    prisma = createTestPrismaClient();
    await retirarResiduos(prisma);

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

    /*
     * Gemela para el escenario FAIL-CLOSED: los guards siguen siendo los REALES
     * y validan la sesión contra la base, pero los tres servicios de Visitas
     * rechazan con `RuntimeContextUnavailableError`. Es la única forma de
     * ejercitar por HTTP la traducción a `503` sin degradar la base de la suite.
     */
    const contextoRoto = {
      materialize: () => Promise.reject(new RuntimeContextUnavailableError('prueba')),
      findAuthorized: () => Promise.reject(new RuntimeContextUnavailableError('prueba')),
      listAuthorized: () => Promise.reject(new RuntimeContextUnavailableError('prueba')),
      transition: () => Promise.reject(new RuntimeContextUnavailableError('prueba')),
    };

    const moduleSinContexto = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(HomeVisitMaterializationService)
      .useValue(contextoRoto)
      .overrideProvider(ProfessionalVisitQueryService)
      .useValue(contextoRoto)
      .overrideProvider(ProfessionalVisitWorklistService)
      .useValue(contextoRoto)
      .overrideProvider(HomeVisitTransitionService)
      .useValue(contextoRoto)
      .compile();

    appSinContexto = moduleSinContexto.createNestApplication();
    appSinContexto.useGlobalFilters(new MalformedJsonFilter());
    await appSinContexto.init();

    cookieScheduler = await abrirSesion(CREDENCIAL_SCHEDULER, CODIGO_SCHEDULER);
    cookieViewer = await abrirSesion(CREDENCIAL_VIEWER, CODIGO_VIEWER);

    const identidad = await prisma.institutionalIdentity.findFirst({
      where: { tenantId, code: CODIGO_SCHEDULER },
      select: { id: true },
    });

    if (identidad === null) {
      throw new Error('La identidad institucional de agenda no se aprovisionó.');
    }

    identidadSchedulerId = identidad.id;
    identidadOtroTenantId = await identidadDelOtroTenant();
  });

  afterEach(async () => {
    await retirarLoSembrado(prisma);
  });

  afterAll(async () => {
    if (app !== undefined) {
      await app.close();
    }

    if (appSinContexto !== undefined) {
      await appSinContexto.close();
    }

    if (prisma !== undefined) {
      await retirarLoSembrado(prisma);
      await retirarResiduos(prisma);
      await prisma.$disconnect();
    }
  });

  /* ====================================================================== */
  /* Utilidades                                                              */
  /* ====================================================================== */

  async function abrirSesion(accessSecret: string, identityCode: string): Promise<string> {
    const respuesta = await request(app.getHttpServer())
      .post(SESSIONS_PATH)
      .set('Origin', ORIGEN_AUTORIZADO)
      .send({ accessSecret, identityCode })
      .expect(201);

    const cookie = cookieDe(respuesta.headers['set-cookie'], INSTITUTIONAL_COOKIE);

    if (cookie === null) {
      throw new Error('La respuesta no entregó la cookie institucional.');
    }

    return cookie;
  }

  /**
   * Identidad institucional OPACA del OTRO tenant.
   *
   * La derivación almacenada es ALEATORIA y no corresponde a ninguna credencial:
   * nadie —tampoco la prueba— puede autenticarse con ella. Existe únicamente
   * porque `care_assignment` y `home_visit` exigen procedencia institucional.
   */
  async function identidadDelOtroTenant(): Promise<string> {
    const existente = await prisma.institutionalIdentity.findFirst({
      where: { tenantId: otroTenantId, code: CODIGO_OTRO_TENANT },
      select: { id: true },
    });

    if (existente !== null) {
      return existente.id;
    }

    const creada = await prisma.institutionalIdentity.create({
      data: {
        tenantId: otroTenantId,
        code: CODIGO_OTRO_TENANT,
        role: 'HOSPITAL_SCHEDULER',
        status: 'ACTIVE',
        // Forma exigida por `institutional_identity_secret_shape`.
        accessSecretHash: randomBytes(64).toString('hex'),
        accessSecretSalt: randomBytes(16).toString('hex'),
      },
      select: { id: true },
    });

    return creada.id;
  }

  interface Profesional {
    readonly personId: string;
    readonly professionalId: string;
    readonly humanAccountId: string;
    readonly token: string;
  }

  /** Persona con perfil ACTIVO, afiliación VIGENTE, cuenta y sesión humana. */
  async function profesionalAutenticada(tenant: string = tenantId): Promise<Profesional> {
    const profesional = await crearProfesionalFicticio(prisma, tenant);
    sembrado.profesionales.add(profesional.professionalId);
    sembrado.personas.add(profesional.personId);

    const cuenta = await crearCuentaHumana(prisma, {
      tenantId: tenant,
      personId: profesional.personId,
    });
    sembrado.cuentas.add(cuenta.humanAccountId);

    const sesion = await crearSesionHumana(prisma, {
      tenantId: tenant,
      humanAccountId: cuenta.humanAccountId,
    });

    return {
      personId: profesional.personId,
      professionalId: profesional.professionalId,
      humanAccountId: cuenta.humanAccountId,
      token: sesion.token,
    };
  }

  interface Escenario {
    readonly appointmentId: string;
    readonly careAssignmentId: string;
    readonly patientId: string;
    readonly profesional: Profesional;
  }

  /** Paciente, profesional autenticada y cita `HOME` ya `ASSIGNED`. Sin visita. */
  async function citaAsignada(): Promise<Escenario> {
    const paciente = await crearPacienteFicticio(prisma, tenantId);
    sembrado.pacientes.add(paciente.patientId);
    sembrado.personas.add(paciente.personId);

    const profesional = await profesionalAutenticada();

    const cita = await crearCitaAsignada(prisma, {
      tenantId,
      patientId: paciente.patientId,
      professionalId: profesional.professionalId,
      identityId: identidadSchedulerId,
      modality: 'HOME',
      scheduledStart: HORARIO,
    });
    sembrado.citas.add(cita.appointmentId);
    sembrado.asignaciones.add(cita.careAssignmentId);

    return { ...cita, patientId: paciente.patientId, profesional };
  }

  /** Escenario con la visita YA materializada por la API institucional. */
  async function visitaMaterializada(): Promise<
    Escenario & { readonly homeVisitId: string; readonly version: number }
  > {
    const escenario = await citaAsignada();

    const respuesta = await materializar({
      appointmentId: escenario.appointmentId,
    }).expect(201);

    sembrado.visitas.add(respuesta.body.homeVisitId);

    return {
      ...escenario,
      homeVisitId: respuesta.body.homeVisitId,
      version: respuesta.body.version,
    };
  }

  /** POST de materialización con sesión de agenda y origen válidos. */
  function materializar(cuerpo: unknown): request.Test {
    return request(app.getHttpServer())
      .post(MATERIALIZE_PATH)
      .set('Cookie', `${INSTITUTIONAL_COOKIE}=${cookieScheduler}`)
      .set('Origin', ORIGEN_AUTORIZADO)
      .send(cuerpo as object);
  }

  /** GET de la visita con la sesión humana indicada. */
  function consultar(token: string, visitId: string): request.Test {
    return request(app.getHttpServer())
      .get(`${PROFESSIONAL_PATH}/${visitId}`)
      .set('Cookie', `${HUMAN_COOKIE}=${token}`);
  }

  /** PATCH de estado con sesión humana y origen válidos. */
  function transicionar(token: string, visitId: string, cuerpo: unknown): request.Test {
    return request(app.getHttpServer())
      .patch(`${PROFESSIONAL_PATH}/${visitId}/status`)
      .set('Cookie', `${HUMAN_COOKIE}=${token}`)
      .set('Origin', ORIGEN_AUTORIZADO)
      .send(cuerpo as object);
  }

  /** GET de la worklist con la sesión humana y la cadena de consulta indicadas. */
  function listar(token: string, query: string): request.Test {
    return request(app.getHttpServer())
      .get(`${PROFESSIONAL_PATH}${query}`)
      .set('Cookie', `${HUMAN_COOKIE}=${token}`);
  }

  /**
   * Cita ADICIONAL sobre la MISMA asignación de cuidado ya sembrada.
   *
   * Se crea directamente porque esta suite necesita variar modalidad, estado e
   * instante programado, y la única mutación de agenda aprobada —la asignación
   * hospitalaria— no ofrece esas variantes. La restricción
   * `appointment_status_shape` sigue validando cada fila.
   */
  async function citaDe(
    escenario: Escenario,
    scheduledStart: Date,
    overrides: {
      readonly modality?: 'HOME' | 'ON_SITE' | 'VIRTUAL';
      readonly status?: 'ASSIGNED' | 'CANCELLED';
    } = {},
  ): Promise<string> {
    const cita = await prisma.appointment.create({
      data: {
        tenantId,
        patientId: escenario.patientId,
        careAssignmentId: escenario.careAssignmentId,
        modality: overrides.modality ?? 'HOME',
        status: overrides.status ?? 'ASSIGNED',
        requestedAt: new Date(Date.UTC(2026, 7, 20, 9, 0, 0)),
        scheduledStart,
      },
      select: { id: true },
    });

    sembrado.citas.add(cita.id);

    return cita.id;
  }

  /** Persona autenticada SIN perfil profesional: cuenta y sesión, nada más. */
  async function personaAutenticadaSinPerfil(): Promise<{ readonly token: string }> {
    const { personId } = await crearPersona(prisma, tenantId, 'Persona');
    sembrado.personas.add(personId);

    const cuenta = await crearCuentaHumana(prisma, { tenantId, personId });
    sembrado.cuentas.add(cuenta.humanAccountId);

    const sesion = await crearSesionHumana(prisma, {
      tenantId,
      humanAccountId: cuenta.humanAccountId,
    });

    return { token: sesion.token };
  }

  /** Vínculo laboral VIGENTE que la fixture sembró junto al perfil. */
  async function afiliacionDe(
    professionalId: string,
  ): Promise<{ readonly id: string; readonly startsOn: Date }> {
    const vinculo = await prisma.professionalAffiliation.findFirst({
      where: { professionalId },
      select: { id: true, startsOn: true },
    });

    if (vinculo === null) {
      throw new Error('La afiliación sembrada no existe.');
    }

    return vinculo;
  }

  /** Ninguna respuesta personal puede quedar en una caché compartida. */
  function exigirNoCache(respuesta: request.Response): void {
    expect(respuesta.headers['cache-control']).toBe('private, no-store');
    expect(respuesta.headers['pragma']).toBe('no-cache');
    expect(respuesta.headers['vary']).toBe('Cookie');
  }

  /* ====================================================================== */
  /* A · Materialización institucional                                       */
  /* ====================================================================== */

  describe('A · POST /api/v1/visits/materialize', () => {
    it('la agenda hospitalaria materializa y devuelve el resultado minimizado', async () => {
      const escenario = await citaAsignada();

      const respuesta = await materializar({
        appointmentId: escenario.appointmentId,
      }).expect(201);

      sembrado.visitas.add(respuesta.body.homeVisitId);

      expect(Object.keys(respuesta.body).sort()).toStrictEqual([
        'appointmentId',
        'createdAt',
        'creationTransitionId',
        'homeVisitId',
        'status',
        'version',
      ]);
      expect(respuesta.body.appointmentId).toBe(escenario.appointmentId);
      // Una visita NACE sin inicio ni fin: no afirma que la atención ocurriera.
      expect(respuesta.body.status).toBe('SCHEDULED');
      expect(respuesta.body.version).toBe(1);
      exigirNoCache(respuesta);

      // La transición de CREACIÓN no lleva actor humano: el acto es institucional.
      const creacion = await prisma.homeVisitTransition.findUnique({
        where: { id: respuesta.body.creationTransitionId },
        select: { fromStatus: true, toStatus: true, performedByHumanAccountId: true },
      });

      expect(creacion).toMatchObject({
        fromStatus: null,
        toStatus: 'SCHEDULED',
        performedByHumanAccountId: null,
      });
    });

    it('la respuesta no filtra paciente, profesional, institución ni persona', async () => {
      const escenario = await citaAsignada();

      const respuesta = await materializar({
        appointmentId: escenario.appointmentId,
      }).expect(201);

      sembrado.visitas.add(respuesta.body.homeVisitId);

      const serializada = JSON.stringify(respuesta.body);

      for (const prohibido of [
        escenario.patientId,
        escenario.careAssignmentId,
        escenario.profesional.professionalId,
        escenario.profesional.personId,
        escenario.profesional.humanAccountId,
        identidadSchedulerId,
        tenantId,
      ]) {
        expect(serializada).not.toContain(prohibido);
      }
    });

    it('ninguna otra sesión materializa: ni ausencia, ni otro rol, ni cookie humana', async () => {
      const escenario = await citaAsignada();
      const cuerpo = { appointmentId: escenario.appointmentId };

      // Sin cookie institucional.
      await request(app.getHttpServer())
        .post(MATERIALIZE_PATH)
        .set('Origin', ORIGEN_AUTORIZADO)
        .send(cuerpo)
        .expect(401);

      // Rol institucional DISJUNTO: consulta de Pacientes no asigna ni materializa.
      const denegado = await request(app.getHttpServer())
        .post(MATERIALIZE_PATH)
        .set('Cookie', `${INSTITUTIONAL_COOKIE}=${cookieViewer}`)
        .set('Origin', ORIGEN_AUTORIZADO)
        .send(cuerpo)
        .expect(403);

      expect(denegado.body.code).toBe('INSTITUTIONAL_ROLE_REQUIRED');

      /*
       * La cookie HUMANA no autentica a ninguna institución, ni siquiera
       * presentada bajo el nombre de la institucional: el validador comprueba la
       * sesión persistida y no el nombre de la cookie.
       */
      const profesional = escenario.profesional;

      await request(app.getHttpServer())
        .post(MATERIALIZE_PATH)
        .set('Cookie', `${HUMAN_COOKIE}=${profesional.token}`)
        .set('Origin', ORIGEN_AUTORIZADO)
        .send(cuerpo)
        .expect(401);

      await request(app.getHttpServer())
        .post(MATERIALIZE_PATH)
        .set('Cookie', `${INSTITUTIONAL_COOKIE}=${profesional.token}`)
        .set('Origin', ORIGEN_AUTORIZADO)
        .send(cuerpo)
        .expect(401);

      // Y la cita sigue SIN materializar tras los cuatro intentos.
      expect(await prisma.homeVisit.count({ where: { appointmentId: escenario.appointmentId } }))
        .toBe(0);
    });

    it('exige un origen autorizado: sin él y con uno ajeno se rechaza', async () => {
      const escenario = await citaAsignada();
      const cuerpo = { appointmentId: escenario.appointmentId };

      await request(app.getHttpServer())
        .post(MATERIALIZE_PATH)
        .set('Cookie', `${INSTITUTIONAL_COOKIE}=${cookieScheduler}`)
        .send(cuerpo)
        .expect(403);

      await request(app.getHttpServer())
        .post(MATERIALIZE_PATH)
        .set('Cookie', `${INSTITUTIONAL_COOKIE}=${cookieScheduler}`)
        .set('Origin', ORIGEN_AJENO)
        .send(cuerpo)
        .expect(403);

      expect(await prisma.homeVisit.count({ where: { appointmentId: escenario.appointmentId } }))
        .toBe(0);
    });

    it('rechaza el cuerpo con campos de autoridad, desconocidos o mal formados', async () => {
      const escenario = await citaAsignada();

      const invalidos: readonly unknown[] = [
        undefined,
        [],
        'texto',
        {},
        { appointmentId: 'no-es-uuid' },
        { appointmentId: 123 },
        // Campos que fija el SERVIDOR y que el navegador no puede aportar.
        { appointmentId: escenario.appointmentId, tenantId },
        { appointmentId: escenario.appointmentId, identityId: identidadSchedulerId },
        { appointmentId: escenario.appointmentId, role: 'HOSPITAL_SCHEDULER' },
        { appointmentId: escenario.appointmentId, patientId: escenario.patientId },
        {
          appointmentId: escenario.appointmentId,
          professionalId: escenario.profesional.professionalId,
        },
        { appointmentId: escenario.appointmentId, now: '2026-08-24T16:00:00.000Z' },
        { appointmentId: escenario.appointmentId, status: 'COMPLETED' },
      ];

      for (const cuerpo of invalidos) {
        const respuesta = await materializar(cuerpo).expect(400);

        expect(respuesta.body.code).toBe('VISITS_INVALID_BODY');
        // El mensaje nombra el campo y la regla; NUNCA devuelve el valor recibido.
        expect(respuesta.body.message).not.toContain(escenario.appointmentId);
      }

      expect(await prisma.homeVisit.count({ where: { appointmentId: escenario.appointmentId } }))
        .toBe(0);
    });

    it('una cita inexistente y una de otra institución producen el MISMO 404', async () => {
      const ajena = await citaDelOtroTenant();

      const inexistente = await materializar({ appointmentId: randomUUID() }).expect(404);
      const deOtroTenant = await materializar({ appointmentId: ajena.appointmentId }).expect(404);

      expect(inexistente.body).toStrictEqual(deOtroTenant.body);
      expect(inexistente.body.code).toBe('HOME_VISIT_APPOINTMENT_NOT_FOUND');
      // La respuesta no nombra la cita ajena ni describe su estado.
      expect(JSON.stringify(deOtroTenant.body)).not.toContain(ajena.appointmentId);
      exigirNoCache(deOtroTenant);

      // Y la cita ajena sigue intacta y sin visita.
      expect(await prisma.homeVisit.count({ where: { appointmentId: ajena.appointmentId } }))
        .toBe(0);
    });

    it('una cita no asignable y una ya materializada producen 409 distintos', async () => {
      const paciente = await crearPacienteFicticio(prisma, tenantId);
      sembrado.pacientes.add(paciente.patientId);
      sembrado.personas.add(paciente.personId);

      // Solicitud `REQUESTED`, sin asignación: no hay nada que materializar.
      const solicitud = await crearSolicitud(prisma, {
        tenantId,
        patientId: paciente.patientId,
        modality: 'HOME',
      });
      sembrado.citas.add(solicitud);

      const noMaterializable = await materializar({ appointmentId: solicitud }).expect(409);

      expect(noMaterializable.body.code).toBe('HOME_VISIT_APPOINTMENT_NOT_MATERIALIZABLE');

      // Segunda materialización de la MISMA cita: una cita materializa como mucho una.
      const escenario = await visitaMaterializada();

      const duplicada = await materializar({
        appointmentId: escenario.appointmentId,
      }).expect(409);

      expect(duplicada.body.code).toBe('HOME_VISIT_ALREADY_MATERIALIZED');
      expect(
        await prisma.homeVisit.count({ where: { appointmentId: escenario.appointmentId } }),
      ).toBe(1);
    });
  });

  /* ====================================================================== */
  /* B · Consulta profesional                                                */
  /* ====================================================================== */

  describe('B · GET /api/v1/professional/visits/:visitId', () => {
    it('la profesional asignada obtiene su visita, minimizada y no cacheable', async () => {
      const escenario = await visitaMaterializada();

      const respuesta = await consultar(
        escenario.profesional.token,
        escenario.homeVisitId,
      ).expect(200);

      expect(Object.keys(respuesta.body).sort()).toStrictEqual([
        'appointmentId',
        'createdAt',
        'endedAt',
        'homeVisitId',
        'startedAt',
        'status',
        'updatedAt',
        'version',
      ]);
      expect(respuesta.body.homeVisitId).toBe(escenario.homeVisitId);
      expect(respuesta.body.status).toBe('SCHEDULED');
      expect(respuesta.body.startedAt).toBeNull();
      expect(respuesta.body.endedAt).toBeNull();
      exigirNoCache(respuesta);

      const serializada = JSON.stringify(respuesta.body);

      for (const prohibido of [
        escenario.patientId,
        escenario.careAssignmentId,
        escenario.profesional.professionalId,
        escenario.profesional.personId,
        escenario.profesional.humanAccountId,
        identidadSchedulerId,
        tenantId,
      ]) {
        expect(serializada).not.toContain(prohibido);
      }
    });

    it('sin sesión humana no hay lectura, y ninguna otra cookie la sustituye', async () => {
      const escenario = await visitaMaterializada();
      const ruta = `${PROFESSIONAL_PATH}/${escenario.homeVisitId}`;

      const sinCookie = await request(app.getHttpServer()).get(ruta).expect(401);

      expect(sinCookie.body.code).toBe('HUMAN_SESSION_REQUIRED');
      exigirNoCache(sinCookie);

      // La cookie INSTITUCIONAL no autentica a ninguna persona, ni con su
      // propio nombre ni presentada bajo el de la humana.
      await request(app.getHttpServer())
        .get(ruta)
        .set('Cookie', `${INSTITUTIONAL_COOKIE}=${cookieScheduler}`)
        .expect(401);

      await request(app.getHttpServer())
        .get(ruta)
        .set('Cookie', `${HUMAN_COOKIE}=${cookieScheduler}`)
        .expect(401);

      // Tampoco la de autoinscripción, que no atribuye ningún acto profesional.
      await request(app.getHttpServer())
        .get(ruta)
        .set('Cookie', `${ENROLLMENT_COOKIE}=${escenario.profesional.token}`)
        .expect(401);

      /*
       * Y presentar las TRES a la vez no elige un principal ambiguo: solo la
       * humana autentica, porque cada superficie lee exclusivamente la suya.
       */
      await request(app.getHttpServer())
        .get(ruta)
        .set('Cookie', [
          `${ENROLLMENT_COOKIE}=token-ficticio-inerte`,
          `${INSTITUTIONAL_COOKIE}=${cookieScheduler}`,
          `${HUMAN_COOKIE}=${escenario.profesional.token}`,
        ])
        .expect(200);
    });

    it('otra profesional recibe el MISMO 404 que una visita inexistente', async () => {
      const escenario = await visitaMaterializada();
      const otra = await profesionalAutenticada();

      const ajena = await consultar(otra.token, escenario.homeVisitId).expect(404);
      const inexistente = await consultar(otra.token, randomUUID()).expect(404);

      expect(ajena.body).toStrictEqual(inexistente.body);
      expect(ajena.body.code).toBe('HOME_VISIT_NOT_FOUND');
      // El 404 no describe la asignación ni nombra a nadie.
      expect(JSON.stringify(ajena.body)).not.toContain(escenario.profesional.professionalId);
    });

    it('una visita de otra institución es indistinguible de una inexistente', async () => {
      const escenario = await visitaMaterializada();
      const ajena = await visitaDelOtroTenant();

      const deOtroTenant = await consultar(
        escenario.profesional.token,
        ajena.homeVisitId,
      ).expect(404);
      const inexistente = await consultar(
        escenario.profesional.token,
        randomUUID(),
      ).expect(404);

      expect(deOtroTenant.body).toStrictEqual(inexistente.body);
    });

    it('un identificador mal formado se rechaza en el borde', async () => {
      const escenario = await visitaMaterializada();

      const respuesta = await consultar(escenario.profesional.token, 'no-es-uuid').expect(400);

      expect(respuesta.body.code).toBe('VISITS_INVALID_PATH');
    });

    it('perfil inactivo, afiliación terminada y asignación terminada deniegan', async () => {
      const perfilInactivo = await visitaMaterializada();
      await prisma.professionalProfile.update({
        where: { id: perfilInactivo.profesional.professionalId },
        data: { status: 'INACTIVE' },
      });

      await consultar(
        perfilInactivo.profesional.token,
        perfilInactivo.homeVisitId,
      ).expect(404);

      const afiliacionTerminada = await visitaMaterializada();
      const vinculo = await prisma.professionalAffiliation.findFirst({
        where: { professionalId: afiliacionTerminada.profesional.professionalId },
        select: { id: true, startsOn: true },
      });

      if (vinculo === null) {
        throw new Error('La afiliación sembrada no existe.');
      }

      await prisma.professionalAffiliation.update({
        where: { id: vinculo.id },
        /*
         * La base exige fecha de fin exactamente cuando el vínculo terminó, y
         * `professional_affiliation_period_order` exige además que no preceda a
         * su inicio: se termina el MISMO día en que empezó.
         */
        data: { status: 'ENDED', endsOn: vinculo.startsOn },
      });

      await consultar(
        afiliacionTerminada.profesional.token,
        afiliacionTerminada.homeVisitId,
      ).expect(404);

      const asignacionTerminada = await visitaMaterializada();
      await prisma.careAssignment.update({
        where: { id: asignacionTerminada.careAssignmentId },
        data: { status: 'ENDED', endsAt: new Date(Date.UTC(2026, 7, 2, 0, 0, 0)) },
      });

      await consultar(
        asignacionTerminada.profesional.token,
        asignacionTerminada.homeVisitId,
      ).expect(404);
    });
  });

  /* ====================================================================== */
  /* C · Transiciones profesionales                                          */
  /* ====================================================================== */

  describe('C · PATCH /api/v1/professional/visits/:visitId/status', () => {
    it('ejecuta START y COMPLETE con la versión vigente', async () => {
      const escenario = await visitaMaterializada();
      const { token } = escenario.profesional;

      const inicio = await transicionar(token, escenario.homeVisitId, {
        status: 'IN_PROGRESS',
        expectedVersion: 1,
      }).expect(200);

      expect(Object.keys(inicio.body).sort()).toStrictEqual([
        'fromStatus',
        'homeVisitId',
        'occurredAt',
        'toStatus',
        'transitionId',
        'version',
      ]);
      expect(inicio.body).toMatchObject({
        homeVisitId: escenario.homeVisitId,
        fromStatus: 'SCHEDULED',
        toStatus: 'IN_PROGRESS',
        version: 2,
      });
      exigirNoCache(inicio);

      const cierre = await transicionar(token, escenario.homeVisitId, {
        status: 'COMPLETED',
        expectedVersion: 2,
      }).expect(200);

      expect(cierre.body).toMatchObject({
        fromStatus: 'IN_PROGRESS',
        toStatus: 'COMPLETED',
        version: 3,
      });

      // La lectura refleja el mismo estado, con sus instantes ya fijados.
      const leida = await consultar(token, escenario.homeVisitId).expect(200);

      expect(leida.body.status).toBe('COMPLETED');
      expect(leida.body.version).toBe(3);
      expect(leida.body.startedAt).not.toBeNull();
      expect(leida.body.endedAt).not.toBeNull();

      /*
       * El historial es APPEND-ONLY y atribuye cada transición a la CUENTA
       * HUMANA autenticada, que el cliente nunca envió.
       */
      const historial = await prisma.homeVisitTransition.findMany({
        where: { homeVisitId: escenario.homeVisitId },
        orderBy: { occurredAt: 'asc' },
        select: { toStatus: true, performedByHumanAccountId: true },
      });

      expect(historial).toStrictEqual([
        { toStatus: 'SCHEDULED', performedByHumanAccountId: null },
        {
          toStatus: 'IN_PROGRESS',
          performedByHumanAccountId: escenario.profesional.humanAccountId,
        },
        {
          toStatus: 'COMPLETED',
          performedByHumanAccountId: escenario.profesional.humanAccountId,
        },
      ]);
    });

    it('ejecuta NOT_COMPLETED desde SCHEDULED sin registrar ninguna causa', async () => {
      const escenario = await visitaMaterializada();

      const respuesta = await transicionar(escenario.profesional.token, escenario.homeVisitId, {
        status: 'NOT_COMPLETED',
        expectedVersion: 1,
      }).expect(200);

      expect(respuesta.body).toMatchObject({
        fromStatus: 'SCHEDULED',
        toStatus: 'NOT_COMPLETED',
        version: 2,
      });

      const visita = await prisma.homeVisit.findUnique({
        where: { id: escenario.homeVisitId },
        select: { status: true, startedAt: true, endedAt: true },
      });

      // Una visita no realizada desde SCHEDULED conserva su inicio nulo.
      expect(visita?.status).toBe('NOT_COMPLETED');
      expect(visita?.startedAt).toBeNull();
      expect(visita?.endedAt).not.toBeNull();
    });

    it('rechaza la versión obsoleta y la transición ilegal o terminal con 409', async () => {
      const escenario = await visitaMaterializada();
      const { token } = escenario.profesional;

      // Versión que no es la vigente.
      const version = await transicionar(token, escenario.homeVisitId, {
        status: 'IN_PROGRESS',
        expectedVersion: 7,
      }).expect(409);

      expect(version.body.code).toBe('HOME_VISIT_VERSION_CONFLICT');
      // El desenlace NO revela la versión real de la visita.
      expect(version.body.message).not.toContain('1');

      // Transición ILEGAL: no se completa lo que no se ha iniciado.
      const ilegal = await transicionar(token, escenario.homeVisitId, {
        status: 'COMPLETED',
        expectedVersion: 1,
      }).expect(409);

      expect(ilegal.body.code).toBe('HOME_VISIT_TRANSITION_NOT_ALLOWED');

      // Estado TERMINAL: no hay reapertura, reversión ni cancelación.
      await transicionar(token, escenario.homeVisitId, {
        status: 'NOT_COMPLETED',
        expectedVersion: 1,
      }).expect(200);

      const terminal = await transicionar(token, escenario.homeVisitId, {
        status: 'IN_PROGRESS',
        expectedVersion: 2,
      }).expect(409);

      expect(terminal.body.code).toBe('HOME_VISIT_TRANSITION_NOT_ALLOWED');
    });

    it('otra profesional no transiciona y no distingue la visita de una inexistente', async () => {
      const escenario = await visitaMaterializada();
      const otra = await profesionalAutenticada();

      const ajena = await transicionar(otra.token, escenario.homeVisitId, {
        status: 'IN_PROGRESS',
        expectedVersion: 1,
      }).expect(404);

      const inexistente = await transicionar(otra.token, randomUUID(), {
        status: 'IN_PROGRESS',
        expectedVersion: 1,
      }).expect(404);

      expect(ajena.body).toStrictEqual(inexistente.body);
      expect(ajena.body.code).toBe('HOME_VISIT_NOT_FOUND');

      // Y la visita conserva intactos su estado y su versión.
      const visita = await prisma.homeVisit.findUnique({
        where: { id: escenario.homeVisitId },
        select: { status: true, version: true },
      });

      expect(visita).toMatchObject({ status: 'SCHEDULED', version: 1 });
    });

    it('exige un origen autorizado y no escribe cuando lo rechaza', async () => {
      const escenario = await visitaMaterializada();
      const cuerpo = { status: 'IN_PROGRESS', expectedVersion: 1 };
      const ruta = `${PROFESSIONAL_PATH}/${escenario.homeVisitId}/status`;

      const sinOrigen = await request(app.getHttpServer())
        .patch(ruta)
        .set('Cookie', `${HUMAN_COOKIE}=${escenario.profesional.token}`)
        .send(cuerpo)
        .expect(403);

      expect(sinOrigen.body.code).toBe('HUMAN_AUTH_ORIGIN_REJECTED');

      await request(app.getHttpServer())
        .patch(ruta)
        .set('Cookie', `${HUMAN_COOKIE}=${escenario.profesional.token}`)
        .set('Origin', ORIGEN_AJENO)
        .send(cuerpo)
        .expect(403);

      const visita = await prisma.homeVisit.findUnique({
        where: { id: escenario.homeVisitId },
        select: { status: true, version: true },
      });

      expect(visita).toMatchObject({ status: 'SCHEDULED', version: 1 });
    });

    it('rechaza estados, versiones y campos de autoridad no admitidos', async () => {
      const escenario = await visitaMaterializada();
      const { token } = escenario.profesional;

      const invalidos: readonly unknown[] = [
        undefined,
        [],
        {},
        { status: 'IN_PROGRESS' },
        { expectedVersion: 1 },
        // `SCHEDULED` es la CREACIÓN institucional, no un destino profesional.
        { status: 'SCHEDULED', expectedVersion: 1 },
        { status: 'CANCELLED', expectedVersion: 1 },
        { status: 'in_progress', expectedVersion: 1 },
        { status: 'IN_PROGRESS', expectedVersion: 0 },
        { status: 'IN_PROGRESS', expectedVersion: -1 },
        { status: 'IN_PROGRESS', expectedVersion: 1.5 },
        { status: 'IN_PROGRESS', expectedVersion: '1' },
        // Campos que fija el SERVIDOR y que el navegador no puede aportar.
        {
          status: 'IN_PROGRESS',
          expectedVersion: 1,
          professionalId: escenario.profesional.professionalId,
        },
        { status: 'IN_PROGRESS', expectedVersion: 1, patientId: escenario.patientId },
        { status: 'IN_PROGRESS', expectedVersion: 1, tenantId },
        {
          status: 'IN_PROGRESS',
          expectedVersion: 1,
          humanAccountId: escenario.profesional.humanAccountId,
        },
        { status: 'IN_PROGRESS', expectedVersion: 1, occurredAt: '2026-08-24T16:00:00.000Z' },
        { status: 'NOT_COMPLETED', expectedVersion: 1, reason: 'PACIENTE_AUSENTE' },
      ];

      for (const cuerpo of invalidos) {
        const respuesta = await transicionar(token, escenario.homeVisitId, cuerpo).expect(400);

        expect(respuesta.body.code).toBe('VISITS_INVALID_BODY');
      }

      // Un identificador mal formado tampoco llega a la base.
      const ruta = await transicionar(token, 'no-es-uuid', {
        status: 'IN_PROGRESS',
        expectedVersion: 1,
      }).expect(400);

      expect(ruta.body.code).toBe('VISITS_INVALID_PATH');

      // Tras los DIECIOCHO rechazos, la visita sigue intacta.
      const visita = await prisma.homeVisit.findUnique({
        where: { id: escenario.homeVisitId },
        select: { status: true, version: true },
      });

      expect(visita).toMatchObject({ status: 'SCHEDULED', version: 1 });
    });
  });

  /* ====================================================================== */
  /* E · Worklist profesional (VISITADOR-CORE-01 MP01)                       */
  /* ====================================================================== */

  describe('E · GET /api/v1/professional/visits', () => {
    it('devuelve la cita asignada NO materializada con visit = null', async () => {
      const escenario = await citaAsignada();

      const respuesta = await listar(escenario.profesional.token, VENTANA).expect(200);

      expect(Object.keys(respuesta.body).sort()).toStrictEqual(['items', 'window']);
      expect(respuesta.body.window).toStrictEqual({ from: DIA, to: DIA });
      expect(respuesta.body.items).toHaveLength(1);

      const item = respuesta.body.items[0];

      expect(Object.keys(item).sort()).toStrictEqual([
        'appointmentId',
        'modality',
        'patient',
        'scheduledStart',
        'visit',
      ]);
      expect(item.appointmentId).toBe(escenario.appointmentId);
      expect(item.scheduledStart).toBe(HORARIO.toISOString());
      expect(item.modality).toBe('HOME');
      /*
       * `null` es la respuesta HONESTA de una cita que la agenda hospitalaria
       * todavía no materializó, y NO autoriza a la profesional a materializarla.
       */
      expect(item.visit).toBeNull();
      exigirNoCache(respuesta);
    });

    it('una cita ya materializada devuelve su estado y su versión REALES', async () => {
      const escenario = await visitaMaterializada();
      const { token } = escenario.profesional;

      const inicial = await listar(token, VENTANA).expect(200);

      expect(inicial.body.items).toHaveLength(1);
      expect(Object.keys(inicial.body.items[0].visit).sort()).toStrictEqual([
        'endedAt',
        'homeVisitId',
        'startedAt',
        'status',
        'updatedAt',
        'version',
      ]);
      expect(inicial.body.items[0].visit).toMatchObject({
        homeVisitId: escenario.homeVisitId,
        status: 'SCHEDULED',
        version: 1,
        startedAt: null,
        endedAt: null,
      });

      // La worklist REFLEJA la máquina de MP03; no la reimplementa.
      await transicionar(token, escenario.homeVisitId, {
        status: 'IN_PROGRESS',
        expectedVersion: 1,
      }).expect(200);

      const tras = await listar(token, VENTANA).expect(200);

      expect(tras.body.items[0].visit).toMatchObject({
        status: 'IN_PROGRESS',
        version: 2,
      });
      expect(tras.body.items[0].visit.startedAt).not.toBeNull();
      expect(tras.body.items[0].visit.endedAt).toBeNull();
    });

    it('sin sesión humana no hay worklist, y ninguna otra cookie la sustituye', async () => {
      const escenario = await citaAsignada();
      const ruta = `${PROFESSIONAL_PATH}${VENTANA}`;

      const sinCookie = await request(app.getHttpServer()).get(ruta).expect(401);

      expect(sinCookie.body.code).toBe('HUMAN_SESSION_REQUIRED');
      exigirNoCache(sinCookie);

      // La cookie INSTITUCIONAL no autentica a ninguna persona.
      await request(app.getHttpServer())
        .get(ruta)
        .set('Cookie', `${INSTITUTIONAL_COOKIE}=${cookieScheduler}`)
        .expect(401);

      await request(app.getHttpServer())
        .get(ruta)
        .set('Cookie', `${HUMAN_COOKIE}=${cookieScheduler}`)
        .expect(401);

      // Tampoco la de autoinscripción.
      await request(app.getHttpServer())
        .get(ruta)
        .set('Cookie', `${ENROLLMENT_COOKIE}=${escenario.profesional.token}`)
        .expect(401);
    });

    it('rechaza la ventana ausente, imposible, invertida, excesiva o con campos de autoridad', async () => {
      const escenario = await citaAsignada();
      const { token } = escenario.profesional;

      const invalidas: readonly string[] = [
        // Ventana ausente: no existe periodo por defecto.
        '',
        '?from=2026-08-24',
        '?to=2026-08-24',
        '?from=&to=2026-08-24',
        // Forma inválida y fecha inexistente en el calendario.
        '?from=24-08-2026&to=2026-08-24',
        '?from=2026-8-4&to=2026-08-24',
        '?from=2026-02-31&to=2026-03-01',
        '?from=2026-13-01&to=2026-13-02',
        // Ventana invertida y ventana mayor que el máximo inclusivo de 31 días.
        '?from=2026-08-25&to=2026-08-24',
        '?from=2026-08-01&to=2026-09-01',
        // Parámetro repetido: elegir uno de los dos valores sería inventar.
        '?from=2026-08-24&from=2026-08-25&to=2026-08-24',
        // Sintaxis de objeto anidado.
        '?from[x]=2026-08-24&to=2026-08-24',
        /*
         * Campos de AUTORIDAD que el SERVIDOR resuelve y que el navegador no
         * puede aportar. Ninguno figura en la allowlist, y su ausencia —no un
         * filtrado posterior— es la garantía.
         */
        `?from=${DIA}&to=${DIA}&tenantId=${tenantId}`,
        `?from=${DIA}&to=${DIA}&professionalId=${escenario.profesional.professionalId}`,
        `?from=${DIA}&to=${DIA}&patientId=${escenario.patientId}`,
        `?from=${DIA}&to=${DIA}&careAssignmentId=${escenario.careAssignmentId}`,
        `?from=${DIA}&to=${DIA}&personId=${escenario.profesional.personId}`,
        `?from=${DIA}&to=${DIA}&humanAccountId=${escenario.profesional.humanAccountId}`,
        `?from=${DIA}&to=${DIA}&identityId=${identidadSchedulerId}`,
        `?from=${DIA}&to=${DIA}&status=SCHEDULED`,
        `?from=${DIA}&to=${DIA}&modality=HOME`,
        `?from=${DIA}&to=${DIA}&role=HOSPITAL_SCHEDULER`,
        `?from=${DIA}&to=${DIA}&now=2026-08-24T16:00:00.000Z`,
      ];

      for (const consulta of invalidas) {
        const respuesta = await listar(token, consulta).expect(400);

        expect(respuesta.body.code).toBe('VISITS_INVALID_QUERY');
        expect(Object.keys(respuesta.body).sort()).toStrictEqual(['code', 'message']);
        /*
         * El mensaje nombra el parámetro y la regla; NUNCA devuelve el valor
         * recibido, de modo que un identificador fabricado no vuelve al cliente.
         */
        for (const valor of [
          tenantId,
          escenario.patientId,
          escenario.careAssignmentId,
          escenario.profesional.professionalId,
          escenario.profesional.personId,
          escenario.profesional.humanAccountId,
          identidadSchedulerId,
        ]) {
          expect(respuesta.body.message).not.toContain(valor);
        }
      }

      // Y la ventana límite de 31 días inclusive SÍ se admite.
      await listar(token, '?from=2026-08-01&to=2026-08-31').expect(200);
    });

    it('una persona sin perfil profesional recibe una lista VACÍA, no un 403', async () => {
      // Existe agenda REAL en el tenant, pero no es suya.
      await citaAsignada();

      const sinPerfil = await personaAutenticadaSinPerfil();

      const respuesta = await listar(sinPerfil.token, VENTANA).expect(200);

      /*
       * Vacío y `200`. Un `403` distinguiría «no eres profesional» de «no tienes
       * citas» y permitiría enumerar quién es profesional operativo.
       */
      expect(respuesta.body.items).toStrictEqual([]);
      expect(respuesta.body.window).toStrictEqual({ from: DIA, to: DIA });
    });

    it('perfil inactivo, afiliación ausente, futura o vencida vacían la lista', async () => {
      const perfilInactivo = await citaAsignada();
      await prisma.professionalProfile.update({
        where: { id: perfilInactivo.profesional.professionalId },
        data: { status: 'INACTIVE' },
      });

      expect(
        (await listar(perfilInactivo.profesional.token, VENTANA).expect(200)).body.items,
      ).toStrictEqual([]);

      // Afiliación AUSENTE: un perfil sin vínculo no es profesional operativo.
      const sinAfiliacion = await citaAsignada();
      await prisma.professionalAffiliation.deleteMany({
        where: { professionalId: sinAfiliacion.profesional.professionalId },
      });

      expect(
        (await listar(sinAfiliacion.profesional.token, VENTANA).expect(200)).body.items,
      ).toStrictEqual([]);

      // Afiliación TERMINADA.
      const terminada = await citaAsignada();
      const vinculoTerminado = await afiliacionDe(terminada.profesional.professionalId);
      await prisma.professionalAffiliation.update({
        where: { id: vinculoTerminado.id },
        /*
         * La base exige fecha de fin exactamente cuando el vínculo terminó, y
         * `professional_affiliation_period_order` exige además que no preceda a
         * su inicio: se termina el MISMO día en que empezó.
         */
        data: { status: 'ENDED', endsOn: vinculoTerminado.startsOn },
      });

      expect(
        (await listar(terminada.profesional.token, VENTANA).expect(200)).body.items,
      ).toStrictEqual([]);

      // Afiliación ACTIVE cuya vigencia todavía NO ha empezado.
      const futura = await citaAsignada();
      const vinculoFuturo = await afiliacionDe(futura.profesional.professionalId);
      await prisma.professionalAffiliation.update({
        where: { id: vinculoFuturo.id },
        data: { startsOn: new Date(Date.UTC(2099, 0, 1)) },
      });

      expect(
        (await listar(futura.profesional.token, VENTANA).expect(200)).body.items,
      ).toStrictEqual([]);

      // Asignación de cuidado TERMINADA.
      const asignacionTerminada = await citaAsignada();
      await prisma.careAssignment.update({
        where: { id: asignacionTerminada.careAssignmentId },
        data: { status: 'ENDED', endsAt: new Date(Date.UTC(2026, 7, 2, 0, 0, 0)) },
      });

      expect(
        (await listar(asignacionTerminada.profesional.token, VENTANA).expect(200)).body.items,
      ).toStrictEqual([]);
    });

    it('no aparece la agenda de otra profesional, otro paciente ni otra institución', async () => {
      const propia = await citaAsignada();
      const ajena = await citaAsignada();
      const otroTenant = await citaDelOtroTenant();

      const respuesta = await listar(propia.profesional.token, VENTANA).expect(200);

      expect(respuesta.body.items.map((item: { appointmentId: string }) => item.appointmentId))
        .toStrictEqual([propia.appointmentId]);

      const serializada = JSON.stringify(respuesta.body);

      for (const prohibido of [
        ajena.appointmentId,
        ajena.patientId,
        ajena.careAssignmentId,
        ajena.profesional.professionalId,
        otroTenant.appointmentId,
        otroTenant.patientId,
        otroTenant.careAssignmentId,
        otroTenant.professionalId,
        otroTenantId,
      ]) {
        expect(serializada).not.toContain(prohibido);
      }

      // Y en sentido inverso: cada quien ve EXCLUSIVAMENTE la suya.
      const inversa = await listar(ajena.profesional.token, VENTANA).expect(200);

      expect(inversa.body.items.map((item: { appointmentId: string }) => item.appointmentId))
        .toStrictEqual([ajena.appointmentId]);
    });

    it('solo aparecen citas HOME, ASSIGNED y dentro de la ventana', async () => {
      const escenario = await citaAsignada();

      // Misma asignación, misma ventana, pero modalidad y estado distintos.
      await citaDe(escenario, HORARIO, { modality: 'VIRTUAL' });
      await citaDe(escenario, HORARIO, { modality: 'ON_SITE' });
      await citaDe(escenario, HORARIO, { status: 'CANCELLED' });
      // Misma asignación y modalidad, pero FUERA de la ventana.
      await citaDe(escenario, new Date(Date.UTC(2026, 7, 23, 23, 59, 59, 999)));
      await citaDe(escenario, new Date(Date.UTC(2026, 7, 25, 0, 0, 0, 0)));

      const respuesta = await listar(escenario.profesional.token, VENTANA).expect(200);

      expect(respuesta.body.items.map((item: { appointmentId: string }) => item.appointmentId))
        .toStrictEqual([escenario.appointmentId]);
    });

    it('la ventana incluye sus dos límites UTC completos', async () => {
      const escenario = await citaAsignada();

      const primerInstante = await citaDe(escenario, new Date(Date.UTC(2026, 7, 24, 0, 0, 0, 0)));
      const ultimoInstante = await citaDe(
        escenario,
        new Date(Date.UTC(2026, 7, 24, 23, 59, 59, 999)),
      );

      const respuesta = await listar(escenario.profesional.token, VENTANA).expect(200);

      /*
       * Orden ESTABLE por `scheduledStart` ascendente. La cota superior es
       * EXCLUSIVA sobre el día siguiente, de modo que el último milisegundo del
       * día `to` entra y no se pierde por un redondeo.
       */
      expect(respuesta.body.items.map((item: { appointmentId: string }) => item.appointmentId))
        .toStrictEqual([primerInstante, escenario.appointmentId, ultimoInstante]);
    });

    it('el orden es estable y desempata por identificador de cita', async () => {
      const escenario = await citaAsignada();

      // DOS citas en el MISMO instante: el desempate no puede ser arbitrario.
      const gemelaA = await citaDe(escenario, HORARIO);
      const gemelaB = await citaDe(escenario, HORARIO);

      const esperado = [escenario.appointmentId, gemelaA, gemelaB].sort((a, b) =>
        a < b ? -1 : 1,
      );

      const primera = await listar(escenario.profesional.token, VENTANA).expect(200);
      const segunda = await listar(escenario.profesional.token, VENTANA).expect(200);

      expect(primera.body.items.map((item: { appointmentId: string }) => item.appointmentId))
        .toStrictEqual(esperado);
      expect(segunda.body.items).toStrictEqual(primera.body.items);
    });

    it('la respuesta es MINIMIZADA: sin identificadores internos ni datos personales', async () => {
      const escenario = await visitaMaterializada();

      const persona = await prisma.patient.findUniqueOrThrow({
        where: { id: escenario.patientId },
        select: {
          person: {
            select: {
              id: true,
              documentNumber: true,
              givenNames: true,
              familyNames: true,
              birthDate: true,
            },
          },
        },
      });

      const respuesta = await listar(escenario.profesional.token, VENTANA).expect(200);
      const item = respuesta.body.items[0];

      // El paciente se reduce a lo que permite reconocerlo en la propia agenda.
      expect(Object.keys(item.patient).sort()).toStrictEqual(['displayName', 'initials']);
      expect(item.patient.displayName).toBe(
        `${persona.person.givenNames} ${persona.person.familyNames}`,
      );
      expect(item.patient.initials).toBe('PE');

      const serializada = JSON.stringify(respuesta.body);

      for (const prohibido of [
        tenantId,
        escenario.patientId,
        escenario.careAssignmentId,
        escenario.profesional.professionalId,
        escenario.profesional.personId,
        escenario.profesional.humanAccountId,
        persona.person.id,
        persona.person.documentNumber,
        identidadSchedulerId,
        '1960-06-15',
      ]) {
        expect(serializada).not.toContain(prohibido);
      }

      // Ni un solo nombre de campo prohibido, en ningún nivel de la respuesta.
      for (const campo of [
        'tenantId',
        'patientId',
        'professionalId',
        'careAssignmentId',
        'personId',
        'humanAccountId',
        'createdByInstitutionalIdentityId',
        'documentNumber',
        'birthDate',
        'phone',
        'email',
        'address',
        'transitions',
      ]) {
        expect(serializada).not.toContain(`"${campo}"`);
      }
    });

    it('el contrato OpenAPI de la ruta no declara ningún campo prohibido', () => {
      const documento = buildOpenApiDocument(app);
      const operacion = documento.paths['/api/v1/professional/visits']?.get;

      if (operacion === undefined) {
        throw new Error('La worklist profesional no figura en el documento OpenAPI.');
      }

      expect(operacion.operationId).toBe('listProfessionalVisitWorklist');

      // La consulta declara EXACTAMENTE dos parámetros, ambos obligatorios.
      const parametros = (operacion.parameters ?? []) as readonly {
        readonly name: string;
        readonly in: string;
        readonly required?: boolean;
      }[];

      expect(parametros.map((parametro) => parametro.name).sort()).toStrictEqual(['from', 'to']);

      for (const parametro of parametros) {
        expect(parametro.in).toBe('query');
        expect(parametro.required).toBe(true);
      }

      const esquemas = documento.components?.schemas ?? {};
      const propiedadesDe = (nombre: string): readonly string[] => {
        const esquema = esquemas[nombre] as { properties?: Record<string, unknown> } | undefined;

        if (esquema?.properties === undefined) {
          throw new Error(`El esquema «${nombre}» no figura en el documento OpenAPI.`);
        }

        return Object.keys(esquema.properties).sort();
      };

      expect(propiedadesDe('ProfessionalVisitWorklistDto')).toStrictEqual(['items', 'window']);
      expect(propiedadesDe('ProfessionalWorklistWindowDto')).toStrictEqual(['from', 'to']);
      expect(propiedadesDe('ProfessionalWorklistItemDto')).toStrictEqual([
        'appointmentId',
        'modality',
        'patient',
        'scheduledStart',
        'visit',
      ]);
      expect(propiedadesDe('ProfessionalWorklistPatientDto')).toStrictEqual([
        'displayName',
        'initials',
      ]);
      expect(propiedadesDe('ProfessionalWorklistVisitDto')).toStrictEqual([
        'endedAt',
        'homeVisitId',
        'startedAt',
        'status',
        'updatedAt',
        'version',
      ]);
    });
  });

  /* ====================================================================== */
  /* D · Fail-closed                                                         */
  /* ====================================================================== */

  describe('D · contexto de ejecución no confirmado', () => {
    it('las cuatro operaciones responden 503 sin describir la topología', async () => {
      const escenario = await visitaMaterializada();
      const { token } = escenario.profesional;
      const servidor = appSinContexto.getHttpServer();

      const respuestas = [
        await request(servidor)
          .post(MATERIALIZE_PATH)
          .set('Cookie', `${INSTITUTIONAL_COOKIE}=${cookieScheduler}`)
          .set('Origin', ORIGEN_AUTORIZADO)
          .send({ appointmentId: escenario.appointmentId })
          .expect(503),
        await request(servidor)
          .get(`${PROFESSIONAL_PATH}/${escenario.homeVisitId}`)
          .set('Cookie', `${HUMAN_COOKIE}=${token}`)
          .expect(503),
        await request(servidor)
          .get(`${PROFESSIONAL_PATH}${VENTANA}`)
          .set('Cookie', `${HUMAN_COOKIE}=${token}`)
          .expect(503),
        await request(servidor)
          .patch(`${PROFESSIONAL_PATH}/${escenario.homeVisitId}/status`)
          .set('Cookie', `${HUMAN_COOKIE}=${token}`)
          .set('Origin', ORIGEN_AUTORIZADO)
          .send({ status: 'IN_PROGRESS', expectedVersion: 1 })
          .expect(503),
      ];

      for (const respuesta of respuestas) {
        expect(respuesta.body.code).toBe('VISITS_SERVICE_UNAVAILABLE');
        // El cuerpo es EXACTAMENTE el contrato: ni traza, ni causa, ni detalle.
        expect(Object.keys(respuesta.body).sort()).toStrictEqual(['code', 'message']);

        const serializada = JSON.stringify(respuesta.body);

        // Ni traza, ni SQL, ni cadena de conexión, ni identificadores internos.
        for (const filtracion of [
          'postgres',
          'prisma',
          'SELECT',
          'merdn_runtime',
          'DATABASE_URL',
          'at Object',
          tenantId,
        ]) {
          expect(serializada).not.toContain(filtracion);
        }
      }

      // Fail-closed: NADA se escribió mientras el contexto no se confirmaba.
      const visita = await prisma.homeVisit.findUnique({
        where: { id: escenario.homeVisitId },
        select: { status: true, version: true },
      });

      expect(visita).toMatchObject({ status: 'SCHEDULED', version: 1 });
    });
  });

  /* ====================================================================== */
  /* Siembra del OTRO tenant                                                 */
  /* ====================================================================== */

  /** Cita `HOME` ya `ASSIGNED` de OTRA institución. Nunca visible desde esta. */
  async function citaDelOtroTenant(): Promise<{
    readonly appointmentId: string;
    readonly careAssignmentId: string;
    readonly patientId: string;
    readonly professionalId: string;
  }> {
    const paciente = await crearPacienteFicticio(prisma, otroTenantId);
    sembrado.pacientes.add(paciente.patientId);
    sembrado.personas.add(paciente.personId);

    const profesional = await crearProfesionalFicticio(prisma, otroTenantId);
    sembrado.profesionales.add(profesional.professionalId);
    sembrado.personas.add(profesional.personId);

    const cita = await crearCitaAsignada(prisma, {
      tenantId: otroTenantId,
      patientId: paciente.patientId,
      professionalId: profesional.professionalId,
      identityId: identidadOtroTenantId,
      modality: 'HOME',
      scheduledStart: HORARIO,
    });
    sembrado.citas.add(cita.appointmentId);
    sembrado.asignaciones.add(cita.careAssignmentId);

    return {
      ...cita,
      patientId: paciente.patientId,
      professionalId: profesional.professionalId,
    };
  }

  /**
   * Visita ya materializada en el OTRO tenant.
   *
   * Se siembra DIRECTAMENTE porque la API institucional solo alcanza el tenant
   * de su propia sesión: esa imposibilidad es precisamente lo que se verifica.
   * El trigger `home_visit_guard` de MP01 sigue validando la fila.
   */
  async function visitaDelOtroTenant(): Promise<{ readonly homeVisitId: string }> {
    const cita = await citaDelOtroTenant();

    const visita = await prisma.homeVisit.create({
      data: {
        tenantId: otroTenantId,
        appointmentId: cita.appointmentId,
        patientId: cita.patientId,
        careAssignmentId: cita.careAssignmentId,
        status: 'SCHEDULED',
        createdByInstitutionalIdentityId: identidadOtroTenantId,
      },
      select: { id: true },
    });

    sembrado.visitas.add(visita.id);

    return { homeVisitId: visita.id };
  }
});
