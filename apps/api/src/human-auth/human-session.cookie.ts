import { type HumanCookieOptions } from './human-auth.config';
import {
  HUMAN_AUTH_ATTEMPT_COOKIE_NAME,
  HUMAN_SESSION_COOKIE_NAME,
} from './human-auth.contract';

/**
 * Serialización de las cookies HUMANAS
 * (IDENTITY-RELATIONSHIPS-CORE-01 §4.3, AD-06).
 *
 * Son DOS cookies con vidas distintas y ninguna sustituye a la otra:
 *
 * - `merdn_human_session` transporta el token opaco de la sesión humana;
 * - `merdn_human_auth_attempt` transporta el token opaco del intento en curso y
 *   se borra en cuanto el callback lo consume.
 *
 * Ambas son `HttpOnly`, llevan `SameSite` según la topología real del
 * despliegue, son `Secure` fuera de desarrollo local y contienen ÚNICAMENTE el
 * token: ni tenant, ni cuenta, ni persona, ni rol, ni ningún dato personal.
 *
 * Son además DISTINTAS de `merdn_enrollment_session` y de
 * `merdn_institutional_session`. Presentar una donde se espera otra no
 * autentica: cada superficie lee exclusivamente el nombre que le corresponde.
 */

/** Construye la cabecera que entrega el token de sesión humana. */
export function buildHumanSessionCookie(
  token: string,
  options: HumanCookieOptions,
  ttlSeconds: number,
): string {
  return serialize(HUMAN_SESSION_COOKIE_NAME, token, options, ttlSeconds);
}

/** Construye la cabecera que borra la cookie de sesión humana. */
export function buildHumanSessionClearCookie(options: HumanCookieOptions): string {
  return serialize(HUMAN_SESSION_COOKIE_NAME, '', options, 0);
}

/** Construye la cabecera que entrega el token del intento en curso. */
export function buildHumanAuthAttemptCookie(
  token: string,
  options: HumanCookieOptions,
  ttlSeconds: number,
): string {
  return serialize(HUMAN_AUTH_ATTEMPT_COOKIE_NAME, token, options, ttlSeconds);
}

/** Construye la cabecera que borra la cookie del intento. */
export function buildHumanAuthAttemptClearCookie(options: HumanCookieOptions): string {
  return serialize(HUMAN_AUTH_ATTEMPT_COOKIE_NAME, '', options, 0);
}

function serialize(
  name: string,
  value: string,
  options: HumanCookieOptions,
  maxAgeSeconds: number,
): string {
  const attributes = [
    `${name}=${value}`,
    'Path=/',
    'HttpOnly',
    `SameSite=${capitalize(options.sameSite)}`,
    `Max-Age=${maxAgeSeconds}`,
  ];

  if (options.secure) {
    attributes.push('Secure');
  }

  if (options.domain !== undefined) {
    attributes.push(`Domain=${options.domain}`);
  }

  return attributes.join('; ');
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
