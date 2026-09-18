# HOSPITAL-CORE-01 — Minimal Correction Packet

## Decision

- **Result:** CORRECTION REQUIRED
- **Purpose:** reconcile two obsolete scope tests with the already approved and implemented Hospital Patients API connection.
- **Implementation scope:** tests only. No production code, schema, migration, fixture, UI, API contract or performance change is authorized.

## Exact authorized files

1. `apps/api/test/health.api.test.ts`
2. `apps/web/src/features/hospital/hospitalAlcance.test.ts`

Every other repository path is forbidden for this correction. Reading and running tests is allowed. No commit, push, merge, deploy or dependency change.

## Required correction 1 — API scope test

Update `apps/api/test/health.api.test.ts` so its scope assertions reflect the approved current API:

1. Remove `/api/v1/hospital/patients` from the collection of routes expected to return `404`.
2. Add an explicit assertion that `GET /api/v1/hospital/patients` **exists and, without an institutional session, returns `401`**.
3. Assert the stable error code `INSTITUTIONAL_SESSION_REQUIRED` without requiring database availability and without logging or inventing credentials.
4. Keep all genuinely unimplemented routes at `404`, keep `/health` unchanged and do not weaken mutation/secret checks.
5. Update obsolete comments that say no Hospital route is approved; do not broaden the assertion to Agenda, Visits, Finance, Reports or another Hospital module.

## Required correction 2 — Hospital scope test

Update `apps/web/src/features/hospital/hospitalAlcance.test.ts` so it preserves the original no-network invariant for every Hospital module except the two clients expressly authorized by HOSPITAL-CORE-01:

- `hospitalInstitutionClient.ts`
- `hospitalPatientsClient.ts`

Requirements:

1. Keep prohibitions on WebSocket, XMLHttpRequest, axios, Web Storage, `document.cookie`, telemetry, secrets/environment access and system-date dependence across the complete Hospital production directory.
2. Permit `fetch` only in the two exact client files above.
3. Assert that no other Hospital production file contains a direct network call.
4. Assert that the authorized set is exact; a new client/file must fail this test unless a later Task authorizes it.
5. Update the suite description from “Hospital sin red” to the precise rule: only institutional-session context and Hospital Pacientes may connect to their approved APIs. All other Hospital modules remain demonstrative and offline.
6. Do not modify or weaken the existing independent client tests that verify exact routes, `credentials: "include"`, `cache: "no-store"`, allowlisted query parameters and absence of tenant/role supplied by the browser.

## Exact tests and checks

Claude must run and report, in this order:

1. `npm.cmd exec vitest run test/health.api.test.ts --workspace @merdn/api`
2. `npm.cmd exec vitest run src/features/hospital/hospitalAlcance.test.ts src/features/hospital/hospitalInstitutionClient.test.ts src/features/hospital/hospitalPatientsClient.test.ts --workspace @merdn/web`
3. `npm.cmd run test --workspace @merdn/api`
4. `npm.cmd run test --workspace @merdn/web`
5. `npm.cmd run lint`
6. `npm.cmd run typecheck`
7. `npm.cmd run build:api`
8. `npm.cmd run build:web`
9. `git diff --check`
10. `git status --short` and an allowlist audit proving that this correction changed only the two authorized files.

Database-dependent tests may report their existing environment-specific skips, but no new skip, `.only`, weakened expectation or conditional bypass may be introduced by this correction.

## Acceptance criteria

1. The health suite expects `401`, not `404`, for unauthenticated Hospital Patients.
2. The Hospital scope suite allows network only through the two approved client files and continues rejecting it everywhere else.
3. The existing Hospital API/client contract tests remain green.
4. No production file or third file changes.
5. No test is deleted, skipped or generalized until it stops detecting unauthorized Hospital connections.
6. All executable checks above pass; unavailable DB/RLS evidence remains reported, not represented as PASS.

## STOP CONDITIONS

Stop and return to Codex if either correction requires modifying production code, another test, dependencies, schema/migrations, fixtures, another Hospital module or the approved API contract; if the unauthenticated endpoint does not actually return `401`; if any new network consumer is found; or if a required executable non-DB check fails after the two corrections.

## Deferred gates — not authorized in this correction

### Performance

The measured analytics p95 (~1719 ms unfiltered; ~884 ms filtered) misses the documented 500 ms target but does not invalidate functional correctness for this controlled MVP. Open a separate Task for SQL aggregation/query-plan/index work. That Task must not add Hospital domains or change response semantics. Performance remains a production-readiness gate.

### RLS

Hospital-specific RLS execution was not verified because the available engine ran the API suite with `MERDN_RUNTIME_ROLE=disabled`. This does not become a PASS. It is accepted as a documented environment limitation for fictional/controlled MVP use only because CORE-01 already validated the underlying tenant policies and runtime pattern. Before production or any real personal/health data, execute Hospital list/detail/analytics with a normal PostgreSQL server, `MERDN_RUNTIME_ROLE=enforce`, a non-owner/no-`BYPASSRLS` runtime identity, two tenants, missing/wrong context, direct cross-tenant IDs and pool reuse. Any failure blocks production.

---

**READY FOR CLAUDE CORRECTION: YES**

**EXPECTED DIFF:** exactly `apps/api/test/health.api.test.ts` and `apps/web/src/features/hospital/hospitalAlcance.test.ts`.
