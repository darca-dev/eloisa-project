-- ---------------------------------------------------------------------------
-- SPEC 055 / MP05b - Administracion de permisos de cuidado por el gestor.
--
-- Decision del Product Owner del 2026-10-21 («Pantalla del gestor»): una cuenta
-- humana designada como gestor de una organizacion (OrganizationCareManager)
-- crea el contexto de cuidado de un paciente, declara competencias y concede o
-- revoca accesos, con referencia de autorizacion y auditoria. El primer gestor
-- se crea con un script controlado del servidor.
--
-- Migracion ADITIVA. Solo:
--   1. Siete valores de "AuditEventType" para la administracion.
--   2. INSERT y UPDATE de columnas de ciclo de vida para el runtime sobre las
--      tablas de MP01 que el gestor escribe. El trigger de revocacion de MP01
--      sigue impidiendo cualquier otro cambio, y los CHECK de forma por actor,
--      no autoconcesion y validador distinto siguen vigentes.
--   3. UPDATE de "version" en organization_care_manager, solo para poder
--      bloquear la fila del gestor con FOR SHARE.
--   4. Descubrimiento de las organizaciones que la PROPIA cuenta gestiona, con
--      el GUC de descubrimiento de MP02. Solo SELECT de metadatos.
--   5. El CHECK de auditoria admite la familia CARE_ADMIN_*.
--
-- NO crea organizaciones, gestores, contextos ni concesiones.
-- ---------------------------------------------------------------------------

DO $preflight$
BEGIN
  IF to_regclass('public.care_alarm_criterion') IS NULL THEN
    RAISE EXCEPTION '055/MP05b preflight: faltan las tablas de MP04.';
  END IF;
END;
$preflight$;

ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'CARE_ADMIN_MANAGER_PROVISIONED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'CARE_ADMIN_CONTEXT_CREATED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'CARE_ADMIN_GRANT_ISSUED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'CARE_ADMIN_GRANT_REVOKED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'CARE_ADMIN_COMPETENCE_ATTESTED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'CARE_ADMIN_COMPETENCE_REVOKED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'CARE_ADMIN_READ';

-- ---------------------------------------------------------------------------
-- Privilegios del runtime para la administracion
-- ---------------------------------------------------------------------------

GRANT INSERT ON TABLE "patient_care_context"            TO "merdn_runtime";
GRANT INSERT ON TABLE "care_authorization"              TO "merdn_runtime";
GRANT INSERT ON TABLE "clinical_competence_attestation" TO "merdn_runtime";

GRANT UPDATE ("status", "revokedAt") ON TABLE "care_authorization"              TO "merdn_runtime";
GRANT UPDATE ("status", "revokedAt") ON TABLE "clinical_competence_attestation" TO "merdn_runtime";
GRANT UPDATE ("version")             ON TABLE "organization_care_manager"       TO "merdn_runtime";

-- ---------------------------------------------------------------------------
-- Descubrimiento de las organizaciones gestionadas por la PROPIA cuenta
-- ---------------------------------------------------------------------------

CREATE POLICY "organization_care_manager_discovery" ON "organization_care_manager"
  FOR SELECT TO "merdn_runtime"
  USING (
    "tenantId" = "merdn_current_tenant"()
    AND "merdn_discovery_account"() IS NOT NULL
    AND "humanAccountId" = "merdn_discovery_account"()
  );

CREATE POLICY "organization_manager_discovery" ON "organization"
  FOR SELECT TO "merdn_runtime"
  USING (
    "tenantId" = "merdn_current_tenant"()
    AND "merdn_discovery_account"() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM "organization_care_manager" m
       WHERE m."organizationId" = "organization"."id"
         AND m."tenantId" = "organization"."tenantId"
         AND m."humanAccountId" = "merdn_discovery_account"()
    )
  );

-- ---------------------------------------------------------------------------
-- Auditoria: CARE_ADMIN_*. Actor humano, organizacion y recurso obligatorios,
-- salvo la lectura de administracion, que nombra la organizacion y no recurso.
-- ---------------------------------------------------------------------------

ALTER TABLE "audit_event" DROP CONSTRAINT "audit_event_care_context_scope";

ALTER TABLE "audit_event"
  ADD CONSTRAINT "audit_event_care_context_scope"
  CHECK (
    (
      "eventType"::text NOT IN (
        'CARE_CONTEXT_ACCESS_GRANTED', 'CARE_CONTEXT_ACCESS_DENIED',
        'CARE_OBSERVABLE_VALIDATED', 'CARE_RECORD_CREATED', 'CARE_RECORD_AMENDED',
        'CARE_ALARM_CREATED', 'CARE_ALARM_TRANSITIONED',
        'CARE_CRITERION_VALIDATED', 'CARE_CRITERION_RETIRED',
        'CARE_ADMIN_MANAGER_PROVISIONED', 'CARE_ADMIN_CONTEXT_CREATED',
        'CARE_ADMIN_GRANT_ISSUED', 'CARE_ADMIN_GRANT_REVOKED',
        'CARE_ADMIN_COMPETENCE_ATTESTED', 'CARE_ADMIN_COMPETENCE_REVOKED',
        'CARE_ADMIN_READ'
      )
      AND "organizationId" IS NULL
    )
    OR (
      "actorType" = 'HUMAN_ACCOUNT'
      AND "actorUserId" IS NOT NULL
      AND "actorRole" IS NULL
      AND "organizationId" IS NOT NULL
      AND (
        (
          "eventType"::text = 'CARE_CONTEXT_ACCESS_GRANTED'
          AND "resourceType" = 'CareContext'
          AND "outcome" = 'SUCCESS'
          AND "resourceId" IS NOT NULL
        )
        OR (
          "eventType"::text = 'CARE_CONTEXT_ACCESS_DENIED'
          AND "resourceType" = 'CareContext'
          AND "outcome" = 'DENIED'
          AND "resourceId" IS NULL
        )
        OR (
          "eventType"::text IN ('CARE_OBSERVABLE_VALIDATED', 'CARE_RECORD_CREATED', 'CARE_RECORD_AMENDED',
                                'CARE_ALARM_CREATED', 'CARE_ALARM_TRANSITIONED',
                                'CARE_CRITERION_VALIDATED', 'CARE_CRITERION_RETIRED')
          AND "outcome" = 'SUCCESS'
          AND "resourceId" IS NOT NULL
          AND "resourceType" IN ('CareObservableDefinition', 'CareRecord', 'CareRecordAmendment',
                                 'CareAlarm', 'CareAlarmTransition',
                                 'CareAlarmCriterion', 'CareAlarmCriterionVersion')
        )
        OR (
          "eventType"::text IN ('CARE_ADMIN_MANAGER_PROVISIONED', 'CARE_ADMIN_CONTEXT_CREATED',
                                'CARE_ADMIN_GRANT_ISSUED', 'CARE_ADMIN_GRANT_REVOKED',
                                'CARE_ADMIN_COMPETENCE_ATTESTED', 'CARE_ADMIN_COMPETENCE_REVOKED')
          AND "outcome" = 'SUCCESS'
          AND "resourceId" IS NOT NULL
          AND "resourceType" IN ('OrganizationCareManager', 'PatientCareContext', 'CareAuthorization',
                                 'ClinicalCompetenceAttestation')
        )
        OR (
          "eventType"::text = 'CARE_ADMIN_READ'
          AND "outcome" = 'SUCCESS'
          AND "resourceType" = 'CareOrganizationAdministration'
          AND "resourceId" IS NULL
        )
      )
    )
  );
