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
import {
  institutionalPrincipalOf,
  type RequestWithInstitutionalPrincipal,
} from '../institutional-auth/municipal-viewer.guard';

import {
  HOSPITAL_AREA_TYPES,
  HOSPITAL_ERROR_CODES,
  HOSPITAL_PAGE_SIZES,
  HOSPITAL_PATIENT_STATUSES,
  HOSPITAL_POPULATION_FILTERS,
  HOSPITAL_SORT_DIRECTIONS,
  HOSPITAL_SORT_FIELDS,
} from './hospital.contract';
import { HospitalPatientAccessGuard } from './hospital-patient-access.guard';
import {
  HospitalErrorDto,
  HospitalPatientAnalyticsDto,
  HospitalPatientDetailDto,
  HospitalPatientListDto,
} from './hospital-patients.dto';
import {
  HospitalQueryError,
  parseAnalyticsQuery,
  parseListQuery,
  type RawQuery,
} from './hospital-patients.query';
import {
  type HospitalRequestContext,
  HospitalPatientsService,
} from './hospital-patients.service';

/**
 * Superficie hospitalaria de Pacientes (TASK-HOSPITAL-CORE-01 §8).
 *
 * Tres lecturas, todas de SOLO LECTURA:
 * - `GET /api/v1/hospital/patients`            listado paginado;
 * - `GET /api/v1/hospital/patients/analytics`  analítica del conjunto filtrado;
 * - `GET /api/v1/hospital/patients/:patientId` detalle minimizado.
 *
 * No existe creación, edición, archivado, importación, exportación, descarga ni
 * conciliación. Ninguna ruta acepta `tenantId`, `personId` ni selección de
 * columnas: el contexto institucional lo resuelve ÍNTEGRAMENTE el servidor.
 *
 * ORDEN DE LAS RUTAS: `analytics` se declara ANTES que `:patientId`. Sin esa
 * precedencia, `analytics` se interpretaría como un identificador y produciría
 * un `400` en lugar de la analítica.
 *
 * `Cache-Control: private, no-store` es obligatorio: una respuesta hospitalaria
 * es nominal y no debe quedar en ninguna caché compartida entre instituciones ni
 * entre personas usuarias.
 */
@ApiTags('hospital')
@Controller('api/v1/hospital/patients')
@UseGuards(HospitalPatientAccessGuard)
export class HospitalPatientsController {
  private readonly logger = new Logger(HospitalPatientsController.name);

  constructor(
    @Inject(HospitalPatientsService) private readonly patients: HospitalPatientsService,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    operationId: 'listHospitalPatients',
    summary: 'Listado paginado de pacientes del tenant institucional activo',
    description:
      'Devuelve identidad minimizada, edad derivada, EPS controlada, clasificaciones declaradas, ' +
      'territorio canónico y estado no clínico. La búsqueda, los filtros, el orden, el conteo y ' +
      'la paginación se resuelven en PostgreSQL dentro del contexto de tenant: el navegador NUNCA ' +
      'recibe la población completa. No devuelve contacto, dirección exacta, documento completo, ' +
      'texto territorial no verificado ni identificador de persona.',
  })
  @ApiQuery({ name: 'page', required: false, schema: { type: 'integer', minimum: 1 } })
  @ApiQuery({ name: 'pageSize', required: false, schema: { type: 'integer', enum: [...HOSPITAL_PAGE_SIZES] } })
  @ApiQuery({ name: 'search', required: false, schema: { type: 'string', maxLength: 100 } })
  @ApiQuery({ name: 'ageMin', required: false, schema: { type: 'integer', minimum: 0, maximum: 130 } })
  @ApiQuery({ name: 'ageMax', required: false, schema: { type: 'integer', minimum: 0, maximum: 130 } })
  @ApiQuery({ name: 'epsCode', required: false, schema: { type: 'string' } })
  @ApiQuery({ name: 'populationType', required: false, schema: { type: 'string', enum: [...HOSPITAL_POPULATION_FILTERS] } })
  @ApiQuery({ name: 'older60', required: false, schema: { type: 'string', enum: ['true', 'false'] } })
  @ApiQuery({ name: 'municipalityOfficialCode', required: false, schema: { type: 'string', pattern: '^\\d{5}$' } })
  @ApiQuery({ name: 'areaType', required: false, schema: { type: 'string', enum: [...HOSPITAL_AREA_TYPES] } })
  @ApiQuery({ name: 'patientStatus', required: false, schema: { type: 'string', enum: [...HOSPITAL_PATIENT_STATUSES] } })
  @ApiQuery({ name: 'sort', required: false, schema: { type: 'string', enum: [...HOSPITAL_SORT_FIELDS] } })
  @ApiQuery({ name: 'direction', required: false, schema: { type: 'string', enum: [...HOSPITAL_SORT_DIRECTIONS] } })
  @ApiOkResponse({ description: 'Página del conjunto filtrado.', type: HospitalPatientListDto })
  @ApiBadRequestResponse({
    description: 'Parámetro desconocido, repetido, mal formado o fuera de rango.',
    type: HospitalErrorDto,
  })
  @ApiUnauthorizedResponse({
    description:
      'Sin sesión institucional vigente. La respuesta es idéntica ante ausencia, expiración, ' +
      'revocación o manipulación, y no confirma la existencia de ningún dato.',
    type: HospitalErrorDto,
  })
  @ApiForbiddenResponse({
    description:
      'La identidad institucional carece del rol de consulta hospitalaria de Pacientes. Una ' +
      'sesión municipal válida cae exactamente en este caso.',
    type: HospitalErrorDto,
  })
  public async list(
    @Req() request: RequestWithInstitutionalPrincipal,
    @Res({ passthrough: true }) response: Response,
    @Query() query: RawQuery,
  ): Promise<HospitalPatientListDto> {
    const context = this.contextoDe(request, 'GET /api/v1/hospital/patients');
    const parsed = this.validado(() => parseListQuery(query));

    noStore(response);

    const page = await this.protegido(() => this.patients.list(context, parsed));

    return page as unknown as HospitalPatientListDto;
  }

  @Get('analytics')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    operationId: 'getHospitalPatientAnalytics',
    summary: 'Analítica del conjunto filtrado de pacientes',
    description:
      'Calcula, con las MISMAS condiciones normalizadas del listado, el universo activo y ' +
      'filtrado, cuatro indicadores, las distribuciones de edad, EPS, municipio y área, y las ' +
      'ocho intersecciones disjuntas. No devuelve indicador, distribución ni porcentaje de ' +
      'cuidadores, profesionales, patologías, programas, atenciones o alertas: esos dominios no ' +
      'existen en CORE-01 y su cifra no distinguiría «no tiene» de «no registrado».',
  })
  @ApiQuery({ name: 'search', required: false, schema: { type: 'string', maxLength: 100 } })
  @ApiQuery({ name: 'ageMin', required: false, schema: { type: 'integer', minimum: 0, maximum: 130 } })
  @ApiQuery({ name: 'ageMax', required: false, schema: { type: 'integer', minimum: 0, maximum: 130 } })
  @ApiQuery({ name: 'epsCode', required: false, schema: { type: 'string' } })
  @ApiQuery({ name: 'populationType', required: false, schema: { type: 'string', enum: [...HOSPITAL_POPULATION_FILTERS] } })
  @ApiQuery({ name: 'older60', required: false, schema: { type: 'string', enum: ['true', 'false'] } })
  @ApiQuery({ name: 'municipalityOfficialCode', required: false, schema: { type: 'string', pattern: '^\\d{5}$' } })
  @ApiQuery({ name: 'areaType', required: false, schema: { type: 'string', enum: [...HOSPITAL_AREA_TYPES] } })
  @ApiQuery({ name: 'patientStatus', required: false, schema: { type: 'string', enum: [...HOSPITAL_PATIENT_STATUSES] } })
  @ApiOkResponse({ description: 'Analítica del conjunto filtrado.', type: HospitalPatientAnalyticsDto })
  @ApiBadRequestResponse({
    description:
      'Parámetro desconocido, repetido, mal formado o fuera de rango. La analítica NO admite ' +
      'paginación ni orden: describe el conjunto filtrado completo, no una página.',
    type: HospitalErrorDto,
  })
  @ApiUnauthorizedResponse({ description: 'Sin sesión institucional vigente.', type: HospitalErrorDto })
  @ApiForbiddenResponse({ description: 'Sin el rol de consulta hospitalaria.', type: HospitalErrorDto })
  public async analytics(
    @Req() request: RequestWithInstitutionalPrincipal,
    @Res({ passthrough: true }) response: Response,
    @Query() query: RawQuery,
  ): Promise<HospitalPatientAnalyticsDto> {
    const context = this.contextoDe(request, 'GET /api/v1/hospital/patients/analytics');
    const filters = this.validado(() => parseAnalyticsQuery(query));

    noStore(response);

    const analytics = await this.protegido(() =>
      this.patients.analytics(context, filters),
    );

    return analytics as unknown as HospitalPatientAnalyticsDto;
  }

  @Get(':patientId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    operationId: 'getHospitalPatient',
    summary: 'Detalle minimizado de un paciente del tenant institucional activo',
    description:
      'Devuelve la identidad minimizada, el documento ENMASCARADO, la fecha de nacimiento, la ' +
      'edad derivada, la EPS controlada, las clasificaciones declaradas y el territorio canónico. ' +
      'NO devuelve teléfono, correo, dirección exacta, indicaciones, texto territorial no ' +
      'verificado, consentimiento, identificador de persona ni ningún dominio clínico.',
  })
  @ApiParam({
    name: 'patientId',
    description: 'Identificador OPACO del paciente. Un identificador mal formado produce 400.',
    schema: { type: 'string', format: 'uuid' },
  })
  @ApiOkResponse({ description: 'Detalle del paciente.', type: HospitalPatientDetailDto })
  @ApiBadRequestResponse({ description: 'Identificador mal formado.', type: HospitalErrorDto })
  @ApiUnauthorizedResponse({ description: 'Sin sesión institucional vigente.', type: HospitalErrorDto })
  @ApiForbiddenResponse({ description: 'Sin el rol de consulta hospitalaria.', type: HospitalErrorDto })
  @ApiNotFoundResponse({
    description:
      'El registro no existe O no pertenece a la institución de la sesión. La respuesta es ' +
      'IDÉNTICA en ambos casos: nunca confirma la existencia de un registro de otro tenant.',
    type: HospitalErrorDto,
  })
  public async detail(
    @Req() request: RequestWithInstitutionalPrincipal,
    @Res({ passthrough: true }) response: Response,
    @Param('patientId') patientId: string,
  ): Promise<HospitalPatientDetailDto> {
    const context = this.contextoDe(request, 'GET /api/v1/hospital/patients/:patientId');

    if (!UUID_PATTERN.test(patientId)) {
      throw new BadRequestException({
        code: HOSPITAL_ERROR_CODES.invalidQuery,
        message: 'El identificador solicitado no tiene una forma válida.',
      });
    }

    noStore(response);

    const detail = await this.protegido(() => this.patients.detail(context, patientId));

    if (detail === null) {
      throw new NotFoundException({
        code: HOSPITAL_ERROR_CODES.notFound,
        message: 'No fue posible encontrar el registro solicitado.',
      });
    }

    return detail as unknown as HospitalPatientDetailDto;
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
  ): HospitalRequestContext {
    const principal = institutionalPrincipalOf(request);

    if (principal === null || principal.role !== 'HOSPITAL_PATIENT_VIEWER') {
      throw new UnauthorizedException({
        code: INSTITUTIONAL_ERROR_CODES.sessionRequired,
        message: 'No hay una sesión institucional vigente.',
      });
    }

    return {
      principal,
      correlationId: randomUUID(),
      endpoint,
      now: new Date(),
    };
  }

  /** Traduce un error de validación al envelope estable del contrato. */
  private validado<T>(parse: () => T): T {
    try {
      return parse();
    } catch (error) {
      if (error instanceof HospitalQueryError) {
        throw new BadRequestException({
          code: HOSPITAL_ERROR_CODES.invalidQuery,
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
          code: HOSPITAL_ERROR_CODES.internal,
          message: 'El servicio no está disponible en este momento.',
        });
      }

      throw error;
    }
  }
}

/** Forma admitida del identificador opaco de paciente. */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

/** Ninguna respuesta hospitalaria puede quedar en una caché compartida. */
function noStore(response: Response): void {
  response.setHeader('Cache-Control', 'private, no-store');
  response.setHeader('Pragma', 'no-cache');
  response.setHeader('Vary', 'Cookie');
}
