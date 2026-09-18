-- ---------------------------------------------------------------------------
-- ROLLBACK documentado de IDENTITY-RELATIONSHIPS-CORE-01.
--
-- NO se ejecuta automaticamente y NO forma parte de la carpeta de migraciones
-- aplicadas: es documentacion ejecutable que exige autorizacion expresa del
-- Product Owner y respaldo previo verificado en cualquier entorno con datos.
--
-- Alcance de la reversion:
--   - retira las SEIS tablas nuevas, su trigger y sus ocho enums propios;
--   - NO retira los valores anadidos a "InstitutionalRole", "AuditActorType" ni
--     "AuditEventType": PostgreSQL no admite eliminar un valor de un enum;
--   - NO retira la extension `btree_gist`: puede estar siendo usada por otros
--     objetos y retirarla no es reversible sin analisis. Una extension instalada
--     y sin uso es inerte y no concede ningun permiso.
--
-- NO toca ningun dato de CORE-01, MUNICIPALITY-CORE-01, HOSPITAL-CORE-01 ni
-- HOSPITAL-CORE-02: personas, pacientes, pertenencias, direcciones,
-- consentimientos, catalogo territorial, identidades y sesiones
-- institucionales, perfiles profesionales, asignaciones y citas permanecen
-- intactos.
--
-- ADVERTENCIA MATERIAL: retirar `human_account`, `external_auth_identity`,
-- `human_session` y `patient_caregiver_relationship` DESTRUYE la vinculacion de
-- identidad y la historia de autorizaciones de cuidado. Esta reversion solo es
-- segura sobre un despliegue donde esas tablas esten vacias, o con una decision
-- expresa y un respaldo verificado sobre su contenido.
-- ---------------------------------------------------------------------------

BEGIN;

-- ---------------------------------------------------------------------------
-- ADVERTENCIA OBLIGATORIA
-- ---------------------------------------------------------------------------
--
-- Si ya existen filas en las tablas nuevas, o eventos de auditoria que las
-- describen, la reversion NO puede completarse de forma limpia:
--
--   * `audit_event` es append-only y su trigger rechaza DELETE incluso al
--     propietario, de modo que un evento `HUMAN_SESSION_CREATED` o
--     `CAREGIVER_RELATIONSHIP_CREATED` ya registrado NO puede retirarse y
--     quedaria apuntando a un recurso que dejo de existir;
--   * una identidad o una sesion con rol `CAREGIVER_RELATIONSHIP_MANAGER`
--     seguiria existiendo con un rol que la aplicacion ya no reconoce;
--   * una persona cuidadora perderia toda constancia de su autorizacion, y esa
--     perdida NO es reconstruible desde ninguna otra tabla.
--
-- Esta comprobacion debe ejecutarse ANTES y su resultado debe ser cero en las
-- cinco cifras. Si no lo es, DETENGASE: la decision sobre esos registros
-- corresponde a una persona, no a este archivo, y no se inventa aqui ningun
-- valor sustituto.
DO $$
DECLARE
  cuentas bigint;
  vinculos bigint;
  sesiones bigint;
  relaciones bigint;
  eventos bigint;
BEGIN
  SELECT count(*) INTO cuentas    FROM "human_account";
  SELECT count(*) INTO vinculos   FROM "external_auth_identity";
  SELECT count(*) INTO sesiones   FROM "human_session";
  SELECT count(*) INTO relaciones FROM "patient_caregiver_relationship";
  SELECT count(*) INTO eventos    FROM "audit_event"
    WHERE "eventType"::text IN (
      'HUMAN_IDENTITY_LINKED',
      'HUMAN_IDENTITY_UNLINKED',
      'HUMAN_ACCOUNT_DISABLED',
      'HUMAN_SESSION_CREATED',
      'HUMAN_SESSION_REVOKED',
      'CAREGIVER_RELATIONSHIP_CREATED',
      'CAREGIVER_RELATIONSHIP_VALIDATED',
      'CAREGIVER_RELATIONSHIP_REVOKED'
    );

  IF cuentas > 0 OR vinculos > 0 OR sesiones > 0 OR relaciones > 0 OR eventos > 0 THEN
    RAISE EXCEPTION
      'Reversion detenida: existen % cuentas humanas, % vinculos externos, % sesiones humanas, % relaciones de cuidado y % eventos de auditoria de IDENTITY-RELATIONSHIPS-CORE-01. Se requiere decision expresa y respaldo verificado.',
      cuentas, vinculos, sesiones, relaciones, eventos;
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- 1. Politicas, trigger y tablas
-- ---------------------------------------------------------------------------
--
-- Las politicas y los privilegios desaparecen con la tabla; se retiran de forma
-- explicita para dejar la reversion legible.

DROP POLICY IF EXISTS "patient_caregiver_relationship_scope_tenant" ON "patient_caregiver_relationship_scope";
DROP POLICY IF EXISTS "patient_caregiver_relationship_tenant"       ON "patient_caregiver_relationship";
DROP POLICY IF EXISTS "human_auth_attempt_tenant"                   ON "human_auth_attempt";
DROP POLICY IF EXISTS "human_session_tenant"                        ON "human_session";
DROP POLICY IF EXISTS "external_auth_identity_tenant"               ON "external_auth_identity";
DROP POLICY IF EXISTS "human_account_tenant"                        ON "human_account";

DROP TRIGGER IF EXISTS "patient_caregiver_relationship_guard" ON "patient_caregiver_relationship";
DROP FUNCTION IF EXISTS "merdn_caregiver_relationship_guard"();

-- El orden respeta las dependencias: el alcance cuelga de la relacion, la
-- sesion y el vinculo cuelgan de la cuenta, y el intento es independiente.
DROP TABLE IF EXISTS "patient_caregiver_relationship_scope";
DROP TABLE IF EXISTS "patient_caregiver_relationship";
DROP TABLE IF EXISTS "human_auth_attempt";
DROP TABLE IF EXISTS "human_session";
DROP TABLE IF EXISTS "external_auth_identity";
DROP TABLE IF EXISTS "human_account";

-- ---------------------------------------------------------------------------
-- 2. Enums propios de esta migracion
-- ---------------------------------------------------------------------------

DROP TYPE IF EXISTS "CaregiverRelationshipRevocationReason";
DROP TYPE IF EXISTS "CaregiverRelationshipValidationSource";
DROP TYPE IF EXISTS "CaregiverScope";
DROP TYPE IF EXISTS "PatientCaregiverRelationshipStatus";
DROP TYPE IF EXISTS "PatientCaregiverPurpose";
DROP TYPE IF EXISTS "PatientCaregiverRelationshipType";
DROP TYPE IF EXISTS "ExternalAuthIdentityStatus";
DROP TYPE IF EXISTS "HumanAccountStatus";

-- ---------------------------------------------------------------------------
-- 3. Lo que esta reversion NO deshace
-- ---------------------------------------------------------------------------
--
--   * `InstitutionalRole` conserva 'CAREGIVER_RELATIONSHIP_MANAGER';
--   * `AuditActorType` conserva 'HUMAN_ACCOUNT' y 'SYSTEM';
--   * `AuditEventType` conserva los ocho valores anadidos;
--   * la extension `btree_gist` permanece instalada.
--
-- PostgreSQL no admite eliminar un valor de un enum sin recrear el tipo y
-- reescribir todas las columnas que lo usan. Reescribir `audit_event` esta
-- PROHIBIDO: es append-only y su historia no se reinterpreta. Un valor de enum
-- sin filas que lo usen es inerte y no concede ningun permiso: la autorizacion
-- vive en el guard del servidor, no en el catalogo de tipos.

COMMIT;
