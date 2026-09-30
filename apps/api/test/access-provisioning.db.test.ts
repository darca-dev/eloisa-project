import { afterAll, beforeAll, describe, expect, inject, it, type TestContext } from 'vitest';

import { type PrismaClient } from '../src/generated/prisma/client';

import { createTestPrismaClient, unavailableBanner } from './database-availability';

/**
 * Garantías de base de datos de la provisión de identidad
 * (SPEC 038, MP04 — «Persistencia, concurrencia y auditoría» punto 1).
 *
 * QUÉ SE COMPRUEBA AQUÍ y solo aquí: lo que PostgreSQL garantiza por sí mismo
 * sobre la migración `20260930170000_access_provisioning` —FK compuesta
 * tenant-cuenta, CHECKs, índice de apoyo, valores de enum, allowlist de retorno
 * ampliada, RLS/FORCE y privilegios del rol runtime—, más la coherencia de las
 * filas que ya existan.
 *
 * LO QUE NO SE COMPRUEBA AQUÍ: la saga, el idempotencia frente a dos decisiones
 * concurrentes, el límite de intentos ni la revocación atómica de cuenta +
 * sesiones + vínculo. Esas son decisiones del SERVICIO y viven en
 * `test/access-provisioning.test.ts` y `test/access-request-review.test.ts`.
 * Declararlas aquí sería probar un doble, no la base.
 *
 * POR QUÉ ESTE ARCHIVO SE SALTA CUANDO FALTA LA MIGRACIÓN: la única PostgreSQL
 * configurada es la de desarrollo y la migración MP04 está diseñada para
 * aplicarse con autorización expresa del Product Owner y respaldo previo.
 * Ejecutar estas afirmaciones contra un esquema sin las columnas no produciría
 * evidencia, produciría ruido, y aplicar la migración para evitarlo no está
 * autorizado. Por eso la evidencia de base de datos de MP04 queda DIFERIDA, y
 * así se reporta, en lugar de convertirse en verde.
 */

const availability = inject('databaseAvailability');
const puedeEjecutarse = availability.available && availability.migrated;

if (!puedeEjecutarse) {
  // eslint-disable-next-line no-console
  console.warn(`\n${unavailableBanner(availability)}\n`);
}

/** Rol de mínimo privilegio. Su nombre es la identidad, no el OID. */
const ROL_RUNTIME = 'merdn_runtime';

/** Columnas y restricciones que esta migración añade. */
const COLUMNAS_MP04 = [
  'humanAccountId',
  'provisioningAttempts',
  'provisioningStartedAt',
  'provisioningLastErrorAt',
  'provisioningErrorCode',
] as const;

const CHECKS_MP04 = [
  'access_request_provisioning_attempts_non_negative',
  'access_request_provisioning_error_code_bounded',
  'access_request_provisioning_last_error_after_submission',
  'access_request_provisioning_started_after_submission',
  'access_request_provisioning_error_requires_attempt',
] as const;

const ENUM_MP04 = [
  'ACCESS_IDENTITY_PREPARED',
  'ACCESS_IDENTITY_PREPARATION_FAILED',
  'ACCESS_REQUEST_REACTIVATED',
  'EXPERIENCE_ACCESS_GRANTED',
  'EXPERIENCE_ACCESS_DENIED',
] as const;

interface EstadoMp04 {
  readonly migracionAplicada: boolean;
  readonly detalle: string;
}

/**
 * Sondea el esquema sin escribir nada.
 *
 * La comprobación es POSITIVA (las cinco columnas, la FK y la allowlist) y no
 * negativa: un esquema al que le falte UNA columna no es un esquema sobre el
 * que estas pruebas puedan decir nada.
 */
async function sondearMp04(prisma: PrismaClient): Promise<EstadoMp04> {
  const columnas = await prisma.$queryRawUnsafe<Array<{ columna: string }>>(
    `SELECT column_name AS columna
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'access_request'
        AND column_name = ANY(ARRAY[${COLUMNAS_MP04.map((columna) => `'${columna}'`).join(',')}])`,
  );

  const fk = await prisma.$queryRawUnsafe<Array<{ nombre: string }>>(
    `SELECT conname AS nombre
       FROM pg_constraint
      WHERE conname = 'access_request_humanAccountId_tenantId_fkey'
        AND contype = 'f'`,
  );

  const allowlist = await prisma.$queryRawUnsafe<Array<{ definition: string }>>(
    `SELECT pg_get_constraintdef(oid) AS definition
       FROM pg_constraint
      WHERE conname = 'human_auth_attempt_return_target_allowlist'`,
  );

  await prisma.$disconnect().catch(() => undefined);

  const faltantes: string[] = [];

  if (columnas.length !== COLUMNAS_MP04.length) faltantes.push('columnas de access_request');
  if (fk.length !== 1) faltantes.push('FK compuesta (humanAccountId, tenantId)');
  if (!allowlist.some((fila) => fila.definition.includes('/acceso'))) {
    faltantes.push('allowlist de retorno con /acceso');
  }

  return {
    migracionAplicada: faltantes.length === 0,
    detalle:
      faltantes.length === 0
        ? 'migración MP04 aplicada'
        : `migración MP04 NO aplicada; falta: ${faltantes.join('; ')}`,
  };
}

let mp04: EstadoMp04 = { migracionAplicada: false, detalle: 'sondeo no ejecutado' };

let prisma: PrismaClient;

beforeAll(async () => {
  if (!puedeEjecutarse) return;

  const sondeo = createTestPrismaClient();
  try {
    mp04 = await sondearMp04(sondeo);
  } catch (error) {
    mp04 = {
      migracionAplicada: false,
      detalle: `sondeo fallido: ${error instanceof Error ? error.name : 'desconocido'}`,
    };
    await sondeo.$disconnect().catch(() => undefined);
  }

  if (!mp04.migracionAplicada) {
    // eslint-disable-next-line no-console
    console.warn(
      `\nEVIDENCIA DE BASE DE DATOS DE MP04 DIFERIDA. ${mp04.detalle}. ` +
        'Estas pruebas se omiten y NO constituyen verificación: aplique la ' +
        'migración 20260930170000_access_provisioning con autorización del Product ' +
        'Owner y vuelva a ejecutar la suite.\n',
    );
    return;
  }

  prisma = createTestPrismaClient();
});

afterAll(async () => {
  if (!mp04.migracionAplicada) return;
  await prisma.$disconnect().catch(() => undefined);
});

/**
 * Difiere el test en lugar de hacerlo pasar en vacío: un `return` silencioso
 * contaría como verde y el handoff exige que la evidencia de base de datos se
 * reporte como diferida.
 */
const diferir = (contexto: TestContext): boolean => {
  if (mp04.migracionAplicada) return false;
  contexto.skip();
  return true;
};

describe('Migración MP04 — estructura en PostgreSQL real', () => {
  it('añade exactamente las cinco columnas técnicas, y todas admite NULL salvo el contador', async (contexto) => {
    if (diferir(contexto)) return;
    const filas = await prisma.$queryRawUnsafe<
      Array<{ columna: string; tipo: string; nula: string; defecto: string | null }>
    >(
      `SELECT column_name AS columna, data_type AS tipo,
              is_nullable AS nula, column_default AS defecto
         FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'access_request'
          AND column_name = ANY(${
            `ARRAY[${COLUMNAS_MP04.map((columna) => `'${columna}'`).join(',')}]`
          })
        ORDER BY column_name`,
    );

    expect(filas.map((fila) => fila.columna).sort()).toEqual([...COLUMNAS_MP04].sort());

    const contador = filas.find((fila) => fila.columna === 'provisioningAttempts');
    expect(contador?.tipo).toBe('integer');
    expect(contador?.nula).toBe('NO');
    expect(contador?.defecto).toBe('0');

    for (const columna of ['humanAccountId', 'provisioningStartedAt', 'provisioningLastErrorAt', 'provisioningErrorCode']) {
      expect(filas.find((fila) => fila.columna === columna)?.nula).toBe('SÍ');
    }
  });

  it('declara la FK compuesta (humanAccountId, tenantId) hacia human_account con RESTRICT', async (contexto: TestContext) => {
    if (diferir(contexto)) return;
    const filas = await prisma.$queryRawUnsafe<
      Array<{ nombre: string; columnas: string[]; refrel: string; refcolumnas: string[]; confdeltype: string; confupdtype: string }>
    >(
      `SELECT c.conname AS nombre,
              a.attname AS columnas,
              cf.relname AS refrel,
              b.attname AS refcolumnas,
              c.confdeltype, c.confupdtype
         FROM pg_constraint c
         JOIN LATERAL unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord) ON true
         JOIN pg_class cf ON cf.oid = c.confrelid
         JOIN LATERAL unnest(c.confkey) WITH ORDINALITY AS f(attnum, ord) ON f.ord = k.ord
         JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
         JOIN pg_attribute b ON b.attrelid = c.confrelid AND b.attnum = f.attnum
        WHERE c.conname = 'access_request_humanAccountId_tenantId_fkey'`,
    );

    expect(filas.length).toBe(2);
    expect(filas.map((fila) => fila.columnas).sort()).toEqual(['humanAccountId', 'tenantId']);
    expect(new Set(filas.map((fila) => fila.refrel))).toEqual(new Set(['human_account']));
    expect(filas.map((fila) => fila.refcolumnas).sort()).toEqual(['id', 'tenantId']);
    expect(filas[0]?.confdeltype).toBe('r');
    expect(filas[0]?.confupdtype).toBe('c');

    const indice = await prisma.$queryRawUnsafe<Array<{ indexname: string }>>(
      `SELECT indexname FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'access_request'
          AND indexname = 'access_request_tenantId_humanAccountId_idx'`,
    );
    expect(indice).toHaveLength(1);
  });

  it('declara los cinco CHECK de metadatos de provisión', async (contexto: TestContext) => {
    if (diferir(contexto)) return;
    const filas = await prisma.$queryRawUnsafe<Array<{ nombre: string }>>(
      `SELECT conname AS nombre
         FROM pg_constraint
        WHERE conrelid = 'access_request'::regclass
          AND contype = 'c'
        ORDER BY conname`,
    );

    const presentes = new Set(filas.map((fila) => fila.nombre));
    for (const nombre of CHECKS_MP04) {
      expect(presentes.has(nombre), `falta el CHECK ${nombre}`).toBe(true);
    }
  });

  it('los CHECK rechazan contador negativo, código de más de 64 caracteres y fallo sin intento', async (contexto: TestContext) => {
    if (diferir(contexto)) return;
    // Se lee el PREDICADO de cada restricción: es lo que PostgreSQL aplica a
    // cualquier fila futura, y a diferencia de una inserción de prueba no
    // depende de que existan datos en este entorno.
    const definiciones = await prisma.$queryRawUnsafe<Array<{ nombre: string; definicion: string }>>(
      `SELECT conname AS nombre, pg_get_constraintdef(oid) AS definicion
         FROM pg_constraint
        WHERE conname = ANY(ARRAY[${CHECKS_MP04.map((nombre) => `'${nombre}'`).join(',')}])`,
    );

    const porNombre = new Map(definiciones.map((fila) => [fila.nombre, fila.definicion]));

    expect(porNombre.get('access_request_provisioning_attempts_non_negative')).toContain(
      '"provisioningAttempts" >= 0',
    );
    expect(porNombre.get('access_request_provisioning_error_code_bounded')).toContain(
      'BETWEEN 1 AND 64',
    );
    expect(porNombre.get('access_request_provisioning_error_requires_attempt')).toContain(
      '"provisioningLastErrorAt" IS NOT NULL',
    );
    expect(porNombre.get('access_request_provisioning_last_error_after_submission')).toContain(
      '>= "submittedAt"',
    );
    expect(porNombre.get('access_request_provisioning_started_after_submission')).toContain(
      '>= "submittedAt"',
    );
  });

  it('amplía la allowlist de retorno a exactamente / y /acceso, sin recortar nada', async (contexto: TestContext) => {
    if (diferir(contexto)) return;
    const filas = await prisma.$queryRawUnsafe<Array<{ definicion: string }>>(
      `SELECT pg_get_constraintdef(oid) AS definicion
         FROM pg_constraint
        WHERE conname = 'human_auth_attempt_return_target_allowlist'`,
    );

    expect(filas).toHaveLength(1);
    expect(filas[0]?.definicion).toContain("'/acceso'");
    expect(filas[0]?.definicion).toContain("'/'");
    expect(filas[0]?.definicion).not.toContain('http');
  });

  it('añade los cinco valores de evento de auditoría a la migración de enum', async (contexto: TestContext) => {
    if (diferir(contexto)) return;
    const filas = await prisma.$queryRawUnsafe<Array<{ enumlabel: string }>>(
      `SELECT e.enumlabel
         FROM pg_enum e
         JOIN pg_type t ON t.oid = e.enumtypid
         JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public'
          AND t.typname = 'AuditEventType'`,
    );

    const presentes = new Set(filas.map((fila) => fila.enumlabel));
    for (const valor of ENUM_MP04) {
      expect(presentes.has(valor), `falta el evento ${valor}`).toBe(true);
    }
  });

  it('access_request sigue con RLS y FORCE, y su policy aplica al rol runtime', async (contexto: TestContext) => {
    if (diferir(contexto)) return;
    const tabla = await prisma.$queryRawUnsafe<Array<{ rls: boolean; force: boolean }>>(
      `SELECT c.relrowsecurity AS rls, c.relforcerowsecurity AS force
         FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'access_request'`,
    );

    expect(tabla[0]?.rls).toBe(true);
    expect(tabla[0]?.force).toBe(true);

    const policies = await prisma.$queryRawUnsafe<Array<{ nombre: string; roles: string[] }>>(
      `SELECT p.polname AS nombre, p.polroles::regrole[]::text[] AS roles
         FROM pg_policy p
         JOIN pg_class c ON c.oid = p.polrelid
         JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'access_request'`,
    );

    expect(policies.length).toBeGreaterThan(0);
    expect(policies.every((fila) => fila.roles.includes(ROL_RUNTIME))).toBe(true);
  });

  it('el rol runtime no tiene DELETE sobre access_request ni sobre audit_event', async (contexto: TestContext) => {
    if (diferir(contexto)) return;
    for (const tabla of ['access_request', 'audit_event']) {
      const grants = await prisma.$queryRawUnsafe<Array<{ privilege_type: string }>>(
        `SELECT privilege_type
           FROM information_schema.table_privileges
          WHERE table_name = '${tabla}'
            AND grantee = '${ROL_RUNTIME}'
            AND privilege_type = 'DELETE'`,
      );

      expect(grants, `${tabla} no debe admitir DELETE desde el rol runtime`).toHaveLength(0);
    }
  });

  it('ninguna fila existente viola los CHECK de provisión', async (contexto: TestContext) => {
    if (diferir(contexto)) return;
    const invalidas = await prisma.$queryRawUnsafe<Array<{ total: bigint }>>(
      `SELECT count(*)::bigint AS total
         FROM "access_request"
        WHERE "provisioningAttempts" < 0
           OR ("provisioningErrorCode" IS NOT NULL
               AND char_length("provisioningErrorCode") NOT BETWEEN 1 AND 64)
           OR ("provisioningErrorCode" IS NOT NULL AND "provisioningLastErrorAt" IS NULL)
           OR ("provisioningLastErrorAt" IS NOT NULL AND "provisioningLastErrorAt" < "submittedAt")
           OR ("provisioningStartedAt" IS NOT NULL AND "provisioningStartedAt" < "submittedAt")`,
    );

    expect(Number(invalidas[0]?.total ?? 0n)).toBe(0);
  });

  it('toda solicitud con cuenta apunta a una cuenta del MISMO tenant', async (contexto: TestContext) => {
    if (diferir(contexto)) return;
    const huerfanas = await prisma.$queryRawUnsafe<Array<{ total: bigint }>>(
      `SELECT count(*)::bigint AS total
         FROM "access_request" r
        WHERE r."humanAccountId" IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM "human_account" a
             WHERE a."id" = r."humanAccountId"
               AND a."tenantId" = r."tenantId"
          )`,
    );

    expect(Number(huerfanas[0]?.total ?? 0n)).toBe(0);
  });
});
