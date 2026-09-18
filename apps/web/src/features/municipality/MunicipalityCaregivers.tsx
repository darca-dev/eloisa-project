import type { ReactNode, Ref } from 'react';

import styles from './municipality.module.css';
import { MUNICIPALITY_ESTADOS_CONEXION, municipalityDemo } from './municipalityConfig';
import type {
  MunicipalityConfig,
  MunicipalityCuidadoresConfig,
  MunicipalityDemoAviso,
  MunicipalityTono,
} from './municipalityConfig';

/**
 * Vista «Cuidadores y formación» de la experiencia Alcaldía
 * (TASK-ALCALDIA-DEMO-FINAL, §12).
 *
 * Reproduce las líneas 604–634 de la referencia aprobada
 * `prototype-claude/Eligeme-Alcaldia.dc.html`: nueve agregados de cuidadores
 * identificados y la ruta de formación en cinco etapas, de la orientación a la
 * certificación verificada.
 *
 * Límite institucional del SENA: es una entidad formadora posible y una fuente
 * de referencia para la certificación de cuidadores. NO existe integración
 * técnica: no hay consulta, envío, validación automática ni intercambio de
 * información con esa entidad. Un certificado registrado no prueba su
 * autenticidad y «Certificación verificada» es un estado de fixture; una
 * verificación productiva futura exigirá autoridad competente, método acordado,
 * fecha, responsable y trazabilidad. Ningún certificado prueba por sí mismo
 * cumplimiento institucional ni resultado alguno de la medición oficial.
 *
 * Procedencia: todos los valores son fixture local de diseño y agregados.
 *
 * Privacidad municipal: no hay personas, documentos, ubicación exacta,
 * condiciones económicas individuales, listados ni exportación. El valor y el
 * porcentaje de cada etapa están escritos: la barra solo los acompaña.
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
  titulo: 'municipality-cuidadores-titulo',
  agregados: 'municipality-cuidadores-agregados',
  ruta: 'municipality-cuidadores-ruta',
  sena: 'municipality-cuidadores-sena',
} as const;

/** Encabezado de la vista, con la etiqueta que la identifica como demostrativa. */
function MunicipalityCaregiversHead({
  cuidadores,
  demo,
  tituloRef,
}: {
  readonly cuidadores: MunicipalityCuidadoresConfig;
  readonly demo: MunicipalityDemoAviso;
  readonly tituloRef?: Ref<HTMLHeadingElement>;
}): ReactNode {
  return (
    <div className={styles.viewHead}>
      <div className={styles.viewHeadRow}>
        <h1 className={styles.viewTitle} id={SECCION_ID.titulo} ref={tituloRef} tabIndex={-1}>
          {cuidadores.titulo}
        </h1>
        <p className={styles.demoTag}>{demo.etiqueta}</p>
      </div>
      <p className={styles.viewDescription}>{cuidadores.descripcion}</p>
      <ul className={styles.limitList}>
        {cuidadores.limites.map((limite) => (
          <li className={styles.limitItem} key={limite}>
            {limite}
          </li>
        ))}
      </ul>
      <p className={styles.viewNote}>{demo.aclaracion}</p>
    </div>
  );
}

/** Agregados de identificación, formación y certificación registrada. */
function MunicipalityCaregiversAgregados({
  cuidadores,
}: {
  readonly cuidadores: MunicipalityCuidadoresConfig;
}): ReactNode {
  return (
    <section aria-labelledby={SECCION_ID.agregados} className={styles.card}>
      <h2 className={styles.cardTitle} id={SECCION_ID.agregados}>
        {cuidadores.agregadosTitulo}
      </h2>
      <dl className={styles.statGrid}>
        {cuidadores.agregados.map((item) => (
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
 * Ruta de formación.
 *
 * Cada etapa declara `progressbar` con su valor y su texto, de modo que la
 * proporción no dependa solo del ancho ni del color.
 */
function MunicipalityCaregiversRuta({
  cuidadores,
}: {
  readonly cuidadores: MunicipalityCuidadoresConfig;
}): ReactNode {
  return (
    <section aria-labelledby={SECCION_ID.ruta} className={styles.card}>
      <h2 className={styles.cardTitle} id={SECCION_ID.ruta}>
        {cuidadores.rutaTitulo}
      </h2>
      <ul className={styles.routeList}>
        {cuidadores.ruta.map((paso) => {
          const etapaId = `${SECCION_ID.ruta}-${paso.id}`;

          return (
            <li className={`${styles.routeStep} ${CLASE_TONO[paso.tono]}`} key={paso.id}>
              <p className={styles.routeHead} id={etapaId}>
                <span className={styles.routeLabel}>{paso.etapa}</span>
                <span className={styles.routeValue}>
                  {paso.valor}
                  {' · '}
                  {paso.porcentajeTexto}
                </span>
              </p>
              <span
                aria-labelledby={etapaId}
                aria-valuemax={100}
                aria-valuemin={0}
                aria-valuenow={paso.porcentaje}
                aria-valuetext={paso.porcentajeTexto}
                className={styles.bar}
                role="progressbar"
              >
                <span
                  className={styles.barFill}
                  style={{ width: `${String(paso.porcentaje)}%` }}
                />
              </span>
            </li>
          );
        })}
      </ul>
      <p className={styles.viewNote}>{cuidadores.rutaResumen}</p>
    </section>
  );
}

export function MunicipalityCaregivers({
  config = municipalityDemo,
  tituloRef,
}: {
  readonly config?: MunicipalityConfig;
  /** Referencia del encabezado principal, para el foco al cambiar de vista. */
  readonly tituloRef?: Ref<HTMLHeadingElement>;
}): ReactNode {
  const { cuidadores, demo } = config;

  return (
    <div className={styles.view}>
      <MunicipalityCaregiversHead cuidadores={cuidadores} demo={demo} tituloRef={tituloRef} />
      <MunicipalityCaregiversAgregados cuidadores={cuidadores} />
      <MunicipalityCaregiversRuta cuidadores={cuidadores} />
      <section aria-labelledby={SECCION_ID.sena} className={styles.card}>
        <h2 className={styles.cardTitle} id={SECCION_ID.sena}>
          {cuidadores.senaTitulo}
        </h2>
        <p className={styles.viewDescription}>{cuidadores.senaTexto}</p>
        <p>
          <span className={styles.connectionTag}>
            {MUNICIPALITY_ESTADOS_CONEXION[cuidadores.fuenteFormadora.estadoConexion]}
          </span>
        </p>
        <p className={styles.stateNote}>{cuidadores.verificacionTexto}</p>
      </section>
    </div>
  );
}
