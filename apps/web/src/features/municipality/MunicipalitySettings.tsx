'use client';
import { useEffect, useState, type Ref } from 'react';
import { MUNICIPAL_MANAGEMENT_SECTIONS, validateMunicipalWrite, type MunicipalDocument, type MunicipalEntry, type MunicipalSection, type MunicipalSectionId } from '@merdn/shared';
import { municipalManagement } from './municipalityManagementClient';
import { MunicipalitySources } from './MunicipalitySources';
import styles from './municipalityManagement.module.css';

export function MunicipalitySettings({ initialSection, tituloRef, onDirtyChange, onSessionInvalid }: { readonly initialSection: MunicipalSectionId; readonly tituloRef: Ref<HTMLHeadingElement>; readonly onDirtyChange: (dirty: boolean) => void; readonly onSessionInvalid: () => void }) {
  const [section, setSection] = useState(initialSection);
  const [document, setDocument] = useState<MunicipalDocument | null>(null);
  const [entries, setEntries] = useState<readonly MunicipalEntry[]>([]);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('');
  const [reload, setReload] = useState(0);
  useEffect(() => { onDirtyChange(dirty || busy); }, [dirty, busy, onDirtyChange]);
  useEffect(() => {
    const controller = new AbortController(); setDocument(null); setEntries([]); setMessage(''); setStatus('');
    void municipalManagement(section, undefined, controller.signal).then(result => {
      if (controller.signal.aborted || result.kind === 'cancelled') return;
      if (result.kind === 'ok') { setDocument(result.document); setEntries(result.document.entries); setDirty(false); }
      else { setMessage('No se pudo cargar el apartado. Reintenta la consulta.'); if (result.kind === 'unauthorized') onSessionInvalid(); }
    });
    return () => controller.abort();
  }, [section, reload, onSessionInvalid]);
  const definition: MunicipalSection = MUNICIPAL_MANAGEMENT_SECTIONS[section];
  const change = (id: string, updater: (entry: MunicipalEntry) => MunicipalEntry) => { setEntries(rows => rows.map(row => row.id === id ? updater(row) : row)); setDirty(true); setMessage(''); setStatus(''); };
  const add = () => {
    setEntries(rows => [...rows, { id: crypto.randomUUID(), title: '', period: '', provenance: definition.officialOnly ? 'EXTERNAL_TRANSCRIPTION' : 'INSTITUTIONAL', sourceUrl: '', asOf: '', notes: '', values: {} }]);
    setDirty(true); setStatus('');
  };
  const save = async () => {
    if (document === null || busy) return;
    const normalized = entries.map(entry => ({ ...entry, title: entry.title.trim(), period: entry.period.trim(), sourceUrl: entry.sourceUrl.trim(), notes: entry.notes.trim(), values: Object.fromEntries(Object.entries(entry.values).map(([key, value]) => [key, value.trim()])) }));
    const input = { expectedVersion: document.version, payloadSchemaVersion: 1 as const, entries: normalized };
    const invalid = validateMunicipalWrite(section, input);
    if (invalid !== null) { setMessage(invalid); return; }
    setBusy(true); setMessage(''); setStatus('');
    const result = await municipalManagement(section, input);
    setBusy(false);
    if (result.kind === 'ok') { setDocument(result.document); setEntries(result.document.entries); setDirty(false); setStatus('Cambios guardados. Ya están disponibles en el apartado correspondiente.'); }
    else {
      setMessage(result.kind === 'conflict' ? 'Otra ventana guardó cambios. Conservamos tu borrador; descártalo y recarga para editar la última revisión.' : result.kind === 'forbidden' ? 'Esta cuenta no tiene permiso para guardar cambios.' : 'No se confirmó el guardado. Conservamos tu borrador; recarga para comprobar la última revisión antes de reintentar.');
      if (result.kind === 'unauthorized') onSessionInvalid();
    }
  };
  return <div className={styles.page}>
    <header><h1 ref={tituloRef} tabIndex={-1}>Configuración de Alcaldía</h1><p>Completa los apartados con información de tu institución. Solo el administrador municipal puede guardar cambios.</p></header>
    <section className={styles.card} aria-labelledby="municipal-capture-title">
      <h2 id="municipal-capture-title">Información institucional</h2>
      <p>Registra únicamente información administrativa y agregada. No incluyas nombres de pacientes, documentos de identidad, direcciones ni datos clínicos. Usa dependencias institucionales como responsables.</p>
      <label className={styles.field}><span>Apartado que deseas completar</span><select value={section} disabled={dirty || busy} onChange={event => setSection(event.target.value as MunicipalSectionId)}>{Object.entries(MUNICIPAL_MANAGEMENT_SECTIONS).map(([key, value]) => <option key={key} value={key}>{value.title}</option>)}</select></label>
      <p>{definition.description}</p>
      {dirty ? <p className={styles.note}>Hay cambios sin guardar. Guarda o descarta el borrador antes de cambiar de apartado.</p> : null}
      <p role="alert" className={styles.error}>{message}</p><p role="status" className={styles.success}>{status}</p>
      {document === null ? <>{message === '' ? <p role="status">Cargando información guardada…</p> : <button type="button" className={styles.button} onClick={() => setReload(value => value + 1)}>Reintentar carga</button>}</> : <form onSubmit={event => { event.preventDefault(); void save(); }}>
        <fieldset className={styles.formBody} disabled={busy}><legend className="merdn-sr-only">Registros de {definition.title}</legend>
          {entries.length === 0 ? <p>No hay registros guardados. Agrega la información de tu institución.</p> : null}
          {entries.map((entry, index) => <fieldset key={entry.id} className={styles.entry}><legend>Registro {index + 1}</legend>
            <div className={styles.formGrid}>
              <label className={styles.field}><span>Título del registro *</span><input required maxLength={160} value={entry.title} onChange={event => change(entry.id, row => ({ ...row, title: event.target.value }))} /></label>
              <label className={styles.field}><span>Periodo de la información *</span><input required maxLength={80} value={entry.period} onChange={event => change(entry.id, row => ({ ...row, period: event.target.value }))} /></label>
              <label className={styles.field}><span>Procedencia</span><select value={entry.provenance} disabled={definition.officialOnly} onChange={event => change(entry.id, row => ({ ...row, provenance: event.target.value as MunicipalEntry['provenance'] }))}><option value="INSTITUTIONAL">Declaración institucional</option><option value="EXTERNAL_TRANSCRIPTION">Transcripción de fuente externa</option></select></label>
              <label className={styles.field}><span>Fecha de corte{entry.provenance === 'EXTERNAL_TRANSCRIPTION' ? ' *' : ''}</span><input type="date" required={entry.provenance === 'EXTERNAL_TRANSCRIPTION'} value={entry.asOf} onChange={event => change(entry.id, row => ({ ...row, asOf: event.target.value }))} /></label>
              <label className={`${styles.field} ${styles.full}`}><span>URL de la fuente{entry.provenance === 'EXTERNAL_TRANSCRIPTION' ? ' oficial *' : ' (opcional)'}</span><input type="url" required={entry.provenance === 'EXTERNAL_TRANSCRIPTION'} maxLength={1000} value={entry.sourceUrl} onChange={event => change(entry.id, row => ({ ...row, sourceUrl: event.target.value }))} /></label>
              {definition.fields.map(field => <label className={`${styles.field} ${field.kind === 'textarea' ? styles.full : ''}`} key={field.key}><span>{field.label}{field.required ? ' *' : ''}</span>{field.kind === 'textarea' ? <textarea rows={3} required={field.required} maxLength={2000} value={entry.values[field.key] ?? ''} onChange={event => change(entry.id, row => ({ ...row, values: { ...row.values, [field.key]: event.target.value } }))} /> : <input type={field.kind === 'date' ? 'date' : field.kind === 'url' ? 'url' : 'text'} inputMode={field.kind === 'money' || field.kind === 'score' ? 'decimal' : field.kind === 'integer' || field.kind === 'year' ? 'numeric' : undefined} required={field.required} maxLength={field.kind === 'url' ? 1000 : 255} value={entry.values[field.key] ?? ''} onChange={event => change(entry.id, row => ({ ...row, values: { ...row.values, [field.key]: event.target.value } }))} />}</label>)}
              <label className={`${styles.field} ${styles.full}`}><span>Observaciones administrativas</span><textarea rows={3} maxLength={2000} value={entry.notes} onChange={event => change(entry.id, row => ({ ...row, notes: event.target.value }))} /></label>
            </div>
            <button type="button" className={styles.remove} onClick={() => { setEntries(rows => rows.filter(row => row.id !== entry.id)); setDirty(true); setStatus(''); }}>Retirar este registro del borrador</button>
          </fieldset>)}
          <p className={styles.note}>Los montos se expresan en COP, con punto decimal y sin separadores de miles. Las transcripciones externas requieren URL oficial y fecha; no se consideran verificadas automáticamente.</p>
          <div className={styles.actions}><button className={styles.button} type="button" disabled={entries.length >= (section === 'institucion' ? 1 : 50)} onClick={add}>Agregar registro</button><button className={styles.primary} type="submit" disabled={!dirty}>{busy ? 'Guardando…' : 'Guardar cambios'}</button><button className={styles.button} type="button" disabled={!dirty} onClick={() => { setEntries(document.entries); setDirty(false); setMessage(''); setStatus(''); }}>Descartar borrador</button><button className={styles.button} type="button" disabled={dirty} onClick={() => setReload(value => value + 1)}>Recargar apartado</button></div>
          <p className={styles.note}>Revisión guardada: {document.version}. Retirar registros conserva las revisiones anteriores para trazabilidad.</p>
        </fieldset>
      </form>}
    </section>
    <MunicipalitySources />
  </div>;
}
