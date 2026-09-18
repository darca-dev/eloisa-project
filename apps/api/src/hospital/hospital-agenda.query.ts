import { HOSPITAL_AGENDA_QUERY_PARAMETERS, type HospitalAgendaWindow } from './hospital.contract';
import { assertAllowlist, parseWindow, type RawOperationsQuery } from './hospital-professionals.query';

/**
 * Análisis de la consulta de Agenda (TASK-HOSPITAL-CORE-02 §6.2).
 *
 * La agenda EXIGE `from` y `to`: no existe ventana por defecto. Es deliberado.
 * Una agenda sin ventana explícita tendría que elegir un periodo por su cuenta,
 * y cualquier elección —el mes en curso, un mes fijo del calendario— acabaría
 * presentándose como «la agenda» sin que nadie la hubiera pedido. Exigir la
 * ventana obliga a que la interfaz declare siempre qué periodo está mostrando.
 *
 * Los primitivos de validación se reutilizan del módulo de profesionales: la
 * regla de allowlist de esta superficie vive en un solo sitio.
 */
export function parseAgendaQuery(
  raw: RawOperationsQuery,
  now: Date,
): HospitalAgendaWindow {
  assertAllowlist(raw, HOSPITAL_AGENDA_QUERY_PARAMETERS);

  return parseWindow(raw, now, true);
}
