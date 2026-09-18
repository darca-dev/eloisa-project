import { defineConfig } from 'vitest/config';

/**
 * Runner de pruebas de la API (OD-03: Vitest en todo el monorepo).
 *
 * La inyección de dependencias de NestJS se declara de forma explícita con
 * `@Inject(...)` en los constructores, de modo que las pruebas no dependen de
 * `emitDecoratorMetadata`. Esto evita añadir un transformador adicional (SWC)
 * al conjunto de dependencias.
 *
 * `test/test-environment.ts` prepara variables de entorno ficticias antes de
 * cargar cualquier módulo. No define `DATABASE_URL` si el entorno ya la trae:
 * las pruebas de integración deben apuntar a la PostgreSQL de pruebas real.
 *
 * El cliente Prisma generado queda excluido de la recolección de pruebas.
 */
export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    setupFiles: ['./test/test-environment.ts'],
    globalSetup: ['./test/global-setup.ts'],
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    exclude: ['node_modules/**', 'dist/**', 'src/generated/**'],
    passWithNoTests: false,
    // Las pruebas de integración comparten una única base de datos: se ejecutan
    // en un solo proceso para que su preparación y limpieza sean deterministas.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
