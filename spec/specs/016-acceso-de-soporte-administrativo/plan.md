# Plan 016 - Acceso de soporte administrativo (fundación de datos)

## Resumen

**RETROSPECTIVO.** Reconstruido desde `git log` sobre `develop`, no desde
memoria. La capacidad se planificó en tres micropaquetes; **solo el primero se
implementó en esta rama**. Cuatro commits: dos Task Specifications, una
corrección de contrato de pruebas y una única implementación.

El plan original —MP01 fundación de datos, MP02 servicios y guardas, MP03/MP04
endpoints y lectura Hospital— se detuvo después de MP01. Este documento describe
lo ejecutado y deja explícito lo que quedó fuera.

## Contexto técnico

La capacidad es sensible por naturaleza: concede a una persona administradora
acceso a datos de **otra** institución. El diseño la aborda separando cuatro
cosas que en otros sistemas se confunden en una:

1. **Capacidad** (`PlatformSupportCapability`) — quién es administradora. No es
   credencial, no es rol institucional, no es contexto Patient/Professional/
   Caregiver, y **no concede nada por sí sola**.
2. **Autorización** (`SupportGrant`) — sobre qué institución concreta, con qué
   alcance y con qué vigencia. Sin comodín, sin «todos los tenants», sin alcance
   abierto.
3. **Contexto** (`SupportContextSession`) — la ventana temporal acotada, con
   token propio, motivo obligatorio y salida explícita.
4. **Auditoría** — la traza atribuida siempre a la cuenta humana, con el tenant
   objetivo como `tenantId` y el tenant home en columna aparte.

La decisión estructural es que el dueño a efectos de Row Level Security sea el
tenant **home**, no el objetivo. Así la validación ocurre bajo
`withTenant(homeTenantId)` y la lectura del negocio exigiría un segundo contexto
—`enterRuntimeContext(tx, targetTenantId)`— sin `BYPASSRLS` y sin que el
navegador convierta jamás un `targetTenantId` en autoridad.

Reutiliza sin tocar: OIDC, `HumanAccount`, `HumanSession`, `HumanPrincipal`,
`merdn_runtime`, `merdn_current_tenant()` y el `audit_event` append-only.

## Fases de implementación (ejecutadas)

1. **Task Specification MP01** — `06bcc2b` «docs(admin): add MP01 support
   foundation task». Un archivo, 230 líneas: modelo mínimo, RLS, mínimo
   privilegio, allowlist de cuatro archivos, doce comprobaciones focales
   obligatorias y siete stop conditions.

2. **Implementación MP01** — `43bd6ad` «feat(admin): add support access data
   foundation». Exactamente los cuatro archivos de la allowlist:
   `prisma/schema.prisma` (+308), la migración
   `20260825120000_eloisa_admin_access_01_mp01/migration.sql` (657 líneas), el
   rollback (204) y `apps/api/test/eloisa-admin-support-foundation.db.test.ts`
   (2.072). Añade tres tablas, tres tipos enumerados, 19 primitivas de
   auditoría, cinco columnas nullables de procedencia, dos índices parciales, un
   trigger de inmutabilidad, RLS `ENABLE + FORCE`, tres políticas y privilegios
   mínimos sin `DELETE`.

3. **Task Specification MP02** — `8c36db9` «docs(admin): add MP02 support
   services task». 238 líneas: flujo de apertura, validación, salida, contratos
   de error, allowlist de cinco archivos y dieciocho pruebas focales.
   **Nunca se ejecutó en `develop`.**

4. **Corrección de contrato de pruebas** — `3526c52` «docs(admin): add MP01 MP02
   test contract correction». 174 líneas. Identifica tres aserciones de MP01 que
   asumen que el tenant entero contiene cero evidencia de soporte, supuesto que
   deja de valer en cuanto MP02 ejerce el modelo. **Nunca se aplicó en
   `develop`**: el archivo de prueba conserva un solo commit.

### Fases planificadas y no ejecutadas

- **MP02 — servicios y guardas.** Existe en `origin/wip/eloisa-admin-mp02-20260825`
  (`6b0c74d`, 5 archivos, 3.411 líneas), **fuera de `develop`**.
- **MP03 — controller, DTO, cookie y endpoints.** Sin Task Specification.
- **MP04 — guards de lectura Hospital y auditoría de lectura.** Sin Task
  Specification.
- **Creación y revocación de autorizaciones por Platform Owner/Admin.** Sin Task
  Specification y sin privilegios SQL: exigiría su propia migración.
- **Aprovisionamiento de `eloisa-admin-local`.** Declarado fuera de alcance en
  ambas Task Specifications; no existe en el realm OIDC ni en
  `tools/identity-provisioning/`.

## Dependencias

- **Spec 001** — monorepo, Prisma, PostgreSQL, Compose.
- **Spec 007** — tenant en servidor, RLS desde el primer dato,
  `merdn_current_tenant()`, `audit_event` append-only. MP01 extiende esa tabla
  sin tocar sus triggers ni sus privilegios.
- **Spec 011** — `HumanAccount`, `HumanSession`, OIDC y `HumanPrincipal`. MP01
  añade sobre `human_session` un índice único aditivo para sostener una FK
  compuesta, y nada más.
- **Spec 008** — precedente de `merdn_runtime`, políticas por tenant y
  fail-closed sin GUC.
- **Specs 009, 010 y 012** — las superficies Hospital que el alcance
  `HOSPITAL_OPERATIONAL_READ` nombra. Ninguna se lee hoy desde soporte.
- **Externas** — PostgreSQL con rol `merdn_runtime` no superusuario y sin
  `BYPASSRLS`; Keycloak/OIDC local.

## Hitos

- **H1 — el permiso tiene forma antes que mecanismo.** Tres tablas, alcance
  cerrado de un solo valor, vigencia representable y auditoría con procedencia.
  Cumplido en `43bd6ad`.
- **H2 — aislamiento por tenant home con RLS forzada.** `ENABLE` + `FORCE` y tres
  políticas contra `merdn_current_tenant()`. Cumplido en `43bd6ad`;
  **verificación por ejecución pendiente**.
- **H3 — mínimo privilegio sin `DELETE`.** `SELECT` en capacidad y autorización,
  `SELECT/INSERT/UPDATE` en contexto. Cumplido en `43bd6ad`.
- **H4 — el ciclo de vida del contexto en runtime.** **No alcanzado en
  `develop`.**
- **H5 — lectura Hospital de soporte con auditoría por lectura.** **No
  alcanzado.**

## Riesgos (vigentes hoy)

1. **MP02 vive solo en una rama WIP que no puede fusionarse completa.** Esa rama
   elimina respecto a `develop` `professional-visit-worklist.service.ts` (341
   líneas), parte de `visits.dto.ts` y 548 líneas de `visits.api.test.ts`. Un
   merge haría retroceder el módulo de visitas. Registrado en
   `spec/bitacora/decisiones/2026-08-25-auditoria-git-y-estado-de-ramas.md`; la
   decisión vigente es no ejecutar ninguna operación Git sin autorización del
   Product Owner. Riesgo: el trabajo se pierde si esa rama se borra.

2. **Las Task Specifications de `tasks/` afirman un estado que `develop` no
   tiene.** «Los 47 tests focales MP02 ya pasaron», «los 58 eventos de soporte
   existentes». Quien lea `tasks/` sin medir el código concluirá que MP02 está
   entregado. Riesgo de decisión equivocada sobre trabajo futuro.

3. **Tres aserciones de la prueba MP01 romperán cuando MP02 se integre.** La
   corrección está escrita (`3526c52`) y **no aplicada**. Líneas 1748-1750,
   1922-1924 y 2061-2068 de
   `apps/api/test/eloisa-admin-support-foundation.db.test.ts`.

4. **No existe forma autorizada de crear una capacidad ni una autorización.** El
   rol de ejecución solo tiene `SELECT` sobre ambas tablas y la migración no
   siembra filas. Es fail-closed —el estado seguro—, pero significa que integrar
   MP02 tampoco bastaría para conceder acceso a nadie: falta una Task de
   provisioning con su propia migración de privilegios.

5. **Nada evalúa el paso del tiempo.** El índice parcial de contexto abierto no
   caduca nada, y así lo declara el propio SQL. Sin MP02, un contexto expirado y
   no revocado bloquearía indefinidamente la apertura de otro. Hoy es inocuo
   porque no hay contextos; deja de serlo el día que los haya.

6. **`audit_event_resource_required` sin endurecer** para las 19 primitivas
   nuevas. Residual heredado, declarado en `migration.sql:576-592`, compartido
   con HOSPITAL-CORE-02, IDENTITY-RELATIONSHIPS-CORE-01 y VISITS-CORE-01.

7. **Ninguna auditoría independiente.** No hay `REVIEW-ELOISA-ADMIN-ACCESS-*` en
   `reviews/`. La capacidad más sensible de la plataforma —acceso cruzado entre
   instituciones— es una de las que no tiene revisión registrada.

8. **El rollback no se ha probado** y no puede ser completo: PostgreSQL no admite
   retirar valores de un enum. Los 19 valores de `AuditEventType` quedan para
   siempre.
