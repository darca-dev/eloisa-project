import type { ReactNode } from 'react';

import styles from './icon.module.css';

/**
 * Iconos semánticos code-native (TASK-002A, FR-07).
 *
 * Sustituyen los cuadrados de color de la referencia sin añadir dependencias
 * ni assets nuevos. Se dibujan con trazo uniforme y `currentColor`, de modo
 * que la figura sea reconocible sin depender del color: el contenedor conserva
 * el color, el tamaño y el radio aprobados de cada tarjeta.
 *
 * Son decorativos (`aria-hidden`): el texto visible de la tarjeta ya comunica
 * la función, y duplicarlo generaría ruido en lectores de pantalla.
 */

export type IconName =
  | 'cita'
  | 'ayuda'
  | 'salud'
  | 'cuidador'
  | 'pago'
  | 'bitacora'
  | 'consultaVirtual'
  | 'visitaCasa'
  | 'hospital'
  | 'mensajes'
  | 'inicio'
  | 'perfil'
  | 'flecha';

/** Trazados de cada icono, sobre una caja de 24 × 24. */
const PATHS: Record<IconName, ReactNode> = {
  // Calendario con día marcado.
  cita: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M3 10h18M8 3v4M16 3v4" />
      <rect x="7" y="13.5" width="4" height="3.5" rx="1" fill="currentColor" stroke="none" />
    </>
  ),
  // Señal de auxilio: campana de aviso con badge.
  ayuda: (
    <>
      <path d="M12 3a6 6 0 0 0-6 6c0 3-1 4.5-2 5.5h16c-1-1-2-2.5-2-5.5a6 6 0 0 0-6-6Z" />
      <path d="M10 18a2 2 0 0 0 4 0" />
      <path d="M12 8v3" />
      <circle cx="12" cy="13.5" r="0.9" fill="currentColor" stroke="none" />
    </>
  ),
  // Corazón con línea de pulso.
  salud: (
    <>
      <path d="M12 20s-7-4.4-7-9.2A3.9 3.9 0 0 1 12 8a3.9 3.9 0 0 1 7 2.8C19 15.6 12 20 12 20Z" />
      <path d="M6.5 12.4h2.7l1.3-2.2 1.8 3.6 1.2-1.4h3" />
    </>
  ),
  // Persona que sostiene a otra: cuidado acompañado.
  cuidador: (
    <>
      <circle cx="9" cy="7" r="3" />
      <path d="M3.5 20v-1.5A4.5 4.5 0 0 1 8 14h2a4.5 4.5 0 0 1 4.5 4.5V20" />
      <path d="M16 8.5a2.6 2.6 0 0 1 4.4 2.6c-.5 1.8-2.8 3.2-2.8 3.2s-2.3-1.4-2.8-3.2" />
    </>
  ),
  // Comprobante con importe.
  pago: (
    <>
      <path d="M5 4h14v16l-2.3-1.4L14.4 20l-2.4-1.4L9.6 20l-2.3-1.4L5 20Z" />
      <path d="M9 9h6M9 13h4" />
    </>
  ),
  // Cuaderno de registro diario.
  bitacora: (
    <>
      <path d="M6 3h11a2 2 0 0 1 2 2v16H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
      <path d="M4 17h15M9 7.5h6M9 11h4" />
    </>
  ),
  // Pantalla de consulta a distancia.
  consultaVirtual: (
    <>
      <rect x="3" y="5" width="13" height="11" rx="2.5" />
      <path d="M16 9.5 21 7v9l-5-2.5" />
      <path d="M7 20h8" />
    </>
  ),
  // Casa con puerta: visita domiciliaria.
  visitaCasa: (
    <>
      <path d="M4 11 12 4l8 7" />
      <path d="M6 10.5V20h12v-9.5" />
      <path d="M10.2 20v-5h3.6v5" />
    </>
  ),
  // Edificio con cruz: institución de salud.
  hospital: (
    <>
      <path d="M5 20V6.5A1.5 1.5 0 0 1 6.5 5h11A1.5 1.5 0 0 1 19 6.5V20" />
      <path d="M3.5 20h17" />
      <path d="M12 8v5M9.5 10.5h5" />
    </>
  ),
  // Globo de conversación.
  mensajes: (
    <>
      <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 4v-4H6.5A2.5 2.5 0 0 1 4 13.5Z" />
      <path d="M8 8.5h8M8 12h5" />
    </>
  ),
  // Casa simple: inicio de la navegación.
  inicio: (
    <>
      <path d="M4 11 12 4l8 7" />
      <path d="M6 10.5V20h12v-9.5" />
    </>
  ),
  // Silueta personal.
  perfil: (
    <>
      <circle cx="12" cy="8" r="3.4" />
      <path d="M5 20v-1a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v1" />
    </>
  ),
  // Indicador de avance.
  flecha: <path d="M9 5l7 7-7 7" />,
};

export type IconSize = 'sm' | 'md' | 'lg';

const SIZE_CLASS: Record<IconSize, string | undefined> = {
  sm: styles.iconSmall,
  md: undefined,
  lg: styles.iconLarge,
};

export function Icon({
  name,
  size = 'md',
}: {
  readonly name: IconName;
  readonly size?: IconSize;
}): ReactNode {
  const sizeClass = SIZE_CLASS[size];
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={sizeClass === undefined ? styles.icon : `${styles.icon} ${sizeClass}`}
    >
      {PATHS[name]}
    </svg>
  );
}
