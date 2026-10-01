# PROGRESO CLAUDE — SPEC 038 / MP04 (handoff `TO-CLAUDE.md` v58)

> Estado cortado a 2026-09-30. Rama `feat/038-demo-funcional-accesos-ficticios`,
> base `develop`. Sin commits, sin merges, sin migraciones aplicadas.
>
> **Para quien continúe:** el contrato sigue siendo `spec/bitacora/handoffs/TO-CLAUDE.md`
> (v58, `Authorized-Package: MP04`). Este archivo solo registra hasta dónde llegó
> Claude y qué falta. **No sustituye a `TO-CLAUDE.md`.**

---

## 1. Decisiones de contrato que NO se deben reabrir

- Retorno tras login: ruta única **`/acceso`** (`HUMAN_AUTH_RETURN_TARGETS = ['/', '/acceso']`).
  Tres aserciones hospitalarias ya migradas de `/` a `/acceso` bajo autorización
  PO explícita: `hospitalHumanSessionClient.test.ts:131`, `:142`,
  `hospitalOperaciones.test.tsx:385-386`. **No tocar nada más en esos archivos.**
- OD-11: la contraseña ficticia vive solo en memoria durante la llamada; nunca se
  persiste, retorna, auditea ni loggea; el campo se limpia tras cada intento.
- `ACCESS_PROVISIONING_MAX_ATTEMPTS = 5`; backoff `ACCESS_PROVISIONING_RETRY_BASE_BACKOFF_MS = 250`.
- Transiciones: `APPROVE: PENDING → APPROVED_PENDING_PROVISIONING → APPROVED|PROVISIONING_FAILED`;
  `RETRY_PROVISIONING: PROVISIONING_FAILED → saga`; `SUSPEND: APPROVED → SUSPENDED`;
  `REACTIVATE: SUSPENDED → saga`; `REVOKE: APPROVED|SUSPENDED → REVOKED`;
  `REJECT: PENDING|PROVISIONING_FAILED → REJECTED`.
- Idempotencia saga: repetición acepta `version >= expectedVersion + 1` y
  `status ∈ settledStatuses ∪ {'APPROVED_PENDING_PROVISIONING'}`; si sigue en
  `APPROVED_PENDING_PROVISIONING` **vuelve a ejecutar la saga**; acciones directas
  exigen `version === expectedVersion + 1`.
- Contratos API: `GET /api/v1/professional/visits?from&to` (ventana ≤ 31 días, UTC);
  `GET /api/v1/hospital/access-requests` con `ACCESS_REQUEST_REVIEW_FILTER_STATUSES = ['PENDING']`
  y **omitir `status` devuelve todos los estados** del tenant; `GET /me/experiences`.

## 2. Completado y VERIFICADO

### API
- **Backend MP04 completo**: provisioning, review de 6 acciones, password OD-11,
  auditoría, `approved-experiences.service.ts`, `me-contexts.controller.ts`
  (`GET /me/experiences`), `human-auth.contract.ts`, `human-auth.config.test.ts`.
- **Migración escrita** en `prisma/migrations/20260930170000_access_provisioning/`
  (5 columnas, 5 CHECKs, FK compuesta `(humanAccountId, tenantId)` con RESTRICT,
  allowlist con `/acceso`, 5 eventos de enum). **NO APLICADA.**
- `approved-experiences.service.test.ts` creado → verde (1 file, 12 tests).
- Focal API: `access-requests` + `access-request-review` + `openapi` +
  `access-provisioning` → **184 passed (4 files)**; `tsc` API = 0; `eslint` = 0.

### Web
- Selector OIDC `CentralAccess.tsx` (6 fases, `aria-live`, foco) + `AccessRequestForm`.
- `humanSessionClient.ts`: `DESTINO_RETORNO_HUMANO='/acceso'`,
  `consultarExperienciasAprobadas` (fail-closed), `CONTEXTOS_HUMANOS` con
  `{paciente,cuidador,profesional}` → 46/46.
- `src/app/paciente/page.tsx` + test: monta `PacienteExperience`.
- Portal cuidador completo (gate con cierre de sesión incluido).
- `ProfesionalPortal.tsx` **reescrito en dos piezas**:
  `ProfesionalPortal` = vista (props `items`/`ventana`/`onCerrarSesion`, sin datos
  ficticios de rol, pestañas `Visitas` y `Mis pagos y liquidaciones`) y
  `ProfesionalPortalProtegido` = puerta (5 fases, worklist vacía **no** deniega,
  cierre con `cerrarSesionHumana`).
- `src/app/profesional/page.tsx` + `page.test.tsx` + `profesional.test.tsx` creados.
- **Tray hospitalario MP04**: `hospitalAccessRequestsClient.ts` (6 acciones,
  `validActionsFor`, lista **sin** `status` por defecto, `provisioningAttempts`,
  `provisioningErrorCode`) y `HospitalAccessRequests.tsx` (7 estados, filtros,
  detalle de provisión, reintento con límite de 5).
- **Verificación web**: `npm run typecheck` = 0; `npx eslint` sobre los 4 archivos
  hospitalarios = 0; `npx vitest run src/features/hospital` → **25/25 files**;
  focales `paciente`/`cuidador`/`caregiver`/`profesional`/`auth` verdes.

## 3. EN CURSO (detalle exacto del punto de corte)

**Archivo `apps/api/test/access-provisioning.db.test.ts` — escrito, NO está en verde.**

Estado actual del archivo y defectos abiertos:
1. Falta `type TestContext` en el import de `vitest` (línea 1) → `tsc` falla con
   `TS2304: Cannot find name 'TestContext'` en la línea 163 (`diferir`).
2. Solo el **primer** `it` recibe `async (contexto)` y llama `if (diferir(contexto)) return;`.
   Los **otros 8** `it` siguen con `async () => {` y **no** tienen el guard: se
   ejecutarían contra un `prisma` nunca instanciado. Hay que añadir a los 8 el
   parámetro `contexto: TestContext` y la línea `if (diferir(contexto)) return;`.
3. El gate es doble: `puedeEjecutarse = availability.available && availability.migrated`
   (banner `unavailableBanner`) **y** sondeo `sondearMp04()` dentro de `beforeAll`
   que comprueba las 5 columnas, la FK y la allowlist con `/acceso`. Si la migración
   no está aplicada: `console.warn` de **«EVIDENCIA DE BASE DE DATOS DE MP04 DIFERIDA»**
   y `contexto.skip()` (nunca `return` silencioso: eso contaría como verde).

Verificación pendiente de este archivo:
`npx vitest run test/access-provisioning.db.test.ts` + `npx tsc` + `npx eslint`.

Qué cubre (y qué NO):
- Sí: columnas y sus defaults/NULLability, FK compuesta con columnas, referencia,
  `RESTRICT`/`CASCADE` e índice `access_request_tenantId_humanAccountId_idx`,
  predicados de los 5 CHECK, allowlist `['/','/acceso']`, 5 valores de
  `AuditEventType`, RLS+FORCE y policy de `access_request`, ausencia de `DELETE`
  para `merdn_runtime` sobre `access_request` y `audit_event`, coherencia de filas
  existentes y cross-tenant de `humanAccountId`.
- NO: saga, idempotencia frente a dos decisiones concurrentes, límite de intentos
  ni revocación atómica. Esas son del servicio y viven en
  `test/access-provisioning.test.ts` y `test/access-request-review.test.ts`.

## 4. BLOQUEADORES y residuales

- **Migración MP04 no aplicada.** `npx prisma migrate status` reporta 3 pendientes:
  `20260830160000_force_rls_core_institutional_hospital`,
  `20260928190000_access_request_foundation`, `20260930170000_access_provisioning`.
  Única BD configurada: `merdn_dev` en `127.0.0.1:5432`. **No usar `merdn_dev`,
  no aplicar migraciones** sin autorización del Product Owner.
- **Baseline rota:** `npx vitest run test/identity-relationships-db.test.ts` →
  9 tests, **3 fallan** con `Foreign key constraint violated on the constraint:
  person_tenantId_fkey`. Eso deja la evidencia de base de datos de MP04
  **DIFERIDA** y debe reportarse así en `FROM-CLAUDE.md`, sin convertirla en verde.
- **Residual fuera de paquete (reportar, NO tocar):** `src/config/branding.test.tsx`
  → 2 tests fallan porque `src/features/hub/HubAccessPortal.tsx` declara el literal
  `Portal Eloisa` y la aserción espera `Isa` al mutar la config. Reproducido con
  `npx vitest run src/config/branding.test.tsx`. Suite web global: **66/67 files,
  1823 passed / 2 failed**.

## 5. Pendiente

1. Terminar `access-provisioning.db.test.ts` (2 defectos de la sección 3) y
   verificarlo.
2. Crear `apps/web/e2e/access-provisioning.spec.ts` (allowlistado, aún no existe)
   y ejecutarlo.
3. Verificación final completa: `npm run typecheck` (API y web), `eslint` focal,
   vitest focal, `npx prisma validate|format --check|generate`, escaneo de
   secretos, `bash ./spec/scripts/check-sdd-gate.sh .`,
   `bash ./spec/scripts/validate-sdd.sh . --strict`.
4. Reemplazar el bloque `# START - SPEC 038 / MP04` de
   `spec/bitacora/handoffs/FROM-CLAUDE.md` con el reporte de cierre: evidencia
   ejecutada y su resultado real, residual `branding.test.tsx`, evidencia de BD
   **diferida**, y las 3 aserciones hospitalarias modificadas bajo autorización PO.

## 6. Comandos de verificación

```
# API
npx tsc --project tsconfig.json --noEmit --allowImportingTsExtensions
npx vitest run <archivos>
npx eslint <archivos>

# Web
npm run typecheck
npx vitest run <ruta>
npx eslint <ruta>

# Gobernanza
bash ./spec/scripts/check-sdd-gate.sh .
bash ./spec/scripts/validate-sdd.sh . --strict
```
