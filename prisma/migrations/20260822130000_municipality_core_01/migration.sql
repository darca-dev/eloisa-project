-- ---------------------------------------------------------------------------
-- TASK-MUNICIPALITY-CORE-01 — migracion ADITIVA unica.
--
-- Contenido:
--   1. Valores nuevos en los enums de auditoria y dos enums institucionales.
--   2. Columnas nuevas y NULLABLE en `audit_event`, mas la relajacion de
--      `resourceId` a NULL para los eventos de ACCESO, que no crean recurso.
--   3. Identidad institucional minima y sesion institucional server-side.
--   4. Row Level Security, privilegios de minimo privilegio y coherencia de
--      tenant para las dos tablas nuevas.
--
-- Caracter: ADITIVO. No borra filas, no elimina tablas ni columnas, no cambia
-- ninguna migracion anterior de CORE-01 y no toca volumenes.
--
-- NO contiene ningun secreto: la credencial de la identidad institucional se
-- aprovisiona en ejecucion desde la configuracion del servidor y solo se
-- almacena su derivacion `scrypt`.
--
-- Rollback documentado: `prisma/migrations/ROLLBACK-municipality_core_01.sql`.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1. Enums
-- ---------------------------------------------------------------------------

ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'INSTITUTIONAL_SESSION_CREATED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'INSTITUTIONAL_SESSION_REVOKED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'MUNICIPAL_AGGREGATE_ACCESS_GRANTED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'MUNICIPAL_AGGREGATE_ACCESS_DENIED';

ALTER TYPE "AuditActorType" ADD VALUE IF NOT EXISTS 'INSTITUTIONAL_IDENTITY';
ALTER TYPE "AuditActorType" ADD VALUE IF NOT EXISTS 'UNAUTHENTICATED';

ALTER TYPE "AuditOutcome" ADD VALUE IF NOT EXISTS 'DENIED';

CREATE TYPE "InstitutionalRole" AS ENUM ('MUNICIPAL_VIEWER');

CREATE TYPE "InstitutionalIdentityStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- ---------------------------------------------------------------------------
-- 2. Auditoria: contexto institucional del evento
-- ---------------------------------------------------------------------------

-- Todas las columnas nuevas son NULLABLE: las filas ya registradas permanecen
-- validas e intactas. `audit_event` sigue siendo append-only.
ALTER TABLE "audit_event" ADD COLUMN "actorRole" "InstitutionalRole";
ALTER TABLE "audit_event" ADD COLUMN "endpoint" TEXT;
ALTER TABLE "audit_event" ADD COLUMN "correlationId" TEXT;

-- Un evento de ACCESO a una superficie agregada no crea ni modifica un recurso
-- identificable: `resourceId` pasa a admitir NULL. Es una RELAJACION, no una
-- perdida: ninguna fila existente cambia de valor.
ALTER TABLE "audit_event" ALTER COLUMN "resourceId" DROP NOT NULL;

-- Coherencia: solo los eventos de acceso pueden omitir el recurso.
ALTER TABLE "audit_event"
  ADD CONSTRAINT "audit_event_resource_required"
  CHECK (
    "resourceId" IS NOT NULL
    OR "eventType" IN ('MUNICIPAL_AGGREGATE_ACCESS_GRANTED', 'MUNICIPAL_AGGREGATE_ACCESS_DENIED')
  );

-- El rol solo acompana a un actor institucional.
ALTER TABLE "audit_event"
  ADD CONSTRAINT "audit_event_actor_role_scope"
  CHECK ("actorRole" IS NULL OR "actorType" = 'INSTITUTIONAL_IDENTITY');

-- ---------------------------------------------------------------------------
-- 3. Identidad y sesion institucional
-- ---------------------------------------------------------------------------

CREATE TABLE "institutional_identity" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "role" "InstitutionalRole" NOT NULL,
  "status" "InstitutionalIdentityStatus" NOT NULL DEFAULT 'ACTIVE',
  "accessSecretHash" TEXT NOT NULL,
  "accessSecretSalt" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "institutional_identity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "institutional_identity_tenant_code_unique"
  ON "institutional_identity" ("tenantId", "code");

CREATE UNIQUE INDEX "institutional_identity_id_tenant_unique"
  ON "institutional_identity" ("id", "tenantId");

CREATE INDEX "institutional_identity_tenantId_idx"
  ON "institutional_identity" ("tenantId");

ALTER TABLE "institutional_identity"
  ADD CONSTRAINT "institutional_identity_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- La credencial se guarda derivada, nunca en claro. La forma hexadecimal
-- impide almacenar por error un secreto legible.
ALTER TABLE "institutional_identity"
  ADD CONSTRAINT "institutional_identity_secret_shape"
  CHECK ("accessSecretHash" ~ '^[0-9a-f]{128}$' AND "accessSecretSalt" ~ '^[0-9a-f]{32}$');

CREATE TABLE "institutional_session" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "identityId" UUID NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMPTZ(6) NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastUsedAt" TIMESTAMPTZ(6),
  "revokedAt" TIMESTAMPTZ(6),

  CONSTRAINT "institutional_session_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "institutional_session_tokenHash_key"
  ON "institutional_session" ("tokenHash");

CREATE INDEX "institutional_session_tenantId_identityId_idx"
  ON "institutional_session" ("tenantId", "identityId");

CREATE INDEX "institutional_session_expiresAt_idx"
  ON "institutional_session" ("expiresAt");

ALTER TABLE "institutional_session"
  ADD CONSTRAINT "institutional_session_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Clave foranea COMPUESTA: una sesion nunca puede apuntar a una identidad de
-- otra institucion, aunque se conozca su identificador.
ALTER TABLE "institutional_session"
  ADD CONSTRAINT "institutional_session_identity_fkey"
  FOREIGN KEY ("identityId", "tenantId")
  REFERENCES "institutional_identity" ("id", "tenantId")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- El token en claro nunca se persiste: solo su SHA-256 hexadecimal.
ALTER TABLE "institutional_session"
  ADD CONSTRAINT "institutional_session_token_hash_shape"
  CHECK ("tokenHash" ~ '^[0-9a-f]{64}$');

ALTER TABLE "institutional_session"
  ADD CONSTRAINT "institutional_session_expires_after_created"
  CHECK ("expiresAt" > "createdAt");

-- ---------------------------------------------------------------------------
-- 4. Minimo privilegio y Row Level Security
-- ---------------------------------------------------------------------------

-- Sin DELETE en ninguna de las dos tablas: una sesion se REVOCA, no se borra,
-- para conservar trazabilidad historica.
GRANT SELECT, INSERT, UPDATE ON TABLE "institutional_identity" TO "merdn_runtime";
GRANT SELECT, INSERT, UPDATE ON TABLE "institutional_session"  TO "merdn_runtime";

ALTER TABLE "institutional_identity" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "institutional_session"  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "institutional_identity_tenant" ON "institutional_identity"
  FOR ALL TO "merdn_runtime"
  USING ("tenantId" = "merdn_current_tenant"())
  WITH CHECK ("tenantId" = "merdn_current_tenant"());

CREATE POLICY "institutional_session_tenant" ON "institutional_session"
  FOR ALL TO "merdn_runtime"
  USING ("tenantId" = "merdn_current_tenant"())
  WITH CHECK ("tenantId" = "merdn_current_tenant"());
