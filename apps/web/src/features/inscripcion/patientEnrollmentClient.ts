/**
 * Cliente tipado de la API de inscripción (TASK-MVP-CORE-01 §8).
 *
 * Frontera única entre la experiencia de Inscripción y la API. Reglas:
 * - no guarda paciente, token ni datos personales en `localStorage`,
 *   `sessionStorage`, IndexedDB ni en la URL: la sesión viaja en una cookie
 *   `HttpOnly` que administra el backend y que este código no puede leer;
 * - solo envía los campos del contrato mínimo aprobado; los datos clínicos y
 *   los contactos capturados por el formulario NO se envían;
 * - no envía tenant, edad, estado, origen ni fecha de inscripción: son
 *   competencia exclusiva del servidor;
 * - la zona urbana o rural viaja tal como la declaró la persona; el cliente no
 *   la deduce de la dirección ni del corregimiento;
 * - los tipos replican el contrato del servidor sin importar Prisma ni acoplar
 *   el frontend a la persistencia.
 */

import { resolvePublicApiBaseUrl } from '@/config/environment';

import type { DatosPaciente } from './inscripcionFlow';

/* -------------------------------------------------------------------------- */
/* Contrato                                                                    */
/* -------------------------------------------------------------------------- */

export type DocumentTypeCode =
  | 'CEDULA_CIUDADANIA'
  | 'CEDULA_EXTRANJERIA'
  | 'PASAPORTE'
  | 'PERMISO_PROTECCION_TEMPORAL'
  | 'OTRO';

export type SexGenderCode = 'FEMENINO' | 'MASCULINO' | 'OTRO' | 'PREFIERE_NO_DECIRLO';

export type DeclarablePopulationCode = 'DISABILITY' | 'HOME_CARE_REQUIRED';

/** Área declarada de la dirección. Obligatoria en el contrato. */
export type AreaTypeCode = 'URBAN' | 'RURAL';

export type PopulationCode = 'OLDER_ADULT_60_PLUS' | DeclarablePopulationCode;

export type PopulationSourceCode = 'DECLARED' | 'DERIVED_BIRTH_DATE';

/**
 * Valor canónico para una localidad que no corresponde a ninguna unidad del
 * catálogo territorial controlado. No crea territorio oficial: el texto
 * declarado se conserva por separado y queda pendiente de normalización.
 */
export const LOCAL_UNIT_PENDING_NORMALIZATION = 'OTHER_PENDING_NORMALIZATION';

export interface PatientEnrollmentRequest {
  readonly documentType: DocumentTypeCode;
  readonly documentNumber: string;
  readonly givenNames: string;
  readonly familyNames: string;
  readonly birthDate: string;
  readonly sexGenderCode: SexGenderCode;
  readonly phone: string;
  readonly email?: string;
  readonly epsCode: string;
  readonly declaredPopulations: readonly DeclarablePopulationCode[];
  readonly territory: {
    readonly departmentCode: string;
    readonly municipalityCode: string;
    readonly localUnitId: string;
    readonly localityDeclaredText?: string;
    readonly settlementDeclaredText?: string;
    /** Zona urbana o rural declarada por la persona. Obligatoria. */
    readonly areaType: AreaTypeCode;
    readonly exactAddress: string;
    readonly directions?: string;
  };
  readonly consentAccepted: boolean;
}

export interface PatientSummary {
  readonly status: 'ACTIVE';
  readonly enrolledAt: string;
  readonly givenNames: string;
  readonly familyNames: string;
  readonly age: number;
  readonly populations: readonly {
    readonly populationType: PopulationCode;
    readonly source: PopulationSourceCode;
  }[];
  readonly territory: {
    readonly departmentCode: string;
    readonly departmentName: string;
    readonly municipalityCode: string;
    readonly municipalityName: string;
    readonly localityName: string | null;
    readonly localityPendingNormalization: boolean;
    readonly areaType: AreaTypeCode;
  };
  readonly epsCode: string;
  readonly epsName: string;
}

/** Desenlace del envío, ya traducido a lenguaje de la interfaz. */
export type EnrollmentOutcome =
  | { readonly kind: 'created'; readonly patient: PatientSummary }
  | { readonly kind: 'conflict'; readonly message: string }
  | { readonly kind: 'error'; readonly message: string };

/* -------------------------------------------------------------------------- */
/* Catálogos de traducción interfaz → contrato                                 */
/* -------------------------------------------------------------------------- */

const DOCUMENT_TYPES: Readonly<Record<string, DocumentTypeCode>> = {
  'Cédula de ciudadanía': 'CEDULA_CIUDADANIA',
  'Cédula de extranjería': 'CEDULA_EXTRANJERIA',
  Pasaporte: 'PASAPORTE',
  'Permiso por Protección Temporal': 'PERMISO_PROTECCION_TEMPORAL',
  Otro: 'OTRO',
};

const SEX_GENDER: Readonly<Record<string, SexGenderCode>> = {
  Femenino: 'FEMENINO',
  Masculino: 'MASCULINO',
  Otro: 'OTRO',
  'Prefiero no decirlo': 'PREFIERE_NO_DECIRLO',
};

const EPS_CODES: Readonly<Record<string, string>> = {
  'Nueva EPS': 'NUEVA_EPS',
  Sanitas: 'SANITAS',
  Sura: 'SURA',
  'Salud Total': 'SALUD_TOTAL',
  Compensar: 'COMPENSAR',
  Famisanar: 'FAMISANAR',
  'Otra EPS': 'OTRA_EPS',
  'No sabe': 'NO_SABE',
  'No tiene EPS': 'NO_TIENE_EPS',
};

/* -------------------------------------------------------------------------- */
/* Mapeo interfaz → contrato                                                   */
/* -------------------------------------------------------------------------- */

function opcional(valor: string): string | undefined {
  const texto = valor.trim();
  return texto.length === 0 ? undefined : texto;
}

/**
 * Traduce los valores del formulario al cuerpo de la API.
 *
 * NO se envían, de forma deliberada (TASK-MVP-CORE-01 §7 y §12):
 * - la edad ni la casilla de mayor de 60: las deriva el servidor;
 * - diagnósticos y otros diagnósticos, tipo de discapacidad, registro RLCPD,
 *   tenencia de cuidador ni apoyos: son datos clínicos u operativos fuera del
 *   mínimo aprobado de CORE-01;
 * - teléfono alterno, contacto familiar ni contacto cercano: son contactos
 *   fuera del mínimo aprobado;
 * - tenant, estado, origen ni fecha de inscripción: los asigna el servidor.
 *
 * El barrio o vereda viaja como texto declarado junto a la opción canónica
 * «pendiente de normalización», porque el catálogo territorial controlado no
 * incluye todavía unidades locales verificadas.
 */
export function buildPatientEnrollmentRequest(
  valores: DatosPaciente,
): PatientEnrollmentRequest {
  const declaredPopulations: DeclarablePopulationCode[] = [];
  if (valores.discapacidad) {
    declaredPopulations.push('DISABILITY');
  }
  if (valores.requiereCuidadoCasa) {
    declaredPopulations.push('HOME_CARE_REQUIRED');
  }

  return {
    documentType: DOCUMENT_TYPES[valores.tipoDocumento] ?? 'OTRO',
    documentNumber: valores.documento.trim(),
    givenNames: valores.nombres.trim(),
    familyNames: valores.apellidos.trim(),
    birthDate: valores.fechaNacimiento,
    sexGenderCode: SEX_GENDER[valores.sexo] ?? 'PREFIERE_NO_DECIRLO',
    phone: valores.telefono.trim(),
    ...(opcional(valores.correo) === undefined
      ? {}
      : { email: opcional(valores.correo) }),
    epsCode: EPS_CODES[valores.eps] ?? valores.eps,
    declaredPopulations,
    territory: {
      departmentCode: valores.ubicacion.departamento,
      municipalityCode: valores.ubicacion.municipio,
      localUnitId: LOCAL_UNIT_PENDING_NORMALIZATION,
      localityDeclaredText: valores.barrio.trim(),
      /*
       * La zona la declara la persona en el paso 3, que no deja continuar sin
       * ella. Si aun así llegara vacía, se envía vacía a propósito: el cliente
       * NO inventa un área, y el servidor responde 422 sobre este mismo campo.
       */
      areaType: valores.zona as AreaTypeCode,
      ...(opcional(valores.ubicacion.corregimiento) === undefined
        ? {}
        : { settlementDeclaredText: opcional(valores.ubicacion.corregimiento) }),
      exactAddress: valores.direccion.trim(),
      ...(opcional(valores.indicaciones) === undefined
        ? {}
        : { directions: opcional(valores.indicaciones) }),
    },
    consentAccepted: valores.autorizaDatos,
  };
}

/* -------------------------------------------------------------------------- */
/* Llamadas                                                                    */
/* -------------------------------------------------------------------------- */

const ENROLLMENTS_PATH = '/api/v1/patients/enrollments';
const ME_PATH = '/api/v1/patients/me';

const MENSAJE_CONFLICTO =
  'Ese documento ya está inscrito. Si cree que se trata de un error, comuníquese con su institución.';
const MENSAJE_VALIDACION =
  'Algunos datos no se pudieron registrar. Revise la información y vuelva a intentarlo.';
const MENSAJE_RED =
  'No fue posible conectar con el servicio. Revise su conexión y vuelva a intentarlo.';
const MENSAJE_LIMITE =
  'Se recibieron demasiados intentos desde este dispositivo. Espere unos minutos y vuelva a intentarlo.';

/**
 * Envía la inscripción. Nunca lanza: devuelve siempre un desenlace tipado para
 * que la interfaz pueda mostrar un estado accesible y permitir el reintento.
 */
export async function submitPatientEnrollment(
  request: PatientEnrollmentRequest,
  fetchImpl: typeof fetch = fetch,
): Promise<EnrollmentOutcome> {
  let response: Response;

  try {
    response = await fetchImpl(`${resolvePublicApiBaseUrl()}${ENROLLMENTS_PATH}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // La cookie `HttpOnly` de sesión la administra el navegador.
      credentials: 'include',
      body: JSON.stringify(request),
    });
  } catch {
    return { kind: 'error', message: MENSAJE_RED };
  }

  if (response.status === 201) {
    try {
      const patient = (await response.json()) as PatientSummary;
      return { kind: 'created', patient };
    } catch {
      return { kind: 'error', message: MENSAJE_RED };
    }
  }

  if (response.status === 409) {
    return { kind: 'conflict', message: MENSAJE_CONFLICTO };
  }

  if (response.status === 429) {
    return { kind: 'error', message: MENSAJE_LIMITE };
  }

  if (response.status === 400 || response.status === 422) {
    return { kind: 'error', message: MENSAJE_VALIDACION };
  }

  return { kind: 'error', message: MENSAJE_RED };
}

/**
 * Recupera el paciente de la sesión vigente.
 *
 * Devuelve `null` cuando no hay sesión válida. No distingue entre ausencia,
 * expiración y revocación: esa diferencia no debe deducirse desde el cliente.
 */
export async function fetchCurrentPatient(
  fetchImpl: typeof fetch = fetch,
): Promise<PatientSummary | null> {
  try {
    const response = await fetchImpl(`${resolvePublicApiBaseUrl()}${ME_PATH}`, {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as PatientSummary;
  } catch {
    return null;
  }
}
