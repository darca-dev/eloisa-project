import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { PINNED_IMAGE_KEYS, runPreflight, validateStagingEnvironment } from '../../scripts/staging/preflight.mjs';
import { verifyRuntimeDatabase } from '../../scripts/staging/runtime-db-check.mjs';
import { runSmoke, SMOKE_PATHS } from '../../scripts/staging/smoke.mjs';

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
/** Aplana saltos de linea para que las aserciones no dependan del ancho de columna. */
const flat = (text: string) => text.replace(/\s+/gu, ' ');

const compose = read('compose.staging.yml');
const caddyfile = read('infra/staging/Caddyfile');
const envTemplate = read('.env.staging.example');
const runbook = read('docs/runbooks/STAGING_DEPLOYMENT.md');
const spec = read('spec/specs/023-staging-controlado-hostinger/spec.md');
const gitignore = read('.gitignore');
const backupScript = read('scripts/staging/backup-postgres.ps1');
const initScript = read('infra/staging/init/10-keycloak-database.sh');
const restoreScript = read('scripts/staging/restore-postgres.ps1');

/** Divide `services:` en bloques por servicio para razonar sobre puertos y redes. */
function serviceBlocks(text: string): Record<string, string> {
  const body = text.slice(text.indexOf('\nservices:\n'), text.indexOf('\nnetworks:\n'));
  const blocks: Record<string, string> = {};
  let current = '';
  for (const line of body.split('\n')) {
    const header = /^ {2}([a-z][\w-]*):$/u.exec(line);
    if (header) { current = header[1]; blocks[current] = ''; continue; }
    if (current) blocks[current] += `${line}\n`;
  }
  return blocks;
}

/** Pares clave/valor del template, ignorando comentarios y lineas vacias. */
function templateEntries(): [string, string][] {
  return envTemplate.split('\n')
    .filter((line) => line.includes('=') && !line.trimStart().startsWith('#'))
    .map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]);
}

const services = serviceBlocks(compose);
/** Servicios sin ninguna salida: siguen exclusivamente en `internal`. */
const internalOnlyServices = ['postgres', 'oidc', 'web'];
/** Ningun servicio salvo Caddy puede publicar un puerto de host. */
const unpublishedServices = ['postgres', 'oidc', 'api', 'web'];

const validEnv = {
  DATABASE_URL: 'postgresql://owner:fictitious-not-a-secret@db/app',
  RUNTIME_DATABASE_URL: 'postgresql://merdn_runtime:fictitious-not-a-secret@db/app',
  MERDN_RUNTIME_ROLE: 'enforce',
  MERDN_STAGING_DOMAIN: 'stage.test',
  MERDN_OIDC_DOMAIN: 'id.test',
  MERDN_TLS_CONTACT_EMAIL: 'staging-operator@merdn.test',
  MERDN_API_IMAGE: 'repo/api@sha256:abc',
  MERDN_WEB_IMAGE: 'repo/web@sha256:def',
  MERDN_OIDC_IMAGE: 'repo/oidc@sha256:012',
  MERDN_OIDC_DATABASE_NAME: 'merdn_oidc',
  MERDN_OIDC_DATABASE_USER: 'merdn_oidc',
  MERDN_OIDC_DATABASE_PASSWORD: 'fictitious-not-a-secret',
  MERDN_ACTIVE_TENANT_CODE: 'fictional-staging-tenant',
  MERDN_ACTIVE_TENANT_ID: '00000000-0000-4000-8000-000000000001',
};

describe('staging preflight', () => {
  it('accepts separated immutable configuration', () => expect(validateStagingEnvironment(validEnv)).toEqual([]));
  it.each(['DATABASE_URL', 'RUNTIME_DATABASE_URL', 'MERDN_STAGING_DOMAIN', 'MERDN_TLS_CONTACT_EMAIL', 'MERDN_OIDC_IMAGE', 'MERDN_OIDC_DATABASE_NAME', 'MERDN_OIDC_DATABASE_USER', 'MERDN_OIDC_DATABASE_PASSWORD'])('fails closed without %s', (key) => expect(() => runPreflight({ ...validEnv, [key]: '' })).toThrow(key));
  it('rejects identical URLs', () => expect(validateStagingEnvironment({ ...validEnv, RUNTIME_DATABASE_URL: validEnv.DATABASE_URL })).toContain('migration and runtime database credentials must differ'));
  it('rejects disabled runtime enforcement', () => expect(validateStagingEnvironment({ ...validEnv, MERDN_RUNTIME_ROLE: 'disabled' })).toContain('MERDN_RUNTIME_ROLE must be enforce'));
  it('does not leak URL secrets', () => { try { runPreflight({ ...validEnv, MERDN_API_IMAGE: 'floating' }); } catch (error) { expect(String(error)).not.toContain('fictitious-not-a-secret'); } });
  it('rejects an empty environment instead of passing silently', () => expect(() => runPreflight({})).toThrow('Staging preflight failed'));

  // Correccion 5 — la imagen OIDC queda bajo el mismo estandar inmutable que API y web.
  it('pins every staging image, OIDC included', () => expect(PINNED_IMAGE_KEYS).toEqual(['MERDN_API_IMAGE', 'MERDN_WEB_IMAGE', 'MERDN_OIDC_IMAGE']));
  it.each(PINNED_IMAGE_KEYS)('rejects a floating %s tag', (key: string) => expect(validateStagingEnvironment({ ...validEnv, [key]: 'registry.test/image:latest' })).toContain(`${key} must use an immutable digest`));

  // Correccion 4 — contacto ACME obligatorio, jamas el fallback `off`.
  it.each(['off', 'not-an-email', ' '])('rejects the TLS contact %j', (value) => expect(() => runPreflight({ ...validEnv, MERDN_TLS_CONTACT_EMAIL: value })).toThrow('MERDN_TLS_CONTACT_EMAIL'));
  // Correccion B — identidad de base de datos aislada para Keycloak.
  it('rejects a placeholder OIDC database password', () => expect(validateStagingEnvironment({ ...validEnv, MERDN_OIDC_DATABASE_PASSWORD: 'REPLACE-fictitious-not-a-secret' })).toContain('MERDN_OIDC_DATABASE_PASSWORD contains a placeholder'));
  it('rejects a short OIDC database password', () => expect(validateStagingEnvironment({ ...validEnv, MERDN_OIDC_DATABASE_PASSWORD: 'short' })).toContain('MERDN_OIDC_DATABASE_PASSWORD is too short for staging'));
  it.each(['merdn_runtime', 'merdn_migrator', 'postgres'])('rejects %s as the Keycloak role', (role) => expect(validateStagingEnvironment({ ...validEnv, MERDN_OIDC_DATABASE_USER: role })).toContain('MERDN_OIDC_DATABASE_USER must not reuse a reserved application role'));
  it('rejects reusing the migrator role', () => expect(validateStagingEnvironment({ ...validEnv, POSTGRES_USER: 'merdn_owner', MERDN_OIDC_DATABASE_USER: 'merdn_owner' })).toContain('MERDN_OIDC_DATABASE_USER must not reuse the migrator role'));
  it('rejects reusing the application database', () => expect(validateStagingEnvironment({ ...validEnv, POSTGRES_DB: 'merdn_staging', MERDN_OIDC_DATABASE_NAME: 'merdn_staging' })).toContain('MERDN_OIDC_DATABASE_NAME must not reuse the application database'));
  it.each(['Merdn-OIDC', '1oidc', 'oidc; DROP TABLE x'])('rejects the unsafe identifier %j', (value) => expect(validateStagingEnvironment({ ...validEnv, MERDN_OIDC_DATABASE_USER: value })).toContain('MERDN_OIDC_DATABASE_USER is not a safe SQL identifier'));
  it('never echoes the OIDC database password', () => {
    try { runPreflight({ ...validEnv, MERDN_OIDC_DATABASE_PASSWORD: 'sup3r-s3cret-value', MERDN_API_IMAGE: 'floating' }); } catch (error) { expect(String(error)).not.toContain('sup3r-s3cret-value'); }
  });
  it('rejects the TLS contact placeholder shipped in the template', () => expect(validateStagingEnvironment({ ...validEnv, MERDN_TLS_CONTACT_EMAIL: 'REPLACE_TLS_CONTACT@example.invalid' })).toContain('MERDN_TLS_CONTACT_EMAIL contains a placeholder'));

  // Spec 024 — la pareja confiable id + codigo del tenant activo viaja completa.
  it.each(['MERDN_ACTIVE_TENANT_CODE', 'MERDN_ACTIVE_TENANT_ID'])('fails closed without %s', (key) => expect(() => runPreflight({ ...validEnv, [key]: '' })).toThrow(key));
  it('rejects the tenant identifier placeholder shipped in the template', () => expect(validateStagingEnvironment({ ...validEnv, MERDN_ACTIVE_TENANT_ID: 'REPLACE_WITH_TENANT_UUID' })).toContain('MERDN_ACTIVE_TENANT_ID contains a placeholder'));
  it.each(['merdn-mvp', '00000000000040008000000000000001', 'not-a-uuid'])('rejects the malformed tenant identifier %j', (value) => expect(validateStagingEnvironment({ ...validEnv, MERDN_ACTIVE_TENANT_ID: value })).toContain('MERDN_ACTIVE_TENANT_ID must be a canonical UUID'));
  it('never echoes the tenant identifier in an error', () => {
    try { runPreflight({ ...validEnv, MERDN_ACTIVE_TENANT_ID: '11111111-2222-4333-8444-555555555555', MERDN_API_IMAGE: 'floating' }); } catch (error) { expect(String(error)).not.toContain('11111111-2222-4333-8444-555555555555'); }
  });
  it('requires the staging template to declare the tenant identifier', () => expect(envTemplate).toContain('MERDN_ACTIVE_TENANT_ID='));
  it('passes the tenant identifier to the staging API service', () => expect(flat(services['api'] ?? '')).toContain('MERDN_ACTIVE_TENANT_ID: ${MERDN_ACTIVE_TENANT_ID:?required}'));
});

describe('standalone compose authority', () => {
  // Correccion 1 — `compose.staging.yml` no es un overlay de `compose.yml`.
  it('declares itself standalone and names the authoritative command', () => {
    expect(compose).toContain('standalone');
    expect(compose).toContain('docker compose -f compose.staging.yml config');
  });
  it('is documented as standalone in the runbook', () => {
    expect(runbook).toContain('-f compose.staging.yml config');
    expect(runbook).not.toContain('-f compose.yml -f compose.staging.yml');
  });
  it('is accepted as standalone by the spec', () => {
    expect(spec).toContain('`docker compose -f compose.staging.yml config`');
    expect(spec).not.toContain('docker compose -f compose.yml -f compose.staging.yml');
  });
  it('never builds: staging runs immutable images only', () => expect(compose).not.toMatch(/^\s*build:/mu));
});

describe('staging network and port boundary', () => {
  // Correccion 3 — Caddy necesita salida ACME sin abrir el resto de la topologia.
  it('keeps an internal network with no egress', () => expect(compose).toMatch(/^ {2}internal:\n {4}internal: true$/mu));
  it('adds a non-internal edge network for ACME', () => expect(compose).toMatch(/^ {2}edge:\n {4}internal: false$/mu));
  it('attaches every service to the expected networks', () => {
    const attachments = Object.fromEntries(Object.entries(services).map(([name, block]) => [name, /^ {4}networks: \[([^\]]+)\]$/mu.exec(block)?.[1].split(',').map((n) => n.trim())]));
    expect(attachments).toEqual({ postgres: ['internal'], oidc: ['internal'], api: ['internal', 'edge'], web: ['internal'], caddy: ['edge', 'internal'] });
  });
  it.each(internalOnlyServices)('gives %s no route out of internal', (name) => expect(services[name]).not.toContain('edge'));
  it.each(unpublishedServices)('publishes no host port for %s', (name) => expect(services[name]).not.toMatch(/^\s*ports:/mu));

  // Correccion A — la API necesita salida HTTPS/DNS hacia el emisor OIDC publico.
  it('attaches the API to internal and edge only', () => expect(/^ {4}networks: \[([^\]]+)\]$/mu.exec(services.api)?.[1].split(',').map((n) => n.trim())).toEqual(['internal', 'edge']));
  it('does not publish the API even though it joined edge', () => {
    expect(services.api).not.toMatch(/^\s*ports:/mu);
    expect(services.api).not.toMatch(/^\s*expose:/mu);
  });
  it('documents that edge is egress-only for the API', () => expect(flat(compose)).toContain('Unirse a `edge` no publica ningun puerto de host'));
  it('publishes exactly 80 and 443, and only from caddy', () => {
    const publishers = Object.entries(services).filter(([, block]) => /^\s*ports:/mu.test(block)).map(([name]) => name);
    expect(publishers).toEqual(['caddy']);
    expect(services.caddy).toContain("ports: ['80:80', '443:443']");
  });

  // Correccion 4 — el contacto TLS es obligatorio en toda la cadena.
  it('requires the TLS contact in compose', () => expect(services.caddy).toMatch(/MERDN_TLS_CONTACT_EMAIL: \$\{MERDN_TLS_CONTACT_EMAIL:\?/u));
  it('removes the Caddy "off" fallback', () => {
    expect(caddyfile).toContain('email {$MERDN_TLS_CONTACT_EMAIL}');
    expect(caddyfile).not.toContain(':off}');
  });

  // Correccion 5 — la imagen OIDC se resuelve por digest inmutable.
  it('requires an OIDC image variable in compose', () => expect(services.oidc).toMatch(/image: \$\{MERDN_OIDC_IMAGE:\?/u));
  it('ships an OIDC digest placeholder in the template', () => expect(envTemplate).toMatch(/^MERDN_OIDC_IMAGE=.*@sha256:REPLACE/mu));
});

describe('keycloak database bootstrap', () => {
  const OIDC_DB_VARS = ['MERDN_OIDC_DATABASE_NAME', 'MERDN_OIDC_DATABASE_USER', 'MERDN_OIDC_DATABASE_PASSWORD'];

  it('passes the three OIDC database variables to PostgreSQL', () => {
    for (const name of OIDC_DB_VARS) expect(services.postgres).toMatch(new RegExp(`${name}: \\$\\{${name}:\\?`, 'u'));
  });
  it('feeds Keycloak from exactly the same three variables', () => {
    expect(services.oidc).toContain('KC_DB_URL: jdbc:postgresql://postgres:5432/${MERDN_OIDC_DATABASE_NAME:?required}');
    expect(services.oidc).toContain('KC_DB_USERNAME: ${MERDN_OIDC_DATABASE_USER:?required}');
    expect(services.oidc).toContain('KC_DB_PASSWORD: ${MERDN_OIDC_DATABASE_PASSWORD:?required}');
  });
  it('leaves no divergent OIDC database URL variable behind', () => {
    expect(compose).not.toContain('MERDN_OIDC_DATABASE_URL');
    expect(envTemplate).not.toContain('MERDN_OIDC_DATABASE_URL');
  });
  it('mounts the init script read-only into the PostgreSQL init directory', () => expect(services.postgres).toContain('./infra/staging/init/10-keycloak-database.sh:/docker-entrypoint-initdb.d/10-keycloak-database.sh:ro'));
  it('keeps Keycloak internal-only despite owning its database', () => expect(/^ {4}networks: \[([^\]]+)\]$/mu.exec(services.oidc)?.[1]).toBe('internal'));

  it('is valid bash', () => expect(() => execFileSync('bash', ['-n', 'infra/staging/init/10-keycloak-database.sh'], { stdio: 'pipe' })).not.toThrow());
  it('uses strict shell failure behavior', () => expect(initScript).toContain('set -euo pipefail'));
  it('fails closed on every missing required variable', () => {
    for (const name of [...OIDC_DB_VARS, 'POSTGRES_USER', 'POSTGRES_DB']) expect(initScript).toContain(`${name} is required`);
  });
  it('validates identifiers before interpolating them', () => {
    expect(initScript).toContain("SAFE_IDENTIFIER='^[a-z_][a-z0-9_]{0,62}$'");
    expect(initScript).toContain('is not a safe SQL identifier');
  });
  it('uses identifier-safe and literal-safe formatting', () => {
    expect(initScript).toContain('%I');
    expect(initScript).toContain('%L');
    expect(initScript).toContain("'CREATE ROLE %I LOGIN");
  });
  it('never reuses merdn_runtime or the migrator role as the Keycloak identity', () => {
    expect(initScript).toContain('for reserved in merdn_runtime postgres "$admin_user"; do');
    expect(initScript).toContain("must not reuse the '$reserved' role");
    expect(initScript).toContain('MERDN_OIDC_DATABASE_NAME must not reuse the application database');
  });
  it('creates a LOGIN role with no elevated attribute', () => {
    expect(initScript).toContain('CREATE ROLE %I LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOREPLICATION');
    expect(initScript).not.toMatch(/CREATE ROLE %I LOGIN [A-Z]*(?<!NO)SUPERUSER/u);
  });
  it('gives the Keycloak role its own database and nothing on the application one', () => {
    expect(initScript).toContain("format('CREATE DATABASE %I OWNER %I', :'oidc_db', :'oidc_user')");
    expect(initScript).toContain("REVOKE ALL ON DATABASE %I FROM %I', current_database(), :'oidc_user'");
    expect(initScript).not.toMatch(/\bGRANT\b/u);
  });
  it('passes the password by environment, never by argv, and never prints it', () => {
    expect(initScript).toContain('getenv oidc_password MERDN_OIDC_DATABASE_PASSWORD');
    for (const line of initScript.split('\n').filter((l) => /printf|echo |log /u.test(l))) expect(line).not.toContain('oidc_password');
    expect(initScript).not.toMatch(/--set +oidc_password/u);
    expect(initScript).not.toContain('set -x');
  });
  it('rejects template placeholders as a password', () => {
    expect(initScript).toContain('is still a template placeholder');
    for (const marker of ['*REPLACE*', '*change-me*', '*example.invalid*', '*fictitious-not-a-secret*']) expect(initScript).toContain(marker);
  });
  it('carries no credential of its own', () => expect(initScript).not.toMatch(/PASSWORD\s+'[^']*'/u));
  it('verifies the outcome and fails closed if it did not converge', () => {
    expect(initScript).toContain('did not converge to the expected isolated contract');
    expect(initScript).toContain('AND NOT r.rolsuper');
    expect(initScript).toContain('AND NOT r.rolbypassrls');
  });
  it('is honest about only running on a fresh data directory', () => {
    expect(flat(initScript)).toContain('PostgreSQL ejecuta `/docker-entrypoint-initdb.d/*` UNICAMENTE cuando el');
    expect(flat(initScript)).toContain('directorio de datos esta VACIO, es decir, sobre un volumen nuevo');
    expect(flat(initScript)).toContain('NO modifica un volumen de staging ya inicializado');
    expect(flat(compose)).toContain('Solo se ejecuta sobre un directorio de datos VACIO');
    expect(flat(runbook)).toContain('only on an empty PostgreSQL data directory');
    expect(flat(runbook)).toContain('existing volume');
  });
});

describe('staging environment template', () => {
  // Correccion 2 — el template debe ser versionable sin debilitar las demas reglas.
  it('is exempted from the .env.* ignore rule', () => {
    const lines = gitignore.split(/\r?\n/u);
    expect(lines).toContain('!.env.staging.example');
    expect(lines.indexOf('!.env.staging.example')).toBe(lines.indexOf('!.env.example') + 1);
  });
  it('keeps every other env-file ignore rule intact', () => {
    const lines = gitignore.split(/\r?\n/u);
    expect(lines).toContain('.env');
    expect(lines).toContain('.env.*');
    expect(lines.filter((line) => line.startsWith('!.env'))).toEqual(['!.env.example', '!.env.staging.example']);
  });
  it('declares the required TLS contact as a placeholder', () => expect(envTemplate).toMatch(/^MERDN_TLS_CONTACT_EMAIL=REPLACE/mu));
  it('keeps every credential slot a placeholder', () => {
    for (const [key, value] of templateEntries()) {
      if (/PASSWORD|SECRET|KEY|DATABASE_URL/u.test(key)) expect(value).toContain('REPLACE');
    }
  });
  it('uses the documented fictional marker inside connection URLs', () => {
    const entries = Object.fromEntries(templateEntries());
    for (const key of ['DATABASE_URL', 'RUNTIME_DATABASE_URL']) expect(entries[key]).toMatch(/:\/\/[^:]+:[^@]*fictitious-not-a-secret@/u);
  });
  it('is rejected wholesale by the preflight', () => expect(() => runPreflight(Object.fromEntries(templateEntries()))).toThrow('placeholder'));
  it('declares the Keycloak database identity as placeholders', () => {
    const entries = Object.fromEntries(templateEntries());
    expect(entries.MERDN_OIDC_DATABASE_NAME).toBe('merdn_oidc');
    expect(entries.MERDN_OIDC_DATABASE_USER).toBe('merdn_oidc');
    expect(entries.MERDN_OIDC_DATABASE_PASSWORD).toContain('REPLACE');
  });
});

describe('backup and restore safety', () => {
  const scripts: [string, string][] = [['backup', backupScript], ['restore', restoreScript]];

  // Correccion 8 — la contrasena administrativa nunca viaja en argv.
  it.each(scripts)('%s never passes the connection URL to PostgreSQL tools', (_name, script) => {
    const invocations = script.split('\n').filter((line) => /&\s*pg_(dump|restore)/u.test(line));
    expect(invocations.length).toBeGreaterThan(0);
    for (const line of invocations) {
      expect(line).not.toContain('--dbname');
      expect(line).not.toContain('DATABASE_URL');
    }
  });
  it.each(scripts)('%s uses temporary PG* process variables and restores them', (_name, script) => {
    for (const name of ['PGHOST', 'PGPORT', 'PGDATABASE', 'PGUSER', 'PGPASSWORD']) expect(script).toContain(`$env:${name}=`);
    expect(script).toContain("[Environment]::SetEnvironmentVariable($name,$previous[$name],'Process')");
  });
  it.each(scripts)('%s never prints the URL or the password', (_name, script) => {
    for (const line of script.split('\n').filter((l) => /Write-(Output|Host|Warning)/u.test(l))) {
      expect(line).not.toContain('DATABASE_URL');
      expect(line).not.toContain('$pgPassword');
    }
  });
  it.each(scripts)('%s preserves dry-run', (_name, script) => {
    expect(script).toContain('if ($DryRun)');
    expect(script).toContain('DRY-RUN');
  });
  it('keeps the restore destructive path behind explicit confirmation', () => {
    expect(restoreScript).toContain('Destructive restore requires -ConfirmRestore.');
    expect(restoreScript).toContain('Restore target must be explicitly staging.');
  });

  // Correccion 7 — integridad real, sin inventar cifrado.
  it('verifies the dump is structurally readable', () => expect(backupScript).toMatch(/&\s*pg_restore --list \$file/u));
  it('writes a SHA-256 sidecar next to the dump', () => {
    expect(backupScript).toContain('-Algorithm SHA256');
    expect(backupScript).toContain('$sidecar="$file.sha256"');
  });
  it('never claims the script produces an encrypted backup', () => {
    for (const text of [backupScript, restoreScript, runbook, spec]) expect(text.toLowerCase()).not.toContain('encrypted backup');
    expect(runbook.toLowerCase()).not.toContain('encrypted logical backup');
    expect(spec.toLowerCase()).not.toContain('backup lógico cifrado');
  });
  it('states plainly that the script does not encrypt', () => {
    expect(backupScript).toContain('does not encrypt');
    expect(runbook).toContain('it does not encrypt');
    expect(flat(spec)).toContain('El script NO cifra');
  });
  it('documents encrypted external custody instead', () => expect(runbook).toContain('encrypted, access-restricted external staging storage'));
  it('checks integrity before the destructive restore', () => {
    expect(restoreScript).toContain('sidecar mismatch');
    expect(restoreScript.indexOf('pg_restore --list')).toBeLessThan(restoreScript.indexOf('--exit-on-error'));
  });
});

describe('runtime DB security', () => {
  function queryFor(overrides: Record<string, unknown> = {}) {
    return vi.fn(async (sql: string) => {
      if (sql.includes('current_user::text')) return { rows: [{ current_user: 'merdn_runtime', rolsuper: false, rolbypassrls: false, rolconfig: null, tenant: '', ...overrides }] };
      if (sql.includes('pg_database')) return { rows: [{ datconfig: null }] };
      if (sql.includes('count(*)')) return { rows: [{ count: 0 }] };
      if (sql.includes('quote_ident')) return { rows: [{ table_name: 'public.patient' }] };
      return { rows: [] };
    });
  }
  it('proves non-owner FORCE RLS fail-closed behavior', async () => expect(await verifyRuntimeDatabase(queryFor())).toEqual({ role: 'merdn_runtime', protectedTableCount: 1 }));
  it.each([{ rolsuper: true }, { rolbypassrls: true }, { current_user: 'owner' }])('rejects role mismatch %o', async (m) => expect(verifyRuntimeDatabase(queryFor(m))).rejects.toThrow('security mismatch'));
  it('rejects persistent tenant', async () => expect(verifyRuntimeDatabase(queryFor({ tenant: 'tenant' }))).rejects.toThrow('persistent tenant'));
});

describe('HTTP smoke', () => {
  it('separates reachability from browser acceptance', async () => {
    const result = await runSmoke({ publicOrigin: 'https://stage.test', oidcIssuer: 'https://id.test/realms/x', fetchImpl: vi.fn(async () => new Response('', { status: 200 })) as typeof fetch });
    expect(result.browserAcceptance).toBe('NOT_EXECUTED');
  });
  it('fails on HTTP failure', async () => expect(runSmoke({ publicOrigin: 'https://stage.test', oidcIssuer: 'https://id.test/realms/x', fetchImpl: vi.fn(async () => new Response('', { status: 503 })) as typeof fetch })).rejects.toThrow('not reachable'));
  it('rejects a non-HTTPS origin', async () => expect(runSmoke({ publicOrigin: 'http://stage.test', oidcIssuer: 'https://id.test/realms/x' })).rejects.toThrow('HTTPS'));

  // Correccion 6 — no existe ruta `/visitador`; la aceptacion vive en `/hospital`.
  it('only probes routes the application actually serves', () => expect(SMOKE_PATHS).toEqual(['/', '/hospital', '/municipality']));
  it('states in the runbook that no /visitador route exists', () => {
    expect(flat(runbook)).toContain('There is no `/visitador` application route');
    expect(flat(runbook)).not.toContain('`/municipality` and `/visitador`');
  });
  it('states in the spec that Visitador acceptance lives inside /hospital', () => {
    expect(flat(spec)).toContain('No existe ruta `/visitador`');
    expect(flat(spec)).toContain('dentro de la superficie `/hospital`');
    expect(flat(spec)).not.toContain('`/municipality` y `/visitador`');
  });
  it('does not claim the HTTP smoke proves Visitador browser acceptance', () => {
    expect(runbook).toContain('the HTTP smoke proves reachability only');
    expect(flat(runbook)).toContain('HTTP 200 alone is not Patient, Hospital, Municipality or Visitador acceptance');
  });
});

describe('staging CLIs fail closed', () => {
  // Regresion: la guarda de modulo principal debe funcionar en Windows y ningun
  // CLI puede salir con exito cuando falta el entorno.
  const clis = ['preflight.mjs', 'runtime-db-check.mjs', 'smoke.mjs'];
  it.each(clis)('%s uses a Windows-safe main-module guard', (name) => {
    const script = read(`scripts/staging/${name}`);
    expect(script).toContain("import { pathToFileURL } from 'node:url'");
    expect(script).toContain('import.meta.url === pathToFileURL(process.argv[1]).href');
    expect(script).not.toMatch(/file:\/\/\$\{process\.argv\[1\]\}/u);
  });
  it.each(clis)('%s sets a non-zero exit code on failure', (name) => expect(read(`scripts/staging/${name}`)).toContain('process.exitCode = 1'));
});
