/**
 * Construcción de context packs mínimos (FR-13, doc §10).
 *
 * No se reenvían conversaciones completas: sólo Task aprobada, decisiones,
 * findings abiertos, archivos relevantes, checkpoint y evidencia mínima.
 * Todo el contenido se redacta antes de salir del proceso.
 */

import { DEFAULT_ALLOWED_PATHS, FORBIDDEN_PATHS } from '../config.ts';
import { assessContext } from '../domain/budget.ts';
import type { ContextAssessment } from '../domain/budget.ts';
import { redact } from '../domain/redaction.ts';
import { sha256 } from '../domain/ids.ts';
import { CONTRACT_INSTRUCTIONS } from '../adapters/contract.ts';
import type { AgentPhase } from '../adapters/types.ts';

export interface ContextInput {
  readonly runId: string;
  readonly phase: AgentPhase;
  readonly requestText: string;
  readonly taskPath: string | null;
  readonly taskTitle: string | null;
  readonly taskHash: string | null;
  readonly approvedDecisions: readonly string[];
  readonly openFindings: readonly string[];
  readonly relevantFiles: readonly string[];
  readonly checkpointSummary: string | null;
  readonly allowedPaths: readonly string[];
  readonly cleanSession: boolean;
}

export interface ContextPack {
  readonly text: string;
  readonly chars: number;
  /** Firma del pack: permite reanudar con contexto limpio y trazable. */
  readonly signature: string;
  readonly assessment: ContextAssessment;
}

const PHASE_TITLES: Record<AgentPhase, string> = {
  analisis: 'Analizar la necesidad y preparar una propuesta de Task.',
  task: 'Actualizar la Task aprobada.',
  implementacion: 'Implementar exactamente la Task aprobada.',
  review: 'Revisar la implementación contra la Task y sus criterios.',
  correccion: 'Aplicar únicamente las correcciones especificadas.',
};

export function buildContextPack(input: ContextInput): ContextPack {
  const lines: string[] = [];

  lines.push('# MERDN Orchestrator — paquete de contexto');
  lines.push('Ejecución: ' + input.runId);
  lines.push('Fase: ' + input.phase + ' — ' + PHASE_TITLES[input.phase]);
  if (input.cleanSession) {
    lines.push('Sesión limpia reiniciada por límite de contexto; los contadores NO se reinician.');
  }
  lines.push('');

  lines.push('## Necesidad del Product Owner');
  lines.push(redact(input.requestText));
  lines.push('');

  lines.push('## Task');
  lines.push('Ruta: ' + (input.taskPath ?? 'sin Task registrada'));
  lines.push('Título: ' + (input.taskTitle ?? 'sin título'));
  lines.push('Hash SHA-256: ' + (input.taskHash ?? 'sin hash'));
  lines.push('');

  if (input.approvedDecisions.length > 0) {
    lines.push('## Decisiones aprobadas por el Product Owner');
    for (const decision of input.approvedDecisions) {
      lines.push('- ' + redact(decision));
    }
    lines.push('');
  }

  if (input.openFindings.length > 0) {
    lines.push('## Hallazgos abiertos');
    for (const finding of input.openFindings) {
      lines.push('- ' + redact(finding));
    }
    lines.push('');
  }

  if (input.relevantFiles.length > 0) {
    lines.push('## Archivos relevantes');
    for (const file of input.relevantFiles) {
      lines.push('- ' + file);
    }
    lines.push('');
  }

  if (input.checkpointSummary !== null) {
    lines.push('## Checkpoint');
    lines.push(redact(input.checkpointSummary));
    lines.push('');
  }

  lines.push('## Límites obligatorios');
  lines.push('Archivos permitidos: ' + (input.allowedPaths.length > 0 ? input.allowedPaths : DEFAULT_ALLOWED_PATHS).join(', '));
  lines.push('Archivos prohibidos: ' + FORBIDDEN_PATHS.join(', '));
  lines.push('No tomes decisiones materiales: devuélvelas en "preguntas_materiales".');
  lines.push('No ejecutes commit, push, reset, clean, stash, rebase ni checkout destructivo.');
  lines.push('No agregues dependencias sin autorización: declara en "dependencias_nuevas".');
  lines.push('');

  lines.push('## Formato de respuesta obligatorio');
  lines.push(CONTRACT_INSTRUCTIONS);

  const text = lines.join('\n');
  return {
    text,
    chars: text.length,
    signature: sha256(text),
    assessment: assessContext(text.length),
  };
}
