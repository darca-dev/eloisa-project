import { describe, expect, it } from 'vitest';

import { HealthService } from './health.service';

describe('HealthService', () => {
  it('devuelve exactamente el contrato { status: "ok" }', () => {
    const service = new HealthService();

    expect(service.check()).toStrictEqual({ status: 'ok' });
  });

  it('no añade información de entorno, versión ni dependencias', () => {
    const service = new HealthService();

    expect(Object.keys(service.check())).toStrictEqual(['status']);
  });
});
