-- 053: administrative declarations only. No seeds or changes to canonical data.
ALTER TYPE "AuditEventType" ADD VALUE 'MUNICIPAL_CONFIGURATION_READ';
ALTER TYPE "AuditEventType" ADD VALUE 'MUNICIPAL_CONFIGURATION_SAVED';
ALTER TYPE "AuditEventType" ADD VALUE 'MUNICIPAL_CONFIGURATION_DENIED';
CREATE TABLE "municipality_section_revision" (
  "id" UUID NOT NULL PRIMARY KEY,
  "tenantId" UUID NOT NULL REFERENCES "tenant"("id") ON DELETE RESTRICT,
  "section" TEXT NOT NULL CHECK ("section" IN ('institucion','programas','presupuesto','evidencias','furag','adres','cuidado','brechas','cuidadores','indicadores','reportes')),
  "version" INTEGER NOT NULL CHECK ("version" >= 1),
  "payloadSchemaVersion" INTEGER NOT NULL CHECK ("payloadSchemaVersion" = 1),
  "payload" JSONB NOT NULL CHECK (jsonb_typeof("payload") = 'array' AND jsonb_array_length("payload") <= 50 AND octet_length("payload"::text) <= 262144),
  "createdByHumanAccountId" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "municipality_section_revision_actor_tenant_fkey" FOREIGN KEY ("createdByHumanAccountId", "tenantId") REFERENCES "human_account"("id", "tenantId") ON DELETE RESTRICT,
  CONSTRAINT "municipality_section_revision_version_unique" UNIQUE ("tenantId", "section", "version")
);
ALTER TABLE "municipality_section_revision" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "municipality_section_revision" FORCE ROW LEVEL SECURITY;
CREATE POLICY "municipality_section_revision_tenant" ON "municipality_section_revision"
  FOR ALL TO "merdn_runtime"
  USING ("tenantId" = "merdn_current_tenant"())
  WITH CHECK ("tenantId" = "merdn_current_tenant"());
GRANT SELECT, INSERT ON "municipality_section_revision" TO "merdn_runtime";
