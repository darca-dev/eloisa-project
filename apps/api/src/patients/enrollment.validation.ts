/**
 * Validación y normalización del cuerpo de `POST /api/v1/patients/enrollments`
 * (TASK-MVP-CORE-01 §7).
 *
 * Se implementa como funciones puras y explícitas en lugar de decoradores de
 * validación por tres razones verificables:
 * 1. la Task exige distinguir `400` (cuerpo mal formado) de `422` (validación
 *    semántica), y aquí esa distinción es explícita;
 * 2. permite rechazar propiedades desconocidas con una allowlist estricta;
 * 3. evita añadir dependencias de runtime adicionales al conjunto aprobado.
 *
 * Los errores devuelven ÚNICAMENTE nombres de campo. Nunca devuelven el valor
 * recibido, de modo que un mensaje de error no puede filtrar datos personales.
 */

import {
  AREA_TYPE_CODES,
  DECLARABLE_POPULATION_CODES,
  DOCUMENT_TYPE_CODES,
  LOCAL_UNIT_PENDING_NORMALIZATION,
  SEX_GENDER_CODES,
  type AreaTypeCode,
  type DeclarablePopulationCode,
  type DocumentTypeCode,
  type SexGenderCodeValue,
} from './enrollment.contract';
import { findEpsByCode, type EpsCatalogEntry } from './enrollment.catalogs';
import {
  DOCUMENT_NUMBER_MAX_LENGTH,
  normalizeDocumentNumber,
} from './document-normalization';
import {
  MAX_PLAUSIBLE_AGE_YEARS,
  deriveAgeInYears,
  parseIsoCalendarDate,
  toUtcMidnight,
} from './population-derivation';

/** Límites de longitud aplicados a los campos de texto. */
export const FIELD_LIMITS = {
  name: 120,
  phone: 32,
  email: 254,
  exactAddress: 200,
  directions: 500,
  localityText: 120,
  settlementText: 120,
} as const;

/** Propiedades admitidas en la raíz del cuerpo. */
const ALLOWED_ROOT_KEYS = [
  'documentType',
  'documentNumber',
  'givenNames',
  'familyNames',
  'birthDate',
  'sexGenderCode',
  'phone',
  'email',
  'epsCode',
  'declaredPopulations',
  'territory',
  'consentAccepted',
  'password',
] as const;

/** Propiedades admitidas dentro de `territory`. */
const ALLOWED_TERRITORY_KEYS = [
  'departmentCode',
  'municipalityCode',
  'localUnitId',
  'localityDeclaredText',
  'settlementDeclaredText',
  'areaType',
  'exactAddress',
  'directions',
] as const;

/** Territorio ya validado en forma, todavía no contrastado contra la base. */
export interface ValidatedTerritory {
  readonly departmentCode: string;
  readonly municipalityCode: string;
  /** `null` cuando se solicitó explícitamente pendiente de normalización. */
  readonly localUnitId: string | null;
  readonly localityDeclaredText: string | null;
  readonly settlementDeclaredText: string | null;
  readonly areaType: AreaTypeCode;
  readonly exactAddress: string;
  readonly directions: string | null;
}

/** Cuerpo validado y normalizado, listo para la transacción. */
export interface ValidatedEnrollment {
  readonly documentType: DocumentTypeCode;
  readonly documentNumberDeclared: string;
  readonly documentNumberNormalized: string;
  readonly givenNames: string;
  readonly familyNames: string;
  readonly birthDate: Date;
  readonly sexGenderCode: SexGenderCodeValue;
  readonly phone: string;
  readonly email: string | null;
  readonly eps: EpsCatalogEntry;
  readonly declaredPopulations: readonly DeclarablePopulationCode[];
  readonly territory: ValidatedTerritory;
  readonly password: string | null;
}

export interface ValidationSuccess {
  readonly ok: true;
  readonly value: ValidatedEnrollment;
}

export interface ValidationFailure {
  readonly ok: false;
  /** `SHAPE` produce 400; `SEMANTIC` produce 422. */
  readonly kind: 'SHAPE' | 'SEMANTIC';
  /** Nombres de campo afectados. Nunca contiene valores recibidos. */
  readonly fields: readonly string[];
}

export type ValidationResult = ValidationSuccess | ValidationFailure;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function unknownKeys(
  source: Record<string, unknown>,
  allowed: readonly string[],
  prefix: string,
): string[] {
  return Object.keys(source)
    .filter((key) => !allowed.includes(key))
    .map((key) => `${prefix}${key}`);
}

function readString(source: Record<string, unknown>, key: string): string | undefined {
  const value = source[key];
  return typeof value === 'string' ? value : undefined;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u;
// Se admiten dígitos y separadores de presentación; no se asume un plan de
// numeración nacional concreto, coherente con el formulario aprobado.
const PHONE_PATTERN = /^[\d+.\s()-]+$/u;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const DEPARTMENT_CODE_PATTERN = /^\d{2}$/u;
const MUNICIPALITY_CODE_PATTERN = /^\d{5}$/u;

function collapseSpaces(value: string): string {
  return value.trim().replace(/\s+/gu, ' ');
}

/**
 * Valida la forma del cuerpo. Un fallo de forma (`SHAPE`) significa que el
 * cuerpo no cumple el contrato y produce `400`; un fallo semántico (`SEMANTIC`)
 * significa que el contrato se cumple pero los valores no son admisibles y
 * produce `422`.
 */
export function validateEnrollmentRequest(
  body: unknown,
  referenceDate: Date,
): ValidationResult {
  if (!isPlainObject(body)) {
    return { ok: false, kind: 'SHAPE', fields: ['body'] };
  }

  const extraneous = unknownKeys(body, ALLOWED_ROOT_KEYS, '');
  if (extraneous.length > 0) {
    return { ok: false, kind: 'SHAPE', fields: extraneous };
  }

  const shapeErrors: string[] = [];
  const semanticErrors: string[] = [];

  /* ------------------------------- Documento ----------------------------- */

  const documentTypeRaw = readString(body, 'documentType');
  const documentType = DOCUMENT_TYPE_CODES.find(
    (candidate) => candidate === documentTypeRaw,
  );
  if (documentTypeRaw === undefined) {
    shapeErrors.push('documentType');
  } else if (documentType === undefined) {
    semanticErrors.push('documentType');
  }

  const documentNumberRaw = readString(body, 'documentNumber');
  if (documentNumberRaw === undefined) {
    shapeErrors.push('documentNumber');
  }

  /* -------------------------------- Nombres ------------------------------ */

  const givenNamesRaw = readString(body, 'givenNames');
  const familyNamesRaw = readString(body, 'familyNames');
  if (givenNamesRaw === undefined) {
    shapeErrors.push('givenNames');
  }
  if (familyNamesRaw === undefined) {
    shapeErrors.push('familyNames');
  }

  const givenNames = collapseSpaces(givenNamesRaw ?? '');
  const familyNames = collapseSpaces(familyNamesRaw ?? '');
  if (
    givenNamesRaw !== undefined &&
    (givenNames.length === 0 || givenNames.length > FIELD_LIMITS.name)
  ) {
    semanticErrors.push('givenNames');
  }
  if (
    familyNamesRaw !== undefined &&
    (familyNames.length === 0 || familyNames.length > FIELD_LIMITS.name)
  ) {
    semanticErrors.push('familyNames');
  }

  /* --------------------------- Fecha de nacimiento ----------------------- */

  const birthDateRaw = readString(body, 'birthDate');
  let birthDate: Date | null = null;
  if (birthDateRaw === undefined) {
    shapeErrors.push('birthDate');
  } else {
    const calendar = parseIsoCalendarDate(birthDateRaw);
    if (calendar === null) {
      semanticErrors.push('birthDate');
    } else {
      const candidate = toUtcMidnight(calendar);
      const age = deriveAgeInYears(candidate, referenceDate);
      if (age < 0 || age > MAX_PLAUSIBLE_AGE_YEARS) {
        semanticErrors.push('birthDate');
      } else {
        birthDate = candidate;
      }
    }
  }

  /* --------------------------------- Sexo -------------------------------- */

  const sexGenderRaw = readString(body, 'sexGenderCode');
  const sexGenderCode = SEX_GENDER_CODES.find((candidate) => candidate === sexGenderRaw);
  if (sexGenderRaw === undefined) {
    shapeErrors.push('sexGenderCode');
  } else if (sexGenderCode === undefined) {
    semanticErrors.push('sexGenderCode');
  }

  /* ------------------------------- Contacto ------------------------------ */

  const phoneRaw = readString(body, 'phone');
  if (phoneRaw === undefined) {
    shapeErrors.push('phone');
  }
  const phone = collapseSpaces(phoneRaw ?? '');
  if (
    phoneRaw !== undefined &&
    (phone.length === 0 ||
      phone.length > FIELD_LIMITS.phone ||
      !PHONE_PATTERN.test(phone) ||
      !/\d/u.test(phone))
  ) {
    semanticErrors.push('phone');
  }

  // El correo es opcional (decisión cerrada 18.7): `undefined`, `null` y cadena
  // vacía significan «no declarado» y no producen error.
  const emailValue = body['email'];
  let email: string | null = null;
  if (emailValue !== undefined && emailValue !== null) {
    if (typeof emailValue !== 'string') {
      shapeErrors.push('email');
    } else {
      const trimmed = emailValue.trim();
      if (trimmed.length > 0) {
        if (trimmed.length > FIELD_LIMITS.email || !EMAIL_PATTERN.test(trimmed)) {
          semanticErrors.push('email');
        } else {
          email = trimmed.toLowerCase();
        }
      }
    }
  }

  /* ---------------------------------- EPS -------------------------------- */

  const epsCodeRaw = readString(body, 'epsCode');
  const eps = epsCodeRaw === undefined ? undefined : findEpsByCode(epsCodeRaw);
  if (epsCodeRaw === undefined) {
    shapeErrors.push('epsCode');
  } else if (eps === undefined) {
    semanticErrors.push('epsCode');
  }

  /* ------------------------------- Password -------------------------------- */

  // Password es opcional (nullable) para compatibilidad con inscripciones legacy.
  // Si se proporciona, debe tener mínimo 8 caracteres, al menos una letra y un número.
  const passwordValue = body['password'];
  let password: string | null = null;
  if (passwordValue !== undefined && passwordValue !== null) {
    if (typeof passwordValue !== 'string') {
      shapeErrors.push('password');
    } else {
      const trimmed = passwordValue.trim();
      if (trimmed.length > 0) {
        if (
          trimmed.length < 8 ||
          !/[a-zA-Z]/.test(trimmed) ||
          !/\d/.test(trimmed)
        ) {
          semanticErrors.push('password');
        } else {
          password = trimmed;
        }
      }
    }
  }

  /* ------------------------------ Poblaciones ---------------------------- */

  const declaredRaw = body['declaredPopulations'];
  const declaredPopulations: DeclarablePopulationCode[] = [];
  if (!Array.isArray(declaredRaw)) {
    shapeErrors.push('declaredPopulations');
  } else {
    for (const entry of declaredRaw) {
      const match = DECLARABLE_POPULATION_CODES.find((candidate) => candidate === entry);
      if (match === undefined) {
        semanticErrors.push('declaredPopulations');
        break;
      }
      if (!declaredPopulations.includes(match)) {
        declaredPopulations.push(match);
      }
    }
  }

  /* ----------------------------- Consentimiento -------------------------- */

  const consentAccepted = body['consentAccepted'];
  if (typeof consentAccepted !== 'boolean') {
    shapeErrors.push('consentAccepted');
  } else if (!consentAccepted) {
    semanticErrors.push('consentAccepted');
  }

  /* ------------------------------- Territorio ---------------------------- */

  const territoryRaw = body['territory'];
  let territory: ValidatedTerritory | null = null;

  if (!isPlainObject(territoryRaw)) {
    shapeErrors.push('territory');
  } else {
    const territoryExtras = unknownKeys(
      territoryRaw,
      ALLOWED_TERRITORY_KEYS,
      'territory.',
    );
    if (territoryExtras.length > 0) {
      shapeErrors.push(...territoryExtras);
    } else {
      territory = validateTerritory(territoryRaw, shapeErrors, semanticErrors);
    }
  }

  /* ------------------------------- Resultado ----------------------------- */

  if (shapeErrors.length > 0) {
    return { ok: false, kind: 'SHAPE', fields: [...new Set(shapeErrors)] };
  }

  // La normalización del documento depende del tipo: solo puede evaluarse
  // cuando el tipo ya resultó válido.
  let documentNumberDeclared = '';
  let documentNumberNormalized = '';
  if (documentType !== undefined && documentNumberRaw !== undefined) {
    const normalization = normalizeDocumentNumber(documentType, documentNumberRaw);
    if (!normalization.ok) {
      semanticErrors.push('documentNumber');
    } else {
      documentNumberDeclared = normalization.declared;
      documentNumberNormalized = normalization.normalized;
    }
  }

  if (semanticErrors.length > 0) {
    return { ok: false, kind: 'SEMANTIC', fields: [...new Set(semanticErrors)] };
  }

  /* istanbul ignore next -- defensa: las ramas anteriores ya garantizan estos valores */
  if (
    documentType === undefined ||
    sexGenderCode === undefined ||
    eps === undefined ||
    birthDate === null ||
    territory === null
  ) {
    return { ok: false, kind: 'SHAPE', fields: ['body'] };
  }

  return {
    ok: true,
    value: {
      documentType,
      documentNumberDeclared,
      documentNumberNormalized,
      givenNames,
      familyNames,
      birthDate,
      sexGenderCode,
      phone,
      email,
      eps,
      declaredPopulations,
      territory,
      password,
    },
  };
}

function validateTerritory(
  source: Record<string, unknown>,
  shapeErrors: string[],
  semanticErrors: string[],
): ValidatedTerritory | null {
  const departmentCode = readString(source, 'departmentCode');
  const municipalityCode = readString(source, 'municipalityCode');
  const localUnitIdRaw = readString(source, 'localUnitId');
  const exactAddressRaw = readString(source, 'exactAddress');

  if (departmentCode === undefined) {
    shapeErrors.push('territory.departmentCode');
  } else if (!DEPARTMENT_CODE_PATTERN.test(departmentCode)) {
    semanticErrors.push('territory.departmentCode');
  }

  if (municipalityCode === undefined) {
    shapeErrors.push('territory.municipalityCode');
  } else if (!MUNICIPALITY_CODE_PATTERN.test(municipalityCode)) {
    semanticErrors.push('territory.municipalityCode');
  }

  // Coherencia jerárquica de la fuente territorial verificable: los dos primeros
  // dígitos del municipio son su departamento.
  if (
    departmentCode !== undefined &&
    municipalityCode !== undefined &&
    DEPARTMENT_CODE_PATTERN.test(departmentCode) &&
    MUNICIPALITY_CODE_PATTERN.test(municipalityCode) &&
    municipalityCode.slice(0, 2) !== departmentCode
  ) {
    semanticErrors.push('territory.municipalityCode');
  }

  if (localUnitIdRaw === undefined) {
    shapeErrors.push('territory.localUnitId');
  }

  const pendingNormalization = localUnitIdRaw === LOCAL_UNIT_PENDING_NORMALIZATION;
  if (
    localUnitIdRaw !== undefined &&
    !pendingNormalization &&
    !UUID_PATTERN.test(localUnitIdRaw)
  ) {
    semanticErrors.push('territory.localUnitId');
  }

  const localityDeclaredRaw = readString(source, 'localityDeclaredText');
  const localityDeclaredText = collapseSpaces(localityDeclaredRaw ?? '');
  if (localityDeclaredText.length > FIELD_LIMITS.localityText) {
    semanticErrors.push('territory.localityDeclaredText');
  }
  // El texto declarado es obligatorio cuando no hay unidad canónica: sin él, la
  // localidad quedaría indeterminada.
  if (pendingNormalization && localityDeclaredText.length === 0) {
    semanticErrors.push('territory.localityDeclaredText');
  }

  const settlementDeclaredRaw = readString(source, 'settlementDeclaredText');
  const settlementDeclaredText = collapseSpaces(settlementDeclaredRaw ?? '');
  if (settlementDeclaredText.length > FIELD_LIMITS.settlementText) {
    semanticErrors.push('territory.settlementDeclaredText');
  }

  // Área urbana o rural: obligatoria y declarada. Su ausencia es un fallo de
  // forma; un valor fuera del catálogo, un fallo semántico.
  const areaTypeRaw = readString(source, 'areaType');
  let areaType: AreaTypeCode | null = null;
  if (areaTypeRaw === undefined) {
    shapeErrors.push('territory.areaType');
  } else {
    const match = AREA_TYPE_CODES.find((candidate) => candidate === areaTypeRaw);
    if (match === undefined) {
      semanticErrors.push('territory.areaType');
    } else {
      areaType = match;
    }
  }

  if (exactAddressRaw === undefined) {
    shapeErrors.push('territory.exactAddress');
  }
  const exactAddress = collapseSpaces(exactAddressRaw ?? '');
  if (
    exactAddressRaw !== undefined &&
    (exactAddress.length === 0 || exactAddress.length > FIELD_LIMITS.exactAddress)
  ) {
    semanticErrors.push('territory.exactAddress');
  }

  const directionsRaw = readString(source, 'directions');
  const directions = collapseSpaces(directionsRaw ?? '');
  if (directions.length > FIELD_LIMITS.directions) {
    semanticErrors.push('territory.directions');
  }

  if (
    departmentCode === undefined ||
    municipalityCode === undefined ||
    localUnitIdRaw === undefined ||
    exactAddressRaw === undefined ||
    areaType === null
  ) {
    return null;
  }

  return {
    departmentCode,
    municipalityCode,
    localUnitId: pendingNormalization ? null : localUnitIdRaw,
    localityDeclaredText: localityDeclaredText.length === 0 ? null : localityDeclaredText,
    settlementDeclaredText:
      settlementDeclaredText.length === 0 ? null : settlementDeclaredText,
    areaType,
    exactAddress,
    directions: directions.length === 0 ? null : directions,
  };
}

/** Reexportado para las pruebas de límites de longitud del documento. */
export { DOCUMENT_NUMBER_MAX_LENGTH };
