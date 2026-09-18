/**
 * Superficie pública de `@merdn/shared`.
 *
 * Alcance de TASK-001: exclusivamente contratos y tipos técnicos compartidos.
 * No contiene entidades, reglas ni datos de negocio de MERDN.
 */
export {
  HEALTH_RESPONSE,
  HEALTH_ROUTE,
  HEALTH_STATUS_OK,
  isHealthResponse,
  type HealthResponse,
  type HealthStatus,
} from './health';
