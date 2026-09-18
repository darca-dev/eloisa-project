import type { ReactNode } from 'react';

import styles from './hospitalProfessionals.module.css';
import {
  HOSPITAL_PROFESIONALES_NO_DISPONIBLE,
  type HospitalProfessionalsCopy,
} from './hospitalProfessionalsConfig';
import type { HospitalVinculoDto } from './hospitalProfessionalsClient';
import { etiquetaEstadoVinculo, etiquetaVinculo, textoFecha } from './hospitalProfessionalsListado';
import { hospitalViewStyles as compartido } from './HospitalViewPieces';

/**
 * Bloque «Vinculación» del panel de detalle
 * (TASK-HOSPITAL-CORE-02 §3.1; paquete de continuación §3.1.2).
 *
 * QUÉ CAMBIÓ. Este bloque componía una superficie contractual completa —
 * identidad documental, categorías de documentos, contrato, salario, honorarios,
 * periodicidad, modalidad de cobro y una salida futura a «Gestión financiera»—
 * a partir de fixtures. La plataforma NO modela nada de eso, de modo que
 * mostrarlo junto a un nombre real convertía una maqueta en una afirmación
 * sobre la relación laboral de una persona.
 *
 * Ahora publica EXCLUSIVAMENTE el vínculo declarado que devuelve
 * `GET /api/v1/hospital/professionals/:id`: tipo, estado, inicio y fin. Todo lo
 * demás se declara `No disponible en este módulo`, que no es un valor vacío ni
 * un cero: dice que el dato no existe en la plataforma.
 *
 * Alcance: presentación. No hay documentos, nómina, seguridad social,
 * retenciones, prestaciones, cuentas de cobro, tarifas ni pagos, y nada de eso
 * se calcula. La etiqueta del vínculo describe lo DECLARADO y no acredita
 * contrato, habilitación, nómina ni documento verificado.
 */

/** Identificador estable del bloque dentro del panel de detalle. */
export const HOSPITAL_VINCULACION_BLOQUE_ID = 'hospital-profesionales-vinculacion';

const TITULO_ID = `${HOSPITAL_VINCULACION_BLOQUE_ID}-titulo`;
const NO_MODELADO_ID = `${HOSPITAL_VINCULACION_BLOQUE_ID}-no-modelado`;
const ACCIONES_ID = `${HOSPITAL_VINCULACION_BLOQUE_ID}-acciones`;

/** Campo clave/valor del vínculo declarado. */
function VinculoCampo({
  etiqueta,
  valor,
}: {
  readonly etiqueta: string;
  readonly valor: string;
}): ReactNode {
  return (
    <div className={styles.vinculacionCampo}>
      <dt className={styles.vinculacionEtiqueta}>{etiqueta}</dt>
      <dd className={styles.vinculacionValor}>{valor}</dd>
    </div>
  );
}

export function ProfessionalEngagementPanel({
  vinculo,
  copy,
}: {
  /** Vínculo ACTIVO servido, o `null` cuando la persona no tiene ninguno. */
  readonly vinculo: HospitalVinculoDto | null;
  readonly copy: HospitalProfessionalsCopy['panel'];
}): ReactNode {
  return (
    <section
      className={styles.bloque}
      id={HOSPITAL_VINCULACION_BLOQUE_ID}
      aria-labelledby={TITULO_ID}
    >
      <div className={styles.bloqueCabecera}>
        <h3 className={styles.bloqueTitulo} id={TITULO_ID}>
          {copy.tituloVinculo}
        </h3>
      </div>

      {vinculo === null ? (
        <p className={styles.bloqueVacio}>{copy.sinVinculo}</p>
      ) : (
        <dl className={styles.vinculacionCampos}>
          <VinculoCampo
            etiqueta={copy.etiquetaTipo}
            valor={etiquetaVinculo(vinculo.engagementType)}
          />
          <VinculoCampo
            etiqueta={copy.etiquetaEstadoVinculo}
            valor={etiquetaEstadoVinculo(vinculo.status)}
          />
          <VinculoCampo etiqueta={copy.etiquetaInicio} valor={textoFecha(vinculo.startsOn)} />
          <VinculoCampo etiqueta={copy.etiquetaFin} valor={textoFecha(vinculo.endsOn)} />
        </dl>
      )}

      {/*
       * Lo que la plataforma NO modela se enumera de forma explícita. Callarlo
       * dejaría creer que el bloque está completo; inventarlo afirmaría datos
       * contractuales, económicos y de desempeño que nadie declaró.
       */}
      <section className={styles.vinculacionGrupo} aria-labelledby={NO_MODELADO_ID}>
        <h4 className={styles.vinculacionGrupoTitulo} id={NO_MODELADO_ID}>
          {copy.tituloNoModelado}
        </h4>
        <ul className={styles.vinculacionDocumentos}>
          {copy.noModelados.map((etiqueta) => (
            <li className={styles.vinculacionDocumento} key={etiqueta}>
              <span className={styles.vinculacionDocumentoNombre}>{etiqueta}</span>
              <span className={styles.vinculacionSinFuente}>
                {HOSPITAL_PROFESIONALES_NO_DISPONIBLE}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/*
       * Acciones fuera del alcance de este slice. Se muestran DESHABILITADAS y
       * con ayuda accesible en lugar de ocultarse, para que la persona
       * administrativa sepa que existen y que todavía no operan. Ninguna tiene
       * controlador: no pueden llamar a la red aunque se habilitaran por error.
       */}
      <div className={styles.agendaAcciones} role="group" aria-labelledby={ACCIONES_ID}>
        <h4 className="merdn-sr-only" id={ACCIONES_ID}>
          {copy.tituloAcciones}
        </h4>
        {copy.acciones.map((accion) => (
          <button
            key={accion.etiqueta}
            type="button"
            disabled
            aria-describedby={`${ACCIONES_ID}-${accion.etiqueta.replace(/\s+/gu, '-')}`}
            className={`${compartido.button} ${compartido.buttonNeutro} ${styles.agendaAccion}`}
          >
            {accion.etiqueta}
            <span
              className="merdn-sr-only"
              id={`${ACCIONES_ID}-${accion.etiqueta.replace(/\s+/gu, '-')}`}
            >
              {accion.ayuda}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
