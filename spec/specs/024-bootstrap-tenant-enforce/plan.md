# Plan — Spec 024

## Estrategia

Aplicar un cambio vertical mínimo: configuración confiable de UUID, verificación
de la pareja UUID+código dentro de `withTenant()`, y evidencia en PostgreSQL real
de arranque en frío, autenticación y aislamiento. No hay trabajo SQL.

## Reconciliación con `develop` y Spec 023

- **Contrato `MERDN_ACTIVE_TENANT_ID`: NO implementado.** No aparece fuera de
  esta spec; `environment.ts` solo expone `activeTenantCode`.
- **Bootstrap ID+código bajo `withTenant`: NO implementado.** El servicio sigue
  haciendo `prisma.tenant.findUnique({code})` antes del contexto.
- **Pruebas de bootstrap/cold-start en `enforce`: NO implementadas.** Las suites
  API relevantes siguen forzando `disabled`; las pruebas DB existentes sí
  aportan helpers y evidencia reutilizable de rol, GUC y aislamiento.
- **Controles de staging Spec 023: YA implementados.** Plantilla, Compose,
  preflight, tests y runbook existen en `c030e48`; A solo los extiende con una
  variable y conserva todas sus aserciones actuales.

## Paquete A — contrato de configuración (≤15 minutos)

Allowlist exclusiva: `apps/api/src/config/environment.ts`,
`apps/api/src/config/environment.test.ts`, `.env.example`,
`.env.staging.example`, `compose.yml`, `compose.staging.yml`,
`scripts/staging/preflight.mjs`, `tests/staging/staging-tools.test.mts` y
`docs/runbooks/STAGING_DEPLOYMENT.md`.

Objetivo: introducir y propagar `MERDN_ACTIVE_TENANT_ID` validado como UUID,
obligatorio bajo `enforce`, sin cambiar todavía la resolución runtime. Staging
rechaza ausencia, UUID malformado y placeholder sin perder controles de Spec 023.

Validación Claude: tests de entorno; suite staging completa; typecheck focal;
lint focal y `git diff --check`.

STOP: una comprobación de Spec 023 regresa; se necesita un secreto real, dato,
migración, código de bootstrap o archivo fuera de esta allowlist.

## Paquete B — bootstrap transaccional (≤15 minutos)

Allowlist exclusiva: `apps/api/src/database/tenant-context.service.ts`, nuevo
`apps/api/src/database/tenant-context.service.test.ts`,
`apps/api/test/test-environment.ts`, y actualización únicamente de fixtures
tipados en `apps/api/src/human-auth/human-auth.config.test.ts` y
`apps/api/src/institutional-auth/institutional-auth.unit.test.ts`.

Objetivo: verificar la pareja configurada dentro de
`withTenant(configuredTenantId)`, cachear solo tras éxito y conservar errores
sanitizados, runtime enforce y RLS.

Validación Claude: unitarios de primera resolución/caché; pareja correcta,
inexistente y cruzada; fallo sin caché; suites unitarias afectadas; typecheck,
lint focal y `git diff --check`.

STOP: se requiere parámetro de petición, fallback privilegiado, cambio a
`PrismaService.withTenant()`, migración/policy/grant o archivo fuera de allowlist.

## Paquete C — evidencia PostgreSQL/cold-start (≤15 minutos)

Allowlist exclusiva: nuevos `apps/api/test/tenant-bootstrap.db.test.ts` y
`apps/api/test/cold-start-auth.api.test.ts`, más
`apps/api/test/runtime-fail-closed.db.test.ts` solo para fixture/aserción
reutilizada necesaria.

Objetivo: demostrar en PostgreSQL real y proceso/servicio sin caché los veinte
casos obligatorios, incluidos los primeros logins Hospital, Alcaldía
`MUNICIPAL_VIEWER` y Paciente OIDC.

Validación Claude: suites DB/API focales con conexión runtime separada y
`enforce`; informar como NO EJECUTADA cualquier prueba sin PostgreSQL real;
typecheck, lint focal y `git diff --check`.

STOP: una prueba decisiva usa `disabled`, doble de PostgreSQL o datos reales; se
requiere modificar código productivo, flujo auth, valores demo o archivo fuera
de allowlist.

## Dependencias

- Aprobación y consentimiento registrados el 2026-08-28.
- PostgreSQL real migrado, rol runtime dedicado y datos exclusivamente ficticios.
- UUID del tenant local obtenido sin modificar su fila.

## Riesgos y mitigación

- Discordancia ID/código: consulta conjunta y fallo indistinguible.
- Falso positivo por caché: crear instancia/proceso nuevo en cada caso decisivo.
- Pruebas API existentes degradadas: la nueva suite prohíbe `disabled`.
- Propagación incompleta: pruebas de entorno, Compose y preflight exigen ambas
  variables en `enforce`.

## Rollback y compatibilidad

Rollback de aplicación: volver al artefacto anterior y su configuración; no hay
rollback SQL. El despliegue es incompatible con `enforce` si falta el UUID y debe
fallar antes de servir negocio. No se cambia ni regenera el UUID existente.
