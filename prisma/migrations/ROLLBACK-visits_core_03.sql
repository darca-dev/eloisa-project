-- ---------------------------------------------------------------------------
-- ROLLBACK documentado de VISITS-CORE-01 — MP03 PROFESSIONAL TRANSITIONS.
--
-- NO se ejecuta automaticamente y NO forma parte de la carpeta de migraciones
-- aplicadas: es documentacion ejecutable que exige autorizacion expresa del
-- Product Owner y respaldo previo verificado en cualquier entorno con datos.
--
-- ---------------------------------------------------------------------------
-- ADVERTENCIA OBLIGATORIA: ESTA REVERSION NO ES COMPLETA. NO PUEDE SERLO.
-- ---------------------------------------------------------------------------
--
-- La migracion `20260824200000_visits_core_03` anadio TRES valores al enum
-- "AuditEventType": 'HOME_VISIT_STARTED', 'HOME_VISIT_COMPLETED' y
-- 'HOME_VISIT_NOT_COMPLETED'.
--
-- PostgreSQL NO PERMITE RETIRAR UN VALOR DE UN ENUM. No existe
-- `ALTER TYPE ... DROP VALUE` en ninguna version soportada. Deshacer ese cambio
-- exigiria:
--
--   1. crear un tipo nuevo sin los tres valores;
--   2. REESCRIBIR todas las columnas que usan "AuditEventType", incluida
--      `audit_event."eventType"`;
--   3. eliminar el tipo antiguo y renombrar el nuevo.
--
-- Ese procedimiento es INADMISIBLE sobre `audit_event`: la tabla es APPEND-ONLY,
-- su trigger rechaza DELETE incluso al propietario y su contenido es evidencia
-- institucional. Reescribirla para borrar valores de catalogo destruiria la
-- inmutabilidad que la tabla existe para garantizar, y ademas fallaria mientras
-- exista una sola fila con cualquiera de los tres valores.
--
-- Por tanto este archivo NO simula una reversion limpia. Declara que:
--
--   * los tres valores PERMANECEN en el enum;
--   * los eventos ya registrados con ellos PERMANECEN intactos;
--   * ninguna otra cosa quedo por revertir en la base de datos, porque esta
--     migracion no creo tablas, columnas, indices, triggers, funciones,
--     politicas ni privilegios, no modifico ninguna restriccion y NO INSERTO NI
--     ACTUALIZO NINGUNA FILA.
--
-- Un valor de enum sin uso es INERTE: no concede acceso, no dispara escritura y
-- no obliga a ninguna aplicacion a emitirlo. Retirar el codigo que lo emite
-- basta para detener por completo el efecto de este paquete.
--
-- ---------------------------------------------------------------------------
-- LO QUE ESTA REVERSION NO ALCANZA, Y HAY QUE DECIR EN VOZ ALTA
-- ---------------------------------------------------------------------------
--
-- Las VISITAS que ya transicionaron NO se revierten aqui, y no deben revertirse
-- desde este archivo:
--
--   * `home_visit."status"`, `"startedAt"`, `"endedAt"` y `"version"` reflejan
--     hechos operativos REALES —una visita que empezo, que se completo o que no
--     se realizo—. Devolverlas a `SCHEDULED` no deshace el hecho: lo FALSEA;
--   * `home_visit_transition` es APPEND-ONLY por privilegios: `merdn_runtime`
--     no tiene UPDATE ni DELETE sobre ella. Su historial es la unica constancia
--     de quien inicio, completo o dio por no realizada cada visita;
--   * `audit_event` es append-only y NO se borra NUNCA.
--
-- Retirar el codigo del servicio DETIENE la creacion de transiciones nuevas.
-- Eso es lo que una reversion de software puede prometer honestamente. Alterar
-- registros materiales ya escritos es una decision de una persona y exige su
-- propia Task; no la toma este archivo.
--
-- ---------------------------------------------------------------------------
-- LO QUE SI ES REVERSIBLE, Y NO SE EJECUTA AQUI
-- ---------------------------------------------------------------------------
--
-- Fuera de la base de datos, y solo con decision expresa:
--
--   1. retirar de `prisma/schema.prisma` los tres valores del enum
--      `AuditEventType` y regenerar el cliente con `npx prisma generate`.
--      ATENCION: el cliente dejaria entonces de reconocer valores que SIGUEN
--      existiendo en PostgreSQL, de modo que LEER un evento ya registrado con
--      cualquiera de ellos pasaria a ser un error de deserializacion. Retirarlos
--      del esquema solo es seguro si NINGUNA fila los usa;
--   2. retirar `apps/api/src/visits/home-visit-transition.service.ts` y el
--      metodo `recordHomeVisitTransitionWithin` de
--      `apps/api/src/audit/audit.service.ts`, que son los UNICOS puntos que
--      emiten los tres eventos;
--   3. retirar la fila de `_prisma_migrations` correspondiente a
--      `20260824200000_visits_core_03`.
--
-- Ninguna de las tres se ejecuta en este archivo.
--
-- ---------------------------------------------------------------------------
-- COMPROBACION PREVIA OBLIGATORIA
-- ---------------------------------------------------------------------------
--
-- Antes de retirar los valores del esquema Prisma (punto 1) hay que confirmar
-- que ninguna fila los usa, y ademas cuantas visitas dejarian de ser legibles
-- por un cliente que ya no reconociera esos eventos. Si alguna cifra no es
-- cero, DETENGASE: los eventos son evidencia y no se borran.

DO $$
DECLARE
  iniciadas bigint;
  completadas bigint;
  no_realizadas bigint;
  transiciones bigint;
BEGIN
  SELECT count(*) INTO iniciadas
    FROM "audit_event" WHERE "eventType" = 'HOME_VISIT_STARTED';
  SELECT count(*) INTO completadas
    FROM "audit_event" WHERE "eventType" = 'HOME_VISIT_COMPLETED';
  SELECT count(*) INTO no_realizadas
    FROM "audit_event" WHERE "eventType" = 'HOME_VISIT_NOT_COMPLETED';

  SELECT count(*) INTO transiciones
    FROM "home_visit_transition" WHERE "fromStatus" IS NOT NULL;

  RAISE NOTICE 'Eventos HOME_VISIT_STARTED: %', iniciadas;
  RAISE NOTICE 'Eventos HOME_VISIT_COMPLETED: %', completadas;
  RAISE NOTICE 'Eventos HOME_VISIT_NOT_COMPLETED: %', no_realizadas;
  RAISE NOTICE 'Transiciones profesionales registradas (fromStatus NO nulo): %', transiciones;

  IF iniciadas + completadas + no_realizadas <> 0 THEN
    RAISE NOTICE 'Los valores del enum NO pueden retirarse del esquema Prisma sin romper la lectura de esos eventos.';
  END IF;

  IF transiciones <> 0 THEN
    RAISE NOTICE 'Existen visitas con historial profesional. Su estado refleja hechos reales y NO se revierte desde este archivo.';
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- NINGUNA SENTENCIA DE REVERSION SE EJECUTA. Es intencional.
--
-- No hay `BEGIN`/`COMMIT` porque no hay nada que revertir en la base de datos:
-- este archivo es una comprobacion y una declaracion, no una transformacion.
-- ---------------------------------------------------------------------------
