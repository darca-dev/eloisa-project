/**
 * Contratos versionados de «Reportes» (TASK-003H-07, §4).
 *
 * Este módulo es la ÚNICA fuente de tipos, versiones y vocabulario de los
 * snapshots que la vista compone. Ningún componente de Reportes escribe totales
 * ni fórmulas: toda cifra visible llega desde un snapshot y conserva su
 * definición, su periodo, su unidad, su procedencia y sus limitaciones.
 *
 * Reportes NO duplica población ni finanzas: `PopulationAnalyticsSnapshotV1`
 * procede íntegramente de H-03B (`hospitalPopulationAnalytics.ts`) y
 * `FinancialAnalyticsSnapshotV1` se adapta exclusivamente desde los fixtures de
 * H-06/H-06A. Los dos contratos nuevos —operación e institucional— viven en
 * este módulo compartido y no en la capa de presentación.
 *
 * Alcance: presentación demostrativa. Ningún tipo describe un esquema físico,
 * una API, un permiso concedido, una fórmula contable, un indicador oficial ni
 * una integración activa.
 */

import type { PopulationAnalyticsSnapshotV1 } from './hospitalPopulationTypes';

/* ========================================================================== */
/* Versiones                                                                  */
/* ========================================================================== */

/** Versión de las definiciones operativas de Reportes. */
export const OPERACION_VERSION_DEFINICION = 'operational-v1';

/** Versión de la proyección financiera que Reportes lee desde H-06/H-06A. */
export const FINANZAS_VERSION_DEFINICION = 'financial-v1';

/** Versión del contrato institucional y de evidencias. */
export const INSTITUCIONAL_VERSION_DEFINICION = 'institutional-v1';

/** Versión del snapshot compuesto que la vista consume. */
export const REPORTE_VERSION_DEFINICION = 'reports-v1';

/* ========================================================================== */
/* Clase, estado y procedencia del dato                                       */
/* ========================================================================== */

/**
 * Clases de dato que la arquitectura debe poder distinguir sin mezclarlas
 * (§4). Hoy TODO el frontend produce `DEMOSTRATIVO`; las otras tres existen
 * como identificadores internos para que una fuente futura no se confunda con
 * la demostración. Son identificadores de código: la interfaz nunca los
 * escribe, siempre muestra la etiqueta redactada.
 *
 * `CALCULO_PLATAFORMA` es la clase que §4 nombra con el identificador técnico
 * interno del proyecto. Se renombra aquí porque ese nombre no puede aparecer
 * en código de producto que alimenta la interfaz (AC-12): el significado —dato
 * calculado por la plataforma a partir de insumos declarados— es el mismo.
 */
export const REPORTE_CLASES_DATO = [
  'DEMOSTRATIVO',
  'DATO_OFICIAL_EXTERNO',
  'DATO_INSTITUCIONAL',
  'CALCULO_PLATAFORMA',
] as const;

export type ReporteClaseDato = (typeof REPORTE_CLASES_DATO)[number];

/** Texto visible de cada clase. Nunca se muestra el identificador interno. */
export const REPORTE_ETIQUETA_CLASE: Record<ReporteClaseDato, string> = {
  DEMOSTRATIVO: 'Dato demostrativo',
  DATO_OFICIAL_EXTERNO: 'Dato oficial externo',
  DATO_INSTITUCIONAL: 'Dato institucional',
  CALCULO_PLATAFORMA: 'Calculado por la plataforma',
};

/**
 * Estado del dato que acompaña a cada cifra (§3.9 y AC-11).
 *
 * `ausente` NO es cero y `no-calculable` NO es cero: los dos se escriben con
 * su propio texto y nunca con un número.
 */
export const REPORTE_ESTADOS_DATO = [
  'disponible',
  'parcial',
  'desactualizado',
  'ausente',
  'no-calculable',
] as const;

export type ReporteEstadoDato = (typeof REPORTE_ESTADOS_DATO)[number];

/** Texto visible de cada estado de dato. */
export const REPORTE_ETIQUETA_ESTADO: Record<ReporteEstadoDato, string> = {
  disponible: 'Dato disponible',
  parcial: 'Dato parcial',
  desactualizado: 'Dato desactualizado',
  ausente: 'Sin datos',
  'no-calculable': 'No calculable',
};

/** Texto que sustituye a un valor cuando el dato no existe. Nunca «0». */
export const REPORTE_SIN_DATOS = 'Sin datos';

/** Texto de un cociente cuyo denominador es cero, falta o no está versionado. */
export const REPORTE_NO_CALCULABLE = 'No calculable';

/** Desglose de una cifra consolidada por origen (§3.5). */
export interface ReporteDesglose {
  readonly id: string;
  readonly etiqueta: string;
  readonly valor: string;
  readonly procedencia: string;
}

/**
 * Cifra publicable. Conserva su definición, su versión, su unidad, su periodo,
 * su procedencia, su clase, su estado y sus limitaciones (§4).
 */
export interface ReporteCifra {
  readonly id: string;
  readonly etiqueta: string;
  /** Valor ya redactado con su unidad o su texto de ausencia. */
  readonly valor: string;
  readonly unidad: string;
  readonly periodo: string;
  readonly procedencia: string;
  readonly clase: ReporteClaseDato;
  readonly estado: ReporteEstadoDato;
  /** Contenido de `Cómo se calcula`: universo, fecha de corte y método. */
  readonly definicion: string;
  readonly version: string;
  readonly limitaciones: string;
  /** Presente solo en cifras consolidadas desde más de una fuente. */
  readonly desglose?: readonly ReporteDesglose[];
}

/* ========================================================================== */
/* Series, distribuciones y tablas                                            */
/* ========================================================================== */

/** Punto de una serie o barra de una distribución. */
export interface ReportePunto {
  readonly id: string;
  readonly etiqueta: string;
  readonly valor: number;
  /** Texto ya redactado del valor, con su unidad. */
  readonly texto: string;
}

/** Serie con nombre propio dentro de un gráfico de varias series. */
export interface ReporteSerie {
  readonly id: string;
  readonly etiqueta: string;
  readonly puntos: readonly ReportePunto[];
}

/**
 * Gráfico publicable. Título, unidad, periodo, leyenda y tabla accesible son
 * obligatorios: ningún gráfico comunica su contenido solo con color (§3.9).
 */
export interface ReporteGrafico {
  readonly id: string;
  readonly titulo: string;
  readonly unidad: string;
  readonly periodo: string;
  readonly nota: string;
  readonly procedencia: string;
  readonly estado: ReporteEstadoDato;
  readonly series: readonly ReporteSerie[];
  /** Encabezado de la primera columna de la tabla accesible. */
  readonly encabezado: string;
}

/** Columna de una tabla compacta. */
export interface ReporteColumna {
  readonly id: string;
  readonly etiqueta: string;
  /** `true` cuando la columna se alinea a la derecha por ser numérica. */
  readonly numerica?: boolean;
}

/** Fila de una tabla compacta; los valores ya vienen redactados. */
export interface ReporteFila {
  readonly id: string;
  readonly celdas: readonly string[];
}

/** Tabla compacta con su leyenda accesible y su procedencia. */
export interface ReporteTabla {
  readonly id: string;
  readonly titulo: string;
  readonly leyenda: string;
  readonly columnas: readonly ReporteColumna[];
  readonly filas: readonly ReporteFila[];
  readonly nota: string;
  readonly vacio: string;
}

/**
 * Indicador descriptivo con numerador y denominador explícitos (§3.6).
 *
 * Solo se muestra un cociente cuando numerador, denominador, unidad, periodo,
 * versión y metodología están presentes. Un denominador cero o ausente produce
 * `No calculable`, nunca cero.
 */
export interface ReporteIndicador {
  readonly id: string;
  readonly etiqueta: string;
  readonly numerador: number | null;
  readonly denominador: number | null;
  readonly numeradorTexto: string;
  readonly denominadorTexto: string;
  readonly unidad: string;
  readonly periodo: string;
  readonly version: string;
  readonly metodologia: string;
  readonly procedencia: string;
  /** Cociente ya redactado o `No calculable`. */
  readonly valor: string;
  readonly estado: ReporteEstadoDato;
}

/* ========================================================================== */
/* Audiencias, tabs y filtros                                                 */
/* ========================================================================== */

/** Las dos proyecciones de la misma capacidad compartida (§3.8). */
export const REPORTE_AUDIENCIAS = ['hospital', 'alcaldia'] as const;

export type ReporteAudienciaId = (typeof REPORTE_AUDIENCIAS)[number];

export const REPORTE_ETIQUETA_AUDIENCIA: Record<ReporteAudienciaId, string> = {
  hospital: 'Vista Hospital',
  alcaldia: 'Vista institucional / Alcaldía',
};

/** Los cinco tabs, en el orden vinculante (§3.1). */
export const REPORTE_TABS = [
  'resumen',
  'poblacion',
  'operacion',
  'finanzas',
  'institucional',
] as const;

export type ReporteTabId = (typeof REPORTE_TABS)[number];

export const REPORTE_ETIQUETA_TAB: Record<ReporteTabId, string> = {
  resumen: 'Resumen',
  poblacion: 'Población',
  operacion: 'Operación',
  finanzas: 'Finanzas',
  institucional: 'Evidencias e institucional',
};

/** Tab inicial de la vista y destino forzado cuando un tab no está permitido. */
export const REPORTE_TAB_INICIAL: ReporteTabId = 'resumen';

/** Subtabs del bloque institucional (§3.7). */
export const REPORTE_SUBTABS = ['gestion', 'furag', 'adres', 'sena', 't319'] as const;

export type ReporteSubtabId = (typeof REPORTE_SUBTABS)[number];

export const REPORTE_ETIQUETA_SUBTAB: Record<ReporteSubtabId, string> = {
  gestion: 'Gestión y evidencias',
  furag: 'FURAG / MIPG',
  adres: 'ADRES',
  sena: 'SENA',
  t319: 'Sentencia T-319 de 2025',
};

export const REPORTE_SUBTAB_INICIAL: ReporteSubtabId = 'gestion';

/** Las tres condiciones prioritarias del filtro multiselección (§3.1). */
export interface ReportePrioridades {
  readonly mayor60: boolean;
  readonly discapacidad: boolean;
  readonly cuidadosCasa: boolean;
}

/**
 * Filtros de la barra global. `periodo` es obligatorio y nunca queda vacío;
 * el resto usa cadena vacía como «todos». Las tres prioridades se combinan con
 * AND entre categorías, tal como exige §3.1.
 */
export interface ReporteFiltros {
  readonly periodo: string;
  readonly programa: string;
  readonly municipio: string;
  readonly eps: string;
  readonly modalidad: string;
  readonly prioridades: ReportePrioridades;
}

/** Filtros ya normalizados que produjeron el snapshot. */
export interface ReporteFiltrosNormalizados {
  readonly periodo: string;
  readonly programa: string | null;
  readonly municipio: string | null;
  readonly eps: string | null;
  readonly modalidad: string | null;
  readonly prioridades: ReportePrioridades;
}

/* ========================================================================== */
/* OperationalAnalyticsSnapshotV1                                             */
/* ========================================================================== */

/** Modalidades de prestación representadas (§3.4). */
export const OPERACION_MODALIDADES = [
  'Cita presencial',
  'Visita domiciliaria',
  'Consulta virtual',
] as const;

export type OperacionModalidadId = (typeof OPERACION_MODALIDADES)[number];

/**
 * Estados de un evento operativo. `Realizada` es el ÚNICO estado final
 * aprobado que acredita prestación realizada (§3.4).
 */
export const OPERACION_ESTADOS = ['Programada', 'Realizada', 'Cancelada', 'Pendiente'] as const;

export type OperacionEstadoId = (typeof OPERACION_ESTADOS)[number];

/**
 * Evento operativo registrado del escenario demostrativo.
 *
 * `pacienteId` es el identificador estable con el que se deduplican personas
 * dentro del tenant y del periodo: una persona con varias prestaciones cuenta
 * una sola vez como paciente atendido.
 *
 * `duracionMinutos` es `null` cuando los timestamps del evento no son válidos
 * o faltan. Un valor faltante NO es cero y NO entra en la mediana.
 */
export interface OperacionEvento {
  readonly id: string;
  readonly tenantId: string;
  readonly pacienteId: string;
  readonly periodo: string;
  readonly modalidad: OperacionModalidadId;
  readonly estado: OperacionEstadoId;
  readonly programa: string;
  readonly municipio: string;
  readonly zona: string;
  readonly profesionalId: string;
  readonly profesion: string;
  readonly duracionMinutos: number | null;
  readonly procedencia: string;
}

/**
 * Alarma operativa contada por su estado al corte (§3.4).
 *
 * `tenantId` acota la alarma a su contexto institucional: el recorte lo exige
 * antes de contar, de modo que una alarma de otro contexto nunca entra en el
 * conteo del contexto activo.
 */
export interface OperacionAlarma {
  readonly id: string;
  readonly tenantId: string;
  readonly periodo: string;
  readonly programa: string;
  readonly municipio: string;
  readonly zona: string;
  readonly estadoAlCorte: 'Abierta' | 'Cerrada';
  readonly antiguedad: string;
  readonly tramoAntiguedad: string;
  readonly asunto: string;
  readonly procedencia: string;
}

/** `OperationalAnalyticsSnapshotV1` (§4). */
export interface OperationalAnalyticsSnapshotV1 {
  readonly version: typeof OPERACION_VERSION_DEFINICION;
  readonly contexto: {
    readonly tenantId: string;
    readonly institucion: string;
    readonly municipioSede: string;
  };
  readonly periodo: string;
  readonly fechaCorte: string;
  readonly filtros: ReporteFiltrosNormalizados;
  /** Eventos del universo ya filtrado; base de todas las cifras del snapshot. */
  readonly universo: number;
  readonly pacientesUnicos: number;
  readonly kpi: readonly ReporteCifra[];
  readonly graficos: readonly ReporteGrafico[];
  readonly resumenOperativo: ReporteTabla;
  readonly pendientes: readonly OperacionAlarma[];
  readonly procedencia: string;
  readonly calculatedAt: string;
  readonly limitaciones: string;
}

/* ========================================================================== */
/* FinancialAnalyticsSnapshotV1                                               */
/* ========================================================================== */

/** `FinancialAnalyticsSnapshotV1` (§4). Se adapta desde H-06/H-06A. */
export interface FinancialAnalyticsSnapshotV1 {
  readonly version: typeof FINANZAS_VERSION_DEFINICION;
  readonly periodo: string;
  readonly moneda: string;
  readonly filtros: ReporteFiltrosNormalizados;
  /** Los siete KPI en el orden vinculante de §3.5. */
  readonly kpi: readonly ReporteCifra[];
  readonly ejecucionPorPrograma: ReporteTabla;
  /** Las mismas líneas de ejecución, como barras por programa. */
  readonly ejecucionGrafico: ReporteGrafico;
  readonly flujo: ReporteGrafico;
  readonly composicion: readonly ReporteCifra[];
  readonly pagosPendientes: ReporteTabla;
  readonly evidenciasFaltantes: ReporteTabla;
  /** Claves de deduplicación efectivamente aplicadas al consolidar. */
  readonly clavesDeduplicacion: readonly string[];
  readonly procedencia: string;
  readonly calculatedAt: string;
  readonly limitaciones: string;
}

/* ========================================================================== */
/* InstitutionalEvidenceSnapshotV1                                            */
/* ========================================================================== */

/** Los cuatro estados exactos de una evidencia (§3.7). */
export const EVIDENCIA_ESTADOS = [
  'Completa',
  'Pendiente',
  'Requiere corrección',
  'Validada',
] as const;

export type EvidenciaEstadoId = (typeof EVIDENCIA_ESTADOS)[number];

/** Marcos institucionales representados. Ninguno declara conexión activa. */
export const EVIDENCIA_MARCOS = [
  'Gestión',
  'FURAG / MIPG',
  'ADRES',
  'SENA',
  'Sentencia T-319 de 2025',
] as const;

export type EvidenciaMarcoId = (typeof EVIDENCIA_MARCOS)[number];

/** Registro de evidencia. Este slice nunca expone el documento real. */
export interface EvidenciaRegistro {
  readonly id: string;
  readonly indicador: string;
  readonly evidencia: string;
  readonly tipo: string;
  readonly fecha: string;
  readonly responsable: string;
  readonly procedencia: string;
  readonly estado: EvidenciaEstadoId;
  readonly marco: EvidenciaMarcoId;
  readonly periodo: string;
  readonly programa: string;
  readonly municipio: string;
  /** Metadatos del panel. No contienen contenido documental. */
  readonly metadatos: readonly { readonly etiqueta: string; readonly valor: string }[];
}

/** Fila de un espacio de marco institucional (§3.7). */
export interface MarcoRegistro {
  readonly id: string;
  readonly tema: string;
  readonly requisito: string;
  readonly periodo: string;
  readonly evidencia: string;
  readonly responsable: string;
  readonly brecha: string;
  readonly procedencia: string;
  readonly estado: EvidenciaEstadoId;
}

/** Espacio institucional completo: aviso de alcance más registros. */
export interface MarcoEspacio {
  readonly id: ReporteSubtabId;
  readonly marco: EvidenciaMarcoId;
  readonly titulo: string;
  readonly descripcion: string;
  /** Texto de delimitación obligatorio; siempre visible, nunca ocultable. */
  readonly limite: string;
  readonly columnas: readonly ReporteColumna[];
  readonly registros: readonly MarcoRegistro[];
  readonly vacio: string;
}

/** `InstitutionalEvidenceSnapshotV1` (§4). */
export interface InstitutionalEvidenceSnapshotV1 {
  readonly version: typeof INSTITUCIONAL_VERSION_DEFINICION;
  readonly periodo: string;
  readonly filtros: ReporteFiltrosNormalizados;
  readonly evidencias: readonly EvidenciaRegistro[];
  readonly conteoPorEstado: readonly ReportePunto[];
  readonly espacios: readonly MarcoEspacio[];
  readonly procedencia: string;
  readonly calculatedAt: string;
  readonly limitaciones: string;
}

/* ========================================================================== */
/* ReportSnapshotV1                                                           */
/* ========================================================================== */

/** Referencia de versión de cada snapshot que compone el reporte (§4). */
export interface ReporteReferenciaVersion {
  readonly id: string;
  readonly contrato: string;
  readonly version: string;
  readonly fechaCorte: string;
}

/** Calidad y limitaciones declaradas del reporte compuesto. */
export interface ReporteCalidad {
  readonly cobertura: string;
  readonly limitaciones: readonly string[];
  readonly actualizacion: string;
}

/**
 * `ReportSnapshotV1` (§4).
 *
 * Referencia a las versiones anteriores, filtros normalizados, audiencia,
 * fecha de corte, marca de composición y calidad. No contiene totales propios:
 * cada cifra vive en el snapshot que la define.
 */
export interface ReportSnapshotV1 {
  readonly version: typeof REPORTE_VERSION_DEFINICION;
  readonly audiencia: ReporteAudienciaId;
  readonly filtros: ReporteFiltrosNormalizados;
  readonly fechaCorte: string;
  readonly generatedAt: string;
  readonly referencias: readonly ReporteReferenciaVersion[];
  readonly calidad: ReporteCalidad;
  readonly poblacion: PopulationAnalyticsSnapshotV1;
  readonly operacion: OperationalAnalyticsSnapshotV1;
  readonly finanzas: FinancialAnalyticsSnapshotV1;
  readonly institucional: InstitutionalEvidenceSnapshotV1;
  /** Indicadores descriptivos de población y recursos (§3.6). */
  readonly poblacionRecursos: readonly ReporteIndicador[];
  /** Tabla de población y recursos (§3.6). */
  readonly tablaRecursos: ReporteTabla;
  /** Evolución de beneficiarios únicos por periodo (§3.6). */
  readonly evolucionBeneficiarios: ReporteGrafico;
  /** KPI del tab Población (§3.3), compuestos desde el snapshot de H-03B. */
  readonly kpiPoblacion: readonly ReporteCifra[];
  /** KPI del tab Resumen (§3.2), compuestos desde los snapshots anteriores. */
  readonly resumen: readonly ReporteCifra[];
  /** Bandeja `Necesita atención`; nunca contiene alerta clínica nominal. */
  readonly atencion: readonly ReporteFila[];
}
