import { describe, expect, it } from 'vitest';

import {
  EXCLUSIVE_INTERSECTION_KEYS,
  MUNICIPALITY_AGGREGATE_SOURCE,
  OFFICIAL_METRIC_KEYS,
} from './municipality.contract';
import {
  type ExclusiveRegion,
  type PopulationRow,
  buildPopulationSummary,
  exclusiveRegionOf,
  isOlderAdultAt,
} from './population-summary';

/**
 * Agregación de población beneficiaria
 * (TASK-MUNICIPALITY-CORE-01, pruebas T-01, T-02, T-06 y T-09).
 *
 * Todas las personas de estas pruebas son SINTÉTICAS: solo aportan una fecha de
 * nacimiento ficticia y dos booleanos declarados.
 */

const AS_OF = new Date(Date.UTC(2026, 7, 22));
const GENERATED_AT = new Date(Date.UTC(2026, 7, 22, 14, 5, 0));

/** Nacimiento que produce la edad indicada en la fecha de corte. */
function nacimientoConEdad(anios: number): Date {
  return new Date(Date.UTC(2026 - anios, 7, 22));
}

function persona(overrides: Partial<PopulationRow> = {}): PopulationRow {
  return {
    birthDate: nacimientoConEdad(70),
    disabilityDeclared: false,
    homeCareRequiredDeclared: false,
    ...overrides,
  };
}

/** `cantidad` personas sintéticas en la región indicada. */
function personasEnRegion(region: ExclusiveRegion, cantidad: number): PopulationRow[] {
  const older = region.startsWith('older') || region === 'allThree';
  const disability =
    region === 'disabilityOnly' ||
    region === 'olderAndDisabilityOnly' ||
    region === 'disabilityAndHomeCareOnly' ||
    region === 'allThree';
  const homeCare =
    region === 'homeCareOnly' ||
    region === 'olderAndHomeCareOnly' ||
    region === 'disabilityAndHomeCareOnly' ||
    region === 'allThree';

  return Array.from({ length: cantidad }, () =>
    persona({
      birthDate: nacimientoConEdad(older ? 70 : 40),
      disabilityDeclared: disability,
      homeCareRequiredDeclared: homeCare,
    }),
  );
}

function resumen(rows: readonly PopulationRow[], pendientes = 0) {
  return buildPopulationSummary({
    rows,
    territoryPendingNormalization: pendientes,
    asOf: AS_OF,
    generatedAt: GENERATED_AT,
  });
}

describe('regiones exclusivas', () => {
  it('asigna cada combinación a exactamente una región', () => {
    expect(exclusiveRegionOf(true, false, false)).toBe('olderOnly');
    expect(exclusiveRegionOf(false, true, false)).toBe('disabilityOnly');
    expect(exclusiveRegionOf(false, false, true)).toBe('homeCareOnly');
    expect(exclusiveRegionOf(true, true, false)).toBe('olderAndDisabilityOnly');
    expect(exclusiveRegionOf(true, false, true)).toBe('olderAndHomeCareOnly');
    expect(exclusiveRegionOf(false, true, true)).toBe('disabilityAndHomeCareOnly');
    expect(exclusiveRegionOf(true, true, true)).toBe('allThree');
    expect(exclusiveRegionOf(false, false, false)).toBe('noneOfThree');
  });
});

describe('derivación de 60 años o más (T-02)', () => {
  it('cuenta a quien cumple 60 el mismo día de corte, y no el día anterior', () => {
    const cumpleHoy = new Date(Date.UTC(1966, 7, 22));

    expect(isOlderAdultAt(cumpleHoy, new Date(Date.UTC(2026, 7, 21)))).toBe(false);
    expect(isOlderAdultAt(cumpleHoy, new Date(Date.UTC(2026, 7, 22)))).toBe(true);
    expect(isOlderAdultAt(cumpleHoy, new Date(Date.UTC(2026, 7, 23)))).toBe(true);
  });

  it('usa el calendario UTC y no la hora del proceso', () => {
    const nacimiento = new Date(Date.UTC(1966, 0, 1));

    expect(isOlderAdultAt(nacimiento, new Date(Date.UTC(2025, 11, 31, 23, 59)))).toBe(false);
    expect(isOlderAdultAt(nacimiento, new Date(Date.UTC(2026, 0, 1, 0, 0)))).toBe(true);
  });

  it('trata correctamente un nacimiento del 29 de febrero', () => {
    const bisiesto = new Date(Date.UTC(2000, 1, 29));

    expect(isOlderAdultAt(bisiesto, new Date(Date.UTC(2060, 1, 28)))).toBe(false);
    expect(isOlderAdultAt(bisiesto, new Date(Date.UTC(2060, 1, 29)))).toBe(true);
  });

  it('no depende de la pertenencia persistida: solo de la fecha de nacimiento', () => {
    // Persona inscrita a los 59 años cuya membresía histórica nunca se actualizó.
    const summary = resumen([persona({ birthDate: nacimientoConEdad(60) })]);

    expect(summary.exclusiveIntersections.olderOnly.status).toBe('SUPPRESSED');
    expect(
      resumen(personasEnRegion('olderOnly', 6)).exclusiveIntersections.olderOnly,
    ).toMatchObject({ status: 'EXACT', value: 6 });
  });
});

describe('resumen de población (T-01)', () => {
  it('sin personas devuelve ceros exactos', () => {
    const summary = resumen([]);

    expect(summary.uniqueRegistered).toMatchObject({ status: 'EXACT', value: 0 });

    for (const key of EXCLUSIVE_INTERSECTION_KEYS) {
      expect(summary.exclusiveIntersections[key]).toMatchObject({
        status: 'EXACT',
        value: 0,
      });
    }
  });

  it('con una sola persona no publica ninguna cifra sensible', () => {
    const summary = resumen(personasEnRegion('allThree', 1));

    expect(summary.uniqueRegistered.status).toBe('SUPPRESSED');
    expect(summary.exclusiveIntersections.allThree.status).toBe('SUPPRESSED');
    expect(JSON.stringify(summary)).not.toContain('"value":1');
  });

  it('cuenta las siete regiones y su suma es el total de personas únicas', () => {
    const cantidades: Record<string, number> = {
      olderOnly: 11,
      disabilityOnly: 9,
      homeCareOnly: 7,
      olderAndDisabilityOnly: 13,
      olderAndHomeCareOnly: 17,
      disabilityAndHomeCareOnly: 5,
      allThree: 6,
    };

    const rows = EXCLUSIVE_INTERSECTION_KEYS.flatMap((key) =>
      personasEnRegion(key, cantidades[key] ?? 0),
    );

    const summary = resumen(rows);
    const suma = EXCLUSIVE_INTERSECTION_KEYS.reduce(
      (acumulado, key) => acumulado + (summary.exclusiveIntersections[key].value ?? 0),
      0,
    );

    expect(summary.uniqueRegistered).toMatchObject({ status: 'EXACT', value: 68 });
    expect(suma).toBe(68);

    // Cada persona cuenta UNA sola vez, aunque pertenezca a varias poblaciones.
    expect(summary.populations.olderAdult60Plus).toMatchObject({
      status: 'EXACT',
      value: 11 + 13 + 17 + 6,
    });
    expect(summary.populations.disabilityDeclared).toMatchObject({
      status: 'EXACT',
      value: 9 + 13 + 5 + 6,
    });
    expect(summary.populations.homeCareRequiredDeclared).toMatchObject({
      status: 'EXACT',
      value: 7 + 17 + 5 + 6,
    });
  });

  it('quien no declara ninguna condición cuenta en el total y en ninguna región', () => {
    const rows = [
      ...personasEnRegion('olderOnly', 10),
      ...personasEnRegion('noneOfThree', 8),
    ];

    const summary = resumen(rows);

    expect(summary.uniqueRegistered).toMatchObject({ status: 'EXACT', value: 18 });
    expect(summary.exclusiveIntersections.olderOnly).toMatchObject({
      status: 'EXACT',
      value: 10,
    });
    expect(summary.exclusiveIntersections.disabilityOnly).toMatchObject({
      status: 'EXACT',
      value: 0,
    });
  });
});

describe('procedencia, corte y métricas oficiales (T-09)', () => {
  it('declara procedencia y fechas sin identificadores', () => {
    const summary = resumen(personasEnRegion('olderOnly', 10));

    expect(summary.source).toBe(MUNICIPALITY_AGGREGATE_SOURCE);
    expect(summary.asOfDate).toBe('2026-08-22');
    expect(summary.generatedAt).toBe(GENERATED_AT.toISOString());
  });

  it('declara todas las métricas oficiales como no disponibles y nulas', () => {
    const summary = resumen(personasEnRegion('olderOnly', 10));

    expect(summary.officialMetrics.map((metric) => metric.metric)).toStrictEqual([
      ...OFFICIAL_METRIC_KEYS,
    ]);

    for (const metric of summary.officialMetrics) {
      expect(metric.status).toBe('UNAVAILABLE');
      expect(metric.value).toBeNull();
    }
  });

  it('no incluye porcentajes, cobertura ni denominadores inventados', () => {
    const serializado = JSON.stringify(resumen(personasEnRegion('olderOnly', 10)));

    expect(serializado).not.toContain('coveragePercentage');
    expect(serializado).not.toContain('percentage');
    expect(serializado).not.toContain('%');
  });

  it('publica la normalización territorial pendiente con la regla primaria', () => {
    expect(resumen([], 0).quality.territoryPendingNormalization).toMatchObject({
      status: 'EXACT',
      value: 0,
    });
    expect(resumen([], 3).quality.territoryPendingNormalization.status).toBe(
      'SUPPRESSED',
    );
    expect(resumen([], 9).quality.territoryPendingNormalization).toMatchObject({
      status: 'EXACT',
      value: 9,
    });
  });

  it('no expone identificadores, nombres ni fechas de nacimiento (T-06)', () => {
    const serializado = JSON.stringify(resumen(personasEnRegion('allThree', 12)));

    for (const prohibido of [
      'patientId',
      'personId',
      'birthDate',
      'documentNumber',
      'givenNames',
      'familyNames',
      'phone',
      'email',
      'exactAddress',
      'tenantId',
    ]) {
      expect(serializado).not.toContain(prohibido);
    }
  });
});
