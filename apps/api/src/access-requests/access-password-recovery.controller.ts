import { BadRequestException, Body, Controller, Get, HttpException, HttpCode, Inject, Param, ParseUUIDPipe, Post, Req, Res, ServiceUnavailableException, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { type Response } from 'express';
import { HumanSessionGuard, noStore, type RequestWithHumanSession } from '../human-auth/human-session.guard';
import { humanPrincipalOf, type HumanPrincipal } from '../identity-access/human-principal';
import { AccessRequestOriginGuard } from './access-request.origin.guard';
import { AccessRecoveryRateLimitGuard } from './access-recovery.rate-limit.guard';
import { RECOVERY_UUID } from './access-password-recovery.contract';
import { AccessPasswordRecoveryService } from './access-password-recovery.service';

@ApiTags('hospital-access-recovery')
@Controller('api/v1/hospital/access-requests/:requestId/password-recovery')
@UseGuards(HumanSessionGuard, AccessRecoveryRateLimitGuard)
export class AccessPasswordRecoveryController {
  constructor(@Inject(AccessPasswordRecoveryService) private readonly recovery: AccessPasswordRecoveryService) {}

  @Get()
  @ApiOperation({ operationId: 'getAccessPasswordRecovery', summary: 'Consulta recuperación y necesidad de reautenticación' })
  @ApiOkResponse({ description: 'Estado persistido, elegibilidad y reautenticación; sin credenciales.' })
  public async status(@Param('requestId', new ParseUUIDPipe()) requestId: string, @Req() request: RequestWithHumanSession, @Res({ passthrough: true }) response: Response) {
    noStore(response);
    return this.protected(() => this.recovery.status(this.principal(request), requestId, new Date()));
  }

  @Post()
  @HttpCode(200)
  @UseGuards(AccessRequestOriginGuard)
  @ApiOperation({ operationId: 'resetAccessPassword', summary: 'Restablece contraseña temporal con auditoría y revocación de sesiones' })
  @ApiBody({ schema: { type: 'object', additionalProperties: false,
    required: ['operationId', 'expectedVersion', 'identityVerified', 'supportReference', 'password', 'confirmPassword', 'predecessorId'],
    properties: { operationId: { type: 'string', format: 'uuid' }, expectedVersion: { type: 'integer', minimum: 1 },
      identityVerified: { type: 'boolean', enum: [true] }, supportReference: { type: 'string', pattern: '^[A-Za-z0-9][A-Za-z0-9_-]{5,63}$' },
      password: { type: 'string', writeOnly: true, minLength: 8, maxLength: 72 }, confirmPassword: { type: 'string', writeOnly: true, minLength: 8, maxLength: 72 },
      predecessorId: { type: 'string', format: 'uuid', nullable: true } } } })
  @ApiOkResponse({ description: 'Resultado real: PENDING, SUCCEEDED, UNCERTAIN o SUPERSEDED. Repetir operationId no repite el cambio remoto.' })
  public async reset(@Param('requestId', new ParseUUIDPipe()) requestId: string, @Body() body: unknown, @Req() request: RequestWithHumanSession, @Res({ passthrough: true }) response: Response) {
    noStore(response);
    return this.protected(() => this.recovery.reset(this.principal(request), requestId, body, new Date()));
  }

  @Post('reconcile')
  @HttpCode(200)
  @UseGuards(AccessRequestOriginGuard)
  @ApiOperation({ operationId: 'reconcileAbandonedPasswordRecovery', summary: 'Marca resultado incierto de una recuperación abandonada' })
  @ApiBody({ schema: { type: 'object', additionalProperties: false, required: ['operationId'], properties: { operationId: { type: 'string', format: 'uuid' } } } })
  @ApiOkResponse({ description: 'La cuenta sigue bloqueada. No escribe contraseña ni llama al proveedor.' })
  public async reconcile(@Param('requestId', new ParseUUIDPipe()) requestId: string, @Body() body: unknown, @Req() request: RequestWithHumanSession, @Res({ passthrough: true }) response: Response) {
    noStore(response);
    if (body === null || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length !== 1
      || !('operationId' in body) || typeof body.operationId !== 'string' || !RECOVERY_UUID.test(body.operationId)) throw new BadRequestException({ code: 'ACCESS_RECOVERY_INVALID', message: 'La operación no es válida.' });
    const operationId = body.operationId;
    return this.protected(() => this.recovery.reconcile(this.principal(request), requestId, operationId, new Date()));
  }
  private principal(request: RequestWithHumanSession): HumanPrincipal {
    const principal = humanPrincipalOf(request);
    if (principal === null) throw new UnauthorizedException();
    return principal;
  }
  private async protected<T>(work: () => Promise<T>): Promise<T> {
    try { return await work(); } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException({ code: 'ACCESS_RECOVERY_UNAVAILABLE', message: 'No fue posible confirmar la operación. Consulte su estado antes de volver a actuar.' });
    }
  }
}
