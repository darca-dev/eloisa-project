import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, inject, it } from 'vitest';

import { AppModule } from '../src/app.module';
import { type PrismaClient } from '../src/generated/prisma/client';
import { ENROLLMENT_ERROR_CODES } from '../src/patients/enrollment.contract';
import { MalformedJsonFilter } from '../src/patients/malformed-json.filter';

import { createTestPrismaClient, unavailableBanner } from './database-availability';
import {
  DEPARTMENT_CODE,
  MUNICIPALITY_CODE,
  cleanupTestData,
  crearSesionInscripcionHistorica,
  enrollmentBody,
  ensureOtherTenant,
  nextTestDocument,
  territorialUnitId,
} from './enrollment-fixtures';
import { crearPacienteHospital } from './hospital-fixtures';
import { crearPacienteSintetico } from './municipality-fixtures';

/**
 * Evidencia de retiro de la inscripción heredada (SPEC 054).
 *
 * La ruta se conserva temporalmente como respuesta explícita `410 Gone` para
 * clientes antiguos. No valida ni persiste el cuerpo, no crea sesión y no
 * intenta provisionar identidad. El alta vigente vive en AccessRequest y exige
 * revisión institucional.
 */

const availability = inject('databaseAvailability');
const puedeEjecutarse = availability.available && availability.migrated;

if (!puedeEjecutarse) {
  // eslint-disable-next-line no-console
  console.warn(`\n${unavailableBanner(availability)}\n`);
}

describe.skipIf(!puedeEjecutarse)('retiro de POST /api/v1/patients/enrollments', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let tenantId: string;
  let departmentId: string;
  let municipalityId: string;

  beforeAll(async () => {
    prisma = createTestPrismaClient();
    await cleanupTestData(prisma);
    const tenant = await prisma.tenant.findUniqueOrThrow({
      where: { code: process.env['MERDN_ACTIVE_TENANT_CODE'] ?? 'merdn-mvp' },
      select: { id: true },
    });
    tenantId = tenant.id;
    departmentId = await territorialUnitId(prisma, 'DEPARTMENT', DEPARTMENT_CODE);
    municipalityId = await territorialUnitId(prisma, 'MUNICIPALITY', MUNICIPALITY_CODE);
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new MalformedJsonFilter());
    await app.init();
  });

  afterEach(async () => {
    await cleanupTestData(prisma);
  });

  afterAll(async () => {
    if (app !== undefined) await app.close();
    if (prisma !== undefined) await prisma.$disconnect();
  });

  it('responde 410 con contrato estable y sin cookie', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/patients/enrollments')
      .send(enrollmentBody())
      .expect(410);

    expect(response.body).toStrictEqual({
      code: ENROLLMENT_ERROR_CODES.registrationRetired,
      message: 'La inscripción anterior fue retirada. Use el registro vigente de acceso.',
    });
    expect(response.headers['set-cookie']).toBeUndefined();
  });

  it('no procesa ni refleja datos enviados por un cliente antiguo', async () => {
    const secretMarker = `no-reflejar-${nextTestDocument()}`;
    const response = await request(app.getHttpServer())
      .post('/api/v1/patients/enrollments')
      .send({ documentNumber: secretMarker, password: secretMarker })
      .expect(410);

    expect(JSON.stringify(response.body)).not.toContain(secretMarker);
  });

  it('no crea persona, paciente, cuenta, vínculo ni sesión', async () => {
    const documentNumber = nextTestDocument();
    const before = await counts(prisma);

    await request(app.getHttpServer())
      .post('/api/v1/patients/enrollments')
      .send(enrollmentBody({ documentNumber }))
      .expect(410);

    expect(await counts(prisma)).toStrictEqual(before);
    expect(
      await prisma.person.findFirst({
        where: { documentNumberNormalized: documentNumber },
        select: { id: true },
      }),
    ).toBeNull();
  });

  it('permanece cerrado bajo concurrencia', async () => {
    const documents = Array.from({ length: 8 }, () => nextTestDocument());
    const responses = await Promise.all(
      documents.map((documentNumber) =>
        request(app.getHttpServer())
          .post('/api/v1/patients/enrollments')
          .send(enrollmentBody({ documentNumber })),
      ),
    );

    expect(responses.map((response) => response.status)).toEqual(Array(8).fill(410));
    expect(
      await prisma.person.count({
        where: { documentNumberNormalized: { in: documents } },
      }),
    ).toBe(0);
  });

  it('la recuperación heredada sigue cerrada sin una sesión preexistente', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/patients/me')
      .expect(401);

    expect(response.body.code).toBe(ENROLLMENT_ERROR_CODES.sessionRequired);
  });

  it('una sesión histórica preexistente recupera solo su paciente', async () => {
    const historical = await historicalPatientSession();
    const response = await request(app.getHttpServer())
      .get('/api/v1/patients/me')
      .set('Cookie', `merdn_enrollment_session=${historical.token}`)
      .expect(200);

    expect(response.body).toMatchObject({
      status: 'ACTIVE',
      givenNames: 'Persona',
      familyNames: 'Ejemplo Ficticio',
      epsCode: 'NUEVA_EPS',
    });
    expect(JSON.stringify(response.body)).not.toContain(historical.documentNumber);
    expect(JSON.stringify(response.body)).not.toContain('Calle Ficticia 00-00');
  });

  it('una sesión histórica expirada o revocada recibe el mismo 401', async () => {
    const expired = await historicalPatientSession();
    const revoked = await historicalPatientSession();
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

    await prisma.enrollmentSession.updateMany({
      where: { patientId: expired.patientId },
      data: { createdAt: yesterday, expiresAt: new Date(yesterday.getTime() + 1000) },
    });
    await prisma.enrollmentSession.updateMany({
      where: { patientId: revoked.patientId },
      data: { revokedAt: new Date() },
    });

    const observed: unknown[] = [];
    for (const token of [expired.token, revoked.token]) {
      const response = await request(app.getHttpServer())
        .get('/api/v1/patients/me')
        .set('Cookie', `merdn_enrollment_session=${token}`)
        .expect(401);
      observed.push(response.body);
    }
    expect(observed[1]).toStrictEqual(observed[0]);
  });

  it('una sesión histórica de otro tenant no cruza la institución activa', async () => {
    const otherTenantId = await ensureOtherTenant(prisma);
    const otherPatient = await crearPacienteHospital(prisma, {
      tenantId: otherTenantId,
      givenNames: 'Paciente',
      familyNames: 'Otro Tenant Ficticio',
      birthDate: new Date(Date.UTC(1975, 0, 15)),
    });
    const token = await crearSesionInscripcionHistorica(
      prisma,
      otherTenantId,
      otherPatient.patientId,
    );

    await request(app.getHttpServer())
      .get('/api/v1/patients/me')
      .set('Cookie', `merdn_enrollment_session=${token}`)
      .expect(401);
  });

  async function historicalPatientSession(): Promise<{
    readonly patientId: string;
    readonly documentNumber: string;
    readonly token: string;
  }> {
    const patient = await crearPacienteSintetico(prisma, {
      tenantId,
      departmentUnitId: departmentId,
      municipalityUnitId: municipalityId,
      condiciones: { mayor: true, discapacidad: false, cuidadoEnCasa: false },
    });
    const person = await prisma.person.findUniqueOrThrow({
      where: { id: patient.personId },
      select: { documentNumber: true },
    });
    const token = await crearSesionInscripcionHistorica(prisma, tenantId, patient.patientId);
    return { patientId: patient.patientId, documentNumber: person.documentNumber, token };
  }
});

async function counts(prisma: PrismaClient): Promise<Record<string, number>> {
  const [people, patients, accounts, bindings, sessions, enrollmentAudits] = await Promise.all([
    prisma.person.count(),
    prisma.patient.count(),
    prisma.humanAccount.count(),
    prisma.externalAuthIdentity.count(),
    prisma.enrollmentSession.count(),
    prisma.auditEvent.count({ where: { eventType: 'PATIENT_ENROLLMENT_CREATED' } }),
  ]);
  return { people, patients, accounts, bindings, sessions, enrollmentAudits };
}
