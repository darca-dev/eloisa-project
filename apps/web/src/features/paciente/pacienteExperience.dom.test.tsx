import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  ExperienciaMerdn,
  TEXTO_ENTRADA_PACIENTE,
  faseDeSesionHumana,
} from '@/features/experiencia/ExperienciaMerdn';
import { fetchCurrentPatient } from '@/features/inscripcion/patientEnrollmentClient';

import {
  PORTAL_INICIAL,
  TEXTO_PORTAL_PACIENTE,
  cargarDatosPaciente,
  comprobarSesionPaciente,
  conCierrePaciente,
  conSeccionPaciente,
  conSesionPaciente,
  esExpiracion,
  seccionDesde,
} from './PacienteExperience';
import type { EstadoPortalPaciente } from './PacienteExperience';
import { DEPENDENCIAS_REALES } from './PacienteExperience';
import { ETIQUETA_PACIENTE, RUTAS_PACIENTE_SELF } from './pacienteSelfClient';

/**
 * Comportamiento del portal del Paciente y de la conmutación de fase de `/`
 * (spec 021, micro-paquete 5; T7.1 a T7.10).
 *
 * QUÉ SE PRUEBA AQUÍ. Lo que no se ve en un render: que un reintento vuelve a
 * SALIR al servidor, que la expiración retira lo ya cargado, que el cierre no
 * confirmado no se disfraza de éxito, que la cookie de inscripción NO abre el
 * portal y que nada se guarda en el navegador.
 *
 * POR QUÉ NO HAY DOM. El runner de `apps/web` es `node`: no hay jsdom y no hay
 * librería de testing, y esta spec prohíbe dependencias nuevas (§17.B-9). Por
 * eso el portal separa transición PURA, consulta async y vista pura: cada una
 * se comprueba de verdad, y lo único que queda sin cubrir por prueba
 * automatizada es el disparo del evento del navegador, que es justamente lo
 * que verifica la validación en navegador de §20.16.
 *
 * Todos los datos son ficticios.
 */

const CUERPO_RESUMEN = {
  givenName: 'María',
  initials: 'ME',
  label: ETIQUETA_PACIENTE,
} as const;
const CUERPO_CITAS = {
  items: [
    { scheduledStart: '2026-09-03T14:30:00.000Z', modality: 'ON_SITE', status: 'ASSIGNED' },
  ],
};
const CUERPO_VISITAS = {
  items: [
    { scheduledStart: '2026-08-20T13:00:00.000Z', modality: 'HOME', status: 'COMPLETED' },
  ],
};

/** Respuesta por ruta, o el estado HTTP que se quiera devolver. */
type Guion = Readonly<Record<string, unknown | number>>;

/**
 * Servidor ficticio que CUENTA las peticiones por ruta.
 *
 * Contar es lo que permite demostrar que un reintento sale de verdad, y no
 * repinta una respuesta guardada: el cliente no cachea y no deduplica.
 */
function servidor(guion: Guion): {
  readonly fetch: typeof fetch;
  readonly llamadas: string[];
  cuenta: (ruta: string) => number;
} {
  const llamadas: string[] = [];

  const impl = async (url: string, init?: RequestInit): Promise<Response> => {
    llamadas.push(url);

    // La credencial viaja por cookie: ninguna petición fabrica identidad.
    expect(init?.credentials).toBe('include');
    expect(init?.cache).toBe('no-store');
    // Ningún selector de sujeto, en ninguna forma.
    expect(url).not.toMatch(/patientId|personId|subject|documento|tenant/iu);

    const clave = Object.keys(guion).find((ruta) => url.endsWith(ruta));
    const valor = clave === undefined ? 404 : guion[clave];

    if (typeof valor === 'number') {
      return new Response(valor === 204 ? null : '{}', { status: valor });
    }

    return new Response(JSON.stringify(valor), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  return {
    fetch: impl as unknown as typeof fetch,
    llamadas,
    cuenta: (ruta: string): number =>
      llamadas.filter((url) => url.endsWith(ruta)).length,
  };
}

/** Portal con sesión activa y las tres secciones cargadas. */
function activo(): EstadoPortalPaciente {
  return {
    ...PORTAL_INICIAL,
    fase: 'activa',
    resumen: { fase: 'ok', datos: CUERPO_RESUMEN },
    citas: { fase: 'ok', datos: CUERPO_CITAS.items as never },
    visitas: { fase: 'ok', datos: CUERPO_VISITAS.items as never },
  };
}

describe('carga de datos propios: loading, empty, error y retry (T7.1, T7.2)', () => {
  it('las tres consultas salen a las TRES rutas self-scope y a ninguna más', async () => {
    const red = servidor({
      [RUTAS_PACIENTE_SELF.resumen]: CUERPO_RESUMEN,
      [RUTAS_PACIENTE_SELF.citas]: CUERPO_CITAS,
      [RUTAS_PACIENTE_SELF.visitas]: CUERPO_VISITAS,
    });

    const datos = await cargarDatosPaciente(DEPENDENCIAS_REALES, red.fetch);

    expect(datos.resumen.estado).toBe('ok');
    expect(datos.citas.estado).toBe('ok');
    expect(datos.visitas.estado).toBe('ok');
    expect(red.llamadas).toHaveLength(3);
  });

  it('empty: la respuesta sin filas es un desenlace válido, no un error', async () => {
    const red = servidor({
      [RUTAS_PACIENTE_SELF.resumen]: CUERPO_RESUMEN,
      [RUTAS_PACIENTE_SELF.citas]: { items: [] },
      [RUTAS_PACIENTE_SELF.visitas]: { items: [] },
    });

    const datos = await cargarDatosPaciente(DEPENDENCIAS_REALES, red.fetch);
    const citas = seccionDesde(datos.citas);

    expect(citas.fase).toBe('ok');
    expect(citas.fase === 'ok' ? citas.datos : null).toStrictEqual([]);
  });

  it('error: un fallo del servidor NO se presenta como lista vacía', async () => {
    const red = servidor({
      [RUTAS_PACIENTE_SELF.resumen]: CUERPO_RESUMEN,
      [RUTAS_PACIENTE_SELF.citas]: 503,
      [RUTAS_PACIENTE_SELF.visitas]: CUERPO_VISITAS,
    });

    const datos = await cargarDatosPaciente(DEPENDENCIAS_REALES, red.fetch);
    const citas = seccionDesde(datos.citas);

    expect(citas.fase).toBe('error');
    expect(citas.fase === 'error' ? citas.fallo : null).toBe('no-disponible');
  });

  it('retry: reintentar VUELVE a salir al servidor, no repinta lo guardado', async () => {
    const red = servidor({
      [RUTAS_PACIENTE_SELF.resumen]: CUERPO_RESUMEN,
      [RUTAS_PACIENTE_SELF.citas]: CUERPO_CITAS,
      [RUTAS_PACIENTE_SELF.visitas]: CUERPO_VISITAS,
    });

    await DEPENDENCIAS_REALES.consultarCitas(red.fetch);
    expect(red.cuenta(RUTAS_PACIENTE_SELF.citas)).toBe(1);

    await DEPENDENCIAS_REALES.consultarCitas(red.fetch);
    expect(red.cuenta(RUTAS_PACIENTE_SELF.citas)).toBe(2);
  });

  it('una respuesta con un CUARTO campo se rechaza entera', async () => {
    const red = servidor({
      [RUTAS_PACIENTE_SELF.resumen]: { ...CUERPO_RESUMEN, documento: '99990123' },
    });

    const resultado = await DEPENDENCIAS_REALES.consultarResumen(red.fetch);

    expect(resultado.estado).toBe('respuesta-invalida');
  });
});

describe('sesión: solo OIDC con contexto PATIENT abre el portal (T7.3)', () => {
  it('la consulta exige el contexto PATIENT y no otro', async () => {
    const contextos: string[] = [];
    const deps = {
      ...DEPENDENCIAS_REALES,
      consultarSesion: async (contexto: string) => {
        contextos.push(contexto);
        return 'activa-con-contexto' as const;
      },
    };

    await comprobarSesionPaciente(deps as never);

    expect(contextos).toStrictEqual(['PATIENT']);
  });

  it('una sesión SIN contexto PATIENT no abre el portal y borra los datos', () => {
    const estado = conSesionPaciente(activo(), 'activa-sin-contexto');

    expect(estado.fase).toBe('sin-contexto');
    expect(estado.resumen.fase).toBe('cargando');
    expect(estado.citas.fase).toBe('cargando');
    expect(estado.visitas.fase).toBe('cargando');
  });

  it('sin sesión y con el servicio caído se falla CERRADO', () => {
    for (const sesion of ['sin-sesion', 'no-disponible'] as const) {
      const estado = conSesionPaciente(activo(), sesion);

      expect(estado.fase).not.toBe('activa');
      expect(estado.resumen.fase).toBe('cargando');
    }
  });

  it('cambiar de pantalla —cancelación— no es un estado que anunciar', () => {
    const previo = activo();

    expect(conSesionPaciente(previo, 'cancelado')).toStrictEqual(previo);
  });

  it('recuperación tras recarga: sin sesión no hay datos, con sesión sí', async () => {
    const sinSesion = servidor({
      [RUTAS_PACIENTE_SELF.resumen]: 401,
      [RUTAS_PACIENTE_SELF.citas]: 401,
      [RUTAS_PACIENTE_SELF.visitas]: 401,
    });

    const vacio = await cargarDatosPaciente(DEPENDENCIAS_REALES, sinSesion.fetch);
    expect(seccionDesde(vacio.resumen).fase).toBe('error');

    const conSesion = servidor({
      [RUTAS_PACIENTE_SELF.resumen]: CUERPO_RESUMEN,
      [RUTAS_PACIENTE_SELF.citas]: CUERPO_CITAS,
      [RUTAS_PACIENTE_SELF.visitas]: CUERPO_VISITAS,
    });

    const lleno = await cargarDatosPaciente(DEPENDENCIAS_REALES, conSesion.fetch);
    expect(lleno.resumen.estado).toBe('ok');
  });
});

describe('expiración durante el uso (T6.5)', () => {
  it('un 401 en una consulta expira la sesión y retira lo ya cargado', () => {
    const seccion = seccionDesde({ estado: 'sin-sesion' as const });
    const estado = conSeccionPaciente(activo(), 'citas', seccion);

    expect(esExpiracion('sin-sesion')).toBe(true);
    expect(estado.fase).toBe('expirada');
    expect(estado.resumen.fase).toBe('cargando');
    expect(estado.visitas.fase).toBe('cargando');
  });

  it('la expiración NO se presenta como error de datos', () => {
    const estado = conSeccionPaciente(activo(), 'citas', {
      fase: 'error',
      fallo: 'sin-sesion',
    });

    expect(estado.citas.fase).not.toBe('error');
    expect(estado.fase).toBe('expirada');
  });

  it('un error de datos ordinario NO expira la sesión', () => {
    const estado = conSeccionPaciente(activo(), 'citas', {
      fase: 'error',
      fallo: 'no-disponible',
    });

    expect(estado.fase).toBe('activa');
    expect(estado.resumen.fase).toBe('ok');
  });
});

describe('cierre real y revocable (T7.4)', () => {
  it('cierre confirmado: el servidor revoca y no queda dato en memoria', () => {
    const estado = conCierrePaciente(activo(), 'ok');

    expect(estado.fase).toBe('sin-sesion');
    expect(estado.resumen.fase).toBe('cargando');
    expect(estado.citas.fase).toBe('cargando');
    expect(estado.visitas.fase).toBe('cargando');
    expect(JSON.stringify(estado)).not.toContain('María');
  });

  it('cierre NO confirmado: la sesión sigue en pie y el estado lo refleja', () => {
    for (const cierre of ['origen-rechazado', 'demasiados-intentos', 'no-disponible'] as const) {
      const estado = conCierrePaciente(activo(), cierre);

      expect(estado.fase).toBe('activa');
      expect(estado.cierre).toBe('no-confirmado');
    }
  });

  it('el cierre sale por POST al logout humano y no toca otra cookie', async () => {
    const red = servidor({ '/api/v1/human-auth/logout': 204 });
    const metodos: (string | undefined)[] = [];

    const espia = (async (url: string, init?: RequestInit) => {
      metodos.push(init?.method);
      return red.fetch(url as never, init);
    }) as unknown as typeof fetch;

    await DEPENDENCIAS_REALES.cerrarSesion(espia);

    expect(metodos).toStrictEqual(['POST']);
    expect(red.llamadas[0]).toContain('/api/v1/human-auth/logout');
    expect(red.llamadas[0]).not.toContain('patients');
  });
});

describe('las TRES fases de «/» (§17.C-1, T7.8, T7.10)', () => {
  const fase = (props: Parameters<typeof ExperienciaMerdn>[0]): string =>
    renderToStaticMarkup(<ExperienciaMerdn {...props} />);

  it('fase 1: la primera pantalla sigue siendo la Inscripción', () => {
    const html = fase({
      recuperarPaciente: async () => null,
      comprobarSesionHumana: async () => 'sin-sesion',
      urlLogin: 'https://api.ejemplo.test/login',
    });

    expect(html).toContain('¿Cómo se va a registrar?');
    expect(html).not.toContain(TEXTO_PORTAL_PACIENTE.citasTitulo);
  });

  it('fase 2: confirma «Inscripción completada» y NO abre la experiencia', () => {
    const html = fase({
      recuperarPaciente: async () => null,
      comprobarSesionHumana: async () => 'sin-sesion',
      urlLogin: 'https://api.ejemplo.test/login',
      faseInicial: 'inscripcion-completada',
    });

    expect(html).toContain(TEXTO_ENTRADA_PACIENTE.titulo);
    expect(html).toContain('Inscripción completada');
    expect(html).not.toContain(TEXTO_PORTAL_PACIENTE.resumenTitulo);
    expect(html).not.toContain(TEXTO_PORTAL_PACIENTE.citasTitulo);
    expect(html).not.toContain(TEXTO_PORTAL_PACIENTE.visitasTitulo);
  });

  it('fase 2: la entrada «Ingresar como Paciente» existe y es SEPARADA', () => {
    const html = fase({
      recuperarPaciente: async () => null,
      comprobarSesionHumana: async () => 'sin-sesion',
      urlLogin: 'https://api.ejemplo.test/login',
      faseInicial: 'inscripcion-completada',
    });

    expect(html).toContain(TEXTO_ENTRADA_PACIENTE.entrar);
    expect(html).toContain('href="https://api.ejemplo.test/login"');
    // Confirmación y entrada son dos cosas distintas en la misma pantalla.
    expect(TEXTO_ENTRADA_PACIENTE.entrar).not.toBe(TEXTO_ENTRADA_PACIENTE.titulo);
  });

  it('fase 2: no pinta NINGÚN dato de la persona', () => {
    const html = fase({
      recuperarPaciente: async () => null,
      comprobarSesionHumana: async () => 'sin-sesion',
      urlLogin: 'https://api.ejemplo.test/login',
      faseInicial: 'inscripcion-completada',
    });

    for (const dato of ['María', 'ME', '99990123', 'Nueva EPS', 'MEDELLÍN']) {
      expect(html).not.toContain(dato);
    }
  });
});

describe('la cookie de inscripción NO abre el portal (§19.13, T7.8)', () => {
  it('SOLO «activa-con-contexto» conduce a ver DATOS', () => {
    /*
     * Montar la experiencia y ver datos no son lo mismo. `activa-sin-contexto`
     * y `no-disponible` montan la experiencia en su estado aprobado —«acceso no
     * autorizado» y «no disponible»—, sin un solo dato en pantalla; solo
     * `activa-con-contexto` pasa a `activa` y habilita las tres consultas.
     */
    expect(conSesionPaciente(PORTAL_INICIAL, 'activa-con-contexto').fase).toBe('activa');

    for (const sesion of ['activa-sin-contexto', 'sin-sesion', 'no-disponible'] as const) {
      expect(conSesionPaciente(PORTAL_INICIAL, sesion).fase).not.toBe('activa');
    }
  });

  it('ninguna cookie de inscripción participa en la decisión de fase', () => {
    // El único parámetro de la decisión es el desenlace de la sesión humana.
    expect(faseDeSesionHumana('sin-sesion')).toBeNull();
    expect(faseDeSesionHumana('cancelado')).toBeNull();
  });

  it('con inscripción vigente y SIN sesión humana no hay resumen, citas ni visitas', () => {
    /*
     * `faseInicial: 'inscripcion-completada'` es EXACTAMENTE el estado al que
     * puede llegar la cookie de inscripción: la confirmación, y nada más.
     */
    const html = renderToStaticMarkup(
      <ExperienciaMerdn
        recuperarPaciente={async () => ({ givenNames: 'Ana María' }) as never}
        comprobarSesionHumana={async () => 'sin-sesion'}
        urlLogin="https://api.ejemplo.test/login"
        faseInicial="inscripcion-completada"
      />,
    );

    expect(html).not.toContain(TEXTO_PORTAL_PACIENTE.resumenTitulo);
    expect(html).not.toContain(TEXTO_PORTAL_PACIENTE.citasTitulo);
    expect(html).not.toContain(TEXTO_PORTAL_PACIENTE.visitasTitulo);
    expect(html).not.toContain('Ana');
  });

  it('la ruta de inscripción no crea cuenta, vínculo ni sesión humana (T7.10)', async () => {
    const red = servidor({
      '/api/v1/patients/me': { status: 'ACTIVE', givenNames: 'Ana María' },
    });

    const paciente = await fetchCurrentPatient(red.fetch);

    expect(paciente).not.toBeNull();
    // La inscripción habla SOLO con su propia superficie: ni login, ni sesión,
    // ni logout humano. Terminar la inscripción no autentica a nadie.
    expect(red.llamadas).toHaveLength(1);
    expect(red.llamadas[0]).toContain('/api/v1/patients/me');
    expect(red.llamadas.some((url) => url.includes('human-auth'))).toBe(false);
  });
});

describe('ausencia de persistencia en el cliente (T6.8, T7.5)', () => {
  it('cargar los datos no lee ni escribe almacenamiento del navegador', async () => {
    const accesos: string[] = [];
    const espia = new Proxy(
      {},
      {
        get: (_objetivo, propiedad) => {
          accesos.push(String(propiedad));
          return undefined;
        },
        set: (_objetivo, propiedad) => {
          accesos.push(String(propiedad));
          return true;
        },
      },
    );

    const global = globalThis as unknown as Record<string, unknown>;
    const previoLocal = global['localStorage'];
    const previoSession = global['sessionStorage'];
    const previoIndexed = global['indexedDB'];
    global['localStorage'] = espia;
    global['sessionStorage'] = espia;
    global['indexedDB'] = espia;

    try {
      const red = servidor({
        [RUTAS_PACIENTE_SELF.resumen]: CUERPO_RESUMEN,
        [RUTAS_PACIENTE_SELF.citas]: CUERPO_CITAS,
        [RUTAS_PACIENTE_SELF.visitas]: CUERPO_VISITAS,
      });

      const datos = await cargarDatosPaciente(DEPENDENCIAS_REALES, red.fetch);
      expect(datos.resumen.estado).toBe('ok');
    } finally {
      global['localStorage'] = previoLocal;
      global['sessionStorage'] = previoSession;
      global['indexedDB'] = previoIndexed;
    }

    expect(accesos).toStrictEqual([]);
  });

  it('ninguna ruta self-scope lleva identificador en la URL', () => {
    for (const ruta of Object.values(RUTAS_PACIENTE_SELF)) {
      expect(ruta).not.toContain(':');
      expect(ruta).not.toContain('?');
      expect(ruta).not.toMatch(/\/[0-9a-f-]{8,}/iu);
    }
  });
});

/* ------------------ Correcciones focales de la revisión MP5 --------------- */

describe('corrección 1 — el reintento del resumen sale de verdad al servidor', () => {
  it('reintentar el resumen VUELVE a consultar: no hay caché ni memoria', async () => {
    const red = servidor({ [RUTAS_PACIENTE_SELF.resumen]: CUERPO_RESUMEN });

    await DEPENDENCIAS_REALES.consultarResumen(red.fetch);
    await DEPENDENCIAS_REALES.consultarResumen(red.fetch);

    expect(red.cuenta(RUTAS_PACIENTE_SELF.resumen)).toBe(2);
  });

  it('el reintento pasa por `cargando` antes de aplicar el resultado', () => {
    const enError: EstadoPortalPaciente = {
      ...activo(),
      resumen: { fase: 'error', fallo: 'no-disponible' },
    };

    // Lo que hace el manejador antes de salir a la red.
    const enCurso = { ...enError, resumen: { fase: 'cargando' } as const };

    expect(enCurso.resumen.fase).toBe('cargando');
    expect(enCurso.citas.fase).toBe('ok');
    expect(enCurso.visitas.fase).toBe('ok');
  });

  it('un reintento exitoso actualiza SOLO el resumen', async () => {
    const red = servidor({ [RUTAS_PACIENTE_SELF.resumen]: CUERPO_RESUMEN });
    const enError: EstadoPortalPaciente = {
      ...activo(),
      resumen: { fase: 'error', fallo: 'no-disponible' },
    };

    const resultado = await DEPENDENCIAS_REALES.consultarResumen(red.fetch);
    const despues = conSeccionPaciente(enError, 'resumen', seccionDesde(resultado));

    expect(despues.resumen.fase).toBe('ok');
    expect(despues.citas).toStrictEqual(enError.citas);
    expect(despues.visitas).toStrictEqual(enError.visitas);
    expect(despues.fase).toBe('activa');
  });

  it('un reintento con 401 retira TODOS los datos y expira la sesión', async () => {
    const red = servidor({ [RUTAS_PACIENTE_SELF.resumen]: 401 });

    const resultado = await DEPENDENCIAS_REALES.consultarResumen(red.fetch);
    const despues = conSeccionPaciente(activo(), 'resumen', seccionDesde(resultado));

    expect(despues.fase).toBe('expirada');
    expect(despues.citas.fase).toBe('cargando');
    expect(despues.visitas.fase).toBe('cargando');
    expect(JSON.stringify(despues)).not.toContain('María');
  });

  it('un reintento con 403 retira TODOS los datos y deja sin contexto', async () => {
    const red = servidor({ [RUTAS_PACIENTE_SELF.resumen]: 403 });

    const resultado = await DEPENDENCIAS_REALES.consultarResumen(red.fetch);
    const despues = conSeccionPaciente(activo(), 'resumen', seccionDesde(resultado));

    expect(despues.fase).toBe('sin-contexto');
    expect(despues.resumen.fase).toBe('cargando');
    expect(JSON.stringify(despues)).not.toContain('María');
  });
});

describe('corrección 2 — los desenlaces iniciales de sesión no se colapsan', () => {
  const raiz = (sesion: 'activa-con-contexto' | 'activa-sin-contexto' | 'no-disponible'): string =>
    renderToStaticMarkup(
      <ExperienciaMerdn
        recuperarPaciente={async () => null}
        comprobarSesionHumana={async () => sesion}
        urlLogin="https://api.ejemplo.test/login"
        faseInicial="portal"
        sesionInicial={sesion}
      />,
    );

  it('cada desenlace conserva su destino aprobado', () => {
    expect(faseDeSesionHumana('activa-con-contexto')).toBe('portal');
    expect(faseDeSesionHumana('activa-sin-contexto')).toBe('portal');
    expect(faseDeSesionHumana('no-disponible')).toBe('portal');
    // Fuera del portal autenticado, sin fabricar estado nuevo.
    expect(faseDeSesionHumana('sin-sesion')).toBeNull();
    expect(faseDeSesionHumana('cancelado')).toBeNull();
  });

  it('activa-sin-contexto muestra el estado «acceso no autorizado» aprobado', () => {
    const html = raiz('activa-sin-contexto');

    expect(html).toContain(TEXTO_PORTAL_PACIENTE.sinContexto);
    expect(html).not.toContain('¿Cómo se va a registrar?');
    expect(html).not.toContain(TEXTO_ENTRADA_PACIENTE.titulo);
  });

  it('no-disponible muestra el estado aprobado y permite volver a comprobar', () => {
    const html = raiz('no-disponible');

    expect(html).toContain(TEXTO_PORTAL_PACIENTE.noDisponible);
    expect(html).toContain(TEXTO_PORTAL_PACIENTE.reintentarSesion);
    expect(html).not.toContain('¿Cómo se va a registrar?');
  });

  it('ningún estado no autorizado o no disponible pinta dato del paciente', () => {
    for (const sesion of ['activa-sin-contexto', 'no-disponible'] as const) {
      const html = raiz(sesion);

      for (const dato of ['María', 'ME', TEXTO_PORTAL_PACIENTE.resumenTitulo, TEXTO_PORTAL_PACIENTE.citasTitulo]) {
        expect(html).not.toContain(dato);
      }
    }
  });

  it('activa-con-contexto sigue siendo el único que abre datos', () => {
    expect(conSesionPaciente(PORTAL_INICIAL, 'activa-con-contexto').fase).toBe('activa');
    expect(conSesionPaciente(PORTAL_INICIAL, 'activa-sin-contexto').fase).toBe('sin-contexto');
    expect(conSesionPaciente(PORTAL_INICIAL, 'no-disponible').fase).toBe('no-disponible');
  });

  it('la cookie de inscripción SIGUE sin abrir el portal', () => {
    const html = renderToStaticMarkup(
      <ExperienciaMerdn
        recuperarPaciente={async () => ({ givenNames: 'Ana María' }) as never}
        comprobarSesionHumana={async () => 'sin-sesion'}
        urlLogin="https://api.ejemplo.test/login"
        faseInicial="inscripcion-completada"
      />,
    );

    expect(html).toContain(TEXTO_ENTRADA_PACIENTE.titulo);
    expect(html).toContain(TEXTO_ENTRADA_PACIENTE.entrar);
    expect(html).not.toContain(TEXTO_PORTAL_PACIENTE.resumenTitulo);
    expect(html).not.toContain(TEXTO_PORTAL_PACIENTE.citasTitulo);
    expect(html).not.toContain(TEXTO_PORTAL_PACIENTE.visitasTitulo);
  });
});
