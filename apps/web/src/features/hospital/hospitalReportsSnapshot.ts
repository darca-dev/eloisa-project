import {
  POBLACION_FILTROS_VACIOS,
  esMayorDe60,
  filtrarPacientes,
  formatearNumero,
  requiereCuidadosEnCasa,
  snapshotDePoblacion,
  textoPorcentaje,
  tieneDiscapacidad,
  universoDe,
} from './hospitalPopulationAnalytics';
import {
  POBLACION_FECHA_CORTE,
  POBLACION_TENANT_DEMO,
  pacientesPoblacionDemo,
} from './hospitalPopulationFixtures';
import {
  POBLACION_VERSION_DEFINICION,
  type PoblacionFiltros,
  type PoblacionPaciente,
  type PopulationAnalyticsSnapshotV1,
} from './hospitalPopulationTypes';
import { normalizarFiltros } from './hospitalReportsConfig';
import { snapshotFinanciero, montoDe, textoMonto } from './hospitalReportsFinancial';
import { snapshotInstitucional } from './hospitalReportsInstitutional';
import {
  esRealizada,
  filtrarEventos,
  pacientesAtendidos,
  recorteDe,
  snapshotOperativo,
} from './hospitalReportsOperational';
import {
  OPERACION_CALCULATED_AT,
  OPERACION_FECHA_CORTE,
  OPERACION_PERIODOS,
  OPERACION_PROCEDENCIA,
  alarmasOperativasDemo,
  eventosOperativosDemo,
  vinculacionesDemo,
  type OperacionVinculacion,
} from './hospitalReportsOperationalFixtures';
import {
  OPERACION_VERSION_DEFINICION,
  REPORTE_NO_CALCULABLE,
  REPORTE_SIN_DATOS,
  REPORTE_VERSION_DEFINICION,
  FINANZAS_VERSION_DEFINICION,
  INSTITUCIONAL_VERSION_DEFINICION,
  type FinancialAnalyticsSnapshotV1,
  type InstitutionalEvidenceSnapshotV1,
  type OperacionAlarma,
  type OperacionEvento,
  type OperationalAnalyticsSnapshotV1,
  type ReporteAudienciaId,
  type ReporteCifra,
  type ReporteFila,
  type ReporteFiltros,
  type ReporteGrafico,
  type ReporteIndicador,
  type ReporteTabla,
  type ReportSnapshotV1,
} from './hospitalReportsTypes';

/**
 * Compositor de `ReportSnapshotV1` (TASK-003H-07, §4).
 *
 * Une los cuatro snapshots versionados en un único reporte y compone con ellos
 * el tab `Resumen` y el bloque de población y recursos. No declara ningún total
 * propio: cada cifra procede del snapshot que la define y conserva su
 * definición, su versión, su unidad, su periodo, su procedencia y sus
 * limitaciones.
 *
 * Población procede ÍNTEGRAMENTE de H-03B: este módulo traduce los filtros de
 * la barra global a los filtros de `PoblacionFiltros` y llama a
 * `filtrarPacientes` y `snapshotDePoblacion`. Para los mismos filtros, la misma
 * fecha de corte y la misma versión, el resultado es idéntico al de Pacientes,
 * incluidas las ocho intersecciones.
 *
 * Los filtros se aplican SIEMPRE antes de agregar, y las personas se
 * deduplican por su identificador dentro del contexto y del periodo.
 *
 * `Población beneficiaria` y `Paciente activo` no son sinónimos: la primera se
 * deriva de las vinculaciones a programa registradas en el periodo y la segunda
 * del universo activo de H-03B. Una cita jamás convierte a alguien en
 * beneficiario ni en atendido.
 *
 * Los indicadores de población y recursos son descriptivos: no demuestran
 * causalidad ni resultado clínico, y un denominador cero, ausente o sin
 * metodología produce `No calculable`, nunca cero.
 */

/* ========================================================================== */
/* Traducción de filtros a población                                          */
/* ========================================================================== */

/**
 * Filtros de población equivalentes a los de la barra global.
 *
 * Solo se trasladan los criterios que H-03B ya define: programa, municipio,
 * EPS y las tres condiciones prioritarias. Periodo y modalidad no recortan el
 * padrón: describen la actividad operativa, no la pertenencia a la población.
 */
export function filtrosDePoblacion(filtros: ReporteFiltros): PoblacionFiltros {
  const normalizados = normalizarFiltros(filtros);

  return {
    ...POBLACION_FILTROS_VACIOS,
    eps: normalizados.eps ?? '',
    programa: normalizados.programa ?? '',
    municipio: normalizados.municipio ?? '',
    rapidos: { ...normalizados.prioridades },
  };
}

/** Personas del padrón que satisfacen los filtros, activas o no. */
export function padronFiltrado(
  pacientes: readonly PoblacionPaciente[],
  filtros: ReporteFiltros,
  corte: string = POBLACION_FECHA_CORTE,
): readonly PoblacionPaciente[] {
  return filtrarPacientes(pacientes, filtrosDePoblacion(filtros), corte);
}

/** Universo activo filtrado; es exactamente el conjunto que analiza H-03B. */
export function universoFiltrado(
  pacientes: readonly PoblacionPaciente[],
  filtros: ReporteFiltros,
  corte: string = POBLACION_FECHA_CORTE,
): readonly PoblacionPaciente[] {
  return filtrarPacientes(universoDe(pacientes), filtrosDePoblacion(filtros), corte);
}

/* ========================================================================== */
/* Población beneficiaria                                                     */
/* ========================================================================== */

/**
 * Identificadores únicos con al menos una vinculación a programa registrada en
 * el periodo (§3.3).
 *
 * Es un conjunto DISTINTO del de pacientes activos: se declara en el fixture y
 * no se deriva de citas, visitas ni consultas.
 *
 * El contexto institucional se exige ANTES de deduplicar: `pacienteId` es
 * identidad estable dentro de un contexto, de modo que descartar primero las
 * vinculaciones de otros contextos evita que dos personas distintas colapsen
 * en una sola o que una vinculación ajena cuente como beneficiaria.
 */
export function beneficiariosDe(
  vinculaciones: readonly OperacionVinculacion[],
  periodo: string,
  admitidos: ReadonlySet<string>,
  programa: string | null,
  tenantId: string,
): ReadonlySet<string> {
  const unicos = new Set<string>();

  for (const vinculacion of vinculaciones) {
    if (vinculacion.tenantId !== tenantId) {
      continue;
    }
    if (vinculacion.periodo !== periodo || !admitidos.has(vinculacion.pacienteId)) {
      continue;
    }
    if (programa !== null && vinculacion.programa !== programa) {
      continue;
    }

    unicos.add(vinculacion.pacienteId);
  }

  return unicos;
}

/** Beneficiarios únicos por periodo, para la evolución de §3.6. */
function evolucionBeneficiarios(
  vinculaciones: readonly OperacionVinculacion[],
  admitidos: ReadonlySet<string>,
  programa: string | null,
  tenantId: string,
): ReporteGrafico {
  return {
    id: 'evolucion-beneficiarios',
    titulo: 'Evolución de beneficiarios únicos',
    unidad: 'Personas',
    periodo: `${OPERACION_PERIODOS[0] ?? ''} a ${OPERACION_PERIODOS[OPERACION_PERIODOS.length - 1] ?? ''}`,
    nota: 'Personas únicas con vinculación a programa registrada en cada periodo. Los periodos son equivalentes y las personas se deduplican dentro de cada uno; los valores de periodos distintos no se suman.',
    procedencia: OPERACION_PROCEDENCIA,
    estado: 'disponible',
    series: [
      {
        id: 'beneficiarios',
        etiqueta: 'Beneficiarios únicos',
        puntos: OPERACION_PERIODOS.map((periodo) => {
          const valor = beneficiariosDe(
            vinculaciones,
            periodo,
            admitidos,
            programa,
            tenantId,
          ).size;

          return {
            id: `beneficiarios-${periodo}`,
            etiqueta: periodo,
            valor,
            texto: `${formatearNumero(valor)} personas`,
          };
        }),
      },
    ],
    encabezado: 'Periodo',
  };
}

/* ========================================================================== */
/* Cifras compuestas                                                          */
/* ========================================================================== */

/** Cifra compuesta a partir de snapshots ya calculados. */
function cifra(
  id: string,
  etiqueta: string,
  valor: string,
  unidad: string,
  periodo: string,
  procedencia: string,
  definicion: string,
  version: string,
  limitaciones: string,
  estado: ReporteCifra['estado'] = 'disponible',
): ReporteCifra {
  return {
    id,
    etiqueta,
    valor,
    unidad,
    periodo,
    procedencia,
    clase: 'DEMOSTRATIVO',
    estado,
    definicion,
    version,
    limitaciones,
  };
}

const LIMITACION_POBLACION =
  'Conjunto poblacional demostrativo. No procede de ninguna fuente oficial, de ninguna EPS ni de ninguna historia clínica.';

/**
 * KPI del tab Población (§3.3).
 *
 * Los seis primeros proceden literalmente de `PopulationAnalyticsSnapshotV1`;
 * `Población beneficiaria` procede de las vinculaciones registradas, y
 * `con cuidador` y `con profesional` se leen de las distribuciones que el mismo
 * snapshot ya publica. Ninguno se recalcula aquí.
 */
export function kpiPoblacionDe(
  snapshot: PopulationAnalyticsSnapshotV1,
  beneficiarios: number,
  periodo: string,
): readonly ReporteCifra[] {
  const universo = snapshot.universo;
  const celda = (distribucion: string, id: string): number => {
    const grupo = snapshot.distribuciones.find((item) => item.id === distribucion);

    return grupo?.celdas.find((item) => item.id === id)?.valor ?? 0;
  };
  const desde = (id: string, etiqueta: string, definicion: string): ReporteCifra => {
    const kpi = snapshot.kpi.find((item) => item.id === id);

    return cifra(
      `poblacion-${id}`,
      etiqueta,
      kpi === undefined ? REPORTE_SIN_DATOS : formatearNumero(kpi.valor),
      'Personas',
      periodo,
      snapshot.procedencia.origen,
      `${definicion} Universo: ${formatearNumero(universo)} pacientes activos filtrados. Fecha de corte: ${snapshot.fechaCorte}. Porcentaje sobre el universo: ${textoPorcentaje(kpi?.porcentaje ?? null)}.`,
      snapshot.version,
      LIMITACION_POBLACION,
      kpi === undefined ? 'ausente' : 'disponible',
    );
  };

  return [
    cifra(
      'poblacion-beneficiaria',
      'Población beneficiaria',
      formatearNumero(beneficiarios),
      'Personas',
      periodo,
      OPERACION_PROCEDENCIA,
      `Personas únicas con al menos una vinculación a programa registrada en el periodo ${periodo}. No es sinónimo de paciente activo y no se deriva de citas: una cita programada no convierte a nadie en beneficiario.`,
      OPERACION_VERSION_DEFINICION,
      LIMITACION_POBLACION,
    ),
    desde(
      'activePatients',
      'Pacientes activos',
      'Personas únicas con participación activa en el contexto institucional a la fecha de corte.',
    ),
    desde('age60Plus', 'Mayores de 60', 'Edad derivada de la fecha de nacimiento a la fecha de corte.'),
    desde('withDisability', 'Con discapacidad', 'Clasificación de discapacidad registrada y activa.'),
    desde('homeCareRequired', 'Cuidados en casa', 'Clasificación de cuidados en casa registrada y activa.'),
    cifra(
      'poblacion-cuidador',
      'Con cuidador / sin cuidador',
      `${formatearNumero(celda('cuidador', 'con-cuidador'))} / ${formatearNumero(celda('cuidador', 'sin-cuidador'))}`,
      'Personas',
      periodo,
      snapshot.procedencia.origen,
      `Relación paciente-cuidador activa y vigente. Las dos celdas suman el universo de ${formatearNumero(universo)} pacientes activos. Fecha de corte: ${snapshot.fechaCorte}.`,
      snapshot.version,
      LIMITACION_POBLACION,
    ),
    cifra(
      'poblacion-profesional',
      'Con profesional / sin profesional',
      `${formatearNumero(celda('profesional', 'con-profesional'))} / ${formatearNumero(celda('profesional', 'sin-profesional'))}`,
      'Personas',
      periodo,
      snapshot.procedencia.origen,
      `Asignación principal activa y vigente. Las dos celdas suman el universo de ${formatearNumero(universo)} pacientes activos. Fecha de corte: ${snapshot.fechaCorte}.`,
      snapshot.version,
      LIMITACION_POBLACION,
    ),
  ];
}

/** Los seis KPI del tab Resumen, en el orden vinculante (§3.2). */
function kpiResumen(
  poblacion: PopulationAnalyticsSnapshotV1,
  operacion: OperationalAnalyticsSnapshotV1,
  finanzas: FinancialAnalyticsSnapshotV1,
  institucional: InstitutionalEvidenceSnapshotV1,
  eventos: readonly OperacionEvento[],
  beneficiarios: number,
  periodo: string,
): readonly ReporteCifra[] {
  const realizadas = eventos.filter((evento) => esRealizada(evento)).length;
  const pendientes = eventos.filter((evento) => evento.estado === 'Pendiente').length;
  const ejecucion = finanzas.kpi.find((item) => item.id === 'kpi-ejecucion');
  const evidenciasPendientes = institucional.evidencias.filter(
    (item) => item.estado === 'Pendiente',
  ).length;

  return [
    cifra(
      'resumen-beneficiaria',
      'Población beneficiaria',
      formatearNumero(beneficiarios),
      'Personas',
      periodo,
      OPERACION_PROCEDENCIA,
      `Personas únicas con vinculación a programa registrada en el periodo ${periodo}. No es sinónimo de paciente activo.`,
      OPERACION_VERSION_DEFINICION,
      LIMITACION_POBLACION,
    ),
    cifra(
      'resumen-activos',
      'Pacientes activos',
      formatearNumero(poblacion.universo),
      'Personas',
      periodo,
      poblacion.procedencia.origen,
      `Universo activo filtrado a la fecha de corte ${poblacion.fechaCorte}, deduplicado por identificador de paciente.`,
      poblacion.version,
      LIMITACION_POBLACION,
    ),
    cifra(
      'resumen-atenciones',
      'Atenciones realizadas',
      formatearNumero(realizadas),
      'Prestaciones',
      periodo,
      operacion.procedencia,
      'Eventos operativos con estado final aprobado «Realizada» en el periodo. Una cita programada no cuenta como atención.',
      operacion.version,
      operacion.limitaciones,
    ),
    cifra(
      'resumen-pendientes',
      'Pendientes operativos',
      formatearNumero(pendientes),
      'Eventos',
      periodo,
      operacion.procedencia,
      'Eventos operativos cuyo estado al corte es «Pendiente». Organizan trabajo por hacer; no describen riesgo clínico.',
      operacion.version,
      operacion.limitaciones,
    ),
    cifra(
      'resumen-ejecucion',
      'Ejecución financiera %',
      ejecucion?.valor ?? REPORTE_SIN_DATOS,
      'Porcentaje',
      periodo,
      ejecucion?.procedencia ?? 'Gestión financiera',
      ejecucion?.definicion ??
        `Gestión financiera no publica el porcentaje de ejecución para el periodo ${periodo}. Ausente no es cero.`,
      finanzas.version,
      finanzas.limitaciones,
      ejecucion?.estado ?? 'ausente',
    ),
    cifra(
      'resumen-evidencias',
      'Evidencias pendientes',
      formatearNumero(evidenciasPendientes),
      'Evidencias',
      periodo,
      institucional.procedencia,
      'Evidencias del periodo cuyo estado documental es «Pendiente». El estado documental no acredita cumplimiento.',
      institucional.version,
      institucional.limitaciones,
    ),
  ];
}

/* ========================================================================== */
/* Población y recursos                                                       */
/* ========================================================================== */

const METODOLOGIA_DESCRIPTIVA =
  'Cociente descriptivo entre una cifra financiera del periodo y un conteo de personas del mismo periodo. No mide eficiencia, no compara instituciones y no demuestra causalidad ni resultado clínico.';

/** Indicador con numerador y denominador; sin ellos escribe `No calculable`. */
function indicador(
  id: string,
  etiqueta: string,
  numerador: number | null,
  denominador: number | null,
  numeradorTexto: string,
  denominadorTexto: string,
  unidad: string,
  periodo: string,
  procedencia: string,
  metodologia: string = METODOLOGIA_DESCRIPTIVA,
): ReporteIndicador {
  const calculable = numerador !== null && denominador !== null && denominador !== 0;

  return {
    id,
    etiqueta,
    numerador,
    denominador,
    numeradorTexto,
    denominadorTexto,
    unidad,
    periodo,
    version: REPORTE_VERSION_DEFINICION,
    metodologia,
    procedencia,
    valor: calculable
      ? `${formatearNumero(Math.round((numerador as number) / (denominador as number)))} ${unidad}`
      : REPORTE_NO_CALCULABLE,
    estado: calculable ? 'disponible' : 'no-calculable',
  };
}

/** Ejecutado consolidado del periodo, leído del snapshot financiero. */
function ejecutadoDe(finanzas: FinancialAnalyticsSnapshotV1): number | null {
  const kpi = finanzas.kpi.find((item) => item.id === 'kpi-ejecutado');

  return kpi === undefined || kpi.estado === 'ausente' ? null : montoDe(kpi.valor);
}

/** Indicadores descriptivos de población y recursos (§3.6). */
function indicadoresRecursos(
  finanzas: FinancialAnalyticsSnapshotV1,
  atendidos: number,
  beneficiarios: number,
  periodo: string,
): readonly ReporteIndicador[] {
  const ejecutado = ejecutadoDe(finanzas);
  const textoEjecutado = ejecutado === null ? REPORTE_SIN_DATOS : textoMonto(ejecutado);

  return [
    indicador(
      'gasto-por-atendido',
      'Ejecución frente a población atendida',
      ejecutado,
      atendidos,
      textoEjecutado,
      `${formatearNumero(atendidos)} pacientes únicos atendidos`,
      'COP por paciente atendido',
      periodo,
      `${finanzas.procedencia}; ${OPERACION_PROCEDENCIA}`,
    ),
    indicador(
      'gasto-por-beneficiario',
      'Ejecución frente a población beneficiaria',
      ejecutado,
      beneficiarios,
      textoEjecutado,
      `${formatearNumero(beneficiarios)} beneficiarios únicos`,
      'COP por beneficiario',
      periodo,
      `${finanzas.procedencia}; ${OPERACION_PROCEDENCIA}`,
    ),
    indicador(
      'recursos-poblacion-prioritaria',
      'Recursos destinados a población prioritaria',
      null,
      null,
      'Sin numerador registrado',
      'Sin denominador registrado',
      'COP',
      periodo,
      'Sin fuente registrada',
      'No existe una asignación de recursos por condición prioritaria registrada ni una metodología aprobada para derivarla. Mientras no existan, el indicador se declara no calculable en vez de estimarse.',
    ),
  ];
}

/** Tabla de población y recursos por programa (§3.6). */
function tablaRecursos(
  finanzas: FinancialAnalyticsSnapshotV1,
  eventos: readonly OperacionEvento[],
  vinculaciones: readonly OperacionVinculacion[],
  admitidos: ReadonlySet<string>,
  periodo: string,
  tenantId: string,
): ReporteTabla {
  const lineas = finanzas.ejecucionPorPrograma.filas;
  const filas: ReporteFila[] = lineas.map((linea) => {
    const programa = linea.celdas[0] ?? '';
    const ejecutado = montoDe(linea.celdas[4] ?? '');
    const beneficiarios = beneficiariosDe(
      vinculaciones,
      periodo,
      admitidos,
      programa,
      tenantId,
    ).size;
    const atendidos = pacientesAtendidos(
      eventos.filter((evento) => evento.programa === programa),
    ).size;
    const calculable = ejecutado !== null && atendidos > 0;

    return {
      id: linea.id,
      celdas: [
        programa,
        ejecutado === null ? REPORTE_SIN_DATOS : textoMonto(ejecutado),
        formatearNumero(beneficiarios),
        formatearNumero(atendidos),
        calculable
          ? `${formatearNumero(Math.round((ejecutado as number) / atendidos))} COP`
          : REPORTE_NO_CALCULABLE,
        linea.celdas[6] ?? REPORTE_SIN_DATOS,
      ],
    };
  });

  return {
    id: 'poblacion-recursos',
    titulo: 'Población y recursos por programa',
    leyenda:
      'Ejecución del periodo, beneficiarios únicos, pacientes atendidos y gasto por paciente atendido de cada programa.',
    columnas: [
      { id: 'programa', etiqueta: 'Programa' },
      { id: 'ejecutado', etiqueta: 'Ejecutado', numerica: true },
      { id: 'beneficiarios', etiqueta: 'Beneficiarios únicos', numerica: true },
      { id: 'atendidos', etiqueta: 'Pacientes atendidos', numerica: true },
      { id: 'gasto', etiqueta: 'Gasto por paciente atendido', numerica: true },
      { id: 'ejecucion', etiqueta: 'Ejecución', numerica: true },
    ],
    filas,
    nota: `Periodo ${periodo}. Un programa sin ejecución publicada o sin pacientes atendidos muestra «${REPORTE_NO_CALCULABLE}»; nunca cero. Indicadores descriptivos: no demuestran causalidad ni resultado clínico.`,
    vacio: 'Sin programas con ejecución publicada para este recorte.',
  };
}

/* ========================================================================== */
/* Distribuciones de población como gráficos publicables                      */
/* ========================================================================== */

/** Encabezado de la tabla accesible de cada distribución de H-03B. */
const ENCABEZADO_DISTRIBUCION: Record<string, string> = {
  'rangos-edad': 'Rango de edad',
  patologias: 'Condición registrada',
  eps: 'EPS',
  municipio: 'Municipio',
  programas: 'Programa',
  cuidador: 'Cuidador',
  profesional: 'Profesional',
};

/**
 * Traduce las distribuciones publicadas por H-03B al contrato de gráfico de
 * Reportes.
 *
 * Es una traducción de forma, no un cálculo: los valores, los porcentajes, el
 * orden y las notas son exactamente los que produce
 * `PopulationAnalyticsSnapshotV1`.
 */
export function graficosDePoblacion(
  snapshot: PopulationAnalyticsSnapshotV1,
  periodo: string,
): readonly ReporteGrafico[] {
  return snapshot.distribuciones.map((distribucion) => ({
    id: `poblacion-${distribucion.id}`,
    titulo: distribucion.titulo,
    unidad: 'Personas',
    periodo,
    nota: distribucion.nota,
    procedencia: snapshot.procedencia.origen,
    estado: 'disponible',
    series: [
      {
        id: distribucion.id,
        etiqueta: distribucion.titulo,
        puntos: distribucion.celdas.map((celda) => ({
          id: celda.id,
          etiqueta: celda.etiqueta,
          valor: celda.valor,
          texto: `${formatearNumero(celda.valor)} · ${textoPorcentaje(celda.porcentaje)}`,
        })),
      },
    ],
    encabezado: ENCABEZADO_DISTRIBUCION[distribucion.id] ?? 'Valor',
  }));
}

/**
 * Personas del universo filtrado que caen en una de las ocho intersecciones.
 *
 * Reutiliza los predicados de H-03B: no reimplementa la derivación de edad ni
 * la lectura de clasificaciones.
 */
export function pacientesDeInterseccion(
  pacientes: readonly PoblacionPaciente[],
  interseccionId: string,
  snapshot: PopulationAnalyticsSnapshotV1,
  corte: string = POBLACION_FECHA_CORTE,
): ReadonlySet<string> {
  const definicion = snapshot.intersecciones.find((celda) => celda.id === interseccionId);
  const ids = new Set<string>();

  if (definicion === undefined) {
    return ids;
  }

  for (const paciente of pacientes) {
    if (
      esMayorDe60(paciente, corte) === definicion.mayor60 &&
      tieneDiscapacidad(paciente) === definicion.discapacidad &&
      requiereCuidadosEnCasa(paciente) === definicion.cuidadosCasa
    ) {
      ids.add(paciente.id);
    }
  }

  return ids;
}

/* ========================================================================== */
/* Necesita atención                                                          */
/* ========================================================================== */

/**
 * Bandeja `Necesita atención` (§3.2).
 *
 * Reúne pendientes operativos, financieros y de evidencia SIN ninguna alerta
 * clínica y sin ninguna referencia nominal, de modo que la misma bandeja es
 * publicable en las dos audiencias.
 */
function necesitaAtencion(
  operacion: OperationalAnalyticsSnapshotV1,
  finanzas: FinancialAnalyticsSnapshotV1,
  institucional: InstitutionalEvidenceSnapshotV1,
): readonly ReporteFila[] {
  const filas: ReporteFila[] = [];
  const porTramo = new Map<string, number>();

  for (const alarma of operacion.pendientes) {
    porTramo.set(alarma.tramoAntiguedad, (porTramo.get(alarma.tramoAntiguedad) ?? 0) + 1);
  }

  for (const [tramo, total] of [...porTramo.entries()].sort((a, b) => b[1] - a[1])) {
    filas.push({
      id: `atencion-alarma-${tramo}`,
      celdas: [
        'Alarmas operativas abiertas',
        `${formatearNumero(total)} alarmas abiertas al corte`,
        tramo,
        operacion.procedencia,
      ],
    });
  }

  const pagos = finanzas.pagosPendientes.filas.length;

  if (pagos > 0) {
    filas.push({
      id: 'atencion-pagos',
      celdas: [
        'Pagos pendientes',
        `${formatearNumero(pagos)} registros pendientes de pago`,
        finanzas.periodo,
        finanzas.procedencia,
      ],
    });
  }

  const evidencias = institucional.evidencias.filter(
    (item) => item.estado === 'Pendiente' || item.estado === 'Requiere corrección',
  ).length;

  if (evidencias > 0) {
    filas.push({
      id: 'atencion-evidencias',
      celdas: [
        'Evidencias por completar',
        `${formatearNumero(evidencias)} evidencias pendientes o con corrección solicitada`,
        institucional.periodo,
        institucional.procedencia,
      ],
    });
  }

  return filas;
}

/* ========================================================================== */
/* Detalle operativo agregado                                                 */
/* ========================================================================== */

/**
 * Detalle operativo agregado de una intersección de condiciones (§3.3).
 *
 * Solo la vista Hospital puede abrirlo. Es agregado por construcción: devuelve
 * conteos de personas y de prestaciones del subconjunto, nunca un listado, un
 * nombre, un documento ni un dato clínico.
 */
export function detalleOperativoDeInterseccion(
  interseccionId: string,
  etiqueta: string,
  pacientes: ReadonlySet<string>,
  eventos: readonly OperacionEvento[],
  periodo: string,
): ReporteTabla {
  const propios = eventos.filter((evento) => pacientes.has(evento.pacienteId));
  const atendidos = pacientesAtendidos(propios);
  const realizadas = propios.filter((evento) => esRealizada(evento)).length;
  const programadas = propios.filter((evento) => evento.estado === 'Programada').length;
  const pendientes = propios.filter((evento) => evento.estado === 'Pendiente').length;

  return {
    id: `detalle-${interseccionId}`,
    titulo: `Detalle operativo agregado · ${etiqueta}`,
    leyenda: 'Conteos agregados del subconjunto seleccionado dentro del periodo.',
    columnas: [
      { id: 'medida', etiqueta: 'Medida' },
      { id: 'valor', etiqueta: 'Valor', numerica: true },
    ],
    filas: [
      { id: 'personas', celdas: ['Personas en la combinación', formatearNumero(pacientes.size)] },
      { id: 'atendidos', celdas: ['Pacientes únicos atendidos', formatearNumero(atendidos.size)] },
      { id: 'realizadas', celdas: ['Prestaciones realizadas', formatearNumero(realizadas)] },
      { id: 'programadas', celdas: ['Citas y prestaciones programadas', formatearNumero(programadas)] },
      { id: 'pendientes', celdas: ['Pendientes operativos', formatearNumero(pendientes)] },
    ],
    nota: `Periodo ${periodo}. Detalle agregado del contexto institucional: no contiene nombres, documentos, contactos ni información clínica.`,
    vacio: 'Sin actividad operativa registrada para esta combinación en el periodo.',
  };
}

/* ========================================================================== */
/* Compositor                                                                 */
/* ========================================================================== */

/** Entradas del compositor; permiten a las pruebas usar conjuntos pequeños. */
export interface ReporteEntradas {
  readonly pacientes?: readonly PoblacionPaciente[];
  readonly eventos?: readonly OperacionEvento[];
  readonly vinculaciones?: readonly OperacionVinculacion[];
  readonly alarmas?: readonly OperacionAlarma[];
  readonly corte?: string;
  /**
   * Contexto institucional activo. Todo registro operativo, de vinculación y
   * de alarma que no le pertenezca queda fuera antes de agregar. En este slice
   * es un valor del escenario demostrativo: NO procede de autenticación, no
   * concede acceso y no sustituye el aislamiento server-side futuro.
   */
  readonly tenantId?: string;
}

/** `ReportSnapshotV1` completo para una audiencia y unos filtros (§4). */
export function componerReporte(
  filtros: ReporteFiltros,
  audiencia: ReporteAudienciaId,
  entradas: ReporteEntradas = {},
): ReportSnapshotV1 {
  const corte = entradas.corte ?? POBLACION_FECHA_CORTE;
  const pacientes = entradas.pacientes ?? pacientesPoblacionDemo();
  const eventos = entradas.eventos ?? eventosOperativosDemo();
  const vinculaciones = entradas.vinculaciones ?? vinculacionesDemo();
  const alarmas = entradas.alarmas ?? alarmasOperativasDemo();
  const tenantId = entradas.tenantId ?? POBLACION_TENANT_DEMO;
  const normalizados = normalizarFiltros(filtros);

  const padron = padronFiltrado(pacientes, filtros, corte);
  const universo = universoFiltrado(pacientes, filtros, corte);
  const admitidosPadron = new Set(padron.map((paciente) => paciente.id));
  const admitidosActivos = new Set(universo.map((paciente) => paciente.id));

  const poblacion = snapshotDePoblacion(universo, filtrosDePoblacion(filtros), corte);
  const operacion = snapshotOperativo(
    eventos,
    alarmas,
    filtros,
    audiencia,
    admitidosActivos,
    corte,
    tenantId,
  );
  const finanzas = snapshotFinanciero(filtros, audiencia);
  const institucional = snapshotInstitucional(filtros);

  const eventosPeriodo = filtrarEventos(
    eventos,
    recorteDe(filtros, admitidosActivos, tenantId),
  );
  const beneficiarios = beneficiariosDe(
    vinculaciones,
    normalizados.periodo,
    admitidosPadron,
    normalizados.programa,
    tenantId,
  ).size;

  return {
    version: REPORTE_VERSION_DEFINICION,
    audiencia,
    filtros: normalizados,
    fechaCorte: corte,
    generatedAt: OPERACION_CALCULATED_AT,
    referencias: [
      {
        id: 'poblacion',
        contrato: 'PopulationAnalyticsSnapshotV1',
        version: POBLACION_VERSION_DEFINICION,
        fechaCorte: poblacion.fechaCorte,
      },
      {
        id: 'operacion',
        contrato: 'OperationalAnalyticsSnapshotV1',
        version: OPERACION_VERSION_DEFINICION,
        fechaCorte: operacion.fechaCorte,
      },
      {
        id: 'finanzas',
        contrato: 'FinancialAnalyticsSnapshotV1',
        version: FINANZAS_VERSION_DEFINICION,
        fechaCorte: OPERACION_FECHA_CORTE,
      },
      {
        id: 'institucional',
        contrato: 'InstitutionalEvidenceSnapshotV1',
        version: INSTITUCIONAL_VERSION_DEFINICION,
        fechaCorte: OPERACION_FECHA_CORTE,
      },
    ],
    calidad: {
      cobertura: `Cobertura del recorte: ${formatearNumero(poblacion.universo)} pacientes activos y ${formatearNumero(operacion.universo)} eventos operativos del periodo ${normalizados.periodo}.`,
      limitaciones: [
        poblacion.procedencia.nota,
        operacion.limitaciones,
        finanzas.limitaciones,
        institucional.limitaciones,
      ],
      actualizacion: `Último corte disponible: ${corte}. Sin fuentes externas conectadas: no se fabrica actualidad.`,
    },
    poblacion,
    operacion,
    finanzas,
    institucional,
    poblacionRecursos: indicadoresRecursos(
      finanzas,
      operacion.pacientesUnicos,
      beneficiarios,
      normalizados.periodo,
    ),
    tablaRecursos: tablaRecursos(
      finanzas,
      eventosPeriodo,
      vinculaciones,
      admitidosPadron,
      normalizados.periodo,
      tenantId,
    ),
    evolucionBeneficiarios: evolucionBeneficiarios(
      vinculaciones,
      admitidosPadron,
      normalizados.programa,
      tenantId,
    ),
    kpiPoblacion: kpiPoblacionDe(poblacion, beneficiarios, normalizados.periodo),
    resumen: kpiResumen(
      poblacion,
      operacion,
      finanzas,
      institucional,
      eventosPeriodo,
      beneficiarios,
      normalizados.periodo,
    ),
    atencion: necesitaAtencion(operacion, finanzas, institucional),
  };
}
