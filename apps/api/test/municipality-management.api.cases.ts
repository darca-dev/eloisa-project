import { randomUUID } from 'node:crypto';
import { ForbiddenException, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../src/app.module';
import { API_ENVIRONMENT } from '../src/config/api-environment.provider';
import { loadApiEnvironment } from '../src/config/environment';
import { generateSessionToken, hashSessionToken } from '../src/enrollment-sessions/enrollment-session.tokens';
import { type PrismaClient } from '../src/generated/prisma/client';
import { MunicipalityManagementService } from '../src/municipality/municipality-management.service';
import type { PrismaTransaction } from '../src/database/prisma-transaction';
import type { HumanPrincipal } from '../src/identity-access/human-principal';
import { createTestPrismaClient } from './database-availability';

// Fictitious OIDC configuration: these cases validate persisted cookies, not the provider.
process.env['MERDN_HUMAN_AUTH_ISSUER'] = 'http://host.docker.internal:8081/realms/merdn-local';
process.env['MERDN_HUMAN_AUTH_CLIENT_ID'] = 'merdn-human-web';
process.env['MERDN_HUMAN_AUTH_CALLBACK_URI'] = 'http://127.0.0.1:3001/api/v1/human-auth/callback';
process.env['MERDN_HUMAN_AUTH_ATTEMPT_KEY'] = 'b'.repeat(64);

/** Included by municipality.api.test.ts so the canonical DB stage remains mandatory. */
export function municipalManagementApiCases(available: boolean) {
  describe.skipIf(!available)('053 — captura municipal persistente', () => {
    let prisma: PrismaClient, app: INestApplication, tenantId: string, cookie: string, accountId: string, personId: string, bindingId: string, sessionId: string;
    const path = '/api/v1/municipality/management/';
    const origin = 'http://127.0.0.1:3000';
    const body = (version = 0) => ({ expectedVersion: version, payloadSchemaVersion: 1, entries: [{ id: randomUUID(), title: 'Programa ficticio de prueba053', period: '2026', provenance: 'INSTITUTIONAL', sourceUrl: '', asOf: '', notes: '', values: { objetivo: 'Validar captura en base aislada' } }] });
    beforeAll(async () => {
      prisma = createTestPrismaClient();
      const tenant = await prisma.tenant.create({ data: { code: `municipal053-${randomUUID()}`, name: 'Institución ficticia053' } }); tenantId = tenant.id;
      const person = await prisma.person.create({ data: { tenantId, documentType: 'PASAPORTE', documentNumber: 'TEST053', documentNumberNormalized: 'TEST053', givenNames: 'Persona', familyNames: 'Ficticia', birthDate: new Date('1980-01-01'), sexGenderCode: 'PREFIERE_NO_DECIRLO' } }); personId = person.id;
      const account = await prisma.humanAccount.create({ data: { tenantId, personId: person.id, status: 'ACTIVE' } }); accountId = account.id;
      const binding = await prisma.externalAuthIdentity.create({ data: { tenantId, humanAccountId: accountId, issuer: 'https://identity.example.invalid', subject: randomUUID(), status: 'ACTIVE' } }); bindingId = binding.id;
      const registration = await prisma.institutionalAdministratorRegistration.create({ data: { tenantId, experience: 'MUNICIPALITY', status: 'CONFIRMED', humanAccountId: accountId, externalAuthIdentityId: bindingId, attemptTokenHash: hashSessionToken(generateSessionToken()), confirmedAt: new Date() } });
      await prisma.institutionalIdentity.create({ data: { tenantId, code: `admin053-${randomUUID()}`, role: 'MUNICIPAL_VIEWER', administratorRegistrationId: registration.id } });
      const token = generateSessionToken(); const session = await prisma.humanSession.create({ data: { tenantId, humanAccountId: accountId, externalAuthIdentityId: bindingId, tokenHash: hashSessionToken(token), expiresAt: new Date(Date.now() + 600000) } }); sessionId = session.id; cookie = `merdn_human_session=${token}`;
      const environment = { ...loadApiEnvironment(process.env), activeTenantId: tenantId, activeTenantCode: tenant.code };
      const module = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(API_ENVIRONMENT).useValue(environment).compile();
      app = module.createNestApplication({ logger: false }); await app.init();
    });
    afterAll(async () => { await app?.close(); await prisma?.$disconnect(); });
    const get = (section: string, auth = cookie) => request(app.getHttpServer()).get(path + section).set('Cookie', auth);
    const put = (section: string, input: object) => request(app.getHttpServer()).put(path + section).set('Cookie', cookie).set('Origin', origin).send(input);

    it('sin cookie humana y con cookie institucional no concede acceso', async () => {
      await request(app.getHttpServer()).get(path + 'programas').expect(401);
      await get('programas', `merdn_institutional_session=${generateSessionToken()}`).expect(401);
    });
    it('apartado inexistente está vacío y guardado/lectura persisten revisión y auditoría', async () => {
      const empty = await get('programas').expect(200); expect(empty.body).toMatchObject({ version: 0, entries: [], updatedAt: null });
      const input = body(); const saved = await put('programas', input).expect(200);
      expect(saved.body).toMatchObject({ version: 1, entries: input.entries });
      expect((await get('programas').expect(200)).body.entries).toEqual(input.entries);
      expect(await prisma.auditEvent.count({ where: { tenantId, eventType: 'MUNICIPAL_CONFIGURATION_SAVED' } })).toBe(1);
      const audit = await prisma.auditEvent.findFirstOrThrow({ where: { tenantId, eventType: 'MUNICIPAL_CONFIGURATION_SAVED' } });
      expect(JSON.stringify(audit)).not.toContain(input.entries[0]!.title);
    });
    it('rechaza origen ausente/ajeno y campos extra antes de insertar', async () => {
      for (const value of [undefined, 'https://foreign.example.invalid']) {
        const req = request(app.getHttpServer()).put(path + 'programas').set('Cookie', cookie);
        if (value) req.set('Origin', value);
        await req.send(body(1)).expect(403);
      }
      await put('programas', { ...body(1), tenantId: randomUUID() }).expect(400);
      expect(await prisma.municipalitySectionRevision.count({ where: { tenantId, section: 'programas' } })).toBe(1);
    });
    it('dos ventanas compiten sin sobrescribir; retirada conserva historial', async () => {
      const responses = await Promise.all([put('programas', body(1)), put('programas', body(1))]);
      expect(responses.map(response => response.status).sort()).toEqual([200, 409]);
      const latest = await get('programas').expect(200); expect(latest.body.version).toBe(2);
      await put('programas', { expectedVersion: 2, payloadSchemaVersion: 1, entries: [] }).expect(200);
      expect((await get('programas')).body).toMatchObject({ version: 3, entries: [] });
      expect(await prisma.municipalitySectionRevision.count({ where: { tenantId, section: 'programas' } })).toBe(3);
    });
    it('binding distinto de la misma cuenta no hereda administración y denegación persiste', async () => {
      const alias = await prisma.externalAuthIdentity.create({ data: { tenantId, humanAccountId: accountId, issuer: 'https://identity.example.invalid', subject: randomUUID() } });
      const token = generateSessionToken();
      await prisma.humanSession.create({ data: { tenantId, humanAccountId: accountId, externalAuthIdentityId: alias.id, tokenHash: hashSessionToken(token), expiresAt: new Date(Date.now() + 600000) } });
      await get('programas', `merdn_human_session=${token}`).expect(403);
      expect(await prisma.auditEvent.count({ where: { tenantId, eventType: 'MUNICIPAL_CONFIGURATION_DENIED' } })).toBeGreaterThan(0);
    });
    it('fallo de auditoría revierte la nueva revisión y no anuncia guardado', async () => {
      const service = app.get(MunicipalityManagementService) as unknown as { audit: (...args: unknown[]) => Promise<void> };
      const spy = vi.spyOn(service, 'audit').mockRejectedValueOnce(new Error('test-audit-unavailable'));
      try { await put('programas', body(3)).expect(503); } finally { spy.mockRestore(); }
      expect(await prisma.municipalitySectionRevision.count({ where: { tenantId, section: 'programas' } })).toBe(3);
    });
    it('PE-04: valores presentes no textuales se rechazan sin revisión ni SAVED; edición válida posterior persiste', async () => {
      const saved = () => prisma.auditEvent.count({ where: { tenantId, eventType: 'MUNICIPAL_CONFIGURATION_SAVED' } });
      const savedBefore = await saved();
      const row = { id: randomUUID(), title: 'Rubro ficticio de prueba053', period: '2026', provenance: 'INSTITUTIONAL', sourceUrl: '', asOf: '', notes: '' };
      for (const ejecutado of [null, false, 0, [], {}]) await put('presupuesto', { expectedVersion: 0, payloadSchemaVersion: 1, entries: [{ ...row, values: { programa: 'Rubro ficticio', asignado: '1000.50', ejecutado } }] }).expect(400);
      expect(await prisma.municipalitySectionRevision.count({ where: { tenantId, section: 'presupuesto' } })).toBe(0);
      expect(await saved()).toBe(savedBefore);
      const first = [{ ...row, values: { programa: 'Rubro ficticio', asignado: '1000.50' } }];
      await put('presupuesto', { expectedVersion: 0, payloadSchemaVersion: 1, entries: first }).expect(200);
      const read = (await get('presupuesto').expect(200)).body as { version: number; entries: typeof first };
      expect(read).toMatchObject({ version: 1, entries: first });
      const edited = read.entries.map(entry => ({ ...entry, values: { ...entry.values, ejecutado: '0', referencia: '' } }));
      expect((await put('presupuesto', { expectedVersion: read.version, payloadSchemaVersion: 1, entries: edited }).expect(200)).body).toMatchObject({ version: 2, entries: edited });
      expect((await get('presupuesto').expect(200)).body.entries).toEqual(edited);
      expect((await prisma.municipalitySectionRevision.findFirstOrThrow({ where: { tenantId, section: 'presupuesto', version: 1 } })).payload).toEqual(first);
      expect(await saved()).toBe(savedBefore + 2);
    });
    /**
     * PE-05: real PostgreSQL barrier. An owner transaction holds the account FOR UPDATE; the real service
     * waits on its FOR SHARE; the session expires during the wait and must be denied once the lock is released.
     */
    async function expiresWhileWaitingForAccount(section: 'brechas' | 'cuidado', input?: object) {
      const token = generateSessionToken();
      const ephemeral = await prisma.humanSession.create({ data: { tenantId, humanAccountId: accountId, externalAuthIdentityId: bindingId, tokenHash: hashSessionToken(token), expiresAt: new Date(Date.now() + 600000) } });
      const principal: HumanPrincipal = { sessionId: ephemeral.id, humanAccountId: accountId, personId, tenantId, externalAuthIdentityId: bindingId };
      const counts = async () => ({ revisions: await prisma.municipalitySectionRevision.count({ where: { tenantId, section } }), denied: await prisma.auditEvent.count({ where: { tenantId, eventType: 'MUNICIPAL_CONFIGURATION_DENIED' } }), read: await prisma.auditEvent.count({ where: { tenantId, eventType: 'MUNICIPAL_CONFIGURATION_READ' } }), saved: await prisma.auditEvent.count({ where: { tenantId, eventType: 'MUNICIPAL_CONFIGURATION_SAVED' } }) });
      const before = await counts();
      let announcePid!: (pid: number) => void; let release!: () => void;
      const blockerPid = new Promise<number>(resolve => { announcePid = resolve; });
      const released = new Promise<void>(resolve => { release = resolve; });
      // Settles to the error instead of rejecting, so a failed blocker cannot hang the barrier or leak a rejection.
      const blocker = prisma.$transaction(async tx => {
        const [own] = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
        await tx.$queryRaw`SELECT "id" FROM "human_account" WHERE "id"=${accountId}::uuid FOR UPDATE`;
        announcePid(own?.pid ?? -1);
        await released;
      }, { timeout: 20000 }).then(() => null, (error: unknown) => { announcePid(-1); return error; });
      let outcome: Promise<{ document: unknown } | { error: unknown }> | undefined;
      let settled = false;
      let result: { document: unknown } | { error: unknown } | undefined;
      let blockerError: unknown = null;
      try {
        const pid = await blockerPid;
        expect(pid).toBeGreaterThan(0);
        const waitStartedBefore = new Date();
        outcome = app.get(MunicipalityManagementService).document(principal, section, input).then(document => ({ document }), (error: unknown) => ({ error })).finally(() => { settled = true; });
        const deadline = Date.now() + 10000;
        for (;;) {
          // Only the service call touches this account, and it must still be pending while blocked by the owner pid.
          const [waiting] = await prisma.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM pg_stat_activity WHERE ${pid}::int = ANY(pg_blocking_pids(pid))`;
          if ((waiting?.n ?? 0) === 1 && !settled) break;
          if (settled || Date.now() > deadline) throw new Error('El servicio nunca quedó esperando la cuenta bloqueada.');
          await new Promise(resolve => setTimeout(resolve, 20));
        }
        const expiresAt = new Date();
        expect(expiresAt.getTime()).toBeGreaterThanOrEqual(waitStartedBefore.getTime());
        await prisma.humanSession.update({ where: { id: ephemeral.id }, data: { expiresAt } });
        expect(settled).toBe(false);
      } finally {
        release();
        blockerError = await blocker;
        result = await outcome;
      }
      if (blockerError !== null) throw blockerError;
      expect(result).toBeDefined();
      expect(result).not.toHaveProperty('document');
      expect((result as { error: unknown }).error).toBeInstanceOf(ForbiddenException);
      expect(await counts()).toEqual({ ...before, denied: before.denied + 1 });
    }
    it('PE-05: GET con sesión vencida mientras espera la cuenta se deniega sin devolver documento', async () => {
      await expiresWhileWaitingForAccount('brechas');
    }, 30000);
    it('PE-05: PUT con sesión vencida mientras espera la cuenta se deniega sin revisión ni SAVED', async () => {
      await expiresWhileWaitingForAccount('cuidado', { expectedVersion: 0, payloadSchemaVersion: 1, entries: [{ id: randomUUID(), title: 'Acción ficticia de prueba053', period: '2026', provenance: 'INSTITUTIONAL', sourceUrl: '', asOf: '', notes: '', values: { accion: 'Acción institucional ficticia', dependencia: 'Dependencia ficticia' } }] });
    }, 30000);
    it('RLS y grants impiden lectura/escritura cruzada y UPDATE/DELETE incluso al tenant propio', async () => {
      const foreign = await prisma.tenant.create({ data: { code: `foreign053-${randomUUID()}`, name: 'Otra institución ficticia' } });
      const runtime = <T>(target: string, work: (tx: PrismaTransaction) => Promise<T>) => prisma.$transaction(async tx => { await tx.$executeRawUnsafe('SET LOCAL ROLE merdn_runtime'); await tx.$queryRaw`SELECT set_config('merdn.tenant_id', ${target}, true)`; return work(tx); });
      expect(await runtime(foreign.id, tx => tx.municipalitySectionRevision.count({ where: { tenantId } }))).toBe(0);
      await expect(runtime(foreign.id, tx => tx.municipalitySectionRevision.create({ data: { tenantId, section: 'programas', version: 99, payloadSchemaVersion: 1, payload: [], createdByHumanAccountId: accountId } }))).rejects.toThrow();
      await expect(runtime(tenantId, tx => tx.municipalitySectionRevision.updateMany({ where: { tenantId }, data: { version: 99 } }))).rejects.toThrow();
      await expect(runtime(tenantId, tx => tx.municipalitySectionRevision.deleteMany({ where: { tenantId } }))).rejects.toThrow();
    });
    it('sesión revocada no lee ni escribe registros', async () => {
      await prisma.humanSession.update({ where: { id: sessionId }, data: { revokedAt: new Date() } });
      await get('programas').expect(401); await put('programas', body(3)).expect(401);
    });
  });
}
