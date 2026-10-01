import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import HospitalPage from './page';

/**
 * Frontera de sesión y modo demo de la ruta `/hospital` (spec 022 y spec 038).
 *
 * La ruta normal no inyecta ninguna sesión demostrativa: la composición
 * resuelve el contexto del lado del servidor a través del shell. El modo demo
 * local solo se habilita mediante configuración explícita server-side y ningún
 * parámetro de URL lo activa.
 */
const VISTA = fileURLToPath(new URL('./page.tsx', import.meta.url));

function codigoRuta(): string {
  return readFileSync(VISTA, 'utf8');
}

function renderRuta(): string {
  return renderToStaticMarkup(<HospitalPage />);
}

describe('/hospital — ruta protegida y modo demo (spec 022, spec 038)', () => {
  it('la ruta monta el shell y no tiene manera de inyectar sesión por URL', () => {
    const codigo = codigoRuta();

    expect(codigo).toContain('HospitalShell');

    // Ningún parámetro de URL puede activar el bypass.
    for (const prohibido of ['searchParams', 'useSearchParams', 'window.location']) {
      expect(`${prohibido}: ${String(codigo.includes(prohibido))}`).toBe(
        `${prohibido}: false`,
      );
    }
  });

  it('el modo demo solo se habilita mediante configuración de servidor explícita', () => {
    const codigo = codigoRuta();

    expect(codigo).toContain('process.env.MERDN_HOSPITAL_DEMO_LOCAL');
    expect(codigo).toContain("=== 'true'");
  });

  it('por defecto resuelve la sesión del servidor: sin sesión no monta el panel', () => {
    // Valor por defecto cerrado: sin variable, la ruta es la protegida.
    delete process.env.MERDN_HOSPITAL_DEMO_LOCAL;

    const html = renderRuta();

    expect(html).toContain('Comprobando acceso institucional…');
    expect(html).not.toContain('data-hospital-content');
    // La envuelta neutral de Hospital declara su navegación bloqueada, no operable.
    expect(html).not.toContain('data-hospital-nav="navegable"');
    expect(html).not.toContain('Datos ficticios de demostración local');
  });

  it('con la configuración server-side activa sí muestra la demostración local', () => {
    process.env.MERDN_HOSPITAL_DEMO_LOCAL = 'true';

    try {
      const html = renderRuta();

      expect(html).toContain('Datos ficticios de demostración local');
      expect(html).toContain('data-hospital-content');
    } finally {
      delete process.env.MERDN_HOSPITAL_DEMO_LOCAL;
    }
  });
});
