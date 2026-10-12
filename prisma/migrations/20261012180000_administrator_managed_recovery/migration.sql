ALTER TYPE "AuditEventType" ADD VALUE 'ACCESS_PASSWORD_RECOVERY_STARTED';
ALTER TYPE "AuditEventType" ADD VALUE 'ACCESS_PASSWORD_RECOVERY_SUCCEEDED';
ALTER TYPE "AuditEventType" ADD VALUE 'ACCESS_PASSWORD_RECOVERY_UNCERTAIN';
ALTER TYPE "AuditEventType" ADD VALUE 'ACCESS_PASSWORD_RECOVERY_SUPERSEDED';
ALTER TABLE "human_account" ADD COLUMN "passwordRecoveryBlocked" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "human_session" ADD COLUMN "freshAuthenticatedAt" TIMESTAMPTZ(6);
ALTER TABLE "human_auth_attempt"
  ADD COLUMN "freshAuthenticationRequestedAt" TIMESTAMPTZ(6),
  ADD COLUMN "stepUpSessionId" UUID,
  ADD COLUMN "stepUpHumanAccountId" UUID,
  ADD COLUMN "stepUpExternalIdentityId" UUID,
  ADD CONSTRAINT "human_auth_attempt_step_up_coherent" CHECK (
    ("freshAuthenticationRequestedAt" IS NULL AND "stepUpSessionId" IS NULL AND "stepUpHumanAccountId" IS NULL AND "stepUpExternalIdentityId" IS NULL) OR
    ("freshAuthenticationRequestedAt" IS NOT NULL AND "stepUpSessionId" IS NOT NULL AND "stepUpHumanAccountId" IS NOT NULL AND "stepUpExternalIdentityId" IS NOT NULL)),
  ADD CONSTRAINT "human_auth_attempt_step_up_account_fkey" FOREIGN KEY ("stepUpHumanAccountId", "tenantId") REFERENCES "human_account" ("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "human_auth_attempt_step_up_session_fkey" FOREIGN KEY ("stepUpSessionId", "stepUpHumanAccountId", "tenantId") REFERENCES "human_session" ("id", "humanAccountId", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "human_auth_attempt_step_up_identity_fkey" FOREIGN KEY ("stepUpExternalIdentityId", "tenantId", "stepUpHumanAccountId") REFERENCES "external_auth_identity" ("id", "tenantId", "humanAccountId") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "access_request_exact_identity_unique" ON "access_request" ("id", "tenantId", "humanAccountId", "externalAuthIdentityId");
CREATE TABLE "access_password_recovery" (
  "id" UUID PRIMARY KEY,
  "tenantId" UUID NOT NULL,
  "accessRequestId" UUID NOT NULL,
  "targetHumanAccountId" UUID NOT NULL,
  "externalAuthIdentityId" UUID NOT NULL,
  "actorHumanAccountId" UUID NOT NULL,
  "actorSessionId" UUID NOT NULL,
  "expectedVersion" INTEGER NOT NULL,
  "supportReference" TEXT NOT NULL,
  "identityVerified" BOOLEAN NOT NULL,
  "state" TEXT NOT NULL DEFAULT 'PENDING',
  "predecessorId" UUID,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMPTZ(6),
  CONSTRAINT "access_password_recovery_account_tenant_unique" UNIQUE ("id", "tenantId", "targetHumanAccountId"),
  CONSTRAINT "access_password_recovery_state_check" CHECK ("state" IN ('PENDING', 'SUCCEEDED', 'UNCERTAIN', 'SUPERSEDED')),
  CONSTRAINT "access_password_recovery_finished_check" CHECK (("state" = 'PENDING' AND "finishedAt" IS NULL) OR ("state" <> 'PENDING' AND "finishedAt" IS NOT NULL)),
  CONSTRAINT "access_password_recovery_verified_check" CHECK ("identityVerified" = true),
  CONSTRAINT "access_password_recovery_reference_check" CHECK ("supportReference" ~ '^[A-Za-z0-9][A-Za-z0-9_-]{5,63}$'),
  CONSTRAINT "access_password_recovery_version_check" CHECK ("expectedVersion" > 0),
  CONSTRAINT "access_password_recovery_distinct_actor_check" CHECK ("actorHumanAccountId" <> "targetHumanAccountId"),
  CONSTRAINT "access_password_recovery_distinct_predecessor_check" CHECK ("predecessorId" IS NULL OR "predecessorId" <> "id"),
  CONSTRAINT "access_password_recovery_tenant_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "access_password_recovery_request_identity_fkey" FOREIGN KEY ("accessRequestId", "tenantId", "targetHumanAccountId", "externalAuthIdentityId") REFERENCES "access_request" ("id", "tenantId", "humanAccountId", "externalAuthIdentityId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "access_password_recovery_target_fkey" FOREIGN KEY ("targetHumanAccountId", "tenantId") REFERENCES "human_account" ("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "access_password_recovery_actor_fkey" FOREIGN KEY ("actorHumanAccountId", "tenantId") REFERENCES "human_account" ("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "access_password_recovery_actor_session_fkey" FOREIGN KEY ("actorSessionId", "actorHumanAccountId", "tenantId") REFERENCES "human_session" ("id", "humanAccountId", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "access_password_recovery_predecessor_fkey" FOREIGN KEY ("predecessorId", "tenantId", "targetHumanAccountId") REFERENCES "access_password_recovery" ("id", "tenantId", "targetHumanAccountId") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "access_password_recovery_one_pending" ON "access_password_recovery" ("tenantId", "targetHumanAccountId") WHERE "state" = 'PENDING';
CREATE UNIQUE INDEX "access_password_recovery_one_successor" ON "access_password_recovery" ("predecessorId") WHERE "predecessorId" IS NOT NULL;
CREATE INDEX "access_password_recovery_request_created" ON "access_password_recovery" ("tenantId", "accessRequestId", "createdAt");
ALTER TABLE "access_password_recovery" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "access_password_recovery" FORCE ROW LEVEL SECURITY;
CREATE POLICY "access_password_recovery_tenant" ON "access_password_recovery"
  USING ("tenantId" = "merdn_current_tenant"()) WITH CHECK ("tenantId" = "merdn_current_tenant"());
GRANT SELECT, INSERT, UPDATE ON "access_password_recovery" TO "merdn_runtime";
