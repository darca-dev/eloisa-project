import { randomUUID } from 'node:crypto';

import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Logger,
  Query,
  Req,
  Res,
  ServiceUnavailableException,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { type Response } from 'express';

import { RuntimeContextUnavailableError } from '../database/runtime-context.error';
import { HospitalSchedulerGuard } from '../institutional-auth/hospital-scheduler.guard';
import { INSTITUTIONAL_ERROR_CODES } from '../institutional-auth/institutional-auth.contract';
import {
  institutionalPrincipalOf,
  type RequestWithInstitutionalPrincipal,
} from '../institutional-auth/municipal-viewer.guard';

import {
  HOSPITAL_AGENDA_MAX_WINDOW_DAYS,
  HOSPITAL_OPERATIONS_ERROR_CODES,
} from './hospital.contract';
import { HospitalAgendaViewDto } from './hospital-agenda.dto';
import { parseAgendaQuery } from './hospital-agenda.query';
import { HospitalAgendaService } from './hospital-agenda.service';
import { noStore } from './hospital-professionals.controller';
import {
  HospitalOperationsQueryError,
  type RawOperationsQuery,
} from './hospital-professionals.query';
import { HospitalOperationsErrorDto } from './hospital-professionals.dto';
import { type HospitalOperationsContext } from './hospital-professionals.service';

/**
 * Agenda hospitalaria (TASK-HOSPITAL-CORE-02 §6.2).
 *
 * Una sola lectura, de SOLO LECTURA:
 * `GET /api/v1/hospital/agenda?from=AAAA-MM-DD&to=AAAA-MM-DD`.
 *
 * La ventana es OBLIGATORIA: la agenda nunca elige por su cuenta qué periodo
 * mostrar, de modo que la interfaz siempre declara qué está enseñando. No existe
 * reprogramación, rechazo, cancelación ni creación de citas en esta superficie.
 */
@ApiTags('hospital')
@Controller('api/v1/hospital/agenda')
@UseGuards(HospitalSchedulerGuard)
export class HospitalAgendaController {
  private readonly logger = new Logger(HospitalAgendaController.name);

  constructor(@Inject(HospitalAgendaService) private readonly agenda: HospitalAgendaService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    operationId: 'getHospitalAgenda',
    summary: 'Agenda del tenant institucional activo dentro de una ventana declarada',
    description:
      'Devuelve las solicitudes pendientes, los profesionales asignables, las citas asignadas ' +
      'de la ventana y los conteos diarios y por modalidad DERIVADOS de esas mismas citas. Un ' +
      'día sin filas cuenta cero, y ese cero significa exactamente «ninguna cita registrada»: ' +
      'nunca se sustituye por un calendario de demostración. NO devuelve disponibilidad, hueco ' +
      'libre, solapamiento, duración, motivo, dirección, pago, alerta ni cuidador.',
  })
  @ApiQuery({
    name: 'from',
    required: true,
    schema: { type: 'string', format: 'date' },
    description: 'Primer día UTC de la ventana.',
  })
  @ApiQuery({
    name: 'to',
    required: true,
    schema: { type: 'string', format: 'date' },
    description: `Último día UTC inclusive. La ventana no puede superar ${HOSPITAL_AGENDA_MAX_WINDOW_DAYS} días.`,
  })
  @ApiOkResponse({ description: 'Agenda de la ventana solicitada.', type: HospitalAgendaViewDto })
  @ApiBadRequestResponse({
    description:
      'Ventana ausente, mal formada, invertida o de más de 31 días; o parámetro no admitido.',
    type: HospitalOperationsErrorDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Sin sesión institucional vigente.',
    type: HospitalOperationsErrorDto,
  })
  @ApiForbiddenResponse({
    description: 'Sin el rol de agenda hospitalaria.',
    type: HospitalOperationsErrorDto,
  })
  public async view(
    @Req() request: RequestWithInstitutionalPrincipal,
    @Res({ passthrough: true }) response: Response,
    @Query() query: RawOperationsQuery,
  ): Promise<HospitalAgendaViewDto> {
    const context = this.contextoDe(request, 'GET /api/v1/hospital/agenda');

    let window;

    try {
      window = parseAgendaQuery(query, context.now);
    } catch (error) {
      if (error instanceof HospitalOperationsQueryError) {
        throw new BadRequestException({
          code: HOSPITAL_OPERATIONS_ERROR_CODES.invalidQuery,
          message: error.message,
        });
      }

      throw error;
    }

    noStore(response);

    const vista = await this.protegido(() => this.agenda.view(context, window));

    return vista as unknown as HospitalAgendaViewDto;
  }

  private contextoDe(
    request: RequestWithInstitutionalPrincipal,
    endpoint: string,
  ): HospitalOperationsContext {
    const principal = institutionalPrincipalOf(request);

    if (principal === null || principal.role !== 'HOSPITAL_SCHEDULER') {
      // Inalcanzable con el guard activo; defensa explícita.
      throw new UnauthorizedException({
        code: INSTITUTIONAL_ERROR_CODES.sessionRequired,
        message: 'No hay una sesión institucional vigente.',
      });
    }

    return { principal, correlationId: randomUUID(), endpoint, now: new Date() };
  }

  private async protegido<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if (error instanceof RuntimeContextUnavailableError) {
        this.logger.error(error.message);

        throw new ServiceUnavailableException({
          code: HOSPITAL_OPERATIONS_ERROR_CODES.internal,
          message: 'El servicio no está disponible en este momento.',
        });
      }

      throw error;
    }
  }
}
