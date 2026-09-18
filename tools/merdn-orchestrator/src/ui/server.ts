/**
 * Servidor local del panel (FR-17, seguridad 1/2, AC-09).
 *
 * Escucha exclusivamente en `127.0.0.1`. Rechaza cualquier petición cuyo
 * origen o cabecera `Host` no sea loopback. No hay autenticación
 * multiusuario porque es una herramienta local de un solo usuario (AD-15).
 */

import http from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';

import { PANEL_ALLOWED_HOSTNAMES, PANEL_DEFAULT_PORT, PANEL_HOST } from '../config.ts';
import { OrchestratorError } from '../domain/errors.ts';
import type { Orchestrator } from '../runtime/engine.ts';
import { renderPanel } from './panel.ts';

const MAX_BODY_BYTES = 64 * 1024;

export function isLoopbackAddress(address: string | undefined): boolean {
  if (address === undefined) {
    return false;
  }
  const normalized = address.replace(/^::ffff:/, '');
  return normalized === '127.0.0.1' || normalized === '::1' || normalized.startsWith('127.');
}

/**
 * Único host de escucha admitido en V1.
 *
 * El panel no es configurable para exponerse: `0.0.0.0`, `::`, cualquier
 * dirección LAN o interfaz externa hacen fallar el arranque de forma segura
 * antes de abrir el socket.
 */
export function assertLoopbackBindHost(host: string): string {
  const normalized = host.trim().toLowerCase();
  if (normalized !== PANEL_HOST) {
    throw new OrchestratorError(
      'host_de_escucha_no_permitido',
      'El panel sólo puede escuchar en ' + PANEL_HOST + '; se rechazó "' + host + '".',
    );
  }
  return PANEL_HOST;
}

export function isLoopbackHostHeader(host: string | undefined): boolean {
  if (host === undefined) {
    return false;
  }
  const withoutPort = host.startsWith('[') ? host.slice(0, host.indexOf(']') + 1) : host.split(':')[0];
  return PANEL_ALLOWED_HOSTNAMES.includes(withoutPort ?? '');
}

interface CommandBody {
  readonly comando?: string;
  readonly runId?: string;
  readonly texto?: string;
  readonly modo?: string;
  readonly decisionId?: string;
  readonly confirmado?: boolean;
  /** Hash de la versión que el Product Owner tenía a la vista al aprobar. */
  readonly hashVisto?: string;
}

async function readBody(request: IncomingMessage): Promise<CommandBody> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = chunk as Buffer;
    size += buffer.length;
    if (size > MAX_BODY_BYTES) {
      throw new OrchestratorError('cuerpo_demasiado_grande', 'La petición es demasiado grande.');
    }
    chunks.push(buffer);
  }
  if (chunks.length === 0) {
    return {};
  }
  try {
    const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (typeof parsed !== 'object' || parsed === null) {
      return {};
    }
    return parsed as CommandBody;
  } catch {
    throw new OrchestratorError('json_invalido', 'La petición no es JSON válido.');
  }
}

function sendJson(response: ServerResponse, status: number, payload: unknown): void {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'",
  });
  response.end(body);
}

/** Ejecuta un comando del panel sobre el motor. Sin shell ni rutas dinámicas. */
export async function handleCommand(
  orchestrator: Orchestrator,
  body: CommandBody,
): Promise<Record<string, unknown>> {
  const comando = body.comando ?? '';
  const runId = body.runId ?? '';

  switch (comando) {
    case 'crear': {
      const modo = body.modo ?? 'ASISTIDO';
      const creado = orchestrator.crear(body.texto ?? '', modo === 'AUTOMATICO' || modo === 'MANUAL' ? modo : 'ASISTIDO');
      const preparado = await orchestrator.prepararPropuesta(creado.runId, { confirmado: true });
      return { ok: preparado.ok, runId: creado.runId, mensaje: preparado.message, motivo: preparado.reason };
    }
    case 'cambiar_modo': {
      const resultado = orchestrator.cambiarModo(runId, body.modo ?? '');
      return { ok: resultado.ok, runId, mensaje: resultado.message };
    }
    case 'preparar_propuesta': {
      const resultado = await orchestrator.prepararPropuesta(runId, { confirmado: body.confirmado === true });
      return { ok: resultado.ok, runId, mensaje: resultado.message, motivo: resultado.reason, detalle: resultado.detail };
    }
    case 'responder': {
      const resultado = orchestrator.responderDecision(runId, body.decisionId ?? '', body.texto ?? '');
      return { ok: resultado.ok, runId, mensaje: resultado.message };
    }
    case 'ver': {
      // Registra la versión exacta que la persona está viendo (auditoría §2).
      const resultado = orchestrator.ver(runId);
      return {
        ok: resultado.ok,
        runId,
        mensaje: resultado.message,
        motivo: resultado.reason,
        detalle: resultado.detail,
      };
    }
    case 'aprobar': {
      const vista = orchestrator.view(runId);
      const hashVisto = typeof body.hashVisto === 'string' ? body.hashVisto : null;
      const resultado =
        vista.state === 'ESPERANDO_APROBACION_VISUAL'
          ? orchestrator.aprobarResultado(runId, hashVisto)
          : orchestrator.aprobarPropuesta(runId, hashVisto);
      return { ok: resultado.ok, runId, mensaje: resultado.message, motivo: resultado.reason };
    }
    case 'cambiar': {
      const vista = orchestrator.view(runId);
      const resultado =
        vista.state === 'ESPERANDO_APROBACION_VISUAL'
          ? orchestrator.solicitarCambios(runId, body.texto ?? '')
          : orchestrator.cambiarPropuesta(runId, body.texto ?? '');
      return { ok: resultado.ok, runId, mensaje: resultado.message };
    }
    case 'rechazar': {
      const resultado = orchestrator.rechazar(runId, body.texto ?? 'sin motivo indicado');
      return { ok: resultado.ok, runId, mensaje: resultado.message };
    }
    case 'implementar': {
      const resultado = await orchestrator.implementar(runId, { confirmado: body.confirmado === true });
      return { ok: resultado.ok, runId, mensaje: resultado.message, motivo: resultado.reason, detalle: resultado.detail };
    }
    case 'revisar': {
      const resultado = await orchestrator.revisar(runId);
      return { ok: resultado.ok, runId, mensaje: resultado.message, motivo: resultado.reason };
    }
    case 'preparar_commit': {
      const hashVisto = typeof body.hashVisto === 'string' ? body.hashVisto : null;
      const resultado = orchestrator.aprobarResultado(runId, hashVisto);
      return { ok: resultado.ok, runId, mensaje: resultado.message, motivo: resultado.reason };
    }
    case 'autorizar_commit': {
      const resultado = orchestrator.autorizarCommit(runId);
      return { ok: resultado.ok, runId, mensaje: resultado.message, motivo: resultado.reason };
    }
    case 'detener': {
      const resultado = orchestrator.detener(runId);
      return { ok: resultado.ok, runId, mensaje: resultado.message };
    }
    case 'continuar': {
      const resultado = orchestrator.continuar(runId);
      return { ok: resultado.ok, runId, mensaje: resultado.message };
    }
    case 'cancelar': {
      const resultado = orchestrator.cancelar(runId);
      return { ok: resultado.ok, runId, mensaje: resultado.message };
    }
    case 'decidir': {
      const resultado = orchestrator.decidirInterrupcion(runId, body.texto ?? 'decisión pendiente');
      return { ok: resultado.ok, runId, mensaje: resultado.message };
    }
    default:
      throw new OrchestratorError('comando_desconocido', 'Comando no reconocido.');
  }
}

export interface PanelServerOptions {
  readonly port?: number;
  /**
   * Sólo se acepta `127.0.0.1`. Existe para que un intento de exponer el
   * panel falle de forma explícita, no para hacerlo configurable.
   */
  readonly host?: string;
}

export function createPanelServer(
  orchestrator: Orchestrator,
  options: PanelServerOptions = {},
): http.Server {
  assertLoopbackBindHost(options.host ?? PANEL_HOST);
  return http.createServer((request, response) => {
    void handleRequest(orchestrator, request, response);
  });
}

async function handleRequest(
  orchestrator: Orchestrator,
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  // Defensa en profundidad: además del bind loopback, se valida el origen.
  if (!isLoopbackAddress(request.socket.remoteAddress ?? undefined)) {
    sendJson(response, 403, { error: 'Sólo se aceptan peticiones locales.' });
    return;
  }
  if (!isLoopbackHostHeader(request.headers.host)) {
    sendJson(response, 403, { error: 'Host no permitido.' });
    return;
  }

  const url = new URL(request.url ?? '/', 'http://127.0.0.1');

  try {
    if (request.method === 'GET' && url.pathname === '/') {
      const html = renderPanel();
      response.writeHead(200, {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
        'content-security-policy':
          "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'",
      });
      response.end(html);
      return;
    }

    if (request.method === 'GET' && url.pathname === '/api/runs') {
      sendJson(response, 200, {
        runs: orchestrator.listRuns().map((run) => ({ id: run.id, state: run.state, mode: run.mode })),
      });
      return;
    }

    if (request.method === 'GET' && url.pathname === '/api/estado') {
      const runId = url.searchParams.get('runId') ?? '';
      sendJson(response, 200, orchestrator.view(runId));
      return;
    }

    if (request.method === 'POST' && url.pathname === '/api/comando') {
      const body = await readBody(request);
      const result = await handleCommand(orchestrator, body);
      sendJson(response, 200, result);
      return;
    }

    sendJson(response, 404, { error: 'Ruta no encontrada.' });
  } catch (error) {
    if (error instanceof OrchestratorError) {
      sendJson(response, 400, { error: error.message, codigo: error.code, detalle: error.detail });
      return;
    }
    sendJson(response, 500, { error: 'Ocurrió un error inesperado en la herramienta local.' });
  }
}

export function startPanelServer(
  orchestrator: Orchestrator,
  options: PanelServerOptions = {},
): Promise<{ server: http.Server; url: string }> {
  // Falla cerrado antes de crear el socket si el host no es loopback.
  const host = assertLoopbackBindHost(options.host ?? PANEL_HOST);
  const server = createPanelServer(orchestrator, { ...options, host });
  const port = options.port ?? PANEL_DEFAULT_PORT;

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      const address = server.address();
      const actualPort = typeof address === 'object' && address !== null ? address.port : port;
      resolve({ server, url: 'http://' + host + ':' + String(actualPort) + '/' });
    });
  });
}
