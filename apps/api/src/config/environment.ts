/**
 * Configuración tipada de la API MERDN (TASK-001, FR-18; ampliada por
 * TASK-MVP-CORE-01 §18).
 *
 * Reglas aplicadas:
 * - Fail-fast: si falta o es inválida una variable indispensable, el proceso
 *   termina con un error técnico claro.
 * - Redacción: los mensajes de error nombran la variable, nunca su valor. Una
 *   cadena de conexión jamás se imprime, ni completa ni parcialmente.
 * - Minimización: `DATABASE_URL` se valida en el arranque pero NO se conserva
 *   en el objeto de configuración. Prisma la consume directamente desde el
 *   entorno del proceso, de modo que la cadena nunca circula por la aplicación.
 *
 * CORE-01 añade únicamente configuración operativa (tenant activo, versión de
 * consentimiento, sesión de inscripción, orígenes web y límite de peticiones).
 * Ninguno de estos valores es un secreto y ninguno decide producto: los
 * comportamientos aprobados están fijados por la Task Specification.
 */

/** Entornos técnicos admitidos por la fundación (no son tenants ni negocio). */
export const MERDN_ENVIRONMENTS = ['development', 'test', 'mvp'] as const;

export type MerdnEnvironment = (typeof MERDN_ENVIRONMENTS)[number];

/** Valores admitidos para el atributo `SameSite` de la cookie de sesión. */
export const SAME_SITE_VALUES = ['lax', 'strict', 'none'] as const;

export type SameSiteValue = (typeof SAME_SITE_VALUES)[number];

/** Configuración de la credencial de sesión de inscripción. */
export interface EnrollmentSessionConfig {
  /** Nombre de la cookie `HttpOnly`. No contiene PII ni `patientId`. */
  readonly cookieName: string;
  readonly sameSite: SameSiteValue;
  /** `Secure` se activa fuera de desarrollo local salvo anulación explícita. */
  readonly secure: boolean;
  /** Dominio de cookie; `undefined` deja que el navegador use el host actual. */
  readonly domain: string | undefined;
  /** Vigencia máxima de la sesión, en segundos. */
  readonly ttlSeconds: number;
}

/** Configuración del consentimiento vigente mostrado por la UI aprobada. */
export interface ConsentConfig {
  /** Versión controlada del texto ya existente. No es texto legal nuevo. */
  readonly version: string;
  /** Código controlado de finalidad. No es una interpretación jurídica. */
  readonly purpose: string;
}

/** Límite de peticiones del endpoint público de inscripción. */
export interface RateLimitConfig {
  readonly maxRequests: number;
  readonly windowSeconds: number;
}

/** Configuración de Keycloak para pacientes (Spec 027). Opcional: si no se definen las vars, la feature se deshabilita. */
export interface KeycloakPatientConfig {
  readonly adminUrl: string;
  readonly adminUser: string;
  readonly adminPassword: string;
  readonly realm: string;
  readonly clientId: string;
  readonly clientSecret: string;
  readonly issuerUrl: string;
}

/**
 * Configuración ADMINISTRATIVA OIDC para la provisión de cuentas (SPEC 038, MP04).
 *
 * Es COMPLETA o AUSENTE. No existe una configuración parcial: quien declara el
 * cliente administrativo tiene intención de aprovisionar y no puede quedarse a
 * medias sin que el arranque lo advierta.
 *
 * REGLAS, todas fail-closed y todas antes de atender una sola petición:
 *
 * 1. Solo se admite con `MERDN_ENVIRONMENT` en `development` o `test`. En `mvp`
 *    la presencia de esta configuración DETIENE el arranque: el realm `merdn-local`
 *    contiene únicamente personas ficticias y no puede aprovisionar nada real.
 * 2. El realm derivado del issuer debe ser EXACTAMENTE `merdn-local`.
 * 3. El host debe ser un host local aprobado: bucle local o `host.docker.internal`.
 * 4. El issuer debe ser EXACTAMENTE el mismo que el de la autenticación humana.
 *    Con dos emisores distintos, el `sub` persistido durante el registro no
 *    coincidiría con el que devuelve el inicio de sesión, y toda cuenta quedaría
 *    inaccesible sin que nada lo indicara.
 * 5. Sin credenciales embebidas, sin consulta y sin fragmento.
 *
 * `adminUrl` NO es una variable: es el ORIGEN del issuer, derivado aquí, para
 * que no pueda existir una administración apuntando a un host distinto del que
 * autentica. La contraseña del cliente administrativo NUNCA se conserva en este
 * objeto ni se registra en ningún mensaje.
 */
export interface AccessProvisioningConfig {
  /** Issuer del realm humano local. Es también la base de la API admin. */
  readonly issuer: string;
  /** Origen del issuer, usado contra la API administrativa. Derivado, no declarado. */
  readonly adminUrl: string;
  /** Realm fijado por decisión del paquete. No configurable. */
  readonly realm: string;
  readonly clientId: string;
  /** Secreto del cliente administrativo. Nunca se registra ni se devuelve. */
  readonly clientSecret: string;
}

/**
 * Modo de aplicación del rol runtime de base de datos.
 *
 * `enforce` —el valor por defecto— hace que toda operación de negocio adopte el
 * rol `merdn_runtime` y active Row Level Security en PostgreSQL.
 *
 * `disabled` existe ÚNICAMENTE para motores de desarrollo que no sostienen RLS.
 * Degrada el aislamiento a los filtros de la aplicación, se anuncia con una
 * advertencia en el arranque y no debe usarse en ningún entorno con datos
 * reales.
 *
 * En modo `enforce` la API EXIGE `RUNTIME_DATABASE_URL`: no arranca reutilizando
 * la credencial administrativa de las migraciones. No existe repliegue a
 * privilegios superiores.
 */
export const RUNTIME_ROLE_MODES = ['enforce', 'disabled'] as const;

export type RuntimeRoleMode = (typeof RUNTIME_ROLE_MODES)[number];

/** Configuración efectiva de la API, sin secretos. */
export interface ApiEnvironment {
  readonly merdnEnvironment: MerdnEnvironment;
  readonly port: number;
  readonly openApiPath: string;
  /** Aplicación del rol runtime y de Row Level Security. */
  readonly runtimeRoleMode: RuntimeRoleMode;
  /**
   * Indica si existe una conexión de ejecución separada de la administrativa.
   * La cadena en sí NO se conserva aquí: es confidencial y la lee el cliente
   * Prisma directamente del entorno.
   */
  readonly hasSeparateRuntimeConnection: boolean;
  /** Código del tenant institucional activo resuelto por el servidor. */
  readonly activeTenantCode: string;
  /**
   * Identificador (UUID) del tenant institucional activo, suministrado
   * EXCLUSIVAMENTE por configuración confiable del despliegue (Spec 024).
   *
   * Es obligatorio en modo `enforce`: el arranque en frío debe abrir la
   * transacción de contexto con un identificador ya conocido, porque bajo RLS
   * el runtime no puede descubrirlo consultando por código. Queda `undefined`
   * solo en modo `disabled`, donde no hay contexto transaccional que fijar.
   *
   * Nunca procede de URL, cuerpo, cabecera, cookie ni token: no es entrada de
   * usuario y no habilita selección de tenant por petición.
   */
  readonly activeTenantId?: string | undefined;
  readonly consent: ConsentConfig;
  readonly enrollmentSession: EnrollmentSessionConfig;
  /** Orígenes web autorizados a enviar credenciales a la API. */
  readonly webOrigins: readonly string[];
  readonly enrollmentRateLimit: RateLimitConfig;
  /** Configuración de Keycloak para pacientes (Spec 027). Opcional: undefined si la feature está deshabilitada. */
  readonly keycloakPatient?: KeycloakPatientConfig;
  /**
   * Configuración administrativa OIDC de provisión (SPEC 038, MP04).
   * `undefined` cuando el despliegue no aprovisiona cuentas.
   */
  readonly accessProvisioning?: AccessProvisioningConfig;
}

/** Error de validación de entorno. Nunca contiene valores de variables. */
export class EnvironmentValidationError extends Error {
  public readonly variableName: string;

  constructor(variableName: string, reason: string) {
    super(
      `Configuración inválida: la variable de entorno ${variableName} ${reason}. ` +
        'Revise .env.example y defina un valor válido. ' +
        'El valor recibido no se registra por seguridad.',
    );
    this.name = 'EnvironmentValidationError';
    this.variableName = variableName;
  }
}

/** Puerto por defecto de la API en desarrollo. */
export const DEFAULT_API_PORT = 3001;

/** Ruta por defecto de la documentación OpenAPI en desarrollo. */
export const DEFAULT_OPENAPI_PATH = 'docs';

/**
 * Código del tenant institucional MVP. Coincide con el tenant que carga la
 * migración de datos de referencia de CORE-01.
 */
export const DEFAULT_ACTIVE_TENANT_CODE = 'merdn-mvp';

/**
 * Versión del consentimiento vigente. Identifica el texto ya presente en la
 * pantalla de confirmación aprobada; no introduce ni reemplaza texto legal.
 */
export const DEFAULT_CONSENT_VERSION = 'paciente-tratamiento-datos-v1';

/** Código de finalidad controlado del consentimiento de inscripción. */
export const DEFAULT_CONSENT_PURPOSE = 'INSCRIPCION_PACIENTE_MERDN';

/** Nombre por defecto de la cookie de sesión de inscripción. */
export const DEFAULT_SESSION_COOKIE_NAME = 'merdn_enrollment_session';

/** Vigencia por defecto de la sesión de inscripción: 12 horas. */
export const DEFAULT_SESSION_TTL_SECONDS = 12 * 60 * 60;

/**
 * Orígenes web por defecto en desarrollo local. Se usa `127.0.0.1` además de
 * `localhost` porque la cookie `SameSite=Lax` solo viaja entre puertos del
 * mismo host: la web debe abrirse en el mismo host que se declare aquí.
 */
export const DEFAULT_WEB_ORIGINS: readonly string[] = [
  'http://127.0.0.1:3000',
  'http://localhost:3000',
];

/** Límite por defecto del POST público de inscripción. */
export const DEFAULT_ENROLLMENT_RATE_LIMIT_MAX = 10;
export const DEFAULT_ENROLLMENT_RATE_LIMIT_WINDOW_SECONDS = 900;

type EnvironmentSource = Readonly<Record<string, string | undefined>>;

function readOptional(source: EnvironmentSource, name: string): string | undefined {
  const raw = source[name];
  if (raw === undefined) {
    return undefined;
  }

  const trimmed = raw.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

function readRequired(source: EnvironmentSource, name: string): string {
  const value = readOptional(source, name);
  if (value === undefined) {
    throw new EnvironmentValidationError(name, 'no está definida o está vacía');
  }

  return value;
}

function parseMerdnEnvironment(source: EnvironmentSource): MerdnEnvironment {
  const value = readOptional(source, 'MERDN_ENVIRONMENT');
  if (value === undefined) {
    return 'development';
  }

  const match = MERDN_ENVIRONMENTS.find((candidate) => candidate === value);
  if (match === undefined) {
    throw new EnvironmentValidationError(
      'MERDN_ENVIRONMENT',
      `debe ser uno de: ${MERDN_ENVIRONMENTS.join(', ')}`,
    );
  }

  return match;
}

function parsePort(source: EnvironmentSource): number {
  const value = readOptional(source, 'API_PORT');
  if (value === undefined) {
    return DEFAULT_API_PORT;
  }

  if (!/^\d+$/.test(value)) {
    throw new EnvironmentValidationError('API_PORT', 'debe ser un número entero');
  }

  const port = Number.parseInt(value, 10);
  if (port < 1 || port > 65535) {
    throw new EnvironmentValidationError('API_PORT', 'debe estar entre 1 y 65535');
  }

  return port;
}

function parseOpenApiPath(source: EnvironmentSource): string {
  const value = readOptional(source, 'API_OPENAPI_PATH');
  if (value === undefined) {
    return DEFAULT_OPENAPI_PATH;
  }

  const normalized = value.replace(/^\/+|\/+$/g, '');
  if (!/^[a-z0-9][a-z0-9/-]*$/i.test(normalized)) {
    throw new EnvironmentValidationError(
      'API_OPENAPI_PATH',
      'debe ser una ruta simple compuesta por letras, dígitos, guiones o barras',
    );
  }

  return normalized;
}

/**
 * Valida que una variable contenga una cadena de conexión PostgreSQL con forma
 * aceptable. No devuelve el valor: es confidencial y Prisma lo lee del entorno.
 */
function assertPostgresUrl(source: EnvironmentSource, name: string): void {
  const value = readRequired(source, name);

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new EnvironmentValidationError(
      name,
      'no es una URL válida de conexión PostgreSQL',
    );
  }

  if (parsed.protocol !== 'postgresql:' && parsed.protocol !== 'postgres:') {
    throw new EnvironmentValidationError(
      name,
      'debe usar el esquema postgresql:// o postgres://',
    );
  }
}

/**
 * Separación de credenciales (corrección final de CORE-01).
 *
 * `DATABASE_URL` pertenece a migraciones y administración: es propietaria del
 * esquema. `RUNTIME_DATABASE_URL` pertenece a la API en ejecución y debe ser de
 * mínimo privilegio.
 *
 * En modo `enforce` su ausencia o invalidez DETIENE el arranque. Nunca se
 * repliega a la credencial administrativa: hacerlo dejaría a la API operando
 * con privilegios superiores, que es exactamente lo que se quiere impedir.
 */
function parseRuntimeConnection(
  source: EnvironmentSource,
  runtimeRoleMode: RuntimeRoleMode,
): boolean {
  const value = readOptional(source, 'RUNTIME_DATABASE_URL');

  if (value === undefined) {
    if (runtimeRoleMode === 'enforce') {
      throw new EnvironmentValidationError(
        'RUNTIME_DATABASE_URL',
        'es obligatoria cuando MERDN_RUNTIME_ROLE=enforce, porque la API no puede ' +
          'reutilizar la credencial administrativa de las migraciones',
      );
    }
    return false;
  }

  assertPostgresUrl(source, 'RUNTIME_DATABASE_URL');

  if (value === readOptional(source, 'DATABASE_URL')) {
    throw new EnvironmentValidationError(
      'RUNTIME_DATABASE_URL',
      'no puede ser idéntica a DATABASE_URL: la conexión de ejecución debe usar una ' +
        'credencial distinta de la administrativa',
    );
  }

  return true;
}

/** Identificador corto y estable: letras, dígitos, guiones y puntos. */
function parseIdentifier(
  source: EnvironmentSource,
  name: string,
  fallback: string,
): string {
  const value = readOptional(source, name);
  if (value === undefined) {
    return fallback;
  }

  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value)) {
    throw new EnvironmentValidationError(
      name,
      'debe ser un identificador de 1 a 128 caracteres compuesto por letras, dígitos, punto, guion o guion bajo',
    );
  }

  return value;
}

function parsePositiveInteger(
  source: EnvironmentSource,
  name: string,
  fallback: number,
  maximum: number,
): number {
  const value = readOptional(source, name);
  if (value === undefined) {
    return fallback;
  }

  if (!/^\d+$/.test(value)) {
    throw new EnvironmentValidationError(name, 'debe ser un número entero');
  }

  const parsed = Number.parseInt(value, 10);
  if (parsed < 1 || parsed > maximum) {
    throw new EnvironmentValidationError(name, `debe estar entre 1 y ${maximum}`);
  }

  return parsed;
}

function parseBooleanOrDefault(
  source: EnvironmentSource,
  name: string,
  fallback: boolean,
): boolean {
  const value = readOptional(source, name);
  if (value === undefined) {
    return fallback;
  }

  const normalized = value.toLowerCase();
  if (normalized === 'true' || normalized === '1') {
    return true;
  }
  if (normalized === 'false' || normalized === '0') {
    return false;
  }

  throw new EnvironmentValidationError(name, 'debe ser true o false');
}

function parseSameSite(source: EnvironmentSource): SameSiteValue {
  const value = readOptional(source, 'ENROLLMENT_SESSION_COOKIE_SAMESITE');
  if (value === undefined) {
    return 'lax';
  }

  const normalized = value.toLowerCase();
  const match = SAME_SITE_VALUES.find((candidate) => candidate === normalized);
  if (match === undefined) {
    throw new EnvironmentValidationError(
      'ENROLLMENT_SESSION_COOKIE_SAMESITE',
      `debe ser uno de: ${SAME_SITE_VALUES.join(', ')}`,
    );
  }

  return match;
}

function parseCookieDomain(source: EnvironmentSource): string | undefined {
  const value = readOptional(source, 'ENROLLMENT_SESSION_COOKIE_DOMAIN');
  if (value === undefined) {
    return undefined;
  }

  if (!/^[A-Za-z0-9.-]{1,253}$/.test(value)) {
    throw new EnvironmentValidationError(
      'ENROLLMENT_SESSION_COOKIE_DOMAIN',
      'debe ser un nombre de host válido',
    );
  }

  return value;
}

function parseEnrollmentSession(
  source: EnvironmentSource,
  merdnEnvironment: MerdnEnvironment,
): EnrollmentSessionConfig {
  const sameSite = parseSameSite(source);
  // Fuera de desarrollo local la cookie exige transporte cifrado. `SameSite=None`
  // solo es válido junto con `Secure` según la especificación de cookies.
  const secureByDefault = merdnEnvironment !== 'development' || sameSite === 'none';
  const secure = parseBooleanOrDefault(
    source,
    'ENROLLMENT_SESSION_COOKIE_SECURE',
    secureByDefault,
  );

  if (sameSite === 'none' && !secure) {
    throw new EnvironmentValidationError(
      'ENROLLMENT_SESSION_COOKIE_SECURE',
      'no puede ser false cuando SameSite es none',
    );
  }

  return {
    cookieName: parseIdentifier(
      source,
      'ENROLLMENT_SESSION_COOKIE_NAME',
      DEFAULT_SESSION_COOKIE_NAME,
    ),
    sameSite,
    secure,
    domain: parseCookieDomain(source),
    // Máximo admitido: 7 días. Una sesión de inscripción no es identidad permanente.
    ttlSeconds: parsePositiveInteger(
      source,
      'ENROLLMENT_SESSION_TTL_SECONDS',
      DEFAULT_SESSION_TTL_SECONDS,
      7 * 24 * 60 * 60,
    ),
  };
}

function parseRuntimeRoleMode(source: EnvironmentSource): RuntimeRoleMode {
  const value = readOptional(source, 'MERDN_RUNTIME_ROLE');
  if (value === undefined) {
    return 'enforce';
  }

  const match = RUNTIME_ROLE_MODES.find((candidate) => candidate === value);
  if (match === undefined) {
    throw new EnvironmentValidationError(
      'MERDN_RUNTIME_ROLE',
      `debe ser uno de: ${RUNTIME_ROLE_MODES.join(', ')}`,
    );
  }

  return match;
}

/**
 * Forma canónica de un UUID: 36 caracteres, cinco grupos hexadecimales.
 * No se acepta forma compacta ni con llaves: el valor viaja tal cual a la
 * comparación exacta contra la fila `tenant`.
 */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Identificador del tenant institucional activo (Spec 024).
 *
 * Contrato:
 * - en modo `enforce` es OBLIGATORIO y debe ser un UUID canónico; su ausencia o
 *   su malformación DETIENEN el arranque antes de atender negocio;
 * - en modo `disabled` es opcional, pero si se declara igual debe ser un UUID:
 *   una configuración a medias no se acepta en silencio;
 * - se normaliza a minúsculas para que la verificación posterior compare la
 *   pareja `id + code` sin ambigüedad de mayúsculas.
 *
 * El error nombra la variable y nunca su valor.
 */
function parseActiveTenantId(
  source: EnvironmentSource,
  runtimeRoleMode: RuntimeRoleMode,
): string | undefined {
  const value = readOptional(source, 'MERDN_ACTIVE_TENANT_ID');

  if (value === undefined) {
    if (runtimeRoleMode === 'enforce') {
      throw new EnvironmentValidationError(
        'MERDN_ACTIVE_TENANT_ID',
        'es obligatoria cuando MERDN_RUNTIME_ROLE=enforce, porque bajo Row Level ' +
          'Security el runtime no puede descubrir el tenant activo por su código: ' +
          'el identificador debe llegar por configuración confiable del despliegue',
      );
    }
    return undefined;
  }

  if (!UUID_PATTERN.test(value)) {
    throw new EnvironmentValidationError(
      'MERDN_ACTIVE_TENANT_ID',
      'debe ser un UUID canónico de 36 caracteres',
    );
  }

  return value.toLowerCase();
}

function parseWebOrigins(source: EnvironmentSource): readonly string[] {
  const value = readOptional(source, 'API_WEB_ORIGINS');
  if (value === undefined) {
    return DEFAULT_WEB_ORIGINS;
  }

  const origins = value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  if (origins.length === 0) {
    throw new EnvironmentValidationError(
      'API_WEB_ORIGINS',
      'debe contener al menos un origen',
    );
  }

  return origins.map((origin) => {
    let parsed: URL;
    try {
      parsed = new URL(origin);
    } catch {
      throw new EnvironmentValidationError(
        'API_WEB_ORIGINS',
        'debe contener orígenes con la forma esquema://host[:puerto]',
      );
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new EnvironmentValidationError(
        'API_WEB_ORIGINS',
        'debe usar únicamente los esquemas http:// o https://',
      );
    }

    return parsed.origin;
  });
}

function parseKeycloakPatientConfig(source: EnvironmentSource): KeycloakPatientConfig | undefined {
  const adminUrl = readOptional(source, 'KEYCLOAK_ADMIN_URL');
  const adminUser = readOptional(source, 'KEYCLOAK_ADMIN_USER');
  const adminPassword = readOptional(source, 'KEYCLOAK_ADMIN_PASSWORD');
  const realm = readOptional(source, 'KEYCLOAK_PATIENT_REALM');
  const clientId = readOptional(source, 'KEYCLOAK_PATIENT_CLIENT_ID');
  const clientSecret = readOptional(source, 'KEYCLOAK_PATIENT_CLIENT_SECRET');
  const issuerUrl = readOptional(source, 'KEYCLOAK_ISSUER_URL');

  // Si ninguna variable está definida, la feature está deshabilitada
  if (
    adminUrl === undefined &&
    adminUser === undefined &&
    adminPassword === undefined &&
    realm === undefined &&
    clientId === undefined &&
    clientSecret === undefined &&
    issuerUrl === undefined
  ) {
    return undefined;
  }

  // Si algunas están definidas pero no todas, es error de configuración
  const allDefined = [
    adminUrl,
    adminUser,
    adminPassword,
    realm,
    clientId,
    clientSecret,
    issuerUrl,
  ].every((v) => v !== undefined);

  if (!allDefined) {
    throw new EnvironmentValidationError(
      'KEYCLOAK_PATIENT_*',
      'están definidas parcialmente: debe definir todas las 7 variables (KEYCLOAK_ADMIN_URL, KEYCLOAK_ADMIN_USER, KEYCLOAK_ADMIN_PASSWORD, KEYCLOAK_PATIENT_REALM, KEYCLOAK_PATIENT_CLIENT_ID, KEYCLOAK_PATIENT_CLIENT_SECRET, KEYCLOAK_ISSUER_URL) o ninguna',
    );
  }

  // Validar URLs
  for (const [name, url] of [
    ['KEYCLOAK_ADMIN_URL', adminUrl!],
    ['KEYCLOAK_ISSUER_URL', issuerUrl!],
  ] as const) {
    try {
      new URL(url);
    } catch {
      throw new EnvironmentValidationError(name, 'no es una URL válida');
    }
  }

  return {
    adminUrl: adminUrl!,
    adminUser: adminUser!,
    adminPassword: adminPassword!,
    realm: realm!,
    clientId: clientId!,
    clientSecret: clientSecret!,
    issuerUrl: issuerUrl!,
  };
}

/** Variables de la configuración administrativa OIDC de provisión (MP04). */
export const ACCESS_PROVISIONING_ENV = {
  issuer: 'MERDN_ACCESS_PROVISIONING_ISSUER',
  clientId: 'MERDN_ACCESS_PROVISIONING_CLIENT_ID',
  clientSecret: 'MERDN_ACCESS_PROVISIONING_CLIENT_SECRET',
  /** Issuer humano, que debe coincidir exactamente. Se LEE, no se redeclara. */
  humanIssuer: 'MERDN_HUMAN_AUTH_ISSUER',
} as const;

/**
 * Realm local ÚNICO admitido para la provisión de cuentas (SPEC 038, MP04).
 *
 * No es una preferencia de despliegue: el realm `merdn-local` es el que contiene
 * las personas ficticias del entorno funcional, y aprovisionar un realm distinto
 * pondría credenciales preparadas para una demo delante de un proveedor con datos
 * reales.
 */
export const ACCESS_PROVISIONING_REALM = 'merdn-local';

/**
 * Hosts locales admitidos para la administración OIDC.
 *
 * Comparación por IGUALDAD EXACTA, igual que en el módulo humano: un host como
 * `localhost.ejemplo.invalid` no queda admitido. Se reutilizan los mismos
 * nombres que ya valida la autenticación humana para que las dos superficies no
 * puedan divergir sobre qué es "local".
 */
export const ACCESS_PROVISIONING_LOCAL_HOSTS: readonly string[] = [
  '127.0.0.1',
  'localhost',
  '::1',
  '[::1]',
  'host.docker.internal',
];

/** Normaliza un issuer para compararlo por igualdad exacta: sin barra final. */
function normalizeIssuer(value: string): string {
  return value.trim().replace(/\/+$/u, '');
}

/**
 * Deriva y valida la configuración administrativa OIDC.
 *
 * Devuelve `undefined` si NO se declara ninguna variable: en ese caso el
 * despliegue no aprovisiona cuentas y eso no es un error. Cualquier declaración
 * PARCIAL lanza, porque significa que alguien quiso habilitar la provisión y no
 * puede quedarse a medias sin que el arranque lo advierta.
 */
function parseAccessProvisioningConfig(
  source: EnvironmentSource,
  merdnEnvironment: MerdnEnvironment,
): AccessProvisioningConfig | undefined {
  const issuerRaw = readOptional(source, ACCESS_PROVISIONING_ENV.issuer);
  const clientId = readOptional(source, ACCESS_PROVISIONING_ENV.clientId);
  const clientSecret = readOptional(source, ACCESS_PROVISIONING_ENV.clientSecret);

  const declaradas = [issuerRaw, clientId, clientSecret].filter(
    (value) => value !== undefined,
  ).length;

  if (declaradas === 0) {
    return undefined;
  }

  if (declaradas !== 3) {
    throw new EnvironmentValidationError(
      'MERDN_ACCESS_PROVISIONING_*',
      'está definida parcialmente: deben definirse las tres (MERDN_ACCESS_PROVISIONING_ISSUER, ' +
        'MERDN_ACCESS_PROVISIONING_CLIENT_ID, MERDN_ACCESS_PROVISIONING_CLIENT_SECRET) o ninguna',
    );
  }

  if (merdnEnvironment === 'mvp') {
    throw new EnvironmentValidationError(
      ACCESS_PROVISIONING_ENV.issuer,
      `no puede estar definida en el entorno mvp: el realm ${ACCESS_PROVISIONING_REALM} ` +
        'contiene únicamente personas ficticias',
    );
  }

  const issuer = normalizeIssuer(issuerRaw as string);

  let parsed: URL;
  try {
    parsed = new URL(issuer);
  } catch {
    throw new EnvironmentValidationError(
      ACCESS_PROVISIONING_ENV.issuer,
      'no es una URL absoluta válida',
    );
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new EnvironmentValidationError(
      ACCESS_PROVISIONING_ENV.issuer,
      'debe usar el esquema https:// o, solo en desarrollo local, http://',
    );
  }

  if (parsed.username !== '' || parsed.password !== '') {
    throw new EnvironmentValidationError(
      ACCESS_PROVISIONING_ENV.issuer,
      'no puede incluir credenciales embebidas',
    );
  }

  if (parsed.search !== '' || parsed.hash !== '') {
    throw new EnvironmentValidationError(
      ACCESS_PROVISIONING_ENV.issuer,
      'no puede incluir cadena de consulta ni fragmento',
    );
  }

  if (!ACCESS_PROVISIONING_LOCAL_HOSTS.includes(parsed.hostname)) {
    throw new EnvironmentValidationError(
      ACCESS_PROVISIONING_ENV.issuer,
      'solo puede apuntar al bucle local o al nombre Docker local aprobado',
    );
  }

  /*
   * Realms exactamente `/realms/<nombre>` y `<nombre>` igual a `merdn-local`.
   * Se exige la FORMA COMPLETA: un issuer que solo contenga el fragmento en otro
   * punto del camino —`/merdn-local/realms/otro`— no cumple la decisión del
   * paquete y no debe pasar por contener la subcadena.
   */
  const realmMatch = /^\/realms\/([^/]+)\/?$/u.exec(parsed.pathname);

  if (realmMatch === null || realmMatch[1] !== ACCESS_PROVISIONING_REALM) {
    throw new EnvironmentValidationError(
      ACCESS_PROVISIONING_ENV.issuer,
      `debe apuntar exactamente al realm /realms/${ACCESS_PROVISIONING_REALM}`,
    );
  }

  /*
   * EL MISMO EMISOR QUE LA AUTENTICACIÓN HUMANA. No es una comprobación de
   * cortesía: la identidad persistida durante el registro es el `sub` de ESTE
   * emisor, y el inicio de sesión verifica el `sub` del emisor humano. Dos
   * emisores distintos dejarían toda cuenta preparada permanentemente
   * inaccesible, y la falla se manifestaría como un rechazo de login sin causa
   * visible.
   */
  const humanIssuerRaw = readOptional(source, ACCESS_PROVISIONING_ENV.humanIssuer);

  if (humanIssuerRaw === undefined) {
    throw new EnvironmentValidationError(
      ACCESS_PROVISIONING_ENV.issuer,
      `exige que ${ACCESS_PROVISIONING_ENV.humanIssuer} esté definida: sin autenticación ` +
        'humana no existe ninguna vía para utilizar una cuenta aprovisionada',
    );
  }

  if (normalizeIssuer(humanIssuerRaw) !== issuer) {
    throw new EnvironmentValidationError(
      ACCESS_PROVISIONING_ENV.issuer,
      `debe coincidir exactamente con ${ACCESS_PROVISIONING_ENV.humanIssuer}`,
    );
  }

  return {
    issuer,
    adminUrl: parsed.origin,
    realm: ACCESS_PROVISIONING_REALM,
    clientId: clientId as string,
    clientSecret: clientSecret as string,
  };
}

/**
 * Construye la configuración de la API a partir de una fuente de entorno.
 * Lanza `EnvironmentValidationError` ante la primera variable inválida.
 */
export function loadApiEnvironment(source: EnvironmentSource): ApiEnvironment {
  assertPostgresUrl(source, 'DATABASE_URL');

  const merdnEnvironment = parseMerdnEnvironment(source);
  const runtimeRoleMode = parseRuntimeRoleMode(source);

  return {
    merdnEnvironment,
    port: parsePort(source),
    openApiPath: parseOpenApiPath(source),
    runtimeRoleMode,
    hasSeparateRuntimeConnection: parseRuntimeConnection(source, runtimeRoleMode),
    activeTenantCode: parseIdentifier(
      source,
      'MERDN_ACTIVE_TENANT_CODE',
      DEFAULT_ACTIVE_TENANT_CODE,
    ),
    activeTenantId: parseActiveTenantId(source, runtimeRoleMode),
    consent: {
      version: parseIdentifier(source, 'MERDN_CONSENT_VERSION', DEFAULT_CONSENT_VERSION),
      purpose: parseIdentifier(source, 'MERDN_CONSENT_PURPOSE', DEFAULT_CONSENT_PURPOSE),
    },
    enrollmentSession: parseEnrollmentSession(source, merdnEnvironment),
    webOrigins: parseWebOrigins(source),
    enrollmentRateLimit: {
      maxRequests: parsePositiveInteger(
        source,
        'ENROLLMENT_RATE_LIMIT_MAX',
        DEFAULT_ENROLLMENT_RATE_LIMIT_MAX,
        10_000,
      ),
      windowSeconds: parsePositiveInteger(
        source,
        'ENROLLMENT_RATE_LIMIT_WINDOW_SECONDS',
        DEFAULT_ENROLLMENT_RATE_LIMIT_WINDOW_SECONDS,
        24 * 60 * 60,
      ),
    },
    keycloakPatient: parseKeycloakPatientConfig(source),
    accessProvisioning: parseAccessProvisioningConfig(source, merdnEnvironment),
  };
}
