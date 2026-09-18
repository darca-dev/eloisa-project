import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../src/generated/prisma/client';

/**
 * Disponibilidad y naturaleza de la PostgreSQL de pruebas
 * (TASK-MVP-CORE-01 §12, §15.13).
 *
 * Las pruebas de integración de esta tarea DEBEN ejecutarse contra PostgreSQL
 * real. Este módulo no las sustituye por dobles de prueba: comprueba si la base
 * está disponible y, cuando no lo está, las marca como NO EJECUTADAS con un
 * motivo visible, de modo que una ejecución sin base de datos jamás pueda
 * confundirse con una verificación satisfactoria.
 *
 * Además distingue el motor: un servidor PostgreSQL atiende varias conexiones
 * en paralelo, mientras que una compilación WebAssembly de PostgreSQL (PGlite)
 * ejecuta un único motor y serializa el acceso. Las pruebas que dependen de
 * concurrencia real solo son concluyentes en el primer caso.
 */

export type DatabaseEngine = 'postgresql-server' | 'postgresql-wasm' | 'unknown';

export interface DatabaseAvailability {
  readonly available: boolean;
  /** Motivo técnico cuando no está disponible. Nunca incluye credenciales. */
  readonly reason: string | null;
  /** Indica si el esquema de CORE-01 ya está aplicado. */
  readonly migrated: boolean;
  readonly engine: DatabaseEngine;
  /** Cadena `version()` recortada, útil como evidencia de la ejecución. */
  readonly version: string | null;
}

let cached: DatabaseAvailability | null = null;

/** Crea un cliente Prisma contra la base configurada por el entorno. */
export function createTestPrismaClient(): PrismaClient {
  const connectionString = process.env['DATABASE_URL'];
  if (connectionString === undefined || connectionString.length === 0) {
    throw new Error('DATABASE_URL no está definida en el entorno de pruebas.');
  }

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    log: ['warn', 'error'],
  });
}

/**
 * Comprueba una sola vez si la base responde, qué motor la atiende y si el
 * esquema está aplicado. El motivo del fallo se reduce al nombre del error para
 * no arrastrar la cadena de conexión a la salida de las pruebas.
 */
export async function checkDatabase(): Promise<DatabaseAvailability> {
  if (cached !== null) {
    return cached;
  }

  const prisma = createTestPrismaClient();
  let version: string | null = null;

  try {
    const rows = await prisma.$queryRaw<{ version: string }[]>`SELECT version()`;
    version = rows[0]?.version ?? null;
  } catch (error) {
    cached = {
      available: false,
      migrated: false,
      engine: 'unknown',
      version: null,
      reason: describe(error),
    };
    await prisma.$disconnect().catch(() => undefined);
    return cached;
  }

  const engine: DatabaseEngine =
    version === null
      ? 'unknown'
      : /wasm|emscripten/i.test(version)
        ? 'postgresql-wasm'
        : 'postgresql-server';

  try {
    await prisma.tenant.count();
    cached = { available: true, migrated: true, engine, version, reason: null };
  } catch (error) {
    cached = {
      available: true,
      migrated: false,
      engine,
      version,
      reason: `El esquema de CORE-01 no está aplicado: ${describe(error)}`,
    };
  }

  await prisma.$disconnect().catch(() => undefined);
  return cached;
}

function describe(error: unknown): string {
  if (error instanceof Error) {
    // Solo el nombre y la primera línea: los mensajes de Prisma pueden incluir
    // el host y el nombre de la base de datos.
    const [firstLine] = error.message.split('\n');
    return `${error.name}: ${firstLine ?? ''}`.trim();
  }
  return 'Error desconocido al contactar PostgreSQL.';
}

/**
 * Mensaje único y explícito que se imprime cuando las pruebas de base de datos
 * no pueden ejecutarse. Debe ser inconfundible en la salida de la ejecución.
 */
export function unavailableBanner(availability: DatabaseAvailability): string {
  return (
    'PRUEBAS DE POSTGRESQL NO EJECUTADAS. ' +
    'TASK-MVP-CORE-01 §12 exige PostgreSQL real y estas pruebas NO se sustituyen ' +
    'por dobles de prueba. ' +
    `Motivo: ${availability.reason ?? 'desconocido'}. ` +
    'Levante la base con `docker compose up -d postgres`, aplique las migraciones ' +
    'con `npx prisma migrate deploy` y vuelva a ejecutar la suite.'
  );
}
