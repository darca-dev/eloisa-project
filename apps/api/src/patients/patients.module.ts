import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { ConsentModule } from '../consents/consent.module';
import { EnrollmentSessionModule } from '../enrollment-sessions/enrollment-session.module';
import { TerritoryModule } from '../territory/territory.module';

import { EnrollmentRateLimitGuard } from './enrollment-rate-limit.guard';
import { KeycloakAdminClient } from './keycloak-admin.client';
import { PatientEnrollmentController } from './patient-enrollment.controller';
import { PatientEnrollmentService } from './patient-enrollment.service';

/**
 * Módulo de pacientes (TASK-MVP-CORE-01).
 *
 * Contiene únicamente la rama Paciente de la inscripción y su recuperación por
 * sesión. Cuidador, profesional, agenda, hospital, alcaldía, programas y
 * finanzas quedan expresamente fuera de este módulo y de esta tarea.
 */
@Module({
  imports: [TerritoryModule, ConsentModule, EnrollmentSessionModule, AuditModule],
  controllers: [PatientEnrollmentController],
  providers: [PatientEnrollmentService, EnrollmentRateLimitGuard, KeycloakAdminClient],
})
export class PatientsModule {}
