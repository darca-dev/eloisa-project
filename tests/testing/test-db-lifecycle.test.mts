/**
 * MP10 (Spec 025) — pruebas permanentes y puras de los contratos de lifecycle.
 *
 * Cubre los modulos MP02 (`test-environment-guard.mjs`), MP07
 * (`test-db-provision.mjs`), MP08 (`test-db-preflight.mjs`) y MP09
 * (`test-db-cleanup.mjs`) unicamente a traves de exports puros, con fixtures
 * sinteticos y secretos ficticios. MP15-C5 y MP15-C6 anaden el contrato
 * compartido de topologia: las topologias reales de provision, de cleanup y de
 * preflight deben pasar el guard, labels incluidos.
 *
 * Estas pruebas NO levantan Docker, NO abren red, NO tocan PostgreSQL, NO aplican
 * migraciones, NO ejecutan un cleanup real, NO escriben archivos temporales, NO
 * mutan `process.env`, NO esperan y NO disparan senales. No invocan
 * `runCommand`, `provisionIsolatedTestDatabase` ni
 * `runRuntimeRlsPreflight`, y solo llaman `cleanupIsolatedTestDatabase` con un
 * `.env` inexistente, caso que falla antes de abrir cualquier proceso.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  EXPECTED_TEST_ENVIRONMENT,
  assertTestEnvironment,
  validateTestDatabaseUrl,
  validateTestEnvironment,
  validateTestTopology,
} from '../../scripts/testing/test-environment-guard.mjs';

import {
  APPROVED_RESOURCE_NAMES,
  EXPECTED_POLICY_COUNT,
  PROJECT_NAME,
  PROTECTED_TABLES,
  ProvisionError,
  buildApprovedTestTopology,
  composeArgs,
  describeResource,
  parseEnvFile,
  quoteLiteral,
  scrubSecrets,
  selectOwnedResources,
  validateResourceInventory,
} from '../../scripts/testing/test-db-provision.mjs';

import {
  RLS_POLICY_PAIRS,
  buildApprovedTopology as buildPreflightTopology,
  buildBehaviorSql,
  buildCatalogSql,
  buildPreflightEvidence,
  evaluateBehavior,
  evaluateCatalog,
  parseBehaviorOutput,
  parseCatalogOutput,
  validatePolicyBaseline,
} from '../../scripts/testing/test-db-preflight.mjs';

import {
  buildApprovedTopology,
  buildCleanupEvidence,
  buildComposeDownArgs,
  buildComposePsArgs,
  buildContainerListArgs,
  buildNetworkListArgs,
  buildResidualReport,
  buildVolumeListArgs,
  createCleanupAdapter,
  parseNameLines,
  resolveErrorStage,
  runCleanupStep,
} from '../../scripts/testing/test-db-cleanup.mjs';

type Env = Record<string, string>;

// Secretos ficticios. No corresponden a ningun entorno real.
const ADMIN_SECRET = 'clave-ficticia-admin-0001';
const RUNTIME_SECRET = 'clave-ficticia-runtime-0002';
const ADMIN_URL = `postgresql://${EXPECTED_TEST_ENVIRONMENT.adminUser}:${ADMIN_SECRET}@127.0.0.1:55432/${EXPECTED_TEST_ENVIRONMENT.database}?schema=public`;
const RUNTIME_URL = `postgresql://${EXPECTED_TEST_ENVIRONMENT.runtimeUser}:${RUNTIME_SECRET}@127.0.0.1:55432/${EXPECTED_TEST_ENVIRONMENT.database}?schema=public`;

const EXECUTION_ENV: Env = {
  POSTGRES_DB: EXPECTED_TEST_ENVIRONMENT.database,
  POSTGRES_USER: EXPECTED_TEST_ENVIRONMENT.adminUser,
  POSTGRES_PASSWORD: ADMIN_SECRET,
  MERDN_RUNTIME_DB_USER: EXPECTED_TEST_ENVIRONMENT.runtimeUser,
  MERDN_RUNTIME_DB_PASSWORD: RUNTIME_SECRET,
  MERDN_RUNTIME_ROLE: 'enforce',
  TEST_DATABASE_ADMIN_URL: ADMIN_URL,
  TEST_DATABASE_RUNTIME_URL: RUNTIME_URL,
};

const TOPOLOGY: Record<string, unknown> = {
  project: PROJECT_NAME,
  service: EXPECTED_TEST_ENVIRONMENT.service,
  database: EXPECTED_TEST_ENVIRONMENT.database,
  host: EXPECTED_TEST_ENVIRONMENT.host,
  port: EXPECTED_TEST_ENVIRONMENT.port,
  containerPort: '5432',
  network: EXPECTED_TEST_ENVIRONMENT.network,
  volume: EXPECTED_TEST_ENVIRONMENT.volume,
  labels: {
    'com.merdn.project': PROJECT_NAME,
    'com.merdn.scope': 'test',
    'com.merdn.disposable': 'true',
  },
};

const ENV_FILE = 'C:/ruta/ficticia/local.test.env';

// ---------------------------------------------------------------------------
// MP02 — guard anti-entorno
// ---------------------------------------------------------------------------

test('MP02 1. identidad valida: el guard acepta el entorno de pruebas y no filtra secretos', () => {
  assert.deepEqual(validateTestEnvironment(EXECUTION_ENV, { topology: TOPOLOGY }), []);

  const summary = assertTestEnvironment(EXECUTION_ENV, { topology: TOPOLOGY });
  assert.equal(summary.project, PROJECT_NAME);
  assert.equal(summary.database, EXPECTED_TEST_ENVIRONMENT.database);

  const serialized = JSON.stringify(summary);
  assert.ok(!serialized.includes(ADMIN_SECRET), 'el resumen no incluye la clave admin');
  assert.ok(!serialized.includes(RUNTIME_SECRET), 'el resumen no incluye la clave runtime');
  assert.ok(!serialized.includes('postgresql://'), 'el resumen no incluye ninguna URL');
});

test('MP02 2. el guard es fail-closed: topologia y entorno alterados se rechazan sin lanzar', () => {
  const wrongProject = { ...TOPOLOGY, project: 'otro-proyecto' };
  assert.ok(
    validateTestEnvironment(EXECUTION_ENV, { topology: wrongProject }).length > 0,
    'una topologia de otro proyecto debe rechazarse',
  );

  const missingLabel = { ...TOPOLOGY, labels: { 'com.merdn.project': PROJECT_NAME } };
  assert.ok(
    validateTestEnvironment(EXECUTION_ENV, { topology: missingLabel }).length > 0,
    'una topologia sin los tres labels debe rechazarse',
  );

  const sharedUrl = validateTestEnvironment(
    { ...EXECUTION_ENV, TEST_DATABASE_RUNTIME_URL: ADMIN_URL },
    { topology: TOPOLOGY },
  );
  assert.ok(sharedUrl.length > 0, 'admin y runtime no pueden ser la misma URL');

  assert.throws(
    () => assertTestEnvironment({ ...EXECUTION_ENV, POSTGRES_PASSWORD: 'corta' }, { topology: TOPOLOGY }),
    /guard|entorno|password|credencial/iu,
  );
});

test('MP02 3. una URL invalida se rechaza y el mensaje no reproduce el valor recibido', () => {
  const secretish = 'postgresql://merdn_test_admin:clave-ficticia-9999@10.0.0.1:5432/otra_base';
  const errors = validateTestDatabaseUrl(secretish, 'TEST_DATABASE_ADMIN_URL', { topology: TOPOLOGY });
  assert.ok(errors.length > 0, 'un host no aprobado debe rechazarse');
  assert.ok(
    !errors.some((error) => error.includes('clave-ficticia-9999')),
    'el mensaje de error no debe incluir la credencial recibida',
  );
  assert.deepEqual(validateTestTopology(undefined).length > 0, true);
});

// ---------------------------------------------------------------------------
// MP07 — provisioner
// ---------------------------------------------------------------------------

test('MP07 1. env-file ausente se rechaza antes de construir cualquier argv', async () => {
  await assert.rejects(
    () => import('../../scripts/testing/test-db-provision.mjs').then((m) => m.loadEnvFile('ruta/inexistente/local.test.env')),
    (error: unknown) => {
      assert.ok(error instanceof ProvisionError, 'debe fallar con ProvisionError');
      assert.equal((error as ProvisionError).step, 'env-file');
      return true;
    },
  );

  // El argv del cleanup se puede construir sin leer nada, pero `down` solo se
  // emite con `--project-name` explicito: nunca hay un `.env` implicito.
  const args = buildComposeDownArgs(ENV_FILE);
  assert.ok(!args.includes('--env-file') || args.includes(ENV_FILE));
  assert.ok(args.includes(ENV_FILE), 'el env-file es explicito en el argv');
});

test('MP07 2. parseEnvFile es puro: no toca process.env y no filtra el contenido', () => {
  const parsed = parseEnvFile([
    '# comentario',
    `POSTGRES_PASSWORD=${ADMIN_SECRET}`,
    'VACIA=',
    `TEST_DATABASE_ADMIN_URL=${ADMIN_URL}`,
  ].join('\n'));
  assert.equal(parsed.POSTGRES_PASSWORD, ADMIN_SECRET);
  assert.equal(parsed.VACIA, '');
  assert.equal(process.env.POSTGRES_PASSWORD, undefined, 'la prueba no muta process.env');
});

test('MP07 3. composeArgs es fijo: proyecto explicito y ningun objetivo fuera del alcance', () => {
  const args = composeArgs(ENV_FILE, 'up', '-d');
  assert.deepEqual(args.slice(0, 3), ['compose', '--project-name', PROJECT_NAME]);
  assert.ok(args.includes(ENV_FILE));
  assert.deepEqual(args.slice(-2), ['up', '-d']);
  for (const prohibido of ['prune', 'system', 'rm', '-V', '--volumes']) {
    if (prohibido === '--volumes') continue;
    assert.ok(!args.includes(prohibido), `composeArgs no debe emitir ${prohibido}`);
  }
});

test('MP07 4. inventario ambiguo: un recurso sin los tres labels o con driver distinto se bloquea', () => {
  const good = describeResource('volume', APPROVED_RESOURCE_NAMES.volume);
  assert.deepEqual(validateResourceInventory([good]).problems, []);
  assert.deepEqual(validateResourceInventory([good]).counts, { container: 0, network: 0, volume: 1 });

  const sinLabel = describeResource('network', APPROVED_RESOURCE_NAMES.network, {
    labels: { 'com.merdn.disposable': undefined },
  });
  const problemasSinLabel = validateResourceInventory([sinLabel]).problems;
  assert.ok(
    problemasSinLabel.some((problem) => problem.includes('sin label')),
    `un recurso sin label debe bloquear, obtuve: ${JSON.stringify(problemasSinLabel)}`,
  );

  const driverDistinto = describeResource('network', APPROVED_RESOURCE_NAMES.network, { driver: 'nfs' });
  const problemasDriver = validateResourceInventory([driverDistinto]).problems;
  assert.ok(
    problemasDriver.some((problem) => problem.includes('driver inesperado')),
    'un driver distinto al exigido debe bloquear',
  );

  const nombreNoAprobado = describeResource('volume', 'merdn-baseline-test-pgdata-otro');
  const problemasNombre = validateResourceInventory([nombreNoAprobado]).problems;
  assert.ok(
    problemasNombre.some((problem) => problem.includes('nombre no aprobado')),
    'un nombre fuera de la familia aprobada debe bloquear',
  );
});

test('MP07 5. scrubSecrets y quoteLiteral: la credencial nunca sobrevive y el literal se escapa', () => {
  const texto = `fallo al conectar con ${ADMIN_URL} usando ${ADMIN_SECRET}`;
  const limpio = scrubSecrets(texto, [ADMIN_SECRET]);
  assert.ok(!limpio.includes(ADMIN_SECRET), 'la clave explicita se reemplaza');
  assert.ok(!limpio.includes('postgresql://'), 'cualquier URL de conexion se oculta');
  assert.equal(scrubSecrets('texto sin secreto', []), 'texto sin secreto');
  assert.equal(quoteLiteral("O'Brien"), "'O''Brien'");
  assert.ok(quoteLiteral('; DROP TABLE public.person; --').includes('DROP TABLE'));
});

// ---------------------------------------------------------------------------
// MP08 — preflight de baseline
// ---------------------------------------------------------------------------

const CATALOG_SQL = buildCatalogSql();
const BEHAVIOR_SQL = buildBehaviorSql();

/** Numero de flags de rol que el propio SQL declara, para no duplicar la lista. */
const ROLE_FLAG_COLUMNS: number = (() => {
  const line = CATALOG_SQL.split(/\r?\n/u).find((candidate) => candidate.includes("'role|'")) ?? '';
  return Math.max(0, (line.match(/coalesce\(r\./gu) ?? []).length - 1);
})();

function catalogLine(kind: string, name: string, canLogin: boolean, flags: boolean[]): string {
  return `role|${name}|${canLogin ? 'true' : 'false'}|${flags.map((flag) => (flag ? 'true' : 'false')).join('|')}`;
}

function validCatalogStdout(): string {
  const lines: string[] = [];
  lines.push(
    `server|${EXPECTED_TEST_ENVIRONMENT.database}|${EXPECTED_TEST_ENVIRONMENT.adminUser}|170000`,
  );
  lines.push('schema_create|false');
  lines.push('runtime_owned_tables|0');
  lines.push(`owner_protected_tables|${PROTECTED_TABLES.length}`);
  lines.push(catalogLine('role', EXPECTED_TEST_ENVIRONMENT.runtimeUser, true, Array(ROLE_FLAG_COLUMNS).fill(false)));
  lines.push(catalogLine('role', 'merdn_test_migrator', false, Array(ROLE_FLAG_COLUMNS).fill(false)));
  for (const table of PROTECTED_TABLES) {
    lines.push(`table|${table}|true|true|merdn_test_migrator`);
  }
  for (const pair of RLS_POLICY_PAIRS) {
    lines.push(`policy|${pair.policy}|${pair.table}`);
  }
  lines.push('fictional_tenant|1');
  return lines.join('\n');
}

const VALID_BEHAVIOR: Record<string, string> = {
  no_context_person: '0',
  no_context_tenant: '0',
  tenant_a_person: '1',
  tenant_a_visible_total: '1',
  tenant_a_other_tenant: '0',
  tenant_a_tenant_rows: '1',
  cross_insert: 'denied',
  cross_update: '0',
  migrator_no_context: '0',
};

test('MP08 1. la baseline declarada son 27 policies sobre 26 tablas protegidas', () => {
  const baseline = validatePolicyBaseline();
  assert.deepEqual(baseline.problems, [], 'la baseline declarada no debe tener problemas');
  assert.equal(baseline.policyCount, EXPECTED_POLICY_COUNT);
  assert.equal(EXPECTED_POLICY_COUNT, 27);
  assert.equal(baseline.tableCount, 26);
  assert.equal(PROTECTED_TABLES.length, 26);
  assert.equal(new Set(RLS_POLICY_PAIRS.map((pair) => pair.policy)).size, 27);
});

test('MP08 2. el catalogo no consulta el puerto interno y el SQL es de solo lectura', () => {
  assert.ok(!CATALOG_SQL.includes('inet_server_port'), 'el puerto host nunca se consulta por SQL');
  assert.ok(
    !/^\s*(insert|update|delete|drop|alter|create|truncate)\b/imu.test(CATALOG_SQL),
    'el catalogo no abre ninguna sentencia que modifique datos',
  );
  assert.ok(CATALOG_SQL.includes('pg_policies'), 'el catalogo consulta el catalogo de policies');
});

test('MP08 3. un catalogo valido se evalua sin problemas y el conteo coincide', () => {
  const parsed = parseCatalogOutput(validCatalogStdout());
  const evaluated = evaluateCatalog(parsed);
  assert.deepEqual(evaluated.problems, [], `catalogo valido rechazado: ${evaluated.problems.join(' | ')}`);
  assert.deepEqual(evaluated.counts, { tables: 26, policies: 27, roles: 2, migrations: evaluated.counts.migrations });
  assert.equal(evaluated.counts.tables, 26);
  assert.equal(evaluated.counts.policies, 27);
});

test('MP08 4. el evaluador rechaza una policy alterada', () => {
  const sinUltima = RLS_POLICY_PAIRS.slice(0, -1);
  const lineas = validCatalogStdout()
    .split(/\r?\n/u)
    .filter((line) => !line.startsWith('policy|'));
  for (const pair of sinUltima) lineas.push(`policy|${pair.policy}|${pair.table}`);
  const problemas = evaluateCatalog(parseCatalogOutput(lineas.join('\n'))).problems;
  assert.ok(
    problemas.some((problema) => problema.includes('policies')),
    `una policy ausente debe rechazarse, obtuve: ${problemas.join(' | ')}`,
  );
});

test('MP08 5. el evaluador rechaza un flag de rol alterado', () => {
  const flags = Array(ROLE_FLAG_COLUMNS).fill(false);
  flags[0] = true;
  const lineas = validCatalogStdout()
    .split(/\r?\n/u)
    .filter((line) => !line.startsWith('role|'))
    .concat([
      catalogLine('role', EXPECTED_TEST_ENVIRONMENT.runtimeUser, true, Array(ROLE_FLAG_COLUMNS).fill(false)),
      catalogLine('role', 'merdn_test_migrator', false, flags),
    ]);
  const problemas = evaluateCatalog(parseCatalogOutput(lineas.join('\n'))).problems;
  assert.ok(
    problemas.some((problema) => problema.includes('atributos inseguros')),
    `un flag inseguro debe rechazarse, obtuve: ${problemas.join(' | ')}`,
  );
});

test('MP08 6. el SQL conductual es una sola transaccion con tres personas distintas', () => {
  const begins = BEHAVIOR_SQL.match(/^BEGIN;$/gmu) ?? [];
  const rollbacks = BEHAVIOR_SQL.match(/^ROLLBACK;$/gmu) ?? [];
  assert.equal(begins.length, 1, 'debe haber exactamente un BEGIN');
  assert.equal(rollbacks.length, 1, 'debe haber exactamente un ROLLBACK');
  assert.ok(
    BEHAVIOR_SQL.indexOf('BEGIN;') < BEHAVIOR_SQL.indexOf('ROLLBACK;'),
    'el ROLLBACK debe cerrar la transaccion abierta',
  );

  // Cada fila de persona se declara como ('<personId>'::uuid, '<tenantId>'::uuid, 'OTRO').
  // Las tres personas del preflight viven en dos sentencias distintas: dos en el
  // INSERT inicial y la tercera en la sonda de INSERT cruzado.
  const filas = [...BEHAVIOR_SQL.matchAll(/\('([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})'::uuid, '([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})'::uuid, 'OTRO'/giu)];
  assert.equal(filas.length, 3, 'deben insertarse tres personas');
  const idsPersona = filas.map((fila) => fila[1]?.toLowerCase() ?? '');
  const idsTenant = filas.map((fila) => fila[2]?.toLowerCase() ?? '');
  assert.equal(new Set(idsPersona).size, 3, 'los tres identificadores de persona deben ser distintos');
  assert.equal(new Set(idsTenant).size, 2, 'las personas se reparten entre dos tenants');
  assert.ok(
    idsPersona.every((id) => !idsTenant.includes(id)),
    'ningun identificador de persona puede ser un identificador de tenant',
  );
});

test('MP08 7. una conducta valida se evalua sin problemas y expone sus desenlaces', () => {
  const stdout = Object.entries(VALID_BEHAVIOR)
    .map(([probe, value]) => `probe|${probe}|${value}`)
    .join('\n');
  const evaluated = evaluateBehavior(parseBehaviorOutput(stdout));
  assert.deepEqual(evaluated.problems, [], `conducta valida rechazada: ${evaluated.problems.join(' | ')}`);
  assert.deepEqual(evaluated.outcomes, {
    noContextDenied: true,
    tenantAIsolated: true,
    crossTenantInsertDenied: true,
    crossTenantUpdateNoRows: true,
    migratorForceEnforced: true,
  });
});

test('MP08 8. el evaluador rechaza una conducta alterada', () => {
  const alterada = { ...VALID_BEHAVIOR, cross_insert: 'allowed', tenant_a_other_tenant: '1' };
  const stdout = Object.entries(alterada)
    .map(([probe, value]) => `probe|${probe}|${value}`)
    .join('\n');
  const evaluated = evaluateBehavior(parseBehaviorOutput(stdout));
  assert.ok(evaluated.problems.length > 0, 'una conducta alterada debe rechazarse');
  assert.equal(evaluated.outcomes.crossTenantInsertDenied, false);
  assert.equal(evaluated.outcomes.tenantAIsolated, false);
});

test('MP08 9. la evidencia de preflight es minima, congelada y sin secretos', () => {
  const evidencia = buildPreflightEvidence({
    runId: 'corrida-ficticia-0001',
    catalog: { problems: [], counts: { tables: 26, policies: 27, roles: 2, migrations: 9 } },
    behavior: { problems: [], outcomes: { noContextDenied: true } },
    durationMs: 12,
    tenantBefore: 1,
    tenantAfter: 1,
  });
  assert.ok(Object.isFrozen(evidencia), 'la evidencia debe quedar congelada');
  const serialized = JSON.stringify(evidencia);
  assert.ok(!serialized.includes(ADMIN_SECRET));
  assert.ok(!serialized.includes('postgresql://'));
  assert.ok(!/[0-9a-f]{8}-[0-9a-f]{4}-/u.test(serialized), 'la evidencia no debe incluir UUIDs');
});

// ---------------------------------------------------------------------------
// MP09 — cleanup
// ---------------------------------------------------------------------------

test('MP09 1. el argv de limpieza es exactamente down --volumes --remove-orphans', () => {
  const args = buildComposeDownArgs(ENV_FILE);
  assert.deepEqual(args.slice(-3), ['down', '--volumes', '--remove-orphans']);
  assert.deepEqual(args.slice(0, 3), ['compose', '--project-name', PROJECT_NAME]);
  assert.ok(args.includes('-f'), 'el compose de pruebas es explicito');
  assert.ok(args.includes(ENV_FILE), 'el env-file es explicito');
  for (const prohibido of ['prune', 'system', 'rm']) {
    assert.ok(!args.includes(prohibido), `el cleanup no debe emitir ${prohibido}`);
  }
  assert.deepEqual(args, buildComposeDownArgs(ENV_FILE), 'el argv es determinista');
});

test('MP09 2. el postcheck es project-scoped y anclado por nombre exacto', () => {
  assert.deepEqual(buildNetworkListArgs(), [
    'network', 'ls', '--filter', `name=^${APPROVED_RESOURCE_NAMES.network}$`, '--format', '{{.Name}}',
  ]);
  assert.deepEqual(buildVolumeListArgs(), [
    'volume', 'ls', '--filter', `name=^${APPROVED_RESOURCE_NAMES.volume}$`, '--format', '{{.Name}}',
  ]);
  assert.deepEqual(buildContainerListArgs(), [
    'ps', '-a', '--filter', `label=com.merdn.project=${PROJECT_NAME}`, '--format', '{{.Names}}',
  ]);
  assert.ok(buildComposePsArgs(ENV_FILE).includes(PROJECT_NAME));
  assert.ok(buildComposePsArgs(ENV_FILE).includes(ENV_FILE));
});

test('MP09 3. el postcheck detecta residuales y no adopta un recurso ajeno', () => {
  assert.deepEqual(parseNameLines('\r\n  \r\n'), []);
  assert.deepEqual(parseNameLines('a\r\n  b  \r\n'), ['a', 'b']);

  const limpio = buildResidualReport({ container: [], network: [], volume: [] });
  assert.equal(limpio.clean, true);
  assert.deepEqual(limpio.counts, { container: 0, network: 0, volume: 0 });

  const sucio = buildResidualReport({
    container: [`${PROJECT_NAME}-postgres-test-1`],
    network: [APPROVED_RESOURCE_NAMES.network],
    volume: [],
  });
  assert.equal(sucio.clean, false);
  assert.deepEqual(sucio.counts, { container: 1, network: 1, volume: 0 });
  assert.ok(sucio.residual.length > 0, 'los residuales se nombran en el reporte');

  // Un recurso de otro proyecto ni se lista ni se toca: su label no coincide y
  // su nombre no pertenece a la familia aprobada.
  const ajeno = {
    kind: 'volume',
    name: 'volumen-de-otro-proyecto',
    labels: { 'com.merdn.project': 'otro-proyecto', 'com.merdn.scope': 'test' },
    driver: 'local',
  };
  assert.deepEqual(selectOwnedResources([ajeno]), [], 'un recurso ajeno no se adopta');
  assert.deepEqual(validateResourceInventory([ajeno]).problems, [], 'y no genera problemas por no ser nuestro');
  assert.deepEqual(
    selectOwnedResources([describeResource('volume', APPROVED_RESOURCE_NAMES.volume)]).length,
    1,
    'un recurso propio si se adopta',
  );
});

test('MP09 4. el adaptador intenta el cleanup una sola vez y reduce el motivo a la etapa', async () => {
  let llamadas = 0;
  const exito = createCleanupAdapter(async () => {
    llamadas += 1;
    return { cleaned: true };
  });
  await exito.run();
  await exito.run();
  assert.equal(llamadas, 1, 'el adaptador ejecuta el cleanup una sola vez');
  assert.equal(exito.isAttempted(), true);
  assert.deepEqual(exito.getResult(), { cleaned: true, reason: null });

  let llamadasFallo = 0;
  const fallo = createCleanupAdapter(async () => {
    llamadasFallo += 1;
    throw new Error(`conexion fallida con ${ADMIN_URL}`);
  });
  const primer = await fallo.run();
  const segundo = await fallo.run();
  assert.equal(llamadasFallo, 1, 'tras un fallo no se reintenta');
  assert.equal(primer.cleaned, false);
  assert.equal(segundo, primer, 'un segundo intento devuelve el mismo resultado');
  assert.equal(primer.reason, 'unknown');
  assert.ok(!JSON.stringify(primer).includes('clave-ficticia-admin-0001'), 'el motivo no filtra la credencial');
  assert.ok(!JSON.stringify(primer).includes('postgresql://'), 'el motivo no filtra la URL');
});

test('MP09 5. las etapas env-file y guard fallan cerradas y sanitizadas', async () => {
  await assert.rejects(
    () => runCleanupStep('env-file', () => {
      throw new Error(`no se pudo leer el entorno ${ADMIN_URL}`);
    }),
    (error: unknown) => {
      assert.equal((error as { name: string }).name, 'CleanupError');
      assert.equal((error as { stage: string }).stage, 'env-file');
      assert.ok(!(error as Error).message.includes('clave-ficticia-admin-0001'));
      assert.ok(!(error as Error).message.includes('postgresql://'));
      return true;
    },
  );

  await assert.rejects(
    () => runCleanupStep('guard', () => {
      throw new Error('Test environment guard failed: MERDN_RUNTIME_ENV no es de pruebas');
    }),
    (error: unknown) => {
      assert.equal((error as { name: string }).name, 'CleanupError');
      assert.equal((error as { stage: string }).stage, 'guard');
      return true;
    },
  );
});

test('MP09 6. las etapas identity, down y postcheck conservan su prioridad', () => {
  for (const etapa of ['identity', 'down', 'postcheck']) {
    assert.equal(resolveErrorStage(new ProvisionError(etapa, 'detalle'), 'env-file'), etapa);
    assert.equal(resolveErrorStage({ stage: etapa, step: 'otra' }, 'guard'), etapa);
  }
  assert.equal(resolveErrorStage(new Error('comun'), 'env-file'), 'env-file');
  assert.equal(resolveErrorStage(new Error('comun')), 'unknown');
  assert.equal(resolveErrorStage({ stage: '' }, 'guard'), 'guard');
});

test('MP09 7. un env-file ausente nunca alcanza un proceso y reporta env-file', async () => {
  const { cleanupIsolatedTestDatabase } = await import('../../scripts/testing/test-db-cleanup.mjs');
  await assert.rejects(
    () => cleanupIsolatedTestDatabase({ envFilePath: 'ruta/inexistente/local.test.env' }),
    (error: unknown) => {
      assert.equal((error as { name: string }).name, 'CleanupError');
      assert.equal((error as { stage: string }).stage, 'env-file');
      return true;
    },
  );
});

test('MP09 8. la evidencia de cleanup es minima, congelada y sin secretos', () => {
  const evidencia = buildCleanupEvidence({
    cleaned: true,
    residual: buildResidualReport({ container: [], network: [], volume: [] }),
    durationMs: 7,
  });
  assert.ok(Object.isFrozen(evidencia), 'la evidencia debe quedar congelada');
  assert.deepEqual(Object.keys(evidencia).sort(), [
    'clean', 'cleaned', 'durationMs', 'project', 'residualCounts', 'service',
  ]);
  const serialized = JSON.stringify(evidencia);
  assert.ok(!serialized.includes(ADMIN_SECRET));
  assert.ok(!serialized.includes('postgresql://'));
  assert.ok(!/[0-9a-f]{8}-[0-9a-f]{4}-/u.test(serialized), 'la evidencia no debe incluir UUIDs');
  assert.ok(!/tenant/i.test(serialized), 'la evidencia no debe incluir tenant');
});

// ---------------------------------------------------------------------------
// MP15-C5 / MP15-C6 — contrato compartido de topologia del guard
// ---------------------------------------------------------------------------

test('MP15-C5 1. las topologias reales de provision, cleanup y preflight superan el guard con el entorno ficticio', () => {
  const topologias = [
    ['provision', buildApprovedTestTopology()],
    ['cleanup', buildApprovedTopology()],
    ['preflight', buildPreflightTopology()],
  ] as const;

  for (const [origen, topologia] of topologias) {
    assert.ok(Object.isFrozen(topologia), `${origen}: la topologia debe quedar congelada`);
    assert.deepEqual(Object.keys(topologia).sort(), [
      'containerPort',
      'database',
      'host',
      'labels',
      'network',
      'port',
      'project',
      'service',
      'volume',
    ], `${origen}: la topologia debe tener los ocho campos y los labels`);

    // Los tres labels exigidos por el guard, sin sustituciones ni etiquetas extra.
    assert.deepEqual(
      topologia.labels,
      EXPECTED_TEST_ENVIRONMENT.labels,
      `${origen}: los labels deben ser exactamente los aprobados`,
    );
    assert.equal(Object.keys(topologia.labels).length, 3, `${origen}: deben ser tres labels`);

    // Contrato central del paquete: el guard ACEPTA cada topologia real.
    assert.deepEqual(
      validateTestEnvironment(EXECUTION_ENV, { topology: topologia }),
      [],
      `${origen}: el guard debe aceptar el entorno ficticio con la topologia real`,
    );
  }

  // Una sola forma de topologia: si divergieran, una volveria a fallar el guard.
  assert.deepEqual(topologias[0][1], topologias[1][1], 'provision y cleanup deben usar la misma topologia');
  assert.deepEqual(topologias[0][1], topologias[2][1], 'provision y preflight deben usar la misma topologia');
});

test('MP15-C5 2. el guard sigue fail-closed: una topologia sin labels se rechaza', () => {
  const sinLabels: Record<string, unknown> = { ...buildApprovedTestTopology() };
  delete sinLabels.labels;

  const errores = validateTestEnvironment(EXECUTION_ENV, { topology: sinLabels });
  assert.ok(errores.length > 0, 'una topologia sin labels debe rechazarse');
  assert.ok(
    errores.some((error) => error.includes('topology.labels')),
    `el incumplimiento debe nombrar los labels, obtuve: ${errores.join(' | ')}`,
  );

  const etiquetaDistinta: Record<string, unknown> = {
    ...buildApprovedTestTopology(),
    labels: { ...EXPECTED_TEST_ENVIRONMENT.labels, 'com.merdn.scope': 'produccion' },
  };
  assert.ok(
    validateTestEnvironment(EXECUTION_ENV, { topology: etiquetaDistinta }).length > 0,
    'un label distinto del aprobado debe rechazarse',
  );
});
