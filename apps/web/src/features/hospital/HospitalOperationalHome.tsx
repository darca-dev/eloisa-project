'use client';

import { useEffect, useState } from 'react';
import { consultarAgenda, fechaCalendarioDe, type HospitalAgendaVistaDto } from './hospitalAgendaClient';
import type { ResultadoOperaciones } from './hospitalProfessionalsClient';
import type { HospitalDestino } from './hospitalViews';
import styles from './hospitalOperational.module.css';

export type HospitalTodayState = ResultadoOperaciones<HospitalAgendaVistaDto> | null;

const MODALIDADES = { ON_SITE: 'Presencial', HOME: 'Domiciliaria', VIRTUAL: 'Virtual' } as const;
const ACCESOS = [
  ['Consultar agenda', 'agenda'], ['Consultar pacientes', 'pacientes'],
  ['Consultar profesionales', 'profesionales'], ['Ver visitas domiciliarias', 'visitas'],
] as const;

/** Only a successful agenda response can provide a count or appointment. */
export function HospitalTodayView({ estado, fecha, onReintentar }: {
  readonly estado: HospitalTodayState;
  readonly fecha: string;
  readonly onReintentar: () => void;
}) {
  return <section className={styles.card} aria-labelledby="hospital-today-title" aria-busy={estado === null}>
    <div className={styles.sectionHeader}>
      <div><h2 id="hospital-today-title">Citas de hoy</h2>{fecha === '' ? null : <p>Fecha de agenda: {fecha} · UTC</p>}</div>
      <button type="button" className={styles.button} onClick={onReintentar} disabled={estado === null}>
        {estado !== null && estado.kind !== 'ok' ? 'Reintentar consulta' : 'Actualizar agenda'}
      </button>
    </div>
    {estado === null ? <p role="status">Consultando las citas registradas…</p> : estado.kind === 'ok' ? <>
      <dl className={styles.count}><div><dt>Citas asignadas para esta fecha</dt><dd>{estado.datos.totalAppointments}</dd></div></dl>
      {estado.datos.appointments.length === 0 ? <p role="status">No hay citas asignadas registradas para esta fecha.</p> : <div className={styles.tableScroll} role="region" aria-label="Citas asignadas de hoy" tabIndex={0}>
        <table className={styles.table}>
          <caption>Citas asignadas registradas · {fecha} (UTC)</caption>
          <thead><tr><th scope="col">Hora (UTC)</th><th scope="col">Paciente</th><th scope="col">Profesional</th><th scope="col">Modalidad</th></tr></thead>
          <tbody>{estado.datos.appointments.map(cita => <tr key={cita.appointmentId}>
            <td>{cita.scheduledStart === null ? 'Sin hora registrada' : new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC', hour12: false }).format(new Date(cita.scheduledStart))}</td>
            <td>{cita.patient.fullName}</td><td>{cita.professional.fullName}</td><td>{MODALIDADES[cita.modality]}</td>
          </tr>)}</tbody>
        </table>
      </div>}
      <p className={styles.note}>Fuente: agenda institucional guardada. Última consulta: <time dateTime={estado.datos.generatedAt}>{new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(new Date(estado.datos.generatedAt))} UTC</time>. Las solicitudes sin asignación se consultan en Agenda y citas.</p>
    </> : <p role="alert">{estado.kind === 'sin-sesion' ? 'La sesión terminó. Ingrese nuevamente.' : estado.kind === 'sin-permiso' ? 'Esta cuenta no tiene permiso para consultar la agenda.' : 'No se pudo consultar la agenda. Reintente para ver las citas registradas.'}</p>}
  </section>;
}

export function HospitalOperationalHome({ onNavegar, fetchImpl, onSessionInvalid }: {
  readonly onNavegar: (destino: HospitalDestino) => void;
  readonly fetchImpl?: typeof fetch;
  readonly onSessionInvalid: () => void;
}) {
  const [estado, setEstado] = useState<HospitalTodayState>(null);
  const [fecha, setFecha] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const dia = fechaCalendarioDe(new Date());
    setFecha(dia);
    setEstado(null);
    void consultarAgenda({ from: dia, to: dia }, fetchImpl ?? fetch, controller.signal).then(resultado => {
      if (controller.signal.aborted || resultado.kind === 'cancelado') return;
      setEstado(resultado);
      if (resultado.kind === 'sin-sesion') onSessionInvalid();
    });
    return () => controller.abort();
  }, [fetchImpl, onSessionInvalid, revision]);

  return <div className={styles.home}>
    <header><p className={styles.eyebrow}>Gestión hospitalaria</p><h1 className={styles.title}>Inicio</h1><p>Consulte la operación registrada de su institución.</p></header>
    <HospitalTodayView estado={estado} fecha={fecha} onReintentar={() => setRevision(actual => actual + 1)} />
    <section className={styles.card} aria-labelledby="hospital-access-title">
      <h2 id="hospital-access-title">Accesos a la operación</h2>
      <div className={styles.shortcuts}>{ACCESOS.map(([etiqueta, vista]) => <button type="button" className={styles.button} key={vista} onClick={() => onNavegar({ vista })}>{etiqueta}</button>)}</div>
    </section>
  </div>;
}
