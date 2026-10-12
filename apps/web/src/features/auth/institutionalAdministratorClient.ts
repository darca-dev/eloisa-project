import { resolvePublicApiBaseUrl } from '@/config/environment';
import { cerrarSesionHumana, esCancelacion } from './humanSessionClient';
import { type ResultadoCierre, type ResultadoSesion } from './institutionalSessionClient';

export type InstitutionalExperience = 'hospital' | 'municipality';
export const institutionalAdministratorUrl = (experience: InstitutionalExperience, resource: string): string =>
  `${resolvePublicApiBaseUrl()}/api/v1/institutional/${experience}/${resource}`;

export async function consultarAdministrador(experience: InstitutionalExperience, fetchImpl: typeof fetch = fetch, signal?: AbortSignal): Promise<ResultadoSesion> {
  try {
    const response = await fetchImpl(institutionalAdministratorUrl(experience, 'administrator/current'), { credentials: 'include', cache: 'no-store', ...(signal === undefined ? {} : { signal }) });
    if (response.status === 401 || response.status === 403) return { kind: 'sin-sesion' };
    if (!response.ok) return { kind: 'error' };
    const body: unknown = await response.json();
    if (body === null || typeof body !== 'object') return { kind: 'error' };
    const value = body as Record<string, unknown>;
    const expected = experience === 'hospital' ? 'HOSPITAL' : 'MUNICIPALITY';
    if (value.experience !== expected || value.administrator !== true || typeof value.expiresAt !== 'string' || !Number.isFinite(Date.parse(value.expiresAt)) || value.institution === null || typeof value.institution !== 'object' || !('name' in value.institution) || typeof value.institution.name !== 'string') return { kind: 'error' };
    return { kind: 'ok', datos: { role: experience === 'hospital' ? 'HOSPITAL_PATIENT_VIEWER' : 'MUNICIPAL_VIEWER', expiresAt: value.expiresAt, institution: { name: value.institution.name }, actorDisplay: 'Administrador institucional', administrator: true } };
  } catch (error) { return { kind: esCancelacion(error, signal) ? 'cancelado' : 'error' }; }
}
export const consultarAdministradorHospital = (fetchImpl: typeof fetch = fetch, signal?: AbortSignal) => consultarAdministrador('hospital', fetchImpl, signal);
export const consultarAdministradorMunicipal = (fetchImpl: typeof fetch = fetch, signal?: AbortSignal) => consultarAdministrador('municipality', fetchImpl, signal);
export async function cerrarSesionAdministrador(fetchImpl: typeof fetch = fetch, signal?: AbortSignal): Promise<ResultadoCierre> {
  const result = await cerrarSesionHumana(fetchImpl, signal);
  return { kind: result === 'no-disponible' || result === 'demasiados-intentos' ? 'error' : result };
}
