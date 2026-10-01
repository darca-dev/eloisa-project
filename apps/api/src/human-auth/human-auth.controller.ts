import { randomUUID } from 'node:crypto';

import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Logger,
  Post,
  Query,
  Req,
  Res,
  ServiceUnavailableException,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiExcludeEndpoint,
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
import { HumanContextsService } from '../identity-access/human-contexts.service';
import { humanPrincipalOf } from '../identity-access/human-principal';

import { HumanAuthRateLimitGuard } from './human-auth-rate-limit.guard';
import {
  HUMAN_AUTH_ATTEMPT_COOKIE_NAME,
  HUMAN_AUTH_ERROR_CODES,
  type HumanAuthReturnTarget,
} from './human-auth.contract';
import { HumanAuthErrorDto, HumanSessionDto } from './human-auth.dto';
import { HumanAuthService, HumanAuthUnavailableError } from './human-auth.service';
import {
  HumanSessionGuard,
  humanSessionValidityOf,
  noStore,
  type RequestWithHumanSession,
} from './human-session.guard';
import { SameOriginGuard } from './same-origin.guard';

/**
 * Superficie de autenticación HUMANA (IDENTITY-RELATIONSHIPS-CORE-01 §8.1).
 *
 * Cuatro rutas y ninguna más:
 * - `GET  /api/v1/human-auth/login`    inicia el flujo OIDC;
 * - `GET  /api/v1/human-auth/callback` lo completa y abre la sesión;
 * - `GET  /api/v1/human-auth/session`  describe la sesión vigente;
 * - `POST /api/v1/human-auth/logout`   la revoca.
 *
 * NO existe registro público, NO existe recuperación de cuenta, NO existe
 * administración de personas usuarias y NO existe selección de institución: el
 * tenant lo resuelve el servidor y el navegador nunca lo envía ni lo elige.
 *
 * NO existe ninguna vía alternativa de autenticación. No hay `dev-login`, no hay
 * cabecera de identidad, no hay contraseña MERDN y no hay sesión manual. Si el
 * proveedor OIDC no está aprovisionado, estas rutas responden `503` y NO se
 * degradan a nada.
 */
@ApiTags('human-auth')
@Controller('api/v1/human-auth')
export class HumanAuthController {
  private readonly logger = new Logger(HumanAuthController.name);

  constructor(
    @Inject(HumanAuthService) private readonly auth: HumanAuthService,
    @Inject(HumanContextsService) private readonly contexts: HumanContextsService,
  ) {}

  /**
   * Inicia el flujo OIDC.
   *
   * Responde con una redirección al proveedor. Se documenta como excluida del
   * contrato de máquina porque su respuesta es un `302` hacia un tercero y no un
   * cuerpo JSON: describirla como si devolviera datos sería inexacto.
   */
  @Get('login')
  @UseGuards(HumanAuthRateLimitGuard)
  @ApiExcludeEndpoint()
  public async login(
    @Query('returnTo') returnTo: unknown,
    @Res() response: Response,
  ): Promise<void> {
    const started = await this.protegido(() =>
      this.auth.startLogin(returnTo, new Date()),
    );

    noStore(response);
    response.setHeader('Set-Cookie', started.setCookieHeader);
    response.redirect(HttpStatus.FOUND, started.authorizationUrl);
  }

  /**
   * Completa el flujo OIDC.
   *
   * Responde SIEMPRE con una redirección, tanto si la autenticación concluyó
   * como si no. Un cuerpo distinto según el desenlace permitiría distinguir
   * «código manipulado» de «persona no aprovisionada», que es exactamente la
   * enumeración que §4.4 prohíbe.
   *
   * La cookie del intento se borra en los dos caminos: un intento fallido no
   * debe dejar en el navegador material que invite a reintentar.
   */
  @Get('callback')
  @UseGuards(HumanAuthRateLimitGuard)
  @ApiExcludeEndpoint()
  public async callback(
    @Req() request: RequestWithHumanSession,
    @Res() response: Response,
  ): Promise<void> {
    const correlationId = randomUUID();
    const browserToken = readCookie(
      request.headers.cookie,
      HUMAN_AUTH_ATTEMPT_COOKIE_NAME,
    );

    /*
     * Los parámetros se toman de la consulta ya analizada por Express y se
     * copian a un `URLSearchParams` con valores exclusivamente de texto: un
     * parámetro repetido o anidado no puede convertirse en un objeto que
     * confunda al adapter.
     */
    const parametros = new URLSearchParams();

    for (const [nombre, valor] of Object.entries(request.query)) {
      if (typeof valor === 'string') {
        parametros.set(nombre, valor);
      }
    }

    const result = await this.protegido(() =>
      this.auth.completeLogin(
        browserToken,
        parametros,
        new Date(),
        correlationId,
        'GET /api/v1/human-auth/callback',
      ),
    );

    noStore(response);

    if (result === null) {
      response.setHeader('Set-Cookie', this.auth.clearAttemptCookieHeader());
      /*
       * Se redirige al destino por defecto SIN sesión. La interfaz descubrirá
       * que no hay sesión al consultar `session`, y el desenlace es idéntico
       * para todas las causas de fallo.
       */
      response.redirect(HttpStatus.FOUND, this.webReturnUrl('/'));

      return;
    }

    response.setHeader('Set-Cookie', [...result.setCookieHeaders]);
    response.redirect(HttpStatus.FOUND, this.webReturnUrl(result.returnTarget));
  }

  /**
   * Convierte la ruta cerrada de retorno en una URL de la WEB. La API y la web
   * usan puertos distintos en local; una ruta relativa devolvería a la API.
   */
  private webReturnUrl(returnTarget: HumanAuthReturnTarget): string {
    const webOrigin = this.auth.allowedOrigins[0];

    if (webOrigin === undefined) {
      throw new ServiceUnavailableException({
        code: HUMAN_AUTH_ERROR_CODES.unavailable,
        message: 'El acceso no está disponible en este momento.',
      });
    }

    return new URL(returnTarget, `${webOrigin}/`).toString();
  }

  /**
   * Describe la sesión vigente.
   *
   * Devuelve EXCLUSIVAMENTE la caducidad absoluta, la inactividad restante y los
   * contextos disponibles. NO devuelve tenant, cuenta, persona, paciente,
   * profesional, emisor, `subject` ni ningún dato personal.
   */
  @Get('session')
  @HttpCode(HttpStatus.OK)
  @UseGuards(HumanSessionGuard)
  @ApiOperation({
    operationId: 'getCurrentHumanSession',
    summary: 'Describe la sesión humana vigente',
    description:
      'Devuelve la caducidad absoluta, los segundos que restan de inactividad y los contextos ' +
      'disponibles derivados en el servidor. NO devuelve identificadores de tenant, cuenta, ' +
      'persona, paciente ni profesional, ni ningún dato del proveedor de identidad. Un contexto ' +
      'disponible NO concede acceso a ningún recurso: cada operación vuelve a evaluar perfil, ' +
      'afiliación, asignación y relación.',
  })
  @ApiOkResponse({ description: 'Sesión vigente.', type: HumanSessionDto })
  @ApiUnauthorizedResponse({
    description:
      'No hay una sesión vigente. La respuesta es idéntica ante ausencia, malformación, ' +
      'caducidad absoluta, caducidad por inactividad, revocación, cuenta deshabilitada o ' +
      'identidad externa desvinculada.',
    type: HumanAuthErrorDto,
  })
  public async session(
    @Req() request: RequestWithHumanSession,
    @Res({ passthrough: true }) response: Response,
  ): Promise<HumanSessionDto> {
    noStore(response);

    const principal = humanPrincipalOf(request);
    const validity = humanSessionValidityOf(request);

    if (principal === null || validity === null) {
      // Inalcanzable con el guard activo; se conserva como defensa explícita.
      throw new UnauthorizedException({
        code: HUMAN_AUTH_ERROR_CODES.sessionRequired,
        message: 'No hay una sesión vigente.',
      });
    }

    const contexts = await this.protegido(() =>
      this.contexts.resolveNames(principal, new Date()),
    );

    return {
      expiresAt: validity.expiresAt.toISOString(),
      idleExpiresInSeconds: validity.idleExpiresInSeconds,
      contexts,
    };
  }

  /**
   * Revoca la sesión vigente.
   *
   * Exige origen autorizado además de la sesión: cerrar la sesión de otra
   * persona desde un sitio ajeno sería una molestia menor, pero el control es el
   * mismo que protege las operaciones que sí cambian datos, y aplicarlo de forma
   * uniforme evita tener que razonar caso por caso.
   *
   * La fila de la sesión se CONSERVA para trazabilidad histórica.
   */
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(HumanAuthRateLimitGuard, SameOriginGuard, HumanSessionGuard)
  @ApiOperation({
    operationId: 'revokeCurrentHumanSession',
    summary: 'Revoca la sesión humana vigente',
    description:
      'Marca la sesión como revocada y borra la cookie. La fila de la sesión se conserva para ' +
      'trazabilidad histórica: no se elimina ningún registro. Exige un origen autorizado.',
  })
  @ApiNoContentResponse({ description: 'Sesión revocada.' })
  @ApiUnauthorizedResponse({
    description: 'No hay una sesión vigente.',
    type: HumanAuthErrorDto,
  })
  @ApiForbiddenResponse({
    description: 'La petición no procede de un origen autorizado.',
    type: HumanAuthErrorDto,
  })
  @ApiTooManyRequestsResponse({
    description: 'Demasiados intentos desde el mismo origen.',
    type: HumanAuthErrorDto,
  })
  public async logout(
    @Req() request: RequestWithHumanSession,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const principal = humanPrincipalOf(request);

    if (principal === null) {
      throw new UnauthorizedException({
        code: HUMAN_AUTH_ERROR_CODES.sessionRequired,
        message: 'No hay una sesión vigente.',
      });
    }

    await this.protegido(() =>
      this.auth.logout(
        principal,
        new Date(),
        randomUUID(),
        'POST /api/v1/human-auth/logout',
      ),
    );

    response.setHeader('Set-Cookie', this.auth.clearSessionCookieHeader());
    noStore(response);
  }

  /**
   * Traduce a errores controlados el módulo no aprovisionado y el contexto de
   * ejecución inseguro.
   *
   * FAIL-CLOSED en los dos casos: sin proveedor OIDC configurado, o sin poder
   * confirmar que se opera bajo el rol de mínimo privilegio con el tenant
   * activo, la petición termina en `503`. Nunca se degrada a un acceso
   * concedido, y el detalle queda en el registro del servidor sin describir la
   * topología al cliente.
   */
  private async protegido<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if (error instanceof HumanAuthUnavailableError) {
        throw new ServiceUnavailableException({
          code: HUMAN_AUTH_ERROR_CODES.unavailable,
          message: 'El servicio no está disponible en este momento.',
        });
      }

      if (error instanceof RuntimeContextUnavailableError) {
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
