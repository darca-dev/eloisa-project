/**
 * MP14 (Spec 025) - pruebas permanentes del runner baseline.
 *
 * Pruebas puras, deterministas y sin efectos: no abren procesos reales, no tocan
 * Docker, red, PostgreSQL, Prisma ni migraciones, no escriben archivos
 * temporales y no mutan `process.env`. Todo doble es inyectado: `spawn` simulado
 * con un EventEmitter local y funciones inyectadas para provision, preflight,
 * execute y cleaner.
 *
 * URLs, usuarios y credenciales son ficticios y locales. Ninguna asercion los
 * imprime: solo se comparan con `ok`, `failedStage`, conteos, claves de entorno y
 * marcadores de redaccion.
 *
 * Cobertura exigida por el handoff v37: (1) parser cerrado y run-id, (2) matriz
 * de 29/23/cleanup final, (3) los seis ceros y conteos positivos en ambos
 * ordenes, (4) entorno infantil de seis claves de sistema y tres derivadas, (5)
 * captura saneada, (6) timeout del ejecutor, (7) parada al primer fallo, (8)
 * provision/preflight/executor con una sola limpieza y (9) cleanup final
 * exitoso y fallido con `ok`, `failedStage` y evidencia correctos.
 */

import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';

import * as runner from '../../scripts/testing/run-baseline.mjs';

type Env = Record<string, string>;
type StageEvidence = { stage: string; outcome: string; runId: string | null };
type Resultado = {
  ok: boolean;
  runId: string;
  failedStage: string | null;
  cleanup: { cleaned: boolean; reason: string | null } | null;
  evidence: StageEvidence[];
};

const ENV_FILE = '.env.test.example';
const RUN_ID = 'prueba-mp14-2026';
const SISTEMA = 'clave-ficticia-sistema-0001';

/** Env-file ficticio que satisface el guard anti-entorno sin tocar disco. */
const ENV_VALIDA: Env = {
  POSTGRES_DB: 'merdn_test',
  POSTGRES_USER: 'merdn_test_admin',
  MERDN_RUNTIME_DB_USER: 'merdn_runtime',
  MERDN_RUNTIME_ROLE: 'enforce',
  POSTGRES_PASSWORD: 'clave-ficticia-admin-0001',
  MERDN_RUNTIME_DB_PASSWORD: 'clave-ficticia-runtime-0002',
  TEST_DATABASE_ADMIN_URL: 'postgresql://merdn_test_admin:clave-ficticia-admin-0001@127.0.0.1:55432/merdn_test?schema=public',
  TEST_DATABASE_RUNTIME_URL: 'postgresql://merdn_runtime:clave-ficticia-runtime-0002@127.0.0.1:55432/merdn_test?schema=public',
};

/** Entorno padre simulado. Nunca se lee `process.env` ni se muta. */
const PADRE: Env = {
  Path: 'C:\\Windows\\System32',
  SystemRoot: 'C:\\Windows',
  windir: 'C:\\Windows',
  COMSPEC: 'C:\\Windows\\cmd.exe',
  PATHEXT: '.COM;.EXE;.BAT',
  TEMP: 'C:\\Windows\\Temp',
  TMP: 'C:\\Windows\\Temp\\1',
  SystemDrive: 'C:',
  USERPROFILE: 'C:\\Users\\ficticio',
  APPDATA: 'C:\\Users\\ficticio\\AppData',
  LOCALAPPDATA: 'C:\\Users\\ficticio\\AppData\\Local',
  ProgramData: 'C:\\ProgramData',
  HOME: 'C:\\Users\\ficticio',
  LANG: 'es_CO.UTF-8',
  NUMBER_OF_PROCESSORS: '8',
  PROCESSOR_ARCHITECTURE: 'AMD64',
  NODE_OPTIONS: '--max-old-space-size=99999',
  MARCADOR_DEL_PADRE: SISTEMA,
  VITEST_POOL: 'forks',
};

const CONTEO_VACIO = { passed: 0, failed: 0, skipped: 0 };

/** Resultado de stage siempre sano y explicito. */
const SALUDABLE = { exitCode: 0, stdout: ' Tests  4 passed (4)', stderr: '' };

/**
 * Hijo de proceso simulado: EventEmitter local con `stdout` y `stderr` que solo
 * emiten datos y un evento final. No existe ningun proceso detras.
 */
function hijoSimulado(opciones: { salida?: string; error?: string; codigo?: number | null; nuncaTermina?: boolean } = {}) {
  const hijo = new EventEmitter() as EventEmitter & { stdout: EventEmitter; stderr: EventEmitter; kill: () => void };
  hijo.stdout = new EventEmitter();
  hijo.stderr = new EventEmitter();
  let terminado = false;
  hijo.kill = () => {
    terminado = true;
  };
  queueMicrotask(() => {
    if (opciones.nuncaTermina === true) return;
    if (opciones.salida !== undefined) hijo.stdout.emit('data', opciones.salida);
    if (opciones.error !== undefined) hijo.stderr.emit('data', opciones.error);
    if (opciones.error !== undefined && opciones.codigo === undefined) hijo.emit('error', { code: 'EACCES' });
    else hijo.emit('close', opciones.codigo ?? 0);
  });
  return { hijo, fueTerminado: () => terminado };
}

/** Doble del executor: cuenta invocaciones y devuelve una salida fija. */
function ejecutarCon(salida: { exitCode?: number; stdout?: string } = {}) {
  const llamadas: { stage: string; argv: string[] }[] = [];
  const execute = async (p: { stage: string; command: { argv: string[] } }) => {
    llamadas.push({ stage: p.stage, argv: [...p.command.argv] });
    return { exitCode: salida.exitCode ?? 0, stdout: salida.stdout ?? SALUDABLE.stdout, stderr: '', timedOut: false };
  };
  return { execute, llamadas };
}

/** Cuenta invocaciones de provision, preflight y cleaner. */
function doblesDeCiclo(inyeccion: { fallo?: 'provision' | 'preflight' | 'execute' } = {}) {
  const conteo = { provision: 0, preflight: 0, cleanup: 0, cleanupOnFailure: [] as boolean[] };
  const provision = async (opciones: { cleanupOnFailure?: boolean }) => {
    conteo.provision += 1;
    conteo.cleanupOnFailure.push(opciones?.cleanupOnFailure === true);
    if (inyeccion.fallo === 'provision') throw new Error('fichero de doble: fallo simulado de provision');
  };
  const preflight = async () => {
    conteo.preflight += 1;
    if (inyeccion.fallo === 'preflight') throw new Error('fichero de doble: fallo simulado de preflight');
    return { problems: [] };
  };
  const cleaner = async () => {
    conteo.cleanup += 1;
    return { cleaned: true };
  };
  return { provision, preflight, cleaner, conteo };
}

async function correrStages(opciones: {
  fallo?: 'provision' | 'preflight' | 'execute';
  stage?: string;
  execute?: (p: { stage: string; command: { argv: string[] } }) => Promise<{ exitCode: number; stdout: string; stderr?: string; timedOut?: boolean }>;
  cleaner?: () => Promise<{ cleaned: boolean }>;
}): Promise<{ resultado: Resultado; conteo: { provision: number; preflight: number; cleanup: number; cleanupOnFailure: boolean[] } }> {
  const ciclo = doblesDeCiclo({ fallo: opciones.fallo });
  const resultado = (await runner.runBaseline({
    argv: ['--env-file', ENV_FILE, '--stage', opciones.stage ?? 'all', '--run-id', RUN_ID],
    env: ENV_VALIDA,
    loadEnv: async () => ENV_VALIDA,
    provision: ciclo.provision,
    preflight: ciclo.preflight,
    cleanupDatabase: opciones.cleaner ?? ciclo.cleaner,
    execute: opciones.execute ?? (await ejecutarCon()).execute,
  })) as unknown as Resultado;
  return { resultado, conteo: ciclo.conteo };
}

describe('MP14 - parser cerrado y run-id', () => {
  test('acepta env-file, stage y run-id validos', () => {
    const parsed = runner.parseBaselineArgs(['--env-file', ENV_FILE, '--stage', 'web', '--run-id', RUN_ID]);
    assert.equal(parsed.envFilePath, ENV_FILE);
    assert.equal(parsed.stage, 'web');
    assert.equal(parsed.runId, RUN_ID);
  });

  test('exige env-file en todas las etapas, incluido typecheck', () => {
    for (const stage of ['typecheck', 'web', 'openapi', 'provision', 'all', 'db/visits.api.test.ts']) {
      assert.throws(() => runner.parseBaselineArgs(['--stage', stage, '--run-id', RUN_ID]), /env-file/u);
    }
  });

  test('exige run-id en toda etapa posterior a provision', () => {
    for (const stage of ['typecheck', 'web', 'openapi', 'api-no-db-health', 'cleanup', 'db/visits.api.test.ts']) {
      assert.throws(() => runner.parseBaselineArgs(['--env-file', ENV_FILE, '--stage', stage]), /run-id/u);
    }
  });

  test('provision y all generan run-id valido cuando falta', () => {
    const provision = runner.buildPlan(['--env-file', ENV_FILE, '--stage', 'provision'], { now: new Date('2026-09-27T10:00:00Z') });
    const all = runner.buildPlan(['--env-file', ENV_FILE, '--stage', 'all'], { now: new Date('2026-09-27T10:00:00Z') });
    assert.equal(provision.runIdProvided, false);
    assert.equal(all.runIdProvided, false);
    assert.match(provision.runId, /^[a-z0-9][a-z0-9-]{0,39}$/u);
    assert.equal(all.runId, provision.runId);
    assert.equal(runner.buildPlan(['--env-file', ENV_FILE, '--stage', 'all', '--run-id', RUN_ID]).runId, RUN_ID);
  });

  test('rechaza flags desconocidos, duplicados, vacios y stages fuera de matriz', () => {
    const inválidos: string[][] = [
      ['--env-file', ENV_FILE, '--stage', 'web', '--run-id', RUN_ID, '--force'],
      ['--env-file', ENV_FILE, '--env-file', ENV_FILE, '--stage', 'web', '--run-id', RUN_ID],
      ['--env-file', ENV_FILE, '--stage'],
      ['--env-file', ENV_FILE, '--stage', '*', '--run-id', RUN_ID],
      ['--env-file', ENV_FILE, '--stage', 'db/../../etc/passwd', '--run-id', RUN_ID],
      ['--env-file', 'C:\\absoluto\\.env', '--stage', 'web', '--run-id', RUN_ID],
      ['--env-file', '../fuera/.env', '--stage', 'web', '--run-id', RUN_ID],
      ['--env-file', ENV_FILE, '--stage', 'web', '--run-id', 'a; rm -rf /'],
      ['--env-file', ENV_FILE, '--stage', 'web', '--run-id', 'CORRIDA'],
      ['--env-file', ENV_FILE, '--stage', 'web', '--run-id', 'x'.repeat(41)],
    ];
    for (const argv of inválidos) {
      assert.throws(() => runner.parseBaselineArgs(argv), /baseline runner failed at args/u);
    }
  });

  test('la evidencia conserva el mismo run-id y anula un run-id inseguro', () => {
    const uno = runner.buildStageEvidence({ stage: 'web', outcome: 'pass', durationMs: 1, runId: RUN_ID });
    const otro = runner.buildStageEvidence({ stage: 'openapi', outcome: 'pass', durationMs: 1, runId: RUN_ID });
    assert.equal(uno.runId, RUN_ID);
    assert.equal(otro.runId, RUN_ID);
    assert.equal(runner.buildStageEvidence({ stage: 'web', outcome: 'pass', durationMs: 1, runId: 'a;rm' }).runId, null);
    assert.equal(Object.keys(uno).sort().join(','), 'commit,counts,durationMs,outcome,project,runId,stage');
    assert.deepEqual(uno.counts, CONTEO_VACIO);
  });
});

describe('MP14 - matriz de stages', () => {
  test('29 etapas, 23 DB-gated y cleanup final', () => {
    assert.equal(runner.BASELINE_STAGES.length, 29);
    assert.equal(runner.DB_GATED_STAGES.length, 23);
    assert.equal(runner.BASELINE_STAGES[0], 'provision');
    assert.equal(runner.BASELINE_STAGES[28], 'cleanup');
    assert.equal(runner.STAGE_MATRIX.filter((s) => s.kind === 'lifecycle').map((s) => s.id).join(','), 'provision,cleanup');
    assert.equal(runner.STAGE_MATRIX.find((s) => s.id === 'typecheck')?.kind, 'static');
  });

  test('un intento, timeouts finitos, argv fijo sin shell, glob ni recursion', () => {
    assert.equal(runner.RUNNER_LIMITS.maxAttempts, 1);
    for (const stage of runner.STAGE_MATRIX) {
      assert.ok(Number.isFinite(stage.timeoutMs) && stage.timeoutMs > 0 && stage.timeoutMs <= 1_800_000);
      for (const comando of stage.commands) {
        assert.ok(comando.argv.length > 0);
        for (const palabra of comando.argv) {
          assert.doesNotMatch(palabra, /&&|[|;<>]|\*/u);
          assert.ok(!palabra.includes('run-baseline'));
        }
      }
    }
    assert.deepEqual(runner.DB_GATED_STAGES, runner.BASELINE_STAGES.filter((s) => s.startsWith('db/')));
  });

  test('la matriz incompleta, duplicada o con comodin falla cerrado', () => {
    assert.throws(() => runner.assertMatrixComplete(['provision', 'cleanup', 'web']), /cleanup debe ser la etapa final/u);
    assert.throws(() => runner.assertMatrixComplete(['web', 'web']), /duplicado/u);
    assert.throws(() => runner.assertMatrixComplete(['*']), /no autorizado/u);
    assert.throws(() => runner.resolveStageIds('db/inventada.test.ts'), /fuera de la matriz/u);
    assert.equal(runner.resolveStageIds('web').length, 1);
    assert.equal(runner.resolveStageIds('all').length, 29);
  });

  test('los comandos de typecheck cubren los tres proyectos y no emiten', () => {
    const typecheck = runner.STAGE_MATRIX.find((s) => s.id === 'typecheck');
    assert.equal(typecheck?.commands.length, 3);
    assert.deepEqual(typecheck?.commands.map((c) => c.argv.slice(-1)[0]), ['--noEmit', '--noEmit', '--noEmit']);
  });
});

describe('MP14 - clasificacion de outcomes', () => {
  test('los seis ceros pasan en los dos ordenes', () => {
    for (const texto of ['0 skipped', 'skipped 0', '0 todo', 'todo 0', '0 disabled', 'disabled 0']) {
      assert.equal(runner.classifyStageOutcome({ exitCode: 0, stdout: ` Tests  9 passed | ${texto}` }), 'pass');
    }
  });

  test('los conteos positivos fallan en los dos ordenes', () => {
    for (const texto of ['1 skipped', 'skipped 2', '3 todo', 'todo 1', '4 disabled', 'disabled 1']) {
      assert.notEqual(runner.classifyStageOutcome({ exitCode: 0, stdout: ` Tests  9 passed | ${texto}` }), 'pass');
    }
    assert.equal(runner.classifyStageOutcome({ exitCode: 0, stdout: ' Tests  9 passed | skipped 0 | 11 todo' }), 'skipped');
    assert.equal(runner.classifyStageOutcome({ exitCode: 0, stdout: ' Tests  9 passed | 0 skipped | todo 10' }), 'skipped');
  });

  test('nunca acepta como exito un timeout, un marcador solo, no tests found, un exit code o una salida sin resumen', () => {
    assert.equal(runner.classifyStageOutcome({ exitCode: 0, timedOut: true }), 'timeout');
    assert.equal(runner.classifyStageOutcome({ exitCode: 0, stdout: ' Tests  2 passed\n  ↓ a.test.ts (skipped)' }), 'skipped');
    assert.equal(runner.classifyStageOutcome({ exitCode: 0, stdout: 'No test files found, exiting with code 1' }), 'disabled');
    assert.equal(runner.classifyStageOutcome({ exitCode: 0, stdout: ' Tests  1 disabled' }), 'disabled');
    assert.equal(runner.classifyStageOutcome({ exitCode: 1, stdout: ' Tests  1 failed' }), 'fail');
    assert.equal(runner.classifyStageOutcome({ exitCode: 0, stdout: 'sin resumen' }), 'incomplete');
    assert.equal(runner.classifyStageOutcome({ exitCode: 0, stdout: '' }), 'incomplete');
  });

  test('una etapa estatica no exige resumen de pruebas', () => {
    assert.equal(runner.classifyStageOutcome({ exitCode: 0, stdout: '', expectTests: false }), 'pass');
    assert.equal(runner.classifyStageOutcome({ exitCode: 2, stdout: 'error TS2304', expectTests: false }), 'fail');
  });
});

describe('MP14 - entorno infantil minimo', () => {
  const hijo = runner.buildChildEnvironment(ENV_VALIDA, PADRE);

  test('la allowlist de sistema son exactamente seis variables', () => {
    assert.equal(runner.SYSTEM_ENV_ALLOWLIST.length, 6);
    assert.deepEqual([...runner.SYSTEM_ENV_ALLOWLIST], ['SystemRoot', 'COMSPEC', 'PATHEXT', 'PATH', 'TEMP', 'TMP']);
    assert.deepEqual([...runner.CHILD_TEST_KEYS], ['DATABASE_URL', 'RUNTIME_DATABASE_URL', 'MERDN_RUNTIME_ROLE']);
  });

  test('el hijo solo recibe claves de sistema y las tres derivadas', () => {
    for (const clave of Object.keys(hijo)) {
      assert.ok(runner.SYSTEM_ENV_ALLOWLIST.includes(clave) || runner.CHILD_TEST_KEYS.includes(clave), clave);
    }
    assert.equal(Object.keys(hijo).length, 9);
  });

  test('cada variable de sistema entra una sola vez, resuelta desde el padre', () => {
    const mayusculas = Object.keys(hijo).map((k) => k.toUpperCase());
    assert.equal(new Set(mayusculas).size, mayusculas.length);
    assert.equal(hijo.PATH, PADRE.Path);
    assert.equal(hijo.SystemRoot, PADRE.SystemRoot);
    assert.equal(hijo.COMSPEC, PADRE.COMSPEC);
    assert.equal(hijo.PATHEXT, PADRE.PATHEXT);
    assert.equal(hijo.TEMP, PADRE.TEMP);
    assert.equal(hijo.TMP, PADRE.TMP);
  });

  test('no hereda configuracion de usuario, de herramientas ni el marcador del padre', () => {
    for (const clave of ['USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'ProgramData', 'SystemDrive', 'HOME', 'LANG', 'windir', 'WINDIR', 'NUMBER_OF_PROCESSORS', 'PROCESSOR_ARCHITECTURE', 'NODE_OPTIONS', 'VITEST_POOL', 'MARCADOR_DEL_PADRE']) {
      assert.equal(clave in hijo, false, clave);
    }
    assert.doesNotMatch(JSON.stringify(hijo), new RegExp(SISTEMA, 'u'));
    assert.doesNotMatch(JSON.stringify(hijo), /99999/u);
  });

  test('las dos URL del hijo son las aisladas y no viajan las claves crudas', () => {
    assert.equal(hijo.DATABASE_URL, ENV_VALIDA.TEST_DATABASE_ADMIN_URL);
    assert.equal(hijo.RUNTIME_DATABASE_URL, ENV_VALIDA.TEST_DATABASE_RUNTIME_URL);
    assert.equal(hijo.MERDN_RUNTIME_ROLE, 'enforce');
    for (const clave of ['TEST_DATABASE_ADMIN_URL', 'TEST_DATABASE_RUNTIME_URL', 'POSTGRES_PASSWORD', 'MERDN_RUNTIME_DB_PASSWORD']) {
      assert.equal(clave in hijo, false, clave);
    }
  });

  test('sin env-file no hay derivadas y con padre vacio solo quedan las tres', () => {
    const sinEnvFile = Object.keys(runner.buildChildEnvironment({}, PADRE));
    assert.deepEqual(sinEnvFile, ['SystemRoot', 'COMSPEC', 'PATHEXT', 'PATH', 'TEMP', 'TMP']);
    assert.equal(sinEnvFile.some((k) => runner.CHILD_TEST_KEYS.includes(k)), false);
    assert.deepEqual(Object.keys(runner.buildChildEnvironment(ENV_VALIDA, {})), [...runner.CHILD_TEST_KEYS]);
  });

  test('los secretos declarados incluyen ambas URL y ambas contrasenas', () => {
    const secretos = [...runner.collectSecrets(ENV_VALIDA)];
    assert.ok(secretos.includes(ENV_VALIDA.TEST_DATABASE_ADMIN_URL));
    assert.ok(secretos.includes(ENV_VALIDA.TEST_DATABASE_RUNTIME_URL));
    assert.ok(secretos.includes(ENV_VALIDA.POSTGRES_PASSWORD));
    assert.ok(secretos.includes(ENV_VALIDA.MERDN_RUNTIME_DB_PASSWORD));
    assert.equal(secretos.some((s) => s.trim() === ''), false);
  });
});

describe('MP14 - ejecutor real con spawn simulado', () => {
  test('usa argv fijo, shell false, cwd fijo y el entorno inyectado', async () => {
    const llamadas: { comando: string; args: string[]; opciones: { shell: boolean; cwd: string; env: Env } }[] = [];
    const hijo = hijoSimulado({ salida: ' Tests  1 passed' });
    const execute = runner.createSpawnExecutor({
      spawn: (comando: string, args: string[], opciones: { shell: boolean; cwd: string; env: Env }) => {
        llamadas.push({ comando, args, opciones });
        return hijo.hijo;
      },
      secrets: [...runner.collectSecrets(ENV_VALIDA)],
      env: runner.buildChildEnvironment(ENV_VALIDA, PADRE) as unknown as Env,
    });
    const salida = await execute({ command: { argv: ['/ruta/absoluta/node', '/ruta/vitest.mjs', 'run'] }, cwd: '/repo', timeoutMs: 5_000, stage: 'web' });
    assert.equal(llamadas.length, 1);
    assert.equal(llamadas[0].comando, '/ruta/absoluta/node');
    assert.deepEqual(llamadas[0].args, ['/ruta/vitest.mjs', 'run']);
    assert.equal(llamadas[0].opciones.shell, false);
    assert.equal(llamadas[0].opciones.cwd, '/repo');
    assert.equal(llamadas[0].opciones.env.DATABASE_URL, ENV_VALIDA.TEST_DATABASE_ADMIN_URL);
    assert.equal('NODE_OPTIONS' in llamadas[0].opciones.env, false);
    assert.equal(salida.exitCode, 0);
  });

  test('sanea la captura con los secretos conocidos', async () => {
    const secretos = [...runner.collectSecrets(ENV_VALIDA)];
    const execute = runner.createSpawnExecutor({
      spawn: () => hijoSimulado({ salida: `conectado ${ENV_VALIDA.TEST_DATABASE_ADMIN_URL}`, error: `fallo con ${ENV_VALIDA.MERDN_RUNTIME_DB_PASSWORD}`, codigo: 0 }).hijo,
      secrets: secretos,
      env: runner.buildChildEnvironment(ENV_VALIDA, PADRE) as unknown as Env,
    });
    const salida = await execute({ command: { argv: ['node', 'x.mjs'] }, cwd: '/repo', timeoutMs: 5_000, stage: 'web' });
    assert.doesNotMatch(salida.stdout, /clave-ficticia/u);
    assert.doesNotMatch(salida.stderr, /clave-ficticia/u);
    assert.match(salida.stdout, /\[redacted/u);
    assert.match(salida.stderr, /\[redacted/u);
  });

  test('un timeout mata al hijo y se reporta como timeout', async () => {
    const hijo = hijoSimulado({ nuncaTermina: true });
    const execute = runner.createSpawnExecutor({ spawn: () => hijo.hijo, secrets: [], env: {} });
    const salida = await execute({ command: { argv: ['node', 'x.mjs'] }, cwd: '/repo', timeoutMs: 10, stage: 'web' });
    assert.equal(salida.timedOut, true);
    assert.equal(salida.exitCode, null);
    assert.equal(hijo.fueTerminado(), true);
    assert.equal(runner.classifyStageOutcome({ exitCode: salida.exitCode, stdout: salida.stdout, timedOut: salida.timedOut }), 'timeout');
  });

  test('un error de spawn no propaga la excepcion ni filtra el mensaje', async () => {
    const execute = runner.createSpawnExecutor({ spawn: () => hijoSimulado({ error: `no se pudo abrir ${ENV_VALIDA.TEST_DATABASE_ADMIN_URL}` }).hijo, secrets: [...runner.collectSecrets(ENV_VALIDA)], env: {} });
    const salida = await execute({ command: { argv: ['inexistente', 'x.mjs'] }, cwd: '/repo', timeoutMs: 5_000, stage: 'web' });
    assert.equal(salida.spawnFailed, true);
    assert.equal(salida.exitCode, null);
    assert.doesNotMatch(salida.stderr, /clave-ficticia/u);
    assert.doesNotMatch(salida.stderr, /postgresql/u);
  });

  test('se detiene en el primer comando que falla de un stage', async () => {
    const invocados: string[] = [];
    const stage = { id: 'typecheck', timeoutMs: 100 };
    const salida = await runner.executeStageCommands({
      stage,
      commands: [{ argv: ['tsc', 'a'], cwd: '/repo' }, { argv: ['tsc', 'b'], cwd: '/repo' }, { argv: ['tsc', 'c'], cwd: '/repo' }],
      execute: async (p: { command: { argv: string[] } }) => {
        invocados.push(p.command.argv[1]);
        return { exitCode: p.command.argv[1] === 'b' ? 1 : 0, stdout: '', stderr: '' };
      },
    });
    assert.deepEqual(invocados, ['a', 'b']);
    assert.equal(salida.exitCode, 1);
  });
});

describe('MP14 - ciclo completo con dobles inyectados', () => {
  test('un ciclo sano recorre las 29 etapas, termina en cleanup y conserva el run-id', async () => {
    const { resultado, conteo } = await correrStages({});
    assert.equal(resultado.ok, true);
    assert.equal(resultado.failedStage, null);
    assert.equal(resultado.evidence.length, 29);
    assert.equal(resultado.evidence[28].stage, 'cleanup');
    assert.equal(resultado.evidence[28].outcome, 'pass');
    assert.ok(resultado.evidence.every((e) => e.runId === RUN_ID));
    assert.equal(conteo.cleanup, 1);
    assert.equal(conteo.provision, 1);
    assert.equal(conteo.preflight, 1);
  });

  test('el provisionador no limpia por su cuenta: el runner es el unico dueno', async () => {
    const { conteo } = await correrStages({});
    assert.deepEqual(conteo.cleanupOnFailure, [false]);
  });

  for (const fallo of ['provision', 'preflight', 'execute'] as const) {
    test(`un fallo en ${fallo} devuelve ok false, evidencia sanitizada y una sola limpieza`, async () => {
      const { resultado, conteo } = await correrStages({
        fallo,
        execute: async (p) => {
          if (fallo === 'execute' && p.stage === 'web') throw new Error(`fichero de doble: fallo de ${p.stage}`);
          return SALUDABLE;
        },
      });
      assert.equal(resultado.ok, false);
      assert.equal(conteo.cleanup, 1);
      assert.ok(resultado.evidence.length >= 1);
      const ultima = resultado.evidence[resultado.evidence.length - 1];
      assert.equal(ultima.stage, resultado.failedStage);
      assert.doesNotMatch(JSON.stringify(resultado), /fichero de doble|clave-ficticia|postgresql|127\.0\.0\.1|55432/u);
    });
  }

  test('un stage que falla por exit code detiene el ciclo y limpia una vez', async () => {
    const { resultado, conteo } = await correrStages({
      execute: async (p) => (p.stage === 'web' ? { exitCode: 1, stdout: ' Tests  1 failed' } : SALUDABLE),
    });
    assert.equal(resultado.ok, false);
    assert.equal(resultado.failedStage, 'web');
    assert.equal(conteo.cleanup, 1);
    assert.equal(resultado.evidence[resultado.evidence.length - 1].outcome, 'fail');
  });

  test('un cleanup final fallido hace fallar el resultado global sin repetir la limpieza', async () => {
    let invocaciones = 0;
    const resultado = (await runner.runBaseline({
      argv: ['--env-file', ENV_FILE, '--stage', 'all', '--run-id', RUN_ID],
      env: ENV_VALIDA,
      loadEnv: async () => ENV_VALIDA,
      provision: async () => undefined,
      preflight: async () => ({ problems: [] }),
      cleanupDatabase: async () => {
        invocaciones += 1;
        return { cleaned: false };
      },
      execute: async () => SALUDABLE,
    })) as unknown as Resultado;
    assert.equal(invocaciones, 1);
    assert.equal(resultado.ok, false);
    assert.equal(resultado.failedStage, 'cleanup');
    assert.equal(resultado.evidence[28].stage, 'cleanup');
    assert.equal(resultado.evidence[28].outcome, 'fail');
    assert.equal(resultado.cleanup?.cleaned, false);
  });

  test('un cleanup aislado que falla tambien cierra el resultado en falso', async () => {
    const resultado = (await runner.runBaseline({
      argv: ['--env-file', ENV_FILE, '--stage', 'cleanup', '--run-id', RUN_ID],
      env: ENV_VALIDA,
      loadEnv: async () => ENV_VALIDA,
      cleanupDatabase: async () => ({ cleaned: false }),
      execute: async () => SALUDABLE,
    })) as unknown as Resultado;
    assert.equal(resultado.ok, false);
    assert.equal(resultado.failedStage, 'cleanup');
    assert.equal(resultado.evidence.length, 1);
    assert.equal(resultado.evidence[0].outcome, 'fail');
  });

  test('un cleaner que lanza excepcion no filtra el mensaje y tampoco repite limpieza', async () => {
    let invocaciones = 0;
    const resultado = (await runner.runBaseline({
      argv: ['--env-file', ENV_FILE, '--stage', 'cleanup', '--run-id', RUN_ID],
      env: ENV_VALIDA,
      loadEnv: async () => ENV_VALIDA,
      cleanupDatabase: async () => {
        invocaciones += 1;
        throw new Error(`compose fallo con ${ENV_VALIDA.TEST_DATABASE_ADMIN_URL}`);
      },
      execute: async () => SALUDABLE,
    })) as unknown as Resultado;
    assert.equal(invocaciones, 1);
    assert.equal(resultado.ok, false);
    assert.equal(resultado.failedStage, 'cleanup');
    assert.doesNotMatch(JSON.stringify(resultado), /compose fallo|clave-ficticia|postgresql/u);
  });

  test('un entorno que viola el guard falla cerrado antes de ejecutar nada', async () => {
    let ejecucion = 0;
    await assert.rejects(
      runner.runBaseline({
        argv: ['--env-file', ENV_FILE, '--stage', 'web', '--run-id', RUN_ID],
        env: { ...ENV_VALIDA, POSTGRES_DB: 'merdn_produccion' },
        loadEnv: async () => ENV_VALIDA,
        execute: async () => {
          ejecucion += 1;
          return SALUDABLE;
        },
      }),
      (error: { name: string; stage: string; message: string }) => {
        assert.equal(error.name, 'CleanupError');
        assert.equal(error.stage, 'guard');
        assert.doesNotMatch(error.message, /clave-ficticia|postgresql|127\.0\.0\.1/u);
        return true;
      },
    );
    assert.equal(ejecucion, 0);
  });

  test('un argv fijo de stage de pruebas apunta al archivo exacto, sin glob', async () => {
    const conEjecutor = await ejecutarCon();
    const resultado = (await runner.runBaseline({
      argv: ['--env-file', ENV_FILE, '--stage', 'db/visits.api.test.ts', '--run-id', RUN_ID],
      env: ENV_VALIDA,
      loadEnv: async () => ENV_VALIDA,
      execute: conEjecutor.execute,
    })) as unknown as Resultado;
    assert.equal(conEjecutor.llamadas.length, 1);
    const argv = conEjecutor.llamadas[0].argv;
    assert.equal(argv[argv.length - 1].endsWith('visits.api.test.ts'), true);
    assert.equal(argv[argv.length - 2], 'run');
    assert.equal(resultado.ok, true);
    assert.equal(resultado.evidence.length, 1);
  });
});
