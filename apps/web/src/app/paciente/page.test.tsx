import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import PacientePage from './page';

/**
 * Frontera de la portada `/paciente` (SPEC 038, MP04 §12).
 *
 * MP04 convierte `/paciente` en una de las tres rutas protegidas: el único
 * camino hasta aquí es el selector de `/acceso` con la experiencia `PATIENT`
 * aprobada. Esto se comprueba sobre la FUENTE de la ruta y sobre su render
 * inicial, con la misma convención que `app/hospital/page.test.tsx`.
 *
 * La ruta no es la autoridad —lo son `patient-self` y `/me/contexts`, que
 * `PacienteExperience` vuelve a consultar al montarse—, pero tampoco puede
 * inyectar nada: ni sesión, ni datos, ni un modo demostrativo por query string.
 */
const VISTA = fileURLToPath(new URL('./page.tsx', import.meta.url));
const PORTAL = fileURLToPath(
  new URL('../../features/paciente/PacienteExperience.tsx', import.meta.url),
);

function codigoRuta(): string {
  return readFileSync(VISTA, 'utf8');
}

function codigoPortal(): string {
  return readFileSync(PORTAL, 'utf8');
}

describe('/paciente — portada protegida del paciente (MP04 §12)', () => {
  it('monta la experiencia del paciente y compone la URL OIDC fuera del navegador', () => {
    const codigo = codigoRuta();

    expect(codigo).toContain('<PacienteExperience');
    expect(codigo).toContain('urlDeLoginHumano()');

    // Ningún parámetro de URL, entorno ni almacenamiento activa o inyecta nada.
    for (const prohibido of [
      'searchParams',
      'useSearchParams',
      'window.location',
      'process.env',
      'localStorage',
      'sessionStorage',
      'document.cookie',
      'estadoInicial',
      'dependencias=',
      'fetchImpl',
    ]) {
      expect(`${prohibido}: ${String(codigo.includes(prohibido))}`).toBe(
        `${prohibido}: false`,
      );
    }
  });

  it('no monta el portal de otro rol ni declara un dato propio', () => {
    const codigo = codigoRuta();

    for (const ajeno of [
      'CaregiverLiquidationsDemo',
      'CaregiverAccessPortal',
      'ProfesionalPortal',
      'LiquidationsDemo',
    ]) {
      expect(codigo).not.toContain(ajeno);
    }

    // La ruta no trae datos: solo la URL de entrada.
    expect(codigo).not.toContain('fetch(');
    expect(codigo).not.toContain('async ');
  });

  it('renderiza el estado de comprobación y ningún dato del paciente', () => {
    const html = renderToStaticMarkup(<PacientePage />);

    // Carga: la ruta pinta la comprobación, no un panel ya abierto.
    expect(html).toContain('Comprobando su sesión');
    expect(html).toContain('aria-live="polite"');

    // Ningún título de sección con datos aparece hasta que el servidor confirma.
    for (const dato of ['Mis datos', 'Mis próximas citas', 'Mis visitas recientes']) {
      expect(html).not.toContain(dato);
    }
  });

  it('el portal que monta cubre los cinco estados que la portada debe manejar', () => {
    const portal = codigoPortal();

    // Carga, sin sesión, sesión sin experiencia, indisponibilidad y cierre.
    for (const fase of [
      "'comprobando'",
      "'sin-sesion'",
      "'sin-contexto'",
      "'no-disponible'",
      "'expirada'",
    ]) {
      expect(portal).toContain(fase);
    }

    expect(portal).toContain("'no-confirmado'");
    expect(portal).toContain('Cerrar sesión');

    // El cierre NO confirmado deja la sesión en pie y lo dice.
    expect(portal).toContain('SIGUE ABIERTA');
  });

  it('la portada no se indexa', () => {
    expect(codigoRuta()).toContain('robots: { index: false, follow: false }');
  });
});
