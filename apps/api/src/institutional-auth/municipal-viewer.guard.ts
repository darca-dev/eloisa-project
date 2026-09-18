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
import { type Request } from 'express';

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

/**
 * Autorización server-side de la superficie municipal agregada
 * (TASK-MUNICIPALITY-CORE-01, FR-14 y §Permisos 1, 6 y 7).
 *
 * Denegación por defecto: sin sesión institucional vigente no se ejecuta el
 * controlador y, por tanto, no se toca ningún dato. La comprobación NO depende
 * de botones ocultos, de la navegación ni de ningún valor enviado por el
 * navegador: el tenant se resuelve en el servidor y el rol se lee de la
 * identidad persistida, nunca de la petición.
 *
 * Contrato de estados:
 * - `401` cuando no hay sesión institucional válida —ausente, malformada,
 *   expirada, revocada, manipulada o de otra institución—; la cookie de
 *   autoinscripción de paciente entra aquí, porque NO autentica a Alcaldía;
 * - `403` cuando la identidad autenticada carece de `MUNICIPAL_VIEWER`.
 *
 * Ninguna de las dos respuestas confirma la existencia de datos detrás.
 */

/** Clave con la que el principal viaja hasta el controlador. */
export const INSTITUTIONAL_PRINCIPAL_KEY = 'merdnInstitutionalPrincipal';

/** Petición con el principal institucional ya resuelto por el guard. */
export interface RequestWithInstitutionalPrincipal extends Request {
  [INSTITUTIONAL_PRINCIPAL_KEY]?: InstitutionalPrincipal;
}

/** Lee el principal que el guard adjuntó a la petición. */
export function institutionalPrincipalOf(
  request: RequestWithInstitutionalPrincipal,
): InstitutionalPrincipal | null {
  return request[INSTITUTIONAL_PRINCIPAL_KEY] ?? null;
}

@Injectable()
export class MunicipalViewerGuard implements CanActivate {
  private readonly logger = new Logger(MunicipalViewerGuard.name);

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
         * FAIL-CLOSED: si el contexto de ejecución seguro no puede confirmarse,
         * la petición termina en error controlado. Nunca se concede el acceso
         * «por si acaso» ni se reintenta con privilegios superiores. El detalle
         * queda en el registro del servidor y no viaja al cliente.
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

    if (principal.role !== 'MUNICIPAL_VIEWER') {
      throw new ForbiddenException({
        code: INSTITUTIONAL_ERROR_CODES.forbidden,
        message: 'La identidad institucional no tiene acceso a esta consulta.',
      });
    }

    request[INSTITUTIONAL_PRINCIPAL_KEY] = principal;

    return true;
  }
}
