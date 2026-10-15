import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { test } from 'node:test';

import { EXPECTED_POLICY_COUNT, PROTECTED_TABLES, REQUIRED_MIGRATIONS } from '../../scripts/testing/test-db-provision.mjs';
import { RLS_POLICY_PAIRS } from '../../scripts/testing/test-db-preflight.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const migrationsRoot = path.join(root, 'prisma', 'migrations');
const migrations = readdirSync(migrationsRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();
const schema = readFileSync(path.join(root, 'prisma', 'schema.prisma'), 'utf8');
const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/--[^\r\n]*/gu, '');
const sql = migrations.map((name) => stripComments(readFileSync(path.join(migrationsRoot, name, 'migration.sql'), 'utf8'))).join('\n');

test('el catalogo completo cubre exactamente los 29 modelos/tablas del esquema', () => {
  const modelTables = [...schema.matchAll(/@@map\("([^"]+)"\)/gu)].map((match) => match[1]);
  assert.equal(modelTables.length, 29);
  assert.deepEqual([...PROTECTED_TABLES].sort(), modelTables.sort());
  const createdTables = [...sql.matchAll(/CREATE\s+TABLE\s+"([^"]+)"/giu)].map((match) => match[1]);
  assert.deepEqual(createdTables.sort(), [...PROTECTED_TABLES].sort());
});

test('las 24 migraciones exigidas corresponden exactamente al arbol versionado', () => {
  assert.equal(migrations.length, 24);
  assert.deepEqual([...REQUIRED_MIGRATIONS].sort(), migrations);
});

test('los 30 pares de policy/tabla corresponden a las migraciones sin excepciones', () => {
  assert.doesNotMatch(sql, /DROP\s+POLICY/iu, 'un cambio de policies requiere revisar este inventario');
  const actual = [...sql.matchAll(/CREATE\s+POLICY\s+"([^"]+)"\s+ON\s+"([^"]+)"/giu)]
    .map((match) => `${match[1]}::${match[2]}`).sort();
  assert.equal(actual.length, 30);
  assert.equal(EXPECTED_POLICY_COUNT, 30);
  assert.deepEqual(RLS_POLICY_PAIRS.map(({ policy, table }) => `${policy}::${table}`).sort(), actual);
});

test('access_request mantiene RLS/FORCE y grants minimos sin DELETE en su migracion', () => {
  const accessSql = stripComments(readFileSync(path.join(migrationsRoot, '20260928190000_access_request_foundation', 'migration.sql'), 'utf8'));
  assert.match(accessSql, /ALTER\s+TABLE\s+"access_request"\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/iu);
  assert.match(accessSql, /ALTER\s+TABLE\s+"access_request"\s+FORCE\s+ROW\s+LEVEL\s+SECURITY/iu);
  const grants = [...accessSql.matchAll(/GRANT\s+([^;]+?)\s+ON\s+TABLE\s+"access_request"\s+TO\s+"merdn_runtime"/giu)];
  assert.equal(grants.length, 1);
  assert.deepEqual(grants[0][1].split(',').map((permission) => permission.trim().toUpperCase()).sort(), ['INSERT', 'SELECT', 'UPDATE']);
});
