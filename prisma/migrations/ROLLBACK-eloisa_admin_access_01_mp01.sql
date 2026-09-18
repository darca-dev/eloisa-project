-- ---------------------------------------------------------------------------
-- ROLLBACK documentado de ELOISA-ADMIN-ACCESS-01 — MP01 DATA/AUTH FOUNDATION.
--
-- NO se ejecuta automaticamente y NO forma parte de la carpeta de migraciones
-- aplicadas: es documentacion ejecutable que exige autorizacion expresa del
-- Product Owner y respaldo previo verificado en cualquier entorno con datos.
--
-- Alcance de la reversion:
--   - retira las TRES tablas nuevas, su trigger de inmutabilidad, su funcion y
--     sus politicas de Row Level Security;
--   - retira los TRES enums propios de este paquete;
--   - retira las CINCO columnas de procedencia de soporte de "audit_event",
--     con sus claves foraneas, sus dos checks y su indice;
--   - retira la clave unica ADITIVA creada sobre "human_session";
--   - NO retira ningun valor de "AuditEventType": PostgreSQL no lo permite.
--
-- NO toca ningun dato de CORE-01, MUNICIPALITY-CORE-01, HOSPITAL-CORE-01,
-- HOSPITAL-CORE-02, IDENTITY-RELATIONSHIPS-CORE-01 ni VISITS-CORE-01. Personas,
-- pacientes, direcciones, consentimientos, catalogo territorial, identidades y
-- sesiones institucionales, perfiles profesionales, asignaciones, citas, cuentas
-- humanas, sesiones humanas, relaciones Paciente-Cuidador, visitas
-- domiciliarias y su historial permanecen INTACTOS.
--
-- `human_account` y `human_session` solo pierden claves foraneas ENTRANTES y,
-- en el segundo caso, un indice unico que su propia clave primaria ya implicaba:
-- sus filas, sus columnas, sus privilegios y sus politicas no cambian.
--
-- ---------------------------------------------------------------------------
-- ADVERTENCIA OBLIGATORIA: ESTA REVERSION NO ES COMPLETA. NO PUEDE SERLO.
-- ---------------------------------------------------------------------------
--
-- La migracion anadio DIECINUEVE valores al enum "AuditEventType". PostgreSQL
-- NO PERMITE RETIRAR UN VALOR DE UN ENUM: no existe `ALTER TYPE ... DROP VALUE`
-- en ninguna version soportada. Deshacerlo exigiria crear un tipo nuevo y
-- REESCRIBIR `audit_event."eventType"`, y eso es INADMISIBLE sobre una tabla
-- APPEND-ONLY cuyo trigger rechaza DELETE incluso al propietario y cuyo
-- contenido es evidencia institucional.
--
-- Por tanto los diecinueve valores PERMANECEN. Un valor de enum sin uso es
-- INERTE: no concede acceso, no dispara escritura y no obliga a nadie a
-- emitirlo. Retirar el codigo que lo emitiria basta para detener por completo el
-- efecto del paquete —y en MP01 ese codigo ni siquiera existe todavia—.
--
-- ---------------------------------------------------------------------------
-- ADVERTENCIA MATERIAL SOBRE LO QUE SI SE DESTRUYE
-- ---------------------------------------------------------------------------
--
-- Retirar "platform_support_capability", "support_grant" y
-- "support_context_session" DESTRUYE la constancia de quien tuvo capacidad
-- administrativa, que institucion fue autorizada, con que alcance, durante que
-- vigencia, quien revoco y con que motivo se entro en soporte. Esa perdida NO es
-- reconstruible desde ninguna otra tabla.
--
-- Retirar las cinco columnas de "audit_event" DESTRUYE la procedencia de soporte
-- de los eventos ya registrados: el evento sobreviviria, pero dejaria de decir
-- bajo que autorizacion, en que contexto y con que motivo se produjo la lectura.
-- Un evento de auditoria mutilado es peor que un evento ausente, porque
-- aparenta una traza completa que ya no tiene.
--
-- Esta reversion solo es segura sobre un despliegue donde las tres tablas esten
-- vacias y ningun evento lleve procedencia de soporte. La comprobacion previa lo
-- exige y ABORTA en caso contrario.
-- ---------------------------------------------------------------------------

BEGIN;

-- ---------------------------------------------------------------------------
-- COMPROBACION PREVIA OBLIGATORIA
-- ---------------------------------------------------------------------------
--
-- Las cuatro cifras deben ser CERO. Si alguna no lo es, DETENGASE: la decision
-- sobre esos registros corresponde a una persona, no a este archivo, y aqui no
-- se inventa ningun valor sustituto ni se borra ninguna evidencia.
DO $$
DECLARE
  capacidades bigint;
  autorizaciones bigint;
  contextos bigint;
  eventos_con_procedencia bigint;
BEGIN
  SELECT count(*) INTO capacidades    FROM "platform_support_capability";
  SELECT count(*) INTO autorizaciones FROM "support_grant";
  SELECT count(*) INTO contextos      FROM "support_context_session";

  SELECT count(*) INTO eventos_con_procedencia
    FROM "audit_event"
   WHERE "actorHomeTenantId" IS NOT NULL
      OR "supportGrantId" IS NOT NULL
      OR "supportContextSessionId" IS NOT NULL
      OR "supportReason" IS NOT NULL
      OR "supportTicketReference" IS NOT NULL;

  RAISE NOTICE 'Capacidades administrativas: %', capacidades;
  RAISE NOTICE 'Autorizaciones de soporte: %', autorizaciones;
  RAISE NOTICE 'Contextos de soporte: %', contextos;
  RAISE NOTICE 'Eventos de auditoria con procedencia de soporte: %', eventos_con_procedencia;

  IF capacidades <> 0 OR autorizaciones <> 0 OR contextos <> 0
     OR eventos_con_procedencia <> 0 THEN
    RAISE EXCEPTION
      'REVERSION DETENIDA: % capacidades, % autorizaciones, % contextos y % eventos con procedencia de soporte. Se exige decision expresa y respaldo verificado.',
      capacidades, autorizaciones, contextos, eventos_con_procedencia;
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- 1. Procedencia de soporte en "audit_event"
-- ---------------------------------------------------------------------------
--
-- PRIMERO, porque sus claves foraneas apuntan a las tablas que se retiran
-- despues. La tabla sigue siendo APPEND-ONLY: sus dos triggers, su indice de
-- tenant, su check `audit_event_resource_required`, su check
-- `audit_event_actor_role_scope`, sus privilegios y sus politicas NO se tocan, y
-- ninguna fila se borra.

ALTER TABLE "audit_event" DROP CONSTRAINT IF EXISTS "audit_event_support_text_shape";
ALTER TABLE "audit_event" DROP CONSTRAINT IF EXISTS "audit_event_support_provenance";

ALTER TABLE "audit_event" DROP CONSTRAINT IF EXISTS "audit_event_support_context_session_fkey";
ALTER TABLE "audit_event" DROP CONSTRAINT IF EXISTS "audit_event_support_grant_fkey";
ALTER TABLE "audit_event" DROP CONSTRAINT IF EXISTS "audit_event_actor_home_tenant_fkey";

DROP INDEX IF EXISTS "audit_event_supportContextSessionId_idx";

ALTER TABLE "audit_event" DROP COLUMN IF EXISTS "supportTicketReference";
ALTER TABLE "audit_event" DROP COLUMN IF EXISTS "supportReason";
ALTER TABLE "audit_event" DROP COLUMN IF EXISTS "supportContextSessionId";
ALTER TABLE "audit_event" DROP COLUMN IF EXISTS "supportGrantId";
ALTER TABLE "audit_event" DROP COLUMN IF EXISTS "actorHomeTenantId";

-- ---------------------------------------------------------------------------
-- 2. Politicas, trigger, funcion y tablas del soporte de plataforma
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "support_context_session_home_tenant"     ON "support_context_session";
DROP POLICY IF EXISTS "support_grant_home_tenant"               ON "support_grant";
DROP POLICY IF EXISTS "platform_support_capability_home_tenant" ON "platform_support_capability";

DROP TRIGGER IF EXISTS "support_context_session_immutable" ON "support_context_session";
DROP FUNCTION IF EXISTS "merdn_support_context_session_immutable"();

-- El orden respeta las dependencias: el contexto cuelga de la autorizacion y la
-- autorizacion cuelga de la capacidad. Los privilegios concedidos a
-- `merdn_runtime` desaparecen con las tablas, igual que sus indices parciales.
DROP TABLE IF EXISTS "support_context_session";
DROP TABLE IF EXISTS "support_grant";
DROP TABLE IF EXISTS "platform_support_capability";

-- ---------------------------------------------------------------------------
-- 3. Enums propios de esta migracion
-- ---------------------------------------------------------------------------
--
-- Solo los usaban las tres tablas retiradas, de modo que pueden eliminarse por
-- completo. NO es el caso de "AuditEventType", que esta migracion EXTENDIO y que
-- ninguna reversion puede recortar.

DROP TYPE IF EXISTS "SupportGrantStatus";
DROP TYPE IF EXISTS "SupportGrantScope";
DROP TYPE IF EXISTS "PlatformSupportCapabilityStatus";

-- ---------------------------------------------------------------------------
-- 4. Clave ADITIVA sobre "human_session"
-- ---------------------------------------------------------------------------
--
-- Solo existia para sostener la clave foranea compuesta del contexto de soporte,
-- ya retirada. Su desaparicion no cambia ninguna fila ni relaja ninguna regla:
-- `id` sigue siendo la clave primaria y la unicidad que este indice expresaba ya
-- estaba garantizada por ella.

DROP INDEX IF EXISTS "human_session_id_account_tenant_unique";

-- ---------------------------------------------------------------------------
-- 5. Lo que esta reversion NO deshace
-- ---------------------------------------------------------------------------
--
--   * los DIECINUEVE valores de "AuditEventType" PERMANECEN, por la limitacion
--     de PostgreSQL ya explicada arriba;
--   * `audit_event` conserva integra su historia: es append-only, no se borra
--     ninguna fila y sus triggers no se tocan;
--   * `human_account`, `human_session`, `external_auth_identity` y todo
--     `human-auth` conservan sus filas, sus columnas, sus privilegios y sus
--     politicas: las claves foraneas retiradas eran ENTRANTES hacia ellos;
--   * ninguna politica, privilegio o FORCE ROW LEVEL SECURITY preexistente se
--     modifico al aplicar la migracion, de modo que no hay nada que restaurar.
--
-- Fuera de la base de datos, y solo con decision expresa:
--
--   1. devolver `prisma/schema.prisma` al estado anterior a este paquete
--      —los tres enums, los tres modelos, las cinco columnas y relaciones de
--      `AuditEvent`, las relaciones inversas anadidas en `Tenant`,
--      `HumanAccount` y `HumanSession`, y la clave unica aditiva de
--      `HumanSession`— y regenerar el cliente con `npx prisma generate`.
--      ATENCION: retirar del esquema los diecinueve valores del enum solo es
--      seguro si NINGUNA fila los usa; el cliente dejaria de reconocer valores
--      que SIGUEN existiendo en PostgreSQL y leer un evento asi pasaria a ser un
--      error de deserializacion;
--   2. retirar `apps/api/test/eloisa-admin-support-foundation.db.test.ts`;
--   3. retirar la fila de `_prisma_migrations` correspondiente a
--      `20260825120000_eloisa_admin_access_01_mp01`.
--
-- Ninguna de las tres se ejecuta en este archivo.

COMMIT;
