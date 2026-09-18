/**
 * Mapeo tipado entre intención semántica y expresión aprobada de la IA
 * (TASK-002A, FR-08 y FR-08A).
 *
 * La IA es un personaje expresivo, no una imagen única: cada superficie pide
 * una INTENCIÓN («escucha», «pregunta», …) y este módulo resuelve el asset y su
 * descripción. Ningún componente repite rutas de imagen ni decide una pose por
 * su cuenta, de modo que una pose no se reutiliza por conveniencia técnica.
 *
 * Procedencia de los assets
 * -------------------------
 * Todos provienen de la lámina de personalidad visual aprobada del prototipo y
 * se usan sin redibujar ni reinterpretar el personaje:
 *
 * - `escucha`, `explica`, `guia`, `motiva`, `agradece` y `saluda` son copias
 *   exactas de `prototype-claude/assets/eli/*.png`, que a su vez son recortes de
 *   las tarjetas «TE ESCUCHA», «TE EXPLICA», «TE GUÍA PASO A PASO», «TE MOTIVA»
 *   y «TE AGRADECE» de la lámina aprobada.
 * - `pregunta` no existía como archivo independiente en el prototipo. Se obtuvo
 *   un recorte fiel de la tarjeta «PREGUNTA» de la fila «ELÍ USA GESTOS Y
 *   EXPRESIONES PARA QUE TODO SEA MÁS FÁCIL» de `prototype-claude/ref/
 *   personaje2.png` (región 175,764 95×106 px del original de 1536×1024),
 *   reencuadrado a 108×121 px para igualar el encuadre de los assets
 *   existentes. El archivo fuente del prototipo no se modificó.
 *
 * Límite permanente: la expresión comunica cercanía y disposición a ayudar. No
 * expresa diagnóstico, urgencia clínica ni autoridad médica.
 */

/** Intenciones visuales disponibles. Cada una tiene una expresión distinta. */
export type EliIntencion =
  | 'escucha'
  | 'pregunta'
  | 'explica'
  | 'guia'
  | 'motiva'
  | 'agradece'
  | 'saluda';

export interface EliExpresion {
  /** Ruta pública del asset aprobado. */
  readonly src: string;
  /** Rótulo de la lámina aprobada del que procede la expresión. */
  readonly referencia: string;
  /** Qué comunica el gesto, para componer nombres accesibles. */
  readonly gesto: string;
}

export const EXPRESIONES: Readonly<Record<EliIntencion, EliExpresion>> = {
  escucha: {
    src: '/eli/escucha.png',
    referencia: 'TE ESCUCHA',
    gesto: 'atenta, con la mano cerca del oído',
  },
  pregunta: {
    src: '/eli/pregunta.png',
    referencia: 'PREGUNTA',
    gesto: 'pensativa, invitando a preguntar',
  },
  explica: {
    src: '/eli/explica.png',
    referencia: 'TE EXPLICA',
    gesto: 'explicando con la mano levantada',
  },
  guia: {
    src: '/eli/guia.png',
    referencia: 'TE GUÍA PASO A PASO',
    gesto: 'acompañando paso a paso',
  },
  motiva: {
    src: '/eli/motiva.png',
    referencia: 'TE MOTIVA',
    gesto: 'animando con el pulgar arriba',
  },
  agradece: {
    src: '/eli/agradece.png',
    referencia: 'TE AGRADECE',
    gesto: 'agradeciendo con las manos en forma de corazón',
  },
  saluda: {
    src: '/eli/saluda2.png',
    referencia: 'saludo de bienvenida',
    gesto: 'saludando con la mano',
  },
};

/** Expresión aprobada para una intención. */
export function expresionDe(intencion: EliIntencion): EliExpresion {
  return EXPRESIONES[intencion];
}
