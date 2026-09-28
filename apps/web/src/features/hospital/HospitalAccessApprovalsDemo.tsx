'use client';

import { useState, type ReactNode } from 'react';

import styles from './hospitalAccessApprovalsDemo.module.css';

type RequestStatus = 'Pendiente' | 'Aprobada' | 'Rechazada' | 'Suspendida' | 'Revocada';

interface DemoRequest {
  readonly id: string;
  readonly person: string;
  readonly profile: 'Paciente' | 'Cuidador' | 'Personal de terreno';
  readonly submittedAt: string;
  readonly reference: string;
  readonly status: RequestStatus;
}

const INITIAL_REQUESTS: readonly DemoRequest[] = [
  { id: 'SOL-101', person: 'María Fernanda Ríos', profile: 'Paciente', submittedAt: 'Hoy · 8:40 a. m.', reference: 'SOL-DEMO-101', status: 'Pendiente' },
  { id: 'SOL-102', person: 'Andrés Velasco', profile: 'Cuidador', submittedAt: 'Hoy · 8:10 a. m.', reference: 'SOL-DEMO-102', status: 'Pendiente' },
  { id: 'SOL-103', person: 'Carolina Méndez', profile: 'Personal de terreno', submittedAt: 'Ayer · 4:25 p. m.', reference: 'SOL-DEMO-103', status: 'Pendiente' },
  { id: 'SOL-104', person: 'Jorge Ramírez', profile: 'Cuidador', submittedAt: 'Ayer · 11:15 a. m.', reference: 'SOL-DEMO-104', status: 'Aprobada' },
  { id: 'SOL-105', person: 'Elena Castro', profile: 'Paciente', submittedAt: '18 sep · 2:05 p. m.', reference: 'SOL-DEMO-105', status: 'Suspendida' },
];

const STATUS_STYLE: Record<RequestStatus, string> = {
  Pendiente: styles.pending,
  Aprobada: styles.approved,
  Rechazada: styles.rejected,
  Suspendida: styles.suspended,
  Revocada: styles.revoked,
};

/** Demo local aislada: las decisiones se pierden al recargar y nunca salen del navegador. */
export function HospitalAccessApprovalsDemo(): ReactNode {
  const [requests, setRequests] = useState<readonly DemoRequest[]>(INITIAL_REQUESTS);
  const [announcement, setAnnouncement] = useState('');

  const update = (id: string, status: RequestStatus): void => {
    const request = requests.find((item) => item.id === id);
    if (request === undefined) return;

    setRequests((current) => current.map((item) => item.id === id ? { ...item, status } : item));
    setAnnouncement(`Demostración: la solicitud ${request.reference} ahora se muestra como ${status.toLowerCase()}. No se guardó ningún cambio.`);
  };

  const pendingCount = requests.filter((item) => item.status === 'Pendiente').length;

  return (
    <section className={styles.section} aria-labelledby="access-requests-title">
      <div className={styles.heading}>
        <div><h2 id="access-requests-title">Solicitudes de acceso</h2><p>Así revisará el Hospital las solicitudes de Pacientes, Cuidadores y Personal de terreno.</p></div>
        <span className={styles.count}>{pendingCount} pendientes</span>
      </div>
      <p className={styles.notice}>Demostración local: todas las personas, referencias y decisiones son ficticias. Las acciones no crean cuentas, sesiones, permisos ni registros.</p>
      <div className={styles.tableWrap}>
        <table>
          <caption>Solicitudes ficticias para revisión visual</caption>
          <thead><tr><th>Solicitud</th><th>Perfil</th><th>Recibida</th><th>Estado</th><th>Acciones demo</th></tr></thead>
          <tbody>{requests.map((request) => (
            <tr key={request.id}>
              <td><strong>{request.person}</strong><span>{request.reference}</span></td><td>{request.profile}</td><td>{request.submittedAt}</td>
              <td><span className={`${styles.status} ${STATUS_STYLE[request.status]}`}>{request.status}</span></td>
              <td><div className={styles.actions}>
                <button type="button" onClick={() => update(request.id, 'Aprobada')}>Aprobar</button><button type="button" onClick={() => update(request.id, 'Rechazada')}>Rechazar</button><button type="button" onClick={() => update(request.id, 'Suspendida')}>Suspender</button><button type="button" onClick={() => update(request.id, 'Revocada')}>Revocar</button>
              </div></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <p className={styles.announcement} aria-live="polite">{announcement}</p>
    </section>
  );
}
