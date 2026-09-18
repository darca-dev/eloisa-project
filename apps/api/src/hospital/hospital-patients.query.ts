import { findEpsByCode } from '../patients/enrollment.catalogs';

import {
  HOSPITAL_ANALYTICS_EXCLUDED_PARAMETERS,
  HOSPITAL_AREA_TYPES,
  HOSPITAL_DEFAULT_PAGE_SIZE,
  HOSPITAL_MAX_AGE,
  HOSPITAL_MIN_AGE,
  HOSPITAL_PAGE_SIZES,
  HOSPITAL_PATIENT_STATUSES,
  HOSPITAL_POPULATION_FILTERS,
  HOSPITAL_QUERY_PARAMETERS,
  HOSPITAL_SEARCH_MAX_LENGTH,
  HOSPITAL_SORT_DIRECTIONS,
  HOSPITAL_SORT_FIELDS,
  type HospitalAreaType,
  type HospitalPageSize,
  type HospitalPatientStatus,
  type HospitalPopulationFilter,
  type HospitalSortDirection,
  type HospitalSortField,
} from './hospital.contract';

/**
 * Análisis y normalización de la consulta hospitalaria
 * (TASK-HOSPITAL-CORE-01 §8.1 y §12.1).
 *
 * Es una función PURA y por eso se prueba sin base de datos, sin NestJS y sin
 * red. Su contrato es estricto por diseño:
 *
 * - ALLOWLIST CERRADA: un parámetro cuyo nombre no está en la lista produce
 *   `400`. No se ignora en silencio, porque ignorar un filtro que la persona
 *   creyó aplicar devolvería MÁS registros de los esperados;
 * - un parámetro REPETIDO produce `400`: Express lo entrega como arreglo y
 *   elegir uno de los dos valores sería una decisión inventada;
 * - un valor mal formado o fuera de rango produce `400`, nunca un recorte
 *   silencioso;
 * - `tenantId`, `personId`, cualquier filtro clínico, cualquier selección de
 *   columnas y cualquier fragmento SQL están PROHIBIDOS por construcción: no
 *   figuran en la allowlist y por tanto son `400`.
 *
 * El resultado normalizado es lo ÚNICO que llega a la capa de datos. Ningún
 * valor del cliente se interpola en SQL: la consulta se construye con Prisma y
 * queda además acotada por `withTenant()` y por Row Level Security.
 */

/** Error de validación de la consulta. Nombra el parámetro, nunca su valor. */
export class HospitalQueryError extends Error {
  public readonly parameter: string;

  constructor(parameter: string, reason: string) {
    super(`El parámetro «${parameter}» ${reason}.`);
    this.name = 'HospitalQueryError';
    this.parameter = parameter;
  }
}

/** Término de búsqueda ya normalizado y descompuesto. */
export interface HospitalSearchTerm {
  /** Término completo, recortado y con espacios colapsados. */
  readonly raw: string;
  /** Palabras del término. Todas deben coincidir en el nombre. */
  readonly tokens: readonly string[];
  /**
   * Forma documental del término: solo caracteres alfanuméricos en mayúsculas.
   * Cadena vacía cuando el término no contiene ninguno.
   */
  readonly documentForm: string;
}

/** Filtros normalizados, comunes al listado y a la analítica. */
export interface HospitalPatientsFilters {
  readonly search: HospitalSearchTerm | null;
  readonly ageMin: number | null;
  readonly ageMax: number | null;
  readonly epsCode: string | null;
  readonly populationType: HospitalPopulationFilter | null;
  readonly older60: boolean | null;
  readonly municipalityOfficialCode: string | null;
  readonly areaType: HospitalAreaType | null;
  readonly patientStatus: HospitalPatientStatus;
}

export interface HospitalPatientsListQuery {
  readonly page: number;
  readonly pageSize: HospitalPageSize;
  readonly sort: HospitalSortField;
  readonly direction: HospitalSortDirection;
  readonly filters: HospitalPatientsFilters;
}

/** Consulta cruda tal como la entrega Express, sin ninguna confianza. */
export type RawQuery = Readonly<Record<string, unknown>>;

/**
 * Valor único de un parámetro.
 *
 * Un arreglo significa que el parámetro llegó repetido: se rechaza. Un objeto
 * significa que llegó con sintaxis de objeto anidado (`?a[b]=c`): también se
 * rechaza, porque no forma parte del contrato.
 */
function singleValue(raw: RawQuery, name: string): string | undefined {
  const value = raw[name];

  if (value === undefined) {
    return undefined;
  }

  if (Array.isArray(value)) {
    throw new HospitalQueryError(name, 'no admite valores repetidos');
  }

  if (typeof value !== 'string') {
    throw new HospitalQueryError(name, 'debe ser un valor simple');
  }

  const trimmed = value.trim();

  return trimmed.length === 0 ? undefined : trimmed;
}

/** Entero estricto: sin signo, sin decimales, sin notación científica. */
function parseInteger(raw: RawQuery, name: string): number | undefined {
  const value = singleValue(raw, name);

  if (value === undefined) {
    return undefined;
  }

  if (!/^\d{1,9}$/u.test(value)) {
    throw new HospitalQueryError(name, 'debe ser un número entero no negativo');
  }

  return Number.parseInt(value, 10);
}

function parseEnum<T extends string>(
  raw: RawQuery,
  name: string,
  admitidos: readonly T[],
): T | undefined {
  const value = singleValue(raw, name);

  if (value === undefined) {
    return undefined;
  }

  const match = admitidos.find((candidate) => candidate === value);

  if (match === undefined) {
    throw new HospitalQueryError(
      name,
      `debe ser uno de: ${admitidos.join(', ')}`,
    );
  }

  return match;
}

function parseBoolean(raw: RawQuery, name: string): boolean | undefined {
  const value = singleValue(raw, name);

  if (value === undefined) {
    return undefined;
  }

  if (value !== 'true' && value !== 'false') {
    throw new HospitalQueryError(name, 'debe ser «true» o «false»');
  }

  return value === 'true';
}

/**
 * Normaliza el término de búsqueda.
 *
 * La normalización es DETERMINISTA y se documenta en el contrato: se recorta, se
 * colapsan los espacios y se pasa a minúsculas para el nombre; para el documento
 * se conservan solo caracteres alfanuméricos en mayúsculas, que es exactamente
 * la forma con la que CORE-01 guarda `documentNumberNormalized`.
 *
 * El término NUNCA se registra en logs, en telemetría ni en auditoría.
 */
export function normalizeSearchTerm(value: string): HospitalSearchTerm | null {
  const colapsado = value.replace(/\s+/gu, ' ').trim();

  if (colapsado.length === 0) {
    return null;
  }

  const tokens = colapsado
    .toLocaleLowerCase('es-CO')
    .split(' ')
    .filter((token) => token.length > 0);

  return {
    raw: colapsado,
    tokens,
    documentForm: colapsado.replace(/[^0-9a-zA-Z]/gu, '').toLocaleUpperCase('es-CO'),
  };
}

/** Rechaza cualquier parámetro fuera de la allowlist efectiva. */
function assertAllowlist(raw: RawQuery, admitidos: readonly string[]): void {
  for (const name of Object.keys(raw)) {
    if (!admitidos.includes(name)) {
      throw new HospitalQueryError(name, 'no está admitido en esta consulta');
    }
  }
}

/** Filtros comunes al listado y a la analítica. */
function parseFilters(raw: RawQuery): HospitalPatientsFilters {
  const searchRaw = singleValue(raw, 'search');

  if (searchRaw !== undefined && searchRaw.length > HOSPITAL_SEARCH_MAX_LENGTH) {
    throw new HospitalQueryError(
      'search',
      `no puede superar ${HOSPITAL_SEARCH_MAX_LENGTH} caracteres`,
    );
  }

  const ageMin = parseInteger(raw, 'ageMin');
  const ageMax = parseInteger(raw, 'ageMax');

  for (const [name, value] of [
    ['ageMin', ageMin],
    ['ageMax', ageMax],
  ] as const) {
    if (value !== undefined && (value < HOSPITAL_MIN_AGE || value > HOSPITAL_MAX_AGE)) {
      throw new HospitalQueryError(
        name,
        `debe estar entre ${HOSPITAL_MIN_AGE} y ${HOSPITAL_MAX_AGE}`,
      );
    }
  }

  if (ageMin !== undefined && ageMax !== undefined && ageMin > ageMax) {
    throw new HospitalQueryError('ageMin', 'no puede ser mayor que «ageMax»');
  }

  const epsCode = singleValue(raw, 'epsCode');

  if (epsCode !== undefined && findEpsByCode(epsCode) === undefined) {
    // Se valida contra el catálogo controlado del servidor: el cliente no puede
    // introducir un código arbitrario ni descubrir cuáles existen probando.
    throw new HospitalQueryError('epsCode', 'no pertenece al catálogo controlado');
  }

  const municipalityOfficialCode = singleValue(raw, 'municipalityOfficialCode');

  if (
    municipalityOfficialCode !== undefined &&
    !/^\d{5}$/u.test(municipalityOfficialCode)
  ) {
    throw new HospitalQueryError(
      'municipalityOfficialCode',
      'debe ser un código oficial de municipio de cinco dígitos',
    );
  }

  return {
    search: searchRaw === undefined ? null : normalizeSearchTerm(searchRaw),
    ageMin: ageMin ?? null,
    ageMax: ageMax ?? null,
    epsCode: epsCode ?? null,
    populationType:
      parseEnum(raw, 'populationType', HOSPITAL_POPULATION_FILTERS) ?? null,
    older60: parseBoolean(raw, 'older60') ?? null,
    municipalityOfficialCode: municipalityOfficialCode ?? null,
    areaType: parseEnum(raw, 'areaType', HOSPITAL_AREA_TYPES) ?? null,
    /*
     * CORE-01 solo modela pacientes activos. El parámetro existe para que el
     * contrato no cambie cuando se aprueben más estados, y su valor por defecto
     * describe exactamente lo que la vista muestra.
     */
    patientStatus: parseEnum(raw, 'patientStatus', HOSPITAL_PATIENT_STATUSES) ?? 'ACTIVE',
  };
}

/** Consulta del listado paginado. */
export function parseListQuery(raw: RawQuery): HospitalPatientsListQuery {
  assertAllowlist(raw, HOSPITAL_QUERY_PARAMETERS);

  const page = parseInteger(raw, 'page');

  if (page !== undefined && page < 1) {
    throw new HospitalQueryError('page', 'debe ser mayor o igual que 1');
  }

  const pageSizeRaw = parseInteger(raw, 'pageSize');
  const pageSize = HOSPITAL_PAGE_SIZES.find((size) => size === pageSizeRaw);

  if (pageSizeRaw !== undefined && pageSize === undefined) {
    throw new HospitalQueryError(
      'pageSize',
      `debe ser uno de: ${HOSPITAL_PAGE_SIZES.join(', ')}`,
    );
  }

  return {
    page: page ?? 1,
    pageSize: pageSize ?? HOSPITAL_DEFAULT_PAGE_SIZE,
    sort: parseEnum(raw, 'sort', HOSPITAL_SORT_FIELDS) ?? 'name',
    direction: parseEnum(raw, 'direction', HOSPITAL_SORT_DIRECTIONS) ?? 'asc',
    filters: parseFilters(raw),
  };
}

/**
 * Consulta de la analítica.
 *
 * Acepta la MISMA allowlist de filtros y rechaza paginación y orden: la
 * analítica describe el conjunto filtrado completo, no una página.
 */
export function parseAnalyticsQuery(raw: RawQuery): HospitalPatientsFilters {
  const admitidos = HOSPITAL_QUERY_PARAMETERS.filter(
    (name) =>
      !(HOSPITAL_ANALYTICS_EXCLUDED_PARAMETERS as readonly string[]).includes(name),
  );

  assertAllowlist(raw, admitidos);

  return parseFilters(raw);
}
