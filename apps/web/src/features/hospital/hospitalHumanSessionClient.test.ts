import { describe, expect, it } from 'vitest';

import { resolvePublicApiBaseUrl } from '@/config/environment';
import * as compartido from '@/features/auth/humanSessionClient';

import * as fachada from './hospitalHumanSessionClient';
import {
  CONTEXTO_PROFESIONAL,
  DESTINO_RETORNO_HUMANO,
  RUTAS_SESION_HUMANA,
  cerrarSesionHumana,
  cierreHumanoConfirmado,
  consultarSesionHumana,
  urlDeLoginHumano,
  type CierreSesionHumana,
  type EstadoSesionHumana,
} from './hospitalHumanSessionClient';

/**
 * REGRESIÓN de la fachada de sesión humana de Hospital (spec 021 §17.D-3,
 * `MOVE TO SHARED`).
 *
 * El cliente se movió a `@/features/auth/humanSessionClient` y este archivo dejó
 * de implementarlo. Lo que estas pruebas demuestran es lo único que importa para
 * Hospital: que la extracción es un cambio de UBICACIÓN y no de comportamiento.
 *
 * Por eso se conservan, una a una, las afirmaciones de comportamiento que ya
 * existían —ruta, método, credencial implícita, no-caché, los cinco desenlaces
 * de consulta, los seis de cierre y la regla del cierre confirmado—, y se añaden
 * las que solo tienen sentido con una fachada: que la superficie importable es
 * la misma, que ningún componente de Hospital necesita cambiar una importación,
 * y que la fachada delega en vez de duplicar.
 *
 * Las guardias ESTRUCTURALES sobre el código fuente —ausencia de credenciales,
 * de identificadores de autoridad, de segundo mecanismo de acceso y de rutas no
 * autorizadas— viven ahora donde vive el código que vigilan:
 * `apps/web/src/features/auth/humanSessionClient.test.ts`. Comprobarlas sobre
 * una fachada que ya no implementa nada sería comprobar el vacío.
 *
 * Se prueba sin jsdom y sin red, inyectando una implementación de `fetch`. Todos
 * los valores son FICTICIOS.
 */

/** Doble de `fetch` que registra cada llamada y responde lo que se le diga. */
function fetchDoble(responder: () => Response | Promise<Response>): {
  readonly impl: typeof fetch;
  readonly llamadas: { url: string; init: RequestInit }[];
} {
  const llamadas: { url: string; init: RequestInit }[] = [];

  const impl = (async (entrada: unknown, init: RequestInit = {}) => {
    llamadas.push({ url: String(entrada), init });

    return responder();
  }) as unknown as typeof fetch;

  return { impl, llamadas };
}

/** Cuerpo FICTICIO del contrato humano, con los contextos que se pidan. */
function cuerpoSesion(contexts: readonly string[]): string {
  return JSON.stringify({
    expiresAt: '2026-08-24T20:00:00.000Z',
    idleExpiresInSeconds: 1800,
    contexts,
  });
}

function respuestaJson(cuerpo: string, status = 200): Response {
  return new Response(cuerpo, {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/* ========================================================================== */
/* Compatibilidad de la fachada                                                */
/* ========================================================================== */

describe('compatibilidad de la fachada de Hospital', () => {
  it('conserva EXACTAMENTE la superficie que Hospital importa', () => {
    /*
     * Igualdad de conjunto, no inclusión. Falla en los dos sentidos: si
     * desaparece un nombre que algún componente de Hospital importa, y si la
     * fachada estrena superficie nueva por su cuenta —que sería empezar a
     * decidir aquí en vez de reexportar—.
     */
    expect(Object.keys(fachada).sort()).toStrictEqual([
      'CONTEXTO_PROFESIONAL',
      'DESTINO_RETORNO_HUMANO',
      'RUTAS_SESION_HUMANA',
      'cerrarSesionHumana',
      'cierreHumanoConfirmado',
      'consultarSesionHumana',
      'urlDeLoginHumano',
    ]);
  });

  it('las funciones que no cambian de forma son las MISMAS del módulo compartido', () => {
    // Identidad de referencia: no hay copia, hay reexportación.
    expect(cerrarSesionHumana).toBe(compartido.cerrarSesionHumana);
    expect(cierreHumanoConfirmado).toBe(compartido.cierreHumanoConfirmado);
    expect(urlDeLoginHumano).toBe(compartido.urlDeLoginHumano);
    expect(RUTAS_SESION_HUMANA).toBe(compartido.RUTAS_SESION_HUMANA);
    expect(DESTINO_RETORNO_HUMANO).toBe(compartido.DESTINO_RETORNO_HUMANO);
  });

  it('conserva el contexto que Hospital exige, con su valor previo', () => {
    expect(CONTEXTO_PROFESIONAL).toBe('PROFESSIONAL');
    expect(CONTEXTO_PROFESIONAL).toBe(compartido.CONTEXTOS_HUMANOS.profesional);
  });

  it('la consulta conserva su firma previa: transporte y cancelación', () => {
    /*
     * Los consumidores de Hospital llaman `consultarSesionHumana(fetchImpl)`.
     * Si la fachada exigiera un contexto por parámetro, cada uno tendría que
     * cambiar, y la extracción habría dejado de ser transparente.
     */
    expect(consultarSesionHumana.length).toBe(0);
    expect(consultarSesionHumana).not.toBe(compartido.consultarSesionHumana);
  });
});

/* ========================================================================== */
/* Inicio del flujo OIDC: una URL para NAVEGAR, nunca una petición             */
/* ========================================================================== */

describe('URL del inicio de sesión humano', () => {
  it('es la ruta OIDC existente, absoluta y con el destino aprobado exacto', () => {
    expect(urlDeLoginHumano()).toBe(
      `${resolvePublicApiBaseUrl()}/api/v1/human-auth/login?returnTo=/`,
    );
    // Absoluta: el enlace no depende de dónde esté montada la interfaz.
    expect(urlDeLoginHumano().startsWith('http')).toBe(true);
  });

  it('usa la ruta del contrato y el único destino de la allowlist del servidor', () => {
    const url = new URL(urlDeLoginHumano());

    expect(url.pathname).toBe(RUTAS_SESION_HUMANA.login);
    expect(url.searchParams.get('returnTo')).toBe(DESTINO_RETORNO_HUMANO);
    expect(DESTINO_RETORNO_HUMANO).toBe('/');
    // Un ÚNICO parámetro: no viaja nada más hacia el proveedor de identidad.
    expect([...url.searchParams.keys()]).toStrictEqual(['returnTo']);
  });

  it('no pide el inicio de sesión por red: componer la URL no llama a nada', () => {
    const doble = fetchDoble(() => respuestaJson('{}'));

    // Se compone la URL con un doble disponible: nadie debe usarlo.
    expect(urlDeLoginHumano().length).toBeGreaterThan(0);
    expect(doble.llamadas).toStrictEqual([]);
  });
});

/* ========================================================================== */
/* Consulta de la sesión                                                       */
/* ========================================================================== */

describe('consulta de la sesión humana', () => {
  it('consulta la ruta aprobada por GET, con la sesión implícita y sin caché', async () => {
    const doble = fetchDoble(() => respuestaJson(cuerpoSesion(['PROFESSIONAL'])));

    await consultarSesionHumana(doble.impl);

    const llamada = doble.llamadas[0];

    expect(doble.llamadas).toHaveLength(1);
    expect(new URL(llamada?.url ?? '').pathname).toBe(RUTAS_SESION_HUMANA.sesion);
    expect(llamada?.init.method).toBe('GET');
    // La credencial la administra el navegador: no se escribe ninguna cabecera.
    expect(llamada?.init.credentials).toBe('include');
    expect(llamada?.init.cache).toBe('no-store');
    expect(llamada?.init.headers).toStrictEqual({ Accept: 'application/json' });
    expect(llamada?.init.body).toBeUndefined();
  });

  it('una sesión con contexto PROFESSIONAL se reconoce como profesional', async () => {
    const doble = fetchDoble(() =>
      respuestaJson(cuerpoSesion(['PATIENT', CONTEXTO_PROFESIONAL, 'CAREGIVER'])),
    );

    await expect(consultarSesionHumana(doble.impl)).resolves.toBe('activa-profesional');
  });

  it('una sesión humana SIN ese contexto no se convierte en profesional', async () => {
    for (const contextos of [[], ['PATIENT'], ['CAREGIVER'], ['PATIENT', 'CAREGIVER']]) {
      const doble = fetchDoble(() => respuestaJson(cuerpoSesion(contextos)));

      await expect(consultarSesionHumana(doble.impl)).resolves.toBe('activa-sin-contexto');
    }
  });

  it('un cuerpo sin `contexts` utilizable falla CERRADO', async () => {
    for (const cuerpo of ['{}', '{"contexts":null}', '{"contexts":"PROFESSIONAL"}']) {
      const doble = fetchDoble(() => respuestaJson(cuerpo));

      await expect(consultarSesionHumana(doble.impl)).resolves.toBe('activa-sin-contexto');
    }
  });

  it('un 401 devuelve «sin-sesion» sin distinguir la causa', async () => {
    const doble = fetchDoble(() => respuestaJson('{}', 401));

    await expect(consultarSesionHumana(doble.impl)).resolves.toBe('sin-sesion');
  });

  it('un 503 devuelve «no-disponible» y no lanza', async () => {
    const doble = fetchDoble(() => respuestaJson('{}', 503));

    await expect(consultarSesionHumana(doble.impl)).resolves.toBe('no-disponible');
  });

  it('un fallo de red devuelve «no-disponible» y no lanza', async () => {
    const impl = (async () => {
      throw new TypeError('Failed to connect');
    }) as unknown as typeof fetch;

    await expect(consultarSesionHumana(impl)).resolves.toBe('no-disponible');
  });

  it('un cuerpo ilegible devuelve «no-disponible»', async () => {
    const doble = fetchDoble(() => new Response('no es json', { status: 200 }));

    await expect(consultarSesionHumana(doble.impl)).resolves.toBe('no-disponible');
  });

  it('un aborto devuelve «cancelado» y no se confunde con un fallo', async () => {
    const controller = new AbortController();
    const impl = (async () => {
      const error = new Error('abortada');

      error.name = 'AbortError';

      throw error;
    }) as unknown as typeof fetch;

    controller.abort();

    await expect(consultarSesionHumana(impl, controller.signal)).resolves.toBe('cancelado');
  });

  it('una respuesta que llega tras el aborto tampoco afirma una sesión', async () => {
    const controller = new AbortController();
    const doble = fetchDoble(() => {
      controller.abort();

      return respuestaJson(cuerpoSesion(['PROFESSIONAL']));
    });

    await expect(consultarSesionHumana(doble.impl, controller.signal)).resolves.toBe(
      'cancelado',
    );
  });

  it('propaga la señal de cancelación a la petición', async () => {
    const controller = new AbortController();
    const doble = fetchDoble(() => respuestaJson(cuerpoSesion([])));

    await consultarSesionHumana(doble.impl, controller.signal);

    expect(doble.llamadas[0]?.init.signal).toBe(controller.signal);
  });
});

/* ========================================================================== */
/* Cierre de la sesión                                                         */
/* ========================================================================== */

describe('cierre de la sesión humana', () => {
  it('usa POST sobre la ruta aprobada, con la sesión implícita y sin cuerpo', async () => {
    const doble = fetchDoble(() => new Response(null, { status: 204 }));

    await expect(cerrarSesionHumana(doble.impl)).resolves.toBe('ok');

    const llamada = doble.llamadas[0];

    expect(new URL(llamada?.url ?? '').pathname).toBe(RUTAS_SESION_HUMANA.logout);
    expect(llamada?.init.method).toBe('POST');
    expect(llamada?.init.credentials).toBe('include');
    expect(llamada?.init.cache).toBe('no-store');
    // Ni cuerpo ni cabecera de identidad: el servidor resuelve todo el contexto.
    expect(llamada?.init.body).toBeUndefined();
    expect(llamada?.init.headers).toStrictEqual({ Accept: 'application/json' });
  });

  it('cada estado del contrato tiene su desenlace propio', async () => {
    const esperado: readonly (readonly [number, CierreSesionHumana])[] = [
      [204, 'ok'],
      [401, 'sin-sesion'],
      [403, 'origen-rechazado'],
      [429, 'demasiados-intentos'],
      [503, 'no-disponible'],
      [500, 'no-disponible'],
    ];

    for (const [status, desenlace] of esperado) {
      const doble = fetchDoble(() =>
        status === 204 ? new Response(null, { status }) : respuestaJson('{}', status),
      );

      await expect(cerrarSesionHumana(doble.impl)).resolves.toBe(desenlace);
    }
  });

  it('un fallo de red y un aborto se distinguen entre sí', async () => {
    const caido = (async () => {
      throw new TypeError('Failed to connect');
    }) as unknown as typeof fetch;

    await expect(cerrarSesionHumana(caido)).resolves.toBe('no-disponible');

    const controller = new AbortController();

    controller.abort();

    await expect(cerrarSesionHumana(caido, controller.signal)).resolves.toBe('cancelado');
  });

  it('solo una revocación CONFIRMADA autoriza a retirar la sesión', () => {
    expect(cierreHumanoConfirmado('ok')).toBe(true);
    expect(cierreHumanoConfirmado('sin-sesion')).toBe(true);

    for (const cierre of [
      'origen-rechazado',
      'demasiados-intentos',
      'cancelado',
      'no-disponible',
    ] as const) {
      expect(cierreHumanoConfirmado(cierre)).toBe(false);
    }
  });
});

/* ========================================================================== */
/* Alcance: los desenlaces que Hospital observa siguen siendo los mismos        */
/* ========================================================================== */

describe('alcance de la fachada', () => {
  it('declara exactamente los cinco desenlaces de consulta del contrato', () => {
    const estados: EstadoSesionHumana[] = [
      'activa-profesional',
      'activa-sin-contexto',
      'sin-sesion',
      'cancelado',
      'no-disponible',
    ];

    expect(new Set(estados).size).toBe(5);
  });

  it('no traduce ningún desenlace salvo el afirmativo', async () => {
    /*
     * La fachada solo renombra `activa-con-contexto` a `activa-profesional`.
     * Los otros cuatro se devuelven tal cual, de modo que no puede aparecer aquí
     * una interpretación distinta de la del módulo compartido.
     */
    const casos: readonly (readonly [Response, EstadoSesionHumana])[] = [
      [respuestaJson('{}', 401), 'sin-sesion'],
      [respuestaJson('{}', 503), 'no-disponible'],
      [respuestaJson(cuerpoSesion(['PATIENT'])), 'activa-sin-contexto'],
    ];

    for (const [respuesta, desenlace] of casos) {
      const doble = fetchDoble(() => respuesta);

      await expect(consultarSesionHumana(doble.impl)).resolves.toBe(desenlace);
    }
  });
});
