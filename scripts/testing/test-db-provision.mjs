#!/usr/bin/env node
/**
 * SPEC 025 / MP07 - Provisionador fail-closed del cluster de pruebas aislado.
 *
 * Prepara un PostgreSQL desechable y exclusivo para la baseline de pruebas:
 * levanta `postgres-test`, aplica las 17 migraciones versionadas, prepara el
 * owner no privilegiado `merdn_test_migrator` sobre las 27 tablas protegidas y
 * devuelve evidencia sanitizada.
 *
 * Este módulo NO se ejecutó al escribirlo. MP07 crea el provisionador; el
 * arranque real del cluster es un paquete posterior. Este archivo no autoriza
 * por si mismo a levantar nada: quien lo invoca debe hacerlo en un entorno de
 * pruebas y con el guard aprovado.
 *
 * Decisiones de autoridad que implementa:
 *   - `spec/bitacora/decisiones/2026-09-26-baseline-aislada-migraciones-y-owner-test.md`
 *   - handoff `TO-CLAUDE.md` v23, paquete MP07
 *
 * Garantias de diseno:
 *   - Sin dependencias nuevas. Solo Node builtins y el guard de MP02.
 *   - Falla cerrado: cualquier duda sobre identidad, labels, conteos o flags
 *     detiene el proceso antes de tocar recursos.
 *   - Sin shell. Todo proceso se construye con `execFile` y argv estatico.
 *   - Sin credenciales en argv ni en logs. La password del runtime viaja por
 *     stdin; la conexion administrativa ocurre dentro del contenedor de
 *     pruebas, por socket local, sin password.
 *   - Evidencia sin datos: conteos, nombres de rol/tabla/migracion y flags.
 *     Nunca URLs, claves, UUIDs de tenant ni filas de tablas.
 *
 * Limites y senales exportados en `PROVISION_LIMITS` / `PROVISION_POLICY` para
 * que MP09 y MP13 reutilicen el mismo contrato.
 */

import { execFile, spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { EXPECTED_TEST_ENVIRONMENT, assertTestEnvironment } from './test-environment-guard.mjs';

/**
 * Se reexporta la identidad aprobada para que el runner posterior no tenga que
 * importar el guard por separado ni duplicar constantes de topologia.
 */
export { EXPECTED_TEST_ENVIRONMENT };

/** Raiz del repositorio, derivada de la ubicacion de este archivo. */
export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Rutas fijas: ningun archivo se resuelve desde entrada de usuario. */
export const COMPOSE_FILE = path.join(REPO_ROOT, 'compose.test.yml');
export const PRISMA_SCHEMA = path.join(REPO_ROOT, 'prisma', 'schema.prisma');

/**
 * Nombre exacto del recurso de la baseline aislada. Cualquier recurso de este
 * proyecto debe pertenecer a esta familia de nombres; un nombre inesperado con
 * las labels correctas es motivo de STOP, no de borrado.
 */
export const PROJECT_NAME = EXPECTED_TEST_ENVIRONMENT.project;

/**
 * Owner no privilegiado del catalogo completo, segun las decisiones del
 * Product Owner del 2026-09-26 y 2026-10-09. NOLOGIN: existe para poseer objetos, nunca
 * para conectarse al cluster.
 */
export const TEST_OWNER_ROLE = 'merdn_test_migrator';

/** Tenant ficticio unico y no identificable que la baseline debe contener. */
export const FICTIONAL_TENANT = 'merdn-mvp';

/**
 * Bandera configurable solo para pruebas unitarias del propio provisionador.
 * En ejecucion real debe quedar en `false`: cualquier valor distinto de
 * `guard` rompe el fail-closed.
 */
const POLICY = Object.freeze({
  /** Etiqueta cada paso para la evidencia y para el error sanitizado. */
  step: null,
  /** Nunca se permite continuar sin el guard. */
  guard: 'guard',
});

/** Limites finitos: ninguna espera puede ser indefinida. */
export const PROVISION_LIMITS = Object.freeze({
  /** Espera maxima de healthcheck, ms. */
  healthTimeoutMs: 120_000,
  /** Intervalo entre sondas de healthcheck, ms. */
  healthPollMs: 2_000,
  /** Tiempo maximo de `prisma migrate deploy`, ms. */
  migrateTimeoutMs: 300_000,
  /** Tiempo maximo de cualquier comando auxiliar, ms. */
  commandTimeoutMs: 120_000,
  /** Numero maximo de intentos por comando. Nunca reintento automatico. */
  maxAttempts: 1,
});

/**
 * Las 17 migraciones aprobadas, en orden versionado. La lista es cerrada: si
 * el repositorio o la base difieren, el provisionador falla en vez de aceptar
 * un subconjunto.
 */
export const REQUIRED_MIGRATIONS = Object.freeze([
  '20260821120000_core_01_init',
  '20260821120100_core_01_reference_data',
  '20260822120000_core_01_hardening',
  '20260822130000_municipality_core_01',
  '20260822140000_hospital_core_01',
  '20260822160000_hospital_core_02',
  '20260823120000_identity_relationships_core_01',
  '20260824120000_visits_core_01',
  '20260824180000_visits_core_02',
  '20260824200000_visits_core_03',
  '20260825120000_eloisa_admin_access_01_mp01',
  '20260826120000_patient_self_audit_event_type',
  '20260830160000_force_rls_core_institutional_hospital',
  '20260919051156_add_audit_events_human_account_linked_enrollment_revoked',
  '20260928190000_access_request_foundation',
  '20260930170000_access_provisioning',
  '20260930230000_access_request_registration_snapshot',
  '20261012140000_restore_address_tenant_integrity',
  '20261012150000_institutional_first_administrator',
  '20261012160000_bind_human_session_identity',
  '20261012170000_personal_registration_ownership',
  '20261012180000_administrator_managed_recovery',
  '20261012190000_recovery_authentication_cutoff',
  '20261014190000_institutional_login_return_targets',
]);

/**
 * Catalogo efectivo aprobado por S00-MP04B: las 26 tablas de 025 mas
 * access_request de 038. La propiedad se transfiere solo a estas.
 */
export const PROTECTED_TABLES = Object.freeze([
  'access_request',
  'access_password_recovery',
  'appointment',
  'audit_event',
  'care_assignment',
  'consent_record',
  'enrollment_session',
  'external_auth_identity',
  'home_visit',
  'home_visit_transition',
  'human_account',
  'human_auth_attempt',
  'human_session',
  'institutional_identity',
  'institutional_administrator_registration',
  'institutional_session',
  'patient',
  'patient_address',
  'patient_caregiver_relationship',
  'patient_caregiver_relationship_scope',
  'patient_population_membership',
  'person',
  'platform_support_capability',
  'professional_affiliation',
  'professional_profile',
  'support_context_session',
  'support_grant',
  'tenant',
  'territorial_unit',
]);

/** Numero de policies esperado sobre las 27 tablas del catalogo completo. */
export const EXPECTED_POLICY_COUNT = 30;

/**
 * Familia de nombres de contenedor admitida. Es deliberadamente estrecha:
 * Compose solo declara `postgres-test` en `compose.test.yml`, asi que el nombre
 * debe ser `<proyecto>-<servicio>` con el sufijo que Compose anade. Un
 * contenedor de otro servicio del mismo proyecto no se adopta en silencio:
 * obliga a STOP, que es el comportamiento fail-closed exigido.
 */
const ALLOWED_RESOURCE_NAME_PATTERN = new RegExp(
  `^${PROJECT_NAME}-${EXPECTED_TEST_ENVIRONMENT.service}(?:[-_][a-z0-9]+)*$`,
  'iu',
);

/** Etiquetas que un recurso debe llevar para ser considered de esta baseline. */
const REQUIRED_LABELS = EXPECTED_TEST_ENVIRONMENT.labels;

/**
 * Nombres exactos aprobados de red y volumen. Compose no les anade sufijo, asi
 * que aqui no se admite una familia: cualquier otro nombre que coincida con el
 * proyecto es un recurso ajeno y obliga a STOP.
 */
export const APPROVED_RESOURCE_NAMES = Object.freeze({
  network: EXPECTED_TEST_ENVIRONMENT.network,
  volume: EXPECTED_TEST_ENVIRONMENT.volume,
});

/**
 * Driver exigido por tipo. Una red `bridge` y un volumen `local` son los valores
 * de la imagen oficial de Postgres; cualquier otro driver significa que el
 * recurso no es el que Compose declaro y no se puede borrar a ciegas.
 */
export const REQUIRED_DRIVERS = Object.freeze({
  container: null,
  network: 'bridge',
  volume: 'local',
});

/**
 * Topologia aprobada COMPLETA que el guard de MP02 exige: los ocho campos de
 * identidad mas los tres labels. `validateTestTopology` rechaza `topology` sin
 * `labels`, de modo que una topologia de ocho campos nunca pasaria el guard y
 * la provision fallaria cerrado antes de abrir Docker.
 *
 * Es la unica fuente de la forma de topologia: la reutilizan el cleanup de MP09,
 * el runner de MP13 y las pruebas permanentes, para que ninguna copia diverga.
 * Es pura: no lee archivos, no abre procesos y no toca `process.env`.
 */
export function buildApprovedTestTopology() {
  const identity = EXPECTED_TEST_ENVIRONMENT;
  return Object.freeze({
    project: identity.project,
    service: identity.service,
    database: identity.database,
    host: identity.host,
    port: identity.port,
    containerPort: identity.containerPort,
    network: identity.network,
    volume: identity.volume,
    labels: identity.labels,
  });
}

/**
 * Error de provisionamiento con mensaje ya sanitizado. Todo lo que sale hacia
 * arriba pasa por aqui: nunca se propaga un error de shell con una URL.
 */
export class ProvisionError extends Error {
  constructor(step, detail) {
    super(`provision failed at ${step}: ${detail}`);
    this.name = 'ProvisionError';
    this.step = step;
  }
}

/**
 * Sustituye cualquier valor secreto o URLKnown por `[redacted]`. Se usa sobre
 * stderr de procesos hijos, que puede contener la URL administrativa si una
 * herramienta la imprime en un error.
 */
export function scrubSecrets(value, secrets = []) {
  let text = String(value ?? '');
  for (const secret of secrets) {
    if (typeof secret === 'string' && secret.length >= 4) {
      text = text.split(secret).join('[redacted]');
    }
  }
  // Cualquier URL de conexion que sobreviva al scrub tambien se oculta.
  text = text.replace(/postgres(?:ql)?:\/\/\S*/giu, '[redacted-url]');
  return text;
}

/** Error sanitizado a partir de una falla de proceso hijo. */
function toSafeFailure(step, error, secrets) {
  const code = typeof error?.code === 'number' ? error.code : null;
  const signal = error?.signal ? String(error.signal) : null;
  const stderr = scrubSecrets(error?.stderr ?? '', secrets).trim();
  const detail = [
    code === null ? null : `exit ${code}`,
    signal ? `signal ${signal}` : null,
    stderr ? `stderr: ${stderr.slice(0, 400)}` : null,
  ]
    .filter(Boolean)
    .join(', ');
  return new ProvisionError(step, detail || 'process failed without diagnostics');
}

/** Espera finita entre sondas. */
function delay(ms, signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    if (signal) {
      const onAbort = () => {
        clearTimeout(timer);
        reject(new ProvisionError(POLICY.step, 'aborted by signal'));
      };
      if (signal.aborted) {
        onAbort();
        return;
      }
      signal.addEventListener('abort', onAbort, { once: true });
    }
  });
}

/**
 * Ejecuta un comando con argv estatico, sin shell, con timeout finito y sin
 * reintento. `input` viaja por stdin para que ningun secreto aparezca en argv.
 */
export function runCommand(command, args, options = {}) {
  const { step, timeoutMs = PROVISION_LIMITS.commandTimeoutMs, secrets = [] } = options;
  return new Promise((resolve, reject) => {
    execFile(
      command,
      args,
      {
        cwd: options.cwd ?? REPO_ROOT,
        env: options.env ?? process.env,
        timeout: timeoutMs,
        maxBuffer: 8 * 1024 * 1024,
        windowsHide: true,
        encoding: 'utf8',
        shell: false,
      },
      (error, stdout, stderr) => {
        if (error) {
          reject(toSafeFailure(step, { ...error, stderr: stderr ?? error.stderr }, secrets));
          return;
        }
        resolve({ stdout: String(stdout ?? ''), stderr: String(stderr ?? '') });
      },
    );
  });
}

/**
 * Version con stdin real, necesaria para pasar SQL y credenciales efimeras sin
 * exponerlos en la linea de comandos.
 */
export function runCommandWithInput(command, args, input, options = {}) {
  const { step, timeoutMs = PROVISION_LIMITS.commandTimeoutMs, secrets = [] } = options;
  return new Promise((resolve, reject) => {
    const child = spawnWithoutShell(command, args, {
      cwd: options.cwd ?? REPO_ROOT,
      env: options.env ?? process.env,
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(new ProvisionError(step, `timeout after ${timeoutMs} ms`));
    }, timeoutMs);
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(new ProvisionError(step, scrubSecrets(error.message, secrets)));
    });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(
        toSafeFailure(
          step,
          { code, signal, stderr },
          secrets,
        ),
      );
    });
    child.stdin.on('error', () => {
      /* el close reporta el fallo real */
    });
    child.stdin.end(input);
  });
}

function spawnWithoutShell(command, args, options) {
  return spawn(command, args, { ...options, shell: false, windowsHide: true });
}

/**
 * Lector estricto de archivo de entorno. Sin dependencias, sin expansion, sin
 * sustitucion de comandos: un valor con `$(` o backtick se rechaza porque podria
 * esconder una credencial o un comando.
 */
export function parseEnvFile(content) {
  const env = {};
  const lines = String(content).split(/\r?\n/u);
  for (const [index, rawLine] of lines.entries()) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) continue;
    if (/[\\`$]/u.test(line)) {
      throw new ProvisionError('env-file', `linea ${index + 1} contiene expansion no permitida`);
    }
    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/u.exec(line);
    if (!match) {
      throw new ProvisionError('env-file', `linea ${index + 1} no es KEY=VALUE`);
    }
    const key = match[1];
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
      (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

/** Carga el archivo de entorno explicito. No hay `.env` implicito. */
export async function loadEnvFile(envFilePath) {
  if (typeof envFilePath !== 'string' || envFilePath.trim() === '') {
    throw new ProvisionError('env-file', 'se requiere una ruta explicita de archivo de entorno');
  }
  const absolute = path.resolve(REPO_ROOT, envFilePath);
  if (!path.isAbsolute(absolute) || !absolute.endsWith('.env')) {
    throw new ProvisionError('env-file', 'la ruta debe ser absoluta y terminar en .env');
  }
  let content;
  try {
    content = await readFile(absolute, 'utf8');
  } catch {
    throw new ProvisionError('env-file', 'no se pudo leer el archivo de entorno');
  }
  return parseEnvFile(content);
}

/** Argumentos base de Compose: proyecto, archivo y env-file siempre explicitos. */
export function composeArgs(envFilePath, ...rest) {
  return ['compose', '--project-name', PROJECT_NAME, '-f', COMPOSE_FILE, '--env-file', envFilePath, ...rest];
}

/** Formato Go estatico para inventariar un tipo de recurso. */
function inventoryFormat(kind) {
  const fields = [
    kind === 'container' ? '{{.Names}}' : '{{.Name}}',
    '{{.Label "com.merdn.project"}}',
    '{{.Label "com.merdn.scope"}}',
    '{{.Label "com.merdn.disposable"}}',
    ...(kind === 'container' ? [] : ['{{.Driver}}']),
  ];
  return fields.join('\\t');
}

/** Convierte una linea de inventario en un recurso normalizado. */
function parseInventoryLine(kind, line) {
  const parts = line.split('\t');
  const [name, project, scope, disposable, driver] = parts;
  if (typeof name !== 'string' || name.trim() === '') return null;
  return Object.freeze({
    kind,
    name: name.trim(),
    labels: Object.freeze({
      'com.merdn.project': (project ?? '').trim(),
      'com.merdn.scope': (scope ?? '').trim(),
      'com.merdn.disposable': (disposable ?? '').trim(),
    }),
    driver: kind === 'container' ? null : (driver ?? '').trim(),
  });
}

/** Nombre aprobado para el tipo de recurso. */
function isApprovedResourceName(kind, name) {
  if (kind === 'container') return ALLOWED_RESOURCE_NAME_PATTERN.test(name);
  if (kind === 'network') return name === APPROVED_RESOURCE_NAMES.network;
  if (kind === 'volume') return name === APPROVED_RESOURCE_NAMES.volume;
  return false;
}

/**
 * Inventario puro: decide que recursos son de esta baseline. Un recurso entra si
 * lleva el label del proyecto o si su nombre coincide con un nombre aprobado,
 * aunque no tenga labels. Lo demas se ignora: no es nuestro y no se toca.
 *
 * Funcion pura y sin Docker, reutilizable por MP09/MP13.
 */
export function selectOwnedResources(resources) {
  const owned = [];
  for (const resource of resources) {
    if (!resource || typeof resource.name !== 'string') continue;
    const labelled = resource.labels?.['com.merdn.project'] === PROJECT_NAME;
    const named = isApprovedResourceName(resource.kind, resource.name);
    if (labelled || named) owned.push(resource);
  }
  return owned;
}

/**
 * Validacion pura del inventario. Devuelve la lista de problemas en vez de
 * lanzar, para que un runner pueda inspeccionarlos sin Docker.
 *
 * Un recurso es valido solo si: nombre aprobado, los tres labels exactos y el
 * driver exigido. Cualquier otra cosa es ambigua y produce STOP.
 */
export function validateResourceInventory(resources) {
  const owned = selectOwnedResources(resources);
  const problems = [];
  for (const resource of owned) {
    if (!isApprovedResourceName(resource.kind, resource.name)) {
      problems.push(`${resource.kind} con nombre no aprobado`);
      continue;
    }
    for (const [label, expected] of Object.entries(REQUIRED_LABELS)) {
      if (resource.labels?.[label] !== expected) {
        problems.push(`${resource.kind} ${resource.name} sin label ${label}`);
      }
    }
    const requiredDriver = REQUIRED_DRIVERS[resource.kind];
    if (requiredDriver !== null && resource.driver !== requiredDriver) {
      problems.push(`${resource.kind} ${resource.name} con driver inesperado`);
    }
  }
  return Object.freeze({
    owned,
    problems,
    counts: Object.freeze({
      container: owned.filter((resource) => resource.kind === 'container').length,
      network: owned.filter((resource) => resource.kind === 'network').length,
      volume: owned.filter((resource) => resource.kind === 'volume').length,
    }),
  });
}

/** Un recurso de ejemplo, para pruebas puras y documentacion. */
export function describeResource(kind, name, overrides = {}) {
  return Object.freeze({
    kind,
    name,
    labels: Object.freeze({ ...REQUIRED_LABELS, ...(overrides.labels ?? {}) }),
    driver: overrides.driver ?? REQUIRED_DRIVERS[kind] ?? null,
  });
}

/** Inventaria un tipo de recurso con argv fijo y sin shell. */
async function listResources(kind, secrets) {
  const listArgs = kind === 'container' ? ['ps', '-a'] : kind === 'network' ? ['network', 'ls'] : ['volume', 'ls'];
  const result = await runCommand('docker', [...listArgs, '--format', inventoryFormat(kind)], {
    step: 'identity',
    secrets,
  });
  return result.stdout
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line !== '')
    .map((line) => parseInventoryLine(kind, line))
    .filter((resource) => resource !== null);
}

/**
 * Verifica que contenedores, redes y volumenes del proyecto sean exactamente de
 * esta baseline antes de cualquier `down --volumes`. Si no se puede probar la
 * identidad, la ambiguedad o una etiqueta incompleta, se detiene sin borrar.
 *
 * La cubren `preClean` y `cleanupAfterFailure`.
 */
export async function assertProjectIdentity(envFilePath, secrets) {
  const composeListing = await runCommand(
    'docker',
    composeArgs(envFilePath, 'ps', '-a', '--format', '{{.Name}}'),
    { step: 'identity', secrets },
  );
  const composeResources = composeListing.stdout
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line !== '').length;

  const inventory = [
    ...(await listResources('container', secrets)),
    ...(await listResources('network', secrets)),
    ...(await listResources('volume', secrets)),
  ];
  const result = validateResourceInventory(inventory);

  if (result.problems.length > 0) {
    throw new ProvisionError(
      'identity',
      `inventario no aprobado, sin borrar: ${result.problems.slice(0, 5).join('; ')}`,
    );
  }

  return Object.freeze({
    inspectedContainers: result.counts.container,
    inspectedNetworks: result.counts.network,
    inspectedVolumes: result.counts.volume,
    composeResources,
  });
}

/** Pre-clean acotado al proyecto aprobado. */
export async function preClean(envFilePath, secrets) {
  await assertProjectIdentity(envFilePath, secrets);
  await runCommand('docker', composeArgs(envFilePath, 'down', '--volumes', '--remove-orphans'), {
    step: 'pre-clean',
    secrets,
  });
}

/** Levanta unicamente `postgres-test`. */
export async function startPostgres(envFilePath, secrets) {
  await runCommand('docker', composeArgs(envFilePath, 'up', '--detach', '--no-deps', EXPECTED_TEST_ENVIRONMENT.service), {
    step: 'up',
    secrets,
  });
}

/** Espera finita al healthcheck declarado en compose.test.yml. */
export async function waitForHealthy(envFilePath, secrets, signal, limits = PROVISION_LIMITS) {
  const deadline = Date.now() + limits.healthTimeoutMs;
  let lastStatus = 'unknown';
  while (Date.now() < deadline) {
    if (signal?.aborted) throw new ProvisionError('health', 'aborted by signal');
    const id = await runCommand('docker', composeArgs(envFilePath, 'ps', '--quiet', EXPECTED_TEST_ENVIRONMENT.service), {
      step: 'health',
      secrets,
    });
    const containerId = id.stdout.trim();
    if (containerId !== '') {
      const state = await runCommand('docker', ['inspect', '--format', '{{.State.Health.Status}}', containerId], {
        step: 'health',
        secrets,
      });
      lastStatus = state.stdout.trim();
      if (lastStatus === 'healthy') return Object.freeze({ status: lastStatus });
      if (lastStatus === 'unhealthy') {
        throw new ProvisionError('health', 'el healthcheck reporto unhealthy');
      }
    }
    await delay(limits.healthPollMs, signal);
  }
  throw new ProvisionError('health', `healthcheck no alcanzado, ultimo estado: ${lastStatus}`);
}

/** Ejecuta SQL dentro del contenedor de pruebas. */
export async function runSql(envFilePath, sql, secrets, { readOnly = false } = {}) {
  const args = [
    'compose',
    '--project-name',
    PROJECT_NAME,
    '-f',
    COMPOSE_FILE,
    '--env-file',
    envFilePath,
    'exec',
    '--no-TTY',
    EXPECTED_TEST_ENVIRONMENT.service,
    'psql',
    '--username',
    EXPECTED_TEST_ENVIRONMENT.adminUser,
    '--dbname',
    EXPECTED_TEST_ENVIRONMENT.database,
    '--no-password',
    '--set',
    'ON_ERROR_STOP=1',
    ...(readOnly ? ['--tuples-only', '--no-align'] : []),
    '--file',
    '-',
  ];
  const result = await runCommandWithInput('docker', args, sql, { step: 'sql', secrets });
  return result.stdout;
}

/** Escapa un literal SQL duplicando comillas simples. */
export function quoteLiteral(value) {
  const text = String(value);
  if (text.includes('\u0000')) {
    throw new ProvisionError('sql', 'la credencial contiene un caracter no admitido');
  }
  return `'${text.split("'").join("''")}'`;
}

/** Verifica la identidad del servidor antes de tocar roles. */
export async function assertServerIdentity(envFilePath, secrets) {
  // `coalesce` en direccion y puerto: `docker compose exec` conecta por socket
  // Unix y `inet_server_addr()`/`inet_server_port()` devuelven NULL, lo que
  // envenenaria toda la concatenacion con NULL y haria fallar siempre la
  // comparacion. Las tres comparaciones exigidas (base, usuario y version) no
  // cambian: direccion y puerto siguen informativos en la evidencia.
  const out = await runSql(
    envFilePath,
    `SELECT current_database() || '|' || current_user || '|' || coalesce(inet_server_addr()::text, '') || '|' || coalesce(inet_server_port()::text, '') || '|' || current_setting('server_version_num');`,
    secrets,
    { readOnly: true },
  );
  const [database, user, host, port, versionNum] = out.trim().split('|');
  if (database !== EXPECTED_TEST_ENVIRONMENT.database) {
    throw new ProvisionError('identity', 'la base conectada no es la base de pruebas aprobada');
  }
  if (user !== EXPECTED_TEST_ENVIRONMENT.adminUser) {
    throw new ProvisionError('identity', 'la conexion no usa el administrador aprobado');
  }
  if (Number(versionNum) < 170000) {
    throw new ProvisionError('identity', 'version de PostgreSQL no aprobada');
  }
  return Object.freeze({ database, user, host, port, versionNum });
}

/**
 * Verifica que el contenedor publica solo loopback en el puerto aprobado. El
 * puerto se lee de la configuracion efectiva de Compose, no del archivo estatico.
 */
export async function assertLoopbackPublication(envFilePath, secrets) {
  const out = await runCommand('docker', composeArgs(envFilePath, 'port', EXPECTED_TEST_ENVIRONMENT.service, '5432'), {
    step: 'identity',
    secrets,
  });
  const binding = out.stdout.trim();
  if (binding !== `${EXPECTED_TEST_ENVIRONMENT.host}:${EXPECTED_TEST_ENVIRONMENT.port}`) {
    throw new ProvisionError('identity', 'la publicacion del puerto no es loopback en el puerto aprobado');
  }
  return Object.freeze({ host: EXPECTED_TEST_ENVIRONMENT.host, port: EXPECTED_TEST_ENVIRONMENT.port });
}

/**
 * Aplica `prisma migrate deploy` una sola vez, con entorno minimo y la URL
 * administrativa. La URL viaja por entorno del hijo, nunca en argv ni en logs.
 *
 * El binario invocado es el JS versionado de Prisma (`build/index.js`) mediante
 * `process.execPath`, con argv fijo, `shell: false` y el mismo timeout: en
 * Node 24/Windows, spawnear el lanzador `.cmd` sin shell devuelve `spawn
 * EINVAL` y `shell: true` esta prohibido por diseno. No cambia argumentos,
 * entorno ni garantias respecto al lanzador.
 */
export async function applyMigrations(adminUrl, secrets, limits = PROVISION_LIMITS) {
  const minimalEnv = {
    PATH: process.env.PATH,
    SystemRoot: process.env.SystemRoot,
    PATHEXT: process.env.PATHEXT,
    COMSPEC: process.env.COMSPEC,
    TEMP: process.env.TEMP,
    TMP: process.env.TMP,
    HOME: process.env.HOME,
    USERPROFILE: process.env.USERPROFILE,
    DATABASE_URL: adminUrl,
    PRISMA_HIDE_UPDATE_MESSAGE: '1',
    PRISMA_SKIP_POSTINSTALL_GENERATE: '1',
  };
  const prismaBin = path.join(REPO_ROOT, 'node_modules', 'prisma', 'build', 'index.js');
  await runCommand(
    process.execPath,
    [prismaBin, 'migrate', 'deploy', '--schema', PRISMA_SCHEMA],
    { step: 'migrate', env: minimalEnv, timeoutMs: limits.migrateTimeoutMs, secrets },
  );
}

/** Exige exactamente las migraciones del catalogo versionado aprobado. */
export async function assertMigrationsApplied(envFilePath, secrets) {
  const out = await runSql(
    envFilePath,
    "SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name;",
    secrets,
    { readOnly: true },
  );
  const applied = out
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line !== '');
  const appliedSet = new Set(applied);
  const expected = [...REQUIRED_MIGRATIONS].sort();
  const missing = expected.filter((name) => !appliedSet.has(name));
  const unexpected = applied.filter((name) => !expected.includes(name));
  if (missing.length > 0 || unexpected.length > 0) {
    throw new ProvisionError(
      'migrations',
      `la base no coincide con las ${REQUIRED_MIGRATIONS.length} migraciones aprobadas`,
    );
  }
  return Object.freeze({ appliedCount: applied.length, migrationNames: applied });
}

/**
 * Prepara los dos roles aprobados y transfiere la propiedad del catalogo completo.
 * No se toca ningun otro rol, policy, grant, schema, dato ni migracion.
 */
export async function prepareRolesAndOwnership(envFilePath, runtimePassword, secrets) {
  const password = quoteLiteral(runtimePassword);
  const owner = TEST_OWNER_ROLE;
  const runtime = EXPECTED_TEST_ENVIRONMENT.runtimeUser;
  const tables = PROTECTED_TABLES.map((name) => `'${name}'`).join(', ');

  await runSql(
    envFilePath,
    `
DO $provision$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = ${quoteLiteral(owner)}) THEN
    CREATE ROLE ${owner}
      NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOREPLICATION;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = ${quoteLiteral(runtime)}) THEN
    RAISE EXCEPTION 'el rol runtime aprobado no existe en la base migrada';
  END IF;
END
$provision$;

ALTER ROLE ${owner}
  WITH NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOREPLICATION;

ALTER ROLE ${runtime} WITH LOGIN PASSWORD ${password};

DO $transfer$
DECLARE
  tabla text;
  falta text;
BEGIN
  SELECT string_agg(nombre, ', ')
    INTO falta
    FROM unnest(ARRAY[${tables}]) AS t(nombre)
   WHERE to_regclass('public.' || nombre) IS NULL;
  IF falta IS NOT NULL THEN
    RAISE EXCEPTION 'tablas protegidas ausentes tras migrar: %', falta;
  END IF;

  FOREACH tabla IN ARRAY ARRAY[${tables}]
  LOOP
    EXECUTE format('ALTER TABLE public.%I OWNER TO %I', tabla, ${quoteLiteral(owner)});
  END LOOP;
END
$transfer$;
`,
    secrets,
  );
}

/** Verificaciones finales obligatorias antes de devolver exito. */
export async function verifyBaseline(envFilePath, secrets) {
  const out = await runSql(
    envFilePath,
    `
SELECT 'tenants|' || count(*)::text FROM public.tenant WHERE code = ${quoteLiteral(FICTIONAL_TENANT)};
SELECT 'runtime_flags|' || rolsuper::text || '|' || rolbypassrls::text || '|' || rolcreatedb::text || '|' || rolcreaterole::text || '|' || rolreplication::text
  FROM pg_roles WHERE rolname = ${quoteLiteral(EXPECTED_TEST_ENVIRONMENT.runtimeUser)};
SELECT 'owner_flags|' || rolsuper::text || '|' || rolbypassrls::text || '|' || rolcreatedb::text || '|' || rolcreaterole::text || '|' || rolreplication::text || '|' || rolcanlogin::text
  FROM pg_roles WHERE rolname = ${quoteLiteral(TEST_OWNER_ROLE)};
SELECT 'runtime_is_owner|' || count(*)::text
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace JOIN pg_roles r ON r.oid = c.relowner
 WHERE n.nspname = 'public' AND c.relkind = 'r' AND r.rolname = ${quoteLiteral(EXPECTED_TEST_ENVIRONMENT.runtimeUser)};
SELECT 'owner_tables|' || count(*)::text
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace JOIN pg_roles r ON r.oid = c.relowner
 WHERE n.nspname = 'public' AND c.relkind = 'r' AND r.rolname = ${quoteLiteral(TEST_OWNER_ROLE)};
SELECT 'protected_force|' || count(*)::text
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity AND c.relforcerowsecurity
   AND c.relname IN (${PROTECTED_TABLES.map((name) => `'${name}'`).join(', ')});
SELECT 'policies|' || count(*)::text
  FROM pg_policies
 WHERE schemaname = 'public'
   AND tablename IN (${PROTECTED_TABLES.map((name) => `'${name}'`).join(', ')});
`,
    secrets,
    { readOnly: true },
  );

  const metrics = new Map();
  for (const line of out.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (trimmed === '') continue;
    const separator = trimmed.indexOf('|');
    if (separator < 0) continue;
    metrics.set(trimmed.slice(0, separator), trimmed.slice(separator + 1).split('|'));
  }

  const fail = (reason) => {
    throw new ProvisionError('verify', reason);
  };

  if (metrics.get('tenants')?.[0] !== '1') fail('el tenant ficticio no es exactamente uno');
  const runtimeFlags = metrics.get('runtime_flags') ?? [];
  if (runtimeFlags.length !== 5 || runtimeFlags.some((value) => value !== 'false')) {
    fail('el rol runtime tiene atributos inseguros');
  }
  const ownerFlags = metrics.get('owner_flags') ?? [];
  if (ownerFlags.length !== 6 || ownerFlags.slice(0, 5).some((value) => value !== 'false') || ownerFlags[5] !== 'false') {
    fail('el owner de prueba tiene atributos inseguros');
  }
  if (metrics.get('runtime_is_owner')?.[0] !== '0') fail('el rol runtime es propietario de alguna tabla');
  if (metrics.get('owner_tables')?.[0] !== String(PROTECTED_TABLES.length)) {
    fail(`las tablas del owner no coinciden con las ${PROTECTED_TABLES.length} aprobadas`);
  }
  if (metrics.get('protected_force')?.[0] !== String(PROTECTED_TABLES.length)) {
    fail(`las ${PROTECTED_TABLES.length} tablas no tienen RLS y FORCE vigentes`);
  }
  if (metrics.get('policies')?.[0] !== String(EXPECTED_POLICY_COUNT)) {
    fail(`las policies no coinciden con las ${EXPECTED_POLICY_COUNT} aprobadas`);
  }

  return Object.freeze({
    fictionalTenant: FICTIONAL_TENANT,
    tenantCount: 1,
    runtimeFlagsSafe: true,
    ownerFlagsSafe: true,
    runtimeIsOwner: false,
    ownerTableCount: PROTECTED_TABLES.length,
    protectedTableCount: PROTECTED_TABLES.length,
    policyCount: EXPECTED_POLICY_COUNT,
  });
}

/**
 * Cleanup acotado. Solo toca el proyecto aprobado y solo si la identidad se pudo
 * probar. No reintenta y no borra fuera de las labels autorizadas.
 */
export async function cleanupAfterFailure(envFilePath, secrets) {
  try {
    await assertProjectIdentity(envFilePath, secrets);
    await runCommand('docker', composeArgs(envFilePath, 'down', '--volumes', '--remove-orphans'), {
      step: 'cleanup',
      secrets,
    });
    return Object.freeze({ cleaned: true });
  } catch {
    return Object.freeze({ cleaned: false });
  }
}

/**
 * Provisiona el cluster de pruebas aislado de extremo a extremo.
 *
 * @param {object} options
 * @param {string} options.envFilePath Ruta explicita del archivo `.env` local.
 * @param {AbortSignal} [options.signal] Cancela la espera de healthcheck.
 * @param {boolean} [options.cleanupOnFailure] Cleanup acotado ante fallo.
 * @returns {Promise<object>} Evidencia sanitizada.
 */
export async function provisionIsolatedTestDatabase(options = {}) {
  const { envFilePath, signal, cleanupOnFailure = true } = options;
  const startedAt = Date.now();
  const runId = `provision-${startedAt.toString(36)}`;
  const env = await loadEnvFile(envFilePath);

  // Falla cerrado antes de Docker o PostgreSQL si el entorno no es exacto. La
  // topologia incluye los tres labels aprobados: sin ellos el guard rechazaria
  // siempre y la provision no podria continuar.
  assertTestEnvironment(env, { topology: buildApprovedTestTopology() });

  const secrets = [
    env.TEST_DATABASE_ADMIN_URL,
    env.TEST_DATABASE_RUNTIME_URL,
    env.POSTGRES_PASSWORD,
    env.MERDN_RUNTIME_DB_PASSWORD,
  ];
  const steps = [];
  const record = (name) => {
    steps.push(name);
  };

  try {
    record('identity');
    await assertProjectIdentity(envFilePath, secrets);
    record('pre-clean');
    await preClean(envFilePath, secrets);
    record('up');
    await startPostgres(envFilePath, secrets);
    record('health');
    await waitForHealthy(envFilePath, secrets, signal);
    record('server-identity');
    await assertServerIdentity(envFilePath, secrets);
    await assertLoopbackPublication(envFilePath, secrets);
    record('migrate');
    await applyMigrations(env.TEST_DATABASE_ADMIN_URL, secrets);
    await assertMigrationsApplied(envFilePath, secrets);
    record('roles-and-ownership');
    await prepareRolesAndOwnership(envFilePath, env.MERDN_RUNTIME_DB_PASSWORD, secrets);
    record('verify');
    const verification = await verifyBaseline(envFilePath, secrets);

    return Object.freeze({
      runId,
      project: EXPECTED_TEST_ENVIRONMENT.project,
      service: EXPECTED_TEST_ENVIRONMENT.service,
      database: EXPECTED_TEST_ENVIRONMENT.database,
      migrations: REQUIRED_MIGRATIONS.length,
      steps,
      verification,
      durationMs: Date.now() - startedAt,
    });
  } catch (error) {
    const safe =
      error instanceof ProvisionError
        ? error
        : new ProvisionError('unknown', scrubSecrets(error?.message ?? 'fallo desconocido', secrets));
    if (cleanupOnFailure) {
      const cleanup = await cleanupAfterFailure(envFilePath, secrets);
      throw new ProvisionError(safe.step, `${safe.message}; cleanup=${cleanup.cleaned ? 'ok' : 'no'}`);
    }
    throw safe;
  }
}

export default provisionIsolatedTestDatabase;
