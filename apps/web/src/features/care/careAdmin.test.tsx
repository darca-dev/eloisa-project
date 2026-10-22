import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { HospitalAdministration } from '@/features/hospital/HospitalAdministration';

import { careAdminClient, PERMISOS_POR_PARTICIPANTE } from './careAdminClient';
import { CareAdministration } from './CareAdministration';

const ORG = '00000000-0000-4000-8000-0000000000a1';

function fetchEspia(status: number, body: unknown) {
  const llamadas: { url: string; init: RequestInit }[] = [];
  const impl = (async (url: string, init: RequestInit) => {
    llamadas.push({ url, init });
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  }) as unknown as typeof fetch;
  return { impl, llamadas };
}

describe('administración de espacios de cuidado (MP05b)', () => {
  it('las concesiones viajan con la sesión y sin actor, tenant ni emisor del cliente', async () => {
    const espia = fetchEspia(201, { organizationId: ORG, organizationName: 'X', contexts: [], competences: [] });
    await careAdminClient.conceder(
      ORG,
      'ctx',
      { actorKind: 'CAREGIVER', permission: 'CONTRIBUTE_RECORDS', person: { documentType: 'CEDULA_CIUDADANIA', documentNumber: '123' }, authorizationReference: 'REF.001' },
      espia.impl,
    );
    const [llamada] = espia.llamadas;
    expect(llamada?.url).toContain(`/api/v1/care/admin/organizations/${ORG}/contexts/ctx/grants`);
    expect(llamada?.init.credentials).toBe('include');
    for (const prohibido of ['tenantId', 'grantedBy', 'humanAccountId', 'organizationId']) {
      expect(String(llamada?.init.body)).not.toContain(prohibido);
    }
  });

  it('una denegación es un desenlace cerrado, nunca datos', async () => {
    expect((await careAdminClient.organizaciones(fetchEspia(403, { message: 'interno' }).impl)).kind).toBe('denegado');
  });

  it('ofrece al cuidador solo permisos no clínicos', () => {
    expect(PERMISOS_POR_PARTICIPANTE.CAREGIVER).not.toContain('MANAGE_RULES');
    expect(PERMISOS_POR_PARTICIPANTE.CAREGIVER).not.toContain('REVIEW_ALARMS');
    expect(PERMISOS_POR_PARTICIPANTE.HOSPITAL_REVIEWER).toEqual(['VIEW_RECORDS', 'REVIEW_ALARMS']);
  });

  it('arranca consultando, sin listados de pacientes ni datos de ejemplo', () => {
    const html = renderToStaticMarkup(<CareAdministration />);
    expect(html).toContain('Consultando las organizaciones que usted gestiona');
  });

  it('la sesión administrativa real ofrece la pestaña junto a solicitudes de acceso; la demo no', () => {
    const real = renderToStaticMarkup(
      <HospitalAdministration pestana="Espacios de cuidado" onSeleccionarPestana={() => undefined} canReviewAccessRequests />,
    );
    expect(real).toContain('>Solicitudes de acceso<');
    expect(real).toContain('>Espacios de cuidado<');

    const demo = renderToStaticMarkup(<HospitalAdministration pestana="Membresías" onSeleccionarPestana={() => undefined} />);
    expect(demo).not.toContain('Espacios de cuidado');
  });
});
