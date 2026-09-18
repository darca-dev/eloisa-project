import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { BITACORA_INICIAL, TOTAL_ETAPAS, bitacoraReducer } from './bitacoraFlow';
import type { BitacoraAction, BitacoraState } from './bitacoraFlow';
import { BitacoraPaciente } from './BitacoraPaciente';
import { InicioPaciente } from './InicioPaciente';
import {
  ETIQUETA_PACIENTE,
  PORTAL_INICIAL,
  PortalPacienteVista,
  TEXTO_PORTAL_PACIENTE,
  conCierrePaciente,
  filaDeCita,
  mensajeDeCarga,
  mensajeDeFallo,
  mensajeDeFase,
  portalSinDatos,
} from './PacienteExperience';
import type { EstadoPortalPaciente } from './PacienteExperience';
import type {
  CitaPacienteView,
  ResumenPacienteView,
  VisitaPacienteView,
} from './pacienteSelfClient';

function inicio(): string {
  return renderToStaticMarkup(
    <InicioPaciente
      nombre="María"
      iniciales="MR"
      avisoId="aviso"
      onAbrirBitacora={() => {}}
    />,
  );
}

function bitacora(acciones: readonly BitacoraAction[]): string {
  const state: BitacoraState = acciones.reduce(bitacoraReducer, BITACORA_INICIAL);
  return renderToStaticMarkup(
    <BitacoraPaciente state={state} dispatch={() => {}} onVolverAlInicio={() => {}} />,
  );
}

describe('Inicio del Paciente: iconos semánticos (FR-07)', () => {
  it('conserva las cinco tarjetas aprobadas', () => {
    const html = inicio();

    for (const titulo of [
      'MIS CITAS',
      'PEDIR AYUDA',
      'MI SALUD',
      'MI CUIDADOR',
      'MIS PAGOS',
    ]) {
      expect(html).toContain(titulo);
    }
  });

  it('cada tarjeta dibuja un icono real y no un cuadrado de color', () => {
    const html = inicio();
    const contenedores = html.match(/class="[^"]*_tileIcon_[^"]*"/gu) ?? [];
    const iconos = html.match(/<svg[^>]*viewBox="0 0 24 24"/gu) ?? [];

    expect(contenedores.length).toBe(5);
    // Cinco tarjetas más el acceso a la bitácora, los accesos rápidos y las pestañas.
    expect(iconos.length).toBeGreaterThanOrEqual(5);
    expect(html).toContain('aria-hidden="true"');
  });

  it('la IA no es una tarjeta del tablero', () => {
    const html = inicio();

    expect(html).not.toContain('ASISTENTE IA');
    expect(html).not.toContain('Pregúntame lo que necesites');
    expect(html).not.toContain('/eli/motiva.png');
  });

  it('ofrece el acceso a la bitácora sin exigirla', () => {
    const html = inicio();

    expect(html).toContain('Mi bitácora');
    expect(html).toContain('Ocho preguntas sencillas sobre cómo pasó el día.');
  });

  it('las tarjetas no simulan módulos productivos', () => {
    const html = inicio();

    expect(html).toContain('aria-disabled="true"');
    expect(html).toContain('aria-describedby="aviso"');
  });
});

describe('bitácora completa de ocho etapas (FR-05)', () => {
  it('la portada explica que no forma parte de la inscripción', () => {
    const html = bitacora([]);

    expect(html).toContain('Mi bitácora');
    expect(html).toContain('La bitácora no forma parte de la inscripción');
    expect(html).toContain('Empezar la bitácora de hoy');
  });

  it('cada etapa anuncia su propio progreso «Paso X de 8»', () => {
    let acciones: BitacoraAction[] = [{ type: 'empezar' }];

    for (let etapa = 1; etapa <= TOTAL_ETAPAS; etapa += 1) {
      const html = bitacora(acciones);
      expect(html).toContain(`Paso ${etapa} de ${TOTAL_ETAPAS}`);
      expect(html).not.toContain('de 5');
      acciones = [...acciones, { type: 'siguiente' }];
    }
  });

  it('presenta las ocho etapas en el orden aprobado', () => {
    const titulos = [
      '¿Cómo se siente comparado con ayer?',
      'Signos vitales',
      '¿Comió normalmente?',
      '¿Tomó sus medicamentos?',
      'Su higiene y cuidado de hoy',
      'Su movilización de hoy',
      '¿Le ocurrió algo importante hoy?',
      'Revise su registro',
    ];

    titulos.forEach((titulo, indice) => {
      const acciones: BitacoraAction[] = [{ type: 'empezar' }];
      for (let salto = 0; salto < indice; salto += 1) {
        acciones.push({ type: 'siguiente' });
      }
      expect(bitacora(acciones)).toContain(titulo);
    });
  });

  it('no emite rangos, alertas ni conclusiones clínicas en signos vitales', () => {
    const html = bitacora([{ type: 'empezar' }, { type: 'siguiente' }]);

    expect(html).toContain('no evalúa rangos, no genera alertas');
    expect(html).not.toContain('semáforo');
    expect(html).not.toContain('Fuera de rango');
  });

  it('la etapa 8 revisa, pide autorización y cierra en local', () => {
    const enOcho: BitacoraAction[] = [{ type: 'empezar' }];
    for (let salto = 1; salto < TOTAL_ETAPAS; salto += 1) {
      enOcho.push({ type: 'siguiente' });
    }

    const html = bitacora(enOcho);
    expect(html).toContain('Revise su registro');
    expect(html).toContain('Terminar la bitácora');

    const confirmada = bitacora([
      ...enOcho,
      { type: 'actualizar', patch: { autorizaDatos: true } },
      { type: 'guardar' },
    ]);
    expect(confirmada).toContain('Bitácora completada');
    expect(confirmada).toContain('nada se guardó');
  });

  it('no muestra historial ni pacientes demostrativos del portal completo', () => {
    const html = bitacora([{ type: 'empezar' }]);

    expect(html).not.toContain('HISTORIAL');
    expect(html).not.toContain('Rodríguez');
    expect(html).not.toContain('ELI-4827');
  });
});

/* ========================================================================== */
/* Portal operativo del Paciente (spec 021, micro-paquete 5)                  */
/* ========================================================================== */

/*
 * Las pruebas de arriba se conservan A PROPÓSITO: demuestran que el código de
 * las capacidades fuera del MVP —`InicioPaciente`, `BitacoraPaciente` y
 * `bitacoraFlow`— sigue INTACTO en el repositorio. Ocultar es dejar de
 * montarlo, no borrarlo (§6.16, §19.11). Lo que cambia es que el portal
 * operativo ya no las monta, y eso es lo que comprueban las de abajo.
 */

const RESUMEN: ResumenPacienteView = {
  givenName: 'María',
  initials: 'ME',
  label: ETIQUETA_PACIENTE,
};

const CITAS: readonly CitaPacienteView[] = [
  { scheduledStart: '2026-09-03T14:30:00.000Z', modality: 'ON_SITE', status: 'ASSIGNED' },
];

const VISITAS: readonly VisitaPacienteView[] = [
  { scheduledStart: '2026-08-20T13:00:00.000Z', modality: 'HOME', status: 'COMPLETED' },
];

/** Render del portal en un estado concreto. La vista es pura: no consulta. */
function portal(estado: EstadoPortalPaciente): string {
  return renderToStaticMarkup(
    <PortalPacienteVista
      estado={estado}
      urlLogin="https://api.ejemplo.test/api/v1/human-auth/login?returnTo=/"
      onComprobar={() => {}}
      onReintentarResumen={() => {}}
      onReintentarCitas={() => {}}
      onReintentarVisitas={() => {}}
      onCerrar={() => {}}
    />,
  );
}

/** Elemento React visto como par tipo/props, sin comprometerse con nada más. */
interface ElementoVisto {
  readonly type: unknown;
  readonly props: Readonly<Record<string, unknown>>;
}

function comoElemento(nodo: unknown): ElementoVisto | null {
  if (typeof nodo !== 'object' || nodo === null) {
    return null;
  }

  const candidato = nodo as { type?: unknown; props?: Record<string, unknown> };

  return candidato.type === undefined || candidato.props === undefined
    ? null
    : { type: candidato.type, props: candidato.props };
}

/**
 * Recorre el árbol EJECUTANDO los componentes función.
 *
 * Es lo que permite comprobar que un control está enlazado a su acción sin
 * jsdom y sin librería de testing: se localiza el `button` real y se activa su
 * manejador, en vez de dar por bueno que el `onClick` llegó.
 */
function* nodos(nodo: unknown): Generator<ElementoVisto> {
  if (Array.isArray(nodo)) {
    for (const hijo of nodo) {
      yield* nodos(hijo);
    }
    return;
  }

  const elemento = comoElemento(nodo);

  if (elemento === null) {
    return;
  }

  yield elemento;

  if (typeof elemento.type === 'function') {
    const componente = elemento.type as (props: unknown) => unknown;
    yield* nodos(componente(elemento.props));
    return;
  }

  yield* nodos(elemento.props['children']);
}

/** Manejador del primer botón dentro de la sección con ese encabezado. */
function botonDeReintento(arbol: unknown, tituloId: string): (() => void) | null {
  for (const elemento of nodos(arbol)) {
    if (elemento.type !== 'section' || elemento.props['aria-labelledby'] !== tituloId) {
      continue;
    }

    for (const dentro of nodos(elemento.props['children'])) {
      const manejador = dentro.props['onClick'];

      if (dentro.type === 'button' && typeof manejador === 'function') {
        return manejador as () => void;
      }
    }
  }

  return null;
}

/** Portal con sesión activa y las tres secciones en un estado dado. */
function activo(parcial: Partial<EstadoPortalPaciente> = {}): EstadoPortalPaciente {
  return {
    ...PORTAL_INICIAL,
    fase: 'activa',
    resumen: { fase: 'ok', datos: RESUMEN },
    citas: { fase: 'ok', datos: CITAS },
    visitas: { fase: 'ok', datos: VISITAS },
    ...parcial,
  };
}

describe('resumen del Paciente: lista CERRADA de tres campos (§6.7, §17.C-2)', () => {
  it('el conjunto de campos es EXACTAMENTE tres, por igualdad de conjunto', () => {
    /*
     * Igualdad, no inclusión: un cuarto campo hace fallar esta aserción, que es
     * exactamente lo que §19.12 exige que ocurra.
     */
    expect(new Set(Object.keys(RESUMEN))).toStrictEqual(
      new Set(['givenName', 'initials', 'label']),
    );
    expect(Object.keys(RESUMEN)).toHaveLength(3);
  });

  it('un cuarto campo rompe la igualdad de conjunto', () => {
    const conCuarto = { ...RESUMEN, documento: '99990123' };

    expect(new Set(Object.keys(conCuarto))).not.toStrictEqual(
      new Set(['givenName', 'initials', 'label']),
    );
  });

  it('pinta los tres campos permitidos y la etiqueta es FIJA', () => {
    const html = portal(activo());

    expect(html).toContain('María');
    expect(html).toContain('ME');
    expect(html).toContain(ETIQUETA_PACIENTE);
    expect(ETIQUETA_PACIENTE).toBe('Paciente');
  });

  it('no pinta documento, nacimiento, sexo, EPS, territorio ni clínica', () => {
    const html = portal(activo());

    for (const prohibido of [
      '99990123',
      'Cédula',
      '1958-04-12',
      'Femenino',
      'Nueva EPS',
      'NUEVA_EPS',
      'MEDELLÍN',
      'ANTIOQUIA',
      'diagnóstic',
      'Diagnóstic',
      'patientId',
      'tenantId',
      'careAssignmentId',
    ]) {
      expect(html).not.toContain(prohibido);
    }
  });
});

describe('los SEIS estados son observables y distinguibles (§6.12, §6.13)', () => {
  it('loading: comprobando la sesión, sin pintar dato alguno', () => {
    const html = portal(PORTAL_INICIAL);

    expect(html).toContain(TEXTO_PORTAL_PACIENTE.comprobando);
    expect(html).not.toContain('María');
    expect(html).not.toContain(TEXTO_PORTAL_PACIENTE.citasTitulo);
  });

  it('loading: secciones en curso con la sesión ya activa', () => {
    const html = portal(
      activo({
        resumen: { fase: 'cargando' },
        citas: { fase: 'cargando' },
        visitas: { fase: 'cargando' },
      }),
    );

    expect(html).toContain(TEXTO_PORTAL_PACIENTE.cargando);
    expect(html).not.toContain('María');
  });

  it('empty: la consulta respondió y no hay filas', () => {
    const html = portal(
      activo({ citas: { fase: 'ok', datos: [] }, visitas: { fase: 'ok', datos: [] } }),
    );

    expect(html).toContain(TEXTO_PORTAL_PACIENTE.citasVacio);
    expect(html).toContain(TEXTO_PORTAL_PACIENTE.visitasVacio);
    expect(html).not.toContain(TEXTO_PORTAL_PACIENTE.errorDatos);
  });

  it('error: es distinto de vacío y NUNCA se presenta como «no tiene citas»', () => {
    const html = portal(activo({ citas: { fase: 'error', fallo: 'no-disponible' } }));

    expect(html).toContain(TEXTO_PORTAL_PACIENTE.errorDatos);
    expect(html).not.toContain(TEXTO_PORTAL_PACIENTE.citasVacio);
  });

  it('retry: el error ofrece un control de reintento operable', () => {
    const html = portal(activo({ citas: { fase: 'error', fallo: 'no-disponible' } }));

    expect(html).toContain(TEXTO_PORTAL_PACIENTE.reintentar);
    expect(html).toContain('<button');
  });

  it('sesión expirada: no hay dato en pantalla y se ofrece volver a entrar', () => {
    const html = portal(portalSinDatos('expirada'));

    expect(html).toContain(TEXTO_PORTAL_PACIENTE.expirada);
    expect(html).toContain(TEXTO_PORTAL_PACIENTE.volverAEntrar);
    expect(html).not.toContain('María');
    expect(html).not.toContain(TEXTO_PORTAL_PACIENTE.errorDatos);
  });

  it('acceso no autorizado: sin dato y sin revelar si existe un paciente', () => {
    const html = portal(portalSinDatos('sin-contexto'));

    expect(html).toContain(TEXTO_PORTAL_PACIENTE.sinContexto);
    expect(html).not.toContain('María');
    expect(html).not.toContain(TEXTO_PORTAL_PACIENTE.citasTitulo);
  });

  it('los seis mensajes de fase son distintos entre sí', () => {
    const mensajes = (
      ['comprobando', 'activa', 'sin-sesion', 'sin-contexto', 'expirada', 'no-disponible'] as const
    ).map((fase) => mensajeDeFase(portalSinDatos(fase)));

    expect(new Set(mensajes).size).toBe(6);
  });
});

describe('citas y visitas propias, sin identificador ni tercero (§6.8, §6.9)', () => {
  it('muestra las citas propias con fecha, modalidad y estado en palabras', () => {
    const html = portal(activo());

    expect(html).toContain(TEXTO_PORTAL_PACIENTE.citasTitulo);
    expect(html).toContain('Presencial');
    expect(html).toContain('Asignada');
    expect(html).toContain('2026');
  });

  it('muestra las visitas propias con su estado en palabras', () => {
    const html = portal(activo());

    expect(html).toContain(TEXTO_PORTAL_PACIENTE.visitasTitulo);
    expect(html).toContain('En casa');
    expect(html).toContain('Realizada');
  });

  it('no pinta el código del catálogo ni ningún identificador técnico', () => {
    const html = portal(activo());

    for (const crudo of [
      'ON_SITE',
      'ASSIGNED',
      'COMPLETED',
      'appointmentId',
      'homeVisitId',
      'professional',
    ]) {
      expect(html).not.toContain(crudo);
    }
  });

  it('el estado se lee en palabras: no depende del color', () => {
    const { detalle } = filaDeCita(CITAS[0]!);

    expect(detalle).toContain('Presencial');
    expect(detalle).toContain('Asignada');
  });
});

describe('cierre de sesión sin falso éxito (§6.4 a §6.6)', () => {
  it('cierre confirmado: no queda ningún dato del paciente en pantalla', () => {
    const html = portal(conCierrePaciente(activo(), 'ok'));

    expect(html).not.toContain('María');
    expect(html).not.toContain('Presencial');
    expect(html).not.toContain(TEXTO_PORTAL_PACIENTE.citasTitulo);
    expect(html).toContain(TEXTO_PORTAL_PACIENTE.sinSesion);
  });

  it('«sin sesión» en el servidor también confirma el cierre', () => {
    expect(conCierrePaciente(activo(), 'sin-sesion').fase).toBe('sin-sesion');
  });

  it('cierre NO confirmado: lo dice, no afirma el cierre y deja reintentar', () => {
    const html = portal(conCierrePaciente(activo(), 'no-disponible'));

    expect(html).toContain(TEXTO_PORTAL_PACIENTE.cierreNoConfirmado);
    expect(html).toContain(TEXTO_PORTAL_PACIENTE.reintentarCierre);
    // La sesión SIGUE abierta: el dato sigue en pantalla porque no se cerró.
    expect(html).toContain('María');
  });

  it('ningún desenlace no confirmado se presenta como cierre', () => {
    for (const cierre of ['origen-rechazado', 'demasiados-intentos', 'no-disponible'] as const) {
      const estado = conCierrePaciente(activo(), cierre);

      expect(estado.fase).toBe('activa');
      expect(estado.cierre).toBe('no-confirmado');
      expect(portal(estado)).not.toContain(TEXTO_PORTAL_PACIENTE.sinSesion);
    }
  });

  it('el aviso de cierre fallido no se comunica solo por color', () => {
    const html = portal(conCierrePaciente(activo(), 'no-disponible'));

    expect(html).toContain(TEXTO_PORTAL_PACIENTE.aviso);
    expect(html).toContain('SIGUE ABIERTA');
  });
});

describe('superficie demostrativa OCULTA, con su código intacto (§6.15, §6.16)', () => {
  const html = portal(activo());

  it('ninguna capacidad fuera del MVP se monta en el portal operativo', () => {
    for (const fuera of [
      'PEDIR AYUDA',
      'Necesito atención urgente',
      'MI SALUD',
      'Ver mi historia clínica',
      'MI CUIDADOR',
      'MIS PAGOS',
      'Membresía',
      'Mensajes',
      'Consulta',
      'Mi bitácora',
      'bitácora',
    ]) {
      expect(html).not.toContain(fuera);
    }
  });

  it('no monta ningún control inerte: un control visible promete lo que no hay', () => {
    expect(html).not.toContain('aria-disabled="true"');
  });

  it('no monta la burbuja demostrativa ni sus recursos', () => {
    expect(html).not.toContain('/eli/');
    expect(html).not.toContain('aria-expanded');
  });

  it('el código oculto sigue en el repositorio y sigue funcionando', () => {
    // Si estos módulos se hubieran borrado, estas dos llamadas no compilarían.
    expect(inicio()).toContain('Mi bitácora');
    expect(bitacora([])).toContain('La bitácora no forma parte de la inscripción');
  });
});

describe('accesibilidad del portal (§6.17)', () => {
  it('anuncia sesión y carga por región viva polite', () => {
    const html = portal(PORTAL_INICIAL);

    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
  });

  it('cada sección tiene encabezado y nombre accesible', () => {
    const html = portal(activo());

    expect(html).toContain('aria-labelledby="paciente-portal-resumen"');
    expect(html).toContain('aria-labelledby="paciente-portal-citas"');
    expect(html).toContain('aria-labelledby="paciente-portal-visitas"');
    expect(html).toContain('<h1');
    expect(html).toContain('<h2');
  });

  it('el acceso es un enlace navegable con ayuda accesible', () => {
    const html = portal(portalSinDatos('sin-sesion'));

    expect(html).toContain('<a');
    expect(html).toContain('href="https://api.ejemplo.test/api/v1/human-auth/login?returnTo=/"');
    expect(html).toContain('aria-describedby="paciente-portal-sesion"');
  });

  it('el error de datos lleva símbolo y texto, no solo color', () => {
    const html = portal(activo({ citas: { fase: 'error', fallo: 'no-disponible' } }));

    expect(html).toContain(TEXTO_PORTAL_PACIENTE.aviso);
    expect(html).toContain(TEXTO_PORTAL_PACIENTE.errorDatos);
  });

  it('los mensajes de error no revelan códigos, rutas ni datos', () => {
    for (const fallo of [
      'sin-sesion',
      'sin-contexto',
      'demasiados-intentos',
      'no-disponible',
      'respuesta-invalida',
      'cancelado',
    ] as const) {
      const mensaje = mensajeDeFallo(fallo);

      expect(mensaje).not.toMatch(/40[13]|429|503|patient-self|http/iu);
      expect(mensaje.length).toBeGreaterThan(0);
    }
  });
});

/* ------------------ Correcciones focales de la revisión MP5 --------------- */

describe('corrección 1 — el resumen en error ofrece reintento (T-C1)', () => {
  it('muestra mensaje seguro, símbolo y control de reintento', () => {
    const html = portal(activo({ resumen: { fase: 'error', fallo: 'no-disponible' } }));

    expect(html).toContain(TEXTO_PORTAL_PACIENTE.errorDatos);
    expect(html).toContain(TEXTO_PORTAL_PACIENTE.aviso);
    expect(html).toContain(TEXTO_PORTAL_PACIENTE.reintentar);
  });

  it('el resumen en error no pinta ningún dato del paciente', () => {
    const html = portal(activo({ resumen: { fase: 'error', fallo: 'no-disponible' } }));

    expect(html).not.toContain('María');
    expect(html).not.toContain('ME');
  });

  it('el control de reintento del resumen está enlazado a su acción', () => {
    let veces = 0;

    const arbol = PortalPacienteVista({
      estado: activo({ resumen: { fase: 'error', fallo: 'no-disponible' } }),
      urlLogin: 'https://api.ejemplo.test/login',
      onComprobar: () => {},
      onReintentarResumen: () => {
        veces += 1;
      },
      onReintentarCitas: () => {},
      onReintentarVisitas: () => {},
      onCerrar: () => {},
    });

    // Se recorre el árbol y se activa el reintento del bloque del resumen.
    const boton = botonDeReintento(arbol, 'paciente-portal-resumen');
    expect(boton).not.toBeNull();
    boton?.();
    expect(veces).toBe(1);
  });
});

describe('corrección 3 — la carga se anuncia por región viva polite (T-C3)', () => {
  it('anuncia por nombre lo que está cargando', () => {
    const html = portal(
      activo({
        resumen: { fase: 'cargando' },
        citas: { fase: 'cargando' },
        visitas: { fase: 'cargando' },
      }),
    );

    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('Cargando sus datos, sus citas y sus visitas.');
  });

  it('nombra solo la sección que sigue en curso', () => {
    expect(mensajeDeCarga(activo({ citas: { fase: 'cargando' } }))).toBe(
      'Cargando sus citas.',
    );
    expect(mensajeDeCarga(activo({ visitas: { fase: 'cargando' } }))).toBe(
      'Cargando sus visitas.',
    );
    expect(mensajeDeCarga(activo({ resumen: { fase: 'cargando' } }))).toBe(
      'Cargando sus datos.',
    );
  });

  it('no anuncia nada cuando no hay carga en curso', () => {
    expect(mensajeDeCarga(activo())).toBe('');
  });

  it('usa UNA sola región viva, no una por sección', () => {
    const html = portal(activo({ citas: { fase: 'cargando' } }));

    expect(html.match(/aria-live="polite"/gu) ?? []).toHaveLength(1);
  });

  it('el anuncio convive con el estado de sesión en la misma región', () => {
    const html = portal(activo({ citas: { fase: 'cargando' } }));

    expect(html).toContain(TEXTO_PORTAL_PACIENTE.activa);
    expect(html).toContain('Cargando sus citas.');
  });
});
