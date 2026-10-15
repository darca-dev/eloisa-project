import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MunicipalityShell } from './MunicipalityShell';
import { MunicipalityOperationalHomeView } from './MunicipalityOperationalPanel';
import type { PopulationSummary, EstadoAgregado } from './municipalityAggregates';
import { MUNICIPALITY_MODULOS } from './municipalityViews';

const SESION_MUNICIPAL_FICTICIA = { role: 'MUNICIPAL_VIEWER', expiresAt: '2030-01-01T00:00:00Z', institution: { name: 'Institución de pruebas' }, actorDisplay: 'Administrador institucional', administrator: true } as const;

const count = (value: number) => ({ status: 'EXACT' as const, value, display: String(value) });
const summary: PopulationSummary = {
  source: 'persisted-test', asOfDate: '2026-10-14', generatedAt: '2026-10-14T15:00:00Z',
  uniqueRegistered: count(27),
  populations: { olderAdult60Plus: count(9), disabilityDeclared: { status: 'SUPPRESSED', value: null, display: 'menos de 5' }, homeCareRequiredDeclared: count(0) },
  exclusiveIntersections: { olderOnly: count(0), disabilityOnly: count(0), homeCareOnly: count(0), olderAndDisabilityOnly: count(0), olderAndHomeCareOnly: count(0), disabilityAndHomeCareOnly: count(0), allThree: count(0) },
  officialMetrics: [], quality: { territoryPendingNormalization: count(0) },
};
const renderHome = (estado: EstadoAgregado<PopulationSummary>) => renderToStaticMarkup(<MunicipalityOperationalHomeView estado={estado} onNavegar={() => undefined} onReintentar={() => undefined} />);

describe('Municipality operativa con registros guardados', () => {
  it('publica corte y conteos recibidos conservando supresión y ausencia de fuente oficial', () => {
    const html = renderHome({ estado: 'listo', datos: summary });
    expect(html).toContain('2026-10-14'); expect(html).toContain('<dd>27</dd>');
    expect(html).toContain('menos de 5'); expect(html).toContain('<dd>0</dd>');
    expect(html).toContain('no son una estadística oficial');
    for (const heading of ['De la persona a la evidencia', 'Alertas y pendientes de gestión', 'Accesos rápidos', 'Actividades recientes']) expect(html).toContain(heading);
    expect(html).toContain('Sin dato oficial'); expect(html).toContain('Actividad aún no disponible');
    expect(html).not.toMatch(/3\.050|37,5|1\.284|92,8/u);
  });

  it('distingue una consulta vacía de carga, error o pérdida de autorización sin inventar conteos', () => {
    const empty = renderHome({ estado: 'listo', datos: { ...summary, uniqueRegistered: count(0) } });
    expect(empty).toContain('Todavía no hay personas registradas');
    for (const estado of ['cargando', 'error', 'no-autorizado'] as const) {
      const html = renderHome({ estado });
      expect(html).not.toContain('<dd>'); expect(html).not.toContain('Todavía no hay personas registradas');
      expect(html).toContain(estado === 'cargando' ? 'role="status"' : 'role="alert"');
      expect(html.includes('Reintentar consulta')).toBe(estado === 'error');
    }
  });

  it('la puerta del administrador evita fixtures en todos los apartados y mantiene la denegación sin sesión', () => {
    for (const vista of MUNICIPALITY_MODULOS) {
      const html = renderToStaticMarkup(<MunicipalityShell administracionHumana sesionInicial={SESION_MUNICIPAL_FICTICIA} vistaInicial={vista} />);
      expect(html).toContain(`data-municipality-content="${vista}"`);
      expect(html).toContain(SESION_MUNICIPAL_FICTICIA.institution.name);
      expect(html).not.toMatch(/Datos demostrativos|Alcaldía de Soacha|Secretaría de Salud|3\.050|37,5|1\.284|92,8|Agosto de 2026/u);
      if (!['inicio', 'poblacion', 'territorio'].includes(vista)) {
        expect(html).toContain('Consultando registros guardados'); expect(html).not.toMatch(/<form\b/u);
        expect(html).toContain('Completar en Configuración');
        expect(html).not.toMatch(/Descargar|Exportar|Guardar|type="submit"|role="progressbar"/u);
      }
      expect(html).toContain('Configuración');
    }
    const denied = renderToStaticMarkup(<MunicipalityShell administracionHumana sesionInicial="sin-sesion" />);
    expect(denied).not.toContain('data-municipality-content'); expect(denied).not.toContain('Resumen municipal');
    const wrongRole = renderToStaticMarkup(<MunicipalityShell administracionHumana sesionInicial={{ ...SESION_MUNICIPAL_FICTICIA, role: 'HOSPITAL_PATIENT_VIEWER' }} />);
    expect(wrongRole).not.toContain('data-municipality-content'); expect(wrongRole).not.toContain('Resumen municipal');
    const technicalName = renderToStaticMarkup(<MunicipalityShell administracionHumana sesionInicial={{ ...SESION_MUNICIPAL_FICTICIA, institution: { name: 'MERDN — Tenant institucional MVP' } }} />);
    expect(technicalName).not.toMatch(/MERDN|Tenant institucional MVP/u); expect(technicalName).toContain('Panel de Alcaldía');
  });
});
