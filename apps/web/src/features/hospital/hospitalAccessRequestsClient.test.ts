import { describe, expect, it, vi } from 'vitest';

import { resolvePublicApiBaseUrl } from '@/config/environment';

import {
  ACCESS_PROVISIONING_MAX_ATTEMPTS,
  ACCESS_REQUEST_ACTIONS,
  ACCESS_REQUEST_ACTION_REASON,
  ACCESS_REQUEST_ACTION_SOURCE_STATUSES,
  decideHospitalAccessRequest,
  getHospitalAccessRequest,
  HOSPITAL_ACCESS_REQUESTS_PATH,
  listHospitalAccessRequests,
  validActionsFor,
} from './hospitalAccessRequestsClient';

const ID = '11111111-1111-4111-8111-111111111111';
const REFERENCE = 'AR-1234567890ABCDEF12345678';
const ITEM = {
  requestId: ID,
  reference: REFERENCE,
  requestedProfile: 'CAREGIVER',
  status: 'PENDING',
  version: 1,
  submittedAt: '2026-09-30T12:00:00.000Z',
  givenNames: 'Persona',
  familyNames: 'Ficticia',
} as const;
const DETAIL = {
  ...ITEM,
  documentType: 'CEDULA_CIUDADANIA',
  documentNumber: '44.556.677',
  birthDate: '1980-01-02',
  sexGenderCode: 'PREFIERE_NO_DECIRLO',
  phone: '3000000000',
  email: 'persona@example.invalid',
  provisioningStatus: 'NOT_STARTED',
  provisioningAttempts: 0,
  provisioningErrorCode: null,
  decidedAt: null,
  decisionReasonCode: null,
} as const;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('hospitalAccessRequestsClient', () => {
  it('lista con filtros codificados, límite y cookie institucional', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(json({ items: [ITEM], nextCursor: 'cursor-1' }));
    const result = await listHospitalAccessRequests(
      { q: 'CC 44.556.677 & prueba', profile: 'CAREGIVER' },
      fetchImpl,
    );

    expect(result.kind).toBe('ok');
    const [url, init] = fetchImpl.mock.calls[0]!;
    const parsed = new URL(String(url));
    expect(`${parsed.origin}${parsed.pathname}`).toBe(`${resolvePublicApiBaseUrl()}${HOSPITAL_ACCESS_REQUESTS_PATH}`);
    expect(Object.fromEntries(parsed.searchParams)).toEqual({
      limit: '20',
      profile: 'CAREGIVER',
      q: 'CC 44.556.677 & prueba',
    });
    expect(init?.credentials).toBe('include');
    expect(init?.cache).toBe('no-store');
  });

  it('omite `status` por defecto y lo envía solo cuando se pide exactamente PENDING', async () => {
    const abierto = vi.fn<typeof fetch>().mockResolvedValue(json({ items: [], nextCursor: null }));
    await listHospitalAccessRequests({}, abierto);
    const abiertoParams = new URL(String(abierto.mock.calls[0]?.[0])).searchParams;
    expect(abiertoParams.has('status')).toBe(false);
    expect(abiertoParams.get('limit')).toBe('20');

    const filtrado = vi.fn<typeof fetch>().mockResolvedValue(json({ items: [], nextCursor: null }));
    await listHospitalAccessRequests({ status: 'PENDING' }, filtrado);
    expect(new URL(String(filtrado.mock.calls[0]?.[0])).searchParams.get('status')).toBe('PENDING');
  });

  it('consulta detalle con id codificado y valida la proyección exacta', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(json(DETAIL));
    const result = await getHospitalAccessRequest(ID, fetchImpl);
    expect(result).toEqual({
      kind: 'ok',
      data: { ...DETAIL, registrationSchemaVersion: null, registration: null },
    });
    expect(fetchImpl.mock.calls[0]?.[0]).toBe(`${resolvePublicApiBaseUrl()}${HOSPITAL_ACCESS_REQUESTS_PATH}/${ID}`);
  });

  it('acepta el expediente del detalle y lo entrega como registro', async () => {
    const registro = { necesitaApoyo: 'SI', apoyos: ['MOVILIZARSE'], autorizaDatos: true };
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      json({ ...DETAIL, registrationSchemaVersion: 1, registration: registro }),
    );
    const result = await getHospitalAccessRequest(ID, fetchImpl);

    expect(result).toEqual({
      kind: 'ok',
      data: { ...DETAIL, registrationSchemaVersion: 1, registration: registro },
    });
  });

  it('rechaza un expediente incoherente o mal formado como indisponible', async () => {
    for (const cuerpo of [
      { ...DETAIL, registrationSchemaVersion: 1, registration: null },
      { ...DETAIL, registrationSchemaVersion: null, registration: { apoyos: [] } },
      { ...DETAIL, registrationSchemaVersion: 'uno', registration: {} },
      { ...DETAIL, registrationSchemaVersion: 1, registration: [] },
      { ...DETAIL, registrationSchemaVersion: 1 },
    ]) {
      const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(json(cuerpo));
      const result = await getHospitalAccessRequest(ID, fetchImpl);
      expect(result).toEqual({ kind: 'unavailable' });
    }
  });

  it.each(
    ACCESS_REQUEST_ACTIONS.map((action) => [action, ACCESS_REQUEST_ACTION_REASON[action]] as const),
  )('envía una decisión %s con tres claves y el motivo de su catálogo', async (action, reasonCode) => {
    const response = {
      requestId: ID,
      reference: REFERENCE,
      status: ACCESS_REQUEST_ACTION_SOURCE_STATUSES[action][0],
      version: 2,
      decisionReasonCode: reasonCode,
      decidedAt: '2026-09-30T12:01:00.000Z',
    };
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(json(response));
    const result = await decideHospitalAccessRequest(ID, action, 1, fetchImpl);
    expect(result.kind).toBe('ok');
    const [, init] = fetchImpl.mock.calls[0]!;
    expect(init?.method).toBe('POST');
    expect(init?.credentials).toBe('include');
    expect(JSON.parse(String(init?.body))).toEqual({ action, expectedVersion: 1, reasonCode });
  });

  it('el motivo sale del catálogo y una acción fuera de catálogo no llega a la red', async () => {
    expect(ACCESS_REQUEST_ACTION_REASON).toEqual({
      APPROVE: 'DEMO_ELIGIBLE',
      REJECT: 'DEMO_NOT_ELIGIBLE',
      RETRY_PROVISIONING: 'DEMO_PROVISIONING_RETRIED',
      SUSPEND: 'DEMO_ACCESS_SUSPENDED',
      REACTIVATE: 'DEMO_ACCESS_REACTIVATED',
      REVOKE: 'DEMO_ACCESS_REVOKED',
    });

    const fetchImpl = vi.fn<typeof fetch>();
    const fuera = 'DELETE' as unknown as Parameters<typeof decideHospitalAccessRequest>[1];
    await expect(
      decideHospitalAccessRequest(ID, fuera, 1, fetchImpl),
    ).resolves.toEqual({ kind: 'invalid-request' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('ofrece solo las acciones que el estado admite, y agota el reintento en el límite', () => {
    expect(ACCESS_REQUEST_ACTIONS).toEqual([
      'APPROVE', 'REJECT', 'RETRY_PROVISIONING', 'SUSPEND', 'REACTIVATE', 'REVOKE',
    ]);

    expect(validActionsFor('PENDING', 0)).toEqual(['APPROVE', 'REJECT']);
    expect(validActionsFor('PROVISIONING_FAILED', 0)).toEqual(['REJECT', 'RETRY_PROVISIONING']);
    expect(validActionsFor('PROVISIONING_FAILED', ACCESS_PROVISIONING_MAX_ATTEMPTS)).toEqual(['REJECT']);
    expect(validActionsFor('APPROVED', 0)).toEqual(['SUSPEND', 'REVOKE']);
    expect(validActionsFor('SUSPENDED', 0)).toEqual(['REACTIVATE', 'REVOKE']);
    expect(validActionsFor('APPROVED_PENDING_PROVISIONING', 0)).toEqual([]);
    expect(validActionsFor('REJECTED', 0)).toEqual([]);
    expect(validActionsFor('REVOKED', 0)).toEqual([]);
  });

  it.each([
    [400, 'invalid-request'],
    [401, 'session-required'],
    [403, 'forbidden'],
    [404, 'not-found'],
    [409, 'conflict'],
    [503, 'unavailable'],
    [500, 'unavailable'],
  ] as const)('mapea HTTP %i a %s sin leer ni devolver el cuerpo', async (status, kind) => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(json({ secret: 'no-exponer' }, status));
    await expect(listHospitalAccessRequests({}, fetchImpl)).resolves.toEqual({ kind });
  });

  it('rechaza claves extra, DTO parcial, catálogos inválidos y cursor vacío', async () => {
    const malformed = [
      { items: [{ ...ITEM, tenantId: 'oculto' }], nextCursor: null },
      { items: [{ ...ITEM, familyNames: undefined }], nextCursor: null },
      { items: [{ ...ITEM, requestedProfile: 'ADMIN' }], nextCursor: null },
      { items: [ITEM], nextCursor: '' },
    ];
    for (const body of malformed) {
      const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(json(body));
      await expect(listHospitalAccessRequests({}, fetchImpl)).resolves.toEqual({ kind: 'unavailable' });
    }
  });

  it('rechaza fechas no canónicas y referencias imposibles', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(json({
      items: [{ ...ITEM, reference: 'AR-DEMO', submittedAt: '2026-09-30' }],
      nextCursor: null,
    }));
    await expect(listHospitalAccessRequests({}, fetchImpl)).resolves.toEqual({ kind: 'unavailable' });
  });

  it('falla localmente ante id o versión inválidos sin llamar la red', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    await expect(getHospitalAccessRequest('no-uuid', fetchImpl)).resolves.toEqual({ kind: 'invalid-request' });
    await expect(decideHospitalAccessRequest(ID, 'APPROVE', 0, fetchImpl)).resolves.toEqual({ kind: 'invalid-request' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('trata JSON inválido y fallo de red como indisponibilidad', async () => {
    const invalidJson = vi.fn<typeof fetch>().mockResolvedValue(new Response('<html>', { status: 200 }));
    await expect(listHospitalAccessRequests({}, invalidJson)).resolves.toEqual({ kind: 'unavailable' });
    const network = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('network'));
    await expect(listHospitalAccessRequests({}, network)).resolves.toEqual({ kind: 'unavailable' });
  });

  it('distingue una cancelación para ignorar respuestas obsoletas', async () => {
    const aborted = vi.fn<typeof fetch>().mockRejectedValue(new DOMException('aborted', 'AbortError'));
    await expect(listHospitalAccessRequests({}, aborted)).resolves.toEqual({ kind: 'cancelled' });
  });
});
