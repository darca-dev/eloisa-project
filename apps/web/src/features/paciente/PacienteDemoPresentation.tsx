'use client';

import type { ReactNode } from 'react';

import { PhoneFrame } from '@/components/ui/PhoneShell';
import { InicioPaciente } from './InicioPaciente';
import styles from './pacienteDemoPresentation.module.css';

/** Presentación aislada: contenido fijo, ficticio y sin llamadas de red. */
export function PacienteDemoPresentation(): ReactNode {
  return (
    <main className={styles.stage} data-patient-demo-local="true">
      <p className={styles.notice} role="status">
        Demostración local: la información mostrada es ficticia y no se guarda.
      </p>
      <PhoneFrame>
        <InicioPaciente
          nombre="Sofía"
          iniciales="SG"
          avisoId="patient-demo-notice"
          onAbrirBitacora={() => undefined}
        />
      </PhoneFrame>
      <p id="patient-demo-notice" className={styles.screenReaderNote}>
        Controles de muestra sin acciones persistentes.
      </p>
    </main>
  );
}
