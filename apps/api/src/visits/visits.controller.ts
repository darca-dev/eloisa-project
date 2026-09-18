import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Logger,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
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
  ApiQuery,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { type Response } from 'express';

import { RuntimeContextUnavailableError } from '../database/runtime-context.error';
import { HUMAN_AUTH_ERROR_CODES } from '../human-auth/human-auth.contract';
import {
  HumanSessionGuard,
  noStore,
  type RequestWithHumanSession,
} from '../human-auth/human-session.guard';
import { SameOriginGuard } from '../human-auth/same-origin.guard';
import { humanPrincipalOf } from '../identity-access/human-principal';
import { HospitalSchedulerGuard } from '../institutional-auth/hospital-scheduler.guard';
import { INSTITUTIONAL_ERROR_CODES } from '../institutional-auth/institutional-auth.contract';
import { InstitutionalSameOriginGuard } from '../institutional-auth/institutional-same-origin.guard';
import {
  institutionalPrincipalOf,
  type RequestWithInstitutionalPrincipal,
} from '../institutional-auth/municipal-viewer.guard';

import {
  HomeVisitMaterializationError,
  HomeVisitMaterializationService,
} from './home-visit-materialization.service';
import {
  HomeVisitTransitionError,
  HomeVisitTransitionService,
} from './home-visit-transition.service';
import { ProfessionalVisitQueryService } from './professional-visit-query.service';
import { ProfessionalVisitWorklistService } from './professional-visit-worklist.service';
import {
  HomeVisitStatusChangeRequestDto,
  HomeVisitTransitionResultDto,
  MaterializeHomeVisitRequestDto,
  MaterializedHomeVisitDto,
  parseMaterializeBody,
  parseStatusChangeBody,
  parseWorklistQuery,
  PROFESSIONAL_WORKLIST_MAX_WINDOW_DAYS,
  ProfessionalHomeVisitDto,
  ProfessionalVisitWorklistDto,
  VISITS_API_ERROR_CODES,
  VISITS_UUID_PATTERN,
  VisitsBodyError,
  VisitsErrorDto,
  VisitsQueryError,
} from './visits.dto';

/**
 * Superficie HTTP de Visitas domiciliarias (VISITS-CORE-01 MP04).
 *
 * CUATRO rutas y ninguna más:
 *
 * - `POST  /api/v1/visits/materialize`                    institucional;
 * - `GET   /api/v1/professional/visits`                   profesional (MP01);
 * - `GET   /api/v1/professional/visits/:visitId`          profesional;
 * - `PATCH /api/v1/professional/visits/:visitId/status`   profesional.
 *
 * VISITADOR-CORE-01 MP01 añade la CUARTA: la worklist de solo lectura que
 * permite a la persona profesional DESCUBRIR su propia agenda domiciliaria en
 * lugar de recibir identificadores desde Hospital o desde datos inventados. Es
 * estrictamente la superficie PROPIA: no enumera pacientes ajenos, no enumera
 * profesionales y no admite ningún filtro por el que preguntar por el trabajo de
 * otra persona.
 *
 * NO existe superficie de cuidador, superficie de paciente, notas, evidencia,
 * dirección, GPS, archivo ni cancelación. Todo eso queda expresamente FUERA de
 * MP04 y de MP01.
 *
 * DOS SUPERFICIES, DOS IDENTIDADES DISJUNTAS. Materializar es un acto
 * ADMINISTRATIVO de una identidad institucional OPACA con rol de agenda
 * hospitalaria; iniciar, completar o dar por no realizada una visita es el acto
 * de una PERSONA autenticada. Ninguna cookie sustituye a la otra: la superficie
 * institucional lee EXCLUSIVAMENTE `merdn_institutional_session` y la
 * profesional EXCLUSIVAMENTE `merdn_human_session`. Presentar las tres cookies
 * del sistema a la vez no produce un principal ambiguo, porque cada guard mira
 * solo la suya y las demás son inertes.
 *
 * ESTA CAPA NO CONTIENE DOMINIO. Delega íntegramente en los servicios ya
 * aprobados de MP02 y MP03 y en la lectura autorizada de MP04: no reimplementa
 * la máquina de transiciones, no repite sus reglas de autorización y no traduce
 * sus desenlaces a códigos nuevos.
 */

/** Ruta base de la materialización institucional. */
export const VISITS_MATERIALIZE_PATH = 'api/v1/visits';

/** Ruta base de la superficie profesional. */
export const PROFESSIONAL_VISITS_PATH = 'api/v1/professional/visits';

@ApiTags('visits')
@Controller(VISITS_MATERIALIZE_PATH)
/*
 * DEFENSA EN PROFUNDIDAD sobre una mutación con cookie:
 *   1. `HospitalSchedulerGuard` exige sesión institucional vigente CON el rol
 *      exacto —denegación por defecto— y fija las cabeceras de no-caché antes
 *      de decidir nada;
 *   2. `InstitutionalSameOriginGuard` exige que la petición proceda de un
 *      origen web configurado, para que una página ajena no pueda provocar la
 *      escritura con la cookie que el navegador adjunta solo;
 *   3. la allowlist del cuerpo rechaza cualquier campo no previsto;
 *   4. el servicio ejecuta todo dentro de `withTenant()`, con filtro explícito
 *      por tenant, Row Level Security y auditoría atómica.
 */
@UseGuards(HospitalSchedulerGuard, InstitutionalSameOriginGuard)
export class VisitsMaterializationController {
  private readonly logger = new Logger(VisitsMaterializationController.name);

  constructor(
    @Inject(HomeVisitMaterializationService)
    private readonly materialization: HomeVisitMaterializationService,
  ) {}

  @Post('materialize')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    operationId: 'materializeHomeVisit',
    summary: 'Materializa la visita domiciliaria de una cita HOME ya ASSIGNED',
    description:
      'Crea la visita en estado SCHEDULED, su transición de CREACIÓN y su evento de auditoría ' +
      'en UNA sola transacción. El tenant, la identidad, el rol y el instante los resuelve el ' +
      'SERVIDOR desde la sesión institucional: el cliente envía EXCLUSIVAMENTE el ' +
      'identificador de la cita. El acto se atribuye a la identidad institucional OPACA que ' +
      'operó, NUNCA a la persona visitadora, y NO afirma que la atención se haya prestado: ' +
      'una visita nace sin inicio y sin fin. Una cita materializa como mucho UNA visita. NO ' +
      'crea citas, NO reprograma, NO cancela, NO asigna profesionales y NO aplica ninguna ' +
      'regla clínica.',
  })
  @ApiBody({ type: MaterializeHomeVisitRequestDto })
  @ApiCreatedResponse({
    description: 'Visita materializada, con su transición de creación.',
    type: MaterializedHomeVisitDto,
  })
  @ApiBadRequestResponse({
    description: 'Cuerpo ausente, con campos desconocidos o mal formados.',
    type: VisitsErrorDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Sin sesión institucional vigente.',
    type: VisitsErrorDto,
  })
  @ApiForbiddenResponse({
    description:
      'Sin el rol de agenda hospitalaria, o petición procedente de un origen web no ' +
      'configurado.',
    type: VisitsErrorDto,
  })
  @ApiNotFoundResponse({
    description:
      'La cita no existe o no pertenece a la institución de la sesión. La respuesta es ' +
      'IDÉNTICA en ambos casos: nunca confirma la existencia de un registro ajeno.',
    type: VisitsErrorDto,
  })
  @ApiConflictResponse({
    description:
      'HOME_VISIT_APPOINTMENT_NOT_MATERIALIZABLE cuando la modalidad, el estado o la ' +
      'asignación de la cita no la admiten; HOME_VISIT_ALREADY_MATERIALIZED cuando esa cita ya ' +
      'materializó su visita. Ninguno describe qué regla concreta falló.',
    type: VisitsErrorDto,
  })
  @ApiServiceUnavailableResponse({
    description: 'Contexto de ejecución seguro no confirmado. Fail-closed.',
    type: VisitsErrorDto,
  })
  public async materialize(
    @Req() request: RequestWithInstitutionalPrincipal,
    @Res({ passthrough: true }) response: Response,
    @Body() body: unknown,
  ): Promise<MaterializedHomeVisitDto> {
    const principal = institutionalPrincipalOf(request);

    if (principal === null || principal.role !== 'HOSPITAL_SCHEDULER') {
      // Inalcanzable con el guard activo; defensa explícita.
      throw new UnauthorizedException({
        code: INSTITUTIONAL_ERROR_CODES.sessionRequired,
        message: 'No hay una sesión institucional vigente.',
      });
    }

    const { appointmentId } = analizar(() => parseMaterializeBody(body));

    noStore(response);

    return this.protegido(() =>
      this.materialization.materialize(
        {
          tenantId: principal.tenantId,
          identityId: principal.identityId,
          role: principal.role,
          // El instante lo fija el SERVIDOR: el cuerpo no lo admite.
          now: new Date(),
        },
        appointmentId,
      ),
    );
  }

  /**
   * Traduce los desenlaces de dominio y el contexto inseguro a la respuesta
   * estable del contrato. FAIL-CLOSED ante contexto de ejecución no confirmado.
   */
  private async protegido<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if (error instanceof HomeVisitMaterializationError) {
        const cuerpo = { code: error.code, message: error.message };

        throw error.status === 404
          ? new NotFoundException(cuerpo)
          : new ConflictException(cuerpo);
      }

      throw traducirContexto(error, this.logger);
    }
  }
}

@ApiTags('visits')
@Controller(PROFESSIONAL_VISITS_PATH)
/*
 * `HumanSessionGuard` en TODA la superficie: sin sesión humana vigente no se
 * ejecuta el controlador y, por tanto, no se toca ningún dato. El guard también
 * fija las cabeceras de no-caché antes de decidir, de modo que las lleva también
 * el `401`.
 *
 * El principal se lee EXCLUSIVAMENTE de la petición que el guard pobló, bajo una
 * clave simbólica que ningún cuerpo, consulta ni cabecera puede inyectar.
 */
@UseGuards(HumanSessionGuard)
export class ProfessionalVisitsController {
  private readonly logger = new Logger(ProfessionalVisitsController.name);

  constructor(
    @Inject(ProfessionalVisitQueryService)
    private readonly visits: ProfessionalVisitQueryService,
    @Inject(ProfessionalVisitWorklistService)
    private readonly worklist: ProfessionalVisitWorklistService,
    @Inject(HomeVisitTransitionService)
    private readonly transitions: HomeVisitTransitionService,
  ) {}

  /*
   * SE DECLARA ANTES QUE `:visitId` a propósito. La ruta de colección no tiene
   * segmento y por tanto no colisiona con la de detalle, pero declararla primero
   * hace la precedencia explícita en lugar de depender del orden de registro.
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    operationId: 'listProfessionalVisitWorklist',
    summary: 'Lista las citas domiciliarias asignadas a la persona autenticada',
    description:
      'Devuelve las citas HOME ya ASSIGNED de las asignaciones de cuidado ACTIVAS y VIGENTES ' +
      'de la persona autenticada dentro de la ventana declarada, con la visita domiciliaria ' +
      'correspondiente cuando la agenda hospitalaria ya la materializó. La autorización se ' +
      'resuelve ENTERA en el servidor desde la persona de la sesión: perfil ACTIVE, afiliación ' +
      'ACTIVE y vigente, y asignación ACTIVE y vigente. El cliente NO envía —y no puede ' +
      'enviar— institución, profesional, paciente, asignación, estado, actor ni rol: lo único ' +
      'que aporta es la ventana de calendario. Una persona sin perfil, sin afiliación vigente, ' +
      'sin asignaciones o sin citas recibe una lista VACÍA, que nunca revela si otra persona ' +
      'sí las tiene. `visit: null` significa que la cita todavía NO está materializada y NO ' +
      'autoriza a la persona profesional a materializarla. La respuesta es MINIMIZADA: no ' +
      'lleva institución, profesional, paciente, asignación, documento, fecha de nacimiento, ' +
      'contacto, dirección, diagnóstico, alerta ni ningún dato clínico, y no aplica ninguna ' +
      'regla clínica.',
  })
  @ApiQuery({
    name: 'from',
    required: true,
    description: 'Primer día UTC de la ventana, en forma AAAA-MM-DD.',
    schema: { type: 'string', example: '2026-08-24' },
  })
  @ApiQuery({
    name: 'to',
    required: true,
    description:
      'Último día UTC de la ventana, inclusive. La ventana no puede estar invertida ni ' +
      `abarcar más de ${PROFESSIONAL_WORKLIST_MAX_WINDOW_DAYS} días.`,
    schema: { type: 'string', example: '2026-08-24' },
  })
  @ApiOkResponse({
    description: 'Worklist de la ventana solicitada. Puede estar vacía.',
    type: ProfessionalVisitWorklistDto,
  })
  @ApiBadRequestResponse({
    description:
      'Ventana ausente, repetida, mal formada, inexistente en el calendario, invertida, ' +
      'demasiado amplia, o con un parámetro no admitido.',
    type: VisitsErrorDto,
  })
  @ApiUnauthorizedResponse({
    description: 'No hay una sesión vigente.',
    type: VisitsErrorDto,
  })
  @ApiServiceUnavailableResponse({
    description: 'Contexto de ejecución seguro no confirmado. Fail-closed.',
    type: VisitsErrorDto,
  })
  public async list(
    @Req() request: RequestWithHumanSession,
    @Res({ passthrough: true }) response: Response,
    @Query() query: unknown,
  ): Promise<ProfessionalVisitWorklistDto> {
    const principal = principalDe(request);

    const window = analizarConsulta(() => parseWorklistQuery(query));

    noStore(response);

    return this.protegido(() =>
      // El instante lo fija el SERVIDOR: la consulta no lo admite.
      this.worklist.listAuthorized(principal, window, new Date()),
    );
  }

  @Get(':visitId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    operationId: 'getProfessionalHomeVisit',
    summary: 'Consulta una visita domiciliaria asignada a la persona autenticada',
    description:
      'Devuelve UNA visita conocida por su identificador, y solo si la persona autenticada es ' +
      'su profesional asignada y vigente. La autorización se resuelve ENTERA en el servidor ' +
      'desde la persona de la sesión: perfil ACTIVE, afiliación ACTIVE y vigente, y asignación ' +
      'de cuidado ACTIVE y vigente. El cliente NO envía profesional, paciente ni institución. ' +
      'NO existe listado ni búsqueda: enumerar visitas revelaría a quién atiende quién. La ' +
      'respuesta es OPACA y no lleva paciente, profesional, persona, horario, dirección ni ' +
      'dato clínico.',
  })
  @ApiParam({
    name: 'visitId',
    description: 'Identificador OPACO de la visita. Un identificador mal formado produce 400.',
    schema: { type: 'string', format: 'uuid' },
  })
  @ApiOkResponse({ description: 'Visita autorizada.', type: ProfessionalHomeVisitDto })
  @ApiBadRequestResponse({
    description: 'Identificador mal formado.',
    type: VisitsErrorDto,
  })
  @ApiUnauthorizedResponse({
    description: 'No hay una sesión vigente.',
    type: VisitsErrorDto,
  })
  @ApiNotFoundResponse({
    description:
      'La visita no existe, pertenece a otra institución, o la persona autenticada no es su ' +
      'profesional asignada y vigente. La respuesta es IDÉNTICA en los tres casos.',
    type: VisitsErrorDto,
  })
  @ApiServiceUnavailableResponse({
    description: 'Contexto de ejecución seguro no confirmado. Fail-closed.',
    type: VisitsErrorDto,
  })
  public async find(
    @Req() request: RequestWithHumanSession,
    @Res({ passthrough: true }) response: Response,
    @Param('visitId') visitId: string,
  ): Promise<ProfessionalHomeVisitDto> {
    const principal = principalDe(request);

    exigirIdentificador(visitId);

    noStore(response);

    return this.protegido(() => this.visits.findAuthorized(principal, visitId, new Date()));
  }

  @Patch(':visitId/status')
  @HttpCode(HttpStatus.OK)
  /*
   * La sesión viaja en una cookie que el navegador adjunta sola: sin la
   * comprobación de origen, una página ajena podría iniciar o cerrar la visita
   * de otra persona con solo tener la sesión abierta.
   */
  @UseGuards(SameOriginGuard)
  @ApiOperation({
    operationId: 'changeProfessionalHomeVisitStatus',
    summary: 'Inicia, completa o da por no realizada una visita asignada',
    description:
      'Ejecuta la transición PROFESIONAL sobre una visita ya materializada, con control ' +
      'optimista de versión, historial APPEND-ONLY y auditoría, todo en UNA transacción. La ' +
      'máquina es CERRADA y los estados terminales son inmutables: no hay reapertura, ' +
      'reversión ni cancelación. El actor es la CUENTA HUMANA autenticada y los instantes los ' +
      'fija el SERVIDOR: el cuerpo NO admite profesional, paciente, institución, actor, rol ni ' +
      'marca de tiempo. NO registra motivo, nota, diagnóstico, evidencia, GPS, firma ni ' +
      'archivo —MERDN no tiene aprobado ningún catálogo de causas— y NO aplica ninguna regla ' +
      'clínica.',
  })
  @ApiParam({
    name: 'visitId',
    description: 'Identificador OPACO de la visita. Un identificador mal formado produce 400.',
    schema: { type: 'string', format: 'uuid' },
  })
  @ApiBody({ type: HomeVisitStatusChangeRequestDto })
  @ApiOkResponse({
    description: 'Transición ejecutada, con su versión ya incrementada.',
    type: HomeVisitTransitionResultDto,
  })
  @ApiBadRequestResponse({
    description:
      'Identificador mal formado, cuerpo ausente, con campos desconocidos, estado no admitido ' +
      'o versión que no es un entero positivo.',
    type: VisitsErrorDto,
  })
  @ApiUnauthorizedResponse({
    description: 'No hay una sesión vigente.',
    type: VisitsErrorDto,
  })
  @ApiForbiddenResponse({
    description: 'La petición no procede de un origen autorizado.',
    type: VisitsErrorDto,
  })
  @ApiNotFoundResponse({
    description:
      'La visita no existe, pertenece a otra institución, o la persona autenticada no es su ' +
      'profesional asignada y vigente. La respuesta es IDÉNTICA en los tres casos.',
    type: VisitsErrorDto,
  })
  @ApiConflictResponse({
    description:
      'HOME_VISIT_TRANSITION_NOT_ALLOWED cuando el estado actual no admite esa transición o ya ' +
      'es terminal; HOME_VISIT_VERSION_CONFLICT cuando la versión enviada no es la vigente. ' +
      'Ninguno revela el estado ni la versión reales de la visita.',
    type: VisitsErrorDto,
  })
  @ApiServiceUnavailableResponse({
    description: 'Contexto de ejecución seguro no confirmado. Fail-closed.',
    type: VisitsErrorDto,
  })
  public async changeStatus(
    @Req() request: RequestWithHumanSession,
    @Res({ passthrough: true }) response: Response,
    @Param('visitId') visitId: string,
    @Body() body: unknown,
  ): Promise<HomeVisitTransitionResultDto> {
    const principal = principalDe(request);

    exigirIdentificador(visitId);

    const { status, expectedVersion } = analizar(() => parseStatusChangeBody(body));

    noStore(response);

    return this.protegido(() =>
      this.transitions.transition(
        principal,
        visitId,
        status,
        expectedVersion,
        // El instante lo fija el SERVIDOR: el cuerpo no lo admite.
        new Date(),
      ),
    );
  }

  private async protegido<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if (error instanceof HomeVisitTransitionError) {
        const cuerpo = { code: error.code, message: error.message };

        throw error.status === 404
          ? new NotFoundException(cuerpo)
          : new ConflictException(cuerpo);
      }

      throw traducirContexto(error, this.logger);
    }
  }
}

/**
 * Principal humano adjuntado por el guard.
 *
 * NUNCA lo construye el controlador: solo el validador de sesión puede crearlo,
 * y esa es la garantía que impide fabricar una identidad desde una petición.
 */
function principalDe(request: RequestWithHumanSession) {
  const principal = humanPrincipalOf(request);

  if (principal === null) {
    // Inalcanzable con el guard activo; defensa explícita.
    throw new UnauthorizedException({
      code: HUMAN_AUTH_ERROR_CODES.sessionRequired,
      message: 'No hay una sesión vigente.',
    });
  }

  return principal;
}

/** Un identificador mal formado no llega a la base: se rechaza en el borde. */
function exigirIdentificador(visitId: string): void {
  if (!VISITS_UUID_PATTERN.test(visitId)) {
    throw new BadRequestException({
      code: VISITS_API_ERROR_CODES.invalidPath,
      message: 'El identificador solicitado no tiene una forma válida.',
    });
  }
}

/** Convierte el rechazo del cuerpo en `400`, nombrando el campo y no su valor. */
function analizar<T>(parse: () => T): T {
  try {
    return parse();
  } catch (error) {
    if (error instanceof VisitsBodyError) {
      throw new BadRequestException({
        code: VISITS_API_ERROR_CODES.invalidBody,
        message: error.message,
      });
    }

    throw error;
  }
}

/**
 * Convierte el rechazo de la consulta en `400`, nombrando el parámetro y NUNCA
 * su valor: repetir lo recibido devolvería al cliente una fecha o un nombre de
 * campo que él mismo eligió, y en una respuesta de error acabaría reflejando
 * datos no controlados.
 */
function analizarConsulta<T>(parse: () => T): T {
  try {
    return parse();
  } catch (error) {
    if (error instanceof VisitsQueryError) {
      throw new BadRequestException({
        code: VISITS_API_ERROR_CODES.invalidQuery,
        message: error.message,
      });
    }

    throw error;
  }
}

/**
 * FAIL-CLOSED ante contexto de ejecución no confirmado.
 *
 * Si el rol runtime de mínimo privilegio, el tenant activo o Row Level Security
 * no pueden confirmarse, la petición termina en un error controlado que NO
 * describe la topología. Cualquier otro fallo se propaga sin traducir.
 */
function traducirContexto(error: unknown, logger: Logger): unknown {
  if (error instanceof RuntimeContextUnavailableError) {
    logger.error(error.message);

    return new ServiceUnavailableException({
      code: VISITS_API_ERROR_CODES.unavailable,
      message: 'El servicio no está disponible en este momento.',
    });
  }

  return error;
}
