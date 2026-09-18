import { Module } from '@nestjs/common';

import { AuditService } from './audit.service';
import { IdentityAuditService } from './identity-audit.service';

/**
 * Auditoría mínima de CORE-01. No es el sistema completo de auditoría.
 *
 * IDENTITY-RELATIONSHIPS-CORE-01 la amplía de forma ADITIVA con los eventos de
 * identidad humana y de relación Paciente–Cuidador. No cambia ningún evento
 * existente, no reinterpreta ninguna fila ya registrada y conserva el carácter
 * append-only de `audit_event`.
 */
@Module({
  providers: [AuditService, IdentityAuditService],
  exports: [AuditService, IdentityAuditService],
})
export class AuditModule {}
