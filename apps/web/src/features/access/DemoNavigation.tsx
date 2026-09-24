'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { branding } from '@/config/branding';
import styles from './centralAccess.module.css';

/**
 * Atajos para explorar los espacios visuales de MERDN durante la demostración.
 * No solicita credenciales ni crea sesiones, usuarios, solicitudes o datos.
 */
export function DemoNavigation(): ReactNode {
  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="demo-navigation-title">
        <Link className={styles.back} href="/">← Volver al Portal Central</Link>
        <div className={styles.brand}>
          <Image src="/brand/corazon-check.png" alt={`Símbolo de ${branding.platformDisplayName}`} width={42} height={42} />
          <div><strong>{branding.platformDisplayName}</strong><span>Demostración local</span></div>
        </div>
        <h1 id="demo-navigation-title">Explorar la demostración</h1>
        <p className={styles.lead}>
          Todos los perfiles y datos son ficticios. Seleccione un espacio para ver su experiencia visual.
        </p>

        <div className={styles.choices}>
          <Link className={styles.roleCard} href="/hospital"><strong>Hospital</strong><span>Abrir la demostración hospitalaria.</span></Link>
          <Link className={styles.roleCard} href="/municipality"><strong>Alcaldía</strong><span>Abrir la demostración municipal.</span></Link>
        </div>

        <section className={styles.human} aria-labelledby="human-access-title">
          <h2 id="human-access-title">Personas y personal de terreno</h2>
          <p>La inscripción guiada permite recorrer el formulario con datos de demostración.</p>
          <Link className={styles.secondary} href="/inscripcion">Abrir inscripción guiada</Link>
          <Link className={styles.secondary} href="/cuidador">Abrir muestra de cuidador</Link>
          <Link className={styles.secondary} href="/profesional">Abrir muestra de personal de terreno</Link>
        </section>
      </section>
    </main>
  );
}
