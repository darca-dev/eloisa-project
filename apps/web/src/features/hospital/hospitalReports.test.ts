import { describe, expect, it } from 'vitest';

import { hospitalFinancieraDemo } from './hospitalFinancialDemo';
import {
  filtrarPacientes,
  formatearNumero,
  snapshotDePoblacion,
  universoDe,
} from './hospitalPopulationAnalytics';
import {
  POBLACION_FECHA_CORTE,
  POBLACION_TENANT_DEMO,
  pacientesPoblacionDemo,
} from './hospitalPopulationFixtures';
import {
  REPORTE_ACCIONES,
  REPORTE_ESTADO_INICIAL,
  REPORTE_FILTROS_INICIALES,
  REPORTE_MOTIVO_EXPORTACION,
  REPORTE_TABS_POR_AUDIENCIA,
  aplicarFiltros,
  cambiarAudiencia,
  cambiarSubtab,
  cambiarTab,
  filtrosVacios,
  limpiarFiltros,
  normalizarFiltros,
  resumenDeFiltros,
  tabPermitido,
} from './hospitalReportsConfig';
import {
  FINANZAS_MONEDA,
  consolidar,
  importeDeFila,
  montoDe,
  snapshotFinanciero,
  textoMonto,
} from './hospitalReportsFinancial';
import {
  ESPACIOS_INSTITUCIONALES,
  EVIDENCIAS_DEMO,
  LIMITE_ADRES,
  LIMITE_FURAG,
  LIMITE_SENA,
  LIMITE_T319,
  conteoPorEstado,
  snapshotInstitucional,
} from './hospitalReportsInstitutional';
import {
  coberturaDeTiempos,
  esRealizada,
  filtrarEventos,
  medianaDeDuracion,
  pacientesAtendidos,
  recorteDe,
  snapshotOperativo,
} from './hospitalReportsOperational';
import {
  OPERACION_PERIODOS,
  OPERACION_PERIODO_INICIAL,
  alarmasOperativasDemo,
  eventosOperativosDemo,
  vinculacionesDemo,
} from './hospitalReportsOperationalFixtures';
import {
  busquedaConTab,
  focoDeTeclado,
  tabDesdeBusqueda,
} from './HospitalReportsPieces';
import {
  beneficiariosDe,
  componerReporte,
  filtrosDePoblacion,
  graficosDePoblacion,
  padronFiltrado,
  universoFiltrado,
} from './hospitalReportsSnapshot';
import {
  EVIDENCIA_ESTADOS,
  OPERACION_MODALIDADES,
  REPORTE_NO_CALCULABLE,
  REPORTE_SIN_DATOS,
  REPORTE_TABS,
  REPORTE_TAB_INICIAL,
  type OperacionAlarma,
  type OperacionEvento,
  type ReporteFiltros,
  type ReporteTabId,
} from './hospitalReportsTypes';

/**
 * Matriz de pruebas de «Reportes» (TASK-003H-07, §9).
 *
 * Verifica la aritmética y los contratos que sostienen la vista: filtros,
 * igualdad con H-03B y con H-06/H-06A, intersecciones disjuntas, definiciones
 * operativas, deduplicación, ausencia distinta de cero, cocientes no
 * calculables y delimitación de oficialidad de los cuatro marcos.
 *
 * No es una prueba de seguridad: comprueba lo que la interfaz muestra, no
 * autorización, aislamiento institucional ni auditoría, que corresponden al
 * backend futuro.
 */

const CORTE = POBLACION_FECHA_CORTE;

/** Filtros con algunos criterios aplicados, para las comparaciones cruzadas. */
const FILTROS_MIXTOS: ReporteFiltros = {
  ...REPORTE_FILTROS_INICIALES,
  programa: 'Atención domiciliaria',
  municipio: 'Soacha',
  prioridades: { mayor60: true, discapacidad: false, cuidadosCasa: true },
};

/* ========================================================================== */

describe('T-01 — Barra global de filtros', () => {
  it('el periodo es obligatorio y nunca queda vacío', () => {
    expect(REPORTE_FILTROS_INICIALES.periodo).toBe(OPERACION_PERIODO_INICIAL);
    expect(normalizarFiltros({ ...REPORTE_FILTROS_INICIALES, periodo: '   ' }).periodo).toBe(
      OPERACION_PERIODO_INICIAL,
    );
  });

  it('solo el periodo aplicado cuenta como «sin filtros»', () => {
    expect(filtrosVacios(REPORTE_FILTROS_INICIALES)).toBe(true);
    expect(filtrosVacios({ ...REPORTE_FILTROS_INICIALES, periodo: 'Julio 2026' })).toBe(true);
    expect(filtrosVacios(FILTROS_MIXTOS)).toBe(false);
  });

  it('normaliza cada criterio a valor o nulo, sin inventar ninguno', () => {
    expect(normalizarFiltros(FILTROS_MIXTOS)).toEqual({
      periodo: OPERACION_PERIODO_INICIAL,
      programa: 'Atención domiciliaria',
      municipio: 'Soacha',
      eps: null,
      modalidad: null,
      prioridades: { mayor60: true, discapacidad: false, cuidadosCasa: true },
    });
  });

  it('el resumen escribe todos los criterios aplicados y siempre el periodo', () => {
    const resumen = resumenDeFiltros(FILTROS_MIXTOS);

    expect(resumen).toContain(OPERACION_PERIODO_INICIAL);
    expect(resumen).toContain('Atención domiciliaria');
    expect(resumen).toContain('Soacha');
    expect(resumen).toContain('Mayor de 60 y Cuidados en casa');
    expect(resumenDeFiltros(REPORTE_FILTROS_INICIALES)).toBe(`Periodo: ${OPERACION_PERIODO_INICIAL}`);
  });

  it('limpiar conserva el periodo obligatorio y descarta el resto', () => {
    const conFiltros = aplicarFiltros(REPORTE_ESTADO_INICIAL, FILTROS_MIXTOS);

    expect(limpiarFiltros(conFiltros).filtros).toEqual(REPORTE_FILTROS_INICIALES);
    expect(limpiarFiltros(conFiltros).evidenciaAbierta).toBeNull();
    expect(limpiarFiltros(conFiltros).detalleAbierto).toBeNull();
  });

  it('las tres condiciones prioritarias se combinan entre sí', () => {
    const estado = aplicarFiltros(REPORTE_ESTADO_INICIAL, {
      prioridades: { mayor60: true, discapacidad: true, cuidadosCasa: false },
    });

    expect(estado.filtros.prioridades).toEqual({
      mayor60: true,
      discapacidad: true,
      cuidadosCasa: false,
    });
  });
});

/* ========================================================================== */

describe('T-02 — Cambio de audiencia y de tab', () => {
  it('el cambio de audiencia es una sola transición que cierra los paneles', () => {
    const abierto = {
      ...aplicarFiltros(REPORTE_ESTADO_INICIAL, FILTROS_MIXTOS),
      evidenciaAbierta: 'ev-001',
      detalleAbierto: 'las-tres',
      tablasAbiertas: ['flujo'],
    };
    const alcaldia = cambiarAudiencia(abierto, 'alcaldia');

    expect(alcaldia.audiencia).toBe('alcaldia');
    expect(alcaldia.evidenciaAbierta).toBeNull();
    expect(alcaldia.detalleAbierto).toBeNull();
    expect(alcaldia.tablasAbiertas).toEqual([]);
    expect(alcaldia.anuncio).toContain('Vista institucional / Alcaldía');
  });

  it('conserva únicamente los filtros que la audiencia destino declara', () => {
    const alcaldia = cambiarAudiencia(
      aplicarFiltros(REPORTE_ESTADO_INICIAL, FILTROS_MIXTOS),
      'alcaldia',
    );

    expect(alcaldia.filtros).toEqual(FILTROS_MIXTOS);
    expect(cambiarAudiencia(alcaldia, 'hospital').filtros).toEqual(FILTROS_MIXTOS);
  });

  it('un tab no permitido para la audiencia activa cae en Resumen', () => {
    expect(cambiarTab(REPORTE_ESTADO_INICIAL, 'inexistente').tab).toBe('resumen');
    expect(cambiarTab(REPORTE_ESTADO_INICIAL, 'finanzas').tab).toBe('finanzas');
    expect(tabPermitido('alcaldia', 'poblacion')).toBe(true);
    expect(tabPermitido('alcaldia', 'inexistente')).toBe(false);
  });

  it('las dos audiencias declaran los cinco tabs en el orden vinculante', () => {
    expect([...REPORTE_TABS]).toEqual([
      'resumen',
      'poblacion',
      'operacion',
      'finanzas',
      'institucional',
    ]);
    expect([...REPORTE_TABS_POR_AUDIENCIA.hospital]).toEqual([...REPORTE_TABS]);
    expect([...REPORTE_TABS_POR_AUDIENCIA.alcaldia]).toEqual([...REPORTE_TABS]);
  });

  it('un subtab inexistente vuelve al espacio de gestión', () => {
    expect(cambiarSubtab(REPORTE_ESTADO_INICIAL, 'furag').subtab).toBe('furag');
    expect(cambiarSubtab(REPORTE_ESTADO_INICIAL, 'inexistente').subtab).toBe('gestion');
  });

  it('las cuatro acciones futuras existen y declaran su motivo', () => {
    expect(REPORTE_ACCIONES.map((accion) => accion.etiqueta)).toEqual([
      'Exportar PDF',
      'Exportar Excel',
      'Imprimir',
      'Generar informe',
    ]);
    expect(REPORTE_MOTIVO_EXPORTACION).toBe('Disponible cuando se habilite la exportación');
  });
});

/* ========================================================================== */

describe('T-03 — Población coincide bit a bit con H-03B', () => {
  const pacientes = pacientesPoblacionDemo();

  it.each([REPORTE_FILTROS_INICIALES, FILTROS_MIXTOS])(
    'reproduce exactamente el snapshot de Pacientes para los mismos filtros',
    (filtros) => {
      const poblacionFiltros = filtrosDePoblacion(filtros);
      const esperado = snapshotDePoblacion(
        filtrarPacientes(universoDe(pacientes), poblacionFiltros, CORTE),
        poblacionFiltros,
        CORTE,
      );

      expect(componerReporte(filtros, 'hospital').poblacion).toEqual(esperado);
      expect(componerReporte(filtros, 'alcaldia').poblacion).toEqual(esperado);
    },
  );

  it('el periodo y la modalidad no recortan el padrón', () => {
    const conPeriodo = filtrosDePoblacion({
      ...REPORTE_FILTROS_INICIALES,
      periodo: 'Junio 2026',
      modalidad: 'Consulta virtual',
    });

    expect(conPeriodo).toEqual(filtrosDePoblacion(REPORTE_FILTROS_INICIALES));
  });

  it('las ocho intersecciones son disjuntas y reconcilian el universo', () => {
    const reporte = componerReporte(FILTROS_MIXTOS, 'hospital');
    const suma = reporte.poblacion.intersecciones.reduce(
      (total, celda) => total + celda.valor,
      0,
    );

    expect(reporte.poblacion.intersecciones).toHaveLength(8);
    expect(suma).toBe(reporte.poblacion.universo);
    expect(new Set(reporte.poblacion.intersecciones.map((celda) => celda.id)).size).toBe(8);
  });

  it('los gráficos de población son la misma distribución de H-03B, sin recalcular', () => {
    const reporte = componerReporte(REPORTE_FILTROS_INICIALES, 'hospital');
    const graficos = graficosDePoblacion(reporte.poblacion, reporte.filtros.periodo);

    expect(graficos).toHaveLength(reporte.poblacion.distribuciones.length);

    for (const [indice, grafico] of graficos.entries()) {
      const distribucion = reporte.poblacion.distribuciones[indice];

      expect(grafico.titulo).toBe(distribucion?.titulo);
      expect(grafico.series[0]?.puntos.map((punto) => punto.valor)).toEqual(
        distribucion?.celdas.map((celda) => celda.valor),
      );
    }
  });

  it('población beneficiaria y paciente activo son conjuntos distintos', () => {
    const reporte = componerReporte(REPORTE_FILTROS_INICIALES, 'hospital');
    const beneficiarios = beneficiariosDe(
      vinculacionesDemo(),
      OPERACION_PERIODO_INICIAL,
      new Set(padronFiltrado(pacientes, REPORTE_FILTROS_INICIALES, CORTE).map((p) => p.id)),
      null,
      POBLACION_TENANT_DEMO,
    );
    const activos = new Set(
      universoFiltrado(pacientes, REPORTE_FILTROS_INICIALES, CORTE).map((p) => p.id),
    );

    expect(beneficiarios.size).toBeGreaterThan(0);
    expect(beneficiarios.size).not.toBe(activos.size);
    expect([...beneficiarios].some((id) => !activos.has(id))).toBe(true);
    expect(reporte.kpiPoblacion[0]?.etiqueta).toBe('Población beneficiaria');
    expect(reporte.kpiPoblacion[1]?.etiqueta).toBe('Pacientes activos');
  });
});

/* ========================================================================== */

describe('T-04 — Definiciones operativas', () => {
  const base: OperacionEvento = {
    id: 'e-0',
    tenantId: POBLACION_TENANT_DEMO,
    pacienteId: 'pac-000001',
    periodo: OPERACION_PERIODO_INICIAL,
    modalidad: 'Visita domiciliaria',
    estado: 'Realizada',
    programa: 'Atención domiciliaria',
    municipio: 'Soacha',
    zona: 'Comuna 4',
    profesionalId: 'Dra. Laura Gómez',
    profesion: 'Medicina general',
    duracionMinutos: 30,
    procedencia: 'demo',
  };
  const eventos: readonly OperacionEvento[] = [
    base,
    { ...base, id: 'e-1', duracionMinutos: 50 },
    { ...base, id: 'e-2', duracionMinutos: null },
    { ...base, id: 'e-3', pacienteId: 'pac-000002', estado: 'Programada', duracionMinutos: null },
    { ...base, id: 'e-4', pacienteId: 'pac-000003', estado: 'Cancelada', duracionMinutos: null },
    { ...base, id: 'e-5', pacienteId: 'pac-000004', estado: 'Pendiente', duracionMinutos: null },
  ];

  it('solo el estado final aprobado acredita prestación realizada', () => {
    expect(eventos.filter((evento) => esRealizada(evento)).map((evento) => evento.id)).toEqual([
      'e-0',
      'e-1',
      'e-2',
    ]);
  });

  it('los pacientes atendidos se deduplican y excluyen los no realizados', () => {
    expect([...pacientesAtendidos(eventos)]).toEqual(['pac-000001']);
  });

  it('la mediana excluye duraciones faltantes y declara su cobertura', () => {
    expect(medianaDeDuracion(eventos)).toBe(40);
    expect(coberturaDeTiempos(eventos)).toEqual({ validas: 2, realizadas: 3 });
  });

  it('sin ninguna duración válida el tiempo mediano es «Sin datos», nunca cero', () => {
    const sinTiempos = eventos.map((evento) => ({ ...evento, duracionMinutos: null }));
    const snapshot = snapshotOperativo(
      sinTiempos,
      [],
      REPORTE_FILTROS_INICIALES,
      'hospital',
      null,
      CORTE,
    );
    const tiempo = snapshot.kpi.find((cifra) => cifra.id === 'tiempo-mediano');

    expect(medianaDeDuracion(sinTiempos)).toBeNull();
    expect(tiempo?.valor).toBe(REPORTE_SIN_DATOS);
    expect(tiempo?.estado).toBe('ausente');
  });

  it('los filtros se aplican antes de agregar', () => {
    const recorte = recorteDe(
      { ...REPORTE_FILTROS_INICIALES, modalidad: 'Consulta virtual' },
      null,
      POBLACION_TENANT_DEMO,
    );

    expect(filtrarEventos(eventos, recorte)).toEqual([]);
    expect(
      filtrarEventos(eventos, recorteDe(REPORTE_FILTROS_INICIALES, null, POBLACION_TENANT_DEMO)),
    ).toHaveLength(6);
    expect(
      filtrarEventos(
        eventos,
        recorteDe(REPORTE_FILTROS_INICIALES, new Set(['pac-000002']), POBLACION_TENANT_DEMO),
      ),
    ).toHaveLength(1);
  });

  it('los seis KPI operativos conservan su orden vinculante', () => {
    const snapshot = componerReporte(REPORTE_FILTROS_INICIALES, 'hospital').operacion;

    expect(snapshot.kpi.map((cifra) => cifra.etiqueta)).toEqual([
      'Citas programadas',
      'Visitas domiciliarias realizadas',
      'Consultas virtuales realizadas',
      'Alarmas abiertas',
      'Pacientes únicos atendidos',
      'Tiempo mediano de atención',
    ]);
  });

  it('la evolución conserva los tres periodos aunque el filtro fije uno solo', () => {
    const snapshot = componerReporte(REPORTE_FILTROS_INICIALES, 'hospital').operacion;
    const evolucion = snapshot.graficos.find((grafico) => grafico.id === 'evolucion');

    expect(evolucion?.series[0]?.puntos.map((punto) => punto.etiqueta)).toEqual([
      ...OPERACION_PERIODOS,
    ]);
    expect(evolucion?.series).toHaveLength(2);
  });

  it('la carga se desagrega por profesional en Hospital y por profesión en Alcaldía', () => {
    const hospital = componerReporte(REPORTE_FILTROS_INICIALES, 'hospital').operacion;
    const alcaldia = componerReporte(REPORTE_FILTROS_INICIALES, 'alcaldia').operacion;
    const cargaHospital = hospital.graficos.find((grafico) => grafico.id === 'carga');
    const cargaAlcaldia = alcaldia.graficos.find((grafico) => grafico.id === 'carga');

    expect(cargaHospital?.encabezado).toBe('Profesional responsable');
    expect(cargaAlcaldia?.encabezado).toBe('Profesión');
    expect(
      cargaAlcaldia?.series[0]?.puntos.some((punto) => punto.etiqueta.includes('Dra.')),
    ).toBe(false);
  });

  it('el resumen operativo declara las columnas aprobadas', () => {
    const tabla = componerReporte(REPORTE_FILTROS_INICIALES, 'hospital').operacion
      .resumenOperativo;

    expect(tabla.columnas.map((columna) => columna.etiqueta)).toEqual([
      'Programa',
      'Zona',
      'Programadas',
      'Realizadas',
      'Canceladas',
      'Pendientes',
      'Pacientes únicos',
      'Fuente',
    ]);
  });

  it('las alarmas se cuentan por su estado al corte', () => {
    const alarmas = alarmasOperativasDemo();
    const snapshot = snapshotOperativo(
      eventosOperativosDemo(),
      alarmas,
      REPORTE_FILTROS_INICIALES,
      'hospital',
      null,
      CORTE,
    );
    const abiertas = alarmas.filter(
      (alarma) =>
        alarma.periodo === OPERACION_PERIODO_INICIAL && alarma.estadoAlCorte === 'Abierta',
    ).length;

    expect(snapshot.pendientes).toHaveLength(abiertas);
    expect(snapshot.kpi.find((cifra) => cifra.id === 'alarmas-abiertas')?.valor).toBe(
      formatearNumero(abiertas),
    );
    expect(abiertas).toBeGreaterThan(0);
  });
});

/* ========================================================================== */

describe('T-05 — Finanzas coincide con H-06/H-06A', () => {
  const snapshot = snapshotFinanciero(REPORTE_FILTROS_INICIALES, 'hospital');

  it('los siete KPI conservan el orden vinculante', () => {
    expect(snapshot.kpi.map((cifra) => cifra.etiqueta)).toEqual([
      'Presupuesto',
      'Ingresos',
      'Egresos',
      'Comprometido',
      'Ejecutado',
      'Disponible',
      'Ejecución %',
    ]);
  });

  it('lee literalmente las cifras publicadas por Gestión financiera', () => {
    for (const id of ['kpi-asignado', 'kpi-ingresos', 'kpi-egresos', 'kpi-comprometido']) {
      const fuente = hospitalFinancieraDemo.resumen.kpis.find((kpi) => kpi.id === id);
      const proyectada = snapshot.kpi.find((cifra) => cifra.id === id);

      expect(proyectada?.valor).toBe(fuente?.valor);
      expect(proyectada?.procedencia).toBe(fuente?.origen);
      expect(proyectada?.periodo).toBe(fuente?.periodo);
    }
  });

  it('consolida el ejecutado deduplicando por identidad de línea', () => {
    const ejecutado = snapshot.kpi.find((cifra) => cifra.id === 'kpi-ejecutado');
    const lineas = hospitalFinancieraDemo.ejecucion.filter(
      (linea) => linea.periodo === OPERACION_PERIODO_INICIAL,
    );
    const esperado = lineas.reduce((total, linea) => total + (montoDe(linea.ejecutado) ?? 0), 0);

    expect(ejecutado?.valor).toBe(textoMonto(esperado));
    expect(ejecutado?.desglose?.length).toBeGreaterThan(0);
    expect(ejecutado?.definicion).toContain('deduplicadas por identificador de línea');
  });

  it('nunca suma dos veces el mismo registro de origen', () => {
    const resultado = consolidar([
      { id: 'a', origen: 'Hospital', valor: 100 },
      { id: 'a', origen: 'Hospital', valor: 100 },
      { id: 'b', origen: 'Plataforma', valor: 50 },
    ]);

    expect(resultado.total).toBe(150);
    expect(resultado.duplicados).toEqual(['a']);
    expect(resultado.desglose.map((parte) => parte.etiqueta)).toEqual(['Hospital', 'Plataforma']);
  });

  it('sin registros consolidables la cifra es ausente, nunca cero', () => {
    expect(consolidar([]).total).toBeNull();
    expect(consolidar([{ id: 'a', origen: 'Hospital', valor: null }]).total).toBeNull();
  });

  it('un periodo sin publicación en la fuente no hereda la cifra de otro periodo', () => {
    const junio = snapshotFinanciero(
      { ...REPORTE_FILTROS_INICIALES, periodo: 'Junio 2026' },
      'hospital',
    );

    for (const cifra of junio.kpi) {
      if (cifra.estado === 'ausente') {
        expect(cifra.valor).toBe(REPORTE_SIN_DATOS);
        expect(cifra.valor).not.toContain('0 ');
      }
    }

    expect(junio.kpi.find((cifra) => cifra.id === 'kpi-asignado')?.estado).toBe('ausente');
  });

  it('la composición agregada declara los seis componentes aprobados', () => {
    expect(snapshot.composicion.map((cifra) => cifra.etiqueta)).toEqual([
      'Nómina',
      'Honorarios',
      'Gastos operativos',
      'Proveedores',
      'Insumos',
      'Convenios',
    ]);

    for (const componente of snapshot.composicion) {
      if (componente.estado === 'ausente') {
        expect(componente.valor).toBe(REPORTE_SIN_DATOS);
        expect(componente.definicion).toContain('Ausente no es cero');
      }
    }
  });

  it('la vista Alcaldía recibe los pagos pendientes solo agregados', () => {
    const alcaldia = snapshotFinanciero(REPORTE_FILTROS_INICIALES, 'alcaldia');

    expect(alcaldia.pagosPendientes.columnas.map((columna) => columna.id)).toEqual([
      'programa',
      'estado',
      'registros',
    ]);
    expect(alcaldia.pagosPendientes.nota).toContain('No incluye persona');
    expect(snapshot.pagosPendientes.columnas.map((columna) => columna.id)).toContain('valor');
  });

  it('reconoce importes y descarta textos que no lo son', () => {
    expect(montoDe('1.400.000.000 COP')).toBe(1400000000);
    expect(montoDe('3 cuentas')).toBeNull();
    expect(montoDe('50 %')).toBeNull();
    expect(textoMonto(1400000000)).toBe(`1.400.000.000 ${FINANZAS_MONEDA}`);
  });

  it('lee el importe de una fila financiera desde su celda de importe', () => {
    const fila = hospitalFinancieraDemo.secciones.gastos?.filas[0];

    expect(fila).toBeDefined();
    expect(fila === undefined ? null : importeDeFila(fila)).not.toBeNull();
  });
});

/* ========================================================================== */

describe('T-06 — Población y recursos', () => {
  it('los indicadores declaran numerador, denominador, unidad, versión y método', () => {
    const reporte = componerReporte(REPORTE_FILTROS_INICIALES, 'hospital');

    for (const indicador of reporte.poblacionRecursos) {
      expect(indicador.unidad).not.toBe('');
      expect(indicador.periodo).not.toBe('');
      expect(indicador.version).not.toBe('');
      expect(indicador.metodologia).not.toBe('');
      expect(indicador.numeradorTexto).not.toBe('');
      expect(indicador.denominadorTexto).not.toBe('');
    }
  });

  it('un denominador ausente produce «No calculable», nunca cero', () => {
    const reporte = componerReporte(REPORTE_FILTROS_INICIALES, 'hospital');
    const prioritaria = reporte.poblacionRecursos.find(
      (indicador) => indicador.id === 'recursos-poblacion-prioritaria',
    );

    expect(prioritaria?.valor).toBe(REPORTE_NO_CALCULABLE);
    expect(prioritaria?.estado).toBe('no-calculable');
    expect(prioritaria?.metodologia).toContain('no calculable');
  });

  it('la tabla de recursos escribe «No calculable» cuando falta el denominador', () => {
    const reporte = componerReporte(
      { ...REPORTE_FILTROS_INICIALES, periodo: 'Junio 2026' },
      'hospital',
    );

    for (const fila of reporte.tablaRecursos.filas) {
      expect(fila.celdas[4]).not.toBe('0 COP');
    }
    expect(reporte.tablaRecursos.nota).toContain('no demuestran causalidad');
  });
});

/* ========================================================================== */

describe('T-07 — Evidencias y espacios institucionales', () => {
  const snapshot = snapshotInstitucional(REPORTE_FILTROS_INICIALES);

  it('declara los cinco espacios en el orden vinculante', () => {
    expect(ESPACIOS_INSTITUCIONALES.map((espacio) => espacio.id)).toEqual([
      'gestion',
      'furag',
      'adres',
      'sena',
      't319',
    ]);
  });

  it('cada espacio delimita su alcance de oficialidad', () => {
    expect(LIMITE_FURAG).toContain('no asigna puntajes oficiales ni certifica cumplimiento');
    expect(LIMITE_ADRES).toContain('administra recursos e información del sistema de salud');
    expect(LIMITE_ADRES).toContain('no es el regulador');
    expect(LIMITE_SENA).toContain('no prueba competencia');
    expect(LIMITE_T319).toContain('no certifica cumplimiento judicial');
  });

  it('Función Pública figura solo en los registros que la declaran', () => {
    const conFuncionPublica = EVIDENCIAS_DEMO.filter((registro) =>
      registro.procedencia.includes('Función Pública'),
    );

    expect(conFuncionPublica.length).toBeGreaterThan(0);
    for (const registro of conFuncionPublica) {
      expect(registro.marco).toBe('FURAG / MIPG');
      expect(registro.procedencia).toContain('demostrativo');
    }
  });

  it('los cuatro estados documentales se muestran siempre, incluso en cero', () => {
    const conteo = conteoPorEstado([]);

    expect(conteo.map((punto) => punto.etiqueta)).toEqual([...EVIDENCIA_ESTADOS]);
    expect(snapshot.conteoPorEstado.map((punto) => punto.etiqueta)).toEqual([
      ...EVIDENCIA_ESTADOS,
    ]);
  });

  it('los metadatos nunca contienen el documento real', () => {
    for (const registro of snapshot.evidencias) {
      const contenido = registro.metadatos.find((dato) => dato.etiqueta === 'Contenido');

      expect(contenido?.valor).toContain('El documento no se muestra');
      expect(registro.metadatos.map((dato) => dato.etiqueta)).toContain('Referencia');
    }
  });

  it('el recorte de evidencias respeta periodo, programa y territorio', () => {
    const julio = snapshotInstitucional({
      ...REPORTE_FILTROS_INICIALES,
      periodo: 'Julio 2026',
    });

    expect(julio.evidencias.every((registro) => registro.periodo === 'Julio 2026')).toBe(true);
    expect(snapshot.evidencias.every((registro) => registro.periodo !== 'Julio 2026')).toBe(true);
  });
});

/* ========================================================================== */

describe('T-08 — Snapshot compuesto', () => {
  const reporte = componerReporte(REPORTE_FILTROS_INICIALES, 'hospital');

  it('referencia la versión de cada contrato que compone', () => {
    expect(reporte.version).toBe('reports-v1');
    expect(reporte.referencias.map((referencia) => referencia.version)).toEqual([
      'population-v1',
      'operational-v1',
      'financial-v1',
      'institutional-v1',
    ]);
  });

  it('los seis KPI del resumen conservan el orden vinculante', () => {
    expect(reporte.resumen.map((cifra) => cifra.etiqueta)).toEqual([
      'Población beneficiaria',
      'Pacientes activos',
      'Atenciones realizadas',
      'Pendientes operativos',
      'Ejecución financiera %',
      'Evidencias pendientes',
    ]);
  });

  it('toda cifra conserva definición, versión, unidad, periodo y procedencia', () => {
    const cifras = [
      ...reporte.resumen,
      ...reporte.kpiPoblacion,
      ...reporte.operacion.kpi,
      ...reporte.finanzas.kpi,
      ...reporte.finanzas.composicion,
    ];

    for (const cifra of cifras) {
      expect(cifra.definicion.length).toBeGreaterThan(20);
      expect(cifra.version).not.toBe('');
      expect(cifra.unidad).not.toBe('');
      expect(cifra.periodo).not.toBe('');
      expect(cifra.procedencia).not.toBe('');
      expect(cifra.clase).toBe('DEMOSTRATIVO');
      expect(cifra.limitaciones).not.toBe('');
    }
  });

  it('declara cobertura, limitaciones y estado de actualización', () => {
    expect(reporte.calidad.cobertura).toContain('Cobertura del recorte');
    expect(reporte.calidad.limitaciones.length).toBe(4);
    expect(reporte.calidad.actualizacion).toContain('no se fabrica actualidad');
  });

  it('la bandeja «Necesita atención» no contiene información nominal ni clínica', () => {
    for (const fila of reporte.atencion) {
      for (const celda of fila.celdas) {
        expect(celda).not.toMatch(/\bCC \d/u);
        expect(celda).not.toMatch(/Dra?\.|Enf\.|Ft\.|Ps\.|Nut\./u);
      }
    }
  });

  it('el conjunto operativo es determinista y coherente con población', () => {
    const primero = eventosOperativosDemo();
    const segundo = eventosOperativosDemo();
    const identificadores = new Set(pacientesPoblacionDemo().map((paciente) => paciente.id));

    expect(primero).toBe(segundo);
    expect(primero.length).toBeGreaterThan(0);
    expect(primero.every((evento) => identificadores.has(evento.pacienteId))).toBe(true);
    expect(
      primero.every((evento) => (OPERACION_MODALIDADES as readonly string[]).includes(evento.modalidad)),
    ).toBe(true);
  });
});

/* ========================================================================== */

describe('T-09 — Aislamiento por contexto institucional', () => {
  const OTRO_TENANT = 'demo-hospital-de-otro-contexto';

  const evento: OperacionEvento = {
    id: 'ev-propio',
    tenantId: POBLACION_TENANT_DEMO,
    pacienteId: 'pac-000001',
    periodo: OPERACION_PERIODO_INICIAL,
    modalidad: 'Visita domiciliaria',
    estado: 'Realizada',
    programa: 'Atención domiciliaria',
    municipio: 'Soacha',
    zona: 'Comuna 4',
    profesionalId: 'Dra. Laura Gómez',
    profesion: 'Medicina general',
    duracionMinutos: 30,
    procedencia: 'demo',
  };

  /* Mismo paciente, mismo periodo y mismo programa; distinto contexto. */
  const eventoAjeno: OperacionEvento = { ...evento, id: 'ev-ajeno', tenantId: OTRO_TENANT };

  const vinculacion = {
    id: 'vin-propia',
    tenantId: POBLACION_TENANT_DEMO,
    pacienteId: 'pac-000001',
    programa: 'Atención domiciliaria',
    periodo: OPERACION_PERIODO_INICIAL,
    procedencia: 'demo',
  };
  const vinculacionAjena = { ...vinculacion, id: 'vin-ajena', tenantId: OTRO_TENANT };

  const alarma: OperacionAlarma = {
    id: 'alr-propia',
    tenantId: POBLACION_TENANT_DEMO,
    periodo: OPERACION_PERIODO_INICIAL,
    programa: 'Atención domiciliaria',
    municipio: 'Soacha',
    zona: 'Comuna 4',
    estadoAlCorte: 'Abierta',
    antiguedad: '3 días',
    tramoAntiguedad: '0 a 7 días',
    asunto: 'Visita domiciliaria sin confirmación de ejecución',
    procedencia: 'demo',
  };
  const alarmaAjena: OperacionAlarma = { ...alarma, id: 'alr-ajena', tenantId: OTRO_TENANT };

  const reporte = componerReporte(REPORTE_FILTROS_INICIALES, 'hospital', {
    eventos: [evento, eventoAjeno],
    vinculaciones: [vinculacion, vinculacionAjena],
    alarmas: [alarma, alarmaAjena],
    tenantId: POBLACION_TENANT_DEMO,
  });

  it('el universo operativo solo contiene el evento del contexto activo', () => {
    expect(reporte.operacion.universo).toBe(1);
    expect(reporte.operacion.pacientesUnicos).toBe(1);
  });

  it('los KPI operativos no incorporan el evento del otro contexto', () => {
    const visitas = reporte.operacion.kpi.find((cifra) => cifra.id === 'visitas-realizadas');
    const atendidos = reporte.operacion.kpi.find((cifra) => cifra.id === 'pacientes-atendidos');

    expect(visitas?.valor).toBe('1');
    expect(atendidos?.valor).toBe('1');
  });

  it('los gráficos y la evolución tampoco lo incorporan', () => {
    const modalidad = reporte.operacion.graficos.find((grafico) => grafico.id === 'modalidad');
    const evolucion = reporte.operacion.graficos.find((grafico) => grafico.id === 'evolucion');
    const visitas = modalidad?.series[0]?.puntos.find(
      (punto) => punto.etiqueta === 'Visita domiciliaria',
    );
    const enPeriodo = evolucion?.series[1]?.puntos.find(
      (punto) => punto.etiqueta === OPERACION_PERIODO_INICIAL,
    );

    expect(visitas?.valor).toBe(1);
    expect(enPeriodo?.valor).toBe(1);
  });

  it('los beneficiarios se limitan al contexto antes de deduplicar', () => {
    const beneficiarios = reporte.resumen.find((cifra) => cifra.id === 'resumen-beneficiaria');

    expect(beneficiarios?.valor).toBe('1');
    expect(
      beneficiariosDe(
        [vinculacion, vinculacionAjena],
        OPERACION_PERIODO_INICIAL,
        new Set(['pac-000001']),
        null,
        POBLACION_TENANT_DEMO,
      ).size,
    ).toBe(1);
  });

  it('las alarmas pendientes solo incluyen la del contexto activo', () => {
    expect(reporte.operacion.pendientes.map((pendiente) => pendiente.id)).toEqual(['alr-propia']);
    expect(reporte.operacion.kpi.find((cifra) => cifra.id === 'alarmas-abiertas')?.valor).toBe('1');
  });

  it('el snapshot declara el contexto con el que realmente filtró', () => {
    expect(reporte.operacion.contexto.tenantId).toBe(POBLACION_TENANT_DEMO);

    const ajeno = componerReporte(REPORTE_FILTROS_INICIALES, 'hospital', {
      eventos: [evento, eventoAjeno],
      vinculaciones: [vinculacion, vinculacionAjena],
      alarmas: [alarma, alarmaAjena],
      tenantId: OTRO_TENANT,
    });

    expect(ajeno.operacion.contexto.tenantId).toBe(OTRO_TENANT);
    expect(ajeno.operacion.pendientes.map((pendiente) => pendiente.id)).toEqual(['alr-ajena']);
  });

  it('el recorte descarta el contexto ajeno antes que cualquier otro criterio', () => {
    const recorte = recorteDe(REPORTE_FILTROS_INICIALES, null, POBLACION_TENANT_DEMO);

    expect(filtrarEventos([evento, eventoAjeno], recorte).map((item) => item.id)).toEqual([
      'ev-propio',
    ]);
    expect(pacientesAtendidos(filtrarEventos([evento, eventoAjeno], recorte)).size).toBe(1);
  });
});

/* ========================================================================== */

describe('T-10 — El filtro Programa no mezcla universos financieros', () => {
  const PROGRAMA = 'Atención domiciliaria';
  const GLOBALES = [
    'kpi-asignado',
    'kpi-ingresos',
    'kpi-egresos',
    'kpi-comprometido',
    'kpi-disponible',
    'kpi-ejecucion',
  ];

  const sinPrograma = snapshotFinanciero(REPORTE_FILTROS_INICIALES, 'hospital');
  const conPrograma = snapshotFinanciero(
    { ...REPORTE_FILTROS_INICIALES, programa: PROGRAMA },
    'hospital',
  );

  it('sin filtro Programa los siete KPI conservan lo que publica la fuente', () => {
    for (const id of GLOBALES) {
      const fuente = hospitalFinancieraDemo.resumen.kpis.find((kpi) => kpi.id === id);
      const cifra = sinPrograma.kpi.find((item) => item.id === id);

      expect(cifra?.valor).toBe(fuente?.valor);
      expect(cifra?.procedencia).toBe(fuente?.origen);
      expect(cifra?.periodo).toBe(fuente?.periodo);
      expect(cifra?.estado).toBe('disponible');
    }

    expect(sinPrograma.kpi.find((item) => item.id === 'kpi-ejecutado')?.estado).toBe('disponible');
  });

  it('con filtro Programa los seis KPI globales quedan ausentes y sin número', () => {
    for (const id of GLOBALES) {
      const cifra = conPrograma.kpi.find((item) => item.id === id);
      const fuente = hospitalFinancieraDemo.resumen.kpis.find((kpi) => kpi.id === id);

      expect(cifra?.valor).toBe(REPORTE_SIN_DATOS);
      expect(cifra?.estado).toBe('ausente');
      expect(cifra?.valor).not.toBe(fuente?.valor);
      expect(cifra?.definicion).toContain('cobertura global');
      expect(cifra?.definicion).toContain('no la publica por programa');
      expect(cifra?.definicion).toContain(PROGRAMA);
    }
  });

  it('con filtro Programa Ejecutado conserva su consolidación por líneas', () => {
    const ejecutado = conPrograma.kpi.find((item) => item.id === 'kpi-ejecutado');
    const lineas = hospitalFinancieraDemo.ejecucion.filter(
      (linea) => linea.periodo === OPERACION_PERIODO_INICIAL && linea.programa === PROGRAMA,
    );
    const esperado = lineas.reduce((total, linea) => total + (montoDe(linea.ejecutado) ?? 0), 0);

    expect(ejecutado?.estado).toBe('disponible');
    expect(ejecutado?.valor).toBe(textoMonto(esperado));
  });

  it('tabla, gráfico y composición siguen limitados al programa seleccionado', () => {
    expect(conPrograma.ejecucionPorPrograma.filas.every((fila) => fila.celdas[0] === PROGRAMA)).toBe(
      true,
    );
    expect(
      conPrograma.ejecucionGrafico.series[0]?.puntos.every((punto) => punto.etiqueta === PROGRAMA),
    ).toBe(true);
    expect(conPrograma.ejecucionPorPrograma.filas.length).toBeLessThan(
      sinPrograma.ejecucionPorPrograma.filas.length,
    );
    expect(conPrograma.composicion).toHaveLength(sinPrograma.composicion.length);
  });
});

/* ========================================================================== */

describe('T-11 — Navegación y teclado de los tabs principales', () => {
  const PERMITIDOS = REPORTE_TABS_POR_AUDIENCIA.hospital;

  it('cada valor válido de la URL activa su tab', () => {
    for (const tab of REPORTE_TABS) {
      expect(tabDesdeBusqueda(`?tab=${tab}`, PERMITIDOS)).toBe(tab);
    }
  });

  it('una URL sin tab o con un valor inválido cae en Resumen', () => {
    expect(tabDesdeBusqueda('', PERMITIDOS)).toBeNull();
    expect(tabDesdeBusqueda('?otro=1', PERMITIDOS)).toBeNull();
    expect(tabDesdeBusqueda('?tab=inexistente', PERMITIDOS)).toBeNull();
    expect(tabDesdeBusqueda('?tab=', PERMITIDOS)).toBeNull();
    expect(tabDesdeBusqueda('?tab=finanzas', ['resumen'])).toBeNull();
    expect(REPORTE_TAB_INICIAL).toBe('resumen');
  });

  it('escribir el tab conserva los demás parámetros de la dirección', () => {
    const resultado = busquedaConTab('?vista=demo&orden=2', 'finanzas');
    const parametros = new URLSearchParams(resultado);

    expect(parametros.get('tab')).toBe('finanzas');
    expect(parametros.get('vista')).toBe('demo');
    expect(parametros.get('orden')).toBe('2');
    expect(busquedaConTab('?tab=resumen', 'operacion')).toBe('?tab=operacion');
  });

  it('la dirección escrita se vuelve a leer como el mismo tab', () => {
    for (const tab of REPORTE_TABS) {
      expect(tabDesdeBusqueda(busquedaConTab('?otro=1', tab), PERMITIDOS)).toBe(tab);
    }
  });

  it('las flechas recorren los tabs con retorno circular', () => {
    const tabs: readonly ReporteTabId[] = REPORTE_TABS;
    const ultimo = tabs[tabs.length - 1] as ReporteTabId;

    expect(focoDeTeclado(tabs, 'resumen', 'ArrowRight')).toBe('poblacion');
    expect(focoDeTeclado(tabs, ultimo, 'ArrowRight')).toBe('resumen');
    expect(focoDeTeclado(tabs, 'poblacion', 'ArrowLeft')).toBe('resumen');
    expect(focoDeTeclado(tabs, 'resumen', 'ArrowLeft')).toBe(ultimo);
  });

  it('Inicio y Fin van a los extremos y el resto de teclas no mueve el foco', () => {
    const tabs: readonly ReporteTabId[] = REPORTE_TABS;

    expect(focoDeTeclado(tabs, 'finanzas', 'Home')).toBe('resumen');
    expect(focoDeTeclado(tabs, 'resumen', 'End')).toBe(tabs[tabs.length - 1]);
    /* `Enter` y `Space` activan el botón de forma nativa: no mueven el foco. */
    expect(focoDeTeclado(tabs, 'resumen', 'Enter')).toBeNull();
    expect(focoDeTeclado(tabs, 'resumen', ' ')).toBeNull();
    expect(focoDeTeclado(tabs, 'resumen', 'Tab')).toBeNull();
  });

  it('un cambio de audiencia deja siempre un tab permitido y sincronizable', () => {
    const estado = { ...REPORTE_ESTADO_INICIAL, tab: 'finanzas' as const };

    expect(cambiarAudiencia(estado, 'alcaldia').tab).toBe('finanzas');
    expect(cambiarTab({ ...estado, tab: 'resumen' }, 'inexistente').tab).toBe(REPORTE_TAB_INICIAL);
    expect(tabDesdeBusqueda('?tab=finanzas', REPORTE_TABS_POR_AUDIENCIA.alcaldia)).toBe('finanzas');
  });
});
