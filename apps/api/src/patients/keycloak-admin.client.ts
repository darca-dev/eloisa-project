import { Injectable, Inject, Logger } from '@nestjs/common';

import { API_ENVIRONMENT, type ApiEnvironmentProvider } from '../config/api-environment.provider';
import type { KeycloakPatientConfig } from '../config/environment';

/**
 * Cliente para Keycloak Admin API (Spec 027).
 *
 * Responsabilidad única: crear usuarios en el realm `merdn-patient`
 * durante la inscripción de pacientes. Usa client credentials grant
 * para obtener token de service account.
 *
 * Timeout: 10s. Retry: 1x en errores 5xx / red.
 * Lanza `KeycloakProvisionError` si falla → rollback transacción BD.
 */

export interface CreateKeycloakUserDto {
  readonly username: string;
  readonly email: string;
  readonly emailVerified: boolean;
  readonly firstName: string;
  readonly lastName: string;
  readonly password: string;
  readonly attributes: Record<string, string>;
}

export class KeycloakProvisionError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly keycloakError?: unknown,
  ) {
    super(message);
    this.name = 'KeycloakProvisionError';
  }
}

interface KeycloakTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: 'Bearer';
}

@Injectable()
export class KeycloakAdminClient {
  private readonly logger = new Logger(KeycloakAdminClient.name);
  private readonly config: KeycloakPatientConfig | undefined;
  private cachedToken: { token: string; expiresAt: number } | null = null;

  constructor(
    @Inject(API_ENVIRONMENT) environment: ApiEnvironmentProvider,
  ) {
    this.config = environment.keycloakPatient;
  }

  /**
   * Crea un usuario en Keycloak realm `merdn-patient`.
   * Devuelve el `id` (subject) del usuario creado.
   */
  async createUser(dto: CreateKeycloakUserDto): Promise<string> {
    if (this.config === undefined) {
      throw new KeycloakProvisionError('La provisión de pacientes en Keycloak está deshabilitada.');
    }

    const token = await this.getAccessToken();

    const url = `${this.config.adminUrl}/admin/realms/${this.config.realm}/users`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          username: dto.username,
          email: dto.email,
          emailVerified: dto.emailVerified,
          firstName: dto.firstName,
          lastName: dto.lastName,
          enabled: true,
          credentials: [
            {
              type: 'password',
              value: dto.password,
              temporary: false,
            },
          ],
          attributes: dto.attributes,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.status === 201) {
        const location = response.headers.get('Location');
        if (!location) {
          throw new KeycloakProvisionError('Keycloak no devolvió Location header', 201);
        }
        // Location: /admin/realms/{realm}/users/{id}
        const userId = location.split('/').pop();
        if (!userId) {
          throw new KeycloakProvisionError('No se pudo extraer userId del Location header', 201);
        }
        this.logger.log(`Usuario Keycloak creado: ${userId} (username: ${dto.username})`);
        return userId;
      }

      if (response.status === 409) {
        throw new KeycloakProvisionError('Conflicto: username o email ya existe en Keycloak', 409);
      }

      if (response.status >= 500) {
        // Reintentar una vez
        return this.createUserWithRetry(dto, 1);
      }

      const errorText = await response.text().catch(() => 'sin cuerpo');
      throw new KeycloakProvisionError(
        `Keycloak error ${response.status}: ${errorText}`,
        response.status,
      );
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof KeycloakProvisionError) {
        throw error;
      }
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new KeycloakProvisionError('Timeout creando usuario en Keycloak (10s)');
      }
      throw new KeycloakProvisionError(
        `Error de red conectando a Keycloak: ${error instanceof Error ? error.message : 'desconocido'}`,
      );
    }
  }

  private async createUserWithRetry(
    dto: CreateKeycloakUserDto,
    attempt: number,
  ): Promise<string> {
    if (attempt > 1) {
      throw new KeycloakProvisionError('Keycloak no disponible tras reintento');
    }

    this.logger.warn(`Reintentando creación usuario Keycloak (intento ${attempt + 1})`);
    await new Promise((r) => setTimeout(r, 1000));

    // Refrescar token por si expiró
    this.cachedToken = null;
    await this.getAccessToken();

    return this.createUser(dto); // Llamada recursiva con nuevo token
  }

  private async getAccessToken(): Promise<string> {
    const now = Date.now();

    if (this.cachedToken && this.cachedToken.expiresAt > now + 30_000) {
      return this.cachedToken.token;
    }

    const url = `${this.config.adminUrl}/realms/${this.config.realm}/protocol/openid-connect/token`;

    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    params.append('client_id', this.config.clientId);
    params.append('client_secret', this.config.clientSecret);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'sin cuerpo');
      throw new KeycloakProvisionError(
        `Error obteniendo token Keycloak (${response.status}): ${errorText}`,
        response.status,
      );
    }

    const data = (await response.json()) as KeycloakTokenResponse;

    this.cachedToken = {
      token: data.access_token,
      expiresAt: now + data.expires_in * 1000,
    };

    return data.access_token;
  }
}
