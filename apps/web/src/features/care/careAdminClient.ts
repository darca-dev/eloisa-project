import { resolvePublicApiBaseUrl } from '@/config/environment';
import { esCancelacion } from '@/features/auth/humanSessionClient';

import { type Resultado } from './careClient';

/**
 * Cliente de la administración de permisos de cuidado (SPEC 055 / MP05b).
 * La sesión viaja en la cookie; el servidor verifica en cada operación que la
 * cuenta sea gestora vigente de la organización. Las personas se identifican
 * por documento exacto; nunca se descargan listados del tenant.
 */

export const RUTA_ADMIN_CUIDADO = '/api/v1/care/admin';

export type TipoDocumento = 'CEDULA_CIUDADANIA' | 'CEDULA_EXTRANJERIA' | 'PASAPORTE' | 'PERMISO_PROTECCION_TEMPORAL' | 'OTRO';
export type TipoParticipante = 'CAREGIVER' | 'PROFESSIONAL' | 'HOSPITAL_REVIEWER';
export type PermisoCuidado = 'VIEW_RECORDS' | 'CONTRIBUTE_RECORDS' | 'REQUEST_ALARM' | 'MANAGE_RULES' | 'REVIEW_ALARMS';

export interface DocumentoPersona {
  readonly documentType: TipoDocumento;
  readonly documentNumber: string;
}

export interface OrganizacionGestionadaDto {
  readonly organizationId: string;
  readonly name: string;
  readonly kind: string;
}

export interface ConcesionDto {
  readonly id: string;
  readonly actorKind: TipoParticipante;
  readonly permission: PermisoCuidado;
  readonly personLabel: string;
  readonly status: 'ACTIVE' | 'REVOKED';
  readonly endsAt: string | null;
  readonly authorizationReference: string;
}

export interface EspacioDto {
  readonly contextId: string;
  readonly patientLabel: string;
  readonly status: 'ACTIVE' | 'REVOKED';
  readonly authorizationReference: string;
  readonly grants: readonly ConcesionDto[];
}

export interface CompetenciaDto {
  readonly id: string;
  readonly personLabel: string;
  readonly status: 'ACTIVE' | 'REVOKED';
  readonly evidenceReference: string;
  readonly endsAt: string | null;
}

export interface AdministracionDto {
  readonly organizationId: string;
  readonly organizationName: string;
  readonly contexts: readonly EspacioDto[];
  readonly competences: readonly CompetenciaDto[];
}

type Fetch = typeof fetch;

async function pedir<T>(f: Fetch, method: 'GET' | 'POST', path: string, body?: object): Promise<Resultado<T>> {
  let respuesta: Response;
  try {
    respuesta = await f(`${resolvePublicApiBaseUrl()}${RUTA_ADMIN_CUIDADO}${path}`, {
      method,
      credentials: 'include',
      cache: 'no-store',
      headers: body === undefined ? { Accept: 'application/json' } : { Accept: 'application/json', 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch (error) {
    return esCancelacion(error) ? { kind: 'cancelado' } : { kind: 'indisponible' };
  }
  if (respuesta.status === 401) return { kind: 'sin-sesion' };
  if (respuesta.status === 403) return { kind: 'denegado' };
  if (respuesta.status === 404) return { kind: 'no-encontrado' };
  if (respuesta.status === 409) return { kind: 'conflicto' };
  if (respuesta.status === 400) {
    const detalle = (await respuesta.json().catch(() => null)) as { message?: unknown } | null;
    return { kind: 'invalido', mensaje: typeof detalle?.message === 'string' ? detalle.message : 'Revise los datos del formulario.' };
  }
  if (!respuesta.ok) return { kind: 'indisponible' };
  try {
    return { kind: 'ok', data: (await respuesta.json()) as T };
  } catch {
    return { kind: 'indisponible' };
  }
}

const id = (value: string): string => encodeURIComponent(value);

export const careAdminClient = {
  organizaciones: (f: Fetch = fetch) => pedir<readonly OrganizacionGestionadaDto[]>(f, 'GET', '/organizations'),
  resumen: (org: string, f: Fetch = fetch) => pedir<AdministracionDto>(f, 'GET', `/organizations/${id(org)}`),
  crearEspacio: (org: string, entrada: { patient: DocumentoPersona; authorizationReference: string }, f: Fetch = fetch) =>
    pedir<AdministracionDto>(f, 'POST', `/organizations/${id(org)}/contexts`, entrada),
  conceder: (
    org: string,
    contextId: string,
    entrada: { actorKind: TipoParticipante; permission: PermisoCuidado; person: DocumentoPersona; authorizationReference: string },
    f: Fetch = fetch,
  ) => pedir<AdministracionDto>(f, 'POST', `/organizations/${id(org)}/contexts/${id(contextId)}/grants`, entrada),
  revocar: (org: string, grantId: string, f: Fetch = fetch) =>
    pedir<AdministracionDto>(f, 'POST', `/organizations/${id(org)}/grants/${id(grantId)}/revoke`, {}),
  declararCompetencia: (org: string, entrada: { person: DocumentoPersona; evidenceReference: string }, f: Fetch = fetch) =>
    pedir<AdministracionDto>(f, 'POST', `/organizations/${id(org)}/competences`, entrada),
  revocarCompetencia: (org: string, competenceId: string, f: Fetch = fetch) =>
    pedir<AdministracionDto>(f, 'POST', `/organizations/${id(org)}/competences/${id(competenceId)}/revoke`, {}),
};

export const TEXTO_PARTICIPANTE: Readonly<Record<TipoParticipante, string>> = {
  CAREGIVER: 'Cuidador',
  PROFESSIONAL: 'Profesional asignado',
  HOSPITAL_REVIEWER: 'Revisor del hospital',
};

export const TEXTO_PERMISO: Readonly<Record<PermisoCuidado, string>> = {
  VIEW_RECORDS: 'Ver la bitácora',
  CONTRIBUTE_RECORDS: 'Registrar en la bitácora',
  REQUEST_ALARM: 'Pedir revisión',
  MANAGE_RULES: 'Definir datos y criterios',
  REVIEW_ALARMS: 'Revisar alarmas',
};

/** Permisos que admite cada participante (misma forma que exige el servidor). */
export const PERMISOS_POR_PARTICIPANTE: Readonly<Record<TipoParticipante, readonly PermisoCuidado[]>> = {
  CAREGIVER: ['VIEW_RECORDS', 'CONTRIBUTE_RECORDS', 'REQUEST_ALARM'],
  PROFESSIONAL: ['VIEW_RECORDS', 'CONTRIBUTE_RECORDS', 'REQUEST_ALARM', 'MANAGE_RULES', 'REVIEW_ALARMS'],
  HOSPITAL_REVIEWER: ['VIEW_RECORDS', 'REVIEW_ALARMS'],
};

export const TEXTO_DOCUMENTO: Readonly<Record<TipoDocumento, string>> = {
  CEDULA_CIUDADANIA: 'Cédula de ciudadanía',
  CEDULA_EXTRANJERIA: 'Cédula de extranjería',
  PASAPORTE: 'Pasaporte',
  PERMISO_PROTECCION_TEMPORAL: 'Permiso por protección temporal',
  OTRO: 'Otro',
};
