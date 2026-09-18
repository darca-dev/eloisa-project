/**
 * Catálogos controlados del servidor para la inscripción (TASK-MVP-CORE-01 §7).
 *
 * El servidor valida contra estos catálogos y NUNCA confía en las etiquetas que
 * envía el navegador. Cada entrada reproduce exactamente una opción del
 * formulario de Inscripción aprobado: no se inventan tipos documentales,
 * categorías de sexo/género ni entidades promotoras de salud.
 *
 * Estos catálogos no afirman oficialidad institucional: son la lista aprobada
 * para el MVP y su fuente autorizada es la UI existente, no un registro oficial.
 */

import {
  type DocumentTypeCode,
  type SexGenderCodeValue,
} from './enrollment.contract';

/** Etiqueta mostrada por la UI aprobada para cada tipo documental. */
export const DOCUMENT_TYPE_LABELS: Readonly<Record<DocumentTypeCode, string>> = {
  CEDULA_CIUDADANIA: 'Cédula de ciudadanía',
  CEDULA_EXTRANJERIA: 'Cédula de extranjería',
  PASAPORTE: 'Pasaporte',
  PERMISO_PROTECCION_TEMPORAL: 'Permiso por Protección Temporal',
  OTRO: 'Otro',
};

/** Etiqueta mostrada por la UI aprobada para cada valor de sexo/género. */
export const SEX_GENDER_LABELS: Readonly<Record<SexGenderCodeValue, string>> = {
  FEMENINO: 'Femenino',
  MASCULINO: 'Masculino',
  OTRO: 'Otro',
  PREFIERE_NO_DECIRLO: 'Prefiero no decirlo',
};

/** Entrada del catálogo de EPS controlado. */
export interface EpsCatalogEntry {
  readonly code: string;
  /** Nombre controlado; es el que se persiste, no el que envía el cliente. */
  readonly name: string;
}

/**
 * Catálogo de EPS del MVP. Reproduce, en el mismo orden, las opciones del paso
 * «EPS a la que pertenece» del formulario aprobado. `NO_SABE` y `NO_TIENE_EPS`
 * son estados declarados por la persona, no afiliaciones.
 */
export const EPS_CATALOG: readonly EpsCatalogEntry[] = [
  { code: 'NUEVA_EPS', name: 'Nueva EPS' },
  { code: 'SANITAS', name: 'Sanitas' },
  { code: 'SURA', name: 'Sura' },
  { code: 'SALUD_TOTAL', name: 'Salud Total' },
  { code: 'COMPENSAR', name: 'Compensar' },
  { code: 'FAMISANAR', name: 'Famisanar' },
  { code: 'OTRA_EPS', name: 'Otra EPS' },
  { code: 'NO_SABE', name: 'No sabe' },
  { code: 'NO_TIENE_EPS', name: 'No tiene EPS' },
];

const EPS_BY_CODE = new Map(EPS_CATALOG.map((entry) => [entry.code, entry]));

/** Devuelve la entrada del catálogo o `undefined` si el código no existe. */
export function findEpsByCode(code: string): EpsCatalogEntry | undefined {
  return EPS_BY_CODE.get(code);
}

/** Etiqueta de la UI aprobada correspondiente al código de EPS, si existe. */
export function findEpsCodeByLabel(label: string): string | undefined {
  const normalized = label.trim().toLocaleLowerCase('es-CO');
  return EPS_CATALOG.find(
    (entry) => entry.name.toLocaleLowerCase('es-CO') === normalized,
  )?.code;
}
