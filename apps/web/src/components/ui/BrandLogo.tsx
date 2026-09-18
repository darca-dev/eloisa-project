import type { ReactNode } from 'react';

import styles from './brandLogo.module.css';

/**
 * Logo aprobado de la marca: corazón con tilde/check integrado
 * (TASK-002A, «Logo aprobado» y FR-08A).
 *
 * Fuente visual única del símbolo en todo el frontend: ninguna pantalla dibuja
 * un corazón, un check, un icono médico ni un símbolo genérico equivalente, y
 * ninguna incrusta la ruta del asset por su cuenta.
 *
 * Procedencia del asset
 * ---------------------
 * `public/brand/corazon-check.png` es un recorte fiel del lockup de marca de la
 * lámina de identidad aprobada del prototipo, `prototype-claude/ref/
 * personaje2.png` (región 259,15 82×84 px del original de 1536×1024, exportada
 * a 164×168 px). Se conservaron forma, proporciones y colores; solo se llevó a
 * transparente el fondo casi blanco de la lámina para que el símbolo pueda
 * colocarse sobre cualquier superficie aprobada. El símbolo no se redibujó y el
 * archivo fuente del prototipo no se modificó.
 */

interface BrandLogoProps {
  /** Lado del símbolo en CSS px. */
  readonly size?: number;
  /**
   * Nombre accesible. Se omite cuando la marca ya está escrita al lado, porque
   * repetirla generaría ruido en lectores de pantalla.
   */
  readonly label?: string;
  /** Fondo claro bajo el símbolo, necesario sobre superficies oscuras. */
  readonly chip?: boolean;
}

export function BrandLogo({ size = 36, label, chip = false }: BrandLogoProps): ReactNode {
  const marca = (
    // Imagen local de tamaño fijo: no requiere optimización remota.
    <img
      src="/brand/corazon-check.png"
      alt={label ?? ''}
      width={size}
      height={size}
      className={styles.mark}
      style={{ width: `${size}px`, height: `${size}px` }}
    />
  );

  if (!chip) {
    return marca;
  }

  return (
    <span
      className={styles.chip}
      style={{ width: `${size + 14}px`, height: `${size + 14}px` }}
    >
      {marca}
    </span>
  );
}
