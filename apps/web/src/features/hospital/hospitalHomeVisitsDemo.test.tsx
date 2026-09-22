import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { HospitalHomeVisitsDemo } from './HospitalHomeVisitsDemo';
import { HospitalHomeVisits } from './HospitalHomeVisits';
import { hospitalVisitasDemoLocal } from './hospitalVisitsDemoLocal';

describe('HospitalHomeVisitsDemo', () => {
  const html = renderToStaticMarkup(<HospitalHomeVisitsDemo />);

  it('muestra exactamente cinco visitas locales ficticias', () => {
    expect(hospitalVisitasDemoLocal.visitas).toHaveLength(5);
    expect((html.match(/Persona Demo/g) ?? [])).toHaveLength(5);
    expect(html).toContain('data-hospital-visitas-demo-local="true"');
    expect(html).toContain('5 registros ficticios');
  });

  it('declara procedencia y permanece en solo lectura', () => {
    expect(html).toContain('Datos ficticios de demostración local. No se guardan cambios');
    expect(html).not.toContain('<button');
    expect(html).not.toContain('Abrir sesión profesional');
    expect(html).not.toContain('Iniciar');
    expect(html).not.toContain('Completar');
  });

  it('expone texto de estado junto con los cinco conteos operativos', () => {
    for (const estado of hospitalVisitasDemoLocal.estados) {
      expect(html).toContain(estado.etiqueta);
    }

    for (const visita of hospitalVisitasDemoLocal.visitas) {
      expect(html).toContain(visita.estado);
      expect(html).toContain(visita.profesional);
    }
  });

  it('no altera la superficie operativa fuera del modo demo', () => {
    const vistaOperativa = renderToStaticMarkup(<HospitalHomeVisits />);

    expect(vistaOperativa).toContain('No hay ninguna visita abierta en esta pantalla');
    expect(vistaOperativa).not.toContain('Persona Demo');
    expect(vistaOperativa).not.toContain('data-hospital-visitas-demo-local');
  });
});
