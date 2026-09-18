import {
  type CanActivate,
  type ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import { type Request } from 'express';

import { HUMAN_AUTH_ERROR_CODES } from './human-auth.contract';
import { HumanAuthService } from './human-auth.service';

/**
 * Límite de intentos de las operaciones de AUTENTICACIÓN humana
 * (IDENTITY-RELATIONSHIPS-CORE-01 §8.3).
 *
 * Se aplica a `login`, `callback` y `logout`: las tres crean o destruyen
 * material de sesión y las tres escriben en la base, de modo que un bucle sin
 * control las convertiría en una vía de agotamiento de recursos.
 *
 * ALCANCE DECLARADO: ventana fija en memoria del proceso, igual que los
 * controles ya existentes del POST público de inscripción y del inicio de sesión
 * institucional. Es proporcional al riesgo de un MVP de instancia única y evita
 * añadir infraestructura no aprobada, pero NO protege un despliegue con varias
 * instancias ni sustituye a un control anti-automatización en el borde. Queda
 * como riesgo residual reportado.
 *
 * El identificador de cliente es la IP remota. NO se registra en logs, NO se
 * audita y NO se asocia a ninguna cuenta ni a ningún dato personal: contar por
 * cuenta exigiría resolver la identidad ANTES de aplicar el límite, que es
 * exactamente lo que el límite debe evitar.
 */
@Injectable()
export class HumanAuthRateLimitGuard implements CanActivate {
  private readonly counters = new Map<string, { count: number; resetAt: number }>();

  constructor(@Inject(HumanAuthService) private readonly auth: HumanAuthService) {}

  public canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const { maxRequests, windowSeconds } = this.auth.rateLimit;

    const key = request.ip ?? request.socket.remoteAddress ?? 'unknown';
    const now = Date.now();

    this.evictExpired(now);

    const current = this.counters.get(key);

    if (current === undefined || current.resetAt <= now) {
      this.counters.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });

      return true;
    }

    if (current.count >= maxRequests) {
      throw new HttpException(
        {
          code: HUMAN_AUTH_ERROR_CODES.rateLimited,
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
