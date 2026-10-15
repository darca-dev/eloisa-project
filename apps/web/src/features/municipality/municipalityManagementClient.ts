import { isMunicipalSection, validateMunicipalWrite, type MunicipalDocument, type MunicipalSectionId, type MunicipalWrite } from '@merdn/shared';
import { resolvePublicApiBaseUrl } from '@/config/environment';

export type MunicipalManagementResult = { readonly kind: 'ok'; readonly document: MunicipalDocument } | { readonly kind: 'error' | 'unauthorized' | 'forbidden' | 'conflict' | 'cancelled'; readonly message?: string };
export async function municipalManagement(section: MunicipalSectionId, input?: MunicipalWrite, signal?: AbortSignal, fetchImpl: typeof fetch = fetch): Promise<MunicipalManagementResult> {
  try {
    const response = await fetchImpl(`${resolvePublicApiBaseUrl()}/api/v1/municipality/management/${section}`, { method: input === undefined ? 'GET' : 'PUT', credentials: 'include', cache: 'no-store', headers: { Accept: 'application/json', ...(input === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(input === undefined ? {} : { body: JSON.stringify(input) }), ...(signal ? { signal } : {}) });
    if (signal?.aborted) return { kind: 'cancelled' };
    if (response.status === 401) return { kind: 'unauthorized' };
    if (response.status === 403) return { kind: 'forbidden' };
    if (response.status === 409) return { kind: 'conflict' };
    if (!response.ok) return { kind: 'error', message: 'No se confirmó la operación. Recarga el apartado para comprobar su estado.' };
    const document = await response.json() as MunicipalDocument;
    if (!isMunicipalSection(document.section) || document.section !== section || !Number.isSafeInteger(document.version) || document.version < 0 || (document.updatedAt !== null && (typeof document.updatedAt !== 'string' || !Number.isFinite(Date.parse(document.updatedAt)))) || validateMunicipalWrite(section, { expectedVersion: document.version, payloadSchemaVersion: document.payloadSchemaVersion, entries: document.entries }) !== null) return { kind: 'error' };
    return { kind: 'ok', document };
  } catch { return { kind: signal?.aborted ? 'cancelled' : 'error' }; }
}
