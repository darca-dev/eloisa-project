import {
  asObject,
  CARE_LIMITS,
  CareValidationError,
  onlyFields,
  optionalUuid,
  requiredCode,
  requiredText,
  requiredUuid,
} from '../care-context/care-request';

import { type CriterionInput, type Severity } from './care-criteria.contract';
import { type Comparator } from './criterion-evaluator';

/**
 * Lectura estricta de un criterio (SPEC 055 / MP04). Sin predeterminados: si
 * falta un valor, el criterio no se crea. Los rangos son límites TÉCNICOS.
 */

const COMPARATORS: readonly Comparator[] = ['EQ', 'NEQ', 'GT', 'GTE', 'LT', 'LTE', 'IN'];
const SEVERITIES: readonly Severity[] = ['ROJA', 'AMARILLA', 'ESTABLE'];

function integerIn(body: Record<string, unknown>, field: string, min: number, max: number, message: string): number {
  const value = body[field];
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    throw new CareValidationError(field, message);
  }
  return value;
}

export function parseCriterionInput(body: unknown, now: Date): CriterionInput {
  const input = asObject(body);
  onlyFields(input, [
    'idempotencyKey',
    'criterionId',
    'observableDefinitionId',
    'observableCode',
    'comparator',
    'value',
    'requiredCount',
    'windowMinutes',
    'severity',
    'validUntil',
  ]);

  const comparator = input['comparator'];
  if (typeof comparator !== 'string' || !COMPARATORS.includes(comparator as Comparator)) {
    throw new CareValidationError('comparator', 'Elija la comparación.');
  }

  const severity = input['severity'];
  if (typeof severity !== 'string' || !SEVERITIES.includes(severity as Severity)) {
    throw new CareValidationError('severity', 'Elija la clasificación que tendrá la alarma.');
  }

  if (!('value' in input)) {
    throw new CareValidationError('value', 'Indique el valor con el que se compara.');
  }

  let validUntil: Date | null = null;
  if (input['validUntil'] !== undefined && input['validUntil'] !== null) {
    const raw = input['validUntil'];
    const parsed = typeof raw === 'string' && /T.*(Z|[+-]\d{2}:\d{2})$/u.test(raw) ? new Date(raw) : null;
    if (parsed === null || Number.isNaN(parsed.getTime()) || parsed.getTime() <= now.getTime()) {
      throw new CareValidationError('validUntil', 'La vigencia debe terminar en el futuro.');
    }
    validUntil = parsed;
  }

  return {
    idempotencyKey: requiredUuid(input, 'idempotencyKey'),
    criterionId: optionalUuid(input, 'criterionId'),
    observableDefinitionId: optionalUuid(input, 'observableDefinitionId'),
    observableCode: requiredCode(input, 'observableCode'),
    comparator: comparator as Comparator,
    value: input['value'],
    requiredCount: integerIn(input, 'requiredCount', 1, 1000, 'Indique cuántas veces debe ocurrir (1 a 1000).'),
    windowMinutes: integerIn(input, 'windowMinutes', 1, 525_600, 'Indique la ventana en minutos (1 a 525 600).'),
    severity: severity as Severity,
    validUntil,
  };
}

export function parseRetireInput(body: unknown): { readonly reason: string } {
  const input = asObject(body);
  onlyFields(input, ['reason']);
  return { reason: requiredText(input, 'reason', CARE_LIMITS.noteMax) };
}
