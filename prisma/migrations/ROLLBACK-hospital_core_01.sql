-- ---------------------------------------------------------------------------
-- ROLLBACK documentado de TASK-HOSPITAL-CORE-01.
--
-- NO se ejecuta automaticamente y NO forma parte de la carpeta de migraciones
-- aplicadas: es documentacion ejecutable que exige autorizacion expresa del
-- Product Owner y respaldo previo verificado en cualquier entorno con datos.
--
-- Alcance de la reversion:
--   - devuelve el check de coherencia de `audit_event` a la forma declarada por
--     TASK-MUNICIPALITY-CORE-01;
--   - NO retira los valores anadidos a "InstitutionalRole" ni a
--     "AuditEventType": PostgreSQL no admite eliminar un valor de un enum.
--
-- NO toca ningun dato de CORE-01 ni de MUNICIPALITY-CORE-01: personas,
-- pacientes, pertenencias, direcciones, consentimientos, catalogo territorial,
-- identidades y sesiones institucionales permanecen intactos.
-- ---------------------------------------------------------------------------

BEGIN;

-- ---------------------------------------------------------------------------
-- ADVERTENCIA OBLIGATORIA
-- ---------------------------------------------------------------------------
--
-- Si ya existen filas que usan los valores anadidos por esta migracion, la
-- reversion NO puede completarse de forma limpia:
--
--   * `audit_event` es append-only y su trigger rechaza DELETE incluso al
--     propietario, de modo que un evento de acceso hospitalario ya registrado
--     NO puede retirarse;
--   * una identidad o una sesion con rol `HOSPITAL_PATIENT_VIEWER` seguiria
--     existiendo con un rol que la aplicacion ya no reconoce.
--
-- Esta consulta debe ejecutarse ANTES y su resultado debe ser cero en las tres
-- filas. Si no lo es, DETENGASE: la decision sobre esos registros corresponde a
-- una persona, no a este archivo, y no se inventa aqui ningun valor sustituto.
DO $$
DECLARE
  eventos bigint;
  identidades bigint;
  sesiones bigint;
BEGIN
  SELECT count(*) INTO eventos
    FROM "audit_event"
   WHERE "eventType" IN (
     'HOSPITAL_PATIENT_LIST_ACCESS_GRANTED',
     'HOSPITAL_PATIENT_DETAIL_ACCESS_GRANTED',
     'HOSPITAL_PATIENT_ANALYTICS_ACCESS_GRANTED',
     'HOSPITAL_PATIENT_ACCESS_DENIED'
   );

  SELECT count(*) INTO identidades
    FROM "institutional_identity" WHERE "role" = 'HOSPITAL_PATIENT_VIEWER';

  SELECT count(*) INTO sesiones
    FROM "institutional_session" s
    JOIN "institutional_identity" i
      ON i."id" = s."identityId" AND i."tenantId" = s."tenantId"
   WHERE i."role" = 'HOSPITAL_PATIENT_VIEWER';

  RAISE NOTICE 'Eventos de acceso hospitalario registrados: %', eventos;
  RAISE NOTICE 'Identidades con rol hospitalario: %', identidades;
  RAISE NOTICE 'Sesiones abiertas con rol hospitalario: %', sesiones;

  IF eventos > 0 OR identidades > 0 OR sesiones > 0 THEN
    RAISE EXCEPTION
      'Existen registros que usan los valores anadidos por TASK-HOSPITAL-CORE-01. '
      'La reversion se detiene: retire o migre esos registros con autorizacion '
      'expresa antes de continuar.'
      USING ERRCODE = '23514';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 1. Check de coherencia de `audit_event`
-- ---------------------------------------------------------------------------
--
-- Vuelve a la lista POSITIVA de TASK-MUNICIPALITY-CORE-01. Con cero eventos de
-- acceso hospitalario —ya comprobado arriba— ninguna fila existente la infringe.
ALTER TABLE "audit_event" DROP CONSTRAINT IF EXISTS "audit_event_resource_required";

ALTER TABLE "audit_event"
  ADD CONSTRAINT "audit_event_resource_required"
  CHECK (
    "resourceId" IS NOT NULL
    OR "eventType" IN (
      'MUNICIPAL_AGGREGATE_ACCESS_GRANTED',
      'MUNICIPAL_AGGREGATE_ACCESS_DENIED'
    )
  );

-- ---------------------------------------------------------------------------
-- 2. Valores de enum
-- ---------------------------------------------------------------------------
--
-- `HOSPITAL_PATIENT_VIEWER` y los cuatro eventos hospitalarios NO se retiran:
-- PostgreSQL no admite eliminar un valor de un enum. Su permanencia es inocua
-- mientras ninguna fila los use y mientras la aplicacion no los emita.

COMMIT;
