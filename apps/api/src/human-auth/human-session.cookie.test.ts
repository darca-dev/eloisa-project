import { describe, expect, it } from 'vitest';

import { INSTITUTIONAL_SESSION_COOKIE_NAME } from '../institutional-auth/institutional-auth.contract';

import { type HumanCookieOptions } from './human-auth.config';
import {
  HUMAN_AUTH_ATTEMPT_COOKIE_NAME,
  HUMAN_SESSION_COOKIE_NAME,
} from './human-auth.contract';
import {
  buildHumanAuthAttemptClearCookie,
  buildHumanAuthAttemptCookie,
  buildHumanSessionClearCookie,
  buildHumanSessionCookie,
} from './human-session.cookie';

/**
 * Cookies humanas y su SEPARACIÓN de las demás (continuación §6.1).
 *
 * La propiedad central que se comprueba aquí no es el formato: es que los tres
 * nombres de cookie —autoinscripción, institucional y humana— son DISTINTOS.
 * Si dos coincidieran, un navegador con las dos abiertas podría hacer que una
 * superficie leyera la credencial de la otra y eligiera un principal ambiguo.
 */

const OPCIONES_DESARROLLO: HumanCookieOptions = {
  sameSite: 'lax',
  secure: false,
  domain: undefined,
};

const OPCIONES_SEGURAS: HumanCookieOptions = {
  sameSite: 'none',
  secure: true,
  domain: 'ejemplo.invalid',
};

const TOKEN_FICTICIO = 'token-opaco-ficticio-de-pruebas';

describe('Cookies de la superficie humana', () => {
  it('los tres nombres de cookie son distintos entre sí', () => {
    const nombres = new Set([
      HUMAN_SESSION_COOKIE_NAME,
      HUMAN_AUTH_ATTEMPT_COOKIE_NAME,
      INSTITUTIONAL_SESSION_COOKIE_NAME,
      'merdn_enrollment_session',
    ]);

    expect(nombres.size).toBe(4);
  });

  it('la cookie de sesión es HttpOnly, con Path y vigencia declaradas', () => {
    const cabecera = buildHumanSessionCookie(
      TOKEN_FICTICIO,
      OPCIONES_DESARROLLO,
      28_800,
    );

    expect(cabecera).toContain(`${HUMAN_SESSION_COOKIE_NAME}=${TOKEN_FICTICIO}`);
    expect(cabecera).toContain('HttpOnly');
    expect(cabecera).toContain('Path=/');
    expect(cabecera).toContain('SameSite=Lax');
    expect(cabecera).toContain('Max-Age=28800');
    expect(cabecera).not.toContain('Secure');
  });

  it('añade Secure y Domain cuando la topología lo exige', () => {
    const cabecera = buildHumanSessionCookie(TOKEN_FICTICIO, OPCIONES_SEGURAS, 60);

    expect(cabecera).toContain('SameSite=None');
    expect(cabecera).toContain('Secure');
    expect(cabecera).toContain('Domain=ejemplo.invalid');
  });

  it('la cookie del intento es distinta de la de sesión y transitoria', () => {
    const intento = buildHumanAuthAttemptCookie(
      TOKEN_FICTICIO,
      OPCIONES_DESARROLLO,
      600,
    );

    expect(intento).toContain(`${HUMAN_AUTH_ATTEMPT_COOKIE_NAME}=`);
    expect(intento).not.toContain(`${HUMAN_SESSION_COOKIE_NAME}=`);
    expect(intento).toContain('Max-Age=600');
    expect(intento).toContain('HttpOnly');
  });

  it('las cabeceras de borrado vacían el valor y anulan la vigencia', () => {
    const sesion = buildHumanSessionClearCookie(OPCIONES_DESARROLLO);
    const intento = buildHumanAuthAttemptClearCookie(OPCIONES_DESARROLLO);

    expect(sesion).toContain(`${HUMAN_SESSION_COOKIE_NAME}=;`);
    expect(sesion).toContain('Max-Age=0');
    expect(intento).toContain(`${HUMAN_AUTH_ATTEMPT_COOKIE_NAME}=;`);
    expect(intento).toContain('Max-Age=0');
  });

  it('la cookie no transporta tenant, cuenta, persona ni rol', () => {
    const cabecera = buildHumanSessionCookie(
      TOKEN_FICTICIO,
      OPCIONES_DESARROLLO,
      28_800,
    );

    for (const prohibido of ['tenant', 'account', 'person', 'role', 'patient']) {
      expect(cabecera.toLowerCase()).not.toContain(prohibido);
    }
  });
});
