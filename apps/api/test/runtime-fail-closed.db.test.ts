import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';

import { type ApiEnvironment } from '../src/config/environment';
import { PrismaService, RUNTIME_ROLE_NAME } from '../src/database/prisma.service';
import { RuntimeContextUnavailableError } from '../src/database/runtime-context.error';
import { type PrismaClient } from '../src/generated/prisma/client';

import { createTestPrismaClient, unavailableBanner } from './database-availability';
import { cleanupTestData, nextTestDocument } from './enrollment-fixtures';

/**
 * FAIL-CLOSED del contexto de ejecución (corrección final de CORE-01,
 * bloqueante 1) y separación de credenciales (bloqueante 2).
 *
 * Estas pruebas se ejecutan contra PostgreSQL real. Comprueban que, cuando el
 * rol de mínimo privilegio NO puede adoptarse, la aplicación ABORTA la
 * operación en lugar de continuar con la credencial de la conexión.
 *
 * El caso adverso reproduce una de las condiciones que la corrección exige
 * cubrir —«el rol runtime no existe»— renombrando temporalmente el rol. El
 * renombrado es reversible y no toca políticas ni permisos: PostgreSQL las
 * referencia por identificador interno, no por nombre.
 */

const availability = inject('databaseAvailability');
const puedeEjecutarse = availability.available && availability.migrated;

if (!puedeEjecutarse) {
  // eslint-disable-next-line no-console
  console.warn(`\n${unavailableBanner(availability)}\n`);
}

/** Nombre temporal al que se renombra el rol para simular su ausencia. */
const ROL_RENOMBRADO = 'merdn_runtime_ausente_en_pruebas';

/** Configuración mínima que necesita `PrismaService`. Valores ficticios. */
function entorno(runtimeRoleMode: 'enforce' | 'disabled'): ApiEnvironment {
  return {
    merdnEnvironment: 'test',
    port: 3001,
    openApiPath: 'docs',
    runtimeRoleMode,
    hasSeparateRuntimeConnection: false,
    activeTenantCode: process.env['MERDN_ACTIVE_TENANT_CODE'] ?? 'merdn-mvp',
    /*
     * Spec 024: la pareja confiable del tenant activo. Aquí queda `undefined`
     * a propósito —esta suite construye sus contextos con identificadores que
     * lee de la base— y su presencia explícita documenta que el campo existe y
     * que el bootstrap NO lo obtiene de una petición.
     */
    activeTenantId: process.env['MERDN_ACTIVE_TENANT_ID'],
    consent: { version: 'paciente-tratamiento-datos-v1', purpose: 'INSCRIPCION_PACIENTE_MERDN' },
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

describe.skipIf(!puedeEjecutarse)('Contexto de ejecución fail-closed', () => {
  let prisma: PrismaClient;
  let servicio: PrismaService;
  let tenantId: string;

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

    servicio = new PrismaService(entorno('enforce'));
  });

  afterAll(async () => {
    if (servicio !== undefined) {
      await servicio.$disconnect().catch(() => undefined);
    }
    if (prisma !== undefined) {
      await cleanupTestData(prisma);
      await restaurarRol();
      await prisma.$disconnect();
    }
  });

  /** Hace desaparecer el rol runtime de forma reversible. */
  async function ocultarRol(): Promise<void> {
    await prisma.$executeRawUnsafe(
      `ALTER ROLE "${RUNTIME_ROLE_NAME}" RENAME TO "${ROL_RENOMBRADO}"`,
    );
  }

  /** Devuelve el rol a su nombre real. Siempre se ejecuta en `finally`. */
  async function restaurarRol(): Promise<void> {
    await prisma
      .$executeRawUnsafe(`ALTER ROLE "${ROL_RENOMBRADO}" RENAME TO "${RUNTIME_ROLE_NAME}"`)
      .catch(() => undefined);
  }

  /* ------------------------------- Caso A -------------------------------- */

  describe('A · el rol se adopta correctamente', () => {
    it('permite la operación y la ejecuta bajo el rol de mínimo privilegio', async () => {
      const contexto = await servicio.withTenant(tenantId, async (tx) => {
        const [fila] = await tx.$queryRaw<
          { readonly rol: string; readonly tenant: string | null }[]
        >`SELECT current_user::text AS rol, current_setting('merdn.tenant_id', true) AS tenant`;
        return fila;
      });

      expect(contexto?.rol).toBe(RUNTIME_ROLE_NAME);
      expect(contexto?.tenant).toBe(tenantId);
    });

    it('el contexto no sobrevive a la transacción', async () => {
      const [antes] = await servicio.$queryRaw<{ readonly rol: string }[]>`SELECT current_user::text AS rol`;
      await servicio.withTenant(tenantId, async () => undefined);

      const [fuera] = await servicio.$queryRaw<
        { readonly rol: string; readonly tenant: string | null }[]
      >`SELECT current_user::text AS rol, current_setting('merdn.tenant_id', true) AS tenant`;

      // Fuera de la transacción vuelve el rol de la conexión y no queda tenant:
      // una conexión reutilizada del pool nunca hereda el contexto anterior.
      expect(antes?.rol).toBeDefined();
      expect(fuera?.rol).toBe(antes?.rol);
      expect(fuera?.tenant === null || fuera?.tenant === '').toBe(true);
    });
  });

  /* ------------------------------- Caso B -------------------------------- */

  describe('B · el rol NO puede adoptarse', () => {
    it('lanza RuntimeContextUnavailableError en lugar de continuar', async () => {
      await ocultarRol();
      try {
        await expect(
          servicio.withTenant(tenantId, async () => 'no debería llegar aquí'),
        ).rejects.toBeInstanceOf(RuntimeContextUnavailableError);
      } finally {
        await restaurarRol();
      }
    });

    it('el error no revela credenciales, host ni datos personales', async () => {
      let capturado: unknown;

      await ocultarRol();
      try {
        await servicio.withTenant(tenantId, async () => undefined);
      } catch (error) {
        capturado = error;
      } finally {
        await restaurarRol();
      }

      const mensaje = capturado instanceof Error ? capturado.message : '';
      expect(mensaje).toContain('contexto de ejecución seguro');
      expect(mensaje).toContain('sin ejecutar ninguna consulta de negocio');
      expect(mensaje).not.toContain('password');
      expect(mensaje).not.toContain('127.0.0.1');
      expect(mensaje).not.toContain(tenantId);
    });

    it('vuelve a funcionar en cuanto el rol está disponible', async () => {
      await ocultarRol();
      await restaurarRol();

      const rol = await servicio.withTenant(tenantId, async (tx) => {
        const [fila] = await tx.$queryRaw<{ readonly rol: string }[]>`
          SELECT current_user::text AS rol`;
        return fila?.rol;
      });

      expect(rol).toBe(RUNTIME_ROLE_NAME);
    });
  });

  /* ------------------------------- Caso C -------------------------------- */

  describe('C · no se ejecuta trabajo de negocio tras el fallo', () => {
    it('el trabajo nunca se invoca y no se escribe ninguna fila', async () => {
      const documento = nextTestDocument();
      let trabajoInvocado = false;

      await ocultarRol();
      try {
        await expect(
          servicio.withTenant(tenantId, async (tx) => {
            trabajoInvocado = true;
            await tx.person.create({
              data: {
                tenantId,
                documentType: 'CEDULA_CIUDADANIA',
                documentNumber: documento,
                documentNumberNormalized: documento,
                givenNames: 'No',
                familyNames: 'Debe Existir',
                birthDate: new Date(Date.UTC(1970, 0, 1)),
                sexGenderCode: 'FEMENINO',
              },
            });
          }),
        ).rejects.toBeInstanceOf(RuntimeContextUnavailableError);
      } finally {
        await restaurarRol();
      }

      // C: la consulta de negocio nunca llegó a ejecutarse.
      expect(trabajoInvocado).toBe(false);

      // Y no quedó ninguna fila escrita con la credencial de la conexión.
      expect(
        await prisma.person.count({ where: { documentNumberNormalized: documento } }),
      ).toBe(0);
    });

    it('tampoco se ejecuta una lectura de negocio tras el fallo', async () => {
      let lecturaInvocada = false;

      await ocultarRol();
      try {
        await expect(
          servicio.withTenant(tenantId, async (tx) => {
            lecturaInvocada = true;
            return tx.person.count();
          }),
        ).rejects.toBeInstanceOf(RuntimeContextUnavailableError);
      } finally {
        await restaurarRol();
      }

      expect(lecturaInvocada).toBe(false);
    });
  });

  /* ------------------------------- Caso D -------------------------------- */

  describe('D · aislamiento entre instituciones bajo el contexto seguro', () => {
    it('el tenant activo no ve ni escribe filas de otro tenant', async () => {
      const otroTenant = await prisma.tenant.upsert({
        where: { code: 'merdn-test-fail-closed' },
        update: {},
        create: { code: 'merdn-test-fail-closed', name: 'Institución ficticia B' },
        select: { id: true },
      });

      const documentoAjeno = nextTestDocument();
      await prisma.person.create({
        data: {
          tenantId: otroTenant.id,
          documentType: 'CEDULA_CIUDADANIA',
          documentNumber: documentoAjeno,
          documentNumberNormalized: documentoAjeno,
          givenNames: 'Ajena',
          familyNames: 'Ficticia',
          birthDate: new Date(Date.UTC(1960, 0, 1)),
          sexGenderCode: 'FEMENINO',
        },
      });

      // Lectura: la fila del otro tenant es invisible.
      const visibles = await servicio.withTenant(tenantId, async (tx) =>
        tx.person.findMany({
          where: { documentNumberNormalized: documentoAjeno },
          select: { id: true },
        }),
      );
      expect(visibles).toStrictEqual([]);

      // Escritura: crear en el otro tenant queda bloqueado por la política.
      const documentoIntruso = nextTestDocument();
      await expect(
        servicio.withTenant(tenantId, async (tx) =>
          tx.person.create({
            data: {
              tenantId: otroTenant.id,
              documentType: 'CEDULA_CIUDADANIA',
              documentNumber: documentoIntruso,
              documentNumberNormalized: documentoIntruso,
              givenNames: 'Intruso',
              familyNames: 'Ficticio',
              birthDate: new Date(Date.UTC(1970, 0, 1)),
              sexGenderCode: 'FEMENINO',
            },
          }),
        ),
      ).rejects.toThrow(/row-level security/i);

      expect(
        await prisma.person.count({
          where: { documentNumberNormalized: documentoIntruso },
        }),
      ).toBe(0);
    });
  });

  /* ------------- Separación de credenciales: atributos del rol ------------ */

  describe('el rol runtime es de mínimo privilegio', () => {
    it('no es propietario del esquema ni puede saltarse RLS', async () => {
      const [rol] = await prisma.$queryRawUnsafe<
        {
          readonly rolsuper: boolean;
          readonly rolbypassrls: boolean;
          readonly rolcreatedb: boolean;
          readonly rolcreaterole: boolean;
        }[]
      >(
        `SELECT rolsuper, rolbypassrls, rolcreatedb, rolcreaterole
           FROM pg_roles WHERE rolname = '${RUNTIME_ROLE_NAME}'`,
      );

      expect(rol?.rolsuper).toBe(false);
      expect(rol?.rolbypassrls).toBe(false);
      expect(rol?.rolcreatedb).toBe(false);
      expect(rol?.rolcreaterole).toBe(false);

      const [propietario] = await prisma.$queryRawUnsafe<{ readonly duenio: string }[]>(
        `SELECT tableowner AS duenio FROM pg_tables WHERE tablename = 'person'`,
      );
      expect(propietario?.duenio).not.toBe(RUNTIME_ROLE_NAME);
    });

    it('no puede modificar el esquema', async () => {
      await expect(
        servicio.$transaction(async (tx) => {
          await tx.$executeRawUnsafe(`SET LOCAL ROLE "${RUNTIME_ROLE_NAME}"`);
          await tx.$executeRawUnsafe('CREATE TABLE "tabla_prohibida" (id int)');
        }),
      ).rejects.toThrow();

      await expect(
        servicio.$transaction(async (tx) => {
          await tx.$executeRawUnsafe(`SET LOCAL ROLE "${RUNTIME_ROLE_NAME}"`);
          await tx.$executeRawUnsafe('ALTER TABLE "person" ADD COLUMN "colado" text');
        }),
      ).rejects.toThrow();

      const [existe] = await prisma.$queryRawUnsafe<{ readonly total: bigint }[]>(
        `SELECT count(*)::bigint AS total FROM information_schema.tables
          WHERE table_name = 'tabla_prohibida'`,
      );
      expect(Number(existe?.total ?? 0)).toBe(0);
    });
  });
});
