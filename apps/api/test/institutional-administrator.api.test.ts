import { randomBytes, randomUUID } from 'node:crypto';
import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { AccessProvisioningIdentityClient } from '../src/access-requests/access-provisioning-identity.client';
import { API_ENVIRONMENT } from '../src/config/api-environment.provider';
import { loadApiEnvironment } from '../src/config/environment';
import { generateSessionToken, hashSessionToken } from '../src/enrollment-sessions/enrollment-session.tokens';
import { type PrismaClient } from '../src/generated/prisma/client';
import { createTestPrismaClient } from './database-availability';

const ORIGIN = 'http://127.0.0.1:3000';
const ISSUER = 'http://host.docker.internal:8081/realms/merdn-local';
const availability = inject('databaseAvailability');
const body = (documentNumber = '99990400001') => ({ documentType: 'CEDULA_CIUDADANIA', documentNumber, givenNames: 'Responsable', familyNames: 'Ficticio', birthDate: '1980-01-01', sexGenderCode: 'PREFIERE_NO_DECIRLO', email: 'responsable@example.invalid', password: randomBytes(16).toString('hex'), confirmPassword: '' });
class IdentityProviderDouble {
  users = new Map<string, { id: string; marker: string; enabled: boolean }>();
  beforeCreate?: () => Promise<void>;
  failure: 'none' | 'create-after-write' | 'enable' | 'marker' | 'unconfirmed-enable' = 'none';
  async findUserByUsername(username: string) { return this.users.get(username) ?? null; }
  async createDisabledUser(input: { username: string; marker: string }) {
    await this.beforeCreate?.();
    if (!this.users.has(input.username)) this.users.set(input.username, { id: randomUUID(), marker: input.marker, enabled: false });
    if (this.failure === 'create-after-write') throw new Error('uncertain-test-result');
    return { id: this.users.get(input.username)!.id };
  }
  async setEnabled(id: string, enabled: boolean) {
    if (this.failure === 'enable') throw new Error('provider-test-unavailable');
    const user = [...this.users.values()].find(value => value.id === id)!; user.enabled = this.failure === 'unconfirmed-enable' ? false : enabled;
  }
  async getUser(id: string) { const user = [...this.users.values()].find(value => value.id === id)!; return { ...user, marker: this.failure === 'marker' ? 'wrong-marker' : user.marker }; }
  async verifyEnabledUser(id: string, marker: string) {
    const user = await this.getUser(id);
    if (user.id !== id || user.marker !== marker || !user.enabled) throw new Error('activation-not-confirmed');
  }
}

describe.skipIf(!availability.available || !availability.migrated)('Primer administrador institucional: PostgreSQL, RLS y HTTP', () => {
  let prisma: PrismaClient;
  let app: INestApplication;
  let tenantId: string;
  let provider: IdentityProviderDouble;
  beforeAll(() => { prisma = createTestPrismaClient(); });
  beforeEach(async () => {
    process.env['MERDN_HOSPITAL_PATIENT_VIEWER_CODE'] = 'hospital-admin040-legacy';
    process.env['MERDN_HOSPITAL_PATIENT_VIEWER_SECRET'] = randomBytes(32).toString('hex');
    process.env['MERDN_HUMAN_AUTH_ISSUER'] = ISSUER;
    process.env['MERDN_HUMAN_AUTH_CLIENT_ID'] = 'merdn-human-web';
    process.env['MERDN_HUMAN_AUTH_CALLBACK_URI'] = 'http://127.0.0.1:3001/api/v1/human-auth/callback';
    process.env['MERDN_HUMAN_AUTH_ATTEMPT_KEY'] = randomBytes(32).toString('hex');
    const tenant = await prisma.tenant.create({ data: { id: randomUUID(), code: `admin040-${randomUUID()}`, name: 'Institución ficticia de pruebas' } });
    tenantId = tenant.id; provider = new IdentityProviderDouble();
    const environment = { ...loadApiEnvironment(process.env), activeTenantId: tenantId, activeTenantCode: tenant.code,
      accessProvisioning: { issuer: ISSUER, adminUrl: 'http://host.docker.internal:8081', realm: 'merdn-local', clientId: 'admin040-test', clientSecret: randomBytes(24).toString('hex') } };
    const module = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(API_ENVIRONMENT).useValue(environment).overrideProvider(AccessProvisioningIdentityClient).useValue(provider).compile();
    app = module.createNestApplication({ logger: false }); await app.init();
  });
  afterEach(async () => { await app?.close(); });
  afterAll(async () => { await prisma?.$disconnect(); });
  async function attempt(experience = 'hospital') {
    const response = await request(app.getHttpServer()).post(`/api/v1/institutional/${experience}/registration-attempt`).set('Origin', ORIGIN).expect(204);
    const cookie = response.headers['set-cookie'][0]!.split(';')[0]!;
    expect(response.headers['set-cookie'][0]).toContain('HttpOnly');
    return cookie;
  }
  async function register(cookie: string, experience = 'hospital', document = '99990400001') {
    const data = body(document); data.confirmPassword = data.password;
    return request(app.getHttpServer()).post(`/api/v1/institutional/${experience}/registration`).set('Origin', ORIGIN).set('Cookie', cookie).send(data);
  }
  async function humanCookie() {
    const claim = await prisma.institutionalAdministratorRegistration.findFirstOrThrow({ where: { tenantId, experience: 'HOSPITAL' } });
    const token = generateSessionToken();
    await prisma.humanSession.create({ data: { id: randomUUID(), tenantId, humanAccountId: claim.humanAccountId, externalAuthIdentityId: claim.externalAuthIdentityId, tokenHash: hashSessionToken(token), expiresAt: new Date(Date.now() + 600000) } });
    return `merdn_human_session=${token}`;
  }

  it('confirma una cuenta real con capacidades sin credenciales, sin perfiles clínicos', async () => {
    const cookie = await attempt(); const response = await register(cookie);
    expect(response.status).toBe(201); expect(response.body.completed).toBe(true); expect(response.body.username).toMatch(/^admin-/u);
    const claims = await prisma.institutionalAdministratorRegistration.findMany({ where: { tenantId }, include: { account: true, externalIdentity: true, capabilities: true } });
    expect(claims).toHaveLength(1); expect(claims[0]!.status).toBe('CONFIRMED'); expect(claims[0]!.account.status).toBe('ACTIVE');
    expect(claims[0]!.externalIdentity?.subject).toBe([...provider.users.values()][0]!.id);
    expect(claims[0]!.capabilities).toHaveLength(4);
    expect(claims[0]!.capabilities.every(capability => capability.accessSecretHash === null && capability.accessSecretSalt === null)).toBe(true);
    expect(await prisma.patient.count({ where: { tenantId } })).toBe(0);
    expect(await prisma.professionalProfile.count({ where: { tenantId } })).toBe(0);
  });
  it('dos intentos concurrentes producen exactamente un administrador', async () => {
    const one = await attempt(); const two = await attempt();
    const responses = await Promise.all([register(one), register(two, 'hospital', '99990400002')]);
    expect(responses.map(response => response.status).sort()).toEqual([201, 409]);
    expect(await prisma.institutionalAdministratorRegistration.count({ where: { tenantId } })).toBe(1);
    expect(await prisma.humanAccount.count({ where: { tenantId } })).toBe(1);
    expect(provider.users.size).toBe(1);
  });
  it('recupera el usuario después de perder la respuesta sin revelar el resultado a otros navegadores', async () => {
    const cookie = await attempt(); expect((await register(cookie)).status).toBe(201);
    const own = await request(app.getHttpServer()).get('/api/v1/institutional/hospital/registration').set('Cookie', cookie).expect(200);
    expect(own.body.available).toBe(false); expect(own.body.completed).toBe(true); expect(own.body.username).toMatch(/^admin-/u);
    const other = await request(app.getHttpServer()).get('/api/v1/institutional/hospital/registration').expect(200);
    expect(other.body.username).toBeUndefined(); expect(other.body.completed).toBeUndefined();
  });
  it('rechaza solicitudes personales sobre la cuenta administradora incluso durante la reserva', async () => {
    let release!: () => void; let reserved!: () => void;
    const barrier = new Promise<void>(resolve => { release = resolve; });
    const reached = new Promise<void>(resolve => { reserved = resolve; });
    provider.beforeCreate = async () => { reserved(); await barrier; };
    const pending = register(await attempt()).then(response => response);
    await reached;
    try {
      const { confirmPassword: _confirmation, ...personal } = body();
      const response = await request(app.getHttpServer()).post('/api/v1/access-requests').set('Origin', ORIGIN).send({ ...personal, requestedProfile: 'CAREGIVER' });
      expect(response.status).toBe(409); expect(await prisma.accessRequest.count({ where: { tenantId } })).toBe(0);
    } finally { release(); }
    expect((await pending).status).toBe(201); expect(provider.users.size).toBe(1);
  });
  it('un alias diferente y una sesión histórica de la misma cuenta no heredan administración', async () => {
    expect((await register(await attempt())).status).toBe(201);
    const claim = await prisma.institutionalAdministratorRegistration.findFirstOrThrow({ where: { tenantId } });
    const alias = await prisma.externalAuthIdentity.create({ data: { tenantId, humanAccountId: claim.humanAccountId, issuer: ISSUER, subject: randomUUID() } });
    for (const identityId of [alias.id, null]) {
      const token = generateSessionToken();
      await prisma.humanSession.create({ data: { tenantId, humanAccountId: claim.humanAccountId, externalAuthIdentityId: identityId, tokenHash: hashSessionToken(token), expiresAt: new Date(Date.now() + 600000) } });
      await request(app.getHttpServer()).get('/api/v1/hospital/patients').set('Cookie', `merdn_human_session=${token}`).expect(401);
    }
  });
  it('no cambia datos personales al reintentar una reserva incierta', async () => {
    provider.failure = 'enable'; const cookie = await attempt(); expect((await register(cookie)).status).toBe(503);
    provider.failure = 'none'; expect((await register(cookie, 'hospital', '99990400002')).status).toBe(409);
    expect((await register(cookie)).status).toBe(201);
  });
  it('la base impide reabrir o transferir una confirmación', async () => {
    expect((await register(await attempt())).status).toBe(201);
    await expect(prisma.institutionalAdministratorRegistration.updateMany({ where: { tenantId }, data: { attemptTokenHash: hashSessionToken(generateSessionToken()) } })).rejects.toThrow();
  });
  it('reserva permanente, segunda alta rechazada incluso después de deshabilitar', async () => {
    expect((await register(await attempt())).status).toBe(201);
    await prisma.humanAccount.updateMany({ where: { tenantId }, data: { status: 'DISABLED' } });
    const response = await register(await attempt(), 'hospital', '99990400002'); expect(response.status).toBe(409);
    const available = await request(app.getHttpServer()).get('/api/v1/institutional/hospital/registration'); expect(available.body.available).toBe(false);
  });
  it.each(['create-after-write', 'enable', 'marker', 'unconfirmed-enable'] as const)('concilia %s sin liberar cupo ni fabricar éxito', async failure => {
    const cookie = await attempt(); provider.failure = failure;
    expect((await register(cookie)).status).toBe(503);
    expect((await prisma.humanAccount.findFirstOrThrow({ where: { tenantId } })).status).toBe('DISABLED');
    expect((await register(await attempt(), 'hospital', '99990400002')).status).toBe(409);
    provider.failure = 'none'; expect((await register(cookie)).status).toBe(201); expect(provider.users.size).toBe(1);
  });
  it('la cuenta humana abre cada capacidad hospitalaria y audita al administrador nominal', async () => {
    expect((await register(await attempt())).status).toBe(201); const cookie = await humanCookie();
    await request(app.getHttpServer()).get('/api/v1/institutional/hospital/administrator/current').set('Cookie', cookie).expect(200);
    await request(app.getHttpServer()).get('/api/v1/hospital/patients').set('Cookie', cookie).expect(200);
    await request(app.getHttpServer()).get('/api/v1/hospital/professionals').set('Cookie', cookie).expect(200);
    const events = await prisma.auditEvent.findMany({ where: { tenantId, eventType: 'HOSPITAL_PATIENT_LIST_ACCESS_GRANTED' } });
    expect(events).toHaveLength(1); expect(events[0]!.actorType).toBe('HUMAN_ACCOUNT'); expect(events[0]!.actorRole).toBeNull();
    const claim = await prisma.institutionalAdministratorRegistration.findFirstOrThrow({ where: { tenantId } }); expect(events[0]!.actorUserId).toBe(claim.humanAccountId);
    await request(app.getHttpServer()).get('/api/v1/institutional/municipality/administrator/current').set('Cookie', cookie).expect(401);
    const experiences = await request(app.getHttpServer()).get('/api/v1/me/experiences').set('Cookie', cookie).expect(200); expect(experiences.body.experiences).toEqual(['HOSPITAL']);
  });
  it('la misma cuenta institucional reclama Alcaldía sin crear roles ni otra cuenta', async () => {
    expect((await register(await attempt())).status).toBe(201); const cookie = await humanCookie();
    await request(app.getHttpServer()).post('/api/v1/institutional/municipality/claim').set('Origin', ORIGIN).set('Cookie', cookie).send({}).expect(201);
    await request(app.getHttpServer()).get('/api/v1/institutional/municipality/administrator/current').set('Cookie', cookie).expect(200);
    expect(await prisma.humanAccount.count({ where: { tenantId } })).toBe(1);
    const experiences = await request(app.getHttpServer()).get('/api/v1/me/experiences').set('Cookie', cookie).expect(200);
    expect(experiences.body.experiences).toEqual(['HOSPITAL', 'MUNICIPALITY']);
  });
  it('claim rechaza cuentas con solicitudes personales previas', async () => {
    expect((await register(await attempt())).status).toBe(201); const cookie = await humanCookie();
    const claim = await prisma.institutionalAdministratorRegistration.findFirstOrThrow({ where: { tenantId }, include: { account: true } });
    await prisma.accessRequest.create({ data: { tenantId, personId: claim.account.personId, humanAccountId: claim.humanAccountId, requestedProfile: 'CAREGIVER', reference: `AR-${randomBytes(12).toString('hex').toUpperCase()}` } });
    await request(app.getHttpServer()).post('/api/v1/institutional/municipality/claim').set('Origin', ORIGIN).set('Cookie', cookie).send({}).expect(409);
    expect(await prisma.institutionalAdministratorRegistration.count({ where: { tenantId } })).toBe(1);
  });
  it('cierra credenciales y sesiones legacy existentes tras confirmar', async () => {
    const signIn = () => request(app.getHttpServer()).post('/api/v1/institutional/sessions').set('Origin', ORIGIN).send({ identityCode: process.env['MERDN_HOSPITAL_PATIENT_VIEWER_CODE'], accessSecret: process.env['MERDN_HOSPITAL_PATIENT_VIEWER_SECRET'] });
    const legacy = await signIn(); expect(legacy.status).toBe(201); const cookie = legacy.headers['set-cookie'][0]!.split(';')[0]!;
    expect((await register(await attempt())).status).toBe(201);
    expect((await signIn()).status).toBe(401);
    await request(app.getHttpServer()).get('/api/v1/hospital/patients').set('Cookie', cookie).expect(401);
    await request(app.getHttpServer()).get('/api/v1/hospital/patients').set('Cookie', `${cookie}; merdn_human_session=invalid`).expect(401);
  });
  it('desvincular identidad exacta o revocar sesión cierra acceso sin reabrir registro', async () => {
    expect((await register(await attempt())).status).toBe(201); const cookie = await humanCookie();
    await prisma.externalAuthIdentity.updateMany({ where: { tenantId }, data: { status: 'UNLINKED', unlinkedAt: new Date() } });
    await request(app.getHttpServer()).get('/api/v1/hospital/patients').set('Cookie', cookie).expect(401);
    expect((await request(app.getHttpServer()).get('/api/v1/institutional/hospital/registration')).body.available).toBe(false);
  });
  it('Hospital y Alcaldía tienen reservas separadas y no se apropian de documentos ajenos', async () => {
    expect((await register(await attempt())).status).toBe(201);
    const municipal = await attempt('municipality'); expect((await register(municipal, 'municipality')).status).toBe(409);
    expect((await register(municipal, 'municipality', '99990400002')).status).toBe(201);
    expect(await prisma.institutionalAdministratorRegistration.count({ where: { tenantId } })).toBe(2);
  });
  it('rechaza origen ajeno, cuerpo con autoridad y registro sin intento', async () => {
    await request(app.getHttpServer()).post('/api/v1/institutional/hospital/registration-attempt').set('Origin', 'https://other.invalid').expect(403);
    const data = body(); data.confirmPassword = data.password;
    await request(app.getHttpServer()).post('/api/v1/institutional/hospital/registration').set('Origin', ORIGIN).send(data).expect(409);
    await request(app.getHttpServer()).post('/api/v1/institutional/hospital/registration').set('Origin', ORIGIN).set('Cookie', await attempt()).send({ ...data, role: 'ADMIN', tenantId }).expect(400);
    expect(await prisma.institutionalAdministratorRegistration.count({ where: { tenantId } })).toBe(0);
  });
  it('RLS oculta reservas de otro tenant y rechaza escritura cruzada', async () => {
    expect((await register(await attempt())).status).toBe(201);
    const other = await prisma.tenant.create({ data: { id: randomUUID(), code: `admin040-other-${randomUUID()}`, name: 'Otro tenant ficticio' } });
    await prisma.$transaction(async tx => { await tx.$executeRawUnsafe('SET LOCAL ROLE merdn_runtime'); await tx.$executeRaw`SELECT set_config('merdn.tenant_id', ${other.id}, true)`; expect(await tx.institutionalAdministratorRegistration.count()).toBe(0); });
    const claim = await prisma.institutionalAdministratorRegistration.findFirstOrThrow({ where: { tenantId } });
    await expect(prisma.$transaction(async tx => { await tx.$executeRawUnsafe('SET LOCAL ROLE merdn_runtime'); await tx.$executeRaw`SELECT set_config('merdn.tenant_id', ${other.id}, true)`; await tx.institutionalAdministratorRegistration.create({ data: { id: randomUUID(), tenantId, experience: 'MUNICIPALITY', humanAccountId: claim.humanAccountId, attemptTokenHash: hashSessionToken(generateSessionToken()) } }); })).rejects.toThrow();
  });
});
