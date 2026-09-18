import type { ReactNode } from 'react';

import { branding } from '@/config/branding';

import styles from './shell.module.css';

/**
 * Marco móvil aprobado (390 × 844) y cromo de pantalla de First Run 1a
 * (TASK-002). No introduce navegación ni composiciones no diseñadas.
 */

export function PhoneFrame({ children }: { readonly children: ReactNode }): ReactNode {
  return <div className={styles.frame}>{children}</div>;
}

export type ScreenTone = 'blanco' | 'marca' | 'exito' | 'lienzo';

const SCREEN_TONE_CLASS: Record<ScreenTone, string | undefined> = {
  blanco: undefined,
  marca: styles.screenBrand,
  exito: styles.screenSuccess,
  lienzo: styles.screenCanvas,
};

export function Screen({
  tone = 'blanco',
  children,
}: {
  readonly tone?: ScreenTone;
  readonly children: ReactNode;
}): ReactNode {
  const toneClass = SCREEN_TONE_CLASS[tone];
  return (
    <div className={toneClass === undefined ? styles.screen : `${styles.screen} ${toneClass}`}>
      {children}
    </div>
  );
}

/**
 * Barra de estado del mock de dispositivo. Es decoración del diseño aprobado:
 * no representa hora, cobertura ni batería reales, por lo que queda oculta a
 * la tecnología asistiva.
 */
export function DeviceStatusBar({
  tone = 'claro',
}: {
  readonly tone?: 'claro' | 'sobreMarca' | 'marca';
}): ReactNode {
  const classes = [styles.statusBar];
  if (tone === 'sobreMarca') {
    classes.push(styles.statusBarOnBrand);
  } else if (tone === 'marca') {
    classes.push(styles.statusBarBrand);
  }

  return (
    <div className={classes.join(' ')} aria-hidden="true">
      <span className={styles.statusTime}>9:41</span>
      <span className={styles.statusIcons}>
        <span className={styles.statusBars}>
          <span />
          <span />
          <span />
        </span>
        <span className={styles.statusBattery} />
      </span>
    </div>
  );
}

export function StepHeader({
  tight = false,
  children,
}: {
  readonly tight?: boolean;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <div className={tight ? `${styles.stepHeader} ${styles.stepHeaderTight}` : styles.stepHeader}>
      {children}
    </div>
  );
}

export function ScrollArea({
  gap,
  centered = false,
  children,
}: {
  readonly gap?: number;
  readonly centered?: boolean;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <div
      className={
        centered ? `${styles.scrollArea} ${styles.scrollAreaCentered}` : styles.scrollArea
      }
      style={gap === undefined ? undefined : { gap: `${gap}px` }}
    >
      {children}
    </div>
  );
}

export function FormActions({
  tight = false,
  children,
}: {
  readonly tight?: boolean;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <div className={tight ? `${styles.footer} ${styles.footerTight}` : styles.footer}>
      {children}
    </div>
  );
}

/** Marca centrada de `1a-01 Bienvenida`. */
export function WelcomeBrand(): ReactNode {
  return (
    <div className={styles.welcomeBrand}>
      <p className={styles.welcomeWordmark}>{branding.platformDisplayName}</p>
      <p className={styles.welcomeTagline}>{branding.platformTagline}</p>
    </div>
  );
}

/** Cabecera de marca de `1a-16 Inicio`. */
export function BrandHeader({
  menuLabel,
  notificationsLabel,
  profileLabel,
  initials,
  describedBy,
}: {
  readonly menuLabel: string;
  readonly notificationsLabel: string;
  readonly profileLabel: string;
  readonly initials: string;
  readonly describedBy: string;
}): ReactNode {
  return (
    <div className={styles.brandHeader}>
      <button type="button" aria-disabled="true" aria-describedby={describedBy} className={styles.iconButton}>
        <span aria-hidden="true" className={styles.brandMenu}>
          <span />
          <span />
          <span />
        </span>
        <span className="merdn-sr-only">{menuLabel}</span>
      </button>
      <div className={styles.brandNames}>
        <p className={styles.brandWordmark}>{branding.platformDisplayName}</p>
        <p className={styles.brandTagline}>{branding.platformTagline}</p>
      </div>
      <div className={styles.brandActions}>
        <button type="button" aria-disabled="true" aria-describedby={describedBy} className={styles.iconButton}>
          <span aria-hidden="true" className={styles.brandBell} />
          <span className="merdn-sr-only">{notificationsLabel}</span>
        </button>
        <button type="button" aria-disabled="true" aria-describedby={describedBy} className={styles.iconButton}>
          <span aria-hidden="true" className={styles.brandInitials}>
            {initials}
          </span>
          <span className="merdn-sr-only">{profileLabel}</span>
        </button>
      </div>
    </div>
  );
}
