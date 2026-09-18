import type { CSSProperties, ReactNode, Ref } from 'react';

import styles from './hospitalViews.module.css';
import type { HospitalVistaEncabezado } from './hospitalAgendaConfig';
import type { HospitalPacienteDato } from './hospitalPatientsConfig';
import { HOSPITAL_TONOS } from './hospitalTonos';
import type { HospitalTonoId } from './hospitalTonos';

/**
 * Piezas compartidas por las vistas de operación Hospital (TASK-003H-03, FR-05).
 *
 * Reúnen los patrones que la referencia repite en Agenda, Pacientes y Alarmas:
 * encabezado de vista, tarjeta, pastilla de estado, campo clave/valor y nota
 * explicativa. Todas reciben su contenido por propiedades tipadas; ninguna
 * conoce dominios, reglas, permisos ni datos de negocio.
 *
 * Alcance: presentación. Sin red, sin persistencia, sin estado global y sin
 * lógica clínica.
 */

/** Une clases opcionales sin dependencias externas. */
function clases(...valores: readonly (string | undefined | false)[]): string {
  return valores.filter((valor): valor is string => typeof valor === 'string').join(' ');
}

/** Expone la terna de color de un tono como propiedades personalizadas CSS. */
export function tonoVars(tono: HospitalTonoId): CSSProperties {
  const { texto, fondo, borde } = HOSPITAL_TONOS[tono];

  return {
    '--h-tono-texto': texto,
    '--h-tono-fondo': fondo,
    '--h-tono-borde': borde,
  } as CSSProperties;
}

/**
 * Encabezado de la vista: título visible (`h1`) y párrafo explicativo.
 *
 * Cada vista monta exactamente uno, de modo que el área principal conserva un
 * único encabezado de nivel 1 dentro del único `<main>` del shell.
 */
export function HospitalViewHeader({
  encabezado,
  tituloId,
}: {
  readonly encabezado: HospitalVistaEncabezado;
  readonly tituloId: string;
}): ReactNode {
  return (
    <div className={styles.viewHeader}>
      <h1 className={styles.viewTitle} id={tituloId}>
        {encabezado.titulo}
      </h1>
      <p className={styles.viewIntro}>{encabezado.descripcion}</p>
    </div>
  );
}

/** Tarjeta blanca del prototipo. `gap` reproduce la separación de cada bloque. */
export function HospitalCard({
  gap = 14,
  className,
  style,
  children,
  ...resto
}: {
  readonly gap?: number;
  readonly className?: string;
  readonly style?: CSSProperties;
  readonly children: ReactNode;
  /** Destino de `aria-controls` cuando otra acción muestra u oculta la tarjeta. */
  readonly id?: string;
  readonly 'aria-labelledby'?: string;
  readonly 'aria-label'?: string;
  /** Permite enfocar la tarjeta por programa; nunca la inserta en el tabulador. */
  readonly tabIndex?: -1;
  readonly ref?: Ref<HTMLElement>;
}): ReactNode {
  return (
    <section
      className={clases(styles.card, className)}
      style={{ ...style, '--h-card-gap': `${gap}px` } as CSSProperties}
      {...resto}
    >
      {children}
    </section>
  );
}

/** Cabecera de tarjeta: título (`h2`) y, cuando existe, la nota de la derecha. */
export function HospitalCardHeader({
  titulo,
  tituloId,
  nota,
  extra,
}: {
  readonly titulo: string;
  readonly tituloId?: string;
  readonly nota?: string;
  readonly extra?: ReactNode;
}): ReactNode {
  return (
    <div className={styles.cardHead}>
      <h2 className={styles.cardTitle} id={tituloId}>
        {titulo}
      </h2>
      {nota === undefined ? null : <p className={styles.cardNote}>{nota}</p>}
      {extra}
    </div>
  );
}

/**
 * Pastilla de estado. El tono aporta el color y el contenido siempre incluye el
 * texto del estado: ningún estado se comunica solo por color.
 */
export function HospitalBadge({
  tono,
  className,
  conBorde = false,
  children,
}: {
  readonly tono: HospitalTonoId;
  readonly className?: string;
  readonly conBorde?: boolean;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <span
      className={clases(styles.badge, conBorde && styles.badgeBordeado, className)}
      style={tonoVars(tono)}
    >
      {children}
    </span>
  );
}

/** Cuadrícula `auto-fit/minmax` de campos clave/valor. */
export function HospitalDataGrid({
  campos,
  minimo = 230,
  etiquetaAccesible,
}: {
  readonly campos: readonly HospitalPacienteDato[];
  /** Ancho mínimo de columna declarado por la referencia. */
  readonly minimo?: number;
  readonly etiquetaAccesible: string;
}): ReactNode {
  return (
    <dl
      className={styles.dataGrid}
      style={{ '--h-dato-min': `${minimo}px` } as CSSProperties}
      aria-label={etiquetaAccesible}
    >
      {campos.map((campo) => (
        <div className={styles.dataField} key={campo.etiqueta}>
          <dt className={styles.dataLabel}>{campo.etiqueta}</dt>
          <dd className={styles.dataValue}>{campo.valor}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Grupo de pastillas locales `Día / Semana / Mes` (TASK-003H-04, FR-02.5).
 *
 * Cambiar de pastilla solo mueve el estado activo: no filtra, no reordena, no
 * recalcula y no consulta nada. La selección se anuncia con `aria-pressed`, de
 * modo que no depende del color.
 */
export function HospitalPills({
  opciones,
  activa,
  etiquetaGrupo,
  onSeleccionar,
}: {
  readonly opciones: readonly string[];
  readonly activa: string;
  readonly etiquetaGrupo: string;
  readonly onSeleccionar: (opcion: string) => void;
}): ReactNode {
  return (
    <div className={styles.pills} role="group" aria-label={etiquetaGrupo}>
      {opciones.map((opcion) => (
        <button
          key={opcion}
          type="button"
          aria-pressed={opcion === activa}
          className={clases(styles.pill, opcion === activa && styles.pillActiva)}
          onClick={() => {
            onSeleccionar(opcion);
          }}
        >
          {opcion}
        </button>
      ))}
    </div>
  );
}

/**
 * Etiquetas de filtro del prototipo. Son texto, no controles: no filtran, no
 * ordenan y no tienen estado. Se anuncian como lista para que quede claro que
 * describen el recorte demostrativo ya aplicado a los datos visibles.
 */
export function HospitalChips({
  items,
  etiquetaAccesible,
  compacto = false,
}: {
  readonly items: readonly string[];
  readonly etiquetaAccesible: string;
  /** Variante de los filtros de comentarios (prototipo, línea 605). */
  readonly compacto?: boolean;
}): ReactNode {
  return (
    <ul
      className={clases(styles.chips, compacto && styles.chipsCompactos)}
      aria-label={etiquetaAccesible}
    >
      {items.map((item) => (
        <li key={item}>
          <span className={clases(styles.chip, compacto && styles.chipCompacto)}>{item}</span>
        </li>
      ))}
    </ul>
  );
}

/** Conteo demostrativo por estado. El color acompaña a un texto legible. */
export interface HospitalEstadoConteo {
  readonly id: string;
  readonly valor: string;
  readonly etiqueta: string;
  /** Color de énfasis. Token del sistema; nunca es el único medio de lectura. */
  readonly color: string;
}

/** Cuadrícula de conteos por estado (Visitas y Consultas virtuales). */
export function HospitalEstadoResumen({
  items,
  etiquetaAccesible,
}: {
  readonly items: readonly HospitalEstadoConteo[];
  readonly etiquetaAccesible: string;
}): ReactNode {
  return (
    <ul className={styles.estadoGrid} aria-label={etiquetaAccesible}>
      {items.map((item) => (
        <li
          className={styles.estadoCard}
          key={item.id}
          style={{ '--h-estado-color': item.color } as CSSProperties}
        >
          <span className={styles.estadoValor}>{item.valor}</span>
          <span className={styles.estadoEtiqueta}>{item.etiqueta}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Barra de puntuación. Expone nombre y valor accesibles porque la referencia la
 * dibuja sin texto propio; la cifra también se lee al lado como texto.
 */
export function HospitalBarra({
  porcentaje,
  color,
  alto = 10,
  etiquetaAccesible,
}: {
  readonly porcentaje: string;
  readonly color: string;
  readonly alto?: number;
  readonly etiquetaAccesible: string;
}): ReactNode {
  return (
    <span
      className={styles.barra}
      role="img"
      aria-label={etiquetaAccesible}
      style={{ '--h-barra-alto': `${String(alto)}px` } as CSSProperties}
    >
      <span
        className={styles.barraRelleno}
        style={{ '--h-barra-pct': porcentaje, '--h-barra-color': color } as CSSProperties}
      />
    </span>
  );
}

/** Nota explicativa gris del prototipo. */
export function HospitalNote({ children }: { readonly children: ReactNode }): ReactNode {
  return <p className={styles.note}>{children}</p>;
}

/** Separador horizontal de la tarjeta «Estados de la cita». */
export function HospitalDivider(): ReactNode {
  return <div className={styles.divider} aria-hidden="true" />;
}

export { styles as hospitalViewStyles };
