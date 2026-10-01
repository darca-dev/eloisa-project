-- ---------------------------------------------------------------------------
-- ROLLBACK CONDICIONAL de la migracion
-- `20260930230000_access_request_registration_snapshot`
-- (SPEC 038 - ENTORNO FUNCIONAL CON DATOS DE PRUEBA / MP04-C3).
--
-- NO se ejecuta automaticamente y NO forma parte de las migraciones aplicadas:
-- es documentacion ejecutable que exige autorizacion expresa del Product Owner y
-- respaldo previo verificado en cualquier entorno con datos.
--
-- EJECUCION EXIGIDA:
--     psql -v ON_ERROR_STOP=1 -f ROLLBACK-access_request_registration_snapshot.sql
--
-- Sin `ON_ERROR_STOP=1` el cliente puede continuar tras el error y ocultar un
-- rechazo que es OBLIGATORIO respetar.
--
-- ESTE PAQUETE NO EJECUTO ESTE ARCHIVO. Esto es SQL revisable, no evidencia de
-- ejecucion.
-- ---------------------------------------------------------------------------
-- ESTE ROLLBACK ES CONDICIONAL. TIENE DOS DESENLACES, Y AMBOS SON CORRECTOS.
-- ---------------------------------------------------------------------------
--
-- Reglas duras, derivadas de spec 038 MP04-C3:
--
--   1. PERMITIDO UNICAMENTE si NINGUNA solicitud contiene instantanea o version
--      del expediente Y NINGUN evento `ACCESS_REQUEST_REPLAY_CONFLICT` existe.
--      A diferencia de MP04, esta migracion no toca allowlists: no hay intentos
--      que contar;
--   2. DEBE DETENERSE Y RECHAZAR si existe al menos una. Se comprueba PRIMERO y
--      se ABORTA con error explicito. NO se borran solicitudes, NO se vacian
--      expedientes, NO se borran eventos y NO se continua "porque son pocos";
--   3. CERO PERDIDA DE EVIDENCIA. Ningun camino de este archivo elimina,
--      sobrescribe ni altera una fila de "access_request" ni de "audit_event";
--   4. Un rollback RECHAZADO por dependencia NO es un fallo: es el
--      comportamiento correcto, y asi debe probarse.
--   5. El valor `ACCESS_REQUEST_REPLAY_CONFLICT` del enum NO se retira:
--      PostgreSQL no permite retirar valores de un enum y un valor inerte sin
--      filas que lo usen no altera ninguna traza, igual que los cinco valores
--      de la migracion de provision tras su rollback permitido.
--
-- Vaciar expedientes para poder revertir es una STOP CONDITION. Una solicitud
-- de acceso y su expediente declarado son historia.
-- ---------------------------------------------------------------------------

-- El conteo NO agrupa por tenant y no lee ningun campo con dato personal mas
-- alla de la existencia de la instantanea: solo cuenta filas.
-- GUARD-START: el bloque de guarda es lo unico que las pruebas ejecutan para
-- demostrar el rechazo; el DROP posterior nunca corre en pruebas.
DO $$
DECLARE
  solicitudes_con_expediente bigint;
  eventos_conflicto bigint;
BEGIN
  SELECT count(*)
    INTO solicitudes_con_expediente
    FROM "access_request"
   WHERE "registrationSchemaVersion" IS NOT NULL
      OR "registrationData" IS NOT NULL;

  SELECT count(*)
    INTO eventos_conflicto
    FROM "audit_event"
   WHERE "eventType" = 'ACCESS_REQUEST_REPLAY_CONFLICT';

  RAISE NOTICE 'Solicitudes con expediente MP04-C3 registrado: %', solicitudes_con_expediente;
  RAISE NOTICE 'Eventos de conflicto MP04-C3 registrados: %', eventos_conflicto;

  IF solicitudes_con_expediente <> 0 OR eventos_conflicto <> 0 THEN
    RAISE EXCEPTION
      'REVERSION DETENIDA: existen % solicitud(es) con expediente de solicitud y % evento(s) de conflicto. Una solicitud de acceso, su expediente declarado y un evento de auditoria son evidencia institucional: NO se borran, NO se vacian y NO se revierten "porque son pocos". Se exige decision expresa del Product Owner y respaldo verificado. Spec 038 MP04-C3.',
      solicitudes_con_expediente, eventos_conflicto;
  END IF;

  RAISE NOTICE 'Comprobacion superada: cero dependencias. La reversion puede proceder.';
END $$;
-- GUARD-END

-- Superficie nueva, y solo ella. El orden importa: primero las restricciones
-- que sostienen las columnas, despues las columnas.
ALTER TABLE "access_request"
  DROP CONSTRAINT IF EXISTS "access_request_registration_snapshot_coherent",
  DROP CONSTRAINT IF EXISTS "access_request_registration_schema_version_known",
  DROP CONSTRAINT IF EXISTS "access_request_registration_data_is_object",
  DROP CONSTRAINT IF EXISTS "access_request_registration_data_has_no_password";

ALTER TABLE "access_request"
  DROP COLUMN IF EXISTS "registrationData",
  DROP COLUMN IF EXISTS "registrationSchemaVersion";
