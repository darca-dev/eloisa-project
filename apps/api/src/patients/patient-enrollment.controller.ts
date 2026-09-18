import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Logger,
  Post,
  Req,
  Res,
  ServiceUnavailableException,
  UnauthorizedException,
  UnprocessableEntityException,
  BadRequestException,
  ConflictException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { type Request, type Response } from 'express';

import { API_ENVIRONMENT, type ApiEnvironmentProvider } from '../config/api-environment.provider';
import { RuntimeContextUnavailableError } from '../database/runtime-context.error';
import { TenantContextService } from '../database/tenant-context.service';
import { readCookie } from '../enrollment-sessions/enrollment-session.cookie';
import { EnrollmentSessionService } from '../enrollment-sessions/enrollment-session.service';

import { ENROLLMENT_ERROR_CODES } from './enrollment.contract';
import { EnrollmentRateLimitGuard } from './enrollment-rate-limit.guard';
import {
  ApiErrorDto,
  PatientEnrollmentRequestDto,
  PatientSummaryDto,
} from './patient-enrollment.dto';
import { PatientEnrollmentService } from './patient-enrollment.service';

/**
 * API de inscripción y recuperación de paciente (TASK-MVP-CORE-01 §6).
 *
 * Superficie deliberadamente mínima:
 * - `POST /api/v1/patients/enrollments` crea la inscripción en una transacción;
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
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(EnrollmentRateLimitGuard)
  @ApiOperation({
    operationId: 'createPatientEnrollment',
    summary: 'Inscribe un paciente y abre su sesión de inscripción',
    description:
      'Crea persona, paciente, pertenencias poblacionales, dirección, consentimiento, sesión y evento mínimo de auditoría en una sola transacción. ' +
      'El servidor resuelve el tenant institucional activo, asigna el origen de autoinscripción pública y deriva la pertenencia de 60 años o más desde la fecha de nacimiento. ' +
      'No acepta tenant, edad, estado, origen, fecha de inscripción ni creador desde el cliente.',
  })
  // El tipo del cuerpo se declara de forma explícita y no por metadatos del
  // decorador: la validación real la hace `enrollment.validation.ts`, y esta
  // anotación solo documenta el contrato en OpenAPI.
  @ApiBody({ type: PatientEnrollmentRequestDto })
  @ApiCreatedResponse({
    description:
      'Inscripción creada. La respuesta incluye una cookie HttpOnly con la sesión de inscripción.',
    type: PatientSummaryDto,
  })
  @ApiBadRequestResponse({ description: 'Cuerpo mal formado.', type: ApiErrorDto })
  @ApiUnprocessableEntityResponse({
    description: 'Validación semántica fallida.',
    type: ApiErrorDto,
  })
  @ApiConflictResponse({
    description:
      'El documento ya está registrado en la institución. No se fusiona, no se sobrescribe y no se revela ningún dato del registro existente.',
    type: ApiErrorDto,
  })
  @ApiTooManyRequestsResponse({
    description: 'Demasiadas peticiones desde el mismo origen.',
    type: ApiErrorDto,
  })
  public async create(
    @Body() body: PatientEnrollmentRequestDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<PatientSummaryDto> {
    const result = await this.protegido(() =>
      this.enrollment.enroll(body as unknown, new Date()),
    );

    if (!result.ok) {
      throw toHttpException(result.failure);
    }

    response.setHeader('Set-Cookie', result.setCookieHeader);
    return result.patient as unknown as PatientSummaryDto;
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

function toHttpException(
  failure:
    | { readonly kind: 'INVALID_BODY'; readonly fields: readonly string[] }
    | { readonly kind: 'VALIDATION'; readonly fields: readonly string[] }
    | { readonly kind: 'DOCUMENT_CONFLICT' },
): BadRequestException | UnprocessableEntityException | ConflictException {
  if (failure.kind === 'INVALID_BODY') {
    return new BadRequestException({
      code: ENROLLMENT_ERROR_CODES.invalidRequestBody,
      message: 'El cuerpo de la petición no cumple el contrato de inscripción.',
      fields: [...failure.fields],
    });
  }

  if (failure.kind === 'VALIDATION') {
    return new UnprocessableEntityException({
      code: ENROLLMENT_ERROR_CODES.validationFailed,
      message: 'Revise los datos de la inscripción: algunos valores no son válidos.',
      fields: [...failure.fields],
    });
  }

  // No se revela ningún dato del registro existente ni se confirma a quién
  // pertenece: solo que ese documento ya está inscrito en la institución.
  return new ConflictException({
    code: ENROLLMENT_ERROR_CODES.documentConflict,
    message: 'Ese documento ya está inscrito en esta institución.',
  });
}
