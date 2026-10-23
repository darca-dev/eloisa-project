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
import { payloadHash } from '../src/care-context/care-mutation';
import { parseCriterionInput } from '../src/care-criteria/care-criteria.request';
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

  let patientIdCtx: string;
  let profesionalId: string;
  let competenciaProfesional: string;

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
    patientIdCtx = patientId;
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
    profesionalId = await seed.profesional(profesional);
    const asignacion = await seed.asignacion(tenantA, patientId, profesionalId);
    competenciaProfesional = await seed.competencia(tenantA, org, profesional.humanAccountId, gestor.humanAccountId);
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

    it('A09: asigna a otra revisora elegible sin sesión; si deja de serlo, 400 sin cambios; el actor sin revisión recibe 403 primero', async () => {
      const alarma = (await pedirAyuda().expect(201)).body.alarm;
      const ruta = `${BASE}/${ctx}/alarms/${alarma.id}/transitions`;

      const suplente = await seed.cuenta(tenantA, 'Revisora suplente');
      const competencia = await seed.competencia(tenantA, org, suplente.humanAccountId, gestor.humanAccountId);
      await seed.concesion({
        tenantId: tenantA,
        organizationId: org,
        contextId: ctx,
        patientId: patientIdCtx,
        grantedByHumanAccountId: gestor.humanAccountId,
        humanAccountId: suplente.humanAccountId,
        actorKind: 'HOSPITAL_REVIEWER',
        permission: 'REVIEW_ALARMS',
        competenceAttestationId: competencia,
      });
      // El destinatario no necesita una sesión interactiva abierta.
      await owner.humanSession.update({ where: { id: suplente.sessionId }, data: { revokedAt: new Date() } });

      // Actor sin REVIEW_ALARMS: denegación uniforme, sin evaluar ni proyectar al destinatario.
      for (const assignee of [suplente.humanAccountId, randomUUID()]) {
        const denegada = await post(ruta, profesional, { action: 'ASSIGN', expectedVersion: 1, assignee }).expect(403);
        expect(JSON.stringify(denegada.body)).not.toContain(suplente.humanAccountId);
      }

      const asignada = await post(ruta, revisor, { action: 'ASSIGN', expectedVersion: 1, assignee: suplente.humanAccountId }).expect(200);
      expect(asignada.body).toMatchObject({ assigned: true, assignedToMe: false, version: 2 });
      await post(ruta, revisor, { action: 'ASSIGN', expectedVersion: 2, assignee: 'self' }).expect(200);

      await owner.clinicalCompetenceAttestation.update({
        where: { id: competencia },
        data: { status: 'REVOKED', revokedAt: new Date(), version: { increment: 1 } },
      });

      for (const assignee of [suplente.humanAccountId, randomUUID()]) {
        const rechazada = await post(ruta, revisor, { action: 'ASSIGN', expectedVersion: 3, assignee }).expect(400);
        expect(rechazada.body.field).toBe('assignee');
      }

      const final = await owner.careAlarm.findUniqueOrThrow({ where: { id: alarma.id }, select: { version: true, assignedReviewerHumanAccountId: true } });
      expect(final).toEqual({ version: 3, assignedReviewerHumanAccountId: revisor.humanAccountId });
      expect(await owner.careAlarmTransition.count({ where: { alarmId: alarma.id, action: 'ASSIGN' } })).toBe(2);
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

    /** MP07A / A03: toda validación nueva nombra la definición EXACTA que vio el visitador. */
    function criterio(dato: { readonly id: string; readonly code: string }, extra: object = {}) {
      return post(`${BASE}/${ctx}/criteria`, profesional, {
        idempotencyKey: randomUUID(),
        observableDefinitionId: dato.id,
        observableCode: dato.code,
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

    function registrar(definitionId: string, value: unknown, occurredAt: string) {
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

      await criterio(dato, { value: undefined }).expect(400);
      await criterio(dato, { comparator: 'IN', value: ['a'] }).expect(400);
      await criterio(dato, { requiredCount: 0 }).expect(400);
      await criterio(dato, { windowMinutes: 0 }).expect(400);
      await criterio({ id: randomUUID(), code: 'dato-inexistente' }).expect(400);
      await criterio(dato, { umbralSugerido: '37.5' }).expect(400);
      // Sin la definición exacta no se valida: nunca se resuelve en silencio por código.
      await criterio(dato, { observableDefinitionId: undefined }).expect(400);
    });

    it('sin criterio, ningún registro abre una alarma automática', async () => {
      const dato = await datoNumerico();
      const respuesta = await registrar(dato.id, '99', new Date(Date.now() - 60_000).toISOString()).expect(201);
      expect(respuesta.body.evaluation).toEqual({ alarmsOpened: 0, evidenceAdded: 0 });
    });

    it('N coincidencias en la ventana abren UN episodio; las siguientes son evidencia', async () => {
      const dato = await datoNumerico();
      const creado = (await criterio(dato).expect(201)).body;
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

    /** Cierra una alarma (resolver + cerrar) y devuelve el `closedAt` de la base. */
    async function cerrar(alarmId: string, version: number): Promise<string> {
      const ruta = `${BASE}/${ctx}/alarms/${alarmId}/transitions`;
      await post(ruta, revisor, { action: 'RESOLVE', expectedVersion: version, reason: 'Resuelta (ficticio)' }).expect(200);
      await post(ruta, revisor, { action: 'CLOSE', expectedVersion: version + 1, reason: 'Cerrada (ficticio)' }).expect(200);
      const cerrada = await owner.careAlarm.findUniqueOrThrow({ where: { id: alarmId }, select: { closedAt: true } });
      return (cerrada.closedAt ?? new Date(0)).toISOString();
    }

    it('tras cerrar, la evidencia consumida no reabre; un conteo nuevo POSTERIOR al cierre abre un episodio enlazado', async () => {
      const dato = await datoNumerico();
      const creado = (await criterio(dato, { requiredCount: 2, severity: 'ROJA' }).expect(201)).body;
      const activado = creado.current.activatedAt;

      await registrar(dato.id, '50', await despuesDe(activado, 100)).expect(201);
      await registrar(dato.id, '51', await despuesDe(activado, 200)).expect(201);
      const primera = await owner.careAlarm.findFirstOrThrow({ where: { contextId: ctx, criterionId: creado.id } });
      const cierre = await cerrar(primera.id, 1);

      const una = await registrar(dato.id, '52', await despuesDe(cierre, 100)).expect(201);
      expect(una.body.evaluation).toEqual({ alarmsOpened: 0, evidenceAdded: 0 });

      const dos = await registrar(dato.id, '53', await despuesDe(cierre, 200)).expect(201);
      expect(dos.body.evaluation).toEqual({ alarmsOpened: 1, evidenceAdded: 0 });

      const segunda = await owner.careAlarm.findFirstOrThrow({ where: { contextId: ctx, criterionId: creado.id, state: { not: 'CERRADA' } } });
      expect(segunda.previousAlarmId).toBe(primera.id);
      expect(segunda.severity).toBe('ROJA');
    });

    it('A04: eventos tardíos anteriores al cierre se guardan pero no disparan ni alimentan el episodio siguiente', async () => {
      const dato = await datoNumerico();
      const creado = (await criterio(dato, { requiredCount: 2, windowMinutes: 600 }).expect(201)).body;
      const activado = creado.current.activatedAt;

      await registrar(dato.id, '60', await despuesDe(activado, 100)).expect(201);
      await registrar(dato.id, '61', await despuesDe(activado, 200)).expect(201);
      const primera = await owner.careAlarm.findFirstOrThrow({ where: { contextId: ctx, criterionId: creado.id } });
      const cierre = await cerrar(primera.id, 1);
      await despuesDe(cierre, 100);

      // Dos eventos que OCURRIERON antes del cierre (dentro de ventana y tras la
      // activación), recibidos ahora: quedan registrados, sin alarma nueva.
      const antes = new Date(new Date(cierre).getTime() - 1).toISOString();
      const tardioUno = await registrar(dato.id, '62', await despuesDe(activado, 300)).expect(201);
      const tardioDos = await registrar(dato.id, '63', antes).expect(201);
      expect(tardioUno.body.evaluation).toEqual({ alarmsOpened: 0, evidenceAdded: 0 });
      expect(tardioDos.body.evaluation).toEqual({ alarmsOpened: 0, evidenceAdded: 0 });
      expect(await owner.careRecord.count({ where: { id: { in: [tardioUno.body.id, tardioDos.body.id] } } })).toBe(2);

      // Uno estrictamente posterior no completa N con los tardíos.
      const nuevo = await registrar(dato.id, '64', await despuesDe(cierre, 200)).expect(201);
      expect(nuevo.body.evaluation).toEqual({ alarmsOpened: 0, evidenceAdded: 0 });

      // El segundo posterior abre el episodio; un tardío más NO se agrega como evidencia.
      const otro = await registrar(dato.id, '65', await despuesDe(cierre, 300)).expect(201);
      expect(otro.body.evaluation).toEqual({ alarmsOpened: 1, evidenceAdded: 0 });
      const tardioTres = await registrar(dato.id, '66', antes).expect(201);
      expect(tardioTres.body.evaluation).toEqual({ alarmsOpened: 0, evidenceAdded: 0 });

      const segunda = await owner.careAlarm.findFirstOrThrow({
        where: { contextId: ctx, criterionId: creado.id, state: { not: 'CERRADA' } },
        include: { evidence: { include: { observation: { include: { record: true } } } } },
      });
      expect(segunda.previousAlarmId).toBe(primera.id);
      expect(segunda.evidence).toHaveLength(2);
      for (const evidencia of segunda.evidence) {
        expect(evidencia.observation.record.occurredAt.getTime()).toBeGreaterThan(new Date(cierre).getTime());
      }
    });

    it('A04: el mismo occurrenceKey entre versiones de la definición se vincula a la canónica y no vuelve a contar', async () => {
      const code = `evento-${randomUUID().slice(0, 8)}`;
      const v1 = (await definirDato({ code, valueType: 'NUMBER', unit: 'unidad ficticia' }).expect(201)).body;
      const creado = (await criterio(v1, { requiredCount: 1 }).expect(201)).body;
      const clave = randomUUID();

      const original = await post(`${BASE}/${ctx}/records`, cuidadora, {
        idempotencyKey: randomUUID(),
        occurredAt: await despuesDe(creado.current.activatedAt, 100),
        observations: [{ definitionId: v1.id, value: '70', occurrenceKey: clave }],
      }).expect(201);
      expect(original.body.evaluation).toEqual({ alarmsOpened: 1, evidenceAdded: 0 });
      const primera = await owner.careAlarm.findFirstOrThrow({ where: { contextId: ctx, criterionId: creado.id } });
      const cierre = await cerrar(primera.id, 1);

      // Nueva definición del mismo código y revalidación del criterio.
      const v2 = (await definirDato({ code, valueType: 'NUMBER', unit: 'unidad ficticia' }).expect(201)).body;
      const revalidado = (await criterio(v2, { criterionId: creado.id, requiredCount: 1 }).expect(201)).body;
      expect(revalidado.current.observableDefinition).toMatchObject({ id: v2.id, version: 2 });

      // La versión revalidada se activa DESPUÉS del cierre: cada ocurrencia se fecha
      // tras la mayor de ambas fronteras, para que solo la identidad decida.
      const frontera = new Date(Math.max(new Date(cierre).getTime(), new Date(revalidado.current.activatedAt).getTime())).toISOString();

      // El MISMO evento reportado otra vez (clave explícita), admisible por fecha.
      const repetido = await post(`${BASE}/${ctx}/records`, cuidadora, {
        idempotencyKey: randomUUID(),
        occurredAt: await despuesDe(frontera, 100),
        observations: [{ definitionId: v2.id, value: '71', occurrenceKey: clave }],
      }).expect(201);
      expect(repetido.body.observations[0]).toMatchObject({ occurrenceKey: clave, canonicalObservationId: original.body.observations[0].id });
      expect(repetido.body.evaluation).toEqual({ alarmsOpened: 0, evidenceAdded: 0 });
      expect(await owner.careAlarm.count({ where: { criterionId: creado.id, state: { not: 'CERRADA' } } })).toBe(0);

      // Un evento DISTINTO posterior sí abre el episodio siguiente.
      const distinto = await registrar(v2.id, '72', await despuesDe(frontera, 200)).expect(201);
      expect(distinto.body.evaluation).toEqual({ alarmsOpened: 1, evidenceAdded: 0 });
      const siguiente = await owner.careAlarm.findFirstOrThrow({
        where: { criterionId: creado.id, state: { not: 'CERRADA' } },
        include: { evidence: true },
      });
      expect(siguiente.previousAlarmId).toBe(primera.id);
      expect(siguiente.evidence.map((item) => item.observationId)).toEqual([distinto.body.observations[0].id]);
    });

    it('A04: dos registros SIMULTÁNEOS que completan N abren UNA alarma con ambas evidencias', async () => {
      const dato = await datoNumerico();
      const creado = (await criterio(dato, { requiredCount: 2 }).expect(201)).body;
      const uno = await despuesDe(creado.current.activatedAt, 100);
      const dos = await despuesDe(creado.current.activatedAt, 200);

      const [a, b] = await Promise.all([registrar(dato.id, '80', uno), registrar(dato.id, '81', dos)]);
      expect([a.status, b.status]).toEqual([201, 201]);

      const alarmas = await owner.careAlarm.findMany({ where: { criterionId: creado.id }, include: { evidence: true } });
      expect(alarmas).toHaveLength(1);
      expect(alarmas[0]?.evidence).toHaveLength(2);
    });

    it('una corrección no crea, cierra ni rebaja la alarma; la evidencia fija lo evaluado y marca lo posterior', async () => {
      const dato = await datoNumerico();
      const creado = (await criterio(dato, { requiredCount: 1 }).expect(201)).body;
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
      expect(detalle.body.evidence).toEqual([
        expect.objectContaining({
          value: '45',
          snapshot: 'CAPTURED',
          evaluatedValue: '45',
          evaluatedAmendmentSequence: null,
          correctedAfterwards: true,
        }),
      ]);
    });

    it('A07: una enmienda ANTERIOR a la evaluación fija su valor y no se rotula como posterior; las siguientes no cambian el snapshot', async () => {
      const dato = await datoNumerico();
      const creado = (await criterio(dato, { comparator: 'GTE', value: '10', requiredCount: 1 }).expect(201)).body;

      const bajo = await registrar(dato.id, '1', await despuesDe(creado.current.activatedAt, 100)).expect(201);
      expect(bajo.body.evaluation).toEqual({ alarmsOpened: 0, evidenceAdded: 0 });
      const observacion = bajo.body.observations[0].id;
      const enmiendas = `${BASE}/${ctx}/records/${bajo.body.id}/amendments`;

      // D04.5: corregir a 11 NO evalúa por sí solo.
      await post(enmiendas, cuidadora, { idempotencyKey: randomUUID(), expectedSequence: 0, observationId: observacion, replacement: '5', reason: 'Primera corrección (ficticio)' }).expect(201);
      await post(enmiendas, cuidadora, { idempotencyKey: randomUUID(), expectedSequence: 1, observationId: observacion, replacement: '11', reason: 'Segunda corrección (ficticio)' }).expect(201);
      expect(await owner.careAlarm.count({ where: { criterionId: creado.id } })).toBe(0);

      // Un registro posterior evalúa y usa el valor EFECTIVO corregido de la primera observación.
      const otro = await registrar(dato.id, '1', await despuesDe(creado.current.activatedAt, 200)).expect(201);
      expect(otro.body.evaluation).toEqual({ alarmsOpened: 1, evidenceAdded: 0 });
      const alarma = await owner.careAlarm.findFirstOrThrow({ where: { criterionId: creado.id } });

      const antes = (await get(`${BASE}/${ctx}/alarms/${alarma.id}`, revisor).expect(200)).body.evidence;
      expect(antes).toEqual([
        expect.objectContaining({ value: '1', snapshot: 'CAPTURED', evaluatedValue: '11', evaluatedAmendmentSequence: 2, correctedAfterwards: false }),
      ]);

      // Corrección futura: no reevalúa, no cambia el snapshot y se señala como posterior.
      await post(enmiendas, cuidadora, { idempotencyKey: randomUUID(), expectedSequence: 2, observationId: observacion, replacement: '2', reason: 'Tercera corrección (ficticio)' }).expect(201);
      const despues = (await get(`${BASE}/${ctx}/alarms/${alarma.id}`, revisor).expect(200)).body;
      expect(despues).toMatchObject({ state: 'NUEVA', version: 1 });
      expect(despues.evidence).toEqual([
        expect.objectContaining({ value: '1', evaluatedValue: '11', evaluatedAmendmentSequence: 2, correctedAfterwards: true }),
      ]);

      const fila = await owner.careAlarmEvidence.findFirstOrThrow({ where: { alarmId: alarma.id } });
      expect(fila.amendmentSequenceAtEvaluation).toBe(2);
      expect(fila.evaluatedValueNumber?.toString()).toBe('11');
      await expect(
        owner.$executeRaw`UPDATE "care_alarm_evidence" SET "evaluatedValueNumber" = 1 WHERE "id" = ${fila.id}::uuid`,
      ).rejects.toThrow();

      // La auditoría de la alarma no copia valores.
      const eventos = await owner.auditEvent.findMany({ where: { resourceId: alarma.id } });
      expect(JSON.stringify(eventos)).not.toMatch(/"(11|5|2)"/u);
    });

    it('A03: reemplazar la definición deja la regla sin evaluar hasta revalidar; id desactualizado 409, sin id 400; la versión anterior se conserva', async () => {
      const code = `dosis-${randomUUID().slice(0, 8)}`;
      const anterior = (await definirDato({ code, valueType: 'NUMBER', unit: 'unidad ficticia A' }).expect(201)).body;
      const creado = (await criterio(anterior, { comparator: 'GTE', value: '10', requiredCount: 1 }).expect(201)).body;
      expect(creado.current).toMatchObject({
        requiresRevalidation: false,
        observableDefinition: { id: anterior.id, valueType: 'NUMBER', unit: 'unidad ficticia A' },
      });

      // Otra versión del MISMO código con otra unidad: la regla no se traslada.
      const vigente = (await definirDato({ code, valueType: 'NUMBER', unit: 'unidad ficticia B' }).expect(201)).body;
      const lista = (await get(`${BASE}/${ctx}/criteria`, profesional).expect(200)).body as {
        readonly id: string;
        readonly current: { readonly requiresRevalidation: boolean; readonly observableDefinition: { readonly id: string } | null };
      }[];
      expect(lista.find((item) => item.id === creado.id)?.current).toMatchObject({
        requiresRevalidation: true,
        observableDefinition: { id: anterior.id },
      });
      expect((await get(`${BASE}/${ctx}/semaphore`, revisor).expect(200)).body.criteriaRequiringRevalidation).toBeGreaterThanOrEqual(1);

      // 11 en la unidad nueva no se compara con el umbral validado en la anterior.
      const registro = await registrar(vigente.id, '11', await despuesDe(creado.current.activatedAt, 100)).expect(201);
      expect(registro.body.evaluation).toEqual({ alarmsOpened: 0, evidenceAdded: 0 });

      const ajuste = { criterionId: creado.id, comparator: 'GTE', value: '10', requiredCount: 1 };
      const conflicto = await criterio(anterior, ajuste).expect(409);
      expect(JSON.stringify(conflicto.body)).not.toContain(vigente.id);
      await criterio(vigente, { ...ajuste, observableDefinitionId: undefined }).expect(400);
      await criterio(vigente, { ...ajuste, observableDefinitionId: randomUUID() }).expect(409);

      const revalidado = (await criterio(vigente, { ...ajuste, value: '0.01' }).expect(201)).body;
      expect(revalidado.id).toBe(creado.id);
      expect(revalidado.current).toMatchObject({
        version: 2,
        requiresRevalidation: false,
        observableDefinition: { id: vigente.id, unit: 'unidad ficticia B' },
      });

      // Prospectivo: un evento POSTERIOR a la revalidación abre el episodio con la
      // misma identidad; el registro anterior a ella no se cuenta retroactivamente.
      const posterior = await registrar(vigente.id, '11', await despuesDe(revalidado.current.activatedAt, 100)).expect(201);
      expect(posterior.body.evaluation).toEqual({ alarmsOpened: 1, evidenceAdded: 0 });
      const abierta = await owner.careAlarm.findFirstOrThrow({
        where: { criterionId: creado.id, state: { not: 'CERRADA' } },
        include: { evidence: true },
      });
      expect(abierta).toMatchObject({ criterionId: creado.id, criterionVersionId: revalidado.current.id });
      expect(abierta.evidence.map((item) => item.observationId)).toEqual([posterior.body.observations[0].id]);

      expect(
        await owner.careAlarmCriterionVersion.findMany({
          where: { criterionId: creado.id },
          orderBy: { version: 'asc' },
          select: { version: true, observableDefinitionId: true, status: true },
        }),
      ).toEqual([
        { version: 1, observableDefinitionId: anterior.id, status: 'SUPERSEDED' },
        { version: 2, observableDefinitionId: vigente.id, status: 'ACTIVE' },
      ]);
    });

    it('A03: un recibo confirmado ANTES de MP07A se reproduce sin definición y sin crear otra validación; uno nuevo sin id es 400', async () => {
      const dato = await datoNumerico();
      const creado = (await criterio(dato).expect(201)).body;
      const clave = randomUUID();
      const legado = {
        idempotencyKey: clave,
        observableCode: dato.code,
        comparator: 'GTE',
        value: '38.0',
        requiredCount: 2,
        windowMinutes: 60,
        severity: 'AMARILLA',
      };

      // Recibo con la huella previa a MP07A (sin `observableDefinitionId`), calculada con
      // el mismo parser del servidor. Solo se siembra la fila; ningún control se relaja.
      const parseado = parseCriterionInput(legado, new Date());
      const contenido = {
        criterionId: parseado.criterionId,
        observableCode: parseado.observableCode,
        comparator: parseado.comparator,
        value: parseado.value,
        requiredCount: parseado.requiredCount,
        windowMinutes: parseado.windowMinutes,
        severity: parseado.severity,
      };
      await owner.careRequestReceipt.create({
        data: {
          tenantId: tenantA,
          organizationId: org,
          contextId: ctx,
          patientId: patientIdCtx,
          actorHumanAccountId: profesional.humanAccountId,
          action: 'criterion.create',
          idempotencyKey: clave,
          payloadHash: payloadHash({ ...contenido, validUntil: null }),
          responseResourceId: creado.id,
        },
        select: { id: true },
      });

      const validacionesAntes = await owner.auditEvent.count({ where: { eventType: 'CARE_CRITERION_VALIDATED', resourceId: creado.id } });
      const reproducido = await post(`${BASE}/${ctx}/criteria`, profesional, legado).expect(201);
      expect(reproducido.body).toMatchObject({ id: creado.id, current: { id: creado.current.id, version: 1 } });
      expect(await owner.careAlarmCriterionVersion.count({ where: { criterionId: creado.id } })).toBe(1);
      expect(await owner.auditEvent.count({ where: { eventType: 'CARE_CRITERION_VALIDATED', resourceId: creado.id } })).toBe(validacionesAntes);

      // La misma clave con otro contenido es reutilización; sin recibo, falta la definición.
      await post(`${BASE}/${ctx}/criteria`, profesional, { ...legado, requiredCount: 3 }).expect(409);
      await post(`${BASE}/${ctx}/criteria`, profesional, { ...legado, idempotencyKey: randomUUID() }).expect(400);
    });

    /** Fila serializada para comparar antes/después sin depender de instancias Decimal/Date. */
    const congelar = (valor: unknown): unknown => JSON.parse(JSON.stringify(valor));

    /**
     * MP07A / A03: recorrido HTTP completo de un reemplazo de definición. La regla
     * validada sobre la definición anterior conserva EXACTAMENTE su definición y
     * origen, queda pendiente de revalidar, no evalúa la definición nueva, el id
     * desactualizado es 409 y solo una revalidación con el id exacto vuelve a
     * evaluar, de forma prospectiva y sin reescribir evidencia ni historia.
     */
    async function reemplazoPendienteDeRevalidar(caso: {
      readonly anterior: object;
      readonly reglaAnterior: object;
      readonly valorAnterior: unknown;
      readonly vigente: object;
      /** Valor que la regla anterior aceptaría si se trasladara a la definición nueva. */
      readonly valorTrasladado: unknown;
      readonly revalidacion: object;
      /** Contenido incompatible con la definición nueva: no se valida en silencio. */
      readonly revalidacionIncompatible: object | null;
      readonly valorRevalidado: unknown;
    }): Promise<void> {
      const code = `reemplazo-${randomUUID().slice(0, 8)}`;
      const anterior = (await definirDato({ code, ...caso.anterior }).expect(201)).body;
      const creado = (await criterio(anterior, { ...caso.reglaAnterior, requiredCount: 1 }).expect(201)).body;

      const previo = await post(`${BASE}/${ctx}/records`, cuidadora, {
        idempotencyKey: randomUUID(),
        occurredAt: await despuesDe(creado.current.activatedAt, 100),
        observations: [{ definitionId: anterior.id, value: caso.valorAnterior }],
      }).expect(201);
      expect(previo.body.evaluation).toEqual({ alarmsOpened: 1, evidenceAdded: 0 });
      const primera = await owner.careAlarm.findFirstOrThrow({ where: { criterionId: creado.id } });
      const cierre = await cerrar(primera.id, 1);

      const versionInmutable = {
        version: true, observableDefinitionId: true, observableCode: true, valueType: true, comparator: true,
        numberValue: true, booleanValue: true, choiceValues: true, requiredCount: true, windowMinutes: true,
        severity: true, activatedAt: true, validUntil: true, validatedByHumanAccountId: true,
      } as const;
      const definicionInmutable = {
        id: true, code: true, version: true, label: true, valueType: true, unit: true, options: true,
        validatedAt: true, validatedByHumanAccountId: true,
      } as const;
      const leerVersion = async () =>
        congelar(await owner.careAlarmCriterionVersion.findUniqueOrThrow({ where: { id: creado.current.id }, select: versionInmutable }));
      const leerDefinicion = async () =>
        congelar(await owner.careObservableDefinition.findUniqueOrThrow({ where: { id: anterior.id }, select: definicionInmutable }));
      const leerEvidencia = async () =>
        congelar(await owner.careAlarmEvidence.findMany({ where: { alarmId: primera.id }, orderBy: { id: 'asc' } }));
      const versionAntes = await leerVersion();
      const definicionAntes = await leerDefinicion();
      const evidenciaAntes = await leerEvidencia();
      expect(evidenciaAntes).toEqual([expect.objectContaining({ observableDefinitionId: anterior.id })]);

      // Reemplazo de la definición del MISMO código.
      const vigente = (await definirDato({ code, ...caso.vigente }).expect(201)).body;
      expect(vigente).toMatchObject({ code, version: anterior.version + 1 });

      // La regla antigua conserva su definición exacta y queda pendiente de revalidar.
      const pendiente = (await get(`${BASE}/${ctx}/criteria`, profesional).expect(200)).body.find(
        (item: { readonly id: string }) => item.id === creado.id,
      );
      expect(pendiente.current).toMatchObject({
        id: creado.current.id,
        version: 1,
        requiresRevalidation: true,
        valueType: anterior.valueType,
        observableDefinition: {
          id: anterior.id,
          version: anterior.version,
          valueType: anterior.valueType,
          unit: anterior.unit,
          options: anterior.options,
          status: 'RETIRED',
        },
      });

      // No evalúa otra definición: ni la retirada admite datos ni la nueva hereda la regla.
      await registrar(anterior.id, caso.valorAnterior, await despuesDe(cierre, 100)).expect(400);
      const trasladado = await registrar(vigente.id, caso.valorTrasladado, await despuesDe(cierre, 100)).expect(201);
      expect(trasladado.body.evaluation).toEqual({ alarmsOpened: 0, evidenceAdded: 0 });

      // Una validación NUEVA con el id desactualizado es 409 y no crea versión.
      const ajuste = { ...caso.revalidacion, criterionId: creado.id, requiredCount: 1 };
      const conflicto = await criterio(anterior, ajuste).expect(409);
      expect(JSON.stringify(conflicto.body)).not.toContain(vigente.id);
      if (caso.revalidacionIncompatible !== null) {
        await criterio(vigente, { ...caso.revalidacionIncompatible, criterionId: creado.id, requiredCount: 1 }).expect(400);
      }
      expect(await owner.careAlarmCriterionVersion.count({ where: { criterionId: creado.id } })).toBe(1);

      // Revalidación explícita con el id exacto: misma identidad, versión nueva.
      const revalidado = (await criterio(vigente, ajuste).expect(201)).body;
      expect(revalidado.id).toBe(creado.id);
      expect(revalidado.current).toMatchObject({
        version: 2,
        requiresRevalidation: false,
        valueType: vigente.valueType,
        observableDefinition: { id: vigente.id, version: vigente.version, valueType: vigente.valueType, status: 'ACTIVE' },
      });

      // Prospectiva: lo registrado antes de la revalidación no cuenta; lo posterior sí.
      const frontera = new Date(Math.max(new Date(cierre).getTime(), new Date(revalidado.current.activatedAt).getTime())).toISOString();
      const nuevo = await registrar(vigente.id, caso.valorRevalidado, await despuesDe(frontera, 100)).expect(201);
      expect(nuevo.body.evaluation).toEqual({ alarmsOpened: 1, evidenceAdded: 0 });
      const segunda = await owner.careAlarm.findFirstOrThrow({
        where: { criterionId: creado.id, state: { not: 'CERRADA' } },
        include: { evidence: true },
      });
      expect(segunda).toMatchObject({ previousAlarmId: primera.id, criterionVersionId: revalidado.current.id });
      expect(segunda.evidence.map((item) => ({ observationId: item.observationId, observableDefinitionId: item.observableDefinitionId }))).toEqual([
        { observationId: nuevo.body.observations[0].id, observableDefinitionId: vigente.id },
      ]);

      // Ni la versión anterior, ni su definición, ni la evidencia del episodio cerrado se reescriben.
      expect(await leerVersion()).toEqual(versionAntes);
      expect(await leerDefinicion()).toEqual(definicionAntes);
      expect(await leerEvidencia()).toEqual(evidenciaAntes);
      expect(await owner.careAlarm.findUniqueOrThrow({ where: { id: primera.id }, select: { state: true } })).toEqual({ state: 'CERRADA' });
      expect(
        await owner.careAlarmCriterionVersion.findMany({ where: { criterionId: creado.id }, orderBy: { version: 'asc' }, select: { version: true, status: true } }),
      ).toEqual([
        { version: 1, status: 'SUPERSEDED' },
        { version: 2, status: 'ACTIVE' },
      ]);
    }

    it('A03: un reemplazo COMPATIBLE (misma unidad) también exige revalidar con el id exacto', async () => {
      await reemplazoPendienteDeRevalidar({
        anterior: { valueType: 'NUMBER', unit: 'unidad ficticia' },
        reglaAnterior: { comparator: 'GTE', value: '10' },
        valorAnterior: '11',
        vigente: { valueType: 'NUMBER', unit: 'unidad ficticia' },
        valorTrasladado: '11',
        // El MISMO contenido: lo que decide es la definición citada.
        revalidacion: { comparator: 'GTE', value: '10' },
        revalidacionIncompatible: null,
        valorRevalidado: '11',
      });
    });

    it('A03: un cambio de tipo NUMBER→BOOLEAN no traslada la regla numérica', async () => {
      await reemplazoPendienteDeRevalidar({
        anterior: { valueType: 'NUMBER', unit: 'unidad ficticia' },
        reglaAnterior: { comparator: 'GTE', value: '10' },
        valorAnterior: '11',
        vigente: { valueType: 'BOOLEAN' },
        valorTrasladado: true,
        revalidacion: { comparator: 'EQ', value: true },
        revalidacionIncompatible: { comparator: 'GTE', value: '10' },
        valorRevalidado: true,
      });
    });

    it('A03: un catálogo CHOICE con opciones distintas no reinterpreta códigos coincidentes', async () => {
      await reemplazoPendienteDeRevalidar({
        anterior: { valueType: 'CHOICE', options: [{ code: 'opcion-a', label: 'Opción A ficticia' }, { code: 'opcion-b', label: 'Opción B ficticia' }] },
        reglaAnterior: { comparator: 'IN', value: ['opcion-a'] },
        valorAnterior: 'opcion-a',
        // Conserva el código `opcion-a` con otro significado: no hereda la regla.
        vigente: { valueType: 'CHOICE', options: [{ code: 'opcion-a', label: 'Otra opción A ficticia' }, { code: 'opcion-c', label: 'Opción C ficticia' }] },
        valorTrasladado: 'opcion-a',
        revalidacion: { comparator: 'IN', value: ['opcion-c'] },
        revalidacionIncompatible: { comparator: 'IN', value: ['opcion-b'] },
        valorRevalidado: 'opcion-c',
      });
    });

    /** Contextos de prueba en los que este bloque concede REVIEW_ALARMS al revisor (además de `ctx`). */
    const contextosConRevisionDelRevisor: string[] = [];

    /** Contexto nuevo sin historia, con profesional (aporta y define) y revisora. */
    async function contextoAislado(nombre: string): Promise<string> {
      const titular = await seed.cuenta(tenantA, nombre);
      await seed.aprobar(titular, 'PATIENT');
      const patientId = await seed.paciente(titular);
      const contexto = await seed.contexto(tenantA, org, patientId, gestor.humanAccountId);
      const base = { tenantId: tenantA, organizationId: org, contextId: contexto, patientId, grantedByHumanAccountId: gestor.humanAccountId };
      const asignacion = await seed.asignacion(tenantA, patientId, profesionalId);
      await seed.concesion({ ...base, humanAccountId: profesional.humanAccountId, actorKind: 'PROFESSIONAL', permission: 'CONTRIBUTE_RECORDS', careAssignmentId: asignacion });
      await seed.concesion({
        ...base, humanAccountId: profesional.humanAccountId, actorKind: 'PROFESSIONAL', permission: 'MANAGE_RULES', careAssignmentId: asignacion, competenceAttestationId: competenciaProfesional,
      });
      await seed.concesion({
        ...base, humanAccountId: revisor.humanAccountId, actorKind: 'HOSPITAL_REVIEWER', permission: 'REVIEW_ALARMS',
        competenceAttestationId: await seed.competencia(tenantA, org, revisor.humanAccountId, gestor.humanAccountId),
      });
      contextosConRevisionDelRevisor.push(contexto);
      return contexto;
    }

    it('A01: un criterio ESTABLE VENCIDO sin clasificación no otorga ESTABLE ni se reescribe por reloj', async () => {
      const contexto = await contextoAislado('Paciente vigencia');
      const semaforo = async () => (await get(`${BASE}/${contexto}/semaphore`, revisor).expect(200)).body;
      const dato = (
        await post(`${BASE}/${contexto}/observables`, profesional, {
          idempotencyKey: randomUUID(), code: `dato-${randomUUID().slice(0, 8)}`, label: 'Dato ficticio de prueba', valueType: 'NUMBER', unit: 'unidad ficticia',
        }).expect(201)
      ).body;

      // Vigencia corta y acotada: el reloj de la prueba solo espera a que pase.
      const vence = new Date(Date.now() + 3_000).toISOString();
      const creado = (
        await post(`${BASE}/${contexto}/criteria`, profesional, {
          idempotencyKey: randomUUID(), observableDefinitionId: dato.id, observableCode: dato.code, comparator: 'GTE', value: '1', requiredCount: 1, windowMinutes: 600, severity: 'ESTABLE', validUntil: vence,
        }).expect(201)
      ).body;
      expect(creado.current.validUntil).toBe(vence);
      expect(await semaforo()).toMatchObject({ level: 'SIN_EVALUACION', activeCriteria: 1 });

      // Tras vencer, un dato que la regla aceptaría no abre nada y el semáforo no es estable.
      const ocurrido = await despuesDe(vence, 100);
      const registro = await post(`${BASE}/${contexto}/records`, profesional, {
        idempotencyKey: randomUUID(), occurredAt: ocurrido, observations: [{ definitionId: dato.id, value: '2' }],
      }).expect(201);
      expect(registro.body.evaluation).toEqual({ alarmsOpened: 0, evidenceAdded: 0 });
      const vencido = await semaforo();
      expect(vencido.level).not.toBe('ESTABLE');
      expect(vencido).toMatchObject({ level: 'SIN_CRITERIOS', activeCriteria: 0, criteriaRequiringRevalidation: 0, openAlarms: { ROJA: 0, AMARILLA: 0, ESTABLE: 0, SIN: 0 } });

      // El vencimiento es una lectura del reloj: no reescribe la versión ni el criterio.
      expect(
        await owner.careAlarmCriterionVersion.findUniqueOrThrow({ where: { id: creado.current.id }, select: { status: true, validUntil: true, supersededAt: true } }),
      ).toEqual({ status: 'ACTIVE', validUntil: new Date(vence), supersededAt: null });
      expect(await owner.careAlarmCriterion.findUniqueOrThrow({ where: { id: creado.id }, select: { status: true } })).toEqual({ status: 'ACTIVE' });
      expect(await owner.careAlarm.count({ where: { criterionId: creado.id } })).toBe(0);
    });

    it('A01: sin clasificación autorizada nunca es ESTABLE; solo una alarma abierta clasificada ESTABLE lo es', async () => {
      const contexto = await contextoAislado('Paciente semáforo');
      const semaforo = async () => (await get(`${BASE}/${contexto}/semaphore`, revisor).expect(200)).body;
      expect((await semaforo()).level).toBe('SIN_CRITERIOS');

      const dato = (
        await post(`${BASE}/${contexto}/observables`, profesional, {
          idempotencyKey: randomUUID(), code: `dato-${randomUUID().slice(0, 8)}`, label: 'Dato ficticio de prueba', valueType: 'NUMBER', unit: 'unidad ficticia',
        }).expect(201)
      ).body;
      const nuevoCriterio = (severity: string, requiredCount: number) =>
        post(`${BASE}/${contexto}/criteria`, profesional, {
          idempotencyKey: randomUUID(), observableDefinitionId: dato.id, observableCode: dato.code, comparator: 'GTE', value: '1', requiredCount, windowMinutes: 600, severity,
        }).expect(201);

      // Criterio ROJO vigente sin datos: no es estabilidad.
      await nuevoCriterio('ROJA', 5);
      expect(await semaforo()).toMatchObject({ level: 'SIN_EVALUACION', activeCriteria: 1, openAlarms: { ROJA: 0, AMARILLA: 0, ESTABLE: 0, SIN: 0 } });
      expect((await semaforo()).label).toMatch(/no indica estabilidad/u);

      // Datos insuficientes para N: sigue sin evaluación.
      const estable = (await nuevoCriterio('ESTABLE', 2)).body;
      const anotar = async (offsetMs: number) =>
        post(`${BASE}/${contexto}/records`, profesional, {
          idempotencyKey: randomUUID(),
          occurredAt: await despuesDe(estable.current.activatedAt, offsetMs),
          observations: [{ definitionId: dato.id, value: '2' }],
        }).expect(201);
      await anotar(100);
      expect((await semaforo()).level).toBe('SIN_EVALUACION');

      // La regla validada ESTABLE se cumple: hay una clasificación autorizada abierta.
      expect((await anotar(200)).body.evaluation).toEqual({ alarmsOpened: 1, evidenceAdded: 0 });
      expect(await semaforo()).toMatchObject({ level: 'ESTABLE', openAlarms: { ESTABLE: 1 } });
    });

    it('una versión nueva conserva la identidad; retirar no cierra lo abierto ni sigue evaluando', async () => {
      const dato = await datoNumerico();
      const creado = (await criterio(dato, { requiredCount: 1 }).expect(201)).body;
      await registrar(dato.id, '41', await despuesDe(creado.current.activatedAt, 100)).expect(201);

      const v2 = (await criterio(dato, { criterionId: creado.id, requiredCount: 3, severity: 'ROJA' }).expect(201)).body;
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

    it('A08: ajustar crea una versión del MISMO criterio con vigencia, sin tocar el episodio abierto ni la versión anterior', async () => {
      const dato = await datoNumerico();
      const creado = (await criterio(dato, { requiredCount: 1, severity: 'AMARILLA' }).expect(201)).body;
      expect((await registrar(dato.id, '40', await despuesDe(creado.current.activatedAt, 100)).expect(201)).body.evaluation).toEqual({
        alarmsOpened: 1,
        evidenceAdded: 0,
      });
      const abierta = await owner.careAlarm.findFirstOrThrow({ where: { criterionId: creado.id, state: { not: 'CERRADA' } } });
      const v1Antes = await owner.careAlarmCriterionVersion.findUniqueOrThrow({ where: { id: creado.current.id } });

      // Vigencia en el pasado o sin la definición exacta: no se crea nada.
      await criterio(dato, { criterionId: creado.id, validUntil: new Date(Date.now() - 60_000).toISOString() }).expect(400);
      await criterio(dato, { criterionId: creado.id, observableDefinitionId: undefined }).expect(400);
      await criterio(dato, { criterionId: creado.id, observableDefinitionId: randomUUID() }).expect(409);

      const fin = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const v2 = (
        await criterio(dato, { criterionId: creado.id, requiredCount: 3, windowMinutes: 120, severity: 'ROJA', validUntil: fin }).expect(201)
      ).body;
      expect(v2.id).toBe(creado.id);
      expect(v2.current).toMatchObject({
        version: 2,
        requiredCount: 3,
        windowMinutes: 120,
        severity: 'ROJA',
        validUntil: fin,
        status: 'ACTIVE',
        requiresRevalidation: false,
        observableDefinition: expect.objectContaining({ id: dato.id, unit: 'unidad ficticia' }),
      });
      expect(await owner.careAlarmCriterion.count({ where: { id: creado.id } })).toBe(1);
      expect(await owner.careAlarmCriterionVersion.count({ where: { criterionId: creado.id } })).toBe(2);

      // La versión anterior se conserva: solo cambió a SUPERSEDED; su contenido validado es el mismo.
      const v1Despues = await owner.careAlarmCriterionVersion.findUniqueOrThrow({ where: { id: creado.current.id } });
      expect(v1Despues.status).toBe('SUPERSEDED');
      expect({ ...v1Despues, status: v1Antes.status, supersededAt: v1Antes.supersededAt }).toEqual(v1Antes);

      // El episodio abierto sigue siendo el mismo y acumula la coincidencia nueva sin exigir otra vez N.
      const otra = await registrar(dato.id, '41', await despuesDe(v2.current.activatedAt, 100)).expect(201);
      expect(otra.body.evaluation).toEqual({ alarmsOpened: 0, evidenceAdded: 1 });
      const despues = await owner.careAlarm.findMany({ where: { criterionId: creado.id, state: { not: 'CERRADA' } } });
      expect(despues.map((alarma) => alarma.id)).toEqual([abierta.id]);
      expect(await owner.careAlarmEvidence.count({ where: { alarmId: abierta.id } })).toBe(2);
    });

    it('semáforo con texto y cola de revisión solo de contextos propios', async () => {
      const semaforo = await get(`${BASE}/${ctx}/semaphore`, revisor).expect(200);
      expect(['ROJO', 'AMARILLO', 'PENDIENTE', 'ESTABLE', 'SIN_EVALUACION']).toContain(semaforo.body.level);
      expect(semaforo.body.label.length).toBeGreaterThan(10);
      await get(`${BASE}/${ctx}/semaphore`, cuidadora).expect(403);

      // MP07B / A06: la cola es una página `{ items, nextCursor }`; con menos candidatos que el límite cabe en una.
      const cola = await get('/api/v1/care/review-queue?limit=50', revisor).expect(200);
      expect(cola.body.nextCursor).toBeNull();
      // Conjunto exacto: `ctx` y los contextos aislados que este bloque concedió al revisor; nada más.
      const esperados = [ctx, ...contextosConRevisionDelRevisor].sort();
      expect(new Set(esperados).size).toBe(esperados.length);
      expect(cola.body.items.map((item: { contextId: string }) => item.contextId).sort()).toEqual(esperados);
      for (const item of cola.body.items as Array<{ alarms: Array<{ state: string }>; actions: string[]; openAlarmCount: number }>) {
        expect(item.alarms.every((alarma) => alarma.state !== 'CERRADA')).toBe(true);
        // Las acciones las confirma el servidor en la misma página; la revisión siempre está.
        expect(item.actions).toContain('REVIEW_ALARMS');
        expect(item.openAlarmCount).toBeGreaterThanOrEqual(item.alarms.length);
      }
      expect(JSON.stringify(cola.body)).not.toContain(ctxOtro);

      expect((await get('/api/v1/care/review-queue', cuidadora).expect(200)).body).toEqual({ items: [], nextCursor: null });
      expect((await get('/api/v1/care/review-queue', gestor).expect(200)).body).toEqual({ items: [], nextCursor: null });
    });
  });

  /* ====================================================================== */
  /* MP07B / A06: paginación completa, sin truncamientos silenciosos         */
  /* ====================================================================== */

  describe('paginación (MP07B / A06)', () => {
    /** UUID con primer octeto fijo: el directorio recorre los candidatos por id. */
    const idConPrefijo = (prefijo: '00' | 'ff'): string => `${prefijo}${randomUUID().slice(2)}`;

    /** Recorre TODAS las páginas siguiendo `nextCursor`, con un tope finito de seguridad. */
    async function recorrer(ruta: string, cuenta: CuentaFicticia, maxPaginas = 40) {
      const paginas: { items: Array<Record<string, unknown>>; nextCursor: string | null }[] = [];
      let cursor: string | null = null;
      do {
        const separador = ruta.includes('?') ? '&' : '?';
        const sufijo: string = cursor === null ? '' : `${separador}cursor=${encodeURIComponent(cursor)}`;
        const pagina = (await get(`${ruta}${sufijo}`, cuenta).expect(200)).body as (typeof paginas)[number];
        paginas.push(pagina);
        cursor = pagina.nextCursor;
      } while (cursor !== null && paginas.length < maxPaginas);
      expect(cursor).toBeNull();
      return paginas;
    }

    it('directorio y cola recorren más de 200 candidatos filtrados sin declarar ausencia y reevalúan cada página', async () => {
      const fundadoraP = await seed.cuenta(tenantA, 'Fundadora de páginas');
      const gestoraP = await seed.cuenta(tenantA, 'Gestora de páginas');
      const revisoraP = await seed.cuenta(tenantA, 'Revisora de páginas');
      const orgFiltrada = await seed.organizacion(tenantA, 'HOSPITAL');
      const orgValida = await seed.organizacion(tenantA, 'HOSPITAL');
      for (const organizacion of [orgFiltrada, orgValida]) {
        await seed.manager(tenantA, organizacion, gestoraP.humanAccountId, fundadoraP.humanAccountId);
      }
      const competenciaFiltrada = await seed.competencia(tenantA, orgFiltrada, revisoraP.humanAccountId, gestoraP.humanAccountId);
      const competenciaValida = await seed.competencia(tenantA, orgValida, revisoraP.humanAccountId, gestoraP.humanAccountId);

      const sembrar = async (organizationId: string, competenceAttestationId: string, prefijo: '00' | 'ff'): Promise<string> => {
        const patientId = await seed.pacienteFicticio(tenantA);
        const contextId = await seed.contexto(tenantA, organizationId, patientId, gestoraP.humanAccountId, { id: idConPrefijo(prefijo) });
        await seed.concesion({
          tenantId: tenantA,
          organizationId,
          contextId,
          patientId,
          humanAccountId: revisoraP.humanAccountId,
          actorKind: 'HOSPITAL_REVIEWER',
          permission: 'REVIEW_ALARMS',
          competenceAttestationId,
          grantedByHumanAccountId: gestoraP.humanAccountId,
        });
        return contextId;
      };

      // 205 candidatos DESCUBRIBLES (la cuenta tiene concesión) que MP01 deniega, ordenados antes que los válidos.
      const FILTRADOS = 205;
      const filtrados: string[] = [];
      for (let indice = 0; indice < FILTRADOS; indice += 1) {
        filtrados.push(await sembrar(orgFiltrada, competenciaFiltrada, '00'));
      }
      const validos = [await sembrar(orgValida, competenciaValida, 'ff'), await sembrar(orgValida, competenciaValida, 'ff'), await sembrar(orgValida, competenciaValida, 'ff')];
      await owner.clinicalCompetenceAttestation.update({
        where: { id: competenciaFiltrada },
        data: { status: 'REVOKED', revokedAt: new Date(), version: { increment: 1 } },
      });

      for (const ruta of ['/api/v1/care/contexts?limit=50', '/api/v1/care/review-queue?limit=50']) {
        const paginas = await recorrer(ruta, revisoraP);
        // ceil(208 / 50) = 5 páginas de candidatos; las cuatro primeras vienen vacías y CON cursor.
        expect(paginas).toHaveLength(5);
        for (const pagina of paginas.slice(0, 4)) {
          expect(pagina.items).toEqual([]);
          expect(pagina.nextCursor).not.toBeNull();
        }
        const ids = paginas.flatMap((pagina) => pagina.items.map((item) => String(item['contextId'])));
        expect(new Set(ids).size).toBe(ids.length);
        expect([...ids].sort()).toEqual([...validos].sort());
        for (const item of paginas.flatMap((pagina) => pagina.items)) {
          expect(item['actions']).toEqual(['REVIEW_ALARMS']);
        }
        expect(JSON.stringify(paginas)).not.toContain(filtrados[0]);
      }

      // Cada página vuelve a decidir: tras revocar la competencia válida, continuar desde el MISMO cursor ya no proyecta nada.
      const paginas = await recorrer('/api/v1/care/review-queue?limit=50', revisoraP);
      const cursorPrevio = paginas[3]?.nextCursor ?? '';
      await owner.clinicalCompetenceAttestation.update({
        where: { id: competenciaValida },
        data: { status: 'REVOKED', revokedAt: new Date(), version: { increment: 1 } },
      });
      for (const ruta of ['/api/v1/care/review-queue', '/api/v1/care/contexts']) {
        const ultima = await get(`${ruta}?limit=50&cursor=${encodeURIComponent(cursorPrevio)}`, revisoraP).expect(200);
        expect(ultima.body).toEqual({ items: [], nextCursor: null });
      }

      // Un cursor o un tamaño inválidos son 400, nunca un regreso silencioso a la primera página.
      for (const ruta of ['/api/v1/care/contexts', '/api/v1/care/review-queue']) {
        const malo = await get(`${ruta}?cursor=no-es-un-cursor`, revisoraP).expect(400);
        expect(malo.body).toMatchObject({ code: 'CARE_INVALID_INPUT', field: 'cursor' });
        await get(`${ruta}?limit=51`, revisoraP).expect(400);
        await get(ruta, null).expect(401);
      }
    }, 240_000);

    it('la bandeja recorre más de 50 abiertas, encuentra la roja antigua y el filtro se mantiene en cada página', async () => {
      const pacienteP = await seed.cuenta(tenantA, 'Paciente de bandeja');
      await seed.aprobar(pacienteP, 'PATIENT');
      const patientId = await seed.paciente(pacienteP);
      const contexto = await seed.contexto(tenantA, org, patientId, gestor.humanAccountId);
      const revisoraB = await seed.cuenta(tenantA, 'Revisora de bandeja');
      const competencia = await seed.competencia(tenantA, org, revisoraB.humanAccountId, gestor.humanAccountId);
      for (const permission of ['REVIEW_ALARMS', 'VIEW_RECORDS'] as const) {
        await seed.concesion({
          tenantId: tenantA,
          organizationId: org,
          contextId: contexto,
          patientId,
          humanAccountId: revisoraB.humanAccountId,
          actorKind: 'HOSPITAL_REVIEWER',
          permission,
          competenceAttestationId: competencia,
          grantedByHumanAccountId: gestor.humanAccountId,
        });
      }
      const pedir = async (nota: string): Promise<{ id: string; version: number }> =>
        (await post(`${BASE}/${contexto}/alarms`, pacienteP, { idempotencyKey: randomUUID(), reasonCode: 'REQUEST_REVIEW', note: nota }).expect(201)).body.alarm;
      const transicion = (alarmId: string, body: object) => post(`${BASE}/${contexto}/alarms/${alarmId}/transitions`, revisoraB, body).expect(200);

      // La ROJA es la más antigua; después llegan 55 abiertas y, al final, 5 cerradas más recientes.
      const roja = await pedir('Solicitud ficticia antigua');
      await transicion(roja.id, { action: 'CLASSIFY', expectedVersion: roja.version, reason: 'Clasificación ficticia', severity: 'ROJA' });
      const abiertas = [roja.id];
      for (let indice = 0; indice < 55; indice += 1) {
        abiertas.push((await pedir(`Solicitud ficticia ${indice}`)).id);
      }
      const cerradas: string[] = [];
      for (let indice = 0; indice < 5; indice += 1) {
        const alarma = await pedir(`Solicitud ficticia cerrada ${indice}`);
        await transicion(alarma.id, { action: 'RESOLVE', expectedVersion: alarma.version, reason: 'Resuelta (ficticio)' });
        await transicion(alarma.id, { action: 'CLOSE', expectedVersion: alarma.version + 1, reason: 'Cerrada (ficticio)' });
        cerradas.push(alarma.id);
      }

      // Solo abiertas: el filtro viaja en CADA página; las cerradas no ocupan lugar y la roja aparece.
      const paginasAbiertas = await recorrer(`${BASE}/${contexto}/alarms?limit=50&state=open`, revisoraB);
      expect(paginasAbiertas.map((pagina) => pagina.items.length)).toEqual([50, 6]);
      const vistas = paginasAbiertas.flatMap((pagina) => pagina.items);
      expect(new Set(vistas.map((item) => item['id'])).size).toBe(56);
      expect([...vistas.map((item) => String(item['id']))].sort()).toEqual([...abiertas].sort());
      expect(vistas.every((item) => item['state'] !== 'CERRADA')).toBe(true);
      expect(vistas.find((item) => item['id'] === roja.id)).toMatchObject({ severity: 'ROJA' });
      // Orden determinista: creación descendente (el desempate por id lo fija el servidor con microsegundos).
      const instantes = vistas.map((item) => String(item['createdAt']));
      expect(instantes).toEqual([...instantes].sort().reverse());

      // Sin filtro, las cerradas también se recorren; nada se pierde ni se duplica.
      const todas = (await recorrer(`${BASE}/${contexto}/alarms?limit=50`, revisoraB)).flatMap((pagina) => pagina.items);
      expect(new Set(todas.map((item) => item['id'])).size).toBe(61);
      expect(cerradas.every((id) => todas.some((item) => item['id'] === id))).toBe(true);
      await get(`${BASE}/${contexto}/alarms?state=closed`, revisoraB).expect(400);

      // La cola cuenta TODAS las abiertas y avisa de que el anticipo no las incluye: la roja no queda oculta.
      const cola = (await recorrer('/api/v1/care/review-queue?limit=50', revisoraB)).flatMap((pagina) => pagina.items);
      const elemento = cola.find((item) => item['contextId'] === contexto);
      expect(elemento).toMatchObject({ openAlarmCount: 56, hasMoreOpenAlarms: true, semaphore: expect.objectContaining({ level: 'ROJO' }) });
      expect((elemento?.['semaphore'] as { openAlarms: { ROJA: number } }).openAlarms.ROJA).toBe(1);
      expect(elemento?.['alarms']).toHaveLength(10);
      expect((elemento?.['alarms'] as Array<{ id: string }>).some((alarma) => alarma.id === roja.id)).toBe(false);
      expect((elemento?.['alarms'] as Array<{ id: string }>).some((alarma) => cerradas.includes(alarma.id))).toBe(false);

      // El solicitante, con el mismo filtro, solo recorre las suyas.
      const propias = (await recorrer(`${BASE}/${contexto}/alarms?limit=50&state=open`, pacienteP)).flatMap((pagina) => pagina.items);
      expect(propias).toHaveLength(56);
      expect(propias.every((item) => item['initiatedByMe'] === true)).toBe(true);
    }, 240_000);

    it('la bitácora de más de 20 entradas se recorre completa con su cursor', async () => {
      const pacienteR = await seed.cuenta(tenantA, 'Paciente de bitácora');
      await seed.aprobar(pacienteR, 'PATIENT');
      const contexto = await seed.contexto(tenantA, org, await seed.paciente(pacienteR), gestor.humanAccountId);
      const creados: string[] = [];
      for (let indice = 0; indice < 23; indice += 1) {
        const registro = await post(`${BASE}/${contexto}/records`, pacienteR, {
          idempotencyKey: randomUUID(),
          occurredAt: new Date(Date.now() - 60_000).toISOString(),
          note: `Entrada ficticia ${indice}`,
        }).expect(201);
        creados.push(registro.body.id);
      }

      const paginas = await recorrer(`${BASE}/${contexto}/records`, pacienteR);
      expect(paginas.map((pagina) => pagina.items.length)).toEqual([20, 3]);
      const ids = paginas.flatMap((pagina) => pagina.items.map((item) => String(item['id'])));
      expect([...ids].sort()).toEqual([...creados].sort());
      const instantes = paginas.flatMap((pagina) => pagina.items.map((item) => String(item['receivedAt'])));
      expect(instantes).toEqual([...instantes].sort().reverse());
      await get(`${BASE}/${contexto}/records?cursor=${encodeURIComponent('no|valido')}`, pacienteR).expect(400);
    }, 120_000);
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
