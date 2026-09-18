import { Module } from '@nestjs/common';

import { InstitutionalAuthModule } from '../institutional-auth/institutional-auth.module';
import { HospitalSchedulerGuard } from '../institutional-auth/hospital-scheduler.guard';

import { HospitalAgendaController } from './hospital-agenda.controller';
import { HospitalAgendaService } from './hospital-agenda.service';
import { HospitalAppointmentAssignmentController } from './hospital-appointment-assignment.controller';
import { HospitalAppointmentAssignmentService } from './hospital-appointment-assignment.service';
import { HospitalPatientAccessGuard } from './hospital-patient-access.guard';
import { HospitalPatientsController } from './hospital-patients.controller';
import { HospitalPatientsService } from './hospital-patients.service';
import { HospitalProfessionalsController } from './hospital-professionals.controller';
import { HospitalProfessionalsService } from './hospital-professionals.service';

/**
 * Experiencia Hospital: superficies de Pacientes y de Operaciones
 * (TASK-HOSPITAL-CORE-01 y TASK-HOSPITAL-CORE-02).
 *
 * ALCANCE DECLARADO:
 *
 * - PACIENTES (CORE-01): tres lecturas de SOLO LECTURA sobre `Person` y
 *   `Patient`, acotadas al tenant institucional que el servidor resuelve;
 * - OPERACIONES (CORE-02): dos lecturas —directorio de Profesionales y Agenda—
 *   y UNA sola mutación, que asigna una solicitud existente a un profesional
 *   existente.
 *
 * NO incluye Visitas domiciliarias, Consultas virtuales, Cuidadores, Programas,
 * Condiciones, Alertas, Semáforo, Finanzas, Membresías, Personal, Reportes ni
 * exportación. Que exista una `modality` de agenda no abre ninguno de esos
 * módulos: es una clasificación, no una capacidad.
 *
 * REUTILIZACIÓN, NO DUPLICACIÓN: importa `InstitutionalAuthModule` en lugar de
 * crear una autenticación hospitalaria propia. Hospital y Alcaldía son
 * experiencias DIFERENCIADAS sobre capacidades COMPARTIDAS: comparten identidad,
 * sesión, cookie, auditoría y acceso a datos, y se separan exclusivamente por su
 * rol y por su superficie.
 *
 * ROLES DISJUNTOS: `HOSPITAL_PATIENT_VIEWER` sigue siendo de SOLO LECTURA sobre
 * Pacientes y no gana ninguna escritura; `HOSPITAL_SCHEDULER` solo alcanza las
 * tres rutas de operaciones y no obtiene acceso a Pacientes ni a Alcaldía.
 *
 * `HospitalSchedulerGuard` se declara como proveedor AQUÍ —y no se exporta desde
 * `InstitutionalAuthModule`— porque solo esta experiencia lo usa: no se amplía
 * la superficie exportada del módulo institucional sin necesidad.
 */
@Module({
  imports: [InstitutionalAuthModule],
  controllers: [
    HospitalPatientsController,
    HospitalProfessionalsController,
    HospitalAgendaController,
    HospitalAppointmentAssignmentController,
  ],
  providers: [
    HospitalPatientsService,
    HospitalPatientAccessGuard,
    HospitalProfessionalsService,
    HospitalAgendaService,
    HospitalAppointmentAssignmentService,
    HospitalSchedulerGuard,
  ],
})
export class HospitalModule {}
