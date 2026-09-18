import { Module } from '@nestjs/common';

import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { HospitalModule } from './hospital/hospital.module';
import { HumanAuthModule } from './human-auth/human-auth.module';
import { IdentityAccessModule } from './identity-access/identity-access.module';
import { InstitutionalAuthModule } from './institutional-auth/institutional-auth.module';
import { MunicipalityModule } from './municipality/municipality.module';
import { PatientSelfModule } from './patient-self/patient-self.module';
import { PatientsModule } from './patients/patients.module';
import { PeopleRelationshipsModule } from './people-relationships/people-relationships.module';
import { VisitsModule } from './visits/visits.module';

/**
 * Raíz modular de la API MERDN.
 *
 * TASK-001 registró exclusivamente el módulo técnico de salud.
 * TASK-MVP-CORE-01 añade el acceso a datos y la rama Paciente de la inscripción.
 *
 * TASK-MUNICIPALITY-CORE-01 añade la identidad y la sesión institucional
 * mínimas, y la superficie municipal AGREGADA de Alcaldía. No añade acceso
 * individual de ningún tipo: los dos módulos nuevos solo leen agregados del
 * tenant resuelto en el servidor.
 *
 * TASK-HOSPITAL-CORE-01 añade la superficie Hospital de Pacientes: tres lecturas
 * de SOLO LECTURA sobre las mismas entidades canónicas `Person` y `Patient`,
 * protegidas por un rol institucional propio y disjunto del municipal. NO crea
 * una identidad de persona hospitalaria, no crea una base paralela y no habilita
 * Agenda, Visitas, Consultas virtuales, Finanzas ni Reportes.
 *
 * IDENTITY-RELATIONSHIPS-CORE-01 añade el NÚCLEO COMPARTIDO de identidad
 * humana: autentica y atribuye a una persona mediante `HumanAccount -> Person`
 * con un único flujo OIDC, resuelve server-side sus participaciones de paciente
 * y profesional, y modela la relación Paciente–Cuidador con finalidad, vigencia
 * y un alcance de SOLO LECTURA sobre visitas. NO implementa Visitas, NO crea UI
 * y NO sustituye el sistema completo de usuarios, roles y permisos.
 *
 * VISITS-CORE-01 añade el módulo de Visitas domiciliarias y expone por HTTP lo
 * que sus paquetes previos ya implementaron: la materialización institucional de
 * una cita `HOME` ya `ASSIGNED`, la consulta autorizada de UNA visita por su
 * profesional asignada y las tres transiciones profesionales —iniciar,
 * completar, dar por no realizada—, con control optimista, historial
 * append-only y auditoría atómica. NO abre listados, superficie de cuidador o de
 * paciente, notas, evidencia, dirección, GPS, archivos, cancelación, UI ni
 * Reportes.
 *
 * PACIENTE-MVP-021 MP02 añade la lectura SELF-SCOPE del Paciente: tres rutas de
 * SOLO LECTURA que sirven a la persona autenticada su propio resumen, sus
 * próximas citas y sus visitas recientes. NO crea dominio, NO crea modelos, NO
 * migra el esquema, NO escribe dato de negocio y NO abre superficie de cuidador
 * ni de profesional: reutiliza la sesión humana, `resolvePatient` y la auditoría
 * ya existentes.
 *
 * Los demás módulos de dominio (personal de cuidado, programas, evidencias,
 * finanzas, indicadores, Hub institucional, integraciones) se incorporarán
 * mediante Task Specifications aprobadas posteriores.
 */
@Module({
  imports: [
    DatabaseModule,
    HealthModule,
    PatientsModule,
    InstitutionalAuthModule,
    MunicipalityModule,
    HospitalModule,
    PeopleRelationshipsModule,
    IdentityAccessModule,
    HumanAuthModule,
    VisitsModule,
    PatientSelfModule,
  ],
})
export class AppModule {}
