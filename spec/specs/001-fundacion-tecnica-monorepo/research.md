# Investigación 001 - Fundación técnica del monorepo

Medido sobre `develop` el 2026-08-25.

## R1. Workspaces y versiones

`package.json` declara `workspaces: ["apps/*", "packages/*"]`, `type: commonjs`
y `engines.node >=24.0.0 <25.0.0`. Dependencias de desarrollo fijadas a versión
exacta, sin rangos: TypeScript 5.9.3, Prisma 7.9.1, ESLint 9.39.5, Vitest 4.1.11.

`allowScripts` permite explícitamente los scripts de `prisma` y `@prisma/engines`
y **bloquea** `@scarf/scarf` (telemetría). Es una decisión de seguridad
deliberada, no un descuido de configuración.

## R2. Orden de compilación

Los scripts encadenan `build:shared` antes que `build:api` y `build:web`.
`typecheck`, `test`, `dev:api` y `dev:web` también arrancan por `build:shared`.
El orden no es convención: `@merdn/api` importa tipos de `@merdn/shared` en
tres archivos (`health-response.dto.ts`, `health.controller.ts`,
`health.service.ts`).

## R3. Superficie del paquete compartido

`packages/shared/src/` son 3 archivos y 89 líneas en total. `index.ts` exporta
únicamente `HEALTH_RESPONSE`, `HEALTH_ROUTE`, `HEALTH_STATUS_OK`,
`isHealthResponse`, `HealthResponse` y `HealthStatus`.

`grep -rn "@merdn/shared" apps/web/src` → **sin resultados**. El frontend no
consume el paquete compartido.

## R4. Servicios de Compose

`compose.yml` define `postgres`, `api`, `web` y `oidc-local`, más la red
`merdn-internal` y el volumen `merdn-postgres-data`. `oidc-local` es Keycloak,
con su realm en `infra/local-oidc/realm-merdn-local.json`.

## R5. Validación de entorno

`apps/api/src/config/environment.ts` lee 18 nombres de variable. `.env.example`
documenta 33, de las cuales las restantes las consumen el web, el orquestador,
la herramienta de aprovisionamiento de identidad y Compose.

Existe `apps/api/src/config/environment.test.ts`, es decir la validación está
cubierta por pruebas unitarias.

## R6. Verificación no ejecutada

`node_modules` no está instalado en el entorno donde se redactó esta spec, de
modo que **no se ejecutaron** `npm run build`, `typecheck`, `lint` ni `test`.
Todo lo anterior es lectura de código y configuración. La ejecución sigue
pendiente y debe hacerse antes de dar por verificada esta spec.

## R7. Trazabilidad histórica

Task Specification: `tasks/TASK-001.md`.
Auditorías: `reviews/REVIEW-001.md` y `reviews/REVIEW-001-FINAL.md`.
Ambas congeladas y de solo lectura (`CLAUDE.md` §14.1).
