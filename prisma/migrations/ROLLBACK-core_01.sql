-- ---------------------------------------------------------------------------
-- TASK-MVP-CORE-01 — rollback documentado.
--
-- ESTE ARCHIVO NO SE EJECUTA AUTOMATICAMENTE. Prisma Migrate no aplica
-- migraciones inversas: revertir es una operacion deliberada y autorizada.
--
-- Alcance: deshace exactamente lo que crean las dos migraciones de CORE-01.
-- Como CORE-01 es la primera migracion de negocio del repositorio, revertirla
-- devuelve el esquema `public` al estado sin tablas de negocio de TASK-001.
--
-- ADVERTENCIA — OPERACION DESTRUCTIVA
-- Ejecutar este script ELIMINA todas las personas, pacientes, pertenencias
-- poblacionales, direcciones, consentimientos, sesiones y eventos de auditoria
-- almacenados. Requiere autorizacion expresa del Product Owner y, en cualquier
-- entorno con datos, respaldo previo verificado.
--
-- No elimina el volumen de PostgreSQL ni la base de datos: solo los objetos
-- creados por CORE-01.
--
-- Uso previsto (entorno de desarrollo o de pruebas):
--   docker compose exec -T postgres psql -U merdn_dev -d merdn_dev \
--     < prisma/migrations/ROLLBACK-core_01.sql
--
-- Despues de revertir, elimine tambien las filas correspondientes del registro
-- de migraciones de Prisma para que `prisma migrate deploy` vuelva a aplicarlas:
--   DELETE FROM "_prisma_migrations"
--    WHERE "migration_name" IN (
--      '20260821120000_core_01_init',
--      '20260821120100_core_01_reference_data',
--      '20260822120000_core_01_hardening'
--    );
-- ---------------------------------------------------------------------------

BEGIN;

-- La auditoria es append-only: su trigger rechaza DELETE y TRUNCATE incluso al
-- propietario. Revertir la migracion exige retirar antes esa proteccion, y por
-- eso este script es una operacion deliberada y autorizada, nunca automatica.
DROP TRIGGER IF EXISTS "audit_event_append_only_row" ON "audit_event";
DROP TRIGGER IF EXISTS "audit_event_append_only_truncate" ON "audit_event";
DROP TRIGGER IF EXISTS "patient_address_guard" ON "patient_address";
DROP TRIGGER IF EXISTS "territorial_unit_guard" ON "territorial_unit";

-- El orden respeta las claves foraneas; CASCADE cubre los indices y
-- restricciones dependientes creados por la migracion.
DROP TABLE IF EXISTS "audit_event" CASCADE;
DROP TABLE IF EXISTS "enrollment_session" CASCADE;
DROP TABLE IF EXISTS "consent_record" CASCADE;
DROP TABLE IF EXISTS "patient_address" CASCADE;
DROP TABLE IF EXISTS "patient_population_membership" CASCADE;
DROP TABLE IF EXISTS "patient" CASCADE;
DROP TABLE IF EXISTS "person" CASCADE;
DROP TABLE IF EXISTS "territorial_unit" CASCADE;
DROP TABLE IF EXISTS "tenant" CASCADE;

DROP TYPE IF EXISTS "AuditOutcome";
DROP TYPE IF EXISTS "AuditActorType";
DROP TYPE IF EXISTS "AuditEventType";
DROP TYPE IF EXISTS "ConsentType";
DROP TYPE IF EXISTS "AreaType";
DROP TYPE IF EXISTS "TerritorialUnitStatus";
DROP TYPE IF EXISTS "TerritorialUnitType";
DROP TYPE IF EXISTS "PopulationSource";
DROP TYPE IF EXISTS "PopulationType";
DROP TYPE IF EXISTS "PatientOrigin";
DROP TYPE IF EXISTS "PatientStatus";
DROP TYPE IF EXISTS "SexGenderCode";
DROP TYPE IF EXISTS "DocumentType";

DROP FUNCTION IF EXISTS "merdn_audit_event_append_only"();
DROP FUNCTION IF EXISTS "merdn_patient_address_guard"();
DROP FUNCTION IF EXISTS "merdn_territorial_unit_guard"();
DROP FUNCTION IF EXISTS "merdn_current_tenant"();

COMMIT;

-- El rol `merdn_runtime` es un objeto de CLUSTER, no de base de datos, y puede
-- estar en uso por otras bases. Se elimina por separado y solo si se desea:
--   REASSIGN OWNED BY "merdn_runtime" TO CURRENT_USER;
--   DROP OWNED BY "merdn_runtime";
--   DROP ROLE "merdn_runtime";
