import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import ProfesionalPage from './page';

/**
 * Frontera de la portada `/profesional` (SPEC 038, MP04 §12).
 *
 * MP04 cierra esta ruta: monta la PUERTA, no la vista, y no acepta ningún
 * atajo por URL. La worklist vacía es un estado legítimo —no una denegación—
 * y por eso la ruta no decide nada, solo compone la entrada.
 */
const VISTA = fileURLToPath(new URL('./page.tsx', import.meta.url));

function codigoRuta(): string {
  return readFileSync(VISTA, 'utf8');
}

describe('/profesional — portada protegida del profesional (MP04 §12)', () => {
  it('monta la PUERTA, no la vista, y no monta ninguna otra portada', () => {
    const codigo = codigoRuta();

    expect(codigo).toContain('<ProfesionalPortalProtegido />');
    expect(codigo).not.toContain('<ProfesionalPortal ');
    expect(codigo).not.toContain('PacienteExperience');
    expect(codigo).not.toContain('CaregiverAccessPortal');
    expect(codigo).not.toContain('LiquidationsDemo');
  });

  it('no acepta ningún atajo por URL ni inyecta sesión ni datos', () => {
    const codigo = codigoRuta();

    for (const prohibido of [
      'searchParams',
      'useSearchParams',
      'window.location',
      'process.env',
      'localStorage',
      'sessionStorage',
      'document.cookie',
      'estadoInicial',
      'fetchImpl',
      'fetch(',
      'urlDeLoginHumano',
    ]) {
      expect(`${prohibido}: ${String(codigo.includes(prohibido))}`).toBe(
        `${prohibido}: false`,
      );
    }
  });

  it('renderiza la comprobación y ninguna visita ni identidad', () => {
    const html = renderToStaticMarkup(<ProfesionalPage />);

    expect(html).toContain('Comprobando su experiencia aprobada');
    expect(html).toContain('aria-live="polite"');

    // Ni visitas, ni nombres, ni liquidaciones antes de que el servidor responda.
    for (const ajeno of [
      'Hoja de Ruta del Día',
      'Dra. Laura',
      'Mis pagos y liquidaciones',
      'VIS-001',
    ]) {
      expect(html).not.toContain(ajeno);
    }
  });

  it('la portada no se indexa', () => {
    expect(codigoRuta()).toContain('robots: { index: false, follow: false }');
  });
});
