# Research — Spec 023

## Inventario comprobado el 2026-08-27

| Capacidad | Estado | Evidencia |
|---|---|---|
| Dockerfiles API/web | READY | `apps/api/Dockerfile`, `apps/web/Dockerfile`; builds multi-stage y usuario `node` |
| Compose local | PARTIAL | `compose.yml`; declara expresamente que no es producción |
| PostgreSQL | PARTIAL | imagen fijada, volumen y healthcheck; puerto loopback local |
| OIDC | PARTIAL | Keycloak local opt-in con `start-dev`; no válido para staging |
| API/web | PARTIAL | imágenes y healthchecks; topología solo local |
| Reverse proxy/TLS | MISSING | `compose.yml` los excluye expresamente |
| Plantilla de entorno | PARTIAL | `.env.example` es local y contiene placeholders |
| Runtime DB | PARTIAL | API y docs soportan URL separada; Compose no la pasa |
| Migraciones | PARTIAL | Prisma `migrate deploy` documentado; sin gate de despliegue |
| Health | PARTIAL | DB/OIDC/API/web en Compose; API `/health` solo liveness |
| Backup/restore | MISSING | política en `docs/SECURITY.md`, sin scripts/runbook |
| Rollback operativo | MISSING | rollbacks SQL por feature no forman estrategia de release |
| Hostinger runbook | MISSING | dirección aprobada, ejecución diferida |
| Browser acceptance | PARTIAL | criterios por features; sin plan consolidado de staging |

## Rol runtime

La migración `20260822120000_core_01_hardening` crea `merdn_runtime` sin LOGIN.
La capacidad de LOGIN y su secreto pertenecen al entorno. `.env.example` ya
documenta `ALTER ROLE ... LOGIN PASSWORD`, pero staging debe ejecutarlo mediante
un canal administrativo y secreto externo. No se versiona contraseña.

Las comprobaciones mínimas son `current_user = 'merdn_runtime'`, `rolsuper =
false`, `rolbypassrls = false`, ausencia de propiedad sobre tablas protegidas,
`current_setting('merdn.tenant_id', true)` vacío al conectar y lectura protegida
sin contexto denegada/vacía.

## Migraciones y rollback

`DATABASE_URL` del propietario/migrador ejecuta `npx prisma migrate deploy`.
`merdn_runtime` nunca migra. Antes: `prisma migrate status`, backup verificable y
commit/imagen fijados. Después: status limpio, pruebas de esquema/RLS y salud.
Rollback de aplicación = volver a imagen inmutable compatible. Una migración no
se revierte automáticamente: forward-fix o restore manual aprobado.

## Decisión técnica propuesta para aprobación

Caddy se usa solo como borde versionable mínimo por su configuración TLS simple.
La emisión real de certificados, DNS y credenciales queda fuera de esta spec. Si
el operador exige el proxy administrado de Hostinger, se detiene el Paquete A
antes de introducir una segunda arquitectura.
