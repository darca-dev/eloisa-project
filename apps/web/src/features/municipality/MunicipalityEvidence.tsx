'use client';

import { useRef, useState, type ReactNode, type Ref } from 'react';

import { MunicipalityFinancialDetails } from './MunicipalityFinancialDetails';
import styles from './municipality.module.css';
import {
  MUNICIPALITY_ESTADOS_EVIDENCIA,
  MUNICIPALITY_ESTADOS_FINANCIEROS,
  MUNICIPALITY_ESTADOS_VALIDACION,
  MUNICIPALITY_ORIGENES_MOVIMIENTO,
  MUNICIPALITY_TIPOS_EVIDENCIA,
  evidenciasDeMovimiento,
  fuenteMunicipal,
  municipalityDemo,
  programaMunicipal,
} from './municipalityConfig';
import type {
  MunicipalityConfig,
  MunicipalityDemoAviso,
  MunicipalityEvidenciasConfig,
  MunicipalityMovimientoFinanciero,
  MunicipalityPrograma,
  MunicipalityTono,
} from './municipalityConfig';

/**
 * Vista «Evidencias de ejecución» de la experiencia Alcaldía
 * (TASK-ALCALDIA-A-04, FR-07, FR-08, FR-11, FR-12 y FR-13).
 *
 * Reproduce las líneas 373–435 de la referencia aprobada
 * `prototype-claude/Eligeme-Alcaldia.dc.html`, en su jerarquía vinculante:
 * título y subtítulo, panel de nivel de evidencia, tabla «Facturas y soportes»
 * con su acción `Ver evidencia`, cadena presupuesto–actividad–resultado y el
 * bloque «Al abrir una evidencia».
 *
 * Historial de movimientos: por decisión aprobada, la tabla «Facturas y
 * soportes» actúa como historial demostrativo de movimientos financieros. NO se
 * crea una pantalla ni una subsección «Movimientos», no se crea navegación
 * nueva y no existe conciliación operativa.
 *
 * Es una SELECCIÓN de movimientos, no el libro completo del municipio: su suma
 * no reproduce el ejecutado de ningún programa y esta vista no lo afirma.
 *
 * Estados: el estado financiero (`Asignado`, `Comprometido`, `Causado/Obligado`,
 * `Pagado`) y el estado del soporte (`Pendiente`, `En revisión`, `Falta
 * soporte`, `Validada`) son dimensiones distintas y ambas se escriben. Una
 * factura registrada NO convierte un movimiento en pagado ni en ejecutado: hay
 * un caso del fixture con factura, sin soporte y sin pago. Ningún estado se
 * comunica solo con color.
 *
 * Evidencias: cada evidencia referencia su movimiento por identificador y nunca
 * lo duplica. `Ver evidencia` abre únicamente metadatos locales: no hay
 * archivo, adjunto, enlace, dirección remota ni obtención de documento.
 *
 * Privacidad municipal: solo metadatos administrativos y entidades ficticias.
 * No hay historia clínica, diagnóstico, identidad de personas atendidas,
 * ubicación individual ni compensación individual.
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
  titulo: 'municipality-evidencias-titulo',
  nivel: 'municipality-evidencias-nivel',
  movimientos: 'municipality-evidencias-movimientos',
  estados: 'municipality-evidencias-estados',
  tipos: 'municipality-evidencias-tipos',
  cadena: 'municipality-evidencias-cadena',
} as const;

/** Encabezado de la vista, con la etiqueta que la identifica como demostrativa. */
function MunicipalityEvidenceHead({
  evidencias,
  demo,
  tituloRef,
}: {
  readonly evidencias: MunicipalityEvidenciasConfig;
  readonly demo: MunicipalityDemoAviso;
  readonly tituloRef?: Ref<HTMLHeadingElement>;
}): ReactNode {
  return (
    <div className={styles.viewHead}>
      <div className={styles.viewHeadRow}>
        <h1 className={styles.viewTitle} id={SECCION_ID.titulo} ref={tituloRef} tabIndex={-1}>
          {evidencias.titulo}
        </h1>
        <p className={styles.demoTag}>{demo.etiqueta}</p>
      </div>
      <p className={styles.viewDescription}>{evidencias.descripcion}</p>
      <p className={styles.viewNote}>{demo.aclaracion}</p>
    </div>
  );
}

/**
 * Panel de nivel de evidencia (FR-11).
 *
 * El porcentaje, las actividades con soporte y las pendientes están escritos.
 * La barra declara `progressbar` con su valor y su texto, de modo que la
 * proporción no dependa solo del color ni del ancho.
 */
function MunicipalityEvidenceNivel({
  evidencias,
}: {
  readonly evidencias: MunicipalityEvidenciasConfig;
}): ReactNode {
  const { nivel } = evidencias;

  return (
    <section className={styles.evidenceLevel} aria-labelledby={SECCION_ID.nivel}>
      <div className={styles.evidenceLevelText}>
        <h2 className={styles.evidenceLevelTitle} id={SECCION_ID.nivel}>
          {nivel.titulo}
        </h2>
        <p className={styles.evidenceLevelValue}>{nivel.porcentajeTexto}</p>
        <p className={styles.evidenceLevelDetail}>{nivel.detalle}</p>
      </div>
      <div
        aria-labelledby={SECCION_ID.nivel}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={nivel.porcentaje}
        aria-valuetext={nivel.porcentajeTexto}
        className={styles.evidenceLevelBar}
        role="progressbar"
      >
        <span
          className={styles.evidenceLevelFill}
          style={{ width: `${String(nivel.porcentaje)}%` }}
        />
      </div>
    </section>
  );
}

/** Fila del historial demostrativo de movimientos. */
function MunicipalityMovimientoFila({
  movimiento,
  evidencias,
  programas,
  onVerEvidencia,
  registrarBoton,
}: {
  readonly movimiento: MunicipalityMovimientoFinanciero;
  readonly evidencias: MunicipalityEvidenciasConfig;
  readonly programas: readonly MunicipalityPrograma[];
  readonly onVerEvidencia: (movimientoId: string) => void;
  readonly registrarBoton: (movimientoId: string, boton: HTMLButtonElement | null) => void;
}): ReactNode {
  const programa = programaMunicipal(movimiento.programaId, programas);
  const fuente = fuenteMunicipal(movimiento.fuenteId);
  const relacionadas = evidenciasDeMovimiento(movimiento.id, evidencias.evidencias);
  const principal = relacionadas[0];

  return (
    <tr>
      <td className={styles.cell}>{movimiento.fecha}</td>
      <th className={styles.zoneName} scope="row">
        <span className={styles.cellStrong}>{movimiento.referencia}</span>
        <span className={styles.cellMuted}>
          {MUNICIPALITY_TIPOS_EVIDENCIA[movimiento.tipoSoporte]}
        </span>
      </th>
      <td className={styles.cell}>{movimiento.entidad}</td>
      <td className={styles.cell}>{programa?.nombre ?? movimiento.programaId}</td>
      <td className={styles.cell}>{fuente?.etiqueta ?? movimiento.fuenteId}</td>
      <td className={`${styles.cell} ${styles.cellEjecutado}`}>{movimiento.valorTexto}</td>
      {/* Estado financiero y estado de validación son dimensiones distintas. */}
      <td className={`${styles.cell} ${CLASE_TONO[movimiento.tono]}`}>
        <span className={styles.cellStrong}>
          {MUNICIPALITY_ESTADOS_FINANCIEROS[movimiento.estadoFinanciero]}
        </span>
        <span className={styles.cellMuted}>
          {MUNICIPALITY_ESTADOS_VALIDACION[movimiento.estadoValidacion]}
        </span>
      </td>
      <td className={`${styles.cell} ${CLASE_TONO[movimiento.tono]}`}>
        <span className={styles.statusPill}>
          {principal === undefined
            ? evidencias.detalle.sinRegistro
            : MUNICIPALITY_ESTADOS_EVIDENCIA[principal.estado]}
        </span>
        <span className={styles.cellMuted}>
          {principal === undefined
            ? evidencias.detalle.sinRegistro
            : MUNICIPALITY_TIPOS_EVIDENCIA[principal.tipo]}
        </span>
      </td>
      <td className={styles.cell}>{MUNICIPALITY_ORIGENES_MOVIMIENTO[movimiento.origen]}</td>
      <td className={styles.cell}>
        <button
          aria-label={`${evidencias.movimientosColumnas.accion} de ${movimiento.referencia}`}
          className={styles.rowAction}
          onClick={() => {
            onVerEvidencia(movimiento.id);
          }}
          ref={(boton) => {
            registrarBoton(movimiento.id, boton);
          }}
          type="button"
        >
          Ver evidencia
        </button>
      </td>
    </tr>
  );
}

/** Lista escrita de definiciones de estado. Ningún estado depende del color. */
function ListaDefiniciones({
  titulo,
  tituloId,
  definiciones,
}: {
  readonly titulo: string;
  readonly tituloId: string;
  readonly definiciones: MunicipalityEvidenciasConfig['estadosSoporte'];
}): ReactNode {
  return (
    <div className={styles.definitionGroup} role="group" aria-labelledby={tituloId}>
      <p className={styles.tagGroupLabel} id={tituloId}>
        {titulo}
      </p>
      <dl className={styles.definitionList}>
        {definiciones.map((definicion) => (
          <div className={styles.definition} key={definicion.id}>
            <dt className={styles.definitionTerm}>{definicion.termino}</dt>
            <dd className={styles.definitionText}>{definicion.definicion}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function MunicipalityEvidence({
  config = municipalityDemo,
  tituloRef,
}: {
  readonly config?: MunicipalityConfig;
  /** Referencia del encabezado principal, para el foco al cambiar de vista. */
  readonly tituloRef?: Ref<HTMLHeadingElement>;
}): ReactNode {
  const { evidencias, programas, demo } = config;
  const [movimientoAbierto, setMovimientoAbierto] = useState<string | null>(null);
  const botones = useRef(new Map<string, HTMLButtonElement>());

  /** Registro de los activadores, para devolver el foco al cerrar el detalle. */
  const registrarBoton = (movimientoId: string, boton: HTMLButtonElement | null): void => {
    if (boton === null) {
      botones.current.delete(movimientoId);

      return;
    }

    botones.current.set(movimientoId, boton);
  };

  /** Cierra el detalle y devuelve el foco a la acción que lo abrió. */
  const cerrarDetalle = (): void => {
    const activador = movimientoAbierto === null ? undefined : botones.current.get(movimientoAbierto);

    setMovimientoAbierto(null);
    activador?.focus();
  };

  const movimiento = evidencias.movimientos.find((item) => item.id === movimientoAbierto);
  const { movimientosColumnas } = evidencias;
  const columnas = [
    movimientosColumnas.fecha,
    movimientosColumnas.referencia,
    movimientosColumnas.entidad,
    movimientosColumnas.programa,
    movimientosColumnas.fuente,
    movimientosColumnas.valor,
    movimientosColumnas.estado,
    movimientosColumnas.soporte,
    movimientosColumnas.origen,
    movimientosColumnas.accion,
  ];

  return (
    <div className={styles.view}>
      <MunicipalityEvidenceHead demo={demo} evidencias={evidencias} tituloRef={tituloRef} />
      <MunicipalityEvidenceNivel evidencias={evidencias} />

      <section className={styles.card} aria-labelledby={SECCION_ID.movimientos}>
        <h2 className={styles.cardTitle} id={SECCION_ID.movimientos}>
          {evidencias.movimientosTitulo}
        </h2>
        {/*
         * La tabla conserva la relación de cada dato con su columna y con la
         * factura de la fila también al hacer reflow. Cuando el ancho no
         * alcanza se desplaza dentro de su propia región enfocable, sin
         * recortar contenido y sin desbordar la página.
         */}
        <div
          aria-labelledby={SECCION_ID.movimientos}
          className={styles.tableScroll}
          role="group"
          tabIndex={0}
        >
          <table className={styles.table}>
            <caption className="merdn-sr-only">{evidencias.movimientosResumen}</caption>
            <thead>
              <tr>
                {columnas.map((columna) => (
                  <th className={styles.tableHead} key={columna} scope="col">
                    {columna}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {evidencias.movimientos.map((item) => (
                <MunicipalityMovimientoFila
                  evidencias={evidencias}
                  key={item.id}
                  movimiento={item}
                  onVerEvidencia={setMovimientoAbierto}
                  programas={programas.programas}
                  registrarBoton={registrarBoton}
                />
              ))}
            </tbody>
          </table>
        </div>
        <p className={styles.highlight}>{evidencias.movimientosNota}</p>
        <p className={styles.viewNote}>{evidencias.sinArchivoNota}</p>
      </section>

      <section className={styles.card} aria-labelledby={SECCION_ID.estados}>
        <h2 className={styles.cardTitle} id={SECCION_ID.estados}>
          {evidencias.estadosTitulo}
        </h2>
        <ListaDefiniciones
          definiciones={evidencias.estadosSoporte}
          titulo={evidencias.estadosSoporteTitulo}
          tituloId={`${SECCION_ID.estados}-soporte`}
        />
        <ListaDefiniciones
          definiciones={evidencias.estadosEvidencia}
          titulo={evidencias.estadosEvidenciaTitulo}
          tituloId={`${SECCION_ID.estados}-evidencia`}
        />
        <p className={styles.highlight}>{evidencias.estadosNota}</p>
      </section>

      <section className={styles.card} aria-labelledby={SECCION_ID.tipos}>
        <h2 className={styles.cardTitle} id={SECCION_ID.tipos}>
          {evidencias.tiposTitulo}
        </h2>
        <ul className={styles.tagList}>
          {Object.entries(MUNICIPALITY_TIPOS_EVIDENCIA).map(([id, etiqueta]) => (
            <li className={styles.tag} key={id}>
              {etiqueta}
            </li>
          ))}
        </ul>
        <p className={styles.viewNote}>{evidencias.tiposNota}</p>
      </section>

      <section className={styles.card} aria-labelledby={SECCION_ID.cadena}>
        <h2 className={styles.cardTitle} id={SECCION_ID.cadena}>
          {evidencias.cadenaTitulo}
        </h2>
        <ul className={styles.chain}>
          {evidencias.cadena.map((eslabon) => (
            <li className={`${styles.chainItem} ${CLASE_TONO[eslabon.tono]}`} key={eslabon.id}>
              <span className={styles.chainStage}>{eslabon.clave}</span>
              <span className={styles.chainValue}>{eslabon.valor}</span>
              <span className={styles.chainNote}>{eslabon.detalle}</span>
            </li>
          ))}
        </ul>
        <p className={styles.viewNote}>{evidencias.cadenaNota}</p>
        <div className={styles.openEvidence}>
          <p className={styles.openEvidenceTitle}>{evidencias.alAbrirTitulo}</p>
          <p className={styles.openEvidenceText}>{evidencias.alAbrirTexto}</p>
        </div>
      </section>

      <p className={styles.viewNote}>{evidencias.conciliacionNota}</p>

      {movimiento === undefined ? null : (
        <MunicipalityFinancialDetails
          config={evidencias}
          movimiento={movimiento}
          onCerrar={cerrarDetalle}
          programas={programas.programas}
        />
      )}
    </div>
  );
}
