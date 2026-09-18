import { randomUUID } from 'node:crypto';

import {
  Controller,
  ForbiddenException,
  Get,
  Inject,
  Logger,
  Req,
  ServiceUnavailableException,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { RuntimeContextUnavailableError } from '../database/runtime-context.error';
import {
  HumanSessionGuard,
  type RequestWithHumanSession,
} from '../human-auth/human-session.guard';
import { humanPrincipalOf } from '../identity-access/human-principal';

import {
  PATIENT_SELF_BASE_PATH,
  PATIENT_SELF_ERROR_CODES,
  type PatientSelfAppointmentView,
  type PatientSelfListView,
  type PatientSelfSummaryView,
  type PatientSelfVisitView,
} from './patient-self.contract';
import { PatientSelfAccessDeniedError, PatientSelfService } from './patient-self.service';

/**
 * Superficie HTTP self-scope del Paciente (spec 021 §6.6-e, §17.D-2;
 * `contracts/paciente-self-scope.contract.md`).
 *
 * TRES rutas de SOLO LECTURA y ninguna más:
 *
 * - `GET /api/v1/patient-self/summary`
 * - `GET /api/v1/patient-self/appointments`
 * - `GET /api/v1/patient-self/visits`
 *
 * La lista es CERRADA. Un cuarto endpoint, una variante de detalle, una ruta
 * parametrizada de cualquier forma o un método de escritura quedan fuera de la
 * spec y son STOP (§19.15). El único `POST` de la experiencia es el logout de la
 * sesión humana YA EXISTENTE, que este módulo no crea y no modifica.
 *
 * NINGÚN SELECTOR DE SUJETO, Y SE VE EN LA FIRMA. Los tres métodos reciben
 * EXCLUSIVAMENTE la petición, y de ella solo se lee el principal que adjuntó el
 * guard bajo una clave simbólica. No hay `@Param`, no hay `@Query`, no hay
 * `@Body` y no hay `@Headers`: `patientId`, `personId`, `subject`, documento,
 * tenant e institución no existen en la firma, luego no se pueden pasar por
 * descuido. Si llegaran igualmente en la consulta, en el cuerpo o en una
 * cabecera, NADA los lee: la respuesta es idéntica a la de una petición sin
 * ellos, sin validarlos, sin rechazarlos con un error propio y sin registrarlos
 * —un rechazo distinguible ya sería una señal—.
 *
 * ESTA CAPA NO CONTIENE DOMINIO. Delega íntegramente en `PatientSelfService`:
 * no consulta la base, no decide autorización y no traduce desenlaces a códigos
 * nuevos. Su único trabajo es adjuntar el instante y la correlación del
 * servidor, y traducir los tres desenlaces posibles a `401`, `403` y `503`.
 *
 * CABECERAS DE NO-CACHÉ: las fija el guard antes de decidir nada, de modo que
 * las llevan TODAS las respuestas de esta superficie, incluidos los errores.
 */
@ApiTags('patient-self')
@Controller(PATIENT_SELF_BASE_PATH)
@UseGuards(HumanSessionGuard)
export class PatientSelfController {
  private readonly logger = new Logger(PatientSelfController.name);

  constructor(@Inject(PatientSelfService) private readonly service: PatientSelfService) {}

  @Get('summary')
  @ApiOperation({
    summary: 'Resumen propio del Paciente autenticado.',
    description:
      'Tres campos y ninguno más: nombre de pila, iniciales y la etiqueta fija ' +
      '«Paciente». No admite ningún selector de sujeto.',
  })
  @ApiOkResponse({ description: 'Resumen propio, con exactamente tres campos.' })
  @ApiUnauthorizedResponse({ description: 'Sin sesión humana vigente. Respuesta uniforme.' })
  @ApiForbiddenResponse({ description: 'Sesión humana sin contexto PATIENT. Respuesta uniforme.' })
  @ApiServiceUnavailableResponse({ description: 'Contexto de ejecución no seguro. Fail-closed.' })
  public async summary(
    @Req() request: RequestWithHumanSession,
  ): Promise<PatientSelfSummaryView> {
    return this.atender(request, (principal, correlationId, now) =>
      this.service.readSummary(principal, correlationId, now),
    );
  }

  @Get('appointments')
  @ApiOperation({
    summary: 'Próximas citas propias del Paciente autenticado.',
    description:
      'Fecha y hora, modalidad y estado. Sin identificadores técnicos y sin dato ' +
      'de terceros. No admite ningún selector de sujeto, ventana, filtro ni orden.',
  })
  @ApiOkResponse({ description: 'Citas propias. Lista vacía si no hay ninguna.' })
  @ApiUnauthorizedResponse({ description: 'Sin sesión humana vigente. Respuesta uniforme.' })
  @ApiForbiddenResponse({ description: 'Sesión humana sin contexto PATIENT. Respuesta uniforme.' })
  @ApiServiceUnavailableResponse({ description: 'Contexto de ejecución no seguro. Fail-closed.' })
  public async appointments(
    @Req() request: RequestWithHumanSession,
  ): Promise<PatientSelfListView<PatientSelfAppointmentView>> {
    return this.atender(request, (principal, correlationId, now) =>
      this.service.readAppointments(principal, correlationId, now),
    );
  }

  @Get('visits')
  @ApiOperation({
    summary: 'Visitas domiciliarias propias recientes del Paciente autenticado.',
    description:
      'Fecha y hora, modalidad y estado. Sin identificadores técnicos, sin la ' +
      'identidad institucional que la materializó y sin historial de transiciones.',
  })
  @ApiOkResponse({ description: 'Visitas propias. Lista vacía si no hay ninguna.' })
  @ApiUnauthorizedResponse({ description: 'Sin sesión humana vigente. Respuesta uniforme.' })
  @ApiForbiddenResponse({ description: 'Sesión humana sin contexto PATIENT. Respuesta uniforme.' })
  @ApiServiceUnavailableResponse({ description: 'Contexto de ejecución no seguro. Fail-closed.' })
  public async visits(
    @Req() request: RequestWithHumanSession,
  ): Promise<PatientSelfListView<PatientSelfVisitView>> {
    return this.atender(request, (principal, correlationId, now) =>
      this.service.readVisits(principal, correlationId, now),
    );
  }

  /**
   * Tronco común de las tres rutas.
   *
   * Existe para que la resolución del principal, el instante del servidor, la
   * correlación y la traducción de desenlaces se escriban UNA vez: tres copias
   * de esta lógica serían tres oportunidades de que una ruta denegara distinto
   * de las otras dos, y la uniformidad de la denegación es un control de
   * seguridad, no un detalle de estilo (§3.4 del contrato).
   */
  private async atender<TView>(
    request: RequestWithHumanSession,
    leer: (
      principal: NonNullable<ReturnType<typeof humanPrincipalOf>>,
      correlationId: string,
      now: Date,
    ) => Promise<TView>,
  ): Promise<TView> {
    const principal = humanPrincipalOf(request);

    if (principal === null) {
      /*
       * Defensa en profundidad: el guard ya garantiza el principal, de modo que
       * esta rama es inalcanzable. Se resuelve CERRADO y con el MISMO `401`
       * uniforme, y NO produce evento de auditoría: sin principal humano
       * resoluble no se inventa un actor (§9.2-1, §9.2-2).
       */
      throw new UnauthorizedException({
        code: PATIENT_SELF_ERROR_CODES.sessionRequired,
        message: 'No hay una sesión vigente.',
      });
    }

    /*
     * Correlación y instante los fija el SERVIDOR. Ni una ni otro se aceptan del
     * cliente: una correlación elegida por el navegador permitiría enlazar
     * eventos a voluntad, y un instante elegido movería la ventana de «próximas»
     * y «recientes».
     */
    const correlationId = randomUUID();

    try {
      return await leer(principal, correlationId, new Date());
    } catch (error) {
      if (error instanceof PatientSelfAccessDeniedError) {
        /*
         * Denegación UNIFORME. No distingue «no tienes participación de
         * paciente» de «tu paciente no está activo»: distinguirlas permitiría
         * deducir la existencia y el estado de un paciente asociado.
         */
        throw new ForbiddenException({
          code: PATIENT_SELF_ERROR_CODES.contextRequired,
          message: 'No hay acceso disponible para esta superficie.',
        });
      }

      if (error instanceof RuntimeContextUnavailableError) {
        /*
         * FAIL-CLOSED: si el contexto de ejecución seguro no puede confirmarse
         * —rol runtime de mínimo privilegio, tenant activo, Row Level Security
         * vigente—, la petición termina en `503`. NUNCA se degrada a acceso
         * concedido y NUNCA se traduce a una lista vacía: un `[]` afirmaría «no
         * tienes», y eso es distinto de «no pude comprobarlo».
         */
        this.logger.error(error.message);

        throw new ServiceUnavailableException({
          code: PATIENT_SELF_ERROR_CODES.unavailable,
          message: 'El servicio no está disponible en este momento.',
        });
      }

      /*
       * Cualquier otro fallo —incluido el de la auditoría OBLIGATORIA, que
       * aborta la transacción— se propaga sin traducir. No se devuelve `200`, no
       * se devuelve lista vacía y no se sirve dato alguno del paciente con la
       * traza perdida (§9.2-6).
       */
      throw error;
    }
  }
}
