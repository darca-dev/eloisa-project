import { describe, expect, it } from 'vitest';

import { type DeclarablePopulationCode } from './enrollment.contract';
import {
  OLDER_ADULT_THRESHOLD_YEARS,
  deriveAgeInYears,
  derivePopulations,
  parseIsoCalendarDate,
  toUtcMidnight,
} from './population-derivation';

/**
 * Edad derivada y pertenencias poblacionales
 * (TASK-MVP-CORE-01 §12, unidades 2 y 3).
 */

const HOY = new Date(Date.UTC(2026, 7, 21));

function fecha(iso: string): Date {
  const calendar = parseIsoCalendarDate(iso);
  if (calendar === null) {
    throw new Error(`Fecha de prueba inválida: ${iso}`);
  }
  return toUtcMidnight(calendar);
}

describe('parseIsoCalendarDate', () => {
  it('acepta una fecha real', () => {
    expect(parseIsoCalendarDate('1958-04-12')).toStrictEqual({
      year: 1958,
      month: 4,
      day: 12,
    });
  });

  it('rechaza una fecha inexistente del calendario', () => {
    expect(parseIsoCalendarDate('2025-02-30')).toBeNull();
    expect(parseIsoCalendarDate('2025-13-01')).toBeNull();
    expect(parseIsoCalendarDate('2025-00-10')).toBeNull();
  });

  it('acepta el 29 de febrero solo en año bisiesto', () => {
    expect(parseIsoCalendarDate('2024-02-29')).not.toBeNull();
    expect(parseIsoCalendarDate('2025-02-29')).toBeNull();
  });

  it('rechaza formatos que no son AAAA-MM-DD', () => {
    for (const value of ['12/04/1958', '1958-4-12', '1958-04-12T00:00:00', '', 'ayer']) {
      expect(parseIsoCalendarDate(value)).toBeNull();
    }
  });
});

describe('deriveAgeInYears', () => {
  it('el día del cumpleaños ya cuenta como año cumplido', () => {
    expect(deriveAgeInYears(fecha('1966-08-21'), HOY)).toBe(60);
  });

  it('un día antes del cumpleaños todavía no cuenta', () => {
    expect(deriveAgeInYears(fecha('1966-08-22'), HOY)).toBe(59);
  });

  it('un día después del cumpleaños ya cuenta', () => {
    expect(deriveAgeInYears(fecha('1966-08-20'), HOY)).toBe(60);
  });

  it('devuelve una edad negativa para una fecha futura', () => {
    expect(deriveAgeInYears(fecha('2027-01-01'), HOY)).toBeLessThan(0);
  });

  it('resuelve correctamente un nacimiento del 29 de febrero', () => {
    // A 21 de agosto de 2026, quien nació el 29/02/2000 ya cumplió 26.
    expect(deriveAgeInYears(fecha('2000-02-29'), HOY)).toBe(26);
  });
});

describe('derivePopulations', () => {
  it('deriva la persona mayor exclusivamente desde la fecha de nacimiento', () => {
    const derivadas = derivePopulations(fecha('1950-01-01'), HOY, []);

    expect(derivadas).toStrictEqual([
      { populationType: 'OLDER_ADULT_60_PLUS', source: 'DERIVED_BIRTH_DATE' },
    ]);
  });

  it('aplica el umbral aprobado de 60 años cumplidos', () => {
    expect(OLDER_ADULT_THRESHOLD_YEARS).toBe(60);

    const justoEnElUmbral = derivePopulations(fecha('1966-08-21'), HOY, []);
    const unDiaAntes = derivePopulations(fecha('1966-08-22'), HOY, []);

    expect(justoEnElUmbral).toHaveLength(1);
    expect(unDiaAntes).toHaveLength(0);
  });

  it('marca como declaradas la discapacidad y el cuidado en casa', () => {
    const derivadas = derivePopulations(fecha('1990-05-05'), HOY, [
      'DISABILITY',
      'HOME_CARE_REQUIRED',
    ]);

    expect(derivadas).toStrictEqual([
      { populationType: 'DISABILITY', source: 'DECLARED' },
      { populationType: 'HOME_CARE_REQUIRED', source: 'DECLARED' },
    ]);
  });

  it('no duplica una población declarada dos veces', () => {
    const derivadas = derivePopulations(fecha('1990-05-05'), HOY, [
      'DISABILITY',
      'DISABILITY',
    ]);

    expect(derivadas).toHaveLength(1);
  });

  it('produce las siete combinaciones no vacías de las tres poblaciones', () => {
    const mayor = fecha('1950-01-01');
    const menor = fecha('1990-05-05');
    const D: DeclarablePopulationCode[] = ['DISABILITY'];
    const H: DeclarablePopulationCode[] = ['HOME_CARE_REQUIRED'];
    const DH: DeclarablePopulationCode[] = ['DISABILITY', 'HOME_CARE_REQUIRED'];

    const casos: readonly (readonly [Date, DeclarablePopulationCode[], string[]])[] = [
      [mayor, [], ['OLDER_ADULT_60_PLUS']],
      [menor, D, ['DISABILITY']],
      [menor, H, ['HOME_CARE_REQUIRED']],
      [mayor, D, ['OLDER_ADULT_60_PLUS', 'DISABILITY']],
      [mayor, H, ['OLDER_ADULT_60_PLUS', 'HOME_CARE_REQUIRED']],
      [menor, DH, ['DISABILITY', 'HOME_CARE_REQUIRED']],
      [
        mayor,
        DH,
        ['OLDER_ADULT_60_PLUS', 'DISABILITY', 'HOME_CARE_REQUIRED'],
      ],
    ];

    expect(casos).toHaveLength(7);

    for (const [nacimiento, declaradas, esperado] of casos) {
      const derivadas = derivePopulations(nacimiento, HOY, declaradas);
      expect(derivadas.map((entrada) => entrada.populationType)).toStrictEqual(esperado);
    }
  });

  it('devuelve una lista vacía cuando no hay ninguna pertenencia', () => {
    expect(derivePopulations(fecha('1990-05-05'), HOY, [])).toStrictEqual([]);
  });
});
