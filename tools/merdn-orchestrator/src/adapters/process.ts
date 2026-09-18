/**
 * Ejecución segura de procesos hijos (doc §12, seguridad 3/4/5/9).
 *
 * Reglas: sin shell, ejecutable en allowlist, `cwd` fijo al repositorio,
 * entorno filtrado, timeout, cancelación del árbol de procesos y salida
 * limitada y redactada. Ninguna salida de modelo se convierte en comando.
 */

import { spawn } from 'node:child_process';
import path from 'node:path';

import { ALLOWED_COMMANDS, FORBIDDEN_AGENT_FLAGS, LIMITS, REPO_ROOT } from '../config.ts';
import { OrchestratorError } from '../domain/errors.ts';
import { filterEnv, redactAndTruncate } from '../domain/redaction.ts';

export interface ProcessRequest {
  readonly command: string;
  readonly args: readonly string[];
  readonly cwd?: string;
  readonly timeoutMs?: number;
  readonly input?: string;
  readonly signal?: AbortSignal;
}

export interface ProcessResult {
  readonly command: string;
  readonly args: readonly string[];
  readonly exitCode: number | null;
  readonly signal: string | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly timedOut: boolean;
  readonly cancelled: boolean;
  readonly spawnError: string | null;
  readonly durationMs: number;
}

export type ProcessRunner = (request: ProcessRequest) => Promise<ProcessResult>;

/** Nombre lógico del ejecutable, sin extensión de Windows. */
export function commandName(command: string): string {
  return path.basename(command).replace(/\.(exe|cmd|bat|ps1)$/i, '').toLowerCase();
}

/**
 * Validación previa obligatoria. Falla cerrado.
 * Se aplica también a los runners falsos usados en pruebas.
 */
export function assertAllowedCommand(request: ProcessRequest): void {
  const name = commandName(request.command);
  if (!ALLOWED_COMMANDS.includes(name)) {
    throw new OrchestratorError('comando_no_permitido', 'Comando fuera de la allowlist: ' + name);
  }
  for (const arg of request.args) {
    const normalized = arg.trim().toLowerCase();
    if (FORBIDDEN_AGENT_FLAGS.some((flag) => normalized === flag || normalized.startsWith(flag + '='))) {
      throw new OrchestratorError('flag_prohibido', 'Flag de bypass de permisos prohibido: ' + arg);
    }
  }
  const cwd = path.resolve(request.cwd ?? REPO_ROOT);
  const root = path.resolve(REPO_ROOT);
  const relative = path.relative(root, cwd);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new OrchestratorError('cwd_fuera_del_repositorio', 'El cwd debe estar dentro del repositorio.');
  }
}

function killTree(pid: number | undefined): void {
  if (pid === undefined) {
    return;
  }
  try {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore' });
    } else {
      process.kill(-pid, 'SIGTERM');
    }
  } catch {
    // El proceso ya terminó: no es un error operativo.
  }
}

/** Runner real basado en `child_process.spawn`, sin shell. */
export const spawnRunner: ProcessRunner = (request) => {
  assertAllowedCommand(request);

  const timeoutMs = request.timeoutMs ?? LIMITS.defaultInvocationTimeoutMs;
  const cwd = request.cwd ?? REPO_ROOT;
  const startedAt = Date.now();

  return new Promise<ProcessResult>((resolve) => {
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let cancelled = false;
    let settled = false;

    const child = spawn(request.command, [...request.args], {
      cwd,
      env: filterEnv(process.env),
      shell: false,
      windowsHide: true,
      detached: process.platform !== 'win32',
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const finish = (result: Omit<ProcessResult, 'command' | 'args' | 'durationMs'>): void => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      request.signal?.removeEventListener('abort', onAbort);
      resolve({
        ...result,
        command: commandName(request.command),
        args: [...request.args],
        stdout: redactAndTruncate(result.stdout, LIMITS.maxCapturedOutputChars),
        stderr: redactAndTruncate(result.stderr, LIMITS.maxCapturedOutputChars),
        durationMs: Date.now() - startedAt,
      });
    };

    const timer = setTimeout(() => {
      timedOut = true;
      killTree(child.pid);
    }, timeoutMs);

    const onAbort = (): void => {
      cancelled = true;
      killTree(child.pid);
    };
    request.signal?.addEventListener('abort', onAbort, { once: true });

    child.stdout?.setEncoding('utf8');
    child.stderr?.setEncoding('utf8');
    child.stdout?.on('data', (chunk: string) => {
      if (stdout.length < LIMITS.maxCapturedOutputChars * 2) {
        stdout += chunk;
      }
    });
    child.stderr?.on('data', (chunk: string) => {
      if (stderr.length < LIMITS.maxCapturedOutputChars * 2) {
        stderr += chunk;
      }
    });

    child.on('error', (error: Error) => {
      finish({
        exitCode: null,
        signal: null,
        stdout,
        stderr,
        timedOut,
        cancelled,
        spawnError: error.message,
      });
    });

    child.on('close', (code, signal) => {
      finish({
        exitCode: code,
        signal: signal === null ? null : String(signal),
        stdout,
        stderr,
        timedOut,
        cancelled,
        spawnError: null,
      });
    });

    if (typeof request.input === 'string' && child.stdin !== null) {
      child.stdin.end(request.input);
    } else {
      child.stdin?.end();
    }
  });
};

/**
 * Runner falso para pruebas: aplica exactamente las mismas validaciones
 * que el real y devuelve respuestas programadas.
 */
export function createFakeRunner(
  handler: (request: ProcessRequest) => Partial<ProcessResult>,
): ProcessRunner & { readonly calls: ProcessRequest[] } {
  const calls: ProcessRequest[] = [];
  const runner = async (request: ProcessRequest): Promise<ProcessResult> => {
    assertAllowedCommand(request);
    calls.push(request);
    const partial = handler(request);
    return {
      command: commandName(request.command),
      args: [...request.args],
      exitCode: partial.exitCode ?? 0,
      signal: partial.signal ?? null,
      stdout: redactAndTruncate(partial.stdout ?? '', LIMITS.maxCapturedOutputChars),
      stderr: redactAndTruncate(partial.stderr ?? '', LIMITS.maxCapturedOutputChars),
      timedOut: partial.timedOut ?? false,
      cancelled: partial.cancelled ?? false,
      spawnError: partial.spawnError ?? null,
      durationMs: partial.durationMs ?? 0,
    };
  };
  return Object.assign(runner, { calls });
}
