import { randomBytes } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AccessProvisioningIdentityClient } from '../src/access-requests/access-provisioning-identity.client';
import { type ApiEnvironmentProvider } from '../src/config/api-environment.provider';

const configuration = { issuer: 'https://identity.invalid/realms/test', adminUrl: 'https://identity.invalid', realm: 'test', clientId: 'test-client', clientSecret: randomBytes(24).toString('hex') };
const subject = 'fictional-subject';
const marker = 'fictional-request';
const remote = { id: subject, attributes: { merdnAccessRequest: [marker] }, requiredActions: ['UPDATE_PASSWORD'] };
const response = (body: unknown, status = 200) => new Response(status === 204 ? null : JSON.stringify(body), { status });
function setup(handler: (url: string, init: RequestInit) => Response | Promise<Response>) {
  const calls: { url: string; init: RequestInit }[] = [];
  vi.stubGlobal('fetch', async (input: URL | string, init: RequestInit = {}) => {
    const url = String(input); calls.push({ url, init });
    if (url.includes('/protocol/openid-connect/token')) return response({ access_token: randomBytes(24).toString('hex'), expires_in: 60 });
    return handler(url, init);
  });
  const wait = vi.fn(async () => undefined);
  const client = new AccessProvisioningIdentityClient({ accessProvisioning: configuration } as ApiEnvironmentProvider, { wait });
  return { client, calls, wait };
}
afterEach(() => vi.unstubAllGlobals());

describe('administrator-managed recovery provider boundary', () => {
  it('uses a temporary credential once and verifies the mandatory password change', async () => {
    const { client, calls } = setup((_url, init) => init.method === 'PUT' ? response(null, 204) : response(remote));
    const password = randomBytes(24).toString('hex');
    await client.setTemporaryPasswordOnce(subject, marker, password);
    const writes = calls.filter(call => call.init.method === 'PUT');
    expect(writes).toHaveLength(1);
    expect(JSON.parse(String(writes[0]?.init.body))).toEqual({ type: 'password', value: password, temporary: true });
    expect(writes[0]?.url).toBe(`https://identity.invalid/admin/realms/test/users/${subject}/reset-password`);
  });
  it.each(['network', 'server'])('does not replay reset after an uncertain %s result', async (failure) => {
    const { client, calls, wait } = setup((_url, init) => {
      if (init.method !== 'PUT') return response(remote);
      if (failure === 'network') throw new Error('private provider failure');
      return response({}, 503);
    });
    await expect(client.setTemporaryPasswordOnce(subject, marker, 'Fictional-recovery-only-74')).rejects.toThrow();
    expect(calls.filter(call => call.init.method === 'PUT')).toHaveLength(1);
    expect(wait).not.toHaveBeenCalled();
  });
  it('does not mutate a mismatched identity or marker', async () => {
    const { client, calls } = setup(() => response({ ...remote, id: 'other-subject' }));
    await expect(client.setTemporaryPasswordOnce(subject, marker, 'Fictional-recovery-only-74')).rejects.toThrow();
    await expect(client.revokeUserSessions(subject, marker)).rejects.toThrow();
    expect(calls.filter(call => call.init.method === 'PUT' || (call.init.method === 'POST' && !call.url.includes('/token')))).toEqual([]);
  });
  it('rejects a reset response that does not retain the mandatory action', async () => {
    const { client } = setup((_url, init) => init.method === 'PUT' ? response(null, 204) : response({ ...remote, requiredActions: [] }));
    await expect(client.setTemporaryPasswordOnce(subject, marker, 'Fictional-recovery-only-74')).rejects.toThrow();
  });
  it('closes provider sessions and verifies the empty session list', async () => {
    const { client, calls } = setup((url, init) => url.endsWith('/sessions') ? response([]) : init.method === 'POST' ? response(null, 204) : response(remote));
    await client.revokeUserSessions(subject, marker);
    expect(calls.some(call => call.url.endsWith(`/${subject}/logout`) && call.init.method === 'POST')).toBe(true);
  });
  it('does not report success when a provider session remains', async () => {
    const { client } = setup((url, init) => url.endsWith('/sessions') ? response([{ id: 'still-active' }]) : init.method === 'POST' ? response(null, 204) : response(remote));
    await expect(client.revokeUserSessions(subject, marker)).rejects.toThrow();
  });
});
