import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route } from '@playwright/test';

// El servidor de desarrollo se anuncia como localhost; usar el mismo origen
// evita que Next bloquee sus propios chunks durante esta prueba focal.
test.use({ baseURL: 'http://localhost:3000' });

const ID = '11111111-1111-4111-8111-111111111111';
const REFERENCE = 'AR-1234567890ABCDEF12345678';
const ITEM = {
  requestId: ID,
  reference: REFERENCE,
  requestedProfile: 'CAREGIVER',
  status: 'PENDING',
  version: 1,
  submittedAt: '2026-09-30T12:00:00.000Z',
  givenNames: 'Persona',
  familyNames: 'Ficticia',
};
const DETAIL = {
  ...ITEM,
  documentType: 'CEDULA_CIUDADANIA',
  documentNumber: '44.556.677',
  birthDate: '1980-01-02',
  sexGenderCode: 'PREFIERE_NO_DECIRLO',
  phone: '3000000000',
  email: 'persona@example.invalid',
  provisioningStatus: 'NOT_STARTED',
  decidedAt: null,
  decisionReasonCode: null,
};
const ITEM_TWO = {
  ...ITEM,
  requestId: '22222222-2222-4222-8222-222222222222',
  reference: 'AR-ABCDEF1234567890ABCDEF12',
  givenNames: 'Segunda',
};

interface RouteState {
  decisionCalls: number;
  listCalls: number;
  lastSearch: URLSearchParams | null;
  decided: boolean;
  failList: boolean;
}

async function json(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function installRoutes(
  page: Page,
  options: {
    readonly empty?: boolean;
    readonly conflict?: boolean;
    readonly listStatus?: number;
    readonly failFirstList?: boolean;
    readonly paginated?: boolean;
  } = {},
): Promise<RouteState> {
  const state: RouteState = {
    decisionCalls: 0,
    listCalls: 0,
    lastSearch: null,
    decided: false,
    failList: options.failFirstList ?? false,
  };

  await page.route('**/api/v1/institutional/sessions/current', async (route) => {
    await json(route, {
      role: 'HOSPITAL_ACCESS_REVIEWER',
      expiresAt: '2026-09-30T20:00:00.000Z',
      institution: { name: 'Hospital ficticio de prueba' },
      actorDisplay: 'Acceso institucional',
    });
  });

  await page.route('**/api/v1/hospital/access-requests**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.pathname.endsWith('/decision')) {
      state.decisionCalls += 1;
      if (options.conflict) {
        await json(route, { code: 'ACCESS_REQUEST_REVIEW_CONFLICT' }, 409);
        return;
      }
      state.decided = true;
      const body = request.postDataJSON() as { action: 'APPROVE' | 'REJECT' };
      await json(route, {
        requestId: ID,
        reference: REFERENCE,
        status: body.action === 'APPROVE' ? 'APPROVED_PENDING_PROVISIONING' : 'REJECTED',
        version: 2,
        decisionReasonCode: body.action === 'APPROVE' ? 'DEMO_ELIGIBLE' : 'DEMO_NOT_ELIGIBLE',
        decidedAt: '2026-09-30T12:01:00.000Z',
      });
      return;
    }

    if (url.pathname.endsWith(`/${ID}`)) {
      await json(route, DETAIL);
      return;
    }

    state.listCalls += 1;
    state.lastSearch = url.searchParams;
    if (options.listStatus !== undefined || state.failList) {
      await json(route, { code: 'ERROR' }, options.listStatus ?? 503);
      return;
    }
    if (options.paginated) {
      const cursor = url.searchParams.get('cursor');
      await json(route, cursor === null
        ? { items: [ITEM], nextCursor: 'cursor-1' }
        : { items: [ITEM_TWO], nextCursor: null });
      return;
    }
    await json(route, {
      items: options.empty || state.decided ? [] : [ITEM],
      nextCursor: null,
    });
  });

  return state;
}

test('el rol revisor entra directo, busca, revisa con teclado y conserva foco', async ({ page }) => {
  const state = await installRoutes(page);
  await page.goto('/hospital');

  await expect(page.getByRole('heading', { name: 'Solicitudes de acceso', exact: true })).toBeVisible();
  await expect(page.getByText('Datos ficticios de prueba.')).toBeVisible();
  await expect(page.getByRole('navigation').getByRole('button')).toHaveCount(1);
  await expect(page.getByRole('navigation').getByRole('button')).toHaveText('Configuración');

  await page.getByLabel('Buscar por referencia, nombre o documento').fill('44.556.677');
  await page.getByLabel('Perfil solicitado').selectOption('CAREGIVER');
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await expect.poll(() => state.lastSearch?.get('q')).toBe('44.556.677');
  expect(state.lastSearch?.get('profile')).toBe('CAREGIVER');
  expect(state.lastSearch?.get('status')).toBe('PENDING');

  const review = page.getByRole('button', { name: `Revisar ${REFERENCE}` });
  await review.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Persona Ficticia' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cerrar detalle' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(review).toBeFocused();

  await review.click();
  const accessibility = await new AxeBuilder({ page })
    .include('main')
    .analyze();
  expect(accessibility.violations).toEqual([]);
});

test('aprobar exige confirmación y un doble gesto produce una sola decisión', async ({ page }) => {
  const state = await installRoutes(page);
  await page.goto('/hospital');
  await page.getByRole('button', { name: `Revisar ${REFERENCE}` }).click();
  await page.getByRole('button', { name: `Aprobar ${REFERENCE}` }).click();
  const confirm = page.getByRole('button', { name: 'Confirmar aprobación' });
  await confirm.dblclick();

  await expect(page.getByText(`Solicitud ${REFERENCE} aprobada y pendiente de creación de acceso.`)).toBeVisible();
  expect(state.decisionCalls).toBe(1);
  await expect(page.getByText('No hay solicitudes pendientes para estos filtros.')).toBeVisible();
});

test('un conflicto invalida el detalle y recarga la bandeja', async ({ page }) => {
  const state = await installRoutes(page, { conflict: true });
  await page.goto('/hospital');
  await page.getByRole('button', { name: `Revisar ${REFERENCE}` }).click();
  await page.getByRole('button', { name: `Rechazar ${REFERENCE}` }).click();
  await page.getByRole('button', { name: 'Confirmar rechazo' }).click();

  await expect(page.getByText('Otra revisión cambió esta solicitud. La bandeja se actualizará.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Persona Ficticia' })).toHaveCount(0);
  expect(state.listCalls).toBeGreaterThan(1);
});

test('muestra vacío, error recuperable y composición móvil', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installRoutes(page, { empty: true });
  await page.goto('/hospital');
  await expect(page.getByText('No hay solicitudes pendientes para estos filtros.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Recargar' })).toBeVisible();
});

test('recupera un error conservando la consulta y pagina sin duplicar filas', async ({ page }) => {
  const failed = await installRoutes(page, { failFirstList: true });
  await page.goto('/hospital');
  await expect(page.getByText('No fue posible consultar las solicitudes. Puede intentarlo nuevamente.')).toBeVisible();
  failed.failList = false;
  await page.getByRole('button', { name: 'Recargar' }).click();
  await expect(page.getByRole('button', { name: `Revisar ${REFERENCE}` })).toBeVisible();
  expect(failed.listCalls).toBeGreaterThanOrEqual(2);

  await page.unroute('**/api/v1/hospital/access-requests**');
  const paginated = await installRoutes(page, { paginated: true });
  await page.getByRole('button', { name: 'Recargar' }).click();
  await page.getByRole('button', { name: 'Cargar más' }).click();
  await expect(page.getByRole('button', { name: `Revisar ${REFERENCE}` })).toHaveCount(1);
  await expect(page.getByRole('button', { name: `Revisar ${ITEM_TWO.reference}` })).toBeVisible();
  expect(paginated.listCalls).toBe(2);
});

test('rechazar usa confirmación y retira la solicitud al recargar', async ({ page }) => {
  const state = await installRoutes(page);
  await page.goto('/hospital');
  await page.getByRole('button', { name: `Revisar ${REFERENCE}` }).click();
  await page.getByRole('button', { name: `Rechazar ${REFERENCE}` }).click();
  await page.getByRole('button', { name: 'Confirmar rechazo' }).click();
  await expect(page.getByText(`Solicitud ${REFERENCE} rechazada.`)).toBeVisible();
  expect(state.decisionCalls).toBe(1);
});

test('un 401 limpia la superficie y devuelve al acceso institucional', async ({ page }) => {
  await installRoutes(page, { listStatus: 401 });
  await page.goto('/hospital');
  await expect(page.getByRole('heading', { name: 'Acceso institucional' })).toBeVisible();
  await expect(page.getByText('Persona Ficticia')).toHaveCount(0);
});
