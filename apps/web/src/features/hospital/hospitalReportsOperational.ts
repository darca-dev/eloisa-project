import { formatearNumero } from './hospitalPopulationAnalytics';
import {
  POBLACION_INSTITUCION_DEMO,
  POBLACION_MUNICIPIO_SEDE,
} from './hospitalPopulationFixtures';
import { normalizarFiltros } from './hospitalReportsConfig';
import {
  OPERACION_CALCULATED_AT,
  OPERACION_FECHA_CORTE,
  OPERACION_PERIODOS,
  OPERACION_PROCEDENCIA,
  OPERACION_TENANT_DEMO,
  OPERACION_TRAMOS_ANTIGUEDAD,
} from './hospitalReportsOperationalFixtures';
import {
  OPERACION_ESTADOS,
  OPERACION_MODALIDADES,
  OPERACION_VERSION_DEFINICION,
  REPORTE_SIN_DATOS,
  type OperacionAlarma,
  type OperacionEvento,
  type OperacionModalidadId,
  type OperationalAnalyticsSnapshotV1,
  type ReporteAudienciaId,
  type ReporteCifra,
  type ReporteFila,
  type ReporteFiltros,
  type ReporteGrafico,
  type ReportePunto,
  type ReporteSerie,
  type ReporteTabla,
} from './hospitalReportsTypes';

/**
 * Selectores operativos versionados `operational-v1` (TASK-003H-07, §3.4 y §4).
 *
 * Es la ÚNICA implementación de las definiciones operativas de Reportes.
 * Ningún componente vuelve a contar eventos, deduplicar personas ni calcular
 * medianas por su cuenta.
 *
 * Definiciones vinculantes (§3.4):
 * - `realizada` exige el estado final aprobado `Realizada`. Ningún otro estado
 *   acredita prestación y una cita programada nunca cuenta como atención.
 * - `pacientes atendidos` cuenta identificadores únicos con al menos una
 *   prestación realizada en el periodo, deduplicados por `pacienteId` dentro
 *   del tenant.
 * - una alarma se cuenta por su estado al corte, no por su historia.
 * - los tiempos solo usan duraciones válidas; las faltantes se excluyen y la
 *   cobertura se declara. Una duración ausente no es cero.
 *
 * Ninguna función de este módulo infiere resultado clínico, evalúa rangos,
 * emite alertas ni deriva diagnóstico. Todo es determinista y local: no hay
 * consulta remota, permisos, aislamiento institucional ni auditoría, que
 * corresponden al backend futuro.
 */

/* ========================================================================== */
/* Recorte                                                                    */
/* ========================================================================== */

/** Criterios ya resueltos con los que se recortan eventos y alarmas. */
export interface OperacionRecorte {
  /**
   * Contexto institucional activo. Es el PRIMER criterio que se aplica: un
   * registro de otro contexto queda fuera antes de cualquier agregación, de
   * modo que dos identificadores de paciente iguales en contextos distintos no
   * pueden mezclarse ni contarse como la misma persona.
   */
  readonly tenantId: string;
  readonly periodo: string;
  readonly programa: string | null;
  readonly municipio: string | null;
  readonly modalidad: string | null;
  /** Personas admitidas por los filtros de población; `null` no recorta. */
  readonly pacientes: ReadonlySet<string> | null;
}

/**
 * Recorte derivado de los filtros de la barra global.
 *
 * El contexto institucional es explícito y obligatorio: sin él, un conjunto de
 * entrada con registros de varios contextos se agregaría como si todos
 * pertenecieran al contexto demostrativo.
 *
 * Este recorte es una restricción de presentación sobre datos ya cargados en
 * memoria: NO es autorización, ni aislamiento a nivel de datos, ni RLS, que
 * corresponden al backend futuro.
 */
export function recorteDe(
  filtros: ReporteFiltros,
  pacientes: ReadonlySet<string> | null,
  tenantId: string,
): OperacionRecorte {
  const normalizados = normalizarFiltros(filtros);

  return {
    tenantId,
    periodo: normalizados.periodo,
    programa: normalizados.programa,
    municipio: normalizados.municipio,
    modalidad: normalizados.modalidad,
    pacientes,
  };
}

/** `true` cuando el evento satisface todos los criterios salvo el periodo. */
function coincideSinPeriodo(evento: OperacionEvento, recorte: OperacionRecorte): boolean {
  /* El contexto institucional se exige antes que cualquier otro criterio. */
  if (evento.tenantId !== recorte.tenantId) {
    return false;
  }
  if (recorte.programa !== null && evento.programa !== recorte.programa) {
    return false;
  }
  if (
    recorte.municipio !== null &&
    evento.municipio !== recorte.municipio &&
    evento.zona !== recorte.municipio
  ) {
    return false;
  }
  if (recorte.modalidad !== null && evento.modalidad !== recorte.modalidad) {
    return false;
  }

  return recorte.pacientes === null || recorte.pacientes.has(evento.pacienteId);
}

/** Eventos del periodo seleccionado que satisfacen todos los criterios. */
export function filtrarEventos(
  eventos: readonly OperacionEvento[],
  recorte: OperacionRecorte,
): readonly OperacionEvento[] {
  return eventos.filter(
    (evento) => evento.periodo === recorte.periodo && coincideSinPeriodo(evento, recorte),
  );
}

/**
 * Eventos de TODOS los periodos que satisfacen el resto de criterios. Solo la
 * evolución los usa: una serie temporal de un único periodo no sería una
 * evolución, y la nota del gráfico lo declara.
 */
export function eventosDeTodosLosPeriodos(
  eventos: readonly OperacionEvento[],
  recorte: OperacionRecorte,
): readonly OperacionEvento[] {
  return eventos.filter((evento) => coincideSinPeriodo(evento, recorte));
}

/** Alarmas del periodo seleccionado que satisfacen programa y territorio. */
export function filtrarAlarmas(
  alarmas: readonly OperacionAlarma[],
  recorte: OperacionRecorte,
): readonly OperacionAlarma[] {
  return alarmas.filter((alarma) => {
    /* El contexto institucional se exige antes que cualquier otro criterio. */
    if (alarma.tenantId !== recorte.tenantId) {
      return false;
    }
    if (alarma.periodo !== recorte.periodo) {
      return false;
    }
    if (recorte.programa !== null && alarma.programa !== recorte.programa) {
      return false;
    }

    return (
      recorte.municipio === null ||
      alarma.municipio === recorte.municipio ||
      alarma.zona === recorte.municipio
    );
  });
}

/* ========================================================================== */
/* Definiciones                                                               */
/* ========================================================================== */

/** `true` solo para el estado final aprobado que acredita prestación. */
export function esRealizada(evento: OperacionEvento): boolean {
  return evento.estado === 'Realizada';
}

/**
 * Identificadores únicos con al menos una prestación realizada (§3.4).
 *
 * Deduplica por `pacienteId`, que es identidad estable DENTRO de un contexto
 * institucional. Por eso solo debe recibir eventos ya limitados a un contexto
 * —`filtrarEventos` lo garantiza—: sobre un conjunto mezclado, dos personas
 * distintas de contextos distintos podrían colapsar en una sola.
 */
export function pacientesAtendidos(eventos: readonly OperacionEvento[]): ReadonlySet<string> {
  const unicos = new Set<string>();

  for (const evento of eventos) {
    if (esRealizada(evento)) {
      unicos.add(evento.pacienteId);
    }
  }

  return unicos;
}

/** Mediana de duraciones válidas; `null` cuando no hay ninguna. */
export function medianaDeDuracion(eventos: readonly OperacionEvento[]): number | null {
  const validas = eventos
    .filter((evento) => esRealizada(evento) && evento.duracionMinutos !== null)
    .map((evento) => evento.duracionMinutos as number)
    .sort((a, b) => a - b);

  if (validas.length === 0) {
    return null;
  }

  const medio = Math.floor(validas.length / 2);

  if (validas.length % 2 === 1) {
    return validas[medio] as number;
  }

  return ((validas[medio - 1] as number) + (validas[medio] as number)) / 2;
}

/** Cobertura de los tiempos: prestaciones realizadas con duración válida. */
export function coberturaDeTiempos(eventos: readonly OperacionEvento[]): {
  readonly validas: number;
  readonly realizadas: number;
} {
  const realizadas = eventos.filter((evento) => esRealizada(evento));

  return {
    validas: realizadas.filter((evento) => evento.duracionMinutos !== null).length,
    realizadas: realizadas.length,
  };
}

/* ========================================================================== */
/* Composición del snapshot                                                   */
/* ========================================================================== */

/** Acumula un conteo por clave. */
function acumular(conteo: Map<string, number>, clave: string, incremento = 1): void {
  conteo.set(clave, (conteo.get(clave) ?? 0) + incremento);
}

/** Cifra operativa completa, con su definición y sus limitaciones. */
function cifra(
  id: string,
  etiqueta: string,
  valor: string,
  periodo: string,
  definicion: string,
  estado: ReporteCifra['estado'] = 'disponible',
  limitaciones = 'Conjunto demostrativo local; no procede de ningún sistema asistencial.',
  unidad = 'Prestaciones',
): ReporteCifra {
  return {
    id,
    etiqueta,
    valor,
    unidad,
    periodo,
    procedencia: OPERACION_PROCEDENCIA,
    clase: 'DEMOSTRATIVO',
    estado,
    definicion,
    version: OPERACION_VERSION_DEFINICION,
    limitaciones,
  };
}

/** Cuenta eventos de una modalidad con un estado exacto. */
function contar(
  eventos: readonly OperacionEvento[],
  modalidad: OperacionModalidadId,
  estado: string,
): number {
  return eventos.filter((evento) => evento.modalidad === modalidad && evento.estado === estado)
    .length;
}

/** Los seis KPI de Operación, en el orden vinculante (§3.4). */
function kpiOperativo(
  eventos: readonly OperacionEvento[],
  alarmas: readonly OperacionAlarma[],
  periodo: string,
  corte: string,
): readonly ReporteCifra[] {
  const atendidos = pacientesAtendidos(eventos);
  const mediana = medianaDeDuracion(eventos);
  const cobertura = coberturaDeTiempos(eventos);
  const abiertas = alarmas.filter((alarma) => alarma.estadoAlCorte === 'Abierta').length;
  const tiempoParcial = cobertura.validas < cobertura.realizadas;

  return [
    cifra(
      'citas-programadas',
      'Citas programadas',
      formatearNumero(contar(eventos, 'Cita presencial', 'Programada')),
      periodo,
      `Citas presenciales cuyo estado al corte es «Programada». Universo: eventos operativos del periodo tras aplicar los filtros. Fecha de corte: ${corte}.`,
      'disponible',
      'Una cita programada no acredita atención realizada.',
      'Citas',
    ),
    cifra(
      'visitas-realizadas',
      'Visitas domiciliarias realizadas',
      formatearNumero(contar(eventos, 'Visita domiciliaria', 'Realizada')),
      periodo,
      `Visitas domiciliarias con estado final aprobado «Realizada». Ningún otro estado cuenta. Fecha de corte: ${corte}.`,
      'disponible',
      'El conteo no describe resultado clínico alguno.',
      'Visitas',
    ),
    cifra(
      'virtuales-realizadas',
      'Consultas virtuales realizadas',
      formatearNumero(contar(eventos, 'Consulta virtual', 'Realizada')),
      periodo,
      `Consultas virtuales con estado final aprobado «Realizada». Fecha de corte: ${corte}.`,
      'disponible',
      'El conteo no describe resultado clínico alguno.',
      'Consultas',
    ),
    cifra(
      'alarmas-abiertas',
      'Alarmas abiertas',
      formatearNumero(abiertas),
      periodo,
      `Alarmas operativas cuyo estado al corte es «Abierta». Se cuenta el estado al corte, no la historia de la alarma. Fecha de corte: ${corte}.`,
      'disponible',
      'Son avisos de organización del trabajo; no son alertas clínicas ni oficiales.',
      'Alarmas',
    ),
    cifra(
      'pacientes-atendidos',
      'Pacientes únicos atendidos',
      formatearNumero(atendidos.size),
      periodo,
      `Identificadores únicos con al menos una prestación realizada en el periodo, deduplicados por identificador de paciente dentro del contexto institucional. Fecha de corte: ${corte}.`,
      'disponible',
      'Una persona con varias prestaciones cuenta una sola vez; estas cifras no deben sumarse con las de prestaciones.',
      'Personas',
    ),
    cifra(
      'tiempo-mediano',
      'Tiempo mediano de atención',
      mediana === null ? REPORTE_SIN_DATOS : `${String(mediana).replace('.', ',')} min`,
      periodo,
      `Mediana de las duraciones válidas de las prestaciones realizadas. Cobertura: ${formatearNumero(cobertura.validas)} de ${formatearNumero(cobertura.realizadas)} prestaciones realizadas tienen duración válida. Fecha de corte: ${corte}.`,
      mediana === null ? 'ausente' : tiempoParcial ? 'parcial' : 'disponible',
      'Las prestaciones sin marcas de tiempo válidas quedan excluidas y no se cuentan como cero.',
      'Minutos',
    ),
  ];
}

/** Serie a partir de un mapa de conteo y un orden de claves. */
function serieDe(
  id: string,
  etiqueta: string,
  conteo: ReadonlyMap<string, number>,
  orden: readonly string[],
  unidad: string,
): ReporteSerie {
  return {
    id,
    etiqueta,
    puntos: orden.map((clave) => {
      const valor = conteo.get(clave) ?? 0;

      return {
        id: `${id}-${clave}`,
        etiqueta: clave,
        valor,
        texto: `${formatearNumero(valor)} ${unidad}`,
      };
    }),
  };
}

/** Número de profesionales o profesiones que el gráfico de carga detalla. */
export const OPERACION_TOP_PROFESIONALES = 8;

/**
 * Carga agregada de trabajo.
 *
 * La vista Hospital la desagrega por profesional responsable; la vista
 * Alcaldía, por profesión, porque nunca recibe profesional nominal (§3.8). El
 * resto de la distribución se agrupa en `Otros`, de modo que ninguna cifra
 * queda silenciosamente fuera del total.
 */
function graficoCarga(
  eventos: readonly OperacionEvento[],
  audiencia: ReporteAudienciaId,
  periodo: string,
): ReporteGrafico {
  const conteo = new Map<string, number>();

  for (const evento of eventos) {
    if (esRealizada(evento)) {
      acumular(conteo, audiencia === 'hospital' ? evento.profesionalId : evento.profesion);
    }
  }

  const ordenadas = [...conteo.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es-CO'),
  );
  const visibles = ordenadas.slice(0, OPERACION_TOP_PROFESIONALES);
  const restante = ordenadas
    .slice(OPERACION_TOP_PROFESIONALES)
    .reduce((suma, [, valor]) => suma + valor, 0);
  const puntos: ReportePunto[] = visibles.map(([clave, valor]) => ({
    id: `carga-${clave}`,
    etiqueta: clave,
    valor,
    texto: `${formatearNumero(valor)} prestaciones`,
  }));

  if (restante > 0) {
    puntos.push({
      id: 'carga-otros',
      etiqueta: 'Otros',
      valor: restante,
      texto: `${formatearNumero(restante)} prestaciones`,
    });
  }

  return {
    id: 'carga',
    titulo: audiencia === 'hospital' ? 'Carga agregada por profesional' : 'Carga agregada por profesión',
    unidad: 'Prestaciones realizadas',
    periodo,
    nota:
      audiencia === 'hospital'
        ? `Prestaciones realizadas por profesional responsable. Se detallan las ${String(OPERACION_TOP_PROFESIONALES)} mayores y el resto se agrupa en «Otros»: ninguna cifra queda fuera del total. No evalúa desempeño individual.`
        : `Prestaciones realizadas por profesión, sin identificar a ninguna persona. Se detallan las ${String(OPERACION_TOP_PROFESIONALES)} mayores y el resto se agrupa en «Otros».`,
    procedencia: OPERACION_PROCEDENCIA,
    estado: 'disponible',
    series: [{ id: 'carga', etiqueta: 'Prestaciones realizadas', puntos }],
    encabezado: audiencia === 'hospital' ? 'Profesional responsable' : 'Profesión',
  };
}

/** Gráficos de Operación, en el orden vinculante (§3.4). */
function graficosOperativos(
  eventos: readonly OperacionEvento[],
  todos: readonly OperacionEvento[],
  alarmas: readonly OperacionAlarma[],
  audiencia: ReporteAudienciaId,
  periodo: string,
): readonly ReporteGrafico[] {
  const evolucion = new Map<string, number>();
  const atendidosPorPeriodo = new Map<string, Set<string>>();
  const porEstado = new Map<string, Map<string, number>>();
  const modalidades = new Map<string, number>();
  const antiguedad = new Map<string, number>();

  for (const evento of todos) {
    if (esRealizada(evento)) {
      acumular(evolucion, evento.periodo);

      const unicos = atendidosPorPeriodo.get(evento.periodo) ?? new Set<string>();

      unicos.add(evento.pacienteId);
      atendidosPorPeriodo.set(evento.periodo, unicos);
    }
  }

  /* Personas únicas por periodo: nunca se suman entre periodos. */
  const evolucionPersonas = new Map<string, number>(
    [...atendidosPorPeriodo.entries()].map(([clave, unicos]) => [clave, unicos.size]),
  );

  for (const modalidad of OPERACION_MODALIDADES) {
    porEstado.set(modalidad, new Map<string, number>());
  }

  for (const evento of eventos) {
    let conteoModalidad = porEstado.get(evento.modalidad);

    if (conteoModalidad === undefined) {
      conteoModalidad = new Map<string, number>();
      porEstado.set(evento.modalidad, conteoModalidad);
    }

    acumular(conteoModalidad, evento.estado);

    if (esRealizada(evento)) {
      acumular(modalidades, evento.modalidad);
    }
  }

  for (const alarma of alarmas) {
    if (alarma.estadoAlCorte === 'Abierta') {
      acumular(antiguedad, alarma.tramoAntiguedad);
    }
  }

  return [
    {
      id: 'evolucion',
      titulo: 'Evolución de población atendida',
      unidad: 'Personas y prestaciones',
      periodo: `${OPERACION_PERIODOS[0] ?? periodo} a ${OPERACION_PERIODOS[OPERACION_PERIODOS.length - 1] ?? periodo}`,
      nota: 'Serie de periodos equivalentes. Conserva los demás filtros aplicados y no el filtro de periodo, porque una serie de un solo periodo no describiría evolución. Las personas se deduplican dentro de cada periodo y no se suman entre periodos.',
      procedencia: OPERACION_PROCEDENCIA,
      estado: 'disponible',
      series: [
        serieDe(
          'evolucion-personas',
          'Pacientes únicos atendidos',
          evolucionPersonas,
          OPERACION_PERIODOS,
          'personas',
        ),
        serieDe(
          'evolucion-prestaciones',
          'Prestaciones realizadas',
          evolucion,
          OPERACION_PERIODOS,
          'prestaciones',
        ),
      ],
      encabezado: 'Periodo',
    },
    {
      id: 'estados',
      titulo: 'Estados de citas, visitas y consultas virtuales',
      unidad: 'Eventos operativos',
      periodo,
      nota: 'Cada evento aparece en un único estado. Solo «Realizada» acredita prestación realizada.',
      procedencia: OPERACION_PROCEDENCIA,
      estado: 'disponible',
      series: OPERACION_MODALIDADES.map((modalidad) =>
        serieDe(
          `estados-${modalidad}`,
          modalidad,
          porEstado.get(modalidad) ?? new Map<string, number>(),
          OPERACION_ESTADOS,
          'eventos',
        ),
      ),
      encabezado: 'Modalidad',
    },
    {
      id: 'modalidad',
      titulo: 'Atención por modalidad',
      unidad: 'Prestaciones realizadas',
      periodo,
      nota: 'Prestaciones con estado final aprobado, repartidas por modalidad. Las tres celdas suman el total de prestaciones realizadas.',
      procedencia: OPERACION_PROCEDENCIA,
      estado: 'disponible',
      series: [serieDe('modalidad', 'Prestaciones realizadas', modalidades, OPERACION_MODALIDADES, 'prestaciones')],
      encabezado: 'Modalidad',
    },
    graficoCarga(eventos, audiencia, periodo),
    {
      id: 'pendientes',
      titulo: 'Pendientes por antigüedad',
      unidad: 'Alarmas abiertas',
      periodo,
      nota: 'Alarmas operativas abiertas al corte, agrupadas por tramo de antigüedad. Organizan trabajo pendiente; no son alertas clínicas.',
      procedencia: OPERACION_PROCEDENCIA,
      estado: 'disponible',
      series: [serieDe('pendientes', 'Alarmas abiertas', antiguedad, OPERACION_TRAMOS_ANTIGUEDAD, 'alarmas')],
      encabezado: 'Tramo de antigüedad',
    },
  ];
}

/** Tabla `Resumen operativo` por programa y zona (§3.4). */
function resumenOperativo(
  eventos: readonly OperacionEvento[],
  periodo: string,
): ReporteTabla {
  interface Acumulado {
    programada: number;
    realizada: number;
    cancelada: number;
    pendiente: number;
    pacientes: Set<string>;
  }

  const filas = new Map<string, Acumulado>();

  for (const evento of eventos) {
    const clave = `${evento.programa}||${evento.zona}`;
    const acumulado = filas.get(clave) ?? {
      programada: 0,
      realizada: 0,
      cancelada: 0,
      pendiente: 0,
      pacientes: new Set<string>(),
    };

    if (evento.estado === 'Programada') {
      acumulado.programada += 1;
    } else if (evento.estado === 'Realizada') {
      acumulado.realizada += 1;
      acumulado.pacientes.add(evento.pacienteId);
    } else if (evento.estado === 'Cancelada') {
      acumulado.cancelada += 1;
    } else {
      acumulado.pendiente += 1;
    }

    filas.set(clave, acumulado);
  }

  const ordenadas = [...filas.entries()].sort(
    (a, b) => b[1].realizada - a[1].realizada || a[0].localeCompare(b[0], 'es-CO'),
  );

  return {
    id: 'resumen-operativo',
    titulo: 'Resumen operativo',
    leyenda:
      'Eventos operativos del periodo por programa y zona, con pacientes únicos y procedencia de cada fila.',
    columnas: [
      { id: 'programa', etiqueta: 'Programa' },
      { id: 'zona', etiqueta: 'Zona' },
      { id: 'programadas', etiqueta: 'Programadas', numerica: true },
      { id: 'realizadas', etiqueta: 'Realizadas', numerica: true },
      { id: 'canceladas', etiqueta: 'Canceladas', numerica: true },
      { id: 'pendientes', etiqueta: 'Pendientes', numerica: true },
      { id: 'pacientes', etiqueta: 'Pacientes únicos', numerica: true },
      { id: 'fuente', etiqueta: 'Fuente' },
    ],
    filas: ordenadas.map(([clave, acumulado]): ReporteFila => {
      const [programa = '', zona = ''] = clave.split('||');

      return {
        id: clave,
        celdas: [
          programa,
          zona,
          formatearNumero(acumulado.programada),
          formatearNumero(acumulado.realizada),
          formatearNumero(acumulado.cancelada),
          formatearNumero(acumulado.pendiente),
          formatearNumero(acumulado.pacientes.size),
          OPERACION_PROCEDENCIA,
        ],
      };
    }),
    nota: `Periodo ${periodo}. Los pacientes únicos de cada fila no se suman entre filas: una persona atendida en dos programas aparece en las dos.`,
    vacio: 'Sin eventos operativos para los filtros aplicados en este periodo.',
  };
}

/**
 * `OperationalAnalyticsSnapshotV1` del conjunto ya recortado (§4).
 *
 * Los filtros se aplican ANTES de cualquier agregación: el snapshot no recibe
 * totales previos ni los recalcula sobre datos ya resumidos. El primero de
 * ellos es el contexto institucional, de modo que ningún registro de otro
 * contexto entra en el universo, en los KPI, en los gráficos, en la evolución
 * ni en las alarmas, y `contexto.tenantId` declara siempre el contexto con el
 * que realmente se filtró.
 */
export function snapshotOperativo(
  eventos: readonly OperacionEvento[],
  alarmas: readonly OperacionAlarma[],
  filtros: ReporteFiltros,
  audiencia: ReporteAudienciaId,
  pacientes: ReadonlySet<string> | null = null,
  corte: string = OPERACION_FECHA_CORTE,
  tenantId: string = OPERACION_TENANT_DEMO,
): OperationalAnalyticsSnapshotV1 {
  const recorte = recorteDe(filtros, pacientes, tenantId);
  const delPeriodo = filtrarEventos(eventos, recorte);
  const todos = eventosDeTodosLosPeriodos(eventos, recorte);
  const alarmasPeriodo = filtrarAlarmas(alarmas, recorte);

  return {
    version: OPERACION_VERSION_DEFINICION,
    contexto: {
      /* Siempre el contexto con el que se filtró; nunca una constante fija. */
      tenantId: recorte.tenantId,
      institucion: POBLACION_INSTITUCION_DEMO,
      municipioSede: POBLACION_MUNICIPIO_SEDE,
    },
    periodo: recorte.periodo,
    fechaCorte: corte,
    filtros: normalizarFiltros(filtros),
    universo: delPeriodo.length,
    pacientesUnicos: pacientesAtendidos(delPeriodo).size,
    kpi: kpiOperativo(delPeriodo, alarmasPeriodo, recorte.periodo, corte),
    graficos: graficosOperativos(delPeriodo, todos, alarmasPeriodo, audiencia, recorte.periodo),
    resumenOperativo: resumenOperativo(delPeriodo, recorte.periodo),
    pendientes: alarmasPeriodo.filter((alarma) => alarma.estadoAlCorte === 'Abierta'),
    procedencia: OPERACION_PROCEDENCIA,
    calculatedAt: OPERACION_CALCULATED_AT,
    limitaciones:
      'Cifras operativas demostrativas. No proceden de ningún sistema asistencial, no describen resultado clínico y no acreditan prestación facturable.',
  };
}
