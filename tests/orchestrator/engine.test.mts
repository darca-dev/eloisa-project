/**
 * AC-01..AC-08, AC-11, AC-14, T-03, T-04, T-09..T-15, T-21 — motor del
 * Orchestrator: gates, modos, workspace, anti-loop, presupuesto y
 * recuperación.
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
  verYAprobar,
} from './helpers.mts';
import { Store } from '../../tools/merdn-orchestrator/src/store/store.ts';
import { Orchestrator } from '../../tools/merdn-orchestrator/src/runtime/engine.ts';
import { MockAgentAdapter } from '../../tools/merdn-orchestrator/src/adapters/mocks.ts';
import { ScriptedWorkspaceProbe } from '../../tools/merdn-orchestrator/src/workspace/probe.ts';
import { LIMITS } from '../../tools/merdn-orchestrator/src/config.ts';
import { OrchestratorError } from '../../tools/merdn-orchestrator/src/domain/errors.ts';

const EN_ALCANCE = 'tools/merdn-orchestrator/src/demo.ts';
const FUERA_DE_ALCANCE = 'apps/web/src/app/hospital/page.tsx';

test('FR-01: el intake rechaza texto vacío y posibles secretos', () => {
  const h = createHarness();
  assert.throws(() => h.orchestrator.crear('   '), OrchestratorError);
  assert.throws(
    () => h.orchestrator.crear('usa la clave ANTHROPIC_API_KEY=sk-ant-ejemploficticio1234567890'),
    (error: unknown) => error instanceof OrchestratorError && error.code === 'posible_secreto_en_solicitud',
  );
  const ok = h.orchestrator.crear('Quiero ver la población atendida por programa.');
  assert.equal(ok.state, 'IDEA');
  h.close();
});

test('T-12: MANUAL nunca invoca agentes y exporta el handoff', async () => {
  const h = createHarness();
  const creado = h.orchestrator.crear('Necesito un tablero.', 'MANUAL');
  const resultado = await h.orchestrator.prepararPropuesta(creado.runId);

  assert.equal(resultado.ok, false);
  assert.equal(resultado.reason, 'modo_manual_no_invoca_agentes');
  assert.equal(h.codex.requests.length, 0, 'MANUAL no invoca a Codex');
  assert.ok(String(resultado.detail?.handoff ?? '').includes('MERDN Orchestrator'));
  assert.equal(h.orchestrator.view(creado.runId).state, 'IDEA', 'el estado se conserva');
  h.close();
});

test('T-12: ASISTIDO exige confirmación explícita antes de invocar', async () => {
  const h = createHarness();
  h.codex.enqueue({ result: { output: propuestaLista() } });
  const creado = h.orchestrator.crear('Necesito un tablero.', 'ASISTIDO');

  const sinConfirmar = await h.orchestrator.prepararPropuesta(creado.runId);
  assert.equal(sinConfirmar.ok, false);
  assert.equal(sinConfirmar.reason, 'modo_asistido_requiere_confirmacion_product_owner');
  assert.equal(h.codex.requests.length, 0);

  const confirmado = await h.orchestrator.prepararPropuesta(creado.runId, { confirmado: true });
  assert.equal(confirmado.ok, true);
  assert.equal(h.codex.requests.length, 1);
  h.close();
});

test('T-12: AUTOMATICO avanza sin confirmación pero sigue sujeto a los gates', async () => {
  const h = createHarness({ baselines: [cleanBaseline(), dirtyBaseline([EN_ALCANCE])] });
  h.codex.enqueue({ result: { output: propuestaLista() } });
  const creado = h.orchestrator.crear('Necesito un tablero.', 'AUTOMATICO');

  // Sin confirmar: en AUTOMATICO la propuesta se prepara igual.
  const propuesta = await h.orchestrator.prepararPropuesta(creado.runId);
  assert.equal(propuesta.ok, true);
  assert.equal(h.codex.requests.length, 1);

  // Aun en AUTOMATICO, sin Task aprobada el gate impide implementar.
  const sinAprobar = await h.orchestrator.implementar(creado.runId);
  assert.equal(sinAprobar.ok, false);
  assert.equal(h.claude.requests.length, 0);

  verYAprobar(h, creado.runId);
  h.claude.enqueue({ result: { output: implementacionValida() } });
  const implementado = await h.orchestrator.implementar(creado.runId);
  assert.equal(implementado.state, 'QA');
  h.close();
});

test('AC-03: cambiar de modo conserva estado, Task, decisiones y contadores', async () => {
  const h = createHarness();
  const runId = await hastaTaskReady(h);
  const antes = h.orchestrator.view(runId);

  h.orchestrator.cambiarModo(runId, 'AUTOMATICO');
  const despues = h.orchestrator.view(runId);

  assert.equal(despues.mode, 'AUTOMATICO');
  assert.equal(despues.state, antes.state);
  assert.deepEqual(despues.technical['task'], antes.technical['task']);
  assert.deepEqual(despues.technical['contadores'], antes.technical['contadores']);
  assert.ok(h.store.listJournal(runId).some((e) => e.kind === 'cambio_de_modo'));
  h.close();
});

test('AC-01: sin Task aprobada no se invoca a Claude', async () => {
  const h = createHarness({ baselines: [cleanBaseline(), cleanBaseline()] });
  h.codex.enqueue({ result: { output: propuestaLista() } });
  const creado = h.orchestrator.crear('Necesito un tablero.', 'ASISTIDO');
  await h.orchestrator.prepararPropuesta(creado.runId, { confirmado: true });

  // Sin aprobar la propuesta el estado sigue en ANALISIS.
  const intento = await h.orchestrator.implementar(creado.runId, { confirmado: true });
  assert.equal(intento.ok, false);
  assert.equal(intento.reason, 'estado_invalido');
  assert.equal(h.claude.requests.length, 0);
  h.close();
});

test('AC-01: con READY FOR CLAUDE = NO el gate bloquea la implementación', async () => {
  const h = createHarness({ baselines: [cleanBaseline()] });
  h.codex.enqueue({ result: { output: propuestaLista({ readyForClaude: false }) } });
  const creado = h.orchestrator.crear('Necesito un tablero.', 'ASISTIDO');
  await h.orchestrator.prepararPropuesta(creado.runId, { confirmado: true });
  verYAprobar(h, creado.runId);

  const intento = await h.orchestrator.implementar(creado.runId, { confirmado: true });
  assert.equal(intento.ok, false);
  assert.equal(intento.reason, 'gate_bloqueante');
  assert.ok(intento.blocking?.some((g) => g.id === 'ready_for_claude'));
  assert.ok(intento.blocking?.[0]?.detail?.includes('ready_for_claude_declarado'));
  assert.equal(h.claude.requests.length, 0, 'nunca se invoca a Claude con READY = NO');
  h.close();
});

test('T-14/T-20: sin Claude CLI el flujo pasa a PAUSED y no invoca', async () => {
  const h = createHarness({ baselines: [cleanBaseline()], claudePreflightOk: false });
  const runId = await hastaTaskReady(h);

  const intento = await h.orchestrator.implementar(runId, { confirmado: true });
  assert.equal(intento.ok, false);
  assert.equal(intento.state, 'PAUSED');
  assert.equal(intento.message, 'Claude Code necesita habilitarse para continuar.');
  assert.equal(h.claude.requests.length, 0);
  assert.equal(h.orchestrator.view(runId).resumeState, 'TASK_READY');
  h.close();
});

test('T-21: un working tree con cambios ajenos pausa antes de invocar', async () => {
  const h = createHarness({ baselines: [dirtyBaseline(['apps/web/src/algo.tsx'])] });
  const runId = await hastaTaskReady(h);

  const intento = await h.orchestrator.implementar(runId, { confirmado: true });
  assert.equal(intento.state, 'PAUSED');
  assert.equal(intento.reason, 'working_tree_sucio_al_iniciar');
  assert.equal(h.claude.requests.length, 0);
  assert.ok(h.store.listJournal(runId).some((e) => e.kind === 'workspace_bloqueado'));
  h.close();
});

test('AUDITORÍA §3: iniciar exige working tree limpio, incluso con cambios en alcance', async () => {
  // El archivo está dentro de la allowlist, pero la Task todavía no empezó:
  // la decisión aprobada exige limpieza antes de comenzar.
  const h = createHarness({ baselines: [dirtyBaseline([EN_ALCANCE])] });
  const runId = await hastaTaskReady(h);

  const intento = await h.orchestrator.implementar(runId, { confirmado: true });
  assert.equal(intento.state, 'PAUSED');
  assert.equal(intento.reason, 'working_tree_sucio_al_iniciar');
  assert.equal(h.claude.requests.length, 0, 'ni Codex ni Claude se invocan con el árbol sucio');

  // Nada se borró ni se revirtió: el cambio sigue reportado en el detalle.
  assert.deepEqual(intento.detail?.['sucios'], [EN_ALCANCE]);
  h.close();
});

test('AUDITORÍA §3: el estado local .merdn/ no cuenta como working tree sucio', async () => {
  const h = createHarness({
    baselines: [dirtyBaseline(['.merdn/orchestrator.db', '.merdn/artifacts/x.json']), dirtyBaseline([EN_ALCANCE])],
  });
  const runId = await hastaTaskReady(h);
  h.claude.enqueue({ result: { output: implementacionValida() } });

  const resultado = await h.orchestrator.implementar(runId, { confirmado: true });
  assert.equal(resultado.state, 'QA', '.merdn/ ignorado no debe bloquear el inicio');
  h.close();
});

test('AUDITORÍA §3: ya iniciada la Task, su propio diff no vuelve a bloquear', async () => {
  const h = createHarness({
    baselines: [
      cleanBaseline(),
      dirtyBaseline([EN_ALCANCE]),
      dirtyBaseline([EN_ALCANCE]),
      dirtyBaseline([EN_ALCANCE, 'tools/merdn-orchestrator/src/otro.ts']),
    ],
  });
  const runId = await hastaTaskReady(h);

  h.claude.enqueue({ result: { output: implementacionValida() } });
  assert.equal((await h.orchestrator.implementar(runId, { confirmado: true })).state, 'QA');

  h.codex.enqueue({ result: { output: mockOutput({ summary: 'faltan cosas', verdict: 'CHANGES_REQUIRED' }) } });
  await h.orchestrator.revisar(runId);

  // Segundo ciclo: el diff existente lo produjo esta misma Task.
  h.claude.enqueue({
    result: { output: implementacionValida({ files: [{ path: 'tools/merdn-orchestrator/src/otro.ts', changeType: 'creado' }] }) },
  });
  const segundo = await h.orchestrator.implementar(runId, { confirmado: true });
  assert.equal(segundo.state, 'QA');
  assert.equal(h.claude.requests.length, 2);
  h.close();
});

test('AUDITORÍA §3: un cambio ajeno aparecido a mitad de la Task vuelve a pausar', async () => {
  const h = createHarness({
    baselines: [cleanBaseline(), dirtyBaseline([EN_ALCANCE]), dirtyBaseline([EN_ALCANCE, FUERA_DE_ALCANCE])],
  });
  const runId = await hastaTaskReady(h);

  h.claude.enqueue({ result: { output: implementacionValida() } });
  await h.orchestrator.implementar(runId, { confirmado: true });

  h.codex.enqueue({ result: { output: mockOutput({ summary: 'faltan cosas', verdict: 'CHANGES_REQUIRED' }) } });
  await h.orchestrator.revisar(runId);

  const segundo = await h.orchestrator.implementar(runId, { confirmado: true });
  assert.equal(segundo.state, 'PAUSED');
  assert.equal(segundo.reason, 'cambios_locales_no_reconocidos');
  assert.equal(h.claude.requests.length, 1, 'no se invoca con cambios ajenos presentes');
  h.close();
});

test('flujo feliz: la implementación entrega a QA sin tocar Git', async () => {
  const h = createHarness({ baselines: [cleanBaseline(), dirtyBaseline([EN_ALCANCE])] });
  const runId = await hastaTaskReady(h);
  h.claude.enqueue({ result: { output: implementacionValida() } });

  const resultado = await h.orchestrator.implementar(runId, { confirmado: true });
  assert.equal(resultado.ok, true);
  assert.equal(resultado.state, 'QA');

  const vista = h.orchestrator.view(runId);
  const archivos = vista.technical['archivosTocados'] as { ruta: string; tipo: string; enAlcance: boolean }[];
  assert.deepEqual(archivos, [{ ruta: EN_ALCANCE, tipo: 'modificado', enAlcance: true }]);
  assert.equal(h.store.lastCheckpoint(runId)?.state, 'IMPLEMENTANDO', 'AC-14: hay checkpoint trazable');
  h.close();
});

test('T-09: un archivo fuera de alcance detiene con STOP_CONDITION y sin revertir', async () => {
  const h = createHarness({ baselines: [cleanBaseline(), dirtyBaseline([EN_ALCANCE, FUERA_DE_ALCANCE])] });
  const runId = await hastaTaskReady(h);
  h.claude.enqueue({ result: { output: implementacionValida() } });

  const resultado = await h.orchestrator.implementar(runId, { confirmado: true });
  assert.equal(resultado.state, 'STOP_CONDITION');
  assert.equal(resultado.reason, 'archivos_fuera_de_alcance');

  const journal = h.store.listJournal(runId);
  assert.ok(journal.some((e) => e.kind === 'archivos_fuera_de_alcance'));
  // El archivo sigue registrado como cambiado: no se revirtió nada.
  const cambios = h.store.listFileChanges(runId).map((c) => c.path);
  assert.ok(cambios.includes(FUERA_DE_ALCANCE));
  h.close();
});

test('una decisión material devuelta por el agente detiene el flujo', async () => {
  const h = createHarness({ baselines: [cleanBaseline(), dirtyBaseline([EN_ALCANCE])] });
  const runId = await hastaTaskReady(h);
  h.claude.enqueue({
    result: {
      output: implementacionValida({
        materialQuestions: ['¿Qué rol puede ver la población atendida?'],
      }),
    },
  });

  const resultado = await h.orchestrator.implementar(runId, { confirmado: true });
  assert.equal(resultado.state, 'STOP_CONDITION');
  assert.equal(h.store.countPendingMaterialDecisions(runId), 1);
  h.close();
});

test('una dependencia nueva requiere autorización del Product Owner', async () => {
  const h = createHarness({ baselines: [cleanBaseline(), dirtyBaseline([EN_ALCANCE])] });
  const runId = await hastaTaskReady(h);
  h.claude.enqueue({ result: { output: implementacionValida({ newDependencies: ['better-sqlite3'] }) } });

  const resultado = await h.orchestrator.implementar(runId, { confirmado: true });
  assert.equal(resultado.state, 'STOP_CONDITION');
  assert.ok(
    h.store.listDecisions(runId).some((d) => d.question.includes('Dependencia nueva')),
  );
  h.close();
});

test('T-04/T-15: un error del agente conserva el working tree y los cambios parciales', async () => {
  const h = createHarness({ baselines: [cleanBaseline(), dirtyBaseline([EN_ALCANCE])] });
  const runId = await hastaTaskReady(h);
  h.claude.enqueue({
    result: { ok: false, errorClass: 'process_exit', transient: false, exitCode: 2, output: undefined },
  });

  const resultado = await h.orchestrator.implementar(runId, { confirmado: true });
  assert.equal(resultado.state, 'API_ERROR');
  assert.equal(h.orchestrator.view(runId).resumeState, 'IMPLEMENTANDO');

  const cambios = h.store.listFileChanges(runId).map((c) => c.path);
  assert.deepEqual(cambios, [EN_ALCANCE], 'los cambios parciales se conservan y se registran');
  assert.ok(h.store.listJournal(runId).some((e) => e.kind === 'cambios_parciales_preservados'));

  // API_ERROR es recuperable por decisión del Product Owner.
  const continuado = h.orchestrator.continuar(runId);
  assert.equal(continuado.state, 'IMPLEMENTANDO');
  h.close();
});

test('T-04: un error transitorio se reintenta hasta el tope y luego se detiene', async () => {
  const h = createHarness({ baselines: [cleanBaseline(), dirtyBaseline([EN_ALCANCE])] });
  const runId = await hastaTaskReady(h);
  for (let i = 0; i < 5; i += 1) {
    h.claude.enqueue({ result: { ok: false, errorClass: 'rate_limit', transient: true, exitCode: 1 } });
  }

  const resultado = await h.orchestrator.implementar(runId, { confirmado: true });
  assert.equal(
    h.claude.requests.length,
    LIMITS.maxTransientRetriesPerInvocation + 1,
    'un intento inicial más dos reintentos',
  );
  assert.equal(resultado.state, 'BUDGET_LIMIT');
  assert.equal(h.store.getCounters(runId).claudeInvocations, 1, 'los reintentos no son invocaciones nuevas');
  h.close();
});

test('un error de autenticación nunca se reintenta', async () => {
  const h = createHarness({ baselines: [cleanBaseline(), cleanBaseline()] });
  const runId = await hastaTaskReady(h);
  h.claude.enqueue({ result: { ok: false, errorClass: 'auth', transient: false, exitCode: 1 } });

  const resultado = await h.orchestrator.implementar(runId, { confirmado: true });
  assert.equal(h.claude.requests.length, 1);
  assert.equal(resultado.state, 'PAUSED');
  h.close();
});

test('T-10: la repetición exacta del ciclo produce LOOP_DETECTED', async () => {
  const h = createHarness({
    baselines: [cleanBaseline(), cleanBaseline(), cleanBaseline(), cleanBaseline()],
  });
  const runId = await hastaTaskReady(h);

  h.claude.enqueue({ result: { output: mockOutput({ summary: 'sin cambios' }) } });
  await h.orchestrator.implementar(runId, { confirmado: true });

  h.codex.enqueue({ result: { output: mockOutput({ summary: 'faltan cosas', verdict: 'CHANGES_REQUIRED' }) } });
  await h.orchestrator.revisar(runId);
  assert.equal(h.orchestrator.view(runId).state, 'CHANGES_REQUIRED');

  h.claude.enqueue({ result: { output: mockOutput({ summary: 'sin cambios otra vez' }) } });
  const segundo = await h.orchestrator.implementar(runId, { confirmado: true });
  assert.equal(segundo.state, 'LOOP_DETECTED');
  h.close();
});

test('T-10: dos ciclos consecutivos sin progreso producen LOOP_DETECTED', async () => {
  const h = createHarness({ baselines: [cleanBaseline()] });
  const runId = await hastaTaskReady(h);

  const cicloSinProgreso = async (nombreTest: string) => {
    h.claude.enqueue({
      result: {
        output: mockOutput({
          summary: 'intento ' + nombreTest,
          tests: [{ name: nombreTest, command: null, result: 'fail' }],
        }),
      },
    });
    return h.orchestrator.implementar(runId, { confirmado: true });
  };

  const primero = await cicloSinProgreso('t1');
  assert.equal(primero.state, 'QA');
  assert.equal(h.store.getCounters(runId).cyclesWithoutProgress, 0, 'llegar a QA por primera vez sí avanza');

  h.codex.enqueue({ result: { output: mockOutput({ summary: 'faltan cosas', verdict: 'CHANGES_REQUIRED' }) } });
  await h.orchestrator.revisar(runId);

  const segundo = await cicloSinProgreso('t2');
  assert.equal(segundo.state, 'QA');
  assert.equal(h.store.getCounters(runId).cyclesWithoutProgress, 1);

  h.codex.enqueue({ result: { output: mockOutput({ summary: 'sigue igual', verdict: 'CHANGES_REQUIRED' }) } });
  await h.orchestrator.revisar(runId);

  const tercero = await cicloSinProgreso('t3');
  assert.equal(tercero.state, 'LOOP_DETECTED');
  h.close();
});

test('AC-08: alcanzado el tope de invocaciones Claude se produce BUDGET_LIMIT', async () => {
  const h = createHarness({ baselines: [cleanBaseline()] });
  const runId = await hastaTaskReady(h);
  h.store.bumpCounters(runId, { claudeInvocations: LIMITS.maxClaudeInvocationsPerTask });

  const resultado = await h.orchestrator.implementar(runId, { confirmado: true });
  assert.equal(resultado.state, 'BUDGET_LIMIT');
  assert.equal(resultado.reason, 'maximo_invocaciones_claude');
  assert.equal(h.claude.requests.length, 0);
  h.close();
});

test('AC-08: el tope de invocaciones AI totales también detiene', async () => {
  const h = createHarness({ baselines: [cleanBaseline()] });
  const runId = await hastaTaskReady(h);
  h.store.bumpCounters(runId, { aiInvocations: LIMITS.maxAiInvocationsBeforeProductOwner });

  const resultado = await h.orchestrator.implementar(runId, { confirmado: true });
  assert.equal(resultado.state, 'BUDGET_LIMIT');
  assert.equal(resultado.reason, 'maximo_invocaciones_ai');
  h.close();
});

test('AUDITORÍA §2: no se puede aprobar sin haber visto la propuesta', async () => {
  const h = createHarness();
  h.codex.enqueue({ result: { output: propuestaLista() } });
  const creado = h.orchestrator.crear('Necesito un tablero.', 'ASISTIDO');
  await h.orchestrator.prepararPropuesta(creado.runId, { confirmado: true });

  const sinVer = h.orchestrator.aprobarPropuesta(creado.runId);
  assert.equal(sinVer.ok, false);
  assert.equal(sinVer.reason, 'requiere_ver_antes_de_aprobar');
  assert.equal(h.orchestrator.view(creado.runId).state, 'ANALISIS');
  assert.ok(
    h.store.listJournal(creado.runId).some((e) => e.kind === 'aprobacion_rechazada'),
    'el rechazo queda registrado',
  );
  h.close();
});

test('AUDITORÍA §2: VER registra el hash exacto y habilita APROBAR', async () => {
  const h = createHarness();
  h.codex.enqueue({ result: { output: propuestaLista() } });
  const creado = h.orchestrator.crear('Necesito un tablero.', 'ASISTIDO');
  await h.orchestrator.prepararPropuesta(creado.runId, { confirmado: true });

  const visto = h.orchestrator.ver(creado.runId);
  const hash = visto.detail?.['hashVisto'] as string;
  assert.equal(typeof hash, 'string');
  assert.equal(hash, h.orchestrator.propuestaHash(creado.runId));
  assert.equal(h.store.hasViewedVersion(creado.runId, 'propuesta', hash), true);

  const aprobado = h.orchestrator.aprobarPropuesta(creado.runId, hash);
  assert.equal(aprobado.ok, true);
  assert.equal(aprobado.state, 'TASK_READY');

  // El journal deja hash, actor, estado y momento de la aprobación.
  const registro = h.store
    .listJournal(creado.runId)
    .find((e) => e.kind === 'aprobacion_registrada');
  assert.ok(registro !== undefined);
  assert.equal(registro?.actor, 'product_owner');
  assert.ok(registro?.payload.includes(hash));
  assert.ok(registro?.payload.includes('ANALISIS'));
  h.close();
});

test('AUDITORÍA §2: aprobar un hash distinto del actual se rechaza', async () => {
  const h = createHarness();
  h.codex.enqueue({ result: { output: propuestaLista() } });
  const creado = h.orchestrator.crear('Necesito un tablero.', 'ASISTIDO');
  await h.orchestrator.prepararPropuesta(creado.runId, { confirmado: true });
  h.orchestrator.ver(creado.runId);

  const resultado = h.orchestrator.aprobarPropuesta(creado.runId, 'hash-de-otra-version');
  assert.equal(resultado.ok, false);
  assert.equal(resultado.reason, 'aprobacion_stale');
  assert.equal(h.orchestrator.view(creado.runId).state, 'ANALISIS');
  h.close();
});

test('AUDITORÍA §2: si la propuesta cambia tras VER hay que volver a verla', async () => {
  const h = createHarness();
  h.codex.enqueue({ result: { output: propuestaLista() } });
  const creado = h.orchestrator.crear('Necesito un tablero.', 'ASISTIDO');
  await h.orchestrator.prepararPropuesta(creado.runId, { confirmado: true });

  const primero = h.orchestrator.ver(creado.runId).detail?.['hashVisto'] as string;

  // La propuesta se rehace: cambia el contenido y por lo tanto el hash.
  h.codex.enqueue({ result: { output: propuestaLista({ summary: 'Propuesta corregida y distinta.' }) } });
  await h.orchestrator.prepararPropuesta(creado.runId, { confirmado: true });
  const actual = h.orchestrator.propuestaHash(creado.runId);
  assert.notEqual(actual, primero, 'el hash debe cambiar con el contenido');

  const conHashViejo = h.orchestrator.aprobarPropuesta(creado.runId, primero);
  assert.equal(conHashViejo.ok, false);
  assert.equal(conHashViejo.reason, 'aprobacion_stale');

  const sinHash = h.orchestrator.aprobarPropuesta(creado.runId);
  assert.equal(sinHash.ok, false, 'tampoco basta con omitir el hash');
  // El hash es obligatorio y explícito: nunca se infiere del último visto.
  assert.equal(sinHash.reason, 'aprobacion_sin_hash');

  // Tras VER la versión nueva, la aprobación vuelve a ser posible.
  const nuevo = h.orchestrator.ver(creado.runId).detail?.['hashVisto'] as string;
  assert.equal(nuevo, actual);
  const aprobado = h.orchestrator.aprobarPropuesta(creado.runId, nuevo);
  assert.equal(aprobado.ok, true);
  assert.equal(aprobado.state, 'TASK_READY');
  h.close();
});

test('AUDITORÍA §6: la ventana de 6 invocaciones AI bloquea sin intervención', async () => {
  const h = createHarness({ baselines: [cleanBaseline()] });
  const runId = await hastaTaskReady(h);

  // La ventana llega al tope sin que el Product Owner intervenga.
  h.store.resetAiWindow(runId, 'preparacion_de_prueba');
  h.store.bumpCounters(runId, { aiInvocations: LIMITS.maxAiInvocationsBeforeProductOwner });

  const bloqueado = await h.orchestrator.implementar(runId, { confirmado: true });
  assert.equal(bloqueado.state, 'BUDGET_LIMIT');
  assert.equal(bloqueado.reason, 'maximo_invocaciones_ai');
  assert.equal(h.claude.requests.length, 0);
  h.close();
});

test('AUDITORÍA §6: una intervención del PO reinicia la ventana y conserva el total', async () => {
  // Tres capturas: el intento bloqueado consume la primera; el intento
  // válido usa la segunda como baseline previa y la tercera como posterior.
  const h = createHarness({ baselines: [cleanBaseline(), cleanBaseline(), dirtyBaseline([EN_ALCANCE])] });
  const runId = await hastaTaskReady(h);

  h.store.resetAiWindow(runId, 'preparacion_de_prueba');
  h.store.bumpCounters(runId, { aiInvocations: LIMITS.maxAiInvocationsBeforeProductOwner });
  const totalAntes = h.store.getCounters(runId).aiInvocations;

  assert.equal((await h.orchestrator.implementar(runId, { confirmado: true })).state, 'BUDGET_LIMIT');

  // Intervención explícita: el Product Owner decide continuar.
  h.orchestrator.decidirInterrupcion(runId, 'sigo adelante');
  const tras = h.store.getCounters(runId);
  assert.equal(tras.aiInvocationsWindow, 0, 'la ventana se reinicia');
  assert.equal(tras.aiInvocations, totalAntes, 'el total histórico no se borra');

  // Con la ventana limpia el trabajo puede continuar.
  h.orchestrator.responderDecision(
    runId,
    h.orchestrator.view(runId).pendingDecisions[0]?.id ?? '',
    'continúa',
  );
  verYAprobar(h, runId);
  h.claude.enqueue({ result: { output: implementacionValida() } });
  const reanudado = await h.orchestrator.implementar(runId, { confirmado: true });
  assert.equal(reanudado.state, 'QA');
  assert.ok(
    h.store.getCounters(runId).aiInvocations > totalAntes,
    'el total histórico sigue creciendo',
  );
  h.close();
});

test('AUDITORÍA §6: un nuevo bloque de 6 vuelve a bloquear', async () => {
  const h = createHarness({ baselines: [cleanBaseline()] });
  const runId = await hastaTaskReady(h);

  h.store.resetAiWindow(runId, 'primera_ventana');
  h.store.bumpCounters(runId, { aiInvocations: LIMITS.maxAiInvocationsBeforeProductOwner });
  assert.equal((await h.orchestrator.implementar(runId, { confirmado: true })).state, 'BUDGET_LIMIT');

  h.orchestrator.decidirInterrupcion(runId, 'continuar');
  h.orchestrator.responderDecision(
    runId,
    h.orchestrator.view(runId).pendingDecisions[0]?.id ?? '',
    'ok',
  );
  verYAprobar(h, runId);

  const totalTrasPrimeraVentana = h.store.getCounters(runId).aiInvocations;

  // Segunda ventana: se vuelve a llenar sin intervención.
  h.store.bumpCounters(runId, { aiInvocations: LIMITS.maxAiInvocationsBeforeProductOwner });
  const otraVez = await h.orchestrator.implementar(runId, { confirmado: true });
  assert.equal(otraVez.state, 'BUDGET_LIMIT');
  assert.equal(otraVez.reason, 'maximo_invocaciones_ai');
  assert.equal(
    h.store.getCounters(runId).aiInvocations,
    totalTrasPrimeraVentana + LIMITS.maxAiInvocationsBeforeProductOwner,
    'el total histórico acumula ambas ventanas',
  );
  h.close();
});

test('AUDITORÍA §7: el backoff se espera de verdad antes de reintentar', async () => {
  const h = createHarness({ baselines: [cleanBaseline(), dirtyBaseline([EN_ALCANCE])] });
  const runId = await hastaTaskReady(h);

  h.claude.enqueue({ result: { ok: false, errorClass: 'rate_limit', transient: true, exitCode: 1 } });
  h.claude.enqueue({ result: { ok: false, errorClass: 'rate_limit', transient: true, exitCode: 1 } });
  h.claude.enqueue({ result: { output: implementacionValida() } });

  const resultado = await h.orchestrator.implementar(runId, { confirmado: true });

  assert.equal(resultado.state, 'QA');
  assert.equal(h.claude.requests.length, 3, 'un intento inicial más dos reintentos');
  // Una espera real por cada reintento, con backoff creciente.
  assert.deepEqual(h.sleeper.waits, [1_000, 2_000]);
  assert.ok(
    h.store.listJournal(runId).some((e) => e.kind === 'reintento' && e.result === 'esperando_backoff'),
    'el journal registra la espera',
  );
  h.close();
});

test('AUDITORÍA §7: no se reintenta antes de cumplir la espera', async () => {
  const orden: string[] = [];
  const h = createHarness({
    baselines: [cleanBaseline(), dirtyBaseline([EN_ALCANCE])],
    onSleep: (ms) => orden.push('espera:' + String(ms)),
  });
  const runId = await hastaTaskReady(h);

  h.claude.enqueue({ result: { ok: false, errorClass: 'network', transient: true, exitCode: 1 } });
  h.claude.enqueue({ result: { output: implementacionValida() } });

  await h.orchestrator.implementar(runId, { confirmado: true });

  // El segundo intento ocurre después de la espera, nunca antes.
  assert.equal(h.claude.requests.length, 2);
  assert.deepEqual(orden, ['espera:1000']);
  h.close();
});

test('AUDITORÍA §7: DETENER durante el backoff cancela el reintento', async () => {
  let runId = '';
  const h = createHarness({
    baselines: [cleanBaseline(), dirtyBaseline([EN_ALCANCE])],
    // El Product Owner pulsa DETENER mientras se espera el backoff.
    onSleep: () => {
      h.orchestrator.detener(runId);
    },
  });
  runId = await hastaTaskReady(h);

  h.claude.enqueue({ result: { ok: false, errorClass: 'rate_limit', transient: true, exitCode: 1 } });
  h.claude.enqueue({ result: { output: implementacionValida() } });

  const resultado = await h.orchestrator.implementar(runId, { confirmado: true });

  assert.equal(h.claude.requests.length, 1, 'el reintento nunca se ejecuta');
  assert.equal(resultado.reason, 'detenido_durante_backoff');
  assert.equal(h.orchestrator.view(runId).state, 'PAUSED');
  assert.ok(h.store.listJournal(runId).some((e) => e.kind === 'reintento_cancelado'));
  assert.equal(h.claude.pending, 1, 'la respuesta programada queda sin consumir');
  h.close();
});

test('T-03: al reiniciar, un lease vencido deja la Task PAUSED y reconciliada', () => {
  let ahora = new Date('2026-08-21T10:00:00.000Z');
  const store = Store.open(':memory:', () => ahora);
  const run = store.createRun({ requestText: 'x', mode: 'ASISTIDO', state: 'IMPLEMENTANDO' });
  store.acquireLease(run.id, 'proceso-caido', 999, 1_000);
  store.bumpCounters(run.id, { claudeInvocations: 2, aiInvocations: 3 });

  ahora = new Date('2026-08-21T10:30:00.000Z');
  const orchestrator = new Orchestrator({
    store,
    codex: new MockAgentAdapter('codex'),
    claude: new MockAgentAdapter('claude'),
    workspace: new ScriptedWorkspaceProbe([cleanBaseline()]),
  });
  const reconciliados = orchestrator.reconcile();

  assert.equal(reconciliados.length, 1);
  const vista = orchestrator.view(run.id);
  assert.equal(vista.state, 'PAUSED');
  assert.equal(vista.resumeState, 'IMPLEMENTANDO');
  assert.equal(vista.interruptReason, 'lease_vencido_tras_reinicio');
  assert.deepEqual(store.getCounters(run.id), {
    claudeInvocations: 2,
    aiInvocations: 3,
    aiInvocationsWindow: 3,
    cyclesWithoutProgress: 0,
    transientRetries: 0,
  });
  store.close();
});

test('DETENER pausa y conserva el estado previo para continuar', async () => {
  const h = createHarness({ baselines: [cleanBaseline()] });
  const runId = await hastaTaskReady(h);

  const detenido = h.orchestrator.detener(runId);
  assert.equal(detenido.state, 'PAUSED');
  assert.equal(h.orchestrator.view(runId).resumeState, 'TASK_READY');

  const continuado = h.orchestrator.continuar(runId);
  assert.equal(continuado.state, 'TASK_READY');
  h.close();
});

test('AC-11: APROBAR llega como máximo a READY_FOR_COMMIT y nunca hace commit', async () => {
  const h = createHarness({ baselines: [cleanBaseline(), dirtyBaseline([EN_ALCANCE])] });
  const runId = await hastaTaskReady(h);
  h.claude.enqueue({ result: { output: implementacionValida() } });
  await h.orchestrator.implementar(runId, { confirmado: true });
  h.codex.enqueue({ result: { output: mockOutput({ summary: 'todo bien', verdict: 'PASS' }) } });
  await h.orchestrator.revisar(runId);
  assert.equal(h.orchestrator.view(runId).state, 'ESPERANDO_APROBACION_VISUAL');

  // Sin VER no se puede aprobar el resultado.
  const sinVer = h.orchestrator.aprobarResultado(runId);
  assert.equal(sinVer.ok, false);
  assert.equal(sinVer.reason, 'requiere_ver_antes_de_aprobar');

  const aprobado = verYAprobar(h, runId);
  assert.equal(aprobado.state, 'READY_FOR_COMMIT');

  const commit = h.orchestrator.autorizarCommit(runId);
  assert.equal(commit.ok, false);
  assert.equal(commit.reason, 'v1_no_ejecuta_commit_ni_push');
  assert.equal(h.orchestrator.view(runId).state, 'READY_FOR_COMMIT', 'el estado no cambia');
  assert.ok(h.store.listJournal(runId).some((e) => e.kind === 'commit_bloqueado'));
  h.close();
});

test('la revisión con hallazgos materiales escala en lugar de corregir sola', async () => {
  const h = createHarness({ baselines: [cleanBaseline(), dirtyBaseline([EN_ALCANCE])] });
  const runId = await hastaTaskReady(h);
  h.claude.enqueue({ result: { output: implementacionValida() } });
  await h.orchestrator.implementar(runId, { confirmado: true });

  h.codex.enqueue({
    result: {
      output: mockOutput({
        summary: 'hay una decisión de permisos',
        verdict: 'CHANGES_REQUIRED',
        findings: [
          { code: 'F1', severity: 'alta', material: true, inScope: true, summary: 'permiso no definido' },
        ],
      }),
    },
  });
  const revision = await h.orchestrator.revisar(runId);
  assert.equal(revision.state, 'STOP_CONDITION');
  assert.equal(h.store.countPendingMaterialDecisions(runId), 1);
  h.close();
});

test('RECHAZADO y CANCELADO son terminales y conservan el journal', async () => {
  const h = createHarness({ baselines: [cleanBaseline(), dirtyBaseline([EN_ALCANCE])] });
  const runId = await hastaTaskReady(h);
  h.claude.enqueue({ result: { output: implementacionValida() } });
  await h.orchestrator.implementar(runId, { confirmado: true });
  h.codex.enqueue({ result: { output: mockOutput({ summary: 'ok', verdict: 'PASS' }) } });
  await h.orchestrator.revisar(runId);

  const eventosAntes = h.store.listJournal(runId).length;
  const rechazado = h.orchestrator.rechazar(runId, 'no es lo que pedí');
  assert.equal(rechazado.state, 'RECHAZADO');
  assert.ok(h.store.listJournal(runId).length > eventosAntes);
  assert.equal(h.orchestrator.view(runId).actions.every((a) => a.kind !== 'principal'), true);

  const otro = createHarness();
  const creado = otro.orchestrator.crear('otra necesidad', 'ASISTIDO');
  assert.equal(otro.orchestrator.cancelar(creado.runId).state, 'CANCELADO');
  assert.ok(otro.store.listJournal(creado.runId).length > 0);
  otro.close();
  h.close();
});

test('AC-05: dos motores no pueden mutar la misma Task a la vez', async () => {
  const store = Store.open(':memory:');
  const probe = new ScriptedWorkspaceProbe([cleanBaseline(), dirtyBaseline([EN_ALCANCE])]);
  const uno = createHarness({ store, holder: 'proceso-uno' });
  const runId = await hastaTaskReady(uno);

  // Un segundo proceso toma el lease antes de que el primero lo pida.
  store.acquireLease(runId, 'proceso-dos', 2);

  const otro = new Orchestrator({
    store,
    codex: new MockAgentAdapter('codex'),
    claude: new MockAgentAdapter('claude'),
    workspace: probe,
    holder: 'proceso-uno',
  });
  const intento = await otro.implementar(runId, { confirmado: true });
  assert.equal(intento.ok, false);
  assert.equal(intento.reason, 'lease_ocupado');
  store.close();
});

test('AC-10: la vista del panel no expone secretos ni el entorno', async () => {
  const h = createHarness({ baselines: [cleanBaseline(), dirtyBaseline([EN_ALCANCE])] });
  const runId = await hastaTaskReady(h);
  h.claude.enqueue({
    result: {
      output: implementacionValida({
        summary: 'listo, usé authorization: Bearer ejemploficticio1234567890',
      }),
    },
  });
  await h.orchestrator.implementar(runId, { confirmado: true });

  const serializado = JSON.stringify(h.orchestrator.view(runId));
  assert.equal(serializado.includes('ejemploficticio1234567890'), false);
  assert.equal(serializado.includes('ANTHROPIC_API_KEY'), false);
  h.close();
});
