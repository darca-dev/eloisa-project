import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs/promises';
const { execFileSync } = await import('node:child_process');
const apiContainer = JSON.parse(execFileSync('docker', ['inspect', 'merdn-admin040-e2e-api-1']))[0];
if (apiContainer.Config.Labels['com.merdn.scope'] !== 'test' || apiContainer.Config.Labels['com.merdn.disposable'] !== 'true' || apiContainer.Config.Labels['com.docker.compose.project'] !== 'merdn-admin040-e2e' || !apiContainer.Config.Env.includes('MERDN_ENVIRONMENT=test')) throw new Error('Refusing fictional registration outside the isolated test stack');
const browser = await chromium.launch({ headless: true });
async function browserRequest(page, resource, method = 'GET') {
  return page.evaluate(async ({ resource, method }) => {
    const response = await fetch(`http://127.0.0.1:3001${resource}`, { method, credentials: 'include' });
    return { status: response.status, body: await response.json().catch(() => null) };
  }, { resource, method });
}
try {
  for (const [index, experience] of ['hospital', 'municipality'].entries()) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    // Forward every request to the compiled local API to the isolated API image.
    // Responses and redirects are real; no authentication or business response is mocked.
    await context.route('http://127.0.0.1:3001/**', route => route.continue({ url: route.request().url().replace(':3001', ':3003') }));
    const page = await context.newPage();
    page.on('response', async response => {
      if (response.url().includes('/api/v1/institutional/') && response.status() >= 400) {
        const body = await response.json().catch(() => ({}));
        process.stdout.write(`Institutional HTTP result: ${new URL(response.url()).pathname} ${response.status()} ${typeof body.code === 'string' ? body.code : 'unclassified'}\n`);
      }
    });
    await page.goto(`http://127.0.0.1:3002/${experience}/registro`);
    await page.getByLabel('Tipo de documento').waitFor();
    await page.getByLabel('Número de documento').fill(`9999049990${index}`);
    await page.getByLabel('Nombres', { exact: true }).fill('Responsable');
    await page.getByLabel('Apellidos', { exact: true }).fill('Prueba aislada');
    await page.getByLabel('Fecha de nacimiento').fill('1980-01-01');
    await page.getByLabel('Sexo/género').selectOption('PREFIERE_NO_DECIRLO');
    await page.getByLabel('Correo de contacto').fill(`admin${index}@example.invalid`);
    const password = `A1${randomBytes(20).toString('hex')}`;
    await page.getByLabel('Contraseña', { exact: true }).fill(password);
    await page.getByLabel('Confirmar contraseña', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Crear primer administrador' }).click();
    await page.locator('strong').filter({ hasText: /^admin-/u }).waitFor({ timeout: 30000 });
    const username = await page.locator('strong').filter({ hasText: /^admin-/u }).innerText();
    await page.reload();
    await page.getByText(username, { exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Crear primer administrador' }).count(), 0);
    await page.getByRole('link', { name: 'Iniciar sesión', exact: true }).click();
    await page.locator('#username').waitFor({ timeout: 30000 });
    await page.locator('#username').fill(username); await page.locator('#password').fill(password);
    await page.locator('#kc-login').click();
    await page.waitForURL(`http://127.0.0.1:3002/${experience}`, { timeout: 30000 });
    const current = await browserRequest(page, `/api/v1/institutional/${experience}/administrator/current`);
    assert.equal(current.status, 200, 'OIDC must create a valid exact-bound server session');
    assert.equal(current.body.administrator, true);
    const experiences = await browserRequest(page, '/api/v1/me/experiences');
    assert.deepEqual(experiences.body.experiences, [experience.toUpperCase()]);
    for (const resource of experience === 'hospital' ? ['/api/v1/hospital/patients', '/api/v1/hospital/professionals'] : ['/api/v1/municipality/population-summary', '/api/v1/municipality/territory-summary']) {
      assert.equal((await browserRequest(page, resource)).status, 200, 'Real institutional operation must be authorized');
    }
    const other = experience === 'hospital' ? 'municipality' : 'hospital';
    assert.equal((await browserRequest(page, `/api/v1/institutional/${other}/administrator/current`)).status, 401);
    const logout = await browserRequest(page, '/api/v1/human-auth/logout', 'POST');
    assert.equal(logout.status, 204);
    assert.equal((await browserRequest(page, `/api/v1/institutional/${experience}/administrator/current`)).status, 401);
    await page.reload();
    await page.getByRole('link', { name: 'Iniciar sesión', exact: true }).waitFor();
    const stranger = await browser.newContext();
    const availability = await stranger.request.get(`http://127.0.0.1:3003/api/v1/institutional/${experience}/registration`);
    const closed = await availability.json(); assert.equal(closed.available, false); assert.equal(closed.username, undefined);
    await stranger.close(); await context.close();
    process.stdout.write(`${experience}: real registration, result recovery, OIDC/PKCE login, correct experience, isolation, logout and closed registration passed.\n`);
  }
} catch (error) {
  const pages = browser.contexts().flatMap(context => context.pages());
  await fs.mkdir('.tmp/admin040-browser', { recursive: true });
  for (const [index, page] of pages.entries()) {
    await page.screenshot({ path: `.tmp/admin040-browser/failure-${index}.png`, fullPage: true }).catch(() => undefined);
    await fs.writeFile(`.tmp/admin040-browser/failure-${index}.txt`, await page.locator('body').innerText().catch(() => 'unavailable'));
  }
  throw error;
} finally { await browser.close(); }
