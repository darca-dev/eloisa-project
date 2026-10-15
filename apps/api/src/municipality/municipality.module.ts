import { Module } from '@nestjs/common';

import { InstitutionalAuthModule } from '../institutional-auth/institutional-auth.module';

import { MunicipalAggregateAccessGuard } from './municipal-aggregate-access.guard';
import { MunicipalityController } from './municipality.controller';
import { MunicipalityService } from './municipality.service';
import { HumanSessionModule } from '../human-auth/human-session.module';
import { MunicipalityManagementController } from './municipality-management.controller';
import { MunicipalityManagementService } from './municipality-management.service';

/**
 * Superficie municipal agregada (TASK-MUNICIPALITY-CORE-01).
 *
 * Contiene únicamente las dos lecturas agregadas de Alcaldía. La identidad, la
 * sesión y la autorización viven en `InstitutionalAuthModule` y aquí solo se
 * consumen: Alcaldía no duplica autenticación ni crea un producto aislado.
 *
 * Fuera de este módulo y de esta Task: programas, presupuesto y ejecución,
 * evidencias, indicadores institucionales, marcos normativos, agenda, visitas,
 * personas cuidadoras y cualquier acceso a un paciente concreto.
 */
@Module({
  imports: [InstitutionalAuthModule, HumanSessionModule],
  controllers: [MunicipalityController, MunicipalityManagementController],
  providers: [MunicipalityService, MunicipalAggregateAccessGuard, MunicipalityManagementService],
})
export class MunicipalityModule {}
