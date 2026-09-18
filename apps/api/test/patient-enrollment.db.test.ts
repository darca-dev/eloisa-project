import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';

import { type PrismaClient } from '../src/generated/prisma/client';
import { hashSessionToken } from '../src/enrollment-sessions/enrollment-session.tokens';

import { createTestPrismaClient, unavailableBanner } from './database-availability';
import {
  DEPARTMENT_CODE,
  MUNICIPALITY_CODE,
  OTHER_DEPARTMENT_CODE,
  OTHER_MUNICIPALITY_CODE,
  cleanupTestData,
  ensureOtherTenant,
  nextTestDocument,
  territorialUnitId,
} from './enrollment-fixtures';

/**
 * Integración con PostgreSQL real (TASK-MVP-CORE-01 §12).
 *
 * Estas pruebas comprueban lo que SOLO la base de datos puede garantizar:
 * restricciones, transacciones, unicidad, cascadas y aislamiento por tenant.
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

describe.skipIf(!puedeEjecutarse)('PostgreSQL — esquema y restricciones de CORE-01', () => {
  let prisma: PrismaClient;
  let tenantId: string;
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
      throw new Error(
        'El tenant institucional MVP no existe: aplique la migración de datos de referencia.',
      );
    }

    tenantId = tenant.id;
    departmentId = await territorialUnitId(prisma, 'DEPARTMENT', DEPARTMENT_CODE);
    municipalityId = await territorialUnitId(prisma, 'MUNICIPALITY', MUNICIPALITY_CODE);
  });

  afterAll(async () => {
    if (prisma !== undefined) {
      await cleanupTestData(prisma);
      await prisma.$disconnect();
    }
  });

  /** Crea una inscripción completa dentro de una transacción, como el servicio. */
  async function crearInscripcion(options: {
    readonly tenantId?: string;
    readonly documentNumber?: string;
    readonly birthDate?: Date;
    readonly token?: string;
    readonly expiresAt?: Date;
    readonly municipalityUnitId?: string;
  } = {}): Promise<{ readonly patientId: string; readonly personId: string }> {
    const documento = options.documentNumber ?? nextTestDocument();
    const owner = options.tenantId ?? tenantId;
    const now = new Date();

    return prisma.$transaction(async (tx) => {
      const person = await tx.person.create({
        data: {
          tenantId: owner,
          documentType: 'CEDULA_CIUDADANIA',
          documentNumber: documento,
          documentNumberNormalized: documento,
          givenNames: 'Ana María',
          familyNames: 'Ejemplo Ficticio',
          birthDate: options.birthDate ?? new Date(Date.UTC(1958, 3, 12)),
          sexGenderCode: 'FEMENINO',
          phone: '311 220 3355',
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

      await tx.patientPopulationMembership.create({
        data: {
          patientId: patient.id,
          tenantId: owner,
          populationType: 'OLDER_ADULT_60_PLUS',
          source: 'DERIVED_BIRTH_DATE',
        },
      });

      await tx.patientAddress.create({
        data: {
          tenantId: owner,
          patientId: patient.id,
          departmentUnitId: departmentId,
          municipalityUnitId: options.municipalityUnitId ?? municipalityId,
          localUnitId: null,
          areaType: 'URBAN',
          localityPendingNormalization: true,
          localityUnverifiedText: 'La Esperanza',
          exactAddress: 'Cra 45 # 32-16',
        },
      });

      await tx.consentRecord.create({
        data: {
          tenantId: owner,
          patientId: patient.id,
          consentVersion: 'paciente-tratamiento-datos-v1',
          consentType: 'PERSONAL_AND_HEALTH_DATA_PROCESSING',
          purpose: 'INSCRIPCION_PACIENTE_MERDN',
          acceptedAt: now,
        },
      });

      await tx.enrollmentSession.create({
        data: {
          tenantId: owner,
          patientId: patient.id,
          tokenHash: hashSessionToken(
            options.token ?? `token-${documento}-${owner}`,
          ),
          expiresAt: options.expiresAt ?? new Date(now.getTime() + 3_600_000),
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

  describe('catálogo territorial cargado por la migración', () => {
    it('contiene los departamentos y municipios oficiales', async () => {
      const departamentos = await prisma.territorialUnit.count({
        where: { type: 'DEPARTMENT' },
      });
      const municipios = await prisma.territorialUnit.count({
        where: { type: 'MUNICIPALITY' },
      });

      expect(departamentos).toBe(33);
      expect(municipios).toBe(1122);
    });

    it('los municipios cuelgan de su departamento', async () => {
      const municipio = await prisma.territorialUnit.findFirst({
        where: { type: 'MUNICIPALITY', officialCode: MUNICIPALITY_CODE },
        select: { parentId: true, displayName: true },
      });

      expect(municipio?.parentId).toBe(departmentId);
      expect(municipio?.displayName).toBe('MEDELLÍN');
    });

    it('no contiene barrios ni veredas inventadas', async () => {
      const locales = await prisma.territorialUnit.count({
        where: { type: { in: ['NEIGHBORHOOD', 'RURAL_SETTLEMENT'] } },
      });

      expect(locales).toBe(0);
    });

    it('las unidades nacionales no pertenecen a ningún tenant', async () => {
      const conTenant = await prisma.territorialUnit.count({
        where: { type: { in: ['DEPARTMENT', 'MUNICIPALITY'] }, tenantId: { not: null } },
      });

      expect(conTenant).toBe(0);
    });
  });

  describe('transacción de inscripción', () => {
    it('crea todas las filas y se recuperan con un cliente nuevo', async () => {
      const { patientId } = await crearInscripcion();

      // Cliente independiente: descarta cualquier estado en memoria del anterior.
      const otroCliente = createTestPrismaClient();
      try {
        const paciente = await otroCliente.patient.findUnique({
          where: { id: patientId },
          select: { personId: true },
        });
        expect(paciente).not.toBeNull();

        const persona = await otroCliente.person.findUnique({
          where: { id: paciente!.personId },
          select: { givenNames: true },
        });
        expect(persona?.givenNames).toBe('Ana María');

        expect(
          await otroCliente.patientPopulationMembership.count({ where: { patientId } }),
        ).toBe(1);
        expect(await otroCliente.patientAddress.count({ where: { patientId } })).toBe(1);
        expect(await otroCliente.consentRecord.count({ where: { patientId } })).toBe(1);
        expect(await otroCliente.enrollmentSession.count({ where: { patientId } })).toBe(
          1,
        );
        expect(
          await otroCliente.auditEvent.count({
            where: { resourceType: 'Patient', resourceId: patientId },
          }),
        ).toBe(1);
      } finally {
        await otroCliente.$disconnect();
      }
    });

    it('un fallo intermedio deshace toda la inscripción', async () => {
      const documento = nextTestDocument();

      await expect(
        prisma.$transaction(async (tx) => {
          const person = await tx.person.create({
            data: {
              tenantId,
              documentType: 'CEDULA_CIUDADANIA',
              documentNumber: documento,
              documentNumberNormalized: documento,
              givenNames: 'Rollback',
              familyNames: 'Ejemplo Ficticio',
              birthDate: new Date(Date.UTC(1958, 3, 12)),
              sexGenderCode: 'FEMENINO',
            },
            select: { id: true },
          });

          const patient = await tx.patient.create({
            data: {
              tenantId,
              personId: person.id,
              epsCode: 'NUEVA_EPS',
              epsNameControlled: 'Nueva EPS',
              origin: 'PUBLIC_SELF_ENROLLMENT',
            },
            select: { id: true },
          });

          // Dirección incoherente: viola la restricción de localidad.
          await tx.patientAddress.create({
            data: {
              tenantId,
              patientId: patient.id,
              departmentUnitId: departmentId,
              municipalityUnitId: municipalityId,
              localUnitId: null,
              areaType: 'URBAN',
              localityPendingNormalization: false,
              localityUnverifiedText: null,
              exactAddress: 'Cra 45 # 32-16',
            },
          });
        }),
      ).rejects.toThrow();

      const persona = await prisma.person.findFirst({
        where: { documentNumberNormalized: documento },
      });
      const pacientes = await prisma.patient.count({
        where: { person: { documentNumberNormalized: documento } },
      });

      expect(persona).toBeNull();
      expect(pacientes).toBe(0);
    });
  });

  describe('unicidad de documento por tenant', () => {
    it('rechaza un documento repetido dentro del mismo tenant', async () => {
      const documento = nextTestDocument();
      await crearInscripcion({ documentNumber: documento });

      await expect(crearInscripcion({ documentNumber: documento })).rejects.toMatchObject({
        code: 'P2002',
      });
    });

    it('bloquea una carrera concurrente por el mismo documento', async () => {
      const documento = nextTestDocument();

      // Dos altas simultáneas del MISMO documento: solo una puede prosperar.
      const resultados = await Promise.allSettled([
        crearInscripcion({ documentNumber: documento }),
        crearInscripcion({ documentNumber: documento }),
      ]);

      const creadas = resultados.filter((r) => r.status === 'fulfilled');
      const rechazadas = resultados.filter((r) => r.status === 'rejected');

      expect(creadas).toHaveLength(1);
      expect(rechazadas).toHaveLength(1);

      const personas = await prisma.person.count({
        where: { documentNumberNormalized: documento },
      });
      expect(personas).toBe(1);
    });

    it('el mismo documento puede existir en dos tenants distintos', async () => {
      const documento = nextTestDocument();
      const otroTenantId = await ensureOtherTenant(prisma);

      await crearInscripcion({ documentNumber: documento });
      await expect(
        crearInscripcion({ documentNumber: documento, tenantId: otroTenantId }),
      ).resolves.toBeDefined();

      const personas = await prisma.person.count({
        where: { documentNumberNormalized: documento },
      });
      expect(personas).toBe(2);
    });
  });

  describe('aislamiento institucional impuesto por la base de datos', () => {
    it('impide asociar un paciente a una persona de otro tenant', async () => {
      const otroTenantId = await ensureOtherTenant(prisma);
      const documento = nextTestDocument();

      const persona = await prisma.person.create({
        data: {
          tenantId: otroTenantId,
          documentType: 'CEDULA_CIUDADANIA',
          documentNumber: documento,
          documentNumberNormalized: documento,
          givenNames: 'Otra',
          familyNames: 'Institución Ficticia',
          birthDate: new Date(Date.UTC(1970, 0, 1)),
          sexGenderCode: 'FEMENINO',
        },
        select: { id: true },
      });

      // La clave foránea compuesta (personId, tenantId) hace imposible el cruce.
      await expect(
        prisma.patient.create({
          data: {
            tenantId,
            personId: persona.id,
            epsCode: 'NUEVA_EPS',
            epsNameControlled: 'Nueva EPS',
            origin: 'PUBLIC_SELF_ENROLLMENT',
          },
        }),
      ).rejects.toThrow();
    });

    it('impide asociar una dirección a un paciente de otro tenant', async () => {
      const otroTenantId = await ensureOtherTenant(prisma);
      const { patientId } = await crearInscripcion();

      await expect(
        prisma.patientAddress.create({
          data: {
            tenantId: otroTenantId,
            patientId,
            departmentUnitId: departmentId,
            municipalityUnitId: municipalityId,
            localUnitId: null,
            areaType: 'URBAN',
            localityPendingNormalization: true,
            localityUnverifiedText: 'La Esperanza',
            exactAddress: 'Cra 45 # 32-16',
          },
        }),
      ).rejects.toThrow();
    });
  });

  describe('restricciones de integridad declaradas en la migración', () => {
    it('rechaza una población duplicada para el mismo paciente', async () => {
      const { patientId } = await crearInscripcion();

      await expect(
        prisma.patientPopulationMembership.create({
          data: {
            patientId,
            tenantId,
            populationType: 'OLDER_ADULT_60_PLUS',
            source: 'DECLARED',
          },
        }),
      ).rejects.toMatchObject({ code: 'P2002' });
    });

    it('rechaza una localidad pendiente sin texto declarado', async () => {
      const { patientId } = await crearInscripcion();

      await expect(
        prisma.patientAddress.updateMany({
          where: { patientId },
          data: { localityUnverifiedText: null },
        }),
      ).rejects.toThrow();
    });

    it('rechaza una dirección exacta vacía', async () => {
      const { patientId } = await crearInscripcion();

      await expect(
        prisma.patientAddress.updateMany({
          where: { patientId },
          data: { exactAddress: '   ' },
        }),
      ).rejects.toThrow();
    });

    it('rechaza guardar en la sesión algo que no tenga forma de hash', async () => {
      const { patientId } = await crearInscripcion();

      await expect(
        prisma.enrollmentSession.updateMany({
          where: { patientId },
          data: { tokenHash: 'token-en-claro-no-permitido' },
        }),
      ).rejects.toThrow();
    });

    it('rechaza crear un barrio sin tenant o sin municipio padre', async () => {
      await expect(
        prisma.territorialUnit.create({
          data: {
            type: 'NEIGHBORHOOD',
            normalizedName: 'BARRIO SIN TENANT',
            displayName: 'Barrio sin tenant',
            parentId: municipalityId,
          },
        }),
      ).rejects.toThrow();

      await expect(
        prisma.territorialUnit.create({
          data: {
            tenantId,
            type: 'NEIGHBORHOOD',
            normalizedName: 'BARRIO SIN PADRE',
            displayName: 'Barrio sin padre',
          },
        }),
      ).rejects.toThrow();
    });

    it('impide que una dirección apunte a una unidad territorial inexistente', async () => {
      const { patientId } = await crearInscripcion();

      await expect(
        prisma.patientAddress.updateMany({
          where: { patientId },
          data: { municipalityUnitId: '019287a1-0000-7000-8000-0000000000ff' },
        }),
      ).rejects.toThrow();
    });

    it('permite un municipio de otro departamento solo si existe en el catálogo', async () => {
      const otroMunicipio = await territorialUnitId(
        prisma,
        'MUNICIPALITY',
        OTHER_MUNICIPALITY_CODE,
      );
      const otroDepartamento = await territorialUnitId(
        prisma,
        'DEPARTMENT',
        OTHER_DEPARTMENT_CODE,
      );

      const municipio = await prisma.territorialUnit.findUnique({
        where: { id: otroMunicipio },
        select: { parentId: true },
      });

      expect(municipio?.parentId).toBe(otroDepartamento);
    });
  });

  describe('sesión de inscripción', () => {
    it('nunca almacena el token en claro', async () => {
      const token = 'token-en-claro-de-prueba';
      const { patientId } = await crearInscripcion({ token });

      const sesion = await prisma.enrollmentSession.findFirst({
        where: { patientId },
        select: { tokenHash: true },
      });

      expect(sesion?.tokenHash).toBe(hashSessionToken(token));
      expect(sesion?.tokenHash).not.toContain(token);

      // Comprobación exhaustiva: el token no aparece en ninguna columna de texto.
      const coincidencias = await prisma.$queryRawUnsafe<{ total: bigint }[]>(
        `SELECT count(*)::bigint AS total FROM "enrollment_session" WHERE "tokenHash" = $1`,
        token,
      );
      expect(Number(coincidencias[0]?.total ?? 0)).toBe(0);
    });

    it('conserva la sesión asociada a su tenant y a su paciente', async () => {
      const { patientId } = await crearInscripcion();

      const sesion = await prisma.enrollmentSession.findFirst({
        where: { patientId },
        select: { tenantId: true, patientId: true, revokedAt: true, lastUsedAt: true },
      });

      expect(sesion?.tenantId).toBe(tenantId);
      expect(sesion?.patientId).toBe(patientId);
      expect(sesion?.revokedAt).toBeNull();
      expect(sesion?.lastUsedAt).toBeNull();
    });

    it('borrar el paciente arrastra su sesión, dirección y consentimiento', async () => {
      const { patientId } = await crearInscripcion();

      // El evento de auditoría NO se borra: es append-only y sobrevive
      // deliberadamente al paciente, porque no tiene clave foránea hacia él.
      await prisma.patient.delete({ where: { id: patientId } });

      expect(
        await prisma.auditEvent.count({ where: { resourceId: patientId } }),
      ).toBe(1);

      expect(await prisma.enrollmentSession.count({ where: { patientId } })).toBe(0);
      expect(await prisma.patientAddress.count({ where: { patientId } })).toBe(0);
      expect(await prisma.consentRecord.count({ where: { patientId } })).toBe(0);
      expect(
        await prisma.patientPopulationMembership.count({ where: { patientId } }),
      ).toBe(0);
    });
  });

  describe('la edad no se persiste', () => {
    it('la tabla de personas no tiene columna de edad', async () => {
      const columnas = await prisma.$queryRawUnsafe<{ column_name: string }[]>(
        `SELECT column_name FROM information_schema.columns WHERE table_name = 'person'`,
      );

      const nombres = columnas.map((columna) => columna.column_name);
      expect(nombres).toContain('birthDate');
      expect(nombres).not.toContain('age');
      expect(nombres).not.toContain('edad');
    });
  });
});
