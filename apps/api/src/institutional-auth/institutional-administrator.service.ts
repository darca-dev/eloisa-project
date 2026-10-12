import { randomUUID } from 'node:crypto';
import { ConflictException, Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';

import { AccessProvisioningIdentityClient } from '../access-requests/access-provisioning-identity.client';
import { type ValidatedAccessRequest } from '../access-requests/access-request.validation';
import { API_ENVIRONMENT, type ApiEnvironmentProvider } from '../config/api-environment.provider';
import { PrismaService } from '../database/prisma.service';
import { type PrismaTransaction } from '../database/prisma-transaction';
import { TenantContextService } from '../database/tenant-context.service';
import { generateSessionToken, hashSessionToken, hashesMatch, isWellFormedSessionToken } from '../enrollment-sessions/enrollment-session.tokens';
import { readCookie } from '../enrollment-sessions/enrollment-session.cookie';
import { HumanAuthService } from '../human-auth/human-auth.service';
import { HUMAN_SESSION_COOKIE_NAME } from '../human-auth/human-auth.contract';
import { type HumanPrincipal } from '../identity-access/human-principal';
import { type InstitutionalPrincipal } from './institutional-auth.service';
import { type InstitutionalRoleCode } from './institutional-auth.contract';
import { ADMINISTRATOR_CAPABILITIES, administratorAttemptCookieName, experienceForRole, type InstitutionalExperienceCode } from './institutional-administrator.contract';

@Injectable()
export class InstitutionalAdministratorService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TenantContextService) private readonly tenants: TenantContextService,
    @Inject(API_ENVIRONMENT) private readonly environment: ApiEnvironmentProvider,
    @Inject(AccessProvisioningIdentityClient) private readonly provider: AccessProvisioningIdentityClient,
    @Inject(HumanAuthService) private readonly humanAuth: HumanAuthService,
  ) {}

  public attemptCookie(experience: InstitutionalExperienceCode, existing: string | null): string {
    this.assertConfigured();
    const token = existing !== null && isWellFormedSessionToken(existing) ? existing : generateSessionToken();
    return `${administratorAttemptCookieName(experience)}=${token}; Path=/api/v1/institutional; HttpOnly; SameSite=Strict; Max-Age=2592000${this.environment.enrollmentSession.secure ? '; Secure' : ''}`;
  }

  public async availability(experience: InstitutionalExperienceCode, token: string | null) {
    this.assertConfigured();
    const { tenantId } = await this.tenants.resolveActiveTenant();
    return this.prisma.withTenant(tenantId, async tx => {
      const institution = await tx.tenant.findFirstOrThrow({ where: { id: tenantId }, select: { name: true } });
      const claim = await tx.institutionalAdministratorRegistration.findUnique({ where: { tenantId_experience: { tenantId, experience } } });
      const owns = claim !== null && this.ownsAttempt(claim.attemptTokenHash, token);
      return { available: claim === null || (claim.status === 'RESERVED' && owns), institution,
        ...(claim?.status === 'CONFIRMED' && owns ? { completed: true as const, username: `admin-${claim.id}` } : {}) };
    });
  }

  public async register(experience: InstitutionalExperienceCode, token: string | null, input: ValidatedAccessRequest, now: Date) {
    this.assertConfigured();
    if (token === null || !isWellFormedSessionToken(token)) throw new ConflictException({ code: 'INSTITUTIONAL_REGISTRATION_ATTEMPT_REQUIRED', message: 'Abra el formulario de registro para continuar.' });
    const { tenantId } = await this.tenants.resolveActiveTenant();
    const reserve = async () => this.prisma.withTenant(tenantId, async tx => {
      const existing = await tx.institutionalAdministratorRegistration.findUnique({ where: { tenantId_experience: { tenantId, experience } } });
      if (existing !== null) return existing;
      // Never bind a public declaration to an existing person's records.
      const duplicate = await tx.person.findUnique({ where: { tenantId_documentType_documentNumberNormalized: { tenantId, documentType: input.documentType, documentNumberNormalized: input.documentNumberNormalized } }, select: { id: true } });
      if (duplicate !== null) throw new ConflictException({ code: 'INSTITUTIONAL_REGISTRATION_EXISTING_ACCOUNT', message: 'No se puede completar esta alta. Inicie sesión con su cuenta existente.' });
      const person = await tx.person.create({ data: {
        id: randomUUID(), tenantId, documentType: input.documentType,
        documentNumber: input.documentNumberDeclared, documentNumberNormalized: input.documentNumberNormalized,
        givenNames: input.givenNames, familyNames: input.familyNames, birthDate: input.birthDate,
        sexGenderCode: input.sexGenderCode, email: input.email,
      } });
      const account = await tx.humanAccount.create({ data: { id: randomUUID(), tenantId, personId: person.id, status: 'DISABLED' } });
      const claim = await tx.institutionalAdministratorRegistration.create({ data: { id: randomUUID(), tenantId, experience, humanAccountId: account.id, attemptTokenHash: hashSessionToken(token) } });
      await this.audit(tx, tenantId, claim.id, 'INSTITUTIONAL_ADMINISTRATION_RESERVED', now);
      return claim;
    });
    let claim;
    try { claim = await reserve(); } catch (error) {
      if (!this.isUniqueViolation(error)) throw error;
      claim = await this.prisma.withTenant(tenantId, tx => tx.institutionalAdministratorRegistration.findUnique({ where: { tenantId_experience: { tenantId, experience } } }));
      if (claim === null) throw new ConflictException({ code: 'INSTITUTIONAL_REGISTRATION_EXISTING_ACCOUNT', message: 'No se puede completar esta alta. Inicie sesión con su cuenta existente.' });
    }
    if (!this.ownsAttempt(claim.attemptTokenHash, token)) {
      await this.prisma.withTenant(tenantId, tx => this.audit(tx, tenantId, claim.id, 'INSTITUTIONAL_ADMINISTRATION_DENIED', now));
      throw this.closed();
    }
    const username = `admin-${claim.id}`;
    if (claim.status === 'CONFIRMED') return { completed: true as const, username };
    const sameIntent = await this.prisma.withTenant(tenantId, async tx => {
      const account = await tx.humanAccount.findUniqueOrThrow({ where: { id: claim.humanAccountId }, include: { person: true } });
      const person = account.person;
      return person.documentType === input.documentType && person.documentNumberNormalized === input.documentNumberNormalized
        && person.givenNames === input.givenNames && person.familyNames === input.familyNames
        && person.birthDate.getTime() === input.birthDate.getTime() && person.sexGenderCode === input.sexGenderCode && person.email === input.email;
    });
    if (!sameIntent) throw new ConflictException({ code: 'INSTITUTIONAL_REGISTRATION_INTENT_MISMATCH', message: 'Reintente con los datos del registro inicial.' });
    const issuer = this.environment.accessProvisioning!.issuer;
    try {
      let remote = await this.provider.findUserByUsername(username);
      if (remote === null) {
        await this.provider.createDisabledUser({ username, marker: claim.id, password: input.password });
        remote = await this.provider.findUserByUsername(username);
      }
      if (remote === null || remote.marker !== claim.id) throw new Error('identity-marker-mismatch');
      await this.provider.setEnabled(remote.id, true);
      await this.provider.verifyEnabledUser(remote.id, claim.id);
      await this.prisma.withTenant(tenantId, async tx => {
        // Cross-process serialization of finalization; no HTTP inside this transaction.
        await tx.$queryRaw`SELECT "id" FROM "institutional_administrator_registration" WHERE "id" = ${claim.id}::uuid AND "tenantId" = ${tenantId}::uuid FOR UPDATE`;
        const latest = await tx.institutionalAdministratorRegistration.findUniqueOrThrow({ where: { id: claim.id } });
        if (latest.status === 'CONFIRMED') return;
        const identity = await tx.externalAuthIdentity.create({ data: { id: randomUUID(), tenantId, humanAccountId: claim.humanAccountId, issuer, subject: remote.id, status: 'ACTIVE' } });
        await tx.humanAccount.update({ where: { id: claim.humanAccountId }, data: { status: 'ACTIVE' } });
        for (const role of ADMINISTRATOR_CAPABILITIES[experience]) {
          await tx.institutionalIdentity.create({ data: { id: randomUUID(), tenantId, code: `admin-${claim.id}-${role.toLowerCase()}`, role, administratorRegistrationId: claim.id, accessSecretHash: null, accessSecretSalt: null } });
        }
        await tx.institutionalAdministratorRegistration.update({ where: { id: claim.id }, data: { status: 'CONFIRMED', confirmedAt: now, externalAuthIdentityId: identity.id } });
        await this.audit(tx, tenantId, claim.id, 'INSTITUTIONAL_ADMINISTRATION_CONFIRMED', now);
      });
      return { completed: true as const, username };
    } catch {
      await this.prisma.withTenant(tenantId, tx => this.audit(tx, tenantId, claim.id, 'INSTITUTIONAL_ADMINISTRATION_FAILED', now));
      throw new ServiceUnavailableException({ code: 'INSTITUTIONAL_REGISTRATION_UNAVAILABLE', message: 'No fue posible completar el registro. Reintente desde este mismo navegador y conserve su contraseña inicial.' });
    }
  }

  public async resolveForRole(cookie: string | undefined, role: InstitutionalRoleCode, now: Date): Promise<InstitutionalPrincipal | null> {
    const session = await this.humanAuth.validate(readCookie(cookie, HUMAN_SESSION_COOKIE_NAME), now);
    if (session === null) return null;
    const principal = session.principal;
    if (principal.externalAuthIdentityId === undefined) return null;
    return this.prisma.withTenant(principal.tenantId, async tx => {
      const capability = await tx.institutionalIdentity.findFirst({ where: {
        tenantId: principal.tenantId, role, status: 'ACTIVE',
        administratorRegistration: {
          tenantId: principal.tenantId, humanAccountId: principal.humanAccountId,
          experience: experienceForRole(role), status: 'CONFIRMED',
          externalAuthIdentityId: principal.externalAuthIdentityId,
          externalIdentity: { status: 'ACTIVE', humanAccountId: principal.humanAccountId, tenantId: principal.tenantId },
        },
      }, select: { id: true } });
      return capability === null ? null : { sessionId: principal.sessionId, identityId: capability.id, tenantId: principal.tenantId, role, humanAccountId: principal.humanAccountId };
    });
  }

  public async current(experience: InstitutionalExperienceCode, cookie: string | undefined, now: Date) {
    const session = await this.humanAuth.validate(readCookie(cookie, HUMAN_SESSION_COOKIE_NAME), now);
    if (session === null) return null;
    const role = ADMINISTRATOR_CAPABILITIES[experience][0]!;
    const principal = await this.resolveForRole(cookie, role, now);
    if (principal === null) return null;
    const institution = await this.prisma.withTenant(principal.tenantId, tx => tx.tenant.findFirstOrThrow({ where: { id: principal.tenantId }, select: { name: true } }));
    return { experience, administrator: true as const, expiresAt: session.validity.expiresAt, institution, capabilities: ADMINISTRATOR_CAPABILITIES[experience] };
  }

  public async claim(experience: InstitutionalExperienceCode, principal: HumanPrincipal, now: Date) {
    this.assertConfigured();
    return this.prisma.withTenant(principal.tenantId, async tx => {
      await tx.$queryRaw`SELECT "id" FROM "person" WHERE "id" = ${principal.personId}::uuid AND "tenantId" = ${principal.tenantId}::uuid FOR UPDATE`;
      const personalRequests = await tx.accessRequest.count({ where: { tenantId: principal.tenantId, personId: principal.personId } });
      if (personalRequests > 0 || principal.externalAuthIdentityId === undefined) throw new ConflictException({ code: 'INSTITUTIONAL_REGISTRATION_ACCOUNT_IN_USE', message: 'Esta cuenta tiene solicitudes personales. Utilice una cuenta institucional independiente.' });
      const identity = await tx.externalAuthIdentity.findFirst({ where: { id: principal.externalAuthIdentityId, tenantId: principal.tenantId, humanAccountId: principal.humanAccountId, status: 'ACTIVE' }, select: { id: true } });
      if (identity === null) throw this.closed();
      try {
        const claim = await tx.institutionalAdministratorRegistration.create({ data: { id: randomUUID(), tenantId: principal.tenantId, experience, humanAccountId: principal.humanAccountId, externalAuthIdentityId: identity.id, status: 'CONFIRMED', confirmedAt: now, attemptTokenHash: hashSessionToken(generateSessionToken()) } });
        for (const role of ADMINISTRATOR_CAPABILITIES[experience]) await tx.institutionalIdentity.create({ data: { id: randomUUID(), tenantId: principal.tenantId, code: `admin-${claim.id}-${role.toLowerCase()}`, role, administratorRegistrationId: claim.id } });
        await this.audit(tx, principal.tenantId, claim.id, 'INSTITUTIONAL_ADMINISTRATION_CONFIRMED', now, principal.humanAccountId);
        return { completed: true as const };
      } catch (error) { if (this.isUniqueViolation(error)) throw this.closed(); throw error; }
    });
  }

  private assertConfigured(): void {
    if (this.environment.merdnEnvironment === 'mvp' || this.environment.accessProvisioning === undefined || !this.humanAuth.isEnabled) {
      throw new ServiceUnavailableException({ code: 'INSTITUTIONAL_REGISTRATION_UNAVAILABLE', message: 'El registro institucional no está configurado.' });
    }
  }
  private ownsAttempt(hash: string, token: string | null): boolean { return token !== null && isWellFormedSessionToken(token) && hashesMatch(hash, hashSessionToken(token)); }
  private closed() { return new ConflictException({ code: 'INSTITUTIONAL_REGISTRATION_CLOSED', message: 'El registro de administrador de esta institución ya está cerrado.' }); }
  private isUniqueViolation(error: unknown): boolean { return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002'; }
  private async audit(tx: PrismaTransaction, tenantId: string, resourceId: string, eventType: 'INSTITUTIONAL_ADMINISTRATION_RESERVED' | 'INSTITUTIONAL_ADMINISTRATION_CONFIRMED' | 'INSTITUTIONAL_ADMINISTRATION_FAILED' | 'INSTITUTIONAL_ADMINISTRATION_DENIED', occurredAt: Date, humanAccountId?: string) {
    await tx.auditEvent.create({ data: { tenantId, eventType, actorType: humanAccountId === undefined ? 'UNAUTHENTICATED' : 'HUMAN_ACCOUNT', actorUserId: humanAccountId ?? null, actorRole: null, resourceType: 'InstitutionalAdministratorRegistration', resourceId, outcome: eventType.endsWith('FAILED') || eventType.endsWith('DENIED') ? 'DENIED' : 'SUCCESS', occurredAt, correlationId: randomUUID() } });
  }
}
