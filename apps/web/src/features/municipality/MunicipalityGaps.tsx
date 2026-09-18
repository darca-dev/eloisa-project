import type { ReactNode, Ref } from 'react';

import styles from './municipality.module.css';
import { municipalityDemo } from './municipalityConfig';
import type {
  MunicipalityBrechasConfig,
  MunicipalityConfig,
  MunicipalityDemoAviso,
  MunicipalityTono,
} from './municipalityConfig';

/**
 * Vista «¿Qué nos falta atender?» de la experiencia Alcaldía
 * (TASK-ALCALDIA-DEMO-FINAL, §11).
 *
 * Reproduce las líneas 585–602 de la referencia aprobada
 * `prototype-claude/Eligeme-Alcaldia.dc.html`: una lista de nueve brechas con
 * su valor, su título, su detalle y su prioridad escrita.
 *
 * Naturaleza de las brechas: son pendientes administrativos y documentales de
 * gestión municipal, siempre agregados. No son una valoración de salud, no
 * clasifican a ninguna persona, no ordenan atención y no orientan ninguna
 * decisión asistencial. La prioridad `PRIORITARIO` o `SEGUIMIENTO` indica qué
 * trabajo administrativo conviene atender antes y se escribe además del color:
 * ningún estado se comunica solo con color.
 *
 * Procedencia: todos los valores son fixture local de diseño. Cuando una brecha
 * representa un dato ya declarado por otra pantalla —el saldo disponible del
 * presupuesto, las actividades sin soporte o las personas sin vincular— la
 * configuración cita ese concepto y no lo recalcula aquí.
 *
 * Privacidad municipal: no hay personas, listados, documentos, ubicación exacta
 * ni exportación. Cada brecha es un conteo agregado.
 */

/** Clase de acento por tono. El tono acompaña al texto y nunca lo sustituye. */
const CLASE_TONO: Record<MunicipalityTono, string> = {
  azul: styles.tonoAzul,
  teal: styles.tonoTeal,
  verde: styles.tonoVerde,
  amarillo: styles.tonoAmarillo,
  rojo: styles.tonoRojo,
};

/** Identificadores de los títulos que nombran cada región de la vista. */
const SECCION_ID = {
  titulo: 'municipality-brechas-titulo',
  lista: 'municipality-brechas-lista',
} as const;

/** Encabezado de la vista, con la etiqueta que la identifica como demostrativa. */
function MunicipalityGapsHead({
  brechas,
  demo,
  tituloRef,
}: {
  readonly brechas: MunicipalityBrechasConfig;
  readonly demo: MunicipalityDemoAviso;
  readonly tituloRef?: Ref<HTMLHeadingElement>;
}): ReactNode {
  return (
    <div className={styles.viewHead}>
      <div className={styles.viewHeadRow}>
        <h1 className={styles.viewTitle} id={SECCION_ID.titulo} ref={tituloRef} tabIndex={-1}>
          {brechas.titulo}
        </h1>
        <p className={styles.demoTag}>{demo.etiqueta}</p>
      </div>
      <p className={styles.viewDescription}>{brechas.descripcion}</p>
      <ul className={styles.limitList}>
        {brechas.limites.map((limite) => (
          <li className={styles.limitItem} key={limite}>
            {limite}
          </li>
        ))}
      </ul>
      <p className={styles.viewNote}>{demo.aclaracion}</p>
    </div>
  );
}

export function MunicipalityGaps({
  config = municipalityDemo,
  tituloRef,
}: {
  readonly config?: MunicipalityConfig;
  /** Referencia del encabezado principal, para el foco al cambiar de vista. */
  readonly tituloRef?: Ref<HTMLHeadingElement>;
}): ReactNode {
  const { brechas, demo } = config;

  return (
    <div className={styles.view}>
      <MunicipalityGapsHead brechas={brechas} demo={demo} tituloRef={tituloRef} />
      <section aria-labelledby={SECCION_ID.titulo} className={styles.view}>
        <h2 className="merdn-sr-only" id={SECCION_ID.lista}>
          {brechas.listaResumen}
        </h2>
        <ul aria-labelledby={SECCION_ID.lista} className={styles.gapList}>
          {brechas.brechas.map((brecha) => (
            <li className={`${styles.gapItem} ${CLASE_TONO[brecha.tono]}`} key={brecha.id}>
              <span className={styles.gapValue}>{brecha.valor}</span>
              <span className={styles.gapText}>
                <span className={styles.gapTitle}>{brecha.titulo}</span>
                <span className={styles.gapDetail}>{brecha.detalle}</span>
              </span>
              {/* La prioridad se escribe siempre: el color solo la acompaña. */}
              <span className={styles.gapState}>{brechas.estados[brecha.estado]}</span>
            </li>
          ))}
        </ul>
        <p className={styles.highlight}>{brechas.notaAdministrativa}</p>
      </section>
    </div>
  );
}
