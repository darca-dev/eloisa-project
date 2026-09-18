/**
 * AC-01 / T-02 / T-11 — gates obligatorios, READY FOR CLAUDE, presupuesto,
 * contexto y anti-loop.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  GATE_IDS,
  emptyGateContext,
  evaluateGates,
  failedReadyRequirements,
} from '../../tools/merdn-orchestrator/src/domain/gates.ts';
import type {
  GateContext,
  READY_REQUIREMENTS,
} from '../../tools/merdn-orchestrator/src/domain/gates.ts';
import { assessBudget, assessContext, emptyCounters } from '../../tools/merdn-orchestrator/src/domain/budget.ts';
import { assessProgress, detectLoop, fingerprint } from '../../tools/merdn-orchestrator/src/domain/progress.ts';
import { LIMITS } from '../../tools/merdn-orchestrator/src/config.ts';

function contextoReady(overrides: Partial<GateContext> = {}): GateContext {
  return {
    ...emptyGateContext(),
    taskApproved: true,
    taskHashApproved: 'hash',
    taskHashCurrent: 'hash',
    readyForClaudeDeclared: true,
    pendingMaterialDecisions: 0,
    allowedPathsDefined: true,
    forbiddenPathsDefined: true,
    acceptanceCriteriaDefined: true,
    testsDefined: true,
    recoveryDefined: true,
    workspaceClean: true,
    baselineRecorded: true,
    preflightOk: true,
    secretsDetected: false,
    budgetAvailable: true,
    lockAcquired: true,
    ...overrides,
  };
}

test('un contexto vacío bloquea todos los gates (falla cerrado)', () => {
  const evaluation = evaluateGates(GATE_IDS, emptyGateContext());
  assert.equal(evaluation.passed, false);
  // `decision_material` pasa con 0 pendientes; el resto debe bloquear.
  const bloqueados = evaluation.blocking.map((g) => g.id);
  for (const gate of ['aprobacion_task', 'ready_for_claude', 'ready_for_commit']) {
    assert.ok(bloqueados.includes(gate as (typeof GATE_IDS)[number]), 'debía bloquear ' + gate);
  }
});

test('READY FOR CLAUDE exige cada requisito por separado', () => {
  assert.deepEqual(failedReadyRequirements(contextoReady()), []);

  const casos: readonly [Partial<GateContext>, (typeof READY_REQUIREMENTS)[number]][] = [
    [{ taskApproved: false }, 'task_completa_aprobada_hash_vigente'],
    [{ taskHashCurrent: 'otro' }, 'task_completa_aprobada_hash_vigente'],
    [{ readyForClaudeDeclared: false }, 'ready_for_claude_declarado'],
    [{ pendingMaterialDecisions: 1 }, 'sin_decision_material_bloqueante'],
    [{ allowedPathsDefined: false }, 'allowlist_denylist_definida'],
    [{ testsDefined: false }, 'criterios_pruebas_recuperacion_definidos'],
    [{ workspaceClean: false }, 'workspace_permitido_y_baseline'],
    [{ preflightOk: false }, 'preflight_cli_aprobado'],
    [{ secretsDetected: true }, 'sin_indicios_de_secretos'],
    [{ budgetAvailable: false }, 'presupuesto_e_iteraciones_disponibles'],
    [{ lockAcquired: false }, 'lock_exclusivo_adquirido'],
  ];

  for (const [override, esperado] of casos) {
    const fallidos = failedReadyRequirements(contextoReady(override));
    assert.ok(fallidos.includes(esperado), JSON.stringify(override) + ' debía fallar ' + esperado);
    const evaluation = evaluateGates(['ready_for_claude'], contextoReady(override));
    assert.equal(evaluation.passed, false);
  }
});

test('T-02: cambiar la Task después de aprobarla invalida la aprobación', () => {
  const vigente = evaluateGates(['aprobacion_task'], contextoReady());
  assert.equal(vigente.passed, true);

  const modificada = evaluateGates(['aprobacion_task'], contextoReady({ taskHashCurrent: 'hash-nuevo' }));
  assert.equal(modificada.passed, false);
  assert.equal(modificada.blocking[0]?.reason, 'hash_de_task_invalidado');
});

test('el gate de commit exige autorización ligada al diff exacto', () => {
  const sinAutorizacion = evaluateGates(['ready_for_commit'], contextoReady());
  assert.equal(sinAutorizacion.passed, false);
  assert.equal(sinAutorizacion.blocking[0]?.reason, 'commit_no_autorizado');

  const otroDiff = evaluateGates(
    ['ready_for_commit'],
    contextoReady({
      commitAuthorization: { diffHash: 'diff-viejo', authorizedBy: 'product_owner' },
      preparedDiffHash: 'diff-actual',
    }),
  );
  assert.equal(otroDiff.passed, false);
  assert.equal(otroDiff.blocking[0]?.reason, 'autorizacion_no_ligada_al_diff');

  const correcto = evaluateGates(
    ['ready_for_commit'],
    contextoReady({
      commitAuthorization: { diffHash: 'diff-actual', authorizedBy: 'product_owner' },
      preparedDiffHash: 'diff-actual',
    }),
  );
  assert.equal(correcto.passed, true);
});

test('archivos fuera de alcance, dependencias, gasto, destructivo y deploy bloquean', () => {
  const casos: readonly [keyof GateContext, unknown, (typeof GATE_IDS)[number]][] = [
    ['outOfScopeFiles', ['apps/web/src/app/page.tsx'], 'archivo_fuera_de_alcance'],
    ['newDependencyRequested', true, 'dependencia_nueva'],
    ['spendRequested', true, 'gasto_o_secreto'],
    ['secretsDetected', true, 'gasto_o_secreto'],
    ['destructiveActionRequested', true, 'accion_destructiva'],
    ['sensitivePermissionsRequested', true, 'permisos_sensibles'],
    ['deployRequested', true, 'deploy'],
    ['visualDivergence', true, 'divergencia_visual'],
  ];
  for (const [campo, valor, gate] of casos) {
    const contexto = contextoReady({ [campo]: valor } as Partial<GateContext>);
    const evaluation = evaluateGates([gate], contexto);
    assert.equal(evaluation.passed, false, gate + ' debía bloquear');
  }
});

test('T-11: los topes de presupuesto producen el estado exacto', () => {
  assert.equal(assessBudget({ counters: emptyCounters(), agent: 'claude' }).allowed, true);

  const claudeAgotado = assessBudget({
    counters: { ...emptyCounters(), claudeInvocations: LIMITS.maxClaudeInvocationsPerTask },
    agent: 'claude',
  });
  assert.equal(claudeAgotado.outcome, 'BUDGET_LIMIT');
  assert.equal(claudeAgotado.reason, 'maximo_invocaciones_claude');

  // El tope de 6 gobierna la VENTANA, no el total histórico (auditoría §6).
  const ventanaAgotada = assessBudget({
    counters: { ...emptyCounters(), aiInvocationsWindow: LIMITS.maxAiInvocationsBeforeProductOwner },
    agent: 'codex',
  });
  assert.equal(ventanaAgotada.outcome, 'BUDGET_LIMIT');
  assert.equal(ventanaAgotada.reason, 'maximo_invocaciones_ai');

  const historicoAlto = assessBudget({
    counters: { ...emptyCounters(), aiInvocations: 99, aiInvocationsWindow: 0 },
    agent: 'codex',
  });
  assert.equal(historicoAlto.allowed, true, 'el total histórico no bloquea por sí mismo');

  const sinProgreso = assessBudget({
    counters: { ...emptyCounters(), cyclesWithoutProgress: LIMITS.maxCyclesWithoutProgress },
    agent: 'claude',
  });
  assert.equal(sinProgreso.outcome, 'LOOP_DETECTED');
});

test('los umbrales de contexto son 80k blando y 120k duro', () => {
  assert.equal(assessContext(1_000).pressure, 'ok');
  assert.equal(assessContext(LIMITS.contextSoftLimitChars).pressure, 'warning');
  const duro = assessContext(LIMITS.contextHardLimitChars);
  assert.equal(duro.pressure, 'hard_limit');
  assert.equal(duro.requiresCleanSession, true);
});

test('T-10: repetición exacta y oscilación A↔B producen LOOP_DETECTED', () => {
  assert.equal(
    detectLoop({ fingerprints: ['a', 'a'], consecutiveCyclesWithoutProgress: 0, maxCyclesWithoutProgress: 2 })
      .reason,
    'repeticion_exacta',
  );
  assert.equal(
    detectLoop({ fingerprints: ['a', 'b', 'a'], consecutiveCyclesWithoutProgress: 0, maxCyclesWithoutProgress: 2 })
      .reason,
    'oscilacion_a_b',
  );
  assert.equal(
    detectLoop({ fingerprints: ['a', 'b', 'c'], consecutiveCyclesWithoutProgress: 2, maxCyclesWithoutProgress: 2 })
      .reason,
    'ciclos_sin_progreso',
  );
  assert.equal(
    detectLoop({ fingerprints: ['a', 'b', 'c'], consecutiveCyclesWithoutProgress: 1, maxCyclesWithoutProgress: 2 })
      .loopDetected,
    false,
  );
});

test('la huella de progreso es estable ante reordenamientos', () => {
  const uno = fingerprint({
    taskHash: 'h',
    findings: ['b', 'a'],
    files: ['tools/x.ts', 'tools/a.ts'],
    testResults: ['t2=pass', 't1=fail'],
    errorClass: null,
  });
  const dos = fingerprint({
    taskHash: 'h',
    findings: ['a', 'b'],
    files: ['tools\\a.ts', 'tools/x.ts'],
    testResults: ['t1=fail', 't2=pass'],
    errorClass: null,
  });
  assert.equal(uno, dos);
});

test('el progreso exige al menos una señal aprobada', () => {
  const sin = assessProgress({
    expectedFilesTouched: [],
    newPassingTests: 0,
    blockersRemoved: 0,
    stateAdvanced: false,
    reviewAdvancedTowardPass: false,
  });
  assert.equal(sin.hasProgress, false);

  const con = assessProgress({
    expectedFilesTouched: ['tools/merdn-orchestrator/src/x.ts'],
    newPassingTests: 0,
    blockersRemoved: 0,
    stateAdvanced: false,
    reviewAdvancedTowardPass: false,
  });
  assert.deepEqual(con.signals, ['archivo_esperado_creado_o_modificado']);
});
