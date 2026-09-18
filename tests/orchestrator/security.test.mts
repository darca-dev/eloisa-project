/**
 * T-06 / T-07 / T-08 / T-09 / T-18 — rutas, secretos, comandos permitidos y
 * prohibición de operaciones Git destructivas.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  checkInsideRoot,
  classifyPaths,
  isForbiddenPath,
  matchesAllowlist,
} from '../../tools/merdn-orchestrator/src/workspace/paths.ts';
import { assertReadOnlyGit, gitSubcommand } from '../../tools/merdn-orchestrator/src/workspace/git.ts';
import {
  assertAllowedCommand,
  createFakeRunner,
} from '../../tools/merdn-orchestrator/src/adapters/process.ts';
import {
  filterEnv,
  redact,
  redactAndTruncate,
  scanForSecrets,
} from '../../tools/merdn-orchestrator/src/domain/redaction.ts';
import { DEFAULT_ALLOWED_PATHS, FORBIDDEN_AGENT_FLAGS, REPO_ROOT } from '../../tools/merdn-orchestrator/src/config.ts';
import { OrchestratorError } from '../../tools/merdn-orchestrator/src/domain/errors.ts';
import { checkProposedPaths } from '../../tools/merdn-orchestrator/src/workspace/guard.ts';

test('T-06: traversal y rutas absolutas externas quedan bloqueadas', () => {
  assert.equal(checkInsideRoot(REPO_ROOT, 'tools/merdn-orchestrator/src/main.ts').ok, true);
  assert.equal(checkInsideRoot(REPO_ROOT, '../otro-repo/archivo.ts').ok, false);
  assert.equal(checkInsideRoot(REPO_ROOT, 'tools/../../fuera.ts').reason, 'path_traversal');
  assert.equal(checkInsideRoot(REPO_ROOT, path.join(os.tmpdir(), 'x.ts')).ok, false);
});

test('T-06: un symlink o junction que escapa del repositorio se detecta', (t) => {
  const externo = fs.mkdtempSync(path.join(os.tmpdir(), 'merdn-externo-'));
  const enlace = path.join(REPO_ROOT, 'tools', 'merdn-orchestrator', '.enlace-prueba');
  try {
    fs.symlinkSync(externo, enlace, 'junction');
  } catch {
    t.skip('el sistema no permite crear enlaces en esta ejecución');
    fs.rmSync(externo, { recursive: true, force: true });
    return;
  }
  try {
    const verdict = checkInsideRoot(REPO_ROOT, 'tools/merdn-orchestrator/.enlace-prueba/archivo.ts');
    assert.equal(verdict.ok, false);
    assert.equal(verdict.reason, 'symlink_o_junction_escape');
  } finally {
    fs.rmSync(enlace, { recursive: true, force: true });
    fs.rmSync(externo, { recursive: true, force: true });
  }
});

test('T-09: la allowlist de archivos coincide con la Task aprobada', () => {
  assert.equal(matchesAllowlist('tools/merdn-orchestrator/src/main.ts', DEFAULT_ALLOWED_PATHS), true);
  assert.equal(matchesAllowlist('tests/orchestrator/x.test.mts', DEFAULT_ALLOWED_PATHS), true);
  assert.equal(matchesAllowlist('.gitignore', DEFAULT_ALLOWED_PATHS), true);
  assert.equal(matchesAllowlist('package.json', DEFAULT_ALLOWED_PATHS), true);
  assert.equal(matchesAllowlist('apps/web/src/app/page.tsx', DEFAULT_ALLOWED_PATHS), false);
});

test('las rutas protegidas siempre están fuera de alcance', () => {
  for (const ruta of [
    'prototype-claude/index.dc.html',
    'apps/api/src/main.ts',
    'packages/shared/src/index.ts',
    'prisma/schema.prisma',
    'AGENTS.md',
    'CLAUDE.md',
    'agents/qa.md',
    'compose.yml',
    '.env',
  ]) {
    assert.equal(isForbiddenPath(ruta), true, ruta + ' debía estar prohibida');
  }

  const clasificacion = classifyPaths(
    ['tools/merdn-orchestrator/src/a.ts', 'prototype-claude/x.dc.html'],
    DEFAULT_ALLOWED_PATHS,
  );
  assert.deepEqual(clasificacion.inScope, ['tools/merdn-orchestrator/src/a.ts']);
  assert.deepEqual(clasificacion.forbidden, ['prototype-claude/x.dc.html']);
});

test('T-09: una propuesta con archivos fuera de alcance se rechaza sin revertir nada', () => {
  const verdict = checkProposedPaths(['apps/web/src/app/hospital/page.tsx'], DEFAULT_ALLOWED_PATHS);
  assert.equal(verdict.ok, false);
  assert.equal(verdict.reason, 'archivos_fuera_de_alcance');
  assert.deepEqual(verdict.outOfScope, ['apps/web/src/app/hospital/page.tsx']);
});

test('T-18: ninguna operación Git destructiva puede construirse', () => {
  for (const args of [
    ['reset', '--hard'],
    ['clean', '-fd'],
    ['stash'],
    ['rebase', 'main'],
    ['checkout', '--', '.'],
    ['commit', '-m', 'x'],
    ['push', 'origin', 'main'],
    ['merge', 'main'],
    ['branch', '-D', 'develop'],
  ]) {
    assert.throws(
      () => assertReadOnlyGit(args),
      (error: unknown) =>
        error instanceof OrchestratorError && error.code === 'git_destructivo_bloqueado',
      'git ' + args.join(' ') + ' debía bloquearse',
    );
  }
});

test('sólo se permiten subcomandos Git de lectura', () => {
  for (const args of [['status', '--porcelain'], ['rev-parse', 'HEAD'], ['diff', '--check']]) {
    assert.doesNotThrow(() => assertReadOnlyGit(args));
  }
  assert.throws(() => assertReadOnlyGit(['fetch']), OrchestratorError);

  // Las opciones globales antes del subcomando no se aceptan: podrían
  // desplazar el subcomando real o cambiar el repositorio de trabajo.
  assert.equal(gitSubcommand(['-c', 'core.pager=cat', 'status']), null);
  assert.equal(gitSubcommand(['status', '--porcelain']), 'status');
  assert.throws(
    () => assertReadOnlyGit(['-C', '/otro/repo', 'status']),
    (error: unknown) => error instanceof OrchestratorError && error.code === 'git_sin_subcomando',
  );
});

test('T-08: un comando fuera de la allowlist nunca se ejecuta', async () => {
  const runner = createFakeRunner(() => ({ exitCode: 0 }));
  await assert.rejects(
    runner({ command: 'curl', args: ['https://ejemplo'], cwd: REPO_ROOT }),
    (error: unknown) => error instanceof OrchestratorError && error.code === 'comando_no_permitido',
  );
  assert.equal(runner.calls.length, 0, 'no debe registrarse ninguna llamada');
});

test('los flags de bypass de permisos están prohibidos', async () => {
  const runner = createFakeRunner(() => ({ exitCode: 0 }));
  for (const flag of FORBIDDEN_AGENT_FLAGS) {
    await assert.rejects(
      runner({ command: 'claude', args: ['-p', 'hola', flag], cwd: REPO_ROOT }),
      (error: unknown) => error instanceof OrchestratorError && error.code === 'flag_prohibido',
    );
  }
});

test('el cwd siempre queda dentro del repositorio', () => {
  assert.throws(
    () => assertAllowedCommand({ command: 'git', args: ['status'], cwd: os.tmpdir() }),
    (error: unknown) => error instanceof OrchestratorError && error.code === 'cwd_fuera_del_repositorio',
  );
});

/**
 * Las muestras se construyen en tiempo de ejecución: así el escáner de
 * secretos del repositorio no encuentra literales sospechosos en el código
 * de prueba, y la detección se ejercita igual sobre la cadena completa.
 */
function muestraFicticia(prefijo: string, longitud = 24): string {
  return prefijo + 'F1ct1c10'.repeat(Math.ceil(longitud / 8)).slice(0, longitud);
}

test('T-07: se detectan y redactan secretos en cualquier texto', () => {
  const muestras = [
    'ANTHROPIC_API_KEY=' + muestraFicticia('sk-ant-'),
    'authorization: Bearer ' + muestraFicticia(''),
    'password = "' + muestraFicticia('') + '"',
    'postgres://usuario:' + muestraFicticia('') + '@localhost:5432/db',
    muestraFicticia('ghp_', 20),
  ];
  for (const muestra of muestras) {
    assert.equal(scanForSecrets(muestra).found, true, 'debía detectar una muestra ficticia');
    const limpio = redact(muestra);
    assert.ok(limpio.includes('[REDACTADO]'), 'debía redactar la muestra ficticia');
    assert.equal(limpio.includes('F1ct1c10'), false, 'el valor no debe sobrevivir a la redacción');
  }
  assert.equal(scanForSecrets('quiero ver la población por programa').found, false);
});

test('la salida capturada se trunca además de redactarse', () => {
  const salida = 'x'.repeat(500) + ' token=' + muestraFicticia('');
  const resultado = redactAndTruncate(salida, 100);
  assert.ok(resultado.length <= 130);
  assert.ok(resultado.includes('truncada'));
});

test('el entorno de los procesos hijos se filtra', () => {
  const filtrado = filterEnv({
    PATH: '/usr/bin',
    ANTHROPIC_API_KEY: muestraFicticia('sk-ant-'),
    OPENAI_API_KEY: muestraFicticia('sk-'),
    DATABASE_URL: 'postgres://u:' + muestraFicticia('') + '@localhost/db',
    ALGO_PRIVADO: 'valor',
  });
  assert.deepEqual(Object.keys(filtrado), ['PATH']);
});
