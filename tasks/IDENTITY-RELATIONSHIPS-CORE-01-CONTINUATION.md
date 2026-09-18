# IDENTITY-RELATIONSHIPS-CORE-01 — Claude Continuation Packet

## 1. Identification

- **Task:** `IDENTITY-RELATIONSHIPS-CORE-01`
- **Packet type:** minimal continuation after controlled stop
- **Status:** `APPROVED CONTINUATION — IMPLEMENTATION INCOMPLETE`
- **Authority:** Codex checkpoint after Product Owner request
- **Rule:** implement only the delta in this file; do not repeat completed work

Claude Code receives no architecture or product decisions. They are resolved
below. If a listed correction cannot be implemented as specified, STOP and
return the concrete evidence to Codex.

## 2. Baseline to preserve — do not redo

The following work is already present and structurally aligned. Preserve it and
change it only where an explicit delta below requires it:

1. Prisma models/enums for `HumanAccount`, `ExternalAuthIdentity`,
   `HumanSession`, `HumanAuthAttempt`, `PatientCaregiverRelationship` and scope.
2. Additive migration/rollback with tenant-aware FKs, checks, self-caregiver
   trigger, `btree_gist` overlap exclusion, grants without DELETE,
   `ENABLE/FORCE RLS` and tenant policies.
3. Single OIDC adapter using `openid-client`, Authorization Code + PKCE S256,
   state/nonce, encrypted verifier and fail-closed discovery/exchange.
4. Human session cookies, guard/controller, 8h absolute TTL and 30m idle checks.
5. Server-side Patient/Professional/Affiliation/Assignment resolvers.
6. Caregiver Relationship Manager guard and create/get/activate/revoke domain
   flow with `VISITS_VIEW` only.
7. Identity/relationship audit service already implemented for session and
   relationship events.
8. OpenAPI surface and focused OpenAPI tests.
9. Keycloak 26.7.1 local service, realm/client skeleton and OIDC dependency.
10. No changes exist in Visits, web or prototype; keep them untouched.

Checkpoint evidence already obtained:

- API typecheck passes.
- Prisma schema validation passes.
- focused `openapi.test.ts`: 39/39 passes.
- discovery currently returns HTTP 200 from the host with issuer
  `http://127.0.0.1:8081/realms/merdn-local` and advertises S256.

These facts do not replace the remaining runtime/DB tests below.

## 3. Keycloak diagnosis and exact correction

### 3.1 Closed root cause

The original Keycloak failure was a realm-import schema mismatch: client PKCE
and post-logout options were represented as unknown top-level properties of
`ClientRepresentation`. They belong under `clients[].attributes`. The current
fixture already uses:

- `pkce.code.challenge.method`;
- `post.logout.redirect.uris`;
- token signing algorithm attributes.

This was a local realm fixture/configuration problem, not an API adapter,
domain or architecture problem. Do not rewrite the OIDC adapter for it.

### 3.2 Remaining fixture defect

In both fictitious users, replace the unsupported literal:

```text
$(env:MERDN_OIDC_LOCAL_TEST_PASSWORD)
```

with Keycloak realm-import substitution syntax:

```text
${MERDN_OIDC_LOCAL_TEST_PASSWORD}
```

No password may be committed. Keep the value sourced from ignored `.env`.

### 3.3 Canonical issuer for API Docker + browser

The current issuer `127.0.0.1` works from the host browser but not from the API
container: inside that container it points back to the API. Resolve this only
in local configuration/Compose:

1. canonical local host: `host.docker.internal`;
2. Keycloak `KC_HOSTNAME=http://host.docker.internal:${OIDC_LOCAL_PORT:-8081}`;
3. API issuer:
   `http://host.docker.internal:8081/realms/merdn-local`;
4. add `extra_hosts: ["host.docker.internal:host-gateway"]` to the API service
   for engines that do not provide it automatically;
5. update the human-auth local-host allowlist to admit exactly
   `host.docker.internal` in development/test;
6. retain loopback-only published port, exact callback and exact web origin;
7. retain rejection of local/HTTP issuer in `mvp` and future production.

Do not introduce a second issuer, adapter, proxy, dev-login or fallback.

### 3.4 Focal proof

After recreating Keycloak and API, prove:

- discovery HTTP 200 from the host using the canonical issuer;
- discovery HTTP 200 from inside the running API container using the same
  canonical issuer;
- published `issuer` equals the configured issuer exactly;
- JWKS endpoint responds;
- one Authorization Code + PKCE login with the fictitious linked user reaches
  the callback/session path;
- the unlinked fictitious subject does not create an account.

Do not run a full suite for this proof.

## 4. Missing provisioning implementation

Implement the already-approved CLI; no public linking endpoint.

### 4.1 Files/scripts

- create `tools/identity-provisioning/**`;
- add root script `identity:provision`;
- document only the required local variables in `.env.example` without values
  that function as credentials.

### 4.2 Exact operations

Support the discriminated JSON operations from the main packet:

- `LINK { tenantCode, personId, issuer, subject }`;
- `UNLINK { tenantCode, issuer, subject }`;
- `DISABLE_ACCOUNT { tenantCode, humanAccountId }`.

Required behavior:

- dry-run by default; only `--apply` writes;
- strict schema and issuer allowlist;
- no email/document/name/claim matching and no EnrollmentSession;
- LINK is idempotent by `(tenantId, issuer, subject)`;
- a new LINK creates one HumanAccount + binding atomically;
- conflict with another Person fails with no partial write;
- UNLINK/DISABLE revoke all active HumanSessions atomically;
- use `AuditActorType.SYSTEM`, actor/role null;
- implement and call missing audit events
  `HUMAN_IDENTITY_LINKED`, `HUMAN_IDENTITY_UNLINKED`,
  `HUMAN_ACCOUNT_DISABLED` and `HUMAN_SESSION_REVOKED` as applicable;
- never log or print full issuer, subject, PII, token or secret.

## 5. Fix the one-active-session race

The current callback revokes then creates sessions without serializing two
concurrent logins for the same account. Two transactions can both insert an
active session. Correct this in the existing callback transaction:

1. after resolving the exact active binding/account, lock the HumanAccount row
   with `SELECT ... FOR UPDATE` inside the same tenant-scoped transaction;
2. revalidate account/binding after acquiring the lock;
3. revoke active sessions;
4. create the new session and audit;
5. commit atomically.

Use parameterized SQL and the existing transaction; no global lock, no
in-memory mutex and no new architecture. Add a PostgreSQL concurrency test in
which two callbacks/logins for one account finish with exactly one valid active
session and the later successful login invalidates the earlier token.

## 6. Focused tests still required

Create only focused tests for the new core. Do not run unrelated full suites.

### 6.1 Unit/config tests

- local issuer allowed only in development/test;
- `host.docker.internal` exact allowlist and local issuer rejected in mvp;
- incomplete config fail-closed;
- attempt AES-GCM roundtrip/tamper;
- cookie names and separation;
- strict relationship request parsing and forbidden authority fields;
- Patient/Professional/Caregiver policy matrices.

### 6.2 Auth/API tests

- attempt single-use, state/nonce/PKCE mismatch and replay;
- unknown/unlinked/disabled binding uniform denial;
- 8h absolute, 30m idle, logout and rotation;
- institutional/enrollment/human cookies never substitute each other;
- session/context endpoints minimized and no-cache;
- Relationship Manager versus Scheduler/viewers/human principals;
- create/activate/revoke, version conflict and terminal states.

### 6.3 PostgreSQL/RLS tests

- two tenants, composite FK failures and RLS context absence/mismatch/pool
  reuse with runtime role;
- runtime owns no tables, has no DELETE/BYPASSRLS;
- self-caregiver and ACTIVE-overlap rejection, including concurrency;
- relationship+scope+audit atomic rollback;
- provisioning LINK/UNLINK/DISABLE atomicity and audit;
- one-active-session concurrency correction from §5.

Use only fictitious fixtures. Reuse existing test infrastructure; do not create
another database harness.

## 7. Documentation/config delta

Update `.env.example` with commented placeholders for:

- Keycloak local admin/test credentials;
- canonical local issuer/client/callback;
- 32-byte auth-attempt key;
- provisioning issuer allowlist;
- Relationship Manager code/secret;
- fixed session/attempt/rate-limit values only where configurable.

Update `infra/local-oidc/README.md` to describe the API-Docker topology and the
two canonical discovery checks. Remove/replace the statement that the supported
path requires API on the host.

## 8. Allowed continuation files

Only these existing/new paths may change:

- `infra/local-oidc/**`;
- `compose.yml`;
- `.env.example`;
- `apps/api/src/human-auth/**`;
- `apps/api/src/audit/identity-audit.service.ts`;
- `apps/api/src/identity-access/**` only if a focused test exposes a defect;
- `apps/api/src/people-relationships/**` only if a focused test exposes a defect;
- `tools/identity-provisioning/**`;
- `package.json`, `package-lock.json` only for the CLI script/workspace wiring;
- new focused tests under `apps/api/src/**` or `apps/api/test/**`;
- the uncommitted identity migration/schema only if a focused DB test proves a
  defect; do not rewrite already-correct structures.

Forbidden: Visits, `apps/web/**`, prototype, Hospital business code,
Municipality, Patient enrollment, Agenda, existing historical migrations,
commit, push, deploy or unrelated refactor.

## 9. Minimal verification commands

Run and report only:

1. `npm run prisma:validate`;
2. API typecheck;
3. the existing focused OpenAPI test only if API contract changed;
4. new identity unit tests by exact file/path;
5. new identity API tests by exact file/path;
6. new identity PostgreSQL/RLS/concurrency tests by exact file/path;
7. provisioning CLI dry-run/apply/idempotency focused tests;
8. Keycloak discovery/JWKS from host and API container;
9. one focal local Authorization Code + PKCE flow;
10. `npm run secrets:scan`;
11. Compose config validation without publishing expanded secrets.

No benchmarks. No full workspace test suite, full regression suite or
unrelated build unless a focused failure requires diagnosis and Codex approves
the expansion.

## 10. Expected handoff

Claude returns only:

- files changed in this continuation;
- Keycloak fixture/topology correction and discovery evidence from both
  network contexts;
- provisioning operations implemented;
- session race correction;
- exact focused tests/commands and results;
- remaining failure or STOP CONDITION;
- confirmation that Visits/web/prototype were untouched.

---

IDENTITY CORE STATUS: IMPLEMENTATION SUBSTANTIAL — CONTINUATION REQUIRED

KEYCLOAK ROOT CAUSE: Realm-import schema mismatch in local client fixture; corrected client options belong under clients[].attributes. Remaining local defects are unsupported password placeholder syntax and an API-Docker/loopback issuer topology mismatch.

REMAINING CLAUDE WORK: Correct local Keycloak fixture/topology, implement provisioning and missing identity audit paths, serialize concurrent session creation, add focused identity/OIDC/RLS/relationship tests, and document local env variables.

CLAUDE CONTINUATION PACKET: tasks/IDENTITY-RELATIONSHIPS-CORE-01-CONTINUATION.md
