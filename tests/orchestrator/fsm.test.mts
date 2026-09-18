/**
 * T-01 / T-02 — máquina de estados, autoridad por actor e idempotencia.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ACTORS,
  STATES,
  TRANSITIONS,
  availableTransitions,
  checkTransition,
  isInterrupt,
  isTerminal,
} from '../../tools/merdn-orchestrator/src/domain/states.ts';
import type { Actor, State, WorkflowEvent } from '../../tools/merdn-orchestrator/src/domain/states.ts';
import { EVENTS } from '../../tools/merdn-orchestrator/src/domain/states.ts';

test('la allowlist cubre exactamente el flujo aprobado', () => {
  const principales: readonly [State, WorkflowEvent, State][] = [
    ['IDEA', 'iniciar_analisis', 'ANALISIS'],
    ['ANALISIS', 'solicitar_decision', 'ESPERANDO_PRODUCT_OWNER'],
    ['ESPERANDO_PRODUCT_OWNER', 'responder_decision', 'ANALISIS'],
    ['ANALISIS', 'aprobar_task', 'TASK_READY'],
    ['TASK_READY', 'iniciar_implementacion', 'IMPLEMENTANDO'],
    ['IMPLEMENTANDO', 'entregar_handoff', 'QA'],
    ['QA', 'review_findings', 'CHANGES_REQUIRED'],
    ['QA', 'review_pass', 'ESPERANDO_APROBACION_VISUAL'],
    ['CHANGES_REQUIRED', 'reintentar_implementacion', 'IMPLEMENTANDO'],
    ['ESPERANDO_APROBACION_VISUAL', 'aprobar_resultado', 'APROBADO'],
    ['ESPERANDO_APROBACION_VISUAL', 'solicitar_cambios', 'CHANGES_REQUIRED'],
    ['ESPERANDO_APROBACION_VISUAL', 'rechazar', 'RECHAZADO'],
    ['APROBADO', 'preparar_commit', 'READY_FOR_COMMIT'],
    ['READY_FOR_COMMIT', 'confirmar_commit', 'COMMITTED'],
  ];

  for (const [from, event, to] of principales) {
    const rule = TRANSITIONS.find((r) => r.from === from && r.event === event);
    assert.ok(rule !== undefined, 'falta la transición ' + from + ' -> ' + event);
    assert.equal(rule?.to, to);
  }
});

test('toda combinación no declarada se deniega por defecto', () => {
  let denegadas = 0;
  for (const from of STATES) {
    for (const event of EVENTS) {
      for (const actor of ACTORS) {
        const declared = TRANSITIONS.some(
          (r) => r.from === from && r.event === event && r.actors.includes(actor),
        );
        const result = checkTransition(from, event, actor);
        assert.equal(result.allowed, declared, from + '/' + event + '/' + actor);
        if (!declared) {
          denegadas += 1;
          assert.ok(result.reason !== undefined);
        }
      }
    }
  }
  assert.ok(denegadas > 0);
});

test('sólo el Product Owner aprueba, rechaza, cancela y responde decisiones', () => {
  const exclusivas: readonly [State, WorkflowEvent][] = [
    ['ANALISIS', 'aprobar_task'],
    ['ESPERANDO_APROBACION_VISUAL', 'aprobar_resultado'],
    ['ESPERANDO_APROBACION_VISUAL', 'rechazar'],
    ['ESPERANDO_PRODUCT_OWNER', 'responder_decision'],
    ['IDEA', 'cancelar'],
  ];
  for (const [from, event] of exclusivas) {
    for (const actor of ACTORS) {
      const permitido = checkTransition(from, event, actor).allowed;
      assert.equal(permitido, actor === 'product_owner', from + '/' + event + '/' + actor);
    }
  }
});

test('sólo el git executor puede registrar COMMITTED', () => {
  for (const actor of ACTORS) {
    const permitido = checkTransition('READY_FOR_COMMIT', 'confirmar_commit', actor).allowed;
    assert.equal(permitido, actor === 'git_executor');
  }
});

test('Claude no puede autorizar su propia ejecución ni la aceptación', () => {
  const prohibidas: readonly [State, WorkflowEvent][] = [
    ['TASK_READY', 'iniciar_implementacion'],
    ['ANALISIS', 'aprobar_task'],
    ['ESPERANDO_APROBACION_VISUAL', 'aprobar_resultado'],
    ['READY_FOR_COMMIT', 'confirmar_commit'],
  ];
  for (const [from, event] of prohibidas) {
    assert.equal(checkTransition(from, event, 'claude' as Actor).allowed, false);
  }
});

test('los estados terminales no tienen salida', () => {
  for (const state of ['COMMITTED', 'RECHAZADO', 'CANCELADO'] as const) {
    assert.ok(isTerminal(state));
    assert.equal(
      TRANSITIONS.filter((r) => r.from === state).length,
      0,
      'el estado terminal ' + state + ' no debe tener transiciones de salida',
    );
  }
});

test('los estados de interrupción no relanzan trabajo por sí solos', () => {
  for (const state of ['PAUSED', 'API_ERROR', 'LOOP_DETECTED', 'BUDGET_LIMIT', 'STOP_CONDITION'] as const) {
    assert.ok(isInterrupt(state));
    const salidas = TRANSITIONS.filter((r) => r.from === state);
    for (const salida of salidas) {
      assert.ok(
        salida.actors.includes('product_owner'),
        'la salida de ' + state + ' debe requerir al Product Owner',
      );
    }
  }
});

test('sólo PAUSED y API_ERROR reanudan al estado previo', () => {
  const reanudables = TRANSITIONS.filter((r) => r.to === 'RESUME').map((r) => r.from);
  assert.deepEqual([...reanudables].sort(), ['API_ERROR', 'PAUSED']);
});

test('el Product Owner siempre puede detener un flujo activo', () => {
  const activos: readonly State[] = ['ANALISIS', 'TASK_READY', 'IMPLEMENTANDO', 'QA', 'CHANGES_REQUIRED'];
  for (const state of activos) {
    const disponibles = availableTransitions(state, 'product_owner');
    assert.ok(disponibles.some((r) => r.event === 'pausar'), 'falta DETENER en ' + state);
  }
});

test('preparar el cierre no evalúa el gate de commit; confirmarlo sí', () => {
  const preparar = TRANSITIONS.find((r) => r.event === 'preparar_commit');
  const confirmar = TRANSITIONS.find((r) => r.event === 'confirmar_commit');
  assert.equal(preparar?.gates.includes('ready_for_commit'), false);
  assert.equal(confirmar?.gates.includes('ready_for_commit'), true);
  assert.equal(confirmar?.gates.includes('deploy'), true);
});

test('la implementación exige el gate READY FOR CLAUDE', () => {
  for (const event of ['iniciar_implementacion', 'reintentar_implementacion'] as const) {
    const rule = TRANSITIONS.find((r) => r.event === event);
    assert.ok(rule?.gates.includes('ready_for_claude'));
    assert.ok(rule?.gates.includes('archivo_fuera_de_alcance'));
    assert.ok(rule?.gates.includes('gasto_o_secreto'));
    assert.ok(rule?.gates.includes('accion_destructiva'));
  }
});
