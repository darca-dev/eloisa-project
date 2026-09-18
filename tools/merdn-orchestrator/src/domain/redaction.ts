/**
 * Detección y redacción de secretos (doc §8, seguridad 5/6, AC-10).
 *
 * Regla: el journal, la base de datos, los artefactos y el panel nunca
 * contienen tokens, claves, credenciales ni variables de entorno completas.
 */

import { ENV_ALLOWLIST, ENV_DENYLIST } from '../config.ts';

export const REDACTED = '[REDACTADO]';

interface SecretPattern {
  readonly id: string;
  readonly regex: RegExp;
}

/**
 * Patrones conservadores. Ante duda, se redacta.
 * Los literales son plantillas de detección, no credenciales reales.
 */
const PATTERNS: readonly SecretPattern[] = [
  { id: 'anthropic_key', regex: /sk-ant-[A-Za-z0-9_-]{8,}/g },
  { id: 'openai_key', regex: /sk-(?!ant-)[A-Za-z0-9_-]{16,}/g },
  { id: 'github_token', regex: /gh[pousr]_[A-Za-z0-9]{16,}/g },
  { id: 'aws_access_key', regex: /AKIA[0-9A-Z]{12,}/g },
  { id: 'bearer_token', regex: /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}/gi },
  { id: 'authorization_header', regex: /\bauthorization\s*[:=]\s*\S+/gi },
  { id: 'cookie_header', regex: /\bcookie\s*[:=]\s*\S+/gi },
  { id: 'jwt', regex: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{4,}/g },
  { id: 'private_key_block', regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
  {
    id: 'assigned_secret',
    regex:
      /\b(?:api[_-]?key|apikey|secret|token|password|passwd|pwd|credential|connection[_-]?string)\b\s*[:=]\s*("[^"\n]{4,}"|'[^'\n]{4,}'|[^\s"',;]{4,})/gi,
  },
  { id: 'postgres_url', regex: /\b(?:postgres|postgresql|mysql|mongodb)(?:\+\w+)?:\/\/[^\s"']+/gi },
];

export interface SecretScan {
  readonly found: boolean;
  /** Identificadores de patrón encontrados; nunca el valor detectado. */
  readonly patterns: readonly string[];
}

export function scanForSecrets(input: string | null | undefined): SecretScan {
  if (input === null || input === undefined || input.length === 0) {
    return { found: false, patterns: [] };
  }
  const hits = new Set<string>();
  for (const pattern of PATTERNS) {
    pattern.regex.lastIndex = 0;
    if (pattern.regex.test(input)) {
      hits.add(pattern.id);
    }
    pattern.regex.lastIndex = 0;
  }
  return { found: hits.size > 0, patterns: [...hits].sort() };
}

/** Sustituye cualquier coincidencia por `[REDACTADO]`. Idempotente. */
export function redact(input: string | null | undefined): string {
  if (input === null || input === undefined) {
    return '';
  }
  let output = input;
  for (const pattern of PATTERNS) {
    pattern.regex.lastIndex = 0;
    output = output.replace(pattern.regex, (match) => {
      if (pattern.id === 'assigned_secret' || pattern.id === 'authorization_header' || pattern.id === 'cookie_header') {
        const separatorIndex = match.search(/[:=]/);
        return separatorIndex === -1 ? REDACTED : match.slice(0, separatorIndex + 1) + ' ' + REDACTED;
      }
      return REDACTED;
    });
    pattern.regex.lastIndex = 0;
  }
  return output;
}

/** Trunca y redacta la salida capturada de un proceso hijo. */
export function redactAndTruncate(input: string, maxChars: number): string {
  const redacted = redact(input);
  if (redacted.length <= maxChars) {
    return redacted;
  }
  return redacted.slice(0, maxChars) + '\n[...salida truncada...]';
}

/**
 * Entorno filtrado para procesos hijos.
 * Sólo se propagan claves de la allowlist y nunca las de la denylist.
 */
export function filterEnv(source: NodeJS.ProcessEnv): Record<string, string> {
  const result: Record<string, string> = {};
  for (const key of ENV_ALLOWLIST) {
    if (ENV_DENYLIST.includes(key)) {
      continue;
    }
    const value = source[key];
    if (typeof value === 'string') {
      result[key] = value;
    }
  }
  return result;
}

/** Serializa un valor para el journal, redactando su contenido textual. */
export function redactJson(value: unknown): string {
  return redact(JSON.stringify(value ?? null));
}
