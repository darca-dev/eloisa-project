import { describe, expect, it, vi } from 'vitest';

import { type ApiEnvironmentProvider } from '../config/api-environment.provider';

import {
  KeycloakAdminClient,
  KeycloakProvisionError,
} from './keycloak-admin.client';

const disabledEnvironment = { keycloakPatient: undefined } as ApiEnvironmentProvider;

describe('KeycloakAdminClient', () => {
  it('fails closed without configuration and does not call the network', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const client = new KeycloakAdminClient(disabledEnvironment);

    await expect(
      client.createUser({
        username: 'patient-test',
        email: 'patient-test@example.test',
        emailVerified: false,
        firstName: 'Patient',
        lastName: 'Test',
        password: 'test-password-1',
        attributes: {},
      }),
    ).rejects.toBeInstanceOf(KeycloakProvisionError);

    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
