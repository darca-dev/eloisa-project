-- ---------------------------------------------------------------------------
-- ROLLBACK documentado de VISITS-CORE-01 — MP02 MATERIALIZATION SERVICE.
--
-- NO se ejecuta automaticamente y NO forma parte de la carpeta de migraciones
-- aplicadas: es documentacion ejecutable que exige autorizacion expresa del
-- Product Owner y respaldo previo verificado en cualquier entorno con datos.
--
-- ---------------------------------------------------------------------------
-- ADVERTENCIA OBLIGATORIA: ESTA REVERSION NO ES COMPLETA. NO PUEDE SERLO.
-- ---------------------------------------------------------------------------
--
-- La migracion `20260824180000_visits_core_02` anadio UN valor al enum
-- "AuditEventType": 'HOME_VISIT_MATERIALIZED'.
--
-- PostgreSQL NO PERMITE RETIRAR UN VALOR DE UN ENUM. No existe
-- `ALTER TYPE ... DROP VALUE` en ninguna version soportada. Deshacer ese cambio
-- exigiria:
--
--   1. crear un tipo nuevo sin el valor;
--   2. REESCRIBIR todas las columnas que usan "AuditEventType", incluida
--      `audit_event."eventType"`;
--   3. eliminar el tipo antiguo y renombrar el nuevo.
--
-- Ese procedimiento es INADMISIBLE sobre `audit_event`: la tabla es APPEND-ONLY,
-- su trigger rechaza DELETE incluso al propietario y su contenido es evidencia
-- institucional. Reescribirla para borrar un valor de catalogo destruiria la
-- inmutabilidad que la tabla existe para garantizar, y ademas fallaria mientras
-- exista una sola fila con `eventType = 'HOME_VISIT_MATERIALIZED'`.
--
-- Por tanto este archivo NO simula una reversion limpia. Declara que:
--
--   * el valor 'HOME_VISIT_MATERIALIZED' PERMANECE en el enum;
--   * los eventos ya registrados con ese valor PERMANECEN intactos;
--   * ninguna otra cosa quedo por revertir en la base de datos, porque esta
--     migracion no creo tablas, columnas, indices, triggers, funciones,
--     politicas ni privilegios, no modifico ninguna restriccion y NO INSERTO NI
--     ACTUALIZO NINGUNA FILA.
--
-- Un valor de enum sin uso es INERTE: no concede acceso, no dispara escritura y
-- no obliga a ninguna aplicacion a emitirlo. Retirar el codigo que lo emite
-- basta para detener por completo el efecto de este paquete. Recrear el tipo
-- NO aporta ninguna garantia adicional y si destruye evidencia; por eso esta
-- reversion se detiene aqui deliberadamente y la decision sobre cualquier
-- reescritura de `audit_event` corresponde a una persona, no a este archivo.
--
-- ---------------------------------------------------------------------------
-- LO QUE SI ES REVERSIBLE, Y NO SE EJECUTA AQUI
-- ---------------------------------------------------------------------------
--
-- Fuera de la base de datos, y solo con decision expresa:
--
--   1. retirar de `prisma/schema.prisma` el valor 'HOME_VISIT_MATERIALIZED' del
--      enum `AuditEventType` y regenerar el cliente con `npx prisma generate`.
--      ATENCION: el cliente dejaria entonces de reconocer un valor que SIGUE
--      existiendo en PostgreSQL, de modo que LEER un evento ya registrado con
--      ese valor pasaria a ser un error de deserializacion. Retirarlo del
--      esquema solo es seguro si NINGUNA fila lo usa;
--   2. retirar `apps/api/src/visits/home-visit-materialization.service.ts` y el
--      metodo `recordHomeVisitMaterializedWithin` de
--      `apps/api/src/audit/audit.service.ts`, que son los UNICOS puntos que
--      emiten el evento;
--   3. retirar la fila de `_prisma_migrations` correspondiente a
--      `20260824180000_visits_core_02`.
--
-- Ninguna de las tres se ejecuta en este archivo.
--
-- ---------------------------------------------------------------------------
-- COMPROBACION PREVIA OBLIGATORIA
-- ---------------------------------------------------------------------------
--
-- Antes de retirar el valor del esquema Prisma (punto 1) hay que confirmar que
-- ninguna fila lo usa. Si la cifra no es cero, DETENGASE: los eventos son
-- evidencia y no se borran.

DO $$
DECLARE
  eventos bigint;
BEGIN
  SELECT count(*) INTO eventos
    FROM "audit_event"
   WHERE "eventType" = 'HOME_VISIT_MATERIALIZED';

  RAISE NOTICE 'Eventos HOME_VISIT_MATERIALIZED registrados: %', eventos;

  IF eventos <> 0 THEN
    RAISE NOTICE 'El valor del enum NO puede retirarse del esquema Prisma sin romper la lectura de esos eventos.';
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- NINGUNA SENTENCIA DE REVERSION SE EJECUTA. Es intencional.
--
-- No hay `BEGIN`/`COMMIT` porque no hay nada que revertir en la base de datos:
-- este archivo es una comprobacion y una declaracion, no una transformacion.
-- ---------------------------------------------------------------------------
