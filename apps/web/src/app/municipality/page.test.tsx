import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import MunicipalityPage from './page';

function renderRuta(): string {
  return renderToStaticMarkup(<MunicipalityPage />);
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('/municipality — puerta institucional', () => {
  it('permanece sin sesión por defecto', () => {
    vi.stubEnv('MERDN_MUNICIPALITY_DEMO_LOCAL', undefined);

    const html = renderRuta();

    expect(html).toContain('Comprobando la sesión institucional');
    expect(html).not.toContain('data-municipality-content');
  });

  it('mantiene la puerta aunque la bandera demo heredada esté habilitada', () => {
    vi.stubEnv('MERDN_MUNICIPALITY_DEMO_LOCAL', 'true');

    const html = renderRuta();

    expect(html).toContain('Comprobando la sesión institucional');
    expect(html).not.toContain('data-municipality-content');
    expect(html).not.toContain('Datos demostrativos');
  });
});
