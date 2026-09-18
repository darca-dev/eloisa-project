import type { CSSProperties, ReactNode } from 'react';

import { HospitalIcon } from './HospitalIcon';
import styles from './hospitalRatings.module.css';
import { hospitalCalificacionesDemo } from './hospitalRatingsConfig';
import type { HospitalRatingsConfig } from './hospitalRatingsConfig';
import {
  HospitalBarra,
  HospitalCard,
  HospitalCardHeader,
  HospitalChips,
  HospitalNote,
  HospitalViewHeader,
  hospitalViewStyles as compartido,
} from './HospitalViewPieces';

/**
 * Vista «Calificaciones» (TASK-003H-04, alcance D).
 *
 * Reproduce las líneas 548–622 del prototipo oficial: la explicación que separa
 * experiencia de indicadores clínicos, la experiencia por profesional con su
 * barra y tendencia, los factores que afectan la experiencia con la advertencia
 * «Estas métricas miden experiencia, no calidad clínica», el bloque
 * demostrativo de indicadores clínicos y los comentarios con sus filtros
 * visuales, autores, profesional, calificación, texto y metadatos.
 *
 * Alcance: presentación y exclusivamente experiencia relativa al profesional.
 * Ninguna cifra, estrella, barra, tendencia o indicador es un indicador clínico
 * oficial, una validación de calidad asistencial, una fórmula aprobada, una
 * decisión clínica o una regla laboral automatizada. Nada se calcula, agrega,
 * filtra, ordena ni persiste. La calificación de Elí está fuera de alcance y no
 * aparece en esta vista.
 */

const TITULO_ID = 'hospital-calificaciones-titulo';
const TITULO_EXPERIENCIA_ID = 'hospital-calificaciones-experiencia';
const TITULO_FACTORES_ID = 'hospital-calificaciones-factores';
const TITULO_INDICADORES_ID = 'hospital-calificaciones-indicadores';
const TITULO_COMENTARIOS_ID = 'hospital-calificaciones-comentarios';

export function HospitalRatings({
  config = hospitalCalificacionesDemo,
}: {
  readonly config?: HospitalRatingsConfig;
}): ReactNode {
  return (
    <div className={compartido.view}>
      <HospitalViewHeader encabezado={config.encabezado} tituloId={TITULO_ID} />

      <HospitalCard aria-labelledby={TITULO_EXPERIENCIA_ID}>
        <HospitalCardHeader
          titulo={config.experiencia.titulo}
          tituloId={TITULO_EXPERIENCIA_ID}
        />
        <ul className={styles.experiencia}>
          {config.experiencia.items.map((profesional) => (
            <li className={styles.profesional} key={profesional.id}>
              <span className={styles.profesionalTextos}>
                <span className={styles.profesionalNombre}>{profesional.nombre}</span>
                <span className={styles.profesionalMeta}>
                  {`${profesional.profesion} · ${profesional.evaluaciones} evaluaciones`}
                </span>
              </span>
              <span className={styles.profesionalBarra}>
                <HospitalBarra
                  porcentaje={profesional.porcentaje}
                  color={profesional.color}
                  etiquetaAccesible={`Experiencia de ${profesional.nombre}: ${profesional.calificacion} de 5`}
                />
              </span>
              <span
                className={styles.profesionalValor}
                style={{ color: profesional.color } as CSSProperties}
              >
                {profesional.calificacion}
              </span>
              <span
                className={styles.profesionalTendencia}
                style={{ color: profesional.tendenciaColor } as CSSProperties}
              >
                {profesional.tendencia}
              </span>
            </li>
          ))}
        </ul>
      </HospitalCard>

      <div className={styles.columnas}>
        <HospitalCard gap={16} className={styles.columna} aria-labelledby={TITULO_FACTORES_ID}>
          <h2 className={styles.bloqueTitulo} id={TITULO_FACTORES_ID}>
            {config.factores.titulo}
          </h2>
          <p className={styles.bloqueSubtitulo}>{config.factores.subtitulo}</p>
          <ul className={styles.factores}>
            {config.factores.items.map((factor) => (
              <li className={styles.factor} key={factor.etiqueta}>
                <span className={styles.factorCabecera}>
                  <span className={styles.factorEtiqueta}>{factor.etiqueta}</span>
                  <span
                    className={styles.factorValor}
                    style={{ color: factor.color } as CSSProperties}
                  >
                    {factor.valor}
                  </span>
                </span>
                <HospitalBarra
                  porcentaje={factor.porcentaje}
                  color={factor.color}
                  alto={9}
                  etiquetaAccesible={`${factor.etiqueta}: ${factor.valor} de 5`}
                />
              </li>
            ))}
          </ul>
          <HospitalNote>{config.factores.nota}</HospitalNote>
        </HospitalCard>

        <HospitalCard className={styles.columna} aria-labelledby={TITULO_INDICADORES_ID}>
          <h2 className={styles.bloqueTitulo} id={TITULO_INDICADORES_ID}>
            {config.indicadores.titulo}
          </h2>
          <p className={styles.bloqueDescripcion}>{config.indicadores.descripcion}</p>
          <ul className={styles.indicadores}>
            {config.indicadores.items.map((indicador) => (
              <li
                className={styles.indicador}
                key={indicador.id}
                style={{ '--h-indicador-color': indicador.color } as CSSProperties}
              >
                <span className={styles.indicadorValor}>{indicador.valor}</span>
                <span className={styles.indicadorEtiqueta}>{indicador.etiqueta}</span>
              </li>
            ))}
          </ul>
        </HospitalCard>
      </div>

      <HospitalCard aria-labelledby={TITULO_COMENTARIOS_ID}>
        <HospitalCardHeader
          titulo={config.comentarios.titulo}
          tituloId={TITULO_COMENTARIOS_ID}
          extra={
            <HospitalChips
              items={config.comentarios.filtros}
              etiquetaAccesible="Recorte demostrativo aplicado a los comentarios"
              compacto
            />
          }
        />
        <ul className={styles.comentarios}>
          {config.comentarios.items.map((comentario) => (
            <li className={styles.comentario} key={comentario.id}>
              <p className={styles.comentarioCabecera}>
                <span className={styles.comentarioAutor}>
                  {`${comentario.autor} · ${comentario.profesional}`}
                </span>
                <span
                  className={styles.comentarioCalificacion}
                  style={{ color: comentario.color } as CSSProperties}
                >
                  <HospitalIcon name="calificaciones" size={17} relleno />
                  {comentario.calificacion}
                </span>
              </p>
              <p className={styles.comentarioTexto}>{comentario.texto}</p>
              <p className={styles.comentarioMeta}>{comentario.meta}</p>
            </li>
          ))}
        </ul>
      </HospitalCard>
    </div>
  );
}
