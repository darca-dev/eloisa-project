import {
  Controller,
  Get,
  GoneException,
  HttpCode,
  HttpStatus,
  Inject,
  Logger,
  Post,
  Req,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiGoneResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { type Request } from 'express';

import { API_ENVIRONMENT, type ApiEnvironmentProvider } from '../config/api-environment.provider';
import { RuntimeContextUnavailableError } from '../database/runtime-context.error';
import { TenantContextService } from '../database/tenant-context.service';
import { readCookie } from '../enrollment-sessions/enrollment-session.cookie';
import { EnrollmentSessionService } from '../enrollment-sessions/enrollment-session.service';

import { ENROLLMENT_ERROR_CODES } from './enrollment.contract';
import { ApiErrorDto, PatientSummaryDto } from './patient-enrollment.dto';
import { PatientEnrollmentService } from './patient-enrollment.service';

/**
 * API de inscripción y recuperación de paciente (TASK-MVP-CORE-01 §6).
 *
 * Superficie deliberadamente mínima:
 * - `POST /api/v1/patients/enrollments` está retirado y nunca crea datos;
 * - `GET  /api/v1/patients/me` recupera SOLO el paciente de la sesión vigente.
 *
 * No existe `GET /patients/:id`, no existe búsqueda por documento, no existe
 * listado nominal y no existe superficie municipal. Un identificador en la URL
 * no concede acceso a ningún registro.
 */
@ApiTags('patients')
@Controller('api/v1/patients')
export class PatientEnrollmentController {
  private readonly logger = new Logger(PatientEnrollmentController.name);

  constructor(
    @Inject(PatientEnrollmentService)
    private readonly enrollment: PatientEnrollmentService,
    @Inject(EnrollmentSessionService)
    private readonly sessions: EnrollmentSessionService,
    @Inject(TenantContextService) private readonly tenants: TenantContextService,
    @Inject(API_ENVIRONMENT) private readonly environment: ApiEnvironmentProvider,
  ) {}

  @Post('enrollments')
  @HttpCode(HttpStatus.GONE)
  @ApiOperation({
    operationId: 'createPatientEnrollment',
    summary: 'Informa que la inscripción heredada fue retirada',
    description:
      'No procesa el cuerpo ni crea registros. El alta vigente se realiza mediante una solicitud en /acceso?accion=registro y requiere aprobación institucional.',
  })
  @ApiGoneResponse({
    description: 'La inscripción pública heredada fue retirada y no creó datos.',
    type: ApiErrorDto,
  })
  public create(): never {
    throw new GoneException({
      code: ENROLLMENT_ERROR_CODES.registrationRetired,
      message: 'La inscripción anterior fue retirada. Use el registro vigente de acceso.',
    });
  }

  /**
   * Ejecuta el trabajo y traduce un contexto de ejecución inseguro.
   *
   * FAIL-CLOSED (corrección final de CORE-01): si la API no puede confirmar que
   * opera bajo el rol de mínimo privilegio con el tenant activo, la petición
   * termina en error. NUNCA se reintenta con privilegios superiores.
   *
   * El detalle técnico queda en el registro del servidor; el cliente recibe un
   * mensaje estable que no describe la topología, el rol ni la base de datos.
   */
  private async protegido<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if (error instanceof RuntimeContextUnavailableError) {
        // El motivo se registra en el servidor, no se devuelve al cliente.
        this.logger.error(error.message);
        throw new ServiceUnavailableException({
          code: ENROLLMENT_ERROR_CODES.internal,
          message: 'El servicio no está disponible en este momento.',
        });
      }
      throw error;
    }
  }

  @Get('me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    operationId: 'getCurrentPatient',
    summary: 'Recupera el paciente de la sesión de inscripción vigente',
    description:
      'Requiere la cookie HttpOnly emitida al inscribirse. No acepta identificador de paciente ni documento. ' +
      'No devuelve documento completo, dirección exacta, teléfono, correo, token ni detalle interno del consentimiento.',
  })
  @ApiOkResponse({ description: 'Paciente de la sesión vigente.', type: PatientSummaryDto })
  @ApiUnauthorizedResponse({
    description:
      'Sesión ausente, inválida, expirada o revocada. La respuesta es idéntica en todos esos casos para no revelar la existencia de ningún registro.',
    type: ApiErrorDto,
  })
  public async me(@Req() request: Request): Promise<PatientSummaryDto> {
    const now = new Date();
    const token = readCookie(
      request.headers.cookie,
      this.environment.enrollmentSession.cookieName,
    );

    const { tenantId } = await this.tenants.resolveActiveTenant();
    const session = await this.protegido(() =>
      this.sessions.validate(token, tenantId, now),
    );

    if (session === null) {
      throw sessionRequiredException();
    }

    const patient = await this.protegido(() =>
      this.enrollment.findByPatientId(session.patientId, session.tenantId, now),
    );

    // Un paciente ausente en el tenant activo se comunica igual que una sesión
    // inválida: la respuesta no debe permitir deducir la existencia del registro.
    if (patient === null) {
      throw sessionRequiredException();
    }

    return patient as unknown as PatientSummaryDto;
  }
}

/**
 * Denegación uniforme de la recuperación por sesión: idéntica cuando la cookie
 * falta, el token es inválido, la sesión expiró o fue revocada, y cuando el
 * paciente no pertenece al tenant activo. No permite deducir qué ocurrió.
 */
function sessionRequiredException(): UnauthorizedException {
  return new UnauthorizedException({
    code: ENROLLMENT_ERROR_CODES.sessionRequired,
    message: 'No hay una sesión de inscripción vigente.',
  });
}
