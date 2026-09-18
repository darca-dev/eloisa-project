import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { HumanAuthModule } from '../human-auth/human-auth.module';
import { SameOriginGuard } from '../human-auth/same-origin.guard';
import { HospitalSchedulerGuard } from '../institutional-auth/hospital-scheduler.guard';
import { InstitutionalAuthModule } from '../institutional-auth/institutional-auth.module';
import { InstitutionalSameOriginGuard } from '../institutional-auth/institutional-same-origin.guard';

import { HomeVisitMaterializationService } from './home-visit-materialization.service';
import { HomeVisitTransitionService } from './home-visit-transition.service';
import { ProfessionalVisitQueryService } from './professional-visit-query.service';
import { ProfessionalVisitWorklistService } from './professional-visit-worklist.service';
import {
  ProfessionalVisitsController,
  VisitsMaterializationController,
} from './visits.controller';

/**
 * Visitas domiciliarias (VISITS-CORE-01 MP04).
 *
 * ALCANCE DECLARADO: expone por HTTP lo que MP02 y MP03 ya implementaron —la
 * materialización institucional y las tres transiciones profesionales—, la
 * lectura autorizada de UNA visita (MP04) y, desde VISITADOR-CORE-01 MP01, la
 * WORKLIST de solo lectura con la que la persona profesional descubre su propia
 * agenda domiciliaria. NO crea dominio nuevo, NO crea modelos de datos, NO crea
 * UI y NO abre cuidador, paciente, notas, evidencia, dirección, GPS, archivos,
 * cancelación ni Reportes.
 *
 * La worklist REUTILIZA los mismos núcleos y la misma barrera que MP03 y MP04
 * —`HumanSession` → `HumanPrincipal` → `ProfessionalProfile` →
 * `ProfessionalAffiliation` → `CareAssignment` → `Appointment` → `HomeVisit`— y
 * NO duplica dominio: es una LECTURA más sobre las filas que esos paquetes ya
 * gobiernan.
 *
 * REUTILIZACIÓN, NO DUPLICACIÓN: importa la autenticación institucional y la
 * humana en lugar de crear una propia. Hospital y la superficie profesional son
 * experiencias DIFERENCIADAS sobre capacidades COMPARTIDAS: comparten identidad,
 * sesión, cookie, auditoría y acceso a datos, y se separan exclusivamente por su
 * principal y por su superficie.
 *
 * LOS CUATRO GUARDS SE DECLARAN COMO PROVEEDORES AQUÍ siguiendo el patrón ya
 * establecido en `HospitalModule` y en `PeopleRelationshipsModule`: el archivo
 * del guard vive en el módulo que define su semántica, y cada módulo consumidor
 * lo provee. `@UseGuards(Clase)` obliga a Nest a resolver la instancia en el
 * módulo del controlador, de modo que sin estas declaraciones la aplicación no
 * arrancaría. Así no se amplía la superficie EXPORTADA de los módulos de
 * autenticación sin necesidad y no se crea un ciclo entre módulos.
 *
 * `AuditModule` se importa porque los servicios de MP02 y MP03 escriben su
 * evento de auditoría DENTRO de la misma transacción: sin él no habría
 * materialización ni transición posible, que es exactamente el comportamiento
 * fail-closed que esos paquetes aprobaron.
 */
@Module({
  imports: [AuditModule, InstitutionalAuthModule, HumanAuthModule],
  controllers: [VisitsMaterializationController, ProfessionalVisitsController],
  providers: [
    HomeVisitMaterializationService,
    HomeVisitTransitionService,
    ProfessionalVisitQueryService,
    ProfessionalVisitWorklistService,
    HospitalSchedulerGuard,
    InstitutionalSameOriginGuard,
    SameOriginGuard,
  ],
})
export class VisitsModule {}
