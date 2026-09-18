/**
 * Contrato técnico del endpoint de salud de la API MERDN (TASK-001, AD-05).
 *
 * El contrato es deliberadamente mínimo: confirma que el proceso de la API
 * responde. NO afirma el estado de PostgreSQL, del almacenamiento, de
 * integraciones ni de ninguna dependencia que no haya sido comprobada.
 */

/** Único valor de estado admitido por el contrato de salud. */
export const HEALTH_STATUS_OK = 'ok';

/** Tipo del campo `status` de la respuesta de salud. */
export type HealthStatus = typeof HEALTH_STATUS_OK;

/** Ruta del endpoint de salud expuesto por la API. */
export const HEALTH_ROUTE = '/health';

/** Cuerpo exacto devuelto por `GET /health`. No admite campos adicionales. */
export interface HealthResponse {
  readonly status: HealthStatus;
}

/** Instancia inmutable del cuerpo de respuesta de salud. */
export const HEALTH_RESPONSE: HealthResponse = Object.freeze({
  status: HEALTH_STATUS_OK,
});

/**
 * Comprueba que un valor desconocido cumple exactamente el contrato de salud:
 * un objeto con la única propiedad `status` igual a `"ok"`.
 */
export function isHealthResponse(value: unknown): value is HealthResponse {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const keys = Object.keys(value);
  if (keys.length !== 1 || keys[0] !== 'status') {
    return false;
  }

  return (value as { status: unknown }).status === HEALTH_STATUS_OK;
}
