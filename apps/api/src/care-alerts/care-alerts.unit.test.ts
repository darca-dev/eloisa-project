import { describe, expect, it } from 'vitest';

import { CareValidationError } from '../care-context/care-request';
import { parseRecordInput } from '../care-records/care-records.request';

import { type AlarmSnapshot, applyTransition } from './care-alarm-transitions';
import { parseManualAlarmInput, parseTransitionInput } from './care-alerts.request';

const NUEVA: AlarmSnapshot = { state: 'NUEVA', severity: null, assignedReviewerHumanAccountId: null };
const KEY = '00000000-0000-4000-8000-000000000001';

describe('applyTransition', () => {
  it('sigue el ciclo NUEVA → EN_GESTION → RESUELTA → CERRADA → EN_GESTION', () => {
    const reconocida = applyTransition(NUEVA, { action: 'ACKNOWLEDGE', reason: null });
    expect(reconocida).toMatchObject({ ok: true, next: { state: 'EN_GESTION' } });

    const resuelta = applyTransition({ ...NUEVA, state: 'EN_GESTION' }, { action: 'RESOLVE', reason: 'motivo' });
    expect(resuelta).toMatchObject({ ok: true, next: { state: 'RESUELTA' }, resolvedNow: true });

    const cerrada = applyTransition({ ...NUEVA, state: 'RESUELTA' }, { action: 'CLOSE', reason: 'motivo' });
    expect(cerrada).toMatchObject({ ok: true, next: { state: 'CERRADA' }, closedNow: true });

    const reabierta = applyTransition({ ...NUEVA, state: 'CERRADA' }, { action: 'REOPEN', reason: 'motivo' });
    expect(reabierta).toMatchObject({ ok: true, next: { state: 'EN_GESTION' } });
  });

  it('rechaza saltos de estado', () => {
    expect(applyTransition(NUEVA, { action: 'CLOSE', reason: 'motivo' })).toEqual({ ok: false, reason: 'STATE' });
    expect(applyTransition({ ...NUEVA, state: 'EN_GESTION' }, { action: 'ACKNOWLEDGE', reason: null })).toEqual({ ok: false, reason: 'STATE' });
    expect(applyTransition(NUEVA, { action: 'REOPEN', reason: 'motivo' })).toEqual({ ok: false, reason: 'STATE' });
    expect(applyTransition({ ...NUEVA, state: 'CERRADA' }, { action: 'CLASSIFY', severity: 'ROJA', reason: 'm' })).toEqual({ ok: false, reason: 'STATE' });
  });

  it('exige motivo para resolver, cerrar, reabrir y clasificar', () => {
    for (const action of ['RESOLVE', 'CLOSE', 'REOPEN', 'CLASSIFY'] as const) {
      expect(applyTransition(NUEVA, { action, severity: 'ROJA', reason: '  ' })).toEqual({ ok: false, reason: 'REASON_REQUIRED' });
    }
  });

  it('clasificar y asignar no cambian el estado; resolver no toca la severidad', () => {
    const clasificada = applyTransition(NUEVA, { action: 'CLASSIFY', severity: 'ROJA', reason: 'm' });
    expect(clasificada).toMatchObject({ ok: true, next: { state: 'NUEVA', severity: 'ROJA' } });

    const asignada = applyTransition(NUEVA, { action: 'ASSIGN', assigneeHumanAccountId: KEY, reason: null });
    expect(asignada).toMatchObject({ ok: true, next: { state: 'NUEVA', assignedReviewerHumanAccountId: KEY } });

    const resuelta = applyTransition({ ...NUEVA, severity: 'AMARILLA' }, { action: 'RESOLVE', reason: 'm' });
    expect(resuelta).toMatchObject({ ok: true, next: { severity: 'AMARILLA' } });
  });
});

describe('parseManualAlarmInput', () => {
  it('nace sin severidad ni estado y con el único motivo de software', () => {
    expect(parseManualAlarmInput({ idempotencyKey: KEY })).toEqual({ idempotencyKey: KEY, reasonCode: 'REQUEST_REVIEW', note: null });
  });

  it.each([['severity', 'ROJA'], ['state', 'CERRADA'], ['patientId', KEY], ['tenantId', KEY], ['initiatedByHumanAccountId', KEY]])(
    'rechaza el campo de cliente %s',
    (campo, valor) => {
      expect(() => parseManualAlarmInput({ idempotencyKey: KEY, [campo]: valor })).toThrow(CareValidationError);
    },
  );

  it('no inventa motivos clínicos', () => {
    expect(() => parseManualAlarmInput({ idempotencyKey: KEY, reasonCode: 'DOLOR' })).toThrow(CareValidationError);
  });
});

describe('parseTransitionInput', () => {
  it('solo CLASSIFY lleva severidad y solo ASSIGN lleva destinatario', () => {
    expect(() => parseTransitionInput({ action: 'RESOLVE', expectedVersion: 1, severity: 'ESTABLE' })).toThrow(CareValidationError);
    expect(() => parseTransitionInput({ action: 'RESOLVE', expectedVersion: 1, assignee: 'self' })).toThrow(CareValidationError);
    expect(parseTransitionInput({ action: 'ASSIGN', expectedVersion: 2, assignee: 'self' })).toMatchObject({ assignee: 'self' });
  });

  it('exige versión esperada positiva', () => {
    expect(() => parseTransitionInput({ action: 'ACKNOWLEDGE', expectedVersion: 0 })).toThrow(CareValidationError);
    expect(() => parseTransitionInput({ action: 'ACKNOWLEDGE' })).toThrow(CareValidationError);
  });
});

describe('parseRecordInput', () => {
  const now = new Date('2026-10-21T12:00:00.000Z');

  it('rechaza ocurrencia futura, sin zona horaria o registro vacío', () => {
    expect(() => parseRecordInput({ idempotencyKey: KEY, occurredAt: '2026-10-21T12:00:01.000Z', note: 'x' }, now)).toThrow(CareValidationError);
    expect(() => parseRecordInput({ idempotencyKey: KEY, occurredAt: '2026-10-21T11:00:00', note: 'x' }, now)).toThrow(CareValidationError);
    expect(() => parseRecordInput({ idempotencyKey: KEY, occurredAt: '2026-10-21T11:00:00.000Z' }, now)).toThrow(CareValidationError);
  });

  it('no acepta fuente, autor ni recepción del cliente y limita a 50 datos', () => {
    for (const campo of ['source', 'authorHumanAccountId', 'receivedAt']) {
      expect(() => parseRecordInput({ idempotencyKey: KEY, occurredAt: '2026-10-21T11:00:00.000Z', note: 'x', [campo]: 'x' }, now)).toThrow(CareValidationError);
    }
    const muchas = Array.from({ length: 51 }, () => ({ definitionId: KEY, value: true }));
    expect(() => parseRecordInput({ idempotencyKey: KEY, occurredAt: '2026-10-21T11:00:00.000Z', observations: muchas }, now)).toThrow(CareValidationError);
  });
});
