import { type ApiEnvironment, type SameSiteValue } from '../config/environment';

import {
  HUMAN_AUTH_ALLOWED_ALGORITHM,
  HUMAN_AUTH_ATTEMPT_TTL_SECONDS,
  HUMAN_AUTH_ENV,
  HUMAN_AUTH_LOCAL_DOCKER_HOST,
  HUMAN_AUTH_LOCAL_REALM_MARKER,
  HUMAN_AUTH_LOOPBACK_HOSTS,
  HUMAN_SESSION_IDLE_SECONDS,
  HUMAN_SESSION_TTL_SECONDS,
} from './human-auth.contract';

/**
 * Configuración del acceso HUMANO (IDENTITY-RELATIONSHIPS-CORE-01 §12).
 *
 * Se resuelve una vez, se valida y NO se registra. Ningún valor viaja a una
 * respuesta, a un log ni a un evento de auditoría.
 *
 * FAIL-CLOSED en dos niveles distintos y deliberadamente asimétricos:
 *
 * 1. Configuración AUSENTE o incompleta: el módulo queda DESHABILITADO. La
 *    superficie humana responde como no disponible y `GET /health` conserva su
 *    patrón existente. No se inventa un issuer, un cliente ni una clave.
 * 2. Configuración PRESENTE pero PROHIBIDA para el entorno —issuer HTTP fuera
 *    de desarrollo, realm local en `mvp`, comodín en redirect u origen—: el
 *    proceso NO arranca. Es un error de despliegue, no una degradación, y
 *    silenciarlo dejaría un proveedor de juguete autenticando datos reales.
 */

/** Error de configuración humana. Nombra la variable, nunca su valor. */
export class HumanAuthConfigurationError extends Error {
  public readonly variableName: string;

  constructor(variableName: string, reason: string) {
    super(
      `Configuración de autenticación humana inválida: ${variableName} ${reason}. ` +
        'El valor recibido no se registra por seguridad.',
    );
    this.name = 'HumanAuthConfigurationError';
    this.variableName = variableName;
  }
}

/** Atributos de transporte de las cookies humanas. */
export interface HumanCookieOptions {
  readonly sameSite: SameSiteValue;
  readonly secure: boolean;
  readonly domain: string | undefined;
}

/** Configuración efectiva del proveedor OIDC único (AD-01). */
export interface HumanOidcConfig {
  /** Issuer EXACTO. Es la única identidad de emisor aceptada. */
  readonly issuer: string;
  readonly clientId: string;
  /** URI de retorno EXACTA. Sin comodines y sin construcción dinámica. */
  readonly callbackUri: string;
  /** Algoritmo asimétrico permitido para el ID token. */
  readonly allowedAlgorithm: typeof HUMAN_AUTH_ALLOWED_ALGORITHM;
  /** Tiempo máximo de discovery, JWKS y token endpoint. Falla cerrado. */
  readonly requestTimeoutMs: number;
  /**
   * Indica si el issuer viaja sin TLS. Solo puede ser `true` en `development` y
   * `test` contra bucle local o el nombre Docker aprobado.
   */
  readonly insecureLocalIssuer: boolean;
}

export interface HumanAuthRateLimitConfig {
  readonly maxRequests: number;
  readonly windowSeconds: number;
}

/** Configuración completa del módulo humano cuando está habilitado. */
export interface HumanAuthEnabledConfig {
  readonly enabled: true;
  readonly oidc: HumanOidcConfig;
  /** Clave AES-256-GCM de 32 bytes del verifier PKCE. Nunca se registra. */
  readonly attemptKey: Buffer;
  readonly attemptTtlSeconds: number;
  readonly sessionTtlSeconds: number;
  readonly sessionIdleSeconds: number;
  readonly cookie: HumanCookieOptions;
  /** Orígenes admitidos en operaciones que cambian estado. Sin comodines. */
  readonly allowedOrigins: readonly string[];
  readonly rateLimit: HumanAuthRateLimitConfig;
}

/** Configuración del módulo humano cuando NO está aprovisionado. */
export interface HumanAuthDisabledConfig {
  readonly enabled: false;
  /** Motivo técnico. Nombra la variable, NUNCA su valor. */
  readonly reason: string;
}

export type HumanAuthConfig = HumanAuthEnabledConfig | HumanAuthDisabledConfig;

type EnvironmentSource = Readonly<Record<string, string | undefined>>;

function readOptional(source: EnvironmentSource, name: string): string | undefined {
  const raw = source[name];
  if (raw === undefined) {
    return undefined;
  }

  const trimmed = raw.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

function parseSeconds(
  source: EnvironmentSource,
  name: string,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const value = readOptional(source, name);
  if (value === undefined) {
    return fallback;
  }

  if (!/^\d+$/u.test(value)) {
    throw new HumanAuthConfigurationError(name, 'debe ser un número entero de segundos');
  }

  const parsed = Number.parseInt(value, 10);
  if (parsed < minimum || parsed > maximum) {
    throw new HumanAuthConfigurationError(
      name,
      `debe estar entre ${minimum} y ${maximum} segundos`,
    );
  }

  return parsed;
}

/**
 * Decodifica la clave del intento y exige EXACTAMENTE 32 bytes.
 *
 * Se admite hexadecimal o base64/base64url porque son las dos formas en que una
 * persona que administra el despliegue genera 32 bytes con herramientas
 * habituales. Cualquier otra longitud se rechaza: una clave corta debilitaría
 * AES-256-GCM sin que nada lo advirtiera.
 */
function parseAttemptKey(source: EnvironmentSource): Buffer {
  const value = readOptional(source, HUMAN_AUTH_ENV.attemptKey);

  if (value === undefined) {
    throw new HumanAuthConfigurationError(
      HUMAN_AUTH_ENV.attemptKey,
      'no está definida y no tiene valor por defecto',
    );
  }

  const decoded = /^[0-9a-fA-F]{64}$/u.test(value)
    ? Buffer.from(value, 'hex')
    : Buffer.from(value, 'base64');

  if (decoded.length !== 32) {
    throw new HumanAuthConfigurationError(
      HUMAN_AUTH_ENV.attemptKey,
      'debe decodificar exactamente 32 bytes (256 bits) en hexadecimal o base64',
    );
  }

  return decoded;
}

/** Comprueba que un host es bucle local o el nombre Docker local aprobado. */
function isLocalHost(hostname: string): boolean {
  return (
    HUMAN_AUTH_LOOPBACK_HOSTS.includes(hostname) ||
    hostname === HUMAN_AUTH_LOCAL_DOCKER_HOST
  );
}

/**
 * Valida el issuer contra el entorno técnico.
 *
 * Reglas, todas fail-closed:
 * - `http://` SOLO en `development` y `test`, y SOLO contra bucle local o el
 *   nombre Docker aprobado. Cualquier otro host obliga a HTTPS;
 * - el realm local queda PROHIBIDO fuera de `development` y `test`, incluso por
 *   HTTPS: contiene únicamente personas ficticias;
 * - sin credenciales embebidas, sin consulta y sin fragmento: el issuer es una
 *   identidad, no una URL de navegación.
 */
function parseIssuer(
  source: EnvironmentSource,
  environment: ApiEnvironment,
): { readonly issuer: string; readonly insecure: boolean } {
  const value = readOptional(source, HUMAN_AUTH_ENV.issuer);

  if (value === undefined) {
    throw new HumanAuthConfigurationError(HUMAN_AUTH_ENV.issuer, 'no está definida');
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new HumanAuthConfigurationError(
      HUMAN_AUTH_ENV.issuer,
      'no es una URL absoluta válida',
    );
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new HumanAuthConfigurationError(
      HUMAN_AUTH_ENV.issuer,
      'debe usar el esquema https:// o, solo en desarrollo local, http://',
    );
  }

  if (parsed.username !== '' || parsed.password !== '') {
    throw new HumanAuthConfigurationError(
      HUMAN_AUTH_ENV.issuer,
      'no puede incluir credenciales embebidas',
    );
  }

  if (parsed.search !== '' || parsed.hash !== '') {
    throw new HumanAuthConfigurationError(
      HUMAN_AUTH_ENV.issuer,
      'no puede incluir cadena de consulta ni fragmento',
    );
  }

  const esEntornoLocal =
    environment.merdnEnvironment === 'development' || environment.merdnEnvironment === 'test';
  const insecure = parsed.protocol === 'http:';

  if (insecure && !esEntornoLocal) {
    throw new HumanAuthConfigurationError(
      HUMAN_AUTH_ENV.issuer,
      `no puede usar http:// en el entorno ${environment.merdnEnvironment}: ` +
        'un proveedor de identidad sin TLS solo se admite en desarrollo local',
    );
  }

  if (insecure && !isLocalHost(parsed.hostname)) {
    throw new HumanAuthConfigurationError(
      HUMAN_AUTH_ENV.issuer,
      'solo puede usar http:// contra el bucle local o el nombre Docker local aprobado',
    );
  }

  if (!esEntornoLocal && parsed.href.includes(HUMAN_AUTH_LOCAL_REALM_MARKER)) {
    throw new HumanAuthConfigurationError(
      HUMAN_AUTH_ENV.issuer,
      `no puede apuntar al realm local de desarrollo en el entorno ` +
        `${environment.merdnEnvironment}: ese realm solo contiene personas ficticias`,
    );
  }

  // Se conserva sin barra final para poder comparar el emisor por igualdad
  // exacta contra el `iss` del ID token.
  return { issuer: parsed.href.replace(/\/+$/u, ''), insecure };
}

/** Identificador de cliente OIDC. No es un secreto, pero sí una allowlist. */
function parseClientId(source: EnvironmentSource): string {
  const value = readOptional(source, HUMAN_AUTH_ENV.clientId);

  if (value === undefined) {
    throw new HumanAuthConfigurationError(HUMAN_AUTH_ENV.clientId, 'no está definida');
  }

  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u.test(value)) {
    throw new HumanAuthConfigurationError(
      HUMAN_AUTH_ENV.clientId,
      'debe ser un identificador de 1 a 128 caracteres sin espacios',
    );
  }

  return value;
}

/**
 * URI de retorno EXACTA.
 *
 * Prohibido cualquier comodín. La comprobación es literal —`*`— y no una
 * heurística: un comodín en el redirect convierte el cliente en un
 * redireccionador abierto y permite exfiltrar el código de autorización.
 */
function parseCallbackUri(
  source: EnvironmentSource,
  environment: ApiEnvironment,
): string {
  const value = readOptional(source, HUMAN_AUTH_ENV.callbackUri);

  if (value === undefined) {
    throw new HumanAuthConfigurationError(HUMAN_AUTH_ENV.callbackUri, 'no está definida');
  }

  if (value.includes('*')) {
    throw new HumanAuthConfigurationError(
      HUMAN_AUTH_ENV.callbackUri,
      'no puede contener comodines: la URI de retorno debe ser exacta',
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new HumanAuthConfigurationError(
      HUMAN_AUTH_ENV.callbackUri,
      'no es una URL absoluta válida',
    );
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new HumanAuthConfigurationError(
      HUMAN_AUTH_ENV.callbackUri,
      'debe usar el esquema https:// o, solo en desarrollo local, http://',
    );
  }

  const esEntornoLocal =
    environment.merdnEnvironment === 'development' || environment.merdnEnvironment === 'test';

  if (parsed.protocol === 'http:' && !(esEntornoLocal && isLocalHost(parsed.hostname))) {
    throw new HumanAuthConfigurationError(
      HUMAN_AUTH_ENV.callbackUri,
      `no puede usar http:// en el entorno ${environment.merdnEnvironment} ni fuera del bucle local`,
    );
  }

  if (parsed.hash !== '') {
    throw new HumanAuthConfigurationError(
      HUMAN_AUTH_ENV.callbackUri,
      'no puede incluir fragmento',
    );
  }

  return parsed.href;
}

/**
 * Orígenes admitidos en operaciones que cambian estado.
 *
 * Se reutilizan los ya validados por la política web existente. Se comprueba
 * de nuevo la ausencia de comodines porque esta Task los prohíbe de forma
 * expresa y no debe depender de que otra capa lo siga haciendo.
 */
function parseAllowedOrigins(environment: ApiEnvironment): readonly string[] {
  for (const origin of environment.webOrigins) {
    if (origin.includes('*')) {
      throw new HumanAuthConfigurationError(
        'API_WEB_ORIGINS',
        'no puede contener comodines cuando la autenticación humana está habilitada',
      );
    }
  }

  return environment.webOrigins;
}

/**
 * Construye la configuración humana efectiva.
 *
 * La ausencia COMPLETA del aprovisionamiento —ninguna de las cuatro variables
 * indispensables— deshabilita el módulo sin impedir el arranque. Una
 * configuración PARCIAL o PROHIBIDA sí lanza: significa que alguien quiso
 * habilitarlo y no puede quedarse a medias sin que nadie se entere.
 */
export function loadHumanAuthConfig(
  source: EnvironmentSource,
  environment: ApiEnvironment,
): HumanAuthConfig {
  const indispensables = [
    HUMAN_AUTH_ENV.issuer,
    HUMAN_AUTH_ENV.clientId,
    HUMAN_AUTH_ENV.callbackUri,
    HUMAN_AUTH_ENV.attemptKey,
  ];

  const declaradas = indispensables.filter(
    (name) => readOptional(source, name) !== undefined,
  );

  if (declaradas.length === 0) {
    return {
      enabled: false,
      reason:
        `${indispensables.join(', ')} no están definidas: la autenticación humana ` +
        'NO se aprovisiona y su superficie responde como no disponible. No existe ' +
        'ningún acceso alternativo.',
    };
  }

  const { issuer, insecure } = parseIssuer(source, environment);

  const sameSite = environment.enrollmentSession.sameSite;

  return {
    enabled: true,
    oidc: {
      issuer,
      clientId: parseClientId(source),
      callbackUri: parseCallbackUri(source, environment),
      allowedAlgorithm: HUMAN_AUTH_ALLOWED_ALGORITHM,
      requestTimeoutMs: parseSeconds(
        source,
        HUMAN_AUTH_ENV.discoveryTimeoutMs,
        5_000,
        250,
        30_000,
      ),
      insecureLocalIssuer: insecure,
    },
    attemptKey: parseAttemptKey(source),
    attemptTtlSeconds: parseSeconds(
      source,
      HUMAN_AUTH_ENV.attemptTtlSeconds,
      HUMAN_AUTH_ATTEMPT_TTL_SECONDS,
      60,
      900,
    ),
    sessionTtlSeconds: parseSeconds(
      source,
      HUMAN_AUTH_ENV.sessionTtlSeconds,
      HUMAN_SESSION_TTL_SECONDS,
      60,
      HUMAN_SESSION_TTL_SECONDS,
    ),
    sessionIdleSeconds: parseSeconds(
      source,
      HUMAN_AUTH_ENV.sessionIdleSeconds,
      HUMAN_SESSION_IDLE_SECONDS,
      60,
      HUMAN_SESSION_IDLE_SECONDS,
    ),
    cookie: {
      sameSite,
      // `SameSite=None` solo es válido junto con `Secure`, según la
      // especificación de cookies.
      secure: environment.merdnEnvironment !== 'development' || sameSite === 'none',
      domain: environment.enrollmentSession.domain,
    },
    allowedOrigins: parseAllowedOrigins(environment),
    rateLimit: {
      maxRequests: parseSeconds(source, HUMAN_AUTH_ENV.rateLimitMax, 20, 1, 10_000),
      windowSeconds: parseSeconds(
        source,
        HUMAN_AUTH_ENV.rateLimitWindowSeconds,
        900,
        60,
        24 * 60 * 60,
      ),
    },
  };
}
