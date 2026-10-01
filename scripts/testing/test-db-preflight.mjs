#!/usr/bin/env node
/**
 * SPEC 025 / MP08 - Preflight fail-closed de runtime y RLS de la baseline aislada.
 *
 * Comprueba, sobre el cluster desechable de pruebas, que el rol de runtime
 * `merdn_runtime` esta sujeto a las 26 tablas protegidas con RLS + FORCE, que el
 * catalogo coincide exactamente con la baseline aprobada y que el aislamiento por
 * tenant se sostiene en una UNICA transaccion que siempre termina en `ROLLBACK`.
 *
 * Este modulo fue escrito sin ejecutarse contra ninguna base. MP08 crea el
 * artefacto y sus contratos puros; levantar el cluster y correr el preflight es
 * un paquete posterior. Importar este archivo NO abre conexiones ni procesos.
 *
 * Decisiones de autoridad que implementa:
 *   - `spec/specs/025-baseline-pruebas-aislada/spec.md` secciones 4, 6, 8 y 15
 *   - handoff `TO-CLAUDE.md` v25, paquete MP08
 *
 * Garantias de diseno:
 *   - Sin dependencias nuevas. Reutiliza el guard de MP02 y los contratos
 *     exportados por el provisionador de MP07. No se duplican las listas de
 *     migraciones, tablas, conteo de policies, roles, tenant ni topologia.
 *   - Falla cerrado ante cualquier duda de identidad, conteo o conducta.
 *   - Sin shell: solo `runSql` del provisionador, con argv estatico.
 *   - Sin credenciales en argv ni en logs; los secretos se usan solo para redactar.
 *   - Evidencia minimizada: conteos y booleanos. Nunca URLs, claves, UUIDs de
 *     tenant, filas, SQL ni el objeto de entorno.
 *
 * Contrato hacia el runner MP13: `runRuntimeRlsPreflight` es la funcion principal
 * y `PREFLIGHT_LIMITS` / `PREFLIGHT_STAGES` son parte de la interfaz.
 */

import process from 'node:process';
import { pathToFileURL } from 'node:url';

import { assertTestEnvironment } from './test-environment-guard.mjs';
import {
  EXPECTED_POLICY_COUNT,
  EXPECTED_TEST_ENVIRONMENT,
  FICTIONAL_TENANT,
  PROVISION_LIMITS,
  PROTECTED_TABLES,
  REQUIRED_MIGRATIONS,
  TEST_OWNER_ROLE,
  assertLoopbackPublication,
  buildApprovedTestTopology,
  loadEnvFile,
  quoteLiteral,
  runSql,
  scrubSecrets,
} from './test-db-provision.mjs';

/**
 * Identidad, migraciones, tablas, roles y tenant se reexportan desde MP07 para
 * que el runner no importe dos modulos ni duplique listas congeladas.
 */
export { EXPECTED_POLICY_COUNT, EXPECTED_TEST_ENVIRONMENT, FICTIONAL_TENANT, PROTECTED_TABLES, REQUIRED_MIGRATIONS, TEST_OWNER_ROLE };

/**
 * Los 27 pares policy/tabla congelados por la spec 025 seccion 4.3. El
 * PROVISIONADOR solo expone el CONTEO (`EXPECTED_POLICY_COUNT`); los nombres
 * exactos no existian en ningun modulo, asi que se declaran aqui una sola vez y
 * se contrastan contra el conteo y contra `PROTECTED_TABLES` en
 * `validatePolicyBaseline()`, que es puro y no necesita base.
 */
export const RLS_POLICY_PAIRS = Object.freeze([
  Object.freeze({ policy: 'tenant_self', table: 'tenant' }),
  Object.freeze({ policy: 'territorial_unit_scope', table: 'territorial_unit' }),
  Object.freeze({ policy: 'person_tenant', table: 'person' }),
  Object.freeze({ policy: 'patient_tenant', table: 'patient' }),
  Object.freeze({ policy: 'patient_population_membership_tenant', table: 'patient_population_membership' }),
  Object.freeze({ policy: 'patient_address_tenant', table: 'patient_address' }),
  Object.freeze({ policy: 'consent_record_tenant', table: 'consent_record' }),
  Object.freeze({ policy: 'enrollment_session_tenant', table: 'enrollment_session' }),
  Object.freeze({ policy: 'audit_event_tenant_read', table: 'audit_event' }),
  Object.freeze({ policy: 'audit_event_tenant_append', table: 'audit_event' }),
  Object.freeze({ policy: 'institutional_identity_tenant', table: 'institutional_identity' }),
  Object.freeze({ policy: 'institutional_session_tenant', table: 'institutional_session' }),
  Object.freeze({ policy: 'professional_profile_tenant', table: 'professional_profile' }),
  Object.freeze({ policy: 'professional_affiliation_tenant', table: 'professional_affiliation' }),
  Object.freeze({ policy: 'care_assignment_tenant', table: 'care_assignment' }),
  Object.freeze({ policy: 'appointment_tenant', table: 'appointment' }),
  Object.freeze({ policy: 'human_account_tenant', table: 'human_account' }),
  Object.freeze({ policy: 'external_auth_identity_tenant', table: 'external_auth_identity' }),
  Object.freeze({ policy: 'human_session_tenant', table: 'human_session' }),
  Object.freeze({ policy: 'human_auth_attempt_tenant', table: 'human_auth_attempt' }),
  Object.freeze({ policy: 'patient_caregiver_relationship_tenant', table: 'patient_caregiver_relationship' }),
  Object.freeze({ policy: 'patient_caregiver_relationship_scope_tenant', table: 'patient_caregiver_relationship_scope' }),
  Object.freeze({ policy: 'home_visit_tenant', table: 'home_visit' }),
  Object.freeze({ policy: 'home_visit_transition_tenant', table: 'home_visit_transition' }),
  Object.freeze({ policy: 'platform_support_capability_home_tenant', table: 'platform_support_capability' }),
  Object.freeze({ policy: 'support_grant_home_tenant', table: 'support_grant' }),
  Object.freeze({ policy: 'support_context_session_home_tenant', table: 'support_context_session' }),
]);

/** Atributos de rol que deben ser `false` en runtime y en el owner de pruebas. */
const UNSAFE_ROLE_FLAGS = Object.freeze(['rolsuper', 'rolbypassrls', 'rolcreatedb', 'rolcreaterole', 'rolreplication']);

/** Etapas ordenadas. Un error siempre identifica en cual de ellas se produjo. */
export const PREFLIGHT_STAGES = Object.freeze([
  'policy-baseline',
  'env-file',
  'guard',
  'identity',
  'catalog',
  'tenant-before',
  'behavior',
  'tenant-after',
]);

/** Limites finitos. Ninguna espera puede ser indefinida y nada se reintenta. */
export const PREFLIGHT_LIMITS = Object.freeze({
  /** Tiempo maximo del preflight de catalogo, ms. */
  catalogTimeoutMs: 60_000,
  /** Tiempo maximo de la transaccion conductual, ms. */
  behaviorTimeoutMs: 120_000,
  /** Tiempo maximo por comando auxiliar, ms. */
  commandTimeoutMs: PROVISION_LIMITS.commandTimeoutMs,
  /** `statement_timeout` local de la transaccion conductual, ms. */
  statementTimeoutMs: 15_000,
  /** `lock_timeout` local de la transaccion conductual, ms. */
  lockTimeoutMs: 5_000,
  /** Nunca hay reintento automatico. */
  maxAttempts: 1,
});

/**
 * Constantes efimeras de la prueba conductual. Son identificadores
 * deterministas y obviamente sinteticos: viven dentro de la transaccion que
 * siempre hace `ROLLBACK` y NUNCA se reportan como evidencia. No se exportan
 * para que ninguna prueba pueda usarlos como identificador de un tenant real.
 *
 * `personCrossId` es exclusivo del INSERT cross-tenant. Debe ser distinto de
 * `personAId` y `personBId`: reutilizar uno de ellos haria que la sonda midiera
 * una violacion de primary key en vez de la denegacion de RLS que pretende
 * demostrar.
 */
const EPHEMERAL = Object.freeze({
  tenantAId: '00000000-0000-0000-0000-00000000a001',
  tenantBId: '00000000-0000-0000-0000-00000000b002',
  personAId: '00000000-0000-0000-0000-00000000a003',
  personBId: '00000000-0000-0000-0000-00000000b004',
  personCrossId: '00000000-0000-0000-0000-00000000c005',
  tenantACode: 'merdn-preflight-a',
  tenantBCode: 'merdn-preflight-b',
});

/** Etiquetas de las sondas conductuales leidas de la transaccion efimera. */
const BEHAVIOR_PROBES = Object.freeze([
  'no_context_person',
  'no_context_tenant',
  'tenant_a_person',
  'tenant_a_other_tenant',
  'tenant_a_visible_total',
  'tenant_a_tenant_rows',
  'cross_insert',
  'cross_update',
  'migrator_no_context',
]);

/** Error de preflight con mensaje sanitizado y etapa identificable. */
export class PreflightError extends Error {
  constructor(stage, detail) {
    super(`preflight failed at ${stage}: ${detail}`);
    this.name = 'PreflightError';
    this.stage = stage;
  }
}

// ---------------------------------------------------------------------------
// Constructores puros (verificables sin Docker ni PostgreSQL)
// ---------------------------------------------------------------------------

/**
 * Topologia esperada para el guard. Se deriva de la identidad aprobada, no se
 * vuelve a escribir: asi el guard y este modulo no pueden divergir.
 *
 * Delega en la funcion pura de MP07, que construye la topologia COMPLETA. Los
 * labels aprobados son obligatorios: `validateTestTopology` rechaza cualquier
 * `topology` sin ellos y el preflight fallaria cerrado en la etapa `guard` antes
 * de abrir proceso o conexion. Se conserva este export por compatibilidad con
 * el runner y las pruebas existentes.
 */
export function buildApprovedTopology() {
  return buildApprovedTestTopology();
}

/** Lista SQL de identificadores, derivada de `PROTECTED_TABLES`. */
function tableListSql() {
  return PROTECTED_TABLES.map((name) => quoteLiteral(name)).join(', ');
}

/**
 * Valida la linea base de policies declarada en este modulo contra el conteo
 * aprovado en MP07 y contra las 26 tablas. Es puro: si la spec y el
 * provisionador dejaran de coincidir, el preflight se detiene ANTES de abrir
 * una conexion en lugar de afirmar un catalogo que no existe.
 */
export function validatePolicyBaseline() {
  const problems = [];
  if (RLS_POLICY_PAIRS.length !== EXPECTED_POLICY_COUNT) {
    problems.push(`los pares policy/tabla declarados (${RLS_POLICY_PAIRS.length}) no coinciden con el conteo aprobado`);
  }
  const names = new Set(RLS_POLICY_PAIRS.map((pair) => pair.policy));
  if (names.size !== RLS_POLICY_PAIRS.length) problems.push('hay nombres de policy duplicados');
  const tables = new Set(PROTECTED_TABLES);
  for (const pair of RLS_POLICY_PAIRS) {
    if (!tables.has(pair.table)) problems.push(`policy sobre tabla no protegida: ${pair.policy}`);
  }
  return Object.freeze({ policyCount: RLS_POLICY_PAIRS.length, tableCount: PROTECTED_TABLES.length, problems });
}

/**
 * SQL de solo lectura del catalogo. Una linea etiquetada por metrica, para que el
 * parseo no dependa de alinear columnas ni del ancho de las filas.
 *
 * El puerto NO se consulta aqui: `runSql` se ejecuta dentro del contenedor de
 * pruebas, por socket local o por el puerto interno del servicio, asi que
 * `inet_server_port()` jamas es el puerto host aprobado. La publicacion externa
 * se verifica con `assertLoopbackPublication` del provisionador, que lee la
 * configuracion efectiva de Compose.
 */
export function buildCatalogSql() {
  const tables = tableListSql();
  const roles = [EXPECTED_TEST_ENVIRONMENT.runtimeUser, TEST_OWNER_ROLE];
  const roleSelects = roles
    .map((role) => {
      // Concatenación con `||`: una coma separaría COLUMNAS y psql las
      // imprimiría con su propio separador, rompiendo el formato de una sola
      // línea etiquetada que el parser espera.
      const flags = UNSAFE_ROLE_FLAGS.map((flag) => `coalesce(r.${flag}, false)::text`).join(" || '|' || ");
      return `SELECT 'role|' || ${quoteLiteral(role)} || '|' || coalesce(r.rolcanlogin::text, 'missing') || '|' || ${flags}
  FROM pg_roles r WHERE r.rolname = ${quoteLiteral(role)};`;
    })
    .join('\n');

  return `
SELECT 'server|' || current_database() || '|' || current_user || '|' || current_setting('server_version_num');
SELECT 'schema_create|' || has_schema_privilege(${quoteLiteral(EXPECTED_TEST_ENVIRONMENT.runtimeUser)}, 'public', 'CREATE')::text;
SELECT 'runtime_owned_tables|' || count(*)::text
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace JOIN pg_roles r ON r.oid = c.relowner
 WHERE n.nspname = 'public' AND c.relkind = 'r' AND r.rolname = ${quoteLiteral(EXPECTED_TEST_ENVIRONMENT.runtimeUser)};
SELECT 'owner_protected_tables|' || count(*)::text
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace JOIN pg_roles r ON r.oid = c.relowner
 WHERE n.nspname = 'public' AND c.relkind = 'r' AND r.rolname = ${quoteLiteral(TEST_OWNER_ROLE)} AND c.relname IN (${tables});
${roleSelects}
SELECT 'table|' || c.relname || '|' || c.relrowsecurity::text || '|' || c.relforcerowsecurity::text || '|' || coalesce(r.rolname, 'unknown')
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  LEFT JOIN pg_roles r ON r.oid = c.relowner
 WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname IN (${tables})
 ORDER BY c.relname;
SELECT 'policy|' || policyname || '|' || tablename
  FROM pg_policies
 WHERE schemaname = 'public' AND tablename IN (${tables})
 ORDER BY policyname, tablename;
SELECT 'fictional_tenant|' || count(*)::text FROM public.tenant WHERE code = ${quoteLiteral(FICTIONAL_TENANT)};
`.trim();
}

/**
 * Parseo puro de la salida del catalogo. Tolera lineas vacias y no lanza ante
 * una salida inesperada: devuelve conteos y banderas, y la evaluacion separada
 * decide si eso es aceptable.
 */
export function parseCatalogOutput(stdout) {
  const tables = new Map();
  const policies = [];
  const roles = new Map();
  const metrics = new Map();
  let server = null;
  let schemaCreate = null;
  let fictionalTenant = null;

  for (const rawLine of String(stdout ?? '').split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (line === '') continue;
    const parts = line.split('|');
    switch (parts[0]) {
      case 'server':
        server = Object.freeze({ database: parts[1] ?? '', user: parts[2] ?? '', versionNum: parts[3] ?? '' });
        break;
      case 'schema_create':
        schemaCreate = parts[1] === 'true';
        break;
      case 'role': {
        const [, name, canLogin, ...flags] = parts;
        const unsafe = UNSAFE_ROLE_FLAGS.filter((flag, index) => flags[index] !== 'false').map((flag) => flag);
        roles.set(name, Object.freeze({ present: true, canLogin: canLogin === 'true', unsafeFlags: Object.freeze(unsafe) }));
        break;
      }
      case 'table':
        tables.set(parts[1] ?? '', Object.freeze({ rls: parts[2] === 'true', force: parts[3] === 'true', owner: parts[4] ?? '' }));
        break;
      case 'policy':
        policies.push(Object.freeze({ policy: parts[1] ?? '', table: parts[2] ?? '' }));
        break;
      case 'fictional_tenant':
        fictionalTenant = Number(parts[1]);
        break;
      default:
        metrics.set(parts[0], parts.slice(1));
    }
  }

  return Object.freeze({
    server,
    schemaCreate,
    roles,
    tables,
    policies: Object.freeze(policies),
    fictionalTenantCount: fictionalTenant,
    metrics,
  });
}

/**
 * Evaluacion pura del catalogo. Devuelve problemas en vez de lanzar, para que
 * una prueba pueda comprobar el parser sin base. Los mensajes nombran tabla,
 * policy o rol, nunca valores de entorno.
 */
export function evaluateCatalog(parsed) {
  const problems = [];
  const server = parsed.server;
  if (!server) {
    problems.push('la consulta de servidor no devolvio datos');
  } else {
    if (server.database !== EXPECTED_TEST_ENVIRONMENT.database) problems.push('la base conectada no es la base de pruebas aprobada');
    if (server.user !== EXPECTED_TEST_ENVIRONMENT.adminUser) problems.push('la conexion no usa el administrador aprobado');
    if (!/^\d+$/u.test(server.versionNum) || Number(server.versionNum) < 170000) problems.push('version de PostgreSQL no aprobada');
  }

  for (const role of [EXPECTED_TEST_ENVIRONMENT.runtimeUser, TEST_OWNER_ROLE]) {
    const found = parsed.roles.get(role);
    if (!found) {
      problems.push(`el rol ${role} no existe en el catalogo`);
      continue;
    }
    if (found.unsafeFlags.length > 0) problems.push(`el rol ${role} tiene atributos inseguros: ${found.unsafeFlags.join(', ')}`);
    if (role === TEST_OWNER_ROLE && found.canLogin) problems.push('el owner de pruebas no debe poder iniciar sesion');
  }

  if (parsed.metrics.get('runtime_owned_tables')?.[0] !== '0') problems.push('el rol runtime es propietario de alguna tabla');
  if (parsed.metrics.get('owner_protected_tables')?.[0] !== String(PROTECTED_TABLES.length)) {
    problems.push('el owner de pruebas no es propietario de las 26 tablas aprobadas');
  }
  if (parsed.schemaCreate !== false) problems.push('el rol runtime tiene CREATE en el schema public');

  const missingTables = [];
  const notForced = [];
  const wrongOwner = [];
  for (const name of PROTECTED_TABLES) {
    const found = parsed.tables.get(name);
    if (!found) {
      missingTables.push(name);
      continue;
    }
    if (!found.rls || !found.force) notForced.push(name);
    if (found.owner !== TEST_OWNER_ROLE) wrongOwner.push(name);
  }
  if (missingTables.length > 0) problems.push(`tablas protegidas ausentes: ${missingTables.slice(0, 5).join(', ')}`);
  if (notForced.length > 0) problems.push(`tablas sin RLS+FORCE: ${notForced.slice(0, 5).join(', ')}`);
  if (wrongOwner.length > 0) problems.push(`tablas con owner inesperado: ${wrongOwner.slice(0, 5).join(', ')}`);

  const expectedPairs = new Set(RLS_POLICY_PAIRS.map((pair) => `${pair.policy}::${pair.table}`));
  const observedPairs = new Set(parsed.policies.map((pair) => `${pair.policy}::${pair.table}`));
  const missingPolicies = [...expectedPairs].filter((key) => !observedPairs.has(key));
  const extraPolicies = [...observedPairs].filter((key) => !expectedPairs.has(key));
  if (parsed.policies.length !== EXPECTED_POLICY_COUNT) problems.push('el conteo de policies no coincide con el aprobado');
  if (missingPolicies.length > 0) problems.push(`policies ausentes: ${missingPolicies.slice(0, 5).join(', ')}`);
  if (extraPolicies.length > 0) problems.push(`policies inesperadas: ${extraPolicies.slice(0, 5).join(', ')}`);

  if (parsed.fictionalTenantCount !== 1) problems.push('el tenant ficticio no es exactamente uno');

  return Object.freeze({
    problems: Object.freeze(problems),
    counts: Object.freeze({
      tables: parsed.tables.size,
      policies: parsed.policies.length,
      roles: parsed.roles.size,
      migrations: REQUIRED_MIGRATIONS.length,
    }),
  });
}

/** `BEGIN` + sonda `SET LOCAL ROLE` + sonda `RESET ROLE`, para pruebas puras de forma. */
function roleProbe(role, body) {
  return [
    'RESET ROLE;',
    `SET LOCAL ROLE ${role};`,
    body,
  ].join('\n');
}

/**
 * SQL de la prueba conductual. Es UNA sola transaccion que termina SIEMPRE en
 * `ROLLBACK`: los resultados se acumulan en GUCs de alcance transaccional, que
 * `ROLLBACK` descarta junto con las filas. Si una sonda aborta la sesion, el
 * cierre de la conexion revierte igual, de modo que no puede quedar rastro.
 *
 * El administrador prepara los fixtures ficticios ANTES de cambiar de rol, y la
 * evidencia de comportamiento se produce unicamente bajo `merdn_runtime` y
 * `merdn_test_migrator`: nunca con superuser ni con BYPASSRLS.
 */
export function buildBehaviorSql() {
  const a = EPHEMERAL;
  return `
\\pset format unaligned
\\pset tuples_only on
\\pset footer off
BEGIN;
SET LOCAL lock_timeout = '${PREFLIGHT_LIMITS.lockTimeoutMs}ms';
SET LOCAL statement_timeout = '${PREFLIGHT_LIMITS.statementTimeoutMs}ms';

INSERT INTO public.tenant (id, code, name, "updatedAt")
VALUES (${quoteLiteral(a.tenantAId)}::uuid, ${quoteLiteral(a.tenantACode)}, 'PREFLIGHT A EFIMERA', now()),
       (${quoteLiteral(a.tenantBId)}::uuid, ${quoteLiteral(a.tenantBCode)}, 'PREFLIGHT B EFIMERA', now());

INSERT INTO public.person (id, "tenantId", "documentType", "documentNumber", "documentNumberNormalized", "givenNames", "familyNames", "birthDate", "sexGenderCode", "updatedAt")
VALUES (${quoteLiteral(a.personAId)}::uuid, ${quoteLiteral(a.tenantAId)}::uuid, 'OTRO', 'PF-A-0001', 'pf-a-0001', 'PREFLIGHT', 'A', DATE '1990-01-01', 'PREFIERE_NO_DECIRLO', now()),
       (${quoteLiteral(a.personBId)}::uuid, ${quoteLiteral(a.tenantBId)}::uuid, 'OTRO', 'PF-B-0001', 'pf-b-0001', 'PREFLIGHT', 'B', DATE '1990-01-01', 'PREFIERE_NO_DECIRLO', now());

${roleProbe(
  EXPECTED_TEST_ENVIRONMENT.runtimeUser,
  `DO $probe$ BEGIN
  PERFORM set_config('merdn.preflight.no_context_person', (SELECT count(*)::text FROM public.person), true);
  PERFORM set_config('merdn.preflight.no_context_tenant', (SELECT count(*)::text FROM public.tenant), true);
END $probe$;`,
)}

${roleProbe(
  EXPECTED_TEST_ENVIRONMENT.runtimeUser,
  `SELECT set_config('merdn.tenant_id', ${quoteLiteral(a.tenantAId)}, true);
DO $probe$ BEGIN
  PERFORM set_config('merdn.preflight.tenant_a_person', (SELECT count(*)::text FROM public.person), true);
  PERFORM set_config('merdn.preflight.tenant_a_visible_total', (SELECT count(*)::text FROM public.person), true);
  PERFORM set_config('merdn.preflight.tenant_a_other_tenant', (SELECT count(*)::text FROM public.person WHERE "tenantId" <> ${quoteLiteral(a.tenantAId)}::uuid), true);
  PERFORM set_config('merdn.preflight.tenant_a_tenant_rows', (SELECT count(*)::text FROM public.tenant), true);
END $probe$;`,
)}

${roleProbe(
  EXPECTED_TEST_ENVIRONMENT.runtimeUser,
  `  DO $probe$ BEGIN
  BEGIN
    INSERT INTO public.person (id, "tenantId", "documentType", "documentNumber", "documentNumberNormalized", "givenNames", "familyNames", "birthDate", "sexGenderCode", "updatedAt")
    VALUES (${quoteLiteral(a.personCrossId)}::uuid, ${quoteLiteral(a.tenantBId)}::uuid, 'OTRO', 'PF-C-0001', 'pf-c-0001', 'PREFLIGHT', 'C', DATE '1990-01-01', 'PREFIERE_NO_DECIRLO', now());
    PERFORM set_config('merdn.preflight.cross_insert', 'allowed', true);
  EXCEPTION WHEN insufficient_privilege THEN
    PERFORM set_config('merdn.preflight.cross_insert', 'denied', true);
  END;
  UPDATE public.person SET "givenNames" = 'PREFLIGHT-X' WHERE id = ${quoteLiteral(a.personBId)}::uuid;
  PERFORM set_config('merdn.preflight.cross_update', (SELECT count(*)::text FROM public.person WHERE "givenNames" = 'PREFLIGHT-X'), true);
END $probe$;`,
)}

${roleProbe(
  TEST_OWNER_ROLE,
  `DO $probe$ BEGIN
  PERFORM set_config('merdn.preflight.migrator_no_context', (SELECT count(*)::text FROM public.person), true);
END $probe$;`,
)}

RESET ROLE;
${BEHAVIOR_PROBES.map(
  (probe) => `SELECT 'probe|${probe}|' || coalesce(current_setting('merdn.preflight.${probe}', true), 'unset');`,
).join('\n')}
ROLLBACK;
`;
}

/** Parseo puro de las sondas conductuales. */
export function parseBehaviorOutput(stdout) {
  const probes = new Map();
  for (const rawLine of String(stdout ?? '').split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (line === '') continue;
    const parts = line.split('|');
    if (parts[0] !== 'probe') continue;
    probes.set(parts[1] ?? '', parts.slice(2).join('|'));
  }
  return Object.freeze({ probes });
}

/** Evaluacion pura de la conducta. Devuelve problemas en vez de lanzar. */
export function evaluateBehavior(parsed) {
  const problems = [];
  const value = (name) => parsed.probes.get(name) ?? 'unset';
  const expectCount = (name, expected, description) => {
    if (value(name) !== String(expected)) problems.push(`${description}: resultado inesperado`);
  };

  expectCount('no_context_person', 0, 'el runtime sin contexto no debe ver personas');
  expectCount('no_context_tenant', 0, 'el runtime sin contexto no debe ver tenants');
  expectCount('tenant_a_person', 1, 'el runtime con contexto A solo debe ver lo suyo');
  expectCount('tenant_a_visible_total', 1, 'el runtime con contexto A no debe ver filas de B');
  expectCount('tenant_a_other_tenant', 0, 'el runtime con contexto A no debe alcanzar el tenant B');
  expectCount('tenant_a_tenant_rows', 1, 'el runtime con contexto A solo debe ver su propio tenant');
  if (value('cross_insert') !== 'denied') problems.push('el INSERT hacia otro tenant no fue denegado por la policy');
  expectCount('cross_update', 0, 'el UPDATE hacia otro tenant no debe afectar filas');
  expectCount('migrator_no_context', 0, 'el owner de pruebas sujeto a FORCE no debe eludir RLS');

  return Object.freeze({
    problems: Object.freeze(problems),
    outcomes: Object.freeze({
      noContextDenied: value('no_context_person') === '0' && value('no_context_tenant') === '0',
      tenantAIsolated: value('tenant_a_visible_total') === '1' && value('tenant_a_other_tenant') === '0',
      crossTenantInsertDenied: value('cross_insert') === 'denied',
      crossTenantUpdateNoRows: value('cross_update') === '0',
      migratorForceEnforced: value('migrator_no_context') === '0',
    }),
  });
}

/**
 * Evidencia minimizada y congelada. Solo conteos, booleanos y nombres de rol,
 * tabla o policy. Nunca URLs, claves, UUIDs, filas, SQL ni el entorno.
 */
export function buildPreflightEvidence({ runId, catalog, behavior, durationMs, tenantBefore, tenantAfter }) {
  return Object.freeze({
    runId,
    project: EXPECTED_TEST_ENVIRONMENT.project,
    database: EXPECTED_TEST_ENVIRONMENT.database,
    runtimeRole: EXPECTED_TEST_ENVIRONMENT.runtimeUser,
    ownerRole: TEST_OWNER_ROLE,
    migrations: REQUIRED_MIGRATIONS.length,
    catalog: Object.freeze({
      tables: catalog.counts.tables,
      policies: catalog.counts.policies,
      forceEnforced: catalog.problems.length === 0,
      runtimeIsOwner: false,
      runtimeHasSchemaCreate: false,
      ownerHoldsAllProtectedTables: catalog.problems.length === 0,
    }),
    tenant: Object.freeze({ code: FICTIONAL_TENANT, before: tenantBefore, after: tenantAfter }),
    behavior: Object.freeze(behavior),
    durationMs,
  });
}

/** Conteo del tenant ficticio, reutilizado al inicio y al final. */
async function readFictionalTenantCount(envFilePath, secrets, stage) {
  const out = await runSql(
    envFilePath,
    `SELECT count(*)::text FROM public.tenant WHERE code = ${quoteLiteral(FICTIONAL_TENANT)};`,
    secrets,
    { readOnly: true },
  );
  const count = Number(out.trim());
  if (!Number.isInteger(count)) throw new PreflightError(stage, 'el conteo del tenant ficticio no es legible');
  return count;
}

// ---------------------------------------------------------------------------
// Funcion principal
// ---------------------------------------------------------------------------

/**
 * Ejecuta el preflight completo. Es la unica funcion que abre procesos.
 *
 * @param {object} options
 * @param {string} options.envFilePath Ruta explicita del `.env` local. Obligatoria.
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<object>} Evidencia minimizada.
 */
export async function runRuntimeRlsPreflight(options = {}) {
  const { envFilePath, signal } = options;
  const startedAt = Date.now();
  const runId = `preflight-${startedAt.toString(36)}`;

  // 1. La linea base declarada se valida antes de cualquier entrada al sistema.
  const baseline = validatePolicyBaseline();
  if (baseline.problems.length > 0) {
    throw new PreflightError('policy-baseline', baseline.problems.join('; '));
  }

  // 2. El env-file es explicito y nunca se deduce de `.env` implicito.
  const env = await loadEnvFile(envFilePath);

  // 3. El guard anti-entorno se pasa ANTES de abrir proceso o conexion.
  assertTestEnvironment(env, { topology: buildApprovedTopology() });
  if (signal?.aborted) throw new PreflightError('guard', 'aborted by signal');

  const secrets = [
    env.TEST_DATABASE_ADMIN_URL,
    env.TEST_DATABASE_RUNTIME_URL,
    env.POSTGRES_PASSWORD,
    env.MERDN_RUNTIME_DB_PASSWORD,
  ];

  try {
    // 4. Publicacion loopback efectiva. Se delega al provisionador porque el
    //    puerto que ve `psql` dentro del contenedor no es el puerto host, y solo
    //    Compose sabe si el puerto aprobado quedo publicado en loopback.
    const publication = await assertLoopbackPublication(envFilePath, secrets);
    if (publication.host !== EXPECTED_TEST_ENVIRONMENT.host || publication.port !== EXPECTED_TEST_ENVIRONMENT.port) {
      throw new PreflightError('identity', 'la publicacion del puerto no es loopback en el puerto aprobado');
    }

    // 5. Catalogo de solo lectura: identidad, roles, owners, 26/27 y tenant.
    const catalogOut = await runSql(envFilePath, buildCatalogSql(), secrets, { readOnly: true });
    const catalog = evaluateCatalog(parseCatalogOutput(catalogOut));
    if (catalog.problems.length > 0) {
      throw new PreflightError('catalog', catalog.problems.slice(0, 5).join('; '));
    }

    const tenantBefore = await readFictionalTenantCount(envFilePath, secrets, 'tenant-before');

    // 6. Conducta: una transaccion, siempre ROLLBACK, sin dejar rastro.
    const behaviorOut = await runSql(envFilePath, buildBehaviorSql(), secrets);
    const behavior = evaluateBehavior(parseBehaviorOutput(behaviorOut));
    if (behavior.problems.length > 0) {
      throw new PreflightError('behavior', behavior.problems.slice(0, 5).join('; '));
    }

    // 7. El tenant ficticio debe seguir siendo exactamente uno: prueba de que
    //    la transaccion conductual no dejo datos.
    const tenantAfter = await readFictionalTenantCount(envFilePath, secrets, 'tenant-after');
    if (tenantAfter !== tenantBefore) {
      throw new PreflightError('tenant-after', 'la prueba conductual altero el conteo del tenant ficticio');
    }

    return buildPreflightEvidence({
      runId,
      catalog,
      behavior: behavior.outcomes,
      durationMs: Date.now() - startedAt,
      tenantBefore,
      tenantAfter,
    });
  } catch (error) {
    if (error instanceof PreflightError) throw error;
    throw new PreflightError('unknown', scrubSecrets(error?.message ?? 'fallo desconocido', secrets));
  }
}

export default runRuntimeRlsPreflight;

// Guarda de modulo principal portable: `file://` + ruta Windows nunca coincide
// con `import.meta.url`. Importar el archivo NO ejecuta nada.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  // eslint-disable-next-line no-console -- CLI de verificacion: la salida es la evidencia exigida.
  console.error('test-db-preflight.mjs es un artefacto reutilizable. Invocalo desde el runner aprobado; no opera por si mismo.');
  process.exitCode = 2;
}
