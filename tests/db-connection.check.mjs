#!/usr/bin/env node
/**
 * T-11 — Verificación técnica de conexión a PostgreSQL (TASK-001, FR-11).
 *
 * Ejecuta una sentencia NO mutante (`SELECT 1;`) mediante
 * `prisma db execute --stdin`, usando el datasource declarado en
 * `prisma/schema.prisma` y la configuración de `prisma.config.ts`.
 *
 * Garantías:
 * - no crea tablas, modelos, migraciones ni datos;
 * - no imprime `DATABASE_URL` ni ninguna credencial;
 * - falla con un mensaje técnico claro si falta la configuración o si
 *   PostgreSQL no está disponible.
 */
import { spawn } from 'node:child_process';
import process from 'node:process';

const NON_MUTATING_STATEMENT = 'SELECT 1;';

function fail(message) {
  console.error(`[db:check] ERROR: ${message}`);
  process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL?.trim();

if (!databaseUrl) {
  fail(
    'la variable de entorno DATABASE_URL no está definida o está vacía. ' +
      'Copie .env.example a .env y defina una cadena de conexión PostgreSQL local. ' +
      'El valor no se imprime por seguridad.',
  );
}

let protocol;
try {
  protocol = new URL(databaseUrl).protocol;
} catch {
  fail('DATABASE_URL no es una URL válida. El valor no se imprime por seguridad.');
}

if (protocol !== 'postgresql:' && protocol !== 'postgres:') {
  fail(
    'DATABASE_URL debe usar el esquema postgresql:// o postgres://. ' +
      'El valor no se imprime por seguridad.',
  );
}

console.log('[db:check] Ejecutando sentencia no mutante contra PostgreSQL: SELECT 1;');

const child = spawn(
  process.execPath,
  [
    'node_modules/prisma/build/index.js',
    'db',
    'execute',
    '--stdin',
  ],
  { stdio: ['pipe', 'inherit', 'inherit'] },
);

child.on('error', (error) => {
  fail(`no se pudo ejecutar la CLI de Prisma: ${error.message}`);
});

child.on('close', (code) => {
  if (code === 0) {
    console.log('[db:check] OK: PostgreSQL respondió y la configuración Prisma conecta.');
    console.log('[db:check] No se crearon tablas, modelos, migraciones ni datos.');
    process.exit(0);
  }

  fail(
    `la verificación de conexión falló (código de salida ${code}). ` +
      'Compruebe que el contenedor PostgreSQL esté en ejecución y que DATABASE_URL ' +
      'apunte al host y puerto correctos.',
  );
});

child.stdin.end(`${NON_MUTATING_STATEMENT}\n`);
