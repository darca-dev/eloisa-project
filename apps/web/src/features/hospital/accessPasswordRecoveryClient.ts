import { resolvePublicApiBaseUrl } from '@/config/environment';
export type RecoveryState = 'PENDING' | 'SUCCEEDED' | 'UNCERTAIN' | 'SUPERSEDED';
export interface RecoveryOperation { operationId: string; state: RecoveryState; createdAt: string }
export interface RecoveryStatus {
  operation: RecoveryOperation | null;
  canRecover: boolean;
  requiresReauthentication: boolean;
  canReconcile: boolean;
}
export type RecoveryResult<T> = { kind: 'ok'; data: T } | { kind: 'session-required' | 'reauthenticate' | 'forbidden' | 'conflict' | 'invalid' | 'unavailable' };
const STATES: readonly string[] = ['PENDING', 'SUCCEEDED', 'UNCERTAIN', 'SUPERSEDED'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
function record(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function operation(value: unknown): value is RecoveryOperation {
  return record(value) && Object.keys(value).sort().join(',') === 'createdAt,operationId,state'
    && typeof value.operationId === 'string' && UUID.test(value.operationId)
    && typeof value.state === 'string' && STATES.includes(value.state)
    && typeof value.createdAt === 'string' && Number.isFinite(Date.parse(value.createdAt));
}
function status(value: unknown): value is RecoveryStatus {
  return record(value) && Object.keys(value).sort().join(',') === 'canReconcile,canRecover,operation,requiresReauthentication'
    && (value.operation === null || operation(value.operation)) && typeof value.canRecover === 'boolean'
    && typeof value.requiresReauthentication === 'boolean' && typeof value.canReconcile === 'boolean';
}
async function call<T>(url: string, init: RequestInit, parse: (value: unknown) => value is T, fetchImpl: typeof fetch): Promise<RecoveryResult<T>> {
  try {
    const response = await fetchImpl(`${resolvePublicApiBaseUrl()}${url}`, { ...init, credentials: 'include', cache: 'no-store', redirect: 'error' });
    if (response.status === 401) return { kind: 'session-required' };
    if (response.status === 403) {
      const body: unknown = await response.json();
      return { kind: record(body) && body.code === 'ACCESS_RECOVERY_REAUTHENTICATE' ? 'reauthenticate' : 'forbidden' };
    }
    if (response.status === 409) return { kind: 'conflict' };
    if (response.status === 400) return { kind: 'invalid' };
    if (response.status !== 200) return { kind: 'unavailable' };
    const body: unknown = await response.json();
    return parse(body) ? { kind: 'ok', data: body } : { kind: 'unavailable' };
  } catch { return { kind: 'unavailable' }; }
}
const url = (id: string) => `/api/v1/hospital/access-requests/${encodeURIComponent(id)}/password-recovery`;
export function getRecoveryStatus(id: string, fetchImpl: typeof fetch = fetch) { return call(url(id), { method: 'GET' }, status, fetchImpl); }
export interface ResetInput { operationId: string; expectedVersion: number; identityVerified: true; supportReference: string; password: string; confirmPassword: string; predecessorId: string | null }
export function resetAccessPassword(id: string, input: ResetInput, fetchImpl: typeof fetch = fetch) {
  return call(url(id), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) }, operation, fetchImpl);
}
export function reconcileAccessPassword(id: string, operationId: string, fetchImpl: typeof fetch = fetch) {
  return call(`${url(id)}/reconcile`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ operationId }) }, operation, fetchImpl);
}
export function startRecoveryReauthentication(fetchImpl: typeof fetch = fetch): Promise<RecoveryResult<{ authorizationUrl: string }>> {
  return call('/api/v1/human-auth/reauthenticate', { method: 'POST' }, (value): value is { authorizationUrl: string } => {
    if (!record(value) || Object.keys(value).join(',') !== 'authorizationUrl' || typeof value.authorizationUrl !== 'string') return false;
    try {
      const target = new URL(value.authorizationUrl);
      return target.username === '' && target.password === '' && (target.protocol === 'https:' ||
        (target.protocol === 'http:' && ['localhost', '127.0.0.1', 'merdn.localhost', 'host.docker.internal'].includes(target.hostname)));
    } catch { return false; }
  }, fetchImpl);
}
