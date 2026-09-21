import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { PrismaService } from '../database/prisma.service';
import { TenantContextService } from '../database/tenant-context.service';

/**
 * Job nocturno para expirar relaciones paciente-cuidador (Spec 028 RF-01).
 *
 * Se ejecuta cada día a las 02:00 UTC y actualiza el estado de las relaciones
 * que tienen `endsAt < NOW()` y `status = 'ACTIVE'` a `'EXPIRED'`.
 *
 * La expiración se deriva SIEMPRE del campo `endsAt` contra la fecha actual,
 * nunca de la pertenencia persistida (consistencia con la derivación de 60+).
 *
 * No emite eventos de auditoría por cada expiración individual: la traza
 * queda en los logs del job. Si se requiere auditoría por relación,
 * se puede extender en el futuro.
 */
@Injectable()
export class ExpireRelationshipsJob {
  private readonly logger = new Logger(ExpireRelationshipsJob.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenants: TenantContextService,
  ) {}

  /**
   * Ejecuta el job cada día a las 02:00 UTC.
   *
   * `CronExpression.EVERY_DAY_AT_2AM` = '0 2 * * *'
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM, {
    name: 'expire-caregiver-relationships',
    timeZone: 'UTC',
  })
  async run(): Promise<void> {
    const now = new Date();
    this.logger.log(`Iniciando expiración de relaciones paciente-cuidador (${now.toISOString()})`);

    try {
      const { tenantId } = await this.tenants.resolveActiveTenant();

      const result = await this.prisma.withTenant(tenantId, async (tx) => {
        const updated = await tx.patientCaregiverRelationship.updateMany({
          where: {
            tenantId,
            status: 'ACTIVE',
            endsAt: {
              not: null,
              lt: now,
            },
          },
          data: {
            status: 'EXPIRED',
          },
        });

        return updated.count;
      });

      this.logger.log(`Expiración completada: ${result} relaciones actualizadas a EXPIRED`);
    } catch (error) {
      this.logger.error(`Error en job de expiración: ${error instanceof Error ? error.message : 'desconocido'}`);
      // No re-lanzamos: el job no debe romper la aplicación
    }
  }

  /**
   * Método público para ejecución manual (testing, debugging).
   */
  async runManual(): Promise<number> {
    const now = new Date();
    this.logger.log(`Ejecución manual de expiración (${now.toISOString()})`);

    const { tenantId } = await this.tenants.resolveActiveTenant();

    const result = await this.prisma.withTenant(tenantId, async (tx) => {
      const updated = await tx.patientCaregiverRelationship.updateMany({
        where: {
          tenantId,
          status: 'ACTIVE',
          endsAt: {
            not: null,
            lt: new Date(),
          },
        },
        data: {
          status: 'EXPIRED',
        },
      });

      return updated.count;
    });

    this.logger.log(`Expiración manual completada: ${result} relaciones actualizadas`);
    return result;
  }
}