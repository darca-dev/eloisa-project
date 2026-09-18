/**
 * Adapters simulados para construir y probar el Runtime sin CLI reales
 * (AD-12, FR-05, T-20, AC-13).
 *
 * Los mocks respetan el mismo contrato y las mismas validaciones que los
 * adapters reales. No sustituyen la prueba end-to-end con CLI reales.
 */

import type {
  AgentAdapter,
  AgentInvocationResult,
  AgentOutput,
  AgentRequest,
  PreflightResult,
} from './types.ts';
import { buildContractBlock } from './contract.ts';
import type { ProcessRequest, ProcessResult } from './process.ts';
import { createFakeRunner } from './process.ts';

export interface MockScript {
  /** Resultado que devuelve la siguiente invocación. */
  readonly result: Omit<Partial<AgentInvocationResult>, 'output'> & {
    readonly output?: Partial<AgentOutput>;
  };
}

export function emptyOutput(): AgentOutput {
  return {
    summary: '',
    files: [],
    tests: [],
    findings: [],
    materialQuestions: [],
    newDependencies: [],
    verdict: null,
    readyForClaude: null,
    stopConditions: [],
    usage: { reported: false, detail: null },
  };
}

export function mockOutput(partial: Partial<AgentOutput>): AgentOutput {
  return { ...emptyOutput(), ...partial };
}

/**
 * Adapter simulado con respuestas programadas.
 * Registra cada solicitud para verificar que los gates se respetaron.
 */
export class MockAgentAdapter implements AgentAdapter {
  readonly name: 'codex' | 'claude';
  readonly requests: AgentRequest[] = [];
  private readonly queue: MockScript[];
  private readonly preflightResult: PreflightResult;

  constructor(
    name: 'codex' | 'claude',
    options: { preflight?: Partial<PreflightResult>; script?: readonly MockScript[] } = {},
  ) {
    this.name = name;
    this.queue = [...(options.script ?? [])];
    this.preflightResult = {
      ok: true,
      binary: name,
      version: name + '-mock 0.0.0',
      authenticated: 'unknown',
      errorClass: null,
      ...options.preflight,
    };
  }

  enqueue(script: MockScript): void {
    this.queue.push(script);
  }

  get pending(): number {
    return this.queue.length;
  }

  async preflight(): Promise<PreflightResult> {
    return this.preflightResult;
  }

  async run(request: AgentRequest): Promise<AgentInvocationResult> {
    this.requests.push(request);
    const next = this.queue.shift();

    const base: AgentInvocationResult = {
      ok: true,
      agent: this.name,
      phase: request.phase,
      sessionId: request.sessionId ?? this.name + '-session-' + String(this.requests.length),
      command: this.name + ' (mock)',
      exitCode: 0,
      errorClass: null,
      transient: false,
      output: mockOutput({ summary: 'mock sin guion' }),
      rawSummary: 'mock',
      durationMs: 1,
    };

    if (next === undefined) {
      return base;
    }

    const { output, ...rest } = next.result;
    return {
      ...base,
      ...rest,
      output:
        output === undefined
          ? rest.ok === false
            ? null
            : base.output
          : mockOutput(output),
    };
  }
}

/** Runner falso que simula la ausencia total del binario (ENOENT). */
export function missingBinaryRunner(binary: string) {
  return createFakeRunner((request: ProcessRequest): Partial<ProcessResult> => {
    if (request.command === binary) {
      return { exitCode: null, spawnError: 'spawn ' + binary + ' ENOENT' };
    }
    return { exitCode: 0, stdout: '' };
  });
}

/** Runner falso que responde a `--version` y devuelve una salida programada. */
export function scriptedRunner(
  responses: Record<string, Partial<ProcessResult>>,
  fallback: Partial<ProcessResult> = { exitCode: 0, stdout: '' },
) {
  return createFakeRunner((request: ProcessRequest): Partial<ProcessResult> => {
    const key = request.command + ' ' + (request.args[0] ?? '');
    return responses[key] ?? responses[request.command] ?? fallback;
  });
}

/** Bloque de contrato válido, útil para simular salidas reales. */
export function contractStdout(payload: Record<string, unknown>): string {
  return 'Trabajo simulado.\n' + buildContractBlock(payload);
}
