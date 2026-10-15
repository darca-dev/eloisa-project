'use client';
import { useEffect, useState, type Ref } from 'react';
import { MUNICIPAL_MANAGEMENT_SECTIONS, type MunicipalDocument, type MunicipalSection, type MunicipalSectionId } from '@merdn/shared';
import { municipalManagement, type MunicipalManagementResult } from './municipalityManagementClient';
import { MunicipalitySources } from './MunicipalitySources';
import styles from './municipalityManagement.module.css';

export function MunicipalityManagedSection({ section, tituloRef, onConfigure, onSessionInvalid }: { readonly section: MunicipalSectionId; readonly tituloRef: Ref<HTMLHeadingElement>; readonly onConfigure: () => void; readonly onSessionInvalid: () => void }) {
  const [result, setResult] = useState<MunicipalManagementResult | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setResult(null);
    void municipalManagement(section, undefined, controller.signal).then(value => { if (controller.signal.aborted || value.kind === 'cancelled') return; setResult(value); if (value.kind === 'unauthorized') onSessionInvalid(); });
    return () => controller.abort();
  }, [section, attempt, onSessionInvalid]);
  const definition: MunicipalSection = MUNICIPAL_MANAGEMENT_SECTIONS[section];
  return <div className={styles.page}>
    <header className={styles.heading}><div><h1 ref={tituloRef} tabIndex={-1}>{definition.title}</h1><p>{definition.description}</p></div><button className={styles.button} type="button" onClick={onConfigure}>Completar en Configuración</button></header>
    {result === null ? <p role="status">Consultando registros guardados…</p> : result.kind === 'ok' ? <MunicipalityEntries document={result.document} /> : <section className={styles.card}><p role="alert">{result.kind === 'forbidden' ? 'Esta cuenta no tiene acceso a los registros administrativos de Alcaldía.' : 'No se pudieron consultar los registros guardados.'}</p><button className={styles.button} type="button" onClick={() => setAttempt(value => value + 1)}>Reintentar consulta</button></section>}
    <MunicipalitySources section={section} />
  </div>;
}

export function MunicipalityEntries({ document }: { readonly document: MunicipalDocument }) {
  const definition: MunicipalSection = MUNICIPAL_MANAGEMENT_SECTIONS[document.section];
  if (document.entries.length === 0) return <section className={styles.card}><h2>Información por completar</h2><p role="status">No hay registros guardados en este apartado. El administrador de Alcaldía puede completarlo en Configuración.</p></section>;
  return <section className={styles.records} aria-label="Registros administrativos guardados">
    <p className={styles.note}>Revisión {document.version} · Último guardado: {document.updatedAt === null ? 'Sin fecha' : new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(document.updatedAt))}. Información registrada por la administración municipal.</p>
    {document.entries.map(entry => <article className={styles.card} key={entry.id}>
      <h2>{entry.title}</h2><p className={styles.provenance}>{entry.provenance === 'INSTITUTIONAL' ? 'Declaración institucional' : 'Transcripción de fuente externa · pendiente de verificación'}</p>
      <dl className={styles.details}><div><dt>Periodo</dt><dd>{entry.period}</dd></div>
        {definition.fields.filter(field => entry.values[field.key]).map(field => <div key={field.key}><dt>{field.label}</dt><dd>{field.kind === 'url' ? <a href={entry.values[field.key]} target="_blank" rel="noopener noreferrer">Consultar referencia<span className="merdn-sr-only"> (abre otra pestaña)</span></a> : entry.values[field.key]}</dd></div>)}
        {entry.asOf ? <div><dt>Fecha de corte</dt><dd>{entry.asOf}</dd></div> : null}
        {entry.sourceUrl ? <div><dt>Fuente declarada</dt><dd><a href={entry.sourceUrl} target="_blank" rel="noopener noreferrer">Abrir fuente<span className="merdn-sr-only"> (abre otra pestaña)</span></a></dd></div> : null}
      </dl>{entry.notes ? <p className={styles.notes}>{entry.notes}</p> : null}
    </article>)}
  </section>;
}
