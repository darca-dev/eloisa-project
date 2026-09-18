import type { ReactNode, Ref } from 'react';

import styles from './municipality.module.css';
import { MUNICIPALITY_ESTADOS_CONEXION, municipalityDemo } from './municipalityConfig';
import type {
  MunicipalityConfig,
  MunicipalityDemoAviso,
  MunicipalityReportesConfig,
} from './municipalityConfig';

/**
 * Vista «Reportes ejecutivos» de la experiencia Alcaldía
 * (TASK-ALCALDIA-DEMO-FINAL, §14).
 *
 * Reproduce las líneas 676–709 de la referencia aprobada
 * `prototype-claude/Eligeme-Alcaldia.dc.html`: aviso de vista demostrativa,
 * portada azul del informe con sus ocho datos y las nueve tarjetas de informe
 * con sus formatos.
 *
 * Generación no habilitada: los controles de formato son botones
 * genuinamente deshabilitados. No hay enlace, no hay atributo de descarga, no
 * hay Blob, no hay red y no hay ningún manejador que simule éxito o anuncie un
 * archivo generado. El estado `Disponible en una fase futura` se escribe junto
 * a cada tarjeta y forma parte del nombre accesible de cada control, de modo
 * que nadie pueda leer la pantalla como una capacidad existente.
 *
 * Portada: cada valor reproduce un dato ya declarado por A-01–A-04 —población
 * objetivo y beneficiarios, presupuesto asignado y ejecución, nivel de
 * evidencia y número de brechas abiertas— y la configuración lo cita en lugar
 * de recalcularlo aquí.
 *
 * Privacidad municipal: solo agregados. No hay personas, documentos, ubicación
 * exacta, información asistencial individual, listados ni exportación.
 */

/** Identificadores de los títulos que nombran cada región de la vista. */
const SECCION_ID = {
  titulo: 'municipality-reportes-titulo',
  portada: 'municipality-reportes-portada',
  catalogo: 'municipality-reportes-catalogo',
} as const;

/** Encabezado de la vista, con la etiqueta que la identifica como demostrativa. */
function MunicipalityReportsHead({
  reportes,
  demo,
  tituloRef,
}: {
  readonly reportes: MunicipalityReportesConfig;
  readonly demo: MunicipalityDemoAviso;
  readonly tituloRef?: Ref<HTMLHeadingElement>;
}): ReactNode {
  return (
    <div className={styles.viewHead}>
      <div className={styles.viewHeadRow}>
        <h1 className={styles.viewTitle} id={SECCION_ID.titulo} ref={tituloRef} tabIndex={-1}>
          {reportes.titulo}
        </h1>
        <p className={styles.demoTag}>{demo.etiqueta}</p>
      </div>
      <p className={styles.viewDescription}>{reportes.descripcion}</p>
      {/* El aviso es texto, no color: se lee igual sin percibir el fondo. */}
      <p className={styles.stateNote}>{reportes.aviso}</p>
      <ul className={styles.limitList}>
        {reportes.limites.map((limite) => (
          <li className={styles.limitItem} key={limite}>
            {limite}
          </li>
        ))}
      </ul>
      <p className={styles.viewNote}>{demo.aclaracion}</p>
    </div>
  );
}

/** Portada del informe: ocho datos ya declarados por otras pantallas. */
function MunicipalityReportsPortada({
  reportes,
}: {
  readonly reportes: MunicipalityReportesConfig;
}): ReactNode {
  return (
    <section aria-labelledby={SECCION_ID.portada} className={styles.reportCover}>
      <p className={styles.reportCoverEyebrow}>{reportes.portadaEtiqueta}</p>
      <h2 className={styles.reportCoverTitle} id={SECCION_ID.portada}>
        {reportes.portadaTitulo}
      </h2>
      <dl className={styles.reportCoverGrid}>
        {reportes.portada.map((dato) => (
          <div className={styles.reportCoverItem} key={dato.id}>
            <dt className={styles.reportCoverKey}>{dato.clave}</dt>
            <dd className={styles.reportCoverValue}>{dato.valor}</dd>
          </div>
        ))}
      </dl>
      <p className={styles.reportCoverNote}>{reportes.portadaResumen}</p>
    </section>
  );
}

export function MunicipalityReports({
  config = municipalityDemo,
  tituloRef,
}: {
  readonly config?: MunicipalityConfig;
  /** Referencia del encabezado principal, para el foco al cambiar de vista. */
  readonly tituloRef?: Ref<HTMLHeadingElement>;
}): ReactNode {
  const { reportes, demo } = config;

  return (
    <div className={styles.view}>
      <MunicipalityReportsHead demo={demo} reportes={reportes} tituloRef={tituloRef} />
      <MunicipalityReportsPortada reportes={reportes} />
      <section aria-labelledby={SECCION_ID.catalogo} className={styles.view}>
        <h2 className={styles.cardTitle} id={SECCION_ID.catalogo}>
          {reportes.catalogoTitulo}
        </h2>
        <ul className={styles.reportGrid}>
          {reportes.reportes.map((reporte) => {
            const estadoId = `${SECCION_ID.catalogo}-${reporte.id}-estado`;

            return (
              <li className={styles.reportCard} key={reporte.id}>
                <h3 className={styles.reportTitle}>{reporte.titulo}</h3>
                <p className={styles.reportText}>{reporte.descripcion}</p>
                <p className={styles.reportText}>{reportes.formatosEtiqueta}</p>
                <div className={styles.reportFormats}>
                  {reporte.formatos.map((formato) => (
                    <button
                      aria-describedby={estadoId}
                      /*
                       * El nombre accesible lleva el formato, el informe y el
                       * estado: nadie debe descubrir por el color que el
                       * control está inactivo.
                       */
                      aria-label={`${formato} · ${reporte.titulo} · ${reporte.estadoTexto}`}
                      className={styles.reportFormat}
                      disabled
                      key={formato}
                      type="button"
                    >
                      {formato}
                    </button>
                  ))}
                </div>
                <p className={styles.reportStatus} id={estadoId}>
                  {reporte.estadoTexto}
                  {' · '}
                  {MUNICIPALITY_ESTADOS_CONEXION[reporte.fuente.estadoConexion]}
                </p>
              </li>
            );
          })}
        </ul>
        <p className={styles.viewNote}>{reportes.notaFormatos}</p>
        <p className={styles.highlight}>{reportes.notaFuentes}</p>
      </section>
    </div>
  );
}
