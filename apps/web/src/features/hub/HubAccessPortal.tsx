'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';

import { branding } from '@/config/branding';
import styles from './hub.module.css';

/**
 * Portal Central de Acceso Multirrol (Eloísa / Elígeme).
 *
 * Página de inicio que articula el ecosistema completo:
 * 1. Módulos Institucionales Principales: Alcaldía de Soacha y Hospital.
 * 2. Profesionales de la Salud: Médicos Clínicos / Telemedicina y Personal de Terreno (Visitadores).
 * 3. Atención Domiciliaria: Paciente y Cuidador (con acceso directo a Certificación de Cuidador).
 */
export function HubAccessPortal(): ReactNode {
  const [modalCertificacionAbierto, setModalCertificacionAbierto] = useState(false);

  return (
    <div className={styles.hubContainer}>
      {/* Barra de cabecera institucional */}
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
            <span className={styles.brandTagline}>{branding.platformTagline}</span>
          </div>
        </div>

        <div className={styles.headerMeta}>
          <span className={styles.badgeMunicipio}>
            📍 Municipio de Soacha
          </span>
          <a
            href="http://localhost:3001/docs"
            target="_blank"
            rel="noreferrer"
            className={styles.linkApiDocs}
            title="Abrir documentación Swagger OpenAPI de la API backend"
          >
            ⚡ API Docs
          </a>
        </div>
      </header>

      {/* Cuerpo principal del portal */}
      <main className={styles.hubMain}>
        {/* Hero explicativo */}
        <section className={styles.heroSection}>
          <span className={styles.heroTag}>Sistema Integrado de Salud Domiciliaria</span>
          <h1 className={styles.heroTitle}>Portal Central de Acceso</h1>
          <p className={styles.heroSubtitle}>
            Bienvenido a la plataforma tecnológica de salud y cuidado domiciliario de Soacha.
            Seleccione el entorno institucional, operativo o ciudadano al que desea ingresar.
          </p>
        </section>

        {/* NIVEL 1: Módulos Institucionales Principales */}
        <section className={styles.sectionBlock}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitleGroup}>
              <span className={styles.sectionIcon}>🏛️</span>
              <h2 className={styles.sectionTitle}>Entornos Institucionales Principales</h2>
            </div>
            <span className={styles.sectionBadge}>Nivel Directivo & Gestión</span>
          </div>

          <div className={styles.primaryGrid}>
            {/* Alcaldía de Soacha */}
            <article className={`${styles.hubCard} ${styles.cardFeatured}`}>
              <div className={styles.cardHeader}>
                <div className={`${styles.cardIconBox} ${styles.iconBoxAlcaldia}`}>
                  🏛️
                </div>
                <div className={styles.cardMeta}>
                  <span className={styles.cardTag}>Gobierno & Territorio</span>
                  <h3 className={styles.cardTitle}>Alcaldía de Soacha</h3>
                </div>
              </div>

              <p className={styles.cardDescription}>
                Gestión territorial integral, monitoreo de metas, analítica poblacional,
                red de cuidadores y tableros de evidencia e indicadores (FURAG y ADRES).
              </p>

              <ul className={styles.featureList}>
                <li className={styles.featureItem}>
                  <span className={styles.featureCheck}>✓</span> Población vulnerable caracterizada por comunas
                </li>
                <li className={styles.featureItem}>
                  <span className={styles.featureCheck}>✓</span> Tableros de metas, presupuesto y FURAG
                </li>
                <li className={styles.featureItem}>
                  <span className={styles.featureCheck}>✓</span> Red de cuidado y brechas de atención
                </li>
              </ul>

              <div className={styles.cardActions}>
                <Link href="/municipality" className={styles.btnPrimary}>
                  Ingresar a Alcaldía de Soacha →
                </Link>
              </div>
            </article>

            {/* Hospital Departamental */}
            <article className={`${styles.hubCard} ${styles.cardFeatured}`}>
              <div className={styles.cardHeader}>
                <div className={`${styles.cardIconBox} ${styles.iconBoxHospital}`}>
                  🏥
                </div>
                <div className={styles.cardMeta}>
                  <span className={styles.cardTag}>Dirección Médica & ESE</span>
                  <h3 className={styles.cardTitle}>Hospital (ESE)</h3>
                </div>
              </div>

              <p className={styles.cardDescription}>
                Centro de mando clínico y asistencial. Administración de pacientes, gestión de agenda médica,
                coordinación de visitas domiciliarias, telemedicina y asignación de profesionales.
              </p>

              <ul className={styles.featureList}>
                <li className={styles.featureItem}>
                  <span className={styles.featureCheck}>✓</span> Dirección y despacho de visitas en terreno
                </li>
                <li className={styles.featureItem}>
                  <span className={styles.featureCheck}>✓</span> Expediente clínico y bitácoras domiciliarias
                </li>
                <li className={styles.featureItem}>
                  <span className={styles.featureCheck}>✓</span> Plantilla médica y alertas en tiempo real
                </li>
              </ul>

              <div className={styles.cardActions}>
                <Link href="/hospital" className={styles.btnPrimary}>
                  Ingresar al Hospital →
                </Link>
              </div>
            </article>
          </div>
        </section>

        {/* NIVEL 2: Profesionales de la Salud */}
        <section className={styles.sectionBlock}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitleGroup}>
              <span className={styles.sectionIcon}>🩺</span>
              <h2 className={styles.sectionTitle}>Profesionales de la Salud</h2>
            </div>
            <span className={styles.sectionBadge}>Médicos, Enfermería y Terapeutas</span>
          </div>

          <div className={styles.secondaryGrid}>
            {/* Profesionales en Terreno / Visitadores */}
            <article className={styles.hubCard}>
              <div className={styles.cardHeader}>
                <div className={`${styles.cardIconBox} ${styles.iconBoxProfesional}`}>
                  🛵
                </div>
                <div className={styles.cardMeta}>
                  <span className={styles.cardTag}>Atención Domiciliaria en Terreno</span>
                  <h3 className={styles.cardTitle}>Personal de Terreno / Visitadores</h3>
                </div>
              </div>

              <p className={styles.cardDescription}>
                Hoja de ruta operativa para médicos, enfermeros y visitadores en terreno.
                Recibe órdenes y turnos directos del <strong>Hospital</strong> y sincroniza
                el diagnóstico con la <strong>Bitácora del Paciente</strong>.
              </p>

              <ul className={styles.featureList}>
                <li className={styles.featureItem}>
                  <span className={styles.featureCheck}>✓</span> Hoja de ruta del día (Soacha Comunas 3 y 4)
                </li>
                <li className={styles.featureItem}>
                  <span className={styles.featureCheck}>✓</span> Conexión y reporte directo al Hospital
                </li>
                <li className={styles.featureItem}>
                  <span className={styles.featureCheck}>✓</span> Registro de signos y evolución en bitácora
                </li>
              </ul>

              <div className={styles.cardActions}>
                <Link href="/profesional" className={styles.btnPrimary}>
                  Abrir Portal de Terreno →
                </Link>
                <Link href="/hospital" className={styles.btnSecondary}>
                  Ver Asignaciones en Hospital
                </Link>
              </div>
            </article>

            {/* Profesionales Clínicos y Telemedicina */}
            <article className={styles.hubCard}>
              <div className={styles.cardHeader}>
                <div className={`${styles.cardIconBox} ${styles.iconBoxHospital}`}>
                  👨‍⚕️
                </div>
                <div className={styles.cardMeta}>
                  <span className={styles.cardTag}>Especialistas & Telemedicina</span>
                  <h3 className={styles.cardTitle}>Médicos Clínicos & Teleconsulta</h3>
                </div>
              </div>

              <p className={styles.cardDescription}>
                Atención médica remota, teleconsulta interactiva, prescripción asistida y revisión
                diagnóstica de pacientes crónicos bajo seguimiento domiciliario.
              </p>

              <ul className={styles.featureList}>
                <li className={styles.featureItem}>
                  <span className={styles.featureCheck}>✓</span> Módulo de Consultas Virtuales en vivo
                </li>
                <li className={styles.featureItem}>
                  <span className={styles.featureCheck}>✓</span> Supervisión de casos de alta complejidad
                </li>
                <li className={styles.featureItem}>
                  <span className={styles.featureCheck}>✓</span> Interconsulta y contrarreferencia hospitalaria
                </li>
              </ul>

              <div className={styles.cardActions}>
                <Link href="/hospital" className={styles.btnPrimary}>
                  Acceder a Consultas Clínicas →
                </Link>
              </div>
            </article>
          </div>
        </section>

        {/* NIVEL 3: Atención Domiciliaria (Paciente & Cuidador) */}
        <section className={styles.sectionBlock}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitleGroup}>
              <span className={styles.sectionIcon}>🤝</span>
              <h2 className={styles.sectionTitle}>Atención Domiciliaria & Ciudadanos</h2>
            </div>
            <span className={styles.sectionBadge}>Pacientes y Familias Cuidadoras</span>
          </div>

          <div className={styles.secondaryGrid}>
            {/* Paciente */}
            <article className={styles.hubCard}>
              <div className={styles.cardHeader}>
                <div className={`${styles.cardIconBox} ${styles.iconBoxPaciente}`}>
                  👤
                </div>
                <div className={styles.cardMeta}>
                  <span className={styles.cardTag}>Salud en el Hogar</span>
                  <h3 className={styles.cardTitle}>Paciente</h3>
                </div>
              </div>

              <p className={styles.cardDescription}>
                Acceso ciudadano para personas que reciben atención domiciliaria. Registro asistido
                con la asistente virtual <strong>{branding.aiDisplayName}</strong>, bitácora diaria
                de síntomas y solicitudes de asistencia.
              </p>

              <ul className={styles.featureList}>
                <li className={styles.featureItem}>
                  <span className={styles.featureCheck}>✓</span> Inscripción guiada paso a paso
                </li>
                <li className={styles.featureItem}>
                  <span className={styles.featureCheck}>✓</span> Bitácora personal de salud y bienestar
                </li>
                <li className={styles.featureItem}>
                  <span className={styles.featureCheck}>✓</span> Notificaciones de visitas médicas
                </li>
              </ul>

              <div className={styles.cardActions}>
                <Link href="/inscripcion" className={styles.btnPrimary}>
                  Inscribirse o Ingresar como Paciente →
                </Link>
              </div>
            </article>

            {/* Cuidador (con botón específico de certificación) */}
            <article className={styles.hubCard}>
              <div className={styles.cardHeader}>
                <div className={`${styles.cardIconBox} ${styles.iconBoxPaciente}`}>
                  🤲
                </div>
                <div className={styles.cardMeta}>
                  <span className={styles.cardTag}>Red de Cuidado Familiar</span>
                  <h3 className={styles.cardTitle}>Cuidador</h3>
                </div>
              </div>

              <p className={styles.cardDescription}>
                Misma base de atención que el paciente con trazabilidad para registrar datos a nombre de la persona cuidada,
                más acceso preferente al <strong>Programa de Certificación Oficial de Competencias de Cuidado</strong>.
              </p>

              {/* Banner / Callout de Certificación */}
              <div className={styles.certificacionCallout}>
                <span>📜</span>
                <div>
                  <strong>Programa Oficial de Cuidadores de Soacha:</strong> Valide y certifique sus conocimientos
                  en primeros auxilios, movilidad y cuidado del adulto mayor.
                </div>
              </div>

              <div className={styles.cardActions}>
                <button
                  type="button"
                  onClick={() => setModalCertificacionAbierto(true)}
                  className={styles.btnCertificado}
                >
                  📜 Certificarse como Cuidador →
                </button>
                <Link href="/inscripcion" className={styles.btnSecondary}>
                  Inscribirse como Cuidador
                </Link>
              </div>
            </article>
          </div>
        </section>
      </main>

      {/* Modal interactivo de Certificación de Cuidador */}
      {modalCertificacionAbierto && (
        <div className={styles.modalBackdrop} onClick={() => setModalCertificacionAbierto(false)}>
          <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 28 }}>📜</span>
                <h3 className={styles.modalTitle}>Certificación de Cuidadores</h3>
              </div>
              <button
                type="button"
                className={styles.modalCloseBtn}
                onClick={() => setModalCertificacionAbierto(false)}
                aria-label="Cerrar modal"
              >
                ✕
              </button>
            </div>

            <p style={{ margin: 0, color: 'var(--b-gris)', lineHeight: 1.5 }}>
              El programa de <strong>Certificación en Cuidados Domiciliarios</strong> es una iniciativa
              conjunta de la <strong>Alcaldía de Soacha</strong> y la red de salud para dignificar,
              capacitar y reconocer formalmente la labor de los cuidadores familiares.
            </p>

            <div style={{ background: 'var(--b-celeste)', padding: 16, borderRadius: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontWeight: 'bold', color: 'var(--b-azul)', fontSize: 14 }}>Módulos formativos incluidos:</div>
              <div style={{ fontSize: 13, color: 'var(--b-tinta)' }}>1. Primeros auxilios y emergencias en el hogar</div>
              <div style={{ fontSize: 13, color: 'var(--b-tinta)' }}>2. Técnicas de movilización segura y prevención de caídas</div>
              <div style={{ fontSize: 13, color: 'var(--b-tinta)' }}>3. Administración responsable de medicamentos y bitácora</div>
              <div style={{ fontSize: 13, color: 'var(--b-tinta)' }}>4. Salud mental, autocuidado y prevención del agotamiento</div>
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
              <Link
                href="/inscripcion"
                className={styles.btnPrimary}
                style={{ flex: 1, textAlign: 'center' }}
                onClick={() => setModalCertificacionAbierto(false)}
              >
                Registrarme y Postular a Certificación
              </Link>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => setModalCertificacionAbierto(false)}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pie de página */}
      <footer className={styles.hubFooter}>
        <div className={styles.footerBadges}>
          <span className={styles.footerBadge}>Línea Visual B</span>
          <span className={styles.footerBadge}>Municipio de Soacha</span>
          <span className={styles.footerBadge}>Atención Domiciliaria</span>
        </div>
        <p className={styles.footerText}>
          Plataforma tecnológica para la gestión, evidencia y prestación de servicios de salud en casa.
        </p>
      </footer>
    </div>
  );
}
