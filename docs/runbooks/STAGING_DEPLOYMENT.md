# Controlled Hostinger staging runbook

This runbook prepares Spec 023 staging. It does not authorize external actions,
production, credentials, certificates, or real data.

## Local preparation

1. Select immutable API, web and Keycloak image digests.
2. Copy `.env.staging.example` to a secret file outside Git; replace every
   placeholder and restrict it to root/deployment operator (`0600`).
3. Keep `DATABASE_URL` for the schema owner/migrator and a different
   `RUNTIME_DATABASE_URL` for `merdn_runtime`; set `MERDN_RUNTIME_ROLE=enforce`.
4. `compose.staging.yml` is **standalone**, never an overlay over `compose.yml`.
   The authoritative validation is
   `docker compose --env-file <secret-file> -f compose.staging.yml config`.
   Do not add `-f compose.yml`: the local Compose contributes development host
   ports, build contexts and OIDC requirements that contradict the approved
   isolated staging boundary.
5. Set `MERDN_TLS_CONTACT_EMAIL` to a real operator address. It is required —
   there is no `off` fallback — and the preflight fails closed without it.
6. Pin every image by digest, including `MERDN_OIDC_IMAGE`. Floating OIDC tags
   are rejected by the preflight under the same standard as API and web.
7. Set `MERDN_OIDC_DATABASE_NAME`, `MERDN_OIDC_DATABASE_USER` and
   `MERDN_OIDC_DATABASE_PASSWORD`. Keycloak owns its own database and its own
   LOGIN role; it must never reuse `merdn_runtime` or the application
   migrator/owner. The bootstrap script and the Keycloak service read exactly
   these three variables, so the two cannot diverge.
8. Set the trusted active-tenant pair. `MERDN_ACTIVE_TENANT_CODE` and
   `MERDN_ACTIVE_TENANT_ID` must describe the **same** `tenant` row. Under
   `MERDN_RUNTIME_ROLE=enforce` the API cannot look the tenant up by code:
   Row Level Security hides the row until the transaction already carries the
   identifier, so the UUID must arrive from deployment configuration. Read it
   with the migrator credential **after** applying the reference-data migration:

   ```
   docker compose --env-file <secret-file> -f compose.staging.yml exec postgres      psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc      "SELECT id FROM tenant WHERE code = '<active tenant code>'"
   ```

   Neither value may come from a request. A mismatched pair fails closed exactly
   like a nonexistent tenant, and the preflight rejects a missing, placeholder or
   non-UUID identifier before deployment.
9. Run the staging preflight and repository secret scan. Never paste expanded
   Compose output into logs because it contains resolved secrets.

## Hostinger external action — NOT EXECUTED YET

Requires separate Product Owner authorization. Harden SSH, enable MFA and allow
only `22` from the operator allowlist plus public `80/443`. PostgreSQL, API, web
and Keycloak container ports remain internal. Two services sit on the
non-internal `edge` network: Caddy, which needs egress to reach the ACME
directory, and the API, which needs outbound HTTPS/DNS to reach the canonical
public OIDC issuer for discovery and token exchange. Joining `edge` grants
egress only — it publishes nothing. The API declares no `ports:`, and Caddy
remains the only service publishing host ports (`80/443`). PostgreSQL, web and
Keycloak stay on `internal` alone, which has no route out. Configure DNS before
Caddy obtains TLS; no certificate is issued by repository preparation.

### Keycloak database identity

`infra/staging/init/10-keycloak-database.sh` creates the isolated Keycloak
database and its dedicated LOGIN role (`NOSUPERUSER`, `NOCREATEDB`,
`NOCREATEROLE`, `NOBYPASSRLS`, `NOREPLICATION`), owning only its own database and
holding no privilege on the application schema or tables. The password reaches
`psql` through `\getenv`, never through `argv`, and is never printed.

PostgreSQL runs `/docker-entrypoint-initdb.d/*` **only on an empty PostgreSQL
data directory** — that is, a brand-new volume. The script therefore does not
touch an already-initialised staging volume, and must not be described as if it
did. For an **existing volume**, perform and verify the equivalent controlled
provisioning through an administrative channel BEFORE starting Keycloak: create
the dedicated database and LOGIN role with the same attributes, confirm the role
is not `merdn_runtime` and not the migrator/owner, and confirm it owns its
database and nothing else. Keycloak must not be started until that check passes.

Provision `merdn_runtime` LOGIN through an administrative channel without
persisting its password or `merdn.tenant_id`. Verify it is NOSUPERUSER,
NOBYPASSRLS and owns no protected tables. Secrets remain root-only outside the
repository and images.

Before migrations, select the immutable release, run `npx prisma migrate status`
as migrator and take a logical backup with `scripts/staging/backup-postgres.ps1`.
That script verifies the dump with `pg_restore --list` and writes a SHA-256
sidecar; **it does not encrypt**. Confidentiality is obtained by storing the dump
and its sidecar in encrypted, access-restricted external staging storage. Apply
with `npx prisma migrate deploy` as migrator, never runtime.

Start order is PostgreSQL, OIDC, API, web, then Caddy, enforced by health-based
dependencies. Use `docker compose --env-file <secret-file> -f
compose.staging.yml up -d` only after external authorization.

## Staging validation

Verify PostgreSQL readiness, OIDC `/health/ready`, API `/health`, web `/`, and
the public HTTPS boundary. Run the runtime DB check: current user
`merdn_runtime`, NOSUPERUSER, NOBYPASSRLS, no protected-table ownership, no
persistent tenant, and fail-closed protected reads without transaction context.

Use fictional identities/data only. There is no `/visitador` application route:
Visitador/professional acceptance is exercised inside the existing `/hospital`
surface. Real-browser acceptance is separate from HTTP smoke and must cover `/`,
`/hospital` (including the Visitador/professional flows) and `/municipality`.
HTTP 200 alone is not Patient, Hospital, Municipality or Visitador acceptance;
the HTTP smoke proves reachability only.

## Rollback

Application rollback selects the preceding immutable image digests and restarts
the affected services. Do not automatically run feature `ROLLBACK-*.sql`.
Incompatible schema changes require an approved forward-fix or manual restore
into a controlled target from the verified backup. `restore-postgres.ps1` checks
the SHA-256 sidecar and `pg_restore --list` before writing anything. Restore is
never automatic, never targets production, and requires explicit staging
confirmation.

No production or real-data readiness may be claimed until TLS, secrets,
firewall, migrations, health, backup/restore and browser acceptance all pass.
