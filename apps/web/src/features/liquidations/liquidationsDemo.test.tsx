import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { CaregiverLiquidationsDemo } from '@/features/caregiver/CaregiverLiquidationsDemo';
import { ProfesionalPortal } from '@/features/profesional/ProfesionalPortal';
import { LiquidationsDemo } from './LiquidationsDemo';
import { liquidationsDemoByRole } from './liquidationsDemoData';

describe('LiquidationsDemo', () => {
  it('muestra datos locales distintos para Cuidador y Visitador', () => {
    const cuidadorHtml = renderToStaticMarkup(<LiquidationsDemo role="cuidador" />);
    const visitadorHtml = renderToStaticMarkup(<LiquidationsDemo role="visitador" />);

    expect(liquidationsDemoByRole.cuidador.records).toHaveLength(4);
    expect(liquidationsDemoByRole.visitador.records).toHaveLength(3);
    expect(cuidadorHtml).toContain('data-liquidations-demo-local="cuidador"');
    expect(visitadorHtml).toContain('data-liquidations-demo-local="visitador"');
    expect(cuidadorHtml).toContain('Cuidador demo');
    expect(visitadorHtml).toContain('Visitador médico demo');
  });

  it('declara que no hay dinero ni acciones persistentes', () => {
    const html = renderToStaticMarkup(<LiquidationsDemo role="cuidador" />);

    expect(html).toContain('no es dinero disponible');
    expect(html).toContain('no se guardan cambios');
    expect(html).not.toContain('<button');
    expect(html).not.toContain('<form');
    expect(html).not.toContain('<input');
  });

  it('monta el portal del cuidador como una demostración local', () => {
    const html = renderToStaticMarkup(<CaregiverLiquidationsDemo />);

    expect(html).toContain('data-caregiver-demo-local="true"');
    expect(html).toContain('Portal del cuidador');
    expect(html).toContain('Mis pagos y liquidaciones');
  });

  it('expone la entrada navegable de liquidaciones al Visitador sin montarla por defecto', () => {
    const html = renderToStaticMarkup(<ProfesionalPortal />);

    expect(html).toContain('Mis pagos y liquidaciones');
    expect(html).toContain('aria-pressed="false"');
    expect(html).not.toContain('data-liquidations-demo-local="visitador"');
  });
});
