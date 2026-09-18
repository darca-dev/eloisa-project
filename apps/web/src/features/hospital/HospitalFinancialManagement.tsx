import { useEffect, useRef, useState, type ReactNode } from 'react';

import styles from './hospitalFinancial.module.css';
import {
  FinancialHeader,
  FinancialNote,
  FinancialSectionNav,
  esMenuModal,
  unirClases,
} from './HospitalFinancialPieces';
import {
  FinancialConexionView,
  FinancialResumenView,
  FinancialTablaView,
} from './HospitalFinancialSections';
import {
  FINANCIERA_ETIQUETA_SECCION,
  FINANCIERA_FILTROS_VACIOS,
  FINANCIERA_MENU,
  FINANCIERA_SECCION_INICIAL,
  conFiltro,
  filtrosCon,
  sinFiltro,
} from './hospitalFinancialConfig';
import type {
  FinancialBandeja,
  FinancialFiltroId,
  FinancialFiltros,
  FinancialSeccionId,
} from './hospitalFinancialConfig';
import type { FinancialConfig, FinancialDestino } from './hospitalFinancialContracts';
import { hospitalFinancieraDemo, seccionDeTabla } from './hospitalFinancialDemo';

/**
 * Vista «Gestión financiera» del Hospital (TASK-003H-06).
 *
 * Sustituye el destino provisional de TASK-003H-05 por la experiencia frontend
 * completa que la Task define: menú secundario colapsable con las seis
 * agrupaciones y los quince destinos aprobados, resumen financiero con diez KPI
 * compactos y bandeja de atención, trece secciones de consulta con buscador,
 * filtros, subpestañas, tabla compacta y panel de detalle, y el panel que
 * prepara la conexión con el sistema del Hospital.
 *
 * La selección interna es estado local del montaje: no crea rutas, no cambia la
 * URL, no persiste y se reinicia al recargar. El sidebar del Hospital conserva
 * un único item activo, `Gestión financiera`.
 *
 * El menú secundario es uno solo: menú lateral fijo desde 1024 px, bloque
 * colapsable en flujo entre 721 px y 1023 px y panel modal inferior hasta
 * 720 px. La anchura móvil se resuelve con `matchMedia` y se mantiene
 * sincronizada mientras el módulo está montado. Solo en móvil el panel abierto
 * es un diálogo: backdrop, `role="dialog"`, `aria-modal`, foco inicial dentro
 * del panel, ciclo de tabulación, `Escape`, botón de cierre y traslado del foco
 * al `h1` ya existente al elegir una sección. En tableta el botón abre y cierra
 * el bloque, elegir una sección lo cierra y el foco no se mueve.
 *
 * Alcance: presentación demostrativa. Sin backend, base de datos, red,
 * persistencia, archivos reales, pagos, exportaciones, integración activa,
 * cálculos legales o contables, autenticación ni autorización. Crear, revisar,
 * aprobar, programar, pagar, exportar, adjuntar y sincronizar permanecen
 * inertes y no simulan ningún resultado.
 */

const TITULO_ID = 'hospital-financiera-titulo';
const MENU_ID = 'hospital-financiera-menu';

/** Anchura en la que el menú secundario se presenta como panel modal. */
const CONSULTA_MOVIL = '(max-width: 720px)';

/** Estado local del módulo. Todo él dura lo que dura el montaje actual. */
export interface EstadoFinanciero {
  readonly seccion: FinancialSeccionId;
  readonly filtros: FinancialFiltros;
  readonly bandeja: FinancialBandeja;
  readonly masFiltros: boolean;
  readonly filaAbierta: string | null;
  readonly formularioAbierto: boolean;
  readonly menuAbierto: boolean;
}

/**
 * Resultado de elegir una sección en el menú secundario.
 *
 * El foco solo se traslada al `h1` cuando la sección se eligió en el panel
 * modal móvil, es decir con anchura móvil y panel abierto. En tableta el bloque
 * colapsable se cierra sin mover el foco, y en escritorio el menú lateral está
 * siempre visible y la selección tampoco lo mueve.
 */
export interface SeleccionDeMenu {
  readonly estado: EstadoFinanciero;
  readonly enfocarTitulo: boolean;
}

/** Transición pura de «elegir una sección en el menú secundario». */
export function seleccionDeMenu(
  actual: EstadoFinanciero,
  seccion: FinancialSeccionId,
  esModalMovil: boolean,
): SeleccionDeMenu {
  return {
    estado: estadoDeDestino(actual, { seccion }),
    enfocarTitulo: actual.menuAbierto && esModalMovil,
  };
}

/** Estado que corresponde a abrir un destino interno, con su recorte. */
function estadoDeDestino(actual: EstadoFinanciero, destino: FinancialDestino): EstadoFinanciero {
  return {
    ...actual,
    seccion: destino.seccion,
    filtros: filtrosCon(destino.filtros),
    bandeja: destino.bandeja ?? 'Todos',
    filaAbierta: null,
    formularioAbierto: false,
    menuAbierto: false,
  };
}

export function HospitalFinancialManagement({
  config = hospitalFinancieraDemo,
  seccionInicial = FINANCIERA_SECCION_INICIAL,
  filaInicial = null,
  filtrosIniciales,
  menuAbiertoInicial = false,
  esModalMovilInicial = false,
}: {
  readonly config?: FinancialConfig;
  /**
   * Sección mostrada al montar. Como el resto del estado, no persiste, no viaja
   * por URL y se reinicia al recargar.
   */
  readonly seccionInicial?: FinancialSeccionId;
  /** Registro cuyo panel de detalle se muestra al montar. */
  readonly filaInicial?: string | null;
  /** Recorte aplicado al montar. Sin valor, la sección se abre sin filtros. */
  readonly filtrosIniciales?: Partial<FinancialFiltros>;
  /**
   * Panel de secciones abierto al montar. Como el resto del estado, no
   * persiste y no viaja por URL; permite verificar el panel móvil.
   */
  readonly menuAbiertoInicial?: boolean;
  /**
   * Anchura móvil supuesta hasta que `matchMedia` responde en el navegador.
   * En el servidor no hay ventana: el valor por defecto describe la anchura no
   * móvil, y el efecto de sincronización corrige el estado al montar y en cada
   * cambio de anchura. Permite fijar la anchura simulada en pruebas.
   */
  readonly esModalMovilInicial?: boolean;
}): ReactNode {
  const [estado, setEstado] = useState<EstadoFinanciero>(() => ({
    seccion: seccionInicial,
    filtros: filtrosIniciales === undefined ? FINANCIERA_FILTROS_VACIOS : filtrosCon(filtrosIniciales),
    bandeja: 'Todos',
    masFiltros: false,
    filaAbierta: filaInicial,
    formularioAbierto: false,
    menuAbierto: menuAbiertoInicial,
  }));

  /*
   * Anchura móvil. Se resuelve en el navegador con `matchMedia` y se mantiene
   * sincronizada mientras el módulo está montado, de modo que girar o
   * redimensionar la ventana cambia la modalidad del menú sin recargar.
   */
  const [esModalMovil, setEsModalMovil] = useState<boolean>(esModalMovilInicial);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const consulta = window.matchMedia(CONSULTA_MOVIL);
    const sincronizar = (): void => {
      setEsModalMovil(consulta.matches);
    };

    sincronizar();
    consulta.addEventListener('change', sincronizar);

    return () => {
      consulta.removeEventListener('change', sincronizar);
    };
  }, []);

  /*
   * Foco del panel de secciones. Solo en la modalidad móvil: al abrirlo, el
   * foco entra en el panel; al cerrarlo con `Escape`, con el backdrop o con el
   * botón de cierre, vuelve al botón que lo abrió; al elegir una sección, pasa
   * al `h1` del módulo, que no se duplica. En tableta y escritorio el foco del
   * usuario no se mueve.
   */
  const menuPanelRef = useRef<HTMLDivElement | null>(null);
  const menuBotonRef = useRef<HTMLButtonElement | null>(null);
  const tituloRef = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => {
    if (esMenuModal(estado.menuAbierto, esModalMovil)) {
      menuPanelRef.current?.focus();
    }
  }, [estado.menuAbierto, esModalMovil]);

  const cerrarMenu = (): void => {
    setEstado((actual) => ({ ...actual, menuAbierto: false }));
    menuBotonRef.current?.focus();
  };

  const seccionTabla = seccionDeTabla(estado.seccion);
  const etiquetaSeccion = FINANCIERA_ETIQUETA_SECCION[estado.seccion];

  const irA = (destino: FinancialDestino): void => {
    setEstado((actual) => estadoDeDestino(actual, destino));
  };

  return (
    <div className={styles.modulo}>
      <FinancialHeader
        seccion={etiquetaSeccion}
        titulo={config.titulo}
        descripcion={config.descripcion}
        icono="financiera"
        badge={config.badge}
        tituloId={TITULO_ID}
        tituloRef={tituloRef}
      />

      <p className={styles.estadoDatos}>{config.estadoDatos}</p>
      <FinancialNote>{config.avisoPermisos}</FinancialNote>

      <button
        type="button"
        ref={menuBotonRef}
        className={unirClases(styles.boton, styles.botonNeutro, styles.menuBoton)}
        aria-expanded={estado.menuAbierto}
        aria-controls={MENU_ID}
        onClick={() => {
          setEstado((actual) => ({ ...actual, menuAbierto: !actual.menuAbierto }));
        }}
      >
        Secciones financieras
      </button>

      <div className={styles.cuerpo}>
        <FinancialSectionNav
          grupos={FINANCIERA_MENU}
          activa={estado.seccion}
          abierto={estado.menuAbierto}
          esModalMovil={esModalMovil}
          id={MENU_ID}
          panelRef={menuPanelRef}
          onCerrar={cerrarMenu}
          onSeleccionar={(seccion) => {
            const seleccion = seleccionDeMenu(estado, seccion, esModalMovil);

            setEstado(seleccion.estado);

            if (seleccion.enfocarTitulo) {
              /* Solo en móvil: el panel se cierra y el foco pasa al `h1`. */
              tituloRef.current?.focus();
            }
          }}
        />

        <div
          className={styles.panel}
          /* Marcador técnico de auditoría: no es visible ni se anuncia. */
          data-financiera-panel={estado.seccion}
        >
          {estado.seccion === 'resumen' ? (
            <FinancialResumenView
              resumen={config.resumen}
              estados={config.estados}
              onDestino={irA}
            />
          ) : null}

          {estado.seccion === 'conexion' ? (
            <FinancialConexionView conexion={config.conexion} estados={config.estados} />
          ) : null}

          {seccionTabla === undefined ? null : (
            <FinancialTablaView
              seccion={seccionTabla}
              filtros={estado.filtros}
              bandeja={estado.bandeja}
              masFiltros={estado.masFiltros}
              filaAbierta={estado.filaAbierta}
              formularioAbierto={estado.formularioAbierto}
              estados={config.estados}
              onFiltro={(filtro: FinancialFiltroId | 'texto', valor: string) => {
                setEstado((actual) => ({
                  ...actual,
                  filtros: conFiltro(actual.filtros, filtro, valor),
                  filaAbierta: null,
                }));
              }}
              onQuitarFiltro={(filtro) => {
                setEstado((actual) => ({
                  ...actual,
                  filtros: sinFiltro(actual.filtros, filtro),
                  filaAbierta: null,
                }));
              }}
              onLimpiarFiltros={() => {
                setEstado((actual) => ({
                  ...actual,
                  filtros: FINANCIERA_FILTROS_VACIOS,
                  bandeja: 'Todos',
                  filaAbierta: null,
                }));
              }}
              onAlternarMasFiltros={() => {
                setEstado((actual) => ({ ...actual, masFiltros: !actual.masFiltros }));
              }}
              onBandeja={(bandeja) => {
                setEstado((actual) => ({ ...actual, bandeja, filaAbierta: null }));
              }}
              onAbrirFila={(id) => {
                setEstado((actual) => ({ ...actual, filaAbierta: id }));
              }}
              onCerrarFila={() => {
                setEstado((actual) => ({ ...actual, filaAbierta: null }));
              }}
              onAlternarFormulario={() => {
                setEstado((actual) => ({
                  ...actual,
                  formularioAbierto: !actual.formularioAbierto,
                }));
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
