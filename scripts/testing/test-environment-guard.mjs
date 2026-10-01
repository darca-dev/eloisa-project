import { pathToFileURL } from 'node:url';

/**
 * Guard estructural fail-closed del entorno de pruebas AISLADA
 * (Spec 025, MP02 y correccion MP02-C1).
 *
 * Este modulo NO ejecuta Docker, NO abre conexiones, NO lanza procesos, NO toca
 * el sistema de archivos y NO modifica `process.env`. Solo inspecciona un objeto
 * de entorno ya resuelto y devuelve la lista de incumplimientos. Los scripts
 * posteriores (provision, preflight, cleanup, runner) lo invocan ANTES de
 * cualquier comando Docker o acceso a PostgreSQL, de modo que una identidad
 * equivocada o una plantilla sin credenciales real se detengan aqui y no en una
 * operacion destructiva.
 *
 * Principio de reportacion: un error identifica el CAMPO y la REGLA que fallo,
 * nunca el valor. No se imprimen URLs, usuarios completos, contrasenas ni el
 * objeto de entorno completo.
 */

/** Identidad exacta aprobada para la topologia de pruebas (Spec 025 seccion 7). */
export const EXPECTED_TEST_ENVIRONMENT = Object.freeze({
  project: 'merdn-baseline-test',
  service: 'postgres-test',
  database: 'merdn_test',
  host: '127.0.0.1',
  port: '55432',
  containerPort: '5432',
  network: 'merdn-baseline-test-net',
  volume: 'merdn-baseline-test-pgdata',
  adminUser: 'merdn_test_admin',
  runtimeUser: 'merdn_runtime',
  runtimeRole: 'enforce',
  schema: 'public',
  labels: Object.freeze({
    'com.merdn.project': 'merdn-baseline-test',
    'com.merdn.scope': 'test',
    'com.merdn.disposable': 'true',
  }),
});

/**
 * Marcadores de entornos que la baseline de pruebas jamas puede alcanzar. El
 * rechazo es case-insensitive y cubre cualquier posicion del valor, para que un
 * host como `merdn_dev-postgres` o un proyecto `merdn-demo` tambien se rechacen.
 * `prod` cubre `production`; ambos se listan para que el motivo sea explicito.
 */
export const FORBIDDEN_ENVIRONMENT_MARKERS = Object.freeze([
  'merdn_dev',
  'demo',
  'staging',
  'prod',
  'production',
]);

/** Marcador de plantilla sin credencial utilizable (Spec 025 seccion 7). */
const PLACEHOLDER_MARKER = /reemplazar-por-/iu;

/** Campos del descriptor de topologia que deben coincidir con la identidad. */
const TOPOLOGY_FIELDS = Object.freeze([
  'project',
  'service',
  'database',
  'host',
  'port',
  'containerPort',
  'network',
  'volume',
]);

/** Variables de entorno obligatorias del cluster de pruebas. */
export const REQUIRED_TEST_ENVIRONMENT_KEYS = Object.freeze([
  'POSTGRES_DB',
  'POSTGRES_USER',
  'POSTGRES_PASSWORD',
  'MERDN_RUNTIME_DB_USER',
  'MERDN_RUNTIME_DB_PASSWORD',
  'MERDN_RUNTIME_ROLE',
  'TEST_DATABASE_ADMIN_URL',
  'TEST_DATABASE_RUNTIME_URL',
]);

const ADMIN_URL_KEY = 'TEST_DATABASE_ADMIN_URL';
const RUNTIME_URL_KEY = 'TEST_DATABASE_RUNTIME_URL';
const ADMIN_PASSWORD_KEY = 'POSTGRES_PASSWORD';
const RUNTIME_PASSWORD_KEY = 'MERDN_RUNTIME_DB_PASSWORD';
const PROTOCOL = 'postgresql:';

function readValue(env, key) {
  const value = env?.[key];
  return typeof value === 'string' ? value.trim() : '';
}

function containsForbiddenMarker(value) {
  if (typeof value !== 'string' || value === '') return false;
  const lowered = value.toLowerCase();
  return FORBIDDEN_ENVIRONMENT_MARKERS.some((marker) => lowered.includes(marker));
}

/**
 * Reject a placeholder only when the guard is being used to EXECUTE
 * infrastructure. The versioned template declares placeholders on purpose, so a
 * caller that only inspects the template may opt out explicitly.
 */
function rejectPlaceholder(value, { allowPlaceholders }) {
  return !allowPlaceholders && typeof value === 'string' && PLACEHOLDER_MARKER.test(value);
}

/**
 * Decodifica percent-encoded de forma segura. Un `%` literal o una secuencia
 * invalida hacen que `decodeURIComponent` lance `URIError`; aqui se convierte en
 * un resultado sanitizado para que el guard NUNCA propague una excepcion por un
 * valor de entrada defectuoso. Un valor que no se puede decodificar se
 * considera no conforme (fail-closed) en lugar de compararse a medias.
 */
function safeDecode(value) {
  const text = typeof value === 'string' ? value : '';
  if (text === '') return { ok: true, value: '' };
  try {
    return { ok: true, value: decodeURIComponent(text) };
  } catch {
    return { ok: false, value: '' };
  }
}

/**
 * Valida una direccion PostgreSQL con la API `URL`. Solo admite el protocolo,
 * base, host, puerto y schema de la identidad aprobada, sin parametros extra.
 * Cuando se proporcionan `expectedUser` y `expectedPassword`, exige ademas que
 * el usuario y la clave de la URL correspondan exactamente con sus variables de
 * entorno, de modo que una URL valida no pueda apuntar a otra identidad.
 * Devuelve incumplimientos; nunca lanza y nunca imprime el valor recibido.
 */
export function validateTestDatabaseUrl(value, key, options = {}) {
  const {
    allowPlaceholders = false,
    expectedUser,
    expectedPassword,
    userKey = 'the approved user variable',
    passwordKey = 'the approved credential variable',
  } = options;
  const errors = [];
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) {
    errors.push(`${key} is required`);
    return errors;
  }
  let url;
  try {
    url = new URL(raw);
  } catch {
    errors.push(`${key} must be a parsable ${PROTOCOL} URL`);
    return errors;
  }
  if (url.protocol !== PROTOCOL) errors.push(`${key} must use the ${PROTOCOL} protocol`);
  if (url.hostname !== EXPECTED_TEST_ENVIRONMENT.host) {
    errors.push(`${key} must target the approved loopback host`);
  }
  if (url.port !== EXPECTED_TEST_ENVIRONMENT.port) errors.push(`${key} must use the approved host port`);

  const path = safeDecode(url.pathname ?? '');
  if (!path.ok) errors.push(`${key} path is not correctly encoded`);
  else if (path.value !== `/${EXPECTED_TEST_ENVIRONMENT.database}`) {
    errors.push(`${key} must target the approved test database`);
  }

  if (url.hash) errors.push(`${key} must not carry a fragment`);
  const params = [...url.searchParams.keys()];
  if (params.length !== 1 || params[0] !== 'schema') {
    errors.push(`${key} must declare only the schema parameter`);
  } else if (url.searchParams.get('schema') !== EXPECTED_TEST_ENVIRONMENT.schema) {
    errors.push(`${key} must declare the approved schema`);
  }

  const user = safeDecode(url.username);
  const password = safeDecode(url.password);
  if (!user.ok) errors.push(`${key} user is not correctly encoded`);
  if (!password.ok) errors.push(`${key} credential is not correctly encoded`);

  if (!url.username) errors.push(`${key} must declare a user`);
  if (!url.password) errors.push(`${key} must declare a credential`);
  else if (password.ok && rejectPlaceholder(password.value, { allowPlaceholders })) {
    errors.push(`${key} carries a template placeholder, not an execution credential`);
  }

  // Correspondencia obligatoria con las variables de entorno: sin ella, una URL
  // con la forma correcta podria usar una identidad o clave distinta de la
  // declarada y el guard no podria detectarlo.
  if (expectedUser && user.ok && user.value !== expectedUser) {
    errors.push(`${key} user must match ${userKey}`);
  }
  if (expectedPassword && password.ok && password.value !== expectedPassword) {
    errors.push(`${key} credential must match ${passwordKey}`);
  }

  if (containsForbiddenMarker(url.hostname)) errors.push(`${key} host is not an approved environment`);
  if (containsForbiddenMarker(user.value)) errors.push(`${key} user is not an approved environment`);
  if (containsForbiddenMarker(path.value)) errors.push(`${key} database is not an approved environment`);
  return errors;
}

/**
 * Valida el descriptor de topologia (proyecto, servicio, base, host, puertos,
 * red, volumen y labels) contra la identidad aprobada. La topologia es
 * OBLIGATORIA: omitirla o pasar `null` es un incumplimiento, porque sin ella no
 * hay forma de fijar la identidad de Compose que se va a operar. Los labels
 * propios de Docker se toleran; cualquier otro label `com.merdn.*` se rechaza.
 */
export function validateTestTopology(topology) {
  const errors = [];
  if (topology === undefined || topology === null) {
    errors.push('topology is required and must describe the approved test project');
    return errors;
  }
  if (typeof topology !== 'object' || Array.isArray(topology)) {
    errors.push('topology must be an object describing the approved test project');
    return errors;
  }
  for (const field of TOPOLOGY_FIELDS) {
    const value = topology[field];
    if (value === undefined || value === null || String(value).trim() === '') {
      errors.push(`topology.${field} is required`);
      continue;
    }
    const text = String(value).trim();
    if (text !== String(EXPECTED_TEST_ENVIRONMENT[field])) {
      errors.push(`topology.${field} must match the approved test identity`);
    }
    if (containsForbiddenMarker(text)) errors.push(`topology.${field} is not an approved environment`);
  }
  const labels = topology.labels;
  if (labels === undefined || labels === null || typeof labels !== 'object') {
    errors.push('topology.labels is required');
    return errors;
  }
  for (const [label, value] of Object.entries(EXPECTED_TEST_ENVIRONMENT.labels)) {
    if (labels[label] !== value) errors.push(`topology.labels.${label} must match the approved value`);
  }
  for (const [label, value] of Object.entries(labels)) {
    if (label.startsWith('com.merdn.') && !(label in EXPECTED_TEST_ENVIRONMENT.labels)) {
      errors.push(`topology.labels.${label} is not an approved label`);
    }
    if (containsForbiddenMarker(String(value))) {
      errors.push(`topology.labels.${label} is not an approved environment`);
    }
  }
  return errors;
}

/**
 * Valida el entorno de pruebas completo y devuelve la lista de incumplimientos.
 * `allowPlaceholders` solo habilita inspeccionar la plantilla versionada; no
 * relaja la identidad, ni la topologia, ni la correspondencia entre cada URL y sus
 * variables. El uso por defecto es ejecucion real, que rechaza toda plantilla y
 * exige topologia.
 */
export function validateTestEnvironment(env, options = {}) {
  const { allowPlaceholders = false, topology } = options;
  const errors = [];

  for (const key of REQUIRED_TEST_ENVIRONMENT_KEYS) {
    if (!readValue(env, key)) errors.push(`${key} is required`);
  }

  const runtimeRole = readValue(env, 'MERDN_RUNTIME_ROLE');
  if (runtimeRole && runtimeRole !== EXPECTED_TEST_ENVIRONMENT.runtimeRole) {
    errors.push('MERDN_RUNTIME_ROLE must be enforce');
  }

  const database = readValue(env, 'POSTGRES_DB');
  if (database && database !== EXPECTED_TEST_ENVIRONMENT.database) {
    errors.push('POSTGRES_DB must be the approved test database');
  }
  const adminUser = readValue(env, 'POSTGRES_USER');
  if (adminUser && adminUser !== EXPECTED_TEST_ENVIRONMENT.adminUser) {
    errors.push('POSTGRES_USER must be the approved test administrator');
  }
  const runtimeUser = readValue(env, 'MERDN_RUNTIME_DB_USER');
  if (runtimeUser && runtimeUser !== EXPECTED_TEST_ENVIRONMENT.runtimeUser) {
    errors.push('MERDN_RUNTIME_DB_USER must be the approved test runtime role');
  }
  if (adminUser && runtimeUser && adminUser === runtimeUser) {
    errors.push('test administrator and runtime identities must differ');
  }

  const adminPassword = readValue(env, ADMIN_PASSWORD_KEY);
  const runtimePassword = readValue(env, RUNTIME_PASSWORD_KEY);
  if (adminPassword && adminPassword.length < 12) {
    errors.push(`${ADMIN_PASSWORD_KEY} is too short to be a real credential`);
  }
  if (runtimePassword && runtimePassword.length < 12) {
    errors.push(`${RUNTIME_PASSWORD_KEY} is too short to be a real credential`);
  }
  if (adminPassword && runtimePassword && adminPassword === runtimePassword) {
    errors.push('test administrator and runtime credentials must differ');
  }
  if (rejectPlaceholder(adminPassword, { allowPlaceholders })) {
    errors.push(`${ADMIN_PASSWORD_KEY} carries a template placeholder, not an execution credential`);
  }
  if (rejectPlaceholder(runtimePassword, { allowPlaceholders })) {
    errors.push(`${RUNTIME_PASSWORD_KEY} carries a template placeholder, not an execution credential`);
  }

  const adminUrl = readValue(env, ADMIN_URL_KEY);
  const runtimeUrl = readValue(env, RUNTIME_URL_KEY);
  errors.push(
    ...validateTestDatabaseUrl(adminUrl, ADMIN_URL_KEY, {
      allowPlaceholders,
      expectedUser: adminUser,
      expectedPassword: adminPassword,
      userKey: 'POSTGRES_USER',
      passwordKey: ADMIN_PASSWORD_KEY,
    }),
  );
  errors.push(
    ...validateTestDatabaseUrl(runtimeUrl, RUNTIME_URL_KEY, {
      allowPlaceholders,
      expectedUser: runtimeUser,
      expectedPassword: runtimePassword,
      userKey: 'MERDN_RUNTIME_DB_USER',
      passwordKey: RUNTIME_PASSWORD_KEY,
    }),
  );
  if (adminUrl && runtimeUrl && adminUrl === runtimeUrl) {
    errors.push('administrator and runtime database URLs must differ');
  }

  for (const [key, value] of [
    ['POSTGRES_DB', database],
    ['POSTGRES_USER', adminUser],
    ['MERDN_RUNTIME_DB_USER', runtimeUser],
  ]) {
    if (containsForbiddenMarker(value)) errors.push(`${key} is not an approved environment`);
  }

  errors.push(...validateTestTopology(topology));
  return errors;
}

/**
 * Falla cerrada si el entorno no cumple el contrato. Devuelve un resumen seguro
 * (sin claves ni URLs) que los scripts posteriores pueden reutilizar.
 */
export function assertTestEnvironment(env, options = {}) {
  const errors = validateTestEnvironment(env, options);
  if (errors.length) {
    throw new Error(`Test environment guard failed: ${errors.join('; ')}`);
  }
  const topology = options.topology ?? {};
  return Object.freeze({
    project: topology.project ?? EXPECTED_TEST_ENVIRONMENT.project,
    service: topology.service ?? EXPECTED_TEST_ENVIRONMENT.service,
    database: EXPECTED_TEST_ENVIRONMENT.database,
    host: EXPECTED_TEST_ENVIRONMENT.host,
    port: EXPECTED_TEST_ENVIRONMENT.port,
    containerPort: EXPECTED_TEST_ENVIRONMENT.containerPort,
    network: topology.network ?? EXPECTED_TEST_ENVIRONMENT.network,
    volume: topology.volume ?? EXPECTED_TEST_ENVIRONMENT.volume,
    adminUser: EXPECTED_TEST_ENVIRONMENT.adminUser,
    runtimeUser: EXPECTED_TEST_ENVIRONMENT.runtimeUser,
    runtimeRole: EXPECTED_TEST_ENVIRONMENT.runtimeRole,
    labels: EXPECTED_TEST_ENVIRONMENT.labels,
  });
}

export function runTestEnvironmentGuard(env = process.env, options) {
  const identity = assertTestEnvironment(env, options);
  return `Test environment guard: PASS (project ${identity.project}, service ${identity.service}, database ${identity.database})`;
}

// Guarda de modulo principal portable: `file://` + ruta Windows produce
// `file://C:/...` y nunca coincide con `import.meta.url` (`file:///C:/...`).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  // eslint-disable-next-line no-console -- CLI de verificacion: la salida es la evidencia exigida.
  try { console.log(runTestEnvironmentGuard()); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
