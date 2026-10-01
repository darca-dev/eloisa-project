import { describe, expect, it } from 'vitest';

import {
  DEFAULT_ACTIVE_TENANT_CODE,
  DEFAULT_API_PORT,
  DEFAULT_CONSENT_PURPOSE,
  DEFAULT_CONSENT_VERSION,
  DEFAULT_ENROLLMENT_RATE_LIMIT_MAX,
  DEFAULT_ENROLLMENT_RATE_LIMIT_WINDOW_SECONDS,
  DEFAULT_OPENAPI_PATH,
  DEFAULT_SESSION_COOKIE_NAME,
  DEFAULT_SESSION_TTL_SECONDS,
  DEFAULT_WEB_ORIGINS,
  EnvironmentValidationError,
  loadApiEnvironment,
} from './environment';

const VALID_DATABASE_URL =
  'postgresql://merdn_dev:change-me-local-only@127.0.0.1:5432/merdn_dev?schema=public';

/** Credencial de EJECUCIÓN, distinta de la administrativa. Valores ficticios. */
const VALID_RUNTIME_URL =
  'postgresql://merdn_runtime:change-me-local-only@127.0.0.1:5432/merdn_dev?schema=public';

/**
 * Entorno mínimo válido en modo `enforce`: exige ambas credenciales, porque la
 * API no puede reutilizar la administrativa para ejecutarse.
 */
/**
 * UUID FICTICIO del tenant activo local. No identifica ninguna institución real
 * y no es un secreto: en un despliegue lo aporta el operador tras cargar los
 * datos de referencia.
 */
const VALID_ACTIVE_TENANT_ID = '00000000-0000-4000-8000-000000000001';

const BASE = {
  DATABASE_URL: VALID_DATABASE_URL,
  RUNTIME_DATABASE_URL: VALID_RUNTIME_URL,
  MERDN_ACTIVE_TENANT_ID: VALID_ACTIVE_TENANT_ID,
} as const;

describe('loadApiEnvironment', () => {
  it('aplica valores por defecto seguros cuando solo existe DATABASE_URL', () => {
    const environment = loadApiEnvironment({ ...BASE });

    expect(environment).toStrictEqual({
      merdnEnvironment: 'development',
      port: DEFAULT_API_PORT,
      openApiPath: DEFAULT_OPENAPI_PATH,
      runtimeRoleMode: 'enforce',
      hasSeparateRuntimeConnection: true,
      activeTenantCode: DEFAULT_ACTIVE_TENANT_CODE,
      activeTenantId: VALID_ACTIVE_TENANT_ID,
      consent: {
        version: DEFAULT_CONSENT_VERSION,
        purpose: DEFAULT_CONSENT_PURPOSE,
      },
      enrollmentSession: {
        cookieName: DEFAULT_SESSION_COOKIE_NAME,
        sameSite: 'lax',
        secure: false,
        domain: undefined,
        ttlSeconds: DEFAULT_SESSION_TTL_SECONDS,
      },
      webOrigins: DEFAULT_WEB_ORIGINS,
      enrollmentRateLimit: {
        maxRequests: DEFAULT_ENROLLMENT_RATE_LIMIT_MAX,
        windowSeconds: DEFAULT_ENROLLMENT_RATE_LIMIT_WINDOW_SECONDS,
      },
      keycloakPatient: undefined,
      accessProvisioning: undefined,
    });
  });

  it('no expone la cadena de conexión en la configuración resultante', () => {
    const environment = loadApiEnvironment({ ...BASE });

    expect(JSON.stringify(environment)).not.toContain('change-me-local-only');
    expect(Object.keys(environment)).not.toContain('databaseUrl');
  });

  it('falla con un mensaje claro cuando falta DATABASE_URL', () => {
    expect(() => loadApiEnvironment({})).toThrowError(EnvironmentValidationError);
    expect(() => loadApiEnvironment({})).toThrowError(/DATABASE_URL/);
  });

  /* ----------- Separación de credenciales (corrección final) -------------- */

  describe('credencial de ejecución separada de la administrativa', () => {
    it('en modo enforce NO arranca sin RUNTIME_DATABASE_URL', () => {
      expect(() =>
        loadApiEnvironment({ DATABASE_URL: VALID_DATABASE_URL }),
      ).toThrowError(/RUNTIME_DATABASE_URL/);
    });

    it('en modo enforce NO admite repliegue a la credencial administrativa', () => {
      expect(() =>
        loadApiEnvironment({
          DATABASE_URL: VALID_DATABASE_URL,
          RUNTIME_DATABASE_URL: VALID_DATABASE_URL,
        }),
      ).toThrowError(/RUNTIME_DATABASE_URL/);
    });

    it('rechaza una RUNTIME_DATABASE_URL que no sea PostgreSQL', () => {
      expect(() =>
        loadApiEnvironment({
          DATABASE_URL: VALID_DATABASE_URL,
          RUNTIME_DATABASE_URL: 'mysql://usuario:fictitious-not-a-secret@127.0.0.1/merdn',
        }),
      ).toThrowError(/RUNTIME_DATABASE_URL/);
    });

    it('no expone ninguna de las dos cadenas en la configuración resultante', () => {
      const serializado = JSON.stringify(loadApiEnvironment({ ...BASE }));

      expect(serializado).not.toContain('change-me-local-only');
      expect(serializado).not.toContain('merdn_runtime:');
      expect(serializado).not.toContain('127.0.0.1:5432');
    });

    it('solo el modo disabled admite ejecutar sin credencial separada', () => {
      const degradado = loadApiEnvironment({
        DATABASE_URL: VALID_DATABASE_URL,
        MERDN_RUNTIME_ROLE: 'disabled',
      });

      expect(degradado.runtimeRoleMode).toBe('disabled');
      expect(degradado.hasSeparateRuntimeConnection).toBe(false);
    });
  });

  it('falla cuando DATABASE_URL está vacía o solo contiene espacios', () => {
    expect(() => loadApiEnvironment({ DATABASE_URL: '   ' })).toThrowError(
      /DATABASE_URL/,
    );
  });

  it('rechaza una DATABASE_URL con esquema no PostgreSQL sin revelar su valor', () => {
    const secret = 'mysql://usuario:fictitious-not-a-secret@127.0.0.1:3306/merdn';

    try {
      loadApiEnvironment({ DATABASE_URL: secret });
      expect.unreachable('debía lanzar EnvironmentValidationError');
    } catch (error) {
      expect(error).toBeInstanceOf(EnvironmentValidationError);
      const message = (error as Error).message;
      expect(message).toContain('DATABASE_URL');
      expect(message).not.toContain('fictitious-not-a-secret');
      expect(message).not.toContain(secret);
    }
  });

  it('valida el rango y el formato de API_PORT', () => {
    expect(
      loadApiEnvironment({ ...BASE, API_PORT: '4000' }).port,
    ).toBe(4000);

    expect(() =>
      loadApiEnvironment({ ...BASE, API_PORT: 'abc' }),
    ).toThrowError(/API_PORT/);

    expect(() =>
      loadApiEnvironment({ ...BASE, API_PORT: '70000' }),
    ).toThrowError(/API_PORT/);
  });

  it('valida MERDN_ENVIRONMENT contra la lista permitida', () => {
    expect(
      loadApiEnvironment({ ...BASE, MERDN_ENVIRONMENT: 'mvp' })
        .merdnEnvironment,
    ).toBe('mvp');

    expect(() =>
      loadApiEnvironment({
        ...BASE,
        MERDN_ENVIRONMENT: 'produccion',
      }),
    ).toThrowError(/MERDN_ENVIRONMENT/);
  });

  it('normaliza y valida API_OPENAPI_PATH', () => {
    expect(
      loadApiEnvironment({
        ...BASE,
        API_OPENAPI_PATH: '/docs/',
      }).openApiPath,
    ).toBe('docs');

    expect(() =>
      loadApiEnvironment({ ...BASE, API_OPENAPI_PATH: '../etc' }),
    ).toThrowError(/API_OPENAPI_PATH/);
  });

  /* ---------------------- Configuración de TASK-MVP-CORE-01 ---------------- */

  it('activa Secure en la cookie de sesión fuera de desarrollo local', () => {
    const mvp = loadApiEnvironment({ ...BASE, MERDN_ENVIRONMENT: 'mvp' });

    expect(mvp.enrollmentSession.secure).toBe(true);

    const development = loadApiEnvironment({ ...BASE });
    expect(development.enrollmentSession.secure).toBe(false);
  });

  it('exige Secure cuando SameSite es none', () => {
    expect(() =>
      loadApiEnvironment({
        ...BASE,
        ENROLLMENT_SESSION_COOKIE_SAMESITE: 'none',
        ENROLLMENT_SESSION_COOKIE_SECURE: 'false',
      }),
    ).toThrowError(/ENROLLMENT_SESSION_COOKIE_SECURE/);

    expect(
      loadApiEnvironment({
        ...BASE,
        ENROLLMENT_SESSION_COOKIE_SAMESITE: 'none',
      }).enrollmentSession,
    ).toMatchObject({ sameSite: 'none', secure: true });
  });

  it('rechaza un SameSite no admitido', () => {
    expect(() =>
      loadApiEnvironment({
        ...BASE,
        ENROLLMENT_SESSION_COOKIE_SAMESITE: 'cualquiera',
      }),
    ).toThrowError(/ENROLLMENT_SESSION_COOKIE_SAMESITE/);
  });

  it('limita la vigencia de la sesión de inscripción a siete días', () => {
    expect(
      loadApiEnvironment({
        ...BASE,
        ENROLLMENT_SESSION_TTL_SECONDS: '3600',
      }).enrollmentSession.ttlSeconds,
    ).toBe(3600);

    expect(() =>
      loadApiEnvironment({
        ...BASE,
        ENROLLMENT_SESSION_TTL_SECONDS: '9999999',
      }),
    ).toThrowError(/ENROLLMENT_SESSION_TTL_SECONDS/);
  });

  it('normaliza la lista de orígenes web autorizados', () => {
    expect(
      loadApiEnvironment({
        ...BASE,
        API_WEB_ORIGINS: 'https://web.ejemplo.local/ , http://127.0.0.1:3000',
      }).webOrigins,
    ).toStrictEqual(['https://web.ejemplo.local', 'http://127.0.0.1:3000']);

    expect(() =>
      loadApiEnvironment({
        ...BASE,
        API_WEB_ORIGINS: 'ftp://web.ejemplo.local',
      }),
    ).toThrowError(/API_WEB_ORIGINS/);
  });

  it('aplica el rol runtime por defecto y solo admite modos conocidos', () => {
    expect(
      loadApiEnvironment({ ...BASE }).runtimeRoleMode,
    ).toBe('enforce');

    expect(
      loadApiEnvironment({
        ...BASE,
        MERDN_RUNTIME_ROLE: 'disabled',
      }).runtimeRoleMode,
    ).toBe('disabled');

    expect(() =>
      loadApiEnvironment({
        ...BASE,
        MERDN_RUNTIME_ROLE: 'ninguno',
      }),
    ).toThrowError(/MERDN_RUNTIME_ROLE/);
  });

  it('valida el código del tenant activo y la versión del consentimiento', () => {
    const environment = loadApiEnvironment({
      ...BASE,
      MERDN_ACTIVE_TENANT_CODE: 'merdn-mvp-2',
      MERDN_CONSENT_VERSION: 'paciente-tratamiento-datos-v2',
    });

    expect(environment.activeTenantCode).toBe('merdn-mvp-2');
    expect(environment.consent.version).toBe('paciente-tratamiento-datos-v2');

    expect(() =>
      loadApiEnvironment({
        ...BASE,
        MERDN_ACTIVE_TENANT_CODE: 'tenant con espacios',
      }),
    ).toThrowError(/MERDN_ACTIVE_TENANT_CODE/);
  });

  it('exige MERDN_ACTIVE_TENANT_ID cuando el rol runtime se aplica', () => {
    const { MERDN_ACTIVE_TENANT_ID: _omitted, ...withoutTenantId } = BASE;

    expect(() => loadApiEnvironment(withoutTenantId)).toThrowError(
      EnvironmentValidationError,
    );
    expect(() => loadApiEnvironment(withoutTenantId)).toThrowError(
      /MERDN_ACTIVE_TENANT_ID/,
    );

    // En modo degradado no hay transacción de contexto que fijar, de modo que el
    // identificador es opcional y su ausencia no detiene el arranque.
    expect(
      loadApiEnvironment({
        ...withoutTenantId,
        MERDN_RUNTIME_ROLE: 'disabled',
      }).activeTenantId,
    ).toBeUndefined();
  });

  it('rechaza un MERDN_ACTIVE_TENANT_ID malformado y no revela su valor', () => {
    for (const malformed of [
      'merdn-mvp',
      '00000000000040008000000000000001',
      '00000000-0000-4000-8000-00000000000',
      '00000000-0000-4000-8000-0000000000zz',
      '{00000000-0000-4000-8000-000000000001}',
    ]) {
      expect(() =>
        loadApiEnvironment({ ...BASE, MERDN_ACTIVE_TENANT_ID: malformed }),
      ).toThrowError(/MERDN_ACTIVE_TENANT_ID/);

      try {
        loadApiEnvironment({ ...BASE, MERDN_ACTIVE_TENANT_ID: malformed });
      } catch (error) {
        expect((error as Error).message).not.toContain(malformed);
      }
    }

    // Un identificador declarado en modo degradado tampoco se acepta a medias.
    expect(() =>
      loadApiEnvironment({
        ...BASE,
        MERDN_RUNTIME_ROLE: 'disabled',
        MERDN_ACTIVE_TENANT_ID: 'no-es-uuid',
      }),
    ).toThrowError(/MERDN_ACTIVE_TENANT_ID/);
  });

  it('acepta un UUID válido y lo normaliza a minúsculas', () => {
    expect(
      loadApiEnvironment({
        ...BASE,
        MERDN_ACTIVE_TENANT_ID: '  0000000A-0000-4000-8000-00000000000B  ',
      }).activeTenantId,
    ).toBe('0000000a-0000-4000-8000-00000000000b');
  });

  /* ------------- Provision OIDC administrativa (SPEC 038, MP04) ------------ */

  describe('configuracion administrativa de provision de cuentas', () => {
    const HUMAN_ISSUER = 'http://host.docker.internal:8081/realms/merdn-local';

    const COMPLETE = {
      MERDN_ACCESS_PROVISIONING_ISSUER: HUMAN_ISSUER,
      MERDN_ACCESS_PROVISIONING_CLIENT_ID: 'merdn-access-provisioning',
      MERDN_ACCESS_PROVISIONING_CLIENT_SECRET: 'secreto-centinela-mp04',
      MERDN_HUMAN_AUTH_ISSUER: HUMAN_ISSUER,
    } as const;

    it('permanece ausente cuando ninguna variable se declara', () => {
      expect(loadApiEnvironment({ ...BASE }).accessProvisioning).toBeUndefined();
    });

    it('deriva adminUrl y fija el realm cuando la configuracion es completa', () => {
      const config = loadApiEnvironment({ ...BASE, ...COMPLETE }).accessProvisioning;

      expect(config).toStrictEqual({
        issuer: HUMAN_ISSUER,
        adminUrl: 'http://host.docker.internal:8081',
        realm: 'merdn-local',
        clientId: 'merdn-access-provisioning',
        clientSecret: 'secreto-centinela-mp04',
      });
    });

    it('normaliza la barra final del issuer antes de compararlo', () => {
      const config = loadApiEnvironment({
        ...BASE,
        ...COMPLETE,
        MERDN_ACCESS_PROVISIONING_ISSUER: `${HUMAN_ISSUER}/`,
      }).accessProvisioning;

      expect(config?.issuer).toBe(HUMAN_ISSUER);
      expect(config?.adminUrl).toBe('http://host.docker.internal:8081');
    });

    it('rechaza una configuracion PARCIAL sin revelar ningun valor', () => {
      const { MERDN_ACCESS_PROVISIONING_CLIENT_SECRET: _omit, ...parcial } = COMPLETE;

      expect(() => loadApiEnvironment({ ...BASE, ...parcial })).toThrowError(
        /MERDN_ACCESS_PROVISIONING_\*/,
      );

      try {
        loadApiEnvironment({ ...BASE, ...parcial });
      } catch (error) {
        const message = (error as Error).message;
        expect(message).not.toContain('merdn-access-provisioning');
        expect(message).not.toContain(HUMAN_ISSUER);
      }
    });

    it('impide el arranque cuando la provision se declara en mvp', () => {
      expect(() =>
        loadApiEnvironment({ ...BASE, ...COMPLETE, MERDN_ENVIRONMENT: 'mvp' }),
      ).toThrowError(/MERDN_ACCESS_PROVISIONING_ISSUER/);

      expect(() =>
        loadApiEnvironment({ ...BASE, ...COMPLETE, MERDN_ENVIRONMENT: 'mvp' }),
      ).toThrowError(/mvp/);
    });

    it('exige el realm local EXACTO, no una subcadena', () => {
      expect(() =>
        loadApiEnvironment({
          ...BASE,
          ...COMPLETE,
          MERDN_ACCESS_PROVISIONING_ISSUER:
            'http://host.docker.internal:8081/realms/otro-realm',
        }),
      ).toThrowError(/merdn-local/);

      expect(() =>
        loadApiEnvironment({
          ...BASE,
          ...COMPLETE,
          MERDN_ACCESS_PROVISIONING_ISSUER:
            'http://localhost/merdn-local/realms/merdn-local',
        }),
      ).toThrowError(/merdn-local/);
    });

    it('rechaza un issuer con otra forma de path', () => {
      expect(() =>
        loadApiEnvironment({
          ...BASE,
          ...COMPLETE,
          MERDN_ACCESS_PROVISIONING_ISSUER: 'http://localhost:8081/auth/realms/merdn-local',
        }),
      ).toThrowError(/merdn-local/);
    });

    it('exige un host local aprobado', () => {
      expect(() =>
        loadApiEnvironment({
          ...BASE,
          ...COMPLETE,
          MERDN_ACCESS_PROVISIONING_ISSUER: 'https://id.ejemplo.com/realms/merdn-local',
          MERDN_HUMAN_AUTH_ISSUER: 'https://id.ejemplo.com/realms/merdn-local',
        }),
      ).toThrowError(/MERDN_ACCESS_PROVISIONING_ISSUER/);
    });

    it('exige que el issuer sea exactamente el de la autenticacion humana', () => {
      expect(() =>
        loadApiEnvironment({
          ...COMPLETE,
          ...BASE,
          MERDN_HUMAN_AUTH_ISSUER: 'http://127.0.0.1:8081/realms/merdn-local',
        }),
      ).toThrowError(/MERDN_HUMAN_AUTH_ISSUER/);
    });

    it('exige que la autenticacion humana este aprovisionada', () => {
      const { MERDN_HUMAN_AUTH_ISSUER: _sinHumano, ...sinHumano } = COMPLETE;

      expect(() => loadApiEnvironment({ ...BASE, ...sinHumano })).toThrowError(
        /MERDN_HUMAN_AUTH_ISSUER/,
      );
    });

    it('rechaza credenciales, consulta y fragmento en el issuer', () => {
      expect(() =>
        loadApiEnvironment({
          ...COMPLETE,
          ...BASE,
          MERDN_ACCESS_PROVISIONING_ISSUER:
            'http://user:pass@localhost:8081/realms/merdn-local',
          MERDN_HUMAN_AUTH_ISSUER: 'http://user:pass@localhost:8081/realms/merdn-local',
        }),
      ).toThrowError(/MERDN_ACCESS_PROVISIONING_ISSUER/);

      expect(() =>
        loadApiEnvironment({
          ...COMPLETE,
          ...BASE,
          MERDN_ACCESS_PROVISIONING_ISSUER:
            'http://localhost:8081/realms/merdn-local?scope=admin',
        }),
      ).toThrowError(/cadena de consulta/);
    });

    it('nunca incorpora el secreto al mensaje de error', () => {
      try {
        loadApiEnvironment({
          ...BASE,
          ...COMPLETE,
          MERDN_ENVIRONMENT: 'mvp',
        });
        expect.unreachable('debia lanzar EnvironmentValidationError');
      } catch (error) {
        expect(error).toBeInstanceOf(EnvironmentValidationError);
        expect((error as Error).message).not.toContain(
          'secreto-centinela-mp04',
        );
      }
    });
  });
});
