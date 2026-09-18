/**
 * T-05 / T-19 / AC-15 — persistencia `node:sqlite`, journal, retención,
 * concurrencia optimista y lease exclusivo.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { Store, ConcurrencyError } from '../../tools/merdn-orchestrator/src/store/store.ts';
import { SCHEMA_VERSION } from '../../tools/merdn-orchestrator/src/store/schema.ts';
import { JOURNAL_RETENTION_DAYS } from '../../tools/merdn-orchestrator/src/config.ts';

function tempDb(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'merdn-orch-'));
  return path.join(dir, '.merdn', 'orchestrator.db');
}

test('AC-15: la base se crea con node:sqlite y sin dependencia externa', () => {
  const dbPath = tempDb();
  const store = Store.open(dbPath);
  assert.equal(store.schemaVersion(), SCHEMA_VERSION);
  assert.equal(store.schemaVersion(), store.expectedSchemaVersion());
  assert.ok(fs.existsSync(dbPath), 'debe existir el archivo de base de datos');
  assert.ok(dbPath.includes('.merdn'), 'la base vive bajo .merdn/');

  const run = store.createRun({ requestText: 'necesidad ficticia', mode: 'ASISTIDO', state: 'IDEA' });
  store.close();

  // Persistencia real entre procesos lógicos: se reabre el mismo archivo.
  const reabierto = Store.open(dbPath);
  assert.equal(reabierto.getRun(run.id)?.request_text, 'necesidad ficticia');
  reabierto.close();
  fs.rmSync(path.dirname(dbPath), { recursive: true, force: true });
});

test('la actualización usa concurrencia optimista', () => {
  const store = Store.open(':memory:');
  const run = store.createRun({ requestText: 'x', mode: 'ASISTIDO', state: 'IDEA' });
  const actualizado = store.updateRun(run.id, run.version, { state: 'ANALISIS' });
  assert.equal(actualizado.version, run.version + 1);
  assert.throws(() => store.updateRun(run.id, run.version, { state: 'QA' }), ConcurrencyError);
  store.close();
});

test('T-05: sólo un proceso adquiere el lease de la misma Task', () => {
  const store = Store.open(':memory:');
  const run = store.createRun({ requestText: 'x', mode: 'ASISTIDO', state: 'IDEA' });

  assert.equal(store.acquireLease(run.id, 'proceso-a', 111), true);
  assert.equal(store.acquireLease(run.id, 'proceso-b', 222), false);
  assert.equal(store.hasLease(run.id, 'proceso-a'), true);
  assert.equal(store.hasLease(run.id, 'proceso-b'), false);

  store.releaseLease(run.id, 'proceso-a');
  assert.equal(store.acquireLease(run.id, 'proceso-b', 222), true);
  store.close();
});

test('un lease vencido queda listado para reconciliación', () => {
  let ahora = new Date('2026-08-21T10:00:00.000Z');
  const store = Store.open(':memory:', () => ahora);
  const run = store.createRun({ requestText: 'x', mode: 'ASISTIDO', state: 'IDEA' });

  store.acquireLease(run.id, 'proceso-a', 1, 1_000);
  assert.equal(store.expiredLeases().length, 0);

  ahora = new Date('2026-08-21T10:05:00.000Z');
  assert.equal(store.expiredLeases().length, 1);
  assert.equal(store.acquireLease(run.id, 'proceso-b', 2), true, 'un lease vencido puede tomarlo otro proceso');
  store.close();
});

test('las transiciones son idempotentes por clave', () => {
  const store = Store.open(':memory:');
  const run = store.createRun({ requestText: 'x', mode: 'ASISTIDO', state: 'IDEA' });
  const entrada = {
    runId: run.id,
    from: 'IDEA' as const,
    to: 'ANALISIS' as const,
    event: 'iniciar_analisis' as const,
    actor: 'orchestrator' as const,
    result: 'aceptada' as const,
    idempotencyKey: 'clave-fija',
  };
  assert.equal(store.recordTransition(entrada), true);
  assert.equal(store.recordTransition(entrada), false, 'la repetición no debe duplicar la transición');
  assert.equal(store.listTransitions(run.id).length, 1);
  store.close();
});

test('T-19: la purga del journal es manual y sólo alcanza eventos vencidos', () => {
  let ahora = new Date('2026-06-01T00:00:00.000Z');
  const store = Store.open(':memory:', () => ahora);
  const run = store.createRun({ requestText: 'x', mode: 'ASISTIDO', state: 'IDEA' });

  store.journal({ runId: run.id, kind: 'antiguo', actor: 'orchestrator', payload: {} });
  ahora = new Date('2026-08-21T00:00:00.000Z');
  store.journal({ runId: run.id, kind: 'reciente', actor: 'orchestrator', payload: {} });
  store.recordTest({ runId: run.id, name: 'demo', command: null, result: 'pass' });

  assert.equal(store.countJournal(), 2);
  const eliminados = store.purgeJournalOlderThan(JOURNAL_RETENTION_DAYS);
  assert.equal(eliminados, 1);
  assert.equal(store.countJournal(), 1);
  assert.equal(store.listJournal(run.id)[0]?.kind, 'reciente');
  // La purga nunca toca otras entidades.
  assert.equal(store.listTests(run.id).length, 1);
  store.close();
});

test('el journal redacta secretos antes de escribir', () => {
  const store = Store.open(':memory:');
  const run = store.createRun({ requestText: 'x', mode: 'ASISTIDO', state: 'IDEA' });
  store.journal({
    runId: run.id,
    kind: 'prueba',
    actor: 'orchestrator',
    reason: 'token=abcd1234efgh5678',
    payload: { authorization: 'Bearer abcd1234efgh5678ijkl' },
  });
  const fila = store.listJournal(run.id)[0];
  assert.ok(!JSON.stringify(fila).includes('abcd1234efgh5678'));
  assert.ok(JSON.stringify(fila).includes('[REDACTADO]'));
  store.close();
});

test('los contadores no se reinician al abrir una sesión nueva', () => {
  const store = Store.open(':memory:');
  const run = store.createRun({ requestText: 'x', mode: 'ASISTIDO', state: 'IDEA' });
  store.bumpCounters(run.id, { claudeInvocations: 2, aiInvocations: 3, cyclesWithoutProgress: 1 });
  store.resetCycleCounters(run.id, { cyclesWithoutProgress: true });

  const contadores = store.getCounters(run.id);
  assert.equal(contadores.claudeInvocations, 2);
  assert.equal(contadores.aiInvocations, 3);
  assert.equal(contadores.cyclesWithoutProgress, 0);
  store.close();
});

test('AUDITORÍA §6: reiniciar la ventana AI no borra el total histórico', () => {
  const store = Store.open(':memory:');
  const run = store.createRun({ requestText: 'x', mode: 'ASISTIDO', state: 'IDEA' });

  store.bumpCounters(run.id, { aiInvocations: 4 });
  assert.equal(store.getCounters(run.id).aiInvocations, 4);
  assert.equal(store.getCounters(run.id).aiInvocationsWindow, 4, 'la ventana avanza con cada invocación');

  store.resetAiWindow(run.id, 'intervencion_product_owner');
  const tras = store.getCounters(run.id);
  assert.equal(tras.aiInvocationsWindow, 0, 'la ventana se reinicia');
  assert.equal(tras.aiInvocations, 4, 'el total histórico se conserva');
  assert.ok(store.listJournal(run.id).some((e) => e.kind === 'ventana_ai_reiniciada'));

  store.bumpCounters(run.id, { aiInvocations: 2 });
  assert.equal(store.getCounters(run.id).aiInvocations, 6);
  assert.equal(store.getCounters(run.id).aiInvocationsWindow, 2);
  store.close();
});

test('AUDITORÍA §2: el registro de versiones vistas es exacto', () => {
  const store = Store.open(':memory:');
  const run = store.createRun({ requestText: 'x', mode: 'ASISTIDO', state: 'ANALISIS' });

  assert.equal(store.lastViewedVersion(run.id, 'propuesta'), null);
  assert.equal(store.hasViewedVersion(run.id, 'propuesta', 'h1'), false);

  store.recordViewedVersion({
    runId: run.id,
    kind: 'propuesta',
    hash: 'h1',
    state: 'ANALISIS',
    actor: 'product_owner',
  });
  assert.equal(store.hasViewedVersion(run.id, 'propuesta', 'h1'), true);
  assert.equal(store.hasViewedVersion(run.id, 'propuesta', 'h2'), false, 'otra versión no cuenta');
  assert.equal(store.hasViewedVersion(run.id, 'resultado', 'h1'), false, 'otro artefacto no cuenta');
  assert.equal(store.lastViewedVersion(run.id, 'propuesta'), 'h1');
  store.close();
});

test('el consumo informado por el CLI se persiste; su ausencia queda como desconocido', () => {
  const store = Store.open(':memory:');
  const run = store.createRun({ requestText: 'x', mode: 'ASISTIDO', state: 'IDEA' });

  const conUso = store.startInvocation({
    runId: run.id,
    agent: 'claude',
    phase: 'implementacion',
    sessionId: null,
    command: 'claude',
    contextChars: 10,
  });
  store.finishInvocation({
    invocationId: conUso,
    outcome: 'ok',
    errorClass: null,
    exitCode: 0,
    summary: 'listo',
    usageReported: true,
    usageDetail: JSON.stringify({ total_cost_usd: 0 }),
  });

  const sinUso = store.startInvocation({
    runId: run.id,
    agent: 'codex',
    phase: 'review',
    sessionId: null,
    command: 'codex',
    contextChars: 10,
  });
  store.finishInvocation({
    invocationId: sinUso,
    outcome: 'ok',
    errorClass: null,
    exitCode: 0,
    summary: 'listo',
  });

  const invocaciones = store.listInvocations(run.id);
  assert.equal(invocaciones[0]?.usage_reported, 1);
  assert.equal(invocaciones[1]?.usage_reported, 0);
  assert.equal(invocaciones[1]?.usage_detail, null, 'sin dato no se inventa cero');
  store.close();
});

test('cambiar la Task invalida el hash aprobado almacenado', () => {
  const store = Store.open(':memory:');
  const run = store.createRun({ requestText: 'x', mode: 'ASISTIDO', state: 'IDEA' });
  store.upsertTask({ runId: run.id, taskPath: null, taskTitle: 't', taskHash: 'h1', readyForClaude: true });
  store.approveTaskHash(run.id, 'h1');
  assert.equal(store.getTask(run.id)?.task_hash_approved, 'h1');

  store.upsertTask({ runId: run.id, taskPath: null, taskTitle: 't', taskHash: 'h2', readyForClaude: true });
  assert.equal(store.getTask(run.id)?.task_hash_approved, null);
  assert.equal(store.getTask(run.id)?.task_version, 2);
  store.close();
});
