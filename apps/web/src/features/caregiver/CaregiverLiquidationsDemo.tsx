import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { branding } from '@/config/branding';
import { LiquidationsDemo } from '@/features/liquidations/LiquidationsDemo';
import styles from './caregiverLiquidationsDemo.module.css';

export function CaregiverLiquidationsDemo(): ReactNode {
  return (
    <div className={styles.page} data-caregiver-demo-local="true">
      <header className={styles.topbar}>
        <div className={styles.brand}>
          <Image
            src="/brand/corazon-check.png"
            alt={`Símbolo de ${branding.platformDisplayName}`}
            width={38}
            height={38}
            className={styles.logo}
          />
          <div>
            <p>{branding.platformDisplayName}</p>
            <h1>Portal del cuidador</h1>
          </div>
        </div>
        <span className={styles.profile}>Cuidador demo</span>
      </header>

      <main className={styles.content}>
        <div className={styles.navigation}>
          <Link href="/" className={styles.backLink}>
            Volver al portal central
          </Link>
          <span>Datos ficticios de demostración — sin dinero ni acciones persistentes</span>
        </div>
        <LiquidationsDemo role="cuidador" />
      </main>
    </div>
  );
}
