/**
 * Endpoint público de registro de interés (SPEC 038, MP02-C1).
 *
 * `POST /api/v1/access-requests`
 *
 * ES UN REGISTRO DE INTERÉS, NO UNA INSCRIPCIÓN. La respuesta es `202` y no
 * incluye token, cookie, sesión, identificador interno ni dato de la persona. Quien
 * llama recibe una referencia opaca y nada más.
 *
 * BARRERAS, EN ESTE ORDEN Y POR ESTE MOTIVO:
 * 1. Origen permitido. Este endpoint es público y sin autenticación, pero la
 *    comprobación se mantiene porque `API_WEB_ORIGINS` ya existe, ya está
 *    validada al arrancar y ya la usa CORS. Aceptar peticiones sin origen ni
 *    `Referer` dejaría abierta la vía de un contexto opaco (`iframe` con
 *    `sandbox`, documento `data:`), y `isAllowedWebOrigin` deniega por defecto
 *    justamente ese caso. No es autenticación: no reemplaza a ninguna otra
 *    barrera. Es un GUARD y no una comprobación en este método porque Nest
 *    ejecuta los guards antes de la acción: declararla aquí la dejaría
 *    DESPUÉS del límite, y una página ajena podría agotar el cupo de una
 *    persona que comparte salida de red antes de recibir el `403`.
 *    Ver `access-request.origin.guard.ts`.
 * 2. Límite de peticiones. Va después del origen, y solo por eso un origen
 *    denegado no consume cupo.
 * 3. Cuerpo cerrado. Cualquier clave no declarada se rechaza; ver
 *    `access-request.validation.ts`.
 *
 * NEUTRALIDAD DE LAS RESPUESTAS: el origen rechazado y el cuerpo inválido
 * describen el problema sin revelar la configuración del despliegue ni el valor
 * recibido. Cualquier fallo de persistencia o de contexto institucional se
 * traduce a un único `503` opaco, porque un endpoint público no debe confirmar
 * si una persona existe, ni si un tenant está disponible, ni cómo se llama una
 * restricción en la base de datos.
 */

import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpException,
  HttpStatus,
  Logger,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { type Request, type Response } from 'express';
import {
  ApiAcceptedResponse,
  ApiBadRequestResponse,
  ApiBody,
  ApiForbiddenResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiResponse,
} from '@nestjs/swagger';

import { ACCESS_REQUEST_ERROR_CODES } from './access-request.contract';
import { accessRegistrationAttempt, accessRegistrationAttemptCookie } from './access-registration-attempt';
import {
  AccessRequestAcceptedDto,
  AccessRequestErrorDto,
  AccessRequestSubmissionDto,
} from './access-request.dto';
import { AccessRequestOriginGuard } from './access-request.origin.guard';
import { AccessRequestRateLimitGuard } from './access-request.rate-limit.guard';
/* Valor, no tipo: el token de Nest es la clase y solo llega al contenedor por la
 * metadata del decorador del constructor. Un `import type` se borra al compilar. */
/* eslint-disable-next-line @typescript-eslint/consistent-type-imports -- El token de Nest es la clase. */
import { AccessRequestsService } from './access-request.service';

/** Sin columna: el error de origen nunca revela qué campo falló en el cuerpo. */
const NO_FIELDS: readonly string[] = [];

@ApiTags('access-requests')
@Controller('api/v1/access-requests')
export class AccessRequestsController {
  private readonly logger = new Logger(AccessRequestsController.name);

  constructor(private readonly service: AccessRequestsService) {}

  @Post('registration-attempt')
  @HttpCode(204)
  @UseGuards(AccessRequestOriginGuard, AccessRequestRateLimitGuard)
  @ApiOperation({ summary: 'Prepara el intento de registro personal mediante cookie HttpOnly' })
  @ApiResponse({ status: 204, description: 'Intento preparado; no crea persona, cuenta ni solicitud.' })
  public attempt(@Req() request: Request, @Res({ passthrough: true }) response: Response): void {
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('Set-Cookie', accessRegistrationAttemptCookie(request.headers.cookie));
  }

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(AccessRequestOriginGuard, AccessRequestRateLimitGuard)
  @ApiOperation({
    summary:
      'Registra el interés de una persona en el entorno funcional y devuelve una ' +
      'referencia opaca.',
    description:
      'Crea una persona nueva del tenant del ' +
      'servidor y una solicitud en estado PENDING, y prepara su identidad en el proveedor ' +
      'como un usuario DESHABILITADO. No crea paciente, perfil, relación ni asignación, y ' +
      'no otorga acceso a ningún servicio: la cuenta solo se activa cuando una revisión ' +
      'aprueba la solicitud. Repetir una solicitud abierta exige el mismo intento ' +
      'propietario vigente, perfil y datos; no reemplaza su contraseña. Un documento ' +
      'existente no autoriza vincular ni recuperar una cuenta.',
  })
  @ApiBody({ type: AccessRequestSubmissionDto })
  @ApiAcceptedResponse({
    description:
      'Solicitud registrada. La respuesta contiene únicamente referencia, estado y origen.',
    type: AccessRequestAcceptedDto,
  })
  @ApiBadRequestResponse({
    description:
      'Cuerpo ausente, mal formado, con claves desconocidas, sin contacto, con fecha ' +
      'futura, con valores fuera de catálogo o con una contraseña que no cumple su regla. ' +
      'Se rechazan explícitamente tenant, estado, origen, revisor, decisión, ' +
      'aprovisionamiento y cualquier texto libre. La respuesta nombra el campo y nunca su ' +
      'valor.',
    type: AccessRequestErrorDto,
  })
  @ApiForbiddenResponse({
    description:
      'Petición procedente de un origen web no configurado, o privada de cabecera. La ' +
      'respuesta es idéntica en ambos casos y no describe la lista de orígenes.',
    type: AccessRequestErrorDto,
  })
  @ApiTooManyRequestsResponse({
    description: 'Se superó el límite de peticiones para la ventana vigente.',
    type: AccessRequestErrorDto,
  })
  @ApiServiceUnavailableResponse({
    description:
      'El contexto institucional, la persistencia o la preparación de identidad en el ' +
      'proveedor no están disponibles. La respuesta es opaca y no revela causa técnica, ' +
      'tenant, proveedor ni existencia de datos.',
    type: AccessRequestErrorDto,
  })
  public async submit(@Body() body: unknown, @Req() request: Request, @Res({ passthrough: true }) response: Response): Promise<AccessRequestAcceptedDto> {
    response.setHeader('Cache-Control', 'private, no-store');
    try {
      const result = await this.service.submit(body, new Date(), accessRegistrationAttempt(request.headers.cookie));

      if (!result.ok) {
        /*
         * Aquí solo pueden llegar DOS desenlaces: `INVALID_BODY`, que es un
         * problema del formulario, y `UNAVAILABLE`, que es un problema del
         * servicio —incluida la preparación de identidad en el proveedor—. El
         * `if` obliga a decidir de forma explícita qué hacer con cada uno en
         * lugar de servir un 202 vacío ante un fallo nuevo.
         */
        if (result.failure.kind === 'INVALID_BODY') {
          throw new BadRequestException({
            code: ACCESS_REQUEST_ERROR_CODES.invalidBody,
            message: 'La solicitud no tiene una forma válida.',
            fields: result.failure.fields ?? NO_FIELDS,
          });
        }

        throw this.unavailable();
      }

      return result.value;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      /*
       * Se registra SOLO el nombre del error. El mensaje de Prisma puede
       * contener valores de una constraint, y el stack describe la topología
       * interna. Ninguno de los dos puede salir de un endpoint público.
       */
      this.logger.error(
        `Fallo al registrar la solicitud de acceso: ${error instanceof Error ? error.name : 'desconocido'}`,
      );

      throw this.unavailable();
    }
  }

  private unavailable(): HttpException {
    return new HttpException(
      {
        code: ACCESS_REQUEST_ERROR_CODES.unavailable,
        message: 'El servicio no está disponible en este momento. Intente de nuevo más tarde.',
      },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}
