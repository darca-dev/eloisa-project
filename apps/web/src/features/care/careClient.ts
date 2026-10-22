import { resolvePublicApiBaseUrl } from '@/config/environment';
import { esCancelacion } from '@/features/auth/humanSessionClient';

/**
 * Cliente tipado de bitácoras y alarmas de cuidado (SPEC 055 / MP02–MP03).
 *
 * Frontera ÚNICA entre los portales y `/api/v1/care`. Reglas:
 *
 * - la sesión viaja en la cookie `HttpOnly` (`credentials: 'include'`); este
 *   código no la lee ni envía cabeceras de identidad;
 * - NUNCA se envía actor, tenant, organización, paciente, fuente, recepción,
 *   severidad ni estado al crear: el servidor los decide;
 * - cada escritura lleva una `idempotencyKey` generada UNA vez por intento, de
 *   modo que reintentar el mismo envío no duplica;
 * - no hay caché ni almacenamiento local de datos de cuidado;
 * - los desenlaces se reducen a un conjunto CERRADO; el detalle técnico del
 *   servidor no llega a la interfaz salvo el mensaje de validación de campo.
 */

export const RUTA_CUIDADO = '/api/v1/care';

export type AccionCuidado = 'VIEW_RECORDS' | 'CONTRIBUTE_RECORDS' | 'REQUEST_ALARM' | 'MANAGE_RULES' | 'REVIEW_ALARMS';
export type TipoDato = 'BOOLEAN' | 'NUMBER' | 'CHOICE';
export type Severidad = 'ROJA' | 'AMARILLA' | 'ESTABLE';
export type EstadoAlarma = 'NUEVA' | 'EN_GESTION' | 'RESUELTA' | 'CERRADA';
export type AccionRevisor = 'ACKNOWLEDGE' | 'CLASSIFY' | 'ASSIGN' | 'RESOLVE' | 'CLOSE' | 'REOPEN';

export interface ContextoCuidadoDto {
  readonly contextId: string;
  readonly organizationId: string;
  readonly organizationName: string;
  readonly patientLabel: string;
  readonly actorKind: 'PATIENT' | 'CAREGIVER' | 'PROFESSIONAL' | 'HOSPITAL_REVIEWER';
  readonly actions: readonly AccionCuidado[];
}

export interface OpcionDto {
  readonly code: string;
  readonly label: string;
}

export interface DatoDto {
  readonly id: string;
  readonly code: string;
  readonly version: number;
  readonly label: string;
  readonly valueType: TipoDato;
  readonly unit: string | null;
  readonly options: readonly OpcionDto[] | null;
  readonly validatedAt: string;
}

export type ValorMostrado = boolean | string | null;

export interface ObservacionDto {
  readonly id: string;
  readonly definitionId: string;
  readonly label: string;
  readonly valueType: TipoDato;
  readonly unit: string | null;
  readonly value: ValorMostrado;
}

export interface EnmiendaDto {
  readonly id: string;
  readonly sequence: number;
  readonly observationId: string | null;
  readonly reason: string;
  readonly note: string | null;
  readonly replacement: ValorMostrado;
  readonly createdAt: string;
  readonly authoredByMe: boolean;
}

export interface RegistroDto {
  readonly id: string;
  readonly source: 'PATIENT' | 'CAREGIVER' | 'PROFESSIONAL';
  readonly authoredByMe: boolean;
  readonly occurredAt: string;
  readonly receivedAt: string;
  readonly note: string | null;
  readonly observations: readonly ObservacionDto[];
  readonly amendments: readonly EnmiendaDto[];
}

/** Registro creado y lo que hizo el motor de criterios (MP04). */
export interface RegistroCreadoDto extends RegistroDto {
  readonly evaluation: { readonly alarmsOpened: number; readonly evidenceAdded: number } | null;
}

export interface TransicionDto {
  readonly id: string;
  readonly action: AccionRevisor | 'CREATE' | 'REPORT_RESOLUTION';
  readonly stateAfter: EstadoAlarma;
  readonly severityAfter: Severidad | null;
  readonly reason: string | null;
  readonly createdAt: string;
  readonly byMe: boolean;
}

export interface AlarmaDto {
  readonly id: string;
  readonly origin: 'MANUAL' | 'AUTOMATIC';
  readonly note: string | null;
  readonly severity: Severidad | null;
  readonly state: EstadoAlarma;
  readonly assigned: boolean;
  readonly assignedToMe: boolean;
  readonly initiatedByMe: boolean;
  readonly version: number;
  readonly createdAt: string;
  readonly resolvedAt: string | null;
  readonly closedAt: string | null;
  readonly transitions?: readonly TransicionDto[];
}

export interface PaginaDto<T> {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
}

export interface BandejaDto extends PaginaDto<AlarmaDto> {
  readonly canReview: boolean;
}

export interface AlarmaCreadaDto {
  readonly alarm: AlarmaDto;
  readonly receiptMessage: string;
}

/** Desenlaces CERRADOS. Ninguno contiene datos de otra persona. */
export type Resultado<T> =
  | { readonly kind: 'ok'; readonly data: T }
  | { readonly kind: 'sin-sesion' }
  | { readonly kind: 'denegado' }
  | { readonly kind: 'invalido'; readonly mensaje: string }
  | { readonly kind: 'conflicto' }
  | { readonly kind: 'no-encontrado' }
  | { readonly kind: 'indisponible' }
  | { readonly kind: 'cancelado' };

type Fetch = typeof fetch;

function url(path: string): string {
  return `${resolvePublicApiBaseUrl()}${RUTA_CUIDADO}${path}`;
}

function segmento(id: string): string {
  return encodeURIComponent(id);
}

async function pedir<T>(
  fetchImpl: Fetch,
  method: 'GET' | 'POST',
  path: string,
  body?: object,
  signal?: AbortSignal,
): Promise<Resultado<T>> {
  let respuesta: Response;

  try {
    respuesta = await fetchImpl(url(path), {
      method,
      credentials: 'include',
      cache: 'no-store',
      headers: body === undefined ? { Accept: 'application/json' } : { Accept: 'application/json', 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      ...(signal === undefined ? {} : { signal }),
    });
  } catch (error) {
    return esCancelacion(error, signal) ? { kind: 'cancelado' } : { kind: 'indisponible' };
  }

  if (respuesta.status === 401) return { kind: 'sin-sesion' };
  if (respuesta.status === 403) return { kind: 'denegado' };
  if (respuesta.status === 404) return { kind: 'no-encontrado' };
  if (respuesta.status === 409) return { kind: 'conflicto' };

  if (respuesta.status === 400) {
    const detalle = (await respuesta.json().catch(() => null)) as { message?: unknown } | null;
    return {
      kind: 'invalido',
      mensaje: typeof detalle?.message === 'string' ? detalle.message : 'Revise los datos del formulario.',
    };
  }

  if (!respuesta.ok) return { kind: 'indisponible' };

  try {
    return { kind: 'ok', data: (await respuesta.json()) as T };
  } catch {
    return { kind: 'indisponible' };
  }
}

/** Clave nueva por intento. El mismo intento reenviado reutiliza la suya. */
export function nuevaClaveEnvio(): string {
  return globalThis.crypto.randomUUID();
}

export const careClient = {
  contextos: (f: Fetch = fetch, signal?: AbortSignal) =>
    pedir<PaginaDto<ContextoCuidadoDto>>(f, 'GET', '/contexts?limit=50', undefined, signal),

  datos: (contextId: string, f: Fetch = fetch, signal?: AbortSignal) =>
    pedir<readonly DatoDto[]>(f, 'GET', `/contexts/${segmento(contextId)}/observables`, undefined, signal),

  definirDato: (
    contextId: string,
    entrada: { idempotencyKey: string; code: string; label: string; valueType: TipoDato; unit?: string; options?: readonly OpcionDto[] },
    f: Fetch = fetch,
  ) => pedir<DatoDto>(f, 'POST', `/contexts/${segmento(contextId)}/observables`, entrada),

  registros: (contextId: string, f: Fetch = fetch, signal?: AbortSignal) =>
    pedir<PaginaDto<RegistroDto>>(f, 'GET', `/contexts/${segmento(contextId)}/records?limit=20`, undefined, signal),

  registrar: (
    contextId: string,
    entrada: {
      idempotencyKey: string;
      occurredAt: string;
      note?: string;
      observations: readonly { definitionId: string; value: boolean | string }[];
    },
    f: Fetch = fetch,
  ) => pedir<RegistroCreadoDto>(f, 'POST', `/contexts/${segmento(contextId)}/records`, entrada),

  enmendar: (
    contextId: string,
    recordId: string,
    entrada: { idempotencyKey: string; expectedSequence: number; reason: string; note?: string; observationId?: string; replacement?: boolean | string },
    f: Fetch = fetch,
  ) => pedir<RegistroDto>(f, 'POST', `/contexts/${segmento(contextId)}/records/${segmento(recordId)}/amendments`, entrada),

  alarmas: (contextId: string, f: Fetch = fetch, signal?: AbortSignal) =>
    pedir<BandejaDto>(f, 'GET', `/contexts/${segmento(contextId)}/alarms?limit=50`, undefined, signal),

  alarma: (contextId: string, alarmId: string, f: Fetch = fetch, signal?: AbortSignal) =>
    pedir<AlarmaDto>(f, 'GET', `/contexts/${segmento(contextId)}/alarms/${segmento(alarmId)}`, undefined, signal),

  pedirRevision: (contextId: string, entrada: { idempotencyKey: string; note?: string }, f: Fetch = fetch) =>
    pedir<AlarmaCreadaDto>(f, 'POST', `/contexts/${segmento(contextId)}/alarms`, { ...entrada, reasonCode: 'REQUEST_REVIEW' }),

  transicion: (
    contextId: string,
    alarmId: string,
    entrada: { action: AccionRevisor; expectedVersion: number; reason?: string; severity?: Severidad; assignee?: 'self' },
    f: Fetch = fetch,
  ) => pedir<AlarmaDto>(f, 'POST', `/contexts/${segmento(contextId)}/alarms/${segmento(alarmId)}/transitions`, entrada),

  informarResolucion: (contextId: string, alarmId: string, entrada: { idempotencyKey: string; note?: string }, f: Fetch = fetch) =>
    pedir<AlarmaDto>(f, 'POST', `/contexts/${segmento(contextId)}/alarms/${segmento(alarmId)}/resolution-reports`, entrada),
};

/* -------------------------------------------------------------------------- */
/* MP04–MP05: criterios individuales, semáforo y cola de revisión              */
/* -------------------------------------------------------------------------- */

export type Comparador = 'EQ' | 'NEQ' | 'GT' | 'GTE' | 'LT' | 'LTE' | 'IN';
export type NivelSemaforo = 'ROJO' | 'AMARILLO' | 'PENDIENTE' | 'ESTABLE' | 'SIN_CRITERIOS';

export interface VersionCriterioDto {
  readonly id: string;
  readonly version: number;
  readonly observableCode: string;
  readonly valueType: TipoDato;
  readonly comparator: Comparador;
  readonly value: boolean | string | readonly string[];
  readonly requiredCount: number;
  readonly windowMinutes: number;
  readonly severity: Severidad;
  readonly activatedAt: string;
  readonly validUntil: string | null;
  readonly status: 'ACTIVE' | 'SUPERSEDED' | 'RETIRED';
}

export interface CriterioDto {
  readonly id: string;
  readonly status: 'ACTIVE' | 'RETIRED';
  readonly retiredReason: string | null;
  readonly current: VersionCriterioDto | null;
}

export interface SemaforoDto {
  readonly level: NivelSemaforo;
  readonly label: string;
  readonly openAlarms: { readonly ROJA: number; readonly AMARILLA: number; readonly ESTABLE: number; readonly SIN: number };
  readonly activeCriteria: number;
}

export interface EvidenciaDto {
  readonly label: string;
  readonly unit: string | null;
  readonly valueType: TipoDato;
  readonly value: ValorMostrado;
  readonly occurredAt: string;
  readonly correctedAfterwards: boolean;
}

export interface DetalleAlarmaDto extends AlarmaDto {
  readonly transitions: readonly TransicionDto[];
  readonly evidence: readonly EvidenciaDto[];
}

export interface ElementoColaDto {
  readonly contextId: string;
  readonly organizationName: string;
  readonly patientLabel: string;
  readonly semaphore: SemaforoDto;
  readonly alarms: readonly {
    readonly id: string;
    readonly origin: 'MANUAL' | 'AUTOMATIC';
    readonly severity: Severidad | null;
    readonly state: EstadoAlarma;
    readonly createdAt: string;
    readonly assignedToMe: boolean;
  }[];
}

export interface EntradaCriterio {
  readonly idempotencyKey: string;
  readonly criterionId?: string;
  readonly observableCode: string;
  readonly comparator: Comparador;
  readonly value: boolean | string | readonly string[];
  readonly requiredCount: number;
  readonly windowMinutes: number;
  readonly severity: Severidad;
  readonly validUntil?: string;
}

export const careCriteriosClient = {
  criterios: (contextId: string, f: Fetch = fetch, signal?: AbortSignal) =>
    pedir<readonly CriterioDto[]>(f, 'GET', `/contexts/${segmento(contextId)}/criteria`, undefined, signal),

  definir: (contextId: string, entrada: EntradaCriterio, f: Fetch = fetch) =>
    pedir<CriterioDto>(f, 'POST', `/contexts/${segmento(contextId)}/criteria`, entrada),

  retirar: (contextId: string, criterionId: string, reason: string, f: Fetch = fetch) =>
    pedir<CriterioDto>(f, 'POST', `/contexts/${segmento(contextId)}/criteria/${segmento(criterionId)}/retire`, { reason }),

  semaforo: (contextId: string, f: Fetch = fetch, signal?: AbortSignal) =>
    pedir<SemaforoDto>(f, 'GET', `/contexts/${segmento(contextId)}/semaphore`, undefined, signal),

  detalle: (contextId: string, alarmId: string, f: Fetch = fetch) =>
    pedir<DetalleAlarmaDto>(f, 'GET', `/contexts/${segmento(contextId)}/alarms/${segmento(alarmId)}`),

  cola: (f: Fetch = fetch, signal?: AbortSignal) => pedir<readonly ElementoColaDto[]>(f, 'GET', '/review-queue', undefined, signal),
};

export const TEXTO_COMPARADOR: Readonly<Record<Comparador, string>> = {
  EQ: 'igual a',
  NEQ: 'distinto de',
  GT: 'mayor que',
  GTE: 'mayor o igual que',
  LT: 'menor que',
  LTE: 'menor o igual que',
  IN: 'alguna de',
};

/** Descripción legible de un criterio, sin abreviaturas técnicas. */
export function describirCriterio(version: VersionCriterioDto, etiquetaDato: string): string {
  const valor = Array.isArray(version.value)
    ? version.value.join(', ')
    : typeof version.value === 'boolean'
      ? version.value
        ? 'Sí'
        : 'No'
      : version.value;
  const ventana = version.windowMinutes % 1440 === 0
    ? `${version.windowMinutes / 1440} día(s)`
    : version.windowMinutes % 60 === 0
      ? `${version.windowMinutes / 60} hora(s)`
      : `${version.windowMinutes} minuto(s)`;
  return `${etiquetaDato} ${TEXTO_COMPARADOR[version.comparator]} ${valor}, ${version.requiredCount} vez/veces en ${ventana} → alarma ${TEXTO_SEVERIDAD[version.severity].toLowerCase()}`;
}

/* -------------------------------------------------------------------------- */
/* Textos de presentación. La severidad SIEMPRE se nombra, nunca solo color.   */
/* -------------------------------------------------------------------------- */

export const TEXTO_SEVERIDAD: Readonly<Record<Severidad | 'PENDIENTE', string>> = {
  ROJA: 'Roja',
  AMARILLA: 'Amarilla',
  ESTABLE: 'Estable',
  PENDIENTE: 'Pendiente de clasificación',
};

export const TEXTO_ESTADO: Readonly<Record<EstadoAlarma, string>> = {
  NUEVA: 'Nueva, sin revisar',
  EN_GESTION: 'En gestión',
  RESUELTA: 'Resuelta',
  CERRADA: 'Cerrada',
};

export const TEXTO_FUENTE: Readonly<Record<RegistroDto['source'], string>> = {
  PATIENT: 'Paciente',
  CAREGIVER: 'Cuidador',
  PROFESSIONAL: 'Profesional',
};

export const TEXTO_ACCION: Readonly<Record<TransicionDto['action'], string>> = {
  CREATE: 'Solicitud registrada',
  ACKNOWLEDGE: 'Revisión iniciada',
  CLASSIFY: 'Clasificada',
  ASSIGN: 'Asignada',
  RESOLVE: 'Resuelta',
  CLOSE: 'Cerrada',
  REOPEN: 'Reabierta',
  REPORT_RESOLUTION: 'El solicitante informó que se resolvió',
};

/** Valor legible. Un sí/no se escribe; un número conserva su texto exacto. */
export function valorLegible(valor: ValorMostrado, dato: { valueType: TipoDato; unit: string | null; options?: readonly OpcionDto[] | null }): string {
  if (valor === null) return 'Sin valor';
  if (typeof valor === 'boolean') return valor ? 'Sí' : 'No';
  if (dato.valueType === 'NUMBER') return dato.unit === null ? valor : `${valor} ${dato.unit}`;
  return dato.options?.find((opcion) => opcion.code === valor)?.label ?? valor;
}
