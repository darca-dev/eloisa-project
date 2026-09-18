import {
  type ScryptOptions,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from 'node:crypto';

/**
 * Derivación y verificación de la credencial institucional
 * (TASK-MUNICIPALITY-CORE-01, §Permisos 5 y §Seguridad).
 *
 * A diferencia del token de sesión —256 bits de entropía uniforme, para el que
 * SHA-256 basta—, la credencial institucional la elige una persona que
 * administra el despliegue. Por eso se deriva con `scrypt`, que es lento a
 * propósito y encarece un ataque por diccionario.
 *
 * `scrypt` viene con Node y NO añade ninguna dependencia nueva al repositorio.
 *
 * El secreto en claro NUNCA se persiste, no se registra y no se devuelve.
 */

/**
 * `scrypt` con opciones de coste, envuelto en una promesa.
 *
 * No se usa `promisify` porque su tipado elige la sobrecarga de tres argumentos
 * y no admite el objeto de opciones; envolver a mano mantiene el tipado exacto.
 */
function scrypt(
  secret: string,
  salt: string,
  keyLength: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(secret, salt, keyLength, options, (error, derived) => {
      if (error !== null) {
        reject(error);

        return;
      }

      resolve(derived);
    });
  });
}

/** Bytes de la sal. 16 bytes = 128 bits. */
export const SECRET_SALT_BYTES = 16;

/** Bytes de la derivación. 64 bytes = 512 bits. */
export const SECRET_HASH_BYTES = 64;

/**
 * Parámetros de coste. `N * r * 128` bytes de memoria: 16384 * 8 * 128 = 16 MiB,
 * dentro del `maxmem` por defecto de Node.
 */
const SCRYPT_OPTIONS: ScryptOptions = { N: 16_384, r: 8, p: 1 };

export interface DerivedSecret {
  readonly hash: string;
  readonly salt: string;
}

/** Deriva la credencial con una sal aleatoria nueva. */
export async function deriveSecret(secret: string): Promise<DerivedSecret> {
  const salt = randomBytes(SECRET_SALT_BYTES).toString('hex');
  return { hash: await hashWithSalt(secret, salt), salt };
}

/** Deriva la credencial con una sal ya conocida. */
export async function hashWithSalt(secret: string, salt: string): Promise<string> {
  const derived = await scrypt(secret, salt, SECRET_HASH_BYTES, SCRYPT_OPTIONS);

  return derived.toString('hex');
}

/**
 * Comprueba una credencial contra su derivación almacenada.
 *
 * La comparación es en tiempo constante. Un almacenamiento con forma inesperada
 * devuelve `false` en lugar de lanzar: una fila corrupta no debe convertirse en
 * un error del servidor que además distinga el caso.
 */
export async function verifySecret(
  candidate: string,
  stored: DerivedSecret,
): Promise<boolean> {
  if (!/^[0-9a-f]+$/u.test(stored.salt) || !/^[0-9a-f]+$/u.test(stored.hash)) {
    return false;
  }

  const derived = await hashWithSalt(candidate, stored.salt);

  if (derived.length !== stored.hash.length) {
    return false;
  }

  return timingSafeEqual(Buffer.from(derived, 'utf8'), Buffer.from(stored.hash, 'utf8'));
}
