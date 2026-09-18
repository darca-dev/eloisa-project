import type { HospitalVistaEncabezado } from './hospitalAgendaConfig';

/**
 * Contrato tipado y fixtures de la vista «Calificaciones»
 * (TASK-003H-04, alcance D).
 *
 * Fuente visual vinculante: `prototype-claude/Eligeme-Hospital.dc.html`,
 * vista `vCalificaciones` (líneas 548–622) y sus datos demostrativos
 * (líneas 1601–1630).
 *
 * Alcance: presentación y exclusivamente experiencia relativa al profesional.
 *
 * - Ninguna estrella, porcentaje, tendencia, factor o indicador es un indicador
 *   clínico oficial, una validación de calidad asistencial, una fórmula
 *   aprobada, una decisión clínica o una regla laboral automatizada.
 * - Nada se calcula, agrega, filtra, ordena ni persiste: los porcentajes de las
 *   barras son literales que reproducen la proporción ya dibujada por la
 *   referencia sobre una escala de 5.
 * - Los filtros son etiquetas visuales, no controles.
 * - La calificación de Elí queda fuera de alcance y no aparece aquí.
 */

/** Experiencia por profesional (prototipo, líneas 557–567 y 1601–1606). */
export interface HospitalRatingProfesional {
  readonly id: string;
  readonly nombre: string;
  readonly profesion: string;
  /** Número de evaluaciones ya redactado por la referencia. */
  readonly evaluaciones: string;
  readonly calificacion: string;
  /** Proporción de la barra sobre 5, tal como la dibuja la referencia. */
  readonly porcentaje: string;
  /** Token de color de la barra y de la cifra. */
  readonly color: string;
  readonly tendencia: string;
  /** Token de color de la tendencia; el texto ya la describe. */
  readonly tendenciaColor: string;
}

/** Factor de experiencia (prototipo, líneas 574–582 y 1607–1615). */
export interface HospitalRatingFactor {
  readonly etiqueta: string;
  readonly valor: string;
  readonly porcentaje: string;
  readonly color: string;
}

/** Indicador clínico demostrativo (prototipo, líneas 588–593 y 1616–1623). */
export interface HospitalRatingIndicador {
  readonly id: string;
  readonly valor: string;
  readonly etiqueta: string;
  readonly color: string;
}

/** Comentario de paciente o cuidador (prototipo, líneas 608–620 y 1625–1630). */
export interface HospitalRatingComentario {
  readonly id: string;
  readonly autor: string;
  readonly profesional: string;
  readonly calificacion: string;
  readonly texto: string;
  readonly meta: string;
  readonly color: string;
}

export interface HospitalRatingsConfig {
  readonly encabezado: HospitalVistaEncabezado;
  readonly experiencia: {
    readonly titulo: string;
    readonly items: readonly HospitalRatingProfesional[];
  };
  readonly factores: {
    readonly titulo: string;
    readonly subtitulo: string;
    readonly items: readonly HospitalRatingFactor[];
    /** Advertencia del prototipo: experiencia no es calidad clínica. */
    readonly nota: string;
  };
  readonly indicadores: {
    readonly titulo: string;
    readonly descripcion: string;
    readonly items: readonly HospitalRatingIndicador[];
  };
  readonly comentarios: {
    readonly titulo: string;
    /** Etiquetas de filtro; no son controles y no filtran datos. */
    readonly filtros: readonly string[];
    readonly items: readonly HospitalRatingComentario[];
  };
}

const VERDE = 'var(--b-verde)';
const AMARILLO = 'var(--b-amarillo)';
const PETROLEO = 'var(--b-petroleo-texto)';
const GRIS = 'var(--b-gris)';

/** Configuración demostrativa completa de la vista «Calificaciones». */
export const hospitalCalificacionesDemo: HospitalRatingsConfig = {
  encabezado: {
    titulo: 'Calidad y experiencia',
    descripcion:
      'Experiencia del paciente e indicadores clínicos se miden por separado. Una calificación de estrellas nunca determina si un diagnóstico o un medicamento fue correcto.',
  },
  experiencia: {
    titulo: 'Experiencia por profesional',
    items: [
      {
        id: 'carlos-ruiz',
        nombre: 'Enf. Carlos Ruiz',
        profesion: 'Enfermería',
        evaluaciones: '52',
        calificacion: '4.7',
        porcentaje: '94%',
        color: VERDE,
        tendencia: 'Sube 0.1',
        tendenciaColor: VERDE,
      },
      {
        id: 'diana-salas',
        nombre: 'Ft. Diana Salas',
        profesion: 'Fisioterapia',
        evaluaciones: '28',
        calificacion: '4.6',
        porcentaje: '92%',
        color: VERDE,
        tendencia: 'Estable',
        tendenciaColor: GRIS,
      },
      {
        id: 'juan-perez',
        nombre: 'Dr. Juan Pérez',
        profesion: 'Medicina general',
        evaluaciones: '41',
        calificacion: '4.4',
        porcentaje: '88%',
        color: VERDE,
        tendencia: 'Sube 0.2',
        tendenciaColor: VERDE,
      },
      {
        id: 'laura-gomez',
        nombre: 'Dra. Laura Gómez',
        profesion: 'Medicina general',
        evaluaciones: '38',
        calificacion: '4.1',
        porcentaje: '82%',
        color: AMARILLO,
        tendencia: 'Baja 0.2',
        tendenciaColor: AMARILLO,
      },
    ],
  },
  factores: {
    titulo: 'Factores que están afectando la experiencia',
    subtitulo: 'Dra. Laura Gómez · 4.1 de 5',
    items: [
      { etiqueta: 'Puntualidad', valor: '3.4', porcentaje: '68%', color: AMARILLO },
      { etiqueta: 'Tiempo dedicado', valor: '3.7', porcentaje: '74%', color: AMARILLO },
      { etiqueta: 'Orientación al cuidador', valor: '3.9', porcentaje: '78%', color: AMARILLO },
      {
        etiqueta: 'Claridad sobre medicamentos',
        valor: '4.3',
        porcentaje: '86%',
        color: PETROLEO,
      },
      { etiqueta: 'Orientación al paciente', valor: '4.4', porcentaje: '88%', color: PETROLEO },
      { etiqueta: 'Resolución de dudas', valor: '4.5', porcentaje: '90%', color: VERDE },
      { etiqueta: 'Profesionalismo', valor: '4.7', porcentaje: '94%', color: VERDE },
      { etiqueta: 'Comunicación', valor: '4.8', porcentaje: '96%', color: VERDE },
      { etiqueta: 'Empatía', valor: '4.9', porcentaje: '98%', color: VERDE },
    ],
    nota: 'Estas métricas miden experiencia, no calidad clínica.',
  },
  indicadores: {
    titulo: 'Indicadores clínicos',
    descripcion:
      'Provienen de revisión profesional, alertas, órdenes, seguimiento, adherencia y auditoría.',
    items: [
      {
        id: 'alertas',
        valor: '94 %',
        etiqueta: 'Alertas atendidas en el tiempo definido',
        color: VERDE,
      },
      { id: 'ordenes', valor: '88 %', etiqueta: 'Órdenes completadas', color: VERDE },
      {
        id: 'terapeuticos',
        valor: '100 %',
        etiqueta: 'Cambios terapéuticos documentados',
        color: VERDE,
      },
      {
        id: 'continuidad',
        valor: '91 %',
        etiqueta: 'Notas de continuidad atendidas',
        color: PETROLEO,
      },
      {
        id: 'adherencia',
        valor: '87 %',
        etiqueta: 'Adherencia a medicamentos registrada',
        color: PETROLEO,
      },
      {
        id: 'reingresos',
        valor: '2',
        etiqueta: 'Reingresos en 30 días pendientes de auditoría',
        color: AMARILLO,
      },
    ],
  },
  comentarios: {
    titulo: 'Comentarios de pacientes y cuidadores',
    filtros: ['Profesional', 'Fecha', 'Tipo de visita', 'Puntuación', 'Categoría'],
    items: [
      {
        id: 'maria-rodriguez',
        autor: 'María Rodríguez',
        profesional: 'Dra. Ana Torres',
        calificacion: '5 de 5',
        texto: 'Me explicó claramente cómo debía tomar el medicamento.',
        meta: '16 de agosto · visita domiciliaria',
        color: VERDE,
      },
      {
        id: 'ana-lopez',
        autor: 'Ana López (cuidadora)',
        profesional: 'Dra. Laura Gómez',
        calificacion: '4 de 5',
        texto: 'Fue muy amable, pero llegó tarde.',
        meta: '14 de agosto · visita domiciliaria',
        color: VERDE,
      },
      {
        id: 'alvaro-mesa',
        autor: 'Álvaro Mesa',
        profesional: 'Dr. Juan Pérez',
        calificacion: '3 de 5',
        texto: 'Sentí que la revisión fue muy rápida.',
        meta: '10 de agosto · consulta virtual',
        color: AMARILLO,
      },
      {
        id: 'andres-nieto',
        autor: 'Andrés Nieto (cuidador)',
        profesional: 'Enf. Carlos Ruiz',
        calificacion: '5 de 5',
        texto: 'Me enseñó cómo movilizar a mi mamá y respondió todas mis preguntas.',
        meta: '8 de agosto · visita domiciliaria',
        color: VERDE,
      },
    ],
  },
};
