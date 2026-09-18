/**
 * Motor de gates obligatorios (doc §9, FR-06, FR-22).
 *
 * Todos los gates fallan cerrado: si falta información, el gate bloquea.
 * Ningún gate se puede desactivar desde una salida de agente.
 */

export const GATE_IDS = [
  'decision_material',
  'aprobacion_task',
  'ready_for_claude',
  'divergencia_visual',
  'dependencia_nueva',
  'archivo_fuera_de_alcance',
  'gasto_o_secreto',
  'accion_destructiva',
  'permisos_sensibles',
  'ready_for_commit',
  'deploy',
] as const;

export type GateId = (typeof GATE_IDS)[number];

/** Requisitos del gate READY FOR CLAUDE (doc §9.1). */
export const READY_REQUIREMENTS = [
  'task_completa_aprobada_hash_vigente',
  'ready_for_claude_declarado',
  'sin_decision_material_bloqueante',
  'allowlist_denylist_definida',
  'criterios_pruebas_recuperacion_definidos',
  'workspace_permitido_y_baseline',
  'preflight_cli_aprobado',
  'sin_indicios_de_secretos',
  'presupuesto_e_iteraciones_disponibles',
  'lock_exclusivo_adquirido',
] as const;
export type ReadyRequirement = (typeof READY_REQUIREMENTS)[number];

export interface GateContext {
  /** Task aprobada por el Product Owner. */
  readonly taskApproved: boolean;
  /** Hash SHA-256 de la Task en el momento de la aprobación. */
  readonly taskHashApproved: string | null;
  /** Hash SHA-256 actual del archivo de Task. */
  readonly taskHashCurrent: string | null;
  /** Declaración explícita `READY FOR CLAUDE = SÍ` en la Task. */
  readonly readyForClaudeDeclared: boolean;
  /** Decisiones materiales pendientes de respuesta del Product Owner. */
  readonly pendingMaterialDecisions: number;
  /** Allowlist y denylist de archivos definidas. */
  readonly allowedPathsDefined: boolean;
  readonly forbiddenPathsDefined: boolean;
  /** Criterios de aceptación, pruebas y recuperación definidos. */
  readonly acceptanceCriteriaDefined: boolean;
  readonly testsDefined: boolean;
  readonly recoveryDefined: boolean;
  /** Working tree limpio y baseline registrado. */
  readonly workspaceClean: boolean;
  readonly baselineRecorded: boolean;
  /** Preflight de CLI/autenticación aprobado. */
  readonly preflightOk: boolean;
  /** Indicios de secretos detectados en intake, contexto o salida. */
  readonly secretsDetected: boolean;
  /** Presupuesto e iteraciones disponibles. */
  readonly budgetAvailable: boolean;
  /** Lock exclusivo de Task adquirido. */
  readonly lockAcquired: boolean;
  /** Solicitudes que requieren autorización separada del Product Owner. */
  readonly newDependencyRequested: boolean;
  readonly outOfScopeFiles: readonly string[];
  readonly destructiveActionRequested: boolean;
  readonly sensitivePermissionsRequested: boolean;
  readonly spendRequested: boolean;
  readonly visualDivergence: boolean;
  readonly requiresClaudeDesign: boolean;
  readonly deployRequested: boolean;
  /** Autorización de commit ligada al diff exacto (FR-10, AD-11). */
  readonly commitAuthorization: { readonly diffHash: string; readonly authorizedBy: string } | null;
  /** Hash del diff preparado para el gate Git. */
  readonly preparedDiffHash: string | null;
}

export function emptyGateContext(): GateContext {
  return {
    taskApproved: false,
    taskHashApproved: null,
    taskHashCurrent: null,
    readyForClaudeDeclared: false,
    pendingMaterialDecisions: 0,
    allowedPathsDefined: false,
    forbiddenPathsDefined: false,
    acceptanceCriteriaDefined: false,
    testsDefined: false,
    recoveryDefined: false,
    workspaceClean: false,
    baselineRecorded: false,
    preflightOk: false,
    secretsDetected: false,
    budgetAvailable: false,
    lockAcquired: false,
    newDependencyRequested: false,
    outOfScopeFiles: [],
    destructiveActionRequested: false,
    sensitivePermissionsRequested: false,
    spendRequested: false,
    visualDivergence: false,
    requiresClaudeDesign: false,
    deployRequested: false,
    commitAuthorization: null,
    preparedDiffHash: null,
  };
}

export interface GateResult {
  readonly id: GateId;
  readonly passed: boolean;
  /** Motivo técnico estable, apto para journal y pruebas. */
  readonly reason?: string;
  /** Explicación en lenguaje natural para el Product Owner. */
  readonly message?: string;
  /** Detalle adicional (por ejemplo, requisitos READY incumplidos). */
  readonly detail?: readonly string[];
}

/** Requisitos READY incumplidos, en orden estable. */
export function failedReadyRequirements(ctx: GateContext): ReadyRequirement[] {
  const failed: ReadyRequirement[] = [];

  const hashVigente =
    ctx.taskHashApproved !== null &&
    ctx.taskHashCurrent !== null &&
    ctx.taskHashApproved === ctx.taskHashCurrent;
  if (!ctx.taskApproved || !hashVigente) {
    failed.push('task_completa_aprobada_hash_vigente');
  }
  if (!ctx.readyForClaudeDeclared) {
    failed.push('ready_for_claude_declarado');
  }
  if (ctx.pendingMaterialDecisions > 0) {
    failed.push('sin_decision_material_bloqueante');
  }
  if (!ctx.allowedPathsDefined || !ctx.forbiddenPathsDefined) {
    failed.push('allowlist_denylist_definida');
  }
  if (!ctx.acceptanceCriteriaDefined || !ctx.testsDefined || !ctx.recoveryDefined) {
    failed.push('criterios_pruebas_recuperacion_definidos');
  }
  if (!ctx.workspaceClean || !ctx.baselineRecorded) {
    failed.push('workspace_permitido_y_baseline');
  }
  if (!ctx.preflightOk) {
    failed.push('preflight_cli_aprobado');
  }
  if (ctx.secretsDetected) {
    failed.push('sin_indicios_de_secretos');
  }
  if (!ctx.budgetAvailable) {
    failed.push('presupuesto_e_iteraciones_disponibles');
  }
  if (!ctx.lockAcquired) {
    failed.push('lock_exclusivo_adquirido');
  }

  return failed;
}

function evaluateGate(id: GateId, ctx: GateContext): GateResult {
  switch (id) {
    case 'decision_material': {
      const passed = ctx.pendingMaterialDecisions === 0;
      return {
        id,
        passed,
        reason: passed ? undefined : 'decision_material_pendiente',
        message: passed ? undefined : 'Hay una decisión que sólo tú puedes tomar.',
      };
    }
    case 'aprobacion_task': {
      if (!ctx.taskApproved) {
        return {
          id,
          passed: false,
          reason: 'task_no_aprobada',
          message: 'La propuesta todavía no está aprobada.',
        };
      }
      const vigente =
        ctx.taskHashApproved !== null && ctx.taskHashApproved === ctx.taskHashCurrent;
      return {
        id,
        passed: vigente,
        reason: vigente ? undefined : 'hash_de_task_invalidado',
        message: vigente ? undefined : 'La propuesta cambió después de aprobarse; hay que aprobarla de nuevo.',
      };
    }
    case 'ready_for_claude': {
      const failed = failedReadyRequirements(ctx);
      return {
        id,
        passed: failed.length === 0,
        reason: failed.length === 0 ? undefined : 'ready_for_claude_incompleto',
        message:
          failed.length === 0 ? undefined : 'Faltan condiciones para entregar el trabajo al implementador.',
        detail: failed,
      };
    }
    case 'divergencia_visual': {
      const passed = !ctx.visualDivergence && !ctx.requiresClaudeDesign;
      return {
        id,
        passed,
        reason: passed ? undefined : 'divergencia_visual_pendiente',
        message: passed ? undefined : 'El resultado visual no coincide con lo esperado.',
      };
    }
    case 'dependencia_nueva': {
      const passed = !ctx.newDependencyRequested;
      return {
        id,
        passed,
        reason: passed ? undefined : 'dependencia_nueva_requiere_autorizacion',
        message: passed ? undefined : 'Se necesita agregar una herramienta nueva; tú debes autorizarlo.',
      };
    }
    case 'archivo_fuera_de_alcance': {
      const passed = ctx.outOfScopeFiles.length === 0;
      return {
        id,
        passed,
        reason: passed ? undefined : 'archivos_fuera_de_alcance',
        message: passed ? undefined : 'Se tocarían archivos fuera de lo aprobado.',
        detail: ctx.outOfScopeFiles,
      };
    }
    case 'gasto_o_secreto': {
      const passed = !ctx.spendRequested && !ctx.secretsDetected;
      return {
        id,
        passed,
        reason: passed ? undefined : ctx.spendRequested ? 'gasto_requiere_autorizacion' : 'posible_secreto_detectado',
        message: passed ? undefined : 'Hay un posible gasto o un dato secreto involucrado.',
      };
    }
    case 'accion_destructiva': {
      const passed = !ctx.destructiveActionRequested;
      return {
        id,
        passed,
        reason: passed ? undefined : 'accion_destructiva_bloqueada',
        message: passed ? undefined : 'Se pidió una acción que puede destruir trabajo; está bloqueada.',
      };
    }
    case 'permisos_sensibles': {
      const passed = !ctx.sensitivePermissionsRequested;
      return {
        id,
        passed,
        reason: passed ? undefined : 'permisos_sensibles_requieren_autorizacion',
        message: passed ? undefined : 'Se solicitaron permisos sensibles.',
      };
    }
    case 'ready_for_commit': {
      // V1 nunca ejecuta commit ni push: sólo deja el trabajo listo (AD-11).
      const auth = ctx.commitAuthorization;
      if (auth === null) {
        return {
          id,
          passed: false,
          reason: 'commit_no_autorizado',
          message: 'El commit lo autorizas tú; el Orchestrator no lo hace solo.',
        };
      }
      const ligado = ctx.preparedDiffHash !== null && auth.diffHash === ctx.preparedDiffHash;
      return {
        id,
        passed: ligado,
        reason: ligado ? undefined : 'autorizacion_no_ligada_al_diff',
        message: ligado ? undefined : 'La autorización no corresponde a los cambios actuales.',
      };
    }
    case 'deploy': {
      const passed = !ctx.deployRequested;
      return {
        id,
        passed,
        reason: passed ? undefined : 'deploy_bloqueado',
        message: passed ? undefined : 'El despliegue no está autorizado en esta versión.',
      };
    }
    default: {
      // Deny by default ante un gate desconocido.
      return { id, passed: false, reason: 'gate_desconocido' };
    }
  }
}

export interface GateEvaluation {
  readonly passed: boolean;
  readonly results: readonly GateResult[];
  readonly blocking: readonly GateResult[];
}

export function evaluateGates(ids: readonly GateId[], ctx: GateContext): GateEvaluation {
  const results = ids.map((id) => evaluateGate(id, ctx));
  const blocking = results.filter((r) => !r.passed);
  return { passed: blocking.length === 0, results, blocking };
}
