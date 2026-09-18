import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { type Request } from 'express';

import { API_ENVIRONMENT, type ApiEnvironmentProvider } from '../config/api-environment.provider';

import { HUMAN_AUTH_ERROR_CODES } from './human-auth.contract';

/**
 * Comprobación de origen en operaciones que CAMBIAN estado
 * (IDENTITY-RELATIONSHIPS-CORE-01 §8.3).
 *
 * Las sesiones de MERDN viajan en cookies. Una cookie la envía el navegador
 * también cuando la petición la origina un sitio ajeno, de modo que `POST` y
 * `PATCH` necesitan una comprobación adicional a la autenticación: sin ella, una
 * página hostil podría activar o revocar una relación en nombre de quien esté
 * autenticado.
 *
 * QUÉ COMPRUEBA: que la petición declare un origen y que ese origen pertenezca a
 * la allowlist configurada. `Origin` es la fuente preferida porque los
 * navegadores la envían en toda petición que cambia estado y no es escribible
 * desde JavaScript de página. Si falta, se acepta `Referer` reducido a su
 * origen, que es el repliegue habitual para clientes antiguos.
 *
 * DENEGACIÓN POR DEFECTO: una petición sin ninguna de las dos cabeceras se
 * RECHAZA. Aceptarla «porque no se sabe de dónde viene» anularía el control
 * completo, ya que omitir una cabecera es trivial para quien construye la
 * petición pero imposible para un navegador que hace CSRF.
 *
 * Esto NO sustituye a CORS: CORS decide qué respuestas puede LEER un origen,
 * y no impide que la petición se ejecute. Son controles complementarios.
 *
 * El origen recibido NO se registra: podría contener información del entorno de
 * la persona usuaria y no aporta nada a la traza.
 */
/*
 * Depende ÚNICAMENTE de la configuración de entorno, que es global. Así el guard
 * puede declararse como proveedor en cualquier módulo que lo necesite —igual que
 * ya se hace con los guards institucionales— sin obligar a importar el módulo de
 * autenticación humana y sin crear un ciclo entre módulos.
 */
@Injectable()
export class SameOriginGuard implements CanActivate {
  constructor(
    @Inject(API_ENVIRONMENT) private readonly environment: ApiEnvironmentProvider,
  ) {}

  public canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const permitidos = this.environment.webOrigins;

    const declarado = resolveOrigin(request);

    if (declarado === null || !permitidos.includes(declarado)) {
      throw new ForbiddenException({
        code: HUMAN_AUTH_ERROR_CODES.originRejected,
        message: 'La petición no procede de un origen autorizado.',
      });
    }

    return true;
  }
}

/**
 * Origen efectivo de la petición.
 *
 * Devuelve `null` cuando no puede determinarse. Una cabecera mal formada
 * produce `null` en lugar de un error del servidor: un cliente hostil no debe
 * poder provocar una excepción no controlada.
 */
function resolveOrigin(request: Request): string | null {
  const origin = firstHeader(request, 'origin');

  if (origin !== null) {
    // `null` literal es lo que envía un contexto opaco (`sandbox`, `data:`).
    // No es un origen autorizable y se rechaza como cualquier otro.
    return normalize(origin);
  }

  const referer = firstHeader(request, 'referer');

  return referer === null ? null : normalize(referer);
}

function firstHeader(request: Request, name: string): string | null {
  const raw = request.headers[name];
  const value = Array.isArray(raw) ? raw[0] : raw;

  return typeof value === 'string' && value.length > 0 ? value : null;
}

function normalize(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}
