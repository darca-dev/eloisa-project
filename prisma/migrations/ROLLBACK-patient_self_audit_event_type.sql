-- ---------------------------------------------------------------------------
-- ROLLBACK CONDICIONAL de la migracion
-- `20260826120000_patient_self_audit_event_type`
-- (SPEC 021 — PACIENTE MVP OPERATIVO — MICRO-PACKET 1: AUDITORIA MINIMA).
--
-- NO se ejecuta automaticamente y NO forma parte de la carpeta de migraciones
-- aplicadas: es documentacion ejecutable que exige autorizacion expresa del
-- Product Owner y respaldo previo verificado en cualquier entorno con datos.
--
-- EJECUCION EXIGIDA:
--     psql -v ON_ERROR_STOP=1 -f ROLLBACK-patient_self_audit_event_type.sql
--
-- Sin `ON_ERROR_STOP=1` el cliente puede continuar tras el error y ocultar un
-- rechazo que es OBLIGATORIO respetar.
--
-- ---------------------------------------------------------------------------
-- ESTE ROLLBACK ES CONDICIONAL. TIENE DOS DESENLACES, Y AMBOS SON CORRECTOS.
-- ---------------------------------------------------------------------------
--
-- La spec 021 §9.4 lo fija con cuatro reglas duras:
--
--   1. PERMITIDO UNICAMENTE si NO existe ningun evento dependiente, es decir,
--      ninguna fila de "audit_event" con "eventType" en
--      {'PATIENT_SELF_ACCESS_GRANTED', 'PATIENT_SELF_ACCESS_DENIED'};
--   2. DEBE DETENERSE Y RECHAZAR la operacion si existe al menos uno. Se
--      comprueba PRIMERO y se ABORTA con error explicito. NO se borran eventos,
--      NO se reasignan a otro tipo y NO se continua «porque son pocos»;
--   3. CERO PERDIDA DE EVENTOS. Ningun camino de este archivo elimina,
--      sobrescribe ni altera una fila de "audit_event";
--   4. Un rollback RECHAZADO por eventos dependientes NO es un fallo del
--      paquete: es el comportamiento correcto, y asi se prueba.
--
-- Borrar o reasignar eventos para poder revertir es una STOP CONDITION
-- (021 §19.14). Perder eventos de auditoria es perdida de traza MATERIAL.
--
-- ---------------------------------------------------------------------------
-- ADVERTENCIA OBLIGATORIA: ESTA REVERSION NO ES COMPLETA. NO PUEDE SERLO.
-- ---------------------------------------------------------------------------
--
-- La migracion anadio DOS valores al enum "AuditEventType":
-- 'PATIENT_SELF_ACCESS_GRANTED' y 'PATIENT_SELF_ACCESS_DENIED'.
--
-- PostgreSQL NO PERMITE RETIRAR UN VALOR DE UN ENUM. No existe
-- `ALTER TYPE ... DROP VALUE` en ninguna version soportada. Deshacerlo exigiria:
--
--   1. crear un tipo nuevo sin los dos valores;
--   2. REESCRIBIR todas las columnas que usan "AuditEventType", incluida
--      `audit_event."eventType"`;
--   3. eliminar el tipo antiguo y renombrar el nuevo.
--
-- Ese procedimiento es INADMISIBLE sobre "audit_event": la tabla es APPEND-ONLY,
-- su trigger rechaza DELETE incluso al propietario y su contenido es evidencia
-- institucional. Reescribirla para borrar un valor de catalogo destruiria la
-- inmutabilidad que la tabla existe para garantizar, y chocaria de frente con la
-- regla 3 de arriba.
--
-- Por tanto este archivo NO simula una reversion limpia. Declara que:
--
--   * los DOS valores del enum PERMANECEN en PostgreSQL;
--   * las filas de "audit_event" PERMANECEN intactas, todas, siempre;
--   * ninguna otra cosa quedo por revertir en la base de datos, porque la
--     migracion no creo tablas, columnas, indices, triggers, funciones,
--     politicas ni privilegios, no modifico ninguna restriccion y NO INSERTO NI
--     ACTUALIZO NINGUNA FILA.
--
-- Un valor de enum sin uso es INERTE: no concede acceso, no dispara escritura y
-- no obliga a ninguna aplicacion a emitirlo. Retirar el codigo que lo emite
-- basta para detener por completo el efecto de este paquete.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1. COMPROBACION PREVIA OBLIGATORIA — LA COMPUERTA DE ESTE ARCHIVO
-- ---------------------------------------------------------------------------
--
-- La cifra debe ser CERO. Si no lo es, ESTE ARCHIVO SE DETIENE: la decision
-- sobre esos eventos corresponde a una persona, no a este script, y aqui no se
-- borra ninguna evidencia ni se inventa ningun valor sustituto.
--
-- El conteo NO se agrupa por tenant, no lee ningun otro campo del evento y no
-- expone ningun dato personal: solo cuenta filas por "eventType".
DO $$
DECLARE
  eventos_concedidos bigint;
  eventos_denegados  bigint;
  eventos_totales    bigint;
BEGIN
  SELECT count(*) INTO eventos_concedidos
    FROM "audit_event"
   WHERE "eventType" = 'PATIENT_SELF_ACCESS_GRANTED';

  SELECT count(*) INTO eventos_denegados
    FROM "audit_event"
   WHERE "eventType" = 'PATIENT_SELF_ACCESS_DENIED';

  eventos_totales := eventos_concedidos + eventos_denegados;

  RAISE NOTICE 'Eventos PATIENT_SELF_ACCESS_GRANTED registrados: %', eventos_concedidos;
  RAISE NOTICE 'Eventos PATIENT_SELF_ACCESS_DENIED  registrados: %', eventos_denegados;

  IF eventos_totales <> 0 THEN
    RAISE EXCEPTION
      'REVERSION DETENIDA: existen % evento(s) dependiente(s) de acceso propio del Paciente (% concedido(s), % denegado(s)). Los eventos de auditoria son evidencia institucional: NO se borran, NO se reasignan y NO se revierte «porque son pocos». Se exige decision expresa del Product Owner y respaldo verificado. Spec 021 §9.4 y §19.14.',
      eventos_totales, eventos_concedidos, eventos_denegados;
  END IF;

  RAISE NOTICE 'Comprobacion superada: cero eventos dependientes. La reversion puede proceder.';
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. REVERSION EN LA BASE DE DATOS: NINGUNA SENTENCIA. ES INTENCIONAL.
-- ---------------------------------------------------------------------------
--
-- Superada la comprobacion, NO HAY NADA QUE REVERTIR EN LA BASE DE DATOS:
--
--   * los dos valores del enum PERMANECEN, por la limitacion de PostgreSQL ya
--     explicada arriba, y sin ninguna fila que los use son INERTES;
--   * "audit_event" conserva integra su historia: no se borra, no se actualiza y
--     no se reasigna ninguna fila, y sus triggers, checks, indices, privilegios
--     y politicas no se tocan;
--   * la migracion no creo ningun otro objeto, de modo que no queda ninguno por
--     retirar.
--
-- No hay `BEGIN`/`COMMIT` porque no hay ninguna transformacion que hacer atomica:
-- este archivo es una COMPUERTA y una DECLARACION, no una transformacion.
DO $$
BEGIN
  RAISE NOTICE 'Reversion en base de datos: NINGUNA sentencia ejecutada. Cero filas de "audit_event" leidas en su contenido, modificadas o eliminadas.';
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. LO QUE SI ES REVERSIBLE, Y NO SE EJECUTA AQUI
-- ---------------------------------------------------------------------------
--
-- Fuera de la base de datos, solo con decision expresa, y UNICAMENTE valido
-- porque la comprobacion de la seccion 1 confirmo que ninguna fila usa los
-- valores:
--
--   1. retirar de `prisma/schema.prisma` los valores 'PATIENT_SELF_ACCESS_GRANTED'
--      y 'PATIENT_SELF_ACCESS_DENIED' del enum `AuditEventType`, y regenerar el
--      cliente con `npx prisma generate`.
--      ATENCION: el cliente dejaria entonces de reconocer dos valores que SIGUEN
--      existiendo en PostgreSQL, de modo que LEER un evento registrado con ellos
--      pasaria a ser un error de deserializacion. Retirarlos del esquema solo es
--      seguro si NINGUNA fila los usa — que es justamente lo que exige la
--      seccion 1;
--   2. retirar de `apps/api/src/audit/audit.service.ts` los metodos
--      `recordPatientSelfAccessGrantedWithin` y
--      `recordPatientSelfAccessDeniedWithin`, que son los UNICOS puntos que
--      emiten estos dos eventos, junto con su prueba
--      `apps/api/src/audit/audit.service.test.ts`;
--   3. retirar la fila de `_prisma_migrations` correspondiente a
--      `20260826120000_patient_self_audit_event_type`.
--
-- Ninguna de las tres se ejecuta en este archivo.
-- ---------------------------------------------------------------------------
