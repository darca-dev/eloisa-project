import { randomBytes, randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';

import { AuditService } from '../src/audit/audit.service';
import { type ApiEnvironment } from '../src/config/environment';
import { PrismaService } from '../src/database/prisma.service';
import { type PrismaClient } from '../src/generated/prisma/client';
import {
  HOME_VISIT_MATERIALIZATION_ERROR_CODES,
  HomeVisitMaterializationError,
  HomeVisitMaterializationService,
  type HomeVisitMaterializationContext,
} from '../src/visits/home-visit-materialization.service';

import { createTestPrismaClient, unavailableBanner } from './database-availability';
import { ensureOtherTenant } from './enrollment-fixtures';
import { crearCitaAsignada, crearSolicitud } from './hospital-core-02-fixtures';
import {
  crearPacienteFicticio,
  crearProfesionalFicticio,
} from './identity-relationships-fixtures';

/**
 * Servicio de materialización de la visita domiciliaria, contra PostgreSQL real
 * y bajo el rol de ejecución `merdn_runtime` (VISITS-CORE-01 MP02).
 *
 * ALCANCE EXACTO DE ESTA PRUEBA: la ÚNICA mutación transaccional de dominio que
 * MP02 crea. NO ejercita ningún endpoint, guard, DTO, módulo Nest ni interfaz,
 * porque el paquete no los crea. Lo que aquí se demuestra es que el SERVICIO:
 *
 *   1. materializa una cita `HOME` ya `ASSIGNED` escribiendo visita, transición
 *      de creación y evento de auditoría, los TRES presentes;
 *   2. confirma TODO O NADA: si la auditoría falla, la visita no queda;
 *   3. devuelve el MISMO desenlace para una cita inexistente y para una cita de
 *      OTRA institución, sin distinguirlas;
 *   4. rechaza modalidad distinta de `HOME` y estado distinto de `ASSIGNED`;
 *   5. rechaza la SEGUNDA materialización de la misma cita con el desenlace
 *      estable de conflicto;
 *   6. no registra en la auditoría ningún dato personal ni horario.
 *
 * TODAS las personas, pacientes, profesionales, citas e identidades son
 * FICTICIAS. Ninguna fila la crea la migración: la migración de MP02 solo añade
 * un valor de enum y NO inserta datos.
 *
 * LIMPIEZA ACOTADA: se retiran EXCLUSIVAMENTE las filas cuyos identificadores
 * esta prueba registró al sembrarlas, más los residuos que una ejecución
 * anterior de ella misma pudiera haber dejado, localizados por sus identidades
 * institucionales propias. NO se vacía `appointment`, `care_assignment`,
 * `patient`, `person` ni ninguna otra tabla compartida. `audit_event` es
 * append-only y NO se borra NUNCA.
 */

const availability = inject('databaseAvailability');
const puedeEjecutarse = availability.available && availability.migrated;

if (!puedeEjecutarse) {
  // eslint-disable-next-line no-console
  console.warn(`\n${unavailableBanner(availability)}\n`);
}

/** Prefijo de las identidades institucionales OPACAS sembradas aquí. */
const CODIGO_IDENTIDAD_BASE = 'home-visit-materializer-mp02';

/** Instante base de las citas sembradas. Fecha ficticia y determinista. */
const HORARIO = new Date(Date.UTC(2026, 7, 24, 16, 0, 0));

/** Instante del acto, fijado por el «servidor» de la prueba. Determinista. */
const AHORA = new Date(Date.UTC(2026, 7, 24, 12, 30, 0));

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
 * otros paquetes y a otras pruebas, y una prueba de MP02 no tiene autoridad
 * para retirarlos.
 */
interface Sembrado {
  readonly visitas: Set<string>;
  readonly citas: Set<string>;
  readonly asignaciones: Set<string>;
  readonly pacientes: Set<string>;
  readonly profesionales: Set<string>;
  readonly personas: Set<string>;
  readonly identidades: Set<string>;
}

const sembrado: Sembrado = {
  visitas: new Set<string>(),
  citas: new Set<string>(),
  asignaciones: new Set<string>(),
  pacientes: new Set<string>(),
  profesionales: new Set<string>(),
  personas: new Set<string>(),
  identidades: new Set<string>(),
};

/** `{ id: { in: [...] } }`, o `null` cuando no hay nada que retirar. */
function porId(ids: ReadonlySet<string>): { id: { in: string[] } } | null {
  return ids.size === 0 ? null : { id: { in: [...ids] } };
}

/**
 * Identidad institucional OPACA a la que se atribuye la materialización.
 *
 * La derivación almacenada es ALEATORIA y no corresponde a ninguna credencial:
 * nadie —tampoco la prueba— puede autenticarse con ella. Existe solo porque
 * `home_visit.createdByInstitutionalIdentityId` exige un actor institucional, y
 * ese actor NUNCA es la persona visitadora que ejecuta la visita.
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
 * claves foráneas: primero el historial, después las visitas, después citas y
 * asignaciones, después pacientes y perfiles profesionales, después las
 * personas y por último las identidades institucionales propias de MP02.
 *
 * El orden IMPORTA: `home_visit_transition` apunta a `home_visit` con
 * `RESTRICT` y `home_visit` apunta a `patient` con `RESTRICT`. Ninguna fila cae
 * en cascada, y esa rigidez es justamente la garantía que MP01 añadió.
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
 * El criterio es estrictamente MP02: se parte de las identidades institucionales
 * cuyo código lleva el prefijo reservado de este archivo y se desciende por las
 * asignaciones, citas, visitas e historial que ESAS identidades crearon. Nada
 * más se toca: las personas, los pacientes y los perfiles profesionales que
 * pudieran quedar sueltos pertenecen a fixtures COMPARTIDAS.
 */
async function retirarResiduosMp02(prisma: PrismaClient): Promise<void> {
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
    select: { id: true },
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
    await prisma.appointment.deleteMany({
      where: { careAssignmentId: { in: asignacionIds } },
    });
    await prisma.careAssignment.deleteMany({ where: { id: { in: asignacionIds } } });
  }

  await prisma.institutionalIdentity.deleteMany({ where: { id: { in: identidadIds } } });
}

describe.skipIf(!puedeEjecutarse)(
  'Servicio de materialización de la visita domiciliaria (VISITS-CORE-01 MP02)',
  () => {
    let prisma: PrismaClient;
    let servicioPrisma: PrismaService;
    let servicio: HomeVisitMaterializationService;

    let tenantId: string;
    let otroTenantId: string;

    let identidadId: string;
    let identidadOtroTenantId: string;

    /** Contexto institucional de la operación en el tenant propio. */
    let contexto: HomeVisitMaterializationContext;

    /**
     * Siembra un paciente nuevo con su cita asignada y activa.
     *
     * Cada escenario usa la SUYA para que un rechazo no dependa de otro y para
     * que la unicidad `(appointmentId, tenantId)` se ejercite a propósito y no
     * por contaminación entre casos.
     */
    async function citaAsignada(
      tenant: string,
      identidad: string,
      modality: 'ON_SITE' | 'HOME' | 'VIRTUAL' = 'HOME',
    ): Promise<{
      readonly appointmentId: string;
      readonly careAssignmentId: string;
      readonly patientId: string;
    }> {
      const paciente = await crearPacienteFicticio(prisma, tenant);
      const profesional = await crearProfesionalFicticio(prisma, tenant);

      sembrado.pacientes.add(paciente.patientId);
      sembrado.personas.add(paciente.personId);
      sembrado.profesionales.add(profesional.professionalId);
      sembrado.personas.add(profesional.personId);

      const cita = await crearCitaAsignada(prisma, {
        tenantId: tenant,
        patientId: paciente.patientId,
        professionalId: profesional.professionalId,
        identityId: identidad,
        modality,
        scheduledStart: HORARIO,
      });

      sembrado.citas.add(cita.appointmentId);
      sembrado.asignaciones.add(cita.careAssignmentId);

      return { ...cita, patientId: paciente.patientId };
    }

    /** Materializa registrando la visita creada para la limpieza acotada. */
    async function materializar(
      appointmentId: string,
      ctx: HomeVisitMaterializationContext = contexto,
    ): ReturnType<HomeVisitMaterializationService['materialize']> {
      const resultado = await servicio.materialize(ctx, appointmentId);
      sembrado.visitas.add(resultado.homeVisitId);

      return resultado;
    }

    /** Captura el desenlace de dominio sin depender del texto del mensaje. */
    async function desenlace(
      appointmentId: string,
      servicioUsado: HomeVisitMaterializationService = servicio,
    ): Promise<{ readonly code: string; readonly status: number }> {
      try {
        const resultado = await servicioUsado.materialize(contexto, appointmentId);
        sembrado.visitas.add(resultado.homeVisitId);

        throw new Error('La materialización debía rechazarse y no lo hizo.');
      } catch (error) {
        if (!(error instanceof HomeVisitMaterializationError)) {
          throw error;
        }

        return { code: error.code, status: error.status };
      }
    }

    beforeAll(async () => {
      prisma = createTestPrismaClient();
      // NO se vacía el entorno: solo se retiran los residuos de MP02.
      await retirarResiduosMp02(prisma);

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
      servicio = new HomeVisitMaterializationService(servicioPrisma, new AuditService());

      identidadId = await identidadCreadora(prisma, tenantId, 'principal');
      identidadOtroTenantId = await identidadCreadora(prisma, otroTenantId, 'ajena');

      contexto = {
        tenantId,
        identityId: identidadId,
        role: 'HOSPITAL_SCHEDULER',
        now: AHORA,
      };
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

    describe('0 · la materialización se ejecuta bajo el rol runtime real', () => {
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

    describe('1 · materialización válida', () => {
      it('crea visita, transición de creación y evento en la misma transacción', async () => {
        const cita = await citaAsignada(tenantId, identidadId);

        const resultado = await materializar(cita.appointmentId);

        expect(resultado.appointmentId).toBe(cita.appointmentId);
        expect(resultado.status).toBe('SCHEDULED');
        expect(resultado.version).toBe(1);

        /* (a) la visita, en estado SCHEDULED y sin inicio ni fin. */
        const visita = await prisma.homeVisit.findUnique({
          where: { id: resultado.homeVisitId },
          select: {
            tenantId: true,
            appointmentId: true,
            patientId: true,
            careAssignmentId: true,
            status: true,
            version: true,
            startedAt: true,
            endedAt: true,
            createdByInstitutionalIdentityId: true,
          },
        });

        expect(visita).not.toBeNull();
        expect(visita?.tenantId).toBe(tenantId);
        expect(visita?.appointmentId).toBe(cita.appointmentId);
        expect(visita?.patientId).toBe(cita.patientId);
        expect(visita?.careAssignmentId).toBe(cita.careAssignmentId);
        expect(visita?.status).toBe('SCHEDULED');
        expect(visita?.version).toBe(1);
        expect(visita?.startedAt).toBeNull();
        expect(visita?.endedAt).toBeNull();
        // El actor es la identidad institucional OPACA, nunca una persona.
        expect(visita?.createdByInstitutionalIdentityId).toBe(identidadId);

        /* (b) la transición de creación, SIN actor humano. */
        const transiciones = await prisma.homeVisitTransition.findMany({
          where: { homeVisitId: resultado.homeVisitId },
          select: {
            id: true,
            fromStatus: true,
            toStatus: true,
            performedByHumanAccountId: true,
          },
        });

        expect(transiciones).toHaveLength(1);
        expect(transiciones[0]?.id).toBe(resultado.creationTransitionId);
        expect(transiciones[0]?.fromStatus).toBeNull();
        expect(transiciones[0]?.toStatus).toBe('SCHEDULED');
        expect(transiciones[0]?.performedByHumanAccountId).toBeNull();

        /* (c) el evento de auditoría. */
        const eventos = await prisma.auditEvent.findMany({
          where: { resourceType: 'HomeVisit', resourceId: resultado.homeVisitId },
          select: {
            eventType: true,
            actorType: true,
            actorUserId: true,
            actorRole: true,
            outcome: true,
            occurredAt: true,
            endpoint: true,
            correlationId: true,
            tenantId: true,
          },
        });

        expect(eventos).toHaveLength(1);
        expect(eventos[0]?.eventType).toBe('HOME_VISIT_MATERIALIZED');
        expect(eventos[0]?.actorType).toBe('INSTITUTIONAL_IDENTITY');
        expect(eventos[0]?.actorUserId).toBe(identidadId);
        expect(eventos[0]?.actorRole).toBe('HOSPITAL_SCHEDULER');
        expect(eventos[0]?.outcome).toBe('SUCCESS');
        expect(eventos[0]?.tenantId).toBe(tenantId);
        expect(eventos[0]?.occurredAt.toISOString()).toBe(AHORA.toISOString());
        // MP02 no crea endpoint: no se inventa un valor de relleno.
        expect(eventos[0]?.endpoint).toBeNull();
        expect(eventos[0]?.correlationId).toBeNull();
      });

      it('no cambia el estado ni la versión de la cita', async () => {
        const cita = await citaAsignada(tenantId, identidadId);

        const antes = await prisma.appointment.findUnique({
          where: { id: cita.appointmentId },
          select: { status: true, version: true, scheduledStart: true },
        });

        await materializar(cita.appointmentId);

        const despues = await prisma.appointment.findUnique({
          where: { id: cita.appointmentId },
          select: { status: true, version: true, scheduledStart: true },
        });

        expect(despues).toEqual(antes);
      });
    });

    /* ------------------------------- Paso 2 -------------------------------- */

    describe('2 · atomicidad: todo o nada', () => {
      it('no deja visita ni transición si la auditoría falla', async () => {
        const cita = await citaAsignada(tenantId, identidadId);

        /*
         * Auditoría que FALLA después de que la visita y su transición ya se
         * escribieron en la transacción. Es el único punto en que MP02 puede
         * fallar tras haber persistido: si la transacción no se abortara
         * completa, quedaría una visita SIN rastro de auditoría.
         */
        const auditoriaQueFalla = new AuditService();
        auditoriaQueFalla.recordHomeVisitMaterializedWithin = async (): Promise<string> => {
          throw new Error('fallo simulado de auditoría');
        };

        const servicioConAuditoriaRota = new HomeVisitMaterializationService(
          servicioPrisma,
          auditoriaQueFalla,
        );

        await expect(
          servicioConAuditoriaRota.materialize(contexto, cita.appointmentId),
        ).rejects.toThrow(/fallo simulado de auditoría/u);

        const visitas = await prisma.homeVisit.findMany({
          where: { appointmentId: cita.appointmentId },
          select: { id: true },
        });

        expect(visitas).toHaveLength(0);

        const transiciones = await prisma.homeVisitTransition.count({
          where: { homeVisit: { appointmentId: cita.appointmentId } },
        });

        expect(transiciones).toBe(0);
      });

      it('la cita sigue materializable después del fallo', async () => {
        const cita = await citaAsignada(tenantId, identidadId);

        const auditoriaQueFalla = new AuditService();
        auditoriaQueFalla.recordHomeVisitMaterializedWithin = async (): Promise<string> => {
          throw new Error('fallo simulado de auditoría');
        };

        await expect(
          new HomeVisitMaterializationService(servicioPrisma, auditoriaQueFalla).materialize(
            contexto,
            cita.appointmentId,
          ),
        ).rejects.toThrow();

        // La reversión fue COMPLETA: el reintento con la auditoría sana pasa.
        const resultado = await materializar(cita.appointmentId);

        expect(resultado.status).toBe('SCHEDULED');
      });
    });

    /* ------------------------------- Paso 3 -------------------------------- */

    describe('3 · desenlace UNIFORME de la cita ajena', () => {
      it('cita inexistente y cita de otra institución producen el mismo desenlace', async () => {
        const inexistente = await desenlace(randomUUID());

        const citaAjena = await citaAsignada(otroTenantId, identidadOtroTenantId);
        const ajena = await desenlace(citaAjena.appointmentId);

        expect(inexistente).toEqual({
          code: HOME_VISIT_MATERIALIZATION_ERROR_CODES.appointmentNotFound,
          status: 404,
        });
        // IDÉNTICO: distinguirlos confirmaría la existencia de un registro ajeno.
        expect(ajena).toEqual(inexistente);

        // Y NADA se escribió en la institución ajena.
        const visitasAjenas = await prisma.homeVisit.count({
          where: { appointmentId: citaAjena.appointmentId },
        });

        expect(visitasAjenas).toBe(0);
      });
    });

    /* ------------------------------- Paso 4 -------------------------------- */

    describe('4 · modalidad y estado no admitidos', () => {
      it('rechaza la modalidad ON_SITE', async () => {
        const cita = await citaAsignada(tenantId, identidadId, 'ON_SITE');

        expect(await desenlace(cita.appointmentId)).toEqual({
          code: HOME_VISIT_MATERIALIZATION_ERROR_CODES.notMaterializable,
          status: 409,
        });
      });

      it('rechaza la modalidad VIRTUAL', async () => {
        const cita = await citaAsignada(tenantId, identidadId, 'VIRTUAL');

        expect(await desenlace(cita.appointmentId)).toEqual({
          code: HOME_VISIT_MATERIALIZATION_ERROR_CODES.notMaterializable,
          status: 409,
        });
      });

      it('rechaza la solicitud todavía no asignada', async () => {
        const paciente = await crearPacienteFicticio(prisma, tenantId);
        sembrado.pacientes.add(paciente.patientId);
        sembrado.personas.add(paciente.personId);

        // `REQUESTED`: sin asignación y sin fecha, como exige la base.
        const appointmentId = await crearSolicitud(prisma, {
          tenantId,
          patientId: paciente.patientId,
        });
        sembrado.citas.add(appointmentId);

        expect(await desenlace(appointmentId)).toEqual({
          code: HOME_VISIT_MATERIALIZATION_ERROR_CODES.notMaterializable,
          status: 409,
        });
      });

      it('rechaza la cita que dejó de estar ASSIGNED conservando su asignación', async () => {
        const cita = await citaAsignada(tenantId, identidadId);

        // `CANCELLED` conserva `careAssignmentId` y `scheduledStart`: el rechazo
        // proviene del guard de la BASE, no de una comprobación previa.
        await prisma.appointment.update({
          where: { id: cita.appointmentId },
          data: { status: 'CANCELLED' },
        });

        expect(await desenlace(cita.appointmentId)).toEqual({
          code: HOME_VISIT_MATERIALIZATION_ERROR_CODES.notMaterializable,
          status: 409,
        });

        const visitas = await prisma.homeVisit.count({
          where: { appointmentId: cita.appointmentId },
        });

        expect(visitas).toBe(0);
      });
    });

    /* ------------------------------- Paso 5 -------------------------------- */

    describe('5 · una cita materializa como mucho UNA visita', () => {
      it('rechaza la segunda materialización con el desenlace de conflicto', async () => {
        const cita = await citaAsignada(tenantId, identidadId);

        const primera = await materializar(cita.appointmentId);

        expect(await desenlace(cita.appointmentId)).toEqual({
          code: HOME_VISIT_MATERIALIZATION_ERROR_CODES.alreadyMaterialized,
          status: 409,
        });

        // La primera visita queda INTACTA y sigue siendo la única.
        const visitas = await prisma.homeVisit.findMany({
          where: { appointmentId: cita.appointmentId },
          select: { id: true },
        });

        expect(visitas).toHaveLength(1);
        expect(visitas[0]?.id).toBe(primera.homeVisitId);

        // Y el rechazo NO añadió una transición ni un segundo evento.
        const transiciones = await prisma.homeVisitTransition.count({
          where: { homeVisitId: primera.homeVisitId },
        });
        const eventos = await prisma.auditEvent.count({
          where: { resourceType: 'HomeVisit', resourceId: primera.homeVisitId },
        });

        expect(transiciones).toBe(1);
        expect(eventos).toBe(1);
      });
    });

    /* ------------------------------- Paso 6 -------------------------------- */

    describe('6 · la auditoría no contiene dato personal ni horario', () => {
      it('registra solo el recurso y su contexto institucional', async () => {
        const paciente = await crearPacienteFicticio(prisma, tenantId);
        const profesional = await crearProfesionalFicticio(prisma, tenantId);

        sembrado.pacientes.add(paciente.patientId);
        sembrado.personas.add(paciente.personId);
        sembrado.profesionales.add(profesional.professionalId);
        sembrado.personas.add(profesional.personId);

        const personas = await prisma.person.findMany({
          where: { id: { in: [paciente.personId, profesional.personId] } },
          select: { givenNames: true, familyNames: true, documentNumber: true },
        });

        const cita = await crearCitaAsignada(prisma, {
          tenantId,
          patientId: paciente.patientId,
          professionalId: profesional.professionalId,
          identityId: identidadId,
          modality: 'HOME',
          scheduledStart: HORARIO,
        });
        sembrado.citas.add(cita.appointmentId);
        sembrado.asignaciones.add(cita.careAssignmentId);

        const resultado = await materializar(cita.appointmentId);

        const evento = await prisma.auditEvent.findFirst({
          where: { resourceType: 'HomeVisit', resourceId: resultado.homeVisitId },
        });

        expect(evento).not.toBeNull();

        /*
         * Se comprueba sobre el evento COMPLETO serializado, de modo que la
         * prueba falle aunque el dato llegara en un campo que nadie previó.
         */
        const serializado = JSON.stringify(evento);

        const valoresProhibidos = [
          ...personas.flatMap((persona) => [
            persona.givenNames,
            persona.familyNames,
            persona.documentNumber,
          ]),
          // Horario de la cita: la agenda vive en `Appointment`, no en la traza.
          HORARIO.toISOString(),
          String(HORARIO.getTime()),
          // Identificadores de dominio que el evento NO debe copiar.
          paciente.patientId,
          paciente.personId,
          profesional.professionalId,
          profesional.personId,
          cita.appointmentId,
          cita.careAssignmentId,
        ];

        for (const valor of valoresProhibidos) {
          expect(serializado).not.toContain(valor);
        }

        // Lo que SÍ contiene: el recurso y su contexto institucional.
        expect(serializado).toContain(resultado.homeVisitId);
        expect(serializado).toContain(identidadId);
        expect(serializado).toContain(tenantId);
      });
    });
  },
);
