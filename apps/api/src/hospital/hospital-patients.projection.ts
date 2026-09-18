import { DOCUMENT_TYPE_LABELS } from '../patients/enrollment.catalogs';
import { deriveAgeInYears } from '../patients/population-derivation';

import {
  HOSPITAL_AGE_RANGES,
  HOSPITAL_INTERSECTIONS,
  HOSPITAL_OLDER_ADULT_THRESHOLD_YEARS,
  type HospitalAnalyticsCell,
  type HospitalAnalyticsDistribution,
  type HospitalAnalyticsIntersection,
  type HospitalAreaType,
  type HospitalPriorities,
  type HospitalTerritory,
} from './hospital.contract';

/**
 * Proyección y analítica de la superficie hospitalaria
 * (TASK-HOSPITAL-CORE-01 §4.2, §8.3 y §12.1).
 *
 * Funciones PURAS y deterministas: no consultan la base, no leen la fecha del
 * sistema —la fecha de corte llega siempre como argumento— y no dependen de
 * NestJS. Por eso se prueban exhaustivamente sin infraestructura.
 *
 * Reglas de minimización aplicadas aquí, y no en el controlador, para que no
 * exista ninguna vía que las salte:
 * - la edad se DERIVA de la fecha de nacimiento; no hay edad almacenada;
 * - el documento se devuelve SIEMPRE enmascarado; el valor completo no sale;
 * - el texto libre territorial NUNCA se proyecta: solo se publica el HECHO de
 *   que la localidad está pendiente de normalización.
 *
 * Ninguna función de este módulo emite diagnósticos, evalúa rangos clínicos,
 * genera alertas ni calcula semáforos: CORE-01 no contiene esos dominios y
 * fabricarlos sería inventar información clínica.
 */

/** Fila mínima leída de la base. Es todo lo que la proyección necesita. */
export interface HospitalPatientRow {
  readonly patientId: string;
  readonly givenNames: string;
  readonly familyNames: string;
  readonly birthDate: Date;
  readonly documentType: string;
  readonly documentNumberNormalized: string;
  readonly epsCode: string;
  readonly epsNameControlled: string;
  readonly status: string;
  readonly disabilityDeclared: boolean;
  readonly homeCareRequiredDeclared: boolean;
  readonly municipalityOfficialCode: string | null;
  readonly municipalityName: string | null;
  readonly areaType: HospitalAreaType | null;
  readonly localUnitName: string | null;
  readonly localityPendingNormalization: boolean;
}

/* -------------------------------------------------------------------------- */
/* Identidad minimizada                                                        */
/* -------------------------------------------------------------------------- */

/** Nombre completo tal como debe mostrarse. */
export function fullNameOf(row: {
  readonly givenNames: string;
  readonly familyNames: string;
}): string {
  return `${row.givenNames} ${row.familyNames}`.replace(/\s+/gu, ' ').trim();
}

/**
 * Iniciales derivadas del nombre.
 *
 * Se derivan aquí y no se persisten: un valor almacenado podría contradecir el
 * nombre. Devuelve como máximo dos letras.
 */
export function initialsOf(row: {
  readonly givenNames: string;
  readonly familyNames: string;
}): string {
  const primera = row.givenNames.trim().charAt(0);
  const segunda = row.familyNames.trim().charAt(0);

  return `${primera}${segunda}`.toLocaleUpperCase('es-CO');
}

/**
 * Documento ENMASCARADO por tipo documental.
 *
 * Publica exclusivamente la etiqueta del tipo y los TRES últimos caracteres del
 * número normalizado. El valor completo nunca sale del servidor, ni en el
 * listado ni en el detalle: la identidad institucional compartida de este slice
 * no demuestra necesidad individual de conocerlo.
 *
 * Un número demasiado corto para enmascararse con seguridad se declara
 * reservado en lugar de publicarse entero.
 */
export function maskDocument(documentType: string, documentNumberNormalized: string): string {
  const etiqueta = DOCUMENT_TYPE_LABELS[documentType as keyof typeof DOCUMENT_TYPE_LABELS];
  const prefijo = etiqueta ?? 'Documento';
  const limpio = documentNumberNormalized.replace(/\s+/gu, '');

  if (limpio.length < 4) {
    return `${prefijo} ···reservado`;
  }

  return `${prefijo} ···${limpio.slice(-3)}`;
}

/** Etiqueta visible del tipo documental, o el propio código si no está en el catálogo. */
export function documentTypeLabel(documentType: string): string {
  return (
    DOCUMENT_TYPE_LABELS[documentType as keyof typeof DOCUMENT_TYPE_LABELS] ?? documentType
  );
}

/**
 * Etiqueta NO clínica del estado del registro.
 *
 * Describe la situación ADMINISTRATIVA del registro en la plataforma. No es un
 * estado de salud, no es un triaje y no es un semáforo.
 */
export function statusLabel(status: string): string {
  return status === 'ACTIVE' ? 'Registro activo' : status;
}

/** Fecha de nacimiento `AAAA-MM-DD` en UTC, sin desplazamiento de zona. */
export function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

/** Edad cumplida a la fecha de corte, en UTC. */
export function ageAt(birthDate: Date, asOf: Date): number {
  return deriveAgeInYears(birthDate, asOf);
}

/** Las tres condiciones prioritarias de una fila. */
export function prioritiesOf(row: HospitalPatientRow, asOf: Date): HospitalPriorities {
  return {
    older60: ageAt(row.birthDate, asOf) >= HOSPITAL_OLDER_ADULT_THRESHOLD_YEARS,
    disabilityDeclared: row.disabilityDeclared,
    homeCareRequiredDeclared: row.homeCareRequiredDeclared,
  };
}

/**
 * Territorio canónico publicable.
 *
 * Ante una incoherencia —localidad marcada como pendiente pero con unidad
 * canónica, o al revés— se elige NO atribuir el registro a un territorio que
 * quizá no le corresponde. El texto libre declarado no se proyecta jamás.
 */
export function territoryOf(row: HospitalPatientRow): HospitalTerritory {
  const pendiente = row.localUnitName === null || row.localityPendingNormalization;

  return {
    municipalityOfficialCode: row.municipalityOfficialCode,
    municipalityName: row.municipalityName,
    areaType: row.areaType,
    localUnitName: pendiente ? null : row.localUnitName,
    pendingNormalization: pendiente,
  };
}

/* -------------------------------------------------------------------------- */
/* Analítica                                                                   */
/* -------------------------------------------------------------------------- */

/** Porcentaje sobre el universo; `null` cuando el denominador es cero. */
export function percentageOf(part: number, universe: number): number | null {
  return universe === 0 ? null : (part / universe) * 100;
}

/** Identificador del rango de edad al que pertenece una edad cumplida. */
export function ageRangeIdOf(age: number): string {
  const rango = HOSPITAL_AGE_RANGES.find(
    (candidato) => age >= candidato.from && (candidato.to === null || age <= candidato.to),
  );

  // Una edad fuera de todo rango no se fuerza al primero: se declara como tal.
  return rango?.id ?? 'fuera-de-rango';
}

function cell(
  key: string,
  label: string,
  value: number,
  universe: number,
): HospitalAnalyticsCell {
  return { key, label, value, percentage: percentageOf(value, universe) };
}

/**
 * Las CUATRO cifras que CORE-01 permite calcular honestamente.
 *
 * `Sin cuidador` y `Sin profesional` NO aparecen: CORE-01 no modela cuidadores
 * ni profesionales, de modo que su cifra no distinguiría «no tiene» de «no está
 * registrado». Publicar un cero ahí sería afirmar un hecho falso.
 *
 * Son CONTEOS, no indicadores institucionales: no tienen fuente oficial externa,
 * no acreditan cumplimiento y no deben presentarse como una medición oficial.
 */
export function keyFiguresOf(
  rows: readonly HospitalPatientRow[],
  asOf: Date,
): readonly HospitalAnalyticsCell[] {
  const universo = rows.length;
  let mayores = 0;
  let discapacidad = 0;
  let cuidados = 0;

  for (const row of rows) {
    const prioridades = prioritiesOf(row, asOf);

    if (prioridades.older60) {
      mayores += 1;
    }

    if (prioridades.disabilityDeclared) {
      discapacidad += 1;
    }

    if (prioridades.homeCareRequiredDeclared) {
      cuidados += 1;
    }
  }

  return [
    cell('activePatients', 'Pacientes activos', universo, universo),
    cell('age60Plus', 'Mayores de 60', mayores, universo),
    cell('withDisability', 'Con discapacidad declarada', discapacidad, universo),
    cell('homeCareRequired', 'Cuidados en casa declarados', cuidados, universo),
  ];
}

function accumulate(counts: Map<string, number>, key: string): void {
  counts.set(key, (counts.get(key) ?? 0) + 1);
}

/**
 * Distribuciones de rango de edad, EPS, municipio y área.
 *
 * Las cuatro cuentan PERSONAS ÚNICAS y cada persona cae en exactamente una
 * celda de cada distribución, de modo que todas reconcilian el universo
 * filtrado. No hay distribución de patologías, programas, cuidadores ni
 * profesionales: esos dominios no existen en CORE-01.
 */
export function distributionsOf(
  rows: readonly HospitalPatientRow[],
  asOf: Date,
): readonly HospitalAnalyticsDistribution[] {
  const universo = rows.length;
  const edades = new Map<string, number>();
  const eps = new Map<string, number>();
  const municipios = new Map<string, number>();
  const areas = new Map<string, number>();
  const nombreEps = new Map<string, string>();
  const nombreMunicipio = new Map<string, string>();

  for (const row of rows) {
    accumulate(edades, ageRangeIdOf(ageAt(row.birthDate, asOf)));

    accumulate(eps, row.epsCode);
    nombreEps.set(row.epsCode, row.epsNameControlled);

    /*
     * Un registro sin dirección, o con municipio sin código oficial, no se
     * atribuye a ningún municipio inventado: cae en una celda explícita de
     * territorio no determinado.
     */
    const municipio = row.municipalityOfficialCode ?? 'sin-territorio';
    accumulate(municipios, municipio);
    nombreMunicipio.set(
      municipio,
      row.municipalityOfficialCode === null
        ? 'Sin territorio registrado'
        : (row.municipalityName ?? row.municipalityOfficialCode),
    );

    accumulate(areas, row.areaType ?? 'sin-area');
  }

  const celdasEdad = HOSPITAL_AGE_RANGES.map((rango) =>
    cell(rango.id, rango.label, edades.get(rango.id) ?? 0, universo),
  );
  const fueraDeRango = edades.get('fuera-de-rango') ?? 0;

  if (fueraDeRango > 0) {
    celdasEdad.push(cell('fuera-de-rango', 'Fuera de rango', fueraDeRango, universo));
  }

  return [
    { id: 'age-ranges', label: 'Rangos de edad', cells: celdasEdad },
    {
      id: 'eps',
      label: 'EPS',
      cells: ordenar(eps).map(([code, valor]) =>
        cell(code, nombreEps.get(code) ?? code, valor, universo),
      ),
    },
    {
      id: 'municipality',
      label: 'Municipio',
      cells: ordenar(municipios).map(([code, valor]) =>
        cell(code, nombreMunicipio.get(code) ?? code, valor, universo),
      ),
    },
    {
      id: 'area-type',
      label: 'Área',
      cells: [
        cell('URBAN', 'Urbana', areas.get('URBAN') ?? 0, universo),
        cell('RURAL', 'Rural', areas.get('RURAL') ?? 0, universo),
        cell('sin-area', 'Sin territorio registrado', areas.get('sin-area') ?? 0, universo),
      ],
    },
  ];
}

/** Orden determinista: por valor descendente y, ante empate, por clave. */
function ordenar(counts: ReadonlyMap<string, number>): readonly (readonly [string, number])[] {
  return [...counts.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es-CO'),
  );
}

/**
 * Las OCHO intersecciones disjuntas.
 *
 * Cada persona cae en exactamente una celda, de modo que la suma reconcilia
 * SIEMPRE el universo filtrado. La celda `ninguna` es parte del conjunto: sin
 * ella la suma no cerraría y las cifras parecerían faltantes.
 */
export function intersectionsOf(
  rows: readonly HospitalPatientRow[],
  asOf: Date,
): readonly HospitalAnalyticsIntersection[] {
  const universo = rows.length;
  const conteo = new Map<string, number>();

  for (const row of rows) {
    const { older60, disabilityDeclared, homeCareRequiredDeclared } = prioritiesOf(row, asOf);

    accumulate(
      conteo,
      `${String(older60)}|${String(disabilityDeclared)}|${String(homeCareRequiredDeclared)}`,
    );
  }

  return HOSPITAL_INTERSECTIONS.map((definicion) => {
    const valor =
      conteo.get(
        `${String(definicion.older60)}|${String(definicion.disabilityDeclared)}|${String(
          definicion.homeCareRequiredDeclared,
        )}`,
      ) ?? 0;

    return {
      key: definicion.id,
      label: definicion.label,
      value: valor,
      percentage: percentageOf(valor, universo),
      older60: definicion.older60,
      disabilityDeclared: definicion.disabilityDeclared,
      homeCareRequiredDeclared: definicion.homeCareRequiredDeclared,
    };
  });
}
