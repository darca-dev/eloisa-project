# Especificación 025 — FORCE RLS y baseline de pruebas aislada

## Estado de aprobación / Approval status

- Estado / Status: `Aprobado`
- Alcance de producto y remediación FORCE RLS aprobado: `SÍ`
- Implementación autorizada: `SÍ, exclusivamente en los 42 micro-paquetes secuenciales validados`
- Consentimiento SDD de implementación: `REGISTRADO`
- Fecha de decisiones: `2026-08-30`
- Aprobado por: `Product Owner`
- Evidencia 1: «APRUEBO SPEC 025 Y LA BASE DE DATOS DE PRUEBAS AISLADA BAJO ESAS CONDICIONES.»
- Evidencia 2: «APRUEBO REMEDIAR FORCE RLS COMO PARTE DE LA SPEC 025 Y DIVIDIR LA IMPLEMENTACIÓN EN LOS MICRO-PAQUETES NECESARIOS DE MÁXIMO 15 MINUTOS CADA UNO.»
- Evidencia 3: consentimiento explícito de la Product Owner para implementar Spec 025 bajo los 42 micro-paquetes validados, registrado el 2026-08-30.

El consentimiento abre únicamente un micro-paquete a la vez mediante `TO-CLAUDE.md`, empezando por MP01. No autoriza trabajo fuera de su allowlist, ejecución posterior al hard stop, commit/push de Claude, demo, staging, producción, `main` ni edición de migraciones históricas.

## 1. Objetivo y valor

Materializar FORCE RLS en las 15 tablas protegidas que aún no lo tienen y establecer una baseline reproducible sobre PostgreSQL aislado/desechable. La evidencia decisiva debe ejecutar el artefacto real de migraciones, `MERDN_RUNTIME_ROLE=enforce`, rol `merdn_runtime`, tenant real, RLS/FORCE RLS y la matriz 22+1 sin tocar demo, staging ni producción.

## 2. Autoridades, usuarios y fronteras

- Product Owner: consentimiento final, decisiones de seguridad/timebox y aceptación.
- Claude: un micro-paquete autorizado a la vez después del consentimiento.
- Codex: revisión antes/después de cada paquete, seguridad, evidencia y coherencia.
- Runtime de aplicación: exclusivamente `merdn_runtime`, nunca owner/superuser/BYPASSRLS.
- Migrator/owner: DDL y migraciones; separado del runtime y no disponible al proceso API.
- Test admin: credencial privilegiada solo dentro del cluster desechable para migraciones/fixtures; nunca se pasa a la API ni se reutiliza fuera del test.
- Entornos: test aislado es el único afectado por baseline. Demo/staging/prod quedan fuera.

## 3. Datos, propiedad, sensibilidad, procedencia y retención

- Solo reference data versionada y fixtures ficticios.
- Sin PHI, PII real, secretos reales ni dumps.
- Procedencia: 12 migraciones actuales + nueva migración forward de FORCE + fixtures existentes.
- Linaje: migraciones reales → tenant `merdn-mvp` resuelto → fixtures → suites → evidencia sanitizada.
- Retención: cluster/volumen test destruidos; se conserva resumen de commit, catálogo, matriz y resultado.
- Prohibido registrar URLs completas, passwords, tokens, UUID interno del tenant o datos de fixtures.

## 4. Estado RLS/FORCE verificado

Existen 26 tablas protegidas, todas con `ENABLE ROW LEVEL SECURITY` y 27 policies (dos para `audit_event`).

### 4.1 FORCE ya materializado — 11 tablas

- Identidad: `human_account`, `external_auth_identity`, `human_session`, `human_auth_attempt`, `patient_caregiver_relationship`, `patient_caregiver_relationship_scope`.
- Visitas: `home_visit`, `home_visit_transition`.
- Soporte: `platform_support_capability`, `support_grant`, `support_context_session`.

Evidencia: migraciones `20260823120000_identity_relationships_core_01`, `20260824120000_visits_core_01` y `20260825120000_eloisa_admin_access_01_mp01`. Usan `FORCE  ROW LEVEL SECURITY` con doble espacio; es SQL ejecutable.

### 4.2 FORCE faltante — 15 tablas

`tenant`, `territorial_unit`, `person`, `patient`, `patient_population_membership`, `patient_address`, `consent_record`, `enrollment_session`, `audit_event`, `institutional_identity`, `institutional_session`, `professional_profile`, `professional_affiliation`, `care_assignment`, `appointment`.

Ninguna se excluye:

- `territorial_unit` contiene filas nacionales compartidas, pero su policy sigue siendo la frontera autorizada.
- `tenant` se auto-aísla por tenant activo.
- tablas read-only para runtime también requieren FORCE para que el owner no las eluda implícitamente.

### 4.3 Policies esperadas

Las 27 policies exactas quedan congeladas por nombre: `tenant_self`, `territorial_unit_scope`, `person_tenant`, `patient_tenant`, `patient_population_membership_tenant`, `patient_address_tenant`, `consent_record_tenant`, `enrollment_session_tenant`, `audit_event_tenant_read`, `audit_event_tenant_append`, `institutional_identity_tenant`, `institutional_session_tenant`, `professional_profile_tenant`, `professional_affiliation_tenant`, `care_assignment_tenant`, `appointment_tenant`, `human_account_tenant`, `external_auth_identity_tenant`, `human_session_tenant`, `human_auth_attempt_tenant`, `patient_caregiver_relationship_tenant`, `patient_caregiver_relationship_scope_tenant`, `home_visit_tenant`, `home_visit_transition_tenant`, `platform_support_capability_home_tenant`, `support_grant_home_tenant`, `support_context_session_home_tenant`.

## 5. Nueva migración forward

- Ruta prevista: `prisma/migrations/20260830160000_force_rls_core_institutional_hospital/migration.sql`.
- Solo añade `ALTER TABLE <tabla> FORCE ROW LEVEL SECURITY` para las 15 tablas de §4.2.
- No edita migraciones históricas, schema Prisma, policies, grants, columnas, índices ni datos.
- Debe ejecutarse en transacción; preflight verifica las 15 tablas, RLS ya habilitado, policies esperadas, owners, roles y ausencia de sesiones/locks incompatibles.
- Usar `lock_timeout` y `statement_timeout` acotados definidos en la migración/operación aprobada. Ante contención: rollback transaccional y STOP; sin reintento improvisado.
- `ALTER TABLE ... FORCE` es cambio de catálogo sin reescritura de filas, pero requiere lock fuerte y ventana controlada.

## 6. Roles, ownership y efecto esperado

- `merdn_runtime` debe mantener LOGIN solo donde se gestione su credencial, `NOSUPERUSER`, `NOBYPASSRLS`, `NOCREATEDB`, `NOCREATEROLE`, no ownership de ninguna de las 26 tablas y sin CREATE en schema `public`.
- Migrator/current user conserva DDL y membership para adoptar `merdn_runtime`; membership no equivale a BYPASSRLS.
- FORCE somete al owner a RLS para DML. DDL continúa disponible, pero futuras migraciones con backfill deben declarar contexto/estrategia explícita; no pueden depender de bypass implícito.
- El proceso API recibe solo `RUNTIME_DATABASE_URL`; nunca `DATABASE_URL` administrativa.
- El cluster test puede usar superuser bootstrap exclusivamente para crear/migrar/fixtures, aislado del proceso API. Toda evidencia de negocio y aislamiento se produce bajo runtime enforce.

## 7. Arquitectura de DB test aislada

- Proyecto: `merdn-baseline-test`; servicio `postgres-test`; DB `merdn_test`; puerto host recomendado `55432`; red/volumen con nombres y labels exclusivos.
- PostgreSQL 17.6 Alpine ya usado; cero dependencias nuevas.
- Admin/runtime URLs distintas, passwords ficticios/efímeros no versionados.
- Guard estructural con `URL`: protocolo PostgreSQL, DB exacta, identidades distintas y rechazo case-insensitive de `merdn_dev`, `demo`, `staging`, `prod`, `production` en proyecto/host/DB/usuario.
- Confirmación server-side de `current_database()`, host/puerto y labels antes de migrar o limpiar.
- Nunca `docker:clean`, `prune`, `down -v` genérico, glob destructivo ni target ambiguo.

## 8. Lifecycle fail-closed

1. Validar identificadores/URLs/labels antes de Docker.
2. Pre-clean idempotente solo del proyecto test verificado.
3. Up de `postgres-test`, readiness con timeout.
4. Confirmar identidad del servidor y aplicar 13 migraciones (12 existentes + FORCE forward) y reference data.
5. Habilitar password runtime efímero solo en cluster test y resolver exactamente un tenant `merdn-mvp`.
6. Preflight de 26 tablas, 27 policies, owners, grants, runtime flags y 15+11 FORCE.
7. Pruebas conductuales: sin contexto fail-closed; tenant A positivo; tenant B invisible; INSERT/UPDATE cross-tenant denegados; read-only sin escritura/DELETE; pool sin tenant residual; `territorial_unit` compartido solo por policy; soporte home/target correcto; owner no elude FORCE.
8. Ejecutar matriz por micro-paquetes cronometrados. DB ausente, skip, `disabled`, suite omitida o timeout son FAIL/STOP.
9. Agregar evidencia de un mismo run-id y hacer cleanup en `finally`/señales soportadas.
10. Verificar cero contenedor/red/volumen con labels del run. Tras SIGKILL/pérdida eléctrica, la próxima corrida hace pre-clean verificado; si la identidad es dudosa, no borra y se detiene.

## 9. Matriz baseline 22+1

Los 22 DB-gated bajo `apps/api/test/` son: `cold-start-auth.api.test.ts`, `core-01-hardening.db.test.ts`, `eloisa-admin-support-foundation.db.test.ts`, `hospital-agenda.api.test.ts`, `hospital-core-02.db.test.ts`, `hospital-institutional-auth.api.test.ts`, `hospital-patients.api.test.ts`, `hospital-professionals.api.test.ts`, `human-auth.api.test.ts`, `identity-professional-assignment.db.test.ts`, `municipality.api.test.ts`, `municipality-aggregates.db.test.ts`, `patient-enrollment.api.test.ts`, `patient-enrollment.db.test.ts`, `patient-self.api.test.ts`, `patient-self.db.test.ts`, `runtime-fail-closed.db.test.ts`, `tenant-bootstrap.db.test.ts`, `visits.api.test.ts`, `visits-db-foundation.db.test.ts`, `visits-materialization.db.test.ts`, `visits-professional-transitions.db.test.ts`.

El `+1` es `apps/api/test/openapi.test.ts`. `health.api.test.ts` permanece en suite API general fuera del conteo. También se ejecutan typecheck global, unitarias API no DB y suite web.

## 10. Correcciones y pruebas permitidas

- Stale API: solo expectativas de cuarto rol en `apps/api/src/institutional-auth/institutional-auth.unit.test.ts`.
- Stale web: solo gobernanza de test en `apps/web/src/config/branding.test.tsx` para `hospitalShell.test.tsx` o expectativas importadas desde branding.
- Seguridad necesaria: nueva migración forward y nuevas pruebas test-only de catálogo/lifecycle; se permite reforzar `core-01-hardening.db.test.ts` únicamente con aserciones FORCE/owner/cross-tenant, sin cambiar producto.
- Cualquier otro fallo vuelve a Codex; no hay corrección automática.

## 11. Rollback/remediation

- Antes del commit SQL: cualquier fallo revierte toda la migración.
- Después del despliegue: un flujo legítimo roto se detiene y se corrige mediante nueva migración forward o cambio de contexto/policy específicamente aprobado.
- No existe down automático ni edición histórica.
- Nunca conceder superuser/BYPASSRLS a la aplicación ni desactivar enforce.
- `NO FORCE ROW LEVEL SECURITY` solo mediante migración compensatoria de emergencia explícitamente aprobada, tabla exacta, ventana controlada, evidencia de aislamiento alternativo y reconocimiento de regresión de seguridad.

## 12. Allowlist prospectiva consolidada

Solo después de consentimiento y siempre particionada por `plan.md`:

- `compose.test.yml`, `.env.test.example`, `package.json` solo scripts.
- `scripts/testing/test-environment-guard.mjs`, `test-db-provision.mjs`, `test-db-preflight.mjs`, `test-db-cleanup.mjs`, `run-baseline.mjs`.
- `tests/testing/test-environment-guard.test.mts`, `test-db-lifecycle.test.mts`, `run-baseline.test.mts`.
- nueva migración exacta de §5.
- `apps/api/test/force-rls-catalog.db.test.ts` nuevo.
- `apps/api/test/core-01-hardening.db.test.ts` solo aserciones FORCE/owner.
- los dos archivos stale de §10.
- `docs/runbooks/FORCE_RLS_REMEDIATION.md` nuevo.

## 13. Denylist

- Migraciones históricas, `prisma/schema.prisma`, policies/grants/roles distintos de FORCE forward aprobado.
- Código productivo, Compose local/staging, DB demo/staging/prod, datos existentes.
- Dependencias nuevas, `.env`, secretos, `.agents/`, `.claude/`, `.codex/`, `.mcp.json`.
- `tasks/**`, `reviews/**`, `prototype-claude/**`, `main`, otras ramas.

## 14. Auditoría/evidencia

No se crean eventos de dominio. Evidencia: commit, plataforma, versión PostgreSQL, DB/puerto no sensibles, 13 migraciones, 26 tablas/27 policies, 11 FORCE previo + 15 nuevo, owners/flags booleanos, tenant presente sin UUID, matriz/run-id, pass/fail/timeout/skip y cleanup. Nunca secretos o datos reales.

## 15. Criterios EARS

1. CUANDO se aplique la migración forward, las 15 tablas faltantes DEBERÁN quedar FORCE sin editar las 11 ya correctas ni historia.
2. CUANDO termine, las 26 tablas DEBERÁN tener `relrowsecurity=true` y `relforcerowsecurity=true`, con 27 policies exactas.
3. SI owner/role/policy/lock es ambiguo, la migración DEBERÁ fallar antes de cambiar estado.
4. EL runtime DEBERÁ ser `merdn_runtime`, no owner/superuser/BYPASSRLS y sin CREATE schema.
5. SIN tenant context, runtime y owner sujetos a FORCE NO DEBERÁN obtener acceso; con tenant A solo verán/alterarán A conforme a grants/policies.
6. INTENTOS cross-tenant de lectura/escritura DEBERÁN ser invisibles o denegados según contrato.
7. TEST DEBERÁ obtener FORCE únicamente de las migraciones reales, nunca bootstrap ad hoc.
8. CUALQUIER identidad demo/staging/prod, skip DB, disabled, suite omitida o timeout DEBERÁ producir FAIL/STOP.
9. EL cleanup DEBERÁ dirigirse solo a recursos test verificados y confirmar su ausencia.
10. CADA micro-paquete DEBERÁ detenerse a los 15 minutos como máximo y devolver control a Codex.

## 16. STOP CONDITIONS

- No se identifican con certeza las 26 tablas/27 policies/15 faltantes.
- Se requiere editar historia, schema o conceder owner/superuser/BYPASSRLS a aplicación.
- Un flujo legítimo depende de bypass sin alternativa segura.
- Test no reproduce migraciones reales o toca demo/staging/prod.
- Dependencia nueva, archivo fuera de allowlist, paquete >15 min o suite individual excede timeout.
- Contención/ownership/cleanup ambiguo, gate cerrado o falta consentimiento.

## 17. Estado de implementación

Arquitectura, seguridad, aislamiento, matriz, rollback y 42 micro-paquetes están aprobados y consentidos. Solo MP01 queda preparado; MP02–MP42 permanecen cerrados hasta PASS y revisión Codex del paquete anterior.
