/**
 * Contrato de salida estructurada de los agentes.
 *
 * El Orchestrator no interpreta texto libre: exige un bloque JSON con el
 * marcador acordado. Si no aparece o no valida, la invocación se clasifica
 * como `schema_invalid` y no se toma ninguna decisión (FR-04, seguridad 10).
 */

import { redact } from '../domain/redaction.ts';
import type { AgentOutput, ReportedFile, ReportedFinding, ReportedTest } from './types.ts';

export const CONTRACT_MARKER = 'MERDN_ORCHESTRATOR_RESULT';

/** Instrucción de formato incluida en todo context pack. */
export const CONTRACT_INSTRUCTIONS = [
  'Devuelve al final un único bloque JSON delimitado exactamente así:',
  '<' + CONTRACT_MARKER + '>',
  '{ "resumen": string, "archivos": [{"ruta": string, "tipo": "creado|modificado|eliminado"}],',
  '  "pruebas": [{"nombre": string, "comando": string|null, "resultado": "pass|fail|not_run"}],',
  '  "hallazgos": [{"codigo": string, "severidad": "alta|media|baja", "material": boolean, "en_alcance": boolean, "resumen": string}],',
  '  "preguntas_materiales": [string], "dependencias_nuevas": [string], "stop_conditions": [string],',
  '  "veredicto": "PASS|CHANGES_REQUIRED|BLOCKED"|null, "ready_for_claude": boolean|null }',
  '</' + CONTRACT_MARKER + '>',
  'No incluyas secretos, tokens, credenciales ni variables de entorno.',
].join('\n');

interface RawContract {
  resumen?: unknown;
  archivos?: unknown;
  pruebas?: unknown;
  hallazgos?: unknown;
  preguntas_materiales?: unknown;
  dependencias_nuevas?: unknown;
  stop_conditions?: unknown;
  veredicto?: unknown;
  ready_for_claude?: unknown;
  uso?: unknown;
}

export interface ParseResult {
  readonly ok: boolean;
  readonly output: AgentOutput | null;
  readonly reason?: string;
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? redact(value) : fallback;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === 'string').map((item) => redact(item));
}

function parseFiles(value: unknown): ReportedFile[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const files: ReportedFile[] = [];
  for (const item of value) {
    if (typeof item !== 'object' || item === null) {
      continue;
    }
    const record = item as Record<string, unknown>;
    const ruta = record['ruta'];
    const tipo = record['tipo'];
    if (typeof ruta !== 'string') {
      continue;
    }
    const changeType =
      tipo === 'creado' || tipo === 'modificado' || tipo === 'eliminado' ? tipo : 'modificado';
    files.push({ path: ruta.replace(/\\/g, '/'), changeType });
  }
  return files;
}

function parseTests(value: unknown): ReportedTest[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const tests: ReportedTest[] = [];
  for (const item of value) {
    if (typeof item !== 'object' || item === null) {
      continue;
    }
    const record = item as Record<string, unknown>;
    const nombre = record['nombre'];
    const resultado = record['resultado'];
    if (typeof nombre !== 'string') {
      continue;
    }
    const result = resultado === 'pass' || resultado === 'fail' ? resultado : 'not_run';
    const comando = record['comando'];
    tests.push({
      name: redact(nombre),
      command: typeof comando === 'string' ? redact(comando) : null,
      result,
    });
  }
  return tests;
}

function parseFindings(value: unknown): ReportedFinding[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const findings: ReportedFinding[] = [];
  for (const item of value) {
    if (typeof item !== 'object' || item === null) {
      continue;
    }
    const record = item as Record<string, unknown>;
    const codigo = record['codigo'];
    if (typeof codigo !== 'string') {
      continue;
    }
    const severidad = record['severidad'];
    findings.push({
      code: redact(codigo),
      severity: severidad === 'alta' || severidad === 'media' || severidad === 'baja' ? severidad : 'media',
      // Falla cerrado: sin declaración explícita se asume material y fuera de alcance.
      material: record['material'] !== false,
      inScope: record['en_alcance'] === true,
      summary: asString(record['resumen'], ''),
    });
  }
  return findings;
}

/** Extrae y valida el bloque de contrato. Nunca ejecuta contenido del modelo. */
export function parseAgentOutput(raw: string): ParseResult {
  const open = '<' + CONTRACT_MARKER + '>';
  const close = '</' + CONTRACT_MARKER + '>';
  const start = raw.indexOf(open);
  const end = raw.lastIndexOf(close);
  if (start === -1 || end === -1 || end <= start) {
    return { ok: false, output: null, reason: 'contrato_ausente' };
  }

  const jsonText = raw.slice(start + open.length, end).trim();
  let parsed: RawContract;
  try {
    parsed = JSON.parse(jsonText) as RawContract;
  } catch {
    return { ok: false, output: null, reason: 'contrato_json_invalido' };
  }
  if (typeof parsed !== 'object' || parsed === null) {
    return { ok: false, output: null, reason: 'contrato_json_invalido' };
  }
  if (typeof parsed.resumen !== 'string') {
    return { ok: false, output: null, reason: 'contrato_sin_resumen' };
  }

  const veredicto = parsed.veredicto;
  const usage = parsed.uso;

  const output: AgentOutput = {
    summary: asString(parsed.resumen),
    files: parseFiles(parsed.archivos),
    tests: parseTests(parsed.pruebas),
    findings: parseFindings(parsed.hallazgos),
    materialQuestions: asStringArray(parsed.preguntas_materiales),
    newDependencies: asStringArray(parsed.dependencias_nuevas),
    verdict:
      veredicto === 'PASS' || veredicto === 'CHANGES_REQUIRED' || veredicto === 'BLOCKED'
        ? veredicto
        : null,
    readyForClaude: typeof parsed.ready_for_claude === 'boolean' ? parsed.ready_for_claude : null,
    stopConditions: asStringArray(parsed.stop_conditions),
    usage:
      typeof usage === 'string' && usage.length > 0
        ? { reported: true, detail: redact(usage) }
        : { reported: false, detail: null },
  };

  return { ok: true, output };
}

/** Construye un bloque de contrato válido (usado por los mocks y las pruebas). */
export function buildContractBlock(payload: Record<string, unknown>): string {
  return '<' + CONTRACT_MARKER + '>\n' + JSON.stringify(payload, null, 2) + '\n</' + CONTRACT_MARKER + '>';
}
