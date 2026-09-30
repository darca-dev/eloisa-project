/**
 * Superficie institucional de revisión de solicitudes de acceso
 * (SPEC 038 §6.4, paquete MP03-C1, ampliado por MP04).
 *
 * `GET  /api/v1/hospital/access-requests`
 * `GET  /api/v1/hospital/access-requests/{requestId}`
 * `POST /api/v1/hospital/access-requests/{requestId}/decision`
 *
 * QUÉ ES: el SERVIDOR de la bandeja que el personal de revisión de un hospital
 * necesita para ver y resolver el backlog de solicitudes de acceso de SU
 * PROPIO tenant. Son tres operaciones y ninguna más: no hay listado de otros
 * tenants, no hay edición de los datos declarados por la persona, no hay
 * reenvío de credenciales y no hay una operación dedicada de provisión. MP04
 * amplía ACCIONES de decisión —aprobación con saga, reintento, suspensión,
 * reactivación y revocación—, pero no añade rutas: la provisión se invoca como
 * segundo paso de la propia decisión.
 *
 * BARRERAS, EN ESTE ORDEN Y POR ESTE MOTIVO:
 * 1. `HospitalAccessReviewerGuard`. Autentica la sesión institucional y exige el
 *    rol EXACTO `HOSPITAL_ACCESS_REVIEWER`. Va primero porque es la barrera de
 *    autorización: mientras no se ha comprobado el rol, no tiene sentido validar
 *    filtros, ni buscar una fila, ni escribir nada, ni contestar.
 * 2. `InstitutionalSameOriginGuard`, SOLO en la decisión. La sesión vive en una
 *    cookie y el navegador la envía también cuando la origina un sitio ajeno, de
 *    modo que la única operación que cambia estado necesita además comprobar el
 *    origen. Las dos lecturas no lo necesitan: no cambian nada. Se REUTILIZA el
 *    guard institucional existente en lugar de escribir una segunda comprobación,
 *    para que la allowlist de orígenes sea una sola.
 *
 * LO QUE ESTA SUPERFICIE NO CONCEDE: aprobar ejecuta una SAGA en dos fases. La
 * transacción de decisión deja la solicitud en `APPROVED_PENDING_PROVISIONING`;
 * solo si el proveedor confirma, y en una transacción posterior, la solicitud
 * queda en `APPROVED`. No se crea ningún perfil, relación ni asignación, y las
 * contraseñas no vuelven por esta superficie. Un `200` responde con el estado
 * LEÍDO DESPUÉS de la saga: `APPROVED` cuando el proveedor confirmó,
 * `PROVISIONING_FAILED` cuando no, y `APPROVED_PENDING_PROVISIONING` únicamente
 * si la saga quedó a medias por un corte del proceso.
 *
 * NEUTRALIDAD DE LAS RESPUESTAS: un identificador de otro tenant y uno
 * inexistente producen el MISMO `404`, con el mismo cuerpo. Un conflicto de
 * versión y un estado ya decidido producen el mismo `409`. Ningún error incluye
 * PII, SQL, nombres de restricción, tenant ni causa interna.
 */

import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
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
  ApiQuery,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { InstitutionalSameOriginGuard } from '../institutional-auth/institutional-same-origin.guard';
import {
  institutionalPrincipalOf,
  type RequestWithInstitutionalPrincipal,
} from '../institutional-auth/municipal-viewer.guard';

import { ACCESS_REQUEST_REVIEW_ERROR_CODES } from './access-request-review.contract';
import {
  ACCESS_REQUEST_REVIEW_QUERY_API,
  AccessRequestReviewDecisionRequestDto,
  AccessRequestReviewDecisionResponseDto,
  AccessRequestReviewDetailDto,
  AccessRequestReviewErrorDto,
  AccessRequestReviewListDto,
} from './access-request-review.dto';
import { HospitalAccessReviewerGuard } from './access-request-review.guard';
/* eslint-disable-next-line @typescript-eslint/consistent-type-imports -- El token de Nest es la clase. */
import {
  AccessRequestReviewService,
  type AccessRequestReviewFailure,
} from './access-request-review.service';
import { isAccessRequestIdWellFormed } from './access-request-review.validation';

/** Sin columna: el error no revela qué campo falló cuando el fallo no es de campo. */
const NO_FIELDS: readonly string[] = [];

@ApiTags('hospital-access-requests')
@Controller('api/v1/hospital/access-requests')
@UseGuards(HospitalAccessReviewerGuard)
export class HospitalAccessRequestReviewController {
  private readonly logger = new Logger(HospitalAccessRequestReviewController.name);

  constructor(private readonly service: AccessRequestReviewService) {}

  @Get()
  @ApiOperation({
    summary: 'Lista las solicitudes de acceso pendientes del tenant de la institución.',
    description:
      'Devuelve una página del backlog del PROPIO tenant, ordenada por fecha de envío ' +
      'descendente. Cada item es una proyección mínima: identificador, referencia, ' +
      'perfil, estado, versión, fecha y nombres. El documento y el contacto NO se ' +
      'devuelven aquí: están en el detalle, cuya consulta se audita. La respuesta ' +
      'nunca incluye tenant, personId ni datos de auditoría.',
  })
  @ApiQuery(ACCESS_REQUEST_REVIEW_QUERY_API.status)
  @ApiQuery(ACCESS_REQUEST_REVIEW_QUERY_API.profile)
  @ApiQuery(ACCESS_REQUEST_REVIEW_QUERY_API.q)
  @ApiQuery(ACCESS_REQUEST_REVIEW_QUERY_API.limit)
  @ApiQuery(ACCESS_REQUEST_REVIEW_QUERY_API.cursor)
  @ApiOkResponse({ type: AccessRequestReviewListDto })
  @ApiBadRequestResponse({
    description:
      'Parámetro de consulta desconocido, repetido, fuera de catálogo, fuera del rango ' +
      'de `limit` o con un cursor alterado. La respuesta nombra el campo y nunca su valor.',
    type: AccessRequestReviewErrorDto,
  })
  @ApiUnauthorizedResponse({
    description: 'No hay una sesión institucional vigente.',
    type: AccessRequestReviewErrorDto,
  })
  @ApiForbiddenResponse({
    description:
      'La identidad institucional autenticada no tiene el rol HOSPITAL_ACCESS_REVIEWER. ' +
      'La respuesta no revela si existe alguna solicitud.',
    type: AccessRequestReviewErrorDto,
  })
  @ApiServiceUnavailableResponse({
    description:
      'El contexto de ejecución seguro no pudo confirmarse. La respuesta es opaca y no ' +
      'describe la topología del despliegue.',
    type: AccessRequestReviewErrorDto,
  })
  public async list(
    @Query() query: unknown,
    @Req() contexto: RequestWithInstitutionalPrincipal,
  ): Promise<AccessRequestReviewListDto> {
    const principal = this.principal(contexto);

    try {
      const result = await this.service.list(principal, query, new Date());

      if (!result.ok) {
        throw this.falla(result.failure);
      }

      return result.value;
    } catch (error) {
      throw this.revisar(error);
    }
  }

  @Get(':requestId')
  @ApiOperation({
    summary: 'Devuelve el detalle de una solicitud para revisarla.',
    description:
      'Proyecta la persona y la solicitud para que quien revisa pueda valorarla: ' +
      'documento, fecha de nacimiento, contacto y estado. No devuelve identificadores ' +
      'internos relacionados, secretos, issuer, subject OIDC, token ni datos de otro ' +
      'tenant. Un identificador de otro tenant y uno inexistente responden igual.',
  })
  @ApiParam({
    name: 'requestId',
    description: 'Identificador opaco de la solicitud, no su referencia mostrada.',
    format: 'uuid',
  })
  @ApiOkResponse({ type: AccessRequestReviewDetailDto })
  @ApiBadRequestResponse({
    description: 'El identificador de la ruta no tiene la forma de un identificador.',
    type: AccessRequestReviewErrorDto,
  })
  @ApiUnauthorizedResponse({
    description: 'No hay una sesión institucional vigente.',
    type: AccessRequestReviewErrorDto,
  })
  @ApiForbiddenResponse({
    description:
      'La identidad institucional autenticada no tiene el rol HOSPITAL_ACCESS_REVIEWER.',
    type: AccessRequestReviewErrorDto,
  })
  @ApiNotFoundResponse({
    description:
      'La solicitud no existe en este tenant. La respuesta es idéntica para un ' +
      'identificador inexistente y para uno que pertenece a otra institución.',
    type: AccessRequestReviewErrorDto,
  })
  @ApiServiceUnavailableResponse({
    description: 'El contexto de ejecución seguro no pudo confirmarse.',
    type: AccessRequestReviewErrorDto,
  })
  public async detail(
    @Param('requestId') requestId: string,
    @Req() contexto: RequestWithInstitutionalPrincipal,
  ): Promise<AccessRequestReviewDetailDto> {
    const principal = this.principal(contexto);

    if (!isAccessRequestIdWellFormed(requestId)) {
      /*
       * `400` y no `404`: el identificador nunca pudo existir, y decir «no
       * encontrado» afirmaría algo falso sobre el estado de una fila que nadie
       * consultó. Mantenerlo distinguible del `404` de tenant ajeno no crea un
       * oráculo, porque un identificador mal formado no puede ser ajeno a nadie.
       */
      throw new BadRequestException({
        code: ACCESS_REQUEST_REVIEW_ERROR_CODES.invalidRequest,
        message: 'El identificador de la solicitud no tiene una forma válida.',
        fields: ['requestId'],
      });
    }

    try {
      const result = await this.service.detail(principal, requestId, new Date());

      if (!result.ok) {
        throw this.falla(result.failure);
      }

      return result.value;
    } catch (error) {
      throw this.revisar(error);
    }
  }

  @Post(':requestId/decision')
  @HttpCode(HttpStatus.OK)
  @UseGuards(InstitutionalSameOriginGuard)
  @ApiOperation({
    summary: 'Resolver una solicitud: aprobar, rechazar, reintentar, suspender, reactivar o revocar.',
    description:
      'Registra la decisión con control de concurrencia optimista y una sola transacción ' +
      'de estado. APPROVE ejecuta una saga en dos fases —APPROVED_PENDING_PROVISIONING y, ' +
      'si el proveedor confirma, APPROVED—; REJECT cierra en REJECTED; RETRY_PROVISIONING ' +
      'reintenta una provisión fallida; SUSPEND, REACTIVATE y REVOKE deshabilitan la cuenta ' +
      'y revocan TODAS sus sesiones en la MISMA transacción de la decisión. Todo deja ' +
      'constancia de la identidad revisora, la fecha del servidor, el código de motivo y la ' +
      'versión incrementada. No se crea perfil, relación ni asignación, y ninguna ' +
      'contraseña pasa por esta superficie. Repetir la misma decisión devuelve el estado ' +
      'vigente sin escribir ni auditar de nuevo.',
  })
  @ApiParam({
    name: 'requestId',
    description: 'Identificador opaco de la solicitud.',
    format: 'uuid',
  })
  @ApiBody({ type: AccessRequestReviewDecisionRequestDto })
  @ApiOkResponse({
    description:
      'La decisión vigente. Las respuestas de aprobación y reintento se LEEN DESPUÉS de ' +
      'que la saga haya terminado, de modo que muestran APPROVED o PROVISIONING_FAILED y ' +
      'no el estado intermedio. Cuando la petición es una repetición exacta, esta es la ' +
      'respuesta que ya estaba registrada y no se escribe nada nuevo.',
    type: AccessRequestReviewDecisionResponseDto,
  })
  @ApiBadRequestResponse({
    description:
      'Cuerpo ausente, con claves desconocidas, con acción o motivo fuera de catálogo, ' +
      'con una pareja acción-motivo que no corresponde, o con una versión esperada que no ' +
      'es un entero positivo. La respuesta nombra el campo y nunca su valor.',
    type: AccessRequestReviewErrorDto,
  })
  @ApiUnauthorizedResponse({
    description: 'No hay una sesión institucional vigente.',
    type: AccessRequestReviewErrorDto,
  })
  @ApiForbiddenResponse({
    description:
      'La identidad institucional no tiene el rol HOSPITAL_ACCESS_REVIEWER, o la petición ' +
      'no procede de un origen web configurado. Ninguna de las dos revela si existe alguna ' +
      'solicitud.',
    type: AccessRequestReviewErrorDto,
  })
  @ApiNotFoundResponse({
    description:
      'La solicitud no existe en este tenant. La respuesta es idéntica para un ' +
      'identificador inexistente y para uno de otra institución.',
    type: AccessRequestReviewErrorDto,
  })
  @ApiConflictResponse({
    description:
      'La solicitud ya tiene decisión o su versión cambió. La respuesta no distingue cuál ' +
      'de las dos cosas ocurrió y no se escribe nada.',
    type: AccessRequestReviewErrorDto,
  })
  @ApiServiceUnavailableResponse({
    description: 'El contexto de ejecución seguro no pudo confirmarse.',
    type: AccessRequestReviewErrorDto,
  })
  public async decide(
    @Param('requestId') requestId: string,
    @Body() body: unknown,
    @Req() contexto: RequestWithInstitutionalPrincipal,
  ): Promise<AccessRequestReviewDecisionResponseDto> {
    const principal = this.principal(contexto);

    if (!isAccessRequestIdWellFormed(requestId)) {
      throw new BadRequestException({
        code: ACCESS_REQUEST_REVIEW_ERROR_CODES.invalidRequest,
        message: 'El identificador de la solicitud no tiene una forma válida.',
        fields: ['requestId'],
      });
    }

    try {
      const result = await this.service.decide(principal, requestId, body, new Date());

      if (!result.ok) {
        throw this.falla(result.failure);
      }

      return result.value;
    } catch (error) {
      throw this.revisar(error);
    }
  }

  /**
   * Mensajes de los desenlaces cerrados.
   *
   * Son ÚNICOS por código y no describen la causa. Un `404` dice lo mismo para un
   * identificador inexistente y para uno ajeno; un `409` dice lo mismo para un
   * estado ya decidido y para una versión vencida. Si estos mensajes distinguieran
   * los casos, la superficie se convertiría en un oráculo de la historia interna
   * de otras instituciones.
   */
  private falla(failure: AccessRequestReviewFailure): HttpException {
    switch (failure.kind) {
      case 'INVALID_QUERY':
      case 'INVALID_REQUEST_ID':
      case 'INVALID_BODY':
        return new BadRequestException({
          code: ACCESS_REQUEST_REVIEW_ERROR_CODES.invalidRequest,
          message: 'La petición no tiene una forma válida.',
          fields: failure.fields ?? NO_FIELDS,
        });

      case 'NOT_FOUND':
        return new NotFoundException({
          code: ACCESS_REQUEST_REVIEW_ERROR_CODES.notFound,
          message: 'No hay una solicitud que mostrar.',
        });

      case 'CONFLICT':
        return new ConflictException({
          code: ACCESS_REQUEST_REVIEW_ERROR_CODES.conflict,
          message: 'La solicitud ya no puede decidirse con esos datos.',
        });

      case 'UNAVAILABLE':
        return this.unavailable();
    }
  }

  /**
   * Traduce UN fallo del servicio a su excepción HTTP.
   *
   * Existe como método para que las tres rutas compartan exactamente la misma
   * traducción. Duplicarla en cada ruta haría que un fallo nuevo tuviera tres
   * posibles respuestas, y el catálogo cerrado dejaría de estarlo.
   */
  private revisar(error: unknown): HttpException {
    if (error instanceof HttpException) {
      return error;
    }

    /*
     * Se registra SOLO el nombre del error. El mensaje de Prisma puede contener
     * valores de una constraint y el stack describe la topología interna de la
     * base de datos; ninguno de los dos puede salir de la superficie.
     */
    this.logger.error(
      `Fallo en la revisión de solicitudes: ${error instanceof Error ? error.name : 'desconocido'}`,
    );

    return this.unavailable();
  }

  private unavailable(): HttpException {
    return new HttpException(
      {
        code: ACCESS_REQUEST_REVIEW_ERROR_CODES.unavailable,
        message: 'El servicio no está disponible en este momento. Intente de nuevo más tarde.',
      },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }

  /**
   * Principal del revisor.
   *
   * Lo adjuntó el guard tras comprobar el rol. Si no estuviera, no habría sesión
   * válida y la respuesta correcta es `401`: servir la lectura con un principal
   * inventado sería el peor de los fallos posibles en esta superficie.
   */
  private principal(
    contexto: RequestWithInstitutionalPrincipal,
  ): NonNullable<ReturnType<typeof institutionalPrincipalOf>> {
    const principal = institutionalPrincipalOf(contexto);

    if (principal === null) {
      throw new HttpException(
        {
          code: ACCESS_REQUEST_REVIEW_ERROR_CODES.sessionRequired,
          message: 'No hay una sesión institucional vigente.',
        },
        HttpStatus.UNAUTHORIZED,
      );
    }

    return principal;
  }
}
