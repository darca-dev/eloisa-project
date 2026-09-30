/**
 * Límite de peticiones del endpoint público de solicitudes de acceso
 * (SPEC 038, MP02-C1).
 *
 * POR QUÉ ES UNA COPIA DEL PATRÓN Y NO DEL GUARD: `EnrollmentRateLimitGuard`
 * vive en el módulo de pacientes y lanza el código `ENROLLMENT_RATE_LIMITED`.
 * Reutilizarlo aquí publicaría un código de otro dominio en un endpoint que no
 * es de inscripción, y un cliente que programara contra este endpoint acabaría
 * comparando códigos ajenos. Lo que sí se reutiliza, y es lo importante, es la
 * CONFIGURACIÓN: `environment.enrollmentRateLimit`, ya validada al arrancar. No
 * se introduce una variable de entorno nueva, ni un secreto, ni una lista.
 *
 * ALCANCE DECLARADO Y RIESGO RESIDUAL: ventana fija en memoria del proceso.
 * Es proporcional al riesgo de una instancia única y evita añadir
 * infraestructura no aprobada, pero NO protege un despliegue con varias
 * instancias ni sustituye un control anti-automatización en el borde. Queda
 * reportado como riesgo residual; sustituirlo exige una decisión de
 * infraestructura posterior.
 *
 * DATOS QUE ESTE GUARD NO RECOGE: la IP se usa como clave de contador y no se
 * registra, no se persiste y no se asocia a ningún dato personal. Tampoco se
 * registra el origen ni el cuerpo de la petición. El contador se destruye solo
 * al vencer su ventana.
 */

import {
  type CanActivate,
  type ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import { type Request } from 'express';

import { API_ENVIRONMENT, type ApiEnvironmentProvider } from '../config/api-environment.provider';

import { ACCESS_REQUEST_ERROR_CODES } from './access-request.contract';

@Injectable()
export class AccessRequestRateLimitGuard implements CanActivate {
  private readonly counters = new Map<string, { count: number; resetAt: number }>();

  constructor(
    @Inject(API_ENVIRONMENT) private readonly environment: ApiEnvironmentProvider,
  ) {}

  public canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const key = request.ip ?? request.socket.remoteAddress ?? 'unknown';
    const now = Date.now();
    const { maxRequests, windowSeconds } = this.environment.enrollmentRateLimit;

    this.evictExpired(now);

    const current = this.counters.get(key);
    if (current === undefined || current.resetAt <= now) {
      this.counters.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
      return true;
    }

    if (current.count >= maxRequests) {
      throw new HttpException(
        {
          code: ACCESS_REQUEST_ERROR_CODES.rateLimited,
          message:
            'Se recibieron demasiadas solicitudes desde este origen. Intente de nuevo más tarde.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    current.count += 1;
    return true;
  }

  /** Evita que el mapa crezca sin límite en procesos de larga duración. */
  private evictExpired(now: number): void {
    for (const [key, value] of this.counters) {
      if (value.resetAt <= now) {
        this.counters.delete(key);
      }
    }
  }
}
