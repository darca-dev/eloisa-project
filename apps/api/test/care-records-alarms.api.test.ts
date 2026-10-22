/*
 * Aprovisionamiento FICTICIO del entorno humano, ANTES de importar la
 * aplicación: el módulo humano lee su configuración una sola vez. Ninguna
 * credencial es real; el proveedor OIDC no se contacta y las sesiones se
 * siembran directamente. El límite de abuso se amplía solo en esta suite: tiene
 * su propia prueba dedicada en la superficie humana.
 */
process.env['MERDN_HUMAN_AUTH_ISSUER'] = 'http://host.docker.internal:8081/realms/merdn-local';
process.env['MERDN_HUMAN_AUTH_CLIENT_ID'] = 'merdn-human-web';
process.env['MERDN_HUMAN_AUTH_CALLBACK_URI'] = 'http://127.0.0.1:3001/api/v1/human-auth/callback';
process.env['MERDN_HUMAN_AUTH_ATTEMPT_KEY'] = 'd'.repeat(64);
process.env['MERDN_HUMAN_AUTH_RATE_LIMIT_MAX'] = '10000';

import { randomUUID } from 'node:crypto';

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';

import { AppModule } from '../src/app.module';
import { MANUAL_RECEIPT_MESSAGE } from '../src/care-alerts/care-alerts.contract';
import { type PrismaClient } from '../src/generated/prisma/client';
import { MalformedJsonFilter } from '../src/patients/malformed-json.filter';

import { CareSeed, type CuentaFicticia } from './care-context-fixtures';
import { createTestPrismaClient, unavailableBanner } from './database-availability';

/**
 * Bitácoras y alarmas manuales con la aplicación NestJS REAL y PostgreSQL REAL
 * (SPEC 055 / MP02–MP03).
 *
 * Cada perfil actúa con su propia sesión humana sembrada: paciente propio,
 * cuidadora con concesión nueva, profesional asignado con competencia, revisor
 * hospitalario con competencia y manager SIN concesión clínica. El servidor
 * resuelve actor, tenant y organización; la prueba solo nombra el contexto.
 *
 * Todos los datos son FICTICIOS. Registros, observaciones, enmiendas,
 * transiciones y auditoría son append-only también para el propietario, así
 * que esta suite NO borra su historia: se ejecuta al final de la baseline y el
 * clúster aislado se elimina completo en `cleanup`.
 */

const HUMAN_COOKIE = 'merdn_human_session';
const ORIGIN = 'http://127.0.0.1:3000';
const BASE = '/api/v1/care/contexts';

const availability = inject('databaseAvailability');
const puedeEjecutarse = availability.available && availability.migrated;

if (!puedeEjecutarse) {
  // eslint-disable-next-line no-console
  console.warn(`\n${unavailableBanner(availability)}\n`);
}

describe.skipIf(!puedeEjecutarse)('Bitácoras y alarmas manuales por HTTP (055/MP02–MP03)', () => {
  let app: INestApplication;
  let owner: PrismaClient;
  let seed: CareSeed;

  let tenantA: string;
  let org: string;
  let ctx: string;
  let ctxOtro: string;

  let paciente: CuentaFicticia;
  let cuidadora: CuentaFicticia;
  let profesional: CuentaFicticia;
  let revisor: CuentaFicticia;
  let gestor: CuentaFicticia;
  let otroPaciente: CuentaFicticia;

  beforeAll(async () => {
    owner = createTestPrismaClient();
    seed = new CareSeed(owner);

    const tenant = await owner.tenant.findUnique({
      where: { code: process.env['MERDN_ACTIVE_TENANT_CODE'] ?? 'merdn-mvp' },
      select: { id: true },
    });
    if (tenant === null) {
      throw new Error('El tenant institucional MVP no existe: aplique las migraciones.');
    }
    tenantA = tenant.id;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new MalformedJsonFilter());
    await app.init();

    const fundadora = await seed.cuenta(tenantA, 'Fundadora');
    gestor = await seed.cuenta(tenantA, 'Gestora');
    org = await seed.organizacion(tenantA, 'HOSPITAL');
    await seed.manager(tenantA, org, gestor.humanAccountId, fundadora.humanAccountId);

    paciente = await seed.cuenta(tenantA, 'Lucía');
    await seed.aprobar(paciente, 'PATIENT');
    const patientId = await seed.paciente(paciente);
    ctx = await seed.contexto(tenantA, org, patientId, gestor.humanAccountId);

    otroPaciente = await seed.cuenta(tenantA, 'Marta');
    await seed.aprobar(otroPaciente, 'PATIENT');
    ctxOtro = await seed.contexto(tenantA, org, await seed.paciente(otroPaciente), gestor.humanAccountId);

    const base = { tenantId: tenantA, organizationId: org, contextId: ctx, patientId, grantedByHumanAccountId: gestor.humanAccountId };

    cuidadora = await seed.cuenta(tenantA, 'Cuidadora');
    await seed.aprobar(cuidadora, 'CAREGIVER');
    const relacion = await seed.relacion(tenantA, patientId, cuidadora.personId);
    for (const permission of ['CONTRIBUTE_RECORDS', 'REQUEST_ALARM'] as const) {
      await seed.concesion({ ...base, humanAccountId: cuidadora.humanAccountId, actorKind: 'CAREGIVER', permission, caregiverRelationshipId: relacion });
    }

    profesional = await seed.cuenta(tenantA, 'Visitador');
    await seed.aprobar(profesional, 'FIELD_PROFESSIONAL');
    const asignacion = await seed.asignacion(tenantA, patientId, await seed.profesional(profesional));
    const competenciaProfesional = await seed.competencia(tenantA, org, profesional.humanAccountId, gestor.humanAccountId);
    for (const permission of ['VIEW_RECORDS', 'CONTRIBUTE_RECORDS'] as const) {
      await seed.concesion({ ...base, humanAccountId: profesional.humanAccountId, actorKind: 'PROFESSIONAL', permission, careAssignmentId: asignacion });
    }
    await seed.concesion({
      ...base,
      humanAccountId: profesional.humanAccountId,
      actorKind: 'PROFESSIONAL',
      permission: 'MANAGE_RULES',
      careAssignmentId: asignacion,
      competenceAttestationId: competenciaProfesional,
    });

    revisor = await seed.cuenta(tenantA, 'Revisora');
    const competenciaRevisor = await seed.competencia(tenantA, org, revisor.humanAccountId, gestor.humanAccountId);
    for (const permission of ['REVIEW_ALARMS', 'VIEW_RECORDS'] as const) {
      await seed.concesion({ ...base, humanAccountId: revisor.humanAccountId, actorKind: 'HOSPITAL_REVIEWER', permission, competenceAttestationId: competenciaRevisor });
    }
  });

  afterAll(async () => {
    await app?.close();
    await owner?.$disconnect();
  });

  const cookie = (cuenta: CuentaFicticia): string => `${HUMAN_COOKIE}=${cuenta.sessionToken}`;
  const get = (path: string, cuenta: CuentaFicticia | null) => {
    const peticion = request(app.getHttpServer()).get(path);
    return cuenta === null ? peticion : peticion.set('Cookie', cookie(cuenta));
  };
  const post = (path: string, cuenta: CuentaFicticia, body: object) =>
    request(app.getHttpServer()).post(path).set('Cookie', cookie(cuenta)).set('Origin', ORIGIN).send(body);

  function definirDato(body: object = {}) {
    return post(`${BASE}/${ctx}/observables`, profesional, {
      idempotencyKey: randomUUID(),
      code: `dato-${randomUUID().slice(0, 8)}`,
      label: 'Dato ficticio de prueba',
      valueType: 'BOOLEAN',
      ...body,
    });
  }

  /* ====================================================================== */
  /* Directorio de contextos propios                                         */
  /* ====================================================================== */

  describe('directorio', () => {
    it('cada cuenta ve solo sus contextos y las acciones que MP01 le concede', async () => {
      const propio = await get(`/api/v1/care/contexts`, paciente).expect(200);
      expect(propio.body.items).toEqual([
        expect.objectContaining({ contextId: ctx, patientLabel: 'Mi cuidado', actorKind: 'PATIENT', actions: ['VIEW_RECORDS', 'CONTRIBUTE_RECORDS', 'REQUEST_ALARM'] }),
      ]);
      expect(propio.headers['cache-control']).toContain('no-store');

      const visitador = await get(`/api/v1/care/contexts`, profesional).expect(200);
      expect(visitador.body.items).toHaveLength(1);
      expect(visitador.body.items[0]).toMatchObject({ contextId: ctx, patientLabel: 'Lucía E.', actorKind: 'PROFESSIONAL' });
      expect(visitador.body.items[0].actions).toEqual(['VIEW_RECORDS', 'CONTRIBUTE_RECORDS', 'MANAGE_RULES']);

      const hospital = await get(`/api/v1/care/contexts`, revisor).expect(200);
      expect(hospital.body.items[0].actions).toEqual(['VIEW_RECORDS', 'REVIEW_ALARMS']);
      expect(JSON.stringify(hospital.body)).not.toContain(ctxOtro);
    });

    it('el manager sin concesión no descubre nada y sin sesión es 401', async () => {
      const manager = await get(`/api/v1/care/contexts`, gestor).expect(200);
      expect(manager.body).toEqual({ items: [], nextCursor: null });
      await get(`/api/v1/care/contexts`, null).expect(401);
    });

    it('el descubrimiento no abre contenido: con el GUC de cuenta no se lee ningún registro', async () => {
      const visibles = await owner.$transaction(async (tx) => {
        await tx.$executeRawUnsafe('SET LOCAL ROLE "merdn_runtime"');
        await tx.$executeRaw`SELECT set_config('merdn.tenant_id', ${tenantA}, true)`;
        await tx.$executeRaw`SELECT set_config('merdn.discovery_account_id', ${profesional.humanAccountId}, true)`;
        return {
          contextos: await tx.patientCareContext.count(),
          registros: await tx.careRecord.count(),
          alarmas: await tx.careAlarm.count(),
          observables: await tx.careObservableDefinition.count(),
        };
      });

      expect(visibles).toEqual({ contextos: 1, registros: 0, alarmas: 0, observables: 0 });
    });
  });

  /* ====================================================================== */
  /* Observables validados                                                   */
  /* ====================================================================== */

  describe('observables', () => {
    it('solo el profesional con MANAGE_RULES y competencia define; cuidadora, paciente y revisor no', async () => {
      const creado = await definirDato().expect(201);
      expect(creado.body).toMatchObject({ version: 1, valueType: 'BOOLEAN', unit: null, options: null });

      for (const cuenta of [cuidadora, paciente, revisor, gestor]) {
        const respuesta = await post(`${BASE}/${ctx}/observables`, cuenta, {
          idempotencyKey: randomUUID(),
          code: 'no-autorizado',
          label: 'No autorizado',
          valueType: 'BOOLEAN',
        }).expect(403);
        expect(respuesta.body.code).toBe('CARE_ACCESS_DENIED');
      }
    });

    it('una versión nueva retira la anterior; la clave repetida con otro contenido es 409', async () => {
      const code = `escala-${randomUUID().slice(0, 8)}`;
      const clave = randomUUID();
      const cuerpo = { idempotencyKey: clave, code, label: 'Escala ficticia', valueType: 'CHOICE', options: [{ code: 'a', label: 'Opción A' }, { code: 'b', label: 'Opción B' }] };

      const v1 = await post(`${BASE}/${ctx}/observables`, profesional, cuerpo).expect(201);
      const repetido = await post(`${BASE}/${ctx}/observables`, profesional, cuerpo).expect(201);
      expect(repetido.body.id).toBe(v1.body.id);

      await post(`${BASE}/${ctx}/observables`, profesional, { ...cuerpo, label: 'Otro contenido' }).expect(409);

      const v2 = await post(`${BASE}/${ctx}/observables`, profesional, { ...cuerpo, idempotencyKey: randomUUID(), label: 'Escala ficticia v2' }).expect(201);
      expect(v2.body.version).toBe(2);

      const vigentes = await get(`${BASE}/${ctx}/observables`, cuidadora).expect(200);
      const delCodigo = vigentes.body.filter((item: { code: string }) => item.code === code);
      expect(delCodigo).toEqual([expect.objectContaining({ id: v2.body.id, version: 2 })]);
    });

    it('rechaza campos no previstos y formas inválidas sin consultar nada', async () => {
      await definirDato({ severity: 'ROJA' }).expect(400);
      await definirDato({ valueType: 'NUMBER', options: [{ code: 'x', label: 'X' }] }).expect(400);
      await definirDato({ valueType: 'BOOLEAN', unit: 'mg' }).expect(400);
      await definirDato({ code: 'Mayúsculas' }).expect(400);
    });
  });

  /* ====================================================================== */
  /* Registros y enmiendas                                                   */
  /* ====================================================================== */

  describe('registros', () => {
    it('la cuidadora registra un dato tipado; la fuente y la recepción las fija el servidor', async () => {
      const dato = await definirDato().expect(201);
      const ocurrencia = new Date(Date.now() - 30 * 60 * 1000).toISOString();

      const registro = await post(`${BASE}/${ctx}/records`, cuidadora, {
        idempotencyKey: randomUUID(),
        occurredAt: ocurrencia,
        note: 'Nota ficticia de la cuidadora',
        observations: [{ definitionId: dato.body.id, value: true }],
      }).expect(201);

      expect(registro.body).toMatchObject({ source: 'CAREGIVER', authoredByMe: true, occurredAt: ocurrencia });
      expect(new Date(registro.body.receivedAt).getTime()).toBeGreaterThanOrEqual(new Date(ocurrencia).getTime());
      expect(registro.body.observations[0]).toMatchObject({ value: true, valueType: 'BOOLEAN' });
    });

    it('NUMBER viaja como decimal exacto; tipo incorrecto, futuro o dato ajeno se rechazan', async () => {
      const numero = await definirDato({ valueType: 'NUMBER', unit: 'unidad ficticia' }).expect(201);
      const ahora = new Date(Date.now() - 60 * 1000).toISOString();

      const exacto = await post(`${BASE}/${ctx}/records`, profesional, {
        idempotencyKey: randomUUID(),
        occurredAt: ahora,
        observations: [{ definitionId: numero.body.id, value: '12345678901234567890.0123456789' }],
      }).expect(201);
      expect(exacto.body.observations[0].value).toBe('12345678901234567890.0123456789');
      expect(exacto.body.source).toBe('PROFESSIONAL');

      for (const value of [12.5, 'NaN', 'Infinity', '1e3', true]) {
        await post(`${BASE}/${ctx}/records`, profesional, {
          idempotencyKey: randomUUID(),
          occurredAt: ahora,
          observations: [{ definitionId: numero.body.id, value }],
        }).expect(400);
      }

      await post(`${BASE}/${ctx}/records`, profesional, {
        idempotencyKey: randomUUID(),
        occurredAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        note: 'Futuro',
      }).expect(400);

      await post(`${BASE}/${ctx}/records`, profesional, {
        idempotencyKey: randomUUID(),
        occurredAt: ahora,
        observations: [{ definitionId: randomUUID(), value: true }],
      }).expect(400);
    });

    it('quien puede VER lee toda la bitácora; quien solo aporta lee la suya; terceros 403 uniforme', async () => {
      const nota = `Nota del paciente ${randomUUID()}`;
      await post(`${BASE}/${ctx}/records`, cuidadora, {
        idempotencyKey: randomUUID(),
        occurredAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        note: 'Nota propia de la cuidadora (ficticia)',
      }).expect(201);
      await post(`${BASE}/${ctx}/records`, paciente, {
        idempotencyKey: randomUUID(),
        occurredAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        note: nota,
      }).expect(201);

      const delRevisor = await get(`${BASE}/${ctx}/records?limit=50`, revisor).expect(200);
      expect(delRevisor.body.items.some((item: { note: string }) => item.note === nota)).toBe(true);

      const deLaCuidadora = await get(`${BASE}/${ctx}/records?limit=50`, cuidadora).expect(200);
      expect(deLaCuidadora.body.items.length).toBeGreaterThan(0);
      expect(deLaCuidadora.body.items.every((item: { authoredByMe: boolean }) => item.authoredByMe)).toBe(true);

      const denegados = await Promise.all([
        get(`${BASE}/${ctx}/records`, gestor),
        get(`${BASE}/${ctx}/records`, otroPaciente),
        get(`${BASE}/${randomUUID()}/records`, paciente),
        get(`${BASE}/no-es-uuid/records`, paciente),
      ]);
      for (const respuesta of denegados) {
        expect(respuesta.status).toBe(403);
        expect(respuesta.body).toEqual({
          code: 'CARE_ACCESS_DENIED',
          message: 'No tiene autorización para esta acción en este contexto de cuidado.',
        });
      }
    });

    it('el reintento idéntico devuelve el mismo registro; la misma clave con otro contenido es 409', async () => {
      const cuerpo = { idempotencyKey: randomUUID(), occurredAt: new Date(Date.now() - 60_000).toISOString(), note: 'Reintento ficticio' };
      const primero = await post(`${BASE}/${ctx}/records`, cuidadora, cuerpo).expect(201);
      const segundo = await post(`${BASE}/${ctx}/records`, cuidadora, cuerpo).expect(201);
      expect(segundo.body.id).toBe(primero.body.id);
      await post(`${BASE}/${ctx}/records`, cuidadora, { ...cuerpo, note: 'Otro contenido' }).expect(409);

      expect(await owner.careRecord.count({ where: { id: primero.body.id } })).toBe(1);
    });

    it('la enmienda es del autor, versionada y no reescribe el original', async () => {
      const dato = await definirDato().expect(201);
      const registro = await post(`${BASE}/${ctx}/records`, cuidadora, {
        idempotencyKey: randomUUID(),
        occurredAt: new Date(Date.now() - 60_000).toISOString(),
        observations: [{ definitionId: dato.body.id, value: false }],
      }).expect(201);
      const observacion = registro.body.observations[0].id;
      const ruta = `${BASE}/${ctx}/records/${registro.body.id}/amendments`;

      const enmendado = await post(ruta, cuidadora, {
        idempotencyKey: randomUUID(),
        expectedSequence: 0,
        observationId: observacion,
        replacement: true,
        reason: 'Corrección ficticia',
      }).expect(201);
      expect(enmendado.body.observations[0].value).toBe(false);
      expect(enmendado.body.amendments).toEqual([expect.objectContaining({ sequence: 1, replacement: true, authoredByMe: true })]);

      await post(ruta, cuidadora, { idempotencyKey: randomUUID(), expectedSequence: 0, note: 'Carrera', reason: 'Carrera' }).expect(409);
      await post(ruta, profesional, { idempotencyKey: randomUUID(), expectedSequence: 1, note: 'Ajena', reason: 'Ajena' }).expect(404);
      await post(ruta, cuidadora, { idempotencyKey: randomUUID(), expectedSequence: 1, observationId: observacion, replacement: 'texto', reason: 'Tipo' }).expect(400);

      await expect(
        owner.$executeRaw`UPDATE "care_record" SET "note" = 'reescrito' WHERE "id" = ${registro.body.id}::uuid`,
      ).rejects.toThrow();
    });
  });

  /* ====================================================================== */
  /* Alarmas manuales y seguimiento                                          */
  /* ====================================================================== */

  describe('alarmas', () => {
    function pedirAyuda(cuenta: CuentaFicticia = cuidadora, body: object = {}) {
      return post(`${BASE}/${ctx}/alarms`, cuenta, { idempotencyKey: randomUUID(), reasonCode: 'REQUEST_REVIEW', ...body });
    }

    it('la solicitud manual queda NUEVA, sin clasificación y con el texto de recepción aprobado', async () => {
      const creada = await pedirAyuda(cuidadora, { note: 'Necesito revisión (ficticio)' }).expect(201);

      expect(creada.body.receiptMessage).toBe(MANUAL_RECEIPT_MESSAGE);
      expect(creada.body.alarm).toMatchObject({ origin: 'MANUAL', state: 'NUEVA', severity: null, initiatedByMe: true, assigned: false, version: 1 });

      const bandeja = await get(`${BASE}/${ctx}/alarms?limit=50`, revisor).expect(200);
      expect(bandeja.body.canReview).toBe(true);
      expect(bandeja.body.items.some((item: { id: string }) => item.id === creada.body.alarm.id)).toBe(true);
    });

    it('no acepta severidad, estado ni actor del cliente; el reintento no duplica', async () => {
      await pedirAyuda(cuidadora, { severity: 'ROJA' }).expect(400);
      await pedirAyuda(cuidadora, { state: 'CERRADA' }).expect(400);
      await pedirAyuda(cuidadora, { reasonCode: 'DOLOR_TORACICO' }).expect(400);

      const cuerpo = { idempotencyKey: randomUUID(), reasonCode: 'REQUEST_REVIEW' };
      const uno = await post(`${BASE}/${ctx}/alarms`, cuidadora, cuerpo).expect(201);
      const dos = await post(`${BASE}/${ctx}/alarms`, cuidadora, cuerpo).expect(201);
      expect(dos.body.alarm.id).toBe(uno.body.alarm.id);
      expect(await owner.careAlarmTransition.count({ where: { alarmId: uno.body.alarm.id, action: 'CREATE' } })).toBe(1);
    });

    it('dos envíos idénticos SIMULTÁNEOS producen una sola alarma y una sola creación', async () => {
      const cuerpo = { idempotencyKey: randomUUID(), reasonCode: 'REQUEST_REVIEW', note: 'Concurrente (ficticio)' };
      const [uno, dos] = await Promise.all([
        post(`${BASE}/${ctx}/alarms`, cuidadora, cuerpo),
        post(`${BASE}/${ctx}/alarms`, cuidadora, cuerpo),
      ]);

      expect([uno.status, dos.status]).toEqual([201, 201]);
      expect(dos.body.alarm.id).toBe(uno.body.alarm.id);
      expect(await owner.careAlarm.count({ where: { id: uno.body.alarm.id } })).toBe(1);
      expect(await owner.careAlarmTransition.count({ where: { alarmId: uno.body.alarm.id, action: 'CREATE' } })).toBe(1);
      expect(await owner.auditEvent.count({ where: { eventType: 'CARE_ALARM_CREATED', resourceId: uno.body.alarm.id } })).toBe(1);
    });

    it('el solicitante ve solo las suyas; el manager y el revisor sin concesión no piden ni ven', async () => {
      const delPaciente = await pedirAyuda(paciente).expect(201);
      const vistaCuidadora = await get(`${BASE}/${ctx}/alarms?limit=50`, cuidadora).expect(200);
      expect(vistaCuidadora.body.canReview).toBe(false);
      expect(vistaCuidadora.body.items.every((item: { initiatedByMe: boolean }) => item.initiatedByMe)).toBe(true);
      expect(vistaCuidadora.body.items.some((item: { id: string }) => item.id === delPaciente.body.alarm.id)).toBe(false);

      await get(`${BASE}/${ctx}/alarms/${delPaciente.body.alarm.id}`, cuidadora).expect(404);
      await get(`${BASE}/${ctx}/alarms`, gestor).expect(403);
      await pedirAyuda(revisor).expect(403);
      await pedirAyuda(gestor).expect(403);
    });

    it('seguimiento completo con versión esperada, motivos y competencia', async () => {
      const alarma = (await pedirAyuda().expect(201)).body.alarm;
      const ruta = `${BASE}/${ctx}/alarms/${alarma.id}/transitions`;

      const reconocida = await post(ruta, revisor, { action: 'ACKNOWLEDGE', expectedVersion: 1 }).expect(200);
      expect(reconocida.body).toMatchObject({ state: 'EN_GESTION', version: 2 });
      await post(ruta, revisor, { action: 'ACKNOWLEDGE', expectedVersion: 1 }).expect(409);

      await post(ruta, revisor, { action: 'CLASSIFY', expectedVersion: 2, severity: 'AMARILLA' }).expect(400);
      const clasificada = await post(ruta, revisor, { action: 'CLASSIFY', expectedVersion: 2, severity: 'AMARILLA', reason: 'Clasificación ficticia' }).expect(200);
      expect(clasificada.body).toMatchObject({ severity: 'AMARILLA', state: 'EN_GESTION' });

      await post(ruta, revisor, { action: 'ASSIGN', expectedVersion: 3, assignee: cuidadora.humanAccountId }).expect(400);
      const asignada = await post(ruta, revisor, { action: 'ASSIGN', expectedVersion: 3, assignee: 'self' }).expect(200);
      expect(asignada.body).toMatchObject({ assignedToMe: true, version: 4 });

      await post(ruta, cuidadora, { action: 'RESOLVE', expectedVersion: 4, reason: 'No autorizado' }).expect(403);
      await post(ruta, profesional, { action: 'RESOLVE', expectedVersion: 4, reason: 'No autorizado' }).expect(403);

      const informada = await post(`${BASE}/${ctx}/alarms/${alarma.id}/resolution-reports`, cuidadora, {
        idempotencyKey: randomUUID(),
        note: 'Ya se resolvió (ficticio)',
      }).expect(201);
      expect(informada.body).toMatchObject({ state: 'EN_GESTION', severity: 'AMARILLA', version: 4 });

      await post(ruta, revisor, { action: 'RESOLVE', expectedVersion: 4 }).expect(400);
      const resuelta = await post(ruta, revisor, { action: 'RESOLVE', expectedVersion: 4, reason: 'Resolución ficticia' }).expect(200);
      expect(resuelta.body.state).toBe('RESUELTA');
      expect(resuelta.body.resolvedAt).not.toBeNull();

      const cerrada = await post(ruta, revisor, { action: 'CLOSE', expectedVersion: 5, reason: 'Cierre ficticio' }).expect(200);
      expect(cerrada.body).toMatchObject({ state: 'CERRADA', severity: 'AMARILLA' });
      await post(ruta, revisor, { action: 'ACKNOWLEDGE', expectedVersion: 6 }).expect(400);

      const reabierta = await post(ruta, revisor, { action: 'REOPEN', expectedVersion: 6, reason: 'Reapertura ficticia' }).expect(200);
      expect(reabierta.body).toMatchObject({ state: 'EN_GESTION', closedAt: null, version: 7 });

      expect(reabierta.body.transitions.map((item: { action: string }) => item.action)).toEqual([
        'CREATE', 'ACKNOWLEDGE', 'CLASSIFY', 'ASSIGN', 'REPORT_RESOLUTION', 'RESOLVE', 'CLOSE', 'REOPEN',
      ]);
    });

    it('sin origen permitido la escritura se rechaza antes de tocar nada', async () => {
      const antes = await owner.careAlarm.count({ where: { contextId: ctx } });
      await request(app.getHttpServer())
        .post(`${BASE}/${ctx}/alarms`)
        .set('Cookie', cookie(cuidadora))
        .send({ idempotencyKey: randomUUID(), reasonCode: 'REQUEST_REVIEW' })
        .expect(403);
      await request(app.getHttpServer())
        .post(`${BASE}/${ctx}/alarms`)
        .set('Cookie', cookie(cuidadora))
        .set('Origin', 'https://otro-origen.example')
        .send({ idempotencyKey: randomUUID(), reasonCode: 'REQUEST_REVIEW' })
        .expect(403);
      expect(await owner.careAlarm.count({ where: { contextId: ctx } })).toBe(antes);
    });
  });

  /* ====================================================================== */
  /* MP04–MP05: criterios individuales, alarmas automáticas y semáforo       */
  /* ====================================================================== */

  describe('criterios y alarmas automáticas', () => {
    async function datoNumerico(): Promise<{ readonly id: string; readonly code: string }> {
      const respuesta = await definirDato({ valueType: 'NUMBER', unit: 'unidad ficticia' }).expect(201);
      return { id: respuesta.body.id, code: respuesta.body.code };
    }

    function criterio(code: string, extra: object = {}) {
      return post(`${BASE}/${ctx}/criteria`, profesional, {
        idempotencyKey: randomUUID(),
        observableCode: code,
        comparator: 'GTE',
        value: '38.0',
        requiredCount: 2,
        windowMinutes: 60,
        severity: 'AMARILLA',
        ...extra,
      });
    }

    /**
     * La activación la fija la base y solo cuenta lo ocurrido después. Para no
     * depender del desfase entre el reloj local y el de PostgreSQL, cada
     * ocurrencia se fecha tras la activación devuelta por el servidor y se
     * espera a que el reloj local la haya superado (condición, no espera fija).
     */
    async function despuesDe(activatedAt: string, offsetMs: number): Promise<string> {
      const instante = new Date(new Date(activatedAt).getTime() + offsetMs);
      while (Date.now() <= instante.getTime() + 50) {
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      return instante.toISOString();
    }

    function registrar(definitionId: string, value: string, occurredAt: string) {
      return post(`${BASE}/${ctx}/records`, cuidadora, {
        idempotencyKey: randomUUID(),
        occurredAt,
        observations: [{ definitionId, value }],
      });
    }

    it('solo el profesional con MANAGE_RULES y competencia define; sin valores no hay criterio', async () => {
      const dato = await datoNumerico();

      for (const cuenta of [cuidadora, revisor, paciente, gestor]) {
        await post(`${BASE}/${ctx}/criteria`, cuenta, {
          idempotencyKey: randomUUID(), observableCode: dato.code, comparator: 'GTE', value: '1', requiredCount: 1, windowMinutes: 10, severity: 'ROJA',
        }).expect(403);
      }

      await criterio(dato.code, { value: undefined }).expect(400);
      await criterio(dato.code, { comparator: 'IN', value: ['a'] }).expect(400);
      await criterio(dato.code, { requiredCount: 0 }).expect(400);
      await criterio(dato.code, { windowMinutes: 0 }).expect(400);
      await criterio('dato-inexistente').expect(400);
      await criterio(dato.code, { umbralSugerido: '37.5' }).expect(400);
    });

    it('sin criterio, ningún registro abre una alarma automática', async () => {
      const dato = await datoNumerico();
      const respuesta = await registrar(dato.id, '99', new Date(Date.now() - 60_000).toISOString()).expect(201);
      expect(respuesta.body.evaluation).toEqual({ alarmsOpened: 0, evidenceAdded: 0 });
    });

    it('N coincidencias en la ventana abren UN episodio; las siguientes son evidencia', async () => {
      const dato = await datoNumerico();
      const creado = (await criterio(dato.code).expect(201)).body;
      expect(creado.current).toMatchObject({ version: 1, comparator: 'GTE', value: '38', requiredCount: 2, windowMinutes: 60, severity: 'AMARILLA', status: 'ACTIVE' });

      const primero = await registrar(dato.id, '38.5', await despuesDe(creado.current.activatedAt, 100)).expect(201);
      expect(primero.body.evaluation).toEqual({ alarmsOpened: 0, evidenceAdded: 0 });

      const noCoincide = await registrar(dato.id, '37.9', await despuesDe(creado.current.activatedAt, 200)).expect(201);
      expect(noCoincide.body.evaluation).toEqual({ alarmsOpened: 0, evidenceAdded: 0 });

      const segundo = await registrar(dato.id, '39', await despuesDe(creado.current.activatedAt, 300)).expect(201);
      expect(segundo.body.evaluation).toEqual({ alarmsOpened: 1, evidenceAdded: 0 });

      const tercero = await registrar(dato.id, '40', await despuesDe(creado.current.activatedAt, 400)).expect(201);
      expect(tercero.body.evaluation).toEqual({ alarmsOpened: 0, evidenceAdded: 1 });

      const abiertas = await owner.careAlarm.findMany({ where: { contextId: ctx, criterionId: creado.id, origin: 'AUTOMATIC' } });
      expect(abiertas).toHaveLength(1);
      expect(abiertas[0]).toMatchObject({ state: 'NUEVA', severity: 'AMARILLA', previousAlarmId: null });

      const detalle = await get(`${BASE}/${ctx}/alarms/${abiertas[0]?.id}`, revisor).expect(200);
      expect(detalle.body.origin).toBe('AUTOMATIC');
      expect(detalle.body.evidence.map((item: { value: string }) => item.value)).toEqual(['38.5', '39', '40']);
      expect(await owner.auditEvent.count({ where: { eventType: 'CARE_ALARM_CREATED', resourceId: abiertas[0]?.id } })).toBe(1);

      // La base sostiene UNA alarma automática abierta por criterio.
      await expect(
        owner.careAlarm.create({
          data: {
            tenantId: tenantA, organizationId: org, contextId: ctx, patientId: abiertas[0]?.patientId ?? '',
            origin: 'AUTOMATIC', initiatedByHumanAccountId: cuidadora.humanAccountId, reasonCode: 'CRITERION_MET',
            criterionId: creado.id, criterionVersionId: creado.current.id,
          },
        }),
      ).rejects.toThrow();
    });

    it('tras cerrar, la evidencia consumida no reabre; un conteo nuevo completo abre un episodio enlazado', async () => {
      const dato = await datoNumerico();
      const creado = (await criterio(dato.code, { requiredCount: 2, severity: 'ROJA' }).expect(201)).body;
      const activado = creado.current.activatedAt;

      await registrar(dato.id, '50', await despuesDe(activado, 100)).expect(201);
      await registrar(dato.id, '51', await despuesDe(activado, 200)).expect(201);
      const primera = await owner.careAlarm.findFirstOrThrow({ where: { contextId: ctx, criterionId: creado.id } });

      const ruta = `${BASE}/${ctx}/alarms/${primera.id}/transitions`;
      await post(ruta, revisor, { action: 'RESOLVE', expectedVersion: 1, reason: 'Resuelta (ficticio)' }).expect(200);
      await post(ruta, revisor, { action: 'CLOSE', expectedVersion: 2, reason: 'Cerrada (ficticio)' }).expect(200);

      const una = await registrar(dato.id, '52', await despuesDe(activado, 300)).expect(201);
      expect(una.body.evaluation).toEqual({ alarmsOpened: 0, evidenceAdded: 0 });

      const dos = await registrar(dato.id, '53', await despuesDe(activado, 400)).expect(201);
      expect(dos.body.evaluation).toEqual({ alarmsOpened: 1, evidenceAdded: 0 });

      const segunda = await owner.careAlarm.findFirstOrThrow({ where: { contextId: ctx, criterionId: creado.id, state: { not: 'CERRADA' } } });
      expect(segunda.previousAlarmId).toBe(primera.id);
      expect(segunda.severity).toBe('ROJA');
    });

    it('una corrección no crea, cierra ni rebaja la alarma; la evidencia queda marcada para revisar', async () => {
      const dato = await datoNumerico();
      const creado = (await criterio(dato.code, { requiredCount: 1 }).expect(201)).body;
      const registro = await registrar(dato.id, '45', await despuesDe(creado.current.activatedAt, 100)).expect(201);
      expect(registro.body.evaluation.alarmsOpened).toBe(1);

      await post(`${BASE}/${ctx}/records/${registro.body.id}/amendments`, cuidadora, {
        idempotencyKey: randomUUID(),
        expectedSequence: 0,
        observationId: registro.body.observations[0].id,
        replacement: '30',
        reason: 'Se midió mal (ficticio)',
      }).expect(201);

      const alarma = await owner.careAlarm.findFirstOrThrow({ where: { contextId: ctx, criterionId: creado.id } });
      expect(alarma).toMatchObject({ state: 'NUEVA', severity: 'AMARILLA', version: 1 });

      const detalle = await get(`${BASE}/${ctx}/alarms/${alarma.id}`, revisor).expect(200);
      expect(detalle.body.evidence).toEqual([expect.objectContaining({ value: '45', correctedAfterwards: true })]);
    });

    it('una versión nueva conserva la identidad; retirar no cierra lo abierto ni sigue evaluando', async () => {
      const dato = await datoNumerico();
      const creado = (await criterio(dato.code, { requiredCount: 1 }).expect(201)).body;
      await registrar(dato.id, '41', await despuesDe(creado.current.activatedAt, 100)).expect(201);

      const v2 = (await criterio(dato.code, { criterionId: creado.id, requiredCount: 3, severity: 'ROJA' }).expect(201)).body;
      expect(v2.id).toBe(creado.id);
      expect(v2.current).toMatchObject({ version: 2, requiredCount: 3, severity: 'ROJA' });
      expect(await owner.careAlarmCriterionVersion.count({ where: { criterionId: creado.id, status: 'ACTIVE' } })).toBe(1);

      // Episodio abierto por la v1: una coincidencia con la v2 se agrega como evidencia.
      const evidencia = await registrar(dato.id, '42', await despuesDe(v2.current.activatedAt, 100)).expect(201);
      expect(evidencia.body.evaluation).toEqual({ alarmsOpened: 0, evidenceAdded: 1 });

      const retirado = (await post(`${BASE}/${ctx}/criteria/${creado.id}/retire`, profesional, { reason: 'Ya no aplica (ficticio)' }).expect(200)).body;
      expect(retirado).toMatchObject({ status: 'RETIRED', retiredReason: 'Ya no aplica (ficticio)' });

      const despues = await registrar(dato.id, '43', await despuesDe(v2.current.activatedAt, 200)).expect(201);
      expect(despues.body.evaluation).toEqual({ alarmsOpened: 0, evidenceAdded: 0 });
      expect(await owner.careAlarm.count({ where: { criterionId: creado.id, state: { not: 'CERRADA' } } })).toBe(1);
    });

    it('semáforo con texto y cola de revisión solo de contextos propios', async () => {
      const semaforo = await get(`${BASE}/${ctx}/semaphore`, revisor).expect(200);
      expect(['ROJO', 'AMARILLO', 'PENDIENTE', 'ESTABLE']).toContain(semaforo.body.level);
      expect(semaforo.body.label.length).toBeGreaterThan(10);
      await get(`${BASE}/${ctx}/semaphore`, cuidadora).expect(403);

      const cola = await get('/api/v1/care/review-queue', revisor).expect(200);
      expect(cola.body.map((item: { contextId: string }) => item.contextId)).toEqual([ctx]);
      expect(cola.body[0].alarms.every((alarma: { state: string }) => alarma.state !== 'CERRADA')).toBe(true);
      expect(JSON.stringify(cola.body)).not.toContain(ctxOtro);

      expect((await get('/api/v1/care/review-queue', cuidadora).expect(200)).body).toEqual([]);
      expect((await get('/api/v1/care/review-queue', gestor).expect(200)).body).toEqual([]);
    });
  });

  /* ====================================================================== */
  /* MP05b: administración de permisos por el gestor                         */
  /* ====================================================================== */

  describe('administración del gestor', () => {
    const ADMIN = '/api/v1/care/admin/organizations';
    const doc = (cuenta: CuentaFicticia) => ({ documentType: 'CEDULA_CIUDADANIA', documentNumber: cuenta.documentNumber });

    it('el script crea el primer gestor auditado; el gestor administra sin obtener acceso clínico', async () => {
      const soporte = await seed.cuenta(tenantA, 'Soporte');
      await owner.platformSupportCapability.create({ data: { homeTenantId: tenantA, humanAccountId: soporte.humanAccountId } });
      const gestora = await seed.cuenta(tenantA, 'Gestora nueva');
      const codigo = `mp05b-${randomUUID().slice(0, 8)}`;

      const { provision } = await import('../../../scripts/care/provision-care-manager.mjs');
      const argumentos = {
        tenantCode: process.env['MERDN_ACTIVE_TENANT_CODE'] ?? 'merdn-mvp',
        organizationCode: codigo,
        organizationName: 'Hospital ficticio de administración',
        organizationKind: 'HOSPITAL' as const,
        manager: { documentType: 'CEDULA_CIUDADANIA' as const, documentNumber: gestora.documentNumber },
        grantor: { documentType: 'CEDULA_CIUDADANIA' as const, documentNumber: soporte.documentNumber },
        authorizationReference: 'PRUEBAS.ACTA.001',
        dryRun: false,
      };
      const resultado = await provision(argumentos, process.env['DATABASE_URL'] ?? '');
      expect(resultado.managerCreated).toBe(true);
      expect((await provision(argumentos, process.env['DATABASE_URL'] ?? '')).managerCreated).toBe(false);
      seed.organizations.add(resultado.organizationId);
      seed.managers.add(resultado.managerId);

      const auditado = await owner.auditEvent.findFirst({ where: { eventType: 'CARE_ADMIN_MANAGER_PROVISIONED', resourceId: resultado.managerId } });
      expect(auditado).toMatchObject({ actorUserId: soporte.humanAccountId, organizationId: resultado.organizationId });

      const lista = await get(`${ADMIN}`, gestora).expect(200);
      expect(lista.body).toEqual([{ organizationId: resultado.organizationId, name: 'Hospital ficticio de administración', kind: 'HOSPITAL' }]);
      expect((await get(`${ADMIN}`, cuidadora).expect(200)).body).toEqual([]);
      await get(`${ADMIN}/${resultado.organizationId}`, cuidadora).expect(403);

      // Paciente nuevo con cuidadora, visitador y revisora del MISMO tenant.
      const pacienteN = await seed.cuenta(tenantA, 'Rosa');
      await seed.aprobar(pacienteN, 'PATIENT');
      const patientId = await seed.paciente(pacienteN);
      const cuidadoraN = await seed.cuenta(tenantA, 'Cuidadora nueva');
      await seed.aprobar(cuidadoraN, 'CAREGIVER');
      await seed.relacion(tenantA, patientId, cuidadoraN.personId);
      const sinRelacion = await seed.cuenta(tenantA, 'Sin relación');
      await seed.aprobar(sinRelacion, 'CAREGIVER');
      const revisoraN = await seed.cuenta(tenantA, 'Revisora nueva');

      const creado = await post(`${ADMIN}/${resultado.organizationId}/contexts`, gestora, {
        patient: doc(pacienteN),
        authorizationReference: 'pruebas.custodia.001',
      }).expect(201);
      const contexto = creado.body.contexts[0];
      expect(contexto).toMatchObject({ patientLabel: 'Rosa E.', status: 'ACTIVE', authorizationReference: 'PRUEBAS.CUSTODIA.001', grants: [] });
      await post(`${ADMIN}/${resultado.organizationId}/contexts`, gestora, { patient: doc(pacienteN), authorizationReference: 'PRUEBAS.X.002' }).expect(409);

      const conceder = (cuenta: CuentaFicticia, actorKind: string, permission: string) =>
        post(`${ADMIN}/${resultado.organizationId}/contexts/${contexto.contextId}/grants`, gestora, {
          actorKind,
          permission,
          person: doc(cuenta),
          authorizationReference: 'PRUEBAS.CONCESION.001',
        });

      await conceder(cuidadoraN, 'CAREGIVER', 'CONTRIBUTE_RECORDS').expect(201);
      await conceder(cuidadoraN, 'CAREGIVER', 'CONTRIBUTE_RECORDS').expect(409);
      await conceder(cuidadoraN, 'CAREGIVER', 'REVIEW_ALARMS').expect(400);
      await conceder(sinRelacion, 'CAREGIVER', 'CONTRIBUTE_RECORDS').expect(400);
      await conceder(revisoraN, 'HOSPITAL_REVIEWER', 'REVIEW_ALARMS').expect(400);
      await conceder(gestora, 'HOSPITAL_REVIEWER', 'REVIEW_ALARMS').expect(400);

      await post(`${ADMIN}/${resultado.organizationId}/competences`, gestora, { person: doc(gestora), evidenceReference: 'PRUEBAS.COMP.000' }).expect(400);
      await post(`${ADMIN}/${resultado.organizationId}/competences`, gestora, { person: doc(revisoraN), evidenceReference: 'pruebas.comp.001' }).expect(201);
      const final = await conceder(revisoraN, 'HOSPITAL_REVIEWER', 'REVIEW_ALARMS').expect(201);
      expect(final.body.contexts[0].grants.map((g: { actorKind: string; permission: string }) => `${g.actorKind}:${g.permission}`)).toEqual([
        'CAREGIVER:CONTRIBUTE_RECORDS',
        'HOSPITAL_REVIEWER:REVIEW_ALARMS',
      ]);

      // La concesión es efectiva de inmediato y la revocación también.
      const directorio = await get('/api/v1/care/contexts', cuidadoraN).expect(200);
      expect(directorio.body.items).toEqual([expect.objectContaining({ contextId: contexto.contextId, actions: ['CONTRIBUTE_RECORDS'] })]);

      const concesion = final.body.contexts[0].grants[0];
      const revocado = await post(`${ADMIN}/${resultado.organizationId}/grants/${concesion.id}/revoke`, gestora, {}).expect(200);
      expect(revocado.body.contexts[0].grants[0].status).toBe('REVOKED');
      expect((await get('/api/v1/care/contexts', cuidadoraN).expect(200)).body.items).toEqual([]);

      // Ser gestor no da acceso clínico al contexto creado.
      await get(`${BASE}/${contexto.contextId}/records`, gestora).expect(403);

      const eventos = await owner.auditEvent.findMany({
        where: { organizationId: resultado.organizationId, eventType: { in: ['CARE_ADMIN_CONTEXT_CREATED', 'CARE_ADMIN_GRANT_ISSUED', 'CARE_ADMIN_GRANT_REVOKED', 'CARE_ADMIN_COMPETENCE_ATTESTED'] } },
        select: { eventType: true, actorUserId: true },
      });
      expect(new Set(eventos.map((evento) => evento.eventType))).toEqual(
        new Set(['CARE_ADMIN_CONTEXT_CREATED', 'CARE_ADMIN_GRANT_ISSUED', 'CARE_ADMIN_GRANT_REVOKED', 'CARE_ADMIN_COMPETENCE_ATTESTED']),
      );
      expect(eventos.every((evento) => evento.actorUserId === gestora.humanAccountId)).toBe(true);
    });

    it('un gestor no administra otra organización ni una revocada', async () => {
      await get(`${ADMIN}/${org}`, cuidadora).expect(403);
      await get(`${ADMIN}/${randomUUID()}`, gestor).expect(403);
      await get(`${ADMIN}/no-es-uuid`, gestor).expect(403);
      // `gestor` sí gestiona `org` desde el arranque de la suite.
      const propia = await get(`${ADMIN}/${org}`, gestor).expect(200);
      expect(propia.body.organizationId).toBe(org);
      expect(propia.body.contexts.length).toBeGreaterThan(0);
    });
  });

  /* ====================================================================== */
  /* Auditoría                                                               */
  /* ====================================================================== */

  describe('auditoría', () => {
    it('cada mutación deja un evento con organización y recurso, sin nota ni valor', async () => {
      const nota = `Nota que no debe auditarse ${randomUUID()}`;
      const registro = await post(`${BASE}/${ctx}/records`, cuidadora, {
        idempotencyKey: randomUUID(),
        occurredAt: new Date(Date.now() - 60_000).toISOString(),
        note: nota,
      }).expect(201);

      const eventos = await owner.auditEvent.findMany({ where: { resourceId: registro.body.id } });
      expect(eventos).toEqual([
        expect.objectContaining({
          eventType: 'CARE_RECORD_CREATED',
          actorType: 'HUMAN_ACCOUNT',
          actorUserId: cuidadora.humanAccountId,
          actorRole: null,
          organizationId: org,
          resourceType: 'CareRecord',
          outcome: 'SUCCESS',
        }),
      ]);
      expect(JSON.stringify(eventos)).not.toContain(nota);

      const directorio = await owner.auditEvent.findFirst({
        where: { eventType: 'CARE_CONTEXT_DIRECTORY_READ', actorUserId: paciente.humanAccountId },
      });
      expect(directorio).toMatchObject({ organizationId: null, resourceId: null, resourceType: 'CareContextDirectory' });
    });
  });
});
