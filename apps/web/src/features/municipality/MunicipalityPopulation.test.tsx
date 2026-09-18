import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  MunicipalityPopulation,
  MunicipalityPopulationView,
} from './MunicipalityPopulation';
import {
  CLAVES_INTERSECCION,
  ETIQUETAS_INTERSECCION,
  ETIQUETAS_METRICA_OFICIAL,
  ETIQUETAS_POBLACION,
  TEXTOS_AGREGADOS,
  type EstadoAgregado,
  type PopulationSummary,
  type SuppressedCount,
} from './municipalityAggregates';
import { municipalityDemo } from './municipalityConfig';
import { apariciones, texto } from './municipalityTestUtils';

/**
 * Vista «Población beneficiaria» conectada a datos reales
 * (TASK-MUNICIPALITY-CORE-01, pruebas T-06, T-08, T-09, T-10 y T-11).
 *
 * La vista se renderiza con `react-dom/server`, igual que el resto del
 * frontend: el repositorio no incluye jsdom ni una librería de testing con DOM
 * y esta tarea no autoriza añadir dependencias. Por eso la presentación se
 * verifica sobre `MunicipalityPopulationView`, que recibe el estado ya resuelto,
 * y el montaje real se comprueba sobre el componente conectado. El movimiento
 * del foco y el recorrido de teclado se verifican manualmente en navegador y se
 * reportan como NO automatizados.
 *
 * Ninguna cifra de estas pruebas procede de un fixture de diseño: todas se
 * construyen aquí como respuesta sintética de la API.
 */

const FUENTE = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'MunicipalityPopulation.tsx'),
  'utf8',
);

function exacto(value: number): SuppressedCount {
  return { status: 'EXACT', value, display: String(value) };
}

const SUPRIMIDO: SuppressedCount = { status: 'SUPPRESSED', value: null, display: '<5' };

function respuesta(overrides: Partial<PopulationSummary> = {}): PopulationSummary {
  return {
    source: 'ELOISA_POSTGRESQL',
    asOfDate: '2026-08-22',
    generatedAt: '2026-08-22T14:05:00.000Z',
    uniqueRegistered: exacto(68),
    populations: {
      olderAdult60Plus: exacto(47),
      disabilityDeclared: exacto(33),
      homeCareRequiredDeclared: exacto(35),
    },
    exclusiveIntersections: {
      olderOnly: exacto(11),
      disabilityOnly: exacto(9),
      homeCareOnly: exacto(7),
      olderAndDisabilityOnly: exacto(13),
      olderAndHomeCareOnly: exacto(17),
      disabilityAndHomeCareOnly: exacto(5),
      allThree: exacto(6),
    },
    officialMetrics: [
      { metric: 'municipalTotalPopulation', status: 'UNAVAILABLE', value: null },
      { metric: 'officialTargetPopulation', status: 'UNAVAILABLE', value: null },
      { metric: 'disabilityNationalRegistry', status: 'UNAVAILABLE', value: null },
      { metric: 'coverageOverTargetPopulation', status: 'UNAVAILABLE', value: null },
    ],
    quality: { territoryPendingNormalization: exacto(12) },
    ...overrides,
  };
}

function render(estado: EstadoAgregado<PopulationSummary>): string {
  return renderToStaticMarkup(<MunicipalityPopulationView estado={estado} />);
}

const LISTO = render({ estado: 'listo', datos: respuesta() });
const VISIBLE = texto(LISTO);

describe('MunicipalityPopulation — encabezado y procedencia', () => {
  it('conserva el título aprobado con un solo h1 enfocable', () => {
    expect(apariciones(LISTO, /<h1\b/gu)).toBe(1);
    expect(LISTO).toMatch(/<h1[^>]*tabindex="-1"/u);
    expect(VISIBLE).toContain(municipalityDemo.poblacion.titulo);
  });

  it('declara la procedencia real y el corte, sin afirmar oficialidad', () => {
    expect(VISIBLE).toContain(TEXTOS_AGREGADOS.fuenteEtiqueta);
    expect(VISIBLE).toContain('Información con corte a 2026-08-22.');
    expect(VISIBLE).toContain(TEXTOS_AGREGADOS.sinFuenteOficial);
  });

  it('mantiene la jerarquía de encabezados de las tres secciones', () => {
    expect(apariciones(LISTO, /<h2\b/gu)).toBe(3);
    expect(apariciones(LISTO, /<h[3-6]\b/gu)).toBe(0);
    expect(apariciones(LISTO, /<section[^>]*aria-labelledby="/gu)).toBe(3);
  });
});

describe('MunicipalityPopulation — cifras reales (T-09)', () => {
  it('muestra los conteos que devolvió la API, no los del fixture', () => {
    expect(VISIBLE).toContain('68');
    expect(VISIBLE).toContain(ETIQUETAS_POBLACION.uniqueRegistered);
    expect(VISIBLE).toContain(ETIQUETAS_POBLACION.olderAdult60Plus);

    // Las cifras demostrativas de A-02 ya no aparecen en ninguna parte.
    for (const fixture of ['3.050', '812.400', '8.142', '37,5 %', '5.092']) {
      expect(VISIBLE).not.toContain(fixture);
    }
  });

  it('presenta las siete combinaciones exclusivas y el total una sola vez', () => {
    for (const clave of CLAVES_INTERSECCION) {
      expect(VISIBLE).toContain(ETIQUETAS_INTERSECCION[clave]);
    }

    expect(apariciones(LISTO, /class="[^"]*segmentTotal/gu)).toBe(1);
  });

  it('declara las métricas oficiales como no disponibles, sin porcentaje ni barra', () => {
    for (const clave of [
      'municipalTotalPopulation',
      'officialTargetPopulation',
      'disabilityNationalRegistry',
      'coverageOverTargetPopulation',
    ] as const) {
      expect(VISIBLE).toContain(ETIQUETAS_METRICA_OFICIAL[clave]);
    }

    expect(apariciones(LISTO, /Dato oficial no disponible/gu)).toBe(4);
    expect(VISIBLE).not.toContain('%');
    expect(LISTO).not.toContain('barFill');
  });

  it('no muestra hallazgos de calidad que MERDN no puede calcular', () => {
    for (const inexistente of [
      'Duplicados potenciales',
      'Personas sin EPS identificada',
      'Documentos pendientes',
      'Afiliaciones por verificar',
      'Registros completos',
    ]) {
      expect(VISIBLE).not.toContain(inexistente);
    }

    expect(VISIBLE).toContain('Registros pendientes de normalización territorial');
  });
});

describe('MunicipalityPopulation — protección de grupos pequeños (T-08)', () => {
  it('muestra «menos de 5» sin revelar la cifra y lo explica', () => {
    const html = render({
      estado: 'listo',
      datos: respuesta({
        uniqueRegistered: SUPRIMIDO,
        exclusiveIntersections: {
          olderOnly: SUPRIMIDO,
          disabilityOnly: exacto(0),
          homeCareOnly: exacto(0),
          olderAndDisabilityOnly: exacto(0),
          olderAndHomeCareOnly: exacto(0),
          disabilityAndHomeCareOnly: exacto(0),
          allThree: exacto(0),
        },
      }),
    });

    const visible = texto(html);

    expect(visible).toContain('<5');
    expect(visible).toContain('Grupo pequeño protegido');
    expect(visible).toContain(TEXTOS_AGREGADOS.supresion);
  });

  it('la vista no calcula ninguna cifra por su cuenta', () => {
    // Sin aritmética no puede reconstruirse un valor suprimido en el navegador.
    expect(FUENTE).not.toMatch(/\.value\s*[+\-*/]/u);
    expect(FUENTE).not.toContain('reduce(');
    expect(FUENTE).not.toContain('Math.');
  });
});

describe('MunicipalityPopulation — estados de la consulta (T-10)', () => {
  it('el primer render consulta y anuncia la carga, sin ninguna cifra', () => {
    const html = renderToStaticMarkup(<MunicipalityPopulation />);
    const visible = texto(html);

    expect(visible).toContain(TEXTOS_AGREGADOS.cargando);
    expect(html).toContain('role="status"');
    expect(visible).toContain(municipalityDemo.poblacion.titulo);
    expect(visible).toContain(municipalityDemo.poblacion.objetivoTitulo);
    expect(visible).not.toContain('3.050');
  });

  it('una sesión no vigente se comunica y no se rellena con fixtures', () => {
    const visible = texto(render({ estado: 'no-autorizado' }));

    expect(visible).toContain(TEXTOS_AGREGADOS.noAutorizado);
    expect(visible).not.toContain('3.050');
    expect(visible).not.toContain(ETIQUETAS_POBLACION.uniqueRegistered);
  });

  it('un fallo de la consulta se comunica y se anuncia como alerta', () => {
    const html = render({ estado: 'error' });

    expect(texto(html)).toContain(TEXTOS_AGREGADOS.error);
    expect(html).toContain('role="alert"');
    expect(texto(html)).not.toContain('3.050');
  });

  it('cero personas registradas se muestra como cero exacto, no como vacío falso', () => {
    const visible = texto(
      render({
        estado: 'listo',
        datos: respuesta({
          uniqueRegistered: exacto(0),
          populations: {
            olderAdult60Plus: exacto(0),
            disabilityDeclared: exacto(0),
            homeCareRequiredDeclared: exacto(0),
          },
        }),
      }),
    );

    expect(visible).toContain('0');
    expect(visible).toContain(ETIQUETAS_POBLACION.uniqueRegistered);
  });
});

describe('MunicipalityPopulation — privacidad y ausencia de fixtures (T-06)', () => {
  it('no importa ni consume los fixtures de población de diseño', () => {
    expect(FUENTE).not.toContain('municipalityPoblacionDemo');
    // Del fixture solo se conservan los TÍTULOS aprobados de las secciones.
    expect(FUENTE).not.toContain('poblacion.objetivo.');
    expect(FUENTE).not.toContain('poblacion.intersecciones');
    expect(FUENTE).not.toContain('poblacion.calidad.');
    expect(FUENTE).not.toContain('poblacion.descripcion');
    // La barra de cobertura desaparece: sin denominador oficial no hay porcentaje.
    expect(FUENTE).not.toContain('styles.coverage');
    expect(FUENTE).not.toContain('coberturaPorcentaje');
  });

  it('el diagrama es decorativo y la lista es la representación canónica', () => {
    expect(LISTO).toContain('data-municipality-diagrama="intersecciones"');
    expect(LISTO).toMatch(/<div[^>]*aria-hidden="true"[^>]*data-municipality-diagrama/u);
    expect(VISIBLE).toContain('Diagrama decorativo de tres poblaciones');
  });

  it('no ofrece búsqueda, exportación ni acceso a ninguna persona', () => {
    expect(LISTO).not.toMatch(/<input\b/u);
    expect(LISTO).not.toMatch(/<a\b/u);
    expect(LISTO).not.toMatch(/<button\b/u);
    expect(VISIBLE).not.toContain('Exportar');
  });
});
