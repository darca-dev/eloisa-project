'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { branding, platformNameInSentence } from '@/config/branding';
import styles from './hub.module.css';

/**
 * Entrada unificada de Eloisa. La portada orienta hacia tres experiencias y
 * no monta contenido interno ni conserva credenciales.
 */
export function HubAccessPortal(): ReactNode {
  return (
    <div className={styles.hubContainer}>
      <header className={styles.hubHeader}>
        <div className={styles.brandArea}>
          <Image
            src="/brand/corazon-check.png"
            alt={`Símbolo oficial de ${branding.platformDisplayName}`}
            width={36}
            height={36}
            className={styles.brandLogo}
          />
          <div className={styles.brandText}>
            <span className={styles.brandName}>{branding.platformDisplayName}</span>
            <span className={styles.brandTagline}>Portal de servicios</span>
          </div>
        </div>
        <div className={styles.headerMeta}>
          <span className={styles.badgeMunicipio}>Municipio de Soacha</span>
        </div>
      </header>

      <main className={styles.hubMain}>
        <section className={styles.heroSection} aria-labelledby="portal-title">
          <span className={styles.heroTag}>Portal de acceso</span>
          <h1 className={styles.heroTitle} id="portal-title">Portal {platformNameInSentence()}</h1>
          <p className={styles.heroSubtitle}>
            Seleccione el espacio al que desea ingresar.
          </p>
        </section>

        <section className={styles.sectionBlock} aria-labelledby="experiencias-title">
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitleGroup}>
              <span className={styles.sectionIcon} aria-hidden="true">◌</span>
              <h2 className={styles.sectionTitle} id="experiencias-title">Elija su experiencia</h2>
            </div>
            <span className={styles.sectionBadge}>Servicios y gestión institucional</span>
          </div>

          <div className={styles.primaryGrid}>
            <article className={`${styles.hubCard} ${styles.cardFeatured}`}>
              <div className={styles.cardHeader}>
                <div className={`${styles.cardIconBox} ${styles.iconBoxPaciente}`} aria-hidden="true">⌂</div>
                <div className={styles.cardMeta}>
                  <span className={styles.cardTag}>Personas y atención en casa</span>
                  <h3 className={styles.cardTitle}>Atención Domiciliaria</h3>
                </div>
              </div>
              <p className={styles.cardDescription}>
                Un solo acceso para pacientes, cuidadores y visitadores médicos. El sistema reconoce el
                perfil aprobado y abre la experiencia correspondiente.
              </p>
              <ul className={styles.featureList}>
                <li className={styles.featureItem}><span className={styles.featureCheck}>✓</span> Paciente</li>
                <li className={styles.featureItem}><span className={styles.featureCheck}>✓</span> Cuidador</li>
                <li className={styles.featureItem}><span className={styles.featureCheck}>✓</span> Visitador médico</li>
              </ul>
              <div className={styles.cardActions}>
                <Link href="/acceso" className={styles.btnPrimary}>Iniciar sesión</Link>
                <Link href="/acceso?accion=registro" className={styles.btnSecondary}>Regístrate</Link>
              </div>
            </article>

            <article className={`${styles.hubCard} ${styles.cardFeatured}`}>
              <div className={styles.cardHeader}>
                <div className={`${styles.cardIconBox} ${styles.iconBoxHospital}`} aria-hidden="true">+</div>
                <div className={styles.cardMeta}>
                  <span className={styles.cardTag}>Gestión institucional</span>
                  <h3 className={styles.cardTitle}>Hospital</h3>
                </div>
              </div>
              <p className={styles.cardDescription}>
                Gestión de la operación hospitalaria, solicitudes de acceso y coordinación de atención.
              </p>
              <div className={styles.cardActions}>
                <Link href="/hospital" className={styles.btnPrimary}>Ingresar al Hospital</Link>
              </div>
            </article>

            <article className={`${styles.hubCard} ${styles.cardFeatured}`}>
              <div className={styles.cardHeader}>
                <div className={`${styles.cardIconBox} ${styles.iconBoxAlcaldia}`} aria-hidden="true">▦</div>
                <div className={styles.cardMeta}>
                  <span className={styles.cardTag}>Gestión territorial</span>
                  <h3 className={styles.cardTitle}>Alcaldía</h3>
                </div>
              </div>
              <p className={styles.cardDescription}>
                Información territorial, indicadores, programas, evidencias y seguimiento institucional.
              </p>
              <div className={styles.cardActions}>
                <Link href="/municipality" className={styles.btnPrimary}>Ingresar a Alcaldía</Link>
              </div>
            </article>
          </div>
        </section>
      </main>

      <footer className={styles.hubFooter}>
        <div className={styles.footerBadges}>
          <span className={styles.footerBadge}>Acceso por perfil</span>
          <span className={styles.footerBadge}>Servicios institucionales</span>
          <span className={styles.footerBadge}>Municipio de Soacha</span>
        </div>
        <p className={styles.footerText}>
          Plataforma para la atención domiciliaria y la gestión hospitalaria y municipal.
        </p>
      </footer>
    </div>
  );
}
