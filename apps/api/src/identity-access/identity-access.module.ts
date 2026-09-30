import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { PeopleRelationshipsModule } from '../people-relationships/people-relationships.module';

import { ApprovedExperiencesService } from './approved-experiences.service';
import { HumanContextsService } from './human-contexts.service';
import { IdentityAccessService } from './identity-access.service';

/**
 * Resolución de PARTICIPACIONES de la persona autenticada
 * (IDENTITY-RELATIONSHIPS-CORE-01 §7; MP04 añade experiencias aprobadas).
 *
 * Es la pieza que traduce «quién es» en «qué participaciones tiene vivas»:
 * paciente propio, perfil profesional con vínculo vigente y —a través de la
 * política de relaciones— cuidadora.
 *
 * MP04 AÑADE `ApprovedExperiencesService`, que resuelve una pregunta DISTINTA y
 * convive aquí deliberadamente: participaciones y experiencias aprobadas se
 * derivan de las mismas tablas, y separarlas en dos módulos haría que cada una
 * acumulara su propia copia de los predicados. Lo que NO se fusiona es el
 * resultado: `HumanContextsService` sigue sin dar contexto `CAREGIVER` a un
 * cuidador sin relación, mientras que la experiencia aprobada de cuidador sí se
 * concede, porque son dos afirmaciones distintas sobre la misma persona.
 *
 * Importa `AuditModule` porque escribir el acceso y la denegación de
 * experiencia ocurre dentro de la propia consulta, y una dependencia declarada
 * se revisa antes que una implícita.
 *
 * NO expone ningún endpoint por sí mismo y NO decide sobre recursos concretos:
 * solo resuelve participaciones y experiencias. La autorización sobre un
 * paciente concreto la decide la política correspondiente en cada operación.
 *
 * Sus servicios se exportan para `VISITS-CORE-01`.
 */
@Module({
  imports: [AuditModule, PeopleRelationshipsModule],
  providers: [IdentityAccessService, HumanContextsService, ApprovedExperiencesService],
  exports: [IdentityAccessService, HumanContextsService, ApprovedExperiencesService],
})
export class IdentityAccessModule {}
