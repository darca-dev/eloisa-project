import { createHash } from 'node:crypto';

import { type PrismaTransaction } from '../database/prisma-transaction';

import { type AuthorizedCareContext } from './care-context.contract';

/**
 * Primitivas de escritura de bitácoras y alarmas (SPEC 055 / MP02–MP03).
 *
 * ORDEN: se llaman DENTRO del trabajo de `withAuthorizedContext`, es decir,
 * después de los bloqueos de autorización de MP01 y antes de tocar registros,
 * reglas o alarmas. Nunca se sube el bloqueo compartido del contexto a
 * exclusivo: la serialización de negocio es un advisory lock aparte.
 */

/**
 * Serializa las operaciones de negocio de UN contexto. La clave es un hash
 * determinista de tenant, organización y contexto; una colisión solo serializa
 * de más, nunca amplía el alcance de nada. Se libera al terminar la transacción.
 */
export async function lockContextForWrite(tx: PrismaTransaction, authorized: AuthorizedCareContext): Promise<void> {
  const key = `care:${authorized.tenantId}:${authorized.organizationId}:${authorized.contextId}`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
}

/** Conflicto de idempotencia o de versión. Se traduce a 409. */
export class CareConflictError extends Error {
  constructor(public readonly code: 'IDEMPOTENCY_KEY_REUSED' | 'VERSION_CONFLICT' | 'ALREADY_EXISTS') {
    super(
      code === 'IDEMPOTENCY_KEY_REUSED'
        ? 'La misma clave de envío ya se usó con otro contenido.'
        : code === 'ALREADY_EXISTS'
          ? 'Ya existe un elemento activo igual.'
          : 'El recurso cambió desde que se consultó.',
    );
    this.name = 'CareConflictError';
  }
}

/** Huella SHA-256 del contenido canónico de una petición. Nunca se almacena el contenido. */
export function payloadHash(payload: unknown): string {
  return createHash('sha256').update(canonicalJson(payload)).digest('hex');
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value ?? null);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(',')}}`;
}

/**
 * Resultado del recibo: `replay` con el recurso original si es el mismo
 * intento; lanza conflicto si la clave se reutilizó con otro contenido.
 */
export async function findReceipt(
  tx: PrismaTransaction,
  authorized: AuthorizedCareContext,
  action: string,
  idempotencyKey: string,
  hash: string,
): Promise<string | null> {
  const receipt = await tx.careRequestReceipt.findFirst({
    where: {
      tenantId: authorized.tenantId,
      organizationId: authorized.organizationId,
      contextId: authorized.contextId,
      actorHumanAccountId: authorized.humanAccountId,
      action,
      idempotencyKey,
    },
    select: { payloadHash: true, responseResourceId: true },
  });

  if (receipt === null) {
    return null;
  }

  if (receipt.payloadHash !== hash) {
    throw new CareConflictError('IDEMPOTENCY_KEY_REUSED');
  }

  return receipt.responseResourceId;
}

export async function writeReceipt(
  tx: PrismaTransaction,
  authorized: AuthorizedCareContext,
  action: string,
  idempotencyKey: string,
  hash: string,
  responseResourceId: string,
): Promise<void> {
  await tx.careRequestReceipt.create({
    data: {
      tenantId: authorized.tenantId,
      organizationId: authorized.organizationId,
      contextId: authorized.contextId,
      patientId: authorized.patientId,
      actorHumanAccountId: authorized.humanAccountId,
      action,
      idempotencyKey,
      payloadHash: hash,
      responseResourceId,
    },
    select: { id: true },
  });
}
