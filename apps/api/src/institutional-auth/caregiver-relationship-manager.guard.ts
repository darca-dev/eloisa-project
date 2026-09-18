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
import { type Response } from 'express';

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
 * Autorización server-side de la superficie de RELACIONES Paciente–Cuidador
 * (IDENTITY-RELATIONSHIPS-CORE-01 AD-03, §8.2).
 *
 * Denegación por defecto: sin sesión institucional vigente CON el rol
 * `CAREGIVER_RELATIONSHIP_MANAGER` no se ejecuta el controlador y, por tanto, no
 * se toca ningún dato. La comprobación NO depende de la ruta, de un menú, de un
 * botón oculto ni de ningún valor enviado por el navegador: el tenant lo
 * resuelve el servidor y el rol se lee de la identidad persistida.
 *
 * Contrato de estados:
 * - `401` cuando no hay sesión institucional válida —ausente, malformada,
 *   expirada, revocada, manipulada, con identidad deshabilitada o de otra
 *   institución—. La cookie de autoinscripción de paciente y la cookie de
 *   sesión HUMANA entran aquí, porque ninguna de las dos autentica a una
 *   institución;
 * - `403` cuando la identidad autenticada carece del rol. Una sesión municipal,
 *   una `HOSPITAL_PATIENT_VIEWER` y una `HOSPITAL_SCHEDULER` caen exactamente en
 *   este caso.
 *
 * ROLES DISJUNTOS, DELIBERADAMENTE: este guard NO extiende ni compone ningún
 * otro. Gestionar relaciones de cuidado no se deriva de programar agenda ni de
 * consultar pacientes, y compartir una jerarquía de permisos abriría la puerta a
 * que relajar uno relajase el otro.
 *
 * UNA IDENTIDAD INSTITUCIONAL NO ES UNA PERSONA. Este rol autoriza a un operador
 * de la institución a declarar una autorización de cuidado; no acredita que
 * ninguna persona concreta la haya verificado, y la fuente de validación
 * persistida lo dice de forma expresa.
 *
 * NO se audita la denegación en este guard: a diferencia de las superficies
 * hospitalarias, esta Task no define un evento de acceso denegado, y no se
 * inventa aquí uno que su §10 no aprueba.
 */
@Injectable()
export class CaregiverRelationshipManagerGuard implements CanActivate {
  private readonly logger = new Logger(CaregiverRelationshipManagerGuard.name);

  constructor(
    @Inject(InstitutionalAuthService) private readonly auth: InstitutionalAuthService,
  ) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<RequestWithInstitutionalPrincipal>();

    /*
     * Las cabeceras de no-caché se fijan ANTES de decidir nada, de modo que las
     * lleven TODAS las respuestas de esta superficie: también el `401`, el `403`
     * y cualquier error posterior.
     */
    noStore(context.switchToHttp().getResponse<Response>());

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
         * controlado. Nunca se concede el acceso «por si acaso».
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

    if (principal.role !== 'CAREGIVER_RELATIONSHIP_MANAGER') {
      throw new ForbiddenException({
        code: INSTITUTIONAL_ERROR_CODES.forbidden,
        message: 'La identidad institucional no tiene acceso a esta operación.',
      });
    }

    request[INSTITUTIONAL_PRINCIPAL_KEY] = principal;

    return true;
  }
}

/** Ninguna respuesta de esta superficie puede quedar en una caché compartida. */
function noStore(response: Response): void {
  response.setHeader('Cache-Control', 'private, no-store');
  response.setHeader('Pragma', 'no-cache');
  response.setHeader('Vary', 'Cookie');
}
