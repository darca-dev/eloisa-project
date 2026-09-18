/**
 * Contadores y límites de consumo (doc §10, AD-13, FR-12, AC-08).
 *
 * Los contadores viven en la base local y NO se reinician al abrir una
 * sesión limpia de contexto.
 */

import { LIMITS } from '../config.ts';

export interface BudgetCounters {
  /** Invocaciones a Claude Code para esta Task. */
  readonly claudeInvocations: number;
  /**
   * Total histórico de invocaciones AI (Codex + Claude) de la Task.
   * Nunca se reinicia: es evidencia de auditoría.
   */
  readonly aiInvocations: number;
  /**
   * Ventana actual de invocaciones AI desde la última intervención del
   * Product Owner. Es la que gobierna el tope de 6 (AD-13).
   */
  readonly aiInvocationsWindow: number;
  /** Ciclos consecutivos sin progreso verificable. */
  readonly cyclesWithoutProgress: number;
  /** Reintentos transitorios de la invocación en curso. */
  readonly transientRetries: number;
}

export function emptyCounters(): BudgetCounters {
  return {
    claudeInvocations: 0,
    aiInvocations: 0,
    aiInvocationsWindow: 0,
    cyclesWithoutProgress: 0,
    transientRetries: 0,
  };
}

export type BudgetOutcome = 'ok' | 'BUDGET_LIMIT' | 'LOOP_DETECTED';

export interface BudgetAssessment {
  readonly outcome: BudgetOutcome;
  readonly allowed: boolean;
  readonly reason?: string;
  readonly detail?: string;
}

export interface BudgetQuery {
  readonly counters: BudgetCounters;
  /** Agente que se pretende invocar. */
  readonly agent: 'codex' | 'claude';
}

/**
 * ¿Se puede realizar una invocación más?
 * Devuelve el estado exacto al que hay que mover el flujo cuando no.
 */
export function assessBudget(query: BudgetQuery): BudgetAssessment {
  const c = query.counters;

  if (c.cyclesWithoutProgress >= LIMITS.maxCyclesWithoutProgress) {
    return {
      outcome: 'LOOP_DETECTED',
      allowed: false,
      reason: 'ciclos_sin_progreso',
      detail: String(c.cyclesWithoutProgress) + '/' + String(LIMITS.maxCyclesWithoutProgress),
    };
  }

  if (query.agent === 'claude' && c.claudeInvocations >= LIMITS.maxClaudeInvocationsPerTask) {
    return {
      outcome: 'BUDGET_LIMIT',
      allowed: false,
      reason: 'maximo_invocaciones_claude',
      detail: String(c.claudeInvocations) + '/' + String(LIMITS.maxClaudeInvocationsPerTask),
    };
  }

  // El tope de 6 aplica a la ventana desde la última intervención del
  // Product Owner, no al total histórico (corrección de auditoría §6).
  if (c.aiInvocationsWindow >= LIMITS.maxAiInvocationsBeforeProductOwner) {
    return {
      outcome: 'BUDGET_LIMIT',
      allowed: false,
      reason: 'maximo_invocaciones_ai',
      detail: String(c.aiInvocationsWindow) + '/' + String(LIMITS.maxAiInvocationsBeforeProductOwner),
    };
  }

  if (c.transientRetries > LIMITS.maxTransientRetriesPerInvocation) {
    return {
      outcome: 'BUDGET_LIMIT',
      allowed: false,
      reason: 'maximo_reintentos_transitorios',
      detail: String(c.transientRetries) + '/' + String(LIMITS.maxTransientRetriesPerInvocation),
    };
  }

  return { outcome: 'ok', allowed: true };
}

export type ContextPressure = 'ok' | 'warning' | 'hard_limit';

export interface ContextAssessment {
  readonly pressure: ContextPressure;
  readonly chars: number;
  /** Obliga a checkpoint y sesión limpia sin reiniciar contadores. */
  readonly requiresCleanSession: boolean;
  readonly message?: string;
}

export function assessContext(chars: number): ContextAssessment {
  if (chars >= LIMITS.contextHardLimitChars) {
    return {
      pressure: 'hard_limit',
      chars,
      requiresCleanSession: true,
      message: 'El contexto supera el límite duro; se reinicia la sesión conservando los contadores.',
    };
  }
  if (chars >= LIMITS.contextSoftLimitChars) {
    return {
      pressure: 'warning',
      chars,
      requiresCleanSession: false,
      message: 'El contexto se está haciendo grande.',
    };
  }
  return { pressure: 'ok', chars, requiresCleanSession: false };
}
