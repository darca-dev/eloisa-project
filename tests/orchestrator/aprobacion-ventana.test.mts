/**
 * Corrección final de auditoría — pruebas negativas específicas.
 *
 * §1 APROBAR exige explícitamente el hash que el Product Owner aprueba.
 * §2 La ventana de invocaciones AI sólo se reinicia tras una intervención
 *    explícita, válida y aceptada.
 *
 * Estas pruebas cubren exactamente los bypasses reproducidos por Codex.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createHarness,
  cleanBaseline,
  dirtyBaseline,
  hastaTaskReady,
  implementacionValida,
  mockOutput,
  propuestaLista,
} from './helpers.mts';
import type { Harness } from './helpers.mts';
import { handleCommand } from '../../tools/merdn-orchestrator/src/ui/server.ts';
import { OrchestratorError } from '../../tools/merdn-orchestrator/src/domain/errors.ts';

const EN_ALCANCE = 'tools/merdn-orchestrator/src/demo.ts';

/** Deja una ejecución en ANALISIS con una propuesta lista para aprobar. */
async function conPropuesta(h: Harness, texto = 'Quiero un tablero.'): Promise<string> {
  h.codex.enqueue({ result: { output: propuestaLista() } });
  const creado = h.orchestrator.crear(texto, 'ASISTIDO');
  await h.orchestrator.prepararPropuesta(creado.runId, { confirmado: true });
  return creado.runId;
}

function aprobacionesRegistradas(h: Harness, runId: string): number {
  return h.store.listApprovals(runId).filter((a) => a.outcome === 'aprobado').length;
}

// ---------------------------------------------------------------------------
// §1 — APROBAR exige hash explícito
// ---------------------------------------------------------------------------

test('§1.A: VER y luego APROBAR sin hash queda bloqueado', async () => {
  const h = createHarness();
  const runId = await conPropuesta(h);

  h.orchestrator.ver(runId);

  // El request no envía hash: no se puede inferir del último visto.
  const sinHash = h.orchestrator.aprobarPropuesta(runId);
  assert.equal(sinHash.ok, false);
  assert.equal(sinHash.reason, 'aprobacion_sin_hash');
  assert.equal(h.orchestrator.view(runId).state, 'ANALISIS', 'el estado se conserva');

  // Un hash vacío tampoco vale.
  assert.equal(h.orchestrator.aprobarPropuesta(runId, '').reason, 'aprobacion_sin_hash');
  assert.equal(h.orchestrator.aprobarPropuesta(runId, '   ').reason, 'aprobacion_sin_hash');

  // El intento queda en el journal, pero nunca como aprobación.
  assert.ok(h.store.listJournal(runId).some((e) => e.kind === 'aprobacion_rechazada'));
  assert.equal(aprobacionesRegistradas(h, runId), 0);
  assert.equal(h.store.getTask(runId)?.task_hash_approved ?? null, null);
  h.close();
});

test('§1.B: VER y luego APROBAR con hash incorrecto queda bloqueado', async () => {
  const h = createHarness();
  const runId = await conPropuesta(h);
  h.orchestrator.ver(runId);

  const resultado = h.orchestrator.aprobarPropuesta(runId, 'hash-inventado');
  assert.equal(resultado.ok, false);
  assert.equal(resultado.reason, 'aprobacion_stale');
  assert.equal(h.orchestrator.view(runId).state, 'ANALISIS');
  assert.equal(aprobacionesRegistradas(h, runId), 0);
  h.close();
});

test('§1.C: si el artefacto cambia tras VER, el hash viejo queda bloqueado', async () => {
  const h = createHarness();
  const runId = await conPropuesta(h);

  const viejo = h.orchestrator.ver(runId).detail?.['hashVisto'] as string;

  // La propuesta se rehace: cambia el contenido y por lo tanto el hash.
  h.codex.enqueue({ result: { output: propuestaLista({ summary: 'Propuesta distinta.' }) } });
  await h.orchestrator.prepararPropuesta(runId, { confirmado: true });
  const actual = h.orchestrator.propuestaHash(runId);
  assert.notEqual(actual, viejo);

  const conViejo = h.orchestrator.aprobarPropuesta(runId, viejo);
  assert.equal(conViejo.ok, false);
  assert.equal(conViejo.reason, 'aprobacion_stale');

  // Tampoco basta con enviar el hash nuevo sin haberlo visto.
  const sinVerLoNuevo = h.orchestrator.aprobarPropuesta(runId, actual);
  assert.equal(sinVerLoNuevo.ok, false);
  assert.equal(sinVerLoNuevo.reason, 'aprobacion_stale');
  assert.equal(h.orchestrator.view(runId).state, 'ANALISIS');
  assert.equal(aprobacionesRegistradas(h, runId), 0);
  h.close();
});

test('§1.D: VER y luego APROBAR con el hash correcto sí procede', async () => {
  const h = createHarness();
  const runId = await conPropuesta(h);

  const hash = h.orchestrator.ver(runId).detail?.['hashVisto'] as string;
  const aprobado = h.orchestrator.aprobarPropuesta(runId, hash);

  assert.equal(aprobado.ok, true);
  assert.equal(aprobado.state, 'TASK_READY');
  assert.equal(aprobacionesRegistradas(h, runId), 1);
  assert.equal(h.store.getTask(runId)?.task_hash_approved, hash);
  h.close();
});

test('§1: el resultado final exige el mismo hash explícito', async () => {
  const h = createHarness({ baselines: [cleanBaseline(), dirtyBaseline([EN_ALCANCE])] });
  const runId = await hastaTaskReady(h);
  h.claude.enqueue({ result: { output: implementacionValida() } });
  await h.orchestrator.implementar(runId, { confirmado: true });
  h.codex.enqueue({ result: { output: mockOutput({ summary: 'ok', verdict: 'PASS' }) } });
  await h.orchestrator.revisar(runId);
  assert.equal(h.orchestrator.view(runId).state, 'ESPERANDO_APROBACION_VISUAL');

  h.orchestrator.ver(runId);
  assert.equal(h.orchestrator.aprobarResultado(runId).reason, 'aprobacion_sin_hash');
  assert.equal(h.orchestrator.aprobarResultado(runId, 'otro').reason, 'aprobacion_stale');
  assert.equal(h.orchestrator.view(runId).state, 'ESPERANDO_APROBACION_VISUAL');

  const hash = h.orchestrator.resultadoHash(runId) as string;
  assert.equal(h.orchestrator.aprobarResultado(runId, hash).state, 'READY_FOR_COMMIT');
  h.close();
});

test('§1: el panel tampoco puede aprobar sin enviar el hash', async () => {
  const h = createHarness();
  const runId = await conPropuesta(h);
  await handleCommand(h.orchestrator, { comando: 'ver', runId });

  const sinHash = await handleCommand(h.orchestrator, { comando: 'aprobar', runId });
  assert.equal(sinHash['ok'], false);
  assert.equal(sinHash['motivo'], 'aprobacion_sin_hash');
  assert.equal(h.orchestrator.view(runId).state, 'ANALISIS');
  h.close();
});

// ---------------------------------------------------------------------------
// §2 — La ventana AI sólo se reinicia con una intervención válida
// ---------------------------------------------------------------------------

/** Deja la ventana AI en 5 y devuelve el total histórico de referencia. */
function ventanaEnCinco(h: Harness, runId: string): { ventana: number; historico: number } {
  h.store.resetAiWindow(runId, 'preparacion_de_prueba');
  h.store.bumpCounters(runId, { aiInvocations: 5 });
  const contadores = h.store.getCounters(runId);
  assert.equal(contadores.aiInvocationsWindow, 5);
  return { ventana: contadores.aiInvocationsWindow, historico: contadores.aiInvocations };
}

test('§2.A: un CONTINUAR inválido no reinicia la ventana', async () => {
  const h = createHarness();
  const runId = await conPropuesta(h);
  const antes = ventanaEnCinco(h, runId);

  // ANALISIS no admite `reanudar`: la acción no es una intervención válida.
  const invalido = h.orchestrator.continuar(runId);
  assert.equal(invalido.ok, false);

  const despues = h.store.getCounters(runId);
  assert.equal(despues.aiInvocationsWindow, 5, 'la ventana no se reinicia');
  assert.equal(despues.aiInvocations, antes.historico, 'el histórico permanece intacto');
  assert.equal(
    h.store.listJournal(runId).some((e) => e.kind === 'ventana_ai_reiniciada' && e.reason !== 'preparacion_de_prueba'),
    false,
    'no se registra ninguna intervención',
  );
  h.close();
});

test('§2.B: una aprobación inválida no reinicia la ventana', async () => {
  const h = createHarness();
  const runId = await conPropuesta(h);
  h.orchestrator.ver(runId);
  const antes = ventanaEnCinco(h, runId);

  assert.equal(h.orchestrator.aprobarPropuesta(runId).ok, false, 'sin hash');
  assert.equal(h.store.getCounters(runId).aiInvocationsWindow, 5);

  assert.equal(h.orchestrator.aprobarPropuesta(runId, 'hash-malo').ok, false, 'hash incorrecto');
  const despues = h.store.getCounters(runId);
  assert.equal(despues.aiInvocationsWindow, 5, 'la ventana no se reinicia');
  assert.equal(despues.aiInvocations, antes.historico);
  h.close();
});

test('§2.C: una acción desconocida no reinicia la ventana', async () => {
  const h = createHarness();
  const runId = await conPropuesta(h);
  const antes = ventanaEnCinco(h, runId);

  await assert.rejects(
    handleCommand(h.orchestrator, { comando: 'reiniciar_todo', runId }),
    (error: unknown) => error instanceof OrchestratorError && error.code === 'comando_desconocido',
  );

  const despues = h.store.getCounters(runId);
  assert.equal(despues.aiInvocationsWindow, 5);
  assert.equal(despues.aiInvocations, antes.historico);
  h.close();
});

test('§2.B bis: responder una decisión inexistente no reinicia la ventana', async () => {
  const h = createHarness();
  const runId = await conPropuesta(h);
  const antes = ventanaEnCinco(h, runId);

  const invalido = h.orchestrator.responderDecision(runId, 'dec_inexistente', 'lo que sea');
  assert.equal(invalido.ok, false);

  const despues = h.store.getCounters(runId);
  assert.equal(despues.aiInvocationsWindow, 5);
  assert.equal(despues.aiInvocations, antes.historico);
  h.close();
});

test('§2.D: una intervención válida sí reinicia la ventana y conserva el histórico', async () => {
  const h = createHarness();
  const runId = await conPropuesta(h);
  const hash = h.orchestrator.ver(runId).detail?.['hashVisto'] as string;
  const antes = ventanaEnCinco(h, runId);

  const aprobado = h.orchestrator.aprobarPropuesta(runId, hash);
  assert.equal(aprobado.ok, true);

  const despues = h.store.getCounters(runId);
  assert.equal(despues.aiInvocationsWindow, 0, 'la ventana se reinicia');
  assert.equal(despues.aiInvocations, antes.historico, 'el histórico nunca se reinicia');
  assert.ok(h.store.listJournal(runId).some((e) => e.kind === 'ventana_ai_reiniciada'));
  h.close();
});

test('§2.E: el histórico permanece intacto en toda la secuencia', async () => {
  const h = createHarness();
  const runId = await conPropuesta(h);
  const hash = h.orchestrator.ver(runId).detail?.['hashVisto'] as string;
  const { historico } = ventanaEnCinco(h, runId);

  h.orchestrator.continuar(runId);
  h.orchestrator.aprobarPropuesta(runId);
  h.orchestrator.aprobarPropuesta(runId, 'hash-malo');
  h.orchestrator.responderDecision(runId, 'dec_inexistente', 'x');
  assert.equal(h.store.getCounters(runId).aiInvocations, historico);
  assert.equal(h.store.getCounters(runId).aiInvocationsWindow, 5);

  h.orchestrator.aprobarPropuesta(runId, hash);
  assert.equal(h.store.getCounters(runId).aiInvocations, historico, 'el histórico sigue intacto');
  assert.equal(h.store.getCounters(runId).aiInvocationsWindow, 0);
  h.close();
});

test('§2: DETENER y una cancelación no cuentan como autorización para continuar', async () => {
  const h = createHarness();
  const runId = await conPropuesta(h);
  ventanaEnCinco(h, runId);

  const detenido = h.orchestrator.detener(runId);
  assert.equal(detenido.ok, true, 'detener sí es una acción válida');
  assert.equal(
    h.store.getCounters(runId).aiInvocationsWindow,
    5,
    'pero detener no autoriza continuar: la ventana no se reinicia',
  );
  h.close();
});
