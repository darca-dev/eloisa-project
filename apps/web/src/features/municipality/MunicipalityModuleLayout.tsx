import type { Ref } from 'react';
import { MUNICIPALITY_MODULE_LAYOUTS, type MunicipalityPendingModule } from './municipalityModuleLayouts';
import layout from './municipality.module.css';
import styles from './municipalityOperational.module.css';

/** Layout of an unavailable query, never an empty result or a demonstration. */
export function MunicipalityModuleLayout({ vista, tituloRef, onVolver }: {
  readonly vista: MunicipalityPendingModule;
  readonly tituloRef: Ref<HTMLHeadingElement>;
  readonly onVolver: () => void;
}) {
  const definition = MUNICIPALITY_MODULE_LAYOUTS[vista];
  const base = `municipality-${vista}-layout`;
  return <div className={layout.view}>
    <header className={layout.viewHead}>
      <div className={layout.viewHeadRow}>
        <h1 className={layout.viewTitle} id={`${base}-title`} ref={tituloRef} tabIndex={-1}>{definition.title}</h1>
        <span className={styles.moduleStatus}>Pendiente de habilitar</span>
      </div>
      <p className={layout.viewDescription}>{definition.description}</p>
    </header>
    <p className={styles.sourceNote}>Consulta aún no disponible. Este apartado todavía no permite consultar registros ni realizar operaciones.</p>
    {definition.metrics ? <section className={layout.card} aria-labelledby={`${base}-metrics`}>
      <h2 className={layout.cardTitle} id={`${base}-metrics`}>Resumen de {vista === 'presupuesto' ? 'presupuesto y ejecución' : 'evidencias'}</h2>
      <dl className={styles.moduleMetrics}>{definition.metrics.map(label => <div className={styles.moduleMetric} key={label}><dt>{label}</dt><dd>Sin consulta</dd></div>)}</dl>
    </section> : null}
    {definition.sections.map((section, index) => <section className={layout.card} key={section.title} aria-labelledby={`${base}-section-${index}`}>
      <h2 className={layout.cardTitle} id={`${base}-section-${index}`}>{section.title}</h2>
      <p className={styles.moduleDescription}>{section.description}</p>
      {section.columns ? <div className={styles.moduleTableScroll} role="region" aria-label={section.title} tabIndex={0}>
        <table className={styles.moduleTable}>
          <caption className="merdn-sr-only">{section.title}: estructura de consulta pendiente de habilitar</caption>
          <thead><tr>{section.columns.map(column => <th scope="col" key={column}>{column}</th>)}</tr></thead>
          <tbody><tr><td colSpan={section.columns.length}>Consulta aún no disponible. No se han consultado registros.</td></tr></tbody>
        </table>
      </div> : section.items ? <ul className={styles.moduleCards}>{section.items.map(item => <li className={styles.moduleItem} key={item}><h3>{item}</h3><span className={styles.moduleItemState}>{vista === 'reportes' ? 'Generación no disponible' : 'Consulta no habilitada'}</span></li>)}</ul>
        : section.steps ? <ol className={styles.moduleSteps}>{section.steps.map(step => <li key={step}><strong>{step}</strong><span>Pendiente de habilitar</span></li>)}</ol>
          : <div className={styles.moduleEmpty}><span className={styles.moduleEmptyMark} aria-hidden="true">—</span><strong>Consulta pendiente de habilitar</strong></div>}
    </section>)}
    {definition.notice ? <p className={styles.sourceNote}>{definition.notice}</p> : null}
    <div><button className={styles.secondary} type="button" onClick={onVolver}>Volver al resumen municipal</button></div>
  </div>;
}
