import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Primitivas de la credencial de sesión de inscripción
 * (TASK-MVP-CORE-01 §4, §9, decisión cerrada 18.3).
 *
 * Garantías:
 * - el token se genera con un generador criptográficamente seguro y 256 bits de
 *   entropía, de modo que no es adivinable ni enumerable;
 * - el token en claro NUNCA se persiste ni se registra: solo su hash SHA-256;
 * - con 256 bits de entropía uniforme, el hash no necesita derivación lenta:
 *   no existe un espacio de búsqueda practicable como el de una contraseña;
 * - la comparación de hashes usa tiempo constante.
 */

/** Bytes de entropía del token. 32 bytes = 256 bits. */
export const SESSION_TOKEN_BYTES = 32;

/** Longitud de la representación base64url de 32 bytes. */
export const SESSION_TOKEN_LENGTH = 43;

/** Genera un token de sesión nuevo. El llamador solo debe enviarlo por cookie. */
export function generateSessionToken(): string {
  return randomBytes(SESSION_TOKEN_BYTES).toString('base64url');
}

/** Hash almacenable del token. Es la única forma que toca la base de datos. */
export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/** Comprueba que el token tiene la forma emitida por esta aplicación. */
export function isWellFormedSessionToken(token: string): boolean {
  return token.length === SESSION_TOKEN_LENGTH && /^[A-Za-z0-9_-]+$/u.test(token);
}

/** Comparación en tiempo constante de dos hashes hexadecimales. */
export function hashesMatch(left: string, right: string): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8'));
}
