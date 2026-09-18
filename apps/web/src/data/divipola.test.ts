import { describe, expect, it } from 'vitest';

import {
  DEPARTAMENTOS,
  DIVIPOLA_METADATA,
  MUNICIPIOS,
  municipioPerteneceA,
  municipiosDe,
  nombreDepartamento,
  nombreMunicipio,
} from './divipola';

/**
 * Catálogo local derivado de DANE DIVIPOLA (TASK-002A, FR-04A).
 *
 * Estas pruebas verifican cobertura, procedencia y filtrado. No se consulta a
 * DANE ni a ninguna red: si el catálogo dejara de ser local, el módulo no
 * podría resolverse de forma síncrona como lo hace aquí.
 */

describe('procedencia y versión del catálogo', () => {
  it('declara fuente, conjuntos, corte de datos y fecha de obtención', () => {
    expect(DIVIPOLA_METADATA.fuente).toContain('DANE');
    expect(DIVIPOLA_METADATA.fuente).toContain('DIVIPOLA');
    expect(DIVIPOLA_METADATA.conjuntoDepartamentos).toContain('vcjz-niiq');
    expect(DIVIPOLA_METADATA.conjuntoMunicipios).toContain('xaxy-8nri');
    expect(DIVIPOLA_METADATA.corteDepartamentos).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
    expect(DIVIPOLA_METADATA.corteMunicipios).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
    expect(DIVIPOLA_METADATA.fechaObtencion).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
  });
});

describe('cobertura completa del territorio nacional', () => {
  it('incluye las 33 entidades territoriales de primer nivel', () => {
    expect(DEPARTAMENTOS).toHaveLength(33);
  });

  it('incluye los 1.122 municipios oficiales', () => {
    expect(MUNICIPIOS).toHaveLength(1122);
  });

  it('no repite códigos de departamento ni de municipio', () => {
    expect(new Set(DEPARTAMENTOS.map((d) => d.codigo)).size).toBe(DEPARTAMENTOS.length);
    expect(new Set(MUNICIPIOS.map((m) => m.codigo)).size).toBe(MUNICIPIOS.length);
  });

  it('usa códigos oficiales de dos y cinco dígitos', () => {
    for (const departamento of DEPARTAMENTOS) {
      expect(departamento.codigo).toMatch(/^\d{2}$/u);
      expect(departamento.nombre.length).toBeGreaterThan(0);
    }
    for (const municipio of MUNICIPIOS) {
      expect(municipio.codigo).toMatch(/^\d{5}$/u);
      expect(municipio.codigoDepartamento).toBe(municipio.codigo.slice(0, 2));
    }
  });

  it('cada municipio pertenece a un departamento del catálogo', () => {
    const codigos = new Set(DEPARTAMENTOS.map((d) => d.codigo));
    for (const municipio of MUNICIPIOS) {
      expect(codigos.has(municipio.codigoDepartamento)).toBe(true);
    }
  });

  it('todos los departamentos tienen al menos un municipio', () => {
    for (const departamento of DEPARTAMENTOS) {
      expect(municipiosDe(departamento.codigo).length).toBeGreaterThan(0);
    }
  });

  it('conserva tildes y nombres oficiales', () => {
    expect(nombreDepartamento('05')).toBe('ANTIOQUIA');
    expect(nombreDepartamento('11')).toBe('BOGOTÁ, D.C.');
    expect(nombreMunicipio('05001')).toBe('MEDELLÍN');
    expect(nombreMunicipio('25754')).toBe('SOACHA');
  });
});

describe('filtrado de municipios por departamento', () => {
  it('devuelve solo municipios del departamento pedido', () => {
    const cundinamarca = municipiosDe('25');
    expect(cundinamarca.length).toBeGreaterThan(100);
    for (const municipio of cundinamarca) {
      expect(municipio.codigoDepartamento).toBe('25');
    }
    expect(cundinamarca.some((m) => m.nombre === 'SOACHA')).toBe(true);
    expect(cundinamarca.some((m) => m.nombre === 'MEDELLÍN')).toBe(false);
  });

  it('Bogotá D.C. tiene un único municipio', () => {
    expect(municipiosDe('11').map((m) => m.codigo)).toEqual(['11001']);
  });

  it('sin departamento elegido la lista queda vacía', () => {
    expect(municipiosDe('')).toEqual([]);
    expect(municipiosDe('00')).toEqual([]);
  });

  it('la suma de los municipios por departamento es el total del catálogo', () => {
    const total = DEPARTAMENTOS.reduce(
      (suma, departamento) => suma + municipiosDe(departamento.codigo).length,
      0,
    );
    expect(total).toBe(MUNICIPIOS.length);
  });

  it('reconoce si un municipio pertenece a un departamento', () => {
    expect(municipioPerteneceA('25754', '25')).toBe(true);
    expect(municipioPerteneceA('25754', '05')).toBe(false);
    expect(municipioPerteneceA('', '25')).toBe(false);
  });

  it('un código desconocido no devuelve nombre inventado', () => {
    expect(nombreDepartamento('00')).toBe('');
    expect(nombreMunicipio('00000')).toBe('');
  });
});
