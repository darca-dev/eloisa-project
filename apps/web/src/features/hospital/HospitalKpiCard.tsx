import type { CSSProperties, ReactNode } from 'react';

import styles from './hospital.module.css';
import { HospitalIcon } from './HospitalIcon';
import type { HospitalKpiConfig } from './hospitalDashboardConfig';
import type { HospitalDestino } from './hospitalViews';

/**
 * Tarjeta KPI genérica de Inicio (TASK-003H-02, FR-02; TASK-003H-02B, FR-02).
 *
 * Una sola implementación representa las siete tarjetas: recibe toda su
 * apariencia, su contenido y su destino por configuración tipada y no conoce
 * categorías, no suma valores, no deriva estados y no aplica condicionales por
 * tipo de KPI. Admite cualquier número de filas de desglose sin variantes
 * copiadas.
 *
 * TASK-003H-02B compacta la anatomía —menos alto, menos relleno, icono y total
 * más pequeños y desglose en una sola línea que fluye— y convierte la tarjeta
 * completa en un único control: un `button` que abre la vista local indicada en
 * su configuración. No hay controles anidados, no hay enlace, no hay ruta y no
 * cambia la URL.
 *
 * El total no es un dato real ni un indicador oficial: es un fixture visual.
 *
 * Accesibilidad: el nombre accesible del botón es su propio texto visible
 * —etiqueta, total, desglose y pie—, de modo que el color y el icono nunca son
 * el único medio para identificar la métrica ni su destino. El icono es
 * decorativo. Los pares del desglose se dibujan con `span` porque el contenido
 * de un `button` debe ser texto en línea; su relación se mantiene visible y
 * legible sin listas anidadas dentro del control.
 */
export function HospitalKpiCard({
  kpi,
  onNavegar,
}: {
  readonly kpi: HospitalKpiConfig;
  /** Navegación local del shell. Sin controlador la tarjeta no es interactiva. */
  readonly onNavegar?: (destino: HospitalDestino) => void;
}): ReactNode {
  const acento = {
    '--h-kpi-acento': kpi.accentColor,
    '--h-kpi-fondo-icono': kpi.iconBackground,
  } as CSSProperties;

  return (
    <li className={styles.kpiCard} style={acento}>
      <button
        type="button"
        className={styles.kpiBoton}
        /* Marcador técnico de auditoría: no es visible ni se anuncia. */
        data-hospital-destino={kpi.destino.vista}
        data-hospital-intencion={kpi.destino.intencion}
        onClick={
          onNavegar === undefined
            ? undefined
            : () => {
                onNavegar(kpi.destino);
              }
        }
      >
        <span className={styles.kpiHead}>
          <span className={styles.kpiLabel}>{kpi.label}</span>
          <span className={styles.kpiIcon}>
            <HospitalIcon name={kpi.icon} size={16} />
          </span>
        </span>
        <span className={styles.kpiValue}>{kpi.value}</span>
        <span className={styles.kpiBreakdown}>
          {kpi.breakdown.map((fila) => (
            <span className={styles.kpiBreakdownRow} key={fila.label}>
              <span className={styles.kpiBreakdownLabel}>{fila.label}</span>
              <span className={styles.kpiBreakdownValue}>{fila.value}</span>
            </span>
          ))}
        </span>
        <span className={styles.kpiPie}>{kpi.pie}</span>
      </button>
    </li>
  );
}
