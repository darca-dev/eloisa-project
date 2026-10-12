import assert from 'node:assert/strict';
import test from 'node:test';
import { assertLocalOidcContainer } from '../../scripts/identity/configure-local-oidc.mjs';

const labels = { 'com.docker.compose.project': 'merdn', 'com.docker.compose.service': 'oidc-local' };
const container = (bindings: unknown, identity = labels) => ({ Config: { Labels: identity }, HostConfig: { PortBindings: bindings } });
const local = { HostIp: '127.0.0.1', HostPort: '8081' };

test('accepts the owned identity service published only on loopback', () => {
  assert.doesNotThrow(() => assertLocalOidcContainer(container({ '8080/tcp': [local] }), 8081));
});
test('rejects additional public IPv4, IPv6 or unspecified bindings', () => {
  for (const HostIp of ['0.0.0.0', '::', '', '192.168.1.1']) {
    assert.throws(() => assertLocalOidcContainer(container({ '8080/tcp': [local, { HostIp, HostPort: '9090' }] }), 8081));
  }
});
test('rejects missing bindings, wrong port and a different project', () => {
  assert.throws(() => assertLocalOidcContainer(container({}), 8081));
  assert.throws(() => assertLocalOidcContainer(container({ '8080/tcp': [local] }), 8083));
  assert.throws(() => assertLocalOidcContainer(container({ '8080/tcp': [local] }, { ...labels, 'com.docker.compose.project': 'unrelated' }), 8081));
});
