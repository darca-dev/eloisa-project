import {
  FINANCIERA_PLATAFORMA,
  type FinancialBandeja,
  type FinancialCelda,
  type FinancialCampo,
  type FinancialEstadoEvidencia,
  type FinancialEvidencia,
  type FinancialFila,
  type FinancialHistorialEntrada,
  type FinancialMovimientoVinculado,
  type FinancialOrigen,
  type FinancialProcedencia,
} from './hospitalFinancialConfig';

/**
 * Vocabulario y constructores de los fixtures de «Gestión financiera»
 * (TASK-003H-06).
 *
 * Todos los datos del módulo son ficticios, deterministas y están rotulados
 * como demostración. No proceden de ninguna institución, persona, contrato,
 * factura, nómina ni sistema real, y no se derivan de datos productivos.
 *
 * Los constructores solo componen objetos en memoria: no calculan importes, no
 * suman, no derivan porcentajes, no aplican reglas contables, laborales ni
 * tributarias y no leen la fecha del sistema. Cada cifra visible está escrita
 * literalmente en el fixture que la declara.
 */

/* ========================================================================== */
/* Vocabulario compartido                                                     */
/* ========================================================================== */

/** Programas ficticios administrados en la demostración. */
export const PROGRAMAS = {
  domiciliaria: 'Atención domiciliaria',
  cuidadores: 'Formación de cuidadores',
  telesalud: 'Telesalud',
  convenio: 'Convenio municipal',
} as const;

/** Periodos ficticios de la demostración. */
export const PERIODOS = {
  junio: 'Junio 2026',
  julio: 'Julio 2026',
  agosto: 'Agosto 2026',
} as const;

/** Origen «Sistema del Hospital». */
export const HOSPITAL: FinancialOrigen = 'Sistema del Hospital';

/** Origen del producto, compuesto desde la única fuente de marca visible. */
export const PLATAFORMA: FinancialOrigen = FINANCIERA_PLATAFORMA;

/** Nombre ficticio del sistema externo configurado en la demostración. */
export const SISTEMA_EXTERNO = 'Sistema administrativo del Hospital (ficticio)';

/** Institución ficticia propietaria de los registros externos. */
export const INSTITUCION_FUENTE = 'Hospital Municipal de demostración';

/* ========================================================================== */
/* Constructores                                                              */
/* ========================================================================== */

/**
 * Procedencia de un registro.
 *
 * Origen, fuente maestra y método de captura son dimensiones separadas: el
 * constructor propone el valor habitual de cada origen y cada fixture lo
 * ajusta cuando el caso lo exige (registros mixtos, importaciones antiguas o
 * conflictos). La procedencia nunca se elimina al corregir un registro.
 */
export function procedencia(
  origen: FinancialOrigen,
  ajustes: Partial<FinancialProcedencia> = {},
): FinancialProcedencia {
  const externo = origen === HOSPITAL;

  return {
    origen,
    fuenteMaestra: origen,
    metodo: externo ? 'Importación autorizada' : 'Registro manual',
    sistemaFuente: externo ? SISTEMA_EXTERNO : FINANCIERA_PLATAFORMA,
    idExterno: null,
    institucionFuente: INSTITUCION_FUENTE,
    versionRegistroExterno: externo ? 'v3' : 'No aplica',
    sincronizacion: externo ? 'Importado' : 'Local',
    ultimaSincronizacion: externo ? '12 ago 2026 · 06:15' : 'Nunca',
    loteOEjecucion: externo ? 'Lote demostrativo LOTE-2026-08-12' : 'No aplica',
    versionMapeo: externo ? 'Mapeo demostrativo v1' : 'No aplica',
    observadoEn: '—',
    ingestadoEn: '—',
    ...ajustes,
  };
}

/** Evidencia vinculada. Una versión nueva conserva la anterior. */
export function evidencia(
  id: string,
  titulo: string,
  tipo: string,
  estado: FinancialEstadoEvidencia,
  ajustes: Partial<FinancialEvidencia> = {},
): FinancialEvidencia {
  return {
    id,
    titulo,
    tipo,
    version: 'v1',
    estado,
    cargadaPor: 'Analista financiera (perfil demostrativo)',
    cargadaEn: '12 ago 2026',
    revisadaPor: 'Sin revisión registrada',
    referencia: `Referencia opaca ${id}`,
    ...ajustes,
  };
}

/** Entrada del historial conceptual de un registro. */
export function hito(
  id: string,
  fecha: string,
  actor: string,
  accion: string,
  detalle: string,
): FinancialHistorialEntrada {
  return { id, fecha, actor, accion, detalle };
}

/** Movimiento relacionado con un registro o con una cifra agregada. */
export function movimiento(
  id: string,
  fecha: string,
  concepto: string,
  valor: string,
  estado: string,
  origen: FinancialOrigen,
): FinancialMovimientoVinculado {
  return { id, fecha, concepto, valor, estado, origen };
}

/** Celda de texto. */
export function txt(valor: string): FinancialCelda {
  return { tipo: 'texto', valor };
}

/** Celda de importe. El valor ya incluye la moneda escrita en el fixture. */
export function imp(valor: string): FinancialCelda {
  return { tipo: 'importe', valor };
}

/** Celda de estado. Siempre se dibuja con su texto, nunca solo con color. */
export function est(valor: string): FinancialCelda {
  return { tipo: 'estado', valor };
}

/** Celda de origen. */
export function org(valor: FinancialOrigen): FinancialCelda {
  return { tipo: 'origen', valor };
}

/** Par etiqueta/valor de un detalle. */
export function campo(etiqueta: string, valor: string): FinancialCampo {
  return { etiqueta, valor };
}

/** Entrada compacta de un fixture de fila, antes de completarse. */
export interface EntradaFila {
  readonly id: string;
  readonly celdas: readonly FinancialCelda[];
  readonly busqueda: string;
  readonly periodo: string;
  readonly programa: string;
  readonly estado: string;
  readonly origen: FinancialOrigen;
  readonly entidad: string;
  readonly categoria: string;
  readonly evidencia: FinancialEstadoEvidencia;
  readonly bandejas?: readonly FinancialBandeja[];
  readonly titulo: string;
  readonly subtitulo: string;
  readonly campos: readonly FinancialCampo[];
  readonly procedencia?: Partial<FinancialProcedencia>;
  readonly movimientos?: readonly FinancialMovimientoVinculado[];
  readonly evidencias?: readonly FinancialEvidencia[];
  readonly historial?: readonly FinancialHistorialEntrada[];
  readonly acciones?: readonly string[];
  readonly aviso?: string;
}

/**
 * Acciones exclusivamente visuales que acompañan a un detalle.
 *
 * Se muestran siempre deshabilitadas y con su estado escrito al lado: ninguna
 * revisa, aprueba, programa, paga, adjunta, exporta ni sincroniza nada.
 */
export const ACCIONES_CONSULTA: readonly string[] = [
  'Revisar',
  'Adjuntar evidencia',
  'Exportar detalle',
];

/** Compone la fila completa a partir de su entrada compacta. */
export function fila(entrada: EntradaFila): FinancialFila {
  return {
    id: entrada.id,
    celdas: entrada.celdas,
    busqueda: entrada.busqueda,
    periodo: entrada.periodo,
    programa: entrada.programa,
    estado: entrada.estado,
    origen: entrada.origen,
    entidad: entrada.entidad,
    categoria: entrada.categoria,
    evidencia: entrada.evidencia,
    bandejas: entrada.bandejas ?? [],
    detalle: {
      titulo: entrada.titulo,
      subtitulo: entrada.subtitulo,
      campos: entrada.campos,
      procedencia: procedencia(entrada.origen, entrada.procedencia),
      movimientos: entrada.movimientos ?? [],
      evidencias: entrada.evidencias ?? [],
      historial: entrada.historial ?? [],
      acciones: entrada.acciones ?? ACCIONES_CONSULTA,
      aviso: entrada.aviso,
    },
  };
}
