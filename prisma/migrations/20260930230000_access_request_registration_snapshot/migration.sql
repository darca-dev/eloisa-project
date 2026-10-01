-- ---------------------------------------------------------------------------
-- MIGRACION ADITIVA `20260930230000_access_request_registration_snapshot`
-- SPEC 038 - ENTORNO FUNCIONAL CON DATOS DE PRUEBA / MP04-C3
--
-- Refleja EXACTAMENTE el agregado `AccessRequest` ampliado en
-- `prisma/schema.prisma` (MP04-C3). No altera, reescribe ni renombra ninguna
-- tabla, columna, indice, politica o privilegio existente.
--
-- NO SE APLICA EN ESTE PAQUETE de forma automatica por el agente: este archivo
-- es SQL revisable. Su aplicacion exige autorizacion expresa del Product Owner
-- y respaldo previo. NO aplicar sobre `merdn_dev`.
--
-- Contenido, y solo esto:
--   1. dos columnas ADITIVAS y NULABLES en `access_request` para la
--      instantanea versionada del expediente ficticio de solicitud;
--   2. cuatro restricciones CHECK nuevas sobre esas columnas.
--
-- NO contiene: DML, datos de prueba, valores seed, fixtures, cambios de
-- RLS, de FORCE RLS, de owner, de grants o de politicas, y NINGUN grant sobre
-- `audit_event` ni sobre ninguna tabla de auditoria.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 0. VALOR ADITIVO DE ENUM `AuditEventType`
-- ---------------------------------------------------------------------------
-- `IF NOT EXISTS` hace la migracion idempotente frente a un reintento parcial.
--
-- NOTA DE REVERSION: PostgreSQL no permite retirar un valor de un enum. Este
-- valor PERMANECE inerte tras cualquier rollback permitido, igual que los
-- cinco valores de la migracion de provision; ver
-- `ROLLBACK-access_request_registration_snapshot.sql`.
--
-- El evento representa UNICAMENTE un intento conflictivo de reintento: no se
-- reutilizan `CREATED`, `REJECTED`, `VIEWED` ni `LIST_DENIED` con semantica
-- falsa.
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'ACCESS_REQUEST_REPLAY_CONFLICT';

-- ---------------------------------------------------------------------------
-- 1. COLUMNAS ADITIVAS EN `access_request`
-- ---------------------------------------------------------------------------
-- PROHIBICION DE CONTENIDO, extiende la de MP01 y MP04: la instantanea guarda
-- SOLO los datos adicionales declarados de los pasos 2 a 4 y los
-- consentimientos del paso 5. Nunca guarda username, password, token, cookie,
-- claim OIDC, issuer, subject, referencia, tenant, estados, revisor, cuerpo del
-- proveedor ni error libre. No duplica la `Person`: identidad y contacto base
-- viven en su propia fila y aqui no se repiten.
--
-- Ambas columnas son NULABLES por compatibilidad: las solicitudes registradas
-- antes de este flujo quedan con ambos campos nulos y siguen siendo validas.
ALTER TABLE "access_request"
  ADD COLUMN "registrationSchemaVersion" INTEGER,
  ADD COLUMN "registrationData" JSONB;

-- ---------------------------------------------------------------------------
-- 2. RESTRICCIONES CHECK NUEVAS
-- ---------------------------------------------------------------------------
-- Coherencia: ambos nulos o ambos presentes. Una version sin datos, o datos
-- sin version, no describen ningun expediente y se rechazan en la escritura.
ALTER TABLE "access_request"
  ADD CONSTRAINT "access_request_registration_snapshot_coherent"
  CHECK (
    ("registrationSchemaVersion" IS NULL AND "registrationData" IS NULL)
    OR ("registrationSchemaVersion" IS NOT NULL AND "registrationData" IS NOT NULL)
  );

-- Version cerrada: este paquete solo emite la version 1. Una version futura
-- exige su propio paquete y su propia migracion que amplie este predicado.
ALTER TABLE "access_request"
  ADD CONSTRAINT "access_request_registration_schema_version_known"
  CHECK ("registrationSchemaVersion" IS NULL OR "registrationSchemaVersion" = 1);

-- Forma cerrada: la instantanea es un OBJETO, nunca un escalar, un arreglo ni
-- un nulo con version. Un objeto es lo unico que la bandeja sabe renderizar por
-- secciones; cualquier otra forma seria JSON crudo sin contrato.
ALTER TABLE "access_request"
  ADD CONSTRAINT "access_request_registration_data_is_object"
  CHECK ("registrationData" IS NULL OR jsonb_typeof("registrationData") = 'object');

-- Defensa en profundidad: la credencial ficticia NUNCA entra a la instantanea.
-- El servicio ya la excluye al construir el cuerpo persistido; esta restriccion
-- convierte un defecto futuro de construccion en un rechazo de escritura en
-- lugar de un secreto almacenado.
ALTER TABLE "access_request"
  ADD CONSTRAINT "access_request_registration_data_has_no_password"
  CHECK ("registrationData" IS NULL OR NOT ("registrationData" ? 'password'));
