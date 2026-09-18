import {
  AUDIT_ENDPOINT,
  AUDIT_RESOURCE,
  type OperationOutcome,
} from './contract.ts';
import { type SqlRunner } from './database.ts';
import { fingerprint, uuidV7 } from './identifiers.ts';
import {
  type DisableAccountOperation,
  type LinkOperation,
  type ProvisioningOperation,
  type UnlinkOperation,
} from './parse.ts';

/**
 * Operaciones materiales del aprovisionamiento de identidad
 * (IDENTITY-RELATIONSHIPS-CORE-01 §9, continuación §4.2).
 *
 * TRES OPERACIONES Y NINGUNA MÁS. Cada una se ejecuta ENTERA dentro de la
 * transacción que le abre el llamador, junto a su evento de auditoría: no puede
 * quedar un vínculo creado sin traza, ni una cuenta deshabilitada cuyas sesiones
 * sigan vivas.
 *
 * IDEMPOTENCIA POR `(tenantId, issuer, subject)`. Repetir un archivo ya
 * aplicado devuelve `UNCHANGED` y no escribe. Es la propiedad que permite
 * volver a ejecutar un aprovisionamiento sin miedo tras una interrupción.
 *
 * CONFLICTO SIN ESCRITURA PARCIAL. Un `(issuer, subject)` ya vinculado a OTRA
 * `Person` devuelve `CONFLICT` y la transacción se revierte completa: la
 * identidad externa NO se reasigna. Reasignarla en silencio entregaría a una
 * persona la sesión de otra.
 *
 * ATRIBUCIÓN. Todos los eventos llevan `actorType = SYSTEM`, sin actor y sin
 * rol: el aprovisionamiento es un proceso administrativo y no se finge que sea
 * una persona.
 *
 * LO QUE NUNCA SE ESCRIBE NI SE IMPRIME: emisor, `subject`, claims, nombres,
 * documentos, contacto, tokens ni secretos. La correlación visible es una
 * huella corta e irreversible.
 */

/** Resultado de una operación, ya listo para imprimirse sin filtrar nada. */
export interface OperationResult {
  readonly outcome: OperationOutcome;
  /** Explicación técnica breve. Nunca contiene valores del archivo. */
  readonly detail: string;
  /** Huella corta del par emisor/`subject`, o `null` en `DISABLE_ACCOUNT`. */
  readonly identityFingerprint: string | null;
  /** Cuenta humana OPACA afectada, cuando la operación resolvió alguna. */
  readonly humanAccountId: string | null;
  /** Sesiones humanas revocadas por la operación. */
  readonly revokedSessions: number;
}

interface BindingRow {
  readonly id: string;
  readonly status: string;
  readonly humanAccountId: string;
  readonly personId: string;
  readonly accountStatus: string;
}

/** Ejecuta la operación indicada dentro de la transacción ya preparada. */
export async function runOperation(
  sql: SqlRunner,
  tenantId: string,
  operation: ProvisioningOperation,
  correlationId: string,
): Promise<OperationResult> {
  switch (operation.action) {
    case 'LINK':
      return runLink(sql, tenantId, operation, correlationId);
    case 'UNLINK':
      return runUnlink(sql, tenantId, operation, correlationId);
    case 'DISABLE_ACCOUNT':
      return runDisableAccount(sql, tenantId, operation, correlationId);
  }
}

/**
 * Vincula un `subject` verificado con una `Person` que YA existe.
 *
 * Cuatro desenlaces, y solo cuatro:
 *
 * 1. no hay vínculo: se crea UNA `HumanAccount` y su vínculo en la misma
 *    transacción. Que una persona pueda tener varias cuentas está aprobado de
 *    forma expresa, de modo que no se reutiliza ninguna existente;
 * 2. hay vínculo ACTIVO con la MISMA persona: `UNCHANGED`, sin escritura;
 * 3. hay vínculo DESVINCULADO con la MISMA persona: se reactiva. NO se toca el
 *    estado de la cuenta: si estaba deshabilitada, sigue deshabilitada, porque
 *    `DISABLE_ACCOUNT` es explícito y este comando no tiene operación inversa;
 * 4. hay vínculo con OTRA persona: `CONFLICT` y cero cambios.
 */
async function runLink(
  sql: SqlRunner,
  tenantId: string,
  operation: LinkOperation,
  correlationId: string,
): Promise<OperationResult> {
  const marca = fingerprint(operation.issuer, operation.subject);

  const persons = await sql.query<{ id: string }>(
    'SELECT "id" FROM "person" WHERE "id" = $1::uuid AND "tenantId" = $2::uuid',
    [operation.personId, tenantId],
  );

  if (persons.length === 0) {
    return {
      outcome: 'NOT_FOUND',
      detail: 'la persona indicada no existe en este tenant',
      identityFingerprint: marca,
      humanAccountId: null,
      revokedSessions: 0,
    };
  }

  const existing = await findBinding(sql, tenantId, operation.issuer, operation.subject);

  if (existing !== null) {
    if (existing.personId !== operation.personId) {
      /*
       * El mensaje NO nombra a la otra persona ni a su cuenta: confirmar a quién
       * pertenece un `subject` ajeno permitiría reconstruir vínculos probando
       * identificadores.
       */
      return {
        outcome: 'CONFLICT',
        detail: 'la identidad externa ya está vinculada a otra persona',
        identityFingerprint: marca,
        humanAccountId: null,
        revokedSessions: 0,
      };
    }

    if (existing.status === 'ACTIVE') {
      return {
        outcome: 'UNCHANGED',
        detail: 'el vínculo ya existe y está activo',
        identityFingerprint: marca,
        humanAccountId: existing.humanAccountId,
        revokedSessions: 0,
      };
    }

    await lockAccount(sql, tenantId, existing.humanAccountId);

    await sql.query(
      `UPDATE "external_auth_identity"
          SET "status" = 'ACTIVE', "unlinkedAt" = NULL, "linkedAt" = now(), "updatedAt" = now()
        WHERE "id" = $1::uuid AND "tenantId" = $2::uuid AND "status" = 'UNLINKED'`,
      [existing.id, tenantId],
    );

    await writeAudit(sql, tenantId, correlationId, {
      eventType: 'HUMAN_IDENTITY_LINKED',
      resourceType: AUDIT_RESOURCE.binding,
      resourceId: existing.id,
    });

    return {
      outcome: 'APPLIED',
      detail: 'vínculo previamente desvinculado reactivado sobre la misma persona',
      identityFingerprint: marca,
      humanAccountId: existing.humanAccountId,
      revokedSessions: 0,
    };
  }

  const accountId = uuidV7();
  const bindingId = uuidV7();

  await sql.query(
    `INSERT INTO "human_account"
       ("id", "tenantId", "personId", "status", "createdAt", "updatedAt")
     VALUES ($1::uuid, $2::uuid, $3::uuid, 'ACTIVE', now(), now())`,
    [accountId, tenantId, operation.personId],
  );

  /*
   * El índice único `(tenantId, issuer, subject)` es la barrera FINAL contra dos
   * aprovisionamientos simultáneos del mismo `subject`: si otro proceso lo
   * insertó entre la consulta anterior y esta escritura, la inserción falla y la
   * transacción entera se revierte, sin dejar una cuenta huérfana.
   */
  await sql.query(
    `INSERT INTO "external_auth_identity"
       ("id", "tenantId", "humanAccountId", "issuer", "subject", "status",
        "linkedAt", "createdAt", "updatedAt")
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, 'ACTIVE', now(), now(), now())`,
    [bindingId, tenantId, accountId, operation.issuer, operation.subject],
  );

  await writeAudit(sql, tenantId, correlationId, {
    eventType: 'HUMAN_IDENTITY_LINKED',
    resourceType: AUDIT_RESOURCE.binding,
    resourceId: bindingId,
  });

  return {
    outcome: 'APPLIED',
    detail: 'cuenta humana y vínculo creados',
    identityFingerprint: marca,
    humanAccountId: accountId,
    revokedSessions: 0,
  };
}

/**
 * Desvincula una identidad externa y cierra el acceso de inmediato.
 *
 * La fila NO se borra: pasa a `UNLINKED` y conserva su historia. Las sesiones
 * humanas vivas de esa cuenta se revocan en la MISMA transacción, de modo que
 * no queda una sesión que sobreviva a la desvinculación.
 */
async function runUnlink(
  sql: SqlRunner,
  tenantId: string,
  operation: UnlinkOperation,
  correlationId: string,
): Promise<OperationResult> {
  const marca = fingerprint(operation.issuer, operation.subject);
  const existing = await findBinding(sql, tenantId, operation.issuer, operation.subject);

  if (existing === null) {
    return {
      outcome: 'NOT_FOUND',
      detail: 'no existe el vínculo indicado en este tenant',
      identityFingerprint: marca,
      humanAccountId: null,
      revokedSessions: 0,
    };
  }

  await lockAccount(sql, tenantId, existing.humanAccountId);

  if (existing.status !== 'ACTIVE') {
    return {
      outcome: 'UNCHANGED',
      detail: 'el vínculo ya estaba desvinculado',
      identityFingerprint: marca,
      humanAccountId: existing.humanAccountId,
      revokedSessions: 0,
    };
  }

  await sql.query(
    `UPDATE "external_auth_identity"
        SET "status" = 'UNLINKED', "unlinkedAt" = now(), "updatedAt" = now()
      WHERE "id" = $1::uuid AND "tenantId" = $2::uuid AND "status" = 'ACTIVE'`,
    [existing.id, tenantId],
  );

  await writeAudit(sql, tenantId, correlationId, {
    eventType: 'HUMAN_IDENTITY_UNLINKED',
    resourceType: AUDIT_RESOURCE.binding,
    resourceId: existing.id,
  });

  const revoked = await revokeSessions(
    sql,
    tenantId,
    existing.humanAccountId,
    correlationId,
  );

  return {
    outcome: 'APPLIED',
    detail: 'vínculo desvinculado y sesiones vivas revocadas',
    identityFingerprint: marca,
    humanAccountId: existing.humanAccountId,
    revokedSessions: revoked,
  };
}

/**
 * Deshabilita una cuenta humana.
 *
 * Cierra el acceso de forma inmediata: el estado deja de ser `ACTIVE` y las
 * sesiones vivas se revocan en la misma transacción. Los vínculos se CONSERVAN
 * tal como estaban: deshabilitar no es desvincular, y confundir las dos
 * operaciones haría irreversible lo que no debe serlo.
 */
async function runDisableAccount(
  sql: SqlRunner,
  tenantId: string,
  operation: DisableAccountOperation,
  correlationId: string,
): Promise<OperationResult> {
  const accounts = await lockAccount(sql, tenantId, operation.humanAccountId);

  if (accounts === null) {
    return {
      outcome: 'NOT_FOUND',
      detail: 'no existe la cuenta humana indicada en este tenant',
      identityFingerprint: null,
      humanAccountId: null,
      revokedSessions: 0,
    };
  }

  if (accounts.status !== 'ACTIVE') {
    /*
     * Idempotente, pero NO inerte: una cuenta ya deshabilitada con una sesión
     * viva es exactamente el estado que hay que cerrar, y dejarlo pasar
     * convertiría la repetición del comando en una falsa tranquilidad.
     */
    const revoked = await revokeSessions(
      sql,
      tenantId,
      operation.humanAccountId,
      correlationId,
    );

    return {
      outcome: revoked > 0 ? 'APPLIED' : 'UNCHANGED',
      detail:
        revoked > 0
          ? 'la cuenta ya estaba deshabilitada; se revocaron sesiones vivas residuales'
          : 'la cuenta ya estaba deshabilitada y no tenía sesiones vivas',
      identityFingerprint: null,
      humanAccountId: operation.humanAccountId,
      revokedSessions: revoked,
    };
  }

  await sql.query(
    `UPDATE "human_account"
        SET "status" = 'DISABLED', "updatedAt" = now()
      WHERE "id" = $1::uuid AND "tenantId" = $2::uuid AND "status" = 'ACTIVE'`,
    [operation.humanAccountId, tenantId],
  );

  await writeAudit(sql, tenantId, correlationId, {
    eventType: 'HUMAN_ACCOUNT_DISABLED',
    resourceType: AUDIT_RESOURCE.account,
    resourceId: operation.humanAccountId,
  });

  const revoked = await revokeSessions(
    sql,
    tenantId,
    operation.humanAccountId,
    correlationId,
  );

  return {
    outcome: 'APPLIED',
    detail: 'cuenta deshabilitada y sesiones vivas revocadas',
    identityFingerprint: null,
    humanAccountId: operation.humanAccountId,
    revokedSessions: revoked,
  };
}

/** Vínculo EXACTO por `(tenantId, issuer, subject)`, con su cuenta. */
async function findBinding(
  sql: SqlRunner,
  tenantId: string,
  issuer: string,
  subject: string,
): Promise<BindingRow | null> {
  const rows = await sql.query<BindingRow>(
    `SELECT v."id"                AS "id",
            v."status"::text      AS "status",
            v."humanAccountId"    AS "humanAccountId",
            c."personId"          AS "personId",
            c."status"::text      AS "accountStatus"
       FROM "external_auth_identity" v
       JOIN "human_account" c
         ON c."id" = v."humanAccountId" AND c."tenantId" = v."tenantId"
      WHERE v."tenantId" = $1::uuid AND v."issuer" = $2 AND v."subject" = $3`,
    [tenantId, issuer, subject],
  );

  return rows[0] ?? null;
}

/**
 * Bloquea la fila de la cuenta dentro de la transacción.
 *
 * Es el MISMO mecanismo que serializa dos inicios de sesión concurrentes en la
 * API: sin él, una desvinculación y un `callback` simultáneos podrían cruzarse
 * y dejar viva una sesión creada justo después de revocar las anteriores.
 */
async function lockAccount(
  sql: SqlRunner,
  tenantId: string,
  humanAccountId: string,
): Promise<{ readonly status: string } | null> {
  const rows = await sql.query<{ status: string }>(
    `SELECT "status"::text AS "status"
       FROM "human_account"
      WHERE "id" = $1::uuid AND "tenantId" = $2::uuid
      FOR UPDATE`,
    [humanAccountId, tenantId],
  );

  return rows[0] ?? null;
}

/** Revoca toda sesión viva de la cuenta y audita cada revocación. */
async function revokeSessions(
  sql: SqlRunner,
  tenantId: string,
  humanAccountId: string,
  correlationId: string,
): Promise<number> {
  const revoked = await sql.query<{ id: string }>(
    `UPDATE "human_session"
        SET "revokedAt" = now()
      WHERE "tenantId" = $1::uuid
        AND "humanAccountId" = $2::uuid
        AND "revokedAt" IS NULL
      RETURNING "id"`,
    [tenantId, humanAccountId],
  );

  for (const session of revoked) {
    await writeAudit(sql, tenantId, correlationId, {
      eventType: 'HUMAN_SESSION_REVOKED',
      resourceType: AUDIT_RESOURCE.session,
      resourceId: session.id,
    });
  }

  return revoked.length;
}

/**
 * Escribe el evento de auditoría dentro de la MISMA transacción.
 *
 * `SYSTEM` sin actor y sin rol: el aprovisionamiento no es una persona. El
 * recurso es siempre un identificador OPACO —vínculo, cuenta o sesión— y jamás
 * el emisor, el `subject` ni ningún dato personal.
 */
async function writeAudit(
  sql: SqlRunner,
  tenantId: string,
  correlationId: string,
  event: {
    readonly eventType: string;
    readonly resourceType: string;
    readonly resourceId: string;
  },
): Promise<void> {
  await sql.query(
    `INSERT INTO "audit_event"
       ("id", "tenantId", "eventType", "actorType", "actorUserId", "actorRole",
        "resourceType", "resourceId", "outcome", "endpoint", "correlationId", "occurredAt")
     VALUES ($1::uuid, $2::uuid, $3::"AuditEventType", 'SYSTEM', NULL, NULL,
             $4, $5::uuid, 'SUCCESS', $6, $7, now())`,
    [
      uuidV7(),
      tenantId,
      event.eventType,
      event.resourceType,
      event.resourceId,
      AUDIT_ENDPOINT,
      correlationId,
    ],
  );
}
