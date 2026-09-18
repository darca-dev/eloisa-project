import type { HospitalIconName } from './HospitalIcon';
import type {
  FinancialBandeja,
  FinancialColumna,
  FinancialEstadoSincronizacion,
  FinancialEvidencia,
  FinancialFila,
  FinancialFiltroId,
  FinancialFiltros,
  FinancialHistorialEntrada,
  FinancialMovimientoVinculado,
  FinancialOrigen,
  FinancialProcedencia,
  FinancialSeccionId,
} from './hospitalFinancialConfig';

/**
 * Contratos de las pantallas de «Gestión financiera» (TASK-003H-06).
 *
 * Describen la forma de cada sección sin contener datos: los fixtures viven en
 * `hospitalFinancialFixtures*.ts` y la presentación en los componentes. Esta
 * separación es también el contrato conceptual que H-07 Reportes consumirá:
 * toda cifra conserva programa, periodo y procedencia.
 *
 * Alcance: presentación. Ningún tipo de este archivo describe una fórmula
 * contable, un cálculo legal, un indicador oficial ni una capacidad de
 * integración activa.
 */

/* ========================================================================== */
/* Destinos internos                                                          */
/* ========================================================================== */

/**
 * Destino interno del módulo: sección y, opcionalmente, el recorte con el que
 * se abre. Un destino no consulta ni deriva datos: solo preselecciona filtros
 * locales sobre los fixtures ya cargados.
 */
export interface FinancialDestino {
  readonly seccion: FinancialSeccionId;
  readonly filtros?: Partial<FinancialFiltros>;
  readonly bandeja?: FinancialBandeja;
}

/* ========================================================================== */
/* Marco común de sección                                                     */
/* ========================================================================== */

/** Cifra compacta que encabeza una sección. No es un indicador oficial. */
export interface FinancialResumenBloque {
  readonly id: string;
  readonly etiqueta: string;
  readonly valor: string;
  readonly pie: string;
}

/**
 * Formulario largo en panel lateral.
 *
 * Es una representación de los campos aprobados para la sección: los controles
 * son de solo lectura, la ranura de archivo es únicamente visual y guardar
 * permanece inerte. No hay `form`, no hay envío y no hay persistencia.
 */
export interface FinancialFormulario {
  readonly abrir: string;
  readonly titulo: string;
  readonly campos: readonly string[];
  readonly ranura: string;
  readonly nota: string;
}

/** Sección de listado: la forma que comparten trece de los quince destinos. */
export interface FinancialSeccionTabla {
  readonly id: FinancialSeccionId;
  readonly titulo: string;
  readonly descripcion: string;
  readonly icono: HospitalIconName;
  /** Acción primaria contextual. Es inerte: no crea, no envía y no simula éxito. */
  readonly accionPrimaria: string;
  readonly buscadorEtiqueta: string;
  readonly buscadorAyuda: string;
  readonly filtros: readonly FinancialFiltroId[];
  /** Subpestañas del listado. Vacío cuando la sección no las necesita. */
  readonly bandejas: readonly FinancialBandeja[];
  readonly columnas: readonly FinancialColumna[];
  readonly filas: readonly FinancialFila[];
  /** Cifras compactas sobre la tabla. Ausente cuando la sección no las declara. */
  readonly resumen?: readonly FinancialResumenBloque[];
  /** Leyenda accesible de la tabla. */
  readonly leyenda: string;
  readonly vacioInicial: string;
  readonly vacioFiltrado: string;
  /** Aviso de alcance de la sección. Siempre visible como texto. */
  readonly nota: string;
  /** Panel de formulario, solo en las secciones que la Task lo define. */
  readonly formulario?: FinancialFormulario;
}

/* ========================================================================== */
/* Presupuesto y ejecución                                                    */
/* ========================================================================== */

/**
 * Fila de presupuesto por programa o rubro.
 *
 * Las cinco cifras son valores ficticios predefinidos en los fixtures. H-06 no
 * las calcula, no las deriva unas de otras y no implementa ninguna fórmula
 * contable, legal o institucional.
 */
export interface FinancialLineaPresupuesto {
  readonly id: string;
  readonly programa: string;
  readonly rubro: string;
  readonly periodo: string;
  readonly asignado: string;
  readonly comprometido: string;
  readonly ejecutado: string;
  readonly disponible: string;
  /** Porcentaje ya escrito en el fixture, con su signo de porcentaje. */
  readonly ejecucion: string;
  /** Ancho de la barra, expresado como porcentaje CSS. */
  readonly barra: string;
  readonly origen: FinancialOrigen;
}

/* ========================================================================== */
/* Resumen financiero                                                         */
/* ========================================================================== */

/** Tarjeta KPI compacta del resumen. */
export interface FinancialKpi {
  readonly id: string;
  readonly etiqueta: string;
  readonly valor: string;
  readonly periodo: string;
  /** Procedencia agregada de la cifra, escrita como texto. */
  readonly origen: string;
  readonly icono: HospitalIconName;
  readonly destino: FinancialDestino;
  /** Solo `Ejecución %` declara barra; el valor se lee además como texto. */
  readonly barra?: string;
}

/**
 * Categorías operativas internas permitidas en «Necesita atención financiera».
 *
 * Son alertas de organización del trabajo, nunca alertas oficiales,
 * regulatorias ni clínicas.
 */
export const FINANCIERA_CATEGORIAS_ATENCION = [
  'Cuentas por revisar',
  'Pagos pendientes',
  'Gastos sin evidencia',
  'Facturas pendientes',
  'Presupuesto cercano al umbral interno configurable',
  'Conflictos de sincronización',
] as const;

export type FinancialCategoriaAtencion = (typeof FINANCIERA_CATEGORIAS_ATENCION)[number];

/** Item priorizado de «Necesita atención financiera». */
export interface FinancialAtencion {
  readonly id: string;
  readonly categoria: FinancialCategoriaAtencion;
  readonly asunto: string;
  readonly programa: string;
  readonly antiguedad: string;
  readonly origen: FinancialOrigen;
  readonly destino: FinancialDestino;
}

/** Columna del flujo del periodo. La tabla alternativa repite las cifras. */
export interface FinancialFlujo {
  readonly id: string;
  readonly etiqueta: string;
  readonly ingresos: string;
  readonly egresos: string;
  readonly barraIngresos: string;
  readonly barraEgresos: string;
}

/** Contenido completo del resumen financiero. */
export interface FinancialResumenConfig {
  readonly kpis: readonly FinancialKpi[];
  readonly atencion: readonly FinancialAtencion[];
  readonly programas: readonly FinancialLineaPresupuesto[];
  readonly flujo: readonly FinancialFlujo[];
  readonly actividad: readonly FinancialMovimientoVinculado[];
  /** Aviso del umbral: es un ejemplo configurable, no una regla productiva. */
  readonly avisoUmbral: string;
}

/* ========================================================================== */
/* Conexión con sistema del Hospital                                          */
/* ========================================================================== */

/** Modalidades de conexión declaradas por el apartado 13 de la Task. */
export const FINANCIERA_MODALIDADES_CONEXION = [
  'Solo importar',
  'Bidireccional',
  'Mixta',
] as const;

export type FinancialModalidadConexion = (typeof FINANCIERA_MODALIDADES_CONEXION)[number];

/** Categoría configurable de la conexión. Marcarla no activa nada. */
export interface FinancialCategoriaConexion {
  readonly id: string;
  readonly etiqueta: string;
  readonly seleccionada: boolean;
  readonly direccion: FinancialModalidadConexion;
  readonly fuenteMaestra: FinancialOrigen;
  readonly frecuencia: string;
  readonly campos: string;
  readonly estado: FinancialEstadoSincronizacion;
  /** `true` cuando la modalidad requiere una aprobación posterior. */
  readonly bloqueada: boolean;
  readonly motivoBloqueo: string;
}

/** Ejecución de sincronización del historial demostrativo. */
export interface FinancialEjecucionSync {
  readonly id: string;
  readonly fecha: string;
  readonly categoria: string;
  readonly resultado: string;
  readonly importadas: string;
  readonly pendientes: string;
  readonly rechazadas: string;
  readonly conflictos: string;
}

/** Conflicto pendiente de resolución humana. Nunca se resuelve solo. */
export interface FinancialConflicto {
  readonly id: string;
  readonly registro: string;
  readonly categoria: string;
  readonly detectadoEn: string;
  readonly campo: string;
  readonly valorHospital: string;
  readonly valorPlataforma: string;
  /** Opciones futuras de resolución; ninguna está implementada. */
  readonly opciones: readonly string[];
  readonly nota: string;
}

/** Panel completo de «Conexión con sistema del Hospital». */
export interface FinancialConexionConfig {
  readonly aviso: string;
  readonly sistema: {
    readonly nombre: string;
    readonly modalidad: FinancialModalidadConexion;
    readonly estado: FinancialEstadoSincronizacion;
    readonly ultimaSincronizacion: string;
    readonly responsable: string;
  };
  readonly categorias: readonly FinancialCategoriaConexion[];
  readonly resumen: readonly FinancialResumenBloque[];
  readonly historial: readonly FinancialEjecucionSync[];
  readonly conflictos: readonly FinancialConflicto[];
  readonly notaModalidades: string;
}

/* ========================================================================== */
/* Configuración completa del módulo                                          */
/* ========================================================================== */

/** Estados transversales que cada pantalla debe poder representar. */
export interface FinancialEstadosPantalla {
  readonly cargando: string;
  readonly vacio: string;
  readonly error: string;
  readonly denegado: string;
  readonly desactualizado: string;
  readonly pendiente: string;
  readonly conflicto: string;
  readonly externoNoDisponible: string;
}

/** Contrato completo del módulo financiero. */
export interface FinancialConfig {
  readonly titulo: string;
  readonly descripcion: string;
  readonly badge: string;
  readonly periodoActivo: string;
  readonly estadoDatos: string;
  readonly avisoPermisos: string;
  readonly resumen: FinancialResumenConfig;
  readonly secciones: Readonly<Record<string, FinancialSeccionTabla>>;
  readonly presupuesto: readonly FinancialLineaPresupuesto[];
  readonly ejecucion: readonly FinancialLineaPresupuesto[];
  readonly conexion: FinancialConexionConfig;
  readonly estados: FinancialEstadosPantalla;
}

/* Re-exportados para que las secciones importen un solo módulo de contratos. */
export type {
  FinancialColumna,
  FinancialEvidencia,
  FinancialFila,
  FinancialHistorialEntrada,
  FinancialMovimientoVinculado,
  FinancialProcedencia,
};
