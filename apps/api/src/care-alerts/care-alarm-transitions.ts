/**
 * Máquina de estados de una alarma de cuidado (SPEC 055 / MP03, D06).
 *
 * Estado, severidad y asignación son ejes SEPARADOS. Ninguna acción baja la
 * severidad por sí sola ni cierra una alarma porque se corrija un registro.
 * Esta función es pura: no consulta la base ni decide permisos; el servicio
 * exige REVIEW_ALARMS con competencia antes de aplicarla.
 */

export type CareAlarmState = 'NUEVA' | 'EN_GESTION' | 'RESUELTA' | 'CERRADA';
export type CareAlarmSeverity = 'ROJA' | 'AMARILLA' | 'ESTABLE';
export type ReviewerAction = 'ACKNOWLEDGE' | 'CLASSIFY' | 'ASSIGN' | 'RESOLVE' | 'CLOSE' | 'REOPEN';

export const REVIEWER_ACTIONS: readonly ReviewerAction[] = [
  'ACKNOWLEDGE',
  'CLASSIFY',
  'ASSIGN',
  'RESOLVE',
  'CLOSE',
  'REOPEN',
];

export const ALARM_SEVERITIES: readonly CareAlarmSeverity[] = ['ROJA', 'AMARILLA', 'ESTABLE'];

/** Acciones que exigen un motivo escrito. */
export const ACTIONS_REQUIRING_REASON: readonly ReviewerAction[] = ['RESOLVE', 'CLOSE', 'REOPEN', 'CLASSIFY'];

export interface AlarmSnapshot {
  readonly state: CareAlarmState;
  readonly severity: CareAlarmSeverity | null;
  readonly assignedReviewerHumanAccountId: string | null;
}

export interface TransitionRequest {
  readonly action: ReviewerAction;
  readonly severity?: CareAlarmSeverity;
  readonly assigneeHumanAccountId?: string;
  readonly reason: string | null;
}

export type TransitionOutcome =
  | { readonly ok: true; readonly next: AlarmSnapshot; readonly resolvedNow: boolean; readonly closedNow: boolean }
  | { readonly ok: false; readonly reason: 'STATE' | 'REASON_REQUIRED' | 'SEVERITY_REQUIRED' | 'ASSIGNEE_REQUIRED' };

export function applyTransition(current: AlarmSnapshot, request: TransitionRequest): TransitionOutcome {
  if (ACTIONS_REQUIRING_REASON.includes(request.action) && (request.reason === null || request.reason.trim() === '')) {
    return { ok: false, reason: 'REASON_REQUIRED' };
  }

  const same = { resolvedNow: false, closedNow: false };

  switch (request.action) {
    case 'ACKNOWLEDGE':
      return current.state === 'NUEVA'
        ? { ok: true, next: { ...current, state: 'EN_GESTION' }, ...same }
        : { ok: false, reason: 'STATE' };

    case 'CLASSIFY':
      if (request.severity === undefined) {
        return { ok: false, reason: 'SEVERITY_REQUIRED' };
      }
      return current.state === 'CERRADA'
        ? { ok: false, reason: 'STATE' }
        : { ok: true, next: { ...current, severity: request.severity }, ...same };

    case 'ASSIGN':
      if (request.assigneeHumanAccountId === undefined) {
        return { ok: false, reason: 'ASSIGNEE_REQUIRED' };
      }
      return current.state === 'CERRADA'
        ? { ok: false, reason: 'STATE' }
        : { ok: true, next: { ...current, assignedReviewerHumanAccountId: request.assigneeHumanAccountId }, ...same };

    case 'RESOLVE':
      return current.state === 'NUEVA' || current.state === 'EN_GESTION'
        ? { ok: true, next: { ...current, state: 'RESUELTA' }, resolvedNow: true, closedNow: false }
        : { ok: false, reason: 'STATE' };

    case 'CLOSE':
      return current.state === 'RESUELTA'
        ? { ok: true, next: { ...current, state: 'CERRADA' }, resolvedNow: false, closedNow: true }
        : { ok: false, reason: 'STATE' };

    case 'REOPEN':
      return current.state === 'RESUELTA' || current.state === 'CERRADA'
        ? { ok: true, next: { ...current, state: 'EN_GESTION' }, ...same }
        : { ok: false, reason: 'STATE' };
  }
}
