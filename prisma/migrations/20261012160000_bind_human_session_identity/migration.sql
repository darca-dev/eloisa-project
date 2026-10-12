ALTER TABLE "human_session" ADD COLUMN "externalAuthIdentityId" UUID;
ALTER TABLE "human_session" ADD CONSTRAINT "human_session_external_identity_account_tenant_fkey"
  FOREIGN KEY ("externalAuthIdentityId", "tenantId", "humanAccountId")
  REFERENCES "external_auth_identity" ("id", "tenantId", "humanAccountId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- A confirmed first-administrator slot cannot be reset by the runtime role.
CREATE FUNCTION "protect_confirmed_institutional_administrator"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."status" = 'CONFIRMED' AND
    (NEW."status" IS DISTINCT FROM OLD."status"
     OR NEW."tenantId" IS DISTINCT FROM OLD."tenantId"
     OR NEW."experience" IS DISTINCT FROM OLD."experience"
     OR NEW."humanAccountId" IS DISTINCT FROM OLD."humanAccountId"
     OR NEW."externalAuthIdentityId" IS DISTINCT FROM OLD."externalAuthIdentityId"
     OR NEW."attemptTokenHash" IS DISTINCT FROM OLD."attemptTokenHash"
     OR NEW."confirmedAt" IS DISTINCT FROM OLD."confirmedAt") THEN
    RAISE EXCEPTION 'Confirmed institutional administrator registration is immutable';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "institutional_administrator_confirmation_immutable"
BEFORE UPDATE ON "institutional_administrator_registration"
FOR EACH ROW EXECUTE FUNCTION "protect_confirmed_institutional_administrator"();
