import { formatearNumero } from './hospitalPopulationAnalytics';
import { FINANCIERA_PLATAFORMA } from './hospitalFinancialConfig';
import type { FinancialFila, FinancialSeccionId } from './hospitalFinancialConfig';
import type { FinancialConfig, FinancialLineaPresupuesto } from './hospitalFinancialContracts';
import { hospitalFinancieraDemo } from './hospitalFinancialDemo';
import { normalizarFiltros } from './hospitalReportsConfig';
import { OPERACION_PERIODOS } from './hospitalReportsOperationalFixtures';
import {
  FINANZAS_VERSION_DEFINICION,
  REPORTE_SIN_DATOS,
  type FinancialAnalyticsSnapshotV1,
  type ReporteAudienciaId,
  type ReporteCifra,
  type ReporteDesglose,
  type ReporteFila,
  type ReporteFiltros,
  type ReporteGrafico,
  type ReportePunto,
  type ReporteTabla,
} from './hospitalReportsTypes';

/**
 * Proyección financiera de Reportes, versionada `financial-v1`
 * (TASK-003H-07, §3.5 y §4).
 *
 * Consume EXCLUSIVAMENTE los fixtures de «Gestión financiera» (H-06/H-06A) a
 * través de `hospitalFinancieraDemo`. Este módulo no declara ninguna cifra
 * propia, no inventa fórmulas contables y no modifica el módulo financiero:
 * solo lo lee, lo recorta por los filtros de la barra global y lo proyecta al
 * contrato que la vista consume.
 *
 * Consolidación (§3.5): cuando la fuente no publica una cifra agregada, se
 * consolida a partir de los registros que sí publica, deduplicando por la
 * identidad del registro de origen. Un registro nunca se suma dos veces y el
 * desglose por origen queda siempre visible. Cuando no hay ningún registro que
 * consolidar, la cifra se declara ausente: ausente NO es cero.
 *
 * Proyección por audiencia (§3.8): la vista institucional / Alcaldía recibe
 * nómina, honorarios y pagos únicamente agregados, sin persona, sin registro
 * individual y sin importe individual.
 *
 * Alcance: presentación. No hay contabilidad, no hay aprobación, no hay pago,
 * no hay edición y no hay indicador oficial.
 */

/* ========================================================================== */
/* Importes                                                                   */
/* ========================================================================== */

/** Moneda única del conjunto demostrativo. */
export const FINANZAS_MONEDA = 'COP';

/**
 * Importe numérico de un texto del fixture, o `null` si no es un importe.
 *
 * Los fixtures escriben los importes como `1.400.000.000 COP`: el punto es
 * separador de miles y no hay decimales. Un texto que no cumple exactamente
 * ese patrón —`3 cuentas`, `50 %`, `Por definir`— no es un importe y devuelve
 * `null` en vez de cero.
 */
export function montoDe(texto: string): number | null {
  const limpio = texto.trim();

  if (!/^\d{1,3}(?:\.\d{3})*\s?COP$/u.test(limpio)) {
    return null;
  }

  return Number(limpio.replace(/\s?COP$/u, '').replace(/\./gu, ''));
}

/** Importe redactado con su moneda, tal como lo escriben los fixtures. */
export function textoMonto(valor: number): string {
  return `${formatearNumero(valor)} ${FINANZAS_MONEDA}`;
}

/** Primer importe de una fila del módulo financiero; `null` si no lo tiene. */
export function importeDeFila(fila: FinancialFila): number | null {
  for (const celda of fila.celdas) {
    if (celda.tipo === 'importe') {
      const monto = montoDe(celda.valor);

      if (monto !== null) {
        return monto;
      }
    }
  }

  return null;
}

/* ========================================================================== */
/* Consolidación deduplicada                                                  */
/* ========================================================================== */

/** Resultado de consolidar un conjunto de registros con importe. */
export interface Consolidado {
  /** `null` cuando no hubo ningún registro consolidable. Nunca cero por defecto. */
  readonly total: number | null;
  readonly desglose: readonly ReporteDesglose[];
  /** Identidades efectivamente contadas, ya deduplicadas. */
  readonly identidades: readonly string[];
  /** Identidades descartadas por estar repetidas en la fuente. */
  readonly duplicados: readonly string[];
}

/** Registro consolidable: identidad estable, origen e importe. */
export interface RegistroConsolidable {
  readonly id: string;
  readonly origen: string;
  readonly valor: number | null;
}

/**
 * Consolida deduplicando por identidad de origen (§3.5).
 *
 * Un identificador repetido se cuenta UNA sola vez: la fuente puede publicar
 * el mismo registro en más de una sección —presupuesto y ejecución comparten
 * líneas— y sumarlo dos veces produciría doble conteo.
 */
export function consolidar(registros: readonly RegistroConsolidable[]): Consolidado {
  const vistos = new Set<string>();
  const duplicados: string[] = [];
  const porOrigen = new Map<string, number>();
  let total: number | null = null;

  for (const registro of registros) {
    if (registro.valor === null) {
      continue;
    }
    if (vistos.has(registro.id)) {
      duplicados.push(registro.id);
      continue;
    }

    vistos.add(registro.id);
    total = (total ?? 0) + registro.valor;
    porOrigen.set(registro.origen, (porOrigen.get(registro.origen) ?? 0) + registro.valor);
  }

  return {
    total,
    desglose: [...porOrigen.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es-CO'))
      .map(([origen, valor]) => ({
        id: `origen-${origen}`,
        etiqueta: origen,
        valor: textoMonto(valor),
        procedencia: origen,
      })),
    identidades: [...vistos],
    duplicados,
  };
}

/* ========================================================================== */
/* Recorte por filtros                                                        */
/* ========================================================================== */

/** `true` cuando la línea de presupuesto satisface periodo y programa. */
function lineaEnRecorte(
  linea: FinancialLineaPresupuesto,
  periodo: string,
  programa: string | null,
): boolean {
  return linea.periodo === periodo && (programa === null || linea.programa === programa);
}

/** `true` cuando la fila financiera satisface periodo y programa. */
function filaEnRecorte(fila: FinancialFila, periodo: string, programa: string | null): boolean {
  return fila.periodo === periodo && (programa === null || fila.programa === programa);
}

/** Filas de una sección de H-06 recortadas por periodo y programa. */
function filasDe(
  config: FinancialConfig,
  seccion: FinancialSeccionId,
  periodo: string,
  programa: string | null,
): readonly FinancialFila[] {
  const tabla = config.secciones[seccion];

  return (tabla?.filas ?? []).filter((fila) => filaEnRecorte(fila, periodo, programa));
}

/* ========================================================================== */
/* Cifras                                                                     */
/* ========================================================================== */

const PROCEDENCIA_CONSOLIDADA = 'Consolidado con desglose por origen';

const LIMITACION_COMUN =
  'Cifra financiera demostrativa procedente de Gestión financiera. No es contabilidad oficial, no acredita ejecución presupuestal y no habilita ningún pago.';

/** Cifra financiera completa a partir de un valor ya redactado. */
function cifra(
  id: string,
  etiqueta: string,
  valor: string,
  unidad: string,
  periodo: string,
  procedencia: string,
  definicion: string,
  estado: ReporteCifra['estado'],
  desglose?: readonly ReporteDesglose[],
): ReporteCifra {
  return {
    id,
    etiqueta,
    valor,
    unidad,
    periodo,
    procedencia,
    clase: 'DEMOSTRATIVO',
    estado,
    definicion,
    version: FINANZAS_VERSION_DEFINICION,
    limitaciones: LIMITACION_COMUN,
    desglose,
  };
}

/**
 * Cifra tomada literalmente de un KPI de H-06, sin recalcularla.
 *
 * Gestión financiera publica sus KPI para un único periodo y SIEMPRE con
 * cobertura global de la institución: no publica ninguno de ellos por
 * programa. Por eso la cifra se declara ausente en dos casos, y en los dos se
 * escribe `Sin datos` en vez de un número:
 *
 * - cuando el periodo seleccionado no es el que la fuente publica, porque una
 *   cifra de otro periodo presentada como actual sería un dato falso (AC-11);
 * - cuando hay un filtro de Programa aplicado, porque sustituirla por el total
 *   institucional mezclaría en la misma pantalla un universo global con las
 *   cifras ya recortadas por programa.
 *
 * Reportes no deriva aquí ninguna cifra por programa: hacerlo exigiría una
 * fórmula financiera que esta tarea no autoriza y que la fuente no publica.
 */
function cifraDeFuente(
  config: FinancialConfig,
  kpiId: string,
  etiqueta: string,
  unidad: string,
  periodo: string,
  programa: string | null,
): ReporteCifra {
  const origen = config.resumen.kpis.find((kpi) => kpi.id === kpiId);

  if (programa !== null) {
    return cifra(
      kpiId,
      etiqueta,
      REPORTE_SIN_DATOS,
      unidad,
      periodo,
      'Gestión financiera',
      `Gestión financiera publica esta cifra únicamente con cobertura global de la institución y no la publica por programa. Con el filtro Programa «${programa}» aplicado, la cobertura es incompatible y la cifra no se sustituye por el total institucional. Ausente no es cero.`,
      'ausente',
    );
  }

  if (origen === undefined || origen.periodo !== periodo) {
    return cifra(
      kpiId,
      etiqueta,
      REPORTE_SIN_DATOS,
      unidad,
      periodo,
      'Gestión financiera',
      `Gestión financiera no publica esta cifra para el periodo ${periodo}. Ausente no es cero y no se sustituye por la cifra de otro periodo.`,
      'ausente',
    );
  }

  return cifra(
    kpiId,
    etiqueta,
    origen.valor,
    unidad,
    origen.periodo,
    origen.origen,
    `Valor publicado por Gestión financiera para el periodo ${origen.periodo}. Reportes lo lee tal cual: no lo recalcula, no lo deriva y no le aplica ninguna fórmula.`,
    'disponible',
  );
}

/**
 * `Ejecutado` consolidado (§3.5).
 *
 * Gestión financiera no publica un total ejecutado del periodo: publica el
 * ejecutado de cada línea. Reportes lo consolida deduplicando por el
 * identificador de la línea de origen —presupuesto y ejecución comparten
 * líneas— y muestra el desglose por origen. Sin líneas del periodo la cifra se
 * declara ausente.
 */
function cifraEjecutado(
  config: FinancialConfig,
  periodo: string,
  programa: string | null,
): ReporteCifra {
  const lineas = config.ejecucion.filter((linea) => lineaEnRecorte(linea, periodo, programa));
  const resultado = consolidar(
    lineas.map((linea) => ({
      id: linea.id,
      origen: linea.origen,
      valor: montoDe(linea.ejecutado),
    })),
  );

  return cifra(
    'kpi-ejecutado',
    'Ejecutado',
    resultado.total === null ? REPORTE_SIN_DATOS : textoMonto(resultado.total),
    FINANZAS_MONEDA,
    periodo,
    resultado.total === null ? 'Gestión financiera' : PROCEDENCIA_CONSOLIDADA,
    `Suma del ejecutado de las líneas del periodo publicadas por Gestión financiera, deduplicadas por identificador de línea. Líneas contadas: ${String(resultado.identidades.length)}. Repetidas descartadas: ${String(resultado.duplicados.length)}.`,
    resultado.total === null ? 'ausente' : 'disponible',
    resultado.desglose,
  );
}

/** Los siete KPI financieros, en el orden vinculante de §3.5. */
function kpiFinanciero(
  config: FinancialConfig,
  periodo: string,
  programa: string | null,
): readonly ReporteCifra[] {
  return [
    cifraDeFuente(config, 'kpi-asignado', 'Presupuesto', FINANZAS_MONEDA, periodo, programa),
    cifraDeFuente(config, 'kpi-ingresos', 'Ingresos', FINANZAS_MONEDA, periodo, programa),
    cifraDeFuente(config, 'kpi-egresos', 'Egresos', FINANZAS_MONEDA, periodo, programa),
    cifraDeFuente(config, 'kpi-comprometido', 'Comprometido', FINANZAS_MONEDA, periodo, programa),
    cifraEjecutado(config, periodo, programa),
    cifraDeFuente(config, 'kpi-disponible', 'Disponible', FINANZAS_MONEDA, periodo, programa),
    cifraDeFuente(config, 'kpi-ejecucion', 'Ejecución %', 'Porcentaje', periodo, programa),
  ];
}

/* ========================================================================== */
/* Tablas y gráficos                                                          */
/* ========================================================================== */

/** Ejecución por programa, leída literalmente de las líneas de H-06. */
function tablaEjecucion(
  config: FinancialConfig,
  periodo: string,
  programa: string | null,
): ReporteTabla {
  const lineas = config.presupuesto.filter((linea) => lineaEnRecorte(linea, periodo, programa));

  return {
    id: 'ejecucion-programa',
    titulo: 'Ejecución por programa',
    leyenda:
      'Asignado, comprometido, ejecutado, disponible y porcentaje de ejecución de cada programa, con la fuente de cada línea.',
    columnas: [
      { id: 'programa', etiqueta: 'Programa' },
      { id: 'rubro', etiqueta: 'Rubro' },
      { id: 'asignado', etiqueta: 'Asignado', numerica: true },
      { id: 'comprometido', etiqueta: 'Comprometido', numerica: true },
      { id: 'ejecutado', etiqueta: 'Ejecutado', numerica: true },
      { id: 'disponible', etiqueta: 'Disponible', numerica: true },
      { id: 'ejecucion', etiqueta: 'Ejecución', numerica: true },
      { id: 'fuente', etiqueta: 'Fuente' },
    ],
    filas: lineas.map(
      (linea): ReporteFila => ({
        id: linea.id,
        celdas: [
          linea.programa,
          linea.rubro,
          linea.asignado,
          linea.comprometido,
          linea.ejecutado,
          linea.disponible,
          linea.ejecucion,
          linea.origen,
        ],
      }),
    ),
    nota: `Periodo ${periodo}. Cifras publicadas por Gestión financiera; Reportes no calcula compromiso, ejecución, disponible ni porcentaje.`,
    vacio: 'Gestión financiera no publica líneas de presupuesto para este recorte.',
  };
}

/**
 * Ejecución por programa como barras.
 *
 * Reutiliza exactamente las líneas que publica Gestión financiera: el gráfico
 * no recalcula nada, solo representa el ejecutado ya publicado de cada línea.
 */
function graficoEjecucion(
  config: FinancialConfig,
  periodo: string,
  programa: string | null,
): ReporteGrafico {
  const lineas = config.presupuesto.filter((linea) => lineaEnRecorte(linea, periodo, programa));
  const puntos: ReportePunto[] = lineas.map((linea) => {
    const ejecutado = montoDe(linea.ejecutado);

    return {
      id: `eje-${linea.id}`,
      etiqueta: linea.programa,
      valor: ejecutado ?? 0,
      texto: ejecutado === null ? REPORTE_SIN_DATOS : `${linea.ejecutado} · ${linea.ejecucion}`,
    };
  });

  return {
    id: 'ejecucion-barras',
    titulo: 'Ejecución por programa',
    unidad: FINANZAS_MONEDA,
    periodo,
    nota: 'Ejecutado publicado por Gestión financiera para cada línea del periodo. Reportes no calcula el porcentaje de ejecución: lo lee de la fuente.',
    procedencia: `Sistema del Hospital y ${FINANCIERA_PLATAFORMA}`,
    estado: puntos.length === 0 ? 'ausente' : 'disponible',
    series: [{ id: 'ejecutado', etiqueta: 'Ejecutado', puntos }],
    encabezado: 'Programa',
  };
}

/** Ingresos y egresos por periodo, tomados del flujo publicado por H-06. */
function graficoFlujo(config: FinancialConfig, periodo: string): ReporteGrafico {
  const ingresos: ReportePunto[] = [];
  const egresos: ReportePunto[] = [];

  for (const columna of config.resumen.flujo) {
    const entrada = montoDe(columna.ingresos);
    const salida = montoDe(columna.egresos);

    ingresos.push({
      id: `ing-${columna.id}`,
      etiqueta: columna.etiqueta,
      valor: entrada ?? 0,
      texto: entrada === null ? REPORTE_SIN_DATOS : columna.ingresos,
    });
    egresos.push({
      id: `egr-${columna.id}`,
      etiqueta: columna.etiqueta,
      valor: salida ?? 0,
      texto: salida === null ? REPORTE_SIN_DATOS : columna.egresos,
    });
  }

  return {
    id: 'flujo',
    titulo: 'Ingresos y egresos por periodo',
    unidad: FINANZAS_MONEDA,
    periodo: `${OPERACION_PERIODOS[0] ?? periodo} a ${OPERACION_PERIODOS[OPERACION_PERIODOS.length - 1] ?? periodo}`,
    nota: 'Flujo publicado por Gestión financiera para periodos equivalentes. Reportes no lo recalcula ni lo proyecta.',
    procedencia: `Sistema del Hospital y ${FINANCIERA_PLATAFORMA}`,
    estado: 'disponible',
    series: [
      { id: 'ingresos', etiqueta: 'Ingresos', puntos: ingresos },
      { id: 'egresos', etiqueta: 'Egresos', puntos: egresos },
    ],
    encabezado: 'Periodo',
  };
}

/** Componentes de la composición agregada, con su sección de origen (§3.5). */
const COMPOSICION: readonly (readonly [string, FinancialSeccionId, string])[] = [
  ['comp-nomina', 'nomina', 'Nómina'],
  ['comp-honorarios', 'honorarios', 'Honorarios'],
  ['comp-gastos', 'gastos', 'Gastos operativos'],
  ['comp-proveedores', 'proveedores', 'Proveedores'],
  ['comp-compras', 'compras', 'Insumos'],
  ['comp-convenios', 'convenios', 'Convenios'],
];

/**
 * Composición agregada del periodo.
 *
 * Cada componente consolida los registros de su sección de origen
 * deduplicados por identificador de registro. Un componente cuya sección no
 * publica importes para el recorte se declara ausente y NUNCA se escribe como
 * cero. En las dos audiencias la composición es agregada: nunca contiene
 * persona, registro individual ni importe individual.
 */
function composicionAgregada(
  config: FinancialConfig,
  periodo: string,
  programa: string | null,
): readonly ReporteCifra[] {
  return COMPOSICION.map(([id, seccion, etiqueta]) => {
    const filas = filasDe(config, seccion, periodo, programa);
    const resultado = consolidar(
      filas.map((fila) => ({ id: fila.id, origen: fila.origen, valor: importeDeFila(fila) })),
    );

    return cifra(
      id,
      etiqueta,
      resultado.total === null ? REPORTE_SIN_DATOS : textoMonto(resultado.total),
      FINANZAS_MONEDA,
      periodo,
      resultado.total === null ? 'Gestión financiera' : PROCEDENCIA_CONSOLIDADA,
      resultado.total === null
        ? `Gestión financiera no publica importes de ${etiqueta.toLocaleLowerCase('es-CO')} para este recorte. Ausente no es cero.`
        : `Consolidación de los registros de ${etiqueta.toLocaleLowerCase('es-CO')} del periodo, deduplicados por identificador de registro. Registros contados: ${String(resultado.identidades.length)}.`,
      resultado.total === null ? 'ausente' : 'disponible',
      resultado.desglose,
    );
  });
}

/** Estados de una cuenta u honorario que todavía no está pagado. */
const ESTADOS_PENDIENTES: readonly string[] = [
  'Recibida',
  'En revisión',
  'Requiere corrección',
  'Aprobada',
  'Programada',
  'Pendiente de revisión',
  'Aprobado',
  'Programado',
];

/**
 * Pagos pendientes.
 *
 * La vista Hospital lista los registros pendientes de su propio contexto con
 * su importe. La vista institucional / Alcaldía recibe únicamente el conteo
 * agregado por programa y estado, sin persona, sin registro y sin importe
 * individual (§3.5 y §3.8).
 */
function tablaPagosPendientes(
  config: FinancialConfig,
  periodo: string,
  programa: string | null,
  audiencia: ReporteAudienciaId,
): ReporteTabla {
  const secciones: readonly FinancialSeccionId[] = ['honorarios', 'cuentas'];
  const pendientes = secciones.flatMap((seccion) =>
    filasDe(config, seccion, periodo, programa)
      .filter((fila) => ESTADOS_PENDIENTES.includes(fila.estado))
      .map((fila) => ({ seccion, fila })),
  );

  if (audiencia === 'alcaldia') {
    const conteo = new Map<string, number>();

    for (const { fila } of pendientes) {
      const clave = `${fila.programa}||${fila.estado}`;

      conteo.set(clave, (conteo.get(clave) ?? 0) + 1);
    }

    return {
      id: 'pagos-pendientes',
      titulo: 'Pagos pendientes',
      leyenda: 'Conteo agregado de pagos pendientes por programa y estado.',
      columnas: [
        { id: 'programa', etiqueta: 'Programa' },
        { id: 'estado', etiqueta: 'Estado' },
        { id: 'registros', etiqueta: 'Registros', numerica: true },
      ],
      filas: [...conteo.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es-CO'))
        .map(([clave, valor]): ReporteFila => {
          const [programaFila = '', estado = ''] = clave.split('||');

          return { id: clave, celdas: [programaFila, estado, formatearNumero(valor)] };
        }),
      nota: 'Vista institucional: conteo agregado. No incluye persona, registro individual ni importe individual.',
      vacio: 'Sin pagos pendientes registrados para este recorte.',
    };
  }

  return {
    id: 'pagos-pendientes',
    titulo: 'Pagos pendientes',
    leyenda: 'Registros pendientes de pago del contexto institucional, con estado, programa y fuente.',
    columnas: [
      { id: 'concepto', etiqueta: 'Concepto' },
      { id: 'programa', etiqueta: 'Programa' },
      { id: 'estado', etiqueta: 'Estado' },
      { id: 'valor', etiqueta: 'Valor', numerica: true },
      { id: 'fuente', etiqueta: 'Fuente' },
    ],
    filas: pendientes.map(({ fila }): ReporteFila => {
      const importe = importeDeFila(fila);

      return {
        id: fila.id,
        celdas: [
          fila.detalle.titulo,
          fila.programa,
          fila.estado,
          importe === null ? REPORTE_SIN_DATOS : textoMonto(importe),
          fila.origen,
        ],
      };
    }),
    nota: 'Registros publicados por Gestión financiera. Reportes no aprueba, no programa y no paga.',
    vacio: 'Sin pagos pendientes registrados para este recorte.',
  };
}

/** Estados documentales que cuentan como evidencia faltante. */
const EVIDENCIA_FALTANTE: readonly string[] = ['Pendiente', 'Requiere corrección'];

/**
 * Evidencias financieras faltantes, agregadas por sección y estado. Es
 * agregada en las dos audiencias: nunca expone el registro ni el documento.
 */
function tablaEvidenciasFaltantes(
  config: FinancialConfig,
  periodo: string,
  programa: string | null,
): ReporteTabla {
  const conteo = new Map<string, number>();

  for (const [seccion, tabla] of Object.entries(config.secciones)) {
    for (const fila of filasDe(config, seccion as FinancialSeccionId, periodo, programa)) {
      if (EVIDENCIA_FALTANTE.includes(fila.evidencia)) {
        const clave = `${tabla.titulo}||${fila.programa}||${fila.evidencia}`;

        conteo.set(clave, (conteo.get(clave) ?? 0) + 1);
      }
    }
  }

  return {
    id: 'evidencias-faltantes',
    titulo: 'Evidencias financieras faltantes',
    leyenda: 'Conteo de registros financieros sin evidencia completa, por sección, programa y estado.',
    columnas: [
      { id: 'seccion', etiqueta: 'Sección' },
      { id: 'programa', etiqueta: 'Programa' },
      { id: 'estado', etiqueta: 'Estado de la evidencia' },
      { id: 'registros', etiqueta: 'Registros', numerica: true },
    ],
    filas: [...conteo.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es-CO'))
      .map(([clave, valor]): ReporteFila => {
        const [seccion = '', programaFila = '', estado = ''] = clave.split('||');

        return { id: clave, celdas: [seccion, programaFila, estado, formatearNumero(valor)] };
      }),
    nota: 'Reportes muestra el estado documental, nunca el documento.',
    vacio: 'Sin registros financieros con evidencia faltante para este recorte.',
  };
}

/* ========================================================================== */
/* Snapshot                                                                   */
/* ========================================================================== */

/**
 * `FinancialAnalyticsSnapshotV1` (§4).
 *
 * `periodo` procede de la barra global; cuando el periodo seleccionado no
 * existe en los fixtures de Gestión financiera, las tablas quedan vacías con
 * su texto propio y las cifras consolidadas se declaran ausentes. Nunca se
 * fabrica actualidad ni se escribe cero.
 */
export function snapshotFinanciero(
  filtros: ReporteFiltros,
  audiencia: ReporteAudienciaId,
  config: FinancialConfig = hospitalFinancieraDemo,
): FinancialAnalyticsSnapshotV1 {
  const normalizados = normalizarFiltros(filtros);
  const { periodo, programa } = normalizados;

  return {
    version: FINANZAS_VERSION_DEFINICION,
    periodo,
    moneda: FINANZAS_MONEDA,
    filtros: normalizados,
    kpi: kpiFinanciero(config, periodo, programa),
    ejecucionPorPrograma: tablaEjecucion(config, periodo, programa),
    ejecucionGrafico: graficoEjecucion(config, periodo, programa),
    flujo: graficoFlujo(config, periodo),
    composicion: composicionAgregada(config, periodo, programa),
    pagosPendientes: tablaPagosPendientes(config, periodo, programa, audiencia),
    evidenciasFaltantes: tablaEvidenciasFaltantes(config, periodo, programa),
    clavesDeduplicacion: [
      'Identificador de línea de presupuesto o ejecución',
      'Identificador de registro financiero dentro de su sección',
    ],
    procedencia: `Gestión financiera: Sistema del Hospital y ${FINANCIERA_PLATAFORMA}`,
    calculatedAt: '2026-08-20T06:00:00-05:00',
    limitaciones: LIMITACION_COMUN,
  };
}
