import { describe, expect, it } from 'vitest';

import { MUNICIPALITY_NAV_ITEMS, MUNICIPALITY_PERIODOS_CONFIG } from './municipalityConfig';
import {
  MUNICIPALITY_MODULOS,
  MUNICIPALITY_MODULOS_IMPLEMENTADOS,
  MUNICIPALITY_PERIODOS,
  MUNICIPALITY_PERIODO_INICIAL,
  MUNICIPALITY_VISTA_INICIAL,
  esModuloMunicipal,
  esPeriodoMunicipal,
  siguientePeriodo,
  siguienteVista,
  tieneContenidoPropio,
} from './municipalityViews';

/**
 * Navegación y selección local de Alcaldía (TASK-ALCALDIA-A-01, T-04, T-05).
 *
 * Las transiciones están extraídas como funciones puras, de modo que su
 * comportamiento se verifica sin DOM. La activación real por clic y por teclado
 * se verifica manualmente en navegador y se reporta como tal.
 */

describe('municipalityViews — navegación local', () => {
  it('declara los trece módulos del menú aprobado, en orden', () => {
    expect([...MUNICIPALITY_MODULOS]).toStrictEqual([
      'inicio',
      'poblacion',
      'territorio',
      'programas',
      'presupuesto',
      'evidencias',
      'furag',
      'adres',
      'cuidado',
      'brechas',
      'cuidadores',
      'indicadores',
      'reportes',
    ]);
  });

  it('mantiene el menú y los módulos en la misma verdad funcional', () => {
    expect(MUNICIPALITY_NAV_ITEMS.map((item) => item.id)).toStrictEqual([
      ...MUNICIPALITY_MODULOS,
    ]);
  });

  it('abre en Inicio', () => {
    expect(MUNICIPALITY_VISTA_INICIAL).toBe('inicio');
  });

  it('reconoce solo los identificadores del menú', () => {
    expect(esModuloMunicipal('evidencias')).toBe(true);
    expect(esModuloMunicipal('hospital')).toBe(false);
    expect(esModuloMunicipal('')).toBe(false);
  });

  /*
   * TASK-ALCALDIA-DEMO-FINAL, T-02 y AC-01: con el cierre de la demostración
   * los trece módulos del menú tienen contenido propio.
   */
  it('los trece módulos del menú tienen contenido propio', () => {
    const conContenido = MUNICIPALITY_MODULOS.filter((modulo) => tieneContenidoPropio(modulo));

    expect([...conContenido]).toStrictEqual([...MUNICIPALITY_MODULOS]);
    expect([...MUNICIPALITY_MODULOS_IMPLEMENTADOS]).toStrictEqual([...MUNICIPALITY_MODULOS]);
  });

  it('ningún módulo queda en el estado neutro «Próximamente»', () => {
    const pendientes = MUNICIPALITY_MODULOS.filter((modulo) => !tieneContenidoPropio(modulo));

    expect([...pendientes]).toStrictEqual([]);
  });

  /* Los siete módulos que esta tarea activa, nombrados uno a uno. */
  it('los siete módulos de esta tarea tienen contenido propio', () => {
    for (const modulo of [
      'furag',
      'adres',
      'cuidado',
      'brechas',
      'cuidadores',
      'indicadores',
      'reportes',
    ] as const) {
      expect(tieneContenidoPropio(modulo)).toBe(true);
    }
  });

  it('cambia a cualquier módulo del menú y regresa a Inicio', () => {
    for (const modulo of MUNICIPALITY_MODULOS) {
      expect(siguienteVista('inicio', modulo)).toBe(modulo);
      expect(siguienteVista(modulo, 'inicio')).toBe('inicio');
    }
  });

  it('conserva la vista actual ante un identificador ajeno al menú', () => {
    expect(siguienteVista('inicio', 'pacientes')).toBe('inicio');
    expect(siguienteVista('furag', 'desconocido')).toBe('furag');
  });
});

describe('municipalityViews — selector temporal', () => {
  it('declara los cinco periodos aprobados, en orden', () => {
    expect([...MUNICIPALITY_PERIODOS]).toStrictEqual([
      'mes',
      'trimestre',
      'semestre',
      'ano',
      'personalizado',
    ]);
    expect(MUNICIPALITY_PERIODOS_CONFIG.map((periodo) => periodo.etiqueta)).toStrictEqual([
      'Este mes',
      'Trimestre',
      'Semestre',
      'Año',
      'Personalizado',
    ]);
  });

  it('inicia en «Este mes»', () => {
    expect(MUNICIPALITY_PERIODO_INICIAL).toBe('mes');
    expect(MUNICIPALITY_PERIODOS_CONFIG[0]?.id).toBe(MUNICIPALITY_PERIODO_INICIAL);
  });

  it('reconoce solo los cinco periodos', () => {
    expect(esPeriodoMunicipal('trimestre')).toBe(true);
    expect(esPeriodoMunicipal('decada')).toBe(false);
  });

  it('la selección es exclusiva: cada periodo sustituye al anterior', () => {
    let periodo = MUNICIPALITY_PERIODO_INICIAL;

    for (const solicitado of MUNICIPALITY_PERIODOS) {
      periodo = siguientePeriodo(periodo, solicitado);
      expect(periodo).toBe(solicitado);
    }

    /* `Personalizado` solo queda seleccionado: no abre ni exige nada más. */
    expect(periodo).toBe('personalizado');
  });

  it('conserva el periodo actual ante un identificador desconocido', () => {
    expect(siguientePeriodo('semestre', 'quinquenio')).toBe('semestre');
  });
});
