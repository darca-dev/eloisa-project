/**
 * AC-13 / T-14 / T-20 / T-04 — contract tests de los adapters con procesos
 * falsos, preflight negativo, timeout, cancelación y clasificación de error.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { CodexAdapter, parseCodexStream } from '../../tools/merdn-orchestrator/src/adapters/codex.ts';
import {
  CLAUDE_UNAVAILABLE_MESSAGE,
  ClaudeAdapter,
  assertSafeToolAllowlist,
  isVerificationCommandAllowed,
  parseClaudeJson,
} from '../../tools/merdn-orchestrator/src/adapters/claude.ts';
import { createFakeRunner } from '../../tools/merdn-orchestrator/src/adapters/process.ts';
import type { ProcessRequest, ProcessResult } from '../../tools/merdn-orchestrator/src/adapters/process.ts';
import { buildContractBlock, parseAgentOutput } from '../../tools/merdn-orchestrator/src/adapters/contract.ts';
import { contractStdout, missingBinaryRunner } from '../../tools/merdn-orchestrator/src/adapters/mocks.ts';
import {
  OPENAI_PRODUCT_ASSISTANT_ENABLED,
  OpenAIProductAssistantAdapter,
} from '../../tools/merdn-orchestrator/src/adapters/openai-product-assistant.ts';
import { classifyError, decideRetry, isTransient } from '../../tools/merdn-orchestrator/src/domain/errors.ts';
import {
  CLAUDE_ALLOWED_TOOLS,
  FORBIDDEN_AGENT_FLAGS,
  REPO_ROOT,
  VERIFICATION_COMMANDS,
} from '../../tools/merdn-orchestrator/src/config.ts';
import { OrchestratorError } from '../../tools/merdn-orchestrator/src/domain/errors.ts';
import type { AgentRequest } from '../../tools/merdn-orchestrator/src/adapters/types.ts';

const solicitud: AgentRequest = {
  runId: 'run_prueba',
  phase: 'implementacion',
  context: 'contexto ficticio',
  taskHash: 'hash',
  sessionId: null,
  timeoutMs: 1_000,
  maxTurns: 4,
  allowedPaths: ['tools/merdn-orchestrator/'],
};

const contratoValido = {
  resumen: 'Trabajo hecho',
  archivos: [{ ruta: 'tools/merdn-orchestrator/src/x.ts', tipo: 'creado' }],
  pruebas: [{ nombre: 'unit', comando: 'npm test', resultado: 'pass' }],
  hallazgos: [],
  preguntas_materiales: [],
  dependencias_nuevas: [],
  stop_conditions: [],
  veredicto: 'PASS',
  ready_for_claude: true,
};

test('el contrato estructurado se valida; el texto libre no se interpreta', () => {
  const ok = parseAgentOutput('bla bla\n' + buildContractBlock(contratoValido));
  assert.equal(ok.ok, true);
  assert.equal(ok.output?.files[0]?.path, 'tools/merdn-orchestrator/src/x.ts');
  assert.equal(ok.output?.verdict, 'PASS');

  assert.equal(parseAgentOutput('respuesta en prosa sin contrato').reason, 'contrato_ausente');
  assert.equal(
    parseAgentOutput('<MERDN_ORCHESTRATOR_RESULT>{no json}</MERDN_ORCHESTRATOR_RESULT>').reason,
    'contrato_json_invalido',
  );
  assert.equal(
    parseAgentOutput('<MERDN_ORCHESTRATOR_RESULT>{"archivos":[]}</MERDN_ORCHESTRATOR_RESULT>').reason,
    'contrato_sin_resumen',
  );
});

test('los hallazgos sin declaración explícita se tratan como materiales y fuera de alcance', () => {
  const parsed = parseAgentOutput(
    buildContractBlock({ resumen: 'x', hallazgos: [{ codigo: 'F1', resumen: 'algo' }] }),
  );
  assert.equal(parsed.output?.findings[0]?.material, true);
  assert.equal(parsed.output?.findings[0]?.inScope, false);
});

test('el contrato redacta secretos incluidos por el agente', () => {
  const parsed = parseAgentOutput(
    buildContractBlock({ resumen: 'usé ANTHROPIC_API_KEY=sk-ant-ejemploficticio1234567890' }),
  );
  assert.ok(parsed.output?.summary.includes('[REDACTADO]'));
});

test('T-14/T-20: sin Claude CLI el preflight falla y no hay invocación', async () => {
  const runner = missingBinaryRunner('claude');
  const adapter = new ClaudeAdapter(runner, REPO_ROOT);
  const preflight = await adapter.preflight();

  assert.equal(preflight.ok, false);
  assert.equal(preflight.errorClass, 'preflight');
  assert.equal(preflight.message, CLAUDE_UNAVAILABLE_MESSAGE);
  assert.equal(preflight.version, null);
  // Sólo se ejecutó `claude --version`; ninguna invocación de trabajo.
  assert.deepEqual(runner.calls.map((c) => c.args[0]), ['--version']);
});

test('el preflight de Claude distingue falta de autenticación', async () => {
  const runner = createFakeRunner(
    (): Partial<ProcessResult> => ({ exitCode: 1, stderr: 'Invalid API key · Please run /login' }),
  );
  const preflight = await new ClaudeAdapter(runner, REPO_ROOT).preflight();
  assert.equal(preflight.ok, false);
  assert.equal(preflight.errorClass, 'auth');
  assert.equal(preflight.authenticated, false);
});

test('la invocación de Claude es no interactiva, con JSON, turnos y herramientas permitidas', async () => {
  const runner = createFakeRunner((request: ProcessRequest): Partial<ProcessResult> => {
    if (request.args[0] === '--version') {
      return { exitCode: 0, stdout: '1.0.0 (Claude Code)' };
    }
    return {
      exitCode: 0,
      stdout: JSON.stringify({
        type: 'result',
        session_id: 'sesion-123',
        result: contractStdout(contratoValido),
        total_cost_usd: 0,
      }),
    };
  });

  const adapter = new ClaudeAdapter(runner, REPO_ROOT);
  const args = adapter.buildArgs(solicitud);
  assert.ok(args.includes('-p'));
  assert.ok(args.includes('--output-format') && args.includes('json'));
  assert.ok(args.includes('--max-turns'));
  assert.equal(args[args.indexOf('--allowedTools') + 1], CLAUDE_ALLOWED_TOOLS.join(','));
  for (const flag of FORBIDDEN_AGENT_FLAGS) {
    assert.equal(args.includes(flag), false, 'jamás debe usarse ' + flag);
  }

  const resultado = await adapter.run(solicitud);
  assert.equal(resultado.ok, true);
  assert.equal(resultado.sessionId, 'sesion-123');
  assert.equal(resultado.output?.files.length, 1);
  assert.equal(resultado.output?.usage.reported, true);
  assert.equal(runner.calls[0]?.cwd, REPO_ROOT, 'el cwd siempre es el repositorio');
});

test('una sesión existente se reanuda por identificador exacto', () => {
  const adapter = new ClaudeAdapter(createFakeRunner(() => ({ exitCode: 0 })), REPO_ROOT);
  const args = adapter.buildArgs({ ...solicitud, sessionId: 'sesion-abc' });
  assert.equal(args[args.indexOf('--resume') + 1], 'sesion-abc');
});

test('una salida que no cumple el contrato se clasifica como schema_invalid', async () => {
  const runner = createFakeRunner(
    (): Partial<ProcessResult> => ({
      exitCode: 0,
      stdout: JSON.stringify({ session_id: 's', result: 'texto sin contrato' }),
    }),
  );
  const resultado = await new ClaudeAdapter(runner, REPO_ROOT).run(solicitud);
  assert.equal(resultado.ok, false);
  assert.equal(resultado.errorClass, 'schema_invalid');
  assert.equal(resultado.transient, false, 'schema inválido nunca se reintenta');
});

test('timeout y cancelación se clasifican correctamente', async () => {
  const timeout = await new ClaudeAdapter(
    createFakeRunner((r): Partial<ProcessResult> => (r.args[0] === '--version' ? { exitCode: 0 } : { exitCode: null, timedOut: true })),
    REPO_ROOT,
  ).run(solicitud);
  assert.equal(timeout.errorClass, 'timeout');
  assert.equal(timeout.transient, true);

  const cancelado = await new ClaudeAdapter(
    createFakeRunner((): Partial<ProcessResult> => ({ exitCode: null, cancelled: true })),
    REPO_ROOT,
  ).run(solicitud);
  assert.equal(cancelado.errorClass, 'cancelled');
  assert.equal(cancelado.transient, false);
});

test('T-04: sólo se reintentan errores transitorios y con tope', () => {
  assert.equal(classifyError({ stderr: 'Error 429 rate limit exceeded' }), 'rate_limit');
  assert.equal(classifyError({ stderr: 'ECONNRESET' }), 'network');
  assert.equal(classifyError({ stderr: 'unauthorized' }), 'auth');
  assert.equal(classifyError({ stderr: 'credit balance is too low' }), 'quota');
  assert.equal(classifyError({ schemaValid: false }), 'schema_invalid');
  assert.equal(classifyError({ spawnError: 'spawn claude ENOENT' }), 'preflight');

  assert.equal(isTransient('rate_limit'), true);
  assert.equal(isTransient('auth'), false);
  assert.equal(decideRetry('auth', 0, 2).retry, false);
  assert.equal(decideRetry('rate_limit', 0, 2).retry, true);
  assert.equal(decideRetry('rate_limit', 2, 2).retry, false);
});

/**
 * Fixture con el esquema JSONL real de `codex exec --json`
 * (`codex-cli 0.149.0-alpha.4`): `thread.started` con `thread_id`,
 * `item.completed` con el mensaje del agente y `turn.completed` con el uso.
 */
function codexJsonl(texto: string, threadId: string | null = 'thr_0199abc'): string {
  const eventos: Record<string, unknown>[] = [];
  if (threadId !== null) {
    eventos.push({ type: 'thread.started', thread_id: threadId });
  }
  eventos.push({ type: 'turn.started' });
  eventos.push({
    type: 'item.completed',
    item: { id: 'item_0', item_type: 'agent_message', text: texto },
  });
  eventos.push({ type: 'turn.completed', usage: { input_tokens: 120, output_tokens: 45, total_tokens: 165 } });
  return eventos.map((evento) => JSON.stringify(evento)).join('\n');
}

function codexRunner(stdout: string) {
  return createFakeRunner((request: ProcessRequest): Partial<ProcessResult> => {
    if (request.args[0] === '--version') {
      return { exitCode: 0, stdout: 'codex-cli 0.149.0-alpha.4' };
    }
    return { exitCode: 0, stdout };
  });
}

test('AUDITORÍA §4: el parser reconoce thread_id del esquema real', () => {
  const parsed = parseCodexStream(codexJsonl(contractStdout(contratoValido)));

  assert.equal(parsed.threadId, 'thr_0199abc');
  assert.equal(parsed.jsonl, true);
  assert.equal(parsed.failed, false);
  assert.ok(parsed.text.includes('MERDN_ORCHESTRATOR_RESULT'));
  assert.ok((parsed.usageDetail ?? '').includes('total_tokens'));
});

test('AUDITORÍA §4: también se acepta el esquema heredado con session_id', () => {
  const parsed = parseCodexStream(
    JSON.stringify({ session_id: 's1' }) +
      '\ntexto suelto de log\n' +
      JSON.stringify({ msg: { type: 'agent_message', message: 'hola' } }),
  );
  assert.equal(parsed.threadId, 's1');
  assert.equal(parsed.jsonl, true);
  assert.equal(parsed.text, 'hola', 'el ruido de log no se mezcla con el mensaje');
});

test('AUDITORÍA §4: creación usa `exec --json --cd`; la reanudación NO usa --cd', async () => {
  const adapter = new CodexAdapter(codexRunner(codexJsonl(contractStdout(contratoValido))), REPO_ROOT);

  const preflight = await adapter.preflight();
  assert.equal(preflight.ok, true);
  assert.match(preflight.version ?? '', /codex-cli/);

  const creacion = adapter.buildArgs(solicitud);
  assert.deepEqual(creacion.slice(0, 4), ['exec', '--json', '--cd', REPO_ROOT]);
  assert.equal(creacion[4], solicitud.context, 'el prompt es el último argumento posicional');

  // `codex exec resume` NO admite `--cd`: pasarlo rompe el CLI real.
  const reanudacion = adapter.buildArgs({ ...solicitud, sessionId: 'thr_0199abc' });
  assert.deepEqual(reanudacion, ['exec', 'resume', '--json', 'thr_0199abc', solicitud.context]);
  assert.equal(reanudacion.includes('--cd'), false, 'resume no acepta --cd');
  assert.equal(reanudacion.includes('--last'), false, 'nunca se reanuda "la última" sesión');
});

test('AUDITORÍA §4: el thread_id emitido se usa para reanudar', async () => {
  const runner = codexRunner(codexJsonl(contractStdout(contratoValido), 'thr_reanudable'));
  const adapter = new CodexAdapter(runner, REPO_ROOT);

  const primera = await adapter.run(solicitud);
  assert.equal(primera.ok, true);
  assert.equal(primera.sessionId, 'thr_reanudable');
  assert.equal(primera.output?.usage.reported, true, 'el uso informado por el CLI se conserva');

  await adapter.run({ ...solicitud, sessionId: primera.sessionId });
  const ultima = runner.calls.at(-1);
  assert.deepEqual(ultima?.args.slice(0, 4), ['exec', 'resume', '--json', 'thr_reanudable']);
  assert.equal(ultima?.cwd, REPO_ROOT, 'el directorio va en el proceso hijo, no en un flag');
});

test('AUDITORÍA §4: sin identificador no se inventa ninguno', async () => {
  const adapter = new CodexAdapter(
    codexRunner(codexJsonl(contractStdout(contratoValido), null)),
    REPO_ROOT,
  );
  const resultado = await adapter.run(solicitud);

  assert.equal(resultado.ok, true);
  assert.equal(resultado.sessionId, null, 'nunca se fabrica un session id');
});

test('AUDITORÍA §4: salida no interpretable falla cerrado como schema_invalid', async () => {
  const noJsonl = await new CodexAdapter(codexRunner('salida en prosa sin JSONL'), REPO_ROOT).run(solicitud);
  assert.equal(noJsonl.ok, false);
  assert.equal(noJsonl.errorClass, 'schema_invalid');
  assert.equal(noJsonl.transient, false);
  assert.equal(noJsonl.sessionId, null);

  const sinContrato = await new CodexAdapter(codexRunner(codexJsonl('trabajo sin contrato')), REPO_ROOT).run(
    solicitud,
  );
  assert.equal(sinContrato.ok, false);
  assert.equal(sinContrato.errorClass, 'schema_invalid');
});

test('AUDITORÍA §4: un turno fallido del CLI se convierte en error clasificado', async () => {
  const stdout =
    JSON.stringify({ type: 'thread.started', thread_id: 'thr_x' }) +
    '\n' +
    JSON.stringify({ type: 'turn.failed', error: { message: 'rate limit exceeded (429)' } });

  const resultado = await new CodexAdapter(codexRunner(stdout), REPO_ROOT).run(solicitud);
  assert.equal(resultado.ok, false);
  assert.equal(resultado.errorClass, 'rate_limit');
  assert.equal(resultado.transient, true);
  assert.equal(resultado.sessionId, 'thr_x');
});

test('la salida JSON de Claude se interpreta con tolerancia', () => {
  assert.equal(parseClaudeJson('no es json'), null);
  const parsed = parseClaudeJson(JSON.stringify({ session_id: 's', result: 'x', is_error: true }));
  assert.equal(parsed?.isError, true);
  assert.equal(parsed?.usageReported, false);
});

test('AUDITORÍA §5: Claude puede ejecutar las verificaciones exigidas por la Task', () => {
  const adapter = new ClaudeAdapter(createFakeRunner(() => ({ exitCode: 0 })), REPO_ROOT);
  const args = adapter.buildArgs(solicitud);
  const tools = (args[args.indexOf('--allowedTools') + 1] ?? '').split(',');

  for (const comando of ['npm run lint', 'npm run orchestrator:typecheck', 'npm run orchestrator:test', 'git diff --check']) {
    assert.ok(
      tools.includes('Bash(' + comando + ')'),
      'debe poder ejecutar la verificación: ' + comando,
    );
    assert.equal(isVerificationCommandAllowed(comando), true);
  }
  // Lectura y edición de archivos autorizados siguen concedidas.
  for (const tool of ['Read', 'Grep', 'Glob', 'Edit', 'Write']) {
    assert.ok(tools.includes(tool), 'falta la herramienta ' + tool);
  }
});

test('AUDITORÍA §5: Git destructivo, commit, push y despliegue siguen bloqueados', () => {
  const tools = CLAUDE_ALLOWED_TOOLS.join(',');
  for (const prohibido of ['git commit', 'git push', 'git reset', 'git clean', 'git stash', 'git checkout', 'deploy']) {
    assert.equal(tools.includes(prohibido), false, 'la allowlist no puede conceder: ' + prohibido);
  }
  // Ningún comodín de shell.
  assert.equal(CLAUDE_ALLOWED_TOOLS.includes('Bash'), false);
  assert.equal(CLAUDE_ALLOWED_TOOLS.includes('Bash(*)'), false);

  // Sólo los comandos declarados son verificaciones válidas.
  for (const comando of ['git commit -m x', 'git push origin main', 'rm -rf .', 'npm run build']) {
    assert.equal(isVerificationCommandAllowed(comando), false, comando + ' no puede ser una verificación');
  }
  assert.equal(VERIFICATION_COMMANDS.length > 0, true);
});

test('AUDITORÍA §5: una allowlist insegura hace fallar la construcción del comando', () => {
  for (const insegura of [['Bash'], ['Bash(*)'], ['Bash(git commit -m x)'], ['Bash(npm run deploy)']]) {
    assert.throws(
      () => assertSafeToolAllowlist(insegura),
      (error: unknown) =>
        error instanceof OrchestratorError &&
        (error.code === 'herramienta_sin_acotar' || error.code === 'herramienta_destructiva'),
      'debía rechazar: ' + insegura.join(','),
    );
  }
  assert.doesNotThrow(() => assertSafeToolAllowlist(CLAUDE_ALLOWED_TOOLS));
});

test('AD-17: el adapter de OpenAI queda deshabilitado y sin llamadas', async () => {
  assert.equal(OPENAI_PRODUCT_ASSISTANT_ENABLED, false);
  const adapter = new OpenAIProductAssistantAdapter();
  const preflight = await adapter.preflight();
  assert.equal(preflight.ok, false);
  await assert.rejects(adapter.run(solicitud), /adapter_deshabilitado|no está habilitada|deshabilitado/);
});
