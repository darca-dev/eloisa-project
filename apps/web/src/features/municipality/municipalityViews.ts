/**
 * Navegación y selección local de la experiencia Alcaldía
 * (TASK-ALCALDIA-A-01, FR-02 y FR-03).
 *
 * Reproduce el estado `view` y el handler `go(view)` del prototipo aprobado
 * (`prototype-claude/Eligeme-Alcaldia.dc.html`, líneas 719 y 721), más el
 * estado `periodo` del selector temporal (líneas 719 y 757–761), como
 * funciones puras verificables sin DOM.
 *
 * Alcance: presentación. No crea rutas, no cambia la URL, no persiste, no
 * consulta red ni almacenamiento y no concede permisos. Que una opción del
 * menú sea visible no significa que su módulo exista ni que quien la ve pueda
 * usarlo: la autorización real será server-side, contextual y de denegación
 * por defecto.
 */

/** Módulos del menú aprobado, en su orden vinculante. */
export const MUNICIPALITY_MODULOS = [
  'inicio',
  'poblacion',
  'territorio',
  'programas',
  'presupuesto',
  'evidencias',
  'furag',
  'adres',
  'cuidado',
  'brechas',
  'cuidadores',
  'indicadores',
  'reportes',
] as const;

export type MunicipalityModuloId = (typeof MUNICIPALITY_MODULOS)[number];

/** Vista montada al abrir `/municipality`. */
export const MUNICIPALITY_VISTA_INICIAL: MunicipalityModuloId = 'inicio';

/**
 * Módulos con contenido propio: `inicio` (A-01), `poblacion` y `territorio`
 * (TASK-ALCALDIA-A-02, FR-01.5), `programas` (TASK-ALCALDIA-A-03, FR-01.2),
 * `presupuesto` y `evidencias` (TASK-ALCALDIA-A-04, FR-01.1) y los siete
 * restantes —`furag`, `adres`, `cuidado`, `brechas`, `cuidadores`,
 * `indicadores` y `reportes`— (TASK-ALCALDIA-DEMO-FINAL, §5.1).
 *
 * Con esta tarea los trece módulos del menú aprobado tienen contenido propio y
 * ninguno conserva el estado neutro «Próximamente». `MunicipalityComingSoon` y
 * su copy se conservan porque el rollback conceptual de la Task consiste en
 * retirar los siete módulos y devolverlos a ese estado.
 *
 * Que un módulo tenga pantalla no significa que exista la capacidad
 * institucional que representa: cada vista declara sus límites, su procedencia
 * de fixture y la ausencia de conexión.
 */
export const MUNICIPALITY_MODULOS_IMPLEMENTADOS: readonly MunicipalityModuloId[] = [
  ...MUNICIPALITY_MODULOS,
];

/** `true` solo para los identificadores del menú aprobado. */
export function esModuloMunicipal(id: string): id is MunicipalityModuloId {
  return (MUNICIPALITY_MODULOS as readonly string[]).includes(id);
}

/** `true` cuando ese módulo ya tiene contenido propio en esta tarea. */
export function tieneContenidoPropio(id: MunicipalityModuloId): boolean {
  return MUNICIPALITY_MODULOS_IMPLEMENTADOS.includes(id);
}

/**
 * Transición de vista. Un identificador ajeno al menú conserva la vista
 * actual: ningún control deja el contenido principal vacío.
 */
export function siguienteVista(
  actual: MunicipalityModuloId,
  solicitada: string,
): MunicipalityModuloId {
  return esModuloMunicipal(solicitada) ? solicitada : actual;
}

/* ------------------------- Selector temporal local ------------------------ */

/** Periodos del selector, en el orden del prototipo (líneas 757–761). */
export const MUNICIPALITY_PERIODOS = [
  'mes',
  'trimestre',
  'semestre',
  'ano',
  'personalizado',
] as const;

export type MunicipalityPeriodoId = (typeof MUNICIPALITY_PERIODOS)[number];

/** Periodo seleccionado al montar: `Este mes`. */
export const MUNICIPALITY_PERIODO_INICIAL: MunicipalityPeriodoId = 'mes';

/** `true` solo para los cinco periodos aprobados. */
export function esPeriodoMunicipal(id: string): id is MunicipalityPeriodoId {
  return (MUNICIPALITY_PERIODOS as readonly string[]).includes(id);
}

/**
 * Transición del selector temporal. La selección es exclusiva y efímera: no
 * recalcula ningún valor, no consulta ninguna fuente y no persiste.
 * `Personalizado` solo puede quedar seleccionado; no abre calendario, formulario
 * ni modal.
 */
export function siguientePeriodo(
  actual: MunicipalityPeriodoId,
  solicitado: string,
): MunicipalityPeriodoId {
  return esPeriodoMunicipal(solicitado) ? solicitado : actual;
}
