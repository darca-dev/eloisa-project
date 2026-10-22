import { Module } from '@nestjs/common';

import { API_ENVIRONMENT, type ApiEnvironmentProvider } from '../config/api-environment.provider';
import { loadHumanAuthConfig } from '../human-auth/human-auth.config';
import { IdentityAccessModule } from '../identity-access/identity-access.module';

import { CareContextAuditService } from './care-context-audit.service';
import { CareContextDirectoryService } from './care-context-directory.service';
import { CARE_SESSION_LIMITS, type CareSessionLimits } from './care-context.contract';
import { CareContextPolicy } from './care-context.policy';
import { CareContextService } from './care-context.service';

/**
 * Custodia institucional de cuidado (SPEC 055 / MP01).
 *
 * Módulo INTERNO: no declara controladores. Lo consumen `care-records` y
 * `care-alerts` (MP02–MP03). Exporta `CareContextService` y la auditoría de
 * mutaciones; la política y el directorio no se usan por separado.
 *
 * Los límites de sesión se leen de la misma configuración que
 * `HumanAuthService`. Sin autenticación humana aprovisionada son `null` y la
 * política deniega.
 */
@Module({
  imports: [IdentityAccessModule],
  providers: [
    {
      provide: CARE_SESSION_LIMITS,
      inject: [API_ENVIRONMENT],
      useFactory: (environment: ApiEnvironmentProvider): CareSessionLimits | null => {
        const config = loadHumanAuthConfig(process.env, environment);
        return config.enabled ? { idleSeconds: config.sessionIdleSeconds } : null;
      },
    },
    CareContextAuditService,
    CareContextPolicy,
    CareContextDirectoryService,
    CareContextService,
  ],
  exports: [CareContextService, CareContextAuditService],
})
export class CareContextModule {}
