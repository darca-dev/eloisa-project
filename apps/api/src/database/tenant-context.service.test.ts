import { describe, expect, it, vi } from 'vitest';

import type { ApiEnvironmentProvider } from '../config/api-environment.provider';

import type { PrismaService } from './prisma.service';
import { ActiveTenantNotConfiguredError, TenantContextService } from './tenant-context.service';

/**
 * Pruebas unitarias del bootstrap del tenant activo (Spec 024).
 *
 * Aquí se comprueba el CONTRATO del servicio: qué consulta emite, dentro de qué
 * frontera transaccional, qué acepta y qué cachea. La evidencia decisiva de Row
 * Level Security, rol efectivo y aislamiento vive en las suites `.db.test.ts`
 * contra PostgreSQL real; este doble solo reproduce la regla que hace fallar el
 * arranque en frío —una fila de `tenant` es visible únicamente cuando la
 * transacción ya fijó ese mismo identificador— para poder ejercitar las parejas
 * discordantes sin depender del motor.
 *
 * Todos los identificadores y códigos son FICTICIOS.
 */

/** Tenant ficticio configurado del despliegue bajo prueba. */
const TENANT_ID = '11111111-1111-4111-8111-111111111111';
const TENANT_CODE = 'merdn-ficticio-a';

/** Segundo tenant ficticio: existe, pero jamás debe ser alcanzable. */
const OTHER_TENANT_ID = '22222222-2222-4222-8222-222222222222';
const OTHER_TENANT_CODE = 'merdn-ficticio-b';

/** Identificador y código que no corresponden a ninguna fila. */
const ABSENT_TENANT_ID = '33333333-3333-4333-8333-333333333333';
const ABSENT_TENANT_CODE = 'merdn-ficticio-inexistente';

interface TenantRow {
  readonly id: string;
  readonly code: string;
}

const ROWS: readonly TenantRow[] = [
  { id: TENANT_ID, code: TENANT_CODE },
  { id: OTHER_TENANT_ID, code: OTHER_TENANT_CODE },
];

interface PrismaDouble {
  readonly service: PrismaService;
  /** Identificadores con los que se abrió una transacción de contexto. */
  readonly contexts: string[];
  /** Filtros `where` con los que se consultó `tenant` dentro del contexto. */
  readonly queries: { id?: string; code?: string }[];
  /** Veces que se consultó `tenant` FUERA de una transacción de contexto. */
  readonly unscopedLookups: string[];
}

/**
 * Doble de `PrismaService` que reproduce la barrera de RLS: dentro de
 * `withTenant(id)` solo es visible la fila cuyo `id` coincide con el contexto.
 */
function createPrismaDouble(
  options: { readonly failContext?: boolean } = {},
): PrismaDouble {
  const contexts: string[] = [];
  const queries: { id?: string; code?: string }[] = [];
  const unscopedLookups: string[] = [];

  const service = {
    async withTenant<T>(
      tenantId: string,
      work: (tx: unknown) => Promise<T>,
    ): Promise<T> {
      contexts.push(tenantId);

      if (options.failContext === true) {
        // Equivale a `RuntimeContextUnavailableError`: el rol no pudo adoptarse.
        throw new Error('no fue posible adoptar el rol merdn_runtime');
      }

      const tx = {
        tenant: {
          async findFirst(args: {
            where: { id?: string; code?: string };
          }): Promise<TenantRow | null> {
            queries.push(args.where);
            const visible = ROWS.filter((row) => row.id === tenantId);
            return (
              visible.find(
                (row) =>
                  (args.where.id === undefined || row.id === args.where.id) &&
                  (args.where.code === undefined || row.code === args.where.code),
              ) ?? null
            );
          },
        },
      };

      return work(tx);
    },
    tenant: {
      async findUnique(args: {
        where: { code: string };
      }): Promise<TenantRow | null> {
        unscopedLookups.push(args.where.code);
        return ROWS.find((row) => row.code === args.where.code) ?? null;
      },
    },
  };

  return {
    service: service as unknown as PrismaService,
    contexts,
    queries,
    unscopedLookups,
  };
}

function createEnvironment(
  overrides: Partial<ApiEnvironmentProvider> = {},
): ApiEnvironmentProvider {
  return {
    runtimeRoleMode: 'enforce',
    activeTenantCode: TENANT_CODE,
    activeTenantId: TENANT_ID,
    ...overrides,
  } as unknown as ApiEnvironmentProvider;
}

function createService(
  prisma: PrismaDouble,
  environment: ApiEnvironmentProvider,
): TenantContextService {
  const service = new TenantContextService(prisma.service, environment);
  // El logger de Nest escribe en la salida del proceso; en pruebas se silencia
  // sin alterar el comportamiento observado.
  vi.spyOn(service['logger'], 'warn').mockImplementation(() => undefined);
  vi.spyOn(service['logger'], 'log').mockImplementation(() => undefined);
  return service;
}

describe('TenantContextService — bootstrap bajo rol runtime', () => {
  it('resuelve la pareja configurada dentro de una transacción de contexto', async () => {
    const prisma = createPrismaDouble();
    const service = createService(prisma, createEnvironment());

    await expect(service.resolveActiveTenant()).resolves.toStrictEqual({
      tenantId: TENANT_ID,
      tenantCode: TENANT_CODE,
    });

    // La lectura ocurrió DENTRO de `withTenant(configuredTenantId)`, nunca sobre
    // el cliente sin contexto: eso es exactamente lo que corrige la Spec 024.
    expect(prisma.contexts).toStrictEqual([TENANT_ID]);
    expect(prisma.unscopedLookups).toStrictEqual([]);
  });

  it('consulta la pareja EXACTA id + code y nunca enumera tenants', async () => {
    const prisma = createPrismaDouble();
    const service = createService(prisma, createEnvironment());

    await service.resolveActiveTenant();

    expect(prisma.queries).toStrictEqual([{ id: TENANT_ID, code: TENANT_CODE }]);
    // Sin `findMany`, sin búsqueda por código suelto y sin filtro parcial: no hay
    // consulta capaz de devolver una fila distinta de la configurada.
    expect(prisma.queries.every((where) => where.id !== undefined)).toBe(true);
    expect(prisma.queries.every((where) => where.code !== undefined)).toBe(true);
  });

  it.each([
    ['identificador inexistente', ABSENT_TENANT_ID, TENANT_CODE],
    ['código inexistente', TENANT_ID, ABSENT_TENANT_CODE],
    ['identificador válido con código de otro tenant', TENANT_ID, OTHER_TENANT_CODE],
    ['código válido con identificador de otro tenant', OTHER_TENANT_ID, TENANT_CODE],
  ])('falla cerrado con %s', async (_caso, configuredId, configuredCode) => {
    const prisma = createPrismaDouble();
    const service = createService(
      prisma,
      createEnvironment({ activeTenantId: configuredId, activeTenantCode: configuredCode }),
    );

    await expect(service.resolveActiveTenant()).rejects.toBeInstanceOf(
      ActiveTenantNotConfiguredError,
    );
  });

  it('produce el MISMO error para toda discordancia, sin oráculo de existencia', async () => {
    /*
     * Con el MISMO código configurado, un identificador inexistente y el
     * identificador de OTRO tenant existente deben ser indistinguibles: si los
     * mensajes difirieran, el error revelaría qué UUID corresponde a una fila y
     * serviría para sondear tenants ajenos.
     */
    const mensajes = await Promise.all(
      [ABSENT_TENANT_ID, OTHER_TENANT_ID].map(async (activeTenantId) => {
        const service = createService(
          createPrismaDouble(),
          createEnvironment({ activeTenantId, activeTenantCode: TENANT_CODE }),
        );
        try {
          await service.resolveActiveTenant();
          return 'no falló';
        } catch (error) {
          return (error as Error).message;
        }
      }),
    );

    expect(new Set(mensajes).size).toBe(1);
    expect(mensajes[0]).not.toBe('no falló');

    /*
     * Y un código configurado inexistente falla con la misma forma de error: la
     * única diferencia admisible es el eco del código ya registrado hoy en el
     * log de arranque, nunca la existencia de la fila.
     */
    const porCodigo = createService(
      createPrismaDouble(),
      createEnvironment({ activeTenantId: TENANT_ID, activeTenantCode: ABSENT_TENANT_CODE }),
    );
    await expect(porCodigo.resolveActiveTenant()).rejects.toBeInstanceOf(
      ActiveTenantNotConfiguredError,
    );
  });

  it('sanea el error: no revela el UUID configurado ni otro tenant', async () => {
    const service = createService(
      createPrismaDouble(),
      createEnvironment({ activeTenantId: ABSENT_TENANT_ID }),
    );

    try {
      await service.resolveActiveTenant();
      expect.unreachable('la resolución debía fallar cerrada');
    } catch (error) {
      const mensaje = (error as Error).message;
      expect(mensaje).not.toContain(ABSENT_TENANT_ID);
      expect(mensaje).not.toContain(TENANT_ID);
      expect(mensaje).not.toContain(OTHER_TENANT_ID);
      expect(mensaje).not.toContain(OTHER_TENANT_CODE);
    }
  });

  it('un bootstrap fallido NO deja caché y se reintenta desde cero', async () => {
    const prisma = createPrismaDouble();
    const service = createService(
      prisma,
      createEnvironment({ activeTenantId: ABSENT_TENANT_ID }),
    );

    await expect(service.resolveActiveTenant()).rejects.toBeInstanceOf(
      ActiveTenantNotConfiguredError,
    );
    // Sin caché envenenada: el segundo intento vuelve a fallar y vuelve a abrir
    // su propia transacción en lugar de devolver un contexto no verificado.
    await expect(service.resolveActiveTenant()).rejects.toBeInstanceOf(
      ActiveTenantNotConfiguredError,
    );
    expect(prisma.contexts).toStrictEqual([ABSENT_TENANT_ID, ABSENT_TENANT_ID]);
  });

  it('un fallo al adoptar el rol runtime falla cerrado y no cachea', async () => {
    const prisma = createPrismaDouble({ failContext: true });
    const service = createService(prisma, createEnvironment());

    await expect(service.resolveActiveTenant()).rejects.toBeInstanceOf(
      ActiveTenantNotConfiguredError,
    );

    try {
      await service.resolveActiveTenant();
      expect.unreachable('la resolución debía fallar cerrada');
    } catch (error) {
      // El motivo técnico del rol no se propaga en el mensaje del error.
      expect((error as Error).message).not.toContain('merdn_runtime');
    }
  });

  it('cachea SOLO el resultado verificado y no repite la transacción', async () => {
    const prisma = createPrismaDouble();
    const service = createService(prisma, createEnvironment());

    const primera = await service.resolveActiveTenant();
    const segunda = await service.resolveActiveTenant();

    expect(segunda).toStrictEqual(primera);
    expect(prisma.contexts).toStrictEqual([TENANT_ID]);
    expect(prisma.queries).toHaveLength(1);
  });

  it('no acepta selección de tenant: resuelve sin argumentos y solo desde configuración', async () => {
    const prisma = createPrismaDouble();
    const service = createService(prisma, createEnvironment());

    // La firma pública no admite parámetro alguno: no hay superficie por la que
    // una petición pueda proponer un tenant.
    expect(service.resolveActiveTenant.length).toBe(0);

    // Un intento de forzar otro tenant se ignora por completo.
    await (service.resolveActiveTenant as (...args: unknown[]) => Promise<unknown>)(
      OTHER_TENANT_ID,
      OTHER_TENANT_CODE,
    );

    expect(prisma.contexts).toStrictEqual([TENANT_ID]);
    expect(prisma.queries).toStrictEqual([{ id: TENANT_ID, code: TENANT_CODE }]);
  });

  it('falla cerrado en modo enforce si faltara el identificador configurado', async () => {
    const prisma = createPrismaDouble();
    const service = createService(
      prisma,
      createEnvironment({ activeTenantId: undefined }),
    );

    await expect(service.resolveActiveTenant()).rejects.toBeInstanceOf(
      ActiveTenantNotConfiguredError,
    );
    // No hay repliegue a una búsqueda por código bajo rol runtime.
    expect(prisma.unscopedLookups).toStrictEqual([]);
    expect(prisma.contexts).toStrictEqual([]);
  });

  it('conserva la resolución por código solo en el modo degradado sin RLS', async () => {
    const prisma = createPrismaDouble();
    const service = createService(
      prisma,
      createEnvironment({ runtimeRoleMode: 'disabled', activeTenantId: undefined }),
    );

    await expect(service.resolveActiveTenant()).resolves.toStrictEqual({
      tenantId: TENANT_ID,
      tenantCode: TENANT_CODE,
    });
    expect(prisma.unscopedLookups).toStrictEqual([TENANT_CODE]);
  });

  it('el arranque no propaga el fallo: la API sigue respondiendo sin caché', async () => {
    const prisma = createPrismaDouble();
    const service = createService(
      prisma,
      createEnvironment({ activeTenantId: ABSENT_TENANT_ID }),
    );

    await expect(service.onModuleInit()).resolves.toBeUndefined();
    // Y el fallo del arranque no dejó contexto reutilizable.
    await expect(service.resolveActiveTenant()).rejects.toBeInstanceOf(
      ActiveTenantNotConfiguredError,
    );
  });
});
