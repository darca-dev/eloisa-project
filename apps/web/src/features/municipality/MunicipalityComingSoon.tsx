import type { ReactNode, Ref } from 'react';

import styles from './municipality.module.css';
import {
  MUNICIPALITY_NOTA_PROXIMAMENTE,
  MUNICIPALITY_TEXTO_PROXIMAMENTE,
} from './municipalityConfig';
import type { MunicipalityModuloId } from './municipalityViews';

/**
 * Estado neutro «Próximamente» de los módulos que A-01 todavía no implementa
 * (TASK-ALCALDIA-A-01, FR-03).
 *
 * Conserva el shell, la topbar, el selector temporal y el perfil, y muestra
 * únicamente el nombre exacto del módulo y una frase clara. No adelanta
 * contenido interno: no hay formularios, tablas, indicadores, cifras ni datos
 * del módulo destino, porque ese contenido pertenece a tareas posteriores y
 * cualquier adelanto sería inventado.
 *
 * Dos módulos añaden además su límite institucional
 * (`MUNICIPALITY_NOTA_PROXIMAMENTE`), para que su sola presencia en el menú no
 * sugiera una capacidad o una autoridad que la plataforma no tiene. Esa frase
 * no implementa contenido interno del módulo.
 */

/** Identificador del título visible; nombra la región del módulo próximo. */
const TITULO_ID = 'municipality-proximamente-titulo';

export function MunicipalityComingSoon({
  moduloId,
  etiqueta,
  tituloRef,
}: {
  readonly moduloId: MunicipalityModuloId;
  /** Nombre exacto del módulo, tal como aparece en el menú aprobado. */
  readonly etiqueta: string;
  /** Referencia del encabezado principal, para el foco al cambiar de vista. */
  readonly tituloRef?: Ref<HTMLHeadingElement>;
}): ReactNode {
  const nota = MUNICIPALITY_NOTA_PROXIMAMENTE[moduloId];

  return (
    <section className={styles.comingSoon} aria-labelledby={TITULO_ID}>
      <h1 className={styles.comingSoonTitle} id={TITULO_ID} ref={tituloRef} tabIndex={-1}>
        {etiqueta}
      </h1>
      <p className={styles.comingSoonText}>{MUNICIPALITY_TEXTO_PROXIMAMENTE}</p>
      {nota === undefined ? null : <p className={styles.comingSoonNote}>{nota}</p>}
    </section>
  );
}
