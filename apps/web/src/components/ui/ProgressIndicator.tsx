import type { ReactNode } from 'react';

import styles from './ui.module.css';

interface ProgressIndicatorProps {
  readonly step: number;
  readonly total: number;
  /** Sufijo literal del prototipo, p. ej. «SEGÚN TU ROL». */
  readonly suffix?: string | null;
  /** Porcentaje exacto de la barra en el diseño aprobado. */
  readonly percent: number;
}

/**
 * Indicador de progreso «PASO X DE Y» de First Run 1a (TASK-002).
 *
 * El progreso se expone también de forma programática mediante `role="progressbar"`
 * para que no dependa únicamente del color de la barra.
 */
export function ProgressIndicator({
  step,
  total,
  suffix,
  percent,
}: ProgressIndicatorProps): ReactNode {
  const label = `Paso ${step} de ${total}`;
  const visibleLabel =
    suffix === undefined || suffix === null
      ? `PASO ${step} DE ${total}`
      : `PASO ${step} DE ${total} · ${suffix}`;

  return (
    <div className={styles.progress}>
      <p className={styles.progressLabel}>{visibleLabel}</p>
      <div
        className={styles.progressTrack}
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={step}
        aria-valuetext={label}
      >
        <div className={styles.progressFill} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
