-- ---------------------------------------------------------------------------
-- ROLLBACK CONDICIONAL de la migracion
-- `20260930170000_access_provisioning`
-- (SPEC 038 - ENTORNO FUNCIONAL CON DATOS DE PRUEBA / MP04).
--
-- NO se ejecuta automaticamente y NO forma parte de las migraciones aplicadas:
-- es documentacion ejecutable que exige autorizacion expresa del Product Owner y
-- respaldo previo verificado en cualquier entorno con datos.
--
-- EJECUCION EXIGIDA:
--     psql -v ON_ERROR_STOP=1 -f ROLLBACK-access_provisioning.sql
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
-- Reglas duras, derivadas de spec 038 MP04:
--
--   1. PERMITIDO UNICAMENTE si NO existe ninguna solicitud que use las columnas
--      nuevas, NINGUN evento de los cinco tipos anadidos y NINGUN intento de
--      autenticacion cuyo destino de retorno sea `/acceso`;
--   2. DEBE DETENERSE Y RECHAZAR si existe al menos uno. Se comprueba PRIMERO y
--      se ABORTA con error explicito. NO se borran solicitudes, NO se borran ni
--      reasignan eventos, NO se borran intentos y NO se continua "porque son
--      pocos";
--   3. CERO PERDIDA DE TRAZA. Ningun camino de este archivo elimina, sobrescribe
--      ni altera una fila de "access_request", "audit_event" ni
--      "human_auth_attempt";
--   4. Un rollback RECHAZADO por dependencia NO es un fallo: es el comportamiento
--      correcto, y asi debe probarse.
--
-- Borrar solicitudes, eventos o intentos para poder revertir es una STOP
-- CONDITION. Una solicitud de acceso, un evento de auditoria y un intento de
-- autenticacion son historia.
-- ---------------------------------------------------------------------------
-- ADVERTENCIA OBLIGATORIA: ESTA REVERSION NO ES COMPLETA. NO PUEDE SERLO.
-- ---------------------------------------------------------------------------
--
-- La migracion anadio CINCO valores al enum "AuditEventType". PostgreSQL NO
-- PERMITE RETIRAR UN VALOR DE UN ENUM: no existe `ALTER TYPE ... DROP VALUE`.
-- Deshacerlo exigiria recrear el tipo, REESCRIBIR la columna
-- `audit_event."eventType"` de una tabla APPEND-ONLY cuyo trigger rechaza el
-- DELETE incluso al propietario, eliminar el tipo antiguo y renombrar el nuevo.
-- Ese procedimiento es INADMISIBLE: destruiria la inmutabilidad que la tabla
-- existe para garantizar.
--
-- Por tanto este archivo NO simula una reversion limpia. Declara que:
--   * las cinco columnas, cinco CHECK, una FK y un indice SI se retiran;
--   * la allowlist de retorno VUELVE a su forma anterior;
--   * los cinco valores anadidos a "AuditEventType" PERMANECEN;
--   * todas las filas de "audit_event", "access_request" y
--     "human_auth_attempt" PERMANECEN intactas, siempre.
--
-- Un valor de enum sin uso es INERTE: no concede acceso, no dispara escritura y
-- no obliga a ninguna aplicacion a emitirlo.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1. COMPROBACION PREVIA OBLIGATORIA - LA COMPUERTA DE ESTE ARCHIVO
-- ---------------------------------------------------------------------------
-- Las tres cifras deben ser CERO. Si no lo son, ESTE ARCHIVO SE DETIENE: la
-- decision sobre esas solicitudes, esos eventos y esos intentos corresponde a
-- una persona.
--
-- El conteo NO agrupa por tenant, no lee ningun campo con dato personal y no
-- expone dato alguno: solo cuenta filas.
DO $$
DECLARE
  solicitudes_mpnuevas  bigint;
  eventos_dependientes  bigint;
  intentos_con_acceso   bigint;
BEGIN
  SELECT count(*)
    INTO solicitudes_mpnuevas
    FROM "access_request"
   WHERE "humanAccountId" IS NOT NULL
      OR "provisioningAttempts" <> 0
      OR "provisioningStartedAt" IS NOT NULL
      OR "provisioningLastErrorAt" IS NOT NULL
      OR "provisioningErrorCode" IS NOT NULL;

  SELECT count(*)
    INTO eventos_dependientes
    FROM "audit_event"
   WHERE "eventType" IN (
       'ACCESS_IDENTITY_PREPARED',
       'ACCESS_IDENTITY_PREPARATION_FAILED',
       'ACCESS_REQUEST_REACTIVATED',
       'EXPERIENCE_ACCESS_GRANTED',
       'EXPERIENCE_ACCESS_DENIED'
   );

  SELECT count(*)
    INTO intentos_con_acceso
    FROM "human_auth_attempt"
   WHERE "returnTarget" = '/acceso';

  RAISE NOTICE 'Solicitudes con provision MP04 registradas: %', solicitudes_mpnuevas;
  RAISE NOTICE 'Eventos dependientes de MP04 registrados: %', eventos_dependientes;
  RAISE NOTICE 'Intentos de autenticacion con retorno /acceso: %', intentos_con_acceso;

  IF solicitudes_mpnuevas <> 0
     OR eventos_dependientes <> 0
     OR intentos_con_acceso <> 0 THEN
    RAISE EXCEPTION
      'REVERSION DETENIDA: existen % solicitud(es) provisionadas, % evento(s) dependiente(s) y % intento(s) con retorno /acceso. Una solicitud de acceso, un evento de auditoria y un intento de autenticacion son evidencia institucional: NO se borran, NO se reasignan y NO se revierten "porque son pocos". Se exige decision expresa del Product Owner y respaldo verificado. Spec 038 MP04.',
      solicitudes_mpnuevas, eventos_dependientes, intentos_con_acceso;
  END IF;

  RAISE NOTICE 'Comprobacion superada: cero dependencias. La reversion puede proceder.';
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. REVERSION DE LA BASE DE DATOS
-- ---------------------------------------------------------------------------
-- Solo se alcanza si la seccion 1 dio CERO en las tres cifras. Todo ocurre en
-- una unica transaccion: si algo falla, no queda nada a medias.
--
-- Orden seguro y razon de cada paso:
--   a) DROP CONSTRAINT primero: la FK impide retirar columnas que la sostienen.
--   b) DROP INDEX despues de la FK, antes de las columnas que cubre.
--   c) DROP COLUMN al final de la superficie nueva: PostgreSQL retira con ella
--      los CHECK declarados sobre esa columna, asi que sus cinco DROP CONSTRAINT
--      se resuelven aqui; se listan igualmente con IF EXISTS para que el archivo
--      sea legible y reejecutable.
--   d) La allowlist de retorno se restaura a su predicado anterior. Ampliarla
--      solo pudo anadir filas validas, y la seccion 1 confirmo que no existen.
--   e) RLS, FORCE RLS, owner, grants y politicas NO se tocan: la migracion no
--      los altero y este archivo no tiene nada que restituir en esa superficie.
--
-- NO se toca "audit_event": su historial, sus triggers, sus permisos y sus
-- politicas permanecen intactos.
BEGIN;

ALTER TABLE "access_request"
  DROP CONSTRAINT IF EXISTS "access_request_humanAccountId_tenantId_fkey";

DROP INDEX IF EXISTS "access_request_tenantId_humanAccountId_idx";

ALTER TABLE "access_request"
  DROP CONSTRAINT IF EXISTS "access_request_provisioning_attempts_non_negative",
  DROP CONSTRAINT IF EXISTS "access_request_provisioning_error_code_bounded",
  DROP CONSTRAINT IF EXISTS "access_request_provisioning_last_error_after_submission",
  DROP CONSTRAINT IF EXISTS "access_request_provisioning_started_after_submission",
  DROP CONSTRAINT IF EXISTS "access_request_provisioning_error_requires_attempt";

ALTER TABLE "access_request"
  DROP COLUMN IF EXISTS "provisioningErrorCode",
  DROP COLUMN IF EXISTS "provisioningLastErrorAt",
  DROP COLUMN IF EXISTS "provisioningStartedAt",
  DROP COLUMN IF EXISTS "provisioningAttempts",
  DROP COLUMN IF EXISTS "humanAccountId";

ALTER TABLE "human_auth_attempt"
  DROP CONSTRAINT IF EXISTS "human_auth_attempt_return_target_allowlist";

ALTER TABLE "human_auth_attempt"
  ADD CONSTRAINT "human_auth_attempt_return_target_allowlist"
    CHECK ("returnTarget" IN ('/'));

COMMIT;

DO $$
BEGIN
  RAISE NOTICE 'Reversion aplicada sobre las columnas MP04 de "access_request" y sobre la allowlist de retorno. Los cinco valores anadidos a "AuditEventType" PERMANECEN por limitacion de PostgreSQL, y son INERTES al no existir ninguna fila que los use.';
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. LO QUE SI ES REVERSIBLE, Y NO SE EJECUTA AQUI
-- ---------------------------------------------------------------------------
-- Fuera de la base de datos, solo con decision expresa, y UNICAMENTE valido
-- porque la seccion 1 confirmo cero dependencias:
--
--   1. retirar de `prisma/schema.prisma` los cinco campos de `AccessRequest`,
--      la relacion `AccessRequestHumanAccount` en `AccessRequest` y en
--      `HumanAccount`, y los cinco valores de `AuditEventType`, y regenerar el
--      cliente con `npx prisma generate`;
--      ATENCION: el cliente dejaria entonces de reconocer cinco valores que
--      SIGUEN existiendo en PostgreSQL, de modo que LEER un registro con ellos
--      pasaria a ser un error de deserializacion. Retirarlos del esquema solo es
--      seguro si NINGUNA fila los usa, que es justamente lo que exige la
--      seccion 1;
--   2. retirar de la API los metodos que emiten los cinco eventos, la
--      preparacion de identidad, la saga de provision, las acciones
--      institucionales MP04 y el endpoint de experiencias, y restaurar
--      `HUMAN_AUTH_RETURN_TARGETS` a `['/']`;
--   3. retirar de la interfaz el campo de contrasena ficticia y las tres
--      portadas protegidas;
--   4. retirar la fila de `_prisma_migrations` correspondiente a
--      `20260930170000_access_provisioning`.
--
-- Ninguna de las cuatro se ejecuta en este archivo. Este paquete tampoco ejecuto
-- el rollback.
-- ---------------------------------------------------------------------------
