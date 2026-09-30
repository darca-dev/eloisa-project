#!/usr/bin/env node
/**
 * SPEC 025 / MP09 - Cleanup fail-closed de la baseline aislada de pruebas.
 *
 * Elimina EXCLUSIVAMENTE los recursos del proyecto aprobado `merdn-baseline-test`
 * mediante `docker compose down --volumes --remove-orphans` con proyecto, archivo
 * Compose y env-file explicitos, y despues demuestra que no quedo ningun recurso.
 *
 * Decisiones de autoridad que implementa:
 *   - `spec/specs/025-baseline-pruebas-aislada/spec.md` secciones 7, 8 y 15
 *   - handoff `TO-CLAUDE.md` v27, paquete MP09
 *
 * Garantias de diseno:
 *   - Sin dependencias nuevas. Reutiliza el guard de MP02 y los contratos de MP07
 *     (`loadEnvFile`, `assertProjectIdentity`, `composeArgs`, `runCommand`,
 *     `scrubSecrets`, `ProvisionError`, identidad, nombres aprobados y
 *     `selectOwnedResources`). No se duplica topologia, nombres, labels, drivers
 *     ni comandos base.
 *   - El guard anti-entorno se pasa ANTES de abrir cualquier proceso, y la
 *     identidad del proyecto se exige ANTES de cualquier `down`.
 *   - Nunca `prune`, `system`, `rm`, `down -v` generico, glob ni objetivo ambiguo.
 *     Si queda un recurso residual se reporta FAIL y NO se intenta un segundo
 *     borrado: reintentar a ciegas es exactamente el fallo que la spec 025
 *     prohibe.
 *   - Sin shell: solo `execFile` a traves de `runCommand`, con argv fijo derivado
 *     de rutas y nombres constantes. Sin credenciales en argv.
 *   - Evidencia minimizada: booleanos y conteos. Nunca URLs, secretos,
 *     identificadores de tenant ni filas de datos.
 *
 * Importar este archivo NO registra handlers, NO abre procesos y NO limpia nada.
 * El adaptador de `finally` y de senales solo se activa si el runner lo invoca
 * explicitamente con `attachSignalHandlers`.
 */

import process from 'node:process';
import { pathToFileURL } from 'node:url';

import { assertTestEnvironment } from './test-environment-guard.mjs';
import {
  APPROVED_RESOURCE_NAMES,
  EXPECTED_TEST_ENVIRONMENT,
  PROJECT_NAME,
  PROVISION_LIMITS,
  ProvisionError,
  assertProjectIdentity,
  buildApprovedTestTopology,
  composeArgs,
  describeResource,
  loadEnvFile,
  runCommand,
  scrubSecrets,
  selectOwnedResources,
} from './test-db-provision.mjs';

/**
 * Identidad y nombres aprobados se reexportan para que el runner MP13 no importe
 * dos modulos ni repita la topologia de la baseline.
 */
export { APPROVED_RESOURCE_NAMES, EXPECTED_TEST_ENVIRONMENT, PROJECT_NAME };

/** Etapas ordenadas. Todo error indica en cual se produjo. */
export const CLEANUP_STAGES = Object.freeze([
  'env-file',
  'guard',
  'identity',
  'down',
  'postcheck',
  'signals',
]);

/** Limites finitos. Ninguna espera es indefinida y nada se reintenta. */
export const CLEANUP_LIMITS = Object.freeze({
  /** Tiempo maximo del `down`, ms. */
  downTimeoutMs: 180_000,
  /** Tiempo maximo de cada consulta del postcheck, ms. */
  postcheckTimeoutMs: 60_000,
  /** Tiempo maximo de la comprobacion de identidad, ms. */
  identityTimeoutMs: PROVISION_LIMITS.commandTimeoutMs,
  /** Un unico intento de limpieza. Nunca reintento automatico. */
  maxAttempts: 1,
});

/** Error de cleanup con mensaje sanitizado y etapa identificable. */
export class CleanupError extends Error {
  constructor(stage, detail) {
    super(`cleanup failed at ${stage}: ${detail}`);
    this.name = 'CleanupError';
    this.stage = stage;
  }
}

/**
 * Resuelve la etapa de un error, en este orden: `error.stage`, despues
 * `error.step`, despues `currentStage` y finalmente `unknown`.
 *
 * El orden importa porque `ProvisionError` de MP07 declara su etapa en `step`, no
 * en `stage`. Sin ese fallback, un fallo de identidad o del `down` que venga del
 * provisionador se reportaria como `unknown` y el runner de MP13 no podria
 * distinguir un inventario ambiguo de un fallo cualquiera.
 *
 * `currentStage` cubre las etapas que se ejecutan antes de que exista un error
 * tipado: el guard de MP02 lanza un `Error` comun sin `stage` ni `step`, asi que
 * sin esta etapa de la operacion un fallo del guard aparecia como `unknown` (o
 * directamente se escapaba crudo, al estar fuera del `try`).
 *
 * Es puro y no abre procesos, para que el mapeo se pueda demostrar sin Docker.
 *
 * @param {unknown} error
 * @param {string} [currentStage] Etapa de la operacion en curso, si se conoce.
 * @returns {string}
 */
export function resolveErrorStage(error, currentStage) {
  if (typeof error?.stage === 'string' && error.stage !== '') return error.stage;
  if (typeof error?.step === 'string' && error.step !== '') return error.step;
  if (typeof currentStage === 'string' && currentStage !== '') return currentStage;
  return 'unknown';
}

/** Convierte un error de proceso o del provisionador en un error sanitizado. */
function toSafeCleanupError(stage, error, secrets) {
  if (error instanceof CleanupError) return error;
  if (error instanceof ProvisionError) {
    return new CleanupError(resolveErrorStage(error, stage), scrubSecrets(error.message, secrets));
  }
  return new CleanupError(stage, scrubSecrets(error?.message ?? 'fallo desconocido', secrets));
}

/**
 * Ejecuta una etapa temprana del cleanup y convierte cualquier fallo en
 * `CleanupError` sanitizado conservando la etapa en la que ocurrio.
 *
 * Se usa para `env-file` y `guard`, que corren antes de que exista la lista de
 * secretos: `scrubSecrets` acepta una lista vacia y aun asi oculta cualquier URL
 * de conexion. No abre procesos por si mismo, solo espera la operacion que
 * recibe, asi que es comprobable sin Docker.
 *
 * @template T
 * @param {string} stage Etapa de la operacion, usada si el error no declara una.
 * @param {() => T | Promise<T>} operation
 * @param {string[]} [secrets]
 * @returns {Promise<T>}
 */
export async function runCleanupStep(stage, operation, secrets = []) {
  try {
    return await operation();
  } catch (error) {
    throw toSafeCleanupError(resolveErrorStage(error, stage), error, secrets);
  }
}

// ---------------------------------------------------------------------------
// Constructores puros de argv (verificables sin Docker)
// ---------------------------------------------------------------------------

/**
 * Unica limpieza permitida. El argv se deriva de `composeArgs`, de modo que el
 * proyecto, el archivo Compose y el env-file son siempre explicitos y ningun otro
 * objetivo puede colarse: el resto son literales fijos.
 */
export function buildComposeDownArgs(envFilePath) {
  return composeArgs(assertEnvFilePath(envFilePath), 'down', '--volumes', '--remove-orphans');
}

/** Contenedores del proyecto segun Compose. */
export function buildComposePsArgs(envFilePath) {
  return composeArgs(assertEnvFilePath(envFilePath), 'ps', '-a', '--format', '{{.Name}}');
}

/**
 * Contenedores con la label del proyecto, incluidos los que Compose no gestiona.
 * El filtro es project-scoped: un contenedor de otro proyecto nunca entra.
 */
export function buildContainerListArgs() {
  return ['ps', '-a', '--filter', `label=com.merdn.project=${PROJECT_NAME}`, '--format', '{{.Names}}'];
}

/**
 * Red por nombre exacto aprobado. El ancla `^...$` evita el prefijo laxo de
 * Docker, que tambien acepta subcadenas, y no requiere interpretar `stderr`.
 */
export function buildNetworkListArgs() {
  return ['network', 'ls', '--filter', `name=^${APPROVED_RESOURCE_NAMES.network}$`, '--format', '{{.Name}}'];
}

/** Volumen por nombre exacto aprobado, con el mismo criterio que la red. */
export function buildVolumeListArgs() {
  return ['volume', 'ls', '--filter', `name=^${APPROVED_RESOURCE_NAMES.volume}$`, '--format', '{{.Name}}'];
}

/**
 * Exige una ruta explicita de env-file antes de construir cualquier argv. Sin esto
 * un `down` podria heredar un `.env` implicito y operar sobre otra identidad.
 */
function assertEnvFilePath(envFilePath) {
  if (typeof envFilePath !== 'string' || envFilePath.trim() === '') {
    throw new CleanupError('env-file', 'se requiere una ruta explicita de archivo de entorno');
  }
  return envFilePath;
}

/**
 * Topologia esperada para el guard, derivada de la identidad aprobada.
 *
 * Delega en el provisionador para no duplicar la forma de la topologia: los
 * labels Approved son obligatorios, porque `validateTestTopology` rechaza
 * cualquier `topology` sin ellos y el cleanup fallaria cerrado en la etapa
 * `guard` antes de abrir ningun proceso.
 */
export function buildApprovedTopology() {
  return buildApprovedTestTopology();
}

// ---------------------------------------------------------------------------
// Analisis puro del postcheck
// ---------------------------------------------------------------------------

/** Convierte la salida de un listado de Docker en nombres normalizados. */
export function parseNameLines(stdout) {
  return String(stdout ?? '')
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line !== '');
}

/**
 * Postcheck puro. `observed` son los nombres que devolvieron consultas
 * project-scoped, asi que un nombre observado SI es un recurso del proyecto.
 * Los recursos de otros proyectos nunca aparecen en `observed` y por eso no se
 * adoptan ni se tocan. Devuelve conteos y, en `residual`, lo que impide declarar
 * la limpieza exitosa.
 */
export function buildResidualReport(observed = {}) {
  const kinds = ['container', 'network', 'volume'];
  const resources = [];
  for (const kind of kinds) {
    for (const name of observed[kind] ?? []) {
      if (typeof name !== 'string' || name.trim() === '') continue;
      resources.push(describeResource(kind, name.trim()));
    }
  }
  // `selectOwnedResources` es el filtro de MP07: aqui actua como segunda barrera
  // para que un nombre inesperado que se colara en la salida se reporte en vez de
  // ignorarse en silencio.
  const owned = selectOwnedResources(resources);
  const counts = Object.freeze({
    container: owned.filter((resource) => resource.kind === 'container').length,
    network: owned.filter((resource) => resource.kind === 'network').length,
    volume: owned.filter((resource) => resource.kind === 'volume').length,
  });
  return Object.freeze({
    clean: owned.length === 0,
    counts,
    residual: Object.freeze(owned.map((resource) => `${resource.kind}:${resource.name}`)),
  });
}

/** Evidencia minimizada y congelada: booleanos y conteos, nada mas. */
export function buildCleanupEvidence({ cleaned, residual, durationMs }) {
  return Object.freeze({
    project: EXPECTED_TEST_ENVIRONMENT.project,
    service: EXPECTED_TEST_ENVIRONMENT.service,
    cleaned,
    residualCounts: residual.counts,
    clean: residual.clean,
    durationMs,
  });
}

// ---------------------------------------------------------------------------
// Funcion principal
// ---------------------------------------------------------------------------

/**
 * Limpia el proyecto de pruebas y demuestra que no quedo ningun recurso.
 *
 * @param {object} options
 * @param {string} options.envFilePath Ruta explicita del `.env` local. Obligatoria.
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<object>} Evidencia minimizada.
 */
export async function cleanupIsolatedTestDatabase(options = {}) {
  const { envFilePath, signal } = options;
  const startedAt = Date.now();

  // 1. env-file explicito: nunca un `.env` implicito. La validacion de ruta sigue
  //    siendo la primera linea y ocurre antes de cualquier proceso; el fallo de
  //    lectura ahora queda como `CleanupError` en etapa `env-file` en vez de
  //    escapar crudo.
  assertEnvFilePath(envFilePath);
  const env = await runCleanupStep('env-file', () => loadEnvFile(envFilePath), []);

  // 2. Guard anti-entorno antes de abrir cualquier proceso. MP02 lanza un `Error`
  //    comun sin `stage` ni `step`, de modo que sin la etapa de la operacion un
  //    fallo del guard se reportaria como `unknown`.
  await runCleanupStep('guard', () => assertTestEnvironment(env, { topology: buildApprovedTopology() }), []);
  if (signal?.aborted) throw new CleanupError('guard', 'aborted by signal');

  const secrets = [
    env.TEST_DATABASE_ADMIN_URL,
    env.TEST_DATABASE_RUNTIME_URL,
    env.POSTGRES_PASSWORD,
    env.MERDN_RUNTIME_DB_PASSWORD,
  ];

  try {
    // 3. Identidad del proyecto antes de cualquier `down`. Inventario ambiguo,
    //    label incompleto, nombre no aprobado o driver inesperado detiene aqui
    //    sin borrar nada. El valor no se usa: lo que exige el contrato es que la
    //    llamada no lance, y eso lo garantiza el propio provisionador.
    await assertProjectIdentity(envFilePath, secrets);

    // 4. La unica limpieza permitida.
    await runCommand('docker', buildComposeDownArgs(envFilePath), {
      step: 'down',
      timeoutMs: CLEANUP_LIMITS.downTimeoutMs,
      secrets,
    });

    // 5. Postcheck. Un recurso residual es FAIL y NO gatilla un segundo borrado.
    const postcheck = await collectResidualNames(envFilePath, secrets);
    const residual = buildResidualReport(postcheck);
    if (!residual.clean) {
      throw new CleanupError(
        'postcheck',
        `recursos residuales del proyecto sin segundo borrado: ${residual.residual.slice(0, 5).join(', ')}`,
      );
    }

    return buildCleanupEvidence({
      cleaned: true,
      residual,
      durationMs: Date.now() - startedAt,
    });
  } catch (error) {
    // La etapa se resuelve aqui y no dentro de `toSafeCleanupError` para que un
    // `ProvisionError` conserve la suya: `stage` primero, `step` despues. Un
    // residuo del postcheck no puede reportarse como fallo del `down`.
    throw toSafeCleanupError(resolveErrorStage(error), error, secrets);
  }
}

/** Nombres residuales observados, todos project-scoped. */
async function collectResidualNames(envFilePath, secrets) {
  const [compose, containers, networks, volumes] = await Promise.all([
    runCommand('docker', buildComposePsArgs(envFilePath), {
      step: 'postcheck',
      timeoutMs: CLEANUP_LIMITS.postcheckTimeoutMs,
      secrets,
    }),
    runCommand('docker', buildContainerListArgs(), {
      step: 'postcheck',
      timeoutMs: CLEANUP_LIMITS.postcheckTimeoutMs,
      secrets,
    }),
    runCommand('docker', buildNetworkListArgs(), {
      step: 'postcheck',
      timeoutMs: CLEANUP_LIMITS.postcheckTimeoutMs,
      secrets,
    }),
    runCommand('docker', buildVolumeListArgs(), {
      step: 'postcheck',
      timeoutMs: CLEANUP_LIMITS.postcheckTimeoutMs,
      secrets,
    }),
  ]);
  return Object.freeze({
    container: [...new Set([...parseNameLines(compose.stdout), ...parseNameLines(containers.stdout)])],
    network: parseNameLines(networks.stdout),
    volume: parseNameLines(volumes.stdout),
  });
}

// ---------------------------------------------------------------------------
// Adaptador de `finally` y de senales
// ---------------------------------------------------------------------------

/**
 * Adaptador de un solo intento. Concentra la limpieza para que `finally` y las
 * senales no puedan ejecutarla dos veces ni convertir un fallo de cleanup en un
 * fallo del error original. Es puro respecto de Docker: recibe la funcion de
 * limpieza ya resuelta, asi que se puede probar sin procesos.
 */
export function createCleanupAdapter(cleanup, options = {}) {
  const { onResult } = options;
  let attempted = false;
  let settled = null;

  const run = async () => {
    if (attempted) return settled;
    attempted = true;
    try {
      const result = await cleanup();
      settled = Object.freeze({ cleaned: result?.cleaned === true, reason: null });
    } catch (error) {
      // El motivo se reduce a la etapa y al nombre del error: nunca el mensaje
      // crudo de un proceso, que podria traer una ruta o una linea de comandos.
      settled = Object.freeze({
        cleaned: false,
        reason: error instanceof CleanupError ? `${error.stage}` : 'unknown',
      });
    }
    if (typeof onResult === 'function') onResult(settled);
    return settled;
  };

  return Object.freeze({ run, isAttempted: () => attempted, getResult: () => settled });
}

/**
 * Registra listeners de senal SOLO cuando el runner lo invoca. Importar el modulo
 * no registra nada. Devuelve la funcion de desregistro.
 */
export function attachSignalHandlers(adapter, options = {}) {
  const { signals = ['SIGINT', 'SIGTERM'], onSignal } = options;
  const handlers = [];
  for (const signalName of signals) {
    const handler = () => {
      void adapter.run();
      if (typeof onSignal === 'function') onSignal(signalName);
    };
    process.on(signalName, handler);
    handlers.push([signalName, handler]);
  }
  return () => {
    for (const [signalName, handler] of handlers) process.off(signalName, handler);
  };
}

export default cleanupIsolatedTestDatabase;

// Guarda de modulo principal portable: `file://` + ruta Windows nunca coincide
// con `import.meta.url`. Importar el archivo NO ejecuta nada.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  // eslint-disable-next-line no-console -- CLI de verificacion: la salida es la evidencia exigida.
  console.error('test-db-cleanup.mjs es un artefacto reutilizable. Invocalo desde el runner aprobado; no opera por si mismo.');
  process.exitCode = 2;
}
