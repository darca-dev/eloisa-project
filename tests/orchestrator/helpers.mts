/**
 * Utilidades compartidas por las pruebas del MERDN Orchestrator V1.
 * Todo es ficticio: no hay credenciales, rutas reales ni datos sensibles.
 */

import { Store } from '../../tools/merdn-orchestrator/src/store/store.ts';
import { Orchestrator } from '../../tools/merdn-orchestrator/src/runtime/engine.ts';
import type { Sleeper } from '../../tools/merdn-orchestrator/src/runtime/engine.ts';
import { MockAgentAdapter, mockOutput } from '../../tools/merdn-orchestrator/src/adapters/mocks.ts';
import type { AgentOutput } from '../../tools/merdn-orchestrator/src/adapters/types.ts';
import {
  ScriptedWorkspaceProbe,
  cleanBaseline,
  dirtyBaseline,
} from '../../tools/merdn-orchestrator/src/workspace/probe.ts';
import type { WorkspaceBaseline } from '../../tools/merdn-orchestrator/src/workspace/git.ts';
import { known } from '../../tools/merdn-orchestrator/src/runtime/metrics.ts';
import type { MetricValue, RunMeasurement } from '../../tools/merdn-orchestrator/src/runtime/metrics.ts';
import { emptyMeasurement } from '../../tools/merdn-orchestrator/src/runtime/metrics.ts';

export { cleanBaseline, dirtyBaseline, mockOutput };

/** Espera instantánea que registra los backoff solicitados (auditoría §7). */
export interface FakeSleeper {
  readonly sleep: Sleeper;
  readonly waits: number[];
}

export function createFakeSleeper(onSleep?: (ms: number) => void): FakeSleeper {
  const waits: number[] = [];
  const sleep: Sleeper = async (ms) => {
    waits.push(ms);
    onSleep?.(ms);
  };
  return { sleep, waits };
}

export interface Harness {
  readonly store: Store;
  readonly codex: MockAgentAdapter;
  readonly claude: MockAgentAdapter;
  readonly probe: ScriptedWorkspaceProbe;
  readonly orchestrator: Orchestrator;
  readonly sleeper: FakeSleeper;
  close(): void;
}

export function createHarness(
  options: {
    readonly baselines?: readonly WorkspaceBaseline[];
    readonly claudePreflightOk?: boolean;
    readonly holder?: string;
    readonly store?: Store;
    readonly onSleep?: (ms: number) => void;
  } = {},
): Harness {
  const store = options.store ?? Store.open(':memory:');
  const codex = new MockAgentAdapter('codex');
  const claude = new MockAgentAdapter('claude', {
    preflight:
      options.claudePreflightOk === false
        ? {
            ok: false,
            version: null,
            errorClass: 'preflight',
            reason: 'claude_cli_no_disponible',
            message: 'Claude Code necesita habilitarse para continuar.',
          }
        : undefined,
  });
  const probe = new ScriptedWorkspaceProbe(options.baselines ?? [cleanBaseline()]);
  const sleeper = createFakeSleeper(options.onSleep);
  const orchestrator = new Orchestrator({
    store,
    codex,
    claude,
    workspace: probe,
    holder: options.holder ?? 'prueba',
    sleep: sleeper.sleep,
  });

  return {
    store,
    codex,
    claude,
    probe,
    orchestrator,
    sleeper,
    close: () => store.close(),
  };
}

/** Propuesta válida de Codex: Task lista y sin decisiones materiales. */
export function propuestaLista(partial: Partial<AgentOutput> = {}): AgentOutput {
  return mockOutput({
    summary: 'Propuesta de Task para la necesidad solicitada.',
    readyForClaude: true,
    ...partial,
  });
}

/** Implementación válida de Claude dentro de los archivos permitidos. */
export function implementacionValida(partial: Partial<AgentOutput> = {}): AgentOutput {
  return mockOutput({
    summary: 'Implementación completada dentro de los archivos permitidos.',
    files: [{ path: 'tools/merdn-orchestrator/src/demo.ts', changeType: 'creado' }],
    tests: [{ name: 'unit demo', command: 'npm run orchestrator:test', result: 'pass' }],
    ...partial,
  });
}

/**
 * VER + APROBAR: el Product Owner sólo puede aprobar lo que vio
 * (corrección de auditoría §2).
 */
export function verYAprobar(harness: Harness, runId: string) {
  const visto = harness.orchestrator.ver(runId);
  const hash = (visto.detail?.['hashVisto'] as string | null) ?? null;
  const estado = harness.orchestrator.view(runId).state;
  return estado === 'ESPERANDO_APROBACION_VISUAL'
    ? harness.orchestrator.aprobarResultado(runId, hash)
    : harness.orchestrator.aprobarPropuesta(runId, hash);
}

/** Lleva una ejecución hasta `TASK_READY` con propuesta vista y aprobada. */
export async function hastaTaskReady(harness: Harness, texto = 'Quiero un tablero simple.'): Promise<string> {
  harness.codex.enqueue({ result: { output: propuestaLista() } });
  const creado = harness.orchestrator.crear(texto, 'ASISTIDO');
  await harness.orchestrator.prepararPropuesta(creado.runId, { confirmado: true });
  verYAprobar(harness, creado.runId);
  return creado.runId;
}

/** Medición con valores conocidos, para pruebas de comparación. */
export function medicion(valores: Partial<Record<keyof RunMeasurement, number>>): RunMeasurement {
  const base = emptyMeasurement();
  const result: Record<string, MetricValue> = { ...base };
  for (const [key, value] of Object.entries(valores)) {
    if (typeof value === 'number') {
      result[key] = known(value);
    }
  }
  return result as unknown as RunMeasurement;
}
