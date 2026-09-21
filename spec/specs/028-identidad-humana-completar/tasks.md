# Tareas Verificables — Spec 028

**Spec**: `028-identidad-humana-completar`
**Basada en**: Spec 011 gaps (15 gaps documentados)

---

## Checklist de ejecución

- [ ] Completar y verificar el Bloque 1 — garantías de base de datos y expiración.
- [ ] Completar y verificar el Bloque 2 — servicio compartido de identidad para visitas.
- [ ] Completar y verificar el Bloque 3 — autenticación y rate limit.
- [ ] Completar y verificar el Bloque 4 — limpieza, provisioning y pruebas no omitibles.
- [ ] Completar y verificar el Bloque 5 — integración E2E y evidencia.

## Formato
Cada tarea: `ID | Descripción | Archivos | DoD | Test | Dependencia`

---

## BLOQUE 1 — Base de Datos: EXPIRED + Tests BD

| ID | Descripción | Archivos | DoD | Test | Dep |
|----|-------------|----------|-----|------|-----|
| T1.1 | Crear job nocturno expiración relaciones | `apps/api/src/people-relationships/expire-relationships.job.ts` (nuevo) | Job corre cada noche 02:00, actualiza `status='EXPIRED'` donde `endsAt < NOW()` y `status='ACTIVE'`, logs | Unit: mock Prisma → update correcto | — |
| T1.2 | Registrar job en scheduler | `apps/api/src/main.ts` o module bootstrap | Job registrado y corriendo | Manual: logs 02:00 | T1.1 |
| T1.3 | Test BD: exclusion constraint `patient_caregiver_relationship_active_overlap` | `apps/api/test/identity-relationships-db.test.ts` (nuevo) | Test crea 2 relaciones ACTIVE solapadas → 2da falla con `P2003` | `vitest run identity-relationships-db.test.ts` | — |
| T1.4 | Test BD: trigger `prevent_self_caregiver_relationship` | `apps/api/test/identity-relationships-db.test.ts` | Test intenta crear relación paciente=cuidador → falla | `vitest run identity-relationships-db.test.ts` | — |
| T1.5 | Test BD: RLS en 6 tablas | `apps/api/test/identity-relationships-db.test.ts` | 6 tests: tenant A no ve/edita tenant B en 6 tablas | `vitest run identity-relationships-db.test.ts` | — |
| T1.6 | Test BD: grants sin DELETE en 6 tablas | `apps/api/test/identity-relationships-db.test.ts` | 6 tests: DELETE falla con `42501` | `vitest run identity-relationships-db.test.ts` | — |
| T1.7 | Añadir `node-cron` dependency | `package.json` (apps/api) | `npm install node-cron @types/node-cron` | `npm install` OK | — |

---

## BLOQUE 2 — Servicios Compartidos: Visitas → IdentityAccessService

| ID | Descripción | Archivos | DoD | Test | Dep |
|----|-------------|----------|-----|------|-----|
| T2.1 | Refactor `professional-visit-query.service.ts` → `IdentityAccessService` | `apps/api/src/visits/professional-visit-query.service.ts` | Usa `IdentityAccessService.resolveProfessional()` + `hasActiveAssignmentOverPatient()` | Tests regresión `visits-professional-query.test.ts` pasan | B1 |
| T2.2 | Refactor `professional-visit-worklist.service.ts` | `apps/api/src/visits/professional-visit-worklist.service.ts` | Usa `IdentityAccessService` | Tests regresión pasan | B1 |
| T2.3 | Refactor `home-visit-transition.service.ts` | `apps/api/src/visits/home-visit-transition.service.ts` | Usa `IdentityAccessService.resolveProfessional()` | Tests regresión pasan | B1 |
| T2.4 | Eliminar consultas duplicadas de profesional en Visitas | Archivos refactorizados | No quedan consultas directas a `professional_profile`/`care_assignment` en Visitas | Grep confirma | T2.1-T2.3 |
| T2.3 | Tests regresión Visitas | `apps/api/test/visits-*.test.ts` | Todos los tests existentes pasan | `vitest run visits-*.test.ts` | T2.1-T2.3 |

---

## BLOQUE 3 — Autenticación y Rate Limit

| ID | Descripción | Archivos | DoD | Test | Dep |
|----|-------------|----------|-----|------|-----|
| T3.1 | Añadir `ioredis` dependency | `package.json` (apps/api) | `npm install ioredis @types/ioredis` | `npm install` OK | — |
| T3.2 | Migrar `human-auth-rate-limit.guard.ts` a Redis | `apps/api/src/human-auth/human-auth-rate-limit.guard.ts` | Usa `ioredis` con `REDIS_URL`, window sliding, key por IP | Unit: mock Redis → 429 tras exceder | T3.1 |
| T3.3 | Config `REDIS_URL` en `.env.example` | `.env.example` | `REDIS_URL=redis://localhost:6379` documentado | Revisión manual | T3.1 |
| T3.4 | Test OIDC happy-path | `apps/api/test/human-auth.api.test.ts` (nuevo test) | Login → callback → sesión → `GET /human-auth/session` → contextos `['PATIENT','PROFESSIONAL','CAREGIVER']` | `vitest run human-auth.api.test.ts` (requiere Keycloak local) | — |
| T3.4 | Test rate limit Redis: exceder → 429 | `apps/api/test/human-auth-rate-limit.test.ts` (nuevo) | 10 req → 200, 11ava → 429 | `vitest run human-auth-rate-limit.test.ts` (requiere Redis) | T3.2 |

---

## BLOQUE 4 — Limpieza, Provisioning, Tests No-Skip

| ID | Descripción | Archivos | DoD | Test | Dep |
|----|-------------|----------|-----|------|-----|
| T4.1 | Job limpieza `HumanAuthAttempt` | `apps/api/src/human-auth/cleanup-attempts.job.ts` (nuevo) | Borra `consumedAt IS NOT NULL` OR `expiresAt < NOW() - 24h` cada 6h | Unit: mock Prisma → delete correcto | — |
| T4.2 | Registrar job limpieza en scheduler | `apps/api/src/main.ts` | Job cada 6h | Logs visibles | T4.1 |
| T4.3 | Tests provisioning → PostgreSQL real | `tools/identity-provisioning/src/operations.test.ts` | Quitar `MockDatabase`, usar `PrismaService` real | `vitest run operations.test.ts` (requiere BD) | — |
| T4.4 | Quitar `skipIf` en `eloisa-admin-support-foundation.db.test.ts` | `apps/api/test/eloisa-admin-support-foundation.db.test.ts` | Quitar `describe.skipIf(!puedeEjecutarse)` → fail si no hay BD | Test falla sin BD (no skip) | — |
| T4.5 | Quitar `skipIf` en `human-auth.api.test.ts` | `apps/api/test/human-auth.api.test.ts` | Quitar `describe.skipIf(!puedeEjecutarse)` | Test falla sin BD | — |
| T4.5 | Test provisioning contra BD real | `tools/identity-provisioning/src/operations.test.ts` | `LINK`, `UNLINK`, `DISABLE_ACCOUNT` contra BD real | `vitest run operations.test.ts` | T4.3 |

---

## BLOQUE 5 — Integración E2E + Evidencia

| ID | Descripción | Archivos | DoD | Test | Dep |
|----|-------------|----------|-----|------|-----|
| T5.1 | Test E2E Playwright: Login OIDC → sesión → Visitas worklist | `apps/web/e2e/identity-human-e2e.spec.ts` (nuevo) | Login Keycloak → callback → sesión → `GET /visits/worklist` → 200 | Playwright test pasa (requiere Keycloak + API + Web) | B1-B4 |
| T5.2 | Verificar job expiración relaciones | Manual + logs | Job 02:00 actualiza `EXPIRED`, logs visibles | Manual: logs + BD | B1 |
| T5.3 | Verificar rate limit Redis | Manual | 11ava req → 429 | Manual: `curl` x11 | B3 |
| T5.4 | Generar evidencia auditoría | `spec/specs/028-identidad-humana-completar/evidence/` | `git diff`, test outputs, logs jobs, capturas E2E | Archivos generados | B1-B4 |

---

## Resumen de Dependencias

```
T1.1 → T1.2
T1.3-T1.6 (paralelo) → T1.7
T1.1-T1.7 (B1 completo) → T2.1, T3.1, T4.1
T2.1-T2.4 (B2) → T5.1
T3.1-T3.4 (B3) → T5.1, T5.3
T4.1-T4.5 (B4) → T5.1, T5.2
B1-B4 completos → T5.1-T5.4 (B5)
```

---

## Comandos de Validación Rápida

```bash
# Bloque 1
cd apps/api
npm install node-cron @types/node-cron
npm test -- identity-relationships-db.test.ts --run

# Bloque 2
npm test -- visits-professional-query.test.ts visits-worklist.test.ts --run

# Bloque 3
npm install ioredis @types/ioredis
npm test -- human-auth-rate-limit.test.ts --run
# Requiere Redis: docker run -d -p 6379:6379 redis
# Test OIDC: requiere Keycloak local corriendo

# Bloque 4
npm test -- eloisa-admin-support-foundation.db.test.ts --run
npm test -- human-auth.api.test.ts --run
cd tools/identity-provisioning
npm test -- operations.test.ts --run

# Bloque 5
cd apps/web
npm run test:e2e  # Requiere docker compose up (keycloak, api, web)
```

---

## Notas para Implementador

1. **Orden estricto**: B1 antes que B2/B3/B4. B5 al final.
2. **Tests BD**: Requieren PostgreSQL levantado + `btree_gist` extension. Añadir a Dockerfile test si no existe.
3. **Test OIDC**: Requiere Keycloak local corriendo (`docker compose --profile oidc-local up -d`).
4. **Redis**: Para CI, levantar en pipeline (`docker run -d -p 6379:6379 redis`).
5. **Jobs**: Usar `node-cron` simple. En producción evaluar `bull` + Redis.
5. **Tests no-skip**: Cambiar `describe.skipIf` → `describe` + check BD al inicio → `throw` si no hay BD.
6. **Evidencia**: Guardar outputs en `spec/specs/028-identidad-humana-completar/evidence/`.
