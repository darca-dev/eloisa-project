import { type CanActivate, type ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { type RequestWithHumanSession } from '../human-auth/human-session.guard';
import { humanPrincipalOf } from '../identity-access/human-principal';

/** Authenticated account buckets; reads never consume the write allowance. */
@Injectable()
export class AccessRecoveryRateLimitGuard implements CanActivate {
  private readonly counters = new Map<string, { count: number; resetAt: number }>();
  public canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithHumanSession>();
    const principal = humanPrincipalOf(request);
    if (principal === null) return false;
    const read = request.method === 'GET'; const now = Date.now();
    const key = `${principal.tenantId}:${principal.humanAccountId}:${read ? 'read' : 'write'}`;
    for (const [entry, counter] of this.counters) if (counter.resetAt <= now) this.counters.delete(entry);
    const current = this.counters.get(key);
    if (current === undefined) { this.counters.set(key, { count: 1, resetAt: now + (read ? 60_000 : 900_000) }); return true; }
    if (current.count >= (read ? 60 : 5)) throw new HttpException({ code: 'ACCESS_RECOVERY_RATE_LIMITED', message: 'Espere antes de realizar otra operación de recuperación.' }, HttpStatus.TOO_MANY_REQUESTS);
    current.count++; return true;
  }
}
