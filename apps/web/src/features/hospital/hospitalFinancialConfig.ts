import { platformNameInSentence } from '@/config/branding';

import type { HospitalIconName } from './HospitalIcon';
import type { HospitalTonoId } from './hospitalTonos';

/**
 * Contrato tipado, catálogos y lógica local de «Gestión financiera»
 * (TASK-003H-06).
 *
 * Reúne lo que la Task define como vinculante: las seis agrupaciones y los
 * quince destinos del menú secundario, los catálogos transversales de estado
 * —movimiento, sincronización, evidencia y cuenta de cobro—, el modelo de
 * procedencia de dos fuentes y el recorte local de filas por búsqueda y
 * filtros.
 *
 * Alcance: presentación. Sin backend, red, persistencia, archivos, pagos,
 * autorización real, integración activa ni cálculo contable, laboral o
 * tributario. Los catálogos son etiquetas visibles ya aprobadas: no evalúan,
 * no autorizan, no calculan y no declaran cumplimiento oficial. El recorte de
 * filas es aritmética de presentación sobre fixtures ficticios en memoria.
 */

/**
 * Etiqueta de origen del producto dentro de una frase corriente.
 *
 * Se compone desde la única fuente de marca visible (`@/config/branding`): este
 * módulo no escribe el nombre de la plataforma como literal en ningún punto, ni
 * en código ni en fixtures, y el nombre técnico interno nunca aparece. Por eso
 * el catálogo de orígenes se comprueba en ejecución —ver la prueba de
 * procedencia— y no por estrechamiento de tipos.
 */
export const FINANCIERA_PLATAFORMA: string = platformNameInSentence();

/* ========================================================================== */
/* Navegación interna                                                         */
/* ========================================================================== */

/** Los quince destinos del menú secundario, en el orden aprobado. */
export const FINANCIERA_SECCIONES = [
  'resumen',
  'ingresos',
  'egresos',
  'gastos',
  'facturas',
  'nomina',
  'honorarios',
  'cuentas',
  'proveedores',
  'compras',
  'convenios',
  'presupuesto',
  'ejecucion',
  'evidencias',
  'conexion',
] as const;

export type FinancialSeccionId = (typeof FINANCIERA_SECCIONES)[number];

/** Sección abierta al entrar en el módulo. */
export const FINANCIERA_SECCION_INICIAL: FinancialSeccionId = 'resumen';

/** Entrada del menú secundario. */
export interface FinancialMenuItem {
  readonly id: FinancialSeccionId;
  readonly etiqueta: string;
  readonly icono: HospitalIconName;
}

/** Agrupación del menú secundario. */
export interface FinancialMenuGrupo {
  readonly id: string;
  readonly titulo: string;
  readonly items: readonly FinancialMenuItem[];
}

/**
 * Las seis agrupaciones exactas del apartado 5 de la Task. El orden y el
 * reparto de destinos son vinculantes y no se reinterpretan aquí.
 */
export const FINANCIERA_MENU: readonly FinancialMenuGrupo[] = [
  {
    id: 'vision',
    titulo: 'Visión general',
    items: [{ id: 'resumen', etiqueta: 'Resumen financiero', icono: 'financiera' }],
  },
  {
    id: 'movimientos',
    titulo: 'Movimientos',
    items: [
      { id: 'ingresos', etiqueta: 'Ingresos', icono: 'ingreso' },
      { id: 'egresos', etiqueta: 'Egresos', icono: 'egreso' },
      { id: 'gastos', etiqueta: 'Gastos operativos', icono: 'caja' },
      { id: 'facturas', etiqueta: 'Facturas y recibos', icono: 'membresias' },
    ],
  },
  {
    id: 'personas',
    titulo: 'Personas y pagos',
    items: [
      { id: 'nomina', etiqueta: 'Nómina', icono: 'usuarios' },
      { id: 'honorarios', etiqueta: 'Prestadores / Honorarios', icono: 'credencial' },
      { id: 'cuentas', etiqueta: 'Cuentas de cobro', icono: 'membresias' },
    ],
  },
  {
    id: 'abastecimiento',
    titulo: 'Abastecimiento',
    items: [
      { id: 'proveedores', etiqueta: 'Proveedores', icono: 'edificio' },
      { id: 'compras', etiqueta: 'Compras e insumos', icono: 'caja' },
      { id: 'convenios', etiqueta: 'Convenios', icono: 'acuerdo' },
    ],
  },
  {
    id: 'control',
    titulo: 'Control',
    items: [
      { id: 'presupuesto', etiqueta: 'Presupuesto', icono: 'saldo' },
      { id: 'ejecucion', etiqueta: 'Ejecución financiera', icono: 'reportes' },
      { id: 'evidencias', etiqueta: 'Evidencias', icono: 'alarmas' },
    ],
  },
  {
    id: 'datos',
    titulo: 'Datos',
    items: [{ id: 'conexion', etiqueta: 'Conexión con sistema del Hospital', icono: 'enlace' }],
  },
];

/** Etiqueta visible de cada sección, resuelta desde el menú. */
export const FINANCIERA_ETIQUETA_SECCION: Record<FinancialSeccionId, string> = Object.fromEntries(
  FINANCIERA_MENU.flatMap((grupo) => grupo.items.map((item) => [item.id, item.etiqueta])),
) as Record<FinancialSeccionId, string>;

/** `true` solo para los identificadores de sección del menú aprobado. */
export function esSeccionFinanciera(id: string): id is FinancialSeccionId {
  return (FINANCIERA_SECCIONES as readonly string[]).includes(id);
}

/* ========================================================================== */
/* Procedencia y catálogos transversales de estado                            */
/* ========================================================================== */

/** Etiqueta del origen «Sistema del Hospital». */
export const FINANCIERA_ORIGEN_HOSPITAL = 'Sistema del Hospital';

/** Fuente que administra el registro (apartado 10 de la Task). */
export const FINANCIERA_ORIGENES: readonly string[] = [
  FINANCIERA_ORIGEN_HOSPITAL,
  FINANCIERA_PLATAFORMA,
];

/**
 * Origen de un registro.
 *
 * Solo son válidas las dos etiquetas de `FINANCIERA_ORIGENES`. El contrato se
 * verifica en ejecución sobre todos los fixtures porque la etiqueta de la
 * plataforma se compone desde la configuración de marca y no puede escribirse
 * como literal aquí.
 */
export type FinancialOrigen = string;

/** `true` solo para las dos etiquetas de origen aprobadas. */
export function esOrigenFinanciero(valor: string): boolean {
  return FINANCIERA_ORIGENES.includes(valor);
}

/** Cómo entró el dato. Es una dimensión distinta del origen. */
export const FINANCIERA_METODOS_CAPTURA = [
  'Importación autorizada',
  'Registro manual',
  'Integración',
] as const;

export type FinancialMetodoCaptura = (typeof FINANCIERA_METODOS_CAPTURA)[number];

/** Catálogo transversal de estado de movimiento financiero. */
export const FINANCIERA_ESTADOS_MOVIMIENTO = [
  'Borrador',
  'Pendiente de revisión',
  'Aprobado',
  'Programado',
  'Pagado / Registrado',
  'Rechazado',
  'Anulado',
] as const;

/** Catálogo transversal de estado de sincronización. */
export const FINANCIERA_ESTADOS_SINCRONIZACION = [
  'Local',
  'Importado',
  'Sincronizado',
  'Pendiente',
  'Conflicto',
] as const;

export type FinancialEstadoSincronizacion = (typeof FINANCIERA_ESTADOS_SINCRONIZACION)[number];

/** Catálogo transversal de estado documental de la evidencia. */
export const FINANCIERA_ESTADOS_EVIDENCIA = [
  'Pendiente',
  'Completa',
  'Requiere corrección',
  'Validada',
] as const;

export type FinancialEstadoEvidencia = (typeof FINANCIERA_ESTADOS_EVIDENCIA)[number];

/** Catálogo del flujo visible de la cuenta de cobro. */
export const FINANCIERA_ESTADOS_CUENTA = [
  'Recibida',
  'En revisión',
  'Requiere corrección',
  'Aprobada',
  'Programada',
  'Pagada',
] as const;

/** Estados de la ficha de proveedor. No implican sanción oficial. */
export const FINANCIERA_ESTADOS_PROVEEDOR = [
  'Activo',
  'En revisión',
  'Suspendido',
  'Inactivo',
] as const;

/** Estados de una compra. */
export const FINANCIERA_ESTADOS_COMPRA = [
  'Solicitada',
  'Aprobada',
  'Ordenada',
  'Recibida parcialmente',
  'Recibida',
  'Cancelada',
] as const;

/** Modalidades de vinculación del prestador independiente. */
export const FINANCIERA_MODALIDADES_HONORARIOS = [
  'Por hora',
  'Por consulta',
  'Por servicio',
  'Mensual',
  'Otra',
] as const;

/**
 * Tono de cada etiqueta de estado.
 *
 * El tono es color de énfasis, nunca el medio para conocer el estado: la
 * pastilla siempre escribe su texto. Un estado ausente de este mapa se dibuja
 * en el tono neutro.
 */
export const FINANCIERA_TONO_ESTADO: Readonly<Record<string, HospitalTonoId>> = {
  /* Movimiento. */
  Borrador: 'azul',
  'Pendiente de revisión': 'amarillo',
  Aprobado: 'verde',
  Programado: 'petroleo',
  'Pagado / Registrado': 'verde',
  Rechazado: 'rojo',
  Anulado: 'rojo',
  /* Sincronización. */
  Local: 'azul',
  Importado: 'petroleo',
  Sincronizado: 'verde',
  Pendiente: 'amarillo',
  Conflicto: 'rojo',
  /* Evidencia. */
  Completa: 'petroleo',
  'Requiere corrección': 'rojo',
  Validada: 'verde',
  /* Cuenta de cobro. */
  Recibida: 'azul',
  'En revisión': 'amarillo',
  Aprobada: 'verde',
  Programada: 'petroleo',
  Pagada: 'verde',
  /* Proveedor. */
  Activo: 'verde',
  Suspendido: 'rojo',
  Inactivo: 'azul',
  /* Compra. */
  Solicitada: 'azul',
  Ordenada: 'petroleo',
  'Recibida parcialmente': 'amarillo',
  Cancelada: 'rojo',
};

/** Tono de una etiqueta de estado; `azul` cuando el catálogo no la nombra. */
export function tonoDeEstado(estado: string): HospitalTonoId {
  return FINANCIERA_TONO_ESTADO[estado] ?? 'azul';
}

/**
 * Procedencia completa de un registro (apartado 11 de la Task).
 *
 * Fuente maestra, origen, sistema fuente, identificador externo, método de
 * captura, versión de mapeo, última sincronización y estado de sincronización
 * son dimensiones separadas y se conservan aunque el registro se corrija.
 */
export interface FinancialProcedencia {
  readonly origen: FinancialOrigen;
  readonly fuenteMaestra: FinancialOrigen;
  readonly metodo: FinancialMetodoCaptura;
  readonly sistemaFuente: string;
  /** Identificador en el sistema externo. `null` cuando el registro es propio. */
  readonly idExterno: string | null;
  readonly institucionFuente: string;
  readonly versionRegistroExterno: string;
  readonly sincronizacion: FinancialEstadoSincronizacion;
  /** Fecha textual de la última sincronización, o `Nunca`. */
  readonly ultimaSincronizacion: string;
  readonly loteOEjecucion: string;
  readonly versionMapeo: string;
  /** Momento al que se refiere el dato, separado del momento de ingreso. */
  readonly observadoEn: string;
  readonly ingestadoEn: string;
}

/* ========================================================================== */
/* Filas, columnas y detalle                                                  */
/* ========================================================================== */

/** Columna de una tabla financiera. Las secundarias se ocultan en pantallas estrechas. */
export interface FinancialColumna {
  readonly id: string;
  readonly etiqueta: string;
  /** `true` cuando la columna puede ocultarse progresivamente. */
  readonly secundaria?: boolean;
  /** `true` para importes, que se alinean a la derecha. */
  readonly numerica?: boolean;
}

/** Celda de una fila. El estado y el origen se dibujan como pastilla. */
export type FinancialCelda =
  | { readonly tipo: 'texto'; readonly valor: string }
  | { readonly tipo: 'importe'; readonly valor: string }
  | { readonly tipo: 'estado'; readonly valor: string }
  | { readonly tipo: 'origen'; readonly valor: FinancialOrigen };

/** Par etiqueta/valor de un detalle. */
export interface FinancialCampo {
  readonly etiqueta: string;
  readonly valor: string;
}

/** Evidencia vinculada a un registro. Nunca se sobrescribe: se versiona. */
export interface FinancialEvidencia {
  readonly id: string;
  readonly titulo: string;
  readonly tipo: string;
  readonly version: string;
  readonly estado: FinancialEstadoEvidencia;
  readonly cargadaPor: string;
  readonly cargadaEn: string;
  readonly revisadaPor: string;
  readonly referencia: string;
}

/** Entrada del historial conceptual de un registro. */
export interface FinancialHistorialEntrada {
  readonly id: string;
  readonly fecha: string;
  readonly actor: string;
  readonly accion: string;
  readonly detalle: string;
}

/** Movimiento relacionado que compone una cifra o una ficha. */
export interface FinancialMovimientoVinculado {
  readonly id: string;
  readonly fecha: string;
  readonly concepto: string;
  readonly valor: string;
  readonly estado: string;
  readonly origen: FinancialOrigen;
}

/** Subpestañas del panel de detalle. */
export const FINANCIERA_PESTANAS_DETALLE = [
  'Resumen',
  'Movimientos',
  'Evidencias',
  'Historial',
] as const;

export type FinancialPestanaDetalle = (typeof FINANCIERA_PESTANAS_DETALLE)[number];

/** Contenido del panel lateral de consulta rápida. */
export interface FinancialDetalle {
  readonly titulo: string;
  readonly subtitulo: string;
  readonly campos: readonly FinancialCampo[];
  readonly procedencia: FinancialProcedencia;
  readonly movimientos: readonly FinancialMovimientoVinculado[];
  readonly evidencias: readonly FinancialEvidencia[];
  readonly historial: readonly FinancialHistorialEntrada[];
  /** Acciones exclusivamente visuales; ninguna muta, envía ni simula éxito. */
  readonly acciones: readonly string[];
  /** Aviso de alcance propio del registro, cuando lo necesita. */
  readonly aviso?: string;
}

/** Bandejas del listado. `Todos` es implícita y no se declara en la fila. */
export const FINANCIERA_BANDEJAS = ['Todos', 'Pendientes', 'Con observaciones'] as const;

export type FinancialBandeja = (typeof FINANCIERA_BANDEJAS)[number];

/** Fila de un listado financiero, con sus dimensiones filtrables. */
export interface FinancialFila {
  readonly id: string;
  readonly celdas: readonly FinancialCelda[];
  /** Texto sobre el que actúa el buscador de la sección. */
  readonly busqueda: string;
  readonly periodo: string;
  readonly programa: string;
  readonly estado: string;
  readonly origen: FinancialOrigen;
  readonly entidad: string;
  readonly categoria: string;
  readonly evidencia: FinancialEstadoEvidencia;
  /** Bandejas distintas de `Todos` a las que pertenece la fila. */
  readonly bandejas: readonly FinancialBandeja[];
  readonly detalle: FinancialDetalle;
}

/* ========================================================================== */
/* Filtros locales                                                            */
/* ========================================================================== */

/** Dimensiones filtrables declaradas por el apartado 8 de la Task. */
export const FINANCIERA_FILTROS = [
  'periodo',
  'programa',
  'estado',
  'origen',
  'entidad',
  'categoria',
  'evidencia',
] as const;

export type FinancialFiltroId = (typeof FINANCIERA_FILTROS)[number];

/** Valor que significa «sin recorte» en cualquier filtro. */
export const FINANCIERA_TODOS = 'Todos';

/** Filtros visibles en la barra de contexto; el resto vive en `Más filtros`. */
export const FINANCIERA_FILTROS_PRINCIPALES: readonly FinancialFiltroId[] = [
  'periodo',
  'programa',
  'origen',
];

/** Etiqueta visible de cada filtro. */
export const FINANCIERA_ETIQUETA_FILTRO: Record<FinancialFiltroId, string> = {
  periodo: 'Periodo',
  programa: 'Programa',
  estado: 'Estado',
  origen: 'Origen',
  entidad: 'Entidad o proveedor',
  categoria: 'Categoría',
  evidencia: 'Evidencia',
};

/** Estado de los filtros de una sección. */
export type FinancialFiltros = Readonly<Record<FinancialFiltroId, string>> & {
  readonly texto: string;
};

/** Filtros sin ningún recorte aplicado. */
export const FINANCIERA_FILTROS_VACIOS: FinancialFiltros = {
  texto: '',
  periodo: FINANCIERA_TODOS,
  programa: FINANCIERA_TODOS,
  estado: FINANCIERA_TODOS,
  origen: FINANCIERA_TODOS,
  entidad: FINANCIERA_TODOS,
  categoria: FINANCIERA_TODOS,
  evidencia: FINANCIERA_TODOS,
};

/** Filtros con los valores indicados sobre el estado sin recorte. */
export function filtrosCon(preset: Partial<FinancialFiltros> = {}): FinancialFiltros {
  return { ...FINANCIERA_FILTROS_VACIOS, ...preset };
}

/** Valor de una fila para una dimensión de filtro. */
function valorDeFila(fila: FinancialFila, filtro: FinancialFiltroId): string {
  switch (filtro) {
    case 'periodo':
      return fila.periodo;
    case 'programa':
      return fila.programa;
    case 'estado':
      return fila.estado;
    case 'origen':
      return fila.origen;
    case 'entidad':
      return fila.entidad;
    case 'categoria':
      return fila.categoria;
    case 'evidencia':
    default:
      return fila.evidencia;
  }
}

/** Opciones de un filtro, derivadas de las filas visibles de la sección. */
export function opcionesDeFiltro(
  filas: readonly FinancialFila[],
  filtro: FinancialFiltroId,
): readonly string[] {
  const valores = [...new Set(filas.map((fila) => valorDeFila(fila, filtro)))].sort((a, b) =>
    a.localeCompare(b, 'es-CO'),
  );

  return [FINANCIERA_TODOS, ...valores];
}

/** Normaliza texto para que el buscador ignore mayúsculas y tildes. */
function normalizar(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('es-CO')
    .trim();
}

/** Chip de filtro activo, con el nombre de su dimensión para poder retirarlo. */
export interface FinancialChipActivo {
  readonly filtro: FinancialFiltroId | 'texto';
  readonly etiqueta: string;
}

/** Chips de los recortes aplicados; vacío cuando no hay ninguno. */
export function chipsActivos(
  filtros: FinancialFiltros,
  disponibles: readonly FinancialFiltroId[],
): readonly FinancialChipActivo[] {
  const texto: readonly FinancialChipActivo[] =
    filtros.texto.trim() === ''
      ? []
      : [{ filtro: 'texto', etiqueta: `Búsqueda: ${filtros.texto.trim()}` }];

  return [
    ...texto,
    ...disponibles
      .filter((filtro) => filtros[filtro] !== FINANCIERA_TODOS)
      .map((filtro) => ({
        filtro,
        etiqueta: `${FINANCIERA_ETIQUETA_FILTRO[filtro]}: ${filtros[filtro]}`,
      })),
  ];
}

/**
 * Filtros con un valor distinto en una dimensión.
 *
 * La asignación es explícita por dimensión para que el contrato quede
 * comprobado por el tipado y no dependa de una clave calculada.
 */
export function conFiltro(
  filtros: FinancialFiltros,
  filtro: FinancialFiltroId | 'texto',
  valor: string,
): FinancialFiltros {
  switch (filtro) {
    case 'texto':
      return { ...filtros, texto: valor };
    case 'periodo':
      return { ...filtros, periodo: valor };
    case 'programa':
      return { ...filtros, programa: valor };
    case 'estado':
      return { ...filtros, estado: valor };
    case 'origen':
      return { ...filtros, origen: valor };
    case 'entidad':
      return { ...filtros, entidad: valor };
    case 'categoria':
      return { ...filtros, categoria: valor };
    case 'evidencia':
    default:
      return { ...filtros, evidencia: valor };
  }
}

/** Filtros sin el recorte indicado. */
export function sinFiltro(
  filtros: FinancialFiltros,
  filtro: FinancialFiltroId | 'texto',
): FinancialFiltros {
  return conFiltro(filtros, filtro, filtro === 'texto' ? '' : FINANCIERA_TODOS);
}

/**
 * Recorte local de filas.
 *
 * Es aritmética de presentación sobre fixtures en memoria: no consulta nada,
 * no ordena por relevancia, no puntúa y no deriva cifras nuevas. Solo se
 * aplican las dimensiones que la sección declara disponibles.
 */
export function filtrarFilas(
  filas: readonly FinancialFila[],
  filtros: FinancialFiltros,
  disponibles: readonly FinancialFiltroId[],
  bandeja: FinancialBandeja = 'Todos',
): readonly FinancialFila[] {
  const consulta = normalizar(filtros.texto);

  return filas.filter((fila) => {
    if (bandeja !== 'Todos' && !fila.bandejas.includes(bandeja)) {
      return false;
    }

    if (consulta !== '' && !normalizar(fila.busqueda).includes(consulta)) {
      return false;
    }

    return disponibles.every((filtro) => {
      const seleccionado = filtros[filtro];

      return seleccionado === FINANCIERA_TODOS || valorDeFila(fila, filtro) === seleccionado;
    });
  });
}
