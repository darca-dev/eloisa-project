import { describe, expect, it } from 'vitest';

import { type Candidate, type CriterionSpec, evaluate, isAdmissible, matchesValue, semaphoreLevel } from './criterion-evaluator';

const RECEPCION = new Date('2026-10-21T12:00:00.000Z');
const minutos = (n: number) => new Date(RECEPCION.getTime() - n * 60_000);

const NUMERICO: CriterionSpec = {
  valueType: 'NUMBER',
  comparator: 'GTE',
  numberValue: '10.5',
  booleanValue: null,
  choiceValues: null,
  requiredCount: 2,
  windowMinutes: 60,
  activatedAt: minutos(600),
  validUntil: null,
};

function candidato(parcial: Partial<Candidate> & { readonly occurrenceKey: string }): Candidate {
  return {
    observationId: `obs-${parcial.occurrenceKey}`,
    occurredAt: minutos(10),
    value: '11',
    alreadyEvidence: false,
    amended: false,
    ...parcial,
  };
}

describe('isAdmissible', () => {
  it('la ventana es inclusiva en ambos límites y nada posterior a la recepción cuenta', () => {
    expect(isAdmissible(NUMERICO, candidato({ occurrenceKey: 'a', occurredAt: minutos(60) }), RECEPCION)).toBe(true);
    expect(isAdmissible(NUMERICO, candidato({ occurrenceKey: 'a', occurredAt: RECEPCION }), RECEPCION)).toBe(true);
    expect(isAdmissible(NUMERICO, candidato({ occurrenceKey: 'a', occurredAt: new Date(minutos(60).getTime() - 1) }), RECEPCION)).toBe(false);
    expect(isAdmissible(NUMERICO, candidato({ occurrenceKey: 'a', occurredAt: new Date(RECEPCION.getTime() + 1) }), RECEPCION)).toBe(false);
  });

  it('la activación es prospectiva y la vigencia termina en validUntil', () => {
    const activo = { ...NUMERICO, activatedAt: minutos(5) };
    expect(isAdmissible(activo, candidato({ occurrenceKey: 'a', occurredAt: minutos(6) }), RECEPCION)).toBe(false);
    expect(isAdmissible(activo, candidato({ occurrenceKey: 'a', occurredAt: minutos(5) }), RECEPCION)).toBe(true);

    const vencido = { ...NUMERICO, validUntil: minutos(20) };
    expect(isAdmissible(vencido, candidato({ occurrenceKey: 'a', occurredAt: minutos(20) }), RECEPCION)).toBe(false);
    expect(isAdmissible(vencido, candidato({ occurrenceKey: 'a', occurredAt: minutos(21) }), RECEPCION)).toBe(true);
  });
});

describe('matchesValue', () => {
  it('compara decimales exactos sin coma flotante', () => {
    expect(matchesValue(NUMERICO, '10.5')).toBe(true);
    expect(matchesValue(NUMERICO, '10.4999999999')).toBe(false);
    expect(matchesValue({ ...NUMERICO, comparator: 'LT', numberValue: '0.3' }, '0.2999999999')).toBe(true);
    expect(matchesValue({ ...NUMERICO, comparator: 'NEQ' }, '10.50')).toBe(false);
  });

  it('sí/no solo con EQ y opciones solo con IN; un tipo ajeno nunca coincide', () => {
    const booleano: CriterionSpec = { ...NUMERICO, valueType: 'BOOLEAN', comparator: 'EQ', booleanValue: true, numberValue: null };
    expect(matchesValue(booleano, true)).toBe(true);
    expect(matchesValue(booleano, false)).toBe(false);
    expect(matchesValue(booleano, 'true')).toBe(false);

    const opcion: CriterionSpec = { ...NUMERICO, valueType: 'CHOICE', comparator: 'IN', choiceValues: ['b', 'c'], numberValue: null };
    expect(matchesValue(opcion, 'c')).toBe(true);
    expect(matchesValue(opcion, 'a')).toBe(false);
    expect(matchesValue(opcion, null)).toBe(false);
  });
});

describe('evaluate', () => {
  it('se cumple con N coincidencias distintas dentro de la ventana', () => {
    const resultado = evaluate(NUMERICO, [candidato({ occurrenceKey: 'a' }), candidato({ occurrenceKey: 'b', occurredAt: minutos(20) })], RECEPCION);
    expect(resultado.met).toBe(true);
    expect(resultado.matching).toHaveLength(2);
  });

  it('la misma ocurrencia reportada dos veces cuenta una sola vez', () => {
    const resultado = evaluate(NUMERICO, [candidato({ occurrenceKey: 'a' }), candidato({ occurrenceKey: 'a', observationId: 'otra' })], RECEPCION);
    expect(resultado.met).toBe(false);
    expect(resultado.matching).toHaveLength(1);
  });

  it('la evidencia consumida de un episodio no vuelve a contar', () => {
    const resultado = evaluate(NUMERICO, [candidato({ occurrenceKey: 'a', alreadyEvidence: true }), candidato({ occurrenceKey: 'b' })], RECEPCION);
    expect(resultado.met).toBe(false);
  });

  it('valores que no coinciden, fuera de ventana o nulos no suman', () => {
    const resultado = evaluate(
      NUMERICO,
      [candidato({ occurrenceKey: 'a', value: '9' }), candidato({ occurrenceKey: 'b', occurredAt: minutos(61) }), candidato({ occurrenceKey: 'c', value: null }), candidato({ occurrenceKey: 'd' })],
      RECEPCION,
    );
    expect(resultado.matching.map((item) => item.occurrenceKey)).toEqual(['d']);
    expect(resultado.met).toBe(false);
  });
});

describe('semaphoreLevel', () => {
  const vacio = { ROJA: 0, AMARILLA: 0, ESTABLE: 0, SIN: 0 };

  it('sin criterios ni solicitudes no es verde ni estable', () => {
    expect(semaphoreLevel({ openBySeverity: vacio, activeCriteria: 0 })).toBe('SIN_CRITERIOS');
  });

  it('prioriza roja, amarilla y pendiente de clasificación', () => {
    expect(semaphoreLevel({ openBySeverity: { ...vacio, ROJA: 1, AMARILLA: 3 }, activeCriteria: 1 })).toBe('ROJO');
    expect(semaphoreLevel({ openBySeverity: { ...vacio, AMARILLA: 1, SIN: 2 }, activeCriteria: 0 })).toBe('AMARILLO');
    expect(semaphoreLevel({ openBySeverity: { ...vacio, SIN: 1 }, activeCriteria: 0 })).toBe('PENDIENTE');
    expect(semaphoreLevel({ openBySeverity: vacio, activeCriteria: 2 })).toBe('ESTABLE');
  });
});
