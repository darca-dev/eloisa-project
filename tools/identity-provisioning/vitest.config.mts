import { defineConfig } from 'vitest/config';

/**
 * Runner de pruebas del comando administrativo de aprovisionamiento de
 * identidad (IDENTITY-RELATIONSHIPS-CORE-01 §9).
 *
 * INDEPENDIENTE DEL DE LA API, y a propósito: este paquete vive FUERA de la API
 * en ejecución, no arranca NestJS y no toca PostgreSQL. Heredar el runner de
 * `apps/api` le impondría su `setupFiles` y su `globalSetup` —variables de
 * entorno ficticias y comprobación de disponibilidad de la base—, que aquí no
 * describen nada y solo harían depender estas pruebas de un motor que no usan.
 *
 * `root` apunta al directorio de ESTE archivo para que `include` se resuelva
 * contra el paquete y no contra el directorio desde el que se invoque el
 * comando.
 */
export default defineConfig({
  root: import.meta.dirname,
  test: {
    environment: 'node',
    globals: false,
    include: ['src/**/*.test.ts'],
    passWithNoTests: false,
  },
});
