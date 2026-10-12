import { readCookie } from '../enrollment-sessions/enrollment-session.cookie';
import { generateAttemptToken, isWellFormedAttemptToken } from '../human-auth/human-auth-attempt.crypto';

export const ACCESS_REGISTRATION_ATTEMPT_COOKIE = 'merdn_access_registration_attempt';
export const ACCESS_REGISTRATION_ATTEMPT_SECONDS = 30 * 24 * 60 * 60;
export function accessRegistrationAttempt(cookie: string | undefined): string | null {
  const value = readCookie(cookie, ACCESS_REGISTRATION_ATTEMPT_COOKIE);
  return value !== null && isWellFormedAttemptToken(value) ? value : null;
}
export function accessRegistrationAttemptCookie(cookie: string | undefined): string {
  const token = accessRegistrationAttempt(cookie) ?? generateAttemptToken();
  return `${ACCESS_REGISTRATION_ATTEMPT_COOKIE}=${token}; Path=/api/v1/access-requests; Max-Age=${ACCESS_REGISTRATION_ATTEMPT_SECONDS}; HttpOnly; Secure; SameSite=Strict`;
}
