import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';

import { RuntimeContextUnavailableError } from '../database/runtime-context.error';
import { readCookie } from '../enrollment-sessions/enrollment-session.cookie';

import {
  INSTITUTIONAL_ERROR_CODES,
  INSTITUTIONAL_SESSION_COOKIE_NAME,
} from './institutional-auth.contract';
import {
  InstitutionalAuthService,
  type InstitutionalPrincipal,
} from './institutional-auth.service';
import {
  INSTITUTIONAL_PRINCIPAL_KEY,
  type RequestWithInstitutionalPrincipal,
} from './municipal-viewer.guard';

/**
 * Autorización server-side de la superficie hospitalaria de Pacientes
 * (TASK-HOSPITAL-CORE-01 §4.1.4 y §9.4, §9.5).
 *
 * Denegación por defecto: sin sesión institucional vigente CON el rol
 * `HOSPITAL_PATIENT_VIEWER` no se ejecuta el controlador y, por tanto, no se
 * toca ningún dato. La comprobación NO depende de la ruta, del sidebar, de un
 * botón oculto ni de ningún valor enviado por el navegador: el tenant se
 * resuelve en el servidor y el rol se lee de la identidad persistida.
 *
 * Contrato de estados:
 * - `401` cuando no hay sesión institucional válida —ausente, malformada,
 *   expirada, revocada, manipulada, con identidad deshabilitada o de otra
 *   institución—; la cookie de autoinscripción de paciente entra aquí, porque
 *   NO autentica a ninguna institución;
 * - `403` cuando la identidad autenticada carece de `HOSPITAL_PATIENT_VIEWER`.
 *   Una sesión municipal válida cae exactamente en este caso.
 *
 * Ninguna de las dos respuestas confirma la existencia de datos detrás.
 *
 * Este guard es DELIBERADAMENTE separado de `MunicipalViewerGuard` y no lo
 * extiende: los dos roles son disjuntos y compartir una jerarquía de permisos
 * abriría la puerta a que relajar uno relajase el otro. Lo que sí se comparte
 * —porque debe existir en un solo sitio— es el servicio de validación de sesión
 * y la clave con la que el principal viaja hasta el controlador.
 */
@Injectable()
export class HospitalPatientViewerGuard implements CanActivate {
  private readonly logger = new Logger(HospitalPatientViewerGuard.name);

  constructor(
    @Inject(InstitutionalAuthService)
    private readonly auth: InstitutionalAuthService,
  ) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<RequestWithInstitutionalPrincipal>();

    const token = readCookie(request.headers.cookie, INSTITUTIONAL_SESSION_COOKIE_NAME);

    let principal: InstitutionalPrincipal | null;

    try {
      principal = await this.auth.validate(token, new Date());
    } catch (error) {
      if (error instanceof RuntimeContextUnavailableError) {
        /*
         * FAIL-CLOSED: si el contexto de ejecución seguro no puede confirmarse
         * —rol runtime de mínimo privilegio, tenant activo fijado en la
         * transacción, Row Level Security vigente—, la petición termina en error
         * controlado. Nunca se concede el acceso «por si acaso» ni se reintenta
         * con privilegios superiores. El detalle queda en el registro del
         * servidor y no viaja al cliente.
         */
        this.logger.error(error.message);

        throw new ServiceUnavailableException({
          code: INSTITUTIONAL_ERROR_CODES.internal,
          message: 'El servicio no está disponible en este momento.',
        });
      }

      throw error;
    }

    if (principal === null) {
      throw new UnauthorizedException({
        code: INSTITUTIONAL_ERROR_CODES.sessionRequired,
        message: 'No hay una sesión institucional vigente.',
      });
    }

    if (principal.role !== 'HOSPITAL_PATIENT_VIEWER') {
      /*
       * El principal se adjunta ANTES de denegar para que el guard de auditoría
       * que compone a este pueda registrar el rol efectivo del intento. Adjuntar
       * el principal no concede nada: el controlador no llega a ejecutarse.
       */
      request[INSTITUTIONAL_PRINCIPAL_KEY] = principal;

      throw new ForbiddenException({
        code: INSTITUTIONAL_ERROR_CODES.forbidden,
        message: 'La identidad institucional no tiene acceso a esta consulta.',
      });
    }

    request[INSTITUTIONAL_PRINCIPAL_KEY] = principal;

    return true;
  }
}
