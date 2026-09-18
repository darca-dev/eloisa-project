# Investigación 016 - Acceso de soporte administrativo (fundación de datos)

Medido sobre `develop` (`6a54de9`) el 2026-08-25. Cada hallazgo indica el comando
o la ruta que lo respalda. Lo que no pudo comprobarse está en R14.

## R1. La capacidad tiene cuatro commits y **un solo** `feat()`

```text
git log --oneline -40
```

```text
3526c52 docs(admin): add MP01 MP02 test contract correction
8c36db9 docs(admin): add MP02 support services task
43bd6ad feat(admin): add support access data foundation
06bcc2b docs(admin): add MP01 support foundation task
```

Tres de cuatro son `docs()`. El único `feat()` es MP01 y toca exactamente los
cuatro archivos de su allowlist:

```text
git show --stat 43bd6ad
 apps/api/test/eloisa-admin-support-foundation.db.test.ts  | 2072 +
 .../20260825120000_eloisa_admin_access_01_mp01/migration.sql | 657 +
 prisma/migrations/ROLLBACK-eloisa_admin_access_01_mp01.sql   | 204 +
 prisma/schema.prisma                                          | 308 +-
```

## R2. MP02 no está implementado en `develop` — verificado por cuatro vías

1. `ls apps/api/src/support-access` → `No such file or directory`.
2. `grep -rn "SupportGrant\|supportGrant\|PlatformSupportCapability\|supportContextSession\|SupportPrincipal\|support-access" apps/api/src apps/web packages`
   → **cero resultados**.
3. `ls apps/api/test/` no contiene `support-access.service.db.test.ts`.
4. `grep -nE "Module," apps/api/src/app.module.ts` lista `DatabaseModule`,
   `HealthModule`, `PatientsModule`, `InstitutionalAuthModule`,
   `MunicipalityModule`, `HospitalModule`, `PeopleRelationshipsModule`,
   `IdentityAccessModule`, `HumanAuthModule`, `VisitsModule`. **No hay
   `SupportAccessModule`.**

No existe servicio, guard, contrato, módulo, DTO, cookie, endpoint, ruta OpenAPI
ni UI de soporte. `grep -rn "support" apps/api/src/openapi/` → vacío.

## R3. MP02 existe, pero fuera de esta rama

```text
git log --all --oneline -- '*support-access*'
6b0c74d wip(admin): preserve MP02 support services

git show --stat 6b0c74d
 apps/api/src/support-access/support-access.contract.ts |  401 +
 apps/api/src/support-access/support-access.module.ts   |   25 +
 apps/api/src/support-access/support-access.service.ts  |  838 +
 apps/api/src/support-access/support-context.guard.ts   |  187 +
 apps/api/test/support-access.service.db.test.ts        | 1960 +
```

```text
git branch -a --contains 6b0c74d
  remotes/origin/wip/eloisa-admin-mp02-20260825

git merge-base --is-ancestor 6b0c74d develop  →  falso
```

`spec/bitacora/decisiones/2026-08-25-auditoria-git-y-estado-de-ramas.md` registra
la razón de no fusionarla: la rama bifurcó antes del worklist del visitador y
**elimina** respecto a `develop` `professional-visit-worklist.service.ts` (341
líneas), buena parte de `visits.dto.ts` (331) y 548 líneas de
`visits.api.test.ts`. La decisión vigente es no ejecutar ninguna operación Git.

**Conclusión medida: MP02 está ESPECIFICADO y NO IMPLEMENTADO en `develop`.**

## R4. Modelos y enums añadidos

```text
grep -nE "^(model|enum) " prisma/schema.prisma
1399:enum PlatformSupportCapabilityStatus
1412:enum SupportGrantScope
1417:enum SupportGrantStatus
1438:model PlatformSupportCapability
1484:model SupportGrant
1550:model SupportContextSession
```

`SupportGrantScope` tiene **un único valor**, `HOSPITAL_OPERATIONAL_READ`
(`prisma/schema.prisma:1412-1414`). El comentario del esquema explica la
intención: no existe valor de escritura, clínica editable, finanzas, exportación
masiva, documento sensible, firma ni impersonación, «porque lo que la base no
puede nombrar, ningún servicio posterior puede conceder por descuido».

`PlatformSupportCapability` no tiene columna de credencial, sal, `subject` OIDC,
emisor ni rol institucional. Esa ausencia es estructural, no accidental
(`migration.sql:150-160`).

## R5. Aislamiento: el dueño RLS es el tenant **home**, no el objetivo

`migration.sql:626-631` aplica `ENABLE` + `FORCE ROW LEVEL SECURITY` a las tres
tablas. `migration.sql:644-657` crea tres políticas:

```sql
CREATE POLICY "platform_support_capability_home_tenant" ON "platform_support_capability"
  FOR SELECT TO "merdn_runtime" USING ("homeTenantId" = "merdn_current_tenant"());
CREATE POLICY "support_grant_home_tenant" ON "support_grant"
  FOR SELECT TO "merdn_runtime" USING ("homeTenantId" = "merdn_current_tenant"());
CREATE POLICY "support_context_session_home_tenant" ON "support_context_session"
  FOR ALL TO "merdn_runtime"
  USING ("homeTenantId" = "merdn_current_tenant"())
  WITH CHECK ("homeTenantId" = "merdn_current_tenant"());
```

Capacidad y autorización son `FOR SELECT`: ni siquiera existe una política que
pudiera admitir una escritura. Sin GUC, `merdn_current_tenant()` devuelve `NULL`
y la comparación no es verdadera: **falla cerrado**.

## R6. Mínimo privilegio — y su consecuencia no obvia

```text
grep -nE '^GRANT|^REVOKE' prisma/migrations/20260825120000_eloisa_admin_access_01_mp01/migration.sql
615:GRANT SELECT                 ON TABLE "platform_support_capability" TO "merdn_runtime";
616:GRANT SELECT                 ON TABLE "support_grant"               TO "merdn_runtime";
617:GRANT SELECT, INSERT, UPDATE ON TABLE "support_context_session"     TO "merdn_runtime";
```

Ninguna concede `DELETE`. Ninguna concede `TRUNCATE`, propiedad ni `BYPASSRLS`.

**Hallazgo derivado:** el rol de ejecución **no puede crear una capacidad ni una
autorización**. Además, `grep -niE '^INSERT|INSERT INTO' migration.sql` → vacío:
la migración no siembra ninguna fila. No hay endpoint, servicio, script ni seed
que las cree.

Por tanto, hoy **nadie tiene acceso de soporte y no existe camino aplicativo para
concedérselo**. La creación y revocación por Platform Owner/Admin exigiría su
propia Task y su propia migración de privilegios; ninguna existe.

## R7. Restricciones e índices que sostienen alcance, vigencia y unicidad

Medido con `grep -nE 'ADD CONSTRAINT|CREATE (UNIQUE )?INDEX|CREATE TRIGGER'`
sobre `migration.sql`:

| Regla | Objeto | Línea |
|---|---|---|
| Una capacidad por cuenta y tenant home | `platform_support_capability_account_unique` | 178 |
| Coherencia estado ↔ `disabledAt` | `platform_support_capability_status_timestamps` | 205 |
| `validUntil > validFrom` | `support_grant_validity_order` | 296 |
| Coherencia estado ↔ `revokedAt` | `support_grant_status_timestamps` | 301 |
| Una sola autorización `ACTIVE` equivalente (índice **parcial**) | `support_grant_active_unique` | 264 |
| Motivo 8..500 con recorte lógico | `support_context_session_reason_shape` | 402 |
| Ticket 1..120 | `support_context_session_ticket_shape` | 410 |
| `createdAt < expiresAt <= createdAt + 60 min` | `support_context_session_ttl` | 422 |
| `lastUsedAt` dentro de la ventana | `support_context_session_last_used_window` | 431 |
| Un contexto no revocado por cuenta (índice **parcial**) | `support_context_session_open_unique` | 365 |
| Inmutabilidad del contexto | trigger `support_context_session_immutable` | 451 / 478 |

El trigger (`migration.sql:451-480`) rechaza con `ERRCODE 42501` cualquier cambio
de `id`, `homeTenantId`, `humanAccountId`, `humanSessionId`, `supportGrantId`,
`targetTenantId`, `tokenHash`, `reason`, `ticketReference`, `createdAt` o
`expiresAt`, y prohíbe reescribir un `revokedAt` ya puesto. Solo `lastUsedAt` y
`revokedAt` mutan: la vigencia absoluta no se renueva usándola.

## R8. La base declara explícitamente lo que **no** finge

`migration.sql:358-364` y `prisma/schema.prisma:1550` (comentario del modelo)
advierten que el índice parcial **no evalúa el paso del tiempo**: un contexto
expirado pero no revocado sigue ocupando el hueco, y era MP02 quien debía
marcarlo dentro de transacción. Sin MP02, nada caduca nada. La honestidad está en
el código; la spec solo la recoge.

## R9. Extensión de auditoría: 19 primitivas y 5 columnas nullables

`migration.sql:98-131` ejecuta 19 `ALTER TYPE "AuditEventType" ADD VALUE IF NOT
EXISTS`, desde `PLATFORM_SUPPORT_CAPABILITY_CREATED` hasta
`SUPPORT_OPERATIONAL_AUDIT_READ_DENIED` (`prisma/schema.prisma:152-170`).

Se añaden cinco columnas nullables a `audit_event`: `actorHomeTenantId`,
`supportGrantId`, `supportContextSessionId`, `supportReason`,
`supportTicketReference` (`prisma/schema.prisma:618-631`).

`audit_event_support_provenance` (`migration.sql:543-559`) exige, cuando hay
procedencia de soporte: `actorType = 'HUMAN_ACCOUNT'`, `actorRole IS NULL`,
`actorUserId IS NOT NULL` y `actorHomeTenantId IS NOT NULL`. Es la barrera que
impide atribuir una lectura de soporte a una institución o a un rol hospitalario.

Las FKs de auditoría son `RESTRICT` / `NO ACTION` (`migration.sql:517-531`): la
evidencia no desaparece como efecto colateral de un borrado.

**Ninguna de esas columnas se escribe hoy:**
`grep -rn "actorHomeTenantId\|supportReason\|supportTicketReference" apps/api/src`
→ **cero**. Las 19 primitivas no se emiten nunca.

## R10. Riesgo residual declarado por la propia migración

`migration.sql:576-592` documenta que `audit_event_resource_required` sigue
expresado en forma negativa y por tanto admite las 19 primitivas nuevas sin
cambio. Endurecerlo con lista positiva es imposible en la misma transacción que
añade los valores del enum (PostgreSQL lo prohíbe); exigiría una migración
separada que **no existe**. Es el mismo residual ya declarado por
HOSPITAL-CORE-02, IDENTITY-RELATIONSHIPS-CORE-01 y VISITS-CORE-01 MP02/MP03.

## R11. Cambio aditivo sobre una tabla ajena

`migration.sql:145-146` crea `human_session_id_account_tenant_unique` sobre
`human_session (id, humanAccountId, tenantId)`. No restringe nada nuevo —`id` ya
era clave primaria— y existe únicamente para sostener la FK compuesta de
`support_context_session`. No se tocaron columnas, privilegios, políticas ni el
`FORCE RLS` de esa tabla. El rollback lo retira (`ROLLBACK-…:171`).

## R12. La prueba: forma, tamaño y su condición de salto

`apps/api/test/eloisa-admin-support-foundation.db.test.ts` — 2.072 líneas,
**62 casos `it`** en 13 grupos `describe`, numerados 0 a 12: rol runtime y RLS
forzada, capacidad nominativa, no confusión con Professional/Caregiver/identidad
institucional, autorización explícita, unicidad de autorización activa, contexto
temporal, unicidad de contexto abierto, aislamiento home y fail-closed, mínimo
privilegio, auditoría de soporte, append-only, FKs no destructivas y —grupo 12—
«existir estas filas NO concede ninguna capacidad de ejecución».

La suite entera está envuelta en
`describe.skipIf(!puedeEjecutarse)` (línea 267). Sin PostgreSQL **no falla: se
salta**. `apps/api/test/database-availability.ts` documenta esa política: una
ejecución sin base de datos jamás debe confundirse con una verificación
satisfactoria.

## R13. La corrección de contrato de pruebas está escrita y **no aplicada**

```text
git log --all --oneline -- apps/api/test/eloisa-admin-support-foundation.db.test.ts
43bd6ad feat(admin): add support access data foundation
```

Un solo commit: la corrección de `3526c52` nunca tocó el archivo. Las tres
aserciones que esa Task manda cambiar siguen presentes:

- línea 1748-1750 — `auditEvent.count({ where: { actorHomeTenantId: homeTenantId } })`
  esperado `0`;
- línea 1922-1924 — idéntica;
- línea 2061-2068 — `platformSupportCapability.count({ where: { id: { notIn: […] } } })`
  esperado `0`: afirma que no existe **ninguna otra** capacidad en toda la base.

Pasan hoy porque nada más escribe evidencia de soporte en `develop`. Romperán en
cuanto MP02 se integre y se ejecute. Deuda identificada, con Task escrita, sin
aplicar.

## R14. Las Task Specifications describen un estado que `develop` no tiene

`tasks/ELOISA-ADMIN-ACCESS-01-MP02-TEST-CONTRACT-CORRECTION.md` §2 afirma «los
cinco archivos runtime MP02 permanecen exactamente como están», «los 47 tests
focales MP02 ya pasaron» y «los 58 eventos de soporte existentes». Eso describe
otra copia de trabajo y la rama WIP. Leer `tasks/` sin medir el código llevaría a
concluir que MP02 está entregado. **No lo está en esta rama.**

## R15. Aprovisionamiento de la cuenta administradora: inexistente

`grep -rn "eloisa-admin-local"` fuera de `spec/` solo aparece en las Task
Specifications, y siempre como «fuera de alcance». No hay usuario, cliente ni rol
correspondiente en `infra/local-oidc/realm-merdn-local.json`, ni en
`tools/identity-provisioning/`.

## R16. Dependencias verificadas

- `merdn_current_tenant()` existe desde `20260822130000_municipality_core_01` y
  el endurecimiento CORE-01; MP01 la reutiliza sin redefinirla.
- `human_account` y `human_session` se crean en
  `20260823120000_identity_relationships_core_01/migration.sql:131` y `:233`.
- `PrismaService.withTenant()` y `PrismaService.enterRuntimeContext()` existen en
  `apps/api/src/database/prisma.service.ts:130` y `:148`. Son el primitivo que
  MP02 usaría para el cambio home→objetivo dentro de transacción. Hoy **ningún
  código de soporte los llama**.
- `HumanPrincipal` existe en `apps/api/src/identity-access/human-principal.ts`.

## R17. Rollback

`prisma/migrations/ROLLBACK-eloisa_admin_access_01_mp01.sql`, 204 líneas. Retira
restricciones y columnas de `audit_event`, políticas, trigger y función, las tres
tablas, los tres tipos enumerados y el índice de `human_session`. Deja constancia
(línea 33) de lo único que PostgreSQL no permite deshacer: `ALTER TYPE … DROP
VALUE` no existe, de modo que los 19 valores del enum permanecen.

## R18. Verificación no ejecutada

No se ejecutó **nada** de lo siguiente, y no se afirma su resultado:

- `npx vitest run … test/eloisa-admin-support-foundation.db.test.ts` — no se
  ejecutó: `node_modules` ausente y PostgreSQL no levantado. Además, sin base de
  datos la suite se **salta** entera (`describe.skipIf`, línea 267), de modo que
  una ejecución en estas condiciones no sería evidencia.
- `npx prisma validate` — no ejecutado, misma razón.
- La aplicación real de `20260825120000_eloisa_admin_access_01_mp01` contra una
  PostgreSQL viva y la comprobación de `relrowsecurity` / `relforcerowsecurity`
  en `pg_class`. Todo lo afirmado sobre RLS, privilegios, restricciones y
  triggers se leyó del SQL fuente, no de una base en marcha.
- El rollback no se ejecutó ni se verificó su reversibilidad real.
- Los 62 casos de la prueba se contaron por `grep -cE "^\s*it\("`; no se sabe
  cuántos pasan.
- No se inspeccionó el contenido funcional de `6b0c74d` más allá de su `--stat`
  y las primeras 60 líneas del servicio: se documenta **que existe y dónde**, no
  que sea correcto.
