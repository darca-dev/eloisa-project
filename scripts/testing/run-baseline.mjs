/**
 * Runner fail-closed de la baseline de pruebas aisladas (Spec 025, MP13 / MP13-C1).
 *
 * MP13-C3 cierra el fallo de `cleanup` y reduce el entorno infantil al minimo: una
 * limpieza fallida hace fallar el resultado global y el hijo ya no hereda nada
 * fuera de las variables de sistema imprescindibles y las tres derivadas del
 * env-file. Importar el modulo no abre procesos, no lee el entorno, no persiste
 * estado y no registra senales: solo lo hace la entrada CLI cuando el archivo se
 * invoca directamente.
 *
 * Reglas que no se negocian:
 * - `--env-file` explicito, `--stage` exacto y `--run-id` valido.
 * - Matriz cerrada: ningun glob, ninguna suite general, ninguna ruta de usuario.
 * - argv fijo, `shell: false`, un intento por stage, timeout finito.
 * - fail-closed: solo un exito explicito pasa. skip, todo o disabled con conteo
 *   positivo, un marcador inequivoco, timeout, formato ausente o matriz incompleta
 *   son fallo. Un `0 skipped` / `0 todo` / `0 disabled` NO produce falso fallo.
 * - La evidencia es minima y jamas contiene URLs, claves, UUIDs de tenant, filas
 *   ni SQL.
 */

import { spawn as nodeSpawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { stripVTControlCharacters } from 'node:util';

import { EXPECTED_TEST_ENVIRONMENT, validateTestEnvironment } from './test-environment-guard.mjs';
import { loadEnvFile, scrubSecrets } from './test-db-provision.mjs';
import { buildApprovedTopology, parseTrustedTenantContext } from './test-db-preflight.mjs';
import { createCleanupAdapter, runCleanupStep } from './test-db-cleanup.mjs';

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const NODE = process.execPath;
const TSC = path.join(REPO_ROOT, 'node_modules', 'typescript', 'bin', 'tsc');
const VITEST = path.join(REPO_ROOT, 'node_modules', 'vitest', 'vitest.mjs');

/** Error del runner. Siempre con etapa, para que la evidencia sea inequivoca. */
export class RunnerError extends Error {
  constructor(stage, detail) {
    super(`baseline runner failed at ${stage}: ${detail}`);
    this.name = 'RunnerError';
    this.stage = stage;
  }
}

/** Limites del runner. Un intento por stage, ningun reintento automatico. */
export const RUNNER_LIMITS = Object.freeze({
  maxAttempts: 1,
  captureLimitBytes: 1_000_000,
  typecheckTimeoutMs: 600_000,
  apiTimeoutMs: 300_000,
  webTimeoutMs: 600_000,
  openapiTimeoutMs: 120_000,
  dbStageTimeoutMs: 300_000,
  provisionTimeoutMs: 1_800_000,
  cleanupTimeoutMs: 180_000,
  defaultTimeoutMs: 300_000,
});

/** Etapas en el orden de la matriz. `cleanup` es siempre la ultima. */
export const BASELINE_STAGES = Object.freeze([
  'provision',
  'typecheck',
  'api-no-db-health',
  'web',
  'openapi',
  ...Object.freeze([
    'db/cold-start-auth.api.test.ts',
    'db/core-01-hardening.db.test.ts',
    'db/eloisa-admin-support-foundation.db.test.ts',
    'db/hospital-agenda.api.test.ts',
    'db/hospital-core-02.db.test.ts',
    'db/hospital-institutional-auth.api.test.ts',
    'db/hospital-patients.api.test.ts',
    'db/hospital-professionals.api.test.ts',
    'db/human-auth.api.test.ts',
    'db/identity-professional-assignment.db.test.ts',
    'db/municipality.api.test.ts',
    'db/municipality-aggregates.db.test.ts',
    'db/patient-enrollment.api.test.ts',
    'db/patient-enrollment.db.test.ts',
    'db/patient-self.api.test.ts',
    'db/patient-self.db.test.ts',
    'db/runtime-fail-closed.db.test.ts',
    'db/tenant-bootstrap.db.test.ts',
    'db/visits.api.test.ts',
    'db/visits-db-foundation.db.test.ts',
    'db/visits-materialization.db.test.ts',
    'db/visits-professional-transitions.db.test.ts',
    'db/access-request-registration.db.test.ts',
    'db/institutional-administrator.api.test.ts',
    'db/personal-registration.db.test.ts',
  ]),
  'cleanup',
]);

/** Las 23 exactas de SPEC 025 sec. 9 más el expediente MP04-C3. El `+1` de OpenAPI es su propia etapa. */
export const DB_GATED_STAGES = Object.freeze(BASELINE_STAGES.filter((stage) => stage.startsWith('db/')));

/**
 * Etapas cuyo run-id puede generarse internamente. `provision` la genera siempre
 * que no se aporte, y `all` tambien. Cualquier otra etapa, incluido `typecheck`
 * cuando se ejecuta como etapa de baseline, exige run-id aportado.
 */
export const STAGES_WITH_OPTIONAL_RUN_ID = Object.freeze(['provision', 'all']);

/** Etapas que exigen env-file: todas. No existe stage sin ruta explicita. */
export const STAGES_REQUIRING_ENV_FILE = Object.freeze([...BASELINE_STAGES]);

const RUN_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,39}$/u;
const COMMIT_PATTERN = /^[0-9a-f]{7,40}$/u;
const ALLOWED_FLAGS = Object.freeze(['--env-file', '--stage', '--run-id']);

/** Entornos prohibidos para la baseline, ademas del guard de MP02. */
export const FORBIDDEN_BASELINE_ENVIRONMENTS = Object.freeze(['demo', 'staging', 'production', 'prod']);

/** Clasificacion de cada stage: lifecycle, static o test. */
function kindFor(stage) {
  if (stage === 'provision' || stage === 'cleanup') return 'lifecycle';
  if (stage === 'typecheck') return 'static';
  return 'test';
}

/** Etapa -> argv fijo. Sin shell, sin glob, sin ruta de usuario. */
function buildCommands(stage) {
  if (stage === 'typecheck') {
    return [
      { argv: [NODE, TSC, '--project', path.join('packages', 'shared', 'tsconfig.json'), '--noEmit'], cwd: REPO_ROOT },
      { argv: [NODE, TSC, '--project', path.join('apps', 'api', 'tsconfig.json'), '--noEmit', '--allowImportingTsExtensions'], cwd: REPO_ROOT },
      { argv: [NODE, TSC, '--project', path.join('apps', 'web', 'tsconfig.json'), '--noEmit'], cwd: REPO_ROOT },
    ];
  }
  if (stage === 'api-no-db-health') {
    return [
      {
        argv: [NODE, VITEST, 'run', path.join('test', 'health.api.test.ts'), path.join('test', 'application-composition.test.ts')],
        cwd: path.join(REPO_ROOT, 'apps', 'api'),
      },
      {
        argv: [NODE, VITEST, 'run', path.join('src', 'institutional-auth', 'institutional-auth.unit.test.ts')],
        cwd: path.join(REPO_ROOT, 'apps', 'api'),
      },
    ];
  }
  if (stage === 'web') {
    return [{ argv: [NODE, VITEST, 'run'], cwd: path.join(REPO_ROOT, 'apps', 'web') }];
  }
  if (stage === 'openapi') {
    return [{ argv: [NODE, VITEST, 'run', path.join('test', 'openapi.test.ts')], cwd: path.join(REPO_ROOT, 'apps', 'api') }];
  }
  if (stage.startsWith('db/')) {
    return [{ argv: [NODE, VITEST, 'run', path.join('test', stage.slice(3))], cwd: path.join(REPO_ROOT, 'apps', 'api') }];
  }
  // provision y cleanup no son procesos propios: se inyectan desde el modulo que
  // los implementa. Invocarlos por argv crearia recursion.
  return [];
}

function timeoutFor(stage) {
  if (stage === 'provision') return RUNNER_LIMITS.provisionTimeoutMs;
  if (stage === 'cleanup') return RUNNER_LIMITS.cleanupTimeoutMs;
  if (stage === 'typecheck') return RUNNER_LIMITS.typecheckTimeoutMs;
  if (stage === 'web') return RUNNER_LIMITS.webTimeoutMs;
  if (stage === 'openapi') return RUNNER_LIMITS.openapiTimeoutMs;
  if (stage === 'api-no-db-health' || stage.startsWith('db/')) return RUNNER_LIMITS.apiTimeoutMs;
  return RUNNER_LIMITS.defaultTimeoutMs;
}

/** Matriz cerrada y congelada con argv fijo, timeout finito y tipo de stage. */
export function buildStageMatrix() {
  return Object.freeze(
    BASELINE_STAGES.map((stage) =>
      Object.freeze({
        id: stage,
        kind: kindFor(stage),
        requiresEnvFile: STAGES_REQUIRING_ENV_FILE.includes(stage),
        timeoutMs: timeoutFor(stage),
        commands: Object.freeze(
          buildCommands(stage).map((command) => Object.freeze({ argv: Object.freeze(command.argv), cwd: command.cwd })),
        ),
      }),
    ),
  );
}

export const STAGE_MATRIX = buildStageMatrix();

/** Genera un run-id valido cuando la etapa lo permite. Sinazar ni aleatoriedad. */
export function generateRunId(now = new Date()) {
  const iso = now.toISOString().replace(/[-:]/gu, '').replace(/\..+$/u, '').toLowerCase();
  return `baseline-${iso}`;
}

/**
 * Parser fail-closed. Rechaza flags desconocidos, duplicados, valores vacios,
 * rutas implicitas, run-id peligroso y stage fuera de la matriz.
 *
 * @param {string[]} argv
 * @returns {{ envFilePath: string, stage: string, runId: string|null }}
 */
export function parseBaselineArgs(argv = []) {
  const vistos = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (!ALLOWED_FLAGS.includes(flag)) {
      throw new RunnerError('args', `flag no permitido: ${String(flag).slice(0, 40)}`);
    }
    if (vistos.has(flag)) {
      throw new RunnerError('args', `flag duplicado: ${flag}`);
    }
    const value = argv[index + 1];
    if (value === undefined || value === '' || value.startsWith('--')) {
      throw new RunnerError('args', `valor vacio o ausente para ${flag}`);
    }
    vistos.set(flag, value);
    index += 1;
  }

  const stage = vistos.get('--stage');
  if (stage === undefined) {
    throw new RunnerError('args', 'falta --stage');
  }
  if (stage !== 'all' && !STAGE_MATRIX.some((entry) => entry.id === stage)) {
    throw new RunnerError('args', `stage no permitido: ${String(stage).slice(0, 40)}`);
  }

  const envFilePath = vistos.get('--env-file') ?? null;
  const runId = vistos.get('--run-id') ?? null;

  // Toda etapa de la baseline exige env-file explicito, sin excepcion.
  if (envFilePath === null) {
    throw new RunnerError('args', `falta --env-file para ${stage}`);
  }
  if (envFilePath.trim() === '' || envFilePath !== envFilePath.trim()) {
    throw new RunnerError('args', 'env-file con formato invalido');
  }
  if (path.isAbsolute(envFilePath) || /[~*?<>|]/u.test(envFilePath) || envFilePath.includes('..')) {
    throw new RunnerError('args', 'env-file no puede ser relativo, implicito ni contener comodines');
  }

  // El run-id solo se genera internamente en las etapas que lo permiten; si se
  // aporta, siempre debe ser seguro.
  if (runId !== null && !RUN_ID_PATTERN.test(runId)) {
    throw new RunnerError('args', 'run-id con caracteres no permitidos');
  }
  if (runId === null && !STAGES_WITH_OPTIONAL_RUN_ID.includes(stage)) {
    throw new RunnerError('args', `falta --run-id para ${stage}`);
  }

  return Object.freeze({ envFilePath, stage, runId });
}

/** Resuelve el conjunto de stages. Fail-closed ante cualquier stage fuera de la matriz. */
export function resolveStageIds(requested) {
  if (requested === 'all') return Object.freeze([...BASELINE_STAGES]);
  const stage = STAGE_MATRIX.find((entry) => entry.id === requested);
  if (stage === undefined) throw new RunnerError('plan', `stage fuera de la matriz: ${String(requested).slice(0, 40)}`);
  return Object.freeze([requested]);
}

/** La matriz debe estar completa, sin duplicados y con `cleanup` al final. */
export function assertMatrixComplete(stageIds) {
  const vistos = new Set();
  for (const stage of stageIds) {
    if (vistos.has(stage)) throw new RunnerError('plan', `stage duplicado en la matriz: ${stage}`);
    if (!STAGE_MATRIX.some((entry) => entry.id === stage)) {
      throw new RunnerError('plan', `stage no autorizado: ${String(stage).slice(0, 40)}`);
    }
    vistos.add(stage);
  }
  if (vistos.has('all') || vistos.has('*')) throw new RunnerError('plan', 'matriz incompleta: comodin no autorizado');
  if (vistos.has('cleanup') && stageIds[stageIds.length - 1] !== 'cleanup') {
    throw new RunnerError('plan', 'cleanup debe ser la etapa final');
  }
  return Object.freeze({ stageIds: Object.freeze([...stageIds]), count: stageIds.length });
}

const NO_TESTS_FOUND = /no test files? found|no tests? found/iu;
const DISABLED_MARKER = /^\s*(?:disabled\b|(?:Tests|Test Files)\b[^\r\n]*\bdisabled\b|[^\r\n]*\bsuites?\s+(?:(?:is|are)\s+)?disabled\b)/imu;
const OMISSION_MARKER = /^\s*(?:(?:skipped|todo)\b|(?:Tests|Test Files)\b[^\r\n]*\b(?:skipped|todo)\b|[^\r\n]*[↓-][^\r\n]*\((?:skipped|todo)\))/imu;
// Los seis ceros, en los dos ordenes: `0 skipped` y `skipped 0`, igual para
// `todo` y `disabled`. Se eliminan ANTES de mirar marcadores.
const ZERO_COUNT = /\b(?:0\s+(?:skipped|todo|disabled)|(?:skipped|todo|disabled)\s+0)\b/giu;
const POSITIVE_COUNT = /\b(?:[1-9][0-9]*\s+(?:skipped|todo|disabled)|(?:skipped|todo|disabled)\s+[1-9][0-9]*)\b/giu;
const TEST_SUMMARY = /^\s*(?:Test Files|Tests)\b/mu;

/**
 * Clasificacion fail-closed, sin falsos FAIL por ceros.
 *
 * Los seis ceros (`0 skipped`, `skipped 0`, `0 todo`, `todo 0`, `0 disabled`,
 * `disabled 0`) describen una ejecucion sana. Siguen fallando: cualquier conteo
 * positivo en los dos ordenes, la palabra sola sin conteo (marcador
 * inequivoco), `no tests found`, `disabled` literal, timeout, exit code distinto
 * de cero y la ausencia de resumen en etapas de prueba.
 *
 * @param {{ exitCode?: number|null, stdout?: string, stderr?: string, timedOut?: boolean, expectTests?: boolean }} input
 */
export function classifyStageOutcome({ exitCode, stdout = '', stderr = '', timedOut = false, expectTests = true } = {}) {
  if (timedOut === true) return 'timeout';
  const salida = stripVTControlCharacters(`${stdout}\n${stderr}`);
  const sinCeros = salida.replace(ZERO_COUNT, '');

  if (extractCounts(salida).failed > 0) return 'fail';
  if (NO_TESTS_FOUND.test(sinCeros) || DISABLED_MARKER.test(sinCeros) || /PRUEBAS DE POSTGRESQL NO EJECUTADAS/u.test(sinCeros)) return 'disabled';
  if ([...sinCeros.matchAll(POSITIVE_COUNT)].length > 0) return 'skipped';
  if (OMISSION_MARKER.test(sinCeros)) return 'skipped';
  if (exitCode !== 0) return 'fail';
  if (expectTests && !TEST_SUMMARY.test(salida)) return 'incomplete';
  return 'pass';
}

/** Conteos minimos extraidos del resumen de un runner de pruebas. */
export function extractCounts(stdout = '') {
  const counts = { passed: 0, failed: 0, skipped: 0 };
  for (const summary of stripVTControlCharacters(String(stdout)).matchAll(/^\s*Tests\s+([^\r\n]+)/gmu)) {
    for (const count of summary[1].matchAll(/(\d+)\s+(passed|failed|skipped)\b/giu)) counts[count[2].toLowerCase()] += Number(count[1]);
  }
  return Object.freeze(counts);
}

/** Evidencia minima, congelada y sin secretos. */
export function buildStageEvidence({ stage, outcome, durationMs, counts = {}, commit = null, runId = null }) {
  return Object.freeze({
    runId: runId !== null && RUN_ID_PATTERN.test(String(runId)) ? String(runId) : null,
    commit: commit !== null && COMMIT_PATTERN.test(String(commit)) ? String(commit) : null,
    stage,
    outcome,
    durationMs,
    counts: Object.freeze({
      passed: Number(counts.passed ?? 0),
      failed: Number(counts.failed ?? 0),
      skipped: Number(counts.skipped ?? 0),
    }),
    project: null,
  });
}

/** Plan puro: no abre procesos. Solo resuelve la matriz y sus argumentos. */
export function buildPlan(argv = [], options = {}) {
  const parsed = parseBaselineArgs(argv);
  const stageIds = resolveStageIds(parsed.stage);
  assertMatrixComplete(stageIds);
  const runId = parsed.runId ?? generateRunId(options.now);
  return Object.freeze({
    envFilePath: parsed.envFilePath,
    runId,
    runIdProvided: parsed.runId !== null,
    requested: parsed.stage,
    stageIds,
    requiresEnvFile: true,
    maxAttempts: RUNNER_LIMITS.maxAttempts,
  });
}

/**
 * Topologia que el guard espera: la de MP08 mas los labels aprobados de MP02.
 * Sin los labels, `validateTestTopology` rechazaria siempre y el runner nunca
 * podria pasar el guard.
 */
const TOPOLOGY_APROBADA = Object.freeze({ ...buildApprovedTopology(), labels: EXPECTED_TEST_ENVIRONMENT.labels });

/** Verifica que el entorno no sea demo, staging ni produccion. Fail-closed. */
export function assertBaselineEnvironment(env = {}) {
  const errores = validateTestEnvironment(env, { topology: TOPOLOGY_APROBADA });
  if (errores.length > 0) {
    throw new RunnerError('guard', 'el entorno no cumple el contrato de pruebas aisladas');
  }
  for (const [clave, valor] of Object.entries(env)) {
    if (FORBIDDEN_BASELINE_ENVIRONMENTS.includes(String(valor ?? '').trim().toLowerCase())) {
      throw new RunnerError('guard', `entorno prohibido en ${clave.slice(0, 40)}`);
    }
  }
  return true;
}

/**
 * Variables del sistema admitidas en el entorno hijo: solo las necesarias para
 * crear el proceso y resolver rutas en Windows. Una sola representacion por
 * variable; el indice del padre es insensible a mayusculas, asi que `Path` o
 * `SYSTEMROOT` se resuelven igual sin duplicar claves. No se hereda configuracion
 * de usuario ni de herramientas: nada de HOME, USERPROFILE, APPDATA,
 * LOCALAPPDATA, ProgramData, SystemDrive, datos de procesador ni LANG.
 */
export const SYSTEM_ENV_ALLOWLIST = Object.freeze(['SystemRoot', 'COMSPEC', 'PATHEXT', 'PATH', 'TEMP', 'TMP']);

/** Variables de prueba derivadas que si puede recibir el hijo. */
export const CHILD_TEST_KEYS = Object.freeze(['DATABASE_URL', 'RUNTIME_DATABASE_URL', 'MERDN_RUNTIME_ROLE', 'MERDN_ACTIVE_TENANT_ID']);

/** Claves del env-file cuyo valor nunca puede viajar al hijo ni a la evidencia. */
export const BASELINE_SECRET_KEYS = Object.freeze([
  'TEST_DATABASE_ADMIN_URL',
  'TEST_DATABASE_RUNTIME_URL',
  'POSTGRES_PASSWORD',
  'MERDN_RUNTIME_DB_PASSWORD',
]);

/**
 * Entorno hijo MINIMO. No hereda `process.env`: solo variables del sistema
 * necesarias para localizar y crear el proceso en Windows, mas las tres
 * derivadas exclusivamente del env-file validado. Nunca se pasan las claves
 * crudas `TEST_DATABASE_*` ni `NODE_OPTIONS`, asi que el hijo no puede
 * reconectar ni redefinir la topologia de pruebas.
 *
 * @param {Record<string, string>} envCargado Env-file ya validado por el guard.
 * @param {Record<string, string>} parentEnv Entorno del proceso padre.
 */
export function buildChildEnvironment(envCargado = {}, parentEnv = process.env, trustedContext) {
  const hijo = {};
  // En Windows `process.env` conserva el casing original (`Path`, `SystemRoot`),
  // asi que la busqueda por clave es insensible a mayusculas y cada variable
  // entra una sola vez, con la clave canonica de la allowlist.
  const indice = new Map();
  for (const [clave, valor] of Object.entries(parentEnv ?? {})) {
    if (typeof valor === 'string' && valor !== '' && !indice.has(clave.toUpperCase())) indice.set(clave.toUpperCase(), valor);
  }
  for (const key of SYSTEM_ENV_ALLOWLIST) {
    const value = indice.get(key.toUpperCase());
    if (typeof value === 'string' && value !== '') hijo[key] = value;
  }
  const admin = envCargado?.TEST_DATABASE_ADMIN_URL;
  const runtime = envCargado?.TEST_DATABASE_RUNTIME_URL;
  const role = envCargado?.MERDN_RUNTIME_ROLE;
  if (typeof admin === 'string' && admin !== '') hijo.DATABASE_URL = admin;
  if (typeof runtime === 'string' && runtime !== '') hijo.RUNTIME_DATABASE_URL = runtime;
  if (typeof role === 'string' && role !== '') hijo.MERDN_RUNTIME_ROLE = role;
  if (trustedContext !== undefined) {
    const context = parseTrustedTenantContext(`${trustedContext?.tenantId}|${trustedContext?.tenantCode}`);
    hijo.MERDN_ACTIVE_TENANT_ID = context.tenantId;
  }
  return Object.freeze(hijo);
}

/** Secretos del env-file que el saneamiento de captura debe conocer. */
export function collectSecrets(envCargado = {}) {
  const secrets = new Set();
  for (const [clave, valor] of Object.entries(envCargado ?? {})) {
    if (!/PASSWORD|SECRET|TOKEN|URL|KEY/iu.test(clave)) continue;
    if (typeof valor === 'string' && valor.trim() !== '') secrets.add(valor.trim());
  }
  for (const clave of BASELINE_SECRET_KEYS) {
    const valor = envCargado?.[clave];
    if (typeof valor === 'string' && valor.trim() !== '') secrets.add(valor.trim());
  }
  return Object.freeze([...secrets]);
}

/**
 * Ejecutor real por argv fijo y `shell: false`. La captura se recorta y se
 * sanitiza con `scrubSecrets` antes de salir del ejecutor. El hijo NUNCA hereda
 * `process.env`: recibe el entorno minimo derivado del env-file validado.
 *
 * @param {{ spawn?: Function, secrets?: string[], env?: Record<string, string> }} options
 */
export function createSpawnExecutor(options = {}) {
  const { spawn = nodeSpawn, secrets = [], env = buildChildEnvironment({}) } = options;
  return function executeOne({ command, cwd, timeoutMs, stage }) {
    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';
      let truncated = false;
      let settled = false;
      const MAX = RUNNER_LIMITS.captureLimitBytes;

      const hijo = spawn(command.argv[0], command.argv.slice(1), {
        cwd,
        shell: false,
        env,
        windowsHide: true,
      });

      const finalizar = (resultado) => {
        if (settled) return;
        settled = true;
        clearTimeout(temporizador);
        resolve(resultado);
      };

      const temporizador = setTimeout(() => {
        try {
          hijo.kill();
        } catch {
          // el proceso ya termino
        }
        finalizar({ exitCode: null, stdout: scrubSecrets(stdout, secrets), stderr: scrubSecrets('timeout', secrets), timedOut: true });
      }, timeoutMs);

      hijo.stdout?.on('data', (chunk) => {
        if (stdout.length >= MAX) { truncated = true; return; }
        stdout += String(chunk);
      });
      hijo.stderr?.on('data', (chunk) => {
        if (stderr.length >= MAX) { truncated = true; return; }
        stderr += String(chunk);
      });
      hijo.on('error', (error) => {
        finalizar({ exitCode: null, stdout: '', stderr: scrubSecrets(`spawn: ${error?.code ?? 'error'}`, secrets), timedOut: false, spawnFailed: true, stage });
      });
      hijo.on('close', (code) => {
        finalizar({
          exitCode: code ?? null,
          stdout: scrubSecrets(truncated ? `${stdout}\n[truncado]` : stdout, secrets),
          stderr: scrubSecrets(truncated ? `${stderr}\n[truncado]` : stderr, secrets),
          timedOut: false,
        });
      });
    });
  };
}

/** Ejecuta los comandos de un stage en orden. Falla al primer comando que falle. */
export async function executeStageCommands({ stage, commands, execute }) {
  let stdout = '';
  let stderr = '';
  for (const command of commands) {
    const resultado = await execute({ command, cwd: command.cwd, timeoutMs: stage.timeoutMs, stage: stage.id });
    stdout = `${stdout}\n${resultado?.stdout ?? ''}`;
    stderr = `${stderr}\n${resultado?.stderr ?? ''}`;
    if (resultado?.timedOut === true || resultado?.spawnFailed === true || resultado?.exitCode !== 0) {
      return { ...resultado, stdout, stderr };
    }
  }
  return { exitCode: 0, stdout, stderr, timedOut: false };
}

/**
 * Funcion principal reutilizable. Con `execute` inyectado, corre stages con argv
 * fijo; sin el, usa el ejecutor real. `loadEnv`, `provision`, `preflight` y
 * `cleanupDatabase` son costuras de inyeccion: las pruebas simulan todo y ninguna
 * llamada real se autoriza en MP13-C2.
 *
 * Invariante: el runner es el UNICO dueno de la limpieza. El provisionador recibe
 * `cleanupOnFailure: false` y el adaptador MP09 se invoca exactamente una vez en
 * cada fallo, incluido el del propio provision.
 */
export async function runBaseline(options = {}) {
  const {
    argv = [],
    env,
    commit = null,
    execute,
    spawn: spawnImpl,
    now,
    loadEnv = loadEnvFile,
    provision,
    preflight,
    cleanupDatabase,
  } = options;
  const plan = buildPlan(argv, { now });

  const envCargado = env ?? (await runCleanupStep('env-file', () => loadEnv(plan.envFilePath), []));
  await runCleanupStep('guard', () => assertBaselineEnvironment(envCargado), []);

  // El entorno hijo y el saneamiento nacen DESPUES de cargar y validar el env-file.
  const secretos = [...collectSecrets(envCargado)];
  let trustedContext;

  const provisioner = provision ?? (await import('./test-db-provision.mjs')).provisionIsolatedTestDatabase;
  const preflightRunner = preflight ?? (await import('./test-db-preflight.mjs')).runRuntimeRlsPreflight;
  const cleaner = cleanupDatabase ?? (await import('./test-db-cleanup.mjs')).cleanupIsolatedTestDatabase;
  const cleanup = createCleanupAdapter(() => cleaner({ envFilePath: plan.envFilePath }));

  const prepareContext = async () => {
    const result = await preflightRunner({
      envFilePath: plan.envFilePath,
      onTrustedContext: (value) => {
        trustedContext = parseTrustedTenantContext(`${value?.tenantId}|${value?.tenantCode}`);
        secretos.push(trustedContext.tenantId);
      },
    });
    if ((result?.problems?.length ?? 0) > 0 || trustedContext === undefined) {
      throw new RunnerError('provision', 'preflight sin contexto institucional confiable');
    }
    return result;
  };

  const evidencia = [];

  try {
    for (const stageId of plan.stageIds) {
      const stage = STAGE_MATRIX.find((entry) => entry.id === stageId);
      const startedAt = Date.now();

      if (stageId === 'provision') {
        const resultado = await runCleanupStep(
          'provision',
          async () => {
            // Limpieza desactivada aqui: la owns el runner, una sola vez.
            await provisioner({ envFilePath: plan.envFilePath, cleanupOnFailure: false });
            return prepareContext();
          },
          secretos,
        );
        const ok = resultado?.problems === undefined || resultado.problems.length === 0;
        evidencia.push(buildStageEvidence({ stage: stageId, outcome: ok ? 'pass' : 'fail', durationMs: Date.now() - startedAt, commit, runId: plan.runId }));
        if (!ok) return cerrado(plan, evidencia, stageId, await cleanup.run());
        continue;
      }

      if (stageId === 'cleanup') {
        // Unico punto donde el cleanup corre por etapa. Si `cleaned: false` el
        // resultado global falla: nunca exito, y nunca una segunda limpieza.
        const resultado = await cleanup.run();
        evidencia.push(buildStageEvidence({ stage: stageId, outcome: resultado.cleaned ? 'pass' : 'fail', durationMs: Date.now() - startedAt, commit, runId: plan.runId }));
        if (!resultado.cleaned) return cerrado(plan, evidencia, stageId, resultado);
        continue;
      }

      // También las etapas individuales validan el recurso antes de crear hijos.
      if (trustedContext === undefined) await prepareContext();
      const runner = execute ?? createSpawnExecutor({
        spawn: spawnImpl, secrets: secretos,
        env: buildChildEnvironment(envCargado, process.env, trustedContext),
      });
      const salida = await executeStageCommands({ stage, commands: stage.commands, execute: runner });
      const outcome = classifyStageOutcome({
        exitCode: salida.exitCode,
        stdout: salida.stdout,
        stderr: salida.stderr,
        timedOut: salida.timedOut === true,
        expectTests: stage.kind === 'test',
      });
      evidencia.push(buildStageEvidence({ stage: stageId, outcome, durationMs: Date.now() - startedAt, counts: extractCounts(salida.stdout), commit, runId: plan.runId }));
      if (outcome !== 'pass') return cerrado(plan, evidencia, stageId, await cleanup.run());
    }

    return Object.freeze({ runId: plan.runId, evidence: Object.freeze(evidencia), ok: true, failedStage: null, cleanup: null });
  } catch (error) {
    // Excepcion de provision, preflight o ejecutor: evidencia sanitizada con la
    // etapa fallida y una unica limpieza. El mensaje crudo nunca sale de aqui.
    const stageId = sanitizarStage(error, plan);
    evidencia.push(buildStageEvidence({ stage: stageId, outcome: 'error', durationMs: 0, commit, runId: plan.runId }));
    return cerrado(plan, evidencia, stageId, await cleanup.run());
  }
}

function sanitizarStage(error, plan) {
  const stage = error?.stage;
  if (typeof stage === 'string' && STAGE_MATRIX.some((entry) => entry.id === stage)) return stage;
  if (Array.isArray(plan.stageIds) && plan.stageIds.includes(stage)) return stage;
  return 'runner';
}

function cerrado(plan, evidencia, stageId, cleanup) {
  return Object.freeze({
    runId: plan.runId,
    evidence: Object.freeze(evidencia),
    ok: false,
    failedStage: stageId,
    cleanup: cleanup === undefined ? null : Object.freeze({ cleaned: cleanup?.cleaned === true, reason: cleanup?.reason ?? null }),
  });
}

/**
 * Entrada CLI. Lee solo `process.argv.slice(2)`, valida, carga el env-file solo
 * cuando el plan lo exige y emite evidencia sanitizada por stdout. Nunca imprime
 * el mensaje crudo de una excepcion, ni una URL, ni SQL, ni secretos.
 */
export async function main(argv = process.argv.slice(2)) {
  try {
    const resultado = await runBaseline({ argv });
    process.stdout.write(`${JSON.stringify(resultado)}\n`);
    return resultado.ok ? 0 : 1;
  } catch (error) {
    const stage = sanitizarStage(error, { stageIds: [] });
    const evidencia = [buildStageEvidence({ stage, outcome: 'blocked', durationMs: 0 })];
    process.stdout.write(`${JSON.stringify({ runId: null, evidence: evidencia, ok: false, failedStage: stage, cleanup: null, error: 'baseline runner failed' })}\n`);
    return 1;
  }
}

export const RUNNER_CONTRACT = Object.freeze({
  stages: BASELINE_STAGES,
  dbGatedCount: DB_GATED_STAGES.length,
  limits: RUNNER_LIMITS,
});

/* Entrada CLI: solo cuando este archivo es el entrypoint. Importarlo no ejecuta nada. */
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main();
}
