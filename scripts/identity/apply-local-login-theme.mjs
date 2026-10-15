import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLocalDocker } from './local-docker.mjs';
import { acquireMaintenanceLock, assertPrivateFile, securePrivateDirectory } from './local-maintenance-lock.mjs';

const presentation = { loginTheme: 'eloisa', displayName: 'Eloisa', internationalizationEnabled: true, defaultLocale: 'es', supportedLocales: ['es'] };
const fields = Object.keys(presentation);
const canonical = value => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item);
const hash = value => createHash('sha256').update(canonical(value)).digest('hex');
const otherFields = realm => Object.fromEntries(Object.entries(realm).filter(([key]) => !fields.includes(key)));

export const realmPresentation = realm => ({ loginTheme: realm.loginTheme ?? '', displayName: realm.displayName ?? '', internationalizationEnabled: realm.internationalizationEnabled ?? false, defaultLocale: realm.defaultLocale ?? '', supportedLocales: realm.supportedLocales ?? [] });

export async function restoreRealmPresentation(api, previousRealm) {
  const expected = realmPresentation(previousRealm);
  // Keycloak ignores null during PUT. Empty strings/arrays explicitly clear optional fields.
  await api('', 'PUT', expected);
  const restored = await api('');
  assert.deepEqual(realmPresentation(restored), expected, 'Presentation rollback could not be verified');
  assert.equal(hash(otherFields(restored)), hash(otherFields(previousRealm)), 'Rollback must not change realm security');
}

/** Presentation only: no imports, account changes, restarts or authentication configuration. */
export async function applyLocalLoginTheme() {
  const root = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
  const theme = path.join(root, 'infra/local-oidc/themes/eloisa');
  assert.ok((await fs.lstat(theme)).isDirectory(), 'Theme root must be a directory');
  const allowed = ['login/theme.properties', 'login/template.ftl', 'login/footer.ftl', 'login/messages/messages_es.properties', 'login/resources/css/eloisa.css', 'login/resources/img/corazon-check.png', 'login/resources/img/eli-saluda.png'];
  const files = await fs.readdir(theme, { recursive: true, withFileTypes: true });
  for (const file of files) {
    assert.ok(!file.isSymbolicLink(), 'Theme links are prohibited');
    if (file.isFile()) assert.ok(allowed.includes(path.relative(theme, path.join(file.parentPath, file.name)).split(path.sep).join('/')), 'Unexpected theme file');
  }
  for (const relative of allowed) assert.ok((await fs.lstat(path.join(theme, relative))).isFile());
  const docker = createLocalDocker();
  const inspect = () => JSON.parse(docker(['inspect', 'merdn-oidc-local-1']))[0];
  const container = inspect(); const labels = container.Config.Labels;
  assert.equal(labels['com.docker.compose.project'], 'merdn');
  assert.equal(labels['com.docker.compose.service'], 'oidc-local');
  assert.equal(container.Config.Image, 'quay.io/keycloak/keycloak:26.7.1');
  assert.equal(container.State.Running, true);
  const bindings = Object.entries(container.HostConfig.PortBindings).flatMap(([target, entries]) => entries.map(binding => ({ target, ...binding })));
  assert.ok(bindings.length === 1 && bindings[0].HostIp === '127.0.0.1' && bindings[0].HostPort === '8081' && bindings[0].target === '8081/tcp');
  const environment = Object.fromEntries(container.Config.Env.map(entry => { const index = entry.indexOf('='); return [entry.slice(0, index), entry.slice(index + 1)]; }));
  const daemon = JSON.parse(docker(['info', '--format', '{{json .ID}}']));
  const lock = await acquireMaintenanceLock(docker, createHash('sha256').update(`${daemon}:merdn`).digest('hex'));
  const directory = path.join(root, '.secrets/backups', `login-theme-${new Date().toISOString().replaceAll(':', '-')}`);
  const save = async (name, value) => { const file = path.join(directory, name); await fs.writeFile(file, JSON.stringify(value, null, 2), { mode: 0o600 }); await assertPrivateFile(file); };
  let previous; let api; let moved = false; let previousTheme = false; let previousThemeMoved = false; let safeToRelease = true;
  const target = '/opt/keycloak/themes/eloisa';
  const stage = `/opt/keycloak/themes/.eloisa-stage-${randomUUID()}`;
  const old = `${stage}-previous`;
  try {
    await securePrivateDirectory(directory);
    const base = 'http://127.0.0.1:8081';
    const tokenResponse = await fetch(`${base}/realms/master/protocol/openid-connect/token`, { method: 'POST', signal: AbortSignal.timeout(10000), body: new URLSearchParams({ grant_type: 'password', client_id: 'admin-cli', username: environment.KC_BOOTSTRAP_ADMIN_USERNAME, password: environment.KC_BOOTSTRAP_ADMIN_PASSWORD }) });
    assert.equal(tokenResponse.status, 200, 'Local operator authentication failed');
    const token = (await tokenResponse.json()).access_token;
    api = async (resource, method = 'GET', body) => {
      if (method === 'PUT') assert.deepEqual(Object.keys(body).sort(), [...fields].sort(), 'Only presentation fields may change');
      const response = await fetch(`${base}/admin/realms/merdn-local${resource}`, { method, signal: AbortSignal.timeout(10000), headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
      assert.ok(response.ok, `Local realm request failed: ${method} ${response.status}`);
      return response.status === 204 ? null : response.json();
    };
    const state = async () => {
      const [realm, clients, profile, users] = await Promise.all([api(''), api('/clients'), api('/users/profile'), api('/users?first=0&max=10000')]);
      const countResponse = await api('/users/count'); assert.equal(users.length, countResponse, 'Complete local user inventory required');
      return { realm, fingerprints: { realm: hash(otherFields(realm)), clients: hash(clients.sort((a, b) => a.id.localeCompare(b.id))), profile: hash(profile), users: hash(users.sort((a, b) => a.id.localeCompare(b.id))) } };
    };
    previous = await state();
    const discovery = await fetch(`${base}/realms/merdn-local/.well-known/openid-configuration`);
    assert.equal((await discovery.json()).issuer, 'http://merdn.localhost:8081/realms/merdn-local');
    await save('before.json', { containerId: container.Id, presentation: realmPresentation(previous.realm), fingerprints: previous.fingerprints });
    try { docker(['exec', container.Id, 'test', '-d', target]); previousTheme = true; } catch { /* No previous custom theme. */ }
    if (previousTheme) { await fs.mkdir(path.join(directory, 'themes')); docker(['cp', `${container.Id}:${target}`, path.join(directory, 'themes/eloisa')]); }
    await lock.assertOwned();
    assert.equal(inspect().Id, container.Id);
    docker(['cp', theme, `${container.Id}:${stage}`]);
    for (const relative of allowed) docker(['exec', '--user', '1000', container.Id, 'test', '-r', `${stage}/${relative}`]);
    safeToRelease = false;
    if (previousTheme) { previousThemeMoved = true; docker(['exec', container.Id, 'mv', '--', target, old]); }
    docker(['exec', container.Id, 'mv', '--', stage, target]); moved = true;
    await api('', 'PUT', presentation);
    const after = await state();
    assert.deepEqual(after.fingerprints, previous.fingerprints, 'Realm security, clients, profile and users must be unchanged');
    assert.deepEqual(Object.fromEntries(fields.map(key => [key, after.realm[key]])), presentation);
    assert.equal(inspect().Id, container.Id);
    await save('verification.json', { ok: true, containerPreserved: true, accountsAndSecurityPreserved: true, presentation });
    safeToRelease = true;
    process.stdout.write(JSON.stringify({ ok: true, theme: 'eloisa', locale: 'es', containerPreserved: true, accountsAndSecurityPreserved: true, backup: path.relative(root, directory) }) + '\n');
  } catch (error) {
    if (!safeToRelease && previous && api) {
      try {
        await lock.assertOwned(); assert.equal(inspect().Id, container.Id);
        if (previousThemeMoved) {
          docker(['exec', container.Id, 'test', '-d', old]);
          if (moved) docker(['exec', container.Id, 'mv', '--', target, `${stage}-failed`]);
          docker(['exec', container.Id, 'mv', '--', old, target]);
          docker(['exec', '--user', '1000', container.Id, 'test', '-r', `${target}/login/theme.properties`]);
          previousThemeMoved = false;
        }
        await restoreRealmPresentation(api, previous.realm);
        await save('rollback.json', { restoredPresentation: true, previousThemeRestored: previousTheme, error: error.message });
        safeToRelease = true;
      } catch {
        await save('uncertain.json', { status: 'UNCERTAIN', lockRetained: lock.name, containerId: container.Id });
        throw new Error('Local theme operation is uncertain; maintenance lock retained. Inspect the private backup before retrying.');
      }
    }
    throw error;
  } finally { if (safeToRelease) await lock.release(); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 2) throw new Error('Run without arguments; this operation targets only the approved local instance');
  await applyLocalLoginTheme();
}
