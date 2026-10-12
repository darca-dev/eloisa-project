import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { assertLocalOidcContainer } from './configure-local-oidc.mjs';
import { acquireMaintenanceLock, assertPrivateFile, securePrivateDirectory } from './local-maintenance-lock.mjs';
import { createLocalDocker } from './local-docker.mjs';

const environment = container => Object.fromEntries(container.Config.Env.map(value => { const index = value.indexOf('='); return [value.slice(0, index), value.slice(index + 1)]; }));
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/iu.test(value);

/** Eligibility is re-evaluated under request -> account locks at both ends. */
export async function loadRecoverySnapshot(client, tenantId, operationId, issuer) {
  const operation = (await client.query('SELECT * FROM access_password_recovery WHERE id=$1::uuid AND "tenantId"=$2::uuid', [operationId, tenantId])).rows[0];
  if (!operation) throw new Error('Recovery unavailable');
  await client.query('SELECT id FROM access_request WHERE id=$1::uuid AND "tenantId"=$2::uuid FOR UPDATE', [operation.accessRequestId, tenantId]);
  await client.query('SELECT id FROM human_account WHERE id=$1::uuid AND "tenantId"=$2::uuid FOR UPDATE', [operation.targetHumanAccountId, tenantId]);
  const row = (await client.query(`SELECT o.*, r.version AS "requestVersion", r.status::text AS "requestStatus",
    r."humanAccountId" AS "requestAccount", r."externalAuthIdentityId" AS "requestBinding", r."requestedProfile"::text AS profile,
    a.status::text AS "accountStatus", a."passwordRecoveryBlocked", a."accessLifecycleVersion", e.subject, e.issuer, e.status::text AS "bindingStatus"
    FROM access_password_recovery o JOIN access_request r ON r.id=o."accessRequestId" AND r."tenantId"=o."tenantId"
    JOIN human_account a ON a.id=o."targetHumanAccountId" AND a."tenantId"=o."tenantId"
    JOIN external_auth_identity e ON e.id=o."externalAuthIdentityId" AND e."tenantId"=o."tenantId" AND e."humanAccountId"=a.id
    WHERE o.id=$1::uuid AND o."tenantId"=$2::uuid`, [operationId, tenantId])).rows[0];
  const latest = (await client.query('SELECT id FROM access_password_recovery WHERE "tenantId"=$1::uuid AND "targetHumanAccountId"=$2::uuid ORDER BY "createdAt" DESC,id DESC LIMIT 1', [tenantId, operation.targetHumanAccountId])).rows[0];
  const privileged = (await client.query(`SELECT
    (SELECT count(*)::int FROM institutional_administrator_registration WHERE "tenantId"=$1::uuid AND "humanAccountId"=$2::uuid) +
    (SELECT count(*)::int FROM platform_support_capability WHERE "homeTenantId"=$1::uuid AND "humanAccountId"=$2::uuid) AS count`, [tenantId, operation.targetHumanAccountId])).rows[0];
  if (!row || !['PENDING', 'UNCERTAIN'].includes(row.state) || latest?.id !== row.id || privileged.count !== 0
    || row.requestStatus !== 'APPROVED' || !['PATIENT', 'CAREGIVER', 'FIELD_PROFESSIONAL'].includes(row.profile)
    || row.requestAccount !== row.targetHumanAccountId || row.requestBinding !== row.externalAuthIdentityId
    || row.accountStatus !== 'DISABLED' || !row.passwordRecoveryBlocked
    || row.accessLifecycleVersion !== row.expectedAccountVersion || row.bindingStatus !== 'ACTIVE' || row.issuer !== issuer) throw new Error('Recovery preconditions changed');
  return row;
}

export async function reconcileLocalPassword({ operationId, supportReference, passwordFile,
  apiContainer = 'merdn-api-1', idpContainer = 'merdn-oidc-local-1' }) {
  if (!uuid(operationId) || !/^[A-Za-z0-9][A-Za-z0-9_-]{5,63}$/u.test(supportReference ?? '')) throw new Error('Explicit recovery identifiers required');
  const docker = createLocalDocker();
  const inspect = name => JSON.parse(docker(['inspect', name]))[0];
  const privateRoot = await fs.realpath('.secrets');
  const secretPath = await fs.realpath(passwordFile);
  if (!secretPath.startsWith(privateRoot + path.sep)) throw new Error('Password file must be private');
  await assertPrivateFile(secretPath);
  const password = (await fs.readFile(secretPath, 'utf8')).replace(/\r?\n$/u, '');
  if (password.length < 8 || password.length > 72 || !/[A-Za-z]/u.test(password) || !/[0-9]/u.test(password)) throw new Error('Invalid temporary password');
  const api = inspect(apiContainer), idp = inspect(idpContainer);
  const project = api.Config.Labels['com.docker.compose.project'];
  const isolated = project === 'merdn-admin040-e2e' && api.Config.Labels['com.merdn.scope'] === 'test' && api.Config.Labels['com.merdn.disposable'] === 'true';
  if (project !== 'merdn' && !isolated) throw new Error('Unknown local project');
  if (api.Config.Labels['com.docker.compose.service'] !== 'api' || idp.Config.Labels['com.docker.compose.project'] !== project || !api.State.Running || !idp.State.Running) throw new Error('Local service identity mismatch');
  const apiEnv = environment(api), idpEnv = environment(idp);
  const issuer = apiEnv.MERDN_HUMAN_AUTH_ISSUER;
  if (issuer !== apiEnv.MERDN_ACCESS_PROVISIONING_ISSUER || !uuid(apiEnv.MERDN_ACTIVE_TENANT_ID)) throw new Error('Exact local configuration required');
  const issuerUrl = new URL(issuer);
  if (issuerUrl.protocol !== 'http:' || issuerUrl.hostname !== 'merdn.localhost' || issuerUrl.pathname !== '/realms/merdn-local') throw new Error('Only the local realm is supported');
  const port = Number(issuerUrl.port); assertLocalOidcContainer(idp, port);
  const apiBindings = Object.values(api.HostConfig.PortBindings ?? {}).flat();
  if (!apiBindings.length || apiBindings.some(value => value.HostIp !== '127.0.0.1')) throw new Error('Only a loopback API is supported');
  const apis = docker(['ps', '-a', '--filter', `label=com.docker.compose.project=${project}`, '--filter', 'label=com.docker.compose.service=api', '-q']).toString().trim().split(/\s+/u).filter(Boolean);
  if (apis.length !== 1 || !api.Id.startsWith(apis[0])) throw new Error('Exactly one API emitter required');
  const daemon = JSON.parse(docker(['info', '--format', '{{json .ID}}']));
  const key = createHash('sha256').update(`${daemon}:${project}`).digest('hex');
  const directory = path.join(os.homedir(), '.merdn-maintenance', key);
  await securePrivateDirectory(directory);
  const lock = await acquireMaintenanceLock(docker, key);
  const correlationId = randomUUID(); const evidenceFile = path.join(directory, `${correlationId}.json`);
  const evidence = { correlationId, operationId, supportReference, apiId: api.Id, idpId: idp.Id, lockName: lock.name, phase: 'LOCKED', operatorId: null };
  const save = async phase => { evidence.phase = phase; await fs.writeFile(evidenceFile, JSON.stringify(evidence), { mode: 0o600 }); await assertPrivateFile(evidenceFile); };
  let client; let stopped = false; let restorationConfirmed = false;
  const base = `http://127.0.0.1:${port}`; let token;
  async function authenticate() {
    const response = await fetch(`${base}/realms/master/protocol/openid-connect/token`, { method: 'POST', signal: AbortSignal.timeout(10000),
      body: new URLSearchParams({ grant_type: 'password', client_id: 'admin-cli', username: idpEnv.KC_BOOTSTRAP_ADMIN_USERNAME, password: idpEnv.KC_BOOTSTRAP_ADMIN_PASSWORD }) });
    if (!response.ok) throw new Error('Identity operator authentication failed');
    token = (await response.json()).access_token;
    const users = await call(`/admin/realms/master/users?username=${encodeURIComponent(idpEnv.KC_BOOTSTRAP_ADMIN_USERNAME)}&exact=true`);
    if (!Array.isArray(users) || users.length !== 1 || !uuid(users[0].id)) throw new Error('Nominal operator unavailable');
    evidence.operatorId = users[0].id;
  }
  async function call(route, method = 'GET', body) {
    await lock.assertOwned();
    const response = await fetch(`${base}${route}`, { method, signal: AbortSignal.timeout(10000),
      headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    if (!response.ok) throw new Error('Identity operation not confirmed');
    return response.status === 204 ? null : response.json();
  }
  const userRoute = snapshot => `/admin/realms/merdn-local/users/${encodeURIComponent(snapshot.subject)}`;
  const verifyUser = async snapshot => {
    const user = await call(userRoute(snapshot));
    if (user.id !== snapshot.subject || user.enabled !== true || JSON.stringify(user.attributes?.merdnAccessRequest) !== JSON.stringify([snapshot.accessRequestId])) throw new Error('Exact remote identity required');
    return user;
  };
  const tx = async work => {
    await client.query('BEGIN');
    try { await client.query('SET LOCAL ROLE merdn_runtime'); await client.query("SELECT set_config('merdn.tenant_id',$1,true)", [apiEnv.MERDN_ACTIVE_TENANT_ID]); const result = await work(); await client.query('COMMIT'); return result; }
    catch (error) { await client.query('ROLLBACK'); throw error; }
  };
  const audit = event => client.query(`INSERT INTO audit_event (id,"tenantId","eventType","actorType","resourceType","resourceId",outcome,endpoint,"correlationId","occurredAt")
    VALUES ($1::uuid,$2::uuid,$3::"AuditEventType",'SYSTEM','AccessPasswordRecovery',$4::uuid,'SUCCESS','cli local-password-recovery',$5,clock_timestamp())`, [randomUUID(), apiEnv.MERDN_ACTIVE_TENANT_ID, event, operationId, correlationId]);
  try {
    await authenticate(); await save('OPERATOR_VERIFIED');
    const dbUrl = new URL(apiEnv.DATABASE_URL); const databaseName = project === 'merdn' ? 'merdn-postgres-1' : 'merdn-baseline-test-postgres-test-1';
    const database = inspect(databaseName); const bindings = database.HostConfig.PortBindings?.['5432/tcp'];
    if (bindings?.length !== 1 || bindings[0].HostIp !== '127.0.0.1') throw new Error('Verified local database required');
    if (project !== 'merdn' && (database.Config.Labels['com.merdn.scope'] !== 'test' || database.Config.Labels['com.merdn.disposable'] !== 'true')) throw new Error('Disposable test database required');
    if (project === 'merdn' && database.Config.Labels['com.docker.compose.project'] !== project) throw new Error('Database project mismatch');
    dbUrl.hostname = '127.0.0.1'; dbUrl.port = bindings[0].HostPort;
    client = new Client({ connectionString: dbUrl.toString() }); await client.connect();
    const snapshot = await tx(() => loadRecoverySnapshot(client, apiEnv.MERDN_ACTIVE_TENANT_ID, operationId, issuer));
    await verifyUser(snapshot); const realm = await call('/admin/realms/merdn-local');
    await lock.assertOwned(); docker(['stop', api.Id]); stopped = true;
    if (inspect(api.Id).State.Running) throw new Error('API did not stop');
    await lock.assertOwned(); docker(['restart', idp.Id]);
    for (let attempt = 0; attempt < 60; attempt++) {
      try { const response = await fetch(`${base}/realms/merdn-local/.well-known/openid-configuration`, { signal: AbortSignal.timeout(1000) }); if (response.ok && (await response.json()).issuer === issuer) break; }
      catch { /* Remains unready; never send credentials to an unverified issuer. */ }
      if (attempt === 59) throw new Error('Identity restart unconfirmed');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    if (inspect(idp.Id).Id !== idp.Id || !inspect(idp.Id).State.Running) throw new Error('Identity instance changed');
    await authenticate(); if ((await call('/admin/realms/merdn-local')).id !== realm.id) throw new Error('Realm changed');
    await verifyUser(snapshot); await save('QUIESCENT');
    await tx(async () => { const current = await loadRecoverySnapshot(client, apiEnv.MERDN_ACTIVE_TENANT_ID, operationId, issuer); if (current.requestVersion !== snapshot.requestVersion || current.subject !== snapshot.subject) throw new Error('Recovery changed'); await audit('ACCESS_PASSWORD_RECOVERY_STARTED'); });
    // Exactly one PUT after all previous workers and IdP requests have stopped.
    await call(`${userRoute(snapshot)}/reset-password`, 'PUT', { type: 'password', value: password, temporary: true });
    await call(`${userRoute(snapshot)}/logout`, 'POST');
    const user = await verifyUser(snapshot); const sessions = await call(`${userRoute(snapshot)}/sessions`);
    if (!user.requiredActions?.includes('UPDATE_PASSWORD') || !Array.isArray(sessions) || sessions.length !== 0) throw new Error('Reset and logout not confirmed');
    await tx(async () => {
      const current = await loadRecoverySnapshot(client, apiEnv.MERDN_ACTIVE_TENANT_ID, operationId, issuer);
      if (current.requestVersion !== snapshot.requestVersion || current.subject !== snapshot.subject || current.accessLifecycleVersion !== snapshot.accessLifecycleVersion) throw new Error('Recovery changed');
      const clock = (await client.query('SELECT clock_timestamp() AS now')).rows[0].now;
      await client.query('UPDATE human_session SET "revokedAt"=$1 WHERE "tenantId"=$2::uuid AND "humanAccountId"=$3::uuid AND "revokedAt" IS NULL', [clock, snapshot.tenantId, snapshot.targetHumanAccountId]);
      await client.query('UPDATE human_account SET status=\'ACTIVE\',"passwordRecoveryBlocked"=false,"authenticationNotBefore"=$1,"updatedAt"=$1 WHERE id=$2::uuid AND "tenantId"=$3::uuid', [clock, snapshot.targetHumanAccountId, snapshot.tenantId]);
      await client.query('UPDATE access_password_recovery SET state=\'SUCCEEDED\',"finishedAt"=$1 WHERE id=$2::uuid AND "tenantId"=$3::uuid', [clock, operationId, snapshot.tenantId]);
      await audit('ACCESS_PASSWORD_RECOVERY_SUCCEEDED');
    });
    await save('SUCCEEDED_NEW_OPERATOR_PASSWORD');
    return { state: 'SUCCEEDED', correlationId, evidenceFile };
  } finally {
    await client?.end();
    await lock.assertOwned();
    if (stopped) { docker(['start', api.Id]); restorationConfirmed = inspect(api.Id).State.Running; }
    else restorationConfirmed = true;
    if (restorationConfirmed) await lock.release();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.length !== 6 || args[0] !== '--operation-id' || args[2] !== '--support-reference' || args[4] !== '--password-file') throw new Error('Explicit private arguments required');
    const result = await reconcileLocalPassword({ operationId: args[1], supportReference: args[3], passwordFile: args[5] });
    process.stdout.write(JSON.stringify(result) + '\n');
  } catch { process.stderr.write('Conciliación no confirmada. Consulte el estado y la evidencia privada; no repita sin revisar el bloqueo de mantenimiento.\n'); process.exitCode = 1; }
}
