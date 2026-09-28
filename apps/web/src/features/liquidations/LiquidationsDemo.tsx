import type { ReactNode } from 'react';

import {
  liquidationsDemoByRole,
  type LiquidationDemoRole,
  type LiquidationDemoStatus,
} from './liquidationsDemoData';
import styles from './liquidationsDemo.module.css';

function classForStatus(status: LiquidationDemoStatus): string {
  switch (status) {
    case 'Pagado de muestra':
      return styles.statusPaid;
    case 'Aprobado para corte':
      return styles.statusApproved;
    case 'En revisión':
    default:
      return styles.statusReview;
  }
}

export function LiquidationsDemo({ role }: { readonly role: LiquidationDemoRole }): ReactNode {
  const data = liquidationsDemoByRole[role];

  return (
    <section
      className={styles.surface}
      aria-labelledby={`liquidaciones-${role}-titulo`}
      data-liquidations-demo-local={role}
    >
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>{data.roleLabel}</p>
          <h2 className={styles.title} id={`liquidaciones-${role}-titulo`}>
            {data.heading}
          </h2>
          <p className={styles.description}>
            Consulta visual de actividades y cortes de ejemplo. No es una billetera ni habilita pagos.
          </p>
        </div>
        <span className={styles.demoBadge}>Demo local · solo lectura</span>
      </header>

      <p className={styles.notice} role="note">
        Datos ficticios de demostración local. Los montos son referencias visuales, no dinero disponible, y no se guardan cambios.
      </p>

      <ul className={styles.summary} aria-label={`Resumen demostrativo de ${data.roleLabel}`}>
        {data.summary.map((item) => (
          <li className={styles.summaryCard} key={item.label}>
            <span className={styles.summaryLabel}>{item.label}</span>
            <strong className={styles.summaryValue}>{item.value}</strong>
            <span className={styles.summaryDescription}>{item.description}</span>
          </li>
        ))}
      </ul>

      <section className={styles.tableCard} aria-labelledby={`liquidaciones-${role}-tabla`}>
        <div className={styles.tableHeader}>
          <div>
            <h3 id={`liquidaciones-${role}-tabla`}>Detalle del corte de muestra</h3>
            <p>Estados administrativos ilustrativos; no validan una prestación ni una transferencia.</p>
          </div>
          <span className={styles.periodBadge}>Corte demostrativo · septiembre 2026</span>
        </div>
        <div className={styles.tableScroll}>
          <table>
            <caption>Registros ficticios de liquidación para {data.roleLabel.toLowerCase()}.</caption>
            <thead>
              <tr>
                <th scope="col">Actividad</th>
                <th scope="col">Periodo</th>
                <th scope="col">Valor de referencia</th>
                <th scope="col">Estado</th>
              </tr>
            </thead>
            <tbody>
              {data.records.map((record) => (
                <tr key={record.id}>
                  <th scope="row">{record.activity}</th>
                  <td>{record.period}</td>
                  <td className={styles.amount}>{record.referenceAmount}</td>
                  <td>
                    <span className={`${styles.status} ${classForStatus(record.status)}`}>{record.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
