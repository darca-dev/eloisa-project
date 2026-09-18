/**
 * Adapter de Claude Code CLI (FR-05, FR-20, doc §5.2, AD-12).
 *
 * Ejecución no interactiva, JSON estructurado, `cwd` fijo al repositorio,
 * timeout, cancelación segura, máximo de turnos y herramientas permitidas.
 *
 * Mínimo privilegio con capacidad real de verificar (corrección de
 * auditoría §5): además de leer y editar los archivos autorizados, la
 * allowlist concede la ejecución **acotada** de los comandos de lint,
 * typecheck, pruebas y comprobación de diff que la Task exige. Sin ellos el
 * implementador no podría satisfacer las pruebas requeridas.
 *
 * Prohibido: `--dangerously-skip-permissions` o cualquier flag equivalente,
 * `Bash` sin acotar, Git mutante, commit, push, despliegue, secretos,
 * `ANTHROPIC_API_KEY` y cualquier fallback a API paga. Si el CLI no existe,
 * el flujo pasa a `PAUSED`; nunca se sustituye por otra vía.
 */

import {
  CLAUDE_ALLOWED_TOOLS,
  FORBIDDEN_TOOL_EXACT,
  FORBIDDEN_TOOL_FRAGMENTS,
  LIMITS,
  REPO_ROOT,
  VERIFICATION_COMMANDS,
} from '../config.ts';
import { classifyError, isTransient } from '../domain/errors.ts';
import { OrchestratorError } from '../domain/errors.ts';
import { redactAndTruncate } from '../domain/redaction.ts';
import type { ProcessRunner } from './process.ts';
import { spawnRunner } from './process.ts';
import { parseAgentOutput } from './contract.ts';
import type { AgentAdapter, AgentInvocationResult, AgentRequest, PreflightResult } from './types.ts';

export const CLAUDE_BINARY = 'claude';

/** Mensaje exigido por la Task cuando el CLI no está habilitado. */
export const CLAUDE_UNAVAILABLE_MESSAGE = 'Claude Code necesita habilitarse para continuar.';

/**
 * Verifica la allowlist de herramientas antes de construir el comando.
 *
 * Falla cerrado: nunca puede concederse `Bash` sin acotar ni ninguna
 * herramienta que permita Git mutante, commit, push o despliegue.
 */
export function assertSafeToolAllowlist(tools: readonly string[]): void {
  for (const tool of tools) {
    const normalized = tool.trim();
    if (FORBIDDEN_TOOL_EXACT.some((forbidden) => normalized.toLowerCase() === forbidden.toLowerCase())) {
      throw new OrchestratorError(
        'herramienta_sin_acotar',
        'La allowlist no puede conceder ejecución sin acotar: ' + tool,
      );
    }
    const lower = normalized.toLowerCase();
    for (const fragment of FORBIDDEN_TOOL_FRAGMENTS) {
      if (lower.includes(fragment.toLowerCase())) {
        throw new OrchestratorError(
          'herramienta_destructiva',
          'La allowlist no puede conceder "' + fragment.trim() + '": ' + tool,
        );
      }
    }
  }
}

/**
 * ¿Es este un comando de verificación autorizado?
 * Sólo los declarados en la configuración aprobada, sin variaciones.
 */
export function isVerificationCommandAllowed(command: string): boolean {
  return VERIFICATION_COMMANDS.includes(command.trim());
}

export interface ClaudeJsonResult {
  readonly sessionId: string | null;
  readonly text: string;
  readonly isError: boolean;
  readonly usageReported: boolean;
  readonly usageDetail: string | null;
}

/** Interpreta `--output-format json`; tolera texto plano como schema inválido. */
export function parseClaudeJson(stdout: string): ClaudeJsonResult | null {
  const trimmed = stdout.trim();
  if (trimmed.length === 0) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) {
    return null;
  }
  const record = parsed as Record<string, unknown>;
  const sessionId = record['session_id'];
  const text = record['result'] ?? record['text'] ?? '';
  const usage = record['usage'];
  const cost = record['total_cost_usd'];
  const usageReported = usage !== undefined || cost !== undefined;

  return {
    sessionId: typeof sessionId === 'string' ? sessionId : null,
    text: typeof text === 'string' ? text : '',
    isError: record['is_error'] === true,
    usageReported,
    usageDetail: usageReported ? JSON.stringify({ usage: usage ?? null, total_cost_usd: cost ?? null }) : null,
  };
}

export class ClaudeAdapter implements AgentAdapter {
  readonly name = 'claude' as const;
  private readonly runner: ProcessRunner;
  private readonly cwd: string;

  constructor(runner: ProcessRunner = spawnRunner, cwd: string = REPO_ROOT) {
    this.runner = runner;
    this.cwd = cwd;
  }

  /**
   * Preflight obligatorio: `claude --version`.
   * Sin CLI no hay invocación posible y el flujo debe pasar a `PAUSED`.
   */
  async preflight(): Promise<PreflightResult> {
    const result = await this.runner({
      command: CLAUDE_BINARY,
      args: ['--version'],
      cwd: this.cwd,
      timeoutMs: 20_000,
    });

    if (result.spawnError !== null || result.exitCode !== 0) {
      const errorClass = classifyError({
        spawnError: result.spawnError,
        exitCode: result.exitCode,
        stderr: result.stderr,
      });
      return {
        ok: false,
        binary: CLAUDE_BINARY,
        version: null,
        authenticated: errorClass === 'auth' ? false : 'unknown',
        errorClass,
        reason: errorClass === 'auth' ? 'claude_cli_no_autenticado' : 'claude_cli_no_disponible',
        message: CLAUDE_UNAVAILABLE_MESSAGE,
      };
    }

    return {
      ok: true,
      binary: CLAUDE_BINARY,
      version: result.stdout.trim().split(/\r?\n/)[0] ?? null,
      // El CLI no expone estado de sesión aquí y no se leen sus credenciales.
      authenticated: 'unknown',
      errorClass: null,
    };
  }

  /**
   * Argumentos fijos y auditables. Las herramientas permitidas provienen de
   * la configuración aprobada; el prompt nunca se convierte en shell.
   */
  buildArgs(request: AgentRequest): readonly string[] {
    // La allowlist se valida en cada construcción, no sólo al configurarla.
    assertSafeToolAllowlist(CLAUDE_ALLOWED_TOOLS);

    const args: string[] = [
      '-p',
      request.context,
      '--output-format',
      'json',
      '--max-turns',
      String(request.maxTurns || LIMITS.defaultMaxTurns),
      '--allowedTools',
      CLAUDE_ALLOWED_TOOLS.join(','),
    ];
    if (request.sessionId !== null) {
      args.push('--resume', request.sessionId);
    }
    return args;
  }

  async run(request: AgentRequest): Promise<AgentInvocationResult> {
    const args = this.buildArgs(request);
    const result = await this.runner({
      command: CLAUDE_BINARY,
      args,
      cwd: this.cwd,
      timeoutMs: request.timeoutMs || LIMITS.defaultInvocationTimeoutMs,
      signal: request.signal,
    });

    const command = CLAUDE_BINARY + ' -p --output-format json --max-turns ' + String(request.maxTurns);
    const json = parseClaudeJson(result.stdout);
    const failedProcess =
      result.spawnError !== null || result.timedOut || result.cancelled || result.exitCode !== 0;

    if (failedProcess) {
      const errorClass = classifyError({
        spawnError: result.spawnError,
        timedOut: result.timedOut,
        cancelled: result.cancelled,
        exitCode: result.exitCode,
        stderr: result.stderr,
      });
      return {
        ok: false,
        agent: this.name,
        phase: request.phase,
        sessionId: json?.sessionId ?? request.sessionId,
        command,
        exitCode: result.exitCode,
        errorClass,
        transient: isTransient(errorClass),
        output: null,
        rawSummary: redactAndTruncate(result.stderr || result.stdout, 2_000),
        durationMs: result.durationMs,
      };
    }

    if (json === null) {
      return {
        ok: false,
        agent: this.name,
        phase: request.phase,
        sessionId: request.sessionId,
        command,
        exitCode: result.exitCode,
        errorClass: 'schema_invalid',
        transient: false,
        output: null,
        rawSummary: 'salida_no_json',
        durationMs: result.durationMs,
      };
    }

    const parsed = parseAgentOutput(json.text);
    if (!parsed.ok || parsed.output === null) {
      return {
        ok: false,
        agent: this.name,
        phase: request.phase,
        sessionId: json.sessionId,
        command,
        exitCode: result.exitCode,
        errorClass: 'schema_invalid',
        transient: false,
        output: null,
        rawSummary: parsed.reason ?? 'contrato_invalido',
        durationMs: result.durationMs,
      };
    }

    const output = json.usageReported
      ? { ...parsed.output, usage: { reported: true, detail: json.usageDetail } }
      : parsed.output;

    return {
      ok: !json.isError,
      agent: this.name,
      phase: request.phase,
      sessionId: json.sessionId,
      command,
      exitCode: result.exitCode,
      errorClass: json.isError ? 'process_exit' : null,
      transient: false,
      output,
      rawSummary: redactAndTruncate(output.summary, 2_000),
      durationMs: result.durationMs,
    };
  }
}
