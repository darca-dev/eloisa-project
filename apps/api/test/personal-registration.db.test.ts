import { randomBytes, randomUUID } from 'node:crypto';
import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, inject, it, vi } from 'vitest';
import { AppModule } from '../src/app.module';
import { AccessProvisioningIdentityClient } from '../src/access-requests/access-provisioning-identity.client';
import { AccessProvisioningService } from '../src/access-requests/access-provisioning.service';
import { AccessRequestsService } from '../src/access-requests/access-request.service';
import { API_ENVIRONMENT } from '../src/config/api-environment.provider';
import { loadApiEnvironment } from '../src/config/environment';
import { generateAttemptToken } from '../src/human-auth/human-auth-attempt.crypto';
import { type PrismaClient } from '../src/generated/prisma/client';
import { createTestPrismaClient } from './database-availability';
import { generateSessionToken, hashSessionToken } from '../src/enrollment-sessions/enrollment-session.tokens';
import { HumanAuthService } from '../src/human-auth/human-auth.service';
import { OidcAdapter } from '../src/human-auth/oidc.adapter';
import { type HumanPrincipal } from '../src/identity-access/human-principal';
import { PrismaService } from '../src/database/prisma.service';

// PostgreSQL, transactions, constraints, RLS and HTTP are real. The provider
// double permits controlled barriers; separate E2E exercises the real IdP.
const availability = inject('databaseAvailability');
const ORIGIN = 'http://127.0.0.1:3000';
const ISSUER = 'http://host.docker.internal:8081/realms/merdn-local';
class Provider {
  users = new Map<string, { id: string; marker: string; enabled: boolean }>();
  enabledCalls: string[] = [];
  beforeEnable?: () => Promise<void>;
  beforeReset?: (id: string) => Promise<void>;
  resetCalls: string[] = [];
  logoutCalls: string[] = [];
  async findUserByUsername(username: string) { return this.users.get(username) ?? null; }
  async setTemporaryPasswordOnce(id: string, marker: string, _password: string) {
    this.resetCalls.push(id);
    await this.beforeReset?.(id);
    if ((await this.getUser(id)).marker !== marker) throw new Error('wrong marker');
  }
  async revokeUserSessions(id: string, marker: string) {
    if ((await this.getUser(id)).marker !== marker) throw new Error('wrong marker');
    this.logoutCalls.push(id);
  }
  async createDisabledUser(input: { username: string; marker: string }) {
    if (!this.users.has(input.username)) this.users.set(input.username, { id: randomUUID(), marker: input.marker, enabled: false });
    return { id: this.users.get(input.username)!.id };
  }
  async getUser(id: string) { return [...this.users.values()].find(user => user.id === id)!; }
  async setEnabled(id: string, enabled: boolean) {
    this.enabledCalls.push(id);
    await this.beforeEnable?.();
    (await this.getUser(id)).enabled = enabled;
  }
  async verifyEnabledUser(id: string, marker: string) {
    const user = await this.getUser(id);
    if (!user?.enabled || user.marker !== marker) throw new Error('provider verification failed');
  }
}

describe.skipIf(!availability.available || !availability.migrated)('041 personal ownership and provisioning: PostgreSQL', () => {
  let prisma: PrismaClient;
  let app: INestApplication;
  let tenantId: string;
  let provider: Provider;
  const body = () => ({ requestedProfile: 'PATIENT', documentType: 'CEDULA_CIUDADANIA', documentNumber: '99990410001', givenNames: 'Persona', familyNames: 'Ficticia', birthDate: '1980-01-01', sexGenderCode: 'PREFIERE_NO_DECIRLO', email: 'personal@example.invalid', password: randomBytes(16).toString('hex') });
  const owner = () => `merdn_access_registration_attempt=${generateAttemptToken()}`;
  beforeAll(() => { prisma = createTestPrismaClient(); });
  beforeEach(async () => {
    process.env['MERDN_HUMAN_AUTH_ISSUER'] = ISSUER;
    process.env['MERDN_HUMAN_AUTH_CLIENT_ID'] = 'merdn-human-web';
    process.env['MERDN_HUMAN_AUTH_CALLBACK_URI'] = 'http://127.0.0.1:3001/api/v1/human-auth/callback';
    process.env['MERDN_HUMAN_AUTH_ATTEMPT_KEY'] = randomBytes(32).toString('hex');
    const tenant = await prisma.tenant.create({ data: { id: randomUUID(), code: `personal041-${randomUUID()}`, name: 'Institución ficticia de pruebas' } });
    tenantId = tenant.id; provider = new Provider();
    const environment = { ...loadApiEnvironment(process.env), activeTenantId: tenantId, activeTenantCode: tenant.code,
      accessProvisioning: { issuer: ISSUER, adminUrl: 'http://host.docker.internal:8081', realm: 'merdn-local', clientId: 'personal041-test', clientSecret: randomBytes(24).toString('hex') } };
    const module = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(API_ENVIRONMENT).useValue(environment).overrideProvider(AccessProvisioningIdentityClient).useValue(provider).compile();
    app = module.createNestApplication({ logger: false }); await app.init();
  });
  afterEach(async () => { vi.restoreAllMocks(); await app?.close(); });
  afterAll(async () => { await prisma?.$disconnect(); });
  const submit = (cookie: string, data = body()) => request(app.getHttpServer()).post('/api/v1/access-requests').set('Origin', ORIGIN).set('Cookie', cookie).send(data);
  const row = () => prisma.accessRequest.findFirstOrThrow({ where: { tenantId } });
  const recoveryUrl = (id: string) => `/api/v1/hospital/access-requests/${id}/password-recovery`;
  async function session(accountId: string, bindingId: string, fresh = true) {
    const token = generateSessionToken();
    const account = await prisma.humanAccount.findUniqueOrThrow({ where: { id: accountId } });
    const stored = await prisma.humanSession.create({ data: { id: randomUUID(), tenantId, humanAccountId: accountId,
      externalAuthIdentityId: bindingId, tokenHash: hashSessionToken(token), expiresAt: new Date(Date.now() + 600_000),
      freshAuthenticatedAt: fresh ? new Date() : null } });
    return { cookie: `merdn_human_session=${token}`, principal: { sessionId: stored.id, tenantId, humanAccountId: accountId,
      personId: account.personId, externalAuthIdentityId: bindingId } satisfies HumanPrincipal };
  }
  async function administrator(fresh = true) {
    const attempt = await request(app.getHttpServer()).post('/api/v1/institutional/hospital/registration-attempt').set('Origin', ORIGIN).expect(204);
    const { requestedProfile: _profile, ...data } = body();
    await request(app.getHttpServer()).post('/api/v1/institutional/hospital/registration').set('Origin', ORIGIN)
      .set('Cookie', attempt.headers['set-cookie'][0]!.split(';')[0]!).send({ ...data, documentNumber: '99990410002', confirmPassword: data.password }).expect(201);
    const claim = await prisma.institutionalAdministratorRegistration.findFirstOrThrow({ where: { tenantId } });
    return session(claim.humanAccountId, claim.externalAuthIdentityId!, fresh);
  }
  async function approved(requestedProfile = 'PATIENT') {
    await submit(owner(), { ...body(), requestedProfile }).expect(202); const stored = await row();
    await prisma.accessRequest.update({ where: { id: stored.id }, data: { status: 'APPROVED_PENDING_PROVISIONING' } });
    expect(await app.get(AccessProvisioningService).aprovisionar({ tenantId, accessRequestId: stored.id, endpoint: 'test:recovery-setup' }, new Date())).toEqual({ ok: true, status: 'APPROVED' });
    return row();
  }
  function resetBody(version: number, predecessorId: string | null = null) {
    const password = randomBytes(16).toString('hex');
    return { operationId: randomUUID(), expectedVersion: version, supportReference: `CASE_${randomUUID()}`, identityVerified: true,
      password, confirmPassword: password, predecessorId };
  }
  const reset = (cookie: string, id: string, input: ReturnType<typeof resetBody>) => request(app.getHttpServer())
    .post(recoveryUrl(id)).set('Origin', ORIGIN).set('Cookie', cookie).send(input);

  it.each(['/hospital', '/municipality', '/acceso', '/'] as const)('preserves callback destination %s without granting step-up', async returnTo => {
    const admin = await administrator();
    const binding = await prisma.externalAuthIdentity.findUniqueOrThrow({ where: { id: admin.principal.externalAuthIdentityId } });
    const state = randomUUID();
    const authorize = vi.spyOn(OidcAdapter.prototype, 'buildAuthorizationRequest').mockResolvedValue({ state, codeVerifier: randomBytes(32).toString('hex'), authorizationUrl: 'http://provider.invalid/authorize' });
    vi.spyOn(OidcAdapter.prototype, 'exchangeAndVerify').mockResolvedValue({ issuer: ISSUER, subject: binding.subject });
    const start = await app.get(HumanAuthService).startLogin(returnTo, new Date());
    expect(authorize).toHaveBeenCalledWith(expect.any(String), returnTo !== '/');
    const attempt = await prisma.humanAuthAttempt.findFirstOrThrow({ where: { tenantId } });
    expect(attempt.returnTarget).toBe(returnTo);
    expect(attempt.freshAuthenticationRequestedAt).toBeNull(); expect(attempt.stepUpSessionId).toBeNull();
    const callback = await request(app.getHttpServer()).get('/api/v1/human-auth/callback').query({ state, code: 'fictional-provider-code' })
      .set('Cookie', start.setCookieHeader.split(';')[0]!).expect(302);
    expect(callback.headers.location).toBe(`${ORIGIN}${returnTo}`);
  });

  it('rejects hostile or non-literal login destinations before persistence', async () => {
    vi.spyOn(OidcAdapter.prototype, 'buildAuthorizationRequest').mockImplementation(async () => ({ state: randomUUID(), codeVerifier: randomBytes(32).toString('hex'), authorizationUrl: 'http://provider.invalid/authorize' }));
    for (const value of ['https://other.invalid', '//other.invalid', '/hospital?role=admin', '/municipality/other', ['/hospital', '/municipality']]) {
      await app.get(HumanAuthService).startLogin(value, new Date());
    }
    const attempts = await prisma.humanAuthAttempt.findMany({ where: { tenantId } });
    expect(attempts).toHaveLength(5); expect(attempts.every(attempt => attempt.returnTarget === '/')).toBe(true);
  });

  it('approves the real professional portal without fabricating clinical participation or access', async () => {
    const target = await approved('FIELD_PROFESSIONAL');
    const user = await session(target.humanAccountId!, target.externalAuthIdentityId!);
    const experiences = await request(app.getHttpServer()).get('/api/v1/me/experiences').set('Cookie', user.cookie).expect(200);
    expect(experiences.body.experiences).toEqual(['FIELD_PROFESSIONAL']);
    expect(await prisma.professionalProfile.count({ where: { tenantId } })).toBe(0);
    expect(await prisma.professionalAffiliation.count({ where: { tenantId } })).toBe(0);
    const worklist = await request(app.getHttpServer()).get('/api/v1/professional/visits?from=2026-10-12&to=2026-10-19').set('Cookie', user.cookie).expect(200);
    expect(worklist.body.items).toEqual([]);
    await request(app.getHttpServer()).get(`/api/v1/professional/visits/${randomUUID()}`).set('Cookie', user.cookie).expect(404);
  });

  it('persists a new disabled account with exact binding and source, replay does not replace password', async () => {
    const cookie = owner(); const data = body();
    const first = await submit(cookie, data).expect(202);
    expect(first.body.source).toBe('SELF_REGISTRATION');
    const stored = await row();
    expect(stored.registrationAttemptTokenHash).toMatch(/^[a-f0-9]{64}$/u);
    expect(stored.externalAuthIdentityId).not.toBeNull();
    const binding = await prisma.externalAuthIdentity.findUniqueOrThrow({ where: { id: stored.externalAuthIdentityId! } });
    expect(binding.humanAccountId).toBe(stored.humanAccountId);
    expect((await prisma.humanAccount.findUniqueOrThrow({ where: { id: stored.humanAccountId! } })).status).toBe('DISABLED');
    const second = await submit(cookie, { ...data, password: randomBytes(20).toString('hex') }).expect(202);
    expect(second.body).toEqual(first.body);
    expect(provider.users.size).toBe(1);
    expect(await prisma.humanAccount.count({ where: { tenantId } })).toBe(1);
  });

  it('two different owners racing one document produce one registration and one opaque conflict', async () => {
    const data = body();
    const results = await Promise.all([submit(owner(), data), submit(owner(), data)]);
    expect(results.map(result => result.status).sort()).toEqual([202, 409]);
    const accepted = results.find(result => result.status === 202)!;
    const conflict = results.find(result => result.status === 409)!;
    expect(JSON.stringify(conflict.body)).not.toContain(accepted.body.reference);
    expect(await prisma.person.count({ where: { tenantId } })).toBe(1);
    expect(await prisma.accessRequest.count({ where: { tenantId } })).toBe(1);
    expect(provider.users.size).toBe(1);
  });

  it('two profiles racing the same document cannot create a second account or alias', async () => {
    const cookie = owner(); const data = body();
    const results = await Promise.all([submit(cookie, data), submit(cookie, { ...data, requestedProfile: 'CAREGIVER' })]);
    expect(results.map(result => result.status).sort()).toEqual([202, 409]);
    expect(await prisma.humanAccount.count({ where: { tenantId } })).toBe(1);
    expect(await prisma.externalAuthIdentity.count({ where: { tenantId } })).toBe(1);
  });

  it('expiration rejects even an exact owner without updating provenance or identity', async () => {
    const token = generateAttemptToken(); const data = body();
    await submit(`merdn_access_registration_attempt=${token}`, data).expect(202);
    const stored = await row();
    await expect(app.get(AccessRequestsService).submit(data, new Date(stored.registrationAttemptExpiresAt!.getTime() + 1), token)).rejects.toMatchObject({ status: 409 });
    expect((await row()).registrationAttemptExpiresAt).toEqual(stored.registrationAttemptExpiresAt);
    expect(provider.users.size).toBe(1);
  });

  it('SQL rejects incomplete owner proofs and invalid hashes, including historical rows', async () => {
    await submit(owner()).expect(202); const stored = await row();
    for (const data of [
      { registrationAttemptTokenHash: null, registrationAttemptExpiresAt: null },
      { source: 'TEST_DATA' as const, registrationAttemptTokenHash: null },
      { registrationAttemptExpiresAt: null },
      { registrationAttemptTokenHash: 'invalid' },
      { registrationAttemptExpiresAt: new Date(0) },
    ]) await expect(prisma.accessRequest.update({ where: { id: stored.id }, data })).rejects.toThrow();
    expect((await row()).registrationAttemptTokenHash).toBe(stored.registrationAttemptTokenHash);
  });

  it('SQL refuses an exact binding of another account or tenant', async () => {
    await submit(owner()).expect(202); const stored = await row();
    const person = await prisma.person.findUniqueOrThrow({ where: { id: stored.personId } });
    const account = await prisma.humanAccount.create({ data: { id: randomUUID(), tenantId, personId: person.id, status: 'DISABLED' } });
    const binding = await prisma.externalAuthIdentity.create({ data: { id: randomUUID(), tenantId, humanAccountId: account.id, issuer: ISSUER, subject: randomUUID() } });
    await expect(prisma.accessRequest.update({ where: { id: stored.id }, data: { externalAuthIdentityId: binding.id } })).rejects.toThrow();
    expect((await row()).externalAuthIdentityId).toBe(stored.externalAuthIdentityId);
  });

  it('a late failing worker cannot disable the approval completed by its successor', async () => {
    await submit(owner()).expect(202); const stored = await row();
    await prisma.accessRequest.update({ where: { id: stored.id }, data: { status: 'APPROVED_PENDING_PROVISIONING' } });
    let release!: () => void; let entered!: () => void;
    const barrier = new Promise<void>(resolve => { release = resolve; });
    const started = new Promise<void>(resolve => { entered = resolve; });
    let calls = 0;
    provider.beforeEnable = async () => { calls++; if (calls === 1) { entered(); await barrier; throw new Error('late provider timeout'); } };
    const service = app.get(AccessProvisioningService);
    const context = { tenantId, accessRequestId: stored.id, endpoint: 'test:provisioning-race' };
    const now = new Date();
    const late = service.aprovisionar(context, now);
    await started;
    expect((await service.aprovisionar(context, now)).ok).toBe(false);
    expect(provider.enabledCalls).toHaveLength(1);
    const successor = await service.aprovisionar(context, new Date(now.getTime() + 6 * 60_000));
    expect(successor).toEqual({ ok: true, status: 'APPROVED' });
    release(); expect(await late).toEqual(successor);
    expect((await row()).status).toBe('APPROVED');
    expect((await row()).provisioningAttempts).toBe(2);
    expect((await prisma.humanAccount.findUniqueOrThrow({ where: { id: stored.humanAccountId! } })).status).toBe('ACTIVE');
    expect(await prisma.patient.count({ where: { tenantId } })).toBe(1);
    expect(await prisma.auditEvent.count({ where: { tenantId, eventType: 'ACCESS_PROVISIONING_FAILED' } })).toBe(0);
  });

  it('an unrelated alias is never selected in place of the exact request binding', async () => {
    await submit(owner()).expect(202); const stored = await row();
    await prisma.externalAuthIdentity.create({ data: { id: randomUUID(), tenantId, humanAccountId: stored.humanAccountId!, issuer: ISSUER, subject: randomUUID(), createdAt: new Date(0) } });
    await prisma.accessRequest.update({ where: { id: stored.id }, data: { status: 'APPROVED_PENDING_PROVISIONING' } });
    expect(await app.get(AccessProvisioningService).aprovisionar({ tenantId, accessRequestId: stored.id, endpoint: 'test:exact-binding' }, new Date())).toEqual({ ok: true, status: 'APPROVED' });
    const binding = await prisma.externalAuthIdentity.findUniqueOrThrow({ where: { id: stored.externalAuthIdentityId! } });
    expect(provider.enabledCalls).toEqual([binding.subject]);
  });

  it('administrator reset revokes local sessions, writes once, audits and returns no credential', async () => {
    const admin = await administrator(); const target = await approved();
    const old = await session(target.humanAccountId!, target.externalAuthIdentityId!);
    const input = resetBody(target.version);
    const result = await reset(admin.cookie, target.id, input).expect(200);
    expect(result.body.state).toBe('SUCCEEDED');
    expect(Object.keys(result.body).sort()).toEqual(['createdAt', 'operationId', 'state']);
    expect(JSON.stringify(result.body)).not.toContain(input.password);
    expect(provider.resetCalls).toHaveLength(1); expect(provider.logoutCalls).toEqual(provider.resetCalls);
    expect((await reset(admin.cookie, target.id, input).expect(200)).body).toEqual(result.body);
    expect(provider.resetCalls).toHaveLength(1);
    const account = await prisma.humanAccount.findUniqueOrThrow({ where: { id: target.humanAccountId! } });
    expect(account.status).toBe('ACTIVE'); expect(account.passwordRecoveryBlocked).toBe(false);
    expect(account.authenticationNotBefore).not.toBeNull();
    await request(app.getHttpServer()).get('/api/v1/human-auth/session').set('Cookie', old.cookie).expect(401);
    const audit = await prisma.auditEvent.findMany({ where: { tenantId, resourceId: input.operationId } });
    expect(audit.map(event => event.eventType).sort()).toEqual(['ACCESS_PASSWORD_RECOVERY_STARTED', 'ACCESS_PASSWORD_RECOVERY_SUCCEEDED']);
    expect(JSON.stringify(audit)).not.toContain(input.password);
  });

  it('requires fresh admin authentication, same-origin and closed validated input before writing', async () => {
    const admin = await administrator(false); const target = await approved(); const input = resetBody(target.version);
    expect((await reset(admin.cookie, target.id, input).expect(403)).body.code).toBe('ACCESS_RECOVERY_REAUTHENTICATE');
    const binding = await prisma.externalAuthIdentity.findUniqueOrThrow({ where: { id: admin.principal.externalAuthIdentityId } });
    const state = randomUUID();
    const authorize = vi.spyOn(OidcAdapter.prototype, 'buildAuthorizationRequest').mockResolvedValue({ state, codeVerifier: randomBytes(32).toString('hex'), authorizationUrl: 'http://provider.invalid/authorize' });
    vi.spyOn(OidcAdapter.prototype, 'exchangeAndVerify').mockResolvedValue({ issuer: ISSUER, subject: binding.subject, authenticatedAt: new Date() });
    const reauthentication = await request(app.getHttpServer()).post('/api/v1/human-auth/reauthenticate')
      .set('Origin', ORIGIN).set('Cookie', admin.cookie).expect(200);
    expect(authorize).toHaveBeenCalledWith(expect.any(String), true);
    const attempt = await prisma.humanAuthAttempt.findFirstOrThrow({ where: { tenantId } });
    expect(attempt.returnTarget).toBe('/hospital'); expect(attempt.freshAuthenticationRequestedAt).not.toBeNull();
    expect(attempt.stepUpSessionId).toBe(admin.principal.sessionId);
    expect(attempt.stepUpHumanAccountId).toBe(admin.principal.humanAccountId);
    expect(attempt.stepUpExternalIdentityId).toBe(admin.principal.externalAuthIdentityId);
    const callback = await request(app.getHttpServer()).get('/api/v1/human-auth/callback').query({ state, code: 'fictional-provider-code' })
      .set('Cookie', reauthentication.headers['set-cookie'][0]!.split(';')[0]!).expect(302);
    expect(callback.headers.location).toBe(`${ORIGIN}/hospital`);
    expect((await prisma.humanSession.findUniqueOrThrow({ where: { id: admin.principal.sessionId } })).revokedAt).not.toBeNull();
    const fresh = await prisma.humanSession.findFirstOrThrow({ where: { tenantId, humanAccountId: admin.principal.humanAccountId, revokedAt: null } });
    expect(fresh.freshAuthenticatedAt).not.toBeNull();
    const freshCookie = callback.headers['set-cookie'][0]!.split(';')[0]!;
    await request(app.getHttpServer()).post(recoveryUrl(target.id)).set('Cookie', freshCookie).set('Origin', 'https://other.invalid').send(input).expect(403);
    await reset(freshCookie, target.id, { ...input, identityVerified: false } as unknown as ReturnType<typeof resetBody>).expect(400);
    await reset(freshCookie, target.id, { ...input, expectedVersion: target.version + 1 }).expect(409);
    expect(provider.resetCalls).toHaveLength(0); expect(await prisma.accessPasswordRecovery.count({ where: { tenantId } })).toBe(0);
    const personal = await session(target.humanAccountId!, target.externalAuthIdentityId!);
    await reset(personal.cookie, target.id, input).expect(403);
    await reset(freshCookie, randomUUID(), input).expect(404);
  });

  it('initial audit failure rolls back the block and prevents any provider effect', async () => {
    const admin = await administrator(); const target = await approved();
    const database = app.get(PrismaService); const original = database.withTenant.bind(database);
    vi.spyOn(database, 'withTenant').mockImplementation((tenant, work) => original(tenant, tx => {
      const create = tx.auditEvent.create.bind(tx.auditEvent);
      tx.auditEvent.create = ((args: Parameters<typeof create>[0]) => {
        if (args?.data.eventType === 'ACCESS_PASSWORD_RECOVERY_STARTED') throw new Error('injected audit storage failure');
        return create(args);
      }) as unknown as typeof tx.auditEvent.create;
      return work(tx);
    }));
    await reset(admin.cookie, target.id, resetBody(target.version)).expect(503);
    expect(provider.resetCalls).toHaveLength(0);
    expect(await prisma.accessPasswordRecovery.count({ where: { tenantId } })).toBe(0);
    expect((await prisma.humanAccount.findUniqueOrThrow({ where: { id: target.humanAccountId! } })).passwordRecoveryBlocked).toBe(false);
  });

  it('a callback verified before reset cannot establish a session after recovery succeeds', async () => {
    const admin = await administrator(); const target = await approved();
    const binding = await prisma.externalAuthIdentity.findUniqueOrThrow({ where: { id: target.externalAuthIdentityId! } });
    const state = randomUUID();
    vi.spyOn(OidcAdapter.prototype, 'buildAuthorizationRequest').mockResolvedValue({ state, codeVerifier: randomBytes(32).toString('hex'), authorizationUrl: 'http://provider.invalid/authorize' });
    let release!: () => void; let entered!: () => void;
    const barrier = new Promise<void>(resolve => { release = resolve; }); const reached = new Promise<void>(resolve => { entered = resolve; });
    vi.spyOn(OidcAdapter.prototype, 'exchangeAndVerify').mockImplementation(async () => { entered(); await barrier; return { issuer: ISSUER, subject: binding.subject }; });
    const auth = app.get(HumanAuthService); const start = await auth.startLogin('/acceso', new Date());
    const token = start.setCookieHeader.split(';')[0]!.split('=')[1]!;
    const late = auth.completeLogin(token, new URLSearchParams({ state, code: 'fictional-provider-code' }), new Date(), randomUUID(), 'test:callback-barrier');
    await reached;
    try { expect((await reset(admin.cookie, target.id, resetBody(target.version)).expect(200)).body.state).toBe('SUCCEEDED'); }
    finally { release(); }
    expect(await late).toBeNull();
    expect(await prisma.humanSession.count({ where: { tenantId, humanAccountId: target.humanAccountId!, revokedAt: null } })).toBe(0);
  });

  it('suspending another historical profile during reset never reactivates the account', async () => {
    const admin = await administrator(); const target = await approved();
    const historical = await prisma.accessRequest.create({ data: { tenantId, personId: target.personId,
      requestedProfile: 'CAREGIVER', reference: `historical-${randomUUID()}`, status: 'APPROVED', humanAccountId: target.humanAccountId,
      externalAuthIdentityId: target.externalAuthIdentityId, provisioningStatus: 'SUCCEEDED' } });
    let release!: () => void; let entered!: () => void;
    const barrier = new Promise<void>(resolve => { release = resolve; }); const reached = new Promise<void>(resolve => { entered = resolve; });
    provider.beforeReset = async () => { entered(); await barrier; };
    const pending = reset(admin.cookie, target.id, resetBody(target.version)).then(response => response);
    await reached;
    // Historical B shares A's binding but has another provisioning marker.
    // Remote deactivation fails closed on that marker, leaving enabled=true;
    // its authoritative local suspension must still win over recovery A.
    try {
      await request(app.getHttpServer()).post(`/api/v1/hospital/access-requests/${historical.id}/decision`)
        .set('Origin', ORIGIN).set('Cookie', admin.cookie).send({ action: 'SUSPEND', expectedVersion: historical.version, reasonCode: 'ACCESS_SUSPENDED' }).expect(200);
      release(); expect((await pending).body.state).toBe('UNCERTAIN');
      const account = await prisma.humanAccount.findUniqueOrThrow({ where: { id: target.humanAccountId! } });
      expect(account.status).toBe('DISABLED'); expect(account.passwordRecoveryBlocked).toBe(true); expect(account.accessLifecycleVersion).toBe(1);
      expect((await prisma.accessRequest.findUniqueOrThrow({ where: { id: target.id } })).status).toBe('APPROVED');
    } finally { release(); }
  });

  it('uncertainty is inherited: a successor cannot unlock before a late old PUT finishes', async () => {
    const admin = await administrator(); const target = await approved(); const firstInput = resetBody(target.version);
    let release!: () => void; let entered!: () => void; let calls = 0;
    const barrier = new Promise<void>(resolve => { release = resolve; }); const reached = new Promise<void>(resolve => { entered = resolve; });
    provider.beforeReset = async () => { if (++calls === 1) { entered(); await barrier; } };
    const late = reset(admin.cookie, target.id, firstInput).then(response => response);
    await reached;
    try {
      await prisma.accessPasswordRecovery.update({ where: { id: firstInput.operationId }, data: { createdAt: new Date(Date.now() - 16 * 60_000) } });
      await request(app.getHttpServer()).post(`${recoveryUrl(target.id)}/reconcile`).set('Origin', ORIGIN).set('Cookie', admin.cookie)
        .send({ operationId: firstInput.operationId }).expect(200);
      const successor = resetBody((await row()).version, firstInput.operationId);
      expect((await reset(admin.cookie, target.id, successor).expect(200)).body.state).toBe('UNCERTAIN');
      release(); expect((await late).body.state).toBe('SUPERSEDED');
      expect((await prisma.humanAccount.findUniqueOrThrow({ where: { id: target.humanAccountId! } })).passwordRecoveryBlocked).toBe(true);
      expect(await prisma.auditEvent.count({ where: { tenantId, eventType: 'ACCESS_PASSWORD_RECOVERY_SUCCEEDED' } })).toBe(0);
    } finally { release(); }
  });

  it('provider timeout preserves the durable block and prevents old sessions without retry', async () => {
    const admin = await administrator(); const target = await approved(); const old = await session(target.humanAccountId!, target.externalAuthIdentityId!);
    provider.beforeReset = async () => { throw new Error('injected remote timeout after possible write'); };
    const input = resetBody(target.version);
    expect((await reset(admin.cookie, target.id, input).expect(200)).body.state).toBe('UNCERTAIN');
    expect((await reset(admin.cookie, target.id, input).expect(200)).body.state).toBe('UNCERTAIN');
    expect(provider.resetCalls).toHaveLength(1); expect(provider.logoutCalls).toHaveLength(0);
    await request(app.getHttpServer()).get('/api/v1/human-auth/session').set('Cookie', old.cookie).expect(401);
    const account = await prisma.humanAccount.findUniqueOrThrow({ where: { id: target.humanAccountId! } });
    expect(account.status).toBe('DISABLED'); expect(account.passwordRecoveryBlocked).toBe(true);
  });

  it('even disabled platform support is excluded from personal recovery', async () => {
    const admin = await administrator(); const target = await approved();
    const createdAt = new Date(Date.now() - 1000);
    await prisma.platformSupportCapability.create({ data: { id: randomUUID(), homeTenantId: tenantId, humanAccountId: target.humanAccountId!, status: 'DISABLED', createdAt, disabledAt: new Date() } });
    await reset(admin.cookie, target.id, resetBody(target.version)).expect(409);
    expect(provider.resetCalls).toHaveLength(0);
  });

  it('a callback started during remote recovery cannot reuse the old SSO after activation', async () => {
    const admin = await administrator(); const target = await approved();
    const binding = await prisma.externalAuthIdentity.findUniqueOrThrow({ where: { id: target.externalAuthIdentityId! } });
    let releaseReset!: () => void; let enteredReset!: () => void;
    const resetBarrier = new Promise<void>(resolve => { releaseReset = resolve; }); const resetting = new Promise<void>(resolve => { enteredReset = resolve; });
    provider.beforeReset = async () => { enteredReset(); await resetBarrier; };
    const pending = reset(admin.cookie, target.id, resetBody(target.version)).then(response => response);
    await resetting;
    const state = randomUUID();
    vi.spyOn(OidcAdapter.prototype, 'buildAuthorizationRequest').mockResolvedValue({ state, codeVerifier: randomBytes(32).toString('hex'), authorizationUrl: 'http://provider.invalid/authorize' });
    let releaseCallback!: () => void; let enteredCallback!: () => void;
    const callbackBarrier = new Promise<void>(resolve => { releaseCallback = resolve; }); const verified = new Promise<void>(resolve => { enteredCallback = resolve; });
    vi.spyOn(OidcAdapter.prototype, 'exchangeAndVerify').mockImplementation(async () => { enteredCallback(); await callbackBarrier; return { issuer: ISSUER, subject: binding.subject }; });
    const auth = app.get(HumanAuthService); const start = await auth.startLogin('/acceso', new Date());
    const token = start.setCookieHeader.split(';')[0]!.split('=')[1]!;
    const callback = auth.completeLogin(token, new URLSearchParams({ state, code: 'fictional-provider-code' }), new Date(), randomUUID(), 'test:during-recovery-callback');
    await verified;
    try { releaseReset(); expect((await pending).body.state).toBe('SUCCEEDED'); }
    finally { releaseReset(); releaseCallback(); }
    expect(await callback).toBeNull();
    expect(await prisma.humanSession.count({ where: { tenantId, humanAccountId: target.humanAccountId!, revokedAt: null } })).toBe(0);
  });

  it('a final audit failure leaves PENDING and blocked after one remote write', async () => {
    const admin = await administrator(); const target = await approved();
    const database = app.get(PrismaService); const original = database.withTenant.bind(database);
    const failure = vi.spyOn(database, 'withTenant').mockImplementation((tenant, work) => original(tenant, tx => {
      const create = tx.auditEvent.create.bind(tx.auditEvent);
      tx.auditEvent.create = ((args: Parameters<typeof create>[0]) => {
        if (args?.data.eventType === 'ACCESS_PASSWORD_RECOVERY_SUCCEEDED') throw new Error('injected final audit failure');
        return create(args);
      }) as unknown as typeof tx.auditEvent.create;
      return work(tx);
    }));
    const input = resetBody(target.version);
    await reset(admin.cookie, target.id, input).expect(503); failure.mockRestore();
    expect((await reset(admin.cookie, target.id, input).expect(200)).body.state).toBe('PENDING');
    expect(provider.resetCalls).toHaveLength(1);
    expect((await prisma.humanAccount.findUniqueOrThrow({ where: { id: target.humanAccountId! } })).passwordRecoveryBlocked).toBe(true);
  });

  it('a reserved Municipality administrator account is excluded even without confirmed capability', async () => {
    const admin = await administrator(); const target = await approved();
    await prisma.institutionalAdministratorRegistration.create({ data: { tenantId, experience: 'MUNICIPALITY',
      status: 'RESERVED', humanAccountId: target.humanAccountId!, attemptTokenHash: randomBytes(32).toString('hex') } });
    await reset(admin.cookie, target.id, resetBody(target.version)).expect(409);
    expect(provider.resetCalls).toHaveLength(0);
  });

  it('recovery operations remain invisible to another tenant under runtime RLS and cross-tenant FKs reject links', async () => {
    const admin = await administrator(); const target = await approved(); const input = resetBody(target.version);
    await reset(admin.cookie, target.id, input).expect(200);
    const other = await prisma.tenant.create({ data: { id: randomUUID(), code: `other041-${randomUUID()}`, name: 'Otra institución ficticia' } });
    const hidden = await app.get(PrismaService).withTenant(other.id, tx => tx.accessPasswordRecovery.findMany());
    expect(hidden).toEqual([]);
    const stored = await prisma.accessPasswordRecovery.findUniqueOrThrow({ where: { id: input.operationId } });
    await expect(prisma.accessPasswordRecovery.create({ data: { ...stored, id: randomUUID(), tenantId: other.id } })).rejects.toThrow();
    const person = await prisma.person.create({ data: { tenantId: other.id, documentType: 'CEDULA_CIUDADANIA', documentNumber: '99990410003',
      documentNumberNormalized: '99990410003', givenNames: 'Otra', familyNames: 'Prueba', birthDate: new Date('1980-01-01'), sexGenderCode: 'PREFIERE_NO_DECIRLO' } });
    const account = await prisma.humanAccount.create({ data: { tenantId: other.id, personId: person.id } });
    const binding = await prisma.externalAuthIdentity.create({ data: { tenantId: other.id, humanAccountId: account.id, issuer: ISSUER, subject: randomUUID() } });
    await expect(prisma.accessRequest.update({ where: { id: target.id }, data: { externalAuthIdentityId: binding.id } })).rejects.toThrow();
    const requestInOther = await prisma.accessRequest.create({ data: { tenantId: other.id, personId: person.id, requestedProfile: 'CAREGIVER', reference: `AR-${randomBytes(12).toString('hex').toUpperCase()}` } });
    await reset(admin.cookie, requestInOther.id, resetBody(1)).expect(404);
    expect(provider.resetCalls).toHaveLength(1);
  });
});
