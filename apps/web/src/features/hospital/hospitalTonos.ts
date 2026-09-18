/**
 * Tonos de estado de la experiencia Hospital (TASK-003H-03, FR-05).
 *
 * Reproduce la constante `V` del prototipo oficial
 * (`prototype-claude/Eligeme-Hospital.dc.html`, línea 1185), que es la única
 * fuente de color de estados, badges y alarmas en las vistas de Agenda,
 * Pacientes y Semáforo de alarmas.
 *
 * Cada tono se expresa con tokens del sistema (`src/styles/tokens.css`) cuyo
 * valor coincide exactamente con el del prototipo; `--h-azul-suave` es el color
 * de borde que el Shell Hospital ya declara localmente en `.shell`.
 *
 * Alcance: presentación. Un tono NO es una clasificación clínica, no evalúa
 * rangos, no prioriza y no genera alarmas: es el color que la referencia ya
 * asignó a un texto de estado que también se lee como texto.
 */

/** Terna de color de un tono: texto, fondo y borde. */
export interface HospitalTono {
  readonly texto: string;
  readonly fondo: string;
  readonly borde: string;
}

export const HOSPITAL_TONOS = {
  /** `V.verde` / `V.bgVerde` / `#BFE5C9`. */
  verde: {
    texto: 'var(--b-verde)',
    fondo: 'var(--b-verde-fondo)',
    borde: 'var(--b-verde-borde)',
  },
  /** `V.amar` / `V.bgAmar` / `#F3DCA9`. */
  amarillo: {
    texto: 'var(--b-amarillo)',
    fondo: 'var(--b-amarillo-fondo)',
    borde: 'var(--b-amarillo-borde)',
  },
  /** `V.rojo` / `V.bgRojo` / `#F5C2C2`. */
  rojo: {
    texto: 'var(--b-rojo)',
    fondo: 'var(--b-rojo-fondo)',
    borde: 'var(--b-rojo-borde)',
  },
  /** `V.azul` / `V.bgAzul` / `#B9DCE6`. */
  azul: {
    texto: 'var(--b-azul)',
    fondo: 'var(--b-celeste)',
    borde: 'var(--h-azul-suave)',
  },
  /** `V.teal` / `V.bgAzul` / `#B9DCE6`. */
  petroleo: {
    texto: 'var(--b-petroleo-texto)',
    fondo: 'var(--b-celeste)',
    borde: 'var(--h-azul-suave)',
  },
} as const satisfies Record<string, HospitalTono>;

export type HospitalTonoId = keyof typeof HOSPITAL_TONOS;
