# Especificación 028 — Completar Identidad Humana y Relaciones (Spec 011 Gaps)

**Número**: 028
**Slug**: `identidad-humana-completar`
**Estado**: `Aprobado` (consentido 2026-09-19)
**Prioridad**: Alta
**Owner**: Product Owner
**Fecha**: 2026-09-19
**Basada en**: Spec 011 (as-built) — `011-identidad-humana-y-relaciones`

---

## 1. Contexto y Objetivo

### 1.1 Problema
La **Spec 011** (`011-identidad-humana-y-relaciones`) es una spec *as-built* que documenta la implementación de identidad humana y relaciones paciente-cuidador. En su sección "Estado real y límites conocidos" documenta **15 gaps** que dejan la capacidad incompleta para uso real:

| # | Gap | Impacto |
|---|-----|---------|
| 1 | **Sin UI para cuidador** — `canCaregiverViewVisits()` existe pero ningún módulo la consume | Cuidadores no pueden ver visitas |
| 2 | **`EXPIRED` nunca se escribe** — solo se deriva en query via `endsAt` | Estado `ACTIVE` persiste indefinidamente |
| 3 | **Resolutores duplicados en Visitas** — no usan `IdentityAccessService` | Lógica duplicada, riesgo de divergencia |
| 4 | **Sin test OIDC happy-path** — solo fallos probados | Login real no verificado automatizado |
| 5 | **Garantías BD sin test** — exclusion constraint, trigger, RLS | Base no verificada |
| 6 | **Rate limit en memoria** — no protege multi-instancia | Vulnerabilidad en producción |
| 7 | **Sin endpoints de listado** — solo GET por ID | Gestor no puede enumerar relaciones |
| 8 | **Entra External ID no integrado** — solo Keycloak local | Bloqueo para producción |
| 9 | **Return target hardcoded a `/`** — allowlist de 1 elemento | No se puede volver a página origen |
| 10 | **Provisioning tests sin PostgreSQL** — solo memoria | No verifica garantías motor |
| 11 | **Tests saltan sin BD** — `describe.skipIf` | CI verde sin probar nada |
| 12 | **Sin UI para gestión relaciones** — solo API | Gestor no tiene interfaz |
| 13 | **Validación = aserción operador** — sin evidencia legal | Insuficiente para datos reales |
| 14 | **Identidad institucional compartida** — no personal | Auditoría no identifica a persona |
| 15 | **Solo datos ficticios/controlados** — sin datos reales | No listo para producción |

### 1.2 Objetivo
Cerrar los **gaps priorizados** para que la identidad humana y relaciones paciente-cuidador sea **usable en producción** (MVP real, no solo demo).

### 1.3 Alcance (In-Scope / Out-of-Scope)

| In-Scope (MVP) | Out-of-Scope (Post-MVP) |
|----------------|-------------------------|
| 1. Escritura de estado `EXPIRED` (job o trigger) | Entra External ID integration |
| 2. Refactor Visitas → `IdentityAccessService` | UI completa cuidador (pantalla completa) |
| 3. Test OIDC happy-path (Keycloak local) | Rate limit distribuido (Redis) |
| 4. Tests BD: exclusion constraint, trigger, RLS | Endpoints de listado relaciones |
| 5. Rate limit → Redis (o documentar limitación) | Entra External ID |
| 6. Job limpieza `HumanAuthAttempt` | Return target dinámico |
| 7. Tests provisioning contra PostgreSQL real | UI gestión relaciones completa |
| 8. Tests no saltan sin BD (fail o mock DB) | Evidencia legal / validación real |
| 9. Documentar limitaciones institucionales | Identidad institucional personal |

---

## 2. Usuarios, Roles, Instituciones, Tenants

| Actor | Rol | Tenant | Acción |
|-------|-----|--------|--------|
| Paciente | `PATIENT` (contexto humano) | `merdn-mvp` | Autenticarse, ver sus datos |
| Profesional | `PROFESSIONAL` | `merdn-mvp` | Ver worklist, transicionar visitas |
| Cuidador | `CAREGIVER` (vía relación) | `merdn-mvp` | Ver visitas (gap #1) |
| Operador institucional | `CAREGIVER_RELATIONSHIP_MANAGER` | `merdn-mvp` | Crear/activar/revocar relaciones |
| Sistema | `SYSTEM` (job) | `merdn-mvp` | Expirar relaciones, limpiar intentos |

---

## 3. Requisitos Funcionales (por Gap)

### RF-01: Estado `EXPIRED` materializado
- **Qué**: Job nocturno (o trigger) que actualice `status = 'EXPIRED'` donde `endsAt < NOW()` y `status = 'ACTIVE'`
- **Dónde**: `apps/api/src/people-relationships/` + job scheduler
- **Test**: Relación con `endsAt` ayer → `status = 'EXPIRED'` tras job

### RF-02: Visitas usan `IdentityAccessService`
- **Qué**: Refactor `professional-visit-query.service.ts`, `professional-visit-worklist.service.ts`, `home-visit-transition.service.ts` para usar `IdentityAccessService.resolveProfessional()` y `hasActiveAssignmentOverPatient()`
- **Dónde**: `apps/api/src/visits/`
- **Test**: Mismo resultado, pero código usa servicio compartido

### RF-03: Test OIDC Happy-Path
- **Qué**: Test automatizado contra Keycloak local: login → callback → sesión → `GET /human-auth/session` → contextos
- **Dónde**: `apps/api/test/human-auth.api.test.ts` (nuevo test no skip)
- **Req**: Keycloak local corriendo en CI

### RF-04: Tests BD Garantías
- **Qué**: Tests que verifiquen:
  - Exclusion constraint `patient_caregiver_relationship_active_overlap` (btree_gist)
  - Trigger `prevent_self_caregiver_relationship`
  - RLS policies en 6 tablas
  - Grants sin DELETE
- **Dónde**: `apps/api/test/identity-relationships-db.test.ts` (nuevo)

### RF-05: Rate Limit → Redis (o documentar)
- **Qué**: Migrar `human-auth-rate-limit.guard.ts` a Redis store, o documentar limitación MVP
- **Decisión PO**: ¿Redis ahora o documentar?

### RF-06: Limpieza `HumanAuthAttempt`
- **Qué**: Job periódico que borre intentos `consumedAt IS NOT NULL` o `expiresAt < NOW() - 24h`
- **Dónde**: Job scheduler + `apps/api/src/human-auth/`

### RF-07: Tests Provisioning → PostgreSQL
- **Qué**: `tools/identity-provisioning/src/operations.test.ts` contra BD real (no memoria)
- **Dónde**: `tools/identity-provisioning/`

### RF-08: Tests no saltan sin BD
- **Qué**: Quitar `describe.skipIf(!puedeEjecutarse)` → fail explícito si no hay BD
- **Dónde**: `apps/api/test/eloisa-admin-support-foundation.db.test.ts`, `human-auth.api.test.ts`

---

## 4. Datos, Seguridad, Auditoría

| Dato | Origen | Destino | Sensibilidad |
|------|--------|---------|--------------|
| `patient_caregiver_relationship.status` | Job/Trigger | BD | Media |
| `human_auth_attempt` (limpieza) | Scheduler | BD | Baja (hashes) |
| `audit_event` (EXPIRED, limpieza) | Job/Sistema | BD | Baja (opaco) |

**Seguridad**:
- Rate limit → Redis (RF-05)
- Limpieza intentos evita crecimiento monótono
- Jobs corren con rol `merdn_runtime` + tenant fijo

**Auditoría** (eventos existentes):
- `CAREGIVER_RELATIONSHIP_REVOKED` (ya existe)
- `HUMAN_AUTH_ATTEMPT_CLEANED` (nuevo, opcional)
- `RELATIONSHIP_EXPIRED` (nuevo, si se audita expiración)

---

## 5. Dependencias

| Spec | Qué aporta |
|------|------------|
| 001 | Prisma, PostgreSQL, Compose, `merdn_runtime`, RLS |
| 007 | `Person`, `Patient`, `Tenant`, `AuditEvent`, `merdn_current_tenant()` |
| 008 | `InstitutionalIdentity`, `InstitutionalSession`, `CAREGIVER_RELATIONSHIP_MANAGER` |
| 009 | `HOSPITAL_PATIENT_VIEWER` (roles disjuntos) |
| 010 | `ProfessionalProfile`, `ProfessionalAffiliation`, `CareAssignment` |

---

## 6. Criterios de Aceptación (EARS)

| ID | Criterio |
|----|----------|
| CA-01 | CUANDO `endsAt < NOW()` Y `status = 'ACTIVE'`, ENTONCES job nocturno DEBERÁ actualizar a `'EXPIRED'` |
| CA-02 | CUANDO Visitas resuelva profesional, ENTONCES DEBERÁ usar `IdentityAccessService` y NO consultas propias |
| CA-03 | CUANDO test OIDC happy-path se ejecute contra Keycloak local, ENTONCES login → callback → sesión → contextos DEBERÁ pasar |
| CA-04 | CUANDO se intente crear relación `ACTIVE` solapada, ENTONCES exclusion constraint DEBERÁ rechazarla (test BD) |
| CA-05 | CUANDO se intente autorrelación, ENTONCES trigger DEBERÁ rechazarla (test BD) |
| CA-06 | CUANDO RLS activo, ENTONCES tenant A no ve relaciones tenant B (test BD) |
| CA-07 | CUANDO rate limit excedido, ENTONCES Redis DEBERÁ bloquear (si RF-05 implementado) |
| CA-08 | CUANDO `HumanAuthAttempt` expirado/consumido > 24h, ENTONCES job DEBERÁ borrarlo |
| CA-09 | CUANDO test provisioning corra, ENTONCES DEBERÁ usar PostgreSQL real (no memoria) |
| CA-10 | CUANDO BD no disponible, ENTONCES tests DEBERÁN fallar (no saltar) |

---

## 7. Tests Requeridos

| Tipo | Qué Probar |
|------|------------|
| Unit | Job expiración relaciones, limpieza intentos, rate limit Redis |
| Integration | OIDC happy-path (Keycloak), Visitas → IdentityAccessService |
| DB | Exclusion constraint, trigger autorrelación, RLS 6 tablas, grants sin DELETE |
| E2E | Login → callback → sesión → contextos → Visitas (profesional) |
| Provisioning | `identity:provision` contra BD real |

---

## 8. Migración, Rollback, Operación

| Item | Detalle |
|------|---------|
| Migración BD | `EXPIRED` ya existe en enum → solo job/trigger. Sin migración esquema. |
| Rollback código | Revertir commits. BD no cambia (estado `EXPIRED` solo lectura). |
| Job scheduler | Requiere `node-cron` o similar. Config via env var. |
| Redis | Requiere `ioredis` + `REDIS_URL` env. Documentar si no. |
| Observabilidad | Logs job expiración/limpieza. Métricas rate limit. |

---

## 9. Supuestos, Riesgos, Decisiones Abiertas

| # | Decisión Abierta | Recomendación |
|---|------------------|---------------|
| 1 | Rate limit: Redis ahora o documentar MVP? | **Redis** — evita deuda técnica |
| 2 | Job scheduler: `node-cron` vs `bull` vs cron externo? | `node-cron` simple para MVP |
| 3 | Test OIDC happy-path: requiere Keycloak en CI? | **Sí** — levantar en pipeline |
| 4 | Test BD: `btree_gist` extension en CI? | **Sí** — añadir a Dockerfile test |
| 5 | `EXPIRED` job: ¿auditar evento `RELATIONSHIP_EXPIRED`? | **Sí** — trazabilidad |

---

## 10. Evidencia para Auditoría Codex

1. `git diff` completo
2. Tests unit/integración/BD pasando (`vitest run`)
3. Test OIDC happy-path pasando contra Keycloak local
4. Tests BD: exclusion constraint, trigger, RLS pasando
5. Job expiración/limpieza funcionando (logs)
6. Rate limit Redis funcionando (o doc limitación)
7. Tests provisioning contra PostgreSQL real
8. Tests no saltan sin BD (fail explícito)

---

## 11. Aprobación y Próximos Pasos

| Paso | Acción | Responsable |
|------|--------|-------------|
| 1 | Revisar y aprobar spec | Product Owner |
| 2 | PO ejecuta `confirm-user-consent.sh --spec 028-identidad-humana-completar` | Product Owner |
| 3 | Codex genera `plan.md` + `tasks.md` | Codex |
| 4 | PO aprueba `plan.md` | Product Owner |
| 5 | Implementación (Claude Code) | Claude Code |
| 6 | Auditoría Codex + aceptación PO | Codex + PO |
| 7 | Merge a `develop` | PO |

---

**Firma Product Owner**: _________________________ **Fecha**: _______________