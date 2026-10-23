import { type Comparator, type SemaphoreLevel, type ValueType } from './criterion-evaluator';

/**
 * Contrato HTTP de criterios individuales y semáforo (SPEC 055 / MP04–MP05).
 * Ningún valor tiene un predeterminado: los fija el profesional competente.
 */

export type Severity = 'ROJA' | 'AMARILLA' | 'ESTABLE';

/** Definición EXACTA citada por una versión (MP07A, A03). */
export interface CriterionDefinitionView {
  readonly id: string;
  readonly version: number;
  readonly label: string;
  readonly valueType: ValueType;
  readonly unit: string | null;
  readonly options: readonly { readonly code: string; readonly label: string }[] | null;
  readonly status: 'ACTIVE' | 'RETIRED';
}

export interface CriterionVersionView {
  readonly id: string;
  readonly version: number;
  /**
   * Definición exacta que evalúa. `null` solo en versiones anteriores a MP07A:
   * no se infiere por código y la versión no se evalúa.
   */
  readonly observableDefinition: CriterionDefinitionView | null;
  /**
   * La versión no se evalúa hasta que el visitador valide una nueva: es legado
   * sin definición exacta o su definición fue reemplazada.
   */
  readonly requiresRevalidation: boolean;
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
  /**
   * Definición exacta que el visitador vio al validar (MP07A, A03). Obligatoria
   * en toda validación nueva; si ya no es la vigente del código se responde
   * conflicto en vez de validar otra. Solo puede faltar al reproducir un recibo
   * idempotente confirmado antes de MP07A.
   */
  readonly observableDefinitionId: string | null;
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
  /** Versiones vigentes y evaluables. */
  readonly activeCriteria: number;
  /** Versiones vigentes que no se evalúan hasta revalidarse (MP07A, A03). */
  readonly criteriaRequiringRevalidation: number;
}

export const SEMAPHORE_LABELS: Readonly<Record<SemaphoreLevel, string>> = {
  ROJO: 'Rojo: hay alarmas rojas abiertas',
  AMARILLO: 'Amarillo: hay alarmas amarillas abiertas',
  PENDIENTE: 'Pendiente: hay solicitudes sin clasificar',
  ESTABLE: 'Estable: hay una clasificación estable autorizada y ninguna alarma roja, amarilla o sin clasificar abierta',
  SIN_EVALUACION: 'Sin evaluación: hay criterios, pero ninguna clasificación autorizada; esto no indica estabilidad',
  SIN_CRITERIOS: 'Sin criterios ni solicitudes: no hay evaluación automática',
};

/** Alarmas abiertas que la cola muestra como anticipo de cada contexto. */
export const REVIEW_QUEUE_ALARM_PREVIEW = 10;

/**
 * Contexto de la cola (MP07B / A06). Lleva las acciones que MP01 concede hoy
 * sobre él, igual que el directorio, para abrirlo aunque no esté en la página
 * del directorio cargada; el anticipo de alarmas NO es la bandeja completa:
 * `openAlarmCount` y `hasMoreOpenAlarms` dicen cuántas hay y si faltan.
 */
export interface ReviewQueueItem {
  readonly contextId: string;
  readonly organizationId: string;
  readonly organizationName: string;
  readonly patientLabel: string;
  readonly actorKind: 'PATIENT' | 'CAREGIVER' | 'PROFESSIONAL' | 'HOSPITAL_REVIEWER';
  readonly actions: readonly ('VIEW_RECORDS' | 'CONTRIBUTE_RECORDS' | 'REQUEST_ALARM' | 'MANAGE_RULES' | 'REVIEW_ALARMS')[];
  readonly semaphore: SemaphoreView;
  /** Alarmas no cerradas del contexto, contadas en la misma consulta del anticipo. */
  readonly openAlarmCount: number;
  /** `true` si hay alarmas abiertas que el anticipo no incluye. */
  readonly hasMoreOpenAlarms: boolean;
  /** Las abiertas más recientes, hasta `REVIEW_QUEUE_ALARM_PREVIEW`. */
  readonly alarms: readonly {
    readonly id: string;
    readonly origin: 'MANUAL' | 'AUTOMATIC';
    readonly severity: Severity | null;
    readonly state: 'NUEVA' | 'EN_GESTION' | 'RESUELTA' | 'CERRADA';
    readonly createdAt: string;
    readonly assignedToMe: boolean;
  }[];
}

export interface ReviewQueuePage {
  readonly items: readonly ReviewQueueItem[];
  /**
   * Siguiente página de CANDIDATOS. Una página puede venir vacía con cursor si
   * los candidatos examinados no conceden revisión: no es el final de la cola.
   */
  readonly nextCursor: string | null;
}
