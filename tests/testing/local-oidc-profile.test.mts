import assert from 'node:assert/strict';
import test from 'node:test';
import { buildLocalProvisioningProfile } from '../../scripts/identity/local-oidc-profile.mjs';

test('marker is managed, admin-only and cannot be changed by an end user', () => {
  const original = { attributes: [{ name: 'username' }, { name: 'email', required: { roles: ['user'] } }, { name: 'firstName', required: { roles: ['user'] } }], groups: [{ name: 'metadata' }] };
  const result = buildLocalProvisioningProfile(original);
  assert.equal(Object.hasOwn(result, 'unmanagedAttributePolicy'), false);
  const marker = result.attributes.find(attribute => attribute.name === 'merdnAccessRequest');
  assert.deepEqual(marker.permissions, { view: ['admin'], edit: ['admin'] });
  assert.equal(marker.multivalued, false);
  assert.equal(result.attributes.find(attribute => attribute.name === 'email').required, undefined);
  assert.deepEqual(original.attributes[1].required, { roles: ['user'] });
  assert.deepEqual(result.groups, original.groups);
  assert.deepEqual(buildLocalProvisioningProfile(result), result);
});
test('a previously permissive unmanaged policy is removed', () => {
  const result = buildLocalProvisioningProfile({ attributes: [{ name: 'username' }], unmanagedAttributePolicy: 'ENABLED' });
  assert.equal(Object.hasOwn(result, 'unmanagedAttributePolicy'), false);
});
test('unknown provider profile fails without creating a permissive fallback', () => {
  for (const invalid of [null, {}, { attributes: [] }]) assert.throws(() => buildLocalProvisioningProfile(invalid));
});
