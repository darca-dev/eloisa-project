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

import { ENROLLMENT_ERROR_CODES } from './enrollment.contract';

/**
 * Límite de peticiones del POST público de inscripción
 * (TASK-MVP-CORE-01 §9).
 *
 * ALCANCE DECLARADO: ventana fija en memoria del proceso. Es proporcional al
 * riesgo de un MVP de instancia única y evita añadir infraestructura no
 * aprobada, pero NO protege un despliegue con varias instancias ni sustituye a
 * un control anti-automatización en el borde. Queda como riesgo residual
 * reportado; su sustitución exige una decisión de infraestructura.
 *
 * El identificador de cliente es la IP remota. No se registra en logs y no se
 * asocia a ningún dato personal.
 */
@Injectable()
export class EnrollmentRateLimitGuard implements CanActivate {
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
          code: ENROLLMENT_ERROR_CODES.rateLimited,
          message:
            'Se recibieron demasiadas inscripciones desde este origen. Intente de nuevo más tarde.',
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
