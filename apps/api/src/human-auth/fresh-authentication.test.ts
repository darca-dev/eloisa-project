import { describe, expect, it } from 'vitest';
import { verifiedFreshAuthenticationTime } from './fresh-authentication';

const now = new Date('2026-10-12T20:00:00Z');
const seconds = now.getTime() / 1000;
describe('fresh signed authentication time', () => {
  it('accepts authentication performed during the persisted step-up attempt', () => {
    expect(verifiedFreshAuthenticationTime(seconds - 10, new Date(now.getTime() - 20000), now)?.getTime()).toBe((seconds - 10) * 1000);
  });
  it('rejects a recent session created from SSO that predates the attempt', () => {
    expect(verifiedFreshAuthenticationTime(seconds - 60, new Date(now.getTime() - 20000), now)).toBeNull();
  });
  it('rejects stale authentication even with an older attempt', () => {
    expect(verifiedFreshAuthenticationTime(seconds - 301, new Date(now.getTime() - 400000), now)).toBeNull();
  });
  it('rejects missing, malformed or future signed times', () => {
    for (const claim of [undefined, null, '123', NaN, Infinity, -1, seconds + 6, seconds - 1.5]) {
      expect(verifiedFreshAuthenticationTime(claim, new Date(now.getTime() - 20000), now)).toBeNull();
    }
  });
});
