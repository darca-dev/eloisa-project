'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { branding } from '@/config/branding';

import { EliAvatar, EliFigure, eliAvatarAlt } from './Eli';
import type { EliIntencion } from './eliExpressions';
import styles from './eliBubble.module.css';

/**
 * Burbuja flotante de la IA (TASK-002A, FR-08).
 *
 * Reproduce el patrón aprobado en `prototype-claude/Eligeme-Inscripcion.dc.html`:
 * activador blanco tipo píldora abajo a la derecha, con sombra, y panel
 * superpuesto con encabezado azul, avatar, presentación, ayuda del paso actual
 * y temas frecuentes.
 *
 * Expresiones: el activador usa por defecto la intención `pregunta`, distinta
 * de la del encabezado del panel (`guia`). La pantalla que lo monta puede
 * declarar otra intención y otro rótulo cuando su referencia aprobada lo exija
 * (TASK-002B, FR-02); el resto de la composición no cambia.
 *
 * Tono: la IA habla siempre de tú, con lenguaje cercano y sencillo. La
 * presentación es un texto aprobado fijo y no se parametriza, para que no pueda
 * variar entre pantallas.
 *
 * Límites permanentes: orienta y explica la interfaz; no diagnostica, no
 * prescribe, no decide emergencias, no ejecuta voz y no consulta ninguna IA
 * conectada. Todas las respuestas son textos fijos escritos en la pantalla que
 * la invoca.
 *
 * Accesibilidad: el activador declara `aria-expanded` y `aria-controls`;
 * `Escape` cierra el panel y devuelve el foco al activador.
 */

export interface EliTopic {
  readonly id: string;
  readonly question: string;
  readonly answer: string;
}

export type EliAnchor = 'viewport' | 'contenedor';

/** Presentación aprobada, con su texto y su puntuación exactos (FR-08). */
export function presentacionAprobada(): string {
  return (
    `¡Hola! Soy ${branding.aiDisplayName}. No soy médica, pero puedo ayudarte a ` +
    'resolver las inquietudes que tengas. Cuéntame, ¿qué necesitas?'
  );
}

interface EliBubbleProps {
  /** Ayuda del paso o pantalla visible, redactada de tú. */
  readonly stepHelp: string;
  /** Temas que la pantalla ofrece; sus respuestas son textos fijos. */
  readonly topics: readonly EliTopic[];
  /**
   * `viewport` fija la burbuja a la ventana (Inscripción);
   * `contenedor` la ancla al marco que la contiene (Inicio del Paciente).
   */
  readonly anchor?: EliAnchor;
  /** Deja espacio libre bajo la burbuja, p. ej. sobre una barra de navegación. */
  readonly bottomGap?: number;
  /** Expresión del activador; por defecto la del patrón general (`pregunta`). */
  readonly triggerIntencion?: EliIntencion;
  /** Rótulo del activador; por defecto el saludo breve del patrón general. */
  readonly triggerLabel?: string;
}

export function EliBubble({
  stepHelp,
  topics,
  anchor = 'viewport',
  bottomGap,
  triggerIntencion = 'pregunta',
  triggerLabel,
}: EliBubbleProps): ReactNode {
  const [open, setOpen] = useState(false);
  const [topicId, setTopicId] = useState<string | null>(null);
  const panelId = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  // `Escape` cierra el panel desde cualquier control interno y devuelve el foco.
  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        close();
      }
    };
    const node = containerRef.current;
    node?.addEventListener('keydown', onKeyDown);
    return () => node?.removeEventListener('keydown', onKeyDown);
  }, [open, close]);

  const answer = topics.find((topic) => topic.id === topicId)?.answer ?? null;

  const classes = [styles.dock];
  if (anchor === 'contenedor') {
    classes.push(styles.dockContained);
  }

  return (
    <div
      ref={containerRef}
      className={classes.join(' ')}
      style={bottomGap === undefined ? undefined : { bottom: `${bottomGap}px` }}
    >
      {/* El panel existe siempre para que `aria-controls` apunte a un elemento real. */}
      <div id={panelId} className={styles.panel} hidden={!open}>
        <div className={styles.panelHeader}>
          <span className={styles.panelAvatar}>
            <EliAvatar intencion="guia" size={44} weight="small" />
          </span>
          <div className={styles.panelNames}>
            <p className={styles.panelName}>{branding.aiDisplayName}</p>
            <p className={styles.panelRole}>
              No soy médica · Te acompaño dentro de la aplicación
            </p>
          </div>
          <button type="button" className={styles.panelClose} onClick={close}>
            <span aria-hidden="true">×</span>
            <span className="merdn-sr-only">
              {`Cerrar la ayuda de ${branding.aiDisplayName}`}
            </span>
          </button>
        </div>

        <div className={styles.panelBody}>
          <p className={styles.panelGreeting}>{presentacionAprobada()}</p>

          <div className={styles.panelStep}>
            <p className={styles.panelStepLabel}>EN ESTE PASO</p>
            <p className={styles.panelStepText}>{stepHelp}</p>
          </div>

          {topics.length === 0 ? null : (
            <>
              <p className={styles.panelTopicsLabel}>PUEDES PREGUNTARME</p>
              <div className={styles.panelTopics}>
                {topics.map((topic) => {
                  const active = topic.id === topicId;
                  return (
                    <button
                      key={topic.id}
                      type="button"
                      aria-pressed={active}
                      className={
                        active
                          ? `${styles.panelTopic} ${styles.panelTopicActive}`
                          : styles.panelTopic
                      }
                      onClick={() => setTopicId(active ? null : topic.id)}
                    >
                      {topic.question}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {answer === null ? null : <p className={styles.panelAnswer}>{answer}</p>}
        </div>
      </div>

      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <EliFigure
          intencion={triggerIntencion}
          size={66}
          alt={eliAvatarAlt(triggerIntencion)}
          className={styles.triggerImage}
        />
        <span className={styles.triggerLabel}>
          {triggerLabel ?? `¡Hola, soy ${branding.aiDisplayName}!`}
        </span>
      </button>
    </div>
  );
}
