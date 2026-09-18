import type { ReactNode, Ref } from 'react';

import styles from './municipality.module.css';
import { MUNICIPALITY_ESTADOS_CONEXION, municipalityDemo } from './municipalityConfig';
import type {
  MunicipalityAdresConfig,
  MunicipalityConfig,
  MunicipalityDemoAviso,
  MunicipalityTono,
} from './municipalityConfig';

/**
 * Vista «ADRES» de la experiencia Alcaldía (TASK-ALCALDIA-DEMO-FINAL, §9).
 *
 * Reproduce las líneas 502–541 de la referencia aprobada
 * `prototype-claude/Eligeme-Alcaldia.dc.html`: encabezado con la delimitación
 * institucional, cuadrícula de agregados de referencia y comparación por
 * concepto con las columnas `EN ELOISA`, `OFICIAL` y `DIFERENCIA`.
 *
 * Límite institucional: ADRES administra recursos e información del
 * aseguramiento en salud; no es un regulador, no emite calificación municipal y
 * no evalúa a la entidad territorial. La plataforma no determina giros, no
 * modifica la información oficial y no corrige ninguna fuente externa.
 *
 * Relación con el presupuesto: la información de aseguramiento NO es el
 * presupuesto municipal ni una parte declarada de él. Los montos municipales
 * viven en «Presupuesto y ejecución» (A-04) y esta pantalla no los duplica, no
 * los recalcula y no los contradice.
 *
 * Procedencia: las tres columnas de la comparación son fixtures, incluida la
 * columna `OFICIAL`. Mientras no exista una fuente autorizada conectada, el
 * dato oficial no está disponible y la pantalla lo escribe. Las diferencias son
 * observaciones para revisión administrativa: no son errores de la fuente
 * oficial y no habilitan ninguna acción sobre ella.
 *
 * Privacidad municipal: solo agregados. No hay personas, afiliación individual,
 * documento, ubicación exacta ni información asistencial.
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
  titulo: 'municipality-adres-titulo',
  agregados: 'municipality-adres-agregados',
  comparacion: 'municipality-adres-comparacion',
} as const;

/** Encabezado de la vista, con la etiqueta que la identifica como demostrativa. */
function MunicipalityAdresHead({
  adres,
  demo,
  tituloRef,
}: {
  readonly adres: MunicipalityAdresConfig;
  readonly demo: MunicipalityDemoAviso;
  readonly tituloRef?: Ref<HTMLHeadingElement>;
}): ReactNode {
  return (
    <div className={styles.viewHead}>
      <div className={styles.viewHeadRow}>
        <h1 className={styles.viewTitle} id={SECCION_ID.titulo} ref={tituloRef} tabIndex={-1}>
          {adres.titulo}
        </h1>
        <p className={styles.demoTag}>{demo.etiqueta}</p>
      </div>
      <p className={styles.viewDescription}>{adres.descripcion}</p>
      <ul className={styles.limitList}>
        {adres.limites.map((limite) => (
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
 * Agregados de referencia.
 *
 * Cada tarjeta escribe el marco conceptual del que provendría el dato y el
 * estado de conexión, que siempre es de ausencia: la referencia institucional y
 * el origen técnico del valor permanecen separados.
 */
function MunicipalityAdresAgregados({
  adres,
}: {
  readonly adres: MunicipalityAdresConfig;
}): ReactNode {
  return (
    <section aria-labelledby={SECCION_ID.agregados} className={styles.card}>
      <h2 className={styles.cardTitle} id={SECCION_ID.agregados}>
        {adres.agregadosTitulo}
      </h2>
      <dl className={styles.statGrid}>
        {adres.agregados.map((item) => (
          <div className={`${styles.statCard} ${CLASE_TONO[item.tono]}`} key={item.id}>
            <dt className={styles.statTerm}>
              <span className={styles.statValue}>{item.valor}</span>
              <span className={styles.statLabel}>{item.titulo}</span>
            </dt>
            <dd className={styles.statNote}>
              {item.fuente.referencia}
              {' · '}
              {MUNICIPALITY_ESTADOS_CONEXION[item.fuente.estadoConexion]}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/**
 * Comparación administrativa por concepto.
 *
 * Se compone como tabla para que cada valor conserve su relación con el
 * concepto de la fila y con el encabezado de columna al hacer reflow. La
 * diferencia se escribe con su significado —qué trabajo administrativo queda
 * pendiente— y nunca como corrección de la fuente oficial.
 */
function MunicipalityAdresComparacion({
  adres,
}: {
  readonly adres: MunicipalityAdresConfig;
}): ReactNode {
  const { comparacionColumnas } = adres;
  const columnas = [
    comparacionColumnas.concepto,
    comparacionColumnas.plataforma,
    comparacionColumnas.oficial,
    comparacionColumnas.diferencia,
  ];

  return (
    <section aria-labelledby={SECCION_ID.comparacion} className={styles.card}>
      <h2 className={styles.cardTitle} id={SECCION_ID.comparacion}>
        {adres.comparacionTitulo}
      </h2>
      <div
        aria-labelledby={SECCION_ID.comparacion}
        className={styles.tableScroll}
        role="group"
        tabIndex={0}
      >
        <table className={styles.table}>
          <caption className="merdn-sr-only">{adres.comparacionResumen}</caption>
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
            {adres.comparacion.map((fila) => (
              <tr key={fila.id}>
                <th className={styles.zoneName} scope="row">
                  {fila.concepto}
                </th>
                <td className={styles.cell}>{fila.enPlataforma}</td>
                <td className={styles.cell}>{fila.oficial}</td>
                <td className={`${styles.cell} ${CLASE_TONO[fila.tono]}`}>
                  <span className={styles.cellDiferencia}>{fila.diferencia}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={styles.insight}>
        <span className={styles.insightTag}>{adres.comparacionColumnas.diferencia}</span>
        <span className={styles.insightText}>{adres.notaRevision}</span>
      </p>
      <p className={styles.viewNote}>{adres.notaPresupuesto}</p>
    </section>
  );
}

export function MunicipalityAdres({
  config = municipalityDemo,
  tituloRef,
}: {
  readonly config?: MunicipalityConfig;
  /** Referencia del encabezado principal, para el foco al cambiar de vista. */
  readonly tituloRef?: Ref<HTMLHeadingElement>;
}): ReactNode {
  const { adres, demo } = config;

  return (
    <div className={styles.view}>
      <MunicipalityAdresHead adres={adres} demo={demo} tituloRef={tituloRef} />
      <MunicipalityAdresAgregados adres={adres} />
      <MunicipalityAdresComparacion adres={adres} />
    </div>
  );
}
