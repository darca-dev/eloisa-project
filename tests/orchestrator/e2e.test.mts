/**
 * T-17 — flujo controlado completo con adapters falsos: de IDEA a
 * READY_FOR_COMMIT, sin ninguna operación Git y con métricas comparables.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createHarness,
  cleanBaseline,
  dirtyBaseline,
  implementacionValida,
  medicion,
  mockOutput,
  propuestaLista,
  verYAprobar,
} from './helpers.mts';
import { NOT_REPORTED } from '../../tools/merdn-orchestrator/src/runtime/metrics.ts';
import type { RunMeasurement } from '../../tools/merdn-orchestrator/src/runtime/metrics.ts';
import { createFakeRunner } from '../../tools/merdn-orchestrator/src/adapters/process.ts';
import { GitReader } from '../../tools/merdn-orchestrator/src/workspace/git.ts';
import { REPO_ROOT } from '../../tools/merdn-orchestrator/src/config.ts';

const ARCHIVO = 'tools/merdn-orchestrator/src/demo-e2e.ts';

test('T-17: IDEA -> READY_FOR_COMMIT con adapters falsos y sin tocar Git', async () => {
  const h = createHarness({ baselines: [cleanBaseline(), dirtyBaseline([ARCHIVO])] });

  // 1. La Product Owner escribe su necesidad en lenguaje natural.
  const creado = h.orchestrator.crear('Quiero ver la población atendida por programa.', 'ASISTIDO');
  assert.equal(creado.state, 'IDEA');
  assert.equal(creado.mode, 'ASISTIDO');

  // 2. Codex prepara la propuesta.
  h.codex.enqueue({ result: { output: propuestaLista() } });
  const propuesta = await h.orchestrator.prepararPropuesta(creado.runId, { confirmado: true });
  assert.equal(propuesta.ok, true);
  assert.equal(h.orchestrator.view(creado.runId).headline, 'Propuesta preparada');

  // 3. La Product Owner ve exactamente la propuesta y la aprueba.
  assert.equal(verYAprobar(h, creado.runId).state, 'TASK_READY');

  // 4. Claude implementa dentro del alcance permitido. El CLI simulado sí
  //    reporta consumo, como hace el real (`total_cost_usd`).
  h.claude.enqueue({
    result: {
      output: implementacionValida({
        files: [{ path: ARCHIVO, changeType: 'creado' }],
        usage: { reported: true, detail: JSON.stringify({ total_cost_usd: 0 }) },
      }),
    },
  });
  assert.equal((await h.orchestrator.implementar(creado.runId, { confirmado: true })).state, 'QA');

  // 5. Codex revisa y aprueba técnicamente.
  h.codex.enqueue({ result: { output: mockOutput({ summary: 'cumple los criterios', verdict: 'PASS' }) } });
  assert.equal((await h.orchestrator.revisar(creado.runId)).state, 'ESPERANDO_APROBACION_VISUAL');

  // 6. La Product Owner ve el resultado y lo aprueba: el flujo llega hasta
  //    el gate Git y no más allá.
  const aprobado = verYAprobar(h, creado.runId);
  assert.equal(aprobado.state, 'READY_FOR_COMMIT');

  // Evidencia trazable (AC-14).
  const vista = h.orchestrator.view(creado.runId);
  const transiciones = (vista.technical['transiciones'] as { evento: string; resultado: string }[]).filter(
    (t) => t.resultado === 'aceptada',
  );
  assert.deepEqual(
    transiciones.map((t) => t.evento),
    [
      'iniciar_analisis',
      'aprobar_task',
      'iniciar_implementacion',
      'entregar_handoff',
      'review_pass',
      'aprobar_resultado',
      'preparar_commit',
    ],
  );
  assert.equal(h.store.getCounters(creado.runId).claudeInvocations, 1);
  assert.equal(h.store.listTests(creado.runId).length, 1);
  assert.equal(h.store.listFileChanges(creado.runId).filter((f) => f.in_scope === 0).length, 0);

  // 7. Nada de Git: el estado final exige autorización humana.
  const commit = h.orchestrator.autorizarCommit(creado.runId);
  assert.equal(commit.ok, false);

  // 8. Métricas comparables con la vía manual.
  const manual: RunMeasurement = medicion({
    productOwnerInterventions: 9,
    manuallyCopiedMessages: 14,
    totalMinutes: 150,
    codexInvocations: 5,
    claudeInvocations: 3,
    testsPass: 1,
    errors: 0,
    testsFail: 0,
    visualDivergences: 0,
    outOfScopeFiles: 0,
  });

  // Sin evidencia explícita, "0 copias manuales" es DESCONOCIDO, no cero.
  const sinEvidencia = h.orchestrator.compararConManual(creado.runId, manual);
  assert.equal(sinEvidencia.orchestrator.manuallyCopiedMessages.known, false);
  assert.equal(sinEvidencia.conclusive, false);
  assert.notEqual(sinEvidencia.recommendation, 'ORCHESTRATOR_MAS_EFICIENTE');
  assert.ok(sinEvidencia.dataGaps.includes('umbral_no_evaluable:mensajes_copiados_manualmente'));

  // La Product Owner declara la evidencia: no hubo copias manuales.
  h.orchestrator.registrarEvidenciaCopias(creado.runId, 0);
  const comparacion = h.orchestrator.compararConManual(creado.runId, manual);

  const copias = comparacion.orchestrator.manuallyCopiedMessages;
  assert.equal(copias.known && copias.value, 0);
  const intervenciones = comparacion.orchestrator.productOwnerInterventions;
  assert.ok(intervenciones.known && intervenciones.value <= 3, 'máximo 3 intervenciones');
  const claude = comparacion.orchestrator.claudeInvocations;
  assert.ok(claude.known && claude.value <= 3, 'máximo 3 invocaciones Claude');
  const fuera = comparacion.orchestrator.outOfScopeFiles;
  assert.equal(fuera.known && fuera.value, 0);
  // La revisión corrió: las decisiones inventadas son medibles y son cero.
  const inventadas = comparacion.orchestrator.inventedDecisions;
  assert.equal(inventadas.known && inventadas.value, 0);

  assert.equal(comparacion.recommendation, 'ORCHESTRATOR_MAS_EFICIENTE');
  assert.equal(comparacion.conclusive, true);
  assert.ok(h.store.listMetrics(creado.runId).length > 0, 'las métricas quedan persistidas');

  // El costo lo reportó el CLI: $0. Los tokens no vinieron en el reporte y
  // por eso se exportan como dato no disponible, nunca como cero.
  const costo = comparacion.orchestrator.reportedCostUsd;
  assert.equal(costo.known && costo.value, 0);
  const filaTokens = comparacion.rows.find((r) => r.metric === 'Tokens reportados');
  assert.equal(filaTokens?.orchestrator, NOT_REPORTED);

  h.close();
});

test('T-17: sin revisión ejecutada las decisiones inventadas quedan DESCONOCIDAS', async () => {
  const h = createHarness({ baselines: [cleanBaseline(), dirtyBaseline([ARCHIVO])] });
  const creado = h.orchestrator.crear('Necesito un reporte.', 'ASISTIDO');
  h.codex.enqueue({ result: { output: propuestaLista() } });
  await h.orchestrator.prepararPropuesta(creado.runId, { confirmado: true });
  verYAprobar(h, creado.runId);
  h.claude.enqueue({ result: { output: implementacionValida({ files: [{ path: ARCHIVO, changeType: 'creado' }] }) } });
  await h.orchestrator.implementar(creado.runId, { confirmado: true });

  // Todavía no hubo revisión: no existe mecanismo que permita afirmar 0.
  const medida = h.orchestrator.medirOrchestrator(creado.runId);
  assert.equal(medida.inventedDecisions.known, false);
  assert.equal(medida.reportedCostUsd.known, false, 'el mock no reporta costo');
  h.close();
});

test('T-17: el journal deja evidencia completa y sin secretos', async () => {
  const h = createHarness({ baselines: [cleanBaseline(), dirtyBaseline([ARCHIVO])] });
  const creado = h.orchestrator.crear('Necesito un reporte simple.', 'ASISTIDO');
  h.codex.enqueue({ result: { output: propuestaLista() } });
  await h.orchestrator.prepararPropuesta(creado.runId, { confirmado: true });
  verYAprobar(h, creado.runId);
  h.claude.enqueue({ result: { output: implementacionValida({ files: [{ path: ARCHIVO, changeType: 'creado' }] }) } });
  await h.orchestrator.implementar(creado.runId, { confirmado: true });

  const journal = h.store.listJournal(creado.runId, 500);
  const tipos = new Set(journal.map((e) => e.kind));
  for (const esperado of [
    'solicitud_creada',
    'transicion',
    'task_registrada',
    'checkpoint',
    'version_vista',
    'aprobacion_registrada',
  ]) {
    assert.ok(tipos.has(esperado), 'falta el evento ' + esperado);
  }
  const serializado = JSON.stringify(journal);
  assert.equal(/sk-ant-|Bearer\s+\w{12}|ANTHROPIC_API_KEY=/.test(serializado), false);
  h.close();
});

test('el lector de Git del runtime sólo emite comandos de lectura', async () => {
  const llamadas: string[][] = [];
  const runner = createFakeRunner((request) => {
    llamadas.push([...request.args]);
    if (request.args[0] === 'status') {
      return { exitCode: 0, stdout: ' M tools/merdn-orchestrator/src/x.ts\n?? nuevo.ts\n' };
    }
    return { exitCode: 0, stdout: 'abc123\n' };
  });

  const reader = new GitReader(runner, REPO_ROOT);
  const baseline = await reader.captureBaseline('2026-08-21T00:00:00.000Z');

  assert.equal(baseline.headCommit, 'abc123');
  assert.equal(baseline.clean, false);
  assert.deepEqual(
    baseline.entries.map((e) => e.path),
    ['tools/merdn-orchestrator/src/x.ts', 'nuevo.ts'],
  );

  const prohibidos = ['reset', 'clean', 'stash', 'rebase', 'checkout', 'commit', 'push', 'merge'];
  for (const llamada of llamadas) {
    assert.equal(prohibidos.includes(llamada[0] ?? ''), false, 'comando prohibido: git ' + llamada.join(' '));
  }
});
