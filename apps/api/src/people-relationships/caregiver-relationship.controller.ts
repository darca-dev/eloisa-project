import { randomUUID } from 'node:crypto';

import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Inject,
  Logger,
  Param,
  Patch,
  Post,
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
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { type Response } from 'express';

import { RuntimeContextUnavailableError } from '../database/runtime-context.error';
import { SameOriginGuard } from '../human-auth/same-origin.guard';
import { CaregiverRelationshipManagerGuard } from '../institutional-auth/caregiver-relationship-manager.guard';
import { INSTITUTIONAL_ERROR_CODES } from '../institutional-auth/institutional-auth.contract';
import {
  institutionalPrincipalOf,
  type RequestWithInstitutionalPrincipal,
} from '../institutional-auth/municipal-viewer.guard';

import {
  CAREGIVER_ERROR_CODES,
  CAREGIVER_RELATIONSHIPS_PATH,
} from './caregiver-relationship.contract';
import {
  CaregiverRelationshipActivateRequestDto,
  CaregiverRelationshipCreateRequestDto,
  CaregiverRelationshipDto,
  CaregiverRelationshipErrorDto,
  CaregiverRelationshipRevokeRequestDto,
} from './caregiver-relationship.dto';
import {
  CaregiverBodyError,
  parseActivateBody,
  parseCreateBody,
  parseRelationshipId,
  parseRevokeBody,
} from './caregiver-relationship.request';
import {
  CaregiverRelationshipError,
  CaregiverRelationshipService,
  type CaregiverOperationContext,
  type CaregiverRelationshipView,
} from './caregiver-relationship.service';

/**
 * Superficie de gestión de relaciones Paciente–Cuidador
 * (IDENTITY-RELATIONSHIPS-CORE-01 §8.2, AD-03).
 *
 * Cuatro rutas y ninguna más:
 * - `POST  /api/v1/caregiver-relationships`                        crear;
 * - `GET   /api/v1/caregiver-relationships/:relationshipId`        consultar;
 * - `PATCH /api/v1/caregiver-relationships/:relationshipId/activate` activar;
 * - `PATCH /api/v1/caregiver-relationships/:relationshipId/revoke`   revocar.
 *
 * TODAS exigen una sesión institucional con el rol
 * `CAREGIVER_RELATIONSHIP_MANAGER`, que es DISJUNTO de los otros tres roles. Ni
 * una sesión municipal, ni una hospitalaria, ni una sesión HUMANA alcanzan esta
 * superficie: la persona cuidadora no puede autorizarse a sí misma.
 *
 * EL SERVIDOR FIJA, y el cliente no puede enviar: tenant, actor, tipo,
 * finalidad, fuente de validación, alcance, estado, fechas de validación y
 * revocación, y versión. Cualquier campo fuera de la allowlist produce `400`.
 *
 * NO EXISTE listado ni búsqueda en este slice: recorrer las relaciones de una
 * institución revelaría quién cuida a quién sin que ninguna Task lo haya
 * autorizado. Solo se consulta una relación conocida por su identificador.
 */
@ApiTags('caregiver-relationships')
@Controller(CAREGIVER_RELATIONSHIPS_PATH)
@UseGuards(CaregiverRelationshipManagerGuard)
export class CaregiverRelationshipController {
  private readonly logger = new Logger(CaregiverRelationshipController.name);

  constructor(
    @Inject(CaregiverRelationshipService)
    private readonly relationships: CaregiverRelationshipService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(SameOriginGuard)
  @ApiOperation({
    operationId: 'createCaregiverRelationship',
    summary: 'Crea una relación Paciente–Cuidador en estado PENDING_VALIDATION',
    description:
      'Declara una autorización OPERATIVA de cuidado con finalidad, vigencia y alcance ' +
      'VISITS_VIEW. El servidor fija tenant, actor, tipo, finalidad, fuente, estado, versión y ' +
      'alcance. NO es representación legal, NO es tutela, NO es parentesco, NO acredita la ' +
      'identidad de la persona cuidadora y NO concede acceso clínico ni exportación. La ' +
      'relación nace SIN efecto: solo autoriza tras activarse.',
  })
  @ApiBody({ type: CaregiverRelationshipCreateRequestDto })
  @ApiCreatedResponse({ description: 'Relación creada.', type: CaregiverRelationshipDto })
  @ApiBadRequestResponse({
    description: 'Cuerpo inválido o con campos no admitidos.',
    type: CaregiverRelationshipErrorDto,
  })
  @ApiUnauthorizedResponse({
    description: 'No hay una sesión institucional vigente.',
    type: CaregiverRelationshipErrorDto,
  })
  @ApiForbiddenResponse({
    description:
      'La identidad no tiene el rol CAREGIVER_RELATIONSHIP_MANAGER, o el origen no está ' +
      'autorizado.',
    type: CaregiverRelationshipErrorDto,
  })
  @ApiNotFoundResponse({
    description:
      'Paciente o persona cuidadora inexistentes, o pertenecientes a otra institución. La ' +
      'respuesta es idéntica en ambos casos.',
    type: CaregiverRelationshipErrorDto,
  })
  @ApiConflictResponse({
    description:
      'Autorrelación, o ya existe una relación ACTIVE solapada para la misma combinación de ' +
      'paciente, persona cuidadora, tipo y finalidad.',
    type: CaregiverRelationshipErrorDto,
  })
  public async create(
    @Req() request: RequestWithInstitutionalPrincipal,
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ): Promise<CaregiverRelationshipDto> {
    const context = this.contextOf(request, 'POST /api/v1/caregiver-relationships');

    return this.protegido(response, async () => {
      const parsed = parseCreateBody(body);

      return this.relationships.create(context, parsed, new Date());
    });
  }

  @Get(':relationshipId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    operationId: 'getCaregiverRelationship',
    summary: 'Consulta una relación del propio tenant',
    description:
      'Devuelve la relación indicada. NO devuelve tenant, referencia de autorización ni la ' +
      'identidad institucional que validó o revocó. Una relación de otra institución produce ' +
      'el MISMO 404 que una inexistente.',
  })
  @ApiParam({ name: 'relationshipId', format: 'uuid' })
  @ApiOkResponse({ description: 'Relación encontrada.', type: CaregiverRelationshipDto })
  @ApiBadRequestResponse({
    description: 'Identificador con forma no admitida.',
    type: CaregiverRelationshipErrorDto,
  })
  @ApiUnauthorizedResponse({
    description: 'No hay una sesión institucional vigente.',
    type: CaregiverRelationshipErrorDto,
  })
  @ApiForbiddenResponse({
    description: 'La identidad no tiene el rol CAREGIVER_RELATIONSHIP_MANAGER.',
    type: CaregiverRelationshipErrorDto,
  })
  @ApiNotFoundResponse({
    description: 'Relación inexistente o de otra institución.',
    type: CaregiverRelationshipErrorDto,
  })
  public async findOne(
    @Req() request: RequestWithInstitutionalPrincipal,
    @Param('relationshipId') relationshipId: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<CaregiverRelationshipDto> {
    const context = this.contextOf(
      request,
      'GET /api/v1/caregiver-relationships/:relationshipId',
    );

    return this.protegido(response, async () =>
      this.relationships.findOne(context, parseRelationshipId(relationshipId)),
    );
  }

  @Patch(':relationshipId/activate')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SameOriginGuard)
  @ApiOperation({
    operationId: 'activateCaregiverRelationship',
    summary: 'Activa una relación: PENDING_VALIDATION → ACTIVE',
    description:
      'Única transición admitida hacia ACTIVE. Exige expectedVersion, inicio ya alcanzado y ' +
      'vigencia no terminada. Fija el actor institucional OPACO y la fecha de validación, y ' +
      'aumenta la versión. Una relación revocada o expirada NO se reactiva: reautorizar crea ' +
      'un episodio nuevo.',
  })
  @ApiParam({ name: 'relationshipId', format: 'uuid' })
  @ApiBody({ type: CaregiverRelationshipActivateRequestDto })
  @ApiOkResponse({ description: 'Relación activada.', type: CaregiverRelationshipDto })
  @ApiBadRequestResponse({
    description: 'Cuerpo inválido o con campos no admitidos.',
    type: CaregiverRelationshipErrorDto,
  })
  @ApiUnauthorizedResponse({
    description: 'No hay una sesión institucional vigente.',
    type: CaregiverRelationshipErrorDto,
  })
  @ApiForbiddenResponse({
    description:
      'La identidad no tiene el rol CAREGIVER_RELATIONSHIP_MANAGER, o el origen no está ' +
      'autorizado.',
    type: CaregiverRelationshipErrorDto,
  })
  @ApiNotFoundResponse({
    description: 'Relación inexistente o de otra institución.',
    type: CaregiverRelationshipErrorDto,
  })
  @ApiConflictResponse({
    description:
      'La versión esperada no coincide, la transición no es válida desde el estado actual, o ' +
      'la activación solaparía otra relación ACTIVE.',
    type: CaregiverRelationshipErrorDto,
  })
  public async activate(
    @Req() request: RequestWithInstitutionalPrincipal,
    @Param('relationshipId') relationshipId: string,
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ): Promise<CaregiverRelationshipDto> {
    const context = this.contextOf(
      request,
      'PATCH /api/v1/caregiver-relationships/:relationshipId/activate',
    );

    return this.protegido(response, async () =>
      this.relationships.activate(
        context,
        parseRelationshipId(relationshipId),
        parseActivateBody(body),
        new Date(),
      ),
    );
  }

  @Patch(':relationshipId/revoke')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SameOriginGuard)
  @ApiOperation({
    operationId: 'revokeCaregiverRelationship',
    summary: 'Revoca una relación: PENDING_VALIDATION | ACTIVE → REVOKED',
    description:
      'Exige expectedVersion y un motivo del catálogo CERRADO. Fija el actor institucional ' +
      'OPACO y la fecha de revocación, y aumenta la versión. La revocación es INMEDIATA: en ' +
      'cuanto confirma, la persona cuidadora deja de tener VISITS_VIEW aunque su sesión siga ' +
      'viva. La fila se conserva: no se elimina ningún registro.',
  })
  @ApiParam({ name: 'relationshipId', format: 'uuid' })
  @ApiBody({ type: CaregiverRelationshipRevokeRequestDto })
  @ApiOkResponse({ description: 'Relación revocada.', type: CaregiverRelationshipDto })
  @ApiBadRequestResponse({
    description: 'Cuerpo inválido o con campos no admitidos.',
    type: CaregiverRelationshipErrorDto,
  })
  @ApiUnauthorizedResponse({
    description: 'No hay una sesión institucional vigente.',
    type: CaregiverRelationshipErrorDto,
  })
  @ApiForbiddenResponse({
    description:
      'La identidad no tiene el rol CAREGIVER_RELATIONSHIP_MANAGER, o el origen no está ' +
      'autorizado.',
    type: CaregiverRelationshipErrorDto,
  })
  @ApiNotFoundResponse({
    description: 'Relación inexistente o de otra institución.',
    type: CaregiverRelationshipErrorDto,
  })
  @ApiConflictResponse({
    description:
      'La versión esperada no coincide, o la relación ya está en un estado terminal.',
    type: CaregiverRelationshipErrorDto,
  })
  public async revoke(
    @Req() request: RequestWithInstitutionalPrincipal,
    @Param('relationshipId') relationshipId: string,
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ): Promise<CaregiverRelationshipDto> {
    const context = this.contextOf(
      request,
      'PATCH /api/v1/caregiver-relationships/:relationshipId/revoke',
    );

    return this.protegido(response, async () =>
      this.relationships.revoke(
        context,
        parseRelationshipId(relationshipId),
        parseRevokeBody(body),
        new Date(),
      ),
    );
  }

  /**
   * Contexto de la operación.
   *
   * El principal lo pone el guard y solo el guard. Que sea `null` aquí es
   * inalcanzable con el guard activo; se conserva como defensa explícita para
   * que un cambio futuro en los decoradores no abra la superficie en silencio.
   */
  private contextOf(
    request: RequestWithInstitutionalPrincipal,
    endpoint: string,
  ): CaregiverOperationContext {
    const principal = institutionalPrincipalOf(request);

    if (principal === null) {
      throw new UnauthorizedException({
        code: INSTITUTIONAL_ERROR_CODES.sessionRequired,
        message: 'No hay una sesión institucional vigente.',
      });
    }

    return { principal, endpoint, correlationId: randomUUID() };
  }

  /**
   * Traduce los desenlaces de dominio a estados HTTP del contrato y fija las
   * cabeceras de no-caché en TODAS las respuestas, incluidas las de error.
   */
  private async protegido(
    response: Response,
    work: () => Promise<CaregiverRelationshipView>,
  ): Promise<CaregiverRelationshipDto> {
    noStore(response);

    try {
      return toDto(await work());
    } catch (error) {
      if (error instanceof CaregiverBodyError) {
        throw new BadRequestException({
          code: CAREGIVER_ERROR_CODES.invalidRequest,
          message: error.message,
        });
      }

      if (error instanceof CaregiverRelationshipError) {
        throw new HttpException({ code: error.code, message: error.message }, error.status);
      }

      if (error instanceof RuntimeContextUnavailableError) {
        // FAIL-CLOSED: sin contexto de ejecución seguro no se escribe nada.
        this.logger.error(error.message);

        throw new ServiceUnavailableException({
          code: CAREGIVER_ERROR_CODES.unavailable,
          message: 'El servicio no está disponible en este momento.',
        });
      }

      throw error;
    }
  }
}

/** Serialización explícita. Los instantes viajan en ISO-8601 UTC. */
function toDto(view: CaregiverRelationshipView): CaregiverRelationshipDto {
  return {
    relationshipId: view.relationshipId,
    patientId: view.patientId,
    caregiverPersonId: view.caregiverPersonId,
    relationshipType: view.relationshipType,
    purpose: view.purpose,
    status: view.status,
    startsAt: view.startsAt.toISOString(),
    endsAt: view.endsAt === null ? null : view.endsAt.toISOString(),
    validationSource: view.validationSource,
    validatedAt: view.validatedAt === null ? null : view.validatedAt.toISOString(),
    revokedAt: view.revokedAt === null ? null : view.revokedAt.toISOString(),
    revocationReason: view.revocationReason,
    version: view.version,
    scopes: [...view.scopes],
  };
}

/** Ninguna respuesta de esta superficie puede quedar en una caché compartida. */
function noStore(response: Response): void {
  response.setHeader('Cache-Control', 'private, no-store');
  response.setHeader('Pragma', 'no-cache');
  response.setHeader('Vary', 'Cookie');
}
