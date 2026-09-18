/**
 * Esquema SQLite local del Orchestrator (doc §8, AD-09, AC-15).
 *
 * Fuente maestra: `node:sqlite` de Node.js 24. Sin dependencia externa.
 * El esquema está versionado; las migraciones exigen snapshot previo.
 */

export const SCHEMA_VERSION = 2;

/**
 * DDL de la versión 1. Todas las marcas de tiempo son ISO-8601 UTC.
 * Ningún campo almacena secretos, tokens ni salida sin redactar.
 */
export const SCHEMA_V1 = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_meta (
  version     INTEGER NOT NULL,
  applied_at  TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS workflow_run (
  id                TEXT PRIMARY KEY,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL,
  request_text      TEXT NOT NULL,
  mode              TEXT NOT NULL,
  state             TEXT NOT NULL,
  resume_state      TEXT,
  interrupt_reason  TEXT,
  version           INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS task_run (
  id                 TEXT PRIMARY KEY,
  run_id             TEXT NOT NULL REFERENCES workflow_run(id),
  task_path          TEXT,
  task_title         TEXT,
  task_version       INTEGER NOT NULL DEFAULT 1,
  task_hash          TEXT,
  task_hash_approved TEXT,
  ready_for_claude   INTEGER NOT NULL DEFAULT 0,
  created_at         TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_task_run_run ON task_run(run_id);

CREATE TABLE IF NOT EXISTS state_transition (
  id              TEXT PRIMARY KEY,
  run_id          TEXT NOT NULL REFERENCES workflow_run(id),
  from_state      TEXT NOT NULL,
  to_state        TEXT NOT NULL,
  event           TEXT NOT NULL,
  actor           TEXT NOT NULL,
  result          TEXT NOT NULL,
  reason          TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_transition_run ON state_transition(run_id, created_at);

CREATE TABLE IF NOT EXISTS decision (
  id          TEXT PRIMARY KEY,
  run_id      TEXT NOT NULL REFERENCES workflow_run(id),
  question    TEXT NOT NULL,
  material    INTEGER NOT NULL,
  status      TEXT NOT NULL,
  answer      TEXT,
  answered_by TEXT,
  created_at  TEXT NOT NULL,
  answered_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_decision_run ON decision(run_id, status);

CREATE TABLE IF NOT EXISTS approval (
  id           TEXT PRIMARY KEY,
  run_id       TEXT NOT NULL REFERENCES workflow_run(id),
  kind         TEXT NOT NULL,
  subject_hash TEXT,
  actor        TEXT NOT NULL,
  outcome      TEXT NOT NULL,
  created_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_approval_run ON approval(run_id, kind);

CREATE TABLE IF NOT EXISTS agent_invocation (
  id            TEXT PRIMARY KEY,
  run_id        TEXT NOT NULL REFERENCES workflow_run(id),
  agent         TEXT NOT NULL,
  phase         TEXT NOT NULL,
  session_id    TEXT,
  command       TEXT NOT NULL,
  context_chars INTEGER NOT NULL DEFAULT 0,
  started_at    TEXT NOT NULL,
  ended_at      TEXT,
  outcome       TEXT,
  error_class   TEXT,
  exit_code     INTEGER,
  summary       TEXT
);
CREATE INDEX IF NOT EXISTS idx_invocation_run ON agent_invocation(run_id, started_at);

CREATE TABLE IF NOT EXISTS attempt (
  id            TEXT PRIMARY KEY,
  invocation_id TEXT NOT NULL REFERENCES agent_invocation(id),
  run_id        TEXT NOT NULL REFERENCES workflow_run(id),
  number        INTEGER NOT NULL,
  outcome       TEXT NOT NULL,
  error_class   TEXT,
  created_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_attempt_invocation ON attempt(invocation_id);

CREATE TABLE IF NOT EXISTS artifact (
  id         TEXT PRIMARY KEY,
  run_id     TEXT NOT NULL REFERENCES workflow_run(id),
  kind       TEXT NOT NULL,
  path       TEXT NOT NULL,
  sha256     TEXT,
  bytes      INTEGER,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS file_change (
  id            TEXT PRIMARY KEY,
  run_id        TEXT NOT NULL REFERENCES workflow_run(id),
  invocation_id TEXT,
  path          TEXT NOT NULL,
  change_type   TEXT NOT NULL,
  in_scope      INTEGER NOT NULL,
  sha256_before TEXT,
  sha256_after  TEXT,
  created_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_file_change_run ON file_change(run_id);

CREATE TABLE IF NOT EXISTS test_run (
  id         TEXT PRIMARY KEY,
  run_id     TEXT NOT NULL REFERENCES workflow_run(id),
  name       TEXT NOT NULL,
  command    TEXT,
  result     TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_test_run_run ON test_run(run_id);

CREATE TABLE IF NOT EXISTS review (
  id         TEXT PRIMARY KEY,
  run_id     TEXT NOT NULL REFERENCES workflow_run(id),
  reviewer   TEXT NOT NULL,
  verdict    TEXT NOT NULL,
  summary    TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS finding (
  id         TEXT PRIMARY KEY,
  review_id  TEXT NOT NULL REFERENCES review(id),
  run_id     TEXT NOT NULL REFERENCES workflow_run(id),
  code       TEXT NOT NULL,
  severity   TEXT NOT NULL,
  material   INTEGER NOT NULL,
  in_scope   INTEGER NOT NULL,
  summary    TEXT NOT NULL,
  status     TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_finding_run ON finding(run_id, status);

CREATE TABLE IF NOT EXISTS error_event (
  id            TEXT PRIMARY KEY,
  run_id        TEXT NOT NULL REFERENCES workflow_run(id),
  invocation_id TEXT,
  error_class   TEXT NOT NULL,
  transient     INTEGER NOT NULL,
  message       TEXT,
  created_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_error_run ON error_event(run_id);

CREATE TABLE IF NOT EXISTS budget_counter (
  run_id                   TEXT PRIMARY KEY REFERENCES workflow_run(id),
  claude_invocations       INTEGER NOT NULL DEFAULT 0,
  ai_invocations           INTEGER NOT NULL DEFAULT 0,
  cycles_without_progress  INTEGER NOT NULL DEFAULT 0,
  transient_retries        INTEGER NOT NULL DEFAULT 0,
  updated_at               TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS lease (
  run_id      TEXT PRIMARY KEY REFERENCES workflow_run(id),
  holder      TEXT NOT NULL,
  pid         INTEGER NOT NULL,
  acquired_at TEXT NOT NULL,
  expires_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS checkpoint (
  id            TEXT PRIMARY KEY,
  run_id        TEXT NOT NULL REFERENCES workflow_run(id),
  state         TEXT NOT NULL,
  task_hash     TEXT,
  base_commit   TEXT,
  workspace     TEXT NOT NULL,
  attempt       INTEGER NOT NULL,
  budget        TEXT NOT NULL,
  allowed_paths TEXT NOT NULL,
  created_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_checkpoint_run ON checkpoint(run_id, created_at);

CREATE TABLE IF NOT EXISTS cycle (
  id               TEXT PRIMARY KEY,
  run_id           TEXT NOT NULL REFERENCES workflow_run(id),
  fingerprint      TEXT NOT NULL,
  has_progress     INTEGER NOT NULL,
  progress_signals TEXT NOT NULL,
  created_at       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cycle_run ON cycle(run_id, created_at);

CREATE TABLE IF NOT EXISTS metric (
  id         TEXT PRIMARY KEY,
  run_id     TEXT NOT NULL REFERENCES workflow_run(id),
  scenario   TEXT NOT NULL,
  key        TEXT NOT NULL,
  value      TEXT NOT NULL,
  unit       TEXT,
  source     TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_metric_run ON metric(run_id, scenario);

CREATE TABLE IF NOT EXISTS journal_event (
  id         TEXT PRIMARY KEY,
  run_id     TEXT REFERENCES workflow_run(id),
  kind       TEXT NOT NULL,
  actor      TEXT NOT NULL,
  result     TEXT,
  reason     TEXT,
  payload    TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_journal_run ON journal_event(run_id, created_at);
CREATE INDEX IF NOT EXISTS idx_journal_created ON journal_event(created_at);
`;

/**
 * Versión 2 (corrección de auditoría):
 *
 * - `viewed_version`: registra qué versión exacta vio el Product Owner, para
 *   que APROBAR sólo pueda aceptar aquello que efectivamente revisó.
 * - `budget_counter.ai_invocations_window`: ventana de invocaciones AI desde
 *   la última intervención del Product Owner, separada del total histórico.
 * - `agent_invocation.usage_reported/usage_detail`: consumo informado por el
 *   CLI. Su ausencia significa DESCONOCIDO, nunca cero.
 *
 * Reversible: basta volver al binario anterior; las columnas añadidas tienen
 * valor por defecto y la tabla nueva es ignorada por la versión 1.
 */
export const SCHEMA_V2 = `
CREATE TABLE IF NOT EXISTS viewed_version (
  id         TEXT PRIMARY KEY,
  run_id     TEXT NOT NULL REFERENCES workflow_run(id),
  kind       TEXT NOT NULL,
  hash       TEXT NOT NULL,
  state      TEXT NOT NULL,
  actor      TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_viewed_run ON viewed_version(run_id, kind, created_at);

ALTER TABLE budget_counter ADD COLUMN ai_invocations_window INTEGER NOT NULL DEFAULT 0;
ALTER TABLE agent_invocation ADD COLUMN usage_reported INTEGER NOT NULL DEFAULT 0;
ALTER TABLE agent_invocation ADD COLUMN usage_detail TEXT;
`;

/** Migraciones registradas por versión de destino. */
export const MIGRATIONS: readonly { readonly version: number; readonly sql: string }[] = [
  { version: 1, sql: SCHEMA_V1 },
  { version: 2, sql: SCHEMA_V2 },
];
