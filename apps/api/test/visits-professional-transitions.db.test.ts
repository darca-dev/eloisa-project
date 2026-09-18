import { randomBytes, randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';

import { AuditService } from '../src/audit/audit.service';
import { type ApiEnvironment } from '../src/config/environment';
import { PrismaService } from '../src/database/prisma.service';
import { type PrismaClient } from '../src/generated/prisma/client';
import { type HumanPrincipal } from '../src/identity-access/human-principal';
import { HomeVisitMaterializationService } from '../src/visits/home-visit-materialization.service';
import {
  HOME_VISIT_TRANSITION_ERROR_CODES,
  HomeVisitTransitionError,
  HomeVisitTransitionService,
  type HomeVisitTransitionTarget,
} from '../src/visits/home-visit-transition.service';

import { createTestPrismaClient, unavailableBanner } from './database-availability';
import { ensureOtherTenant } from './enrollment-fixtures';
import { crearCitaAsignada } from './hospital-core-02-fixtures';
import {
  crearCuentaHumana,
  crearPacienteFicticio,
  crearProfesionalFicticio,
} from './identity-relationships-fixtures';

/**
 * Transiciones PROFESIONALES de la visita domiciliaria, contra PostgreSQL real
 * y bajo el rol de ejecución `merdn_runtime` (VISITS-CORE-01 MP03).
 *
 * ALCANCE EXACTO DE ESTA PRUEBA: la ÚNICA mutación transaccional que MP03 crea.
 * NO ejercita endpoint, guard, DTO, módulo Nest ni interfaz, porque el paquete
 * no los crea. Tampoco vuelve a probar la materialización de MP02: esta se
 * limita a USARLA para disponer de una visita `SCHEDULED` real, con su
 * transición de creación y su procedencia institucional intactas.
 *
 * Lo que aquí se demuestra es que el SERVICIO:
 *
 *   1. ejecuta las CUATRO transiciones legales y solo esas, fijando los
 *      instantes y la versión exactamente como corresponde;
 *   2. escribe historial APPEND-ONLY con la CUENTA HUMANA que actuó y el evento
 *      de auditoría del estado destino, en la MISMA transacción;
 *   3. autoriza desde `principal.personId` y NUNCA desde un profesional
 *      recibido: otra profesional, otro paciente y otra institución producen el
 *      MISMO desenlace opaco;
 *   4. exige asignación, perfil y afiliación activos y VIGENTES;
 *   5. rechaza la versión obsoleta y la transición ilegal o terminal con
 *      desenlaces estables y distintos;
 *   6. deja exactamente UN ganador en una carrera concurrente;
 *   7. revierte TODO si el historial o la auditoría fallan.
 *
 * TODAS las personas, pacientes, profesionales, cuentas, citas e identidades son
 * FICTICIAS. Ninguna fila la crea la migración: la de MP03 solo añade tres
 * valores de enum y NO inserta datos.
 *
 * LIMPIEZA ACOTADA: se retiran EXCLUSIVAMENTE las filas cuyos identificadores
 * esta prueba registró al sembrarlas, más los residuos que una ejecución
 * anterior de ella misma pudiera haber dejado, localizados por sus identidades
 * institucionales propias. NO se vacía `appointment`, `care_assignment`,
 * `patient`, `person`, `human_account` ni ninguna otra tabla compartida.
 * `audit_event` es append-only y NO se borra NUNCA.
 */

const availability = inject('databaseAvailability');
const puedeEjecutarse = availability.available && availability.migrated;

/**
 * Una carrera solo es CONCLUYENTE contra un servidor PostgreSQL real, que
 * atiende varias conexiones en paralelo. Una compilación WebAssembly serializa
 * el acceso y no probaría nada sobre concurrencia.
 */
const carreraVerificable = availability.engine === 'postgresql-server';

if (!puedeEjecutarse) {
  // eslint-disable-next-line no-console
  console.warn(`\n${unavailableBanner(availability)}\n`);
}

/** Prefijo de las identidades institucionales OPACAS sembradas aquí. */
const CODIGO_IDENTIDAD_BASE = 'home-visit-transitions-mp03';

/** Instante base de las citas sembradas. Fecha ficticia y determinista. */
const HORARIO = new Date(Date.UTC(2026, 7, 24, 16, 0, 0));

/**
 * Instante que el SERVIDOR fija para el acto. Se toma del reloj real y NO de
 * una constante: la vigencia de la afiliación que siembra la fixture compartida
 * se calcula también desde el reloj real, y una constante fija haría que la
 * prueba dejara de ser válida al cambiar la fecha.
 */
const AHORA = new Date();

/** Instantes SUCESIVOS del servidor, para que el fin nunca preceda al inicio. */
function instante(desplazamientoMs: number): Date {
  return new Date(AHORA.getTime() + desplazamientoMs);
}

/** Día UTC sin hora, como los almacena una columna `DATE`. */
function diaUtc(base: Date, desplazamientoDias = 0): Date {
  return new Date(
    Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() + desplazamientoDias),
  );
}

/** Configuración mínima que necesita `PrismaService`. Valores ficticios. */
function entorno(): ApiEnvironment {
  return {
    merdnEnvironment: 'test',
    port: 3001,
    openApiPath: 'docs',
    // El objeto de esta prueba: rol de mínimo privilegio y RLS aplicados.
    runtimeRoleMode: 'enforce',
    hasSeparateRuntimeConnection: false,
    activeTenantCode: process.env['MERDN_ACTIVE_TENANT_CODE'] ?? 'merdn-mvp',
    // Spec 024: pareja confiable id + codigo. UUID FICTICIO exclusivo de
    // pruebas; el entorno lo suministra cuando corre contra una base real.
    activeTenantId:
      process.env['MERDN_ACTIVE_TENANT_ID'] ??
      '00000000-0000-4000-8000-000000000001',
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
    webOrigins: ['http://127.0.0.1:3000'],
    enrollmentRateLimit: { maxRequests: 1000, windowSeconds: 900 },
  };
}

/**
 * REGISTRO EXACTO de lo que esta prueba siembra.
 *
 * La limpieza retira ESTOS identificadores y NINGUNO más. Deliberadamente NO se
 * usa `deleteMany({})` sobre ninguna tabla compartida: esos datos pertenecen a
 * otros paquetes y a otras pruebas, y una prueba de MP03 no tiene autoridad para
 * retirarlos.
 */
interface Sembrado {
  readonly visitas: Set<string>;
  readonly citas: Set<string>;
  readonly asignaciones: Set<string>;
  readonly pacientes: Set<string>;
  readonly profesionales: Set<string>;
  readonly cuentas: Set<string>;
  readonly personas: Set<string>;
  readonly identidades: Set<string>;
}

const sembrado: Sembrado = {
  visitas: new Set<string>(),
  citas: new Set<string>(),
  asignaciones: new Set<string>(),
  pacientes: new Set<string>(),
  profesionales: new Set<string>(),
  cuentas: new Set<string>(),
  personas: new Set<string>(),
  identidades: new Set<string>(),
};

/** `{ id: { in: [...] } }`, o `null` cuando no hay nada que retirar. */
function porId(ids: ReadonlySet<string>): { id: { in: string[] } } | null {
  return ids.size === 0 ? null : { id: { in: [...ids] } };
}

/**
 * Identidad institucional OPACA que materializa administrativamente la visita.
 *
 * NO es la actora de las transiciones que esta prueba ejercita: iniciar,
 * completar o dar por no realizada una visita es el acto de una PERSONA. La
 * identidad existe únicamente porque `home_visit` exige procedencia
 * institucional desde MP01.
 *
 * La derivación almacenada es ALEATORIA y no corresponde a ninguna credencial:
 * nadie —tampoco la prueba— puede autenticarse con ella.
 */
async function identidadCreadora(
  prisma: PrismaClient,
  tenantId: string,
  sufijo: string,
): Promise<string> {
  const code = `${CODIGO_IDENTIDAD_BASE}-${sufijo}`;

  const existente = await prisma.institutionalIdentity.findFirst({
    where: { tenantId, code },
    select: { id: true },
  });

  if (existente !== null) {
    sembrado.identidades.add(existente.id);

    return existente.id;
  }

  const creada = await prisma.institutionalIdentity.create({
    data: {
      tenantId,
      code,
      role: 'HOSPITAL_SCHEDULER',
      status: 'ACTIVE',
      // Forma exigida por `institutional_identity_secret_shape`.
      accessSecretHash: randomBytes(64).toString('hex'),
      accessSecretSalt: randomBytes(16).toString('hex'),
    },
    select: { id: true },
  });

  sembrado.identidades.add(creada.id);

  return creada.id;
}

/**
 * Retira EXCLUSIVAMENTE lo que esta prueba sembró, en el orden que exigen las
 * claves foráneas: primero el historial —que apunta a la visita y a la cuenta
 * humana con `RESTRICT`—, después las visitas, después citas y asignaciones,
 * después pacientes, perfiles y cuentas, después las personas y por último las
 * identidades institucionales propias de MP03.
 *
 * NO borra eventos de auditoría: `audit_event` es append-only.
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
    // Direcciones, consentimientos y pertenencias del paciente caen con él.
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
    await prisma.externalAuthIdentity.deleteMany({ where: { humanAccountId: { in: cuentas } } });
    await prisma.humanAccount.deleteMany({ where: { id: { in: cuentas } } });
  }

  const personas = porId(sembrado.personas);
  if (personas !== null) {
    await prisma.person.deleteMany({ where: personas });
  }

  const identidades = porId(sembrado.identidades);
  if (identidades !== null) {
    await prisma.institutionalIdentity.deleteMany({ where: identidades });
  }

  for (const conjunto of Object.values(sembrado)) {
    conjunto.clear();
  }
}

/**
 * Retira los residuos que una ejecución ANTERIOR de esta misma prueba pudo
 * dejar si se interrumpió antes de su limpieza.
 *
 * El criterio es estrictamente MP03: se parte de las identidades institucionales
 * cuyo código lleva el prefijo reservado de este archivo y se desciende por las
 * asignaciones, citas, visitas, historial y cuentas humanas que ESAS identidades
 * originaron. Nada más se toca: las personas, los pacientes y los perfiles
 * profesionales que pudieran quedar sueltos pertenecen a fixtures COMPARTIDAS.
 */
async function retirarResiduosMp03(prisma: PrismaClient): Promise<void> {
  const identidades = await prisma.institutionalIdentity.findMany({
    where: { code: { startsWith: CODIGO_IDENTIDAD_BASE } },
    select: { id: true },
  });

  if (identidades.length === 0) {
    return;
  }

  const identidadIds = identidades.map((identidad) => identidad.id);

  const asignaciones = await prisma.careAssignment.findMany({
    where: { createdByIdentityId: { in: identidadIds } },
    select: { id: true, professionalId: true },
  });
  const asignacionIds = asignaciones.map((asignacion) => asignacion.id);
  const profesionalIds = asignaciones.map((asignacion) => asignacion.professionalId);

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
        await prisma.externalAuthIdentity.deleteMany({
          where: { humanAccountId: { in: cuentaIds } },
        });
        await prisma.humanAccount.deleteMany({ where: { id: { in: cuentaIds } } });
      }
    }
  }

  await prisma.institutionalIdentity.deleteMany({ where: { id: { in: identidadIds } } });
}

describe.skipIf(!puedeEjecutarse)(
  'Transiciones profesionales de la visita domiciliaria (VISITS-CORE-01 MP03)',
  () => {
    let prisma: PrismaClient;
    let servicioPrisma: PrismaService;
    let materializacion: HomeVisitMaterializationService;
    let servicio: HomeVisitTransitionService;

    let tenantId: string;
    let otroTenantId: string;

    let identidadId: string;
    let identidadOtroTenantId: string;

    /** Visita `SCHEDULED` real con su profesional autenticada. */
    interface Escenario {
      readonly homeVisitId: string;
      readonly version: number;
      readonly principal: HumanPrincipal;
      readonly professionalId: string;
      readonly patientId: string;
      readonly careAssignmentId: string;
    }

    /**
     * Siembra un escenario COMPLETO y AISLADO: paciente nuevo, profesional
     * nueva con perfil activo y afiliación vigente, su cuenta humana, la cita
     * `HOME` ya asignada y la visita materializada por MP02.
     *
     * Cada caso usa el SUYO para que un rechazo no dependa de otro y para que
     * los cambios de estado de un caso —una afiliación que se termina, una
     * asignación que vence— no contaminen a los demás.
     */
    async function escenario(
      tenant: string = tenantId,
      identidad: string = identidadId,
    ): Promise<Escenario> {
      const paciente = await crearPacienteFicticio(prisma, tenant);
      const profesional = await crearProfesionalFicticio(prisma, tenant);

      sembrado.pacientes.add(paciente.patientId);
      sembrado.personas.add(paciente.personId);
      sembrado.profesionales.add(profesional.professionalId);
      sembrado.personas.add(profesional.personId);

      const cuenta = await crearCuentaHumana(prisma, {
        tenantId: tenant,
        personId: profesional.personId,
      });
      sembrado.cuentas.add(cuenta.humanAccountId);

      const cita = await crearCitaAsignada(prisma, {
        tenantId: tenant,
        patientId: paciente.patientId,
        professionalId: profesional.professionalId,
        identityId: identidad,
        modality: 'HOME',
        scheduledStart: HORARIO,
      });
      sembrado.citas.add(cita.appointmentId);
      sembrado.asignaciones.add(cita.careAssignmentId);

      const visita = await materializacion.materialize(
        { tenantId: tenant, identityId: identidad, role: 'HOSPITAL_SCHEDULER', now: instante(0) },
        cita.appointmentId,
      );
      sembrado.visitas.add(visita.homeVisitId);

      return {
        homeVisitId: visita.homeVisitId,
        version: visita.version,
        /*
         * Principal producido SERVER-SIDE, exactamente como lo produciría el
         * validador de `HumanSession` a partir del token opaco de la cookie. La
         * prueba no lo recibe de ningún cliente y no lleva rol ni profesional:
         * el servicio deriva la autorización de `personId` y de nada más.
         */
        principal: {
          sessionId: randomUUID(),
          humanAccountId: cuenta.humanAccountId,
          personId: profesional.personId,
          tenantId: tenant,
        },
        professionalId: profesional.professionalId,
        patientId: paciente.patientId,
        careAssignmentId: cita.careAssignmentId,
      };
    }

    /** Captura el desenlace de dominio sin depender del texto del mensaje. */
    async function desenlace(
      principal: HumanPrincipal,
      visitId: string,
      objetivo: HomeVisitTransitionTarget,
      versionEsperada: number,
      now: Date = instante(1_000),
      servicioUsado: HomeVisitTransitionService = servicio,
    ): Promise<{ readonly code: string; readonly status: number }> {
      try {
        await servicioUsado.transition(principal, visitId, objetivo, versionEsperada, now);

        throw new Error('La transición debía rechazarse y no lo hizo.');
      } catch (error) {
        if (!(error instanceof HomeVisitTransitionError)) {
          throw error;
        }

        return { code: error.code, status: error.status };
      }
    }

    /** Estado persistido de la visita, tal como quedó en la base. */
    async function estadoDe(homeVisitId: string): Promise<{
      readonly status: string;
      readonly version: number;
      readonly startedAt: Date | null;
      readonly endedAt: Date | null;
    }> {
      const visita = await prisma.homeVisit.findUniqueOrThrow({
        where: { id: homeVisitId },
        select: { status: true, version: true, startedAt: true, endedAt: true },
      });

      return visita;
    }

    beforeAll(async () => {
      prisma = createTestPrismaClient();
      // NO se vacía el entorno: solo se retiran los residuos de MP03.
      await retirarResiduosMp03(prisma);

      const tenant = await prisma.tenant.findUnique({
        where: { code: process.env['MERDN_ACTIVE_TENANT_CODE'] ?? 'merdn-mvp' },
        select: { id: true },
      });

      if (tenant === null) {
        throw new Error('El tenant institucional MVP no existe: aplique las migraciones.');
      }
      tenantId = tenant.id;
      otroTenantId = await ensureOtherTenant(prisma);

      servicioPrisma = new PrismaService(entorno());
      const auditoria = new AuditService();
      materializacion = new HomeVisitMaterializationService(servicioPrisma, auditoria);
      servicio = new HomeVisitTransitionService(servicioPrisma, auditoria);

      identidadId = await identidadCreadora(prisma, tenantId, 'principal');
      identidadOtroTenantId = await identidadCreadora(prisma, otroTenantId, 'ajena');
    });

    afterAll(async () => {
      if (servicioPrisma !== undefined) {
        await servicioPrisma.$disconnect().catch(() => undefined);
      }
      if (prisma !== undefined) {
        await retirarLoSembrado(prisma);
        await prisma.$disconnect();
      }
    });

    /* ------------------------------- Paso 0 -------------------------------- */

    describe('0 · la transición se ejecuta bajo el rol runtime real', () => {
      it('adopta merdn_runtime y fija el tenant dentro de la transacción', async () => {
        const contextoSql = await servicioPrisma.withTenant(tenantId, async (tx) => {
          const [fila] = await tx.$queryRaw<
            { readonly rol: string; readonly tenant: string | null }[]
          >`SELECT current_user::text AS rol, current_setting('merdn.tenant_id', true) AS tenant`;

          return fila;
        });

        expect(contextoSql?.rol).toBe('merdn_runtime');
        expect(contextoSql?.tenant).toBe(tenantId);
      });
    });

    /* ------------------------------- Paso 1 -------------------------------- */

    describe('1 · las cuatro transiciones legales', () => {
      it('SCHEDULED → IN_PROGRESS fija el inicio, deja el fin nulo y sube la versión', async () => {
        const caso = await escenario();
        const inicio = instante(1_000);

        const resultado = await servicio.transition(
          caso.principal,
          caso.homeVisitId,
          'IN_PROGRESS',
          caso.version,
          inicio,
        );

        expect(resultado).toMatchObject({
          homeVisitId: caso.homeVisitId,
          fromStatus: 'SCHEDULED',
          toStatus: 'IN_PROGRESS',
          version: caso.version + 1,
        });

        const visita = await estadoDe(caso.homeVisitId);

        expect(visita.status).toBe('IN_PROGRESS');
        // La versión se incrementa EXACTAMENTE una vez.
        expect(visita.version).toBe(caso.version + 1);
        expect(visita.startedAt?.toISOString()).toBe(inicio.toISOString());
        expect(visita.endedAt).toBeNull();
      });

      it('SCHEDULED → NOT_COMPLETED fija el fin y conserva el inicio nulo', async () => {
        const caso = await escenario();
        const fin = instante(1_000);

        await servicio.transition(
          caso.principal,
          caso.homeVisitId,
          'NOT_COMPLETED',
          caso.version,
          fin,
        );

        const visita = await estadoDe(caso.homeVisitId);

        expect(visita.status).toBe('NOT_COMPLETED');
        expect(visita.version).toBe(caso.version + 1);
        // La visita NUNCA empezó: su inicio sigue siendo nulo, y el check de
        // MP01 admite exactamente eso para este estado.
        expect(visita.startedAt).toBeNull();
        expect(visita.endedAt?.toISOString()).toBe(fin.toISOString());
      });

      it('IN_PROGRESS → COMPLETED fija el fin y PRESERVA el inicio ya registrado', async () => {
        const caso = await escenario();
        const inicio = instante(1_000);
        const fin = instante(2_000);

        const primera = await servicio.transition(
          caso.principal,
          caso.homeVisitId,
          'IN_PROGRESS',
          caso.version,
          inicio,
        );

        await servicio.transition(
          caso.principal,
          caso.homeVisitId,
          'COMPLETED',
          primera.version,
          fin,
        );

        const visita = await estadoDe(caso.homeVisitId);

        expect(visita.status).toBe('COMPLETED');
        expect(visita.version).toBe(caso.version + 2);
        // El inicio NO se sobrescribe con el instante del cierre.
        expect(visita.startedAt?.toISOString()).toBe(inicio.toISOString());
        expect(visita.endedAt?.toISOString()).toBe(fin.toISOString());
      });

      it('IN_PROGRESS → NOT_COMPLETED fija el fin y PRESERVA el inicio', async () => {
        const caso = await escenario();
        const inicio = instante(1_000);
        const fin = instante(2_000);

        const primera = await servicio.transition(
          caso.principal,
          caso.homeVisitId,
          'IN_PROGRESS',
          caso.version,
          inicio,
        );

        await servicio.transition(
          caso.principal,
          caso.homeVisitId,
          'NOT_COMPLETED',
          primera.version,
          fin,
        );

        const visita = await estadoDe(caso.homeVisitId);

        expect(visita.status).toBe('NOT_COMPLETED');
        expect(visita.version).toBe(caso.version + 2);
        expect(visita.startedAt?.toISOString()).toBe(inicio.toISOString());
        expect(visita.endedAt?.toISOString()).toBe(fin.toISOString());
      });
    });

    /* ------------------------------- Paso 2 -------------------------------- */

    describe('2 · historial append-only con actor humano y evento correcto', () => {
      it('registra la transición con la cuenta humana y el evento del destino', async () => {
        const caso = await escenario();
        const inicio = instante(1_000);

        const resultado = await servicio.transition(
          caso.principal,
          caso.homeVisitId,
          'IN_PROGRESS',
          caso.version,
          inicio,
        );

        const transiciones = await prisma.homeVisitTransition.findMany({
          where: { homeVisitId: caso.homeVisitId },
          orderBy: { occurredAt: 'asc' },
          select: {
            id: true,
            tenantId: true,
            fromStatus: true,
            toStatus: true,
            performedByHumanAccountId: true,
            occurredAt: true,
          },
        });

        // La de CREACIÓN de MP02 —sin actor humano— y la de MP03.
        expect(transiciones).toHaveLength(2);
        expect(transiciones[0]?.fromStatus).toBeNull();
        expect(transiciones[0]?.performedByHumanAccountId).toBeNull();

        const profesional = transiciones[1];
        expect(profesional?.id).toBe(resultado.transitionId);
        expect(profesional?.tenantId).toBe(tenantId);
        expect(profesional?.fromStatus).toBe('SCHEDULED');
        expect(profesional?.toStatus).toBe('IN_PROGRESS');
        // El actor es la CUENTA HUMANA del principal, no una identidad
        // institucional y no un profesional recibido desde fuera.
        expect(profesional?.performedByHumanAccountId).toBe(caso.principal.humanAccountId);
        expect(profesional?.occurredAt.toISOString()).toBe(inicio.toISOString());

        const eventos = await prisma.auditEvent.findMany({
          where: {
            resourceType: 'HomeVisit',
            resourceId: caso.homeVisitId,
            eventType: 'HOME_VISIT_STARTED',
          },
          select: {
            tenantId: true,
            actorType: true,
            actorUserId: true,
            actorRole: true,
            outcome: true,
            occurredAt: true,
            endpoint: true,
            correlationId: true,
          },
        });

        expect(eventos).toHaveLength(1);
        expect(eventos[0]?.tenantId).toBe(tenantId);
        expect(eventos[0]?.actorType).toBe('HUMAN_ACCOUNT');
        expect(eventos[0]?.actorUserId).toBe(caso.principal.humanAccountId);
        // `audit_event_actor_role_scope`: el rol solo acompaña a un actor
        // institucional, y `InstitutionalRole` no describe a una persona.
        expect(eventos[0]?.actorRole).toBeNull();
        expect(eventos[0]?.outcome).toBe('SUCCESS');
        expect(eventos[0]?.occurredAt.toISOString()).toBe(inicio.toISOString());
        // MP03 no crea endpoint: no se inventa un valor de relleno.
        expect(eventos[0]?.endpoint).toBeNull();
        expect(eventos[0]?.correlationId).toBeNull();
      });

      it('cada estado destino escribe su propio evento y ninguno más', async () => {
        const completada = await escenario();
        const primera = await servicio.transition(
          completada.principal,
          completada.homeVisitId,
          'IN_PROGRESS',
          completada.version,
          instante(1_000),
        );
        await servicio.transition(
          completada.principal,
          completada.homeVisitId,
          'COMPLETED',
          primera.version,
          instante(2_000),
        );

        const noRealizada = await escenario();
        await servicio.transition(
          noRealizada.principal,
          noRealizada.homeVisitId,
          'NOT_COMPLETED',
          noRealizada.version,
          instante(1_000),
        );

        const deCompletada = await prisma.auditEvent.findMany({
          where: { resourceType: 'HomeVisit', resourceId: completada.homeVisitId },
          orderBy: { occurredAt: 'asc' },
          select: { eventType: true },
        });
        const deNoRealizada = await prisma.auditEvent.findMany({
          where: { resourceType: 'HomeVisit', resourceId: noRealizada.homeVisitId },
          orderBy: { occurredAt: 'asc' },
          select: { eventType: true },
        });

        expect(deCompletada.map((evento) => evento.eventType)).toEqual([
          'HOME_VISIT_MATERIALIZED',
          'HOME_VISIT_STARTED',
          'HOME_VISIT_COMPLETED',
        ]);
        expect(deNoRealizada.map((evento) => evento.eventType)).toEqual([
          'HOME_VISIT_MATERIALIZED',
          'HOME_VISIT_NOT_COMPLETED',
        ]);
      });

      it('el evento no contiene dato personal, horario ni motivo', async () => {
        const caso = await escenario();

        const persona = await prisma.person.findUniqueOrThrow({
          where: { id: caso.principal.personId },
          select: { givenNames: true, familyNames: true, documentNumber: true },
        });

        await servicio.transition(
          caso.principal,
          caso.homeVisitId,
          'NOT_COMPLETED',
          caso.version,
          instante(1_000),
        );

        const evento = await prisma.auditEvent.findFirst({
          where: {
            resourceType: 'HomeVisit',
            resourceId: caso.homeVisitId,
            eventType: 'HOME_VISIT_NOT_COMPLETED',
          },
        });

        expect(evento).not.toBeNull();

        /*
         * Se comprueba sobre el evento COMPLETO serializado, de modo que la
         * prueba falle aunque el dato llegara en un campo que nadie previó.
         */
        const serializado = JSON.stringify(evento);

        for (const prohibido of [
          persona.givenNames,
          persona.familyNames,
          persona.documentNumber,
          // Horario de la cita: la agenda vive en `Appointment` y no se copia.
          HORARIO.toISOString(),
          // El paciente no se nombra en la traza de la transición.
          caso.patientId,
        ]) {
          expect(serializado).not.toContain(prohibido);
        }
      });
    });

    /* ------------------------------- Paso 3 -------------------------------- */

    describe('3 · solo la profesional asignada, y el desenlace es UNIFORME', () => {
      it('otra profesional del mismo tenant no puede transicionar la visita', async () => {
        const propio = await escenario();
        const ajeno = await escenario();

        // La profesional del segundo escenario es plenamente válida: lo que
        // falla es que NO está asignada a esta visita.
        expect(
          await desenlace(ajeno.principal, propio.homeVisitId, 'IN_PROGRESS', propio.version),
        ).toEqual({
          code: HOME_VISIT_TRANSITION_ERROR_CODES.notFound,
          status: 404,
        });

        // Y NADA cambió.
        const visita = await estadoDe(propio.homeVisitId);
        expect(visita.status).toBe('SCHEDULED');
        expect(visita.version).toBe(propio.version);
      });

      it('la visita de otro paciente produce el MISMO desenlace que una inexistente', async () => {
        const propio = await escenario();
        const otroPaciente = await escenario();

        const inexistente = await desenlace(
          propio.principal,
          randomUUID(),
          'IN_PROGRESS',
          propio.version,
        );
        const dePacienteAjeno = await desenlace(
          propio.principal,
          otroPaciente.homeVisitId,
          'IN_PROGRESS',
          otroPaciente.version,
        );

        expect(inexistente).toEqual({
          code: HOME_VISIT_TRANSITION_ERROR_CODES.notFound,
          status: 404,
        });
        // IDÉNTICO: distinguirlos confirmaría la existencia de un registro ajeno.
        expect(dePacienteAjeno).toEqual(inexistente);
      });

      it('una visita de otra institución es indistinguible de una inexistente', async () => {
        const ajena = await escenario(otroTenantId, identidadOtroTenantId);
        const propio = await escenario();

        /*
         * El principal es el de la institución propia: su `tenantId` fija el
         * contexto de la transacción y Row Level Security hace invisible la fila
         * ajena. El identificador de la visita ajena no basta para alcanzarla.
         */
        expect(
          await desenlace(propio.principal, ajena.homeVisitId, 'IN_PROGRESS', ajena.version),
        ).toEqual({
          code: HOME_VISIT_TRANSITION_ERROR_CODES.notFound,
          status: 404,
        });

        // La visita ajena sigue intacta en su propia institución.
        const visita = await estadoDe(ajena.homeVisitId);
        expect(visita.status).toBe('SCHEDULED');
        expect(visita.version).toBe(ajena.version);
      });

      it('la profesional de otra institución tampoco alcanza la visita', async () => {
        const propio = await escenario();
        const ajena = await escenario(otroTenantId, identidadOtroTenantId);

        expect(
          await desenlace(ajena.principal, propio.homeVisitId, 'IN_PROGRESS', propio.version),
        ).toEqual({
          code: HOME_VISIT_TRANSITION_ERROR_CODES.notFound,
          status: 404,
        });
      });
    });

    /* ------------------------------- Paso 4 -------------------------------- */

    describe('4 · asignación, perfil y afiliación deben estar activos y vigentes', () => {
      /*
       * La BASE ya impide desde HOSPITAL-CORE-02 los estados incoherentes:
       * `care_assignment_period_scope` obliga a que una asignación `ACTIVE` no
       * tenga fecha de fin, y `professional_affiliation_end_date_scope` a que
       * una afiliación no terminada tampoco la tenga. No existe por tanto una
       * fila `ACTIVE` con vigencia ya vencida, y esta prueba no la fabrica: la
       * caducidad se expresa TERMINANDO el vínculo, y la vigencia todavía no
       * abierta, con una fecha de inicio futura.
       */

      it('rechaza cuando la asignación de cuidado quedó ENDED', async () => {
        const caso = await escenario();

        await prisma.careAssignment.update({
          where: { id: caso.careAssignmentId },
          // El check exige la fecha de fin al terminar, y no antes del inicio.
          data: { status: 'ENDED', endsAt: instante(-60 * 60 * 1000) },
        });

        expect(
          await desenlace(caso.principal, caso.homeVisitId, 'IN_PROGRESS', caso.version),
        ).toEqual({
          code: HOME_VISIT_TRANSITION_ERROR_CODES.notFound,
          status: 404,
        });
      });

      it('rechaza cuando la asignación está ACTIVE pero su vigencia aún no empieza', async () => {
        const caso = await escenario();

        await prisma.careAssignment.update({
          where: { id: caso.careAssignmentId },
          data: { startsAt: instante(24 * 60 * 60 * 1000) },
        });

        expect(
          await desenlace(caso.principal, caso.homeVisitId, 'IN_PROGRESS', caso.version),
        ).toEqual({
          code: HOME_VISIT_TRANSITION_ERROR_CODES.notFound,
          status: 404,
        });
      });

      it('rechaza cuando el perfil profesional ya no está ACTIVE', async () => {
        const caso = await escenario();

        await prisma.professionalProfile.update({
          where: { id: caso.professionalId },
          data: { status: 'INACTIVE' },
        });

        expect(
          await desenlace(caso.principal, caso.homeVisitId, 'IN_PROGRESS', caso.version),
        ).toEqual({
          code: HOME_VISIT_TRANSITION_ERROR_CODES.notFound,
          status: 404,
        });
      });

      it('rechaza cuando la afiliación quedó ENDED', async () => {
        const caso = await escenario();

        await prisma.professionalAffiliation.updateMany({
          where: { professionalId: caso.professionalId },
          // Fechas PURAS, sin hora: así las almacena la columna `DATE`.
          data: { status: 'ENDED', endsOn: diaUtc(AHORA) },
        });

        expect(
          await desenlace(caso.principal, caso.homeVisitId, 'IN_PROGRESS', caso.version),
        ).toEqual({
          code: HOME_VISIT_TRANSITION_ERROR_CODES.notFound,
          status: 404,
        });
      });

      it('rechaza cuando la afiliación quedó INACTIVE', async () => {
        const caso = await escenario();

        await prisma.professionalAffiliation.updateMany({
          where: { professionalId: caso.professionalId },
          data: { status: 'INACTIVE' },
        });

        expect(
          await desenlace(caso.principal, caso.homeVisitId, 'IN_PROGRESS', caso.version),
        ).toEqual({
          code: HOME_VISIT_TRANSITION_ERROR_CODES.notFound,
          status: 404,
        });
      });

      it('rechaza cuando la afiliación está ACTIVE pero su vigencia aún no empieza', async () => {
        const caso = await escenario();

        await prisma.professionalAffiliation.updateMany({
          where: { professionalId: caso.professionalId },
          data: { startsOn: diaUtc(AHORA, 1) },
        });

        expect(
          await desenlace(caso.principal, caso.homeVisitId, 'IN_PROGRESS', caso.version),
        ).toEqual({
          code: HOME_VISIT_TRANSITION_ERROR_CODES.notFound,
          status: 404,
        });
      });

      it('un perfil sin NINGUNA afiliación no es profesional operativo', async () => {
        const caso = await escenario();

        await prisma.professionalAffiliation.deleteMany({
          where: { professionalId: caso.professionalId },
        });

        expect(
          await desenlace(caso.principal, caso.homeVisitId, 'IN_PROGRESS', caso.version),
        ).toEqual({
          code: HOME_VISIT_TRANSITION_ERROR_CODES.notFound,
          status: 404,
        });
      });
    });

    /* ------------------------------- Paso 5 -------------------------------- */

    describe('5 · versión obsoleta', () => {
      it('rechaza la versión que ya no es la vigente', async () => {
        const caso = await escenario();

        await servicio.transition(
          caso.principal,
          caso.homeVisitId,
          'IN_PROGRESS',
          caso.version,
          instante(1_000),
        );

        // Se reintenta con la versión ANTERIOR, que ya quedó obsoleta.
        expect(
          await desenlace(caso.principal, caso.homeVisitId, 'COMPLETED', caso.version),
        ).toEqual({
          code: HOME_VISIT_TRANSITION_ERROR_CODES.versionConflict,
          status: 409,
        });

        const visita = await estadoDe(caso.homeVisitId);
        expect(visita.status).toBe('IN_PROGRESS');
        expect(visita.version).toBe(caso.version + 1);
      });

      it('rechaza una versión que no es un entero positivo', async () => {
        const caso = await escenario();

        for (const version of [0, -1, 1.5, Number.NaN]) {
          expect(
            await desenlace(caso.principal, caso.homeVisitId, 'IN_PROGRESS', version),
          ).toEqual({
            code: HOME_VISIT_TRANSITION_ERROR_CODES.versionConflict,
            status: 409,
          });
        }

        const visita = await estadoDe(caso.homeVisitId);
        expect(visita.status).toBe('SCHEDULED');
        expect(visita.version).toBe(caso.version);
      });
    });

    /* ------------------------------- Paso 6 -------------------------------- */

    describe('6 · transición ilegal y estados terminales inmutables', () => {
      it('rechaza el salto SCHEDULED → COMPLETED', async () => {
        const caso = await escenario();

        expect(
          await desenlace(caso.principal, caso.homeVisitId, 'COMPLETED', caso.version),
        ).toEqual({
          code: HOME_VISIT_TRANSITION_ERROR_CODES.transitionNotAllowed,
          status: 409,
        });

        const visita = await estadoDe(caso.homeVisitId);
        expect(visita.status).toBe('SCHEDULED');
        expect(visita.version).toBe(caso.version);
      });

      it('rechaza repetir IN_PROGRESS sobre una visita ya iniciada', async () => {
        const caso = await escenario();

        const primera = await servicio.transition(
          caso.principal,
          caso.homeVisitId,
          'IN_PROGRESS',
          caso.version,
          instante(1_000),
        );

        expect(
          await desenlace(caso.principal, caso.homeVisitId, 'IN_PROGRESS', primera.version),
        ).toEqual({
          code: HOME_VISIT_TRANSITION_ERROR_CODES.transitionNotAllowed,
          status: 409,
        });
      });

      it('una visita COMPLETED no admite ninguna transición', async () => {
        const caso = await escenario();

        const primera = await servicio.transition(
          caso.principal,
          caso.homeVisitId,
          'IN_PROGRESS',
          caso.version,
          instante(1_000),
        );
        const segunda = await servicio.transition(
          caso.principal,
          caso.homeVisitId,
          'COMPLETED',
          primera.version,
          instante(2_000),
        );

        for (const objetivo of ['IN_PROGRESS', 'COMPLETED', 'NOT_COMPLETED'] as const) {
          expect(
            await desenlace(caso.principal, caso.homeVisitId, objetivo, segunda.version),
          ).toEqual({
            code: HOME_VISIT_TRANSITION_ERROR_CODES.transitionNotAllowed,
            status: 409,
          });
        }

        // Ni reapertura, ni reversión, ni una transición más en el historial.
        const visita = await estadoDe(caso.homeVisitId);
        expect(visita.status).toBe('COMPLETED');
        expect(visita.version).toBe(segunda.version);

        const transiciones = await prisma.homeVisitTransition.count({
          where: { homeVisitId: caso.homeVisitId },
        });
        expect(transiciones).toBe(3);
      });

      it('una visita NOT_COMPLETED no admite ninguna transición', async () => {
        const caso = await escenario();

        const terminal = await servicio.transition(
          caso.principal,
          caso.homeVisitId,
          'NOT_COMPLETED',
          caso.version,
          instante(1_000),
        );

        for (const objetivo of ['IN_PROGRESS', 'COMPLETED', 'NOT_COMPLETED'] as const) {
          expect(
            await desenlace(caso.principal, caso.homeVisitId, objetivo, terminal.version),
          ).toEqual({
            code: HOME_VISIT_TRANSITION_ERROR_CODES.transitionNotAllowed,
            status: 409,
          });
        }

        const visita = await estadoDe(caso.homeVisitId);
        expect(visita.status).toBe('NOT_COMPLETED');
        expect(visita.version).toBe(terminal.version);
      });
    });

    /* ------------------------------- Paso 7 -------------------------------- */

    describe('7 · una carrera concurrente deja exactamente un ganador', () => {
      it.skipIf(!carreraVerificable)(
        'dos transiciones simultáneas con la misma versión: una gana, la otra no',
        async () => {
          const caso = await escenario();

          const resultados = await Promise.allSettled([
            servicio.transition(
              caso.principal,
              caso.homeVisitId,
              'IN_PROGRESS',
              caso.version,
              instante(1_000),
            ),
            servicio.transition(
              caso.principal,
              caso.homeVisitId,
              'NOT_COMPLETED',
              caso.version,
              instante(1_000),
            ),
          ]);

          const ganadoras = resultados.filter((r) => r.status === 'fulfilled');
          const perdedoras = resultados.filter((r) => r.status === 'rejected');

          expect(ganadoras).toHaveLength(1);
          expect(perdedoras).toHaveLength(1);

          // La perdedora ve exactamente el desenlace de versión obsoleta.
          const rechazo = (perdedoras[0] as PromiseRejectedResult).reason as unknown;
          expect(rechazo).toBeInstanceOf(HomeVisitTransitionError);
          expect((rechazo as HomeVisitTransitionError).code).toBe(
            HOME_VISIT_TRANSITION_ERROR_CODES.versionConflict,
          );

          // La versión subió UNA sola vez y el historial recibió UNA transición
          // profesional, no dos.
          const visita = await estadoDe(caso.homeVisitId);
          expect(visita.version).toBe(caso.version + 1);

          const profesionales = await prisma.homeVisitTransition.count({
            where: { homeVisitId: caso.homeVisitId, fromStatus: { not: null } },
          });
          expect(profesionales).toBe(1);

          const eventos = await prisma.auditEvent.count({
            where: {
              resourceType: 'HomeVisit',
              resourceId: caso.homeVisitId,
              eventType: { in: ['HOME_VISIT_STARTED', 'HOME_VISIT_NOT_COMPLETED'] },
            },
          });
          expect(eventos).toBe(1);
        },
      );
    });

    /* ------------------------------- Paso 8 -------------------------------- */

    describe('8 · todo o nada: el fallo del historial o de la auditoría revierte', () => {
      it('no cambia el estado si el historial no puede escribirse', async () => {
        const caso = await escenario();

        /*
         * Principal cuya persona SÍ autoriza —es la profesional asignada— pero
         * cuya cuenta humana no existe. El fallo es REAL y de la base: la clave
         * foránea de `home_visit_transition` rechaza la atribución. Es el único
         * punto en que MP03 puede fallar tras haber actualizado la visita.
         */
        const sinCuenta: HumanPrincipal = {
          ...caso.principal,
          humanAccountId: randomUUID(),
        };

        await expect(
          servicio.transition(sinCuenta, caso.homeVisitId, 'IN_PROGRESS', caso.version, instante(1_000)),
        ).rejects.toThrow();

        // La actualización se revirtió COMPLETA: no hay cambio de estado sin
        // constancia de quién lo hizo.
        const visita = await estadoDe(caso.homeVisitId);
        expect(visita.status).toBe('SCHEDULED');
        expect(visita.version).toBe(caso.version);
        expect(visita.startedAt).toBeNull();

        const profesionales = await prisma.homeVisitTransition.count({
          where: { homeVisitId: caso.homeVisitId, fromStatus: { not: null } },
        });
        expect(profesionales).toBe(0);
      });

      it('no cambia el estado ni deja historial si la auditoría falla', async () => {
        const caso = await escenario();

        const auditoriaQueFalla = new AuditService();
        auditoriaQueFalla.recordHomeVisitTransitionWithin = async (): Promise<string> => {
          throw new Error('fallo simulado de auditoría');
        };

        const servicioConAuditoriaRota = new HomeVisitTransitionService(
          servicioPrisma,
          auditoriaQueFalla,
        );

        await expect(
          servicioConAuditoriaRota.transition(
            caso.principal,
            caso.homeVisitId,
            'IN_PROGRESS',
            caso.version,
            instante(1_000),
          ),
        ).rejects.toThrow(/fallo simulado de auditoría/u);

        const visita = await estadoDe(caso.homeVisitId);
        expect(visita.status).toBe('SCHEDULED');
        expect(visita.version).toBe(caso.version);
        expect(visita.startedAt).toBeNull();

        const profesionales = await prisma.homeVisitTransition.count({
          where: { homeVisitId: caso.homeVisitId, fromStatus: { not: null } },
        });
        expect(profesionales).toBe(0);

        const eventos = await prisma.auditEvent.count({
          where: {
            resourceType: 'HomeVisit',
            resourceId: caso.homeVisitId,
            eventType: 'HOME_VISIT_STARTED',
          },
        });
        expect(eventos).toBe(0);
      });

      it('la visita sigue transicionable después del fallo', async () => {
        const caso = await escenario();

        const auditoriaQueFalla = new AuditService();
        auditoriaQueFalla.recordHomeVisitTransitionWithin = async (): Promise<string> => {
          throw new Error('fallo simulado de auditoría');
        };

        await expect(
          new HomeVisitTransitionService(servicioPrisma, auditoriaQueFalla).transition(
            caso.principal,
            caso.homeVisitId,
            'IN_PROGRESS',
            caso.version,
            instante(1_000),
          ),
        ).rejects.toThrow();

        // La reversión fue COMPLETA: el reintento con la auditoría sana pasa, y
        // con la MISMA versión, porque la fallida no la consumió.
        const resultado = await servicio.transition(
          caso.principal,
          caso.homeVisitId,
          'IN_PROGRESS',
          caso.version,
          instante(2_000),
        );

        expect(resultado.toStatus).toBe('IN_PROGRESS');
        expect(resultado.version).toBe(caso.version + 1);
      });
    });
  },
);
