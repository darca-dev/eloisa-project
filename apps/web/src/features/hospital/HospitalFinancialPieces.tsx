import type { CSSProperties, KeyboardEvent, ReactNode, Ref } from 'react';

import styles from './hospitalFinancial.module.css';
import { HospitalIcon } from './HospitalIcon';
import type { HospitalIconName } from './HospitalIcon';
import {
  FINANCIERA_ETIQUETA_FILTRO,
  FINANCIERA_FILTROS_PRINCIPALES,
  chipsActivos,
  opcionesDeFiltro,
  tonoDeEstado,
} from './hospitalFinancialConfig';
import type {
  FinancialCampo,
  FinancialCelda,
  FinancialColumna,
  FinancialEvidencia,
  FinancialFila,
  FinancialFiltroId,
  FinancialFiltros,
  FinancialHistorialEntrada,
  FinancialMovimientoVinculado,
  FinancialProcedencia,
} from './hospitalFinancialConfig';
import type { FinancialMenuGrupo, FinancialSeccionId } from './hospitalFinancialConfig';
import { tonoVars } from './HospitalViewPieces';

/**
 * Piezas compartidas por «Gestión financiera» (TASK-003H-06, apartado 6).
 *
 * Implementan el marco común que la Task declara vinculante: encabezado con
 * breadcrumb y badge de demostración, menú secundario colapsable, barra de
 * contexto con filtros, tarjetas KPI compactas, bandeja de atención, tabla
 * compacta, panel de detalle, panel de formulario, evidencias, procedencia,
 * estado de sincronización e historial.
 *
 * Todas reciben su contenido por propiedades tipadas. Ninguna conoce dominio,
 * reglas contables, permisos ni datos de negocio, y ninguna consulta la red,
 * persiste, adjunta archivos ni calcula importes.
 */

/** Une clases opcionales sin dependencias externas. */
function clases(...valores: readonly (string | undefined | false)[]): string {
  return valores.filter((valor): valor is string => typeof valor === 'string').join(' ');
}

/* ========================================================================== */
/* Pastillas de estado y de origen                                            */
/* ========================================================================== */

/**
 * Pastilla de estado. El tono aporta color, pero el estado siempre se lee como
 * texto: ningún estado se comunica solo con color.
 */
export function StatusBadge({ estado }: { readonly estado: string }): ReactNode {
  return (
    <span className={styles.badge} style={tonoVars(tonoDeEstado(estado))}>
      {estado}
    </span>
  );
}

/** Pastilla de origen. Distingue las dos fuentes sin ambigüedad. */
export function SourceBadge({ origen }: { readonly origen: string }): ReactNode {
  return <span className={clases(styles.badge, styles.badgeOrigen)}>{origen}</span>;
}

/**
 * Barra de valor. Es una imagen del porcentaje que ya está escrito al lado y
 * expone su propio nombre accesible: nunca es el único medio de conocerlo.
 */
export function FinancialBar({
  porcentaje,
  color = 'var(--b-azul)',
  etiquetaAccesible,
}: {
  readonly porcentaje: string;
  readonly color?: string;
  readonly etiquetaAccesible: string;
}): ReactNode {
  return (
    <span className={styles.barra} role="img" aria-label={etiquetaAccesible}>
      <span
        className={styles.barraRelleno}
        style={{ '--h-pct': porcentaje, '--h-color': color } as CSSProperties}
      />
    </span>
  );
}

/**
 * Acción exclusivamente visual.
 *
 * Se renderiza siempre `disabled` y sin controlador: no crea, no revisa, no
 * aprueba, no programa, no paga, no adjunta, no exporta, no sincroniza, no
 * llama a ningún servicio y no simula ningún resultado. El estado se escribe al
 * lado para que la indisponibilidad no dependa del color.
 */
export function AccionInerte({
  etiqueta,
  estado = 'Demostración',
  primaria = false,
}: {
  readonly etiqueta: string;
  readonly estado?: string;
  readonly primaria?: boolean;
}): ReactNode {
  return (
    <span className={styles.accionEnvoltura}>
      <button
        type="button"
        disabled
        className={clases(styles.boton, primaria ? styles.botonPrimario : styles.botonNeutro)}
        /* Marcador técnico de auditoría: no es visible ni se anuncia. */
        data-financiera-accion="sin-implementar"
      >
        {etiqueta}
      </button>
      <span className={styles.accionEstado}>{estado}</span>
    </span>
  );
}

/* ========================================================================== */
/* Encabezado y menú secundario                                               */
/* ========================================================================== */

/** Encabezado del módulo: breadcrumb, icono, `h1`, descripción y badge. */
export function FinancialHeader({
  seccion,
  titulo,
  descripcion,
  icono,
  badge,
  tituloId,
  tituloRef,
}: {
  readonly seccion: string;
  readonly titulo: string;
  readonly descripcion: string;
  readonly icono: HospitalIconName;
  readonly badge: string;
  readonly tituloId: string;
  /**
   * Referencia al `h1` del módulo. El panel móvil de secciones devuelve el foco
   * a este mismo título al elegir una sección: no se crea un segundo `h1`.
   */
  readonly tituloRef?: Ref<HTMLHeadingElement>;
}): ReactNode {
  return (
    <>
      <nav aria-label="Ruta de navegación">
        <ol className={styles.breadcrumb}>
          <li>Hospital</li>
          <li aria-hidden="true" className={styles.breadcrumbSeparador}>
            /
          </li>
          <li>Gestión financiera</li>
          <li aria-hidden="true" className={styles.breadcrumbSeparador}>
            /
          </li>
          <li className={styles.breadcrumbActual}>{seccion}</li>
        </ol>
      </nav>

      <div className={styles.encabezado}>
        <span className={styles.encabezadoIcono}>
          <HospitalIcon name={icono} size={20} />
        </span>
        <div className={styles.encabezadoTextos}>
          {/* `tabIndex={-1}`: el título no entra en el orden de tabulación,
              pero puede recibir el foco por programa al cambiar de sección. */}
          <h1 className={styles.titulo} id={tituloId} ref={tituloRef} tabIndex={-1}>
            {titulo}
          </h1>
          <p className={styles.descripcion}>{descripcion}</p>
        </div>
        <span className={styles.badgeDemo}>{badge}</span>
      </div>
    </>
  );
}

/**
 * Única condición de modalidad del menú secundario.
 *
 * El panel se comporta como diálogo —backdrop, `role="dialog"`, `aria-modal`,
 * foco inicial, ciclo de tabulación, `Escape` y botón de cierre— solo cuando
 * está abierto y la anchura es la móvil. En tableta y en escritorio el mismo
 * menú permanece en el flujo de la página sin ninguna de esas capacidades.
 */
export function esMenuModal(abierto: boolean, esModalMovil: boolean): boolean {
  return abierto && esModalMovil;
}

/**
 * Ciclo de foco del panel modal de secciones.
 *
 * Mientras el panel está abierto, `Tab` y `Mayús+Tab` recorren únicamente sus
 * propios controles —todos son `<button>`— y no devuelven el foco al contenido
 * que queda detrás del backdrop. Solo se ejecuta en el navegador, cuando el
 * panel ya recibió un evento de teclado.
 */
function ciclarFoco(evento: KeyboardEvent<HTMLDivElement>): void {
  const enfocables = Array.from(evento.currentTarget.querySelectorAll('button')).filter(
    (boton) => !boton.disabled,
  );
  const primero = enfocables.at(0);
  const ultimo = enfocables.at(-1);

  if (primero === undefined || ultimo === undefined) {
    return;
  }

  const activo = document.activeElement;

  if (evento.shiftKey && (activo === primero || activo === evento.currentTarget)) {
    evento.preventDefault();
    ultimo.focus();
    return;
  }

  if (!evento.shiftKey && activo === ultimo) {
    evento.preventDefault();
    primero.focus();
  }
}

/**
 * Menú secundario de secciones.
 *
 * Es una lista de botones reales con `aria-current="page"` en el destino
 * activo —el sidebar del Hospital conserva su propio único activo—, de
 * modo que el activo se anuncia y no depende del color. Cambiar de sección solo
 * monta otro bloque dentro del mismo `<main>` del shell: no crea rutas, no
 * cambia la URL y no persiste.
 *
 * El menú es uno solo en todas las anchuras: las mismas seis agrupaciones y los
 * mismos quince destinos, con idénticas etiquetas, iconos y orden. Cambia el
 * envoltorio, no el contenido:
 *
 * - En escritorio el envoltorio no aporta caja (`display: contents`) y el
 *   `<nav>` sigue siendo el menú lateral de 224 px ya aprobado.
 * - En tableta conserva el bloque colapsable que abre y cierra el botón
 *   «Secciones financieras»: permanece en el flujo de la página, no cubre el
 *   contenido y no recibe semántica ni comportamiento de diálogo.
 * - En móvil el envoltorio se convierte en el panel que sube desde el borde
 *   inferior, con backdrop sobre el contenido; al estar abierto se anuncia como
 *   diálogo modal, atrapa el foco y se cierra con `Escape`, con el backdrop, con
 *   el botón de cierre o al elegir una sección.
 *
 * La modalidad no se deduce de la anchura dentro del componente: la decide el
 * módulo con `matchMedia` y llega como `esModalMovil`. Todo lo modal —backdrop,
 * `role="dialog"`, `aria-modal`, foco y ciclo de tabulación— se aplica
 * exclusivamente cuando `esModalMovil` y `abierto` son ciertos a la vez.
 */
export function FinancialSectionNav({
  grupos,
  activa,
  abierto,
  esModalMovil,
  id,
  panelRef,
  onSeleccionar,
  onCerrar,
}: {
  readonly grupos: readonly FinancialMenuGrupo[];
  readonly activa: FinancialSeccionId;
  readonly abierto: boolean;
  /**
   * Anchura móvil, resuelta por el módulo con `matchMedia`. Solo aquí el panel
   * abierto es un diálogo modal; en tableta y escritorio es el menú en flujo.
   */
  readonly esModalMovil: boolean;
  readonly id: string;
  /** Panel controlado por el botón «Secciones financieras». Recibe el foco. */
  readonly panelRef: Ref<HTMLDivElement>;
  readonly onSeleccionar: (seccion: FinancialSeccionId) => void;
  readonly onCerrar: () => void;
}): ReactNode {
  const modal = esMenuModal(abierto, esModalMovil);

  return (
    <>
      {!modal ? null : (
        <div
          className={styles.menuFondo}
          aria-hidden="true"
          /* Marcador técnico de auditoría: no es visible ni se anuncia. */
          data-financiera-menu="fondo"
          onClick={onCerrar}
        />
      )}

      <div
        id={id}
        ref={panelRef}
        className={clases(styles.menuPanel, abierto && styles.menuPanelAbierto)}
        role={modal ? 'dialog' : undefined}
        aria-modal={modal ? true : undefined}
        aria-label={modal ? 'Secciones financieras' : undefined}
        tabIndex={modal ? -1 : undefined}
        /* Marcador técnico de auditoría: no es visible ni se anuncia. */
        data-financiera-menu={abierto ? (modal ? 'modal' : 'bloque') : 'cerrado'}
        onKeyDown={(evento) => {
          /* Fuera de la modalidad móvil el teclado circula con normalidad. */
          if (!modal) {
            return;
          }

          if (evento.key === 'Escape') {
            onCerrar();
            return;
          }

          if (evento.key === 'Tab') {
            ciclarFoco(evento);
          }
        }}
      >
        <nav
          aria-label="Secciones financieras"
          className={clases(styles.menu, !abierto && styles.menuOculto)}
        >
          {grupos.map((grupo) => (
            <div className={styles.menuGrupo} key={grupo.id}>
              <h2 className={styles.menuTitulo} id={`${id}-${grupo.id}`}>
                {grupo.titulo}
              </h2>
              <ul className={styles.menuLista} aria-labelledby={`${id}-${grupo.id}`}>
                {grupo.items.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      aria-current={item.id === activa ? 'page' : undefined}
                      className={clases(styles.menuItem, item.id === activa && styles.menuItemActivo)}
                      /* Marcador técnico de auditoría: no es visible ni se anuncia. */
                      data-financiera-seccion={item.id}
                      onClick={() => {
                        onSeleccionar(item.id);
                      }}
                    >
                      <span className={styles.menuIcono}>
                        <HospitalIcon name={item.icono} size={15} />
                      </span>
                      <span className={styles.menuEtiqueta}>{item.etiqueta}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        {!modal ? null : (
          <button
            type="button"
            className={clases(styles.boton, styles.botonNeutro, styles.menuCerrar)}
            onClick={onCerrar}
          >
            Cerrar secciones
          </button>
        )}
      </div>
    </>
  );
}

/* ========================================================================== */
/* Barra de contexto y filtros                                                */
/* ========================================================================== */

/** Selector de una dimensión de filtro. Recorta solo los fixtures en pantalla. */
function SelectorFiltro({
  filtro,
  valor,
  opciones,
  id,
  onCambiar,
}: {
  readonly filtro: FinancialFiltroId;
  readonly valor: string;
  readonly opciones: readonly string[];
  readonly id: string;
  readonly onCambiar: (filtro: FinancialFiltroId, valor: string) => void;
}): ReactNode {
  return (
    <p className={styles.campo}>
      <label className={styles.campoEtiqueta} htmlFor={id}>
        {FINANCIERA_ETIQUETA_FILTRO[filtro]}
      </label>
      <select
        id={id}
        className={styles.campoControl}
        value={valor}
        onChange={(evento) => {
          onCambiar(filtro, evento.target.value);
        }}
      >
        {opciones.map((opcion) => (
          <option key={opcion} value={opcion}>
            {opcion}
          </option>
        ))}
      </select>
    </p>
  );
}

/**
 * Barra de contexto: buscador, periodo, programa y origen, `Más filtros` con el
 * resto de dimensiones, chips de los recortes activos y acción primaria inerte.
 *
 * El recorte es local sobre los fixtures ya cargados: no consulta la red, no
 * pagina en servidor y no ordena por relevancia.
 */
export function FinancialFilterBar({
  filas,
  filtros,
  disponibles,
  buscadorEtiqueta,
  buscadorAyuda,
  accionPrimaria,
  masFiltros,
  prefijo,
  onFiltro,
  onQuitar,
  onLimpiar,
  onAlternarMasFiltros,
}: {
  readonly filas: readonly FinancialFila[];
  readonly filtros: FinancialFiltros;
  readonly disponibles: readonly FinancialFiltroId[];
  readonly buscadorEtiqueta: string;
  readonly buscadorAyuda: string;
  readonly accionPrimaria: string;
  readonly masFiltros: boolean;
  readonly prefijo: string;
  readonly onFiltro: (filtro: FinancialFiltroId | 'texto', valor: string) => void;
  readonly onQuitar: (filtro: FinancialFiltroId | 'texto') => void;
  readonly onLimpiar: () => void;
  readonly onAlternarMasFiltros: () => void;
}): ReactNode {
  const principales = disponibles.filter((filtro) =>
    FINANCIERA_FILTROS_PRINCIPALES.includes(filtro),
  );
  const secundarios = disponibles.filter(
    (filtro) => !FINANCIERA_FILTROS_PRINCIPALES.includes(filtro),
  );
  const chips = chipsActivos(filtros, disponibles);
  const secundariosId = `${prefijo}-mas-filtros`;

  return (
    <div className={styles.tarjeta}>
      <div className={styles.contexto}>
        <p className={clases(styles.campo, styles.campoAncho)}>
          <label className={styles.campoEtiqueta} htmlFor={`${prefijo}-buscador`}>
            {buscadorEtiqueta}
          </label>
          <input
            id={`${prefijo}-buscador`}
            type="search"
            className={styles.campoControl}
            value={filtros.texto}
            aria-describedby={`${prefijo}-buscador-ayuda`}
            onChange={(evento) => {
              onFiltro('texto', evento.target.value);
            }}
          />
          <span className={styles.campoAyuda} id={`${prefijo}-buscador-ayuda`}>
            {buscadorAyuda}
          </span>
        </p>

        {principales.map((filtro) => (
          <SelectorFiltro
            key={filtro}
            filtro={filtro}
            valor={filtros[filtro]}
            opciones={opcionesDeFiltro(filas, filtro)}
            id={`${prefijo}-${filtro}`}
            onCambiar={onFiltro}
          />
        ))}

        <span className={styles.contextoAcciones}>
          {secundarios.length === 0 ? null : (
            <button
              type="button"
              className={clases(styles.boton, styles.botonNeutro)}
              aria-expanded={masFiltros}
              aria-controls={secundariosId}
              onClick={onAlternarMasFiltros}
            >
              {masFiltros ? 'Menos filtros' : 'Más filtros'}
            </button>
          )}
          <AccionInerte etiqueta={accionPrimaria} primaria />
        </span>
      </div>

      {secundarios.length === 0 || !masFiltros ? null : (
        <div className={styles.contexto} id={secundariosId}>
          {secundarios.map((filtro) => (
            <SelectorFiltro
              key={filtro}
              filtro={filtro}
              valor={filtros[filtro]}
              opciones={opcionesDeFiltro(filas, filtro)}
              id={`${prefijo}-${filtro}`}
              onCambiar={onFiltro}
            />
          ))}
        </div>
      )}

      {chips.length === 0 ? null : (
        <ul className={styles.chips} aria-label="Filtros activos">
          {chips.map((chip) => (
            <li className={styles.chip} key={chip.etiqueta}>
              {chip.etiqueta}
              <button
                type="button"
                className={styles.chipQuitar}
                aria-label={`Quitar ${chip.etiqueta}`}
                onClick={() => {
                  onQuitar(chip.filtro);
                }}
              >
                Quitar
              </button>
            </li>
          ))}
          <li>
            <button
              type="button"
              className={clases(styles.boton, styles.botonNeutro)}
              onClick={onLimpiar}
            >
              Limpiar filtros
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}

/* ========================================================================== */
/* KPI y bandeja de atención                                                  */
/* ========================================================================== */

/**
 * Tarjeta KPI compacta.
 *
 * Toda la tarjeta es un único control: un `button` que abre la sección con el
 * recorte indicado. Su nombre accesible es su propio texto —etiqueta, valor,
 * periodo y origen—, de modo que el icono y el color nunca son el único medio
 * para identificarla. La cifra es un fixture visual, no un indicador oficial.
 */
export function FinancialKpiCard({
  etiqueta,
  valor,
  periodo,
  origen,
  icono,
  barra,
  onAbrir,
}: {
  readonly etiqueta: string;
  readonly valor: string;
  readonly periodo: string;
  readonly origen: string;
  readonly icono: HospitalIconName;
  readonly barra?: string;
  readonly onAbrir: () => void;
}): ReactNode {
  return (
    <li className={styles.kpiItem}>
      <button type="button" className={styles.kpiBoton} onClick={onAbrir}>
        <span className={styles.kpiCabecera}>
          <span className={styles.kpiEtiqueta}>{etiqueta}</span>
          <span className={styles.kpiIcono}>
            <HospitalIcon name={icono} size={15} />
          </span>
        </span>
        <span className={styles.kpiValor}>{valor}</span>
        {barra === undefined ? null : (
          <FinancialBar porcentaje={barra} etiquetaAccesible={`${etiqueta}: ${valor}`} />
        )}
        <span className={styles.kpiPie}>{`${periodo} · ${origen}`}</span>
      </button>
    </li>
  );
}

/**
 * Item de «Necesita atención financiera».
 *
 * Es un aviso operativo interno de organización del trabajo: no es una alerta
 * oficial, regulatoria ni clínica, y no evalúa cumplimiento de nada.
 */
export function AttentionItem({
  categoria,
  asunto,
  programa,
  antiguedad,
  origen,
  onRevisar,
}: {
  readonly categoria: string;
  readonly asunto: string;
  readonly programa: string;
  readonly antiguedad: string;
  readonly origen: string;
  readonly onRevisar: () => void;
}): ReactNode {
  return (
    <li className={styles.atencionItem}>
      <span className={styles.atencionTextos}>
        <span className={styles.atencionCategoria}>{categoria}</span>
        <span className={styles.atencionAsunto}>{asunto}</span>
        <span className={styles.atencionMeta}>{`${programa} · ${antiguedad}`}</span>
      </span>
      <SourceBadge origen={origen} />
      <button
        type="button"
        className={styles.filaBoton}
        aria-label={`Revisar: ${asunto}`}
        onClick={onRevisar}
      >
        Revisar
      </button>
    </li>
  );
}

/* ========================================================================== */
/* Tabla                                                                      */
/* ========================================================================== */

/** Contenido de una celda según su tipo. */
function Celda({ celda }: { readonly celda: FinancialCelda }): ReactNode {
  switch (celda.tipo) {
    case 'estado':
      return <StatusBadge estado={celda.valor} />;
    case 'origen':
      return <SourceBadge origen={celda.valor} />;
    case 'importe':
    case 'texto':
    default:
      return celda.valor;
  }
}

/**
 * Tabla compacta de una sección.
 *
 * Los encabezados persisten al desplazar, las columnas secundarias se ocultan
 * progresivamente y en pantallas estrechas cada fila refluye a una tarjeta de
 * definición. El contenedor se desplaza dentro de sí mismo y es enfocable, de
 * modo que la vista nunca produce desbordamiento horizontal global.
 */
export function FinancialDataTable({
  columnas,
  filas,
  leyenda,
  vacio,
  filaAbierta,
  onAbrirFila,
}: {
  readonly columnas: readonly FinancialColumna[];
  readonly filas: readonly FinancialFila[];
  readonly leyenda: string;
  readonly vacio: string;
  readonly filaAbierta: string | null;
  readonly onAbrirFila: (fila: FinancialFila, disparador: HTMLButtonElement) => void;
}): ReactNode {
  if (filas.length === 0) {
    return <p className={styles.vacio}>{vacio}</p>;
  }

  return (
    <div className={styles.tablaContenedor} role="region" aria-label={leyenda} tabIndex={0}>
      <table className={styles.tabla}>
        <caption className={styles.tablaLeyenda}>{leyenda}</caption>
        <thead>
          <tr>
            {columnas.map((columna) => (
              <th
                key={columna.id}
                scope="col"
                className={clases(
                  styles.tablaEncabezado,
                  columna.secundaria === true && styles.colSecundaria,
                )}
              >
                {columna.etiqueta}
              </th>
            ))}
            <th scope="col" className={styles.tablaEncabezado}>
              Detalle
            </th>
          </tr>
        </thead>
        <tbody>
          {filas.map((fila) => (
            <tr key={fila.id} className={fila.id === filaAbierta ? styles.filaActiva : undefined}>
              {columnas.map((columna, indice) => {
                const celda = fila.celdas[indice];

                return (
                  <td
                    key={columna.id}
                    data-etiqueta={columna.etiqueta}
                    className={clases(
                      styles.celda,
                      columna.numerica === true && styles.celdaNumerica,
                      columna.secundaria === true && styles.colSecundaria,
                    )}
                  >
                    {celda === undefined ? '—' : <Celda celda={celda} />}
                  </td>
                );
              })}
              <td className={styles.celdaAccion}>
                <span className={styles.accionEnvoltura}>
                  <button
                    type="button"
                    className={styles.filaBoton}
                    aria-expanded={fila.id === filaAbierta}
                    aria-label={`Ver detalle: ${fila.detalle.titulo}`}
                    onClick={(evento) => {
                      onAbrirFila(fila, evento.currentTarget);
                    }}
                  >
                    Ver detalle
                  </button>
                  <AccionInerte etiqueta="Más acciones" estado="Próximamente" />
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ========================================================================== */
/* Detalle: campos, procedencia, evidencias e historial                       */
/* ========================================================================== */

/** Cuadrícula de campos clave/valor. */
export function FinancialFields({
  campos,
  etiquetaAccesible,
}: {
  readonly campos: readonly FinancialCampo[];
  readonly etiquetaAccesible: string;
}): ReactNode {
  return (
    <dl className={styles.campos} aria-label={etiquetaAccesible}>
      {campos.map((dato) => (
        <div className={styles.campoDato} key={dato.etiqueta}>
          <dt className={styles.campoDatoEtiqueta}>{dato.etiqueta}</dt>
          <dd className={styles.campoDatoValor}>{dato.valor}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Procedencia completa de un registro.
 *
 * Fuente maestra, origen, método de captura, sistema fuente, identificador
 * externo, versión de mapeo y estado de sincronización son dimensiones
 * separadas y se muestran juntas para que ninguna se confunda con otra. La
 * procedencia no desaparece al corregir ni al consolidar.
 */
export function SourceTrace({
  procedencia,
  etiquetaAccesible,
}: {
  readonly procedencia: FinancialProcedencia;
  readonly etiquetaAccesible: string;
}): ReactNode {
  return (
    <FinancialFields
      etiquetaAccesible={etiquetaAccesible}
      campos={[
        { etiqueta: 'Origen', valor: procedencia.origen },
        { etiqueta: 'Fuente maestra', valor: procedencia.fuenteMaestra },
        { etiqueta: 'Método de captura', valor: procedencia.metodo },
        { etiqueta: 'Sistema fuente', valor: procedencia.sistemaFuente },
        { etiqueta: 'Identificador externo', valor: procedencia.idExterno ?? 'Sin identificador externo' },
        { etiqueta: 'Institución fuente', valor: procedencia.institucionFuente },
        { etiqueta: 'Versión del registro externo', valor: procedencia.versionRegistroExterno },
        { etiqueta: 'Estado de sincronización', valor: procedencia.sincronizacion },
        { etiqueta: 'Última sincronización', valor: procedencia.ultimaSincronizacion },
        { etiqueta: 'Lote o ejecución', valor: procedencia.loteOEjecucion },
        { etiqueta: 'Versión de mapeo', valor: procedencia.versionMapeo },
        { etiqueta: 'Dato observado en', valor: procedencia.observadoEn },
        { etiqueta: 'Ingresado en', valor: procedencia.ingestadoEn },
      ]}
    />
  );
}

/** Lista de evidencias. Una versión nueva nunca reemplaza a la anterior. */
export function EvidenceList({
  evidencias,
  etiquetaAccesible,
  vacio,
}: {
  readonly evidencias: readonly FinancialEvidencia[];
  readonly etiquetaAccesible: string;
  readonly vacio: string;
}): ReactNode {
  if (evidencias.length === 0) {
    return <p className={styles.vacio}>{vacio}</p>;
  }

  return (
    <ul className={styles.linea} aria-label={etiquetaAccesible}>
      {evidencias.map((item) => (
        <li className={styles.lineaItem} key={item.id}>
          <span className={styles.lineaTextos}>
            <span className={styles.lineaPrincipal}>{`${item.titulo} · ${item.version}`}</span>
            <span className={styles.lineaSecundaria}>
              {`${item.tipo} · cargada por ${item.cargadaPor} el ${item.cargadaEn} · revisión: ${item.revisadaPor} · ${item.referencia}`}
            </span>
          </span>
          <StatusBadge estado={item.estado} />
        </li>
      ))}
    </ul>
  );
}

/** Historial conceptual. Una corrección añade un hito y no borra los previos. */
export function HistoryTimeline({
  historial,
  etiquetaAccesible,
  vacio,
}: {
  readonly historial: readonly FinancialHistorialEntrada[];
  readonly etiquetaAccesible: string;
  readonly vacio: string;
}): ReactNode {
  if (historial.length === 0) {
    return <p className={styles.vacio}>{vacio}</p>;
  }

  return (
    <ol className={styles.linea} aria-label={etiquetaAccesible}>
      {historial.map((item) => (
        <li className={styles.lineaItem} key={item.id}>
          <span className={styles.lineaFecha}>{item.fecha}</span>
          <span className={styles.lineaTextos}>
            <span className={styles.lineaPrincipal}>{`${item.accion} · ${item.actor}`}</span>
            <span className={styles.lineaSecundaria}>{item.detalle}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

/** Movimientos relacionados con un registro o con una cifra agregada. */
export function LinkedMovements({
  movimientos,
  etiquetaAccesible,
  vacio,
}: {
  readonly movimientos: readonly FinancialMovimientoVinculado[];
  readonly etiquetaAccesible: string;
  readonly vacio: string;
}): ReactNode {
  if (movimientos.length === 0) {
    return <p className={styles.vacio}>{vacio}</p>;
  }

  return (
    <ul className={styles.linea} aria-label={etiquetaAccesible}>
      {movimientos.map((item) => (
        <li className={styles.lineaItem} key={item.id}>
          <span className={styles.lineaFecha}>{item.fecha}</span>
          <span className={styles.lineaTextos}>
            <span className={styles.lineaPrincipal}>{item.concepto}</span>
            <span className={styles.lineaSecundaria}>{item.valor}</span>
          </span>
          <StatusBadge estado={item.estado} />
          <SourceBadge origen={item.origen} />
        </li>
      ))}
    </ul>
  );
}

/* ========================================================================== */
/* Contenedores                                                               */
/* ========================================================================== */

/** Tarjeta del módulo, con su título opcional y su nota. */
export function FinancialCard({
  titulo,
  tituloId,
  nota,
  extra,
  children,
}: {
  readonly titulo?: string;
  readonly tituloId?: string;
  readonly nota?: string;
  readonly extra?: ReactNode;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <section className={styles.tarjeta} aria-labelledby={tituloId}>
      {titulo === undefined ? null : (
        <div className={styles.tarjetaCabecera}>
          <h2 className={styles.tarjetaTitulo} id={tituloId}>
            {titulo}
          </h2>
          {nota === undefined ? null : <p className={styles.tarjetaNota}>{nota}</p>}
          {extra}
        </div>
      )}
      {children}
    </section>
  );
}

/**
 * Panel lateral de consulta rápida.
 *
 * Se abre al activar una fila, recibe el foco, se cierra con `Escape` y
 * devuelve el foco a la fila que lo abrió. No es un modal: no atrapa el foco, no
 * bloquea el contenido y no impide seguir leyendo la tabla.
 */
export function FinancialDetailDrawer({
  titulo,
  subtitulo,
  tituloId,
  panelRef,
  onCerrar,
  children,
}: {
  readonly titulo: string;
  readonly subtitulo: string;
  readonly tituloId: string;
  readonly panelRef: Ref<HTMLElement>;
  readonly onCerrar: () => void;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <section
      className={styles.detalle}
      aria-labelledby={tituloId}
      ref={panelRef}
      tabIndex={-1}
      onKeyDown={(evento) => {
        if (evento.key === 'Escape') {
          onCerrar();
        }
      }}
    >
      <div className={styles.detalleCabecera}>
        <div>
          <h3 className={styles.detalleTitulo} id={tituloId}>
            {titulo}
          </h3>
          <p className={styles.detalleSubtitulo}>{subtitulo}</p>
        </div>
        <button
          type="button"
          className={clases(styles.boton, styles.botonNeutro)}
          onClick={onCerrar}
        >
          Cerrar detalle
        </button>
      </div>
      {children}
    </section>
  );
}

/** Bloque con su propio subtítulo dentro del panel de detalle. */
export function FinancialDetailBlock({
  titulo,
  tituloId,
  children,
}: {
  readonly titulo: string;
  readonly tituloId: string;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <div className={styles.detalleSeccion}>
      <h4 className={styles.detalleSubtitulo3} id={tituloId}>
        {titulo}
      </h4>
      {children}
    </div>
  );
}

/**
 * Panel lateral de formulario largo.
 *
 * Los campos son controles reales con etiqueta persistente, pero el panel no
 * envía nada: no hay `form`, no hay acción, la ranura de archivo es solo visual
 * y guardar permanece inerte.
 */
export function FinancialFormPanel({
  titulo,
  tituloId,
  campos,
  ranura,
  nota,
  prefijo,
  onCerrar,
}: {
  readonly titulo: string;
  readonly tituloId: string;
  readonly campos: readonly string[];
  readonly ranura: string;
  readonly nota: string;
  readonly prefijo: string;
  readonly onCerrar: () => void;
}): ReactNode {
  return (
    <section className={styles.formulario} aria-labelledby={tituloId}>
      <div className={styles.detalleCabecera}>
        <h3 className={styles.detalleTitulo} id={tituloId}>
          {titulo}
        </h3>
        <button
          type="button"
          className={clases(styles.boton, styles.botonNeutro)}
          onClick={onCerrar}
        >
          Cerrar formulario
        </button>
      </div>

      <div className={styles.formularioCampos}>
        {campos.map((etiqueta, indice) => (
          <p className={styles.campo} key={etiqueta}>
            <label className={styles.campoEtiqueta} htmlFor={`${prefijo}-campo-${String(indice)}`}>
              {etiqueta}
            </label>
            <input
              id={`${prefijo}-campo-${String(indice)}`}
              type="text"
              className={styles.campoControl}
              readOnly
              value=""
            />
          </p>
        ))}
      </div>

      <p className={styles.ranura}>{ranura}</p>
      <p className={styles.nota}>{nota}</p>
      <span className={styles.contextoAcciones}>
        <AccionInerte etiqueta="Guardar" primaria />
        <AccionInerte etiqueta="Enviar a revisión" />
      </span>
    </section>
  );
}

/** Aviso de alcance. Es texto dentro del flujo y nunca depende del color. */
export function FinancialNote({
  atencion = false,
  children,
}: {
  readonly atencion?: boolean;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <p className={clases(styles.nota, atencion && styles.notaAtencion)}>{children}</p>
  );
}

/** Cifras compactas que encabezan una sección. Ninguna se calcula aquí. */
export function FinancialSummaryRow({
  bloques,
  etiquetaAccesible,
}: {
  readonly bloques: readonly { readonly id: string; readonly etiqueta: string; readonly valor: string; readonly pie: string }[];
  readonly etiquetaAccesible: string;
}): ReactNode {
  return (
    <dl className={styles.campos} aria-label={etiquetaAccesible}>
      {bloques.map((bloque) => (
        <div className={styles.campoDato} key={bloque.id}>
          <dt className={styles.campoDatoEtiqueta}>{bloque.etiqueta}</dt>
          <dd className={styles.campoDatoValor}>
            {bloque.valor}
            <span className={styles.lineaSecundaria}>{` ${bloque.pie}`}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}

export { styles as hospitalFinancialStyles, clases as unirClases };
