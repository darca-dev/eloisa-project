-- ---------------------------------------------------------------------------
-- ROLLBACK CONDICIONAL de la migracion
-- `20260928190000_access_request_foundation`
-- (SPEC 038 — ENTORNO FUNCIONAL CON DATOS DE PRUEBA / MP01-C1-C1).
--
-- NO se ejecuta automaticamente y NO forma parte de las migraciones aplicadas:
-- es documentacion ejecutable que exige autorizacion expresa del Product Owner y
-- respaldo previo verificado en cualquier entorno con datos.
--
-- EJECUCION EXIGIDA:
--     psql -v ON_ERROR_STOP=1 -f ROLLBACK-access_request_foundation.sql
--
-- Sin `ON_ERROR_STOP=1` el cliente puede continuar tras el error y ocultar un
-- rechazo que es OBLIGATORIO respetar.
--
-- ESTE PAQUETE NO EJECUTO ESTE ARCHIVO. MP01-C1-C1 no abre Docker, no ejecuta
-- SQL y no aplica migraciones. Esto es SQL revisable, no evidencia de ejecucion.
-- ---------------------------------------------------------------------------
-- ESTE ROLLBACK ES CONDICIONAL. TIENE DOS DESENLACES, Y AMBOS SON CORRECTOS.
-- ---------------------------------------------------------------------------
--
-- Reglas duras, derivadas de spec 038 §8.3, §18 y §11:
--
--   1. PERMITIDO UNICAMENTE si NO existe ninguna fila de "access_request" Y
--      NINGUN evento de "audit_event" con uno de los quince tipos anadidos;
--   2. DEBE DETENERSE Y RECHAZAR si existe al menos uno. Se comprueba PRIMERO y
--      se ABORTA con error explicito. NO se borran solicitudes, NO se borran ni
--      reasignan eventos y NO se continua «porque son pocos»;
--   3. CERO PERDIDA DE TRAZA. Ningun camino de este archivo elimina, sobrescribe
--      ni altera una fila de "access_request" ni de "audit_event";
--   4. Un rollback RECHAZADO por dependencia NO es un fallo: es el comportamiento
--      correcto, y asi debe probarse.
--
-- Borrar solicitudes o eventos para poder revertir es una STOP CONDITION. Una
-- solicitud de acceso es historia, igual que un evento de auditoria.
-- ---------------------------------------------------------------------------
-- ADVERTENCIA OBLIGATORIA: ESTA REVERSION NO ES COMPLETA. NO PUEDE SERLO.
-- ---------------------------------------------------------------------------
--
-- La migracion creo CUATRO tipos nuevos y anadio DIECISEIS valores a enums
-- existentes (quince de "AuditEventType" y uno de "InstitutionalRole").
--
-- PostgreSQL NO PERMITE RETIRAR UN VALOR DE UN ENUM: no existe
-- `ALTER TYPE ... DROP VALUE` en ninguna version soportada. Deshacerlo exigiria
--   1. recrear cada tipo sin esos valores;
--   2. REESCRIBIR las columnas que los usan, incluida `audit_event."eventType"`;
--   3. eliminar el tipo antiguo y renombrar el nuevo.
--
-- Ese procedimiento es INADMISIBLE sobre "audit_event": la tabla es APPEND-ONLY,
-- su trigger rechaza DELETE incluso al propietario y su contenido es evidencia
-- institucional. Reescribirla para borrar un valor de catalogo destruiria la
-- inmutabilidad que la tabla existe para garantizar.
--
-- Por tanto este archivo NO simula una reversion limpia. Declara que, tras la
-- seccion 2:
--   * los cuatro tipos NUEVOS se eliminan junto con la tabla que los usa;
--   * los dieciseis valores anadidos a enums EXISTENTES PERMANECEN;
--   * todas las filas de "audit_event" y de "access_request" PERMANECEN
--     intactas, siempre;
--   * los privilegios previos de auditoria NO fueron tocados por la migracion y
--     por tanto este archivo no tiene nada que restituir en esa superficie.
--
-- Un valor de enum sin uso es INERTE: no concede acceso, no dispara escritura y
-- no obliga a ninguna aplicacion a emitirlo.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1. COMPROBACION PREVIA OBLIGATORIA — LA COMPUERTA DE ESTE ARCHIVO
-- ---------------------------------------------------------------------------
-- Las cifras deben ser CERO. Si no lo son, ESTE ARCHIVO SE DETIENE: la decision
-- sobre esas solicitudes y esos eventos corresponde a una persona.
--
-- El conteo NO se agrupa por tenant, no lee ningun otro campo y no expone dato
-- personal alguno: solo cuenta filas.
DO $$
DECLARE
  solicitudes_existentes bigint;
  eventos_dependientes  bigint;
BEGIN
  SELECT count(*) INTO solicitudes_existentes
    FROM "access_request";

  SELECT count(*) INTO eventos_dependientes
    FROM "audit_event"
   WHERE "eventType" IN (
       'ACCESS_REQUEST_CREATED',
       'ACCESS_REQUEST_LIST_GRANTED',
       'ACCESS_REQUEST_LIST_DENIED',
       'ACCESS_REQUEST_VIEWED',
       'ACCESS_REQUEST_APPROVED',
       'ACCESS_REQUEST_REJECTED',
       'ACCESS_REQUEST_SUSPENDED',
       'ACCESS_REQUEST_REVOKED',
       'ACCESS_PROVISIONING_SUCCEEDED',
       'ACCESS_PROVISIONING_FAILED',
       'DEMO_CONTEXT_ACCESS_GRANTED',
       'DEMO_CONTEXT_ACCESS_DENIED',
       'DEMO_DATASET_RESET_STARTED',
       'DEMO_DATASET_RESET_COMPLETED',
       'DEMO_DATASET_RESET_FAILED'
   );

  RAISE NOTICE 'Solicitudes de acceso registradas: %', solicitudes_existentes;
  RAISE NOTICE 'Eventos dependientes de SPEC 038 registrados: %', eventos_dependientes;

  IF solicitudes_existentes <> 0 OR eventos_dependientes <> 0 THEN
    RAISE EXCEPTION
      'REVERSION DETENIDA: existen % solicitud(es) de acceso y % evento(s) dependiente(s) de SPEC 038. Una solicitud de acceso y un evento de auditoria son evidencia institucional: NO se borran, NO se reasignan y NO se revierten «porque son pocos». Se exige decision expresa del Product Owner y respaldo verificado. Spec 038 §8.3, §11 y §18.',
      solicitudes_existentes, eventos_dependientes;
  END IF;

  RAISE NOTICE 'Comprobacion superada: cero solicitudes y cero eventos dependientes. La reversion puede proceder.';
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. REVERSION DE LA BASE DE DATOS
-- ---------------------------------------------------------------------------
-- Solo se alcanza si la seccion 1 dio CERO en ambas cifras. Todo ocurre en una
-- unica transaccion: si algo falla, no queda nada a medias.
--
-- Orden seguro y razon de cada paso:
--   a) REVOKE primero. Se retira el privilegio antes de retirar el objeto, de
--      modo que ninguna otra sesion puede escribir mientras se deshace.
--   b) DROP POLICY despues del REVOKE, para que ningun `merdn_runtime` conserve
--      un permiso sobre una politica que ya no existe.
--   c) DROP TABLE al final. `DROP TABLE` retira en cascada los indices, las
--      restricciones CHECK y las TRES claves foraneas, incluidas las compuestas
--      de tenant, sin necesidad de enumerarlas.
--   d) RLS y FORCE RLS desaparecen CON la tabla: no hay politica, ni ENABLE, ni
--      FORCE, ni funcion, ni trigger que retirar. No se intenta quitar FORCE RLS
--      de una tabla que ya no existe.
--   e) Los cuatro tipos nuevos se eliminan al final, y solo pueden eliminarse
--      porque la tabla que los usaba ya no existe.
--
-- NO se toca `audit_event`: su historial, sus triggers, sus permisos y sus
-- politicas permanecen intactos.
BEGIN;

REVOKE ALL PRIVILEGES ON TABLE "access_request" FROM "merdn_runtime";

DROP POLICY IF EXISTS "access_request_tenant" ON "access_request";

DROP TABLE IF EXISTS "access_request";

DROP TYPE IF EXISTS "AccessRequestProfile";
DROP TYPE IF EXISTS "AccessRequestStatus";
DROP TYPE IF EXISTS "AccessRequestProvisioningStatus";
DROP TYPE IF EXISTS "AccessRequestSource";

COMMIT;

DO $$
BEGIN
  RAISE NOTICE 'Reversion aplicada sobre "access_request" y los cuatro tipos de acceso. Los dieciseis valores anadidos a enums existentes PERMANECEN por limitacion de PostgreSQL, y son INERTES al no existir ninguna fila que los use.';
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. LO QUE SI ES REVERSIBLE, Y NO SE EJECUTA AQUI
-- ---------------------------------------------------------------------------
-- Fuera de la base de datos, solo con decision expresa, y UNICAMENTE valido
-- porque la seccion 1 confirmo cero solicitudes y cero eventos dependientes:
--
--   1. retirar de `prisma/schema.prisma` el modelo `AccessRequest`, los cuatro
--      enums de acceso, sus relaciones inversas en `Tenant`, `Person` e
--      `InstitutionalIdentity`, el valor `HOSPITAL_ACCESS_REVIEWER` de
--      `InstitutionalRole` y los quince valores de `AuditEventType`, y regenerar
--      el cliente con `npx prisma generate`;
--      ATENCION: el cliente dejaria entonces de reconocer dieciseis valores que
--      SIGUEN existiendo en PostgreSQL, de modo que LEER un registro con ellos
--      pasaria a ser un error de deserializacion. Retirarlos del esquema solo es
--      seguro si NINGUNA fila los usa, que es justamente lo que exige la
--      seccion 1;
--   2. retirar de la API los metodos que emiten los quince eventos y el codigo
--      que use la capacidad `HOSPITAL_ACCESS_REVIEWER`. Este paquete no los
--      implemento, asi que en MP01-C1-C1 no hay nada que retirar de la aplicacion;
--   3. retirar la fila de `_prisma_migrations` correspondiente a
--      `20260928190000_access_request_foundation`.
--
-- Ninguna de las tres se ejecuta en este archivo. Este paquete tampoco ejecuto
-- el rollback.
-- ---------------------------------------------------------------------------
