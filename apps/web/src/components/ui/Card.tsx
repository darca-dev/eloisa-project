import type { ReactNode } from 'react';

import styles from './ui.module.css';

/** Tarjeta contenedora con borde, tal como aparece en First Run 1a. */
export function Card({
  panel = false,
  children,
}: {
  readonly panel?: boolean;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <div className={panel ? `${styles.card} ${styles.cardPanel}` : styles.card}>
      {children}
    </div>
  );
}

/** Etiqueta en versalitas que encabeza algunas tarjetas del prototipo. */
export function CardEyebrow({ children }: { readonly children: ReactNode }): ReactNode {
  return <p className={styles.cardEyebrow}>{children}</p>;
}

/** Banda informativa: `info` en celeste, `neutral` en panel gris. */
export function InfoBanner({
  tone = 'info',
  children,
}: {
  readonly tone?: 'info' | 'neutral';
  readonly children: ReactNode;
}): ReactNode {
  const toneClass = tone === 'info' ? styles.infoBannerInfo : styles.infoBannerNeutral;
  return <p className={`${styles.infoBanner} ${toneClass}`}>{children}</p>;
}
