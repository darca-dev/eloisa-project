import { BadRequestException } from '@nestjs/common';
import { validarPassword } from './access-request.validation';

export const RECOVERY_STATES = ['PENDING', 'SUCCEEDED', 'UNCERTAIN', 'SUPERSEDED'] as const;
export type RecoveryState = (typeof RECOVERY_STATES)[number];
export const RECOVERY_ABANDONED_AFTER_MS = 15 * 60_000;
export const RECOVERY_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const KEYS = ['operationId', 'expectedVersion', 'identityVerified', 'supportReference', 'password', 'confirmPassword', 'predecessorId'];
export interface RecoveryInput {
  readonly operationId: string;
  readonly expectedVersion: number;
  readonly identityVerified: true;
  readonly supportReference: string;
  readonly password: string;
  readonly predecessorId: string | null;
}
export interface RecoveryOperationDto {
  readonly operationId: string;
  readonly state: RecoveryState;
  readonly createdAt: string;
}
export function validateRecoveryInput(raw: unknown): RecoveryInput {
  const invalid = (): never => { throw new BadRequestException({ code: 'ACCESS_RECOVERY_INVALID', message: 'Revise la confirmación de identidad, el soporte y la contraseña temporal.' }); };
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return invalid();
  const body = raw as Record<string, unknown>;
  if (Object.keys(body).some(key => !KEYS.includes(key)) || KEYS.some(key => !(key in body))
    || typeof body.operationId !== 'string' || !RECOVERY_UUID.test(body.operationId)
    || !Number.isSafeInteger(body.expectedVersion) || (body.expectedVersion as number) < 1
    || body.identityVerified !== true || typeof body.supportReference !== 'string'
    || !/^[A-Za-z0-9][A-Za-z0-9_-]{5,63}$/u.test(body.supportReference)
    || validarPassword(body.password) === null || body.password !== body.confirmPassword
    || !(body.predecessorId === null || (typeof body.predecessorId === 'string' && RECOVERY_UUID.test(body.predecessorId)))) return invalid();
  return { operationId: body.operationId, expectedVersion: body.expectedVersion as number,
    identityVerified: true, supportReference: body.supportReference, password: body.password as string,
    predecessorId: body.predecessorId as string | null };
}
