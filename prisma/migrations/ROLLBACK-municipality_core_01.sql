-- ---------------------------------------------------------------------------
-- ROLLBACK documentado de TASK-MUNICIPALITY-CORE-01.
--
-- NO se ejecuta automaticamente. Revertir esta migracion elimina la identidad
-- institucional minima y todas las sesiones institucionales registradas, y deja
-- sin superficie los dos endpoints municipales agregados.
--
-- NO toca ningun dato de CORE-01: personas, pacientes, pertenencias,
-- direcciones, consentimientos, sesiones de inscripcion y catalogo territorial
-- permanecen intactos.
--
-- Requiere autorizacion expresa del Product Owner y respaldo previo verificado
-- en cualquier entorno con datos.
-- ---------------------------------------------------------------------------

BEGIN;

-- 1. Sesiones e identidad institucional.
DROP POLICY IF EXISTS "institutional_session_tenant"  ON "institutional_session";
DROP POLICY IF EXISTS "institutional_identity_tenant" ON "institutional_identity";

DROP TABLE IF EXISTS "institutional_session";
DROP TABLE IF EXISTS "institutional_identity";

DROP TYPE IF EXISTS "InstitutionalIdentityStatus";

-- 2. Auditoria.
--
-- `audit_event."actorRole"` usa el tipo "InstitutionalRole": la columna debe
-- retirarse ANTES que el tipo.
ALTER TABLE "audit_event" DROP CONSTRAINT IF EXISTS "audit_event_actor_role_scope";
ALTER TABLE "audit_event" DROP CONSTRAINT IF EXISTS "audit_event_resource_required";

ALTER TABLE "audit_event" DROP COLUMN IF EXISTS "correlationId";
ALTER TABLE "audit_event" DROP COLUMN IF EXISTS "endpoint";
ALTER TABLE "audit_event" DROP COLUMN IF EXISTS "actorRole";

DROP TYPE IF EXISTS "InstitutionalRole";

-- 3. `resourceId` vuelve a ser obligatoria SOLO si no quedan eventos de acceso.
--
-- `audit_event` es append-only y su trigger rechaza DELETE incluso al
-- propietario: los eventos de acceso ya registrados NO pueden retirarse. Si
-- existen, esta sentencia falla de forma explicita y la columna debe quedarse
-- como NULLABLE, que es inocuo. No se inventa un valor para completarlos.
ALTER TABLE "audit_event" ALTER COLUMN "resourceId" SET NOT NULL;

-- 4. Los valores anadidos a "AuditEventType", "AuditActorType" y "AuditOutcome"
--    NO se retiran: PostgreSQL no admite eliminar un valor de un enum y los
--    eventos ya registrados los utilizan. Su permanencia es inocua.

COMMIT;
