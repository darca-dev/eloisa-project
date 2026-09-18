/**
 * Modos operativos aprobados (doc §6, AD-03, AD-08).
 *
 * El cambio de modo es un evento persistente y nunca reinicia la Task.
 * El sistema jamás pasa por sí solo de MANUAL o ASISTIDO a AUTOMATICO.
 */

import type { WorkflowEvent } from './states.ts';

export const MODES = ['AUTOMATICO', 'ASISTIDO', 'MANUAL'] as const;
export type Mode = (typeof MODES)[number];

/** Modo inicial de la prueba controlada (AD-08). */
export const INITIAL_MODE: Mode = 'ASISTIDO';

export function isMode(value: string): value is Mode {
  return (MODES as readonly string[]).includes(value);
}

/**
 * Paradas obligatorias del modo ASISTIDO en V1.
 * Cada una exige una acción explícita del Product Owner.
 */
export const ASSISTED_MANDATORY_STOPS = [
  'decision_material',
  'aprobacion_task_antes_de_claude',
  'aprobacion_visual_final',
  'stop_condition',
  'dependencia_nueva',
  'archivo_fuera_de_alcance',
  'gasto',
  'secreto',
  'accion_destructiva',
  'ready_for_commit',
] as const;
export type AssistedStop = (typeof ASSISTED_MANDATORY_STOPS)[number];

/** Eventos que sólo el Orchestrator puede disparar invocando un agente. */
const AGENT_INVOKING_EVENTS: readonly WorkflowEvent[] = [
  'iniciar_analisis',
  'iniciar_implementacion',
  'reintentar_implementacion',
];

export interface ModeDecision {
  /** ¿El Orchestrator puede ejecutar el evento por su cuenta? */
  readonly autoAllowed: boolean;
  /** ¿Debe invocar agentes? MANUAL prepara handoffs pero no invoca. */
  readonly mayInvokeAgents: boolean;
  /** Motivo legible cuando la ejecución automática está bloqueada. */
  readonly reason?: string;
}

/**
 * Política de modo. No reemplaza los gates: se aplica antes que ellos.
 *
 * - MANUAL: nunca invoca agentes; sólo prepara y exporta.
 * - ASISTIDO: invoca agentes sólo con confirmación explícita del Product Owner.
 * - AUTOMATICO: avanza sin confirmación, pero sigue sujeto a todos los gates.
 */
export function decideForEvent(
  mode: Mode,
  event: WorkflowEvent,
  productOwnerConfirmed: boolean,
): ModeDecision {
  const invokesAgent = AGENT_INVOKING_EVENTS.includes(event);

  if (mode === 'MANUAL') {
    return {
      autoAllowed: !invokesAgent,
      mayInvokeAgents: false,
      reason: invokesAgent ? 'modo_manual_no_invoca_agentes' : undefined,
    };
  }

  if (mode === 'ASISTIDO' && invokesAgent && !productOwnerConfirmed) {
    return {
      autoAllowed: false,
      mayInvokeAgents: false,
      reason: 'modo_asistido_requiere_confirmacion_product_owner',
    };
  }

  return { autoAllowed: true, mayInvokeAgents: true };
}

/**
 * Un cambio de modo es siempre explícito y sólo lo hace el Product Owner.
 * Devuelve el motivo cuando el cambio no está permitido.
 */
export function checkModeChange(from: Mode, to: Mode, actor: string): string | undefined {
  if (actor !== 'product_owner') {
    return 'solo_product_owner_cambia_modo';
  }
  if (from === to) {
    return undefined;
  }
  return undefined;
}
