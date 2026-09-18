import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';

import { type PrismaClient } from '../src/generated/prisma/client';

import { createTestPrismaClient, unavailableBanner } from './database-availability';
import { cleanupTestData, ensureOtherTenant, nextTestDocument } from './enrollment-fixtures';
import {
  crearProfesional,
  crearSolicitud,
  limpiarOperacionesHospitalarias,
} from './hospital-core-02-fixtures';

/**
 * Modelo, restricciones y aislamiento de TASK-HOSPITAL-CORE-02, verificados
 * contra PostgreSQL real (§11.1).
 *
 * Comprueba lo que SOLO puede garantizar la base de datos:
 *
 *   1. coherencia de estados, periodos y versión;
 *   2. una sola asignación primaria ACTIVA por paciente dentro del tenant;
 *   3. claves foráneas COMPUESTAS que impiden asociaciones entre tenants;
 *   4. Row Level Security bajo un rol runtime sin BYPASSRLS, con contexto
 *      ausente o incorrecto fallando CERRADO;
 *   5. mínimo privilegio: ningún DELETE para el rol runtime, ningún INSERT de
 *      citas y ningún UPDATE de asignaciones.
 *
 * Si PostgreSQL no está disponible, la suite NO se sustituye por dobles de
 * prueba: se marca como no ejecutada con un motivo visible.
 */

const availability = inject('databaseAvailability');
const puedeEjecutarse = availability.available && availability.migrated;

if (!puedeEjecutarse) {
  // eslint-disable-next-line no-console
  console.warn(`\n${unavailableBanner(availability)}\n`);
}

/**
 * Las ESCRITURAS bajo el rol runtime solo pueden comprobarse contra un servidor
 * PostgreSQL normal.
 *
 * Es la limitación ya documentada en CORE-01: la compilación WebAssembly del
 * motor de desarrollo aborta su proceso ante cualquier escritura ejecutada bajo
 * `SET LOCAL ROLE merdn_runtime`, incluso una que no toque ninguna fila. No es
 * un fallo de las políticas —las LECTURAS bajo el mismo rol sí se comprueban
 * aquí y pasan—, sino del motor.
 *
 * Estas comprobaciones NO se sustituyen por dobles de prueba ni se relajan: se
 * marcan como NO EJECUTADAS con un motivo visible, y su verificación queda
 * pendiente de un servidor PostgreSQL con `MERDN_RUNTIME_ROLE=enforce`, un rol
 * no propietario y sin `BYPASSRLS`.
 *
 * Los PRIVILEGIOS concedidos sí se verifican en cualquier motor, leyendo el
 * catálogo: es una comprobación distinta y complementaria de la ejecución.
 */
const escrituraBajoRuntimeVerificable = availability.engine === 'postgresql-server';

if (puedeEjecutarse && !escrituraBajoRuntimeVerificable) {
  // eslint-disable-next-line no-console
  console.warn(
    '\nPRUEBAS NO EJECUTADAS: las ESCRITURAS bajo el rol merdn_runtime exigen un ' +
      'servidor PostgreSQL normal. El motor conectado es la compilación ' +
      'WebAssembly del entorno de desarrollo y aborta ante cualquier escritura ' +
      'ejecutada con ese rol. Las lecturas bajo RLS y los privilegios concedidos SÍ ' +
      'quedan verificados en esta ejecución; la aplicación efectiva de WITH CHECK y ' +
      'la denegación de DELETE/INSERT/UPDATE en ejecución quedan UNVERIFIED.\n',
  );
}

/** Adopta el rol runtime y fija el tenant, igual que hace la aplicación. */
async function comoRuntime<T>(
  prisma: PrismaClient,
  tenantId: string | null,
  work: (tx: Omit<PrismaClient, `$${string}`> & {
    $executeRawUnsafe: PrismaClient['$executeRawUnsafe'];
    $executeRaw: PrismaClient['$executeRaw'];
  }) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('SET LOCAL ROLE "merdn_runtime"');
    if (tenantId !== null) {
      await tx.$executeRaw`SELECT set_config('merdn.tenant_id', ${tenantId}, true)`;
    }
    return work(tx as never);
  });
}

describe.skipIf(!puedeEjecutarse)('Modelo de operaciones hospitalarias en PostgreSQL', () => {
  let prisma: PrismaClient;
  let tenantId: string;
  let otroTenantId: string;
  let identityId: string;
  let otraIdentityId: string;

  beforeAll(async () => {
    prisma = createTestPrismaClient();
    await limpiarOperacionesHospitalarias(prisma);
    await cleanupTestData(prisma);

    const tenant = await prisma.tenant.findUnique({
      where: { code: process.env['MERDN_ACTIVE_TENANT_CODE'] ?? 'merdn-mvp' },
      select: { id: true },
    });

    if (tenant === null) {
      throw new Error('El tenant institucional MVP no existe: aplique las migraciones.');
    }

    tenantId = tenant.id;
    otroTenantId = await ensureOtherTenant(prisma);

    identityId = await crearIdentidad(tenantId, 'db-core02-identidad-a');
    otraIdentityId = await crearIdentidad(otroTenantId, 'db-core02-identidad-b');
  });

  beforeEach(async () => {
    // Cada comprobación parte de un conjunto vacío: una fila superviviente
    // convertiría una prueba de aislamiento en un falso positivo o negativo.
    await limpiarOperacionesHospitalarias(prisma);
    await cleanupTestData(prisma);
  });

  afterAll(async () => {
    if (prisma !== undefined) {
      await limpiarOperacionesHospitalarias(prisma);
      await cleanupTestData(prisma);
      await prisma.institutionalIdentity.deleteMany({
        where: { code: { startsWith: 'db-core02-identidad' } },
      });
      await prisma.$disconnect();
    }
  });

  /**
   * Identidad institucional FICTICIA para poder atribuir una asignación.
   *
   * La derivación es un valor hexadecimal inventado con la forma que la base
   * exige. NO es una credencial: ninguna cadena en claro produce este hash, de
   * modo que esta identidad no autentica a nadie.
   */
  async function crearIdentidad(owner: string, code: string): Promise<string> {
    const existente = await prisma.institutionalIdentity.findFirst({
      where: { tenantId: owner, code },
      select: { id: true },
    });

    if (existente !== null) {
      return existente.id;
    }

    const creada = await prisma.institutionalIdentity.create({
      data: {
        tenantId: owner,
        code,
        role: 'HOSPITAL_SCHEDULER',
        accessSecretHash: 'a'.repeat(128),
        accessSecretSalt: 'b'.repeat(32),
      },
      select: { id: true },
    });

    return creada.id;
  }

  /** Paciente sintético mínimo, sin dirección ni pertenencias. */
  async function crearPaciente(owner: string): Promise<string> {
    const documento = nextTestDocument();

    const person = await prisma.person.create({
      data: {
        tenantId: owner,
        documentType: 'CEDULA_CIUDADANIA',
        documentNumber: documento,
        documentNumberNormalized: documento,
        givenNames: 'Delia',
        familyNames: 'Paciente Ficticia',
        birthDate: new Date(Date.UTC(1950, 3, 10)),
        sexGenderCode: 'PREFIERE_NO_DECIRLO',
      },
      select: { id: true },
    });

    const patient = await prisma.patient.create({
      data: {
        tenantId: owner,
        personId: person.id,
        epsCode: 'NUEVA_EPS',
        epsNameControlled: 'Nueva EPS',
        origin: 'PUBLIC_SELF_ENROLLMENT',
      },
      select: { id: true },
    });

    return patient.id;
  }

  async function crearAsignacion(options: {
    readonly owner: string;
    readonly patientId: string;
    readonly professionalId: string;
    readonly identity: string;
    readonly status?: 'ACTIVE' | 'ENDED';
  }): Promise<string> {
    const asignacion = await prisma.careAssignment.create({
      data: {
        tenantId: options.owner,
        patientId: options.patientId,
        professionalId: options.professionalId,
        role: 'PRIMARY',
        status: options.status ?? 'ACTIVE',
        startsAt: new Date(Date.UTC(2026, 7, 1)),
        endsAt: options.status === 'ENDED' ? new Date(Date.UTC(2026, 7, 15)) : null,
        createdByIdentityId: options.identity,
      },
      select: { id: true },
    });

    return asignacion.id;
  }

  /* ------------------- 1. Coherencia de estados y periodos ----------------- */

  describe('coherencia declarada por la base', () => {
    it('una solicitud no puede llevar fecha ni asignación', async () => {
      const patientId = await crearPaciente(tenantId);

      await expect(
        prisma.appointment.create({
          data: {
            tenantId,
            patientId,
            modality: 'HOME',
            status: 'REQUESTED',
            scheduledStart: new Date(Date.UTC(2026, 7, 22, 15, 0, 0)),
          },
        }),
      ).rejects.toThrow();
    });

    it('una cita asignada exige asignación Y fecha', async () => {
      const patientId = await crearPaciente(tenantId);
      const profesional = await crearProfesional(prisma, {
        tenantId,
        givenNames: 'Ana María',
        familyNames: 'Ejemplo Ficticio',
      });
      const careAssignmentId = await crearAsignacion({
        owner: tenantId,
        patientId,
        professionalId: profesional.professionalId,
        identity: identityId,
      });

      // Sin fecha.
      await expect(
        prisma.appointment.create({
          data: { tenantId, patientId, modality: 'HOME', status: 'ASSIGNED', careAssignmentId },
        }),
      ).rejects.toThrow();

      // Sin asignación.
      await expect(
        prisma.appointment.create({
          data: {
            tenantId,
            patientId,
            modality: 'HOME',
            status: 'ASSIGNED',
            scheduledStart: new Date(Date.UTC(2026, 7, 22, 15, 0, 0)),
          },
        }),
      ).rejects.toThrow();

      // Con ambas: se acepta.
      await expect(
        prisma.appointment.create({
          data: {
            tenantId,
            patientId,
            modality: 'HOME',
            status: 'ASSIGNED',
            careAssignmentId,
            scheduledStart: new Date(Date.UTC(2026, 7, 22, 15, 0, 0)),
          },
        }),
      ).resolves.toBeDefined();
    });

    it('la versión de la cita no puede ser menor que uno', async () => {
      const patientId = await crearPaciente(tenantId);
      const appointmentId = await crearSolicitud(prisma, { tenantId, patientId });

      await expect(
        prisma.appointment.update({ where: { id: appointmentId }, data: { version: 0 } }),
      ).rejects.toThrow();
    });

    it('una asignación ACTIVA no lleva fin y una TERMINADA sí', async () => {
      const patientId = await crearPaciente(tenantId);
      const profesional = await crearProfesional(prisma, {
        tenantId,
        givenNames: 'Bruno',
        familyNames: 'Prueba Ficticia',
      });

      await expect(
        prisma.careAssignment.create({
          data: {
            tenantId,
            patientId,
            professionalId: profesional.professionalId,
            status: 'ACTIVE',
            startsAt: new Date(Date.UTC(2026, 7, 1)),
            endsAt: new Date(Date.UTC(2026, 7, 10)),
            createdByIdentityId: identityId,
          },
        }),
      ).rejects.toThrow();

      await expect(
        prisma.careAssignment.create({
          data: {
            tenantId,
            patientId,
            professionalId: profesional.professionalId,
            status: 'ENDED',
            startsAt: new Date(Date.UTC(2026, 7, 1)),
            endsAt: null,
            createdByIdentityId: identityId,
          },
        }),
      ).rejects.toThrow();
    });

    it('un vínculo terminado declara su fin y no precede a su inicio', async () => {
      const profesional = await crearProfesional(prisma, {
        tenantId,
        givenNames: 'Carmen',
        familyNames: 'Tercera Ficticia',
        affiliation: null,
      });

      await expect(
        prisma.professionalAffiliation.create({
          data: {
            tenantId,
            professionalId: profesional.professionalId,
            engagementType: 'EMPLOYEE',
            status: 'ENDED',
            startsOn: new Date(Date.UTC(2026, 0, 15)),
            endsOn: new Date(Date.UTC(2025, 0, 15)),
          },
        }),
      ).rejects.toThrow();
    });

    it('el código de profesión no admite texto libre', async () => {
      const person = await prisma.person.create({
        data: {
          tenantId,
          documentType: 'CEDULA_CIUDADANIA',
          documentNumber: nextTestDocument(),
          documentNumberNormalized: nextTestDocument(),
          givenNames: 'Elena',
          familyNames: 'Codigo Ficticio',
          birthDate: new Date(Date.UTC(1985, 0, 1)),
          sexGenderCode: 'PREFIERE_NO_DECIRLO',
        },
        select: { id: true },
      });

      await expect(
        prisma.professionalProfile.create({
          data: {
            tenantId,
            personId: person.id,
            professionCode: 'medicina general; DROP TABLE',
            professionNameControlled: 'Medicina general',
          },
        }),
      ).rejects.toThrow();
    });
  });

  /* ----------- 2. Una sola asignación primaria activa por paciente --------- */

  describe('asignación primaria única', () => {
    it('rechaza una segunda asignación primaria ACTIVA del mismo paciente', async () => {
      const patientId = await crearPaciente(tenantId);
      const primero = await crearProfesional(prisma, {
        tenantId,
        givenNames: 'Ana María',
        familyNames: 'Ejemplo Ficticio',
      });
      const segundo = await crearProfesional(prisma, {
        tenantId,
        givenNames: 'Bruno',
        familyNames: 'Prueba Ficticia',
      });

      await crearAsignacion({
        owner: tenantId,
        patientId,
        professionalId: primero.professionalId,
        identity: identityId,
      });

      await expect(
        crearAsignacion({
          owner: tenantId,
          patientId,
          professionalId: segundo.professionalId,
          identity: identityId,
        }),
      ).rejects.toThrow();
    });

    it('una asignación TERMINADA no compite por la unicidad: la historia se conserva', async () => {
      const patientId = await crearPaciente(tenantId);
      const primero = await crearProfesional(prisma, {
        tenantId,
        givenNames: 'Ana María',
        familyNames: 'Ejemplo Ficticio',
      });
      const segundo = await crearProfesional(prisma, {
        tenantId,
        givenNames: 'Bruno',
        familyNames: 'Prueba Ficticia',
      });

      await crearAsignacion({
        owner: tenantId,
        patientId,
        professionalId: primero.professionalId,
        identity: identityId,
        status: 'ENDED',
      });

      await expect(
        crearAsignacion({
          owner: tenantId,
          patientId,
          professionalId: segundo.professionalId,
          identity: identityId,
        }),
      ).resolves.toBeDefined();

      expect(await prisma.careAssignment.count({ where: { tenantId, patientId } })).toBe(2);
    });
  });

  /* ------------------ 3. Claves foráneas entre instituciones --------------- */

  describe('claves foráneas compuestas', () => {
    it('un perfil no puede apuntar a una persona de otra institución', async () => {
      const ajena = await prisma.person.create({
        data: {
          tenantId: otroTenantId,
          documentType: 'CEDULA_CIUDADANIA',
          documentNumber: nextTestDocument(),
          documentNumberNormalized: nextTestDocument(),
          givenNames: 'Elena',
          familyNames: 'Ajena Ficticia',
          birthDate: new Date(Date.UTC(1985, 0, 1)),
          sexGenderCode: 'PREFIERE_NO_DECIRLO',
        },
        select: { id: true },
      });

      await expect(
        prisma.professionalProfile.create({
          data: {
            tenantId,
            personId: ajena.id,
            professionCode: 'MEDICINA_GENERAL',
            professionNameControlled: 'Medicina general',
          },
        }),
      ).rejects.toThrow();
    });

    it('una asignación no puede cruzar paciente, profesional ni identidad ajenos', async () => {
      const patientId = await crearPaciente(tenantId);
      const pacienteAjeno = await crearPaciente(otroTenantId);
      const propio = await crearProfesional(prisma, {
        tenantId,
        givenNames: 'Ana María',
        familyNames: 'Ejemplo Ficticio',
      });
      const ajeno = await crearProfesional(prisma, {
        tenantId: otroTenantId,
        givenNames: 'Elena',
        familyNames: 'Ajena Ficticia',
      });

      // Profesional de otra institución.
      await expect(
        crearAsignacion({
          owner: tenantId,
          patientId,
          professionalId: ajeno.professionalId,
          identity: identityId,
        }),
      ).rejects.toThrow();

      // Paciente de otra institución.
      await expect(
        crearAsignacion({
          owner: tenantId,
          patientId: pacienteAjeno,
          professionalId: propio.professionalId,
          identity: identityId,
        }),
      ).rejects.toThrow();

      // Identidad institucional de otra institución.
      await expect(
        crearAsignacion({
          owner: tenantId,
          patientId,
          professionalId: propio.professionalId,
          identity: otraIdentityId,
        }),
      ).rejects.toThrow();
    });

    it('una cita no puede enlazarse a una asignación de otra institución', async () => {
      const patientId = await crearPaciente(tenantId);
      const pacienteAjeno = await crearPaciente(otroTenantId);
      const ajeno = await crearProfesional(prisma, {
        tenantId: otroTenantId,
        givenNames: 'Elena',
        familyNames: 'Ajena Ficticia',
      });

      const asignacionAjena = await crearAsignacion({
        owner: otroTenantId,
        patientId: pacienteAjeno,
        professionalId: ajeno.professionalId,
        identity: otraIdentityId,
      });

      await expect(
        prisma.appointment.create({
          data: {
            tenantId,
            patientId,
            careAssignmentId: asignacionAjena,
            modality: 'HOME',
            status: 'ASSIGNED',
            scheduledStart: new Date(Date.UTC(2026, 7, 22, 15, 0, 0)),
          },
        }),
      ).rejects.toThrow();
    });
  });

  /* ----------------------- 4. Row Level Security --------------------------- */

  describe('Row Level Security bajo el rol runtime', () => {
    it('el rol runtime no es superusuario y no puede saltarse RLS', async () => {
      const roles = await prisma.$queryRawUnsafe<
        { readonly rolsuper: boolean; readonly rolbypassrls: boolean }[]
      >(`SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = 'merdn_runtime'`);

      expect(roles).toHaveLength(1);
      expect(roles[0]?.rolsuper).toBe(false);
      expect(roles[0]?.rolbypassrls).toBe(false);
    });

    it('las cuatro tablas nuevas tienen RLS habilitado y su política de tenant', async () => {
      const tablas = await prisma.$queryRawUnsafe<
        { readonly relname: string; readonly relrowsecurity: boolean }[]
      >(
        `SELECT relname, relrowsecurity FROM pg_class
          WHERE relname IN ('professional_profile','professional_affiliation','care_assignment','appointment')
          ORDER BY relname`,
      );

      expect(tablas).toHaveLength(4);
      expect(tablas.every((tabla) => tabla.relrowsecurity)).toBe(true);

      const politicas = await prisma.$queryRawUnsafe<{ readonly tablename: string }[]>(
        `SELECT tablename FROM pg_policies
          WHERE tablename IN ('professional_profile','professional_affiliation','care_assignment','appointment')
          ORDER BY tablename`,
      );

      expect(politicas.map((politica) => politica.tablename)).toStrictEqual([
        'appointment',
        'care_assignment',
        'professional_affiliation',
        'professional_profile',
      ]);
    });

    it('el tenant A no ve ni una fila del tenant B', async () => {
      const pacienteAjeno = await crearPaciente(otroTenantId);
      const ajeno = await crearProfesional(prisma, {
        tenantId: otroTenantId,
        givenNames: 'Elena',
        familyNames: 'Ajena Ficticia',
      });

      await crearAsignacion({
        owner: otroTenantId,
        patientId: pacienteAjeno,
        professionalId: ajeno.professionalId,
        identity: otraIdentityId,
      });
      await crearSolicitud(prisma, { tenantId: otroTenantId, patientId: pacienteAjeno });

      const propio = await crearProfesional(prisma, {
        tenantId,
        givenNames: 'Ana María',
        familyNames: 'Ejemplo Ficticio',
      });

      const visto = await comoRuntime(prisma, tenantId, async (tx) => ({
        perfiles: await tx.professionalProfile.findMany({ select: { id: true } }),
        vinculos: await tx.professionalAffiliation.count(),
        asignaciones: await tx.careAssignment.count(),
        citas: await tx.appointment.count(),
      }));

      expect(visto.perfiles.map((perfil) => perfil.id)).toStrictEqual([
        propio.professionalId,
      ]);
      expect(visto.vinculos).toBe(1);
      expect(visto.asignaciones).toBe(0);
      expect(visto.citas).toBe(0);
    });

    it('un identificador ajeno CONOCIDO tampoco se lee', async () => {
      const pacienteAjeno = await crearPaciente(otroTenantId);
      const ajeno = await crearProfesional(prisma, {
        tenantId: otroTenantId,
        givenNames: 'Elena',
        familyNames: 'Ajena Ficticia',
      });
      const citaAjena = await crearSolicitud(prisma, {
        tenantId: otroTenantId,
        patientId: pacienteAjeno,
      });

      const resultado = await comoRuntime(prisma, tenantId, async (tx) => ({
        perfil: await tx.professionalProfile.findFirst({
          where: { id: ajeno.professionalId },
        }),
        cita: await tx.appointment.findFirst({ where: { id: citaAjena } }),
      }));

      // Conocer el identificador NO basta: la política no lo devuelve.
      expect(resultado.perfil).toBeNull();
      expect(resultado.cita).toBeNull();
    });

    it.skipIf(!escrituraBajoRuntimeVerificable)(
      'un identificador ajeno CONOCIDO tampoco se muta',
      async () => {
        const pacienteAjeno = await crearPaciente(otroTenantId);
        const citaAjena = await crearSolicitud(prisma, {
          tenantId: otroTenantId,
          patientId: pacienteAjeno,
        });

        const mutadas = await comoRuntime(prisma, tenantId, async (tx) =>
          tx.appointment.updateMany({
            where: { id: citaAjena },
            data: { version: { increment: 1 } },
          }),
        );

        expect(mutadas.count).toBe(0);

        // Y la fila ajena sigue exactamente como estaba.
        const intacta = await prisma.appointment.findUnique({
          where: { id: citaAjena },
          select: { version: true },
        });

        expect(intacta?.version).toBe(1);
      },
    );

    it('sin contexto de tenant no se ve nada: falla CERRADO', async () => {
      await crearProfesional(prisma, {
        tenantId,
        givenNames: 'Ana María',
        familyNames: 'Ejemplo Ficticio',
      });

      const visibles = await comoRuntime(prisma, null, async (tx) =>
        tx.professionalProfile.count(),
      );

      expect(visibles).toBe(0);
    });

    it('un contexto de tenant inexistente tampoco abre nada', async () => {
      await crearProfesional(prisma, {
        tenantId,
        givenNames: 'Ana María',
        familyNames: 'Ejemplo Ficticio',
      });

      const visibles = await comoRuntime(
        prisma,
        '019287a1-0000-7000-8000-00000000dead',
        async (tx) => tx.professionalProfile.count(),
      );

      expect(visibles).toBe(0);
    });

    it.skipIf(!escrituraBajoRuntimeVerificable)(
      '`WITH CHECK` impide escribir una fila en otro tenant',
      async () => {
      const patientId = await crearPaciente(tenantId);
      const propio = await crearProfesional(prisma, {
        tenantId,
        givenNames: 'Ana María',
        familyNames: 'Ejemplo Ficticio',
      });

      await expect(
        comoRuntime(prisma, tenantId, async (tx) =>
          tx.careAssignment.create({
            data: {
              tenantId: otroTenantId,
              patientId,
              professionalId: propio.professionalId,
              role: 'PRIMARY',
              status: 'ACTIVE',
              startsAt: new Date(Date.UTC(2026, 7, 1)),
              createdByIdentityId: identityId,
            },
          }),
        ),
      ).rejects.toThrow();
      },
    );
  });

  /* --------------------------- 5. Mínimo privilegio ------------------------ */

  describe('mínimo privilegio del rol runtime', () => {
    /*
     * Verificación por CATÁLOGO: es independiente del motor y describe lo que
     * el rol puede hacer, no lo que en una ejecución concreta hizo.
     */
    it('tiene exactamente los privilegios declarados y ningún DELETE', async () => {
      const concedidos = await prisma.$queryRawUnsafe<
        { readonly table_name: string; readonly privilege_type: string }[]
      >(
        `SELECT table_name, privilege_type
           FROM information_schema.role_table_grants
          WHERE grantee = 'merdn_runtime'
            AND table_name IN ('professional_profile','professional_affiliation','care_assignment','appointment')
          ORDER BY table_name, privilege_type`,
      );

      const porTabla = new Map<string, string[]>();

      for (const fila of concedidos) {
        porTabla.set(fila.table_name, [
          ...(porTabla.get(fila.table_name) ?? []),
          fila.privilege_type,
        ]);
      }

      // El alta de profesionales y la creación de citas NO están autorizadas.
      expect(porTabla.get('professional_profile')).toStrictEqual(['SELECT']);
      expect(porTabla.get('professional_affiliation')).toStrictEqual(['SELECT']);
      // Terminar o reasignar exige otra Task: no hay UPDATE.
      expect(porTabla.get('care_assignment')?.sort()).toStrictEqual(['INSERT', 'SELECT']);
      // La única escritura del slice es actualizar una cita.
      expect(porTabla.get('appointment')?.sort()).toStrictEqual(['SELECT', 'UPDATE']);

      // En ninguna tabla, bajo ninguna forma, hay DELETE: la historia no se borra.
      expect(concedidos.map((fila) => fila.privilege_type)).not.toContain('DELETE');
      expect(concedidos.map((fila) => fila.privilege_type)).not.toContain('TRUNCATE');
    });

    it.skipIf(!escrituraBajoRuntimeVerificable)(
      'no puede BORRAR en ninguna de las cuatro tablas',
      async () => {
      const patientId = await crearPaciente(tenantId);
      const profesional = await crearProfesional(prisma, {
        tenantId,
        givenNames: 'Ana María',
        familyNames: 'Ejemplo Ficticio',
      });

      await crearAsignacion({
        owner: tenantId,
        patientId,
        professionalId: profesional.professionalId,
        identity: identityId,
      });
      await crearSolicitud(prisma, { tenantId, patientId });

      for (const tabla of [
        'appointment',
        'care_assignment',
        'professional_affiliation',
        'professional_profile',
      ]) {
        await expect(
          comoRuntime(prisma, tenantId, async (tx) =>
            tx.$executeRawUnsafe(`DELETE FROM "${tabla}"`),
          ),
        ).rejects.toThrow();
      }
      },
    );

    it.skipIf(!escrituraBajoRuntimeVerificable)(
      'no puede CREAR citas ni perfiles: el alta no está autorizada en este slice',
      async () => {
      const patientId = await crearPaciente(tenantId);

      await expect(
        comoRuntime(prisma, tenantId, async (tx) =>
          tx.$executeRawUnsafe(
            `INSERT INTO "appointment" ("id","tenantId","patientId","modality","status","updatedAt")
             VALUES (gen_random_uuid(), '${tenantId}', '${patientId}', 'HOME', 'REQUESTED', now())`,
          ),
        ),
      ).rejects.toThrow();

      await expect(
        comoRuntime(prisma, tenantId, async (tx) =>
          tx.$executeRawUnsafe(
            `INSERT INTO "professional_profile" ("id","tenantId","personId","professionCode","professionNameControlled","status","updatedAt")
             VALUES (gen_random_uuid(), '${tenantId}', gen_random_uuid(), 'MEDICINA_GENERAL', 'Medicina general', 'ACTIVE', now())`,
          ),
        ),
      ).rejects.toThrow();
      },
    );

    it.skipIf(!escrituraBajoRuntimeVerificable)(
      'no puede ACTUALIZAR una asignación: terminar o reasignar es otra Task',
      async () => {
      const patientId = await crearPaciente(tenantId);
      const profesional = await crearProfesional(prisma, {
        tenantId,
        givenNames: 'Ana María',
        familyNames: 'Ejemplo Ficticio',
      });
      const asignacion = await crearAsignacion({
        owner: tenantId,
        patientId,
        professionalId: profesional.professionalId,
        identity: identityId,
      });

      await expect(
        comoRuntime(prisma, tenantId, async (tx) =>
          tx.$executeRawUnsafe(
            `UPDATE "care_assignment" SET "status" = 'ENDED' WHERE "id" = '${asignacion}'`,
          ),
        ),
      ).rejects.toThrow();
      },
    );

    it.skipIf(!escrituraBajoRuntimeVerificable)(
      'SÍ puede actualizar una cita del propio tenant: es la única escritura del slice',
      async () => {
        const patientId = await crearPaciente(tenantId);
        const appointmentId = await crearSolicitud(prisma, { tenantId, patientId });

        const actualizadas = await comoRuntime(prisma, tenantId, async (tx) =>
          tx.appointment.updateMany({
            where: { id: appointmentId, tenantId },
            data: { version: { increment: 1 } },
          }),
        );

        expect(actualizadas.count).toBe(1);
      },
    );
  });
});
