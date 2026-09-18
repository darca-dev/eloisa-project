import type { ReactNode, Ref } from 'react';

import styles from './municipality.module.css';
import { MUNICIPALITY_ESTADOS_CONEXION, municipalityDemo } from './municipalityConfig';
import type {
  MunicipalityConfig,
  MunicipalityCuidadoConfig,
  MunicipalityDemoAviso,
} from './municipalityConfig';

/**
 * Vista «Seguimiento al derecho al cuidado» de la experiencia Alcaldía
 * (TASK-ALCALDIA-DEMO-FINAL, §10).
 *
 * Reproduce las líneas 543–583 de la referencia aprobada
 * `prototype-claude/Eligeme-Alcaldia.dc.html`: encabezado, doce acciones
 * registradas como agregados y matriz de seguimiento por componente con las
 * columnas `IDENTIFICADA`, `ATENDIDA`, `EN SEGUIMIENTO` y `PENDIENTE`.
 *
 * Límite institucional: la plataforma documenta acciones, cobertura, evidencia,
 * pendientes y seguimiento. No certifica el cumplimiento de ningún derecho:
 * esa determinación corresponde a la autoridad competente. El marco citado se
 * escribe con su denominación exacta, `Sentencia T-319 de 2025`, y su
 * aplicabilidad y la evidencia que exige siguen siendo decisiones materiales
 * pendientes que esta pantalla no interpreta.
 *
 * Procedencia: todos los valores son fixture local de diseño, agregados y sin
 * fuente conectada.
 *
 * Privacidad municipal: no hay personas, documentos, ubicación exacta,
 * información asistencial individual, listados ni exportación. Cada cifra es un
 * conteo agregado del municipio.
 */

/** Identificadores de los títulos que nombran cada región de la vista. */
const SECCION_ID = {
  titulo: 'municipality-cuidado-titulo',
  acciones: 'municipality-cuidado-acciones',
  matriz: 'municipality-cuidado-matriz',
} as const;

/** Encabezado de la vista, con la etiqueta que la identifica como demostrativa. */
function MunicipalityCareHead({
  cuidado,
  demo,
  tituloRef,
}: {
  readonly cuidado: MunicipalityCuidadoConfig;
  readonly demo: MunicipalityDemoAviso;
  readonly tituloRef?: Ref<HTMLHeadingElement>;
}): ReactNode {
  return (
    <div className={styles.viewHead}>
      <div className={styles.viewHeadRow}>
        <h1 className={styles.viewTitle} id={SECCION_ID.titulo} ref={tituloRef} tabIndex={-1}>
          {cuidado.titulo}
        </h1>
        <p className={styles.demoTag}>{demo.etiqueta}</p>
      </div>
      <p className={styles.viewDescription}>{cuidado.descripcion}</p>
      {/* La denominación de la sentencia se escribe una sola vez y exacta. */}
      <div className={styles.sourceNote}>
        <p className={styles.insightTag}>{cuidado.normaReferencia}</p>
        <p>{cuidado.normaTexto}</p>
        <p>
          <span className={styles.connectionTag}>
            {MUNICIPALITY_ESTADOS_CONEXION[cuidado.fuente.estadoConexion]}
          </span>
        </p>
      </div>
      <ul className={styles.limitList}>
        {cuidado.limites.map((limite) => (
          <li className={styles.limitItem} key={limite}>
            {limite}
          </li>
        ))}
      </ul>
      <p className={styles.viewNote}>{demo.aclaracion}</p>
    </div>
  );
}

/** Doce acciones registradas del periodo, siempre como agregados del municipio. */
function MunicipalityCareAcciones({
  cuidado,
}: {
  readonly cuidado: MunicipalityCuidadoConfig;
}): ReactNode {
  return (
    <section aria-labelledby={SECCION_ID.acciones} className={styles.card}>
      <h2 className={styles.cardTitle} id={SECCION_ID.acciones}>
        {cuidado.accionesTitulo}
      </h2>
      <dl className={styles.statGrid}>
        {cuidado.acciones.map((accion) => (
          <div className={`${styles.statCard} ${styles.tonoTeal}`} key={accion.id}>
            <dt className={styles.statTerm}>
              <span className={styles.statValue}>{accion.valor}</span>
              <span className={styles.statLabel}>{accion.titulo}</span>
            </dt>
            <dd className={styles.statNote}>{accion.aclaracion}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/**
 * Matriz de seguimiento por componente.
 *
 * Se compone como tabla para que cada valor conserve su relación con el
 * componente de la fila y con el encabezado de columna al hacer reflow.
 */
function MunicipalityCareMatriz({
  cuidado,
}: {
  readonly cuidado: MunicipalityCuidadoConfig;
}): ReactNode {
  const { matrizColumnas } = cuidado;
  const columnas = [
    matrizColumnas.componente,
    matrizColumnas.identificada,
    matrizColumnas.atendida,
    matrizColumnas.seguimiento,
    matrizColumnas.pendiente,
  ];

  return (
    <section aria-labelledby={SECCION_ID.matriz} className={styles.card}>
      <h2 className={styles.cardTitle} id={SECCION_ID.matriz}>
        {cuidado.matrizTitulo}
      </h2>
      <div
        aria-labelledby={SECCION_ID.matriz}
        className={styles.tableScroll}
        role="group"
        tabIndex={0}
      >
        <table className={styles.table}>
          <caption className="merdn-sr-only">{cuidado.matrizResumen}</caption>
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
            {cuidado.matriz.map((fila) => (
              <tr key={fila.id}>
                <th className={styles.zoneName} scope="row">
                  {fila.componente}
                </th>
                <td className={styles.cell}>{fila.identificada}</td>
                <td className={`${styles.cell} ${styles.tonoTeal} ${styles.cellDiferencia}`}>
                  {fila.atendida}
                </td>
                <td className={`${styles.cell} ${styles.tonoVerde} ${styles.cellDiferencia}`}>
                  {fila.seguimiento}
                </td>
                <td className={`${styles.cell} ${styles.tonoAmarillo} ${styles.cellDiferencia}`}>
                  {fila.pendiente}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={styles.highlight}>{cuidado.notaLenguaje}</p>
    </section>
  );
}

export function MunicipalityCare({
  config = municipalityDemo,
  tituloRef,
}: {
  readonly config?: MunicipalityConfig;
  /** Referencia del encabezado principal, para el foco al cambiar de vista. */
  readonly tituloRef?: Ref<HTMLHeadingElement>;
}): ReactNode {
  const { cuidado, demo } = config;

  return (
    <div className={styles.view}>
      <MunicipalityCareHead cuidado={cuidado} demo={demo} tituloRef={tituloRef} />
      <MunicipalityCareAcciones cuidado={cuidado} />
      <MunicipalityCareMatriz cuidado={cuidado} />
    </div>
  );
}
