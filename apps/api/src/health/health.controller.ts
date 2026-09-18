import { Controller, Get, HttpCode, HttpStatus, Inject } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { type HealthResponse } from '@merdn/shared';

import { HealthResponseDto } from './health-response.dto';
import { HealthService } from './health.service';

/**
 * Único endpoint de aplicación autorizado por TASK-001 (AD-05).
 *
 * La dependencia se declara con `@Inject` explícito para no depender de
 * metadatos de decorador en tiempo de prueba.
 */
@ApiTags('health')
@Controller()
export class HealthController {
  constructor(
    @Inject(HealthService)
    private readonly healthService: HealthService,
  ) {}

  @Get('health')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    operationId: 'getHealth',
    summary: 'Estado técnico del proceso de la API',
    description:
      'Devuelve HTTP 200 y el cuerpo { "status": "ok" } cuando el proceso de la API ' +
      'responde. No verifica ni declara el estado de PostgreSQL, del almacenamiento ' +
      'documental ni de integraciones externas.',
  })
  @ApiOkResponse({
    description: 'El proceso de la API responde.',
    type: HealthResponseDto,
  })
  public check(): HealthResponse {
    return this.healthService.check();
  }
}
