import { Prisma } from '../generated/prisma/client';

/**
 * Evaluador PURO de un criterio individual (SPEC 055 / MP04, D03–D05).
 *
 * No consulta la base, no decide permisos y no tiene valores por defecto: todo
 * lo que compara lo fijó el profesional competente en la versión del criterio.
 * Reglas, en este orden:
 *
 * 1. ADMISIBLE: la ocurrencia está en `[recepción − ventana, recepción]` (ambos
 *    límites inclusivos), es posterior o igual a la activación de la versión y
 *    anterior a su `validUntil` si existe. Nada futuro respecto de la recepción.
 *    Si el criterio tiene un episodio anterior CERRADO, solo cuenta lo ocurrido
 *    ESTRICTAMENTE después de ese cierre (MP07A, A04): un evento tardío anterior
 *    se conserva como registro, pero no dispara ni alimenta el episodio nuevo.
 * 2. UNA VEZ POR OCURRENCIA: observaciones con la misma `occurrenceKey` cuentan
 *    una sola vez; las no canónicas nunca llegan aquí.
 * 3. EVIDENCIA CONSUMIDA: lo ya usado por una alarma del mismo criterio no
 *    vuelve a contar para abrir otro episodio. El llamador lo decide por la
 *    identidad del evento (código del observable + `occurrenceKey`), no solo
 *    por la fila de observación.
 * 4. COINCIDE: el valor efectivo cumple la comparación estructurada.
 *
 * Se cumple cuando las coincidencias son al menos `requiredCount`.
 */

export type ValueType = 'BOOLEAN' | 'NUMBER' | 'CHOICE';
export type Comparator = 'EQ' | 'NEQ' | 'GT' | 'GTE' | 'LT' | 'LTE' | 'IN';

export interface CriterionSpec {
  readonly valueType: ValueType;
  readonly comparator: Comparator;
  readonly numberValue: string | null;
  readonly booleanValue: boolean | null;
  readonly choiceValues: readonly string[] | null;
  readonly requiredCount: number;
  readonly windowMinutes: number;
  readonly activatedAt: Date;
  readonly validUntil: Date | null;
}

export interface Candidate {
  readonly observationId: string;
  readonly occurrenceKey: string;
  readonly occurredAt: Date;
  /** Valor EFECTIVO: el original o el último reemplazo de una enmienda. */
  readonly value: boolean | string | null;
  readonly alreadyEvidence: boolean;
  readonly amended: boolean;
}

export interface Evaluation {
  readonly met: boolean;
  /** Coincidencias admisibles y no consumidas, una por ocurrencia. */
  readonly matching: readonly Candidate[];
}

/**
 * `closedBoundary` es el último `closedAt` de un episodio CERRADO del mismo
 * criterio, o `null` si nunca hubo uno.
 */
export function isAdmissible(
  spec: CriterionSpec,
  candidate: Candidate,
  receivedAt: Date,
  closedBoundary: Date | null = null,
): boolean {
  const at = candidate.occurredAt.getTime();
  const end = receivedAt.getTime();
  const start = end - spec.windowMinutes * 60_000;

  return (
    at >= start &&
    at <= end &&
    at >= spec.activatedAt.getTime() &&
    (spec.validUntil === null || at < spec.validUntil.getTime()) &&
    (closedBoundary === null || at > closedBoundary.getTime())
  );
}

export function matchesValue(spec: CriterionSpec, value: boolean | string | null): boolean {
  if (value === null) {
    return false;
  }

  if (spec.valueType === 'BOOLEAN') {
    return typeof value === 'boolean' && spec.comparator === 'EQ' && value === spec.booleanValue;
  }

  if (spec.valueType === 'CHOICE') {
    return typeof value === 'string' && spec.comparator === 'IN' && (spec.choiceValues ?? []).includes(value);
  }

  if (typeof value !== 'string' || spec.numberValue === null) {
    return false;
  }

  const comparison = new Prisma.Decimal(value).comparedTo(new Prisma.Decimal(spec.numberValue));

  switch (spec.comparator) {
    case 'EQ':
      return comparison === 0;
    case 'NEQ':
      return comparison !== 0;
    case 'GT':
      return comparison > 0;
    case 'GTE':
      return comparison >= 0;
    case 'LT':
      return comparison < 0;
    case 'LTE':
      return comparison <= 0;
    default:
      return false;
  }
}

export function evaluate(
  spec: CriterionSpec,
  candidates: readonly Candidate[],
  receivedAt: Date,
  closedBoundary: Date | null = null,
): Evaluation {
  const seen = new Set<string>();
  const matching: Candidate[] = [];

  const ordered = [...candidates].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());

  for (const candidate of ordered) {
    if (candidate.alreadyEvidence || !isAdmissible(spec, candidate, receivedAt, closedBoundary)) {
      continue;
    }
    if (seen.has(candidate.occurrenceKey)) {
      continue;
    }
    if (!matchesValue(spec, candidate.value)) {
      continue;
    }
    seen.add(candidate.occurrenceKey);
    matching.push(candidate);
  }

  return { met: matching.length >= spec.requiredCount, matching };
}

/**
 * Semáforo de UN contexto (MP05, corregido en MP07A / A01). Nunca verde por
 * falta de datos:
 *
 * - ROJO, AMARILLO y PENDIENTE siguen la prioridad de las alarmas ABIERTAS.
 * - ESTABLE exige una alarma abierta clasificada ESTABLE: por una regla
 *   validada que se cumplió o por un revisor competente. Tener criterios, no
 *   tener datos o no tener alarmas NO clasifica estabilidad.
 * - SIN_EVALUACION: hay criterios (evaluables o pendientes de revalidación),
 *   pero ninguna clasificación autorizada abierta.
 * - SIN_CRITERIOS: ni criterios ni solicitudes abiertas.
 *
 * No hay vencimiento por reloj: el nivel solo cambia con alarmas y criterios.
 */
export type SemaphoreLevel = 'ROJO' | 'AMARILLO' | 'PENDIENTE' | 'ESTABLE' | 'SIN_EVALUACION' | 'SIN_CRITERIOS';

export interface SemaphoreInput {
  readonly openBySeverity: { readonly ROJA: number; readonly AMARILLA: number; readonly ESTABLE: number; readonly SIN: number };
  /** Versiones vigentes y evaluables (con definición exacta vigente). */
  readonly activeCriteria: number;
  /** Versiones vigentes NO evaluables hasta que el visitador las revalide. */
  readonly criteriaRequiringRevalidation: number;
}

export function semaphoreLevel(input: SemaphoreInput): SemaphoreLevel {
  if (input.openBySeverity.ROJA > 0) return 'ROJO';
  if (input.openBySeverity.AMARILLA > 0) return 'AMARILLO';
  if (input.openBySeverity.SIN > 0) return 'PENDIENTE';
  if (input.openBySeverity.ESTABLE > 0) return 'ESTABLE';
  if (input.activeCriteria > 0 || input.criteriaRequiringRevalidation > 0) return 'SIN_EVALUACION';
  return 'SIN_CRITERIOS';
}
