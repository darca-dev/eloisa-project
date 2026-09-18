import type { ReactNode } from 'react';

import {
  AdminAviso,
  AdminCamposFuturos,
  hospitalAdminStyles as styles,
} from './HospitalAdminPieces';
import type { HospitalAuditoriaConfig } from './hospitalAdministrationConfig';
import { HospitalCard, HospitalCardHeader, HospitalNote } from './HospitalViewPieces';

/**
 * Bloque «Auditoría» (TASK-003H-05, FR-09).
 *
 * Reproduce la composición de `Auditoría del sistema` del prototipo oficial
 * (líneas 937–955) y sus cinco eventos demostrativos (líneas 1318–1323):
 * usuario y rol, momento, acción y valores anterior y nuevo.
 *
 * Alcance: presentación. Los cinco registros son ejemplos ficticios, no una
 * bitácora real ni evidencia de cumplimiento. No hay captura de eventos,
 * persistencia, búsqueda, filtros, exportación, inmutabilidad, hash ni
 * retención. Los campos previstos —módulo, objeto afectado, resultado, origen y
 * referencia de trazabilidad— se muestran sin valor: no se inventan para los
 * ejemplos del prototipo.
 */

const TITULO_ID = 'hospital-admin-auditoria';
const FUTURO_ID = 'hospital-admin-auditoria-futuro';

export function HospitalAudit({
  config,
}: {
  readonly config: HospitalAuditoriaConfig;
}): ReactNode {
  return (
    <div className={styles.panel}>
      <AdminAviso>{config.aviso}</AdminAviso>

      <HospitalCard gap={16} aria-labelledby={TITULO_ID}>
        <HospitalCardHeader
          titulo={config.titulo}
          tituloId={TITULO_ID}
          nota={config.descripcion}
        />
        <ul className={styles.eventos}>
          {config.items.map((evento) => (
            <li className={styles.evento} key={evento.id}>
              <span className={styles.eventoCabecera}>
                <span className={styles.eventoUsuario}>{evento.usuario}</span>
                <span className={styles.eventoCuando}>{evento.cuando}</span>
              </span>
              <p className={styles.eventoAccion}>{evento.accion}</p>
              <span className={styles.eventoValores}>
                <span className={`${styles.eventoValor} ${styles.eventoAntes}`}>
                  {`${config.etiquetaAntes}: ${evento.antes}`}
                </span>
                <span className={`${styles.eventoValor} ${styles.eventoDespues}`}>
                  {`${config.etiquetaDespues}: ${evento.despues}`}
                </span>
              </span>
            </li>
          ))}
        </ul>
        <HospitalNote>{config.nota}</HospitalNote>
      </HospitalCard>

      <HospitalCard gap={14}>
        <AdminCamposFuturos bloque={config.estructuraFutura} tituloId={FUTURO_ID} />
      </HospitalCard>
    </div>
  );
}
