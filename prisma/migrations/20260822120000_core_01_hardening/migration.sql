-- ---------------------------------------------------------------------------
-- TASK-MVP-CORE-01 — migracion 3 de 3: endurecimiento autorizado por Codex.
--
-- Contenido:
--   1. `areaType` pasa a OBLIGATORIA en la direccion del paciente.
--   2. Integridad territorial impuesta por la base: jerarquia, tipo y tenant.
--   3. Auditoria append-only: ni el runtime ni el propietario pueden alterar
--      ni borrar eventos ya registrados.
--   4. Row Level Security con un rol runtime sin BYPASSRLS y de minimo
--      privilegio, de modo que el aislamiento por tenant no dependa solo de
--      los filtros de la aplicacion.
--
-- Caracter: ADITIVO Y CORRECTIVO. No borra filas, no elimina tablas, no toca
-- volumenes y no modifica las dos migraciones anteriores.
--
-- REQUISITO DE APLICACION: `patient_address."areaType"` no puede contener
-- valores nulos. CORE-01 no ha sido desplegado en ningun entorno productivo, de
-- modo que en la practica la tabla esta vacia. Si una base de desarrollo tuviera
-- filas antiguas con area sin declarar, la migracion falla de forma explicita en
-- lugar de inventar un valor: esa decision corresponde a la persona, no al
-- sistema.
--
-- Rollback documentado: `prisma/migrations/ROLLBACK-core_01.sql`.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1. Area urbana o rural obligatoria
-- ---------------------------------------------------------------------------

ALTER TABLE "patient_address" ALTER COLUMN "areaType" SET NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. Integridad territorial
-- ---------------------------------------------------------------------------

-- Permite claves foraneas compuestas contra (id, tenantId) de una unidad.
CREATE UNIQUE INDEX IF NOT EXISTS "territorial_unit_id_tenant_unique"
  ON "territorial_unit" ("id", "tenantId");

-- Una unidad local referenciada por una direccion debe pertenecer AL MISMO
-- tenant que la direccion. Con `localUnitId` nulo (localidad pendiente de
-- normalizacion) la restriccion no aplica, que es exactamente lo previsto.
ALTER TABLE "patient_address"
  ADD CONSTRAINT "patient_address_local_unit_tenant_fkey"
  FOREIGN KEY ("localUnitId", "tenantId")
  REFERENCES "territorial_unit" ("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Coherencia de la jerarquia territorial. Un CHECK no basta porque hay que
-- consultar la fila padre.
CREATE OR REPLACE FUNCTION "merdn_territorial_unit_guard"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  parent_type "TerritorialUnitType";
  parent_tenant uuid;
BEGIN
  IF NEW."parentId" IS NOT NULL THEN
    SELECT "type", "tenantId" INTO parent_type, parent_tenant
      FROM "territorial_unit" WHERE "id" = NEW."parentId";

    IF NOT FOUND THEN
      RAISE EXCEPTION 'La unidad territorial padre no existe.'
        USING ERRCODE = '23503';
    END IF;
  END IF;

  IF NEW."type" = 'DEPARTMENT' THEN
    IF NEW."parentId" IS NOT NULL THEN
      RAISE EXCEPTION 'Un departamento no puede tener unidad padre.'
        USING ERRCODE = '23514';
    END IF;

  ELSIF NEW."type" = 'MUNICIPALITY' THEN
    IF parent_type IS DISTINCT FROM 'DEPARTMENT' THEN
      RAISE EXCEPTION 'El padre de un municipio debe ser un departamento.'
        USING ERRCODE = '23514';
    END IF;

  ELSE
    -- Barrio y vereda: administrados por un tenant y colgados de un municipio.
    IF parent_type IS DISTINCT FROM 'MUNICIPALITY' THEN
      RAISE EXCEPTION 'El padre de un barrio o vereda debe ser un municipio.'
        USING ERRCODE = '23514';
    END IF;

    IF NEW."tenantId" IS NULL THEN
      RAISE EXCEPTION 'Un barrio o vereda debe pertenecer a un tenant.'
        USING ERRCODE = '23514';
    END IF;

    -- El municipio padre es una unidad nacional compartida: una unidad local
    -- nunca cuelga de territorio de otra institucion.
    IF parent_tenant IS NOT NULL THEN
      RAISE EXCEPTION 'El municipio padre debe ser una unidad nacional compartida.'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "territorial_unit_guard"
  BEFORE INSERT OR UPDATE ON "territorial_unit"
  FOR EACH ROW EXECUTE FUNCTION "merdn_territorial_unit_guard"();

-- Coherencia de la direccion contra el catalogo: tipos correctos, jerarquia
-- real y concordancia entre el area declarada y el tipo de la unidad local.
CREATE OR REPLACE FUNCTION "merdn_patient_address_guard"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  department_type "TerritorialUnitType";
  municipality_type "TerritorialUnitType";
  municipality_parent uuid;
  local_type "TerritorialUnitType";
  local_parent uuid;
BEGIN
  SELECT "type" INTO department_type
    FROM "territorial_unit" WHERE "id" = NEW."departmentUnitId";
  IF department_type IS DISTINCT FROM 'DEPARTMENT' THEN
    RAISE EXCEPTION 'La unidad de departamento de la direccion no es un departamento.'
      USING ERRCODE = '23514';
  END IF;

  SELECT "type", "parentId" INTO municipality_type, municipality_parent
    FROM "territorial_unit" WHERE "id" = NEW."municipalityUnitId";
  IF municipality_type IS DISTINCT FROM 'MUNICIPALITY' THEN
    RAISE EXCEPTION 'La unidad de municipio de la direccion no es un municipio.'
      USING ERRCODE = '23514';
  END IF;

  IF municipality_parent IS DISTINCT FROM NEW."departmentUnitId" THEN
    RAISE EXCEPTION 'El municipio de la direccion no pertenece a su departamento.'
      USING ERRCODE = '23514';
  END IF;

  IF NEW."localUnitId" IS NOT NULL THEN
    SELECT "type", "parentId" INTO local_type, local_parent
      FROM "territorial_unit" WHERE "id" = NEW."localUnitId";

    IF local_type NOT IN ('NEIGHBORHOOD', 'RURAL_SETTLEMENT') THEN
      RAISE EXCEPTION 'La unidad local de la direccion no es un barrio ni una vereda.'
        USING ERRCODE = '23514';
    END IF;

    IF local_parent IS DISTINCT FROM NEW."municipalityUnitId" THEN
      RAISE EXCEPTION 'La unidad local de la direccion no pertenece a su municipio.'
        USING ERRCODE = '23514';
    END IF;

    -- El tipo de la unidad canonica manda sobre el area declarada.
    IF (local_type = 'NEIGHBORHOOD' AND NEW."areaType" <> 'URBAN')
       OR (local_type = 'RURAL_SETTLEMENT' AND NEW."areaType" <> 'RURAL') THEN
      RAISE EXCEPTION 'El area declarada no concuerda con el tipo de la unidad local.'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "patient_address_guard"
  BEFORE INSERT OR UPDATE ON "patient_address"
  FOR EACH ROW EXECUTE FUNCTION "merdn_patient_address_guard"();

-- ---------------------------------------------------------------------------
-- 3. Auditoria append-only
-- ---------------------------------------------------------------------------

-- Se aplica a TODOS los roles, incluido el propietario de la tabla: un evento
-- registrado no se corrige ni se borra, se complementa con eventos nuevos.
CREATE OR REPLACE FUNCTION "merdn_audit_event_append_only"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_event es append-only: no admite UPDATE, DELETE ni TRUNCATE.'
    USING ERRCODE = '42501';
END;
$$;

CREATE TRIGGER "audit_event_append_only_row"
  BEFORE UPDATE OR DELETE ON "audit_event"
  FOR EACH ROW EXECUTE FUNCTION "merdn_audit_event_append_only"();

CREATE TRIGGER "audit_event_append_only_truncate"
  BEFORE TRUNCATE ON "audit_event"
  FOR EACH STATEMENT EXECUTE FUNCTION "merdn_audit_event_append_only"();

-- ---------------------------------------------------------------------------
-- 4. Rol runtime y Row Level Security
-- ---------------------------------------------------------------------------

-- Rol de ejecucion de minimo privilegio.
--
-- Se crea SIN LOGIN de forma deliberada: asi no se inventa ni se versiona
-- ninguna credencial. La aplicacion adopta este rol dentro de cada transaccion
-- de negocio con `SET LOCAL ROLE`, de modo que PostgreSQL aplica RLS aunque la
-- conexion se haya establecido con un rol administrativo. Un despliegue que
-- prefiera una conexion dedicada puede anadir LOGIN y contrasena fuera del
-- repositorio, sin cambiar ninguna politica.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'merdn_runtime') THEN
    CREATE ROLE "merdn_runtime"
      NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOREPLICATION INHERIT;
  END IF;
END;
$$;

-- El rol que ejecuta las migraciones debe poder adoptar el rol runtime.
DO $$
BEGIN
  EXECUTE format('GRANT "merdn_runtime" TO %I', current_user);
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN insufficient_privilege THEN
    RAISE WARNING 'No se pudo conceder merdn_runtime a %: concedalo manualmente.', current_user;
END;
$$;

GRANT USAGE ON SCHEMA "public" TO "merdn_runtime";

-- Minimo privilegio: ningun DELETE en ninguna tabla, ninguna escritura sobre el
-- catalogo territorial y ninguna modificacion de auditoria.
GRANT SELECT                 ON TABLE "tenant"                        TO "merdn_runtime";
GRANT SELECT                 ON TABLE "territorial_unit"              TO "merdn_runtime";
GRANT SELECT, INSERT, UPDATE ON TABLE "person"                        TO "merdn_runtime";
GRANT SELECT, INSERT, UPDATE ON TABLE "patient"                       TO "merdn_runtime";
GRANT SELECT, INSERT         ON TABLE "patient_population_membership" TO "merdn_runtime";
GRANT SELECT, INSERT, UPDATE ON TABLE "patient_address"               TO "merdn_runtime";
GRANT SELECT, INSERT         ON TABLE "consent_record"                TO "merdn_runtime";
GRANT SELECT, INSERT, UPDATE ON TABLE "enrollment_session"            TO "merdn_runtime";
GRANT SELECT, INSERT         ON TABLE "audit_event"                   TO "merdn_runtime";

-- Tenant activo de la transaccion. `merdn.tenant_id` se fija con
-- `set_config(..., true)`, de alcance transaccional: una conexion reutilizada
-- del pool nunca hereda el contexto de la peticion anterior.
CREATE OR REPLACE FUNCTION "merdn_current_tenant"() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('merdn.tenant_id', true), '')::uuid;
$$;

ALTER TABLE "tenant"                        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "territorial_unit"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE "person"                        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "patient"                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "patient_population_membership" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "patient_address"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE "consent_record"                ENABLE ROW LEVEL SECURITY;
ALTER TABLE "enrollment_session"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_event"                   ENABLE ROW LEVEL SECURITY;

-- El tenant activo solo se ve a si mismo.
CREATE POLICY "tenant_self" ON "tenant"
  FOR SELECT TO "merdn_runtime"
  USING ("id" = "merdn_current_tenant"());

-- Territorio: las unidades nacionales son compartidas; las locales pertenecen a
-- un tenant y no son visibles para los demas.
CREATE POLICY "territorial_unit_scope" ON "territorial_unit"
  FOR SELECT TO "merdn_runtime"
  USING ("tenantId" IS NULL OR "tenantId" = "merdn_current_tenant"());

-- Datos personales y operativos: estrictamente del tenant activo, tanto al leer
-- como al escribir. `WITH CHECK` impide insertar o mover una fila a otro tenant.
CREATE POLICY "person_tenant" ON "person"
  FOR ALL TO "merdn_runtime"
  USING ("tenantId" = "merdn_current_tenant"())
  WITH CHECK ("tenantId" = "merdn_current_tenant"());

CREATE POLICY "patient_tenant" ON "patient"
  FOR ALL TO "merdn_runtime"
  USING ("tenantId" = "merdn_current_tenant"())
  WITH CHECK ("tenantId" = "merdn_current_tenant"());

CREATE POLICY "patient_population_membership_tenant" ON "patient_population_membership"
  FOR ALL TO "merdn_runtime"
  USING ("tenantId" = "merdn_current_tenant"())
  WITH CHECK ("tenantId" = "merdn_current_tenant"());

CREATE POLICY "patient_address_tenant" ON "patient_address"
  FOR ALL TO "merdn_runtime"
  USING ("tenantId" = "merdn_current_tenant"())
  WITH CHECK ("tenantId" = "merdn_current_tenant"());

CREATE POLICY "consent_record_tenant" ON "consent_record"
  FOR ALL TO "merdn_runtime"
  USING ("tenantId" = "merdn_current_tenant"())
  WITH CHECK ("tenantId" = "merdn_current_tenant"());

CREATE POLICY "enrollment_session_tenant" ON "enrollment_session"
  FOR ALL TO "merdn_runtime"
  USING ("tenantId" = "merdn_current_tenant"())
  WITH CHECK ("tenantId" = "merdn_current_tenant"());

-- Auditoria: lectura e insercion del propio tenant. UPDATE y DELETE no tienen
-- politica y ademas carecen de permiso y estan bloqueados por trigger.
CREATE POLICY "audit_event_tenant_read" ON "audit_event"
  FOR SELECT TO "merdn_runtime"
  USING ("tenantId" = "merdn_current_tenant"());

CREATE POLICY "audit_event_tenant_append" ON "audit_event"
  FOR INSERT TO "merdn_runtime"
  WITH CHECK ("tenantId" = "merdn_current_tenant"());
