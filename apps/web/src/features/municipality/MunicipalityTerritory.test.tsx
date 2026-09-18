import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { MunicipalityTerritory, MunicipalityTerritoryView } from './MunicipalityTerritory';
import {
  COLUMNAS_TERRITORIO,
  ETIQUETAS_AREA,
  TEXTOS_AGREGADOS,
  type EstadoAgregado,
  type SuppressedCount,
  type TerritoryMetrics,
  type TerritorySummary,
} from './municipalityAggregates';
import { municipalityDemo } from './municipalityConfig';
import { apariciones, texto } from './municipalityTestUtils';

/**
 * Vista «Territorio» conectada a datos reales
 * (TASK-MUNICIPALITY-CORE-01, pruebas T-06, T-07, T-08, T-10 y T-11).
 *
 * La vista se renderiza con `react-dom/server`: el repositorio no incluye jsdom
 * ni una librería de testing con DOM y esta tarea no autoriza añadir
 * dependencias. El reflow real, el foco y el zoom al 200 % se verifican
 * manualmente en navegador y se reportan como NO automatizados.
 */

const FUENTE = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'MunicipalityTerritory.tsx'),
  'utf8',
);

function exacto(value: number): SuppressedCount {
  return { status: 'EXACT', value, display: String(value) };
}

const SUPRIMIDO: SuppressedCount = { status: 'SUPPRESSED', value: null, display: '<5' };

function metricas(overrides: Partial<TerritoryMetrics> = {}): TerritoryMetrics {
  return {
    uniquePeople: exacto(24),
    olderAdult60Plus: exacto(9),
    disabilityDeclared: exacto(8),
    homeCareRequiredDeclared: exacto(7),
    pendingNormalization: exacto(7),
    ...overrides,
  };
}

function respuesta(overrides: Partial<TerritorySummary> = {}): TerritorySummary {
  return {
    source: 'ELOISA_POSTGRESQL',
    asOfDate: '2026-08-22',
    generatedAt: '2026-08-22T14:05:00.000Z',
    municipalities: [
      {
        officialCode: '05001',
        displayName: 'Medellín',
        metrics: metricas(),
        areas: [
          {
            areaType: 'URBAN',
            metrics: metricas({ uniquePeople: exacto(16) }),
            localUnits: [
              {
                localUnitId: 'unidad-a',
                kind: 'CANONICAL',
                displayName: 'Barrio Ficticio A',
                metrics: metricas({
                  uniquePeople: exacto(9),
                  pendingNormalization: exacto(0),
                }),
              },
              {
                localUnitId: null,
                kind: 'PENDING_NORMALIZATION',
                displayName: 'Pendiente de normalización territorial',
                metrics: metricas({ uniquePeople: exacto(7) }),
              },
            ],
          },
          {
            areaType: 'RURAL',
            metrics: metricas({
              uniquePeople: exacto(8),
              pendingNormalization: exacto(0),
            }),
            localUnits: [
              {
                localUnitId: 'unidad-c',
                kind: 'CANONICAL',
                displayName: 'Vereda Ficticia C',
                metrics: metricas({
                  uniquePeople: exacto(8),
                  pendingNormalization: exacto(0),
                }),
              },
            ],
          },
        ],
      },
    ],
    ...overrides,
  };
}

function render(estado: EstadoAgregado<TerritorySummary>): string {
  return renderToStaticMarkup(<MunicipalityTerritoryView estado={estado} />);
}

const LISTO = render({ estado: 'listo', datos: respuesta() });
const VISIBLE = texto(LISTO);

describe('MunicipalityTerritory — encabezado y procedencia', () => {
  it('conserva el título aprobado con un solo h1 enfocable', () => {
    expect(apariciones(LISTO, /<h1\b/gu)).toBe(1);
    expect(LISTO).toMatch(/<h1[^>]*tabindex="-1"/u);
    expect(VISIBLE).toContain(municipalityDemo.territorio.titulo);
  });

  it('declara procedencia real, corte y ausencia de fuente oficial', () => {
    expect(VISIBLE).toContain(TEXTOS_AGREGADOS.fuenteEtiqueta);
    expect(VISIBLE).toContain('Información con corte a 2026-08-22.');
    expect(VISIBLE).toContain(TEXTOS_AGREGADOS.sinFuenteOficial);
    expect(VISIBLE).toContain(TEXTOS_AGREGADOS.supresion);
  });
});

describe('MunicipalityTerritory — adaptación de columnas aprobada (OD-03)', () => {
  it('conserva la columna de zona y sustituye visitas, alertas y cobertura', () => {
    expect(VISIBLE).toContain(municipalityDemo.territorio.columnas.zona);
    expect(VISIBLE).toContain(COLUMNAS_TERRITORIO.personas);
    expect(VISIBLE).toContain(COLUMNAS_TERRITORIO.mayores);
    expect(VISIBLE).toContain(COLUMNAS_TERRITORIO.discapacidad);
    expect(VISIBLE).toContain(COLUMNAS_TERRITORIO.cuidado);
    expect(VISIBLE).toContain(COLUMNAS_TERRITORIO.pendientes);

    expect(VISIBLE).not.toContain('VISITAS');
    expect(VISIBLE).not.toContain('ALERTAS');
    expect(VISIBLE).not.toContain('COBERTURA');
  });

  it('sigue siendo una tabla con encabezados de fila y de columna', () => {
    expect(apariciones(LISTO, /<th[^>]*scope="col"/gu)).toBe(6);
    // Una fila de municipio, dos de área y tres de unidad local.
    expect(apariciones(LISTO, /<th[^>]*scope="row"/gu)).toBe(6);
    expect(LISTO).toContain('<caption');
    expect(LISTO).toMatch(/role="group"[^>]*aria-labelledby="municipality-territorio-titulo"/u);
  });

  it('no muestra barras, mapas ni conclusiones de la etapa demostrativa', () => {
    expect(LISTO).not.toContain('barFill');
    expect(VISIBLE).not.toContain(municipalityDemo.territorio.insight);
    expect(VISIBLE).not.toContain(municipalityDemo.territorio.alertasAclaracion);
    expect(FUENTE).not.toContain('territorio.zonas');
    expect(FUENTE).not.toContain('coberturaPorcentaje');
  });
});

describe('MunicipalityTerritory — jerarquía real (T-07)', () => {
  it('muestra municipio, zona urbana o rural y barrio o vereda', () => {
    expect(VISIBLE).toContain('Medellín');
    expect(VISIBLE).toContain(ETIQUETAS_AREA.URBAN);
    expect(VISIBLE).toContain(ETIQUETAS_AREA.RURAL);
    expect(VISIBLE).toContain('Barrio Ficticio A');
    expect(VISIBLE).toContain('Vereda Ficticia C');
  });

  it('separa los pendientes de normalización sin texto declarado', () => {
    expect(VISIBLE).toContain('Pendiente de normalización territorial');
    expect(VISIBLE).not.toContain('Localidad Ficticia');
  });

  it('las zonas demostrativas de A-02 ya no aparecen', () => {
    for (const zona of municipalityDemo.territorio.zonas) {
      expect(VISIBLE).not.toContain(zona.territorio.nombre);
    }
  });
});

describe('MunicipalityTerritory — protección de grupos pequeños (T-08)', () => {
  it('muestra «menos de 5» sin revelar la cifra', () => {
    const visible = texto(
      render({
        estado: 'listo',
        datos: respuesta({
          municipalities: [
            {
              officialCode: '05001',
              displayName: 'Medellín',
              metrics: metricas({ uniquePeople: SUPRIMIDO }),
              areas: [
                {
                  areaType: 'RURAL',
                  metrics: metricas({ uniquePeople: SUPRIMIDO }),
                  localUnits: [
                    {
                      localUnitId: 'unidad-z',
                      kind: 'CANONICAL',
                      displayName: 'Vereda Ficticia Z',
                      metrics: metricas({
                        uniquePeople: SUPRIMIDO,
                        pendingNormalization: exacto(0),
                      }),
                    },
                  ],
                },
              ],
            },
          ],
        }),
      }),
    );

    expect(visible).toContain('<5');
    expect(visible).toContain(TEXTOS_AGREGADOS.supresion);
  });

  it('la vista no suma ni resta ninguna celda', () => {
    expect(FUENTE).not.toMatch(/\.value\s*[+\-*/]/u);
    expect(FUENTE).not.toContain('reduce(');
    expect(FUENTE).not.toContain('Math.');
  });
});

describe('MunicipalityTerritory — estados de la consulta (T-10)', () => {
  it('el primer render anuncia la carga y conserva la identidad de la tabla', () => {
    const html = renderToStaticMarkup(<MunicipalityTerritory />);
    const visible = texto(html);

    expect(visible).toContain(TEXTOS_AGREGADOS.cargando);
    expect(html).toContain('role="status"');
    expect(visible).toContain(municipalityDemo.territorio.titulo);
    expect(visible).toContain(municipalityDemo.territorio.columnas.zona);
    expect(visible).not.toContain('742');
  });

  it('una sesión no vigente se comunica como alerta, sin fixtures', () => {
    const html = render({ estado: 'no-autorizado' });

    expect(texto(html)).toContain(TEXTOS_AGREGADOS.noAutorizado);
    expect(html).toContain('role="alert"');
    expect(texto(html)).not.toContain('Compartir');
  });

  it('un fallo de la consulta se comunica y no se rellena con fixtures', () => {
    const html = render({ estado: 'error' });

    expect(texto(html)).toContain(TEXTOS_AGREGADOS.error);
    expect(html).toContain('role="alert"');
    expect(texto(html)).not.toContain('742');
  });

  it('sin municipios registrados se declara el vacío, no una tabla inventada', () => {
    const html = render({
      estado: 'listo',
      datos: respuesta({ municipalities: [] }),
    });

    expect(texto(html)).toContain(TEXTOS_AGREGADOS.vacio);
    expect(html).not.toContain('<table');
  });
});

describe('MunicipalityTerritory — privacidad (T-06)', () => {
  it('no ofrece drill-down, enlaces, exportación ni búsqueda', () => {
    expect(LISTO).not.toMatch(/<a\b/u);
    expect(LISTO).not.toMatch(/<button\b/u);
    expect(LISTO).not.toMatch(/<input\b/u);
    expect(VISIBLE).not.toContain('Exportar');
    expect(VISIBLE).not.toContain('Ver detalle');
  });

  it('el identificador de unidad local no se imprime en el marcado visible', () => {
    expect(VISIBLE).not.toContain('unidad-a');
    expect(VISIBLE).not.toContain('unidad-c');
  });
});
