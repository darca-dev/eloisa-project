/** 041: only a signed auth_time from a verified OIDC response may reach this policy. */
export const FRESH_AUTHENTICATION_SECONDS = 300;
const CLOCK_SKEW_SECONDS = 5;

export function verifiedFreshAuthenticationTime(
  claim: unknown,
  requestedAt: Date,
  now: Date,
): Date | null {
  if (typeof claim !== 'number' || !Number.isSafeInteger(claim) || claim <= 0) return null;
  const requested = requestedAt.getTime() / 1000;
  const current = now.getTime() / 1000;
  if (!Number.isFinite(requested) || !Number.isFinite(current) || requested > current) return null;
  if (claim < requested - CLOCK_SKEW_SECONDS || claim < current - FRESH_AUTHENTICATION_SECONDS
    || claim > current + CLOCK_SKEW_SECONDS) return null;
  return new Date(claim * 1000);
}
