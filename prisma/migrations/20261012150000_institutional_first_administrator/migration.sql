ALTER TYPE "AuditEventType" ADD VALUE 'INSTITUTIONAL_ADMINISTRATION_RESERVED';
ALTER TYPE "AuditEventType" ADD VALUE 'INSTITUTIONAL_ADMINISTRATION_CONFIRMED';
ALTER TYPE "AuditEventType" ADD VALUE 'INSTITUTIONAL_ADMINISTRATION_FAILED';
ALTER TYPE "AuditEventType" ADD VALUE 'INSTITUTIONAL_ADMINISTRATION_DENIED';
CREATE TYPE "InstitutionalExperience" AS ENUM ('HOSPITAL', 'MUNICIPALITY');
CREATE TYPE "InstitutionalAdministratorRegistrationStatus" AS ENUM ('RESERVED', 'CONFIRMED');
CREATE UNIQUE INDEX "external_auth_identity_account_tenant_unique"
  ON "external_auth_identity" ("id", "tenantId", "humanAccountId");
CREATE TABLE "institutional_administrator_registration" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "experience" "InstitutionalExperience" NOT NULL,
  "status" "InstitutionalAdministratorRegistrationStatus" NOT NULL DEFAULT 'RESERVED',
  "attemptTokenHash" TEXT NOT NULL,
  "humanAccountId" UUID NOT NULL,
  "externalAuthIdentityId" UUID,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "confirmedAt" TIMESTAMPTZ(6),
  CONSTRAINT "institutional_administrator_registration_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "institutional_administrator_attempt_hash_check" CHECK ("attemptTokenHash" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "institutional_administrator_confirmation_check" CHECK (
    ("status" = 'RESERVED' AND "confirmedAt" IS NULL AND "externalAuthIdentityId" IS NULL) OR
    ("status" = 'CONFIRMED' AND "confirmedAt" IS NOT NULL AND "externalAuthIdentityId" IS NOT NULL)),
  CONSTRAINT "institutional_administrator_tenant_fkey" FOREIGN KEY ("tenantId")
    REFERENCES "tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "institutional_administrator_account_tenant_fkey" FOREIGN KEY ("humanAccountId", "tenantId")
    REFERENCES "human_account" ("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "institutional_administrator_external_account_tenant_fkey"
    FOREIGN KEY ("externalAuthIdentityId", "tenantId", "humanAccountId")
    REFERENCES "external_auth_identity" ("id", "tenantId", "humanAccountId") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "institutional_administrator_tenant_experience_unique"
  ON "institutional_administrator_registration" ("tenantId", "experience");
CREATE UNIQUE INDEX "institutional_administrator_id_tenant_unique"
  ON "institutional_administrator_registration" ("id", "tenantId");
CREATE INDEX "institutional_administrator_registration_tenantId_humanAccountId_idx"
  ON "institutional_administrator_registration" ("tenantId", "humanAccountId");
ALTER TABLE "institutional_administrator_registration" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "institutional_administrator_registration" FORCE ROW LEVEL SECURITY;
CREATE POLICY "institutional_administrator_registration_tenant" ON "institutional_administrator_registration"
  FOR ALL TO "merdn_runtime"
  USING ("tenantId" = "merdn_current_tenant"())
  WITH CHECK ("tenantId" = "merdn_current_tenant"());
GRANT SELECT, INSERT, UPDATE ON "institutional_administrator_registration" TO "merdn_runtime";
ALTER TABLE "institutional_identity"
  ALTER COLUMN "accessSecretHash" DROP NOT NULL,
  ALTER COLUMN "accessSecretSalt" DROP NOT NULL,
  ADD COLUMN "administratorRegistrationId" UUID,
  ADD CONSTRAINT "institutional_identity_administrator_tenant_fkey"
    FOREIGN KEY ("administratorRegistrationId", "tenantId")
    REFERENCES "institutional_administrator_registration" ("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "institutional_identity_credential_kind_check" CHECK (
    ("administratorRegistrationId" IS NULL AND "accessSecretHash" IS NOT NULL AND "accessSecretSalt" IS NOT NULL) OR
    ("administratorRegistrationId" IS NOT NULL AND "accessSecretHash" IS NULL AND "accessSecretSalt" IS NULL));
CREATE UNIQUE INDEX "institutional_identity_administrator_role_unique"
  ON "institutional_identity" ("administratorRegistrationId", "role");
