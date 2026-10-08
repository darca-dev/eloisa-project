const fs = process.getBuiltinModule('node:fs');

function localTestPassword() {
  const env = fs.readFileSync('.env', 'utf8');
  const line = env.split(/\r?\n/u).find((item) => item.startsWith('MERDN_OIDC_LOCAL_TEST_PASSWORD='));
  if (line === undefined) throw new Error('Falta MERDN_OIDC_LOCAL_TEST_PASSWORD');
  return line.slice(line.indexOf('=') + 1).trim();
}

(async () => {
  const { chromium } = await import('playwright');
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
  process.stdout.write(JSON.stringify({
    origin: url.origin,
    pathname: url.pathname,
    title: await page.title(),
    visibleHeadings: await page.getByRole('heading').allTextContents(),
  }) + '\n');
  await browser.close();
})().catch((error) => {
  process.stderr.write((error instanceof Error ? error.message : String(error)) + '\n');
  process.exit(1);
});
