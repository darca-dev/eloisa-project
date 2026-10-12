-- 041: additive provenance, browser ownership and exact provider binding.
-- Historical rows remain TEST_DATA and receive no inferred owner or alias.
ALTER TYPE "AccessRequestSource" ADD VALUE 'SELF_REGISTRATION';

ALTER TABLE "access_request"
  ADD COLUMN "externalAuthIdentityId" UUID,
  ADD COLUMN "registrationAttemptTokenHash" TEXT,
  ADD COLUMN "registrationAttemptExpiresAt" TIMESTAMPTZ(6),
  ADD COLUMN "provisioningOperationId" UUID,
  ADD COLUMN "provisioningOperationExpiresAt" TIMESTAMPTZ(6);

ALTER TABLE "access_request"
  ADD CONSTRAINT "access_request_external_identity_account_tenant_fkey"
    FOREIGN KEY ("externalAuthIdentityId", "tenantId", "humanAccountId")
    REFERENCES "external_auth_identity" ("id", "tenantId", "humanAccountId")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "access_request_external_identity_requires_account"
    CHECK ("externalAuthIdentityId" IS NULL OR "humanAccountId" IS NOT NULL),
  ADD CONSTRAINT "access_request_registration_attempt_coherent"
    CHECK (("registrationAttemptTokenHash" IS NULL AND "registrationAttemptExpiresAt" IS NULL)
      OR ("registrationAttemptTokenHash" IS NOT NULL AND "registrationAttemptTokenHash" ~ '^[0-9a-f]{64}$' AND "registrationAttemptExpiresAt" IS NOT NULL
        AND "registrationAttemptExpiresAt" > "createdAt")),
  ADD CONSTRAINT "access_request_self_registration_requires_owner"
    CHECK ("source"::text <> 'SELF_REGISTRATION' OR
      ("registrationAttemptTokenHash" IS NOT NULL AND "registrationAttemptExpiresAt" IS NOT NULL)),
  ADD CONSTRAINT "access_request_provisioning_operation_coherent"
    CHECK (("provisioningOperationId" IS NULL AND "provisioningOperationExpiresAt" IS NULL)
      OR ("provisioningOperationId" IS NOT NULL AND "provisioningOperationExpiresAt" IS NOT NULL));
