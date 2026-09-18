/**
 * AC-12 / AC-16 / doc §14 + corrección de auditoría §8 — métricas Manual vs
 * Orchestrator.
 *
 * Regla verificada aquí: un dato DESCONOCIDO nunca vale cero y nunca puede
 * sostener la conclusión `ORCHESTRATOR_MAS_EFICIENTE`.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MANDATORY_THRESHOLDS,
  NOT_REPORTED,
  UNKNOWN,
  compare,
  emptyMeasurement,
  formatMetric,
  fromNullable,
  known,
  serializeMeasurement,
  unknownMetric,
} from '../../tools/merdn-orchestrator/src/runtime/metrics.ts';
import type { RunMeasurement } from '../../tools/merdn-orchestrator/src/runtime/metrics.ts';
import { medicion } from './helpers.mts';

/** Orquestación completa y conocida: todos los umbrales evaluables. */
function orquestadorConocido(overrides: Partial<Record<keyof RunMeasurement, number>> = {}): RunMeasurement {
  return medicion({
    productOwnerInterventions: 3,
    manuallyCopiedMessages: 0,
    totalMinutes: 60,
    productOwnerActiveMinutes: 10,
    codexInvocations: 4,
    claudeInvocations: 2,
    retries: 0,
    errors: 0,
    outOfScopeFiles: 0,
    inventedDecisions: 0,
    reportedCostUsd: 0,
    testsPass: 4,
    testsFail: 0,
    visualDivergences: 0,
    ...overrides,
  });
}

const manualTipico = medicion({
  productOwnerInterventions: 12,
  manuallyCopiedMessages: 18,
  totalMinutes: 180,
  productOwnerActiveMinutes: 90,
  codexInvocations: 6,
  claudeInvocations: 3,
  errors: 2,
  outOfScopeFiles: 0,
  testsPass: 4,
  testsFail: 0,
  visualDivergences: 0,
});

test('una medición vacía es DESCONOCIDA en todo, nunca cero', () => {
  const vacia = emptyMeasurement();
  for (const [key, value] of Object.entries(vacia)) {
    assert.equal(value.known, false, key + ' debía ser DESCONOCIDO');
  }
  const serializada = serializeMeasurement(vacia);
  for (const [key, value] of Object.entries(serializada)) {
    assert.equal(value, UNKNOWN, key + ' debía serializarse como ' + UNKNOWN);
    assert.notEqual(value, '0');
  }
});

test('null y undefined significan DESCONOCIDO, no cero', () => {
  assert.equal(fromNullable(null).known, false);
  assert.equal(fromNullable(undefined).known, false);
  const cero = fromNullable(0);
  assert.equal(cero.known, true);
  assert.equal(cero.known ? cero.value : -1, 0);
});

test('AC-16: el Orchestrator gana sólo con todos los umbrales conocidos y cumplidos', () => {
  const comparacion = compare(manualTipico, orquestadorConocido());
  assert.equal(comparacion.recommendation, 'ORCHESTRATOR_MAS_EFICIENTE');
  assert.equal(comparacion.conclusive, true);
  assert.deepEqual(comparacion.reasons, []);
  assert.deepEqual(comparacion.dataGaps, []);
  assert.ok(comparacion.thresholds.every((t) => t.status === 'cumple'));
});

test('un solo umbral incumplido obliga a recomendar MODO MANUAL', () => {
  const casos: readonly [string, Partial<Record<keyof RunMeasurement, number>>][] = [
    ['mensajes_copiados_manualmente', { manuallyCopiedMessages: 1 }],
    [
      'intervenciones_product_owner',
      { productOwnerInterventions: MANDATORY_THRESHOLDS.maxProductOwnerInterventions + 1 },
    ],
    ['invocaciones_claude', { claudeInvocations: MANDATORY_THRESHOLDS.maxClaudeInvocations + 1 }],
    ['archivos_fuera_de_alcance', { outOfScopeFiles: 1 }],
    ['decisiones_inventadas', { inventedDecisions: 1 }],
    ['costo_api', { reportedCostUsd: 0.42 }],
  ];

  for (const [id, override] of casos) {
    const comparacion = compare(manualTipico, orquestadorConocido(override));
    assert.equal(comparacion.recommendation, 'RECOMENDAR_MODO_MANUAL', id);
    assert.ok(comparacion.reasons.some((r) => r.includes(id)), id + ' debía aparecer en los motivos');
  }
});

test('AUDITORÍA §8: un costo desconocido no cuenta como cero ni permite concluir', () => {
  const comparacion = compare(manualTipico, orquestadorConocido({ reportedCostUsd: undefined }));
  const costo = comparacion.thresholds.find((t) => t.id === 'costo_api');

  assert.equal(costo?.status, 'desconocido');
  assert.equal(costo?.detail, NOT_REPORTED);
  assert.equal(comparacion.conclusive, false);
  assert.notEqual(comparacion.recommendation, 'ORCHESTRATOR_MAS_EFICIENTE');
  assert.ok(comparacion.dataGaps.includes('umbral_no_evaluable:costo_api'));
  // No aparece como incumplimiento observado: es un vacío de datos.
  assert.equal(comparacion.reasons.some((r) => r.includes('costo_api')), false);
});

test('AUDITORÍA §8: copias manuales desconocidas impiden la conclusión positiva', () => {
  const comparacion = compare(manualTipico, orquestadorConocido({ manuallyCopiedMessages: undefined }));
  assert.equal(comparacion.conclusive, false);
  assert.equal(comparacion.recommendation, 'RECOMENDAR_MODO_MANUAL');
  assert.ok(comparacion.dataGaps.includes('umbral_no_evaluable:mensajes_copiados_manualmente'));

  const fila = comparacion.rows.find((r) => r.metric === 'Mensajes copiados manualmente');
  assert.equal(fila?.orchestrator, NOT_REPORTED);
});

test('AUDITORÍA §8: decisiones inventadas desconocidas impiden la conclusión positiva', () => {
  const comparacion = compare(manualTipico, orquestadorConocido({ inventedDecisions: undefined }));
  assert.equal(comparacion.conclusive, false);
  assert.equal(comparacion.recommendation, 'RECOMENDAR_MODO_MANUAL');
  assert.ok(comparacion.dataGaps.includes('umbral_no_evaluable:decisiones_inventadas'));
});

test('AUDITORÍA §8: ningún dato faltante produce una conclusión positiva falsa', () => {
  // Todo desconocido en el lado del Orchestrator: no puede "ganar".
  const comparacion = compare(manualTipico, emptyMeasurement());
  assert.equal(comparacion.recommendation, 'RECOMENDAR_MODO_MANUAL');
  assert.equal(comparacion.conclusive, false);
  assert.equal(comparacion.dataGaps.length, 6, 'los seis umbrales quedan sin evaluar');
  assert.deepEqual(comparacion.reasons, [], 'sin datos no se afirma que sea peor, sólo que no se sabe');
});

test('las comparaciones directas sólo cuentan si ambos lados se conocen', () => {
  const masLento = compare(medicion({ totalMinutes: 60 }), orquestadorConocido({ totalMinutes: 120 }));
  assert.ok(masLento.reasons.includes('mas_lento_que_manual'));

  const sinDatoManual = compare(emptyMeasurement(), orquestadorConocido({ totalMinutes: 120 }));
  assert.equal(sinDatoManual.reasons.includes('mas_lento_que_manual'), false);

  const menosFiel = compare(medicion({ visualDivergences: 0 }), orquestadorConocido({ visualDivergences: 2 }));
  assert.ok(menosFiel.reasons.includes('menor_fidelidad_visual_que_manual'));

  const masFallos = compare(medicion({ testsFail: 0 }), orquestadorConocido({ testsFail: 1 }));
  assert.ok(masFallos.reasons.includes('mas_pruebas_fallidas_que_manual'));

  const masErrores = compare(medicion({ errors: 0 }), orquestadorConocido({ errors: 3 }));
  assert.ok(masErrores.reasons.includes('mas_errores_que_manual'));
});

test('el formato para la persona dice "Dato no disponible", nunca 0', () => {
  assert.equal(formatMetric(unknownMetric), NOT_REPORTED);
  assert.equal(formatMetric(known(12), 'min'), '12 min');
  assert.equal(formatMetric(known(0)), '0');
});

test('la tabla comparativa incluye todas las métricas del documento aprobado', () => {
  const comparacion = compare(manualTipico, emptyMeasurement());
  const esperadas = [
    'Intervenciones Product Owner',
    'Mensajes copiados manualmente',
    'Tiempo total (min)',
    'Tiempo activo del PO (min)',
    'Invocaciones Codex',
    'Invocaciones Claude',
    'Reintentos',
    'Errores',
    'Ciclos sin progreso',
    'Archivos fuera de alcance',
    'Pruebas pass',
    'Pruebas fail',
    'Pruebas no ejecutadas',
    'STOP CONDITIONS',
    'Decisiones inventadas',
    'Divergencias visuales',
    'Recuperaciones exitosas',
    'Tokens reportados',
    'Costo API reportado (USD)',
  ];
  assert.deepEqual(comparacion.rows.map((r) => r.metric), esperadas);
});
