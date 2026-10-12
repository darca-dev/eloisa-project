import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildLocalProvisioningProfile } from './local-oidc-profile.mjs';

export function assertLocalOidcContainer(container, port) {
  const labels = container?.Config?.Labels ?? {};
  const active = labels['com.docker.compose.project'] === 'merdn' && labels['com.docker.compose.service'] === 'oidc-local';
  const isolated = labels['com.docker.compose.project'] === 'merdn-admin040-e2e' && labels['com.merdn.scope'] === 'test' && labels['com.merdn.disposable'] === 'true';
  const binding = Object.values(container?.HostConfig?.PortBindings ?? {}).flat();
  if ((!active && !isolated) || !binding.some(value => value?.HostIp === '127.0.0.1' && value.HostPort === String(port))
    || binding.some(value => value?.HostIp !== '127.0.0.1' && value?.HostIp !== '::1')) throw new Error('Unexpected local identity container');
}

/** Local operator setup, never an end-user registration or password reset. */
export async function configureLocalOidc({ containerName = 'merdn-oidc-local-1', port = 8081, output = '.secrets/admin040-runtime-provisioning.json' } = {}) {
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid local port');
  const privateRoot = path.resolve('.secrets');
  const destination = path.resolve(output);
  if (!destination.startsWith(privateRoot + path.sep)) throw new Error('Output must stay in .secrets');
  const container = JSON.parse(execFileSync('docker', ['inspect', containerName]))[0];
  assertLocalOidcContainer(container, port);
  const env = Object.fromEntries(container.Config.Env.map(value => { const separator = value.indexOf('='); return [value.slice(0, separator), value.slice(separator + 1)]; }));
  if (!env.KC_BOOTSTRAP_ADMIN_USERNAME || !env.KC_BOOTSTRAP_ADMIN_PASSWORD) throw new Error('Local operator configuration missing');
  const base = `http://127.0.0.1:${port}`;
  const tokenResponse = await fetch(`${base}/realms/master/protocol/openid-connect/token`, {
    method: 'POST', signal: AbortSignal.timeout(10000),
    body: new URLSearchParams({ grant_type: 'password', client_id: 'admin-cli', username: env.KC_BOOTSTRAP_ADMIN_USERNAME, password: env.KC_BOOTSTRAP_ADMIN_PASSWORD }),
  });
  if (!tokenResponse.ok) throw new Error('Local identity operator could not authenticate');
  const token = (await tokenResponse.json()).access_token;
  async function call(resource, method = 'GET', body) {
    const response = await fetch(`${base}/admin/realms/merdn-local${resource}`, {
      method, signal: AbortSignal.timeout(10000), headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!response.ok) throw new Error(`Local identity configuration failed (${method}, ${response.status})`);
    return response.status === 204 || response.status === 201 ? null : response.json();
  }
  const previousProfile = await call('/users/profile');
  const previousRealm = await call('');
  const previousClients = await call('/clients');
  const backup = path.join(privateRoot, 'backups', `oidc040-${new Date().toISOString().replaceAll(':', '-')}`);
  await fs.mkdir(backup, { recursive: true });
  await fs.writeFile(path.join(backup, 'before.json'), JSON.stringify({ previousProfile, previousRealm, previousClients }), { mode: 0o600 });
  let client = (await call('/clients?clientId=merdn-access-provisioning'))[0];
  if (!client) {
    const template = JSON.parse(await fs.readFile(new URL('../../infra/local-oidc/realm-merdn-local.json', import.meta.url), 'utf8')).clients.find(value => value.clientId === 'merdn-access-provisioning');
    await call('/clients', 'POST', { ...template, secret: randomBytes(32).toString('hex') });
    client = (await call('/clients?clientId=merdn-access-provisioning'))[0];
  }
  if (!client || client.publicClient || !client.serviceAccountsEnabled || !client.enabled || client.standardFlowEnabled || client.directAccessGrantsEnabled) throw new Error('Existing provisioning client is incompatible; not overwritten');
  const serviceAccount = await call(`/clients/${client.id}/service-account-user`);
  const management = (await call('/clients?clientId=realm-management'))[0];
  const role = await call(`/clients/${management.id}/roles/manage-users`);
  await call(`/users/${serviceAccount.id}/role-mappings/clients/${management.id}`, 'POST', [{ id: role.id, name: role.name }]);
  await call('/users/profile', 'PUT', buildLocalProvisioningProfile(previousProfile));
  const frontendUrl = `http://merdn.localhost:${port}`;
  await call('', 'PUT', { attributes: { ...previousRealm.attributes, frontendUrl } });
  const configuredProfile = await call('/users/profile');
  const marker = configuredProfile.attributes.find(attribute => attribute.name === 'merdnAccessRequest');
  if (JSON.stringify(marker?.permissions?.view) !== '["admin"]' || JSON.stringify(marker?.permissions?.edit) !== '["admin"]'
    || (configuredProfile.unmanagedAttributePolicy !== undefined && configuredProfile.unmanagedAttributePolicy !== null)) throw new Error('Provider did not retain the restricted profile');
  const discovery = await fetch(`${base}/realms/merdn-local/.well-known/openid-configuration`, { signal: AbortSignal.timeout(10000) });
  if (!discovery.ok || (await discovery.json()).issuer !== `${frontendUrl}/realms/merdn-local`) throw new Error('Local issuer verification failed');
  const credential = await call(`/clients/${client.id}/client-secret`);
  if (typeof credential.value !== 'string' || credential.value.length < 16) throw new Error('Provisioning credential missing');
  const issuer = `${frontendUrl}/realms/merdn-local`;
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(destination, JSON.stringify({
    MERDN_HUMAN_AUTH_ISSUER: issuer, MERDN_ACCESS_PROVISIONING_ISSUER: issuer,
    MERDN_ACCESS_PROVISIONING_CLIENT_ID: 'merdn-access-provisioning', MERDN_ACCESS_PROVISIONING_CLIENT_SECRET: credential.value,
  }), { mode: 0o600 });
  process.stdout.write('Local identity configuration verified and backed up privately; no human accounts or passwords changed.\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length) throw new Error('Run without arguments from the project root; imported callers may select the isolated test container');
  await configureLocalOidc();
}
