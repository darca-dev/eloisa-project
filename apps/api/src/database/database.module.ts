import { Global, Module } from '@nestjs/common';

import { API_ENVIRONMENT, apiEnvironmentProvider } from '../config/api-environment.provider';

import { PrismaService } from './prisma.service';
import { TenantContextService } from './tenant-context.service';

/**
 * Módulo de acceso a datos y contexto institucional (TASK-MVP-CORE-01).
 *
 * Es global porque la configuración validada, el cliente Prisma y el contexto
 * de tenant son transversales a los módulos de dominio. Global no significa
 * permisivo: cada repositorio sigue obligado a filtrar por `tenantId`.
 */
@Global()
@Module({
  providers: [apiEnvironmentProvider, PrismaService, TenantContextService],
  exports: [API_ENVIRONMENT, PrismaService, TenantContextService],
})
export class DatabaseModule {}
