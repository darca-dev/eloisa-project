import 'dotenv/config';

import { defineConfig, env } from 'prisma/config';

/**
 * Configuración de la CLI de Prisma 7 para MERDN (TASK-001, FR-09 / AC-07).
 *
 * - `schema` apunta al esquema sin modelos declarado en `prisma/schema.prisma`.
 * - `datasource.url` se resuelve desde `DATABASE_URL`. `env()` falla con un
 *   error explícito si la variable no está definida, y nunca imprime su valor.
 * - `import 'dotenv/config'` carga `.env` en desarrollo local: Prisma 7 ya no
 *   lo hace automáticamente.
 *
 * No se declara configuración de `migrations`, `seed` ni adaptadores: TASK-001
 * prohíbe migraciones y datos de negocio.
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: env('DATABASE_URL'),
  },
});
