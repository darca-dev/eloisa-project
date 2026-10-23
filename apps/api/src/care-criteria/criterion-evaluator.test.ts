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

describe('evaluate — frontera del episodio (MP07A / A04)', () => {
  const cierre = minutos(30);

  it('tras un cierre solo cuenta lo ocurrido ESTRICTAMENTE después; el instante del cierre no', () => {
    const antes = candidato({ occurrenceKey: 'antes', occurredAt: minutos(40) });
    const enCierre = candidato({ occurrenceKey: 'en-cierre', occurredAt: cierre });
    const despues = candidato({ occurrenceKey: 'despues', occurredAt: new Date(cierre.getTime() + 1) });

    expect(isAdmissible(NUMERICO, antes, RECEPCION, cierre)).toBe(false);
    expect(isAdmissible(NUMERICO, enCierre, RECEPCION, cierre)).toBe(false);
    expect(isAdmissible(NUMERICO, despues, RECEPCION, cierre)).toBe(true);

    const resultado = evaluate(NUMERICO, [antes, enCierre, despues], RECEPCION, cierre);
    expect(resultado.matching.map((item) => item.occurrenceKey)).toEqual(['despues']);
    expect(resultado.met).toBe(false);
  });

  it('un evento tardío anterior al cierre, aunque esté en ventana y tras la activación, no completa el episodio nuevo', () => {
    const tardio = candidato({ occurrenceKey: 'tardio', occurredAt: minutos(35) });
    const nuevo = candidato({ occurrenceKey: 'nuevo', occurredAt: minutos(5) });

    expect(evaluate(NUMERICO, [tardio, nuevo], RECEPCION, cierre).met).toBe(false);
    expect(evaluate(NUMERICO, [tardio, nuevo], RECEPCION, null).met).toBe(true);
  });

  it('el episodio abierto sigue recibiendo cada coincidencia admisible sin reiniciar N', () => {
    const resultado = evaluate({ ...NUMERICO, requiredCount: 5 }, [candidato({ occurrenceKey: 'uno' })], RECEPCION, cierre);
    expect(resultado.met).toBe(false);
    expect(resultado.matching).toHaveLength(1);
  });

  it('sin cierre previo la frontera no restringe nada', () => {
    expect(isAdmissible(NUMERICO, candidato({ occurrenceKey: 'a', occurredAt: minutos(60) }), RECEPCION, null)).toBe(true);
  });
});

describe('semaphoreLevel (MP07A / A01)', () => {
  const vacio = { ROJA: 0, AMARILLA: 0, ESTABLE: 0, SIN: 0 };
  const nivel = (openBySeverity: typeof vacio, activeCriteria = 0, criteriaRequiringRevalidation = 0) =>
    semaphoreLevel({ openBySeverity, activeCriteria, criteriaRequiringRevalidation });

  it('sin criterios ni solicitudes no es verde ni estable', () => {
    expect(nivel(vacio)).toBe('SIN_CRITERIOS');
  });

  it('prioriza roja, amarilla y pendiente de clasificación', () => {
    expect(nivel({ ...vacio, ROJA: 1, AMARILLA: 3, ESTABLE: 2 }, 1)).toBe('ROJO');
    expect(nivel({ ...vacio, AMARILLA: 1, SIN: 2, ESTABLE: 1 })).toBe('AMARILLO');
    expect(nivel({ ...vacio, SIN: 1, ESTABLE: 4 }, 3)).toBe('PENDIENTE');
  });

  it('criterio vigente sin alarmas, sin datos o con datos insuficientes NO es estable', () => {
    expect(nivel(vacio, 1)).toBe('SIN_EVALUACION');
    expect(nivel(vacio, 7)).toBe('SIN_EVALUACION');
  });

  it('criterios que esperan revalidación tampoco clasifican; siguen distinguiéndose de «sin criterios»', () => {
    expect(nivel(vacio, 0, 1)).toBe('SIN_EVALUACION');
  });

  it('ESTABLE solo con una alarma abierta clasificada ESTABLE, haya o no criterios vigentes', () => {
    expect(nivel({ ...vacio, ESTABLE: 1 })).toBe('ESTABLE');
    expect(nivel({ ...vacio, ESTABLE: 1 }, 2, 1)).toBe('ESTABLE');
  });
});
