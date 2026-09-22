'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';

import { branding } from '@/config/branding';
import { LiquidationsDemo } from '@/features/liquidations/LiquidationsDemo';
import styles from './profesional.module.css';

interface VisitaAsignada {
  id: string;
  paciente: string;
  edad: number;
  direccion: string;
  comuna: string;
  hora: string;
  motivo: string;
  estado: 'pendiente' | 'en_camino' | 'completada';
}

const VISITAS_INICIALES: VisitaAsignada[] = [
  {
    id: 'VIS-001',
    paciente: 'Mercedes Roa de Rincón',
    edad: 78,
    direccion: 'Calle 14 # 8-32, San Mateo',
    comuna: 'Comuna 5 - San Mateo',
    hora: '09:00 AM',
    motivo: 'Control Hipertensión y seguimiento de curación',
    estado: 'pendiente',
  },
  {
    id: 'VIS-002',
    paciente: 'Pedro Nel Gómez',
    edad: 64,
    direccion: 'Carrera 4 Este # 22-10, Cazucá',
    comuna: 'Comuna 4 - Cazucá',
    hora: '10:30 AM',
    motivo: 'Evaluación de movilidad y adherencia medicamentosa',
    estado: 'pendiente',
  },
  {
    id: 'VIS-003',
    paciente: 'Ana María Torres',
    edad: 82,
    direccion: 'Transversal 7 # 19-45, León XIII',
    comuna: 'Comuna 3 - La Despensa',
    hora: '12:00 PM',
    motivo: 'Monitoreo de dolor crónico y signos vitales',
    estado: 'pendiente',
  },
];

export function ProfesionalPortal(): ReactNode {
  const [visitas, setVisitas] = useState<VisitaAsignada[]>(VISITAS_INICIALES);
  const [seccionActiva, setSeccionActiva] = useState<'visitas' | 'liquidaciones'>('visitas');
  const [visitaSeleccionada, setVisitaSeleccionada] = useState<VisitaAsignada | null>(null);
  const [presion, setPresion] = useState('120/80');
  const [pulso, setPulso] = useState('72');
  const [observacion, setObservacion] = useState('');
  const [guardadoExitoso, setGuardadoExitoso] = useState(false);

  const handleAbrirBitacora = (v: VisitaAsignada): void => {
    setVisitaSeleccionada(v);
    setGuardadoExitoso(false);
    setObservacion('');
  };

  const handleAbrirLiquidaciones = (): void => {
    setSeccionActiva('liquidaciones');
    setVisitaSeleccionada(null);
  };

  const handleAbrirVisitas = (): void => {
    setSeccionActiva('visitas');
  };

  const handleGuardarBitacora = (e: React.FormEvent): void => {
    e.preventDefault();
    if (!visitaSeleccionada) return;

    setVisitas((prev) =>
      prev.map((item) =>
        item.id === visitaSeleccionada.id ? { ...item, estado: 'completada' } : item,
      ),
    );
    setGuardadoExitoso(true);
    setTimeout(() => {
      setVisitaSeleccionada(null);
      setGuardadoExitoso(false);
    }, 2000);
  };

  return (
    <div className={styles.profContainer}>
      {/* Topbar institucional */}
      <header className={styles.topBar}>
        <div className={styles.profHeaderBrand}>
          <Image
            src="/brand/corazon-check.png"
            alt={`Símbolo oficial de ${branding.platformDisplayName}`}
            width={36}
            height={36}
            className={styles.profLogo}
          />
          <div className={styles.profTitleBlock}>
            <span className={styles.profPlatformName}>{branding.platformDisplayName}</span>
            <span className={styles.profAppTitle}>Portal del Profesional en Salud</span>
          </div>
        </div>

        <div className={styles.profProfileBox}>
          <div className={styles.profAvatar}>LG</div>
          <div className={styles.profNameBlock}>
            <span className={styles.profName}>Dra. Laura Gómez</span>
            <span className={styles.profRole}>Medicina General · Hospital San Rafael (ESE)</span>
          </div>
        </div>
      </header>

      {/* Contenido */}
      <main className={styles.mainContent}>
        {/* Banner de conexión con el Hospital */}
        <div className={styles.connectionBanner}>
          <span className={styles.connectionBadge}>
            🏥 Dirigido y coordinado por: <strong>Hospital Departamental San Rafael (ESE)</strong>
          </span>
          <div style={{ display: 'flex', gap: 16 }}>
            <Link href="/" className={styles.linkBackHospital}>
              ← Volver al Hub Central
            </Link>
            <Link href="/hospital" className={styles.linkBackHospital}>
              Ir al Sistema Hospitalario →
            </Link>
          </div>
        </div>

        {/* Resumen del turno del día */}
        <div className={styles.turnoCard}>
          <div className={styles.turnoHeader}>
            <div>
              <h2 className={styles.turnoTitle}>Hoja de Ruta del Día</h2>
              <span style={{ fontSize: 13, color: 'var(--b-gris)' }}>
                3 visitas programadas · Asignadas por Dirección Médica Hospitalaria
              </span>
            </div>
            <span className={styles.turnoZoneBadge}>📍 Zona: Soacha · Comunas 3, 4 y 5</span>
          </div>

          <div className={styles.tabNav}>
            <button
              type="button"
              className={`${styles.tabButton} ${seccionActiva === 'visitas' ? styles.tabButtonActive : ''}`}
              aria-pressed={seccionActiva === 'visitas'}
              onClick={handleAbrirVisitas}
            >
              Visitas de Hoy (3)
            </button>
            <button type="button" className={styles.tabButton}>
              Historial de Atenciones
            </button>
            <button type="button" className={styles.tabButton}>
              Protocolos Clínicos
            </button>
            <button
              type="button"
              className={`${styles.tabButton} ${seccionActiva === 'liquidaciones' ? styles.tabButtonActive : ''}`}
              aria-pressed={seccionActiva === 'liquidaciones'}
              onClick={handleAbrirLiquidaciones}
            >
              Mis pagos y liquidaciones
            </button>
          </div>
          {seccionActiva === 'liquidaciones' ? (
            <LiquidationsDemo role="visitador" />
          ) : (
            <>
              {/* Listado de visitas asignadas */}
              <div className={styles.visitsList}>
            {visitas.map((v) => {
              const iniciales = v.paciente
                .split(' ')
                .map((n) => n[0])
                .slice(0, 2)
                .join('');
              const isSelected = visitaSeleccionada?.id === v.id;

              return (
                <div
                  key={v.id}
                  className={`${styles.visitItem} ${isSelected ? styles.visitActive : ''}`}
                >
                  <div className={styles.visitPatientMeta}>
                    <div className={styles.visitAvatar}>{iniciales}</div>
                    <div className={styles.visitDetails}>
                      <span className={styles.visitPatientName}>
                        {v.paciente} ({v.edad} años)
                      </span>
                      <span className={styles.visitAddress}>
                        📍 {v.direccion} — {v.comuna}
                      </span>
                      <span style={{ fontSize: 13, color: 'var(--b-petroleo-texto)' }}>
                        🕒 {v.hora} · {v.motivo}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span
                      className={`${styles.visitBadgeStatus} ${
                        v.estado === 'completada' ? styles.statusDone : styles.statusPending
                      }`}
                    >
                      {v.estado === 'completada' ? '✓ Atención Registrada' : '⏳ Pendiente'}
                    </span>
                    <button
                      type="button"
                      className={styles.btnBitacora}
                      onClick={() => handleAbrirBitacora(v)}
                    >
                      {v.estado === 'completada' ? 'Ver Bitácora' : '📖 Abrir Bitácora'}
                    </button>
                  </div>
                </div>
              );
                })}
              </div>
            </>
          )}
        </div>

        {/* Panel de registro en la bitácora del paciente */}
        {seccionActiva === 'visitas' && visitaSeleccionada && (
          <div className={styles.bitacoraPanel}>
            <div className={styles.bitacoraHeader}>
              <div>
                <h3 className={styles.bitacoraTitle}>
                  Registro Clínico en Bitácora: {visitaSeleccionada.paciente}
                </h3>
                <span style={{ fontSize: 13, color: 'var(--b-gris)' }}>
                  Los datos se sincronizan directamente con el expediente hospitalario y la bitácora familiar.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setVisitaSeleccionada(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: 20,
                  cursor: 'pointer',
                  color: 'var(--b-gris)',
                }}
              >
                ✕
              </button>
            </div>

            {guardadoExitoso ? (
              <div
                style={{
                  background: '#d1fae5',
                  color: '#065f46',
                  padding: 16,
                  borderRadius: 12,
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span>✓</span> Evolución registrada exitosamente en la Bitácora del Paciente y sincronizada con el Hospital.
              </div>
            ) : (
              <form onSubmit={handleGuardarBitacora} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className={styles.bitacoraForm}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Presión Arterial (mmHg)</label>
                    <input
                      type="text"
                      className={styles.formInput}
                      value={presion}
                      onChange={(e) => setPresion(e.target.value)}
                      placeholder="120/80"
                      required
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Frecuencia Cardíaca (lpm)</label>
                    <input
                      type="text"
                      className={styles.formInput}
                      value={pulso}
                      onChange={(e) => setPulso(e.target.value)}
                      placeholder="72"
                      required
                    />
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>
                    Evolución Clínica y Observaciones en Domicilio
                  </label>
                  <textarea
                    className={styles.formTextarea}
                    rows={3}
                    value={observacion}
                    onChange={(e) => setObservacion(e.target.value)}
                    placeholder="Paciente consciente, orientado. Se verifica toma de medicamentos indicada por el Hospital..."
                    required
                  />
                </div>

                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => setVisitaSeleccionada(null)}
                    style={{
                      background: '#f1f5f9',
                      border: '1px solid #cbd5e1',
                      padding: '10px 18px',
                      borderRadius: 10,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Cancelar
                  </button>
                  <button type="submit" className={styles.btnBitacora} style={{ padding: '10px 22px' }}>
                    Guardar y Sincronizar con Hospital →
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
