/**
 * Resolución y control de rutas (doc §12, seguridad 4, T-06).
 *
 * Se rechazan rutas absolutas externas, `..`, symlinks y junctions que
 * escapen del repositorio. Falla cerrado.
 */

import fs from 'node:fs';
import path from 'node:path';

import { FORBIDDEN_PATHS } from '../config.ts';
import { OrchestratorError } from '../domain/errors.ts';

export function toPosix(input: string): string {
  return input.replace(/\\/g, '/');
}

/** Ruta real del ancestro existente más cercano (para detectar escapes). */
function realPathOfNearestExisting(target: string): string {
  let current = path.resolve(target);
  for (;;) {
    try {
      return fs.realpathSync.native(current);
    } catch {
      const parent = path.dirname(current);
      if (parent === current) {
        return current;
      }
      current = parent;
    }
  }
}

export interface PathCheck {
  readonly ok: boolean;
  readonly relative?: string;
  readonly reason?: string;
}

/**
 * Verifica que `candidate` quede dentro de `root` tanto de forma léxica
 * como tras resolver enlaces simbólicos.
 */
export function checkInsideRoot(root: string, candidate: string): PathCheck {
  const normalizedCandidate = toPosix(candidate);
  if (normalizedCandidate.split('/').includes('..')) {
    return { ok: false, reason: 'path_traversal' };
  }

  const absoluteRoot = path.resolve(root);
  const absolute = path.isAbsolute(candidate) ? path.resolve(candidate) : path.resolve(absoluteRoot, candidate);

  const lexicalRelative = path.relative(absoluteRoot, absolute);
  if (lexicalRelative.startsWith('..') || path.isAbsolute(lexicalRelative)) {
    return { ok: false, reason: 'ruta_fuera_del_repositorio' };
  }

  const realRoot = realPathOfNearestExisting(absoluteRoot);
  const realCandidate = realPathOfNearestExisting(absolute);
  const realRelative = path.relative(realRoot, realCandidate);
  if (realRelative.startsWith('..') || path.isAbsolute(realRelative)) {
    return { ok: false, reason: 'symlink_o_junction_escape' };
  }

  return { ok: true, relative: toPosix(lexicalRelative) };
}

export function assertInsideRoot(root: string, candidate: string): string {
  const check = checkInsideRoot(root, candidate);
  if (!check.ok || check.relative === undefined) {
    throw new OrchestratorError(check.reason ?? 'ruta_invalida', 'Ruta rechazada: ' + toPosix(candidate));
  }
  return check.relative;
}

/** Coincidencia con una allowlist: prefijo de directorio o archivo exacto. */
export function matchesAllowlist(relativePath: string, allowed: readonly string[]): boolean {
  const target = toPosix(relativePath);
  return allowed.some((entry) => {
    const normalized = toPosix(entry);
    if (normalized.endsWith('/')) {
      return target === normalized.slice(0, -1) || target.startsWith(normalized);
    }
    return target === normalized;
  });
}

/** Rutas prohibidas de forma permanente, con independencia de la allowlist. */
export function isForbiddenPath(relativePath: string): boolean {
  return matchesAllowlist(relativePath, FORBIDDEN_PATHS);
}

export interface ScopeClassification {
  readonly inScope: readonly string[];
  readonly outOfScope: readonly string[];
  readonly forbidden: readonly string[];
}

/**
 * Clasifica rutas contra la allowlist aprobada.
 * Prohibido gana sobre permitido: una ruta prohibida nunca está en alcance.
 */
export function classifyPaths(
  relativePaths: readonly string[],
  allowed: readonly string[],
): ScopeClassification {
  const inScope: string[] = [];
  const outOfScope: string[] = [];
  const forbidden: string[] = [];

  for (const raw of relativePaths) {
    const relative = toPosix(raw);
    if (isForbiddenPath(relative)) {
      forbidden.push(relative);
      outOfScope.push(relative);
      continue;
    }
    if (matchesAllowlist(relative, allowed)) {
      inScope.push(relative);
    } else {
      outOfScope.push(relative);
    }
  }

  return { inScope, outOfScope, forbidden };
}
