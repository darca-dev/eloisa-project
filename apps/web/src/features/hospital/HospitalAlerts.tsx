'use client';

import { useRef, type ReactNode, type Ref } from 'react';

import styles from './hospitalAlerts.module.css';
import { hospitalAlertsDemo } from './hospitalAlertsConfig';
import type {
  HospitalAccionVariante,
  HospitalAlertaDetalle,
  HospitalAlertsConfig,
} from './hospitalAlertsConfig';
import { HospitalIcon } from './HospitalIcon';
import {
  HospitalBadge,
  HospitalCard,
  HospitalCardHeader,
  HospitalDataGrid,
  HospitalNote,
  HospitalViewHeader,
  hospitalViewStyles as compartido,
  tonoVars,
} from './HospitalViewPieces';

/**
 * Vista «Semáforo de alarmas» (TASK-003H-03, FR-04).
 *
 * Compone la bandeja `Alarmas recientes` de las líneas 183–200 del prototipo
 * oficial junto con las secciones propias de la vista `vAlarmas`
 * (líneas 361–417): resumen rojo/amarillo/verde, detalle demostrativo de la
 * alerta roja de Sara Nieto Vargas con su contexto, acciones visibles y notas
 * de continuidad pendientes y atendidas.
 *
 * Alcance: presentación. No hay evaluación de rangos, generación automática de
 * alarmas, priorización, motor de reglas, notificación, asignación, comentario,
 * auditoría productiva ni cierre de alertas. Las seis acciones del detalle son
 * exclusivamente visuales: no tienen controlador y no producen ningún efecto.
 * La copia del prototipo sobre automatización y trazabilidad es contenido
 * demostrativo y no describe funcionalidad implementada.
 *
 * `Ver` es la única excepción autorizada y solo mueve el foco al detalle ya
 * renderizado en la misma vista: no consulta, no carga y no cambia de alerta.
 */

const TITULO_ID = 'hospital-alarmas-titulo';
const TITULO_BANDEJA_ID = 'hospital-alarmas-bandeja';
const TITULO_DETALLE_ID = 'hospital-alarmas-detalle';
const TITULO_CONTINUIDAD_ID = 'hospital-alarmas-continuidad';

const CLASE_ACCION: Record<HospitalAccionVariante, string> = {
  primaria: styles.accionPrimaria,
  azul: styles.accionAzul,
  neutra: styles.accionNeutra,
  roja: styles.accionRoja,
  verde: styles.accionVerde,
};

/** Detalle demostrativo de la alerta roja, con su contexto y sus acciones. */
function HospitalAlertaDetalleCard({
  detalle,
  referencia,
}: {
  readonly detalle: HospitalAlertaDetalle;
  readonly referencia: Ref<HTMLElement>;
}): ReactNode {
  return (
    <HospitalCard
      gap={18}
      className={styles.detalleCard}
      aria-labelledby={TITULO_DETALLE_ID}
      ref={referencia}
      tabIndex={-1}
    >
      <div className={compartido.cardHead}>
        <p className={styles.detalleEtiqueta}>{detalle.etiqueta}</p>
        <HospitalBadge tono={detalle.tono} className={styles.detalleEstado}>
          {detalle.estado}
        </HospitalBadge>
      </div>
      <h2 className={styles.detalleTitulo} id={TITULO_DETALLE_ID}>
        {detalle.titulo}
      </h2>
      <HospitalDataGrid
        campos={detalle.campos}
        minimo={210}
        etiquetaAccesible="Contexto del paciente y del reporte"
      />
      <div className={styles.acciones}>
        {detalle.acciones.map((accion) => (
          <button
            key={accion.etiqueta}
            type="button"
            className={`${styles.accion} ${CLASE_ACCION[accion.variante]}`}
          >
            {accion.etiqueta}
          </button>
        ))}
      </div>
      <HospitalNote>{detalle.nota}</HospitalNote>
    </HospitalCard>
  );
}

export function HospitalAlerts({
  config = hospitalAlertsDemo,
}: {
  readonly config?: HospitalAlertsConfig;
}): ReactNode {
  const detalleRef = useRef<HTMLElement>(null);

  return (
    <div className={compartido.view}>
      <HospitalViewHeader encabezado={config.encabezado} tituloId={TITULO_ID} />

      <ul className={styles.resumen} aria-label="Resumen del semáforo de alarmas">
        {config.resumen.map((nivel) => (
          <li className={styles.resumenCard} key={nivel.id} style={tonoVars(nivel.tono)}>
            <span className={styles.resumenIcono}>
              <HospitalIcon name={nivel.icono} size={22} />
            </span>
            <span className={styles.resumenTextos}>
              <span className={styles.resumenValor}>{nivel.valor}</span>
              <span className={styles.resumenEtiqueta}>{nivel.etiqueta}</span>
            </span>
          </li>
        ))}
      </ul>

      <HospitalAlertaDetalleCard detalle={config.detalle} referencia={detalleRef} />

      <HospitalCard aria-labelledby={TITULO_CONTINUIDAD_ID}>
        <HospitalCardHeader titulo={config.continuidad.titulo} tituloId={TITULO_CONTINUIDAD_ID} />
        <ul className={styles.notas}>
          {config.continuidad.items.map((nota) => (
            <li className={styles.nota} key={nota.id}>
              <span className={styles.notaTexto}>{nota.texto}</span>
              <span className={styles.notaMeta}>{nota.meta}</span>
              <HospitalBadge tono={nota.tono} className={styles.notaEstado}>
                {nota.estado}
              </HospitalBadge>
            </li>
          ))}
        </ul>
        <HospitalNote>{config.continuidad.nota}</HospitalNote>
      </HospitalCard>

      <HospitalCard aria-labelledby={TITULO_BANDEJA_ID}>
        <HospitalCardHeader titulo={config.bandeja.titulo} tituloId={TITULO_BANDEJA_ID} nota={config.bandeja.nota} />
        <ul className={styles.bandeja}>
          {config.bandeja.items.map((alarma) => (
            <li className={styles.alarma} key={alarma.id} style={tonoVars(alarma.tono)}>
              <span className={styles.alarmaIcono}><HospitalIcon name="alarmas" size={18} /></span>
              <span className={styles.alarmaTextos}>
                <span className={styles.alarmaPaciente}>{alarma.paciente}</span>
                <span className={styles.alarmaMotivo}>{alarma.motivo}</span>
              </span>
              <HospitalBadge tono={alarma.tono} className={styles.alarmaNivel}>{alarma.nivel}</HospitalBadge>
              <span className={styles.alarmaCuando}>{alarma.cuando}</span>
              <button type="button" className={styles.alarmaVer} aria-label={`${config.bandeja.accionVer} el detalle de la alerta de ${alarma.paciente}`} onClick={() => { detalleRef.current?.focus(); }}>
                {config.bandeja.accionVer}
              </button>
            </li>
          ))}
        </ul>
      </HospitalCard>
    </div>
  );
}
