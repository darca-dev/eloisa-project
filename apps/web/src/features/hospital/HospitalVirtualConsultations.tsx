import type { ReactNode } from 'react';

import styles from './hospitalVirtual.module.css';
import { hospitalVirtualesDemo } from './hospitalVirtualConfig';
import type { HospitalVirtualConfig } from './hospitalVirtualConfig';
import {
  HospitalBadge,
  HospitalCard,
  HospitalCardHeader,
  HospitalEstadoResumen,
  HospitalViewHeader,
  hospitalViewStyles as compartido,
  tonoVars,
} from './HospitalViewPieces';

/**
 * Vista «Consultas virtuales» (TASK-003H-04, alcance C).
 *
 * Reproduce las líneas 517–546 del prototipo oficial: encabezado, los seis
 * conteos de estado (incluidos paciente esperando, profesional conectado, en
 * curso y finalizadas), el bloque «En curso y en espera» con sus cuatro
 * consultas y la nota sobre la preparación futura de WhatsApp.
 *
 * Alcance: presentación. No hay sala, enlace, proveedor, audio, vídeo, chat,
 * grabación, consentimiento, WhatsApp ni conexión en tiempo real: ningún estado
 * refleja presencia o actividad real y nada se envía, sincroniza ni persiste.
 * La copia sobre integraciones futuras es demostrativa.
 */

const TITULO_ID = 'hospital-virtuales-titulo';
const TITULO_LISTA_ID = 'hospital-virtuales-lista';

export function HospitalVirtualConsultations({
  config = hospitalVirtualesDemo,
}: {
  readonly config?: HospitalVirtualConfig;
}): ReactNode {
  return (
    <div className={compartido.view}>
      <HospitalViewHeader encabezado={config.encabezado} tituloId={TITULO_ID} />

      <HospitalEstadoResumen
        items={config.estados}
        etiquetaAccesible="Resumen de consultas virtuales por estado"
      />

      <HospitalCard aria-labelledby={TITULO_LISTA_ID}>
        <HospitalCardHeader titulo={config.listaTitulo} tituloId={TITULO_LISTA_ID} />
        <ul className={styles.consultas}>
          {config.consultas.map((consulta) => (
            <li className={styles.consulta} key={consulta.id} style={tonoVars(consulta.tono)}>
              <span className={styles.hora}>{consulta.hora}</span>
              <span className={styles.textos}>
                <span className={styles.paciente}>{consulta.paciente}</span>
                <span className={styles.profesional}>{consulta.profesional}</span>
              </span>
              <HospitalBadge tono={consulta.tono} className={styles.estado}>
                {consulta.estado}
              </HospitalBadge>
            </li>
          ))}
        </ul>
        <p className={styles.notaIntegracion}>{config.notaIntegracion}</p>
      </HospitalCard>
    </div>
  );
}
