import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { HospitalShell } from '@/features/hospital/HospitalShell';
import { SESION_INSTITUCIONAL_FICTICIA } from '@/features/hospital/hospitalTestUtils';
import { MunicipalityShell } from '@/features/municipality/MunicipalityShell';

import { branding, platformNameInSentence } from './branding';
import type { BrandingConfig } from './branding';

const SUSTITUTO: BrandingConfig = {
  platformDisplayName: 'CUIDAMOS',
  platformTagline: 'RED DE CUIDADO',
  aiDisplayName: 'Ana',
};

/**
 * Cadenas de marca prohibidas en cualquier superficie visible (TASK-BRAND-01,
 * AC-08). El antiguo nombre de la asistente solo se prohíbe como palabra
 * completa: los identificadores técnicos (`EliBubble`, `eliExpressions`,
 * `/eli/*.png`, `ELIGEME` como clave de origen y `merdn-sr-only`) están fuera
 * de alcance y no son texto visible.
 */
const MARCA_PROHIBIDA: readonly RegExp[] = [
  /ELÍGEME/u,
  /Elígeme/u,
  /(?<![A-Za-zÁÉÍÓÚÜÑáéíóúüñ])Elí(?![A-Za-zÁÉÍÓÚÜÑáéíóúüñ])/u,
  /(?<![A-Za-zÁÉÍÓÚÜÑáéíóúüñ])ELI(?![A-Za-zÁÉÍÓÚÜÑáéíóúüñ])/u,
  /Evidencia\s*·?\s*Local\s*·?\s*Inteligente/iu,
  /MERDN/u,
];

/** Renderiza la entrada con una configuración de branding dada (T-16). */
async function renderConBranding(
  config: BrandingConfig,
  superficie: 'portal' | 'asistente' = 'portal',
): Promise<string> {
  vi.resetModules();
  vi.doMock('@/config/branding', () => ({
    branding: config,
    platformNameInSentence: (given: BrandingConfig = config) => {
      const [first = '', ...rest] = [...given.platformDisplayName];
      return first + rest.join('').toLocaleLowerCase('es-CO');
    },
  }));

  if (superficie === 'asistente') {
    const { EliBubble } = await import('@/components/ui/EliBubble');
    return renderToStaticMarkup(<EliBubble stepHelp="Ayuda de prueba" topics={[]} />);
  }

  const { default: Page } = await import('@/app/page');
  return renderToStaticMarkup(<Page />);
}

/** Sustituye las apariciones de marca por marcadores neutros. */
function normalizar(markup: string, config: BrandingConfig): string {
  const sentence = platformNameInSentence(config);
  return markup
    .split(config.platformDisplayName)
    .join('«PLATAFORMA»')
    .split(sentence)
    .join('«PLATAFORMA»')
    .split(config.platformTagline)
    .join('«BAJADA»')
    .split(config.aiDisplayName)
    .join('«IA»');
}

/**
 * Retira de un markup las referencias técnicas que nunca llegan al usuario
 * como texto (clase utilitaria de lector de pantalla y rutas de asset). Sin
 * esta limpieza la búsqueda negativa sería ingenua y confundiría
 * `merdn-sr-only` o `/eli/*.png` con branding visible.
 */
function sinReferenciasTecnicas(markup: string): string {
  return markup.replace(/merdn-sr-only/gu, '').replace(/\/eli\/[\w.-]+/gu, '');
}

afterEach(() => {
  vi.doUnmock('@/config/branding');
  vi.resetModules();
});

describe('configuración de branding definitiva (TASK-BRAND-01, T-01)', () => {
  it('declara exactamente los nombres visibles aprobados', () => {
    expect(branding.platformDisplayName).toBe('Eloisa');
    expect(branding.aiDisplayName).toBe('Isa');
    expect(branding.platformTagline).toBe('ATENCIÓN DOMICILIARIA');
  });

  it('ya no declara el subtítulo de inscripción retirado', () => {
    expect(branding).not.toHaveProperty('inscriptionSubtitle');

    for (const value of Object.values(branding)) {
      expect(value).not.toContain('Evidencia');
      expect(value).not.toContain('Inteligente');
    }
  });

  it('compone el nombre dentro de una frase sin degradar acentos', () => {
    expect(platformNameInSentence()).toBe('Eloisa');
    expect(platformNameInSentence(SUSTITUTO)).toBe('Cuidamos');
  });

  it('no expone secretos, entorno, tenant ni funciones de red', () => {
    const keys = Object.keys(branding).sort();
    expect(keys).toEqual(['aiDisplayName', 'platformDisplayName', 'platformTagline']);

    for (const value of Object.values(branding)) {
      expect(typeof value).toBe('string');
    }

    const source = sinComentarios(
      readFileSync(fileURLToPath(new URL('./branding.ts', import.meta.url)), 'utf8'),
    );
    for (const forbidden of ['process.env', 'fetch(', 'tenant', 'secret', 'token']) {
      expect(source).not.toContain(forbidden);
    }
  });
});

describe('sustitución futura de los nombres visibles (T-16)', () => {
  it('cambia las apariciones de marca sin cambiar la estructura renderizada', async () => {
    const conDefecto = await renderConBranding(branding);
    const conSustituto = await renderConBranding(SUSTITUTO);

    expect(conDefecto).toContain('Eloisa');
    expect(conDefecto).toContain('Portal Eloisa');

    expect(conSustituto).toContain('CUIDAMOS');
    expect(conSustituto).toContain('Portal Cuidamos');
    expect(conSustituto).not.toContain('Eloisa');

    expect(normalizar(conSustituto, SUSTITUTO)).toBe(normalizar(conDefecto, branding));
  }, 15000);

  it('sustituye el nombre de la asistente conservando su estructura', async () => {
    const conDefecto = await renderConBranding(branding, 'asistente');
    const conSustituto = await renderConBranding(SUSTITUTO, 'asistente');

    expect(conDefecto).toContain('Isa');
    expect(conSustituto).toContain('Ana');
    expect(conSustituto).not.toContain('Isa');
    expect(normalizar(conSustituto, SUSTITUTO)).toBe(normalizar(conDefecto, branding));
  }, 15000);
});

/* -------------------------------------------------------------------------- */
/* T-09: búsqueda negativa sobre superficies renderizadas                      */
/* -------------------------------------------------------------------------- */

describe('superficies renderizadas sin branding prohibido (T-05, T-06, T-09)', () => {
  const superficies: readonly (readonly [string, () => string])[] = [
    ['/hospital', () => renderToStaticMarkup(<HospitalShell sesionInicial={SESION_INSTITUCIONAL_FICTICIA} />)],
    ['/municipality', () => renderToStaticMarkup(<MunicipalityShell />)],
  ];

  for (const [ruta, render] of superficies) {
    it(`${ruta} muestra Eloisa desde la fuente central`, () => {
      expect(render()).toContain(branding.platformDisplayName);
    });

    it(`${ruta} no renderiza ninguna cadena de marca prohibida`, () => {
      const visible = sinReferenciasTecnicas(render());

      for (const patron of MARCA_PROHIBIDA) {
        expect(visible).not.toMatch(patron);
      }
    });
  }
});

/* -------------------------------------------------------------------------- */
/* T-17: sin literales de marca fuera de la configuración                      */
/* -------------------------------------------------------------------------- */

const SRC_ROOT = fileURLToPath(new URL('..', import.meta.url));

function archivosFuente(directory: string): string[] {
  const entries = readdirSync(directory, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return archivosFuente(full);
    }
    if (!/\.tsx?$/u.test(entry.name)) {
      return [];
    }
    return [full];
  });
}

/** Elimina comentarios de bloque y de línea para inspeccionar solo el código. */
function sinComentarios(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/^\s*\/\/.*$/gmu, '');
}

describe('literales de marca centralizados (T-02, T-17)', () => {
  /**
   * Únicas excepciones admitidas: las pruebas que necesitan escribir las
   * cadenas prohibidas para poder afirmar su ausencia. Ningún archivo
   * productivo puede exceptuarse —un infractor se corrige en su origen, nunca
   * ampliando esta lista (AC-09)—, y la propia prueba lo verifica.
   */
  const excepciones = new Set([
    path.join(SRC_ROOT, 'config', 'branding.test.tsx'),
    path.join(SRC_ROOT, 'app', 'page.test.tsx'),
    path.join(SRC_ROOT, 'app', 'brandingMetadata.test.ts'),
  ]);

  it('solo exceptúa pruebas de búsqueda negativa, nunca código productivo', () => {
    for (const excepcion of excepciones) {
      expect(excepcion).toMatch(/\.test\.tsx?$/u);
    }
  });

  it('ningún archivo declara el branding anterior', () => {
    const infractores: string[] = [];

    for (const file of archivosFuente(SRC_ROOT)) {
      if (excepciones.has(file)) {
        continue;
      }
      const code = sinComentarios(readFileSync(file, 'utf8'));
      if (
        /ELÍGEME|Elígeme|(?<![A-Za-zÁÉÍÓÚÜÑáéíóúüñ])Elí(?![A-Za-zÁÉÍÓÚÜÑáéíóúüñ])/u.test(code) ||
        /Evidencia\s*·?\s*Local\s*·?\s*Inteligente/iu.test(code)
      ) {
        infractores.push(path.relative(SRC_ROOT, file));
      }
    }

    expect(infractores).toEqual([]);
  });

  it('solo la configuración y sus pruebas declaran los nombres definitivos', () => {
    const permitidos = new Set([
      path.join(SRC_ROOT, 'config', 'branding.ts'),
      path.join(SRC_ROOT, 'config', 'branding.test.tsx'),
      path.join(SRC_ROOT, 'app', 'page.test.tsx'),
      path.join(SRC_ROOT, 'app', 'brandingMetadata.test.ts'),
      /*
       * Excepción cerrada mínima: el shell Hospital integra la marca (H-FID-B)
       * y este archivo de prueba afirma esa integración usando los nombres en
       * sus títulos. No es una prueba de búsqueda negativa, por eso vive en
       * `permitidos` y no en `excepciones`.
       */
      path.join(SRC_ROOT, 'features', 'hospital', 'hospitalShell.test.tsx'),
    ]);

    const duplicados: string[] = [];

    for (const file of archivosFuente(SRC_ROOT)) {
      if (permitidos.has(file)) {
        continue;
      }
      const code = sinComentarios(readFileSync(file, 'utf8'));
      if (
        /(?<![A-Za-zÁÉÍÓÚÜÑáéíóúüñ])Eloisa(?![A-Za-zÁÉÍÓÚÜÑáéíóúüñ])/u.test(code) ||
        /(?<![A-Za-zÁÉÍÓÚÜÑáéíóúüñ])Isa(?![A-Za-zÁÉÍÓÚÜÑáéíóúüñ])/u.test(code)
      ) {
        duplicados.push(path.relative(SRC_ROOT, file));
      }
    }

    expect(duplicados).toEqual([]);
  });
});
