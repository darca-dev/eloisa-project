import {
  type CanActivate,
  type ExecutionContext,
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
  HUMAN_PRINCIPAL_KEY,
  type RequestWithHumanPrincipal,
} from '../identity-access/human-principal';

import {
  HUMAN_AUTH_ERROR_CODES,
  HUMAN_SESSION_COOKIE_NAME,
} from './human-auth.contract';
import { HumanAuthService, type HumanSessionValidity } from './human-auth.service';

/**
 * Autorización server-side de la superficie HUMANA
 * (IDENTITY-RELATIONSHIPS-CORE-01 §7.1, §8.3).
 *
 * Denegación por defecto: sin sesión humana vigente no se ejecuta el
 * controlador y, por tanto, no se toca ningún dato. La comprobación NO depende
 * de la ruta, de un menú, de un botón oculto ni de ningún valor enviado por el
 * navegador: el tenant lo resuelve el servidor y la persona se lee de la sesión
 * persistida.
 *
 * COOKIES SEPARADAS, DELIBERADAMENTE: este guard lee EXCLUSIVAMENTE
 * `merdn_human_session`. Ni la cookie de autoinscripción ni la institucional
 * autentican aquí, y presentar las tres a la vez no produce ambigüedad: cada
 * superficie mira solo la suya y las demás son inertes.
 *
 * El principal lo construye ÚNICAMENTE el validador de sesión y se adjunta bajo
 * una clave simbólica, de modo que ningún cuerpo, consulta ni cabecera pueda
 * suplantarlo.
 */

/** Clave bajo la que se adjunta la vigencia ya calculada de la sesión. */
export const HUMAN_SESSION_VALIDITY_KEY: unique symbol = Symbol(
  'merdn.humanSessionValidity',
);

export type RequestWithHumanSession = RequestWithHumanPrincipal & {
  [HUMAN_SESSION_VALIDITY_KEY]?: HumanSessionValidity;
};

/** Recupera la vigencia calculada por el guard, si la hubo. */
export function humanSessionValidityOf(
  request: RequestWithHumanSession,
): HumanSessionValidity | null {
  return request[HUMAN_SESSION_VALIDITY_KEY] ?? null;
}

@Injectable()
export class HumanSessionGuard implements CanActivate {
  private readonly logger = new Logger(HumanSessionGuard.name);

  constructor(@Inject(HumanAuthService) private readonly auth: HumanAuthService) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithHumanSession>();

    /*
     * Las cabeceras de no-caché se fijan ANTES de decidir nada, de modo que las
     * lleven TODAS las respuestas de esta superficie: también el `401` y
     * cualquier error posterior. Una respuesta personal no debe quedar en una
     * caché compartida entre personas usuarias.
     */
    noStore(context.switchToHttp().getResponse<Response>());

    const token = readCookie(request.headers.cookie, HUMAN_SESSION_COOKIE_NAME);

    let resolved: Awaited<ReturnType<HumanAuthService['validate']>>;

    try {
      resolved = await this.auth.validate(token, new Date());
    } catch (error) {
      if (error instanceof RuntimeContextUnavailableError) {
        /*
         * FAIL-CLOSED: si el contexto de ejecución seguro no puede confirmarse
         * —rol runtime de mínimo privilegio, tenant activo fijado en la
         * transacción, Row Level Security vigente—, la petición termina en
         * error controlado. Nunca se concede el acceso «por si acaso».
         */
        this.logger.error(error.message);

        throw new ServiceUnavailableException({
          code: HUMAN_AUTH_ERROR_CODES.unavailable,
          message: 'El servicio no está disponible en este momento.',
        });
      }

      throw error;
    }

    if (resolved === null) {
      /*
       * Respuesta IDÉNTICA ante ausencia, malformación, caducidad absoluta,
       * caducidad por inactividad, revocación, cuenta deshabilitada, vínculo
       * desvinculado o tenant ajeno. Distinguirlas permitiría deducir el estado
       * de una cuenta ajena.
       */
      throw new UnauthorizedException({
        code: HUMAN_AUTH_ERROR_CODES.sessionRequired,
        message: 'No hay una sesión vigente.',
      });
    }

    request[HUMAN_PRINCIPAL_KEY] = resolved.principal;
    request[HUMAN_SESSION_VALIDITY_KEY] = resolved.validity;

    return true;
  }
}

/** Ninguna respuesta personal puede quedar en una caché compartida. */
export function noStore(response: Response): void {
  response.setHeader('Cache-Control', 'private, no-store');
  response.setHeader('Pragma', 'no-cache');
  response.setHeader('Vary', 'Cookie');
}
