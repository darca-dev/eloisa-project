import { describe, expect, it } from 'vitest';

import { type EnrollmentSessionConfig } from '../config/environment';

import {
  buildSessionClearCookie,
  buildSessionCookie,
  readCookie,
} from './enrollment-session.cookie';
import {
  SESSION_TOKEN_LENGTH,
  generateSessionToken,
  hashSessionToken,
  hashesMatch,
  isWellFormedSessionToken,
} from './enrollment-session.tokens';

/**
 * Credencial de sesión de inscripción (TASK-MVP-CORE-01 §9, §12).
 */

const CONFIG_DESARROLLO: EnrollmentSessionConfig = {
  cookieName: 'merdn_enrollment_session',
  sameSite: 'lax',
  secure: false,
  domain: undefined,
  ttlSeconds: 3600,
};

const CONFIG_PRODUCCION: EnrollmentSessionConfig = {
  cookieName: 'merdn_enrollment_session',
  sameSite: 'none',
  secure: true,
  domain: 'app.ejemplo.local',
  ttlSeconds: 900,
};

describe('token de sesión', () => {
  it('genera tokens con la longitud y el alfabeto esperados', () => {
    const token = generateSessionToken();

    expect(token).toHaveLength(SESSION_TOKEN_LENGTH);
    expect(isWellFormedSessionToken(token)).toBe(true);
  });

  it('no repite tokens', () => {
    const tokens = new Set(Array.from({ length: 500 }, () => generateSessionToken()));
    expect(tokens.size).toBe(500);
  });

  it('el hash es estable, hexadecimal de 64 caracteres y distinto del token', () => {
    const token = generateSessionToken();
    const hash = hashSessionToken(token);

    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain(token);
    expect(hashSessionToken(token)).toBe(hash);
  });

  it('tokens distintos producen hashes distintos', () => {
    expect(hashSessionToken('a'.repeat(43))).not.toBe(hashSessionToken('b'.repeat(43)));
  });

  it('rechaza tokens con forma inesperada', () => {
    for (const value of ['', 'corto', 'a'.repeat(44), `${'a'.repeat(42)}+`]) {
      expect(isWellFormedSessionToken(value)).toBe(false);
    }
  });

  it('compara hashes sin lanzar ante longitudes distintas', () => {
    expect(hashesMatch('abc', 'abcd')).toBe(false);
    expect(hashesMatch('abcd', 'abcd')).toBe(true);
  });
});

describe('cookie de sesión', () => {
  it('es HttpOnly, con Path, SameSite y expiración', () => {
    const cookie = buildSessionCookie('token-de-prueba', CONFIG_DESARROLLO);

    expect(cookie).toContain('merdn_enrollment_session=token-de-prueba');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Path=/');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Max-Age=3600');
  });

  it('no incluye Secure en desarrollo local y sí fuera de él', () => {
    expect(buildSessionCookie('t', CONFIG_DESARROLLO)).not.toContain('Secure');
    expect(buildSessionCookie('t', CONFIG_PRODUCCION)).toContain('Secure');
  });

  it('incluye el dominio solo cuando está configurado', () => {
    expect(buildSessionCookie('t', CONFIG_DESARROLLO)).not.toContain('Domain=');
    expect(buildSessionCookie('t', CONFIG_PRODUCCION)).toContain(
      'Domain=app.ejemplo.local',
    );
  });

  it('no transporta identificadores ni datos personales', () => {
    const cookie = buildSessionCookie('token-de-prueba', CONFIG_PRODUCCION);

    expect(cookie.toLowerCase()).not.toContain('patient');
    expect(cookie.toLowerCase()).not.toContain('tenant');
    expect(cookie.toLowerCase()).not.toContain('documento');
  });

  it('la cookie de borrado caduca inmediatamente y conserva los atributos', () => {
    const cookie = buildSessionClearCookie(CONFIG_DESARROLLO);

    expect(cookie).toContain('merdn_enrollment_session=;');
    expect(cookie).toContain('Max-Age=0');
    expect(cookie).toContain('HttpOnly');
  });
});

describe('lectura de la cookie', () => {
  it('extrae el valor entre varias cookies', () => {
    const header = 'otra=1; merdn_enrollment_session=abc123; ultima=2';
    expect(readCookie(header, 'merdn_enrollment_session')).toBe('abc123');
  });

  it('devuelve null cuando falta la cabecera o la cookie', () => {
    expect(readCookie(undefined, 'merdn_enrollment_session')).toBeNull();
    expect(readCookie('', 'merdn_enrollment_session')).toBeNull();
    expect(readCookie('otra=1', 'merdn_enrollment_session')).toBeNull();
  });

  it('devuelve null cuando el valor está vacío', () => {
    expect(readCookie('merdn_enrollment_session=', 'merdn_enrollment_session')).toBeNull();
  });

  it('no confunde una cookie cuyo nombre contiene al buscado', () => {
    const header = 'x_merdn_enrollment_session=intruso; merdn_enrollment_session=real';
    expect(readCookie(header, 'merdn_enrollment_session')).toBe('real');
  });

  it('tolera una cabecera malformada sin lanzar', () => {
    expect(readCookie('=;;;garbage', 'merdn_enrollment_session')).toBeNull();
  });
});
