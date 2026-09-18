import { randomBytes } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  ATTEMPT_TOKEN_LENGTH,
  attemptHashesMatch,
  deriveAttemptNonce,
  generateAttemptToken,
  hashAttemptValue,
  isWellFormedAttemptToken,
  openVerifier,
  sealVerifier,
} from './human-auth-attempt.crypto';

/**
 * Primitivas del intento OIDC (continuación §6.1).
 *
 * Lo que estas pruebas protegen, y qué se rompería sin ello:
 *
 * 1. el verifier PKCE va y vuelve intacto. Sin esto, el callback enviaría un
 *    verifier distinto y ningún inicio de sesión concluiría;
 * 2. cualquier MANIPULACIÓN del texto cifrado, del vector o de la etiqueta
 *    devuelve `null` en lugar de un verifier alterado. Es la propiedad que hace
 *    que una fila retocada en la base falle cerrada en vez de producir un
 *    material silenciosamente distinto;
 * 3. una clave distinta NO abre el material. Sin ello, la clave dejaría de ser
 *    el secreto que separa un despliegue de otro;
 * 4. el `nonce` se DERIVA de forma determinista del identificador y de la
 *    clave, y es impredecible sin la clave. Esa es la razón de que en la base
 *    solo viva su hash;
 * 5. la comparación de hashes es por igualdad exacta y no lanza ante longitudes
 *    distintas.
 */

/** Claves ficticias de 32 bytes. No son claves reales de ningún despliegue. */
const CLAVE_A = Buffer.alloc(32, 0x11);
const CLAVE_B = Buffer.alloc(32, 0x22);

const VERIFIER_FICTICIO = 'verificador-pkce-ficticio-de-pruebas-0123456789abcdef';

describe('Primitivas del intento de autenticación', () => {
  describe('token opaco del navegador', () => {
    it('genera tokens con la forma esperada y distintos entre sí', () => {
      const primero = generateAttemptToken();
      const segundo = generateAttemptToken();

      expect(primero).toHaveLength(ATTEMPT_TOKEN_LENGTH);
      expect(isWellFormedAttemptToken(primero)).toBe(true);
      expect(primero).not.toBe(segundo);
    });

    it('rechaza tokens con longitud o alfabeto no emitidos por la aplicación', () => {
      expect(isWellFormedAttemptToken('corto')).toBe(false);
      expect(isWellFormedAttemptToken(`${'a'.repeat(ATTEMPT_TOKEN_LENGTH - 1)}+`)).toBe(
        false,
      );
      expect(isWellFormedAttemptToken('a'.repeat(ATTEMPT_TOKEN_LENGTH + 1))).toBe(false);
    });
  });

  describe('cifrado AES-256-GCM del verifier', () => {
    it('recupera exactamente el verifier cifrado', () => {
      const sellado = sealVerifier(VERIFIER_FICTICIO, CLAVE_A);

      expect(sellado.ciphertext).not.toContain(VERIFIER_FICTICIO);
      expect(openVerifier(sellado, CLAVE_A)).toBe(VERIFIER_FICTICIO);
    });

    it('usa un vector distinto en cada sellado', () => {
      const primero = sealVerifier(VERIFIER_FICTICIO, CLAVE_A);
      const segundo = sealVerifier(VERIFIER_FICTICIO, CLAVE_A);

      // Reutilizar el vector con la misma clave rompería la confidencialidad.
      expect(primero.iv).not.toBe(segundo.iv);
      expect(primero.ciphertext).not.toBe(segundo.ciphertext);
    });

    it('devuelve null ante texto cifrado, vector o etiqueta manipulados', () => {
      const sellado = sealVerifier(VERIFIER_FICTICIO, CLAVE_A);

      const manipulados = [
        { ...sellado, ciphertext: alterarBase64(sellado.ciphertext) },
        { ...sellado, authTag: alterarBase64(sellado.authTag) },
        { ...sellado, iv: alterarBase64(sellado.iv) },
        { ...sellado, iv: randomBytes(8).toString('base64') },
        { ...sellado, ciphertext: 'no-es-base64-válido-!!!' },
      ];

      for (const material of manipulados) {
        expect(openVerifier(material, CLAVE_A)).toBeNull();
      }
    });

    it('devuelve null con una clave distinta', () => {
      const sellado = sealVerifier(VERIFIER_FICTICIO, CLAVE_A);

      expect(openVerifier(sellado, CLAVE_B)).toBeNull();
    });
  });

  describe('derivación del nonce', () => {
    it('es determinista para el mismo intento y la misma clave', () => {
      const identificador = '00000000-0000-4000-8000-000000000001';

      expect(deriveAttemptNonce(identificador, CLAVE_A)).toBe(
        deriveAttemptNonce(identificador, CLAVE_A),
      );
    });

    it('cambia con el intento y con la clave', () => {
      const primero = deriveAttemptNonce('00000000-0000-4000-8000-000000000001', CLAVE_A);
      const otroIntento = deriveAttemptNonce(
        '00000000-0000-4000-8000-000000000002',
        CLAVE_A,
      );
      const otraClave = deriveAttemptNonce(
        '00000000-0000-4000-8000-000000000001',
        CLAVE_B,
      );

      expect(primero).not.toBe(otroIntento);
      // Sin la clave, conocer el identificador NO permite predecir el `nonce`.
      expect(primero).not.toBe(otraClave);
    });
  });

  describe('comparación de hashes', () => {
    it('coincide solo con el mismo valor y no lanza con longitudes distintas', () => {
      const hash = hashAttemptValue('valor-ficticio');

      expect(attemptHashesMatch(hash, hashAttemptValue('valor-ficticio'))).toBe(true);
      expect(attemptHashesMatch(hash, hashAttemptValue('otro-valor'))).toBe(false);
      expect(attemptHashesMatch(hash, 'corto')).toBe(false);
    });

    it('el hash no permite reconstruir el valor', () => {
      expect(hashAttemptValue('valor-ficticio')).not.toContain('valor-ficticio');
    });
  });
});

/** Cambia un byte del material en base64 conservando su longitud. */
function alterarBase64(value: string): string {
  const bytes = Buffer.from(value, 'base64');
  bytes[0] = ((bytes[0] ?? 0) + 1) % 256;

  return bytes.toString('base64');
}
