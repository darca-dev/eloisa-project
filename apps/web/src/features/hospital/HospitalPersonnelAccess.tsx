'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode, type Ref } from 'react';

import {
  AdminAccion,
  AdminAviso,
  AdminTabla,
  hospitalAdminStyles as styles,
} from './HospitalAdminPieces';
import type {
  HospitalPersonaAdministrativa,
  HospitalPersonalConsulta,
  HospitalPersonalConfig,
} from './hospitalAdministrationConfig';
import { HospitalIcon } from './HospitalIcon';
import {
  HOSPITAL_PERSONAL_CONSULTA_INICIAL,
  consultaPersonalVacia,
  filtrarPersonas,
  indicadoresDePersonal,
  opcionesDePersonal,
} from './hospitalPersonnelListado';
import {
  HospitalBadge,
  HospitalCard,
  HospitalCardHeader,
  HospitalNote,
  hospitalViewStyles as compartido,
} from './HospitalViewPieces';

/**
 * Bloque «Personal y accesos» (TASK-003H-05, FR-04 y FR-05; corrección final
 * aprobada por la Product Owner, apartados A, B, C y D).
 *
 * La corrección separa esta pantalla de «Roles y permisos» y la convierte en la
 * pantalla operativa cotidiana de la administración:
 *
 * - cabecera con ocho indicadores compactos demostrativos, contados sobre las
 *   personas ficticias de esta misma pantalla;
 * - buscador local por nombre, documento, código de personal, cargo o entidad;
 * - cuatro filtros: tipo de vinculación, rol, entidad y estado de acceso;
 * - listado lineal preparado para cientos de personas, con persona, código de
 *   personal, vinculación, rol, entidad, estado de acceso, último acceso y
 *   `Ver`;
 * - panel de detalle con la identidad de la persona y las señales de acceso y
 *   credenciales que sí puede consultar la administración.
 *
 * Diferencia con `Profesionales` (TASK-003H-04): aquella es la vista operativa
 * —agenda, atención, disponibilidad, visitas, consultas, calificaciones,
 * novedades y `Vinculación y documentos`—; esta es administración institucional
 * —identidad, código de personal, vinculación, rol, entidad, estado de acceso—.
 * Aquí
 * no se copian tarjetas, agenda, métricas ni acciones operativas, y
 * `Vinculación y documentos` no se duplica.
 *
 * Alcance: presentación.
 *
 * - La búsqueda y los filtros recorren fixtures locales ya cargados en memoria:
 *   no hay consulta remota, índice, paginación de servidor, permisos ni
 *   aislamiento institucional, y encontrar a alguien no acredita relación
 *   autorizada ni derecho de acceso a su información.
 * - Ninguna contraseña existe, se muestra, se recupera ni se puede cambiar
 *   desde aquí: solo se ven señales del estado del acceso.
 * - El código de personal de cada fila es un ejemplo. La generación automática la
 *   hará el backend en una tarea aprobada posterior; aquí no se genera nada.
 * - `Registrar persona`, las cuatro acciones de acceso y cualquier otra acción
 *   están deshabilitadas: no crean cuentas, no envían correo, no suspenden, no
 *   reactivan y no registran auditoría.
 * - Abrir el panel es estado local no persistente: no cambia la URL, no
 *   consulta servicios y no muta los fixtures.
 */

const PERSONAL_ID = 'hospital-admin-personal';
const INDICADORES_ID = 'hospital-admin-personal-indicadores';
const CONTROLES_ID = 'hospital-admin-personal-controles';
const BUSCADOR_ID = 'hospital-admin-personal-buscador';
const AYUDA_ID = 'hospital-admin-personal-buscador-ayuda';
const CODIGO_ID = 'hospital-admin-codigo-personal';
const ALTA_ID = 'hospital-admin-alta';
const VINCULACIONES_ID = 'hospital-admin-vinculaciones';
const PANEL_ID = 'hospital-admin-personal-detalle';
const PANEL_TITULO_ID = `${PANEL_ID}-titulo`;
const ACCESO_ID = `${PANEL_ID}-acceso`;

/** Filtro desplegable compacto. `''` significa «todas las opciones». */
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
  readonly opciones: readonly { readonly valor: string; readonly etiqueta: string }[];
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
          <option key={opcion.valor} value={opcion.valor}>
            {opcion.etiqueta}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Par etiqueta/valor del panel de detalle. */
function DatoDetalle({
  etiqueta,
  children,
}: {
  readonly etiqueta: string;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <div className={styles.futuro}>
      <dt className={styles.futuroEtiqueta}>{etiqueta}</dt>
      <dd className={styles.detalleValor}>{children}</dd>
    </div>
  );
}

/**
 * Panel de detalle de una persona.
 *
 * Muestra la identidad institucional y las señales de acceso. No muestra —ni
 * podrá mostrar— contraseñas: la administración nunca las ve, no las recupera
 * en texto legible y no cambia la de otra persona.
 */
function DetallePersona({
  persona,
  vinculacion,
  config,
  onCerrar,
  ref,
}: {
  readonly persona: HospitalPersonaAdministrativa;
  readonly vinculacion: string;
  readonly config: HospitalPersonalConfig;
  readonly onCerrar: () => void;
  readonly ref: Ref<HTMLElement>;
}): ReactNode {
  const { credenciales, detalle } = config;

  return (
    <HospitalCard
      gap={16}
      id={PANEL_ID}
      className={styles.detallePanel}
      aria-labelledby={PANEL_TITULO_ID}
      tabIndex={-1}
      ref={ref}
    >
      <div className={styles.detalleCabecera}>
        <span className={styles.detalleTextos}>
          <h3 className={styles.detalleTitulo} id={PANEL_TITULO_ID}>
            {persona.nombre}
          </h3>
          <span className={styles.detalleMeta}>{persona.cargo}</span>
        </span>
        <button
          type="button"
          className={`${compartido.button} ${compartido.buttonNeutro} ${styles.accionPildora}`}
          onClick={onCerrar}
        >
          {credenciales.cerrar}
        </button>
      </div>

      <dl className={styles.futuros}>
        <DatoDetalle etiqueta={detalle.etiquetas.codigo}>{persona.codigo}</DatoDetalle>
        <DatoDetalle etiqueta={detalle.etiquetas.documento}>
          {persona.documentoEnmascarado}
        </DatoDetalle>
        <DatoDetalle etiqueta={detalle.etiquetas.vinculacion}>{vinculacion}</DatoDetalle>
        <DatoDetalle etiqueta={detalle.etiquetas.rol}>{persona.rol}</DatoDetalle>
        <DatoDetalle etiqueta={detalle.etiquetas.entidad}>{persona.entidad}</DatoDetalle>
        <DatoDetalle etiqueta={detalle.etiquetas.zona}>{persona.zona}</DatoDetalle>
      </dl>

      <section className={styles.subBloque} aria-labelledby={ACCESO_ID}>
        <h4 className={compartido.cardTitle} id={ACCESO_ID}>
          {credenciales.titulo}
        </h4>
        <AdminAviso atencion>{credenciales.aviso}</AdminAviso>
        <dl className={styles.futuros}>
          <DatoDetalle etiqueta={credenciales.etiquetas.estadoAcceso}>
            <HospitalBadge tono={persona.tono} className={styles.badgeTabla}>
              {persona.estadoAcceso}
            </HospitalBadge>
          </DatoDetalle>
          <DatoDetalle etiqueta={credenciales.etiquetas.ultimoAcceso}>
            {persona.acceso.ultimoAcceso}
          </DatoDetalle>
          <DatoDetalle etiqueta={credenciales.etiquetas.ultimoCambio}>
            {persona.acceso.ultimoCambioCredenciales}
          </DatoDetalle>
          <DatoDetalle etiqueta={credenciales.etiquetas.intentos}>
            {persona.acceso.intentosFallidos}
          </DatoDetalle>
          <DatoDetalle etiqueta={credenciales.etiquetas.segundoFactor}>
            {persona.acceso.segundoFactor}
          </DatoDetalle>
        </dl>
        <div className={styles.acciones}>
          {credenciales.acciones.map((accion) => (
            <AdminAccion accion={accion} key={accion.id} tamano="pildora" />
          ))}
        </div>
        <HospitalNote>{credenciales.nota}</HospitalNote>
      </section>
    </HospitalCard>
  );
}

export function HospitalPersonnelAccess({
  config,
  consultaInicial,
  detalleInicialId,
}: {
  readonly config: HospitalPersonalConfig;
  /** Búsqueda y filtros aplicados al montar; sirven para probar el recorte. */
  readonly consultaInicial?: Partial<HospitalPersonalConsulta>;
  /**
   * Persona cuyo panel de detalle se muestra al montar. Sirve para probar el
   * panel; no persiste y no procede de la URL.
   */
  readonly detalleInicialId?: string;
}): ReactNode {
  const panelRef = useRef<HTMLElement>(null);
  const [consulta, setConsulta] = useState<HospitalPersonalConsulta>({
    ...HOSPITAL_PERSONAL_CONSULTA_INICIAL,
    ...consultaInicial,
  });
  const [detalleId, setDetalleId] = useState<string | undefined>(detalleInicialId);

  const personas = config.personal.items;
  const opciones = useMemo(() => opcionesDePersonal(personas), [personas]);
  const indicadores = useMemo(
    () =>
      indicadoresDePersonal(
        personas,
        config.vinculaciones.items,
        config.indicadores.etiquetas,
      ),
    [personas, config.vinculaciones.items, config.indicadores.etiquetas],
  );
  const visibles = useMemo(() => filtrarPersonas(personas, consulta), [personas, consulta]);
  const abierta = visibles.find((persona) => persona.id === detalleId);

  /* El panel se enfoca cuando ya está montado, no durante el evento del clic. */
  useEffect(() => {
    if (detalleId !== undefined) {
      panelRef.current?.focus();
    }
  }, [detalleId]);

  /** Rótulo corto de la vinculación de una persona. */
  function rotuloVinculacion(persona: HospitalPersonaAdministrativa): string {
    return (
      config.vinculaciones.items.find((item) => item.id === persona.vinculacion)?.corta ??
      persona.vinculacion
    );
  }

  function actualizar(cambio: Partial<HospitalPersonalConsulta>): void {
    setConsulta((actual) => ({ ...actual, ...cambio }));
  }

  return (
    <div className={styles.panel}>
      <AdminAviso>{config.personal.avisoAdministrativo}</AdminAviso>

      <HospitalCard gap={14} aria-labelledby={INDICADORES_ID}>
        <HospitalCardHeader titulo={config.indicadores.titulo} tituloId={INDICADORES_ID} />
        <ul className={styles.indicadores}>
          {indicadores.map((indicador) => (
            <li className={styles.indicador} key={indicador.id}>
              <span className={styles.indicadorValor}>{String(indicador.valor)}</span>
              <span className={styles.indicadorEtiqueta}>{indicador.etiqueta}</span>
            </li>
          ))}
        </ul>
        <HospitalNote>{config.indicadores.nota}</HospitalNote>
      </HospitalCard>

      <HospitalCard gap={16} aria-labelledby={CONTROLES_ID}>
        <h2 className="merdn-sr-only" id={CONTROLES_ID}>
          Buscar y filtrar personal
        </h2>

        <div className={styles.busqueda}>
          <label className={styles.busquedaEtiqueta} htmlFor={BUSCADOR_ID}>
            {config.busqueda.etiqueta}
          </label>
          <span className={styles.busquedaCampo}>
            <span className={styles.busquedaIcono} aria-hidden="true">
              <HospitalIcon name="buscar" size={18} />
            </span>
            <input
              id={BUSCADOR_ID}
              type="search"
              className={styles.busquedaInput}
              placeholder={config.busqueda.etiqueta}
              aria-describedby={AYUDA_ID}
              value={consulta.texto}
              onChange={(evento) => {
                actualizar({ texto: evento.target.value });
              }}
            />
          </span>
          <p className={styles.busquedaAyuda} id={AYUDA_ID}>
            {config.busqueda.ayuda}
          </p>
        </div>

        <div className={styles.filtros}>
          <FiltroSelect
            id="hospital-admin-personal-filtro-vinculacion"
            etiqueta={config.busqueda.filtros.vinculacion}
            valor={consulta.vinculacion}
            opciones={config.vinculaciones.items.map((item) => ({
              valor: item.id,
              etiqueta: item.etiqueta,
            }))}
            opcionTodas={config.busqueda.opcionTodas}
            onCambiar={(valor) => {
              actualizar({ vinculacion: valor });
            }}
          />
          <FiltroSelect
            id="hospital-admin-personal-filtro-rol"
            etiqueta={config.busqueda.filtros.rol}
            valor={consulta.rol}
            opciones={opciones.rol.map((valor) => ({ valor, etiqueta: valor }))}
            opcionTodas={config.busqueda.opcionTodas}
            onCambiar={(valor) => {
              actualizar({ rol: valor });
            }}
          />
          <FiltroSelect
            id="hospital-admin-personal-filtro-entidad"
            etiqueta={config.busqueda.filtros.entidad}
            valor={consulta.entidad}
            opciones={opciones.entidad.map((valor) => ({ valor, etiqueta: valor }))}
            opcionTodas={config.busqueda.opcionTodas}
            onCambiar={(valor) => {
              actualizar({ entidad: valor });
            }}
          />
          <FiltroSelect
            id="hospital-admin-personal-filtro-estado"
            etiqueta={config.busqueda.filtros.estadoAcceso}
            valor={consulta.estadoAcceso}
            opciones={opciones.estadoAcceso.map((valor) => ({ valor, etiqueta: valor }))}
            opcionTodas={config.busqueda.opcionTodas}
            onCambiar={(valor) => {
              actualizar({ estadoAcceso: valor });
            }}
          />
        </div>
      </HospitalCard>

      <div className={abierta === undefined ? styles.disposicion : styles.disposicionConPanel}>
        <div className={styles.columnaLista}>
          <HospitalCard gap={16} aria-labelledby={PERSONAL_ID}>
            <HospitalCardHeader
              titulo={config.personal.titulo}
              tituloId={PERSONAL_ID}
              extra={
                <div className={styles.resumen}>
                  <span className={styles.resumenTexto} role="status">
                    {`${String(visibles.length)} de ${String(personas.length)} ${config.personal.resumen}`}
                  </span>
                  {consultaPersonalVacia(consulta) ? null : (
                    <button
                      type="button"
                      className={`${compartido.button} ${compartido.buttonNeutro} ${styles.accionPildora}`}
                      onClick={() => {
                        setConsulta(HOSPITAL_PERSONAL_CONSULTA_INICIAL);
                      }}
                    >
                      {config.busqueda.limpiar}
                    </button>
                  )}
                  <AdminAccion accion={config.personal.accion} />
                </div>
              }
            />

            {visibles.length === 0 ? (
              <p className={styles.vacio}>{config.personal.vacio}</p>
            ) : (
              <AdminTabla columnas={config.personal.columnas} etiquetaId={PERSONAL_ID}>
                {visibles.map((persona) => (
                  <tr
                    className={
                      persona.id === detalleId
                        ? `${styles.tablaFila} ${styles.tablaFilaActiva}`
                        : styles.tablaFila
                    }
                    key={persona.id}
                  >
                    <th scope="row" className={styles.tablaCelda}>
                      <span className={styles.persona}>
                        <span className={styles.personaNombre}>{persona.nombre}</span>
                        <span className={styles.personaCargo}>{persona.cargo}</span>
                      </span>
                    </th>
                    <td className={`${styles.tablaCelda} ${styles.celdaCodigo}`}>
                      {persona.codigo}
                    </td>
                    <td className={styles.tablaCelda}>{rotuloVinculacion(persona)}</td>
                    <td className={`${styles.tablaCelda} ${styles.celdaRol}`}>{persona.rol}</td>
                    <td className={styles.tablaCelda}>{persona.entidad}</td>
                    <td className={styles.tablaCelda}>
                      <HospitalBadge tono={persona.tono} className={styles.badgeTabla}>
                        {persona.estadoAcceso}
                      </HospitalBadge>
                    </td>
                    <td className={styles.tablaCelda}>{persona.acceso.ultimoAcceso}</td>
                    <td className={styles.tablaCelda}>
                      <button
                        type="button"
                        className={`${compartido.button} ${compartido.buttonNeutro} ${styles.accionPildora}`}
                        aria-expanded={persona.id === detalleId}
                        aria-controls={persona.id === detalleId ? PANEL_ID : undefined}
                        onClick={() => {
                          setDetalleId((actual) =>
                            actual === persona.id ? undefined : persona.id,
                          );
                        }}
                      >
                        {config.personal.accionVer}
                        <span className="merdn-sr-only">{` detalle de ${persona.nombre}`}</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </AdminTabla>
            )}
            <HospitalNote>{config.personal.nota}</HospitalNote>
          </HospitalCard>
        </div>

        {abierta === undefined ? null : (
          <DetallePersona
            config={config}
            persona={abierta}
            vinculacion={rotuloVinculacion(abierta)}
            ref={panelRef}
            onCerrar={() => {
              setDetalleId(undefined);
            }}
          />
        )}
      </div>

      <HospitalCard gap={14} aria-labelledby={CODIGO_ID}>
        <HospitalCardHeader
          titulo={config.codigo.titulo}
          tituloId={CODIGO_ID}
          nota={config.codigo.descripcion}
        />
        <ul className={styles.catalogo} aria-label="Ejemplos de código de personal">
          {config.codigo.ejemplos.map((ejemplo) => (
            <li className={styles.catalogoItem} key={ejemplo}>
              {ejemplo}
            </li>
          ))}
        </ul>
        <ul className={styles.reglas}>
          {config.codigo.reglas.map((regla) => (
            <li className={styles.regla} key={regla}>
              {regla}
            </li>
          ))}
        </ul>
      </HospitalCard>

      <HospitalCard gap={14} aria-labelledby={ALTA_ID}>
        <HospitalCardHeader
          titulo={config.alta.titulo}
          tituloId={ALTA_ID}
          nota={config.alta.descripcion}
        />
        <div className={styles.flujos}>
          {config.alta.flujos.map((flujo) => (
            <section className={styles.flujo} key={flujo.id} aria-label={flujo.titulo}>
              <p className={styles.flujoTitulo}>{flujo.titulo}</p>
              <ol className={styles.pasos}>
                {flujo.pasos.map((paso) => (
                  <li className={styles.paso} key={paso}>
                    {paso}
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
        <HospitalNote>{config.alta.nota}</HospitalNote>
      </HospitalCard>

      <HospitalCard gap={14} aria-labelledby={VINCULACIONES_ID}>
        <HospitalCardHeader
          titulo={config.vinculaciones.titulo}
          tituloId={VINCULACIONES_ID}
          nota={config.vinculaciones.descripcion}
        />
        <dl className={styles.definiciones}>
          {config.vinculaciones.items.map((vinculacion) => (
            <div className={styles.definicion} key={vinculacion.id}>
              <dt className={styles.definicionTermino}>{vinculacion.etiqueta}</dt>
              <dd className={styles.definicionTexto}>{vinculacion.descripcion}</dd>
            </div>
          ))}
        </dl>
        <p className={styles.subTitulo}>{config.vinculaciones.tiposTitulo}</p>
        <ul className={styles.catalogo}>
          {config.vinculaciones.tipos.map((tipo) => (
            <li className={styles.catalogoItem} key={tipo}>
              {tipo}
              <span className={styles.catalogoEstado}>{config.vinculaciones.tiposEstado}</span>
            </li>
          ))}
        </ul>
      </HospitalCard>
    </div>
  );
}
