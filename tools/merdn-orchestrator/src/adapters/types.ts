/**
 * Contrato común de los adapters de agentes (FR-04, FR-05, FR-20, AC-13).
 *
 * Todos los adapters: proceso no interactivo, `cwd` fijo, timeout,
 * cancelación, salida estructurada validada y redactada.
 */

import type { ErrorClass } from '../domain/errors.ts';

export interface PreflightResult {
  readonly ok: boolean;
  /** Nombre lógico del binario esperado. */
  readonly binary: string;
  readonly version: string | null;
  /**
   * Estado de autenticación. `unknown` cuando el CLI no lo expone:
   * no se inventa ni se leen archivos de credenciales.
   */
  readonly authenticated: boolean | 'unknown';
  readonly errorClass: ErrorClass | null;
  readonly reason?: string;
  /** Mensaje en lenguaje natural para el panel. */
  readonly message?: string;
}

export type AgentPhase = 'analisis' | 'task' | 'implementacion' | 'review' | 'correccion';

export interface AgentRequest {
  readonly runId: string;
  readonly phase: AgentPhase;
  /** Context pack mínimo ya construido y redactado. */
  readonly context: string;
  readonly taskHash: string | null;
  /** Sesión exacta a reanudar; nunca "la última". */
  readonly sessionId: string | null;
  readonly timeoutMs: number;
  readonly maxTurns: number;
  readonly allowedPaths: readonly string[];
  readonly signal?: AbortSignal;
}

export interface ReportedFile {
  readonly path: string;
  readonly changeType: 'creado' | 'modificado' | 'eliminado';
}

export interface ReportedTest {
  readonly name: string;
  readonly command: string | null;
  readonly result: 'pass' | 'fail' | 'not_run';
}

export interface ReportedFinding {
  readonly code: string;
  readonly severity: 'alta' | 'media' | 'baja';
  readonly material: boolean;
  readonly inScope: boolean;
  readonly summary: string;
}

/** Salida estructurada normalizada, común a Codex y Claude. */
export interface AgentOutput {
  readonly summary: string;
  readonly files: readonly ReportedFile[];
  readonly tests: readonly ReportedTest[];
  readonly findings: readonly ReportedFinding[];
  /** Preguntas o decisiones materiales que el agente devuelve al Product Owner. */
  readonly materialQuestions: readonly string[];
  readonly newDependencies: readonly string[];
  readonly verdict: 'PASS' | 'CHANGES_REQUIRED' | 'BLOCKED' | null;
  readonly readyForClaude: boolean | null;
  readonly stopConditions: readonly string[];
  /** Tokens/costo sólo si el CLI los reporta; nunca inventados (AC-12). */
  readonly usage: { readonly reported: boolean; readonly detail: string | null };
}

export interface AgentInvocationResult {
  readonly ok: boolean;
  readonly agent: string;
  readonly phase: AgentPhase;
  readonly sessionId: string | null;
  readonly command: string;
  readonly exitCode: number | null;
  readonly errorClass: ErrorClass | null;
  readonly transient: boolean;
  readonly output: AgentOutput | null;
  /** Resumen redactado y truncado de la salida cruda. */
  readonly rawSummary: string;
  readonly durationMs: number;
}

export interface AgentAdapter {
  readonly name: 'codex' | 'claude' | 'openai_product_assistant';
  preflight(): Promise<PreflightResult>;
  run(request: AgentRequest): Promise<AgentInvocationResult>;
}
