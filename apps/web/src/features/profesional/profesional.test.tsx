import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ProfesionalPortal, ProfesionalPortalProtegido } from './ProfesionalPortal';
import type { ItemWorklist } from './professionalWorklistClient';

/**
 * Portada `/profesional` (SPEC 038, MP04 §12).
 *
 * MP04 retira de esta superficie las visitas estáticas y la identidad
 * ficticia, y sustituye la primera por la worklist del servidor. Aquí se
 * comprueba en las DOS direcciones que eso importa: que la vista SIN datos no
 * pinta ninguna visita ni ningún nombre, y que la puerta no decide nada en el
 * navegador.
 */
const DIRECTORIO = fileURLToPath(new URL('.', import.meta.url));
const CODIGO_PUERTA = readFileSync(`${DIRECTORIO}ProfesionalPortal.tsx`, 'utf8')
  .replace(/\/\*[\s\S]*?\*\//gu, '')
  .replace(/\/\/.*$/gmu, '');

const ITEM: ItemWorklist = {
  appointmentId: 'cita-9',
  scheduledStart: '2026-08-24T16:00:00.000Z',
  modality: 'HOME',
  patient: { displayName: 'Persona Ejemplo Ficticio', initials: 'PE' },
  visit: null,
};

const ITEM_COMPLETADA: ItemWorklist = {
  ...ITEM,
  appointmentId: 'cita-10',
  patient: { displayName: 'Otra Persona Ficticia', initials: 'OP' },
  visit: {
    homeVisitId: 'visita-9',
    status: 'COMPLETED',
    version: 3,
    startedAt: '2026-08-24T16:05:00.000Z',
    endedAt: '2026-08-24T17:00:00.000Z',
    updatedAt: '2026-08-24T17:00:00.000Z',
  },
};

describe('ProfesionalPortal — vista sin datos', () => {
  it('sin worklist muestra la lista vacía y NO ninguna visita estática', () => {
    const html = renderToStaticMarkup(<ProfesionalPortal />);

    expect(html).toContain('No tiene visitas asignadas en esta ventana.');
    expect(html).toContain('Sin visitas asignadas en esta ventana');
    expect(html).toContain('Visitas (0)');
    expect(html).toContain('aria-pressed="false"');

    // Las visitas estáticas de antes de MP04 ya no existen en ninguna parte.
    for (const estatica of ['VIS-001', 'VIS-002', 'Mercedes Roa', 'Pedro Nel', 'Calle 14']) {
      expect(html).not.toContain(estatica);
    }
  });

  it('no presenta una identidad que la sesión no respalda', () => {
    const html = renderToStaticMarkup(<ProfesionalPortal />);

    for (const nominal of ['Dra. Laura', 'Laura Gómez', 'Medicina General ·', '>LG<']) {
      expect(html).not.toContain(nominal);
    }

    // Ni la zona estática: la ventana viene del servidor.
    expect(html).not.toContain('Zona: Soacha');
    expect(html).not.toContain('3 visitas programadas');
  });

  it('solo conserva la entrada de liquidaciones, sin montarla por defecto', () => {
    const html = renderToStaticMarkup(<ProfesionalPortal />);

    expect(html).toContain('Mis pagos y liquidaciones');
    expect(html).not.toContain('data-liquidations-demo-local="visitador"');
  });
});

describe('ProfesionalPortal — vista con la worklist del servidor', () => {
  it('pinta exactamente lo que llega: nombre mostrable, iniciales e inicio programado', () => {
    const html = renderToStaticMarkup(
      <ProfesionalPortal
        items={[ITEM, ITEM_COMPLETADA]}
        ventana={{ from: '2026-08-24', to: '2026-08-30' }}
      />,
    );

    expect(html).toContain('Persona Ejemplo Ficticio');
    expect(html).toContain('Otra Persona Ficticia');
    expect(html).toContain('>PE<');
    expect(html).toContain('>OP<');
    expect(html).toContain('2026-08-24 16:00');
    expect(html).toContain('Visitas (2)');
    expect(html).toContain('2 visitas asignadas');
    expect(html).toContain('2026-08-24 → 2026-08-30');

    // `visit: null` se dice con palabras, no se inventa un estado.
    expect(html).toContain('La agenda hospitalaria aún no ha materializado la visita');
    expect(html).toContain('✓ Atención Registrada');
  });

  it('el horario se recorta en UTC y no se convierte a la zona del navegador', () => {
    const html = renderToStaticMarkup(<ProfesionalPortal items={[ITEM]} />);

    // Un `toLocaleString` desplazaría la hora; el recorte no lo hace.
    expect(html).toContain('2026-08-24 16:00');
    expect(html).not.toContain('2026-08-24T16:00:00.000Z');
  });
});

describe('ProfesionalPortalProtegido — puerta', () => {
  it('renderiza la comprobación y nada de la vista mientras no hay respuesta', () => {
    const html = renderToStaticMarkup(<ProfesionalPortalProtegido />);

    expect(html).toContain('Comprobando su experiencia aprobada');
    expect(html).toContain('aria-live="polite"');
    expect(html).not.toContain('Hoja de Ruta del Día');
    expect(html).not.toContain('Mis pagos y liquidaciones');
  });

  it('pregunta la experiencia ANTES que la worklist y delega la red en el cliente', () => {
    const experiencia = CODIGO_PUERTA.indexOf('consultarExperienciasAprobadas()');
    const sesion = CODIGO_PUERTA.indexOf('consultarSesionHumana(');
    const worklist = CODIGO_PUERTA.indexOf('consultarWorklistProfesional(');

    expect(experiencia).toBeGreaterThan(-1);
    expect(sesion).toBeGreaterThan(experiencia);
    expect(worklist).toBeGreaterThan(sesion);
  });

  it('una worklist vacía es «autorizado»: no tener visitas no es una denegación', () => {
    expect(CODIGO_PUERTA).toContain("setFase('autorizado')");
    expect(CODIGO_PUERTA).toContain('resultado.worklist.items');
    // La denegación solo existe para sesión y experiencia, nunca para el trabajo.
    expect(CODIGO_PUERTA).not.toContain("setFase('sin-asignacion')");
    expect(CODIGO_PUERTA).not.toContain('sin-trabajo');
  });

  it('solo la puerta consulta; la vista no toca la red', () => {
    const vista = CODIGO_PUERTA.slice(
      0,
      CODIGO_PUERTA.indexOf('export function ProfesionalPortalProtegido'),
    );

    expect(vista.length).toBeGreaterThan(0);
    expect(vista).not.toContain('consultarExperienciasAprobadas(');
    expect(vista).not.toContain('consultarWorklistProfesional(');
    expect(vista).not.toContain('consultarSesionHumana(');
  });

  it('no lee la cookie, no persiste nada y no decide desde la URL', () => {
    for (const prohibido of [
      'document.cookie',
      'localStorage',
      'sessionStorage',
      'window.location',
      'useSearchParams',
      'type="password"',
      'process.env',
      'Date.now()',
    ]) {
      expect(`${prohibido}: ${String(CODIGO_PUERTA.includes(prohibido))}`).toBe(
        `${prohibido}: false`,
      );
    }
  });

  it('tiene UNA sola puerta de inicio de sesión y ofrece volver', () => {
    expect(CODIGO_PUERTA).toContain('urlDeLoginHumano()');
    expect(CODIGO_PUERTA).toContain('href="/acceso"');
    expect(CODIGO_PUERTA).toContain('href="/"');
  });

  it('mueve el foco al bloque nuevo y no se lo roba en la primera visita', () => {
    expect(CODIGO_PUERTA).toContain('tabIndex={-1}');
    expect(CODIGO_PUERTA).toContain('bloqueRef.current?.focus()');
    expect(CODIGO_PUERTA).toContain("fase === 'sin-sesion'");
  });
});
