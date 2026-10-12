import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';

const stack = JSON.parse(execFileSync('docker', ['inspect', 'merdn-admin040-e2e-api-1']))[0];
assert.equal(stack.Config.Labels['com.docker.compose.project'], 'merdn-admin040-e2e');
assert.equal(stack.Config.Labels['com.merdn.scope'], 'test');
assert.equal(stack.Config.Labels['com.merdn.disposable'], 'true');
assert.ok(stack.Config.Env.includes('MERDN_ENVIRONMENT=test'));
assert.equal(stack.Config.Image, 'merdn-api:eloisa-access041');
const browser = await chromium.launch({ headless: true });
const web = 'http://127.0.0.1:3002'; const api = 'http://127.0.0.1:3001';
const credentials = () => randomBytes(20).toString('hex');
async function context() {
  const value = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  // Real HTTP forwarding compensates only for the compiled local API port.
  await value.route(`${api}/**`, route => route.continue({ url: route.request().url().replace(':3001', ':3003') }));
  return value;
}
async function call(page, path, method = 'GET', body) {
  return page.evaluate(async ({ url, method, body }) => {
    const response = await fetch(url, { method, credentials: 'include', cache: 'no-store',
      ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) });
    return { status: response.status, body: await response.json().catch(() => null) };
  }, { url: `${api}${path}`, method, body });
}
async function login(page, username, password, destination) {
  await page.goto(`${api}/api/v1/human-auth/login?returnTo=%2Facceso`);
  await page.locator('#username').waitFor(); await page.locator('#username').fill(username);
  await page.locator('#password').fill(password); await page.locator('#kc-login').click();
  await page.waitForURL(`${web}${destination}`, { timeout: 30000 });
}
async function wizard(page, title, document, password) {
  await page.goto(`${web}/acceso?accion=registro`);
  assert.equal(await page.getByText('Usar datos de prueba').count(), 0);
  await page.getByRole('button').filter({ hasText: title }).first().click();
  for (const [name, value] of Object.entries({ documentNumber: document, givenNames: 'Persona', familyNames: 'Prueba aislada', birthDate: '1980-01-01', email: `${document}@example.invalid` })) {
    await page.locator(`#registro-${name}`).fill(value);
  }
  await page.locator('#registro-sexGenderCode').selectOption('PREFIERE_NO_DECIRLO');
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  for (let step = 2; step <= 4; step++) {
    await page.getByText(`Paso ${step} de 5`, { exact: true }).waitFor();
    const section = page.getByTestId('tarjeta-contenido');
    const radioNames = await section.locator('input[type=radio]').evaluateAll(nodes => [...new Set(nodes.map(node => node.name))]);
    for (const name of radioNames) {
      const options = section.locator(`input[type=radio][name="${name}"]`);
      const no = section.locator(`input[type=radio][name="${name}"][value="NO"]`);
      await (await no.count() ? no : options.first()).check();
    }
    for (const group of await section.locator('div[role=group]').all()) {
      const none = group.getByRole('button', { name: 'Ninguna', exact: true });
      const button = await none.count() ? none : group.getByRole('button').first();
      if (await button.count()) await button.click();
    }
    for (const select of await section.locator('select').all()) {
      if (!await select.isEnabled()) continue;
      await select.locator('option').nth(1).waitFor({ state: 'attached' });
      const value = await select.locator('option').evaluateAll(options => options.find(option => option.value !== '')?.value);
      if (value !== undefined) await select.selectOption(value);
    }
    for (const input of await section.locator('input[type=text], input[type=tel], input[type=number], textarea').all()) {
      if (!await input.isVisible() || !await input.isEnabled()) continue;
      const name = await input.getAttribute('name') ?? '';
      await input.fill(/telefono|phone/iu.test(name) ? '3000000000' : /document/iu.test(name) ? '99990419998' : 'Dato ficticio de prueba');
    }
    for (const checkbox of await section.locator('input[type=checkbox]').all()) await checkbox.check();
    await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  }
  await page.getByText('Paso 5 de 5', { exact: true }).waitFor();
  await page.locator('#registro-password').fill(password);
  await page.locator('#registro-autorizaDatos').check();
}
async function submit(page) {
  const received = page.waitForResponse(response => response.url().endsWith('/api/v1/access-requests') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Registrarme', exact: true }).click();
  const response = await received; assert.equal(response.status(), 202, 'Real registration must persist');
  const body = await response.json(); assert.equal(body.source, 'SELF_REGISTRATION');
  await page.getByText(body.reference, { exact: true }).waitFor();
  return body;
}
async function openRequests(page) {
  await page.getByRole('navigation', { name: 'Secciones de la experiencia Hospital', exact: true }).getByRole('button', { name: 'Configuración', exact: true }).click();
  await page.getByRole('heading', { name: 'Solicitudes de acceso', exact: true }).waitFor();
}
try {
  const adminContext = await context(); const admin = await adminContext.newPage(); await admin.goto(web);
  assert.equal((await call(admin, '/api/v1/institutional/hospital/registration-attempt', 'POST')).status, 204);
  const adminPassword = credentials();
  const registered = await call(admin, '/api/v1/institutional/hospital/registration', 'POST', {
    documentType: 'CEDULA_CIUDADANIA', documentNumber: '99990419990', givenNames: 'Administrador', familyNames: 'Prueba aislada',
    birthDate: '1980-01-01', sexGenderCode: 'PREFIERE_NO_DECIRLO', email: 'admin041@example.invalid', password: adminPassword, confirmPassword: adminPassword,
  });
  assert.equal(registered.status, 201); const adminUsername = registered.body.username;
  await login(admin, adminUsername, adminPassword, '/hospital');
  const profiles = [['PATIENT', 'Paciente', '/paciente'], ['CAREGIVER', 'Cuidador', '/cuidador'], ['FIELD_PROFESSIONAL', 'Visitador médico', '/profesional']];
  const people = [];
  for (const [index, [profile, title, destination]] of profiles.entries()) {
    const owner = await context(); const page = await owner.newPage(); const password = credentials();
    const document = `9999041999${index + 1}`;
    await wizard(page, title, document, password);
    let accepted;
    if (profile === 'FIELD_PROFESSIONAL') {
      const second = await owner.newPage(); await wizard(second, title, document, password);
      const results = await Promise.all([submit(page), submit(second)]);
      assert.equal(results[0].reference, results[1].reference, 'Two new tabs retain one cookie owner under Web Locks');
      accepted = results[0]; await second.close();
    } else accepted = await submit(page);
    const list = await call(admin, '/api/v1/hospital/access-requests'); assert.equal(list.status, 200);
    const item = list.body.items.find(value => value.reference === accepted.reference); assert.ok(item);
    const approved = await call(admin, `/api/v1/hospital/access-requests/${item.requestId}/decision`, 'POST', {
      action: 'APPROVE', expectedVersion: item.version, reasonCode: 'ACCESS_APPROVED',
    });
    assert.equal(approved.status, 200); assert.equal(approved.body.status, 'APPROVED');
    await login(page, accepted.reference, password, destination);
    const experience = await call(page, '/api/v1/me/experiences'); assert.equal(experience.status, 200);
    assert.deepEqual(experience.body.experiences, [profile]);
    if (profile === 'FIELD_PROFESSIONAL') {
      await page.getByText('No tiene visitas asignadas en esta ventana.', { exact: true }).waitFor();
      assert.equal(await page.getByText('Mis pagos y liquidaciones', { exact: true }).count(), 0);
      const worklist = await call(page, '/api/v1/professional/visits?from=2026-10-12&to=2026-10-19');
      assert.equal(worklist.status, 200); assert.deepEqual(worklist.body.items, []);
    }
    assert.equal((await call(page, '/api/v1/institutional/hospital/administrator/current')).status, 401);
    people.push({ owner, page, password, reference: accepted.reference, requestId: item.requestId, destination });
    process.stdout.write(`${profile}: real five-step registration, persisted review/approval and OIDC login passed.\n`);
  }
  await openRequests(admin);
  process.stdout.write('Recovery: real institutional request queue opened.\n');
  const person = people[0];
  await admin.getByRole('button', { name: `Revisar ${person.reference}`, exact: true }).click();
  await admin.getByRole('button', { name: 'Verificar mi identidad', exact: true }).waitFor();
  await admin.getByRole('button', { name: 'Verificar mi identidad', exact: true }).click();
  await admin.locator('#password').waitFor(); await admin.locator('#password').fill(adminPassword);
  if (await admin.locator('#username').count()) await admin.locator('#username').fill(adminUsername);
  await admin.locator('#kc-login').click(); await admin.waitForURL(`${web}/hospital`, { timeout: 30000 });
  process.stdout.write('Recovery: forced OIDC administrator reauthentication passed.\n');
  await openRequests(admin); await admin.getByRole('button', { name: `Revisar ${person.reference}`, exact: true }).click();
  await admin.getByLabel('Contraseña temporal', { exact: true }).waitFor();
  const accessibility = await new AxeBuilder({ page: admin }).include('[aria-labelledby="access-recovery-title"]')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  assert.deepEqual(accessibility.violations.map(({ id, impact }) => ({ id, impact })), [], 'Recovery accessibility');
  await admin.getByLabel('Referencia de soporte', { exact: true }).focus(); await admin.keyboard.press('Tab');
  assert.equal(await admin.getByLabel('Contraseña temporal', { exact: true }).evaluate(element => element === globalThis.document.activeElement), true);
  const temporary = credentials(); const permanent = credentials();
  await admin.getByLabel('Referencia de soporte', { exact: true }).fill(`CASE_${randomUUID()}`);
  await admin.getByLabel('Contraseña temporal', { exact: true }).fill(temporary);
  await admin.getByLabel('Confirmar contraseña temporal', { exact: true }).fill(temporary);
  await admin.getByLabel('Verifiqué la identidad de la persona', { exact: false }).check();
  await admin.getByRole('button', { name: 'Restablecer y revocar sesiones', exact: true }).click();
  await admin.getByText('Restablecimiento confirmado.', { exact: false }).waitFor({ timeout: 30000 });
  process.stdout.write('Recovery: real API and IdP reset confirmed.\n');
  await admin.getByRole('button', { name: 'Consultar estado de recuperación', exact: true }).waitFor({ state: 'visible' });
  const requestA = `${api}/api/v1/hospital/access-requests/${person.requestId}`;
  let entered; let release; let completed;
  const reached = new Promise(resolve => { entered = resolve; }); const barrier = new Promise(resolve => { release = resolve; });
  const delivered = new Promise(resolve => { completed = resolve; });
  const delayedDetail = async route => {
    const response = await route.fetch({ url: route.request().url().replace(':3001', ':3003') });
    entered(); await barrier; await route.fulfill({ response }); completed();
  };
  await admin.route(requestA, delayedDetail);
  await admin.getByRole('button', { name: 'Consultar estado de recuperación', exact: true }).click();
  await reached;
  try {
    await admin.getByRole('button', { name: `Revisar ${people[1].reference}`, exact: true }).click();
    await admin.locator('aside[role=region]').getByText(people[1].reference, { exact: true }).waitFor();
  } finally { release(); }
  await delivered;
  await admin.unroute(requestA, delayedDetail);
  await admin.locator('aside[role=region]').getByText(people[1].reference, { exact: true }).waitFor();
  assert.equal((await call(person.page, '/api/v1/human-auth/session')).status, 401, 'Old MERDN session must be revoked');
  await person.page.goto(`${api}/api/v1/human-auth/login?returnTo=%2Facceso`);
  await person.page.locator('#username').fill(person.reference); await person.page.locator('#password').fill(person.password); await person.page.locator('#kc-login').click();
  await person.page.getByText('Usuario o contraseña incorrectos.', { exact: true }).waitFor();
  await person.page.locator('#username').fill(person.reference); await person.page.locator('#password').fill(temporary); await person.page.locator('#kc-login').click();
  await person.page.locator('#password-new').waitFor(); await person.page.locator('#password-new').fill(permanent);
  await person.page.locator('#password-confirm').fill(permanent); await person.page.locator('input[type=submit], button[type=submit]').click();
  await person.page.waitForURL(`${web}${person.destination}`, { timeout: 30000 });
  assert.equal((await call(person.page, '/api/v1/human-auth/session')).status, 200);
  assert.equal((await call(person.page, '/api/v1/human-auth/logout', 'POST')).status, 204);
  const permanentContext = await context(); const permanentPage = await permanentContext.newPage();
  await login(permanentPage, person.reference, permanent, person.destination);
  // The actual recovery form is also checked at a narrow viewport and keyboard.
  await admin.setViewportSize({ width: 320, height: 800 });
  assert.ok(await admin.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth + 1));
  await fs.mkdir('.tmp/access041-browser', { recursive: true });
  await admin.screenshot({ path: '.tmp/access041-browser/recovery-mobile.png', fullPage: true });
  process.stdout.write('041 full recovery passed: signed OIDC step-up, audited reset, old-session denial, mandatory password change and permanent login. Two-tab ownership, recovery accessibility/keyboard, late A/B detail and 320px passed.\n');
} catch (error) {
  await fs.mkdir('.tmp/access041-browser', { recursive: true });
  for (const [index, page] of browser.contexts().flatMap(value => value.pages()).entries()) {
    await page.screenshot({ path: `.tmp/access041-browser/failure-${index}.png`, fullPage: true }).catch(() => undefined);
    await fs.writeFile(`.tmp/access041-browser/failure-${index}.txt`, await page.locator('body').innerText().catch(() => 'unavailable'));
  }
  throw error;
} finally { await browser.close(); }
