/**
 * Configuración inmutable del MERDN Orchestrator V1.
 *
 * Fuente autoritativa: docs/MERDN-ORCHESTRATOR-V1.md (secciones 4, 10, 13)
 * y tasks/TASK-MERDN-ORCHESTRATOR-V1.md (AD-07, AD-09, AD-13, AD-15).
 *
 * Ninguno de estos valores es una decisión nueva: todos provienen de la
 * arquitectura aprobada. No añadir aquí claves, tokens ni endpoints remotos.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** Raíz del repositorio MERDN: `tools/merdn-orchestrator/src` -> tres niveles arriba. */
export const REPO_ROOT = path.resolve(HERE, '..', '..', '..');

/** Directorio local no versionado (AD-09). */
export const MERDN_DIR = path.join(REPO_ROOT, '.merdn');
export const DB_PATH = path.join(MERDN_DIR, 'orchestrator.db');
export const ARTIFACTS_DIR = path.join(MERDN_DIR, 'artifacts');

/**
 * El panel escucha exclusivamente en loopback (AD-15, seguridad 1).
 *
 * `PANEL_HOST` es el ÚNICO host de escucha admitido en V1. No es
 * configurable: `0.0.0.0`, `::`, direcciones LAN y cualquier interfaz
 * externa quedan rechazadas al arrancar.
 */
export const PANEL_HOST = '127.0.0.1';
export const PANEL_DEFAULT_PORT = 4319;

/** Hosts aceptados en la cabecera `Host` (protección anti DNS rebinding). */
export const PANEL_ALLOWED_HOSTNAMES: readonly string[] = ['127.0.0.1', 'localhost', '[::1]', '::1'];

/** Límites anti-loop y de consumo aprobados (AD-13, doc §10). */
export const LIMITS = {
  /** Máximo de invocaciones Claude por Task: implementación + 2 correcciones. */
  maxClaudeInvocationsPerTask: 3,
  /** Máximo de reintentos transitorios por invocación. */
  maxTransientRetriesPerInvocation: 2,
  /** Máximo de ciclos consecutivos sin progreso verificable. */
  maxCyclesWithoutProgress: 2,
  /** Máximo de invocaciones AI totales antes de intervención del Product Owner. */
  maxAiInvocationsBeforeProductOwner: 6,
  /** Umbral blando de contexto construido, en caracteres. */
  contextSoftLimitChars: 80_000,
  /** Umbral duro de contexto: fuerza checkpoint y sesión limpia. */
  contextHardLimitChars: 120_000,
  /** Timeout por invocación de agente, configurable y visible antes de iniciar. */
  defaultInvocationTimeoutMs: 15 * 60 * 1000,
  /** Máximo de turnos por invocación no interactiva. */
  defaultMaxTurns: 12,
  /** Tamaño máximo de salida capturada por proceso hijo (se trunca y redacta). */
  maxCapturedOutputChars: 64_000,
} as const;

/** Retención operativa del journal local: 30 días, purga manual (AD-14). */
export const JOURNAL_RETENTION_DAYS = 30;

/** Duración del lease exclusivo por Task (doc §11.8, §12). */
export const LEASE_TTL_MS = 10 * 60 * 1000;

/**
 * Allowlist de rutas escribibles por una ejecución automatizada.
 * Coincide exactamente con `Allowed Files` de la Task aprobada.
 */
export const DEFAULT_ALLOWED_PATHS: readonly string[] = [
  'tools/merdn-orchestrator/',
  'tests/orchestrator/',
  '.gitignore',
  'package.json',
  'package-lock.json',
];

/** Rutas prohibidas de forma permanente (doc §15, Task `Forbidden Files`). */
export const FORBIDDEN_PATHS: readonly string[] = [
  'prototype-claude/',
  'apps/',
  'packages/',
  'prisma/',
  'agents/',
  '.git/',
  'AGENTS.md',
  'CLAUDE.md',
  'compose.yml',
  '.env',
  '.env.example',
];

/** Ejecutables permitidos como proceso hijo. Ninguna salida de modelo genera shell. */
export const ALLOWED_COMMANDS: readonly string[] = ['git', 'npm', 'node', 'codex', 'claude'];

/** Subcomandos Git permitidos: solo lectura/inspección (doc §12). */
export const ALLOWED_GIT_SUBCOMMANDS: readonly string[] = [
  'status',
  'rev-parse',
  'diff',
  'ls-files',
  'show',
  'log',
  'config',
];

/** Subcomandos Git prohibidos de forma automática, sin excepción (AD-06, AD-10). */
export const FORBIDDEN_GIT_SUBCOMMANDS: readonly string[] = [
  'reset',
  'clean',
  'stash',
  'rebase',
  'checkout',
  'switch',
  'restore',
  'commit',
  'push',
  'merge',
  'cherry-pick',
  'revert',
  'branch',
  'tag',
  'am',
  'apply',
  'filter-branch',
  'gc',
  'prune',
  'worktree',
  'update-ref',
  'rm',
  'mv',
];

/** Flags de bypass de permisos prohibidos en cualquier adapter (seguridad 9, FR-20). */
export const FORBIDDEN_AGENT_FLAGS: readonly string[] = [
  '--dangerously-skip-permissions',
  '--dangerously-bypass-approvals-and-sandbox',
  '--yolo',
  '--no-sandbox',
  '--bypass-permissions',
];

/**
 * Comandos de verificación que el implementador puede ejecutar.
 *
 * Mínimo privilegio: son exactamente los comandos de lint, typecheck,
 * pruebas y comprobación de diff exigidos por la Task. Ninguno muta el
 * repositorio ni toca Git más allá de la lectura.
 */
export const VERIFICATION_COMMANDS: readonly string[] = [
  'npm run lint',
  'npm run orchestrator:typecheck',
  'npm run orchestrator:test',
  'npm run secrets:scan',
  'git diff --check',
  'git status --short',
];

/**
 * Herramientas permitidas para la invocación no interactiva de Claude Code
 * (FR-20). Incluye la ejecución acotada de los comandos de verificación:
 * sin ella no puede satisfacer las pruebas exigidas por la Task.
 *
 * Nunca incluye comodines de shell (`Bash(*)`), Git mutante, despliegue ni
 * acceso a secretos.
 */
export const CLAUDE_ALLOWED_TOOLS: readonly string[] = [
  'Read',
  'Grep',
  'Glob',
  'Edit',
  'Write',
  ...VERIFICATION_COMMANDS.map((command) => 'Bash(' + command + ')'),
];

/** Herramientas sin acotar que jamás pueden concederse tal cual. */
export const FORBIDDEN_TOOL_EXACT: readonly string[] = ['Bash', 'Bash(*)', 'Bash(*:*)'];

/** Fragmentos que jamás pueden aparecer en la allowlist de herramientas. */
export const FORBIDDEN_TOOL_FRAGMENTS: readonly string[] = [
  'git commit',
  'git push',
  'git reset',
  'git clean',
  'git stash',
  'git rebase',
  'git checkout',
  'git merge',
  'rm ',
  'docker',
  'npm publish',
  'deploy',
];

/**
 * Variables de entorno que se propagan a los procesos hijos.
 * El entorno se filtra: nunca se propagan claves de API ni credenciales.
 */
export const ENV_ALLOWLIST: readonly string[] = [
  'PATH',
  'Path',
  'PATHEXT',
  'HOME',
  'USERPROFILE',
  'SystemRoot',
  'windir',
  'TEMP',
  'TMP',
  'COMSPEC',
  'LANG',
  'LC_ALL',
  'TZ',
  'NODE_OPTIONS_DISABLED',
];

/** Claves de entorno explícitamente bloqueadas aunque aparezcan en la allowlist. */
export const ENV_DENYLIST: readonly string[] = [
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_AUTH_TOKEN',
  'OPENAI_API_KEY',
  'AWS_SECRET_ACCESS_KEY',
  'AWS_ACCESS_KEY_ID',
  'DATABASE_URL',
  'GITHUB_TOKEN',
  'GH_TOKEN',
  'NPM_TOKEN',
];
