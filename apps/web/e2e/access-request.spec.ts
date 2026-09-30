import { expect, test, type Page, type Route } from '@playwright/test';

/**
 * E2E focal del formulario de solicitud de acceso (SPEC 038, MP02-C2-C1).
 *
 * QUÉ PRUEBA: la interacción REAL en navegador. Las pruebas unitarias anteriores
 * comprueban la frontera con `fetch` inyectado y la forma del componente sobre el
 * código fuente; ninguna de las dos puede demostrar que el formulario funciona con
 * teclado, que el botón se bloquea durante la respuesta ni que un doble envío en el
 * mismo tick produce una sola llamada. Eso solo se ve en un navegador.
 *
 * QUÉ NO NECESITA: no hay API, ni PostgreSQL, ni Keycloak, ni sesiones. La única
 * petición de esta prueba —`POST /api/v1/access-requests`— se INTERCEPTA y se
 * responde desde el propio archivo. Ninguna otra ruta se intercepta, de modo que si
 * el formulario empezara a llamar a otra cosa, la prueba fallaría por requests no
 * previstos en lugar de fingir que todo sigue bien.
 *
 * DATOS: todos ficticios y declarados como tales, en línea con la decisión de
 * entorno del 2026-09-28.
 *
 * BASE: `MERDN_E2E_BASE_URL` permite apuntar a un servidor de desarrollo recién
 * levantado. La razón es concreta: el puerto por defecto puede estar ocupado por
 * un contenedor con una imagen anterior, y contra esa imagen la prueba mediría un
 * build viejo en lugar del código que se está revisando. La intersección de la
 * ruta NO depende del origen, así que interceptar sigue siendo equivalente.
 */

const RUTA_API = '**/api/v1/access-requests';
const REGISTRO = '/acceso?accion=registro';
const BASE = (process.env['MERDN_E2E_BASE_URL'] ?? 'http://127.0.0.1:3000').replace(/\/$/u, '');

async function abrirFormulario(page: Page): Promise<void> {
  await page.goto(`${BASE}${REGISTRO}`);
  await expect(page.getByRole('heading', { name: 'Registre su solicitud, no una sesión' })).toBeVisible();
}

const REFERENCIA = 'AR-3F9C1D0B7A6E5248C1B0D2E9';

/** Datos FICTICIOS. El documento se deriva del reloj para no ser una persona real. */
function datosFicticios(): {
  readonly documento: string;
  readonly nombres: string;
  readonly apellidos: string;
  readonly nacimiento: string;
  readonly telefono: string;
} {
  const marca = Date.now().toString().slice(-7);

  return {
    documento: `900${marca}`,
    nombres: 'Ana María',
    apellidos: 'Ejemplo Ficticio',
    nacimiento: '1958-04-12',
    telefono: '311 220 3355',
  };
}

interface RespuestaControlada {
  readonly status: number;
  readonly cuerpo: unknown;
}

/** Respuesta diferida: permite observar el estado del botón mientras llega. */
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

/**
 * Intercepta la ruta de solicitudes y devuelve un contador de llamadas, los cuerpos
 * enviados y una vía para fijar la próxima respuesta. No se usa
 * `page.route(...).fulfill()` de forma directa porque el caso interesante es
 * justamente esperar SIN responder.
 *
 * El manejador solo usa sus PROPIOS parámetros y variables locales: referenciar
 * constantes de módulo desde dentro de un callback de `page.route` falla con
 * `ReferenceError` bajo la transformación de Playwright, mientras que pasarlas
 * como argumento se comporta correctamente.
 */
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

/** Rellena los campos obligatorios y deja UN medio de contacto. */
async function completar(page: Page, conContacto = true): Promise<void> {
  const datos = datosFicticios();

  await page.getByLabel('Número de documento', { exact: true }).fill(datos.documento);
  await page.getByLabel('Nombres', { exact: true }).fill(datos.nombres);
  await page.getByLabel('Apellidos', { exact: true }).fill(datos.apellidos);
  await page.getByLabel('Fecha de nacimiento', { exact: true }).fill(datos.nacimiento);

  if (conContacto) {
    await page.getByLabel('Teléfono (opcional, al menos uno)').fill(datos.telefono);
  }
}

/**
 * Avisos del FORMULARIO, no de la página.
 *
 * Next.js monta un `role="alert"` vacío para anunciar cambios de ruta, de modo
 * que un `getByRole('alert')` sin alcance coincide con dos o tres elementos y
 * falla por ambigüedad en lugar de por el motivo real.
 */
function avisos(page: Page) {
  return page.locator('[aria-live="polite"] [role="alert"]');
}

/** Los nueve controles del contrato, en el orden en que deben recibir foco. */
const ORDEN_FOCO = [
  'solicitud-requestedProfile',
  'solicitud-documentType',
  'solicitud-documentNumber',
  'solicitud-givenNames',
  'solicitud-familyNames',
  'solicitud-birthDate',
  'solicitud-phone',
  'solicitud-email',
  'solicitud-sexGenderCode',
];

test.describe.configure({ retries: 0 });

test.describe('Formulario de solicitud de acceso (SPEC 038, MP02-C2-C1)', () => {
  test('cada control tiene etiqueta asociada y el envío se alcanza con teclado', async ({
    page,
  }) => {
    await abrirFormulario(page);

    for (const etiqueta of [
      'Perfil que desea',
      'Tipo de documento',
      'Número de documento',
      'Nombres',
      'Apellidos',
      'Fecha de nacimiento',
      'Sexo o género',
      'Teléfono (opcional, al menos uno)',
      'Correo electrónico (opcional, al menos uno)',
    ]) {
      await expect(page.getByLabel(etiqueta, { exact: true })).toBeVisible();
    }

    /*
     * El recorrido se comprueba por IDENTIDAD de cada control, no contando
     * pulsaciones a ciegas: la secuencia importa porque un control fuera de
     * orden dejaría a la persona saltándose un campo obligatorio sin verlo.
     *
     * Los campos de fecha son la salvedad: Chromium reparte el foco entre día,
     * mes y año, así que el mismo control aparece varias veces seguidas. Se
     * colapsan las repeticiones consecutivas —lo que no se permite es saltar un
     * control o cambiar de orden.
     */
    await page.locator(`#${ORDEN_FOCO[0]}`).focus();

    const recorrido: string[] = [await page.evaluate(() => document.activeElement?.id ?? '')];
    for (let paso = 0; paso < 30; paso += 1) {
      await page.keyboard.press('Tab');

      const id = await page.evaluate(() => document.activeElement?.id ?? '');
      if (id === '') {
        break;
      }

      if (id !== recorrido[recorrido.length - 1]) {
        recorrido.push(id);
      }
    }

    expect(recorrido).toStrictEqual(ORDEN_FOCO);
    await expect(page.getByRole('button', { name: 'Enviar solicitud' })).toBeFocused();

    // Y el envío se activa con el teclado: Enter en un campo envía el formulario.
    const registro = capturarRuta(page, ACEPTADA);
    await completar(page);
    await page.locator(`#${ORDEN_FOCO[2]}`).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByText(REFERENCIA)).toBeVisible();
    expect(registro.llamadas).toBe(1);
  });

  test('ofrece exactamente los tres perfiles con el rótulo aprobado', async ({ page }) => {
    await abrirFormulario(page);

    const opciones = page.getByLabel('Perfil que desea', { exact: true }).locator('option');

    await expect(opciones).toHaveText(['Paciente', 'Cuidador', 'Visitador médico']);

    const valores = await opciones.evaluateAll((nodos) =>
      nodos.map((nodo) => (nodo as HTMLOptionElement).value),
    );
    expect(valores).toStrictEqual(['PATIENT', 'CAREGIVER', 'FIELD_PROFESSIONAL']);

    // Elegir el rótulo visible envía el valor técnico, no una traducción libre.
    await page.getByLabel('Perfil que desea', { exact: true }).selectOption('FIELD_PROFESSIONAL');

    const registro = capturarRuta(page, ACEPTADA);
    await completar(page);
    await page.getByRole('button', { name: 'Enviar solicitud' }).click();
    await expect(page.getByText(REFERENCIA)).toBeVisible();

    expect(registro.cuerpos[0]).toContain('"requestedProfile":"FIELD_PROFESSIONAL"');
  });

  test('exige al menos un medio de contacto y no llama a la API sin él', async ({ page }) => {
    await abrirFormulario(page);

    const registro = capturarRuta(page, ACEPTADA);
    await completar(page, false);
    await page.getByRole('button', { name: 'Enviar solicitud' }).click();

    await expect(
      avisos(page).filter({ hasText: 'Indique al menos un medio de contacto' }),
    ).toBeVisible();
    expect(registro.llamadas).toBe(0);
  });

  test('dos envíos en el mismo tick producen una sola petición', async ({ page }) => {
    await abrirFormulario(page);

    const registro = capturarRuta(page, ACEPTADA);
    await completar(page);

    /*
     * Ambos `requestSubmit` ocurren en el MISMO tick, sin que React pueda renderizar
     * entre ellos. Un bloqueo basado solo en estado leería `enviando === false` dos
     * veces y llamaría a la API dos veces: dos solicitudes y dos lugares del rate
     * limit consumidos por un solo gesto de la persona.
     */
    await page.evaluate(() => {
      const form = document.querySelector('form');
      if (form === null) {
        throw new Error('el formulario de solicitud no está montado');
      }

      form.requestSubmit();
      form.requestSubmit();
    });

    await expect(page.getByText(REFERENCIA)).toBeVisible();
    expect(registro.llamadas).toBe(1);
  });

  test('mantiene el envío bloqueado mientras la respuesta está pendiente', async ({ page }) => {
    await abrirFormulario(page);

    const pendiente = diferida<unknown>();
    const registro = capturarRuta(page, {
      status: ACEPTADA.status,
      cuerpo: ACEPTADA.cuerpo,
      esperar: pendiente.promesa,
    });
    await completar(page);

    await page.getByRole('button', { name: 'Enviar solicitud' }).click();

    const boton = page.getByRole('button', { name: 'Enviando solicitud…' });
    await expect(boton).toBeDisabled();
    await expect(page.getByText(REFERENCIA)).toBeHidden();
    expect(registro.llamadas).toBe(1);

    pendiente.resolver(undefined);
    await expect(page.getByText(REFERENCIA)).toBeVisible();
    expect(registro.llamadas).toBe(1);

    // Al terminar, el botón vuelve a estar disponible.
    await expect(page.getByRole('button', { name: 'Enviar solicitud' })).toBeEnabled();
  });

  test('muestra la referencia y el estado PENDING tras un 202', async ({ page }) => {
    await abrirFormulario(page);

    void capturarRuta(page, ACEPTADA);
    await completar(page);
    await page.getByRole('button', { name: 'Enviar solicitud' }).click();

    const confirmacion = page.getByRole('status');
    await expect(confirmacion).toContainText('Solicitud registrada');
    await expect(confirmacion).toContainText(REFERENCIA);
    await expect(confirmacion).toContainText('PENDING');
    // El texto NO promete acceso ni sesión.
    await expect(confirmacion).toContainText('no crea sesión ni cuenta');
  });

  test('permite reintentar después de un error', async ({ page }) => {
    await abrirFormulario(page);

    let intentos = 0;
    void page.route(RUTA_API, async (route: Route) => {
      intentos += 1;
      const respuesta = intentos === 1 ? FALLO_TEMPORAL : ACEPTADA;

      await route.fulfill({
        status: respuesta.status,
        contentType: 'application/json',
        body: JSON.stringify(respuesta.cuerpo),
      });
    });

    await completar(page);
    await page.getByRole('button', { name: 'Enviar solicitud' }).click();

    await expect(avisos(page)).toContainText('No fue posible registrar la solicitud');

    // Si el bloqueo NO se liberara en el desenlace, este segundo envío no ocurriría.
    const boton = page.getByRole('button', { name: 'Enviar solicitud' });
    await expect(boton).toBeEnabled();
    await boton.click();

    await expect(page.getByText(REFERENCIA)).toBeVisible();
    expect(intentos).toBe(2);
  });

  test('autocompleta los tres perfiles y envía el perfil elegido al Hospital', async ({ page }) => {
    await abrirFormulario(page);
    await page.waitForLoadState('networkidle');
    const registro = capturarRuta(page, ACEPTADA);

    for (const [boton, perfil, documento] of [
      ['Paciente demo 1', 'PATIENT', '900100001'],
      ['Cuidador demo 1', 'CAREGIVER', '900200001'],
      ['Visitador demo 1', 'FIELD_PROFESSIONAL', '900300001'],
    ] as const) {
      await page.getByRole('button', { name: boton }).click();
      await expect(page.getByLabel('Número de documento', { exact: true })).toHaveValue(documento);
      await page.getByRole('button', { name: 'Enviar solicitud' }).click();
      await expect(page.getByText(REFERENCIA)).toBeVisible();
      const cuerpo = JSON.parse(registro.cuerpos.at(-1) ?? '{}') as Record<string, string>;
      expect(cuerpo.requestedProfile).toBe(perfil);
      expect(cuerpo.documentNumber).toBe(documento);
    }
    expect(registro.llamadas).toBe(3);
  });
});
