import { describe, expect, it } from 'vitest';

import {
  HEALTH_RESPONSE,
  HEALTH_ROUTE,
  HEALTH_STATUS_OK,
  isHealthResponse,
} from './health';

describe('contrato de salud compartido', () => {
  it('expone la ruta y el estado acordados en TASK-001', () => {
    expect(HEALTH_ROUTE).toBe('/health');
    expect(HEALTH_STATUS_OK).toBe('ok');
  });

  it('define el cuerpo exacto { status: "ok" } y es inmutable', () => {
    expect(HEALTH_RESPONSE).toStrictEqual({ status: 'ok' });
    expect(Object.isFrozen(HEALTH_RESPONSE)).toBe(true);
  });

  it('acepta únicamente el contrato exacto', () => {
    expect(isHealthResponse({ status: 'ok' })).toBe(true);
  });

  it('rechaza cuerpos con campos adicionales o estados distintos', () => {
    expect(isHealthResponse({ status: 'ok', uptime: 42 })).toBe(false);
    expect(isHealthResponse({ status: 'degraded' })).toBe(false);
    expect(isHealthResponse({})).toBe(false);
    expect(isHealthResponse(null)).toBe(false);
    expect(isHealthResponse('ok')).toBe(false);
  });
});
