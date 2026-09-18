/**
 * Persistencia local con `node:sqlite` (AD-09, AC-15).
 *
 * Reglas: transiciones atómicas, concurrencia optimista, journal
 * append-only, sin secretos y retención de 30 días con purga manual.
 */

import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

import { JOURNAL_RETENTION_DAYS, LEASE_TTL_MS } from '../config.ts';
import { newId } from '../domain/ids.ts';
import { redact, redactJson } from '../domain/redaction.ts';
import type { Actor, State, WorkflowEvent } from '../domain/states.ts';
import type { Mode } from '../domain/modes.ts';
import type { BudgetCounters } from '../domain/budget.ts';
import { MIGRATIONS, SCHEMA_VERSION } from './schema.ts';

export type Clock = () => Date;

export const systemClock: Clock = () => new Date();

export interface RunRow {
  readonly id: string;
  readonly created_at: string;
  readonly updated_at: string;
  readonly request_text: string;
  readonly mode: Mode;
  readonly state: State;
  readonly resume_state: State | null;
  readonly interrupt_reason: string | null;
  readonly version: number;
}

export interface TaskRow {
  readonly id: string;
  readonly run_id: string;
  readonly task_path: string | null;
  readonly task_title: string | null;
  readonly task_version: number;
  readonly task_hash: string | null;
  readonly task_hash_approved: string | null;
  readonly ready_for_claude: number;
  readonly created_at: string;
}

export interface DecisionRow {
  readonly id: string;
  readonly run_id: string;
  readonly question: string;
  readonly material: number;
  readonly status: 'pendiente' | 'respondida';
  readonly answer: string | null;
  readonly answered_by: string | null;
  readonly created_at: string;
  readonly answered_at: string | null;
}

export interface InvocationRow {
  readonly id: string;
  readonly run_id: string;
  readonly agent: string;
  readonly phase: string;
  readonly session_id: string | null;
  readonly command: string;
  readonly context_chars: number;
  readonly started_at: string;
  readonly ended_at: string | null;
  readonly outcome: string | null;
  readonly error_class: string | null;
  readonly exit_code: number | null;
  readonly summary: string | null;
  readonly usage_reported: number;
  readonly usage_detail: string | null;
}

export interface CycleRow {
  readonly id: string;
  readonly run_id: string;
  readonly fingerprint: string;
  readonly has_progress: number;
  readonly progress_signals: string;
  readonly created_at: string;
}

export interface JournalRow {
  readonly id: string;
  readonly run_id: string | null;
  readonly kind: string;
  readonly actor: string;
  readonly result: string | null;
  readonly reason: string | null;
  readonly payload: string;
  readonly created_at: string;
}

export interface TransitionRow {
  readonly id: string;
  readonly run_id: string;
  readonly from_state: State;
  readonly to_state: State;
  readonly event: WorkflowEvent;
  readonly actor: Actor;
  readonly result: string;
  readonly reason: string | null;
  readonly idempotency_key: string;
  readonly created_at: string;
}

export interface CheckpointRow {
  readonly id: string;
  readonly run_id: string;
  readonly state: State;
  readonly task_hash: string | null;
  readonly base_commit: string | null;
  readonly workspace: string;
  readonly attempt: number;
  readonly budget: string;
  readonly allowed_paths: string;
  readonly created_at: string;
}

export interface FileChangeRow {
  readonly id: string;
  readonly run_id: string;
  readonly invocation_id: string | null;
  readonly path: string;
  readonly change_type: string;
  readonly in_scope: number;
  readonly created_at: string;
}

export interface TestRow {
  readonly id: string;
  readonly run_id: string;
  readonly name: string;
  readonly command: string | null;
  readonly result: 'pass' | 'fail' | 'not_run';
  readonly created_at: string;
}

export interface FindingRow {
  readonly id: string;
  readonly review_id: string;
  readonly run_id: string;
  readonly code: string;
  readonly severity: string;
  readonly material: number;
  readonly in_scope: number;
  readonly summary: string;
  readonly status: string;
  readonly created_at: string;
}

export interface MetricRow {
  readonly id: string;
  readonly run_id: string;
  readonly scenario: string;
  readonly key: string;
  readonly value: string;
  readonly unit: string | null;
  readonly source: string;
  readonly created_at: string;
}

export class ConcurrencyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConcurrencyError';
  }
}

export class Store {
  private readonly db: DatabaseSync;
  private readonly clock: Clock;

  private constructor(db: DatabaseSync, clock: Clock) {
    this.db = db;
    this.clock = clock;
  }

  static open(dbPath: string, clock: Clock = systemClock): Store {
    if (dbPath !== ':memory:') {
      fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    }
    const db = new DatabaseSync(dbPath);
    const store = new Store(db, clock);
    store.migrate();
    return store;
  }

  close(): void {
    this.db.close();
  }

  now(): string {
    return this.clock().toISOString();
  }

  /** Migración hacia adelante; cada versión se aplica una sola vez. */
  private migrate(): void {
    this.db.exec('CREATE TABLE IF NOT EXISTS schema_meta (version INTEGER NOT NULL, applied_at TEXT NOT NULL);');
    const current = this.schemaVersion();
    for (const migration of MIGRATIONS) {
      if (migration.version > current) {
        this.db.exec(migration.sql);
        this.db
          .prepare('INSERT INTO schema_meta (version, applied_at) VALUES (?, ?)')
          .run(migration.version, this.now());
      }
    }
  }

  schemaVersion(): number {
    const row = this.db.prepare('SELECT MAX(version) AS v FROM schema_meta').get() as
      | { v: number | null }
      | undefined;
    return row?.v ?? 0;
  }

  expectedSchemaVersion(): number {
    return SCHEMA_VERSION;
  }

  transaction<T>(fn: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = fn();
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  // ---------------------------------------------------------------- journal

  journal(entry: {
    runId: string | null;
    kind: string;
    actor: string;
    result?: string | null;
    reason?: string | null;
    payload?: unknown;
  }): string {
    const id = newId('jev');
    this.db
      .prepare(
        'INSERT INTO journal_event (id, run_id, kind, actor, result, reason, payload, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .run(
        id,
        entry.runId,
        entry.kind,
        entry.actor,
        entry.result ?? null,
        entry.reason === undefined || entry.reason === null ? null : redact(entry.reason),
        redactJson(entry.payload ?? {}),
        this.now(),
      );
    return id;
  }

  listJournal(runId: string, limit = 200): readonly JournalRow[] {
    return this.db
      .prepare('SELECT * FROM journal_event WHERE run_id = ? ORDER BY created_at DESC, rowid DESC LIMIT ?')
      .all(runId, limit) as unknown as JournalRow[];
  }

  countJournal(): number {
    const row = this.db.prepare('SELECT COUNT(*) AS c FROM journal_event').get() as { c: number };
    return row.c;
  }

  /**
   * Purga manual del journal según retención (AD-14).
   * Nunca borra Tasks/Reviews versionadas ni otras entidades.
   */
  purgeJournalOlderThan(days: number = JOURNAL_RETENTION_DAYS): number {
    const cutoff = new Date(this.clock().getTime() - days * 24 * 60 * 60 * 1000).toISOString();
    const result = this.db.prepare('DELETE FROM journal_event WHERE created_at < ?').run(cutoff);
    return Number(result.changes);
  }

  // ------------------------------------------------------------------- runs

  createRun(input: { requestText: string; mode: Mode; state: State }): RunRow {
    const id = newId('run');
    const now = this.now();
    this.db
      .prepare(
        'INSERT INTO workflow_run (id, created_at, updated_at, request_text, mode, state, resume_state, interrupt_reason, version) VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, 0)',
      )
      .run(id, now, now, input.requestText, input.mode, input.state);
    this.db
      .prepare(
        'INSERT INTO budget_counter (run_id, claude_invocations, ai_invocations, cycles_without_progress, transient_retries, updated_at) VALUES (?, 0, 0, 0, 0, ?)',
      )
      .run(id, now);
    return this.getRun(id) as RunRow;
  }

  getRun(id: string): RunRow | undefined {
    return this.db.prepare('SELECT * FROM workflow_run WHERE id = ?').get(id) as
      | unknown as RunRow
      | undefined;
  }

  listRuns(limit = 50): readonly RunRow[] {
    return this.db
      .prepare('SELECT * FROM workflow_run ORDER BY created_at DESC LIMIT ?')
      .all(limit) as unknown as RunRow[];
  }

  /** Actualización con concurrencia optimista sobre `version`. */
  updateRun(
    id: string,
    expectedVersion: number,
    patch: {
      state?: State;
      mode?: Mode;
      resumeState?: State | null;
      interruptReason?: string | null;
    },
  ): RunRow {
    const current = this.getRun(id);
    if (current === undefined) {
      throw new ConcurrencyError('run_inexistente:' + id);
    }
    const next = {
      state: patch.state ?? current.state,
      mode: patch.mode ?? current.mode,
      resumeState: patch.resumeState === undefined ? current.resume_state : patch.resumeState,
      interruptReason:
        patch.interruptReason === undefined ? current.interrupt_reason : patch.interruptReason,
    };
    const result = this.db
      .prepare(
        'UPDATE workflow_run SET state = ?, mode = ?, resume_state = ?, interrupt_reason = ?, updated_at = ?, version = version + 1 WHERE id = ? AND version = ?',
      )
      .run(
        next.state,
        next.mode,
        next.resumeState,
        next.interruptReason === null ? null : redact(next.interruptReason),
        this.now(),
        id,
        expectedVersion,
      );
    if (Number(result.changes) !== 1) {
      throw new ConcurrencyError('version_desactualizada:' + id);
    }
    return this.getRun(id) as RunRow;
  }

  // ------------------------------------------------------------- transiciones

  /** Devuelve `false` si la clave de idempotencia ya fue aplicada. */
  recordTransition(input: {
    runId: string;
    from: State;
    to: State;
    event: WorkflowEvent;
    actor: Actor;
    result: 'aceptada' | 'denegada';
    reason?: string | null;
    idempotencyKey: string;
  }): boolean {
    const existing = this.db
      .prepare('SELECT id FROM state_transition WHERE idempotency_key = ?')
      .get(input.idempotencyKey);
    if (existing !== undefined) {
      return false;
    }
    this.db
      .prepare(
        'INSERT INTO state_transition (id, run_id, from_state, to_state, event, actor, result, reason, idempotency_key, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .run(
        newId('trn'),
        input.runId,
        input.from,
        input.to,
        input.event,
        input.actor,
        input.result,
        input.reason ?? null,
        input.idempotencyKey,
        this.now(),
      );
    return true;
  }

  listTransitions(runId: string): readonly TransitionRow[] {
    return this.db
      .prepare('SELECT * FROM state_transition WHERE run_id = ? ORDER BY created_at ASC, rowid ASC')
      .all(runId) as unknown as TransitionRow[];
  }

  // ------------------------------------------------------------------ tasks

  upsertTask(input: {
    runId: string;
    taskPath: string | null;
    taskTitle: string | null;
    taskHash: string | null;
    readyForClaude: boolean;
  }): TaskRow {
    const existing = this.getTask(input.runId);
    if (existing === undefined) {
      const id = newId('tsk');
      this.db
        .prepare(
          'INSERT INTO task_run (id, run_id, task_path, task_title, task_version, task_hash, task_hash_approved, ready_for_claude, created_at) VALUES (?, ?, ?, ?, 1, ?, NULL, ?, ?)',
        )
        .run(
          id,
          input.runId,
          input.taskPath,
          input.taskTitle,
          input.taskHash,
          input.readyForClaude ? 1 : 0,
          this.now(),
        );
      return this.getTask(input.runId) as TaskRow;
    }

    const hashChanged = existing.task_hash !== input.taskHash;
    this.db
      .prepare(
        'UPDATE task_run SET task_path = ?, task_title = ?, task_hash = ?, ready_for_claude = ?, task_version = task_version + ?, task_hash_approved = CASE WHEN ? THEN NULL ELSE task_hash_approved END WHERE run_id = ?',
      )
      .run(
        input.taskPath,
        input.taskTitle,
        input.taskHash,
        input.readyForClaude ? 1 : 0,
        hashChanged ? 1 : 0,
        hashChanged ? 1 : 0,
        input.runId,
      );
    return this.getTask(input.runId) as TaskRow;
  }

  getTask(runId: string): TaskRow | undefined {
    return this.db.prepare('SELECT * FROM task_run WHERE run_id = ?').get(runId) as
      | unknown as TaskRow
      | undefined;
  }

  approveTaskHash(runId: string, hash: string): void {
    this.db.prepare('UPDATE task_run SET task_hash_approved = ? WHERE run_id = ?').run(hash, runId);
  }

  // -------------------------------------------------------------- decisiones

  createDecision(input: { runId: string; question: string; material: boolean }): DecisionRow {
    const id = newId('dec');
    this.db
      .prepare(
        'INSERT INTO decision (id, run_id, question, material, status, answer, answered_by, created_at, answered_at) VALUES (?, ?, ?, ?, ?, NULL, NULL, ?, NULL)',
      )
      .run(id, input.runId, redact(input.question), input.material ? 1 : 0, 'pendiente', this.now());
    return this.db.prepare('SELECT * FROM decision WHERE id = ?').get(id) as unknown as DecisionRow;
  }

  answerDecision(id: string, answer: string, actor: string): void {
    this.db
      .prepare(
        "UPDATE decision SET status = 'respondida', answer = ?, answered_by = ?, answered_at = ? WHERE id = ?",
      )
      .run(redact(answer), actor, this.now(), id);
  }

  getDecision(id: string): DecisionRow | undefined {
    return this.db.prepare('SELECT * FROM decision WHERE id = ?').get(id) as unknown as
      | DecisionRow
      | undefined;
  }

  listDecisions(runId: string): readonly DecisionRow[] {
    return this.db
      .prepare('SELECT * FROM decision WHERE run_id = ? ORDER BY created_at ASC')
      .all(runId) as unknown as DecisionRow[];
  }

  countPendingMaterialDecisions(runId: string): number {
    const row = this.db
      .prepare("SELECT COUNT(*) AS c FROM decision WHERE run_id = ? AND material = 1 AND status = 'pendiente'")
      .get(runId) as { c: number };
    return row.c;
  }

  // -------------------------------------------------------------- approvals

  recordApproval(input: {
    runId: string;
    kind: string;
    subjectHash: string | null;
    actor: Actor;
    outcome: 'aprobado' | 'rechazado' | 'cambios';
  }): string {
    const id = newId('apr');
    this.db
      .prepare(
        'INSERT INTO approval (id, run_id, kind, subject_hash, actor, outcome, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
      .run(id, input.runId, input.kind, input.subjectHash, input.actor, input.outcome, this.now());
    return id;
  }

  listApprovals(runId: string): readonly { kind: string; subject_hash: string | null; outcome: string }[] {
    return this.db
      .prepare('SELECT kind, subject_hash, outcome FROM approval WHERE run_id = ? ORDER BY created_at ASC')
      .all(runId) as unknown as { kind: string; subject_hash: string | null; outcome: string }[];
  }

  // ------------------------------------------------------------ invocaciones

  startInvocation(input: {
    runId: string;
    agent: string;
    phase: string;
    sessionId: string | null;
    command: string;
    contextChars: number;
  }): string {
    const id = newId('inv');
    this.db
      .prepare(
        'INSERT INTO agent_invocation (id, run_id, agent, phase, session_id, command, context_chars, started_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .run(
        id,
        input.runId,
        input.agent,
        input.phase,
        input.sessionId,
        redact(input.command),
        input.contextChars,
        this.now(),
      );
    return id;
  }

  finishInvocation(input: {
    invocationId: string;
    outcome: string;
    errorClass: string | null;
    exitCode: number | null;
    summary: string | null;
    sessionId?: string | null;
    /** Consumo informado por el CLI. `false` significa DESCONOCIDO, no cero. */
    usageReported?: boolean;
    usageDetail?: string | null;
  }): void {
    this.db
      .prepare(
        'UPDATE agent_invocation SET ended_at = ?, outcome = ?, error_class = ?, exit_code = ?, summary = ?, session_id = COALESCE(?, session_id), usage_reported = ?, usage_detail = ? WHERE id = ?',
      )
      .run(
        this.now(),
        input.outcome,
        input.errorClass,
        input.exitCode,
        input.summary === null ? null : redact(input.summary),
        input.sessionId ?? null,
        input.usageReported === true ? 1 : 0,
        input.usageDetail === undefined || input.usageDetail === null ? null : redact(input.usageDetail),
        input.invocationId,
      );
  }

  listInvocations(runId: string): readonly InvocationRow[] {
    return this.db
      .prepare('SELECT * FROM agent_invocation WHERE run_id = ? ORDER BY started_at ASC, rowid ASC')
      .all(runId) as unknown as InvocationRow[];
  }

  recordAttempt(input: {
    runId: string;
    invocationId: string;
    number: number;
    outcome: string;
    errorClass: string | null;
  }): void {
    this.db
      .prepare(
        'INSERT INTO attempt (id, invocation_id, run_id, number, outcome, error_class, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
      .run(
        newId('att'),
        input.invocationId,
        input.runId,
        input.number,
        input.outcome,
        input.errorClass,
        this.now(),
      );
  }

  countAttempts(runId: string): number {
    const row = this.db.prepare('SELECT COUNT(*) AS c FROM attempt WHERE run_id = ?').get(runId) as {
      c: number;
    };
    return row.c;
  }

  recordError(input: {
    runId: string;
    invocationId: string | null;
    errorClass: string;
    transient: boolean;
    message: string | null;
  }): void {
    this.db
      .prepare(
        'INSERT INTO error_event (id, run_id, invocation_id, error_class, transient, message, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
      .run(
        newId('err'),
        input.runId,
        input.invocationId,
        input.errorClass,
        input.transient ? 1 : 0,
        input.message === null ? null : redact(input.message),
        this.now(),
      );
  }

  listErrors(runId: string): readonly { error_class: string; transient: number; message: string | null }[] {
    return this.db
      .prepare('SELECT error_class, transient, message FROM error_event WHERE run_id = ? ORDER BY created_at ASC')
      .all(runId) as unknown as { error_class: string; transient: number; message: string | null }[];
  }

  // ------------------------------------------------------------- workspace

  recordFileChange(input: {
    runId: string;
    invocationId: string | null;
    path: string;
    changeType: string;
    inScope: boolean;
    sha256Before: string | null;
    sha256After: string | null;
  }): void {
    this.db
      .prepare(
        'INSERT INTO file_change (id, run_id, invocation_id, path, change_type, in_scope, sha256_before, sha256_after, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .run(
        newId('fch'),
        input.runId,
        input.invocationId,
        input.path,
        input.changeType,
        input.inScope ? 1 : 0,
        input.sha256Before,
        input.sha256After,
        this.now(),
      );
  }

  listFileChanges(runId: string): readonly FileChangeRow[] {
    return this.db
      .prepare('SELECT * FROM file_change WHERE run_id = ? ORDER BY created_at ASC')
      .all(runId) as unknown as FileChangeRow[];
  }

  /** Rutas reconocidas como propias de la ejecución (doc §12). */
  recognizedPaths(runId: string): ReadonlySet<string> {
    const rows = this.db
      .prepare('SELECT DISTINCT path FROM file_change WHERE run_id = ?')
      .all(runId) as unknown as { path: string }[];
    return new Set(rows.map((r) => r.path));
  }

  recordTest(input: {
    runId: string;
    name: string;
    command: string | null;
    result: 'pass' | 'fail' | 'not_run';
  }): void {
    this.db
      .prepare('INSERT INTO test_run (id, run_id, name, command, result, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(newId('tst'), input.runId, input.name, input.command, input.result, this.now());
  }

  listTests(runId: string): readonly TestRow[] {
    return this.db
      .prepare('SELECT * FROM test_run WHERE run_id = ? ORDER BY created_at ASC')
      .all(runId) as unknown as TestRow[];
  }

  // --------------------------------------------------------------- reviews

  recordReview(input: {
    runId: string;
    reviewer: string;
    verdict: 'PASS' | 'CHANGES_REQUIRED' | 'BLOCKED';
    summary: string | null;
  }): string {
    const id = newId('rev');
    this.db
      .prepare('INSERT INTO review (id, run_id, reviewer, verdict, summary, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, input.runId, input.reviewer, input.verdict, input.summary === null ? null : redact(input.summary), this.now());
    return id;
  }

  recordFinding(input: {
    runId: string;
    reviewId: string;
    code: string;
    severity: string;
    material: boolean;
    inScope: boolean;
    summary: string;
  }): string {
    const id = newId('fnd');
    this.db
      .prepare(
        'INSERT INTO finding (id, review_id, run_id, code, severity, material, in_scope, summary, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .run(
        id,
        input.reviewId,
        input.runId,
        input.code,
        input.severity,
        input.material ? 1 : 0,
        input.inScope ? 1 : 0,
        redact(input.summary),
        'abierto',
        this.now(),
      );
    return id;
  }

  closeFinding(id: string): void {
    this.db.prepare("UPDATE finding SET status = 'cerrado' WHERE id = ?").run(id);
  }

  listOpenFindings(runId: string): readonly FindingRow[] {
    return this.db
      .prepare("SELECT * FROM finding WHERE run_id = ? AND status = 'abierto' ORDER BY created_at ASC")
      .all(runId) as unknown as FindingRow[];
  }

  /** Hallazgos cuyo código pertenece a una categoría concreta. */
  listFindingsByCategory(runId: string, codes: readonly string[]): readonly FindingRow[] {
    if (codes.length === 0) {
      return [];
    }
    const normalized = new Set(codes.map((code) => code.toLowerCase()));
    return this.db
      .prepare('SELECT * FROM finding WHERE run_id = ?')
      .all(runId)
      .filter((row) => normalized.has(String((row as { code: string }).code).toLowerCase())) as unknown as FindingRow[];
  }

  lastReviewVerdict(runId: string): string | null {
    const row = this.db
      .prepare('SELECT verdict FROM review WHERE run_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1')
      .get(runId) as { verdict: string } | undefined;
    return row?.verdict ?? null;
  }

  // ------------------------------------------------------------- presupuesto

  getCounters(runId: string): BudgetCounters {
    const row = this.db.prepare('SELECT * FROM budget_counter WHERE run_id = ?').get(runId) as
      | {
          claude_invocations: number;
          ai_invocations: number;
          ai_invocations_window: number;
          cycles_without_progress: number;
          transient_retries: number;
        }
      | undefined;
    if (row === undefined) {
      return {
        claudeInvocations: 0,
        aiInvocations: 0,
        aiInvocationsWindow: 0,
        cyclesWithoutProgress: 0,
        transientRetries: 0,
      };
    }
    return {
      claudeInvocations: row.claude_invocations,
      aiInvocations: row.ai_invocations,
      aiInvocationsWindow: row.ai_invocations_window,
      cyclesWithoutProgress: row.cycles_without_progress,
      transientRetries: row.transient_retries,
    };
  }

  /** Incrementos acumulativos; nunca se reinician por abrir sesión limpia. */
  bumpCounters(
    runId: string,
    delta: Partial<{
      claudeInvocations: number;
      aiInvocations: number;
      aiInvocationsWindow: number;
      cyclesWithoutProgress: number;
      transientRetries: number;
    }>,
  ): BudgetCounters {
    this.db
      .prepare(
        'UPDATE budget_counter SET claude_invocations = claude_invocations + ?, ai_invocations = ai_invocations + ?, ai_invocations_window = ai_invocations_window + ?, cycles_without_progress = cycles_without_progress + ?, transient_retries = transient_retries + ?, updated_at = ? WHERE run_id = ?',
      )
      .run(
        delta.claudeInvocations ?? 0,
        delta.aiInvocations ?? 0,
        delta.aiInvocationsWindow ?? delta.aiInvocations ?? 0,
        delta.cyclesWithoutProgress ?? 0,
        delta.transientRetries ?? 0,
        this.now(),
        runId,
      );
    return this.getCounters(runId);
  }

  /**
   * Reinicia SÓLO la ventana de invocaciones AI desde la última intervención
   * del Product Owner. El total histórico nunca se borra (auditoría §6).
   */
  resetAiWindow(runId: string, reason: string): BudgetCounters {
    this.db
      .prepare('UPDATE budget_counter SET ai_invocations_window = 0, updated_at = ? WHERE run_id = ?')
      .run(this.now(), runId);
    this.journal({
      runId,
      kind: 'ventana_ai_reiniciada',
      actor: 'product_owner',
      result: 'reiniciada',
      reason,
      payload: { totalHistorico: this.getCounters(runId).aiInvocations },
    });
    return this.getCounters(runId);
  }

  // -------------------------------------------------- versiones vistas (VER)

  /**
   * Registra la versión exacta que el Product Owner vio.
   * APROBAR sólo puede aceptar un hash previamente visto.
   */
  recordViewedVersion(input: {
    runId: string;
    kind: string;
    hash: string;
    state: State;
    actor: Actor;
  }): string {
    const id = newId('vst');
    this.db
      .prepare(
        'INSERT INTO viewed_version (id, run_id, kind, hash, state, actor, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
      .run(id, input.runId, input.kind, input.hash, input.state, input.actor, this.now());
    return id;
  }

  /** ¿El Product Owner vio exactamente este hash de este artefacto? */
  hasViewedVersion(runId: string, kind: string, hash: string): boolean {
    const row = this.db
      .prepare('SELECT id FROM viewed_version WHERE run_id = ? AND kind = ? AND hash = ? LIMIT 1')
      .get(runId, kind, hash);
    return row !== undefined;
  }

  lastViewedVersion(runId: string, kind: string): string | null {
    const row = this.db
      .prepare(
        'SELECT hash FROM viewed_version WHERE run_id = ? AND kind = ? ORDER BY created_at DESC, rowid DESC LIMIT 1',
      )
      .get(runId, kind) as { hash: string } | undefined;
    return row?.hash ?? null;
  }

  /** Reinicios puntuales autorizados: sólo ciclos sin progreso y reintentos. */
  resetCycleCounters(runId: string, fields: { cyclesWithoutProgress?: boolean; transientRetries?: boolean }): void {
    this.db
      .prepare(
        'UPDATE budget_counter SET cycles_without_progress = CASE WHEN ? THEN 0 ELSE cycles_without_progress END, transient_retries = CASE WHEN ? THEN 0 ELSE transient_retries END, updated_at = ? WHERE run_id = ?',
      )
      .run(fields.cyclesWithoutProgress === true ? 1 : 0, fields.transientRetries === true ? 1 : 0, this.now(), runId);
  }

  // ------------------------------------------------------------------ ciclos

  recordCycle(input: {
    runId: string;
    fingerprint: string;
    hasProgress: boolean;
    signals: readonly string[];
  }): void {
    this.db
      .prepare(
        'INSERT INTO cycle (id, run_id, fingerprint, has_progress, progress_signals, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .run(
        newId('cyc'),
        input.runId,
        input.fingerprint,
        input.hasProgress ? 1 : 0,
        JSON.stringify(input.signals),
        this.now(),
      );
  }

  listCycles(runId: string): readonly CycleRow[] {
    return this.db
      .prepare('SELECT * FROM cycle WHERE run_id = ? ORDER BY created_at ASC, rowid ASC')
      .all(runId) as unknown as CycleRow[];
  }

  // ------------------------------------------------------------- checkpoints

  recordCheckpoint(input: {
    runId: string;
    state: State;
    taskHash: string | null;
    baseCommit: string | null;
    workspace: unknown;
    attempt: number;
    budget: BudgetCounters;
    allowedPaths: readonly string[];
  }): string {
    const id = newId('chk');
    this.db
      .prepare(
        'INSERT INTO checkpoint (id, run_id, state, task_hash, base_commit, workspace, attempt, budget, allowed_paths, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .run(
        id,
        input.runId,
        input.state,
        input.taskHash,
        input.baseCommit,
        redactJson(input.workspace),
        input.attempt,
        JSON.stringify(input.budget),
        JSON.stringify(input.allowedPaths),
        this.now(),
      );
    return id;
  }

  lastCheckpoint(runId: string): CheckpointRow | undefined {
    return this.db
      .prepare('SELECT * FROM checkpoint WHERE run_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1')
      .get(runId) as unknown as CheckpointRow | undefined;
  }

  // ---------------------------------------------------------------- leases

  /** Lock exclusivo por Task: sólo un proceso puede mutar (AC-05). */
  acquireLease(runId: string, holder: string, pid: number, ttlMs: number = LEASE_TTL_MS): boolean {
    const now = this.clock().getTime();
    const nowIso = new Date(now).toISOString();
    const expiresIso = new Date(now + ttlMs).toISOString();
    const existing = this.db.prepare('SELECT * FROM lease WHERE run_id = ?').get(runId) as
      | { holder: string; expires_at: string }
      | undefined;

    if (existing !== undefined) {
      const stillValid = Date.parse(existing.expires_at) > now;
      if (stillValid && existing.holder !== holder) {
        return false;
      }
      this.db
        .prepare('UPDATE lease SET holder = ?, pid = ?, acquired_at = ?, expires_at = ? WHERE run_id = ?')
        .run(holder, pid, nowIso, expiresIso, runId);
      return true;
    }

    this.db
      .prepare('INSERT INTO lease (run_id, holder, pid, acquired_at, expires_at) VALUES (?, ?, ?, ?, ?)')
      .run(runId, holder, pid, nowIso, expiresIso);
    return true;
  }

  releaseLease(runId: string, holder: string): void {
    this.db.prepare('DELETE FROM lease WHERE run_id = ? AND holder = ?').run(runId, holder);
  }

  hasLease(runId: string, holder: string): boolean {
    const row = this.db.prepare('SELECT holder, expires_at FROM lease WHERE run_id = ?').get(runId) as
      | { holder: string; expires_at: string }
      | undefined;
    if (row === undefined) {
      return false;
    }
    return row.holder === holder && Date.parse(row.expires_at) > this.clock().getTime();
  }

  /** Runs con lease vencido: se reconcilian a `PAUSED` al reiniciar (FR-18). */
  expiredLeases(): readonly { run_id: string; holder: string; expires_at: string }[] {
    const nowIso = this.now();
    return this.db
      .prepare('SELECT run_id, holder, expires_at FROM lease WHERE expires_at <= ?')
      .all(nowIso) as unknown as { run_id: string; holder: string; expires_at: string }[];
  }

  // --------------------------------------------------------------- métricas

  recordMetric(input: {
    runId: string;
    scenario: string;
    key: string;
    value: string;
    unit: string | null;
    source: string;
  }): void {
    this.db
      .prepare(
        'INSERT INTO metric (id, run_id, scenario, key, value, unit, source, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .run(
        newId('mtr'),
        input.runId,
        input.scenario,
        input.key,
        redact(input.value),
        input.unit,
        input.source,
        this.now(),
      );
  }

  listMetrics(runId: string): readonly MetricRow[] {
    return this.db
      .prepare('SELECT * FROM metric WHERE run_id = ? ORDER BY created_at ASC')
      .all(runId) as unknown as MetricRow[];
  }

  // ------------------------------------------------------------- artefactos

  recordArtifact(input: {
    runId: string;
    kind: string;
    path: string;
    sha256: string | null;
    bytes: number | null;
  }): void {
    this.db
      .prepare('INSERT INTO artifact (id, run_id, kind, path, sha256, bytes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(newId('art'), input.runId, input.kind, input.path, input.sha256, input.bytes, this.now());
  }
}
