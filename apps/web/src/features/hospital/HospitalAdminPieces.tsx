import type { ReactNode } from 'react';

import styles from './hospitalAdministration.module.css';
import type {
  HospitalAdminAccion,
  HospitalAdminBloqueFuturo,
  HospitalAdminColumna,
} from './hospitalAdministrationConfig';
import { hospitalViewStyles as compartido } from './HospitalViewPieces';

/**
 * Piezas compartidas por los bloques de «Administración institucional»
 * (TASK-003H-05).
 *
 * Reúnen los tres patrones que la referencia repite en todas las pestañas
 * administrativas: la acción no implementada, el aviso de alcance y el bloque
 * de campos estructurales previstos. Todas reciben su contenido por
 * propiedades tipadas y ninguna conoce dominio, permisos ni datos de negocio.
 *
 * Alcance: presentación. Sin red, sin persistencia, sin estado global, sin
 * autorización y sin lógica clínica, financiera ni laboral.
 */

/** Tamaño de la acción según el sitio que ocupa en la referencia. */
export type AdminAccionTamano = 'normal' | 'pildora' | 'grande';

const CLASE_TAMANO: Record<AdminAccionTamano, string> = {
  normal: styles.accion,
  pildora: styles.accionPildora,
  grande: styles.accionGrande,
};

/**
 * Acción exclusivamente visual.
 *
 * Se renderiza siempre `disabled` y sin controlador: no guarda, no cobra, no
 * compra, no renueva, no abre selector de archivos, no importa, no relaciona,
 * no crea usuarios, no muta el fixture, no navega, no llama a ningún servicio y
 * no simula ningún resultado. El estado (`Próximamente` o `Demostración`) se
 * muestra junto al botón, de modo que la indisponibilidad se lee como texto y
 * no depende del color ni de la apariencia deshabilitada.
 */
export function AdminAccion({
  accion,
  tamano = 'normal',
}: {
  readonly accion: HospitalAdminAccion;
  readonly tamano?: AdminAccionTamano;
}): ReactNode {
  const variante =
    accion.variante === 'primaria' ? compartido.buttonPrimario : compartido.buttonNeutro;

  return (
    <span className={styles.accionEnvoltura}>
      <button
        type="button"
        className={`${compartido.button} ${variante} ${CLASE_TAMANO[tamano]}`}
        disabled
        /* Marcador técnico de auditoría: no es visible ni se anuncia. */
        data-hospital-accion="sin-implementar"
      >
        {accion.etiqueta}
      </button>
      <span className={styles.accionEstado}>{accion.estado}</span>
    </span>
  );
}

/**
 * Aviso de alcance. Es texto dentro del flujo del documento: queda disponible
 * para tecnologías de asistencia y nunca comunica su significado solo con
 * color.
 */
export function AdminAviso({
  atencion = false,
  titulo,
  tituloId,
  children,
}: {
  /** Variante ámbar de la referencia (prototipo, línea 767). */
  readonly atencion?: boolean;
  readonly titulo?: string;
  /** Permite que una sección use este título como nombre accesible. */
  readonly tituloId?: string;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <div className={atencion ? `${styles.aviso} ${styles.avisoAtencion}` : styles.aviso}>
      {titulo === undefined ? null : (
        <p className={styles.avisoTitulo} id={tituloId}>
          {titulo}
        </p>
      )}
      <p className={styles.avisoTexto}>{children}</p>
    </div>
  );
}

/**
 * Bloque de campos previstos para una fase aprobada.
 *
 * Cada campo nombra su dimensión y declara expresamente que todavía no tiene
 * valor. Ningún valor se inventa: el estado neutro ocupa su lugar.
 */
export function AdminCamposFuturos({
  bloque,
  tituloId,
  nivel = 'h3',
}: {
  readonly bloque: HospitalAdminBloqueFuturo;
  readonly tituloId: string;
  readonly nivel?: 'h3' | 'h4';
}): ReactNode {
  const Titulo = nivel;

  return (
    <section aria-labelledby={tituloId} className={styles.panel}>
      <Titulo className={compartido.cardTitle} id={tituloId}>
        {bloque.titulo}
      </Titulo>
      <p className={compartido.cardNote}>{bloque.descripcion}</p>
      <dl className={styles.futuros}>
        {bloque.campos.map((campo) => (
          <div className={styles.futuro} key={campo.id}>
            <dt className={styles.futuroEtiqueta}>{campo.etiqueta}</dt>
            <dd className={styles.futuroEstado}>{campo.estado}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/**
 * Contenedor de tabla administrativa.
 *
 * La tabla se desplaza horizontalmente dentro de su propio contenedor, que es
 * enfocable para que ese desplazamiento exista también con teclado: la vista
 * nunca produce desbordamiento horizontal global ni pierde columnas.
 */
export function AdminTabla({
  columnas,
  etiquetaId,
  children,
}: {
  readonly columnas: readonly HospitalAdminColumna[];
  readonly etiquetaId: string;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <div className={styles.tablaContenedor} role="region" aria-labelledby={etiquetaId} tabIndex={0}>
      <table className={styles.tabla}>
        <thead>
          <tr>
            {columnas.map((columna) => (
              <th key={columna.id} scope="col" className={styles.tablaEncabezado}>
                {columna.etiqueta}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export { styles as hospitalAdminStyles };
