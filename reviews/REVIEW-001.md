# MERDN Implementation Review

## Review Identification

- **Review ID:** REVIEW-001
- **Task ID:** TASK-001
- **Reviewer:** Codex, MERDN Orchestrator, con revisión especializada de Backend/Data, Security/Access, QA/Acceptance, DevOps y Frontend
- **Date:** 2026-08-19
- **Result:** **CHANGES REQUIRED**

## Scope Reviewed

- **Task Specification:** `tasks/TASK-001.md`, archivo nuevo no rastreado de 348 líneas.
- **Implementación:** working tree local de `develop`; 55 entradas: 54 archivos nuevos no rastreados y `AGENTS.md` reportado como modificado.
- **Archivos revisados:** todas las entradas de `git status --porcelain=v1 -uall`, con atención expresa a `apps/api/**`, `apps/web/**`, `packages/shared/**`, `prisma/**`, `tests/**`, configuración raíz, Compose y archivos protegidos.
- **Método:** inspección estática, comparación con `HEAD`, ejecución local de toolchain, instalación reproducible, lint, typecheck, tests, builds, Prisma, secrets scan y health/OpenAPI. Docker/PostgreSQL no estaban disponibles en el host.

### Inventory and attribution

- **53 archivos nuevos dentro de la allowlist de TASK-001:** configuración raíz, monorepo, API, web, shared, Prisma y tests. Su contenido corresponde materialmente a la fundación técnica pedida. Git demuestra que son nuevos/no rastreados, pero no conserva autoría; por sí solo no puede probar que cada uno fue creado por Claude Code.
- **`tasks/TASK-001.md`:** archivo nuevo/no rastreado y prohibido para la implementación. Su contenido es la Task Specification usada para gobernar el trabajo. Sin baseline/commit o evidencia externa, Git no permite determinar si Claude Code lo creó o lo modificó después de recibirlo.
- **`AGENTS.md`:** no tiene cambio textual normalizado (`git diff` vacío y hash Git normalizado igual a `HEAD`: `3c384c3b...`), pero sí cambió byte-for-byte: working tree 21,499 bytes versus blob 20,863 bytes. La diferencia de 636 bytes coincide con conversión integral LF→CRLF. TASK-001 no autorizó esta conversión.
- **Fuera de alcance observado:** `tasks/TASK-001.md` dentro del change set y la conversión de bytes de `AGENTS.md`.
- **Prototipo:** `prototype-claude/**` no presenta cambios rastreados ni no rastreados.

## Task Compliance

| Criterio | Estado | Evidencia |
| --- | --- | --- |
| AC-01/02 | PASS | npm workspaces `apps/*`, `packages/*`; Node 24.19.0, npm 11.17.0; `npm ci` exit 0; TypeScript strict inspeccionado. |
| AC-03/04 | PASS | Web y API compilan; tests de app pasan; API real inició localmente. |
| AC-05/06 | PASS | `GET /health`: HTTP 200, `application/json; charset=utf-8`, cuerpo exacto `{"status":"ok"}`; `/docs-json` contiene únicamente `/health`. |
| AC-07 | NOT VERIFIED | Prisma 7.9.1 valida, pero la conexión PostgreSQL/`db execute` falla P1001 porque no hay servidor/Docker local. |
| AC-08 | PASS | Cero bloques `model`; no se detectaron migraciones, SQL ni seeds. |
| AC-09/10 | NOT VERIFIED | Docker/Compose no está instalado en este host; stack, health y reproducción limpia no ejecutados. |
| AC-11/12/13 | PASS | Builds API/web/shared, typecheck estricto y lint exit 0. |
| AC-14 | PASS | 32 tests: API 20, web 8, shared 4; todos pasan. |
| AC-15/16/17 | PASS con brecha | Ignorados y valores ficticios correctos; secrets scan pasa; no servicios externos activos. El scanner excluye `*.lock` del contenido. |
| AC-18 | FAIL | `AGENTS.md` no permanece byte-for-byte; `tasks/TASK-001.md` aparece no rastreado. |
| AC-19/20 | PASS | Único endpoint `/health`; UI técnica mínima; sin entidades/fixtures de negocio; README técnicos presentes. |

## Architecture, Security, Data and Frontend Review

- **Arquitectura:** separación mínima coherente entre web, API, shared y Prisma. No se observaron dominios MERDN, autenticación, autorización, tenancy o auditoría ficticios.
- **Backend/API:** único controlador HTTP `GET /health`; respuesta minimizada y OpenAPI limitado al endpoint aprobado.
- **Datos:** datasource PostgreSQL y generator Prisma sin modelos; no existen migraciones ni datos de negocio. La conexión real permanece sin verificar.
- **Frontend:** página técnica neutral y mínima; no copia ni rediseña `prototype-claude`.
- **Seguridad:** `.env.example` contiene marcadores ficticios; `.env`, secretos, dependencias, builds y datos locales están ignorados. Puertos Compose están ligados a loopback. No se detectaron secretos reales.
- **DevOps:** Compose y Dockerfiles son configuración de desarrollo local, no despliegue Hostinger. Su configuración y salud no pudieron validarse sin Docker.
- **Roles, permisos, tenancy, auditoría, regulación y comercio hospitalario:** N/A y correctamente fuera del alcance de TASK-001.

## Test Review

| Prueba/comando | Resultado | Evidencia resumida |
| --- | --- | --- |
| `node --version`; `npm.cmd --version` | PASS | v24.19.0; 11.17.0 |
| `npm.cmd ci` | PASS | Instalación desde lockfile exit 0; advertencia de script no aprobado de `@scarf/scarf@1.4.0`. |
| `npm.cmd run lint` | PASS | exit 0 |
| `npm.cmd run typecheck` | PASS | shared, API y web exit 0 |
| `npm.cmd test` | PASS | 7 archivos, 32 tests, 32 passed |
| `npm.cmd run build:api` | PASS | Nest build exit 0 |
| `npm.cmd run build:web` | PASS | Next 16.3.1 compiló, tipó y generó rutas correctamente |
| `npm.cmd run prisma:validate` | PASS | schema válido |
| `npm.cmd run secrets:scan` | PASS con brecha | 108 archivos versionables; sin hallazgos; excluye contenido de `*.lock`. |
| API local `/health` y `/docs-json` | PASS | 200; JSON exacto; OpenAPI solo `/health` |
| `npm.cmd run db:check` | FAIL/ENVIRONMENT | P1001: no existe PostgreSQL escuchando en 127.0.0.1:5432. |
| Docker Compose config/up/ps/health/E2E | NOT RUN | `docker` no está instalado/disponible. |
| Scope/protected files | FAIL | `AGENTS.md` difiere en bytes; `tasks/TASK-001.md` es un untracked prohibido; prototipo intacto. |

## Findings

### FINDING-001 — Archivo protegido `AGENTS.md` convertido a CRLF

- **Severity:** HIGH
- **File:** `AGENTS.md`
- **Requirement:** AC-18; Forbidden Files.
- **Evidence:** status `.M`; tamaño working tree 21,499 frente a 20,863 bytes en `HEAD`; hash sin filtros distinto. El hash Git normalizado coincide y `git diff` es vacío, demostrando que el contenido lógico no cambió y que la alteración es de finales de línea.
- **Risk:** viola el requisito byte-for-byte y contamina el change set con un archivo prohibido.
- **Required correction:** restaurar `AGENTS.md` exactamente a los bytes de `HEAD`, sin cambios de contenido, mediante una acción autorizada y verificar status/hash antes del commit.
- **Closure criterion:** `git status --short -- AGENTS.md` vacío y comparación byte-for-byte idéntica a `HEAD`.
- **Owner:** Claude Code / responsable del working tree.
- **Status:** OPEN.

### FINDING-002 — Task Specification prohibida aparece dentro del working tree

- **Severity:** HIGH
- **File:** `tasks/TASK-001.md`
- **Requirement:** AC-18; Forbidden Files.
- **Evidence:** archivo nuevo/no rastreado. Git no ofrece baseline ni autoría para demostrar si Claude lo modificó después de recibirlo; sus timestamps tampoco prueban autor.
- **Risk:** podría incluirse indebidamente en el commit de implementación o encubrir una modificación posterior de la especificación.
- **Required correction:** confirmar su procedencia con evidencia externa y separar/excluir este archivo del change set de implementación. No modificarlo para cerrar la implementación.
- **Closure criterion:** evidencia de que el Task Specification aprobado es inmutable y que no forma parte del commit de implementación, o baseline versionado autorizado que permita comparación.
- **Owner:** Product Owner / Codex para procedencia; ejecutor Git autorizado para separación.
- **Status:** OPEN.

### FINDING-003 — Pruebas obligatorias Docker/PostgreSQL no verificadas

- **Severity:** HIGH
- **Components:** `compose.yml`, Dockerfiles, Prisma/PostgreSQL integration.
- **Requirement:** AC-07, AC-09, AC-10; T-11 a T-15 y T-18.
- **Evidence:** Docker no está disponible; `db:check` termina P1001 sin PostgreSQL local.
- **Risk:** no hay evidencia de que Compose valide, los tres servicios alcancen healthy, Prisma conecte, ni el flujo limpio reproduzca health/web.
- **Required correction:** ejecutar la matriz en un host con Docker Compose v2 y registrar config, build/up, ps/health, Prisma `SELECT 1`, ausencia de tablas de negocio, `/health`, web y regresión final.
- **Closure criterion:** todas las pruebas obligatorias anteriores exit 0 con evidencia segura.
- **Owner:** Claude Code / QA en entorno habilitado.
- **Status:** OPEN.

### FINDING-004 — Secrets scan omite el contenido del lockfile

- **Severity:** MEDIUM
- **File:** `tests/secrets-scan.check.mjs:63`
- **Requirement:** AC-16; T-16.
- **Evidence:** `CONTENT_SCAN_EXCLUDED` incluye la extensión `.lock`; por tanto `package-lock.json` se enumera pero no se inspecciona por patrones de contenido.
- **Risk:** la prueba autodeclarada no cubre literalmente todos los archivos versionables y podría omitir URLs/tokens incrustados en lockfiles.
- **Required correction:** incluir lockfiles de texto en el escaneo o documentar e implementar una comprobación equivalente explícita; volver a ejecutar T-16.
- **Closure criterion:** evidencia automatizada de inspección del lockfile y scan exit 0.
- **Owner:** Claude Code.
- **Status:** OPEN.

### FINDING-005 — Dependencia transitiva con script no autorizado explícitamente

- **Severity:** LOW
- **Component:** `package-lock.json` / instalación npm.
- **Requirement:** dependencias intencionales y reproducibilidad segura.
- **Evidence:** `npm ci` advirtió que `@scarf/scarf@1.4.0` tiene `postinstall` no cubierto por `allowScripts`.
- **Risk:** el estado de aprobación de scripts transitivos no está documentado; npm lo bloqueó en esta instalación, pero el comportamiento debe ser deliberado y reproducible.
- **Required correction:** revisar y documentar la decisión de mantener bloqueado ese script o eliminar la dependencia transitiva si no es necesaria; no aprobarlo automáticamente.
- **Closure criterion:** decisión técnica registrada y `npm ci` reproducible sin ambigüedad de scripts.
- **Owner:** Claude Code / Codex review.
- **Status:** OPEN.

## Required Corrections

1. Restaurar `AGENTS.md` byte-for-byte y verificar que desaparezca del status.
2. Confirmar la procedencia/inmutabilidad de `tasks/TASK-001.md` y excluirlo del commit de implementación.
3. Ejecutar y aprobar Docker Compose/PostgreSQL/Prisma/E2E y regresión T-11 a T-15/T-18 en un entorno con Docker.
4. Cerrar la brecha del secrets scan sobre `package-lock.json` y repetir T-16.
5. Documentar la decisión segura sobre el script transitivo de `@scarf/scarf`.

## Final Recommendation

- **Recommendation:** **RETURN TO CLAUDE CODE — CHANGES REQUIRED**
- **Rationale:** la implementación técnica local pasa lint, typecheck, tests, builds, Prisma validation, health y OpenAPI, pero hay un archivo protegido alterado byte-for-byte, un archivo prohibido sin procedencia verificable dentro del working tree y pruebas obligatorias Docker/PostgreSQL pendientes.
- **Required next step:** aplicar únicamente las correcciones autorizadas mediante flujo MERDN, repetir la matriz completa y solicitar una nueva auditoría. Esta revisión no autoriza commit, push, merge, release ni deploy.

## Product Owner Decision

- **Decision:** PENDING
- **Authorized next action:** ninguna acción Git o despliegue autorizada por esta revisión.
