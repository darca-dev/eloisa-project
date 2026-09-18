import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { type Request } from 'express';

import {
  API_ENVIRONMENT,
  type ApiEnvironmentProvider,
} from '../config/api-environment.provider';

/**
 * Comprobación de origen de las operaciones institucionales que CAMBIAN estado:
 * abrir la sesión y cerrarla.
 *
 * La sesión institucional viaja en una cookie. El navegador la envía también
 * cuando la petición la origina un sitio ajeno, de modo que un `POST` o un
 * `DELETE` necesitan una comprobación adicional a la credencial: sin ella una
 * página hostil podría abrir o cerrar la sesión institucional de quien la
 * visite. Esto NO sustituye a CORS —que decide qué respuestas puede LEER un
 * origen, no si la petición se ejecuta—: son controles complementarios.
 *
 * QUÉ COMPRUEBA: la petición debe DECLARAR un origen y ese origen debe
 * pertenecer a la allowlist configurada (`API_WEB_ORIGINS`). `Origin` es la
 * fuente preferida porque el navegador la envía en toda petición que cambia
 * estado y no es escribible desde el JavaScript de una página; si falta, se
 * acepta `Referer` reducido a su origen.
 *
 * DENEGACIÓN POR DEFECTO: una petición que no declara NINGUNA de las dos
 * cabeceras se rechaza con `403`. Es el mismo criterio que aplica
 * `SameOriginGuard` en la autenticación humana: ausencia de origen no es
 * prueba de procedencia legítima, y admitirla dejaría abierta la única vía por
 * la que un cliente podría eludir la comprobación.
 *
 * El origen recibido NO se registra: puede contener información del entorno de
 * quien usa el sistema y no aporta nada a la traza.
 *
 * Depende ÚNICAMENTE de la configuración de entorno, que es global: no obliga a
 * importar ningún módulo nuevo ni crea un ciclo entre módulos.
 */

/**
 * Código de error del rechazo por origen.
 *
 * Se declara aquí —y no en `institutional-auth.contract.ts`— porque el contrato
 * queda fuera de los archivos autorizados de esta tarea. Consolidarlo en el
 * contrato es trabajo de seguimiento explícito.
 */
export const INSTITUTIONAL_ORIGIN_REJECTED_CODE = 'INSTITUTIONAL_ORIGIN_REJECTED';

@Injectable()
export class InstitutionalSameOriginGuard implements CanActivate {
  constructor(
    @Inject(API_ENVIRONMENT) private readonly environment: ApiEnvironmentProvider,
  ) {}

  public canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const declarado = declaredOrigin(request);

    if (declarado === null || !this.environment.webOrigins.includes(declarado)) {
      throw new ForbiddenException({
        code: INSTITUTIONAL_ORIGIN_REJECTED_CODE,
        message: 'La petición no procede de un origen autorizado.',
      });
    }

    return true;
  }
}

/**
 * Origen declarado por la petición, o `null` si no declara ninguno.
 *
 * Una cabecera presente pero mal formada NO devuelve `null`: devuelve el valor
 * literal, que jamás coincidirá con la allowlist y por tanto se rechaza. Así un
 * cliente hostil no puede convertir «origen ajeno» en «sin origen» enviando una
 * cabecera basura, ni provocar una excepción no controlada. `null` queda
 * reservado a la ausencia real de ambas cabeceras, que también se rechaza.
 */
function declaredOrigin(request: Request): string | null {
  const bruto = firstHeader(request, 'origin') ?? firstHeader(request, 'referer');

  if (bruto === null) {
    return null;
  }

  try {
    // `null` literal es lo que envía un contexto opaco (`sandbox`, `data:`).
    // No es un origen autorizable y cae en la rama de valor literal.
    return new URL(bruto).origin;
  } catch {
    return bruto;
  }
}

function firstHeader(request: Request, name: string): string | null {
  const raw = request.headers[name];
  const value = Array.isArray(raw) ? raw[0] : raw;

  return typeof value === 'string' && value.length > 0 ? value : null;
}
