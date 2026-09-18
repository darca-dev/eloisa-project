#!/usr/bin/env node
/**
 * Generador del SQL de datos de referencia territoriales de TASK-MVP-CORE-01.
 *
 * Procedencia
 * -----------
 * La única fuente es `apps/web/src/data/divipola.ts`, un archivo generado y ya
 * versionado en este repositorio cuya cabecera documenta su origen: DANE,
 * División Político-Administrativa de Colombia (DIVIPOLA), publicada en el
 * portal de datos abiertos del Estado colombiano, con los cortes y recursos
 * allí declarados.
 *
 * Este script NO inventa territorio: copia códigos y nombres oficiales tal como
 * están en esa fuente y calcula únicamente una forma normalizada para las
 * comparaciones internas. No genera barrios ni veredas, porque DIVIPOLA no
 * publica una codificación de esas unidades y el repositorio no dispone de una
 * fuente verificada para ellas.
 *
 * Uso:
 *   node prisma/tools/generate-territory-reference.mjs
 *
 * Reescribe la migración de datos de referencia. La salida es idempotente:
 * puede aplicarse varias veces sin duplicar filas y sin modificar las
 * existentes.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = path.resolve(import.meta.dirname, '../..');
const SOURCE = path.join(ROOT, 'apps/web/src/data/divipola.ts');
const TARGET = path.join(
  ROOT,
  'prisma/migrations/20260821120100_core_01_reference_data/migration.sql',
);

/** Código y nombre del tenant institucional MVP cargado por la migración. */
const MVP_TENANT_CODE = 'merdn-mvp';
const MVP_TENANT_NAME = 'MERDN — Tenant institucional MVP';

function extractPairs(source, constantName) {
  const start = source.indexOf(`const ${constantName}`);
  if (start === -1) {
    throw new Error(`No se encontró ${constantName} en ${SOURCE}`);
  }

  const open = source.indexOf('[', start);
  const close = source.indexOf('\n];', open);
  if (open === -1 || close === -1) {
    throw new Error(`No se pudo delimitar ${constantName} en ${SOURCE}`);
  }

  const block = source.slice(open, close);
  const pairs = [];
  const pattern = /\['([^']*)',\s*'((?:[^'\\]|\\.)*)'\]/g;

  let match;
  while ((match = pattern.exec(block)) !== null) {
    pairs.push([match[1], match[2].replace(/\\'/g, "'")]);
  }

  if (pairs.length === 0) {
    throw new Error(`${constantName} no contiene pares [codigo, nombre]`);
  }

  return pairs;
}

/** Forma normalizada para comparación: mayúsculas, sin tildes, sin dobles espacios. */
function normalizeName(name) {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function quote(value) {
  return `'${value.replace(/'/g, "''")}'`;
}

const source = readFileSync(SOURCE, 'utf8');
const departments = extractPairs(source, 'DEPARTAMENTOS_RAW');
const municipalities = extractPairs(source, 'MUNICIPIOS_RAW');

for (const [code] of departments) {
  if (!/^\d{2}$/.test(code)) {
    throw new Error(`Código de departamento inesperado: ${code}`);
  }
}

const departmentCodes = new Set(departments.map(([code]) => code));
for (const [code] of municipalities) {
  if (!/^\d{5}$/.test(code)) {
    throw new Error(`Código de municipio inesperado: ${code}`);
  }
  if (!departmentCodes.has(code.slice(0, 2))) {
    throw new Error(`El municipio ${code} no pertenece a ningún departamento conocido`);
  }
}

const departmentRows = departments
  .map(
    ([code, name]) =>
      `  (gen_random_uuid(), NULL, NULL, 'DEPARTMENT', ${quote(code)}, ${quote(
        normalizeName(name),
      )}, ${quote(name)}, 'ACTIVE', now(), now())`,
  )
  .join(',\n');

const municipalityRows = municipalities
  .map(
    ([code, name]) =>
      `  (${quote(code)}, ${quote(normalizeName(name))}, ${quote(name)}, ${quote(
        code.slice(0, 2),
      )})`,
  )
  .join(',\n');

const sql = `-- ---------------------------------------------------------------------------
-- TASK-MVP-CORE-01 — migracion 2 de 2: datos de referencia controlados.
--
-- ARCHIVO GENERADO por \`prisma/tools/generate-territory-reference.mjs\`.
-- No se edita a mano: se regenera desde \`apps/web/src/data/divipola.ts\`.
--
-- Contenido:
--   1. tenant institucional MVP;
--   2. ${departments.length} departamentos y ${municipalities.length} municipios oficiales DANE DIVIPOLA.
--
-- Procedencia: DANE — DIVIPOLA, portal de datos abiertos del Estado colombiano.
-- Los cortes y recursos exactos estan documentados en la cabecera de
-- \`apps/web/src/data/divipola.ts\`, archivo ya versionado en el repositorio.
--
-- NO se cargan barrios ni veredas: DIVIPOLA no publica una codificacion de esas
-- unidades y el repositorio no dispone de una fuente verificada. Mientras el
-- tenant no administre su catalogo local, la inscripcion usa la opcion canonica
-- OTHER_PENDING_NORMALIZATION y conserva el texto declarado por separado.
--
-- Caracter: ADITIVO E IDEMPOTENTE. No borra, no actualiza y no reemplaza filas.
-- No contiene datos personales.
-- ---------------------------------------------------------------------------

-- Tenant institucional activo del MVP. El servidor lo resuelve por su codigo
-- (variable MERDN_ACTIVE_TENANT_CODE); el navegador nunca lo envia.
INSERT INTO "tenant" ("id", "code", "name", "createdAt", "updatedAt")
VALUES (gen_random_uuid(), ${quote(MVP_TENANT_CODE)}, ${quote(MVP_TENANT_NAME)}, now(), now())
ON CONFLICT ("code") DO NOTHING;

-- Departamentos oficiales.
INSERT INTO "territorial_unit"
  ("id", "tenantId", "parentId", "type", "officialCode", "normalizedName", "displayName", "status", "createdAt", "updatedAt")
VALUES
${departmentRows}
ON CONFLICT ("type", "officialCode") DO NOTHING;

-- Municipios oficiales, enlazados a su departamento por codigo oficial.
INSERT INTO "territorial_unit"
  ("id", "tenantId", "parentId", "type", "officialCode", "normalizedName", "displayName", "status", "createdAt", "updatedAt")
SELECT
  gen_random_uuid(),
  NULL,
  parent."id",
  'MUNICIPALITY',
  entry."officialCode",
  entry."normalizedName",
  entry."displayName",
  'ACTIVE',
  now(),
  now()
FROM (VALUES
${municipalityRows}
) AS entry("officialCode", "normalizedName", "displayName", "departmentCode")
JOIN "territorial_unit" parent
  ON parent."type" = 'DEPARTMENT'
 AND parent."officialCode" = entry."departmentCode"
ON CONFLICT ("type", "officialCode") DO NOTHING;
`;

writeFileSync(TARGET, sql, 'utf8');

process.stdout.write(
  `[territory] SQL generado: ${departments.length} departamentos, ${municipalities.length} municipios.\n`,
);
