/**
 * Checkpoints, reconciliación y recuperación ante error (doc §11, FR-14,
 * FR-18, AC-04, T-03, T-04, T-15).
 *
 * Invariante: NUNCA se ejecuta reset, clean, stash, checkout ni ninguna
 * operación que destruya trabajo. El working tree se conserva siempre.
 */

import type { ErrorClass } from '../domain/errors.ts';
import { decideRetry, isTransient } from '../domain/errors.ts';
import { LIMITS } from '../config.ts';
import type { Store } from '../store/store.ts';
import type { State } from '../domain/states.ts';
import type { WorkspaceBaseline } from '../workspace/git.ts';

export interface ReconciliationEntry {
  readonly runId: string;
  readonly previousState: State;
  readonly reason: string;
}

/**
 * Al arrancar el runtime: todo run con lease vencido queda `PAUSED`
 * conservando `resume_state`. Nunca se relanza trabajo automáticamente.
 */
export function reconcileOnStart(store: Store): readonly ReconciliationEntry[] {
  const entries: ReconciliationEntry[] = [];

  for (const lease of store.expiredLeases()) {
    const run = store.getRun(lease.run_id);
    if (run === undefined) {
      continue;
    }
    if (run.state === 'PAUSED' || run.state === 'CANCELADO' || run.state === 'RECHAZADO' || run.state === 'COMMITTED') {
      store.releaseLease(lease.run_id, lease.holder);
      continue;
    }

    store.updateRun(run.id, run.version, {
      state: 'PAUSED',
      resumeState: run.state,
      interruptReason: 'lease_vencido_tras_reinicio',
    });
    store.recordTransition({
      runId: run.id,
      from: run.state,
      to: 'PAUSED',
      event: 'pausar',
      actor: 'orchestrator',
      result: 'aceptada',
      reason: 'lease_vencido_tras_reinicio',
      idempotencyKey: 'reconcile:' + run.id + ':' + String(run.version),
    });
    store.journal({
      runId: run.id,
      kind: 'reconciliacion_reinicio',
      actor: 'orchestrator',
      result: 'PAUSED',
      reason: 'lease_vencido_tras_reinicio',
      payload: { previousState: run.state, expiresAt: lease.expires_at },
    });
    store.releaseLease(lease.run_id, lease.holder);

    entries.push({ runId: run.id, previousState: run.state, reason: 'lease_vencido_tras_reinicio' });
  }

  return entries;
}

export interface CheckpointInput {
  readonly runId: string;
  readonly state: State;
  readonly taskHash: string | null;
  readonly baseline: WorkspaceBaseline;
  readonly attempt: number;
  readonly allowedPaths: readonly string[];
}

/** Checkpoint lógico previo a cada invocación (doc §11). */
export function saveCheckpoint(store: Store, input: CheckpointInput): string {
  const id = store.recordCheckpoint({
    runId: input.runId,
    state: input.state,
    taskHash: input.taskHash,
    baseCommit: input.baseline.headCommit,
    workspace: {
      branch: input.baseline.branch,
      clean: input.baseline.clean,
      entries: input.baseline.entries,
    },
    attempt: input.attempt,
    budget: store.getCounters(input.runId),
    allowedPaths: input.allowedPaths,
  });
  store.journal({
    runId: input.runId,
    kind: 'checkpoint',
    actor: 'orchestrator',
    result: 'guardado',
    payload: { checkpointId: id, state: input.state, baseCommit: input.baseline.headCommit },
  });
  return id;
}

export type FailureAction = 'reintentar' | 'API_ERROR' | 'PAUSED' | 'BUDGET_LIMIT';

export interface FailurePlan {
  readonly action: FailureAction;
  readonly errorClass: ErrorClass;
  readonly transient: boolean;
  readonly backoffMs: number;
  readonly reason: string;
  readonly message: string;
  /** Siempre `true`: el código nunca se revierte. */
  readonly preservesWorkingTree: true;
}

/**
 * Decide qué hacer tras una invocación fallida.
 * Autenticación, permisos, cuota, petición inválida y schema inválido
 * nunca se reintentan automáticamente.
 */
export function planFailure(input: {
  readonly errorClass: ErrorClass;
  readonly transientRetriesSoFar: number;
}): FailurePlan {
  const transient = isTransient(input.errorClass);
  const retry = decideRetry(
    input.errorClass,
    input.transientRetriesSoFar,
    LIMITS.maxTransientRetriesPerInvocation,
  );

  if (retry.retry) {
    return {
      action: 'reintentar',
      errorClass: input.errorClass,
      transient,
      backoffMs: retry.backoffMs,
      reason: retry.reason,
      message: 'Hubo un problema temporal; se intentará de nuevo sin perder tu trabajo.',
      preservesWorkingTree: true,
    };
  }

  if (transient) {
    return {
      action: 'BUDGET_LIMIT',
      errorClass: input.errorClass,
      transient,
      backoffMs: 0,
      reason: 'maximo_de_reintentos_alcanzado',
      message: 'Se alcanzó el máximo de reintentos. El trabajo quedó intacto y tú decides cómo seguir.',
      preservesWorkingTree: true,
    };
  }

  if (input.errorClass === 'preflight' || input.errorClass === 'auth' || input.errorClass === 'cancelled') {
    return {
      action: 'PAUSED',
      errorClass: input.errorClass,
      transient,
      backoffMs: 0,
      reason: 'requiere_intervencion:' + input.errorClass,
      message: 'La ejecución se detuvo y necesita tu intervención. Nada se borró.',
      preservesWorkingTree: true,
    };
  }

  return {
    action: 'API_ERROR',
    errorClass: input.errorClass,
    transient,
    backoffMs: 0,
    reason: 'error_no_transitorio:' + input.errorClass,
    message: 'El agente falló. Tu código se conservó tal como estaba.',
    preservesWorkingTree: true,
  };
}
