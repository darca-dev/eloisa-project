'use client';

import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react';

import styles from './municipality.module.css';
import {
  MUNICIPALITY_AUDIENCIAS,
  MUNICIPALITY_ESTADOS_EVIDENCIA,
  MUNICIPALITY_ESTADOS_FINANCIEROS,
  MUNICIPALITY_ESTADOS_VALIDACION,
  MUNICIPALITY_ORIGENES_MOVIMIENTO,
  MUNICIPALITY_SYNC_ETIQUETAS,
  MUNICIPALITY_TIPOS_EVIDENCIA,
  evidenciasDeMovimiento,
  fuenteMunicipal,
  programaMunicipal,
} from './municipalityConfig';
import type {
  MunicipalityEvidenciaFinanciera,
  MunicipalityEvidenciasConfig,
  MunicipalityMovimientoFinanciero,
  MunicipalityPrograma,
  MunicipalityRegistroRef,
} from './municipalityConfig';

/**
 * Detalle local «Ver evidencia» de la experiencia Alcaldía
 * (TASK-ALCALDIA-A-04, FR-08, FR-12 y FR-13).
 *
 * Muestra ÚNICAMENTE metadatos ficticios del movimiento y de las evidencias que
 * lo referencian, resueltos desde la configuración local por identificador. No
 * hay archivo, blob, adjunto, miniatura, enlace, dirección remota, carga ni
 * obtención de documento: el almacenamiento, la integridad, el control de
 * versiones, el antimalware y los permisos documentales corresponden a una
 * tarea posterior.
 *
 * Procedencia y sincronización: los metadatos de origen, identificador externo,
 * sistema maestro y estado de sincronización solo preparan una conexión futura.
 * Cuando no existe conexión, el diálogo escribe «Conexión no habilitada» y deja
 * la última sincronización como «Sin sincronización»: nunca fabrica una fecha,
 * un éxito ni un dato externo, y no existe ninguna acción de conciliación.
 *
 * Registro único: el movimiento tiene un identificador interno propio y una o
 * varias referencias externas opcionales. Un identificador externo no es
 * identidad global ni identidad interna, y las audiencias declaran contextos de
 * visibilidad del MISMO registro, no copias por experiencia. Ver una audiencia
 * aquí no concede ningún permiso.
 *
 * Este diálogo no crea, no edita, no aprueba, no paga, no valida y no cambia
 * ningún estado ni ningún saldo.
 */

/** Selector de los elementos que pueden recibir foco dentro del diálogo. */
const FOCUSABLES = 'button:not([disabled])';

/** Fila de metadatos del detalle. */
function Dato({ clave, valor }: { readonly clave: string; readonly valor: string }): ReactNode {
  return (
    <div className={styles.detailRow}>
      <dt className={styles.detailKey}>{clave}</dt>
      <dd className={styles.detailValue}>{valor}</dd>
    </div>
  );
}

/** Texto de un registro o de una revisión; `null` se escribe como sin registro. */
function textoRegistro(
  registro: MunicipalityRegistroRef | null,
  sinRegistro: string,
): string {
  return registro === null ? sinRegistro : `${registro.rol} · ${registro.fecha}`;
}

/** Bloque de metadatos de una evidencia relacionada. */
function EvidenciaRelacionada({
  evidencia,
  etiquetas,
  programa,
  fuenteEtiqueta,
}: {
  readonly evidencia: MunicipalityEvidenciaFinanciera;
  readonly etiquetas: MunicipalityEvidenciasConfig['detalle'];
  readonly programa: MunicipalityPrograma | undefined;
  readonly fuenteEtiqueta: string;
}): ReactNode {
  return (
    <li className={styles.detailEvidence}>
      <p className={styles.detailEvidenceTitle}>{evidencia.referencia}</p>
      <dl className={styles.detailList}>
        <Dato clave={etiquetas.idInterno} valor={evidencia.id} />
        <Dato
          clave={etiquetas.evidenciaTipo}
          valor={MUNICIPALITY_TIPOS_EVIDENCIA[evidencia.tipo]}
        />
        <Dato
          clave={etiquetas.evidenciaEstado}
          valor={MUNICIPALITY_ESTADOS_EVIDENCIA[evidencia.estado]}
        />
        <Dato clave={etiquetas.evidenciaActividad} valor={evidencia.actividad} />
        <Dato clave={etiquetas.programa} valor={programa?.nombre ?? evidencia.programaId} />
        <Dato clave={etiquetas.fuente} valor={fuenteEtiqueta} />
        <Dato clave={etiquetas.entidad} valor={evidencia.entidad} />
        <Dato clave={etiquetas.valor} valor={`${evidencia.valorTexto} ${evidencia.moneda}`} />
        <Dato clave={etiquetas.evidenciaInstitucion} valor={evidencia.institucion} />
        <Dato
          clave={etiquetas.origen}
          valor={MUNICIPALITY_ORIGENES_MOVIMIENTO[evidencia.origen]}
        />
        <Dato
          clave={etiquetas.registradoPor}
          valor={textoRegistro(evidencia.registro, etiquetas.sinRegistro)}
        />
        <Dato
          clave={etiquetas.revisadoPor}
          valor={textoRegistro(evidencia.revision, etiquetas.sinRegistro)}
        />
      </dl>
    </li>
  );
}

export function MunicipalityFinancialDetails({
  movimiento,
  config,
  programas,
  onCerrar,
}: {
  readonly movimiento: MunicipalityMovimientoFinanciero;
  readonly config: MunicipalityEvidenciasConfig;
  readonly programas: readonly MunicipalityPrograma[];
  readonly onCerrar: () => void;
}): ReactNode {
  const base = useId();
  const dialogoRef = useRef<HTMLDivElement>(null);
  const tituloRef = useRef<HTMLHeadingElement>(null);

  const etiquetas = config.detalle;
  const programa = programaMunicipal(movimiento.programaId, programas);
  const fuente = fuenteMunicipal(movimiento.fuenteId);
  const evidencias = evidenciasDeMovimiento(movimiento.id, config.evidencias);
  const referencia = movimiento.sync.referencias[0];

  /*
   * Al abrir, el foco entra en el título: sin ello quien navega con teclado o
   * lector de pantalla seguiría en la tabla de fondo sin que nada anuncie que
   * se abrió un detalle modal.
   */
  useEffect(() => {
    tituloRef.current?.focus();
  }, []);

  /** Ciclo de foco dentro del diálogo y cierre con `Escape`. */
  const alPulsarTecla = (evento: KeyboardEvent<HTMLDivElement>): void => {
    if (evento.key === 'Escape') {
      evento.stopPropagation();
      onCerrar();

      return;
    }

    if (evento.key !== 'Tab') {
      return;
    }

    const contenedor = dialogoRef.current;

    if (contenedor === null) {
      return;
    }

    const focusables = [...contenedor.querySelectorAll<HTMLElement>(FOCUSABLES)];
    const primero = focusables[0];
    const ultimo = focusables[focusables.length - 1];

    if (primero === undefined || ultimo === undefined) {
      return;
    }

    const activo = contenedor.ownerDocument.activeElement;

    if (evento.shiftKey && (activo === primero || activo === tituloRef.current)) {
      evento.preventDefault();
      ultimo.focus();

      return;
    }

    if (!evento.shiftKey && activo === ultimo) {
      evento.preventDefault();
      primero.focus();
    }
  };

  const tituloId = `${base}-titulo`;
  const descripcionId = `${base}-descripcion`;
  const evidenciasId = `${base}-evidencias`;

  return (
    /*
     * El fondo oscurece la página pero no cierra al pulsar: cerrar es siempre
     * una acción explícita, con `Cerrar` o con `Escape`.
     */
    <div className={styles.dialogBackdrop}>
      <div
        aria-describedby={descripcionId}
        aria-labelledby={tituloId}
        aria-modal="true"
        className={styles.dialog}
        onKeyDown={alPulsarTecla}
        ref={dialogoRef}
        role="dialog"
      >
        <h2 className={styles.dialogTitle} id={tituloId} ref={tituloRef} tabIndex={-1}>
          {etiquetas.titulo} · {movimiento.referencia}
        </h2>
        <p className={styles.dialogDescription} id={descripcionId}>
          {config.sinArchivoNota}
        </p>

        <dl className={styles.detailList}>
          <Dato clave={etiquetas.idInterno} valor={movimiento.id} />
          <Dato clave={etiquetas.referencia} valor={movimiento.referencia} />
          <Dato clave={etiquetas.fecha} valor={movimiento.fecha} />
          <Dato clave={etiquetas.concepto} valor={movimiento.concepto} />
          <Dato
            clave={etiquetas.tipoSoporte}
            valor={MUNICIPALITY_TIPOS_EVIDENCIA[movimiento.tipoSoporte]}
          />
          <Dato clave={etiquetas.programa} valor={programa?.nombre ?? movimiento.programaId} />
          <Dato clave={etiquetas.fuente} valor={fuente?.etiqueta ?? movimiento.fuenteId} />
          <Dato clave={etiquetas.entidad} valor={movimiento.entidad} />
          <Dato clave={etiquetas.valor} valor={movimiento.valorTexto} />
          <Dato clave={etiquetas.moneda} valor={movimiento.moneda} />
          <Dato
            clave={etiquetas.estadoFinanciero}
            valor={MUNICIPALITY_ESTADOS_FINANCIEROS[movimiento.estadoFinanciero]}
          />
          <Dato
            clave={etiquetas.estadoValidacion}
            valor={MUNICIPALITY_ESTADOS_VALIDACION[movimiento.estadoValidacion]}
          />
          <Dato
            clave={etiquetas.origen}
            valor={MUNICIPALITY_ORIGENES_MOVIMIENTO[movimiento.origen]}
          />
          <Dato
            clave={etiquetas.registradoPor}
            valor={textoRegistro(movimiento.registro, etiquetas.sinRegistro)}
          />
          <Dato
            clave={etiquetas.revisadoPor}
            valor={textoRegistro(movimiento.revision, etiquetas.sinRegistro)}
          />
          <Dato
            clave={etiquetas.audiencias}
            valor={movimiento.audiencias
              .map((audiencia) => MUNICIPALITY_AUDIENCIAS[audiencia])
              .join(' · ')}
          />
          <Dato clave={etiquetas.sistemaMaestro} valor={movimiento.sync.masterSystem} />
          <Dato
            clave={etiquetas.sistemaFuente}
            valor={referencia?.sourceSystem ?? etiquetas.sinRegistro}
          />
          <Dato
            clave={etiquetas.institucion}
            valor={referencia?.institutionId ?? etiquetas.sinRegistro}
          />
          <Dato
            clave={etiquetas.referenciaExterna}
            valor={referencia?.externalId ?? etiquetas.sinReferenciaExterna}
          />
          {/* Sin conexión no se fabrica ninguna fecha ni ningún resultado. */}
          <Dato
            clave={etiquetas.sincronizacion}
            valor={MUNICIPALITY_SYNC_ETIQUETAS[movimiento.sync.syncStatus]}
          />
          <Dato
            clave={etiquetas.ultimaSincronizacion}
            valor={movimiento.sync.lastSyncedAt ?? etiquetas.sinSincronizacion}
          />
          <Dato clave={etiquetas.procedencia} valor={movimiento.procedencia.fuente} />
        </dl>

        <p className={styles.detailGroupTitle} id={evidenciasId}>
          {etiquetas.evidencias}
        </p>
        <ul aria-labelledby={evidenciasId} className={styles.detailEvidenceList}>
          {evidencias.map((evidencia) => (
            <EvidenciaRelacionada
              etiquetas={etiquetas}
              evidencia={evidencia}
              fuenteEtiqueta={fuenteMunicipal(evidencia.fuenteId)?.etiqueta ?? evidencia.fuenteId}
              key={evidencia.id}
              programa={programaMunicipal(evidencia.programaId, programas)}
            />
          ))}
        </ul>

        <p className={styles.viewNote}>{config.conciliacionNota}</p>

        <div className={styles.dialogActions}>
          <button className={styles.buttonPrimary} onClick={onCerrar} type="button">
            {etiquetas.cerrar}
          </button>
        </div>
      </div>
    </div>
  );
}
