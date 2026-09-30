/**
 * Barrera de origen permitido del endpoint público de solicitudes de acceso
 * (SPEC 038, MP02-C1-C1).
 *
 * POR QUÉ ES UN GUARD Y NO UNA COMPROBACIÓN EN EL MÉTODO: mientras la
 * comprobación viviera dentro de la acción, se ejecutaría DESPUÉS de todos los
 * guards ya declarados, porque Nest corre los guards antes de invocar el
 * controlador. Con el límite de peticiones declarado primero, una página ajena
 * podía agotar el cupo de una persona que comparte salida de red antes de
 * recibir siquiera el `403`. Declararla como guard invierte ese orden sin tocar
 * la lógica: un origen denegado, ausente u opaco no llega a existir para el
 * límite y, por tanto, no incrementa ningún contador.
 *
 * LO QUE SE REUTILIZA Y LO QUE NO: se reutiliza ÚNICAMENTE la función pura
 * `isAllowedWebOrigin`, que ya compara por origen completo contra
 * `API_WEB_ORIGINS` y ya deniega por defecto la petición sin `Origin` ni
 * `Referer` y el `Origin: null` de un contexto opaco. No hay una segunda
 * allowlist, ni una lista nueva, ni un secreto nuevo, ni un token: la única
 * fuente de verdad sigue siendo la que CORS ya usa y la configuración ya valida
 * al arrancar.
 *
 * CÓDIGO DEVUELTO: `ACCESS_REQUEST_ORIGIN_REJECTED`. Es público y propio de
 * este endpoint. No es un código de Hospital —esta no es una mutación con
 * cookie— ni de autenticación: no hay sesión que autenticar aquí, y presentar
 * una denegación de origen como `401` induciría al cliente a reintentar con
 * credenciales que este endpoint jamás aceptará.
 *
 * LO QUE ESTA COMPROBACIÓN NO ES: no es autenticación, no es autorización, no
 * sustituye al límite de peticiones ni a Row Level Security. Deniega por
 * defecto y no registra ni el origen ni el cuerpo de la petición.
 */

import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { type Request } from 'express';

import { API_ENVIRONMENT, type ApiEnvironmentProvider } from '../config/api-environment.provider';
import { isAllowedWebOrigin } from '../hospital/hospital-appointment-assignment.origin';

import { ACCESS_REQUEST_ERROR_CODES } from './access-request.contract';

@Injectable()
export class AccessRequestOriginGuard implements CanActivate {
  constructor(
    @Inject(API_ENVIRONMENT) private readonly environment: ApiEnvironmentProvider,
  ) {}

  public canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    if (!isAllowedWebOrigin(request.headers, this.environment.webOrigins)) {
      /*
       * Sin columna de campos: la denegación describe el problema sin revelar
       * ni la lista configurada ni qué cabecera se evaluó.
       */
      throw new ForbiddenException({
        code: ACCESS_REQUEST_ERROR_CODES.originRejected,
        message: 'La solicitud no procede de un origen habilitado.',
      });
    }

    return true;
  }
}
