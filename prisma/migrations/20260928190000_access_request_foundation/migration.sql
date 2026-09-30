-- ---------------------------------------------------------------------------
-- MIGRACION ADITIVA `20260928190000_access_request_foundation`
-- SPEC 038 — ENTORNO FUNCIONAL CON DATOS DE PRUEBA / MP01-C1-C1
--
-- Refleja EXACTAMENTE el agregado `AccessRequest` ya validado en
-- `prisma/schema.prisma` (MP01-C1). No altera, reescribe ni renombra ninguna
-- tabla, columna, indice, politica o privilegio existente.
--
-- NO SE APLICA EN ESTE PAQUETE. MP01-C1-C1 no abre Docker, no ejecuta SQL y no
-- aplica migraciones. Este archivo es SQL revisable, no evidencia de ejecucion.
--
-- Contenido, y solo esto:
--   1. cuatro enums de acceso (perfil, estado, estado tecnico de provision y
--      fuente canonica);
--   2. quince valores nuevos de `AuditEventType` y UNO de `InstitutionalRole`;
--   3. la tabla `access_request` con sus unicidades e indices;
--   4. el indice unico PARCIAL que hace cumplir «una sola solicitud abierta»;
--   5. las FKs restrictivas, incluidas las COMPUESTAS de tenant;
--   6. RLS + FORCE RLS, una politica de tenant y los grants minimos.
--
-- NO contiene: DML, datos de prueba, valores seed, fixtures, cambios de
-- politica o de schema existentes, y NINGUN grant sobre `audit_event` ni sobre
-- ninguna tabla de auditoria. Este paquete solo amplia el CATALOGO de eventos.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1. ENUMS DE ACCESO
-- ---------------------------------------------------------------------------
-- `AccessRequestSource` tiene UN unico valor, `TEST_DATA`, conforme a la decision
-- del Product Owner del 2026-09-28: la fuente canonica de los datos de prueba es
-- `TEST_DATA` y el texto visible es «Datos ficticios de prueba». No se reintroduce
-- la referencia historica `DEMONSTRATION` ni el rotulo `DEMO_LOCAL_FICTICIA`.
--
-- `AccessRequestProvisioningStatus` es deliberadamente SEPARADO del estado de
-- negocio: `APPROVED` exige confirmacion externa y no se deriva de este campo.
--
-- El catalogo cerrado de motivos de decision NO se crea aqui. La columna
-- `decisionReasonCode` queda reservada para MP03, junto con el comportamiento
-- hospitalario. Este paquete NO inventa ningun valor de motivo.
CREATE TYPE "AccessRequestProfile" AS ENUM (
  'PATIENT',
  'CAREGIVER',
  'FIELD_PROFESSIONAL'
);

CREATE TYPE "AccessRequestStatus" AS ENUM (
  'PENDING',
  'APPROVED_PENDING_PROVISIONING',
  'APPROVED',
  'REJECTED',
  'PROVISIONING_FAILED',
  'SUSPENDED',
  'REVOKED'
);

CREATE TYPE "AccessRequestProvisioningStatus" AS ENUM (
  'NOT_STARTED',
  'PENDING',
  'SUCCEEDED',
  'FAILED'
);

CREATE TYPE "AccessRequestSource" AS ENUM (
  'TEST_DATA'
);

-- ---------------------------------------------------------------------------
-- 2. VALORES ADITIVOS DE ENUMS EXISTENTES
-- ---------------------------------------------------------------------------
-- Los quince son los eventos obligatorios de spec 038 §10 que NO contienen PII.
-- `IF NOT EXISTS` hace la migracion idempotente frente a un reintento parcial.
-- Un valor de enum anadido no reescribe filas existentes ni altera su traza.
--
-- NOTA DE REVERSION: PostgreSQL no permite retirar un valor de un enum. Los
-- dieciseis valores de esta seccion PERMANECEN tras cualquier rollback; ver
-- `ROLLBACK-access_request_foundation.sql`, seccion 3.
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'ACCESS_REQUEST_CREATED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'ACCESS_REQUEST_LIST_GRANTED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'ACCESS_REQUEST_LIST_DENIED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'ACCESS_REQUEST_VIEWED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'ACCESS_REQUEST_APPROVED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'ACCESS_REQUEST_REJECTED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'ACCESS_REQUEST_SUSPENDED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'ACCESS_REQUEST_REVOKED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'ACCESS_PROVISIONING_SUCCEEDED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'ACCESS_PROVISIONING_FAILED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'DEMO_CONTEXT_ACCESS_GRANTED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'DEMO_CONTEXT_ACCESS_DENIED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'DEMO_DATASET_RESET_STARTED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'DEMO_DATASET_RESET_COMPLETED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'DEMO_DATASET_RESET_FAILED';

-- Capacidad institucional DEDICADA y DISJUNTA: aprobar una cuenta no concede
-- lectura de Pacientes, agenda ni relaciones de cuidado (spec 038 §6.4, OD-10).
ALTER TYPE "InstitutionalRole" ADD VALUE IF NOT EXISTS 'HOSPITAL_ACCESS_REVIEWER';

-- ---------------------------------------------------------------------------
-- 3. TABLA `access_request`
-- ---------------------------------------------------------------------------
-- `id` se genera en el cliente con `uuid(7)`, igual que en el resto del esquema;
-- por eso la columna no lleva DEFAULT de base de datos.
--
-- PROHIBICION DE CONTENIDO: esta tabla NO tiene columna para password, token,
-- cookie, claim OIDC, nombre, documento, correo, telefono, motivo libre ni dato
-- clinico. `reference`, `decisionReasonCode` y `provisioningReference` son
-- referencias OPACAS.
CREATE TABLE "access_request" (
  "id"                                UUID                        NOT NULL,
  "tenantId"                          UUID                        NOT NULL,
  "personId"                          UUID                        NOT NULL,
  "requestedProfile"                  "AccessRequestProfile"      NOT NULL,
  "status"                            "AccessRequestStatus"       NOT NULL DEFAULT 'PENDING',
  "provisioningStatus"                "AccessRequestProvisioningStatus" NOT NULL DEFAULT 'NOT_STARTED',
  "source"                            "AccessRequestSource"       NOT NULL DEFAULT 'TEST_DATA',
  "reference"                         TEXT                        NOT NULL,
  "version"                           INTEGER                     NOT NULL DEFAULT 1,
  "submittedAt"                       TIMESTAMPTZ(6)              NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedByInstitutionalIdentityId" UUID,
  "decidedAt"                         TIMESTAMPTZ(6),
  "decisionReasonCode"                TEXT,
  "provisioningReference"             TEXT,
  "createdAt"                         TIMESTAMPTZ(6)              NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"                         TIMESTAMPTZ(6)              NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "access_request_pkey" PRIMARY KEY ("id"),

  -- Invariantes de negocio, aplicados donde el esquema no puede declararlos.
  -- Todas fallan cerradas: es preferible rechazar la escritura a aceptar una
  -- solicitud incoherente.
  --   * control optimista de concurrencia siempre positivo;
  --   * la decision existe completa o no existe;
  --   * SOLO una solicitud `PENDING` no puede llevar decision: en cuanto se
  --     aprueba o se rechaza, `decidedAt`, revisor y motivo quedan fijados y se
  --     conservan (spec 038 §6.4);
  --   * `APPROVED` exige provision `SUCCEEDED`: sin confirmacion externa la
  --     solicitud no puede aparecer aprobada (spec 038 §6.4 y §12);
  --   * la decision no puede ser anterior al envio.
  CONSTRAINT "access_request_version_positive"
    CHECK ("version" >= 1),

  CONSTRAINT "access_request_decision_coherent"
    CHECK (
      ("decidedAt" IS NULL AND "reviewedByInstitutionalIdentityId" IS NULL)
      OR ("decidedAt" IS NOT NULL AND "reviewedByInstitutionalIdentityId" IS NOT NULL)
    ),

  -- Solo `PENDING` es «sin decision». `APPROVED_PENDING_PROVISIONING` y
  -- `PROVISIONING_FAILED` SIEMPRE conservan la decision que pudo la provision:
  -- la transicion obligatoria `PENDING -> APPROVED_PENDING_PROVISIONING` de la
  -- spec 038 §6.4 exige atribuir revisor y fecha, y esa atribucion es
  -- evidencia auditable que no puede perderse. «Abierta» no significa «sin
  -- decision»: el indice unico parcial de solicitudes abiertas se define por
  -- estado, no por ausencia de decision, y se conserva sin cambios.
  CONSTRAINT "access_request_pending_has_no_decision"
    CHECK (
      "status" <> 'PENDING'
      OR (
        "decidedAt" IS NULL
        AND "reviewedByInstitutionalIdentityId" IS NULL
        AND "decisionReasonCode" IS NULL
      )
    ),

  CONSTRAINT "access_request_approved_requires_succeeded_provisioning"
    CHECK ("status" <> 'APPROVED' OR "provisioningStatus" = 'SUCCEEDED'),

  CONSTRAINT "access_request_decision_after_submission"
    CHECK ("decidedAt" IS NULL OR "decidedAt" >= "submittedAt")
);

-- ---------------------------------------------------------------------------
-- 4. UNICIDADES E INDICES
-- ---------------------------------------------------------------------------
-- La referencia es la clave de idempotencia que el solicitante puede citar.
CREATE UNIQUE INDEX "access_request_tenant_reference_unique"
  ON "access_request" ("tenantId", "reference");

-- Sostiene la FK compuesta del revisor.
CREATE UNIQUE INDEX "access_request_id_tenant_unique"
  ON "access_request" ("id", "tenantId");

-- «UNA SOLICITUD ABIERTA» por tenant, persona y perfil (spec 038 §6.3).
--
-- Es un indice unico PARCIAL porque «abierta» es un PREDICADO, no un conjunto de
-- valores de columna: un indice unico ordinario sobre el estado no impediria dos
-- solicitudes abiertas y ademas bloquearia episodes posteriores. Prisma no
-- expresa indices parciales, por eso se declara aqui y no en el esquema.
--
-- PREDICADO LITERAL: la solicitud esta ABIERTA si y solo si su `status` es
-- 'PENDING', 'APPROVED_PENDING_PROVISIONING' o 'PROVISIONING_FAILED'.
-- `APPROVED`, `SUSPENDED`, `REJECTED` y `REVOKED` NO son solicitudes abiertas:
-- pertenecen a historia de acceso ya decidida. Un episodio nuevo crea una fila
-- nueva y NO reabre historia, que es exactamente lo que exige este predicado.
--
-- Este indice NO la implementa todavia el backend; MP02 debe escribir la
-- consulta de forma coherente con el para que la base la siga haciendo cumplir.
CREATE UNIQUE INDEX "access_request_open_per_person_profile_unique"
  ON "access_request" ("tenantId", "personId", "requestedProfile")
  WHERE "status" IN ('PENDING', 'APPROVED_PENDING_PROVISIONING', 'PROVISIONING_FAILED');

-- Revision hospitalaria: listar el backlog del propio tenant.
CREATE INDEX "access_request_tenantId_status_submittedAt_idx"
  ON "access_request" ("tenantId", "status", "submittedAt");

CREATE INDEX "access_request_tenantId_status_requestedProfile_idx"
  ON "access_request" ("tenantId", "status", "requestedProfile");

CREATE INDEX "access_request_tenantId_personId_idx"
  ON "access_request" ("tenantId", "personId");

-- ---------------------------------------------------------------------------
-- 5. CLAVES FORANEAS RESTRICTIVAS, INCLUIDAS LAS COMPUESTAS DE TENANT
-- ---------------------------------------------------------------------------
-- `ON DELETE RESTRICT`: una solicitud es HISTORIA. No hay borrado en cascada ni
-- Eliminacion silenciosa de historia de acceso.
--
-- Las dos FKs compuestas son la barrera que impide asociar a la solicitud una
-- `Person` o un revisor de OTRO tenant, incluso si el codigo de aplicacion
-- cometiera el error. `person` e `institutional_identity` ya exponen su clave
-- unica `(id, tenantId)`.
ALTER TABLE "access_request"
  ADD CONSTRAINT "access_request_tenant_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,

  ADD CONSTRAINT "access_request_personId_tenantId_fkey"
    FOREIGN KEY ("personId", "tenantId") REFERENCES "person" ("id", "tenantId")
    ON DELETE RESTRICT ON UPDATE CASCADE,

  ADD CONSTRAINT "access_request_reviewedByInstitutionalIdentityId_tenantId_fkey"
    FOREIGN KEY ("reviewedByInstitutionalIdentityId", "tenantId")
    REFERENCES "institutional_identity" ("id", "tenantId")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 6. RLS, FORCE RLS Y POLITICA DE TENANT
-- ---------------------------------------------------------------------------
-- Mismo contrato que las 26 tablas protegidas: `ENABLE` + `FORCE`, de modo que
-- ni siquiera un propietario no privilegiado pueda eludir la politica implicita.
ALTER TABLE "access_request" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "access_request" FORCE  ROW LEVEL SECURITY;

-- Sin contexto de tenant NO hay acceso: `merdn_current_tenant()` devuelve NULL
-- cuando `merdn.tenant_id` no esta fijado, y una comparacion con NULL nunca es
-- verdadera, ni en `USING` ni en `WITH CHECK`. El fallo es cerrado por
-- construccion, no por una condicion explicita.
CREATE POLICY "access_request_tenant" ON "access_request"
  FOR ALL TO "merdn_runtime"
  USING      ("tenantId" = "merdn_current_tenant"())
  WITH CHECK ("tenantId" = "merdn_current_tenant"());

-- ---------------------------------------------------------------------------
-- 7. GRANTS MINIMOS
-- ---------------------------------------------------------------------------
-- SELECT, INSERT y UPDATE. NUNCA DELETE: no existe borrado ordinario de
-- solicitudes. `APPROVED`, `SUSPENDED` y `REVOKED` se alcanzan por UPDATE y por
-- transiciones, nunca eliminando la fila.
--
-- No se concede NADA sobre `audit_event` ni sobre ninguna otra tabla: este
-- paquete no altera los privilegios de auditoria que ya existen.
GRANT SELECT, INSERT, UPDATE ON TABLE "access_request" TO "merdn_runtime";
