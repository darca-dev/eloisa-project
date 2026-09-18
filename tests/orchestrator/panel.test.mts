/**
 * AC-09 / T-16 — el panel escucha sólo en loopback, ofrece las acciones
 * aprobadas y es utilizable con teclado y lector de pantalla.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';

import {
  createHarness,
  cleanBaseline,
  dirtyBaseline,
  hastaTaskReady,
  implementacionValida,
  mockOutput,
} from './helpers.mts';
import {
  assertLoopbackBindHost,
  createPanelServer,
  handleCommand,
  isLoopbackAddress,
  isLoopbackHostHeader,
  startPanelServer,
} from '../../tools/merdn-orchestrator/src/ui/server.ts';
import { renderPanel } from '../../tools/merdn-orchestrator/src/ui/panel.ts';
import { PANEL_HOST } from '../../tools/merdn-orchestrator/src/config.ts';
import { OrchestratorError } from '../../tools/merdn-orchestrator/src/domain/errors.ts';

test('AC-09: el servidor sólo se enlaza a 127.0.0.1', async () => {
  const h = createHarness();
  const { server, url } = await startPanelServer(h.orchestrator, { port: 0 });
  try {
    const address = server.address() as AddressInfo;
    assert.equal(address.address, PANEL_HOST);
    assert.equal(url.startsWith('http://127.0.0.1:'), true);

    const respuesta = await fetch(url);
    assert.equal(respuesta.status, 200);
    assert.match(respuesta.headers.get('content-type') ?? '', /text\/html/);
  } finally {
    server.close();
    h.close();
  }
});

test('AUDITORÍA §1: sólo 127.0.0.1 es un host de escucha admisible', () => {
  assert.equal(assertLoopbackBindHost('127.0.0.1'), '127.0.0.1');
  assert.equal(assertLoopbackBindHost(' 127.0.0.1 '), '127.0.0.1');

  for (const host of ['0.0.0.0', '::', '[::]', '192.168.1.20', '10.0.0.5', 'localhost', '0.0.0.0:4319', '']) {
    assert.throws(
      () => assertLoopbackBindHost(host),
      (error: unknown) =>
        error instanceof OrchestratorError && error.code === 'host_de_escucha_no_permitido',
      'debía rechazarse el host "' + host + '"',
    );
  }
});

test('AUDITORÍA §1: intentar exponer el panel impide crear o arrancar el servidor', async () => {
  const h = createHarness();
  try {
    for (const host of ['0.0.0.0', '::', '192.168.1.20']) {
      // No se crea el servidor...
      assert.throws(
        () => createPanelServer(h.orchestrator, { host }),
        (error: unknown) =>
          error instanceof OrchestratorError && error.code === 'host_de_escucha_no_permitido',
      );
      // ...ni se abre el socket.
      await assert.rejects(
        // Se pasa una función: el rechazo ocurre antes de crear el socket.
        async () => startPanelServer(h.orchestrator, { port: 0, host }),
        (error: unknown) =>
          error instanceof OrchestratorError && error.code === 'host_de_escucha_no_permitido',
        'no debe escuchar en ' + host,
      );
    }
  } finally {
    h.close();
  }
});

test('las peticiones con Host no loopback se rechazan', async () => {
  const h = createHarness();
  const { server } = await startPanelServer(h.orchestrator, { port: 0 });
  const { port } = server.address() as AddressInfo;
  try {
    // `fetch` no permite fijar la cabecera Host: se usa http directamente.
    const status = await new Promise<number>((resolve, reject) => {
      const request = http.request(
        { host: '127.0.0.1', port, path: '/', method: 'GET', headers: { host: 'ejemplo.externo.com' } },
        (response) => {
          response.resume();
          resolve(response.statusCode ?? 0);
        },
      );
      request.on('error', reject);
      request.end();
    });
    assert.equal(status, 403);
  } finally {
    server.close();
    h.close();
  }
});

test('la validación de origen y de Host es estricta', () => {
  assert.equal(isLoopbackAddress('127.0.0.1'), true);
  assert.equal(isLoopbackAddress('::1'), true);
  assert.equal(isLoopbackAddress('::ffff:127.0.0.1'), true);
  assert.equal(isLoopbackAddress('192.168.1.20'), false);
  assert.equal(isLoopbackAddress(undefined), false);

  assert.equal(isLoopbackHostHeader('127.0.0.1:4319'), true);
  assert.equal(isLoopbackHostHeader('localhost:4319'), true);
  assert.equal(isLoopbackHostHeader('merdn.example.com'), false);
  assert.equal(isLoopbackHostHeader(undefined), false);
});

test('la API local expone estado, comandos y rechaza rutas desconocidas', async () => {
  const h = createHarness();
  const { server, url } = await startPanelServer(h.orchestrator, { port: 0 });
  try {
    const desconocida = await fetch(url + 'no-existe');
    assert.equal(desconocida.status, 404);

    const runs = await (await fetch(url + 'api/runs')).json();
    assert.deepEqual(runs, { runs: [] });

    const comandoInvalido = await fetch(url + 'api/comando', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ comando: 'formatear_disco' }),
    });
    assert.equal(comandoInvalido.status, 400);
    const cuerpo = (await comandoInvalido.json()) as { codigo?: string };
    assert.equal(cuerpo.codigo, 'comando_desconocido');
  } finally {
    server.close();
    h.close();
  }
});

test('T-16: el HTML del panel es accesible y sin recursos externos', () => {
  const html = renderPanel();

  assert.match(html, /<html lang="es">/);
  assert.match(html, /role="status"/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /<label for="solicitud">/);
  assert.match(html, /<summary>Ver detalles técnicos<\/summary>/);
  assert.match(html, /focus-visible/);

  // Los botones se identifican por texto, no sólo por color o icono.
  for (const texto of ['PREPARAR PROPUESTA']) {
    assert.ok(html.includes(texto));
  }
  // Modos disponibles para la Product Owner.
  for (const modo of ['Automático', 'Asistido', 'Manual']) {
    assert.ok(html.includes(modo), 'falta el modo ' + modo);
  }
  // Sin llamadas a Internet ni recursos externos.
  assert.equal(/src="https?:/.test(html), false);
  assert.equal(/href="https?:/.test(html), false);
  assert.equal(html.includes('cdn'), false);
});

test('T-16: cada control tiene nombre accesible y el foco es alcanzable', () => {
  const html = renderPanel();

  // Todo campo de formulario tiene una etiqueta asociada por `for`/`id`.
  const etiquetados = [...html.matchAll(/<label[^>]*for="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(etiquetados.includes('solicitud'));
  assert.ok(etiquetados.includes('respuesta'));
  for (const id of etiquetados) {
    assert.ok(html.includes('id="' + id + '"'), 'la etiqueta apunta a un control real: ' + id);
  }

  // Los grupos de opciones y regiones tienen nombre accesible.
  assert.match(html, /<legend>¿Cómo quieres trabajar\?<\/legend>/);
  assert.match(html, /role="group" aria-label="Acciones disponibles"/);
  assert.match(html, /role="region" aria-label="Cosas que impiden continuar"/);
  assert.match(html, /aria-labelledby="titulo-revision"/);

  // Los bloques de detalle son alcanzables con teclado.
  const focalizables = [...html.matchAll(/tabindex="0"/g)];
  assert.ok(focalizables.length >= 2, 'los bloques de sólo lectura reciben foco');

  // Ningún control depende sólo del color: todos llevan texto.
  const botones = [...html.matchAll(/<button[^>]*>([^<]*)<\/button>/g)].map((m) => (m[1] ?? '').trim());
  assert.ok(botones.length > 0);
  for (const texto of botones) {
    assert.ok(texto.length > 0, 'cada botón declara texto visible');
  }

  // El idioma y el estado en vivo están declarados una sola vez.
  assert.equal((html.match(/aria-live="polite"/g) ?? []).length, 1);
  assert.match(html, /<html lang="es">/);
});

test('las acciones ofrecidas coinciden con el estado del flujo', async () => {
  const h = createHarness({ baselines: [cleanBaseline(), dirtyBaseline(['tools/merdn-orchestrator/src/x.ts'])] });
  const runId = await hastaTaskReady(h);

  const enTaskReady = h.orchestrator.view(runId).actions.map((a) => a.id);
  assert.deepEqual(enTaskReady, ['implementar', 'cancelar', 'detener']);
  assert.equal(
    h.orchestrator.view(runId).actions.find((a) => a.id === 'implementar')?.requiresConfirmation,
    true,
    'en modo Asistido la implementación exige confirmación',
  );

  h.claude.enqueue({ result: { output: implementacionValida() } });
  await h.orchestrator.implementar(runId, { confirmado: true });
  assert.deepEqual(h.orchestrator.view(runId).actions.map((a) => a.id), ['revisar', 'detener']);

  h.orchestrator.detener(runId);
  assert.deepEqual(h.orchestrator.view(runId).actions.map((a) => a.id), ['continuar', 'cancelar']);
  h.close();
});

test('el comando `crear` del panel registra y prepara en un solo paso', async () => {
  const h = createHarness();
  h.codex.enqueue({
    result: { output: { summary: 'propuesta', readyForClaude: true } },
  });
  const resultado = await handleCommand(h.orchestrator, {
    comando: 'crear',
    texto: 'Quiero ver la población atendida por programa.',
    modo: 'ASISTIDO',
  });

  assert.equal(typeof resultado['runId'], 'string');
  const vista = h.orchestrator.view(String(resultado['runId']));
  assert.equal(vista.state, 'ANALISIS');
  assert.equal(vista.headline, 'Propuesta preparada');
  assert.deepEqual(vista.actions.map((a) => a.id), ['ver', 'aprobar', 'cambiar', 'rechazar', 'detener']);
  h.close();
});

test('AUDITORÍA §2: el panel exige VER antes de que APROBAR tenga efecto', async () => {
  const h = createHarness();
  h.codex.enqueue({ result: { output: mockOutput({ summary: 'propuesta', readyForClaude: true }) } });
  const creado = await handleCommand(h.orchestrator, {
    comando: 'crear',
    texto: 'Quiero un tablero.',
    modo: 'ASISTIDO',
  });
  const runId = String(creado['runId']);

  const sinVer = await handleCommand(h.orchestrator, { comando: 'aprobar', runId });
  assert.equal(sinVer['ok'], false);
  assert.equal(sinVer['motivo'], 'requiere_ver_antes_de_aprobar');
  assert.equal(h.orchestrator.view(runId).state, 'ANALISIS');

  const visto = await handleCommand(h.orchestrator, { comando: 'ver', runId });
  const detalle = visto['detalle'] as { hashVisto?: string } | undefined;
  assert.equal(typeof detalle?.hashVisto, 'string');

  const conHashViejo = await handleCommand(h.orchestrator, {
    comando: 'aprobar',
    runId,
    hashVisto: 'otro-hash',
  });
  assert.equal(conHashViejo['ok'], false);
  assert.equal(conHashViejo['motivo'], 'aprobacion_stale');

  const aprobado = await handleCommand(h.orchestrator, {
    comando: 'aprobar',
    runId,
    hashVisto: detalle?.hashVisto,
  });
  assert.equal(aprobado['ok'], true);
  assert.equal(h.orchestrator.view(runId).state, 'TASK_READY');
  h.close();
});

test('el panel nunca ofrece un comando que ejecute Git', async () => {
  const h = createHarness();
  const creado = h.orchestrator.crear('necesito algo', 'ASISTIDO');
  const resultado = await handleCommand(h.orchestrator, { comando: 'autorizar_commit', runId: creado.runId });
  assert.equal(resultado['ok'], false);
  assert.equal(resultado['motivo'], 'v1_no_ejecuta_commit_ni_push');
  h.close();
});
