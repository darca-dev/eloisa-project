import { Module } from '@nestjs/common';

import { HospitalPatientViewerGuard } from './hospital-patient-viewer.guard';
import { InstitutionalAuditService } from './institutional-audit.service';
import { InstitutionalAuthController } from './institutional-auth.controller';
import { InstitutionalAuthService } from './institutional-auth.service';
import { InstitutionalSameOriginGuard } from './institutional-same-origin.guard';
import { InstitutionalSessionGuard } from './institutional-session.guard';
import { InstitutionalSignInRateLimitGuard } from './institutional-signin-rate-limit.guard';
import { MunicipalViewerGuard } from './municipal-viewer.guard';

/**
 * Identidad y sesión institucional mínimas (TASK-MUNICIPALITY-CORE-01, OD-01).
 *
 * ALCANCE DECLARADO: NO es el sistema completo de usuarios, roles y permisos de
 * MERDN. Es una identidad de institución con un único rol de consulta agregada,
 * pensada para que la autorización municipal viva en el servidor desde el
 * primer día y pueda sustituirse después sin tocar los controladores ni la UI.
 *
 * TASK-HOSPITAL-CORE-01 amplía el módulo de forma ADITIVA: añade el guard del
 * rol hospitalario y NO crea un segundo sistema de sesión. Sigue habiendo una
 * cookie, una tabla de sesión y un solo servicio de validación; lo que cambia es
 * que la identidad persistida puede llevar uno de dos roles disjuntos.
 *
 * El módulo se exporta para que otras experiencias institucionales futuras
 * reutilicen los guards y el servicio en lugar de duplicar autenticación.
 *
 * MP-TODAY-01 añade DOS guards, también de forma ADITIVA y sin tocar los roles
 * ni los guards de rol existentes:
 * - `InstitutionalSessionGuard`, que AUTENTICA la sesión sin exigir rol y hace
 *   posible que cualquier identidad institucional cierre la suya;
 * - `InstitutionalSameOriginGuard`, que comprueba el origen declarado en las
 *   dos operaciones que cambian estado —abrir y cerrar la sesión—.
 *
 * Ninguno de los dos concede acceso a datos: la autorización de Hospital, de
 * Municipality y de las relaciones de cuidado sigue en sus guards de rol.
 */
@Module({
  controllers: [InstitutionalAuthController],
  providers: [
    InstitutionalAuditService,
    InstitutionalAuthService,
    InstitutionalSignInRateLimitGuard,
    InstitutionalSameOriginGuard,
    InstitutionalSessionGuard,
    MunicipalViewerGuard,
    HospitalPatientViewerGuard,
  ],
  exports: [
    InstitutionalAuditService,
    InstitutionalAuthService,
    MunicipalViewerGuard,
    HospitalPatientViewerGuard,
  ],
})
export class InstitutionalAuthModule {}
