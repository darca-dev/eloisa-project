import { type SuppressedCount } from './suppression';

/**
 * Contrato de los agregados municipales
 * (TASK-MUNICIPALITY-CORE-01, sección «API and DTO Contract»).
 *
 * Los tipos se declaran aquí y NO se derivan de Prisma: la respuesta municipal
 * es un contrato propio, no un reflejo del almacenamiento.
 *
 * Datos PROHIBIDOS en cualquier punto de este contrato, de sus errores y de sus
 * registros: nombre, documento, teléfono, correo, `patientId`, `personId`,
 * fecha de nacimiento, edad individual, dirección exacta, indicaciones, texto
 * libre de localidad o corregimiento, historia clínica, diagnóstico,
 * consentimiento y EPS individual. Tampoco hay listado ni drill-down nominativo.
 */

/**
 * Procedencia declarada de los agregados.
 *
 * Identifica que la cifra proviene de los registros persistidos de la propia
 * plataforma. NO es una estadística oficial municipal, departamental ni
 * nacional, y no afirma ninguna consulta a una fuente externa.
 */
export const MUNICIPALITY_AGGREGATE_SOURCE = 'ELOISA_POSTGRESQL';

export type MunicipalityAggregateSource = typeof MUNICIPALITY_AGGREGATE_SOURCE;

/** Códigos de error del contrato municipal. */
export const MUNICIPALITY_ERROR_CODES = {
  internal: 'MUNICIPALITY_SERVICE_UNAVAILABLE',
} as const;

/** Las siete combinaciones EXCLUSIVAS de las tres pertenencias. */
export const EXCLUSIVE_INTERSECTION_KEYS = [
  'olderOnly',
  'disabilityOnly',
  'homeCareOnly',
  'olderAndDisabilityOnly',
  'olderAndHomeCareOnly',
  'disabilityAndHomeCareOnly',
  'allThree',
] as const;

export type ExclusiveIntersectionKey = (typeof EXCLUSIVE_INTERSECTION_KEYS)[number];

export type ExclusiveIntersections = {
  readonly [K in ExclusiveIntersectionKey]: SuppressedCount;
};

export interface PopulationCounts {
  readonly olderAdult60Plus: SuppressedCount;
  readonly disabilityDeclared: SuppressedCount;
  readonly homeCareRequiredDeclared: SuppressedCount;
}

/**
 * Métricas que exigirían una fuente oficial externa con periodo, versión,
 * propietario y linaje. CORE-01 no las contiene y esta Task no las conecta.
 */
export const OFFICIAL_METRIC_KEYS = [
  'municipalTotalPopulation',
  'officialTargetPopulation',
  'disabilityNationalRegistry',
  'coverageOverTargetPopulation',
] as const;

export type OfficialMetricKey = (typeof OFFICIAL_METRIC_KEYS)[number];

/**
 * Estado de una métrica oficial.
 *
 * `UNAVAILABLE` significa exactamente que MERDN no dispone de la fuente. No es
 * un cero, no es una estimación y nunca se sustituye por un dato de ejemplo.
 */
export interface OfficialMetric {
  readonly metric: OfficialMetricKey;
  readonly status: 'UNAVAILABLE';
  readonly value: null;
}

export interface PopulationQuality {
  /**
   * Personas registradas cuya localidad declarada todavía no corresponde a una
   * unidad territorial canónica. Es una métrica ADMINISTRATIVA del registro, no
   * una valoración de salud ni de necesidad.
   */
  readonly territoryPendingNormalization: SuppressedCount;
}

export interface PopulationSummary {
  readonly source: MunicipalityAggregateSource;
  /** Fecha de corte, en UTC, con la que se derivó la edad cumplida. */
  readonly asOfDate: string;
  readonly generatedAt: string;
  readonly uniqueRegistered: SuppressedCount;
  readonly populations: PopulationCounts;
  readonly exclusiveIntersections: ExclusiveIntersections;
  readonly officialMetrics: readonly OfficialMetric[];
  readonly quality: PopulationQuality;
}

/* -------------------------------------------------------------------------- */
/* Territorio                                                                  */
/* -------------------------------------------------------------------------- */

export type AreaTypeCode = 'URBAN' | 'RURAL';

/**
 * Naturaleza de un nodo local.
 *
 * `CANONICAL` es una unidad del catálogo territorial administrado por la
 * institución. `PENDING_NORMALIZATION` agrupa los registros cuya localidad
 * declarada no corresponde todavía a ninguna unidad canónica: su texto libre
 * NUNCA se devuelve y no se convierte en territorio oficial.
 */
export type LocalUnitKind = 'CANONICAL' | 'PENDING_NORMALIZATION';

/** Conteos publicados de un nodo territorial. */
export interface TerritoryMetrics {
  readonly uniquePeople: SuppressedCount;
  readonly olderAdult60Plus: SuppressedCount;
  readonly disabilityDeclared: SuppressedCount;
  readonly homeCareRequiredDeclared: SuppressedCount;
  readonly pendingNormalization: SuppressedCount;
}

export interface TerritoryLocalUnitNode {
  /** Identificador OPACO de la unidad canónica; `null` en los pendientes. */
  readonly localUnitId: string | null;
  readonly kind: LocalUnitKind;
  /** Nombre normalizado de exhibición. Nunca es texto declarado sin verificar. */
  readonly displayName: string;
  readonly metrics: TerritoryMetrics;
}

export interface TerritoryAreaNode {
  readonly areaType: AreaTypeCode;
  readonly metrics: TerritoryMetrics;
  readonly localUnits: readonly TerritoryLocalUnitNode[];
}

export interface TerritoryMunicipalityNode {
  /** Código oficial del municipio cuando el catálogo lo aporta. */
  readonly officialCode: string | null;
  readonly displayName: string;
  readonly metrics: TerritoryMetrics;
  readonly areas: readonly TerritoryAreaNode[];
}

export interface TerritorySummary {
  readonly source: MunicipalityAggregateSource;
  readonly asOfDate: string;
  readonly generatedAt: string;
  readonly municipalities: readonly TerritoryMunicipalityNode[];
}

/** Fecha de corte `AAAA-MM-DD` en UTC. La edad no depende de la zona horaria. */
export function toAsOfDate(instant: Date): string {
  return instant.toISOString().slice(0, 10);
}
