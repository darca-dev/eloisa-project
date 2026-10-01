import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, inject, it, type TestContext } from 'vitest';

import { Prisma, type PrismaClient } from '../src/generated/prisma/client';

import { createTestPrismaClient, unavailableBanner } from './database-availability';

/**
 * Expediente de solicitud en PostgreSQL real (SPEC 038, MP04-C3-C1).
 *
 * Se ejecuta contra la base DESECHABLE de `compose.test.yml` con las 17
 * migraciones aplicadas. NUNCA contra `merdn_dev`: este archivo no elige base,
 * usa la que el entorno declara, y el provisionador cerrado solo conoce la
 * topología aislada. Todos los datos son ficticios y los tenants son propios
 * de esta prueba.
 *
 * Matriz: columnas/tipos/CHECK, versión 1, JSONB sin password, RLS/FORCE,
 * lectura permitida en el tenant, lectura cruzada denegada y rollback
 * rechazado con instantánea y con evento. Cero omitidos en entorno aislado.
 */

const availability = inject('databaseAvailability');
const puedeEjecutarse = availability.available && availability.migrated;

if (!puedeEjecutarse) {
  // eslint-disable-next-line no-console
  console.warn(`\n${unavailableBanner(availability)}\n`);
}

const ROLLBACK_SQL = readFileSync(
  join(
    __dirname,
    '..',
    '..',
    '..',
    'prisma',
    'migrations',
    'ROLLBACK-access_request_registration_snapshot.sql',
  ),
  'utf8',
);

/**
 * Extrae el bloque de guarda del rollback: lo comprendido entre los
 * marcadores, desde su `DO $$` hasta su `END $$;`. El DROP posterior nunca se
 * ejecuta en pruebas: destruiría las columnas que el resto de la matriz
 * necesita.
 */
function extraerGuardia(sql: string): string {
  const bloque = sql.slice(sql.indexOf('-- GUARD-START'), sql.indexOf('-- GUARD-END'));
  const desde = bloque.indexOf('DO $$');
  const hasta = bloque.indexOf('END $$;');

  if (desde < 0 || hasta < 0) {
    throw new Error('el rollback no contiene su bloque de guarda marcado');
  }

  return bloque.slice(desde, hasta + 'END $$;'.length);
}

const GUARDIA_ROLLBACK = extraerGuardia(ROLLBACK_SQL);

const EXPEDIENTE_PACIENTE = {
  necesitaApoyo: 'SI',
  apoyos: ['MOVILIZARSE'],
  condiciones: ['NINGUNA'],
  zona: 'URBANA',
  eps: 'NUEVA_EPS',
  direccion: 'Cra 45 # 32-16',
  contactoNombre: 'Carlos Ficticio',
  contactoParentesco: 'Hijo',
  contactoTelefono: '311 220 3355',
  vecinoNombre: 'Rosa Ficticia',
  vecinoTelefono: '312 778 4410',
  vecinoAutorizado: true,
  autorizaDatos: true,
};

let prisma: PrismaClient;

const TENANT_A = { id: randomUUID(), code: 'mp04-c3-tenant-a', name: 'Tenant A ficticio' };
const TENANT_B = { id: randomUUID(), code: 'mp04-c3-tenant-b', name: 'Tenant B ficticio' };
const TENANT_C = { id: randomUUID(), code: 'mp04-c3-tenant-c', name: 'Tenant C ficticio' };

const REF_A1 = `AR-${'A'.repeat(24)}`;
const REF_A2 = `AR-${'B'.repeat(24)}`;
const REF_B1 = `AR-${'C'.repeat(24)}`;
const REF_C1 = `AR-${'D'.repeat(24)}`;

async function sembrar(): Promise<void> {
  /*
   * Idempotencia de re-ejecución: la base desechable sobrevive entre corridas
   * del mismo provisionamiento. Se retiran primero los rastros propios (solo
   * códigos de esta prueba) en orden de dependencias.
   */
  await prisma.$executeRawUnsafe(
    `DELETE FROM audit_event WHERE "tenantId" IN (SELECT id FROM tenant WHERE code LIKE 'mp04-c3-%')`,
  );
  await prisma.$executeRawUnsafe(
    `DELETE FROM access_request WHERE "tenantId" IN (SELECT id FROM tenant WHERE code LIKE 'mp04-c3-%')`,
  );
  await prisma.$executeRawUnsafe(
    `DELETE FROM person WHERE "tenantId" IN (SELECT id FROM tenant WHERE code LIKE 'mp04-c3-%')`,
  );
  await prisma.$executeRawUnsafe(`DELETE FROM tenant WHERE code LIKE 'mp04-c3-%'`);

  for (const tenant of [TENANT_A, TENANT_B, TENANT_C]) {
    await prisma.tenant.create({
      data: { id: tenant.id, code: tenant.code, name: tenant.name },
    });
  }

  const persona = async (tenantId: string, documento: string, nombres: string) =>
    prisma.person.create({
      data: {
        id: randomUUID(),
        tenantId,
        documentType: 'CEDULA_CIUDADANIA',
        documentNumber: documento,
        documentNumberNormalized: documento,
        givenNames: nombres,
        familyNames: 'Ficticio',
        birthDate: new Date('1980-01-02T00:00:00.000Z'),
        sexGenderCode: 'FEMENINO',
        phone: '3000000000',
        email: null,
      },
      select: { id: true },
    });

  const solicitud = async (
    tenantId: string,
    personId: string,
    reference: string,
    expediente: Record<string, unknown> | null,
  ) =>
    prisma.accessRequest.create({
      data: {
        id: randomUUID(),
        tenantId,
        personId,
        requestedProfile: 'PATIENT',
        status: 'PENDING',
        reference,
        registrationSchemaVersion: expediente === null ? null : 1,
        registrationData:
          expediente === null ? Prisma.DbNull : (expediente as Prisma.InputJsonValue),
      },
      select: { id: true },
    });

  const personaA1 = await persona(TENANT_A.id, '900000001', 'Ana Ficticia');
  const personaA2 = await persona(TENANT_A.id, '900000002', 'Andrés Ficticio');
  const personaB1 = await persona(TENANT_B.id, '900000003', 'Bruno Ficticio');
  const personaC1 = await persona(TENANT_C.id, '900000004', 'Carla Ficticia');

  await solicitud(TENANT_A.id, personaA1.id, REF_A1, EXPEDIENTE_PACIENTE);
  await solicitud(TENANT_A.id, personaA2.id, REF_A2, null);
  await solicitud(TENANT_B.id, personaB1.id, REF_B1, EXPEDIENTE_PACIENTE);
  await solicitud(TENANT_C.id, personaC1.id, REF_C1, null);
}

/** Lee solicitudes como rol runtime bajo el tenant indicado (patrón RLS vigente). */
async function leerComoRuntime(tenantId: string): Promise<readonly string[]> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('SET LOCAL ROLE "merdn_runtime"');
    await tx.$executeRaw`SELECT set_config('merdn.tenant_id', ${tenantId}, true)`;

    const filas = await tx.accessRequest.findMany({
      select: { reference: true },
      orderBy: { reference: 'asc' },
    });

    return filas.map((fila) => fila.reference);
  });
}

beforeAll(async () => {
  if (!puedeEjecutarse) return;

  prisma = createTestPrismaClient();
  await sembrar();
});

afterAll(async () => {
  if (!puedeEjecutarse) return;
  await prisma.$disconnect().catch(() => undefined);
});

const diferir = (contexto: TestContext): boolean => {
  if (puedeEjecutarse) return false;
  contexto.skip();
  return true;
};

describe('Migración MP04-C3 — expediente en PostgreSQL aislada', () => {
  it('añade las dos columnas nulables con los tipos exactos', async (contexto) => {
    if (diferir(contexto)) return;

    const filas = await prisma.$queryRawUnsafe<
      Array<{ columna: string; udt: string; nula: string; defecto: string | null }>
    >(
      `SELECT column_name AS columna, udt_name AS udt,
              is_nullable AS nula, column_default AS defecto
         FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'access_request'
          AND column_name IN ('registrationSchemaVersion', 'registrationData')
        ORDER BY column_name`,
    );

    expect(filas.map((fila) => fila.columna)).toEqual([
      'registrationData',
      'registrationSchemaVersion',
    ]);
    expect(filas.find((fila) => fila.columna === 'registrationData')?.udt).toBe('jsonb');
    expect(filas.find((fila) => fila.columna === 'registrationSchemaVersion')?.udt).toBe('int4');

    for (const fila of filas) {
      expect(fila.nula).toBe('YES');
      expect(fila.defecto).toBeNull();
    }
  });

  it('declara los cuatro CHECK del expediente', async (contexto) => {
    if (diferir(contexto)) return;

    const filas = await prisma.$queryRawUnsafe<Array<{ nombre: string; definicion: string }>>(
      `SELECT conname AS nombre, pg_get_constraintdef(oid) AS definicion
         FROM pg_constraint
        WHERE conrelid = 'access_request'::regclass
          AND contype = 'c'
          AND conname LIKE 'access_request_registration\\_%'
        ORDER BY conname`,
    );

    expect(filas.map((fila) => fila.nombre)).toEqual([
      'access_request_registration_data_has_no_password',
      'access_request_registration_data_is_object',
      'access_request_registration_schema_version_known',
      'access_request_registration_snapshot_coherent',
    ]);

    const porNombre = new Map(filas.map((fila) => [fila.nombre, fila.definicion]));
    expect(porNombre.get('access_request_registration_snapshot_coherent')).toContain('IS NOT NULL');
    expect(porNombre.get('access_request_registration_schema_version_known')).toContain('= 1');
    expect(porNombre.get('access_request_registration_data_is_object')).toContain('jsonb_typeof');
    expect(porNombre.get('access_request_registration_data_has_no_password')).toContain('password');
  });

  it('access_request conserva RLS y FORCE', async (contexto) => {
    if (diferir(contexto)) return;

    const tabla = await prisma.$queryRawUnsafe<Array<{ rls: boolean; force: boolean }>>(
      `SELECT c.relrowsecurity AS rls, c.relforcerowsecurity AS force
         FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'access_request'`,
    );

    expect(tabla[0]?.rls).toBe(true);
    expect(tabla[0]?.force).toBe(true);
  });

  it('la instantanea declara version 1 con objeto y sin password', async (contexto) => {
    if (diferir(contexto)) return;

    const filas = await prisma.$queryRawUnsafe<
      Array<{ version: number; datos: unknown }>
    >(
      `SELECT "registrationSchemaVersion" AS version, "registrationData" AS datos
         FROM "access_request"
        WHERE "registrationData" IS NOT NULL
        ORDER BY "reference"`,
    );

    expect(filas.length).toBe(2);

    for (const fila of filas) {
      expect(fila.version).toBe(1);
      expect(typeof fila.datos).toBe('object');
      expect(fila.datos).not.toBeNull();
      expect('password' in (fila.datos as Record<string, unknown>)).toBe(false);
    }

    expect((filas[0]?.datos as Record<string, unknown>)['necesitaApoyo']).toBe('SI');
  });

  it('la lectura permitida en el tenant ve solo sus solicitudes', async (contexto) => {
    if (diferir(contexto)) return;

    expect(await leerComoRuntime(TENANT_A.id)).toEqual([REF_A1, REF_A2]);
    expect(await leerComoRuntime(TENANT_B.id)).toEqual([REF_B1]);
  });

  it('la lectura cruzada esta denegada: otro tenant no ve estas filas', async (contexto) => {
    if (diferir(contexto)) return;

    const vistasDesdeA = await leerComoRuntime(TENANT_A.id);
    expect(vistasDesdeA).not.toContain(REF_B1);

    // Lectura directa por identificador ajeno bajo el otro tenant: nula por RLS.
    const ajena = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SET LOCAL ROLE "merdn_runtime"');
      await tx.$executeRaw`SELECT set_config('merdn.tenant_id', ${TENANT_A.id}, true)`;

      return tx.accessRequest.findFirst({
        where: { reference: REF_B1, tenantId: TENANT_A.id },
        select: { id: true },
      });
    });

    expect(ajena).toBeNull();
  });

  it('el rollback se rechaza cuando hay instantanea', async (contexto) => {
    if (diferir(contexto)) return;

    await expect(prisma.$executeRawUnsafe(GUARDIA_ROLLBACK)).rejects.toThrow(
      /REVERSION DETENIDA/u,
    );

    // El rechazo no mutó nada: el expediente sigue intacto.
    const filas = await prisma.$queryRawUnsafe<Array<{ total: bigint }>>(
      `SELECT count(*)::bigint AS total FROM "access_request" WHERE "registrationData" IS NOT NULL`,
    );
    expect(Number(filas[0]?.total ?? 0n)).toBe(2);
  });

  it('el rollback se rechaza cuando hay evento aunque no haya instantanea', async (contexto) => {
    if (diferir(contexto)) return;

    /*
     * Se vacían las instantáneas y se registra el evento DENTRO de una
     * transacción que el propio rechazo revierte: la evidencia de las demás
     * pruebas queda intacta y aquí se demuestra exactamente la segunda rama
     * del guarda.
     */
    await expect(
      prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `UPDATE "access_request" SET "registrationSchemaVersion" = NULL, "registrationData" = NULL`,
        );
        await tx.auditEvent.create({
          data: {
            tenantId: TENANT_C.id,
            eventType: 'ACCESS_REQUEST_REPLAY_CONFLICT',
            actorType: 'PUBLIC_SELF_ENROLLMENT',
            actorUserId: null,
            resourceType: 'AccessRequest',
            resourceId: TENANT_C.id,
            outcome: 'DENIED',
            endpoint: '/api/v1/access-requests',
            correlationId: randomUUID(),
            occurredAt: new Date(),
          },
        });
        await tx.$executeRawUnsafe(GUARDIA_ROLLBACK);
      }),
    ).rejects.toThrow(/REVERSION DETENIDA/u);
  });
});
