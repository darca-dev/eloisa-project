import type { ReactNode, Ref } from 'react';

import styles from './municipality.module.css';
import { municipalityDemo } from './municipalityConfig';
import type {
  MunicipalityConfig,
  MunicipalityDemoAviso,
  MunicipalityIndicadoresConfig,
  MunicipalityTono,
} from './municipalityConfig';

/**
 * Vista «Indicadores y resultados» de la experiencia Alcaldía
 * (TASK-ALCALDIA-DEMO-FINAL, §13).
 *
 * Reproduce las líneas 636–674 de la referencia aprobada
 * `prototype-claude/Eligeme-Alcaldia.dc.html`: comparación de periodos con las
 * columnas `PERIODO ANTERIOR`, `PERIODO ACTUAL` y `VARIACIÓN` para los ocho
 * indicadores aprobados, y satisfacción agregada.
 *
 * Lectura de la variación: es una observación descriptiva del fixture. No
 * atribuye causalidad automática a la plataforma ni a ninguna intervención
 * concreta, y no existe fórmula, meta ni método de cálculo aprobados. La
 * definición, la unidad, la fórmula, el responsable, el método, la versión, la
 * fuente y el linaje quedan declarados en la configuración —vacíos donde no hay
 * decisión— para que un catálogo posterior los complete sin rediseñar la vista.
 *
 * Satisfacción: siempre agregada. Esta pantalla no muestra comentarios
 * individuales, no califica a personas concretas y no ordena a ningún
 * profesional.
 *
 * Privacidad municipal: no hay personas, documentos, ubicación exacta,
 * información asistencial individual, listados ni exportación.
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
  titulo: 'municipality-indicadores-titulo',
  comparacion: 'municipality-indicadores-comparacion',
  satisfaccion: 'municipality-indicadores-satisfaccion',
} as const;

/** Encabezado de la vista, con la etiqueta que la identifica como demostrativa. */
function MunicipalityIndicatorsHead({
  indicadores,
  demo,
  tituloRef,
}: {
  readonly indicadores: MunicipalityIndicadoresConfig;
  readonly demo: MunicipalityDemoAviso;
  readonly tituloRef?: Ref<HTMLHeadingElement>;
}): ReactNode {
  return (
    <div className={styles.viewHead}>
      <div className={styles.viewHeadRow}>
        <h1 className={styles.viewTitle} id={SECCION_ID.titulo} ref={tituloRef} tabIndex={-1}>
          {indicadores.titulo}
        </h1>
        <p className={styles.demoTag}>{demo.etiqueta}</p>
      </div>
      <p className={styles.viewDescription}>{indicadores.descripcion}</p>
      <ul className={styles.limitList}>
        {indicadores.limites.map((limite) => (
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
 * Comparación de periodos.
 *
 * Se compone como tabla para que cada valor conserve su relación con el
 * indicador de la fila y con el encabezado de columna al hacer reflow. La
 * definición y la unidad acompañan al nombre: sin ellas, un número comparado
 * entre periodos no significa nada verificable.
 */
function MunicipalityIndicatorsTabla({
  indicadores,
}: {
  readonly indicadores: MunicipalityIndicadoresConfig;
}): ReactNode {
  const { comparacionColumnas } = indicadores;
  const columnas = [
    comparacionColumnas.indicador,
    comparacionColumnas.anterior,
    comparacionColumnas.actual,
    comparacionColumnas.variacion,
  ];

  return (
    <section aria-labelledby={SECCION_ID.comparacion} className={styles.card}>
      <h2 className={styles.cardTitle} id={SECCION_ID.comparacion}>
        {indicadores.comparacionTitulo}
      </h2>
      <div
        aria-labelledby={SECCION_ID.comparacion}
        className={styles.tableScroll}
        role="group"
        tabIndex={0}
      >
        <table className={styles.table}>
          <caption className="merdn-sr-only">{indicadores.comparacionResumen}</caption>
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
            {indicadores.indicadores.map((indicador) => (
              <tr key={indicador.id}>
                <th className={styles.zoneName} scope="row">
                  <span className={styles.cellStrong}>{indicador.nombre}</span>
                  <span className={styles.cellMuted}>{indicador.definicion}</span>
                  <span className={styles.cellMuted}>{indicador.unidad}</span>
                </th>
                <td className={`${styles.cell} ${styles.cellMuted}`}>
                  {indicador.periodoAnterior}
                </td>
                <td className={`${styles.cell} ${styles.cellStrong}`}>
                  {indicador.periodoActual}
                </td>
                {/* La variación se escribe: el tono solo la acompaña. */}
                <td className={`${styles.cell} ${CLASE_TONO[indicador.tono]}`}>
                  <span className={styles.cellDiferencia}>{indicador.variacion}</span>
                  <span className={styles.cellMuted}>{indicadores.variacionFrase}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={styles.stateNote}>{indicadores.notaCausalidad}</p>
    </section>
  );
}

export function MunicipalityIndicators({
  config = municipalityDemo,
  tituloRef,
}: {
  readonly config?: MunicipalityConfig;
  /** Referencia del encabezado principal, para el foco al cambiar de vista. */
  readonly tituloRef?: Ref<HTMLHeadingElement>;
}): ReactNode {
  const { indicadores, demo } = config;

  return (
    <div className={styles.view}>
      <MunicipalityIndicatorsHead demo={demo} indicadores={indicadores} tituloRef={tituloRef} />
      <MunicipalityIndicatorsTabla indicadores={indicadores} />
      <section aria-labelledby={SECCION_ID.satisfaccion} className={styles.card}>
        <h2 className={styles.cardTitle} id={SECCION_ID.satisfaccion}>
          {indicadores.satisfaccionTitulo}
        </h2>
        <dl className={styles.statGrid}>
          {indicadores.satisfaccion.map((item) => (
            <div className={`${styles.statCard} ${styles.tonoTeal}`} key={item.id}>
              <dt className={styles.statTerm}>
                <span className={styles.statValue}>{item.valor}</span>
                <span className={styles.statLabel}>{item.titulo}</span>
              </dt>
              <dd className={styles.statNote}>{item.aclaracion}</dd>
            </div>
          ))}
        </dl>
        <p className={styles.viewNote}>{indicadores.notaSatisfaccion}</p>
      </section>
    </div>
  );
}
