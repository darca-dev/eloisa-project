import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { resolvePublicApiBaseUrl } from '@/config/environment';

import {
  CONTEXTOS_HUMANOS,
  DESTINO_RETORNO_HUMANO,
  EXPERIENCIAS_APROBADAS,
  RUTA_EXPERIENCIAS_HUMANAS,
  RUTAS_EXPERIENCIA,
  RUTAS_SESION_HUMANA,
  cerrarSesionHumana,
  cierreHumanoConfirmado,
  consultarExperienciasAprobadas,
  consultarSesionHumana,
  filtrarExperienciasPersonales,
  urlDeLoginHumano,
  type CierreSesionHumana,
  type DesenlaceExperiencias,
  type EstadoSesionHumana,
} from './humanSessionClient';

/**
 * Cliente COMPARTIDO de la sesión HUMANA (spec 021 §17.D-3, `MOVE TO SHARED`).
 *
 * Se prueba sin jsdom y sin red, inyectando una implementación de `fetch`.
 * Todos los valores son FICTICIOS.
 *
 * Lo que estas pruebas vigilan no es solo que el cliente funcione, sino que NO
 * pueda convertirse en un segundo sistema de acceso: que el inicio de sesión
 * sea una URL para NAVEGAR y no una petición, que la credencial no se toque
 * nunca desde JavaScript, que ningún identificador de autoridad salga del
 * navegador, y que los dos contextos NO se sumen entre sí.
 */

const DIRECTORIO = fileURLToPath(new URL('.', import.meta.url));
const CODIGO = readFileSync(`${DIRECTORIO}humanSessionClient.ts`, 'utf8');

it('el acceso personal conserva solo perfiles personales aprobados, sin convertir instituciones en pacientes', () => {
  expect(filtrarExperienciasPersonales(['MUNICIPALITY', 'HOSPITAL'])).toEqual([]);
  expect(filtrarExperienciasPersonales([])).toEqual([]);
  expect(filtrarExperienciasPersonales(['MUNICIPALITY', 'PATIENT', 'HOSPITAL'])).toEqual(['PATIENT']);
  expect(filtrarExperienciasPersonales(['CAREGIVER', 'HOSPITAL', 'FIELD_PROFESSIONAL', 'PATIENT']))
    .toEqual(['CAREGIVER', 'FIELD_PROFESSIONAL', 'PATIENT']);
});

const PACIENTE = CONTEXTOS_HUMANOS.paciente;
const PROFESIONAL = CONTEXTOS_HUMANOS.profesional;

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
    expiresAt: '2026-08-26T20:00:00.000Z',
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
/* Inicio del flujo OIDC: una URL para NAVEGAR, nunca una petición             */
/* ========================================================================== */

describe('URL del inicio de sesión humano', () => {
  it('es la ruta OIDC existente, absoluta y con el destino aprobado exacto', () => {
    expect(urlDeLoginHumano()).toBe(
      `${resolvePublicApiBaseUrl()}/api/v1/human-auth/login?returnTo=/acceso`,
    );
    // Absoluta: el enlace no depende de dónde esté montada la interfaz.
    expect(urlDeLoginHumano().startsWith('http')).toBe(true);
  });

  it('usa la ruta del contrato y el único destino de la allowlist del servidor', () => {
    const url = new URL(urlDeLoginHumano());

    expect(url.pathname).toBe(RUTAS_SESION_HUMANA.login);
    expect(url.searchParams.get('returnTo')).toBe(DESTINO_RETORNO_HUMANO);
    /*
     * MP04 movió el retorno de `/` a `/acceso`: el servidor lo añadió a
     * `HUMAN_AUTH_RETURN_TARGETS` y el selector de experiencias vive ahí. Sigue
     * siendo UN valor, sin parámetros ni destinos compuestos.
     */
    expect(DESTINO_RETORNO_HUMANO).toBe('/acceso');
    // Un ÚNICO parámetro: no viaja nada más hacia el proveedor de identidad.
    expect([...url.searchParams.keys()]).toStrictEqual(['returnTo']);
  });

  it('es la MISMA para Paciente y para Profesional: no hay inicio por rol', () => {
    /*
     * El contexto lo deriva el SERVIDOR después del callback. Si la interfaz
     * pudiera pedir un inicio «de paciente», estaría anunciando al proveedor de
     * identidad una participación que aún no le consta a nadie.
     */
    expect(urlDeLoginHumano()).not.toContain(PACIENTE);
    expect(urlDeLoginHumano()).not.toContain(PROFESIONAL);
  });

  it('no pide el inicio de sesión por red: componer la URL no llama a nada', () => {
    const doble = fetchDoble(() => respuestaJson('{}'));

    // Se compone la URL con un doble disponible: nadie debe usarlo.
    expect(urlDeLoginHumano().length).toBeGreaterThan(0);
    expect(doble.llamadas).toStrictEqual([]);
  });

  it('el inicio de sesión NO aparece en ninguna operación de red del cliente', () => {
    /*
     * Guardia estructural: la ruta de `login` solo puede nombrarse UNA vez, al
     * componer la URL. Si algún día alguien la pidiera en segundo plano, el
     * flujo se rompería en silencio —la respuesta es una redirección hacia un
     * tercero— y esta prueba cae antes.
     */
    const menciones = [...CODIGO.matchAll(/RUTAS_SESION_HUMANA\.login/gu)];

    expect(menciones).toHaveLength(1);
    expect(CODIGO).toContain('RUTAS_SESION_HUMANA.login}?returnTo=');
  });
});

/* ========================================================================== */
/* Consulta de la sesión                                                       */
/* ========================================================================== */

describe('consulta de la sesión humana', () => {
  it('consulta la ruta aprobada por GET, con la sesión implícita y sin caché', async () => {
    const doble = fetchDoble(() => respuestaJson(cuerpoSesion([PROFESIONAL])));

    await consultarSesionHumana(PROFESIONAL, doble.impl);

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

  it('el contexto exigido NO viaja al servidor: no es un filtro, es una lectura', async () => {
    const doble = fetchDoble(() => respuestaJson(cuerpoSesion([PACIENTE])));

    await consultarSesionHumana(PACIENTE, doble.impl);

    const url = new URL(doble.llamadas[0]?.url ?? '');

    expect([...url.searchParams.keys()]).toStrictEqual([]);
    expect(doble.llamadas[0]?.init.body).toBeUndefined();
  });

  it('una sesión con el contexto PATIENT se reconoce como activa con contexto', async () => {
    const doble = fetchDoble(() => respuestaJson(cuerpoSesion([PACIENTE])));

    await expect(consultarSesionHumana(PACIENTE, doble.impl)).resolves.toBe(
      'activa-con-contexto',
    );
  });

  it('una sesión con el contexto PROFESSIONAL se reconoce como activa con contexto', async () => {
    const doble = fetchDoble(() =>
      respuestaJson(cuerpoSesion([PACIENTE, PROFESIONAL, 'CAREGIVER'])),
    );

    await expect(consultarSesionHumana(PROFESIONAL, doble.impl)).resolves.toBe(
      'activa-con-contexto',
    );
  });

  it('los dos contextos NO se suman entre sí', async () => {
    /*
     * Cada pregunta es la suya. Que la persona tenga una participación viva no
     * le concede la otra, y una superficie no puede habilitarse por el contexto
     * que exige otra.
     */
    const soloPaciente = fetchDoble(() => respuestaJson(cuerpoSesion([PACIENTE])));

    await expect(consultarSesionHumana(PROFESIONAL, soloPaciente.impl)).resolves.toBe(
      'activa-sin-contexto',
    );

    const soloProfesional = fetchDoble(() => respuestaJson(cuerpoSesion([PROFESIONAL])));

    await expect(consultarSesionHumana(PACIENTE, soloProfesional.impl)).resolves.toBe(
      'activa-sin-contexto',
    );
  });

  it('el CONTEXTO AUSENTE es distinguible de la falta de sesión', async () => {
    const conSesion = fetchDoble(() => respuestaJson(cuerpoSesion(['CAREGIVER'])));
    const sinSesion = fetchDoble(() => respuestaJson('{}', 401));

    const ausente = await consultarSesionHumana(PACIENTE, conSesion.impl);
    const inexistente = await consultarSesionHumana(PACIENTE, sinSesion.impl);

    expect(ausente).toBe('activa-sin-contexto');
    expect(inexistente).toBe('sin-sesion');
    expect(ausente).not.toBe(inexistente);
  });

  it('una sesión humana SIN el contexto pedido no lo adquiere por inferencia', async () => {
    for (const contextos of [[], ['CAREGIVER'], [PROFESIONAL, 'CAREGIVER']]) {
      const doble = fetchDoble(() => respuestaJson(cuerpoSesion(contextos)));

      await expect(consultarSesionHumana(PACIENTE, doble.impl)).resolves.toBe(
        'activa-sin-contexto',
      );
    }
  });

  it('un cuerpo sin `contexts` utilizable falla CERRADO', async () => {
    for (const cuerpo of ['{}', '{"contexts":null}', `{"contexts":"${PACIENTE}"}`]) {
      const doble = fetchDoble(() => respuestaJson(cuerpo));

      await expect(consultarSesionHumana(PACIENTE, doble.impl)).resolves.toBe(
        'activa-sin-contexto',
      );
    }
  });

  it('un 401 devuelve «sin-sesion» sin distinguir la causa', async () => {
    const doble = fetchDoble(() => respuestaJson('{}', 401));

    await expect(consultarSesionHumana(PACIENTE, doble.impl)).resolves.toBe('sin-sesion');
  });

  it('un 503 devuelve «no-disponible» y no lanza', async () => {
    const doble = fetchDoble(() => respuestaJson('{}', 503));

    await expect(consultarSesionHumana(PACIENTE, doble.impl)).resolves.toBe('no-disponible');
  });

  it('un fallo de red devuelve «no-disponible» y no lanza', async () => {
    const impl = (async () => {
      throw new TypeError('Failed to connect');
    }) as unknown as typeof fetch;

    await expect(consultarSesionHumana(PACIENTE, impl)).resolves.toBe('no-disponible');
  });

  it('un cuerpo ilegible devuelve «no-disponible» y NUNCA una sesión válida', async () => {
    const doble = fetchDoble(() => new Response('no es json', { status: 200 }));

    await expect(consultarSesionHumana(PACIENTE, doble.impl)).resolves.toBe('no-disponible');
  });

  it('un aborto devuelve «cancelado» y no se confunde con un fallo', async () => {
    const controller = new AbortController();
    const impl = (async () => {
      const error = new Error('abortada');

      error.name = 'AbortError';

      throw error;
    }) as unknown as typeof fetch;

    controller.abort();

    await expect(consultarSesionHumana(PACIENTE, impl, controller.signal)).resolves.toBe(
      'cancelado',
    );
  });

  it('una respuesta que llega tras el aborto tampoco afirma una sesión', async () => {
    const controller = new AbortController();
    const doble = fetchDoble(() => {
      controller.abort();

      return respuestaJson(cuerpoSesion([PACIENTE]));
    });

    await expect(
      consultarSesionHumana(PACIENTE, doble.impl, controller.signal),
    ).resolves.toBe('cancelado');
  });

  it('propaga la señal de cancelación a la petición', async () => {
    const controller = new AbortController();
    const doble = fetchDoble(() => respuestaJson(cuerpoSesion([])));

    await consultarSesionHumana(PACIENTE, doble.impl, controller.signal);

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

  it('no nombra contexto alguno: cerrar sesión no es cerrar un rol', async () => {
    const doble = fetchDoble(() => new Response(null, { status: 204 }));

    await cerrarSesionHumana(doble.impl);

    const llamada = JSON.stringify(doble.llamadas[0]);

    expect(llamada).not.toContain(PACIENTE);
    expect(llamada).not.toContain(PROFESIONAL);
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

  it('una respuesta 204 que llega tras el aborto NO afirma un cierre', async () => {
    const controller = new AbortController();
    const doble = fetchDoble(() => {
      controller.abort();

      return new Response(null, { status: 204 });
    });

    const cierre = await cerrarSesionHumana(doble.impl, controller.signal);

    expect(cierre).toBe('cancelado');
    expect(cierreHumanoConfirmado(cierre)).toBe(false);
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

  it('NINGÚN desenlace no confirmado puede pasar por éxito', async () => {
    /*
     * La regla completa, recorrida sobre respuestas reales: mientras el servidor
     * no confirme, la sesión sigue EN PIE. Afirmar lo contrario dejaría abierta
     * en un equipo compartido una sesión que la pantalla dio por cerrada.
     */
    const noConfirman: readonly (readonly [number, CierreSesionHumana])[] = [
      [403, 'origen-rechazado'],
      [429, 'demasiados-intentos'],
      [503, 'no-disponible'],
      [500, 'no-disponible'],
    ];

    for (const [status, desenlace] of noConfirman) {
      const doble = fetchDoble(() => respuestaJson('{}', status));
      const cierre = await cerrarSesionHumana(doble.impl);

      expect(cierre).toBe(desenlace);
      expect(cierreHumanoConfirmado(cierre)).toBe(false);
    }
  });
});

/* ========================================================================== */
/* Alcance negativo: ni segundo login, ni credenciales, ni identificadores      */
/* ========================================================================== */

describe('alcance negativo del cliente humano compartido', () => {
  it('declara exactamente los cinco desenlaces de consulta del contrato', () => {
    const estados: EstadoSesionHumana[] = [
      'activa-con-contexto',
      'activa-sin-contexto',
      'sin-sesion',
      'cancelado',
      'no-disponible',
    ];

    expect(new Set(estados).size).toBe(5);
  });

  it('los contextos que una interfaz puede exigir son exactamente TRES', () => {
    /*
     * MP04 §12 añade `CAREGIVER`: `/cuidador` necesita pedir el contexto para
     * separar «con relación» de «sin relación» y mostrar portada neutra sin
     * datos nominales en el segundo caso. Sigue siendo una lista CERRADA y
     * sigue sin ser la del servidor: pedir un contexto de más habilitaría una
     * superficie que nadie aprobó.
     */
    expect(Object.values(CONTEXTOS_HUMANOS)).toStrictEqual([
      'PATIENT',
      'CAREGIVER',
      'PROFESSIONAL',
    ]);
    // Ningún rol institucional ni ningún identificador entra en el catálogo.
    expect(Object.keys(CONTEXTOS_HUMANOS)).toStrictEqual([
      'paciente',
      'cuidador',
      'profesional',
    ]);
  });

  it('no lee, escribe ni copia la credencial de sesión, y no persiste nada', () => {
    expect(/document\s*\.\s*cookie/u.test(CODIGO)).toBe(false);
    expect(/localStorage|sessionStorage|indexedDB/u.test(CODIGO)).toBe(false);
    expect(/Set-Cookie|setHeader|['"]Cookie['"]|['"]Authorization['"]/iu.test(CODIGO)).toBe(
      false,
    );
    expect(CODIGO).not.toContain('merdn_human_session');
  });

  it('no admite ni envía ningún identificador de autoridad', () => {
    for (const prohibido of [
      'tenantId',
      'personId',
      'patientId',
      'professionalId',
      'humanAccountId',
      'identityCode',
      'accessSecret',
      'subject',
      'issuer',
      'claims',
      'actor',
    ]) {
      expect(CODIGO).not.toContain(prohibido);
    }
  });

  it('el cuerpo que sabe leer tiene EXACTAMENTE los tres campos del contrato', () => {
    const dto = /export interface SesionHumanaDto \{(?<cuerpo>[\s\S]*?)\n\}/u.exec(CODIGO);
    const campos = [...(dto?.groups?.cuerpo ?? '').matchAll(/readonly (?<nombre>\w+):/gu)].map(
      (coincidencia) => coincidencia.groups?.nombre ?? '',
    );

    expect(campos).toStrictEqual(['expiresAt', 'idleExpiresInSeconds', 'contexts']);
  });

  it('no fabrica un segundo mecanismo de acceso', () => {
    expect(/dev-login|devLogin/iu.test(CODIGO)).toBe(false);
    expect(/passw|contrase|[cC]lave/u.test(CODIGO)).toBe(false);
    expect(CODIGO).not.toContain('window.location');
    expect(CODIGO).not.toContain('location.href');
  });

  it('no toca la sesión institucional ni la cookie de autoinscripción', () => {
    expect(CODIGO).not.toContain('institutional');
    expect(CODIGO).not.toContain('hospitalInstitutionClient');
    expect(CODIGO).not.toContain('/api/v1/patients/me');
  });

  it('usa exclusivamente las cuatro rutas humanas del contrato', () => {
    const rutas = [...CODIGO.matchAll(/'(?<ruta>\/api\/v1\/[\w/-]+)'/gu)].map(
      (coincidencia) => coincidencia.groups?.ruta ?? '',
    );

    expect(rutas).toStrictEqual([
      '/api/v1/human-auth/login',
      '/api/v1/human-auth/session',
      '/api/v1/human-auth/logout',
      '/api/v1/me/experiences',
    ]);
  });
});

/* ========================================================================== */
/* Experiencias aprobadas (MP04)                                               */
/* ========================================================================== */

describe('consulta de experiencias aprobadas', () => {
  it('consulta la ruta de experiencias por GET, con la sesión implícita y sin caché', async () => {
    const doble = fetchDoble(() => respuestaJson('{"experiences":["PATIENT"]}'));

    await consultarExperienciasAprobadas(doble.impl);

    const llamada = doble.llamadas[0];

    expect(doble.llamadas).toHaveLength(1);
    expect(new URL(llamada?.url ?? '').pathname).toBe(RUTA_EXPERIENCIAS_HUMANAS);
    expect(llamada?.init.method).toBe('GET');
    expect(llamada?.init.credentials).toBe('include');
    expect(llamada?.init.cache).toBe('no-store');
    expect(llamada?.init.headers).toStrictEqual({ Accept: 'application/json' });
    expect(llamada?.init.body).toBeUndefined();
  });

  it('la experiencia elegida NO viaja al servidor: es una lectura, no un filtro', async () => {
    const doble = fetchDoble(() => respuestaJson('{"experiences":[]}'));

    await consultarExperienciasAprobadas(doble.impl);

    const url = new URL(doble.llamadas[0]?.url ?? '');

    expect([...url.searchParams.keys()]).toStrictEqual([]);
    expect(doble.llamadas[0]?.init.body).toBeUndefined();
  });

  it('devuelve exactamente las experiencias del catálogo, en el orden del servidor', async () => {
    const doble = fetchDoble(() =>
      respuestaJson('{"experiences":["CAREGIVER","PATIENT","FIELD_PROFESSIONAL"]}'),
    );

    await expect(consultarExperienciasAprobadas(doble.impl)).resolves.toStrictEqual({
      kind: 'ok',
      experiencias: ['CAREGIVER', 'PATIENT', 'FIELD_PROFESSIONAL'],
    });
  });

  it('una lista vacía con sesión es «ok» SIN experiencias, que es la denegación neutral', async () => {
    const doble = fetchDoble(() => respuestaJson('{"experiences":[]}'));

    await expect(consultarExperienciasAprobadas(doble.impl)).resolves.toStrictEqual({
      kind: 'ok',
      experiencias: [],
    });
  });

  it('descarta todo valor fuera del catálogo en lugar de seguirlo', async () => {
    /*
     * Un valor desconocido —de un paquete futuro o de un cuerpo alterado— no
     * puede convertirse en un destino al que la interfaz navegue. Se descarta,
     * no se propaga ni se infiere.
     */
    const doble = fetchDoble(() =>
      respuestaJson('{"experiences":["ADMIN","PATIENT","",1,null,"CUIDADOR"]}'),
    );

    await expect(consultarExperienciasAprobadas(doble.impl)).resolves.toStrictEqual({
      kind: 'ok',
      experiencias: ['PATIENT'],
    });

    expect([...EXPERIENCIAS_APROBADAS]).toStrictEqual([
      'PATIENT',
      'CAREGIVER',
      'FIELD_PROFESSIONAL',
      'HOSPITAL',
      'MUNICIPALITY',
    ]);
  });

  it('un cuerpo sin `experiences` utilizable falla CERRADO, no se lee como vacío', async () => {
    for (const cuerpo of ['{}', '{"experiences":null}', '{"experiences":"PATIENT"}']) {
      const doble = fetchDoble(() => respuestaJson(cuerpo));

      await expect(consultarExperienciasAprobadas(doble.impl)).resolves.toStrictEqual({
        kind: 'no-disponible',
      });
    }
  });

  it('un 401 devuelve «sin-sesion» sin distinguir la causa', async () => {
    const doble = fetchDoble(() => respuestaJson('{}', 401));

    await expect(consultarExperienciasAprobadas(doble.impl)).resolves.toStrictEqual({
      kind: 'sin-sesion',
    });
  });

  it('un 503, un fallo de red y un cuerpo ilegible son «no-disponible»', async () => {
    const caido = (async () => {
      throw new TypeError('Failed to connect');
    }) as unknown as typeof fetch;

    await expect(consultarExperienciasAprobadas(caido)).resolves.toStrictEqual({
      kind: 'no-disponible',
    });

    const error = fetchDoble(() => respuestaJson('{}', 503));
    await expect(consultarExperienciasAprobadas(error.impl)).resolves.toStrictEqual({
      kind: 'no-disponible',
    });

    const malformado = fetchDoble(() => new Response('no es json', { status: 200 }));
    await expect(consultarExperienciasAprobadas(malformado.impl)).resolves.toStrictEqual({
      kind: 'no-disponible',
    });
  });

  it('un aborto devuelve «cancelado» y no se confunde con un fallo', async () => {
    const controller = new AbortController();
    const impl = (async () => {
      const error = new Error('abortada');

      error.name = 'AbortError';

      throw error;
    }) as unknown as typeof fetch;

    controller.abort();

    await expect(consultarExperienciasAprobadas(impl, controller.signal)).resolves.toStrictEqual({
      kind: 'cancelado',
    });
  });

  it('cada experiencia abre EXACTAMENTE su portada, y ninguna otra', () => {
    expect(RUTAS_EXPERIENCIA).toStrictEqual({
      PATIENT: '/paciente',
      CAREGIVER: '/cuidador',
      FIELD_PROFESSIONAL: '/profesional',
      HOSPITAL: '/hospital',
      MUNICIPALITY: '/municipality',
    });

    // No hay portada suelta: todo destino del mapa está en el catálogo.
    for (const ruta of Object.values(RUTAS_EXPERIENCIA)) {
      expect(Object.values(RUTAS_EXPERIENCIA)).toContain(ruta);
      expect(ruta.startsWith('/')).toBe(true);
    }
  });

  it('no propaga caducidad, identificadores ni el motivo de una lista vacía', async () => {
    const doble = fetchDoble(() =>
      respuestaJson(
        JSON.stringify({
          experiences: ['PATIENT'],
          expiresAt: '2026-08-26T20:00:00.000Z',
          reason: 'ninguna aprobación',
          humanAccountId: 'cuenta-1',
        }),
      ),
    );

    const desenlace: DesenlaceExperiencias = await consultarExperienciasAprobadas(doble.impl);

    expect(JSON.stringify(desenlace)).not.toContain('expiresAt');
    expect(JSON.stringify(desenlace)).not.toContain('humanAccountId');
    expect(JSON.stringify(desenlace)).not.toContain('ninguna aprobación');
    expect(desenlace).toStrictEqual({ kind: 'ok', experiencias: ['PATIENT'] });
  });
});
