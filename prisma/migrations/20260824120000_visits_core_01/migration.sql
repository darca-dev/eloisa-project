-- ---------------------------------------------------------------------------
-- VISITS-CORE-01 — MP01 DB FOUNDATION. Migracion ADITIVA unica.
--
-- Contenido:
--   1. Enum nuevo "HomeVisitStatus" con cuatro valores CERRADOS.
--   2. Tabla "home_visit": materializacion operativa de una cita HOME asignada.
--   3. Tabla "home_visit_transition": historial APPEND-ONLY de sus cambios de
--      estado.
--   4. Restricciones de integridad, incluidas la coherencia de timestamps por
--      estado, el orden temporal de inicio y fin, y la maquina de transiciones
--      legales.
--   5. Trigger TENANT-AWARE que valida la cita y la asignacion de cuidado EN EL
--      ORIGEN de la visita.
--   6. Privilegios de minimo privilegio y Row Level Security FORZADA por tenant
--      para las dos tablas nuevas.
--
-- Caracter: ADITIVO. No crea una segunda agenda, no duplica el profesional
-- asignado, no copia persona ni paciente, no borra filas, no elimina tablas,
-- columnas ni tipos, no reescribe ninguna migracion anterior y no toca
-- volumenes. `appointment` y `care_assignment` conservan su definicion exacta:
-- lo unico que reciben son claves foraneas ENTRANTES desde "home_visit".
--
-- NINGUNA clave foranea de esta migracion es `CASCADE` al borrar: ni el borrado
-- de un paciente, una cita, una asignacion o una identidad retira una visita, ni
-- el de una visita retira su historial. La procedencia y la evidencia no se
-- pierden como efecto colateral.
--
-- ALCANCE DEL PAQUETE MP01: SOLO persistencia e integridad. NO crea servicios,
-- endpoints, guards, integracion con Agenda ni interfaz. En particular, la
-- mutacion transaccional que crea visita + transicion + auditoria NO vive aqui:
-- corresponde al siguiente paquete de servicio.
--
-- NO INSERTA NINGUN DATO. No hay visitas ni transiciones de demostracion: una
-- instalacion sin datos no muestra ninguna visita, que es el comportamiento
-- fail-closed deseado.
--
-- NO PERSISTE, y por tanto no modela, dato clinico, direccion, zona,
-- diagnostico, motivo, contacto, pago, alerta, cuidador, GPS, firma, archivo ni
-- nota alguna. NO contiene ningun secreto.
--
-- Rollback documentado: `prisma/migrations/ROLLBACK-visits_core_01.sql`.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1. Estado operativo de la visita
-- ---------------------------------------------------------------------------
--
-- Catalogo CERRADO. Deliberadamente NO existen `EN_ROUTE` ni `ARRIVED`
-- —implicarian despacho, ubicacion o reglas operativas no aprobadas— ni
-- `CANCELLED`: la cancelacion pertenece a Agenda y no esta implementada.
CREATE TYPE "HomeVisitStatus" AS ENUM (
  'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'NOT_COMPLETED'
);

-- ---------------------------------------------------------------------------
-- 2. Visita domiciliaria
-- ---------------------------------------------------------------------------
--
-- NO hay columna `professionalId`: el profesional se deriva de
-- `care_assignment`. NO hay columna de horario programado: el horario se lee de
-- `appointment.scheduledStart`. Esa AUSENCIA es la garantia estructural de que
-- esta tabla no duplica ni el profesional ni la agenda; ninguna comprobacion
-- podria sustituirla, porque no existe el valor que podria divergir.

CREATE TABLE "home_visit" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "appointmentId" UUID NOT NULL,
  "patientId" UUID NOT NULL,
  "careAssignmentId" UUID NOT NULL,
  "status" "HomeVisitStatus" NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "startedAt" TIMESTAMPTZ(6),
  "endedAt" TIMESTAMPTZ(6),
  "createdByInstitutionalIdentityId" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "home_visit_pkey" PRIMARY KEY ("id")
);

-- Permite FKs compuestas que impiden asociaciones entre tenants distintos.
CREATE UNIQUE INDEX "home_visit_id_tenant_unique"
  ON "home_visit" ("id", "tenantId");

-- Una cita materializa como mucho UNA visita domiciliaria. Es la barrera final
-- contra duplicados y contra carreras concurrentes de materializacion.
CREATE UNIQUE INDEX "home_visit_appointment_tenant_unique"
  ON "home_visit" ("appointmentId", "tenantId");

-- Indices minimos por tenant/estado, paciente y asignacion.
CREATE INDEX "home_visit_tenant_status_idx"
  ON "home_visit" ("tenantId", "status");

CREATE INDEX "home_visit_tenant_patient_idx"
  ON "home_visit" ("tenantId", "patientId");

CREATE INDEX "home_visit_tenant_care_assignment_idx"
  ON "home_visit" ("tenantId", "careAssignmentId");

ALTER TABLE "home_visit"
  ADD CONSTRAINT "home_visit_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Claves foraneas COMPUESTAS: cita, paciente, asignacion e identidad creadora
-- deben pertenecer al MISMO tenant que la visita. Conocer un identificador
-- ajeno no basta para asociarlo.
--
-- NINGUNA de las cuatro es `CASCADE`. Una visita domiciliaria es un REGISTRO
-- MATERIAL con procedencia: no puede desaparecer como efecto colateral y
-- silencioso del borrado de otra fila. Retirar una visita —y con ella su
-- historial de transiciones y la atribucion de cada cambio de estado— exige una
-- decision expresa y su propia Task, no el borrado de un paciente, una cita, una
-- asignacion o una identidad.
--
-- `NO ACTION` hacia cita y asignacion, `RESTRICT` hacia paciente e identidad:
-- las cuatro RECHAZAN el borrado mientras exista la visita. `NO ACTION` aplaza
-- la comprobacion al final de la sentencia y `RESTRICT` la exige de inmediato;
-- ninguna de las dos borra nada.
ALTER TABLE "home_visit"
  ADD CONSTRAINT "home_visit_appointment_fkey"
  FOREIGN KEY ("appointmentId", "tenantId")
  REFERENCES "appointment" ("id", "tenantId")
  ON DELETE NO ACTION ON UPDATE CASCADE;

ALTER TABLE "home_visit"
  ADD CONSTRAINT "home_visit_patient_fkey"
  FOREIGN KEY ("patientId", "tenantId")
  REFERENCES "patient" ("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "home_visit"
  ADD CONSTRAINT "home_visit_care_assignment_fkey"
  FOREIGN KEY ("careAssignmentId", "tenantId")
  REFERENCES "care_assignment" ("id", "tenantId")
  ON DELETE NO ACTION ON UPDATE CASCADE;

-- La identidad institucional creadora NO se borra mientras exista una visita
-- que la nombre: la procedencia administrativa no se pierde.
ALTER TABLE "home_visit"
  ADD CONSTRAINT "home_visit_created_by_identity_fkey"
  FOREIGN KEY ("createdByInstitutionalIdentityId", "tenantId")
  REFERENCES "institutional_identity" ("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- (1) La version del control optimista empieza en 1 y solo crece.
ALTER TABLE "home_visit"
  ADD CONSTRAINT "home_visit_version_positive"
  CHECK ("version" > 0);

-- (2) Coherencia EXACTA de los timestamps con el estado.
--
--   * `SCHEDULED`      : sin inicio y sin fin;
--   * `IN_PROGRESS`    : con inicio y sin fin;
--   * `COMPLETED`      : con inicio y con fin;
--   * `NOT_COMPLETED`  : con fin; el inicio puede faltar, porque este estado
--                        puede originarse desde `SCHEDULED` —la visita nunca
--                        empezo— o desde `IN_PROGRESS` —ya habia empezado—.
--
-- Las cuatro mitades viven en un solo check para que no puedan divergir.
ALTER TABLE "home_visit"
  ADD CONSTRAINT "home_visit_status_timestamps"
  CHECK (
    ("status" = 'SCHEDULED' AND "startedAt" IS NULL AND "endedAt" IS NULL)
    OR ("status" = 'IN_PROGRESS' AND "startedAt" IS NOT NULL AND "endedAt" IS NULL)
    OR ("status" = 'COMPLETED' AND "startedAt" IS NOT NULL AND "endedAt" IS NOT NULL)
    OR ("status" = 'NOT_COMPLETED' AND "endedAt" IS NOT NULL)
  );

-- (3) Orden TEMPORAL de los dos instantes.
--
-- Independiente del estado y complementario al check anterior: cuando ambos
-- instantes existen, el fin NUNCA puede preceder al inicio. Se escriben las dos
-- ramas nulas de forma explicita para que la intencion quede legible: si falta
-- cualquiera de los dos, no hay orden que comprobar y la fila pasa.
--
-- La igualdad se ADMITE: una visita cuyo inicio y fin coinciden es una duracion
-- de cero, no una incoherencia, y este paquete no aprueba ninguna duracion
-- minima.
ALTER TABLE "home_visit"
  ADD CONSTRAINT "home_visit_temporal_order"
  CHECK (
    "endedAt" IS NULL OR "startedAt" IS NULL OR "endedAt" >= "startedAt"
  );

-- (4) Origen valido de la visita, de forma TENANT-AWARE.
--
-- Un CHECK no basta porque hay que consultar la cita y la asignacion. La
-- funcion es SECURITY INVOKER a proposito: ejecutada por `merdn_runtime` queda
-- sujeta a Row Level Security, de modo que no puede leer citas ni asignaciones
-- de otra institucion ni convertirse en un canal de lectura privilegiada.
--
-- Se comprueba UNICAMENTE en INSERT, es decir en el ORIGEN de la visita. La
-- pregunta que responde este trigger —¿esta cita HOME y asignada justifica que
-- exista esta visita?— se decide UNA SOLA VEZ, cuando la visita nace.
--
-- Deliberadamente NO se revalida en UPDATE. Una visita ya materializada es un
-- registro MATERIAL: su avance de estado no puede quedar bloqueado porque la
-- cita o la asignacion evolucionen despues —una asignacion que termina, una cita
-- que cambia de estado—. De otro modo una visita realmente iniciada no podria
-- registrarse como completada ni como no realizada, y el historial perderia
-- justamente el hecho que debe conservar.
--
-- Las reglas que SI gobiernan el avance de estado no dependen de este trigger y
-- se siguen aplicando en UPDATE: el check de coherencia de timestamps, el de
-- orden temporal y el de version. Las transiciones legales viven en
-- "home_visit_transition". La mutacion transaccional que las escribe corresponde
-- al paquete de servicio.
CREATE OR REPLACE FUNCTION "merdn_home_visit_guard"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  cita record;
  asignacion record;
BEGIN
  SELECT "patientId", "careAssignmentId", "modality", "status"
    INTO cita
    FROM "appointment"
   WHERE "id" = NEW."appointmentId" AND "tenantId" = NEW."tenantId";

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La cita de la visita no existe en el tenant indicado.'
      USING ERRCODE = '23503';
  END IF;

  IF cita."modality" <> 'HOME' THEN
    RAISE EXCEPTION 'Solo una cita de modalidad HOME materializa una visita domiciliaria.'
      USING ERRCODE = '23514';
  END IF;

  IF cita."status" <> 'ASSIGNED' THEN
    RAISE EXCEPTION 'Solo una cita ASSIGNED materializa una visita domiciliaria.'
      USING ERRCODE = '23514';
  END IF;

  IF cita."patientId" <> NEW."patientId" THEN
    RAISE EXCEPTION 'El paciente de la visita no coincide con el de la cita.'
      USING ERRCODE = '23514';
  END IF;

  IF cita."careAssignmentId" IS DISTINCT FROM NEW."careAssignmentId" THEN
    RAISE EXCEPTION 'La asignacion de la visita no coincide con la de la cita.'
      USING ERRCODE = '23514';
  END IF;

  SELECT "patientId", "status"
    INTO asignacion
    FROM "care_assignment"
   WHERE "id" = NEW."careAssignmentId" AND "tenantId" = NEW."tenantId";

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La asignacion de cuidado no existe en el tenant indicado.'
      USING ERRCODE = '23503';
  END IF;

  IF asignacion."status" <> 'ACTIVE' THEN
    RAISE EXCEPTION 'La asignacion de cuidado debe estar ACTIVE.'
      USING ERRCODE = '23514';
  END IF;

  IF asignacion."patientId" <> NEW."patientId" THEN
    RAISE EXCEPTION 'La asignacion de cuidado pertenece a otro paciente.'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "home_visit_guard"
  BEFORE INSERT ON "home_visit"
  FOR EACH ROW EXECUTE FUNCTION "merdn_home_visit_guard"();

-- ---------------------------------------------------------------------------
-- 3. Historial append-only de transiciones
-- ---------------------------------------------------------------------------

CREATE TABLE "home_visit_transition" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "homeVisitId" UUID NOT NULL,
  "fromStatus" "HomeVisitStatus",
  "toStatus" "HomeVisitStatus" NOT NULL,
  "performedByHumanAccountId" UUID,
  "occurredAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "home_visit_transition_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "home_visit_transition_id_tenant_unique"
  ON "home_visit_transition" ("id", "tenantId");

-- Sostiene la lectura del historial de una visita en orden cronologico.
CREATE INDEX "home_visit_transition_tenant_visit_occurred_idx"
  ON "home_visit_transition" ("tenantId", "homeVisitId", "occurredAt");

-- Exactamente UNA transicion de creacion por visita (VISITS-CORE-01 §5.3). El
-- indice es PARCIAL: solo compite la fila cuyo estado anterior es nulo.
CREATE UNIQUE INDEX "home_visit_transition_creation_unique"
  ON "home_visit_transition" ("homeVisitId", "tenantId")
  WHERE "fromStatus" IS NULL;

ALTER TABLE "home_visit_transition"
  ADD CONSTRAINT "home_visit_transition_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "home_visit_transition"
  ADD CONSTRAINT "home_visit_transition_visit_fkey"
  FOREIGN KEY ("homeVisitId", "tenantId")
  REFERENCES "home_visit" ("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- La cuenta humana que ejecuto una transicion NO se borra mientras exista la
-- transicion que la nombra: la atribucion no se pierde.
--
-- Lo mismo vale hacia la visita: `RESTRICT` y NO `CASCADE`. Borrar una visita
-- no puede llevarse por delante, en silencio, la unica constancia de quien la
-- inicio, la completo o la dio por no realizada.
ALTER TABLE "home_visit_transition"
  ADD CONSTRAINT "home_visit_transition_performed_by_fkey"
  FOREIGN KEY ("performedByHumanAccountId", "tenantId")
  REFERENCES "human_account" ("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- (5) y (6) Maquina de transiciones LEGALES y actor exigido, en un solo check
-- para que las dos mitades no puedan divergir:
--
--   * creacion: `fromStatus` nulo, `toStatus` = 'SCHEDULED' y actor humano
--     NULO. Su actor institucional integro vive en
--     `home_visit.createdByInstitutionalIdentityId`;
--   * posteriores: actor humano OBLIGATORIO y solo
--     `SCHEDULED -> IN_PROGRESS | NOT_COMPLETED` e
--     `IN_PROGRESS -> COMPLETED | NOT_COMPLETED`.
--
-- Quedan por tanto PROHIBIDOS en la base los saltos, la reapertura, la
-- reversion y cualquier transicion desde un estado terminal.
ALTER TABLE "home_visit_transition"
  ADD CONSTRAINT "home_visit_transition_machine"
  CHECK (
    (
      "fromStatus" IS NULL
      AND "toStatus" = 'SCHEDULED'
      AND "performedByHumanAccountId" IS NULL
    )
    OR (
      "performedByHumanAccountId" IS NOT NULL
      AND (
        ("fromStatus" = 'SCHEDULED' AND "toStatus" IN ('IN_PROGRESS', 'NOT_COMPLETED'))
        OR ("fromStatus" = 'IN_PROGRESS' AND "toStatus" IN ('COMPLETED', 'NOT_COMPLETED'))
      )
    )
  );

-- ---------------------------------------------------------------------------
-- 4. Minimo privilegio y Row Level Security FORZADA
-- ---------------------------------------------------------------------------
--
-- Lo que la superficie futura hace con cada tabla, y NADA mas:
--
--   * `home_visit`: se CREA al asignar una cita HOME y se ACTUALIZA su estado.
--     SELECT, INSERT y UPDATE.
--   * `home_visit_transition`: APPEND-ONLY. SELECT e INSERT unicamente, de modo
--     que una transicion registrada no puede reescribirse ni retirarse en
--     ejecucion. Corregir un historial exige una decision y una Task propias,
--     no un UPDATE silencioso.
--
-- En NINGUNA de las dos se concede DELETE: la historia no se borra.

GRANT SELECT, INSERT, UPDATE ON TABLE "home_visit"            TO "merdn_runtime";
GRANT SELECT, INSERT         ON TABLE "home_visit_transition" TO "merdn_runtime";

-- `FORCE` ademas de `ENABLE`: la politica de tenant se aplica TAMBIEN al
-- propietario de la tabla. Sin `FORCE`, un proceso conectado como propietario
-- —una tarea administrativa, una migracion futura, un script— podria leer o
-- escribir visitas de cualquier institucion sin contexto. Un superusuario sigue
-- estando fuera de Row Level Security por diseno de PostgreSQL: por eso el rol
-- de ejecucion NO es superusuario y NO es propietario.
ALTER TABLE "home_visit"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "home_visit"            FORCE  ROW LEVEL SECURITY;
ALTER TABLE "home_visit_transition" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "home_visit_transition" FORCE  ROW LEVEL SECURITY;

-- Estrictamente del tenant activo, tanto al leer como al escribir. `WITH CHECK`
-- impide insertar o mover una fila a otro tenant aunque la aplicacion fallara.
-- Sin contexto de tenant, `merdn_current_tenant()` devuelve NULL, la comparacion
-- no es verdadera y la politica NO deja pasar ninguna fila: falla CERRADO.
CREATE POLICY "home_visit_tenant" ON "home_visit"
  FOR ALL TO "merdn_runtime"
  USING ("tenantId" = "merdn_current_tenant"())
  WITH CHECK ("tenantId" = "merdn_current_tenant"());

CREATE POLICY "home_visit_transition_tenant" ON "home_visit_transition"
  FOR ALL TO "merdn_runtime"
  USING ("tenantId" = "merdn_current_tenant"())
  WITH CHECK ("tenantId" = "merdn_current_tenant"());
