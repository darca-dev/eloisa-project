import { randomUUID } from 'node:crypto';

import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  Inject,
  Logger,
  NotFoundException,
  Param,
  Patch,
  Req,
  Res,
  ServiceUnavailableException,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { type Response } from 'express';

import { API_ENVIRONMENT, type ApiEnvironmentProvider } from '../config/api-environment.provider';
import { RuntimeContextUnavailableError } from '../database/runtime-context.error';
import { HospitalSchedulerGuard } from '../institutional-auth/hospital-scheduler.guard';
import { INSTITUTIONAL_ERROR_CODES } from '../institutional-auth/institutional-auth.contract';
import {
  institutionalPrincipalOf,
  type RequestWithInstitutionalPrincipal,
} from '../institutional-auth/municipal-viewer.guard';

import { HOSPITAL_OPERATIONS_ERROR_CODES } from './hospital.contract';
import {
  HospitalAssignedAppointmentDto,
  HospitalAssignmentRequestDto,
} from './hospital-appointment-assignment.dto';
import { isAllowedWebOrigin } from './hospital-appointment-assignment.origin';
import {
  HOSPITAL_UUID_PATTERN,
  HospitalAssignmentBodyError,
  parseAssignmentBody,
} from './hospital-appointment-assignment.request';
import {
  HospitalAppointmentAssignmentService,
  HospitalAssignmentError,
} from './hospital-appointment-assignment.service';
import { noStore } from './hospital-professionals.controller';
import { HospitalOperationsErrorDto } from './hospital-professionals.dto';
import { type HospitalOperationsContext } from './hospital-professionals.service';

/**
 * ÚNICA mutación autorizada por TASK-HOSPITAL-CORE-02 (§4.2 y §6.3).
 *
 * `PATCH /api/v1/hospital/appointments/:appointmentId/assignment`
 *
 * Asigna una solicitud existente a un profesional existente. NO reprograma, NO
 * rechaza, NO cancela, NO finaliza, NO desasigna, NO crea citas y NO abre
 * Visitas, Consultas virtuales, Finanzas ni ningún otro módulo.
 *
 * DEFENSA EN PROFUNDIDAD sobre una mutación con cookie:
 *   1. `HospitalSchedulerGuard` exige sesión institucional vigente con el rol
 *      exacto —denegación por defecto—;
 *   2. la comprobación de origen exige que la petición proceda de un origen web
 *      configurado, para que una página ajena no pueda provocar la escritura;
 *   3. la allowlist del cuerpo rechaza cualquier campo no previsto, incluidos
 *      `tenantId`, `identityId` y `role`;
 *   4. el servicio ejecuta todo dentro de `withTenant()`, con filtro explícito
 *      por tenant, Row Level Security, control optimista y auditoría atómica.
 */
@ApiTags('hospital')
@Controller('api/v1/hospital/appointments')
@UseGuards(HospitalSchedulerGuard)
export class HospitalAppointmentAssignmentController {
  private readonly logger = new Logger(HospitalAppointmentAssignmentController.name);

  constructor(
    @Inject(HospitalAppointmentAssignmentService)
    private readonly assignments: HospitalAppointmentAssignmentService,
    @Inject(API_ENVIRONMENT) private readonly environment: ApiEnvironmentProvider,
  ) {}

  @Patch(':appointmentId/assignment')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    operationId: 'assignHospitalAppointment',
    summary: 'Asigna una solicitud existente a un profesional existente',
    description:
      'Crea o reutiliza la asignación primaria activa del par paciente-profesional, enlaza la ' +
      'cita, la pasa a ASSIGNED, fija su inicio e incrementa su versión, todo en UNA ' +
      'transacción con sus eventos de auditoría. NO comprueba disponibilidad humana y NO ' +
      'aplica ninguna regla clínica: la plataforma no modela turnos, jornada, ausencias, ' +
      'duración, solapamiento, pertinencia ni urgencia. La única colisión mecánica bloqueada ' +
      'es que el mismo profesional tenga otra cita no cancelada con el MISMO instante de ' +
      'inicio. El acto se atribuye a la identidad institucional OPACA que operó, NUNCA a la ' +
      'profesional seleccionada.',
  })
  @ApiParam({
    name: 'appointmentId',
    description: 'Identificador OPACO de la solicitud. Un identificador mal formado produce 400.',
    schema: { type: 'string', format: 'uuid' },
  })
  @ApiBody({ type: HospitalAssignmentRequestDto })
  @ApiOkResponse({
    description: 'Cita asignada, con su versión ya incrementada.',
    type: HospitalAssignedAppointmentDto,
  })
  @ApiBadRequestResponse({
    description:
      'Cuerpo ausente, con campos desconocidos o mal formados, o identificador inválido.',
    type: HospitalOperationsErrorDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Sin sesión institucional vigente.',
    type: HospitalOperationsErrorDto,
  })
  @ApiForbiddenResponse({
    description:
      'Sin el rol de agenda hospitalaria, o petición procedente de un origen web no ' +
      'configurado. La respuesta es la misma en ambos casos y no describe la causa.',
    type: HospitalOperationsErrorDto,
  })
  @ApiNotFoundResponse({
    description:
      'La cita o el profesional no existen, no pertenecen a la institución de la sesión, o el ' +
      'profesional no tiene perfil y vínculo vigentes. La respuesta es IDÉNTICA en todos esos ' +
      'casos: nunca confirma la existencia de un registro ajeno.',
    type: HospitalOperationsErrorDto,
  })
  @ApiConflictResponse({
    description:
      'APPOINTMENT_VERSION_CONFLICT cuando la versión enviada ya no es la vigente; ' +
      'APPOINTMENT_NOT_ASSIGNABLE cuando el estado, el vínculo del paciente o el instante no ' +
      'permiten esta transición. Ninguno revela la cita en conflicto.',
    type: HospitalOperationsErrorDto,
  })
  public async assign(
    @Req() request: RequestWithInstitutionalPrincipal,
    @Res({ passthrough: true }) response: Response,
    @Param('appointmentId') appointmentId: string,
    @Body() body: unknown,
  ): Promise<HospitalAssignedAppointmentDto> {
    const context = this.contextoDe(
      request,
      'PATCH /api/v1/hospital/appointments/:appointmentId/assignment',
    );

    if (!isAllowedWebOrigin(request.headers, this.environment.webOrigins)) {
      /*
       * La sesión viaja en una cookie que el navegador adjunta sola: sin esta
       * comprobación, una página ajena podría provocar la asignación en nombre
       * de quien solo tenía la sesión abierta. El código es deliberadamente el
       * mismo que el de una denegación por rol: la respuesta no describe la
       * causa y no ayuda a sondear la configuración del despliegue.
       */
      throw new ForbiddenException({
        code: INSTITUTIONAL_ERROR_CODES.forbidden,
        message: 'La identidad institucional no tiene acceso a esta operación.',
      });
    }

    if (!HOSPITAL_UUID_PATTERN.test(appointmentId)) {
      throw new BadRequestException({
        code: HOSPITAL_OPERATIONS_ERROR_CODES.invalidQuery,
        message: 'El identificador solicitado no tiene una forma válida.',
      });
    }

    let parsed;

    try {
      parsed = parseAssignmentBody(body);
    } catch (error) {
      if (error instanceof HospitalAssignmentBodyError) {
        throw new BadRequestException({
          code: HOSPITAL_OPERATIONS_ERROR_CODES.invalidBody,
          // Nombra el campo y la regla; nunca devuelve el valor recibido.
          message: error.message,
        });
      }

      throw error;
    }

    noStore(response);

    const asignada = await this.protegido(() =>
      this.assignments.assign(context, appointmentId, parsed),
    );

    return asignada as unknown as HospitalAssignedAppointmentDto;
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

  /**
   * Traduce los desenlaces de dominio y el contexto inseguro a la respuesta
   * estable del contrato. FAIL-CLOSED ante contexto de ejecución no confirmado.
   */
  private async protegido<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if (error instanceof HospitalAssignmentError) {
        const cuerpo = { code: error.code, message: error.message };

        throw error.status === 404
          ? new NotFoundException(cuerpo)
          : new ConflictException(cuerpo);
      }

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
