import type { ReactNode } from 'react';

import styles from './hospitalAgenda.module.css';
import { hospitalAgendaCanvasDemo } from './hospitalAgendaCanvasDemo';
import { HospitalIcon } from './HospitalIcon';
import {
  HospitalBadge,
  HospitalCard,
  HospitalCardHeader,
  HospitalDivider,
  HospitalNote,
  HospitalViewHeader,
  hospitalViewStyles as compartido,
} from './HospitalViewPieces';

const TITULO_ID = 'hospital-agenda-demo-titulo';
const SOLICITUDES_ID = 'hospital-agenda-demo-solicitudes';
const CALENDARIO_ID = 'hospital-agenda-demo-calendario';
const ESTADOS_ID = 'hospital-agenda-demo-estados';

/**
 * Recuperación visual de la Agenda exclusivamente para modo demo local.
 *
 * No importa el cliente de agenda, no recibe `fetch` y no expone controles de
 * asignación: la Agenda conectada conserva esas responsabilidades fuera de
 * demo en `HospitalAgenda`.
 */
export function HospitalAgendaDemo(): ReactNode {
  const config = hospitalAgendaCanvasDemo;

  return (
    <div className={compartido.view} data-hospital-agenda-demo-local="true">
      <HospitalViewHeader encabezado={config.encabezado} tituloId={TITULO_ID} />

      <HospitalCard className={styles.solicitudesCard} aria-labelledby={SOLICITUDES_ID}>
        <HospitalCardHeader
          titulo="Solicitudes pendientes de asignación"
          tituloId={SOLICITUDES_ID}
          extra={
            <HospitalBadge tono="amarillo" className={styles.contador}>
              {`${String(config.solicitudes.length)} solicitudes ficticias`}
            </HospitalBadge>
          }
        />
        <ul className={styles.solicitudes} aria-label="Cuatro solicitudes ficticias">
          {config.solicitudes.map((solicitud) => (
            <li className={styles.solicitud} key={solicitud.id}>
              <div className={styles.solicitudResumen}>
                <span className={styles.solicitudIcono} aria-hidden="true">
                  <HospitalIcon name={solicitud.icono} size={20} />
                </span>
                <span className={styles.solicitudTextos}>
                  <span className={styles.solicitudTitulo}>{`${solicitud.persona} · ${solicitud.tipo}`}</span>
                  <span className={styles.solicitudLinea}>{solicitud.detalle}</span>
                  <span className={styles.solicitudLinea}>{`Registro ${solicitud.cuando}`}</span>
                </span>
                <HospitalBadge tono={solicitud.tono} className={styles.solicitudEstado}>
                  {solicitud.estado}
                </HospitalBadge>
              </div>
              <p className={styles.demoLectura}>Modo demo local · asignación disponible tras integrar la operación real.</p>
            </li>
          ))}
        </ul>
      </HospitalCard>

      <div className={styles.columnas}>
        <HospitalCard gap={16} className={styles.calendarioCard} aria-labelledby={CALENDARIO_ID}>
          <HospitalCardHeader titulo="Septiembre 2026" tituloId={CALENDARIO_ID} />
          <div className={styles.calendarioScroll}>
            <div className={styles.demoCalendario} aria-label="Calendario mensual ficticio de septiembre de 2026">
              {config.diasSemana.map((dia, indice) => (
                <span className={styles.demoSemana} key={`${dia}-${String(indice)}`}>{dia}</span>
              ))}
              {config.dias.map((dia) => (
                <span
                  className={`${styles.demoDia}${dia.hoy ? ` ${styles.demoDiaHoy}` : ''}${dia.destacado ? ` ${styles.demoDiaDestacado}` : ''}`}
                  key={dia.id}
                >
                  <span className={styles.diaNumero}>{dia.numero}</span>
                  <span className={styles.diaCitas}>{dia.citas}</span>
                </span>
              ))}
            </div>
          </div>
          <ul className={styles.totales} aria-label="Totales ficticios de agenda">
            {config.totales.map((total) => (
              <li className={styles.total} key={total.id}>
                <span className={styles.totalValor}>{total.valor}</span>
                <span className={styles.totalEtiqueta}>{total.etiqueta}</span>
              </li>
            ))}
          </ul>
        </HospitalCard>

        <HospitalCard gap={14} className={styles.citasCard} aria-labelledby={ESTADOS_ID}>
          <HospitalCardHeader titulo="Estados de la cita" tituloId={ESTADOS_ID} />
          <p className={styles.demoDescripcion}>Ejemplos visuales de estados administrativos; no reflejan una cita real.</p>
          <ul className={styles.demoEstados} aria-label="Estados administrativos de muestra">
            {config.estados.map((estado) => (
              <li key={estado.id}><HospitalBadge tono={estado.tono}>{estado.etiqueta}</HospitalBadge></li>
            ))}
          </ul>
          <HospitalDivider />
          <h3 className={styles.demoSubtitulo}>Una cita, cuatro vistas</h3>
          <ul className={styles.demoPerspectivas} aria-label="Ejemplos de lectura por rol">
            {config.perspectivas.map((perspectiva) => (
              <li className={styles.demoPerspectiva} key={perspectiva.id}>
                <span className={styles.demoPerspectivaIcono} aria-hidden="true"><HospitalIcon name={perspectiva.icono} size={17} /></span>
                <span className={styles.demoPerspectivaRol}>{perspectiva.rol}</span>
                <span className={styles.demoPerspectivaTexto}>{perspectiva.texto}</span>
              </li>
            ))}
          </ul>
        </HospitalCard>
      </div>

      <HospitalNote>Datos ficticios de demostración local. No se guardan cambios ni se sincronizan citas.</HospitalNote>
    </div>
  );
}
