'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { HospitalIcon } from './HospitalIcon';
import styles from './hospitalProfessionals.module.css';
import {
  HOSPITAL_ESTADOS_PERFIL,
  HOSPITAL_PROFESIONES,
  HOSPITAL_TIPOS_VINCULO,
  hospitalProfesionalesCore,
  type HospitalProfessionalsCopy,
} from './hospitalProfessionalsConfig';
import {
  HOSPITAL_PROFESIONALES_FILTROS_VACIOS,
  HOSPITAL_PROFESIONALES_TAMANO_INICIAL,
  consultarProfesional,
  consultarProfesionales,
  filtrosProfesionalesVacios,
  serializarProfesionales,
  type HospitalProfesionalDetalleDto,
  type HospitalProfesionalListadoDto,
  type HospitalProfesionalesFiltros,
  type HospitalProfesionalesListaDto,
} from './hospitalProfessionalsClient';
import {
  estadoDeDesenlace,
  estadoPerfil,
  etiquetaEstadoVinculo,
  etiquetaProfesion,
  etiquetaVinculo,
  ofreceReintento,
  rangoDePagina,
  textoDeEstado,
  textoFecha,
  type HospitalProfesionalesEstado,
} from './hospitalProfessionalsListado';
import {
  HOSPITAL_DETALLE_PANEL_ID,
  ProfessionalDetailPanel,
} from './ProfessionalDetailPanel';
import {
  HospitalBadge,
  HospitalCard,
  HospitalCardHeader,
  HospitalNote,
  HospitalViewHeader,
  hospitalViewStyles as compartido,
} from './HospitalViewPieces';

/**
 * Vista «Profesionales» conectada a CORE-02
 * (TASK-HOSPITAL-CORE-02 §3.1; paquete de continuación §3.1).
 *
 * Sustituye la FUENTE de la vista aprobada en TASK-003H-04: el listado, la
 * búsqueda, los filtros y la paginación dejan de recorrer un universo de
 * fixtures en memoria y pasan a servirse desde `GET
 * /api/v1/hospital/professionals`, acotados al tenant institucional que el
 * servidor resuelve.
 *
 * COMPOSICIÓN (HOSPITAL-VISUAL-RECOVERY-01-B). El directorio vuelve a ser una
 * cuadrícula de TARJETAS, como la referencia original: iniciales, nombre,
 * profesión del catálogo controlado y estado del perfil institucional, con el
 * vínculo declarado en un bloque compacto. Recuperar la composición NO recupera
 * sus cifras: la tarjeta original pintaba pacientes, visitas de hoy, próxima
 * cita y calificación junto al nombre de una persona, y ninguna de esas
 * afirmaciones se publica aquí. Tampoco vuelve el botón que prometía abrir la
 * agenda de alguien: la agenda servida vive dentro del detalle que ya existe.
 *
 * LO QUE NO CAMBIA: la fuente, los filtros admitidos, la búsqueda, la
 * paginación, la cancelación de respuestas tardías, la selección y el panel
 * lateral de detalle, junto con sus estados y su accesibilidad.
 *
 * GARANTÍAS DE ESTA VISTA:
 *
 * - NO importa ningún fixture de profesionales, pacientes, visitas o consultas
 *   virtuales: no existe repliegue a datos de demostración. Un fallo es un
 *   fallo, y ante error se limpia el estado nominal en lugar de conservar una
 *   respuesta que podría corresponder a otros filtros o a otra sesión;
 * - la vista NO llama a la red: recibe `fetchImpl` y se lo entrega al cliente,
 *   que es la única frontera con la API;
 * - cada consulta viaja con su propio `AbortController`: cambiar de filtro,
 *   página o selección cancela la anterior, de modo que una respuesta tardía no
 *   puede sustituir al estado actual;
 * - la búsqueda se envía con retardo y ya normalizada; no viaja en la URL, no se
 *   registra en telemetría y no se persiste;
 * - no se escribe nada en ningún almacenamiento del navegador: la respuesta es
 *   NOMINAL y no debe sobrevivir a la pestaña;
 * - zona, disponibilidad, conflicto de agenda y calificación numérica NO se
 *   envían ni se muestran: la plataforma no los modela.
 *
 * Que un profesional aparezca en el resultado NO acredita habilitación,
 * contrato, disponibilidad ni derecho de acceso a información de nadie.
 */

const TITULO_ID = 'hospital-profesionales-titulo';
const CONTROLES_ID = 'hospital-profesionales-controles';
const LISTA_ID = 'hospital-profesionales-lista';
const BUSCADOR_ID = 'hospital-profesionales-buscador';
const AYUDA_ID = 'hospital-profesionales-buscador-ayuda';
const ESTADO_ID = 'hospital-profesionales-estado';

/** Retardo de la búsqueda, en milisegundos. */
const RETARDO_BUSQUEDA_MS = 350;

/** Filtro desplegable de catálogo controlado. `''` significa «todas». */
function FiltroSelect({
  id,
  etiqueta,
  valor,
  opciones,
  opcionTodas,
  onCambiar,
}: {
  readonly id: string;
  readonly etiqueta: string;
  readonly valor: string;
  readonly opciones: readonly { readonly code: string; readonly etiqueta: string }[];
  readonly opcionTodas: string;
  readonly onCambiar: (valor: string) => void;
}): ReactNode {
  return (
    <div className={styles.filtro}>
      <label className={styles.filtroEtiqueta} htmlFor={id}>
        {etiqueta}
      </label>
      <select
        id={id}
        className={styles.filtroCampo}
        value={valor}
        onChange={(evento) => {
          onCambiar(evento.target.value);
        }}
      >
        <option value="">{opcionTodas}</option>
        {opciones.map((opcion) => (
          <option key={opcion.code} value={opcion.code}>
            {opcion.etiqueta}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * Estado de la consulta, anunciado como región viva.
 *
 * Nunca acompaña a datos servidos: o hay listado, o hay estado. `reintentar`
 * solo se ofrece cuando repetir la consulta puede cambiar el desenlace.
 */
export function ProfesionalesEstado({
  texto,
  reintentar,
  onReintentar,
}: {
  readonly texto: string;
  readonly reintentar?: string;
  readonly onReintentar?: () => void;
}): ReactNode {
  return (
    <div className={styles.estado}>
      <p className={styles.estadoTexto} id={ESTADO_ID} role="status">
        {texto}
      </p>
      {reintentar === undefined || onReintentar === undefined ? null : (
        <button
          type="button"
          className={`${compartido.button} ${compartido.buttonNeutro}`}
          onClick={onReintentar}
        >
          {reintentar}
        </button>
      )}
    </div>
  );
}

/** Campo declarado del vínculo, dentro de la tarjeta. Siempre lleva su etiqueta. */
function TarjetaCampo({
  etiqueta,
  valor,
}: {
  readonly etiqueta: string;
  readonly valor: string;
}): ReactNode {
  return (
    <div className={styles.tarjetaCampo}>
      <dt className={styles.tarjetaEtiqueta}>{etiqueta}</dt>
      <dd className={styles.tarjetaValor}>{valor}</dd>
    </div>
  );
}

/**
 * Tarjeta del directorio servido. No deriva ni completa ningún valor.
 *
 * Publica EXCLUSIVAMENTE lo que la respuesta trae para esa persona: iniciales,
 * nombre, profesión del catálogo controlado, estado del PERFIL institucional
 * —que no es disponibilidad, turno ni presencia— y, cuando existe, el vínculo
 * declarado con su tipo, su estado y sus fechas. Cuando no hay vínculo vigente
 * se dice, en lugar de dejar el bloque en blanco o de inventarlo.
 */
export function ProfesionalTarjeta({
  profesional,
  copy,
  abierta,
  onVer,
}: {
  readonly profesional: HospitalProfesionalListadoDto;
  readonly copy: HospitalProfessionalsCopy;
  readonly abierta: boolean;
  readonly onVer: (disparador: HTMLButtonElement | null) => void;
}): ReactNode {
  const perfil = estadoPerfil(profesional.status);
  const vinculo = profesional.activeAffiliation;

  return (
    <li className={abierta ? `${styles.tarjeta} ${styles.tarjetaActiva}` : styles.tarjeta}>
      <div className={styles.tarjetaCabecera}>
        <span className={`${styles.iniciales} ${styles.inicialesTarjeta}`} aria-hidden="true">
          {profesional.initials}
        </span>
        <div className={styles.tarjetaTextos}>
          <h3 className={styles.tarjetaNombre}>{profesional.fullName}</h3>
          <p className={styles.tarjetaProfesion}>
            {etiquetaProfesion(profesional.professionCode, profesional.professionName)}
          </p>
        </div>
        {/*
         * Estado del PERFIL, con su texto siempre visible: el color acompaña,
         * nunca sustituye a la palabra.
         */}
        <HospitalBadge tono={perfil.tono} className={styles.tarjetaEstado}>
          {perfil.etiqueta}
        </HospitalBadge>
      </div>

      {vinculo === null ? (
        <p className={styles.sinDato}>{copy.panel.sinVinculo}</p>
      ) : (
        <dl className={styles.tarjetaCampos}>
          <TarjetaCampo
            etiqueta={copy.panel.etiquetaTipo}
            valor={etiquetaVinculo(vinculo.engagementType)}
          />
          <TarjetaCampo
            etiqueta={copy.panel.etiquetaEstadoVinculo}
            valor={etiquetaEstadoVinculo(vinculo.status)}
          />
          <TarjetaCampo
            etiqueta={copy.panel.etiquetaInicio}
            valor={textoFecha(vinculo.startsOn)}
          />
          <TarjetaCampo etiqueta={copy.panel.etiquetaFin} valor={textoFecha(vinculo.endsOn)} />
        </dl>
      )}

      <button
        type="button"
        className={`${compartido.button} ${compartido.buttonNeutro} ${styles.tarjetaAccion}`}
        aria-expanded={abierta}
        aria-controls={abierta ? HOSPITAL_DETALLE_PANEL_ID : undefined}
        onClick={(evento) => {
          onVer(evento.currentTarget);
        }}
      >
        {copy.accionVer}
        <span className="merdn-sr-only">{` de ${profesional.fullName}`}</span>
      </button>
    </li>
  );
}

export function HospitalProfessionals({
  copy = hospitalProfesionalesCore,
  fetchImpl,
  filtrosIniciales,
  paginaInicial = 1,
  tamanoInicial = HOSPITAL_PROFESIONALES_TAMANO_INICIAL,
  listaInicial = null,
  detalleInicial = null,
}: {
  readonly copy?: HospitalProfessionalsCopy;
  /**
   * Implementación de `fetch` que consulta la API.
   *
   * Se inyecta para poder probar la serialización, la cancelación y cada código
   * de estado sin jsdom y sin red, que es como se prueba el resto del frontend
   * de este repositorio. La vista NO la invoca: se la entrega al cliente.
   */
  readonly fetchImpl?: typeof fetch;
  /** Filtros aplicados al montar. No persisten y no proceden de la URL. */
  readonly filtrosIniciales?: Partial<HospitalProfesionalesFiltros>;
  readonly paginaInicial?: number;
  readonly tamanoInicial?: number;
  /**
   * Listado ya servido.
   *
   * Cuando se aporta, la vista NO consulta la red: permite probar la superficie
   * conectada sin jsdom, igual que `sesionInicial` en `HospitalShell`. No es un
   * fixture: es el mismo DTO que devuelve la API.
   */
  readonly listaInicial?: HospitalProfesionalesListaDto | null;
  /** Detalle ya servido, con el mismo propósito que `listaInicial`. */
  readonly detalleInicial?: HospitalProfesionalDetalleDto | null;
}): ReactNode {
  const [filtros, setFiltros] = useState<HospitalProfesionalesFiltros>(() => ({
    ...HOSPITAL_PROFESIONALES_FILTROS_VACIOS,
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
  const [pagina, setPagina] = useState<number>(paginaInicial);
  const [reintento, setReintento] = useState<number>(0);

  const [estado, setEstado] = useState<HospitalProfesionalesEstado>(
    listaInicial === null ? 'cargando' : 'listo',
  );
  const [lista, setLista] = useState<HospitalProfesionalesListaDto | null>(listaInicial);

  const [abiertaId, setAbiertaId] = useState<string | null>(
    detalleInicial === null ? null : detalleInicial.professionalId,
  );
  const [detalle, setDetalle] = useState<HospitalProfesionalDetalleDto | null>(detalleInicial);
  const [detalleAusente, setDetalleAusente] = useState<boolean>(false);

  const panelRef = useRef<HTMLElement>(null);
  /** Botón `Ver` que abrió el panel; recibe el foco al cerrarlo. */
  const disparadorRef = useRef<HTMLButtonElement | null>(null);

  /** Filtros efectivamente consultados: el campo de texto ya estabilizado. */
  const filtrosEnviados = useMemo<HospitalProfesionalesFiltros>(
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
      setAbiertaId(null);
      setDetalle(null);
      setDetalleAusente(false);
    }, RETARDO_BUSQUEDA_MS);

    return (): void => {
      clearTimeout(temporizador);
    };
    /*
     * Dependencias acotadas al texto a propósito: las funciones auxiliares se
     * redefinen en cada render y añadirlas reiniciaría el temporizador sin
     * cesar, de modo que la búsqueda no llegaría a enviarse nunca.
     */
  }, [filtros.search, busquedaEnviada]);

  /* Consulta del listado. Se cancela al cambiar cualquier criterio. */
  useEffect(() => {
    if (listaInicial !== null) {
      // Listado inyectado: no se consulta la red.
      return undefined;
    }

    const controller = new AbortController();
    let vigente = true;

    setEstado('cargando');

    const consulta = serializarProfesionales(
      filtrosEnviados,
      pagina,
      tamanoInicial,
      'name',
      'asc',
    );

    void consultarProfesionales(consulta, fetchImpl ?? fetch, controller.signal).then(
      (resultado) => {
        /*
         * Una respuesta tardía —o cancelada— nunca sustituye al estado actual:
         * `vigente` la descarta aunque el `AbortSignal` no llegara a tiempo.
         */
        if (!vigente || resultado.kind === 'cancelado') {
          return;
        }

        if (resultado.kind === 'ok') {
          setLista(resultado.datos);
          setEstado('listo');

          return;
        }

        /*
         * Ante cualquier fallo se limpia el estado nominal: conservar la
         * respuesta anterior mezclaría datos de otros filtros o de otra sesión.
         */
        setLista(null);
        setAbiertaId(null);
        setDetalle(null);
        setDetalleAusente(false);
        setEstado(estadoDeDesenlace(resultado.kind));
      },
    );

    return (): void => {
      vigente = false;
      controller.abort();
    };
  }, [filtrosEnviados, pagina, tamanoInicial, reintento, fetchImpl, listaInicial]);

  /* Detalle nominal. Se cancela al cambiar de selección o al cerrar. */
  useEffect(() => {
    if (abiertaId === null || detalleInicial !== null) {
      return undefined;
    }

    const controller = new AbortController();
    let vigente = true;

    setDetalle(null);
    setDetalleAusente(false);

    void consultarProfesional(abiertaId, null, fetchImpl ?? fetch, controller.signal).then(
      (resultado) => {
        if (!vigente || resultado.kind === 'cancelado') {
          return;
        }

        if (resultado.kind === 'ok') {
          setDetalle(resultado.datos);

          return;
        }

        /*
         * Cualquier fallo del detalle cierra el panel y muestra un estado
         * seguro: el registro ya no está disponible para esta sesión. No se
         * conserva nada nominal.
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
  }, [abiertaId, fetchImpl, detalleInicial]);

  /* El panel se enfoca cuando ya está montado, no durante el evento del clic. */
  useEffect(() => {
    if (detalle !== null) {
      panelRef.current?.focus();
    }
  }, [detalle]);

  /** Cambiar cualquier criterio vuelve a la página 1 y cierra el detalle. */
  function actualizarFiltros(cambio: Partial<HospitalProfesionalesFiltros>): void {
    setFiltros((actual) => ({ ...actual, ...cambio }));

    // El texto se estabiliza aparte; el resto se aplica de inmediato.
    if (!('search' in cambio)) {
      setPagina(1);
      cerrarPanel();
    }
  }

  function limpiar(): void {
    setFiltros(HOSPITAL_PROFESIONALES_FILTROS_VACIOS);
    setBusquedaEnviada('');
    setPagina(1);
    cerrarPanel();
  }

  function cerrarPanel(): void {
    setAbiertaId(null);
    setDetalle(null);
    setDetalleAusente(false);
  }

  const encabezado = <HospitalViewHeader encabezado={copy.encabezado} tituloId={TITULO_ID} />;

  if (estado !== 'listo' || lista === null) {
    return (
      <div className={compartido.view}>
        {encabezado}
        <HospitalCard gap={16}>
          <ProfesionalesEstado
            texto={textoDeEstado(copy.estados, estado)}
            {...(ofreceReintento(estado)
              ? {
                  reintentar: copy.estados.reintentar,
                  onReintentar: (): void => {
                    setReintento((actual) => actual + 1);
                  },
                }
              : {})}
          />
        </HospitalCard>
        <HospitalNote>{copy.nota}</HospitalNote>
      </div>
    );
  }

  const hayFiltros = !filtrosProfesionalesVacios(filtrosEnviados);
  const rango = rangoDePagina(lista);
  const vacio = lista.totalItems === 0 && !hayFiltros;
  const sinResultados = lista.totalItems === 0 && hayFiltros;

  return (
    <div className={compartido.view}>
      {encabezado}

      <HospitalCard gap={16} className={styles.controles} aria-labelledby={CONTROLES_ID}>
        <h2 className="merdn-sr-only" id={CONTROLES_ID}>
          Buscar y filtrar profesionales
        </h2>

        <div className={styles.busqueda}>
          <label className={styles.busquedaEtiqueta} htmlFor={BUSCADOR_ID}>
            {copy.busqueda.etiqueta}
          </label>
          <span className={styles.busquedaCampo}>
            <span className={styles.busquedaIcono} aria-hidden="true">
              <HospitalIcon name="buscar" size={18} />
            </span>
            <input
              id={BUSCADOR_ID}
              type="search"
              className={styles.busquedaInput}
              placeholder={copy.busqueda.etiqueta}
              aria-describedby={AYUDA_ID}
              value={filtros.search}
              onChange={(evento) => {
                actualizarFiltros({ search: evento.target.value });
              }}
            />
          </span>
          <p className={styles.busquedaAyuda} id={AYUDA_ID}>
            {copy.busqueda.ayuda}
          </p>
        </div>

        <div className={styles.filtros}>
          <FiltroSelect
            id="hospital-profesionales-filtro-profesion"
            etiqueta={copy.filtros.profesion}
            valor={filtros.professionCode}
            opciones={HOSPITAL_PROFESIONES}
            opcionTodas={copy.opcionTodas}
            onCambiar={(valor) => {
              actualizarFiltros({ professionCode: valor });
            }}
          />
          <FiltroSelect
            id="hospital-profesionales-filtro-vinculo"
            etiqueta={copy.filtros.vinculo}
            valor={filtros.affiliationType}
            opciones={HOSPITAL_TIPOS_VINCULO}
            opcionTodas={copy.opcionTodas}
            onCambiar={(valor) => {
              actualizarFiltros({
                affiliationType: valor as HospitalProfesionalesFiltros['affiliationType'],
              });
            }}
          />
          <FiltroSelect
            id="hospital-profesionales-filtro-estado"
            etiqueta={copy.filtros.estado}
            valor={filtros.status}
            opciones={HOSPITAL_ESTADOS_PERFIL}
            opcionTodas={copy.opcionTodas}
            onCambiar={(valor) => {
              actualizarFiltros({ status: valor as HospitalProfesionalesFiltros['status'] });
            }}
          />
        </div>
      </HospitalCard>

      <div className={detalle === null ? styles.disposicion : styles.disposicionConPanel}>
        <div className={styles.columnaLista}>
          <HospitalCard gap={0} className={styles.listaCard} aria-labelledby={LISTA_ID}>
            <HospitalCardHeader
              titulo={copy.listaTitulo}
              tituloId={LISTA_ID}
              extra={
                <div className={styles.resumen}>
                  <span className={styles.resumenTexto} role="status">
                    {`${String(lista.totalItems)} ${copy.resumen}`}
                  </span>
                  {hayFiltros ? (
                    <button
                      type="button"
                      className={`${compartido.button} ${compartido.buttonNeutro} ${styles.limpiar}`}
                      onClick={limpiar}
                    >
                      {copy.busqueda.limpiar}
                    </button>
                  ) : null}
                </div>
              }
            />

            {detalleAusente ? (
              <p className={styles.estadoTexto} role="status">
                {copy.estados.noEncontrado}
              </p>
            ) : null}

            {vacio ? <p className={styles.vacio}>{copy.estados.vacio}</p> : null}
            {sinResultados ? (
              <p className={styles.vacio} role="status">
                {copy.estados.sinResultados}
              </p>
            ) : null}

            {lista.items.length === 0 ? null : (
              <ul className={styles.tarjetas} aria-labelledby={LISTA_ID}>
                {lista.items.map((profesional) => (
                  <ProfesionalTarjeta
                    key={profesional.professionalId}
                    profesional={profesional}
                    copy={copy}
                    abierta={profesional.professionalId === abiertaId}
                    onVer={(disparador) => {
                      disparadorRef.current = disparador;
                      setAbiertaId((actual) =>
                        actual === profesional.professionalId
                          ? null
                          : profesional.professionalId,
                      );
                    }}
                  />
                ))}
              </ul>
            )}

            {lista.totalItems === 0 ? null : (
              <nav className={styles.paginacion} aria-label={copy.paginacion.etiqueta}>
                <p className={styles.paginacionTexto}>
                  {`${String(rango.desde)}–${String(rango.hasta)} de ${String(lista.totalItems)} · página ${String(lista.page)} de ${String(lista.totalPages)}`}
                </p>
                <button
                  type="button"
                  className={`${compartido.button} ${compartido.buttonNeutro}`}
                  disabled={lista.page <= 1}
                  onClick={() => {
                    setPagina(lista.page - 1);
                    cerrarPanel();
                  }}
                >
                  {copy.paginacion.anterior}
                </button>
                <button
                  type="button"
                  className={`${compartido.button} ${compartido.buttonNeutro}`}
                  disabled={lista.page >= lista.totalPages}
                  onClick={() => {
                    setPagina(lista.page + 1);
                    cerrarPanel();
                  }}
                >
                  {copy.paginacion.siguiente}
                </button>
              </nav>
            )}
          </HospitalCard>
        </div>

        {detalle === null ? null : (
          <div className={styles.columnaPanel}>
            <ProfessionalDetailPanel
              detalle={detalle}
              copy={copy}
              referencia={panelRef}
              onCerrar={() => {
                cerrarPanel();
                disparadorRef.current?.focus();
              }}
            />
          </div>
        )}
      </div>

      <HospitalNote>{copy.nota}</HospitalNote>
    </div>
  );
}
