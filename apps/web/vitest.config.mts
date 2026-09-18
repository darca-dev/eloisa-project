import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

/**
 * Runner de pruebas del frontend (OD-03: Vitest en todo el monorepo).
 *
 * - `oxc.jsx.runtime` habilita la transformación JSX automática en las pruebas.
 *   `apps/web/tsconfig.json` mantiene `jsx: "preserve"` porque es Next.js quien
 *   transforma el JSX durante `next dev` y `next build`.
 * - El alias `@/` replica el `paths` de `tsconfig.json` para que las pruebas
 *   resuelvan los mismos módulos que la aplicación.
 * - Las pruebas renderizan los componentes de servidor con `react-dom/server`,
 *   de modo que no se requiere jsdom ni una librería de testing adicional.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  oxc: {
    jsx: {
      runtime: 'automatic',
    },
  },
  test: {
    environment: 'node',
    globals: false,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    passWithNoTests: false,
  },
});
