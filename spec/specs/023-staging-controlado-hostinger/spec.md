# Especificación 023 — Staging controlado en Hostinger

## Estado de aprobación / Approval status

- Estado / Status: `Aprobado`
- Fecha de aprobación / Approval date: `2026-08-27`
- Aprobado por / Approved by: `Product Owner`
- Evidencia de aprobación / Approval evidence: autorización explícita del Product Owner en sesión
  del 2026-08-27: «APRUEBO Y DOY CONSENTIMIENTO PARA SPEC 023 STAGING
  CONTROLADO HOSTINGER», sobre el alcance cerrado de esta spec.
- Consentimiento de implementación: `REGISTRADO`

> La aprobación y el consentimiento autorizan únicamente los dos paquetes
> versionables y sus allowlists. No autorizan Hostinger, DNS, certificados,
> credenciales, datos reales ni despliegue externo.

## Objetivo

Preparar, sin desplegar, los artefactos versionables mínimos para ejecutar ELOISA
en un staging aislado con datos exclusivamente ficticios sobre Hostinger KVM 4,
Docker Compose, PostgreSQL, proveedor OIDC, API, web y reverse proxy HTTPS.

Esta spec no autoriza cambios en Hostinger, DNS, firewall, certificados,
credenciales, datos, producción ni despliegues externos.

## Autoridad y dependencias

- `docs/ARCHITECTURE.md` y `docs/SECURITY.md` aprueban Hostinger KVM 4 y Docker
  Compose como dirección del MVP.
- La spec 001 dejó `TASK-DEPLOY-DEMO-01` expresamente diferida; no constituye
  autoridad de ejecución.
- Las specs 007–022 aportan migraciones, RLS, sesiones y superficies que este
  staging valida sin rediseñarlas.

## Alcance funcional

1. Compose de staging AUTONOMO (`compose.staging.yml`), separado del Compose
   local y nunca aplicado como overlay sobre `compose.yml`.
2. PostgreSQL, OIDC y web solo en la red `internal`; únicamente el reverse proxy
   publica `80/443`.
3. La red no interna `edge` da SOLO salida. La usan el reverse proxy, para
   alcanzar el directorio ACME, y la API, para el descubrimiento OIDC y el
   intercambio de token contra el emisor público HTTPS. Unirse a `edge` no
   publica ningún puerto: la API no declara `ports:` y el reverse proxy sigue
   siendo el único publicador de puertos de host.
4. TLS obligatorio en el borde y redirección HTTP→HTTPS.
5. `MERDN_TLS_CONTACT_EMAIL` es variable de staging obligatoria, sin fallback
   `off`; el preflight falla cerrado si falta o conserva el marcador.
6. Todas las imágenes se fijan por digest inmutable, incluida `MERDN_OIDC_IMAGE`.
7. Keycloak posee su propia base de datos y su propio rol `LOGIN`, definidos por
   `MERDN_OIDC_DATABASE_NAME`, `MERDN_OIDC_DATABASE_USER` y
   `MERDN_OIDC_DATABASE_PASSWORD`. Nunca reutiliza `merdn_runtime` ni el rol
   propietario/migrador, y no recibe privilegios sobre el esquema ni las tablas
   de la aplicación. Bootstrap y runtime consumen exactamente las mismas tres
   variables: no pueden divergir.
8. El bootstrap de esa identidad es determinista y versionado en
   `infra/staging/init/10-keycloak-database.sh`, montado de solo lectura en
   `/docker-entrypoint-initdb.d/`. PostgreSQL solo ejecuta ese directorio sobre
   un directorio de datos VACÍO: sobre un volumen existente, el aprovisionamiento
   controlado equivalente debe ejecutarse y verificarse antes de arrancar
   Keycloak. La spec no afirma que el script altere un volumen ya inicializado.
9. Secretos suministrados desde un archivo externo, root-only, ignorado por Git;
   ningún valor real se versiona ni se incorpora a imágenes.
10. `DATABASE_URL` exclusiva del propietario/migrador y
   `RUNTIME_DATABASE_URL` exclusiva de `merdn_runtime` con
   `MERDN_RUNTIME_ROLE=enforce`.
11. El rol runtime debe ser `LOGIN`, `NOSUPERUSER`, `NOBYPASSRLS`, no propietario
    de tablas protegidas y sin `merdn.tenant_id` persistente.
12. Preflight que falle cerrado antes de desplegar si la separación de roles,
    migraciones, secretos, TLS o salud no puede demostrarse.
13. Migraciones ejecutadas como propietario/migrador mediante
    `npx prisma migrate deploy`; nunca mediante `merdn_runtime`.
14. Salud separada de PostgreSQL, OIDC, API y web. `/health` de API solo prueba
    liveness del proceso y no sustituye la comprobación de dependencias.
15. Backup lógico con integridad verificable: `pg_restore --list` sobre el
    volcado y sidecar SHA-256. El script NO cifra; el volcado y su sidecar se
    custodian en almacenamiento de staging externo, cifrado y restringido.
    Restauración ensayada en instancia no productiva y rollback de aplicación a
    imagen/commit inmutable.
16. Ni backup ni restore pasan la contraseña administrativa por `argv`: la URL
    se descompone en variables de proceso temporales (`PGHOST`, `PGPORT`,
    `PGDATABASE`, `PGUSER`, `PGPASSWORD`) que se restauran al terminar.
17. Smoke HTTP sobre las rutas reales `/`, `/hospital` y `/municipality`. No
    existe ruta `/visitador`: la aceptación de Visitador/profesional ocurre
    dentro de la superficie `/hospital`. La aceptación manual en navegador real
    usa identidades y datos ficticios y es evidencia separada del smoke.

## Seguridad y criterios EARS

- CUANDO arranque la API de staging, EL SISTEMA DEBERÁ usar una
  `RUNTIME_DATABASE_URL` distinta de `DATABASE_URL`.
- SI falta cualquiera de las credenciales o el rol runtime conserva un tenant
  por defecto, ENTONCES el preflight DEBERÁ detener el despliegue.
- CUANDO una conexión runtime no fije tenant por transacción, las lecturas de
  tablas protegidas DEBERÁN fallar cerradas o devolver cero filas.
- SI `current_user`, `rolsuper`, `rolbypassrls` o la propiedad de tablas no
  coinciden con el contrato, ENTONCES staging NO DEBERÁ declararse listo.
- EL SISTEMA NO DEBERÁ publicar PostgreSQL, Keycloak administrativo, API ni web
  directamente a Internet. Pertenecer a `edge` concede salida, no exposición.
- SI Keycloak reutiliza `merdn_runtime` o el rol propietario/migrador como
  identidad de runtime, ENTONCES el preflight DEBERÁ detener el despliegue.
- CUANDO el volumen de PostgreSQL ya esté inicializado, EL SISTEMA NO DEBERÁ
  suponer que el script de `docker-entrypoint-initdb.d` creó la identidad de
  Keycloak; DEBERÁ exigir el aprovisionamiento controlado verificado.
- EL SISTEMA NO DEBERÁ usar `start-dev` de Keycloak en staging.
- SI `MERDN_TLS_CONTACT_EMAIL` falta, es un marcador o vale `off`, ENTONCES el
  preflight DEBERÁ detener el despliegue.
- SI cualquier imagen de staging, incluida la de OIDC, no está fijada por
  `@sha256:`, ENTONCES el preflight DEBERÁ detener el despliegue.
- EL SISTEMA NO DEBERÁ pasar la contraseña de base de datos como argumento de
  línea de comandos a `pg_dump` o `pg_restore`.
- EL SISTEMA NO DEBERÁ declarar cifrado un backup que el script no cifra.
- EL SISTEMA NO DEBERÁ usar datos reales ni backups de producción.
- EL SISTEMA NO DEBERÁ ejecutar rollback SQL destructivo automáticamente. Una
  migración incompatible exige forward-fix o restauración manual aprobada.

## Fuera de alcance

- Compra/configuración de VPS, DNS, firewall, TLS real o cuentas.
- Creación, rotación o exposición de secretos.
- Despliegue, migración o carga de datos externa.
- Datos reales, producción, CI/CD, Kubernetes o nube adicional.
- Cambios funcionales en Paciente, Hospital, Alcaldía o Visitador.
- Corrección de la deuda preexistente de branding.

## Allowlist de implementación

### Paquete A — topología y runbook

- `compose.staging.yml`
- `.env.staging.example`
- `infra/staging/Caddyfile`
- `infra/staging/init/10-keycloak-database.sh`
- `docs/runbooks/STAGING_DEPLOYMENT.md`

### Paquete B — verificaciones y continuidad

- `scripts/staging/preflight.mjs`
- `scripts/staging/runtime-db-check.mjs`
- `scripts/staging/backup-postgres.ps1`
- `scripts/staging/restore-postgres.ps1`
- `scripts/staging/smoke.mjs`
- `tests/staging/*.test.mts`
- `package.json`

## Denylist

- `apps/api/src/**`, `apps/web/src/**`, `packages/**`, `prisma/schema.prisma`
- `prisma/migrations/**`, `compose.yml`, `.env`, `package-lock.json`
- `prototype-claude/**`, `.agents/**`, `.claude/**`, `.codex/**`, `.mcp.json`
- cualquier infraestructura externa, secreto o dato real

## Aceptación

1. `docker compose -f compose.staging.yml config` —validación autoritativa,
   standalone— resuelve sin secretos reales y no publica servicios internos.
   `compose.staging.yml` NO se valida ni se ejecuta como overlay de
   `compose.yml`: el Compose local aporta puertos de host de desarrollo,
   contextos de build y requisitos OIDC que contradicen el límite aislado
   aprobado. Solo el reverse proxy publica `80/443`. `edge` solo concede salida y
   la comparten el reverse proxy y la API; la API no declara `ports:`.
2. Las imágenes permanecen fijadas y los procesos de aplicación no son root.
3. El preflight prueba la separación migrador/runtime y la ausencia de tenant
   persistente sin imprimir URLs ni contraseñas.
4. Backup y restore requieren destinos explícitos, no sobrescriben por defecto y
   verifican integridad: `pg_restore --list` y sidecar SHA-256. La documentación
   no atribuye cifrado al script y exige custodia externa cifrada.
5. El smoke verifica salud y rutas, pero no reclama aceptación visual.
6. La aceptación browser queda como evidencia manual separada y no puede marcarse
   PASS hasta ejecutarse sobre el staging real. La aceptación de Visitador se
   evalúa dentro de `/hospital`; el smoke HTTP no la demuestra.
7. `npm run typecheck`, pruebas focales, lint, `git diff --check`, SDD gate y
   validación strict pasan.

## STOP CONDITIONS

- Se necesita modificar un archivo fuera de la allowlist.
- Se requiere una credencial, dato real o acción externa.
- El runtime necesita propiedad, superusuario, `BYPASSRLS` o tenant persistente.
- Keycloak solo puede levantarse con `start-dev` o HTTP público.
- No existe backup restaurable antes de migrar.
- Un rollback implicaría pérdida o reescritura de auditoría.
