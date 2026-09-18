# Plan 017 - Worklist del profesional visitador

## Resumen

> **RETROSPECTIVO.** Este plan no propone trabajo: reconstruye, desde los
> commits reales de `history.md` y desde el código medido, cómo se construyó lo
> que hoy existe.
>
> **Actualizado el 2026-08-25.** Este bloque decía que «la única fase que no
> describe pasado es la 3». Dejó de ser exacto. Hoy son dos: la 3, implementada
> fuera de `develop` y sin integrar, y la 4, que registra —sin autorizar— las
> correcciones que la auditoría de MP02 exige antes de integrar.

VISITADOR-CORE-01 abre la superficie propia de la persona que realiza visitas
domiciliarias. Se planificó en micropaquetes de 15 minutos, siguiendo la
disciplina del repositorio: primero la lectura de backend que faltaba (MP01),
después la interfaz que la consume (MP02), y solo entonces las transiciones
desde esa interfaz (MP03, ni siquiera especificado).

MP01 se implementó completo. MP02 se especificó y ahí se detuvo el repositorio.

## Contexto técnico

- **Runtime**: NestJS 11 sobre Node, Prisma con adaptador `@prisma/adapter-pg`,
  PostgreSQL. Monorepo npm workspaces (spec 001).
- **Punto de partida**: la spec 012 ya había entregado el módulo `visits` con
  materialización institucional, tres transiciones profesionales y lectura de
  UNA visita por identificador. Faltaba exactamente una cosa: **descubrimiento**.
  Sin listado, una interfaz Visitador no tenía forma legítima de obtener un
  `visitId`.
- **Identidad**: la autorización deriva de `HumanPrincipal`
  (`sessionId`, `humanAccountId`, `personId`, `tenantId`), que produce
  `HumanSessionGuard` server-side (spec 011). El navegador nunca aporta
  identidad.
- **Aislamiento**: `PrismaService.withTenant()` + Row Level Security + claves
  foráneas compuestas `(id, tenantId)`. El rol `merdn_runtime` es `NOBYPASSRLS`.
- **Restricción de método**: cada micropaquete declara una allowlist exacta de
  archivos. Tocar uno más bloquea el paquete. Por eso la condición de
  autorización se reescribe en cada servicio en vez de importarse: la allowlist
  de MP01 prohibía modificar los servicios de MP02/MP03/MP04 de la spec 012.

## Fases de implementación (ejecutadas)

### Fase 1 — Especificación de MP01 · commit `fb871e7` (2026-08-25)

`docs(visitador): add professional worklist API task`, 1 archivo, 216 líneas.

Crea `tasks/VISITADOR-CORE-01-MP01-PROFESSIONAL-WORKLIST-API.md`. Fija el
contrato completo antes de escribir código: ruta, guarda, forma de la consulta,
forma de la respuesta, cadena de autorización, política de errores, allowlist de
cinco archivos, quince pruebas focales y siete condiciones de parada.

Decisiones que quedaron cerradas aquí y que el código respetó:

- respuesta **vacía** en vez de `403`/`404` para no permitir enumeración;
- `visit: null` como respuesta honesta de una cita no materializada, que **no**
  autoriza a materializarla;
- **sin auditoría de lectura**, por no existir evento aprobado en el catálogo:
  se registra como residual en vez de fingir un evento existente;
- ventana obligatoria, sin periodo por defecto.

### Fase 2 — Implementación de MP01 · commit `15a9ae1` (2026-08-25)

`feat(visitador): add professional worklist api`, 5 archivos, +1.349 / −9.

| Archivo | Cambio |
|---|---|
| `apps/api/src/visits/professional-visit-worklist.service.ts` | **nuevo**, 341 líneas: `listAuthorized`, `asignacionAutorizada`, proyección minimizada, orden estable |
| `apps/api/src/visits/visits.dto.ts` | +331: `parseWorklistQuery`, ventana UTC, límite de 31 días, `VisitsQueryError` y cinco clases DTO |
| `apps/api/src/visits/visits.controller.ts` | +120: `@Get()` declarado antes de `:visitId`, contrato OpenAPI, `noStore` |
| `apps/api/src/visits/visits.module.ts` | +18: alta del servicio como proveedor y actualización del alcance declarado del módulo |
| `apps/api/test/visits.api.test.ts` | +548: bloque `E` con 12 pruebas y ampliación del `503` del bloque `D` a cuatro operaciones |

Exactamente los cinco archivos de la allowlist. Cero migraciones, cero modelos,
cero eventos de auditoría, cero cambios en Hospital y cero interfaz.

### Fase 3 — Especificación de MP02 · commit `6a54de9` (2026-08-25) — **NO INTEGRADA EN `develop`**

`docs(visitador): add visible worklist agenda task`, 1 archivo, 176 líneas.

Crea `tasks/VISITADOR-CORE-01-MP02-VISIBLE-WORKLIST-AGENDA.md` y **ahí termina
la línea `develop`**: no hay commit posterior de implementación en esa rama.

> **Actualizado el 2026-08-25.** Este bloque decía «No hay commit posterior en
> ninguna rama». Dejó de ser cierto: existe `cffbf6b` en
> `wip/visitador-mp02-20260825`. Lo que sigue describe lo que MP02 especificó y
> lo que falta **en `develop`**.

Lo que MP02 dejó especificado y sigue sin estar en `develop`:

1. `apps/web/src/app/visitador/page.tsx` — la ruta `/visitador`;
2. `apps/web/src/features/visitador/VisitadorExperience.tsx` — sesión ausente vs.
   confirmada, agenda del día UTC, navegación de ventana, tarjeta por cita,
   estados de producto (`Programada`, `En curso`, `Completada`,
   `No completada`), `Pendiente de preparación por la institución` para
   `visit: null`, `Abrir visita` y `Volver a la agenda`;
3. `apps/web/src/features/visitador/visitador.module.css`;
4. `apps/web/src/features/visitador/visitadorWorklistClient.ts` — cliente tipado
   con `credentials: 'include'`, `cache: 'no-store'` y traducción de
   400/401/403/404/409/503, red, cuerpo ilegible y abort a desenlaces seguros;
5. y 6. las dos suites focales correspondientes.

MP02 exige **reutilizar por importación** `hospitalHumanSessionClient.ts`
(login OIDC, consulta y cierre de sesión) y `hospitalVisitsClient.ts`
(`consultarVisitaProfesional`), sin copiarlos ni modificarlos, y prohíbe
cualquier mutación: START, COMPLETE y NOT_COMPLETED quedaban para MP03.

**Estado real de esa fase**:
`spec/bitacora/decisiones/2026-08-25-auditoria-git-y-estado-de-ramas.md`
registró que existía código de `apps/web/src/app/visitador/` y
`apps/web/src/features/visitador/` **sin commit, en la copia de trabajo del
auditor**, clasificado como riesgo CRÍTICO.

Ese día, con autorización expresa del Product Owner, ese código se preservó:
seis archivos, 2.763 líneas, commit
`cffbf6bd7b5e19a4fb712467e928f92698b18b99` en `wip/visitador-mp02-20260825`,
rama subida a `origin`. **Preservado no es integrado ni verificado.** No se
fusionó con `develop`, no se leyó ni revisó el contenido de los archivos, no se
contrastó con la Task Specification de MP02, no se ejecutó ninguna de sus dos
suites y no hay auditoría de Codex. Ver `spec/bitacora/global/PROJECT_LOG.md`.

### Fase 4 — Corrección de MP02 antes de integrar · **REGISTRADA, NO AUTORIZADA**

El 2026-08-25 Codex auditó el código preservado en `wip/visitador-mp02-20260825`
y devolvió `PASS WITH CORRECTIONS`, con `SAFE TO INTEGRATE INTO DEVELOP: NO` y
`SPEC 017 READY FOR APPROVAL: NO`. Esta fase agrupa lo que ese veredicto exige
antes de integrar.

**Alcance de B1 y B2 aprobado el 2026-08-25; ejecución todavía no.** El Product
Owner aprobó el alcance de esas dos correcciones y mantuvo B3, B4 y B5
pendientes; registro en
`spec/bitacora/decisiones/2026-08-25-aprobacion-alcance-b1-b2-visitador-mp02.md`.
Aun así no hay Task Specification nueva —`tasks/` está congelado—, no hay
consentimiento registrado para esta spec, la compuerta SDD sigue cerrada y la §12
sigue prohibiendo commit, merge, push, release y despliegue. Lo que sigue es el
orden por dependencia, no una autorización de ejecución.

| Paso | Qué corrige | Depende de |
|---|---|---|
| B1 | Fail-closed de `visit`: solo `null` explícito significa «no materializada»; ausente o mal formado invalida la respuesta | Nada. Corrección de código dentro de la allowlist de seis archivos |
| B2 | Ventana: rechazar invertida y mayor de 31 días; exigir que la devuelta por el servidor coincida exactamente con la pedida | Nada. Misma allowlist |
| B6a | Volver a pasar las 78 pruebas focales, el typecheck de web, el ESLint acotado, `git diff --check` y la validación SDD | B1 y B2 |
| B3 | Pruebas de interacción real: sesión, carga inicial del día UTC, aplicar periodo, anterior, siguiente, hoy, abrir visita, detalle, volver, reintento, logout exitoso, logout fallido, y abortados o rezagados que no repinten | **Decisión de producto**: entorno DOM y ampliación de allowlist |
| B4 | Foco al entrar al detalle, restauración al volver, teclado y accesibilidad | B3 |
| B5 | Verificación visual y de ejecución: escritorio, viewport estrecho, responsive y fidelidad con el diseño aprobado | **Decisión de producto**: entorno de ejecución completo |
| B6b | Repetir todas las verificaciones finales, ahora incluidas las pruebas nuevas | B3, B4, B5 |

B1 y B2 caben dentro de la allowlist congelada de MP02: son cambios en
`visitadorWorklistClient.ts` y en su suite. B3, B4 y B5 no caben: exigen al menos
una dependencia nueva de entorno DOM —`apps/web/vitest.config.mts:28` fija
`environment: 'node'`—, tocar `apps/web/package.json` y el lockfile, y levantar
API, PostgreSQL y OIDC. Esas son decisiones del Product Owner; están listadas en
«Decisiones de producto todavía requeridas» de `spec.md`.

El hardening recomendado —auditoría de lectura, paginación, límite de tasa, zona
institucional, desambiguación de `visit: null`, unificación de la condición de
autorización duplicada y MP03— queda **fuera** de esta fase: es posterior a la
integración y no la condiciona.

## Dependencias

**Internas, en orden de necesidad:**

1. **001** — monorepo, Prisma, PostgreSQL, NestJS.
2. **007** — `Person`/`Patient`, tenant en servidor, RLS desde el primer dato.
3. **010** — `ProfessionalProfile`, `ProfessionalAffiliation`, `CareAssignment`,
   `Appointment`: la agenda que se lee.
4. **011** — OIDC, `HumanSession`, `HumanSessionGuard`, `HumanPrincipal`,
   `noStore`.
5. **012** — módulo `visits`, `HomeVisit`, controlador profesional y la barrera
   que MP01 replica.
6. **013** — materialización desde Hospital: sin ella toda fila llega
   `visit: null`. Y `hospitalVisitsClient.ts` para el detalle en MP02.
7. **014** — `hospitalHumanSessionClient.ts` para el login humano en MP02.

**Externas:** PostgreSQL con tenant activo; proveedor OIDC (Keycloak local);
`tools/identity-provisioning` para vincular un `subject` a una `Person`.

**Migraciones previas necesarias:** `20260822160000_hospital_core_02`,
`20260823120000_identity_relationships_core_01`, `20260824120000_visits_core_01`
(+ `_02` y `_03`, que solo añaden valores al enum de auditoría). Esta capacidad
**no añade ninguna**.

## Hitos

| Hito | Commit | Estado |
|---|---|---|
| Contrato de la worklist congelado | `fb871e7` | Cumplido |
| Ruta de descubrimiento profesional operativa en la API | `15a9ae1` | Cumplido |
| Cobertura de borde: 12 pruebas + `503` fail-closed + contrato OpenAPI | `15a9ae1` | Escrita; **no ejecutada** en esta verificación |
| Contrato de la interfaz `/visitador` congelado | `6a54de9` | Cumplido |
| Interfaz `/visitador` preservada bajo control de versiones | `cffbf6b` (rama `wip/visitador-mp02-20260825`) | Cumplido — solo preservación |
| Interfaz `/visitador` verificada contra la Task Specification de MP02 | `cffbf6b`, auditado | Parcial: auditada el 2026-08-25 con `PASS WITH CORRECTIONS`; B1–B6 sin aplicar |
| Correcciones bloqueantes B1–B6 aplicadas y verificadas | — | **No alcanzado**; B3, B4 y B5 además bloqueadas por decisiones de producto |
| Interfaz `/visitador` integrada en `develop` y funcionando | — | **No alcanzado**. `SAFE TO INTEGRATE INTO DEVELOP: NO` |
| Transiciones desde la interfaz (MP03) | — | Ni siquiera especificado |
| Auditoría de Codex de la capacidad | — | Parcial: MP02 auditado el 2026-08-25; MP01 sigue sin veredicto |

## Riesgos (vigentes hoy)

| Riesgo | Impacto | Estado |
|---|---|---|
| **Capacidad inalcanzable para su usuario.** La API existe y ninguna interfaz la consume | La persona visitadora no tiene forma de ver su agenda en MERDN. El valor de MP01 está latente, no entregado | **Vigente y bloqueante** |
| **Código de MP02 fuera de control de versiones.** Vivía solo en una copia de trabajo, en una máquina | Pérdida total si esa copia se perdía | **Cerrado el 2026-08-25**: preservado en `wip/visitador-mp02-20260825` (`cffbf6b`) y subido a GitHub |
| **Código de MP02 sin revisar ni verificar.** Está preservado, pero su contenido no se ha leído, no se ha contrastado con su Task Specification y sus dos suites no se han ejecutado | Preservar puede leerse como validar. Un merge apresurado metería en `develop` 2.763 líneas que nadie ha revisado, sobre una capacidad que además carece de auditoría de Codex | **Cerrado en su parte de revisión el 2026-08-25**: Codex auditó MP02 y devolvió `PASS WITH CORRECTIONS`. Las suites siguen sin ejecutarse en esta copia. Sustituido por los dos riesgos siguientes |
| **Correcciones bloqueantes sin aplicar.** B1 (fail-closed de `visit`) y B2 (validación de la ventana devuelta) son defectos confirmados sobre `cffbf6b` | Una fila a la que le falte `visit` se anuncia hoy como «Pendiente de preparación por la institución», y una ventana distinta de la pedida se mostraría como si fuera la solicitada: en ambos casos MERDN afirmaría algo que el servidor no dijo | **Vigente y bloqueante para integrar** |
| **Sin entorno DOM de pruebas.** `apps/web/vitest.config.mts:28` fija `environment: 'node'` y no hay `jsdom`, `happy-dom` ni `@testing-library/*` | Clic, foco, teclado, navegación entre vistas y accesibilidad no se pueden verificar automáticamente. B3 y B4 quedan bloqueadas por una decisión de dependencia que Claude Code no puede tomar (`CLAUDE.md` §4 y §9.11) | **Vigente**; decisión pendiente del Product Owner |
| **Lectura sin rastro.** No hay evento de auditoría para la consulta del worklist | Ante una investigación no se puede saber quién consultó qué agenda ni cuándo. Contrasta con la materialización y las tres transiciones, que sí se auditan | Vigente; residual declarado por MP01 §5 |
| **Sin límite de filas ni de tasa.** Ventana de hasta 31 días, sin `take` y sin guarda de tasa | Respuesta de tamaño no acotado y consultas repetidas sin coste para una sesión válida | Vigente |
| **Condición de autorización duplicada** entre `professional-visit-worklist.service.ts` y `professional-visit-query.service.ts` | Un cambio de la regla de vigencia aplicado en un solo sitio abre una divergencia silenciosa entre listar y leer | Vigente; consecuencia consciente de la disciplina de allowlists |
| **Ventana UTC sin zona institucional** | Los límites del «día» de la profesional se desplazan respecto a su hora local | Vigente; decisión declarada en `visits.dto.ts:433-440` |
| **Sin auditoría independiente.** Ninguna de las dos Task Specs tiene veredicto en `reviews/` | El código de MP01 no ha sido contrastado por un revisor externo | Vigente |
| **Dependencia operativa de Hospital.** Solo la identidad `HOSPITAL_SCHEDULER` materializa | Si nadie materializa, la agenda del visitador es una lista de citas que no puede abrir | Vigente por diseño |
