import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Logger,
  Req,
  Res,
  ServiceUnavailableException,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { type Response } from 'express';

import { RuntimeContextUnavailableError } from '../database/runtime-context.error';
import { HumanContextsService } from '../identity-access/human-contexts.service';
import { humanPrincipalOf } from '../identity-access/human-principal';

import { HUMAN_AUTH_ERROR_CODES } from './human-auth.contract';
import { HumanAuthErrorDto, HumanContextsDto } from './human-auth.dto';
import {
  HumanSessionGuard,
  noStore,
  type RequestWithHumanSession,
} from './human-session.guard';

/**
 * Contextos de la persona autenticada (IDENTITY-RELATIONSHIPS-CORE-01 §8.1).
 *
 * Ruta única: `GET /api/v1/me/contexts`.
 *
 * Vive junto a la autenticación humana porque comparte su guard y su cookie, y
 * porque su respuesta describe a la persona de la sesión y a nadie más. La
 * derivación de los contextos la hace `identity-access`, que es donde viven los
 * resolutores de participación.
 *
 * QUÉ NO ES: no es un endpoint de permisos, no es un menú y no es una lista de
 * capacidades. Que un contexto figure aquí NO concede acceso a ningún recurso
 * concreto, y la interfaz no puede tratarlo como autorización: cada operación
 * vuelve a evaluar perfil, afiliación, asignación y relación en el servidor.
 */
@ApiTags('human-auth')
@Controller('api/v1/me')
export class MeContextsController {
  private readonly logger = new Logger(MeContextsController.name);

  constructor(
    @Inject(HumanContextsService) private readonly contexts: HumanContextsService,
  ) {}

  @Get('contexts')
  @HttpCode(HttpStatus.OK)
  @UseGuards(HumanSessionGuard)
  @ApiOperation({
    operationId: 'getMyContexts',
    summary: 'Contextos disponibles de la persona autenticada',
    description:
      'Devuelve los contextos que la persona tiene vivos dentro del tenant, derivados en el ' +
      'SERVIDOR. El cliente no los envía, no los elige y no puede ampliarlos. Un contexto ' +
      'disponible NO concede acceso a ningún recurso concreto y una persona con varios ' +
      'contextos NO acumula los permisos de todos sobre un mismo recurso: cada capacidad ' +
      'conserva su comprobación, su alcance y su vigencia.',
  })
  @ApiOkResponse({ description: 'Contextos disponibles.', type: HumanContextsDto })
  @ApiUnauthorizedResponse({
    description: 'No hay una sesión vigente.',
    type: HumanAuthErrorDto,
  })
  public async list(
    @Req() request: RequestWithHumanSession,
    @Res({ passthrough: true }) response: Response,
  ): Promise<HumanContextsDto> {
    noStore(response);

    const principal = humanPrincipalOf(request);

    if (principal === null) {
      // Inalcanzable con el guard activo; se conserva como defensa explícita.
      throw new UnauthorizedException({
        code: HUMAN_AUTH_ERROR_CODES.sessionRequired,
        message: 'No hay una sesión vigente.',
      });
    }

    try {
      return { contexts: await this.contexts.resolveNames(principal, new Date()) };
    } catch (error) {
      if (error instanceof RuntimeContextUnavailableError) {
        // FAIL-CLOSED: sin contexto de ejecución seguro no se responde nada.
        this.logger.error(error.message);

        throw new ServiceUnavailableException({
          code: HUMAN_AUTH_ERROR_CODES.unavailable,
          message: 'El servicio no está disponible en este momento.',
        });
      }

      throw error;
    }
  }
}
