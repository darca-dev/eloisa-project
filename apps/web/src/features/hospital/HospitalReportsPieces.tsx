import { useRef, type CSSProperties, type ReactNode, type Ref } from 'react';

import styles from './hospitalReports.module.css';
import { formatearNumero, textoPorcentaje } from './hospitalPopulationAnalytics';
import type { PoblacionInterseccion } from './hospitalPopulationTypes';
import {
  REPORTE_ACCIONES,
  REPORTE_ETIQUETA_FILTRO,
  REPORTE_MOTIVO_EXPORTACION,
  REPORTE_PERIODOS,
  resumenDeFiltros,
} from './hospitalReportsConfig';
import {
  REPORTE_AUDIENCIAS,
  REPORTE_ETIQUETA_AUDIENCIA,
  REPORTE_ETIQUETA_ESTADO,
  REPORTE_ETIQUETA_SUBTAB,
  REPORTE_ETIQUETA_TAB,
  REPORTE_SUBTABS,
  type EvidenciaRegistro,
  type ReporteAudienciaId,
  type ReporteCifra,
  type ReporteFiltros,
  type ReporteGrafico,
  type ReporteIndicador,
  type ReporteSubtabId,
  type ReporteTabId,
  type ReporteTabla,
} from './hospitalReportsTypes';

/**
 * Piezas de presentación de «Reportes» (TASK-003H-07, §3).
 *
 * Todas reciben su contenido ya compuesto por propiedades tipadas: ninguna
 * calcula métricas, ninguna conoce fixtures y ninguna consulta nada. Las
 * cifras llegan desde los snapshots versionados y conservan su periodo, su
 * procedencia, su estado de dato y su definición.
 *
 * Accesibilidad: ningún estado se comunica solo por color; las barras son
 * decorativas y siempre van acompañadas de su valor escrito; cada gráfico
 * ofrece su tabla de valores; los controles son botones reales con estado
 * anunciado y objetivos táctiles suficientes.
 *
 * Ninguna acción de exportación funciona: se muestran deshabilitadas y con su
 * motivo escrito, y no simulan archivo, descarga, impresión ni generación.
 */

/** Une clases opcionales sin dependencias externas. */
function clases(...valores: readonly (string | undefined | false)[]): string {
  return valores.filter((valor): valor is string => typeof valor === 'string').join(' ');
}

/* ========================================================================== */
/* Encabezado y selector de audiencia                                         */
/* ========================================================================== */

/** Encabezado con badge, fecha de corte y selector segmentado de audiencia. */
export function ReporteEncabezado({
  titulo,
  descripcion,
  badge,
  corte,
  audiencia,
  tituloId,
  onAudiencia,
}: {
  readonly titulo: string;
  readonly descripcion: string;
  readonly badge: string;
  readonly corte: string;
  readonly audiencia: ReporteAudienciaId;
  readonly tituloId: string;
  readonly onAudiencia: (audiencia: ReporteAudienciaId) => void;
}): ReactNode {
  return (
    <div className={styles.encabezado}>
      <div className={styles.encabezadoTextos}>
        <h1 className={styles.titulo} id={tituloId}>
          {titulo}
        </h1>
        <p className={styles.intro}>{descripcion}</p>
      </div>
      <div className={styles.marcas}>
        <span className={styles.badge}>{badge}</span>
        <span className={styles.corte}>{corte}</span>
        <div className={styles.selector} role="group" aria-label="Audiencia del reporte">
          {REPORTE_AUDIENCIAS.map((opcion) => (
            <button
              key={opcion}
              type="button"
              aria-pressed={opcion === audiencia}
              data-hospital-audiencia={opcion}
              className={clases(styles.selectorBoton, opcion === audiencia && styles.selectorActivo)}
              onClick={() => {
                onAudiencia(opcion);
              }}
            >
              {REPORTE_ETIQUETA_AUDIENCIA[opcion]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ========================================================================== */
/* Barra global de filtros                                                    */
/* ========================================================================== */

/**
 * Selector compacto de un filtro de la barra global.
 *
 * HOSPITAL-REPORTS-UX-01: usa las clases propias de la barra
 * (`barraCampo*`) en lugar de las genéricas `filtro*`, que siguen sirviendo al
 * bloque de filtros de «Evidencias e institucional» sin cambiar de aspecto. El
 * marcado, la etiqueta asociada, la opción vacía y el manejador son los mismos.
 */
function FiltroSelect({
  id,
  etiqueta,
  valor,
  opciones,
  obligatorio,
  onCambiar,
}: {
  readonly id: string;
  readonly etiqueta: string;
  readonly valor: string;
  readonly opciones: readonly string[];
  readonly obligatorio?: boolean;
  readonly onCambiar: (valor: string) => void;
}): ReactNode {
  return (
    <div className={styles.barraCampo}>
      <label className={styles.barraCampoEtiqueta} htmlFor={id}>
        {etiqueta}
      </label>
      <select
        id={id}
        className={styles.barraCampoControl}
        value={valor}
        onChange={(evento) => {
          onCambiar(evento.target.value);
        }}
      >
        {obligatorio === true ? null : (
          <option value="">{`Todos · ${etiqueta.toLocaleLowerCase('es-CO')}`}</option>
        )}
        {opciones.map((opcion) => (
          <option key={opcion} value={opcion}>
            {opcion}
          </option>
        ))}
      </select>
    </div>
  );
}

const FILTRO_ID = 'hospital-reportes-filtro';

/**
 * Barra global fija (§3.1).
 *
 * `Periodo` es obligatorio y no ofrece opción vacía. Las tres condiciones
 * prioritarias son chips combinables que se exigen todas a la vez. Las cuatro
 * acciones de exportación están siempre deshabilitadas y su motivo se escribe
 * como texto, no solo como `title`.
 *
 * HOSPITAL-REPORTS-UX-01: la composición es compacta y `sticky`. Solo cambian
 * la densidad, el reparto y las clases de presentación: los seis filtros, sus
 * valores, sus opciones, su orden, su semántica y sus manejadores son
 * exactamente los mismos, y ninguna acción nueva aparece.
 */
export function ReporteBarraFiltros({
  filtros,
  programas,
  municipios,
  eps,
  modalidades,
  onFiltro,
  onLimpiar,
}: {
  readonly filtros: ReporteFiltros;
  readonly programas: readonly string[];
  readonly municipios: readonly string[];
  readonly eps: readonly string[];
  readonly modalidades: readonly string[];
  readonly onFiltro: (cambio: Partial<ReporteFiltros>) => void;
  readonly onLimpiar: () => void;
}): ReactNode {
  const prioridades: readonly (readonly [keyof ReporteFiltros['prioridades'], string])[] = [
    ['mayor60', 'Mayor de 60'],
    ['discapacidad', 'Discapacidad'],
    ['cuidadosCasa', 'Cuidados en casa'],
  ];

  return (
    <section className={styles.barra} aria-label="Filtros del reporte">
      <div className={styles.barraCampos}>
        <FiltroSelect
          id={`${FILTRO_ID}-periodo`}
          etiqueta={REPORTE_ETIQUETA_FILTRO.periodo}
          valor={filtros.periodo}
          opciones={REPORTE_PERIODOS}
          obligatorio
          onCambiar={(valor) => {
            onFiltro({ periodo: valor });
          }}
        />
        <FiltroSelect
          id={`${FILTRO_ID}-programa`}
          etiqueta={REPORTE_ETIQUETA_FILTRO.programa}
          valor={filtros.programa}
          opciones={programas}
          onCambiar={(valor) => {
            onFiltro({ programa: valor });
          }}
        />
        <FiltroSelect
          id={`${FILTRO_ID}-municipio`}
          etiqueta={REPORTE_ETIQUETA_FILTRO.municipio}
          valor={filtros.municipio}
          opciones={municipios}
          onCambiar={(valor) => {
            onFiltro({ municipio: valor });
          }}
        />
        <div className={clases(styles.barraCampo, styles.barraCampoPrioridades)}>
          <span className={styles.barraCampoEtiqueta} id={`${FILTRO_ID}-prioridades`}>
            {REPORTE_ETIQUETA_FILTRO.prioridades}
          </span>
          <div className={styles.chips} role="group" aria-labelledby={`${FILTRO_ID}-prioridades`}>
            {prioridades.map(([clave, etiqueta]) => (
              <button
                key={clave}
                type="button"
                aria-pressed={filtros.prioridades[clave]}
                className={clases(styles.chip, filtros.prioridades[clave] && styles.chipActivo)}
                onClick={() => {
                  onFiltro({
                    prioridades: { ...filtros.prioridades, [clave]: !filtros.prioridades[clave] },
                  });
                }}
              >
                {etiqueta}
              </button>
            ))}
          </div>
        </div>
        <FiltroSelect
          id={`${FILTRO_ID}-eps`}
          etiqueta={REPORTE_ETIQUETA_FILTRO.eps}
          valor={filtros.eps}
          opciones={eps}
          onCambiar={(valor) => {
            onFiltro({ eps: valor });
          }}
        />
        <FiltroSelect
          id={`${FILTRO_ID}-modalidad`}
          etiqueta={REPORTE_ETIQUETA_FILTRO.modalidad}
          valor={filtros.modalidad}
          opciones={modalidades}
          onCambiar={(valor) => {
            onFiltro({ modalidad: valor });
          }}
        />
      </div>

      <div className={styles.barraPie}>
        <p className={styles.resumenFiltros}>{`Filtros aplicados · ${resumenDeFiltros(filtros)}`}</p>
        <div className={styles.acciones}>
          <button
            type="button"
            className={clases(styles.limpiar, styles.limpiarCompacto)}
            onClick={onLimpiar}
          >
            Limpiar filtros
          </button>
          {REPORTE_ACCIONES.map((accion) => (
            <button
              key={accion.id}
              type="button"
              disabled
              aria-disabled="true"
              className={styles.accion}
              data-hospital-accion={accion.id}
            >
              {accion.etiqueta}
            </button>
          ))}
        </div>
        <p className={styles.accionMotivo}>{REPORTE_MOTIVO_EXPORTACION}</p>
      </div>
    </section>
  );
}

/* ========================================================================== */
/* Tabs                                                                       */
/* ========================================================================== */

/* -------------------------- Navegación de los tabs ------------------------ */

/** Único parámetro de URL que representa el tab principal (§3.1). */
export const REPORTE_PARAMETRO_TAB = 'tab';

/** Identificador estable del control de un tab. */
export function idDeTab(tab: ReporteTabId): string {
  return `hospital-reportes-tab-${tab}`;
}

/** Identificador estable del panel de un tab. */
export function idDePanel(tab: ReporteTabId): string {
  return `hospital-reportes-panel-${tab}`;
}

/**
 * Tab válido codificado en la cadena de búsqueda de la URL.
 *
 * Devuelve `null` cuando el parámetro falta o no es uno de los tabs permitidos
 * para la audiencia activa, de modo que quien la llama pueda caer en `Resumen`.
 * Es una función pura: no lee la URL por su cuenta y por eso se puede verificar
 * sin navegador.
 */
export function tabDesdeBusqueda(
  busqueda: string,
  permitidos: readonly ReporteTabId[],
): ReporteTabId | null {
  const valor = new URLSearchParams(busqueda).get(REPORTE_PARAMETRO_TAB);

  return valor !== null && (permitidos as readonly string[]).includes(valor)
    ? (valor as ReporteTabId)
    : null;
}

/**
 * Cadena de búsqueda con el tab indicado, conservando los demás parámetros ya
 * presentes en la URL. Nunca crea rutas: solo reescribe un parámetro.
 */
export function busquedaConTab(busqueda: string, tab: ReporteTabId): string {
  const parametros = new URLSearchParams(busqueda);

  parametros.set(REPORTE_PARAMETRO_TAB, tab);

  return `?${parametros.toString()}`;
}

/**
 * Tab al que el teclado debe mover el FOCO, sin activarlo (patrón de
 * activación manual). `ArrowRight` y `ArrowLeft` recorren la lista con retorno
 * circular; `Home` y `End` van a los extremos. Cualquier otra tecla devuelve
 * `null` y no altera el foco.
 */
export function focoDeTeclado(
  tabs: readonly ReporteTabId[],
  actual: ReporteTabId,
  tecla: string,
): ReporteTabId | null {
  const indice = tabs.indexOf(actual);

  if (indice === -1 || tabs.length === 0) {
    return null;
  }

  switch (tecla) {
    case 'ArrowRight':
      return tabs[(indice + 1) % tabs.length] ?? null;
    case 'ArrowLeft':
      return tabs[(indice - 1 + tabs.length) % tabs.length] ?? null;
    case 'Home':
      return tabs[0] ?? null;
    case 'End':
      return tabs[tabs.length - 1] ?? null;
    default:
      return null;
  }
}

/**
 * Tabs principales como `tablist` accesible (§3.1 y §3.9).
 *
 * El tab activo declara `aria-selected="true"`, es el único con `tabIndex` 0 y
 * apunta a su panel con `aria-controls`. Las flechas, `Home` y `End` mueven el
 * foco sin activar; `Enter` y `Space` activan el tab enfocado por ser botones
 * reales, y el foco permanece en el tab activado porque la activación no lo
 * traslada a ningún otro elemento.
 */
export function ReporteTabs({
  tabs,
  activo,
  onTab,
}: {
  readonly tabs: readonly ReporteTabId[];
  readonly activo: ReporteTabId;
  readonly onTab: (tab: ReporteTabId) => void;
}): ReactNode {
  const referencias = useRef<Partial<Record<ReporteTabId, HTMLButtonElement | null>>>({});

  return (
    <div className={styles.tabs} role="tablist" aria-label="Secciones del reporte">
      {tabs.map((tab) => (
        <button
          key={tab}
          type="button"
          role="tab"
          id={idDeTab(tab)}
          aria-selected={tab === activo}
          aria-controls={idDePanel(tab)}
          tabIndex={tab === activo ? 0 : -1}
          ref={(elemento) => {
            referencias.current[tab] = elemento;
          }}
          data-hospital-tab={tab}
          className={clases(styles.tab, tab === activo && styles.tabActivo)}
          onKeyDown={(evento) => {
            const destino = focoDeTeclado(tabs, tab, evento.key);

            if (destino !== null) {
              evento.preventDefault();
              referencias.current[destino]?.focus();
            }
          }}
          onClick={() => {
            onTab(tab);
          }}
        >
          {REPORTE_ETIQUETA_TAB[tab]}
        </button>
      ))}
    </div>
  );
}

/**
 * Panel del tab activo.
 *
 * Solo se monta el panel del tab seleccionado, de modo que nunca hay dos
 * paneles activos. Reutiliza la columna en flujo vertical ya aprobada para
 * conservar exactamente la separación entre bloques.
 */
export function ReporteTabPanel({
  tab,
  children,
}: {
  readonly tab: ReporteTabId;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <div
      className={styles.columna}
      role="tabpanel"
      id={idDePanel(tab)}
      aria-labelledby={idDeTab(tab)}
      data-hospital-panel={tab}
    >
      {children}
    </div>
  );
}

/** Subtabs del bloque institucional. */
export function ReporteSubtabs({
  activo,
  onSubtab,
}: {
  readonly activo: ReporteSubtabId;
  readonly onSubtab: (subtab: ReporteSubtabId) => void;
}): ReactNode {
  return (
    <div className={styles.subtabs} role="group" aria-label="Espacios institucionales">
      {REPORTE_SUBTABS.map((subtab) => (
        <button
          key={subtab}
          type="button"
          aria-pressed={subtab === activo}
          data-hospital-subtab={subtab}
          className={clases(styles.subtab, subtab === activo && styles.subtabActivo)}
          onClick={() => {
            onSubtab(subtab);
          }}
        >
          {REPORTE_ETIQUETA_SUBTAB[subtab]}
        </button>
      ))}
    </div>
  );
}

/* ========================================================================== */
/* KPI                                                                        */
/* ========================================================================== */

/** Tarjeta de una cifra, con su estado de dato y su `Cómo se calcula`. */
function ReporteKpiCard({ cifra }: { readonly cifra: ReporteCifra }): ReactNode {
  return (
    <li className={styles.kpiCard}>
      <span className={styles.kpiEtiqueta}>{cifra.etiqueta}</span>
      <span className={styles.kpiValor}>{cifra.valor}</span>
      <span className={styles.kpiMeta}>{`${cifra.unidad} · ${cifra.periodo}`}</span>
      <span className={styles.kpiMeta}>{`Procedencia: ${cifra.procedencia}`}</span>
      <span
        className={clases(
          styles.kpiEstado,
          (cifra.estado === 'ausente' || cifra.estado === 'no-calculable') &&
            styles.kpiEstadoAusente,
        )}
      >
        {REPORTE_ETIQUETA_ESTADO[cifra.estado]}
      </span>
      <details className={styles.definicion}>
        <summary className={styles.definicionResumen}>Cómo se calcula</summary>
        <p className={styles.definicionCuerpo}>
          {`${cifra.definicion} Versión de definiciones: ${cifra.version}. Limitaciones: ${cifra.limitaciones}`}
        </p>
        {cifra.desglose === undefined || cifra.desglose.length === 0 ? null : (
          <ul className={styles.desglose}>
            {cifra.desglose.map((parte) => (
              <li key={parte.id}>{`${parte.etiqueta}: ${parte.valor}`}</li>
            ))}
          </ul>
        )}
      </details>
    </li>
  );
}

/** Rejilla de cifras. */
export function ReporteKpiGrid({
  cifras,
  etiquetaAccesible,
}: {
  readonly cifras: readonly ReporteCifra[];
  readonly etiquetaAccesible: string;
}): ReactNode {
  return (
    <ul className={styles.kpiGrid} aria-label={etiquetaAccesible}>
      {cifras.map((cifra) => (
        <ReporteKpiCard cifra={cifra} key={cifra.id} />
      ))}
    </ul>
  );
}

/* ========================================================================== */
/* Gráficos                                                                   */
/* ========================================================================== */

/** Ancho relativo de una barra respecto del valor máximo de su serie. */
function anchoDe(valor: number, maximo: number): string {
  return maximo === 0 ? '0%' : `${String(Math.round((valor / maximo) * 100))}%`;
}

/**
 * Gráfico de barras con su tabla accesible.
 *
 * La barra es decorativa: el valor siempre se lee como texto al lado. La tabla
 * de valores se despliega con un control propio y repite exactamente las
 * mismas cifras.
 */
export function ReporteGraficoBloque({
  grafico,
  abierto,
  onAlternar,
}: {
  readonly grafico: ReporteGrafico;
  readonly abierto: boolean;
  readonly onAlternar: () => void;
}): ReactNode {
  const tituloId = `hospital-reportes-gr-${grafico.id}`;
  const maximo = grafico.series.reduce(
    (mayor, serie) =>
      serie.puntos.reduce((interno, punto) => Math.max(interno, punto.valor), mayor),
    0,
  );

  return (
    <section className={clases(styles.bloque, styles.grafico)} aria-labelledby={tituloId}>
      <div className={styles.graficoCabecera}>
        <h3 className={styles.graficoTitulo} id={tituloId}>
          {grafico.titulo}
        </h3>
        <button
          type="button"
          aria-expanded={abierto}
          aria-controls={`${tituloId}-tabla`}
          className={styles.detalleBoton}
          onClick={onAlternar}
        >
          Ver tabla de valores
          <span className="merdn-sr-only">{` de ${grafico.titulo}`}</span>
        </button>
      </div>
      <p className={styles.bloqueNota}>
        {`${grafico.unidad} · ${grafico.periodo} · ${REPORTE_ETIQUETA_ESTADO[grafico.estado]} · Procedencia: ${grafico.procedencia}`}
      </p>
      <p className={styles.bloqueNota}>{grafico.nota}</p>

      {grafico.series.map((serie) => (
        <div className={styles.serie} key={serie.id}>
          {grafico.series.length > 1 ? (
            <h4 className={styles.serieTitulo}>{serie.etiqueta}</h4>
          ) : null}
          <ul className={styles.barras}>
            {serie.puntos.map((punto) => (
              <li className={styles.barraItem} key={punto.id}>
                <span className={styles.barraEtiqueta}>{punto.etiqueta}</span>
                <span className={styles.barraPista} aria-hidden="true">
                  <span
                    className={styles.barraRelleno}
                    style={{ '--h-rep-ancho': anchoDe(punto.valor, maximo) } as CSSProperties}
                  />
                </span>
                <span className={styles.barraValor}>{punto.texto}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}

      <div id={`${tituloId}-tabla`} hidden={!abierto}>
        <div className={styles.tablaContenedor}>
          <table className={styles.tabla}>
            <caption>{`Tabla de valores de ${grafico.titulo}. Unidad: ${grafico.unidad}. Periodo: ${grafico.periodo}.`}</caption>
            <thead>
              <tr>
                <th scope="col">{grafico.encabezado}</th>
                {grafico.series.map((serie) => (
                  <th className={styles.numerica} scope="col" key={serie.id}>
                    {serie.etiqueta}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(grafico.series[0]?.puntos ?? []).map((punto, indice) => (
                <tr key={punto.id}>
                  <th scope="row">{punto.etiqueta}</th>
                  {grafico.series.map((serie) => (
                    <td className={styles.numerica} key={serie.id}>
                      {serie.puntos[indice]?.texto ?? '—'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

/* ========================================================================== */
/* Tablas                                                                     */
/* ========================================================================== */

/** Tabla compacta con leyenda, primera columna fija y desplazamiento propio. */
export function ReporteTablaBloque({
  tabla,
  extra,
}: {
  readonly tabla: ReporteTabla;
  /** Contenido adicional bajo la nota, como un control de detalle. */
  readonly extra?: ReactNode;
}): ReactNode {
  const tituloId = `hospital-reportes-tb-${tabla.id}`;

  return (
    <section className={styles.bloque} aria-labelledby={tituloId}>
      <h3 className={styles.bloqueTitulo} id={tituloId}>
        {tabla.titulo}
      </h3>
      <p className={styles.bloqueNota}>{tabla.nota}</p>
      {tabla.filas.length === 0 ? (
        <p className={styles.vacio} role="status">
          {tabla.vacio}
        </p>
      ) : (
        <div className={styles.tablaContenedor}>
          <table className={styles.tabla}>
            <caption>{tabla.leyenda}</caption>
            <thead>
              <tr>
                {tabla.columnas.map((columna) => (
                  <th
                    className={columna.numerica === true ? styles.numerica : undefined}
                    scope="col"
                    key={columna.id}
                  >
                    {columna.etiqueta}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tabla.filas.map((fila) => (
                <tr key={fila.id}>
                  {fila.celdas.map((celda, indice) => {
                    const columna = tabla.columnas[indice];

                    if (indice === 0) {
                      return (
                        <th scope="row" key={columna?.id ?? String(indice)}>
                          {celda}
                        </th>
                      );
                    }

                    return (
                      <td
                        className={columna?.numerica === true ? styles.numerica : undefined}
                        key={columna?.id ?? String(indice)}
                      >
                        {celda}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {extra}
    </section>
  );
}

/* ========================================================================== */
/* Evidencias                                                                 */
/* ========================================================================== */

/**
 * Tabla compacta de evidencias (§3.7).
 *
 * Muestra indicador o movimiento, evidencia, tipo, fecha, responsable,
 * procedencia y estado exacto. El control de cada fila abre los metadatos: en
 * este slice NUNCA se muestra el documento real, no se descarga y no se valida.
 */
export function ReporteTablaEvidencias({
  evidencias,
  columnas,
  vacio,
  onAbrir,
}: {
  readonly evidencias: readonly EvidenciaRegistro[];
  readonly columnas: readonly { readonly id: string; readonly etiqueta: string }[];
  readonly vacio: string;
  readonly onAbrir: (id: string) => void;
}): ReactNode {
  if (evidencias.length === 0) {
    return (
      <p className={styles.vacio} role="status">
        {vacio}
      </p>
    );
  }

  return (
    <div className={styles.tablaContenedor}>
      <table className={styles.tabla}>
        <caption>
          Evidencias del periodo con su estado documental y su procedencia. El documento no se
          muestra en esta pantalla.
        </caption>
        <thead>
          <tr>
            {columnas.map((columna) => (
              <th scope="col" key={columna.id}>
                {columna.etiqueta}
              </th>
            ))}
            <th scope="col">Metadatos</th>
          </tr>
        </thead>
        <tbody>
          {evidencias.map((registro) => (
            <tr key={registro.id}>
              <th scope="row">{registro.indicador}</th>
              <td>{registro.evidencia}</td>
              <td>{registro.tipo}</td>
              <td>{registro.fecha}</td>
              <td>{registro.responsable}</td>
              <td>{registro.procedencia}</td>
              <td>{registro.estado}</td>
              <td>
                <button
                  type="button"
                  className={styles.detalleBoton}
                  data-hospital-evidencia={registro.id}
                  onClick={() => {
                    onAbrir(registro.id);
                  }}
                >
                  Ver metadatos
                  <span className="merdn-sr-only">{` de ${registro.evidencia}`}</span>
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ========================================================================== */
/* Indicadores descriptivos                                                   */
/* ========================================================================== */

/** Indicadores de población y recursos, con numerador y denominador visibles. */
export function ReporteIndicadores({
  indicadores,
  aviso,
}: {
  readonly indicadores: readonly ReporteIndicador[];
  readonly aviso: string;
}): ReactNode {
  return (
    <section className={styles.bloque} aria-labelledby="hospital-reportes-indicadores">
      <h3 className={styles.bloqueTitulo} id="hospital-reportes-indicadores">
        Indicadores de población y recursos
      </h3>
      <p className={styles.limite}>{aviso}</p>
      <div className={styles.tablaContenedor}>
        <table className={styles.tabla}>
          <caption>
            Cada indicador muestra su numerador, su denominador, su unidad, su periodo, su versión y
            su metodología. Sin alguno de ellos, el indicador no se calcula.
          </caption>
          <thead>
            <tr>
              <th scope="col">Indicador</th>
              <th scope="col">Numerador</th>
              <th scope="col">Denominador</th>
              <th className={styles.numerica} scope="col">
                Valor
              </th>
              <th scope="col">Estado</th>
              <th scope="col">Metodología</th>
            </tr>
          </thead>
          <tbody>
            {indicadores.map((indicador) => (
              <tr key={indicador.id}>
                <th scope="row">{indicador.etiqueta}</th>
                <td>{indicador.numeradorTexto}</td>
                <td>{indicador.denominadorTexto}</td>
                <td className={styles.numerica}>{indicador.valor}</td>
                <td>{REPORTE_ETIQUETA_ESTADO[indicador.estado]}</td>
                <td>{`${indicador.metodologia} Versión: ${indicador.version}. Periodo: ${indicador.periodo}. Procedencia: ${indicador.procedencia}.`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* ========================================================================== */
/* Matriz de intersecciones                                                   */
/* ========================================================================== */

/**
 * Matriz completa de las ocho intersecciones (§3.3).
 *
 * Las ocho combinaciones son disjuntas: cada persona cae en una sola y su suma
 * reconcilia el universo. La pertenencia se lee como `Sí`/`No`, nunca por
 * color. Solo la vista Hospital ofrece el control de detalle agregado.
 */
export function ReporteMatriz({
  intersecciones,
  universo,
  conDetalle,
  onDetalle,
}: {
  readonly intersecciones: readonly PoblacionInterseccion[];
  readonly universo: number;
  readonly conDetalle: boolean;
  readonly onDetalle: (id: string) => void;
}): ReactNode {
  const suma = intersecciones.reduce((total, celda) => total + celda.valor, 0);

  return (
    <section className={styles.bloque} aria-labelledby="hospital-reportes-matriz">
      <h3 className={styles.bloqueTitulo} id="hospital-reportes-matriz">
        Intersecciones de condiciones prioritarias
      </h3>
      <p className={styles.bloqueNota}>
        Las ocho combinaciones son excluyentes entre sí: nadie se cuenta dos veces y su suma es el
        total de pacientes activos. Los indicadores solapados no deben sumarse para obtener la
        población total.
      </p>
      <div className={styles.tablaContenedor}>
        <table className={styles.tabla}>
          <caption>
            Matriz completa de las ocho combinaciones de mayor de 60, discapacidad y cuidados en
            casa.
          </caption>
          <thead>
            <tr>
              <th scope="col">Combinación</th>
              <th scope="col">60+</th>
              <th scope="col">Discapacidad</th>
              <th scope="col">Cuidados en casa</th>
              <th className={styles.numerica} scope="col">
                Pacientes
              </th>
              <th className={styles.numerica} scope="col">
                Porcentaje
              </th>
              {conDetalle ? <th scope="col">Detalle operativo</th> : null}
            </tr>
          </thead>
          <tbody>
            {intersecciones.map((celda) => (
              <tr key={celda.id}>
                <th scope="row">{celda.etiqueta}</th>
                <td>{celda.mayor60 ? 'Sí' : 'No'}</td>
                <td>{celda.discapacidad ? 'Sí' : 'No'}</td>
                <td>{celda.cuidadosCasa ? 'Sí' : 'No'}</td>
                <td className={styles.numerica}>{formatearNumero(celda.valor)}</td>
                <td className={styles.numerica}>{textoPorcentaje(celda.porcentaje)}</td>
                {conDetalle ? (
                  <td>
                    <button
                      type="button"
                      className={styles.detalleBoton}
                      data-hospital-detalle={celda.id}
                      onClick={() => {
                        onDetalle(celda.id);
                      }}
                    >
                      Ver detalle agregado
                      <span className="merdn-sr-only">{` de ${celda.etiqueta}`}</span>
                    </button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Suma de las ocho combinaciones</th>
              <td colSpan={3}>{`Universo: ${formatearNumero(universo)}`}</td>
              <td className={styles.numerica}>{formatearNumero(suma)}</td>
              <td className={styles.numerica}>{suma === universo ? 'Reconcilia' : 'Revisar'}</td>
              {conDetalle ? <td /> : null}
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

/* ========================================================================== */
/* Panel lateral                                                              */
/* ========================================================================== */

/**
 * Panel lateral de metadatos o de detalle agregado.
 *
 * Es un diálogo: overlay, `role="dialog"`, `aria-modal`, cierre visible y foco
 * inicial dentro del panel. Nunca contiene el documento de una evidencia ni
 * información nominal.
 */
export function ReportePanel({
  titulo,
  referencia,
  onCerrar,
  children,
}: {
  readonly titulo: string;
  readonly referencia: Ref<HTMLDivElement>;
  readonly onCerrar: () => void;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <div className={styles.panelFondo}>
      <div
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        tabIndex={-1}
        ref={referencia}
        onKeyDown={(evento) => {
          if (evento.key === 'Escape') {
            onCerrar();
          }
        }}
      >
        <div className={styles.panelCabecera}>
          <h3 className={styles.panelTitulo}>{titulo}</h3>
          <button type="button" className={styles.detalleBoton} onClick={onCerrar}>
            Cerrar
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Metadatos de una evidencia. Nunca incluye el documento. */
export function ReporteMetadatos({
  evidencia,
}: {
  readonly evidencia: EvidenciaRegistro;
}): ReactNode {
  return (
    <dl className={styles.campos}>
      {evidencia.metadatos.map((dato) => (
        <div className={styles.campo} key={dato.etiqueta}>
          <dt className={styles.campoEtiqueta}>{dato.etiqueta}</dt>
          <dd className={styles.campoValor}>{dato.valor}</dd>
        </div>
      ))}
    </dl>
  );
}

/* ========================================================================== */
/* Estados                                                                    */
/* ========================================================================== */

/** Esqueleto por bloque; no simula datos y no anuncia cifras. */
export function ReporteEsqueleto(): ReactNode {
  return (
    <div className={styles.esqueleto} aria-hidden="true">
      <div className={styles.esqueletoBloque} />
      <div className={styles.esqueletoBloque} />
      <div className={styles.esqueletoBloque} />
    </div>
  );
}

/** Error recuperable del bloque, con reintento explícito. */
export function ReporteError({
  onReintentar,
}: {
  readonly onReintentar: () => void;
}): ReactNode {
  return (
    <section className={styles.bloque} aria-label="Error al mostrar el reporte">
      <p className={styles.vacio} role="status">
        No fue posible mostrar el reporte con los filtros actuales. Los filtros se conservan.
      </p>
      <button type="button" className={styles.limpiar} onClick={onReintentar}>
        Reintentar
      </button>
    </section>
  );
}

export { styles as hospitalReportStyles };
