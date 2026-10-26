import { randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { isMunicipalSection, validateMunicipalWrite, type MunicipalDocument, type MunicipalEntry, type MunicipalWrite } from '@merdn/shared';
import { PrismaService } from '../database/prisma.service';
import type { PrismaTransaction } from '../database/prisma-transaction';
import type { HumanPrincipal } from '../identity-access/human-principal';
import type { AuditEventType } from '../generated/prisma/enums';

@Injectable()
export class MunicipalityManagementService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async document(principal: HumanPrincipal, section: string, input?: unknown): Promise<MunicipalDocument> {
    if (!isMunicipalSection(section)) throw new BadRequestException({ code: 'MUNICIPAL_SECTION_INVALID', message: 'El apartado no es válido.' });
    if (input !== undefined) {
      const message = validateMunicipalWrite(section, input);
      if (message !== null) throw new BadRequestException({ code: 'MUNICIPAL_INPUT_INVALID', message });
    }
    const body = input as MunicipalWrite | undefined;
    const result = await this.prisma.withTenant(principal.tenantId, async tx => {
      // Serialize before reading version, then recheck authorization with a clock taken after every lock wait.
      if (body !== undefined) await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${principal.tenantId + ':' + section}, 0))`;
      const accounts = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "human_account" WHERE "id"=${principal.humanAccountId}::uuid AND "tenantId"=${principal.tenantId}::uuid AND "personId"=${principal.personId}::uuid AND "status"='ACTIVE' AND NOT "passwordRecoveryBlocked" FOR SHARE`;
      const now = new Date();
      const session = principal.externalAuthIdentityId === undefined ? null : await tx.humanSession.findFirst({ where: { id: principal.sessionId, tenantId: principal.tenantId, humanAccountId: principal.humanAccountId, externalAuthIdentityId: principal.externalAuthIdentityId, revokedAt: null, expiresAt: { gt: now } }, select: { id: true } });
      const capability = session === null ? null : await tx.institutionalIdentity.findFirst({ where: { tenantId: principal.tenantId, role: 'MUNICIPAL_VIEWER', status: 'ACTIVE', administratorRegistration: { tenantId: principal.tenantId, experience: 'MUNICIPALITY', status: 'CONFIRMED', humanAccountId: principal.humanAccountId, externalAuthIdentityId: principal.externalAuthIdentityId, externalIdentity: { tenantId: principal.tenantId, humanAccountId: principal.humanAccountId, status: 'ACTIVE' } } }, select: { id: true } });
      if (accounts.length !== 1 || session === null || capability === null) {
        await this.audit(tx, principal, 'MUNICIPAL_CONFIGURATION_DENIED', null, now, body !== undefined);
        return { denied: true as const };
      }
      const previous = await tx.municipalitySectionRevision.findFirst({ where: { tenantId: principal.tenantId, section }, orderBy: { version: 'desc' } });
      if (body !== undefined && body.expectedVersion !== (previous?.version ?? 0)) return { conflict: true as const };
      const row = body === undefined ? previous : await tx.municipalitySectionRevision.create({ data: { id: randomUUID(), tenantId: principal.tenantId, section, version: body.expectedVersion + 1, payloadSchemaVersion: 1, payload: JSON.parse(JSON.stringify(body.entries)) as object[], createdByHumanAccountId: principal.humanAccountId } });
      await this.audit(tx, principal, body === undefined ? 'MUNICIPAL_CONFIGURATION_READ' : 'MUNICIPAL_CONFIGURATION_SAVED', row?.id ?? null, now, body !== undefined);
      return { document: { section, version: row?.version ?? 0, payloadSchemaVersion: 1 as const, entries: (row?.payload ?? []) as unknown as readonly MunicipalEntry[], updatedAt: row?.createdAt.toISOString() ?? null } };
    });
    if ('denied' in result) throw new ForbiddenException({ code: 'MUNICIPAL_ADMINISTRATOR_REQUIRED', message: 'Esta operación requiere la cuenta administradora de Alcaldía.' });
    if ('conflict' in result) throw new ConflictException({ code: 'MUNICIPAL_VERSION_CONFLICT', message: 'Otra ventana guardó cambios. Recargue el apartado antes de editar nuevamente.' });
    return result.document;
  }

  private async audit(tx: PrismaTransaction, principal: HumanPrincipal, eventType: AuditEventType, resourceId: string | null, occurredAt: Date, writing: boolean) {
    await tx.auditEvent.create({ data: { tenantId: principal.tenantId, eventType, actorType: 'HUMAN_ACCOUNT', actorUserId: principal.humanAccountId, actorRole: null, resourceType: 'MunicipalitySectionRevision', resourceId, outcome: eventType === 'MUNICIPAL_CONFIGURATION_DENIED' ? 'DENIED' : 'SUCCESS', endpoint: `${writing ? 'PUT' : 'GET'} /api/v1/municipality/management/:section`, correlationId: randomUUID(), occurredAt } });
  }
}
