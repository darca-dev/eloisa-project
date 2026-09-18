/**
 * Identificadores opacos y hashes (doc §8).
 * No se derivan de datos sensibles ni de contenido del usuario.
 */

import { createHash, randomUUID } from 'node:crypto';

export function newId(prefix: string): string {
  return prefix + '_' + randomUUID().replace(/-/g, '').slice(0, 20);
}

export function sha256(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

/** Hash estable de un objeto: claves ordenadas de forma determinista. */
export function stableHash(value: unknown): string {
  return sha256(stableStringify(value));
}

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value ?? null) ?? 'null';
  }
  if (Array.isArray(value)) {
    return '[' + value.map((item) => stableStringify(item)).join(',') + ']';
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return '{' + entries.map(([k, v]) => JSON.stringify(k) + ':' + stableStringify(v)).join(',') + '}';
}

/** Clave de idempotencia de una transición (FR-02). */
export function idempotencyKey(parts: readonly (string | number | null)[]): string {
  return sha256(parts.map((p) => String(p ?? '')).join('|'));
}
