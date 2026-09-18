import { randomUUID } from 'node:crypto';

import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Logger,
  NotFoundException,
  Param,
  Query,
  Req,
  Res,
  ServiceUnavailableException,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { type Response } from 'express';

import { RuntimeContextUnavailableError } from '../database/runtime-context.error';
import { INSTITUTIONAL_ERROR_CODES } from '../institutional-auth/institutional-auth.contract';
import { HospitalSchedulerGuard } from '../institutional-auth/hospital-scheduler.guard';
import {
  institutionalPrincipalOf,
  type RequestWithInstitutionalPrincipal,
} from '../institutional-auth/municipal-viewer.guard';

import {
  HOSPITAL_ENGAGEMENT_TYPES,
  HOSPITAL_OPERATIONS_ERROR_CODES,
  HOSPITAL_PROFESSIONAL_PAGE_SIZES,
  HOSPITAL_PROFESSIONAL_SORT_FIELDS,
  HOSPITAL_PROFESSIONAL_STATUSES,
  HOSPITAL_PROFESSION_CODES,
  HOSPITAL_SORT_DIRECTIONS,
} from './hospital.contract';
import {
  HospitalOperationsErrorDto,
  HospitalProfessionalDetailDto,
  HospitalProfessionalListDto,
} from './hospital-professionals.dto';
import {
  HospitalOperationsQueryError,
  parseProfessionalDetailQuery,
  parseProfessionalsListQuery,
  type RawOperationsQuery,
} from './hospital-professionals.query';
import {
  HospitalProfessionalsService,
  type HospitalOperationsContext,
} from './hospital-professionals.service';
import { HOSPITAL_UUID_PATTERN } from './hospital-appointment-assignment.request';

/**
 * Directorio hospitalario de Profesionales (TASK-HOSPITAL-CORE-02 §6.1).
 *
 * Dos lecturas, ambas de SOLO LECTURA:
 * - `GET /api/v1/hospital/professionals`                  directorio paginado;
 * - `GET /api/v1/hospital/professionals/:professionalId`  detalle del panel.
 *
 * No existe creación, edición, archivado, importación, exportación ni descarga
 * de profesionales: el alta se difiere a una Task posterior y aquí NO se abre
 * ninguna puerta administrativa. Ninguna ruta acepta `tenantId`, `identityId`
 * ni `personId`: el contexto institucional lo resuelve ÍNTEGRAMENTE el servidor.
 */
@ApiTags('hospital')
@Controller('api/v1/hospital/professionals')
@UseGuards(HospitalSchedulerGuard)
export class HospitalProfessionalsController {
  private readonly logger = new Logger(HospitalProfessionalsController.name);

  constructor(
    @Inject(HospitalProfessionalsService)
    private readonly professionals: HospitalProfessionalsService,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    operationId: 'listHospitalProfessionals',
    summary: 'Directorio paginado de profesionales del tenant institucional activo',
    description:
      'Devuelve identidad minimizada, profesión controlada, estado del perfil, vínculo activo ' +
      'declarado y tres cifras DERIVADAS de los registros persistidos: personas con asignación ' +
      'activa, citas registradas hoy y próxima cita registrada. NO devuelve documento, ' +
      'contacto, dirección, calificación, disponibilidad, salario, honorarios ni documentos: ' +
      'ninguno de esos dominios está modelado y publicarlos los haría pasar por datos reales.',
  })
  @ApiQuery({ name: 'page', required: false, schema: { type: 'integer', minimum: 1 } })
  @ApiQuery({
    name: 'pageSize',
    required: false,
    schema: { type: 'integer', enum: [...HOSPITAL_PROFESSIONAL_PAGE_SIZES] },
  })
  @ApiQuery({ name: 'search', required: false, schema: { type: 'string', maxLength: 100 } })
  @ApiQuery({
    name: 'professionCode',
    required: false,
    schema: { type: 'string', enum: [...HOSPITAL_PROFESSION_CODES] },
  })
  @ApiQuery({
    name: 'affiliationType',
    required: false,
    schema: { type: 'string', enum: [...HOSPITAL_ENGAGEMENT_TYPES] },
  })
  @ApiQuery({
    name: 'status',
    required: false,
    schema: { type: 'string', enum: [...HOSPITAL_PROFESSIONAL_STATUSES] },
  })
  @ApiQuery({
    name: 'sort',
    required: false,
    schema: { type: 'string', enum: [...HOSPITAL_PROFESSIONAL_SORT_FIELDS] },
  })
  @ApiQuery({
    name: 'direction',
    required: false,
    schema: { type: 'string', enum: [...HOSPITAL_SORT_DIRECTIONS] },
  })
  @ApiOkResponse({ description: 'Página del directorio.', type: HospitalProfessionalListDto })
  @ApiBadRequestResponse({
    description: 'Parámetro desconocido, repetido, mal formado o fuera de rango.',
    type: HospitalOperationsErrorDto,
  })
  @ApiUnauthorizedResponse({
    description:
      'Sin sesión institucional vigente. La respuesta es idéntica ante ausencia, expiración, ' +
      'revocación o manipulación, y no confirma la existencia de ningún dato.',
    type: HospitalOperationsErrorDto,
  })
  @ApiForbiddenResponse({
    description:
      'La identidad institucional carece del rol de agenda hospitalaria. Una sesión municipal ' +
      'y una sesión de consulta de Pacientes caen exactamente en este caso.',
    type: HospitalOperationsErrorDto,
  })
  public async list(
    @Req() request: RequestWithInstitutionalPrincipal,
    @Res({ passthrough: true }) response: Response,
    @Query() query: RawOperationsQuery,
  ): Promise<HospitalProfessionalListDto> {
    const context = this.contextoDe(request, 'GET /api/v1/hospital/professionals');
    const parsed = this.validado(() => parseProfessionalsListQuery(query));

    noStore(response);

    const page = await this.protegido(() => this.professionals.list(context, parsed));

    return page as unknown as HospitalProfessionalListDto;
  }

  @Get(':professionalId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    operationId: 'getHospitalProfessional',
    summary: 'Detalle de un profesional del tenant institucional activo',
    description:
      'Devuelve lo mismo que el directorio, más las personas de sus asignaciones ACTIVAS y sus ' +
      'citas dentro de la ventana consultada. La ventana es opcional y su valor por defecto es ' +
      'el día actual del SERVIDOR. Aparecer en «pacientes a cargo» NO acredita necesidad ' +
      'individual de conocer ni concede acceso a información clínica.',
  })
  @ApiParam({
    name: 'professionalId',
    description: 'Identificador OPACO del profesional. Un identificador mal formado produce 400.',
    schema: { type: 'string', format: 'uuid' },
  })
  @ApiQuery({
    name: 'from',
    required: false,
    schema: { type: 'string', format: 'date' },
    description: 'Primer día UTC de la ventana. Exige enviar también `to`.',
  })
  @ApiQuery({
    name: 'to',
    required: false,
    schema: { type: 'string', format: 'date' },
    description: 'Último día UTC inclusive. La ventana no puede superar 31 días.',
  })
  @ApiOkResponse({ description: 'Detalle del profesional.', type: HospitalProfessionalDetailDto })
  @ApiBadRequestResponse({
    description: 'Identificador o ventana mal formados.',
    type: HospitalOperationsErrorDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Sin sesión institucional vigente.',
    type: HospitalOperationsErrorDto,
  })
  @ApiForbiddenResponse({
    description: 'Sin el rol de agenda hospitalaria.',
    type: HospitalOperationsErrorDto,
  })
  @ApiNotFoundResponse({
    description:
      'El profesional no existe O no pertenece a la institución de la sesión. La respuesta es ' +
      'IDÉNTICA en ambos casos: nunca confirma la existencia de un registro de otro tenant.',
    type: HospitalOperationsErrorDto,
  })
  public async detail(
    @Req() request: RequestWithInstitutionalPrincipal,
    @Res({ passthrough: true }) response: Response,
    @Param('professionalId') professionalId: string,
    @Query() query: RawOperationsQuery,
  ): Promise<HospitalProfessionalDetailDto> {
    const context = this.contextoDe(
      request,
      'GET /api/v1/hospital/professionals/:professionalId',
    );

    if (!HOSPITAL_UUID_PATTERN.test(professionalId)) {
      throw new BadRequestException({
        code: HOSPITAL_OPERATIONS_ERROR_CODES.invalidQuery,
        message: 'El identificador solicitado no tiene una forma válida.',
      });
    }

    const window = this.validado(() => parseProfessionalDetailQuery(query, context.now));

    noStore(response);

    const detail = await this.protegido(() =>
      this.professionals.detail(context, professionalId, window),
    );

    if (detail === null) {
      throw new NotFoundException({
        code: HOSPITAL_OPERATIONS_ERROR_CODES.professionalNotFound,
        message: 'No fue posible encontrar el profesional indicado.',
      });
    }

    return detail as unknown as HospitalProfessionalDetailDto;
  }

  /**
   * Contexto de la petición, con el principal que el guard ya validó.
   *
   * Si faltara —imposible con el guard activo— se deniega en lugar de continuar
   * con un contexto incompleto: denegación por defecto también aquí.
   */
  private contextoDe(
    request: RequestWithInstitutionalPrincipal,
    endpoint: string,
  ): HospitalOperationsContext {
    const principal = institutionalPrincipalOf(request);

    if (principal === null || principal.role !== 'HOSPITAL_SCHEDULER') {
      throw new UnauthorizedException({
        code: INSTITUTIONAL_ERROR_CODES.sessionRequired,
        message: 'No hay una sesión institucional vigente.',
      });
    }

    return { principal, correlationId: randomUUID(), endpoint, now: new Date() };
  }

  /** Traduce un error de validación al envelope estable del contrato. */
  private validado<T>(parse: () => T): T {
    try {
      return parse();
    } catch (error) {
      if (error instanceof HospitalOperationsQueryError) {
        throw new BadRequestException({
          code: HOSPITAL_OPERATIONS_ERROR_CODES.invalidQuery,
          // Nombra el parámetro y la regla; nunca devuelve el valor recibido.
          message: error.message,
        });
      }

      throw error;
    }
  }

  /**
   * FAIL-CLOSED: si la API no confirma el contexto de ejecución seguro, la
   * petición termina en error controlado. El detalle queda en el registro del
   * servidor y el cliente no recibe SQL, rol, esquema ni topología.
   */
  private async protegido<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
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

/** Ninguna respuesta hospitalaria puede quedar en una caché compartida. */
export function noStore(response: Response): void {
  response.setHeader('Cache-Control', 'private, no-store');
  response.setHeader('Pragma', 'no-cache');
  response.setHeader('Vary', 'Cookie');
}
