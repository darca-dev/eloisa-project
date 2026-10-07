const fs = require('node:fs');
const { chromium } = require('playwright');

function localTestPassword() {
  const env = fs.readFileSync('.env', 'utf8');
  const line = env.split(/\r?\n/u).find((item) => item.startsWith('MERDN_OIDC_LOCAL_TEST_PASSWORD='));
  if (line === undefined) throw new Error('Falta MERDN_OIDC_LOCAL_TEST_PASSWORD');
  return line.slice(line.indexOf('=') + 1).trim();
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:3000/');
  await page.getByRole('link', { name: 'Iniciar sesión' }).click();
  await page.getByLabel('Correo electrónico').fill('persona.ficticia@ejemplo.invalid');
  await page.locator('#password').fill(localTestPassword());
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1500);

  const url = new URL(page.url());
  console.log(JSON.stringify({
    origin: url.origin,
    pathname: url.pathname,
    title: await page.title(),
    visibleHeadings: await page.getByRole('heading').allTextContents(),
  }));
  await browser.close();
})().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
