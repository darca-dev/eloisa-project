import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { branding } from '@/config/branding';

import { HospitalShell } from './HospitalShell';
import { HospitalReports } from './HospitalReports';
import { SESION_INSTITUCIONAL_FICTICIA, apariciones, main, texto } from './hospitalTestUtils';
import {
  REPORTE_ACCIONES,
  REPORTE_ESTADO_INICIAL,
  REPORTE_FILTROS_INICIALES,
  REPORTE_MOTIVO_EXPORTACION,
  aplicarFiltros,
  limpiarFiltros,
  resumenDeFiltros,
} from './hospitalReportsConfig';
import { EVIDENCIAS_DEMO } from './hospitalReportsInstitutional';
import { pacientesPoblacionDemo } from './hospitalPopulationFixtures';
import {
  REPORTE_ETIQUETA_SUBTAB,
  REPORTE_ETIQUETA_TAB,
  REPORTE_SUBTABS,
  REPORTE_TABS,
  type ReporteAudienciaId,
  type ReporteSubtabId,
  type ReporteTabId,
} from './hospitalReportsTypes';

/**
 * Pruebas de la vista «Reportes» (TASK-003H-07, §9).
 *
 * Se renderiza con `react-dom/server`, igual que el resto del frontend: el
 * repositorio no incluye jsdom ni una librería de testing con DOM y esta tarea
 * no autoriza añadir dependencias. Por eso se verifica el marcado renderizado y
 * las transiciones puras, que están extraídas como funciones.
 *
 * Seguridad visual: se comprueba que la vista institucional / Alcaldía no
 * publique nombres de personas, documentos, contactos, diagnósticos, importes
 * individuales de nómina u honorarios ni controles de drill-down. NO es una
 * prueba de autorización: el control server-side pertenece al backend futuro.
 */

const PANTALLAS = new Map<string, string>();

/** Fixture SSR compartida por todas las props fijas; no por estados/filtros. */
function vista({
  audiencia = 'hospital',
  tab = 'resumen',
  subtab,
  evidencia,
  detalle,
}: {
  readonly audiencia?: ReporteAudienciaId;
  readonly tab?: ReporteTabId;
  readonly subtab?: ReporteSubtabId;
  readonly evidencia?: string;
  readonly detalle?: string;
} = {}): string {
  const key = JSON.stringify([audiencia, tab, subtab, evidencia, detalle]);
  const existente = PANTALLAS.get(key);
  if (existente !== undefined) return existente;
  const html = renderToStaticMarkup(
    <HospitalReports
      audienciaInicial={audiencia}
      tabInicial={tab}
      subtabInicial={subtab}
      evidenciaInicial={evidencia ?? null}
      detalleInicial={detalle ?? null}
    />,
  );
  PANTALLAS.set(key, html);
  return html;
}

/** Nombres ficticios del padrón que jamás deben aparecer en la Alcaldía. */
const NOMBRES_DEL_PADRON = pacientesPoblacionDemo()
  .slice(0, 60)
  .map((paciente) => paciente.nombre);

/* ========================================================================== */

describe('T-09 — Activación de Reportes en el shell', () => {
  it('el menú abre Reportes dentro del mismo shell, sin ruta nueva', () => {
    const html = renderToStaticMarkup(<HospitalShell sesionInicial={SESION_INSTITUCIONAL_FICTICIA} vistaInicial="reportes" />);

    expect(html).toContain('data-hospital-content="reportes"');
    expect(apariciones(html, /<main\b/gu)).toBe(1);
    expect(apariciones(main(html), /<h1\b/gu)).toBe(1);
    expect(texto(main(html))).toContain('Reportes');
    expect(html).not.toContain('href');
  });
});

/* ========================================================================== */

describe('T-10 — Encabezado, filtros y tabs', () => {
  const html = vista();

  it('declara badge, fecha de corte y las dos audiencias', () => {
    const plano = texto(html);

    expect(plano).toContain('Datos demostrativos');
    expect(plano).toContain('Corte 20 de agosto de 2026');
    expect(plano).toContain('Vista Hospital');
    expect(plano).toContain('Vista institucional / Alcaldía');
    expect(html).toContain('data-hospital-audiencia-activa="hospital"');
  });

  it('el periodo no ofrece opción vacía y el resto sí', () => {
    const periodo = /<select[^>]*id="hospital-reportes-filtro-periodo"[\s\S]*?<\/select>/u.exec(
      html,
    )?.[0];
    const programa = /<select[^>]*id="hospital-reportes-filtro-programa"[\s\S]*?<\/select>/u.exec(
      html,
    )?.[0];

    expect(periodo).toBeDefined();
    expect(periodo).not.toContain('value=""');
    expect(programa).toContain('value=""');
  });

  it('publica los cinco tabs en el orden vinculante', () => {
    const orden = [...html.matchAll(/data-hospital-tab="(?<id>[a-z]+)"/gu)].map(
      (coincidencia) => coincidencia.groups?.id,
    );

    expect(orden).toEqual([...REPORTE_TABS]);

    for (const tab of REPORTE_TABS) {
      expect(texto(html)).toContain(REPORTE_ETIQUETA_TAB[tab]);
    }
  });

  it('el tab activo se anuncia sin depender del color', () => {
    expect(html).toContain('data-hospital-tab="resumen"');
    expect(/aria-selected="true"[^>]*data-hospital-tab="resumen"/u.test(html)).toBe(true);
  });
});

/* ========================================================================== */

describe('T-10C — Contrato funcional y accesible de los filtros', () => {
  const html = vista();

  it('conserva los seis grupos con sus controles y su orden vinculante', () => {
    const controles = [...html.matchAll(/id="hospital-reportes-filtro-(?<id>[a-z]+)"/gu)].map(
      (coincidencia) => coincidencia.groups?.id,
    );

    expect(controles).toEqual([
      'periodo',
      'programa',
      'municipio',
      'prioridades',
      'eps',
      'modalidad',
    ]);
    /* Cada `select` conserva su etiqueta asociada por `for`/`id`. */
    for (const id of ['periodo', 'programa', 'municipio', 'eps', 'modalidad']) {
      expect(html).toContain(`for="hospital-reportes-filtro-${id}"`);
      expect(html).toContain(`<select id="hospital-reportes-filtro-${id}"`);
    }
    /* Los chips siguen agrupados y nombrados por la etiqueta del grupo. */
    expect(html).toContain('aria-labelledby="hospital-reportes-filtro-prioridades"');
  });

  it('«Población prioritaria» sigue siendo multiselección combinable', () => {
    /* Los tres chips se anuncian por estado, no por color. */
    expect(apariciones(html, /aria-pressed="false"/gu)).toBeGreaterThanOrEqual(3);

    const combinado = aplicarFiltros(REPORTE_ESTADO_INICIAL, {
      prioridades: { mayor60: true, discapacidad: true, cuidadosCasa: true },
    });

    expect(combinado.filtros.prioridades).toEqual({
      mayor60: true,
      discapacidad: true,
      cuidadosCasa: true,
    });
    /* El periodo obligatorio y el resto del estado no cambian por un chip. */
    expect(combinado.filtros.periodo).toBe(REPORTE_FILTROS_INICIALES.periodo);
    expect(combinado.tab).toBe(REPORTE_ESTADO_INICIAL.tab);
  });

  it('«Limpiar filtros» y las acciones conservan significado y estado', () => {
    const limpiado = limpiarFiltros(
      aplicarFiltros(REPORTE_ESTADO_INICIAL, { programa: 'Cuidado en casa' }),
    );

    expect(limpiado.filtros).toEqual(REPORTE_FILTROS_INICIALES);
    expect(limpiado.anuncio).toBe(
      `Filtros limpiados. ${resumenDeFiltros(REPORTE_FILTROS_INICIALES)}.`,
    );
    expect(texto(html)).toContain('Limpiar filtros');

    /* Las cuatro acciones siguen inertes dentro de la barra compacta. */
    for (const accion of REPORTE_ACCIONES) {
      const boton = new RegExp(`<button[^>]*data-hospital-accion="${accion.id}"[^>]*>`, 'u').exec(
        html,
      )?.[0];

      expect(boton).toBeDefined();
      expect(boton).toContain('disabled');
    }
  });
});

/* ========================================================================== */

describe('T-10B — Los tabs son un «tablist» accesible y navegable', () => {
  it('declara tablist con nombre accesible y cinco controles «tab»', () => {
    const html = vista();

    expect(html).toContain('role="tablist"');
    expect(html).toContain('aria-label="Secciones del reporte"');
    expect(apariciones(html, /role="tab"/gu)).toBe(REPORTE_TABS.length);
  });

  it('solo el tab activo declara «aria-selected» y «tabIndex» cero', () => {
    for (const tab of REPORTE_TABS) {
      const html = vista({ tab });

      expect(apariciones(html, /aria-selected="true"/gu)).toBe(1);
      expect(apariciones(html, /aria-selected="false"/gu)).toBe(REPORTE_TABS.length - 1);
      expect(apariciones(html, /role="tab"[^>]*tabindex="0"|tabindex="0"[^>]*role="tab"/gu)).toBe(1);
      expect(/aria-selected="true"[^>]*data-hospital-tab="([a-z]+)"/u.exec(html)?.[1]).toBe(tab);
    }
  });

  it('cada tab apunta a su panel y cada panel a su tab, con identificadores estables', () => {
    for (const tab of REPORTE_TABS) {
      const html = vista({ tab });

      expect(html).toContain(`id="hospital-reportes-tab-${tab}"`);
      expect(html).toContain(`aria-controls="hospital-reportes-panel-${tab}"`);
      expect(html).toContain(`id="hospital-reportes-panel-${tab}"`);
      expect(html).toContain(`aria-labelledby="hospital-reportes-tab-${tab}"`);
    }
  });

  it('solo hay un panel activo en cada momento', () => {
    for (const tab of REPORTE_TABS) {
      const html = vista({ tab });

      expect(apariciones(html, /role="tabpanel"/gu)).toBe(1);
      expect(apariciones(html, /data-hospital-panel="[a-z]+"/gu)).toBe(1);
      expect(html).toContain(`data-hospital-panel="${tab}"`);
    }
  });

  it('los controles son botones reales, que «Enter» y «Space» activan de forma nativa', () => {
    const html = vista();

    expect(apariciones(html, /role="tab"/gu)).toBe(
      apariciones(html, /<button type="button" role="tab"/gu),
    );
    expect(html).not.toContain('autofocus');
  });
});

/* ========================================================================== */

describe('T-11 — Acciones de exportación inertes', () => {
  it('las cuatro acciones están deshabilitadas y escriben su motivo', () => {
    const html = vista();

    for (const accion of REPORTE_ACCIONES) {
      const boton = new RegExp(
        `<button[^>]*data-hospital-accion="${accion.id}"[^>]*>`,
        'u',
      ).exec(html)?.[0];

      expect(boton).toBeDefined();
      expect(boton).toContain('disabled');
      expect(boton).toContain('aria-disabled="true"');
    }

    expect(texto(html)).toContain(REPORTE_MOTIVO_EXPORTACION);
  });

  it('no existe descarga, impresión, formulario ni recurso remoto', () => {
    for (const tab of REPORTE_TABS) {
      const html = vista({ tab });

      expect(html).not.toContain('<a ');
      expect(html).not.toContain('href');
      expect(html).not.toContain('download');
      expect(html).not.toContain('<form');
      expect(html).not.toContain('<script');
      expect(html).not.toContain('http://');
      expect(html).not.toContain('https://');
    }
  });
});

/* ========================================================================== */

describe('T-12 — Contenido de cada tab', () => {

  it('Finanzas publica los siete KPI, la composición y los indicadores descriptivos', () => {
    const plano = texto(vista({ tab: 'finanzas' }));

    for (const etiqueta of [
      'Presupuesto',
      'Ingresos',
      'Egresos',
      'Comprometido',
      'Ejecutado',
      'Disponible',
      'Ejecución %',
      'Nómina',
      'Honorarios',
      'Gastos operativos',
      'Proveedores',
      'Insumos',
      'Convenios',
      'Pagos pendientes',
      'Evidencias financieras faltantes',
      'Población y recursos por programa',
    ]) {
      expect(plano).toContain(etiqueta);
    }
    expect(plano).toContain('Indicadores descriptivos; no demuestran causalidad ni resultado clínico.');
  });

  it('Evidencias e institucional publica los cinco espacios y sus límites', () => {
    for (const subtab of REPORTE_SUBTABS) {
      const plano = texto(vista({ tab: 'institucional', subtab }));

      expect(plano).toContain(REPORTE_ETIQUETA_SUBTAB[subtab]);
    }

    const furag = texto(vista({ tab: 'institucional', subtab: 'furag' }));
    const adres = texto(vista({ tab: 'institucional', subtab: 'adres' }));
    const sena = texto(vista({ tab: 'institucional', subtab: 'sena' }));
    const t319 = texto(vista({ tab: 'institucional', subtab: 't319' }));

    expect(furag).toContain('no asigna puntajes oficiales ni certifica cumplimiento');
    expect(adres).toContain('no es el regulador');
    expect(adres).toContain('no tiene conexión con ADRES');
    expect(sena).toContain('no prueba competencia');
    expect(t319).toContain('no certifica cumplimiento judicial');
  });

  it('los cuatro estados de evidencia se leen como texto', () => {
    const plano = texto(vista({ tab: 'institucional' }));

    for (const estado of ['Completa', 'Pendiente', 'Requiere corrección', 'Validada']) {
      expect(plano).toContain(estado);
    }
  });

  it('el panel de metadatos nunca muestra el documento real', () => {
    const identificador = EVIDENCIAS_DEMO[0]?.id ?? '';
    const html = vista({ tab: 'institucional', evidencia: identificador });

    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(texto(html)).toContain('El documento no se muestra en esta pantalla');
  });
});

/* ========================================================================== */

describe('T-13 — Seguridad visual de la vista Alcaldía', () => {
  const tabs: readonly ReporteTabId[] = REPORTE_TABS;

  it('nunca publica nombres del padrón, documentos ni contactos', () => {
    for (const tab of tabs) {
      const plano = texto(vista({ audiencia: 'alcaldia', tab }));

      expect(plano).not.toMatch(/\bCC \d/u);
      expect(plano).not.toMatch(/\b3\d{2} \d{3} \d{4}\b/u);
      expect(plano).not.toMatch(/Cra \d|Calle \d/u);

      for (const nombre of NOMBRES_DEL_PADRON) {
        expect(plano).not.toContain(nombre);
      }
    }
  });

  it('nunca publica profesional nominal ni remuneración individual', () => {
    for (const tab of tabs) {
      const plano = texto(vista({ audiencia: 'alcaldia', tab }));

      expect(plano).not.toMatch(/\bDra?\.\s|\bEnf\.\s|\bFt\.\s|\bPs\.\s|\bNut\.\s/u);
    }

    const finanzas = texto(vista({ audiencia: 'alcaldia', tab: 'finanzas' }));

    expect(finanzas).toContain('No incluye persona, registro individual ni importe individual');
    expect(finanzas).toContain('Nómina');

    /*
     * Control positivo: la vista Hospital SÍ desagrega la carga por profesional
     * responsable, de modo que la comprobación anterior no es vacía.
     */
    expect(texto(vista({ audiencia: 'hospital', tab: 'operacion' }))).toMatch(
      /\bDra?\.\s|\bEnf\.\s|\bFt\.\s/u,
    );
  });

  it('no ofrece drill-down: la matriz no expone el control de detalle agregado', () => {
    const alcaldia = vista({ audiencia: 'alcaldia', tab: 'poblacion' });
    const hospital = vista({ audiencia: 'hospital', tab: 'poblacion' });

    expect(alcaldia).not.toContain('data-hospital-detalle');
    expect(texto(alcaldia)).not.toContain('Ver detalle agregado');
    expect(hospital).toContain('data-hospital-detalle');
  });

  it('el detalle agregado de Hospital no contiene información nominal ni clínica', () => {
    const html = vista({ audiencia: 'hospital', tab: 'poblacion', detalle: 'las-tres' });
    const plano = texto(html);

    expect(html).toContain('role="dialog"');
    expect(plano).toContain('Detalle operativo agregado');
    expect(plano).toContain('Personas en la combinación');
    expect(plano).toContain('no contiene nombres, documentos, contactos ni información clínica');

    for (const nombre of NOMBRES_DEL_PADRON) {
      expect(plano).not.toContain(nombre);
    }
  });

  it('el aviso de audiencia describe exactamente lo que la Alcaldía no recibe', () => {
    const plano = texto(vista({ audiencia: 'alcaldia' }));

    expect(plano).toContain('No incluye información clínica nominal');
    expect(plano).toContain('salarios u honorarios individuales');
    expect(plano).toContain('drill-down ni exportación');
  });

  it('la vista Hospital tampoco reproduce el listado nominal de Pacientes', () => {
    for (const tab of tabs) {
      const plano = texto(vista({ audiencia: 'hospital', tab }));

      expect(plano).not.toMatch(/\bCC \d/u);

      for (const nombre of NOMBRES_DEL_PADRON) {
        expect(plano).not.toContain(nombre);
      }
    }
  });
});

/* ========================================================================== */

describe('T-14 — Accesibilidad y estados', () => {
  it('cada gráfico declara título, unidad, periodo, procedencia y tabla de valores', () => {
    const html = vista({ tab: 'operacion' });
    const plano = texto(html);

    expect(apariciones(html, /Ver tabla de valores/gu)).toBeGreaterThan(0);
    expect(apariciones(html, /<caption>/gu)).toBeGreaterThan(0);
    expect(plano).toContain('Procedencia:');
    expect(plano).toContain('Dato disponible');
  });

  it('ningún control depende del color: usa `aria-pressed` y texto', () => {
    const html = vista();

    expect(apariciones(html, /aria-pressed="true"/gu)).toBeGreaterThan(0);
    expect(apariciones(html, /<button/gu)).toBe(apariciones(html, /<button type="button"/gu));
    expect(html).not.toContain('role="button"');
    expect(html).not.toContain('onclick');
  });

  it('el cambio de audiencia se anuncia en una región de estado', () => {
    const html = renderToStaticMarkup(<HospitalReports audienciaInicial="alcaldia" />);

    expect(html).toContain('role="status"');
    expect(texto(html)).toContain('Audiencia activa: Vista institucional / Alcaldía');
  });

  it('el estado de carga no publica cifras y el de error permite reintentar', () => {
    const cargando = renderToStaticMarkup(<HospitalReports estadoInicial="cargando" />);
    const error = renderToStaticMarkup(<HospitalReports estadoInicial="error" />);

    expect(cargando).toContain('aria-hidden="true"');
    expect(texto(cargando)).not.toContain('Pacientes activos');
    expect(texto(error)).toContain('No fue posible mostrar el reporte');
    expect(texto(error)).toContain('Reintentar');
  });

  it('el dato ausente se escribe como texto y nunca como cero', () => {
    const plano = texto(
      renderToStaticMarkup(
        <HospitalReports tabInicial="finanzas" filtrosIniciales={{ periodo: 'Junio 2026' }} />,
      ),
    );

    expect(plano).toContain('Sin datos');
    expect(plano).toContain('Ausente no es cero');
  });
});

/* ========================================================================== */

describe('T-15 — Marca visible y alcance', () => {
  it('usa exclusivamente la marca centralizada y ninguna terminología interna', () => {
    for (const tab of REPORTE_TABS) {
      const plano = texto(vista({ tab }));

      expect(plano).not.toMatch(/MERDN/iu);
      expect(plano).not.toContain('DATO_OFICIAL_EXTERNO');
      expect(plano).not.toContain('DEMOSTRATIVO');
    }

    expect(texto(vista({ tab: 'institucional', subtab: 'furag' }))).toContain(
      branding.platformDisplayName,
    );
  });

  it('declara el alcance demostrativo y la ausencia de fuentes conectadas', () => {
    const plano = texto(vista());

    expect(plano).toContain('no consulta fuentes oficiales');
    expect(plano).toContain('no certifica cumplimiento');
    expect(plano).toContain('no se fabrica actualidad');
  });
});

/* ========================================================================== */

describe('T-16 — Nombre visible de la Sentencia T-319 de 2025', () => {
  it('escribe el nombre completo en el subtab, el espacio y las evidencias', () => {
    const html = vista({ tab: 'institucional', subtab: 't319' });
    const plano = texto(html);

    expect(plano).toContain('Sentencia T-319 de 2025');
    expect(apariciones(plano, /Sentencia T-319 de 2025/gu)).toBeGreaterThan(1);
    expect(plano).toContain('La trazabilidad no certifica cumplimiento judicial');
  });

  it('nunca escribe el nombre incompleto ni lo confunde con una ley', () => {
    for (const subtab of REPORTE_SUBTABS) {
      const plano = texto(vista({ tab: 'institucional', subtab }));

      expect(plano).not.toMatch(/Ley 319/u);
      /* Toda mención de la sentencia va precedida de la palabra «Sentencia». */
      expect(plano).not.toMatch(/(?<!Sentencia )T-319 de 2025/u);
    }
  });
});
