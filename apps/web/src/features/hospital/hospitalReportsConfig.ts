import { branding } from '@/config/branding';

import {
  OPERACION_FECHA_CORTE_TEXTO,
  OPERACION_PERIODOS,
  OPERACION_PERIODO_INICIAL,
} from './hospitalReportsOperationalFixtures';
import {
  REPORTE_SUBTAB_INICIAL,
  REPORTE_SUBTABS,
  REPORTE_TABS,
  REPORTE_TAB_INICIAL,
  type ReporteAudienciaId,
  type ReporteFiltros,
  type ReporteFiltrosNormalizados,
  type ReporteSubtabId,
  type ReporteTabId,
} from './hospitalReportsTypes';

/**
 * Vocabulario, textos y transiciones puras de «Reportes» (TASK-003H-07, §3).
 *
 * Reúne lo que la Task define como vinculante fuera de los datos: el selector
 * de audiencia, la barra global de filtros, los cinco tabs, los cinco espacios
 * institucionales y las cuatro acciones de exportación, que permanecen
 * deshabilitadas.
 *
 * Las transiciones de estado son funciones puras y por eso se pueden verificar
 * sin montar la vista: cambiar de audiencia conserva únicamente los filtros
 * declarados compatibles, cierra cualquier panel abierto y fuerza `Resumen`
 * cuando el tab actual no está permitido para la audiencia destino.
 *
 * Marca visible: exclusivamente la del branding centralizado. Ningún texto de
 * este módulo escribe el nombre técnico interno del proyecto.
 *
 * Alcance: presentación. Nada de este módulo autoriza, exporta, descarga,
 * imprime, genera informes ni declara cumplimiento.
 */

/* ========================================================================== */
/* Encabezado                                                                 */
/* ========================================================================== */

export const REPORTE_TITULO = 'Reportes';

export const REPORTE_DESCRIPCION =
  'Dashboard ejecutivo de población, operación, finanzas, programas, recursos y evidencias, con definiciones compartidas y procedencia por cifra.';

export const REPORTE_BADGE_DATOS = 'Datos demostrativos';

export const REPORTE_FECHA_CORTE_TEXTO = OPERACION_FECHA_CORTE_TEXTO;

/** Aviso permanente del bloque de población y recursos (§3.6). */
export const REPORTE_AVISO_DESCRIPTIVO =
  'Indicadores descriptivos; no demuestran causalidad ni resultado clínico.';

/** Aviso de alcance de toda la vista. */
export const REPORTE_AVISO_ALCANCE = `${branding.platformDisplayName} organiza información y evidencias demostrativas. Esta pantalla no consulta fuentes oficiales, no certifica cumplimiento, no sustituye la historia clínica y no ejecuta ningún cálculo contable.`;

/** Texto que acompaña al cambio de audiencia y se anuncia al activarlo. */
export const REPORTE_ETIQUETA_SELECTOR = 'Audiencia del reporte';

/* ========================================================================== */
/* Avisos por audiencia                                                       */
/* ========================================================================== */

export const REPORTE_AVISO_AUDIENCIA: Record<ReporteAudienciaId, string> = {
  hospital:
    'Vista Hospital: incluye detalle agregado operativo y financiero del propio contexto institucional. El detalle nominal de personas vive en Pacientes y no se reproduce aquí.',
  alcaldia:
    'Vista institucional / Alcaldía: información agregada, estadística, presupuestal, poblacional y de evidencia. No incluye información clínica nominal, diagnósticos, contactos, dirección exacta, profesional o paciente identificado, salarios u honorarios individuales, listados nominales, drill-down ni exportación.',
};

/* ========================================================================== */
/* Acciones de exportación                                                    */
/* ========================================================================== */

/** Texto accesible único de las cuatro acciones futuras (§3.1). */
export const REPORTE_MOTIVO_EXPORTACION = 'Disponible cuando se habilite la exportación';

export interface ReporteAccion {
  readonly id: string;
  readonly etiqueta: string;
}

/**
 * Las cuatro acciones de exportación. Se muestran siempre deshabilitadas y con
 * su motivo escrito al lado: ningún click descarga, imprime, genera archivo ni
 * simula un resultado.
 */
export const REPORTE_ACCIONES: readonly ReporteAccion[] = [
  { id: 'pdf', etiqueta: 'Exportar PDF' },
  { id: 'excel', etiqueta: 'Exportar Excel' },
  { id: 'imprimir', etiqueta: 'Imprimir' },
  { id: 'informe', etiqueta: 'Generar informe' },
];

/* ========================================================================== */
/* Filtros                                                                    */
/* ========================================================================== */

/** Identificadores de la barra global, en el orden vinculante (§3.1). */
export const REPORTE_FILTROS_ORDEN = [
  'periodo',
  'programa',
  'municipio',
  'prioridades',
  'eps',
  'modalidad',
] as const;

export type ReporteFiltroId = (typeof REPORTE_FILTROS_ORDEN)[number];

export const REPORTE_ETIQUETA_FILTRO: Record<ReporteFiltroId, string> = {
  periodo: 'Periodo',
  programa: 'Programa',
  municipio: 'Municipio / zona',
  prioridades: 'Población prioritaria',
  eps: 'EPS',
  modalidad: 'Modalidad',
};

/** Periodos ofrecidos por la barra global. `Periodo` nunca queda vacío. */
export const REPORTE_PERIODOS = OPERACION_PERIODOS;

/** Estado inicial de los filtros: periodo más reciente y nada más aplicado. */
export const REPORTE_FILTROS_INICIALES: ReporteFiltros = {
  periodo: OPERACION_PERIODO_INICIAL,
  programa: '',
  municipio: '',
  eps: '',
  modalidad: '',
  prioridades: { mayor60: false, discapacidad: false, cuidadosCasa: false },
};

/**
 * Filtros que cada audiencia declara compatibles.
 *
 * Los seis filtros de la barra global son agregados y no identifican a nadie,
 * por lo que hoy las dos audiencias los declaran compatibles. La tabla existe
 * igualmente porque el cambio de audiencia debe descartar por construcción
 * cualquier criterio que una audiencia no declare, en vez de confiar en que la
 * interfaz recuerde limpiarlo.
 */
export const REPORTE_FILTROS_POR_AUDIENCIA: Record<
  ReporteAudienciaId,
  readonly ReporteFiltroId[]
> = {
  hospital: REPORTE_FILTROS_ORDEN,
  alcaldia: REPORTE_FILTROS_ORDEN,
};

/** `true` cuando esa audiencia declara compatible ese filtro. */
export function filtroCompatible(audiencia: ReporteAudienciaId, filtro: ReporteFiltroId): boolean {
  return REPORTE_FILTROS_POR_AUDIENCIA[audiencia].includes(filtro);
}

/**
 * Recorta los filtros a los que la audiencia destino declara compatibles.
 *
 * `periodo` es obligatorio: si no fuese compatible se restablecería al valor
 * inicial, nunca a vacío, de modo que ninguna cifra quede sin periodo.
 */
export function filtrosCompatibles(
  audiencia: ReporteAudienciaId,
  filtros: ReporteFiltros,
): ReporteFiltros {
  const conservar = (filtro: ReporteFiltroId, valor: string): string =>
    filtroCompatible(audiencia, filtro) ? valor : '';

  return {
    periodo: filtroCompatible(audiencia, 'periodo') ? filtros.periodo : REPORTE_FILTROS_INICIALES.periodo,
    programa: conservar('programa', filtros.programa),
    municipio: conservar('municipio', filtros.municipio),
    eps: conservar('eps', filtros.eps),
    modalidad: conservar('modalidad', filtros.modalidad),
    prioridades: filtroCompatible(audiencia, 'prioridades')
      ? filtros.prioridades
      : REPORTE_FILTROS_INICIALES.prioridades,
  };
}

/** `true` cuando solo está aplicado el periodo obligatorio. */
export function filtrosVacios(filtros: ReporteFiltros): boolean {
  const { prioridades } = filtros;

  return (
    filtros.programa === '' &&
    filtros.municipio === '' &&
    filtros.eps === '' &&
    filtros.modalidad === '' &&
    !prioridades.mayor60 &&
    !prioridades.discapacidad &&
    !prioridades.cuidadosCasa
  );
}

/** Normalización única de los filtros; produce la clave de todo snapshot. */
export function normalizarFiltros(filtros: ReporteFiltros): ReporteFiltrosNormalizados {
  const texto = (valor: string): string | null => (valor.trim() === '' ? null : valor.trim());

  return {
    periodo: filtros.periodo.trim() === '' ? REPORTE_FILTROS_INICIALES.periodo : filtros.periodo.trim(),
    programa: texto(filtros.programa),
    municipio: texto(filtros.municipio),
    eps: texto(filtros.eps),
    modalidad: texto(filtros.modalidad),
    prioridades: { ...filtros.prioridades },
  };
}

/** Resumen legible de los filtros aplicados, para la barra global. */
export function resumenDeFiltros(filtros: ReporteFiltros): string {
  const partes: string[] = [`${REPORTE_ETIQUETA_FILTRO.periodo}: ${filtros.periodo}`];

  if (filtros.programa !== '') {
    partes.push(`${REPORTE_ETIQUETA_FILTRO.programa}: ${filtros.programa}`);
  }
  if (filtros.municipio !== '') {
    partes.push(`${REPORTE_ETIQUETA_FILTRO.municipio}: ${filtros.municipio}`);
  }
  if (filtros.eps !== '') {
    partes.push(`${REPORTE_ETIQUETA_FILTRO.eps}: ${filtros.eps}`);
  }
  if (filtros.modalidad !== '') {
    partes.push(`${REPORTE_ETIQUETA_FILTRO.modalidad}: ${filtros.modalidad}`);
  }

  const prioridades: string[] = [];

  if (filtros.prioridades.mayor60) {
    prioridades.push('Mayor de 60');
  }
  if (filtros.prioridades.discapacidad) {
    prioridades.push('Discapacidad');
  }
  if (filtros.prioridades.cuidadosCasa) {
    prioridades.push('Cuidados en casa');
  }
  if (prioridades.length > 0) {
    partes.push(`${REPORTE_ETIQUETA_FILTRO.prioridades}: ${prioridades.join(' y ')}`);
  }

  return partes.join(' · ');
}

/* ========================================================================== */
/* Tabs y audiencia                                                           */
/* ========================================================================== */

/**
 * Tabs permitidos por audiencia.
 *
 * Las dos audiencias ven los cinco tabs: lo que cambia entre ellas no es la
 * existencia del tab sino su proyección —la Alcaldía nunca recibe detalle
 * nominal ni remuneración individual— y esa diferencia se aplica al componer
 * el snapshot, no ocultando pestañas.
 */
export const REPORTE_TABS_POR_AUDIENCIA: Record<ReporteAudienciaId, readonly ReporteTabId[]> = {
  hospital: REPORTE_TABS,
  alcaldia: REPORTE_TABS,
};

/** `true` cuando esa audiencia declara permitido ese tab. */
export function tabPermitido(audiencia: ReporteAudienciaId, tab: string): tab is ReporteTabId {
  return (REPORTE_TABS_POR_AUDIENCIA[audiencia] as readonly string[]).includes(tab);
}

/** `true` solo para los cinco identificadores de subtab institucional. */
export function esSubtab(id: string): id is ReporteSubtabId {
  return (REPORTE_SUBTABS as readonly string[]).includes(id);
}

/* ========================================================================== */
/* Estado local navegable                                                     */
/* ========================================================================== */

/**
 * Estado navegable de la vista.
 *
 * Es estado local del montaje: no crea rutas, no cambia la URL, no persiste y
 * se reinicia al recargar, igual que el resto del shell Hospital. La Task pide
 * que el tab quede navegable; publicarlo además en la URL exige una decisión de
 * rutas que esta tarea no autoriza y que se declara como trabajo futuro.
 */
export interface ReporteEstado {
  readonly audiencia: ReporteAudienciaId;
  readonly tab: ReporteTabId;
  readonly subtab: ReporteSubtabId;
  readonly filtros: ReporteFiltros;
  /** Evidencia cuyo panel de metadatos está abierto; `null` si no hay ninguno. */
  readonly evidenciaAbierta: string | null;
  /** Detalle operativo agregado abierto; solo la vista Hospital lo admite. */
  readonly detalleAbierto: string | null;
  /** Gráficos con su tabla accesible desplegada. */
  readonly tablasAbiertas: readonly string[];
  /** Mensaje de la región `status` que anuncia el último cambio relevante. */
  readonly anuncio: string;
}

export const REPORTE_ESTADO_INICIAL: ReporteEstado = {
  audiencia: 'hospital',
  tab: REPORTE_TAB_INICIAL,
  subtab: REPORTE_SUBTAB_INICIAL,
  filtros: REPORTE_FILTROS_INICIALES,
  evidenciaAbierta: null,
  detalleAbierto: null,
  tablasAbiertas: [],
  anuncio: '',
};

/**
 * Cambio de audiencia (§3.1).
 *
 * Es atómico: conserva solo los filtros compatibles, cierra los paneles
 * abiertos, fuerza `Resumen` cuando el tab actual no está permitido y anuncia
 * el cambio. Al reemplazar el estado completo en una sola transición, la vista
 * nunca llega a pintar contenido de la audiencia anterior.
 */
export function cambiarAudiencia(
  actual: ReporteEstado,
  audiencia: ReporteAudienciaId,
): ReporteEstado {
  const filtros = filtrosCompatibles(audiencia, actual.filtros);
  const tab = tabPermitido(audiencia, actual.tab) ? actual.tab : REPORTE_TAB_INICIAL;

  return {
    ...actual,
    audiencia,
    tab,
    subtab: REPORTE_SUBTAB_INICIAL,
    filtros,
    evidenciaAbierta: null,
    detalleAbierto: null,
    tablasAbiertas: [],
    anuncio: `Audiencia activa: ${audiencia === 'hospital' ? 'Vista Hospital' : 'Vista institucional / Alcaldía'}. Sección ${tab}.`,
  };
}

/** Cambio de tab. Un tab no permitido para la audiencia activa cae en Resumen. */
export function cambiarTab(actual: ReporteEstado, tab: string): ReporteEstado {
  const destino = tabPermitido(actual.audiencia, tab) ? tab : REPORTE_TAB_INICIAL;

  return {
    ...actual,
    tab: destino,
    evidenciaAbierta: null,
    detalleAbierto: null,
    anuncio: `Sección activa: ${destino}.`,
  };
}

/** Cambio de subtab institucional. */
export function cambiarSubtab(actual: ReporteEstado, subtab: string): ReporteEstado {
  return {
    ...actual,
    subtab: esSubtab(subtab) ? subtab : REPORTE_SUBTAB_INICIAL,
    evidenciaAbierta: null,
  };
}

/** Aplicación de un filtro. Cierra paneles y anuncia el recorte resultante. */
export function aplicarFiltros(
  actual: ReporteEstado,
  cambio: Partial<ReporteFiltros>,
): ReporteEstado {
  const filtros: ReporteFiltros = {
    ...actual.filtros,
    ...cambio,
    prioridades: { ...actual.filtros.prioridades, ...cambio.prioridades },
  };

  return {
    ...actual,
    filtros,
    evidenciaAbierta: null,
    detalleAbierto: null,
    anuncio: `Filtros aplicados. ${resumenDeFiltros(filtros)}.`,
  };
}

/** `Limpiar filtros` conserva el periodo obligatorio en su valor inicial. */
export function limpiarFiltros(actual: ReporteEstado): ReporteEstado {
  return {
    ...actual,
    filtros: REPORTE_FILTROS_INICIALES,
    evidenciaAbierta: null,
    detalleAbierto: null,
    anuncio: `Filtros limpiados. ${resumenDeFiltros(REPORTE_FILTROS_INICIALES)}.`,
  };
}
