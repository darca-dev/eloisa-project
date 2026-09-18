#!/usr/bin/env node
/**
 * T-16 — Revisión reproducible de secretos y artefactos en archivos versionables
 * (TASK-001, AC-15 y AC-16).
 *
 * Recorre los archivos que Git considera versionables (rastreados + no
 * ignorados) y busca patrones de credenciales, claves privadas, tokens y
 * cadenas de conexión con contraseñas distintas de los marcadores ficticios
 * documentados en `.env.example`.
 *
 * También comprueba que no se hayan versionado artefactos prohibidos
 * (`node_modules`, `dist`, `.next`, `coverage`, `.env`, volúmenes locales).
 *
 * Los lockfiles de texto (`package-lock.json`, `npm-shrinkwrap.json` y `*.lock`)
 * se inspeccionan siempre por contenido: no pueden quedar fuera del escaneo. Si
 * alguno no pudiera leerse como texto, el script falla en lugar de declarar una
 * cobertura que no se produjo.
 *
 * El script NUNCA imprime el valor detectado: solo archivo, línea y regla.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import process from 'node:process';

/** Separador NUL usado por `git ls-files -z`. */
const NUL = String.fromCharCode(0);

/** Marcadores ficticios permitidos y documentados en `.env.example`. */
const ALLOWED_PLACEHOLDERS = [
  'change-me-local-only',
  'merdn_dev',
  'fictitious-not-a-secret',
];

const SECRET_RULES = [
  { id: 'private-key-block', pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { id: 'aws-access-key-id', pattern: /\bAKIA[0-9A-Z]{16}\b/ },
  { id: 'github-token', pattern: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/ },
  { id: 'slack-token', pattern: /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/ },
  { id: 'google-api-key', pattern: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { id: 'stripe-secret-key', pattern: /\bsk_(live|test)_[0-9A-Za-z]{16,}\b/ },
  { id: 'json-web-token', pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\./ },
  {
    id: 'connection-string-with-password',
    pattern:
      /\b(?:postgres|postgresql|mysql|mongodb|redis|amqp)(?:\+\w+)?:\/\/[^\s:@/]+:([^\s@/]+)@/i,
    capture: 1,
  },
  {
    id: 'hardcoded-credential-assignment',
    pattern:
      /\b(password|passwd|secret|api[_-]?key|access[_-]?token|client[_-]?secret|private[_-]?key)\s*[:=]\s*["']([^"'\s]{8,})["']/i,
    capture: 2,
  },
];

const FORBIDDEN_TRACKED_PATHS = [
  { id: 'node_modules', pattern: /(^|\/)node_modules(\/|$)/ },
  { id: 'build-output', pattern: /(^|\/)(dist|build|out|\.next)(\/|$)/ },
  { id: 'coverage', pattern: /(^|\/)coverage(\/|$)/ },
  // La excepcion es de RUTA y solo para plantillas que terminan exactamente en
  // `.example` (`.env.example`, `.env.staging.example`, `.env.a.b.example`).
  // `.env`, `.env.local`, `.env.production.example.bak` y `.env.staging.local`
  // siguen prohibidos. El CONTENIDO de las plantillas se escanea igual.
  { id: 'dotenv-file', pattern: /(^|\/)\.env(?:$|\.(?!(?:[A-Za-z0-9_-]+\.)*example$)[^/]+$)/ },
  { id: 'postgres-local-data', pattern: /(^|\/)(pgdata|postgres-data|\.data)(\/|$)/ },
  { id: 'certificate-or-key', pattern: /\.(pem|key|crt|p12|pfx)$/i },
  { id: 'generated-prisma-client', pattern: /^apps\/api\/src\/generated(\/|$)/ },
];

/** Rutas excluidas del escaneo de contenido (referencia protegida y binarios). */
const CONTENT_SCAN_EXCLUDED = [
  /^prototype-claude\//,
  /^tests\/secrets-scan\.check\.mjs$/,
  /\.(png|jpe?g|gif|webp|svg|ico|pdf|woff2?|ttf|eot|zip|gz)$/i,
];

/**
 * Lockfiles de texto versionables. Se inspeccionan por contenido como cualquier
 * otro archivo y su cobertura se verifica de forma explícita (T-16).
 */
const LOCKFILE_PATHS = [
  /(^|\/)package-lock\.json$/,
  /(^|\/)npm-shrinkwrap\.json$/,
  /\.lock$/i,
];

const MAX_FILE_BYTES = 2 * 1024 * 1024;

/** Un lockfile legítimo puede superar el límite general y aun así debe leerse. */
const MAX_LOCKFILE_BYTES = 32 * 1024 * 1024;

function isLockfile(file) {
  return LOCKFILE_PATHS.some((pattern) => pattern.test(file));
}

/**
 * Plantilla de entorno versionable: la regla `dotenv-file` permite su RUTA, y
 * por eso su contenido debe inspeccionarse siempre (Spec 023).
 */
function isEnvTemplate(file) {
  return /(^|\/)\.env\./u.test(file) && file.endsWith('.example');
}

function listVersionableFiles() {
  const output = execFileSync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );

  return output.split(NUL).filter((entry) => entry.length > 0);
}

function isAllowedPlaceholder(value) {
  return ALLOWED_PLACEHOLDERS.some((placeholder) => value.includes(placeholder));
}

/**
 * Reglas de secreto que dispara una linea, ya descontados los marcadores
 * ficticios documentados. Se usa tanto en el escaneo como en la autoverificacion.
 */
function matchSecretRules(line) {
  const matched = [];

  for (const rule of SECRET_RULES) {
    const match = rule.pattern.exec(line);
    if (match === null) {
      continue;
    }

    const captured = rule.capture === undefined ? line : (match[rule.capture] ?? '');
    if (isAllowedPlaceholder(captured)) {
      continue;
    }

    matched.push(rule.id);
  }

  return matched;
}

/**
 * T-16 — Autoverificacion de la regla `dotenv-file` (Spec 023).
 *
 * Una regla de ruta silenciosamente rota no produce hallazgos: produce
 * cobertura falsa. Estas comprobaciones fallan el escaneo si la excepcion de
 * plantillas se ampliara a archivos de entorno reales, o si dejara de escanearse
 * el contenido de las plantillas versionadas.
 */
const DOTENV_MUST_REJECT = [
  '.env',
  '.env.local',
  '.env.production',
  '.env.production.example.bak',
  '.env.staging.local',
  '.env.example.local',
  'apps/.env',
  'apps/api/.env.local',
  'config/.env.production.example.bak',
];

const DOTENV_MUST_ALLOW_BY_PATH = [
  '.env.example',
  '.env.staging.example',
  '.env.a.b.c.example',
  'apps/.env.example',
  'infra/staging/.env.staging.example',
];

/** Secreto sintetico: nunca es una credencial real, solo prueba la cobertura. */
const CONTENT_SCAN_PROBE = 'DATABASE_URL=postgresql://operator:n0t-a-placeholder-value@db.internal:5432/app';

function selfCheckDotenvRule() {
  const problems = [];
  const dotenvRule = FORBIDDEN_TRACKED_PATHS.find((rule) => rule.id === 'dotenv-file');

  if (dotenvRule === undefined) {
    return ['cobertura:regla-dotenv-file-ausente'];
  }

  for (const path of DOTENV_MUST_REJECT) {
    if (!dotenvRule.pattern.test(path)) {
      problems.push(`cobertura:dotenv-file-deberia-rechazar:${path}`);
    }
  }

  for (const path of DOTENV_MUST_ALLOW_BY_PATH) {
    if (dotenvRule.pattern.test(path)) {
      problems.push(`cobertura:dotenv-file-no-deberia-rechazar-por-ruta:${path}`);
    }
  }

  // La excepcion es de ruta: el contenido de una plantilla `.example` sigue
  // sometido a todas las reglas de secreto.
  for (const path of DOTENV_MUST_ALLOW_BY_PATH) {
    if (CONTENT_SCAN_EXCLUDED.some((pattern) => pattern.test(path))) {
      problems.push(`cobertura:plantilla-excluida-del-escaneo-de-contenido:${path}`);
    }
  }

  if (matchSecretRules(CONTENT_SCAN_PROBE).length === 0) {
    problems.push('cobertura:reglas-de-contenido-no-detectan-credencial');
  }

  return problems;
}

const files = listVersionableFiles();
const findings = [];

for (const problem of selfCheckDotenvRule()) {
  findings.push({ file: 'tests/secrets-scan.check.mjs', line: 0, rule: problem });
}
const lockfiles = files.filter((entry) => isLockfile(entry));
const scannedLockfiles = [];
const envTemplates = files.filter((entry) => isEnvTemplate(entry));
const scannedEnvTemplates = [];

/** Un lockfile no inspeccionado es un hallazgo de cobertura, no un silencio. */
function noteSkippedLockfile(file, reason) {
  if (isLockfile(file)) {
    findings.push({ file, line: 0, rule: `cobertura:lockfile-no-inspeccionado:${reason}` });
  }
}

for (const file of files) {
  for (const rule of FORBIDDEN_TRACKED_PATHS) {
    if (rule.pattern.test(file)) {
      findings.push({ file, line: 0, rule: `artefacto-prohibido:${rule.id}` });
    }
  }
}

for (const file of files) {
  if (CONTENT_SCAN_EXCLUDED.some((pattern) => pattern.test(file))) {
    noteSkippedLockfile(file, 'excluido');
    continue;
  }

  let size;
  try {
    size = statSync(file).size;
  } catch {
    noteSkippedLockfile(file, 'ilegible');
    continue;
  }

  if (size > (isLockfile(file) ? MAX_LOCKFILE_BYTES : MAX_FILE_BYTES)) {
    noteSkippedLockfile(file, 'tamano');
    continue;
  }

  let content;
  try {
    content = readFileSync(file, 'utf8');
  } catch {
    noteSkippedLockfile(file, 'ilegible');
    continue;
  }

  // Archivo binario: no se escanea como texto.
  if (content.includes(NUL)) {
    noteSkippedLockfile(file, 'binario');
    continue;
  }

  if (isLockfile(file)) {
    scannedLockfiles.push(file);
  }

  if (isEnvTemplate(file)) {
    scannedEnvTemplates.push(file);
  }

  const lines = content.split(/\r?\n/);

  lines.forEach((line, index) => {
    for (const ruleId of matchSecretRules(line)) {
      findings.push({ file, line: index + 1, rule: `secreto:${ruleId}` });
    }
  });
}

for (const template of envTemplates) {
  if (!scannedEnvTemplates.includes(template)) {
    findings.push({ file: template, line: 0, rule: 'cobertura:plantilla-no-inspeccionada' });
  }
}

console.log(`[secrets:scan] Archivos versionables analizados: ${files.length}`);
console.log(
  `[secrets:scan] Marcadores ficticios permitidos: ${ALLOWED_PLACEHOLDERS.join(', ')}`,
);
console.log(
  `[secrets:scan] Lockfiles versionables: ${lockfiles.length}; inspeccionados por ` +
    `contenido: ${scannedLockfiles.length}` +
    (scannedLockfiles.length > 0 ? ` (${scannedLockfiles.join(', ')})` : ''),
);
console.log(
  `[secrets:scan] Plantillas de entorno versionadas (ruta permitida, contenido ` +
    `escaneado): ${scannedEnvTemplates.length}/${envTemplates.length}` +
    (envTemplates.length > 0 ? ` (${envTemplates.join(', ')})` : ''),
);

if (findings.length > 0) {
  console.error('[secrets:scan] ERROR: hallazgos detectados (valores no impresos):');
  for (const finding of findings) {
    console.error(`  - ${finding.file}:${finding.line} — ${finding.rule}`);
  }
  process.exit(1);
}

console.log(
  '[secrets:scan] OK: sin credenciales, claves, tokens, cadenas de conexión reales ' +
    'ni artefactos prohibidos en archivos versionables.',
);
