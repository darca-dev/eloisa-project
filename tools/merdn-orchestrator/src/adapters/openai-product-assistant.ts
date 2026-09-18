/**
 * Puerto futuro `OpenAIProductAssistantAdapter` (AD-02, AD-17, doc §5.3).
 *
 * ESTADO: DESHABILITADO. En V1 la capa "OpenAI / Product Assistant" es
 * Codex local más el panel. Este archivo declara únicamente el contrato
 * futuro:
 *
 * - no crea claves ni lee `OPENAI_API_KEY`;
 * - no realiza llamadas HTTP ni importa SDK alguno;
 * - no genera gasto;
 * - cualquier intento de uso falla de forma explícita.
 *
 * Habilitarlo requiere una decisión separada del Product Owner.
 */

import { OrchestratorError } from '../domain/errors.ts';
import type { AgentAdapter, AgentInvocationResult, AgentRequest, PreflightResult } from './types.ts';

export const OPENAI_PRODUCT_ASSISTANT_ENABLED = false as const;

export const OPENAI_PRODUCT_ASSISTANT_DISABLED_REASON =
  'adapter_deshabilitado_en_v1: requiere decisión separada del Product Owner (AD-02, AD-17).';

export class OpenAIProductAssistantAdapter implements AgentAdapter {
  readonly name = 'openai_product_assistant' as const;
  readonly enabled = OPENAI_PRODUCT_ASSISTANT_ENABLED;

  async preflight(): Promise<PreflightResult> {
    return {
      ok: false,
      binary: 'openai_product_assistant',
      version: null,
      authenticated: false,
      errorClass: 'preflight',
      reason: 'adapter_deshabilitado',
      message: 'Esta conexión no está habilitada en esta versión.',
    };
  }

  async run(_request: AgentRequest): Promise<AgentInvocationResult> {
    throw new OrchestratorError('adapter_deshabilitado', OPENAI_PRODUCT_ASSISTANT_DISABLED_REASON);
  }
}
