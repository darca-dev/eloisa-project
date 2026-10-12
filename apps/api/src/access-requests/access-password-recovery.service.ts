import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
// Nest requires runtime class metadata for dependency injection.
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { PrismaService } from '../database/prisma.service';
import { type PrismaTransaction } from '../database/prisma-transaction';
import { type HumanPrincipal } from '../identity-access/human-principal';
import { FRESH_AUTHENTICATION_SECONDS } from '../human-auth/fresh-authentication';
import { HUMAN_SESSION_IDLE_SECONDS } from '../human-auth/human-auth.contract';
import { AccessProvisioningIdentityClient } from './access-provisioning-identity.client';
import { RECOVERY_ABANDONED_AFTER_MS, RECOVERY_STATES, type RecoveryOperationDto, type RecoveryState, validateRecoveryInput } from './access-password-recovery.contract';
import { API_ENVIRONMENT, type ApiEnvironmentProvider } from '../config/api-environment.provider';

@Injectable()
export class AccessPasswordRecoveryService {
  constructor(private readonly prisma: PrismaService, private readonly identity: AccessProvisioningIdentityClient,
    @Inject(API_ENVIRONMENT) private readonly environment: ApiEnvironmentProvider) {}

  public async status(principal: HumanPrincipal, requestId: string, now: Date) {
    return this.prisma.withTenant(principal.tenantId, async tx => {
      const fresh = await this.authorize(tx, principal, now, false);
      const request = await tx.accessRequest.findFirst({ where: { id: requestId, tenantId: principal.tenantId },
        select: { id: true, status: true, humanAccountId: true, externalAuthIdentityId: true } });
      if (request === null) return this.missing();
      const latest = await tx.accessPasswordRecovery.findFirst({ where: { tenantId: principal.tenantId, accessRequestId: requestId }, orderBy: { createdAt: 'desc' } });
      const eligible = request.status === 'APPROVED' && request.humanAccountId !== null && request.externalAuthIdentityId !== null
        && await this.eligibleTarget(tx, principal.tenantId, request.humanAccountId, request.externalAuthIdentityId);
      return { operation: latest === null ? null : this.project(latest), canRecover: eligible && latest?.state !== 'PENDING',
        requiresReauthentication: !fresh,
        canReconcile: latest?.state === 'PENDING' && now.getTime() - latest.createdAt.getTime() >= RECOVERY_ABANDONED_AFTER_MS };
    });
  }

  public async reset(principal: HumanPrincipal, requestId: string, raw: unknown, now: Date): Promise<RecoveryOperationDto> {
    const input = validateRecoveryInput(raw);
    const tenantId = principal.tenantId;
    const started = await this.prisma.withTenant(tenantId, async tx => {
      await this.authorize(tx, principal, now, true);
      // Every recovery and decision uses request -> account ordering.
      await this.lockRequest(tx, tenantId, requestId);
      const previous = await tx.accessPasswordRecovery.findFirst({ where: { id: input.operationId, tenantId } });
      if (previous !== null) {
        if (previous.accessRequestId !== requestId || previous.actorHumanAccountId !== principal.humanAccountId) return this.conflict();
        return { kind: 'replay' as const, replay: this.project(previous) };
      }
      const request = await tx.accessRequest.findFirst({ where: { id: requestId, tenantId },
        select: { version: true, status: true, humanAccountId: true, externalAuthIdentityId: true } });
      if (request === null) return this.missing();
      if (request.status !== 'APPROVED' || request.version !== input.expectedVersion
        || request.humanAccountId === null || request.externalAuthIdentityId === null) return this.conflict();
      const accountId = request.humanAccountId; const bindingId = request.externalAuthIdentityId;
      await this.lockAccount(tx, tenantId, accountId);
      if (!await this.eligibleTarget(tx, tenantId, accountId, bindingId)) return this.conflict();
      const account = await tx.humanAccount.findFirstOrThrow({ where: { id: accountId, tenantId } });
      const pending = await tx.accessPasswordRecovery.findFirst({ where: { tenantId, targetHumanAccountId: accountId, state: 'PENDING' } });
      if (pending !== null) return this.conflict();
      if (account.passwordRecoveryBlocked) {
        if (input.predecessorId === null) return this.conflict();
        const predecessor = await tx.accessPasswordRecovery.findFirst({ where: { id: input.predecessorId, tenantId, targetHumanAccountId: accountId, accessRequestId: requestId, state: 'UNCERTAIN' } });
        if (predecessor === null) return this.conflict();
        await tx.accessPasswordRecovery.update({ where: { id: predecessor.id }, data: { state: 'SUPERSEDED' } });
        await this.audit(tx, principal, predecessor.id, 'ACCESS_PASSWORD_RECOVERY_SUPERSEDED', now);
      } else if (account.status !== 'ACTIVE' || input.predecessorId !== null) return this.conflict();
      const binding = await tx.externalAuthIdentity.findFirstOrThrow({ where: { id: bindingId, tenantId, humanAccountId: accountId, status: 'ACTIVE' }, select: { subject: true } });
      const operation = await tx.accessPasswordRecovery.create({ data: {
        id: input.operationId, tenantId, accessRequestId: requestId, targetHumanAccountId: accountId,
        externalAuthIdentityId: bindingId, actorHumanAccountId: principal.humanAccountId,
        actorSessionId: principal.sessionId, expectedVersion: input.expectedVersion,
        expectedAccountVersion: account.accessLifecycleVersion,
        supportReference: input.supportReference, identityVerified: true, predecessorId: input.predecessorId,
      } });
      await tx.accessRequest.update({ where: { id: requestId }, data: { version: { increment: 1 } } });
      await tx.humanAccount.update({ where: { id: accountId }, data: { status: 'DISABLED', passwordRecoveryBlocked: true, authenticationNotBefore: operation.createdAt } });
      await tx.humanSession.updateMany({ where: { tenantId, humanAccountId: accountId, revokedAt: null }, data: { revokedAt: now } });
      await this.audit(tx, principal, operation.id, 'ACCESS_PASSWORD_RECOVERY_STARTED', now);
      return { kind: 'started' as const, operation, subject: binding.subject };
    });
    if (started.kind === 'replay') return started.replay;
    let remoteConfirmed = false;
    try {
      await this.identity.setTemporaryPasswordOnce(started.subject, requestId, input.password);
      await this.identity.revokeUserSessions(started.subject, requestId);
      await this.identity.verifyEnabledUser(started.subject, requestId);
      remoteConfirmed = true;
    } catch {
      // No retry of the credential write. Uncertain results keep the durable block.
    }
    return this.prisma.withTenant(tenantId, async tx => {
      await this.lockRequest(tx, tenantId, requestId);
      await this.lockAccount(tx, tenantId, started.operation.targetHumanAccountId);
      const current = await tx.accessPasswordRecovery.findFirstOrThrow({ where: { id: input.operationId, tenantId } });
      if (current.state !== 'PENDING') return this.project(current);
      const account = await tx.humanAccount.findFirstOrThrow({ where: { id: current.targetHumanAccountId, tenantId } });
      const request = await tx.accessRequest.findFirst({ where: { id: requestId, tenantId }, select: { status: true, humanAccountId: true, externalAuthIdentityId: true } });
      let actorStillAuthorized = false;
      try { actorStillAuthorized = await this.authorize(tx, principal, new Date(), true); } catch { /* fail closed */ }
      // A predecessor may still have a remote PUT in flight. A successor's
      // response alone cannot establish which credential will ultimately win.
      const safe = current.predecessorId === null && remoteConfirmed && actorStillAuthorized
        && account.status === 'DISABLED' && account.passwordRecoveryBlocked
        && account.accessLifecycleVersion === current.expectedAccountVersion && request?.status === 'APPROVED'
        && request.humanAccountId === current.targetHumanAccountId && request.externalAuthIdentityId === current.externalAuthIdentityId
        && await this.eligibleTarget(tx, tenantId, current.targetHumanAccountId, current.externalAuthIdentityId);
      const state = safe ? 'SUCCEEDED' : 'UNCERTAIN';
      const [clock] = await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS "now"`;
      if (clock === undefined) throw new Error('Missing database recovery clock');
      const finished = await tx.accessPasswordRecovery.update({ where: { id: current.id }, data: { state, finishedAt: clock.now } });
      // Also reject attempts created while the old IdP SSO was being revoked.
      if (safe) await tx.humanAccount.update({ where: { id: current.targetHumanAccountId }, data: {
        status: 'ACTIVE', passwordRecoveryBlocked: false, authenticationNotBefore: clock.now,
      } });
      await this.audit(tx, principal, current.id, safe ? 'ACCESS_PASSWORD_RECOVERY_SUCCEEDED' : 'ACCESS_PASSWORD_RECOVERY_UNCERTAIN', clock.now);
      return this.project(finished);
    });
  }

  public async reconcile(principal: HumanPrincipal, requestId: string, operationId: string, now: Date): Promise<RecoveryOperationDto> {
    return this.prisma.withTenant(principal.tenantId, async tx => {
      await this.authorize(tx, principal, now, true);
      await this.lockRequest(tx, principal.tenantId, requestId);
      const operation = await tx.accessPasswordRecovery.findFirst({ where: { id: operationId, tenantId: principal.tenantId, accessRequestId: requestId } });
      if (operation === null) return this.missing();
      await this.lockAccount(tx, principal.tenantId, operation.targetHumanAccountId);
      if (operation.state !== 'PENDING') return this.project(operation);
      if (now.getTime() - operation.createdAt.getTime() < RECOVERY_ABANDONED_AFTER_MS) return this.conflict();
      const finished = await tx.accessPasswordRecovery.update({ where: { id: operation.id }, data: { state: 'UNCERTAIN', finishedAt: now } });
      await this.audit(tx, principal, operation.id, 'ACCESS_PASSWORD_RECOVERY_UNCERTAIN', now);
      return this.project(finished);
    });
  }

  private async authorize(tx: PrismaTransaction, principal: HumanPrincipal, now: Date, requireFresh: boolean): Promise<boolean> {
    if (principal.externalAuthIdentityId === undefined) return this.denied();
    const session = await tx.humanSession.findFirst({ where: {
      id: principal.sessionId, tenantId: principal.tenantId, humanAccountId: principal.humanAccountId,
      externalAuthIdentityId: principal.externalAuthIdentityId, revokedAt: null, expiresAt: { gt: now },
      account: { status: 'ACTIVE', passwordRecoveryBlocked: false }, externalIdentity: { status: 'ACTIVE' },
    }, select: { freshAuthenticatedAt: true, createdAt: true, lastUsedAt: true } });
    const capability = await tx.institutionalIdentity.findFirst({ where: {
      tenantId: principal.tenantId, role: 'HOSPITAL_ACCESS_REVIEWER', status: 'ACTIVE',
      administratorRegistration: { tenantId: principal.tenantId, experience: 'HOSPITAL', status: 'CONFIRMED',
        humanAccountId: principal.humanAccountId, externalAuthIdentityId: principal.externalAuthIdentityId },
    }, select: { id: true } });
    if (session === null || capability === null || now.getTime() - (session.lastUsedAt ?? session.createdAt).getTime() >= HUMAN_SESSION_IDLE_SECONDS * 1000) return this.denied();
    const age = session.freshAuthenticatedAt === null ? Infinity : now.getTime() - session.freshAuthenticatedAt.getTime();
    const fresh = age >= -5_000 && age <= FRESH_AUTHENTICATION_SECONDS * 1000;
    if (requireFresh && !fresh) throw new ForbiddenException({ code: 'ACCESS_RECOVERY_REAUTHENTICATE', message: 'Verifique nuevamente su identidad antes de restablecer el acceso.' });
    return fresh;
  }

  private async eligibleTarget(tx: PrismaTransaction, tenantId: string, accountId: string, bindingId: string): Promise<boolean> {
    const reserved = await tx.institutionalAdministratorRegistration.count({ where: { tenantId, humanAccountId: accountId } });
    const support = await tx.platformSupportCapability.count({ where: { homeTenantId: tenantId, humanAccountId: accountId } });
    const issuer = this.environment.accessProvisioning?.issuer;
    if (issuer === undefined) return false;
    const exact = await tx.externalAuthIdentity.count({ where: { id: bindingId, tenantId, humanAccountId: accountId, issuer, status: 'ACTIVE' } });
    return reserved === 0 && support === 0 && exact === 1;
  }
  private async lockRequest(tx: PrismaTransaction, tenantId: string, id: string) {
    await tx.$queryRaw`SELECT "id" FROM "access_request" WHERE "id" = ${id}::uuid AND "tenantId" = ${tenantId}::uuid FOR UPDATE`;
  }
  private async lockAccount(tx: PrismaTransaction, tenantId: string, id: string) {
    await tx.$queryRaw`SELECT "id" FROM "human_account" WHERE "id" = ${id}::uuid AND "tenantId" = ${tenantId}::uuid FOR UPDATE`;
  }
  private project(operation: { id: string; state: string; createdAt: Date }): RecoveryOperationDto {
    if (!(RECOVERY_STATES as readonly string[]).includes(operation.state)) throw new Error('unknown recovery state');
    return { operationId: operation.id, state: operation.state as RecoveryState, createdAt: operation.createdAt.toISOString() };
  }
  private async audit(tx: PrismaTransaction, principal: HumanPrincipal, id: string, eventType: 'ACCESS_PASSWORD_RECOVERY_STARTED' | 'ACCESS_PASSWORD_RECOVERY_SUCCEEDED' | 'ACCESS_PASSWORD_RECOVERY_UNCERTAIN' | 'ACCESS_PASSWORD_RECOVERY_SUPERSEDED', now: Date) {
    await tx.auditEvent.create({ data: { tenantId: principal.tenantId, eventType, actorType: 'HUMAN_ACCOUNT', actorUserId: principal.humanAccountId,
      actorRole: null, resourceType: 'AccessPasswordRecovery', resourceId: id, outcome: eventType.endsWith('UNCERTAIN') ? 'DENIED' : 'SUCCESS', occurredAt: now, correlationId: randomUUID() } });
  }
  private conflict(): never { throw new ConflictException({ code: 'ACCESS_RECOVERY_CONFLICT', message: 'La cuenta o la operación cambió. Actualice los datos antes de continuar.' }); }
  private missing(): never { throw new NotFoundException({ code: 'ACCESS_RECOVERY_NOT_FOUND', message: 'No se encontró la solicitud.' }); }
  private denied(): never { throw new ForbiddenException({ code: 'ACCESS_RECOVERY_FORBIDDEN', message: 'No tiene acceso a esta operación.' }); }
}
