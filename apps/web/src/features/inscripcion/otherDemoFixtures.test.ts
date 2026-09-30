import { describe, expect, it } from 'vitest';

import { validarPaso } from './inscripcionFlow';
import { CUIDADORES_DEMO, VISITADORES_DEMO } from './otherDemoFixtures';

describe('datos ficticios del registro guiado', () => {
  it('ofrece tres cuidadores distintos que pueden recorrer los cinco pasos', () => {
    expect(CUIDADORES_DEMO).toHaveLength(3);
    expect(new Set(CUIDADORES_DEMO.map((demo) => demo.valores.documento)).size).toBe(3);
    for (const demo of CUIDADORES_DEMO) {
      for (let paso = 1; paso <= 5; paso += 1) {
        expect(validarPaso({ perfil: 'cuidador', valores: demo.valores }, paso)).toEqual({});
      }
    }
  });

  it('ofrece tres visitadores distintos que pueden recorrer los cinco pasos', () => {
    expect(VISITADORES_DEMO).toHaveLength(3);
    expect(new Set(VISITADORES_DEMO.map((demo) => demo.valores.documento)).size).toBe(3);
    for (const demo of VISITADORES_DEMO) {
      for (let paso = 1; paso <= 5; paso += 1) {
        expect(validarPaso({ perfil: 'visitador', valores: demo.valores }, paso)).toEqual({});
      }
    }
  });
});
