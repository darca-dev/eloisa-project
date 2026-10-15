import type { ReactNode } from 'react';

import { MunicipalityIcon } from './MunicipalityIcon';
import styles from './municipality.module.css';
import type { MunicipalityIdentity, MunicipalityNavItemConfig } from './municipalityConfig';
import type { MunicipalityModuloId } from './municipalityViews';

/**
 * Sidebar de la experiencia Alcaldía (TASK-ALCALDIA-A-01, §8.2 y FR-03).
 *
 * Reproduce las líneas 24–83 de la referencia aprobada: identidad institucional
 * y el menú completo en su orden vinculante, sin omisiones ni reordenamiento.
 *
 * Los trece elementos son botones de navegación local: cambian la vista montada
 * dentro del shell. No crean rutas, no cambian la URL, no persisten y no
 * conceden permisos. Que una opción sea visible no significa que su módulo
 * exista ni que quien la ve pueda usarlo.
 *
 * El elemento activo se comunica con estilo y con `aria-current`, nunca solo
 * con color.
 */

/** Identidad institucional: marca pública, entidad territorial y bajada. */
export function MunicipalityInstitutionIdentity({
  identidad,
}: {
  readonly identidad: MunicipalityIdentity;
}): ReactNode {
  return (
    <div className={styles.identity}>
      <div className={styles.identityEyebrow}>{identidad.plataforma}</div>
      <div className={styles.identityName}>{identidad.entidad}</div>
      <div className={styles.identityMeta}>{identidad.bajada}</div>
    </div>
  );
}

/** Elemento de menú: icono decorativo, etiqueta y estado activo. */
export function MunicipalityNavItem({
  item,
  activo,
  onSeleccionar,
}: {
  readonly item: MunicipalityNavItemConfig;
  readonly activo: boolean;
  readonly onSeleccionar?: (id: MunicipalityModuloId) => void;
}): ReactNode {
  return (
    <button
      type="button"
      className={activo ? `${styles.navItem} ${styles.navItemActive}` : styles.navItem}
      aria-current={activo ? true : undefined}
      onClick={
        onSeleccionar === undefined
          ? undefined
          : () => {
              onSeleccionar(item.id);
            }
      }
    >
      <MunicipalityIcon name={item.icono} />
      {item.etiqueta}
    </button>
  );
}

export function MunicipalitySidebar({
  identidad,
  navegacion,
  itemActivoId,
  onSeleccionar,
  onConfiguracion,
}: {
  readonly identidad: MunicipalityIdentity;
  readonly navegacion: readonly MunicipalityNavItemConfig[];
  readonly itemActivoId: MunicipalityModuloId | 'configuracion';
  readonly onSeleccionar?: (id: MunicipalityModuloId) => void;
  readonly onConfiguracion?: () => void;
}): ReactNode {
  return (
    <aside className={styles.sidebar} aria-label={`Panel de ${identidad.entidad}`}>
      <MunicipalityInstitutionIdentity identidad={identidad} />
      <nav className={styles.nav} aria-label="Secciones de la experiencia Alcaldía">
        {navegacion.map((item) => (
          <MunicipalityNavItem
            key={item.id}
            item={item}
            activo={item.id === itemActivoId}
            onSeleccionar={onSeleccionar}
          />
        ))}
        {onConfiguracion ? <button type="button" className={itemActivoId === 'configuracion' ? `${styles.navItem} ${styles.navItemActive}` : styles.navItem} aria-current={itemActivoId === 'configuracion' ? true : undefined} onClick={onConfiguracion}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M12 2v4m0 12v4M2 12h4m12 0h4M5 5l3 3m8 8 3 3M5 19l3-3m8-8 3-3" /></svg>Configuración</button> : null}
      </nav>
    </aside>
  );
}
