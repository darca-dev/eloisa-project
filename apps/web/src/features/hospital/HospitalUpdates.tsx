import type { ReactNode } from 'react';

import { HospitalIcon } from './HospitalIcon';
import styles from './hospitalUpdates.module.css';
import { hospitalNovedadesDemo } from './hospitalUpdatesConfig';
import type { HospitalUpdatesConfig } from './hospitalUpdatesConfig';
import {
  HospitalBadge,
  HospitalCard,
  HospitalViewHeader,
  hospitalViewStyles as compartido,
  tonoVars,
} from './HospitalViewPieces';

/**
 * Vista «Novedades» (TASK-003H-04, alcance E).
 *
 * Reproduce las líneas 624–645 del prototipo oficial: la explicación del
 * indicador fucsia y las siete novedades con su punto, icono, título,
 * metadatos, naturaleza, color y antigüedad.
 *
 * Alcance: presentación. Las novedades no se abren, no se marcan como leídas,
 * no mutan, no se envían y no persisten: el punto fucsia es un literal de la
 * referencia y también se anuncia como texto, de modo que «hay algo nuevo» no
 * depende del color. No hay WhatsApp, correo, notificaciones push,
 * destinatarios reales, colas ni registro de envíos.
 */

const TITULO_ID = 'hospital-novedades-titulo';

export function HospitalUpdates({
  config = hospitalNovedadesDemo,
}: {
  readonly config?: HospitalUpdatesConfig;
}): ReactNode {
  return (
    <div className={compartido.view}>
      <HospitalViewHeader encabezado={config.encabezado} tituloId={TITULO_ID} />

      <HospitalCard className={compartido.listaCard} aria-label="Bandeja de novedades">
        <ul className={`${compartido.lista} ${styles.novedades}`}>
          {config.novedades.map((novedad) => (
            <li className={compartido.fila} key={novedad.id} style={tonoVars(novedad.tono)}>
              <span
                className={novedad.sinLeer ? `${styles.punto} ${styles.puntoNuevo}` : styles.punto}
                aria-hidden="true"
              />
              <span className={styles.icono}>
                <HospitalIcon name={novedad.icono} />
              </span>
              <span className={styles.textos}>
                <span className={styles.titulo}>{novedad.titulo}</span>
                <span className={styles.meta}>{novedad.meta}</span>
              </span>
              {novedad.sinLeer ? (
                <span className="merdn-sr-only">{config.etiquetaSinLeer}</span>
              ) : null}
              <HospitalBadge tono={novedad.tono} className={styles.tipo}>
                {novedad.tipo}
              </HospitalBadge>
              <span className={styles.cuando}>{novedad.cuando}</span>
            </li>
          ))}
        </ul>
      </HospitalCard>
    </div>
  );
}
