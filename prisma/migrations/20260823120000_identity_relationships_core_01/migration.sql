-- ---------------------------------------------------------------------------
-- IDENTITY-RELATIONSHIPS-CORE-01 — migracion ADITIVA unica.
--
-- Contenido:
--   1. Extension `btree_gist`, exigida por la garantia DB contra relaciones
--      ACTIVE solapadas (packet §5.5 constraint 7).
--   2. Valor nuevo en "InstitutionalRole": el rol de gestion de relaciones
--      Paciente-Cuidador (AD-03).
--   3. Dos valores nuevos en "AuditActorType" y ocho en "AuditEventType".
--   4. Ocho enums nuevos y SEIS tablas nuevas: cuenta humana, vinculo con
--      identidad externa, sesion humana, intento de autenticacion OIDC,
--      relacion Paciente-Cuidador y sus alcances.
--   5. Restricciones de integridad, trigger tenant-aware contra la
--      autorrelacion y exclusion constraint contra solapamiento.
--   6. Privilegios de minimo privilegio y Row Level Security FORZADA por
--      tenant para las seis tablas nuevas.
--
-- Caracter: ADITIVO. No crea una segunda persona, no duplica identidad, no
-- borra filas, no elimina tablas, columnas ni tipos, no reescribe ninguna
-- migracion anterior y no toca volumenes.
--
-- NO INSERTA NINGUN DATO. No hay cuentas, vinculos, sesiones ni relaciones de
-- demostracion: una instalacion sin datos no autentica a nadie, que es el
-- comportamiento fail-closed deseado.
--
-- NO contiene ningun secreto: la credencial de la identidad institucional de
-- gestion de relaciones se aprovisiona en ejecucion desde la configuracion del
-- servidor y solo se almacena su derivacion `scrypt`. El vinculo OIDC lo crea
-- exclusivamente el comando de provisioning administrativo.
--
-- Rollback documentado:
-- `prisma/migrations/ROLLBACK-identity_relationships_core_01.sql`.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1. Extension btree_gist
-- ---------------------------------------------------------------------------
--
-- Necesaria para combinar igualdad sobre uuid y enum con solapamiento sobre un
-- rango temporal en una MISMA exclusion constraint. Sin ella, la garantia
-- contra relaciones ACTIVE solapadas solo podria vivir en la aplicacion, y una
-- carrera concurrente la atravesaria. Declaracion IDEMPOTENTE.
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- ---------------------------------------------------------------------------
-- 2. Rol institucional de gestion de relaciones (AD-03)
-- ---------------------------------------------------------------------------
--
-- Aditivo y DISJUNTO: las identidades y sesiones ya emitidas conservan su rol
-- sin cambio alguno. `CAREGIVER_RELATIONSHIP_MANAGER` NO obtiene poderes de
-- Scheduler, no accede a Hospital Pacientes, no accede a los agregados
-- municipales y NO es una identidad humana.
ALTER TYPE "InstitutionalRole" ADD VALUE IF NOT EXISTS 'CAREGIVER_RELATIONSHIP_MANAGER';

-- ---------------------------------------------------------------------------
-- 3. Actores y eventos de auditoria
-- ---------------------------------------------------------------------------
--
-- `HUMAN_ACCOUNT` identifica a la cuenta humana OPACA mediante
-- `HumanAccount.id`: nunca un nombre, un documento ni un `subject` OIDC.
-- `SYSTEM` identifica al proceso de provisioning, que NO es una persona y por
-- tanto nunca lleva `actorUserId` ni `actorRole`.
ALTER TYPE "AuditActorType" ADD VALUE IF NOT EXISTS 'HUMAN_ACCOUNT';
ALTER TYPE "AuditActorType" ADD VALUE IF NOT EXISTS 'SYSTEM';

ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'HUMAN_IDENTITY_LINKED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'HUMAN_IDENTITY_UNLINKED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'HUMAN_ACCOUNT_DISABLED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'HUMAN_SESSION_CREATED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'HUMAN_SESSION_REVOKED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'CAREGIVER_RELATIONSHIP_CREATED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'CAREGIVER_RELATIONSHIP_VALIDATED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'CAREGIVER_RELATIONSHIP_REVOKED';

-- NOTA DELIBERADA sobre `audit_event_resource_required`.
--
-- El check vigente expresa el invariante en forma NEGATIVA: solo los eventos
-- listados estan obligados a nombrar su recurso. Los ocho eventos que anade
-- esta migracion caen por tanto del lado permitido sin tocar el check.
--
-- La aplicacion SI escribe siempre su recurso —cuenta, sesion o relacion— y sus
-- pruebas lo verifican. NO se anaden a la lista positiva del check porque
-- PostgreSQL prohibe usar en la MISMA transaccion un valor de enum anadido en
-- esa misma transaccion. Endurecer el check exige una migracion posterior
-- separada; se reporta como riesgo residual conocido, igual que en
-- TASK-HOSPITAL-CORE-02.
--
-- `audit_event_actor_role_scope` NO necesita cambio: exige `actorRole IS NULL`
-- salvo para `INSTITUTIONAL_IDENTITY`, y tanto `HUMAN_ACCOUNT` como `SYSTEM`
-- escriben `actorRole` nulo por contrato.

-- ---------------------------------------------------------------------------
-- 4. Enums del dominio de identidad humana y relacion
-- ---------------------------------------------------------------------------

CREATE TYPE "HumanAccountStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- `UNLINKED` conserva la fila como historia: el vinculo no se borra.
CREATE TYPE "ExternalAuthIdentityStatus" AS ENUM ('ACTIVE', 'UNLINKED');

-- Catalogos CERRADOS (AD-05). No autorizan representacion legal, tutela ni
-- parentesco, y no existe `SUSPENDED`, wildcard, `VISITS_CONTRIBUTE` ni
-- `VISITS_EXECUTE`.
CREATE TYPE "PatientCaregiverRelationshipType" AS ENUM ('DECLARED_CARE_SUPPORT');

CREATE TYPE "PatientCaregiverPurpose" AS ENUM ('HOME_CARE_COORDINATION');

CREATE TYPE "PatientCaregiverRelationshipStatus" AS ENUM (
  'PENDING_VALIDATION', 'ACTIVE', 'REVOKED', 'EXPIRED'
);

CREATE TYPE "CaregiverScope" AS ENUM ('VISITS_VIEW');

-- Declara EXPLICITAMENTE que la validacion es una asercion de operador en un
-- MVP controlado: no es verificacion de identidad ni autorizacion legal.
CREATE TYPE "CaregiverRelationshipValidationSource" AS ENUM (
  'CONTROLLED_MVP_OPERATOR_ASSERTION'
);

CREATE TYPE "CaregiverRelationshipRevocationReason" AS ENUM (
  'AUTHORIZATION_WITHDRAWN', 'RELATIONSHIP_ENDED', 'CREATED_IN_ERROR'
);

-- ---------------------------------------------------------------------------
-- 5. Cuenta humana
-- ---------------------------------------------------------------------------
--
-- Una cuenta es la capacidad de AUTENTICARSE como la unica `Person` del tenant.
-- No duplica nombre, documento, contacto ni fecha de nacimiento.

CREATE TABLE "human_account" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "personId" UUID NOT NULL,
  "status" "HumanAccountStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "human_account_pkey" PRIMARY KEY ("id")
);

-- Permite FKs compuestas que impiden asociaciones entre tenants distintos.
CREATE UNIQUE INDEX "human_account_id_tenant_unique"
  ON "human_account" ("id", "tenantId");

CREATE INDEX "human_account_tenant_person_status_idx"
  ON "human_account" ("tenantId", "personId", "status");

-- DELIBERADAMENTE NO se crea un indice unico por `Person`: `docs/DATA.md` y el
-- packet §5.2 admiten 0..* cuentas por persona. Anadirlo cerraria un caso
-- expresamente autorizado.

ALTER TABLE "human_account"
  ADD CONSTRAINT "human_account_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Clave foranea COMPUESTA: una cuenta nunca puede apuntar a una persona de otra
-- institucion, aunque se conozca su identificador.
ALTER TABLE "human_account"
  ADD CONSTRAINT "human_account_person_fkey"
  FOREIGN KEY ("personId", "tenantId")
  REFERENCES "person" ("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 6. Vinculo con la identidad externa OIDC
-- ---------------------------------------------------------------------------

CREATE TABLE "external_auth_identity" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "humanAccountId" UUID NOT NULL,
  "issuer" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "status" "ExternalAuthIdentityStatus" NOT NULL DEFAULT 'ACTIVE',
  "linkedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "unlinkedAt" TIMESTAMPTZ(6),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "external_auth_identity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "external_auth_identity_id_tenant_unique"
  ON "external_auth_identity" ("id", "tenantId");

-- Un `subject` de un emisor resuelve UNA sola cuenta dentro del tenant. Es la
-- barrera final contra vinculos ambiguos y contra carreras concurrentes.
CREATE UNIQUE INDEX "external_auth_identity_tenant_issuer_subject_unique"
  ON "external_auth_identity" ("tenantId", "issuer", "subject");

CREATE INDEX "external_auth_identity_tenant_account_status_idx"
  ON "external_auth_identity" ("tenantId", "humanAccountId", "status");

ALTER TABLE "external_auth_identity"
  ADD CONSTRAINT "external_auth_identity_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "external_auth_identity"
  ADD CONSTRAINT "external_auth_identity_account_fkey"
  FOREIGN KEY ("humanAccountId", "tenantId")
  REFERENCES "human_account" ("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- `issuer` y `subject` son OPACOS y se guardan tal como los emite y verifica el
-- proveedor. Se acota su LONGITUD, no su contenido: normalizarlos cambiaria el
-- valor que OIDC verifico y rompería el vinculo.
ALTER TABLE "external_auth_identity"
  ADD CONSTRAINT "external_auth_identity_issuer_length"
  CHECK (length("issuer") BETWEEN 1 AND 2048);

ALTER TABLE "external_auth_identity"
  ADD CONSTRAINT "external_auth_identity_subject_length"
  CHECK (length("subject") BETWEEN 1 AND 255);

-- Un vinculo ACTIVO no declara fecha de desvinculacion; uno UNLINKED si.
ALTER TABLE "external_auth_identity"
  ADD CONSTRAINT "external_auth_identity_status_scope"
  CHECK (
    ("status" = 'ACTIVE' AND "unlinkedAt" IS NULL)
    OR ("status" = 'UNLINKED' AND "unlinkedAt" IS NOT NULL)
  );

-- ---------------------------------------------------------------------------
-- 7. Sesion humana
-- ---------------------------------------------------------------------------
--
-- Entidad SEPARADA de `enrollment_session` y de `institutional_session`. El
-- token en claro NUNCA se persiste: aqui solo vive su hash.

CREATE TABLE "human_session" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "humanAccountId" UUID NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMPTZ(6) NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastUsedAt" TIMESTAMPTZ(6),
  "revokedAt" TIMESTAMPTZ(6),

  CONSTRAINT "human_session_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "human_session_tokenHash_key"
  ON "human_session" ("tokenHash");

CREATE UNIQUE INDEX "human_session_id_tenant_unique"
  ON "human_session" ("id", "tenantId");

CREATE INDEX "human_session_tenant_account_idx"
  ON "human_session" ("tenantId", "humanAccountId");

CREATE INDEX "human_session_expires_at_idx"
  ON "human_session" ("expiresAt");

ALTER TABLE "human_session"
  ADD CONSTRAINT "human_session_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "human_session"
  ADD CONSTRAINT "human_session_account_fkey"
  FOREIGN KEY ("humanAccountId", "tenantId")
  REFERENCES "human_account" ("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Una sesion no puede caducar antes de existir.
ALTER TABLE "human_session"
  ADD CONSTRAINT "human_session_period_order"
  CHECK ("expiresAt" > "createdAt");

-- ---------------------------------------------------------------------------
-- 8. Intento de autenticacion OIDC (packet §4.3)
-- ---------------------------------------------------------------------------
--
-- El navegador solo custodia un token OPACO. State y nonce viven HASHEADOS y el
-- verifier PKCE vive CIFRADO con AES-256-GCM, de modo que una lectura de la
-- base no permite completar un intento ajeno.

CREATE TABLE "human_auth_attempt" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "browserTokenHash" TEXT NOT NULL,
  "stateHash" TEXT NOT NULL,
  "nonceHash" TEXT NOT NULL,
  "pkceVerifierCiphertext" TEXT NOT NULL,
  "pkceVerifierIv" TEXT NOT NULL,
  "pkceVerifierAuthTag" TEXT NOT NULL,
  "returnTarget" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMPTZ(6) NOT NULL,
  "consumedAt" TIMESTAMPTZ(6),

  CONSTRAINT "human_auth_attempt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "human_auth_attempt_browserTokenHash_key"
  ON "human_auth_attempt" ("browserTokenHash");

-- `state` unico: un `state` ya emitido no puede volver a emitirse.
CREATE UNIQUE INDEX "human_auth_attempt_stateHash_key"
  ON "human_auth_attempt" ("stateHash");

CREATE UNIQUE INDEX "human_auth_attempt_id_tenant_unique"
  ON "human_auth_attempt" ("id", "tenantId");

CREATE INDEX "human_auth_attempt_tenant_expires_idx"
  ON "human_auth_attempt" ("tenantId", "expiresAt");

ALTER TABLE "human_auth_attempt"
  ADD CONSTRAINT "human_auth_attempt_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "human_auth_attempt"
  ADD CONSTRAINT "human_auth_attempt_period_order"
  CHECK ("expiresAt" > "createdAt");

-- ALLOWLIST CERRADA del destino posterior al login. Es una lista literal, no
-- una forma: una expresion permisiva acabaria aceptando una redireccion
-- abierta. Ampliarla exige una migracion, que es exactamente lo que se busca.
ALTER TABLE "human_auth_attempt"
  ADD CONSTRAINT "human_auth_attempt_return_target_allowlist"
  CHECK ("returnTarget" IN ('/'));

-- ---------------------------------------------------------------------------
-- 9. Relacion Paciente-Cuidador
-- ---------------------------------------------------------------------------

CREATE TABLE "patient_caregiver_relationship" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "patientId" UUID NOT NULL,
  "caregiverPersonId" UUID NOT NULL,
  "relationshipType" "PatientCaregiverRelationshipType" NOT NULL DEFAULT 'DECLARED_CARE_SUPPORT',
  "purpose" "PatientCaregiverPurpose" NOT NULL DEFAULT 'HOME_CARE_COORDINATION',
  "status" "PatientCaregiverRelationshipStatus" NOT NULL DEFAULT 'PENDING_VALIDATION',
  "startsAt" TIMESTAMPTZ(6) NOT NULL,
  "endsAt" TIMESTAMPTZ(6),
  "validationSource" "CaregiverRelationshipValidationSource" NOT NULL DEFAULT 'CONTROLLED_MVP_OPERATOR_ASSERTION',
  "authorizationReference" TEXT NOT NULL,
  "validatedByInstitutionalIdentityId" UUID,
  "validatedAt" TIMESTAMPTZ(6),
  "revokedByInstitutionalIdentityId" UUID,
  "revokedAt" TIMESTAMPTZ(6),
  "revocationReason" "CaregiverRelationshipRevocationReason",
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "patient_caregiver_relationship_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "patient_caregiver_relationship_id_tenant_unique"
  ON "patient_caregiver_relationship" ("id", "tenantId");

CREATE INDEX "patient_caregiver_relationship_tenant_patient_status_idx"
  ON "patient_caregiver_relationship" ("tenantId", "patientId", "status");

CREATE INDEX "patient_caregiver_relationship_tenant_caregiver_status_idx"
  ON "patient_caregiver_relationship" ("tenantId", "caregiverPersonId", "status");

-- Sostiene la consulta de autorizacion: estado mas vigencia.
CREATE INDEX "patient_caregiver_relationship_tenant_validity_idx"
  ON "patient_caregiver_relationship" ("tenantId", "status", "startsAt", "endsAt");

ALTER TABLE "patient_caregiver_relationship"
  ADD CONSTRAINT "patient_caregiver_relationship_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Claves foraneas COMPUESTAS: paciente, persona cuidadora y las dos identidades
-- institucionales deben pertenecer al MISMO tenant que la relacion.
ALTER TABLE "patient_caregiver_relationship"
  ADD CONSTRAINT "patient_caregiver_relationship_patient_fkey"
  FOREIGN KEY ("patientId", "tenantId")
  REFERENCES "patient" ("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "patient_caregiver_relationship"
  ADD CONSTRAINT "patient_caregiver_relationship_caregiver_person_fkey"
  FOREIGN KEY ("caregiverPersonId", "tenantId")
  REFERENCES "person" ("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "patient_caregiver_relationship"
  ADD CONSTRAINT "patient_caregiver_relationship_validated_by_fkey"
  FOREIGN KEY ("validatedByInstitutionalIdentityId", "tenantId")
  REFERENCES "institutional_identity" ("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "patient_caregiver_relationship"
  ADD CONSTRAINT "patient_caregiver_relationship_revoked_by_fkey"
  FOREIGN KEY ("revokedByInstitutionalIdentityId", "tenantId")
  REFERENCES "institutional_identity" ("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- (1) La version del control optimista empieza en 1 y solo crece.
ALTER TABLE "patient_caregiver_relationship"
  ADD CONSTRAINT "patient_caregiver_relationship_version_positive"
  CHECK ("version" > 0);

-- (2) Una vigencia no puede terminar antes —ni en el mismo instante— de empezar.
ALTER TABLE "patient_caregiver_relationship"
  ADD CONSTRAINT "patient_caregiver_relationship_period_order"
  CHECK ("endsAt" IS NULL OR "startsAt" < "endsAt");

-- (3) `ACTIVE` exige validador y fecha de validacion. La FUENTE es NOT NULL en
-- toda fila, de modo que una relacion activa jamas puede carecer de ella.
ALTER TABLE "patient_caregiver_relationship"
  ADD CONSTRAINT "patient_caregiver_relationship_validation_scope"
  CHECK (
    "status" <> 'ACTIVE'
    OR ("validatedByInstitutionalIdentityId" IS NOT NULL AND "validatedAt" IS NOT NULL)
  );

-- (4) y (5) `REVOKED` exige actor, fecha y motivo; cualquier otro estado NO
-- puede llevar ningun campo de revocacion. Las dos mitades viven en un solo
-- check para que no puedan divergir.
ALTER TABLE "patient_caregiver_relationship"
  ADD CONSTRAINT "patient_caregiver_relationship_revocation_scope"
  CHECK (
    (
      "status" = 'REVOKED'
      AND "revokedByInstitutionalIdentityId" IS NOT NULL
      AND "revokedAt" IS NOT NULL
      AND "revocationReason" IS NOT NULL
    )
    OR (
      "status" <> 'REVOKED'
      AND "revokedByInstitutionalIdentityId" IS NULL
      AND "revokedAt" IS NULL
      AND "revocationReason" IS NULL
    )
  );

-- Forma OPACA y allowlisted de la referencia de autorizacion: 1..100
-- caracteres en mayusculas, digitos y separadores. NUNCA texto libre, porque un
-- campo libre acabaria conteniendo datos personales.
ALTER TABLE "patient_caregiver_relationship"
  ADD CONSTRAINT "patient_caregiver_relationship_authorization_reference_shape"
  CHECK ("authorizationReference" ~ '^[A-Z0-9][A-Z0-9._:-]{0,99}$');

-- (6) Autorrelacion imposible, y de forma TENANT-AWARE.
--
-- Un CHECK no basta porque hay que consultar la fila del paciente. La funcion
-- es SECURITY INVOKER a proposito: ejecutada por `merdn_runtime` queda sujeta a
-- Row Level Security, de modo que no puede leer pacientes de otra institucion
-- ni convertirse en un canal de lectura privilegiada.
CREATE OR REPLACE FUNCTION "merdn_caregiver_relationship_guard"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  paciente_person uuid;
BEGIN
  SELECT "personId" INTO paciente_person
    FROM "patient"
   WHERE "id" = NEW."patientId" AND "tenantId" = NEW."tenantId";

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El paciente de la relacion no existe en el tenant indicado.'
      USING ERRCODE = '23503';
  END IF;

  IF paciente_person = NEW."caregiverPersonId" THEN
    RAISE EXCEPTION 'La persona cuidadora no puede ser la persona del paciente.'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "patient_caregiver_relationship_guard"
  BEFORE INSERT OR UPDATE ON "patient_caregiver_relationship"
  FOR EACH ROW EXECUTE FUNCTION "merdn_caregiver_relationship_guard"();

-- (7) Garantia DB contra relaciones ACTIVE solapadas.
--
-- Dos relaciones ACTIVE de la misma combinacion tenant/paciente/cuidadora/tipo/
-- finalidad no pueden solapar su vigencia. El rango es `[startsAt, endsAt)`;
-- `endsAt` nulo significa vigencia abierta.
--
-- Es una EXCLUSION CONSTRAINT y no una comprobacion de aplicacion: dos
-- peticiones concurrentes atravesarian un `SELECT` previo, pero no atraviesan
-- el indice GiST. El indice es PARCIAL a proposito: la historia de relaciones
-- terminadas se conserva y no compite por la exclusion.
ALTER TABLE "patient_caregiver_relationship"
  ADD CONSTRAINT "patient_caregiver_relationship_active_no_overlap"
  EXCLUDE USING gist (
    "tenantId" WITH =,
    "patientId" WITH =,
    "caregiverPersonId" WITH =,
    "relationshipType" WITH =,
    "purpose" WITH =,
    tstzrange("startsAt", "endsAt", '[)') WITH &&
  ) WHERE ("status" = 'ACTIVE');

-- ---------------------------------------------------------------------------
-- 10. Alcances de la relacion
-- ---------------------------------------------------------------------------

CREATE TABLE "patient_caregiver_relationship_scope" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "relationshipId" UUID NOT NULL,
  "scope" "CaregiverScope" NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "patient_caregiver_relationship_scope_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "patient_caregiver_relationship_scope_id_tenant_unique"
  ON "patient_caregiver_relationship_scope" ("id", "tenantId");

-- Un alcance no puede concederse dos veces sobre la misma relacion.
CREATE UNIQUE INDEX "patient_caregiver_relationship_scope_unique"
  ON "patient_caregiver_relationship_scope" ("relationshipId", "tenantId", "scope");

CREATE INDEX "patient_caregiver_relationship_scope_tenant_rel_idx"
  ON "patient_caregiver_relationship_scope" ("tenantId", "relationshipId");

ALTER TABLE "patient_caregiver_relationship_scope"
  ADD CONSTRAINT "patient_caregiver_relationship_scope_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "patient_caregiver_relationship_scope"
  ADD CONSTRAINT "patient_caregiver_relationship_scope_relationship_fkey"
  FOREIGN KEY ("relationshipId", "tenantId")
  REFERENCES "patient_caregiver_relationship" ("id", "tenantId")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 11. Minimo privilegio y Row Level Security FORZADA
-- ---------------------------------------------------------------------------
--
-- Lo que la superficie de esta Task hace con cada tabla, y NADA mas:
--
--   * `human_account`: el provisioning CREA y DESHABILITA cuentas; el callback
--     las LEE. SELECT, INSERT y UPDATE.
--   * `external_auth_identity`: el provisioning VINCULA y DESVINCULA; el
--     callback LEE. SELECT, INSERT y UPDATE.
--   * `human_session`: se CREAN, se REVOCAN y se marca `lastUsedAt`. SELECT,
--     INSERT y UPDATE.
--   * `human_auth_attempt`: se CREA al iniciar el login y se CONSUME en el
--     callback marcando `consumedAt`. SELECT, INSERT y UPDATE. NO hay DELETE en
--     ejecucion: la limpieza fisica queda diferida a una Task propia (§4.3).
--   * `patient_caregiver_relationship`: se CREA, se ACTIVA y se REVOCA. SELECT,
--     INSERT y UPDATE.
--   * `patient_caregiver_relationship_scope`: se concede al crear la relacion y
--     nunca se modifica. SELECT e INSERT unicamente: no hay UPDATE, de modo que
--     un alcance concedido no puede convertirse en otro.
--
-- En NINGUNA tabla se concede DELETE: la historia no se borra.

GRANT SELECT, INSERT, UPDATE ON TABLE "human_account"                        TO "merdn_runtime";
GRANT SELECT, INSERT, UPDATE ON TABLE "external_auth_identity"               TO "merdn_runtime";
GRANT SELECT, INSERT, UPDATE ON TABLE "human_session"                        TO "merdn_runtime";
GRANT SELECT, INSERT, UPDATE ON TABLE "human_auth_attempt"                   TO "merdn_runtime";
GRANT SELECT, INSERT, UPDATE ON TABLE "patient_caregiver_relationship"       TO "merdn_runtime";
GRANT SELECT, INSERT         ON TABLE "patient_caregiver_relationship_scope" TO "merdn_runtime";

-- `FORCE` ademas de `ENABLE`: la politica de tenant se aplica TAMBIEN al
-- propietario de la tabla. Sin `FORCE`, un proceso conectado como propietario
-- —una tarea administrativa, una migracion futura, un script— podria leer o
-- escribir filas de cualquier institucion sin contexto. Un superusuario sigue
-- estando fuera de Row Level Security por diseño de PostgreSQL: por eso el rol
-- de ejecucion NO es superusuario y NO es propietario.
ALTER TABLE "human_account"                        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "human_account"                        FORCE  ROW LEVEL SECURITY;
ALTER TABLE "external_auth_identity"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE "external_auth_identity"               FORCE  ROW LEVEL SECURITY;
ALTER TABLE "human_session"                        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "human_session"                        FORCE  ROW LEVEL SECURITY;
ALTER TABLE "human_auth_attempt"                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "human_auth_attempt"                   FORCE  ROW LEVEL SECURITY;
ALTER TABLE "patient_caregiver_relationship"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "patient_caregiver_relationship"       FORCE  ROW LEVEL SECURITY;
ALTER TABLE "patient_caregiver_relationship_scope" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "patient_caregiver_relationship_scope" FORCE  ROW LEVEL SECURITY;

-- Estrictamente del tenant activo, tanto al leer como al escribir. `WITH CHECK`
-- impide insertar o mover una fila a otro tenant aunque la aplicacion fallara.
-- Sin contexto de tenant, `merdn_current_tenant()` devuelve NULL, la comparacion
-- no es verdadera y la politica NO deja pasar ninguna fila: falla CERRADO.
CREATE POLICY "human_account_tenant" ON "human_account"
  FOR ALL TO "merdn_runtime"
  USING ("tenantId" = "merdn_current_tenant"())
  WITH CHECK ("tenantId" = "merdn_current_tenant"());

CREATE POLICY "external_auth_identity_tenant" ON "external_auth_identity"
  FOR ALL TO "merdn_runtime"
  USING ("tenantId" = "merdn_current_tenant"())
  WITH CHECK ("tenantId" = "merdn_current_tenant"());

CREATE POLICY "human_session_tenant" ON "human_session"
  FOR ALL TO "merdn_runtime"
  USING ("tenantId" = "merdn_current_tenant"())
  WITH CHECK ("tenantId" = "merdn_current_tenant"());

CREATE POLICY "human_auth_attempt_tenant" ON "human_auth_attempt"
  FOR ALL TO "merdn_runtime"
  USING ("tenantId" = "merdn_current_tenant"())
  WITH CHECK ("tenantId" = "merdn_current_tenant"());

CREATE POLICY "patient_caregiver_relationship_tenant" ON "patient_caregiver_relationship"
  FOR ALL TO "merdn_runtime"
  USING ("tenantId" = "merdn_current_tenant"())
  WITH CHECK ("tenantId" = "merdn_current_tenant"());

CREATE POLICY "patient_caregiver_relationship_scope_tenant" ON "patient_caregiver_relationship_scope"
  FOR ALL TO "merdn_runtime"
  USING ("tenantId" = "merdn_current_tenant"())
  WITH CHECK ("tenantId" = "merdn_current_tenant"());
