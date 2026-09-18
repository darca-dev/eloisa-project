/**
 * Contrato y textos de los agregados municipales reales
 * (TASK-MUNICIPALITY-CORE-01, FR-08 a FR-12).
 *
 * Este módulo es la frontera de tipos entre Alcaldía y la API. Replica el
 * contrato del servidor sin importar Prisma ni acoplar el frontend a la
 * persistencia, y NO contiene ningún dato: las cifras llegan siempre de la API.
 *
 * Los textos viven aquí, y no en `municipalityConfig.ts`, porque describen la
 * fuente REAL y sus estados. Los fixtures de diseño se conservan intactos para
 * el resto de la experiencia y ya no alimentan estas dos vistas.
 */

/** Conteo publicado por el servidor, ya protegido contra grupos pequeños. */
export interface SuppressedCount {
  readonly status: 'EXACT' | 'SUPPRESSED';
  readonly value: number | null;
  readonly display: string;
}

export interface PopulationCounts {
  readonly olderAdult60Plus: SuppressedCount;
  readonly disabilityDeclared: SuppressedCount;
  readonly homeCareRequiredDeclared: SuppressedCount;
}

export const CLAVES_INTERSECCION = [
  'olderOnly',
  'disabilityOnly',
  'homeCareOnly',
  'olderAndDisabilityOnly',
  'olderAndHomeCareOnly',
  'disabilityAndHomeCareOnly',
  'allThree',
] as const;

export type ClaveInterseccion = (typeof CLAVES_INTERSECCION)[number];

export type ExclusiveIntersections = {
  readonly [K in ClaveInterseccion]: SuppressedCount;
};

export const CLAVES_METRICA_OFICIAL = [
  'municipalTotalPopulation',
  'officialTargetPopulation',
  'disabilityNationalRegistry',
  'coverageOverTargetPopulation',
] as const;

export type ClaveMetricaOficial = (typeof CLAVES_METRICA_OFICIAL)[number];

export interface OfficialMetric {
  readonly metric: ClaveMetricaOficial;
  readonly status: 'UNAVAILABLE';
  readonly value: null;
}

export interface PopulationSummary {
  readonly source: string;
  readonly asOfDate: string;
  readonly generatedAt: string;
  readonly uniqueRegistered: SuppressedCount;
  readonly populations: PopulationCounts;
  readonly exclusiveIntersections: ExclusiveIntersections;
  readonly officialMetrics: readonly OfficialMetric[];
  readonly quality: { readonly territoryPendingNormalization: SuppressedCount };
}

export type AreaTypeCode = 'URBAN' | 'RURAL';

export interface TerritoryMetrics {
  readonly uniquePeople: SuppressedCount;
  readonly olderAdult60Plus: SuppressedCount;
  readonly disabilityDeclared: SuppressedCount;
  readonly homeCareRequiredDeclared: SuppressedCount;
  readonly pendingNormalization: SuppressedCount;
}

export interface TerritoryLocalUnit {
  readonly localUnitId: string | null;
  readonly kind: 'CANONICAL' | 'PENDING_NORMALIZATION';
  readonly displayName: string;
  readonly metrics: TerritoryMetrics;
}

export interface TerritoryArea {
  readonly areaType: AreaTypeCode;
  readonly metrics: TerritoryMetrics;
  readonly localUnits: readonly TerritoryLocalUnit[];
}

export interface TerritoryMunicipality {
  readonly officialCode: string | null;
  readonly displayName: string;
  readonly metrics: TerritoryMetrics;
  readonly areas: readonly TerritoryArea[];
}

export interface TerritorySummary {
  readonly source: string;
  readonly asOfDate: string;
  readonly generatedAt: string;
  readonly municipalities: readonly TerritoryMunicipality[];
}

/* -------------------------------------------------------------------------- */
/* Estados de la consulta                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Estado de una consulta municipal.
 *
 * NO existe un estado «fixture»: si la consulta falla, la vista muestra el
 * error y NUNCA sustituye la cifra por un valor de diseño (FR-12).
 */
export type EstadoAgregado<T> =
  | { readonly estado: 'cargando' }
  | { readonly estado: 'listo'; readonly datos: T }
  | { readonly estado: 'no-autorizado' }
  | { readonly estado: 'error' };

/* -------------------------------------------------------------------------- */
/* Textos aprobados                                                            */
/* -------------------------------------------------------------------------- */

/** Textos comunes a las dos vistas conectadas. */
export const TEXTOS_AGREGADOS = {
  cargando: 'Consultando la información registrada…',
  error:
    'No fue posible consultar la información registrada. Revise su conexión y vuelva a intentarlo.',
  noAutorizado:
    'No hay una sesión institucional vigente. Inicie sesión de nuevo para consultar la información del municipio.',
  vacio: 'Todavía no hay personas registradas en la institución.',
  fuenteEtiqueta: 'Datos registrados en la plataforma',
  supresion:
    'Para proteger a las personas, un grupo de 1 a 4 se muestra como «menos de 5» y no como cifra exacta.',
  datoOficialNoDisponible: 'Dato oficial no disponible',
  sinFuenteOficial:
    'No hay ninguna fuente oficial externa conectada: estas cifras describen únicamente los registros de la plataforma y no son una estadística oficial.',
} as const;

/** Corte declarado de la consulta, en la forma aprobada. */
export function textoDeCorte(asOfDate: string): string {
  return `Información con corte a ${asOfDate}.`;
}

/** Etiquetas de los conteos poblacionales. */
export const ETIQUETAS_POBLACION = {
  uniqueRegistered: 'Beneficiarios únicos registrados',
  olderAdult60Plus: 'Personas de 60 años o más',
  disabilityDeclared: 'Personas con discapacidad declarada',
  homeCareRequiredDeclared: 'Declaran requerir cuidado en casa',
} as const;

/** Etiquetas de las siete combinaciones exclusivas, en su orden aprobado. */
export const ETIQUETAS_INTERSECCION: Readonly<Record<ClaveInterseccion, string>> = {
  olderOnly: 'Solo persona mayor de 60',
  disabilityOnly: 'Solo discapacidad',
  homeCareOnly: 'Solo cuidado en casa',
  olderAndDisabilityOnly: 'Mayor de 60 y discapacidad',
  olderAndHomeCareOnly: 'Mayor de 60 y cuidado en casa',
  disabilityAndHomeCareOnly: 'Discapacidad y cuidado en casa',
  allThree: 'Las tres condiciones',
};

/** Etiquetas de las métricas que exigirían una fuente oficial externa. */
export const ETIQUETAS_METRICA_OFICIAL: Readonly<Record<ClaveMetricaOficial, string>> = {
  municipalTotalPopulation: 'Población total del municipio',
  officialTargetPopulation: 'Población objetivo oficial',
  disabilityNationalRegistry: 'Registro nacional de discapacidad',
  coverageOverTargetPopulation: 'Cobertura sobre población objetivo',
};

/** Aclaración de la única métrica de calidad con regla real. */
export const ETIQUETAS_CALIDAD = {
  territoryPendingNormalization: 'Registros pendientes de normalización territorial',
  aclaracion:
    'Es un indicador administrativo del registro, no una valoración de salud. Desde este panel no se identifica, no se abre y no se corrige el registro de ninguna persona.',
} as const;

/** Encabezados de la tabla territorial, en su orden aprobado. */
export const COLUMNAS_TERRITORIO = {
  personas: 'PERSONAS REGISTRADAS',
  mayores: '60 AÑOS O MÁS',
  discapacidad: 'DISCAPACIDAD',
  cuidado: 'CUIDADO EN CASA',
  pendientes: 'PENDIENTES DE NORMALIZACIÓN',
} as const;

/** Nombre visible de cada área. */
export const ETIQUETAS_AREA: Readonly<Record<AreaTypeCode, string>> = {
  URBAN: 'Zona urbana',
  RURAL: 'Zona rural',
};

/** Descripciones de las dos vistas conectadas. */
export const DESCRIPCIONES = {
  poblacion:
    'Personas registradas en la plataforma y sus poblaciones declaradas. Las categorías se cruzan: los totales no suman categorías, deduplican personas.',
  territorio:
    'Información agregada por municipio, zona y barrio o vereda. No se muestran direcciones individuales ni registros de personas.',
} as const;
