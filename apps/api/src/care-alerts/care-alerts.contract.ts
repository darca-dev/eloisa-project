import { type CareAlarmSeverity, type CareAlarmState, type ReviewerAction } from './care-alarm-transitions';

/**
 * Contrato HTTP de alarmas (SPEC 055 / MP03). Una alarma manual nace NUEVA y
 * SIN clasificación (`severity: null` = «pendiente de clasificación»); nunca se
 * presenta como verde. La recepción no confirma atención.
 */

/** Único motivo inicial de software (D03): pedir revisión, no un diagnóstico. */
export const MANUAL_REASON_CODES = ['REQUEST_REVIEW'] as const;
export type ManualReasonCode = (typeof MANUAL_REASON_CODES)[number];

/** Texto de recepción aprobado por el Product Owner (D03). */
export const MANUAL_RECEIPT_MESSAGE =
  'Solicitud registrada para revisión. Esto no confirma que un profesional ya la haya atendido ni sustituye los canales de urgencias.';

export interface CareAlarmTransitionView {
  readonly id: string;
  readonly action: ReviewerAction | 'CREATE' | 'REPORT_RESOLUTION';
  readonly stateBefore: CareAlarmState | null;
  readonly stateAfter: CareAlarmState;
  readonly severityBefore: CareAlarmSeverity | null;
  readonly severityAfter: CareAlarmSeverity | null;
  readonly reason: string | null;
  readonly createdAt: string;
  readonly byMe: boolean;
}

export interface CareAlarmView {
  readonly id: string;
  readonly origin: 'MANUAL' | 'AUTOMATIC';
  readonly reasonCode: string;
  readonly note: string | null;
  readonly severity: CareAlarmSeverity | null;
  readonly state: CareAlarmState;
  readonly assignedToMe: boolean;
  readonly assigned: boolean;
  readonly initiatedByMe: boolean;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly resolvedAt: string | null;
  readonly closedAt: string | null;
}

/** Observación que admitió el criterio (MP04). Solo existe en alarmas automáticas. */
export interface CareAlarmEvidenceView {
  readonly label: string;
  readonly unit: string | null;
  readonly valueType: 'BOOLEAN' | 'NUMBER' | 'CHOICE';
  readonly value: boolean | string | null;
  readonly occurredAt: string;
  /** La observación se corrigió después: revisar (D04.5). */
  readonly correctedAfterwards: boolean;
}

export interface CareAlarmDetailView extends CareAlarmView {
  readonly transitions: readonly CareAlarmTransitionView[];
  readonly evidence: readonly CareAlarmEvidenceView[];
}

export interface CareAlarmPage {
  readonly items: readonly CareAlarmView[];
  readonly nextCursor: string | null;
  /** Qué puede hacer la cuenta en este contexto; lo decide el servidor. */
  readonly canReview: boolean;
}

export interface ManualAlarmCreatedView {
  readonly alarm: CareAlarmView;
  readonly receiptMessage: string;
}

export interface ManualAlarmInput {
  readonly idempotencyKey: string;
  readonly reasonCode: ManualReasonCode;
  readonly note: string | null;
}

export interface TransitionInput {
  readonly action: ReviewerAction;
  readonly expectedVersion: number;
  readonly reason: string | null;
  readonly severity?: CareAlarmSeverity;
  /** `self` asigna a la propia cuenta; si no, el UUID de otro revisor autorizado. */
  readonly assignee?: string;
}

export interface ResolutionReportInput {
  readonly idempotencyKey: string;
  readonly note: string | null;
}
