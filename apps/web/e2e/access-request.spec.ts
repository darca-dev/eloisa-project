import AxeBuilder from '@axe-core/playwright';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { unlink } from 'node:fs/promises';
import { expect, test, type Page, type Route } from '@playwright/test';

/**
 * E2E focal de la inscripción guiada de cinco pasos (SPEC 038, MP04-C3).
 *
 * Tres ramas independientes —Paciente, Cuidador y Visitador médico— con su
 * fixture, sus cinco pasos, sus iconos exactos de Elí, la contraseña solo al
 * final, un único POST interceptado, 202/PENDING y reintento C2-C1.
 *
 * Sin API, PostgreSQL, Keycloak ni sesiones: `POST /api/v1/access-requests` se
 * intercepta y se responde desde este archivo.
 */

const RUTA_API = '**/api/v1/access-requests';
const REGISTRO = '/acceso?accion=registro';
const BASE = (process.env['MERDN_E2E_BASE_URL'] ?? 'http://127.0.0.1:3000').replace(/\/$/u, '');

const REFERENCIA = 'AR-3F9C1D0B7A6E5248C1B0D2E9';

type Tarjeta = 'Paciente' | 'Cuidador' | 'Visitador médico';

const TITULOS: Record<Tarjeta, readonly string[]> = {
  Paciente: ['Datos personales', 'Condición y necesidades', 'Ubicación y EPS', 'Contactos', 'Confirmación'],
  Cuidador: ['Datos personales', 'Perfil del cuidador', 'Vincular paciente', 'Contacto cercano', 'Confirmación'],
  'Visitador médico': ['Datos personales', 'Información profesional', 'EPS e institución', 'Zona de atención', 'Verificación'],
};

const FICHA: Record<Tarjeta, { fixture: string; perfil: string; documento: string }> = {
  Paciente: { fixture: 'Paciente demo 1', perfil: 'PATIENT', documento: '900100001' },
  Cuidador: { fixture: 'Cuidador demo 1', perfil: 'CAREGIVER', documento: '900200001' },
  'Visitador médico': { fixture: 'Visitador demo 1', perfil: 'FIELD_PROFESSIONAL', documento: '900300001' },
};

async function abrirRegistro(page: Page): Promise<void> {
  await page.goto(`${BASE}${REGISTRO}`);
  await expect(page.getByRole('heading', { name: '¿Cómo se va a registrar?' })).toBeVisible();
}

async function elegirTarjeta(page: Page, tarjeta: Tarjeta): Promise<void> {
  await page.getByRole('button', { name: new RegExp(`^${tarjeta} `, 'u') }).click();
  await expect(page.getByRole('heading', { name: TITULOS[tarjeta][0] })).toBeVisible();
}

interface RespuestaControlada {
  readonly status: number;
  readonly cuerpo: unknown;
}

function diferida<T>(): {
  readonly promesa: Promise<T>;
  resolver: (valor: T) => void;
} {
  let resolver!: (valor: T) => void;
  const promesa = new Promise<T>((cumplir) => {
    resolver = cumplir;
  });

  return { promesa, resolver };
}

function capturarRuta(
  page: Page,
  respuesta: RespuestaControlada | { readonly esperar: Promise<unknown> },
): { readonly llamadas: number; readonly cuerpos: string[] } {
  const registro = { llamadas: 0, cuerpos: [] as string[] };

  void page.route(RUTA_API, async (route: Route) => {
    registro.llamadas += 1;
    registro.cuerpos.push(String(route.request().postData() ?? ''));

    if ('esperar' in respuesta) {
      await respuesta.esperar;
    }

    await route.fulfill({
      status: respuesta.status,
      contentType: 'application/json',
      body: JSON.stringify(respuesta.cuerpo),
    });
  });

  return registro;
}

const ACEPTADA: RespuestaControlada = {
  status: 202,
  cuerpo: { reference: REFERENCIA, status: 'PENDING', source: 'TEST_DATA' },
};

const FALLO_TEMPORAL: RespuestaControlada = {
  status: 503,
  cuerpo: {
    code: 'ACCESS_REQUEST_RUNTIME_UNAVAILABLE',
    message: 'El servicio no está disponible en este momento.',
  },
};

/** Avanza del paso 1 al 5 con el fixture de la rama y deja la clave escrita. */
async function completarHastaConfirmacion(page: Page, tarjeta: Tarjeta): Promise<void> {
  const { fixture } = FICHA[tarjeta];

  await page.getByRole('button', { name: fixture }).click();

  for (let paso = 1; paso <= 4; paso += 1) {
    // La contraseña solo existe en el paso 5.
    await expect(page.locator('#registro-password')).toHaveCount(0);
    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(page.getByRole('heading', { name: TITULOS[tarjeta][paso] })).toBeVisible();
  }

  await page.getByLabel('Contraseña de prueba').fill('ClaveDemo123');
}

function avisos(page: Page) {
  return page.locator('[aria-live="polite"] [role="alert"]');
}

function sinViolacionesGraves(violations: Array<{ impact?: string }>): void {
  expect(violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);
}

test.describe.configure({ retries: 0 });

test.describe('Inscripción guiada de cinco pasos (SPEC 038, MP04-C3)', () => {
  for (const tarjeta of ['Paciente', 'Cuidador', 'Visitador médico'] as const) {
    test(`rama ${tarjeta}: cinco pasos, fixture, iconos, un POST y 202/PENDING`, async ({
      page,
    }) => {
      const registro = capturarRuta(page, ACEPTADA);
      await abrirRegistro(page);

      // Iconos exactos: guía en cabecera y saludo en el activador flotante.
      await expect(page.locator('img[src="/eli/guia.png"]').first()).toBeVisible();
      await expect(page.locator('img[src="/eli/saluda2.png"]')).toBeVisible();
      await expect(page.getByText('Panel de inscripción · Atención domiciliaria')).toBeVisible();

      await elegirTarjeta(page, tarjeta);

      // Solo los tres fixtures de la rama.
      await expect(page.getByRole('button', { name: FICHA[tarjeta].fixture })).toBeVisible();
      const otra = tarjeta === 'Paciente' ? 'Cuidador demo 1' : 'Paciente demo 1';
      await expect(page.getByRole('button', { name: otra })).toHaveCount(0);

      // Orientación de Elí al inicio de cada paso.
      await expect(page.locator('img[src="/eli/escucha.png"]')).toBeVisible();

      await completarHastaConfirmacion(page, tarjeta);

      // Resumen sin credencial y con autorización de datos.
      await expect(page.locator('#registro-password')).toBeVisible();
      await expect(page.getByText('Autorizo el tratamiento', { exact: false })).toBeVisible();
      await page.getByRole('checkbox', { name: /Autorizo el tratamiento/u }).check();

      await page.getByRole('button', { name: 'Registrarme' }).click();
      await expect(page.getByText(REFERENCIA)).toBeVisible();

      expect(registro.llamadas).toBe(1);

      const cuerpo = JSON.parse(registro.cuerpos[0] ?? '{}') as Record<string, unknown>;
      expect(cuerpo['requestedProfile']).toBe(FICHA[tarjeta].perfil);
      expect(cuerpo['documentNumber']).toBe(FICHA[tarjeta].documento);
      expect(typeof cuerpo['password']).toBe('string');
      expect((cuerpo['password'] as string).length).toBeGreaterThan(0);

      const expediente = cuerpo['registration'] as Record<string, unknown>;
      expect(expediente['autorizaDatos']).toBe(true);
      expect('password' in expediente).toBe(false);

      // Cierre con Elí agradeciendo, referencia, PENDING y espera del Hospital.
      await expect(page.locator('img[src="/eli/agradece.png"]')).toBeVisible();
      const confirmacion = page.getByRole('status');
      await expect(confirmacion).toContainText('Solicitud registrada');
      await expect(confirmacion).toContainText('PENDING');
      await expect(confirmacion).toContainText('Hospital debe aprobar');
      await expect(confirmacion).toContainText('no crea sesión ni cuenta');

      // La credencial no queda en el DOM y no hay entradas a portales.
      await expect(page.locator('#registro-password')).toHaveCount(0);
      await expect(page.getByRole('link', { name: /\/paciente|\/cuidador|\/profesional/u })).toHaveCount(0);
    });
  }

  test('el paso 1 no avanza vacío, exige contacto y enfoca el primer campo', async ({
    page,
  }) => {
    await abrirRegistro(page);
    await elegirTarjeta(page, 'Paciente');

    const registro = capturarRuta(page, ACEPTADA);
    await page.getByRole('button', { name: 'Continuar' }).click();

    await expect(page.locator('#registro-documentNumber')).toBeFocused();
    expect(registro.llamadas).toBe(0);
  });

  test('los condicionales ocultan y eliminan: apoyos solo con necesidad', async ({ page }) => {
    await abrirRegistro(page);
    await elegirTarjeta(page, 'Paciente');
    await page.getByRole('button', { name: 'Paciente demo 1' }).click();
    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(page.getByRole('heading', { name: 'Condición y necesidades' })).toBeVisible();

    // Sin necesidad, los apoyos no están a la vista.
    await page.getByRole('radio', { name: 'No' }).first().click();
    await expect(page.getByText('Tipo de apoyo que necesita')).toHaveCount(0);

    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(page.getByRole('heading', { name: 'Ubicación y EPS' })).toBeVisible();
  });

  test('dos gestos en el mismo tick producen una sola petición', async ({ page }) => {
    await abrirRegistro(page);
    await elegirTarjeta(page, 'Cuidador');

    const registro = capturarRuta(page, ACEPTADA);
    await completarHastaConfirmacion(page, 'Cuidador');
    await page.getByRole('checkbox', { name: /Autorizo el tratamiento/u }).check();

    await page.evaluate(() => {
      const boton = [...document.querySelectorAll('button')].find(
        (nodo) => nodo.textContent === 'Registrarme',
      );
      if (!(boton instanceof HTMLButtonElement)) {
        throw new Error('el botón Registrarme no está montado');
      }

      boton.click();
      boton.click();
    });

    await expect(page.getByText(REFERENCIA)).toBeVisible();
    expect(registro.llamadas).toBe(1);
  });

  test('mantiene el envío bloqueado mientras la respuesta está pendiente', async ({
    page,
  }) => {
    await abrirRegistro(page);
    await elegirTarjeta(page, 'Paciente');

    const pendiente = diferida<unknown>();
    const registro = capturarRuta(page, {
      status: ACEPTADA.status,
      cuerpo: ACEPTADA.cuerpo,
      esperar: pendiente.promesa,
    });
    await completarHastaConfirmacion(page, 'Paciente');
    await page.getByRole('checkbox', { name: /Autorizo el tratamiento/u }).check();

    await page.getByRole('button', { name: 'Registrarme' }).click();

    const boton = page.getByRole('button', { name: 'Enviando solicitud…' });
    await expect(boton).toBeDisabled();
    await expect(page.getByText(REFERENCIA)).toBeHidden();
    expect(registro.llamadas).toBe(1);

    pendiente.resolver(undefined);
    await expect(page.getByText(REFERENCIA)).toBeVisible();
    expect(registro.llamadas).toBe(1);
  });

  test('tras un error vuelve al paso 5, exige clave nueva y el segundo POST la lleva', async ({
    page,
  }) => {
    await abrirRegistro(page);
    await elegirTarjeta(page, 'Visitador médico');

    const cuerpos: string[] = [];
    let intentos = 0;
    void page.route(RUTA_API, async (route: Route) => {
      intentos += 1;
      cuerpos.push(String(route.request().postData() ?? ''));
      const primero = intentos === 1;

      await route.fulfill({
        status: primero ? FALLO_TEMPORAL.status : ACEPTADA.status,
        contentType: 'application/json',
        body: JSON.stringify(primero ? FALLO_TEMPORAL.cuerpo : ACEPTADA.cuerpo),
      });
    });

    await completarHastaConfirmacion(page, 'Visitador médico');
    await page.getByRole('checkbox', { name: /Autorizo el tratamiento/u }).check();
    await page.getByRole('button', { name: 'Registrarme' }).click();

    // Primer POST fallido: paso 5, clave vaciada y enfocada, mensaje opaco.
    await expect(page.getByRole('heading', { name: 'Verificación' })).toBeVisible();
    await expect(page.getByLabel('Contraseña de prueba')).toHaveValue('');
    await expect(page.locator('#registro-password')).toBeFocused();
    await expect(
      avisos(page).filter({ hasText: 'No fue posible registrar la solicitud' }),
    ).toBeVisible();

    // Registrarme sin clave NO crea otro POST: la defensa lo impide antes de la red.
    await page.getByRole('button', { name: 'Registrarme' }).click();
    expect(intentos).toBe(1);

    // Clave nueva y reintento: segundo POST aceptado con la clave nueva.
    await page.getByLabel('Contraseña de prueba').fill('OtraClave456');
    await page.getByRole('button', { name: 'Registrarme' }).click();

    await expect(page.getByText(REFERENCIA)).toBeVisible();
    expect(intentos).toBe(2);

    const primero = JSON.parse(cuerpos[0] ?? '{}') as Record<string, unknown>;
    const segundo = JSON.parse(cuerpos[1] ?? '{}') as Record<string, unknown>;
    expect(primero['password']).toBe('ClaveDemo123');
    expect(segundo['password']).toBe('OtraClave456');
  });

  test('un invalid con campo desconocido regresa a la clave sin POST vacío', async ({
    page,
  }) => {
    await abrirRegistro(page);
    await elegirTarjeta(page, 'Paciente');

    let intentos = 0;
    void page.route(RUTA_API, async (route: Route) => {
      intentos += 1;

      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ fields: ['campoQueNoExiste'] }),
      });
    });

    await completarHastaConfirmacion(page, 'Paciente');
    await page.getByRole('checkbox', { name: /Autorizo el tratamiento/u }).check();
    await page.getByRole('button', { name: 'Registrarme' }).click();

    await expect(page.getByRole('heading', { name: 'Confirmación' })).toBeVisible();
    await expect(page.getByLabel('Contraseña de prueba')).toHaveValue('');
    await expect(page.locator('#registro-password')).toBeFocused();

    await page.getByRole('button', { name: 'Registrarme' }).click();
    expect(intentos).toBe(1);
  });

  test('cambiar de perfil borra todo y no transfiere datos', async ({ page }) => {
    await abrirRegistro(page);
    await elegirTarjeta(page, 'Paciente');
    await page.getByRole('button', { name: 'Paciente demo 1' }).click();
    await page.getByRole('button', { name: 'Continuar' }).click();

    await page.getByRole('button', { name: 'Cambiar perfil' }).click();
    await expect(page.getByRole('heading', { name: '¿Cómo se va a registrar?' })).toBeVisible();

    await elegirTarjeta(page, 'Cuidador');
    await expect(page.getByLabel('Número de documento', { exact: true })).toHaveValue('');
  });

  test('selector y cinco pasos: progreso, foco, 320 px, teclado y axe', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await abrirRegistro(page);

    const sinDesborde = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    );
    expect(sinDesborde).toBe(true);

    let analisis = await new AxeBuilder({ page }).include('main').analyze();
    sinViolacionesGraves(analisis.violations);

    void capturarRuta(page, ACEPTADA);
    await elegirTarjeta(page, 'Paciente');

    const barra = page.getByRole('progressbar', { name: 'Progreso de la inscripción' });
    await expect(barra).toHaveAttribute('aria-valuenow', '1');
    await expect(page.getByRole('button', { name: '1. Datos personales' })).toHaveAttribute(
      'aria-current',
      'step',
    );
    await expect(page.getByRole('heading', { name: 'Datos personales' })).toBeFocused();

    // Teclado: tabular desde el primer campo recorre los controles en orden.
    await page.locator('#registro-documentType').focus();
    await page.keyboard.press('Tab');
    await expect(page.locator('#registro-documentNumber')).toBeFocused();

    for (const titulo of TITULOS['Paciente'].slice(1)) {
      await page.getByRole('button', { name: 'Paciente demo 1' }).click();
      await page.getByRole('button', { name: 'Continuar' }).click();
      await expect(page.getByRole('heading', { name: titulo })).toBeFocused();

      const desborda = await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      );
      expect(desborda).toBe(true);

      analisis = await new AxeBuilder({ page }).include('main').analyze();
      sinViolacionesGraves(analisis.violations);
    }

    await expect(barra).toHaveAttribute('aria-valuenow', '5');
  });

  test('la edad derivada se muestra sin viajar en el cuerpo', async ({ page }) => {
    const registro = capturarRuta(page, ACEPTADA);
    await abrirRegistro(page);
    await elegirTarjeta(page, 'Paciente');
    await page.getByRole('button', { name: 'Paciente demo 1' }).click();

    await expect(page.getByText(/Edad \d+ años/u)).toBeVisible();

    await completarHastaConfirmacion(page, 'Paciente');
    await page.getByRole('checkbox', { name: /Autorizo el tratamiento/u }).check();
    await page.getByRole('button', { name: 'Registrarme' }).click();
    await expect(page.getByText(REFERENCIA)).toBeVisible();

    const cuerpo = JSON.parse(registro.cuerpos[0] ?? '{}') as Record<string, unknown>;
    expect('edad' in cuerpo).toBe(false);
    expect(JSON.stringify(cuerpo['registration'])).not.toContain('Edad');
  });

  test('composición a 600 px: tarjetas separadas y paso activo azul', async ({ page }) => {
    await page.setViewportSize({ width: 600, height: 900 });
    await abrirRegistro(page);
    await page.screenshot({ path: join(tmpdir(), 'mp04-c4-selector-600.png') });

    await elegirTarjeta(page, 'Cuidador');
    await page.getByRole('button', { name: 'Cuidador demo 1' }).click();
    await page.screenshot({ path: join(tmpdir(), 'mp04-c4-paso1-600.png') });

    // Encabezado azul de la referencia.
    const fondoEncabezado = await page
      .getByTestId('encabezado-registro')
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(fondoEncabezado).toBe('rgb(30, 90, 167)');

    // Progreso y contenido son tarjetas blancas separadas.
    const progreso = page.getByTestId('tarjeta-progreso');
    const contenido = page.getByTestId('tarjeta-contenido');
    await expect(progreso).toBeVisible();
    await expect(contenido).toBeVisible();
    expect(await progreso.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(
      'rgb(255, 255, 255)',
    );
    expect(await contenido.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(
      'rgb(255, 255, 255)',
    );

    // El paso activo es azul con texto blanco; el futuro conserva aspecto claro.
    const activo = page.getByRole('button', { name: '1. Datos personales' });
    expect(await activo.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(
      'rgb(30, 90, 167)',
    );
    expect(await activo.evaluate((el) => getComputedStyle(el).color)).toBe('rgb(255, 255, 255)');

    // Cinco botones en una fila a 600 px.
    const tops = await page
      .getByRole('button', { name: /^\d\. /u })
      .evaluateAll((nodos) => nodos.map((nodo) => nodo.getBoundingClientRect().top));
    expect(new Set(tops).size).toBe(1);

    const desborda = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    );
    expect(desborda).toBe(true);

    const analisis = await new AxeBuilder({ page }).include('main').analyze();
    sinViolacionesGraves(analisis.violations);
  });

  test('composición a 320 px: sin desborde ni texto ilegible', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await abrirRegistro(page);
    await page.screenshot({ path: join(tmpdir(), 'mp04-c4-selector-320.png') });

    await elegirTarjeta(page, 'Visitador médico');
    await page.getByRole('button', { name: 'Visitador demo 1' }).click();
    await page.screenshot({ path: join(tmpdir(), 'mp04-c4-paso1-320.png') });

    const desborda = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    );
    expect(desborda).toBe(true);

    // Los cinco botones siguen siendo alcanzables y legibles.
    for (const nombre of [
      '1. Datos personales',
      '2. Información profesional',
      '3. EPS e institución',
      '4. Zona de atención',
      '5. Verificación',
    ]) {
      await expect(page.getByRole('button', { name: nombre })).toBeVisible();
    }

    const analisis = await new AxeBuilder({ page }).include('main').analyze();
    sinViolacionesGraves(analisis.violations);

    // Limpieza: las capturas son temporales de inspección, no artefactos.
    await unlink(join(tmpdir(), 'mp04-c4-selector-600.png')).catch(() => undefined);
    await unlink(join(tmpdir(), 'mp04-c4-paso1-600.png')).catch(() => undefined);
    await unlink(join(tmpdir(), 'mp04-c4-selector-320.png')).catch(() => undefined);
    await unlink(join(tmpdir(), 'mp04-c4-paso1-320.png')).catch(() => undefined);
  });
});
