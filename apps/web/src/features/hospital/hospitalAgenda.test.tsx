import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  AgendaEstado,
  AgendaSolicitud,
  HOSPITAL_AGENDA_VISITA,
  HospitalAgenda,
  esCitaMaterializable,
} from './HospitalAgenda';
import {
  HOSPITAL_AGENDA_MAX_DIAS,
  asignarCita,
  fechaCalendarioDe,
  ventanaDeEscala,
  type HospitalAgendaVistaDto,
  type HospitalCitaAgendaDto,
} from './hospitalAgendaClient';
import {
  HOSPITAL_AGENDA_SELECCION_VACIA,
  conservaSeleccion,
  hospitalAgendaCore,
  iconoDeModalidad,
  instanteDeSeleccion,
  ofreceReintentoAgenda,
  puedeAsignar,
  textoDeAsignacion,
  textoDeEstadoAgenda,
  ventanaLegible,
} from './hospitalAgendaConfig';
import { apariciones, texto } from './hospitalTestUtils';
import { RUTAS_HOSPITAL_VISITAS, materializarVisita } from './hospitalVisitsClient';

/**
 * Vista «Agenda y citas» conectada a CORE-02
 * (TASK-HOSPITAL-CORE-02 §3.2; paquete de continuación §5).
 *
 * ESTRATEGIA. Igual que en «Pacientes» y «Profesionales»: el repositorio no
 * incluye jsdom y esta Task no autoriza dependencias nuevas, de modo que
 * `renderToStaticMarkup` no ejecuta efectos. La verificación se reparte en tres
 * planos:
 *
 * 1. el CONTENEDOR se comprueba en su primer render y con el DTO inyectado por
 *    propiedad, además de por análisis de su código fuente;
 * 2. las PIEZAS y los helpers son puros: reciben DTO o valores explícitos;
 * 3. la serialización de la ventana, la cancelación, el cuerpo del `PATCH` y
 *    cada código de estado se prueban contra un `fetch` inyectado, aquí y en
 *    `hospitalAgendaClient.test.ts`.
 *
 * EL RELOJ SE INYECTA en todas estas pruebas, de modo que la fecha inicial y
 * las ventanas son deterministas y no dependen del día en que se ejecuten.
 *
 * Lo que NO queda cubierto por falta de DOM real —eventos de teclado, foco,
 * envío efectivo desde el botón y verificación automática de accesibilidad— se
 * reporta como no ejecutado en el handoff, sin darlo por aprobado.
 *
 * Todos los datos de estas pruebas son FICTICIOS.
 */

const DIRECTORIO = fileURLToPath(new URL('.', import.meta.url));

const COPY = hospitalAgendaCore;

/** Reloj fijo inyectado. Sustituye al único `new Date()` de la vista. */
const RELOJ = (): Date => new Date('2026-08-22T09:15:00.000Z');

const AGENDA: HospitalAgendaVistaDto = {
  source: 'ELOISA_POSTGRESQL',
  generatedAt: '2026-08-22T09:15:00.000Z',
  window: { from: '2026-08-22', to: '2026-08-22' },
  requests: [
    {
      appointmentId: '019218ef-0000-7000-8000-000000000001',
      version: 3,
      patient: {
        patientId: '019218ab-0000-7000-8000-000000000001',
        fullName: 'Carmen Paciente Ficticia',
        initials: 'CP',
      },
      modality: 'HOME',
      requestedAt: '2026-08-22T07:20:00.000Z',
    },
  ],
  assignableProfessionals: [
    {
      professionalId: '019218cd-0000-7000-8000-000000000001',
      fullName: 'Ana Ficticia Ejemplo',
      initials: 'AE',
      professionCode: 'MEDICINA_GENERAL',
      professionName: 'Medicina general',
    },
  ],
  appointments: [
    {
      appointmentId: '019218ef-0000-7000-8000-000000000002',
      patient: {
        patientId: '019218ab-0000-7000-8000-000000000002',
        fullName: 'Diego Paciente Ficticio',
        initials: 'DP',
      },
      professional: {
        professionalId: '019218cd-0000-7000-8000-000000000001',
        fullName: 'Ana Ficticia Ejemplo',
        initials: 'AE',
        professionCode: 'MEDICINA_GENERAL',
        professionName: 'Medicina general',
      },
      modality: 'VIRTUAL',
      status: 'ASSIGNED',
      scheduledStart: '2026-08-22T14:30:00.000Z',
    },
  ],
  dailyCounts: [{ date: '2026-08-22', total: 1 }],
  modalityCounts: [
    { modality: 'VIRTUAL', total: 1 },
    { modality: 'HOME', total: 0 },
  ],
  totalAppointments: 1,
};

const AGENDA_VACIA: HospitalAgendaVistaDto = {
  ...AGENDA,
  requests: [],
  appointments: [],
  dailyCounts: [],
  modalityCounts: [],
  totalAppointments: 0,
};

function vista(props: Parameters<typeof HospitalAgenda>[0] = {}): string {
  return renderToStaticMarkup(<HospitalAgenda now={RELOJ} {...props} />);
}

/* ========================================================================== */
/* Plano 1 — El árbol runtime dejó de depender del fixture                    */
/* ========================================================================== */

describe('T-A1 — Sin fixtures, sin repliegue, sin persistencia y con un solo reloj', () => {
  const CODIGO = readFileSync(`${DIRECTORIO}HospitalAgenda.tsx`, 'utf8');

  it('la vista NO importa `hospitalAgendaDemo` ni ningún otro fixture', () => {
    const importes = /^import[\s\S]*?from '[^']+';$/gmu;

    for (const bloque of CODIGO.match(importes) ?? []) {
      expect(bloque).not.toContain('hospitalAgendaDemo');
      expect(bloque).not.toContain('HOSPITAL_CITAS_AGOSTO');
    }

    // Tampoco lo alcanza por otra vía: no aparece fuera de los comentarios.
    expect(CODIGO).not.toContain('hospitalAgendaDemo.');
    expect(CODIGO).not.toContain('construirDias');
  });

  it('el fixture permanece intacto para la vista `Inicio`, que sigue fuera de alcance', () => {
    const config = readFileSync(`${DIRECTORIO}hospitalAgendaConfig.ts`, 'utf8');
    const inicio = readFileSync(`${DIRECTORIO}hospitalDashboardOperacion.ts`, 'utf8');

    expect(config).toContain('export const hospitalAgendaDemo');
    expect(inicio).toContain("import { hospitalAgendaDemo } from './hospitalAgendaConfig'");
  });

  it('consulta y asigna a través del cliente, sin llamar a la red por su cuenta', () => {
    expect(CODIGO).toContain('consultarAgenda(');
    expect(CODIGO).toContain('asignarCita(');
    expect(/\bfetch\s*\(|\bfetchImpl\s*\(/u.test(CODIGO)).toBe(false);
  });

  it('lee el reloj UNA sola vez y solo como valor por defecto de `now`', () => {
    expect(apariciones(CODIGO, /new Date\(\)/gu)).toBe(1);
    expect(CODIGO).toContain('now ?? (() => new Date())');
    expect(CODIGO).not.toContain('Date.now');
    // La fecha activa se convierte de inmediato con el helper del cliente.
    expect(CODIGO).toContain('fechaCalendarioDe(');
  });

  it('la ventana consultada es una función pura de fecha y escala', () => {
    expect(CODIGO).toContain('ventanaDeEscala(fecha, escala)');
  });

  it('cancela la consulta y descarta las respuestas que ya no son vigentes', () => {
    expect(CODIGO).toContain('new AbortController()');
    expect(CODIGO).toContain('controller.abort()');
    expect(CODIGO).toContain("if (!vigente || resultado.kind === 'cancelado')");
  });

  it('ante fallo limpia el estado nominal en lugar de conservarlo', () => {
    expect(/setAgenda\(null\);\s*setEstado\(estadoDeDesenlaceAgenda/u.test(CODIGO)).toBe(true);
  });

  it('el éxito refresca la agenda desde el servidor, no desde la respuesta', () => {
    expect(/setReintento\(\(actual\) => actual \+ 1\);/u.test(CODIGO)).toBe(true);
  });

  it('no persiste nada ni recurre a una caché del navegador', () => {
    expect(/localStorage|sessionStorage|indexedDB|document\.cookie/u.test(CODIGO)).toBe(false);
  });

  it('el cuerpo del PATCH se escribe con los tres campos del contrato', () => {
    expect(CODIGO).toContain('professionalId: seleccion.professionalId');
    expect(CODIGO).toContain('expectedVersion: solicitud.version');
    expect(CODIGO).not.toContain('tenantId');
    expect(CODIGO).not.toContain('identityId');
  });
});

/* ========================================================================== */
/* Plano 2 — Reloj inyectado y ventana por escala                             */
/* ========================================================================== */

describe('T-A2 — Reloj inyectado y ventana determinista', () => {
  it('la fecha inicial procede del reloj inyectado, en `AAAA-MM-DD`', () => {
    expect(fechaCalendarioDe(RELOJ())).toBe('2026-08-22');
    expect(vista()).toContain('value="2026-08-22"');
  });

  it('una fecha inicial explícita prevalece sobre el reloj', () => {
    expect(vista({ fechaInicial: '2026-03-01' })).toContain('value="2026-03-01"');
  });

  it('`Día` consulta exactamente ese día', () => {
    expect(ventanaDeEscala('2026-08-22', 'dia')).toEqual({
      from: '2026-08-22',
      to: '2026-08-22',
    });
  });

  it('`Semana` consulta la semana de lunes a domingo que contiene la fecha', () => {
    // El 22 de agosto de 2026 es sábado.
    expect(ventanaDeEscala('2026-08-22', 'semana')).toEqual({
      from: '2026-08-17',
      to: '2026-08-23',
    });
  });

  it('`Mes` consulta el mes natural completo', () => {
    expect(ventanaDeEscala('2026-08-22', 'mes')).toEqual({
      from: '2026-08-01',
      to: '2026-08-31',
    });
  });

  it('ninguna escala supera el máximo de días que la API admite', () => {
    const dias = (desde: string, hasta: string): number =>
      Math.round(
        (Date.parse(`${hasta}T00:00:00.000Z`) - Date.parse(`${desde}T00:00:00.000Z`)) /
          86_400_000,
      ) + 1;

    for (const escala of ['dia', 'semana', 'mes'] as const) {
      for (const fecha of ['2026-01-15', '2026-02-28', '2026-08-22', '2026-12-31']) {
        const ventana = ventanaDeEscala(fecha, escala);

        expect(dias(ventana.from, ventana.to)).toBeLessThanOrEqual(HOSPITAL_AGENDA_MAX_DIAS);
        expect(dias(ventana.from, ventana.to)).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('publica la ventana consultada como texto legible', () => {
    const TEXTO = texto(vista({ agendaInicial: AGENDA }));

    expect(TEXTO).toContain(`${COPY.controles.etiquetaVentana}: 22/08/2026`);
    expect(ventanaLegible('2026-08-17', '2026-08-23')).toBe('17/08/2026 – 23/08/2026');
  });

  it('la escala activa se anuncia con `aria-pressed`, no solo por color', () => {
    const HTML = vista({ agendaInicial: AGENDA, escalaInicial: 'semana' });

    expect(apariciones(HTML, /aria-pressed="true"/gu)).toBe(1);
    expect(/aria-pressed="true"[^>]*>(?<t>[^<]*)</u.exec(HTML)?.groups?.t).toBe('Semana');
  });

  it('una fecha imposible no consulta nada y lo explica', () => {
    const HTML = vista({ fechaInicial: '2026-02-31' });

    expect(texto(HTML)).toContain(COPY.controles.fechaInvalida);
    expect(HTML).toContain('aria-invalid="true"');
  });
});

/* ========================================================================== */
/* Plano 2 — Primer render y estados                                          */
/* ========================================================================== */

describe('T-A3 — Primer render y desenlaces de la consulta', () => {
  const HTML = vista();
  const TEXTO = texto(HTML);

  it('monta un único encabezado principal con el título aprobado', () => {
    expect(apariciones(HTML, /<h1\b/gu)).toBe(1);
    expect(TEXTO).toContain(COPY.encabezado.titulo);
  });

  it('anuncia la consulta en curso sin publicar ninguna cita ni cifra', () => {
    expect(TEXTO).toContain(COPY.estados.cargando);
    expect(TEXTO).not.toContain(COPY.solicitudes.titulo);
    expect(TEXTO).not.toMatch(/\d+ citas/u);
  });

  it('cada desenlace tiene su texto propio y ninguno repite otro', () => {
    const textos = (
      [
        'sin-sesion',
        'sin-permiso',
        'no-encontrado',
        'consulta-invalida',
        'no-disponible',
        'error',
      ] as const
    ).map((estado) => textoDeEstadoAgenda(COPY.estados, estado));

    expect(new Set(textos).size).toBe(textos.length);
    expect(textos.every((valor) => valor.length > 0)).toBe(true);
  });

  it('401, 403 y 404 NO ofrecen reintento; 400, 503 y error sí', () => {
    expect(ofreceReintentoAgenda('sin-sesion')).toBe(false);
    expect(ofreceReintentoAgenda('sin-permiso')).toBe(false);
    expect(ofreceReintentoAgenda('no-encontrado')).toBe(false);
    expect(ofreceReintentoAgenda('consulta-invalida')).toBe(true);
    expect(ofreceReintentoAgenda('no-disponible')).toBe(true);
    expect(ofreceReintentoAgenda('error')).toBe(true);
  });

  it('el estado se anuncia como región viva y sin datos previos', () => {
    const html = renderToStaticMarkup(<AgendaEstado texto={COPY.estados.noDisponible} />);

    expect(html).toContain('role="status"');
    expect(texto(html)).toBe(COPY.estados.noDisponible);
    expect(html).not.toContain('<button');
  });

  it('una ventana sin registros lo declara en lugar de fingir un calendario', () => {
    const TEXTO_VACIO = texto(vista({ agendaInicial: AGENDA_VACIA }));

    expect(TEXTO_VACIO).toContain(COPY.estados.vacio);
    expect(TEXTO_VACIO).toContain(COPY.solicitudes.vacio);
    expect(TEXTO_VACIO).toContain(COPY.citas.vacio);
  });

  it('conserva la nota de alcance en todos los desenlaces', () => {
    expect(TEXTO).toContain(COPY.nota);
    expect(texto(vista({ agendaInicial: AGENDA }))).toContain(COPY.nota);
  });
});

/* ========================================================================== */
/* Plano 2 — Agenda servida                                                   */
/* ========================================================================== */

describe('T-A4 — Solicitudes, calendario y citas servidas', () => {
  const HTML = vista({ agendaInicial: AGENDA });
  const TEXTO = texto(HTML);

  it('publica cada solicitud servida con su modalidad y su momento', () => {
    expect(TEXTO).toContain('Carmen Paciente Ficticia');
    expect(TEXTO).toContain('En domicilio');
    expect(TEXTO).toContain(`${COPY.solicitudes.etiquetaSolicitada}: 22/08/2026, 07:20 UTC`);
    expect(TEXTO).toContain(`1 ${COPY.solicitudes.resumen}`);
  });

  it('el calendario publica los conteos servidos, no un mes inventado', () => {
    expect(TEXTO).toContain(`1 ${COPY.calendario.sufijoCita}`);
    expect(TEXTO).toContain('22/08/2026');
    expect(TEXTO).not.toContain('Agosto 2026');
    expect(TEXTO).not.toContain('318');
  });

  it('los totales por modalidad proceden del DTO', () => {
    expect(TEXTO).toContain(COPY.calendario.etiquetaTotal);
    expect(TEXTO).toContain('Virtual');
    expect(TEXTO).toContain('En domicilio');
  });

  it('cada cita servida publica paciente, profesional, modalidad y estado', () => {
    expect(TEXTO).toContain('Diego Paciente Ficticio');
    expect(TEXTO).toContain('Ana Ficticia Ejemplo · Virtual');
    expect(TEXTO).toContain('22/08/2026, 14:30 UTC');
    expect(TEXTO).toContain('Asignada');
  });

  it('una cita sin hora registrada lo declara en lugar de inventar una', () => {
    const TEXTO_SIN_HORA = texto(
      vista({
        agendaInicial: {
          ...AGENDA,
          appointments: [{ ...AGENDA.appointments[0]!, scheduledStart: null }],
        },
      }),
    );

    expect(TEXTO_SIN_HORA).toContain(COPY.citas.sinHora);
  });

  it('no publica pagos, alertas, direcciones, origen ni perspectivas demostrativas', () => {
    for (const prohibido of [
      'Pago confirmado',
      'Pago pendiente',
      'alerta roja',
      'Solicitado por',
      'Una cita, cuatro vistas',
      'vereda El Charquito',
      'Dra. Laura Gómez',
    ]) {
      expect(TEXTO).not.toContain(prohibido);
    }
  });
});

/* ========================================================================== */
/* Plano 2 — Formulario de asignación                                         */
/* ========================================================================== */

describe('T-A5 — Selector, validación y bloqueo de doble envío', () => {
  const solicitud = AGENDA.requests[0]!;

  function pieza(
    seleccion = HOSPITAL_AGENDA_SELECCION_VACIA,
    enviando: string | null = null,
  ): string {
    return renderToStaticMarkup(
      <AgendaSolicitud
        solicitud={solicitud}
        profesionales={AGENDA.assignableProfessionals}
        copy={COPY}
        seleccion={seleccion}
        enviando={enviando}
        onSeleccion={() => undefined}
        onAsignar={() => undefined}
      />,
    );
  }

  const COMPLETA = {
    professionalId: '019218cd-0000-7000-8000-000000000001',
    fecha: '2026-08-25',
    hora: '10:30',
  };

  it('el selector usa el identificador OPACO como valor, nunca el nombre', () => {
    const html = pieza();

    expect(html).toContain('value="019218cd-0000-7000-8000-000000000001"');
    expect(html).toContain(`>${COPY.solicitudes.opcionProfesional}<`);
  });

  it('exige profesional, fecha y hora antes de habilitar «Asignar»', () => {
    expect(puedeAsignar(HOSPITAL_AGENDA_SELECCION_VACIA, null)).toBe(false);
    expect(puedeAsignar({ ...COMPLETA, professionalId: '' }, null)).toBe(false);
    expect(puedeAsignar({ ...COMPLETA, fecha: '' }, null)).toBe(false);
    expect(puedeAsignar({ ...COMPLETA, hora: '' }, null)).toBe(false);
    expect(puedeAsignar({ ...COMPLETA, fecha: '2026-02-31' }, null)).toBe(false);
    expect(puedeAsignar(COMPLETA, null)).toBe(true);
  });

  it('el botón viaja deshabilitado mientras la selección esté incompleta', () => {
    expect(pieza()).toMatch(/<button type="button"[^>]*disabled[^>]*>Asignar</u);
    expect(pieza(COMPLETA)).not.toMatch(/<button type="button"[^>]*disabled[^>]*>Asignar</u);
  });

  it('un envío en curso bloquea TODOS los botones de asignación', () => {
    expect(puedeAsignar(COMPLETA, solicitud.appointmentId)).toBe(false);
    expect(puedeAsignar(COMPLETA, 'otra-solicitud')).toBe(false);
    expect(texto(pieza(COMPLETA, solicitud.appointmentId))).toContain(COPY.asignacion.enviando);
  });

  it('la selección incompleta no produce ningún instante que enviar', () => {
    expect(instanteDeSeleccion(HOSPITAL_AGENDA_SELECCION_VACIA)).toBeNull();
    expect(instanteDeSeleccion(COMPLETA)).not.toBeNull();
  });

  it('«Reprogramar» y «Rechazar con motivo» están deshabilitadas y sin controlador', () => {
    const html = pieza(COMPLETA);

    for (const accion of COPY.solicitudes.acciones) {
      expect(texto(html)).toContain(accion.etiqueta);
      expect(texto(html)).toContain(accion.ayuda);
    }

    expect(apariciones(html, /<button type="button" disabled/gu)).toBe(
      COPY.solicitudes.acciones.length,
    );
  });

  it('cada control del formulario tiene etiqueta visible asociada', () => {
    const html = pieza();

    expect(apariciones(html, /<label\b/gu)).toBe(3);
    expect(html).toContain(`for="hospital-agenda-solicitud-${solicitud.appointmentId}-fecha"`);
    expect(html).toContain(`for="hospital-agenda-solicitud-${solicitud.appointmentId}-hora"`);
    expect(html).toContain(
      `for="hospital-agenda-solicitud-${solicitud.appointmentId}-profesional"`,
    );
  });
});

/* ========================================================================== */
/* Plano 3 — Cuerpo del PATCH y desenlaces de la asignación                   */
/* ========================================================================== */

describe('T-A6 — La ÚNICA mutación envía exactamente el contrato', () => {
  it('el cuerpo contiene los tres campos y ninguno más', async () => {
    let cuerpo: unknown = null;

    const fetchFalso: typeof fetch = (_entrada, init) => {
      cuerpo = JSON.parse(String(init?.body));

      return Promise.resolve(
        new Response(JSON.stringify({ appointmentId: 'x' }), { status: 200 }),
      );
    };

    await asignarCita(
      AGENDA.requests[0]!.appointmentId,
      {
        professionalId: AGENDA.assignableProfessionals[0]!.professionalId,
        scheduledStart: '2026-08-25T15:30:00.000Z',
        expectedVersion: AGENDA.requests[0]!.version,
      },
      fetchFalso,
    );

    expect(cuerpo).toEqual({
      professionalId: '019218cd-0000-7000-8000-000000000001',
      scheduledStart: '2026-08-25T15:30:00.000Z',
      expectedVersion: 3,
    });
    expect(Object.keys(cuerpo as object)).toHaveLength(3);
  });

  it('un `409` conserva la selección y anuncia el conflicto sin describir la cita', () => {
    expect(conservaSeleccion('conflicto-version')).toBe(true);
    expect(conservaSeleccion('no-asignable')).toBe(true);
    expect(conservaSeleccion('error')).toBe(true);
    // Solo el éxito limpia lo escrito.
    expect(conservaSeleccion('ok')).toBe(false);

    const aviso = textoDeAsignacion(COPY.asignacion, 'conflicto-version');

    expect(aviso).toBe(COPY.asignacion.conflictoVersion);
    expect(aviso).not.toContain('Carmen');
    expect(aviso).not.toContain('Ana');
  });

  it('cada desenlace de la asignación tiene su propio texto', () => {
    const textos = (
      [
        'ok',
        'conflicto-version',
        'no-asignable',
        'datos-invalidos',
        'sin-sesion',
        'sin-permiso',
        'no-encontrado',
        'no-disponible',
        'error',
        'incompleta',
      ] as const
    ).map((kind) => textoDeAsignacion(COPY.asignacion, kind));

    expect(new Set(textos).size).toBe(textos.length);
  });

  it('la vista declara una región viva para anunciar el desenlace', () => {
    const HTML = vista({ agendaInicial: AGENDA });

    expect(HTML).toContain('aria-live="polite"');
    expect(apariciones(HTML, /aria-live="polite"/gu)).toBe(1);
  });
});

/* ========================================================================== */
/* Plano 2 — Alcance negativo y accesibilidad estructural                     */
/* ========================================================================== */

describe('T-A7 — Alcance negativo y accesibilidad estructural', () => {
  const HTML = vista({ agendaInicial: AGENDA });

  it('no hay formularios, envíos ni enlaces', () => {
    expect(HTML).not.toContain('<form');
    expect(HTML).not.toContain('<a ');
    expect(HTML).not.toContain('href');
    expect(HTML).not.toContain('type="submit"');
  });

  it('todos los botones son `button type="button"`', () => {
    expect(apariciones(HTML, /<button\b/gu)).toBe(apariciones(HTML, /<button type="button"/gu));
  });

  it('los iconos decorativos quedan ocultos y los estados se leen como texto', () => {
    expect(apariciones(HTML, /<svg\b/gu)).toBe(
      apariciones(HTML, /aria-hidden="true" focusable/gu),
    );
    expect(texto(HTML)).toContain('Asignada');
  });

  it('el control de fecha está etiquetado y describe qué hace', () => {
    expect(HTML).toContain('for="hospital-agenda-fecha"');
    expect(HTML).toContain('aria-describedby="hospital-agenda-fecha-ayuda"');
    expect(texto(HTML)).toContain(COPY.controles.ayudaFecha);
  });

  it('el grupo de escalas tiene nombre accesible', () => {
    expect(HTML).toContain(`aria-label="${COPY.controles.etiquetaEscala}"`);
  });
});

/* ========================================================================== */
/* Plano 2 — Preparación de la visita domiciliaria (HOSPITAL-VISITS-01, B)    */
/* ========================================================================== */

/** Cita EN DOMICILIO ya ASIGNADA: la única forma que MP04 admite materializar. */
const CITA_DOMICILIO: HospitalCitaAgendaDto = {
  ...AGENDA.appointments[0]!,
  appointmentId: '019218ef-0000-7000-8000-000000000003',
  modality: 'HOME',
  status: 'ASSIGNED',
};

/** Agenda servida que contiene esa cita. */
const AGENDA_DOMICILIO: HospitalAgendaVistaDto = {
  ...AGENDA,
  appointments: [CITA_DOMICILIO],
  modalityCounts: [{ modality: 'HOME', total: 1 }],
};

/** Marcado de la agenda con el controlador de materialización conectado. */
function vistaConVisitas(agenda: HospitalAgendaVistaDto): string {
  return vista({
    agendaInicial: agenda,
    onVisitaMaterializada: () => {
      // La navegación es del shell. Aquí solo importa que la acción exista.
    },
  });
}

describe('T-A8 — Solo HOME + ASSIGNED ofrece preparar la visita', () => {
  const MODALIDADES = ['ON_SITE', 'HOME', 'VIRTUAL'] as const;
  const ESTADOS = ['REQUESTED', 'ASSIGNED', 'CANCELLED'] as const;

  it('la condición es EXACTAMENTE en domicilio y asignada', () => {
    for (const modality of MODALIDADES) {
      for (const status of ESTADOS) {
        expect(esCitaMaterializable({ ...CITA_DOMICILIO, modality, status })).toBe(
          modality === 'HOME' && status === 'ASSIGNED',
        );
      }
    }
  });

  it('la cita HOME + ASSIGNED publica la acción con texto visible', () => {
    const HTML = vistaConVisitas(AGENDA_DOMICILIO);

    expect(texto(HTML)).toContain(HOSPITAL_AGENDA_VISITA.preparar);
    expect(HTML).toContain(`aria-describedby="hospital-agenda-visita-${CITA_DOMICILIO.appointmentId}"`);
    expect(texto(HTML)).toContain(HOSPITAL_AGENDA_VISITA.ayuda);
  });

  it('ninguna otra combinación publica la acción', () => {
    for (const modality of MODALIDADES) {
      for (const status of ESTADOS) {
        if (modality === 'HOME' && status === 'ASSIGNED') {
          continue;
        }

        const HTML = vistaConVisitas({
          ...AGENDA,
          appointments: [{ ...CITA_DOMICILIO, modality, status }],
        });

        expect(texto(HTML)).not.toContain(HOSPITAL_AGENDA_VISITA.preparar);
      }
    }
  });

  it('sin controlador de materialización la acción ni siquiera se dibuja', () => {
    const HTML = vista({ agendaInicial: AGENDA_DOMICILIO });

    expect(texto(HTML)).not.toContain(HOSPITAL_AGENDA_VISITA.preparar);
  });

  it('la acción no publica el identificador de la cita como texto', () => {
    expect(texto(vistaConVisitas(AGENDA_DOMICILIO))).not.toContain(
      CITA_DOMICILIO.appointmentId,
    );
  });

  it('sigue habiendo una sola región viva y todos los botones son `type="button"`', () => {
    const HTML = vistaConVisitas(AGENDA_DOMICILIO);

    expect(apariciones(HTML, /aria-live="polite"/gu)).toBe(1);
    expect(apariciones(HTML, /<button\b/gu)).toBe(apariciones(HTML, /<button type="button"/gu));
    expect(HTML).not.toContain('<form');
    expect(HTML).not.toContain('href');
  });
});

describe('T-A9 — Materializar es un acto institucional y envía solo la cita', () => {
  const CODIGO = readFileSync(`${DIRECTORIO}HospitalAgenda.tsx`, 'utf8');

  it('la vista entrega EXCLUSIVAMENTE el identificador de la cita al cliente', () => {
    expect(CODIGO).toContain('materializarVisita(cita.appointmentId');
    expect(CODIGO).not.toContain('professionalId: cita');
    expect(CODIGO).not.toContain('patientId');
  });

  it('el cuerpo que llega a la API contiene ese único campo', async () => {
    let cuerpo = '';
    let ruta = '';

    const fetchImpl = ((url: string, init: RequestInit): Promise<Response> => {
      ruta = url;
      cuerpo = String(init.body);

      return Promise.resolve(
        new Response(
          JSON.stringify({
            homeVisitId: '019218ef-0000-7000-8000-0000000000f1',
            appointmentId: CITA_DOMICILIO.appointmentId,
            status: 'SCHEDULED',
            version: 1,
            creationTransitionId: '019218ef-0000-7000-8000-0000000000f2',
            createdAt: '2026-08-22T09:20:00.000Z',
          }),
          { status: 201, headers: { 'Content-Type': 'application/json' } },
        ),
      );
    }) as unknown as typeof fetch;

    const resultado = await materializarVisita(CITA_DOMICILIO.appointmentId, fetchImpl);

    expect(resultado.kind).toBe('ok');
    expect(ruta).toContain(RUTAS_HOSPITAL_VISITAS.materializar);
    expect(Object.keys(JSON.parse(cuerpo) as object)).toEqual(['appointmentId']);
  });

  it('un envío en curso bloquea cualquier otra materialización y la asignación', () => {
    expect(CODIGO).toContain('if (materializando !== null || enviando !== null)');
    expect(CODIGO).toContain('bloqueado={materializando !== null || enviando !== null}');
  });

  it('el fallo se anuncia con el mensaje de producto del cliente, sin código', () => {
    expect(CODIGO).toContain('mensajeDeVisita(resultado)');
    expect(CODIGO).not.toContain('response.status');
  });

  it('la agenda no navega ni conserva la visita: entrega el DTO real al shell', () => {
    expect(CODIGO).toContain('onVisitaMaterializada?.(resultado.datos)');
    expect(CODIGO).not.toContain("setNavegacion");
  });
});

/* ========================================================================== */
/* Plano 2 — Composición recuperada (HOSPITAL-VISUAL-RECOVERY-01-C)           */
/* ========================================================================== */

/**
 * La recuperación visual NO cambia la fuente de los datos ni ninguna operación:
 * lo que se comprueba aquí es que la composición reconocible del diseño
 * original vuelve a leerse —distintivo de modalidad, jerarquía de textos,
 * acciones agrupadas y filas densas— SIN que reaparezca ningún dato que la
 * plataforma no modela y sin que se filtre un término técnico o un
 * identificador interno a la pantalla.
 */
describe('T-A10 — Composición recuperada de solicitudes y citas', () => {
  const HTML = vista({ agendaInicial: AGENDA });
  const TEXTO = texto(HTML);

  /** Contenido de la primera fila que declara la clase indicada. */
  function fila(html: string, clase: string): string {
    return (
      new RegExp(`<li class="_${clase}_[^"]*">(?<f>.*?)</li>`, 'su').exec(html)?.groups?.f ??
      ''
    );
  }

  /** Marcado de una fila a partir de la clase indicada, hasta su cierre. */
  function desde(marcado: string, clase: string): string {
    const indice = marcado.indexOf(`_${clase}_`);

    return indice === -1 ? '' : marcado.slice(indice);
  }

  it('cada modalidad servida tiene su propio distintivo y ninguno se repite', () => {
    const iconos = (['ON_SITE', 'HOME', 'VIRTUAL'] as const).map(iconoDeModalidad);

    expect(iconos).toEqual(['agenda', 'visitas', 'virtuales']);
    expect(new Set(iconos).size).toBe(iconos.length);
  });

  it('la solicitud recupera la jerarquía distintivo → paciente → momento → modalidad', () => {
    const solicitud = fila(HTML, 'solicitud');

    expect(solicitud).toMatch(
      /_solicitudIcono_[\s\S]*_solicitudTitulo_[\s\S]*_solicitudLinea_[\s\S]*_solicitudEstado_/u,
    );
    expect(solicitud).toMatch(/<h3 class="_solicitudTitulo_/u);
    // El distintivo es decorativo: la modalidad se lee además como texto.
    expect(texto(solicitud)).toContain('Carmen Paciente Ficticia');
    expect(texto(solicitud)).toContain(`${COPY.solicitudes.etiquetaSolicitada}: 22/08/2026, 07:20 UTC`);
    expect(texto(solicitud)).toContain('En domicilio');
  });

  it('las tres acciones viajan agrupadas al final de la fila', () => {
    const solicitud = fila(HTML, 'solicitud');

    expect(solicitud).toMatch(/_acciones_/u);
    expect(apariciones(solicitud, /_acciones_/gu)).toBe(1);
    expect(solicitud).toMatch(/_campoHora_[\s\S]*_acciones_/u);
  });

  it('«Reprogramar» y «Rechazar con motivo» siguen deshabilitadas, atenuadas y sin controlador', () => {
    const deshabilitadas = HTML.match(/<button type="button" disabled[^>]*>[^<]*<\/button>/gu) ?? [];

    expect(deshabilitadas).toHaveLength(COPY.solicitudes.acciones.length);
    expect(deshabilitadas.every((boton) => /_accionInactiva_/u.test(boton))).toBe(true);
    // Solo una recupera el contorno propio que la referencia le reserva.
    expect(deshabilitadas.filter((boton) => /_accionRechazar_/u.test(boton))).toHaveLength(1);
    expect(deshabilitadas.some((boton) => /onclick/iu.test(boton))).toBe(false);
    for (const accion of COPY.solicitudes.acciones) {
      expect(TEXTO).toContain(accion.etiqueta);
      expect(TEXTO).toContain(accion.ayuda);
    }
  });

  it('la cita es una fila densa con fecha/hora, paciente, profesional, modalidad y estado', () => {
    const cita = fila(HTML, 'cita');

    expect(cita).toMatch(
      /_citaIcono_[\s\S]*_citaHora_[\s\S]*_citaPaciente_[\s\S]*_citaProfesional_[\s\S]*_citaModalidad_[\s\S]*_citaEstado_/u,
    );
    expect(texto(cita)).toContain('22/08/2026, 14:30 UTC');
    expect(texto(cita)).toContain('Diego Paciente Ficticio');
    expect(texto(cita)).toContain('Ana Ficticia Ejemplo · Virtual');
    expect(texto(cita)).toContain('Asignada');
  });

  it('la acción de la visita domiciliaria queda junto al estado de su cita', () => {
    const acciones = desde(fila(vistaConVisitas(AGENDA_DOMICILIO), 'cita'), 'citaAcciones');

    expect(texto(acciones)).toContain('Asignada');
    expect(texto(acciones)).toContain(HOSPITAL_AGENDA_VISITA.preparar);
    // El grupo cierra la fila: los textos de la cita quedan antes, no dentro.
    expect(texto(acciones)).not.toContain('Diego Paciente Ficticio');
  });

  it('ninguna superficie publica términos técnicos ni identificadores internos', () => {
    const IDENTIFICADORES = [
      AGENDA.requests[0]!.appointmentId,
      AGENDA.appointments[0]!.appointmentId,
      AGENDA.appointments[0]!.patient.patientId,
      AGENDA.assignableProfessionals[0]!.professionalId,
    ];

    for (const superficie of [
      TEXTO,
      texto(vistaConVisitas(AGENDA_DOMICILIO)),
      texto(vista({ agendaInicial: AGENDA_VACIA })),
      texto(vista()),
    ]) {
      for (const prohibido of [
        'CORE',
        'API',
        'backend',
        'fixture',
        'expectedVersion',
        'appointmentId',
        'professionalId',
        'patientId',
        'HOME',
        'ASSIGNED',
      ]) {
        expect(superficie).not.toContain(prohibido);
      }

      expect(superficie).not.toMatch(/\bdemo\b/iu);

      for (const identificador of IDENTIFICADORES) {
        expect(superficie).not.toContain(identificador);
      }
    }
  });

  it('la hoja de estilo ya no conserva las reglas de los bloques retirados', () => {
    const CSS = readFileSync(`${DIRECTORIO}hospitalAgenda.module.css`, 'utf8');

    for (const retirada of [
      '.perspectiva',
      '.estadosCard',
      '.estadosDescripcion',
      '.diaHoy',
      '.diaDestacado',
      '.diaFuera',
      '.diaSemana',
      '.iniciales',
    ]) {
      expect(CSS).not.toContain(retirada);
    }
  });
});
