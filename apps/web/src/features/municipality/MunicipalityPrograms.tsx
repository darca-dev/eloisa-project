'use client';

import { useRef, useState, type ReactNode, type Ref } from 'react';

import {
  MunicipalityProgramForm,
  crearProgramaBorrador,
  formatearCantidadDemo,
} from './MunicipalityProgramForm';
import type { MunicipalityProgramaEntrada } from './MunicipalityProgramForm';
import styles from './municipality.module.css';
import { municipalityDemo } from './municipalityConfig';
import type {
  MunicipalityConfig,
  MunicipalityDemoAviso,
  MunicipalityPrograma,
  MunicipalityProgramasConfig,
  MunicipalityTono,
} from './municipalityConfig';

/**
 * Vista «Programas» de la experiencia Alcaldía (TASK-ALCALDIA-A-03).
 *
 * Reproduce las líneas 271–315 de la referencia aprobada
 * `prototype-claude/Eligeme-Alcaldia.dc.html`, en su jerarquía vinculante:
 * título y subtítulo, lista vertical de tarjetas blancas con borde lateral de
 * estado, identidad/objetivo/entidades más badge, cuadrícula de seis datos y
 * dos progresos paralelos. Sobre esa estructura, y sin reordenarla, A-03 añade
 * las poblaciones, los ejecutores, el resumen documental, el cierre preparado y
 * la acción primaria **+ Nuevo programa**, expresamente aprobada.
 *
 * Naturaleza de los datos: todo llega por configuración tipada y es fixture
 * ficticio de diseño. Ninguna cifra se calcula, se consulta ni procede de una
 * fuente oficial; los porcentajes son valores declarados y no son indicadores
 * oficiales: fuente, fórmula, periodo, propietario, versión y linaje siguen
 * pendientes. Los cinco programas son ejemplos configurables, NO el catálogo
 * cerrado de programas que la plataforma podrá admitir.
 *
 * Deduplicación: las tarjetas NO se suman para obtener el total municipal. Una
 * persona puede pertenecer a varios programas y cuenta una sola vez en el total
 * de beneficiarios únicos, que vive en Población beneficiaria (A-02). Esta
 * vista no implementa matching, deduplicación, intersecciones productivas ni
 * acceso individual.
 *
 * Privacidad municipal: solo agregados institucionales. No hay nombre de
 * persona, documento, contacto, ubicación individual, información clínica
 * nominativa ni compensación individual; ninguna tarjeta ofrece búsqueda,
 * drill-down ni enlace a registro alguno.
 *
 * Límites: el detalle financiero (movimientos, compromisos, causado/obligado,
 * pagos, facturas, proveedores, documentos y saldo) pertenece a A-04, y la
 * recepción automática de programas en Hospital/ESE pertenece a H-06B. A-03 no
 * implementa ninguno de los dos, no navega hacia ellos y no simula su éxito.
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
  titulo: 'municipality-programas-titulo',
  lista: 'municipality-programas-lista',
} as const;

/**
 * Destino tipado de la profundidad financiera y documental.
 *
 * A-03 conserva la referencia para que A-04 pueda enlazarla sin rediseñar la
 * tarjeta, y NO muestra ningún control: un botón inerte simularía una capacidad
 * que la plataforma todavía no tiene.
 */
export const MUNICIPALITY_PROGRAMAS_DESTINO_FINANCIERO = {
  moduloId: 'presupuesto',
  disponible: false,
} as const;

/** Celda de la cuadrícula de datos agregados. */
function DatoAgregado({ clave, valor }: { readonly clave: string; readonly valor: string }): ReactNode {
  return (
    <div className={styles.dataCell}>
      <dt className={styles.dataKey}>{clave}</dt>
      <dd className={styles.dataValue}>{valor}</dd>
    </div>
  );
}

/**
 * Bloque de progreso con su porcentaje escrito y sus valores absolutos.
 *
 * La barra declara `progressbar` con su valor solo cuando el fixture declara un
 * porcentaje; cuando no lo declara no se dibuja barra alguna y el texto dice
 * «sin registro», que no es lo mismo que cero.
 */
function Progreso({
  etiquetaId,
  etiqueta,
  porcentaje,
  porcentajeTexto,
  sinRegistro,
  tono,
  detalles,
}: {
  readonly etiquetaId: string;
  readonly etiqueta: string;
  readonly porcentaje: number | null;
  readonly porcentajeTexto: string | null;
  readonly sinRegistro: string;
  readonly tono: MunicipalityTono;
  readonly detalles: readonly string[];
}): ReactNode {
  return (
    <div className={`${styles.progressBlock} ${CLASE_TONO[tono]}`}>
      <p className={styles.progressHead}>
        <span className={styles.progressLabel} id={etiquetaId}>
          {etiqueta}
        </span>
        {/* El porcentaje siempre está escrito: la barra solo lo acompaña. */}
        <span className={styles.progressValue}>{porcentajeTexto ?? sinRegistro}</span>
      </p>
      {porcentaje === null ? null : (
        <span
          className={styles.bar}
          role="progressbar"
          aria-labelledby={etiquetaId}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={porcentaje}
          aria-valuetext={porcentajeTexto ?? undefined}
        >
          <span className={styles.barFill} style={{ width: `${String(porcentaje)}%` }} />
        </span>
      )}
      <ul className={styles.progressDetail}>
        {detalles.map((detalle) => (
          <li key={detalle}>{detalle}</li>
        ))}
      </ul>
    </div>
  );
}

/** Lista compacta de etiquetas: poblaciones objetivo y ejecutores. */
function GrupoEtiquetas({
  id,
  titulo,
  elementos,
}: {
  readonly id: string;
  readonly titulo: string;
  readonly elementos: readonly { readonly clave: string; readonly texto: string }[];
}): ReactNode {
  return (
    <div className={styles.tagGroup} role="group" aria-labelledby={id}>
      <p className={styles.tagGroupLabel} id={id}>
        {titulo}
      </p>
      <ul className={styles.tagList}>
        {elementos.map((elemento) => (
          <li className={styles.tag} key={elemento.clave}>
            {elemento.texto}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Cierre preparado de un programa finalizado (FR-09). */
function CierrePreparado({
  programa,
  config,
}: {
  readonly programa: MunicipalityPrograma;
  readonly config: MunicipalityProgramasConfig;
}): ReactNode {
  const { cierre } = programa;
  const { etiquetas } = config;

  if (cierre === null) {
    return null;
  }

  const cierreId = `municipality-programa-${programa.id}-cierre`;
  const datos: readonly (readonly [string, string])[] = [
    [etiquetas.presupuestoAsignado, cierre.presupuestoAsignado],
    [etiquetas.ejecutado, cierre.ejecutado],
    [etiquetas.cierreSaldo, cierre.saldo],
    [etiquetas.avanceFinanciero, cierre.porcentajeFinancieroTexto],
    [etiquetas.meta, cierre.meta],
    [config.formulario.resultadoEtiqueta, cierre.resultado],
    [etiquetas.avanceFisico, cierre.porcentajeFisicoTexto],
    [etiquetas.beneficiariosUnicos, cierre.beneficiariosUnicos],
    [etiquetas.cierreEvidenciasCompletas, cierre.evidenciasCompletas],
    [etiquetas.cierreEvidenciasFaltantes, cierre.evidenciasFaltantes],
    [etiquetas.cierreInformeFinal, cierre.informeFinal],
  ];

  return (
    <div className={styles.closureBlock} role="group" aria-labelledby={cierreId}>
      <p className={styles.tagGroupLabel} id={cierreId}>
        {etiquetas.cierre}
      </p>
      <dl className={styles.closureGrid}>
        {datos.map(([clave, valor]) => (
          <div className={styles.closureItem} key={clave}>
            <dt className={styles.closureKey}>{clave}</dt>
            <dd className={styles.closureValue}>{valor}</dd>
          </div>
        ))}
      </dl>
      <p className={styles.viewNote}>{cierre.nota}</p>
    </div>
  );
}

/** Tarjeta de un programa, en el orden visual vinculante del prototipo. */
function MunicipalityProgramCard({
  programa,
  config,
}: {
  readonly programa: MunicipalityPrograma;
  readonly config: MunicipalityProgramasConfig;
}): ReactNode {
  const { etiquetas } = config;
  const base = `municipality-programa-${programa.id}`;
  const estado = config.estados.find((opcion) => opcion.id === programa.estado);
  const origen = config.origenes.find((opcion) => opcion.id === programa.origen);
  const { avanceFisico: fisico, avanceFinanciero: financiero, cobertura } = programa;

  const poblaciones = programa.poblacionIds.map((poblacionId) => ({
    clave: poblacionId,
    texto:
      config.poblacionesBase.find((poblacion) => poblacion.id === poblacionId)?.etiqueta ??
      poblacionId,
  }));

  const ejecutores = programa.ejecutores.map((ejecutor) => ({
    clave: ejecutor.id,
    texto: `${ejecutor.nombre} · ${
      config.tiposEjecutor.find((tipo) => tipo.id === ejecutor.tipo)?.etiqueta ?? ejecutor.tipo
    }`,
  }));

  /* Cobertura: el porcentaje solo aparece cuando hay denominador declarado. */
  const coberturaTexto =
    cobertura.denominador === null
      ? `${cobertura.valor} · ${etiquetas.sinDenominador}`
      : `${cobertura.valor} de ${cobertura.denominador} · ${
          cobertura.porcentajeTexto ?? etiquetas.sinRegistro
        }`;

  const detalleFinanciero = [
    `${etiquetas.presupuestoAsignado}: ${programa.presupuesto.asignado}`,
    ...(financiero.comprometido === null
      ? []
      : [`${etiquetas.comprometido}: ${financiero.comprometido}`]),
    `${etiquetas.ejecutado}: ${financiero.ejecutado ?? etiquetas.sinRegistro}`,
    `${etiquetas.disponible}: ${financiero.disponible ?? etiquetas.sinRegistro}`,
    `${etiquetas.moneda}: ${programa.presupuesto.moneda}`,
  ];

  /* Solo se agrupan los miles para presentarlos: no se convierte ni se calcula. */
  const detalleFisico = [
    `${etiquetas.meta}: ${formatearCantidadDemo(fisico.metaFisica)} ${fisico.unidad}`,
    `${fisico.resultadoEtiqueta}: ${
      fisico.resultadoFisico === null
        ? etiquetas.sinRegistro
        : `${formatearCantidadDemo(fisico.resultadoFisico)} ${fisico.unidad}`
    }`,
  ];

  return (
    <li
      className={`${styles.programCard} ${CLASE_TONO[estado?.tono ?? 'azul']}`}
      data-municipality-programa-estado={programa.estado}
    >
      <div className={styles.programTop}>
        <div className={styles.programIdentity}>
          <h2 className={styles.programName} id={`${base}-nombre`}>
            {programa.nombre}
          </h2>
          {programa.objetivo === '' ? null : (
            <p className={styles.programObjective}>{programa.objetivo}</p>
          )}
          <p className={styles.programMeta}>
            {`${etiquetas.origen}: ${origen?.etiqueta ?? programa.origen} · ${
              etiquetas.entidadFormuladora
            }: ${programa.entidadFormuladora} · ${etiquetas.entidadResponsable}: ${
              programa.entidadResponsable
            }`}
          </p>
        </div>
        {/* El estado se escribe siempre; el color solo lo acompaña. */}
        <span className={styles.programBadge}>{estado?.etiqueta ?? programa.estado}</span>
      </div>

      <div className={styles.tagGroups}>
        <GrupoEtiquetas
          elementos={poblaciones}
          id={`${base}-poblaciones`}
          titulo={etiquetas.poblaciones}
        />
        <GrupoEtiquetas
          elementos={ejecutores}
          id={`${base}-ejecutores`}
          titulo={etiquetas.ejecutores}
        />
      </div>

      <dl className={styles.dataGrid}>
        <DatoAgregado clave={etiquetas.beneficiariosUnicos} valor={programa.beneficiariosUnicos} />
        <DatoAgregado clave={etiquetas.poblacionAtendida} valor={programa.poblacionAtendida} />
        <DatoAgregado clave={etiquetas.cobertura} valor={coberturaTexto} />
        <DatoAgregado clave={etiquetas.territorio} valor={programa.territorio.resumen} />
        <DatoAgregado clave={etiquetas.vigencia} valor={programa.vigencia.etiqueta} />
        <DatoAgregado clave={programa.actividad.etiqueta} valor={programa.actividad.valor} />
      </dl>

      <div className={styles.progressRow}>
        <Progreso
          detalles={detalleFinanciero}
          etiqueta={etiquetas.avanceFinanciero}
          etiquetaId={`${base}-financiero`}
          porcentaje={financiero.porcentaje}
          porcentajeTexto={financiero.porcentajeTexto}
          sinRegistro={etiquetas.sinRegistro}
          tono={financiero.tono}
        />
        <Progreso
          detalles={detalleFisico}
          etiqueta={etiquetas.avanceFisico}
          etiquetaId={`${base}-fisico`}
          porcentaje={fisico.porcentaje}
          porcentajeTexto={fisico.porcentajeTexto}
          sinRegistro={etiquetas.sinRegistro}
          tono={fisico.tono}
        />
      </div>

      <div
        className={`${styles.evidenceBlock} ${CLASE_TONO[programa.evidencias.tono]}`}
        role="group"
        aria-labelledby={`${base}-evidencias`}
      >
        <p className={styles.tagGroupLabel} id={`${base}-evidencias`}>
          {etiquetas.evidencias}
        </p>
        <ul className={styles.evidenceList}>
          <li>{`${etiquetas.evidenciasRegistradas}: ${programa.evidencias.registradas}`}</li>
          <li>{`${etiquetas.evidenciasPendientes}: ${programa.evidencias.pendientes}`}</li>
          <li>{`${etiquetas.actividadesConSoporte}: ${programa.evidencias.actividadesConSoporte}`}</li>
          <li>{`${etiquetas.estadoDocumental}: ${programa.evidencias.estadoDocumental}`}</li>
        </ul>
      </div>

      <CierrePreparado config={config} programa={programa} />
    </li>
  );
}

export function MunicipalityPrograms({
  config = municipalityDemo,
  tituloRef,
}: {
  readonly config?: MunicipalityConfig;
  /** Referencia del encabezado principal, para el foco al cambiar de vista. */
  readonly tituloRef?: Ref<HTMLHeadingElement>;
}): ReactNode {
  const programas = config.programas;
  const demo: MunicipalityDemoAviso = config.demo;
  const [borradores, setBorradores] = useState<readonly MunicipalityPrograma[]>([]);
  const [dialogoAbierto, setDialogoAbierto] = useState(false);
  const [anuncio, setAnuncio] = useState('');
  const accionRef = useRef<HTMLButtonElement>(null);

  /** Cierra el diálogo y devuelve el foco a la acción que lo abrió. */
  const cerrarDialogo = (): void => {
    setDialogoAbierto(false);
    accionRef.current?.focus();
  };

  /*
   * Alta local: el borrador vive solo en memoria mientras la vista está
   * montada. No hay red, almacenamiento, cookie, URL ni archivo, y el estado
   * inicial no es escalable desde este flujo.
   */
  const crearBorrador = (entrada: MunicipalityProgramaEntrada): void => {
    setBorradores((actuales) => [
      ...actuales,
      crearProgramaBorrador(entrada, programas, actuales.length + 1),
    ]);
    setAnuncio(programas.formulario.anuncioCreado);
    cerrarDialogo();
  };

  const visibles = [...programas.programas, ...borradores];

  return (
    <div className={styles.view}>
      <div className={styles.viewHead}>
        <div className={styles.viewHeadRow}>
          <h1 className={styles.viewTitle} id={SECCION_ID.titulo} ref={tituloRef} tabIndex={-1}>
            {programas.titulo}
          </h1>
          <p className={styles.demoTag}>{demo.etiqueta}</p>
          <button
            className={styles.primaryAction}
            ref={accionRef}
            type="button"
            onClick={() => {
              setAnuncio('');
              setDialogoAbierto(true);
            }}
          >
            <span aria-hidden="true">{programas.accionNuevoSimbolo}</span> {programas.accionNuevo}
          </button>
        </div>
        <p className={styles.viewDescription}>{programas.descripcion}</p>
        <p className={styles.viewNote}>{demo.aclaracion}</p>
        <p className={styles.viewNote}>{programas.deduplicacion}</p>
      </div>

      {/* Región viva del alta local; vacía mientras no se crea nada. */}
      <p className={anuncio === '' ? 'merdn-sr-only' : styles.statusMessage} role="status">
        {anuncio}
      </p>

      <p className="merdn-sr-only" id={SECCION_ID.lista}>
        {programas.listaResumen}
      </p>
      <ul className={styles.programList} aria-labelledby={SECCION_ID.lista}>
        {visibles.map((programa) => (
          <MunicipalityProgramCard config={programas} key={programa.id} programa={programa} />
        ))}
      </ul>

      <p className={styles.viewNote}>{programas.limiteFinanciero}</p>

      {dialogoAbierto ? (
        <MunicipalityProgramForm
          config={programas}
          onCancelar={cerrarDialogo}
          onCrear={crearBorrador}
        />
      ) : null}
    </div>
  );
}
