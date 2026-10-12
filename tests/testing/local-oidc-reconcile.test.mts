import assert from 'node:assert/strict';
import test from 'node:test';
import { reconcileLocalIssuer } from '../../scripts/identity/local-oidc-reconcile.mjs';

const binding = { id: '00000000-0000-4000-8000-000000000001', tenantId: '00000000-0000-4000-8000-000000000002', humanAccountId: '00000000-0000-4000-8000-000000000003', subject: 'opaque-test', status: 'ACTIVE', issuer: 'http://host.docker.internal:8081/realms/merdn-local' };

test('unverified identity and wrong tenant cause no database operation', async () => {
  for (const input of [{ ...binding, tenantId: 'different-tenant' }, binding]) {
    const calls: string[] = [];
    await assert.rejects(reconcileLocalIssuer({ client: { query: async (sql: string) => { calls.push(sql); } }, tenantId: binding.tenantId, bindings: [input], verifySubject: async () => false }));
    assert.deepEqual(calls, []);
  }
});
test('an audit failure rolls back the identity update and revocations', async () => {
  const calls: string[] = [];
  const client = { query: async (sql: string) => {
    calls.push(sql);
    if (sql.startsWith('SELECT a.id')) return { rowCount: 1, rows: [{ id: binding.humanAccountId }] };
    if (sql.startsWith('SELECT issuer')) return { rows: [binding] };
    if (sql.startsWith('UPDATE external_auth_identity')) return { rowCount: 1, rows: [{ id: binding.id }] };
    if (sql.startsWith('UPDATE human_session')) return { rowCount: 1, rows: [{ id: binding.id }] };
    if (sql.startsWith('INSERT INTO audit_event')) throw new Error('test audit unavailable');
    return { rowCount: 0, rows: [] };
  } };
  await assert.rejects(reconcileLocalIssuer({ client, tenantId: binding.tenantId, bindings: [binding], verifySubject: async () => true }), /audit unavailable/);
  assert.equal(calls.at(-1), 'ROLLBACK');
  assert.equal(calls.includes('COMMIT'), false);
});
test('a repeated reconciliation preserves the existing identity without writing', async () => {
  const calls: string[] = [];
  const client = { query: async (sql: string) => {
    calls.push(sql);
    if (sql.startsWith('SELECT a.id')) return { rowCount: 1, rows: [{ id: binding.humanAccountId }] };
    if (sql.startsWith('SELECT issuer')) return { rows: [{ ...binding, issuer: 'http://merdn.localhost:8081/realms/merdn-local' }] };
    return { rowCount: 0, rows: [] };
  } };
  assert.deepEqual(await reconcileLocalIssuer({ client, tenantId: binding.tenantId, bindings: [binding], verifySubject: async () => true }), { changed: 0, revoked: 0 });
  assert.equal(calls.at(-1), 'COMMIT');
  assert.equal(calls.some(sql => sql.startsWith('UPDATE') || sql.startsWith('INSERT')), false);
});
