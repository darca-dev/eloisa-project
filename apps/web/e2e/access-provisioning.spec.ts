import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route } from '@playwright/test';

/**
 * E2E focal de SPEC 038 / MP04.
 *
 * Toda identidad, sesión y respuesta institucional se intercepta. Cada prueba
 * crea su propio estado y no requiere Keycloak, PostgreSQL ni migraciones.
 */
const BASE = (process.env['MERDN_E2E_BASE_URL'] ?? 'http://localhost:3000').replace(/\/$/u, '');
const REFERENCE = 'AR-1234567890ABCDEF12345678';
const REQUEST_ID = '11111111-1111-4111-8111-111111111111';

async function json(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function experiences(page: Page, values: readonly string[], status = 200): Promise<void> {
  await page.route('**/api/v1/me/experiences', async (route) => {
    await json(route, status === 200 ? { experiences: values } : { code: 'NO_SESSION' }, status);
  });
}

async function humanSession(page: Page, contexts: readonly string[], status = 200): Promise<void> {
  await page.route('**/api/v1/human-auth/session', async (route) => {
    await json(route, status === 200
      ? { expiresAt: '2026-10-01T00:00:00.000Z', idleExpiresInSeconds: 900, contexts }
      : { code: 'NO_SESSION' }, status);
  });
}

test('registra con credencial efímera, bloquea el doble envío y limpia la contraseña', async ({ page }) => {
  let calls = 0;
  let body: Record<string, unknown> = {};
  await page.route('**/api/v1/access-requests', async (route) => {
    calls += 1;
    body = route.request().postDataJSON() as Record<string, unknown>;
    await json(route, { reference: REFERENCE, status: 'PENDING', source: 'TEST_DATA' }, 202);
  });

  await page.goto(`${BASE}/acceso?accion=registro`);
  await page.getByRole('button', { name: 'Paciente demo 1' }).click();
  const password = page.getByLabel('Contraseña de prueba');
  await password.fill('ClaveDemo123');
  await page.getByRole('button', { name: 'Mostrar contraseña' }).focus();
  await page.keyboard.press('Enter');
  await expect(password).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'Ocultar contraseña' }).click();

  await page.evaluate(() => {
    const form = document.querySelector('form');
    if (!(form instanceof HTMLFormElement)) throw new Error('Formulario ausente');
    form.requestSubmit();
    form.requestSubmit();
  });

  await expect(page.getByText(REFERENCE)).toBeVisible();
  expect(calls).toBe(1);
  expect(body['password']).toBe('ClaveDemo123');
  expect(body['requestedProfile']).toBe('PATIENT');
  await expect(password).toHaveValue('');
  await expect(page.getByText(/Todavía NO puede iniciar sesión/u)).toBeVisible();
});

test('antes de la aprobación muestra el login OIDC con retorno cerrado a /acceso', async ({ page }) => {
  await experiences(page, [], 401);
  await page.goto(`${BASE}/acceso`);
  const login = page.getByRole('link', { name: 'Iniciar sesión' });
  await expect(login).toBeVisible();
  await expect(login).toHaveAttribute('href', /\/api\/v1\/human-auth\/login\?returnTo=\/acceso$/u);
});

test('una experiencia aprobada abre la portada del paciente', async ({ page }) => {
  await experiences(page, ['PATIENT']);
  await page.route('**/api/v1/me/contexts', async (route) => json(route, { code: 'NO_SESSION' }, 401));
  await page.goto(`${BASE}/acceso`);
  await expect(page).toHaveURL(/\/paciente$/u);
});

test('cuidador aprobado sin relación ve una portada neutra y sin datos nominales', async ({ page }) => {
  await experiences(page, ['CAREGIVER']);
  await humanSession(page, []);
  await page.goto(`${BASE}/acceso`);
  await expect(page).toHaveURL(/\/cuidador$/u);
  await expect(page.getByText(/Todavía no hay ninguna persona a su cargo/u)).toBeVisible();
  await expect(page.getByText('Aurora Demo Salcedo')).toHaveCount(0);
});

test('visitador aprobado sin asignaciones entra con una worklist vacía', async ({ page }) => {
  await experiences(page, ['FIELD_PROFESSIONAL']);
  await humanSession(page, ['PROFESSIONAL']);
  await page.route('**/api/v1/professional/visits?**', async (route) => {
    const url = new URL(route.request().url());
    await json(route, {
      window: { from: url.searchParams.get('from'), to: url.searchParams.get('to') },
      items: [],
    });
  });
  await page.goto(`${BASE}/acceso`);
  await expect(page).toHaveURL(/\/profesional$/u);
  await expect(page.getByText('No tiene visitas asignadas en esta ventana.')).toBeVisible();
});

test('varias experiencias muestran selector enfocado, usable a 320 px y sin violaciones axe', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await experiences(page, ['PATIENT', 'CAREGIVER', 'FIELD_PROFESSIONAL']);
  await page.goto(`${BASE}/acceso`);
  await expect(page.getByText('Varias experiencias están aprobadas. Elija cuál desea abrir.')).toBeVisible();
  await expect(page.getByRole('link', { name: /Paciente/u })).toBeVisible();
  await expect(page.getByRole('link', { name: /Cuidador/u })).toBeVisible();
  await expect(page.getByRole('link', { name: /Visitador médico/u })).toBeVisible();
  await expect(page.locator('[tabindex="-1"]')).toBeFocused();
  const accessibility = await new AxeBuilder({ page }).include('main').analyze();
  expect(accessibility.violations).toEqual([]);
});

test('un fallo de experiencias conserva cierre seguro y permite reintentar', async ({ page }) => {
  let calls = 0;
  let unavailable = true;
  await page.route('**/api/v1/me/experiences', async (route) => {
    calls += 1;
    if (unavailable) await json(route, { code: 'UNAVAILABLE' }, 503);
    else await json(route, { experiences: ['PATIENT', 'CAREGIVER'] });
  });
  await page.goto(`${BASE}/acceso`);
  await expect(page.getByText(/No fue posible comprobar sus experiencias aprobadas/u)).toBeVisible();
  unavailable = false;
  await page.getByRole('button', { name: 'Volver a intentar' }).click();
  await expect(page.getByText('Varias experiencias están aprobadas. Elija cuál desea abrir.')).toBeVisible();
  expect(calls).toBeGreaterThanOrEqual(2);
});

test('suspensión y revocación retiran de inmediato las portadas protegidas', async ({ page }) => {
  await experiences(page, []);
  await page.goto(`${BASE}/cuidador`);
  await expect(page.getByText('Su cuenta no tiene acceso a esta experiencia.')).toBeVisible();
  await expect(page.getByText(/Mis pagos y liquidaciones/u)).toHaveCount(0);

  await page.goto(`${BASE}/profesional`);
  await expect(page.getByText('Su cuenta no tiene acceso a esta experiencia.')).toBeVisible();
  await expect(page.getByText('No tiene visitas asignadas en esta ventana.')).toHaveCount(0);
});

type ReviewStatus = 'PROVISIONING_FAILED' | 'APPROVED' | 'SUSPENDED' | 'REVOKED';

async function hospitalState(page: Page, initial: ReviewStatus): Promise<{
  readonly actions: string[];
}> {
  const state = { status: initial, version: 3, actions: [] as string[] };
  await page.route('**/api/v1/institutional/sessions/current', async (route) => {
    await json(route, {
      role: 'HOSPITAL_ACCESS_REVIEWER', expiresAt: '2026-10-01T00:00:00.000Z',
      institution: { name: 'Hospital ficticio' }, actorDisplay: 'Acceso institucional',
    });
  });
  await page.route('**/api/v1/hospital/access-requests**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/decision')) {
      const request = route.request().postDataJSON() as { action: string; reasonCode: string };
      state.actions.push(request.action);
      if (request.action === 'RETRY_PROVISIONING') state.status = 'APPROVED';
      if (request.action === 'SUSPEND') state.status = 'SUSPENDED';
      if (request.action === 'REVOKE') state.status = 'REVOKED';
      state.version += 1;
      await json(route, {
        requestId: REQUEST_ID, reference: REFERENCE, status: state.status,
        version: state.version, decisionReasonCode: request.reasonCode,
        decidedAt: '2026-09-30T18:00:00.000Z',
      });
      return;
    }
    const item = {
      requestId: REQUEST_ID, reference: REFERENCE, requestedProfile: 'CAREGIVER',
      status: state.status, version: state.version, submittedAt: '2026-09-30T12:00:00.000Z',
      givenNames: 'Persona', familyNames: 'Ficticia',
    };
    if (url.pathname.endsWith(`/${REQUEST_ID}`)) {
      await json(route, {
        ...item, documentType: 'CEDULA_CIUDADANIA', documentNumber: '900200001',
        birthDate: '1980-01-02', sexGenderCode: 'PREFIERE_NO_DECIRLO',
        phone: '3000000000', email: 'persona@example.invalid',
        provisioningStatus: state.status === 'PROVISIONING_FAILED' ? 'FAILED' : 'SUCCEEDED',
        provisioningAttempts: state.status === 'PROVISIONING_FAILED' ? 1 : 2,
        provisioningErrorCode: state.status === 'PROVISIONING_FAILED' ? 'OIDC_UNAVAILABLE' : null,
        decidedAt: '2026-09-30T17:00:00.000Z', decisionReasonCode: 'DEMO_ELIGIBLE',
      });
      return;
    }
    await json(route, { items: state.status === 'REVOKED' ? [] : [item], nextCursor: null });
  });
  return state;
}

test('Hospital reintenta una provisión fallida una sola vez ante doble gesto', async ({ page }) => {
  const state = await hospitalState(page, 'PROVISIONING_FAILED');
  await page.goto(`${BASE}/hospital`);
  await page.getByRole('button', { name: `Revisar ${REFERENCE}` }).click();
  await page.getByRole('button', { name: `Reintentar provisión ${REFERENCE}` }).click();
  await page.getByRole('button', { name: 'Confirmar reintento de provisión' }).dblclick();
  await expect(page.getByText(`Reintento de provisión lanzado para la solicitud ${REFERENCE}.`)).toBeVisible();
  expect(state.actions).toEqual(['RETRY_PROVISIONING']);
});

test('Hospital confirma suspensión y luego revocación con acciones versionadas', async ({ page }) => {
  const state = await hospitalState(page, 'APPROVED');
  await page.goto(`${BASE}/hospital`);
  await page.getByRole('button', { name: `Revisar ${REFERENCE}` }).click();
  await page.getByRole('button', { name: `Suspender ${REFERENCE}` }).click();
  await page.getByRole('button', { name: 'Confirmar suspensión' }).click();
  await expect(page.getByText(`Solicitud ${REFERENCE} suspendida; la cuenta quedó deshabilitada.`)).toBeVisible();

  await page.getByRole('button', { name: `Revisar ${REFERENCE}` }).click();
  await page.getByRole('button', { name: `Revocar ${REFERENCE}` }).click();
  await page.getByRole('button', { name: 'Confirmar revocación' }).click();
  await expect(page.getByText(`Solicitud ${REFERENCE} revocada; la cuenta quedó deshabilitada.`)).toBeVisible();
  expect(state.actions).toEqual(['SUSPEND', 'REVOKE']);
});
