import { describe, expect, it } from 'vitest';

import {
  SUPPRESSED_DISPLAY,
  SUPPRESSION_THRESHOLD,
  applyPrimarySuppression,
  protectDisclosure,
  type DisclosureCell,
  type SuppressedCount,
} from './suppression';

/**
 * Protección de grupos pequeños (TASK-MUNICIPALITY-CORE-01, FR-15, OD-02,
 * AC-7 y prueba T-08).
 *
 * Todos los conteos de estas pruebas son sintéticos: no describen a ninguna
 * persona real ni proceden de ningún registro.
 */

/** Sistema con siete átomos publicados y tres agregados solapados. */
function sistemaDePoblacion(valores: readonly number[]): {
  atoms: Map<string, number>;
  cells: DisclosureCell[];
} {
  const claves = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7'];
  const atoms = new Map<string, number>(
    claves.map((clave, indice) => [clave, valores[indice] ?? 0]),
  );
  atoms.set('none', 0);

  return {
    atoms,
    cells: [
      ...claves.map((clave) => ({ key: clave, atoms: [clave] })),
      { key: 'older', atoms: ['a1', 'a4', 'a5', 'a7'] },
      { key: 'disability', atoms: ['a2', 'a4', 'a6', 'a7'] },
      { key: 'homeCare', atoms: ['a3', 'a5', 'a6', 'a7'] },
      { key: 'total', atoms: [...claves, 'none'] },
    ],
  };
}

/**
 * Comprueba que ningún conteo sensible pueda deducirse resolviendo el sistema
 * de las celdas publicadas.
 *
 * Se enumera por fuerza bruta el espacio de valores posibles de los átomos
 * desconocidos, acotado por el propio umbral, y se exige que más de una
 * asignación sea compatible con todo lo publicado.
 */
function reconstruible(
  atoms: ReadonlyMap<string, number>,
  cells: readonly DisclosureCell[],
  resultado: ReadonlyMap<string, SuppressedCount>,
  atomoSensible: string,
): boolean {
  const publicadas = cells.filter(
    (cell) => resultado.get(cell.key)?.status === 'EXACT',
  );

  const conocidos = new Set<string>();
  for (const cell of publicadas) {
    if (cell.atoms.length === 1) {
      conocidos.add(cell.atoms[0]!);
    }
  }

  const desconocidos = [...atoms.keys()].filter((atom) => !conocidos.has(atom));
  // Espacio acotado: cada incógnita se prueba entre 0 y el mayor total publicado.
  const maximo = Math.max(
    ...publicadas.map((cell) => resultado.get(cell.key)?.value ?? 0),
    SUPPRESSION_THRESHOLD,
  );

  const compatibles = new Set<number>();

  const recorrer = (indice: number, asignacion: Map<string, number>): void => {
    if (compatibles.size > 1) {
      return;
    }

    if (indice === desconocidos.length) {
      const valores = new Map<string, number>(atoms);
      for (const [atom, valor] of asignacion) {
        valores.set(atom, valor);
      }

      const cuadra = publicadas.every((cell) => {
        const suma = cell.atoms.reduce(
          (acumulado, atom) => acumulado + (valores.get(atom) ?? 0),
          0,
        );

        return suma === resultado.get(cell.key)?.value;
      });

      if (cuadra) {
        compatibles.add(asignacion.get(atomoSensible) ?? -1);
      }

      return;
    }

    for (let valor = 0; valor <= maximo; valor += 1) {
      asignacion.set(desconocidos[indice]!, valor);
      recorrer(indice + 1, asignacion);
    }

    asignacion.delete(desconocidos[indice]!);
  };

  recorrer(0, new Map<string, number>());

  return compatibles.size === 1;
}

describe('regla primaria de supresión', () => {
  it('publica el cero como conteo exacto', () => {
    expect(applyPrimarySuppression(0)).toStrictEqual({
      status: 'EXACT',
      value: 0,
      display: '0',
    });
  });

  it('suprime los conteos de 1 a 4 sin serializar el valor real', () => {
    for (const valor of [1, 2, 3, 4]) {
      const resultado = applyPrimarySuppression(valor);

      expect(resultado.status).toBe('SUPPRESSED');
      expect(resultado.value).toBeNull();
      expect(resultado.display).toBe(SUPPRESSED_DISPLAY);
      expect(JSON.stringify(resultado)).not.toContain(String(valor));
    }
  });

  it('publica el conteo exacto desde el umbral', () => {
    expect(applyPrimarySuppression(5)).toMatchObject({ status: 'EXACT', value: 5 });
    expect(applyPrimarySuppression(120)).toMatchObject({ status: 'EXACT', value: 120 });
  });
});

describe('supresión complementaria', () => {
  it('no suprime nada cuando ningún conteo es sensible', () => {
    const sistema = sistemaDePoblacion([10, 9, 8, 7, 6, 5, 5]);
    const resultado = protectDisclosure(sistema);

    for (const cell of sistema.cells) {
      expect(resultado.get(cell.key)?.status).toBe('EXACT');
    }

    expect(resultado.get('total')?.value).toBe(50);
  });

  it('impide reconstruir una región suprimida restando de su total', () => {
    // `a1` vale 3: la regla primaria lo suprime, pero `older` lo dejaría a la vista.
    const sistema = sistemaDePoblacion([3, 10, 10, 10, 10, 10, 10]);
    const resultado = protectDisclosure(sistema);

    expect(resultado.get('a1')?.status).toBe('SUPPRESSED');
    expect(reconstruible(sistema.atoms, sistema.cells, resultado, 'a1')).toBe(false);
  });

  it('protege también cuando dos regiones pequeñas comparten agregados', () => {
    const sistema = sistemaDePoblacion([3, 10, 10, 2, 10, 10, 10]);
    const resultado = protectDisclosure(sistema);

    expect(resultado.get('a1')?.status).toBe('SUPPRESSED');
    expect(resultado.get('a4')?.status).toBe('SUPPRESSED');
    expect(reconstruible(sistema.atoms, sistema.cells, resultado, 'a1')).toBe(false);
    expect(reconstruible(sistema.atoms, sistema.cells, resultado, 'a4')).toBe(false);
  });

  it('protege una jerarquía territorial de tres niveles', () => {
    const atoms = new Map<string, number>([
      ['barrio-a', 20],
      ['barrio-b', 2],
      ['vereda-a', 30],
    ]);

    const cells: DisclosureCell[] = [
      { key: 'node:barrio-a', atoms: ['barrio-a'] },
      { key: 'node:barrio-b', atoms: ['barrio-b'] },
      { key: 'node:vereda-a', atoms: ['vereda-a'] },
      { key: 'area:urbana', atoms: ['barrio-a', 'barrio-b'] },
      { key: 'area:rural', atoms: ['vereda-a'] },
      { key: 'municipio', atoms: ['barrio-a', 'barrio-b', 'vereda-a'] },
    ];

    const resultado = protectDisclosure({ atoms, cells });

    expect(resultado.get('node:barrio-b')?.status).toBe('SUPPRESSED');
    expect(reconstruible(atoms, cells, resultado, 'barrio-b')).toBe(false);
    // La rural no comparte átomos con la urbana y conserva su cifra exacta.
    expect(resultado.get('area:rural')).toMatchObject({ status: 'EXACT', value: 30 });
  });

  it('un área con una sola unidad pequeña no delata su cifra por el municipio', () => {
    const atoms = new Map<string, number>([
      ['urbano-unico', 3],
      ['rural-unico', 40],
    ]);

    const cells: DisclosureCell[] = [
      { key: 'node:urbano', atoms: ['urbano-unico'] },
      { key: 'node:rural', atoms: ['rural-unico'] },
      { key: 'area:urbana', atoms: ['urbano-unico'] },
      { key: 'area:rural', atoms: ['rural-unico'] },
      { key: 'municipio', atoms: ['urbano-unico', 'rural-unico'] },
    ];

    const resultado = protectDisclosure({ atoms, cells });

    expect(resultado.get('node:urbano')?.status).toBe('SUPPRESSED');
    expect(resultado.get('area:urbana')?.status).toBe('SUPPRESSED');
    expect(reconstruible(atoms, cells, resultado, 'urbano-unico')).toBe(false);
  });

  it('celdas con el mismo conjunto de átomos comparten estado', () => {
    const atoms = new Map<string, number>([['pendientes', 2]]);

    const cells: DisclosureCell[] = [
      { key: 'node:pendientes', atoms: ['pendientes'] },
      { key: 'area', atoms: ['pendientes'] },
    ];

    const resultado = protectDisclosure({ atoms, cells });

    expect(resultado.get('node:pendientes')?.status).toBe('SUPPRESSED');
    expect(resultado.get('area')?.status).toBe('SUPPRESSED');
  });
});
