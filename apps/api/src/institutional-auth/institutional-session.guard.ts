import {
  type CanActivate,
  type ExecutionContext,
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
 * Autenticación —NO autorización— de la sesión institucional vigente.
 *
 * Existe para las operaciones que pertenecen a la SESIÓN misma y no a ninguna
 * superficie de datos: cerrar la sesión es la única de ellas hoy. Cualquier
 * identidad institucional autenticada debe poder cerrar SU PROPIA sesión, del
 * mismo modo que cualquiera de ellas puede describirla en `GET current`.
 *
 * QUÉ COMPRUEBA: que exista una sesión institucional válida —presente, bien
 * formada, no expirada, no revocada, de una identidad activa y del tenant que
 * resuelve el servidor—. Nada más.
 *
 * QUÉ NO HACE, Y NO DEBE HACER: comprobar un rol. Este guard NO concede acceso
 * a ningún dato hospitalario, municipal ni de relaciones de cuidado. Los guards
 * de rol —`MunicipalViewerGuard`, `HospitalPatientViewerGuard`,
 * `HospitalSchedulerGuard`, `CaregiverRelationshipManagerGuard`— siguen siendo
 * los ÚNICOS que autorizan sus respectivas superficies, siguen siendo disjuntos
 * y no se ven alterados por la existencia de este guard.
 *
 * Contrato de estados:
 * - `401` cuando no hay sesión institucional válida, por cualquier causa y de
 *   forma indistinguible entre ellas;
 * - no produce `403`: no hay ningún rol que exigir aquí.
 */
@Injectable()
export class InstitutionalSessionGuard implements CanActivate {
  private readonly logger = new Logger(InstitutionalSessionGuard.name);

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
         * transacción, Row Level Security vigente—, la petición termina en un
         * error controlado. El detalle queda en el registro del servidor y no
         * describe la topología al cliente.
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

    request[INSTITUTIONAL_PRINCIPAL_KEY] = principal;

    return true;
  }
}
