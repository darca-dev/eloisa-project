/**
 * Acceso Git estrictamente de solo lectura (doc §12, AD-06, AD-10, T-18).
 *
 * El Orchestrator jamás ejecuta reset, clean, stash, rebase, checkout
 * destructivo, commit, merge ni push. Esas operaciones ni siquiera se
 * construyen: el guard las rechaza antes de llegar al proceso.
 */

import { ALLOWED_GIT_SUBCOMMANDS, FORBIDDEN_GIT_SUBCOMMANDS, REPO_ROOT } from '../config.ts';
import { OrchestratorError } from '../domain/errors.ts';
import type { ProcessRunner } from '../adapters/process.ts';
import { toPosix } from './paths.ts';

/**
 * El subcomando debe ser el primer argumento.
 *
 * No se aceptan opciones globales antes del subcomando (`-c`, `-C`,
 * `--git-dir`, ...): admiten valores y podrían usarse para desplazar el
 * subcomando real o cambiar el repositorio de trabajo.
 */
export function gitSubcommand(args: readonly string[]): string | null {
  const first = args[0];
  if (first === undefined || first.startsWith('-')) {
    return null;
  }
  return first.toLowerCase();
}

/** Falla cerrado: sólo subcomandos de lectura declarados en la config. */
export function assertReadOnlyGit(args: readonly string[]): void {
  const subcommand = gitSubcommand(args);
  if (subcommand === null) {
    throw new OrchestratorError('git_sin_subcomando', 'Comando git sin subcomando.');
  }
  if (FORBIDDEN_GIT_SUBCOMMANDS.includes(subcommand)) {
    throw new OrchestratorError(
      'git_destructivo_bloqueado',
      'Operación Git bloqueada por política: git ' + subcommand,
    );
  }
  if (!ALLOWED_GIT_SUBCOMMANDS.includes(subcommand)) {
    throw new OrchestratorError(
      'git_no_permitido',
      'Subcomando git fuera de la allowlist: git ' + subcommand,
    );
  }
}

export interface WorkingTreeEntry {
  /** Ruta relativa POSIX. */
  readonly path: string;
  /** Código porcelain, por ejemplo `M`, `A`, `??`. */
  readonly status: string;
}

export interface WorkspaceBaseline {
  readonly headCommit: string | null;
  readonly branch: string | null;
  readonly entries: readonly WorkingTreeEntry[];
  readonly clean: boolean;
  readonly capturedAt: string;
}

export class GitReader {
  private readonly runner: ProcessRunner;
  private readonly cwd: string;

  constructor(runner: ProcessRunner, cwd: string = REPO_ROOT) {
    this.runner = runner;
    this.cwd = cwd;
  }

  private async git(args: readonly string[]): Promise<string> {
    assertReadOnlyGit(args);
    const result = await this.runner({ command: 'git', args, cwd: this.cwd, timeoutMs: 30_000 });
    if (result.spawnError !== null) {
      throw new OrchestratorError('git_no_disponible', 'No se pudo ejecutar git: ' + result.spawnError);
    }
    if (result.exitCode !== 0) {
      throw new OrchestratorError(
        'git_error',
        'git ' + args.join(' ') + ' terminó con código ' + String(result.exitCode),
      );
    }
    return result.stdout;
  }

  async headCommit(): Promise<string | null> {
    try {
      const out = await this.git(['rev-parse', 'HEAD']);
      const value = out.trim();
      return value.length > 0 ? value : null;
    } catch {
      return null;
    }
  }

  async branch(): Promise<string | null> {
    try {
      const out = await this.git(['rev-parse', '--abbrev-ref', 'HEAD']);
      const value = out.trim();
      return value.length > 0 ? value : null;
    } catch {
      return null;
    }
  }

  async status(): Promise<readonly WorkingTreeEntry[]> {
    const out = await this.git(['status', '--porcelain']);
    return parsePorcelain(out);
  }

  async diffCheck(): Promise<{ readonly ok: boolean; readonly output: string }> {
    const result = await this.runner({
      command: 'git',
      args: ['diff', '--check'],
      cwd: this.cwd,
      timeoutMs: 30_000,
    });
    return { ok: result.exitCode === 0, output: result.stdout + result.stderr };
  }

  /** Baseline antes/después de cada invocación (doc §12). */
  async captureBaseline(capturedAt: string): Promise<WorkspaceBaseline> {
    const [headCommit, branch, entries] = await Promise.all([
      this.headCommit(),
      this.branch(),
      this.status(),
    ]);
    return { headCommit, branch, entries, clean: entries.length === 0, capturedAt };
  }
}

export function parsePorcelain(output: string): readonly WorkingTreeEntry[] {
  const entries: WorkingTreeEntry[] = [];
  for (const rawLine of output.split(/\r?\n/)) {
    if (rawLine.trim().length === 0) {
      continue;
    }
    const status = rawLine.slice(0, 2).trim();
    let file = rawLine.slice(3).trim();
    // Renombrados: `R  origen -> destino`.
    const arrow = file.indexOf(' -> ');
    if (arrow !== -1) {
      file = file.slice(arrow + 4);
    }
    if (file.startsWith('"') && file.endsWith('"')) {
      file = file.slice(1, -1);
    }
    entries.push({ path: toPosix(file), status: status.length === 0 ? '?' : status });
  }
  return entries;
}

/** Diferencia de rutas entre dos baselines: lo que cambió durante la invocación. */
export function baselineDelta(
  before: WorkspaceBaseline,
  after: WorkspaceBaseline,
): readonly string[] {
  const beforeMap = new Map(before.entries.map((e) => [e.path, e.status]));
  const changed = new Set<string>();
  for (const entry of after.entries) {
    if (beforeMap.get(entry.path) !== entry.status) {
      changed.add(entry.path);
    }
  }
  for (const entry of before.entries) {
    if (!after.entries.some((e) => e.path === entry.path)) {
      changed.add(entry.path);
    }
  }
  return [...changed].sort();
}
