import {
  type CanActivate,
  type ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { type Request } from 'express';

import { INSTITUTIONAL_ERROR_CODES } from './institutional-auth.contract';

/**
 * Límite de intentos del establecimiento de sesión institucional
 * (TASK-MUNICIPALITY-CORE-01, §Seguridad).
 *
 * ALCANCE DECLARADO: ventana fija en memoria del proceso, igual que el control
 * ya existente del POST público de inscripción. Es proporcional al riesgo de un
 * MVP de instancia única y evita añadir infraestructura no aprobada, pero NO
 * protege un despliegue con varias instancias ni sustituye a un control
 * anti-automatización en el borde. Queda como riesgo residual reportado.
 *
 * El identificador de cliente es la IP remota. No se registra en logs, no se
 * audita y no se asocia a ningún dato personal.
 */

/** Intentos admitidos por ventana. */
export const INSTITUTIONAL_SIGNIN_MAX_ATTEMPTS = 10;

/** Duración de la ventana, en segundos. */
export const INSTITUTIONAL_SIGNIN_WINDOW_SECONDS = 300;

@Injectable()
export class InstitutionalSignInRateLimitGuard implements CanActivate {
  private readonly counters = new Map<string, { count: number; resetAt: number }>();

  public canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const key = request.ip ?? request.socket.remoteAddress ?? 'unknown';
    const now = Date.now();

    this.evictExpired(now);

    const current = this.counters.get(key);
    if (current === undefined || current.resetAt <= now) {
      this.counters.set(key, {
        count: 1,
        resetAt: now + INSTITUTIONAL_SIGNIN_WINDOW_SECONDS * 1000,
      });

      return true;
    }

    if (current.count >= INSTITUTIONAL_SIGNIN_MAX_ATTEMPTS) {
      throw new HttpException(
        {
          code: INSTITUTIONAL_ERROR_CODES.rateLimited,
          message:
            'Se recibieron demasiados intentos desde este origen. Intente de nuevo más tarde.',
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
