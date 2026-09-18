import type { ButtonHTMLAttributes, ReactNode } from 'react';

import styles from './ui.module.css';

/**
 * Botón con las variantes de la jerarquía aprobada en Línea Visual B
 * (TASK-002). No hay variantes sin consumidor en First Run 1a.
 *
 * - `primary`: principal cálido, aguamarina con tinta oscura.
 * - `onBrand`: principal sobre el azul ELÍGEME (relleno blanco).
 * - `outlineOnBrand`: secundario sobre el azul ELÍGEME.
 * - `outline`: secundario sobre blanco, borde azul.
 * - `pill` / `pillStart`: secundario compacto en píldora.
 * - `quiet` / `quietMuted`: acción terciaria con apariencia de enlace.
 */
export type ButtonVariant =
  | 'primary'
  | 'onBrand'
  | 'outlineOnBrand'
  | 'outline'
  | 'pill'
  | 'pillStart'
  | 'quiet'
  | 'quietMuted';

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: styles.buttonPrimary,
  onBrand: styles.buttonOnBrand,
  outlineOnBrand: styles.buttonOutlineOnBrand,
  outline: styles.buttonOutline,
  pill: styles.buttonPill,
  pillStart: `${styles.buttonPill} ${styles.buttonPillStart}`,
  quiet: styles.buttonQuiet,
  quietMuted: `${styles.buttonQuiet} ${styles.buttonQuietMuted}`,
};

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> {
  readonly variant: ButtonVariant;
  /** Ocupa todo el ancho disponible en las variantes que por defecto no lo hacen. */
  readonly block?: boolean;
  readonly children: ReactNode;
}

export function Button({
  variant,
  block = false,
  type = 'button',
  children,
  ...rest
}: ButtonProps): ReactNode {
  const classes = [styles.button, VARIANT_CLASS[variant]];
  if (block && (variant === 'quiet' || variant === 'quietMuted')) {
    classes.push(styles.buttonQuietBlock);
  }

  return (
    <button type={type} className={classes.join(' ')} {...rest}>
      {children}
    </button>
  );
}

/**
 * Punto decorativo que el prototipo usa dentro de algunos botones
 * secundarios. Es puramente ornamental y no aporta información.
 */
export function ButtonDot({ size }: { readonly size: number }): ReactNode {
  return (
    <span
      aria-hidden="true"
      className={styles.buttonIconDot}
      style={{ width: `${size}px`, height: `${size}px` }}
    />
  );
}
