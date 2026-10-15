-- 049: only two additional protected, same-origin return destinations.
-- Destination selection never grants institutional access; server guards remain.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
ALTER TABLE "human_auth_attempt"
  DROP CONSTRAINT "human_auth_attempt_return_target_allowlist",
  ADD CONSTRAINT "human_auth_attempt_return_target_allowlist"
    CHECK ("returnTarget" IN ('/', '/acceso', '/hospital', '/municipality'));
COMMIT;
