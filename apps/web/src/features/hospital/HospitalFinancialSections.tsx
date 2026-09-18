import { useEffect, useRef, type ReactNode } from 'react';

import styles from './hospitalFinancial.module.css';
import {
  AccionInerte,
  AttentionItem,
  EvidenceList,
  FinancialBar,
  FinancialCard,
  FinancialDataTable,
  FinancialDetailBlock,
  FinancialDetailDrawer,
  FinancialFields,
  FinancialFilterBar,
  FinancialFormPanel,
  FinancialKpiCard,
  FinancialNote,
  FinancialSummaryRow,
  HistoryTimeline,
  LinkedMovements,
  SourceBadge,
  SourceTrace,
  StatusBadge,
  unirClases,
} from './HospitalFinancialPieces';
import { filtrarFilas } from './hospitalFinancialConfig';
import type {
  FinancialBandeja,
  FinancialFila,
  FinancialFiltroId,
  FinancialFiltros,
} from './hospitalFinancialConfig';
import type {
  FinancialConexionConfig,
  FinancialDestino,
  FinancialEstadosPantalla,
  FinancialResumenConfig,
  FinancialSeccionTabla,
} from './hospitalFinancialContracts';

/**
 * Pantallas de «Gestión financiera» (TASK-003H-06, apartados 7, 9 y 13).
 *
 * Tres composiciones cubren los quince destinos: el resumen financiero, el
 * patrón de listado que comparten las trece secciones de consulta y el panel de
 * conexión con el sistema del Hospital.
 *
 * Alcance: presentación. El recorte de filas es local sobre fixtures en
 * memoria. Ninguna acción crea, edita, revisa, aprueba, programa, paga,
 * adjunta, exporta ni sincroniza, y ninguna simula que lo haya hecho.
 */

/* ========================================================================== */
/* Resumen financiero                                                         */
/* ========================================================================== */

export function FinancialResumenView({
  resumen,
  estados,
  onDestino,
}: {
  readonly resumen: FinancialResumenConfig;
  readonly estados: FinancialEstadosPantalla;
  readonly onDestino: (destino: FinancialDestino) => void;
}): ReactNode {
  return (
    <>
      <FinancialCard
        titulo="Indicadores del periodo"
        tituloId="financiera-kpis"
        nota="Cifras ficticias predefinidas. Cada tarjeta abre su sección con el recorte correspondiente."
      >
        <ul className={styles.kpis} aria-labelledby="financiera-kpis">
          {resumen.kpis.map((kpi) => (
            <FinancialKpiCard
              key={kpi.id}
              etiqueta={kpi.etiqueta}
              valor={kpi.valor}
              periodo={kpi.periodo}
              origen={kpi.origen}
              icono={kpi.icono}
              barra={kpi.barra}
              onAbrir={() => {
                onDestino(kpi.destino);
              }}
            />
          ))}
        </ul>
      </FinancialCard>

      <FinancialCard
        titulo="Necesita atención financiera"
        tituloId="financiera-atencion"
        nota="Avisos operativos internos de organización del trabajo."
      >
        <FinancialNote atencion>
          Estos avisos no son alertas oficiales, regulatorias ni clínicas, y no declaran
          incumplimiento de ninguna norma ni de ninguna obligación institucional.
        </FinancialNote>
        <ul className={styles.atencionLista} aria-labelledby="financiera-atencion">
          {resumen.atencion.map((item) => (
            <AttentionItem
              key={item.id}
              categoria={item.categoria}
              asunto={item.asunto}
              programa={item.programa}
              antiguedad={item.antiguedad}
              origen={item.origen}
              onRevisar={() => {
                onDestino(item.destino);
              }}
            />
          ))}
        </ul>
        <FinancialNote>{resumen.avisoUmbral}</FinancialNote>
      </FinancialCard>

      <FinancialCard
        titulo="Presupuesto por programa"
        tituloId="financiera-programas"
        nota="Asignado, comprometido, ejecutado y disponible; cifras predefinidas sin fórmula."
      >
        <ul className={styles.programaLista} aria-labelledby="financiera-programas">
          {resumen.programas.map((linea) => (
            <li className={styles.programaFila} key={linea.id}>
              <span className={styles.programaCabecera}>
                <span>{`${linea.programa} · ${linea.rubro}`}</span>
                <span>{`Ejecución: ${linea.ejecucion}`}</span>
              </span>
              <FinancialBar
                porcentaje={linea.barra}
                etiquetaAccesible={`${linea.programa}: ejecución ${linea.ejecucion} del asignado ${linea.asignado}`}
              />
              <dl className={styles.programaCifras}>
                <div className={styles.programaCifra}>
                  <dt className={styles.programaCifraEtiqueta}>Asignado</dt>
                  <dd className={styles.programaCifraValor}>{linea.asignado}</dd>
                </div>
                <div className={styles.programaCifra}>
                  <dt className={styles.programaCifraEtiqueta}>Comprometido</dt>
                  <dd className={styles.programaCifraValor}>{linea.comprometido}</dd>
                </div>
                <div className={styles.programaCifra}>
                  <dt className={styles.programaCifraEtiqueta}>Ejecutado</dt>
                  <dd className={styles.programaCifraValor}>{linea.ejecutado}</dd>
                </div>
                <div className={styles.programaCifra}>
                  <dt className={styles.programaCifraEtiqueta}>Disponible</dt>
                  <dd className={styles.programaCifraValor}>{linea.disponible}</dd>
                </div>
                <div className={styles.programaCifra}>
                  <dt className={styles.programaCifraEtiqueta}>Origen</dt>
                  <dd className={styles.programaCifraValor}>{linea.origen}</dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      </FinancialCard>

      <FinancialCard
        titulo="Flujo del periodo"
        tituloId="financiera-flujo"
        nota="Ingresos frente a egresos. La tabla repite las mismas cifras como texto."
      >
        <div className={styles.tablaContenedor} role="region" aria-label="Flujo del periodo" tabIndex={0}>
          <table className={styles.tabla}>
            <caption className={styles.tablaLeyenda}>
              Ingresos y egresos demostrativos por periodo
            </caption>
            <thead>
              <tr>
                <th scope="col" className={styles.tablaEncabezado}>
                  Periodo
                </th>
                <th scope="col" className={styles.tablaEncabezado}>
                  Ingresos
                </th>
                <th scope="col" className={styles.tablaEncabezado}>
                  Egresos
                </th>
              </tr>
            </thead>
            <tbody>
              {resumen.flujo.map((periodo) => (
                <tr key={periodo.id}>
                  <th scope="row" data-etiqueta="Periodo" className={styles.celda}>
                    {periodo.etiqueta}
                  </th>
                  <td
                    data-etiqueta="Ingresos"
                    className={unirClases(styles.celda, styles.celdaNumerica)}
                  >
                    {periodo.ingresos}
                    <FinancialBar
                      porcentaje={periodo.barraIngresos}
                      color="var(--b-verde)"
                      etiquetaAccesible={`Ingresos de ${periodo.etiqueta}: ${periodo.ingresos}`}
                    />
                  </td>
                  <td
                    data-etiqueta="Egresos"
                    className={unirClases(styles.celda, styles.celdaNumerica)}
                  >
                    {periodo.egresos}
                    <FinancialBar
                      porcentaje={periodo.barraEgresos}
                      color="var(--b-petroleo)"
                      etiquetaAccesible={`Egresos de ${periodo.etiqueta}: ${periodo.egresos}`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </FinancialCard>

      <FinancialCard
        titulo="Actividad reciente"
        tituloId="financiera-actividad"
        nota="Últimos movimientos con su estado y su procedencia."
      >
        <LinkedMovements
          movimientos={resumen.actividad}
          etiquetaAccesible="Actividad financiera reciente"
          vacio={estados.vacio}
        />
      </FinancialCard>
    </>
  );
}

/* ========================================================================== */
/* Sección de listado                                                         */
/* ========================================================================== */

export function FinancialTablaView({
  seccion,
  filtros,
  bandeja,
  masFiltros,
  filaAbierta,
  formularioAbierto,
  estados,
  onFiltro,
  onQuitarFiltro,
  onLimpiarFiltros,
  onAlternarMasFiltros,
  onBandeja,
  onAbrirFila,
  onCerrarFila,
  onAlternarFormulario,
}: {
  readonly seccion: FinancialSeccionTabla;
  readonly filtros: FinancialFiltros;
  readonly bandeja: FinancialBandeja;
  readonly masFiltros: boolean;
  readonly filaAbierta: string | null;
  readonly formularioAbierto: boolean;
  readonly estados: FinancialEstadosPantalla;
  readonly onFiltro: (filtro: FinancialFiltroId | 'texto', valor: string) => void;
  readonly onQuitarFiltro: (filtro: FinancialFiltroId | 'texto') => void;
  readonly onLimpiarFiltros: () => void;
  readonly onAlternarMasFiltros: () => void;
  readonly onBandeja: (bandeja: FinancialBandeja) => void;
  readonly onAbrirFila: (id: string) => void;
  readonly onCerrarFila: () => void;
  readonly onAlternarFormulario: () => void;
}): ReactNode {
  /* Panel de detalle y control que lo abrió: el foco vuelve donde estaba. */
  const panelRef = useRef<HTMLElement | null>(null);
  const disparadorRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (filaAbierta !== null) {
      panelRef.current?.focus();
    }
  }, [filaAbierta]);

  const resumen = seccion.resumen ?? [];
  const visibles = filtrarFilas(seccion.filas, filtros, seccion.filtros, bandeja);
  const abierta: FinancialFila | undefined = seccion.filas.find((fila) => fila.id === filaAbierta);
  const prefijo = `financiera-${seccion.id}`;
  const sinRecorte =
    filtros.texto.trim() === '' &&
    seccion.filtros.every((filtro) => filtros[filtro] === 'Todos') &&
    bandeja === 'Todos';

  const cerrar = (): void => {
    onCerrarFila();
    disparadorRef.current?.focus();
  };

  return (
    <>
      <FinancialFilterBar
        filas={seccion.filas}
        filtros={filtros}
        disponibles={seccion.filtros}
        buscadorEtiqueta={seccion.buscadorEtiqueta}
        buscadorAyuda={seccion.buscadorAyuda}
        accionPrimaria={seccion.accionPrimaria}
        masFiltros={masFiltros}
        prefijo={prefijo}
        onFiltro={onFiltro}
        onQuitar={onQuitarFiltro}
        onLimpiar={onLimpiarFiltros}
        onAlternarMasFiltros={onAlternarMasFiltros}
      />

      {resumen.length === 0 ? null : (
        <FinancialCard
          titulo="Cifras de la sección"
          tituloId={`${prefijo}-resumen`}
          nota="Valores predefinidos; no se calculan en esta pantalla."
        >
          <FinancialSummaryRow
            bloques={resumen}
            etiquetaAccesible={`Cifras de ${seccion.titulo}`}
          />
        </FinancialCard>
      )}

      <FinancialCard
        titulo={seccion.titulo}
        tituloId={`${prefijo}-tabla`}
        nota={`${String(visibles.length)} de ${String(seccion.filas.length)} registros visibles`}
        extra={
          seccion.formulario === undefined ? undefined : (
            <button
              type="button"
              className={unirClases(styles.boton, styles.botonNeutro)}
              aria-expanded={formularioAbierto}
              onClick={onAlternarFormulario}
            >
              {seccion.formulario.abrir}
            </button>
          )
        }
      >
        {seccion.bandejas.length === 0 ? null : (
          <div className={styles.bandejas} role="group" aria-label="Bandejas del listado">
            {seccion.bandejas.map((opcion) => (
              <button
                key={opcion}
                type="button"
                aria-pressed={opcion === bandeja}
                className={unirClases(styles.bandeja, opcion === bandeja && styles.bandejaActiva)}
                onClick={() => {
                  onBandeja(opcion);
                }}
              >
                {opcion}
              </button>
            ))}
          </div>
        )}

        <FinancialDataTable
          columnas={seccion.columnas}
          filas={visibles}
          leyenda={seccion.leyenda}
          vacio={sinRecorte ? seccion.vacioInicial : seccion.vacioFiltrado}
          filaAbierta={filaAbierta}
          onAbrirFila={(fila, disparador) => {
            disparadorRef.current = disparador;
            onAbrirFila(fila.id);
          }}
        />

        <FinancialNote>{seccion.nota}</FinancialNote>
      </FinancialCard>

      {seccion.formulario === undefined || !formularioAbierto ? null : (
        <FinancialFormPanel
          titulo={seccion.formulario.titulo}
          tituloId={`${prefijo}-formulario`}
          campos={seccion.formulario.campos}
          ranura={seccion.formulario.ranura}
          nota={seccion.formulario.nota}
          prefijo={prefijo}
          onCerrar={onAlternarFormulario}
        />
      )}

      {abierta === undefined ? null : (
        <FinancialDetailDrawer
          titulo={abierta.detalle.titulo}
          subtitulo={abierta.detalle.subtitulo}
          tituloId={`${prefijo}-detalle`}
          panelRef={panelRef}
          onCerrar={cerrar}
        >
          {abierta.detalle.aviso === undefined ? null : (
            <FinancialNote atencion>{abierta.detalle.aviso}</FinancialNote>
          )}

          <div className={styles.contextoAcciones}>
            <StatusBadge estado={abierta.estado} />
            <SourceBadge origen={abierta.origen} />
            <StatusBadge estado={abierta.detalle.procedencia.sincronizacion} />
            <StatusBadge estado={abierta.evidencia} />
          </div>

          <FinancialDetailBlock titulo="Resumen" tituloId={`${prefijo}-detalle-resumen`}>
            <FinancialFields
              campos={abierta.detalle.campos}
              etiquetaAccesible={`Campos de ${abierta.detalle.titulo}`}
            />
          </FinancialDetailBlock>

          <FinancialDetailBlock titulo="Movimientos" tituloId={`${prefijo}-detalle-movimientos`}>
            <LinkedMovements
              movimientos={abierta.detalle.movimientos}
              etiquetaAccesible={`Movimientos de ${abierta.detalle.titulo}`}
              vacio="Sin movimientos vinculados a este registro."
            />
          </FinancialDetailBlock>

          <FinancialDetailBlock titulo="Evidencias" tituloId={`${prefijo}-detalle-evidencias`}>
            <EvidenceList
              evidencias={abierta.detalle.evidencias}
              etiquetaAccesible={`Evidencias de ${abierta.detalle.titulo}`}
              vacio="Sin evidencias cargadas para este registro."
            />
          </FinancialDetailBlock>

          <FinancialDetailBlock titulo="Historial" tituloId={`${prefijo}-detalle-historial`}>
            <HistoryTimeline
              historial={abierta.detalle.historial}
              etiquetaAccesible={`Historial de ${abierta.detalle.titulo}`}
              vacio="Sin historial registrado para este registro."
            />
          </FinancialDetailBlock>

          <FinancialDetailBlock titulo="Procedencia" tituloId={`${prefijo}-detalle-procedencia`}>
            <SourceTrace
              procedencia={abierta.detalle.procedencia}
              etiquetaAccesible={`Procedencia de ${abierta.detalle.titulo}`}
            />
          </FinancialDetailBlock>

          <div className={styles.contextoAcciones}>
            {abierta.detalle.acciones.map((accion) => (
              <AccionInerte key={accion} etiqueta={accion} />
            ))}
          </div>

          <FinancialNote>{estados.pendiente}</FinancialNote>
        </FinancialDetailDrawer>
      )}
    </>
  );
}

/* ========================================================================== */
/* Conexión con sistema del Hospital                                          */
/* ========================================================================== */

export function FinancialConexionView({
  conexion,
  estados,
}: {
  readonly conexion: FinancialConexionConfig;
  readonly estados: FinancialEstadosPantalla;
}): ReactNode {
  return (
    <>
      <FinancialCard
        titulo="Estado de la conexión"
        tituloId="financiera-conexion-estado"
        nota="Ninguna casilla de esta pantalla activa, programa ni ejecuta una sincronización."
      >
        <FinancialNote atencion>{conexion.aviso}</FinancialNote>
        <FinancialFields
          etiquetaAccesible="Sistema configurado"
          campos={[
            { etiqueta: 'Sistema', valor: conexion.sistema.nombre },
            { etiqueta: 'Modalidad', valor: conexion.sistema.modalidad },
            { etiqueta: 'Estado', valor: conexion.sistema.estado },
            { etiqueta: 'Última sincronización', valor: conexion.sistema.ultimaSincronizacion },
            { etiqueta: 'Responsable', valor: conexion.sistema.responsable },
          ]}
        />
        <FinancialNote>{estados.externoNoDisponible}</FinancialNote>
      </FinancialCard>

      <FinancialCard
        titulo="Categorías de la conexión"
        tituloId="financiera-conexion-categorias"
        nota="Selección visual: no hay credenciales, API, formato, frecuencia ni conexión activa."
      >
        <ul className={styles.categorias} aria-labelledby="financiera-conexion-categorias">
          {conexion.categorias.map((categoria) => (
            <li className={styles.categoria} key={categoria.id}>
              <span className={styles.categoriaCabecera}>
                <span className={styles.categoriaEtiqueta}>
                  <input
                    type="checkbox"
                    id={`financiera-categoria-${categoria.id}`}
                    checked={categoria.seleccionada}
                    disabled
                    readOnly
                  />
                  <label htmlFor={`financiera-categoria-${categoria.id}`}>{categoria.etiqueta}</label>
                </span>
                <StatusBadge estado={categoria.estado} />
              </span>
              <dl className={styles.categoriaDatos}>
                <div className={styles.programaCifra}>
                  <dt className={styles.programaCifraEtiqueta}>Dirección</dt>
                  <dd className={styles.programaCifraValor}>{categoria.direccion}</dd>
                </div>
                <div className={styles.programaCifra}>
                  <dt className={styles.programaCifraEtiqueta}>Fuente maestra</dt>
                  <dd className={styles.programaCifraValor}>{categoria.fuenteMaestra}</dd>
                </div>
                <div className={styles.programaCifra}>
                  <dt className={styles.programaCifraEtiqueta}>Frecuencia</dt>
                  <dd className={styles.programaCifraValor}>{categoria.frecuencia}</dd>
                </div>
                <div className={styles.programaCifra}>
                  <dt className={styles.programaCifraEtiqueta}>Campos permitidos</dt>
                  <dd className={styles.programaCifraValor}>{categoria.campos}</dd>
                </div>
              </dl>
              {categoria.bloqueada ? (
                <FinancialNote atencion>{categoria.motivoBloqueo}</FinancialNote>
              ) : null}
            </li>
          ))}
        </ul>
        <FinancialNote>{conexion.notaModalidades}</FinancialNote>
      </FinancialCard>

      <FinancialCard
        titulo="Resumen de operaciones"
        tituloId="financiera-conexion-resumen"
        nota="Conteos demostrativos; no corresponden a ninguna ejecución real."
      >
        <FinancialSummaryRow
          bloques={conexion.resumen}
          etiquetaAccesible="Resumen de operaciones de sincronización"
        />
      </FinancialCard>

      <FinancialCard
        titulo="Historial de sincronizaciones"
        tituloId="financiera-conexion-historial"
        nota="Ejecuciones demostrativas; ninguna se ejecutó realmente."
      >
        <div
          className={styles.tablaContenedor}
          role="region"
          aria-label="Historial de sincronizaciones"
          tabIndex={0}
        >
          <table className={styles.tabla}>
            <caption className={styles.tablaLeyenda}>
              Ejecuciones demostrativas de sincronización
            </caption>
            <thead>
              <tr>
                <th scope="col" className={styles.tablaEncabezado}>
                  Fecha
                </th>
                <th scope="col" className={styles.tablaEncabezado}>
                  Categorías
                </th>
                <th scope="col" className={styles.tablaEncabezado}>
                  Resultado
                </th>
                <th scope="col" className={styles.tablaEncabezado}>
                  Importadas
                </th>
                <th scope="col" className={styles.tablaEncabezado}>
                  Pendientes
                </th>
                <th scope="col" className={styles.tablaEncabezado}>
                  Rechazadas
                </th>
                <th scope="col" className={styles.tablaEncabezado}>
                  Conflictos
                </th>
              </tr>
            </thead>
            <tbody>
              {conexion.historial.map((ejecucion) => (
                <tr key={ejecucion.id}>
                  <th scope="row" data-etiqueta="Fecha" className={styles.celda}>
                    {ejecucion.fecha}
                  </th>
                  <td data-etiqueta="Categorías" className={styles.celda}>
                    {ejecucion.categoria}
                  </td>
                  <td data-etiqueta="Resultado" className={styles.celda}>
                    {ejecucion.resultado}
                  </td>
                  <td
                    data-etiqueta="Importadas"
                    className={unirClases(styles.celda, styles.celdaNumerica)}
                  >
                    {ejecucion.importadas}
                  </td>
                  <td
                    data-etiqueta="Pendientes"
                    className={unirClases(styles.celda, styles.celdaNumerica)}
                  >
                    {ejecucion.pendientes}
                  </td>
                  <td
                    data-etiqueta="Rechazadas"
                    className={unirClases(styles.celda, styles.celdaNumerica)}
                  >
                    {ejecucion.rechazadas}
                  </td>
                  <td
                    data-etiqueta="Conflictos"
                    className={unirClases(styles.celda, styles.celdaNumerica)}
                  >
                    {ejecucion.conflictos}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </FinancialCard>

      <FinancialCard
        titulo="Conflictos pendientes"
        tituloId="financiera-conexion-conflictos"
        nota="Cada conflicto espera una decisión humana con actor y motivo."
      >
        <FinancialNote atencion>{estados.conflicto}</FinancialNote>
        <ul className={styles.categorias} aria-labelledby="financiera-conexion-conflictos">
          {conexion.conflictos.map((conflicto) => (
            <li className={styles.categoria} key={conflicto.id}>
              <span className={styles.categoriaCabecera}>
                <span className={styles.categoriaEtiqueta}>{conflicto.registro}</span>
                <StatusBadge estado="Conflicto" />
              </span>
              <FinancialFields
                etiquetaAccesible={`Detalle del conflicto ${conflicto.registro}`}
                campos={[
                  { etiqueta: 'Categoría', valor: conflicto.categoria },
                  { etiqueta: 'Detectado en', valor: conflicto.detectadoEn },
                  { etiqueta: 'Campo en conflicto', valor: conflicto.campo },
                  { etiqueta: 'Valor del Hospital', valor: conflicto.valorHospital },
                  { etiqueta: 'Valor local', valor: conflicto.valorPlataforma },
                ]}
              />
              <div className={styles.contextoAcciones}>
                {conflicto.opciones.map((opcion) => (
                  <AccionInerte key={opcion} etiqueta={opcion} estado="Requiere backend" />
                ))}
              </div>
              <FinancialNote>{conflicto.nota}</FinancialNote>
            </li>
          ))}
        </ul>
      </FinancialCard>
    </>
  );
}
