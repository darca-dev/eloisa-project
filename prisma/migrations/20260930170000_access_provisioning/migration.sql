-- ---------------------------------------------------------------------------
-- MIGRACION ADITIVA `20260930170000_access_provisioning`
-- SPEC 038 - ENTORNO FUNCIONAL CON DATOS DE PRUEBA / MP04
--
-- Refleja EXACTAMENTE el agregado `AccessRequest` ampliado en
-- `prisma/schema.prisma` (MP04). No altera, reescribe ni renombra ninguna
-- tabla, columna, indice, politica o privilegio existente, salvo la AMPLIACION
-- literal de la allowlist de retorno y la anadidura de la FK nueva, que es lo
-- que este paquete esta autorizado a tocar.
--
-- NO SE APLICA EN ESTE PAQUETE de forma automatica por el agente: este archivo
-- es SQL revisable. Su aplicacion en un entorno con datos exige autorizacion
-- expresa del Product Owner y respaldo previo.
--
-- Contenido, y solo esto:
--   1. cinco valores nuevos de `AuditEventType`;
--   2. cinco columnas ADITIVAS en `access_request` (FK de cuenta humana y
--      metadatos tecnicos de intento de provision, todos cerrados);
--   3. cinco restricciones CHECK nuevas sobre esas columnas;
--   4. la clave foranea COMPUESTA `(humanAccountId, tenantId)` sobre
--      `human_account`, y su indice de apoyo;
--   5. la ampliacion de `human_auth_attempt_return_target_allowlist` con
--      `/acceso`.
--
-- NO contiene: DML, datos de prueba, valores seed, fixtures, cambios de
-- RLS, de FORCE RLS, de owner, de grants o de politicas, y NINGUN grant sobre
-- `audit_event` ni sobre ninguna tabla de auditoria.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1. VALORES ADITIVOS DE ENUM `AuditEventType`
-- ---------------------------------------------------------------------------
-- `IF NOT EXISTS` hace la migracion idempotente frente a un reintento parcial.
-- Un valor de enum anadido no reescribe filas existentes ni altera su traza.
--
-- NOTA DE REVERSION: PostgreSQL no permite retirar un valor de un enum. Los
-- cinco valores de esta seccion PERMANECEN tras cualquier rollback; ver
-- `ROLLBACK-access_provisioning.sql`, seccion 3.
--
-- COBERTURA DE AUDITORIA que estos cinco valores cierran (spec 038 MP04,
-- "Persistencia, concurrencia y auditoria", punto 4):
--   * preparacion de identidad, separada de la provision: los dos primeros;
--   * reactivacion de una cuenta suspendida: el tercero;
--   * concesion y denegacion de una EXPERIENCIA aprobada: los dos ultimos.
--
-- Los eventos de provision ya existen (`ACCESS_PROVISIONING_SUCCEEDED` y
-- `ACCESS_PROVISIONING_FAILED`), igual que los de decision, suspension y
-- revocacion; este paquete NO los duplica.
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'ACCESS_IDENTITY_PREPARED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'ACCESS_IDENTITY_PREPARATION_FAILED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'ACCESS_REQUEST_REACTIVATED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'EXPERIENCE_ACCESS_GRANTED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'EXPERIENCE_ACCESS_DENIED';

-- ---------------------------------------------------------------------------
-- 2. COLUMNAS ADITIVAS EN `access_request`
-- ---------------------------------------------------------------------------
-- PROHIBICION DE CONTENIDO, extiende la de la migracion MP01: ninguna de estas
-- columnas guarda username, password, token, cookie, claim OIDC, issuer,
-- subject, cuerpo del proveedor ni error libre. Solo hay:
--   * una FK opaca a la cuenta humana propia de la solicitud;
--   * un contador de intentos;
--   * dos instantes del SERVIDOR;
--   * un codigo CERRADO de fallo.
ALTER TABLE "access_request"
  ADD COLUMN "humanAccountId"          UUID,
  ADD COLUMN "provisioningAttempts"     INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "provisioningStartedAt"    TIMESTAMPTZ(6),
  ADD COLUMN "provisioningLastErrorAt"  TIMESTAMPTZ(6),
  ADD COLUMN "provisioningErrorCode"    TEXT;

COMMENT ON COLUMN "access_request"."humanAccountId" IS
  'Cuenta humana propia de la solicitud. NULA hasta preparar identidad.';
COMMENT ON COLUMN "access_request"."provisioningAttempts" IS
  'Contador tecnico de intentos de provision. No es un contador de eventos.';
COMMENT ON COLUMN "access_request"."provisioningErrorCode" IS
  'Codigo CERRADO del ultimo fallo. Nunca texto libre ni cuerpo externo.';

-- ---------------------------------------------------------------------------
-- 3. RESTRICCIONES CHECK SOBRE LAS COLUMNAS NUEVAS
-- ---------------------------------------------------------------------------
-- Todas fallan cerradas: es preferible rechazar la escritura a persistir
-- metadatos incoherentes o con forma de texto libre.
--
--   * el contador de intentos NUNCA negativo;
--   * el codigo de fallo esta AUSENTE o es un token corto no vacio: sin este
--     CHECK, un manejador de error podria persistir un cuerpo de Keycloak con
--     direcciones, nombres o token, que es exactamente lo que MP04 prohibe;
--   * el instante de fallo no puede ser anterior al envio;
--   * el instante de intento no puede ser anterior al envio;
--   * un fallo sin intento registrado es incoherente: el codigo de error solo
--     se escribe junto a `provisioningLastErrorAt`.
ALTER TABLE "access_request"
  ADD CONSTRAINT "access_request_provisioning_attempts_non_negative"
    CHECK ("provisioningAttempts" >= 0);

ALTER TABLE "access_request"
  ADD CONSTRAINT "access_request_provisioning_error_code_bounded"
    CHECK (
      "provisioningErrorCode" IS NULL
      OR (char_length("provisioningErrorCode") BETWEEN 1 AND 64)
    );

ALTER TABLE "access_request"
  ADD CONSTRAINT "access_request_provisioning_last_error_after_submission"
    CHECK (
      "provisioningLastErrorAt" IS NULL
      OR "provisioningLastErrorAt" >= "submittedAt"
    );

ALTER TABLE "access_request"
  ADD CONSTRAINT "access_request_provisioning_started_after_submission"
    CHECK (
      "provisioningStartedAt" IS NULL
      OR "provisioningStartedAt" >= "submittedAt"
    );

ALTER TABLE "access_request"
  ADD CONSTRAINT "access_request_provisioning_error_requires_attempt"
    CHECK (
      "provisioningErrorCode" IS NULL
      OR "provisioningLastErrorAt" IS NOT NULL
    );

-- ---------------------------------------------------------------------------
-- 4. CLAVE FORANEA COMPUESTA CUENTA-TENANT Y SU INDICE
-- ---------------------------------------------------------------------------
-- Mismo patron que `person` y `institutional_identity`: la FK COMPUESTA
-- `(humanAccountId, tenantId)` es la barrera que impide que una solicitud
-- apunte a una cuenta de OTRO tenant, incluso si el codigo cometiera el error.
--
-- `ON DELETE RESTRICT`: una solicitud es historia. Ninguna fila se borra en
-- cascada; una cuenta se DESHABILITA o se REVISA, no se elimina.
--
-- La columna admite NULL porque una solicitud creada antes de preparar la
-- identidad, o cuya preparacion fallo, no tiene todavia cuenta asignada.
ALTER TABLE "access_request"
  ADD CONSTRAINT "access_request_humanAccountId_tenantId_fkey"
    FOREIGN KEY ("humanAccountId", "tenantId")
    REFERENCES "human_account" ("id", "tenantId")
    ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "access_request_tenantId_humanAccountId_idx"
  ON "access_request" ("tenantId", "humanAccountId");

-- ---------------------------------------------------------------------------
-- 5. AMPLIACION DE LA ALLOWLIST DE RETORNO POSTERIOR AL LOGIN
-- ---------------------------------------------------------------------------
-- `HUMAN_AUTH_RETURN_TARGETS` en `human-auth.contract.ts` pasa a admitir
-- `/acceso` (spec 038 MP04, decision 11). El CHECK de la base se amplia en la
-- MISMA direccion: no se reescribe, se RECREA con la lista literal completa.
--
-- IMPORTANTE sobre el orden: este bloque se ejecuta DESPUES de cualquier
-- insercion que ya existiera, y el predicado se vuelve mas PERMISIVO, de modo
-- que ninguna fila valida deja de serlo. Ampliar una lista literal de esta
-- forma no puede invalidar datos existentes; recortarla si lo haria, y por eso
-- este paquete no la recorta.
ALTER TABLE "human_auth_attempt"
  DROP CONSTRAINT IF EXISTS "human_auth_attempt_return_target_allowlist";

ALTER TABLE "human_auth_attempt"
  ADD CONSTRAINT "human_auth_attempt_return_target_allowlist"
    CHECK ("returnTarget" IN ('/', '/acceso'));
