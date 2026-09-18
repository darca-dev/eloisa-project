import { describe, expect, it } from 'vitest';

import {
  BITACORA_INICIAL,
  EVENTO_NINGUNO,
  TITULOS_ETAPA,
  TOTAL_ETAPAS,
  bitacoraReducer,
  resumenBitacora,
} from './bitacoraFlow';
import type { BitacoraAction, BitacoraState } from './bitacoraFlow';

function reducir(
  acciones: readonly BitacoraAction[],
  desde: BitacoraState = BITACORA_INICIAL,
): BitacoraState {
  return acciones.reduce(bitacoraReducer, desde);
}

describe('bitácora completa posterior a la inscripción (FR-05)', () => {
  it('declara ocho etapas en el orden aprobado', () => {
    expect(TOTAL_ETAPAS).toBe(8);
    expect(TITULOS_ETAPA).toEqual([
      '¿Cómo está hoy?',
      'Signos vitales',
      'Comida y líquidos',
      'Medicamentos',
      'Higiene y cuidado',
      'Movilidad',
      '¿Ocurrió algo importante?',
      'Observaciones y confirmar',
    ]);
  });

  it('empieza en la portada y no en una etapa', () => {
    expect(BITACORA_INICIAL.fase).toBe('portada');
  });

  it('avanza hasta la etapa 8 y no más allá', () => {
    let state = reducir([{ type: 'empezar' }]);
    expect(state.fase).toBe('etapas');
    expect(state.etapa).toBe(1);

    for (let paso = 1; paso < TOTAL_ETAPAS; paso += 1) {
      state = bitacoraReducer(state, { type: 'siguiente' });
    }
    expect(state.etapa).toBe(TOTAL_ETAPAS);

    state = bitacoraReducer(state, { type: 'siguiente' });
    expect(state.etapa).toBe(TOTAL_ETAPAS);
  });

  it('conserva los valores al retroceder', () => {
    const state = reducir([
      { type: 'empezar' },
      { type: 'actualizar', patch: { comparativo: 'mejor' } },
      { type: 'siguiente' },
      { type: 'actualizar', patch: { presionAlta: '128', presionBaja: '78' } },
      { type: 'anterior' },
    ]);

    expect(state.etapa).toBe(1);
    expect(state.valores.comparativo).toBe('mejor');
    expect(state.valores.presionAlta).toBe('128');
  });

  it('desde la etapa 1 «Anterior» devuelve a la portada', () => {
    const state = reducir([{ type: 'empezar' }, { type: 'anterior' }]);
    expect(state.fase).toBe('portada');
  });

  it('registra higiene y movilidad por elemento', () => {
    const state = reducir([
      { type: 'empezar' },
      { type: 'responderHigiene', item: 'bano', valor: 'Sí' },
      { type: 'responderHigiene', item: 'oral', valor: 'No aplica' },
      { type: 'responderMovilidad', item: 'postura', valor: 'No' },
    ]);

    expect(state.valores.higiene).toEqual({ bano: 'Sí', oral: 'No aplica' });
    expect(state.valores.movilidad).toEqual({ postura: 'No' });
  });

  it('«Nada de lo anterior» es excluyente frente a los demás eventos', () => {
    let state = reducir([
      { type: 'empezar' },
      { type: 'alternarEvento', evento: 'Caída' },
      { type: 'alternarEvento', evento: 'Fiebre' },
    ]);
    expect(state.valores.eventos).toEqual(['Caída', 'Fiebre']);

    state = bitacoraReducer(state, { type: 'alternarEvento', evento: EVENTO_NINGUNO });
    expect(state.valores.eventos).toEqual([EVENTO_NINGUNO]);

    state = bitacoraReducer(state, { type: 'alternarEvento', evento: 'Dolor' });
    expect(state.valores.eventos).toEqual(['Dolor']);
  });

  it('no permite confirmar sin la autorización de tratamiento de datos', () => {
    const sinAutorizar = reducir([{ type: 'empezar' }, { type: 'guardar' }]);

    expect(sinAutorizar.fase).toBe('etapas');
    expect(sinAutorizar.errorAutorizacion).not.toBeNull();

    const autorizada = reducir(
      [{ type: 'actualizar', patch: { autorizaDatos: true } }, { type: 'guardar' }],
      sinAutorizar,
    );

    expect(autorizada.fase).toBe('confirmada');
    expect(autorizada.errorAutorizacion).toBeNull();
  });

  it('reiniciar descarta todo lo diligenciado', () => {
    const state = reducir([
      { type: 'empezar' },
      { type: 'actualizar', patch: { comparativo: 'peor', autorizaDatos: true } },
      { type: 'guardar' },
      { type: 'reiniciar' },
    ]);

    expect(state).toEqual(BITACORA_INICIAL);
  });

  it('el resumen repite lo respondido sin evaluarlo', () => {
    const state = reducir([
      { type: 'empezar' },
      {
        type: 'actualizar',
        patch: {
          comparativo: 'peor',
          presionAlta: '180',
          presionBaja: '110',
          alimentacion: 'Comí poco',
          medicamentos: 'No los tomé',
        },
      },
      { type: 'alternarEvento', evento: 'Caída' },
    ]);

    const resumen = resumenBitacora(state.valores);
    const valores = resumen.map((fila) => fila.valor);

    expect(valores).toContain('Peor');
    expect(valores).toContain('180 / 110');
    expect(valores).toContain('Comí poco');
    expect(valores).toContain('No los tomé');
    expect(valores).toContain('Caída');

    // Ninguna fila introduce severidad, urgencia, alerta ni recomendación.
    const texto = JSON.stringify(resumen).toLowerCase();
    for (const prohibido of ['alerta', 'urgente', 'riesgo', 'grave', 'recomend']) {
      expect(texto).not.toContain(prohibido);
    }
  });
});
