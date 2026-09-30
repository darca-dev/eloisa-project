import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { CaregiverAccessPortal } from './CaregiverAccessPortal';

/**
 * Portada protegida del Cuidador (SPEC 038, MP04 §12).
 *
 * Lo que se protege aquí es la DISTINCIÓN que hace esta portada: una cuenta
 * aprobada sin relación de cuidado no ve ningún dato nominal, y la decisión no
 * se toma en el navegador sino preguntando al servidor por el contexto
 * `CAREGIVER`, que solo emite con relación activa.
 */
const DIRECTORIO = fileURLToPath(new URL('.', import.meta.url));
const CODIGO = readFileSync(`${DIRECTORIO}CaregiverAccessPortal.tsx`, 'utf8')
  .replace(/\/\*[\s\S]*?\*\//gu, '')
  .replace(/\/\/.*$/gmu, '');

describe('CaregiverAccessPortal — estado inicial', () => {
  it('anuncia la comprobación y no monta ningún dato mientras no hay respuesta', () => {
    const html = renderToStaticMarkup(<CaregiverAccessPortal />);

    expect(html).toContain('Comprobando su experiencia aprobada');
    expect(html).toContain('aria-live="polite"');
    expect(html).not.toContain('data-caregiver-demo-local');
    expect(html).not.toContain('liquidaciones');
  });
});

describe('CaregiverAccessPortal — las dos preguntas, en orden', () => {
  it('pregunta primero la experiencia aprobada y después el contexto de relación', () => {
    const experiencia = CODIGO.indexOf('consultarExperienciasAprobadas()');
    const contexto = CODIGO.indexOf('consultarSesionHumana(CONTEXTOS_HUMANOS.cuidador)');

    expect(experiencia).toBeGreaterThan(-1);
    expect(contexto).toBeGreaterThan(experiencia);
  });

  it('exige el contexto CAREGIVER, que el servidor solo emite con relación activa', () => {
    expect(CODIGO).toContain('CONTEXTOS_HUMANOS.cuidador');
    expect(CODIGO).toContain("experiencias.includes('CAREGIVER')");
  });

  it('cubre los seis estados de la portada, mutuamente excluyentes', () => {
    for (const fase of [
      "'consultando'",
      "'sin-sesion'",
      "'sin-experiencia'",
      "'sin-relacion'",
      "'indisponible'",
      "'autorizado'",
    ]) {
      expect(CODIGO).toContain(fase);
    }
  });
});

describe('CaregiverAccessPortal — sin relación no hay datos nominales', () => {
  it('la portada neutra habla de la relación y no de ninguna persona', () => {
    expect(CODIGO).toContain('ninguna relación de cuidado activa');

    // Ni liquidación, ni nombre, ni identificador en el estado sin relación.
    for (const ajeno of ['displayName', 'documentNumber', 'patientId']) {
      expect(CODIGO).not.toContain(ajeno);
    }
  });

  it('solo el estado autorizado monta la demostración de liquidaciones', () => {
    const bloques = CODIGO.split('\n');

    const lineaDemo = bloques.findIndex((linea) =>
      linea.includes('<CaregiverLiquidationsDemo'),
    );

    expect(lineaDemo).toBeGreaterThan(-1);

    // El componente de contenido no aparece en ninguna otra rama del render.
    const apariciones = bloques.filter((linea) =>
      linea.includes('<CaregiverLiquidationsDemo'),
    );

    expect(apariciones).toHaveLength(1);
    expect(CODIGO).toContain("fase === 'autorizado'");
  });
});

describe('CaregiverAccessPortal — superficie cerrada', () => {
  it('no lee la cookie, no persiste nada y no decide desde la URL', () => {
    for (const prohibido of [
      'document.cookie',
      'localStorage',
      'sessionStorage',
      'window.location',
      'useSearchParams',
      'type="password"',
      'process.env',
    ]) {
      expect(`${prohibido}: ${String(CODIGO.includes(prohibido))}`).toBe(
        `${prohibido}: false`,
      );
    }
  });

  it('tiene UNA sola puerta de inicio de sesión y ofrece volver', () => {
    expect(CODIGO).toContain('urlDeLoginHumano()');
    expect(CODIGO).toContain('href="/acceso"');
    expect(CODIGO).toContain('href="/"');
  });

  it('reintenta cuando el servidor no responde', () => {
    expect(CODIGO).toContain("fase === 'indisponible'");
    expect(CODIGO).toContain('Volver a intentar');
    expect(CODIGO).toContain('void consultar()');
  });

  it('mueve el foco al bloque nuevo y no se lo roba en la primera visita', () => {
    expect(CODIGO).toContain('tabIndex={-1}');
    expect(CODIGO).toContain('bloqueRef.current?.focus()');
    expect(CODIGO).toContain("fase === 'sin-sesion'");
  });
});
