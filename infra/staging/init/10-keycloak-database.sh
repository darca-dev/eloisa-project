#!/usr/bin/env bash
#
# Spec 023 — Bootstrap determinista de la identidad de base de datos de Keycloak.
#
# ALCANCE REAL DE ESTE SCRIPT
#
#   PostgreSQL ejecuta `/docker-entrypoint-initdb.d/*` UNICAMENTE cuando el
#   directorio de datos esta VACIO, es decir, sobre un volumen nuevo. Este script
#   NO modifica un volumen de staging ya inicializado y no debe presentarse como
#   si lo hiciera. Para un volumen existente, el runbook exige ejecutar y
#   verificar el aprovisionamiento controlado equivalente ANTES de arrancar
#   Keycloak (`docs/runbooks/STAGING_DEPLOYMENT.md`).
#
# AISLAMIENTO
#
#   Keycloak recibe su propia base y su propio rol LOGIN. Nunca reutiliza
#   `merdn_runtime` ni el rol propietario/migrador de la aplicacion, y no recibe
#   privilegio alguno sobre el esquema ni las tablas de la aplicacion.
#
# SECRETOS
#
#   La contrasena llega a `psql` por entorno mediante `\getenv`: no viaja en
#   `argv` ni se imprime nunca. Este archivo no contiene ninguna credencial.
#
set -euo pipefail

log() { printf '[merdn-staging-init] %s\n' "$1" >&2; }

fail() { log "FATAL: $1"; exit 1; }

# Identificador SQL seguro y ademas conservador: minusculas, sin comillas, <= 63.
readonly SAFE_IDENTIFIER='^[a-z_][a-z0-9_]{0,62}$'

readonly oidc_db="${MERDN_OIDC_DATABASE_NAME-}"
readonly oidc_user="${MERDN_OIDC_DATABASE_USER-}"
readonly oidc_password="${MERDN_OIDC_DATABASE_PASSWORD-}"
readonly admin_user="${POSTGRES_USER-}"
readonly admin_db="${POSTGRES_DB-}"

# --- Fail closed: sin configuracion completa no se inicializa nada ------------

[ -n "$oidc_db" ] || fail 'MERDN_OIDC_DATABASE_NAME is required'
[ -n "$oidc_user" ] || fail 'MERDN_OIDC_DATABASE_USER is required'
[ -n "$oidc_password" ] || fail 'MERDN_OIDC_DATABASE_PASSWORD is required'
[ -n "$admin_user" ] || fail 'POSTGRES_USER is required'
[ -n "$admin_db" ] || fail 'POSTGRES_DB is required'

[[ "$oidc_db" =~ $SAFE_IDENTIFIER ]] || fail 'MERDN_OIDC_DATABASE_NAME is not a safe SQL identifier'
[[ "$oidc_user" =~ $SAFE_IDENTIFIER ]] || fail 'MERDN_OIDC_DATABASE_USER is not a safe SQL identifier'

# --- Aislamiento obligatorio --------------------------------------------------

for reserved in merdn_runtime postgres "$admin_user"; do
  [ "$oidc_user" != "$reserved" ] || fail "MERDN_OIDC_DATABASE_USER must not reuse the '$reserved' role"
done

[ "$oidc_db" != "$admin_db" ] || fail 'MERDN_OIDC_DATABASE_NAME must not reuse the application database'

# --- Marcadores de plantilla: nunca se aceptan como credencial ----------------
# El valor NO se imprime en ninguna rama.

case "$oidc_password" in
  *REPLACE* | *replace* | *change-me* | *CHANGE-ME* | *example.invalid* | *fictitious-not-a-secret*)
    fail 'MERDN_OIDC_DATABASE_PASSWORD is still a template placeholder'
    ;;
esac

[ "${#oidc_password}" -ge 12 ] || fail 'MERDN_OIDC_DATABASE_PASSWORD is too short for staging'

# --- Bootstrap idempotente ----------------------------------------------------
#
# `format(%I)` para identificadores y `format(%L)` para literales; los valores
# entran por `\getenv`, nunca por `argv` ni por interpolacion de shell.

log "Bootstrapping isolated Keycloak database identity on a fresh data directory."

psql --username "$admin_user" --dbname "$admin_db" --no-psqlrc --quiet \
  --set ON_ERROR_STOP=1 <<'SQL'
\getenv oidc_db MERDN_OIDC_DATABASE_NAME
\getenv oidc_user MERDN_OIDC_DATABASE_USER
\getenv oidc_password MERDN_OIDC_DATABASE_PASSWORD

-- Rol de Keycloak: LOGIN y nada mas. Sin SUPERUSER, CREATEDB, CREATEROLE,
-- BYPASSRLS ni REPLICATION.
SELECT format(
  'CREATE ROLE %I LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOREPLICATION PASSWORD %L',
  :'oidc_user', :'oidc_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'oidc_user')
\gexec

-- Reconciliacion idempotente si el rol ya existiera en el volumen nuevo.
SELECT format(
  'ALTER ROLE %I LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOREPLICATION PASSWORD %L',
  :'oidc_user', :'oidc_password')
WHERE EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'oidc_user')
\gexec

-- Base propia, propiedad exclusiva del rol de Keycloak.
SELECT format('CREATE DATABASE %I OWNER %I', :'oidc_db', :'oidc_user')
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = :'oidc_db')
\gexec

SELECT format('ALTER DATABASE %I OWNER TO %I', :'oidc_db', :'oidc_user')
\gexec

SELECT format('REVOKE ALL ON DATABASE %I FROM PUBLIC', :'oidc_db')
\gexec

-- Keycloak no recibe ningun privilegio sobre la base de la aplicacion. Este
-- REVOKE elimina concesiones explicitas al rol; el acceso heredado de PUBLIC
-- sobre la base de la aplicacion se gobierna en el trabajo de roles/RLS de la
-- aplicacion, fuera del alcance de esta spec.
SELECT format('REVOKE ALL ON DATABASE %I FROM %I', current_database(), :'oidc_user')
\gexec
SQL

# --- Verificacion fail-closed del resultado -----------------------------------

verified="$(
  psql --username "$admin_user" --dbname "$admin_db" --no-psqlrc --quiet \
    --tuples-only --no-align --set ON_ERROR_STOP=1 <<'SQL'
\getenv oidc_db MERDN_OIDC_DATABASE_NAME
\getenv oidc_user MERDN_OIDC_DATABASE_USER

SELECT count(*)
FROM pg_roles r
JOIN pg_database d ON d.datdba = r.oid
WHERE r.rolname = :'oidc_user'
  AND d.datname = :'oidc_db'
  AND r.rolcanlogin
  AND NOT r.rolsuper
  AND NOT r.rolbypassrls
  AND NOT r.rolcreatedb
  AND NOT r.rolcreaterole;
SQL
)"

[ "$verified" = '1' ] || fail 'Keycloak database identity did not converge to the expected isolated contract'

log "Keycloak database identity verified: dedicated LOGIN role owns its own database."
