'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

import { branding } from '@/config/branding';
import {
  CONTEXTOS_HUMANOS,
  cerrarSesionHumana,
  cierreHumanoConfirmado,
  consultarExperienciasAprobadas,
  consultarSesionHumana,
  urlDeLoginHumano,
} from '@/features/auth/humanSessionClient';
import { LiquidationsDemo } from '@/features/liquidations/LiquidationsDemo';
import {
  consultarWorklistProfesional,
  ventanaUtc,
  type ItemWorklist,
  type VentanaWorklist,
} from './professionalWorklistClient';
import styles from './profesional.module.css';

/**
 * Superficie del Profesional en Salud / Visitador (SPEC 038, MP04 §12).
 *
 * MP04 cierra `/profesional` y retira de aquí DOS cosas que no estaban
 * respaldadas por ningún servidor:
 *
 * 1. las visitas estáticas que el componente tenía en memoria (`VISITAS_INICIALES`),
 *    sustituidas por `GET /api/v1/professional/visits`, cuya lista VACÍA es la
 *    respuesta honesta de una persona sin perfil, sin afiliación vigente, sin
 *    asignación o sin citas;
 * 2. la identidad ficticia del encabezado (`Dra. Laura Gómez`, sus iniciales y
 *    su zona): una portada no puede presentar un nombre que la sesión no
 *    respalda.
 *
 * DOS COMPONENTES, UNA FRONTERA:
 *
 * - `ProfesionalPortalProtegido` es la PUERTA. Consulta la experiencia
 *   aprobada, la sesión y la worklist, y solo monta la vista cuando las tres
 *   responden. Es lo que `app/profesional/page.tsx` monta;
 * - `ProfesionalPortal` es la VISTA. Pinta lo que recibe —con una lista vacía
 *   por defecto— y no consulta nada por su cuenta: un componente de presentación
 *   no puede abrirse a sí mismo.
 *
 * QUÉ NO HACE: no guarda nada, no lee la cookie, no decide la experiencia en el
 * navegador, no filtra por sujeto y no afirma ninguna capacidad clínica. Las
 * APIs siguen siendo la autoridad: esta vista solo pinta lo que le llega.
 */

/* -------------------------------------------------------------------------- */
/* Vista                                                                       */
/* -------------------------------------------------------------------------- */

export interface ProfesionalPortalProps {
  /**
   * Worklist a pintar. Vacía por defecto: una vista sin datos no muestra nada
   * que la sesión no respalde.
   */
  readonly items?: readonly ItemWorklist[];
  /** Ventana declarada, solo para rotular la hoja de ruta. */
  readonly ventana?: VentanaWorklist;
  readonly onCerrarSesion?: () => void;
}

/** Clave de render y de selección: la cita, que es la única agenda. */
function claveDe(item: ItemWorklist): string {
  return item.appointmentId;
}

/**
 * Inicio programado como texto, SIN convertir a zona horaria.
 *
 * La agenda persiste instantes UTC y la ventana se declara en días de
 * calendario UTC; formatear con la zona del navegador desplazaría en silencio
 * qué visita cae en cada día. Se recorta el ISO tal como viene.
 */
function marcarInicio(iso: string): string {
  const [dia, hora = ''] = iso.split('T');

  return `${dia ?? ''} ${hora.slice(0, 5)}`.trim();
}

/** Estado visible de la visita. `visit: null` todavía no está materializada. */
function estadoDe(item: ItemWorklist): 'pendiente' | 'completada' {
  return item.visit?.status === 'COMPLETED' ? 'completada' : 'pendiente';
}

export function ProfesionalPortal({
  items = [],
  ventana,
  onCerrarSesion,
}: ProfesionalPortalProps): ReactNode {
  const [seccionActiva, setSeccionActiva] = useState<'visitas' | 'liquidaciones'>('visitas');
  const [seleccion, setSeleccion] = useState<string | null>(null);

  const visitas = items;
  const seleccionada = visitas.find((item) => claveDe(item) === seleccion) ?? null;

  const abrirVisitas = (): void => {
    setSeccionActiva('visitas');
    setSeleccion(null);
  };

  const abrirLiquidaciones = (): void => {
    setSeccionActiva('liquidaciones');
    setSeleccion(null);
  };

  const cerrarSeleccion = (): void => {
    setSeleccion(null);
  };

  const total = visitas.length;

  return (
    <div className={styles.profContainer}>
      {/* Topbar institucional — sin identidad nominal: la sesión no aporta una. */}
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

        {onCerrarSesion === undefined ? null : (
          <button type="button" className={styles.linkBackHospital} onClick={onCerrarSesion}>
            Cerrar sesión
          </button>
        )}
      </header>

      <main className={styles.mainContent}>
        <div className={styles.connectionBanner}>
          <span className={styles.connectionBadge}>
            🏥 Dirigido y coordinado por: <strong>Hospital Departamental San Rafael (ESE)</strong>
          </span>
          <div style={{ display: 'flex', gap: 16 }}>
            <Link href="/" className={styles.linkBackHospital}>
              ← Volver al Hub Central
            </Link>
          </div>
        </div>

        <div className={styles.turnoCard}>
          <div className={styles.turnoHeader}>
            <div>
              <h2 className={styles.turnoTitle}>Hoja de Ruta del Día</h2>
              <span style={{ fontSize: 13, color: 'var(--b-gris)' }}>
                {total === 0
                  ? 'Sin visitas asignadas en esta ventana'
                  : `${String(total)} visita${total === 1 ? '' : 's'} asignada${total === 1 ? '' : 's'} · Asignadas por Dirección Médica Hospitalaria`}
              </span>
            </div>
            {ventana === undefined ? null : (
              <span className={styles.turnoZoneBadge}>
                📅 Ventana: {ventana.from} → {ventana.to}
              </span>
            )}
          </div>

          <div className={styles.tabNav}>
            <button
              type="button"
              className={`${styles.tabButton} ${seccionActiva === 'visitas' ? styles.tabButtonActive : ''}`}
              aria-pressed={seccionActiva === 'visitas'}
              onClick={abrirVisitas}
            >
              Visitas ({String(total)})
            </button>
            <button
              type="button"
              className={`${styles.tabButton} ${seccionActiva === 'liquidaciones' ? styles.tabButtonActive : ''}`}
              aria-pressed={seccionActiva === 'liquidaciones'}
              onClick={abrirLiquidaciones}
            >
              Mis pagos y liquidaciones
            </button>
          </div>

          {seccionActiva === 'liquidaciones' ? (
            <LiquidationsDemo role="visitador" />
          ) : (
            <div className={styles.visitsList}>
              {total === 0 ? (
                <p className={styles.turnoTitle} role="status" aria-live="polite">
                  No tiene visitas asignadas en esta ventana.
                </p>
              ) : null}

              {visitas.map((item) => {
                const iniciales = item.patient.initials;
                const estado = estadoDe(item);
                const activa = seleccion === claveDe(item);

                return (
                  <div
                    key={claveDe(item)}
                    className={`${styles.visitItem} ${activa ? styles.visitActive : ''}`}
                  >
                    <div className={styles.visitPatientMeta}>
                      <div className={styles.visitAvatar}>{iniciales}</div>
                      <div className={styles.visitDetails}>
                        <span className={styles.visitPatientName}>{item.patient.displayName}</span>
                        <span className={styles.visitAddress}>
                          🕒 {marcarInicio(item.scheduledStart)}
                        </span>
                        <span style={{ fontSize: 13, color: 'var(--b-petroleo-texto)' }}>
                          {item.visit === null
                            ? 'La agenda hospitalaria aún no ha materializado la visita'
                            : `Visita ${item.visit.status.toLowerCase()}`}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span
                        className={`${styles.visitBadgeStatus} ${
                          estado === 'completada' ? styles.statusDone : styles.statusPending
                        }`}
                      >
                        {estado === 'completada' ? '✓ Atención Registrada' : '⏳ Pendiente'}
                      </span>
                      <button
                        type="button"
                        className={styles.btnBitacora}
                        onClick={() => setSeleccion(claveDe(item))}
                      >
                        {estado === 'completada' ? 'Ver Bitácora' : '📖 Abrir Bitácora'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {seccionActiva === 'visitas' && seleccionada !== null ? (
          <div className={styles.bitacoraPanel}>
            <div className={styles.bitacoraHeader}>
              <div>
                <h3 className={styles.bitacoraTitle}>
                  Detalle de la visita: {seleccionada.patient.displayName}
                </h3>
                <span style={{ fontSize: 13, color: 'var(--b-gris)' }}>
                  Esta superficie no registra notas clínicas ni evidencia: MERDN no tiene
                  aprobado ningún catálogo para ello.
                </span>
              </div>
              <button type="button" onClick={cerrarSeleccion} className={styles.linkBackHospital}>
                ✕ Cerrar
              </button>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Puerta                                                                      */
/* -------------------------------------------------------------------------- */

/** Los CINCO estados de la puerta. Mutuamente excluyentes. */
type Fase =
  | 'consultando'
  | 'sin-sesion'
  | 'sin-experiencia'
  | 'indisponible'
  | 'autorizado';

const AVISOS: Readonly<Record<Fase, string>> = {
  consultando: 'Comprobando su experiencia aprobada…',
  'sin-sesion': 'No hay una sesión abierta.',
  'sin-experiencia': 'Su cuenta no tiene acceso a esta experiencia.',
  indisponible: 'No fue posible comprobar su acceso en este momento.',
  autorizado: 'Su sesión está abierta.',
};

const VENTANA_DIAS = 7;

/** Estado del cierre. `no-confirmado` deja la sesión EN PIE y lo dice. */
type EstadoCierre = 'inactivo' | 'en-curso' | 'no-confirmado';

const CIERRE_TEXTO: Readonly<Record<EstadoCierre, string>> = {
  inactivo: '',
  'en-curso': 'Cerrando su sesión.',
  'no-confirmado':
    'No se pudo cerrar la sesión: su sesión SIGUE ABIERTA. Inténtelo de nuevo antes de dejar el dispositivo.',
};

export function ProfesionalPortalProtegido(): ReactNode {
  const [fase, setFase] = useState<Fase>('consultando');
  const [cierre, setCierre] = useState<EstadoCierre>('inactivo');
  const [items, setItems] = useState<readonly ItemWorklist[]>([]);
  const [ventana, setVentana] = useState<VentanaWorklist | undefined>(undefined);
  const bloqueRef = useRef<HTMLDivElement | null>(null);
  const vigente = useRef(true);

  useEffect(() => {
    vigente.current = true;

    return () => {
      vigente.current = false;
    };
  }, []);

  const consultar = useCallback(async (): Promise<void> => {
    setFase('consultando');

    const experiencias = await consultarExperienciasAprobadas();

    if (!vigente.current) {
      return;
    }

    if (experiencias.kind === 'sin-sesion') {
      setFase('sin-sesion');
      return;
    }

    if (experiencias.kind !== 'ok') {
      setFase('indisponible');
      return;
    }

    if (!experiencias.experiencias.includes('FIELD_PROFESSIONAL')) {
      setFase('sin-experiencia');
      return;
    }

    /*
     * El contexto `PROFESSIONAL` solo certifica perfil y afiliación; la
     * ASIGNACIÓN la resuelve el servidor dentro de la propia worklist y su
     * ausencia se pinta como lista vacía, nunca como denegación.
     */
    const sesion = await consultarSesionHumana(CONTEXTOS_HUMANOS.profesional);

    if (!vigente.current) {
      return;
    }

    if (sesion === 'sin-sesion') {
      setFase('sin-sesion');
      return;
    }

    if (sesion !== 'activa-con-contexto') {
      setFase(sesion === 'activa-sin-contexto' ? 'sin-experiencia' : 'indisponible');
      return;
    }

    const rango = ventanaUtc(VENTANA_DIAS, new Date());
    const resultado = await consultarWorklistProfesional(rango);

    if (!vigente.current) {
      return;
    }

    if (resultado.estado === 'ok') {
      setVentana(resultado.worklist.window);
      setItems(resultado.worklist.items);
      setFase('autorizado');
      return;
    }

    setFase(resultado.estado === 'sin-sesion' ? 'sin-sesion' : 'indisponible');
  }, []);

  useEffect(() => {
    void consultar();
  }, [consultar]);

  /*
   * CIERRE (§5.5). El estado pasa a `en-curso` solo mientras la llamada está
   * en vuelo y `no-confirmado` se queda en pantalla cuando el servidor no
   * confirma: esconder una sesión que sigue abierta haría creer que se cerró.
   * El desenlace confirmado retira la portada por completo.
   */
  const cerrar = useCallback(async (): Promise<void> => {
    setCierre('en-curso');

    const desenlace = await cerrarSesionHumana();

    if (cierreHumanoConfirmado(desenlace)) {
      setCierre('inactivo');
      setFase('sin-sesion');
      return;
    }

    if (desenlace !== 'cancelado') {
      setCierre('no-confirmado');
    }
  }, []);

  useEffect(() => {
    if (fase === 'sin-sesion') {
      return;
    }

    bloqueRef.current?.focus();
  }, [fase]);

  if (fase === 'autorizado') {
    return (
      <div ref={bloqueRef} tabIndex={-1}>
        <p aria-live="polite">{CIERRE_TEXTO[cierre]}</p>
        <ProfesionalPortal
          items={items}
          ventana={ventana}
          onCerrarSesion={() => void cerrar()}
        />
      </div>
    );
  }

  return (
    <main className={styles.profContainer}>
      <section className={styles.turnoCard} aria-labelledby="profesional-portal-title">
        <h2 className={styles.turnoTitle} id="profesional-portal-title">
          Portal del Profesional en Salud
        </h2>

        <p className={styles.turnoZoneBadge} aria-live="polite">
          {AVISOS[fase]}
        </p>

        {fase === 'sin-sesion' ? (
          <div ref={bloqueRef} tabIndex={-1}>
            <p>
              Entra con la referencia de tu solicitud. MERDN no guarda ni pide aquí ninguna
              contraseña: el inicio de sesión ocurre en el proveedor de identidad.
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 20 }}>
              <a className={styles.linkBackHospital} href={urlDeLoginHumano()}>
                Iniciar sesión
              </a>
              <Link className={styles.linkBackHospital} href="/acceso">
                Volver a experiencias
              </Link>
            </div>
          </div>
        ) : null}

        {fase === 'sin-experiencia' || fase === 'indisponible' ? (
          <div ref={bloqueRef} tabIndex={-1}>
            <p>
              {fase === 'sin-experiencia'
                ? 'Consulte con la institución que lo atiende si considera que debe tener acceso.'
                : 'No se muestra ningún espacio porque no hay una respuesta del servidor.'}
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 20 }}>
              {fase === 'indisponible' ? (
                <button
                  type="button"
                  className={styles.linkBackHospital}
                  onClick={() => void consultar()}
                >
                  Volver a intentar
                </button>
              ) : null}
              <Link className={styles.linkBackHospital} href="/">
                Volver al Portal Central
              </Link>
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}
