import { randomBytes } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';

import { type ApiEnvironment } from '../src/config/environment';
import { PrismaService, RUNTIME_ROLE_NAME } from '../src/database/prisma.service';
import { type PrismaClient } from '../src/generated/prisma/client';

import { createTestPrismaClient, unavailableBanner } from './database-availability';
import { ensureOtherTenant } from './enrollment-fixtures';
import { crearCitaAsignada, crearSolicitud } from './hospital-core-02-fixtures';
import {
  crearCuentaHumana,
  crearPacienteFicticio,
  crearProfesionalFicticio,
} from './identity-relationships-fixtures';

/**
 * Fundación PostgreSQL de la visita domiciliaria compartida, contra PostgreSQL
 * real (VISITS-CORE-01 MP01 — DB FOUNDATION).
 *
 * ALCANCE EXACTO DE ESTA PRUEBA: persistencia e integridad. No ejercita ningún
 * servicio, endpoint, guard, hook de Agenda ni interfaz, porque el paquete MP01
 * no los crea. Lo que aquí se demuestra es que la BASE DE DATOS —y no una capa
 * de aplicación que todavía no existe— sostiene:
 *
 *   1. la creación válida de una visita desde una cita `HOME` ya asignada;
 *   2. el rechazo de modalidades y estados de cita inválidos;
 *   3. el rechazo de una asignación inactiva o que no corresponde;
 *   4. una sola visita por cita;
 *   5. el rechazo de asociaciones entre tenants distintos;
 *   6. la coherencia de estado, el orden temporal de inicio y fin, y la máquina
 *      de transiciones;
 *   7. Row Level Security con dos tenants y con contexto ausente o equivocado;
 *   8. el mínimo privilegio del rol de ejecución sobre el historial append-only;
 *   9. que ningún borrado destruya en cascada la visita ni su historial, y que
 *      el guard de origen no bloquee el avance de una visita ya materializada.
 *
 * ROL RUNTIME REAL: salvo la SIEMBRA —que usa la credencial administrativa—,
 * todas las escrituras y lecturas comprobadas se ejecutan dentro de
 * `PrismaService.withTenant()` en modo `enforce`, es decir bajo `merdn_runtime`
 * —sin BYPASSRLS— y con el tenant fijado en la transacción. Las denegaciones
 * quedan por tanto respaldadas por PostgreSQL y no por un filtro de aplicación.
 *
 * TODAS las personas, pacientes, profesionales, citas y credenciales son
 * FICTICIAS. Ninguna fila la crea la migración: la migración de MP01 no inserta
 * datos de demostración.
 *
 * LIMPIEZA ACOTADA: esta prueba retira EXCLUSIVAMENTE las filas cuyos
 * identificadores registró al sembrarlas, más los residuos que una ejecución
 * anterior de ella misma pudiera haber dejado, localizados por sus identidades
 * institucionales propias. NO vacía `appointment`, `care_assignment`, `patient`,
 * `person` ni ninguna otra tabla compartida: esos datos pertenecen a otros
 * paquetes y a otras pruebas.
 */

const availability = inject('databaseAvailability');
const puedeEjecutarse = availability.available && availability.migrated;

if (!puedeEjecutarse) {
  // eslint-disable-next-line no-console
  console.warn(`\n${unavailableBanner(availability)}\n`);
}

/** Prefijo de las identidades institucionales OPACAS sembradas aquí. */
const CODIGO_IDENTIDAD_BASE = 'home-visit-creator-mp01';

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
 * Identidad institucional OPACA a la que se atribuye la materialización de las
 * visitas sembradas.
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
 * REGISTRO EXACTO de lo que esta prueba siembra.
 *
 * La limpieza retira ESTOS identificadores y NINGUNO más. Deliberadamente NO se
 * usa `deleteMany({})` sobre `appointment`, `care_assignment`, `patient`,
 * `person` ni ninguna otra tabla compartida: son datos de OTROS paquetes y de
 * otras pruebas, y una prueba de MP01 no tiene autoridad para retirarlos. Un
 * borrado global convertiría a esta prueba en un efecto colateral destructivo
 * sobre el entorno, que es justamente lo que la fundación de visitas existe para
 * impedir.
 */
interface Sembrado {
  readonly transiciones: Set<string>;
  readonly visitas: Set<string>;
  readonly citas: Set<string>;
  readonly asignaciones: Set<string>;
  readonly cuentasHumanas: Set<string>;
  readonly pacientes: Set<string>;
  readonly profesionales: Set<string>;
  readonly personas: Set<string>;
  readonly identidades: Set<string>;
}

function nuevoSembrado(): Sembrado {
  return {
    transiciones: new Set<string>(),
    visitas: new Set<string>(),
    citas: new Set<string>(),
    asignaciones: new Set<string>(),
    cuentasHumanas: new Set<string>(),
    pacientes: new Set<string>(),
    profesionales: new Set<string>(),
    personas: new Set<string>(),
    identidades: new Set<string>(),
  };
}

const sembrado = nuevoSembrado();

/** `{ id: { in: [...] } }`, o `null` cuando no hay nada que retirar. */
function porId(ids: ReadonlySet<string>): { id: { in: string[] } } | null {
  return ids.size === 0 ? null : { id: { in: [...ids] } };
}

/**
 * Retira EXCLUSIVAMENTE lo que esta prueba sembró, en el orden que exigen las
 * claves foráneas: primero el historial, después las visitas, después citas y
 * asignaciones, después cuentas humanas y sus vínculos, después pacientes y
 * perfiles profesionales, después las personas y por último las identidades
 * institucionales propias de MP01.
 *
 * El orden IMPORTA más que antes: desde esta migración `home_visit_transition`
 * apunta a `home_visit` con `RESTRICT` y `home_visit` apunta a `patient` con
 * `RESTRICT`. Ninguna fila cae en cascada, de modo que retirar una visita antes
 * que su historial —o un paciente antes que su visita— es un ERROR que
 * PostgreSQL rechaza. Esa rigidez es exactamente la garantía que MP01 añade:
 * la evidencia no desaparece como efecto colateral.
 *
 * NO borra eventos de auditoría: `audit_event` es append-only.
 */
async function retirarLoSembrado(prisma: PrismaClient): Promise<void> {
  const transiciones = porId(sembrado.transiciones);
  if (transiciones !== null) {
    await prisma.homeVisitTransition.deleteMany({ where: transiciones });
  }

  // Las transiciones que las propias pruebas insertaron sobre visitas
  // sembradas aquí: se localizan por la visita, nunca por un borrado global.
  const visitas = porId(sembrado.visitas);
  if (visitas !== null) {
    await prisma.homeVisitTransition.deleteMany({
      where: { homeVisitId: { in: [...sembrado.visitas] } },
    });
    await prisma.homeVisit.deleteMany({ where: visitas });
  }

  const citas = porId(sembrado.citas);
  if (citas !== null) {
    await prisma.appointment.deleteMany({ where: citas });
  }

  const asignaciones = porId(sembrado.asignaciones);
  if (asignaciones !== null) {
    await prisma.careAssignment.deleteMany({ where: asignaciones });
  }

  if (sembrado.cuentasHumanas.size > 0) {
    const cuentas = [...sembrado.cuentasHumanas];
    await prisma.humanSession.deleteMany({ where: { humanAccountId: { in: cuentas } } });
    await prisma.externalAuthIdentity.deleteMany({
      where: { humanAccountId: { in: cuentas } },
    });
    await prisma.humanAccount.deleteMany({ where: { id: { in: cuentas } } });
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
 * El criterio es estrictamente MP01: se parte de las identidades institucionales
 * cuyo código lleva el prefijo reservado de este archivo y se desciende por las
 * asignaciones, citas, visitas e historial que ESAS identidades crearon. Nada
 * más se toca: las personas, los pacientes y los perfiles profesionales que
 * pudieran quedar sueltos pertenecen a fixtures COMPARTIDAS, y retirarlos
 * exigiría el barrido global que esta corrección elimina.
 */
async function retirarResiduosMp01(prisma: PrismaClient): Promise<void> {
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

  // El historial ANTES que la visita y la visita ANTES que su cita y su
  // asignación: ninguna de las tres cae en cascada.
  if (visitaIds.length > 0) {
    await prisma.homeVisitTransition.deleteMany({
      where: { homeVisitId: { in: visitaIds } },
    });
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

/** Instante base de las citas sembradas. Fecha ficticia y determinista. */
const HORARIO = new Date(Date.UTC(2026, 7, 24, 14, 0, 0));

describe.skipIf(!puedeEjecutarse)(
  'Fundación PostgreSQL de la visita domiciliaria (VISITS-CORE-01 MP01)',
  () => {
    let prisma: PrismaClient;
    let servicio: PrismaService;

    let tenantId: string;
    let otroTenantId: string;

    let identidadId: string;
    let identidadOtroTenantId: string;

    /** Cita `HOME` + `ASSIGNED` sana, reservada a la creación válida. */
    let citaValida: { appointmentId: string; careAssignmentId: string; patientId: string };

    /** Cuenta humana OPACA que ejecuta las transiciones posteriores. */
    let cuentaHumanaId: string;
    /** Cuenta humana del OTRO tenant, para la clave foránea compuesta. */
    let cuentaHumanaOtroTenantId: string;

    /**
     * Siembra un paciente nuevo con su cita `HOME` asignada y activa.
     * Cada escenario usa la suya para que un rechazo no dependa de otro.
     */
    async function citaHomeAsignada(
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
      const { patientId } = paciente;
      const { professionalId } = profesional;

      sembrado.pacientes.add(patientId);
      sembrado.personas.add(paciente.personId);
      sembrado.profesionales.add(professionalId);
      sembrado.personas.add(profesional.personId);

      const cita = await crearCitaAsignada(prisma, {
        tenantId: tenant,
        patientId,
        professionalId,
        identityId: identidad,
        modality,
        scheduledStart: HORARIO,
      });

      sembrado.citas.add(cita.appointmentId);
      sembrado.asignaciones.add(cita.careAssignmentId);

      return { ...cita, patientId };
    }

    /** Crea una visita `SCHEDULED` bajo el rol runtime y el tenant indicado. */
    async function crearVisita(
      tenant: string,
      cita: { readonly appointmentId: string; readonly careAssignmentId: string; readonly patientId: string },
      identidad: string,
    ): Promise<string> {
      return servicio.withTenant(tenant, async (tx) => {
        const visita = await tx.homeVisit.create({
          data: {
            tenantId: tenant,
            appointmentId: cita.appointmentId,
            patientId: cita.patientId,
            careAssignmentId: cita.careAssignmentId,
            status: 'SCHEDULED',
            createdByInstitutionalIdentityId: identidad,
          },
          select: { id: true },
        });

        sembrado.visitas.add(visita.id);

        return visita.id;
      });
    }

    beforeAll(async () => {
      prisma = createTestPrismaClient();
      // NO se vacía el entorno: solo se retiran los residuos de MP01.
      await retirarResiduosMp01(prisma);

      const tenant = await prisma.tenant.findUnique({
        where: { code: process.env['MERDN_ACTIVE_TENANT_CODE'] ?? 'merdn-mvp' },
        select: { id: true },
      });

      if (tenant === null) {
        throw new Error('El tenant institucional MVP no existe: aplique las migraciones.');
      }
      tenantId = tenant.id;
      otroTenantId = await ensureOtherTenant(prisma);

      servicio = new PrismaService(entorno());

      identidadId = await identidadCreadora(prisma, tenantId, 'principal');
      identidadOtroTenantId = await identidadCreadora(prisma, otroTenantId, 'ajena');

      citaValida = await citaHomeAsignada(tenantId, identidadId);

      const persistidaPropia = await crearPacienteFicticio(prisma, tenantId);
      sembrado.pacientes.add(persistidaPropia.patientId);
      sembrado.personas.add(persistidaPropia.personId);
      cuentaHumanaId = (
        await crearCuentaHumana(prisma, { tenantId, personId: persistidaPropia.personId })
      ).humanAccountId;
      sembrado.cuentasHumanas.add(cuentaHumanaId);

      const persistidaAjena = await crearPacienteFicticio(prisma, otroTenantId);
      sembrado.pacientes.add(persistidaAjena.patientId);
      sembrado.personas.add(persistidaAjena.personId);
      cuentaHumanaOtroTenantId = (
        await crearCuentaHumana(prisma, {
          tenantId: otroTenantId,
          personId: persistidaAjena.personId,
        })
      ).humanAccountId;
      sembrado.cuentasHumanas.add(cuentaHumanaOtroTenantId);
    });

    afterAll(async () => {
      if (servicio !== undefined) {
        await servicio.$disconnect().catch(() => undefined);
      }
      if (prisma !== undefined) {
        await retirarLoSembrado(prisma);
        await prisma.$disconnect();
      }
    });

    /* ------------------------------- Paso 0 -------------------------------- */

    describe('0 · la prueba se ejecuta bajo el rol runtime real', () => {
      it('adopta merdn_runtime y fija el tenant dentro de la transacción', async () => {
        const contexto = await servicio.withTenant(tenantId, async (tx) => {
          const [fila] = await tx.$queryRaw<
            { readonly rol: string; readonly tenant: string | null }[]
          >`SELECT current_user::text AS rol, current_setting('merdn.tenant_id', true) AS tenant`;
          return fila;
        });

        // Sin esto, cualquier denegación posterior podría deberse solo a los
        // filtros de la aplicación y no a Row Level Security.
        expect(contexto?.rol).toBe(RUNTIME_ROLE_NAME);
        expect(contexto?.tenant).toBe(tenantId);
      });

      it('las dos tablas nuevas tienen Row Level Security habilitada y FORZADA', async () => {
        const filas = await prisma.$queryRaw<
          {
            readonly tabla: string;
            readonly habilitada: boolean;
            readonly forzada: boolean;
          }[]
        >`SELECT relname AS tabla,
                 relrowsecurity AS habilitada,
                 relforcerowsecurity AS forzada
            FROM pg_class
           WHERE relname IN ('home_visit', 'home_visit_transition')
           ORDER BY relname`;

        expect(filas).toStrictEqual([
          { tabla: 'home_visit', habilitada: true, forzada: true },
          { tabla: 'home_visit_transition', habilitada: true, forzada: true },
        ]);
      });
    });

    /* ------------------------------- Paso 1 -------------------------------- */

    describe('1 · creación válida desde una cita HOME asignada', () => {
      it('persiste la visita SCHEDULED y su transición de creación sin actor humano', async () => {
        const visitaId = await crearVisita(tenantId, citaValida, identidadId);

        const registrada = await servicio.withTenant(tenantId, async (tx) => {
          await tx.homeVisitTransition.create({
            data: {
              tenantId,
              homeVisitId: visitaId,
              fromStatus: null,
              toStatus: 'SCHEDULED',
              performedByHumanAccountId: null,
            },
          });

          return tx.homeVisit.findUnique({
            where: { id: visitaId },
            select: {
              status: true,
              version: true,
              startedAt: true,
              endedAt: true,
              appointmentId: true,
              patientId: true,
              careAssignmentId: true,
              createdByInstitutionalIdentityId: true,
              transitions: {
                select: {
                  fromStatus: true,
                  toStatus: true,
                  performedByHumanAccountId: true,
                },
              },
            },
          });
        });

        expect(registrada).toMatchObject({
          status: 'SCHEDULED',
          version: 1,
          startedAt: null,
          endedAt: null,
          appointmentId: citaValida.appointmentId,
          patientId: citaValida.patientId,
          careAssignmentId: citaValida.careAssignmentId,
          // El actor institucional OPACO que materializó la visita.
          createdByInstitutionalIdentityId: identidadId,
        });

        expect(registrada?.transitions).toStrictEqual([
          { fromStatus: null, toStatus: 'SCHEDULED', performedByHumanAccountId: null },
        ]);
      });

      it('la visita no duplica ni el profesional ni el horario de la cita', async () => {
        const columnas = await prisma.$queryRaw<{ readonly columna: string }[]>`
          SELECT column_name AS columna
            FROM information_schema.columns
           WHERE table_name = 'home_visit'`;

        const nombres = columnas.map((fila) => fila.columna);

        // La AUSENCIA de estas columnas es la garantía estructural: no existe
        // el valor que podría divergir de `care_assignment` ni de `appointment`.
        expect(nombres).not.toContain('professionalId');
        expect(nombres).not.toContain('scheduledStart');
      });
    });

    /* ------------------------------- Paso 2 -------------------------------- */

    describe('2 · modalidades y estados de cita inválidos', () => {
      it('una cita ON_SITE asignada no materializa visita domiciliaria', async () => {
        const cita = await citaHomeAsignada(tenantId, identidadId, 'ON_SITE');

        await expect(crearVisita(tenantId, cita, identidadId)).rejects.toThrow(
          /modalidad HOME/u,
        );
      });

      it('una cita VIRTUAL asignada no materializa visita domiciliaria', async () => {
        const cita = await citaHomeAsignada(tenantId, identidadId, 'VIRTUAL');

        await expect(crearVisita(tenantId, cita, identidadId)).rejects.toThrow(
          /modalidad HOME/u,
        );
      });

      it('una cita REQUESTED no materializa visita domiciliaria', async () => {
        // Una solicitud no tiene asignación ni fecha: lo impide
        // `appointment_status_shape`. La visita que la nombrara declararía una
        // asignación que la cita no reconoce.
        const cita = await citaHomeAsignada(tenantId, identidadId);
        const solicitudId = await crearSolicitud(prisma, {
          tenantId,
          patientId: cita.patientId,
          modality: 'HOME',
        });

        await expect(
          crearVisita(
            tenantId,
            { ...cita, appointmentId: solicitudId },
            identidadId,
          ),
        ).rejects.toThrow(/no coincide con la de la cita|cita ASSIGNED/u);
      });

      it('el paciente de la visita debe ser el de la cita', async () => {
        const cita = await citaHomeAsignada(tenantId, identidadId);
        const ajeno = await crearPacienteFicticio(prisma, tenantId);
        sembrado.pacientes.add(ajeno.patientId);
        sembrado.personas.add(ajeno.personId);

        await expect(
          crearVisita(tenantId, { ...cita, patientId: ajeno.patientId }, identidadId),
        ).rejects.toThrow(/no coincide con el de la cita/u);
      });
    });

    /* ------------------------------- Paso 3 -------------------------------- */

    describe('3 · asignación inactiva o que no corresponde', () => {
      it('una asignación TERMINADA no sostiene una visita', async () => {
        const cita = await citaHomeAsignada(tenantId, identidadId);

        await prisma.careAssignment.update({
          where: { id: cita.careAssignmentId },
          data: { status: 'ENDED', endsAt: new Date(Date.UTC(2026, 7, 23, 0, 0, 0)) },
        });

        await expect(crearVisita(tenantId, cita, identidadId)).rejects.toThrow(
          /debe estar ACTIVE/u,
        );
      });

      it('una asignación distinta de la que declara la cita no sostiene una visita', async () => {
        const cita = await citaHomeAsignada(tenantId, identidadId);
        const otra = await citaHomeAsignada(tenantId, identidadId);

        await expect(
          crearVisita(
            tenantId,
            { ...cita, careAssignmentId: otra.careAssignmentId },
            identidadId,
          ),
        ).rejects.toThrow(/no coincide con la de la cita/u);
      });

      it('una asignación de OTRO paciente no sostiene una visita', async () => {
        const cita = await citaHomeAsignada(tenantId, identidadId);
        const otra = await citaHomeAsignada(tenantId, identidadId);

        // La cita pasa a declarar la asignación de otro paciente: la base solo
        // exige que compartan tenant, de modo que el trigger es la barrera.
        await prisma.appointment.update({
          where: { id: cita.appointmentId },
          data: { careAssignmentId: otra.careAssignmentId },
        });

        await expect(
          crearVisita(
            tenantId,
            { ...cita, careAssignmentId: otra.careAssignmentId },
            identidadId,
          ),
        ).rejects.toThrow(/pertenece a otro paciente/u);
      });
    });

    /* ------------------------------- Paso 4 -------------------------------- */

    describe('4 · una sola visita por cita', () => {
      it('la segunda visita sobre la misma cita queda rechazada', async () => {
        const cita = await citaHomeAsignada(tenantId, identidadId);
        await crearVisita(tenantId, cita, identidadId);

        // Prisma no expone el nombre del índice al enmascarar el error, de modo
        // que se comprueban las dos cosas que sí son observables: el rechazo por
        // unicidad y que sigue existiendo UNA sola visita para esa cita.
        await expect(crearVisita(tenantId, cita, identidadId)).rejects.toThrow(
          /Unique constraint failed/u,
        );

        expect(
          await prisma.homeVisit.count({ where: { appointmentId: cita.appointmentId } }),
        ).toBe(1);
      });

      it('el índice único que lo sostiene existe y es tenant-aware', async () => {
        const indices = await prisma.$queryRaw<
          { readonly nombre: string; readonly definicion: string }[]
        >`SELECT indexname AS nombre, indexdef AS definicion
            FROM pg_indexes
           WHERE tablename = 'home_visit'
             AND indexname = 'home_visit_appointment_tenant_unique'`;

        expect(indices).toHaveLength(1);
        expect(indices[0]?.definicion).toMatch(/UNIQUE/u);
        expect(indices[0]?.definicion).toMatch(/appointmentId[\s\S]*tenantId/u);
      });
    });

    /* ------------------------------- Paso 5 -------------------------------- */

    describe('5 · aislamiento institucional en las claves foráneas', () => {
      it('una cita de OTRA institución no puede materializar una visita propia', async () => {
        const ajena = await citaHomeAsignada(otroTenantId, identidadOtroTenantId);

        // La cita existe de verdad y está asignada, vista con la credencial
        // administrativa: la denegación no se debe a que falten datos.
        expect(
          await prisma.appointment.count({
            where: { id: ajena.appointmentId, tenantId: otroTenantId, status: 'ASSIGNED' },
          }),
        ).toBe(1);

        await expect(
          servicio.withTenant(tenantId, async (tx) =>
            tx.homeVisit.create({
              data: {
                tenantId,
                appointmentId: ajena.appointmentId,
                patientId: ajena.patientId,
                careAssignmentId: ajena.careAssignmentId,
                status: 'SCHEDULED',
                createdByInstitutionalIdentityId: identidadId,
              },
            }),
          ),
        ).rejects.toThrow();

        expect(await prisma.homeVisit.count({ where: { tenantId } })).toBe(
          await prisma.homeVisit.count({ where: { tenantId, appointmentId: { not: ajena.appointmentId } } }),
        );
      });

      it('una cuenta humana de OTRA institución no puede firmar una transición', async () => {
        const cita = await citaHomeAsignada(tenantId, identidadId);
        const visitaId = await crearVisita(tenantId, cita, identidadId);

        // La cuenta existe de verdad, en el otro tenant.
        expect(
          await prisma.humanAccount.count({
            where: { id: cuentaHumanaOtroTenantId, tenantId: otroTenantId },
          }),
        ).toBe(1);

        // Clave foránea COMPUESTA `(performedByHumanAccountId, tenantId)`:
        // conocer el identificador no basta para atribuirle la transición.
        await expect(
          servicio.withTenant(tenantId, async (tx) =>
            tx.homeVisitTransition.create({
              data: {
                tenantId,
                homeVisitId: visitaId,
                fromStatus: 'SCHEDULED',
                toStatus: 'IN_PROGRESS',
                performedByHumanAccountId: cuentaHumanaOtroTenantId,
              },
            }),
          ),
        ).rejects.toThrow(/home_visit_transition_performed_by_fkey|foreign key/iu);
      });
    });

    /* ------------------------------- Paso 6 -------------------------------- */

    describe('6 · estado, timestamps y máquina de transiciones', () => {
      /** Intenta persistir una visita con los campos de estado indicados. */
      async function intentarEstado(campos: {
        readonly status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'NOT_COMPLETED';
        readonly version?: number;
        readonly startedAt?: Date | null;
        readonly endedAt?: Date | null;
      }): Promise<string> {
        const cita = await citaHomeAsignada(tenantId, identidadId);

        return servicio.withTenant(tenantId, async (tx) => {
          const visita = await tx.homeVisit.create({
            data: {
              tenantId,
              appointmentId: cita.appointmentId,
              patientId: cita.patientId,
              careAssignmentId: cita.careAssignmentId,
              status: campos.status,
              version: campos.version ?? 1,
              startedAt: campos.startedAt ?? null,
              endedAt: campos.endedAt ?? null,
              createdByInstitutionalIdentityId: identidadId,
            },
            select: { id: true },
          });

          sembrado.visitas.add(visita.id);

          return visita.id;
        });
      }

      const inicio = new Date(Date.UTC(2026, 7, 24, 14, 5, 0));
      const fin = new Date(Date.UTC(2026, 7, 24, 15, 0, 0));

      it('la versión del control optimista no puede ser cero', async () => {
        await expect(intentarEstado({ status: 'SCHEDULED', version: 0 })).rejects.toThrow(
          /home_visit_version_positive/u,
        );
      });

      it('SCHEDULED no admite inicio ni fin', async () => {
        await expect(
          intentarEstado({ status: 'SCHEDULED', startedAt: inicio }),
        ).rejects.toThrow(/home_visit_status_timestamps/u);

        await expect(
          intentarEstado({ status: 'SCHEDULED', endedAt: fin }),
        ).rejects.toThrow(/home_visit_status_timestamps/u);
      });

      it('IN_PROGRESS exige inicio y prohíbe fin', async () => {
        await expect(intentarEstado({ status: 'IN_PROGRESS' })).rejects.toThrow(
          /home_visit_status_timestamps/u,
        );

        await expect(
          intentarEstado({ status: 'IN_PROGRESS', startedAt: inicio, endedAt: fin }),
        ).rejects.toThrow(/home_visit_status_timestamps/u);

        await expect(
          intentarEstado({ status: 'IN_PROGRESS', startedAt: inicio }),
        ).resolves.toEqual(expect.any(String));
      });

      it('COMPLETED exige inicio y fin', async () => {
        await expect(
          intentarEstado({ status: 'COMPLETED', endedAt: fin }),
        ).rejects.toThrow(/home_visit_status_timestamps/u);

        await expect(
          intentarEstado({ status: 'COMPLETED', startedAt: inicio, endedAt: fin }),
        ).resolves.toEqual(expect.any(String));
      });

      it('NOT_COMPLETED exige fin y admite no haber empezado nunca', async () => {
        await expect(
          intentarEstado({ status: 'NOT_COMPLETED', startedAt: inicio }),
        ).rejects.toThrow(/home_visit_status_timestamps/u);

        // Originada desde `SCHEDULED`: la visita nunca empezó.
        await expect(
          intentarEstado({ status: 'NOT_COMPLETED', endedAt: fin }),
        ).resolves.toEqual(expect.any(String));

        // Originada desde `IN_PROGRESS`: ya había empezado.
        await expect(
          intentarEstado({ status: 'NOT_COMPLETED', startedAt: inicio, endedAt: fin }),
        ).resolves.toEqual(expect.any(String));
      });

      it('el fin NUNCA puede preceder al inicio', async () => {
        // Coherente con el estado —`COMPLETED` con inicio y fin— pero imposible
        // en el tiempo: lo rechaza el check de orden temporal, que es una
        // garantía DISTINTA de la coherencia con el estado.
        await expect(
          intentarEstado({ status: 'COMPLETED', startedAt: fin, endedAt: inicio }),
        ).rejects.toThrow(/home_visit_temporal_order/u);

        await expect(
          intentarEstado({ status: 'NOT_COMPLETED', startedAt: fin, endedAt: inicio }),
        ).rejects.toThrow(/home_visit_temporal_order/u);

        // La IGUALDAD se admite: una duración de cero no es una incoherencia y
        // este paquete no aprueba ninguna duración mínima.
        await expect(
          intentarEstado({ status: 'COMPLETED', startedAt: inicio, endedAt: inicio }),
        ).resolves.toEqual(expect.any(String));
      });

      /** Intenta persistir una transición sobre una visita recién creada. */
      async function intentarTransicion(
        visitaId: string,
        campos: {
          readonly fromStatus: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'NOT_COMPLETED' | null;
          readonly toStatus: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'NOT_COMPLETED';
          readonly actor: string | null;
        },
      ): Promise<string> {
        return servicio.withTenant(tenantId, async (tx) => {
          const transicion = await tx.homeVisitTransition.create({
            data: {
              tenantId,
              homeVisitId: visitaId,
              fromStatus: campos.fromStatus,
              toStatus: campos.toStatus,
              performedByHumanAccountId: campos.actor,
            },
            select: { id: true },
          });

          sembrado.transiciones.add(transicion.id);

          return transicion.id;
        });
      }

      it('la transición de creación es exactamente null → SCHEDULED y sin actor humano', async () => {
        const cita = await citaHomeAsignada(tenantId, identidadId);
        const visitaId = await crearVisita(tenantId, cita, identidadId);

        // Con actor humano: prohibida. Quien materializa es la identidad
        // institucional, no una persona.
        await expect(
          intentarTransicion(visitaId, {
            fromStatus: null,
            toStatus: 'SCHEDULED',
            actor: cuentaHumanaId,
          }),
        ).rejects.toThrow(/home_visit_transition_machine/u);

        // Hacia otro estado: prohibida.
        await expect(
          intentarTransicion(visitaId, {
            fromStatus: null,
            toStatus: 'IN_PROGRESS',
            actor: null,
          }),
        ).rejects.toThrow(/home_visit_transition_machine/u);

        await expect(
          intentarTransicion(visitaId, {
            fromStatus: null,
            toStatus: 'SCHEDULED',
            actor: null,
          }),
        ).resolves.toEqual(expect.any(String));

        // Exactamente UNA transición de creación por visita.
        await expect(
          intentarTransicion(visitaId, {
            fromStatus: null,
            toStatus: 'SCHEDULED',
            actor: null,
          }),
        ).rejects.toThrow(/Unique constraint failed/u);

        expect(
          await prisma.homeVisitTransition.count({
            where: { homeVisitId: visitaId, fromStatus: null },
          }),
        ).toBe(1);
      });

      it('el índice PARCIAL que garantiza una sola creación existe', async () => {
        const indices = await prisma.$queryRaw<
          { readonly nombre: string; readonly definicion: string }[]
        >`SELECT indexname AS nombre, indexdef AS definicion
            FROM pg_indexes
           WHERE tablename = 'home_visit_transition'
             AND indexname = 'home_visit_transition_creation_unique'`;

        expect(indices).toHaveLength(1);
        expect(indices[0]?.definicion).toMatch(/UNIQUE/u);
        // PARCIAL: solo compite la fila cuyo estado anterior es nulo, de modo
        // que la historia posterior no queda limitada a una sola fila.
        expect(indices[0]?.definicion).toMatch(/WHERE \("?fromStatus"? IS NULL\)/u);
      });

      it('toda transición posterior exige una cuenta humana', async () => {
        const cita = await citaHomeAsignada(tenantId, identidadId);
        const visitaId = await crearVisita(tenantId, cita, identidadId);

        await expect(
          intentarTransicion(visitaId, {
            fromStatus: 'SCHEDULED',
            toStatus: 'IN_PROGRESS',
            actor: null,
          }),
        ).rejects.toThrow(/home_visit_transition_machine/u);

        await expect(
          intentarTransicion(visitaId, {
            fromStatus: 'SCHEDULED',
            toStatus: 'IN_PROGRESS',
            actor: cuentaHumanaId,
          }),
        ).resolves.toEqual(expect.any(String));
      });

      it('solo son legales SCHEDULED→IN_PROGRESS|NOT_COMPLETED e IN_PROGRESS→COMPLETED|NOT_COMPLETED', async () => {
        const cita = await citaHomeAsignada(tenantId, identidadId);
        const visitaId = await crearVisita(tenantId, cita, identidadId);

        const legales = [
          { fromStatus: 'SCHEDULED', toStatus: 'NOT_COMPLETED' },
          { fromStatus: 'IN_PROGRESS', toStatus: 'COMPLETED' },
          { fromStatus: 'IN_PROGRESS', toStatus: 'NOT_COMPLETED' },
        ] as const;

        for (const paso of legales) {
          await expect(
            intentarTransicion(visitaId, { ...paso, actor: cuentaHumanaId }),
          ).resolves.toEqual(expect.any(String));
        }

        // Salto, reversión, reapertura y salida de un estado terminal.
        const ilegales = [
          { fromStatus: 'SCHEDULED', toStatus: 'COMPLETED' },
          { fromStatus: 'IN_PROGRESS', toStatus: 'SCHEDULED' },
          { fromStatus: 'COMPLETED', toStatus: 'IN_PROGRESS' },
          { fromStatus: 'NOT_COMPLETED', toStatus: 'IN_PROGRESS' },
          { fromStatus: 'COMPLETED', toStatus: 'NOT_COMPLETED' },
          { fromStatus: 'SCHEDULED', toStatus: 'SCHEDULED' },
        ] as const;

        for (const paso of ilegales) {
          await expect(
            intentarTransicion(visitaId, { ...paso, actor: cuentaHumanaId }),
          ).rejects.toThrow(/home_visit_transition_machine/u);
        }
      });
    });

    /* ------------------------------- Paso 7 -------------------------------- */

    describe('7 · Row Level Security con dos tenants y contexto ausente o equivocado', () => {
      let visitaPropiaId: string;
      let visitaAjenaId: string;

      beforeAll(async () => {
        const propia = await citaHomeAsignada(tenantId, identidadId);
        visitaPropiaId = await crearVisita(tenantId, propia, identidadId);

        const ajena = await citaHomeAsignada(otroTenantId, identidadOtroTenantId);
        visitaAjenaId = await crearVisita(otroTenantId, ajena, identidadOtroTenantId);
      });

      it('cada tenant ve exclusivamente sus propias visitas', async () => {
        const propias = await servicio.withTenant(tenantId, async (tx) =>
          tx.homeVisit.findMany({ select: { id: true, tenantId: true } }),
        );

        expect(propias.length).toBeGreaterThan(0);
        expect(propias.every((visita) => visita.tenantId === tenantId)).toBe(true);
        expect(propias.map((visita) => visita.id)).not.toContain(visitaAjenaId);
      });

      it('un identificador ajeno se comporta como inexistente', async () => {
        // La visita existe de verdad, vista con la credencial administrativa.
        expect(await prisma.homeVisit.count({ where: { id: visitaAjenaId } })).toBe(1);

        const encontrada = await servicio.withTenant(tenantId, async (tx) =>
          tx.homeVisit.findUnique({ where: { id: visitaAjenaId } }),
        );

        expect(encontrada).toBeNull();
      });

      it('no se puede escribir una visita en otro tenant desde el contexto propio', async () => {
        const ajena = await citaHomeAsignada(otroTenantId, identidadOtroTenantId);

        await expect(
          servicio.withTenant(tenantId, async (tx) =>
            tx.homeVisit.create({
              data: {
                tenantId: otroTenantId,
                appointmentId: ajena.appointmentId,
                patientId: ajena.patientId,
                careAssignmentId: ajena.careAssignmentId,
                status: 'SCHEDULED',
                createdByInstitutionalIdentityId: identidadOtroTenantId,
              },
            }),
          ),
        ).rejects.toThrow();
      });

      it('el historial ajeno tampoco es legible desde el contexto propio', async () => {
        await servicio.withTenant(otroTenantId, async (tx) => {
          await tx.homeVisitTransition.create({
            data: {
              tenantId: otroTenantId,
              homeVisitId: visitaAjenaId,
              fromStatus: null,
              toStatus: 'SCHEDULED',
              performedByHumanAccountId: null,
            },
          });
        });

        const visibles = await servicio.withTenant(tenantId, async (tx) =>
          tx.homeVisitTransition.findMany({
            where: { homeVisitId: visitaAjenaId },
            select: { id: true },
          }),
        );

        expect(visibles).toStrictEqual([]);
      });

      it('sin contexto de tenant la política no deja pasar ninguna fila', async () => {
        // Se adopta el rol runtime SIN fijar `merdn.tenant_id`: es exactamente
        // el caso de una conexión reutilizada sin contexto de petición.
        const resultado = await servicio.$transaction(async (tx) => {
          await tx.$executeRawUnsafe(`SET LOCAL ROLE "${RUNTIME_ROLE_NAME}"`);

          const [visitas] = await tx.$queryRaw<
            { readonly total: number }[]
          >`SELECT count(*)::int AS total FROM "home_visit"`;
          const [transiciones] = await tx.$queryRaw<
            { readonly total: number }[]
          >`SELECT count(*)::int AS total FROM "home_visit_transition"`;

          return { visitas: visitas?.total, transiciones: transiciones?.total };
        });

        expect(resultado).toStrictEqual({ visitas: 0, transiciones: 0 });

        // Y la lectura vacía no se debe a que no existan filas.
        expect(await prisma.homeVisit.count()).toBeGreaterThan(0);
        expect(await prisma.homeVisitTransition.count()).toBeGreaterThan(0);
      });

      it('con un tenant equivocado la escritura queda rechazada por WITH CHECK', async () => {
        const propia = await citaHomeAsignada(tenantId, identidadId);

        // Contexto del OTRO tenant y fila del propio: ni `USING` ni `WITH CHECK`
        // la admiten, y el trigger tampoco ve la cita.
        await expect(
          servicio.withTenant(otroTenantId, async (tx) =>
            tx.homeVisit.create({
              data: {
                tenantId,
                appointmentId: propia.appointmentId,
                patientId: propia.patientId,
                careAssignmentId: propia.careAssignmentId,
                status: 'SCHEDULED',
                createdByInstitutionalIdentityId: identidadId,
              },
            }),
          ),
        ).rejects.toThrow();

        expect(
          await prisma.homeVisit.count({ where: { appointmentId: propia.appointmentId } }),
        ).toBe(0);
      });

      it('la visita propia sigue siendo legible desde su propio contexto', async () => {
        const encontrada = await servicio.withTenant(tenantId, async (tx) =>
          tx.homeVisit.findUnique({
            where: { id: visitaPropiaId },
            select: { id: true, tenantId: true },
          }),
        );

        expect(encontrada).toStrictEqual({ id: visitaPropiaId, tenantId });
      });
    });

    /* ------------------------------- Paso 8 -------------------------------- */

    describe('8 · mínimo privilegio del rol de ejecución', () => {
      it('declara SELECT, INSERT y UPDATE sobre la visita, y jamás DELETE', async () => {
        const [privilegios] = await prisma.$queryRaw<
          {
            readonly leer: boolean;
            readonly insertar: boolean;
            readonly actualizar: boolean;
            readonly borrar: boolean;
          }[]
        >`SELECT has_table_privilege('merdn_runtime', 'home_visit', 'SELECT') AS leer,
                 has_table_privilege('merdn_runtime', 'home_visit', 'INSERT') AS insertar,
                 has_table_privilege('merdn_runtime', 'home_visit', 'UPDATE') AS actualizar,
                 has_table_privilege('merdn_runtime', 'home_visit', 'DELETE') AS borrar`;

        expect(privilegios).toStrictEqual({
          leer: true,
          insertar: true,
          actualizar: true,
          borrar: false,
        });
      });

      it('el historial es APPEND-ONLY: solo SELECT e INSERT', async () => {
        const [privilegios] = await prisma.$queryRaw<
          {
            readonly leer: boolean;
            readonly insertar: boolean;
            readonly actualizar: boolean;
            readonly borrar: boolean;
          }[]
        >`SELECT has_table_privilege('merdn_runtime', 'home_visit_transition', 'SELECT') AS leer,
                 has_table_privilege('merdn_runtime', 'home_visit_transition', 'INSERT') AS insertar,
                 has_table_privilege('merdn_runtime', 'home_visit_transition', 'UPDATE') AS actualizar,
                 has_table_privilege('merdn_runtime', 'home_visit_transition', 'DELETE') AS borrar`;

        expect(privilegios).toStrictEqual({
          leer: true,
          insertar: true,
          actualizar: false,
          borrar: false,
        });
      });

      it('el rol de ejecución no puede reescribir ni retirar una transición', async () => {
        // Declarar el privilegio no basta: se INTENTA de verdad.
        await expect(
          servicio.withTenant(tenantId, async (tx) =>
            tx.$executeRawUnsafe(
              `UPDATE "home_visit_transition" SET "toStatus" = 'COMPLETED'`,
            ),
          ),
        ).rejects.toThrow(/permission denied|permiso denegado/iu);

        await expect(
          servicio.withTenant(tenantId, async (tx) =>
            tx.$executeRawUnsafe(`DELETE FROM "home_visit_transition"`),
          ),
        ).rejects.toThrow(/permission denied|permiso denegado/iu);
      });

      it('el rol de ejecución tampoco puede retirar una visita', async () => {
        await expect(
          servicio.withTenant(tenantId, async (tx) =>
            tx.$executeRawUnsafe(`DELETE FROM "home_visit"`),
          ),
        ).rejects.toThrow(/permission denied|permiso denegado/iu);
      });
    });

    /* ------------------------------- Paso 9 -------------------------------- */

    describe('9 · el borrado no destruye procedencia ni evidencia', () => {
      /** Visita CON historial, usada solo para intentar destruirla. */
      let visitaConHistorial: {
        readonly visitaId: string;
        readonly appointmentId: string;
        readonly careAssignmentId: string;
        readonly patientId: string;
      };

      beforeAll(async () => {
        const cita = await citaHomeAsignada(tenantId, identidadId);
        const visitaId = await crearVisita(tenantId, cita, identidadId);

        await servicio.withTenant(tenantId, async (tx) => {
          const transicion = await tx.homeVisitTransition.create({
            data: {
              tenantId,
              homeVisitId: visitaId,
              fromStatus: null,
              toStatus: 'SCHEDULED',
              performedByHumanAccountId: null,
            },
            select: { id: true },
          });

          sembrado.transiciones.add(transicion.id);
        });

        visitaConHistorial = { visitaId, ...cita };
      });

      /**
       * Los intentos usan la credencial ADMINISTRATIVA a propósito: el rol de
       * ejecución ya no tiene `DELETE` —paso 8—, de modo que un rechazo suyo no
       * probaría nada sobre las REGLAS de borrado. Lo que se comprueba aquí es
       * que PostgreSQL rechaza el borrado incluso a quien SÍ tiene el privilegio.
       */
      it('borrar el paciente NO se lleva por delante su visita', async () => {
        await expect(
          prisma.patient.delete({ where: { id: visitaConHistorial.patientId } }),
        ).rejects.toThrow(/home_visit_patient_fkey|foreign key|llave foránea/iu);

        expect(
          await prisma.homeVisit.count({ where: { id: visitaConHistorial.visitaId } }),
        ).toBe(1);
      });

      it('borrar la cita o la asignación NO se lleva por delante su visita', async () => {
        await expect(
          prisma.appointment.delete({ where: { id: visitaConHistorial.appointmentId } }),
        ).rejects.toThrow(/home_visit_appointment_fkey|foreign key|llave foránea/iu);

        await expect(
          prisma.careAssignment.delete({
            where: { id: visitaConHistorial.careAssignmentId },
          }),
        ).rejects.toThrow(/home_visit_care_assignment_fkey|foreign key|llave foránea/iu);

        expect(
          await prisma.homeVisit.count({ where: { id: visitaConHistorial.visitaId } }),
        ).toBe(1);
      });

      it('borrar la visita NO se lleva por delante su historial', async () => {
        await expect(
          prisma.homeVisit.delete({ where: { id: visitaConHistorial.visitaId } }),
        ).rejects.toThrow(/home_visit_transition_visit_fkey|foreign key|llave foránea/iu);

        expect(
          await prisma.homeVisitTransition.count({
            where: { homeVisitId: visitaConHistorial.visitaId },
          }),
        ).toBe(1);
      });

      it('ninguna clave foránea de la visita ni del historial borra en cascada', async () => {
        const reglas = await prisma.$queryRaw<
          { readonly restriccion: string; readonly accion: string }[]
        >`SELECT conname AS restriccion, confdeltype::text AS accion
             FROM pg_constraint
            WHERE contype = 'f'
              AND conrelid IN ('home_visit'::regclass, 'home_visit_transition'::regclass)
            ORDER BY conname`;

        expect(reglas.length).toBeGreaterThan(0);
        // `a` = NO ACTION y `r` = RESTRICT. Jamás `c` = CASCADE.
        expect(
          reglas.every((regla) => regla.accion === 'a' || regla.accion === 'r'),
        ).toBe(true);
      });

      it('el guard valida el ORIGEN y no vuelve a exigir la cita en cada UPDATE', async () => {
        const cita = await citaHomeAsignada(tenantId, identidadId);
        const visitaId = await crearVisita(tenantId, cita, identidadId);

        // La asignación TERMINA DESPUÉS de materializada la visita.
        await prisma.careAssignment.update({
          where: { id: cita.careAssignmentId },
          data: { status: 'ENDED', endsAt: new Date(Date.UTC(2026, 7, 23, 0, 0, 0)) },
        });

        // La visita ya existente SIGUE pudiendo avanzar de estado: de otro modo
        // un hecho realmente ocurrido no podría registrarse jamás.
        const actualizada = await servicio.withTenant(tenantId, async (tx) =>
          tx.homeVisit.update({
            where: { id: visitaId },
            data: {
              status: 'IN_PROGRESS',
              startedAt: new Date(Date.UTC(2026, 7, 24, 14, 5, 0)),
              version: { increment: 1 },
            },
            select: { status: true, version: true },
          }),
        );

        expect(actualizada).toStrictEqual({ status: 'IN_PROGRESS', version: 2 });

        // El trigger existe SOLO para INSERT: es lo que declara el catálogo.
        const [disparador] = await prisma.$queryRaw<
          { readonly inserta: boolean; readonly actualiza: boolean }[]
        >`SELECT (tgtype & 4) <> 0 AS inserta, (tgtype & 16) <> 0 AS actualiza
             FROM pg_trigger
            WHERE tgname = 'home_visit_guard' AND NOT tgisinternal`;

        expect(disparador).toStrictEqual({ inserta: true, actualiza: false });
      });
    });
  },
);
