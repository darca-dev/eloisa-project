import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

/**
 * Primitivas del intento de autenticación OIDC
 * (IDENTITY-RELATIONSHIPS-CORE-01 §4.3).
 *
 * Reparto deliberado entre HASH y CIFRADO:
 *
 * - `state` y `nonce` solo necesitan COMPARARSE. Se guardan hasheados: quien
 *   leyera la base no podría reconstruirlos para completar un intento ajeno.
 *   256 bits de entropía uniforme hacen innecesaria una derivación lenta, igual
 *   que en las sesiones ya existentes;
 * - el verifier PKCE debe RECUPERARSE en claro para enviarlo al token endpoint,
 *   de modo que un hash no sirve. Se cifra con AES-256-GCM, que además autentica
 *   el texto cifrado: una fila manipulada falla al descifrar en lugar de
 *   producir un verifier distinto y silencioso.
 *
 * El verifier en claro NUNCA se registra, no se devuelve y no sale de la
 * transacción del callback.
 */

/** Bytes de entropía del token opaco entregado al navegador. */
export const ATTEMPT_TOKEN_BYTES = 32;

/** Longitud de la representación base64url de 32 bytes. */
export const ATTEMPT_TOKEN_LENGTH = 43;

/** Bytes del vector de inicialización de AES-GCM. 12 bytes es el tamaño estándar. */
const GCM_IV_BYTES = 12;

/** Genera el token opaco del intento. Solo viaja en la cookie transitoria. */
export function generateAttemptToken(): string {
  return randomBytes(ATTEMPT_TOKEN_BYTES).toString('base64url');
}

/** Comprueba que el token tiene la forma emitida por esta aplicación. */
export function isWellFormedAttemptToken(token: string): boolean {
  return token.length === ATTEMPT_TOKEN_LENGTH && /^[A-Za-z0-9_-]+$/u.test(token);
}

/**
 * Hash almacenable de un valor de un solo uso.
 *
 * Se usa para el token del navegador, para `state` y para `nonce`. Los tres son
 * aleatorios y de alta entropía, de modo que SHA-256 basta: no existe un
 * espacio de búsqueda practicable como el de una contraseña.
 */
export function hashAttemptValue(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

/** Comparación en tiempo constante de dos hashes hexadecimales. */
export function attemptHashesMatch(left: string, right: string): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8'));
}

/**
 * Deriva el `nonce` del intento a partir de su identificador.
 *
 * POR QUÉ UNA DERIVACIÓN Y NO UN ALEATORIO GUARDADO: §4.3 exige que el `nonce`
 * se almacene HASHEADO, y un hash no puede deshacerse. Pero el `nonce` en claro
 * hace falta en el callback para compararlo con el del ID token firmado.
 *
 * Derivarlo con HMAC-SHA256 sobre la clave del intento resuelve las dos
 * exigencias a la vez:
 * - en la base solo vive su hash, exactamente como pide el modelo;
 * - el servidor lo RECALCULA cuando lo necesita, sin haberlo guardado;
 * - sin la clave es impredecible, de modo que quien leyera la base no podría
 *   reconstruirlo.
 *
 * El identificador del intento es aleatorio y de un solo uso, por lo que dos
 * intentos nunca comparten `nonce`. El prefijo de dominio impide que este valor
 * pueda confundirse con cualquier otro derivado futuro de la misma clave.
 */
export function deriveAttemptNonce(attemptId: string, key: Buffer): string {
  return createHmac('sha256', key)
    .update(`merdn:human-auth:nonce:${attemptId}`, 'utf8')
    .digest('base64url');
}

/** Verifier PKCE cifrado, tal como se persiste. */
export interface SealedVerifier {
  readonly ciphertext: string;
  readonly iv: string;
  readonly authTag: string;
}

/**
 * Cifra el verifier PKCE con AES-256-GCM.
 *
 * El IV es aleatorio por intento: reutilizarlo con la misma clave rompería la
 * confidencialidad de GCM. La etiqueta de autenticación se guarda aparte y se
 * exige al descifrar.
 */
export function sealVerifier(verifier: string, key: Buffer): SealedVerifier {
  const iv = randomBytes(GCM_IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, iv);

  const ciphertext = Buffer.concat([
    cipher.update(verifier, 'utf8'),
    cipher.final(),
  ]);

  return {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
  };
}

/**
 * Descifra el verifier PKCE.
 *
 * Devuelve `null` —y NO lanza— ante cualquier fallo: texto manipulado,
 * etiqueta incorrecta, IV con longitud inesperada o material corrupto. El
 * llamador trata ese `null` exactamente igual que un intento inexistente, de
 * modo que la respuesta al cliente sigue siendo uniforme y no revela cuál de
 * las causas ocurrió.
 */
export function openVerifier(sealed: SealedVerifier, key: Buffer): string | null {
  try {
    const iv = Buffer.from(sealed.iv, 'base64');

    if (iv.length !== GCM_IV_BYTES) {
      return null;
    }

    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(Buffer.from(sealed.authTag, 'base64'));

    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(sealed.ciphertext, 'base64')),
      decipher.final(),
    ]);

    return plaintext.toString('utf8');
  } catch {
    // El motivo exacto no se propaga ni se registra: distinguir «etiqueta
    // inválida» de «clave equivocada» sería un oráculo.
    return null;
  }
}
