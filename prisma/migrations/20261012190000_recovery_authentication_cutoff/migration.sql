ALTER TABLE "human_account"
  ADD COLUMN "authenticationNotBefore" timestamptz(6),
  ADD COLUMN "accessLifecycleVersion" integer NOT NULL DEFAULT 0,
  ADD CONSTRAINT "human_account_lifecycle_version_nonnegative" CHECK ("accessLifecycleVersion" >= 0);

ALTER TABLE "access_password_recovery"
  ADD COLUMN "expectedAccountVersion" integer NOT NULL DEFAULT 0,
  ADD CONSTRAINT "access_password_recovery_account_version_nonnegative" CHECK ("expectedAccountVersion" >= 0);
