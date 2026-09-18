/**
 * Workspace guard (doc §12, FR-15, AC-06, T-09, T-21).
 *
 * Precondiciones obligatorias antes de invocar un agente: working tree
 * limpio o con cambios reconocidos, baseline registrado, allowlist activa.
 * Ante cambios no reconocidos: `PAUSED`, sin revertir nada.
 */

import { DEFAULT_ALLOWED_PATHS } from '../config.ts';
import { classifyPaths, isForbiddenPath, toPosix } from './paths.ts';
import type { WorkspaceBaseline } from './git.ts';
import { baselineDelta } from './git.ts';

export interface WorkspaceVerdict {
  /** ¿Se puede invocar un agente? */
  readonly ok: boolean;
  /** Estado sugerido cuando no se puede continuar. */
  readonly suggestedState?: 'PAUSED' | 'STOP_CONDITION';
  readonly reason?: string;
  readonly message?: string;
  /** Cambios presentes que no produjo esta Task. */
  readonly unrecognized: readonly string[];
  /** Todos los cambios presentes, reconocidos o no. */
  readonly dirty: readonly string[];
  readonly forbidden: readonly string[];
}

/**
 * El estado local del Orchestrator nunca cuenta como working tree sucio:
 * `.merdn/` está en `.gitignore` y además se filtra explícitamente.
 */
export function isRuntimeStatePath(relativePath: string): boolean {
  const normalized = toPosix(relativePath);
  return normalized === '.merdn' || normalized.startsWith('.merdn/');
}

/**
 * Verifica el working tree antes de invocar un agente (FR-15, doc §12).
 *
 * Regla aprobada, corregida tras auditoría: **antes de comenzar una Task
 * automatizada el working tree debe estar limpio**. Cualquier cambio
 * versionado y no ignorado produce `PAUSED`, sea reconocido o no.
 *
 * Una vez que la Task ya comenzó (`taskStarted`), puede existir el diff que
 * ella misma produjo; ese diff se sigue comparando contra baseline y
 * allowlist, y cualquier cambio ajeno vuelve a pausar.
 *
 * Nunca se borra, revierte ni oculta nada para conseguir limpieza.
 */
export function checkWorkingTreeBeforeStart(
  baseline: WorkspaceBaseline,
  recognized: ReadonlySet<string>,
  options: { readonly taskStarted: boolean },
): WorkspaceVerdict {
  const dirty = baseline.entries
    .map((entry) => entry.path)
    .filter((file) => !isRuntimeStatePath(file))
    .sort();

  const unrecognized = dirty.filter((file) => !recognized.has(file));
  const forbidden = dirty.filter((file) => isForbiddenPath(file));

  if (!options.taskStarted && dirty.length > 0) {
    return {
      ok: false,
      suggestedState: 'PAUSED',
      reason: 'working_tree_sucio_al_iniciar',
      message:
        'El proyecto tiene cambios sin guardar. Antes de empezar un trabajo automatizado debe estar limpio. No se borró ni se revirtió nada: tú decides qué hacer con esos cambios.',
      unrecognized,
      dirty,
      forbidden,
    };
  }

  if (unrecognized.length > 0) {
    return {
      ok: false,
      suggestedState: 'PAUSED',
      reason: 'cambios_locales_no_reconocidos',
      message:
        'Hay cambios en el proyecto que el Orchestrator no reconoce. Nada se borró ni se revirtió; tú decides cómo seguir.',
      unrecognized,
      dirty,
      forbidden,
    };
  }

  return { ok: true, unrecognized: [], dirty, forbidden: [] };
}

export interface ScopeVerdict {
  readonly ok: boolean;
  readonly changed: readonly string[];
  readonly inScope: readonly string[];
  readonly outOfScope: readonly string[];
  readonly forbidden: readonly string[];
  readonly reason?: string;
  readonly message?: string;
}

/**
 * Compara baselines antes/después y clasifica lo que cambió.
 * Nunca revierte: sólo informa y detiene.
 */
export function checkScopeAfterInvocation(
  before: WorkspaceBaseline,
  after: WorkspaceBaseline,
  allowedPaths: readonly string[] = DEFAULT_ALLOWED_PATHS,
): ScopeVerdict {
  const changed = baselineDelta(before, after).filter((file) => !isRuntimeStatePath(file));
  const classification = classifyPaths(changed, allowedPaths);

  if (classification.outOfScope.length > 0) {
    return {
      ok: false,
      changed,
      inScope: classification.inScope,
      outOfScope: classification.outOfScope,
      forbidden: classification.forbidden,
      reason: 'archivos_fuera_de_alcance',
      message: 'Se modificaron archivos fuera de lo aprobado. La ejecución se detuvo sin deshacer nada.',
    };
  }

  return {
    ok: true,
    changed,
    inScope: classification.inScope,
    outOfScope: [],
    forbidden: [],
  };
}

/** Rutas propuestas por un agente, validadas antes de permitir escritura. */
export function checkProposedPaths(
  proposed: readonly string[],
  allowedPaths: readonly string[] = DEFAULT_ALLOWED_PATHS,
): ScopeVerdict {
  const normalized = proposed.map((p) => toPosix(p));
  const classification = classifyPaths(normalized, allowedPaths);
  const ok = classification.outOfScope.length === 0;
  return {
    ok,
    changed: normalized,
    inScope: classification.inScope,
    outOfScope: classification.outOfScope,
    forbidden: classification.forbidden,
    reason: ok ? undefined : 'archivos_fuera_de_alcance',
    message: ok ? undefined : 'La propuesta incluye archivos fuera de lo aprobado.',
  };
}
