import {
  asObject,
  CARE_LIMITS,
  CareValidationError,
  onlyFields,
  optionalText,
  optionalUuid,
  requiredCode,
  requiredInteger,
  requiredPastInstant,
  requiredText,
  requiredUuid,
} from '../care-context/care-request';

import {
  type AmendmentInput,
  type CareObservableOption,
  type CareValueType,
  type ObservableInput,
  type RecordInput,
  type RecordObservationInput,
} from './care-records.contract';

/**
 * Lectura estricta de los cuerpos de bitácora (SPEC 055 / MP02). Los campos no
 * previstos se rechazan, de modo que actor, fuente, tenant, organización,
 * paciente, recepción o severidad no pueden llegar desde el cliente.
 */

const VALUE_TYPES: readonly CareValueType[] = ['BOOLEAN', 'NUMBER', 'CHOICE'];

export function parseObservableInput(body: unknown): ObservableInput {
  const input = asObject(body);
  onlyFields(input, ['idempotencyKey', 'code', 'label', 'valueType', 'unit', 'options']);

  const valueType = input['valueType'];
  if (typeof valueType !== 'string' || !VALUE_TYPES.includes(valueType as CareValueType)) {
    throw new CareValidationError('valueType', 'Elija el tipo de respuesta.');
  }
  const type = valueType as CareValueType;

  const unit = optionalText(input, 'unit', CARE_LIMITS.codeMax);
  if (unit !== null && type !== 'NUMBER') {
    throw new CareValidationError('unit', 'Solo un dato numérico lleva unidad.');
  }

  return {
    idempotencyKey: requiredUuid(input, 'idempotencyKey'),
    code: requiredCode(input, 'code'),
    label: requiredText(input, 'label', CARE_LIMITS.labelMax),
    valueType: type,
    unit,
    options: type === 'CHOICE' ? parseOptions(input['options']) : noOptions(input['options']),
  };
}

function noOptions(value: unknown): null {
  if (value !== undefined && value !== null) {
    throw new CareValidationError('options', 'Solo una respuesta de opción lleva opciones.');
  }
  return null;
}

function parseOptions(value: unknown): readonly CareObservableOption[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > CARE_LIMITS.optionsMax) {
    throw new CareValidationError('options', `Indique entre 1 y ${CARE_LIMITS.optionsMax} opciones.`);
  }

  const codes = new Set<string>();

  return value.map((raw, index) => {
    const option = asObject(raw);
    onlyFields(option, ['code', 'label']);
    const code = requiredCode(option, 'code');
    if (codes.has(code)) {
      throw new CareValidationError(`options.${index}.code`, 'Cada opción necesita un código distinto.');
    }
    codes.add(code);
    return { code, label: requiredText(option, 'label', CARE_LIMITS.labelMax) };
  });
}

export function parseRecordInput(body: unknown, now: Date): RecordInput {
  const input = asObject(body);
  onlyFields(input, ['idempotencyKey', 'occurredAt', 'note', 'observations']);

  const rawObservations = input['observations'] ?? [];
  if (!Array.isArray(rawObservations) || rawObservations.length > CARE_LIMITS.observationsMax) {
    throw new CareValidationError('observations', `Envíe hasta ${CARE_LIMITS.observationsMax} datos por registro.`);
  }

  const observations: RecordObservationInput[] = rawObservations.map((raw, index) => {
    const item = asObject(raw);
    onlyFields(item, ['definitionId', 'value', 'occurrenceKey', 'canonicalObservationId']);
    if (!('value' in item)) {
      throw new CareValidationError(`observations.${index}.value`, 'Falta la respuesta.');
    }
    return {
      definitionId: requiredUuid(item, 'definitionId'),
      value: item['value'],
      occurrenceKey: optionalUuid(item, 'occurrenceKey'),
      canonicalObservationId: optionalUuid(item, 'canonicalObservationId'),
    };
  });

  const note = optionalText(input, 'note', CARE_LIMITS.noteMax);

  if (note === null && observations.length === 0) {
    throw new CareValidationError('note', 'Escriba una nota o registre al menos un dato.');
  }

  return {
    idempotencyKey: requiredUuid(input, 'idempotencyKey'),
    occurredAt: requiredPastInstant(input, 'occurredAt', now),
    note,
    observations,
  };
}

export function parseAmendmentInput(body: unknown): AmendmentInput {
  const input = asObject(body);
  onlyFields(input, ['idempotencyKey', 'expectedSequence', 'observationId', 'replacement', 'note', 'reason']);

  const replacement = input['replacement'];
  // El tipo exacto lo valida el servicio contra la definición del dato.
  if (replacement !== undefined && typeof replacement !== 'boolean' && typeof replacement !== 'string') {
    throw new CareValidationError('replacement', 'El valor corregido no es válido.');
  }

  return {
    idempotencyKey: requiredUuid(input, 'idempotencyKey'),
    expectedSequence: requiredInteger(input, 'expectedSequence', 0),
    observationId: optionalUuid(input, 'observationId'),
    replacement,
    note: optionalText(input, 'note', CARE_LIMITS.noteMax),
    reason: requiredText(input, 'reason', CARE_LIMITS.noteMax),
  };
}
