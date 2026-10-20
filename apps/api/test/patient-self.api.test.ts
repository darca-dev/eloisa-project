/*
 * Aprovisionamiento FICTICIO del entorno. Debe quedar definido ANTES de
 * importar la aplicación: el módulo humano lee su configuración UNA sola vez,
 * al construirse, y sin ella la superficie humana queda deshabilitada y el
 * guard denegaría SIEMPRE, con lo que ninguna prueba de esta suite probaría
 * nada.
 *
 * TODAS las credenciales son ficticias, locales y no coinciden con ninguna
 * credencial real ni desplegada. El descubrimiento OIDC NO se ejecuta en estas
 * pruebas, que no llegan a tocar el proveedor: las sesiones humanas se siembran
 * directamente, que es lo que persistiría el aprovisionamiento administrativo.
 *
 * Las credenciales INSTITUCIONALES se dejan deliberadamente SIN definir: la
 * superficie self-scope del Paciente no las usa, y aprovisionarlas crearía
 * identidades institucionales autenticables que esta suite no necesita.
 */
process.env['MERDN_HUMAN_AUTH_ISSUER'] =
  'http://host.docker.internal:8081/realms/merdn-local';
process.env['MERDN_HUMAN_AUTH_CLIENT_ID'] = 'merdn-human-web';
process.env['MERDN_HUMAN_AUTH_CALLBACK_URI'] =
  'http://127.0.0.1:3001/api/v1/human-auth/callback';
process.env['MERDN_HUMAN_AUTH_ATTEMPT_KEY'] = 'd'.repeat(64);

import { randomBytes } from 'node:crypto';

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';

import { AppModule } from '../src/app.module';
import { RuntimeContextUnavailableError } from '../src/database/runtime-context.error';
import { type PrismaClient } from '../src/generated/prisma/client';
import { HUMAN_SESSION_IDLE_SECONDS } from '../src/human-auth/human-auth.contract';
import {
  PATIENT_SELF_ERROR_CODES,
  PATIENT_SELF_LABEL,
} from '../src/patient-self/patient-self.contract';
import { PatientSelfService } from '../src/patient-self/patient-self.service';
import { MalformedJsonFilter } from '../src/patients/malformed-json.filter';

import { createTestPrismaClient, unavailableBanner } from './database-availability';
import { ensureOtherTenant, nextTestDocument } from './enrollment-fixtures';
import {
  crearCuentaHumana,
  crearPersona,
  crearSesionHumana,
} from './identity-relationships-fixtures';

/**
 * Superficie self-scope del Paciente, de extremo a extremo contra la
 * aplicación NestJS REAL y PostgreSQL REAL (spec 021, paquetes 2 y 3;
 * `contracts/paciente-self-scope.contract.md`).
 *
 * COMPLEMENTA, NO REPITE, a `src/patient-self/patient-self.service.test.ts`:
 * aquella verifica el dominio con dobles de prueba; esta verifica el BORDE, es
 * decir que la aplicación completa —guard de sesión humana real, resolución
 * server-side del sujeto real, consultas reales bajo `withTenant`, auditoría
 * real— se comporta como el contrato exige cuando los datos existen de verdad.
 *
 * ALCANCE EXACTO (T5.1 a T5.6-b):
 *
 *   1. las TRES rutas responden `200` a la persona autenticada con
 *      participación de paciente ACTIVA, y a nadie más;
 *   2. `401` INDISTINGUIBLE ante ausencia, malformación, caducidad absoluta,
 *      caducidad por inactividad, revocación, cuenta deshabilitada, vínculo
 *      desvinculado y sesión de otro tenant;
 *   3. `403` UNIFORME con sesión humana y sin contexto `PATIENT`, sin revelar
 *      si existe paciente asociado;
 *   4. `503` fail-closed cuando el contexto de ejecución seguro no se confirma,
 *      y NUNCA una lista vacía;
 *   5. IDOR: `patientId`, `personId`, `subject`, `tenantId` y equivalentes en
 *      consulta, cuerpo o cabecera producen una respuesta IDÉNTICA a la
 *      petición limpia; el sujeto lo resuelve SIEMPRE el servidor;
 *   6. aislamiento entre dos pacientes del MISMO tenant: ninguno observa las
 *      citas ni las visitas del otro;
 *   7. conjunto de campos CERRADO por igualdad de conjunto en las tres
 *      respuestas, y ausencia total de PII y de contenido de terceros;
 *   8. auditoría: `GRANTED` cuando corresponde, `DENIED` cuando hay principal
 *      humano resoluble, ninguno cuando no lo hay, con `resourceType` y
 *      `endpoint` correctos y sin PII.
 *
 * NO implementa funcionalidad nueva y NO modifica código productivo: es
 * exclusivamente evidencia.
 *
 * TODAS las personas, pacientes, cuentas, citas y visitas son FICTICIAS.
 * Ninguna prueba usa datos reales de salud. Los documentos usan el prefijo
 * reservado de la suite, de modo que la limpieza los retira sin tocar nada más.
 *
 * LIMPIEZA ACOTADA: se retiran EXCLUSIVAMENTE las filas cuyos identificadores
 * esta prueba registró al sembrarlas. `audit_event` es append-only y NO se
 * borra NUNCA: su acumulación es, en sí misma, evidencia de la garantía.
 */

const BASE_PATH = '/api/v1/patient-self';
const SUMMARY_PATH = `${BASE_PATH}/summary`;
const APPOINTMENTS_PATH = `${BASE_PATH}/appointments`;
const VISITS_PATH = `${BASE_PATH}/visits`;

const RUTAS = [SUMMARY_PATH, APPOINTMENTS_PATH, VISITS_PATH] as const;

const HUMAN_COOKIE = 'merdn_human_session';

/**
 * Código de la identidad institucional FICTICIA que figura como creadora de las
 * asignaciones y materializadora de las visitas sembradas.
 *
 * NO contiene la subcadena «pruebas» a propósito: la limpieza común de
 * identidades institucionales borra por esa subcadena, y estas filas la
 * referencian con clave foránea `RESTRICT`. Se retira desde esta misma suite.
 *
 * La derivación almacenada es ALEATORIA y no corresponde a ninguna credencial:
 * nadie —tampoco esta prueba— puede autenticarse con esta identidad. Existe
 * únicamente porque la base exige un actor institucional al que atribuir la
 * asignación y la materialización.
 */
const CODIGO_IDENTIDAD_FICTICIA = 'patient-self-mp3-identidad-ficticia';

const availability = inject('databaseAvailability');
const puedeEjecutarse = availability.available && availability.migrated;

if (!puedeEjecutarse) {
  // eslint-disable-next-line no-console
  console.warn(`\n${unavailableBanner(availability)}\n`);
}

/**
 * Rol runtime EFECTIVO en esta ejecución.
 *
 * Cuando el entorno aporta una credencial de ejecución separada y el motor es
 * un servidor PostgreSQL, la aplicación corre bajo `merdn_runtime` —sin
 * BYPASSRLS— y Row Level Security está vigente durante TODA esta suite. Si no,
 * se anuncia el modo degradado de forma inconfundible: el aislamiento por BASE
 * DE DATOS no queda verificado AQUÍ, y su evidencia vive en
 * `patient-self.db.test.ts`, que construye su propio contexto.
 */
const rolRuntimeAplicado =
  availability.engine === 'postgresql-server' &&
  process.env['RUNTIME_DATABASE_URL'] !== undefined;

if (puedeEjecutarse && !rolRuntimeAplicado) {
  process.env['MERDN_RUNTIME_ROLE'] = 'disabled';
  // eslint-disable-next-line no-console
  console.warn(
    '\nAVISO: las pruebas de la API self-scope del Paciente se ejecutan con ' +
      'MERDN_RUNTIME_ROLE=disabled porque no hay credencial de ejecución separada ' +
      'o el motor no sostiene Row Level Security bajo el rol runtime. El ' +
      'aislamiento por BASE DE DATOS no queda verificado en esta ejecución; la ' +
      'autorización server-side y los filtros explícitos por tenant SÍ.\n',
  );
}

/** Persona ficticia sembrada, con o sin participación de paciente. */
interface PersonaSembrada {
  readonly personId: string;
  readonly humanAccountId: string;
  readonly externalAuthIdentityId: string;
  readonly documentNumber: string;
  /** Valor de la cookie de sesión humana. Solo existe en memoria. */
  readonly cookie: string;
}

interface PacienteSembrado extends PersonaSembrada {
  readonly patientId: string;
}

/** REGISTRO EXACTO de lo que esta prueba siembra. La limpieza retira ESTO. */
const sembrado = {
  visitas: new Set<string>(),
  citas: new Set<string>(),
  asignaciones: new Set<string>(),
  pacientes: new Set<string>(),
  profesionales: new Set<string>(),
  cuentas: new Set<string>(),
  personas: new Set<string>(),
  identidades: new Set<string>(),
};

describe.skipIf(!puedeEjecutarse)('API self-scope del Paciente', () => {
  let app: INestApplication;
  /** Aplicación GEMELA cuyo servicio self-scope falla el contexto seguro. */
  let appSinContexto: INestApplication;
  let prisma: PrismaClient;

  let tenantId: string;
  let otroTenantId: string;

  /** Paciente ACTIVO del tenant activo. Es el sujeto de las lecturas. */
  let paciente: PacienteSembrado;
  /** SEGUNDO paciente del MISMO tenant. Sus datos no deben filtrarse jamás. */
  let otroPaciente: PacienteSembrado;
  /** Persona con sesión humana y SIN participación de paciente. */
  let sinContextoPaciente: PersonaSembrada;
  /** Participación activa sin solicitud aprobada: nunca debe abrir self-scope. */
  let pacienteSinAprobacion: PacienteSembrado;
  /** Paciente del OTRO tenant, con sesión sembrada en SU tenant. */
  let pacienteOtroTenant: PacienteSembrado;

  /** Instantes deterministas relativos al arranque de la suite. */
  const ahora = new Date();
  const futuroCercano = new Date(ahora.getTime() + 2 * 60 * 60 * 1000);
  const futuroLejano = new Date(ahora.getTime() + 5 * 60 * 60 * 1000);
  const pasadoCercano = new Date(ahora.getTime() - 2 * 60 * 60 * 1000);
  const pasadoLejano = new Date(ahora.getTime() - 5 * 60 * 60 * 1000);

  beforeAll(async () => {
    prisma = createTestPrismaClient();

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
     * Gemela para el escenario FAIL-CLOSED. El guard sigue siendo el REAL y
     * valida la sesión contra la base: lo único sustituido es el servicio
     * self-scope, que rechaza con `RuntimeContextUnavailableError`. Es la única
     * forma de ejercitar por HTTP la traducción a `503` sin degradar la base
     * de la suite ni tocar código productivo.
     */
    const contextoRoto = {
      readSummary: () => Promise.reject(new RuntimeContextUnavailableError('prueba')),
      readAppointments: () => Promise.reject(new RuntimeContextUnavailableError('prueba')),
      readVisits: () => Promise.reject(new RuntimeContextUnavailableError('prueba')),
    };

    const moduleSinContexto = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PatientSelfService)
      .useValue(contextoRoto)
      .compile();

    appSinContexto = moduleSinContexto.createNestApplication();
    appSinContexto.useGlobalFilters(new MalformedJsonFilter());
    await appSinContexto.init();

    paciente = await sembrarPaciente(tenantId, 'Ana María');
    otroPaciente = await sembrarPaciente(tenantId, 'Beatriz Elena');
    sinContextoPaciente = await sembrarPersona(tenantId, 'Carmen Lucía');
    pacienteSinAprobacion = await sembrarPaciente(tenantId, 'Estela', false);
    pacienteOtroTenant = await sembrarPaciente(otroTenantId, 'Diana Sofía');

    await sembrarAgenda(tenantId, paciente.patientId);
    await sembrarAgenda(tenantId, otroPaciente.patientId);
    await sembrarAgenda(otroTenantId, pacienteOtroTenant.patientId);
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
      await prisma.$disconnect();
    }
  });

  /* ====================================================================== */
  /* Utilidades de siembra                                                   */
  /* ====================================================================== */

  /** Persona FICTICIA con cuenta humana y sesión vigente. Sin paciente. */
  async function sembrarPersona(
    tenant: string,
    nombres: string,
  ): Promise<PersonaSembrada> {
    const { personId, documentNumber } = await crearPersona(prisma, tenant, nombres);
    sembrado.personas.add(personId);

    const cuenta = await crearCuentaHumana(prisma, { tenantId: tenant, personId });
    sembrado.cuentas.add(cuenta.humanAccountId);

    const sesion = await crearSesionHumana(prisma, {
      tenantId: tenant,
      humanAccountId: cuenta.humanAccountId,
      externalAuthIdentityId: cuenta.bindingId,
    });

    return {
      personId,
      humanAccountId: cuenta.humanAccountId,
      externalAuthIdentityId: cuenta.bindingId,
      documentNumber,
      cookie: `${HUMAN_COOKIE}=${sesion.token}`,
    };
  }

  /** Persona FICTICIA con participación de paciente ACTIVA y sesión vigente. */
  async function sembrarPaciente(
    tenant: string,
    nombres: string,
    aprobada = true,
  ): Promise<PacienteSembrado> {
    const persona = await sembrarPersona(tenant, nombres);

    const patient = await prisma.patient.create({
      data: {
        tenantId: tenant,
        personId: persona.personId,
        epsCode: 'NUEVA_EPS',
        epsNameControlled: 'Nueva EPS',
        origin: 'PUBLIC_SELF_ENROLLMENT',
      },
      select: { id: true },
    });

    sembrado.pacientes.add(patient.id);

    if (aprobada) {
      await prisma.accessRequest.create({
        data: {
          tenantId: tenant,
          personId: persona.personId,
          requestedProfile: 'PATIENT',
          status: 'APPROVED',
          provisioningStatus: 'SUCCEEDED',
          source: 'TEST_DATA',
          reference: `AR-${randomBytes(12).toString('hex').toUpperCase()}`,
          humanAccountId: persona.humanAccountId,
          externalAuthIdentityId: persona.externalAuthIdentityId,
        },
      });
    }

    return { ...persona, patientId: patient.id };
  }

  /** Identidad institucional OPACA y NO autenticable del tenant indicado. */
  async function identidadFicticia(tenant: string): Promise<string> {
    const existente = await prisma.institutionalIdentity.findFirst({
      where: { tenantId: tenant, code: CODIGO_IDENTIDAD_FICTICIA },
      select: { id: true },
    });

    if (existente !== null) {
      sembrado.identidades.add(existente.id);
      return existente.id;
    }

    const creada = await prisma.institutionalIdentity.create({
      data: {
        tenantId: tenant,
        code: CODIGO_IDENTIDAD_FICTICIA,
        role: 'HOSPITAL_SCHEDULER',
        status: 'ACTIVE',
        // Forma exigida por `institutional_identity_secret_shape`: 128 y 32
        // caracteres hexadecimales. Contenido aleatorio y sin preimagen.
        accessSecretHash: randomBytes(64).toString('hex'),
        accessSecretSalt: randomBytes(16).toString('hex'),
      },
      select: { id: true },
    });

    sembrado.identidades.add(creada.id);
    return creada.id;
  }

  /**
   * Agenda ficticia del paciente: dos citas FUTURAS, una PASADA, una
   * CANCELADA, una SOLICITUD sin horario y dos visitas domiciliarias.
   *
   * Se siembra la misma forma para cada paciente, de modo que si una respuesta
   * filtrara filas ajenas la diferencia sería observable por conteo y por
   * horario, y no solo por identificador —que la superficie no devuelve—.
   */
  async function sembrarAgenda(tenant: string, patientId: string): Promise<void> {
    const identityId = await identidadFicticia(tenant);

    const documentoProfesional = nextTestDocument();

    const profesional = await prisma.person.create({
      data: {
        tenantId: tenant,
        documentType: 'CEDULA_CIUDADANIA',
        documentNumber: documentoProfesional,
        documentNumberNormalized: documentoProfesional,
        givenNames: 'Profesional',
        familyNames: 'Ejemplo Ficticio',
        birthDate: new Date(Date.UTC(1985, 0, 1)),
        sexGenderCode: 'PREFIERE_NO_DECIRLO',
      },
      select: { id: true },
    });

    sembrado.personas.add(profesional.id);

    const perfil = await prisma.professionalProfile.create({
      data: {
        tenantId: tenant,
        personId: profesional.id,
        professionCode: 'MEDICINA_GENERAL',
        professionNameControlled: 'Medicina general',
        status: 'ACTIVE',
      },
      select: { id: true },
    });

    sembrado.profesionales.add(perfil.id);

    const asignacion = await prisma.careAssignment.create({
      data: {
        tenantId: tenant,
        patientId,
        professionalId: perfil.id,
        role: 'PRIMARY',
        status: 'ACTIVE',
        startsAt: pasadoLejano,
        createdByIdentityId: identityId,
      },
      select: { id: true },
    });

    sembrado.asignaciones.add(asignacion.id);

    const crearCita = async (
      modality: 'ON_SITE' | 'HOME' | 'VIRTUAL',
      status: 'REQUESTED' | 'ASSIGNED' | 'CANCELLED',
      scheduledStart: Date | null,
    ): Promise<string> => {
      const cita = await prisma.appointment.create({
        data: {
          tenantId: tenant,
          patientId,
          // El CHECK `appointment_status_shape` exige asignación y horario
          // exactamente cuando la cita está `ASSIGNED`.
          careAssignmentId: status === 'ASSIGNED' ? asignacion.id : null,
          modality,
          status,
          requestedAt: pasadoLejano,
          scheduledStart,
        },
        select: { id: true },
      });

      sembrado.citas.add(cita.id);
      return cita.id;
    };

    // PRÓXIMAS: las dos únicas que la lectura de citas debe devolver.
    await crearCita('HOME', 'ASSIGNED', futuroCercano);
    await crearCita('VIRTUAL', 'ASSIGNED', futuroLejano);
    // Fuera de «próximas»: ya ocurrida.
    const citaPasada = await crearCita('HOME', 'ASSIGNED', pasadoCercano);
    // Fuera de «próximas»: sin horario programado.
    await crearCita('ON_SITE', 'REQUESTED', null);

    // Visita domiciliaria RECIENTE, materializada sobre la cita ya ocurrida.
    const visita = await prisma.homeVisit.create({
      data: {
        tenantId: tenant,
        appointmentId: citaPasada,
        patientId,
        careAssignmentId: asignacion.id,
        status: 'SCHEDULED',
        createdByInstitutionalIdentityId: identityId,
      },
      select: { id: true },
    });

    sembrado.visitas.add(visita.id);
  }

  /** Retira EXCLUSIVAMENTE lo sembrado, en el orden que exigen las FK. */
  async function retirarLoSembrado(cliente: PrismaClient): Promise<void> {
    const ids = (conjunto: ReadonlySet<string>): string[] => [...conjunto];

    if (sembrado.visitas.size > 0) {
      await cliente.homeVisitTransition.deleteMany({
        where: { homeVisitId: { in: ids(sembrado.visitas) } },
      });
      await cliente.homeVisit.deleteMany({ where: { id: { in: ids(sembrado.visitas) } } });
    }

    if (sembrado.citas.size > 0) {
      await cliente.appointment.deleteMany({ where: { id: { in: ids(sembrado.citas) } } });
    }

    if (sembrado.asignaciones.size > 0) {
      await cliente.careAssignment.deleteMany({
        where: { id: { in: ids(sembrado.asignaciones) } },
      });
    }

    if (sembrado.pacientes.size > 0) {
      await cliente.patient.deleteMany({ where: { id: { in: ids(sembrado.pacientes) } } });
    }

    if (sembrado.profesionales.size > 0) {
      await cliente.professionalAffiliation.deleteMany({
        where: { professionalId: { in: ids(sembrado.profesionales) } },
      });
      await cliente.professionalProfile.deleteMany({
        where: { id: { in: ids(sembrado.profesionales) } },
      });
    }

    if (sembrado.cuentas.size > 0) {
      await cliente.accessRequest.deleteMany({
        where: { humanAccountId: { in: ids(sembrado.cuentas) } },
      });
      await cliente.humanSession.deleteMany({
        where: { humanAccountId: { in: ids(sembrado.cuentas) } },
      });
      await cliente.externalAuthIdentity.deleteMany({
        where: { humanAccountId: { in: ids(sembrado.cuentas) } },
      });
      await cliente.humanAccount.deleteMany({ where: { id: { in: ids(sembrado.cuentas) } } });
    }

    if (sembrado.personas.size > 0) {
      await cliente.person.deleteMany({ where: { id: { in: ids(sembrado.personas) } } });
    }

    if (sembrado.identidades.size > 0) {
      await cliente.institutionalIdentity.deleteMany({
        where: { id: { in: ids(sembrado.identidades) } },
      });
    }

    for (const conjunto of Object.values(sembrado)) {
      conjunto.clear();
    }
  }

  /* ====================================================================== */
  /* Utilidades de petición                                                  */
  /* ====================================================================== */

  function pedir(ruta: string, cookie: string | null): request.Test {
    const peticion = request(app.getHttpServer()).get(ruta);

    return cookie === null ? peticion : peticion.set('Cookie', cookie);
  }

  interface RespuestaObservada {
    readonly status: number;
    readonly cuerpo: string;
  }

  /** Reduce una respuesta a lo ÚNICO que el cliente puede observar. */
  async function observar(
    ruta: string,
    cookie: string | null,
  ): Promise<RespuestaObservada> {
    const respuesta = await pedir(ruta, cookie);

    return { status: respuesta.status, cuerpo: JSON.stringify(respuesta.body) };
  }

  /* ====================================================================== */
  /* T5.1 — Las tres rutas responden a la persona autenticada                */
  /* ====================================================================== */

  describe('T5.1 — 200 con contexto PATIENT en cada una de las tres rutas', () => {
    it('el resumen devuelve el nombre de pila, las iniciales y la etiqueta fija', async () => {
      const respuesta = await pedir(SUMMARY_PATH, paciente.cookie).expect(200);

      expect(respuesta.body).toEqual({
        givenName: 'Ana',
        initials: 'AE',
        label: PATIENT_SELF_LABEL,
      });
    });

    it('las citas devuelven ÚNICAMENTE las próximas del paciente autenticado', async () => {
      const respuesta = await pedir(APPOINTMENTS_PATH, paciente.cookie).expect(200);
      const items = respuesta.body.items as { scheduledStart: string }[];

      // Dos futuras sembradas; la pasada, la cancelada y la solicitud sin
      // horario quedan fuera por construcción del filtro del SERVIDOR.
      expect(items).toHaveLength(2);
      expect(items.map((item) => item.scheduledStart)).toEqual([
        futuroCercano.toISOString(),
        futuroLejano.toISOString(),
      ]);
      expect(new Date(items[0]!.scheduledStart).getTime()).toBeGreaterThan(Date.now());
    });

    it('las visitas devuelven ÚNICAMENTE las recientes del paciente autenticado', async () => {
      const respuesta = await pedir(VISITS_PATH, paciente.cookie).expect(200);
      const items = respuesta.body.items as { scheduledStart: string; modality: string }[];

      expect(items).toHaveLength(1);
      expect(items[0]!.scheduledStart).toBe(pasadoCercano.toISOString());
      expect(items[0]!.modality).toBe('HOME');
    });

    it('toda respuesta de la superficie es NO CACHEABLE', async () => {
      for (const ruta of RUTAS) {
        const respuesta = await pedir(ruta, paciente.cookie).expect(200);

        expect(respuesta.headers['cache-control']).toBe('private, no-store');
        expect(respuesta.headers['vary']).toContain('Cookie');
      }
    });
  });

  /* ====================================================================== */
  /* T5.6-b — Conjunto de campos CERRADO, por igualdad de conjunto           */
  /* ====================================================================== */

  describe('T5.6-b — conjunto de campos CERRADO en las tres respuestas', () => {
    it('el resumen tiene EXACTAMENTE tres campos y ninguno más', async () => {
      const respuesta = await pedir(SUMMARY_PATH, paciente.cookie).expect(200);

      expect(Object.keys(respuesta.body).sort()).toEqual(
        ['givenName', 'initials', 'label'].sort(),
      );
    });

    it('cada cita tiene EXACTAMENTE tres campos, y la lista solo `items`', async () => {
      const respuesta = await pedir(APPOINTMENTS_PATH, paciente.cookie).expect(200);

      expect(Object.keys(respuesta.body)).toEqual(['items']);

      for (const item of respuesta.body.items as Record<string, unknown>[]) {
        expect(Object.keys(item).sort()).toEqual(
          ['modality', 'scheduledStart', 'status'].sort(),
        );
      }
    });

    it('cada visita tiene EXACTAMENTE tres campos, y la lista solo `items`', async () => {
      const respuesta = await pedir(VISITS_PATH, paciente.cookie).expect(200);

      expect(Object.keys(respuesta.body)).toEqual(['items']);

      for (const item of respuesta.body.items as Record<string, unknown>[]) {
        expect(Object.keys(item).sort()).toEqual(
          ['modality', 'scheduledStart', 'status'].sort(),
        );
      }
    });
  });

  /* ====================================================================== */
  /* T5.6 — Ni identificadores, ni PII, ni contenido clínico                 */
  /* ====================================================================== */

  describe('T5.6 — la respuesta no lleva identificadores, PII ni dato clínico', () => {
    it('ninguna de las tres respuestas contiene identificadores del sujeto', async () => {
      for (const ruta of RUTAS) {
        const respuesta = await pedir(ruta, paciente.cookie).expect(200);
        const serializado = JSON.stringify(respuesta.body);

        for (const identificador of [
          paciente.patientId,
          paciente.personId,
          paciente.humanAccountId,
          tenantId,
        ]) {
          expect(serializado).not.toContain(identificador);
        }
      }
    });

    it('ninguna de las tres respuestas contiene PII ni dato clínico', async () => {
      for (const ruta of RUTAS) {
        const respuesta = await pedir(ruta, paciente.cookie).expect(200);
        const serializado = JSON.stringify(respuesta.body);

        // Valores que las fixtures SÍ persisten, precisamente para poder
        // demostrar que la superficie no los devuelve.
        for (const valor of [
          paciente.documentNumber,
          'Ejemplo Ficticio',
          'NUEVA_EPS',
          'Nueva EPS',
          'MEDICINA_GENERAL',
          'Medicina general',
          'PUBLIC_SELF_ENROLLMENT',
        ]) {
          expect(serializado).not.toContain(valor);
        }
      }
    });

    it('ninguna clave prohibida aparece en ningún nivel de la respuesta', async () => {
      const prohibidas = new Set([
        'id',
        'patientId',
        'personId',
        'humanAccountId',
        'tenantId',
        'careAssignmentId',
        'appointmentId',
        'professionalId',
        'createdByInstitutionalIdentityId',
        'documentNumber',
        'documentNumberNormalized',
        'birthDate',
        'sexGenderCode',
        'phone',
        'email',
        'epsCode',
        'epsNameControlled',
        'givenNames',
        'familyNames',
        'address',
        'exactAddress',
        'transitions',
        'version',
      ]);

      for (const ruta of RUTAS) {
        const respuesta = await pedir(ruta, paciente.cookie).expect(200);

        for (const clave of clavesProfundas(respuesta.body)) {
          expect(prohibidas.has(clave), `clave prohibida «${clave}» en ${ruta}`).toBe(
            false,
          );
        }
      }
    });
  });

  /* ====================================================================== */
  /* T5.5 — IDOR: ningún selector del cliente cambia el sujeto               */
  /* ====================================================================== */

  describe('T5.5 — IDOR: el sujeto lo resuelve SIEMPRE el servidor', () => {
    /**
     * Selectores que un cliente podría intentar. Se prueban en la CONSULTA, en
     * el CUERPO y en CABECERAS, porque las tres son vías por las que un
     * identificador podría intentar entrar.
     */
    const selectores: Readonly<Record<string, string>> = {
      patientId: 'PENDIENTE',
      patient_id: 'PENDIENTE',
      personId: 'PENDIENTE',
      person_id: 'PENDIENTE',
      subject: 'PENDIENTE',
      sub: 'PENDIENTE',
      tenantId: 'PENDIENTE',
      tenant: 'PENDIENTE',
      institutionId: 'PENDIENTE',
      documentNumber: 'PENDIENTE',
      humanAccountId: 'PENDIENTE',
      userId: 'PENDIENTE',
    };

    function valoresAjenos(): Record<string, string> {
      return {
        patientId: otroPaciente.patientId,
        patient_id: otroPaciente.patientId,
        personId: otroPaciente.personId,
        person_id: otroPaciente.personId,
        subject: otroPaciente.personId,
        sub: otroPaciente.personId,
        tenantId: otroTenantId,
        tenant: otroTenantId,
        institutionId: otroTenantId,
        documentNumber: otroPaciente.documentNumber,
        humanAccountId: otroPaciente.humanAccountId,
        userId: otroPaciente.humanAccountId,
      };
    }

    it('un selector ajeno en la CONSULTA produce una respuesta IDÉNTICA', async () => {
      const ajenos = valoresAjenos();
      const consulta = Object.keys(selectores)
        .map((clave) => `${clave}=${encodeURIComponent(ajenos[clave] ?? '')}`)
        .join('&');

      for (const ruta of RUTAS) {
        const limpia = await observar(ruta, paciente.cookie);
        const manipulada = await observar(`${ruta}?${consulta}`, paciente.cookie);

        expect(manipulada).toEqual(limpia);
      }
    });

    it('un selector ajeno en CABECERAS produce una respuesta IDÉNTICA', async () => {
      const ajenos = valoresAjenos();

      for (const ruta of RUTAS) {
        const limpia = await observar(ruta, paciente.cookie);

        const respuesta = await pedir(ruta, paciente.cookie)
          .set('X-Patient-Id', ajenos['patientId'] ?? '')
          .set('X-Person-Id', ajenos['personId'] ?? '')
          .set('X-Tenant-Id', ajenos['tenantId'] ?? '')
          .set('X-Subject', ajenos['subject'] ?? '')
          .set('X-Human-Account-Id', ajenos['humanAccountId'] ?? '');

        expect({
          status: respuesta.status,
          cuerpo: JSON.stringify(respuesta.body),
        }).toEqual(limpia);
      }
    });

    it('un selector ajeno en el CUERPO produce una respuesta IDÉNTICA', async () => {
      const ajenos = valoresAjenos();

      for (const ruta of RUTAS) {
        const limpia = await observar(ruta, paciente.cookie);

        const respuesta = await pedir(ruta, paciente.cookie)
          .set('Content-Type', 'application/json')
          .send(ajenos);

        expect({
          status: respuesta.status,
          cuerpo: JSON.stringify(respuesta.body),
        }).toEqual(limpia);
      }
    });

    it('una ruta parametrizada con el paciente ajeno NO existe', async () => {
      for (const ruta of RUTAS) {
        await pedir(`${ruta}/${otroPaciente.patientId}`, paciente.cookie).expect(404);
      }

      await pedir(`${BASE_PATH}/${otroPaciente.patientId}`, paciente.cookie).expect(404);
    });

    it('la superficie NO admite ningún método de escritura', async () => {
      const servidor = app.getHttpServer();

      for (const ruta of RUTAS) {
        await request(servidor).post(ruta).set('Cookie', paciente.cookie).expect(404);
        await request(servidor).patch(ruta).set('Cookie', paciente.cookie).expect(404);
        await request(servidor).put(ruta).set('Cookie', paciente.cookie).expect(404);
        await request(servidor).delete(ruta).set('Cookie', paciente.cookie).expect(404);
      }
    });
  });

  /* ====================================================================== */
  /* T5.10 — Dos pacientes del MISMO tenant no se observan entre sí          */
  /* ====================================================================== */

  describe('T5.10 — aislamiento entre dos pacientes del MISMO tenant', () => {
    it('cada resumen es el de SU propia persona', async () => {
      const propio = await pedir(SUMMARY_PATH, paciente.cookie).expect(200);
      const ajeno = await pedir(SUMMARY_PATH, otroPaciente.cookie).expect(200);

      expect(propio.body.givenName).toBe('Ana');
      expect(ajeno.body.givenName).toBe('Beatriz');
      expect(propio.body).not.toEqual(ajeno.body);
    });

    it('las citas de cada paciente son SOLO las suyas, y no se solapan', async () => {
      const propias = await pedir(APPOINTMENTS_PATH, paciente.cookie).expect(200);
      const ajenas = await pedir(APPOINTMENTS_PATH, otroPaciente.cookie).expect(200);

      // Cada paciente tiene su propia agenda ficticia, con el MISMO número de
      // filas: si una respuesta filtrara la del otro, el conteo se duplicaría.
      expect(propias.body.items).toHaveLength(2);
      expect(ajenas.body.items).toHaveLength(2);

      const citasAjenas = await prisma.appointment.findMany({
        where: { tenantId, patientId: otroPaciente.patientId },
        select: { id: true },
      });

      const serializado = JSON.stringify(propias.body);

      for (const cita of citasAjenas) {
        expect(serializado).not.toContain(cita.id);
      }
    });

    it('las visitas de cada paciente son SOLO las suyas', async () => {
      const propias = await pedir(VISITS_PATH, paciente.cookie).expect(200);
      const ajenas = await pedir(VISITS_PATH, otroPaciente.cookie).expect(200);

      expect(propias.body.items).toHaveLength(1);
      expect(ajenas.body.items).toHaveLength(1);

      const visitasAjenas = await prisma.homeVisit.findMany({
        where: { tenantId, patientId: otroPaciente.patientId },
        select: { id: true },
      });

      const serializado = JSON.stringify(propias.body);

      for (const visita of visitasAjenas) {
        expect(serializado).not.toContain(visita.id);
      }
    });
  });

  /* ====================================================================== */
  /* T5.2 — 401 INDISTINGUIBLE                                               */
  /* ====================================================================== */

  describe('T5.2 — 401 uniforme e indistinguible', () => {
    /**
     * Cada caso construye una sesión que NO debe autenticar, por una causa
     * distinta. Todas deben producir EXACTAMENTE la misma respuesta: si una se
     * distinguiera, permitiría deducir el estado de una cuenta ajena.
     */
    async function cookieDeCasos(): Promise<{ nombre: string; cookie: string | null }[]> {
      const persona = await crearPersona(prisma, tenantId, 'Elena');
      sembrado.personas.add(persona.personId);

      const cuenta = await crearCuentaHumana(prisma, {
        tenantId,
        personId: persona.personId,
      });
      sembrado.cuentas.add(cuenta.humanAccountId);

      const caducada = await crearSesionHumana(prisma, {
        tenantId,
        humanAccountId: cuenta.humanAccountId,
        externalAuthIdentityId: cuenta.bindingId,
        // El CHECK `human_session_period_order` exige `expiresAt > createdAt`:
        // una sesión ya caducada nació antes, no se crea caducada al revés.
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        expiresAt: new Date(Date.now() - 60 * 1000),
      });

      const inactiva = await crearSesionHumana(prisma, {
        tenantId,
        humanAccountId: cuenta.humanAccountId,
        externalAuthIdentityId: cuenta.bindingId,
        // Caducada por inactividad, pero no por su vigencia absoluta.
        createdAt: new Date(Date.now() - (HUMAN_SESSION_IDLE_SECONDS + 60) * 1000),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        lastUsedAt: null,
      });

      const revocada = await crearSesionHumana(prisma, {
        tenantId,
        humanAccountId: cuenta.humanAccountId,
        externalAuthIdentityId: cuenta.bindingId,
        createdAt: new Date(Date.now() - 10 * 60 * 1000),
        revokedAt: new Date(Date.now() - 60 * 1000),
      });

      // Cuenta DESHABILITADA, con su propia persona.
      const personaDeshabilitada = await crearPersona(prisma, tenantId, 'Fabiola');
      sembrado.personas.add(personaDeshabilitada.personId);

      const cuentaDeshabilitada = await crearCuentaHumana(prisma, {
        tenantId,
        personId: personaDeshabilitada.personId,
        accountStatus: 'DISABLED',
      });
      sembrado.cuentas.add(cuentaDeshabilitada.humanAccountId);

      const sesionDeshabilitada = await crearSesionHumana(prisma, {
        tenantId,
        humanAccountId: cuentaDeshabilitada.humanAccountId,
        externalAuthIdentityId: cuentaDeshabilitada.bindingId,
      });

      // Vínculo externo DESVINCULADO, con su propia persona.
      const personaDesvinculada = await crearPersona(prisma, tenantId, 'Gloria');
      sembrado.personas.add(personaDesvinculada.personId);

      const cuentaDesvinculada = await crearCuentaHumana(prisma, {
        tenantId,
        personId: personaDesvinculada.personId,
        bindingStatus: 'UNLINKED',
      });
      sembrado.cuentas.add(cuentaDesvinculada.humanAccountId);

      const sesionDesvinculada = await crearSesionHumana(prisma, {
        tenantId,
        humanAccountId: cuentaDesvinculada.humanAccountId,
        externalAuthIdentityId: cuentaDesvinculada.bindingId,
      });

      return [
        { nombre: 'sin cookie', cookie: null },
        { nombre: 'cookie vacía', cookie: `${HUMAN_COOKIE}=` },
        { nombre: 'token malformado', cookie: `${HUMAN_COOKIE}=no-es-un-token` },
        {
          nombre: 'token bien formado e inexistente',
          cookie: `${HUMAN_COOKIE}=${'a'.repeat(64)}`,
        },
        { nombre: 'caducidad absoluta', cookie: `${HUMAN_COOKIE}=${caducada.token}` },
        { nombre: 'caducidad por inactividad', cookie: `${HUMAN_COOKIE}=${inactiva.token}` },
        { nombre: 'sesión revocada', cookie: `${HUMAN_COOKIE}=${revocada.token}` },
        {
          nombre: 'cuenta deshabilitada',
          cookie: `${HUMAN_COOKIE}=${sesionDeshabilitada.token}`,
        },
        {
          nombre: 'vínculo desvinculado',
          cookie: `${HUMAN_COOKIE}=${sesionDesvinculada.token}`,
        },
        {
          nombre: 'sesión de OTRO tenant',
          cookie: pacienteOtroTenant.cookie,
        },
      ];
    }

    it('las diez causas producen la MISMA respuesta en las tres rutas', async () => {
      const casos = await cookieDeCasos();

      for (const ruta of RUTAS) {
        const observadas = [] as { nombre: string; observada: RespuestaObservada }[];

        for (const caso of casos) {
          observadas.push({ nombre: caso.nombre, observada: await observar(ruta, caso.cookie) });
        }

        const referencia = observadas[0]!.observada;

        expect(referencia.status).toBe(401);
        expect(JSON.parse(referencia.cuerpo).code).toBe(
          // El `401` lo emite el guard de sesión humana, no esta superficie.
          'HUMAN_SESSION_REQUIRED',
        );

        for (const { nombre, observada } of observadas) {
          expect(observada, `la causa «${nombre}» se distingue en ${ruta}`).toEqual(
            referencia,
          );
        }
      }
    });

    it('una cookie de OTRA superficie no autentica aquí', async () => {
      for (const ruta of RUTAS) {
        const institucional = await observar(
          ruta,
          `merdn_institutional_session=${'b'.repeat(64)}`,
        );
        const inscripcion = await observar(
          ruta,
          `merdn_enrollment_session=${'c'.repeat(64)}`,
        );

        expect(institucional.status).toBe(401);
        expect(inscripcion.status).toBe(401);
        expect(institucional).toEqual(inscripcion);
      }
    });
  });

  /* ====================================================================== */
  /* T5.3 y T5.11 — Denegación uniforme sin contexto PATIENT                 */
  /* ====================================================================== */

  describe('T5.3 / T5.11 — sesión humana SIN contexto PATIENT: fail-closed', () => {
    it('una participación PATIENT activa sin aprobación institucional recibe 403', async () => {
      for (const ruta of RUTAS) {
        const respuesta = await pedir(ruta, pacienteSinAprobacion.cookie).expect(403);
        expect(respuesta.body.code).toBe(PATIENT_SELF_ERROR_CODES.contextRequired);
        expect(respuesta.body).not.toHaveProperty('items');
      }
    });

    it.each(['PENDING', 'REJECTED', 'SUSPENDED', 'REVOKED'] as const)(
      'una solicitud %s no concede acceso propio',
      async (status) => {
        const requestRow = await prisma.accessRequest.findFirstOrThrow({
          where: {
            tenantId,
            humanAccountId: paciente.humanAccountId,
            requestedProfile: 'PATIENT',
          },
          select: { id: true },
        });

        try {
          await prisma.accessRequest.update({
            where: { id: requestRow.id },
            data: { status },
          });
          const response = await pedir(SUMMARY_PATH, paciente.cookie).expect(403);
          expect(response.body.code).toBe(PATIENT_SELF_ERROR_CODES.contextRequired);
        } finally {
          await prisma.accessRequest.update({
            where: { id: requestRow.id },
            data: { status: 'APPROVED' },
          });
        }
      },
    );

    it('una sesión histórica sin vínculo exacto no reutiliza una aprobación', async () => {
      const session = await crearSesionHumana(prisma, {
        tenantId,
        humanAccountId: paciente.humanAccountId,
      });
      const response = await pedir(
        SUMMARY_PATH,
        `${HUMAN_COOKIE}=${session.token}`,
      ).expect(403);

      expect(response.body.code).toBe(PATIENT_SELF_ERROR_CODES.contextRequired);
    });

    it('una aprobación ligada a un alias de identidad no autoriza el vínculo de la sesión', async () => {
      const alias = await prisma.externalAuthIdentity.create({
        data: {
          tenantId,
          humanAccountId: pacienteSinAprobacion.humanAccountId,
          issuer: process.env['MERDN_HUMAN_AUTH_ISSUER']!,
          subject: `alias-ficticio-${randomBytes(12).toString('hex')}`,
          status: 'ACTIVE',
        },
        select: { id: true },
      });
      await prisma.accessRequest.create({
        data: {
          tenantId,
          personId: pacienteSinAprobacion.personId,
          requestedProfile: 'PATIENT',
          status: 'APPROVED',
          provisioningStatus: 'SUCCEEDED',
          reference: `AR-${randomBytes(12).toString('hex').toUpperCase()}`,
          humanAccountId: pacienteSinAprobacion.humanAccountId,
          externalAuthIdentityId: alias.id,
        },
      });

      const response = await pedir(SUMMARY_PATH, pacienteSinAprobacion.cookie).expect(403);
      expect(response.body.code).toBe(PATIENT_SELF_ERROR_CODES.contextRequired);
    });

    it('una aprobación de otra cuenta no autoriza a la cuenta del paciente', async () => {
      await prisma.accessRequest.create({
        data: {
          tenantId,
          personId: pacienteSinAprobacion.personId,
          requestedProfile: 'PATIENT',
          status: 'APPROVED',
          provisioningStatus: 'SUCCEEDED',
          reference: `AR-${randomBytes(12).toString('hex').toUpperCase()}`,
          humanAccountId: sinContextoPaciente.humanAccountId,
          externalAuthIdentityId: sinContextoPaciente.externalAuthIdentityId,
        },
      });

      const response = await pedir(SUMMARY_PATH, pacienteSinAprobacion.cookie).expect(403);
      expect(response.body.code).toBe(PATIENT_SELF_ERROR_CODES.contextRequired);
    });

    it('las tres rutas deniegan con 403 y el MISMO cuerpo', async () => {
      const observadas: RespuestaObservada[] = [];

      for (const ruta of RUTAS) {
        const observada = await observar(ruta, sinContextoPaciente.cookie);

        expect(observada.status).toBe(403);
        observadas.push(observada);
      }

      expect(JSON.parse(observadas[0]!.cuerpo).code).toBe(
        PATIENT_SELF_ERROR_CODES.contextRequired,
      );

      for (const observada of observadas) {
        expect(observada).toEqual(observadas[0]);
      }
    });

    it('la denegación NO revela si existe un paciente asociado ni devuelve filas', async () => {
      const respuesta = await pedir(APPOINTMENTS_PATH, sinContextoPaciente.cookie).expect(
        403,
      );

      const serializado = JSON.stringify(respuesta.body);

      // Ni lista vacía —que afirmaría «no tienes»—, ni rastro del sujeto.
      expect(serializado).not.toContain('items');
      expect(serializado).not.toContain(sinContextoPaciente.personId);
      expect(serializado).not.toContain(sinContextoPaciente.humanAccountId);
      expect(serializado).not.toContain('paciente');
      expect(serializado).not.toContain('patient');
    });

    /**
     * PACIENTE NO ACTIVO. `PatientStatus` admite HOY un ÚNICO valor, `ACTIVE`:
     * un paciente no activo NO es representable en el modelo aprobado y esta
     * suite NO inventa un estado que la spec no aprobó.
     *
     * Se comprueba por tanto la garantía que sí es observable: la resolución
     * del sujeto exige una participación de paciente ACTIVA, y su ausencia
     * —el único camino alcanzable— resuelve CERRADO con el mismo `403`
     * uniforme y sin servir ninguna fila.
     */
    it('la ausencia de participación ACTIVA es el único camino alcanzable, y falla cerrado', async () => {
      const estados = await prisma.$queryRaw<{ readonly enumlabel: string }[]>`
        SELECT e.enumlabel
          FROM pg_type t
          JOIN pg_enum e ON e.enumtypid = t.oid
         WHERE t.typname = 'PatientStatus'
      `;

      expect(estados.map((estado) => estado.enumlabel)).toEqual(['ACTIVE']);

      const participacion = await prisma.patient.findFirst({
        where: { tenantId, personId: sinContextoPaciente.personId, status: 'ACTIVE' },
        select: { id: true },
      });

      expect(participacion).toBeNull();

      for (const ruta of RUTAS) {
        await pedir(ruta, sinContextoPaciente.cookie).expect(403);
      }
    });
  });

  /* ====================================================================== */
  /* T5.4 — 503 fail-closed                                                  */
  /* ====================================================================== */

  describe('T5.4 — 503 cuando el contexto de ejecución seguro no se confirma', () => {
    it('las tres rutas responden 503 y NUNCA una lista vacía', async () => {
      for (const ruta of RUTAS) {
        const respuesta = await request(appSinContexto.getHttpServer())
          .get(ruta)
          .set('Cookie', paciente.cookie)
          .expect(503);

        expect(respuesta.body.code).toBe(PATIENT_SELF_ERROR_CODES.unavailable);
        expect(JSON.stringify(respuesta.body)).not.toContain('items');
      }
    });

    it('el 503 no revela la topología ni el motivo interno', async () => {
      const respuesta = await request(appSinContexto.getHttpServer())
        .get(SUMMARY_PATH)
        .set('Cookie', paciente.cookie)
        .expect(503);

      const serializado = JSON.stringify(respuesta.body);

      expect(serializado).not.toContain('merdn_runtime');
      expect(serializado).not.toContain('tenant');
      expect(serializado).not.toContain('postgres');
    });
  });

  /* ====================================================================== */
  /* Auditoría — GRANTED, DENIED, resourceType y endpoint                    */
  /* ====================================================================== */

  describe('auditoría del acceso propio del Paciente', () => {
    const CORRESPONDENCIA = [
      { ruta: SUMMARY_PATH, resourceType: 'PatientSelfSummary' },
      { ruta: APPOINTMENTS_PATH, resourceType: 'PatientSelfAppointments' },
      { ruta: VISITS_PATH, resourceType: 'PatientSelfVisits' },
    ] as const;

    async function ultimoEvento(
      eventType: 'PATIENT_SELF_ACCESS_GRANTED' | 'PATIENT_SELF_ACCESS_DENIED',
      resourceType: string,
    ) {
      const eventos = await prisma.auditEvent.findMany({
        where: { tenantId, eventType, resourceType },
        orderBy: { occurredAt: 'desc' },
        take: 1,
      });

      return eventos[0] ?? null;
    }

    it.each(CORRESPONDENCIA)(
      'una lectura concedida de $ruta registra GRANTED con su resourceType y su endpoint',
      async ({ ruta, resourceType }) => {
        const antes = await prisma.auditEvent.count({
          where: { tenantId, eventType: 'PATIENT_SELF_ACCESS_GRANTED', resourceType },
        });

        await pedir(ruta, paciente.cookie).expect(200);

        expect(
          await prisma.auditEvent.count({
            where: { tenantId, eventType: 'PATIENT_SELF_ACCESS_GRANTED', resourceType },
          }),
        ).toBe(antes + 1);

        const evento = await ultimoEvento('PATIENT_SELF_ACCESS_GRANTED', resourceType);

        expect(evento).not.toBeNull();
        expect(evento!.tenantId).toBe(tenantId);
        expect(evento!.actorType).toBe('HUMAN_ACCOUNT');
        expect(evento!.actorUserId).toBe(paciente.humanAccountId);
        expect(evento!.actorRole).toBeNull();
        expect(evento!.outcome).toBe('SUCCESS');
        expect(evento!.resourceType).toBe(resourceType);
        expect(evento!.resourceId).toBeNull();
        expect(evento!.endpoint).toBe(ruta);
        expect(evento!.correlationId).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u,
        );
      },
    );

    it.each(CORRESPONDENCIA)(
      'una denegación CON principal resoluble registra DENIED atribuido a $resourceType',
      async ({ ruta, resourceType }) => {
        const antes = await prisma.auditEvent.count({
          where: { tenantId, eventType: 'PATIENT_SELF_ACCESS_DENIED', resourceType },
        });

        await pedir(ruta, sinContextoPaciente.cookie).expect(403);

        expect(
          await prisma.auditEvent.count({
            where: { tenantId, eventType: 'PATIENT_SELF_ACCESS_DENIED', resourceType },
          }),
        ).toBe(antes + 1);

        const evento = await ultimoEvento('PATIENT_SELF_ACCESS_DENIED', resourceType);

        expect(evento).not.toBeNull();
        expect(evento!.tenantId).toBe(tenantId);
        expect(evento!.actorType).toBe('HUMAN_ACCOUNT');
        expect(evento!.actorUserId).toBe(sinContextoPaciente.humanAccountId);
        expect(evento!.actorRole).toBeNull();
        expect(evento!.outcome).toBe('DENIED');
        expect(evento!.resourceId).toBeNull();
        expect(evento!.endpoint).toBe(ruta);
      },
    );

    it('una petición SIN principal humano resoluble NO produce evento de esta familia', async () => {
      const contar = async (): Promise<number> =>
        prisma.auditEvent.count({
          where: {
            tenantId,
            eventType: {
              in: ['PATIENT_SELF_ACCESS_GRANTED', 'PATIENT_SELF_ACCESS_DENIED'],
            },
          },
        });

      const antes = await contar();

      for (const ruta of RUTAS) {
        await pedir(ruta, null).expect(401);
        await pedir(ruta, `${HUMAN_COOKIE}=no-es-un-token`).expect(401);
      }

      // Ni un actor de relleno, ni `anonymous`, ni un evento sin actor.
      expect(await contar()).toBe(antes);
    });

    it('el evento NO contiene PII ni el contenido de la cita o de la visita', async () => {
      await pedir(APPOINTMENTS_PATH, paciente.cookie).expect(200);

      const evento = await ultimoEvento(
        'PATIENT_SELF_ACCESS_GRANTED',
        'PatientSelfAppointments',
      );

      const serializado = JSON.stringify(evento);

      for (const valor of [
        paciente.documentNumber,
        paciente.patientId,
        paciente.personId,
        'Ana María',
        'Ejemplo Ficticio',
        'NUEVA_EPS',
        futuroCercano.toISOString(),
        'ASSIGNED',
        'VIRTUAL',
      ]) {
        expect(serializado).not.toContain(valor);
      }
    });

    it('el evento queda en el tenant del principal y en ningún otro', async () => {
      await pedir(SUMMARY_PATH, paciente.cookie).expect(200);

      const enOtroTenant = await prisma.auditEvent.count({
        where: {
          tenantId: otroTenantId,
          eventType: 'PATIENT_SELF_ACCESS_GRANTED',
          actorUserId: paciente.humanAccountId,
        },
      });

      expect(enOtroTenant).toBe(0);
    });
  });
});

/** Todas las claves de un objeto, en cualquier nivel de anidamiento. */
function clavesProfundas(valor: unknown): string[] {
  if (Array.isArray(valor)) {
    return valor.flatMap((elemento) => clavesProfundas(elemento));
  }

  if (valor === null || typeof valor !== 'object') {
    return [];
  }

  return Object.entries(valor as Record<string, unknown>).flatMap(([clave, anidado]) => [
    clave,
    ...clavesProfundas(anidado),
  ]);
}
