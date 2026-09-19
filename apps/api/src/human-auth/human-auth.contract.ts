/**
 * Contrato de la identidad y la sesión HUMANA
 * (IDENTITY-RELATIONSHIPS-CORE-01 §4, §6, §8.1).
 *
 * ALCANCE DECLARADO: esto NO es el sistema completo de usuarios, roles y
 * permisos de MERDN. Es el núcleo compartido que autentica y atribuye a una
 * PERSONA mediante `HumanAccount -> Person`, y que resuelve server-side las
 * participaciones que esa persona ya tuviera —paciente, profesional, cuidadora—.
 *
 * Existe UN solo flujo de autenticación (AD-01): OIDC Authorization Code con
 * PKCE S256. NO existe segundo adapter, `dev-login`, cabecera de identidad, JWT
 * sin firma, contraseña MERDN, sesión manual ni repliegue. Si discovery, JWKS o
 * el proveedor fallan, el acceso falla CERRADO.
 *
 * Los códigos de error son estables y deliberadamente pobres en información:
 * una denegación no revela si la sesión faltaba, expiró, fue revocada, si la
 * cuenta está deshabilitada o si el `subject` está siquiera aprovisionado.
 */

/**
 * Nombre de la cookie de sesión humana.
 *
 * Es DISTINTO del de la cookie de autoinscripción y del de la institucional a
 * propósito: las tres son entidades separadas y ninguna autentica a las otras.
 * Su coexistencia en el mismo navegador NO puede elegir un principal ambiguo,
 * porque cada superficie lee EXCLUSIVAMENTE el nombre que le corresponde.
 */
export const HUMAN_SESSION_COOKIE_NAME = 'merdn_human_session';

/**
 * Cookie TRANSITORIA del intento de autenticación en curso (§4.3).
 *
 * Contiene únicamente un token opaco. State, nonce y verifier PKCE NUNCA viajan
 * al navegador: viven en el servidor, hasheados y cifrados respectivamente.
 */
export const HUMAN_AUTH_ATTEMPT_COOKIE_NAME = 'merdn_human_auth_attempt';

/** Códigos de error del contrato humano. */
export const HUMAN_AUTH_ERROR_CODES = {
  /** Consulta o cuerpo con forma no admitida. */
  invalidRequest: 'HUMAN_AUTH_INVALID_REQUEST',
  /**
   * El intercambio OIDC no concluyó en una sesión. Es IDÉNTICO para intento
   * ausente, expirado, consumido o no coincidente; state, nonce, code o PKCE
   * manipulados; firma, emisor, audiencia, algoritmo o vigencia inválidos; y
   * `subject` no aprovisionado, cuenta deshabilitada o vínculo desvinculado.
   */
  authenticationFailed: 'HUMAN_AUTH_FAILED',
  /** No hay sesión humana vigente. */
  sessionRequired: 'HUMAN_SESSION_REQUIRED',
  /** Origen no autorizado en una operación que cambia estado. */
  originRejected: 'HUMAN_AUTH_ORIGIN_REJECTED',
  /** Demasiados intentos desde el mismo origen. */
  rateLimited: 'HUMAN_AUTH_RATE_LIMITED',
  /** Fallo interno controlado. Nunca describe la topología. */
  unavailable: 'HUMAN_AUTH_SERVICE_UNAVAILABLE',
} as const;

/**
 * Contextos que una persona puede tener disponibles (§8.1).
 *
 * Un contexto DISPONIBLE no concede acceso a ningún recurso: solo dice que la
 * persona tiene esa participación viva en el servidor. Cada operación posterior
 * vuelve a evaluar perfil, afiliación, asignación y relación.
 */
export const HUMAN_CONTEXTS = ['PATIENT', 'PROFESSIONAL', 'CAREGIVER'] as const;

export type HumanContext = (typeof HUMAN_CONTEXTS)[number];

/**
 * Allowlist CERRADA de destinos posteriores al login (§4.3).
 *
 * Es una LISTA literal, no una forma. Una expresión permisiva —«toda ruta que
 * empiece por `/`»— acabaría aceptando `//host-ajeno` o `/\host-ajeno`, que los
 * navegadores tratan como destino externo. La lista también vive como CHECK en
 * la base, de modo que ampliarla exige una migración.
 */
export const HUMAN_AUTH_RETURN_TARGETS = ['/'] as const;

export type HumanAuthReturnTarget = (typeof HUMAN_AUTH_RETURN_TARGETS)[number];

/** Destino usado cuando la petición no declara ninguno. */
export const HUMAN_AUTH_DEFAULT_RETURN_TARGET: HumanAuthReturnTarget = '/';

/** Comprueba que un destino pertenece a la allowlist cerrada. */
export function isAllowedReturnTarget(value: unknown): value is HumanAuthReturnTarget {
  return (
    typeof value === 'string' &&
    (HUMAN_AUTH_RETURN_TARGETS as readonly string[]).includes(value)
  );
}

/* -------------------------------------------------------------------------- */
/* Parámetros temporales aprobados (AD-06, §4.3, §12)                          */
/* -------------------------------------------------------------------------- */

/** Vigencia ABSOLUTA de la sesión humana: 30 días (Spec 027: ajustado para pacientes). No se renueva usándola. */
export const HUMAN_SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;

/** Inactividad máxima admitida: 72 horas (Spec 027: ajustado para pacientes). */
export const HUMAN_SESSION_IDLE_SECONDS = 72 * 60 * 60;

/** Vigencia FIJA del intento de autenticación: 10 minutos. */
export const HUMAN_AUTH_ATTEMPT_TTL_SECONDS = 600;

/** Único algoritmo de firma admitido para el ID token. */
export const HUMAN_AUTH_ALLOWED_ALGORITHM = 'RS256';

/** Único `scope` solicitado: no se pide perfil, correo ni ningún dato personal. */
export const HUMAN_AUTH_SCOPE = 'openid';

/* -------------------------------------------------------------------------- */
/* Variables de entorno                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Variables leídas por este módulo.
 *
 * Se declaran aquí, y no en `config/environment.ts`, por la MISMA razón ya
 * aprobada para el módulo institucional: son propias del aprovisionamiento de
 * autenticación y su validación debe fallar cerrada dentro del módulo que las
 * usa. Ninguna se registra ni se devuelve jamás.
 *
 * `MERDN_HUMAN_AUTH_ATTEMPT_KEY` es la ÚNICA fuente de la clave AES-256-GCM que
 * cifra el verifier PKCE. No tiene valor por defecto y nunca se deriva de otra
 * variable: sin ella, el módulo de autenticación no se habilita.
 */
export const HUMAN_AUTH_ENV = {
  issuer: 'MERDN_HUMAN_AUTH_ISSUER',
  clientId: 'MERDN_HUMAN_AUTH_CLIENT_ID',
  callbackUri: 'MERDN_HUMAN_AUTH_CALLBACK_URI',
  attemptKey: 'MERDN_HUMAN_AUTH_ATTEMPT_KEY',
  discoveryTimeoutMs: 'MERDN_HUMAN_AUTH_DISCOVERY_TIMEOUT_MS',
  sessionTtlSeconds: 'MERDN_HUMAN_SESSION_TTL_SECONDS',
  sessionIdleSeconds: 'MERDN_HUMAN_SESSION_IDLE_SECONDS',
  attemptTtlSeconds: 'MERDN_HUMAN_AUTH_ATTEMPT_TTL_SECONDS',
  rateLimitMax: 'MERDN_HUMAN_AUTH_RATE_LIMIT_MAX',
  rateLimitWindowSeconds: 'MERDN_HUMAN_AUTH_RATE_LIMIT_WINDOW_SECONDS',
  /** Allowlist de emisores admitidos por el comando de provisioning (§9). */
  provisioningIssuers: 'MERDN_IDENTITY_PROVISIONING_ISSUERS',
} as const;

/**
 * Nombre de host local APROBADO para el proveedor OIDC de desarrollo
 * (§4.1, continuación §3.3).
 *
 * Es EXACTAMENTE `host.docker.internal` y ningún otro. Se admite además del
 * bucle local porque el navegador y la API deben alcanzar un ÚNICO issuer
 * canónico en la topología documentada, en la que la API se ejecuta DENTRO de
 * Compose: desde ese contenedor, `127.0.0.1` apunta a la propia API y no al
 * proveedor, de modo que un issuer de bucle local sería inalcanzable allí y el
 * `iss` verificado dejaría de coincidir entre navegador y servidor.
 *
 * NO es una forma ni un sufijo: la comparación es por igualdad exacta, de modo
 * que un host como `host.docker.internal.ejemplo.invalid` NO queda admitido.
 * Sigue restringido a `development` y `test`, y sigue exigiendo que el realm
 * local quede prohibido en `mvp`.
 */
export const HUMAN_AUTH_LOCAL_DOCKER_HOST = 'host.docker.internal';

/** Nombres de host de bucle local admitidos para un issuer sin TLS. */
export const HUMAN_AUTH_LOOPBACK_HOSTS: readonly string[] = [
  '127.0.0.1',
  'localhost',
  '::1',
  '[::1]',
];

/**
 * Fragmento del realm LOCAL de desarrollo.
 *
 * Un issuer que lo contenga queda PROHIBIDO fuera de `development` y `test`,
 * incluso si llegara por HTTPS: el realm local contiene únicamente personas
 * ficticias y no puede autenticar a nadie en un entorno con datos.
 */
export const HUMAN_AUTH_LOCAL_REALM_MARKER = 'merdn-local';
