import { Inject, Injectable } from '@nestjs/common';

import { API_ENVIRONMENT, type ApiEnvironmentProvider } from '../config/api-environment.provider';
import { type PrismaTransaction } from '../database/prisma-transaction';

/**
 * Registro versionado del consentimiento (TASK-MVP-CORE-01 §4, decisión 18.4).
 *
 * CORE-01 conserva la aceptación del texto YA EXISTENTE en la pantalla de
 * confirmación aprobada. No introduce texto legal nuevo, no reinterpreta la Ley
 * 1581 de 2012 y no infiere finalidades adicionales.
 *
 * El booleano que envía el cliente solo comunica aceptación. La versión, la
 * finalidad y la fecha las asigna el servidor.
 */
@Injectable()
export class ConsentService {
  constructor(
    @Inject(API_ENVIRONMENT) private readonly environment: ApiEnvironmentProvider,
  ) {}

  /** Versión de consentimiento vigente según configuración del despliegue. */
  public get currentVersion(): string {
    return this.environment.consent.version;
  }

  /**
   * Persiste la aceptación dentro de la transacción de inscripción. La fecha de
   * aceptación es la del servidor: nunca la propone el cliente.
   */
  public async recordWithin(
    tx: PrismaTransaction,
    input: { readonly tenantId: string; readonly patientId: string },
    acceptedAt: Date,
  ): Promise<string> {
    const record = await tx.consentRecord.create({
      data: {
        tenantId: input.tenantId,
        patientId: input.patientId,
        consentVersion: this.environment.consent.version,
        consentType: 'PERSONAL_AND_HEALTH_DATA_PROCESSING',
        purpose: this.environment.consent.purpose,
        acceptedAt,
      },
      select: { id: true },
    });

    return record.id;
  }
}
