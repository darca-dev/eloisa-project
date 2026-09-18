import {
  OLDER_ADULT_THRESHOLD_YEARS,
  deriveAgeInYears,
} from '../patients/population-derivation';

import {
  EXCLUSIVE_INTERSECTION_KEYS,
  type ExclusiveIntersectionKey,
  type ExclusiveIntersections,
  MUNICIPALITY_AGGREGATE_SOURCE,
  OFFICIAL_METRIC_KEYS,
  type OfficialMetric,
  type PopulationSummary,
  toAsOfDate,
} from './municipality.contract';
import {
  type DisclosureCell,
  type SuppressedCount,
  applyPrimarySuppression,
  protectDisclosure,
} from './suppression';

/**
 * Agregación de población beneficiaria (TASK-MUNICIPALITY-CORE-01, FR-03 a
 * FR-05, FR-08 a FR-10 y pruebas T-01, T-02 y T-09).
 *
 * Reglas aplicadas:
 * - la unidad de conteo es la PERSONA/paciente único del tenant: quien cumple
 *   las tres condiciones cuenta una sola vez;
 * - `60+` se deriva SIEMPRE de la fecha de nacimiento contra la fecha de corte,
 *   con la misma función que usó la inscripción. La pertenencia persistida
 *   `OLDER_ADULT_60_PLUS` puede haber quedado obsoleta cuando alguien cumple 60
 *   después de inscribirse, y por eso NO se usa aquí (FR-04);
 * - `DISABILITY` y `HOME_CARE_REQUIRED` son pertenencias DECLARADAS. No son
 *   diagnósticos, certificaciones oficiales ni inferencias clínicas;
 * - las siete regiones son EXCLUSIVAS: cada persona cae exactamente en una.
 *
 * Ninguna función de este módulo recibe, calcula ni devuelve un identificador,
 * un nombre, un documento, una dirección ni una edad individual: la fecha de
 * nacimiento entra, se convierte en un booleano y se descarta.
 */

/** Fila mínima leída de PostgreSQL para una persona registrada. */
export interface PopulationRow {
  readonly birthDate: Date;
  readonly disabilityDeclared: boolean;
  readonly homeCareRequiredDeclared: boolean;
}

/** Región exclusiva de una persona, incluida la ausencia de las tres. */
export type ExclusiveRegion = ExclusiveIntersectionKey | 'noneOfThree';

/**
 * Región exclusiva a la que pertenece una persona.
 *
 * `noneOfThree` NO se publica: una persona registrada puede no declarar ninguna
 * de las tres condiciones, y ocultar ese resto es además una protección, porque
 * impide reconstruir una región suprimida restando del total.
 */
export function exclusiveRegionOf(
  older: boolean,
  disability: boolean,
  homeCare: boolean,
): ExclusiveRegion {
  if (older && disability && homeCare) {
    return 'allThree';
  }

  if (older && disability) {
    return 'olderAndDisabilityOnly';
  }

  if (older && homeCare) {
    return 'olderAndHomeCareOnly';
  }

  if (disability && homeCare) {
    return 'disabilityAndHomeCareOnly';
  }

  if (older) {
    return 'olderOnly';
  }

  if (disability) {
    return 'disabilityOnly';
  }

  if (homeCare) {
    return 'homeCareOnly';
  }

  return 'noneOfThree';
}

/** `true` cuando la persona tiene 60 años cumplidos en la fecha de corte. */
export function isOlderAdultAt(birthDate: Date, asOf: Date): boolean {
  return deriveAgeInYears(birthDate, asOf) >= OLDER_ADULT_THRESHOLD_YEARS;
}

/** Regiones que componen cada conteo poblacional publicado. */
const POPULATION_COMPOSITION = {
  olderAdult60Plus: [
    'olderOnly',
    'olderAndDisabilityOnly',
    'olderAndHomeCareOnly',
    'allThree',
  ],
  disabilityDeclared: [
    'disabilityOnly',
    'olderAndDisabilityOnly',
    'disabilityAndHomeCareOnly',
    'allThree',
  ],
  homeCareRequiredDeclared: [
    'homeCareOnly',
    'olderAndHomeCareOnly',
    'disabilityAndHomeCareOnly',
    'allThree',
  ],
} as const satisfies Record<string, readonly ExclusiveRegion[]>;

/** Todas las regiones, incluida la no publicada. */
const ALL_REGIONS: readonly ExclusiveRegion[] = [
  ...EXCLUSIVE_INTERSECTION_KEYS,
  'noneOfThree',
];

export interface PopulationSummaryInput {
  readonly rows: readonly PopulationRow[];
  /** Personas registradas con localidad pendiente de normalización. */
  readonly territoryPendingNormalization: number;
  readonly asOf: Date;
  readonly generatedAt: Date;
}

/** Construye el resumen de población ya protegido contra grupos pequeños. */
export function buildPopulationSummary(input: PopulationSummaryInput): PopulationSummary {
  const atoms = new Map<string, number>(ALL_REGIONS.map((region) => [region, 0]));

  for (const row of input.rows) {
    const region = exclusiveRegionOf(
      isOlderAdultAt(row.birthDate, input.asOf),
      row.disabilityDeclared,
      row.homeCareRequiredDeclared,
    );

    atoms.set(region, (atoms.get(region) ?? 0) + 1);
  }

  const cells: DisclosureCell[] = [
    ...EXCLUSIVE_INTERSECTION_KEYS.map((key) => ({ key, atoms: [key] })),
    ...Object.entries(POPULATION_COMPOSITION).map(([key, regions]) => ({
      key,
      atoms: [...regions],
    })),
    { key: 'uniqueRegistered', atoms: [...ALL_REGIONS] },
  ];

  const protegidos = protectDisclosure({ atoms, cells });

  return {
    source: MUNICIPALITY_AGGREGATE_SOURCE,
    asOfDate: toAsOfDate(input.asOf),
    generatedAt: input.generatedAt.toISOString(),
    uniqueRegistered: leer(protegidos, 'uniqueRegistered'),
    populations: {
      olderAdult60Plus: leer(protegidos, 'olderAdult60Plus'),
      disabilityDeclared: leer(protegidos, 'disabilityDeclared'),
      homeCareRequiredDeclared: leer(protegidos, 'homeCareRequiredDeclared'),
    },
    exclusiveIntersections: EXCLUSIVE_INTERSECTION_KEYS.reduce<
      Record<string, SuppressedCount>
    >((acumulado, key) => {
      acumulado[key] = leer(protegidos, key);

      return acumulado;
    }, {}) as unknown as ExclusiveIntersections,
    officialMetrics: buildOfficialMetrics(),
    quality: {
      // La normalización territorial pendiente reparte a las personas por
      // TERRITORIO, no por condición: no comparte partición con las siete
      // regiones y por eso basta la regla primaria.
      territoryPendingNormalization: applyPrimarySuppression(
        input.territoryPendingNormalization,
      ),
    },
  };
}

/**
 * Métricas oficiales, siempre no disponibles.
 *
 * MERDN no contiene población total municipal, población objetivo oficial,
 * registro nacional de discapacidad ni denominador válido de cobertura, y esta
 * Task no conecta ninguna fuente externa. Se declara la ausencia en lugar de
 * calcular un porcentaje sin denominador o de reutilizar un dato de ejemplo.
 */
function buildOfficialMetrics(): readonly OfficialMetric[] {
  return OFFICIAL_METRIC_KEYS.map((metric) => ({
    metric,
    status: 'UNAVAILABLE',
    value: null,
  }));
}

function leer(
  protegidos: ReadonlyMap<string, SuppressedCount>,
  key: string,
): SuppressedCount {
  const valor = protegidos.get(key);

  if (valor === undefined) {
    // Inalcanzable: todas las claves se declaran arriba. Ante lo imposible se
    // devuelve el estado más restrictivo, nunca un número sin proteger.
    return { status: 'SUPPRESSED', value: null, display: '<5' };
  }

  return valor;
}
