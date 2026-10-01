import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import CaregiverPage from './page';

/**
 * Frontera de la portada `/cuidador` (SPEC 038, MP04 §12).
 *
 * MP04 cierra esta ruta: deja de montar la muestra visual directamente y pasa
 * a montar la envoltura protegida. Aquí se comprueba que la ruta no inyecta
 * nada, no admite atajos por URL y no vuelve a abrir el contenido sin pasar
 * por la comprobación de experiencia y relación.
 */
const VISTA = fileURLToPath(new URL('./page.tsx', import.meta.url));

function codigoRuta(): string {
  return readFileSync(VISTA, 'utf8');
}

describe('/cuidador — portada protegida del cuidador (MP04 §12)', () => {
  it('mantiene la envoltura protegida y reserva la muestra para la bandera local', () => {
    const codigo = codigoRuta();

    expect(codigo).toContain('<CaregiverAccessPortal />');
    expect(codigo).toContain('humanAccessDemoLocalEnabled()');
    expect(codigo).toContain('<CaregiverLiquidationsDemo />');
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
    ]) {
      expect(`${prohibido}: ${String(codigo.includes(prohibido))}`).toBe(
        `${prohibido}: false`,
      );
    }
  });

  it('renderiza la comprobación y ningún contenido de la demostración', () => {
    const html = renderToStaticMarkup(<CaregiverPage />);

    expect(html).toContain('Comprobando su experiencia aprobada');
    expect(html).toContain('aria-live="polite"');
    expect(html).not.toContain('data-caregiver-demo-local');
    expect(html).not.toContain('Mis pagos y liquidaciones');
  });

  it('la portada no se indexa', () => {
    expect(codigoRuta()).toContain('robots: { index: false, follow: false }');
  });
});
