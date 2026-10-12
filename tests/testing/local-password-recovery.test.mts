import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { acquireMaintenanceLock, assertPrivateFile, securePrivateDirectory } from '../../scripts/identity/local-maintenance-lock.mjs';
import { assertLocalDockerEndpoint, createLocalDocker } from '../../scripts/identity/local-docker.mjs';

test('remote Docker cannot be confused with loopback services on this computer', () => {
  for (const endpoint of ['ssh://operator@example.invalid', 'tcp://127.0.0.1:2375', 'tcp://remote.example.invalid:2376', 'npipe://remote/pipe/docker_engine']) {
    assert.throws(() => assertLocalDockerEndpoint(endpoint, 'win32'), /local Docker/u);
    assert.throws(() => assertLocalDockerEndpoint(endpoint, 'linux'), /local Docker/u);
  }
  assert.throws(() => createLocalDocker({ ...process.env, DOCKER_HOST: 'ssh://operator@example.invalid' }), /local Docker/u);
  assert.equal(assertLocalDockerEndpoint('npipe:////./pipe/dockerDesktopLinuxEngine', 'win32'), 'npipe:////./pipe/dockerDesktopLinuxEngine');
  assert.equal(assertLocalDockerEndpoint('unix:///var/run/docker.sock', 'linux'), 'unix:///var/run/docker.sock');
});

test('daemon mutex excludes different homes and an old owner cannot release a replacement', async () => {
  const docker = createLocalDocker();
  const key = createHash('sha256').update(`mutex-test:${randomUUID()}`).digest('hex');
  const lock = await acquireMaintenanceLock(docker, key);
  let replacement;
  try {
    const endpoint = JSON.parse(docker(['context', 'inspect', '--format', '{{json .Endpoints.docker.Host}}']));
    const anotherHome = createLocalDocker({ ...process.env, DOCKER_HOST: endpoint, DOCKER_CONTEXT: '', HOME: path.resolve('.secrets', 'other-home'), USERPROFILE: path.resolve('.secrets', 'other-home') });
    await assert.rejects(acquireMaintenanceLock(anotherHome, key));
    await lock.release();
    replacement = await acquireMaintenanceLock(anotherHome, key);
    await assert.rejects(lock.release(), /ownership lost/u);
    await replacement.assertOwned();
  } finally { if (replacement) await replacement.release(); else await lock.release(); }
});

test('private evidence has effective owner-only permissions before use', async () => {
  const directory = path.resolve('.secrets', `maintenance-test-${randomUUID()}`);
  await securePrivateDirectory(directory);
  const file = path.join(directory, 'evidence.json');
  try {
    await fs.writeFile(file, '{}', { mode: 0o600 });
    await assertPrivateFile(directory); await assertPrivateFile(file);
    if (process.platform !== 'win32') {
      await fs.chmod(file, 0o644); await assert.rejects(assertPrivateFile(file), /Private permissions/u);
    }
  } finally { await fs.rm(file, { force: true }); await fs.rmdir(directory); }
});
