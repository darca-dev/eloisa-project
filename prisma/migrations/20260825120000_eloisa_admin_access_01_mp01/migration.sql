-- ---------------------------------------------------------------------------
-- ELOISA-ADMIN-ACCESS-01 — MP01 DATA/AUTH FOUNDATION. Migracion ADITIVA unica.
--
-- Contenido exacto:
--   1. Tres enums nuevos y CERRADOS: estado de la capacidad administrativa,
--      alcance de la autorizacion de soporte y estado de esa autorizacion.
--   2. Diecinueve valores ADITIVOS en "AuditEventType": las primitivas de
--      auditoria de soporte.
--   3. Clave unica ADITIVA y NO restrictiva sobre "human_session", que sostiene
--      la clave foranea compuesta del contexto de soporte.
--   4. Tabla "platform_support_capability": capacidad administrativa NOMINATIVA
--      de una cuenta humana ya existente, en su tenant HOME.
--   5. Tabla "support_grant": autorizacion EXPLICITA sobre UN tenant objetivo,
--      con alcance cerrado, vigencia y revocacion.
--   6. Tabla "support_context_session": contexto TEMPORAL de soporte, con
--      motivo obligatorio, ticket opcional, token hasheado, vigencia absoluta
--      de 60 minutos como maximo y salida/revocacion explicita.
--   7. Cinco columnas NULLABLE en "audit_event" con la procedencia de soporte,
--      sus claves foraneas NO destructivas y su coherencia.
--   8. Privilegios de minimo privilegio y Row Level Security FORZADA por tenant
--      HOME para las tres tablas nuevas.
--
-- ---------------------------------------------------------------------------
-- LO QUE ESTA MIGRACION NO HACE, Y HAY QUE DECIR EN VOZ ALTA
-- ---------------------------------------------------------------------------
--
-- ESTA MIGRACION NO CONCEDE ACCESO A NINGUN TENANT. Crear estas tablas no abre
-- ninguna institucion: no hay servicio, guard, controller, cookie, endpoint ni
-- interfaz que las consulte, y toda lectura Hospital sigue DENEGADA hasta
-- MP02/MP04. Que existan filas no autoriza nada por si mismo.
--
--   - NO crea contrasena maestra: ninguna tabla nueva tiene credencial,
--     derivacion, sal ni secreto de ningun tipo;
--   - NO crea impersonacion: nadie actua «como» otra persona y no hay columna
--     que lo represente;
--   - NO crea identidad institucional nueva ni rol institucional nuevo:
--     "InstitutionalRole" queda EXACTAMENTE igual;
--   - NO crea ni toca Professional, Caregiver, Patient, Agenda ni Visitas;
--   - NO concede `BYPASSRLS` a nadie, y no debilita ninguna politica, privilegio
--     ni FORCE ROW LEVEL SECURITY ya vigente;
--   - NO concede DELETE en ninguna tabla nueva: una autorizacion y un contexto
--     se REVOCAN, no se borran;
--   - NO toca `human-auth`, OIDC, `HumanPrincipal` ni el aprovisionamiento;
--   - NO INSERTA NINGUNA FILA. No hay capacidad, autorizacion ni contexto de
--     demostracion: una instalacion sin datos no concede soporte a nadie, que es
--     el comportamiento fail-closed deseado.
--
-- La UNICA tabla existente que cambia su definicion es "audit_event" —cinco
-- columnas NULLABLE aditivas— y "human_session" —una clave unica implicada por
-- su propia clave primaria, que por tanto NO rechaza ninguna fila que antes
-- fuera valida—.
--
-- NINGUNA clave foranea de esta migracion es `CASCADE` al borrar. La evidencia
-- de una lectura de soporte no puede desaparecer como efecto colateral.
--
-- NO contiene ningun secreto y no persiste dato personal ni clinico alguno.
--
-- Rollback documentado:
-- `prisma/migrations/ROLLBACK-eloisa_admin_access_01_mp01.sql`.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1. Catalogos CERRADOS del soporte de plataforma
-- ---------------------------------------------------------------------------

-- Estado de la capacidad administrativa. Solo dos valores: se tiene o se
-- retiro. No hay estado intermedio, ni «pendiente», ni «temporal».
CREATE TYPE "PlatformSupportCapabilityStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- Alcance de la autorizacion. V1 tiene EXACTAMENTE UNO.
--
-- La ausencia es la garantia: no existe valor de escritura, de clinica
-- editable, de finanzas, de exportacion masiva, de documento sensible, de firma
-- ni de impersonacion. Ningun servicio posterior puede conceder por descuido un
-- alcance que el catalogo no sabe nombrar.
CREATE TYPE "SupportGrantScope" AS ENUM ('HOSPITAL_OPERATIONAL_READ');

-- Estado de la autorizacion. Una autorizacion se REVOCA; no se borra.
CREATE TYPE "SupportGrantStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- ---------------------------------------------------------------------------
-- 2. Primitivas de auditoria de soporte
-- ---------------------------------------------------------------------------
--
-- ADITIVAS: ninguna fila existente cambia y ningun evento anterior queda
-- obligado a nada. Son primitivas CERRADAS y DIFERENCIADAS de los eventos
-- hospitalarios y municipales a proposito: una lectura de SOPORTE no debe
-- confundirse en la traza con una lectura institucional ordinaria.
--
-- MP01 solo declara su FORMA. La escritura atomica de un evento con cada
-- operacion pertenece a MP02/MP04: aqui no hay ningun servicio que los emita.
--
-- PostgreSQL 12+ admite `ALTER TYPE ... ADD VALUE` dentro de la transaccion de
-- la migracion, pero PROHIBE USAR el valor recien anadido en esa MISMA
-- transaccion. Esta migracion no usa ninguno.

-- Ciclo de vida de la capacidad administrativa.
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'PLATFORM_SUPPORT_CAPABILITY_CREATED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'PLATFORM_SUPPORT_CAPABILITY_DISABLED';

-- Ciclo de vida de la autorizacion por institucion.
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'SUPPORT_GRANT_CREATED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'SUPPORT_GRANT_REVOKED';

-- Entrada en soporte: CONCEDIDA y DENEGADA. La denegacion se audita igual que
-- la concesion; un intento rechazado tambien es evidencia.
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'SUPPORT_CONTEXT_ENTRY_GRANTED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'SUPPORT_CONTEXT_ENTRY_DENIED';

-- Los TRES finales posibles de un contexto, deliberadamente distinguidos:
-- salida explicita de la persona, expiracion por vigencia absoluta o
-- inactividad, y revocacion administrativa. No son lo mismo y la traza no debe
-- fingir que lo son.
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'SUPPORT_CONTEXT_EXITED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'SUPPORT_CONTEXT_EXPIRED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'SUPPORT_CONTEXT_REVOKED';

-- Lecturas del alcance CERRADO `HOSPITAL_OPERATIONAL_READ`, concedidas y
-- denegadas, una pareja por superficie. No hay ninguna primitiva de escritura,
-- de exportacion ni de clinica: el catalogo no puede nombrar lo que el alcance
-- no autoriza.
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'SUPPORT_PATIENT_READ_GRANTED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'SUPPORT_PATIENT_READ_DENIED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'SUPPORT_PROFESSIONAL_READ_GRANTED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'SUPPORT_PROFESSIONAL_READ_DENIED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'SUPPORT_AGENDA_READ_GRANTED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'SUPPORT_AGENDA_READ_DENIED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'SUPPORT_HOME_VISIT_READ_GRANTED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'SUPPORT_HOME_VISIT_READ_DENIED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'SUPPORT_OPERATIONAL_AUDIT_READ_GRANTED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'SUPPORT_OPERATIONAL_AUDIT_READ_DENIED';

-- ---------------------------------------------------------------------------
-- 3. Clave ADITIVA sobre "human_session"
-- ---------------------------------------------------------------------------
--
-- `id` ya es la clave primaria, de modo que esta clave unica NO restringe nada:
-- ninguna fila que antes fuera valida deja de serlo. Existe UNICAMENTE para
-- sostener la clave foranea compuesta de "support_context_session", que asi
-- queda obligada por PostgreSQL a nombrar la sesion humana de ESA misma cuenta
-- y de ESE mismo tenant. La coherencia deja de depender de la aplicacion.
--
-- No se toca ninguna otra cosa de "human_session": ni columnas, ni privilegios,
-- ni politicas, ni su FORCE ROW LEVEL SECURITY.
CREATE UNIQUE INDEX "human_session_id_account_tenant_unique"
  ON "human_session" ("id", "humanAccountId", "tenantId");

-- ---------------------------------------------------------------------------
-- 4. Capacidad administrativa NOMINATIVA
-- ---------------------------------------------------------------------------
--
-- NO hay columna de credencial, derivacion, sal, `subject` OIDC, emisor, nombre
-- ni documento. Esa AUSENCIA es la garantia estructural de que esta tabla no es
-- una contrasena maestra ni una identidad paralela: la autenticacion sigue
-- siendo EXCLUSIVAMENTE la de `human_account` + OIDC + `human_session`.
--
-- Tampoco hay columna de rol institucional: la capacidad NO es un
-- "InstitutionalRole" y no se confunde con `MUNICIPAL_VIEWER` ni con ningun rol
-- hospitalario.

CREATE TABLE "platform_support_capability" (
  "id" UUID NOT NULL,
  "homeTenantId" UUID NOT NULL,
  "humanAccountId" UUID NOT NULL,
  "status" "PlatformSupportCapabilityStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  "disabledAt" TIMESTAMPTZ(6),

  CONSTRAINT "platform_support_capability_pkey" PRIMARY KEY ("id")
);

-- Permite FKs compuestas que impiden asociaciones entre tenants distintos.
CREATE UNIQUE INDEX "platform_support_capability_id_home_tenant_unique"
  ON "platform_support_capability" ("id", "homeTenantId");

-- UNA sola capacidad por cuenta humana y tenant home.
CREATE UNIQUE INDEX "platform_support_capability_account_unique"
  ON "platform_support_capability" ("homeTenantId", "humanAccountId");

CREATE INDEX "platform_support_capability_home_tenant_status_idx"
  ON "platform_support_capability" ("homeTenantId", "status");

ALTER TABLE "platform_support_capability"
  ADD CONSTRAINT "platform_support_capability_home_tenant_fkey"
  FOREIGN KEY ("homeTenantId") REFERENCES "tenant" ("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Clave foranea COMPUESTA: la cuenta humana debe pertenecer al MISMO tenant
-- home. Conocer un identificador de otra institucion no basta para asociarlo.
--
-- `RESTRICT` y NO `CASCADE`: la capacidad administrativa es un registro
-- MATERIAL con procedencia y no desaparece en silencio con el borrado de otra
-- fila.
ALTER TABLE "platform_support_capability"
  ADD CONSTRAINT "platform_support_capability_account_fkey"
  FOREIGN KEY ("humanAccountId", "homeTenantId")
  REFERENCES "human_account" ("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Coherencia EXACTA entre estado y marca de deshabilitacion: `ACTIVE` sin
-- `disabledAt`, `DISABLED` con `disabledAt`. Las dos mitades viven en un solo
-- check para que no puedan divergir.
ALTER TABLE "platform_support_capability"
  ADD CONSTRAINT "platform_support_capability_status_timestamps"
  CHECK (
    ("status" = 'ACTIVE' AND "disabledAt" IS NULL)
    OR ("status" = 'DISABLED' AND "disabledAt" IS NOT NULL)
  );

ALTER TABLE "platform_support_capability"
  ADD CONSTRAINT "platform_support_capability_disabled_order"
  CHECK ("disabledAt" IS NULL OR "disabledAt" >= "createdAt");

-- ---------------------------------------------------------------------------
-- 5. Autorizacion EXPLICITA por institucion
-- ---------------------------------------------------------------------------
--
-- El dueno a efectos de Row Level Security es el tenant HOME, NO el objetivo.
-- Asi MP02 podra validar capacidad y autorizacion bajo el contexto del tenant
-- home y leer el negocio bajo un SEGUNDO contexto de tenant objetivo, sin
-- `BYPASSRLS` y sin que el navegador convierta jamas un `targetTenantId` en
-- autoridad: aqui solo se PERSISTE, la resolucion server-side es de MP02.
--
-- NO existe comodin, no existe «todos los tenants» y no existe alcance abierto:
-- `targetTenantId` es UNA institucion nombrada y `scope` tiene UN solo valor.

CREATE TABLE "support_grant" (
  "id" UUID NOT NULL,
  "homeTenantId" UUID NOT NULL,
  "platformSupportCapabilityId" UUID NOT NULL,
  "targetTenantId" UUID NOT NULL,
  "scope" "SupportGrantScope" NOT NULL,
  "status" "SupportGrantStatus" NOT NULL DEFAULT 'ACTIVE',
  "validFrom" TIMESTAMPTZ(6),
  "validUntil" TIMESTAMPTZ(6),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  "revokedAt" TIMESTAMPTZ(6),

  CONSTRAINT "support_grant_pkey" PRIMARY KEY ("id")
);

-- Permite FKs compuestas que impiden asociaciones entre tenants distintos.
CREATE UNIQUE INDEX "support_grant_id_home_tenant_unique"
  ON "support_grant" ("id", "homeTenantId");

-- Sostiene la FK compuesta del contexto de soporte: un contexto NO puede
-- declarar un tenant objetivo distinto del de SU autorizacion. La coherencia la
-- impone PostgreSQL, no la aplicacion.
CREATE UNIQUE INDEX "support_grant_id_home_target_unique"
  ON "support_grant" ("id", "homeTenantId", "targetTenantId");

CREATE INDEX "support_grant_home_capability_status_idx"
  ON "support_grant" ("homeTenantId", "platformSupportCapabilityId", "status");

CREATE INDEX "support_grant_home_target_status_idx"
  ON "support_grant" ("homeTenantId", "targetTenantId", "status");

-- COMO MUCHO UNA autorizacion ACTIVE por capacidad, tenant objetivo y alcance.
-- El indice es PARCIAL: las autorizaciones ya REVOCADAS no compiten, de modo
-- que la historia se conserva entera y aun asi no puede haber dos vigentes
-- equivalentes. Prisma no expresa indices parciales; vive solo en SQL.
CREATE UNIQUE INDEX "support_grant_active_unique"
  ON "support_grant" ("platformSupportCapabilityId", "targetTenantId", "scope")
  WHERE "status" = 'ACTIVE';

ALTER TABLE "support_grant"
  ADD CONSTRAINT "support_grant_home_tenant_fkey"
  FOREIGN KEY ("homeTenantId") REFERENCES "tenant" ("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- El tenant OBJETIVO se referencia por su identificador simple: NO es el tenant
-- dueno de esta fila y no puede formar parte de una clave compuesta con ella.
-- Es exactamente el punto en el que la autorizacion cruza de una institucion a
-- otra, y por eso queda escrito de forma explicita en una columna propia.
--
-- Las comprobaciones de integridad referencial de PostgreSQL no estan sujetas a
-- Row Level Security: esta FK valida la existencia del tenant objetivo sin
-- convertirse en un canal de LECTURA de datos ajenos.
ALTER TABLE "support_grant"
  ADD CONSTRAINT "support_grant_target_tenant_fkey"
  FOREIGN KEY ("targetTenantId") REFERENCES "tenant" ("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- La capacidad debe ser del MISMO tenant home. `RESTRICT`: retirar una
-- capacidad exige antes ocuparse de sus autorizaciones, de forma expresa.
ALTER TABLE "support_grant"
  ADD CONSTRAINT "support_grant_capability_fkey"
  FOREIGN KEY ("platformSupportCapabilityId", "homeTenantId")
  REFERENCES "platform_support_capability" ("id", "homeTenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Orden de la vigencia declarada, cuando ambos extremos existen.
ALTER TABLE "support_grant"
  ADD CONSTRAINT "support_grant_validity_order"
  CHECK ("validFrom" IS NULL OR "validUntil" IS NULL OR "validUntil" > "validFrom");

-- Coherencia EXACTA entre estado y revocacion, en un solo check.
ALTER TABLE "support_grant"
  ADD CONSTRAINT "support_grant_status_timestamps"
  CHECK (
    ("status" = 'ACTIVE' AND "revokedAt" IS NULL)
    OR ("status" = 'REVOKED' AND "revokedAt" IS NOT NULL)
  );

ALTER TABLE "support_grant"
  ADD CONSTRAINT "support_grant_revoked_order"
  CHECK ("revokedAt" IS NULL OR "revokedAt" >= "createdAt");

-- ---------------------------------------------------------------------------
-- 6. Contexto TEMPORAL de soporte
-- ---------------------------------------------------------------------------
--
-- Entidad SEPARADA de "human_session": tabla distinta y token distinto. Su hash
-- NUNCA reutiliza `human_session."tokenHash"` y su cookie —que MP02 implementara
-- — no es la cookie humana. Estar autenticada NO es estar en soporte.
--
-- El token en claro NUNCA se persiste: solo su hash.

CREATE TABLE "support_context_session" (
  "id" UUID NOT NULL,
  "homeTenantId" UUID NOT NULL,
  "humanAccountId" UUID NOT NULL,
  "humanSessionId" UUID NOT NULL,
  "supportGrantId" UUID NOT NULL,
  "targetTenantId" UUID NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "ticketReference" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMPTZ(6) NOT NULL,
  "lastUsedAt" TIMESTAMPTZ(6),
  "revokedAt" TIMESTAMPTZ(6),

  CONSTRAINT "support_context_session_pkey" PRIMARY KEY ("id")
);

-- El hash identifica el contexto sin conocer el token.
CREATE UNIQUE INDEX "support_context_session_tokenHash_key"
  ON "support_context_session" ("tokenHash");

-- Permite FKs compuestas que impiden asociaciones entre tenants distintos.
CREATE UNIQUE INDEX "support_context_session_id_home_tenant_unique"
  ON "support_context_session" ("id", "homeTenantId");

-- Validacion del contexto por tenant home y token.
CREATE INDEX "support_context_session_home_token_idx"
  ON "support_context_session" ("homeTenantId", "tokenHash");

-- Sostiene el barrido de expiracion de MP02.
CREATE INDEX "support_context_session_expires_idx"
  ON "support_context_session" ("expiresAt");

CREATE INDEX "support_context_session_home_grant_idx"
  ON "support_context_session" ("homeTenantId", "supportGrantId");

-- COMO MUCHO UN contexto NO REVOCADO por cuenta humana. El indice es PARCIAL.
--
-- ADVERTENCIA DELIBERADA: este indice NO evalua el paso del tiempo y NO finge
-- hacerlo. Un contexto EXPIRADO pero no revocado sigue ocupando el hueco: es
-- MP02 quien, dentro de transaccion, debe marcar la expiracion antes de abrir
-- un contexto nuevo. Un indice no puede leer un reloj, y escribir uno que lo
-- aparentara seria peor que no tenerlo.
CREATE UNIQUE INDEX "support_context_session_open_unique"
  ON "support_context_session" ("homeTenantId", "humanAccountId")
  WHERE "revokedAt" IS NULL;

ALTER TABLE "support_context_session"
  ADD CONSTRAINT "support_context_session_home_tenant_fkey"
  FOREIGN KEY ("homeTenantId") REFERENCES "tenant" ("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- La cuenta humana debe ser del MISMO tenant home.
ALTER TABLE "support_context_session"
  ADD CONSTRAINT "support_context_session_account_fkey"
  FOREIGN KEY ("humanAccountId", "homeTenantId")
  REFERENCES "human_account" ("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- La sesion humana debe ser la de ESA cuenta y ESE tenant home. Un contexto de
-- soporte no puede colgar de la sesion de otra persona.
ALTER TABLE "support_context_session"
  ADD CONSTRAINT "support_context_session_human_session_fkey"
  FOREIGN KEY ("humanSessionId", "humanAccountId", "homeTenantId")
  REFERENCES "human_session" ("id", "humanAccountId", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- La autorizacion debe ser la de ESE tenant home y ESE tenant objetivo. El
-- `targetTenantId` desnormalizado NO es una fuente independiente de verdad:
-- PostgreSQL obliga a que coincida con el de la autorizacion.
ALTER TABLE "support_context_session"
  ADD CONSTRAINT "support_context_session_grant_fkey"
  FOREIGN KEY ("supportGrantId", "homeTenantId", "targetTenantId")
  REFERENCES "support_grant" ("id", "homeTenantId", "targetTenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Motivo OBLIGATORIO. La longitud se mide sobre el texto RECORTADO para que
-- unos espacios en blanco no cuenten como motivo, y el maximo se mide sobre el
-- texto completo para acotar lo que se persiste.
ALTER TABLE "support_context_session"
  ADD CONSTRAINT "support_context_session_reason_shape"
  CHECK (
    char_length(btrim("reason")) >= 8
    AND char_length("reason") <= 500
  );

-- Ticket OPCIONAL y acotado. Cuando existe, no puede ser vacio ni en blanco.
ALTER TABLE "support_context_session"
  ADD CONSTRAINT "support_context_session_ticket_shape"
  CHECK (
    "ticketReference" IS NULL
    OR (
      char_length(btrim("ticketReference")) >= 1
      AND char_length("ticketReference") <= 120
    )
  );

-- Vigencia ABSOLUTA: posterior a la creacion y de 60 minutos como MAXIMO. Un
-- contexto de soporte no puede nacer con una ventana mas larga que la aprobada.
ALTER TABLE "support_context_session"
  ADD CONSTRAINT "support_context_session_ttl"
  CHECK (
    "expiresAt" > "createdAt"
    AND "expiresAt" <= "createdAt" + INTERVAL '60 minutes'
  );

-- La ultima actividad, cuando existe, cae DENTRO de la ventana. Sostiene el
-- corte por inactividad de 15 minutos que MP02 evaluara en transaccion.
ALTER TABLE "support_context_session"
  ADD CONSTRAINT "support_context_session_last_used_window"
  CHECK (
    "lastUsedAt" IS NULL
    OR ("lastUsedAt" >= "createdAt" AND "lastUsedAt" <= "expiresAt")
  );

ALTER TABLE "support_context_session"
  ADD CONSTRAINT "support_context_session_revoked_order"
  CHECK ("revokedAt" IS NULL OR "revokedAt" >= "createdAt");

-- Inmutabilidad de lo que define el contexto.
--
-- El rol de ejecucion recibira UPDATE sobre esta tabla porque MP02 debe poder
-- registrar actividad y salida. Sin este trigger, ese mismo UPDATE permitiria
-- ALARGAR `expiresAt`, cambiar la autorizacion, el tenant objetivo, la cuenta,
-- la sesion, el token o el motivo, y la vigencia absoluta de 60 minutos dejaria
-- de significar nada.
--
-- Solo `lastUsedAt` y `revokedAt` son mutables. Ademas, una revocacion ya
-- escrita NO se retira: un contexto cerrado no se reabre con un UPDATE.
CREATE OR REPLACE FUNCTION "merdn_support_context_session_immutable"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."id" IS DISTINCT FROM OLD."id"
     OR NEW."homeTenantId" IS DISTINCT FROM OLD."homeTenantId"
     OR NEW."humanAccountId" IS DISTINCT FROM OLD."humanAccountId"
     OR NEW."humanSessionId" IS DISTINCT FROM OLD."humanSessionId"
     OR NEW."supportGrantId" IS DISTINCT FROM OLD."supportGrantId"
     OR NEW."targetTenantId" IS DISTINCT FROM OLD."targetTenantId"
     OR NEW."tokenHash" IS DISTINCT FROM OLD."tokenHash"
     OR NEW."reason" IS DISTINCT FROM OLD."reason"
     OR NEW."ticketReference" IS DISTINCT FROM OLD."ticketReference"
     OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt"
     OR NEW."expiresAt" IS DISTINCT FROM OLD."expiresAt" THEN
    RAISE EXCEPTION 'El contexto de soporte solo admite actualizar lastUsedAt y revokedAt.'
      USING ERRCODE = '42501';
  END IF;

  IF OLD."revokedAt" IS NOT NULL AND NEW."revokedAt" IS DISTINCT FROM OLD."revokedAt" THEN
    RAISE EXCEPTION 'Un contexto de soporte revocado no se reabre ni se reescribe.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "support_context_session_immutable"
  BEFORE UPDATE ON "support_context_session"
  FOR EACH ROW EXECUTE FUNCTION "merdn_support_context_session_immutable"();

-- ---------------------------------------------------------------------------
-- 7. Procedencia de soporte en la auditoria
-- ---------------------------------------------------------------------------
--
-- Las cinco columnas son NULLABLE: las filas ya registradas permanecen validas
-- e INTACTAS, y ningun evento anterior queda obligado a llenarlas.
-- "audit_event" sigue siendo APPEND-ONLY: sus dos triggers y sus privilegios no
-- se tocan.
--
-- En un evento de soporte, `tenantId` es el TENANT OBJETIVO auditado y
-- `actorHomeTenantId` es el tenant HOME de la cuenta administrativa. Que sean
-- columnas DISTINTAS es justamente lo que hace legible una lectura cruzada.
--
-- NO se anade nombre, documento, emisor OIDC, `subject`, token, cookie, cuerpo,
-- filtro, conteo ni informacion clinica.

ALTER TABLE "audit_event" ADD COLUMN "actorHomeTenantId" UUID;
ALTER TABLE "audit_event" ADD COLUMN "supportGrantId" UUID;
ALTER TABLE "audit_event" ADD COLUMN "supportContextSessionId" UUID;
ALTER TABLE "audit_event" ADD COLUMN "supportReason" TEXT;
ALTER TABLE "audit_event" ADD COLUMN "supportTicketReference" TEXT;

-- Sostiene la traza completa de UN contexto de soporte concreto.
CREATE INDEX "audit_event_supportContextSessionId_idx"
  ON "audit_event" ("supportContextSessionId");

-- NINGUNA de las tres referencias borra en cascada. Un evento de auditoria es
-- EVIDENCIA: no puede desaparecer, ni quedarse sin procedencia, porque se borre
-- un tenant, una autorizacion o un contexto. `NO ACTION` y `RESTRICT` rechazan
-- ese borrado mientras exista el evento que los nombra.
--
-- La referencia al tenant home es SIMPLE y deliberadamente NO compuesta con
-- `tenantId`: en un evento de soporte los dos tenants son DISTINTOS, y esa
-- diferencia es el hecho que hay que registrar.
ALTER TABLE "audit_event"
  ADD CONSTRAINT "audit_event_actor_home_tenant_fkey"
  FOREIGN KEY ("actorHomeTenantId") REFERENCES "tenant" ("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "audit_event"
  ADD CONSTRAINT "audit_event_support_grant_fkey"
  FOREIGN KEY ("supportGrantId") REFERENCES "support_grant" ("id")
  ON DELETE NO ACTION ON UPDATE CASCADE;

ALTER TABLE "audit_event"
  ADD CONSTRAINT "audit_event_support_context_session_fkey"
  FOREIGN KEY ("supportContextSessionId") REFERENCES "support_context_session" ("id")
  ON DELETE NO ACTION ON UPDATE CASCADE;

-- Procedencia COHERENTE. O el evento no es de soporte —y las cinco columnas son
-- nulas—, o lo es y entonces el actor es OBLIGATORIAMENTE la cuenta humana
-- opaca, SIN rol institucional y con su tenant home nombrado.
--
-- Es la barrera que impide atribuir una lectura de soporte a una institucion, a
-- un rol hospitalario o a un actor anonimo.
--
-- La lista de valores del enum NO se menciona a proposito: la regla se expresa
-- sobre el ACTOR, de modo que las primitivas anadidas en esta misma migracion
-- quedan cubiertas sin usarlas —PostgreSQL prohibe usar en la misma transaccion
-- un valor de enum anadido en ella—.
ALTER TABLE "audit_event"
  ADD CONSTRAINT "audit_event_support_provenance"
  CHECK (
    (
      "actorHomeTenantId" IS NULL
      AND "supportGrantId" IS NULL
      AND "supportContextSessionId" IS NULL
      AND "supportReason" IS NULL
      AND "supportTicketReference" IS NULL
    )
    OR (
      "actorType" = 'HUMAN_ACCOUNT'
      AND "actorRole" IS NULL
      AND "actorUserId" IS NOT NULL
      AND "actorHomeTenantId" IS NOT NULL
    )
  );

-- Los textos de soporte estan ACOTADOS con la misma medida que el contexto.
ALTER TABLE "audit_event"
  ADD CONSTRAINT "audit_event_support_text_shape"
  CHECK (
    (
      "supportReason" IS NULL
      OR (char_length(btrim("supportReason")) >= 8 AND char_length("supportReason") <= 500)
    )
    AND (
      "supportTicketReference" IS NULL
      OR (
        char_length(btrim("supportTicketReference")) >= 1
        AND char_length("supportTicketReference") <= 120
      )
    )
  );

-- NOTA DELIBERADA sobre `audit_event_resource_required`.
--
-- El check vigente, reescrito por TASK-HOSPITAL-CORE-01, expresa el invariante
-- en forma NEGATIVA: solo los eventos nombrados en su lista estan OBLIGADOS a
-- llevar `resourceId`. Las diecinueve primitivas nuevas no figuran en esa lista,
-- de modo que el check las admite sin ningun cambio.
--
-- Endurecerlo con una lista positiva NO es posible aqui, porque PostgreSQL
-- prohibe usar en la misma transaccion un valor de enum anadido en esa misma
-- transaccion. Exigiria una migracion posterior separada; se reporta como riesgo
-- residual conocido, identico al ya declarado por HOSPITAL-CORE-02,
-- IDENTITY-RELATIONSHIPS-CORE-01 y VISITS-CORE-01 MP02/MP03.
--
-- `audit_event_actor_role_scope` NO necesita cambio: ya exige `actorRole IS
-- NULL` para todo actor que no sea `INSTITUTIONAL_IDENTITY`, que es exactamente
-- lo que MP01 requiere para el actor humano de soporte.

-- ---------------------------------------------------------------------------
-- 8. Minimo privilegio y Row Level Security FORZADA
-- ---------------------------------------------------------------------------
--
-- Lo que los servicios haran con cada tabla, y NADA mas:
--
--   * "platform_support_capability": se LEE para validar la capacidad. SELECT.
--     Su creacion y su deshabilitacion son actos administrativos que NO existen
--     todavia: conceder aqui INSERT o UPDATE seria conceder por adelantado una
--     mutacion que ninguna Task ha autorizado.
--   * "support_grant": se LEE para validar la autorizacion. SELECT. La creacion
--     y la revocacion por Platform Owner/Admin llegaran con su propia Task y su
--     propia migracion de privilegios.
--   * "support_context_session": se CREA al entrar en soporte, se ACTUALIZA al
--     registrar actividad, salida o revocacion, y se LEE para validarlo.
--     SELECT, INSERT y UPDATE, con la inmutabilidad del trigger anterior.
--
-- En NINGUNA de las tres se concede DELETE: una autorizacion y un contexto se
-- REVOCAN, no se borran. Tampoco se concede TRUNCATE, propiedad de tabla,
-- cambio de politica ni `BYPASSRLS`, aqui ni en ninguna otra parte.

GRANT SELECT                 ON TABLE "platform_support_capability" TO "merdn_runtime";
GRANT SELECT                 ON TABLE "support_grant"               TO "merdn_runtime";
GRANT SELECT, INSERT, UPDATE ON TABLE "support_context_session"     TO "merdn_runtime";

-- `FORCE` ademas de `ENABLE`: la politica de tenant se aplica TAMBIEN al
-- propietario de la tabla. Sin `FORCE`, un proceso conectado como propietario
-- —una tarea administrativa, una migracion futura, un script— podria leer o
-- escribir capacidades, autorizaciones y contextos de cualquier institucion sin
-- contexto. Un superusuario sigue estando fuera de Row Level Security por
-- diseno de PostgreSQL: por eso el rol de ejecucion NO es superusuario, NO es
-- propietario y NO tiene `BYPASSRLS`.
ALTER TABLE "platform_support_capability" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "platform_support_capability" FORCE  ROW LEVEL SECURITY;
ALTER TABLE "support_grant"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE "support_grant"               FORCE  ROW LEVEL SECURITY;
ALTER TABLE "support_context_session"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "support_context_session"     FORCE  ROW LEVEL SECURITY;

-- El tenant que manda en las tres politicas es el HOME, no el objetivo: la
-- capacidad, la autorizacion y el contexto se validan bajo el contexto del
-- tenant home de la cuenta administrativa. Leer el negocio del tenant objetivo
-- exige un SEGUNDO contexto y no lo habilita ninguna politica de aqui.
--
-- Sin contexto de tenant, `merdn_current_tenant()` devuelve NULL, la comparacion
-- no es verdadera y la politica NO deja pasar ninguna fila: falla CERRADO.
--
-- Capacidad y autorizacion son de SOLO LECTURA para el rol de ejecucion, de modo
-- que su politica es `FOR SELECT`: ni siquiera existe una politica que pudiera
-- admitir una escritura que ademas carece de privilegio.
CREATE POLICY "platform_support_capability_home_tenant" ON "platform_support_capability"
  FOR SELECT TO "merdn_runtime"
  USING ("homeTenantId" = "merdn_current_tenant"());

CREATE POLICY "support_grant_home_tenant" ON "support_grant"
  FOR SELECT TO "merdn_runtime"
  USING ("homeTenantId" = "merdn_current_tenant"());

-- `WITH CHECK` impide insertar un contexto en otro tenant home o moverlo a el,
-- aunque la aplicacion fallara.
CREATE POLICY "support_context_session_home_tenant" ON "support_context_session"
  FOR ALL TO "merdn_runtime"
  USING ("homeTenantId" = "merdn_current_tenant"())
  WITH CHECK ("homeTenantId" = "merdn_current_tenant"());
