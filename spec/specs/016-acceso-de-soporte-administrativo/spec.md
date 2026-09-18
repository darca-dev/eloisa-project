# Especificación 016 - Acceso de soporte administrativo (fundación de datos)

## Estado de aprobación / Approval status

- Estado / Status: `Pendiente`
- Valores permitidos / Allowed values: `Pendiente` o `Aprobado` (`Pending` or `Approved`)
- Fecha de aprobación / Approval date: `YYYY-MM-DD`
- Aprobado por / Approved by: `Nombre o rol`
- Evidencia de aprobación / Approval evidence:
<!-- Spec as-built: aprobar = confirmar que describe fielmente lo construido. -->

## Naturaleza de esta spec

**As-built.** Task Specifications:
`tasks/ELOISA-ADMIN-ACCESS-01-MP01-DATA-FOUNDATION.md`,
`tasks/ELOISA-ADMIN-ACCESS-01-MP02-SUPPORT-SERVICES-GUARDS.md` y
`tasks/ELOISA-ADMIN-ACCESS-01-MP02-TEST-CONTRACT-CORRECTION.md`.

**No existe auditoría de Codex para esta capacidad.** `ls reviews/` no contiene
ningún `REVIEW-ELOISA-ADMIN-ACCESS-*`. Las tres Task Specifications se
escribieron y una se implementó sin que quedara registrada una revisión
independiente. Esa ausencia es un dato de la capacidad, no un olvido de esta
spec.

**De los tres micropaquetes documentados, solo uno vive en `develop`.** MP01
está implementado (`43bd6ad`). MP02 tiene Task Specification (`8c36db9`) y una
corrección de contrato de pruebas (`3526c52`), pero **ningún commit `feat()` en
`develop` lo implementa**: `apps/api/src/support-access/` no existe en esta rama.
El detalle y la evidencia están en la sección «Estado real y límites conocidos» y
en `research.md` R6–R8.

## Objetivo

Que la plataforma pueda **nombrar** —en PostgreSQL, con aislamiento por tenant y
mínimo privilegio— la capacidad administrativa de soporte de una cuenta humana
concreta, la autorización explícita sobre **una** institución, la ventana
temporal acotada en la que esa autorización se ejerce y la traza de auditoría
que la hace legible; y que ese modelo, por sí solo, **no conceda ningún acceso**.

Lo que la base no puede nombrar, ningún servicio posterior puede conceder por
descuido. Ése es el valor entregado: la forma del permiso existe antes que el
permiso.

## Historia de usuario principal

Como responsable de la plataforma, quiero que el acceso de soporte a los datos de
otra institución quede registrado como una autorización nominativa, acotada a un
tenant, con vigencia, motivo y traza de auditoría, para que ninguna persona
administradora pueda ver una institución sin que exista una fila que lo autorice
y un evento que lo registre.

## Qué hace hoy el sistema

| Qué | Dónde | Estado |
|---|---|---|
| Enum `PlatformSupportCapabilityStatus` (`ACTIVE`, `DISABLED`) | `prisma/schema.prisma:1399` | Implementado |
| Enum `SupportGrantScope` con un único valor `HOSPITAL_OPERATIONAL_READ` | `prisma/schema.prisma:1412` | Implementado |
| Enum `SupportGrantStatus` (`ACTIVE`, `REVOKED`) | `prisma/schema.prisma:1417` | Implementado |
| Modelo `PlatformSupportCapability` (capacidad nominativa por cuenta y tenant home) | `prisma/schema.prisma:1438` | Implementado |
| Modelo `SupportGrant` (autorización explícita sobre un tenant objetivo) | `prisma/schema.prisma:1484` | Implementado |
| Modelo `SupportContextSession` (ventana temporal con token hasheado y motivo) | `prisma/schema.prisma:1550` | Implementado |
| 19 primitivas nuevas de `AuditEventType` para soporte | `prisma/schema.prisma:152-170` | Implementado |
| 5 columnas nullables de procedencia de soporte en `AuditEvent` | `prisma/schema.prisma:618-631` | Implementado |
| Migración aditiva de 657 líneas | `prisma/migrations/20260825120000_eloisa_admin_access_01_mp01/migration.sql` | Implementada |
| Rollback explícito de 204 líneas | `prisma/migrations/ROLLBACK-eloisa_admin_access_01_mp01.sql` | Implementado |
| `ENABLE` + `FORCE ROW LEVEL SECURITY` en las tres tablas | `migration.sql:626-631` | Implementado |
| Tres políticas RLS por tenant **home** | `migration.sql:644-657` | Implementado |
| Mínimo privilegio: `SELECT` en capacidad y autorización; `SELECT/INSERT/UPDATE` en contexto; **nunca `DELETE`** | `migration.sql:615-617` | Implementado |
| Índice parcial: una sola autorización `ACTIVE` equivalente | `migration.sql:264` | Implementado |
| Índice parcial: un solo contexto no revocado por cuenta | `migration.sql:365` | Implementado |
| Restricción de TTL absoluto `expiresAt <= createdAt + 60 min` | `migration.sql:422` | Implementada |
| Restricciones de forma de `reason` (8..500) y `ticketReference` (1..120) | `migration.sql:402`, `migration.sql:410` | Implementadas |
| Trigger de inmutabilidad del contexto (solo `lastUsedAt` y `revokedAt` mutan) | `migration.sql:451`, `migration.sql:478` | Implementado |
| `CHECK audit_event_support_provenance` (actor humano, `actorRole` nulo, tenant home presente) | `migration.sql:543` | Implementado |
| Prueba PostgreSQL de la fundación: 62 casos en 13 grupos | `apps/api/test/eloisa-admin-support-foundation.db.test.ts` (2.072 líneas) | Escrita, **no ejecutada aquí** |
| Servicio, guard, contrato y módulo de soporte | — | **No existen en `develop`** |
| Endpoint, cookie de soporte, selector de institución, UI | — | **No existen** |

**El sistema no concede hoy ningún acceso de soporte.** Existe la forma; no
existe el mecanismo. Ninguna lectura Hospital pasa por estas filas.

## Dependencias

| Spec | Qué aporta | Por qué es necesaria |
|---|---|---|
| 001-fundacion-tecnica-monorepo | Monorepo, Prisma, PostgreSQL, Compose, validación de entorno | Sin esquema ni base no hay tabla que proteger ni migración que aplicar |
| 007-inscripcion-paciente-persistente | Tenant resuelto en servidor, RLS desde el primer dato, `merdn_current_tenant()`, `audit_event` append-only y sus triggers | Las tres tablas nuevas replican ese patrón y la auditoría de soporte extiende **esa misma** tabla sin tocar su append-only |
| 011-identidad-humana-y-relaciones | `HumanAccount`, `HumanSession`, `ExternalAuthIdentity`, OIDC y `HumanPrincipal` (`apps/api/src/identity-access/human-principal.ts`) | La capacidad es **nominativa** sobre una cuenta humana ya autenticada; el contexto referencia su sesión mediante FK compuesta. MP01 añadió sobre `human_session` el índice único `human_session_id_account_tenant_unique` (`migration.sql:145`) solo para sostener esa FK |
| 009-hospital-pacientes-api | Superficie de Pacientes | Es una de las cinco superficies que el alcance `HOSPITAL_OPERATIONAL_READ` nombra; hoy ninguna se lee desde soporte |
| 010-hospital-profesionales-agenda-api | Superficies de Profesionales y Agenda | Ídem |
| 012-visitas-domiciliarias | Superficie de Visitas domiciliarias (`HomeVisit`) | Ídem |
| 008-agregados-municipales-protegidos | Precedente de `merdn_runtime`, políticas y fail-closed sin GUC | El patrón de mínimo privilegio que MP01 reutiliza sin debilitarlo |

**Dependencias externas:**

- **PostgreSQL** en marcha, con el rol `merdn_runtime` no superusuario, sin
  `BYPASSRLS` y sin propiedad de tabla.
- **Keycloak / OIDC local** (`infra/local-oidc/realm-merdn-local.json`) para la
  autenticación humana que precede a cualquier soporte. MP01 no la toca.
- **Migraciones concretas:** `20260821120000_core_01_init` y
  `20260822120000_core_01_hardening` (RLS, `merdn_current_tenant()`,
  `audit_event`), `20260823120000_identity_relationships_core_01`
  (`human_account`, `human_session`), y la propia
  `20260825120000_eloisa_admin_access_01_mp01`.
- `PrismaService.withTenant()` y `PrismaService.enterRuntimeContext()`
  (`apps/api/src/database/prisma.service.ts:130`, `:148`) — existen y son el
  primitivo que MP02 usaría; hoy ningún código de soporte los llama.

**Specs que dependen de esta:** ninguna. Ningún otro módulo, spec o superficie
consume `PlatformSupportCapability`, `SupportGrant` ni `SupportContextSession`.

## Escenarios de aceptación

1. Dado un rol de ejecución `merdn_runtime` sin contexto de tenant fijado,
   cuando consulta `platform_support_capability`, `support_grant` o
   `support_context_session`, entonces no obtiene ninguna fila, porque
   `merdn_current_tenant()` devuelve `NULL` y la política no deja pasar nada.
2. Dado un tenant home A activo, cuando consulta capacidades y autorizaciones,
   entonces ve exclusivamente las suyas y las de un tenant home B se comportan
   como inexistentes.
3. Dada una cuenta humana del tenant B, cuando se intenta crear una capacidad
   bajo el tenant home A, entonces la clave foránea compuesta contra
   `human_account(id, tenantId)` lo rechaza.
4. Dada una capacidad con una autorización `ACTIVE` para un tenant objetivo y un
   alcance, cuando se intenta crear una segunda equivalente, entonces el índice
   parcial `support_grant_active_unique` la rechaza; tras revocar la primera, la
   nueva se admite y la anterior se conserva.
5. Dado un contexto de soporte, cuando se intenta crearlo con
   `expiresAt > createdAt + 60 minutos`, entonces la restricción
   `support_context_session_ttl` lo rechaza.
6. Dado un contexto ya creado, cuando se intenta alargar `expiresAt` o cambiar
   autorización, tenant objetivo, cuenta, sesión, token o motivo, entonces el
   trigger `support_context_session_immutable` lo rechaza con `ERRCODE 42501`.
7. Dado un contexto ya revocado, cuando se intenta reescribir `revokedAt`,
   entonces el mismo trigger lo rechaza: un contexto cerrado no se reabre.
8. Dado un evento de auditoría con procedencia de soporte, cuando se atribuye a
   una identidad institucional o lleva `actorRole`, entonces
   `audit_event_support_provenance` lo rechaza.
9. Dado un evento de auditoría que nombra una autorización y un contexto, cuando
   se intenta borrar esa autorización o ese contexto, entonces las claves
   foráneas `NO ACTION`/`RESTRICT` lo impiden y la evidencia se conserva.
10. Dada una capacidad, una autorización `ACTIVE` y un contexto vigente para el
    tenant objetivo T, cuando el sistema opera bajo el tenant home, entonces
    pacientes, profesionales, citas, visitas y auditoría de T siguen sin ser
    visibles: existir estas filas no es una llave de ejecución.

## Criterios de aceptación (formato EARS recomendado)

- EL SISTEMA DEBERÁ mantener `ENABLE ROW LEVEL SECURITY` y
  `FORCE ROW LEVEL SECURITY` sobre `platform_support_capability`,
  `support_grant` y `support_context_session`.
- CUANDO no exista contexto de tenant (`merdn.tenant_id` sin fijar), ENTONCES EL
  SISTEMA DEBERÁ no devolver ninguna fila de esas tres tablas — falla **cerrado**,
  no abierto.
- EL SISTEMA DEBERÁ validar capacidad, autorización y contexto bajo el tenant
  **home** de la cuenta administrativa, nunca bajo el tenant objetivo.
- EL SISTEMA NO DEBERÁ conceder al rol `merdn_runtime` privilegio de `INSERT`,
  `UPDATE` ni `DELETE` sobre `platform_support_capability` ni `support_grant`:
  crear o revocar una autorización es un acto administrativo que ninguna Task ha
  autorizado todavía.
- EL SISTEMA NO DEBERÁ conceder `DELETE` sobre ninguna de las tres tablas: una
  autorización y un contexto se **revocan**, no se borran.
- EL SISTEMA DEBERÁ ofrecer un único alcance, `HOSPITAL_OPERATIONAL_READ`, sin
  ningún valor de escritura, clínica editable, finanzas, exportación,
  documento sensible, firma ni impersonación.
- SI una autorización `ACTIVE` equivalente ya existe para la misma capacidad,
  tenant objetivo y alcance, ENTONCES EL SISTEMA DEBERÁ rechazar la segunda.
- SI una cuenta ya tiene un contexto no revocado, ENTONCES EL SISTEMA DEBERÁ
  rechazar la apertura de un segundo.
- CUANDO se declare vigencia con `validFrom` y `validUntil`, EL SISTEMA DEBERÁ
  exigir `validUntil > validFrom`.
- CUANDO se cree un contexto de soporte, EL SISTEMA DEBERÁ exigir
  `createdAt < expiresAt <= createdAt + 60 minutos`, y `lastUsedAt` dentro de esa
  ventana cuando exista.
- EL SISTEMA DEBERÁ exigir motivo con al menos 8 caracteres no vacíos y como
  máximo 500, y ticket opcional de 1 a 120 caracteres.
- EL SISTEMA NO DEBERÁ persistir jamás el token de contexto en claro: solo su
  hash, único y distinto del de `HumanSession`.
- EL SISTEMA NO DEBERÁ permitir modificar `id`, `homeTenantId`,
  `humanAccountId`, `humanSessionId`, `supportGrantId`, `targetTenantId`,
  `tokenHash`, `reason`, `ticketReference`, `createdAt` ni `expiresAt` de un
  contexto existente.
- CUANDO un evento de auditoría lleve procedencia de soporte, EL SISTEMA DEBERÁ
  exigir `actorType = HUMAN_ACCOUNT`, `actorRole` nulo, `actorUserId` presente y
  `actorHomeTenantId` presente; y DEBERÁ registrar en `tenantId` el tenant
  **objetivo** auditado.
- EL SISTEMA NO DEBERÁ registrar en auditoría nombre, documento, emisor OIDC,
  `subject`, token, hash, cookie, cuerpo, filtro ni dato clínico.
- CUANDO exista evidencia de auditoría que nombre una autorización o un
  contexto, EL SISTEMA DEBERÁ impedir su borrado (`RESTRICT`/`NO ACTION`).
- EL SISTEMA NO DEBERÁ conceder acceso al tenant objetivo por la mera existencia
  de capacidad, autorización y contexto vigentes.

## Ámbito de archivos / File scope

- `prisma/schema.prisma` — enums `PlatformSupportCapabilityStatus`,
  `SupportGrantScope`, `SupportGrantStatus`; modelos
  `PlatformSupportCapability`, `SupportGrant`, `SupportContextSession`;
  extensión aditiva de `AuditEventType` y `AuditEvent`
- `prisma/migrations/20260825120000_eloisa_admin_access_01_mp01/migration.sql` —
  657 líneas: tablas, índices parciales, restricciones, trigger de
  inmutabilidad, procedencia de auditoría, privilegios mínimos, RLS y políticas
- `prisma/migrations/ROLLBACK-eloisa_admin_access_01_mp01.sql` — 204 líneas;
  advierte que PostgreSQL no admite retirar valores de un enum
- `apps/api/test/eloisa-admin-support-foundation.db.test.ts` — 2.072 líneas,
  62 casos, PostgreSQL real, `describe.skipIf` cuando la base no responde
- `tasks/ELOISA-ADMIN-ACCESS-01-MP01-DATA-FOUNDATION.md` — Task Specification
  ejecutada
- `tasks/ELOISA-ADMIN-ACCESS-01-MP02-SUPPORT-SERVICES-GUARDS.md` — Task
  Specification **no ejecutada en `develop`**
- `tasks/ELOISA-ADMIN-ACCESS-01-MP02-TEST-CONTRACT-CORRECTION.md` — corrección
  de pruebas **no aplicada en `develop`**
- `spec/bitacora/decisiones/2026-08-25-auditoria-git-y-estado-de-ramas.md` —
  registro que sitúa MP02 fuera de esta rama

## Estado real y límites conocidos

**Esta es la sección que decide si la spec sirve. Léase entera.**

### 1. MP02 está especificado y NO implementado en `develop`

- `apps/api/src/support-access/` **no existe**:
  `ls apps/api/src/support-access` → `No such file or directory`.
- `grep -rn "SupportGrant|supportGrant|PlatformSupportCapability|SupportContextSession|SupportPrincipal|support-access" apps/api/src apps/web packages`
  devuelve **cero resultados**.
- `apps/api/src/app.module.ts` no importa ningún `SupportAccessModule`.
- `apps/api/test/support-access.service.db.test.ts` **no existe** en esta rama.

Queda por construir, exactamente: el contrato (`support-access.contract.ts`), el
servicio de ciclo de vida del contexto (`support-access.service.ts`), el guard
(`support-context.guard.ts`), el módulo (`support-access.module.ts`) y su prueba
PostgreSQL. Es decir: **la apertura de contexto, su validación, su caducidad por
TTL e inactividad, su salida explícita, la cookie de soporte, el
`SupportPrincipal` y la escritura atómica de auditoría no existen.**

### 2. Dónde está realmente MP02

En la rama `origin/wip/eloisa-admin-mp02-20260825`, commit `6b0c74d`
(«wip(admin): preserve MP02 support services»), con 5 archivos y 3.411 líneas.
`git merge-base --is-ancestor 6b0c74d develop` → **falso**: no forma parte de
`develop`.

`spec/bitacora/decisiones/2026-08-25-auditoria-git-y-estado-de-ramas.md` registra
por qué no se ha fusionado: esa rama bifurcó antes del worklist del visitador y
**elimina** respecto a `develop` `professional-visit-worklist.service.ts` (341
líneas), buena parte de `visits.dto.ts` y 548 líneas de `visits.api.test.ts`. Un
merge completo haría retroceder el módulo de visitas. La decisión vigente es no
ejecutar ninguna operación Git hasta autorización del Product Owner.

### 3. Las tres Task Specifications describen un estado que `develop` no tiene

`ELOISA-ADMIN-ACCESS-01-MP02-TEST-CONTRACT-CORRECTION.md` afirma que «los 47
tests focales MP02 ya pasaron» y que existen «58 eventos de soporte». Eso
describe la base local de otra copia de trabajo y la rama WIP, **no el código de
`develop`**. Una lectura desprevenida de `tasks/` concluiría que MP02 está
entregado. No lo está aquí.

### 4. La corrección de contrato de pruebas no se aplicó

`git log --all --oneline -- apps/api/test/eloisa-admin-support-foundation.db.test.ts`
devuelve **un único commit**, `43bd6ad`. Las tres aserciones que la corrección
manda cambiar siguen escritas tal cual:

- `apps/api/test/eloisa-admin-support-foundation.db.test.ts:1748-1750` —
  `auditEvent.count({ where: { actorHomeTenantId: homeTenantId } })` esperado `0`;
- `apps/api/test/eloisa-admin-support-foundation.db.test.ts:1922-1924` — idéntica;
- `apps/api/test/eloisa-admin-support-foundation.db.test.ts:2061-2068` —
  `platformSupportCapability.count({ where: { id: { notIn: sembrado } } })`
  esperado `0`, que afirma que ninguna otra capacidad existe en toda la base.

Hoy pasan sobre una base limpia porque nada más escribe evidencia de soporte. En
cuanto MP02 se integre y se ejecute, romperán. **La deuda está identificada, con
su Task escrita, y sin aplicar.**

### 5. No existe forma autorizada de crear una capacidad ni una autorización

`migration.sql:615-616` concede al rol de ejecución **solo `SELECT`** sobre
`platform_support_capability` y `support_grant`. La migración no inserta ninguna
fila (`grep -niE '^INSERT|INSERT INTO'` → vacío). No existe endpoint, servicio,
script ni seed que las cree.

Consecuencia medida: **hoy nadie tiene acceso de soporte, y no hay camino
aplicativo para concedérselo.** El sistema falla cerrado por ausencia. La
creación y revocación por Platform Owner/Admin es trabajo futuro sin Task
escrita, y exigiría además su propia migración de privilegios.

### 6. Tampoco existe el aprovisionamiento de la cuenta administradora

`eloisa-admin-local` aparece únicamente como «fuera de alcance» en las Task
Specifications. No hay usuario, cliente ni rol correspondiente en
`infra/local-oidc/realm-merdn-local.json`, ni en `tools/identity-provisioning/`.

### 7. Las columnas de auditoría de soporte no las escribe nadie

`grep -rn "actorHomeTenantId|supportReason|supportTicketReference" apps/api/src`
→ **cero**. `apps/api/src/audit/audit.service.ts` no expone forma de rellenarlas.
Las 19 primitivas nuevas de `AuditEventType` **no se emiten nunca**.

### 8. Riesgo residual heredado y declarado en la propia migración

`migration.sql:576-592` documenta que `audit_event_resource_required` sigue
expresado en forma negativa: las 19 primitivas nuevas no figuran en su lista y
por tanto el check no les exige `resourceId`. Endurecerlo con lista positiva es
imposible en la misma transacción que añade los valores del enum; exige una
migración posterior que **no existe**. Es el mismo residual ya declarado por
HOSPITAL-CORE-02, IDENTITY-RELATIONSHIPS-CORE-01 y VISITS-CORE-01.

### 9. Lo que la base deliberadamente no finge

El propio esquema lo dice (`prisma/schema.prisma:1550` y siguientes): ningún
índice evalúa el paso del tiempo. Un contexto **expirado pero no revocado** sigue
ocupando el hueco del índice parcial `support_context_session_open_unique`. La
caducidad efectiva y el corte por 15 minutos de inactividad los evaluaría MP02
dentro de transacción. Sin MP02, **nada caduca nada**.

### 10. Sin interfaz

No hay selector de institución, ni banner de contexto de soporte, ni indicador
visual, ni ruta en `apps/web`. La palabra «soporte» en `apps/web` corresponde a
otras superficies (financiera, municipal), no a esta capacidad.

### 11. Las pruebas no se ejecutaron al escribir esta spec

`node_modules` ausente y PostgreSQL no levantado. Además, el archivo entero está
envuelto en `describe.skipIf(!puedeEjecutarse)`
(`apps/api/test/eloisa-admin-support-foundation.db.test.ts:267`): sin base de
datos **no falla, se salta**. Una ejecución sin PostgreSQL no es evidencia de
nada.

## Criterios de éxito

- El modelo de soporte existe en PostgreSQL con RLS forzada, políticas por tenant
  home y mínimo privilegio verificable sobre `information_schema`.
- Ninguna combinación de capacidad, autorización y contexto abre por sí sola una
  institución: verificable hoy porque **ningún código los consume**.
- El rollback retira exclusivamente los objetos de MP01 y deja constancia de lo
  único que PostgreSQL no permite deshacer: los valores de enum.
- `eloisa-admin-support-foundation.db.test.ts` pasa contra PostgreSQL real, con
  cero saltados. **Pendiente de ejecutar.**
- La spec declara, sin rodeos, que MP02 está especificado y no implementado en
  `develop`, y dónde está realmente.
