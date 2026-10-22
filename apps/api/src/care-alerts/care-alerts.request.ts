import {
  asObject,
  CARE_LIMITS,
  CareValidationError,
  onlyFields,
  optionalText,
  requiredInteger,
  requiredUuid,
} from '../care-context/care-request';

import { ALARM_SEVERITIES, type CareAlarmSeverity, REVIEWER_ACTIONS, type ReviewerAction } from './care-alarm-transitions';
import {
  MANUAL_REASON_CODES,
  type ManualAlarmInput,
  type ManualReasonCode,
  type ResolutionReportInput,
  type TransitionInput,
} from './care-alerts.contract';

/**
 * Lectura estricta de los cuerpos de alarmas (SPEC 055 / MP03). Al crear una
 * manual NO se aceptan severidad, estado, actor, tenant ni paciente: cualquier
 * campo no previsto se rechaza.
 */

export function parseManualAlarmInput(body: unknown): ManualAlarmInput {
  const input = asObject(body);
  onlyFields(input, ['idempotencyKey', 'reasonCode', 'note']);

  const reasonCode = input['reasonCode'] ?? 'REQUEST_REVIEW';
  if (typeof reasonCode !== 'string' || !MANUAL_REASON_CODES.includes(reasonCode as ManualReasonCode)) {
    throw new CareValidationError('reasonCode', 'El motivo de la solicitud no es válido.');
  }

  return {
    idempotencyKey: requiredUuid(input, 'idempotencyKey'),
    reasonCode: reasonCode as ManualReasonCode,
    note: optionalText(input, 'note', CARE_LIMITS.noteMax),
  };
}

export function parseTransitionInput(body: unknown): TransitionInput {
  const input = asObject(body);
  onlyFields(input, ['action', 'expectedVersion', 'reason', 'severity', 'assignee']);

  const action = input['action'];
  if (typeof action !== 'string' || !REVIEWER_ACTIONS.includes(action as ReviewerAction)) {
    throw new CareValidationError('action', 'La acción no es válida.');
  }

  const severity = input['severity'];
  if (severity !== undefined && (typeof severity !== 'string' || !ALARM_SEVERITIES.includes(severity as CareAlarmSeverity))) {
    throw new CareValidationError('severity', 'La clasificación no es válida.');
  }
  if (severity !== undefined && action !== 'CLASSIFY') {
    throw new CareValidationError('severity', 'Solo la acción de clasificar cambia la clasificación.');
  }

  const assignee = input['assignee'];
  let parsedAssignee: string | undefined;
  if (assignee !== undefined) {
    if (action !== 'ASSIGN') {
      throw new CareValidationError('assignee', 'Solo la acción de asignar cambia la asignación.');
    }
    parsedAssignee = assignee === 'self' ? 'self' : requiredUuid(input, 'assignee');
  }

  return {
    action: action as ReviewerAction,
    expectedVersion: requiredInteger(input, 'expectedVersion', 1),
    reason: optionalText(input, 'reason', CARE_LIMITS.noteMax),
    ...(severity === undefined ? {} : { severity: severity as CareAlarmSeverity }),
    ...(parsedAssignee === undefined ? {} : { assignee: parsedAssignee }),
  };
}

export function parseResolutionReportInput(body: unknown): ResolutionReportInput {
  const input = asObject(body);
  onlyFields(input, ['idempotencyKey', 'note']);

  return {
    idempotencyKey: requiredUuid(input, 'idempotencyKey'),
    note: optionalText(input, 'note', CARE_LIMITS.noteMax),
  };
}
