import { resolvePublicApiBaseUrl } from '@/config/environment';

import {
  desenlaceDeEstado,
  esCancelacionOperaciones,
  type HospitalPacienteMinimoDto,
  type HospitalProcedenciaOperacionesDto,
  type HospitalProfesionalMinimoDto,
  type HospitalVentanaDto,
  type ResultadoOperaciones,
} from './hospitalProfessionalsClient';

/**
 * Cliente tipado de la superficie Hospital · Agenda
 * (TASK-HOSPITAL-CORE-02 §6.2 y §6.3; paquete final de corrección §4.1).
 *
 * Frontera ÚNICA entre la vista Hospital → Agenda y la API. Reutiliza los
 * desenlaces y la traducción de estados del cliente de Profesionales para que
 * la superficie de operaciones tenga UN solo contrato de error.
 *
 * Contiene la ÚNICA mutación de todo el módulo Hospital. Sobre ella:
 *
 * - envía EXACTAMENTE los tres campos del contrato; ni `tenantId`, ni
 *   `identityId`, ni rol, ni actor, ni estado, ni versión resultante;
 * - viaja con `credentials: 'include'`, porque la sesión institucional está en
 *   una cookie `HttpOnly` que este código no puede leer;
 * - el control OPTIMISTA vive en `expectedVersion`: reenviar la versión
 *   anterior NO repite la operación, la rechaza con `409`.
 *
 * NO hay repliegue a fixtures en ningún desenlace.
 */

/* -------------------------------------------------------------------------- */
/* Contrato de respuesta                                                       */
/* -------------------------------------------------------------------------- */

export type HospitalModalidadCita = 'ON_SITE' | 'HOME' | 'VIRTUAL';

export interface HospitalSolicitudDto {
  readonly appointmentId: string;
  readonly version: number;
  readonly patient: HospitalPacienteMinimoDto;
  readonly modality: HospitalModalidadCita;
  readonly requestedAt: string;
}

export interface HospitalCitaAgendaDto {
  readonly appointmentId: string;
  readonly patient: HospitalPacienteMinimoDto;
  readonly professional: HospitalProfesionalMinimoDto;
  readonly modality: HospitalModalidadCita;
  readonly status: 'REQUESTED' | 'ASSIGNED' | 'CANCELLED';
  readonly scheduledStart: string | null;
}

export interface HospitalConteoDiaDto {
  readonly date: string;
  readonly total: number;
}

export interface HospitalConteoModalidadDto {
  readonly modality: HospitalModalidadCita;
  readonly total: number;
}

export interface HospitalAgendaVistaDto extends HospitalProcedenciaOperacionesDto {
  readonly window: HospitalVentanaDto;
  readonly requests: readonly HospitalSolicitudDto[];
  readonly assignableProfessionals: readonly HospitalProfesionalMinimoDto[];
  readonly appointments: readonly HospitalCitaAgendaDto[];
  readonly dailyCounts: readonly HospitalConteoDiaDto[];
  readonly modalityCounts: readonly HospitalConteoModalidadDto[];
  readonly totalAppointments: number;
}

export interface HospitalCitaAsignadaDto extends HospitalProcedenciaOperacionesDto {
  readonly appointmentId: string;
  readonly version: number;
  readonly status: 'REQUESTED' | 'ASSIGNED' | 'CANCELLED';
  readonly modality: HospitalModalidadCita;
  readonly scheduledStart: string;
  readonly patient: HospitalPacienteMinimoDto;
  readonly professional: HospitalProfesionalMinimoDto;
  readonly careAssignmentCreated: boolean;
}

/* -------------------------------------------------------------------------- */
/* Ventana de calendario                                                       */
/* -------------------------------------------------------------------------- */

/** Escalas del calendario. Cada una produce una ventana de API coherente. */
export const HOSPITAL_AGENDA_ESCALAS = ['dia', 'semana', 'mes'] as const;

export type HospitalAgendaEscala = (typeof HOSPITAL_AGENDA_ESCALAS)[number];

/** Amplitud máxima que la API admite, en días naturales inclusivos. */
export const HOSPITAL_AGENDA_MAX_DIAS = 31;

/** `true` cuando la cadena es una fecha calendario `AAAA-MM-DD` real. */
export function esFechaCalendario(valor: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(valor)) {
    return false;
  }

  const instante = new Date(`${valor}T00:00:00.000Z`);

  return (
    !Number.isNaN(instante.getTime()) && instante.toISOString().slice(0, 10) === valor
  );
}

/** Fecha calendario `AAAA-MM-DD` en UTC de un instante. */
export function fechaCalendarioDe(instante: Date): string {
  return instante.toISOString().slice(0, 10);
}

function sumarDias(fecha: string, dias: number): string {
  const base = new Date(`${fecha}T00:00:00.000Z`).getTime();

  return new Date(base + dias * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/**
 * Ventana de API derivada de la fecha activa y de la escala.
 *
 * Es una función PURA: no lee el reloj. La fecha activa la aporta la vista, que
 * es el único punto autorizado a consultarlo una sola vez al montar.
 *
 * - `dia`: exactamente ese día;
 * - `semana`: la semana de lunes a domingo que lo contiene;
 * - `mes`: el mes natural completo, que nunca supera los 31 días de la API.
 */
export function ventanaDeEscala(
  fecha: string,
  escala: HospitalAgendaEscala,
): HospitalVentanaDto {
  const instante = new Date(`${fecha}T00:00:00.000Z`);

  if (escala === 'dia') {
    return { from: fecha, to: fecha };
  }

  if (escala === 'semana') {
    // `getUTCDay()` devuelve 0 para domingo; se desplaza para que la semana
    // empiece en lunes, que es como la agenda institucional la presenta.
    const diaSemana = (instante.getUTCDay() + 6) % 7;

    return { from: sumarDias(fecha, -diaSemana), to: sumarDias(fecha, 6 - diaSemana) };
  }

  const anio = instante.getUTCFullYear();
  const mes = instante.getUTCMonth();
  const primero = new Date(Date.UTC(anio, mes, 1)).toISOString().slice(0, 10);
  const ultimo = new Date(Date.UTC(anio, mes + 1, 0)).toISOString().slice(0, 10);

  return { from: primero, to: ultimo };
}

/**
 * Instante ISO-8601 con desplazamiento EXPLÍCITO a partir de fecha y hora
 * locales del formulario.
 *
 * El navegador entrega `AAAA-MM-DD` y `HH:MM` sin zona; se construye un `Date`
 * en la zona del dispositivo y se serializa en UTC, de modo que el instante que
 * viaja a la API queda siempre desambiguado. Devuelve `null` cuando la
 * combinación no es una fecha real: la vista no envía nada en ese caso.
 */
export function instanteDeFechaHora(fecha: string, hora: string): string | null {
  if (!esFechaCalendario(fecha) || !/^\d{2}:\d{2}$/u.test(hora)) {
    return null;
  }

  const [horas, minutos] = hora.split(':').map((parte) => Number.parseInt(parte, 10));

  if (horas === undefined || minutos === undefined || horas > 23 || minutos > 59) {
    return null;
  }

  const [anio, mes, dia] = fecha.split('-').map((parte) => Number.parseInt(parte, 10));
  const instante = new Date(anio ?? 0, (mes ?? 1) - 1, dia ?? 1, horas, minutos, 0, 0);

  return Number.isNaN(instante.getTime()) ? null : instante.toISOString();
}

/* -------------------------------------------------------------------------- */
/* Desenlaces                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Desenlace de la asignación.
 *
 * `conflicto-version` y `no-asignable` se distinguen porque la acción de la
 * persona es distinta: la primera exige recargar la agenda; la segunda, elegir
 * otro profesional u otra hora. Ninguna de las dos revela la cita en conflicto.
 */
export type ResultadoAsignacion =
  | { readonly kind: 'ok'; readonly datos: HospitalCitaAsignadaDto }
  | { readonly kind: 'conflicto-version' }
  | { readonly kind: 'no-asignable' }
  | { readonly kind: 'sin-sesion' }
  | { readonly kind: 'sin-permiso' }
  | { readonly kind: 'no-encontrado' }
  | { readonly kind: 'datos-invalidos' }
  | { readonly kind: 'no-disponible' }
  | { readonly kind: 'cancelado' }
  | { readonly kind: 'error' };

const AGENDA_PATH = '/api/v1/hospital/agenda';
const APPOINTMENTS_PATH = '/api/v1/hospital/appointments';

/** Rutas consultadas, expuestas para las pruebas de contrato. */
export const RUTAS_HOSPITAL_AGENDA = {
  agenda: AGENDA_PATH,
  asignacion: (appointmentId: string): string =>
    `${APPOINTMENTS_PATH}/${encodeURIComponent(appointmentId)}/assignment`,
} as const;

/** Códigos estables de conflicto que el servidor devuelve con `409`. */
export const HOSPITAL_CODIGO_CONFLICTO_VERSION = 'APPOINTMENT_VERSION_CONFLICT';

/** Consulta la agenda de la ventana indicada. Las dos fechas son obligatorias. */
export async function consultarAgenda(
  ventana: HospitalVentanaDto,
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<ResultadoOperaciones<HospitalAgendaVistaDto>> {
  const params = new URLSearchParams({ from: ventana.from, to: ventana.to });
  let response: Response;

  try {
    response = await fetchImpl(
      `${resolvePublicApiBaseUrl()}${AGENDA_PATH}?${params.toString()}`,
      {
        method: 'GET',
        credentials: 'include',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
        ...(signal === undefined ? {} : { signal }),
      },
    );
  } catch (error) {
    return esCancelacionOperaciones(error, signal)
      ? { kind: 'cancelado' }
      : { kind: 'error' };
  }

  if (signal?.aborted === true) {
    return { kind: 'cancelado' };
  }

  const desenlace = desenlaceDeEstado<HospitalAgendaVistaDto>(response.status);

  if (desenlace !== null) {
    return desenlace;
  }

  if (!response.ok) {
    return { kind: 'error' };
  }

  try {
    return { kind: 'ok', datos: (await response.json()) as HospitalAgendaVistaDto };
  } catch {
    return { kind: 'error' };
  }
}

/** Cuerpo EXACTO que la mutación admite. Ningún campo más viaja al servidor. */
export interface HospitalAsignacionBody {
  readonly professionalId: string;
  readonly scheduledStart: string;
  readonly expectedVersion: number;
}

/**
 * Asigna una solicitud existente a un profesional existente.
 *
 * ÚNICA mutación de todo el módulo Hospital. No reprograma, no rechaza, no
 * cancela y no crea nada.
 */
export async function asignarCita(
  appointmentId: string,
  cuerpo: HospitalAsignacionBody,
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<ResultadoAsignacion> {
  let response: Response;

  try {
    response = await fetchImpl(
      `${resolvePublicApiBaseUrl()}${RUTAS_HOSPITAL_AGENDA.asignacion(appointmentId)}`,
      {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        cache: 'no-store',
        // Objeto NUEVO y literal: nada del estado de la vista se filtra al cuerpo.
        body: JSON.stringify({
          professionalId: cuerpo.professionalId,
          scheduledStart: cuerpo.scheduledStart,
          expectedVersion: cuerpo.expectedVersion,
        }),
        ...(signal === undefined ? {} : { signal }),
      },
    );
  } catch (error) {
    return esCancelacionOperaciones(error, signal)
      ? { kind: 'cancelado' }
      : { kind: 'error' };
  }

  if (signal?.aborted === true) {
    return { kind: 'cancelado' };
  }

  if (response.status === 409) {
    /*
     * El cuerpo del `409` solo aporta un código estable. Si no puede leerse, se
     * conserva el desenlace más conservador —conflicto de versión—, que obliga
     * a recargar antes de volver a intentarlo.
     */
    try {
      const detalle = (await response.json()) as { readonly code?: unknown };

      return detalle.code === HOSPITAL_CODIGO_CONFLICTO_VERSION
        ? { kind: 'conflicto-version' }
        : { kind: 'no-asignable' };
    } catch {
      return { kind: 'conflicto-version' };
    }
  }

  switch (response.status) {
    case 400:
      return { kind: 'datos-invalidos' };
    case 401:
      return { kind: 'sin-sesion' };
    case 403:
      return { kind: 'sin-permiso' };
    case 404:
      return { kind: 'no-encontrado' };
    case 503:
      return { kind: 'no-disponible' };
    default:
      break;
  }

  if (!response.ok) {
    return { kind: 'error' };
  }

  try {
    return { kind: 'ok', datos: (await response.json()) as HospitalCitaAsignadaDto };
  } catch {
    return { kind: 'error' };
  }
}
