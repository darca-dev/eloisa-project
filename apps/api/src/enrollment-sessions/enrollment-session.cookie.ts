import { type EnrollmentSessionConfig } from '../config/environment';

/**
 * Serialización y lectura de la cookie de sesión de inscripción
 * (TASK-MVP-CORE-01 §4, §9).
 *
 * La cookie:
 * - es `HttpOnly`, de modo que JavaScript de la página no puede leerla;
 * - es `Secure` fuera de desarrollo local;
 * - lleva `SameSite` configurable según la topología real del despliegue;
 * - tiene expiración limitada;
 * - contiene ÚNICAMENTE el token opaco: ni PII, ni `patientId`, ni tenant.
 *
 * Se implementa aquí, sin dependencia adicional, porque el formato necesario es
 * una única cookie con atributos fijos.
 */

/** Construye la cabecera `Set-Cookie` que entrega el token de sesión. */
export function buildSessionCookie(
  token: string,
  config: EnrollmentSessionConfig,
): string {
  return serializeCookie(token, config, config.ttlSeconds);
}

/** Construye la cabecera `Set-Cookie` que borra la cookie de sesión. */
export function buildSessionClearCookie(config: EnrollmentSessionConfig): string {
  return serializeCookie('', config, 0);
}

function serializeCookie(
  value: string,
  config: EnrollmentSessionConfig,
  maxAgeSeconds: number,
): string {
  const attributes = [
    `${config.cookieName}=${value}`,
    'Path=/',
    'HttpOnly',
    `SameSite=${capitalize(config.sameSite)}`,
    `Max-Age=${maxAgeSeconds}`,
  ];

  if (config.secure) {
    attributes.push('Secure');
  }

  if (config.domain !== undefined) {
    attributes.push(`Domain=${config.domain}`);
  }

  return attributes.join('; ');
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * Extrae el valor de una cookie de la cabecera `Cookie`.
 *
 * Devuelve `null` si la cabecera falta, si la cookie no está presente o si su
 * valor está vacío. No lanza: una cabecera malformada de un cliente hostil no
 * debe convertirse en un error del servidor.
 */
export function readCookie(header: string | undefined, name: string): string | null {
  if (header === undefined || header.length === 0) {
    return null;
  }

  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) {
      continue;
    }

    if (part.slice(0, separator).trim() !== name) {
      continue;
    }

    const value = part.slice(separator + 1).trim();
    return value.length === 0 ? null : value;
  }

  return null;
}
