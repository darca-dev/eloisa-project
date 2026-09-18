import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  ETIQUETA_ROL_INSTITUCIONAL,
  MENSAJE_APERTURA,
  MENSAJE_CAMBIO,
  MENSAJE_CIERRE,
  MENSAJE_CIERRE_NO_CONFIRMADO,
  MENSAJE_CREDENCIAL,
  LONGITUD_MAXIMA_CREDENCIAL,
  RUTA_SESIONES_INSTITUCIONALES,
  RUTA_SESION_INSTITUCIONAL,
  abrirSesionInstitucional,
  cerrarSesionInstitucional,
  consultarSesionInstitucional,
  etiquetaDeRol,
  textoCaducidad,
  resolverCierre,
  resolverReconfirmacion,
  validarAcceso,
  type FalloApertura,
  type ResultadoCierre,
  type ResultadoSesion,
} from './institutionalSessionClient';

/**
 * Cliente COMPARTIDO de la sesión institucional (spec 022, «Decisión técnica
 * cerrada: reutilización del cliente institucional», sobre
 * TASK-HOSPITAL-CORE-01 §8.0, §10.10 y §12.3).
 *
 * Estas son, una a una, las MISMAS pruebas de comportamiento que vivían en
 * `features/hospital/hospitalInstitutionClient.test.ts`: se movieron junto al
 * código que vigilan. Demuestran que la extracción es un cambio de UBICACIÓN y
 * no de comportamiento: ruta, método, credencial implícita, no-caché, cada
 * código de estado, cancelación, validación local, uniformidad de los mensajes
 * y la regla del cierre confirmado. Al final se añaden las guardias
 * ESTRUCTURALES sobre el código fuente, que ahora corresponden a este módulo.
 *
 * Compartir el transporte NO mezcla autorizaciones: los roles institucionales
 * son DISJUNTOS y cada superficie exige el suyo en el servidor.
 *
 * Se prueba sin jsdom y sin red, inyectando una implementación de `fetch`.
 * Todos los valores son ficticios.
 */

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

const SESION_FICTICIA = {
  role: 'HOSPITAL_PATIENT_VIEWER',
  expiresAt: '2026-08-22T20:00:00.000Z',
  institution: { name: 'Institución ficticia de pruebas' },
  actorDisplay: 'Acceso institucional',
};

describe('consulta del contexto', () => {
  it('consulta la ruta aprobada con credenciales y sin caché', async () => {
    const doble = fetchDoble(
      () =>
        new Response(JSON.stringify(SESION_FICTICIA), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    );

    const resultado = await consultarSesionInstitucional(doble.impl);

    expect(new URL(doble.llamadas[0]?.url ?? '').pathname).toBe(RUTA_SESION_INSTITUCIONAL);
    expect(doble.llamadas[0]?.init.credentials).toBe('include');
    expect(doble.llamadas[0]?.init.cache).toBe('no-store');
    expect(resultado).toStrictEqual({ kind: 'ok', datos: SESION_FICTICIA });
  });

  it('un 401 devuelve «sin-sesion», sin distinguir la causa', async () => {
    const doble = fetchDoble(() => new Response('{}', { status: 401 }));

    await expect(consultarSesionInstitucional(doble.impl)).resolves.toStrictEqual({
      kind: 'sin-sesion',
    });
  });

  it('un fallo del servicio devuelve «error» y no lanza', async () => {
    const doble = fetchDoble(() => new Response('{}', { status: 503 }));

    await expect(consultarSesionInstitucional(doble.impl)).resolves.toStrictEqual({
      kind: 'error',
    });
  });

  it('un fallo de red devuelve «error» y no lanza', async () => {
    const doble = fetchDoble(() => {
      throw new TypeError('Failed to fetch');
    });

    await expect(consultarSesionInstitucional(doble.impl)).resolves.toStrictEqual({
      kind: 'error',
    });
  });

  it('una consulta abortada devuelve «cancelado»', async () => {
    const controller = new AbortController();
    const doble = fetchDoble(() => {
      const error = new Error('abortada');

      error.name = 'AbortError';

      throw error;
    });

    controller.abort();

    await expect(
      consultarSesionInstitucional(doble.impl, controller.signal),
    ).resolves.toStrictEqual({ kind: 'cancelado' });
  });
});

describe('presentación del rol', () => {
  it('rotula los tres roles implementados sin prometer capacidades', () => {
    expect(etiquetaDeRol('HOSPITAL_PATIENT_VIEWER')).toBe('Consulta de pacientes');
    expect(etiquetaDeRol('HOSPITAL_SCHEDULER')).toBe('Agenda hospitalaria');
    expect(etiquetaDeRol('MUNICIPAL_VIEWER')).toBe('Consulta municipal agregada');
    expect(Object.keys(ETIQUETA_ROL_INSTITUCIONAL).sort()).toStrictEqual([
      'HOSPITAL_PATIENT_VIEWER',
      'HOSPITAL_SCHEDULER',
      'MUNICIPAL_VIEWER',
    ]);
  });

  it('la agenda hospitalaria se reconoce y NO se confunde con consulta de pacientes', () => {
    /*
     * Los roles son DISJUNTOS: rotular la agenda como «Consulta de pacientes»
     * afirmaría un acceso que ese rol no tiene, y viceversa.
     */
    expect(etiquetaDeRol('HOSPITAL_SCHEDULER')).not.toBe(etiquetaDeRol('HOSPITAL_PATIENT_VIEWER'));
    expect(etiquetaDeRol('HOSPITAL_SCHEDULER')).not.toBe('Acceso institucional');
    expect(ETIQUETA_ROL_INSTITUCIONAL.HOSPITAL_SCHEDULER).toBe('Agenda hospitalaria');
  });

  it('un rol desconocido se rotula de forma neutra, no se inventa un nombre', () => {
    expect(etiquetaDeRol('ROL_FUTURO_NO_IMPLEMENTADO')).toBe('Acceso institucional');
  });

  it('ninguna etiqueta nombra a una persona ni a una institución concreta', () => {
    const serializado = JSON.stringify(ETIQUETA_ROL_INSTITUCIONAL);

    for (const prohibido of ['Claudia', 'Vargas', 'San Rafael', 'ESE', 'Soacha']) {
      expect(serializado).not.toContain(prohibido);
    }
  });
});

describe('caducidad', () => {
  it('se redacta desde la cadena del servidor, sin recalcularla', () => {
    expect(textoCaducidad('2026-08-22T20:00:00.000Z')).toBe(
      'Sesión vigente hasta 22/08/2026 20:00 UTC',
    );
  });

  it('una cadena con forma inesperada no produce una fecha inventada', () => {
    expect(textoCaducidad('mañana')).toBeNull();
    expect(textoCaducidad('')).toBeNull();
    expect(textoCaducidad('2026-08-22')).toBeNull();
  });
});

/* -------------------------------------------------------------------------- */
/* MP-TODAY-02 — Apertura, cierre y validación local                           */
/* -------------------------------------------------------------------------- */

/** Credencial FICTICIA de pruebas. No corresponde a ningún entorno real. */
const CREDENCIAL_FICTICIA = 'credencial-ficticia-de-pruebas';

const CODIGO_FICTICIO = 'hospital-patient-viewer';

describe('apertura de la sesión institucional', () => {
  it('envía un POST a la colección, con credenciales y sin caché', async () => {
    const doble = fetchDoble(
      () =>
        new Response(
          JSON.stringify({ role: 'HOSPITAL_PATIENT_VIEWER', expiresAt: SESION_FICTICIA.expiresAt }),
          { status: 201, headers: { 'Content-Type': 'application/json' } },
        ),
    );

    const resultado = await abrirSesionInstitucional(
      CODIGO_FICTICIO,
      CREDENCIAL_FICTICIA,
      doble.impl,
    );

    expect(new URL(doble.llamadas[0]?.url ?? '').pathname).toBe(RUTA_SESIONES_INSTITUCIONALES);
    expect(doble.llamadas[0]?.init.method).toBe('POST');
    expect(doble.llamadas[0]?.init.credentials).toBe('include');
    expect(doble.llamadas[0]?.init.cache).toBe('no-store');
    expect(resultado).toStrictEqual({ kind: 'ok' });
  });

  it('envía EXACTAMENTE los dos campos del contrato, sin tenant ni rol', () => {
    /*
     * Ni `tenantId`, ni `role`, ni actor, ni institución: el servidor resuelve
     * todo eso por su cuenta y no acepta que el cliente lo declare.
     */
    const doble = fetchDoble(() => new Response(null, { status: 201 }));

    return abrirSesionInstitucional(CODIGO_FICTICIO, CREDENCIAL_FICTICIA, doble.impl).then(() => {
      const enviado = JSON.parse(String(doble.llamadas[0]?.init.body)) as Record<string, unknown>;

      expect(Object.keys(enviado).sort()).toStrictEqual(['accessSecret', 'identityCode']);
      expect(enviado.identityCode).toBe(CODIGO_FICTICIO);
      expect(enviado.accessSecret).toBe(CREDENCIAL_FICTICIA);
    });
  });

  it('no propaga el cuerpo de la respuesta: la identidad se confirma con «current»', async () => {
    const doble = fetchDoble(
      () =>
        new Response(JSON.stringify({ role: 'MUNICIPAL_VIEWER', expiresAt: '2026-08-22T20:00:00.000Z' }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        }),
    );

    // Ni rol, ni caducidad, ni token: solo el desenlace.
    await expect(
      abrirSesionInstitucional(CODIGO_FICTICIO, CREDENCIAL_FICTICIA, doble.impl),
    ).resolves.toStrictEqual({ kind: 'ok' });
  });

  it.each<[number, string]>([
    [400, 'solicitud-invalida'],
    [401, 'credenciales-invalidas'],
    [403, 'origen-rechazado'],
    [429, 'demasiados-intentos'],
    [500, 'error'],
    [503, 'error'],
  ])('traduce el estado %i a «%s»', async (estado, esperado) => {
    const doble = fetchDoble(() => new Response('{}', { status: estado }));

    await expect(
      abrirSesionInstitucional(CODIGO_FICTICIO, CREDENCIAL_FICTICIA, doble.impl),
    ).resolves.toStrictEqual({ kind: esperado });
  });

  it('un fallo de red devuelve «error» y no lanza', async () => {
    const doble = fetchDoble(() => {
      throw new TypeError('Failed to fetch');
    });

    await expect(
      abrirSesionInstitucional(CODIGO_FICTICIO, CREDENCIAL_FICTICIA, doble.impl),
    ).resolves.toStrictEqual({ kind: 'error' });
  });

  it('una apertura abortada devuelve «cancelado»', async () => {
    const controller = new AbortController();
    const doble = fetchDoble(() => {
      const error = new Error('abortada');

      error.name = 'AbortError';

      throw error;
    });

    controller.abort();

    await expect(
      abrirSesionInstitucional(
        CODIGO_FICTICIO,
        CREDENCIAL_FICTICIA,
        doble.impl,
        controller.signal,
      ),
    ).resolves.toStrictEqual({ kind: 'cancelado' });
  });
});

describe('cierre de la sesión institucional', () => {
  it('envía un DELETE a la sesión vigente, con credenciales y sin caché', async () => {
    const doble = fetchDoble(() => new Response(null, { status: 204 }));

    const resultado = await cerrarSesionInstitucional(doble.impl);

    expect(new URL(doble.llamadas[0]?.url ?? '').pathname).toBe(RUTA_SESION_INSTITUCIONAL);
    expect(doble.llamadas[0]?.init.method).toBe('DELETE');
    expect(doble.llamadas[0]?.init.credentials).toBe('include');
    expect(doble.llamadas[0]?.init.cache).toBe('no-store');
    expect(doble.llamadas[0]?.init.body).toBeUndefined();
    expect(resultado).toStrictEqual({ kind: 'ok' });
  });

  it.each<[number, string]>([
    [401, 'sin-sesion'],
    [403, 'origen-rechazado'],
    [503, 'error'],
  ])('traduce el estado %i a «%s»', async (estado, esperado) => {
    const doble = fetchDoble(() => new Response('{}', { status: estado }));

    await expect(cerrarSesionInstitucional(doble.impl)).resolves.toStrictEqual({
      kind: esperado,
    });
  });

  it('un fallo de red devuelve «error» y no lanza', async () => {
    const doble = fetchDoble(() => {
      throw new TypeError('Failed to fetch');
    });

    await expect(cerrarSesionInstitucional(doble.impl)).resolves.toStrictEqual({ kind: 'error' });
  });
});

describe('validación local antes de enviar', () => {
  it('acepta un código con la forma del contrato y una credencial no vacía', () => {
    expect(validarAcceso(CODIGO_FICTICIO, CREDENCIAL_FICTICIA)).toBeNull();
    expect(validarAcceso('municipal-viewer', 'x')).toBeNull();
    expect(validarAcceso('a.b_c-9', CREDENCIAL_FICTICIA)).toBeNull();
  });

  it('exige el código y rechaza formas que el servidor no admite', () => {
    expect(validarAcceso('', CREDENCIAL_FICTICIA)).toBe('codigo-requerido');
    expect(validarAcceso('Hospital', CREDENCIAL_FICTICIA)).toBe('codigo-invalido');
    expect(validarAcceso('con espacio', CREDENCIAL_FICTICIA)).toBe('codigo-invalido');
    expect(validarAcceso('-inicia-con-guion', CREDENCIAL_FICTICIA)).toBe('codigo-invalido');
    expect(validarAcceso('a'.repeat(65), CREDENCIAL_FICTICIA)).toBe('codigo-invalido');
  });

  it('exige la credencial y acota su longitud a la del contrato', () => {
    expect(validarAcceso(CODIGO_FICTICIO, '')).toBe('credencial-requerida');
    expect(validarAcceso(CODIGO_FICTICIO, 'x'.repeat(LONGITUD_MAXIMA_CREDENCIAL))).toBeNull();
    expect(validarAcceso(CODIGO_FICTICIO, 'x'.repeat(LONGITUD_MAXIMA_CREDENCIAL + 1))).toBe(
      'credencial-excedida',
    );
  });

  it('la validación local no adelanta ningún desenlace del servidor', () => {
    /*
     * Dos credenciales distintas con forma válida son indistinguibles aquí: la
     * comprobación es de FORMA, no de coincidencia.
     */
    expect(validarAcceso(CODIGO_FICTICIO, 'una-credencial-valida-en-forma')).toBeNull();
    expect(validarAcceso(CODIGO_FICTICIO, 'otra-credencial-valida-en-forma')).toBeNull();
  });
});

describe('mensajes del acceso', () => {
  const FALLOS: readonly FalloApertura[] = [
    'credenciales-invalidas',
    'solicitud-invalida',
    'origen-rechazado',
    'demasiados-intentos',
    'error',
  ];

  it('cada fallo de apertura tiene un texto propio y no vacío', () => {
    expect(Object.keys(MENSAJE_APERTURA).sort()).toStrictEqual([...FALLOS].sort());

    for (const fallo of FALLOS) {
      expect(MENSAJE_APERTURA[fallo].length).toBeGreaterThan(0);
    }
  });

  it('la credencial no válida NO dice qué falló: código, identidad o secreto', () => {
    const mensaje = MENSAJE_APERTURA['credenciales-invalidas'];

    for (const revelador of ['código', 'credencial', 'existe', 'deshabilitada', 'coincide']) {
      expect(mensaje).not.toContain(revelador);
    }
  });

  it('ningún mensaje nombra interioridades del sistema', () => {
    const todos = [
      ...Object.values(MENSAJE_APERTURA),
      ...Object.values(MENSAJE_CREDENCIAL),
    ].join(' ');

    for (const prohibido of ['tenant', 'cookie', 'token', 'SQL', 'Prisma', 'stack']) {
      expect(todos).not.toContain(prohibido);
    }
  });
});

/* -------------------------------------------------------------------------- */
/* MP-TODAY-02 (corrección) — Solo una revocación CONFIRMADA retira la sesión  */
/* -------------------------------------------------------------------------- */

describe('decisión del cierre', () => {
  it('un 204 confirma la revocación y retira la sesión', () => {
    expect(resolverCierre('ok', 'cerrar')).toStrictEqual({
      retirarSesion: true,
      reconfirmar: false,
      aviso: MENSAJE_CIERRE,
    });
    expect(resolverCierre('ok', 'cambiar')).toStrictEqual({
      retirarSesion: true,
      reconfirmar: false,
      aviso: MENSAJE_CAMBIO,
    });
  });

  it('un 401 también confirma: en el servidor ya no había sesión', () => {
    expect(resolverCierre('sin-sesion', 'cerrar').retirarSesion).toBe(true);
    expect(resolverCierre('sin-sesion', 'cambiar').aviso).toBe(MENSAJE_CAMBIO);
  });

  it.each<[ResultadoCierre['kind']]>([['origen-rechazado'], ['error'], ['cancelado']])(
    'un cierre «%s» NO retira la sesión y obliga a reconfirmar',
    (kind) => {
      expect(resolverCierre(kind, 'cerrar')).toStrictEqual({
        retirarSesion: false,
        reconfirmar: true,
        aviso: null,
      });
      // El cambio de sesión queda bloqueado exactamente igual.
      expect(resolverCierre(kind, 'cambiar').retirarSesion).toBe(false);
    },
  );

  it('solo los estados 204 y 401 del DELETE retiran la sesión', async () => {
    const retirados: number[] = [];

    for (const estado of [204, 401, 403, 500, 503]) {
      const doble = fetchDoble(() =>
        estado === 204 ? new Response(null, { status: 204 }) : new Response('{}', { status: estado }),
      );
      const cierre = await cerrarSesionInstitucional(doble.impl);

      if (resolverCierre(cierre.kind, 'cerrar').retirarSesion) {
        retirados.push(estado);
      }
    }

    expect(retirados).toStrictEqual([204, 401]);
  });
});

describe('reconfirmación tras una revocación no confirmada', () => {
  it('si el contexto sigue vigente, la sesión se CONSERVA y el cambio queda bloqueado', () => {
    const tras = resolverReconfirmacion('ok', 'cambiar');

    expect(tras).toStrictEqual({
      retirarSesion: false,
      reconfirmar: false,
      aviso: MENSAJE_CIERRE_NO_CONFIRMADO,
    });
    // El aviso no puede ser el de una sesión cerrada: no se cerró nada.
    expect(tras.aviso).not.toBe(MENSAJE_CAMBIO);
    expect(tras.aviso).not.toBe(MENSAJE_CIERRE);
  });

  it.each<[ResultadoSesion['kind']]>([['error'], ['cancelado']])(
    'si el contexto no puede confirmarse («%s») la sesión también se conserva',
    (kind) => {
      expect(resolverReconfirmacion(kind, 'cerrar')).toStrictEqual({
        retirarSesion: false,
        reconfirmar: false,
        aviso: MENSAJE_CIERRE_NO_CONFIRMADO,
      });
    },
  );

  it('si el contexto dice que ya no hay sesión, entonces sí se retira', () => {
    expect(resolverReconfirmacion('sin-sesion', 'cerrar')).toStrictEqual({
      retirarSesion: true,
      reconfirmar: false,
      aviso: MENSAJE_CIERRE,
    });
    expect(resolverReconfirmacion('sin-sesion', 'cambiar').aviso).toBe(MENSAJE_CAMBIO);
  });

  it('el aviso de cierre no confirmado no afirma que la identidad se retiró', () => {
    for (const falso of ['se retiró', 'retirada', 'cerrada']) {
      expect(MENSAJE_CIERRE_NO_CONFIRMADO).not.toContain(falso);
    }

    expect(MENSAJE_CIERRE_NO_CONFIRMADO).toContain('sigue abierta');
  });
});

/* ========================================================================== */
/* Guardias estructurales sobre el código fuente del módulo compartido         */
/* ========================================================================== */

const DIRECTORIO = fileURLToPath(new URL('.', import.meta.url));
const CODIGO = readFileSync(`${DIRECTORIO}institutionalSessionClient.ts`, 'utf8');

/**
 * El mismo código SIN comentarios.
 *
 * Los comentarios de este módulo NOMBRAN a propósito lo que el módulo no hace
 * —repliegue a fixtures, opciones de la petición, entidades disjuntas—, y una
 * guardia que buscara esas palabras en el texto explicativo estaría vigilando
 * la prosa en vez del comportamiento. Lo que se vigila aquí es el CÓDIGO.
 */
const EFECTIVO = CODIGO.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/\/\/.*$/gmu, '');

describe('alcance del módulo compartido', () => {
  it('no persiste nada en el navegador ni lee la cookie de sesión', () => {
    /*
     * La credencial de sesión viaja en una cookie `HttpOnly` que el navegador
     * administra: este código no puede verla, y tampoco debe guardar una copia
     * de nada por su cuenta.
     */
    for (const prohibido of [
      'localStorage',
      'sessionStorage',
      'indexedDB',
      'document.cookie',
    ]) {
      expect(CODIGO).not.toContain(prohibido);
    }
  });

  it('no fabrica un segundo mecanismo de acceso ni un repliegue a fixtures', () => {
    expect(/dev-login|devLogin/iu.test(EFECTIVO)).toBe(false);
    expect(/fixture|demo|mock|stub/iu.test(EFECTIVO)).toBe(false);
    expect(EFECTIVO).not.toContain('window.location');
    expect(EFECTIVO).not.toContain('location.href');
  });

  it('no lee el entorno ni usa un transporte alternativo', () => {
    expect(EFECTIVO).not.toContain('process.env');
    expect(/XMLHttpRequest|WebSocket|axios|EventSource|sendBeacon/u.test(EFECTIVO)).toBe(
      false,
    );
  });

  it('no toca la sesión HUMANA: son entidades disjuntas', () => {
    expect(EFECTIVO).not.toContain('human-auth');
    expect(EFECTIVO).not.toContain('humanSessionClient');
  });

  it('usa EXACTAMENTE las dos rutas institucionales del contrato', () => {
    const rutas = [...EFECTIVO.matchAll(/'(?<ruta>\/api\/v1\/[\w/-]+)'/gu)].map(
      (coincidencia) => coincidencia.groups?.ruta ?? '',
    );

    expect(rutas).toStrictEqual([
      '/api/v1/institutional/sessions/current',
      '/api/v1/institutional/sessions',
    ]);
  });

  it('las TRES operaciones viajan con la sesión implícita y sin caché', () => {
    expect([...EFECTIVO.matchAll(/credentials: 'include'/gu)]).toHaveLength(3);
    expect([...EFECTIVO.matchAll(/cache: 'no-store'/gu)]).toHaveLength(3);
  });

  it('la credencial recibida no se registra y solo viaja en el cuerpo del POST', () => {
    expect(/console\.(?:log|info|warn|error|debug)/u.test(EFECTIVO)).toBe(false);
    expect(
      [...EFECTIVO.matchAll(/JSON\.stringify\(\{ identityCode, accessSecret \}\)/gu)],
    ).toHaveLength(1);
  });

  it('el cuerpo que sabe leer no deja hueco para tenant ni identidad', () => {
    /*
     * Cuatro campos y ninguno más, contando el `name` anidado dentro de
     * `institution`. Un campo nuevo aquí sería un dato nuevo publicado a la
     * interfaz, y esta prueba obliga a declararlo en vez de dejarlo entrar.
     */
    const dto = /export interface SesionInstitucionalDto \{(?<cuerpo>[\s\S]*?)\n\}/u.exec(
      EFECTIVO,
    );
    const campos = [
      ...(dto?.groups?.cuerpo ?? '').matchAll(/readonly (?<nombre>\w+)[?:]/gu),
    ].map((coincidencia) => coincidencia.groups?.nombre ?? '');

    expect(campos).toStrictEqual([
      'role',
      'expiresAt',
      'institution',
      'name',
      'actorDisplay',
    ]);
    expect(EFECTIVO).not.toContain('tenantId');
    expect(EFECTIVO).not.toContain('identityId');
  });
});
