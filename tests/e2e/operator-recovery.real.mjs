import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { Client } from 'pg';
import { chromium } from '@playwright/test';
import { reconcileLocalPassword } from '../../scripts/identity/local-password-recovery.mjs';
import { acquireMaintenanceLock, securePrivateDirectory } from '../../scripts/identity/local-maintenance-lock.mjs';
import { createLocalDocker } from '../../scripts/identity/local-docker.mjs';

const docker = args => execFileSync('docker', args);
const inspect = name => JSON.parse(docker(['inspect', name]))[0];
const api = inspect('merdn-admin040-e2e-api-1');
assert.equal(api.Config.Labels['com.docker.compose.project'], 'merdn-admin040-e2e');
assert.equal(api.Config.Labels['com.merdn.scope'], 'test'); assert.equal(api.Config.Labels['com.merdn.disposable'], 'true');
const env = Object.fromEntries(api.Config.Env.map(value => { const index = value.indexOf('='); return [value.slice(0, index), value.slice(index + 1)]; }));
assert.equal(env.MERDN_ENVIRONMENT, 'test');
const database = inspect('merdn-baseline-test-postgres-test-1');
assert.equal(database.Config.Labels['com.merdn.scope'], 'test'); assert.equal(database.Config.Labels['com.merdn.disposable'], 'true');
const dbUrl = new URL(env.DATABASE_URL); dbUrl.hostname = '127.0.0.1'; dbUrl.port = database.HostConfig.PortBindings['5432/tcp'][0].HostPort;
const client = new Client({ connectionString: dbUrl.toString() }); await client.connect();
const directory = path.resolve('.secrets', `operator041-${randomUUID()}`); await securePrivateDirectory(directory);
const passwordFile = path.join(directory, 'temporary.txt'); const password = randomBytes(20).toString('hex');
await fs.writeFile(passwordFile, password, { mode: 0o600 });
let browser;
try {
  // Fault fixture ONLY in the verified disposable tenant: model an uncertain
  // provider result after the full real recovery E2E, then run the real repair.
  const target = (await client.query(`SELECT o.*, r.reference, e.subject FROM access_password_recovery o
    JOIN access_request r ON r.id=o."accessRequestId" JOIN external_auth_identity e ON e.id=o."externalAuthIdentityId"
    WHERE o."tenantId"=$1::uuid AND o.state='SUCCEEDED' ORDER BY o."createdAt" DESC LIMIT 1`, [env.MERDN_ACTIVE_TENANT_ID])).rows[0];
  assert.ok(target, 'Run successful personal-access.real.mjs first');
  await client.query('BEGIN'); await client.query('SET LOCAL ROLE merdn_runtime');
  await client.query("SELECT set_config('merdn.tenant_id',$1,true)", [target.tenantId]);
  await client.query('UPDATE access_password_recovery SET state=\'UNCERTAIN\' WHERE id=$1::uuid', [target.id]);
  await client.query('UPDATE human_account SET status=\'DISABLED\',"passwordRecoveryBlocked"=true,"accessLifecycleVersion"="accessLifecycleVersion"+1 WHERE id=$1::uuid', [target.targetHumanAccountId]);
  await client.query(`INSERT INTO audit_event (id,"tenantId","eventType","actorType","resourceType","resourceId",outcome,"occurredAt")
    VALUES ($1::uuid,$2::uuid,'ACCESS_PASSWORD_RECOVERY_UNCERTAIN','SYSTEM','AccessPasswordRecovery',$3::uuid,'DENIED',clock_timestamp())`, [randomUUID(), target.tenantId, target.id]);
  await client.query('COMMIT');
  const options = { operationId: target.id, supportReference: `OP_${randomUUID()}`, passwordFile,
    apiContainer: 'merdn-admin040-e2e-api-1', idpContainer: 'merdn-admin040-e2e-oidc-1' };
  await assert.rejects(reconcileLocalPassword(options), /preconditions changed/u);
  assert.equal(inspect(api.Id).State.StartedAt, api.State.StartedAt, 'Stale lifecycle never stops the API or resets password');
  await client.query('UPDATE human_account SET "accessLifecycleVersion"="accessLifecycleVersion"-1 WHERE id=$1::uuid', [target.targetHumanAccountId]);
  const daemon = JSON.parse(docker(['info', '--format', '{{json .ID}}']));
  const lock = await acquireMaintenanceLock(createLocalDocker(), createHash('sha256').update(`${daemon}:merdn-admin040-e2e`).digest('hex'));
  try { await assert.rejects(reconcileLocalPassword(options)); }
  finally { await lock.release(); }
  const idpBefore = inspect(options.idpContainer);
  const result = await reconcileLocalPassword(options);
  assert.equal(result.state, 'SUCCEEDED'); assert.equal(inspect(options.idpContainer).Id, idpBefore.Id);
  assert.notEqual(inspect(options.idpContainer).State.StartedAt, idpBefore.State.StartedAt);
  assert.equal(inspect(api.Id).State.Running, true);
  const account = (await client.query('SELECT * FROM human_account WHERE id=$1::uuid', [target.targetHumanAccountId])).rows[0];
  assert.equal(account.status, 'ACTIVE'); assert.equal(account.passwordRecoveryBlocked, false);
  assert.ok(account.authenticationNotBefore > target.createdAt);
  assert.equal((await client.query('SELECT count(*)::int AS count FROM human_session WHERE "humanAccountId"=$1::uuid AND "revokedAt" IS NULL', [account.id])).rows[0].count, 0);
  const audit = (await client.query('SELECT "eventType","actorType" FROM audit_event WHERE "correlationId"=$1 ORDER BY "occurredAt"', [result.correlationId])).rows;
  assert.deepEqual(audit.map(row => [row.eventType, row.actorType]), [['ACCESS_PASSWORD_RECOVERY_STARTED', 'SYSTEM'], ['ACCESS_PASSWORD_RECOVERY_SUCCEEDED', 'SYSTEM']]);
  const evidence = await fs.readFile(result.evidenceFile, 'utf8'); assert.ok(!evidence.includes(password));
  assert.equal(JSON.parse(evidence).phase, 'SUCCEEDED_NEW_OPERATOR_PASSWORD'); assert.ok(JSON.parse(evidence).operatorId);
  const failures = await client.query('SELECT count(*)::int AS count FROM audit_event WHERE "resourceId"=$1::uuid AND "eventType"=\'ACCESS_PASSWORD_RECOVERY_UNCERTAIN\'', [target.id]);
  assert.ok(failures.rows[0].count > 0, 'Previous uncertainty remains in audit');
  for (let attempt = 0; attempt < 30; attempt++) {
    try { if ((await fetch('http://127.0.0.1:3003/health')).ok) break; } catch { /* Not ready yet. */ }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  browser = await chromium.launch({ headless: true }); const context = await browser.newContext();
  await context.route('http://127.0.0.1:3001/**', route => route.continue({ url: route.request().url().replace(':3001', ':3003') }));
  const page = await context.newPage(); await page.goto('http://127.0.0.1:3003/api/v1/human-auth/login?returnTo=%2Facceso');
  await page.locator('#username').fill(target.reference); await page.locator('#password').fill(password); await page.locator('#kc-login').click();
  await page.locator('#password-new').waitFor();
  const permanent = randomBytes(20).toString('hex'); await page.locator('#password-new').fill(permanent); await page.locator('#password-confirm').fill(permanent);
  await page.locator('input[type=submit], button[type=submit]').click(); await page.waitForURL('http://127.0.0.1:3002/paciente');
  process.stdout.write('Operator recovery passed: stale lifecycle and concurrent mutex denied; same IdP restarted; audited new temporary credential, session cutoff, mandatory password change and real portal login.\n');
} finally { await browser?.close(); await client.end(); await fs.rm(passwordFile, { force: true }); await fs.rmdir(directory); }
