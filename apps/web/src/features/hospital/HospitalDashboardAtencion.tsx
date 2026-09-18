import type { ReactNode } from 'react';

import styles from './hospital.module.css';
import { HospitalIcon } from './HospitalIcon';
import type {
  HospitalAccionRapida,
  HospitalAtencionItem,
  HospitalSeccionInicio,
} from './hospitalDashboardConfig';
import { HOSPITAL_TONOS } from './hospitalTonos';
import type { HospitalDestino } from './hospitalViews';

/**
 * Zona prioritaria y acciones rápidas de Inicio (TASK-003H-02B, FR-03 y FR-04).
 *
 * `Necesita atención ahora` lista situaciones que ya existen en los fixtures
 * Hospital —alarmas rojas, alarmas amarillas, casos sin profesional y pacientes
 * esperando consulta virtual— y ofrece a cada una una sola acción, que abre el
 * módulo donde esa situación se trabaja. No hay prioridad calculada, umbral,
 * diagnóstico, recomendación, SLA ni ordenamiento clínico: el orden y los
 * textos vienen del fixture y la nota visible lo declara.
 *
 * `Acciones rápidas` son cinco accesos con icono y texto. Ninguno crea, asigna,
 * programa ni guarda nada: solo cambian la vista local del shell, por eso el
 * detalle visible describe el acceso y no una operación ejecutada.
 *
 * Alcance: presentación. Sin red, sin formularios, sin mutaciones y sin mensaje
 * de éxito. La severidad y el estado se leen como texto, nunca solo por color.
 */

/** Estilo de tono de una fila: color de texto, fondo y borde ya aprobados. */
function tono(id: HospitalAtencionItem['tono']): Record<string, string> {
  const { texto, fondo, borde } = HOSPITAL_TONOS[id];

  return { '--h-tono-texto': texto, '--h-tono-fondo': fondo, '--h-tono-borde': borde };
}

export function HospitalDashboardAtencion({
  seccion,
  tituloId,
  onNavegar,
}: {
  readonly seccion: HospitalSeccionInicio<HospitalAtencionItem>;
  readonly tituloId: string;
  readonly onNavegar: (destino: HospitalDestino) => void;
}): ReactNode {
  return (
    <section className={styles.panel} aria-labelledby={tituloId}>
      <div className={styles.panelHead}>
        <h2 className={styles.panelTitle} id={tituloId}>
          {seccion.titulo}
        </h2>
        <span className={styles.panelCount}>{`${String(seccion.items.length)} situaciones`}</span>
      </div>
      <ul className={styles.atencionLista}>
        {seccion.items.map((item) => (
          <li className={styles.atencionFila} key={item.id} style={tono(item.tono)}>
            <span className={styles.atencionSeveridad}>{item.severidad}</span>
            <span className={styles.atencionTexto}>
              <span className={styles.atencionTitulo}>{item.titulo}</span>
              <span className={styles.atencionContexto}>{item.contexto}</span>
            </span>
            <span className={styles.atencionPrioridad}>{item.prioridad}</span>
            <button
              type="button"
              className={styles.accionFila}
              data-hospital-destino={item.accion.destino.vista}
              data-hospital-intencion={item.accion.destino.intencion}
              onClick={() => {
                onNavegar(item.accion.destino);
              }}
            >
              {item.accion.etiqueta}
              <span className="merdn-sr-only">{` ${item.accion.detalleAccesible}`}</span>
            </button>
          </li>
        ))}
      </ul>
      {seccion.nota === undefined ? null : <p className={styles.panelNota}>{seccion.nota}</p>}
    </section>
  );
}

export function HospitalDashboardAcciones({
  seccion,
  tituloId,
  onNavegar,
}: {
  readonly seccion: HospitalSeccionInicio<HospitalAccionRapida>;
  readonly tituloId: string;
  readonly onNavegar: (destino: HospitalDestino) => void;
}): ReactNode {
  return (
    <section className={styles.panel} aria-labelledby={tituloId}>
      <div className={styles.panelHead}>
        <h2 className={styles.panelTitle} id={tituloId}>
          {seccion.titulo}
        </h2>
      </div>
      <ul className={styles.accionesLista}>
        {seccion.items.map((accion) => (
          <li key={accion.id}>
            <button
              type="button"
              className={styles.accionRapida}
              data-hospital-destino={accion.destino.vista}
              data-hospital-intencion={accion.destino.intencion}
              onClick={() => {
                onNavegar(accion.destino);
              }}
            >
              <span className={styles.accionRapidaIcono}>
                <HospitalIcon name={accion.icono} size={17} />
              </span>
              <span className={styles.accionRapidaTexto}>
                <span className={styles.accionRapidaEtiqueta}>{accion.etiqueta}</span>
                <span className={styles.accionRapidaDetalle}>{accion.detalle}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {seccion.nota === undefined ? null : <p className={styles.panelNota}>{seccion.nota}</p>}
    </section>
  );
}
