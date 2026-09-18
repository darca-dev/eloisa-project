-- ---------------------------------------------------------------------------
-- ROLLBACK documentado de VISITS-CORE-01 — MP01 DB FOUNDATION.
--
-- NO se ejecuta automaticamente y NO forma parte de la carpeta de migraciones
-- aplicadas: es documentacion ejecutable que exige autorizacion expresa del
-- Product Owner y respaldo previo verificado en cualquier entorno con datos.
--
-- Alcance de la reversion:
--   - retira las DOS tablas nuevas, su trigger, su funcion guard, sus politicas
--     de Row Level Security y el enum "HomeVisitStatus";
--   - NO retira ningun valor de "AuditEventType" ni de "AuditActorType":
--     el paquete MP01 no anadio ninguno.
--
-- NO toca ningun dato de CORE-01, MUNICIPALITY-CORE-01, HOSPITAL-CORE-01,
-- HOSPITAL-CORE-02 ni IDENTITY-RELATIONSHIPS-CORE-01: personas, pacientes,
-- direcciones, consentimientos, catalogo territorial, identidades y sesiones
-- institucionales, perfiles profesionales, asignaciones, citas, cuentas
-- humanas, sesiones humanas y relaciones Paciente-Cuidador permanecen
-- INTACTOS. `appointment` y `care_assignment` solo pierden claves foraneas
-- ENTRANTES; su definicion, sus filas y sus propias restricciones no cambian.
--
-- ADVERTENCIA MATERIAL: retirar `home_visit` y `home_visit_transition` DESTRUYE
-- el estado operativo de las visitas domiciliarias y su historial append-only
-- de transiciones, incluida la atribucion de cada cambio de estado. Esa perdida
-- NO es reconstruible desde ninguna otra tabla: la cita conserva el horario y
-- la asignacion conserva el profesional, pero ni una ni otra registran si la
-- visita se inicio, se completo o no se realizo, ni quien lo hizo. Esta
-- reversion solo es segura sobre un despliegue donde las dos tablas esten
-- vacias, o con una decision expresa y un respaldo verificado sobre su
-- contenido.
-- ---------------------------------------------------------------------------

BEGIN;

-- ---------------------------------------------------------------------------
-- ADVERTENCIA OBLIGATORIA
-- ---------------------------------------------------------------------------
--
-- Si ya existen filas en las tablas nuevas, la reversion NO puede completarse
-- de forma limpia:
--
--   * `home_visit_transition` es APPEND-ONLY y su contenido es la unica
--     constancia de quien inicio, completo o no realizo cada visita;
--   * `audit_event` es append-only y su trigger rechaza DELETE incluso al
--     propietario, de modo que cualquier evento ya registrado sobre una visita
--     quedaria apuntando a un recurso que dejo de existir.
--
-- Esta comprobacion debe ejecutarse ANTES y su resultado debe ser cero en las
-- dos cifras. Si no lo es, DETENGASE: la decision sobre esos registros
-- corresponde a una persona, no a este archivo, y no se inventa aqui ningun
-- valor sustituto.
DO $$
DECLARE
  visitas bigint;
  transiciones bigint;
BEGIN
  SELECT count(*) INTO visitas      FROM "home_visit";
  SELECT count(*) INTO transiciones FROM "home_visit_transition";

  IF visitas <> 0 OR transiciones <> 0 THEN
    RAISE EXCEPTION
      'REVERSION DETENIDA: % visitas y % transiciones existentes. Se exige decision expresa y respaldo verificado.',
      visitas, transiciones;
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- 1. Politicas, trigger, funcion y tablas
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "home_visit_transition_tenant" ON "home_visit_transition";
DROP POLICY IF EXISTS "home_visit_tenant"            ON "home_visit";

DROP TRIGGER IF EXISTS "home_visit_guard" ON "home_visit";
DROP FUNCTION IF EXISTS "merdn_home_visit_guard"();

-- El orden respeta las dependencias: el historial cuelga de la visita.
-- Los privilegios concedidos a `merdn_runtime` desaparecen con las tablas.
DROP TABLE IF EXISTS "home_visit_transition";
DROP TABLE IF EXISTS "home_visit";

-- ---------------------------------------------------------------------------
-- 2. Enum propio de esta migracion
-- ---------------------------------------------------------------------------
--
-- Solo lo usan las dos tablas retiradas, de modo que puede eliminarse por
-- completo. No es el caso de los enums de auditoria, que esta migracion NO
-- modifico.

DROP TYPE IF EXISTS "HomeVisitStatus";

-- ---------------------------------------------------------------------------
-- 3. Lo que esta reversion NO deshace
-- ---------------------------------------------------------------------------
--
--   * `appointment` y `care_assignment` conservan sus filas, su modalidad, su
--     estado y su version: la visita nunca fue su fuente de verdad;
--   * `audit_event` conserva integra su historia: es append-only y no se
--     reinterpreta;
--   * `institutional_identity` y `human_account` conservan todas sus filas: las
--     claves foraneas retiradas eran ENTRANTES hacia ellas.
--
-- Tras esta reversion, `prisma/schema.prisma` debe volver al estado anterior a
-- VISITS-CORE-01 MP01 —enum `HomeVisitStatus`, modelos `HomeVisit` y
-- `HomeVisitTransition` y las relaciones inversas anadidas en `Tenant`,
-- `Patient`, `Appointment`, `CareAssignment`, `InstitutionalIdentity` y
-- `HumanAccount`— y debe retirarse la fila correspondiente de
-- `_prisma_migrations`. Ninguna de esas dos acciones se ejecuta aqui: ambas
-- exigen decision expresa.

COMMIT;
