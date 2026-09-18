/**
 * Clasificación de errores de CLI/agente (doc §11, FR-14).
 *
 * Sólo se reintentan errores transitorios confirmados. Autenticación,
 * permisos, cuota, petición inválida y schema inválido exigen intervención.
 */

export const ERROR_CLASSES = [
  'preflight',
  'auth',
  'rate_limit',
  'network',
  'timeout',
  'process_exit',
  'schema_invalid',
  'permission',
  'quota',
  'invalid_request',
  'cancelled',
  'unknown',
] as const;
export type ErrorClass = (typeof ERROR_CLASSES)[number];

/** Clases transitorias reintentables (doc §11.5, Dependencies). */
const TRANSIENT: readonly ErrorClass[] = ['rate_limit', 'network', 'timeout'];

export function isTransient(errorClass: ErrorClass): boolean {
  return TRANSIENT.includes(errorClass);
}

export interface ClassifyInput {
  readonly preflightFailed?: boolean;
  readonly timedOut?: boolean;
  readonly cancelled?: boolean;
  readonly spawnError?: string | null;
  readonly exitCode?: number | null;
  readonly stderr?: string;
  readonly schemaValid?: boolean;
}

/**
 * Clasificación determinista y conservadora: ante duda devuelve una clase
 * no transitoria para evitar reintentos ciegos.
 */
export function classifyError(input: ClassifyInput): ErrorClass {
  if (input.preflightFailed === true) {
    return 'preflight';
  }
  if (input.cancelled === true) {
    return 'cancelled';
  }
  if (input.timedOut === true) {
    return 'timeout';
  }
  if (typeof input.spawnError === 'string' && input.spawnError.length > 0) {
    if (/ENOENT/i.test(input.spawnError)) {
      return 'preflight';
    }
    if (/EACCES|EPERM/i.test(input.spawnError)) {
      return 'permission';
    }
    return 'process_exit';
  }

  const stderr = (input.stderr ?? '').toLowerCase();

  if (/rate.?limit|too many requests|\b429\b|overloaded/.test(stderr)) {
    return 'rate_limit';
  }
  if (/unauthenticated|unauthorized|not logged in|login required|invalid api key|\b401\b|\b403\b/.test(stderr)) {
    return 'auth';
  }
  if (/quota|credit balance|insufficient funds|billing/.test(stderr)) {
    return 'quota';
  }
  if (/econnreset|enotfound|etimedout|econnrefused|network error|socket hang up|\b5\d{2}\b/.test(stderr)) {
    return 'network';
  }
  if (/permission denied|eacces|eperm/.test(stderr)) {
    return 'permission';
  }
  if (/invalid request|bad request|\b400\b|unknown option|unrecognized argument/.test(stderr)) {
    return 'invalid_request';
  }
  if (input.schemaValid === false) {
    return 'schema_invalid';
  }
  if (typeof input.exitCode === 'number' && input.exitCode !== 0) {
    return 'process_exit';
  }
  return 'unknown';
}

export interface RetryDecision {
  readonly retry: boolean;
  readonly reason: string;
  readonly backoffMs: number;
}

/** Backoff exponencial acotado; nunca reintenta clases no transitorias. */
export function decideRetry(
  errorClass: ErrorClass,
  attemptsSoFar: number,
  maxRetries: number,
): RetryDecision {
  if (!isTransient(errorClass)) {
    return { retry: false, reason: 'clase_no_transitoria:' + errorClass, backoffMs: 0 };
  }
  if (attemptsSoFar >= maxRetries) {
    return { retry: false, reason: 'maximo_de_reintentos_alcanzado', backoffMs: 0 };
  }
  return {
    retry: true,
    reason: 'error_transitorio:' + errorClass,
    backoffMs: Math.min(30_000, 1_000 * 2 ** attemptsSoFar),
  };
}

/** Error de dominio del Orchestrator: mensaje estable y sin datos sensibles. */
export class OrchestratorError extends Error {
  readonly code: string;
  readonly detail: readonly string[];

  constructor(code: string, message: string, detail: readonly string[] = []) {
    super(message);
    this.name = 'OrchestratorError';
    this.code = code;
    this.detail = detail;
  }
}
