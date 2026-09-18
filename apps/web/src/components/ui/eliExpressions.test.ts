import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { EXPRESIONES, expresionDe } from './eliExpressions';
import type { EliIntencion } from './eliExpressions';

/**
 * Mapeo tipado de intenciones visuales de la IA (TASK-002A, FR-08 y FR-08A).
 */

const PUBLIC_DIR = fileURLToPath(new URL('../../../public', import.meta.url));

const INTENCIONES = Object.keys(EXPRESIONES) as EliIntencion[];

describe('mapeo reutilizable de intenciones', () => {
  it('resuelve cada intención a un asset aprobado presente en el repositorio', () => {
    for (const intencion of INTENCIONES) {
      const { src } = expresionDe(intencion);
      expect(src.startsWith('/eli/')).toBe(true);
      expect(existsSync(path.join(PUBLIC_DIR, src.replace(/^\//u, '')))).toBe(true);
    }
  });

  it('ninguna intención comparte asset con otra', () => {
    const rutas = INTENCIONES.map((intencion) => expresionDe(intencion).src);
    expect(new Set(rutas).size).toBe(rutas.length);
  });

  it('cada intención documenta su referencia visual y su gesto', () => {
    for (const intencion of INTENCIONES) {
      const expresion = expresionDe(intencion);
      expect(expresion.referencia.length).toBeGreaterThan(0);
      expect(expresion.gesto.length).toBeGreaterThan(0);
    }
  });

  it('«escucha» y «pregunta» son expresiones distintas', () => {
    expect(expresionDe('escucha').src).toBe('/eli/escucha.png');
    expect(expresionDe('pregunta').src).toBe('/eli/pregunta.png');
    expect(expresionDe('escucha').src).not.toBe(expresionDe('pregunta').src);
    expect(expresionDe('escucha').referencia).toBe('TE ESCUCHA');
    expect(expresionDe('pregunta').referencia).toBe('PREGUNTA');
  });

  it('el logo aprobado existe como asset reutilizable', () => {
    expect(existsSync(path.join(PUBLIC_DIR, 'brand', 'corazon-check.png'))).toBe(true);
  });
});
