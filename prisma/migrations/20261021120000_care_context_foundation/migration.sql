-- ---------------------------------------------------------------------------
-- SPEC 055 / MP01 - Base de custodia institucional y autorizacion de cuidado.
--
-- Migracion ADITIVA. Crea:
--   1. Seis enums nuevos y DOS valores nuevos de "AuditEventType".
--   2. Cinco tablas nuevas: organization, organization_care_manager,
--      patient_care_context, clinical_competence_attestation y
--      care_authorization, con FK compuestas, CHECK e indices.
--   3. La columna NULLABLE "audit_event"."organizationId" con FK compuesta,
--      indice y un CHECK que obliga a los eventos CARE_CONTEXT_* a llevar actor
--      humano, sin rol y ambito institucional, y lo prohibe en otras familias.
--   4. Guardas de integridad: emisor manager vigente al emitir, coherencia de
--      sujeto/paciente de la relacion o asignacion citada, e inmutabilidad de
--      la procedencia con revocacion solo ACTIVE -> REVOKED.
--   5. ENABLE + FORCE RLS en las cinco tablas, politicas tenant + organizacion,
--      y una politica RESTRICTIVE nueva sobre audit_event.
--   6. Privilegios minimos del rol runtime: SELECT y, solo donde la politica
--      necesita bloquear filas con FOR SHARE, UPDATE de UNA columna inocua.
--
-- Lo que NO hace:
--   - NO inserta, actualiza ni borra NINGUNA fila: ninguna organizacion,
--     manager, contexto, competencia ni concesion nace por migracion, y los
--     datos heredados (relaciones, asignaciones, perfiles, solicitudes) NO
--     ganan acceso alguno;
--   - NO modifica enums, politicas, triggers ni CHECK existentes; NO amplia
--     HOME_CARE_COORDINATION ni VISITS_VIEW;
--   - NO concede INSERT, UPDATE general ni DELETE sobre las tablas nuevas al
--     runtime: MP01 no tiene ruta de escritura ni de provision publica;
--   - NO contiene secretos ni datos personales.
--
-- `ALTER TYPE ... ADD VALUE` se admite dentro de la transaccion, pero el valor
-- nuevo NO puede USARSE en ella: por eso el CHECK de auditoria compara
-- "eventType"::text y no un literal del enum.
--
-- Reversion operativa (spec 055 sec. 8): no requiere DROP. El paquete no esta
-- conectado a rutas existentes; se conservan tablas e historia.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 0. Preflight fail-closed
-- ---------------------------------------------------------------------------

DO $preflight$
DECLARE
  v_runtime oid;
BEGIN
  SELECT oid INTO v_runtime FROM pg_roles WHERE rolname = 'merdn_runtime';

  IF v_runtime IS NULL THEN
    RAISE EXCEPTION '055/MP01 preflight: el rol runtime merdn_runtime no existe.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_roles
     WHERE rolname = 'merdn_runtime'
       AND (rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication)
  ) THEN
    RAISE EXCEPTION '055/MP01 preflight: merdn_runtime tiene atributos inseguros.';
  END IF;

  IF (SELECT oid FROM pg_roles WHERE rolname = current_user) = v_runtime THEN
    RAISE EXCEPTION '055/MP01 preflight: la migracion no puede ejecutarse con el rol runtime.';
  END IF;

  IF to_regprocedure('public.merdn_current_tenant()') IS NULL THEN
    RAISE EXCEPTION '055/MP01 preflight: falta merdn_current_tenant().';
  END IF;
END;
$preflight$;

-- ---------------------------------------------------------------------------
-- 1. Enums
-- ---------------------------------------------------------------------------

CREATE TYPE "OrganizationKind" AS ENUM ('HOSPITAL', 'MUNICIPALITY', 'PROVIDER');
CREATE TYPE "OrganizationStatus" AS ENUM ('ACTIVE', 'DISABLED');
CREATE TYPE "CareAuthorityStatus" AS ENUM ('ACTIVE', 'REVOKED');
CREATE TYPE "CareActorKind" AS ENUM ('CAREGIVER', 'PROFESSIONAL', 'HOSPITAL_REVIEWER');
CREATE TYPE "CarePermission" AS ENUM (
  'VIEW_RECORDS',
  'CONTRIBUTE_RECORDS',
  'REQUEST_ALARM',
  'MANAGE_RULES',
  'REVIEW_ALARMS'
);
CREATE TYPE "CarePurpose" AS ENUM ('CARE_RECORDING_AND_ALERTS');

ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'CARE_CONTEXT_ACCESS_GRANTED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'CARE_CONTEXT_ACCESS_DENIED';

-- ---------------------------------------------------------------------------
-- 2. Ambito institucional de la transaccion
-- ---------------------------------------------------------------------------

-- Organizacion activa de la transaccion. Se fija con set_config(..., true):
-- alcance transaccional, nunca heredado por una conexion reutilizada del pool.
-- Ausente => NULL => ninguna fila institucional visible. Mal formado => error
-- de conversion => la consulta falla cerrada.
CREATE OR REPLACE FUNCTION "merdn_current_organization"() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('merdn.organization_id', true), '')::uuid;
$$;

-- ---------------------------------------------------------------------------
-- 3. Tablas
-- ---------------------------------------------------------------------------

CREATE TABLE "organization" (
  "id"          UUID NOT NULL,
  "tenantId"    UUID NOT NULL,
  "code"        TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "kind"        "OrganizationKind" NOT NULL,
  "status"      "OrganizationStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt"   TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "organization_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "organization_code_shape"
    CHECK ("code" ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  CONSTRAINT "organization_display_name_shape"
    CHECK (char_length("displayName") BETWEEN 1 AND 160 AND "displayName" = btrim("displayName"))
);

CREATE UNIQUE INDEX "organization_tenant_code_unique" ON "organization" ("tenantId", "code");
CREATE UNIQUE INDEX "organization_id_tenant_unique" ON "organization" ("id", "tenantId");

CREATE TABLE "organization_care_manager" (
  "id"                      UUID NOT NULL,
  "tenantId"                UUID NOT NULL,
  "organizationId"          UUID NOT NULL,
  "humanAccountId"          UUID NOT NULL,
  "status"                  "CareAuthorityStatus" NOT NULL DEFAULT 'ACTIVE',
  "startsAt"                TIMESTAMPTZ(6) NOT NULL,
  "endsAt"                  TIMESTAMPTZ(6),
  "authorizationReference"  TEXT NOT NULL,
  "grantedByHumanAccountId" UUID NOT NULL,
  "createdAt"               TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt"               TIMESTAMPTZ(6),
  "version"                 INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT "organization_care_manager_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "organization_care_manager_period_order"
    CHECK ("endsAt" IS NULL OR "endsAt" > "startsAt"),
  CONSTRAINT "organization_care_manager_revocation_coherent"
    CHECK (("status" = 'ACTIVE' AND "revokedAt" IS NULL) OR ("status" = 'REVOKED' AND "revokedAt" IS NOT NULL)),
  CONSTRAINT "organization_care_manager_version_positive" CHECK ("version" > 0),
  CONSTRAINT "organization_care_manager_reference_shape"
    CHECK ("authorizationReference" ~ '^[A-Z0-9][A-Z0-9._:-]{2,99}$'),
  -- Nadie se nombra a si mismo manager.
  CONSTRAINT "organization_care_manager_not_self_granted"
    CHECK ("grantedByHumanAccountId" <> "humanAccountId")
);

CREATE UNIQUE INDEX "organization_care_manager_scope_unique"
  ON "organization_care_manager" ("id", "tenantId", "organizationId");
CREATE UNIQUE INDEX "organization_care_manager_org_account_unique"
  ON "organization_care_manager" ("organizationId", "humanAccountId");
CREATE INDEX "organization_care_manager_lookup_idx"
  ON "organization_care_manager" ("tenantId", "organizationId", "humanAccountId", "status");

CREATE TABLE "patient_care_context" (
  "id"                      UUID NOT NULL,
  "tenantId"                UUID NOT NULL,
  "organizationId"          UUID NOT NULL,
  "patientId"               UUID NOT NULL,
  "status"                  "CareAuthorityStatus" NOT NULL DEFAULT 'ACTIVE',
  "authorizationReference"  TEXT NOT NULL,
  "createdByHumanAccountId" UUID NOT NULL,
  "createdAt"               TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt"               TIMESTAMPTZ(6),
  "version"                 INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT "patient_care_context_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "patient_care_context_revocation_coherent"
    CHECK (("status" = 'ACTIVE' AND "revokedAt" IS NULL) OR ("status" = 'REVOKED' AND "revokedAt" IS NOT NULL)),
  CONSTRAINT "patient_care_context_version_positive" CHECK ("version" > 0),
  CONSTRAINT "patient_care_context_reference_shape"
    CHECK ("authorizationReference" ~ '^[A-Z0-9][A-Z0-9._:-]{2,99}$')
);

CREATE UNIQUE INDEX "patient_care_context_tenant_org_patient_unique"
  ON "patient_care_context" ("tenantId", "organizationId", "patientId");
CREATE UNIQUE INDEX "patient_care_context_scope_unique"
  ON "patient_care_context" ("id", "tenantId", "organizationId", "patientId");

CREATE TABLE "clinical_competence_attestation" (
  "id"                        UUID NOT NULL,
  "tenantId"                  UUID NOT NULL,
  "organizationId"            UUID NOT NULL,
  "humanAccountId"            UUID NOT NULL,
  "status"                    "CareAuthorityStatus" NOT NULL DEFAULT 'ACTIVE',
  "evidenceReference"         TEXT NOT NULL,
  "validatedByHumanAccountId" UUID NOT NULL,
  "startsAt"                  TIMESTAMPTZ(6) NOT NULL,
  "endsAt"                    TIMESTAMPTZ(6),
  "createdAt"                 TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt"                 TIMESTAMPTZ(6),
  "version"                   INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT "clinical_competence_attestation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "clinical_competence_attestation_period_order"
    CHECK ("endsAt" IS NULL OR "endsAt" > "startsAt"),
  CONSTRAINT "clinical_competence_attestation_revocation_coherent"
    CHECK (("status" = 'ACTIVE' AND "revokedAt" IS NULL) OR ("status" = 'REVOKED' AND "revokedAt" IS NOT NULL)),
  CONSTRAINT "clinical_competence_attestation_version_positive" CHECK ("version" > 0),
  CONSTRAINT "clinical_competence_attestation_reference_shape"
    CHECK ("evidenceReference" ~ '^[A-Z0-9][A-Z0-9._:-]{2,99}$'),
  -- Nadie valida su propia competencia.
  CONSTRAINT "clinical_competence_attestation_not_self_validated"
    CHECK ("validatedByHumanAccountId" <> "humanAccountId")
);

CREATE UNIQUE INDEX "clinical_competence_attestation_scope_unique"
  ON "clinical_competence_attestation" ("id", "tenantId", "organizationId", "humanAccountId");
CREATE INDEX "clinical_competence_attestation_lookup_idx"
  ON "clinical_competence_attestation" ("tenantId", "organizationId", "humanAccountId", "status");

CREATE TABLE "care_authorization" (
  "id"                      UUID NOT NULL,
  "tenantId"                UUID NOT NULL,
  "organizationId"          UUID NOT NULL,
  "contextId"               UUID NOT NULL,
  "patientId"               UUID NOT NULL,
  "humanAccountId"          UUID NOT NULL,
  "actorKind"               "CareActorKind" NOT NULL,
  "permission"              "CarePermission" NOT NULL,
  "purpose"                 "CarePurpose" NOT NULL,
  "status"                  "CareAuthorityStatus" NOT NULL DEFAULT 'ACTIVE',
  "startsAt"                TIMESTAMPTZ(6) NOT NULL,
  "endsAt"                  TIMESTAMPTZ(6),
  "caregiverRelationshipId" UUID,
  "careAssignmentId"        UUID,
  "competenceAttestationId" UUID,
  "authorizationReference"  TEXT NOT NULL,
  "grantedByHumanAccountId" UUID NOT NULL,
  "createdAt"               TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt"               TIMESTAMPTZ(6),
  "version"                 INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT "care_authorization_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "care_authorization_period_order"
    CHECK ("endsAt" IS NULL OR "endsAt" > "startsAt"),
  CONSTRAINT "care_authorization_revocation_coherent"
    CHECK (("status" = 'ACTIVE' AND "revokedAt" IS NULL) OR ("status" = 'REVOKED' AND "revokedAt" IS NOT NULL)),
  CONSTRAINT "care_authorization_version_positive" CHECK ("version" > 0),
  CONSTRAINT "care_authorization_reference_shape"
    CHECK ("authorizationReference" ~ '^[A-Z0-9][A-Z0-9._:-]{2,99}$'),
  -- Forma por tipo de actor (055/MP01 sec. 2):
  --   CAREGIVER: relacion obligatoria; sin asignacion ni competencia; nunca
  --     MANAGE_RULES ni REVIEW_ALARMS.
  --   PROFESSIONAL: asignacion obligatoria; sin relacion de cuidador;
  --     competencia obligatoria para MANAGE_RULES y REVIEW_ALARMS.
  --   HOSPITAL_REVIEWER: sin relacion ni asignacion; solo VIEW_RECORDS o
  --     REVIEW_ALARMS y siempre con competencia.
  CONSTRAINT "care_authorization_actor_shape" CHECK (
    (
      "actorKind" = 'CAREGIVER'
      AND "caregiverRelationshipId" IS NOT NULL
      AND "careAssignmentId" IS NULL
      AND "competenceAttestationId" IS NULL
      AND "permission" IN ('VIEW_RECORDS', 'CONTRIBUTE_RECORDS', 'REQUEST_ALARM')
    )
    OR (
      "actorKind" = 'PROFESSIONAL'
      AND "careAssignmentId" IS NOT NULL
      AND "caregiverRelationshipId" IS NULL
      AND ("permission" NOT IN ('MANAGE_RULES', 'REVIEW_ALARMS') OR "competenceAttestationId" IS NOT NULL)
    )
    OR (
      "actorKind" = 'HOSPITAL_REVIEWER'
      AND "caregiverRelationshipId" IS NULL
      AND "careAssignmentId" IS NULL
      AND "competenceAttestationId" IS NOT NULL
      AND "permission" IN ('VIEW_RECORDS', 'REVIEW_ALARMS')
    )
  ),
  -- Un emisor no se autoconcede autoridad clinica de reglas ni de revision.
  CONSTRAINT "care_authorization_no_self_clinical_grant"
    CHECK ("grantedByHumanAccountId" <> "humanAccountId" OR "permission" NOT IN ('MANAGE_RULES', 'REVIEW_ALARMS'))
);

CREATE UNIQUE INDEX "care_authorization_id_tenant_org_unique"
  ON "care_authorization" ("id", "tenantId", "organizationId");
CREATE INDEX "care_authorization_lookup_idx"
  ON "care_authorization" ("tenantId", "organizationId", "contextId", "humanAccountId", "status");
-- Una sola concesion ACTIVE por contexto/cuenta/actor/accion. Revocar conserva
-- la fila y libera el indice para una concesion nueva.
CREATE UNIQUE INDEX "care_authorization_active_unique"
  ON "care_authorization" ("contextId", "humanAccountId", "actorKind", "permission")
  WHERE "status" = 'ACTIVE';

-- ---------------------------------------------------------------------------
-- 4. Claves foraneas compuestas. Ninguna borra ni actualiza en cascada.
-- ---------------------------------------------------------------------------

ALTER TABLE "organization"
  ADD CONSTRAINT "organization_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "organization_care_manager"
  ADD CONSTRAINT "organization_care_manager_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "organization_care_manager_organizationId_tenantId_fkey"
  FOREIGN KEY ("organizationId", "tenantId") REFERENCES "organization" ("id", "tenantId") ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "organization_care_manager_humanAccountId_tenantId_fkey"
  FOREIGN KEY ("humanAccountId", "tenantId") REFERENCES "human_account" ("id", "tenantId") ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "organization_care_manager_grantor_fkey"
  FOREIGN KEY ("grantedByHumanAccountId", "tenantId") REFERENCES "human_account" ("id", "tenantId") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "patient_care_context"
  ADD CONSTRAINT "patient_care_context_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "patient_care_context_organizationId_tenantId_fkey"
  FOREIGN KEY ("organizationId", "tenantId") REFERENCES "organization" ("id", "tenantId") ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "patient_care_context_patientId_tenantId_fkey"
  FOREIGN KEY ("patientId", "tenantId") REFERENCES "patient" ("id", "tenantId") ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "patient_care_context_createdByHumanAccountId_tenantId_fkey"
  FOREIGN KEY ("createdByHumanAccountId", "tenantId") REFERENCES "human_account" ("id", "tenantId") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "clinical_competence_attestation"
  ADD CONSTRAINT "clinical_competence_attestation_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "clinical_competence_attestation_organizationId_tenantId_fkey"
  FOREIGN KEY ("organizationId", "tenantId") REFERENCES "organization" ("id", "tenantId") ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "clinical_competence_attestation_humanAccountId_tenantId_fkey"
  FOREIGN KEY ("humanAccountId", "tenantId") REFERENCES "human_account" ("id", "tenantId") ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "clinical_competence_attestation_validator_fkey"
  FOREIGN KEY ("validatedByHumanAccountId", "tenantId") REFERENCES "human_account" ("id", "tenantId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- La concesion referencia el contexto por SUS CUATRO campos: contexto,
-- tenant, organizacion y paciente deben coincidir a la vez. La competencia se
-- referencia por id/tenant/organizacion/cuenta: no se puede citar la de otra
-- organizacion ni la de otra persona. Las columnas acompanantes son NOT NULL,
-- de modo que una referencia presente se comprueba completa (MATCH SIMPLE solo
-- omite la comprobacion cuando la propia referencia opcional es NULL, y la
-- forma por actor decide cuando puede serlo).
ALTER TABLE "care_authorization"
  ADD CONSTRAINT "care_authorization_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "care_authorization_context_fkey"
  FOREIGN KEY ("contextId", "tenantId", "organizationId", "patientId")
  REFERENCES "patient_care_context" ("id", "tenantId", "organizationId", "patientId") ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "care_authorization_humanAccountId_tenantId_fkey"
  FOREIGN KEY ("humanAccountId", "tenantId") REFERENCES "human_account" ("id", "tenantId") ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "care_authorization_grantedByHumanAccountId_tenantId_fkey"
  FOREIGN KEY ("grantedByHumanAccountId", "tenantId") REFERENCES "human_account" ("id", "tenantId") ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "care_authorization_caregiverRelationshipId_tenantId_fkey"
  FOREIGN KEY ("caregiverRelationshipId", "tenantId") REFERENCES "patient_caregiver_relationship" ("id", "tenantId") ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "care_authorization_careAssignmentId_tenantId_fkey"
  FOREIGN KEY ("careAssignmentId", "tenantId") REFERENCES "care_assignment" ("id", "tenantId") ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "care_authorization_competence_fkey"
  FOREIGN KEY ("competenceAttestationId", "tenantId", "organizationId", "humanAccountId")
  REFERENCES "clinical_competence_attestation" ("id", "tenantId", "organizationId", "humanAccountId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- ---------------------------------------------------------------------------
-- 5. Guardas de integridad
-- ---------------------------------------------------------------------------

-- Emision de una concesion. Se evalua bajo el rol que inserta y, por tanto,
-- bajo su RLS: si el emisor no es visible como manager vigente, la emision
-- falla cerrada.
--   - el instante de emision lo fija la base, no el cliente;
--   - el emisor es manager ACTIVE y vigente de ESA organizacion al emitir;
--   - la relacion citada es del MISMO paciente y su persona cuidadora es la
--     persona de la cuenta concedida;
--   - la asignacion citada es del MISMO paciente y su perfil profesional es de
--     la persona de la cuenta concedida.
CREATE OR REPLACE FUNCTION "merdn_care_authorization_issuance_guard"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW."createdAt" := now();

  IF NOT EXISTS (
    SELECT 1
      FROM "organization_care_manager" m
     WHERE m."tenantId" = NEW."tenantId"
       AND m."organizationId" = NEW."organizationId"
       AND m."humanAccountId" = NEW."grantedByHumanAccountId"
       AND m."status" = 'ACTIVE'
       AND m."revokedAt" IS NULL
       AND m."startsAt" <= NEW."createdAt"
       AND (m."endsAt" IS NULL OR m."endsAt" > NEW."createdAt")
  ) THEN
    RAISE EXCEPTION 'care_authorization: el emisor no es manager vigente de la organizacion.'
      USING ERRCODE = '23514';
  END IF;

  IF NEW."caregiverRelationshipId" IS NOT NULL AND NOT EXISTS (
    SELECT 1
      FROM "patient_caregiver_relationship" r
      JOIN "human_account" a
        ON a."id" = NEW."humanAccountId"
       AND a."tenantId" = NEW."tenantId"
     WHERE r."id" = NEW."caregiverRelationshipId"
       AND r."tenantId" = NEW."tenantId"
       AND r."patientId" = NEW."patientId"
       AND r."caregiverPersonId" = a."personId"
  ) THEN
    RAISE EXCEPTION 'care_authorization: la relacion citada no corresponde al paciente y a la persona concedida.'
      USING ERRCODE = '23514';
  END IF;

  IF NEW."careAssignmentId" IS NOT NULL AND NOT EXISTS (
    SELECT 1
      FROM "care_assignment" c
      JOIN "professional_profile" p
        ON p."id" = c."professionalId"
       AND p."tenantId" = c."tenantId"
      JOIN "human_account" a
        ON a."id" = NEW."humanAccountId"
       AND a."tenantId" = NEW."tenantId"
     WHERE c."id" = NEW."careAssignmentId"
       AND c."tenantId" = NEW."tenantId"
       AND c."patientId" = NEW."patientId"
       AND p."personId" = a."personId"
  ) THEN
    RAISE EXCEPTION 'care_authorization: la asignacion citada no corresponde al paciente y a la persona concedida.'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "care_authorization_issuance_guard"
  BEFORE INSERT ON "care_authorization"
  FOR EACH ROW EXECUTE FUNCTION "merdn_care_authorization_issuance_guard"();

-- Procedencia inmutable. Solo cambian "status", "revokedAt" y "version"; la
-- revocacion es TERMINAL y su instante no se reescribe. Aplica a todos los
-- roles, incluido el propietario.
--
-- El instante de revocacion lo fija la BASE, como el de emision: un cliente no
-- puede fecharla en el pasado para anular retroactivamente lo que se emitio
-- mientras la autoridad estaba vigente, y la comparacion emision/revocacion no
-- depende del reloj de otra maquina.
CREATE OR REPLACE FUNCTION "merdn_care_authority_revocation_guard"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF (to_jsonb(NEW) - ARRAY['status', 'revokedAt', 'version'])
       IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['status', 'revokedAt', 'version']) THEN
    RAISE EXCEPTION '%: la procedencia es inmutable; solo se admite revocar.', TG_TABLE_NAME
      USING ERRCODE = '42501';
  END IF;

  IF OLD."status"::text = 'REVOKED'
     AND (NEW."status"::text <> 'REVOKED' OR NEW."revokedAt" IS DISTINCT FROM OLD."revokedAt") THEN
    RAISE EXCEPTION '%: la revocacion es terminal.', TG_TABLE_NAME
      USING ERRCODE = '42501';
  END IF;

  IF OLD."status"::text = 'ACTIVE' AND NEW."status"::text = 'REVOKED' THEN
    NEW."revokedAt" := clock_timestamp();
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "organization_care_manager_revocation_guard"
  BEFORE UPDATE ON "organization_care_manager"
  FOR EACH ROW EXECUTE FUNCTION "merdn_care_authority_revocation_guard"();

CREATE TRIGGER "patient_care_context_revocation_guard"
  BEFORE UPDATE ON "patient_care_context"
  FOR EACH ROW EXECUTE FUNCTION "merdn_care_authority_revocation_guard"();

CREATE TRIGGER "clinical_competence_attestation_revocation_guard"
  BEFORE UPDATE ON "clinical_competence_attestation"
  FOR EACH ROW EXECUTE FUNCTION "merdn_care_authority_revocation_guard"();

CREATE TRIGGER "care_authorization_revocation_guard"
  BEFORE UPDATE ON "care_authorization"
  FOR EACH ROW EXECUTE FUNCTION "merdn_care_authority_revocation_guard"();

-- ---------------------------------------------------------------------------
-- 6. Auditoria: ambito institucional ADITIVO
-- ---------------------------------------------------------------------------

-- Nullable SOLO para filas y familias de eventos anteriores. Anadir una
-- columna nula no reescribe ni dispara el trigger append-only.
ALTER TABLE "audit_event" ADD COLUMN "organizationId" UUID;

ALTER TABLE "audit_event"
  ADD CONSTRAINT "audit_event_organizationId_tenantId_fkey"
  FOREIGN KEY ("organizationId", "tenantId") REFERENCES "organization" ("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE INDEX "audit_event_tenant_organization_occurred_idx"
  ON "audit_event" ("tenantId", "organizationId", "occurredAt");

-- Forma de la familia CARE_CONTEXT_*: actor humano opaco, sin rol, recurso
-- logico constante y organizacion SIEMPRE resuelta. Conceder nombra el
-- contexto; denegar NUNCA lo revela. Una organizacion solicitada que no existe
-- en el tenant no puede ser FK: esa denegacion usa el evento generico
-- EXPERIENCE_ACCESS_DENIED con organizacion nula (055/MP01 sec. 5).
--
-- La lista se ENUMERA: un prefijo literal 'CARE_' incluiria tambien el evento
-- historico CARE_ASSIGNMENT_CREATED, cuyas filas tienen organizacion nula.
-- Ninguna otra familia puede llevar organizacion: las filas historicas
-- conservan NULL y la politica RESTRICTIVE solo afecta a esta familia.
ALTER TABLE "audit_event"
  ADD CONSTRAINT "audit_event_care_context_scope"
  CHECK (
    (
      "eventType"::text NOT IN ('CARE_CONTEXT_ACCESS_GRANTED', 'CARE_CONTEXT_ACCESS_DENIED')
      AND "organizationId" IS NULL
    )
    OR (
      "actorType" = 'HUMAN_ACCOUNT'
      AND "actorUserId" IS NOT NULL
      AND "actorRole" IS NULL
      AND "resourceType" = 'CareContext'
      AND "organizationId" IS NOT NULL
      AND (
        (
          "eventType"::text = 'CARE_CONTEXT_ACCESS_GRANTED'
          AND "outcome" = 'SUCCESS'
          AND "resourceId" IS NOT NULL
        )
        OR (
          "eventType"::text = 'CARE_CONTEXT_ACCESS_DENIED'
          AND "outcome" = 'DENIED'
          AND "resourceId" IS NULL
        )
      )
    )
  );

-- ---------------------------------------------------------------------------
-- 7. Row Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE "organization"                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "organization"                    FORCE  ROW LEVEL SECURITY;
ALTER TABLE "organization_care_manager"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "organization_care_manager"       FORCE  ROW LEVEL SECURITY;
ALTER TABLE "patient_care_context"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "patient_care_context"            FORCE  ROW LEVEL SECURITY;
ALTER TABLE "clinical_competence_attestation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "clinical_competence_attestation" FORCE  ROW LEVEL SECURITY;
ALTER TABLE "care_authorization"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE "care_authorization"              FORCE  ROW LEVEL SECURITY;

-- La organizacion usa su propio id como ambito institucional.
CREATE POLICY "organization_scope" ON "organization"
  FOR ALL TO "merdn_runtime"
  USING ("tenantId" = "merdn_current_tenant"() AND "id" = "merdn_current_organization"())
  WITH CHECK ("tenantId" = "merdn_current_tenant"() AND "id" = "merdn_current_organization"());

CREATE POLICY "organization_care_manager_scope" ON "organization_care_manager"
  FOR ALL TO "merdn_runtime"
  USING ("tenantId" = "merdn_current_tenant"() AND "organizationId" = "merdn_current_organization"())
  WITH CHECK ("tenantId" = "merdn_current_tenant"() AND "organizationId" = "merdn_current_organization"());

CREATE POLICY "patient_care_context_scope" ON "patient_care_context"
  FOR ALL TO "merdn_runtime"
  USING ("tenantId" = "merdn_current_tenant"() AND "organizationId" = "merdn_current_organization"())
  WITH CHECK ("tenantId" = "merdn_current_tenant"() AND "organizationId" = "merdn_current_organization"());

CREATE POLICY "clinical_competence_attestation_scope" ON "clinical_competence_attestation"
  FOR ALL TO "merdn_runtime"
  USING ("tenantId" = "merdn_current_tenant"() AND "organizationId" = "merdn_current_organization"())
  WITH CHECK ("tenantId" = "merdn_current_tenant"() AND "organizationId" = "merdn_current_organization"());

CREATE POLICY "care_authorization_scope" ON "care_authorization"
  FOR ALL TO "merdn_runtime"
  USING ("tenantId" = "merdn_current_tenant"() AND "organizationId" = "merdn_current_organization"())
  WITH CHECK ("tenantId" = "merdn_current_tenant"() AND "organizationId" = "merdn_current_organization"());

-- RESTRICTIVA: se combina por AND con las politicas permisivas existentes de
-- audit_event, que NO se modifican. Las filas con organizacion solo se leen o
-- escriben bajo esa misma organizacion; las filas NULL (historicas y de otras
-- familias) siguen gobernadas solo por sus politicas actuales.
CREATE POLICY "audit_event_organization_scope" ON "audit_event"
  AS RESTRICTIVE
  FOR ALL TO "merdn_runtime"
  USING ("organizationId" IS NULL OR "organizationId" = "merdn_current_organization"())
  WITH CHECK ("organizationId" IS NULL OR "organizationId" = "merdn_current_organization"());

-- ---------------------------------------------------------------------------
-- 8. Privilegios minimos del rol runtime
-- ---------------------------------------------------------------------------

-- Lectura de las tablas nuevas. Sin INSERT ni DELETE: MP01 no tiene ruta de
-- escritura y la provision es controlada fuera del runtime.
GRANT SELECT ON TABLE "organization"                    TO "merdn_runtime";
GRANT SELECT ON TABLE "organization_care_manager"       TO "merdn_runtime";
GRANT SELECT ON TABLE "patient_care_context"            TO "merdn_runtime";
GRANT SELECT ON TABLE "clinical_competence_attestation" TO "merdn_runtime";
GRANT SELECT ON TABLE "care_authorization"              TO "merdn_runtime";

-- `SELECT ... FOR SHARE` exige privilegio UPDATE sobre al menos una columna.
-- Se concede UNA columna inocua por tabla bloqueada, nunca estado, vigencia,
-- sujeto ni procedencia; el guard de revocacion impide ademas cualquier otro
-- cambio. No convierte al runtime en propietario ni altera politicas.
GRANT UPDATE ("updatedAt") ON TABLE "organization"                    TO "merdn_runtime";
GRANT UPDATE ("version")   ON TABLE "patient_care_context"            TO "merdn_runtime";
GRANT UPDATE ("version")   ON TABLE "clinical_competence_attestation" TO "merdn_runtime";
GRANT UPDATE ("version")   ON TABLE "care_authorization"              TO "merdn_runtime";

-- Fuentes de autorizacion EXISTENTES que la politica bloquea y que hoy solo
-- admiten SELECT (o SELECT/INSERT). Solo "updatedAt": no cambia estado,
-- vigencia ni pertenencia y las politicas historicas quedan intactas.
GRANT UPDATE ("updatedAt") ON TABLE "care_assignment"          TO "merdn_runtime";
GRANT UPDATE ("updatedAt") ON TABLE "professional_profile"     TO "merdn_runtime";
GRANT UPDATE ("updatedAt") ON TABLE "professional_affiliation" TO "merdn_runtime";

-- ---------------------------------------------------------------------------
-- 9. Postflight
-- ---------------------------------------------------------------------------

DO $postflight$
DECLARE
  v_tables text[] := ARRAY[
    'organization',
    'organization_care_manager',
    'patient_care_context',
    'clinical_competence_attestation',
    'care_authorization'
  ];
  v_bad text[];
BEGIN
  SELECT array_agg(c.relname ORDER BY c.relname) INTO v_bad
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public'
     AND c.relname = ANY (v_tables)
     AND NOT (c.relrowsecurity AND c.relforcerowsecurity);

  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION '055/MP01 postflight: RLS/FORCE ausente en: %', array_to_string(v_bad, ', ');
  END IF;

  SELECT array_agg(c.relname ORDER BY c.relname) INTO v_bad
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_roles r ON r.oid = c.relowner
   WHERE n.nspname = 'public'
     AND c.relname = ANY (v_tables)
     AND r.rolname = 'merdn_runtime';

  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION '055/MP01 postflight: el runtime es propietario de: %', array_to_string(v_bad, ', ');
  END IF;

  IF EXISTS (SELECT 1 FROM "organization")
     OR EXISTS (SELECT 1 FROM "organization_care_manager")
     OR EXISTS (SELECT 1 FROM "patient_care_context")
     OR EXISTS (SELECT 1 FROM "clinical_competence_attestation")
     OR EXISTS (SELECT 1 FROM "care_authorization") THEN
    RAISE EXCEPTION '055/MP01 postflight: la migracion no debe crear filas.';
  END IF;
END;
$postflight$;
