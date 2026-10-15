import { MUNICIPAL_OFFICIAL_SOURCES, MUNICIPAL_SOURCES_CHECKED_ON } from '@merdn/shared';
import type { MunicipalSectionId } from '@merdn/shared';
import styles from './municipalityManagement.module.css';

export function MunicipalitySources({ section }: { readonly section?: MunicipalSectionId }) {
  const sources = MUNICIPAL_OFFICIAL_SOURCES.filter(source => section === undefined || (source.sections as readonly string[]).includes(section));
  if (sources.length === 0) return null;
  return <section className={styles.card} aria-labelledby="municipal-sources-title">
    <h2 id="municipal-sources-title">Fuentes externas oficiales</h2>
    <p>Accesos a las páginas reales de las entidades. Los enlaces no significan que los datos estén importados o verificados en Eloisa.</p>
    <ul className={styles.sources}>{sources.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}<span className="merdn-sr-only"> (abre otra pestaña)</span></a></li>)}</ul>
    <p className={styles.note}>Fuentes identificadas el {MUNICIPAL_SOURCES_CHECKED_ON}. Algunas consultas requieren una cuenta autorizada por la entidad. El registro de certificados no acredita su validación.</p>
  </section>;
}
