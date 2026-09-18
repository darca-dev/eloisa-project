'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import styles from './hospitalPatients.module.css';
import {
  HOSPITAL_POBLACION_ESTADOS,
  hospitalPoblacionCore,
  type HospitalPoblacionConfig,
} from './hospitalPatientsConfig';
import {
  ENCABEZADO_DISTRIBUCION,
  NOTA_DISTRIBUCION,
  PoblacionBarraListado,
  PoblacionEncabezado,
  PoblacionEsqueleto,
  PoblacionEstadoFallo,
  PoblacionFiltrosZona,
  PoblacionGrafico,
  PoblacionGraficoNoDisponible,
  PoblacionKpiGrid,
  PoblacionMatriz,
  PoblacionPaginacion,
  PoblacionPanel,
  PoblacionTabla,
  opcionesDesdeAnalitica,
} from './HospitalPatientsPieces';
import {
  HOSPITAL_FILTROS_VACIOS,
  HOSPITAL_TAMANO_PAGINA_INICIAL,
  consultarAnalitica,
  consultarDetalle,
  consultarListado,
  filtrosVacios,
  serializarFiltros,
  serializarListado,
  type HospitalAnaliticaDto,
  type HospitalDetalleDto,
  type HospitalFiltros,
  type HospitalListadoDto,
  type HospitalOrdenId,
  type HospitalSentido,
} from './hospitalPatientsClient';
import { textoFechaCorte } from './hospitalPopulationTypes';
import { HospitalNote, hospitalViewStyles as compartido } from './HospitalViewPieces';

/**
 * Vista «Pacientes» conectada a CORE-01 (TASK-HOSPITAL-CORE-01 §4 y §10).
 *
 * Sustituye la fuente de la vista aprobada en TASK-003H-03B: el listado, los
 * filtros, el orden, la paginación y la analítica dejan de calcularse en el
 * navegador sobre un fixture y pasan a servirse desde PostgreSQL, acotados al
 * tenant institucional que el servidor resuelve.
 *
 * LO QUE NO CAMBIA: la composición, la jerarquía, la navegación, el responsive y
 * la accesibilidad aprobadas. Solo cambian la fuente y los estados que la fuente
 * real obliga a representar.
 *
 * GARANTÍAS DE ESTA VISTA:
 *
 * - NO importa `hospitalPopulationFixtures.ts` ni ningún selector que lo
 *   alcance: no existe repliegue a datos de demostración. Un fallo es un fallo;
 *   ante error se limpia el estado nominal y NUNCA se mezclan cifras reales con
 *   cifras demostrativas;
 * - listado y analítica se piden COORDINADOS con un mismo `AbortController`: un
 *   cambio de filtro, orden, página o tamaño cancela la petición anterior, de
 *   modo que una respuesta tardía —o de una sesión ya cerrada— no puede
 *   sustituir al estado actual;
 * - la búsqueda se envía con retardo y solo tras normalizarse. El término no se
 *   registra en ninguna telemetría, no viaja en la URL y no se persiste;
 * - no se escribe nada en ningún almacenamiento web del navegador, en ninguna
 *   caché de trabajador de servicio ni en la URL: la respuesta es NOMINAL y no
 *   debe sobrevivir a la pestaña;
 * - la fecha de corte y la procedencia proceden SIEMPRE del servidor;
 * - abrir `Ver` consulta el detalle; cerrar limpia el detalle nominal del estado.
 *
 * Que una persona aparezca en el resultado NO acredita relación de atención,
 * asignación profesional ni derecho de acceso a más información. Esta vista no
 * es una Historia Clínica Electrónica y no emite ninguna conclusión clínica.
 */

const TITULO_ID = 'hospital-pacientes-titulo';
const LISTA_ID = 'hospital-pacientes-listado';

/** Retardo de la búsqueda, en milisegundos. */
const RETARDO_BUSQUEDA_MS = 350;

/** Forma de gráfico de cada distribución servida. */
const FORMA_GRAFICO: Record<string, 'barras' | 'dona'> = {
  'age-ranges': 'barras',
  eps: 'dona',
  municipality: 'barras',
  'area-type': 'dona',
};

/**
 * Gráficos del diseño aprobado cuyos dominios CORE-01 no modela.
 *
 * Conservan su lugar en la columna analítica y declaran su ausencia en lugar de
 * dibujar una serie vacía, que se leería como «medido y en cero».
 */
const GRAFICOS_NO_DISPONIBLES: readonly string[] = [
  'Patologías más frecuentes',
  'Programas',
  'Cuidador asignado',
  'Profesional asignado',
];

/** Desenlace de la consulta principal, ya traducido a estado de vista. */
type EstadoVista =
  | { readonly clase: 'cargando' }
  | { readonly clase: 'listo' }
  | { readonly clase: 'sin-sesion' }
  | { readonly clase: 'sin-permiso' }
  | { readonly clase: 'error' };

export function HospitalPatients({
  config = hospitalPoblacionCore,
  fetchImpl,
  filtrosIniciales,
  ordenInicial = 'name',
  sentidoInicial = 'asc',
  tamanoInicial = HOSPITAL_TAMANO_PAGINA_INICIAL,
  paginaInicial = 1,
  panelFiltrosInicial = false,
  detallesIniciales,
}: {
  readonly config?: HospitalPoblacionConfig;
  /**
   * Implementación de `fetch` que consulta la API.
   *
   * Se inyecta para poder probar la serialización, la cancelación y cada código
   * de estado sin jsdom y sin red, que es como se prueba el resto del frontend
   * de este repositorio. En la aplicación real se usa el `fetch` del navegador.
   */
  readonly fetchImpl?: typeof fetch;
  /** Filtros aplicados al montar. No persisten y no proceden de la URL. */
  readonly filtrosIniciales?: Partial<HospitalFiltros>;
  readonly ordenInicial?: HospitalOrdenId;
  readonly sentidoInicial?: HospitalSentido;
  readonly tamanoInicial?: number;
  readonly paginaInicial?: number;
  /** Panel de filtros abierto al montar; solo es visible en pantalla estrecha. */
  readonly panelFiltrosInicial?: boolean;
  /** Gráficos con su tabla de valores desplegada al montar. */
  readonly detallesIniciales?: readonly string[];
}): ReactNode {
  const [filtros, setFiltros] = useState<HospitalFiltros>(() => ({
    ...HOSPITAL_FILTROS_VACIOS,
    ...filtrosIniciales,
  }));
  /**
   * Término efectivamente enviado.
   *
   * Se separa del valor del campo para que teclear no dispare una consulta por
   * pulsación: solo se sincroniza tras el retardo.
   */
  const [busquedaEnviada, setBusquedaEnviada] = useState<string>(
    () => filtrosIniciales?.search ?? '',
  );
  const [orden, setOrden] = useState<HospitalOrdenId>(ordenInicial);
  const [sentido, setSentido] = useState<HospitalSentido>(sentidoInicial);
  const [tamano, setTamano] = useState<number>(tamanoInicial);
  const [pagina, setPagina] = useState<number>(paginaInicial);
  const [panelFiltros, setPanelFiltros] = useState<boolean>(panelFiltrosInicial);
  const [detalles, setDetalles] = useState<readonly string[]>(detallesIniciales ?? []);
  const [reintento, setReintento] = useState<number>(0);

  const [estado, setEstado] = useState<EstadoVista>({ clase: 'cargando' });
  const [listado, setListado] = useState<HospitalListadoDto | null>(null);
  const [analitica, setAnalitica] = useState<HospitalAnaliticaDto | null>(null);

  const [abiertaId, setAbiertaId] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<HospitalDetalleDto | null>(null);
  const [detalleAusente, setDetalleAusente] = useState<boolean>(false);

  const panelRef = useRef<HTMLDivElement>(null);
  /** Botón `Ver` que abrió el panel; recibe el foco al cerrarlo. */
  const disparadorRef = useRef<HTMLButtonElement | null>(null);

  /** Filtros efectivamente consultados: el campo de texto ya estabilizado. */
  const filtrosEnviados = useMemo<HospitalFiltros>(
    () => ({ ...filtros, search: busquedaEnviada }),
    [filtros, busquedaEnviada],
  );

  /* Retardo de la búsqueda. Solo el término estabilizado llega a la API. */
  useEffect(() => {
    if (filtros.search === busquedaEnviada) {
      return undefined;
    }

    const temporizador = setTimeout(() => {
      setBusquedaEnviada(filtros.search);
      setPagina(1);
      cerrarPanel();
    }, RETARDO_BUSQUEDA_MS);

    return (): void => {
      clearTimeout(temporizador);
    };
    /*
     * Dependencias deliberadamente acotadas al texto: `cerrarPanel` se redefine
     * en cada render y añadirlo reiniciaría el temporizador sin cesar, de modo
     * que la búsqueda no llegaría a enviarse nunca.
     */
  }, [filtros.search, busquedaEnviada]);

  /*
   * Consulta COORDINADA de listado y analítica.
   *
   * Ambas comparten el mismo `AbortController`: o se sirven las dos del mismo
   * conjunto filtrado, o no se sirve ninguna. Así la cifra del listado y la de
   * la analítica no pueden corresponder a consultas distintas.
   */
  useEffect(() => {
    const controller = new AbortController();
    let vigente = true;
    const cliente = fetchImpl ?? fetch;

    setEstado({ clase: 'cargando' });

    const consulta = serializarListado(filtrosEnviados, pagina, tamano, orden, sentido);
    const consultaAnalitica = serializarFiltros(filtrosEnviados);

    void Promise.all([
      consultarListado(consulta, cliente, controller.signal),
      consultarAnalitica(consultaAnalitica, cliente, controller.signal),
    ]).then(([resultadoListado, resultadoAnalitica]) => {
      if (!vigente) {
        return;
      }

      // Una cancelación no es un desenlace: ya hay otra consulta en curso.
      if (resultadoListado.kind === 'cancelado' || resultadoAnalitica.kind === 'cancelado') {
        return;
      }

      if (resultadoListado.kind === 'sin-sesion' || resultadoAnalitica.kind === 'sin-sesion') {
        limpiarNominal();
        setEstado({ clase: 'sin-sesion' });

        return;
      }

      if (resultadoListado.kind === 'sin-permiso' || resultadoAnalitica.kind === 'sin-permiso') {
        limpiarNominal();
        setEstado({ clase: 'sin-permiso' });

        return;
      }

      if (resultadoListado.kind !== 'ok' || resultadoAnalitica.kind !== 'ok') {
        /*
         * Ante error se limpia el estado nominal: no se conserva la respuesta
         * anterior, que podría corresponder a otros filtros o a otra sesión.
         */
        limpiarNominal();
        setEstado({ clase: 'error' });

        return;
      }

      setListado(resultadoListado.datos);
      setAnalitica(resultadoAnalitica.datos);
      setEstado({ clase: 'listo' });
    });

    return (): void => {
      vigente = false;
      controller.abort();
    };
    /*
     * Dependencias deliberadamente acotadas a lo que DEFINE la consulta. Las
     * funciones auxiliares se redefinen en cada render: incluirlas relanzaría la
     * consulta indefinidamente y cada relanzamiento abortaría el anterior, de
     * modo que la vista no llegaría a mostrar nunca un resultado.
     */
  }, [filtrosEnviados, pagina, tamano, orden, sentido, reintento, fetchImpl]);

  /* Detalle nominal. Se cancela al cambiar de selección o al cerrar. */
  useEffect(() => {
    if (abiertaId === null) {
      return undefined;
    }

    const controller = new AbortController();
    let vigente = true;

    setDetalle(null);
    setDetalleAusente(false);

    void consultarDetalle(abiertaId, fetchImpl ?? fetch, controller.signal).then(
      (resultado) => {
        if (!vigente || resultado.kind === 'cancelado') {
          return;
        }

        if (resultado.kind === 'ok') {
          setDetalle(resultado.datos);

          return;
        }

        /*
         * Un 404 limpia la selección y muestra un estado seguro: el registro ya
         * no está disponible en esta institución. No se conserva nada nominal.
         */
        setAbiertaId(null);
        setDetalle(null);
        setDetalleAusente(true);
      },
    );

    return (): void => {
      vigente = false;
      controller.abort();
    };
  }, [abiertaId, fetchImpl]);

  /* El panel se enfoca cuando ya está montado, no durante el evento del clic. */
  useEffect(() => {
    if (detalle !== null) {
      panelRef.current?.focus();
    }
  }, [detalle]);

  /** Retira del estado toda información nominal ya servida. */
  function limpiarNominal(): void {
    setListado(null);
    setAnalitica(null);
    setAbiertaId(null);
    setDetalle(null);
  }

  /** Cambiar cualquier criterio vuelve a la página 1 y cierra el panel. */
  function actualizarFiltros(cambio: Partial<HospitalFiltros>): void {
    setFiltros((actual) => ({ ...actual, ...cambio }));

    // El texto se estabiliza aparte; el resto se aplica de inmediato.
    if (!('search' in cambio)) {
      setPagina(1);
      cerrarPanel();
    }
  }

  function limpiar(): void {
    setFiltros(HOSPITAL_FILTROS_VACIOS);
    setBusquedaEnviada('');
    setOrden('name');
    setSentido('asc');
    setPagina(1);
    cerrarPanel();
  }

  function cerrarPanel(): void {
    setAbiertaId(null);
    setDetalle(null);
    setDetalleAusente(false);
  }

  const corte = listado === null ? null : textoFechaCorte(listado.asOfDate);
  const opciones = useMemo(() => opcionesDesdeAnalitica(analitica), [analitica]);

  const encabezado = (
    <PoblacionEncabezado
      titulo={config.encabezado.titulo}
      descripcion={config.encabezado.descripcion}
      badge={config.badgeDatos}
      corte={corte}
      tituloId={TITULO_ID}
    />
  );

  if (estado.clase === 'cargando') {
    return (
      <div className={compartido.view}>
        {encabezado}
        <PoblacionEsqueleto />
      </div>
    );
  }

  if (estado.clase === 'sin-sesion' || estado.clase === 'sin-permiso') {
    /*
     * Ni 401 ni 403 ofrecen reintento: repetir la consulta no cambia el
     * desenlace, y esta vista no abre sesión —no existe ese flujo dentro del
     * alcance autorizado—.
     */
    const sinSesion = estado.clase === 'sin-sesion';

    return (
      <div className={compartido.view}>
        {encabezado}
        <PoblacionEstadoFallo
          titulo={
            sinSesion
              ? HOSPITAL_POBLACION_ESTADOS.sinSesion
              : HOSPITAL_POBLACION_ESTADOS.sinPermiso
          }
          detalle={
            sinSesion
              ? HOSPITAL_POBLACION_ESTADOS.sinSesionDetalle
              : HOSPITAL_POBLACION_ESTADOS.sinPermisoDetalle
          }
        />
      </div>
    );
  }

  if (estado.clase === 'error' || listado === null || analitica === null) {
    return (
      <div className={compartido.view}>
        {encabezado}
        <PoblacionEstadoFallo
          titulo={HOSPITAL_POBLACION_ESTADOS.error}
          detalle={HOSPITAL_POBLACION_ESTADOS.errorDetalle}
          onReintentar={() => {
            setReintento((actual) => actual + 1);
          }}
        />
      </div>
    );
  }

  const universoVacio = analitica.activeUniverse === 0;

  return (
    <div className={compartido.view} data-hospital-poblacion={analitica.definitionVersion}>
      {encabezado}

      <PoblacionKpiGrid
        cifras={analitica.keyFigures}
        etiquetaAccesible="Indicadores de la población atendida"
      />

      <PoblacionFiltrosZona
        filtros={filtros}
        opciones={opciones}
        opcionesAbiertas={panelFiltros}
        encontrados={listado.totalItems}
        hayFiltros={!filtrosVacios(filtros)}
        onFiltro={actualizarFiltros}
        onLimpiar={limpiar}
        onAlternarPanel={() => {
          setPanelFiltros((actual) => !actual);
        }}
      />

      <div className={styles.cuerpo}>
        <section className={styles.columnaListado} aria-labelledby={LISTA_ID}>
          <h2 className="merdn-sr-only" id={LISTA_ID}>
            Listado de pacientes
          </h2>

          <PoblacionBarraListado
            total={listado.totalItems}
            tamano={tamano}
            orden={orden}
            sentido={sentido}
            onTamano={(valor) => {
              setTamano(valor);
              setPagina(1);
              cerrarPanel();
            }}
            onOrden={(valor) => {
              setOrden(valor);
              setPagina(1);
            }}
            onSentido={(valor) => {
              setSentido(valor);
              setPagina(1);
            }}
          />

          {detalleAusente ? (
            <p className={styles.estadoTexto} role="status">
              {HOSPITAL_POBLACION_ESTADOS.detalleAusente}
            </p>
          ) : null}

          {universoVacio ? (
            <p className={styles.estadoTexto}>{HOSPITAL_POBLACION_ESTADOS.vacio}</p>
          ) : null}

          {!universoVacio && listado.totalItems === 0 ? (
            <div className={styles.sinResultados}>
              <p className={styles.estadoTexto} role="status">
                {HOSPITAL_POBLACION_ESTADOS.sinResultados}
              </p>
              <button
                type="button"
                className={`${compartido.button} ${compartido.buttonNeutro}`}
                onClick={limpiar}
              >
                Limpiar filtros
              </button>
            </div>
          ) : null}

          {listado.totalItems > 0 ? (
            <>
              <PoblacionTabla
                columnas={config.columnas}
                filas={listado.items}
                abiertaId={abiertaId}
                etiquetaAccesible="Pacientes del conjunto filtrado"
                onVer={(id, disparador) => {
                  disparadorRef.current = disparador;
                  setAbiertaId((actual) => (actual === id ? null : id));
                }}
              />
              <PoblacionPaginacion listado={listado} onPagina={setPagina} />
            </>
          ) : null}
        </section>

        <section className={styles.columnaAnalitica} aria-label="Analítica poblacional">
          {analitica.distributions.map((distribucion) => (
            <PoblacionGrafico
              key={distribucion.id}
              distribucion={distribucion}
              forma={FORMA_GRAFICO[distribucion.id] ?? 'barras'}
              encabezado={ENCABEZADO_DISTRIBUCION[distribucion.id] ?? 'Valor'}
              nota={NOTA_DISTRIBUCION[distribucion.id] ?? ''}
              detalle={detalles.includes(distribucion.id)}
              onDetalle={() => {
                setDetalles((actual) =>
                  actual.includes(distribucion.id)
                    ? actual.filter((id) => id !== distribucion.id)
                    : [...actual, distribucion.id],
                );
              }}
            />
          ))}

          {GRAFICOS_NO_DISPONIBLES.map((titulo) => (
            <PoblacionGraficoNoDisponible key={titulo} titulo={titulo} />
          ))}

          <PoblacionMatriz
            intersecciones={analitica.intersections}
            universo={analitica.filteredUniverse}
          />

          <p className={styles.avisoAlcaldia}>{config.avisoAlcaldia}</p>
        </section>
      </div>

      <HospitalNote>{config.nota}</HospitalNote>

      {detalle === null ? null : (
        <PoblacionPanel
          detalle={detalle}
          avisoHistoria={config.avisoHistoria}
          referencia={panelRef}
          onCerrar={() => {
            cerrarPanel();
            disparadorRef.current?.focus();
          }}
        />
      )}
    </div>
  );
}
