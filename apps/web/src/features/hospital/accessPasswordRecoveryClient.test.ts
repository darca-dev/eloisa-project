import { describe, expect, it, vi } from 'vitest';
import { resolvePublicApiBaseUrl } from '@/config/environment';
import { getRecoveryStatus, resetAccessPassword, startRecoveryReauthentication, type ResetInput } from './accessPasswordRecoveryClient';

const id = '11111111-1111-4111-8111-111111111111';
const result = { operationId: id, state: 'SUCCEEDED', createdAt: '2026-10-12T12:00:00.000Z' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
describe('administrator recovery transport', () => {
  it('uses the configured API with credentials and rejects malformed or excessive response fields', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(json({ operation: result, canRecover: true, requiresReauthentication: false, canReconcile: false }));
    expect((await getRecoveryStatus(id, fetchImpl)).kind).toBe('ok');
    expect(fetchImpl).toHaveBeenCalledWith(`${resolvePublicApiBaseUrl()}/api/v1/hospital/access-requests/${id}/password-recovery`, expect.objectContaining({ credentials: 'include', cache: 'no-store', redirect: 'error' }));
    fetchImpl.mockResolvedValue(json({ operation: { ...result, password: crypto.randomUUID() }, canRecover: true, requiresReauthentication: false, canReconcile: false }));
    expect((await getRecoveryStatus(id, fetchImpl)).kind).toBe('unavailable');
  });
  it('does not retry credential writes on network failure or assume successful recovery', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(new Error('network response lost'));
    expect((await resetAccessPassword(id, {} as ResetInput, fetchImpl)).kind).toBe('unavailable');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  it('distinguishes expired sessions, fresh authentication and revoked permission', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(json({}, 401));
    expect((await getRecoveryStatus(id, fetchImpl)).kind).toBe('session-required');
    fetchImpl.mockResolvedValue(json({ code: 'ACCESS_RECOVERY_REAUTHENTICATE' }, 403));
    expect((await getRecoveryStatus(id, fetchImpl)).kind).toBe('reauthenticate');
    fetchImpl.mockResolvedValue(json({}, 403));
    expect((await getRecoveryStatus(id, fetchImpl)).kind).toBe('forbidden');
  });
  it('rejects unsafe reauthentication URLs', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    for (const authorizationUrl of ['javascript:alert(1)', 'http://external.invalid/', 'https://user:credential@idp.invalid/']) {
      fetchImpl.mockResolvedValue(json({ authorizationUrl }));
      expect((await startRecoveryReauthentication(fetchImpl)).kind).toBe('unavailable');
    }
  });
});
