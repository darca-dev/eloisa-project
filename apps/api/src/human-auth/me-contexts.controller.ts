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
import { randomUUID } from 'node:crypto';

import { RuntimeContextUnavailableError } from '../database/runtime-context.error';
import {
  ApprovedExperiencesService,
} from '../identity-access/approved-experiences.service';
import { HumanContextsService } from '../identity-access/human-contexts.service';
import { humanPrincipalOf } from '../identity-access/human-principal';

import { HUMAN_AUTH_ERROR_CODES } from './human-auth.contract';
import { HumanAuthErrorDto, HumanContextsDto, HumanExperiencesDto } from './human-auth.dto';
import {
  HumanSessionGuard,
  noStore,
  type RequestWithHumanSession,
} from './human-session.guard';

/**
 * Superficie de la persona autenticada (IDENTITY-RELATIONSHIPS-CORE-01 §8.1;
 * MP04 añade experiencias).
 *
 * Dos rutas, dos preguntas:
 *
 * `GET /api/v1/me/contexts`     → qué PARTICIPACIONES tiene vivas la persona.
 * `GET /api/v1/me/experiences`  → qué EXPERIENCIAS aprobó la institución para
 *                                 esta cuenta.
 *
 * Vive junto a la autenticación humana porque comparte su guard y su cookie, y
 * porque ambas respuestas describen a la persona de la sesión y a nadie más. La
 * derivación la hace `identity-access`, que es donde viven los resolutores de
 * participación y de experiencia.
 *
 * QUÉ NO SON: no son un endpoint de permisos, no son un menú y no son una lista
 * de capacidades. Que un contexto o una experiencia figuren aquí NO concede
 * acceso a ningún recurso concreto, y la interfaz no puede tratarlo como
 * autorización: cada operación vuelve a evaluar perfil, afiliación, asignación y
 * relación en el servidor.
 *
 * AMBAS AUDITORÍAN. La consulta de experiencias escribe
 * `EXPERIENCE_ACCESS_GRANTED` o `EXPERIENCE_ACCESS_DENIED` en la misma
 * transacción que la lee, porque saber quién preguntó —y si algo le fue a
 * conceder— es material aunque la respuesta sea una lista vacía.
 */
@ApiTags('human-auth')
@Controller('api/v1/me')
export class MeContextsController {
  private readonly logger = new Logger(MeContextsController.name);

  constructor(
    @Inject(HumanContextsService) private readonly contexts: HumanContextsService,
    @Inject(ApprovedExperiencesService)
    private readonly experiences: ApprovedExperiencesService,
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

  @Get('experiences')
  @HttpCode(HttpStatus.OK)
  @UseGuards(HumanSessionGuard)
  @ApiOperation({
    operationId: 'getMyExperiences',
    summary: 'Experiencias aprobadas de la cuenta autenticada',
    description:
      'Devuelve exactamente las experiencias que la institución aprobó para ESTA cuenta: ' +
      'PATIENT, CAREGIVER o FIELD_PROFESSIONAL, derivadas server-side a partir de la cuenta ' +
      'activa, sus solicitudes en estado APPROVED y la participación que cada aprobación ' +
      'creó. Una lista vacía significa que ninguna experiencia está aprobada; no dice por qué. ' +
      'Una experiencia decide únicamente a QUÉ portada se puede entrar y NO concede acceso ' +
      'a ningún paciente, visita ni liquidación concretos.',
  })
  @ApiOkResponse({ description: 'Experiencias aprobadas.', type: HumanExperiencesDto })
  @ApiUnauthorizedResponse({
    description: 'No hay una sesión vigente.',
    type: HumanAuthErrorDto,
  })
  public async listExperiences(
    @Req() request: RequestWithHumanSession,
    @Res({ passthrough: true }) response: Response,
  ): Promise<HumanExperiencesDto> {
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
      return {
        experiences: [
          ...(await this.experiences.resolve(principal, new Date(), randomUUID())),
        ],
      };
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
