import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import styles from './hospitalReports.module.css';
import { opcionesDeFiltro, universoDe } from './hospitalPopulationAnalytics';
import { pacientesPoblacionDemo, POBLACION_FECHA_CORTE } from './hospitalPopulationFixtures';
import type { PoblacionPaciente } from './hospitalPopulationTypes';
import {
  componerReporte,
  detalleOperativoDeInterseccion,
  graficosDePoblacion,
  pacientesDeInterseccion,
  universoFiltrado,
} from './hospitalReportsSnapshot';
import {
  REPORTE_AVISO_ALCANCE,
  REPORTE_AVISO_AUDIENCIA,
  REPORTE_AVISO_DESCRIPTIVO,
  REPORTE_BADGE_DATOS,
  REPORTE_DESCRIPCION,
  REPORTE_ESTADO_INICIAL,
  REPORTE_FECHA_CORTE_TEXTO,
  REPORTE_TABS_POR_AUDIENCIA,
  REPORTE_TITULO,
  aplicarFiltros,
  cambiarAudiencia,
  cambiarSubtab,
  cambiarTab,
  limpiarFiltros,
  type ReporteEstado,
} from './hospitalReportsConfig';
import { EVIDENCIA_COLUMNAS } from './hospitalReportsInstitutional';
import {
  eventosOperativosDemo,
  vinculacionesDemo,
  type OperacionVinculacion,
} from './hospitalReportsOperationalFixtures';
import {
  ReporteBarraFiltros,
  ReporteEncabezado,
  ReporteError,
  ReporteEsqueleto,
  ReporteGraficoBloque,
  ReporteIndicadores,
  ReporteKpiGrid,
  ReporteMatriz,
  ReporteMetadatos,
  ReportePanel,
  ReporteSubtabs,
  ReporteTablaBloque,
  ReporteTablaEvidencias,
  ReporteTabPanel,
  ReporteTabs,
  busquedaConTab,
  tabDesdeBusqueda,
} from './HospitalReportsPieces';
import {
  EVIDENCIA_ESTADOS,
  OPERACION_MODALIDADES,
  REPORTE_ETIQUETA_AUDIENCIA,
  REPORTE_TAB_INICIAL,
  type EvidenciaEstadoId,
  type OperacionEvento,
  type ReporteAudienciaId,
  type ReporteFiltros,
  type ReporteSubtabId,
  type ReporteTabId,
  type ReporteTabla,
} from './hospitalReportsTypes';
import { HospitalNote } from './HospitalViewPieces';

/**
 * Vista «Reportes» (TASK-003H-07).
 *
 * Dashboard ejecutivo con dos proyecciones de una única capacidad compartida:
 * `Vista Hospital` y `Vista institucional / Alcaldía`. No son dos módulos ni
 * dos implementaciones: son la misma composición sobre los mismos snapshots
 * versionados, con distinta audiencia.
 *
 * Todas las cifras proceden de `componerReporte`, que a su vez reutiliza las
 * definiciones de H-03B para población y los fixtures de H-06/H-06A para
 * finanzas. Este componente no cuenta, no suma, no deriva porcentajes y no
 * escribe ningún total: solo presenta.
 *
 * Diferencias por audiencia (§3.8): la vista institucional / Alcaldía recibe
 * información agregada, estadística, presupuestal, poblacional y de evidencia,
 * y NUNCA información clínica nominal, diagnósticos, contactos, dirección,
 * profesional o paciente identificado, salarios u honorarios individuales,
 * listados nominales, drill-down ni exportación. El cambio de audiencia es
 * atómico: una sola transición reemplaza el estado completo, de modo que la
 * vista nunca llega a pintar contenido de la audiencia anterior.
 *
 * Las cuatro acciones de exportación están siempre deshabilitadas y con su
 * motivo escrito: no descargan, no imprimen, no generan archivo y no simulan
 * ningún resultado.
 *
 * El tab principal es navegable: viaja en el parámetro `tab` de la URL, un
 * enlace profundo lo restaura al montar, Atrás y Adelante lo recuperan y
 * seleccionar otro conserva los demás parámetros. No se crea ninguna ruta
 * nueva, no se recarga la página y no se añade router ni dependencia alguna.
 * El resto del estado —audiencia, filtros, subtab y paneles— sigue siendo
 * local del montaje.
 *
 * Alcance: presentación demostrativa. No persiste, no consulta red ni
 * almacenamiento y no concede permisos. Sin backend, sin integraciones, sin
 * fuentes oficiales y sin cumplimiento automático.
 */

const TITULO_ID = 'hospital-reportes-titulo';

/** Estados locales de presentación del módulo (§3.9). */
export type ReporteEstadoVista = 'listo' | 'cargando' | 'error';

/** Entradas de datos; permiten a las pruebas trabajar con conjuntos pequeños. */
export interface HospitalReportsDatos {
  readonly pacientes?: readonly PoblacionPaciente[];
  readonly eventos?: readonly OperacionEvento[];
  readonly vinculaciones?: readonly OperacionVinculacion[];
}

export function HospitalReports({
  datos = {},
  corte = POBLACION_FECHA_CORTE,
  audienciaInicial,
  tabInicial,
  subtabInicial,
  filtrosIniciales,
  tablasIniciales,
  evidenciaInicial = null,
  detalleInicial = null,
  estadoInicial = 'listo',
}: {
  readonly datos?: HospitalReportsDatos;
  readonly corte?: string;
  /** Audiencia mostrada al montar. No persiste y no viaja por URL. */
  readonly audienciaInicial?: ReporteAudienciaId;
  /**
   * Tab mostrado al montar cuando la URL no trae uno válido; uno no permitido
   * cae en `Resumen`. El parámetro `tab` de la dirección tiene prioridad.
   */
  readonly tabInicial?: ReporteTabId;
  readonly subtabInicial?: ReporteSubtabId;
  readonly filtrosIniciales?: Partial<ReporteFiltros>;
  /** Gráficos con su tabla de valores desplegada al montar. */
  readonly tablasIniciales?: readonly string[];
  /** Evidencia cuyo panel de metadatos se muestra al montar. */
  readonly evidenciaInicial?: string | null;
  /** Intersección cuyo detalle agregado se muestra al montar. */
  readonly detalleInicial?: string | null;
  readonly estadoInicial?: ReporteEstadoVista;
}): ReactNode {
  const [estado, setEstado] = useState<ReporteEstado>(() => {
    const base: ReporteEstado = {
      ...REPORTE_ESTADO_INICIAL,
      filtros: {
        ...REPORTE_ESTADO_INICIAL.filtros,
        ...filtrosIniciales,
        prioridades: {
          ...REPORTE_ESTADO_INICIAL.filtros.prioridades,
          ...filtrosIniciales?.prioridades,
        },
      },
      subtab: subtabInicial ?? REPORTE_ESTADO_INICIAL.subtab,
      tablasAbiertas: tablasIniciales ?? [],
      evidenciaAbierta: evidenciaInicial,
      detalleAbierto: detalleInicial,
    };
    const conAudiencia =
      audienciaInicial === undefined
        ? base
        : {
            ...cambiarAudiencia(base, audienciaInicial),
            subtab: base.subtab,
            tablasAbiertas: base.tablasAbiertas,
            evidenciaAbierta: base.evidenciaAbierta,
            detalleAbierto: base.detalleAbierto,
          };

    return tabInicial === undefined
      ? conAudiencia
      : {
          ...cambiarTab(conAudiencia, tabInicial),
          evidenciaAbierta: conAudiencia.evidenciaAbierta,
          detalleAbierto: conAudiencia.detalleAbierto,
        };
  });
  const [vista, setVista] = useState<ReporteEstadoVista>(estadoInicial);
  const [evidenciaEstado, setEvidenciaEstado] = useState<string>('');
  const [evidenciaTipo, setEvidenciaTipo] = useState<string>('');
  const panelRef = useRef<HTMLDivElement>(null);
  const disparadorRef = useRef<HTMLButtonElement | null>(null);

  const pacientes = datos.pacientes ?? pacientesPoblacionDemo();
  const eventos = datos.eventos ?? eventosOperativosDemo();
  const vinculaciones = datos.vinculaciones ?? vinculacionesDemo();

  const opciones = useMemo(() => opcionesDeFiltro(universoDe(pacientes)), [pacientes]);
  const reporte = useMemo(
    () =>
      componerReporte(estado.filtros, estado.audiencia, {
        pacientes,
        eventos,
        vinculaciones,
        corte,
      }),
    [estado.filtros, estado.audiencia, pacientes, eventos, vinculaciones, corte],
  );
  const universo = useMemo(
    () => universoFiltrado(pacientes, estado.filtros, corte),
    [pacientes, estado.filtros, corte],
  );
  const graficosPoblacion = useMemo(
    () => graficosDePoblacion(reporte.poblacion, reporte.filtros.periodo),
    [reporte],
  );

  const esHospital = estado.audiencia === 'hospital';

  /* El panel recibe el foco una vez montado, no durante el evento del clic. */
  useEffect(() => {
    if (estado.evidenciaAbierta !== null || estado.detalleAbierto !== null) {
      panelRef.current?.focus();
    }
  }, [estado.evidenciaAbierta, estado.detalleAbierto]);

  /*
   * Al montar, el tab de la URL manda sobre `tabInicial`: un enlace profundo
   * debe abrir exactamente la sección que nombra. Si la URL no trae un tab
   * válido se escribe el vigente con `replaceState`, de modo que la dirección
   * quede completa sin añadir una entrada al historial.
   */
  useEffect(() => {
    setEstado((actual) => {
      const desdeUrl = tabDesdeBusqueda(
        window.location.search,
        REPORTE_TABS_POR_AUDIENCIA[actual.audiencia],
      );

      if (desdeUrl === null) {
        window.history.replaceState(
          null,
          '',
          busquedaConTab(window.location.search, actual.tab),
        );

        return actual;
      }

      return desdeUrl === actual.tab ? actual : cambiarTab(actual, desdeUrl);
    });
  }, []);

  /* Atrás y Adelante restauran el tab y su panel sin recargar la página. */
  useEffect(() => {
    function alNavegar(): void {
      setEstado((actual) => {
        const desdeUrl = tabDesdeBusqueda(
          window.location.search,
          REPORTE_TABS_POR_AUDIENCIA[actual.audiencia],
        );

        return cambiarTab(actual, desdeUrl ?? REPORTE_TAB_INICIAL);
      });
    }

    window.addEventListener('popstate', alNavegar);

    return () => {
      window.removeEventListener('popstate', alNavegar);
    };
  }, []);

  /**
   * Selección de un tab: estado visible y URL en la misma acción.
   *
   * `pushState` conserva los demás parámetros de la dirección y no recarga la
   * página; el historial recibe una entrada para que Atrás vuelva al tab
   * anterior.
   */
  function seleccionarTab(tab: ReporteTabId): void {
    const destino = REPORTE_TABS_POR_AUDIENCIA[estado.audiencia].includes(tab)
      ? tab
      : REPORTE_TAB_INICIAL;

    setEstado((actual) => cambiarTab(actual, destino));
    window.history.pushState(null, '', busquedaConTab(window.location.search, destino));
  }

  /**
   * Cambio de audiencia: una sola transición atómica. Cuando deja el tab fuera
   * de los permitidos, `cambiarAudiencia` ya fuerza `Resumen` y aquí se
   * sincroniza la URL con `replaceState`, sin pasar por el panel anterior.
   */
  function seleccionarAudiencia(audiencia: ReporteAudienciaId): void {
    const siguiente = cambiarAudiencia(estado, audiencia);

    setEstado(siguiente);

    if (siguiente.tab !== estado.tab) {
      window.history.replaceState(
        null,
        '',
        busquedaConTab(window.location.search, siguiente.tab),
      );
    }
  }

  function alternarTabla(id: string): void {
    setEstado((actual) => ({
      ...actual,
      tablasAbiertas: actual.tablasAbiertas.includes(id)
        ? actual.tablasAbiertas.filter((abierta) => abierta !== id)
        : [...actual.tablasAbiertas, id],
    }));
  }

  function cerrarPanel(): void {
    setEstado((actual) => ({ ...actual, evidenciaAbierta: null, detalleAbierto: null }));
    disparadorRef.current?.focus();
  }

  const evidenciasVisibles = reporte.institucional.evidencias.filter((registro) => {
    const espacio = reporte.institucional.espacios.find((item) => item.id === estado.subtab);

    if (espacio !== undefined && registro.marco !== espacio.marco) {
      return false;
    }
    if (evidenciaEstado !== '' && registro.estado !== evidenciaEstado) {
      return false;
    }

    return evidenciaTipo === '' || registro.tipo === evidenciaTipo;
  });

  const tiposEvidencia = [
    ...new Set(reporte.institucional.evidencias.map((registro) => registro.tipo)),
  ].sort((a, b) => a.localeCompare(b, 'es-CO'));

  const evidenciaAbierta =
    reporte.institucional.evidencias.find(
      (registro) => registro.id === estado.evidenciaAbierta,
    ) ?? null;

  const detalleTabla: ReporteTabla | null = useMemo(() => {
    if (estado.detalleAbierto === null || !esHospital) {
      return null;
    }

    const celda = reporte.poblacion.intersecciones.find(
      (item) => item.id === estado.detalleAbierto,
    );

    if (celda === undefined) {
      return null;
    }

    return detalleOperativoDeInterseccion(
      celda.id,
      celda.etiqueta,
      pacientesDeInterseccion(universo, celda.id, reporte.poblacion, corte),
      eventos.filter((evento) => evento.periodo === reporte.filtros.periodo),
      reporte.filtros.periodo,
    );
  }, [estado.detalleAbierto, esHospital, reporte, universo, eventos, corte]);

  const encabezado = (
    <ReporteEncabezado
      titulo={REPORTE_TITULO}
      descripcion={REPORTE_DESCRIPCION}
      badge={REPORTE_BADGE_DATOS}
      corte={REPORTE_FECHA_CORTE_TEXTO}
      audiencia={estado.audiencia}
      tituloId={TITULO_ID}
      onAudiencia={seleccionarAudiencia}
    />
  );

  if (vista === 'cargando') {
    return (
      <div className={styles.vista}>
        {encabezado}
        <ReporteEsqueleto />
      </div>
    );
  }

  if (vista === 'error') {
    return (
      <div className={styles.vista}>
        {encabezado}
        <ReporteError
          onReintentar={() => {
            setVista('listo');
          }}
        />
      </div>
    );
  }

  return (
    <div
      className={styles.vista}
      data-hospital-reportes={reporte.version}
      data-hospital-audiencia-activa={estado.audiencia}
    >
      {encabezado}

      <p className="merdn-sr-only" role="status">
        {estado.anuncio}
      </p>

      <ReporteBarraFiltros
        filtros={estado.filtros}
        programas={opciones.programa}
        municipios={opciones.municipio}
        eps={opciones.eps}
        modalidades={OPERACION_MODALIDADES}
        onFiltro={(cambio) => {
          setEstado((actual) => aplicarFiltros(actual, cambio));
        }}
        onLimpiar={() => {
          setEstado((actual) => limpiarFiltros(actual));
        }}
      />

      <ReporteTabs
        tabs={REPORTE_TABS_POR_AUDIENCIA[estado.audiencia]}
        activo={estado.tab}
        onTab={seleccionarTab}
      />

      <p className={styles.aviso}>{REPORTE_AVISO_AUDIENCIA[estado.audiencia]}</p>

      {estado.tab === 'resumen' ? (
        <ReporteTabPanel tab="resumen">
          <ReporteKpiGrid
            cifras={reporte.resumen}
            etiquetaAccesible={`Indicadores del resumen · ${REPORTE_ETIQUETA_AUDIENCIA[estado.audiencia]}`}
          />
          <div className={styles.cuerpo}>
            <div className={styles.columna}>
              <ReporteGraficoBloque
                grafico={reporte.operacion.graficos[0] ?? reporte.evolucionBeneficiarios}
                abierto={estado.tablasAbiertas.includes('evolucion')}
                onAlternar={() => {
                  alternarTabla('evolucion');
                }}
              />
              <ReporteGraficoBloque
                grafico={
                  reporte.operacion.graficos.find((grafico) => grafico.id === 'modalidad') ??
                  reporte.evolucionBeneficiarios
                }
                abierto={estado.tablasAbiertas.includes('modalidad')}
                onAlternar={() => {
                  alternarTabla('modalidad');
                }}
              />
            </div>
            <div className={styles.columna}>
              <ReporteGraficoBloque
                grafico={reporte.finanzas.ejecucionGrafico}
                abierto={estado.tablasAbiertas.includes('ejecucion-barras')}
                onAlternar={() => {
                  alternarTabla('ejecucion-barras');
                }}
              />
              <ReporteTablaBloque
                tabla={{
                  id: 'necesita-atencion',
                  titulo: 'Necesita atención',
                  leyenda:
                    'Pendientes operativos, financieros y de evidencia del periodo, agregados y sin referencia nominal.',
                  columnas: [
                    { id: 'categoria', etiqueta: 'Categoría' },
                    { id: 'asunto', etiqueta: 'Asunto' },
                    { id: 'contexto', etiqueta: 'Contexto' },
                    { id: 'fuente', etiqueta: 'Fuente' },
                  ],
                  filas: reporte.atencion,
                  nota: 'Avisos de organización del trabajo. No son alertas clínicas y no contienen nombres, documentos ni contactos.',
                  vacio: 'Sin pendientes registrados para los filtros aplicados.',
                }}
              />
            </div>
          </div>
        </ReporteTabPanel>
      ) : null}

      {estado.tab === 'poblacion' ? (
        <ReporteTabPanel tab="poblacion">
          <ReporteKpiGrid
            cifras={reporte.kpiPoblacion}
            etiquetaAccesible="Indicadores de población"
          />
          <ReporteMatriz
            intersecciones={reporte.poblacion.intersecciones}
            universo={reporte.poblacion.universo}
            conDetalle={esHospital}
            onDetalle={(id) => {
              setEstado((actual) => ({ ...actual, detalleAbierto: id, evidenciaAbierta: null }));
            }}
          />
          <div className={styles.graficos}>
            {graficosPoblacion.map((grafico) => (
              <ReporteGraficoBloque
                key={grafico.id}
                grafico={grafico}
                abierto={estado.tablasAbiertas.includes(grafico.id)}
                onAlternar={() => {
                  alternarTabla(grafico.id);
                }}
              />
            ))}
          </div>
        </ReporteTabPanel>
      ) : null}

      {estado.tab === 'operacion' ? (
        <ReporteTabPanel tab="operacion">
          <ReporteKpiGrid
            cifras={reporte.operacion.kpi}
            etiquetaAccesible="Indicadores de operación"
          />
          <div className={styles.graficos}>
            {reporte.operacion.graficos.map((grafico) => (
              <ReporteGraficoBloque
                key={grafico.id}
                grafico={grafico}
                abierto={estado.tablasAbiertas.includes(grafico.id)}
                onAlternar={() => {
                  alternarTabla(grafico.id);
                }}
              />
            ))}
          </div>
          <ReporteTablaBloque tabla={reporte.operacion.resumenOperativo} />
        </ReporteTabPanel>
      ) : null}

      {estado.tab === 'finanzas' ? (
        <ReporteTabPanel tab="finanzas">
          <ReporteKpiGrid
            cifras={reporte.finanzas.kpi}
            etiquetaAccesible="Indicadores financieros"
          />
          <div className={styles.graficos}>
            <ReporteGraficoBloque
              grafico={reporte.finanzas.ejecucionGrafico}
              abierto={estado.tablasAbiertas.includes('ejecucion-barras')}
              onAlternar={() => {
                alternarTabla('ejecucion-barras');
              }}
            />
            <ReporteGraficoBloque
              grafico={reporte.finanzas.flujo}
              abierto={estado.tablasAbiertas.includes('flujo')}
              onAlternar={() => {
                alternarTabla('flujo');
              }}
            />
          </div>
          <ReporteTablaBloque tabla={reporte.finanzas.ejecucionPorPrograma} />
          <ReporteKpiGrid
            cifras={reporte.finanzas.composicion}
            etiquetaAccesible="Composición agregada del periodo"
          />
          <ReporteTablaBloque tabla={reporte.finanzas.pagosPendientes} />
          <ReporteTablaBloque tabla={reporte.finanzas.evidenciasFaltantes} />
          <ReporteIndicadores
            indicadores={reporte.poblacionRecursos}
            aviso={REPORTE_AVISO_DESCRIPTIVO}
          />
          <ReporteTablaBloque tabla={reporte.tablaRecursos} />
          <ReporteGraficoBloque
            grafico={reporte.evolucionBeneficiarios}
            abierto={estado.tablasAbiertas.includes('evolucion-beneficiarios')}
            onAlternar={() => {
              alternarTabla('evolucion-beneficiarios');
            }}
          />
        </ReporteTabPanel>
      ) : null}

      {estado.tab === 'institucional' ? (
        <ReporteTabPanel tab="institucional">
          <ReporteSubtabs
            activo={estado.subtab}
            onSubtab={(subtab) => {
              setEstado((actual) => cambiarSubtab(actual, subtab));
            }}
          />
          {reporte.institucional.espacios
            .filter((espacio) => espacio.id === estado.subtab)
            .map((espacio) => (
              <section
                className={styles.bloque}
                key={espacio.id}
                aria-labelledby={`hospital-reportes-esp-${espacio.id}`}
              >
                <h3 className={styles.bloqueTitulo} id={`hospital-reportes-esp-${espacio.id}`}>
                  {espacio.titulo}
                </h3>
                <p className={styles.bloqueNota}>{espacio.descripcion}</p>
                <p className={styles.limite}>{espacio.limite}</p>

                <div className={styles.filtros}>
                  <div className={styles.filtro}>
                    <label className={styles.filtroEtiqueta} htmlFor="hospital-reportes-ev-estado">
                      Estado de la evidencia
                    </label>
                    <select
                      id="hospital-reportes-ev-estado"
                      className={styles.filtroCampo}
                      value={evidenciaEstado}
                      onChange={(evento) => {
                        setEvidenciaEstado(evento.target.value);
                      }}
                    >
                      <option value="">Todos · estados</option>
                      {EVIDENCIA_ESTADOS.map((valor: EvidenciaEstadoId) => (
                        <option key={valor} value={valor}>
                          {valor}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.filtro}>
                    <label className={styles.filtroEtiqueta} htmlFor="hospital-reportes-ev-tipo">
                      Tipo de evidencia
                    </label>
                    <select
                      id="hospital-reportes-ev-tipo"
                      className={styles.filtroCampo}
                      value={evidenciaTipo}
                      onChange={(evento) => {
                        setEvidenciaTipo(evento.target.value);
                      }}
                    >
                      <option value="">Todos · tipos</option>
                      {tiposEvidencia.map((valor) => (
                        <option key={valor} value={valor}>
                          {valor}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <ReporteTablaEvidencias
                  evidencias={evidenciasVisibles}
                  columnas={EVIDENCIA_COLUMNAS}
                  vacio="Sin evidencias para los filtros aplicados en este espacio."
                  onAbrir={(id) => {
                    setEstado((actual) => ({
                      ...actual,
                      evidenciaAbierta: id,
                      detalleAbierto: null,
                    }));
                  }}
                />

                <ReporteTablaBloque
                  tabla={{
                    id: `marco-${espacio.id}`,
                    titulo: `Organización del marco · ${espacio.titulo}`,
                    leyenda:
                      'Tema o requisito, qué se organiza, periodo, evidencia, responsable, brecha declarada, procedencia y estado.',
                    columnas: espacio.columnas,
                    filas: espacio.registros.map((registro) => ({
                      id: registro.id,
                      celdas: [
                        registro.tema,
                        registro.requisito,
                        registro.periodo,
                        registro.evidencia,
                        registro.responsable,
                        registro.brecha,
                        registro.procedencia,
                        registro.estado,
                      ],
                    })),
                    nota: espacio.limite,
                    vacio: espacio.vacio,
                  }}
                />
              </section>
            ))}
          <ReporteGraficoBloque
            grafico={{
              id: 'evidencias-estado',
              titulo: 'Evidencias por estado documental',
              unidad: 'Evidencias',
              periodo: reporte.institucional.periodo,
              nota: 'Los cuatro estados se muestran siempre, incluso cuando no hay ninguna evidencia en ellos.',
              procedencia: reporte.institucional.procedencia,
              estado: 'disponible',
              series: [
                {
                  id: 'estados',
                  etiqueta: 'Evidencias',
                  puntos: reporte.institucional.conteoPorEstado,
                },
              ],
              encabezado: 'Estado',
            }}
            abierto={estado.tablasAbiertas.includes('evidencias-estado')}
            onAlternar={() => {
              alternarTabla('evidencias-estado');
            }}
          />
        </ReporteTabPanel>
      ) : null}

      <HospitalNote>{REPORTE_AVISO_ALCANCE}</HospitalNote>
      <p className={styles.bloqueNota}>{reporte.calidad.cobertura}</p>
      <p className={styles.bloqueNota}>{reporte.calidad.actualizacion}</p>

      {evidenciaAbierta === null ? null : (
        <ReportePanel
          titulo={`Metadatos · ${evidenciaAbierta.evidencia}`}
          referencia={panelRef}
          onCerrar={cerrarPanel}
        >
          <ReporteMetadatos evidencia={evidenciaAbierta} />
        </ReportePanel>
      )}

      {detalleTabla === null ? null : (
        <ReportePanel titulo={detalleTabla.titulo} referencia={panelRef} onCerrar={cerrarPanel}>
          <ReporteTablaBloque tabla={detalleTabla} />
        </ReportePanel>
      )}
    </div>
  );
}
