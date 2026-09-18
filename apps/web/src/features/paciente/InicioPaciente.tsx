import type { ReactNode } from 'react';

import { Icon } from '@/components/ui/Icon';
import type { IconName } from '@/components/ui/Icon';
import { BrandHeader, DeviceStatusBar, Screen } from '@/components/ui/PhoneShell';

import styles from './paciente.module.css';

/**
 * Inicio del Paciente (TASK-002A, FR-07 y FR-08).
 *
 * Conserva las tarjetas y funciones aprobadas en TASK-002 y corrige dos cosas:
 * los cuadrados de color pasan a ser iconos semánticos reales, y la IA deja de
 * ser una tarjeta de la cuadrícula: aparece solo como burbuja flotante, que
 * monta la experiencia contenedora.
 *
 * Ninguna tarjeta abre un módulo productivo: son superficies demostrativas
 * marcadas como inertes. La única acción con efecto es abrir la bitácora.
 */

interface Tarjeta {
  readonly id: string;
  readonly titulo: string;
  readonly cuerpo: string;
  readonly icono: IconName;
  readonly tono: string;
  readonly redondo: boolean;
}

const TARJETAS: readonly Tarjeta[] = [
  {
    id: 'citas',
    titulo: 'MIS CITAS',
    cuerpo: 'Ver, agendar o cancelar citas',
    icono: 'cita',
    tono: styles.tileAzul,
    redondo: false,
  },
  {
    id: 'ayuda',
    titulo: 'PEDIR AYUDA',
    cuerpo: 'Necesito atención urgente',
    icono: 'ayuda',
    tono: styles.tileRojo,
    redondo: true,
  },
  {
    id: 'salud',
    titulo: 'MI SALUD',
    cuerpo: 'Ver mi historia clínica',
    icono: 'salud',
    tono: styles.tileVerde,
    redondo: false,
  },
  {
    id: 'cuidador',
    titulo: 'MI CUIDADOR',
    cuerpo: 'Ver información de mi cuidador',
    icono: 'cuidador',
    tono: styles.tilePetroleo,
    redondo: false,
  },
  {
    id: 'pagos',
    titulo: 'MIS PAGOS',
    cuerpo: 'Membresía, pagos y comprobantes',
    icono: 'pago',
    tono: styles.tileNeutro,
    redondo: false,
  },
];

const ACCESOS: readonly {
  readonly id: string;
  readonly etiqueta: readonly string[];
  readonly icono: IconName;
  readonly tono?: string;
}[] = [
  { id: 'consulta', etiqueta: ['Consulta', 'Virtual'], icono: 'consultaVirtual' },
  {
    id: 'visita',
    etiqueta: ['Visita', 'en Casa'],
    icono: 'visitaCasa',
    tono: styles.quickIconVerde,
  },
  {
    id: 'hospital',
    etiqueta: ['Ir al', 'Hospital'],
    icono: 'hospital',
    tono: styles.quickIconRojo,
  },
  {
    id: 'mensajes',
    etiqueta: ['Mensajes'],
    icono: 'mensajes',
    tono: styles.quickIconPetroleo,
  },
];

const PESTANAS: readonly {
  readonly id: string;
  readonly etiqueta: string;
  readonly icono: IconName;
  readonly tipo: 'activa' | 'inactiva' | 'accion';
}[] = [
  { id: 'inicio', etiqueta: 'Inicio', icono: 'inicio', tipo: 'activa' },
  { id: 'citas', etiqueta: 'Citas', icono: 'cita', tipo: 'inactiva' },
  { id: 'ayuda', etiqueta: 'Ayuda', icono: 'ayuda', tipo: 'accion' },
  { id: 'mensajes', etiqueta: 'Mensajes', icono: 'mensajes', tipo: 'inactiva' },
  { id: 'perfil', etiqueta: 'Perfil', icono: 'perfil', tipo: 'inactiva' },
];

interface InicioPacienteProps {
  readonly nombre: string;
  readonly iniciales: string;
  readonly avisoId: string;
  readonly onAbrirBitacora: () => void;
}

export function InicioPaciente({
  nombre,
  iniciales,
  avisoId,
  onAbrirBitacora,
}: InicioPacienteProps): ReactNode {
  return (
    <Screen tone="lienzo">
      <DeviceStatusBar tone="marca" />
      <BrandHeader
        menuLabel="Abrir el menú"
        notificationsLabel="Ver novedades"
        profileLabel="Abrir mi perfil"
        initials={iniciales}
        describedBy={avisoId}
      />

      <div className={styles.scroll}>
        <div className={styles.greeting}>
          <div>
            <h1 className={styles.greetingTitle}>{`¡Hola, ${nombre}!`}</h1>
            <p className={styles.greetingBody}>¿Qué desea hacer hoy?</p>
          </div>
        </div>

        <button type="button" className={styles.diaryAccess} onClick={onAbrirBitacora}>
          <span aria-hidden="true" className={styles.diaryIcon}>
            <span className={styles.tileIconInner}>
              <Icon name="bitacora" />
            </span>
          </span>
          <span className={styles.diaryTexts}>
            <span className={styles.diaryEyebrow}>LO MÁS IMPORTANTE DE HOY</span>
            <span className={styles.diaryTitle}>Mi bitácora</span>
            <span className={styles.diaryBody}>
              Ocho preguntas sencillas sobre cómo pasó el día.
            </span>
          </span>
        </button>

        <ul className={styles.tiles}>
          {TARJETAS.map((tarjeta) => (
            <li key={tarjeta.id}>
              <button
                type="button"
                className={`${styles.tile} ${tarjeta.tono}`}
                aria-disabled="true"
                aria-describedby={avisoId}
              >
                <span
                  aria-hidden="true"
                  className={
                    tarjeta.redondo
                      ? `${styles.tileIcon} ${styles.tileIconRound}`
                      : styles.tileIcon
                  }
                >
                  <span className={styles.tileIconInner}>
                    <Icon name={tarjeta.icono} />
                  </span>
                </span>
                <span className={styles.tileTitle}>{tarjeta.titulo}</span>
                <span className={styles.tileBody}>{tarjeta.cuerpo}</span>
              </button>
            </li>
          ))}
        </ul>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Accesos rápidos</h2>
          <ul className={styles.quickList}>
            {ACCESOS.map((acceso) => (
              <li key={acceso.id}>
                <button
                  type="button"
                  className={styles.quick}
                  aria-disabled="true"
                  aria-describedby={avisoId}
                >
                  <span
                    aria-hidden="true"
                    className={
                      acceso.tono === undefined
                        ? styles.quickIcon
                        : `${styles.quickIcon} ${acceso.tono}`
                    }
                  >
                    <Icon name={acceso.icono} />
                  </span>
                  <span className={styles.quickLabel}>
                    {acceso.etiqueta.map((linea, indice) => (
                      <span key={linea}>
                        {indice > 0 ? <br /> : null}
                        {linea}
                      </span>
                    ))}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <nav className={styles.tabNav} aria-label="Navegación principal del inicio">
        <ul className={styles.tabBar}>
          {PESTANAS.map((pestana) => {
            const clases = [styles.tab];
            if (pestana.tipo === 'activa') {
              clases.push(styles.tabActive);
            } else if (pestana.tipo === 'accion') {
              clases.push(styles.tabAction);
            }

            const etiquetaClases = [styles.tabLabel];
            if (pestana.tipo === 'activa') {
              etiquetaClases.push(styles.tabLabelActive);
            } else if (pestana.tipo === 'accion') {
              etiquetaClases.push(styles.tabLabelAction);
            }

            return (
              <li key={pestana.id}>
                <button
                  type="button"
                  className={clases.join(' ')}
                  aria-current={pestana.tipo === 'activa' ? 'page' : undefined}
                  aria-disabled="true"
                  aria-describedby={avisoId}
                >
                  {pestana.tipo === 'accion' ? (
                    <span aria-hidden="true" className={styles.tabIconAction}>
                      <Icon name={pestana.icono} size="lg" />
                    </span>
                  ) : (
                    <Icon name={pestana.icono} />
                  )}
                  <span className={etiquetaClases.join(' ')}>{pestana.etiqueta}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </Screen>
  );
}
