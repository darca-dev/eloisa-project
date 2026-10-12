import { BadRequestException, Body, Controller, Get, HttpCode, Inject, Param, Post, Req, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
import { type Request, type Response } from 'express';
import { ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { readCookie } from '../enrollment-sessions/enrollment-session.cookie';
import { HumanSessionGuard } from '../human-auth/human-session.guard';
import { humanPrincipalOf, type RequestWithHumanPrincipal } from '../identity-access/human-principal';
import { administratorAttemptCookieName, institutionalExperience, validateAdministratorBody } from './institutional-administrator.contract';
import { InstitutionalAdministratorService } from './institutional-administrator.service';
import { InstitutionalSameOriginGuard } from './institutional-same-origin.guard';
import { InstitutionalSignInRateLimitGuard } from './institutional-signin-rate-limit.guard';

@ApiTags('institutional-administrator')
@ApiParam({ name: 'experience', enum: ['hospital', 'municipality'], required: true })
@Controller('api/v1/institutional/:experience')
export class InstitutionalAdministratorController {
  constructor(@Inject(InstitutionalAdministratorService) private readonly administrators: InstitutionalAdministratorService) {}
  @Get('registration')
  @ApiOperation({ operationId: 'getInstitutionalRegistrationAvailability', summary: 'Consulta el cupo del primer administrador', description: 'No revela datos personales. Solo el navegador propietario del intento puede recuperar el username opaco confirmado.' })
  @ApiResponse({ status: 200, description: 'Disponibilidad del registro; respuesta no-store.' })
  public availability(@Param('experience') value: string, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    response.setHeader('Cache-Control', 'no-store');
    const experience = institutionalExperience(value);
    return this.administrators.availability(experience, readCookie(request.headers.cookie, administratorAttemptCookieName(experience)));
  }
  @Post('registration-attempt')
  @ApiOperation({ operationId: 'beginInstitutionalRegistrationAttempt', summary: 'Prepara el intento mediante cookie HttpOnly' })
  @ApiResponse({ status: 204, description: 'Intento preparado. No crea una cuenta ni reserva el cupo.' })
  @HttpCode(204)
  @UseGuards(InstitutionalSignInRateLimitGuard, InstitutionalSameOriginGuard)
  public attempt(@Param('experience') value: string, @Req() request: Request, @Res({ passthrough: true }) response: Response): void {
    const experience = institutionalExperience(value);
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Set-Cookie', this.administrators.attemptCookie(experience, readCookie(request.headers.cookie, administratorAttemptCookieName(experience))));
  }
  @Post('registration')
  @ApiOperation({ operationId: 'registerFirstInstitutionalAdministrator', summary: 'Registra el único administrador inicial', description: 'Reserva permanente por institución y experiencia. Provisión OIDC idempotente; no crea sesión automáticamente. Reintentos requieren la cookie original y los mismos datos declarados.' })
  @ApiBody({ required: true, schema: {
    type: 'object', additionalProperties: false,
    required: ['documentType', 'documentNumber', 'givenNames', 'familyNames', 'birthDate', 'sexGenderCode', 'email', 'password', 'confirmPassword'],
    properties: {
      documentType: { type: 'string', enum: ['CEDULA_CIUDADANIA', 'CEDULA_EXTRANJERIA', 'PASAPORTE', 'PERMISO_PROTECCION_TEMPORAL', 'OTRO'] },
      documentNumber: { type: 'string', maxLength: 32 }, givenNames: { type: 'string', maxLength: 120 }, familyNames: { type: 'string', maxLength: 120 },
      birthDate: { type: 'string', format: 'date' }, sexGenderCode: { type: 'string', enum: ['FEMENINO', 'MASCULINO', 'OTRO', 'PREFIERE_NO_DECIRLO'] },
      email: { type: 'string', format: 'email', maxLength: 254 },
      password: { type: 'string', format: 'password', writeOnly: true, minLength: 8, maxLength: 72 },
      confirmPassword: { type: 'string', format: 'password', writeOnly: true, minLength: 8, maxLength: 72 },
    },
  } })
  @ApiResponse({ status: 201, description: 'Administrador confirmado; devuelve completed y username opaco, sin contraseña.' })
  @ApiResponse({ status: 409, description: 'Cupo cerrado, intento ajeno, datos distintos o persona ya existente.' })
  @ApiResponse({ status: 503, description: 'No se confirmó la provisión. Se conserva la reserva para conciliación segura.' })
  @UseGuards(InstitutionalSignInRateLimitGuard, InstitutionalSameOriginGuard)
  public register(@Param('experience') value: string, @Body() body: unknown, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    response.setHeader('Cache-Control', 'no-store');
    const experience = institutionalExperience(value);
    const now = new Date();
    return this.administrators.register(experience, readCookie(request.headers.cookie, administratorAttemptCookieName(experience)), validateAdministratorBody(body, now), now);
  }
  @Get('administrator/current')
  @ApiOperation({ operationId: 'getCurrentInstitutionalAdministrator', summary: 'Verifica la sesión del administrador de esta experiencia' })
  @ApiResponse({ status: 200, description: 'Sesión humana vigente vinculada a la reserva confirmada exacta.' })
  @ApiResponse({ status: 401, description: 'No existe una sesión administradora válida para esta experiencia.' })
  public async current(@Param('experience') value: string, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    response.setHeader('Cache-Control', 'no-store');
    const current = await this.administrators.current(institutionalExperience(value), request.headers.cookie, new Date());
    if (current === null) throw new UnauthorizedException({ code: 'INSTITUTIONAL_ADMINISTRATOR_SESSION_REQUIRED', message: 'Inicie sesión con la cuenta administradora de esta institución.' });
    return current;
  }
  @Post('claim')
  @ApiOperation({ operationId: 'claimFirstInstitutionalAdministrator', summary: 'Vincula la cuenta autenticada al cupo inicial disponible' })
  @ApiBody({ schema: { type: 'object', additionalProperties: false, properties: {} } })
  @ApiResponse({ status: 201, description: 'Cuenta autenticada confirmada como administradora.' })
  @ApiResponse({ status: 401, description: 'Se requiere una sesión humana vigente.' })
  @ApiResponse({ status: 409, description: 'Cupo ocupado o cuenta incompatible con solicitudes personales previas.' })
  @UseGuards(InstitutionalSignInRateLimitGuard, InstitutionalSameOriginGuard, HumanSessionGuard)
  public claim(@Param('experience') value: string, @Body() body: unknown, @Req() request: RequestWithHumanPrincipal, @Res({ passthrough: true }) response: Response) {
    response.setHeader('Cache-Control', 'no-store');
    if (body !== undefined && (body === null || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length !== 0)) throw new BadRequestException({ code: 'INSTITUTIONAL_REGISTRATION_INVALID', message: 'La solicitud no admite datos de cuenta, institución o permisos.' });
    const principal = humanPrincipalOf(request);
    if (principal === null) throw new UnauthorizedException();
    return this.administrators.claim(institutionalExperience(value), principal, new Date());
  }
}
