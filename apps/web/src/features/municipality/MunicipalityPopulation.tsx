'use client';

import { useCallback, type ReactNode, type Ref } from 'react';

import styles from './municipality.module.css';
import { municipalityDemo } from './municipalityConfig';
import type { MunicipalityConfig } from './municipalityConfig';
import {
  CLAVES_INTERSECCION,
  DESCRIPCIONES,
  ETIQUETAS_CALIDAD,
  ETIQUETAS_INTERSECCION,
  ETIQUETAS_METRICA_OFICIAL,
  ETIQUETAS_POBLACION,
  TEXTOS_AGREGADOS,
  textoDeCorte,
  type EstadoAgregado,
  type PopulationSummary,
  type SuppressedCount,
} from './municipalityAggregates';
import { fetchPopulationSummary } from './municipalityAggregatesClient';
import { useMunicipalityAggregate } from './useMunicipalityAggregate';

/**
 * Vista «Población beneficiaria» de la experiencia Alcaldía
 * (TASK-MUNICIPALITY-CORE-01, FR-03, FR-05, FR-08 a FR-12).
 *
 * PROCEDENCIA: todas las cifras provienen de
 * `GET /api/v1/municipality/population-summary`, calculado en PostgreSQL sobre
 * los registros del tenant que el servidor resuelve. Esta vista NO conserva
 * ningún fixture como fuente ni como repliegue: si la consulta falla, muestra
 * el estado de error correspondiente y no rellena el hueco con un número de
 * diseño.
 *
 * La composición aprobada se conserva —encabezado, tres secciones, diagrama
 * decorativo, lista textual y nota administrativa—; lo que cambia es de dónde
 * salen los números y qué se declara cuando no existen.
 *
 * OFICIALIDAD: población total municipal, población objetivo, registro nacional
 * de discapacidad y cobertura NO están conectados. Se muestran como «Dato
 * oficial no disponible», sin valor, sin porcentaje y sin barra: la ausencia se
 * comunica, no se disimula.
 *
 * PRIVACIDAD: solo agregados. No hay nombre, documento, teléfono, ubicación
 * individual, historia clínica, diagnóstico ni ficha de persona; tampoco
 * búsqueda, exportación, edición ni enlace a registro alguno. La protección de
 * grupos pequeños la aplica el servidor: la vista nunca recibe el número real
 * de un grupo de 1 a 4 personas.
 *
 * CALIDAD: solo se muestra la métrica con regla real —normalización territorial
 * pendiente—. No se presentan duplicados potenciales, EPS faltante,
 * afiliaciones por verificar ni completitud, porque MERDN no puede calcularlos
 * hoy y mostrarlos sería afirmar un hallazgo inexistente.
 */

/** Identificadores de los títulos que nombran cada región de la vista. */
const SECCION_ID = {
  titulo: 'municipality-poblacion-titulo',
  objetivo: 'municipality-poblacion-objetivo',
  intersecciones: 'municipality-poblacion-intersecciones',
  calidad: 'municipality-poblacion-calidad',
} as const;

/** Acento del punto de cada segmento, en el orden aprobado de la lista. */
const CLASE_SEGMENTO = [
  styles.segAguamarina,
  styles.segAzul,
  styles.segRosa,
  styles.segPetroleo,
  styles.segPetroleo,
  styles.segPetroleo,
  styles.segFucsia,
] as const;

/** Posición aprobada de cada número rotulado sobre el diagrama decorativo. */
const DIAGRAMA = [
  { clave: 'olderOnly', clase: styles.vennValueMayor },
  { clave: 'disabilityOnly', clase: styles.vennValueDiscapacidad },
  { clave: 'homeCareOnly', clase: styles.vennValueCuidados },
  { clave: 'allThree', clase: styles.vennValueTodas },
] as const;

/**
 * Mensaje del estado no resuelto de una sección.
 *
 * Se anuncia a las tecnologías de asistencia: `status` mientras se consulta y
 * `alert` cuando la consulta no pudo completarse.
 */
function EstadoSeccion({ estado }: { readonly estado: EstadoAgregado<unknown> }): ReactNode {
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

  return (
    <p className={styles.stateNote} role="alert">
      {TEXTOS_AGREGADOS.error}
    </p>
  );
}

/** Encabezado de la vista, con la procedencia real y el corte declarado. */
function Encabezado({
  titulo,
  estado,
  tituloRef,
}: {
  readonly titulo: string;
  readonly estado: EstadoAgregado<PopulationSummary>;
  readonly tituloRef?: Ref<HTMLHeadingElement>;
}): ReactNode {
  return (
    <div className={styles.viewHead}>
      <div className={styles.viewHeadRow}>
        <h1 className={styles.viewTitle} id={SECCION_ID.titulo} ref={tituloRef} tabIndex={-1}>
          {titulo}
        </h1>
        <p className={styles.demoTag}>{TEXTOS_AGREGADOS.fuenteEtiqueta}</p>
      </div>
      <p className={styles.viewDescription}>{DESCRIPCIONES.poblacion}</p>
      <p className={styles.viewNote}>
        {estado.estado === 'listo'
          ? `${textoDeCorte(estado.datos.asOfDate)} ${TEXTOS_AGREGADOS.sinFuenteOficial}`
          : TEXTOS_AGREGADOS.sinFuenteOficial}
      </p>
      <p className={styles.viewNote}>{TEXTOS_AGREGADOS.supresion}</p>
    </div>
  );
}

/** Tarjeta de un conteo real, con su valor escrito. */
function TarjetaConteo({
  conteo,
  etiqueta,
  tono,
}: {
  readonly conteo: SuppressedCount;
  readonly etiqueta: string;
  readonly tono: string;
}): ReactNode {
  return (
    <div className={`${styles.statCard} ${tono}`}>
      <dt className={styles.statTerm}>
        <span className={styles.statValue}>{conteo.display}</span>
        <span className={styles.statLabel}>{etiqueta}</span>
      </dt>
      <dd className={styles.statNote}>
        {conteo.status === 'SUPPRESSED'
          ? 'Grupo pequeño protegido: no se publica la cifra exacta.'
          : TEXTOS_AGREGADOS.fuenteEtiqueta}
      </dd>
    </div>
  );
}

/** Poblaciones registradas y métricas oficiales todavía no disponibles. */
function SeccionObjetivo({
  titulo,
  estado,
}: {
  readonly titulo: string;
  readonly estado: EstadoAgregado<PopulationSummary>;
}): ReactNode {
  return (
    <section className={styles.card} aria-labelledby={SECCION_ID.objetivo}>
      <h2 className={styles.cardTitle} id={SECCION_ID.objetivo}>
        {titulo}
      </h2>

      {estado.estado === 'listo' ? (
        <dl className={styles.statGrid}>
          <TarjetaConteo
            conteo={estado.datos.uniqueRegistered}
            etiqueta={ETIQUETAS_POBLACION.uniqueRegistered}
            tono={styles.tonoVerde}
          />
          <TarjetaConteo
            conteo={estado.datos.populations.olderAdult60Plus}
            etiqueta={ETIQUETAS_POBLACION.olderAdult60Plus}
            tono={styles.tonoAzul}
          />
          <TarjetaConteo
            conteo={estado.datos.populations.disabilityDeclared}
            etiqueta={ETIQUETAS_POBLACION.disabilityDeclared}
            tono={styles.tonoAzul}
          />
          <TarjetaConteo
            conteo={estado.datos.populations.homeCareRequiredDeclared}
            etiqueta={ETIQUETAS_POBLACION.homeCareRequiredDeclared}
            tono={styles.tonoTeal}
          />
          {estado.datos.officialMetrics.map((metrica) => (
            <div
              className={`${styles.statCard} ${styles.tonoAmarillo}`}
              key={metrica.metric}
            >
              <dt className={styles.statTerm}>
                <span className={styles.statValue}>—</span>
                <span className={styles.statLabel}>
                  {ETIQUETAS_METRICA_OFICIAL[metrica.metric]}
                </span>
              </dt>
              <dd className={styles.statNote}>{TEXTOS_AGREGADOS.datoOficialNoDisponible}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <EstadoSeccion estado={estado} />
      )}
    </section>
  );
}

/**
 * Intersección de poblaciones.
 *
 * El diagrama es decorativo y se oculta a las tecnologías de asistencia: repite
 * cuatro valores que la lista ya contiene. La lista textual es la
 * representación canónica y completa de los siete segmentos y del total.
 */
function SeccionIntersecciones({
  estado,
}: {
  readonly estado: EstadoAgregado<PopulationSummary>;
}): ReactNode {
  return (
    <section className={styles.card} aria-labelledby={SECCION_ID.intersecciones}>
      <h2 className={styles.cardTitle} id={SECCION_ID.intersecciones}>
        Intersección de poblaciones
      </h2>

      {estado.estado === 'listo' ? (
        <div className={styles.venn}>
          <div
            className={styles.vennChart}
            aria-hidden="true"
            data-municipality-diagrama="intersecciones"
          >
            <span className={`${styles.vennCircle} ${styles.vennMayor}`} />
            <span className={`${styles.vennCircle} ${styles.vennDiscapacidad}`} />
            <span className={`${styles.vennCircle} ${styles.vennCuidados}`} />
            {DIAGRAMA.map((etiqueta) => (
              <span className={`${styles.vennValue} ${etiqueta.clase}`} key={etiqueta.clave}>
                {estado.datos.exclusiveIntersections[etiqueta.clave].display}
              </span>
            ))}
          </div>
          <div className={styles.vennList}>
            <p className="merdn-sr-only">
              Diagrama decorativo de tres poblaciones que se cruzan. Repite cuatro de los
              valores de la lista siguiente, que es la representación completa de los siete
              segmentos y de su total.
            </p>
            <ul className={styles.segmentList}>
              {CLAVES_INTERSECCION.map((clave, indice) => (
                <li className={`${styles.segment} ${CLASE_SEGMENTO[indice]}`} key={clave}>
                  <span className={styles.segmentDot} aria-hidden="true" />
                  <span className={styles.segmentLabel}>{ETIQUETAS_INTERSECCION[clave]}</span>
                  <span className={styles.segmentValue}>
                    {estado.datos.exclusiveIntersections[clave].display}
                  </span>
                </li>
              ))}
              <li className={`${styles.segment} ${styles.segTinta} ${styles.segmentTotal}`}>
                <span className={styles.segmentDot} aria-hidden="true" />
                <span className={styles.segmentLabel}>
                  {ETIQUETAS_POBLACION.uniqueRegistered}
                </span>
                <span className={styles.segmentValue}>
                  {estado.datos.uniqueRegistered.display}
                </span>
              </li>
            </ul>
            <p className={styles.highlight}>
              Cada persona cae en una sola de las siete combinaciones. Quien cumple las tres
              condiciones cuenta una vez en el total de beneficiarios únicos.
            </p>
          </div>
        </div>
      ) : (
        <EstadoSeccion estado={estado} />
      )}
    </section>
  );
}

/** Calidad administrativa del registro: solo la métrica con regla real. */
function SeccionCalidad({
  titulo,
  estado,
}: {
  readonly titulo: string;
  readonly estado: EstadoAgregado<PopulationSummary>;
}): ReactNode {
  return (
    <section
      className={`${styles.card} ${styles.qualityCard}`}
      aria-labelledby={SECCION_ID.calidad}
    >
      <h2 className={styles.cardTitle} id={SECCION_ID.calidad}>
        {titulo}
      </h2>

      {estado.estado === 'listo' ? (
        <dl className={styles.qualityGrid}>
          <div className={`${styles.statCard} ${styles.tonoAmarillo}`}>
            <dt className={styles.qualityTerm}>
              <span className={styles.qualityValue}>
                {estado.datos.quality.territoryPendingNormalization.display}
              </span>
            </dt>
            <dd className={styles.qualityLabel}>
              {ETIQUETAS_CALIDAD.territoryPendingNormalization}
            </dd>
          </div>
        </dl>
      ) : (
        <EstadoSeccion estado={estado} />
      )}

      <p className={styles.viewNote}>{ETIQUETAS_CALIDAD.aclaracion}</p>
    </section>
  );
}

/** Composición de la vista a partir de un estado ya resuelto. */
export function MunicipalityPopulationView({
  estado,
  config = municipalityDemo,
  tituloRef,
}: {
  readonly estado: EstadoAgregado<PopulationSummary>;
  readonly config?: MunicipalityConfig;
  readonly tituloRef?: Ref<HTMLHeadingElement>;
}): ReactNode {
  const { poblacion } = config;

  return (
    <div className={styles.view}>
      <Encabezado titulo={poblacion.titulo} estado={estado} tituloRef={tituloRef} />
      <SeccionObjetivo titulo={poblacion.objetivoTitulo} estado={estado} />
      <SeccionIntersecciones estado={estado} />
      <SeccionCalidad titulo={poblacion.calidadTitulo} estado={estado} />
    </div>
  );
}

export function MunicipalityPopulation({
  config = municipalityDemo,
  tituloRef,
}: {
  readonly config?: MunicipalityConfig;
  /** Referencia del encabezado principal, para el foco al cambiar de vista. */
  readonly tituloRef?: Ref<HTMLHeadingElement>;
}): ReactNode {
  const consultar = useCallback(
    (signal: AbortSignal) => fetchPopulationSummary(fetch, signal),
    [],
  );
  const estado = useMunicipalityAggregate(consultar);

  return (
    <MunicipalityPopulationView estado={estado} config={config} tituloRef={tituloRef} />
  );
}
