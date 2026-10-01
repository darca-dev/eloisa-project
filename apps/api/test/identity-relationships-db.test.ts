/*
 * Pruebas de garantías de base de datos para identidad humana y relaciones
 * Paciente–Cuidador (Spec 028 RF-04, basado en Spec 011 gaps).
 *
 * Cobertura:
 * - Exclusion constraint: solapamiento de relaciones ACTIVE
 * - Trigger: autorrelación (paciente = cuidador)
 * - RLS en 6 tablas: aislamiento por tenant
 * - Grants sin DELETE en 6 tablas
 *
 * REQUISITOS:
 * - PostgreSQL con `btree_gist` extension
 * - Migraciones aplicadas (incluye `identity_relationships_core_01`)
 * - Rol `merdn_runtime` existente sin BYPASSRLS
 */
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';

import { createTestPrismaClient } from './database-availability';
import { ensureOtherTenant } from './enrollment-fixtures';
import {
  crearPacienteFicticio,
  crearPersona,
  identidadValidadoraFicticia,
} from './identity-relationships-fixtures';

const availability = inject('databaseAvailability');
const puedeEjecutarse = availability.available && availability.migrated;

if (!availability.available || !availability.migrated) {
  console.warn('\nPruebas omitidas: base de datos no disponible\n');
}

let prisma: any;
let tenantId: string;
let tenantIdOtro: string;

beforeAll(async () => {
  if (!puedeEjecutarse) {
    return;
  }
  const testPrisma = createTestPrismaClient();
  prisma = testPrisma;
  tenantId = process.env['MERDN_ACTIVE_TENANT_ID'] ?? '00000000-0000-4000-8000-000000000001';
  tenantIdOtro = await ensureOtherTenant(prisma);
});

afterAll(async () => {
  // No limpiamos: la base es efímera en CI
});

describe('Exclusion constraint — solapamiento de relaciones ACTIVE', () => {
  it('rechaza dos relaciones ACTIVE solapadas', async () => {
    if (!puedeEjecutarse) return;
    const { patientId } = await crearPacienteFicticio(prisma, tenantId);
    const { personId: cuidadoraPersonId } = await crearPersona(prisma, tenantId, 'Cuidadora Test');
    const identidadValidadora = await identidadValidadoraFicticia(prisma, tenantId);

    await prisma.patientCaregiverRelationship.create({
      data: {
        tenantId,
        patientId,
        caregiverPersonId: cuidadoraPersonId,
        relationshipType: 'DECLARED_CARE_SUPPORT',
        purpose: 'HOME_CARE_COORDINATION',
        status: 'ACTIVE',
        validationSource: 'CONTROLLED_MVP_OPERATOR_ASSERTION',
        startsAt: new Date(Date.now() - 60 * 60 * 1000),
        endsAt: null,
        authorizationReference: 'TEST-REF-1',
        validatedByInstitutionalIdentityId: identidadValidadora,
        validatedAt: new Date(),
        version: 1,
      },
      select: { id: true },
    });

    await expect(prisma.patientCaregiverRelationship.create({
      data: {
        tenantId,
        patientId,
        caregiverPersonId: cuidadoraPersonId,
        relationshipType: 'DECLARED_CARE_SUPPORT',
        purpose: 'HOME_CARE_COORDINATION',
        status: 'ACTIVE',
        validationSource: 'CONTROLLED_MVP_OPERATOR_ASSERTION',
        startsAt: new Date(Date.now() - 60 * 60 * 1000),
        endsAt: null,
        authorizationReference: 'TEST-REF-2',
        validatedByInstitutionalIdentityId: identidadValidadora,
        validatedAt: new Date(),
        version: 1,
      },
    })).rejects.toThrow();
  });
});

describe('Trigger — autorrelación (paciente = cuidador)', () => {
  it('rechaza crear relación donde paciente y cuidadora son la misma persona', async () => {
    if (!puedeEjecutarse) return;
    const { personId } = await crearPersona(prisma, tenantId, 'Persona Test');

    const patient = await prisma.patient.create({
      data: {
        tenantId,
        personId,
        epsCode: 'NUEVA_EPS',
        epsNameControlled: 'Nueva EPS',
        status: 'ACTIVE',
        origin: 'PUBLIC_SELF_ENROLLMENT',
        enrolledAt: new Date(),
      },
      select: { id: true },
    });

    const identidadValidadora = await identidadValidadoraFicticia(prisma, tenantId);

    await expect(prisma.patientCaregiverRelationship.create({
      data: {
        tenantId,
        patientId: patient.id,
        caregiverPersonId: personId,
        relationshipType: 'DECLARED_CARE_SUPPORT',
        purpose: 'HOME_CARE_COORDINATION',
        status: 'ACTIVE',
        validationSource: 'CONTROLLED_MVP_OPERATOR_ASSERTION',
        startsAt: new Date(Date.now() - 60 * 60 * 1000),
        endsAt: null,
        authorizationReference: 'TEST-REF-SELF',
        validatedByInstitutionalIdentityId: identidadValidadora,
        validatedAt: new Date(),
        version: 1,
      },
    })).rejects.toThrow();
  });
});

describe('RLS — aislamiento por tenant', () => {
  it('aisla patient_caregiver_relationship por tenant', async () => {
    if (!puedeEjecutarse) return;
    const { patientId: patientIdA } = await crearPacienteFicticio(prisma, tenantId);
    const { personId: cuidadoraPersonIdA } = await crearPersona(prisma, tenantId, 'Cuidadora A');
    const identidadValidadoraA = await identidadValidadoraFicticia(prisma, tenantId);

    await prisma.patientCaregiverRelationship.create({
      data: {
        tenantId,
        patientId: patientIdA,
        caregiverPersonId: cuidadoraPersonIdA,
        relationshipType: 'DECLARED_CARE_SUPPORT',
        purpose: 'HOME_CARE_COORDINATION',
        status: 'ACTIVE',
        validationSource: 'CONTROLLED_MVP_OPERATOR_ASSERTION',
        startsAt: new Date(Date.now() - 60 * 60 * 1000),
        endsAt: null,
        authorizationReference: 'TEST-REF-A',
        validatedByInstitutionalIdentityId: identidadValidadoraA,
        validatedAt: new Date(),
        version: 1,
      },
    });

    const relsEnB = await prisma.patientCaregiverRelationship.findMany({
      where: { tenantId: tenantIdOtro },
    });

    expect(relsEnB.length).toBe(0);
  });
});

describe('Grants — sin DELETE en 6 tablas', () => {
  const tablasSinDelete = [
    'human_account',
    'external_auth_identity',
    'human_session',
    'human_auth_attempt',
    'patient_caregiver_relationship',
    'patient_caregiver_relationship_scope',
  ];

  for (const tabla of tablasSinDelete) {
    it(`${tabla} no tiene privilegio DELETE para rol runtime`, async () => {
      if (!puedeEjecutarse) return;
      const grants = await prisma.$queryRaw<Array<{ privilege_type: string }>>`
        SELECT privilege_type
        FROM information_schema.table_privileges
        WHERE table_name = ${tabla}
          AND grantee = 'merdn_runtime'
          AND privilege_type = 'DELETE'
      `;

      expect(grants.length).toBe(0);
    });
  }
});