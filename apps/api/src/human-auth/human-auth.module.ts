import { Module } from '@nestjs/common';

import { IdentityAccessModule } from '../identity-access/identity-access.module';

import { HumanAuthController } from './human-auth.controller';
import { MeContextsController } from './me-contexts.controller';
import { HumanSessionModule } from './human-session.module';

/**
 * Identidad y sesión HUMANA (IDENTITY-RELATIONSHIPS-CORE-01 §4, §8.1).
 *
 * ALCANCE DECLARADO: es el núcleo compartido que autentica y atribuye a una
 * PERSONA. NO es el sistema completo de usuarios, roles y permisos de MERDN.
 *
 * Contiene UN solo flujo de autenticación (AD-01): OIDC Authorization Code con
 * PKCE S256 contra un único proveedor. NO existe segundo adapter, `dev-login`,
 * cabecera de identidad, contraseña MERDN ni sesión manual, y este módulo no
 * expone ninguna vía que permita crearlos.
 *
 * Es DISJUNTO del módulo institucional: distinta cookie, distinta tabla de
 * sesión, distinto validador y distinto principal. Una sesión humana nunca
 * autentica a una institución, y una sesión institucional nunca atribuye un
 * acto a una persona.
 *
 * `HumanSessionGuard` y `HumanAuthService` se exportan para los consumidores
 * futuros —`VISITS-CORE-01` entre ellos—, que necesitarán resolver el principal
 * humano sin reimplementar la validación de sesión.
 */
@Module({
  imports: [HumanSessionModule, IdentityAccessModule],
  controllers: [HumanAuthController, MeContextsController],
  exports: [HumanSessionModule],
})
export class HumanAuthModule {}
