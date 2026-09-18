/**
 * Contrato compartido de población y analítica (TASK-003H-03B, §6 y §7).
 *
 * Este módulo es la ÚNICA fuente de tipos y definiciones métricas de la
 * población atendida. `Pacientes` (H-03B) y, cuando exista, `Reportes` (H-07)
 * deben importar de aquí y de `hospitalPopulationAnalytics.ts`: queda prohibido
 * copiar fórmulas, rangos, totales o reglas de intersección dentro de un
 * componente.
 *
 * Alcance: presentación demostrativa. Los tipos describen el modelo conceptual
 * futuro (§7) lo suficiente para sostener la vista local, pero NO son el
 * esquema físico, no crean persistencia, no crean APIs y no conceden permisos.
 *
 * Las patologías/condiciones son información REGISTRADA Y AUTORIZADA con su
 * procedencia: no se infieren, no se derivan de otros datos y no constituyen
 * diagnóstico automático. El semáforo es un texto ya escrito por el fixture: no
 * es una regla clínica ni una alerta calculada.
 */

/* ========================================================================== */
/* Formateo de presentación                                                   */
/* ========================================================================== */

/**
 * Formateadores PUROS de presentación (TASK-HOSPITAL-CORE-01 §10.1 y §10.2).
 *
 * Viven aquí, y no en `hospitalPopulationAnalytics.ts`, por una razón concreta:
 * aquel módulo importa `hospitalPopulationFixtures.ts` para sus constantes de
 * escenario, y el árbol renderizado de Hospital → Pacientes tiene PROHIBIDO
 * alcanzar el fixture. Este módulo no importa nada, de modo que la vista puede
 * tomar de aquí lo que necesita sin ninguna dependencia de datos demostrativos.
 *
 * `hospitalPopulationAnalytics.ts` los REEXPORTA, así que Reportes (H-07) y el
 * resto de consumidores ya existentes siguen funcionando sin cambio alguno y sin
 * que exista una segunda implementación de la misma regla.
 *
 * Ninguno lee la fecha del sistema ni la configuración regional del navegador:
 * un mismo valor produce siempre el mismo texto.
 */

/** Miles separados con punto, sin depender de la configuración regional. */
export function formatearNumero(valor: number): string {
  return String(valor).replace(/\B(?=(?:\d{3})+(?!\d))/gu, '.');
}

/**
 * Porcentaje ya redactado, con coma decimal.
 *
 * Cuando el denominador es cero devuelve `Sin datos`: nunca escribe «0 %», que
 * se leería como un hecho medido y no como la ausencia de universo.
 */
export function textoPorcentaje(
  valor: number | null,
  sinDatos: string = POBLACION_SIN_DATOS,
): string {
  return valor === null ? sinDatos : `${valor.toFixed(1).replace('.', ',')} %`;
}

/** Nombres de mes en español, para redactar una fecha sin usar `Date`. */
const MESES: readonly string[] = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

/**
 * Fecha de corte redactada a partir de la cadena `AAAA-MM-DD` del SERVIDOR.
 *
 * Se compone con operaciones de cadena y NO con `Date`: la fecha de corte la
 * fija el servidor y convertirla a una fecha local podría desplazarla un día
 * según la zona horaria del navegador, cambiando la cifra que la persona lee.
 *
 * Ante una cadena con forma inesperada devuelve `null` en lugar de inventar una
 * fecha.
 */
export function textoFechaCorte(asOfDate: string): string | null {
  const coincidencia = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(asOfDate);

  if (coincidencia === null) {
    return null;
  }

  const [, anio, mes, dia] = coincidencia;
  const nombreMes = MESES[Number(mes) - 1];

  if (nombreMes === undefined) {
    return null;
  }

  return `Corte ${String(Number(dia))} de ${nombreMes} de ${anio}`;
}

/** Versión de las definiciones métricas compartidas por H-03B y H-07. */
export const POBLACION_VERSION_DEFINICION = 'population-v1';

/**
 * Clasificaciones prioritarias registradas. `MAYOR_60` NO aparece aquí: la
 * condición de mayor de 60 se DERIVA de la fecha de nacimiento respecto de la
 * fecha de corte (§6), nunca de un valor almacenado que pueda contradecirla.
 */
export const POBLACION_CLASIFICACIONES = ['DISABILITY', 'HOME_CARE_REQUIRED'] as const;

export type PoblacionClasificacionId = (typeof POBLACION_CLASIFICACIONES)[number];

/** Etiqueta visible de cada clasificación registrada. */
export const POBLACION_ETIQUETA_CLASIFICACION: Record<PoblacionClasificacionId, string> = {
  DISABILITY: 'Discapacidad',
  HOME_CARE_REQUIRED: 'Cuidados en casa',
};

/**
 * Las tres condiciones prioritarias que la vista representa y que pueden
 * coexistir en la misma persona: A = mayor de 60 (derivada), B = discapacidad,
 * C = cuidados en casa.
 */
export const POBLACION_PRIORIDADES = ['MAYOR_60', 'DISABILITY', 'HOME_CARE_REQUIRED'] as const;

export type PoblacionPrioridadId = (typeof POBLACION_PRIORIDADES)[number];

export const POBLACION_ETIQUETA_PRIORIDAD: Record<PoblacionPrioridadId, string> = {
  MAYOR_60: 'Mayor de 60',
  DISABILITY: 'Discapacidad',
  HOME_CARE_REQUIRED: 'Cuidados en casa',
};

/** Valor que representa la ausencia de asignación en filtros y celdas. */
export const POBLACION_SIN_ASIGNAR = 'Sin asignar';

/** Texto que sustituye a un porcentaje cuando el denominador es cero (§6). */
export const POBLACION_SIN_DATOS = 'Sin datos';

/** Texto cuando ninguna relación activa está marcada como principal (§7). */
export const POBLACION_SIN_CONDICION_PRINCIPAL = 'Sin condición principal registrada';

/**
 * Rangos de edad mutuamente excluyentes (§6). `hasta === null` describe el
 * tramo abierto superior. El orden es vinculante para la visualización.
 */
export interface PoblacionRangoEdad {
  readonly id: string;
  readonly etiqueta: string;
  readonly desde: number;
  readonly hasta: number | null;
}

export const POBLACION_RANGOS_EDAD: readonly PoblacionRangoEdad[] = [
  { id: '0-17', etiqueta: '0–17', desde: 0, hasta: 17 },
  { id: '18-39', etiqueta: '18–39', desde: 18, hasta: 39 },
  { id: '40-59', etiqueta: '40–59', desde: 40, hasta: 59 },
  { id: '60-74', etiqueta: '60–74', desde: 60, hasta: 74 },
  { id: '75-84', etiqueta: '75–84', desde: 75, hasta: 84 },
  { id: '85+', etiqueta: '85+', desde: 85, hasta: null },
];

/** Edad a partir de la cual la persona cuenta como mayor de 60 (§6). */
export const POBLACION_EDAD_MAYOR = 60;

/* ========================================================================== */
/* Registros de la persona                                                    */
/* ========================================================================== */

/**
 * Sobre de procedencia de un dato autorizado. Es ficticio en este slice: no
 * describe ninguna integración existente ni ninguna fuente oficial (§9).
 */
export interface PoblacionProcedencia {
  /** Sistema o actor que aportó el dato dentro del escenario demostrativo. */
  readonly fuente: string;
  /** Fecha del dato en la fuente, con formato AAAA-MM-DD. */
  readonly fecha: string;
  /** Estado del registro en la fuente: Vigente, En revisión o Cerrado. */
  readonly estado: string;
}

/** Clasificación prioritaria registrada, con vigencia y procedencia. */
export interface PoblacionClasificacionRegistro {
  readonly tipo: PoblacionClasificacionId;
  readonly activa: boolean;
  readonly desde: string;
  readonly hasta: string | null;
  readonly procedencia: PoblacionProcedencia;
}

/**
 * Condición/patología registrada. `principal` marca la relación principal:
 * como máximo UNA activa por persona (§7). No se elige automáticamente por
 * frecuencia y no es un diagnóstico emitido por la plataforma.
 */
export interface PoblacionCondicionRegistro {
  readonly nombre: string;
  readonly activa: boolean;
  readonly principal: boolean;
  readonly procedencia: PoblacionProcedencia;
}

/** Vínculo autorizado paciente–cuidador. Una persona puede tener varios. */
export interface PoblacionCuidadorVinculo {
  readonly nombre: string;
  readonly relacion: string;
  readonly contacto: string;
  readonly activo: boolean;
  readonly vigente: boolean;
}

/** Asignación de profesional. Como máximo una principal vigente (§7). */
export interface PoblacionAsignacionProfesional {
  readonly nombre: string;
  readonly profesion: string;
  readonly principal: boolean;
  readonly activa: boolean;
  readonly vigente: boolean;
}

/** Afiliación EPS versionada. Solo el registro vigente alimenta el filtro. */
export interface PoblacionAfiliacionEps {
  readonly eps: string;
  readonly desde: string;
  readonly estado: string;
}

/** Tonos disponibles para estados y semáforo; coinciden con `hospitalTonos`. */
export type PoblacionTono = 'verde' | 'amarillo' | 'rojo' | 'azul' | 'petroleo';

/** Atención registrada: cita, visita domiciliaria o consulta virtual. */
export interface PoblacionAtencion {
  readonly id: string;
  readonly fecha: string;
  readonly hora: string;
  readonly modalidad: string;
  readonly profesional: string;
  readonly estado: string;
  readonly tono: PoblacionTono;
}

/** Alerta/semaforización ya escrita por el fixture; nunca calculada aquí. */
export interface PoblacionSemaforo {
  readonly etiqueta: string;
  readonly texto: string;
  readonly tono: 'verde' | 'amarillo' | 'rojo';
}

/**
 * Persona paciente del conjunto demostrativo.
 *
 * `id` es el identificador estable de deduplicación dentro del tenant (§6).
 * `participacion` decide la pertenencia al universo: solo `active` cuenta.
 */
export interface PoblacionPaciente {
  readonly id: string;
  readonly tenantId: string;
  readonly nombre: string;
  readonly iniciales: string;
  /** Documento ficticio completo. Solo se muestra enmascarado (§8). */
  readonly documento: string;
  readonly nacimiento: string;
  readonly contacto: string;
  readonly municipio: string;
  readonly zona: string;
  readonly participacion: 'active' | 'inactive';
  readonly estado: string;
  readonly semaforo: PoblacionSemaforo;
  readonly afiliacion: PoblacionAfiliacionEps;
  readonly clasificaciones: readonly PoblacionClasificacionRegistro[];
  readonly condiciones: readonly PoblacionCondicionRegistro[];
  readonly asignaciones: readonly PoblacionAsignacionProfesional[];
  readonly cuidadores: readonly PoblacionCuidadorVinculo[];
  readonly programas: readonly string[];
  readonly proximaAtencion: PoblacionAtencion | null;
  readonly ultimasAtenciones: readonly PoblacionAtencion[];
}

/* ========================================================================== */
/* Consulta local                                                             */
/* ========================================================================== */

/** Chips rápidos combinables. Los tres son independientes entre sí (§5). */
export interface PoblacionRapidos {
  readonly mayor60: boolean;
  readonly discapacidad: boolean;
  readonly cuidadosCasa: boolean;
}

/**
 * Filtros locales. Todos se combinan con AND; dentro de una persona los
 * valores multivalor (patologías, clasificaciones, programas, cuidadores)
 * coinciden con OR: basta una relación activa (§5).
 */
export interface PoblacionFiltros {
  readonly texto: string;
  readonly edadMin: string;
  readonly edadMax: string;
  readonly condicion: string;
  readonly eps: string;
  readonly patologia: string;
  readonly profesional: string;
  readonly cuidador: string;
  readonly programa: string;
  readonly municipio: string;
  readonly estado: string;
  readonly rapidos: PoblacionRapidos;
}

/** Criterios de orden del listado (§4.1, punto 5). */
export const POBLACION_ORDENES = ['nombre', 'edad', 'proxima', 'estado'] as const;

export type PoblacionOrdenId = (typeof POBLACION_ORDENES)[number];

export type PoblacionSentido = 'asc' | 'desc';

/** Tamaños de página ofrecidos; 50 es el valor por defecto (§4.1, punto 5). */
export const POBLACION_TAMANOS_PAGINA = [25, 50, 100] as const;

export const POBLACION_TAMANO_PAGINA_INICIAL = 50;

/* ========================================================================== */
/* Contrato de analítica compartido                                           */
/* ========================================================================== */

/** Valor de un KPI con su porcentaje ya resuelto sobre el universo. */
export interface PoblacionKpi {
  readonly id: string;
  readonly etiqueta: string;
  readonly valor: number;
  /** `null` cuando el denominador es cero: la vista escribe `Sin datos` (§6). */
  readonly porcentaje: number | null;
}

/** Celda de una distribución: pacientes únicos, nunca número de registros. */
export interface PoblacionCelda {
  readonly id: string;
  readonly etiqueta: string;
  readonly valor: number;
  readonly porcentaje: number | null;
}

/** Distribución con su nota de lectura y sus celdas en orden. */
export interface PoblacionDistribucion {
  readonly id: string;
  readonly titulo: string;
  /** Aclaración de qué cuenta la distribución; siempre visible o accesible. */
  readonly nota: string;
  readonly celdas: readonly PoblacionCelda[];
}

/**
 * Una de las ocho celdas disjuntas de la matriz de intersecciones (§6). Los
 * tres booleanos describen la combinación exacta A/B/C que la celda representa.
 */
export interface PoblacionInterseccion {
  readonly id: string;
  readonly etiqueta: string;
  readonly mayor60: boolean;
  readonly discapacidad: boolean;
  readonly cuidadosCasa: boolean;
  readonly valor: number;
  readonly porcentaje: number | null;
}

/** Filtros ya normalizados que produjeron el snapshot. */
export interface PoblacionFiltrosNormalizados {
  readonly texto: string;
  readonly edadMin: number | null;
  readonly edadMax: number | null;
  readonly condicion: string | null;
  readonly eps: string | null;
  readonly patologia: string | null;
  readonly profesional: string | null;
  readonly cuidador: string | null;
  readonly programa: string | null;
  readonly municipio: string | null;
  readonly estado: string | null;
  readonly rapidos: PoblacionRapidos;
}

/**
 * `PopulationAnalyticsSnapshotV1` (§6).
 *
 * Contrato lógico que H-03B y H-07 comparten. En arquitectura futura sus
 * resultados serán `MERDN_CALCULATED`; hoy son dato demostrativo y así se
 * rotulan en pantalla. `calculatedAt` es una marca del fixture: el módulo NO
 * lee la fecha del sistema.
 */
export interface PopulationAnalyticsSnapshotV1 {
  readonly version: typeof POBLACION_VERSION_DEFINICION;
  readonly contexto: {
    readonly tenantId: string;
    readonly institucion: string;
    readonly municipioSede: string;
  };
  readonly fechaCorte: string;
  readonly filtros: PoblacionFiltrosNormalizados;
  readonly universo: number;
  readonly kpi: readonly PoblacionKpi[];
  readonly distribuciones: readonly PoblacionDistribucion[];
  readonly intersecciones: readonly PoblacionInterseccion[];
  readonly procedencia: {
    readonly clase: string;
    readonly origen: string;
    readonly nota: string;
  };
  readonly calculatedAt: string;
}
