import type { ReactNode } from 'react';

import { branding, platformNameInSentence } from '@/config/branding';

import styles from './eli.module.css';
import { expresionDe } from './eliExpressions';
import type { EliIntencion } from './eliExpressions';

/**
 * Elí: identidad, orientación y accesibilidad (TASK-002, FR-11; TASK-002A, FR-08).
 *
 * Los nombres visibles provienen exclusivamente de `@/config/branding` y las
 * expresiones exclusivamente de `./eliExpressions`. Cada superficie declara una
 * INTENCIÓN («escucha», «pregunta», «guia», …) y nunca una ruta de imagen: así
 * ninguna pantalla repite una pose por conveniencia técnica.
 *
 * Elí puede aparecer como personaje visible, avatar o burbuja flotante. La
 * personalidad la comunica el gesto, no un contenedor obligatorio.
 *
 * Elí acompaña el recorrido; no diagnostica, no prescribe, no es un chatbot
 * conectado y no ejecuta voz. En Inscripción e Inicio del Paciente su superficie
 * conversacional es la burbuja flotante (`EliBubble`), nunca una tarjeta.
 */

export type { EliIntencion } from './eliExpressions';

export type EliAvatarWeight = 'small' | 'default' | 'medium' | 'large';

const WEIGHT_CLASS: Record<EliAvatarWeight, string | undefined> = {
  small: styles.avatarSmall,
  default: undefined,
  medium: styles.avatarMedium,
  large: styles.avatarLarge,
};

interface EliAvatarProps {
  /** Intención visual; determina la expresión aprobada que se muestra. */
  readonly intencion: EliIntencion;
  readonly size: number;
  readonly weight?: EliAvatarWeight;
  /** Halo verde del cierre aprobado (`1a-15 Listo`). */
  readonly tone?: 'eli' | 'success';
  /**
   * Nombre accesible completo. Cuando se omite, la imagen es decorativa: se usa
   * en superficies donde el texto contiguo ya nombra a la IA.
   */
  readonly alt?: string;
}

export function EliAvatar({
  intencion,
  size,
  weight = 'default',
  tone = 'eli',
  alt,
}: EliAvatarProps): ReactNode {
  const classes = [styles.avatar];
  const weightClass = WEIGHT_CLASS[weight];
  if (weightClass !== undefined) {
    classes.push(weightClass);
  }
  if (tone === 'success') {
    classes.push(styles.avatarSuccess);
  }

  return (
    // Imagen local de tamaño fijo: no requiere optimización remota ni `next/image`.
    <img
      src={expresionDe(intencion).src}
      alt={alt ?? ''}
      width={size}
      height={size}
      className={classes.join(' ')}
      style={{ width: `${size}px`, height: `${size}px`, flexBasis: `${size}px` }}
    />
  );
}

interface EliFigureProps {
  readonly intencion: EliIntencion;
  readonly size: number;
  /** Nombre accesible; se omite cuando el texto contiguo ya nombra a la IA. */
  readonly alt?: string;
  /** Clase de composición de la superficie que la contiene. */
  readonly className?: string;
}

/**
 * La IA como personaje visible, sin halo ni contenedor propio.
 *
 * Es la forma que usan el activador flotante y el cierre de la inscripción en
 * el diseño aprobado: la personalidad la comunica el gesto, no una burbuja
 * genérica alrededor de cada aparición.
 */
export function EliFigure({ intencion, size, alt, className }: EliFigureProps): ReactNode {
  return (
    // Imagen local de tamaño fijo: no requiere optimización remota ni `next/image`.
    <img
      src={expresionDe(intencion).src}
      alt={alt ?? ''}
      width={size}
      height={size}
      className={className}
      style={{ width: `${size}px`, height: `${size}px` }}
    />
  );
}

/** Nombre accesible de la IA con la expresión que muestra en ese momento. */
export function eliAvatarAlt(intencion: EliIntencion): string {
  return `${branding.aiDisplayName}, ${expresionDe(intencion).gesto}`;
}

/** Texto alternativo de la pantalla de bienvenida, compuesto desde branding. */
export function eliWelcomeAlt(): string {
  return `${branding.aiDisplayName}, te acompaña en ${platformNameInSentence()}`;
}

/** Avatar de Elí acompañado de su mensaje, tal como aparece en cada paso. */
export function EliSpeech({
  intencion,
  children,
}: {
  readonly intencion: EliIntencion;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <div className={styles.speech}>
      <EliAvatar intencion={intencion} size={58} alt={eliAvatarAlt(intencion)} />
      <p className={styles.bubble}>{children}</p>
    </div>
  );
}

/** Burbuja destacada de la bienvenida. */
export function EliHeroBubble({
  title,
  children,
}: {
  readonly title: string;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <div className={`${styles.bubble} ${styles.bubbleHero}`}>
      <p className={styles.bubbleHeroTitle}>{title}</p>
      <p className={styles.bubbleHeroBody}>{children}</p>
    </div>
  );
}
