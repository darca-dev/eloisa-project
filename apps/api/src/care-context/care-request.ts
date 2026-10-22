import { randomUUID } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';

import { humanPrincipalOf, type HumanPrincipal, type RequestWithHumanPrincipal } from '../identity-access/human-principal';

import { CareContextAccessDeniedError, CareContextUnavailableError, isCanonicalUuid } from './care-context.contract';
import { CareConflictError } from './care-mutation';

/**
 * Validación de entrada y traducción HTTP comunes a `care-records` y
 * `care-alerts` (SPEC 055 / MP02–MP03). Los límites son TÉCNICOS (tamaño,
 * forma), nunca clínicos ni umbrales de alarma.
 */

export const CARE_LIMITS = Object.freeze({
  noteMax: 2000,
  labelMax: 120,
  codeMax: 48,
  optionsMax: 100,
  observationsMax: 50,
  pageDefault: 20,
  pageMax: 50,
});

/** Entrada inválida. `field` nombra el campo; el mensaje no repite el valor. */
export class CareValidationError extends Error {
  constructor(public readonly field: string, message: string) {
    super(message);
    this.name = 'CareValidationError';
  }
}

/** Recurso inexistente DENTRO de un contexto ya autorizado. */
export class CareNotFoundError extends Error {
  constructor() {
    super('No se encontró el elemento solicitado en este contexto.');
    this.name = 'CareNotFoundError';
  }
}

const CODE_PATTERN = /^[a-z0-9][a-z0-9_-]{0,47}$/u;
const DECIMAL_PATTERN = /^-?(0|[1-9]\d{0,19})(\.\d{1,10})?$/u;

export function asObject(body: unknown): Record<string, unknown> {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new CareValidationError('body', 'El contenido enviado no es válido.');
  }
  return body as Record<string, unknown>;
}

/** Rechaza campos no previstos: el cliente no puede colar actor, tenant ni estado. */
export function onlyFields(body: Record<string, unknown>, allowed: readonly string[]): void {
  for (const key of Object.keys(body)) {
    if (!allowed.includes(key)) {
      throw new CareValidationError(key, 'El formulario incluye un campo no admitido.');
    }
  }
}

export function requiredUuid(body: Record<string, unknown>, field: string): string {
  const value = body[field];
  const lowered = typeof value === 'string' ? value.toLowerCase() : null;
  if (!isCanonicalUuid(lowered)) {
    throw new CareValidationError(field, 'Falta un identificador válido.');
  }
  return lowered;
}

export function optionalUuid(body: Record<string, unknown>, field: string): string | null {
  return body[field] === undefined || body[field] === null ? null : requiredUuid(body, field);
}

export function requiredText(body: Record<string, unknown>, field: string, max: number): string {
  const value = body[field];
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > max) {
    throw new CareValidationError(field, `Complete este campo (hasta ${max} caracteres).`);
  }
  return value.trim();
}

export function optionalText(body: Record<string, unknown>, field: string, max: number): string | null {
  const value = body[field];
  if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) {
    return null;
  }
  return requiredText(body, field, max);
}

export function requiredCode(body: Record<string, unknown>, field: string): string {
  const value = body[field];
  if (typeof value !== 'string' || !CODE_PATTERN.test(value)) {
    throw new CareValidationError(field, 'Use minúsculas, números, guion o guion bajo (hasta 48).');
  }
  return value;
}

/** Decimal finito transportado como texto: sin NaN, infinito ni redondeos silenciosos. */
export function isDecimalText(value: unknown): value is string {
  return typeof value === 'string' && DECIMAL_PATTERN.test(value);
}

export function isChoiceCode(value: unknown): value is string {
  return typeof value === 'string' && CODE_PATTERN.test(value);
}

/** Instante ISO 8601 con zona. Nunca posterior al instante del servidor. */
export function requiredPastInstant(body: Record<string, unknown>, field: string, now: Date): Date {
  const value = body[field];
  const parsed = typeof value === 'string' && /T.*(Z|[+-]\d{2}:\d{2})$/u.test(value) ? new Date(value) : null;
  if (parsed === null || Number.isNaN(parsed.getTime())) {
    throw new CareValidationError(field, 'Indique una fecha y hora válidas.');
  }
  if (parsed.getTime() > now.getTime()) {
    throw new CareValidationError(field, 'La fecha y hora no pueden ser futuras.');
  }
  return parsed;
}

export function requiredInteger(body: Record<string, unknown>, field: string, min: number): number {
  const value = body[field];
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min) {
    throw new CareValidationError(field, 'Falta un número de versión válido.');
  }
  return value;
}

/** Cursor opaco de paginación; el contenido lo interpreta solo el servidor. */
export function decodeCursor(value: unknown): { readonly at: Date; readonly id: string } | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  if (typeof value !== 'string' || value.length > 200) {
    throw new CareValidationError('cursor', 'La página solicitada no es válida.');
  }
  const [at, id] = Buffer.from(value, 'base64url').toString('utf8').split('|');
  const instant = at === undefined ? new Date(Number.NaN) : new Date(at);
  if (Number.isNaN(instant.getTime()) || !isCanonicalUuid(id)) {
    throw new CareValidationError('cursor', 'La página solicitada no es válida.');
  }
  return { at: instant, id };
}

export function encodeCursor(at: Date, id: string): string {
  return Buffer.from(`${at.toISOString()}|${id}`, 'utf8').toString('base64url');
}

export function pageLimit(value: unknown): number {
  if (value === undefined || value === null || value === '') {
    return CARE_LIMITS.pageDefault;
  }
  const parsed = typeof value === 'string' ? Number(value) : Number.NaN;
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > CARE_LIMITS.pageMax) {
    throw new CareValidationError('limit', `El tamaño de página va de 1 a ${CARE_LIMITS.pageMax}.`);
  }
  return parsed;
}

/** Principal del guard, correlación nueva e instante del servidor. */
export function careRequestContext(request: RequestWithHumanPrincipal): {
  readonly principal: HumanPrincipal;
  readonly correlationId: string;
  readonly now: Date;
} {
  const principal = humanPrincipalOf(request);
  if (principal === null) {
    throw new UnauthorizedException({ code: 'CARE_SESSION_REQUIRED', message: 'No hay una sesión vigente.' });
  }
  return { principal, correlationId: randomUUID(), now: new Date() };
}

const logger = new Logger('CareHttp');

/**
 * Traducción UNIFORME de desenlaces. La denegación no distingue causa ni
 * existencia; la indisponibilidad nunca es permiso.
 */
export function toCareHttpError(error: unknown): HttpException {
  if (error instanceof HttpException) {
    return error;
  }
  if (error instanceof CareValidationError) {
    return new BadRequestException({ code: 'CARE_INVALID_INPUT', field: error.field, message: error.message });
  }
  if (error instanceof CareContextAccessDeniedError) {
    return new ForbiddenException({
      code: 'CARE_ACCESS_DENIED',
      message: 'No tiene autorización para esta acción en este contexto de cuidado.',
    });
  }
  if (error instanceof CareNotFoundError) {
    return new NotFoundException({ code: 'CARE_NOT_FOUND', message: error.message });
  }
  if (error instanceof CareConflictError) {
    return new ConflictException({ code: `CARE_${error.code}`, message: error.message });
  }
  if (!(error instanceof CareContextUnavailableError)) {
    logger.error(error instanceof Error ? `Fallo de cuidado: ${error.name}.` : 'Fallo de cuidado desconocido.');
  }
  return new ServiceUnavailableException({
    code: 'CARE_UNAVAILABLE',
    message: 'No se pudo confirmar la operación. Recargue para comprobar su estado antes de repetirla.',
  });
}
