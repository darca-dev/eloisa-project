/**
 * Punto de entrada del MERDN Orchestrator V1.
 *
 * Arranca el panel local en `127.0.0.1`, abre la base `node:sqlite` bajo
 * `.merdn/` y reconcilia ejecuciones interrumpidas antes de aceptar órdenes.
 *
 * Uso:
 *   node tools/merdn-orchestrator/src/main.ts [--port 4319] [--mock] [--purgar-journal]
 *
 * `--mock` usa adapters simulados: permite operar el panel sin Codex ni
 * Claude Code instalados. Nunca activa APIs pagas ni claves.
 */

import process from 'node:process';

import { DB_PATH, PANEL_DEFAULT_PORT, PANEL_HOST, REPO_ROOT } from './config.ts';
import { Store } from './store/store.ts';
import { Orchestrator } from './runtime/engine.ts';
import { CodexAdapter } from './adapters/codex.ts';
import { ClaudeAdapter } from './adapters/claude.ts';
import { MockAgentAdapter } from './adapters/mocks.ts';
import { GitWorkspaceProbe } from './workspace/probe.ts';
import { startPanelServer } from './ui/server.ts';

function out(text: string): void {
  process.stdout.write(text + '\n');
}

function parsePort(argv: readonly string[]): number {
  const index = argv.indexOf('--port');
  if (index === -1) {
    return PANEL_DEFAULT_PORT;
  }
  const value = Number(argv[index + 1]);
  return Number.isInteger(value) && value > 0 && value < 65_536 ? value : PANEL_DEFAULT_PORT;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const useMocks = argv.includes('--mock');
  const store = Store.open(DB_PATH);

  if (argv.includes('--purgar-journal')) {
    const removed = store.purgeJournalOlderThan();
    out('Journal purgado manualmente. Eventos eliminados: ' + String(removed));
    store.close();
    return;
  }

  const codex = useMocks ? new MockAgentAdapter('codex') : new CodexAdapter();
  const claude = useMocks ? new MockAgentAdapter('claude') : new ClaudeAdapter();
  const orchestrator = new Orchestrator({
    store,
    codex,
    claude,
    workspace: new GitWorkspaceProbe(),
    repoRoot: REPO_ROOT,
  });

  const reconciled = orchestrator.reconcile();
  if (reconciled.length > 0) {
    out('Ejecuciones reconciliadas tras un cierre previo: ' + String(reconciled.length) + ' (quedaron detenidas).');
  }

  const { server, url } = await startPanelServer(orchestrator, { port: parsePort(argv), host: PANEL_HOST });

  out('MERDN Orchestrator V1');
  out('Panel local: ' + url);
  out('Base de datos: ' + DB_PATH);
  out('Adapters: ' + (useMocks ? 'simulados (--mock)' : 'Codex CLI y Claude Code CLI reales'));
  out('Esta herramienta nunca hace commit ni push. Ctrl+C para salir.');

  const cerrar = (): void => {
    server.close(() => {
      store.close();
      process.exit(0);
    });
  };
  process.on('SIGINT', cerrar);
  process.on('SIGTERM', cerrar);
}

await main();
