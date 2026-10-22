#!/usr/bin/env node
/**
 * Provisión CONTROLADA del primer gestor de cuidado de una organización
 * (SPEC 055 / MP05b; decisión del Product Owner del 2026-10-21).
 *
 * Crea —o reutiliza, si ya existe con el mismo tipo— la organización indicada
 * dentro del tenant y nombra gestor a la cuenta humana ACTIVA de la persona
 * indicada. El EMISOR debe ser una cuenta con capacidad de Soporte de
 * Plataforma ACTIVA en ese tenant: el gestor nunca se nombra a sí mismo
 * (CHECK de MP01) y queda auditado como `CARE_ADMIN_MANAGER_PROVISIONED`.
 *
 * Reglas:
 * - La cadena administrativa se toma SOLO de `DATABASE_URL` del entorno; nunca
 *   se imprime, ni en errores.
 * - Todo ocurre en UNA transacción; con `--dry-run` se revierte al final.
 * - Los documentos se buscan por su valor NORMALIZADO exacto (el mismo que guarda
 *   la inscripción: cédula solo dígitos sin ceros iniciales; otros tipos en
 *   mayúsculas sin separadores). No se lista ni se crea ninguna persona.
 * - Ser gestor NO da acceso clínico: solo permite administrar en la pantalla de
 *   Hospital › Configuración.
 *
 * Uso:
 *   node scripts/care/provision-care-manager.mjs \
 *     --tenant-code merdn-mvp --organization-code hospital-central \
 *     --organization-name "Hospital Central" --organization-kind HOSPITAL \
 *     --manager-document CEDULA_CIUDADANIA:1234567 \
 *     --grantor-document CEDULA_CIUDADANIA:7654321 \
 *     --authorization-reference ACTA.2026-10-21.001 [--dry-run]
 */
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import pg from 'pg';

const DOCUMENT_TYPES = ['CEDULA_CIUDADANIA', 'CEDULA_EXTRANJERIA', 'PASAPORTE', 'PERMISO_PROTECCION_TEMPORAL', 'OTRO'];
const KINDS = ['HOSPITAL', 'PROVIDER'];
const REFERENCE = /^[A-Z0-9][A-Z0-9._:-]{2,99}$/u;
const CODE = /^[a-z0-9][a-z0-9-]{1,62}$/u;

export class ProvisionArgumentError extends Error {}

function documentArg(value, flag) {
  const [type, number] = String(value ?? '').split(':');
  if (!DOCUMENT_TYPES.includes(type) || typeof number !== 'string' || number.trim() === '' || number.length > 40) {
    throw new ProvisionArgumentError(`${flag} debe ser TIPO:NUMERO_NORMALIZADO`);
  }
  return { documentType: type, documentNumber: number.trim().toUpperCase() };
}

/** Lectura pura y estricta de argumentos. No toca la base. */
export function parseProvisionArgs(argv) {
  const allowed = new Set([
    '--tenant-code', '--organization-code', '--organization-name', '--organization-kind',
    '--manager-document', '--grantor-document', '--authorization-reference', '--dry-run',
  ]);
  const values = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (!allowed.has(flag)) throw new ProvisionArgumentError(`argumento no admitido: ${String(flag).slice(0, 40)}`);
    if (flag === '--dry-run') { values.set(flag, true); continue; }
    const value = argv[index + 1];
    if (value === undefined || value.startsWith('--')) throw new ProvisionArgumentError(`falta el valor de ${flag}`);
    if (values.has(flag)) throw new ProvisionArgumentError(`argumento repetido: ${flag}`);
    values.set(flag, value);
    index += 1;
  }

  const required = (flag) => {
    const value = values.get(flag);
    if (typeof value !== 'string' || value.trim() === '') throw new ProvisionArgumentError(`falta ${flag}`);
    return value.trim();
  };

  const organizationCode = required('--organization-code');
  if (!CODE.test(organizationCode)) throw new ProvisionArgumentError('--organization-code: minúsculas, números y guion');
  const organizationName = required('--organization-name');
  if (organizationName.length > 160) throw new ProvisionArgumentError('--organization-name: hasta 160 caracteres');
  const organizationKind = required('--organization-kind');
  if (!KINDS.includes(organizationKind)) throw new ProvisionArgumentError('--organization-kind: HOSPITAL o PROVIDER');
  const authorizationReference = required('--authorization-reference').toUpperCase();
  if (!REFERENCE.test(authorizationReference)) throw new ProvisionArgumentError('--authorization-reference no válida');

  const manager = documentArg(required('--manager-document'), '--manager-document');
  const grantor = documentArg(required('--grantor-document'), '--grantor-document');
  if (manager.documentType === grantor.documentType && manager.documentNumber === grantor.documentNumber) {
    throw new ProvisionArgumentError('el emisor y el gestor deben ser personas distintas');
  }

  return Object.freeze({
    tenantCode: required('--tenant-code'),
    organizationCode,
    organizationName,
    organizationKind,
    manager,
    grantor,
    authorizationReference,
    dryRun: values.get('--dry-run') === true,
  });
}

async function accountOf(client, tenantId, document, label) {
  const { rows } = await client.query(
    `SELECT a."id"
       FROM "person" p
       JOIN "human_account" a ON a."personId" = p."id" AND a."tenantId" = p."tenantId"
      WHERE p."tenantId" = $1 AND p."documentType"::text = $2 AND p."documentNumberNormalized" = $3
        AND a."status" = 'ACTIVE'`,
    [tenantId, document.documentType, document.documentNumber],
  );
  if (rows.length !== 1) throw new Error(`${label}: no hay una cuenta humana ACTIVA única con ese documento`);
  return rows[0].id;
}

export async function provision(args, connectionString) {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    await client.query('BEGIN');
    const tenant = await client.query(`SELECT "id" FROM "tenant" WHERE "code" = $1`, [args.tenantCode]);
    if (tenant.rows.length !== 1) throw new Error('el tenant no existe');
    const tenantId = tenant.rows[0].id;

    const grantorId = await accountOf(client, tenantId, args.grantor, 'emisor');
    const support = await client.query(
      `SELECT 1 FROM "platform_support_capability" WHERE "homeTenantId" = $1 AND "humanAccountId" = $2 AND "status" = 'ACTIVE'`,
      [tenantId, grantorId],
    );
    if (support.rows.length !== 1) throw new Error('el emisor no tiene capacidad de Soporte de Plataforma ACTIVA');

    const managerAccountId = await accountOf(client, tenantId, args.manager, 'gestor');

    let organization = await client.query(
      `SELECT "id", "kind"::text AS "kind" FROM "organization" WHERE "tenantId" = $1 AND "code" = $2 FOR UPDATE`,
      [tenantId, args.organizationCode],
    );
    let organizationCreated = false;
    if (organization.rows.length === 0) {
      organization = await client.query(
        `INSERT INTO "organization" ("id", "tenantId", "code", "displayName", "kind", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4::"OrganizationKind", now())
         RETURNING "id", "kind"::text AS "kind"`,
        [tenantId, args.organizationCode, args.organizationName, args.organizationKind],
      );
      organizationCreated = true;
    } else if (organization.rows[0].kind !== args.organizationKind) {
      throw new Error('la organización ya existe con otro tipo');
    }
    const organizationId = organization.rows[0].id;

    const existing = await client.query(
      `SELECT "id", "status"::text AS "status" FROM "organization_care_manager" WHERE "organizationId" = $1 AND "humanAccountId" = $2`,
      [organizationId, managerAccountId],
    );
    if (existing.rows.length === 1) {
      await client.query(args.dryRun ? 'ROLLBACK' : 'COMMIT');
      return { organizationId, organizationCreated, managerId: existing.rows[0].id, managerCreated: false, status: existing.rows[0].status, dryRun: args.dryRun };
    }

    const manager = await client.query(
      `INSERT INTO "organization_care_manager"
         ("id", "tenantId", "organizationId", "humanAccountId", "startsAt", "authorizationReference", "grantedByHumanAccountId")
       VALUES (gen_random_uuid(), $1, $2, $3, now(), $4, $5)
       RETURNING "id"`,
      [tenantId, organizationId, managerAccountId, args.authorizationReference, grantorId],
    );
    const managerId = manager.rows[0].id;

    await client.query(
      `INSERT INTO "audit_event"
         ("id", "tenantId", "organizationId", "eventType", "actorType", "actorUserId", "resourceType", "resourceId",
          "outcome", "endpoint", "correlationId", "occurredAt")
       VALUES (gen_random_uuid(), $1, $2, 'CARE_ADMIN_MANAGER_PROVISIONED', 'HUMAN_ACCOUNT', $3, 'OrganizationCareManager', $4,
               'SUCCESS', 'script:provision-care-manager', gen_random_uuid()::text, now())`,
      [tenantId, organizationId, grantorId, managerId],
    );

    await client.query(args.dryRun ? 'ROLLBACK' : 'COMMIT');
    return { organizationId, organizationCreated, managerId, managerCreated: true, status: 'ACTIVE', dryRun: args.dryRun };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    await client.end().catch(() => undefined);
  }
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const args = parseProvisionArgs(process.argv.slice(2));
    const connectionString = process.env.DATABASE_URL;
    if (typeof connectionString !== 'string' || connectionString.trim() === '') {
      throw new ProvisionArgumentError('defina DATABASE_URL (credencial administrativa) en el entorno');
    }
    const result = await provision(args, connectionString);
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    // Nunca se imprime la cadena de conexión ni la pila: solo el motivo acotado.
    const message = error instanceof Error ? error.message.replace(/postgres(ql)?:\/\/\S+/giu, '[dsn]') : 'error desconocido';
    process.stderr.write(`provision-care-manager: ${message.slice(0, 200)}\n`);
    process.exitCode = 1;
  }
}
