/**
 * Derivación de edad y de pertenencias poblacionales
 * (TASK-MVP-CORE-01 §4, §7, decisión cerrada 18.5).
 *
 * Reglas:
 * - la edad NUNCA se persiste: se calcula desde la fecha de nacimiento;
 * - `OLDER_ADULT_60_PLUS` la deriva EXCLUSIVAMENTE el servidor cuando la edad
 *   cumplida es mayor o igual a 60 años; el cliente no es autoridad;
 * - `DISABILITY` y `HOME_CARE_REQUIRED` provienen de datos declarados y NO son
 *   diagnósticos, certificaciones ni inferencias clínicas;
 * - las tres pertenencias son independientes y no excluyentes: las siete
 *   combinaciones no vacías son válidas.
 */

import {
  type DeclarablePopulationCode,
  type PopulationCode,
  type PopulationSourceCode,
} from './enrollment.contract';

/** Umbral aprobado de persona mayor. */
export const OLDER_ADULT_THRESHOLD_YEARS = 60;

/** Edad máxima admitida para considerar plausible una fecha de nacimiento. */
export const MAX_PLAUSIBLE_AGE_YEARS = 130;

export interface DerivedPopulation {
  readonly populationType: PopulationCode;
  readonly source: PopulationSourceCode;
}

/**
 * Convierte una fecha ISO `AAAA-MM-DD` en sus componentes de calendario.
 * Devuelve `null` cuando la cadena no es una fecha real (por ejemplo
 * `2025-02-30`), sin depender de la zona horaria del proceso.
 */
export function parseIsoCalendarDate(
  value: string,
): { readonly year: number; readonly month: number; readonly day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value.trim());
  if (match === null) {
    return null;
  }

  const year = Number.parseInt(match[1]!, 10);
  const month = Number.parseInt(match[2]!, 10);
  const day = Number.parseInt(match[3]!, 10);

  const asUtc = new Date(Date.UTC(year, month - 1, day));
  if (
    asUtc.getUTCFullYear() !== year ||
    asUtc.getUTCMonth() !== month - 1 ||
    asUtc.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
}

/**
 * Fecha de nacimiento como instante UTC a medianoche. Se usa UTC de forma
 * consistente para que la fecha almacenada no se desplace según la zona horaria
 * del servidor.
 */
export function toUtcMidnight(value: {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}): Date {
  return new Date(Date.UTC(value.year, value.month - 1, value.day));
}

/**
 * Edad cumplida entre la fecha de nacimiento y la fecha de corte, ambas
 * interpretadas en UTC. El día del cumpleaños ya cuenta como año cumplido.
 */
export function deriveAgeInYears(birthDate: Date, referenceDate: Date): number {
  let age = referenceDate.getUTCFullYear() - birthDate.getUTCFullYear();

  const monthDelta = referenceDate.getUTCMonth() - birthDate.getUTCMonth();
  const dayDelta = referenceDate.getUTCDate() - birthDate.getUTCDate();

  if (monthDelta < 0 || (monthDelta === 0 && dayDelta < 0)) {
    age -= 1;
  }

  return age;
}

/**
 * Construye la lista de pertenencias poblacionales de una inscripción.
 *
 * El orden es estable —derivada primero, declaradas después en el orden del
 * catálogo— para que las respuestas y las pruebas sean deterministas.
 */
export function derivePopulations(
  birthDate: Date,
  referenceDate: Date,
  declared: readonly DeclarablePopulationCode[],
): readonly DerivedPopulation[] {
  const populations: DerivedPopulation[] = [];

  if (deriveAgeInYears(birthDate, referenceDate) >= OLDER_ADULT_THRESHOLD_YEARS) {
    populations.push({
      populationType: 'OLDER_ADULT_60_PLUS',
      source: 'DERIVED_BIRTH_DATE',
    });
  }

  const unique = new Set(declared);
  for (const code of ['DISABILITY', 'HOME_CARE_REQUIRED'] as const) {
    if (unique.has(code)) {
      populations.push({ populationType: code, source: 'DECLARED' });
    }
  }

  return populations;
}
