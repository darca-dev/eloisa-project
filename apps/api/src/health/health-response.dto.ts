import { ApiProperty } from '@nestjs/swagger';

import { HEALTH_STATUS_OK, type HealthResponse, type HealthStatus } from '@merdn/shared';

/**
 * Representación OpenAPI del contrato de salud (TASK-001, AD-05).
 *
 * El cuerpo es deliberadamente mínimo. No expone versión, entorno, host,
 * dependencias, configuración ni estado de PostgreSQL.
 */
export class HealthResponseDto implements HealthResponse {
  @ApiProperty({
    description:
      'Confirma que el proceso de la API responde. No afirma el estado de PostgreSQL, ' +
      'del almacenamiento ni de ninguna integración.',
    enum: [HEALTH_STATUS_OK],
    example: HEALTH_STATUS_OK,
  })
  public readonly status: HealthStatus = HEALTH_STATUS_OK;
}
