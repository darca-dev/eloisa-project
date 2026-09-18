import type { ReactNode, Ref } from 'react';

import { formatearCantidadDemo } from './MunicipalityProgramForm';
import styles from './municipality.module.css';
import { fuenteMunicipal, municipalityDemo, programaMunicipal } from './municipalityConfig';
import type {
  MunicipalityConfig,
  MunicipalityCostoPromedio,
  MunicipalityDemoAviso,
  MunicipalityFuenteFinanciacion,
  MunicipalityPresupuestoConfig,
  MunicipalityPresupuestoPoblacion,
  MunicipalityProgramaPresupuesto,
  MunicipalityTono,
} from './municipalityConfig';

/**
 * Vista «Presupuesto y ejecución» de la experiencia Alcaldía
 * (TASK-ALCALDIA-A-04, FR-03, FR-04, FR-05, FR-06 y FR-14).
 *
 * Reproduce las líneas 316–370 de la referencia aprobada
 * `prototype-claude/Eligeme-Alcaldia.dc.html`, en su jerarquía vinculante:
 * título y subtítulo, cinco métricas del resumen, barra de ejecución con su
 * leyenda escrita, desglose «Por población» y la aclaración de que el gasto no
 * se duplica. Sobre esa estructura, y sin reordenarla, A-04 añade la semántica
 * financiera demostrativa, la composición por fuente y el presupuesto por
 * programa que la tarea exige.
 *
 * Naturaleza de los datos: todo llega por configuración tipada y es fixture
 * ficticio de diseño. Ninguna cifra se calcula, se consulta, se concilia ni
 * procede de una fuente oficial. Los porcentajes son valores declarados, no
 * indicadores oficiales: fuente, fórmula, periodo, propietario, versión y
 * linaje siguen pendientes.
 *
 * Semántica demostrativa: `ASIGNADO` es el presupuesto aprobado, `COMPROMETIDO`
 * el recurso reservado y todavía no pagado, `EJECUTADO` únicamente el dinero
 * pagado Y validado en el fixture, y `DISPONIBLE` el saldo declarado. Una
 * factura o un soporte cargado no cambian por sí solos ninguna de estas cifras.
 * Esto NO es contabilidad: no hay asiento, causación, cierre, conciliación,
 * pago ni motor de saldos, y la fórmula oficial sigue siendo una decisión
 * pendiente.
 *
 * Programas: cada fila resuelve por identificador contra la configuración de
 * Programas (A-03). Esta vista no duplica la entidad Programa, no recalcula sus
 * métricas y no crea otro catálogo.
 *
 * Redistribución y conciliación: no existen aquí. No hay botón, formulario,
 * diálogo, borrador ni operación, y ningún control modifica un saldo.
 *
 * Privacidad municipal: solo agregados institucionales y entidades ficticias.
 * No hay historia clínica, diagnóstico, identidad de personas atendidas,
 * ubicación individual ni compensación individual, y ninguna fila abre
 * drill-down nominal.
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
  titulo: 'municipality-presupuesto-titulo',
  resumen: 'municipality-presupuesto-resumen',
  semantica: 'municipality-presupuesto-semantica',
  fuentes: 'municipality-presupuesto-fuentes',
  programas: 'municipality-presupuesto-programas',
  poblacion: 'municipality-presupuesto-poblacion',
  ejecucion: 'municipality-presupuesto-ejecucion',
} as const;

/** Encabezado de la vista, con la etiqueta que la identifica como demostrativa. */
function MunicipalityBudgetHead({
  presupuesto,
  demo,
  tituloRef,
}: {
  readonly presupuesto: MunicipalityPresupuestoConfig;
  readonly demo: MunicipalityDemoAviso;
  readonly tituloRef?: Ref<HTMLHeadingElement>;
}): ReactNode {
  return (
    <div className={styles.viewHead}>
      <div className={styles.viewHeadRow}>
        <h1 className={styles.viewTitle} id={SECCION_ID.titulo} ref={tituloRef} tabIndex={-1}>
          {presupuesto.titulo}
        </h1>
        <p className={styles.demoTag}>{demo.etiqueta}</p>
      </div>
      <p className={styles.viewDescription}>{presupuesto.descripcion}</p>
      <p className={styles.viewNote}>{demo.aclaracion}</p>
    </div>
  );
}

/**
 * Resumen presupuestal general (FR-03).
 *
 * Las cinco métricas aparecen juntas y en el orden conceptual aprobado. La
 * barra reparte ejecutado, comprometido y disponible, pero los tres importes y
 * sus porcentajes están escritos en la leyenda: la barra solo los acompaña y se
 * oculta a las tecnologías de asistencia.
 */
function MunicipalityBudgetResumen({
  presupuesto,
}: {
  readonly presupuesto: MunicipalityPresupuestoConfig;
}): ReactNode {
  const { resumen } = presupuesto;

  return (
    <section className={styles.card} aria-labelledby={SECCION_ID.resumen}>
      <h2 className={styles.cardTitle} id={SECCION_ID.resumen}>
        {presupuesto.resumenTitulo}
      </h2>
      <p className="merdn-sr-only">{presupuesto.resumenAccesible}</p>
      <dl className={styles.statGrid}>
        {presupuesto.metricas.map((metrica) => (
          <div className={`${styles.statCard} ${CLASE_TONO[metrica.tono]}`} key={metrica.id}>
            <dt className={styles.statTerm}>
              <span className={styles.statValue}>{metrica.valor}</span>
              <span className={styles.statLabel}>{metrica.titulo}</span>
            </dt>
            <dd className={styles.statNote}>{metrica.aclaracion}</dd>
          </div>
        ))}
      </dl>
      <div className={styles.coverage}>
        <p className={styles.coverageHead} id={SECCION_ID.ejecucion}>
          <span className={styles.coverageLabel}>{presupuesto.ejecucionTitulo}</span>
          <span className={styles.coverageValue}>{resumen.porcentajeEjecucionTexto}</span>
        </p>
        {/* La barra es decorativa: cada tramo se lee en la leyenda escrita. */}
        <span className={styles.splitBar} aria-hidden="true">
          <span
            className={styles.splitBarEjecutado}
            style={{ width: `${resumen.porcentajeEjecucion}%` }}
          />
          <span
            className={styles.splitBarComprometido}
            style={{ width: `${resumen.porcentajeComprometido}%` }}
          />
        </span>
        <ul className={styles.legend} aria-labelledby={SECCION_ID.ejecucion}>
          {presupuesto.leyenda.map((item) => (
            <li className={`${styles.legendItem} ${CLASE_TONO[item.tono]}`} key={item.id}>
              <span className={styles.legendDot} aria-hidden="true" />
              <span className={styles.legendLabel}>{item.etiqueta}</span>
              <span className={styles.legendValue}>{item.valor}</span>
            </li>
          ))}
        </ul>
      </div>
      <p className={styles.viewNote}>{resumen.identidadContable}</p>
    </section>
  );
}

/**
 * Semántica financiera demostrativa (FR-06).
 *
 * Escribe las cuatro definiciones aprobadas, enuncia la secuencia conceptual
 * futura y deja constancia de que una factura no equivale a ejecución. Ningún
 * estado se comunica solo con color.
 */
function MunicipalityBudgetSemantica({
  presupuesto,
}: {
  readonly presupuesto: MunicipalityPresupuestoConfig;
}): ReactNode {
  return (
    <section className={styles.card} aria-labelledby={SECCION_ID.semantica}>
      <h2 className={styles.cardTitle} id={SECCION_ID.semantica}>
        {presupuesto.semanticaTitulo}
      </h2>
      <dl className={styles.definitionList}>
        {presupuesto.semantica.map((definicion) => (
          <div className={styles.definition} key={definicion.id}>
            <dt className={styles.definitionTerm}>{definicion.termino}</dt>
            <dd className={styles.definitionText}>{definicion.definicion}</dd>
          </div>
        ))}
      </dl>
      <div className={styles.sequenceBlock}>
        <p className={styles.sequenceTitle}>{presupuesto.secuenciaTitulo}</p>
        <ol className={styles.sequence}>
          {presupuesto.secuencia.map((paso) => (
            <li className={styles.sequenceStep} key={paso}>
              {paso}
            </li>
          ))}
        </ol>
        <p className={styles.viewNote}>{presupuesto.secuenciaNota}</p>
      </div>
      <p className={styles.highlight}>{presupuesto.facturaNota}</p>
    </section>
  );
}

/** Composición del presupuesto por fuente de financiación (FR-05). */
function MunicipalityBudgetFuentes({
  presupuesto,
  fuenteDe,
}: {
  readonly presupuesto: MunicipalityPresupuestoConfig;
  readonly fuenteDe: (fuenteId: string) => MunicipalityFuenteFinanciacion | undefined;
}): ReactNode {
  const { fuentesColumnas } = presupuesto;

  return (
    <section className={styles.card} aria-labelledby={SECCION_ID.fuentes}>
      <h2 className={styles.cardTitle} id={SECCION_ID.fuentes}>
        {presupuesto.fuentesTitulo}
      </h2>
      <div
        className={styles.tableScroll}
        role="group"
        aria-labelledby={SECCION_ID.fuentes}
        tabIndex={0}
      >
        <table className={styles.table}>
          <caption className="merdn-sr-only">{presupuesto.fuentesResumen}</caption>
          <thead>
            <tr>
              <th className={styles.tableHead} scope="col">
                {fuentesColumnas.fuente}
              </th>
              <th className={styles.tableHead} scope="col">
                {fuentesColumnas.monto}
              </th>
              <th className={styles.tableHead} scope="col">
                {fuentesColumnas.participacion}
              </th>
            </tr>
          </thead>
          <tbody>
            {presupuesto.fuentesAgregadas.map((agregada) => (
              <tr key={agregada.fuenteId}>
                <th className={styles.zoneName} scope="row">
                  {fuenteDe(agregada.fuenteId)?.etiqueta ?? agregada.fuenteId}
                </th>
                <td className={styles.cell}>{agregada.monto.texto}</td>
                <td className={styles.cell}>{agregada.porcentajeTexto}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={styles.viewNote}>{presupuesto.fuentesNota}</p>
      <p className={styles.highlight}>{presupuesto.adresNota}</p>
    </section>
  );
}

/** Costo promedio con su numerador, su denominador y su metodología escritos. */
function CostoPromedio({
  costo,
  etiquetas,
}: {
  readonly costo: MunicipalityCostoPromedio;
  readonly etiquetas: MunicipalityPresupuestoConfig['etiquetas'];
}): ReactNode {
  return (
    <div className={styles.methodBlock}>
      <p className={styles.methodValue}>
        {etiquetas.costoPromedio}: {costo.texto}
      </p>
      <p className={styles.methodDetail}>
        {etiquetas.numerador}: {costo.numerador} · {etiquetas.denominador}: {costo.denominador}
      </p>
      <p className={styles.methodDetail}>
        {etiquetas.metodologia}: {costo.metodologia}
      </p>
    </div>
  );
}

/** Celda de la cuadrícula de datos del programa. */
function DatoPresupuesto({
  clave,
  valor,
}: {
  readonly clave: string;
  readonly valor: string;
}): ReactNode {
  return (
    <div className={styles.dataCell}>
      <dt className={styles.dataKey}>{clave}</dt>
      <dd className={styles.dataValue}>{valor}</dd>
    </div>
  );
}

/**
 * Presupuesto de un programa (FR-04 y FR-14.2).
 *
 * Nombre, importes visibles, meta física, cumplimiento, beneficiarios únicos,
 * actividad, evidencias y resultado se leen del programa de A-03 por
 * identificador. Este componente no deriva ningún importe, no recalcula ningún
 * porcentaje y no reinterpreta ninguna métrica: cuando el programa no declara
 * un dato, escribe «Sin registro», que no es lo mismo que cero.
 */
function MunicipalityBudgetPrograma({
  presupuestoPrograma,
  presupuesto,
  fuenteDe,
  programas,
}: {
  readonly presupuestoPrograma: MunicipalityProgramaPresupuesto;
  readonly presupuesto: MunicipalityPresupuestoConfig;
  readonly fuenteDe: (fuenteId: string) => MunicipalityFuenteFinanciacion | undefined;
  readonly programas: MunicipalityConfig['programas'];
}): ReactNode {
  const programa = programaMunicipal(presupuestoPrograma.programaId, programas.programas);

  if (programa === undefined) {
    return null;
  }

  const { etiquetas } = presupuesto;
  const { sinRegistro } = etiquetas;
  const tituloId = `municipality-presupuesto-${programa.id}`;
  const fuentesId = `${tituloId}-fuentes`;
  const { avanceFinanciero, avanceFisico, evidencias } = programa;

  return (
    <li className={`${styles.programCard} ${CLASE_TONO[avanceFinanciero.tono]}`}>
      <h3 className={styles.programName} id={tituloId}>
        {programa.nombre}
      </h3>
      <dl className={styles.dataGrid}>
        <DatoPresupuesto clave={etiquetas.asignado} valor={programa.presupuesto.asignado} />
        <DatoPresupuesto
          clave={etiquetas.comprometido}
          valor={avanceFinanciero.comprometido ?? sinRegistro}
        />
        <DatoPresupuesto
          clave={etiquetas.ejecutado}
          valor={avanceFinanciero.ejecutado ?? sinRegistro}
        />
        <DatoPresupuesto
          clave={etiquetas.disponible}
          valor={avanceFinanciero.disponible ?? sinRegistro}
        />
        <DatoPresupuesto
          clave={etiquetas.ejecucionFinanciera}
          valor={avanceFinanciero.porcentajeTexto ?? sinRegistro}
        />
        <DatoPresupuesto clave={etiquetas.moneda} valor={programa.presupuesto.moneda} />
        <DatoPresupuesto
          clave={etiquetas.metaFisica}
          valor={`${formatearCantidadDemo(avanceFisico.metaFisica)} ${avanceFisico.unidad}`}
        />
        <DatoPresupuesto
          clave={etiquetas.cumplimientoFisico}
          valor={avanceFisico.porcentajeTexto ?? sinRegistro}
        />
        <DatoPresupuesto
          clave={etiquetas.beneficiariosUnicos}
          valor={programa.beneficiariosUnicos}
        />
        {/* Cadena programa → dinero → actividad → evidencia → resultado. */}
        <DatoPresupuesto
          clave={etiquetas.actividad}
          valor={`${programa.actividad.valor} · ${programa.actividad.etiqueta}`}
        />
        <DatoPresupuesto
          clave={etiquetas.evidencias}
          valor={evidencias.actividadesConSoporte}
        />
        <DatoPresupuesto
          clave={etiquetas.resultado}
          valor={
            avanceFisico.resultadoFisico === null
              ? sinRegistro
              : `${formatearCantidadDemo(avanceFisico.resultadoFisico)} ${avanceFisico.unidad} · ${avanceFisico.resultadoEtiqueta}`
          }
        />
      </dl>
      <div className={styles.tagGroup} role="group" aria-labelledby={fuentesId}>
        <p className={styles.tagGroupLabel} id={fuentesId}>
          {etiquetas.fuentes}
        </p>
        <ul className={styles.tagList}>
          {presupuestoPrograma.fuentes.map((asignacion) => (
            <li className={styles.tag} key={asignacion.fuenteId}>
              {fuenteDe(asignacion.fuenteId)?.etiqueta ?? asignacion.fuenteId}:{' '}
              {asignacion.monto.texto}
            </li>
          ))}
        </ul>
      </div>
      {presupuestoPrograma.costoPromedio === null ? (
        <p className={styles.viewNote}>
          {etiquetas.costoPromedio}: {sinRegistro}
        </p>
      ) : (
        <CostoPromedio costo={presupuestoPrograma.costoPromedio} etiquetas={etiquetas} />
      )}
    </li>
  );
}

/** Presupuesto por programa; los programas son los de A-03, por identificador. */
function MunicipalityBudgetProgramas({
  presupuesto,
  programas,
  fuenteDe,
}: {
  readonly presupuesto: MunicipalityPresupuestoConfig;
  readonly programas: MunicipalityConfig['programas'];
  readonly fuenteDe: (fuenteId: string) => MunicipalityFuenteFinanciacion | undefined;
}): ReactNode {
  return (
    <section className={styles.card} aria-labelledby={SECCION_ID.programas}>
      <h2 className={styles.cardTitle} id={SECCION_ID.programas}>
        {presupuesto.programasTitulo}
      </h2>
      <p className="merdn-sr-only">{presupuesto.programasResumen}</p>
      <ul className={styles.programList}>
        {presupuesto.programas.map((presupuestoPrograma) => (
          <MunicipalityBudgetPrograma
            fuenteDe={fuenteDe}
            key={presupuestoPrograma.programaId}
            presupuesto={presupuesto}
            presupuestoPrograma={presupuestoPrograma}
            programas={programas}
          />
        ))}
      </ul>
      <p className={styles.viewNote}>{presupuesto.programasNota}</p>
      <p className={styles.viewNote}>{presupuesto.cadenaNota}</p>
    </section>
  );
}

/** Fila del desglose por población base. */
function MunicipalityBudgetPoblacionFila({
  fila,
  sinRegistro,
}: {
  readonly fila: MunicipalityPresupuestoPoblacion;
  readonly sinRegistro: string;
}): ReactNode {
  return (
    <tr>
      <th className={styles.zoneName} scope="row">
        {fila.etiqueta}
      </th>
      <td className={styles.cell}>{fila.asignado.texto}</td>
      <td className={`${styles.cell} ${styles.cellEjecutado}`}>{fila.ejecutado.texto}</td>
      <td className={styles.cell}>{fila.beneficiariosUnicos}</td>
      <td className={styles.cell}>{fila.costoPromedio?.texto ?? sinRegistro}</td>
    </tr>
  );
}

/**
 * Desglose «Por población» de la referencia aprobada (FR-14).
 *
 * Las poblaciones base son distintas de los programas y sus filas no se suman
 * entre sí ni con ellos. El costo promedio solo aparece cuando el fixture
 * declara numerador, denominador y metodología; su metodología se escribe
 * completa debajo de la tabla, de modo que ninguna cifra quede sin explicar.
 */
function MunicipalityBudgetPoblacion({
  presupuesto,
}: {
  readonly presupuesto: MunicipalityPresupuestoConfig;
}): ReactNode {
  const { poblacionColumnas, etiquetas } = presupuesto;

  return (
    <section className={styles.card} aria-labelledby={SECCION_ID.poblacion}>
      <h2 className={styles.cardTitle} id={SECCION_ID.poblacion}>
        {presupuesto.poblacionTitulo}
      </h2>
      <div
        className={styles.tableScroll}
        role="group"
        aria-labelledby={SECCION_ID.poblacion}
        tabIndex={0}
      >
        <table className={styles.table}>
          <caption className="merdn-sr-only">{presupuesto.poblacionResumen}</caption>
          <thead>
            <tr>
              <th className={styles.tableHead} scope="col">
                {poblacionColumnas.poblacion}
              </th>
              <th className={styles.tableHead} scope="col">
                {poblacionColumnas.asignado}
              </th>
              <th className={styles.tableHead} scope="col">
                {poblacionColumnas.ejecutado}
              </th>
              <th className={styles.tableHead} scope="col">
                {poblacionColumnas.beneficiarios}
              </th>
              <th className={styles.tableHead} scope="col">
                {poblacionColumnas.costoPromedio}
              </th>
            </tr>
          </thead>
          <tbody>
            {presupuesto.poblacion.map((fila) => (
              <MunicipalityBudgetPoblacionFila
                fila={fila}
                key={fila.poblacionId}
                sinRegistro={etiquetas.sinRegistro}
              />
            ))}
          </tbody>
        </table>
      </div>
      {presupuesto.poblacion.map((fila) =>
        fila.costoPromedio === null ? null : (
          <div className={styles.methodBlock} key={fila.poblacionId}>
            <p className={styles.methodValue}>
              {fila.etiqueta} · {etiquetas.costoPromedio}: {fila.costoPromedio.texto}
            </p>
            <p className={styles.methodDetail}>
              {etiquetas.numerador}: {fila.costoPromedio.numerador} · {etiquetas.denominador}:{' '}
              {fila.costoPromedio.denominador}
            </p>
            <p className={styles.methodDetail}>
              {etiquetas.metodologia}: {fila.costoPromedio.metodologia}
            </p>
          </div>
        ),
      )}
      <p className={styles.highlight}>{presupuesto.poblacionNota}</p>
      <p className={styles.viewNote}>{presupuesto.poblacionAtribucionNota}</p>
    </section>
  );
}

export function MunicipalityBudget({
  config = municipalityDemo,
  tituloRef,
}: {
  readonly config?: MunicipalityConfig;
  /** Referencia del encabezado principal, para el foco al cambiar de vista. */
  readonly tituloRef?: Ref<HTMLHeadingElement>;
}): ReactNode {
  const { presupuesto, programas, demo } = config;

  /** Resolución del catálogo de fuentes; ninguna vista repite sus etiquetas. */
  const fuenteDe = (fuenteId: string): MunicipalityFuenteFinanciacion | undefined =>
    fuenteMunicipal(fuenteId);

  return (
    <div className={styles.view}>
      <MunicipalityBudgetHead demo={demo} presupuesto={presupuesto} tituloRef={tituloRef} />
      <MunicipalityBudgetResumen presupuesto={presupuesto} />
      <MunicipalityBudgetSemantica presupuesto={presupuesto} />
      <MunicipalityBudgetFuentes fuenteDe={fuenteDe} presupuesto={presupuesto} />
      <MunicipalityBudgetProgramas
        fuenteDe={fuenteDe}
        presupuesto={presupuesto}
        programas={programas}
      />
      <MunicipalityBudgetPoblacion presupuesto={presupuesto} />
      <p className={styles.viewNote}>{presupuesto.redistribucionNota}</p>
    </div>
  );
}
