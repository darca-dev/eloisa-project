'use client';

import { useCallback, type ReactNode, type Ref } from 'react';

import styles from './municipality.module.css';
import { municipalityDemo } from './municipalityConfig';
import type { MunicipalityConfig } from './municipalityConfig';
import {
  COLUMNAS_TERRITORIO,
  DESCRIPCIONES,
  ETIQUETAS_AREA,
  TEXTOS_AGREGADOS,
  textoDeCorte,
  type EstadoAgregado,
  type TerritoryMetrics,
  type TerritorySummary,
} from './municipalityAggregates';
import { fetchTerritorySummary } from './municipalityAggregatesClient';
import { useMunicipalityAggregate } from './useMunicipalityAggregate';

/**
 * Vista «Territorio» de la experiencia Alcaldía
 * (TASK-MUNICIPALITY-CORE-01, FR-06, FR-07 y FR-09 a FR-12).
 *
 * PROCEDENCIA: la tabla se llena con
 * `GET /api/v1/municipality/territory-summary`, agregado en PostgreSQL sobre
 * las direcciones registradas del tenant que el servidor resuelve. No queda
 * ningún fixture como fuente ni como repliegue.
 *
 * ADAPTACIÓN DE DATOS APROBADA (OD-03): la tabla conserva su estructura visual
 * y sustituye las columnas de visitas, alertas y cobertura —que MERDN no puede
 * producir hoy— por 60 años o más, discapacidad declarada, cuidado en casa
 * declarado y registros pendientes de normalización territorial. Es una
 * adaptación de datos, no un rediseño, y no toca el prototipo.
 *
 * JERARQUÍA: `Municipio → Urbana/Rural → Barrio o vereda canónico`. Las filas se
 * anidan con una sola tabla para que cada dato conserve su relación con el
 * encabezado de columna y con el nombre de la zona también al hacer reflow.
 *
 * PRIVACIDAD: información agregada. No hay dirección, indicaciones, texto libre
 * de localidad, coordenada, mapa, geocodificación, nombre, documento, historia
 * clínica ni diagnóstico; ninguna fila es seleccionable, enlazable ni
 * exportable y no existe drill-down. La protección de grupos pequeños la aplica
 * el servidor: la vista nunca recibe el número real de un grupo de 1 a 4.
 */

const SECCION_ID = {
  titulo: 'municipality-territorio-titulo',
} as const;

/** Estado no resuelto de la consulta, anunciado a tecnologías de asistencia. */
function EstadoTerritorio({
  estado,
}: {
  readonly estado: EstadoAgregado<TerritorySummary>;
}): ReactNode {
  if (estado.estado === 'cargando') {
    return (
      <p className={styles.sourceNote} role="status">
        {TEXTOS_AGREGADOS.cargando}
      </p>
    );
  }

  if (estado.estado === 'no-autorizado') {
    return (
      <p className={styles.stateNote} role="alert">
        {TEXTOS_AGREGADOS.noAutorizado}
      </p>
    );
  }

  if (estado.estado === 'error') {
    return (
      <p className={styles.stateNote} role="alert">
        {TEXTOS_AGREGADOS.error}
      </p>
    );
  }

  return (
    <p className={styles.sourceNote} role="status">
      {TEXTOS_AGREGADOS.vacio}
    </p>
  );
}

/** Las cinco celdas numéricas de una fila, en el orden aprobado. */
function CeldasDeMetricas({
  metrics,
}: {
  readonly metrics: TerritoryMetrics;
}): ReactNode {
  return (
    <>
      <td className={styles.cell}>{metrics.uniquePeople.display}</td>
      <td className={styles.cell}>{metrics.olderAdult60Plus.display}</td>
      <td className={styles.cell}>{metrics.disabilityDeclared.display}</td>
      <td className={styles.cell}>{metrics.homeCareRequiredDeclared.display}</td>
      <td className={styles.cell}>{metrics.pendingNormalization.display}</td>
    </>
  );
}

/**
 * Distribución agregada por territorio.
 *
 * Cuando el ancho no alcanza, la tabla se desplaza dentro de su propia región
 * enfocable, sin recortar contenido y sin desbordar la página.
 */
function TablaTerritorio({
  columnaZona,
  datos,
}: {
  readonly columnaZona: string;
  readonly datos: TerritorySummary;
}): ReactNode {
  return (
    <div
      className={styles.tableScroll}
      role="group"
      aria-labelledby={SECCION_ID.titulo}
      tabIndex={0}
    >
      <table className={styles.table}>
        <caption className="merdn-sr-only">
          Distribución agregada por municipio, zona urbana o rural y barrio o vereda:
          personas registradas, personas de 60 años o más, discapacidad declarada, cuidado
          en casa declarado y registros pendientes de normalización territorial.
        </caption>
        <thead>
          <tr>
            <th className={styles.tableHead} scope="col">
              {columnaZona}
            </th>
            <th className={styles.tableHead} scope="col">
              {COLUMNAS_TERRITORIO.personas}
            </th>
            <th className={styles.tableHead} scope="col">
              {COLUMNAS_TERRITORIO.mayores}
            </th>
            <th className={styles.tableHead} scope="col">
              {COLUMNAS_TERRITORIO.discapacidad}
            </th>
            <th className={styles.tableHead} scope="col">
              {COLUMNAS_TERRITORIO.cuidado}
            </th>
            <th className={styles.tableHead} scope="col">
              {COLUMNAS_TERRITORIO.pendientes}
            </th>
          </tr>
        </thead>
        {datos.municipalities.map((municipio) => (
          <tbody key={municipio.officialCode ?? municipio.displayName}>
            <tr>
              <th className={styles.zoneName} scope="row">
                {municipio.displayName}
              </th>
              <CeldasDeMetricas metrics={municipio.metrics} />
            </tr>
            {municipio.areas.map((area) => (
              <tr key={`${municipio.displayName}-${area.areaType}`}>
                <th className={styles.zoneName} scope="row">
                  <span className={styles.cellMuted}>{municipio.displayName}</span>
                  {ETIQUETAS_AREA[area.areaType]}
                </th>
                <CeldasDeMetricas metrics={area.metrics} />
              </tr>
            ))}
            {municipio.areas.flatMap((area) =>
              area.localUnits.map((unidad) => (
                <tr
                  key={`${municipio.displayName}-${area.areaType}-${
                    unidad.localUnitId ?? 'pendiente'
                  }`}
                >
                  <th className={styles.zoneName} scope="row">
                    <span className={styles.cellMuted}>
                      {`${municipio.displayName} · ${ETIQUETAS_AREA[area.areaType]}`}
                    </span>
                    {unidad.displayName}
                  </th>
                  <CeldasDeMetricas metrics={unidad.metrics} />
                </tr>
              )),
            )}
          </tbody>
        ))}
      </table>
    </div>
  );
}

/** Composición de la vista a partir de un estado ya resuelto. */
export function MunicipalityTerritoryView({
  estado,
  config = municipalityDemo,
  tituloRef,
}: {
  readonly estado: EstadoAgregado<TerritorySummary>;
  readonly config?: MunicipalityConfig;
  readonly tituloRef?: Ref<HTMLHeadingElement>;
}): ReactNode {
  const { territorio } = config;
  const hayDatos = estado.estado === 'listo' && estado.datos.municipalities.length > 0;

  return (
    <div className={styles.view}>
      <div className={styles.viewHead}>
        <div className={styles.viewHeadRow}>
          <h1
            className={styles.viewTitle}
            id={SECCION_ID.titulo}
            ref={tituloRef}
            tabIndex={-1}
          >
            {territorio.titulo}
          </h1>
          <p className={styles.demoTag}>{TEXTOS_AGREGADOS.fuenteEtiqueta}</p>
        </div>
        <p className={styles.viewDescription}>{DESCRIPCIONES.territorio}</p>
        <p className={styles.viewNote}>
          {estado.estado === 'listo'
            ? `${textoDeCorte(estado.datos.asOfDate)} ${TEXTOS_AGREGADOS.sinFuenteOficial}`
            : TEXTOS_AGREGADOS.sinFuenteOficial}
        </p>
        <p className={styles.viewNote}>{TEXTOS_AGREGADOS.supresion}</p>
      </div>

      <section
        className={`${styles.card} ${styles.territoryCard}`}
        aria-labelledby={SECCION_ID.titulo}
      >
        {hayDatos && estado.estado === 'listo' ? (
          <TablaTerritorio columnaZona={territorio.columnas.zona} datos={estado.datos} />
        ) : (
          <>
            {/*
              El encabezado de columna se conserva también sin datos: identifica
              la tabla que se está consultando sin inventar ninguna fila.
            */}
            <p className={styles.viewNote}>
              {`${territorio.columnas.zona} · ${COLUMNAS_TERRITORIO.personas} · ${COLUMNAS_TERRITORIO.mayores} · ${COLUMNAS_TERRITORIO.discapacidad} · ${COLUMNAS_TERRITORIO.cuidado} · ${COLUMNAS_TERRITORIO.pendientes}`}
            </p>
            <EstadoTerritorio estado={estado} />
          </>
        )}
      </section>
    </div>
  );
}

export function MunicipalityTerritory({
  config = municipalityDemo,
  tituloRef,
}: {
  readonly config?: MunicipalityConfig;
  /** Referencia del encabezado principal, para el foco al cambiar de vista. */
  readonly tituloRef?: Ref<HTMLHeadingElement>;
}): ReactNode {
  const consultar = useCallback(
    (signal: AbortSignal) => fetchTerritorySummary(fetch, signal),
    [],
  );
  const estado = useMunicipalityAggregate(consultar);

  return <MunicipalityTerritoryView estado={estado} config={config} tituloRef={tituloRef} />;
}
