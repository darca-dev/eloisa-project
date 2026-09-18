import { randomUUID } from 'node:crypto';

import {
  Body,
  Controller,
  Delete,
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
  UseGuards,
} from '@nestjs/common';
import {
  ApiBody,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { type Response } from 'express';

import { RuntimeContextUnavailableError } from '../database/runtime-context.error';
import { readCookie } from '../enrollment-sessions/enrollment-session.cookie';

import {
  INSTITUTIONAL_ACTOR_DISPLAY,
  INSTITUTIONAL_ERROR_CODES,
  INSTITUTIONAL_SESSION_COOKIE_NAME,
} from './institutional-auth.contract';
import {
  InstitutionalErrorDto,
  InstitutionalSessionContextDto,
  InstitutionalSessionDto,
  InstitutionalSignInRequestDto,
} from './institutional-auth.dto';
import { InstitutionalAuthService } from './institutional-auth.service';
import { InstitutionalSameOriginGuard } from './institutional-same-origin.guard';
import { InstitutionalSessionGuard } from './institutional-session.guard';
import { InstitutionalSignInRateLimitGuard } from './institutional-signin-rate-limit.guard';
import {
  institutionalPrincipalOf,
  type RequestWithInstitutionalPrincipal,
} from './municipal-viewer.guard';

/**
 * Sesión institucional mínima (TASK-MUNICIPALITY-CORE-01, FR-13 y OD-01;
 * ampliada por TASK-HOSPITAL-CORE-01 §8.0).
 *
 * Superficie deliberadamente mínima y separada de la de paciente:
 * - `POST   /api/v1/institutional/sessions`         abre la sesión;
 * - `GET    /api/v1/institutional/sessions/current` describe la sesión vigente;
 * - `DELETE /api/v1/institutional/sessions/current` la revoca.
 *
 * NO existe registro público, NO existe recuperación de credencial, NO existe
 * administración de usuarios y NO existe selección de institución: el tenant lo
 * resuelve el servidor y el navegador nunca lo envía ni lo elige. El
 * `identityCode` opcional del cuerpo solo elige qué credencial se verifica: no
 * transporta rol, institución ni permiso.
 *
 * La respuesta no devuelve token, hash, credencial, tenant ni identificador de
 * identidad. El token viaja exclusivamente en la cookie `HttpOnly`.
 */
@ApiTags('institutional')
@Controller('api/v1/institutional/sessions')
export class InstitutionalAuthController {
  private readonly logger = new Logger(InstitutionalAuthController.name);

  constructor(
    @Inject(InstitutionalAuthService) private readonly auth: InstitutionalAuthService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(InstitutionalSignInRateLimitGuard, InstitutionalSameOriginGuard)
  @ApiOperation({
    operationId: 'createInstitutionalSession',
    summary: 'Abre una sesión institucional',
    description:
      'Comprueba la credencial institucional aprovisionada por configuración del servidor y ' +
      'emite una cookie HttpOnly con un token opaco nuevo. El token en claro nunca se persiste ' +
      'ni se registra. Esta sesión no da acceso a ningún paciente por sí misma: cada superficie ' +
      'exige además su propio rol.',
  })
  @ApiBody({ type: InstitutionalSignInRequestDto })
  @ApiCreatedResponse({
    description: 'Sesión institucional abierta. El token viaja en una cookie HttpOnly.',
    type: InstitutionalSessionDto,
  })
  @ApiUnauthorizedResponse({
    description:
      'Credencial no válida. La respuesta es idéntica cuando el código de identidad no existe, ' +
      'la identidad no está aprovisionada, está deshabilitada o la credencial no coincide.',
    type: InstitutionalErrorDto,
  })
  @ApiTooManyRequestsResponse({
    description: 'Demasiados intentos desde el mismo origen.',
    type: InstitutionalErrorDto,
  })
  @ApiForbiddenResponse({
    description: 'La petición declara un origen que no está autorizado.',
    type: InstitutionalErrorDto,
  })
  public async open(
    @Body() body: InstitutionalSignInRequestDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<InstitutionalSessionDto> {
    const correlationId = randomUUID();
    const recibido = body as
      | { readonly accessSecret?: unknown; readonly identityCode?: unknown }
      | undefined;

    const established = await this.protegido(() =>
      this.auth.establishSession(
        recibido?.accessSecret,
        recibido?.identityCode,
        new Date(),
        correlationId,
        'POST /api/v1/institutional/sessions',
      ),
    );

    if (established === null) {
      throw new UnauthorizedException({
        code: INSTITUTIONAL_ERROR_CODES.invalidCredentials,
        message: 'No fue posible abrir la sesión institucional.',
      });
    }

    response.setHeader('Set-Cookie', established.setCookieHeader);
    // Una credencial nunca debe quedar en una caché intermedia.
    noStore(response);

    return {
      role: established.principal.role,
      expiresAt: established.expiresAt.toISOString(),
    };
  }

  @Get('current')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    operationId: 'getCurrentInstitutionalSession',
    summary: 'Describe la sesión institucional vigente',
    description:
      'Devuelve el rol efectivo, la caducidad, el nombre real del tenant y un texto de actor ' +
      'impersonal. NO devuelve tenantId, identificador de identidad, código interno, secreto, ' +
      'persona, tipo o municipio de la institución, logo ni permisos derivados. Este endpoint ' +
      'NO concede por sí mismo acceso a Hospital ni a Municipality: cada dominio conserva su ' +
      'guard y su rol exacto.',
  })
  @ApiOkResponse({
    description: 'Contexto mínimo de la sesión vigente.',
    type: InstitutionalSessionContextDto,
  })
  @ApiUnauthorizedResponse({
    description:
      'No hay una sesión institucional vigente. La respuesta es idéntica ante ausencia, ' +
      'malformación, expiración, revocación o manipulación.',
    type: InstitutionalErrorDto,
  })
  public async current(
    @Req() request: RequestWithInstitutionalPrincipal,
    @Res({ passthrough: true }) response: Response,
  ): Promise<InstitutionalSessionContextDto> {
    noStore(response);

    /*
     * Este endpoint admite CUALQUIER rol institucional implementado, de modo que
     * no puede usar el guard municipal —que exige `MUNICIPAL_VIEWER`— ni el
     * hospitalario. La comprobación se hace aquí, con el mismo servicio de
     * validación y el mismo desenlace uniforme: sin sesión válida, `401`.
     */
    const token = readCookie(request.headers.cookie, INSTITUTIONAL_SESSION_COOKIE_NAME);

    const contexto = await this.protegido(async () => {
      const principal = await this.auth.validate(token, new Date());

      if (principal === null) {
        return null;
      }

      const expiresAt = await this.auth.sessionExpiry(principal);

      return expiresAt === null
        ? null
        : this.auth.sessionContext(principal, expiresAt);
    });

    if (contexto === null) {
      throw new UnauthorizedException({
        code: INSTITUTIONAL_ERROR_CODES.sessionRequired,
        message: 'No hay una sesión institucional vigente.',
      });
    }

    return {
      role: contexto.role,
      expiresAt: contexto.expiresAt.toISOString(),
      institution: { name: contexto.institutionName },
      actorDisplay: INSTITUTIONAL_ACTOR_DISPLAY,
    };
  }

  @Delete('current')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(InstitutionalSameOriginGuard, InstitutionalSessionGuard)
  @ApiOperation({
    operationId: 'revokeCurrentInstitutionalSession',
    summary: 'Revoca la sesión institucional vigente',
    description:
      'Cierra la sesión institucional de CUALQUIER rol implementado: cerrar la propia sesión ' +
      'pertenece a la sesión misma y no a ninguna superficie de datos, igual que describirla. ' +
      'Marca la sesión como revocada y borra la cookie. La fila de la sesión se conserva ' +
      'para trazabilidad histórica: no se elimina ningún registro.',
  })
  @ApiNoContentResponse({ description: 'Sesión revocada.' })
  @ApiUnauthorizedResponse({
    description: 'No hay una sesión institucional vigente.',
    type: InstitutionalErrorDto,
  })
  @ApiForbiddenResponse({
    description: 'La petición declara un origen que no está autorizado.',
    type: InstitutionalErrorDto,
  })
  public async close(
    @Req() request: RequestWithInstitutionalPrincipal,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    /*
     * El principal lo resuelve `InstitutionalSessionGuard`, que autentica la
     * sesión SIN exigir rol: cualquier identidad institucional autenticada
     * cierra la suya. La autorización de las superficies de datos no cambia y
     * sigue viviendo en sus guards de rol, que son disjuntos entre sí.
     */
    const principal = institutionalPrincipalOf(request);

    if (principal === null) {
      // Inalcanzable con el guard activo; se conserva como defensa explícita.
      throw new UnauthorizedException({
        code: INSTITUTIONAL_ERROR_CODES.sessionRequired,
        message: 'No hay una sesión institucional vigente.',
      });
    }

    await this.protegido(() =>
      this.auth.revoke(
        principal,
        new Date(),
        randomUUID(),
        'DELETE /api/v1/institutional/sessions/current',
      ),
    );

    response.setHeader('Set-Cookie', this.auth.clearCookieHeader());
    noStore(response);
  }

  /**
   * Traduce un contexto de ejecución inseguro a un error controlado.
   *
   * FAIL-CLOSED: si la API no puede confirmar que opera bajo el rol de mínimo
   * privilegio con el tenant activo, la petición termina en error. El detalle
   * queda en el registro del servidor y no describe la topología al cliente.
   */
  private async protegido<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if (error instanceof RuntimeContextUnavailableError) {
        this.logger.error(error.message);

        throw new ServiceUnavailableException({
          code: INSTITUTIONAL_ERROR_CODES.internal,
          message: 'El servicio no está disponible en este momento.',
        });
      }

      throw error;
    }
  }
}

/** Ninguna respuesta institucional puede quedar en una caché compartida. */
function noStore(response: Response): void {
  response.setHeader('Cache-Control', 'private, no-store');
  response.setHeader('Pragma', 'no-cache');
  response.setHeader('Vary', 'Cookie');
}
