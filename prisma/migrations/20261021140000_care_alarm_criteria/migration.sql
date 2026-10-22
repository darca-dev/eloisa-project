-- ---------------------------------------------------------------------------
-- SPEC 055 / MP04 - Criterios individuales y alarmas automaticas.
--
-- Migracion ADITIVA sobre MP02–MP03. Crea:
--   1. Tres enums y dos valores de "AuditEventType".
--   2. care_alarm_criterion (identidad estable), care_alarm_criterion_version
--      (version inmutable con los valores que fija el visitador) y
--      care_alarm_evidence (que observacion admitio que version para que
--      alarma), todas colgadas del contexto por la FK de cuatro campos.
--   3. En care_alarm: version del criterio y episodio anterior, sus FK, y un
--      indice unico PARCIAL que impide en base dos alarmas automaticas abiertas
--      del mismo criterio (una alarma por episodio, D05).
--   4. Guardas: forma por tipo de dato, tiempos del servidor, una sola version
--      ACTIVE por criterio, inmutabilidad y append-only.
--   5. RLS + FORCE, politicas tenant + organizacion y privilegios minimos.
--
-- NO inserta filas ni precarga criterios, umbrales, ventanas ni severidades:
-- todos los valores los aporta el profesional competente. NO modifica tablas
-- de MP01 ni datos existentes.
-- ---------------------------------------------------------------------------

DO $preflight$
BEGIN
  IF to_regclass('public.care_alarm') IS NULL OR to_regclass('public.care_observation') IS NULL THEN
    RAISE EXCEPTION '055/MP04 preflight: faltan las tablas de MP02–MP03.';
  END IF;
  IF EXISTS (SELECT 1 FROM "care_alarm" WHERE "origin" = 'AUTOMATIC') THEN
    RAISE EXCEPTION '055/MP04 preflight: no puede haber alarmas automaticas antes del motor.';
  END IF;
END;
$preflight$;

-- ---------------------------------------------------------------------------
-- 1. Enums
-- ---------------------------------------------------------------------------

CREATE TYPE "CareCriterionComparator" AS ENUM ('EQ', 'NEQ', 'GT', 'GTE', 'LT', 'LTE', 'IN');
CREATE TYPE "CareCriterionStatus" AS ENUM ('ACTIVE', 'RETIRED');
CREATE TYPE "CareCriterionVersionStatus" AS ENUM ('ACTIVE', 'SUPERSEDED', 'RETIRED');

ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'CARE_CRITERION_VALIDATED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'CARE_CRITERION_RETIRED';

-- ---------------------------------------------------------------------------
-- 2. Tablas
-- ---------------------------------------------------------------------------

CREATE TABLE "care_alarm_criterion" (
  "id"                      UUID NOT NULL,
  "tenantId"                UUID NOT NULL,
  "organizationId"          UUID NOT NULL,
  "contextId"               UUID NOT NULL,
  "patientId"               UUID NOT NULL,
  "status"                  "CareCriterionStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdByHumanAccountId" UUID NOT NULL,
  "createdAt"               TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "retiredAt"               TIMESTAMPTZ(6),
  "retiredByHumanAccountId" UUID,
  "retiredReason"           TEXT,

  CONSTRAINT "care_alarm_criterion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "care_alarm_criterion_retirement_coherent" CHECK (
    ("status" = 'ACTIVE' AND "retiredAt" IS NULL AND "retiredByHumanAccountId" IS NULL AND "retiredReason" IS NULL)
    OR ("status" = 'RETIRED' AND "retiredAt" IS NOT NULL AND "retiredByHumanAccountId" IS NOT NULL
        AND char_length(btrim("retiredReason")) BETWEEN 1 AND 2000)
  )
);

CREATE UNIQUE INDEX "care_alarm_criterion_id_context_unique" ON "care_alarm_criterion" ("id", "contextId");
CREATE INDEX "care_alarm_criterion_lookup_idx"
  ON "care_alarm_criterion" ("tenantId", "organizationId", "contextId", "status");

CREATE TABLE "care_alarm_criterion_version" (
  "id"                        UUID NOT NULL,
  "tenantId"                  UUID NOT NULL,
  "organizationId"            UUID NOT NULL,
  "contextId"                 UUID NOT NULL,
  "patientId"                 UUID NOT NULL,
  "criterionId"               UUID NOT NULL,
  "version"                   INTEGER NOT NULL,
  "observableCode"            TEXT NOT NULL,
  "valueType"                 "CareObservableType" NOT NULL,
  "comparator"                "CareCriterionComparator" NOT NULL,
  "numberValue"               DECIMAL(30, 10),
  "booleanValue"              BOOLEAN,
  "choiceValues"              JSONB,
  "requiredCount"             INTEGER NOT NULL,
  "windowMinutes"             INTEGER NOT NULL,
  "severity"                  "CareAlarmSeverity" NOT NULL,
  "activatedAt"               TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "validUntil"                TIMESTAMPTZ(6),
  "status"                    "CareCriterionVersionStatus" NOT NULL DEFAULT 'ACTIVE',
  "supersededAt"              TIMESTAMPTZ(6),
  "validatedByHumanAccountId" UUID NOT NULL,
  "createdAt"                 TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "care_alarm_criterion_version_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "care_alarm_criterion_version_positive" CHECK ("version" > 0),
  CONSTRAINT "care_alarm_criterion_version_code_shape" CHECK ("observableCode" ~ '^[a-z0-9][a-z0-9_-]{0,47}$'),
  -- Limites TECNICOS, no clinicos: el visitador elige el valor dentro de ellos.
  CONSTRAINT "care_alarm_criterion_version_count_range" CHECK ("requiredCount" BETWEEN 1 AND 1000),
  CONSTRAINT "care_alarm_criterion_version_window_range" CHECK ("windowMinutes" BETWEEN 1 AND 525600),
  CONSTRAINT "care_alarm_criterion_version_validity_order"
    CHECK ("validUntil" IS NULL OR "validUntil" > "activatedAt"),
  -- Una comparacion estructurada por tipo de dato. Sin formulas.
  CONSTRAINT "care_alarm_criterion_version_shape" CHECK (
    (
      "valueType" = 'NUMBER'
      AND "comparator" IN ('EQ', 'NEQ', 'GT', 'GTE', 'LT', 'LTE')
      AND "numberValue" IS NOT NULL AND "booleanValue" IS NULL AND "choiceValues" IS NULL
    )
    OR (
      "valueType" = 'BOOLEAN'
      AND "comparator" = 'EQ'
      AND "booleanValue" IS NOT NULL AND "numberValue" IS NULL AND "choiceValues" IS NULL
    )
    OR (
      "valueType" = 'CHOICE'
      AND "comparator" = 'IN'
      AND "choiceValues" IS NOT NULL
      AND jsonb_typeof("choiceValues") = 'array'
      AND jsonb_array_length("choiceValues") BETWEEN 1 AND 100
      AND "numberValue" IS NULL AND "booleanValue" IS NULL
    )
  ),
  CONSTRAINT "care_alarm_criterion_version_status_coherent" CHECK (
    ("status" = 'ACTIVE' AND "supersededAt" IS NULL)
    OR ("status" IN ('SUPERSEDED', 'RETIRED') AND "supersededAt" IS NOT NULL)
  )
);

CREATE UNIQUE INDEX "care_alarm_criterion_version_unique"
  ON "care_alarm_criterion_version" ("criterionId", "version");
CREATE UNIQUE INDEX "care_alarm_criterion_version_id_context_unique"
  ON "care_alarm_criterion_version" ("id", "contextId");
CREATE INDEX "care_alarm_criterion_version_lookup_idx"
  ON "care_alarm_criterion_version" ("tenantId", "organizationId", "contextId", "status");
-- Una sola version ACTIVE por criterio.
CREATE UNIQUE INDEX "care_alarm_criterion_version_active_unique"
  ON "care_alarm_criterion_version" ("criterionId") WHERE "status" = 'ACTIVE';

CREATE TABLE "care_alarm_evidence" (
  "id"                 UUID NOT NULL,
  "tenantId"           UUID NOT NULL,
  "organizationId"     UUID NOT NULL,
  "contextId"          UUID NOT NULL,
  "patientId"          UUID NOT NULL,
  "alarmId"            UUID NOT NULL,
  "observationId"      UUID NOT NULL,
  "criterionVersionId" UUID NOT NULL,
  "createdAt"          TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "care_alarm_evidence_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "care_alarm_evidence_unique" ON "care_alarm_evidence" ("alarmId", "observationId");
CREATE INDEX "care_alarm_evidence_lookup_idx"
  ON "care_alarm_evidence" ("tenantId", "organizationId", "contextId", "observationId");

-- ---------------------------------------------------------------------------
-- 3. Episodios en care_alarm
-- ---------------------------------------------------------------------------

ALTER TABLE "care_alarm"
  ADD COLUMN "criterionVersionId" UUID,
  ADD COLUMN "previousAlarmId" UUID;

-- Automatica = criterio Y version; manual = ninguno de los dos.
ALTER TABLE "care_alarm"
  ADD CONSTRAINT "care_alarm_criterion_version_shape" CHECK (
    ("origin" = 'MANUAL' AND "criterionVersionId" IS NULL AND "previousAlarmId" IS NULL)
    OR ("origin" = 'AUTOMATIC' AND "criterionVersionId" IS NOT NULL)
  );

-- UNA alarma automatica abierta por criterio, sostenida por la base aunque el
-- criterio cambie de version.
CREATE UNIQUE INDEX "care_alarm_open_episode_unique"
  ON "care_alarm" ("criterionId")
  WHERE "origin" = 'AUTOMATIC' AND "state" <> 'CERRADA';

-- ---------------------------------------------------------------------------
-- 4. Claves foraneas
-- ---------------------------------------------------------------------------

ALTER TABLE "care_alarm_criterion"
  ADD CONSTRAINT "care_alarm_criterion_context_fkey"
  FOREIGN KEY ("contextId", "tenantId", "organizationId", "patientId")
  REFERENCES "patient_care_context" ("id", "tenantId", "organizationId", "patientId") ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "care_alarm_criterion_creator_fkey"
  FOREIGN KEY ("createdByHumanAccountId", "tenantId") REFERENCES "human_account" ("id", "tenantId") ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "care_alarm_criterion_retirer_fkey"
  FOREIGN KEY ("retiredByHumanAccountId", "tenantId") REFERENCES "human_account" ("id", "tenantId") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "care_alarm_criterion_version"
  ADD CONSTRAINT "care_alarm_criterion_version_context_fkey"
  FOREIGN KEY ("contextId", "tenantId", "organizationId", "patientId")
  REFERENCES "patient_care_context" ("id", "tenantId", "organizationId", "patientId") ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "care_alarm_criterion_version_criterion_fkey"
  FOREIGN KEY ("criterionId", "contextId") REFERENCES "care_alarm_criterion" ("id", "contextId") ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "care_alarm_criterion_version_validator_fkey"
  FOREIGN KEY ("validatedByHumanAccountId", "tenantId") REFERENCES "human_account" ("id", "tenantId") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "care_alarm_evidence"
  ADD CONSTRAINT "care_alarm_evidence_context_fkey"
  FOREIGN KEY ("contextId", "tenantId", "organizationId", "patientId")
  REFERENCES "patient_care_context" ("id", "tenantId", "organizationId", "patientId") ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "care_alarm_evidence_alarm_fkey"
  FOREIGN KEY ("alarmId", "contextId") REFERENCES "care_alarm" ("id", "contextId") ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "care_alarm_evidence_observation_fkey"
  FOREIGN KEY ("observationId", "contextId") REFERENCES "care_observation" ("id", "contextId") ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "care_alarm_evidence_version_fkey"
  FOREIGN KEY ("criterionVersionId", "contextId") REFERENCES "care_alarm_criterion_version" ("id", "contextId") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "care_alarm"
  ADD CONSTRAINT "care_alarm_criterion_fkey"
  FOREIGN KEY ("criterionId", "contextId") REFERENCES "care_alarm_criterion" ("id", "contextId") ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "care_alarm_criterion_version_fkey"
  FOREIGN KEY ("criterionVersionId", "contextId") REFERENCES "care_alarm_criterion_version" ("id", "contextId") ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "care_alarm_previous_fkey"
  FOREIGN KEY ("previousAlarmId", "contextId") REFERENCES "care_alarm" ("id", "contextId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- ---------------------------------------------------------------------------
-- 5. Guardas
-- ---------------------------------------------------------------------------

CREATE TRIGGER "care_alarm_criterion_server_times" BEFORE INSERT ON "care_alarm_criterion"
  FOR EACH ROW EXECUTE FUNCTION "merdn_care_server_times"();
CREATE TRIGGER "care_alarm_evidence_server_times" BEFORE INSERT ON "care_alarm_evidence"
  FOR EACH ROW EXECUTE FUNCTION "merdn_care_server_times"();

-- La activacion la fija la base: el criterio solo cuenta lo ocurrido despues.
CREATE OR REPLACE FUNCTION "merdn_care_criterion_version_times"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW."createdAt" := now();
  NEW."activatedAt" := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER "care_alarm_criterion_version_times" BEFORE INSERT ON "care_alarm_criterion_version"
  FOR EACH ROW EXECUTE FUNCTION "merdn_care_criterion_version_times"();

-- Una version solo deja de estar ACTIVE (reemplazada o retirada), una vez.
CREATE OR REPLACE FUNCTION "merdn_care_criterion_version_update_guard"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF (to_jsonb(NEW) - ARRAY['status', 'supersededAt']) IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['status', 'supersededAt'])
     OR OLD."status"::text <> 'ACTIVE' OR NEW."status"::text = 'ACTIVE' THEN
    RAISE EXCEPTION 'care_alarm_criterion_version: una version es inmutable; solo se reemplaza o retira.'
      USING ERRCODE = '42501';
  END IF;
  NEW."supersededAt" := clock_timestamp();
  RETURN NEW;
END;
$$;

CREATE TRIGGER "care_alarm_criterion_version_update_guard" BEFORE UPDATE ON "care_alarm_criterion_version"
  FOR EACH ROW EXECUTE FUNCTION "merdn_care_criterion_version_update_guard"();

-- Un criterio solo cambia para retirarse, una vez.
CREATE OR REPLACE FUNCTION "merdn_care_criterion_update_guard"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF (to_jsonb(NEW) - ARRAY['status', 'retiredAt', 'retiredByHumanAccountId', 'retiredReason'])
       IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['status', 'retiredAt', 'retiredByHumanAccountId', 'retiredReason'])
     OR OLD."status"::text <> 'ACTIVE' OR NEW."status"::text <> 'RETIRED' THEN
    RAISE EXCEPTION 'care_alarm_criterion: solo se admite retirarlo.' USING ERRCODE = '42501';
  END IF;
  NEW."retiredAt" := clock_timestamp();
  RETURN NEW;
END;
$$;

CREATE TRIGGER "care_alarm_criterion_update_guard" BEFORE UPDATE ON "care_alarm_criterion"
  FOR EACH ROW EXECUTE FUNCTION "merdn_care_criterion_update_guard"();

CREATE TRIGGER "care_alarm_evidence_append_only" BEFORE UPDATE OR DELETE ON "care_alarm_evidence"
  FOR EACH ROW EXECUTE FUNCTION "merdn_care_append_only"();
CREATE TRIGGER "care_alarm_criterion_delete_forbidden" BEFORE DELETE ON "care_alarm_criterion"
  FOR EACH ROW EXECUTE FUNCTION "merdn_care_append_only"();
CREATE TRIGGER "care_alarm_criterion_version_delete_forbidden" BEFORE DELETE ON "care_alarm_criterion_version"
  FOR EACH ROW EXECUTE FUNCTION "merdn_care_append_only"();

-- ---------------------------------------------------------------------------
-- 6. Auditoria: la familia CARE_* incluye los criterios
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
        'CARE_CRITERION_VALIDATED', 'CARE_CRITERION_RETIRED'
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
      )
    )
  );

-- ---------------------------------------------------------------------------
-- 7. Row Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE "care_alarm_criterion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "care_alarm_criterion" FORCE  ROW LEVEL SECURITY;
ALTER TABLE "care_alarm_criterion_version" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "care_alarm_criterion_version" FORCE  ROW LEVEL SECURITY;
ALTER TABLE "care_alarm_evidence" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "care_alarm_evidence" FORCE  ROW LEVEL SECURITY;

CREATE POLICY "care_alarm_criterion_scope" ON "care_alarm_criterion"
  FOR ALL TO "merdn_runtime"
  USING ("tenantId" = "merdn_current_tenant"() AND "organizationId" = "merdn_current_organization"())
  WITH CHECK ("tenantId" = "merdn_current_tenant"() AND "organizationId" = "merdn_current_organization"());

CREATE POLICY "care_alarm_criterion_version_scope" ON "care_alarm_criterion_version"
  FOR ALL TO "merdn_runtime"
  USING ("tenantId" = "merdn_current_tenant"() AND "organizationId" = "merdn_current_organization"())
  WITH CHECK ("tenantId" = "merdn_current_tenant"() AND "organizationId" = "merdn_current_organization"());

CREATE POLICY "care_alarm_evidence_scope" ON "care_alarm_evidence"
  FOR ALL TO "merdn_runtime"
  USING ("tenantId" = "merdn_current_tenant"() AND "organizationId" = "merdn_current_organization"())
  WITH CHECK ("tenantId" = "merdn_current_tenant"() AND "organizationId" = "merdn_current_organization"());

-- ---------------------------------------------------------------------------
-- 8. Privilegios minimos del runtime
-- ---------------------------------------------------------------------------

GRANT SELECT, INSERT ON TABLE "care_alarm_criterion"         TO "merdn_runtime";
GRANT SELECT, INSERT ON TABLE "care_alarm_criterion_version" TO "merdn_runtime";
GRANT SELECT, INSERT ON TABLE "care_alarm_evidence"          TO "merdn_runtime";

GRANT UPDATE ("status", "retiredAt", "retiredByHumanAccountId", "retiredReason")
  ON TABLE "care_alarm_criterion" TO "merdn_runtime";
GRANT UPDATE ("status", "supersededAt")
  ON TABLE "care_alarm_criterion_version" TO "merdn_runtime";

-- ---------------------------------------------------------------------------
-- 9. Postflight
-- ---------------------------------------------------------------------------

DO $postflight$
DECLARE
  v_bad text[];
BEGIN
  SELECT array_agg(c.relname ORDER BY c.relname) INTO v_bad
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public'
     AND c.relname IN ('care_alarm_criterion', 'care_alarm_criterion_version', 'care_alarm_evidence')
     AND NOT (c.relrowsecurity AND c.relforcerowsecurity);

  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION '055/MP04 postflight: RLS/FORCE ausente en: %', array_to_string(v_bad, ', ');
  END IF;

  IF EXISTS (SELECT 1 FROM "care_alarm_criterion") OR EXISTS (SELECT 1 FROM "care_alarm_criterion_version") THEN
    RAISE EXCEPTION '055/MP04 postflight: la migracion no debe crear criterios.';
  END IF;
END;
$postflight$;
