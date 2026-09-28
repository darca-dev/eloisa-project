import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { HospitalAgendaDemo } from './HospitalAgendaDemo';
import { HospitalAgenda } from './HospitalAgenda';
import { hospitalAgendaCanvasDemo } from './hospitalAgendaCanvasDemo';

describe('HospitalAgendaDemo', () => {
  const html = renderToStaticMarkup(<HospitalAgendaDemo />);

  it('recupera las tres zonas del canvas con cuatro solicitudes ficticias', () => {
    expect(hospitalAgendaCanvasDemo.solicitudes).toHaveLength(4);
    expect((html.match(/Persona Demo/g) ?? [])).toHaveLength(4);
    expect(html).toContain('Solicitudes pendientes de asignación');
    expect(html).toContain('Septiembre 2026');
    expect(html).toContain('Estados de la cita');
    expect(html).toContain('data-hospital-agenda-demo-local="true"');
  });

  it('presenta el calendario mensual y no expone controles persistentes', () => {
    expect(hospitalAgendaCanvasDemo.dias).toHaveLength(35);
    expect(html).toContain('Calendario mensual ficticio de septiembre de 2026');
    expect(html).not.toContain('<button');
    expect(html).not.toContain('<select');
    expect(html).not.toContain('type="date"');
    expect(html).toContain('Datos ficticios de demostración local. No se guardan cambios');
  });

  it('mantiene la Agenda conectada fuera de la superficie demo', () => {
    const agendaReal = renderToStaticMarkup(<HospitalAgenda agendaInicial={null} />);

    expect(agendaReal).not.toContain('data-hospital-agenda-demo-local');
    expect(agendaReal).not.toContain('4 solicitudes ficticias');
  });
});
