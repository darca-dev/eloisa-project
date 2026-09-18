import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';

import { type PrismaClient } from '../src/generated/prisma/client';
import { hashSessionToken } from '../src/enrollment-sessions/enrollment-session.tokens';

import { createTestPrismaClient, unavailableBanner } from './database-availability';
import {
  DEPARTMENT_CODE,
  MUNICIPALITY_CODE,
  OTHER_DEPARTMENT_CODE,
  cleanupTestData,
  ensureLocalUnit,
  ensureOtherTenant,
  nextTestDocument,
  territorialUnitId,
} from './enrollment-fixtures';

/**
 * Endurecimiento de CORE-01 verificado contra PostgreSQL real
 * (corrección final autorizada por Codex).
 *
 * Comprueba las garantías que SOLO puede dar la base de datos:
 * 1. área urbana o rural obligatoria;
 * 2. integridad de la jerarquía territorial y de su tenant;
 * 3. auditoría append-only;
 * 4. Row Level Security con un rol runtime sin BYPASSRLS.
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

describe.skipIf(!puedeEjecutarse)('Endurecimiento de CORE-01 en PostgreSQL', () => {
  let prisma: PrismaClient;
  let tenantId: string;
  let otherTenantId: string;
  let departmentId: string;
  let municipalityId: string;

  beforeAll(async () => {
    prisma = createTestPrismaClient();
    await cleanupTestData(prisma);

    const tenant = await prisma.tenant.findUnique({
      where: { code: process.env['MERDN_ACTIVE_TENANT_CODE'] ?? 'merdn-mvp' },
      select: { id: true },
    });

    if (tenant === null) {
      throw new Error('El tenant institucional MVP no existe: aplique las migraciones.');
    }

    tenantId = tenant.id;
    otherTenantId = await ensureOtherTenant(prisma);
    departmentId = await territorialUnitId(prisma, 'DEPARTMENT', DEPARTMENT_CODE);
    municipalityId = await territorialUnitId(prisma, 'MUNICIPALITY', MUNICIPALITY_CODE);
  });

  afterAll(async () => {
    if (prisma !== undefined) {
      await cleanupTestData(prisma);
      await prisma.$disconnect();
    }
  });

  /** Inscripción mínima y ficticia, con el área declarada. */
  async function crearPaciente(options: {
    readonly tenantId?: string;
    readonly areaType?: 'URBAN' | 'RURAL';
    readonly localUnitId?: string;
  } = {}): Promise<{ readonly patientId: string; readonly personId: string }> {
    const documento = nextTestDocument();
    const owner = options.tenantId ?? tenantId;
    const local = options.localUnitId ?? null;

    return prisma.$transaction(async (tx) => {
      const person = await tx.person.create({
        data: {
          tenantId: owner,
          documentType: 'CEDULA_CIUDADANIA',
          documentNumber: documento,
          documentNumberNormalized: documento,
          givenNames: 'Ana María',
          familyNames: 'Ejemplo Ficticio',
          birthDate: new Date(Date.UTC(1958, 3, 12)),
          sexGenderCode: 'FEMENINO',
        },
        select: { id: true },
      });

      const patient = await tx.patient.create({
        data: {
          tenantId: owner,
          personId: person.id,
          epsCode: 'NUEVA_EPS',
          epsNameControlled: 'Nueva EPS',
          origin: 'PUBLIC_SELF_ENROLLMENT',
        },
        select: { id: true },
      });

      await tx.patientAddress.create({
        data: {
          tenantId: owner,
          patientId: patient.id,
          departmentUnitId: departmentId,
          municipalityUnitId: municipalityId,
          localUnitId: local,
          areaType: options.areaType ?? 'URBAN',
          localityPendingNormalization: local === null,
          localityUnverifiedText: local === null ? 'La Esperanza' : null,
          exactAddress: 'Cra 45 # 32-16',
        },
      });

      await tx.enrollmentSession.create({
        data: {
          tenantId: owner,
          patientId: patient.id,
          tokenHash: hashSessionToken(`token-${documento}-${owner}`),
          expiresAt: new Date(Date.now() + 3_600_000),
        },
      });

      await tx.auditEvent.create({
        data: {
          tenantId: owner,
          eventType: 'PATIENT_ENROLLMENT_CREATED',
          actorType: 'PUBLIC_SELF_ENROLLMENT',
          resourceType: 'Patient',
          resourceId: patient.id,
          outcome: 'SUCCESS',
        },
      });

      return { patientId: patient.id, personId: person.id };
    });
  }

  /* ------------------ 1. Área urbana o rural obligatoria ------------------ */

  describe('área urbana o rural obligatoria', () => {
    it('la columna no admite valores nulos', async () => {
      const columna = await prisma.$queryRawUnsafe<{ is_nullable: string }[]>(
        `SELECT is_nullable FROM information_schema.columns
          WHERE table_name = 'patient_address' AND column_name = 'areaType'`,
      );

      expect(columna[0]?.is_nullable).toBe('NO');
    });

    it('no existe ninguna dirección con área sin declarar', async () => {
      const nulos = await prisma.$queryRawUnsafe<{ total: bigint }[]>(
        `SELECT count(*)::bigint AS total FROM "patient_address" WHERE "areaType" IS NULL`,
      );

      expect(Number(nulos[0]?.total ?? 0)).toBe(0);
    });

    it('admite tanto zona urbana como rural', async () => {
      await expect(crearPaciente({ areaType: 'URBAN' })).resolves.toBeDefined();
      await expect(crearPaciente({ areaType: 'RURAL' })).resolves.toBeDefined();
    });
  });

  /* -------------------- 2. Integridad territorial -------------------------- */

  describe('integridad territorial', () => {
    it('rechaza un barrio colgado de otro barrio en vez de un municipio', async () => {
      const barrio = await ensureLocalUnit(
        prisma,
        otherTenantId,
        municipalityId,
        'Barrio Ficticio Padre',
      );

      await expect(
        prisma.territorialUnit.create({
          data: {
            tenantId: otherTenantId,
            parentId: barrio,
            type: 'NEIGHBORHOOD',
            normalizedName: 'BARRIO FICTICIO HIJO',
            displayName: 'Barrio Ficticio Hijo',
          },
        }),
      ).rejects.toThrow(/municipio/i);
    });

    it('rechaza un municipio colgado de otro municipio', async () => {
      await expect(
        prisma.territorialUnit.create({
          data: {
            parentId: municipalityId,
            type: 'MUNICIPALITY',
            officialCode: '05999',
            normalizedName: 'MUNICIPIO FICTICIO',
            displayName: 'Municipio Ficticio',
          },
        }),
      ).rejects.toThrow(/departamento/i);
    });

    it('rechaza un departamento con unidad padre', async () => {
      await expect(
        prisma.territorialUnit.create({
          data: {
            parentId: departmentId,
            type: 'DEPARTMENT',
            officialCode: '98',
            normalizedName: 'DEPARTAMENTO FICTICIO',
            displayName: 'Departamento Ficticio',
          },
        }),
      ).rejects.toThrow(/padre/i);
    });

    it('rechaza un barrio sin tenant', async () => {
      await expect(
        prisma.territorialUnit.create({
          data: {
            parentId: municipalityId,
            type: 'NEIGHBORHOOD',
            normalizedName: 'BARRIO SIN TENANT',
            displayName: 'Barrio sin tenant',
          },
        }),
      ).rejects.toThrow();
    });

    it('impide que una dirección use un barrio de otro tenant', async () => {
      const barrioAjeno = await ensureLocalUnit(
        prisma,
        otherTenantId,
        municipalityId,
        'Barrio De Otra Institucion',
      );
      const { patientId } = await crearPaciente();

      // Clave foránea compuesta (localUnitId, tenantId): el cruce es imposible.
      await expect(
        prisma.patientAddress.updateMany({
          where: { patientId },
          data: {
            localUnitId: barrioAjeno,
            localityPendingNormalization: false,
            localityUnverifiedText: null,
          },
        }),
      ).rejects.toThrow();
    });

    it('acepta un barrio del propio tenant y exige que el área concuerde', async () => {
      const barrioPropio = await ensureLocalUnit(
        prisma,
        tenantId,
        municipalityId,
        'Barrio Propio Ficticio',
      );

      await expect(
        crearPaciente({ localUnitId: barrioPropio, areaType: 'URBAN' }),
      ).resolves.toBeDefined();

      // El mismo barrio urbano con área rural declarada es incoherente.
      await expect(
        crearPaciente({ localUnitId: barrioPropio, areaType: 'RURAL' }),
      ).rejects.toThrow(/rea declarada|area declarada/i);
    });

    it('exige que el municipio de la dirección pertenezca a su departamento', async () => {
      const otroDepartamento = await territorialUnitId(
        prisma,
        'DEPARTMENT',
        OTHER_DEPARTMENT_CODE,
      );
      const { patientId } = await crearPaciente();

      await expect(
        prisma.patientAddress.updateMany({
          where: { patientId },
          data: { departmentUnitId: otroDepartamento },
        }),
      ).rejects.toThrow(/departamento/i);
    });

    it('la opción pendiente de normalización sigue permitida y no crea territorio', async () => {
      const antes = await prisma.territorialUnit.count();
      const { patientId } = await crearPaciente();

      const direccion = await prisma.patientAddress.findFirst({
        where: { patientId },
        select: { localUnitId: true, localityPendingNormalization: true },
      });

      expect(direccion?.localUnitId).toBeNull();
      expect(direccion?.localityPendingNormalization).toBe(true);
      expect(await prisma.territorialUnit.count()).toBe(antes);
    });
  });

  /* --------------------- 3. Auditoría append-only -------------------------- */

  describe('auditoría append-only', () => {
    it('rechaza modificar un evento ya registrado', async () => {
      const { patientId } = await crearPaciente();
      const evento = await prisma.auditEvent.findFirst({
        where: { resourceId: patientId },
        select: { id: true },
      });

      expect(evento).not.toBeNull();
      await expect(
        prisma.auditEvent.update({
          where: { id: evento!.id },
          data: { resourceType: 'Falsificado' },
        }),
      ).rejects.toThrow(/append-only/i);
    });

    it('rechaza borrar un evento ya registrado', async () => {
      const { patientId } = await crearPaciente();

      await expect(
        prisma.auditEvent.deleteMany({ where: { resourceId: patientId } }),
      ).rejects.toThrow(/append-only/i);
    });

    it('rechaza vaciar la tabla de auditoría', async () => {
      await expect(
        prisma.$executeRawUnsafe('TRUNCATE TABLE "audit_event"'),
      ).rejects.toThrow(/append-only/i);
    });

    it('sigue admitiendo el registro de eventos nuevos', async () => {
      const antes = await prisma.auditEvent.count();
      await crearPaciente();

      expect(await prisma.auditEvent.count()).toBe(antes + 1);
    });

    it('el rol runtime puede insertar pero no modificar ni borrar', async () => {
      const privilegios = await prisma.$queryRawUnsafe<{ privilege_type: string }[]>(
        `SELECT privilege_type FROM information_schema.role_table_grants
          WHERE grantee = 'merdn_runtime' AND table_name = 'audit_event'`,
      );

      const concedidos = privilegios.map((fila) => fila.privilege_type);
      expect(concedidos).toContain('INSERT');
      expect(concedidos).toContain('SELECT');
      expect(concedidos).not.toContain('UPDATE');
      expect(concedidos).not.toContain('DELETE');
    });
  });

  /* ------------------- 4. Row Level Security por tenant -------------------- */

  describe('Row Level Security con el rol runtime', () => {
    it('el rol existe, no es superusuario y no puede saltarse RLS', async () => {
      const rol = await prisma.$queryRawUnsafe<
        { rolsuper: boolean; rolbypassrls: boolean }[]
      >(`SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = 'merdn_runtime'`);

      expect(rol).toHaveLength(1);
      expect(rol[0]?.rolsuper).toBe(false);
      expect(rol[0]?.rolbypassrls).toBe(false);
    });

    it('RLS está activa en las nueve tablas de negocio', async () => {
      const tablas = await prisma.$queryRawUnsafe<
        { relname: string; relrowsecurity: boolean }[]
      >(
        `SELECT relname, relrowsecurity FROM pg_class
          WHERE relname IN ('person','patient','patient_population_membership',
                            'patient_address','consent_record','enrollment_session',
                            'audit_event','territorial_unit','tenant')`,
      );

      expect(tablas).toHaveLength(9);
      for (const tabla of tablas) {
        expect(tabla.relrowsecurity).toBe(true);
      }
    });

    it('el rol runtime no tiene privilegio de DELETE en ninguna tabla', async () => {
      const borrados = await prisma.$queryRawUnsafe<{ table_name: string }[]>(
        `SELECT table_name FROM information_schema.role_table_grants
          WHERE grantee = 'merdn_runtime' AND privilege_type = 'DELETE'`,
      );

      expect(borrados).toStrictEqual([]);
    });

    it('el tenant A no puede LEER datos del tenant B', async () => {
      await crearPaciente({ tenantId: otherTenantId });
      const propios = await prisma.person.count({ where: { tenantId } });
      const ajenos = await prisma.person.count({ where: { tenantId: otherTenantId } });

      expect(ajenos).toBeGreaterThan(0);

      const visibles = await comoRuntime(prisma, tenantId, async (tx) =>
        tx.person.count(),
      );

      expect(visibles).toBe(propios);
    });

    it('el tenant A no puede ESCRIBIR filas del tenant B', async () => {
      const documento = nextTestDocument();

      await expect(
        comoRuntime(prisma, tenantId, async (tx) => {
          await tx.person.create({
            data: {
              tenantId: otherTenantId,
              documentType: 'CEDULA_CIUDADANIA',
              documentNumber: documento,
              documentNumberNormalized: documento,
              givenNames: 'Intruso',
              familyNames: 'Ficticio',
              birthDate: new Date(Date.UTC(1970, 0, 1)),
              sexGenderCode: 'FEMENINO',
            },
          });
        }),
      ).rejects.toThrow(/row-level security/i);

      expect(
        await prisma.person.count({ where: { documentNumberNormalized: documento } }),
      ).toBe(0);
    });

    it('sin tenant fijado el rol runtime no ve ninguna fila', async () => {
      await crearPaciente();

      const visibles = await comoRuntime(prisma, null, async (tx) => tx.person.count());

      expect(visibles).toBe(0);
    });

    it('el rol runtime no puede borrar datos personales', async () => {
      const { personId } = await crearPaciente();

      await expect(
        comoRuntime(prisma, tenantId, async (tx) => {
          await tx.$executeRaw`DELETE FROM "person" WHERE id = ${personId}::uuid`;
        }),
      ).rejects.toThrow();

      expect(await prisma.person.count({ where: { id: personId } })).toBe(1);
    });

    it('el rol runtime no ve unidades locales de otro tenant', async () => {
      const barrioAjeno = await ensureLocalUnit(
        prisma,
        otherTenantId,
        municipalityId,
        'Barrio Solo De Otra Institucion',
      );

      const visible = await comoRuntime(prisma, tenantId, async (tx) =>
        tx.territorialUnit.findFirst({ where: { id: barrioAjeno } }),
      );

      expect(visible).toBeNull();
    });

    it('el rol runtime sí ve el catálogo territorial nacional compartido', async () => {
      const municipios = await comoRuntime(prisma, tenantId, async (tx) =>
        tx.territorialUnit.count({ where: { type: 'MUNICIPALITY' } }),
      );

      expect(municipios).toBe(1122);
    });

    it('una sesión de otro tenant es invisible bajo el tenant activo', async () => {
      const { patientId } = await crearPaciente({ tenantId: otherTenantId });

      const visible = await comoRuntime(prisma, tenantId, async (tx) =>
        tx.enrollmentSession.findFirst({ where: { patientId } }),
      );

      expect(visible).toBeNull();
      expect(await prisma.enrollmentSession.count({ where: { patientId } })).toBe(1);
    });
  });
});
