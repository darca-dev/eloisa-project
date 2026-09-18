/**
 * Sonda de workspace: única fuente del estado del working tree para el
 * motor. Permite pruebas deterministas sin depender de Git real, sin
 * relajar ninguna política (doc §12).
 */

import { REPO_ROOT } from '../config.ts';
import type { ProcessRunner } from '../adapters/process.ts';
import { spawnRunner } from '../adapters/process.ts';
import { GitReader } from './git.ts';
import type { WorkspaceBaseline } from './git.ts';

export interface WorkspaceProbe {
  /** Captura el estado actual del working tree. Nunca lo modifica. */
  baseline(capturedAt: string): Promise<WorkspaceBaseline>;
}

export class GitWorkspaceProbe implements WorkspaceProbe {
  private readonly reader: GitReader;

  constructor(runner: ProcessRunner = spawnRunner, cwd: string = REPO_ROOT) {
    this.reader = new GitReader(runner, cwd);
  }

  async baseline(capturedAt: string): Promise<WorkspaceBaseline> {
    return this.reader.captureBaseline(capturedAt);
  }
}

/** Sonda controlada para pruebas: devuelve estados programados en orden. */
export class ScriptedWorkspaceProbe implements WorkspaceProbe {
  private readonly states: WorkspaceBaseline[];
  private lastState: WorkspaceBaseline;

  constructor(states: readonly WorkspaceBaseline[]) {
    if (states.length === 0) {
      throw new Error('ScriptedWorkspaceProbe requiere al menos un estado.');
    }
    this.states = [...states];
    this.lastState = this.states[this.states.length - 1] as WorkspaceBaseline;
  }

  push(state: WorkspaceBaseline): void {
    this.states.push(state);
  }

  async baseline(capturedAt: string): Promise<WorkspaceBaseline> {
    const next = this.states.shift();
    if (next !== undefined) {
      this.lastState = next;
    }
    return { ...this.lastState, capturedAt };
  }
}

export function cleanBaseline(capturedAt = '1970-01-01T00:00:00.000Z'): WorkspaceBaseline {
  return { headCommit: 'HEADCOMMIT', branch: 'develop', entries: [], clean: true, capturedAt };
}

export function dirtyBaseline(
  paths: readonly string[],
  capturedAt = '1970-01-01T00:00:00.000Z',
): WorkspaceBaseline {
  return {
    headCommit: 'HEADCOMMIT',
    branch: 'develop',
    entries: paths.map((path) => ({ path, status: 'M' })),
    clean: false,
    capturedAt,
  };
}
