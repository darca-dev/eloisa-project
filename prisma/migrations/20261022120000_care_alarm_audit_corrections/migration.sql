-- ---------------------------------------------------------------------------
-- SPEC 055 / MP07A - Correcciones A03, A04 y A07 de la auditoria de Codex.
--
-- Migracion ADITIVA sobre MP04. No edita migraciones publicadas, no inserta,
-- actualiza ni borra filas y no reconstruye procedencia clinica:
--
--   1. A03. "care_alarm_criterion_version"."observableDefinitionId": FK
--      compuesta (definicion, contexto, codigo, tipo) a la definicion EXACTA e
--      inmutable del observable. Las versiones HISTORICAS quedan con NULL: son
--      legado NO evaluable y exigen que el visitador revalide una version.
--      Ninguna unidad, definicion ni opcion se infiere por codigo. Un guarda
--      BEFORE INSERT exige la definicion exacta, VIGENTE y coherente en toda
--      version NUEVA; el NULL nunca omite la comprobacion de una fila nueva.
--      Conservar o retirar una version legada sigue siendo posible: el guarda
--      de MP04 solo deja cambiar estado y fecha de reemplazo.
--   2. A07. "care_alarm_evidence": snapshot tipado del valor EFECTIVO evaluado,
--      la definicion de la observacion, la enmienda efectiva y la secuencia de
--      enmiendas del registro al evaluar. La evidencia HISTORICA queda con todo
--      NULL: legado explicitamente indeterminado, sin snapshot inventado. Un
--      guarda BEFORE INSERT exige un snapshot coherente con la observacion, su
--      definicion y sus enmiendas en ese instante. La evidencia sigue siendo
--      append-only (MP04), asi que el snapshot es inmutable.
--   3. A04. El mismo guarda rechaza evidencia de una identidad de ocurrencia
--      (contexto + codigo del observable + occurrenceKey) ya consumida por el
--      MISMO criterio, y de una ocurrencia no posterior al ultimo cierre de un
--      episodio de ese criterio. NO se crea un indice global de identidad: las
--      observaciones historicas duplicadas entre definiciones se conservan.
--
-- No cambia RLS/FORCE, politicas, GRANT, triggers append-only ni el CHECK de
-- auditoria. No agrega valores de enum. Los indices unicos nuevos contienen la
-- clave primaria y no pueden fallar sobre datos existentes.
-- ---------------------------------------------------------------------------

DO $preflight$
BEGIN
  IF to_regclass('public.care_alarm_criterion_version') IS NULL
     OR to_regclass('public.care_alarm_evidence') IS NULL
     OR to_regclass('public.care_record_amendment') IS NULL THEN
    RAISE EXCEPTION '055/MP07A preflight: faltan las tablas de MP02–MP04.';
  END IF;
  IF to_regprocedure('public.merdn_care_append_only()') IS NULL THEN
    RAISE EXCEPTION '055/MP07A preflight: falta el guarda append-only de MP02.';
  END IF;
END;
$preflight$;

-- ---------------------------------------------------------------------------
-- 1. A03 - Definicion exacta en las versiones de criterio
-- ---------------------------------------------------------------------------

-- Destino de la FK compuesta. Contiene la PK: no puede fallar.
CREATE UNIQUE INDEX "care_observable_definition_exact_unique"
  ON "care_observable_definition" ("id", "contextId", "code", "valueType");

ALTER TABLE "care_alarm_criterion_version"
  ADD COLUMN "observableDefinitionId" UUID;

-- MATCH SIMPLE: una fila HISTORICA con NULL no se valida (legado no evaluable);
-- una fila nueva la exige el guarda de insercion.
ALTER TABLE "care_alarm_criterion_version"
  ADD CONSTRAINT "care_alarm_criterion_version_definition_fkey"
  FOREIGN KEY ("observableDefinitionId", "contextId", "observableCode", "valueType")
  REFERENCES "care_observable_definition" ("id", "contextId", "code", "valueType")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE INDEX "care_alarm_criterion_version_definition_idx"
  ON "care_alarm_criterion_version" ("observableDefinitionId");

-- Una version NUEVA cita la definicion exacta, vigente y del mismo contexto,
-- tenant, organizacion y paciente. Las opciones elegidas pertenecen a ella.
CREATE OR REPLACE FUNCTION "merdn_care_criterion_version_definition_guard"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_status text;
  v_options jsonb;
BEGIN
  IF NEW."observableDefinitionId" IS NULL THEN
    RAISE EXCEPTION 'care_alarm_criterion_version: una version nueva exige la definicion exacta del dato.'
      USING ERRCODE = '23514';
  END IF;

  SELECT d."status"::text, d."options"
    INTO v_status, v_options
    FROM "care_observable_definition" d
   WHERE d."id" = NEW."observableDefinitionId"
     AND d."contextId" = NEW."contextId"
     AND d."tenantId" = NEW."tenantId"
     AND d."organizationId" = NEW."organizationId"
     AND d."patientId" = NEW."patientId"
     AND d."code" = NEW."observableCode"
     AND d."valueType" = NEW."valueType";

  IF v_status IS DISTINCT FROM 'ACTIVE' THEN
    RAISE EXCEPTION 'care_alarm_criterion_version: la definicion citada no esta vigente en el contexto.'
      USING ERRCODE = '23514';
  END IF;

  IF NEW."valueType"::text = 'CHOICE' AND EXISTS (
    SELECT 1
      FROM jsonb_array_elements_text(NEW."choiceValues") elegido
     WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_options) o WHERE o ->> 'code' = elegido)
  ) THEN
    RAISE EXCEPTION 'care_alarm_criterion_version: una opcion elegida no pertenece a la definicion.'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "care_alarm_criterion_version_definition_guard" BEFORE INSERT ON "care_alarm_criterion_version"
  FOR EACH ROW EXECUTE FUNCTION "merdn_care_criterion_version_definition_guard"();

-- ---------------------------------------------------------------------------
-- 2. A07 - Snapshot tipado de la evidencia evaluada
-- ---------------------------------------------------------------------------

-- Destino de la FK de la enmienda efectiva. Contiene la PK: no puede fallar.
CREATE UNIQUE INDEX "care_record_amendment_id_context_unique"
  ON "care_record_amendment" ("id", "contextId");

ALTER TABLE "care_alarm_evidence"
  ADD COLUMN "observableDefinitionId"        UUID,
  ADD COLUMN "evaluatedValueBoolean"         BOOLEAN,
  ADD COLUMN "evaluatedValueNumber"          DECIMAL(30, 10),
  ADD COLUMN "evaluatedValueChoice"          TEXT,
  ADD COLUMN "evaluatedAmendmentId"          UUID,
  ADD COLUMN "amendmentSequenceAtEvaluation" INTEGER;

-- Legado (todo NULL) o snapshot completo. Las filas historicas cumplen la
-- primera rama sin reescribirse.
ALTER TABLE "care_alarm_evidence"
  ADD CONSTRAINT "care_alarm_evidence_snapshot_shape" CHECK (
    (
      "observableDefinitionId" IS NULL
      AND "evaluatedValueBoolean" IS NULL
      AND "evaluatedValueNumber" IS NULL
      AND "evaluatedValueChoice" IS NULL
      AND "evaluatedAmendmentId" IS NULL
      AND "amendmentSequenceAtEvaluation" IS NULL
    )
    OR (
      "observableDefinitionId" IS NOT NULL
      AND num_nonnulls("evaluatedValueBoolean", "evaluatedValueNumber", "evaluatedValueChoice") = 1
      AND "amendmentSequenceAtEvaluation" IS NOT NULL
      AND "amendmentSequenceAtEvaluation" >= 0
      AND ("evaluatedAmendmentId" IS NULL OR "amendmentSequenceAtEvaluation" >= 1)
    )
  ),
  ADD CONSTRAINT "care_alarm_evidence_choice_shape"
    CHECK ("evaluatedValueChoice" IS NULL OR "evaluatedValueChoice" ~ '^[a-z0-9][a-z0-9_-]{0,47}$');

ALTER TABLE "care_alarm_evidence"
  ADD CONSTRAINT "care_alarm_evidence_definition_fkey"
  FOREIGN KEY ("observableDefinitionId", "contextId")
  REFERENCES "care_observable_definition" ("id", "contextId") ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "care_alarm_evidence_amendment_fkey"
  FOREIGN KEY ("evaluatedAmendmentId", "contextId")
  REFERENCES "care_record_amendment" ("id", "contextId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Evidencia NUEVA: snapshot coherente, sin fabricar, dentro de la transaccion
-- que evalua (bajo el advisory del contexto que tambien serializa enmiendas).
CREATE OR REPLACE FUNCTION "merdn_care_alarm_evidence_snapshot_guard"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_definition uuid;
  v_record uuid;
  v_canonical uuid;
  v_key uuid;
  v_code text;
  v_original_boolean boolean;
  v_original_number numeric;
  v_original_choice text;
  v_version_definition uuid;
  v_version_criterion uuid;
  v_alarm_criterion uuid;
  v_max_sequence integer;
  v_last_id uuid;
  v_last_boolean boolean;
  v_last_number numeric;
  v_last_choice text;
  v_occurred timestamptz;
  v_boundary timestamptz;
BEGIN
  IF NEW."observableDefinitionId" IS NULL OR NEW."amendmentSequenceAtEvaluation" IS NULL THEN
    RAISE EXCEPTION 'care_alarm_evidence: la evidencia nueva exige el snapshot de lo evaluado.'
      USING ERRCODE = '23514';
  END IF;

  SELECT o."definitionId", o."recordId", o."canonicalObservationId", o."occurrenceKey", d."code",
         o."valueBoolean", o."valueNumber", o."valueChoice"
    INTO v_definition, v_record, v_canonical, v_key, v_code,
         v_original_boolean, v_original_number, v_original_choice
    FROM "care_observation" o
    JOIN "care_observable_definition" d ON d."id" = o."definitionId" AND d."contextId" = o."contextId"
   WHERE o."id" = NEW."observationId" AND o."contextId" = NEW."contextId";

  IF v_definition IS NULL OR v_canonical IS NOT NULL OR v_definition <> NEW."observableDefinitionId" THEN
    RAISE EXCEPTION 'care_alarm_evidence: la observacion no es una ocurrencia canonica de esa definicion.'
      USING ERRCODE = '23514';
  END IF;

  SELECT v."observableDefinitionId", v."criterionId"
    INTO v_version_definition, v_version_criterion
    FROM "care_alarm_criterion_version" v
   WHERE v."id" = NEW."criterionVersionId" AND v."contextId" = NEW."contextId";

  SELECT a."criterionId"
    INTO v_alarm_criterion
    FROM "care_alarm" a
   WHERE a."id" = NEW."alarmId" AND a."contextId" = NEW."contextId";

  IF v_version_definition IS DISTINCT FROM NEW."observableDefinitionId"
     OR v_alarm_criterion IS DISTINCT FROM v_version_criterion THEN
    RAISE EXCEPTION 'care_alarm_evidence: la version del criterio no evalua esa definicion o esa alarma.'
      USING ERRCODE = '23514';
  END IF;

  SELECT COALESCE(max(s."sequence"), 0)
    INTO v_max_sequence
    FROM "care_record_amendment" s
   WHERE s."recordId" = v_record AND s."contextId" = NEW."contextId";

  IF NEW."amendmentSequenceAtEvaluation" <> v_max_sequence THEN
    RAISE EXCEPTION 'care_alarm_evidence: la secuencia de enmiendas no es la vigente al evaluar.'
      USING ERRCODE = '23514';
  END IF;

  SELECT am."id", am."replacementBoolean", am."replacementNumber", am."replacementChoice"
    INTO v_last_id, v_last_boolean, v_last_number, v_last_choice
    FROM "care_record_amendment" am
   WHERE am."observationId" = NEW."observationId" AND am."contextId" = NEW."contextId"
     AND num_nonnulls(am."replacementBoolean", am."replacementNumber", am."replacementChoice") = 1
   ORDER BY am."sequence" DESC
   LIMIT 1;

  IF v_last_id IS NULL THEN
    IF NEW."evaluatedAmendmentId" IS NOT NULL
       OR NEW."evaluatedValueBoolean" IS DISTINCT FROM v_original_boolean
       OR NEW."evaluatedValueNumber" IS DISTINCT FROM v_original_number
       OR NEW."evaluatedValueChoice" IS DISTINCT FROM v_original_choice THEN
      RAISE EXCEPTION 'care_alarm_evidence: el valor evaluado no es el original vigente.'
        USING ERRCODE = '23514';
    END IF;
  ELSIF NEW."evaluatedAmendmentId" IS DISTINCT FROM v_last_id
        OR NEW."evaluatedValueBoolean" IS DISTINCT FROM v_last_boolean
        OR NEW."evaluatedValueNumber" IS DISTINCT FROM v_last_number
        OR NEW."evaluatedValueChoice" IS DISTINCT FROM v_last_choice THEN
    RAISE EXCEPTION 'care_alarm_evidence: el valor evaluado no es la ultima correccion vigente.'
      USING ERRCODE = '23514';
  END IF;

  -- A04: una identidad de ocurrencia consumida por el criterio no vuelve a contar.
  IF EXISTS (
    SELECT 1
      FROM "care_alarm_evidence" e
      JOIN "care_alarm" a ON a."id" = e."alarmId" AND a."contextId" = e."contextId"
      JOIN "care_observation" eo ON eo."id" = e."observationId" AND eo."contextId" = e."contextId"
      JOIN "care_observable_definition" ed ON ed."id" = eo."definitionId" AND ed."contextId" = eo."contextId"
     WHERE e."contextId" = NEW."contextId"
       AND a."criterionId" = v_version_criterion
       AND ed."code" = v_code
       AND eo."occurrenceKey" = v_key
  ) THEN
    RAISE EXCEPTION 'care_alarm_evidence: esa ocurrencia ya fue consumida por el criterio.'
      USING ERRCODE = '23505';
  END IF;

  -- A04: frontera del episodio, estrictamente posterior al ultimo cierre.
  SELECT r."occurredAt"
    INTO v_occurred
    FROM "care_record" r
   WHERE r."id" = v_record AND r."contextId" = NEW."contextId";

  SELECT max(a."closedAt")
    INTO v_boundary
    FROM "care_alarm" a
   WHERE a."contextId" = NEW."contextId"
     AND a."criterionId" = v_version_criterion
     AND a."origin" = 'AUTOMATIC'
     AND a."state" = 'CERRADA'
     AND a."id" <> NEW."alarmId";

  IF v_boundary IS NOT NULL AND v_occurred <= v_boundary THEN
    RAISE EXCEPTION 'care_alarm_evidence: la ocurrencia no es posterior al cierre del episodio anterior.'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "care_alarm_evidence_snapshot_guard" BEFORE INSERT ON "care_alarm_evidence"
  FOR EACH ROW EXECUTE FUNCTION "merdn_care_alarm_evidence_snapshot_guard"();

-- ---------------------------------------------------------------------------
-- 3. Postflight
-- ---------------------------------------------------------------------------

DO $postflight$
DECLARE
  v_bad text[];
BEGIN
  SELECT array_agg(c.relname ORDER BY c.relname) INTO v_bad
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public'
     AND c.relname IN ('care_alarm_criterion_version', 'care_alarm_evidence', 'care_observable_definition',
                       'care_record_amendment')
     AND NOT (c.relrowsecurity AND c.relforcerowsecurity);

  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION '055/MP07A postflight: RLS/FORCE ausente en: %', array_to_string(v_bad, ', ');
  END IF;

  IF has_table_privilege('merdn_runtime', 'care_alarm_evidence', 'UPDATE')
     OR has_table_privilege('merdn_runtime', 'care_alarm_evidence', 'DELETE')
     OR has_table_privilege('merdn_runtime', 'care_alarm_criterion_version', 'DELETE')
     OR has_column_privilege('merdn_runtime', 'care_alarm_criterion_version', 'observableDefinitionId', 'UPDATE') THEN
    RAISE EXCEPTION '055/MP07A postflight: el runtime tiene privilegios de mas.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'care_alarm_evidence_append_only' AND NOT tgisinternal)
     OR NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'care_alarm_criterion_version_update_guard' AND NOT tgisinternal) THEN
    RAISE EXCEPTION '055/MP07A postflight: falta un guarda de inmutabilidad de MP04.';
  END IF;
END;
$postflight$;
