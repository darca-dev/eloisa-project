import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { formatearFechaOperativaActual, HospitalDashboard } from './HospitalDashboard';
import { HospitalDashboardHeader } from './HospitalDashboardHeader';
import { HospitalKpiCard } from './HospitalKpiCard';
import { branding } from '@/config/branding';

import { HOSPITAL_NAV_ITEMS } from './hospitalConfig';
import {
  hospitalDashboardDemo,
  hospitalDashboardHeaderDemo,
  hospitalKpisDemo,
} from './hospitalDashboardConfig';
import type { HospitalKpiConfig } from './hospitalDashboardConfig';
import { hospitalAlertsDemo } from './hospitalAlertsConfig';
import {
  HOSPITAL_ACCIONES_RAPIDAS,
  componerAccesos,
  componerAgendaProxima,
  componerAlarmasRecientes,
  componerAtencion,
  componerProfesionales,
  hospitalInicioDemo,
} from './hospitalDashboardOperacion';
import { apariciones, texto } from './hospitalTestUtils';
import { destinoDeItem } from './hospitalViews';

/**
 * Centro de control operativo de Inicio (TASK-003H-02B, T-02, T-04 y T-06 a
 * T-14).
 *
 * Inicio se renderiza con `react-dom/server`, igual que el resto del frontend:
 * el repositorio no incluye jsdom ni una librería de testing con DOM y esta
 * tarea no autoriza añadir dependencias. Por eso el comportamiento observable
 * se comprueba en dos planos complementarios:
 *
 * 1. el marcado real que produce cada control —elemento, texto visible, estado
 *    y destino declarado en `data-hospital-destino`/`data-hospital-intencion`—; y
 * 2. la transición de navegación, que está extraída como función pura y se
 *    verifica en `hospitalNavegacion.test.tsx`.
 *
 * La comprobación con eventos de teclado y ratón sobre un DOM real queda
 * pendiente y así se reporta: no se declara aprobada.
 */

function inicio(): string {
  return renderToStaticMarkup(<HospitalDashboard />);
}

/** Botones de Inicio con su texto visible y su destino declarado. */
interface Control {
  readonly texto: string;
  readonly vista: string;
  readonly intencion: string;
  readonly inerte: boolean;
}

function controles(html: string): readonly Control[] {
  return [...html.matchAll(/<button(?<atributos>[^>]*)>(?<cuerpo>[\s\S]*?)<\/button>/gu)].map(
    (control) => {
      const atributos = control.groups?.atributos ?? '';

      return {
        texto: texto(control.groups?.cuerpo ?? ''),
        vista: /data-hospital-destino="(?<valor>[^"]*)"/u.exec(atributos)?.groups?.valor ?? '',
        intencion: /data-hospital-intencion="(?<valor>[^"]*)"/u.exec(atributos)?.groups?.valor ?? '',
        inerte: atributos.includes('disabled'),
      };
    },
  );
}

/** Primer control cuyo texto visible empieza por la etiqueta indicada. */
function control(html: string, etiqueta: string): Control | undefined {
  return controles(html).find((candidato) => candidato.texto.startsWith(etiqueta));
}

describe('T-02 — Siete KPI compactos, únicos y clicables', () => {
  it('conserva los siete indicadores, sus valores y sus desgloses de H-02', () => {
    expect(hospitalKpisDemo.map((kpi) => kpi.label)).toEqual([
      'CITAS DE HOY',
      'VISITAS EN CASA HOY',
      'CONSULTAS VIRTUALES HOY',
      'ALARMAS ACTIVAS',
      'PACIENTES ACTIVOS',
      'PROFESIONALES EN TURNO',
      'CITAS PENDIENTES DE ASIGNACIÓN',
    ]);
    expect(hospitalKpisDemo.map((kpi) => kpi.value)).toEqual([
      '24',
      '11',
      '7',
      '7',
      '412',
      '9',
      '4',
    ]);
    expect(
      Object.fromEntries(
        hospitalKpisDemo.map((kpi) => [
          kpi.label,
          kpi.breakdown.map((fila) => `${fila.label}=${fila.value}`),
        ]),
      ),
    ).toEqual({
      'CITAS DE HOY': ['Presenciales=6', 'Virtuales=7', 'Domiciliarias=11'],
      'VISITAS EN CASA HOY': ['Programadas=4', 'En camino=2', 'En atención=2', 'Finalizadas=3'],
      'CONSULTAS VIRTUALES HOY': ['En espera=1', 'En curso=2', 'Finalizadas=4'],
      'ALARMAS ACTIVAS': ['Rojas=3', 'Amarillas=4'],
      'PACIENTES ACTIVOS': ['Con cuidador=298', 'Nuevos del mes=38'],
      'PROFESIONALES EN TURNO': ['Disponibles=4', 'En visita=3', 'En consulta=2'],
      'CITAS PENDIENTES DE ASIGNACIÓN': [
        'Prioritaria hospital=1',
        'Visita en casa=2',
        'Virtual=1',
      ],
    });
  });

  it('dibuja siete tarjetas en el orden aprobado, con total y desglose completos', () => {
    const html = inicio();
    const cuadricula = /<ul class="[^"]*_kpiGrid_[^"]*">(?<cuerpo>[\s\S]*?)<\/ul>/u.exec(html)
      ?.groups?.cuerpo;

    expect(apariciones(cuadricula ?? '', /<li/gu)).toBe(7);
    expect(hospitalKpisDemo.map((kpi) => html.indexOf(kpi.label))).toEqual(
      [...hospitalKpisDemo.map((kpi) => html.indexOf(kpi.label))].sort((a, b) => a - b),
    );

    for (const kpi of hospitalKpisDemo) {
      const tarjeta = new RegExp(`${kpi.label}[\\s\\S]*?</button>`, 'u').exec(html)?.[0] ?? '';

      expect(texto(tarjeta)).toContain(kpi.value);
      for (const fila of kpi.breakdown) {
        expect(texto(tarjeta)).toContain(`${fila.label} ${fila.value}`);
      }
    }
  });

  it('cada tarjeta es un único control sin controles anidados', () => {
    const html = inicio();
    const tarjetas = html.match(/<li class="[^"]*_kpiCard_[^"]*"[^>]*>[\s\S]*?<\/li>/gu) ?? [];

    expect(tarjetas.length).toBe(7);
    for (const tarjeta of tarjetas) {
      expect(apariciones(tarjeta, /<button/gu)).toBe(1);
      expect(tarjeta).toContain('<button type="button"');
      // El contenido del control es texto en línea: sin listas ni encabezados.
      expect(tarjeta).not.toContain('<dl');
      expect(tarjeta).not.toContain('<h2');
    }
  });

  it('la anatomía compacta reduce icono, total y relleno frente a H-02', () => {
    const html = inicio();

    // El icono pasa de 20 a 16 px; el desglose ya no es una lista de descripción.
    expect(apariciones(html, /width="16" height="16"/gu)).toBe(7);
    expect(html).not.toContain('width="20" height="20"');
  });

  it('reutiliza una sola implementación para cualquier configuración', () => {
    const alterno: HospitalKpiConfig = {
      id: 'kpi-ficticio',
      label: 'MÉTRICA FICTICIA',
      value: 'sin dato',
      accentColor: 'var(--b-verde)',
      iconBackground: 'var(--b-verde-fondo)',
      icon: 'calificaciones',
      breakdown: [
        { label: 'Primera fila', value: 'A' },
        { label: 'Segunda fila', value: 'B' },
        { label: 'Tercera fila', value: 'C' },
        { label: 'Cuarta fila', value: 'D' },
        { label: 'Quinta fila', value: 'E' },
      ],
      destino: { vista: 'pacientes' },
      pie: 'Abrir Pacientes',
    };
    const html = renderToStaticMarkup(<HospitalKpiCard kpi={alterno} />);

    expect(html).toContain('MÉTRICA FICTICIA');
    expect(html).toContain('sin dato');
    expect(html).toContain('--h-kpi-acento:var(--b-verde)');
    expect(texto(html)).toContain('Quinta fila E');
    // No deriva, no suma y no interpreta el valor recibido.
    expect(html).not.toContain('1.234');
  });

  it('sin controlador de navegación la tarjeta se lee pero no actúa', () => {
    const html = renderToStaticMarkup(<HospitalKpiCard kpi={hospitalKpisDemo[0]!} />);

    expect(html).toContain('<button type="button"');
    expect(html).toContain('CITAS DE HOY');
  });
});

describe('T-03 — Destino de cada KPI', () => {
  it('cada tarjeta declara la vista de FR-02 y solo pendientes lleva intención', () => {
    const html = inicio();
    const tarjetas = controles(html).filter((candidato) =>
      hospitalKpisDemo.some((kpi) => candidato.texto.startsWith(kpi.label)),
    );

    expect(tarjetas.map((tarjeta) => `${tarjeta.vista}|${tarjeta.intencion}`)).toEqual([
      'agenda|',
      'visitas|',
      'virtuales|',
      'alarmas|',
      'pacientes|',
      'profesionales|',
      'agenda|pendientes-asignacion',
    ]);
  });

  it('el KPI de pendientes expresa su intención también con texto visible', () => {
    const pendientes = control(inicio(), 'CITAS PENDIENTES DE ASIGNACIÓN');

    expect(pendientes?.texto).toContain('Abrir Agenda · intención: pendientes de asignación');
    // No afirma que exista un filtro aplicado.
    expect(pendientes?.texto).not.toContain('Filtrado');
    expect(pendientes?.texto).not.toContain('filtro aplicado');
  });
});

describe('T-04 — «Necesita atención ahora» se compone de fixtures existentes', () => {
  const items = componerAtencion();

  it('muestra alarmas rojas, amarillas, casos sin profesional y espera virtual', () => {
    expect(items.map((item) => item.severidad)).toEqual([
      'Alarma roja',
      'Alarma roja',
      'Alarma amarilla',
      'Alarma amarilla',
      'Sin profesional',
      'Sin profesional',
      'Paciente en espera',
    ]);
  });

  it('cada fila reproduce literalmente el texto del fixture de origen', () => {
    const html = inicio();

    expect(items.map((item) => item.titulo)).toEqual([
      'Sara Nieto Vargas',
      'María Rodríguez',
      'María Gómez Osorio',
      'Jorge Beltrán Ruiz',
      'Sara Nieto Vargas',
      'Carmen López Díaz',
      'Juan Pérez Mora',
    ]);
    for (const item of items) {
      expect(texto(html)).toContain(item.contexto);
      expect(texto(html)).toContain(item.prioridad);
    }
  });

  it('no introduce priorización, umbral, diagnóstico, recomendación ni SLA', () => {
    const html = texto(inicio());

    for (const prohibido of [
      'Prioridad 1',
      'Riesgo alto',
      'Urgente',
      'Recomendación',
      'Diagnóstico',
      'SLA',
      /* El asistente de MERDN no aparece en Inicio; el nombre llega del branding. */
      branding.aiDisplayName,
      'WhatsApp',
    ]) {
      expect(html).not.toContain(prohibido);
    }
    expect(html).toContain('No es una priorización clínica');
  });
});

describe('T-05 — Acciones de las filas prioritarias', () => {
  it('cada fila tiene exactamente una acción coherente con su destino', () => {
    expect(
      componerAtencion().map(
        (item) =>
          `${item.accion.etiqueta}→${item.accion.destino.vista}/${item.accion.destino.intencion ?? ''}`,
      ),
    ).toEqual([
      'Ver→alarmas/rojas',
      'Ver→alarmas/rojas',
      'Revisar→alarmas/amarillas',
      'Revisar→alarmas/amarillas',
      'Asignar→agenda/pendientes-asignacion',
      'Asignar→agenda/pendientes-asignacion',
      'Abrir cola→virtuales/en-espera',
    ]);
  });

  it('las acciones se renderizan como botones con nombre accesible completo', () => {
    const html = inicio();
    const verAlarma = controles(html).find(
      (candidato) =>
        candidato.texto.startsWith('Ver') &&
        candidato.vista === 'alarmas' &&
        candidato.intencion === 'rojas',
    );
    const asignarAgenda = controles(html).find(
      (candidato) =>
        candidato.texto.startsWith('Asignar') &&
        candidato.vista === 'agenda' &&
        candidato.texto.includes('en Agenda y citas'),
    );

    expect(verAlarma?.texto).toContain('en Semáforo de alarmas');
    expect(asignarAgenda?.texto).toContain('en Agenda y citas');
    expect(control(html, 'Abrir cola')?.texto).toContain('la cola de Consultas virtuales');
  });
});

describe('T-06 — Cinco acciones rápidas', () => {
  it('declara las cinco acciones aprobadas con su destino local', () => {
    expect(
      HOSPITAL_ACCIONES_RAPIDAS.map(
        (accion) =>
          `${accion.etiqueta}→${accion.destino.vista}/${accion.destino.intencion ?? ''}`,
      ),
    ).toEqual([
      'Nueva cita→agenda/',
      'Buscar paciente→pacientes/',
      'Asignar profesional→agenda/pendientes-asignacion',
      'Programar visita→visitas/',
      'Crear novedad→novedades/',
    ]);
  });

  it('cada acción se dibuja con icono, texto y destino declarado', () => {
    const html = inicio();

    for (const accion of HOSPITAL_ACCIONES_RAPIDAS) {
      const boton = control(html, accion.etiqueta);

      expect(boton?.vista).toBe(accion.destino.vista);
      expect(boton?.intencion).toBe(accion.destino.intencion ?? '');
      expect(boton?.texto).toContain(accion.detalle);
    }
  });

  it('no crea formularios, registros ni mensajes de éxito', () => {
    const html = inicio();

    expect(html).not.toContain('<form');
    expect(html).not.toContain('<input');
    expect(html).not.toContain('<select');
    expect(html).not.toContain('<textarea');
    for (const prohibido of ['Guardado', 'Creada', 'Registrada', 'Asignada con éxito']) {
      expect(texto(html)).not.toContain(prohibido);
    }
  });
});

describe('T-07 — Agenda próxima', () => {
  const filas = componerAgendaProxima();

  it('muestra entre 3 y 5 filas con hora, paciente, modalidad y profesional', () => {
    expect(filas.length).toBeGreaterThanOrEqual(3);
    expect(filas.length).toBeLessThanOrEqual(5);
    expect(filas.map((fila) => `${fila.hora}|${fila.paciente}|${fila.modalidad}`)).toEqual([
      '10:00|María Gómez Osorio|Visita domiciliaria',
      '11:00|Carmen López Díaz|Visita domiciliaria',
      '11:30|Juan Pérez Mora|Consulta virtual',
      '14:00|Sara Nieto Vargas|Visita domiciliaria',
      '3:15 p|Rosa Marín Cifuentes|Consulta virtual',
    ]);
  });

  it('escribe `Sin asignar` como texto cuando el fixture no declara profesional', () => {
    const html = texto(inicio());

    expect(filas.filter((fila) => fila.sinAsignar).map((fila) => fila.paciente)).toEqual([
      'Sara Nieto Vargas',
    ]);
    expect(html).toContain('Sin asignar');
  });

  it('ofrece `Ver agenda completa` hacia Agenda y sin intención', () => {
    const acceso = control(inicio(), 'Ver agenda completa');

    expect(acceso?.vista).toBe('agenda');
    expect(acceso?.intencion).toBe('');
  });
});

describe('T-08 — Alarmas recientes', () => {
  const filas = componerAlarmasRecientes();

  it('muestra entre 3 y 4 alarmas ya existentes con sus cinco campos', () => {
    expect(filas.length).toBeGreaterThanOrEqual(3);
    expect(filas.length).toBeLessThanOrEqual(4);
    expect(
      filas.map(
        (fila) => `${fila.severidad}|${fila.paciente}|${fila.cuando}|${fila.estado}|${fila.accion.etiqueta}`,
      ),
    ).toEqual([
      'ROJA|Sara Nieto Vargas|Hace 12 minutos|requieren atención|Ver',
      'ROJA|María Rodríguez|Hace 15 minutos|requieren atención|Ver',
      'AMARILLA|María Gómez Osorio|Hace 1 hora|requieren seguimiento|Revisar',
      'AMARILLA|Jorge Beltrán Ruiz|Ayer 8:10 p. m.|requieren seguimiento|Revisar',
    ]);
  });

  it('cada alarma transporta la intención de su severidad', () => {
    expect(
      filas.map((fila) => `${fila.accion.destino.vista}/${fila.accion.destino.intencion ?? ''}`),
    ).toEqual([
      'alarmas/rojas',
      'alarmas/rojas',
      'alarmas/amarillas',
      'alarmas/amarillas',
    ]);
  });

  it('ofrece `Ver semáforo` hacia Alarmas y sin intención', () => {
    const acceso = control(inicio(), 'Ver semáforo');

    expect(acceso?.vista).toBe('alarmas');
    expect(acceso?.intencion).toBe('');
  });

  it('no incorpora asignación, comentario, cierre ni capacidad remota', () => {
    const html = texto(inicio());

    for (const prohibido of ['Escalar', 'Marcar en revisión', 'Registrar acción y cerrar']) {
      expect(html).not.toContain(prohibido);
    }
  });
});

describe('T-08B — Jerarquía visual de Inicio', () => {
  it('prioriza Agenda, semáforo y acciones antes de las alarmas recientes', () => {
    const html = inicio();
    const tituloAgenda = html.indexOf('>Agenda próxima</h2>');
    const tituloSemaforo = html.indexOf('>Semáforo de alarmas</h2>');
    const tituloAcciones = html.indexOf('>Acciones rápidas</h2>');
    const tituloAlarmas = html.indexOf('>Alarmas recientes</h2>');

    expect(tituloAgenda).toBeGreaterThanOrEqual(0);
    expect(tituloAgenda).toBeLessThan(tituloSemaforo);
    expect(tituloSemaforo).toBeLessThan(tituloAcciones);
    expect(tituloAcciones).toBeLessThan(tituloAlarmas);
  });

  it('reutiliza los tres conteos del Semáforo y conserva el acceso a su módulo', () => {
    const html = inicio();

    for (const nivel of hospitalAlertsDemo.resumen) {
      expect(texto(html)).toContain(nivel.etiqueta);
      expect(texto(html)).toContain(nivel.valor);
    }
    expect(control(html, 'Gestionar alarmas')?.vista).toBe('alarmas');
  });
});

describe('T-09 — Resumen de profesionales', () => {
  it('muestra 4 disponibles, 3 en visita y 2 en consulta', () => {
    expect(
      componerProfesionales().map((conteo) => `${conteo.etiqueta}=${conteo.valor}`),
    ).toEqual(['Disponibles=4', 'En visita=3', 'En consulta=2']);
  });

  it('reutiliza el desglose del KPI aprobado en vez de repetir los valores', () => {
    const kpi = hospitalKpisDemo.find((tarjeta) => tarjeta.id === 'profesionales-turno');

    expect(componerProfesionales().map((conteo) => conteo.valor)).toEqual(
      (kpi?.breakdown ?? []).map((fila) => fila.value),
    );
  });

  it('ofrece `Ver profesionales` hacia Profesionales', () => {
    expect(control(inicio(), 'Ver profesionales')?.vista).toBe('profesionales');
  });
});

describe('T-10 — Sección «Ir a»', () => {
  const accesos = componerAccesos();

  it('contiene los once módulos del menú, en su orden y con sus etiquetas', () => {
    expect(accesos.map((acceso) => acceso.id)).toEqual([
      'agenda',
      'pacientes',
      'alarmas',
      'profesionales',
      'visitas',
      'virtuales',
      'calificaciones',
      'novedades',
      'financiera',
      'reportes',
      'configuracion',
    ]);
    expect(accesos.map((acceso) => acceso.etiqueta)).toEqual(
      HOSPITAL_NAV_ITEMS.filter((item) => item.id !== 'inicio').map((item) => item.etiqueta),
    );
    expect(accesos.map((acceso) => acceso.icono)).toEqual(
      HOSPITAL_NAV_ITEMS.filter((item) => item.id !== 'inicio').map((item) => item.icono),
    );
  });

  /*
   * TASK-003H-07 activa «Reportes», el último acceso sin módulo. La regla no
   * cambia: la disponibilidad de `Ir a` sigue siendo exactamente la que
   * resuelve `destinoDeItem`, y desde esta tarea ninguno queda inerte.
   */
  it('la disponibilidad es la misma verdad funcional del sidebar', () => {
    for (const acceso of accesos) {
      expect(acceso.destino).toEqual(destinoDeItem(acceso.id));
    }
    expect(accesos.filter((acceso) => acceso.destino === null).map((acceso) => acceso.id)).toEqual(
      [],
    );
  });

  it('los módulos implementados navegan y los demás quedan inertes y explícitos', () => {
    const html = inicio();

    expect(apariciones(html, /data-hospital-acceso="navegable"/gu)).toBe(11);
    expect(apariciones(html, /data-hospital-acceso="sin-modulo"/gu)).toBe(0);

    for (const acceso of accesos) {
      const boton = control(html, acceso.etiqueta);

      if (acceso.destino === null) {
        expect(boton?.inerte).toBe(true);
        expect(boton?.texto).toContain('No disponible');
        expect(boton?.vista).toBe('');
      } else {
        expect(boton?.inerte).toBe(false);
        expect(boton?.vista).toBe(acceso.destino.vista);
        expect(boton?.texto).not.toContain('No disponible');
      }
    }
  });
});

describe('T-12 — Alcance negativo de Inicio', () => {
  it('no crea rutas, enlaces, scripts ni recursos remotos', () => {
    const html = inicio();

    expect(html).not.toContain('<a ');
    expect(html).not.toContain('href');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('http://');
    expect(html).not.toContain('https://');
  });

  it('toda la interacción son botones del shell', () => {
    const html = inicio();

    expect(apariciones(html, /<button/gu)).toBe(apariciones(html, /<button type="button"/gu));
    expect(apariciones(html, /<button/gu)).toBeGreaterThan(0);
  });

  it('el contenido operativo llega por configuración, no escrito en el JSX', () => {
    expect(hospitalInicioDemo.atencion.items).toEqual(componerAtencion());
    expect(hospitalInicioDemo.agenda.items).toEqual(componerAgendaProxima());
    expect(hospitalInicioDemo.alarmas.items).toEqual(componerAlarmasRecientes());
    expect(hospitalInicioDemo.profesionales.items).toEqual(componerProfesionales());
    expect(hospitalInicioDemo.accesos.items).toEqual(componerAccesos());
    expect(hospitalInicioDemo.acciones.items).toEqual(HOSPITAL_ACCIONES_RAPIDAS);
  });
});

describe('T-13/T-14 — Semántica, foco y estados con texto', () => {
  it('conserva un único `h1` y una jerarquía de secciones coherente', () => {
    const html = inicio();

    expect(apariciones(html, /<h1/gu)).toBe(1);
    expect(/<h1[^>]*>(?<cuerpo>[^<]*)<\/h1>/u.exec(html)?.groups?.cuerpo).toBe(
      'Atención domiciliaria de hoy',
    );
    expect(html.indexOf('<h1')).toBeLessThan(html.indexOf('<h2'));
    // Una sección con nombre por cada bloque del centro de control.
    expect(apariciones(html, /<h2/gu)).toBe(8);
    expect(apariciones(html, /aria-labelledby="hospital-inicio-/gu)).toBe(8);
  });

  it('el encabezado sigue recibiendo la fecha por configuración', () => {
    const html = renderToStaticMarkup(
      <HospitalDashboardHeader
        encabezado={{ ...hospitalDashboardHeaderDemo, fecha: 'Fecha demostrativa alterna' }}
        tituloId="prueba-titulo"
      />,
    );

    expect(html).toContain('Fecha demostrativa alterna');
    expect(html).not.toContain('Lunes 17 de agosto de 2026');
  });

  it('formatea la fecha operativa actual en español y en la hora local', () => {
    expect(formatearFechaOperativaActual(new Date(2026, 8, 21, 9, 5))).toBe(
      'Lunes 21 de septiembre de 2026 · 9:05 a. m.',
    );
    expect(formatearFechaOperativaActual(new Date(2026, 8, 21, 15, 5))).toBe(
      'Lunes 21 de septiembre de 2026 · 3:05 p. m.',
    );
  });

  it('los iconos son decorativos, ocultos y no enfocables', () => {
    const html = inicio();
    const svgs = apariciones(html, /<svg/gu);

    expect(svgs).toBeGreaterThan(0);
    expect(apariciones(html, /<svg[^>]*aria-hidden="true"/gu)).toBe(svgs);
    expect(apariciones(html, /<svg[^>]*focusable="false"/gu)).toBe(svgs);
    expect(html).not.toContain('<title>');
  });

  it('rojo, amarillo, sin asignar y no disponible se leen como texto', () => {
    const html = texto(inicio());

    expect(html).toContain('Alarma roja');
    expect(html).toContain('Alarma amarilla');
    expect(html).toContain('ROJA');
    expect(html).toContain('AMARILLA');
    expect(html).toContain('Sin asignar');
  });

  it('no usa contenedores con onClick ni `tabindex` artificial', () => {
    const html = inicio();

    expect(html).not.toContain('tabindex');
    expect(html).not.toContain('onclick');
    expect(html).not.toContain('role="button"');
  });

  it('la configuración demostrativa conserva los siete KPI del contrato', () => {
    expect(hospitalDashboardDemo.kpis).toEqual(hospitalKpisDemo);
  });
});
