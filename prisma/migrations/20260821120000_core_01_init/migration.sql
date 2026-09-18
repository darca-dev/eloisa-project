-- ---------------------------------------------------------------------------
-- TASK-MVP-CORE-01 — migracion 1 de 2: esquema de la cadena
-- «Inscripcion -> Paciente persistente».
--
-- Caracter de la migracion: ADITIVA. Crea enums, tablas, indices y
-- restricciones nuevos. No modifica ni elimina objetos existentes, no borra
-- datos y no altera volumenes. Antes de esta migracion el esquema `public` no
-- contenia ninguna tabla de negocio.
--
-- Rollback documentado: `prisma/migrations/ROLLBACK-core_01.sql`.
-- ---------------------------------------------------------------------------

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('CEDULA_CIUDADANIA', 'CEDULA_EXTRANJERIA', 'PASAPORTE', 'PERMISO_PROTECCION_TEMPORAL', 'OTRO');

-- CreateEnum
CREATE TYPE "SexGenderCode" AS ENUM ('FEMENINO', 'MASCULINO', 'OTRO', 'PREFIERE_NO_DECIRLO');

-- CreateEnum
CREATE TYPE "PatientStatus" AS ENUM ('ACTIVE');

-- CreateEnum
CREATE TYPE "PatientOrigin" AS ENUM ('PUBLIC_SELF_ENROLLMENT');

-- CreateEnum
CREATE TYPE "PopulationType" AS ENUM ('OLDER_ADULT_60_PLUS', 'DISABILITY', 'HOME_CARE_REQUIRED');

-- CreateEnum
CREATE TYPE "PopulationSource" AS ENUM ('DECLARED', 'DERIVED_BIRTH_DATE');

-- CreateEnum
CREATE TYPE "TerritorialUnitType" AS ENUM ('DEPARTMENT', 'MUNICIPALITY', 'NEIGHBORHOOD', 'RURAL_SETTLEMENT');

-- CreateEnum
CREATE TYPE "TerritorialUnitStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "AreaType" AS ENUM ('URBAN', 'RURAL');

-- CreateEnum
CREATE TYPE "ConsentType" AS ENUM ('PERSONAL_AND_HEALTH_DATA_PROCESSING');

-- CreateEnum
CREATE TYPE "AuditEventType" AS ENUM ('PATIENT_ENROLLMENT_CREATED');

-- CreateEnum
CREATE TYPE "AuditActorType" AS ENUM ('PUBLIC_SELF_ENROLLMENT');

-- CreateEnum
CREATE TYPE "AuditOutcome" AS ENUM ('SUCCESS');

-- CreateTable
CREATE TABLE "tenant" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "person" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "documentType" "DocumentType" NOT NULL,
    "documentNumber" TEXT NOT NULL,
    "documentNumberNormalized" TEXT NOT NULL,
    "givenNames" TEXT NOT NULL,
    "familyNames" TEXT NOT NULL,
    "birthDate" DATE NOT NULL,
    "sexGenderCode" "SexGenderCode" NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "personId" UUID NOT NULL,
    "epsCode" TEXT NOT NULL,
    "epsNameControlled" TEXT NOT NULL,
    "status" "PatientStatus" NOT NULL DEFAULT 'ACTIVE',
    "origin" "PatientOrigin" NOT NULL,
    "enrolledAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "patient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_population_membership" (
    "patientId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "populationType" "PopulationType" NOT NULL,
    "source" "PopulationSource" NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patient_population_membership_pkey" PRIMARY KEY ("patientId","populationType")
);

-- CreateTable
CREATE TABLE "territorial_unit" (
    "id" UUID NOT NULL,
    "tenantId" UUID,
    "parentId" UUID,
    "type" "TerritorialUnitType" NOT NULL,
    "officialCode" TEXT,
    "normalizedName" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "status" "TerritorialUnitStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "territorial_unit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_address" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "departmentUnitId" UUID NOT NULL,
    "municipalityUnitId" UUID NOT NULL,
    "localUnitId" UUID,
    "areaType" "AreaType",
    "localityPendingNormalization" BOOLEAN NOT NULL DEFAULT false,
    "localityUnverifiedText" TEXT,
    "settlementUnverifiedText" TEXT,
    "exactAddress" TEXT NOT NULL,
    "directions" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "patient_address_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consent_record" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "consentVersion" TEXT NOT NULL,
    "consentType" "ConsentType" NOT NULL,
    "purpose" TEXT NOT NULL,
    "acceptedAt" TIMESTAMPTZ(6) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consent_record_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enrollment_session" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMPTZ(6),
    "revokedAt" TIMESTAMPTZ(6),

    CONSTRAINT "enrollment_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_event" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "eventType" "AuditEventType" NOT NULL,
    "actorType" "AuditActorType" NOT NULL,
    "actorUserId" UUID,
    "resourceType" TEXT NOT NULL,
    "resourceId" UUID NOT NULL,
    "outcome" "AuditOutcome" NOT NULL,
    "occurredAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenant_code_key" ON "tenant"("code");

-- CreateIndex
CREATE INDEX "person_tenantId_idx" ON "person"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "person_tenant_document_unique" ON "person"("tenantId", "documentType", "documentNumberNormalized");

-- CreateIndex
CREATE UNIQUE INDEX "person_id_tenant_unique" ON "person"("id", "tenantId");

-- CreateIndex
CREATE INDEX "patient_tenantId_idx" ON "patient"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "patient_person_tenant_unique" ON "patient"("personId", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "patient_id_tenant_unique" ON "patient"("id", "tenantId");

-- CreateIndex
CREATE INDEX "patient_population_membership_tenantId_populationType_idx" ON "patient_population_membership"("tenantId", "populationType");

-- CreateIndex
CREATE INDEX "territorial_unit_parentId_idx" ON "territorial_unit"("parentId");

-- CreateIndex
CREATE INDEX "territorial_unit_tenantId_idx" ON "territorial_unit"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "territorial_unit_type_official_code_unique" ON "territorial_unit"("type", "officialCode");

-- CreateIndex
CREATE UNIQUE INDEX "territorial_unit_scope_name_unique" ON "territorial_unit"("tenantId", "parentId", "type", "normalizedName");

-- CreateIndex
CREATE INDEX "patient_address_tenantId_idx" ON "patient_address"("tenantId");

-- CreateIndex
CREATE INDEX "patient_address_municipalityUnitId_idx" ON "patient_address"("municipalityUnitId");

-- CreateIndex
CREATE UNIQUE INDEX "patient_address_patient_unique" ON "patient_address"("patientId", "tenantId");

-- CreateIndex
CREATE INDEX "consent_record_tenantId_patientId_idx" ON "consent_record"("tenantId", "patientId");

-- CreateIndex
CREATE UNIQUE INDEX "enrollment_session_tokenHash_key" ON "enrollment_session"("tokenHash");

-- CreateIndex
CREATE INDEX "enrollment_session_tenantId_patientId_idx" ON "enrollment_session"("tenantId", "patientId");

-- CreateIndex
CREATE INDEX "enrollment_session_expiresAt_idx" ON "enrollment_session"("expiresAt");

-- CreateIndex
CREATE INDEX "audit_event_tenantId_occurredAt_idx" ON "audit_event"("tenantId", "occurredAt");

-- CreateIndex
CREATE INDEX "audit_event_resourceType_resourceId_idx" ON "audit_event"("resourceType", "resourceId");

-- AddForeignKey
ALTER TABLE "person" ADD CONSTRAINT "person_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient" ADD CONSTRAINT "patient_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient" ADD CONSTRAINT "patient_personId_tenantId_fkey" FOREIGN KEY ("personId", "tenantId") REFERENCES "person"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_population_membership" ADD CONSTRAINT "patient_population_membership_patientId_tenantId_fkey" FOREIGN KEY ("patientId", "tenantId") REFERENCES "patient"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "territorial_unit" ADD CONSTRAINT "territorial_unit_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "territorial_unit" ADD CONSTRAINT "territorial_unit_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "territorial_unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_address" ADD CONSTRAINT "patient_address_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_address" ADD CONSTRAINT "patient_address_patientId_tenantId_fkey" FOREIGN KEY ("patientId", "tenantId") REFERENCES "patient"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_address" ADD CONSTRAINT "patient_address_departmentUnitId_fkey" FOREIGN KEY ("departmentUnitId") REFERENCES "territorial_unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_address" ADD CONSTRAINT "patient_address_municipalityUnitId_fkey" FOREIGN KEY ("municipalityUnitId") REFERENCES "territorial_unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_address" ADD CONSTRAINT "patient_address_localUnitId_fkey" FOREIGN KEY ("localUnitId") REFERENCES "territorial_unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_record" ADD CONSTRAINT "consent_record_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_record" ADD CONSTRAINT "consent_record_patientId_tenantId_fkey" FOREIGN KEY ("patientId", "tenantId") REFERENCES "patient"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollment_session" ADD CONSTRAINT "enrollment_session_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollment_session" ADD CONSTRAINT "enrollment_session_patientId_tenantId_fkey" FOREIGN KEY ("patientId", "tenantId") REFERENCES "patient"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_event" ADD CONSTRAINT "audit_event_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Restricciones adicionales de integridad (TASK-MVP-CORE-01 SS4, SS7, SS9)
--
-- Prisma no expresa estas reglas en el esquema, pero la Task exige que la base
-- de datos —y no solo la aplicacion— impida estados incoherentes.
-- ---------------------------------------------------------------------------

-- Departamento y municipio son unidades nacionales compartidas: exigen codigo
-- oficial verificable y NO pertenecen a un tenant.
ALTER TABLE "territorial_unit"
  ADD CONSTRAINT "territorial_unit_national_shape_check"
  CHECK (
    "type" NOT IN ('DEPARTMENT', 'MUNICIPALITY')
    OR ("officialCode" IS NOT NULL AND "tenantId" IS NULL)
  );

-- Barrio y vereda son unidades locales administradas por un tenant: exigen
-- tenant y municipio padre, y no llevan codigo oficial DIVIPOLA, porque
-- DIVIPOLA no publica una codificacion de barrios y veredas.
ALTER TABLE "territorial_unit"
  ADD CONSTRAINT "territorial_unit_local_shape_check"
  CHECK (
    "type" NOT IN ('NEIGHBORHOOD', 'RURAL_SETTLEMENT')
    OR ("tenantId" IS NOT NULL AND "parentId" IS NOT NULL AND "officialCode" IS NULL)
  );

-- Un departamento no tiene padre; un municipio siempre lo tiene.
ALTER TABLE "territorial_unit"
  ADD CONSTRAINT "territorial_unit_hierarchy_check"
  CHECK (
    ("type" = 'DEPARTMENT' AND "parentId" IS NULL)
    OR ("type" <> 'DEPARTMENT' AND "parentId" IS NOT NULL)
  );

-- Unicidad de nombre entre unidades nacionales. El indice unico compuesto no
-- basta porque PostgreSQL considera distintos los valores NULL de `tenantId`.
CREATE UNIQUE INDEX "territorial_unit_national_name_unique"
  ON "territorial_unit" ("type", "normalizedName", COALESCE("parentId", '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE "tenantId" IS NULL;

-- Coherencia de la localidad: o hay unidad canonica, o la localidad queda
-- pendiente de normalizacion con su texto declarado conservado aparte. El texto
-- libre nunca sustituye a una unidad canonica.
ALTER TABLE "patient_address"
  ADD CONSTRAINT "patient_address_locality_check"
  CHECK (
    (
      "localUnitId" IS NOT NULL
      AND "localityPendingNormalization" = false
      AND "localityUnverifiedText" IS NULL
    )
    OR (
      "localUnitId" IS NULL
      AND "localityPendingNormalization" = true
      AND "localityUnverifiedText" IS NOT NULL
    )
  );

-- La direccion exacta nunca puede quedar vacia: es el dato que permite llegar
-- a la persona y su ausencia haria inutil el registro territorial.
ALTER TABLE "patient_address"
  ADD CONSTRAINT "patient_address_exact_address_not_blank_check"
  CHECK (length(btrim("exactAddress")) > 0);

-- El hash de sesion tiene longitud fija: SHA-256 en hexadecimal. La restriccion
-- impide almacenar por error un token en claro, que tendria otra longitud.
ALTER TABLE "enrollment_session"
  ADD CONSTRAINT "enrollment_session_token_hash_shape_check"
  CHECK ("tokenHash" ~ '^[0-9a-f]{64}$');

-- La sesion siempre caduca despues de haberse creado.
ALTER TABLE "enrollment_session"
  ADD CONSTRAINT "enrollment_session_expiry_check"
  CHECK ("expiresAt" > "createdAt");
