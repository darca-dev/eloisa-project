import type { ReactNode } from 'react';

import styles from './hospital.module.css';
import { HospitalIcon } from './HospitalIcon';
import type {
  HospitalAccionDestino,
  HospitalAgendaProximaFila,
  HospitalAlarmaRecienteFila,
  HospitalProfesionalConteo,
  HospitalSeccionInicio,
} from './hospitalDashboardConfig';
import type { HospitalAlarmaResumen } from './hospitalAlertsConfig';
import { HOSPITAL_TONOS } from './hospitalTonos';
import type { HospitalTonoId } from './hospitalTonos';
import type { HospitalDestino } from './hospitalViews';

/**
 * Resúmenes operativos de Inicio (TASK-003H-02B, FR-05, FR-06 y FR-07).
 *
 * `Agenda próxima`, `Alarmas recientes` y el resumen de profesionales son
 * lecturas breves de datos que ya existen en las vistas destino. Ninguna
 * duplica la lógica del módulo: no ordenan por criterio propio, no calculan
 * disponibilidad, no evalúan rangos, no asignan, no cierran alarmas y no
 * escriben nada. Cada una ofrece un único acceso al módulo completo.
 *
 * `Sin asignar` y la severidad de cada alarma se muestran siempre como texto
 * visible; el tono solo acompaña. No aparecen Elí, WhatsApp, notificaciones,
 * comentarios ni ninguna capacidad remota.
 */

/** Estilo de tono de una fila: color de texto, fondo y borde ya aprobados. */
function tono(id: HospitalTonoId): Record<string, string> {
  const { texto, fondo, borde } = HOSPITAL_TONOS[id];

  return { '--h-tono-texto': texto, '--h-tono-fondo': fondo, '--h-tono-borde': borde };
}

/** Acceso al módulo completo. Es un botón del shell, no un enlace ni una ruta. */
function AccesoModulo({
  accion,
  onNavegar,
}: {
  readonly accion: HospitalAccionDestino;
  readonly onNavegar: (destino: HospitalDestino) => void;
}): ReactNode {
  return (
    <button
      type="button"
      className={styles.panelAcceso}
      data-hospital-destino={accion.destino.vista}
      data-hospital-intencion={accion.destino.intencion}
      onClick={() => {
        onNavegar(accion.destino);
      }}
    >
      {accion.etiqueta}
    </button>
  );
}

export function HospitalDashboardAgendaProxima({
  seccion,
  tituloId,
  onNavegar,
}: {
  readonly seccion: HospitalSeccionInicio<HospitalAgendaProximaFila>;
  readonly tituloId: string;
  readonly onNavegar: (destino: HospitalDestino) => void;
}): ReactNode {
  return (
    <section className={styles.panel} aria-labelledby={tituloId}>
      <div className={styles.panelHead}>
        <h2 className={styles.panelTitle} id={tituloId}>
          {seccion.titulo}
        </h2>
        {seccion.verTodo === undefined ? null : (
          <AccesoModulo accion={seccion.verTodo} onNavegar={onNavegar} />
        )}
      </div>
      <ul className={styles.resumenLista}>
        {seccion.items.map((fila) => (
          <li className={styles.agendaFila} key={fila.id}>
            <span className={styles.agendaHora}>{fila.hora}</span>
            <span className={styles.agendaTexto}>
              <span className={styles.agendaPaciente}>{fila.paciente}</span>
              <span className={styles.agendaModalidad}>{fila.modalidad}</span>
            </span>
            <span
              className={fila.sinAsignar ? styles.agendaSinAsignar : styles.agendaProfesional}
              style={fila.sinAsignar ? tono('amarillo') : undefined}
            >
              {fila.profesional}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function HospitalDashboardAlarmasRecientes({
  seccion,
  tituloId,
  onNavegar,
}: {
  readonly seccion: HospitalSeccionInicio<HospitalAlarmaRecienteFila>;
  readonly tituloId: string;
  readonly onNavegar: (destino: HospitalDestino) => void;
}): ReactNode {
  return (
    <section className={styles.panel} aria-labelledby={tituloId}>
      <div className={styles.panelHead}>
        <h2 className={styles.panelTitle} id={tituloId}>
          {seccion.titulo}
        </h2>
        {seccion.verTodo === undefined ? null : (
          <AccesoModulo accion={seccion.verTodo} onNavegar={onNavegar} />
        )}
      </div>
      <ul className={styles.resumenLista}>
        {seccion.items.map((fila) => (
          <li className={styles.alarmaFila} key={fila.id} style={tono(fila.tono)}>
            <span className={styles.alarmaSeveridad}>{fila.severidad}</span>
            <span className={styles.alarmaTexto}>
              <span className={styles.alarmaPaciente}>{fila.paciente}</span>
              <span className={styles.alarmaMeta}>{`${fila.cuando} · ${fila.estado}`}</span>
            </span>
            <button
              type="button"
              className={styles.accionFila}
              data-hospital-destino={fila.accion.destino.vista}
              data-hospital-intencion={fila.accion.destino.intencion}
              onClick={() => {
                onNavegar(fila.accion.destino);
              }}
            >
              {fila.accion.etiqueta}
              <span className="merdn-sr-only">{` ${fila.accion.detalleAccesible}`}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Resumen demostrativo del semáforo para la cabecera de Inicio. */
export function HospitalDashboardSemaforo({
  resumen,
  tituloId,
  onNavegar,
}: {
  readonly resumen: readonly HospitalAlarmaResumen[];
  readonly tituloId: string;
  readonly onNavegar: (destino: HospitalDestino) => void;
}): ReactNode {
  return (
    <section className={styles.panel} aria-labelledby={tituloId}>
      <div className={styles.panelHead}>
        <h2 className={styles.panelTitle} id={tituloId}>
          Semáforo de alarmas
        </h2>
      </div>
      <ul className={styles.semaforoLista} aria-label="Resumen del semáforo de alarmas">
        {resumen.map((nivel) => (
          <li className={styles.semaforoFila} key={nivel.id} style={tono(nivel.tono)}>
            <span className={styles.semaforoIcono}>
              <HospitalIcon name={nivel.icono} size={17} />
            </span>
            <span className={styles.semaforoEtiqueta}>{nivel.etiqueta}</span>
            <span className={styles.semaforoValor}>{nivel.valor}</span>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className={styles.semaforoAccion}
        data-hospital-destino="alarmas"
        onClick={() => {
          onNavegar({ vista: 'alarmas' });
        }}
      >
        Gestionar alarmas
      </button>
    </section>
  );
}

export function HospitalDashboardProfesionales({
  seccion,
  tituloId,
  onNavegar,
}: {
  readonly seccion: HospitalSeccionInicio<HospitalProfesionalConteo>;
  readonly tituloId: string;
  readonly onNavegar: (destino: HospitalDestino) => void;
}): ReactNode {
  return (
    <section className={styles.panel} aria-labelledby={tituloId}>
      <div className={styles.panelHead}>
        <h2 className={styles.panelTitle} id={tituloId}>
          {seccion.titulo}
        </h2>
        {seccion.verTodo === undefined ? null : (
          <AccesoModulo accion={seccion.verTodo} onNavegar={onNavegar} />
        )}
      </div>
      <dl className={styles.profesionalesLista}>
        {seccion.items.map((conteo) => (
          <div className={styles.profesionalConteo} key={conteo.id}>
            <dt className={styles.profesionalEtiqueta}>{conteo.etiqueta}</dt>
            <dd className={styles.profesionalValor}>{conteo.valor}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
