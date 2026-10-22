-- ---------------------------------------------------------------------------
-- SPEC 055 / MP02–MP03 - Bitacoras persistentes y alarmas manuales.
--
-- Migracion ADITIVA sobre la custodia de MP01. Crea:
--   1. Siete enums y seis valores nuevos de "AuditEventType".
--   2. Siete tablas colgadas de patient_care_context por la FK de cuatro campos
--      (contexto, tenant, organizacion, paciente): definiciones versionadas de
--      observables, registros, observaciones, enmiendas, alarmas, transiciones
--      y recibos de idempotencia.
--   3. Guardas: recepcion fijada por la base, ocurrencia no futura, valor
--      coherente con el tipo, canonica del mismo observable, append-only en
--      registros/observaciones/enmiendas/transiciones/recibos, retiro como
--      unico cambio de una definicion y ciclo de vida acotado de la alarma.
--   4. ENABLE + FORCE RLS con politicas tenant + organizacion, y un
--      DIRECTORIO de contextos propios bajo un GUC de cuenta fijado por el
--      servidor: solo SELECT de metadatos de las concesiones de esa cuenta y de
--      los contextos de su propio paciente. No abre contenido.
--   5. Ampliacion del CHECK de auditoria a las mutaciones CARE_*.
--   6. Privilegios minimos del runtime: SELECT/INSERT y UPDATE solo de las
--      columnas de ciclo de vida. Ningun DELETE.
--
-- NO inserta filas, NO crea catalogo clinico (motivos, observables, umbrales)
-- y NO modifica politicas, triggers ni tablas de MP01 salvo el CHECK de
-- auditoria, que se reemplaza por uno que admite la nueva familia.
--
-- Los valores nuevos de enum no se USAN en esta transaccion: los CHECK
-- comparan "eventType"::text.
-- ---------------------------------------------------------------------------

DO $preflight$
BEGIN
  IF to_regclass('public.patient_care_context') IS NULL THEN
    RAISE EXCEPTION '055/MP02 preflight: falta la custodia de MP01.';
  END IF;
  IF to_regprocedure('public.merdn_current_organization()') IS NULL THEN
    RAISE EXCEPTION '055/MP02 preflight: falta merdn_current_organization().';
  END IF;
END;
$preflight$;

-- ---------------------------------------------------------------------------
-- 1. Enums
-- ---------------------------------------------------------------------------

CREATE TYPE "CareObservableType" AS ENUM ('BOOLEAN', 'NUMBER', 'CHOICE');
CREATE TYPE "CareObservableStatus" AS ENUM ('ACTIVE', 'RETIRED');
CREATE TYPE "CareRecordSource" AS ENUM ('PATIENT', 'CAREGIVER', 'PROFESSIONAL');
CREATE TYPE "CareAlarmOrigin" AS ENUM ('MANUAL', 'AUTOMATIC');
CREATE TYPE "CareAlarmSeverity" AS ENUM ('ROJA', 'AMARILLA', 'ESTABLE');
CREATE TYPE "CareAlarmState" AS ENUM ('NUEVA', 'EN_GESTION', 'RESUELTA', 'CERRADA');
CREATE TYPE "CareAlarmAction" AS ENUM (
  'CREATE', 'ACKNOWLEDGE', 'CLASSIFY', 'ASSIGN', 'RESOLVE', 'CLOSE', 'REOPEN', 'REPORT_RESOLUTION'
);

ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'CARE_OBSERVABLE_VALIDATED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'CARE_RECORD_CREATED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'CARE_RECORD_AMENDED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'CARE_ALARM_CREATED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'CARE_ALARM_TRANSITIONED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'CARE_CONTEXT_DIRECTORY_READ';

-- ---------------------------------------------------------------------------
-- 2. Ambito de descubrimiento
-- ---------------------------------------------------------------------------

-- Cuenta humana y paciente propio del DIRECTORIO, fijados por el servidor con
-- set_config(..., true) solo mientras lista sus contextos. Ausentes o mal
-- formados => NULL => las politicas de descubrimiento no ven nada.
CREATE OR REPLACE FUNCTION "merdn_discovery_account"() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT CASE
    WHEN current_setting('merdn.discovery_account_id', true)
         ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    THEN current_setting('merdn.discovery_account_id', true)::uuid
  END;
$$;

CREATE OR REPLACE FUNCTION "merdn_discovery_patient"() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT CASE
    WHEN current_setting('merdn.discovery_patient_id', true)
         ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    THEN current_setting('merdn.discovery_patient_id', true)::uuid
  END;
$$;

-- ---------------------------------------------------------------------------
-- 3. Tablas
-- ---------------------------------------------------------------------------

CREATE TABLE "care_observable_definition" (
  "id"                        UUID NOT NULL,
  "tenantId"                  UUID NOT NULL,
  "organizationId"            UUID NOT NULL,
  "contextId"                 UUID NOT NULL,
  "patientId"                 UUID NOT NULL,
  "code"                      TEXT NOT NULL,
  "version"                   INTEGER NOT NULL,
  "label"                     TEXT NOT NULL,
  "valueType"                 "CareObservableType" NOT NULL,
  "unit"                      TEXT,
  "options"                   JSONB,
  "validatedByHumanAccountId" UUID NOT NULL,
  "validatedAt"               TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status"                    "CareObservableStatus" NOT NULL DEFAULT 'ACTIVE',
  "retiredAt"                 TIMESTAMPTZ(6),
  "retiredByHumanAccountId"   UUID,
  "createdAt"                 TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "care_observable_definition_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "care_observable_definition_code_shape" CHECK ("code" ~ '^[a-z0-9][a-z0-9_-]{0,47}$'),
  CONSTRAINT "care_observable_definition_version_positive" CHECK ("version" > 0),
  CONSTRAINT "care_observable_definition_label_shape"
    CHECK (char_length("label") BETWEEN 1 AND 120 AND "label" = btrim("label")),
  CONSTRAINT "care_observable_definition_unit_shape"
    CHECK ("unit" IS NULL OR (char_length("unit") BETWEEN 1 AND 48 AND "unit" = btrim("unit"))),
  CONSTRAINT "care_observable_definition_unit_only_number"
    CHECK ("unit" IS NULL OR "valueType" = 'NUMBER'),
  CONSTRAINT "care_observable_definition_options_shape" CHECK (
    ("valueType" = 'CHOICE'
      AND "options" IS NOT NULL
      AND jsonb_typeof("options") = 'array'
      AND jsonb_array_length("options") BETWEEN 1 AND 100)
    OR ("valueType" <> 'CHOICE' AND "options" IS NULL)
  ),
  CONSTRAINT "care_observable_definition_retirement_coherent" CHECK (
    ("status" = 'ACTIVE' AND "retiredAt" IS NULL AND "retiredByHumanAccountId" IS NULL)
    OR ("status" = 'RETIRED' AND "retiredAt" IS NOT NULL AND "retiredByHumanAccountId" IS NOT NULL)
  )
);

CREATE UNIQUE INDEX "care_observable_definition_version_unique"
  ON "care_observable_definition" ("contextId", "code", "version");
CREATE UNIQUE INDEX "care_observable_definition_id_context_unique"
  ON "care_observable_definition" ("id", "contextId");
CREATE INDEX "care_observable_definition_lookup_idx"
  ON "care_observable_definition" ("tenantId", "organizationId", "contextId", "status");
-- Una sola version ACTIVE por contexto y codigo.
CREATE UNIQUE INDEX "care_observable_definition_active_unique"
  ON "care_observable_definition" ("contextId", "code") WHERE "status" = 'ACTIVE';

CREATE TABLE "care_record" (
  "id"                   UUID NOT NULL,
  "tenantId"             UUID NOT NULL,
  "organizationId"       UUID NOT NULL,
  "contextId"            UUID NOT NULL,
  "patientId"            UUID NOT NULL,
  "authorHumanAccountId" UUID NOT NULL,
  "source"               "CareRecordSource" NOT NULL,
  "occurredAt"           TIMESTAMPTZ(6) NOT NULL,
  "receivedAt"           TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "note"                 TEXT,
  "createdAt"            TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "care_record_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "care_record_note_shape"
    CHECK ("note" IS NULL OR char_length("note") BETWEEN 1 AND 2000),
  -- La ocurrencia reportada nunca es posterior a la recepcion del servidor. La
  -- API la rechaza de forma estricta con su reloj; aqui se tolera solo el
  -- desfase de reloj entre la API y la base, nunca una fecha futura real.
  CONSTRAINT "care_record_occurrence_not_future"
    CHECK ("occurredAt" <= "receivedAt" + interval '2 minutes')
);

CREATE UNIQUE INDEX "care_record_id_context_unique" ON "care_record" ("id", "contextId");
CREATE INDEX "care_record_lookup_idx"
  ON "care_record" ("tenantId", "organizationId", "contextId", "receivedAt");

CREATE TABLE "care_observation" (
  "id"                     UUID NOT NULL,
  "tenantId"               UUID NOT NULL,
  "organizationId"         UUID NOT NULL,
  "contextId"              UUID NOT NULL,
  "patientId"              UUID NOT NULL,
  "recordId"               UUID NOT NULL,
  "definitionId"           UUID NOT NULL,
  "occurrenceKey"          UUID NOT NULL,
  "valueBoolean"           BOOLEAN,
  "valueNumber"            DECIMAL(30, 10),
  "valueChoice"            TEXT,
  "canonicalObservationId" UUID,
  "createdAt"              TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "care_observation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "care_observation_single_value" CHECK (
    num_nonnulls("valueBoolean", "valueNumber", "valueChoice") = 1
  ),
  CONSTRAINT "care_observation_choice_shape"
    CHECK ("valueChoice" IS NULL OR "valueChoice" ~ '^[a-z0-9][a-z0-9_-]{0,47}$'),
  CONSTRAINT "care_observation_not_self_canonical"
    CHECK ("canonicalObservationId" IS NULL OR "canonicalObservationId" <> "id")
);

CREATE UNIQUE INDEX "care_observation_id_context_unique" ON "care_observation" ("id", "contextId");
CREATE INDEX "care_observation_lookup_idx"
  ON "care_observation" ("tenantId", "organizationId", "contextId", "definitionId");
-- Una ocurrencia canonica identificada cuenta UNA vez por observable.
CREATE UNIQUE INDEX "care_observation_canonical_occurrence_unique"
  ON "care_observation" ("contextId", "definitionId", "occurrenceKey")
  WHERE "canonicalObservationId" IS NULL;

CREATE TABLE "care_record_amendment" (
  "id"                   UUID NOT NULL,
  "tenantId"             UUID NOT NULL,
  "organizationId"       UUID NOT NULL,
  "contextId"            UUID NOT NULL,
  "patientId"            UUID NOT NULL,
  "recordId"             UUID NOT NULL,
  "observationId"        UUID,
  "authorHumanAccountId" UUID NOT NULL,
  "sequence"             INTEGER NOT NULL,
  "reason"               TEXT NOT NULL,
  "note"                 TEXT,
  "replacementBoolean"   BOOLEAN,
  "replacementNumber"    DECIMAL(30, 10),
  "replacementChoice"    TEXT,
  "createdAt"            TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "care_record_amendment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "care_record_amendment_sequence_positive" CHECK ("sequence" > 0),
  CONSTRAINT "care_record_amendment_reason_shape"
    CHECK (char_length(btrim("reason")) BETWEEN 1 AND 2000),
  CONSTRAINT "care_record_amendment_note_shape"
    CHECK ("note" IS NULL OR char_length("note") BETWEEN 1 AND 2000),
  -- Un valor de reemplazo exige observacion; sin observacion solo cabe nota.
  CONSTRAINT "care_record_amendment_replacement_shape" CHECK (
    num_nonnulls("replacementBoolean", "replacementNumber", "replacementChoice") <= 1
    AND ("observationId" IS NOT NULL
         OR num_nonnulls("replacementBoolean", "replacementNumber", "replacementChoice") = 0)
    AND (num_nonnulls("replacementBoolean", "replacementNumber", "replacementChoice") = 1
         OR "note" IS NOT NULL)
  ),
  CONSTRAINT "care_record_amendment_choice_shape"
    CHECK ("replacementChoice" IS NULL OR "replacementChoice" ~ '^[a-z0-9][a-z0-9_-]{0,47}$')
);

CREATE UNIQUE INDEX "care_record_amendment_sequence_unique"
  ON "care_record_amendment" ("recordId", "sequence");

CREATE TABLE "care_alarm" (
  "id"                             UUID NOT NULL,
  "tenantId"                       UUID NOT NULL,
  "organizationId"                 UUID NOT NULL,
  "contextId"                      UUID NOT NULL,
  "patientId"                      UUID NOT NULL,
  "origin"                         "CareAlarmOrigin" NOT NULL,
  "initiatedByHumanAccountId"      UUID NOT NULL,
  "reasonCode"                     TEXT NOT NULL,
  "note"                           TEXT,
  "severity"                       "CareAlarmSeverity",
  "state"                          "CareAlarmState" NOT NULL DEFAULT 'NUEVA',
  "assignedReviewerHumanAccountId" UUID,
  "criterionId"                    UUID,
  "version"                        INTEGER NOT NULL DEFAULT 1,
  "createdAt"                      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"                      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt"                     TIMESTAMPTZ(6),
  "closedAt"                       TIMESTAMPTZ(6),

  CONSTRAINT "care_alarm_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "care_alarm_version_positive" CHECK ("version" > 0),
  CONSTRAINT "care_alarm_reason_shape" CHECK ("reasonCode" ~ '^[A-Z][A-Z0-9_]{1,47}$'),
  CONSTRAINT "care_alarm_note_shape" CHECK ("note" IS NULL OR char_length("note") BETWEEN 1 AND 2000),
  -- MP03: una alarma manual no cita criterio. El origen automatico lo
  -- habilitara MP04 junto con su criterio.
  CONSTRAINT "care_alarm_origin_shape" CHECK (
    ("origin" = 'MANUAL' AND "criterionId" IS NULL)
    OR ("origin" = 'AUTOMATIC' AND "criterionId" IS NOT NULL)
  ),
  CONSTRAINT "care_alarm_lifecycle_dates" CHECK (
    ("state" IN ('NUEVA', 'EN_GESTION') AND "closedAt" IS NULL)
    OR ("state" = 'RESUELTA' AND "resolvedAt" IS NOT NULL AND "closedAt" IS NULL)
    OR ("state" = 'CERRADA' AND "resolvedAt" IS NOT NULL AND "closedAt" IS NOT NULL)
  )
);

CREATE UNIQUE INDEX "care_alarm_id_context_unique" ON "care_alarm" ("id", "contextId");
CREATE INDEX "care_alarm_lookup_idx" ON "care_alarm" ("tenantId", "organizationId", "contextId", "state");

CREATE TABLE "care_alarm_transition" (
  "id"                  UUID NOT NULL,
  "tenantId"            UUID NOT NULL,
  "organizationId"      UUID NOT NULL,
  "contextId"           UUID NOT NULL,
  "patientId"           UUID NOT NULL,
  "alarmId"             UUID NOT NULL,
  "actorHumanAccountId" UUID NOT NULL,
  "action"              "CareAlarmAction" NOT NULL,
  "stateBefore"         "CareAlarmState",
  "stateAfter"          "CareAlarmState" NOT NULL,
  "severityBefore"      "CareAlarmSeverity",
  "severityAfter"       "CareAlarmSeverity",
  "assignedBefore"      UUID,
  "assignedAfter"       UUID,
  "reason"              TEXT,
  "createdAt"           TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "care_alarm_transition_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "care_alarm_transition_reason_shape"
    CHECK ("reason" IS NULL OR char_length(btrim("reason")) BETWEEN 1 AND 2000),
  CONSTRAINT "care_alarm_transition_create_shape"
    CHECK (("action" = 'CREATE') = ("stateBefore" IS NULL))
);

CREATE INDEX "care_alarm_transition_lookup_idx"
  ON "care_alarm_transition" ("tenantId", "organizationId", "contextId", "alarmId", "createdAt");

CREATE TABLE "care_request_receipt" (
  "id"                  UUID NOT NULL,
  "tenantId"            UUID NOT NULL,
  "organizationId"      UUID NOT NULL,
  "contextId"           UUID NOT NULL,
  "patientId"           UUID NOT NULL,
  "actorHumanAccountId" UUID NOT NULL,
  "action"              TEXT NOT NULL,
  "idempotencyKey"      UUID NOT NULL,
  "payloadHash"         TEXT NOT NULL,
  "responseResourceId"  UUID NOT NULL,
  "createdAt"           TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "care_request_receipt_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "care_request_receipt_action_shape" CHECK ("action" ~ '^[a-z][a-z_.-]{1,47}$'),
  CONSTRAINT "care_request_receipt_hash_shape" CHECK ("payloadHash" ~ '^[0-9a-f]{64}$')
);

CREATE UNIQUE INDEX "care_request_receipt_key_unique"
  ON "care_request_receipt" ("contextId", "actorHumanAccountId", "action", "idempotencyKey");

-- ---------------------------------------------------------------------------
-- 4. Claves foraneas. El contexto se referencia SIEMPRE por sus cuatro campos.
-- ---------------------------------------------------------------------------

ALTER TABLE "care_observable_definition"
  ADD CONSTRAINT "care_observable_definition_context_fkey"
  FOREIGN KEY ("contextId", "tenantId", "organizationId", "patientId")
  REFERENCES "patient_care_context" ("id", "tenantId", "organizationId", "patientId") ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "care_observable_definition_validator_fkey"
  FOREIGN KEY ("validatedByHumanAccountId", "tenantId") REFERENCES "human_account" ("id", "tenantId") ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "care_observable_definition_retirer_fkey"
  FOREIGN KEY ("retiredByHumanAccountId", "tenantId") REFERENCES "human_account" ("id", "tenantId") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "care_record"
  ADD CONSTRAINT "care_record_context_fkey"
  FOREIGN KEY ("contextId", "tenantId", "organizationId", "patientId")
  REFERENCES "patient_care_context" ("id", "tenantId", "organizationId", "patientId") ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "care_record_author_fkey"
  FOREIGN KEY ("authorHumanAccountId", "tenantId") REFERENCES "human_account" ("id", "tenantId") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "care_observation"
  ADD CONSTRAINT "care_observation_context_fkey"
  FOREIGN KEY ("contextId", "tenantId", "organizationId", "patientId")
  REFERENCES "patient_care_context" ("id", "tenantId", "organizationId", "patientId") ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "care_observation_record_fkey"
  FOREIGN KEY ("recordId", "contextId") REFERENCES "care_record" ("id", "contextId") ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "care_observation_definition_fkey"
  FOREIGN KEY ("definitionId", "contextId") REFERENCES "care_observable_definition" ("id", "contextId") ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "care_observation_canonical_fkey"
  FOREIGN KEY ("canonicalObservationId", "contextId") REFERENCES "care_observation" ("id", "contextId") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "care_record_amendment"
  ADD CONSTRAINT "care_record_amendment_context_fkey"
  FOREIGN KEY ("contextId", "tenantId", "organizationId", "patientId")
  REFERENCES "patient_care_context" ("id", "tenantId", "organizationId", "patientId") ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "care_record_amendment_record_fkey"
  FOREIGN KEY ("recordId", "contextId") REFERENCES "care_record" ("id", "contextId") ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "care_record_amendment_observation_fkey"
  FOREIGN KEY ("observationId", "contextId") REFERENCES "care_observation" ("id", "contextId") ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "care_record_amendment_author_fkey"
  FOREIGN KEY ("authorHumanAccountId", "tenantId") REFERENCES "human_account" ("id", "tenantId") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "care_alarm"
  ADD CONSTRAINT "care_alarm_context_fkey"
  FOREIGN KEY ("contextId", "tenantId", "organizationId", "patientId")
  REFERENCES "patient_care_context" ("id", "tenantId", "organizationId", "patientId") ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "care_alarm_initiator_fkey"
  FOREIGN KEY ("initiatedByHumanAccountId", "tenantId") REFERENCES "human_account" ("id", "tenantId") ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "care_alarm_assignee_fkey"
  FOREIGN KEY ("assignedReviewerHumanAccountId", "tenantId") REFERENCES "human_account" ("id", "tenantId") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "care_alarm_transition"
  ADD CONSTRAINT "care_alarm_transition_context_fkey"
  FOREIGN KEY ("contextId", "tenantId", "organizationId", "patientId")
  REFERENCES "patient_care_context" ("id", "tenantId", "organizationId", "patientId") ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "care_alarm_transition_alarm_fkey"
  FOREIGN KEY ("alarmId", "contextId") REFERENCES "care_alarm" ("id", "contextId") ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "care_alarm_transition_actor_fkey"
  FOREIGN KEY ("actorHumanAccountId", "tenantId") REFERENCES "human_account" ("id", "tenantId") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "care_request_receipt"
  ADD CONSTRAINT "care_request_receipt_context_fkey"
  FOREIGN KEY ("contextId", "tenantId", "organizationId", "patientId")
  REFERENCES "patient_care_context" ("id", "tenantId", "organizationId", "patientId") ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "care_request_receipt_actor_fkey"
  FOREIGN KEY ("actorHumanAccountId", "tenantId") REFERENCES "human_account" ("id", "tenantId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- ---------------------------------------------------------------------------
-- 5. Guardas de integridad
-- ---------------------------------------------------------------------------

-- Tiempos del servidor. La recepcion, la validacion y la creacion las fija la
-- base; la ocurrencia futura se rechaza por CHECK contra esa recepcion.
CREATE OR REPLACE FUNCTION "merdn_care_server_times"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW."createdAt" := now();
  IF TG_TABLE_NAME = 'care_record' THEN
    NEW."receivedAt" := now();
  ELSIF TG_TABLE_NAME = 'care_observable_definition' THEN
    NEW."validatedAt" := now();
  ELSIF TG_TABLE_NAME = 'care_alarm' THEN
    NEW."updatedAt" := now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "care_observable_definition_server_times" BEFORE INSERT ON "care_observable_definition"
  FOR EACH ROW EXECUTE FUNCTION "merdn_care_server_times"();
CREATE TRIGGER "care_record_server_times" BEFORE INSERT ON "care_record"
  FOR EACH ROW EXECUTE FUNCTION "merdn_care_server_times"();
CREATE TRIGGER "care_observation_server_times" BEFORE INSERT ON "care_observation"
  FOR EACH ROW EXECUTE FUNCTION "merdn_care_server_times"();
CREATE TRIGGER "care_record_amendment_server_times" BEFORE INSERT ON "care_record_amendment"
  FOR EACH ROW EXECUTE FUNCTION "merdn_care_server_times"();
CREATE TRIGGER "care_alarm_server_times" BEFORE INSERT ON "care_alarm"
  FOR EACH ROW EXECUTE FUNCTION "merdn_care_server_times"();
CREATE TRIGGER "care_alarm_transition_server_times" BEFORE INSERT ON "care_alarm_transition"
  FOR EACH ROW EXECUTE FUNCTION "merdn_care_server_times"();
CREATE TRIGGER "care_request_receipt_server_times" BEFORE INSERT ON "care_request_receipt"
  FOR EACH ROW EXECUTE FUNCTION "merdn_care_server_times"();

-- Observacion coherente: la definicion es ACTIVE, el valor corresponde a su
-- tipo, la eleccion pertenece a sus opciones, el registro es del mismo
-- contexto y la canonica es del MISMO codigo de observable.
CREATE OR REPLACE FUNCTION "merdn_care_observation_guard"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_type text;
  v_status text;
  v_code text;
  v_options jsonb;
BEGIN
  SELECT d."valueType"::text, d."status"::text, d."code", d."options"
    INTO v_type, v_status, v_code, v_options
    FROM "care_observable_definition" d
   WHERE d."id" = NEW."definitionId" AND d."contextId" = NEW."contextId";

  IF v_type IS NULL OR v_status <> 'ACTIVE' THEN
    RAISE EXCEPTION 'care_observation: la definicion no esta vigente en el contexto.' USING ERRCODE = '23514';
  END IF;

  IF (v_type = 'BOOLEAN' AND NEW."valueBoolean" IS NULL)
     OR (v_type = 'NUMBER' AND NEW."valueNumber" IS NULL)
     OR (v_type = 'CHOICE' AND NEW."valueChoice" IS NULL) THEN
    RAISE EXCEPTION 'care_observation: el valor no corresponde al tipo.' USING ERRCODE = '23514';
  END IF;

  IF v_type = 'CHOICE' AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_options) o WHERE o ->> 'code' = NEW."valueChoice"
  ) THEN
    RAISE EXCEPTION 'care_observation: la opcion no pertenece a la definicion.' USING ERRCODE = '23514';
  END IF;

  IF NEW."canonicalObservationId" IS NOT NULL AND NOT EXISTS (
    SELECT 1
      FROM "care_observation" c
      JOIN "care_observable_definition" cd ON cd."id" = c."definitionId" AND cd."contextId" = c."contextId"
     WHERE c."id" = NEW."canonicalObservationId"
       AND c."contextId" = NEW."contextId"
       AND c."canonicalObservationId" IS NULL
       AND cd."code" = v_code
  ) THEN
    RAISE EXCEPTION 'care_observation: la canonica no es una ocurrencia del mismo observable.' USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "care_observation_guard" BEFORE INSERT ON "care_observation"
  FOR EACH ROW EXECUTE FUNCTION "merdn_care_observation_guard"();

-- Enmienda coherente: la observacion pertenece al registro y el reemplazo
-- corresponde al tipo de su definicion.
CREATE OR REPLACE FUNCTION "merdn_care_amendment_guard"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_type text;
  v_options jsonb;
BEGIN
  IF NEW."observationId" IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT d."valueType"::text, d."options"
    INTO v_type, v_options
    FROM "care_observation" o
    JOIN "care_observable_definition" d ON d."id" = o."definitionId" AND d."contextId" = o."contextId"
   WHERE o."id" = NEW."observationId" AND o."recordId" = NEW."recordId" AND o."contextId" = NEW."contextId";

  IF v_type IS NULL THEN
    RAISE EXCEPTION 'care_record_amendment: la observacion no pertenece al registro.' USING ERRCODE = '23514';
  END IF;

  IF (NEW."replacementBoolean" IS NOT NULL AND v_type <> 'BOOLEAN')
     OR (NEW."replacementNumber" IS NOT NULL AND v_type <> 'NUMBER')
     OR (NEW."replacementChoice" IS NOT NULL AND (v_type <> 'CHOICE' OR NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements(v_options) o WHERE o ->> 'code' = NEW."replacementChoice"))) THEN
    RAISE EXCEPTION 'care_record_amendment: el reemplazo no corresponde al tipo.' USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "care_record_amendment_guard" BEFORE INSERT ON "care_record_amendment"
  FOR EACH ROW EXECUTE FUNCTION "merdn_care_amendment_guard"();

-- Append-only: historia que nadie reescribe ni borra, tampoco el propietario.
CREATE OR REPLACE FUNCTION "merdn_care_append_only"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% es append-only: no admite UPDATE, DELETE ni TRUNCATE.', TG_TABLE_NAME
    USING ERRCODE = '42501';
END;
$$;

CREATE TRIGGER "care_record_append_only" BEFORE UPDATE OR DELETE ON "care_record"
  FOR EACH ROW EXECUTE FUNCTION "merdn_care_append_only"();
CREATE TRIGGER "care_observation_append_only" BEFORE UPDATE OR DELETE ON "care_observation"
  FOR EACH ROW EXECUTE FUNCTION "merdn_care_append_only"();
CREATE TRIGGER "care_record_amendment_append_only" BEFORE UPDATE OR DELETE ON "care_record_amendment"
  FOR EACH ROW EXECUTE FUNCTION "merdn_care_append_only"();
CREATE TRIGGER "care_alarm_transition_append_only" BEFORE UPDATE OR DELETE ON "care_alarm_transition"
  FOR EACH ROW EXECUTE FUNCTION "merdn_care_append_only"();
CREATE TRIGGER "care_request_receipt_append_only" BEFORE UPDATE OR DELETE ON "care_request_receipt"
  FOR EACH ROW EXECUTE FUNCTION "merdn_care_append_only"();
CREATE TRIGGER "care_alarm_delete_forbidden" BEFORE DELETE ON "care_alarm"
  FOR EACH ROW EXECUTE FUNCTION "merdn_care_append_only"();
CREATE TRIGGER "care_observable_definition_delete_forbidden" BEFORE DELETE ON "care_observable_definition"
  FOR EACH ROW EXECUTE FUNCTION "merdn_care_append_only"();

-- Una definicion solo cambia para RETIRARSE, una vez y con fecha del servidor.
CREATE OR REPLACE FUNCTION "merdn_care_observable_retirement_guard"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF (to_jsonb(NEW) - ARRAY['status', 'retiredAt', 'retiredByHumanAccountId'])
       IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['status', 'retiredAt', 'retiredByHumanAccountId'])
     OR OLD."status"::text <> 'ACTIVE' OR NEW."status"::text <> 'RETIRED' THEN
    RAISE EXCEPTION 'care_observable_definition: una version es inmutable; solo se admite retirarla.'
      USING ERRCODE = '42501';
  END IF;
  NEW."retiredAt" := clock_timestamp();
  RETURN NEW;
END;
$$;

CREATE TRIGGER "care_observable_definition_retirement_guard" BEFORE UPDATE ON "care_observable_definition"
  FOR EACH ROW EXECUTE FUNCTION "merdn_care_observable_retirement_guard"();

-- Alarma: origen, iniciador, motivo, nota, contexto y creacion son inmutables;
-- cada cambio incrementa la version en UNO y fecha updatedAt con la base.
CREATE OR REPLACE FUNCTION "merdn_care_alarm_update_guard"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF (to_jsonb(NEW) - ARRAY['severity', 'state', 'assignedReviewerHumanAccountId', 'version',
                            'updatedAt', 'resolvedAt', 'closedAt'])
       IS DISTINCT FROM
     (to_jsonb(OLD) - ARRAY['severity', 'state', 'assignedReviewerHumanAccountId', 'version',
                            'updatedAt', 'resolvedAt', 'closedAt']) THEN
    RAISE EXCEPTION 'care_alarm: la procedencia de la alarma es inmutable.' USING ERRCODE = '42501';
  END IF;
  IF NEW."version" <> OLD."version" + 1 THEN
    RAISE EXCEPTION 'care_alarm: cada cambio incrementa la version en uno.' USING ERRCODE = '40001';
  END IF;
  NEW."updatedAt" := clock_timestamp();
  RETURN NEW;
END;
$$;

CREATE TRIGGER "care_alarm_update_guard" BEFORE UPDATE ON "care_alarm"
  FOR EACH ROW EXECUTE FUNCTION "merdn_care_alarm_update_guard"();

-- ---------------------------------------------------------------------------
-- 6. Auditoria: la familia CARE_* de MP02–MP03
-- ---------------------------------------------------------------------------

-- Se reemplaza el CHECK de MP01 por uno que admite las mutaciones nuevas con
-- la misma forma estricta: actor humano sin rol, organizacion y recurso. El
-- directorio no tiene organizacion porque abarca todas las de la cuenta.
ALTER TABLE "audit_event" DROP CONSTRAINT "audit_event_care_context_scope";

ALTER TABLE "audit_event"
  ADD CONSTRAINT "audit_event_care_context_scope"
  CHECK (
    (
      "eventType"::text NOT IN (
        'CARE_CONTEXT_ACCESS_GRANTED', 'CARE_CONTEXT_ACCESS_DENIED',
        'CARE_OBSERVABLE_VALIDATED', 'CARE_RECORD_CREATED', 'CARE_RECORD_AMENDED',
        'CARE_ALARM_CREATED', 'CARE_ALARM_TRANSITIONED'
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
                                'CARE_ALARM_CREATED', 'CARE_ALARM_TRANSITIONED')
          AND "outcome" = 'SUCCESS'
          AND "resourceId" IS NOT NULL
          AND "resourceType" IN ('CareObservableDefinition', 'CareRecord', 'CareRecordAmendment',
                                 'CareAlarm', 'CareAlarmTransition')
        )
      )
    )
  );

ALTER TABLE "audit_event"
  ADD CONSTRAINT "audit_event_care_directory_shape"
  CHECK (
    "eventType"::text <> 'CARE_CONTEXT_DIRECTORY_READ'
    OR (
      "actorType" = 'HUMAN_ACCOUNT'
      AND "actorUserId" IS NOT NULL
      AND "actorRole" IS NULL
      AND "organizationId" IS NULL
      AND "resourceType" = 'CareContextDirectory'
      AND "resourceId" IS NULL
      AND "outcome" = 'SUCCESS'
    )
  );

-- ---------------------------------------------------------------------------
-- 7. Row Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE "care_observable_definition" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "care_observable_definition" FORCE  ROW LEVEL SECURITY;

ALTER TABLE "care_record" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "care_record" FORCE  ROW LEVEL SECURITY;

ALTER TABLE "care_observation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "care_observation" FORCE  ROW LEVEL SECURITY;

ALTER TABLE "care_record_amendment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "care_record_amendment" FORCE  ROW LEVEL SECURITY;

ALTER TABLE "care_alarm" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "care_alarm" FORCE  ROW LEVEL SECURITY;

ALTER TABLE "care_alarm_transition" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "care_alarm_transition" FORCE  ROW LEVEL SECURITY;

ALTER TABLE "care_request_receipt" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "care_request_receipt" FORCE  ROW LEVEL SECURITY;

CREATE POLICY "care_observable_definition_scope" ON "care_observable_definition"
  FOR ALL TO "merdn_runtime"
  USING ("tenantId" = "merdn_current_tenant"() AND "organizationId" = "merdn_current_organization"())
  WITH CHECK ("tenantId" = "merdn_current_tenant"() AND "organizationId" = "merdn_current_organization"());

CREATE POLICY "care_record_scope" ON "care_record"
  FOR ALL TO "merdn_runtime"
  USING ("tenantId" = "merdn_current_tenant"() AND "organizationId" = "merdn_current_organization"())
  WITH CHECK ("tenantId" = "merdn_current_tenant"() AND "organizationId" = "merdn_current_organization"());

CREATE POLICY "care_observation_scope" ON "care_observation"
  FOR ALL TO "merdn_runtime"
  USING ("tenantId" = "merdn_current_tenant"() AND "organizationId" = "merdn_current_organization"())
  WITH CHECK ("tenantId" = "merdn_current_tenant"() AND "organizationId" = "merdn_current_organization"());

CREATE POLICY "care_record_amendment_scope" ON "care_record_amendment"
  FOR ALL TO "merdn_runtime"
  USING ("tenantId" = "merdn_current_tenant"() AND "organizationId" = "merdn_current_organization"())
  WITH CHECK ("tenantId" = "merdn_current_tenant"() AND "organizationId" = "merdn_current_organization"());

CREATE POLICY "care_alarm_scope" ON "care_alarm"
  FOR ALL TO "merdn_runtime"
  USING ("tenantId" = "merdn_current_tenant"() AND "organizationId" = "merdn_current_organization"())
  WITH CHECK ("tenantId" = "merdn_current_tenant"() AND "organizationId" = "merdn_current_organization"());

CREATE POLICY "care_alarm_transition_scope" ON "care_alarm_transition"
  FOR ALL TO "merdn_runtime"
  USING ("tenantId" = "merdn_current_tenant"() AND "organizationId" = "merdn_current_organization"())
  WITH CHECK ("tenantId" = "merdn_current_tenant"() AND "organizationId" = "merdn_current_organization"());

CREATE POLICY "care_request_receipt_scope" ON "care_request_receipt"
  FOR ALL TO "merdn_runtime"
  USING ("tenantId" = "merdn_current_tenant"() AND "organizationId" = "merdn_current_organization"())
  WITH CHECK ("tenantId" = "merdn_current_tenant"() AND "organizationId" = "merdn_current_organization"());

-- DIRECTORIO de contextos propios. Solo SELECT y solo con el GUC de
-- descubrimiento fijado por el servidor. Permiten leer metadatos de:
--   - las concesiones de la PROPIA cuenta;
--   - los contextos citados por ellas o del PROPIO paciente resuelto;
--   - las organizaciones de esos contextos.
-- No abren registros, observaciones ni alarmas, no permiten escribir y no
-- ven nada sin el GUC. La politica no autoriza: el servidor vuelve a decidir
-- con la politica de MP01 cada contexto antes de proyectarlo.
CREATE POLICY "care_authorization_discovery" ON "care_authorization"
  FOR SELECT TO "merdn_runtime"
  USING (
    "tenantId" = "merdn_current_tenant"()
    AND "merdn_discovery_account"() IS NOT NULL
    AND "humanAccountId" = "merdn_discovery_account"()
  );

CREATE POLICY "patient_care_context_discovery" ON "patient_care_context"
  FOR SELECT TO "merdn_runtime"
  USING (
    "tenantId" = "merdn_current_tenant"()
    AND "merdn_discovery_account"() IS NOT NULL
    AND (
      "patientId" = "merdn_discovery_patient"()
      OR EXISTS (
        SELECT 1 FROM "care_authorization" a
         WHERE a."contextId" = "patient_care_context"."id"
           AND a."tenantId" = "patient_care_context"."tenantId"
           AND a."humanAccountId" = "merdn_discovery_account"()
      )
    )
  );

CREATE POLICY "organization_discovery" ON "organization"
  FOR SELECT TO "merdn_runtime"
  USING (
    "tenantId" = "merdn_current_tenant"()
    AND "merdn_discovery_account"() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM "patient_care_context" c
       WHERE c."organizationId" = "organization"."id"
         AND c."tenantId" = "organization"."tenantId"
    )
  );

-- ---------------------------------------------------------------------------
-- 8. Privilegios minimos del runtime
-- ---------------------------------------------------------------------------

GRANT SELECT, INSERT ON TABLE "care_observable_definition" TO "merdn_runtime";
GRANT SELECT, INSERT ON TABLE "care_record"                TO "merdn_runtime";
GRANT SELECT, INSERT ON TABLE "care_observation"           TO "merdn_runtime";
GRANT SELECT, INSERT ON TABLE "care_record_amendment"      TO "merdn_runtime";
GRANT SELECT, INSERT ON TABLE "care_alarm"                 TO "merdn_runtime";
GRANT SELECT, INSERT ON TABLE "care_alarm_transition"      TO "merdn_runtime";
GRANT SELECT, INSERT ON TABLE "care_request_receipt"       TO "merdn_runtime";

-- Solo las columnas que el ciclo de vida cambia; los guardas impiden el resto.
GRANT UPDATE ("status", "retiredAt", "retiredByHumanAccountId")
  ON TABLE "care_observable_definition" TO "merdn_runtime";
GRANT UPDATE ("severity", "state", "assignedReviewerHumanAccountId", "version",
              "updatedAt", "resolvedAt", "closedAt")
  ON TABLE "care_alarm" TO "merdn_runtime";

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
     AND c.relname IN ('care_observable_definition', 'care_record', 'care_observation',
                       'care_record_amendment', 'care_alarm', 'care_alarm_transition',
                       'care_request_receipt')
     AND NOT (c.relrowsecurity AND c.relforcerowsecurity);

  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION '055/MP02 postflight: RLS/FORCE ausente en: %', array_to_string(v_bad, ', ');
  END IF;

  IF has_table_privilege('merdn_runtime', 'care_record', 'DELETE')
     OR has_table_privilege('merdn_runtime', 'care_alarm', 'DELETE')
     OR has_table_privilege('merdn_runtime', 'care_record', 'UPDATE') THEN
    RAISE EXCEPTION '055/MP02 postflight: el runtime tiene privilegios de mas.';
  END IF;
END;
$postflight$;
