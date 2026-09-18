import { Module } from '@nestjs/common';

import { PeopleRelationshipsModule } from '../people-relationships/people-relationships.module';

import { HumanContextsService } from './human-contexts.service';
import { IdentityAccessService } from './identity-access.service';

/**
 * Resolución de PARTICIPACIONES de la persona autenticada
 * (IDENTITY-RELATIONSHIPS-CORE-01 §7).
 *
 * Es la pieza que traduce «quién es» en «qué participaciones tiene vivas»:
 * paciente propio, perfil profesional con vínculo vigente y —a través de la
 * política de relaciones— cuidadora.
 *
 * NO expone ningún endpoint por sí mismo y NO decide sobre recursos concretos:
 * solo resuelve participaciones. La autorización sobre un paciente concreto la
 * decide la política correspondiente en cada operación.
 *
 * Sus servicios se exportan para `VISITS-CORE-01`. Esta Task NO crea endpoints
 * ni modelos de Visitas.
 */
@Module({
  imports: [PeopleRelationshipsModule],
  providers: [IdentityAccessService, HumanContextsService],
  exports: [IdentityAccessService, HumanContextsService],
})
export class IdentityAccessModule {}
