import { randomUUID } from 'node:crypto';

import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Logger,
  Req,
  Res,
  ServiceUnavailableException,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
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

import { MunicipalAggregateAccessGuard } from './municipal-aggregate-access.guard';
import { MUNICIPALITY_ERROR_CODES } from './municipality.contract';
import {
  MunicipalityErrorDto,
  PopulationSummaryDto,
  TerritorySummaryDto,
} from './municipality.dto';
import {
  type MunicipalRequestContext,
  MunicipalityService,
} from './municipality.service';

/**
 * Superficie municipal agregada (TASK-MUNICIPALITY-CORE-01, FR-01 y FR-02).
 *
 * Solo dos lecturas, ambas AGREGADAS:
 * - `GET /api/v1/municipality/population-summary`
 * - `GET /api/v1/municipality/territory-summary`
 *
 * No existe listado de personas, no existe búsqueda, no existe filtro
 * arbitrario, no existe exportación y no existe drill-down. Ninguna ruta acepta
 * `tenantId`, municipio, identificador ni parámetro de consulta: el contexto lo
 * resuelve íntegramente el servidor.
 *
 * `Cache-Control: private, no-store` es obligatorio mientras no exista un
 * diseño de caché seguro aprobado: una respuesta municipal no debe quedar en
 * ninguna caché compartida entre instituciones o personas usuarias.
 */
@ApiTags('municipality')
@Controller('api/v1/municipality')
@UseGuards(MunicipalAggregateAccessGuard)
export class MunicipalityController {
  private readonly logger = new Logger(MunicipalityController.name);

  constructor(
    @Inject(MunicipalityService) private readonly municipality: MunicipalityService,
  ) {}

  @Get('population-summary')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    operationId: 'getMunicipalPopulationSummary',
    summary: 'Agregado de población beneficiaria registrada',
    description:
      'Devuelve beneficiarios únicos, las tres poblaciones y las siete combinaciones exclusivas ' +
      'del tenant resuelto en el servidor. La edad se deriva de la fecha de nacimiento contra la ' +
      'fecha de corte. Los grupos pequeños se protegen: de 1 a 4 personas se publica «menos de 5». ' +
      'Las métricas que exigirían una fuente oficial externa se declaran no disponibles. ' +
      'No devuelve ningún dato individual.',
  })
  @ApiOkResponse({
    description: 'Agregado de población del tenant activo.',
    type: PopulationSummaryDto,
  })
  @ApiUnauthorizedResponse({
    description:
      'Sin sesión institucional vigente. La respuesta es idéntica ante ausencia, expiración, ' +
      'revocación o manipulación, y no confirma la existencia de ningún dato.',
    type: MunicipalityErrorDto,
  })
  @ApiForbiddenResponse({
    description: 'La identidad institucional carece del rol de consulta municipal.',
    type: MunicipalityErrorDto,
  })
  public async populationSummary(
    @Req() request: RequestWithInstitutionalPrincipal,
    @Res({ passthrough: true }) response: Response,
  ): Promise<PopulationSummaryDto> {
    const context = this.contextoDe(request, 'GET /api/v1/municipality/population-summary');

    noStore(response);

    const summary = await this.protegido(() =>
      this.municipality.populationSummary(context),
    );

    return summary as unknown as PopulationSummaryDto;
  }

  @Get('territory-summary')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    operationId: 'getMunicipalTerritorySummary',
    summary: 'Agregado territorial de las personas registradas',
    description:
      'Devuelve la jerarquía Municipio → Urbana/Rural → Barrio o vereda canónico con personas ' +
      'registradas, 60 años o más, discapacidad declarada, cuidado en casa declarado y registros ' +
      'pendientes de normalización territorial. No devuelve dirección, texto declarado, ' +
      'coordenada ni identificador de persona, y no admite drill-down.',
  })
  @ApiOkResponse({
    description: 'Agregado territorial del tenant activo.',
    type: TerritorySummaryDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Sin sesión institucional vigente.',
    type: MunicipalityErrorDto,
  })
  @ApiForbiddenResponse({
    description: 'La identidad institucional carece del rol de consulta municipal.',
    type: MunicipalityErrorDto,
  })
  public async territorySummary(
    @Req() request: RequestWithInstitutionalPrincipal,
    @Res({ passthrough: true }) response: Response,
  ): Promise<TerritorySummaryDto> {
    const context = this.contextoDe(request, 'GET /api/v1/municipality/territory-summary');

    noStore(response);

    const summary = await this.protegido(() =>
      this.municipality.territorySummary(context),
    );

    return summary as unknown as TerritorySummaryDto;
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
  ): MunicipalRequestContext {
    const principal = institutionalPrincipalOf(request);

    if (principal === null) {
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
          code: MUNICIPALITY_ERROR_CODES.internal,
          message: 'El servicio no está disponible en este momento.',
        });
      }

      throw error;
    }
  }
}

/** Ninguna respuesta municipal puede quedar en una caché compartida. */
function noStore(response: Response): void {
  response.setHeader('Cache-Control', 'private, no-store');
  response.setHeader('Pragma', 'no-cache');
  response.setHeader('Vary', 'Cookie');
}
