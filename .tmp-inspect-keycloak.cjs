const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:3000/');
  await page.getByRole('link', { name: 'Iniciar sesión' }).click();
  await page.waitForLoadState('domcontentloaded');
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({ path: '.tmp-eloisa-keycloak.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: '.tmp-eloisa-keycloak-mobile.png', fullPage: true });

  const structure = await page.evaluate(() => {
    const selectors = [
      'body', '#kc-header', '#kc-header-wrapper', '#kc-content', '#kc-content-wrapper',
      '#kc-form', '#kc-form-wrapper', '#kc-login', '.card-pf', '[class*="login__main"]',
    ];

    const selected = selectors.map((selector) => {
      const element = document.querySelector(selector);
      return element === null
        ? { selector, missing: true }
        : { selector, tag: element.tagName, id: element.id, className: element.className };
    });
    const main = document.querySelector('main');
    const tree = main === null
      ? []
      : [...main.querySelectorAll('*')].slice(0, 45).map((element) => ({
          tag: element.tagName,
          id: element.id,
          className: element.className,
        }));
    return { selected, tree };
  });

  console.log(JSON.stringify({
    title: await page.title(),
    usernameLabel: await page.locator('label[for="username"]').textContent(),
    passwordLabel: await page.locator('label[for="password"]').textContent(),
    submitText: await page.locator('#kc-login').textContent(),
    structure,
  }));
  await browser.close();
})().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
