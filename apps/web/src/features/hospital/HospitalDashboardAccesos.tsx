import type { ReactNode } from 'react';

import styles from './hospital.module.css';
import { HospitalIcon } from './HospitalIcon';
import type { HospitalAccesoDirecto, HospitalSeccionInicio } from './hospitalDashboardConfig';
import type { HospitalDestino } from './hospitalViews';

/**
 * Sección `Ir a` de Inicio (TASK-003H-02B, FR-08).
 *
 * Acelerador compacto de icono y etiqueta hacia los once módulos del menú, en
 * el mismo orden y con los mismos identificadores, etiquetas e iconos que el
 * sidebar: la lista se deriva de la navegación del shell, no de un segundo mapa
 * que pudiera divergir. `Ir a` no sustituye al sidebar ni duplica arquitectura.
 *
 * Un módulo sin vista implementada conserva su sitio y se muestra con el texto
 * `No disponible`, deshabilitado: no recibe foco, no navega, no abre contenido
 * vacío y no simula éxito. Es la misma verdad funcional que ya aplica el menú.
 */
export function HospitalDashboardAccesos({
  seccion,
  tituloId,
  textoNoDisponible,
  onNavegar,
}: {
  readonly seccion: HospitalSeccionInicio<HospitalAccesoDirecto>;
  readonly tituloId: string;
  readonly textoNoDisponible: string;
  readonly onNavegar: (destino: HospitalDestino) => void;
}): ReactNode {
  return (
    <section className={styles.panel} aria-labelledby={tituloId}>
      <div className={styles.panelHead}>
        <h2 className={styles.panelTitle} id={tituloId}>
          {seccion.titulo}
        </h2>
      </div>
      <ul className={styles.accesosLista}>
        {seccion.items.map((acceso) => {
          const destino = acceso.destino;

          return (
            <li key={acceso.id}>
              <button
                type="button"
                className={destino === null ? styles.accesoInerte : styles.acceso}
                disabled={destino === null}
                /* Marcador técnico de auditoría: no es visible ni se anuncia. */
                data-hospital-acceso={destino === null ? 'sin-modulo' : 'navegable'}
                data-hospital-destino={destino?.vista}
                onClick={
                  destino === null
                    ? undefined
                    : () => {
                        onNavegar(destino);
                      }
                }
              >
                <span className={styles.accesoIcono}>
                  <HospitalIcon name={acceso.icono} size={17} />
                </span>
                <span className={styles.accesoEtiqueta}>{acceso.etiqueta}</span>
                {destino === null ? (
                  <span className={styles.accesoEstado}>{textoNoDisponible}</span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
