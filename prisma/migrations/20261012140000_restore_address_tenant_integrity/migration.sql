-- Restore the tenant boundary removed by schema drift in 20260919051156.
-- Validation fails if existing data is inconsistent; no rows are rewritten.
CREATE UNIQUE INDEX "territorial_unit_id_tenant_unique" ON "territorial_unit" ("id", "tenantId");
ALTER TABLE "patient_address" ADD CONSTRAINT "patient_address_local_unit_tenant_fkey"
  FOREIGN KEY ("localUnitId", "tenantId") REFERENCES "territorial_unit" ("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;
