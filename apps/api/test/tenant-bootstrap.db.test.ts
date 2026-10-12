import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';

import { type ApiEnvironment, loadApiEnvironment } from '../src/config/environment';
import { PrismaService, RUNTIME_ROLE_NAME } from '../src/database/prisma.service';
import {
  ActiveTenantNotConfiguredError,
  TenantContextService,
} from '../src/database/tenant-context.service';
import { type PrismaClient } from '../src/generated/prisma/client';

import { createTestPrismaClient, unavailableBanner } from './database-availability';

/**
 * EVIDENCIA DECISIVA del bootstrap del tenant activo (Spec 024) contra
 * PostgreSQL REAL, con `MERDN_RUNTIME_ROLE=enforce` y CACHÉ DE PROCESO VACÍA.
 *
 * Qué se prueba y por qué aquí:
 *
 * - el arranque en frío resuelve la pareja configurada `id + code` DENTRO de una
 *   transacción `withTenant`, que es exactamente lo que antes no ocurría y hacía
 *   que la política `tenant_self` ocultara incluso la fila configurada;
 * - identificador inexistente, código inexistente y pareja cruzada fallan
 *   CERRADO y no dejan caché;
 * - el rol efectivo es `merdn_runtime`, sin `BYPASSRLS`, y sin contexto no ve
 *   ninguna fila de `tenant`;
 * - rol y GUC locales no sobreviven a la transacción de bootstrap;
 * - las barreras de lectura y escritura entre dos tenants ficticios siguen en pie.
 *
 * CACHÉ VACÍA. Cada escenario construye un `TenantContextService` NUEVO. La
 * caché es estado de instancia, de modo que una instancia recién construida es
 * un arranque en frío real: ninguna aserción de esta suite puede aprovecharse
 * del contexto que resolvió otra.
 *
 * CREDENCIAL. La conexión de pruebas usa `DATABASE_URL` y el modo `enforce`
 * adopta `merdn_runtime` con `SET LOCAL ROLE`, igual que
 * `runtime-fail-closed.db.test.ts`. Lo que se verifica aquí es el ROL EFECTIVO
 * bajo el que corre la transacción —comprobado explícitamente con `current_user`
 * y `rolbypassrls`—, no la separación de credenciales de despliegue, que es
 * competencia de la Spec 023 y del preflight de staging. No se inventa ninguna
 * credencial ni se relaja ningún control para que la suite pase.
 *
 * Todos los tenants y códigos auxiliares son FICTICIOS y se retiran al final.
 */

const availability = inject('databaseAvailability');
const puedeEjecutarse =
  availability.available &&
  availability.migrated &&
  availability.engine === 'postgresql-server';

if (!puedeEjecutarse) {
  // eslint-disable-next-line no-console
  console.warn(`\n${unavailableBanner(availability)}\n`);
}

/** Código configurado del tenant activo en este entorno de pruebas. */
const CODIGO_ACTIVO = process.env['MERDN_ACTIVE_TENANT_CODE'] ?? 'merdn-mvp';

/** Segundo tenant FICTICIO: existe, pero el runtime jamás debe alcanzarlo. */
const CODIGO_TENANT_AJENO = 'merdn-test-bootstrap-ajeno';

/** UUID FICTICIO que no corresponde a ninguna fila. */
const ID_INEXISTENTE = '00000000-0000-4000-8000-0000000000ff';

/** Código FICTICIO que no corresponde a ninguna fila. */
const CODIGO_INEXISTENTE = 'merdn-test-bootstrap-inexistente';

/** Cadena de conexión válida y ficticia para las pruebas de configuración. */
const URL_ADMIN_FICTICIA =
  'postgresql://merdn_dev:change-me-local-only@127.0.0.1:5432/merdn_dev?schema=public';
const URL_RUNTIME_FICTICIA =
  'postgresql://merdn_runtime:change-me-local-only@127.0.0.1:5432/merdn_dev?schema=public';

/** Configuración mínima en modo `enforce` con la pareja indicada. */
function entorno(tenantId: string | undefined, tenantCode: string): ApiEnvironment {
  return {
    merdnEnvironment: 'test',
    port: 3001,
    openApiPath: 'docs',
    runtimeRoleMode: 'enforce',
    hasSeparateRuntimeConnection: false,
    activeTenantCode: tenantCode,
    activeTenantId: tenantId,
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

describe.skipIf(!puedeEjecutarse)('Bootstrap del tenant activo bajo enforce', () => {
  let prisma: PrismaClient;
  let servicio: PrismaService;
  let tenantId: string;
  let tenantAjenoId: string;

  /** Arranque en frío: instancia NUEVA, con la caché necesariamente vacía. */
  const arranqueEnFrio = (
    id: string | undefined,
    codigo: string,
  ): TenantContextService => new TenantContextService(servicio, entorno(id, codigo));

  beforeAll(async () => {
    prisma = createTestPrismaClient();

    const tenant = await prisma.tenant.findUnique({
      where: { code: CODIGO_ACTIVO },
      select: { id: true },
    });
    if (tenant === null) {
      throw new Error('El tenant institucional activo no existe: aplique las migraciones.');
    }
    tenantId = tenant.id;

    // Segundo tenant FICTICIO, creado con la credencial administrativa de las
    // pruebas. No es dato de referencia y se retira en `afterAll`.
    const ajeno = await prisma.tenant.upsert({
      where: { code: CODIGO_TENANT_AJENO },
      update: {},
      create: {
        code: CODIGO_TENANT_AJENO,
        name: 'Tenant ficticio de pruebas de bootstrap',
      },
      select: { id: true },
    });
    tenantAjenoId = ajeno.id;

    servicio = new PrismaService(entorno(tenantId, CODIGO_ACTIVO));
  });

  afterAll(async () => {
    await prisma.tenant.deleteMany({ where: { code: CODIGO_TENANT_AJENO } });
    await servicio.$disconnect();
    await prisma.$disconnect();
  });

  // --- Evidencia 1 y 2: arranque en frío con la pareja correcta -------------

  it('resuelve la pareja configurada en un arranque en frío con caché vacía', async () => {
    const contexto = arranqueEnFrio(tenantId, CODIGO_ACTIVO);

    await expect(contexto.resolveActiveTenant()).resolves.toStrictEqual({
      tenantId,
      tenantCode: CODIGO_ACTIVO,
    });
  });

  it('la resolución ocurre bajo el rol runtime y con el tenant fijado', async () => {
    const [fila] = await servicio.withTenant(tenantId, async (tx) =>
      tx.$queryRaw<
        { readonly rol: string; readonly tenant: string | null }[]
      >`SELECT current_user::text AS rol, current_setting('merdn.tenant_id', true) AS tenant`,
    );

    expect(fila?.rol).toBe(RUNTIME_ROLE_NAME);
    expect(fila?.tenant).toBe(tenantId);
  });

  // --- Evidencia 3 y 4: validación de configuración -------------------------

  it('la falta de MERDN_ACTIVE_TENANT_ID detiene la validación en modo enforce', () => {
    expect(() =>
      loadApiEnvironment({
        DATABASE_URL: URL_ADMIN_FICTICIA,
        RUNTIME_DATABASE_URL: URL_RUNTIME_FICTICIA,
        MERDN_RUNTIME_ROLE: 'enforce',
      }),
    ).toThrowError(/MERDN_ACTIVE_TENANT_ID/);
  });

  it('un identificador mal formado detiene la validación en modo enforce', () => {
    expect(() =>
      loadApiEnvironment({
        DATABASE_URL: URL_ADMIN_FICTICIA,
        RUNTIME_DATABASE_URL: URL_RUNTIME_FICTICIA,
        MERDN_RUNTIME_ROLE: 'enforce',
        MERDN_ACTIVE_TENANT_ID: CODIGO_ACTIVO,
      }),
    ).toThrowError(/MERDN_ACTIVE_TENANT_ID/);
  });

  // --- Evidencia 5, 6, 7 y 8: fail-closed y caché limpia --------------------

  it('un identificador configurado inexistente falla cerrado', async () => {
    const contexto = arranqueEnFrio(ID_INEXISTENTE, CODIGO_ACTIVO);

    await expect(contexto.resolveActiveTenant()).rejects.toBeInstanceOf(
      ActiveTenantNotConfiguredError,
    );
  });

  it('un código configurado inexistente falla cerrado', async () => {
    const contexto = arranqueEnFrio(tenantId, CODIGO_INEXISTENTE);

    await expect(contexto.resolveActiveTenant()).rejects.toBeInstanceOf(
      ActiveTenantNotConfiguredError,
    );
  });

  it('una pareja cruzada entre dos tenants reales falla cerrado', async () => {
    // Identificador válido con el código del OTRO tenant.
    await expect(
      arranqueEnFrio(tenantId, CODIGO_TENANT_AJENO).resolveActiveTenant(),
    ).rejects.toBeInstanceOf(ActiveTenantNotConfiguredError);

    // Código válido con el identificador del OTRO tenant.
    await expect(
      arranqueEnFrio(tenantAjenoId, CODIGO_ACTIVO).resolveActiveTenant(),
    ).rejects.toBeInstanceOf(ActiveTenantNotConfiguredError);
  });

  it('un bootstrap fallido NO cachea y el siguiente intento vuelve a fallar', async () => {
    const contexto = arranqueEnFrio(ID_INEXISTENTE, CODIGO_ACTIVO);

    await expect(contexto.resolveActiveTenant()).rejects.toBeInstanceOf(
      ActiveTenantNotConfiguredError,
    );
    await expect(contexto.resolveActiveTenant()).rejects.toBeInstanceOf(
      ActiveTenantNotConfiguredError,
    );

    // Y el arranque fallido tampoco deja contexto tras `onModuleInit`, que
    // deliberadamente no propaga el error para no impedir `GET /health`.
    const otro = arranqueEnFrio(ID_INEXISTENTE, CODIGO_ACTIVO);
    await otro.onModuleInit();
    await expect(otro.resolveActiveTenant()).rejects.toBeInstanceOf(
      ActiveTenantNotConfiguredError,
    );
  });

  it('el error del bootstrap no revela el identificador configurado', async () => {
    const contexto = arranqueEnFrio(ID_INEXISTENTE, CODIGO_ACTIVO);

    await expect(contexto.resolveActiveTenant()).rejects.toThrow(
      expect.objectContaining({
        message: expect.not.stringContaining(ID_INEXISTENTE) as unknown as string,
      }),
    );

    try {
      await contexto.resolveActiveTenant();
    } catch (error) {
      const mensaje = (error as Error).message;
      expect(mensaje).not.toContain(tenantId);
      expect(mensaje).not.toContain(tenantAjenoId);
      expect(mensaje).not.toContain(CODIGO_TENANT_AJENO);
    }
  });

  // --- Evidencia 9, 10 y 11: visibilidad de `tenant` bajo RLS ---------------

  it('el runtime SIN contexto no ve ninguna fila de tenant', async () => {
    const filas = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL ROLE "${RUNTIME_ROLE_NAME}"`);
      return tx.$queryRaw<{ readonly total: bigint }[]>`SELECT count(*) AS total FROM tenant`;
    });

    expect(Number(filas[0]?.total ?? -1)).toBe(0);
  });

  it('con el contexto configurado ve EXACTAMENTE su propia fila', async () => {
    const filas = await servicio.withTenant(tenantId, async (tx) =>
      tx.$queryRaw<{ readonly id: string; readonly code: string }[]>`SELECT id, code FROM tenant`,
    );

    expect(filas).toHaveLength(1);
    expect(filas[0]?.id).toBe(tenantId);
    expect(filas[0]?.code).toBe(CODIGO_ACTIVO);
  });

  it('el rol runtime no puede enumerar otro tenant ni por id ni por código', async () => {
    const resultado = await servicio.withTenant(tenantId, async (tx) => ({
      porId: await tx.tenant.findMany({ where: { id: tenantAjenoId } }),
      porCodigo: await tx.tenant.findMany({ where: { code: CODIGO_TENANT_AJENO } }),
      todos: await tx.tenant.findMany({ select: { id: true } }),
    }));

    expect(resultado.porId).toStrictEqual([]);
    expect(resultado.porCodigo).toStrictEqual([]);
    expect(resultado.todos.map((fila) => fila.id)).toStrictEqual([tenantId]);
  });

  // --- Evidencia 12 y 13: identidad efectiva del runtime --------------------

  it('el rol efectivo es merdn_runtime y no puede saltarse RLS', async () => {
    const [identidad] = await servicio.withTenant(tenantId, async (tx) =>
      tx.$queryRaw<
        {
          readonly rol: string;
          readonly bypassrls: boolean;
          readonly superusuario: boolean;
        }[]
      >`SELECT current_user::text AS rol, rolbypassrls AS bypassrls, rolsuper AS superusuario
          FROM pg_roles WHERE rolname = current_user`,
    );

    expect(identidad?.rol).toBe(RUNTIME_ROLE_NAME);
    expect(identidad?.bypassrls).toBe(false);
    expect(identidad?.superusuario).toBe(false);
  });

  // --- Evidencia 14: sin fuga de rol ni de GUC ------------------------------

  it('la transacción de bootstrap no deja rol ni GUC en la conexión reutilizada', async () => {
    const [antes] = await servicio.$queryRaw<{ readonly rol: string }[]>`SELECT current_user::text AS rol`;
    await arranqueEnFrio(tenantId, CODIGO_ACTIVO).resolveActiveTenant();

    // Varias lecturas seguidas: el pool puede devolver conexiones distintas y
    // ninguna debe conservar el rol ni el tenant de la transacción anterior.
    for (let intento = 0; intento < 5; intento += 1) {
      const [estado] = await servicio.$queryRaw<
        { readonly rol: string; readonly tenant: string | null }[]
      >`SELECT current_user::text AS rol, current_setting('merdn.tenant_id', true) AS tenant`;

      expect(antes?.rol).toBeDefined();
      expect(estado?.rol).toBe(antes?.rol);
      expect(estado?.tenant === null || estado?.tenant === '').toBe(true);
    }
  });

  // --- Evidencia 18 y 19: barreras entre tenants ----------------------------

  it('una lectura entre tenants sigue bloqueada', async () => {
    const ajenas = await servicio.withTenant(tenantAjenoId, async (tx) =>
      tx.$queryRaw<{ readonly id: string }[]>`SELECT id FROM tenant`,
    );

    // Con el contexto del OTRO tenant tampoco se ve el tenant activo.
    expect(ajenas.map((fila) => fila.id)).toStrictEqual([tenantAjenoId]);
  });

  it('una escritura entre tenants sigue bloqueada', async () => {
    /*
     * Bajo el contexto del tenant AJENO se intenta modificar la fila del tenant
     * activo. La barrera es doble y la más externa gana: `merdn_runtime` ni
     * siquiera tiene permiso de escritura sobre `tenant`, de modo que PostgreSQL
     * rechaza la sentencia con `42501` antes de evaluar RLS. Se comprueban las
     * dos mitades —la sentencia falla y la fila no cambia— para que un futuro
     * `GRANT` no convierta este caso en un falso positivo silencioso.
     */
    const antes = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true },
    });

    await expect(
      servicio.withTenant(tenantAjenoId, async (tx) =>
        tx.$executeRaw`UPDATE tenant SET name = 'intento-de-escritura-cruzada' WHERE id = ${tenantId}::uuid`,
      ),
    ).rejects.toThrowError();

    const despues = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true },
    });

    expect(despues?.name).toBe(antes?.name);
    expect(despues?.name).not.toBe('intento-de-escritura-cruzada');
  });

  it('el rol runtime tampoco puede escribir en su PROPIO tenant', async () => {
    // Mínimo privilegio: `tenant` es catálogo institucional, no dato operativo
    // del runtime. Ni con el contexto correcto se admite la escritura.
    await expect(
      servicio.withTenant(tenantId, async (tx) =>
        tx.$executeRaw`UPDATE tenant SET name = 'intento-de-escritura-propia' WHERE id = ${tenantId}::uuid`,
      ),
    ).rejects.toThrowError();
  });
});
