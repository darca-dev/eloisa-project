-- ---------------------------------------------------------------------------
-- TASK-HOSPITAL-CORE-01 — migracion ADITIVA unica.
--
-- Contenido:
--   1. Valor nuevo en "InstitutionalRole": el rol minimo de consulta
--      hospitalaria de Pacientes.
--   2. Cuatro valores nuevos en "AuditEventType": acceso hospitalario
--      concedido (listado, detalle y analitica) y denegado.
--   3. Relajacion de UN check de coherencia de `audit_event` para que los
--      eventos de ACCESO hospitalario —que no crean ni modifican un recurso—
--      puedan omitir `resourceId`, exactamente igual que ya ocurria con los
--      eventos de acceso municipal.
--
-- Caracter: ADITIVO. No crea tablas, no crea columnas, no borra filas, no
-- elimina tipos, no reescribe ninguna migracion anterior y no toca volumenes.
--
-- NO se crea `Hospital` ni ninguna entidad personal nueva: `Tenant` representa
-- el limite institucional en este MVP y `Person`/`Patient` siguen siendo las
-- unicas entidades de persona y de paciente (TASK-HOSPITAL-CORE-01 §7.1).
--
-- NO se crea ningun indice nuevo: la paginacion server-side se apoya en los
-- indices ya existentes `person_tenantId_idx`, `patient_tenantId_idx`,
-- `patient_id_tenant_unique` y `patient_address_municipalityUnitId_idx`. El
-- coste medido sobre el conjunto sintetico se reporta en el handoff; ampliar
-- la indexacion exige una Task propia con justificacion y rollback.
--
-- NO contiene ningun secreto: la credencial de la identidad institucional
-- hospitalaria se aprovisiona en ejecucion desde la configuracion del servidor
-- y solo se almacena su derivacion `scrypt`.
--
-- Rollback documentado: `prisma/migrations/ROLLBACK-hospital_core_01.sql`.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1. Rol institucional hospitalario
-- ---------------------------------------------------------------------------

-- Aditivo: las identidades y sesiones municipales ya emitidas conservan su rol
-- `MUNICIPAL_VIEWER` sin cambio alguno. Anadir un valor a un enum no reescribe
-- ninguna fila.
ALTER TYPE "InstitutionalRole" ADD VALUE IF NOT EXISTS 'HOSPITAL_PATIENT_VIEWER';

-- ---------------------------------------------------------------------------
-- 2. Eventos de auditoria del acceso hospitalario
-- ---------------------------------------------------------------------------

ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'HOSPITAL_PATIENT_LIST_ACCESS_GRANTED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'HOSPITAL_PATIENT_DETAIL_ACCESS_GRANTED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'HOSPITAL_PATIENT_ANALYTICS_ACCESS_GRANTED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'HOSPITAL_PATIENT_ACCESS_DENIED';

-- ---------------------------------------------------------------------------
-- 3. Coherencia de `audit_event` para los eventos de ACCESO
-- ---------------------------------------------------------------------------
--
-- TASK-MUNICIPALITY-CORE-01 declaro el check con una lista POSITIVA de los dos
-- eventos de acceso municipal que pueden omitir el recurso. Esa forma obliga a
-- reescribir el check cada vez que se autoriza una superficie de lectura nueva.
--
-- Aqui se invierte la regla y se expresa el invariante real: solo los eventos
-- que CREAN o MODIFICAN un recurso identificable estan obligados a nombrarlo.
-- Un evento de ACCESO —municipal o hospitalario— no crea recurso y por eso
-- puede omitirlo.
--
-- La lista nombra exclusivamente valores del enum que YA existian antes de esta
-- migracion: PostgreSQL prohibe usar en la misma transaccion un valor de enum
-- anadido en esa misma transaccion, y esta redaccion evita esa restriccion sin
-- depender del comportamiento transaccional del motor.
--
-- Es una RELAJACION, no una perdida: ninguna fila existente cambia de valor y
-- ninguna fila valida deja de serlo.
ALTER TABLE "audit_event" DROP CONSTRAINT IF EXISTS "audit_event_resource_required";

ALTER TABLE "audit_event"
  ADD CONSTRAINT "audit_event_resource_required"
  CHECK (
    "resourceId" IS NOT NULL
    OR "eventType" NOT IN (
      'PATIENT_ENROLLMENT_CREATED',
      'INSTITUTIONAL_SESSION_CREATED',
      'INSTITUTIONAL_SESSION_REVOKED'
    )
  );

-- ---------------------------------------------------------------------------
-- 4. Privilegios y Row Level Security
-- ---------------------------------------------------------------------------
--
-- No se conceden privilegios nuevos y no se crea ninguna politica nueva: la
-- superficie hospitalaria LEE exactamente las tablas que el rol `merdn_runtime`
-- ya podia leer —`person`, `patient`, `patient_population_membership`,
-- `patient_address`, `territorial_unit`, `tenant`— bajo las politicas de tenant
-- ya vigentes, y ESCRIBE unicamente en `audit_event`, donde ya tenia INSERT.
--
-- En particular NO se abre ninguna tabla a acceso sin tenant, no se concede
-- DELETE en ninguna parte y `audit_event` conserva su caracter append-only.
