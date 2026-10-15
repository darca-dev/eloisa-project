import { test } from 'node:test';
import assert from 'node:assert/strict';
import { restoreRealmPresentation } from '../../scripts/identity/apply-local-login-theme.mjs';

test('rollback clears fields previously absent despite Keycloak ignoring null values', async () => {
  const realm = { realm: 'merdn-local', loginTheme: 'eloisa', displayName: 'Eloisa', defaultLocale: 'es', internationalizationEnabled: true, supportedLocales: ['es'], registrationAllowed: false };
  const previous = { realm: 'merdn-local', registrationAllowed: false };
  const api = async (_resource, method, body) => {
    if (method === 'PUT') for (const [key, value] of Object.entries(body)) if (value !== null) realm[key] = value;
    return realm;
  };
  await restoreRealmPresentation(api, previous);
  assert.equal(realm.loginTheme, ''); assert.equal(realm.defaultLocale, '');
  assert.equal(realm.internationalizationEnabled, false); assert.deepEqual(realm.supportedLocales, []);
});

test('rollback rejects an acknowledged PUT that did not restore presentation', async () => {
  await assert.rejects(restoreRealmPresentation(async () => ({ loginTheme: 'eloisa' }), {}), /rollback could not be verified/u);
});

test('rollback rejects changes outside presentation even when restored labels match', async () => {
  await assert.rejects(restoreRealmPresentation(async () => ({ registrationAllowed: true }), { registrationAllowed: false }), /must not change realm security/u);
});
