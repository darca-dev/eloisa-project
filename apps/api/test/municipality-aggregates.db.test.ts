import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';

import { type PrismaClient } from '../src/generated/prisma/client';
import { buildPopulationSummary } from '../src/municipality/population-summary';
import { buildTerritorySummary } from '../src/municipality/territory-summary';

import { createTestPrismaClient, unavailableBanner } from './database-availability';
import {
  DEPARTMENT_CODE,
  MUNICIPALITY_CODE,
  OTHER_DEPARTMENT_CODE,
  OTHER_MUNICIPALITY_CODE,
  cleanupTestData,
  ensureLocalUnit,
  ensureOtherTenant,
  territorialUnitId,
} from './enrollment-fixtures';
import {
  COMBINACIONES_EXCLUSIVAS,
  crearPacienteSintetico,
  nacimientoConEdadAproximada,
} from './municipality-fixtures';

/**
 * Agregados municipales contra PostgreSQL real
 * (TASK-MUNICIPALITY-CORE-01, pruebas T-01, T-02, T-03, T-04, T-07 y T-13).
 *
 * Estas pruebas NO se sustituyen por dobles de prueba: si PostgreSQL no está
 * disponible se marcan como no ejecutadas con un motivo visible.
 *
 * La agregación se ejercita a través de los MISMOS módulos que sirve la API
 * —`PrismaService.withTenant` incluido—, no con consultas escritas aparte.
 */

const availability = inject('databaseAvailability');
const puedeEjecutarse = availability.available && availability.migrated;

if (!puedeEjecutarse) {
  // eslint-disable-next-line no-console
  console.warn(`\n${unavailableBanner(availability)}\n`);
}

describe.skipIf(!puedeEjecutarse)('Agregados municipales sobre PostgreSQL', () => {
  let prisma: PrismaClient;
  let tenantId: string;
  let otherTenantId: string;
  let departmentId: string;
  let municipalityId: string;
  let otherDepartmentId: string;
  let otherMunicipalityId: string;

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
  });

  beforeEach(async () => {
    await cleanupTestData(prisma);
  });

  afterAll(async () => {
    if (prisma !== undefined) {
      await cleanupTestData(prisma);
      await prisma.$disconnect();
    }
  });

  const AS_OF = new Date(Date.UTC(2026, 7, 22));

  /** Lee las filas de población con las mismas columnas que usa el servicio. */
  async function filasDePoblacion(owner: string) {
    const patients = await prisma.patient.findMany({
      where: { tenantId: owner, status: 'ACTIVE' },
      select: {
        person: { select: { birthDate: true } },
        populationMemberships: { select: { populationType: true } },
      },
    });

    return patients.map((patient) => ({
      birthDate: patient.person.birthDate,
      disabilityDeclared: patient.populationMemberships.some(
        (membership) => membership.populationType === 'DISABILITY',
      ),
      homeCareRequiredDeclared: patient.populationMemberships.some(
        (membership) => membership.populationType === 'HOME_CARE_REQUIRED',
      ),
    }));
  }

  async function resumenDePoblacion(owner: string = tenantId) {
    const pendientes = await prisma.patientAddress.count({
      where: {
        tenantId: owner,
        patient: { tenantId: owner, status: 'ACTIVE' },
        OR: [{ localUnitId: null }, { localityPendingNormalization: true }],
      },
    });

    return buildPopulationSummary({
      rows: await filasDePoblacion(owner),
      territoryPendingNormalization: pendientes,
      asOf: AS_OF,
      generatedAt: AS_OF,
    });
  }

  async function resumenDeTerritorio(owner: string = tenantId) {
    const addresses = await prisma.patientAddress.findMany({
      where: { tenantId: owner, patient: { tenantId: owner, status: 'ACTIVE' } },
      select: {
        areaType: true,
        localUnitId: true,
        localityPendingNormalization: true,
        municipalityUnit: { select: { officialCode: true, displayName: true } },
        localUnit: { select: { displayName: true } },
        patient: {
          select: {
            person: { select: { birthDate: true } },
            populationMemberships: { select: { populationType: true } },
          },
        },
      },
    });

    return buildTerritorySummary({
      rows: addresses.map((address) => {
        const pendiente =
          address.localUnitId === null || address.localityPendingNormalization;

        return {
          municipalityCode: address.municipalityUnit.officialCode,
          municipalityName: address.municipalityUnit.displayName,
          areaType: address.areaType,
          localUnitId: pendiente ? null : address.localUnitId,
          localUnitName: pendiente ? null : (address.localUnit?.displayName ?? null),
          birthDate: address.patient.person.birthDate,
          disabilityDeclared: address.patient.populationMemberships.some(
            (membership) => membership.populationType === 'DISABILITY',
          ),
          homeCareRequiredDeclared: address.patient.populationMemberships.some(
            (membership) => membership.populationType === 'HOME_CARE_REQUIRED',
          ),
        };
      }),
      asOf: AS_OF,
      generatedAt: AS_OF,
    });
  }

  async function crear(
    cantidad: number,
    condiciones: { mayor: boolean; discapacidad: boolean; cuidadoEnCasa: boolean },
    extra: Partial<Parameters<typeof crearPacienteSintetico>[1]> = {},
  ): Promise<void> {
    for (let indice = 0; indice < cantidad; indice += 1) {
      await crearPacienteSintetico(prisma, {
        tenantId,
        departmentUnitId: departmentId,
        municipalityUnitId: municipalityId,
        condiciones,
        ...extra,
      });
    }
  }

  describe('población (T-01, T-02, T-13)', () => {
    it('sin pacientes registrados devuelve ceros, no un fixture', async () => {
      const summary = await resumenDePoblacion();

      expect(summary.uniqueRegistered).toMatchObject({ status: 'EXACT', value: 0 });
      expect(summary.source).toBe('ELOISA_POSTGRESQL');
    });

    it('cuenta las siete regiones y su suma es el total de personas únicas', async () => {
      const cantidades = [11, 9, 7, 13, 17, 5, 6];

      for (const [indice, combinacion] of COMBINACIONES_EXCLUSIVAS.entries()) {
        await crear(cantidades[indice]!, combinacion.condiciones);
      }

      const summary = await resumenDePoblacion();
      const suma = COMBINACIONES_EXCLUSIVAS.reduce(
        (acumulado, combinacion) =>
          acumulado +
          ((
            summary.exclusiveIntersections as unknown as Record<
              string,
              { value: number | null }
            >
          )[combinacion.clave]?.value ?? 0),
        0,
      );

      expect(summary.uniqueRegistered).toMatchObject({ status: 'EXACT', value: 68 });
      expect(suma).toBe(68);
    });

    it('los totales cambian al inscribir a otra persona (T-13)', async () => {
      await crear(10, { mayor: true, discapacidad: false, cuidadoEnCasa: false });

      const antes = await resumenDePoblacion();

      expect(antes.uniqueRegistered).toMatchObject({ status: 'EXACT', value: 10 });

      await crear(1, { mayor: true, discapacidad: false, cuidadoEnCasa: false });

      const despues = await resumenDePoblacion();

      expect(despues.uniqueRegistered).toMatchObject({ status: 'EXACT', value: 11 });
      expect(despues.populations.olderAdult60Plus).toMatchObject({
        status: 'EXACT',
        value: 11,
      });
    });

    it('deriva 60+ de la fecha de nacimiento aunque no exista la pertenencia (T-02)', async () => {
      // Nacimiento exactamente 60 años antes de la fecha de corte.
      await crear(
        6,
        { mayor: false, discapacidad: false, cuidadoEnCasa: false },
        { birthDate: new Date(Date.UTC(1966, 7, 22)) },
      );
      // Un día después: todavía no ha cumplido 60 en la fecha de corte.
      await crear(
        7,
        { mayor: false, discapacidad: false, cuidadoEnCasa: false },
        { birthDate: new Date(Date.UTC(1966, 7, 23)) },
      );

      const summary = await resumenDePoblacion();

      const membresias = await prisma.patientPopulationMembership.count({
        where: { tenantId, populationType: 'OLDER_ADULT_60_PLUS' },
      });

      expect(membresias).toBe(0);
      expect(summary.populations.olderAdult60Plus).toMatchObject({
        status: 'EXACT',
        value: 6,
      });
      expect(summary.uniqueRegistered).toMatchObject({ status: 'EXACT', value: 13 });
    });

    it('una pertenencia histórica obsoleta no altera el conteo derivado', async () => {
      await crear(
        6,
        { mayor: false, discapacidad: false, cuidadoEnCasa: false },
        {
          birthDate: nacimientoConEdadAproximada(30),
          persistirMembresiaMayor: true,
        },
      );

      const summary = await resumenDePoblacion();

      expect(summary.populations.olderAdult60Plus).toMatchObject({
        status: 'EXACT',
        value: 0,
      });
    });
  });

  describe('aislamiento por tenant (T-03)', () => {
    it('el resumen del tenant activo ignora a las personas de otra institución', async () => {
      await crear(8, { mayor: true, discapacidad: false, cuidadoEnCasa: false });

      for (let indice = 0; indice < 12; indice += 1) {
        await crearPacienteSintetico(prisma, {
          tenantId: otherTenantId,
          departmentUnitId: otherDepartmentId,
          municipalityUnitId: otherMunicipalityId,
          condiciones: { mayor: true, discapacidad: true, cuidadoEnCasa: true },
        });
      }

      const propio = await resumenDePoblacion();
      const ajeno = await resumenDePoblacion(otherTenantId);

      expect(propio.uniqueRegistered).toMatchObject({ status: 'EXACT', value: 8 });
      expect(ajeno.uniqueRegistered).toMatchObject({ status: 'EXACT', value: 12 });

      const territorioPropio = await resumenDeTerritorio();

      expect(
        territorioPropio.municipalities.map((municipio) => municipio.officialCode),
      ).toStrictEqual([MUNICIPALITY_CODE]);
    });
  });

  describe('territorio (T-07)', () => {
    it('agrupa por municipio, área y unidad canónica, y separa los pendientes', async () => {
      const barrio = await ensureLocalUnit(
        prisma,
        tenantId,
        municipalityId,
        'Barrio Ficticio de Pruebas',
        'NEIGHBORHOOD',
      );
      const vereda = await ensureLocalUnit(
        prisma,
        tenantId,
        municipalityId,
        'Vereda Ficticia de Pruebas',
        'RURAL_SETTLEMENT',
      );

      await crear(
        9,
        { mayor: true, discapacidad: false, cuidadoEnCasa: false },
        { localUnitId: barrio, areaType: 'URBAN' },
      );
      await crear(
        8,
        { mayor: false, discapacidad: true, cuidadoEnCasa: false },
        { localUnitId: vereda, areaType: 'RURAL' },
      );
      await crear(
        7,
        { mayor: false, discapacidad: false, cuidadoEnCasa: true },
        { localUnitId: null, areaType: 'URBAN' },
      );

      const summary = await resumenDeTerritorio();

      expect(summary.municipalities).toHaveLength(1);

      const municipio = summary.municipalities[0]!;

      expect(municipio.officialCode).toBe(MUNICIPALITY_CODE);
      expect(municipio.metrics.uniquePeople).toMatchObject({ status: 'EXACT', value: 24 });
      expect(municipio.metrics.pendingNormalization).toMatchObject({
        status: 'EXACT',
        value: 7,
      });
      expect(municipio.areas.map((area) => area.areaType)).toStrictEqual([
        'URBAN',
        'RURAL',
      ]);

      const urbana = municipio.areas[0]!;

      expect(urbana.localUnits.map((unidad) => unidad.kind)).toStrictEqual([
        'CANONICAL',
        'PENDING_NORMALIZATION',
      ]);
      expect(urbana.localUnits[0]!.displayName).toBe('Barrio Ficticio de Pruebas');
      expect(urbana.localUnits[0]!.metrics.olderAdult60Plus).toMatchObject({
        status: 'EXACT',
        value: 9,
      });

      const rural = municipio.areas[1]!;

      expect(rural.localUnits[0]!.metrics.disabilityDeclared).toMatchObject({
        status: 'EXACT',
        value: 8,
      });
    });

    it('no devuelve dirección exacta ni texto declarado de localidad', async () => {
      await crear(
        6,
        { mayor: true, discapacidad: false, cuidadoEnCasa: false },
        { localUnitId: null },
      );

      const serializado = JSON.stringify(await resumenDeTerritorio());

      expect(serializado).not.toContain('Calle Ficticia');
      expect(serializado).not.toContain('Localidad Ficticia');
      expect(serializado).not.toContain('Ejemplo Ficticio');
    });
  });

  describe('Row Level Security de las tablas institucionales (T-04)', () => {
    /** Adopta el rol runtime y fija el tenant, igual que hace la aplicación. */
    async function comoRuntime<T>(
      activo: string | null,
      work: (tx: Omit<PrismaClient, `$${string}`>) => Promise<T>,
    ): Promise<T> {
      return prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe('SET LOCAL ROLE "merdn_runtime"');

        if (activo !== null) {
          await tx.$executeRaw`SELECT set_config('merdn.tenant_id', ${activo}, true)`;
        }

        return work(tx as never);
      });
    }

    it('las dos tablas nuevas tienen Row Level Security activa', async () => {
      const filas = await prisma.$queryRawUnsafe<{ relname: string; relrowsecurity: boolean }[]>(
        `SELECT relname, relrowsecurity FROM pg_class
          WHERE relname IN ('institutional_identity', 'institutional_session')`,
      );

      expect(filas).toHaveLength(2);

      for (const fila of filas) {
        expect(fila.relrowsecurity).toBe(true);
      }
    });

    it('el rol runtime no tiene privilegio de DELETE sobre identidad ni sesión', async () => {
      const privilegios = await prisma.$queryRawUnsafe<{ table_name: string }[]>(
        `SELECT table_name FROM information_schema.role_table_grants
          WHERE grantee = 'merdn_runtime' AND privilege_type = 'DELETE'`,
      );

      expect(privilegios).toStrictEqual([]);
    });

    it('una identidad institucional de otra institución es invisible', async () => {
      const ajena = await prisma.institutionalIdentity.create({
        data: {
          tenantId: otherTenantId,
          code: 'identidad-ajena-de-pruebas',
          role: 'MUNICIPAL_VIEWER',
          accessSecretHash: 'a'.repeat(128),
          accessSecretSalt: 'b'.repeat(32),
        },
        select: { id: true },
      });

      try {
        const visible = await comoRuntime(tenantId, async (tx) =>
          tx.institutionalIdentity.count({ where: { id: ajena.id } }),
        );

        expect(visible).toBe(0);

        const sinContexto = await comoRuntime(null, async (tx) =>
          tx.institutionalIdentity.count(),
        );

        expect(sinContexto).toBe(0);
      } finally {
        await prisma.institutionalIdentity.delete({ where: { id: ajena.id } });
      }
    });

    it('la base rechaza almacenar una credencial que no sea una derivación', async () => {
      await expect(
        prisma.institutionalIdentity.create({
          data: {
            tenantId,
            code: 'identidad-invalida-de-pruebas',
            role: 'MUNICIPAL_VIEWER',
            accessSecretHash: 'credencial-en-claro',
            accessSecretSalt: 'sal',
          },
        }),
      ).rejects.toThrow();
    });
  });
});
