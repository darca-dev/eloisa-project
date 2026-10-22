/**
 * Contrato HTTP de bitácoras (SPEC 055 / MP02). Las vistas no incluyen
 * identificadores de cuentas ajenas, documentos ni datos de terceros: la
 * atribución se expresa como `source` y `authoredByMe`.
 */

export const CARE_BASE_PATH = 'api/v1/care';

export type CareValueType = 'BOOLEAN' | 'NUMBER' | 'CHOICE';

/** Valor mostrado: booleano, decimal como texto o código de opción. */
export type CareShownValue = boolean | string | null;

export interface CareObservableOption {
  readonly code: string;
  readonly label: string;
}

export interface CareObservableView {
  readonly id: string;
  readonly code: string;
  readonly version: number;
  readonly label: string;
  readonly valueType: CareValueType;
  readonly unit: string | null;
  readonly options: readonly CareObservableOption[] | null;
  readonly validatedAt: string;
}

export interface CareObservationView {
  readonly id: string;
  readonly definitionId: string;
  readonly code: string;
  readonly version: number;
  readonly label: string;
  readonly valueType: CareValueType;
  readonly unit: string | null;
  readonly value: CareShownValue;
  readonly occurrenceKey: string;
  readonly canonicalObservationId: string | null;
}

export interface CareAmendmentView {
  readonly id: string;
  readonly sequence: number;
  readonly observationId: string | null;
  readonly reason: string;
  readonly note: string | null;
  readonly replacement: CareShownValue;
  readonly createdAt: string;
  readonly authoredByMe: boolean;
}

export interface CareRecordView {
  readonly id: string;
  readonly source: 'PATIENT' | 'CAREGIVER' | 'PROFESSIONAL';
  readonly authoredByMe: boolean;
  readonly occurredAt: string;
  readonly receivedAt: string;
  readonly note: string | null;
  readonly observations: readonly CareObservationView[];
  readonly amendments: readonly CareAmendmentView[];
}

/** Resultado de crear un registro: la entrada y lo que hizo el motor (MP04). */
export interface CareRecordCreatedView extends CareRecordView {
  /** `null` en un reintento idéntico: el motor ya evaluó el envío original. */
  readonly evaluation: { readonly alarmsOpened: number; readonly evidenceAdded: number } | null;
}

export interface CareRecordPage {
  readonly items: readonly CareRecordView[];
  readonly nextCursor: string | null;
}

export interface ObservableInput {
  readonly idempotencyKey: string;
  readonly code: string;
  readonly label: string;
  readonly valueType: CareValueType;
  readonly unit: string | null;
  readonly options: readonly CareObservableOption[] | null;
}

export interface RecordObservationInput {
  readonly definitionId: string;
  readonly value: unknown;
  readonly occurrenceKey: string | null;
  readonly canonicalObservationId: string | null;
}

export interface RecordInput {
  readonly idempotencyKey: string;
  readonly occurredAt: Date;
  readonly note: string | null;
  readonly observations: readonly RecordObservationInput[];
}

export interface AmendmentInput {
  readonly idempotencyKey: string;
  readonly expectedSequence: number;
  readonly observationId: string | null;
  /** `undefined` cuando la enmienda es solo una nota. */
  readonly replacement: unknown;
  readonly note: string | null;
  readonly reason: string;
}
