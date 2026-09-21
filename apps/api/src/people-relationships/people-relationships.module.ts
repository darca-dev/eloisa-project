import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

import { AuditModule } from '../audit/audit.module';
import { SameOriginGuard } from '../human-auth/same-origin.guard';
import { CaregiverRelationshipManagerGuard } from '../institutional-auth/caregiver-relationship-manager.guard';
import { InstitutionalAuthModule } from '../institutional-auth/institutional-auth.module';

import { CaregiverRelationshipController } from './caregiver-relationship.controller';
import { CaregiverRelationshipPolicy } from './caregiver-relationship.policy';
import { CaregiverRelationshipService } from './caregiver-relationship.service';
import { ExpireRelationshipsJob } from './expire-relationships.job';

/**
 * Relación Paciente–Cuidador (IDENTITY-RELATIONSHIPS-CORE-01 §6, §7.2, §8.2).
 *
 * ALCANCE DECLARADO: modela y gobierna UNA relación M:N con finalidad, vigencia
 * y un alcance único de SOLO LECTURA sobre visitas. NO es el sistema completo de
 * relaciones, consentimientos ni representación de MERDN.
 *
 * Contiene dos piezas con públicos distintos:
 *
 * - la superficie de GESTIÓN, para el operador institucional con el rol
 *   `CAREGIVER_RELATIONSHIP_MANAGER`;
 * - la POLÍTICA de autorización, que se exporta para que `VISITS-CORE-01`
 *   decida si una persona cuidadora puede ver las visitas de un paciente. Esta
 *   Task NO crea endpoints ni modelos de Visitas.
 *
 * Los dos guards se declaran como proveedores AQUÍ, siguiendo el patrón ya
 * establecido para los guards institucionales: el archivo del guard vive en el
 * módulo que define su semántica, y cada módulo consumidor lo provee. Así no
 * hace falta importar el módulo de autenticación humana y no se crea un ciclo
 * entre módulos.
 */
@Module({
  imports: [AuditModule, InstitutionalAuthModule, ScheduleModule.forRoot()],
  controllers: [CaregiverRelationshipController],
  providers: [
    CaregiverRelationshipService,
    CaregiverRelationshipPolicy,
    CaregiverRelationshipManagerGuard,
    SameOriginGuard,
    ExpireRelationshipsJob,
  ],
  exports: [CaregiverRelationshipPolicy],
})
export class PeopleRelationshipsModule {}
