import { execFileSync, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const catalog = JSON.parse(readFileSync(new URL('./secrets-scan.exceptions.json', import.meta.url), 'utf8'));
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const credential = () => randomBytes(18).toString('hex');
const assignment = (value) => ['password', JSON.stringify(value)].join(': ');
const dsn = (value) => ['postgresql://operator', value].join(':') + '@db.internal:5432/app';

function fixture(t) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'merdn-secret-test-'));
  t.after(() => {
    assert.equal(path.dirname(path.resolve(root)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('merdn-secret-test-'));
    rmSync(root, { recursive: true, force: true });
  });
  const env = { ...process.env, GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'safe.directory', GIT_CONFIG_VALUE_0: root };
  delete env.GIT_DIR;
  delete env.GIT_WORK_TREE;
  execFileSync('git', ['init', '--quiet'], { cwd: root, env, stdio: 'pipe' });
  const write = (file, value) => {
    const target = path.join(root, file);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, value);
  };
  write('tests/secrets-scan.exceptions.json', JSON.stringify({ version: 1, entries: [] }));
  copyFileSync(new URL('./secrets-scan.check.mjs', import.meta.url), path.join(root, 'tests/secrets-scan.check.mjs'));
  const run = () => {
    const result = spawnSync(process.execPath, ['tests/secrets-scan.check.mjs'], { cwd: root, env, encoding: 'utf8' });
    assert.equal(result.error, undefined);
    return { status: result.status, output: result.stdout + result.stderr };
  };
  return { write, run };
}

test('un repositorio limpio y los marcadores exactos pasan', (t) => {
  const sandbox = fixture(t);
  sandbox.write('.env.example', `DATABASE_URL=${dsn('fictitious-not-a-secret')}`);
  const result = sandbox.run();
  assert.equal(result.status, 0, result.output);
  assert.match(result.output, /contenido escaneado\): 1\/1/u);
});

for (const file of ['app.ts', 'tests/new.test.ts', 'docs/new.md', '.env.example', 'package-lock.json', 'npm-shrinkwrap.json', 'yarn.lock']) {
  test(`nueva credencial en ${file} se rechaza sin imprimirla`, (t) => {
    const sandbox = fixture(t);
    const value = credential();
    sandbox.write(file, `DATABASE_URL=${dsn(value)}`);
    const result = sandbox.run();
    assert.equal(result.status, 1);
    assert.match(result.output, /secreto:connection-string-with-password/u);
    assert.ok(!result.output.includes(value));
  });
}

test('un marcador incrustado no exceptua una credencial ni la segunda de la linea', (t) => {
  const sandbox = fixture(t);
  const value = `prefix-fictitious-not-a-secret-${credential()}`;
  sandbox.write('app.ts', `${assignment('fictitious-not-a-secret')}, ${assignment(value)}`);
  const result = sandbox.run();
  assert.equal(result.status, 1);
  assert.match(result.output, /secreto:hardcoded-credential-assignment/u);
  assert.ok(!result.output.includes(value));
});

test('una segunda URL con credencial despues de un marcador se rechaza', (t) => {
  const sandbox = fixture(t);
  sandbox.write('app.ts', `${dsn('fictitious-not-a-secret')} ${dsn(credential())}`);
  assert.equal(sandbox.run().status, 1);
});

test('claves y tokens sinteticos siguen detectados', (t) => {
  const sandbox = fixture(t);
  const probes = [
    ['-----BEGIN ', 'PRIVATE KEY-----'].join(''),
    'AKIA' + 'A'.repeat(16), 'ghp_' + 'B'.repeat(30),
    'xoxb-' + 'C'.repeat(15), 'AIza' + 'D'.repeat(35),
    'sk_live_' + 'E'.repeat(20), 'eyJ' + 'F'.repeat(15) + '.' + 'G'.repeat(15) + '.',
  ];
  sandbox.write('app.ts', probes.join('\n'));
  const result = sandbox.run();
  assert.equal(result.status, 1);
  for (const rule of ['private-key-block', 'aws-access-key-id', 'github-token', 'slack-token', 'google-api-key', 'stripe-secret-key', 'json-web-token']) {
    assert.ok(result.output.includes(`secreto:${rule}`));
  }
  for (const probe of probes) assert.ok(!result.output.includes(probe));
});

test('solo la referencia revisada de variable pasa; mutacion, copia y nueva variable fallan', (t) => {
  const sandbox = fixture(t);
  const entry = catalog.entries.find((item) => item.category === 'environment-reference');
  assert.ok(entry);
  const source = readFileSync(path.join(projectRoot, entry.file), 'utf8');
  const line = source.split(/\r?\n/u)[entry.originalLine - 1];
  sandbox.write('tests/secrets-scan.exceptions.json', JSON.stringify({ version: 1, entries: [entry] }));
  sandbox.write(entry.file, line);
  assert.equal(sandbox.run().status, 0);
  sandbox.write(entry.file, line + ' ');
  assert.equal(sandbox.run().status, 1);
  sandbox.write(entry.file, line);
  sandbox.write('other.ts', line);
  assert.equal(sandbox.run().status, 1);
  sandbox.write('other.ts', ['clientSecret', JSON.stringify('MERDN_UNREVIEWED_SECRET')].join(': '));
  assert.equal(sandbox.run().status, 1);
});

test('una linea revisada no permite agregar otra credencial', (t) => {
  const sandbox = fixture(t);
  const entry = catalog.entries.find((item) => item.category === 'unit-sentinel');
  assert.ok(entry);
  const line = readFileSync(path.join(projectRoot, entry.file), 'utf8').split(/\r?\n/u)[entry.originalLine - 1];
  sandbox.write('tests/secrets-scan.exceptions.json', JSON.stringify({ version: 1, entries: [entry] }));
  sandbox.write(entry.file, line);
  assert.equal(sandbox.run().status, 0);
  sandbox.write(entry.file, line + assignment(credential()));
  assert.equal(sandbox.run().status, 1);
});

test('todo el catalogo corresponde a lineas existentes y permite solo su evidencia exacta', (t) => {
  const sandbox = fixture(t);
  const grouped = new Map();
  for (const entry of catalog.entries) {
    const line = readFileSync(path.join(projectRoot, entry.file), 'utf8').split(/\r?\n/u)[entry.originalLine - 1];
    assert.equal(typeof line, 'string');
    grouped.set(entry.file, [...(grouped.get(entry.file) ?? []), line]);
  }
  sandbox.write('tests/secrets-scan.exceptions.json', JSON.stringify(catalog));
  for (const [file, lines] of grouped) sandbox.write(file, lines.join('\n'));
  const result = sandbox.run();
  assert.equal(result.status, 0, result.output);
  assert.ok(result.output.includes(`ocurrencias reconocidas: ${catalog.entries.length}`));
  for (const [file, lines] of grouped) sandbox.write(file, lines.join('\n') + '\n' + assignment(credential()));
  const rejected = sandbox.run();
  assert.equal(rejected.status, 1);
  for (const file of grouped.keys()) assert.ok(rejected.output.includes(`${file}:`));
});

test('catalogo malformado, duplicado o de ruta amplia falla cerrado', (t) => {
  const sandbox = fixture(t);
  const entry = catalog.entries[0];
  for (const value of ['{broken', JSON.stringify({ version: 1, entries: [entry, entry] }), JSON.stringify({ version: 1, entries: [{ ...entry, file: 'tests/*' }] })]) {
    sandbox.write('tests/secrets-scan.exceptions.json', value);
    const result = sandbox.run();
    assert.equal(result.status, 1);
    assert.match(result.output, /catalogo-invalido-o-ilegible/u);
  }
});

test('archivo de entorno real sigue siendo artefacto prohibido', (t) => {
  const sandbox = fixture(t);
  sandbox.write('.env.local', 'EMPTY=true');
  const result = sandbox.run();
  assert.equal(result.status, 1);
  assert.match(result.output, /artefacto-prohibido:dotenv-file/u);
});
