import { describe, expect, it } from 'vitest';

import { EnvironmentValidationError, loadWebEnvironment } from './environment';

describe('loadWebEnvironment', () => {
  it('aplica el entorno por defecto y normaliza la URL base de la API', () => {
    const environment = loadWebEnvironment({
      MERDN_API_BASE_URL: 'http://127.0.0.1:3001/',
    });

    expect(environment).toStrictEqual({
      merdnEnvironment: 'development',
      apiBaseUrl: 'http://127.0.0.1:3001',
    });
  });

  it('falla con un mensaje claro cuando falta MERDN_API_BASE_URL', () => {
    expect(() => loadWebEnvironment({})).toThrowError(EnvironmentValidationError);
    expect(() => loadWebEnvironment({})).toThrowError(/MERDN_API_BASE_URL/);
  });

  it('rechaza esquemas no HTTP sin revelar el valor recibido', () => {
    const value = 'ftp://usuario:fictitious-not-a-secret@ejemplo.local';

    try {
      loadWebEnvironment({ MERDN_API_BASE_URL: value });
      expect.unreachable('debía lanzar EnvironmentValidationError');
    } catch (error) {
      expect(error).toBeInstanceOf(EnvironmentValidationError);
      const message = (error as Error).message;
      expect(message).toContain('MERDN_API_BASE_URL');
      expect(message).not.toContain('fictitious-not-a-secret');
      expect(message).not.toContain(value);
    }
  });

  it('valida MERDN_ENVIRONMENT contra la lista permitida', () => {
    expect(
      loadWebEnvironment({
        MERDN_API_BASE_URL: 'https://api.ejemplo.local',
        MERDN_ENVIRONMENT: 'test',
      }).merdnEnvironment,
    ).toBe('test');

    expect(() =>
      loadWebEnvironment({
        MERDN_API_BASE_URL: 'https://api.ejemplo.local',
        MERDN_ENVIRONMENT: 'produccion',
      }),
    ).toThrowError(/MERDN_ENVIRONMENT/);
  });
});
