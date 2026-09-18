-- ---------------------------------------------------------------------------
-- TASK-HOSPITAL-CORE-02 — migracion ADITIVA unica.
--
-- Contenido:
--   1. Valor nuevo en "InstitutionalRole": el rol minimo de agenda hospitalaria.
--   2. Seis valores nuevos en "AuditEventType": acceso a Profesionales (listado
--      y detalle), acceso a Agenda, creacion de asignacion, asignacion de cita
--      y denegacion de la superficie de operaciones hospitalarias.
--   3. Siete enums nuevos y CUATRO tablas nuevas: perfil profesional, vinculo
--      operativo declarado, asignacion de cuidado y cita de agenda.
--   4. Privilegios de minimo privilegio y Row Level Security por tenant para
--      las cuatro tablas nuevas.
--
-- Caracter: ADITIVO. No crea una segunda persona ni un segundo paciente, no
-- borra filas, no elimina tablas, columnas ni tipos, no reescribe ninguna
-- migracion anterior y no toca volumenes.
--
-- NO INSERTA NINGUN DATO. No hay personas, pacientes, profesionales,
-- afiliaciones, asignaciones ni citas de demostracion: una instalacion sin
-- datos muestra estados vacios honestos (TASK-HOSPITAL-CORE-02 §5.5).
--
-- NO contiene ningun secreto: la credencial de la identidad institucional de
-- agenda se aprovisiona en ejecucion desde la configuracion del servidor y solo
-- se almacena su derivacion `scrypt`.
--
-- Rollback documentado: `prisma/migrations/ROLLBACK-hospital_core_02.sql`.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1. Rol institucional de agenda hospitalaria
-- ---------------------------------------------------------------------------
--
-- Aditivo y DISJUNTO: las identidades y sesiones ya emitidas conservan su rol
-- sin cambio alguno. `HOSPITAL_PATIENT_VIEWER` NO gana ninguna escritura y
-- `HOSPITAL_SCHEDULER` NO gana acceso a Hospital Pacientes ni a Alcaldia.
ALTER TYPE "InstitutionalRole" ADD VALUE IF NOT EXISTS 'HOSPITAL_SCHEDULER';

-- ---------------------------------------------------------------------------
-- 2. Eventos de auditoria de la superficie de operaciones hospitalarias
-- ---------------------------------------------------------------------------

ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'HOSPITAL_PROFESSIONAL_LIST_ACCESS_GRANTED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'HOSPITAL_PROFESSIONAL_DETAIL_ACCESS_GRANTED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'HOSPITAL_AGENDA_ACCESS_GRANTED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'CARE_ASSIGNMENT_CREATED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'APPOINTMENT_ASSIGNED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'HOSPITAL_OPERATIONS_ACCESS_DENIED';

-- NOTA DELIBERADA sobre `audit_event_resource_required`.
--
-- El check vigente, reescrito por TASK-HOSPITAL-CORE-01, expresa el invariante
-- en forma NEGATIVA: solo los eventos que CREAN o MODIFICAN un recurso estan
-- obligados a nombrarlo. Los tres eventos de ACCESO que anade esta migracion
-- caen por tanto del lado permitido sin tocar el check.
--
-- `CARE_ASSIGNMENT_CREATED` y `APPOINTMENT_ASSIGNED` SI nombran su recurso, y
-- la aplicacion lo escribe siempre. NO se anaden a la lista positiva del check
-- porque PostgreSQL prohibe usar en la misma transaccion un valor de enum
-- anadido en esa misma transaccion. Endurecer el check exige una migracion
-- posterior separada; se reporta como riesgo residual conocido.

-- ---------------------------------------------------------------------------
-- 3. Enums del dominio de profesionales y agenda
-- ---------------------------------------------------------------------------

-- Estado del PERFIL. No es disponibilidad, no es turno y no es habilitacion.
CREATE TYPE "ProfessionalStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- Vinculo operativo DECLARADO. No acredita relacion laboral, contrato, nomina,
-- honorarios, habilitacion ni documento verificado.
CREATE TYPE "ProfessionalEngagementType" AS ENUM ('EMPLOYEE', 'INDEPENDENT', 'THIRD_PARTY');

CREATE TYPE "ProfessionalAffiliationStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ENDED');

-- Este slice solo admite el papel primario.
CREATE TYPE "CareAssignmentRole" AS ENUM ('PRIMARY');

CREATE TYPE "CareAssignmentStatus" AS ENUM ('ACTIVE', 'ENDED');

-- Clasificacion de AGENDA. No abre Visitas domiciliarias ni Consultas
-- virtuales, no habilita videollamada y no describe desplazamiento.
CREATE TYPE "AppointmentModality" AS ENUM ('ON_SITE', 'HOME', 'VIRTUAL');

-- Este slice solo transiciona `REQUESTED` -> `ASSIGNED`. `CANCELLED` existe
-- para que el contrato no cambie cuando se apruebe la cancelacion, pero ningun
-- endpoint de esta Task lo produce.
CREATE TYPE "AppointmentStatus" AS ENUM ('REQUESTED', 'ASSIGNED', 'CANCELLED');

-- ---------------------------------------------------------------------------
-- 4. Perfil profesional
-- ---------------------------------------------------------------------------
--
-- Un profesional es una PARTICIPACION de la unica `Person` del tenant: no se
-- duplica nombre, documento, contacto ni fecha de nacimiento.

CREATE TABLE "professional_profile" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "personId" UUID NOT NULL,
  "professionCode" TEXT NOT NULL,
  "professionNameControlled" TEXT NOT NULL,
  "status" "ProfessionalStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "professional_profile_pkey" PRIMARY KEY ("id")
);

-- Una sola participacion profesional por persona dentro del tenant.
CREATE UNIQUE INDEX "professional_profile_person_tenant_unique"
  ON "professional_profile" ("personId", "tenantId");

-- Permite FKs compuestas que impiden asociaciones entre tenants distintos.
CREATE UNIQUE INDEX "professional_profile_id_tenant_unique"
  ON "professional_profile" ("id", "tenantId");

CREATE INDEX "professional_profile_tenantId_status_idx"
  ON "professional_profile" ("tenantId", "status");

ALTER TABLE "professional_profile"
  ADD CONSTRAINT "professional_profile_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Clave foranea COMPUESTA: un perfil nunca puede apuntar a una persona de otra
-- institucion, aunque se conozca su identificador.
ALTER TABLE "professional_profile"
  ADD CONSTRAINT "professional_profile_person_fkey"
  FOREIGN KEY ("personId", "tenantId")
  REFERENCES "person" ("id", "tenantId")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- El codigo de profesion procede de un catalogo controlado por el SERVIDOR: se
-- acota su forma para que el navegador no pueda escribir texto libre aqui.
ALTER TABLE "professional_profile"
  ADD CONSTRAINT "professional_profile_profession_code_shape"
  CHECK ("professionCode" ~ '^[A-Z][A-Z0-9_]{2,63}$');

-- ---------------------------------------------------------------------------
-- 5. Vinculo operativo declarado
-- ---------------------------------------------------------------------------

CREATE TABLE "professional_affiliation" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "professionalId" UUID NOT NULL,
  "engagementType" "ProfessionalEngagementType" NOT NULL,
  "status" "ProfessionalAffiliationStatus" NOT NULL DEFAULT 'ACTIVE',
  "startsOn" DATE NOT NULL,
  "endsOn" DATE,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "professional_affiliation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "professional_affiliation_id_tenant_unique"
  ON "professional_affiliation" ("id", "tenantId");

CREATE INDEX "professional_affiliation_tenant_professional_status_idx"
  ON "professional_affiliation" ("tenantId", "professionalId", "status");

ALTER TABLE "professional_affiliation"
  ADD CONSTRAINT "professional_affiliation_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "professional_affiliation"
  ADD CONSTRAINT "professional_affiliation_professional_fkey"
  FOREIGN KEY ("professionalId", "tenantId")
  REFERENCES "professional_profile" ("id", "tenantId")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Un vinculo no puede terminar antes de empezar.
ALTER TABLE "professional_affiliation"
  ADD CONSTRAINT "professional_affiliation_period_order"
  CHECK ("endsOn" IS NULL OR "endsOn" >= "startsOn");

-- Un vinculo TERMINADO declara su fecha de fin; uno vigente no la tiene.
ALTER TABLE "professional_affiliation"
  ADD CONSTRAINT "professional_affiliation_end_date_scope"
  CHECK (
    ("status" = 'ENDED' AND "endsOn" IS NOT NULL)
    OR ("status" <> 'ENDED' AND "endsOn" IS NULL)
  );

-- ---------------------------------------------------------------------------
-- 6. Asignacion de cuidado
-- ---------------------------------------------------------------------------
--
-- NO es una autorizacion clinica: no concede acceso a historia clinica, no
-- acredita necesidad individual de conocer y no habilita ninguna decision
-- asistencial.

CREATE TABLE "care_assignment" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "patientId" UUID NOT NULL,
  "professionalId" UUID NOT NULL,
  "role" "CareAssignmentRole" NOT NULL DEFAULT 'PRIMARY',
  "status" "CareAssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
  "startsAt" TIMESTAMPTZ(6) NOT NULL,
  "endsAt" TIMESTAMPTZ(6),
  "createdByIdentityId" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "care_assignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "care_assignment_id_tenant_unique"
  ON "care_assignment" ("id", "tenantId");

CREATE INDEX "care_assignment_tenant_patient_status_idx"
  ON "care_assignment" ("tenantId", "patientId", "status");

CREATE INDEX "care_assignment_tenant_professional_status_idx"
  ON "care_assignment" ("tenantId", "professionalId", "status");

-- UNA SOLA asignacion primaria ACTIVA por paciente dentro del tenant. El indice
-- es PARCIAL a proposito: la historia de asignaciones terminadas se conserva y
-- no compite por la unicidad. Reasignar exige terminar la anterior, y eso es
-- una Task posterior.
CREATE UNIQUE INDEX "care_assignment_primary_active_unique"
  ON "care_assignment" ("tenantId", "patientId")
  WHERE "role" = 'PRIMARY' AND "status" = 'ACTIVE';

ALTER TABLE "care_assignment"
  ADD CONSTRAINT "care_assignment_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "care_assignment"
  ADD CONSTRAINT "care_assignment_patient_fkey"
  FOREIGN KEY ("patientId", "tenantId")
  REFERENCES "patient" ("id", "tenantId")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "care_assignment"
  ADD CONSTRAINT "care_assignment_professional_fkey"
  FOREIGN KEY ("professionalId", "tenantId")
  REFERENCES "professional_profile" ("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- El actor es la identidad institucional OPACA, nunca la profesional elegida.
ALTER TABLE "care_assignment"
  ADD CONSTRAINT "care_assignment_created_by_identity_fkey"
  FOREIGN KEY ("createdByIdentityId", "tenantId")
  REFERENCES "institutional_identity" ("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Una asignacion ACTIVA no tiene fin; una TERMINADA lo declara y no precede a
-- su inicio.
ALTER TABLE "care_assignment"
  ADD CONSTRAINT "care_assignment_period_scope"
  CHECK (
    ("status" = 'ACTIVE' AND "endsAt" IS NULL)
    OR ("status" = 'ENDED' AND "endsAt" IS NOT NULL AND "endsAt" >= "startsAt")
  );

-- ---------------------------------------------------------------------------
-- 7. Cita de agenda
-- ---------------------------------------------------------------------------

CREATE TABLE "appointment" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "patientId" UUID NOT NULL,
  "careAssignmentId" UUID,
  "modality" "AppointmentModality" NOT NULL,
  "status" "AppointmentStatus" NOT NULL DEFAULT 'REQUESTED',
  "requestedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "scheduledStart" TIMESTAMPTZ(6),
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "appointment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "appointment_id_tenant_unique"
  ON "appointment" ("id", "tenantId");

CREATE INDEX "appointment_tenant_status_requested_idx"
  ON "appointment" ("tenantId", "status", "requestedAt");

CREATE INDEX "appointment_tenant_scheduled_start_idx"
  ON "appointment" ("tenantId", "scheduledStart");

ALTER TABLE "appointment"
  ADD CONSTRAINT "appointment_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "appointment"
  ADD CONSTRAINT "appointment_patient_fkey"
  FOREIGN KEY ("patientId", "tenantId")
  REFERENCES "patient" ("id", "tenantId")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- `NO ACTION` y no `RESTRICT`: la comprobacion se aplaza al final de la
-- sentencia, de modo que un borrado administrativo de paciente —que arrastra en
-- cascada la cita y su asignacion en la MISMA sentencia— no falle por el orden
-- en que PostgreSQL retire las filas.
ALTER TABLE "appointment"
  ADD CONSTRAINT "appointment_care_assignment_fkey"
  FOREIGN KEY ("careAssignmentId", "tenantId")
  REFERENCES "care_assignment" ("id", "tenantId")
  ON DELETE NO ACTION ON UPDATE CASCADE;

-- Coherencia de estado exigida por TASK-HOSPITAL-CORE-02 §5.4:
-- una solicitud no tiene asignacion ni fecha; una cita asignada exige ambas.
-- `CANCELLED` no se produce en este slice y queda sin restringir.
ALTER TABLE "appointment"
  ADD CONSTRAINT "appointment_status_shape"
  CHECK (
    ("status" = 'REQUESTED' AND "careAssignmentId" IS NULL AND "scheduledStart" IS NULL)
    OR ("status" = 'ASSIGNED' AND "careAssignmentId" IS NOT NULL AND "scheduledStart" IS NOT NULL)
    OR "status" = 'CANCELLED'
  );

-- La version del control optimista empieza en 1 y solo crece.
ALTER TABLE "appointment"
  ADD CONSTRAINT "appointment_version_positive"
  CHECK ("version" >= 1);

-- ---------------------------------------------------------------------------
-- 8. Minimo privilegio y Row Level Security
-- ---------------------------------------------------------------------------
--
-- La superficie de este slice LEE profesionales, afiliaciones, asignaciones y
-- citas, CREA asignaciones y ACTUALIZA citas. No crea perfiles, no crea
-- afiliaciones, no crea citas y no borra nada:
--
--   * `professional_profile` y `professional_affiliation`: SELECT unicamente.
--     El alta de profesionales se difiere a otra Task y NO se habilita aqui una
--     puerta administrativa oculta.
--   * `care_assignment`: SELECT e INSERT. Terminar o reasignar exige otra Task,
--     de modo que el rol runtime no recibe UPDATE.
--   * `appointment`: SELECT y UPDATE. La CREACION de citas no esta autorizada
--     en este slice, de modo que el rol runtime no recibe INSERT.
--
-- En ninguna tabla se concede DELETE: la historia no se borra.

GRANT SELECT          ON TABLE "professional_profile"     TO "merdn_runtime";
GRANT SELECT          ON TABLE "professional_affiliation" TO "merdn_runtime";
GRANT SELECT, INSERT  ON TABLE "care_assignment"          TO "merdn_runtime";
GRANT SELECT, UPDATE  ON TABLE "appointment"              TO "merdn_runtime";

ALTER TABLE "professional_profile"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "professional_affiliation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "care_assignment"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "appointment"              ENABLE ROW LEVEL SECURITY;

-- Estrictamente del tenant activo, tanto al leer como al escribir. `WITH CHECK`
-- impide insertar o mover una fila a otro tenant aunque la aplicacion fallara.
CREATE POLICY "professional_profile_tenant" ON "professional_profile"
  FOR ALL TO "merdn_runtime"
  USING ("tenantId" = "merdn_current_tenant"())
  WITH CHECK ("tenantId" = "merdn_current_tenant"());

CREATE POLICY "professional_affiliation_tenant" ON "professional_affiliation"
  FOR ALL TO "merdn_runtime"
  USING ("tenantId" = "merdn_current_tenant"())
  WITH CHECK ("tenantId" = "merdn_current_tenant"());

CREATE POLICY "care_assignment_tenant" ON "care_assignment"
  FOR ALL TO "merdn_runtime"
  USING ("tenantId" = "merdn_current_tenant"())
  WITH CHECK ("tenantId" = "merdn_current_tenant"());

CREATE POLICY "appointment_tenant" ON "appointment"
  FOR ALL TO "merdn_runtime"
  USING ("tenantId" = "merdn_current_tenant"())
  WITH CHECK ("tenantId" = "merdn_current_tenant"());
