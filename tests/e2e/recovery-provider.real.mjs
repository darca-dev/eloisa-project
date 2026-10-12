import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import dns from 'node:dns';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { assertLocalOidcContainer } from '../../scripts/identity/configure-local-oidc.mjs';

// Provider-boundary evidence for 041; this does not certify the future recovery API.
const container = JSON.parse(execFileSync('docker', ['inspect', 'merdn-admin040-e2e-oidc-1']))[0];
assertLocalOidcContainer(container, 8083);
assert.equal(container.Config.Labels['com.docker.compose.project'], 'merdn-admin040-e2e');
assert.equal(container.Config.Labels['com.merdn.disposable'], 'true');
const runtime = JSON.parse(await fs.readFile('.secrets/admin040-e2e/runtime.json', 'utf8'));
assert.equal(runtime.MERDN_ACCESS_PROVISIONING_ISSUER, 'http://merdn.localhost:8083/realms/merdn-local');
// Chromium resolves *.localhost automatically; Node needs the equivalent exact,
// process-local DNS mapping. HTTP responses and cryptographic verification are real.
const originalLookup = dns.lookup;
dns.lookup = function lookup(hostname, options, callback) {
  if (hostname !== 'merdn.localhost') return originalLookup.call(dns, hostname, options, callback);
  const done = typeof options === 'function' ? options : callback;
  if (options?.all) done(null, [{ address: '127.0.0.1', family: 4 }]);
  else done(null, '127.0.0.1', 4);
};
const require = createRequire(import.meta.url);
const { AccessProvisioningIdentityClient } = require('../../apps/api/dist/access-requests/access-provisioning-identity.client.js');
const { OidcAdapter } = require('../../apps/api/dist/human-auth/oidc.adapter.js');
const identity = new AccessProvisioningIdentityClient({ accessProvisioning: {
  issuer: runtime.MERDN_ACCESS_PROVISIONING_ISSUER, adminUrl: 'http://merdn.localhost:8083', realm: 'merdn-local',
  clientId: runtime.MERDN_ACCESS_PROVISIONING_CLIENT_ID, clientSecret: runtime.MERDN_ACCESS_PROVISIONING_CLIENT_SECRET,
} });
const callbackUri = 'http://127.0.0.1:3003/api/v1/human-auth/callback';
const adapter = new OidcAdapter({ issuer: runtime.MERDN_HUMAN_AUTH_ISSUER, clientId: 'merdn-human-web', callbackUri,
  allowedAlgorithm: 'RS256', requestTimeoutMs: 10000, insecureLocalIssuer: true });
const username = `recovery-test-${randomUUID()}`;
const marker = randomUUID();
const password = randomBytes(24).toString('hex');
const temporaryPassword = randomBytes(24).toString('hex');
const permanentPassword = randomBytes(24).toString('hex');
const user = await identity.createDisabledUser({ username, marker, password });
await identity.setEnabled(user.id, true);
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  async function login(credential, changePassword = false) {
    const requestedAt = new Date();
    const nonce = randomBytes(24).toString('hex');
    const request = await adapter.buildAuthorizationRequest(nonce, true);
    const callback = page.waitForRequest(value => value.url().startsWith(callbackUri + '?'), { timeout: 30000 });
    await page.goto(request.authorizationUrl);
    await page.locator('#username').fill(username);
    await page.locator('#password').fill(credential);
    await page.locator('#kc-login').click();
    if (changePassword) {
      await page.locator('#password-new').waitFor();
      await page.locator('#password-new').fill(permanentPassword);
      await page.locator('#password-confirm').fill(permanentPassword);
      await page.locator('input[type=submit], button[type=submit]').click();
    }
    const received = new URL((await callback).url());
    const verified = await adapter.exchangeAndVerify(received.searchParams, {
      state: request.state, nonce, codeVerifier: request.codeVerifier, freshAuthenticationRequestedAt: requestedAt,
    });
    assert.equal(verified?.subject, user.id);
    assert.ok(verified.authenticatedAt instanceof Date);
  }
  await login(password);
  await identity.setTemporaryPasswordOnce(user.id, marker, temporaryPassword);
  await identity.revokeUserSessions(user.id, marker);
  await login(temporaryPassword, true);
  await identity.revokeUserSessions(user.id, marker);
  await login(permanentPassword);
  await identity.revokeUserSessions(user.id, marker);
  process.stdout.write('041 provider boundary passed: signed fresh OIDC authentication, single temporary reset, mandatory browser password change, permanent login and verified IdP session revocation. Recovery API remains pending.\n');
} finally { await browser.close(); dns.lookup = originalLookup; }
