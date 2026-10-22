import { type Comparator, type SemaphoreLevel, type ValueType } from './criterion-evaluator';

/**
 * Contrato HTTP de criterios individuales y semáforo (SPEC 055 / MP04–MP05).
 * Ningún valor tiene un predeterminado: los fija el profesional competente.
 */

export type Severity = 'ROJA' | 'AMARILLA' | 'ESTABLE';

export interface CriterionVersionView {
  readonly id: string;
  readonly version: number;
  readonly observableCode: string;
  readonly valueType: ValueType;
  readonly comparator: Comparator;
  readonly value: boolean | string | readonly string[];
  readonly requiredCount: number;
  readonly windowMinutes: number;
  readonly severity: Severity;
  readonly activatedAt: string;
  readonly validUntil: string | null;
  readonly status: 'ACTIVE' | 'SUPERSEDED' | 'RETIRED';
}

export interface CriterionView {
  readonly id: string;
  readonly status: 'ACTIVE' | 'RETIRED';
  readonly createdAt: string;
  readonly retiredAt: string | null;
  readonly retiredReason: string | null;
  readonly current: CriterionVersionView | null;
}

export interface CriterionInput {
  readonly idempotencyKey: string;
  readonly criterionId: string | null;
  readonly observableCode: string;
  readonly comparator: Comparator;
  readonly value: unknown;
  readonly requiredCount: number;
  readonly windowMinutes: number;
  readonly severity: Severity;
  readonly validUntil: Date | null;
}

export interface SemaphoreView {
  readonly level: SemaphoreLevel;
  /** Texto SIEMPRE presente: el color no comunica solo. */
  readonly label: string;
  readonly openAlarms: { readonly ROJA: number; readonly AMARILLA: number; readonly ESTABLE: number; readonly SIN: number };
  readonly activeCriteria: number;
}

export const SEMAPHORE_LABELS: Readonly<Record<SemaphoreLevel, string>> = {
  ROJO: 'Rojo: hay alarmas rojas abiertas',
  AMARILLO: 'Amarillo: hay alarmas amarillas abiertas',
  PENDIENTE: 'Pendiente: hay solicitudes sin clasificar',
  ESTABLE: 'Estable: criterios vigentes sin alarmas rojas ni amarillas abiertas',
  SIN_CRITERIOS: 'Sin criterios ni solicitudes: no hay evaluación automática',
};

export interface ReviewQueueItem {
  readonly contextId: string;
  readonly organizationName: string;
  readonly patientLabel: string;
  readonly semaphore: SemaphoreView;
  readonly alarms: readonly {
    readonly id: string;
    readonly origin: 'MANUAL' | 'AUTOMATIC';
    readonly severity: Severity | null;
    readonly state: 'NUEVA' | 'EN_GESTION' | 'RESUELTA' | 'CERRADA';
    readonly createdAt: string;
    readonly assignedToMe: boolean;
  }[];
}
