import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { HumanAuthModule } from '../human-auth/human-auth.module';
import { IdentityAccessModule } from '../identity-access/identity-access.module';

import { PatientSelfController } from './patient-self.controller';
import { PatientSelfService } from './patient-self.service';

/**
 * Lectura SELF-SCOPE del Paciente (spec 021, Micro-packet 2).
 *
 * ALCANCE DECLARADO: tres lecturas de SOLO LECTURA sobre las filas que otros
 * paquetes ya gobiernan —`Patient`, `Person`, `Appointment` y `HomeVisit`—,
 * servidas EXCLUSIVAMENTE a la persona que es su sujeto. NO crea dominio nuevo,
 * NO crea modelos de datos, NO crea migración, NO escribe dato de negocio
 * alguno, NO abre superficie de cuidador ni de profesional, y NO añade ninguna
 * dependencia.
 *
 * REUTILIZACIÓN, NO DUPLICACIÓN. Este módulo no implementa autenticación,
 * contexto, tenant, Row Level Security ni auditoría: los importa.
 *
 * - `HumanAuthModule` aporta el `HumanSessionGuard` YA EXISTENTE, que es el
 *   único que puede construir un `HumanPrincipal`. Este módulo no lo modifica y
 *   no crea un guard propio: una segunda comprobación de sesión sería una
 *   segunda oportunidad de equivocarse.
 * - `IdentityAccessModule` aporta `resolvePatient`, que se usa TAL CUAL. Es la
 *   pieza que garantiza que el sujeto SALE del servidor y no ENTRA del cliente.
 * - `AuditModule` aporta el `AuditService` existente, donde el Micro-packet 1
 *   dejó los dos eventos del acceso propio. NO se crea un servicio de auditoría
 *   propio del módulo (§17.D-1): duplicarlo duplicaría la superficie de
 *   seguridad sin ganar nada.
 *
 * Su importación es además FUNCIONALMENTE OBLIGATORIA y no decorativa: la
 * auditoría se escribe dentro de la misma transacción que sirve los datos, de
 * modo que sin `AuditModule` no habría lectura posible. Ese es exactamente el
 * comportamiento fail-closed que la spec aprobó (§9.2-6).
 *
 * El módulo NO exporta nada: su superficie es HTTP y ningún otro módulo debe
 * consumir esta lectura por dentro. Lo que otro módulo necesite de un paciente,
 * lo pedirá bajo su propia autorización, no bajo la del sujeto.
 */
@Module({
  imports: [HumanAuthModule, IdentityAccessModule, AuditModule],
  controllers: [PatientSelfController],
  providers: [PatientSelfService],
})
export class PatientSelfModule {}
