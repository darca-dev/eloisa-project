# Decisión — baseline aislada con migraciones actuales y owner test seguro

## Fecha

2026-09-26

## Contexto

La spec 025 describía una baseline de 13 migraciones, pero el árbol actual
contiene 14 directorios con `migration.sql`. El último es
`20260919051156_add_audit_events_human_account_linked_enrollment_revoked`.
`prisma migrate deploy` aplica todas las migraciones disponibles; omitir una
haría que la baseline de pruebas no representara el esquema versionado actual.

El usuario inicial de la imagen oficial Postgres de pruebas
(`merdn_test_admin`) es superusuario. FORCE RLS no restringe superusuarios ni
roles con BYPASSRLS. La spec 025 y sus pruebas requieren que los owners de las
26 tablas protegidas no tengan esos atributos.

## Decisión

El Product Owner autorizó:

1. La baseline aislada usa las 14 migraciones actuales, en el orden versionado
   del repositorio.
2. MP07 provisiona el rol no interactivo `merdn_test_migrator`, sin SUPERUSER,
   BYPASSRLS, CREATEDB, CREATEROLE ni REPLICATION, y le transfiere la propiedad
   de las 26 tablas protegidas después de aplicar las migraciones.
3. `merdn_runtime` permanece separado, con privilegios mínimos y sin ownership.
   El administrador bootstrap solo existe dentro del cluster desechable para
   iniciar, migrar y preparar el entorno; no llega al proceso API.

## Consecuencias

- El provisionador falla cerrado si la lista de migraciones no coincide con las
  14 aprobadas, si el tenant ficticio `merdn-mvp` no existe una vez migrado, o
  si el catálogo de roles/owners no cumple el contrato.
- La evidencia posterior debe registrar conteos, nombres de migración y flags
  booleanos, sin URLs, claves, UUIDs de tenant ni datos de personas.
- La decisión no autoriza commit, merge, push, pull request, release, deploy ni
  ejecución de infraestructura fuera del paquete que Codex abra expresamente.

## Fuente

Autorización explícita del Product Owner en esta sesión: “ok azlo”, posterior a
la explicación de las 14 migraciones y del owner/migrator de pruebas no
privilegiado.
