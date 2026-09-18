import type { ReactNode } from 'react';

import styles from './hospital.module.css';
import type { HospitalDashboardHeaderConfig } from './hospitalDashboardConfig';

/**
 * Encabezado del Dashboard Hospital (TASK-003H-02, FR-02).
 *
 * Reproduce las líneas 107–113 del prototipo oficial: etiqueta, título y
 * fecha/hora demostrativa.
 *
 * La fecha es contenido de presentación recibido por propiedades. No hay reloj,
 * formateo, zona horaria, actualización automática ni lectura de la fecha del
 * sistema. La etiqueta superior acompaña al título visible pero no lo sustituye
 * como encabezado de la pantalla.
 */
export function HospitalDashboardHeader({
  encabezado,
  tituloId,
}: {
  readonly encabezado: HospitalDashboardHeaderConfig;
  readonly tituloId: string;
}): ReactNode {
  return (
    <div className={styles.dashboardHeader}>
      <div className={styles.dashboardHeadings}>
        <span className={styles.dashboardEyebrow}>{encabezado.etiqueta}</span>
        <h1 className={styles.dashboardTitle} id={tituloId}>
          {encabezado.titulo}
        </h1>
      </div>
      <p className={styles.dashboardDate}>{encabezado.fecha}</p>
    </div>
  );
}
