import { type TestProject } from 'vitest/node';

import './test-environment';

import {
  checkDatabase,
  createTestPrismaClient,
  type DatabaseAvailability,
} from './database-availability';

/**
 * Preparación global de la suite de la API (TASK-MVP-CORE-01 §12).
 *
 * Comprueba UNA sola vez si la PostgreSQL de pruebas está disponible y qué
 * motor la atiende, y publica el resultado para que cada archivo de pruebas lo
 * consulte de forma síncrona con `inject('databaseAvailability')`.
 *
 * De este modo las pruebas que exigen base de datos pueden marcarse como no
 * ejecutadas en el momento de recolectarlas, sin sustituirlas por dobles de
 * prueba y sin ocultar el motivo.
 */
declare module 'vitest' {
  interface ProvidedContext {
    readonly databaseAvailability: DatabaseAvailability;
  }
}

export async function setup(project: TestProject): Promise<void> {
  const availability = await checkDatabase();

  if (availability.available && availability.migrated) {
    await allowRuntimeRoleOnDevEngineArtifacts(availability);
  }

  project.provide('databaseAvailability', availability);
}

/**
 * Neutraliza un artefacto EXCLUSIVO del motor de desarrollo de Prisma.
 *
 * Ese motor instala en cada tabla un trigger propio (`prisma_dev_wal_capture`)
 * que registra los cambios en `_prisma_dev_wal.events` para su función de
 * streaming. Bajo `SET LOCAL ROLE merdn_runtime` esa escritura interna aborta
 * el proceso del motor: se comprobó que la misma inserción, con el trigger
 * desactivado, se ejecuta correctamente y respeta la política de RLS.
 *
 * Es, por tanto, un defecto del motor de desarrollo y no de las políticas. Los
 * triggers se desactivan aquí, SOLO en pruebas y SOLO si el motor es la
 * compilación WebAssembly. No se toca ninguna migración, ninguna política de
 * seguridad ni el mínimo privilegio del rol; en un servidor PostgreSQL normal
 * estos triggers no existen y esta función no hace nada.
 */
async function allowRuntimeRoleOnDevEngineArtifacts(
  availability: DatabaseAvailability,
): Promise<void> {
  if (availability.engine !== 'postgresql-wasm') {
    return;
  }

  const prisma = createTestPrismaClient();

  try {
    const triggers = await prisma.$queryRawUnsafe<{ tabla: string }[]>(
      `SELECT tgrelid::regclass::text AS tabla
         FROM pg_trigger
        WHERE NOT tgisinternal AND tgname = 'prisma_dev_wal_capture'`,
    );

    for (const { tabla } of triggers) {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE ${tabla} DISABLE TRIGGER "prisma_dev_wal_capture"`,
      );
    }
  } catch {
    // Si el motor no instala esos triggers, no hay nada que neutralizar.
  } finally {
    await prisma.$disconnect().catch(() => undefined);
  }
}
