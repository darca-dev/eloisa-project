import { type SameSiteValue } from '../config/environment';

import { INSTITUTIONAL_SESSION_COOKIE_NAME } from './institutional-auth.contract';

/**
 * Serialización de la cookie de sesión institucional
 * (TASK-MUNICIPALITY-CORE-01, §Permisos 5).
 *
 * La cookie:
 * - es `HttpOnly`, de modo que el JavaScript de Alcaldía no puede leerla;
 * - es `Secure` fuera de desarrollo local;
 * - lleva `SameSite` según la topología real del despliegue;
 * - tiene expiración limitada;
 * - contiene ÚNICAMENTE el token opaco: ni tenant, ni rol, ni identificador de
 *   identidad, ni ningún dato personal.
 *
 * La lectura de la cabecera `Cookie` reutiliza `readCookie`, que es una función
 * de análisis de HTTP genérica y no aporta ninguna semántica de inscripción.
 */

/** Atributos de transporte de la cookie institucional. */
export interface InstitutionalCookieOptions {
  readonly sameSite: SameSiteValue;
  readonly secure: boolean;
  readonly domain: string | undefined;
  readonly ttlSeconds: number;
}

/** Construye la cabecera `Set-Cookie` que entrega el token de sesión. */
export function buildInstitutionalSessionCookie(
  token: string,
  options: InstitutionalCookieOptions,
): string {
  return serialize(token, options, options.ttlSeconds);
}

/** Construye la cabecera `Set-Cookie` que borra la cookie institucional. */
export function buildInstitutionalSessionClearCookie(
  options: InstitutionalCookieOptions,
): string {
  return serialize('', options, 0);
}

function serialize(
  value: string,
  options: InstitutionalCookieOptions,
  maxAgeSeconds: number,
): string {
  const attributes = [
    `${INSTITUTIONAL_SESSION_COOKIE_NAME}=${value}`,
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
