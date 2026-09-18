/**
 * Métricas Manual vs Orchestrator (FR-16, doc §14, AC-12, AC-16).
 *
 * Regla dura (corrección de auditoría §8): un dato desconocido NUNCA vale
 * cero. Cada métrica es explícitamente CONOCIDA o DESCONOCIDA, y la
 * conclusión `ORCHESTRATOR_MAS_EFICIENTE` sólo puede sostenerse sobre datos
 * conocidos. Los tokens y el costo se informan únicamente si el CLI los
 * reporta.
 */

export const UNKNOWN = 'DESCONOCIDO' as const;

/** Una métrica es un número conocido o `DESCONOCIDO`. Nunca `null` implícito. */
export type MetricValue = { readonly known: true; readonly value: number } | { readonly known: false };

export const unknownMetric: MetricValue = { known: false };

export function known(value: number): MetricValue {
  return { known: true, value };
}

/** `null`/`undefined` significan DESCONOCIDO; jamás se convierten a cero. */
export function fromNullable(value: number | null | undefined): MetricValue {
  return value === null || value === undefined ? unknownMetric : known(value);
}

export function isKnown(metric: MetricValue): metric is { known: true; value: number } {
  return metric.known;
}

export const NOT_REPORTED = 'Dato no disponible';

export function formatMetric(metric: MetricValue, unit?: string): string {
  if (!metric.known) {
    return NOT_REPORTED;
  }
  return unit === undefined ? String(metric.value) : String(metric.value) + ' ' + unit;
}

export interface RunMeasurement {
  readonly productOwnerInterventions: MetricValue;
  /** Sólo se cuenta con evidencia/registro explícito de copias manuales. */
  readonly manuallyCopiedMessages: MetricValue;
  readonly totalMinutes: MetricValue;
  readonly productOwnerActiveMinutes: MetricValue;
  readonly codexInvocations: MetricValue;
  readonly claudeInvocations: MetricValue;
  readonly retries: MetricValue;
  readonly errors: MetricValue;
  readonly cyclesWithoutProgress: MetricValue;
  readonly outOfScopeFiles: MetricValue;
  readonly testsPass: MetricValue;
  readonly testsFail: MetricValue;
  readonly testsNotRun: MetricValue;
  readonly stopConditions: MetricValue;
  /** Sólo se afirma si existe un mecanismo de detección que haya corrido. */
  readonly inventedDecisions: MetricValue;
  readonly visualDivergences: MetricValue;
  readonly successfulRecoveries: MetricValue;
  /** Sólo si el CLI los reporta (AC-12). */
  readonly reportedTokens: MetricValue;
  readonly reportedCostUsd: MetricValue;
}

/** Medición vacía: todo DESCONOCIDO hasta que exista evidencia. */
export function emptyMeasurement(): RunMeasurement {
  return {
    productOwnerInterventions: unknownMetric,
    manuallyCopiedMessages: unknownMetric,
    totalMinutes: unknownMetric,
    productOwnerActiveMinutes: unknownMetric,
    codexInvocations: unknownMetric,
    claudeInvocations: unknownMetric,
    retries: unknownMetric,
    errors: unknownMetric,
    cyclesWithoutProgress: unknownMetric,
    outOfScopeFiles: unknownMetric,
    testsPass: unknownMetric,
    testsFail: unknownMetric,
    testsNotRun: unknownMetric,
    stopConditions: unknownMetric,
    inventedDecisions: unknownMetric,
    visualDivergences: unknownMetric,
    successfulRecoveries: unknownMetric,
    reportedTokens: unknownMetric,
    reportedCostUsd: unknownMetric,
  };
}

/** Umbrales obligatorios de la prueba controlada (doc §14, AC-16). */
export const MANDATORY_THRESHOLDS = {
  maxManuallyCopiedMessages: 0,
  maxProductOwnerInterventions: 3,
  maxClaudeInvocations: 3,
  maxOutOfScopeFiles: 0,
  maxInventedDecisions: 0,
  maxApiCostUsd: 0,
} as const;

export type Recommendation = 'ORCHESTRATOR_MAS_EFICIENTE' | 'RECOMENDAR_MODO_MANUAL';

export type ThresholdStatus = 'cumple' | 'incumple' | 'desconocido';

export interface ThresholdCheck {
  readonly id: string;
  readonly status: ThresholdStatus;
  readonly detail: string;
}

export interface Comparison {
  readonly recommendation: Recommendation;
  /**
   * `false` cuando faltan datos para sostener una conclusión positiva.
   * Una recomendación no concluyente es conservadora, no una afirmación de
   * que el Orchestrator sea peor.
   */
  readonly conclusive: boolean;
  readonly thresholds: readonly ThresholdCheck[];
  /** Motivos observados que justifican volver a MODO MANUAL. */
  readonly reasons: readonly string[];
  /** Métricas que no pudieron conocerse. */
  readonly dataGaps: readonly string[];
  readonly manual: RunMeasurement;
  readonly orchestrator: RunMeasurement;
  readonly rows: readonly {
    readonly metric: string;
    readonly manual: string;
    readonly orchestrator: string;
  }[];
}

/** Evalúa un umbral máximo. Un valor desconocido no cumple ni incumple. */
function checkMax(id: string, metric: MetricValue, max: number): ThresholdCheck {
  if (!metric.known) {
    return { id, status: 'desconocido', detail: NOT_REPORTED };
  }
  return {
    id,
    status: metric.value <= max ? 'cumple' : 'incumple',
    detail: String(metric.value) + '/' + String(max),
  };
}

/** Compara dos métricas: `true` si se sabe que la segunda es peor. */
function esPeor(manual: MetricValue, orchestrator: MetricValue): boolean {
  return manual.known && orchestrator.known && orchestrator.value > manual.value;
}

/**
 * Compara una unidad de trabajo equivalente.
 *
 * No favorece la automatización: cualquier umbral incumplido, cualquier
 * empeoramiento observable o cualquier dato faltante impide concluir que el
 * Orchestrator sea más eficiente.
 */
export function compare(manual: RunMeasurement, orchestrator: RunMeasurement): Comparison {
  const thresholds: readonly ThresholdCheck[] = [
    checkMax(
      'mensajes_copiados_manualmente',
      orchestrator.manuallyCopiedMessages,
      MANDATORY_THRESHOLDS.maxManuallyCopiedMessages,
    ),
    checkMax(
      'intervenciones_product_owner',
      orchestrator.productOwnerInterventions,
      MANDATORY_THRESHOLDS.maxProductOwnerInterventions,
    ),
    checkMax('invocaciones_claude', orchestrator.claudeInvocations, MANDATORY_THRESHOLDS.maxClaudeInvocations),
    checkMax('archivos_fuera_de_alcance', orchestrator.outOfScopeFiles, MANDATORY_THRESHOLDS.maxOutOfScopeFiles),
    checkMax('decisiones_inventadas', orchestrator.inventedDecisions, MANDATORY_THRESHOLDS.maxInventedDecisions),
    checkMax('costo_api', orchestrator.reportedCostUsd, MANDATORY_THRESHOLDS.maxApiCostUsd),
  ];

  const reasons: string[] = [];
  const dataGaps: string[] = [];

  for (const threshold of thresholds) {
    if (threshold.status === 'incumple') {
      reasons.push('umbral_incumplido:' + threshold.id + ' (' + threshold.detail + ')');
    }
    if (threshold.status === 'desconocido') {
      dataGaps.push('umbral_no_evaluable:' + threshold.id);
    }
  }

  // Comparaciones directas observables: sólo cuentan si ambos lados se conocen.
  if (esPeor(manual.productOwnerInterventions, orchestrator.productOwnerInterventions)) {
    reasons.push('mas_intervenciones_que_manual');
  }
  if (esPeor(manual.totalMinutes, orchestrator.totalMinutes)) {
    reasons.push('mas_lento_que_manual');
  }
  if (esPeor(manual.testsFail, orchestrator.testsFail)) {
    reasons.push('mas_pruebas_fallidas_que_manual');
  }
  if (esPeor(manual.visualDivergences, orchestrator.visualDivergences)) {
    reasons.push('menor_fidelidad_visual_que_manual');
  }
  if (esPeor(manual.outOfScopeFiles, orchestrator.outOfScopeFiles)) {
    reasons.push('mas_archivos_fuera_de_alcance_que_manual');
  }
  if (esPeor(manual.errors, orchestrator.errors)) {
    reasons.push('mas_errores_que_manual');
  }
  if (esPeor(manual.reportedCostUsd, orchestrator.reportedCostUsd)) {
    reasons.push('mas_costoso_que_manual');
  }

  const conclusive = dataGaps.length === 0;
  const recommendation: Recommendation =
    conclusive && reasons.length === 0 ? 'ORCHESTRATOR_MAS_EFICIENTE' : 'RECOMENDAR_MODO_MANUAL';

  return {
    recommendation,
    conclusive,
    thresholds,
    reasons,
    dataGaps,
    manual,
    orchestrator,
    rows: buildRows(manual, orchestrator),
  };
}

function buildRows(
  manual: RunMeasurement,
  orchestrator: RunMeasurement,
): readonly { metric: string; manual: string; orchestrator: string }[] {
  const definitions: readonly [string, keyof RunMeasurement][] = [
    ['Intervenciones Product Owner', 'productOwnerInterventions'],
    ['Mensajes copiados manualmente', 'manuallyCopiedMessages'],
    ['Tiempo total (min)', 'totalMinutes'],
    ['Tiempo activo del PO (min)', 'productOwnerActiveMinutes'],
    ['Invocaciones Codex', 'codexInvocations'],
    ['Invocaciones Claude', 'claudeInvocations'],
    ['Reintentos', 'retries'],
    ['Errores', 'errors'],
    ['Ciclos sin progreso', 'cyclesWithoutProgress'],
    ['Archivos fuera de alcance', 'outOfScopeFiles'],
    ['Pruebas pass', 'testsPass'],
    ['Pruebas fail', 'testsFail'],
    ['Pruebas no ejecutadas', 'testsNotRun'],
    ['STOP CONDITIONS', 'stopConditions'],
    ['Decisiones inventadas', 'inventedDecisions'],
    ['Divergencias visuales', 'visualDivergences'],
    ['Recuperaciones exitosas', 'successfulRecoveries'],
    ['Tokens reportados', 'reportedTokens'],
    ['Costo API reportado (USD)', 'reportedCostUsd'],
  ];

  return definitions.map(([label, key]) => ({
    metric: label,
    manual: formatMetric(manual[key]),
    orchestrator: formatMetric(orchestrator[key]),
  }));
}

/** Serialización para journal y panel: nunca convierte DESCONOCIDO en cero. */
export function serializeMeasurement(measurement: RunMeasurement): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(measurement) as [string, MetricValue][]) {
    result[key] = value.known ? String(value.value) : UNKNOWN;
  }
  return result;
}
