/**
 * Configuración tipada del frontend MERDN (TASK-001, FR-18).
 *
 * Reglas aplicadas:
 * - Fail-fast: la ausencia de una variable indispensable produce un error
 *   técnico claro en lugar de un comportamiento silencioso.
 * - Redacción: los mensajes nombran la variable, nunca su valor.
 * - Sin secretos: el frontend de la fundación no recibe ni maneja secretos.
 */

/** Entornos técnicos admitidos por la fundación (no son tenants ni negocio). */
export const MERDN_ENVIRONMENTS = ['development', 'test', 'mvp'] as const;

export type MerdnEnvironment = (typeof MERDN_ENVIRONMENTS)[number];

/** Configuración efectiva del frontend, sin secretos. */
export interface WebEnvironment {
  readonly merdnEnvironment: MerdnEnvironment;
  readonly apiBaseUrl: string;
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

type EnvironmentSource = Readonly<Record<string, string | undefined>>;

function readOptional(source: EnvironmentSource, name: string): string | undefined {
  const raw = source[name];
  if (raw === undefined) {
    return undefined;
  }

  const trimmed = raw.trim();
  return trimmed.length === 0 ? undefined : trimmed;
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

/**
 * URL base de la API que el frontend usará en tareas posteriores.
 * TASK-001 solo la valida en el arranque: la página técnica no realiza
 * llamadas a la API ni muestra la URL.
 */
function parseApiBaseUrl(source: EnvironmentSource): string {
  const value = readOptional(source, 'MERDN_API_BASE_URL');
  if (value === undefined) {
    throw new EnvironmentValidationError(
      'MERDN_API_BASE_URL',
      'no está definida o está vacía',
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new EnvironmentValidationError('MERDN_API_BASE_URL', 'no es una URL válida');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new EnvironmentValidationError(
      'MERDN_API_BASE_URL',
      'debe usar el esquema http:// o https://',
    );
  }

  return parsed.origin;
}

/**
 * Construye la configuración del frontend a partir de una fuente de entorno.
 * Lanza `EnvironmentValidationError` ante la primera variable inválida.
 */
export function loadWebEnvironment(source: EnvironmentSource): WebEnvironment {
  return {
    merdnEnvironment: parseMerdnEnvironment(source),
    apiBaseUrl: parseApiBaseUrl(source),
  };
}

/* -------------------------------------------------------------------------- */
/* URL pública de la API para el navegador (TASK-MVP-CORE-01 §10)              */
/* -------------------------------------------------------------------------- */

/**
 * URL por defecto de la API en desarrollo local.
 *
 * Se usa `127.0.0.1` y no `localhost` de forma deliberada: la cookie de sesión
 * de inscripción viaja con `SameSite=Lax`, que solo la envía entre puertos del
 * MISMO host. Abrir la web en `http://127.0.0.1:3000` y llamar a la API en
 * `http://127.0.0.1:3001` cumple esa condición; mezclar `localhost` con
 * `127.0.0.1` no, y la sesión no viajaría.
 */
export const DEFAULT_PUBLIC_API_BASE_URL = 'http://127.0.0.1:3001';

/**
 * URL base de la API accesible desde el navegador.
 *
 * `MERDN_API_BASE_URL` describe la URL interna entre contenedores y no puede
 * usarse en el cliente. Esta variable, con prefijo público, es la que Next.js
 * incorpora al paquete del navegador. No es un secreto.
 *
 * La lectura usa la forma literal `process.env.NEXT_PUBLIC_...` porque Next.js
 * sustituye exactamente esa expresión durante la compilación.
 */
export function resolvePublicApiBaseUrl(): string {
  const value = process.env.NEXT_PUBLIC_MERDN_API_BASE_URL?.trim();
  if (value === undefined || value.length === 0) {
    return DEFAULT_PUBLIC_API_BASE_URL;
  }

  try {
    return new URL(value).origin;
  } catch {
    // Una URL mal formada no debe romper la interfaz en tiempo de ejecución:
    // se recurre al valor por defecto de desarrollo local.
    return DEFAULT_PUBLIC_API_BASE_URL;
  }
}
