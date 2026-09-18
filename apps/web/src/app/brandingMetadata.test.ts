import { describe, expect, it, vi } from 'vitest';

/**
 * `next/font/google` solo existe dentro del pipeline de Next.js: fuera de él la
 * factoría no es invocable. La prueba la sustituye por un doble inerte para
 * poder importar la metadata raíz sin cambiar `layout.tsx` ni el runtime.
 */
vi.mock('next/font/google', () => ({
  Nunito: () => ({ variable: '--font-nunito', className: 'nunito' }),
}));

import { metadata as inscripcionMetadata } from './layout';
import { metadata as hospitalMetadata } from './hospital/page';
import { metadata as municipalityMetadata } from './municipality/page';

/**
 * Metadata visible de las tres rutas implementadas (TASK-BRAND-01, FR-09,
 * AC-06, T-07).
 *
 * El título del navegador es superficie visible: no puede exponer el nombre
 * técnico interno del proyecto ni el branding anterior. Las rutas (`/`,
 * `/hospital`, `/municipality`) no cambian; solo cambia el texto.
 */

const SUPERFICIES = [
  ['/', inscripcionMetadata, 'Eloisa — Inscripción'],
  ['/hospital', hospitalMetadata, 'Eloisa — Hospital'],
  ['/municipality', municipalityMetadata, 'Eloisa — Alcaldía'],
] as const;

/** Cadenas prohibidas en cualquier metadata visible (AC-08). */
const MARCA_PROHIBIDA: readonly RegExp[] = [
  /ELÍGEME/u,
  /Elígeme/u,
  /(?<![A-Za-zÁÉÍÓÚÜÑáéíóúüñ])Elí(?![A-Za-zÁÉÍÓÚÜÑáéíóúüñ])/u,
  /(?<![A-Za-zÁÉÍÓÚÜÑáéíóúüñ])ELI(?![A-Za-zÁÉÍÓÚÜÑáéíóúüñ])/u,
  /Evidencia\s*·?\s*Local\s*·?\s*Inteligente/iu,
  /MERDN/u,
];

describe('metadata de las rutas implementadas (T-07)', () => {
  for (const [ruta, metadata, esperado] of SUPERFICIES) {
    it(`${ruta} declara exactamente «${esperado}»`, () => {
      expect(metadata.title).toBe(esperado);
    });

    it(`${ruta} no expone branding prohibido en título ni descripción`, () => {
      const texto = `${String(metadata.title)} ${String(metadata.description)}`;

      for (const patron of MARCA_PROHIBIDA) {
        expect(texto).not.toMatch(patron);
      }
    });

    it(`${ruta} conserva la política de indexación existente`, () => {
      expect(metadata.robots).toEqual({ index: false, follow: false });
    });
  }
});
