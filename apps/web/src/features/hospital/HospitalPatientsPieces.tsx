import type { CSSProperties, ReactNode, Ref } from 'react';

import { HospitalIcon } from './HospitalIcon';
import styles from './hospitalPatients.module.css';
import {
  HOSPITAL_POBLACION_AYUDA_DESHABILITADO,
  HOSPITAL_POBLACION_ESTADOS,
  HOSPITAL_POBLACION_NO_DISPONIBLE,
  HOSPITAL_POBLACION_PROCEDENCIA,
  type HospitalPoblacionColumna,
} from './hospitalPatientsConfig';
import {
  HOSPITAL_ORDENES,
  HOSPITAL_TAMANOS_PAGINA,
  filtrosActivos,
  type HospitalAnaliticaDto,
  type HospitalCeldaDto,
  type HospitalDetalleDto,
  type HospitalDistribucionDto,
  type HospitalFiltros,
  type HospitalInterseccionDto,
  type HospitalListadoDto,
  type HospitalOrdenId,
  type HospitalPacienteListadoDto,
  type HospitalPrioridadesDto,
  type HospitalSentido,
  type HospitalTerritorioDto,
} from './hospitalPatientsClient';
import {
  POBLACION_ETIQUETA_PRIORIDAD,
  formatearNumero,
  textoFechaCorte,
  textoPorcentaje,
} from './hospitalPopulationTypes';
import { HospitalCard, hospitalViewStyles as compartido } from './HospitalViewPieces';

/**
 * Piezas de «Pacientes» conectadas a CORE-01
 * (TASK-003H-03B §4 · composición; TASK-HOSPITAL-CORE-01 §4.3 y §10).
 *
 * La COMPOSICIÓN aprobada se conserva íntegra: encabezado con procedencia, KPI
 * compactos, zona única de filtros, listado lineal paginado, columna analítica y
 * panel lateral de detalle. Lo que cambia es la FUENTE —PostgreSQL en lugar de
 * un fixture— y, en consecuencia, qué puede afirmarse.
 *
 * CAPACIDADES VISIBLES PERO NO DISPONIBLES (§4.3). Los espacios de Condición
 * principal, Profesional, Cuidador, Programa, Próxima atención, Patologías y
 * Semáforo se CONSERVAN y se representan con `Información no disponible`. No se
 * escribe `Sin asignar`, ni un cero, ni un porcentaje, ni un color de semáforo:
 * CORE-01 no modela esos dominios y la plataforma no puede distinguir «no
 * tiene» de «no está registrado». Los controles que dependen de ellos quedan
 * VISIBLES y deshabilitados, con ayuda accesible asociada, y no se envían nunca
 * a la API.
 *
 * COMPOSICIÓN DE LA FICHA (HOSPITAL-VISUAL-RECOVERY-01-A). El panel de detalle
 * recupera la jerarquía de la referencia visual original —cabecera con
 * iniciales, nombre y línea de resumen; fila de clasificaciones; cuadrícula
 * densa del expediente; y bloque de historial— SIN recuperar ninguno de sus
 * datos: cada valor visible procede del `HospitalDetalleDto` servido.
 *
 * Accesibilidad: ningún estado se comunica solo por color. Las barras y la dona
 * son decorativas y siempre van acompañadas de su valor como texto; cada gráfico
 * ofrece además su tabla de valores; cada control deshabilitado explica por qué
 * mediante `aria-describedby`.
 *
 * Ninguna pieza consulta la red, calcula métricas ni conoce el fixture: todas
 * reciben datos ya servidos y controladores por propiedades tipadas.
 */

/** Une clases opcionales sin dependencias externas. */
function clases(...valores: readonly (string | undefined | false)[]): string {
  return valores.filter((valor): valor is string => typeof valor === 'string').join(' ');
}

/** Identificador de la ayuda accesible compartida por los controles inertes. */
export const AYUDA_NO_DISPONIBLE_ID = 'hospital-poblacion-ayuda-no-disponible';

/**
 * Celda de un dominio que CORE-01 no modela.
 *
 * Se marca con `data-no-disponible` para que las pruebas puedan distinguirla de
 * un dato real ausente, y se anuncia con su texto completo a lectores de
 * pantalla: la ausencia no se comunica con un guion ni con un color.
 */
function NoDisponible(): ReactNode {
  return (
    <span className={styles.sinPrioridad} data-no-disponible="true">
      {HOSPITAL_POBLACION_NO_DISPONIBLE}
    </span>
  );
}

/* ========================================================================== */
/* Encabezado                                                                 */
/* ========================================================================== */

/** Encabezado en una fila: título, texto breve, procedencia y fecha de corte. */
export function PoblacionEncabezado({
  titulo,
  descripcion,
  badge,
  corte,
  tituloId,
}: {
  readonly titulo: string;
  readonly descripcion: string;
  /** Procedencia REAL de las cifras. Ya no es un badge demostrativo. */
  readonly badge: string;
  /**
   * Fecha de corte redactada a partir del valor del SERVIDOR. Es `null` mientras
   * la consulta no ha respondido: no se inventa una fecha provisional.
   */
  readonly corte: string | null;
  readonly tituloId: string;
}): ReactNode {
  return (
    <div className={styles.encabezado}>
      <div className={styles.encabezadoTextos}>
        <h1 className={styles.encabezadoTitulo} id={tituloId}>
          {titulo}
        </h1>
        <p className={styles.encabezadoIntro}>{descripcion}</p>
      </div>
      <div className={styles.encabezadoMarcas}>
        <span className={styles.badgeDatos}>{badge}</span>
        {corte === null ? null : <span className={styles.corte}>{corte}</span>}
      </div>
    </div>
  );
}

/* ========================================================================== */
/* KPI                                                                        */
/* ========================================================================== */

/**
 * Cifras compactas del conjunto filtrado.
 *
 * No son controles: no filtran, no navegan y no ocultan ninguna acción tras el
 * clic. Son CONTEOS de los registros persistidos, no indicadores oficiales.
 */
export function PoblacionKpiGrid({
  cifras,
  etiquetaAccesible,
}: {
  readonly cifras: readonly HospitalCeldaDto[];
  readonly etiquetaAccesible: string;
}): ReactNode {
  return (
    <ul className={styles.kpiGrid} aria-label={etiquetaAccesible}>
      {cifras.map((tarjeta) => (
        <li className={styles.kpiCard} key={tarjeta.key}>
          <span className={styles.kpiEtiqueta}>{tarjeta.label}</span>
          <span className={styles.kpiValor}>{formatearNumero(tarjeta.value)}</span>
          <span className={styles.kpiPorcentaje}>
            {`${textoPorcentaje(tarjeta.percentage)} del conjunto filtrado`}
          </span>
        </li>
      ))}

      {/*
       * Los dos indicadores del diseño aprobado que CORE-01 no sostiene
       * conservan su espacio y declaran por qué no hay cifra. Un cero aquí
       * afirmaría que se midió y no hay nadie sin cuidador ni sin profesional.
       */}
      {[
        { id: 'sin-cuidador', etiqueta: 'Sin cuidador' },
        { id: 'sin-profesional', etiqueta: 'Sin profesional' },
      ].map((hueco) => (
        <li
          className={styles.kpiCard}
          key={hueco.id}
          data-no-disponible="true"
          aria-describedby={AYUDA_NO_DISPONIBLE_ID}
        >
          <span className={styles.kpiEtiqueta}>{hueco.etiqueta}</span>
          <span className={styles.kpiPorcentaje}>{HOSPITAL_POBLACION_NO_DISPONIBLE}</span>
        </li>
      ))}
    </ul>
  );
}

/* ========================================================================== */
/* Filtros                                                                    */
/* ========================================================================== */

/** Selector de un filtro soportado por la API. */
function FiltroSelect({
  id,
  etiqueta,
  valor,
  opciones,
  onCambiar,
}: {
  readonly id: string;
  readonly etiqueta: string;
  readonly valor: string;
  readonly opciones: readonly { readonly valor: string; readonly etiqueta: string }[];
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
        <option value="">{`Todas · ${etiqueta.toLocaleLowerCase('es-CO')}`}</option>
        {opciones.map((opcion) => (
          <option key={opcion.valor} value={opcion.valor}>
            {opcion.etiqueta}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * Selector conservado del diseño aprobado pero INERTE.
 *
 * Permanece visible y deshabilitado con su ayuda accesible: ocultarlo escondería
 * una capacidad prevista, y habilitarlo prometería un filtrado inexistente.
 * Nunca produce un parámetro de consulta.
 */
function FiltroNoDisponible({
  id,
  etiqueta,
}: {
  readonly id: string;
  readonly etiqueta: string;
}): ReactNode {
  return (
    <div className={styles.filtro} data-no-disponible="true">
      <label className={styles.filtroEtiqueta} htmlFor={id}>
        {etiqueta}
      </label>
      <select
        id={id}
        className={styles.filtroCampo}
        value=""
        disabled
        aria-describedby={AYUDA_NO_DISPONIBLE_ID}
        onChange={() => undefined}
      >
        <option value="">{HOSPITAL_POBLACION_NO_DISPONIBLE}</option>
      </select>
    </div>
  );
}

/** Chip toggle de una condición prioritaria soportada. */
function ChipRapido({
  etiqueta,
  activo,
  onAlternar,
}: {
  readonly etiqueta: string;
  readonly activo: boolean;
  readonly onAlternar: () => void;
}): ReactNode {
  return (
    <button
      type="button"
      aria-pressed={activo}
      className={clases(styles.chip, activo && styles.chipActivo)}
      onClick={onAlternar}
    >
      {etiqueta}
    </button>
  );
}

const FILTRO_ID = 'hospital-poblacion-filtro';

/** Opción de un selector alimentado por la analítica del servidor. */
export interface PoblacionOpcion {
  readonly valor: string;
  readonly etiqueta: string;
}

/** Opciones derivadas EXCLUSIVAMENTE de la analítica servida. */
export interface PoblacionOpcionesCore {
  readonly eps: readonly PoblacionOpcion[];
  readonly municipio: readonly PoblacionOpcion[];
}

/**
 * Zona única de filtros.
 *
 * Primera fila: búsqueda y acceso al panel. Segunda: los selectores soportados
 * y los conservados como no disponibles. Tercera: chips, contador y limpiar.
 *
 * Las opciones de EPS y municipio proceden de la ANALÍTICA del servidor, no de
 * un catálogo local: así el desplegable nunca ofrece un valor que la consulta no
 * pueda satisfacer, ni mezcla catálogos demostrativos con cifras reales.
 */
export function PoblacionFiltrosZona({
  filtros,
  opciones,
  opcionesAbiertas,
  encontrados,
  hayFiltros,
  onFiltro,
  onLimpiar,
  onAlternarPanel,
}: {
  readonly filtros: HospitalFiltros;
  readonly opciones: PoblacionOpcionesCore;
  readonly opcionesAbiertas: boolean;
  /** `null` mientras la consulta no ha respondido: no se muestra un cero. */
  readonly encontrados: number | null;
  readonly hayFiltros: boolean;
  readonly onFiltro: (cambio: Partial<HospitalFiltros>) => void;
  readonly onLimpiar: () => void;
  readonly onAlternarPanel: () => void;
}): ReactNode {
  return (
    <section className={styles.filtrosZona} aria-labelledby={`${FILTRO_ID}-titulo`}>
      <h2 className="merdn-sr-only" id={`${FILTRO_ID}-titulo`}>
        Buscar y segmentar pacientes
      </h2>

      {/* Ayuda accesible compartida por todo control y celda no disponible. */}
      <p className="merdn-sr-only" id={AYUDA_NO_DISPONIBLE_ID}>
        {HOSPITAL_POBLACION_AYUDA_DESHABILITADO}
      </p>

      <div className={styles.filtrosCabecera}>
        <div className={styles.busqueda}>
          <label className={styles.filtroEtiqueta} htmlFor={`${FILTRO_ID}-texto`}>
            Búsqueda
          </label>
          <span className={styles.busquedaCampo}>
            <span className={styles.busquedaIcono} aria-hidden="true">
              <HospitalIcon name="buscar" size={18} />
            </span>
            <input
              id={`${FILTRO_ID}-texto`}
              type="search"
              className={styles.busquedaInput}
              placeholder="Nombre o documento"
              value={filtros.search}
              onChange={(evento) => {
                onFiltro({ search: evento.target.value });
              }}
            />
          </span>
        </div>

        <button
          type="button"
          className={clases(compartido.button, compartido.buttonNeutro, styles.panelBoton)}
          aria-expanded={opcionesAbiertas}
          aria-controls={`${FILTRO_ID}-opciones`}
          onClick={onAlternarPanel}
        >
          {`Filtros (${String(filtrosActivos(filtros))})`}
        </button>
      </div>

      <div
        className={styles.filtrosCampos}
        id={`${FILTRO_ID}-opciones`}
        data-abierto={opcionesAbiertas ? 'si' : 'no'}
      >
        <div className={styles.filtro}>
          <label className={styles.filtroEtiqueta} htmlFor={`${FILTRO_ID}-edad-min`}>
            Edad desde
          </label>
          <input
            id={`${FILTRO_ID}-edad-min`}
            type="number"
            min={0}
            max={130}
            inputMode="numeric"
            className={styles.filtroCampo}
            value={filtros.ageMin}
            onChange={(evento) => {
              onFiltro({ ageMin: evento.target.value });
            }}
          />
        </div>
        <div className={styles.filtro}>
          <label className={styles.filtroEtiqueta} htmlFor={`${FILTRO_ID}-edad-max`}>
            Edad hasta
          </label>
          <input
            id={`${FILTRO_ID}-edad-max`}
            type="number"
            min={0}
            max={130}
            inputMode="numeric"
            className={styles.filtroCampo}
            value={filtros.ageMax}
            onChange={(evento) => {
              onFiltro({ ageMax: evento.target.value });
            }}
          />
        </div>

        <FiltroSelect
          id={`${FILTRO_ID}-condicion`}
          etiqueta="Condición"
          valor={filtros.populationType}
          opciones={[
            { valor: 'DISABILITY', etiqueta: POBLACION_ETIQUETA_PRIORIDAD.DISABILITY },
            {
              valor: 'HOME_CARE_REQUIRED',
              etiqueta: POBLACION_ETIQUETA_PRIORIDAD.HOME_CARE_REQUIRED,
            },
          ]}
          onCambiar={(valor) => {
            onFiltro({ populationType: valor as HospitalFiltros['populationType'] });
          }}
        />
        <FiltroSelect
          id={`${FILTRO_ID}-eps`}
          etiqueta="EPS"
          valor={filtros.epsCode}
          opciones={opciones.eps}
          onCambiar={(valor) => {
            onFiltro({ epsCode: valor });
          }}
        />

        {/* Dominios ausentes de CORE-01: visibles, inertes y explicados. */}
        <FiltroNoDisponible id={`${FILTRO_ID}-patologia`} etiqueta="Patología" />
        <FiltroNoDisponible id={`${FILTRO_ID}-profesional`} etiqueta="Profesional" />
        <FiltroNoDisponible id={`${FILTRO_ID}-cuidador`} etiqueta="Cuidador" />
        <FiltroNoDisponible id={`${FILTRO_ID}-programa`} etiqueta="Programa" />

        <FiltroSelect
          id={`${FILTRO_ID}-municipio`}
          etiqueta="Municipio"
          valor={filtros.municipalityOfficialCode}
          opciones={opciones.municipio}
          onCambiar={(valor) => {
            onFiltro({ municipalityOfficialCode: valor });
          }}
        />
        <FiltroSelect
          id={`${FILTRO_ID}-area`}
          etiqueta="Zona"
          valor={filtros.areaType}
          opciones={[
            { valor: 'URBAN', etiqueta: 'Urbana' },
            { valor: 'RURAL', etiqueta: 'Rural' },
          ]}
          onCambiar={(valor) => {
            onFiltro({ areaType: valor as HospitalFiltros['areaType'] });
          }}
        />
        <FiltroNoDisponible id={`${FILTRO_ID}-estado`} etiqueta="Estado" />
      </div>

      <div className={styles.filtrosPie}>
        <div className={styles.chips} role="group" aria-label="Filtros rápidos combinables">
          <ChipRapido
            etiqueta="60+"
            activo={filtros.older60}
            onAlternar={() => {
              onFiltro({ older60: !filtros.older60 });
            }}
          />
          <ChipRapido
            etiqueta={POBLACION_ETIQUETA_PRIORIDAD.DISABILITY}
            activo={filtros.populationType === 'DISABILITY'}
            onAlternar={() => {
              onFiltro({
                populationType: filtros.populationType === 'DISABILITY' ? '' : 'DISABILITY',
              });
            }}
          />
          <ChipRapido
            etiqueta={POBLACION_ETIQUETA_PRIORIDAD.HOME_CARE_REQUIRED}
            activo={filtros.populationType === 'HOME_CARE_REQUIRED'}
            onAlternar={() => {
              onFiltro({
                populationType:
                  filtros.populationType === 'HOME_CARE_REQUIRED' ? '' : 'HOME_CARE_REQUIRED',
              });
            }}
          />
        </div>

        <p className={styles.contador} role="status">
          {encontrados === null
            ? 'Consultando…'
            : `${formatearNumero(encontrados)} pacientes encontrados`}
        </p>

        <button
          type="button"
          className={clases(compartido.button, compartido.buttonNeutro, styles.limpiar)}
          disabled={!hayFiltros}
          onClick={onLimpiar}
        >
          Limpiar filtros
        </button>
      </div>
    </section>
  );
}

/* ========================================================================== */
/* Listado                                                                    */
/* ========================================================================== */

/** Rótulos visibles de los criterios de orden SOPORTADOS. */
const ETIQUETA_ORDEN: Record<HospitalOrdenId, string> = {
  name: 'Nombre',
  age: 'Edad',
  status: 'Estado',
};

/**
 * Barra del listado: conteo, tamaño de página, orden y sentido.
 *
 * `Ordenar por Próxima atención` permanece VISIBLE y deshabilitado: la agenda no
 * existe en CORE-01 y ordenar por ella produciría un orden inventado.
 */
export function PoblacionBarraListado({
  total,
  tamano,
  orden,
  sentido,
  onTamano,
  onOrden,
  onSentido,
}: {
  readonly total: number;
  readonly tamano: number;
  readonly orden: HospitalOrdenId;
  readonly sentido: HospitalSentido;
  readonly onTamano: (valor: number) => void;
  readonly onOrden: (valor: HospitalOrdenId) => void;
  readonly onSentido: (valor: HospitalSentido) => void;
}): ReactNode {
  return (
    <div className={styles.barraListado}>
      <p className={styles.barraConteo}>
        {`${formatearNumero(total)} pacientes en el conjunto filtrado`}
      </p>

      <div className={styles.barraControles}>
        <div className={styles.filtro}>
          <label className={styles.filtroEtiqueta} htmlFor="hospital-poblacion-tamano">
            Por página
          </label>
          <select
            id="hospital-poblacion-tamano"
            className={styles.filtroCampo}
            value={String(tamano)}
            onChange={(evento) => {
              onTamano(Number(evento.target.value));
            }}
          >
            {HOSPITAL_TAMANOS_PAGINA.map((opcion) => (
              <option key={opcion} value={String(opcion)}>
                {String(opcion)}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.filtro}>
          <label className={styles.filtroEtiqueta} htmlFor="hospital-poblacion-orden">
            Ordenar por
          </label>
          <select
            id="hospital-poblacion-orden"
            className={styles.filtroCampo}
            value={orden}
            onChange={(evento) => {
              onOrden(evento.target.value as HospitalOrdenId);
            }}
          >
            {HOSPITAL_ORDENES.map((opcion) => (
              <option key={opcion} value={opcion}>
                {ETIQUETA_ORDEN[opcion]}
              </option>
            ))}
            <option value="proxima" disabled>
              {`Próxima atención · ${HOSPITAL_POBLACION_NO_DISPONIBLE}`}
            </option>
          </select>
        </div>

        <div className={styles.filtro}>
          <label className={styles.filtroEtiqueta} htmlFor="hospital-poblacion-sentido">
            Sentido
          </label>
          <select
            id="hospital-poblacion-sentido"
            className={styles.filtroCampo}
            value={sentido}
            onChange={(evento) => {
              onSentido(evento.target.value as HospitalSentido);
            }}
          >
            <option value="asc">Ascendente</option>
            <option value="desc">Descendente</option>
          </select>
        </div>
      </div>
    </div>
  );
}

/** Prioridades activas, en el orden A, B, C. */
function prioridadesDe(prioridades: HospitalPrioridadesDto): readonly string[] {
  const activas: string[] = [];

  if (prioridades.older60) {
    activas.push(POBLACION_ETIQUETA_PRIORIDAD.MAYOR_60);
  }

  if (prioridades.disabilityDeclared) {
    activas.push(POBLACION_ETIQUETA_PRIORIDAD.DISABILITY);
  }

  if (prioridades.homeCareRequiredDeclared) {
    activas.push(POBLACION_ETIQUETA_PRIORIDAD.HOME_CARE_REQUIRED);
  }

  return activas;
}

/**
 * Territorio visible.
 *
 * Una localidad pendiente de normalización se declara como tal: no se muestra el
 * texto libre declarado, que el servidor tampoco envía.
 */
export function textoTerritorio(territorio: HospitalTerritorioDto): string {
  if (territorio.municipalityName === null) {
    return 'Sin territorio registrado';
  }

  const area = territorio.areaType === 'RURAL' ? 'Rural' : 'Urbana';
  const local = territorio.pendingNormalization
    ? 'Pendiente de normalización'
    : (territorio.localUnitName ?? 'Pendiente de normalización');

  return `${territorio.municipalityName} · ${area} · ${local}`;
}

/** Fila compacta de una persona. Una línea por paciente, sin tarjetas. */
function PoblacionFila({
  paciente,
  abierta,
  onVer,
}: {
  readonly paciente: HospitalPacienteListadoDto;
  readonly abierta: boolean;
  readonly onVer: (disparador: HTMLButtonElement) => void;
}): ReactNode {
  const prioridades = prioridadesDe(paciente.priorities);

  return (
    <tr className={clases(styles.fila, abierta && styles.filaActiva)}>
      <td className={styles.celdaPaciente}>
        <span className={styles.pacienteNombre}>{paciente.fullName}</span>
        <span className={styles.pacienteDoc}>{paciente.documentMasked}</span>
      </td>
      <td className={clases(styles.celda, styles.celdaNumero)} data-columna="Edad">
        {String(paciente.age)}
      </td>
      <td className={styles.celda} data-columna="EPS">
        {paciente.epsName}
      </td>
      <td className={styles.celda} data-columna="Prioridades">
        {prioridades.length === 0 ? (
          <span className={styles.sinPrioridad}>Sin clasificación prioritaria</span>
        ) : (
          <span className={styles.prioridades}>
            {prioridades.map((prioridad) => (
              <span className={styles.prioridad} key={prioridad}>
                {prioridad}
              </span>
            ))}
          </span>
        )}
      </td>
      {/*
       * Cinco columnas del diseño aprobado cuyos dominios CORE-01 no modela.
       * Conservan su posición y declaran su ausencia con el MISMO texto.
       */}
      <td className={styles.celda} data-columna="Condición principal">
        <NoDisponible />
      </td>
      <td className={styles.celda} data-columna="Profesional">
        <NoDisponible />
      </td>
      <td className={styles.celda} data-columna="Cuidador">
        <NoDisponible />
      </td>
      <td className={styles.celda} data-columna="Programa">
        <NoDisponible />
      </td>
      <td className={styles.celda} data-columna="Zona/municipio">
        {textoTerritorio(paciente.territory)}
      </td>
      <td className={styles.celda} data-columna="Estado">
        {paciente.statusLabel}
      </td>
      <td className={styles.celda} data-columna="Semáforo">
        <NoDisponible />
      </td>
      <td className={clases(styles.celda, styles.celdaAccion)}>
        <button
          type="button"
          aria-expanded={abierta}
          className={clases(compartido.button, compartido.buttonNeutro, styles.accionVer)}
          onClick={(evento) => {
            onVer(evento.currentTarget);
          }}
        >
          Abrir ficha
          <span className="merdn-sr-only">{` del paciente ${paciente.fullName}`}</span>
        </button>
      </td>
    </tr>
  );
}

/** Tabla lineal con encabezado sticky y desplazamiento horizontal propio. */
export function PoblacionTabla({
  columnas,
  filas,
  abiertaId,
  etiquetaAccesible,
  onVer,
}: {
  readonly columnas: readonly HospitalPoblacionColumna[];
  readonly filas: readonly HospitalPacienteListadoDto[];
  readonly abiertaId: string | null;
  readonly etiquetaAccesible: string;
  readonly onVer: (id: string, disparador: HTMLButtonElement) => void;
}): ReactNode {
  return (
    <div
      className={styles.tablaContenedor}
      role="region"
      aria-label={etiquetaAccesible}
      tabIndex={0}
    >
      <table className={styles.tabla}>
        <caption className="merdn-sr-only">{etiquetaAccesible}</caption>
        <thead>
          <tr>
            {columnas.map((columna) => (
              <th
                key={columna.id}
                scope="col"
                className={clases(
                  styles.encabezadoCelda,
                  columna.soloLectores === true && 'merdn-sr-only',
                )}
              >
                {columna.etiqueta}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((paciente) => (
            <PoblacionFila
              key={paciente.patientId}
              paciente={paciente}
              abierta={paciente.patientId === abiertaId}
              onVer={(disparador) => {
                onVer(paciente.patientId, disparador);
              }}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Paginación inferior: anterior, siguiente, página, total y rango visible. */
export function PoblacionPaginacion({
  listado,
  onPagina,
}: {
  readonly listado: HospitalListadoDto;
  readonly onPagina: (valor: number) => void;
}): ReactNode {
  const desde = listado.totalItems === 0 ? 0 : (listado.page - 1) * listado.pageSize + 1;
  const hasta = (listado.page - 1) * listado.pageSize + listado.items.length;

  return (
    <nav className={styles.paginacion} aria-label="Paginación del listado de pacientes">
      <button
        type="button"
        className={clases(compartido.button, compartido.buttonNeutro)}
        disabled={listado.page <= 1}
        onClick={() => {
          onPagina(listado.page - 1);
        }}
      >
        Anterior
      </button>
      <p className={styles.paginacionTexto} role="status">
        {`Página ${String(listado.page)} de ${String(listado.totalPages)} · ${formatearNumero(
          desde,
        )}–${formatearNumero(hasta)} de ${formatearNumero(listado.totalItems)}`}
      </p>
      <button
        type="button"
        className={clases(compartido.button, compartido.buttonNeutro)}
        disabled={listado.page >= listado.totalPages}
        onClick={() => {
          onPagina(listado.page + 1);
        }}
      >
        Siguiente
      </button>
    </nav>
  );
}

/* ========================================================================== */
/* Analítica                                                                  */
/* ========================================================================== */

/** Colores institucionales de la dona. Nunca son el único medio de lectura. */
const COLORES_DONA: readonly string[] = [
  'var(--b-azul)',
  'var(--b-petroleo)',
  'var(--b-aguamarina)',
  'var(--b-celeste-borde-fuerte)',
  'var(--b-gris)',
  'var(--b-gris-inactivo)',
];

/** Tabla textual de una distribución; alternativa accesible del gráfico. */
function TablaValores({
  distribucion,
  encabezado,
  nota,
}: {
  readonly distribucion: HospitalDistribucionDto;
  readonly encabezado: string;
  readonly nota: string;
}): ReactNode {
  return (
    <table className={styles.tablaValores}>
      <caption className={styles.tablaValoresPie}>{nota}</caption>
      <thead>
        <tr>
          <th scope="col">{encabezado}</th>
          <th scope="col">Pacientes</th>
          <th scope="col">Porcentaje</th>
        </tr>
      </thead>
      <tbody>
        {distribucion.cells.map((celda) => (
          <tr key={celda.key}>
            <th scope="row">{celda.label}</th>
            <td>{formatearNumero(celda.value)}</td>
            <td>{textoPorcentaje(celda.percentage)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Ancho relativo de una barra respecto del valor máximo de su distribución. */
function anchoDe(valor: number, maximo: number): string {
  return maximo === 0 ? '0%' : `${String(Math.round((valor / maximo) * 100))}%`;
}

/**
 * Gráfico de una distribución. `forma` decide la representación: barras
 * horizontales o dona. En ambos casos el valor y el porcentaje se leen como
 * texto junto a la representación, que es puramente decorativa.
 */
export function PoblacionGrafico({
  distribucion,
  forma,
  encabezado,
  nota,
  detalle,
  onDetalle,
}: {
  readonly distribucion: HospitalDistribucionDto;
  readonly forma: 'barras' | 'dona';
  readonly encabezado: string;
  readonly nota: string;
  readonly detalle: boolean;
  readonly onDetalle: () => void;
}): ReactNode {
  const tituloId = `hospital-poblacion-gr-${distribucion.id}`;
  const maximo = distribucion.cells.reduce((mayor, celda) => Math.max(mayor, celda.value), 0);
  const total = distribucion.cells.reduce((suma, celda) => suma + celda.value, 0);

  let acumulado = 0;
  const tramos = distribucion.cells.map((celda, indice) => {
    const inicio = acumulado;
    const grados = total === 0 ? 0 : (celda.value / total) * 360;

    acumulado += grados;

    return `${COLORES_DONA[indice % COLORES_DONA.length] ?? 'var(--b-azul)'} ${String(
      inicio,
    )}deg ${String(acumulado)}deg`;
  });

  return (
    <section className={styles.grafico} aria-labelledby={tituloId}>
      <div className={styles.graficoCabecera}>
        <h3 className={styles.graficoTitulo} id={tituloId}>
          {distribucion.label}
        </h3>
        <button
          type="button"
          aria-expanded={detalle}
          aria-controls={`${tituloId}-detalle`}
          className={clases(compartido.button, compartido.buttonNeutro, styles.graficoDetalle)}
          onClick={onDetalle}
        >
          Ver detalle
          <span className="merdn-sr-only">{` de ${distribucion.label}`}</span>
        </button>
      </div>

      <p className={styles.graficoNota}>{nota}</p>

      {forma === 'dona' ? (
        <div className={styles.dona}>
          <span
            className={styles.donaFigura}
            aria-hidden="true"
            style={{ '--h-dona': `conic-gradient(${tramos.join(', ')})` } as CSSProperties}
          />
          <ul className={styles.donaLeyenda}>
            {distribucion.cells.map((celda, indice) => (
              <li className={styles.donaItem} key={celda.key}>
                <span
                  className={styles.donaMuestra}
                  aria-hidden="true"
                  style={
                    {
                      '--h-dona-color':
                        COLORES_DONA[indice % COLORES_DONA.length] ?? 'var(--b-azul)',
                    } as CSSProperties
                  }
                />
                <span className={styles.donaEtiqueta}>{celda.label}</span>
                <span className={styles.donaValor}>
                  {`${formatearNumero(celda.value)} · ${textoPorcentaje(celda.percentage)}`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <ul className={styles.barras}>
          {distribucion.cells.map((celda) => (
            <li className={styles.barraItem} key={celda.key}>
              <span className={styles.barraEtiqueta}>{celda.label}</span>
              <span className={styles.barraPista} aria-hidden="true">
                <span
                  className={styles.barraRelleno}
                  style={{ '--h-barra-ancho': anchoDe(celda.value, maximo) } as CSSProperties}
                />
              </span>
              <span className={styles.barraValor}>
                {`${formatearNumero(celda.value)} · ${textoPorcentaje(celda.percentage)}`}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className={styles.graficoTabla} id={`${tituloId}-detalle`} hidden={!detalle}>
        <TablaValores distribucion={distribucion} encabezado={encabezado} nota={nota} />
      </div>
    </section>
  );
}

/**
 * Gráfico conservado del diseño aprobado cuyo dominio no existe en CORE-01.
 *
 * Ocupa el mismo lugar de la columna analítica y declara su ausencia. No dibuja
 * barras vacías, no escribe ceros y no ofrece `Ver detalle`: no hay detalle que
 * mostrar y un gráfico plano se leería como «medido y en cero».
 */
export function PoblacionGraficoNoDisponible({
  titulo,
}: {
  readonly titulo: string;
}): ReactNode {
  const tituloId = `hospital-poblacion-gr-nd-${titulo
    .toLocaleLowerCase('es-CO')
    .replace(/[^a-z]+/gu, '-')}`;

  return (
    <section
      className={styles.grafico}
      aria-labelledby={tituloId}
      data-no-disponible="true"
    >
      <div className={styles.graficoCabecera}>
        <h3 className={styles.graficoTitulo} id={tituloId}>
          {titulo}
        </h3>
      </div>
      <p className={styles.graficoNota}>{HOSPITAL_POBLACION_NO_DISPONIBLE}</p>
      <p className={styles.graficoNota}>{HOSPITAL_POBLACION_AYUDA_DESHABILITADO}</p>
    </section>
  );
}

/**
 * Matriz de intersecciones. Las ocho celdas son disjuntas: cada persona cae en
 * exactamente una y la suma reconcilia el universo filtrado. La pertenencia se
 * lee como `Sí`/`No`, nunca por color.
 */
export function PoblacionMatriz({
  intersecciones,
  universo,
}: {
  readonly intersecciones: readonly HospitalInterseccionDto[];
  readonly universo: number;
}): ReactNode {
  const suma = intersecciones.reduce((total, celda) => total + celda.value, 0);

  return (
    <section className={styles.grafico} aria-labelledby="hospital-poblacion-matriz">
      <div className={styles.graficoCabecera}>
        <h3 className={styles.graficoTitulo} id="hospital-poblacion-matriz">
          Intersecciones de condiciones
        </h3>
      </div>
      <p className={styles.graficoNota}>
        Las ocho combinaciones son excluyentes entre sí: nadie se cuenta dos veces y su suma es el
        total de pacientes del conjunto filtrado. Los indicadores solapados no deben sumarse para
        obtener la población total.
      </p>
      <div className={styles.tablaContenedor}>
        <table className={styles.tablaValores}>
          <thead>
            <tr>
              <th scope="col">Combinación</th>
              <th scope="col">60+</th>
              <th scope="col">Discapacidad</th>
              <th scope="col">Cuidados en casa</th>
              <th scope="col">Pacientes</th>
              <th scope="col">Porcentaje</th>
            </tr>
          </thead>
          <tbody>
            {intersecciones.map((celda) => (
              <tr key={celda.key}>
                <th scope="row">{celda.label}</th>
                <td>{celda.older60 ? 'Sí' : 'No'}</td>
                <td>{celda.disabilityDeclared ? 'Sí' : 'No'}</td>
                <td>{celda.homeCareRequiredDeclared ? 'Sí' : 'No'}</td>
                <td>{formatearNumero(celda.value)}</td>
                <td>{textoPorcentaje(celda.percentage)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Suma de las ocho celdas</th>
              <td colSpan={3}>{`Universo: ${formatearNumero(universo)}`}</td>
              <td>{formatearNumero(suma)}</td>
              <td>{suma === universo ? 'Reconcilia' : 'Revisar'}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

/** Notas de lectura de cada distribución servida. */
export const NOTA_DISTRIBUCION: Record<string, string> = {
  'age-ranges':
    'Tramos excluyentes derivados de la fecha de nacimiento contra la fecha de corte del servidor. Suman el total del conjunto filtrado.',
  eps: 'Afiliación registrada en la inscripción. Cada persona cuenta una sola vez.',
  municipality:
    'Municipio canónico de la dirección registrada. Cada persona cuenta una sola vez; quien no declaró dirección aparece sin territorio registrado.',
  'area-type':
    'Área urbana o rural DECLARADA por la persona. No se infiere del texto de la dirección.',
};

/** Encabezado de la primera columna de la tabla de valores de cada gráfico. */
export const ENCABEZADO_DISTRIBUCION: Record<string, string> = {
  'age-ranges': 'Rango de edad',
  eps: 'EPS',
  municipality: 'Municipio',
  'area-type': 'Área',
};

/* ========================================================================== */
/* Panel lateral · ficha del paciente                                         */
/* ========================================================================== */

/**
 * Ayuda accesible LOCAL del panel (HOSPITAL-VISUAL-RECOVERY-01-A).
 *
 * El panel es `aria-modal`, de modo que un `aria-describedby` dirigido a la
 * ayuda de la zona de filtros quedaría fuera del subárbol expuesto mientras el
 * diálogo está abierto. La misma explicación aprobada se repite aquí, solo para
 * lectores de pantalla y con identificador propio, para que cada campo no
 * disponible siga explicando por qué lo está.
 */
const AYUDA_PANEL_ID = 'hospital-poblacion-panel-ayuda';

/** Sección plegable del panel, abierta por defecto. */
function SeccionFicha({
  titulo,
  children,
}: {
  readonly titulo: string;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <details className={styles.seccion} open>
      <summary className={styles.seccionTitulo}>{titulo}</summary>
      <div className={styles.seccionCuerpo}>{children}</div>
    </details>
  );
}

/**
 * Celda etiqueta/valor del expediente.
 *
 * Recupera la densidad de la composición original: rótulo corto en versalitas
 * sobre un valor destacado, dentro de una celda con fondo propio. Un dominio que
 * CORE-01 no modela se marca y se describe; nunca se rellena con un guion, con
 * un cero ni con un texto que parezca un hecho comprobado.
 */
function Campo({
  etiqueta,
  valor,
  noDisponible = false,
}: {
  readonly etiqueta: string;
  readonly valor: string;
  readonly noDisponible?: boolean;
}): ReactNode {
  return (
    <div className={styles.campo} {...(noDisponible ? { 'data-no-disponible': 'true' } : {})}>
      <dt className={styles.campoEtiqueta}>{etiqueta}</dt>
      <dd
        className={styles.campoValor}
        {...(noDisponible ? { 'aria-describedby': AYUDA_PANEL_ID } : {})}
      >
        {valor}
      </dd>
    </div>
  );
}

/** Indicador Sí/No de una clasificación, con su procedencia. */
function Indicador({
  etiqueta,
  activo,
  procedencia,
}: {
  readonly etiqueta: string;
  readonly activo: boolean;
  readonly procedencia: string;
}): ReactNode {
  return (
    <li className={styles.indicador}>
      <span className={styles.indicadorEtiqueta}>{etiqueta}</span>
      <span className={clases(styles.indicadorValor, activo && styles.indicadorActivo)}>
        {activo ? 'Sí' : 'No'}
      </span>
      <span className={styles.indicadorProcedencia}>{procedencia}</span>
    </li>
  );
}

/**
 * Línea de resumen de la cabecera de ficha.
 *
 * Reproduce la lectura de la referencia —edad, documento, EPS y municipio en una
 * sola línea— con los ÚNICOS valores que el servidor sirve. El documento es el
 * que la API ya entrega enmascarado: aquí no se compone ni se revela ninguno.
 */
function resumenDeFicha(detalle: HospitalDetalleDto): string {
  return [
    `${String(detalle.age)} años`,
    detalle.documentMasked,
    detalle.epsName,
    detalle.territory.municipalityName ?? 'Sin territorio registrado',
  ].join(' · ');
}

/**
 * Bloque de historial.
 *
 * La composición original cerraba el expediente con una línea de tiempo. El
 * bloque se CONSERVA —encabezado, carril y nota— porque forma parte de la
 * jerarquía aprobada, pero NO se dibuja ningún día ni ningún evento: CORE-01 no
 * registra atenciones y una fila vacía se leería como un hecho comprobado. Se
 * muestra un único estado neutral, con el mismo texto que el resto de la vista.
 */
function FichaHistorial({ tituloId }: { readonly tituloId: string }): ReactNode {
  return (
    <section className={styles.historial} aria-labelledby={tituloId}>
      <div className={styles.historialCabecera}>
        <h3 className={styles.historialTitulo} id={tituloId}>
          Historial
        </h3>
        <span className={styles.historialMarca}>{HOSPITAL_POBLACION_PROCEDENCIA}</span>
      </div>
      <div className={styles.historialCarril}>
        <p
          className={styles.historialVacio}
          data-no-disponible="true"
          aria-describedby={AYUDA_PANEL_ID}
        >
          {HOSPITAL_POBLACION_NO_DISPONIBLE}
        </p>
      </div>
      <p className={styles.graficoNota}>{HOSPITAL_POBLACION_AYUDA_DESHABILITADO}</p>
    </section>
  );
}

/**
 * Panel lateral `Ver`: ficha/expediente del paciente seleccionado.
 *
 * Diálogo modal: overlay, cierre visible, `Escape` y devolución del foco al
 * botón que lo abrió, que el contenedor resuelve.
 *
 * COMPOSICIÓN (HOSPITAL-VISUAL-RECOVERY-01-A). Recupera la jerarquía de la
 * referencia original: cabecera de ficha con iniciales, nombre y línea de
 * resumen; fila de clasificaciones; cuadrícula densa del expediente; y bloque de
 * historial. Lo que cambia respecto de aquella referencia es EXCLUSIVAMENTE la
 * verdad de los datos: cada valor visible procede del `HospitalDetalleDto` que
 * sirvió el servidor y nada se rellena con el conjunto demostrativo.
 *
 * DONDE LA REFERENCIA ESPERABA lo que CORE-01 no modela —semáforo clínico,
 * condiciones, patologías, atenciones, medicamentos, profesional, cuidador,
 * programa, contacto o historial— se conserva el ESPACIO y se declara la misma
 * ausencia de capacidad. No hay color de riesgo, no hay `Sin asignar`, no hay
 * cero y no hay ningún evento inventado.
 *
 * No hay editar, eliminar, descargar ni exportar.
 */
export function PoblacionPanel({
  detalle,
  avisoHistoria,
  referencia,
  onCerrar,
}: {
  readonly detalle: HospitalDetalleDto;
  readonly avisoHistoria: string;
  readonly referencia: Ref<HTMLDivElement>;
  readonly onCerrar: () => void;
}): ReactNode {
  const tituloId = 'hospital-poblacion-panel-titulo';
  const historialId = 'hospital-poblacion-panel-historial';

  const corte = textoFechaCorte(detalle.asOfDate);
  const clasificaciones = prioridadesDe(detalle.priorities);

  return (
    <div className={styles.overlay}>
      {/*
       * El fondo cierra el panel con el ratón. La misma acción está disponible
       * con teclado en el botón `Cerrar` y con `Escape`, de modo que este
       * elemento decorativo no es la única forma de salir.
       */}
      <div className={styles.overlayFondo} aria-hidden="true" onClick={onCerrar} />
      <div
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        tabIndex={-1}
        ref={referencia}
        onKeyDown={(evento) => {
          if (evento.key === 'Escape') {
            evento.stopPropagation();
            onCerrar();
          }
        }}
      >
        <div className={styles.panelCabecera}>
          <p className={styles.panelEtiqueta}>Ficha del paciente</p>
          <button
            type="button"
            className={clases(compartido.button, compartido.buttonNeutro, styles.panelCerrar)}
            onClick={onCerrar}
          >
            Cerrar
            <span className="merdn-sr-only">{` la ficha de ${detalle.fullName}`}</span>
          </button>
        </div>

        <p className="merdn-sr-only" id={AYUDA_PANEL_ID}>
          {HOSPITAL_POBLACION_AYUDA_DESHABILITADO}
        </p>

        <div className={styles.panelCuerpo}>
          <div className={styles.ficha}>
            <div className={styles.identidad}>
              <span className={styles.iniciales} aria-hidden="true">
                {detalle.initials}
              </span>
              <div className={styles.identidadTextos}>
                <h2 className={styles.nombre} id={tituloId}>
                  {detalle.fullName}
                </h2>
                <p className={styles.meta}>{resumenDeFicha(detalle)}</p>
              </div>
              {/*
               * La referencia colocaba aquí el semáforo clínico. CORE-01 no lo
               * modela y esta plataforma no lo calcula, de modo que el lugar lo
               * ocupa la PROCEDENCIA real de la ficha: de dónde salió el dato y
               * a qué fecha. No es un estado, no clasifica a la persona y no
               * comunica nada por color.
               */}
              <span className={styles.procedencia}>
                {corte === null
                  ? HOSPITAL_POBLACION_PROCEDENCIA
                  : `${HOSPITAL_POBLACION_PROCEDENCIA} · ${corte}`}
              </span>
            </div>

            {clasificaciones.length === 0 ? (
              <p className={styles.sinClasificacion}>Sin clasificación prioritaria declarada</p>
            ) : (
              <ul
                className={styles.clasificaciones}
                aria-label="Clasificaciones prioritarias declaradas"
              >
                {clasificaciones.map((clasificacion) => (
                  <li className={styles.clasificacion} key={clasificacion}>
                    <HospitalIcon name="check" size={15} strokeWidth={2.4} />
                    {clasificacion}
                  </li>
                ))}
              </ul>
            )}

            <dl className={styles.campos}>
              <Campo etiqueta="Tipo de documento" valor={detalle.documentTypeLabel} />
              <Campo etiqueta="Documento (enmascarado)" valor={detalle.documentMasked} />
              <Campo etiqueta="Fecha de nacimiento" valor={detalle.birthDate} />
              <Campo etiqueta="Edad" valor={`${String(detalle.age)} años`} />
              <Campo etiqueta="EPS" valor={detalle.epsName} />
              <Campo etiqueta="Ubicación" valor={textoTerritorio(detalle.territory)} />
              <Campo etiqueta="Estado del registro" valor={detalle.statusLabel} />
              <Campo etiqueta="Contacto" valor={detalle.contactAvailability} noDisponible />
            </dl>

            <p className={styles.aviso}>{avisoHistoria}</p>
          </div>

          <SeccionFicha titulo="Clasificación declarada">
            <ul className={styles.indicadores}>
              <Indicador
                etiqueta={POBLACION_ETIQUETA_PRIORIDAD.MAYOR_60}
                activo={detalle.priorities.older60}
                procedencia={`Derivada de la fecha de nacimiento a la fecha de corte ${detalle.asOfDate}`}
              />
              <Indicador
                etiqueta={POBLACION_ETIQUETA_PRIORIDAD.DISABILITY}
                activo={detalle.priorities.disabilityDeclared}
                procedencia="Declarada por la persona en su inscripción"
              />
              <Indicador
                etiqueta={POBLACION_ETIQUETA_PRIORIDAD.HOME_CARE_REQUIRED}
                activo={detalle.priorities.homeCareRequiredDeclared}
                procedencia="Declarada por la persona en su inscripción"
              />
            </ul>
            <p className={styles.graficoNota}>
              Las tres clasificaciones son independientes y pueden estar activas a la vez. Las dos
              declaradas no son diagnósticos ni certificaciones oficiales.
            </p>

            <dl className={styles.campos}>
              <Campo
                etiqueta="Condición principal"
                valor={HOSPITAL_POBLACION_NO_DISPONIBLE}
                noDisponible
              />
              <Campo
                etiqueta="Patologías registradas"
                valor={HOSPITAL_POBLACION_NO_DISPONIBLE}
                noDisponible
              />
            </dl>
          </SeccionFicha>

          <SeccionFicha titulo="Atención">
            <dl className={styles.campos}>
              <Campo
                etiqueta="Profesional responsable"
                valor={HOSPITAL_POBLACION_NO_DISPONIBLE}
                noDisponible
              />
              <Campo etiqueta="Cuidador" valor={HOSPITAL_POBLACION_NO_DISPONIBLE} noDisponible />
              <Campo etiqueta="Programa" valor={HOSPITAL_POBLACION_NO_DISPONIBLE} noDisponible />
              <Campo
                etiqueta="Próxima atención"
                valor={HOSPITAL_POBLACION_NO_DISPONIBLE}
                noDisponible
              />
              <Campo
                etiqueta="Últimas atenciones"
                valor={HOSPITAL_POBLACION_NO_DISPONIBLE}
                noDisponible
              />
              <Campo
                etiqueta="Alertas y semaforización"
                valor={HOSPITAL_POBLACION_NO_DISPONIBLE}
                noDisponible
              />
            </dl>
            <p className={styles.graficoNota}>{HOSPITAL_POBLACION_AYUDA_DESHABILITADO}</p>
          </SeccionFicha>

          <FichaHistorial tituloId={historialId} />
        </div>
      </div>
    </div>
  );
}

/* ========================================================================== */
/* Estados                                                                    */
/* ========================================================================== */

/** Silueta de carga del listado y de la analítica. */
export function PoblacionEsqueleto(): ReactNode {
  return (
    <HospitalCard gap={12} aria-label="Consultando pacientes">
      <p className={styles.estadoTexto} role="status">
        {HOSPITAL_POBLACION_ESTADOS.cargando}
      </p>
      <ul className={styles.esqueleto} aria-hidden="true">
        {['a', 'b', 'c', 'd', 'e', 'f'].map((linea) => (
          <li className={styles.esqueletoLinea} key={linea} />
        ))}
      </ul>
    </HospitalCard>
  );
}

/**
 * Estado de fallo con su acción, cuando existe.
 *
 * `401` y `403` NO ofrecen reintento: repetir la consulta no cambia el
 * desenlace. Un error recuperable sí lo ofrece. En ningún caso se muestran
 * cifras anteriores ni datos de demostración.
 */
export function PoblacionEstadoFallo({
  titulo,
  detalle,
  onReintentar,
}: {
  readonly titulo: string;
  readonly detalle: string;
  readonly onReintentar?: () => void;
}): ReactNode {
  return (
    <HospitalCard gap={12} aria-label={titulo}>
      <p className={styles.estadoTexto} role="alert">
        {titulo}
      </p>
      <p className={styles.graficoNota}>{detalle}</p>
      {onReintentar === undefined ? null : (
        <button
          type="button"
          className={clases(compartido.button, compartido.buttonNeutro, styles.limpiar)}
          onClick={onReintentar}
        >
          {HOSPITAL_POBLACION_ESTADOS.reintentar}
        </button>
      )}
    </HospitalCard>
  );
}

/** Opciones de EPS y municipio derivadas de la analítica servida. */
export function opcionesDesdeAnalitica(
  analitica: HospitalAnaliticaDto | null,
): PoblacionOpcionesCore {
  if (analitica === null) {
    return { eps: [], municipio: [] };
  }

  const buscar = (id: string): readonly HospitalCeldaDto[] =>
    analitica.distributions.find((distribucion) => distribucion.id === id)?.cells ?? [];

  return {
    eps: buscar('eps').map((celda) => ({ valor: celda.key, etiqueta: celda.label })),
    municipio: buscar('municipality')
      /*
       * `sin-territorio` NO es un municipio: es la ausencia de dirección. No se
       * ofrece como opción de filtro porque la API no admite ese valor.
       */
      .filter((celda) => celda.key !== 'sin-territorio')
      .map((celda) => ({ valor: celda.key, etiqueta: celda.label })),
  };
}
