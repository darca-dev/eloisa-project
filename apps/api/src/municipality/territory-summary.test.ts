import { describe, expect, it } from 'vitest';

import { MUNICIPALITY_AGGREGATE_SOURCE } from './municipality.contract';
import {
  PENDING_NORMALIZATION_LABEL,
  type TerritoryRow,
  buildTerritorySummary,
} from './territory-summary';

/**
 * Agregación territorial (TASK-MUNICIPALITY-CORE-01, pruebas T-06, T-07 y T-08).
 *
 * Todas las personas y todos los territorios locales de estas pruebas son
 * SINTÉTICOS. Los códigos de municipio pertenecen al catálogo oficial cargado
 * por CORE-01 y se usan solo como agrupador.
 */

const AS_OF = new Date(Date.UTC(2026, 7, 22));
const GENERATED_AT = new Date(Date.UTC(2026, 7, 22, 14, 5, 0));

function fila(overrides: Partial<TerritoryRow> = {}): TerritoryRow {
  return {
    municipalityCode: '05001',
    municipalityName: 'Medellín',
    areaType: 'URBAN',
    localUnitId: 'unidad-a',
    localUnitName: 'Barrio Ficticio A',
    birthDate: new Date(Date.UTC(1956, 3, 12)),
    disabilityDeclared: false,
    homeCareRequiredDeclared: false,
    ...overrides,
  };
}

function repetir(cantidad: number, overrides: Partial<TerritoryRow> = {}): TerritoryRow[] {
  return Array.from({ length: cantidad }, () => fila(overrides));
}

function resumen(rows: readonly TerritoryRow[]) {
  return buildTerritorySummary({ rows, asOf: AS_OF, generatedAt: GENERATED_AT });
}

describe('jerarquía territorial (T-07)', () => {
  it('agrupa por municipio, área y unidad local canónica', () => {
    const summary = resumen([
      ...repetir(12),
      ...repetir(9, { localUnitId: 'unidad-b', localUnitName: 'Barrio Ficticio B' }),
      ...repetir(7, {
        areaType: 'RURAL',
        localUnitId: 'unidad-c',
        localUnitName: 'Vereda Ficticia C',
      }),
    ]);

    expect(summary.municipalities).toHaveLength(1);

    const municipio = summary.municipalities[0]!;

    expect(municipio.officialCode).toBe('05001');
    expect(municipio.metrics.uniquePeople).toMatchObject({ status: 'EXACT', value: 28 });
    expect(municipio.areas.map((area) => area.areaType)).toStrictEqual(['URBAN', 'RURAL']);

    const urbana = municipio.areas[0]!;

    expect(urbana.metrics.uniquePeople).toMatchObject({ status: 'EXACT', value: 21 });
    expect(urbana.localUnits.map((unidad) => unidad.displayName)).toStrictEqual([
      'Barrio Ficticio A',
      'Barrio Ficticio B',
    ]);
    expect(urbana.localUnits[0]!.metrics.uniquePeople).toMatchObject({
      status: 'EXACT',
      value: 12,
    });
  });

  it('separa los pendientes de normalización sin devolver texto declarado', () => {
    const summary = resumen([
      ...repetir(10),
      ...repetir(8, { localUnitId: null, localUnitName: null }),
    ]);

    const urbana = summary.municipalities[0]!.areas[0]!;
    const pendiente = urbana.localUnits.find(
      (unidad) => unidad.kind === 'PENDING_NORMALIZATION',
    );

    expect(pendiente).toBeDefined();
    expect(pendiente?.localUnitId).toBeNull();
    expect(pendiente?.displayName).toBe(PENDING_NORMALIZATION_LABEL);
    expect(pendiente?.metrics.uniquePeople).toMatchObject({ status: 'EXACT', value: 8 });

    // El nodo de pendientes va siempre al final de su área.
    expect(urbana.localUnits.at(-1)?.kind).toBe('PENDING_NORMALIZATION');

    expect(urbana.metrics.pendingNormalization).toMatchObject({
      status: 'EXACT',
      value: 8,
    });
    expect(summary.municipalities[0]!.metrics.pendingNormalization).toMatchObject({
      status: 'EXACT',
      value: 8,
    });

    // Una unidad canónica no tiene pendientes por definición.
    expect(urbana.localUnits[0]!.metrics.pendingNormalization).toMatchObject({
      status: 'EXACT',
      value: 0,
    });
  });

  it('suma los pendientes de todas las áreas en el municipio', () => {
    const summary = resumen([
      ...repetir(6, { localUnitId: null, localUnitName: null }),
      ...repetir(9, { areaType: 'RURAL', localUnitId: null, localUnitName: null }),
    ]);

    expect(summary.municipalities[0]!.metrics.pendingNormalization).toMatchObject({
      status: 'EXACT',
      value: 15,
    });
  });

  it('ordena los municipios por su nombre de exhibición', () => {
    const summary = resumen([
      ...repetir(6, { municipalityCode: '25754', municipalityName: 'Soacha' }),
      ...repetir(6),
    ]);

    expect(summary.municipalities.map((municipio) => municipio.displayName)).toStrictEqual([
      'Medellín',
      'Soacha',
    ]);
  });
});

describe('poblaciones por nodo territorial', () => {
  it('deriva 60 años o más desde la fecha de nacimiento y cuenta las declaradas', () => {
    const summary = resumen([
      ...repetir(6, { birthDate: new Date(Date.UTC(1950, 0, 1)) }),
      ...repetir(7, {
        birthDate: new Date(Date.UTC(1995, 0, 1)),
        disabilityDeclared: true,
      }),
      ...repetir(8, {
        birthDate: new Date(Date.UTC(1995, 0, 1)),
        homeCareRequiredDeclared: true,
      }),
    ]);

    const unidad = summary.municipalities[0]!.areas[0]!.localUnits[0]!;

    expect(unidad.metrics.uniquePeople).toMatchObject({ status: 'EXACT', value: 21 });
    expect(unidad.metrics.olderAdult60Plus).toMatchObject({ status: 'EXACT', value: 6 });
    expect(unidad.metrics.disabilityDeclared).toMatchObject({ status: 'EXACT', value: 7 });
    expect(unidad.metrics.homeCareRequiredDeclared).toMatchObject({
      status: 'EXACT',
      value: 8,
    });
  });
});

describe('protección de grupos pequeños en territorio (T-08)', () => {
  it('suprime una unidad local pequeña y no la deja reconstruir por su área', () => {
    const summary = resumen([
      ...repetir(20),
      ...repetir(3, { localUnitId: 'unidad-b', localUnitName: 'Barrio Ficticio B' }),
    ]);

    const urbana = summary.municipalities[0]!.areas[0]!;
    const pequena = urbana.localUnits.find(
      (unidad) => unidad.displayName === 'Barrio Ficticio B',
    );

    expect(pequena?.metrics.uniquePeople.status).toBe('SUPPRESSED');
    expect(pequena?.metrics.uniquePeople.value).toBeNull();

    const grande = urbana.localUnits[0]!.metrics.uniquePeople;
    const area = urbana.metrics.uniquePeople;

    // Si el área y la unidad grande fueran exactas, la pequeña sería 23 − 20.
    expect(grande.status === 'EXACT' && area.status === 'EXACT').toBe(false);
  });

  it('nunca serializa el valor real de un grupo pequeño', () => {
    const serializado = JSON.stringify(
      resumen([...repetir(20), ...repetir(2, { areaType: 'RURAL', localUnitId: null })]),
    );

    expect(serializado).toContain('"display":"<5"');
    // El 2 real no aparece como valor en ningún punto de la respuesta. El
    // patrón exige el fin del campo para no confundirlo con 20, 22 o 200.
    expect(serializado).not.toMatch(/"value":2[,}]/u);
    // Con la unidad grande exacta, el área rural y el municipio quedan
    // suprimidos: de lo contrario el 2 se obtendría restando.
    expect(serializado).not.toMatch(/"value":22[,}]/u);
  });
});

describe('minimización del contrato territorial (T-06)', () => {
  it('no expone dirección, texto declarado ni identificadores de persona', () => {
    const serializado = JSON.stringify(
      resumen([...repetir(10), ...repetir(6, { localUnitId: null, localUnitName: null })]),
    );

    for (const prohibido of [
      'exactAddress',
      'directions',
      'localityUnverifiedText',
      'settlementUnverifiedText',
      'patientId',
      'personId',
      'birthDate',
      'tenantId',
      'visitas',
      'alertas',
    ]) {
      expect(serializado).not.toContain(prohibido);
    }
  });

  it('declara procedencia y fechas de corte', () => {
    const summary = resumen(repetir(10));

    expect(summary.source).toBe(MUNICIPALITY_AGGREGATE_SOURCE);
    expect(summary.asOfDate).toBe('2026-08-22');
    expect(summary.generatedAt).toBe(GENERATED_AT.toISOString());
  });

  it('sin registros devuelve una jerarquía vacía, no un fixture', () => {
    expect(resumen([]).municipalities).toStrictEqual([]);
  });
});
