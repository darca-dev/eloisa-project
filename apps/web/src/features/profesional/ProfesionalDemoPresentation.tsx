import type { ReactNode } from 'react';

import type { ItemWorklist, VentanaWorklist } from './professionalWorklistClient';
import { ProfesionalPortal } from './ProfesionalPortal';
import styles from './profesionalDemoPresentation.module.css';

const VENTANA_DEMO: VentanaWorklist = {
  from: '2026-10-01',
  to: '2026-10-07',
};

const VISITAS_DEMO: readonly ItemWorklist[] = [
  {
    appointmentId: 'demo-visit-001',
    scheduledStart: '2026-10-02T09:00:00.000Z',
    modality: 'HOME',
    patient: { displayName: 'Amalia Torres', initials: 'AT' },
    visit: null,
  },
  {
    appointmentId: 'demo-visit-002',
    scheduledStart: '2026-10-03T14:30:00.000Z',
    modality: 'HOME',
    patient: { displayName: 'Daniel Ríos', initials: 'DR' },
    visit: {
      homeVisitId: 'demo-home-visit-002',
      status: 'SCHEDULED',
      version: 1,
      startedAt: null,
      endedAt: null,
      updatedAt: '2026-10-01T12:00:00.000Z',
    },
  },
];

/** Presentación aislada: lista fija, ficticia y sin acceso a la API. */
export function ProfesionalDemoPresentation(): ReactNode {
  return (
    <div className={styles.page} data-professional-demo-local="true">
      <p className={styles.notice} role="status">
        Demostración local: pacientes, visitas y liquidaciones son ficticios. No se guarda nada.
      </p>
      <ProfesionalPortal items={VISITAS_DEMO} ventana={VENTANA_DEMO} />
    </div>
  );
}
