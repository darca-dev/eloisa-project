import type { ReactNode, Ref } from 'react';

import styles from './municipality.module.css';
import { MUNICIPALITY_ESTADOS_CONEXION, municipalityDemo } from './municipalityConfig';
import type {
  MunicipalityConfig,
  MunicipalityDemoAviso,
  MunicipalityFuragConfig,
  MunicipalityTono,
} from './municipalityConfig';

/**
 * Vista «FURAG y MIPG» de la experiencia Alcaldía
 * (TASK-ALCALDIA-DEMO-FINAL, §8).
 *
 * Reproduce las líneas 438–500 de la referencia aprobada
 * `prototype-claude/Eligeme-Alcaldia.dc.html`: encabezado con la explicación
 * institucional, dos tarjetas superiores —resultado de referencia con su serie
 * histórica y evidencia disponible—, mapa de evidencias por política de MIPG y
 * nota institucional final.
 *
 * Límite institucional: la plataforma no calcula el puntaje FURAG, no declara
 * cumplimiento, no certifica mejora y no produce ninguna clasificación oficial
 * entre municipios. La medición corresponde a la autoridad competente y esta
 * pantalla solo organiza evidencia disponible para soporte de gestión.
 *
 * Procedencia: todos los valores son fixture local de diseño, incluido el
 * `71,4` y la serie por vigencia. Ninguno fue importado, consultado ni
 * sincronizado: no existe conexión con Función Pública ni con ningún sistema de
 * reporte, y la pantalla lo escribe donde el valor aparece.
 *
 * Privacidad municipal: solo agregados y metadatos administrativos. No hay
 * personas, documentos, ubicación exacta, información asistencial individual ni
 * exportación.
 */

/** Clase de acento por tono. El tono acompaña al texto y nunca lo sustituye. */
const CLASE_TONO: Record<MunicipalityTono, string> = {
  azul: styles.tonoAzul,
  teal: styles.tonoTeal,
  verde: styles.tonoVerde,
  amarillo: styles.tonoAmarillo,
  rojo: styles.tonoRojo,
};

/** Identificadores de los títulos que nombran cada región de la vista. */
const SECCION_ID = {
  titulo: 'municipality-furag-titulo',
  resultado: 'municipality-furag-resultado',
  historico: 'municipality-furag-historico',
  disponible: 'municipality-furag-disponible',
  matriz: 'municipality-furag-matriz',
} as const;

/** Encabezado de la vista, con la etiqueta que la identifica como demostrativa. */
function MunicipalityFuragHead({
  furag,
  demo,
  tituloRef,
}: {
  readonly furag: MunicipalityFuragConfig;
  readonly demo: MunicipalityDemoAviso;
  readonly tituloRef?: Ref<HTMLHeadingElement>;
}): ReactNode {
  return (
    <div className={styles.viewHead}>
      <div className={styles.viewHeadRow}>
        <h1 className={styles.viewTitle} id={SECCION_ID.titulo} ref={tituloRef} tabIndex={-1}>
          {furag.titulo}
        </h1>
        <p className={styles.demoTag}>{demo.etiqueta}</p>
      </div>
      <p className={styles.viewDescription}>{furag.descripcion}</p>
      <div className={styles.sourceNote}>
        <p className={styles.insightTag}>{furag.queEsTitulo}</p>
        <p>{furag.queEsTexto}</p>
      </div>
      <ul className={styles.limitList}>
        {furag.limites.map((limite) => (
          <li className={styles.limitItem} key={limite}>
            {limite}
          </li>
        ))}
      </ul>
      <p className={styles.viewNote}>{demo.aclaracion}</p>
    </div>
  );
}

/**
 * Resultado de referencia y su serie por vigencia.
 *
 * El valor se muestra junto a su estado de conexión escrito y a la nota que
 * declara su naturaleza de fixture: la cifra nunca aparece sola y nunca aparece
 * como resultado oficial disponible.
 */
function MunicipalityFuragResultado({
  furag,
}: {
  readonly furag: MunicipalityFuragConfig;
}): ReactNode {
  const { resultado } = furag;

  return (
    <section
      aria-labelledby={SECCION_ID.resultado}
      className={`${styles.card} ${styles.splitCard}`}
    >
      <h2 className={styles.cardTitle} id={SECCION_ID.resultado}>
        {resultado.titulo}
      </h2>
      <p className={styles.metric}>
        <span className={styles.metricValue}>{resultado.valor}</span>
        <span className={styles.metricContext}>{resultado.contexto}</span>
      </p>
      <p>
        <span className={styles.connectionTag}>
          {MUNICIPALITY_ESTADOS_CONEXION[resultado.fuente.estadoConexion]}
        </span>
      </p>
      <p className={styles.sourceNote}>{resultado.nota}</p>
      <h3 className={styles.cardTitle} id={SECCION_ID.historico}>
        {furag.historicoTitulo}
      </h3>
      {/*
       * La altura de cada barra es decorativa: el valor y la vigencia están
       * escritos, de modo que la serie se lee sin depender del alto ni del
       * color.
       */}
      <ul aria-describedby={SECCION_ID.historico} className={styles.historyChart}>
        {furag.historico.map((punto) => (
          <li className={`${styles.historyBar} ${CLASE_TONO[punto.tono]}`} key={punto.id}>
            <span className={styles.historyValue}>{punto.valor}</span>
            <span
              aria-hidden="true"
              className={styles.historyFill}
              style={{ height: `${String(punto.altura)}%` }}
            />
            <span className={styles.historyYear}>{punto.vigencia}</span>
          </li>
        ))}
      </ul>
      <p className={styles.viewNote}>{furag.historicoResumen}</p>
    </section>
  );
}

/** Evidencia disponible: agregados documentales, sin ninguna afirmación de mérito. */
function MunicipalityFuragDisponible({
  furag,
}: {
  readonly furag: MunicipalityFuragConfig;
}): ReactNode {
  return (
    <section
      aria-labelledby={SECCION_ID.disponible}
      className={`${styles.card} ${styles.splitCard}`}
    >
      <h2 className={styles.cardTitle} id={SECCION_ID.disponible}>
        {furag.disponibleTitulo}
      </h2>
      <dl className={styles.statGrid}>
        {furag.disponibles.map((item) => (
          <div className={`${styles.statCard} ${styles.tonoTeal}`} key={item.id}>
            <dt className={styles.statTerm}>
              <span className={styles.statValue}>{item.valor}</span>
              <span className={styles.statLabel}>{item.titulo}</span>
            </dt>
            <dd className={styles.statNote}>{item.aclaracion}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/**
 * Mapa de evidencias por política de MIPG.
 *
 * El estado describe la evidencia disponible —completa, parcial o pendiente—,
 * nunca el cumplimiento de la entidad. Se compone como tabla para que cada dato
 * conserve su relación con la política y con el encabezado de columna también
 * al hacer reflow.
 */
function MunicipalityFuragMatriz({
  furag,
}: {
  readonly furag: MunicipalityFuragConfig;
}): ReactNode {
  const { matrizColumnas } = furag;
  const columnas = [
    matrizColumnas.politica,
    matrizColumnas.evidencia,
    matrizColumnas.responsable,
    matrizColumnas.periodo,
    matrizColumnas.estado,
  ];

  return (
    <section aria-labelledby={SECCION_ID.matriz} className={styles.card}>
      <h2 className={styles.cardTitle} id={SECCION_ID.matriz}>
        {furag.matrizTitulo}
      </h2>
      <div
        aria-labelledby={SECCION_ID.matriz}
        className={styles.tableScroll}
        role="group"
        tabIndex={0}
      >
        <table className={styles.table}>
          <caption className="merdn-sr-only">{furag.matrizResumen}</caption>
          <thead>
            <tr>
              {columnas.map((columna) => (
                <th className={styles.tableHead} key={columna} scope="col">
                  {columna}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {furag.matriz.map((fila) => (
              <tr key={fila.id}>
                <th className={styles.zoneName} scope="row">
                  <span className={styles.cellStrong}>{fila.politica}</span>
                  <span className={styles.cellMuted}>{fila.dimension}</span>
                </th>
                <td className={styles.cell}>{fila.evidencia}</td>
                <td className={styles.cell}>{fila.responsable}</td>
                <td className={styles.cell}>{fila.periodo}</td>
                {/* El estado se escribe siempre: la píldora solo lo destaca. */}
                <td className={`${styles.cell} ${CLASE_TONO[fila.tono]}`}>
                  <span className={styles.statusPill}>
                    {furag.estadosEtiquetas[fila.estado]}
                  </span>
                  {/* La brecha y su acción de mejora solo aparecen si existen. */}
                  {fila.brecha === null ? null : (
                    <span className={styles.cellMuted}>{fila.brecha}</span>
                  )}
                  {fila.accionMejora === null ? null : (
                    <span className={styles.cellMuted}>{fila.accionMejora}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={styles.highlight}>{furag.notaInstitucional}</p>
    </section>
  );
}

export function MunicipalityFurag({
  config = municipalityDemo,
  tituloRef,
}: {
  readonly config?: MunicipalityConfig;
  /** Referencia del encabezado principal, para el foco al cambiar de vista. */
  readonly tituloRef?: Ref<HTMLHeadingElement>;
}): ReactNode {
  const { furag, demo } = config;

  return (
    <div className={styles.view}>
      <MunicipalityFuragHead demo={demo} furag={furag} tituloRef={tituloRef} />
      <div className={styles.splitRow}>
        <MunicipalityFuragResultado furag={furag} />
        <MunicipalityFuragDisponible furag={furag} />
      </div>
      <MunicipalityFuragMatriz furag={furag} />
    </div>
  );
}
