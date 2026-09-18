import { Injectable } from '@nestjs/common';

import { HEALTH_RESPONSE, type HealthResponse } from '@merdn/shared';

/**
 * Servicio de salud técnico de la fundación MERDN (TASK-001).
 *
 * Alcance deliberado: informa únicamente que el proceso de la API responde.
 * No comprueba PostgreSQL, almacenamiento documental, integraciones ni ninguna
 * otra dependencia, y por lo tanto no puede afirmar su estado (FR-18).
 */
@Injectable()
export class HealthService {
  public check(): HealthResponse {
    return HEALTH_RESPONSE;
  }
}
