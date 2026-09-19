import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E config para MERDN (Spec 027 Fase 5).
 *
 * Requiere: API (puerto 3001) + Web (puerto 3000) + Keycloak (puerto 8081) corriendo.
 * Ejecutar con: `docker compose --profile oidc-local up -d` antes de `npm run test:e2e`
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      NEXT_TELEMETRY_DISABLED: '1',
    },
  },
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
});