'use client';

import type { ReactNode } from 'react';

import styles from './hospital.module.css';
import { HospitalDashboardAccesos } from './HospitalDashboardAccesos';
import { HospitalDashboardAcciones, HospitalDashboardAtencion } from './HospitalDashboardAtencion';
import { HospitalDashboardHeader } from './HospitalDashboardHeader';
import {
  HospitalDashboardAgendaProxima,
  HospitalDashboardAlarmasRecientes,
  HospitalDashboardProfesionales,
  HospitalDashboardSemaforo,
} from './HospitalDashboardResumenes';
import { HospitalKpiCard } from './HospitalKpiCard';
import { hospitalAlertsDemo } from './hospitalAlertsConfig';
import { hospitalDashboardDemo } from './hospitalDashboardConfig';
import type { HospitalDashboardConfig, HospitalInicioConfig } from './hospitalDashboardConfig';
import { hospitalInicioDemo } from './hospitalDashboardOperacion';
import type { HospitalDestino } from './hospitalViews';

/**
 * Vista `Inicio` del Hospital: centro de control operativo
 * (TASK-003H-02, FR-01 y FR-02; TASK-003H-02B, FR-01 a FR-11).
 *
 * Inicio responde dos preguntas desde la primera pantalla: qué necesita
 * atención ahora y a dónde entrar. Por eso el orden perceptual es KPI
 * compactos, `Necesita atención ahora`, `Acciones rápidas`, los resúmenes de
 * agenda, alarmas y profesionales, y por último `Ir a`.
 *
 * Inicio es un acelerador de navegación y lectura: no duplica la lógica
 * funcional de los módulos destino, no filtra, no recalcula totales, no crea
 * registros y no consulta nada. Cada control cambia únicamente la vista local
 * del shell y, cuando corresponde, transporta una intención de lectura
 * efímera. Sin controlador de navegación la pantalla sigue siendo legible: solo
 * deja de ser interactiva.
 *
 * Todo el contenido llega por configuración tipada (`hospitalDashboardConfig`)
 * compuesta con selectores puros sobre los fixtures Hospital existentes
 * (`hospitalDashboardOperacion`). Ningún dato operativo vive dentro del JSX.
 *
 * Sin red, sin backend, sin persistencia, sin autenticación y sin permisos: la
 * autorización real deberá aplicarse en servidor y capa de datos cuando estos
 * fixtures se sustituyan por consultas institucionales.
 */

/** Identificador del título visible; nombra la región de Inicio. */
const TITULO_ID = 'hospital-dashboard-titulo';

/** Identificadores de los títulos de sección, para nombrar cada región. */
const SECCION_ID = {
  kpis: 'hospital-inicio-kpis',
  atencion: 'hospital-inicio-atencion',
  acciones: 'hospital-inicio-acciones',
  agenda: 'hospital-inicio-agenda',
  semaforo: 'hospital-inicio-semaforo',
  alarmas: 'hospital-inicio-alarmas',
  profesionales: 'hospital-inicio-profesionales',
  accesos: 'hospital-inicio-accesos',
} as const;

/** Navegación inerte: Inicio se renderiza igual cuando el shell no la aporta. */
function sinNavegacion(): void {
  /* Sin controlador el centro de control solo se lee; ningún control actúa. */
}

/**
 * Fecha del encabezado operativo, fljo y proveniente de la configuración.
 *
 * La fecha visible es el valor de presentación que autoriza la configuración
 * (spec 026/032), no una lectura del reloj del navegador: la frontera de la
 * spec 010 deja la fecha del sistema bajo control del reloj inyectable de
 * Agenda, y ninguna otra surface la consulta.
 */
export function HospitalDashboard({
  config = hospitalDashboardDemo,
  inicio = hospitalInicioDemo,
  onNavegar = sinNavegacion,
}: {
  readonly config?: HospitalDashboardConfig;
  readonly inicio?: HospitalInicioConfig;
  /** Navegación local del shell; nunca crea rutas ni cambia la URL. */
  readonly onNavegar?: (destino: HospitalDestino) => void;
}): ReactNode {
  const encabezado = config.encabezado;

  return (
    <section className={styles.dashboard} aria-labelledby={TITULO_ID}>
      <HospitalDashboardHeader encabezado={encabezado} tituloId={TITULO_ID} />

      <section className={styles.kpiSeccion} aria-labelledby={SECCION_ID.kpis}>
        <h2 className="merdn-sr-only" id={SECCION_ID.kpis}>
          Indicadores operativos de hoy
        </h2>
        <ul className={styles.kpiGrid}>
          {config.kpis.map((kpi) => (
            <HospitalKpiCard key={kpi.id} kpi={kpi} onNavegar={onNavegar} />
          ))}
        </ul>
      </section>

      <div className={styles.inicioPrincipal}>
        <HospitalDashboardAgendaProxima
          seccion={inicio.agenda}
          tituloId={SECCION_ID.agenda}
          onNavegar={onNavegar}
        />
        <div className={styles.inicioColumnaLateral}>
          <HospitalDashboardSemaforo
            resumen={hospitalAlertsDemo.resumen}
            tituloId={SECCION_ID.semaforo}
            onNavegar={onNavegar}
          />
          <HospitalDashboardAcciones
            seccion={inicio.acciones}
            tituloId={SECCION_ID.acciones}
            onNavegar={onNavegar}
          />
        </div>
      </div>

      <HospitalDashboardAlarmasRecientes
        seccion={inicio.alarmas}
        tituloId={SECCION_ID.alarmas}
        onNavegar={onNavegar}
      />

      <div className={styles.inicioSeguimiento}>
        <HospitalDashboardAtencion
          seccion={inicio.atencion}
          tituloId={SECCION_ID.atencion}
          onNavegar={onNavegar}
        />
        <HospitalDashboardProfesionales
          seccion={inicio.profesionales}
          tituloId={SECCION_ID.profesionales}
          onNavegar={onNavegar}
        />
      </div>

      <HospitalDashboardAccesos
        seccion={inicio.accesos}
        tituloId={SECCION_ID.accesos}
        textoNoDisponible={inicio.textoNoDisponible}
        onNavegar={onNavegar}
      />
    </section>
  );
}
