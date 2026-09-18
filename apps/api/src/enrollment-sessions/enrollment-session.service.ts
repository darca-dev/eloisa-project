import { Inject, Injectable } from '@nestjs/common';

import { API_ENVIRONMENT, type ApiEnvironmentProvider } from '../config/api-environment.provider';
import { PrismaService } from '../database/prisma.service';
import { type PrismaTransaction } from '../database/prisma-transaction';

import { buildSessionCookie } from './enrollment-session.cookie';
import {
  generateSessionToken,
  hashSessionToken,
  hashesMatch,
  isWellFormedSessionToken,
} from './enrollment-session.tokens';

/**
 * Ciclo de vida de la sesión de inscripción (TASK-MVP-CORE-01 §4, §6).
 *
 * La creación ocurre DENTRO de la transacción de inscripción, de modo que una
 * sesión nunca puede existir sin su paciente. La validación es server-side y
 * comprueba token, hash, expiración, revocación y tenant institucional activo.
 *
 * La rotación y la revocación quedan encapsuladas aquí para que una futura
 * autenticación completa las sustituya sin tocar los controladores.
 */

export interface CreatedEnrollmentSession {
  readonly sessionId: string;
  /** Cabecera `Set-Cookie` lista para la respuesta. */
  readonly setCookieHeader: string;
}

export interface ValidatedEnrollmentSession {
  readonly sessionId: string;
  readonly patientId: string;
  readonly tenantId: string;
}

@Injectable()
export class EnrollmentSessionService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(API_ENVIRONMENT) private readonly environment: ApiEnvironmentProvider,
  ) {}

  /**
   * Crea la sesión dentro de una transacción existente y devuelve la cookie.
   * El token en claro solo vive en memoria y en la cabecera de respuesta.
   */
  public async createWithin(
    tx: PrismaTransaction,
    input: { readonly tenantId: string; readonly patientId: string },
    now: Date,
  ): Promise<CreatedEnrollmentSession> {
    const token = generateSessionToken();
    const config = this.environment.enrollmentSession;

    const session = await tx.enrollmentSession.create({
      data: {
        tenantId: input.tenantId,
        patientId: input.patientId,
        tokenHash: hashSessionToken(token),
        expiresAt: new Date(now.getTime() + config.ttlSeconds * 1000),
      },
      select: { id: true },
    });

    return {
      sessionId: session.id,
      setCookieHeader: buildSessionCookie(token, config),
    };
  }

  /**
   * Valida un token recibido por cookie.
   *
   * Devuelve `null` de forma indistinguible cuando el token está ausente, es
   * malformado, no existe, expiró, fue revocado o pertenece a otro tenant: la
   * respuesta no debe permitir deducir cuál de esas condiciones ocurrió.
   */
  public async validate(
    token: string | null,
    tenantId: string,
    now: Date,
  ): Promise<ValidatedEnrollmentSession | null> {
    if (token === null || !isWellFormedSessionToken(token)) {
      return null;
    }

    const tokenHash = hashSessionToken(token);

    // La búsqueda se ejecuta bajo el rol runtime con el tenant activo fijado:
    // una sesión de otra institución no es visible aunque su token sea correcto,
    // y esa barrera la impone PostgreSQL, no solo el filtro de la aplicación.
    return this.prisma.withTenant(tenantId, async (tx) => {
      const session = await tx.enrollmentSession.findFirst({
        where: { tokenHash, tenantId },
        select: {
          id: true,
          tenantId: true,
          patientId: true,
          tokenHash: true,
          expiresAt: true,
          revokedAt: true,
        },
      });

      if (session === null) {
        return null;
      }

      // Comparación en tiempo constante aunque la búsqueda ya sea por índice
      // único: mantiene la propiedad si la estrategia de búsqueda cambiara.
      if (!hashesMatch(session.tokenHash, tokenHash)) {
        return null;
      }

      if (session.revokedAt !== null || session.expiresAt.getTime() <= now.getTime()) {
        return null;
      }

      // Redundante con la política de RLS, y deliberadamente conservada: el
      // aislamiento no debe depender de una sola capa.
      if (session.tenantId !== tenantId) {
        return null;
      }

      await tx.enrollmentSession.update({
        where: { id: session.id },
        data: { lastUsedAt: now },
      });

      return {
        sessionId: session.id,
        patientId: session.patientId,
        tenantId: session.tenantId,
      };
    });
  }

  /** Revoca una sesión. Se conserva la fila para trazabilidad histórica. */
  public async revoke(sessionId: string, tenantId: string, now: Date): Promise<void> {
    await this.prisma.withTenant(tenantId, async (tx) => {
      await tx.enrollmentSession.updateMany({
        where: { id: sessionId, tenantId, revokedAt: null },
        data: { revokedAt: now },
      });
    });
  }
}
