-- ---------------------------------------------------------------------------
-- ROLLBACK documentado de TASK-HOSPITAL-CORE-02.
--
-- NO se ejecuta automaticamente y NO forma parte de la carpeta de migraciones
-- aplicadas: es documentacion ejecutable que exige autorizacion expresa del
-- Product Owner y respaldo previo verificado en cualquier entorno con datos.
--
-- Alcance de la reversion:
--   - retira las CUATRO tablas nuevas y sus siete enums propios;
--   - NO retira los valores anadidos a "InstitutionalRole" ni a
--     "AuditEventType": PostgreSQL no admite eliminar un valor de un enum.
--
-- NO toca ningun dato de CORE-01, MUNICIPALITY-CORE-01 ni HOSPITAL-CORE-01:
-- personas, pacientes, pertenencias, direcciones, consentimientos, catalogo
-- territorial, identidades y sesiones institucionales permanecen intactos.
--
-- ADVERTENCIA MATERIAL: retirar `care_assignment` y `appointment` DESTRUYE
-- registros operativos y su historia. Esta reversion solo es segura sobre un
-- despliegue donde esas tablas esten vacias, o con una decision expresa y un
-- respaldo verificado sobre su contenido.
-- ---------------------------------------------------------------------------

BEGIN;

-- ---------------------------------------------------------------------------
-- ADVERTENCIA OBLIGATORIA
-- ---------------------------------------------------------------------------
--
-- Si ya existen filas en las tablas nuevas, o eventos de auditoria que las
-- describen, la reversion NO puede completarse de forma limpia:
--
--   * `audit_event` es append-only y su trigger rechaza DELETE incluso al
--     propietario, de modo que un evento `CARE_ASSIGNMENT_CREATED` o
--     `APPOINTMENT_ASSIGNED` ya registrado NO puede retirarse y quedaria
--     apuntando a un recurso que dejo de existir;
--   * una identidad o una sesion con rol `HOSPITAL_SCHEDULER` seguiria
--     existiendo con un rol que la aplicacion ya no reconoce.
--
-- Esta comprobacion debe ejecutarse ANTES y su resultado debe ser cero en las
-- cuatro cifras. Si no lo es, DETENGASE: la decision sobre esos registros
-- corresponde a una persona, no a este archivo, y no se inventa aqui ningun
-- valor sustituto.
DO $$
DECLARE
  perfiles bigint;
  asignaciones bigint;
  citas bigint;
  eventos bigint;
BEGIN
  SELECT count(*) INTO perfiles     FROM "professional_profile";
  SELECT count(*) INTO asignaciones FROM "care_assignment";
  SELECT count(*) INTO citas        FROM "appointment";
  SELECT count(*) INTO eventos      FROM "audit_event"
    WHERE "eventType"::text IN (
      'HOSPITAL_PROFESSIONAL_LIST_ACCESS_GRANTED',
      'HOSPITAL_PROFESSIONAL_DETAIL_ACCESS_GRANTED',
      'HOSPITAL_AGENDA_ACCESS_GRANTED',
      'CARE_ASSIGNMENT_CREATED',
      'APPOINTMENT_ASSIGNED',
      'HOSPITAL_OPERATIONS_ACCESS_DENIED'
    );

  IF perfiles > 0 OR asignaciones > 0 OR citas > 0 OR eventos > 0 THEN
    RAISE EXCEPTION
      'Reversion detenida: existen % perfiles, % asignaciones, % citas y % eventos de auditoria de HOSPITAL-CORE-02. Se requiere decision expresa y respaldo verificado.',
      perfiles, asignaciones, citas, eventos;
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- 1. Politicas y tablas
-- ---------------------------------------------------------------------------
--
-- Las politicas y los privilegios desaparecen con la tabla; se retiran de forma
-- explicita para dejar la reversion legible.

DROP POLICY IF EXISTS "appointment_tenant"              ON "appointment";
DROP POLICY IF EXISTS "care_assignment_tenant"          ON "care_assignment";
DROP POLICY IF EXISTS "professional_affiliation_tenant" ON "professional_affiliation";
DROP POLICY IF EXISTS "professional_profile_tenant"     ON "professional_profile";

-- El orden respeta las dependencias: la cita referencia la asignacion, la
-- asignacion referencia el perfil y la afiliacion cuelga del perfil.
DROP TABLE IF EXISTS "appointment";
DROP TABLE IF EXISTS "care_assignment";
DROP TABLE IF EXISTS "professional_affiliation";
DROP TABLE IF EXISTS "professional_profile";

-- ---------------------------------------------------------------------------
-- 2. Enums propios de esta migracion
-- ---------------------------------------------------------------------------

DROP TYPE IF EXISTS "AppointmentStatus";
DROP TYPE IF EXISTS "AppointmentModality";
DROP TYPE IF EXISTS "CareAssignmentStatus";
DROP TYPE IF EXISTS "CareAssignmentRole";
DROP TYPE IF EXISTS "ProfessionalAffiliationStatus";
DROP TYPE IF EXISTS "ProfessionalEngagementType";
DROP TYPE IF EXISTS "ProfessionalStatus";

-- ---------------------------------------------------------------------------
-- 3. Lo que esta reversion NO deshace
-- ---------------------------------------------------------------------------
--
--   * `InstitutionalRole` conserva 'HOSPITAL_SCHEDULER';
--   * `AuditEventType` conserva los seis valores anadidos.
--
-- PostgreSQL no admite eliminar un valor de un enum sin recrear el tipo y
-- reescribir todas las columnas que lo usan. Reescribir `audit_event` esta
-- PROHIBIDO: es append-only y su historia no se reinterpreta. Un valor de enum
-- sin filas que lo usen es inerte y no concede ningun permiso: la autorizacion
-- vive en el guard del servidor, no en el catalogo de tipos.

COMMIT;
