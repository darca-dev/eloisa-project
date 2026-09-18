import type { ReactNode } from 'react';

import styles from './municipality.module.css';
import type {
  MunicipalityDemoAviso,
  MunicipalityPeriodoConfig,
  MunicipalityProfile,
} from './municipalityConfig';
import type { MunicipalityPeriodoId } from './municipalityViews';

/**
 * Topbar de la experiencia Alcaldía (TASK-ALCALDIA-A-01, §8.3 y FR-02).
 *
 * Reproduce las líneas 85–101 de la referencia aprobada: encabezado del panel,
 * aviso de privacidad municipal, selector temporal y perfil institucional. No
 * se añade buscador, campana, usuario nominal ni menú de cuenta: ninguno
 * aparece en la referencia.
 */

/** Identificador del grupo del selector, para nombrarlo sin texto visible extra. */
const PERIODOS_ID = 'municipality-periodos';

/** Identificador de la nota del selector, referenciada por el grupo. */
const PERIODOS_NOTA_ID = 'municipality-periodos-nota';

/**
 * Selector temporal local (FR-02).
 *
 * Los cinco periodos son botones agrupados y mutuamente excluyentes. El estado
 * seleccionado se anuncia con `aria-pressed`, no solo con color. La selección
 * es efímera: no recalcula ningún valor, no consulta ninguna fuente, no viaja
 * por URL y no persiste. `Personalizado` solo puede quedar seleccionado: no
 * abre calendario, formulario ni modal.
 */
export function MunicipalityPeriodSelector({
  periodos,
  periodoActivoId,
  nota,
  onSeleccionar,
}: {
  readonly periodos: readonly MunicipalityPeriodoConfig[];
  readonly periodoActivoId: MunicipalityPeriodoId;
  readonly nota: string;
  readonly onSeleccionar?: (id: MunicipalityPeriodoId) => void;
}): ReactNode {
  return (
    <div className={styles.periodBlock}>
      <div
        className={styles.periods}
        role="group"
        aria-labelledby={PERIODOS_ID}
        aria-describedby={PERIODOS_NOTA_ID}
      >
        <span className="merdn-sr-only" id={PERIODOS_ID}>
          Periodo de consulta
        </span>
        {periodos.map((periodo) => {
          const activo = periodo.id === periodoActivoId;

          return (
            <button
              key={periodo.id}
              type="button"
              className={activo ? `${styles.period} ${styles.periodActive}` : styles.period}
              aria-pressed={activo}
              onClick={
                onSeleccionar === undefined
                  ? undefined
                  : () => {
                      onSeleccionar(periodo.id);
                    }
              }
            >
              {periodo.etiqueta}
            </button>
          );
        })}
      </div>
      <p className={styles.periodNote} id={PERIODOS_NOTA_ID}>
        {nota}
      </p>
    </div>
  );
}

/**
 * Perfil institucional de la sesión: iniciales, entidad y tipo de consulta.
 *
 * Es identidad, no acción: no es un enlace ni un control para conectarse con la
 * secretaría, no abre menú de cuenta y no concede ninguna capacidad. Por eso no
 * se implementa como control interactivo.
 */
export function MunicipalityProfileBadge({
  perfil,
}: {
  readonly perfil: MunicipalityProfile;
}): ReactNode {
  return (
    <div className={styles.profile}>
      <span className={styles.profileAvatar} aria-hidden="true">
        {perfil.iniciales}
      </span>
      <span className={styles.profileText}>
        <span className={styles.profileName}>{perfil.nombre}</span>
        <span className={styles.profileRole}>{perfil.perfil}</span>
      </span>
    </div>
  );
}

export function MunicipalityTopbar({
  encabezado,
  avisoPrivacidad,
  periodos,
  periodoActivoId,
  perfil,
  demo,
  onSeleccionarPeriodo,
}: {
  readonly encabezado: string;
  readonly avisoPrivacidad: string;
  readonly periodos: readonly MunicipalityPeriodoConfig[];
  readonly periodoActivoId: MunicipalityPeriodoId;
  readonly perfil: MunicipalityProfile;
  readonly demo: MunicipalityDemoAviso;
  readonly onSeleccionarPeriodo?: (id: MunicipalityPeriodoId) => void;
}): ReactNode {
  return (
    <header className={styles.topbar} aria-label="Encabezado del panel municipal">
      <div className={styles.topbarHeadings}>
        <p className={styles.topbarEyebrow}>{encabezado}</p>
        <p className={styles.topbarPrivacy}>{avisoPrivacidad}</p>
      </div>
      <MunicipalityPeriodSelector
        periodos={periodos}
        periodoActivoId={periodoActivoId}
        nota={demo.notaPeriodo}
        onSeleccionar={onSeleccionarPeriodo}
      />
      <MunicipalityProfileBadge perfil={perfil} />
    </header>
  );
}
