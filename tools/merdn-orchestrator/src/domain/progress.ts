/**
 * Huella de progreso y detección de loop (doc §10, FR-12, AC-07).
 *
 * Cada ciclo debe demostrar al menos un avance verificable. Dos ciclos
 * consecutivos sin progreso producen `LOOP_DETECTED`, igual que la
 * repetición exacta o la oscilación A↔B de la huella normalizada.
 */

import { stableHash } from './ids.ts';

/** Señales de avance aprobadas (doc §10). */
export const PROGRESS_SIGNALS = [
  'archivo_esperado_creado_o_modificado',
  'test_nuevo_pasa',
  'bloqueo_eliminado',
  'estado_avanza',
  'review_avanza_hacia_pass',
] as const;
export type ProgressSignal = (typeof PROGRESS_SIGNALS)[number];

export interface CycleObservation {
  /** Hash de la Task vigente. */
  readonly taskHash: string | null;
  /** Identificadores de findings abiertos. */
  readonly findings: readonly string[];
  /** Archivos modificados por el ciclo, en ruta relativa POSIX. */
  readonly files: readonly string[];
  /** Resultados de pruebas: `nombre=pass|fail|not_run`. */
  readonly testResults: readonly string[];
  /** Clase de error del ciclo, si hubo. */
  readonly errorClass: string | null;
}

/** Huella normalizada: orden estable e independiente de la iteración. */
export function fingerprint(observation: CycleObservation): string {
  return stableHash({
    taskHash: observation.taskHash,
    findings: [...observation.findings].sort(),
    files: [...observation.files].map((f) => f.replace(/\\/g, '/')).sort(),
    testResults: [...observation.testResults].sort(),
    errorClass: observation.errorClass,
  });
}

export interface ProgressInput {
  readonly expectedFilesTouched: readonly string[];
  readonly newPassingTests: number;
  readonly blockersRemoved: number;
  readonly stateAdvanced: boolean;
  readonly reviewAdvancedTowardPass: boolean;
}

export interface ProgressAssessment {
  readonly hasProgress: boolean;
  readonly signals: readonly ProgressSignal[];
}

export function assessProgress(input: ProgressInput): ProgressAssessment {
  const signals: ProgressSignal[] = [];
  if (input.expectedFilesTouched.length > 0) {
    signals.push('archivo_esperado_creado_o_modificado');
  }
  if (input.newPassingTests > 0) {
    signals.push('test_nuevo_pasa');
  }
  if (input.blockersRemoved > 0) {
    signals.push('bloqueo_eliminado');
  }
  if (input.stateAdvanced) {
    signals.push('estado_avanza');
  }
  if (input.reviewAdvancedTowardPass) {
    signals.push('review_avanza_hacia_pass');
  }
  return { hasProgress: signals.length > 0, signals };
}

export type LoopReason = 'repeticion_exacta' | 'oscilacion_a_b' | 'ciclos_sin_progreso';

export interface LoopAssessment {
  readonly loopDetected: boolean;
  readonly reason?: LoopReason;
  readonly detail?: string;
}

export interface LoopInput {
  /** Huellas en orden cronológico, la última es la del ciclo recién cerrado. */
  readonly fingerprints: readonly string[];
  /** Ciclos consecutivos sin progreso, incluido el recién cerrado. */
  readonly consecutiveCyclesWithoutProgress: number;
  readonly maxCyclesWithoutProgress: number;
}

export function detectLoop(input: LoopInput): LoopAssessment {
  const fps = input.fingerprints;

  if (fps.length >= 2 && fps[fps.length - 1] === fps[fps.length - 2]) {
    return { loopDetected: true, reason: 'repeticion_exacta', detail: 'huella_identica_consecutiva' };
  }

  if (fps.length >= 3) {
    const [a, b, c] = [fps[fps.length - 3], fps[fps.length - 2], fps[fps.length - 1]];
    if (a === c && a !== b) {
      return { loopDetected: true, reason: 'oscilacion_a_b', detail: 'alternancia_entre_dos_huellas' };
    }
  }

  if (input.consecutiveCyclesWithoutProgress >= input.maxCyclesWithoutProgress) {
    return {
      loopDetected: true,
      reason: 'ciclos_sin_progreso',
      detail:
        'ciclos_sin_progreso=' +
        String(input.consecutiveCyclesWithoutProgress) +
        '/' +
        String(input.maxCyclesWithoutProgress),
    };
  }

  return { loopDetected: false };
}
