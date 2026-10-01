/**
 * MP03 (Spec 025) — pruebas del guard anti-entorno.
 *
 * Pruebas puras y repetibles: no levantan Docker, no abren red, no acceden a
 * bases de datos y no ejecutan migraciones. Solo ejercitan el contrato fail-closed
 * de `test-environment-guard.mjs` con datos ficticios, incluida la plantilla
 * versionada `.env.test.example` leida como texto.
 *
 * Cobertura exigida por el handoff v16: (1) caso de ejecucion valido, (2)
 * plantilla que solo pasa en modo inspeccion, (3) topologia obligatoria y
 * fail-closed, (4) reglas de URL sin filtrar el valor recibido, (5)
 * correspondencia URL<->variables y admin/runtime distintos, (6) credenciales,
 * rol, marcadores y placeholders, (7) codificacion invalida sin excepcion y
 * (8) ausencia de secretos en los mensajes de error.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  EXPECTED_TEST_ENVIRONMENT,
  assertTestEnvironment,
  validateTestDatabaseUrl,
  validateTestEnvironment,
  validateTestTopology,
} from '../../scripts/testing/test-environment-guard.mjs';

type Env = Record<string, string>;
type Topology = Record<string, unknown>;

const ADMIN_SECRET = 'clave-ficticia-admin-0001';
const RUNTIME_SECRET = 'clave-ficticia-runtime-0002';

const EXACT_TOPOLOGY: Topology = {
  project: 'merdn-baseline-test',
  service: 'postgres-test',
  database: 'merdn_test',
  host: '127.0.0.1',
  port: '55432',
  containerPort: 5432,
  network: 'merdn-baseline-test-net',
  volume: 'merdn-baseline-test-pgdata',
  labels: {
    'com.merdn.project': 'merdn-baseline-test',
    'com.merdn.scope': 'test',
    'com.merdn.disposable': 'true',
  },
};

const EXECUTION_ENV: Env = {
  POSTGRES_DB: 'merdn_test',
  POSTGRES_USER: 'merdn_test_admin',
  POSTGRES_PASSWORD: ADMIN_SECRET,
  MERDN_RUNTIME_DB_USER: 'merdn_runtime',
  MERDN_RUNTIME_DB_PASSWORD: RUNTIME_SECRET,
  MERDN_RUNTIME_ROLE: 'enforce',
  TEST_DATABASE_ADMIN_URL: `postgresql://merdn_test_admin:${ADMIN_SECRET}@127.0.0.1:55432/merdn_test?schema=public`,
  TEST_DATABASE_RUNTIME_URL: `postgresql://merdn_runtime:${RUNTIME_SECRET}@127.0.0.1:55432/merdn_test?schema=public`,
};

function envWith(overrides: Env): Env {
  return { ...EXECUTION_ENV, ...overrides };
}

function topologyWith(overrides: Topology): Topology {
  return { ...EXACT_TOPOLOGY, ...overrides };
}

function readTemplateEnv(): Env {
  const path = fileURLToPath(new URL('../../.env.test.example', import.meta.url));
  const content = readFileSync(path, 'utf8');
  const env: Env = {};
  for (const line of content.split(/\r?\n/u)) {
    const match = /^\s*([A-Z_][A-Z0-9_]*)=(.*)$/u.exec(line);
    if (match) env[match[1]] = match[2].trim();
  }
  return env;
}

function errorsWithMessage(errors: string[], fragment: string): boolean {
  return errors.some((error) => error.includes(fragment));
}

function captureNoThrow(run: () => string[]): string[] {
  let captured: string[] = [];
  assert.doesNotThrow(() => {
    captured = run();
  }, 'una entrada mal formada debe producir errores, nunca lanzar');
  return captured;
}

test('1. caso de ejecucion valido devuelve cero errores y un resumen seguro', () => {
  assert.deepEqual(validateTestEnvironment(EXECUTION_ENV, { topology: EXACT_TOPOLOGY }), []);

  const summary = assertTestEnvironment(EXECUTION_ENV, { topology: EXACT_TOPOLOGY });
  assert.deepEqual(Object.keys(summary).sort(), [
    'adminUser',
    'containerPort',
    'database',
    'host',
    'labels',
    'network',
    'port',
    'project',
    'runtimeRole',
    'runtimeUser',
    'service',
    'volume',
  ]);
  assert.equal(summary.containerPort, '5432');

  const serialized = JSON.stringify(summary);
  assert.ok(!serialized.includes(ADMIN_SECRET), 'el resumen no debe incluir la clave admin');
  assert.ok(!serialized.includes(RUNTIME_SECRET), 'el resumen no debe incluir la clave runtime');
  assert.ok(!serialized.includes('postgresql://'), 'el resumen no debe incluir ninguna URL');
});

test('2. la plantilla versionada solo pasa en modo inspeccion', () => {
  const template = readTemplateEnv();
  assert.ok(Object.keys(template).length > 0, 'la plantilla debe poder leerse y parsearse');

  assert.deepEqual(validateTestEnvironment(template, { allowPlaceholders: true, topology: EXACT_TOPOLOGY }), []);

  const executionErrors = validateTestEnvironment(template, { topology: EXACT_TOPOLOGY });
  assert.ok(executionErrors.length > 0, 'en modo ejecucion la plantilla debe fallar');
  assert.ok(
    executionErrors.every((error) => error.includes('placeholder')),
    `todos los fallos de plantilla deben ser por marcador: ${executionErrors.join(' | ')}`,
  );
});

test('3. la topologia es obligatoria y falla cerrado', () => {
  assert.ok(
    errorsWithMessage(validateTestEnvironment(EXECUTION_ENV), 'topology is required'),
    'omitir la topologia debe fallar',
  );
  assert.ok(
    errorsWithMessage(validateTestEnvironment(EXECUTION_ENV, { topology: null }), 'topology is required'),
    'topology null debe fallar',
  );
  assert.ok(
    errorsWithMessage(validateTestEnvironment(EXECUTION_ENV, { topology: [] }), 'topology must be an object'),
    'un arreglo debe rechazarse',
  );

  const missingNetwork = topologyWith({ network: undefined });
  assert.ok(
    errorsWithMessage(validateTestEnvironment(EXECUTION_ENV, { topology: missingNetwork }), 'topology.network is required'),
    'un campo ausente debe fallar',
  );

  assert.ok(
    errorsWithMessage(
      validateTestEnvironment(EXECUTION_ENV, { topology: topologyWith({ project: 'merdn-baseline-test-otro' }) }),
      'topology.project must match the approved test identity',
    ),
    'un proyecto distinto debe fallar',
  );
  assert.ok(
    errorsWithMessage(
      validateTestEnvironment(EXECUTION_ENV, { topology: topologyWith({ containerPort: 5433 }) }),
      'topology.containerPort must match the approved test identity',
    ),
    'containerPort distinto de 5432 debe fallar',
  );
  assert.ok(
    errorsWithMessage(
      validateTestEnvironment(EXECUTION_ENV, { topology: topologyWith({ containerPort: '5432' }) }),
      'topology.containerPort',
    ) === false,
    'containerPort como texto 5432 debe aceptarse',
  );
  assert.ok(
    errorsWithMessage(
      validateTestEnvironment(EXECUTION_ENV, {
        topology: topologyWith({ labels: { ...EXACT_TOPOLOGY.labels, 'com.merdn.scope': 'otro' } }),
      }),
      'topology.labels.com.merdn.scope must match the approved value',
    ),
    'un label distinto debe fallar',
  );
  assert.ok(
    errorsWithMessage(
      validateTestEnvironment(EXECUTION_ENV, {
        topology: topologyWith({ labels: { ...EXACT_TOPOLOGY.labels, 'com.merdn.otro': 'x' } }),
      }),
      'topology.labels.com.merdn.otro is not an approved label',
    ),
    'un label com.merdn.* no aprobado debe fallar',
  );

  assert.deepEqual(validateTestTopology(EXACT_TOPOLOGY), []);
  assert.equal(EXPECTED_TEST_ENVIRONMENT.containerPort, '5432');
});

test('4. las reglas de URL fallan sin filtrar el valor recibido', () => {
  const cases: Array<[string, string, string]> = [
    ['protocolo', `postgres://merdn_test_admin:${ADMIN_SECRET}@127.0.0.1:55432/merdn_test?schema=public`, 'must use the postgresql: protocol'],
    ['host', `postgresql://merdn_test_admin:${ADMIN_SECRET}@localhost:55432/merdn_test?schema=public`, 'must target the approved loopback host'],
    ['puerto', `postgresql://merdn_test_admin:${ADMIN_SECRET}@127.0.0.1:5432/merdn_test?schema=public`, 'must use the approved host port'],
    ['base', `postgresql://merdn_test_admin:${ADMIN_SECRET}@127.0.0.1:55432/otra_base?schema=public`, 'must target the approved test database'],
    ['schema', `postgresql://merdn_test_admin:${ADMIN_SECRET}@127.0.0.1:55432/merdn_test?schema=otro`, 'must declare the approved schema'],
    ['parametro extra', `postgresql://merdn_test_admin:${ADMIN_SECRET}@127.0.0.1:55432/merdn_test?schema=public&sslmode=disable`, 'must declare only the schema parameter'],
    ['sin schema', `postgresql://merdn_test_admin:${ADMIN_SECRET}@127.0.0.1:55432/merdn_test?sslmode=disable`, 'must declare only the schema parameter'],
    ['fragmento', `postgresql://merdn_test_admin:${ADMIN_SECRET}@127.0.0.1:55432/merdn_test?schema=public#extra`, 'must not carry a fragment'],
    ['sin usuario', `postgresql://:${ADMIN_SECRET}@127.0.0.1:55432/merdn_test?schema=public`, 'must declare a user'],
    ['sin clave', 'postgresql://merdn_test_admin@127.0.0.1:55432/merdn_test?schema=public', 'must declare a credential'],
    ['no parseable', 'no-es-una-url', 'must be a parsable postgresql: URL'],
  ];

  for (const [nombre, url, fragmento] of cases) {
    const errors = validateTestDatabaseUrl(url, 'TEST_DATABASE_ADMIN_URL');
    assert.ok(errors.length > 0, `el caso ${nombre} debe producir al menos un error`);
    assert.ok(errorsWithMessage(errors, fragmento), `el caso ${nombre} debe reportar: ${fragmento}`);
    assert.ok(!errors.join(' | ').includes(url), `el caso ${nombre} no debe incluir la URL recibida`);
  }
});

test('5. cada URL debe corresponder con sus variables y admin/runtime deben diferir', () => {
  const wrongUser = validateTestEnvironment(
    envWith({ TEST_DATABASE_ADMIN_URL: `postgresql://merdn_runtime:${ADMIN_SECRET}@127.0.0.1:55432/merdn_test?schema=public` }),
    { topology: EXACT_TOPOLOGY },
  );
  assert.ok(errorsWithMessage(wrongUser, 'TEST_DATABASE_ADMIN_URL user must match POSTGRES_USER'));

  const wrongAdminSecret = validateTestEnvironment(
    envWith({ TEST_DATABASE_ADMIN_URL: 'postgresql://merdn_test_admin:otra-clave-admin-9999@127.0.0.1:55432/merdn_test?schema=public' }),
    { topology: EXACT_TOPOLOGY },
  );
  assert.ok(errorsWithMessage(wrongAdminSecret, 'TEST_DATABASE_ADMIN_URL credential must match POSTGRES_PASSWORD'));

  const wrongRuntimeUser = validateTestEnvironment(
    envWith({ TEST_DATABASE_RUNTIME_URL: `postgresql://merdn_test_admin:${RUNTIME_SECRET}@127.0.0.1:55432/merdn_test?schema=public` }),
    { topology: EXACT_TOPOLOGY },
  );
  assert.ok(errorsWithMessage(wrongRuntimeUser, 'TEST_DATABASE_RUNTIME_URL user must match MERDN_RUNTIME_DB_USER'));

  const wrongRuntimeSecret = validateTestEnvironment(
    envWith({ TEST_DATABASE_RUNTIME_URL: 'postgresql://merdn_runtime:otra-clave-runtime-9999@127.0.0.1:55432/merdn_test?schema=public' }),
    { topology: EXACT_TOPOLOGY },
  );
  assert.ok(errorsWithMessage(wrongRuntimeSecret, 'TEST_DATABASE_RUNTIME_URL credential must match MERDN_RUNTIME_DB_PASSWORD'));

  const sameIdentity = validateTestEnvironment(
    envWith({
      POSTGRES_USER: 'merdn_runtime',
      MERDN_RUNTIME_DB_USER: 'merdn_runtime',
      TEST_DATABASE_ADMIN_URL: `postgresql://merdn_runtime:${ADMIN_SECRET}@127.0.0.1:55432/merdn_test?schema=public`,
      TEST_DATABASE_RUNTIME_URL: `postgresql://merdn_runtime:${RUNTIME_SECRET}@127.0.0.1:55432/merdn_test?schema=public`,
    }),
    { topology: EXACT_TOPOLOGY },
  );
  assert.ok(errorsWithMessage(sameIdentity, 'test administrator and runtime identities must differ'));
});

test('6. credenciales, rol, marcadores prohibidos y placeholders fallan', () => {
  assert.ok(errorsWithMessage(validateTestEnvironment(envWith({ POSTGRES_PASSWORD: '' }), { topology: EXACT_TOPOLOGY }), 'POSTGRES_PASSWORD is required'));
  assert.ok(errorsWithMessage(validateTestEnvironment(envWith({ POSTGRES_PASSWORD: 'corta-12345' }), { topology: EXACT_TOPOLOGY }), 'POSTGRES_PASSWORD is too short'));
  assert.ok(errorsWithMessage(validateTestEnvironment(envWith({ MERDN_RUNTIME_ROLE: 'disabled' }), { topology: EXACT_TOPOLOGY }), 'MERDN_RUNTIME_ROLE must be enforce'));

  const sameSecret = validateTestEnvironment(
    envWith({
      POSTGRES_PASSWORD: 'clave-compartida-0003',
      MERDN_RUNTIME_DB_PASSWORD: 'clave-compartida-0003',
      TEST_DATABASE_ADMIN_URL: 'postgresql://merdn_test_admin:clave-compartida-0003@127.0.0.1:55432/merdn_test?schema=public',
      TEST_DATABASE_RUNTIME_URL: 'postgresql://merdn_runtime:clave-compartida-0003@127.0.0.1:55432/merdn_test?schema=public',
    }),
    { topology: EXACT_TOPOLOGY },
  );
  assert.ok(errorsWithMessage(sameSecret, 'test administrator and runtime credentials must differ'));

  const sameUrl = validateTestEnvironment(
    envWith({
      POSTGRES_PASSWORD: 'clave-compartida-0003',
      MERDN_RUNTIME_DB_PASSWORD: 'clave-compartida-0003',
      TEST_DATABASE_ADMIN_URL: 'postgresql://merdn_test_admin:clave-compartida-0003@127.0.0.1:55432/merdn_test?schema=public',
      TEST_DATABASE_RUNTIME_URL: 'postgresql://merdn_test_admin:clave-compartida-0003@127.0.0.1:55432/merdn_test?schema=public',
    }),
    { topology: EXACT_TOPOLOGY },
  );
  assert.ok(errorsWithMessage(sameUrl, 'administrator and runtime database URLs must differ'));

  const placeholderSecret = validateTestEnvironment(
    envWith({
      POSTGRES_PASSWORD: 'reemplazar-por-clave-admin',
      TEST_DATABASE_ADMIN_URL: 'postgresql://merdn_test_admin:reemplazar-por-clave-admin@127.0.0.1:55432/merdn_test?schema=public',
    }),
    { topology: EXACT_TOPOLOGY },
  );
  assert.ok(errorsWithMessage(placeholderSecret, 'POSTGRES_PASSWORD carries a template placeholder'));

  for (const overrides of [
    { project: 'merdn-demo-local' },
    { service: 'postgres-demo' },
    { database: 'merdn_demo' },
    { network: 'merdn-staging-net' },
    { volume: 'merdn_dev-pgdata' },
  ]) {
    const errors = validateTestEnvironment(EXECUTION_ENV, { topology: topologyWith(overrides) });
    assert.ok(
      errorsWithMessage(errors, 'is not an approved environment'),
      `el marcador de ${Object.keys(overrides)[0]} debe rechazarse`,
    );
  }

  const markerInUser = validateTestEnvironment(envWith({ POSTGRES_USER: 'merdn_dev_admin' }), { topology: EXACT_TOPOLOGY });
  assert.ok(errorsWithMessage(markerInUser, 'POSTGRES_USER is not an approved environment'));
});

test('7. una codificacion invalida produce errores y nunca una excepcion', () => {
  const invalidPassword = captureNoThrow(() =>
    validateTestDatabaseUrl(
      `postgresql://merdn_test_admin:clave%zz-admin@127.0.0.1:55432/merdn_test?schema=public`,
      'TEST_DATABASE_ADMIN_URL',
    ),
  );
  assert.ok(
    errorsWithMessage(invalidPassword, 'TEST_DATABASE_ADMIN_URL credential is not correctly encoded'),
    'una clave con percent invalido debe reportarse, no lanzar',
  );

  const invalidPath = captureNoThrow(() =>
    validateTestDatabaseUrl(
      `postgresql://merdn_test_admin:${ADMIN_SECRET}@127.0.0.1:55432/merdn_test%zz?schema=public`,
      'TEST_DATABASE_ADMIN_URL',
    ),
  );
  assert.ok(errorsWithMessage(invalidPath, 'TEST_DATABASE_ADMIN_URL path is not correctly encoded'));

  const invalidUser = captureNoThrow(() =>
    validateTestDatabaseUrl(
      `postgresql://merdn%a0admin:${ADMIN_SECRET}@127.0.0.1:55432/merdn_test?schema=public`,
      'TEST_DATABASE_ADMIN_URL',
    ),
  );
  assert.ok(errorsWithMessage(invalidUser, 'TEST_DATABASE_ADMIN_URL user is not correctly encoded'));

  const truncatedUtf8 = captureNoThrow(() =>
    validateTestDatabaseUrl(
      `postgresql://merdn_test_admin:clave%E0%A4@127.0.0.1:55432/merdn_test?schema=public`,
      'TEST_DATABASE_ADMIN_URL',
    ),
  );
  assert.ok(truncatedUtf8.length > 0, 'una secuencia UTF-8 truncada debe producir errores');
});

test('8. los mensajes de error no contienen URLs, usuarios ni claves', () => {
  const leakyAdminUrl = `postgresql://merdn_dev_admin:secreto-ficticio-admin-7777@127.0.0.1:55432/merdn_test?schema=public`;
  const leakyRuntimeUrl = `postgresql://merdn_demo_runtime:secreto-ficticio-runtime-8888@127.0.0.1:55432/merdn_test?schema=public`;
  const brokenEnv: Env = {
    POSTGRES_DB: 'merdn_test',
    POSTGRES_USER: 'merdn_dev_admin',
    POSTGRES_PASSWORD: 'secreto-ficticio-admin-7777',
    MERDN_RUNTIME_DB_USER: 'merdn_demo_runtime',
    MERDN_RUNTIME_DB_PASSWORD: 'secreto-ficticio-runtime-8888',
    MERDN_RUNTIME_ROLE: 'disabled',
    TEST_DATABASE_ADMIN_URL: leakyAdminUrl,
    TEST_DATABASE_RUNTIME_URL: leakyRuntimeUrl,
  };
  const brokenTopology = topologyWith({ project: 'merdn-demo-fuga', volume: 'merdn_dev-fuga' });

  const message = (() => {
    try {
      assertTestEnvironment(brokenEnv, { topology: brokenTopology });
    } catch (error) {
      return (error as Error).message;
    }
    throw new Error('assertTestEnvironment debio fallar con un entorno inseguro');
  })();

  assert.ok(message.includes('Test environment guard failed'), 'el mensaje debe identificar el guard');
  assert.ok(message.includes('MERDN_RUNTIME_ROLE'), 'el mensaje debe nombrar el campo incumplido');
  for (const secreto of [
    'secreto-ficticio-admin-7777',
    'secreto-ficticio-runtime-8888',
    leakyAdminUrl,
    leakyRuntimeUrl,
    'merdn_dev_admin',
    'merdn_demo_runtime',
    'merdn-demo-fuga',
    'merdn_dev-fuga',
  ]) {
    assert.ok(!message.includes(secreto), `el mensaje no debe filtrar: ${secreto}`);
  }
});
