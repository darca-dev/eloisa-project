import { Module } from '@nestjs/common';

import { AuditService } from '../audit/audit.service';
import { InstitutionalAuthModule } from '../institutional-auth/institutional-auth.module';
import { HumanSessionModule } from '../human-auth/human-session.module';
import { AccessPasswordRecoveryController } from './access-password-recovery.controller';
import { AccessPasswordRecoveryService } from './access-password-recovery.service';
import { AccessRecoveryRateLimitGuard } from './access-recovery.rate-limit.guard';

import { AccessProvisioningIdentityClient, SystemAccessProvisioningBackoff, ACCESS_PROVISIONING_BACKOFF } from './access-provisioning-identity.client';
import { AccessProvisioningService } from './access-provisioning.service';
import { AccessRequestsController } from './access-request.controller';
import { AccessRequestOriginGuard } from './access-request.origin.guard';
import { AccessRequestRateLimitGuard } from './access-request.rate-limit.guard';
import { AccessRequestsService } from './access-request.service';
import { HospitalAccessRequestReviewController } from './access-request-review.controller';
import { HospitalAccessReviewerGuard } from './access-request-review.guard';
import { AccessRequestReviewService } from './access-request-review.service';

/**
 * Módulo de solicitudes de acceso (SPEC 038, MP02-C1; ampliado por MP03-C1 y MP04).
 *
 * Es deliberadamente pequeño: un controlador, un servicio transaccional, la
 * barrera de origen, el límite de peticiones, la superficie institucional de
 * revisión y la provisión de identidad. NO importa `PatientsModule` ni
 * reutiliza su guard, porque ese guard lanza un código de error del dominio de
 * inscripción y este endpoint no es de inscripción. Lo que sí comparte es la
 * CONFIGURACIÓN del límite —`enrollmentRateLimit`, ya validada al arrancar— y la
 * función pura de comprobación de origen, que se importa directamente y no se
 * reimplementa.
 *
 * `AuditService` se provee aquí de forma explícita y no por `DatabaseModule`: el
 * módulo global expone la configuración, el cliente Prisma y el contexto de
 * tenant, y la auditoría debe seguir declarándose como dependencia visible de
 * quien escribe, para que una revisión pueda confirmar que la escritura de datos
 * y su evento se declaran juntas.
 *
 * `DatabaseModule` es global, de modo que `PrismaService` y
 * `TenantContextService` quedan disponibles sin volver a importarlos.
 *
 * MP04 AÑADE la provisión de cuentas. `AccessProvisioningIdentityClient` se
 * declara con SU token de backoff: el backoff es tiempo, y el tiempo no debe
 * ejecutarse en una prueba. Ambos se declaran AQUÍ y no en un módulo global
 * para que la dependencia quede visible en el único módulo que los usa.
 *
 * Importa `InstitutionalAuthModule` —y no el `@Injectable()` suelto— para
 * reutilizar la ÚNICA autenticación y la ÚNICA comprobación de origen que ya
 * existen. No hay un segundo `AuthService`, ni una segunda cookie, ni una segunda
 * lista de orígenes permitidos: tres de esos duplicados discreparían entre sí en
 * el primer cambio y la superficie con la copia desalineada sería la que fallaría
 * en silencio. El guard de origen se declara solo en la ruta que cambia estado.
 */
@Module({
  imports: [InstitutionalAuthModule, HumanSessionModule],
  controllers: [AccessRequestsController, HospitalAccessRequestReviewController, AccessPasswordRecoveryController],
  providers: [
    AccessRequestsService,
    AccessPasswordRecoveryService,
    AccessRecoveryRateLimitGuard,
    AccessRequestReviewService,
    AccessProvisioningService,
    AccessProvisioningIdentityClient,
    { provide: ACCESS_PROVISIONING_BACKOFF, useClass: SystemAccessProvisioningBackoff },
    AccessRequestOriginGuard,
    AccessRequestRateLimitGuard,
    HospitalAccessReviewerGuard,
    AuditService,
  ],
})
export class AccessRequestsModule {}
