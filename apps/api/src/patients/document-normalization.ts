/**
 * Normalización del número de documento por tipo documental
 * (TASK-MVP-CORE-01 §7).
 *
 * Reglas:
 * - no existe una transformación destructiva universal: cada tipo documental
 *   define la suya;
 * - la forma declarada por la persona se conserva aparte y no se sobrescribe;
 * - la forma normalizada es la única que participa en la clave de unicidad
 *   `(tenantId, documentType, documentNumberNormalized)`.
 *
 * Estas reglas son de coherencia de datos. NO validan la existencia, vigencia
 * ni autenticidad de un documento ante ninguna autoridad.
 */

import { type DocumentTypeCode } from './enrollment.contract';

/** Longitud máxima admitida para cualquier documento. */
export const DOCUMENT_NUMBER_MAX_LENGTH = 32;

/** Separadores de presentación que no forman parte del identificador. */
const PRESENTATION_SEPARATORS = /[\s.\-']/gu;

export interface DocumentNormalizationSuccess {
  readonly ok: true;
  /** Forma declarada, únicamente recortada. */
  readonly declared: string;
  /** Forma normalizada usada como clave de unicidad. */
  readonly normalized: string;
}

export interface DocumentNormalizationFailure {
  readonly ok: false;
  readonly reason:
    | 'EMPTY'
    | 'TOO_LONG'
    | 'INVALID_CHARACTERS';
}

export type DocumentNormalizationResult =
  | DocumentNormalizationSuccess
  | DocumentNormalizationFailure;

function stripSeparators(value: string): string {
  return value.replace(PRESENTATION_SEPARATORS, '');
}

/**
 * Normaliza un número de documento según su tipo.
 *
 * - `CEDULA_CIUDADANIA`: solo dígitos; se retiran separadores de miles y se
 *   eliminan ceros a la izquierda para que «0001234» y «1.234» sean el mismo
 *   documento.
 * - `CEDULA_EXTRANJERIA`, `PASAPORTE`, `PERMISO_PROTECCION_TEMPORAL`:
 *   alfanumérico en mayúsculas sin separadores. No se eliminan ceros iniciales
 *   porque pueden ser significativos.
 * - `OTRO`: transformación conservadora —recorte, mayúsculas y colapso de
 *   espacios internos— porque el tipo no define un formato conocido.
 */
export function normalizeDocumentNumber(
  documentType: DocumentTypeCode,
  rawValue: string,
): DocumentNormalizationResult {
  const declared = rawValue.trim();

  if (declared.length === 0) {
    return { ok: false, reason: 'EMPTY' };
  }

  if (declared.length > DOCUMENT_NUMBER_MAX_LENGTH) {
    return { ok: false, reason: 'TOO_LONG' };
  }

  if (documentType === 'CEDULA_CIUDADANIA') {
    const digits = stripSeparators(declared);
    if (!/^\d+$/u.test(digits)) {
      return { ok: false, reason: 'INVALID_CHARACTERS' };
    }

    const withoutLeadingZeros = digits.replace(/^0+(?=\d)/u, '');
    return { ok: true, declared, normalized: withoutLeadingZeros };
  }

  if (documentType === 'OTRO') {
    const collapsed = declared.replace(/\s+/gu, ' ').toUpperCase();
    if (!/^[\p{L}\p{N} .\-/]+$/u.test(collapsed)) {
      return { ok: false, reason: 'INVALID_CHARACTERS' };
    }

    return { ok: true, declared, normalized: collapsed };
  }

  const compact = stripSeparators(declared).toUpperCase();
  if (!/^[A-Z0-9]+$/u.test(compact)) {
    return { ok: false, reason: 'INVALID_CHARACTERS' };
  }

  return { ok: true, declared, normalized: compact };
}
