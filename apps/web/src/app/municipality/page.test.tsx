import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import MunicipalityPage from './page';

function renderRuta(): string {
  return renderToStaticMarkup(<MunicipalityPage />);
}

describe('/municipality — puerta y modo demo local', () => {
  it('permanece sin sesión por defecto', () => {
    delete process.env.MERDN_MUNICIPALITY_DEMO_LOCAL;

    const html = renderRuta();

    expect(html).toContain('Comprobando la sesión institucional');
    expect(html).not.toContain('data-municipality-content');
  });

  it('solo habilita el recorrido automático con configuración de servidor', () => {
    process.env.MERDN_MUNICIPALITY_DEMO_LOCAL = 'true';

    try {
      const html = renderRuta();

      expect(html).toContain('data-municipality-content');
      expect(html).toContain('Datos demostrativos');
    } finally {
      delete process.env.MERDN_MUNICIPALITY_DEMO_LOCAL;
    }
  });
});
