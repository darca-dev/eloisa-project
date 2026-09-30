-- ---------------------------------------------------------------------------
-- SPEC 025 / MP04 - fuerza RLS en el nucleo institucional/hospitalario.
--
-- Objetivo: aplicar `FORCE ROW LEVEL SECURITY` a exactamente 15 tablas del
-- nucleo institucional/hospitalario que YA tienen RLS habilitado y policies
-- vigentes. Con FORCE, tambien el propietario de la tabla queda sujeto a las
-- policies: el aislamiento por tenant deja de depender de que ninguna
-- conexion de la aplicacion se establezca con el rol propietario.
--
-- Caracter: PREPARATORIO. Este paquete crea el SQL; no lo aplica.
--
-- NO incluye y NO debe incluir: DML, cambios de esquema, policies, grants,
-- roles, datos, fixtures, schema Prisma, rollback ni migraciones historicas.
-- El preflight no crea ni corrige nada: si algo falta, aborta.
--
-- Requisitos que este archivo VERIFICA y no crea:
--   1. Las 15 tablas existen en el esquema public.
--   2. Las 15 tienen RLS habilitado.
--   3. Las 16 policies esperadas existen, en su tabla esperada, con el rol
--      runtime entre sus roles.
--   4. El rol runtime existe y no es superuser ni tiene BYPASSRLS, CREATEDB,
--      CREATEROLE ni REPLICATION.
--   5. El rol runtime no es propietario de ninguna de las 15 tablas.
--   6. El ejecutor es propietario de las 15 tablas o es superusuario.
--   7. No hay locks de otras sesiones ni transacciones preparadas sobre el
--      nucleo.
-- Cualquier desviacion aborta ANTES del primer ALTER TABLE.
--
-- Idempotencia: no la hay y no se busca. Prisma aplica cada migracion una vez
-- y este archivo es atomico, de modo que un fallo revierte la transaccion
-- completa y ningun FORCE queda a medias. Reejecutar el archivo a mano sobre
-- una base ya migrada es una operacion fuera de contrato.
--
-- Errores: los mensajes de preflight y postflight solo nombran relaciones,
-- policies, atributos de rol, modos de bloqueo y pid. Nunca incluyen datos de
-- aplicacion, credenciales ni URLs.
--
-- Aplicacion: la ejecuta el mismo ejecutor de migraciones, sobre una base ya
-- migrada. Si el runner ya abrio transaccion, el BEGIN explicito de aqui
-- emite un aviso inocuo y el COMMIT final cierra esa misma transaccion.
-- ---------------------------------------------------------------------------

BEGIN;

-- Con trafico en vivo no se espera indefinidamente por un lock: ante
-- contencion esta migracion falla rapido y se reintenta fuera de pico.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- ---------------------------------------------------------------------------
-- 1. Preflight fail-closed
-- ---------------------------------------------------------------------------

DO $preflight$
DECLARE
  v_tables text[] := ARRAY[
    'tenant',
    'territorial_unit',
    'person',
    'patient',
    'patient_population_membership',
    'patient_address',
    'consent_record',
    'enrollment_session',
    'audit_event',
    'institutional_identity',
    'institutional_session',
    'professional_profile',
    'professional_affiliation',
    'care_assignment',
    'appointment'
  ];
  v_policies text[] := ARRAY[
    'tenant_self',
    'territorial_unit_scope',
    'person_tenant',
    'patient_tenant',
    'patient_population_membership_tenant',
    'patient_address_tenant',
    'consent_record_tenant',
    'enrollment_session_tenant',
    'audit_event_tenant_read',
    'audit_event_tenant_append',
    'institutional_identity_tenant',
    'institutional_session_tenant',
    'professional_profile_tenant',
    'professional_affiliation_tenant',
    'care_assignment_tenant',
    'appointment_tenant'
  ];
  v_runtime oid;
  v_current oid;
  v_current_is_superuser boolean;
  v_bad text[];
BEGIN
  -- 0. Coherencia interna del propio archivo.
  IF array_length(v_tables, 1) IS DISTINCT FROM 15 THEN
    RAISE EXCEPTION 'MP04 preflight: el archivo debe declarar 15 tablas, no %',
      array_length(v_tables, 1);
  END IF;
  IF array_length(v_policies, 1) IS DISTINCT FROM 16 THEN
    RAISE EXCEPTION 'MP04 preflight: el archivo debe declarar 16 policies, no %',
      array_length(v_policies, 1);
  END IF;

  SELECT oid, rolsuper INTO v_current, v_current_is_superuser
    FROM pg_roles WHERE rolname = current_user;
  SELECT oid INTO v_runtime FROM pg_roles WHERE rolname = 'merdn_runtime';

  -- 1. El rol runtime existe y no puede saltarse la seguridad.
  IF v_runtime IS NULL THEN
    RAISE EXCEPTION 'MP04 preflight: el rol runtime merdn_runtime no existe.';
  END IF;

  SELECT array_agg(atributo ORDER BY atributo) INTO v_bad
  FROM (
    SELECT 'rolsuper' AS atributo
      FROM pg_roles WHERE rolname = 'merdn_runtime' AND rolsuper
    UNION ALL
    SELECT 'rolbypassrls' AS atributo
      FROM pg_roles WHERE rolname = 'merdn_runtime' AND rolbypassrls
    UNION ALL
    SELECT 'rolcreatedb' AS atributo
      FROM pg_roles WHERE rolname = 'merdn_runtime' AND rolcreatedb
    UNION ALL
    SELECT 'rolcreaterole' AS atributo
      FROM pg_roles WHERE rolname = 'merdn_runtime' AND rolcreaterole
    UNION ALL
    SELECT 'rolreplication' AS atributo
      FROM pg_roles WHERE rolname = 'merdn_runtime' AND rolreplication
  ) atributos_inseguros;

  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'MP04 preflight: el rol runtime merdn_runtime tiene atributos inseguros: %',
      array_to_string(v_bad, ', ');
  END IF;

  -- 2. El runtime no puede ser quien ejecute esta migracion.
  IF v_current = v_runtime THEN
    RAISE EXCEPTION 'MP04 preflight: la migracion no puede ejecutarse con el rol runtime.';
  END IF;

  -- 3. Las 15 tablas existen en public.
  SELECT array_agg(t ORDER BY t) INTO v_bad
  FROM unnest(v_tables) AS t
  WHERE to_regclass(format('public.%I', t)) IS NULL;

  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'MP04 preflight: tablas ausentes en el esquema public: %',
      array_to_string(v_bad, ', ');
  END IF;

  -- 4. Las 15 tienen RLS habilitado. Sin esta base, FORCE no protege nada.
  SELECT array_agg(c.relname ORDER BY c.relname) INTO v_bad
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = ANY (v_tables)
    AND NOT c.relrowsecurity;

  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'MP04 preflight: RLS no habilitado en: %',
      array_to_string(v_bad, ', ');
  END IF;

  -- 5. El propietario de cada tabla es alguien distinto del runtime.
  SELECT array_agg(c.relname ORDER BY c.relname) INTO v_bad
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = ANY (v_tables)
    AND c.relowner = v_runtime;

  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'MP04 preflight: el rol runtime es propietario de: %',
      array_to_string(v_bad, ', ');
  END IF;

  -- 6. Quien ejecuta puede alterar las 15: propietario de todas o superusuario.
  IF NOT v_current_is_superuser THEN
    SELECT array_agg(c.relname ORDER BY c.relname) INTO v_bad
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = ANY (v_tables)
      AND c.relowner <> v_current;

    IF v_bad IS NOT NULL THEN
      RAISE EXCEPTION 'MP04 preflight: el ejecutor no es propietario de: %',
        array_to_string(v_bad, ', ');
    END IF;
  END IF;

  -- 7. Las 16 policies esperadas existen, en su tabla, con el rol runtime.
  WITH esperado(policy, tabla) AS (
    VALUES
      ('tenant_self',                            'tenant'),
      ('territorial_unit_scope',                 'territorial_unit'),
      ('person_tenant',                          'person'),
      ('patient_tenant',                         'patient'),
      ('patient_population_membership_tenant',   'patient_population_membership'),
      ('patient_address_tenant',                 'patient_address'),
      ('consent_record_tenant',                  'consent_record'),
      ('enrollment_session_tenant',              'enrollment_session'),
      ('audit_event_tenant_read',                'audit_event'),
      ('audit_event_tenant_append',              'audit_event'),
      ('institutional_identity_tenant',          'institutional_identity'),
      ('institutional_session_tenant',           'institutional_session'),
      ('professional_profile_tenant',            'professional_profile'),
      ('professional_affiliation_tenant',        'professional_affiliation'),
      ('care_assignment_tenant',                 'care_assignment'),
      ('appointment_tenant',                     'appointment')
  )
  SELECT array_agg(
           format('%s (esperada en %s, encontrada en %s)', e.policy, e.tabla, coalesce(c.relname, 'ninguna'))
           ORDER BY e.policy
         ) INTO v_bad
  FROM esperado e
  LEFT JOIN pg_namespace n ON n.nspname = 'public'
  LEFT JOIN pg_class c
    ON c.relname = e.tabla
   AND c.relnamespace = n.oid
  LEFT JOIN pg_policy p
    ON p.polrelid = c.oid
   AND p.polname = e.policy
  LEFT JOIN pg_roles r
    ON r.oid = ANY (p.polroles)
   AND r.rolname = 'merdn_runtime'
  WHERE p.oid IS NULL OR r.oid IS NULL;

  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'MP04 preflight: policies ausentes o sin rol runtime: %',
      array_to_string(v_bad, ', ');
  END IF;

  -- 8. Sin locks de otras sesiones sobre el nucleo. pg_locks es de cluster, asi
  --    que se filtra por la base actual. Un pid nulo, que es lo que reportan las
  --    transacciones preparadas, tambien se considera incompatible.
  SELECT array_agg(
           format('%s pid=%s modo=%s', c.relname, coalesce(l.pid::text, 'preparada'), l.mode)
           ORDER BY c.relname, l.mode
         ) INTO v_bad
  FROM pg_locks l
  JOIN pg_class c ON c.oid = l.relation
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE l.database = (SELECT oid FROM pg_database WHERE datname = current_database())
    AND n.nspname = 'public'
    AND c.relname = ANY (v_tables)
    AND l.pid IS DISTINCT FROM pg_backend_pid();

  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'MP04 preflight: hay locks de otras sesiones sobre el nucleo: %',
      array_to_string(v_bad, '; ');
  END IF;

  -- 9. Sin transacciones preparadas en esta base: retienen locks de forma
  --    indefinida y volverian a bloquear la migracion. Chequeo amplio a
  --    proposito: MERDN no usa transacciones preparadas.
  SELECT array_agg(format('%s (propietario %s)', g.gid, g.owner) ORDER BY g.gid) INTO v_bad
  FROM pg_prepared_xacts g
  WHERE g.database = (SELECT oid FROM pg_database WHERE datname = current_database());

  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'MP04 preflight: hay transacciones preparadas que retienen locks: %',
      array_to_string(v_bad, ', ');
  END IF;
END;
$preflight$;

-- ---------------------------------------------------------------------------
-- 2. FORCE ROW LEVEL SECURITY, una vez por tabla, solo 15
-- ---------------------------------------------------------------------------

ALTER TABLE "tenant"                        FORCE ROW LEVEL SECURITY;
ALTER TABLE "territorial_unit"              FORCE ROW LEVEL SECURITY;
ALTER TABLE "person"                        FORCE ROW LEVEL SECURITY;
ALTER TABLE "patient"                       FORCE ROW LEVEL SECURITY;
ALTER TABLE "patient_population_membership" FORCE ROW LEVEL SECURITY;
ALTER TABLE "patient_address"               FORCE ROW LEVEL SECURITY;
ALTER TABLE "consent_record"                FORCE ROW LEVEL SECURITY;
ALTER TABLE "enrollment_session"            FORCE ROW LEVEL SECURITY;
ALTER TABLE "audit_event"                   FORCE ROW LEVEL SECURITY;
ALTER TABLE "institutional_identity"        FORCE ROW LEVEL SECURITY;
ALTER TABLE "institutional_session"         FORCE ROW LEVEL SECURITY;
ALTER TABLE "professional_profile"          FORCE ROW LEVEL SECURITY;
ALTER TABLE "professional_affiliation"      FORCE ROW LEVEL SECURITY;
ALTER TABLE "care_assignment"               FORCE ROW LEVEL SECURITY;
ALTER TABLE "appointment"                   FORCE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 3. Postflight verificable
--
-- Falla si alguna de las 15 tablas perdio RLS o no quedo con FORCE activo, y
-- deja un NOTICE con la lista efectiva para que la evidencia quede en el log de
-- la migracion. Solo contiene nombres de relacion.
-- ---------------------------------------------------------------------------

DO $postflight$
DECLARE
  v_tables text[] := ARRAY[
    'tenant',
    'territorial_unit',
    'person',
    'patient',
    'patient_population_membership',
    'patient_address',
    'consent_record',
    'enrollment_session',
    'audit_event',
    'institutional_identity',
    'institutional_session',
    'professional_profile',
    'professional_affiliation',
    'care_assignment',
    'appointment'
  ];
  v_bad text[];
  v_ok  text[];
BEGIN
  IF array_length(v_tables, 1) IS DISTINCT FROM 15 THEN
    RAISE EXCEPTION 'MP04 postflight: el archivo debe declarar 15 tablas, no %',
      array_length(v_tables, 1);
  END IF;

  SELECT array_agg(c.relname ORDER BY c.relname) INTO v_bad
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = ANY (v_tables)
    AND NOT (c.relrowsecurity AND c.relforcerowsecurity);

  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'MP04 postflight: RLS sin FORCE o RLS perdido en: %',
      array_to_string(v_bad, ', ');
  END IF;

  SELECT array_agg(c.relname ORDER BY c.relname) INTO v_ok
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = ANY (v_tables)
    AND c.relrowsecurity
    AND c.relforcerowsecurity;

  RAISE NOTICE 'MP04 postflight: RLS y FORCE vigentes en % de 15 tablas: %',
    coalesce(array_length(v_ok, 1), 0), coalesce(array_to_string(v_ok, ', '), 'ninguna');
END;
$postflight$;

COMMIT;
