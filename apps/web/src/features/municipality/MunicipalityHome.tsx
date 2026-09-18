import type { ReactNode, Ref } from 'react';

import styles from './municipality.module.css';
import { municipalityDemo } from './municipalityConfig';
import type {
  MunicipalityConfig,
  MunicipalityDemoAviso,
  MunicipalityInicioConfig,
  MunicipalityTono,
} from './municipalityConfig';
import type { MunicipalityModuloId } from './municipalityViews';

/**
 * Pantalla Inicio de la experiencia Alcaldía (TASK-ALCALDIA-A-01, §8.4–§8.8).
 *
 * Reproduce las líneas 103–169 de la referencia aprobada, en su orden
 * vinculante: titulares, cadena «De la persona a la evidencia», aclaración de
 * deduplicación, alertas y pendientes de gestión, accesos rápidos y actividades
 * recientes.
 *
 * Todo el contenido llega por configuración tipada. Ningún valor vive dentro
 * del JSX y todos son fixtures ficticios de diseño: no son cifras oficiales, no
 * se calculan, no se consultan y no prueban ninguna integración activa. La
 * cadena es una representación visual: A-01 no implementa regla, consulta ni
 * algoritmo de deduplicación.
 *
 * Privacidad municipal: solo información agregada y anonimizada. No hay
 * historia clínica, diagnóstico, medicamento, medición, alerta clínica
 * individual, dirección exacta, nombre de persona, documento, salario ni
 * honorario. Ningún elemento abre drill-down nominal, búsqueda de personas,
 * exportación ni enlace a registros.
 */

/** Clase de acento por tono. El tono nunca es el único portador del significado. */
const CLASE_TONO: Record<MunicipalityTono, string> = {
  azul: styles.tonoAzul,
  teal: styles.tonoTeal,
  verde: styles.tonoVerde,
  amarillo: styles.tonoAmarillo,
  rojo: styles.tonoRojo,
};

/** Identificadores de los títulos que nombran cada región de Inicio. */
const SECCION_ID = {
  titulares: 'municipality-inicio-titulares',
  cadena: 'municipality-inicio-cadena',
  pendientes: 'municipality-inicio-pendientes',
  accesos: 'municipality-inicio-accesos',
  actividades: 'municipality-inicio-actividades',
} as const;

/** Navegación inerte: Inicio se lee igual cuando el shell no la aporta. */
function sinNavegacion(): void {
  /* Sin controlador, los accesos rápidos solo se leen; ninguno actúa. */
}

/** Titulares agregados y etiqueta de datos demostrativos. */
function MunicipalityTitulares({
  inicio,
  demo,
  tituloRef,
}: {
  readonly inicio: MunicipalityInicioConfig;
  readonly demo: MunicipalityDemoAviso;
  readonly tituloRef?: Ref<HTMLHeadingElement>;
}): ReactNode {
  return (
    <section className={styles.hero} aria-labelledby={SECCION_ID.titulares}>
      <div className={styles.heroHead}>
        <h1 className={styles.heroTitle} id={SECCION_ID.titulares} ref={tituloRef} tabIndex={-1}>
          {inicio.titularesTitulo}
        </h1>
        <p className={styles.demoTag}>{demo.etiqueta}</p>
      </div>
      <dl className={styles.kpiGrid}>
        {inicio.kpis.map((kpi) => (
          <div className={styles.kpi} key={kpi.id}>
            <dt className={styles.kpiTitle}>
              <span className={styles.kpiValue}>{kpi.valor}</span>
              <span className={styles.kpiLabel}>{kpi.titulo}</span>
            </dt>
            <dd className={styles.kpiNote}>{kpi.aclaracion}</dd>
          </div>
        ))}
      </dl>
      <p className={styles.demoNote}>{demo.aclaracion}</p>
    </section>
  );
}

/** Cadena «De la persona a la evidencia» y aclaración de deduplicación. */
function MunicipalityCadena({ inicio }: { readonly inicio: MunicipalityInicioConfig }): ReactNode {
  return (
    <section className={styles.card} aria-labelledby={SECCION_ID.cadena}>
      <h2 className={styles.cardTitle} id={SECCION_ID.cadena}>
        {inicio.cadenaTitulo}
      </h2>
      <ol className={styles.chain}>
        {inicio.cadena.map((etapa) => (
          <li className={`${styles.chainItem} ${CLASE_TONO[etapa.tono]}`} key={etapa.id}>
            <span className={styles.chainStage}>{etapa.etapa}</span>
            <span className={styles.chainValue}>{etapa.valor}</span>
            <span className={styles.chainNote}>{etapa.aclaracion}</span>
          </li>
        ))}
      </ol>
      <p className={styles.chainCaption}>{inicio.cadenaAclaracion}</p>
    </section>
  );
}

/** Alertas y pendientes de gestión: solo pendientes administrativos agregados. */
function MunicipalityPendientes({
  inicio,
}: {
  readonly inicio: MunicipalityInicioConfig;
}): ReactNode {
  return (
    <section
      className={`${styles.card} ${styles.pendingCard}`}
      aria-labelledby={SECCION_ID.pendientes}
    >
      <h2 className={styles.cardTitle} id={SECCION_ID.pendientes}>
        {inicio.pendientesTitulo}
      </h2>
      <ul className={styles.pendingList}>
        {inicio.pendientes.map((pendiente) => (
          <li className={`${styles.pending} ${CLASE_TONO[pendiente.tono]}`} key={pendiente.id}>
            <span className={styles.pendingText}>{pendiente.texto}</span>
            <span className={styles.pendingLevel}>{pendiente.nivel}</span>
          </li>
        ))}
      </ul>
      <p className={styles.pendingCaption}>{inicio.pendientesAclaracion}</p>
    </section>
  );
}

/** Accesos rápidos: cambian la vista local y no ejecutan ninguna operación. */
function MunicipalityAccesos({
  inicio,
  onNavegar,
}: {
  readonly inicio: MunicipalityInicioConfig;
  readonly onNavegar: (destino: MunicipalityModuloId) => void;
}): ReactNode {
  return (
    <section className={styles.card} aria-labelledby={SECCION_ID.accesos}>
      <h2 className={styles.cardTitle} id={SECCION_ID.accesos}>
        {inicio.accesosTitulo}
      </h2>
      <div className={styles.shortcuts}>
        {inicio.accesos.map((acceso) => (
          <button
            key={acceso.id}
            type="button"
            className={styles.shortcut}
            onClick={() => {
              onNavegar(acceso.destino);
            }}
          >
            {acceso.etiqueta}
          </button>
        ))}
      </div>
    </section>
  );
}

/** Actividades recientes: actividad institucional agregada, sin actor nominal. */
function MunicipalityActividades({
  inicio,
}: {
  readonly inicio: MunicipalityInicioConfig;
}): ReactNode {
  return (
    <section className={styles.card} aria-labelledby={SECCION_ID.actividades}>
      <h2 className={styles.cardTitle} id={SECCION_ID.actividades}>
        {inicio.actividadesTitulo}
      </h2>
      <ul className={styles.activityList}>
        {inicio.actividades.map((actividad) => (
          <li className={`${styles.activity} ${CLASE_TONO[actividad.tono]}`} key={actividad.id}>
            <span className={styles.activityDot} aria-hidden="true" />
            <span className={styles.activityText}>
              <span className={styles.activityTitle}>{actividad.texto}</span>
              <span className={styles.activityMeta}>{actividad.cuando}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function MunicipalityHome({
  config = municipalityDemo,
  onNavegar = sinNavegacion,
  tituloRef,
}: {
  readonly config?: MunicipalityConfig;
  /** Navegación local del shell; nunca crea rutas ni cambia la URL. */
  readonly onNavegar?: (destino: MunicipalityModuloId) => void;
  /** Referencia del encabezado principal, para el foco al cambiar de vista. */
  readonly tituloRef?: Ref<HTMLHeadingElement>;
}): ReactNode {
  const { inicio, demo } = config;

  return (
    <div className={styles.home}>
      <MunicipalityTitulares inicio={inicio} demo={demo} tituloRef={tituloRef} />
      <MunicipalityCadena inicio={inicio} />
      <div className={styles.homeColumns}>
        <MunicipalityPendientes inicio={inicio} />
        <div className={styles.homeAside}>
          <MunicipalityAccesos inicio={inicio} onNavegar={onNavegar} />
          <MunicipalityActividades inicio={inicio} />
        </div>
      </div>
    </div>
  );
}
