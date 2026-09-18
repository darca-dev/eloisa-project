import {
  HOSPITAL_AFFILIATION_STATUSES,
  HOSPITAL_AGENDA_MAX_WINDOW_DAYS,
  HOSPITAL_ENGAGEMENT_TYPES,
  HOSPITAL_PROFESSION_CODES,
  HOSPITAL_PROFESSIONAL_DEFAULT_PAGE_SIZE,
  HOSPITAL_PROFESSIONAL_DETAIL_QUERY_PARAMETERS,
  HOSPITAL_PROFESSIONAL_PAGE_SIZES,
  HOSPITAL_PROFESSIONAL_QUERY_PARAMETERS,
  HOSPITAL_PROFESSIONAL_SEARCH_MAX_LENGTH,
  HOSPITAL_PROFESSIONAL_SORT_FIELDS,
  HOSPITAL_PROFESSIONAL_STATUSES,
  HOSPITAL_SORT_DIRECTIONS,
  inclusiveDaySpan,
  toUtcDate,
  type HospitalAffiliationStatus,
  type HospitalAgendaWindow,
  type HospitalEngagementType,
  type HospitalProfessionalPageSize,
  type HospitalProfessionalSortField,
  type HospitalProfessionalStatus,
  type HospitalSortDirection,
} from './hospital.contract';

/**
 * Análisis y normalización de la consulta de operaciones hospitalarias
 * (TASK-HOSPITAL-CORE-02 §6.1 y §6.2).
 *
 * Son funciones PURAS y por eso se prueban sin base de datos, sin NestJS y sin
 * red. El contrato es estricto por diseño, con las mismas reglas que ya aplica
 * la superficie de Pacientes:
 *
 * - ALLOWLIST CERRADA: un parámetro cuyo nombre no está en la lista produce
 *   `400`. No se ignora en silencio, porque ignorar un filtro que la persona
 *   creyó aplicar devolvería MÁS registros de los esperados;
 * - un parámetro REPETIDO produce `400`: Express lo entrega como arreglo y
 *   elegir uno de los dos valores sería una decisión inventada;
 * - un valor mal formado o fuera de rango produce `400`, nunca un recorte
 *   silencioso;
 * - `tenantId`, `identityId`, `personId`, actor y rol están PROHIBIDOS por
 *   construcción: no figuran en la allowlist y por tanto son `400`.
 *
 * Este módulo concentra ADEMÁS los primitivos compartidos con la agenda —el
 * error de validación, la lectura de un valor único y la ventana de fechas—
 * para que la regla de allowlist viva en un solo sitio y no se duplique entre
 * las tres rutas de la superficie.
 */

/** Error de validación de la consulta. Nombra el parámetro, nunca su valor. */
export class HospitalOperationsQueryError extends Error {
  public readonly parameter: string;

  constructor(parameter: string, reason: string) {
    super(`El parámetro «${parameter}» ${reason}.`);
    this.name = 'HospitalOperationsQueryError';
    this.parameter = parameter;
  }
}

/** Consulta cruda tal como la entrega Express, sin ninguna confianza. */
export type RawOperationsQuery = Readonly<Record<string, unknown>>;

/**
 * Valor único de un parámetro.
 *
 * Un arreglo significa que el parámetro llegó repetido: se rechaza. Un objeto
 * significa que llegó con sintaxis de objeto anidado (`?a[b]=c`): también se
 * rechaza, porque no forma parte del contrato.
 */
export function singleValue(raw: RawOperationsQuery, name: string): string | undefined {
  const value = raw[name];

  if (value === undefined) {
    return undefined;
  }

  if (Array.isArray(value)) {
    throw new HospitalOperationsQueryError(name, 'no admite valores repetidos');
  }

  if (typeof value !== 'string') {
    throw new HospitalOperationsQueryError(name, 'debe ser un valor simple');
  }

  const trimmed = value.trim();

  return trimmed.length === 0 ? undefined : trimmed;
}

/** Entero estricto: sin signo, sin decimales, sin notación científica. */
export function parseInteger(
  raw: RawOperationsQuery,
  name: string,
): number | undefined {
  const value = singleValue(raw, name);

  if (value === undefined) {
    return undefined;
  }

  if (!/^\d{1,9}$/u.test(value)) {
    throw new HospitalOperationsQueryError(
      name,
      'debe ser un número entero no negativo',
    );
  }

  return Number.parseInt(value, 10);
}

/** Valor perteneciente a una lista cerrada. Cualquier otro es `400`. */
export function parseEnum<T extends string>(
  raw: RawOperationsQuery,
  name: string,
  admitidos: readonly T[],
): T | undefined {
  const value = singleValue(raw, name);

  if (value === undefined) {
    return undefined;
  }

  const match = admitidos.find((candidate) => candidate === value);

  if (match === undefined) {
    throw new HospitalOperationsQueryError(
      name,
      `debe ser uno de: ${admitidos.join(', ')}`,
    );
  }

  return match;
}

/** Rechaza cualquier parámetro fuera de la allowlist efectiva. */
export function assertAllowlist(
  raw: RawOperationsQuery,
  admitidos: readonly string[],
): void {
  for (const name of Object.keys(raw)) {
    if (!admitidos.includes(name)) {
      throw new HospitalOperationsQueryError(name, 'no está admitido en esta consulta');
    }
  }
}

/**
 * Fecha `AAAA-MM-DD` estricta y REAL.
 *
 * No basta con la forma: `2026-02-31` tiene forma válida y no existe. Se
 * comprueba que la fecha reconstruida en UTC coincida con la recibida, de modo
 * que una fecha inexistente produzca `400` en lugar de desplazarse en silencio
 * al mes siguiente.
 */
function parseCalendarDate(raw: RawOperationsQuery, name: string): string | undefined {
  const value = singleValue(raw, name);

  if (value === undefined) {
    return undefined;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) {
    throw new HospitalOperationsQueryError(
      name,
      'debe tener la forma AAAA-MM-DD',
    );
  }

  const instante = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(instante.getTime()) || toUtcDate(instante) !== value) {
    throw new HospitalOperationsQueryError(name, 'no es una fecha real del calendario');
  }

  return value;
}

/**
 * Ventana de agenda `from`/`to`, inclusiva y acotada.
 *
 * `obligatoria` distingue las dos rutas del contrato: la agenda EXIGE las dos
 * fechas (§6.2) y el detalle profesional las admite de forma opcional (§6.1),
 * con el día actual del SERVIDOR por defecto. La fecha por defecto nunca la
 * aporta el navegador: dejarla en manos del cliente permitiría que el reloj del
 * dispositivo decidiera qué registros se leen.
 */
export function parseWindow(
  raw: RawOperationsQuery,
  now: Date,
  obligatoria: boolean,
): HospitalAgendaWindow {
  const from = parseCalendarDate(raw, 'from');
  const to = parseCalendarDate(raw, 'to');

  if (obligatoria && (from === undefined || to === undefined)) {
    throw new HospitalOperationsQueryError(
      from === undefined ? 'from' : 'to',
      'es obligatorio en esta consulta',
    );
  }

  if (from === undefined && to !== undefined) {
    throw new HospitalOperationsQueryError('from', 'es obligatorio cuando se envía «to»');
  }

  if (from !== undefined && to === undefined) {
    throw new HospitalOperationsQueryError('to', 'es obligatorio cuando se envía «from»');
  }

  const hoy = toUtcDate(now);
  const ventana: HospitalAgendaWindow = {
    from: from ?? hoy,
    to: to ?? hoy,
  };

  if (ventana.from > ventana.to) {
    throw new HospitalOperationsQueryError('from', 'no puede ser posterior a «to»');
  }

  if (inclusiveDaySpan(ventana.from, ventana.to) > HOSPITAL_AGENDA_MAX_WINDOW_DAYS) {
    throw new HospitalOperationsQueryError(
      'to',
      `no puede abarcar más de ${HOSPITAL_AGENDA_MAX_WINDOW_DAYS} días desde «from»`,
    );
  }

  return ventana;
}

/* -------------------------------------------------------------------------- */
/* Directorio de profesionales                                                 */
/* -------------------------------------------------------------------------- */

/** Término de búsqueda normalizado del directorio. */
export interface HospitalProfessionalSearchTerm {
  readonly raw: string;
  /** Palabras del término. TODAS deben coincidir en el nombre. */
  readonly tokens: readonly string[];
}

export interface HospitalProfessionalsFilters {
  readonly search: HospitalProfessionalSearchTerm | null;
  readonly professionCode: string | null;
  readonly affiliationType: HospitalEngagementType | null;
  readonly status: HospitalProfessionalStatus | null;
}

export interface HospitalProfessionalsListQuery {
  readonly page: number;
  readonly pageSize: HospitalProfessionalPageSize;
  readonly sort: HospitalProfessionalSortField;
  readonly direction: HospitalSortDirection;
  readonly filters: HospitalProfessionalsFilters;
}

/**
 * Normaliza el término de búsqueda del directorio.
 *
 * Busca EXCLUSIVAMENTE por nombre. No busca por documento: agendar no requiere
 * conocerlo y permitir buscar por él convertiría el directorio en una vía de
 * comprobación de documentos. El término NUNCA se registra.
 */
export function normalizeProfessionalSearch(
  value: string,
): HospitalProfessionalSearchTerm | null {
  const colapsado = value.replace(/\s+/gu, ' ').trim();

  if (colapsado.length === 0) {
    return null;
  }

  return {
    raw: colapsado,
    tokens: colapsado
      .toLocaleLowerCase('es-CO')
      .split(' ')
      .filter((token) => token.length > 0),
  };
}

/** Consulta del directorio paginado de profesionales. */
export function parseProfessionalsListQuery(
  raw: RawOperationsQuery,
): HospitalProfessionalsListQuery {
  assertAllowlist(raw, HOSPITAL_PROFESSIONAL_QUERY_PARAMETERS);

  const page = parseInteger(raw, 'page');

  if (page !== undefined && page < 1) {
    throw new HospitalOperationsQueryError('page', 'debe ser mayor o igual que 1');
  }

  const pageSizeRaw = parseInteger(raw, 'pageSize');
  const pageSize = HOSPITAL_PROFESSIONAL_PAGE_SIZES.find((size) => size === pageSizeRaw);

  if (pageSizeRaw !== undefined && pageSize === undefined) {
    throw new HospitalOperationsQueryError(
      'pageSize',
      `debe ser uno de: ${HOSPITAL_PROFESSIONAL_PAGE_SIZES.join(', ')}`,
    );
  }

  const searchRaw = singleValue(raw, 'search');

  if (
    searchRaw !== undefined &&
    searchRaw.length > HOSPITAL_PROFESSIONAL_SEARCH_MAX_LENGTH
  ) {
    throw new HospitalOperationsQueryError(
      'search',
      `no puede superar ${HOSPITAL_PROFESSIONAL_SEARCH_MAX_LENGTH} caracteres`,
    );
  }

  const professionCode = singleValue(raw, 'professionCode');

  if (professionCode !== undefined && !HOSPITAL_PROFESSION_CODES.includes(professionCode)) {
    // Se valida contra el catálogo controlado del servidor: el cliente no puede
    // introducir un código arbitrario ni descubrir cuáles existen probando.
    throw new HospitalOperationsQueryError(
      'professionCode',
      'no pertenece al catálogo controlado',
    );
  }

  return {
    page: page ?? 1,
    pageSize: pageSize ?? HOSPITAL_PROFESSIONAL_DEFAULT_PAGE_SIZE,
    sort: parseEnum(raw, 'sort', HOSPITAL_PROFESSIONAL_SORT_FIELDS) ?? 'name',
    direction: parseEnum(raw, 'direction', HOSPITAL_SORT_DIRECTIONS) ?? 'asc',
    filters: {
      search: searchRaw === undefined ? null : normalizeProfessionalSearch(searchRaw),
      professionCode: professionCode ?? null,
      affiliationType: parseEnum(raw, 'affiliationType', HOSPITAL_ENGAGEMENT_TYPES) ?? null,
      status: parseEnum(raw, 'status', HOSPITAL_PROFESSIONAL_STATUSES) ?? null,
    },
  };
}

/** Consulta del detalle profesional: solo la ventana opcional de agenda. */
export function parseProfessionalDetailQuery(
  raw: RawOperationsQuery,
  now: Date,
): HospitalAgendaWindow {
  assertAllowlist(raw, HOSPITAL_PROFESSIONAL_DETAIL_QUERY_PARAMETERS);

  return parseWindow(raw, now, false);
}

/**
 * Estados de afiliación que la superficie considera VIGENTES.
 *
 * Solo `ACTIVE`. `INACTIVE` y `ENDED` existen en el modelo para conservar
 * historia, y publicarlos como vínculo vigente afirmaría una relación que ya no
 * está declarada.
 */
export const HOSPITAL_ACTIVE_AFFILIATION_STATUS: HospitalAffiliationStatus = 'ACTIVE';

/** Lista completa de estados de afiliación, para documentación del contrato. */
export const HOSPITAL_AFFILIATION_STATUS_VALUES = HOSPITAL_AFFILIATION_STATUSES;
