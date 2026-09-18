/**
 * Motor del Orchestrator: comandos predefinidos, gates, presupuesto,
 * anti-loop, workspace guard, recuperación y trazabilidad.
 *
 * Fuente: docs/MERDN-ORCHESTRATOR-V1.md §§4, 6-14 y FR-01..FR-22.
 * El motor no decide producto: cuando falta una decisión material, detiene.
 */

import fs from 'node:fs';
import path from 'node:path';

import { DEFAULT_ALLOWED_PATHS, LIMITS, REPO_ROOT } from '../config.ts';
import { assessBudget } from '../domain/budget.ts';
import type { GateContext, GateId, GateResult } from '../domain/gates.ts';
import { emptyGateContext, evaluateGates } from '../domain/gates.ts';
import { idempotencyKey, newId, sha256, stableHash } from '../domain/ids.ts';
import type { Mode } from '../domain/modes.ts';
import { INITIAL_MODE, decideForEvent, isMode } from '../domain/modes.ts';
import { assessProgress, detectLoop, fingerprint } from '../domain/progress.ts';
import { scanForSecrets } from '../domain/redaction.ts';
import type { Actor, State, WorkflowEvent } from '../domain/states.ts';
import { availableTransitions, checkTransition, isTerminal } from '../domain/states.ts';
import { OrchestratorError } from '../domain/errors.ts';
import type { Store, RunRow, TaskRow } from '../store/store.ts';
import { ConcurrencyError } from '../store/store.ts';
import type { AgentAdapter, AgentInvocationResult, AgentPhase } from '../adapters/types.ts';
import type { WorkspaceProbe } from '../workspace/probe.ts';
import { checkScopeAfterInvocation, checkWorkingTreeBeforeStart } from '../workspace/guard.ts';
import type { WorkspaceBaseline } from '../workspace/git.ts';
import { buildContextPack } from './context.ts';
import { planFailure, reconcileOnStart, saveCheckpoint } from './recovery.ts';
import type { Comparison, MetricValue, RunMeasurement } from './metrics.ts';
import { compare, emptyMeasurement, known, serializeMeasurement, unknownMetric } from './metrics.ts';

/**
 * Espera cancelable usada por el backoff. Inyectable para que las pruebas
 * controlen el tiempo sin volverse lentas.
 */
export type Sleeper = (ms: number, signal?: AbortSignal) => Promise<void>;

/** Backoff real: espera de verdad y se cancela con DETENER. */
export const realSleeper: Sleeper = (ms, signal) =>
  new Promise((resolve) => {
    if (signal?.aborted === true || ms <= 0) {
      resolve();
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = (): void => {
      clearTimeout(timer);
      resolve();
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });

export interface EngineDeps {
  readonly store: Store;
  readonly codex: AgentAdapter;
  readonly claude: AgentAdapter;
  readonly workspace: WorkspaceProbe;
  readonly holder?: string;
  readonly allowedPaths?: readonly string[];
  readonly repoRoot?: string;
  /** Espera del backoff; por defecto usa temporizadores reales. */
  readonly sleep?: Sleeper;
}

export interface PanelAction {
  readonly id: string;
  readonly label: string;
  /** `principal` se muestra primero; `detener` siempre visible. */
  readonly kind: 'principal' | 'secundaria' | 'detener' | 'destructiva';
  readonly requiresConfirmation?: boolean;
}

export interface RunView {
  readonly id: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly requestText: string;
  readonly mode: Mode;
  readonly state: State;
  readonly version: number;
  readonly resumeState: State | null;
  readonly interruptReason: string | null;
  readonly headline: string;
  readonly explanation: string;
  readonly nextAction: string;
  readonly actions: readonly PanelAction[];
  readonly pendingDecisions: readonly { id: string; question: string }[];
  readonly blockingGates: readonly GateResult[];
  readonly technical: Record<string, unknown>;
  readonly journal: readonly { at: string; kind: string; actor: string; result: string | null }[];
}

export interface ActionResult {
  readonly ok: boolean;
  readonly runId: string;
  readonly state: State;
  readonly mode: Mode;
  readonly message: string;
  readonly reason?: string;
  readonly blocking?: readonly GateResult[];
  readonly requiresConfirmation?: boolean;
  readonly detail?: Record<string, unknown>;
}

interface TransitionExtras {
  readonly workspaceClean?: boolean;
  readonly baselineRecorded?: boolean;
  readonly preflightOk?: boolean;
  readonly budgetAvailable?: boolean;
  readonly lockAcquired?: boolean;
  readonly outOfScopeFiles?: readonly string[];
  readonly newDependencyRequested?: boolean;
  readonly destructiveActionRequested?: boolean;
  readonly sensitivePermissionsRequested?: boolean;
  readonly spendRequested?: boolean;
  readonly visualDivergence?: boolean;
  readonly deployRequested?: boolean;
  readonly secretsDetected?: boolean;
  readonly commitAuthorization?: { diffHash: string; authorizedBy: string } | null;
  readonly preparedDiffHash?: string | null;
}

interface TransitionOptions {
  readonly reason?: string;
  readonly extras?: TransitionExtras;
  readonly expectedVersion?: number;
  readonly idempotencySalt?: string;
  readonly interruptReason?: string | null;
}

interface TransitionOutcome {
  readonly ok: boolean;
  readonly run: RunRow;
  readonly blocking?: readonly GateResult[];
  readonly reason?: string;
}

/**
 * Códigos de hallazgo que la revisión usa para reportar que un agente tomó
 * una decisión material por su cuenta.
 */
const DECISION_INVENTADA_CODES: readonly string[] = ['decision_inventada', 'DECISION_INVENTADA'];

const STATE_TEXT: Record<State, { headline: string; explanation: string; next: string }> = {
  IDEA: {
    headline: 'Solicitud registrada',
    explanation: 'Guardamos lo que quieres lograr. Todavía no se ha hecho ningún cambio.',
    next: 'Pide preparar la propuesta cuando quieras.',
  },
  ANALISIS: {
    headline: 'Preparando propuesta',
    explanation: 'Se está analizando tu solicitud para proponerte un plan de trabajo.',
    next: 'Espera la propuesta o detén el proceso.',
  },
  ESPERANDO_PRODUCT_OWNER: {
    headline: 'Necesitamos tu decisión',
    explanation: 'Hay algo que sólo tú puedes decidir. Nada avanza hasta que respondas.',
    next: 'Responde la pregunta pendiente.',
  },
  TASK_READY: {
    headline: 'Propuesta aprobada',
    explanation: 'El plan quedó aprobado y con todo lo necesario para empezar.',
    next: 'Confirma para comenzar la implementación.',
  },
  IMPLEMENTANDO: {
    headline: 'Implementando',
    explanation: 'Se está haciendo el trabajo aprobado dentro de los archivos permitidos.',
    next: 'Puedes detener el proceso en cualquier momento.',
  },
  QA: {
    headline: 'En revisión',
    explanation: 'El resultado se está revisando contra lo aprobado.',
    next: 'Espera el resultado de la revisión.',
  },
  CHANGES_REQUIRED: {
    headline: 'Hay que corregir',
    explanation: 'La revisión encontró cosas por corregir dentro del alcance aprobado.',
    next: 'Confirma para aplicar las correcciones.',
  },
  ESPERANDO_APROBACION_VISUAL: {
    headline: 'Revisión completada',
    explanation: 'El trabajo pasó la revisión técnica y espera tu aprobación.',
    next: 'Revisa el resultado y decide.',
  },
  APROBADO: {
    headline: 'Resultado aprobado',
    explanation: 'Aprobaste el resultado. No se ha hecho ningún commit.',
    next: 'Se prepara el cierre para que tú autorices el commit.',
  },
  READY_FOR_COMMIT: {
    headline: 'Listo para que autorices el commit',
    explanation: 'El trabajo está terminado y guardado en tu computador. El commit lo decides tú.',
    next: 'Autoriza el commit por fuera de esta herramienta cuando quieras.',
  },
  COMMITTED: {
    headline: 'Commit registrado',
    explanation: 'Se registró un commit autorizado por ti.',
    next: 'No hay más acciones.',
  },
  PAUSED: {
    headline: 'Detenido',
    explanation: 'El proceso está detenido. Tu trabajo y tu código se conservaron.',
    next: 'Continúa o cancela cuando decidas.',
  },
  API_ERROR: {
    headline: 'Error del agente',
    explanation: 'Un agente falló. No se borró ni se revirtió nada de tu código.',
    next: 'Puedes continuar o detener definitivamente.',
  },
  LOOP_DETECTED: {
    headline: 'Sin avance',
    explanation: 'El trabajo dejó de avanzar y se detuvo para no gastar recursos.',
    next: 'Toma una decisión sobre cómo seguir.',
  },
  BUDGET_LIMIT: {
    headline: 'Límite alcanzado',
    explanation: 'Se alcanzó el máximo de intentos permitido.',
    next: 'Toma una decisión sobre cómo seguir.',
  },
  STOP_CONDITION: {
    headline: 'Condición de parada',
    explanation: 'Apareció algo que requiere tu decisión antes de continuar.',
    next: 'Revisa el detalle y decide.',
  },
  RECHAZADO: {
    headline: 'Rechazado',
    explanation: 'Rechazaste este trabajo. El historial se conserva completo.',
    next: 'No hay más acciones.',
  },
  CANCELADO: {
    headline: 'Cancelado',
    explanation: 'Cerraste esta solicitud antes de aceptarla. El historial se conserva completo.',
    next: 'No hay más acciones.',
  },
};

export class Orchestrator {
  private readonly store: Store;
  private readonly codex: AgentAdapter;
  private readonly claude: AgentAdapter;
  private readonly workspace: WorkspaceProbe;
  private readonly holder: string;
  private readonly allowedPaths: readonly string[];
  private readonly repoRoot: string;
  private readonly sleep: Sleeper;
  private readonly abortControllers = new Map<string, AbortController>();

  constructor(deps: EngineDeps) {
    this.store = deps.store;
    this.codex = deps.codex;
    this.claude = deps.claude;
    this.workspace = deps.workspace;
    this.holder = deps.holder ?? 'orchestrator-' + String(process.pid) + '-' + newId('h');
    this.allowedPaths = deps.allowedPaths ?? DEFAULT_ALLOWED_PATHS;
    this.repoRoot = deps.repoRoot ?? REPO_ROOT;
    this.sleep = deps.sleep ?? realSleeper;
  }

  get holderId(): string {
    return this.holder;
  }

  /** FR-18: reconciliación obligatoria al arrancar. */
  reconcile(): readonly { runId: string; previousState: State }[] {
    return reconcileOnStart(this.store);
  }

  // ------------------------------------------------------------------ lectura

  listRuns(): readonly RunView[] {
    return this.store.listRuns().map((run) => this.view(run.id));
  }

  view(runId: string): RunView {
    const run = this.requireRun(runId);
    const task = this.store.getTask(runId);
    const pending = this.store
      .listDecisions(runId)
      .filter((d) => d.status === 'pendiente')
      .map((d) => ({ id: d.id, question: d.question }));
    const text = STATE_TEXT[run.state];
    const counters = this.store.getCounters(runId);
    const proposalReady = this.isProposalReady(run, task);

    return {
      id: run.id,
      createdAt: run.created_at,
      updatedAt: run.updated_at,
      requestText: run.request_text,
      mode: run.mode,
      state: run.state,
      version: run.version,
      resumeState: run.resume_state,
      interruptReason: run.interrupt_reason,
      headline: proposalReady && run.state === 'ANALISIS' ? 'Propuesta preparada' : text.headline,
      explanation:
        proposalReady && run.state === 'ANALISIS'
          ? 'Hay una propuesta lista para que la revises. Todavía no se ha implementado nada.'
          : text.explanation,
      nextAction: text.next,
      actions: this.actionsFor(run, task, pending.length > 0, proposalReady),
      pendingDecisions: pending,
      blockingGates: this.previewBlockingGates(run),
      technical: {
        task:
          task === undefined
            ? null
            : {
                path: task.task_path,
                title: task.task_title,
                hash: task.task_hash,
                hashAprobado: task.task_hash_approved,
                readyForClaude: task.ready_for_claude === 1,
                version: task.task_version,
              },
        contadores: counters,
        limites: LIMITS,
        archivosPermitidos: this.allowedPaths,
        invocaciones: this.store.listInvocations(runId).map((inv) => ({
          agente: inv.agent,
          fase: inv.phase,
          resultado: inv.outcome,
          errorClass: inv.error_class,
          sesion: inv.session_id,
          contextoChars: inv.context_chars,
        })),
        archivosTocados: this.store.listFileChanges(runId).map((f) => ({
          ruta: f.path,
          tipo: f.change_type,
          enAlcance: f.in_scope === 1,
        })),
        pruebas: this.store.listTests(runId).map((t) => ({ nombre: t.name, resultado: t.result })),
        errores: this.store.listErrors(runId),
        transiciones: this.store.listTransitions(runId).map((t) => ({
          de: t.from_state,
          a: t.to_state,
          evento: t.event,
          actor: t.actor,
          resultado: t.result,
          motivo: t.reason,
          at: t.created_at,
        })),
      },
      journal: this.store.listJournal(runId, 100).map((entry) => ({
        at: entry.created_at,
        kind: entry.kind,
        actor: entry.actor,
        result: entry.result,
      })),
    };
  }

  private isProposalReady(run: RunRow, task: TaskRow | undefined): boolean {
    return (
      run.state === 'ANALISIS' &&
      task !== undefined &&
      task.task_hash !== null &&
      this.store.countPendingMaterialDecisions(run.id) === 0
    );
  }

  private actionsFor(
    run: RunRow,
    task: TaskRow | undefined,
    hasPendingDecisions: boolean,
    proposalReady: boolean,
  ): readonly PanelAction[] {
    const actions: PanelAction[] = [];
    const asistido = run.mode === 'ASISTIDO';

    switch (run.state) {
      case 'IDEA':
        actions.push({ id: 'preparar_propuesta', label: 'PREPARAR PROPUESTA', kind: 'principal' });
        actions.push({ id: 'cancelar', label: 'CANCELAR', kind: 'destructiva' });
        break;
      case 'ANALISIS':
        if (proposalReady) {
          actions.push({ id: 'ver', label: 'VER', kind: 'secundaria' });
          actions.push({ id: 'aprobar', label: 'APROBAR', kind: 'principal' });
          actions.push({ id: 'cambiar', label: 'CAMBIAR', kind: 'secundaria' });
          actions.push({ id: 'rechazar', label: 'RECHAZAR', kind: 'destructiva' });
        } else if (!hasPendingDecisions) {
          actions.push({ id: 'preparar_propuesta', label: 'PREPARAR PROPUESTA', kind: 'principal' });
        }
        break;
      case 'ESPERANDO_PRODUCT_OWNER':
        actions.push({ id: 'responder', label: 'RESPONDER', kind: 'principal' });
        actions.push({ id: 'cancelar', label: 'CANCELAR', kind: 'destructiva' });
        break;
      case 'TASK_READY':
        actions.push({
          id: 'implementar',
          label: 'COMENZAR IMPLEMENTACIÓN',
          kind: 'principal',
          requiresConfirmation: asistido,
        });
        actions.push({ id: 'cancelar', label: 'CANCELAR', kind: 'destructiva' });
        break;
      case 'IMPLEMENTANDO':
        break;
      case 'QA':
        actions.push({ id: 'revisar', label: 'REVISAR', kind: 'principal' });
        break;
      case 'CHANGES_REQUIRED':
        actions.push({
          id: 'implementar',
          label: 'APLICAR CORRECCIONES',
          kind: 'principal',
          requiresConfirmation: asistido,
        });
        break;
      case 'ESPERANDO_APROBACION_VISUAL':
        actions.push({ id: 'ver', label: 'VER RESULTADO', kind: 'secundaria' });
        actions.push({ id: 'aprobar', label: 'APROBAR', kind: 'principal' });
        actions.push({ id: 'cambiar', label: 'CAMBIAR', kind: 'secundaria' });
        actions.push({ id: 'rechazar', label: 'RECHAZAR', kind: 'destructiva' });
        break;
      case 'APROBADO':
        actions.push({ id: 'preparar_commit', label: 'PREPARAR CIERRE', kind: 'principal' });
        break;
      case 'READY_FOR_COMMIT':
        actions.push({ id: 'ver', label: 'VER RESUMEN', kind: 'secundaria' });
        break;
      case 'PAUSED':
        actions.push({ id: 'continuar', label: 'CONTINUAR', kind: 'principal' });
        actions.push({ id: 'cancelar', label: 'CANCELAR', kind: 'destructiva' });
        break;
      case 'API_ERROR':
        actions.push({ id: 'continuar', label: 'CONTINUAR', kind: 'principal' });
        break;
      case 'LOOP_DETECTED':
      case 'BUDGET_LIMIT':
      case 'STOP_CONDITION':
        actions.push({ id: 'decidir', label: 'TOMAR UNA DECISIÓN', kind: 'principal' });
        break;
      default:
        break;
    }

    if (!isTerminal(run.state) && run.state !== 'PAUSED') {
      actions.push({ id: 'detener', label: 'DETENER', kind: 'detener' });
    }
    if (task === undefined && run.state === 'IDEA') {
      // Sin Task todavía: nada más que ofrecer.
    }
    return actions;
  }

  // ------------------------------------------------------------- transiciones

  /**
   * ¿Esta Task ya comenzó a producir cambios?
   * Sólo entonces se admite un working tree con diff propio.
   */
  private taskStarted(runId: string): boolean {
    const iniciada = this.store
      .listTransitions(runId)
      .some((t) => t.to_state === 'IMPLEMENTANDO' && t.result === 'aceptada');
    return iniciada || this.store.listFileChanges(runId).length > 0;
  }

  /** Hash estable de la propuesta aprobable (la Task vigente). */
  propuestaHash(runId: string): string | null {
    return this.currentTaskHash(this.store.getTask(runId));
  }

  /**
   * Hash estable del resultado aprobable: Task, archivos tocados, pruebas y
   * veredicto de la última revisión. Cambia si cambia cualquiera de ellos.
   */
  resultadoHash(runId: string): string | null {
    const task = this.store.getTask(runId);
    if (task === undefined) {
      return null;
    }
    return stableHash({
      taskHash: this.currentTaskHash(task),
      archivos: this.store
        .listFileChanges(runId)
        .map((f) => f.path + ':' + f.change_type)
        .sort(),
      pruebas: this.store
        .listTests(runId)
        .map((t) => t.name + '=' + t.result)
        .sort(),
      veredicto: this.store.lastReviewVerdict(runId),
      hallazgosAbiertos: this.store
        .listOpenFindings(runId)
        .map((f) => f.code)
        .sort(),
    });
  }

  /** Artefacto aprobable según el estado actual. */
  private approvableKind(state: State): 'propuesta' | 'resultado' | null {
    if (state === 'ANALISIS') {
      return 'propuesta';
    }
    if (state === 'ESPERANDO_APROBACION_VISUAL') {
      return 'resultado';
    }
    return null;
  }

  private approvableHash(runId: string, kind: 'propuesta' | 'resultado'): string | null {
    return kind === 'propuesta' ? this.propuestaHash(runId) : this.resultadoHash(runId);
  }

  /**
   * VER: registra la versión exacta que el Product Owner está viendo.
   * APROBAR sólo puede aceptar un hash previamente visto (auditoría §2).
   */
  ver(runId: string): ActionResult {
    const run = this.requireRun(runId);
    const kind = this.approvableKind(run.state);
    if (kind === null) {
      return this.result(run, true, 'Aquí no hay nada pendiente de aprobar; puedes revisar los detalles.', {
        detail: { hashVisto: null },
      });
    }

    const hash = this.approvableHash(runId, kind);
    if (hash === null) {
      return this.result(run, false, 'Todavía no hay nada preparado para revisar.', { reason: 'sin_artefacto' });
    }

    this.store.recordViewedVersion({ runId, kind, hash, state: run.state, actor: 'product_owner' });
    this.store.journal({
      runId,
      kind: 'version_vista',
      actor: 'product_owner',
      result: kind,
      payload: { hash, estado: run.state },
    });

    return this.result(run, true, 'Esto es lo que se propone. Si estás de acuerdo, puedes aprobarlo.', {
      detail: { tipo: kind, hashVisto: hash, contenido: this.describirArtefacto(runId, kind) },
    });
  }

  /** Descripción en lenguaje natural de lo que el Product Owner está viendo. */
  private describirArtefacto(runId: string, kind: 'propuesta' | 'resultado'): Record<string, unknown> {
    const task = this.store.getTask(runId);
    if (kind === 'propuesta') {
      return {
        titulo: task?.task_title ?? 'Propuesta sin título',
        archivoDeTask: task?.task_path ?? 'no se creó archivo de Task',
        listaParaImplementar: task?.ready_for_claude === 1,
      };
    }
    return {
      archivosTocados: this.store.listFileChanges(runId).map((f) => f.path),
      pruebas: this.store.listTests(runId).map((t) => t.name + ': ' + t.result),
      revision: this.store.lastReviewVerdict(runId),
      hallazgosAbiertos: this.store.listOpenFindings(runId).length,
    };
  }

  /**
   * Verificación común de APROBAR.
   *
   * El hash es OBLIGATORIO y explícito: nunca se infiere, ni se completa con
   * el último visto cuando la solicitud no lo envía. La aprobación sólo vale
   * si existe una versión vista, la solicitud trae `approvalHash`, y ese hash
   * coincide a la vez con la versión vista y con el artefacto actual.
   */
  private checkAprobacion(
    runId: string,
    kind: 'propuesta' | 'resultado',
    approvalHash: string | null,
  ): { ok: true; hash: string } | { ok: false; reason: string; message: string } {
    const actual = this.approvableHash(runId, kind);
    if (actual === null) {
      return { ok: false, reason: 'sin_artefacto', message: 'Todavía no hay nada para aprobar.' };
    }

    // 1. Debe existir una versión registrada por VER.
    const visto = this.store.lastViewedVersion(runId, kind);
    if (visto === null) {
      return {
        ok: false,
        reason: 'requiere_ver_antes_de_aprobar',
        message: 'Antes de aprobar necesitas ver qué se propone. Pulsa VER.',
      };
    }

    // 2. La solicitud debe traer el hash. No se infiere ni se completa.
    const enviado = approvalHash === null ? '' : approvalHash.trim();
    if (enviado.length === 0) {
      return {
        ok: false,
        reason: 'aprobacion_sin_hash',
        message: 'Para aprobar hay que indicar exactamente qué versión estás aprobando. Pulsa VER y vuelve a aprobar.',
      };
    }

    // 3. El hash enviado debe ser el que se vio.
    if (enviado !== visto) {
      return {
        ok: false,
        reason: 'aprobacion_stale',
        message: 'Estás aprobando una versión distinta de la que viste. Pulsa VER para revisar la versión actual.',
      };
    }

    // 4. Y debe seguir siendo el artefacto vigente.
    if (enviado !== actual) {
      return {
        ok: false,
        reason: 'aprobacion_stale',
        message: 'Esto cambió desde la última vez que lo viste. Pulsa VER para revisar la versión nueva.',
      };
    }

    return { ok: true, hash: actual };
  }

  /**
   * Registra una intervención del Product Owner **ya validada y aceptada**
   * que autoriza continuar, y sólo entonces reinicia la ventana de
   * invocaciones AI. El total histórico nunca se reinicia.
   *
   * Debe invocarse SIEMPRE después de aplicar la acción, nunca antes: una
   * acción rechazada por estado, payload, gate o hash no es una intervención
   * y no puede reiniciar la ventana.
   */
  private registrarIntervencion(runId: string, motivo: string): void {
    this.store.resetAiWindow(runId, motivo);
    this.store.recordMetric({
      runId,
      scenario: 'orchestrator',
      key: 'intervenciones_product_owner',
      value: '1',
      unit: 'conteo',
      source: 'runtime',
    });
  }

  private requireRun(runId: string): RunRow {
    const run = this.store.getRun(runId);
    if (run === undefined) {
      throw new OrchestratorError('run_inexistente', 'No existe la solicitud ' + runId);
    }
    return run;
  }

  /** Hash actual de la Task: se relee del archivo cuando existe (T-02). */
  private currentTaskHash(task: TaskRow | undefined): string | null {
    if (task === undefined) {
      return null;
    }
    if (task.task_path !== null) {
      const absolute = path.resolve(this.repoRoot, task.task_path);
      try {
        return sha256(fs.readFileSync(absolute, 'utf8'));
      } catch {
        return task.task_hash;
      }
    }
    return task.task_hash;
  }

  private buildGateContext(run: RunRow, extras: TransitionExtras = {}): GateContext {
    const task = this.store.getTask(run.id);
    const base = emptyGateContext();
    return {
      ...base,
      taskApproved: task?.task_hash_approved !== null && task?.task_hash_approved !== undefined,
      taskHashApproved: task?.task_hash_approved ?? null,
      taskHashCurrent: this.currentTaskHash(task),
      readyForClaudeDeclared: task?.ready_for_claude === 1,
      pendingMaterialDecisions: this.store.countPendingMaterialDecisions(run.id),
      allowedPathsDefined: this.allowedPaths.length > 0,
      forbiddenPathsDefined: true,
      acceptanceCriteriaDefined: task !== undefined,
      testsDefined: task !== undefined,
      recoveryDefined: true,
      workspaceClean: extras.workspaceClean ?? false,
      baselineRecorded: extras.baselineRecorded ?? false,
      preflightOk: extras.preflightOk ?? false,
      secretsDetected: extras.secretsDetected ?? false,
      budgetAvailable: extras.budgetAvailable ?? false,
      lockAcquired: extras.lockAcquired ?? this.store.hasLease(run.id, this.holder),
      newDependencyRequested: extras.newDependencyRequested ?? false,
      outOfScopeFiles: extras.outOfScopeFiles ?? [],
      destructiveActionRequested: extras.destructiveActionRequested ?? false,
      sensitivePermissionsRequested: extras.sensitivePermissionsRequested ?? false,
      spendRequested: extras.spendRequested ?? false,
      visualDivergence: extras.visualDivergence ?? false,
      requiresClaudeDesign: false,
      deployRequested: extras.deployRequested ?? false,
      commitAuthorization: extras.commitAuthorization ?? null,
      preparedDiffHash: extras.preparedDiffHash ?? null,
    };
  }

  /** Gates que hoy bloquearían la siguiente acción del flujo (informativo). */
  private previewBlockingGates(run: RunRow): readonly GateResult[] {
    const nextRule = availableTransitions(run.state, 'product_owner')[0];
    const gates: readonly GateId[] = nextRule?.gates ?? [];
    if (gates.length === 0) {
      return [];
    }
    return evaluateGates(gates, this.buildGateContext(run)).blocking;
  }

  private transition(
    runId: string,
    event: WorkflowEvent,
    actor: Actor,
    options: TransitionOptions = {},
  ): TransitionOutcome {
    const run = this.requireRun(runId);

    if (options.expectedVersion !== undefined && options.expectedVersion !== run.version) {
      this.store.journal({
        runId,
        kind: 'transicion_denegada',
        actor,
        result: 'denegada',
        reason: 'version_desactualizada',
        payload: { event, esperada: options.expectedVersion, actual: run.version },
      });
      return { ok: false, run, reason: 'version_desactualizada' };
    }

    const check = checkTransition(run.state, event, actor);
    if (!check.allowed || check.rule === undefined) {
      this.store.recordTransition({
        runId,
        from: run.state,
        to: run.state,
        event,
        actor,
        result: 'denegada',
        reason: check.reason ?? 'denegada',
        idempotencyKey: idempotencyKey([runId, run.state, event, actor, run.version, 'denegada', newId('d')]),
      });
      this.store.journal({
        runId,
        kind: 'transicion_denegada',
        actor,
        result: 'denegada',
        reason: check.reason ?? null,
        payload: { event, from: run.state },
      });
      return { ok: false, run, reason: check.reason };
    }

    const rule = check.rule;
    if (rule.gates.length > 0) {
      const evaluation = evaluateGates(rule.gates, this.buildGateContext(run, options.extras));
      if (!evaluation.passed) {
        this.store.recordTransition({
          runId,
          from: run.state,
          to: run.state,
          event,
          actor,
          result: 'denegada',
          reason: 'gate_bloqueante:' + evaluation.blocking.map((g) => g.id).join(','),
          idempotencyKey: idempotencyKey([runId, run.state, event, actor, run.version, 'gate', newId('g')]),
        });
        this.store.journal({
          runId,
          kind: 'gate_bloqueante',
          actor,
          result: 'denegada',
          reason: evaluation.blocking.map((g) => g.reason ?? g.id).join(','),
          payload: { event, gates: evaluation.blocking.map((g) => ({ id: g.id, detail: g.detail ?? [] })) },
        });
        return { ok: false, run, blocking: evaluation.blocking, reason: 'gate_bloqueante' };
      }
    }

    const target: State = rule.to === 'RESUME' ? (run.resume_state ?? 'IDEA') : rule.to;
    const key = idempotencyKey([
      runId,
      run.state,
      event,
      actor,
      run.version,
      options.idempotencySalt ?? '',
    ]);

    try {
      const updated = this.store.transaction(() => {
        const applied = this.store.recordTransition({
          runId,
          from: run.state,
          to: target,
          event,
          actor,
          result: 'aceptada',
          reason: options.reason ?? null,
          idempotencyKey: key,
        });
        if (!applied) {
          throw new ConcurrencyError('transicion_repetida');
        }
        const isInterruptTarget =
          target === 'PAUSED' ||
          target === 'API_ERROR' ||
          target === 'LOOP_DETECTED' ||
          target === 'BUDGET_LIMIT' ||
          target === 'STOP_CONDITION';
        return this.store.updateRun(runId, run.version, {
          state: target,
          resumeState: isInterruptTarget ? run.state : rule.to === 'RESUME' ? null : undefined,
          interruptReason: isInterruptTarget
            ? (options.interruptReason ?? options.reason ?? null)
            : rule.to === 'RESUME'
              ? null
              : undefined,
        });
      });

      this.store.journal({
        runId,
        kind: 'transicion',
        actor,
        result: 'aceptada',
        reason: options.reason ?? null,
        payload: { event, from: run.state, to: target },
      });
      return { ok: true, run: updated };
    } catch (error) {
      const reason = error instanceof ConcurrencyError ? error.message : 'transicion_fallida';
      this.store.journal({
        runId,
        kind: 'transicion_denegada',
        actor,
        result: 'denegada',
        reason,
        payload: { event, from: run.state },
      });
      return { ok: false, run: this.requireRun(runId), reason };
    }
  }

  private result(run: RunRow, ok: boolean, message: string, extra: Partial<ActionResult> = {}): ActionResult {
    const fresh = this.store.getRun(run.id) ?? run;
    return {
      ok,
      runId: fresh.id,
      state: fresh.state,
      mode: fresh.mode,
      message,
      ...extra,
    };
  }

  // ----------------------------------------------------------------- comandos

  /** FR-01: intake sin datos sensibles. */
  crear(requestText: string, mode: Mode = INITIAL_MODE): ActionResult {
    const text = requestText.trim();
    if (text.length === 0) {
      throw new OrchestratorError('solicitud_vacia', 'Escribe qué quieres lograr.');
    }
    if (text.length > 4_000) {
      throw new OrchestratorError('solicitud_muy_larga', 'La solicitud es demasiado larga.');
    }
    const scan = scanForSecrets(text);
    if (scan.found) {
      throw new OrchestratorError(
        'posible_secreto_en_solicitud',
        'Parece que el texto incluye una contraseña o clave. Quítala y vuelve a intentar.',
        scan.patterns,
      );
    }

    const run = this.store.createRun({ requestText: text, mode, state: 'IDEA' });
    this.store.journal({
      runId: run.id,
      kind: 'solicitud_creada',
      actor: 'product_owner',
      result: 'IDEA',
      payload: { modo: mode, caracteres: text.length },
    });
    this.store.recordMetric({
      runId: run.id,
      scenario: 'orchestrator',
      key: 'intervenciones_product_owner',
      value: '1',
      unit: 'conteo',
      source: 'runtime',
    });
    return this.result(run, true, 'Solicitud registrada. Todavía no se hizo ningún cambio.');
  }

  /** FR-03: el cambio de modo conserva estado, Task, decisiones y métricas. */
  cambiarModo(runId: string, mode: string): ActionResult {
    const run = this.requireRun(runId);
    if (!isMode(mode)) {
      throw new OrchestratorError('modo_invalido', 'Modo no reconocido: ' + mode);
    }
    const updated = this.store.updateRun(runId, run.version, { mode });
    this.store.journal({
      runId,
      kind: 'cambio_de_modo',
      actor: 'product_owner',
      result: mode,
      payload: { anterior: run.mode, nuevo: mode, estado: run.state },
    });
    return this.result(updated, true, 'Modo cambiado a ' + mode + '. Nada se perdió.');
  }

  detener(runId: string): ActionResult {
    const controller = this.abortControllers.get(runId);
    controller?.abort();
    const outcome = this.transition(runId, 'pausar', 'product_owner', {
      reason: 'detenido_por_product_owner',
    });
    return this.result(
      outcome.run,
      outcome.ok,
      outcome.ok
        ? 'Proceso detenido. Tu trabajo y tu código se conservaron.'
        : 'No se pudo detener desde este estado.',
      { reason: outcome.reason },
    );
  }

  continuar(runId: string): ActionResult {
    const outcome = this.transition(runId, 'reanudar', 'product_owner', { reason: 'reanudado_por_product_owner' });

    // Un CONTINUAR que el estado no admite no es una intervención válida y
    // por lo tanto no reinicia la ventana de invocaciones AI.
    if (outcome.ok) {
      this.registrarIntervencion(runId, 'reanudado_por_product_owner');
    }

    return this.result(outcome.run, outcome.ok, outcome.ok ? 'Continuamos.' : 'No se puede continuar desde este estado.', {
      reason: outcome.reason,
    });
  }

  cancelar(runId: string): ActionResult {
    const outcome = this.transition(runId, 'cancelar', 'product_owner', { reason: 'cancelado_por_product_owner' });
    return this.result(
      outcome.run,
      outcome.ok,
      outcome.ok ? 'Solicitud cancelada. El historial se conserva.' : 'No se puede cancelar desde este estado.',
      { reason: outcome.reason },
    );
  }

  decidirInterrupcion(runId: string, nota: string): ActionResult {
    const run = this.requireRun(runId);
    this.store.createDecision({
      runId,
      question: 'Interrupción ' + run.state + ': ' + nota,
      material: true,
    });
    const outcome = this.transition(runId, 'decidir_interrupcion', 'product_owner', {
      reason: 'decision_sobre_interrupcion',
    });
    if (outcome.ok) {
      this.registrarIntervencion(runId, 'decision_sobre_interrupcion');
    }
    return this.result(outcome.run, outcome.ok, outcome.ok ? 'Quedó registrada tu decisión.' : 'No se pudo registrar.', {
      reason: outcome.reason,
    });
  }

  responderDecision(runId: string, decisionId: string, respuesta: string): ActionResult {
    const run = this.requireRun(runId);
    const scan = scanForSecrets(respuesta);
    if (scan.found) {
      throw new OrchestratorError(
        'posible_secreto_en_respuesta',
        'La respuesta parece incluir una clave. Quítala y vuelve a intentar.',
        scan.patterns,
      );
    }
    // La decisión debe existir, pertenecer a esta ejecución y estar abierta.
    const decision = this.store.getDecision(decisionId);
    if (decision === undefined || decision.run_id !== runId) {
      this.store.journal({
        runId,
        kind: 'decision_rechazada',
        actor: 'product_owner',
        result: 'denegada',
        reason: 'decision_inexistente',
        payload: { decisionId },
      });
      return this.result(run, false, 'Esa pregunta no existe en esta solicitud.', {
        reason: 'decision_inexistente',
      });
    }
    if (decision.status !== 'pendiente') {
      return this.result(run, false, 'Esa pregunta ya fue respondida.', { reason: 'decision_ya_respondida' });
    }
    if (respuesta.trim().length === 0) {
      return this.result(run, false, 'Escribe tu respuesta antes de enviarla.', { reason: 'respuesta_vacia' });
    }

    this.store.answerDecision(decisionId, respuesta, 'product_owner');
    this.store.journal({
      runId,
      kind: 'decision_respondida',
      actor: 'product_owner',
      result: 'respondida',
      payload: { decisionId },
    });

    if (this.store.countPendingMaterialDecisions(runId) > 0) {
      // Respuesta válida, pero el flujo sigue bloqueado: todavía no autoriza
      // continuar, así que la ventana de invocaciones AI no se reinicia.
      return this.result(run, true, 'Respuesta guardada. Todavía queda otra decisión pendiente.');
    }
    if (run.state !== 'ESPERANDO_PRODUCT_OWNER') {
      this.registrarIntervencion(runId, 'decision_respondida');
      return this.result(run, true, 'Respuesta guardada.');
    }

    const outcome = this.transition(runId, 'responder_decision', 'product_owner', {
      reason: 'decision_respondida',
    });
    if (outcome.ok) {
      this.registrarIntervencion(runId, 'decision_respondida');
    }
    return this.result(outcome.run, outcome.ok, 'Respuesta guardada. Podemos continuar.');
  }

  /**
   * APROBAR la propuesta. Sólo se acepta la versión exacta que el Product
   * Owner vio mediante VER (auditoría §2).
   */
  aprobarPropuesta(runId: string, approvalHash: string | null = null): ActionResult {
    const run = this.requireRun(runId);
    const task = this.store.getTask(runId);
    if (task === undefined || task.task_hash === null) {
      return this.result(run, false, 'Todavía no hay una propuesta para aprobar.', { reason: 'sin_propuesta' });
    }

    const check = this.checkAprobacion(runId, 'propuesta', approvalHash);
    if (!check.ok) {
      this.store.journal({
        runId,
        kind: 'aprobacion_rechazada',
        actor: 'product_owner',
        result: 'denegada',
        reason: check.reason,
        payload: { tipo: 'propuesta', estado: run.state },
      });
      return this.result(run, false, check.message, { reason: check.reason });
    }

    this.store.approveTaskHash(runId, check.hash);
    this.store.recordApproval({
      runId,
      kind: 'task',
      subjectHash: check.hash,
      actor: 'product_owner',
      outcome: 'aprobado',
    });
    this.store.journal({
      runId,
      kind: 'aprobacion_registrada',
      actor: 'product_owner',
      result: 'aprobado',
      payload: { tipo: 'propuesta', hash: check.hash, estado: run.state, at: this.store.now() },
    });
    const outcome = this.transition(runId, 'aprobar_task', 'product_owner', {
      reason: 'propuesta_aprobada',
      idempotencySalt: check.hash,
    });

    // Sólo una aprobación efectivamente aceptada autoriza continuar.
    if (outcome.ok) {
      this.registrarIntervencion(runId, 'aprobacion_de_propuesta');
    }

    return this.result(
      outcome.run,
      outcome.ok,
      outcome.ok ? 'Propuesta aprobada. Ahora puedes comenzar la implementación.' : 'No se pudo aprobar.',
      { reason: outcome.reason, blocking: outcome.blocking },
    );
  }

  cambiarPropuesta(runId: string, comentario: string): ActionResult {
    const run = this.requireRun(runId);
    if (comentario.trim().length === 0) {
      return this.result(run, false, 'Escribe qué quieres cambiar.', { reason: 'comentario_vacio' });
    }
    this.store.recordApproval({
      runId,
      kind: 'task',
      subjectHash: this.store.getTask(runId)?.task_hash ?? null,
      actor: 'product_owner',
      outcome: 'cambios',
    });
    const decision = this.store.createDecision({
      runId,
      question: 'Cambios pedidos a la propuesta: ' + comentario,
      material: false,
    });
    this.store.answerDecision(decision.id, comentario, 'product_owner');
    this.store.journal({
      runId,
      kind: 'cambios_a_propuesta',
      actor: 'product_owner',
      result: 'registrado',
      payload: { decisionId: decision.id },
    });
    this.registrarIntervencion(runId, 'cambios_a_propuesta');
    return this.result(run, true, 'Anotamos tus cambios. Pide preparar la propuesta otra vez.');
  }

  rechazar(runId: string, motivo: string): ActionResult {
    this.store.recordApproval({
      runId,
      kind: 'resultado',
      subjectHash: null,
      actor: 'product_owner',
      outcome: 'rechazado',
    });
    const outcome = this.transition(runId, 'rechazar', 'product_owner', { reason: 'rechazado:' + motivo });
    return this.result(
      outcome.run,
      outcome.ok,
      outcome.ok ? 'Registrado tu rechazo. El historial se conserva completo.' : 'No se puede rechazar desde este estado.',
      { reason: outcome.reason },
    );
  }

  solicitarCambios(runId: string, comentario: string): ActionResult {
    this.store.recordApproval({
      runId,
      kind: 'resultado',
      subjectHash: null,
      actor: 'product_owner',
      outcome: 'cambios',
    });
    const outcome = this.transition(runId, 'solicitar_cambios', 'product_owner', {
      reason: 'cambios_solicitados:' + comentario,
    });
    if (outcome.ok) {
      this.registrarIntervencion(runId, 'cambios_solicitados');
    }
    return this.result(outcome.run, outcome.ok, outcome.ok ? 'Pediste cambios.' : 'No se puede pedir cambios ahora.', {
      reason: outcome.reason,
    });
  }

  /**
   * APROBAR el resultado: llega como máximo a `READY_FOR_COMMIT` (AD-11).
   * Exige haber visto exactamente este resultado (auditoría §2).
   */
  aprobarResultado(runId: string, approvalHash: string | null = null): ActionResult {
    const run = this.requireRun(runId);
    const check = this.checkAprobacion(runId, 'resultado', approvalHash);
    if (!check.ok) {
      this.store.journal({
        runId,
        kind: 'aprobacion_rechazada',
        actor: 'product_owner',
        result: 'denegada',
        reason: check.reason,
        payload: { tipo: 'resultado', estado: run.state },
      });
      return this.result(run, false, check.message, { reason: check.reason });
    }

    this.store.recordApproval({
      runId,
      kind: 'resultado',
      subjectHash: check.hash,
      actor: 'product_owner',
      outcome: 'aprobado',
    });
    this.store.journal({
      runId,
      kind: 'aprobacion_registrada',
      actor: 'product_owner',
      result: 'aprobado',
      payload: { tipo: 'resultado', hash: check.hash, estado: run.state, at: this.store.now() },
    });
    const approved = this.transition(runId, 'aprobar_resultado', 'product_owner', {
      reason: 'resultado_aprobado',
      extras: { visualDivergence: false },
    });
    if (!approved.ok) {
      return this.result(approved.run, false, 'No se pudo aprobar el resultado.', {
        reason: approved.reason,
        blocking: approved.blocking,
      });
    }

    // La aprobación fue aceptada: recién ahora cuenta como intervención.
    this.registrarIntervencion(runId, 'aprobacion_de_resultado');

    const prepared = this.transition(runId, 'preparar_commit', 'orchestrator', {
      reason: 'preparado_para_autorizacion_git',
    });
    return this.result(
      prepared.run,
      prepared.ok,
      'Listo. El trabajo quedó terminado en tu computador; el commit lo autorizas tú.',
      { reason: prepared.reason, blocking: prepared.blocking },
    );
  }

  /**
   * V1 no ejecuta commit ni push bajo ninguna circunstancia (AD-11, FR-21).
   * El método existe para dejar constancia del intento y del bloqueo.
   */
  autorizarCommit(runId: string): ActionResult {
    const run = this.requireRun(runId);
    this.store.journal({
      runId,
      kind: 'commit_bloqueado',
      actor: 'product_owner',
      result: 'denegada',
      reason: 'v1_no_ejecuta_commit_ni_push',
      payload: { estado: run.state },
    });
    return this.result(run, false, 'Esta versión nunca hace commit ni push. Tú conservas ese paso final.', {
      reason: 'v1_no_ejecuta_commit_ni_push',
    });
  }

  // -------------------------------------------------------- fases con agentes

  /** IDEA/ANALISIS -> propuesta preparada por Codex. */
  async prepararPropuesta(runId: string, opciones: { confirmado?: boolean } = {}): Promise<ActionResult> {
    const run = this.requireRun(runId);

    const modeDecision = decideForEvent(run.mode, 'iniciar_analisis', opciones.confirmado === true);
    if (!modeDecision.mayInvokeAgents) {
      const pack = this.buildPack(run, 'analisis');
      this.store.journal({
        runId,
        kind: 'handoff_manual',
        actor: 'orchestrator',
        result: 'exportado',
        reason: modeDecision.reason ?? null,
        payload: { fase: 'analisis', caracteres: pack.chars },
      });
      return this.result(run, false, this.modeMessage(run.mode), {
        reason: modeDecision.reason,
        requiresConfirmation: run.mode === 'ASISTIDO',
        detail: { handoff: pack.text },
      });
    }

    if (run.state === 'IDEA') {
      const started = this.transition(runId, 'iniciar_analisis', 'orchestrator', { reason: 'analisis_iniciado' });
      if (!started.ok) {
        return this.result(started.run, false, 'No se pudo iniciar el análisis.', { reason: started.reason });
      }
    }

    return this.invokePhase(runId, 'analisis');
  }

  /** TASK_READY/CHANGES_REQUIRED -> IMPLEMENTANDO con Claude, o `PAUSED`. */
  async implementar(runId: string, opciones: { confirmado?: boolean } = {}): Promise<ActionResult> {
    const run = this.requireRun(runId);
    if (run.state !== 'TASK_READY' && run.state !== 'CHANGES_REQUIRED') {
      return this.result(run, false, 'Todavía no es momento de implementar.', { reason: 'estado_invalido' });
    }

    const event: WorkflowEvent = run.state === 'TASK_READY' ? 'iniciar_implementacion' : 'reintentar_implementacion';
    const modeDecision = decideForEvent(run.mode, event, opciones.confirmado === true);
    if (!modeDecision.mayInvokeAgents) {
      const pack = this.buildPack(run, 'implementacion');
      this.store.journal({
        runId,
        kind: 'handoff_manual',
        actor: 'orchestrator',
        result: 'exportado',
        reason: modeDecision.reason ?? null,
        payload: { fase: 'implementacion', caracteres: pack.chars },
      });
      return this.result(run, false, this.modeMessage(run.mode), {
        reason: modeDecision.reason,
        requiresConfirmation: run.mode === 'ASISTIDO',
        detail: { handoff: pack.text },
      });
    }

    // 1. Lock exclusivo por Task (AC-05).
    const lock = this.store.acquireLease(runId, this.holder, process.pid);
    if (!lock) {
      return this.result(run, false, 'Otro proceso está trabajando en esta solicitud.', {
        reason: 'lease_ocupado',
      });
    }

    // 2. Working tree: limpio para comenzar; después, sólo el diff propio
    //    (FR-15, T-21, corrección de auditoría §3).
    const before = await this.workspace.baseline(this.store.now());
    const workspaceVerdict = checkWorkingTreeBeforeStart(before, this.store.recognizedPaths(runId), {
      taskStarted: this.taskStarted(runId),
    });
    if (!workspaceVerdict.ok) {
      this.store.journal({
        runId,
        kind: 'workspace_bloqueado',
        actor: 'orchestrator',
        result: 'PAUSED',
        reason: workspaceVerdict.reason ?? null,
        payload: {
          archivos: workspaceVerdict.unrecognized,
          sucios: workspaceVerdict.dirty,
          taskIniciada: this.taskStarted(runId),
        },
      });
      const paused = this.transition(runId, 'pausar', 'orchestrator', {
        reason: workspaceVerdict.reason ?? 'workspace_no_reconocido',
        interruptReason: workspaceVerdict.reason ?? null,
      });
      return this.result(paused.run, false, workspaceVerdict.message ?? 'Working tree no reconocido.', {
        reason: workspaceVerdict.reason,
        detail: { archivos: workspaceVerdict.unrecognized, sucios: workspaceVerdict.dirty },
      });
    }

    // 3. Presupuesto e iteraciones (AD-13).
    const budget = assessBudget({ counters: this.store.getCounters(runId), agent: 'claude' });
    if (!budget.allowed) {
      return this.stopByLimit(runId, budget.outcome === 'LOOP_DETECTED' ? 'loop_detectado' : 'limite_presupuesto', budget.reason ?? 'limite');
    }

    // 4. Preflight de Claude Code (FR-05, AD-12, T-14, T-20).
    const preflight = await this.claude.preflight();
    if (!preflight.ok) {
      this.store.journal({
        runId,
        kind: 'preflight_fallido',
        actor: 'orchestrator',
        result: 'PAUSED',
        reason: preflight.reason ?? 'preflight',
        payload: { binario: preflight.binary },
      });
      const paused = this.transition(runId, 'pausar', 'orchestrator', {
        reason: preflight.reason ?? 'preflight_fallido',
        interruptReason: preflight.reason ?? null,
      });
      return this.result(paused.run, false, preflight.message ?? 'Falta habilitar el implementador.', {
        reason: preflight.reason,
      });
    }

    // 5. Gate READY FOR CLAUDE + transición.
    const started = this.transition(runId, event, 'orchestrator', {
      reason: 'implementacion_iniciada',
      extras: {
        workspaceClean: before.clean || workspaceVerdict.ok,
        baselineRecorded: true,
        preflightOk: true,
        budgetAvailable: true,
        lockAcquired: true,
      },
    });
    if (!started.ok) {
      this.store.releaseLease(runId, this.holder);
      return this.result(started.run, false, 'No se cumplen las condiciones para implementar.', {
        reason: started.reason,
        blocking: started.blocking,
      });
    }

    // 6. Checkpoint previo obligatorio (doc §11).
    const task = this.store.getTask(runId);
    saveCheckpoint(this.store, {
      runId,
      state: 'IMPLEMENTANDO',
      taskHash: this.currentTaskHash(task),
      baseline: before,
      attempt: this.store.countAttempts(runId) + 1,
      allowedPaths: this.allowedPaths,
    });

    const visitedBefore = new Set(this.store.listTransitions(runId).map((t) => t.to_state));
    const invocation = await this.invokeAgent(runId, this.claude, 'implementacion');
    this.store.releaseLease(runId, this.holder);

    if (!invocation.ok || invocation.result === null) {
      // Doc §11.3/§11.6: inspección de solo lectura; los cambios parciales se
      // conservan y se registran para que Codex/QA decidan el siguiente paso.
      await this.preserveParcialChanges(runId, before);
      return this.result(this.requireRun(runId), false, invocation.message, { reason: invocation.reason });
    }

    return this.afterImplementation(runId, invocation.result, before, visitedBefore);
  }

  /** QA -> revisión por Codex. */
  async revisar(runId: string): Promise<ActionResult> {
    const run = this.requireRun(runId);
    if (run.state !== 'QA') {
      return this.result(run, false, 'No hay nada en revisión.', { reason: 'estado_invalido' });
    }

    const budget = assessBudget({ counters: this.store.getCounters(runId), agent: 'codex' });
    if (!budget.allowed) {
      return this.stopByLimit(runId, budget.outcome === 'LOOP_DETECTED' ? 'loop_detectado' : 'limite_presupuesto', budget.reason ?? 'limite');
    }

    const preflight = await this.codex.preflight();
    if (!preflight.ok) {
      const paused = this.transition(runId, 'pausar', 'orchestrator', {
        reason: preflight.reason ?? 'preflight_fallido',
        interruptReason: preflight.reason ?? null,
      });
      return this.result(paused.run, false, preflight.message ?? 'El revisor no está disponible.', {
        reason: preflight.reason,
      });
    }

    const invocation = await this.invokeAgent(runId, this.codex, 'review');
    if (!invocation.ok || invocation.result === null) {
      return this.result(this.requireRun(runId), false, invocation.message, { reason: invocation.reason });
    }

    const output = invocation.result.output;
    if (output === null) {
      return this.result(this.requireRun(runId), false, 'La revisión no devolvió un resultado válido.', {
        reason: 'schema_invalid',
      });
    }

    const reviewId = this.store.recordReview({
      runId,
      reviewer: 'codex',
      verdict: output.verdict ?? 'CHANGES_REQUIRED',
      summary: output.summary,
    });
    for (const finding of output.findings) {
      this.store.recordFinding({
        runId,
        reviewId,
        code: finding.code,
        severity: finding.severity,
        material: finding.material,
        inScope: finding.inScope,
        summary: finding.summary,
      });
    }

    // §9.2: sólo se corrigen findings concretos, no materiales y en alcance.
    const escalables = output.findings.filter((f) => f.material || !f.inScope);
    if (escalables.length > 0 || output.stopConditions.length > 0 || output.verdict === 'BLOCKED') {
      for (const finding of escalables) {
        this.store.createDecision({ runId, question: 'Hallazgo material: ' + finding.summary, material: true });
      }
      for (const stop of output.stopConditions) {
        this.store.createDecision({ runId, question: 'STOP CONDITION: ' + stop, material: true });
      }
      const stopped = this.transition(runId, 'stop_condition', 'orchestrator', {
        reason: 'hallazgos_materiales_o_stop_condition',
        interruptReason: 'hallazgos_materiales_o_stop_condition',
      });
      return this.result(stopped.run, false, 'La revisión encontró algo que sólo tú puedes decidir.', {
        reason: 'stop_condition',
      });
    }

    if (output.verdict === 'PASS') {
      const passed = this.transition(runId, 'review_pass', 'codex', { reason: 'review_pass' });
      return this.result(passed.run, passed.ok, 'La revisión pasó. Ya puedes revisar el resultado.', {
        reason: passed.reason,
      });
    }

    const changes = this.transition(runId, 'review_findings', 'codex', { reason: 'review_changes_required' });
    return this.result(changes.run, changes.ok, 'La revisión pidió correcciones dentro del alcance aprobado.', {
      reason: changes.reason,
    });
  }

  // ------------------------------------------------------------------ helpers

  private modeMessage(mode: Mode): string {
    return mode === 'MANUAL'
      ? 'Estás en modo Manual: preparamos el texto para que lo uses tú, sin ejecutar agentes.'
      : 'Estás en modo Asistido: confirma para continuar.';
  }

  private buildPack(run: RunRow, phase: AgentPhase) {
    const task = this.store.getTask(run.id);
    const decisiones = this.store
      .listDecisions(run.id)
      .filter((d) => d.status === 'respondida')
      .map((d) => d.question + ' -> ' + (d.answer ?? ''));
    const findings = this.store.listOpenFindings(run.id).map((f) => f.code + ': ' + f.summary);
    const checkpoint = this.store.lastCheckpoint(run.id);

    return buildContextPack({
      runId: run.id,
      phase,
      requestText: run.request_text,
      taskPath: task?.task_path ?? null,
      taskTitle: task?.task_title ?? null,
      taskHash: this.currentTaskHash(task),
      approvedDecisions: decisiones,
      openFindings: findings,
      relevantFiles: this.store.listFileChanges(run.id).map((f) => f.path),
      checkpointSummary:
        checkpoint === undefined ? null : 'commit base ' + (checkpoint.base_commit ?? 'desconocido'),
      allowedPaths: this.allowedPaths,
      cleanSession: false,
    });
  }

  private stopByLimit(runId: string, event: WorkflowEvent, reason: string): ActionResult {
    const outcome = this.transition(runId, event, 'orchestrator', { reason, interruptReason: reason });
    const message =
      event === 'loop_detectado'
        ? 'El trabajo dejó de avanzar y se detuvo. Nada se perdió.'
        : 'Se alcanzó el límite de intentos permitido. Nada se perdió.';
    return this.result(outcome.run, false, message, { reason });
  }

  /**
   * Invocación con reintentos sólo para errores transitorios. Nunca revierte
   * código y siempre registra invocación, intentos y errores.
   */
  private async invokeAgent(
    runId: string,
    adapter: AgentAdapter,
    phase: AgentPhase,
  ): Promise<{ ok: boolean; result: AgentInvocationResult | null; message: string; reason?: string }> {
    const run = this.requireRun(runId);
    const pack = this.buildPack(run, phase);

    if (pack.assessment.requiresCleanSession) {
      this.store.journal({
        runId,
        kind: 'contexto_limite_duro',
        actor: 'orchestrator',
        result: 'sesion_limpia',
        payload: { caracteres: pack.chars },
      });
    } else if (pack.assessment.pressure === 'warning') {
      this.store.journal({
        runId,
        kind: 'contexto_advertencia',
        actor: 'orchestrator',
        result: 'warning',
        payload: { caracteres: pack.chars },
      });
    }

    const previous = this.store.listInvocations(runId).filter((i) => i.agent === adapter.name);
    const sessionId = pack.assessment.requiresCleanSession
      ? null
      : (previous[previous.length - 1]?.session_id ?? null);

    const invocationId = this.store.startInvocation({
      runId,
      agent: adapter.name,
      phase,
      sessionId,
      command: adapter.name + ' ' + phase,
      contextChars: pack.chars,
    });

    this.store.bumpCounters(runId, {
      aiInvocations: 1,
      claudeInvocations: adapter.name === 'claude' ? 1 : 0,
    });

    const controller = new AbortController();
    this.abortControllers.set(runId, controller);

    let attemptNumber = 0;
    let transientRetries = 0;

    try {
      for (;;) {
        attemptNumber += 1;
        const result = await adapter.run({
          runId,
          phase,
          context: pack.text,
          taskHash: pack.signature,
          sessionId,
          timeoutMs: LIMITS.defaultInvocationTimeoutMs,
          maxTurns: LIMITS.defaultMaxTurns,
          allowedPaths: this.allowedPaths,
          signal: controller.signal,
        });

        this.store.recordAttempt({
          runId,
          invocationId,
          number: attemptNumber,
          outcome: result.ok ? 'ok' : 'error',
          errorClass: result.errorClass,
        });

        if (result.ok) {
          this.store.finishInvocation({
            invocationId,
            outcome: 'ok',
            errorClass: null,
            exitCode: result.exitCode,
            summary: result.rawSummary,
            sessionId: result.sessionId,
            // Sin dato del CLI queda DESCONOCIDO, nunca cero (auditoría §8).
            usageReported: result.output?.usage.reported === true,
            usageDetail: result.output?.usage.detail ?? null,
          });
          this.store.resetCycleCounters(runId, { transientRetries: true });
          return { ok: true, result, message: 'Listo.' };
        }

        this.store.recordError({
          runId,
          invocationId,
          errorClass: result.errorClass ?? 'unknown',
          transient: result.transient,
          message: result.rawSummary,
        });

        const plan = planFailure({
          errorClass: result.errorClass ?? 'unknown',
          transientRetriesSoFar: transientRetries,
        });

        if (plan.action === 'reintentar') {
          transientRetries += 1;
          this.store.bumpCounters(runId, { transientRetries: 1 });
          this.store.journal({
            runId,
            kind: 'reintento',
            actor: 'orchestrator',
            result: 'esperando_backoff',
            reason: plan.reason,
            payload: { intento: attemptNumber, errorClass: plan.errorClass, backoffMs: plan.backoffMs },
          });

          // El backoff se espera de verdad antes del siguiente intento.
          await this.sleep(plan.backoffMs, controller.signal);

          // DETENER durante la espera cancela el reintento.
          if (controller.signal.aborted) {
            this.store.journal({
              runId,
              kind: 'reintento_cancelado',
              actor: 'product_owner',
              result: 'cancelado',
              reason: 'detenido_durante_backoff',
              payload: { intento: attemptNumber },
            });
            this.store.finishInvocation({
              invocationId,
              outcome: 'cancelado',
              errorClass: 'cancelled',
              exitCode: null,
              summary: 'reintento cancelado por el Product Owner',
              sessionId: result.sessionId,
            });
            return {
              ok: false,
              result: null,
              message: 'Se detuvo antes de volver a intentar. Nada se perdió.',
              reason: 'detenido_durante_backoff',
            };
          }
          continue;
        }

        this.store.finishInvocation({
          invocationId,
          outcome: 'error',
          errorClass: result.errorClass,
          exitCode: result.exitCode,
          summary: result.rawSummary,
          sessionId: result.sessionId,
        });

        const event: WorkflowEvent =
          plan.action === 'PAUSED' ? 'pausar' : plan.action === 'BUDGET_LIMIT' ? 'limite_presupuesto' : 'error_api';
        this.transition(runId, event, 'orchestrator', {
          reason: plan.reason,
          interruptReason: plan.reason,
        });

        return { ok: false, result: null, message: plan.message, reason: plan.reason };
      }
    } finally {
      this.abortControllers.delete(runId);
    }
  }

  /**
   * Tras una invocación fallida: se inspecciona el working tree en solo
   * lectura y se registran los cambios parciales. Nunca se revierte nada.
   */
  private async preserveParcialChanges(runId: string, before: WorkspaceBaseline): Promise<void> {
    const after = await this.workspace.baseline(this.store.now());
    const scope = checkScopeAfterInvocation(before, after, this.allowedPaths);
    for (const file of scope.changed) {
      this.store.recordFileChange({
        runId,
        invocationId: null,
        path: file,
        changeType: 'modificado',
        inScope: scope.inScope.includes(file),
        sha256Before: null,
        sha256After: null,
      });
    }
    this.store.journal({
      runId,
      kind: 'cambios_parciales_preservados',
      actor: 'orchestrator',
      result: 'preservado',
      payload: {
        archivos: scope.changed.length,
        fueraDeAlcance: scope.outOfScope.length,
        revertido: false,
      },
    });
  }

  /** Post-implementación: alcance, evidencia, progreso y anti-loop. */
  private async afterImplementation(
    runId: string,
    result: AgentInvocationResult,
    before: WorkspaceBaseline,
    visitedBefore: ReadonlySet<string>,
  ): Promise<ActionResult> {
    const output = result.output;
    if (output === null) {
      return this.result(this.requireRun(runId), false, 'El implementador no devolvió un resultado válido.', {
        reason: 'schema_invalid',
      });
    }

    const after = await this.workspace.baseline(this.store.now());
    const scope = checkScopeAfterInvocation(before, after, this.allowedPaths);

    for (const file of scope.changed) {
      this.store.recordFileChange({
        runId,
        invocationId: null,
        path: file,
        changeType: 'modificado',
        inScope: scope.inScope.includes(file),
        sha256Before: null,
        sha256After: null,
      });
    }
    for (const test of output.tests) {
      this.store.recordTest({ runId, name: test.name, command: test.command, result: test.result });
    }

    if (!scope.ok) {
      this.store.journal({
        runId,
        kind: 'archivos_fuera_de_alcance',
        actor: 'orchestrator',
        result: 'STOP_CONDITION',
        reason: scope.reason ?? null,
        payload: { archivos: scope.outOfScope },
      });
      this.store.recordMetric({
        runId,
        scenario: 'orchestrator',
        key: 'archivos_fuera_de_alcance',
        value: String(scope.outOfScope.length),
        unit: 'conteo',
        source: 'workspace_guard',
      });
      const stopped = this.transition(runId, 'stop_condition', 'orchestrator', {
        reason: 'archivos_fuera_de_alcance',
        interruptReason: 'archivos_fuera_de_alcance',
        extras: { outOfScopeFiles: scope.outOfScope },
      });
      return this.result(stopped.run, false, scope.message ?? 'Se detuvo por archivos fuera de alcance.', {
        reason: 'archivos_fuera_de_alcance',
        detail: { archivos: scope.outOfScope },
      });
    }

    // Decisiones materiales o dependencias nuevas devueltas por el agente.
    if (output.materialQuestions.length > 0 || output.newDependencies.length > 0 || output.stopConditions.length > 0) {
      for (const question of output.materialQuestions) {
        this.store.createDecision({ runId, question, material: true });
      }
      for (const dependency of output.newDependencies) {
        this.store.createDecision({ runId, question: 'Dependencia nueva propuesta: ' + dependency, material: true });
      }
      for (const stop of output.stopConditions) {
        this.store.createDecision({ runId, question: 'STOP CONDITION: ' + stop, material: true });
      }
      const stopped = this.transition(runId, 'stop_condition', 'orchestrator', {
        reason: 'decision_material_requerida',
        interruptReason: 'decision_material_requerida',
      });
      return this.result(stopped.run, false, 'Hay algo que sólo tú puedes decidir antes de seguir.', {
        reason: 'decision_material_requerida',
      });
    }

    const handoff = this.transition(runId, 'entregar_handoff', 'claude', { reason: 'handoff_entregado' });

    // Huella de progreso y anti-loop (doc §10).
    const progress = assessProgress({
      expectedFilesTouched: scope.inScope,
      newPassingTests: output.tests.filter((t) => t.result === 'pass').length,
      blockersRemoved: 0,
      // Volver a un estado ya visitado no es avanzar: repetir el ciclo
      // IMPLEMENTANDO -> QA no cuenta como progreso verificable.
      stateAdvanced: handoff.ok && !visitedBefore.has('QA'),
      reviewAdvancedTowardPass: false,
    });
    const observation = fingerprint({
      taskHash: this.currentTaskHash(this.store.getTask(runId)),
      findings: this.store.listOpenFindings(runId).map((f) => f.code),
      files: scope.changed,
      testResults: output.tests.map((t) => t.name + '=' + t.result),
      errorClass: null,
    });
    this.store.recordCycle({
      runId,
      fingerprint: observation,
      hasProgress: progress.hasProgress,
      signals: progress.signals,
    });
    if (progress.hasProgress) {
      this.store.resetCycleCounters(runId, { cyclesWithoutProgress: true });
    } else {
      this.store.bumpCounters(runId, { cyclesWithoutProgress: 1 });
    }

    const loop = detectLoop({
      fingerprints: this.store.listCycles(runId).map((c) => c.fingerprint),
      consecutiveCyclesWithoutProgress: this.store.getCounters(runId).cyclesWithoutProgress,
      maxCyclesWithoutProgress: LIMITS.maxCyclesWithoutProgress,
    });
    if (loop.loopDetected) {
      return this.stopByLimit(runId, 'loop_detectado', loop.reason ?? 'loop');
    }

    return this.result(
      this.requireRun(runId),
      handoff.ok,
      'Trabajo entregado a revisión. No se hizo ningún commit.',
      { reason: handoff.reason },
    );
  }

  // ------------------------------------------------------------------ métricas

  /**
   * Métricas del propio Orchestrator, derivadas de evidencia registrada.
   *
   * Corrección de auditoría §8: una métrica sin evidencia es DESCONOCIDA.
   * Nunca se declara cero por ausencia de telemetría.
   */
  medirOrchestrator(runId: string): RunMeasurement {
    const counters = this.store.getCounters(runId);
    const invocations = this.store.listInvocations(runId);
    const tests = this.store.listTests(runId);
    const errors = this.store.listErrors(runId);
    const transitions = this.store.listTransitions(runId);
    const fileChanges = this.store.listFileChanges(runId);
    const journal = this.store.listJournal(runId, 1_000);

    // Una intervención = la solicitud inicial, más cada acción explícita que
    // autoriza continuar (registrada exactamente una vez al reiniciar la
    // ventana AI). No se cuentan dos veces sus efectos derivados.
    const interventions = journal.filter(
      (e) =>
        e.actor === 'product_owner' &&
        (e.kind === 'solicitud_creada' || e.kind === 'ventana_ai_reiniciada'),
    ).length;

    return {
      ...emptyMeasurement(),
      productOwnerInterventions: known(interventions),
      // Sólo se afirma con evidencia registrada (§8).
      manuallyCopiedMessages: this.medirCopiasManuales(runId),
      codexInvocations: known(invocations.filter((i) => i.agent === 'codex').length),
      claudeInvocations: known(counters.claudeInvocations),
      retries: known(Math.max(0, this.store.countAttempts(runId) - invocations.length)),
      errors: known(errors.length),
      cyclesWithoutProgress: known(counters.cyclesWithoutProgress),
      outOfScopeFiles: known(fileChanges.filter((f) => f.in_scope === 0).length),
      testsPass: known(tests.filter((t) => t.result === 'pass').length),
      testsFail: known(tests.filter((t) => t.result === 'fail').length),
      testsNotRun: known(tests.filter((t) => t.result === 'not_run').length),
      stopConditions: known(transitions.filter((t) => t.to_state === 'STOP_CONDITION').length),
      inventedDecisions: this.medirDecisionesInventadas(runId),
      successfulRecoveries: known(
        transitions.filter((t) => t.event === 'reanudar' && t.result === 'aceptada').length,
      ),
      reportedTokens: this.medirUso(runId, 'tokens'),
      reportedCostUsd: this.medirUso(runId, 'costo'),
    };
  }

  /**
   * Mensajes copiados a mano. Sólo se conoce si hay evidencia explícita:
   * una declaración del Product Owner, o handoffs exportados en MODO MANUAL
   * (cada uno es un mensaje que la persona debe copiar).
   */
  private medirCopiasManuales(runId: string): MetricValue {
    const declarado = this.store
      .listMetrics(runId)
      .filter((m) => m.scenario === 'orchestrator' && m.key === 'evidencia_copias_manuales')
      .at(-1);
    if (declarado !== undefined) {
      const value = Number(declarado.value);
      return Number.isFinite(value) ? known(value) : unknownMetric;
    }

    const exportados = this.store
      .listJournal(runId, 1_000)
      .filter((e) => e.kind === 'handoff_manual').length;
    if (exportados > 0) {
      return known(exportados);
    }
    // Sin exportaciones y sin declaración no puede saberse: no es cero.
    return unknownMetric;
  }

  /**
   * Decisiones inventadas por un agente. El mecanismo de detección es la
   * revisión: sin una revisión ejecutada no puede afirmarse que sean cero.
   */
  private medirDecisionesInventadas(runId: string): MetricValue {
    if (this.store.lastReviewVerdict(runId) === null) {
      return unknownMetric;
    }
    const detectadas = this.store
      .listFindingsByCategory(runId, DECISION_INVENTADA_CODES)
      .length;
    return known(detectadas);
  }

  /** Consumo informado por el CLI. Si no lo reporta, queda DESCONOCIDO (AC-12). */
  private medirUso(runId: string, campo: 'tokens' | 'costo'): MetricValue {
    const reportadas = this.store.listInvocations(runId).filter((i) => i.usage_reported === 1);
    if (reportadas.length === 0) {
      return unknownMetric;
    }

    let total = 0;
    for (const invocation of reportadas) {
      if (invocation.usage_detail === null) {
        return unknownMetric;
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(invocation.usage_detail);
      } catch {
        return unknownMetric;
      }
      const record = parsed as Record<string, unknown>;
      const valor =
        campo === 'costo'
          ? record['total_cost_usd']
          : ((record['usage'] as Record<string, unknown> | null | undefined)?.['total_tokens'] ?? null);
      if (typeof valor !== 'number' || !Number.isFinite(valor)) {
        return unknownMetric;
      }
      total += valor;
    }
    return known(total);
  }

  /**
   * Evidencia explícita del Product Owner sobre cuántos mensajes copió a
   * mano. Sin esta declaración la métrica permanece DESCONOCIDA.
   */
  registrarEvidenciaCopias(runId: string, copias: number): void {
    this.store.recordMetric({
      runId,
      scenario: 'orchestrator',
      key: 'evidencia_copias_manuales',
      value: String(copias),
      unit: 'conteo',
      source: 'product_owner',
    });
    this.store.journal({
      runId,
      kind: 'evidencia_copias_manuales',
      actor: 'product_owner',
      result: 'registrada',
      payload: { copias },
    });
  }

  /** Registra la medición manual equivalente informada por el Product Owner. */
  registrarMedicionManual(runId: string, manual: RunMeasurement): void {
    for (const [key, value] of Object.entries(serializeMeasurement(manual))) {
      this.store.recordMetric({
        runId,
        scenario: 'manual',
        key,
        value,
        unit: null,
        source: 'product_owner',
      });
    }
  }

  compararConManual(runId: string, manual: RunMeasurement): Comparison {
    const orchestrator = this.medirOrchestrator(runId);
    for (const [key, value] of Object.entries(serializeMeasurement(orchestrator))) {
      this.store.recordMetric({
        runId,
        scenario: 'orchestrator',
        key,
        value,
        unit: null,
        source: 'runtime',
      });
    }
    const comparison = compare(manual, orchestrator);
    this.store.journal({
      runId,
      kind: 'comparacion_manual_vs_orchestrator',
      actor: 'orchestrator',
      result: comparison.recommendation,
      payload: {
        concluyente: comparison.conclusive,
        motivos: comparison.reasons,
        datosFaltantes: comparison.dataGaps,
      },
    });
    return comparison;
  }

  // ------------------------------------------------------ registro de la Task

  /**
   * Registra la Task propuesta. Si la ruta existe en el repositorio, el hash
   * se calcula sobre el archivo real (lectura, nunca escritura).
   */
  registrarTask(
    runId: string,
    input: { taskPath: string | null; taskTitle: string | null; readyForClaude: boolean; fallbackContent: string },
  ): TaskRow {
    let hash: string | null = null;
    if (input.taskPath !== null) {
      try {
        hash = sha256(fs.readFileSync(path.resolve(this.repoRoot, input.taskPath), 'utf8'));
      } catch {
        hash = sha256(input.fallbackContent);
      }
    } else {
      hash = sha256(input.fallbackContent);
    }

    const task = this.store.upsertTask({
      runId,
      taskPath: input.taskPath,
      taskTitle: input.taskTitle,
      taskHash: hash,
      readyForClaude: input.readyForClaude,
    });
    this.store.journal({
      runId,
      kind: 'task_registrada',
      actor: 'codex',
      result: 'registrada',
      payload: { ruta: input.taskPath, readyForClaude: input.readyForClaude },
    });
    return task;
  }

  /** Fase de análisis: invoca Codex y registra la propuesta resultante. */
  private async invokePhase(runId: string, phase: AgentPhase): Promise<ActionResult> {
    const budget = assessBudget({ counters: this.store.getCounters(runId), agent: 'codex' });
    if (!budget.allowed) {
      return this.stopByLimit(runId, budget.outcome === 'LOOP_DETECTED' ? 'loop_detectado' : 'limite_presupuesto', budget.reason ?? 'limite');
    }

    const preflight = await this.codex.preflight();
    if (!preflight.ok) {
      const paused = this.transition(runId, 'pausar', 'orchestrator', {
        reason: preflight.reason ?? 'preflight_fallido',
        interruptReason: preflight.reason ?? null,
      });
      return this.result(paused.run, false, preflight.message ?? 'El analista no está disponible.', {
        reason: preflight.reason,
      });
    }

    const invocation = await this.invokeAgent(runId, this.codex, phase);
    if (!invocation.ok || invocation.result === null || invocation.result.output === null) {
      return this.result(this.requireRun(runId), false, invocation.message, { reason: invocation.reason });
    }

    const output = invocation.result.output;
    const taskFile = output.files.find((f) => f.path.startsWith('tasks/'))?.path ?? null;
    this.registrarTask(runId, {
      taskPath: taskFile,
      taskTitle: output.summary.slice(0, 120),
      readyForClaude: output.readyForClaude === true,
      fallbackContent: output.summary + '\n' + JSON.stringify(output.files),
    });

    if (output.materialQuestions.length > 0) {
      for (const question of output.materialQuestions) {
        this.store.createDecision({ runId, question, material: true });
      }
      const waiting = this.transition(runId, 'solicitar_decision', 'orchestrator', {
        reason: 'decision_material_requerida',
      });
      return this.result(waiting.run, false, 'Necesitamos una decisión tuya para continuar.', {
        reason: 'decision_material_requerida',
      });
    }

    return this.result(this.requireRun(runId), true, 'Propuesta preparada. Revísala cuando quieras.');
  }
}
