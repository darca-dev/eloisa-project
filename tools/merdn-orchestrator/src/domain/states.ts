/**
 * Máquina de estados del Orchestrator V1.
 *
 * Fuente autoritativa: docs/MERDN-ORCHESTRATOR-V1.md §7 y FR-02/FR-19.
 * La tabla es una allowlist: todo lo que no esté declarado se deniega.
 */

import type { GateId } from './gates.ts';

export const FLOW_STATES = [
  'IDEA',
  'ANALISIS',
  'ESPERANDO_PRODUCT_OWNER',
  'TASK_READY',
  'IMPLEMENTANDO',
  'QA',
  'CHANGES_REQUIRED',
  'ESPERANDO_APROBACION_VISUAL',
  'APROBADO',
  'READY_FOR_COMMIT',
  'COMMITTED',
] as const;

export const INTERRUPT_STATES = [
  'PAUSED',
  'API_ERROR',
  'LOOP_DETECTED',
  'BUDGET_LIMIT',
  'STOP_CONDITION',
] as const;

export const TERMINAL_STATES = ['COMMITTED', 'RECHAZADO', 'CANCELADO'] as const;

export const STATES = [...FLOW_STATES, ...INTERRUPT_STATES, 'RECHAZADO', 'CANCELADO'] as const;

export type State = (typeof STATES)[number];

export const ACTORS = ['product_owner', 'orchestrator', 'codex', 'claude', 'git_executor'] as const;
export type Actor = (typeof ACTORS)[number];

export const EVENTS = [
  'crear',
  'iniciar_analisis',
  'solicitar_decision',
  'responder_decision',
  'aprobar_task',
  'iniciar_implementacion',
  'entregar_handoff',
  'review_findings',
  'review_pass',
  'reintentar_implementacion',
  'aprobar_resultado',
  'solicitar_cambios',
  'rechazar',
  'preparar_commit',
  'confirmar_commit',
  'pausar',
  'reanudar',
  'cancelar',
  'error_api',
  'loop_detectado',
  'limite_presupuesto',
  'stop_condition',
  'decidir_interrupcion',
] as const;
export type WorkflowEvent = (typeof EVENTS)[number];

/** `RESUME` significa: volver al `resume_state` conservado por el estado de interrupción. */
export type TransitionTarget = State | 'RESUME';

export interface TransitionRule {
  readonly from: State;
  readonly event: WorkflowEvent;
  readonly to: TransitionTarget;
  readonly actors: readonly Actor[];
  /** Gates que deben estar despejados para permitir la transición. */
  readonly gates: readonly GateId[];
  /** Descripción en lenguaje natural mostrada al Product Owner. */
  readonly label: string;
}

/** Estados desde los que el Product Owner puede cancelar (doc §7.1). */
const CANCELABLE_FROM: readonly State[] = [
  'IDEA',
  'ANALISIS',
  'ESPERANDO_PRODUCT_OWNER',
  'TASK_READY',
  'PAUSED',
];

/** Estados activos que pueden pausarse mediante el kill switch (FR-11). */
export const PAUSABLE_FROM: readonly State[] = [
  'IDEA',
  'ANALISIS',
  'ESPERANDO_PRODUCT_OWNER',
  'TASK_READY',
  'IMPLEMENTANDO',
  'QA',
  'CHANGES_REQUIRED',
  'ESPERANDO_APROBACION_VISUAL',
  'APROBADO',
  'READY_FOR_COMMIT',
  'API_ERROR',
  'LOOP_DETECTED',
  'BUDGET_LIMIT',
  'STOP_CONDITION',
];

/** Estados activos desde los que el Orchestrator puede declarar una interrupción. */
const INTERRUPTIBLE_FROM: readonly State[] = [
  'ANALISIS',
  'TASK_READY',
  'IMPLEMENTANDO',
  'QA',
  'CHANGES_REQUIRED',
];

const flow: TransitionRule[] = [
  {
    from: 'IDEA',
    event: 'iniciar_analisis',
    to: 'ANALISIS',
    actors: ['orchestrator'],
    gates: [],
    label: 'Preparar propuesta',
  },
  {
    from: 'ANALISIS',
    event: 'solicitar_decision',
    to: 'ESPERANDO_PRODUCT_OWNER',
    actors: ['orchestrator', 'codex'],
    gates: [],
    label: 'Pedir una decisión al Product Owner',
  },
  {
    from: 'ESPERANDO_PRODUCT_OWNER',
    event: 'responder_decision',
    to: 'ANALISIS',
    actors: ['product_owner'],
    gates: [],
    label: 'Responder la decisión pendiente',
  },
  {
    from: 'ANALISIS',
    event: 'aprobar_task',
    to: 'TASK_READY',
    actors: ['product_owner'],
    gates: ['decision_material', 'aprobacion_task'],
    label: 'Aprobar la propuesta',
  },
  {
    from: 'TASK_READY',
    event: 'iniciar_implementacion',
    to: 'IMPLEMENTANDO',
    actors: ['orchestrator'],
    gates: [
      'decision_material',
      'aprobacion_task',
      'ready_for_claude',
      'dependencia_nueva',
      'archivo_fuera_de_alcance',
      'gasto_o_secreto',
      'accion_destructiva',
      'permisos_sensibles',
    ],
    label: 'Comenzar la implementación',
  },
  {
    from: 'IMPLEMENTANDO',
    event: 'entregar_handoff',
    to: 'QA',
    actors: ['claude', 'orchestrator'],
    gates: [],
    label: 'Entregar el resultado a revisión',
  },
  {
    from: 'QA',
    event: 'review_findings',
    to: 'CHANGES_REQUIRED',
    actors: ['codex', 'orchestrator'],
    gates: [],
    label: 'Registrar hallazgos de la revisión',
  },
  {
    from: 'QA',
    event: 'review_pass',
    to: 'ESPERANDO_APROBACION_VISUAL',
    actors: ['codex', 'orchestrator'],
    gates: [],
    label: 'Enviar a aprobación visual',
  },
  {
    from: 'CHANGES_REQUIRED',
    event: 'reintentar_implementacion',
    to: 'IMPLEMENTANDO',
    actors: ['orchestrator'],
    gates: [
      'decision_material',
      'aprobacion_task',
      'ready_for_claude',
      'dependencia_nueva',
      'archivo_fuera_de_alcance',
      'gasto_o_secreto',
      'accion_destructiva',
      'permisos_sensibles',
    ],
    label: 'Aplicar las correcciones solicitadas',
  },
  {
    from: 'ESPERANDO_APROBACION_VISUAL',
    event: 'aprobar_resultado',
    to: 'APROBADO',
    actors: ['product_owner'],
    gates: ['divergencia_visual'],
    label: 'Aprobar el resultado',
  },
  {
    from: 'ESPERANDO_APROBACION_VISUAL',
    event: 'solicitar_cambios',
    to: 'CHANGES_REQUIRED',
    actors: ['product_owner'],
    gates: [],
    label: 'Pedir cambios',
  },
  {
    from: 'ESPERANDO_APROBACION_VISUAL',
    event: 'rechazar',
    to: 'RECHAZADO',
    actors: ['product_owner'],
    gates: [],
    label: 'Rechazar el resultado',
  },
  {
    // Doc §7.2: `RECHAZADO` registra el rechazo del resultado O de la propuesta.
    // Por eso el Product Owner puede rechazar una propuesta en ANALISIS.
    from: 'ANALISIS',
    event: 'rechazar',
    to: 'RECHAZADO',
    actors: ['product_owner'],
    gates: [],
    label: 'Rechazar la propuesta',
  },
  {
    from: 'APROBADO',
    event: 'preparar_commit',
    to: 'READY_FOR_COMMIT',
    actors: ['orchestrator'],
    // Preparar no autoriza: el gate Git se evalúa en `confirmar_commit`.
    gates: ['accion_destructiva', 'deploy'],
    label: 'Dejar listo para que el Product Owner autorice el commit',
  },
  {
    from: 'READY_FOR_COMMIT',
    event: 'confirmar_commit',
    to: 'COMMITTED',
    actors: ['git_executor'],
    gates: ['ready_for_commit', 'deploy'],
    label: 'Registrar el commit autorizado (V1 no lo ejecuta)',
  },
];

const interrupts: TransitionRule[] = [
  ...PAUSABLE_FROM.map<TransitionRule>((from) => ({
    from,
    event: 'pausar',
    to: 'PAUSED',
    actors: ['product_owner', 'orchestrator'],
    gates: [],
    label: 'Detener',
  })),
  ...CANCELABLE_FROM.map<TransitionRule>((from) => ({
    from,
    event: 'cancelar',
    to: 'CANCELADO',
    actors: ['product_owner'],
    gates: [],
    label: 'Cancelar la solicitud',
  })),
  ...INTERRUPTIBLE_FROM.map<TransitionRule>((from) => ({
    from,
    event: 'error_api',
    to: 'API_ERROR',
    actors: ['orchestrator'],
    gates: [],
    label: 'Registrar un error del agente',
  })),
  ...INTERRUPTIBLE_FROM.map<TransitionRule>((from) => ({
    from,
    event: 'loop_detectado',
    to: 'LOOP_DETECTED',
    actors: ['orchestrator'],
    gates: [],
    label: 'Detener por falta de avance',
  })),
  ...INTERRUPTIBLE_FROM.map<TransitionRule>((from) => ({
    from,
    event: 'limite_presupuesto',
    to: 'BUDGET_LIMIT',
    actors: ['orchestrator'],
    gates: [],
    label: 'Detener por límite de consumo',
  })),
  ...INTERRUPTIBLE_FROM.map<TransitionRule>((from) => ({
    from,
    event: 'stop_condition',
    to: 'STOP_CONDITION',
    actors: ['orchestrator'],
    gates: [],
    label: 'Detener por una condición de parada',
  })),
  // `PAUSED` y `API_ERROR` son reanudables; el resto exige decisión (doc §7.2).
  {
    from: 'PAUSED',
    event: 'reanudar',
    to: 'RESUME',
    actors: ['product_owner'],
    gates: [],
    label: 'Continuar',
  },
  {
    from: 'API_ERROR',
    event: 'reanudar',
    to: 'RESUME',
    actors: ['product_owner'],
    gates: [],
    label: 'Continuar tras el error',
  },
  ...(['LOOP_DETECTED', 'BUDGET_LIMIT', 'STOP_CONDITION'] as const).map<TransitionRule>((from) => ({
    from,
    event: 'decidir_interrupcion' as const,
    to: 'ESPERANDO_PRODUCT_OWNER' as const,
    actors: ['product_owner'] as const,
    gates: [],
    label: 'Tomar una decisión sobre la interrupción',
  })),
];

export const TRANSITIONS: readonly TransitionRule[] = Object.freeze([...flow, ...interrupts]);

export function findTransition(from: State, event: WorkflowEvent): TransitionRule | undefined {
  return TRANSITIONS.find((rule) => rule.from === from && rule.event === event);
}

export interface TransitionCheck {
  readonly allowed: boolean;
  readonly rule?: TransitionRule;
  readonly reason?: string;
}

/** Verificación pura de la allowlist: estado + evento + actor. Deny by default. */
export function checkTransition(from: State, event: WorkflowEvent, actor: Actor): TransitionCheck {
  const rule = findTransition(from, event);
  if (!rule) {
    return { allowed: false, reason: 'transicion_no_permitida:' + from + '->' + event };
  }
  if (!rule.actors.includes(actor)) {
    return { allowed: false, rule, reason: 'actor_no_autorizado:' + actor };
  }
  return { allowed: true, rule };
}

export function isTerminal(state: State): boolean {
  return (TERMINAL_STATES as readonly State[]).includes(state);
}

export function isInterrupt(state: State): boolean {
  return (INTERRUPT_STATES as readonly State[]).includes(state);
}

/** Transiciones disponibles para un actor desde un estado dado. */
export function availableTransitions(from: State, actor: Actor): readonly TransitionRule[] {
  return TRANSITIONS.filter((rule) => rule.from === from && rule.actors.includes(actor));
}
