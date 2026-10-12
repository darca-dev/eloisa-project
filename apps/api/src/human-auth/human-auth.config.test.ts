import { describe, expect, it } from 'vitest';

import { type ApiEnvironment, type MerdnEnvironment } from '../config/environment';

import {
  HumanAuthConfigurationError,
  loadHumanAuthConfig,
} from './human-auth.config';
import {
  HUMAN_AUTH_DEFAULT_RETURN_TARGET,
  HUMAN_AUTH_ENV,
  HUMAN_AUTH_LOCAL_DOCKER_HOST,
  HUMAN_AUTH_RETURN_TARGETS,
  HUMAN_SESSION_IDLE_SECONDS,
  HUMAN_SESSION_TTL_SECONDS,
  isAllowedReturnTarget,
} from './human-auth.contract';

/**
 * Configuración del acceso HUMANO, verificada en las dos direcciones
 * (IDENTITY-RELATIONSHIPS-CORE-01 §12, continuación §6.1).
 *
 * Lo que se comprueba, y por qué importa cada cosa:
 *
 * 1. el emisor LOCAL sin TLS se admite SOLO en `development` y `test`, y solo
 *    contra bucle local o el host Docker aprobado. Admitirlo en otro entorno
 *    pondría un proveedor de juguete delante de datos que no lo son;
 * 2. `host.docker.internal` está en la allowlist de forma EXACTA. Un host que
 *    lo contenga como prefijo o sufijo NO entra: una comprobación por forma
 *    convertiría la allowlist en una invitación;
 * 3. el realm local queda prohibido en `mvp` incluso por HTTPS;
 * 4. una configuración PARCIAL lanza, y una configuración COMPLETAMENTE ausente
 *    deshabilita el módulo. La asimetría es deliberada: quedarse a medias sin
 *    que nadie se entere es peor que no estar aprovisionado;
 * 5. la clave del intento debe decodificar EXACTAMENTE 32 bytes;
 * 6. los destinos de retorno posteriores al login son una allowlist LITERAL.
 *    La raíz y `/acceso` —el selector de experiencias de MP04— caben en la
 *    lista; `//host-ajeno`, `/\host-ajeno` y las rutas casi iguales, no. Un
 *    destino elegido a voluntad convertiría el callback del login en una
 *    redirección abierta.
 *
 * NINGÚN valor de este archivo es real: todos son locales y ficticios.
 */

/** Clave ficticia de 32 bytes en hexadecimal. No es una clave real. */
const CLAVE_FICTICIA_32_BYTES = 'a'.repeat(64);

const ISSUER_DOCKER = `http://${HUMAN_AUTH_LOCAL_DOCKER_HOST}:8081/realms/merdn-local`;
const CALLBACK_LOCAL = 'http://127.0.0.1:3001/api/v1/human-auth/callback';

function entorno(merdnEnvironment: MerdnEnvironment): ApiEnvironment {
  return {
    merdnEnvironment,
    port: 3001,
    openApiPath: 'docs',
    runtimeRoleMode: 'enforce',
    hasSeparateRuntimeConnection: true,
    activeTenantCode: 'merdn-mvp',
    // Spec 024: en modo `enforce` la pareja confiable viaja completa. UUID FICTICIO.
    activeTenantId: '00000000-0000-4000-8000-000000000001',
    consent: { version: 'v1', purpose: 'INSCRIPCION_PACIENTE_MERDN' },
    enrollmentSession: {
      cookieName: 'merdn_enrollment_session',
      sameSite: 'lax',
      secure: false,
      domain: undefined,
      ttlSeconds: 43_200,
    },
    webOrigins: ['http://127.0.0.1:3000'],
    enrollmentRateLimit: { maxRequests: 10, windowSeconds: 900 },
  };
}

function variables(
  overrides: Readonly<Record<string, string | undefined>> = {},
): Readonly<Record<string, string | undefined>> {
  return {
    [HUMAN_AUTH_ENV.issuer]: ISSUER_DOCKER,
    [HUMAN_AUTH_ENV.clientId]: 'merdn-human-web',
    [HUMAN_AUTH_ENV.callbackUri]: CALLBACK_LOCAL,
    [HUMAN_AUTH_ENV.attemptKey]: CLAVE_FICTICIA_32_BYTES,
    ...overrides,
  };
}

describe('Configuración del acceso humano', () => {
  describe('emisor local y allowlist de host', () => {
    it('admite merdn.localhost exacto solo en entornos locales', () => {
      for (const name of ['development', 'test'] as const) {
        expect(loadHumanAuthConfig(variables({ [HUMAN_AUTH_ENV.issuer]: 'http://merdn.localhost:8081/realms/merdn-local' }), entorno(name)).enabled).toBe(true);
      }
      for (const issuer of ['http://merdn.localhost:8081/realms/merdn-local', 'https://merdn.localhost:8081/realms/merdn-local']) {
        expect(() => loadHumanAuthConfig(variables({ [HUMAN_AUTH_ENV.issuer]: issuer }), entorno('mvp'))).toThrow(HumanAuthConfigurationError);
      }
      for (const host of ['merdn.localhost.invalid', 'other.localhost', 'prefix-merdn.localhost']) {
        expect(() => loadHumanAuthConfig(variables({ [HUMAN_AUTH_ENV.issuer]: `http://${host}:8081/realms/merdn-local` }), entorno('test'))).toThrow(HumanAuthConfigurationError);
      }
    });
    it('admite el emisor local sin TLS en development y en test', () => {
      for (const nombre of ['development', 'test'] as const) {
        const config = loadHumanAuthConfig(variables(), entorno(nombre));

        expect(config.enabled).toBe(true);

        if (config.enabled) {
          expect(config.oidc.issuer).toBe(ISSUER_DOCKER);
          expect(config.oidc.insecureLocalIssuer).toBe(true);
        }
      }
    });

    it('admite el bucle local además del host Docker aprobado', () => {
      const config = loadHumanAuthConfig(
        variables({
          [HUMAN_AUTH_ENV.issuer]: 'http://127.0.0.1:8081/realms/merdn-local',
        }),
        entorno('development'),
      );

      expect(config.enabled).toBe(true);
    });

    it('la allowlist de host Docker es EXACTA y no admite parecidos', () => {
      /*
       * Estos tres hosts contienen el nombre aprobado como subcadena. Si la
       * comprobación fuera por forma —`includes`, prefijo o sufijo—, los tres
       * pasarían y un atacante que controlara la resolución de nombres podría
       * colocar su propio proveedor detrás de uno de ellos.
       */
      const parecidos = [
        `http://${HUMAN_AUTH_LOCAL_DOCKER_HOST}.ejemplo.invalid:8081/realms/merdn-local`,
        `http://prefijo-${HUMAN_AUTH_LOCAL_DOCKER_HOST}:8081/realms/merdn-local`,
        'http://docker.internal:8081/realms/merdn-local',
      ];

      for (const issuer of parecidos) {
        expect(() =>
          loadHumanAuthConfig(
            variables({ [HUMAN_AUTH_ENV.issuer]: issuer }),
            entorno('development'),
          ),
        ).toThrow(HumanAuthConfigurationError);
      }
    });

    it('rechaza un emisor sin TLS fuera de desarrollo aunque sea local', () => {
      expect(() =>
        loadHumanAuthConfig(
          variables({
            [HUMAN_AUTH_ENV.issuer]: ISSUER_DOCKER,
          }),
          entorno('mvp'),
        ),
      ).toThrow(HumanAuthConfigurationError);
    });

    it('rechaza el realm local en mvp incluso por HTTPS', () => {
      expect(() =>
        loadHumanAuthConfig(
          variables({
            [HUMAN_AUTH_ENV.issuer]: 'https://identidad.ejemplo.invalid/realms/merdn-local',
            [HUMAN_AUTH_ENV.callbackUri]:
              'https://api.ejemplo.invalid/api/v1/human-auth/callback',
          }),
          entorno('mvp'),
        ),
      ).toThrow(HumanAuthConfigurationError);
    });

    it('rechaza credenciales embebidas, consulta y fragmento en el emisor', () => {
      const prohibidos = [
        'http://persona:clave@127.0.0.1:8081/realms/merdn-local',
        'http://127.0.0.1:8081/realms/merdn-local?x=1',
        'http://127.0.0.1:8081/realms/merdn-local#x',
      ];

      for (const issuer of prohibidos) {
        expect(() =>
          loadHumanAuthConfig(
            variables({ [HUMAN_AUTH_ENV.issuer]: issuer }),
            entorno('development'),
          ),
        ).toThrow(HumanAuthConfigurationError);
      }
    });
  });

  describe('fail-closed de la configuración', () => {
    it('deshabilita el módulo cuando NO hay ninguna variable indispensable', () => {
      const config = loadHumanAuthConfig({}, entorno('development'));

      expect(config.enabled).toBe(false);

      if (!config.enabled) {
        // El motivo nombra las variables y NUNCA un valor.
        expect(config.reason).toContain(HUMAN_AUTH_ENV.issuer);
        expect(config.reason).not.toContain(CLAVE_FICTICIA_32_BYTES);
      }
    });

    it('lanza cuando la configuración está INCOMPLETA', () => {
      const indispensables = [
        HUMAN_AUTH_ENV.issuer,
        HUMAN_AUTH_ENV.clientId,
        HUMAN_AUTH_ENV.callbackUri,
        HUMAN_AUTH_ENV.attemptKey,
      ];

      for (const ausente of indispensables) {
        expect(() =>
          loadHumanAuthConfig(
            variables({ [ausente]: undefined }),
            entorno('development'),
          ),
        ).toThrow(HumanAuthConfigurationError);
      }
    });

    it('exige exactamente 32 bytes en la clave del intento', () => {
      const invalidas = ['a'.repeat(62), 'a'.repeat(66), 'no-es-una-clave'];

      for (const clave of invalidas) {
        expect(() =>
          loadHumanAuthConfig(
            variables({ [HUMAN_AUTH_ENV.attemptKey]: clave }),
            entorno('development'),
          ),
        ).toThrow(HumanAuthConfigurationError);
      }

      const config = loadHumanAuthConfig(variables(), entorno('development'));

      expect(config.enabled).toBe(true);

      if (config.enabled) {
        expect(config.attemptKey).toHaveLength(32);
      }
    });

    it('prohíbe comodines en la URI de retorno', () => {
      expect(() =>
        loadHumanAuthConfig(
          variables({
            [HUMAN_AUTH_ENV.callbackUri]: 'http://127.0.0.1:3001/api/v1/*',
          }),
          entorno('development'),
        ),
      ).toThrow(HumanAuthConfigurationError);
    });

    it('prohíbe comodines en los orígenes web admitidos', () => {
      const conComodin: ApiEnvironment = {
        ...entorno('development'),
        webOrigins: ['http://*.ejemplo.invalid'],
      };

      expect(() => loadHumanAuthConfig(variables(), conComodin)).toThrow(
        HumanAuthConfigurationError,
      );
    });

    it('nunca deja que un valor de configuración llegue al mensaje de error', () => {
      try {
        loadHumanAuthConfig(
          variables({ [HUMAN_AUTH_ENV.attemptKey]: 'clave-ficticia-demasiado-corta' }),
          entorno('development'),
        );
        expect.unreachable('debía lanzar');
      } catch (error) {
        expect(error).toBeInstanceOf(HumanAuthConfigurationError);
        expect((error as Error).message).toContain(HUMAN_AUTH_ENV.attemptKey);
        expect((error as Error).message).not.toContain(
          'clave-ficticia-demasiado-corta',
        );
      }
    });
  });

  describe('parámetros temporales aprobados', () => {
    it('usa 8 horas de vigencia absoluta y 30 minutos de inactividad', () => {
      const config = loadHumanAuthConfig(variables(), entorno('development'));

      expect(config.enabled).toBe(true);

      if (config.enabled) {
        expect(config.sessionTtlSeconds).toBe(HUMAN_SESSION_TTL_SECONDS);
        expect(config.sessionIdleSeconds).toBe(HUMAN_SESSION_IDLE_SECONDS);
        expect(config.attemptTtlSeconds).toBe(600);
      }
    });

    it('no admite alargar la vigencia por encima del contrato', () => {
      expect(() =>
        loadHumanAuthConfig(
          variables({
            [HUMAN_AUTH_ENV.sessionTtlSeconds]: String(HUMAN_SESSION_TTL_SECONDS + 1),
          }),
          entorno('development'),
        ),
      ).toThrow(HumanAuthConfigurationError);

      expect(() =>
        loadHumanAuthConfig(
          variables({
            [HUMAN_AUTH_ENV.sessionIdleSeconds]: String(HUMAN_SESSION_IDLE_SECONDS + 1),
          }),
          entorno('development'),
        ),
      ).toThrow(HumanAuthConfigurationError);
    });
  });

  describe('destinos de retorno posteriores al login', () => {
    it('admite exactamente la raíz y el selector de experiencias', () => {
      expect([...HUMAN_AUTH_RETURN_TARGETS]).toStrictEqual(['/', '/acceso']);
    });

    it('usa la raíz como destino por defecto', () => {
      expect(HUMAN_AUTH_DEFAULT_RETURN_TARGET).toBe('/');
    });

    it('rechaza cualquier destino fuera de la allowlist, incluidos los parecidos', () => {
      expect(isAllowedReturnTarget('/')).toBe(true);
      expect(isAllowedReturnTarget('/acceso')).toBe(true);

      expect(isAllowedReturnTarget('')).toBe(false);
      expect(isAllowedReturnTarget('/acceso/..')).toBe(false);
      expect(isAllowedReturnTarget('/acceso/../admin')).toBe(false);
      expect(isAllowedReturnTarget('//acceso')).toBe(false);
      expect(isAllowedReturnTarget('/\\acceso')).toBe(false);
      expect(isAllowedReturnTarget('https://ajeno.test/acceso')).toBe(false);
      expect(isAllowedReturnTarget(undefined)).toBe(false);
    });
  });
});
