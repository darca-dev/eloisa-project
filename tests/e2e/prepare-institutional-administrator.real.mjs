import fs from 'node:fs/promises';
import path from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { execFileSync } from 'node:child_process';
import { loadEnvFile } from '../../scripts/testing/test-db-provision.mjs';
import { runRuntimeRlsPreflight } from '../../scripts/testing/test-db-preflight.mjs';
import { assertBaselineEnvironment, buildChildEnvironment } from '../../scripts/testing/run-baseline.mjs';
import { configureLocalOidc } from '../../scripts/identity/configure-local-oidc.mjs';

const env = await loadEnvFile('.secrets/baseline-mp04.local.env');
assertBaselineEnvironment(env);
let context;
await runRuntimeRlsPreflight({ envFilePath: '.secrets/baseline-mp04.local.env', onTrustedContext: value => { context = value; } });
if (!context) throw new Error('Unverified test tenant');
const child = buildChildEnvironment(env, process.env, context);
const imageSuffix = process.argv.includes('--personal-access') ? 'access041' : 'admin040';
let applicationTenant = context;
if (imageSuffix === 'access041') {
  // Every run gets fresh fictional claims without reopening an old admin slot.
  const client = new Client({ connectionString: child.DATABASE_URL });
  await client.connect();
  try {
    const tenantId = randomUUID(); const tenantCode = `personal-e2e-${randomUUID()}`;
    await client.query('INSERT INTO tenant (id, code, name, "updatedAt") VALUES ($1, $2, $3, CURRENT_TIMESTAMP)', [tenantId, tenantCode, 'Institución ficticia E2E 041']);
    applicationTenant = { ...context, tenantId, tenantCode };
  } finally { await client.end(); }
}
const directory = path.resolve('.secrets/admin040-e2e');
await fs.mkdir(directory, { recursive: true });
const secret = randomBytes(32).toString('hex');
const operatorPassword = randomBytes(32).toString('hex');
const realm = JSON.parse(await fs.readFile('infra/local-oidc/realm-merdn-local.json', 'utf8'));
delete realm.loginTheme;
realm.clients[0].redirectUris = ['http://127.0.0.1:3003/api/v1/human-auth/callback'];
realm.clients[0].webOrigins = ['http://127.0.0.1:3002'];
realm.clients[0].attributes['post.logout.redirect.uris'] = 'http://127.0.0.1:3002/';
realm.clients[1].secret = secret;
realm.users = realm.users.filter(user => user.serviceAccountClientId === 'merdn-access-provisioning');
await fs.writeFile(path.join(directory, 'realm.json'), JSON.stringify(realm), { mode: 0o600 });
const database = value => { const url = new URL(value); url.hostname = 'postgres-test'; url.port = '5432'; return url.toString(); };
const apiEnv = {
  NODE_ENV: 'production', MERDN_ENVIRONMENT: 'test', API_PORT: '3001', API_WEB_ORIGINS: 'http://127.0.0.1:3002',
  ENROLLMENT_RATE_LIMIT_MAX: '200',
  DATABASE_URL: database(child.DATABASE_URL), RUNTIME_DATABASE_URL: database(child.RUNTIME_DATABASE_URL), MERDN_RUNTIME_ROLE: 'enforce',
  MERDN_ACTIVE_TENANT_ID: applicationTenant.tenantId, MERDN_ACTIVE_TENANT_CODE: applicationTenant.tenantCode,
  MERDN_HUMAN_AUTH_ISSUER: 'http://merdn.localhost:8083/realms/merdn-local', MERDN_HUMAN_AUTH_CLIENT_ID: 'merdn-human-web',
  MERDN_HUMAN_AUTH_CALLBACK_URI: 'http://127.0.0.1:3003/api/v1/human-auth/callback', MERDN_HUMAN_AUTH_ATTEMPT_KEY: randomBytes(32).toString('hex'),
  MERDN_ACCESS_PROVISIONING_ISSUER: 'http://merdn.localhost:8083/realms/merdn-local', MERDN_ACCESS_PROVISIONING_CLIENT_ID: 'merdn-access-provisioning', MERDN_ACCESS_PROVISIONING_CLIENT_SECRET: secret,
};
const labels = { 'com.merdn.project': 'merdn-admin040-e2e', 'com.merdn.scope': 'test', 'com.merdn.disposable': 'true' };
const compose = { name: 'merdn-admin040-e2e', services: {
  oidc: { image: 'quay.io/keycloak/keycloak:26.7.1', command: ['start-dev', '--http-port=8083', '--hostname=http://merdn.localhost:8083', '--import-realm'],
    environment: { KC_BOOTSTRAP_ADMIN_USERNAME: 'test-operator', KC_BOOTSTRAP_ADMIN_PASSWORD: operatorPassword },
    volumes: [{ type: 'bind', source: path.join(directory, 'realm.json').replaceAll('\\','/'), target: '/opt/keycloak/data/import/realm.json', read_only: true }],
    ports: ['127.0.0.1:8083:8083'], networks: ['test'], labels },
  api: { image: `merdn-api:eloisa-${imageSuffix}`, environment: apiEnv, ports: ['127.0.0.1:3003:3001'], networks: ['test'], extra_hosts: ['host.docker.internal:host-gateway', 'merdn.localhost:host-gateway'], labels },
  web: { image: `merdn-web:eloisa-${imageSuffix}`, environment: { NODE_ENV: 'production', MERDN_ENVIRONMENT: 'test', MERDN_API_BASE_URL: 'http://api:3001', MERDN_HOSPITAL_DEMO_LOCAL: 'false', MERDN_MUNICIPALITY_DEMO_LOCAL: 'false', MERDN_HUMAN_ACCESS_DEMO_LOCAL: 'false' }, ports: ['127.0.0.1:3002:3000'], networks: ['test'], labels },
}, networks: { test: { external: true, name: 'merdn-baseline-test-net' } } };
const config = path.join(directory, 'compose.json');
await fs.writeFile(config, JSON.stringify(compose), { mode: 0o600 });
execFileSync('docker', ['compose', '-f', config, 'up', '-d'], { stdio: 'inherit' });
for (const url of ['http://127.0.0.1:8083/realms/merdn-local/.well-known/openid-configuration', 'http://127.0.0.1:3003/health']) {
  let ready = false;
  for (let attempt = 0; attempt < 40; attempt++) {
    try { if ((await fetch(url)).ok) { ready = true; break; } } catch { /* Startup remains unready. */ }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  if (!ready) throw new Error('Isolated test service failed readiness');
}
await configureLocalOidc({ containerName: 'merdn-admin040-e2e-oidc-1', port: 8083, output: '.secrets/admin040-e2e/runtime.json' });
await configureLocalOidc({ containerName: 'merdn-admin040-e2e-oidc-1', port: 8083, output: '.secrets/admin040-e2e/runtime.json' });
process.stdout.write('Isolated administrator test stack ready; setup idempotence verified.\n');
