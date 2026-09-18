import { type ApiEnvironment } from '../config/environment';

import {
  HOSPITAL_PATIENT_VIEWER_IDENTITY_CODE,
  INSTITUTIONAL_ENV,
  INSTITUTIONAL_IDENTITY_CODE_PATTERN,
  INSTITUTIONAL_SECRET_MIN_LENGTH,
  INSTITUTIONAL_SESSION_DEFAULT_TTL_SECONDS,
  INSTITUTIONAL_SESSION_MAX_TTL_SECONDS,
  MUNICIPAL_VIEWER_IDENTITY_CODE,
  type InstitutionalRoleCode,
} from './institutional-auth.contract';
import { type InstitutionalCookieOptions } from './institutional-session.cookie';

/**
 * Configuración del acceso institucional (TASK-MUNICIPALITY-CORE-01, FR-13;
 * generalizada por TASK-HOSPITAL-CORE-01 §4.1.2 y §9.2).
 *
 * Se resuelve aquí, y no en `config/environment.ts`, porque `environment.ts` no
 * forma parte de los archivos autorizados de ninguna de las dos Tasks. La
 * frontera se respeta igualmente: la configuración se lee UNA vez, se valida, no
 * se registra y ningún secreto se copia a una respuesta, a un log ni a un evento
 * de auditoría.
 *
 * GENERALIZACIÓN ADITIVA: el aprovisionamiento deja de describir UNA identidad y
 * pasa a describir una LISTA de identidades configuradas —hoy Alcaldía y
 * Hospital—, cada una con su propio código, su propio rol y su propia
 * credencial. Cada rol es FAIL-CLOSED e INDEPENDIENTE:
 *
 * - sin credencial válida para un rol, esa identidad NO se aprovisiona y su
 *   superficie responde como no autenticada;
 * - configurar Hospital no habilita Alcaldía, ni al revés;
 * - JAMÁS existe un valor por defecto para una credencial.
 *
 * Un rol puede además EXIGIR que su código se configure. Los dos roles de
 * consulta conservan su código histórico por defecto por compatibilidad, pero
 * `HOSPITAL_SCHEDULER` no tiene ninguno: su código y su credencial deben estar
 * ambos presentes y ser válidos en la MISMA carga de configuración, o la
 * identidad se omite por completo. No hay fallback, código derivado del rol ni
 * literal incorporado en fuente.
 *
 * Los atributos de transporte de la cookie (`SameSite`, dominio) describen la
 * TOPOLOGÍA del despliegue, no la semántica de inscripción, y por eso se
 * reutilizan de la política de cookies ya validada. `Secure` se recalcula aquí
 * para no depender de una anulación pensada para otra cookie.
 */

/** Identidad institucional efectivamente configurada por el entorno. */
export interface ProvisionedIdentityConfig {
  readonly role: InstitutionalRoleCode;
  readonly identityCode: string;
  readonly accessSecret: string;
}

/** Identidad NO configurada, con el motivo técnico de su ausencia. */
export interface SkippedIdentityConfig {
  readonly role: InstitutionalRoleCode;
  /** Motivo técnico. Nombra la variable, NUNCA su valor. */
  readonly reason: string;
}

export interface InstitutionalProvisioning {
  /** Identidades aprovisionables, en orden estable de rol. */
  readonly identities: readonly ProvisionedIdentityConfig[];
  /** Identidades omitidas y por qué. */
  readonly skipped: readonly SkippedIdentityConfig[];
  /**
   * Código que se usa cuando la petición NO envía `identityCode`.
   *
   * Es exclusivamente el código municipal ya configurado: conserva la
   * compatibilidad del cliente Alcaldía existente, que nunca envió el campo.
   * `null` cuando Alcaldía no está configurada; en ese caso una petición sin
   * `identityCode` no puede resolver ninguna identidad.
   */
  readonly compatibilityIdentityCode: string | null;
}

export interface InstitutionalAuthConfig {
  readonly provisioning: InstitutionalProvisioning;
  readonly sessionTtlSeconds: number;
  readonly cookie: InstitutionalCookieOptions;
}

type EnvironmentSource = Readonly<Record<string, string | undefined>>;

/** Descripción declarativa de cada rol aprovisionable por configuración. */
interface IdentidadConfigurable {
  readonly role: InstitutionalRoleCode;
  readonly secretVariable: string;
  readonly codeVariable: string;
  /**
   * Código histórico por defecto del rol, si lo tiene.
   *
   * AUSENTE significa que el rol EXIGE código configurado: sin un valor válido
   * en su variable no se aprovisiona. Es deliberado que la distinción esté en el
   * tipo y no en una convención: añadir un rol nuevo obliga a decidirla.
   */
  readonly defaultCode?: string;
  readonly surface: string;
}

const IDENTIDADES_CONFIGURABLES: readonly IdentidadConfigurable[] = [
  {
    role: 'MUNICIPAL_VIEWER',
    secretVariable: INSTITUTIONAL_ENV.municipalViewerSecret,
    codeVariable: INSTITUTIONAL_ENV.municipalViewerCode,
    defaultCode: MUNICIPAL_VIEWER_IDENTITY_CODE,
    surface: 'los agregados municipales',
  },
  {
    role: 'HOSPITAL_PATIENT_VIEWER',
    secretVariable: INSTITUTIONAL_ENV.hospitalPatientViewerSecret,
    codeVariable: INSTITUTIONAL_ENV.hospitalPatientViewerCode,
    defaultCode: HOSPITAL_PATIENT_VIEWER_IDENTITY_CODE,
    surface: 'la consulta hospitalaria de Pacientes',
  },
  /*
   * TASK-HOSPITAL-CORE-02. Credencial y codigo PROPIOS y SEPARADOS: configurar
   * la agenda no habilita la consulta de Pacientes, ni al reves.
   *
   * SIN `defaultCode`: la agenda exige CODIGO y CREDENCIAL configurados y
   * validos. Es el unico rol que lo exige, y esa exigencia es deliberada.
   */
  {
    role: 'HOSPITAL_SCHEDULER',
    secretVariable: INSTITUTIONAL_ENV.hospitalSchedulerSecret,
    codeVariable: INSTITUTIONAL_ENV.hospitalSchedulerCode,
    surface: 'la agenda hospitalaria',
  },
  /*
   * IDENTITY-RELATIONSHIPS-CORE-01 (AD-03). Credencial y codigo PROPIOS y
   * SEPARADOS: configurar la gestion de relaciones no habilita la agenda, la
   * consulta de Pacientes ni los agregados municipales, ni al reves.
   *
   * SIN `defaultCode`, igual que la agenda: exige CODIGO y CREDENCIAL
   * configurados y validos, o la identidad NO se aprovisiona. Un operador capaz
   * de autorizar el acceso de una persona a los datos de otra no puede quedar
   * habilitado por un literal incorporado en el codigo fuente.
   */
  {
    role: 'CAREGIVER_RELATIONSHIP_MANAGER',
    secretVariable: INSTITUTIONAL_ENV.caregiverRelationshipManagerSecret,
    codeVariable: INSTITUTIONAL_ENV.caregiverRelationshipManagerCode,
    surface: 'la gestion de relaciones Paciente-Cuidador',
  },
];

function readOptional(source: EnvironmentSource, name: string): string | undefined {
  const raw = source[name];
  if (raw === undefined) {
    return undefined;
  }

  const trimmed = raw.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

function parseTtlSeconds(source: EnvironmentSource): number {
  const value = readOptional(source, INSTITUTIONAL_ENV.sessionTtlSeconds);
  if (value === undefined || !/^\d+$/u.test(value)) {
    return INSTITUTIONAL_SESSION_DEFAULT_TTL_SECONDS;
  }

  const parsed = Number.parseInt(value, 10);
  if (parsed < 60 || parsed > INSTITUTIONAL_SESSION_MAX_TTL_SECONDS) {
    return INSTITUTIONAL_SESSION_DEFAULT_TTL_SECONDS;
  }

  return parsed;
}

/**
 * Código declarado por configuración, o el código por defecto del rol.
 *
 * Devuelve `null` cuando el rol NO tiene código por defecto y su variable falta,
 * está en blanco o no cumple la forma admitida. Ese `null` es la señal de
 * FAIL-CLOSED: no se sustituye por un literal, ni se deriva del nombre del rol,
 * ni se reutiliza el código de otra identidad.
 */
function parseIdentityCode(
  source: EnvironmentSource,
  definicion: IdentidadConfigurable,
): string | null {
  const value = readOptional(source, definicion.codeVariable);
  if (value === undefined || !INSTITUTIONAL_IDENTITY_CODE_PATTERN.test(value)) {
    return definicion.defaultCode ?? null;
  }

  return value;
}

/**
 * Lee la configuración de las identidades institucionales.
 *
 * Cada rol se evalúa por separado: la ausencia o la debilidad de una credencial
 * cierra ESA identidad y no afecta a las demás. Dos roles no pueden compartir
 * código dentro del mismo tenant; ante colisión se conserva el primero declarado
 * y el segundo se omite con motivo explícito, porque un mismo código no puede
 * resolver dos roles distintos sin volverse ambiguo.
 */
function parseProvisioning(source: EnvironmentSource): InstitutionalProvisioning {
  const identities: ProvisionedIdentityConfig[] = [];
  const skipped: SkippedIdentityConfig[] = [];
  const codigosUsados = new Map<string, InstitutionalRoleCode>();

  for (const definicion of IDENTIDADES_CONFIGURABLES) {
    const secret = readOptional(source, definicion.secretVariable);

    if (secret === undefined) {
      skipped.push({
        role: definicion.role,
        reason:
          `${definicion.secretVariable} no está definida: la identidad institucional ` +
          `de ${definicion.surface} NO se aprovisiona y esa superficie responde ` +
          'como no autenticada.',
      });
      continue;
    }

    if (secret.length < INSTITUTIONAL_SECRET_MIN_LENGTH) {
      skipped.push({
        role: definicion.role,
        reason:
          `${definicion.secretVariable} es más corta que ` +
          `${INSTITUTIONAL_SECRET_MIN_LENGTH} caracteres: la identidad institucional ` +
          `de ${definicion.surface} NO se aprovisiona. El valor recibido no se ` +
          'registra por seguridad.',
      });
      continue;
    }

    const identityCode = parseIdentityCode(source, definicion);

    if (identityCode === null) {
      /*
       * El rol exige código configurado y no lo hay, o el recibido no cumple la
       * forma admitida. El motivo nombra la variable y la superficie, NUNCA el
       * valor recibido: un código mal formado puede ser hostil y no debe
       * llegar a un registro.
       */
      skipped.push({
        role: definicion.role,
        reason:
          `${definicion.codeVariable} no está definida o no cumple la forma admitida ` +
          `de código institucional: la identidad de ${definicion.surface} NO se ` +
          'aprovisiona y esa superficie responde como no autenticada. El valor ' +
          'recibido no se registra por seguridad.',
      });
      continue;
    }

    const ocupadoPor = codigosUsados.get(identityCode);

    if (ocupadoPor !== undefined) {
      skipped.push({
        role: definicion.role,
        reason:
          `${definicion.codeVariable} declara un código ya usado por el rol ` +
          `${ocupadoPor}: la identidad de ${definicion.surface} NO se aprovisiona, ` +
          'porque un mismo código no puede resolver dos roles distintos.',
      });
      continue;
    }

    codigosUsados.set(identityCode, definicion.role);
    identities.push({ role: definicion.role, identityCode, accessSecret: secret });
  }

  const municipal = identities.find((identity) => identity.role === 'MUNICIPAL_VIEWER');

  return {
    identities,
    skipped,
    compatibilityIdentityCode: municipal?.identityCode ?? null,
  };
}

/** Construye la configuración institucional efectiva. */
export function loadInstitutionalAuthConfig(
  source: EnvironmentSource,
  environment: ApiEnvironment,
): InstitutionalAuthConfig {
  const sameSite = environment.enrollmentSession.sameSite;

  return {
    provisioning: parseProvisioning(source),
    sessionTtlSeconds: parseTtlSeconds(source),
    cookie: {
      sameSite,
      // `SameSite=None` solo es válido junto con `Secure`, según la
      // especificación de cookies.
      secure: environment.merdnEnvironment !== 'development' || sameSite === 'none',
      domain: environment.enrollmentSession.domain,
      ttlSeconds: parseTtlSeconds(source),
    },
  };
}
