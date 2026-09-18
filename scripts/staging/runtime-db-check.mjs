import { pathToFileURL } from 'node:url';

const SAFE_IDENTIFIER = /^[a-z_][a-z0-9_]*$/u;

export async function verifyRuntimeDatabase(query, expectedRole = 'merdn_runtime') {
  if (!SAFE_IDENTIFIER.test(expectedRole)) throw new Error('Invalid expected runtime role');
  const identity = await query(`SELECT current_user::text AS current_user,
    r.rolsuper, r.rolbypassrls, r.rolconfig,
    current_setting('merdn.tenant_id', true) AS tenant
    FROM pg_roles r WHERE r.rolname = current_user`);
  const row = identity.rows[0];
  if (!row || row.current_user !== expectedRole || row.rolsuper || row.rolbypassrls) {
    throw new Error('Runtime database role security mismatch');
  }
  if (row.tenant || (row.rolconfig ?? []).some((v) => v.startsWith('merdn.tenant_id='))) {
    throw new Error('Runtime role has persistent tenant context');
  }
  const databaseSetting = await query(`SELECT datconfig FROM pg_database WHERE datname = current_database()`);
  if ((databaseSetting.rows[0]?.datconfig ?? []).some((v) => v.startsWith('merdn.tenant_id='))) {
    throw new Error('Runtime database has persistent tenant context');
  }
  const owned = await query(`SELECT count(*)::int AS count FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE c.relkind IN ('r','p') AND n.nspname='public' AND pg_get_userbyid(c.relowner)=current_user`);
  if (Number(owned.rows[0]?.count) !== 0) throw new Error('Runtime role owns protected application tables');
  const protectedTables = await query(`SELECT quote_ident(n.nspname)||'.'||quote_ident(c.relname) AS table_name
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE c.relkind IN ('r','p') AND c.relrowsecurity AND c.relforcerowsecurity AND n.nspname='public'`);
  if (!protectedTables.rows.length) throw new Error('No FORCE RLS protected tables found');
  for (const item of protectedTables.rows) {
    const result = await query(`SELECT 1 FROM ${item.table_name} LIMIT 1`);
    if (result.rows.length) throw new Error('Protected read did not fail closed without tenant context');
  }
  return { role: expectedRole, protectedTableCount: protectedTables.rows.length };
}

export async function runRuntimeDbCheck(env = process.env) {
  if (!env.RUNTIME_DATABASE_URL) throw new Error('RUNTIME_DATABASE_URL is required');
  const { Client } = await import('pg');
  const client = new Client({ connectionString: env.RUNTIME_DATABASE_URL });
  try {
    await client.connect();
    return await verifyRuntimeDatabase((text) => client.query(text), env.MERDN_RUNTIME_DB_ROLE ?? 'merdn_runtime');
  } finally { await client.end().catch(() => undefined); }
}

// Guarda de modulo principal portable (ver `preflight.mjs`).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  // eslint-disable-next-line no-console -- CLI de verificacion: la salida es la evidencia exigida.
  runRuntimeDbCheck().then((r) => console.log(`Runtime DB security: PASS (${r.protectedTableCount} protected tables)`))
    // eslint-disable-next-line no-console -- CLI de verificacion: la salida es la evidencia exigida.
    .catch(() => { console.error('Runtime DB security check failed'); process.exitCode = 1; });
}
