/**
 * Adapter de Codex CLI (FR-04, doc §5.1).
 *
 * Ejecuta `codex exec` en modo no interactivo, con `cwd` fijo al
 * repositorio, salida estructurada, timeout y cancelación. Conserva el ID
 * exacto de hilo/sesión por Task y nunca selecciona "la última" sesión.
 *
 * Sintaxis verificada contra el CLI real instalado (`codex-cli
 * 0.149.0-alpha.4`), consultando únicamente `--version` y `--help`:
 *
 *   codex exec [OPTIONS] [PROMPT]           -> admite `--json` y `-C/--cd <DIR>`
 *   codex exec resume [OPTIONS] [SESSION_ID] [PROMPT]
 *                                           -> admite `--json`; NO admite `--cd`
 *
 * Por eso la reanudación no pasa `--cd`: el directorio de trabajo se fija
 * en el proceso hijo. La salida JSONL usa eventos `thread.started`,
 * `item.completed`, `turn.completed` y `turn.failed`, con el identificador
 * de hilo en `thread_id`.
 */

import { LIMITS, REPO_ROOT } from '../config.ts';
import { classifyError, isTransient } from '../domain/errors.ts';
import { redactAndTruncate } from '../domain/redaction.ts';
import type { ProcessRunner } from './process.ts';
import { spawnRunner } from './process.ts';
import { parseAgentOutput } from './contract.ts';
import type { AgentAdapter, AgentInvocationResult, AgentRequest, PreflightResult } from './types.ts';

/** Binario y flags fijos. No se construyen comandos a partir de salidas de modelo. */
export const CODEX_BINARY = 'codex';

export interface CodexStreamParse {
  /** Identificador de hilo/sesión emitido por el CLI. Nunca se inventa. */
  readonly threadId: string | null;
  /** Texto de los mensajes del agente, ya desanidado de la envoltura JSONL. */
  readonly text: string;
  /** ¿La salida era realmente JSONL interpretable? */
  readonly jsonl: boolean;
  /** El CLI informó un turno fallido. */
  readonly failed: boolean;
  readonly failureMessage: string | null;
  /** Consumo informado por el CLI, si lo hubo. Ausente = DESCONOCIDO. */
  readonly usageDetail: string | null;
}

const AGENT_ITEM_TYPES = ['agent_message', 'assistant_message'];

function readString(source: Record<string, unknown>, keys: readonly string[]): string | null {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
  }
  return null;
}

/** Texto de un item: admite `text`, `message` o `content` (string o partes). */
function itemText(item: Record<string, unknown>): string | null {
  const direct = readString(item, ['text', 'message']);
  if (direct !== null) {
    return direct;
  }
  const content = item['content'];
  if (typeof content === 'string') {
    return content;
  }
  if (Array.isArray(content)) {
    const parts = content
      .map((part) =>
        typeof part === 'object' && part !== null ? readString(part as Record<string, unknown>, ['text']) : null,
      )
      .filter((part): part is string => part !== null);
    return parts.length > 0 ? parts.join('') : null;
  }
  return null;
}

/**
 * Interpreta la salida de `codex exec --json`.
 *
 * Reconoce el esquema actual de hilos (`thread.started` / `item.completed`)
 * y el esquema heredado (`msg.type`). Si la salida no es JSONL, se devuelve
 * el texto tal cual y `jsonl = false` para que el llamador falle cerrado.
 */
export function parseCodexStream(stdout: string): CodexStreamParse {
  const lines = stdout.split(/\r?\n/).filter((line) => line.trim().length > 0);

  let threadId: string | null = null;
  let failed = false;
  let failureMessage: string | null = null;
  let usageDetail: string | null = null;
  let sawJson = false;
  const agentTexts: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('{')) {
      continue;
    }

    let event: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (typeof parsed !== 'object' || parsed === null) {
        continue;
      }
      event = parsed as Record<string, unknown>;
    } catch {
      continue;
    }
    sawJson = true;

    // Identificador de hilo: `thread_id` es el nombre del CLI actual;
    // `session_id`/`conversation_id` cubren el esquema heredado.
    if (threadId === null) {
      threadId = readString(event, ['thread_id', 'threadId', 'session_id', 'conversation_id']);
    }
    const thread = event['thread'];
    if (threadId === null && typeof thread === 'object' && thread !== null) {
      threadId = readString(thread as Record<string, unknown>, ['id', 'thread_id']);
    }

    const type = typeof event['type'] === 'string' ? (event['type'] as string) : null;

    if (type === 'item.completed' || type === 'item.updated') {
      const item = event['item'];
      if (typeof item === 'object' && item !== null) {
        const record = item as Record<string, unknown>;
        const itemType = readString(record, ['item_type', 'type']);
        if (itemType !== null && AGENT_ITEM_TYPES.includes(itemType)) {
          const text = itemText(record);
          if (text !== null) {
            agentTexts.push(text);
          }
        }
      }
      continue;
    }

    if (type === 'turn.completed') {
      const usage = event['usage'];
      if (usage !== undefined && usage !== null) {
        usageDetail = JSON.stringify({ usage });
      }
      continue;
    }

    if (type === 'turn.failed' || type === 'thread.error' || type === 'error') {
      failed = true;
      const error = event['error'];
      failureMessage =
        (typeof error === 'object' && error !== null
          ? readString(error as Record<string, unknown>, ['message', 'detail'])
          : null) ?? readString(event, ['message', 'error']);
      continue;
    }

    // Esquema heredado: `{ "msg": { "type": "agent_message", "message": ... } }`.
    const msg = event['msg'];
    if (typeof msg === 'object' && msg !== null) {
      const record = msg as Record<string, unknown>;
      if (threadId === null) {
        threadId = readString(record, ['thread_id', 'session_id']);
      }
      const msgType = readString(record, ['type']);
      if (msgType === null || AGENT_ITEM_TYPES.includes(msgType) || msgType === 'task_complete') {
        const text = readString(record, ['message', 'text', 'last_agent_message']);
        if (text !== null) {
          agentTexts.push(text);
        }
      }
    }
  }

  return {
    threadId,
    // Si no hubo JSONL se devuelve la salida cruda para diagnóstico.
    text: sawJson ? agentTexts.join('\n') : stdout,
    jsonl: sawJson,
    failed,
    failureMessage,
    usageDetail,
  };
}

export class CodexAdapter implements AgentAdapter {
  readonly name = 'codex' as const;
  private readonly runner: ProcessRunner;
  private readonly cwd: string;

  constructor(runner: ProcessRunner = spawnRunner, cwd: string = REPO_ROOT) {
    this.runner = runner;
    this.cwd = cwd;
  }

  /** Preflight: binario y versión. No lee ni copia archivos de autenticación. */
  async preflight(): Promise<PreflightResult> {
    const result = await this.runner({
      command: CODEX_BINARY,
      args: ['--version'],
      cwd: this.cwd,
      timeoutMs: 20_000,
    });

    if (result.spawnError !== null || result.exitCode !== 0) {
      return {
        ok: false,
        binary: CODEX_BINARY,
        version: null,
        authenticated: 'unknown',
        errorClass: classifyError({
          spawnError: result.spawnError,
          exitCode: result.exitCode,
          stderr: result.stderr,
        }),
        reason: 'codex_cli_no_disponible',
        message: 'Codex CLI no está disponible en este equipo.',
      };
    }

    return {
      ok: true,
      binary: CODEX_BINARY,
      version: result.stdout.trim().split(/\r?\n/)[0] ?? null,
      authenticated: 'unknown',
      errorClass: null,
    };
  }

  /**
   * Argumentos exactos del CLI real.
   *
   * - creación: `codex exec --json --cd <repo> <prompt>`
   * - reanudación: `codex exec resume --json <thread_id> <prompt>`
   *   (`resume` no acepta `--cd`; el directorio va en el proceso hijo).
   */
  buildArgs(request: AgentRequest): readonly string[] {
    if (request.sessionId !== null && request.sessionId.length > 0) {
      return ['exec', 'resume', '--json', request.sessionId, request.context];
    }
    return ['exec', '--json', '--cd', this.cwd, request.context];
  }

  async run(request: AgentRequest): Promise<AgentInvocationResult> {
    const args = this.buildArgs(request);
    const result = await this.runner({
      command: CODEX_BINARY,
      args,
      cwd: this.cwd,
      timeoutMs: request.timeoutMs || LIMITS.defaultInvocationTimeoutMs,
      signal: request.signal,
    });

    const command = CODEX_BINARY + ' ' + args.slice(0, 3).join(' ');
    const stream = parseCodexStream(result.stdout);

    // Si se reanudó, el identificador usado sigue siendo válido aunque el
    // CLI no lo repita. Nunca se inventa uno nuevo.
    const sessionId = stream.threadId ?? request.sessionId;

    const failedProcess =
      result.spawnError !== null || result.timedOut || result.cancelled || result.exitCode !== 0;

    if (failedProcess || stream.failed) {
      const errorClass = classifyError({
        spawnError: result.spawnError,
        timedOut: result.timedOut,
        cancelled: result.cancelled,
        exitCode: result.exitCode,
        stderr: stream.failureMessage ?? result.stderr,
      });
      return {
        ok: false,
        agent: this.name,
        phase: request.phase,
        sessionId,
        command,
        exitCode: result.exitCode,
        errorClass,
        transient: isTransient(errorClass),
        output: null,
        rawSummary: redactAndTruncate(stream.failureMessage ?? result.stderr ?? '', 2_000),
        durationMs: result.durationMs,
      };
    }

    // Falla cerrado: sin JSONL no hay salida estructurada que interpretar.
    if (!stream.jsonl) {
      return {
        ok: false,
        agent: this.name,
        phase: request.phase,
        sessionId,
        command,
        exitCode: result.exitCode,
        errorClass: 'schema_invalid',
        transient: false,
        output: null,
        rawSummary: 'salida_no_jsonl',
        durationMs: result.durationMs,
      };
    }

    const parsed = parseAgentOutput(stream.text);
    if (!parsed.ok || parsed.output === null) {
      return {
        ok: false,
        agent: this.name,
        phase: request.phase,
        sessionId,
        command,
        exitCode: result.exitCode,
        errorClass: 'schema_invalid',
        transient: false,
        output: null,
        rawSummary: redactAndTruncate(parsed.reason ?? 'contrato_invalido', 2_000),
        durationMs: result.durationMs,
      };
    }

    const output =
      stream.usageDetail === null
        ? parsed.output
        : { ...parsed.output, usage: { reported: true, detail: stream.usageDetail } };

    return {
      ok: true,
      agent: this.name,
      phase: request.phase,
      sessionId,
      command,
      exitCode: result.exitCode,
      errorClass: null,
      transient: false,
      output,
      rawSummary: redactAndTruncate(output.summary, 2_000),
      durationMs: result.durationMs,
    };
  }
}
