import type { ReactNode } from 'react';

import {
  AdminAccion,
  AdminAviso,
  AdminCamposFuturos,
  hospitalAdminStyles as styles,
} from './HospitalAdminPieces';
import type { HospitalClinicaConfig } from './hospitalAdministrationConfig';
import {
  HospitalCard,
  HospitalCardHeader,
  HospitalNote,
  tonoVars,
} from './HospitalViewPieces';

/**
 * Bloque «Información clínica institucional» (TASK-003H-05, FR-03).
 *
 * Reproduce la composición de `Importar historia clínica` del prototipo oficial
 * (líneas 729–778) y sus datos demostrativos (líneas 1254–1260): naturaleza de
 * la información, archivo de ejemplo, resumen de conteos, posible coincidencia,
 * acciones de revisión y nota de trazabilidad.
 *
 * Extensión aprobada por la Task: la sección se presenta como **información
 * clínica institucional autorizada o importada**, no como una historia clínica
 * electrónica completa de MERDN. MERDN no sustituye la HCE de la institución.
 *
 * Alcance: presentación. No hay interoperabilidad, carga de archivos, lectura,
 * parsing, deduplicación, conciliación, consentimiento, almacenamiento, reglas
 * clínicas ni escritura sobre ningún expediente. El archivo, los conteos y el
 * posible duplicado son ejemplos del prototipo y se rotulan como tales; las
 * acciones quedan deshabilitadas y no producen ni simulan resultado alguno.
 * Los metadatos de procedencia previstos se muestran sin valor: no se inventan.
 */

const TITULO_ID = 'hospital-admin-clinica';
const RESUMEN_ID = 'hospital-admin-clinica-resumen';
const COINCIDENCIA_ID = 'hospital-admin-clinica-coincidencia';
const PROCEDENCIA_ID = 'hospital-admin-clinica-procedencia';

export function HospitalClinicalImport({
  config,
}: {
  readonly config: HospitalClinicaConfig;
}): ReactNode {
  return (
    <div className={styles.panel}>
      <AdminAviso>{config.aviso}</AdminAviso>

      <HospitalCard gap={16} aria-labelledby={TITULO_ID}>
        <HospitalCardHeader titulo={config.titulo} tituloId={TITULO_ID} />
        <p className={styles.bloqueTexto}>{config.descripcion}</p>

        <div className={styles.bloques}>
          {config.bloques.map((bloque) => (
            <section className={styles.bloque} key={bloque.id}>
              <h3 className={styles.bloqueTitulo}>{bloque.titulo}</h3>
              <p className={styles.bloqueTexto}>{bloque.descripcion}</p>
              <span className={styles.bloqueFormatos}>{bloque.formatos}</span>
            </section>
          ))}
        </div>

        <div className={styles.marcoPunteado}>
          <span className={styles.marcoTextos}>
            <span className={styles.marcoEtiqueta}>{config.archivo.etiquetaEjemplo}</span>
            <span className={styles.marcoTitulo}>{config.archivo.nombre}</span>
            <span className={styles.marcoDetalle}>{config.archivo.detalle}</span>
          </span>
          <AdminAccion accion={config.archivo.accion} />
        </div>

        <section className={styles.subBloque} aria-labelledby={RESUMEN_ID}>
          <h3 className={styles.bloqueTitulo} id={RESUMEN_ID}>
            {config.resumen.titulo}
          </h3>
          <ul className={styles.conteos}>
            {config.resumen.items.map((conteo) => (
              <li className={styles.conteo} key={conteo.id} style={tonoVars(conteo.tono)}>
                <span className={styles.conteoValor}>{conteo.valor}</span>
                <span className={styles.conteoEtiqueta}>{conteo.etiqueta}</span>
              </li>
            ))}
          </ul>
        </section>
        <HospitalNote>{config.resumen.nota}</HospitalNote>

        <section className={styles.subBloque} aria-labelledby={COINCIDENCIA_ID}>
          <AdminAviso atencion titulo={config.coincidencia.titulo} tituloId={COINCIDENCIA_ID}>
            {config.coincidencia.descripcion}
          </AdminAviso>
          <div className={styles.acciones}>
            {config.coincidencia.acciones.map((accion) => (
              <AdminAccion accion={accion} key={accion.id} tamano="pildora" />
            ))}
          </div>
        </section>

        <div className={styles.acciones}>
          {config.acciones.map((accion) => (
            <AdminAccion accion={accion} key={accion.id} tamano="grande" />
          ))}
        </div>

        <HospitalNote>{config.nota}</HospitalNote>
      </HospitalCard>

      <HospitalCard gap={14}>
        <AdminCamposFuturos bloque={config.procedencia} tituloId={PROCEDENCIA_ID} />
      </HospitalCard>
    </div>
  );
}
