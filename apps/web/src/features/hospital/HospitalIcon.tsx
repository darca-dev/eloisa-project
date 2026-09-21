import type { ReactNode } from 'react';

/**
 * Iconos del Shell Hospital (TASK-003H-01, FR-05).
 *
 * Reproducen exactamente los SVG inline de la referencia oficial
 * `prototype-claude/Eligeme-Hospital.dc.html` (líneas 22–101): misma caja
 * `0 0 24 24`, `fill="none"`, trazo `currentColor`, grosor `2` y las mismas
 * terminaciones visibles. No se añade ninguna librería de iconos ni se
 * sustituye ningún trazado por emojis o aproximaciones.
 *
 * Son decorativos (`aria-hidden`): la etiqueta de texto contigua ya comunica
 * la función y duplicarla generaría ruido en lectores de pantalla.
 */

export type HospitalIconName =
  | 'inicio'
  | 'agenda'
  | 'pacientes'
  | 'alarmas'
  | 'profesionales'
  | 'visitas'
  | 'virtuales'
  | 'calificaciones'
  | 'novedades'
  | 'membresias'
  | 'financiera'
  | 'reportes'
  | 'configuracion'
  | 'buscar'
  | 'campana'
  | 'usuarios'
  | 'reloj'
  | 'check'
  | 'medicamento'
  | 'ingreso'
  | 'egreso'
  | 'candado'
  | 'saldo'
  | 'credencial'
  | 'edificio'
  | 'caja'
  | 'acuerdo'
  | 'enlace'
  | 'menu'
  | 'cerrar';

/** Trazado compartido por la campana del menú y la de la topbar. */
const CAMPANA: ReactNode = (
  <>
    <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.7 21a2 2 0 0 1-3.4 0" />
  </>
);

const PATHS: Record<HospitalIconName, ReactNode> = {
  inicio: (
    <>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
    </>
  ),
  agenda: (
    <>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </>
  ),
  pacientes: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.9" />
      <path d="M16 3.1a4 4 0 0 1 0 7.8" />
    </>
  ),
  alarmas: (
    <>
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
      <path d="M12 9v4M12 17h.01" />
    </>
  ),
  profesionales: (
    <>
      <path d="M11 2v2a4 4 0 0 1-8 0V2" />
      <path d="M7 8v4a6 6 0 0 0 12 0v-1" />
      <circle cx="20" cy="10" r="2" />
    </>
  ),
  visitas: (
    <>
      <path d="M3 10l9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="M9 22V12h6v10" />
    </>
  ),
  virtuales: (
    <>
      <rect x="2" y="6" width="14" height="12" rx="2" />
      <path d="M22 8l-6 4 6 4z" />
    </>
  ),
  calificaciones: <path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.7 5.8 21l1.2-6.8-5-4.9 6.9-1z" />,
  novedades: CAMPANA,
  membresias: (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6M9 13h6M9 17h4" />
    </>
  ),
  /*
   * `financiera` no procede del prototipo: la opción «Gestión financiera» del
   * menú es una decisión posterior de la Product Owner y el prototipo no dibuja
   * ningún icono para ella. Se traza en el mismo sistema visual del resto
   * —caja `0 0 24 24`, `fill="none"`, `currentColor`, grosor 2— y no sustituye
   * ni altera ningún trazado existente.
   */
  financiera: (
    <>
      <rect x="2" y="6" width="20" height="13" rx="2" />
      <path d="M2 10h20" />
      <path d="M17 15h2" />
    </>
  ),
  reportes: (
    <>
      <path d="M3 3v18h18" />
      <rect x="7" y="12" width="3" height="6" />
      <rect x="12" y="8" width="3" height="10" />
      <rect x="17" y="5" width="3" height="13" />
    </>
  ),
  configuracion: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 7 19.4a1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3 14H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 7a1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 10 3V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.7 1.7 0 0 0 21 10h.1a2 2 0 1 1 0 4H21a1.7 1.7 0 0 0-1.6 1z" />
    </>
  ),
  /*
   * Extensión mínima para el Dashboard (TASK-003H-02, FR-03).
   *
   * `usuarios` es el trazado de la tarjeta «PACIENTES ACTIVOS» (prototipo,
   * línea 121). No reutiliza `pacientes` porque el icono del menú declara un
   * cuarto trazo (`M16 3.1a4 4 0 0 1 0 7.8`) que la tarjeta no dibuja; alterar
   * `pacientes` para compartirlo rompería la fidelidad del sidebar.
   */
  usuarios: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.9" />
    </>
  ),
  /* Trazado de la tarjeta «CITAS PENDIENTES DE ASIGNACIÓN» (prototipo, línea 121). */
  reloj: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  buscar: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4.3-4.3" />
    </>
  ),
  campana: CAMPANA,
  /*
   * Extensión mínima para las vistas de operación (TASK-003H-03, FR-05.7).
   *
   * `check` es el trazado exacto que la referencia usa en las condiciones del
   * paciente (línea 320, con grosor 2.4) y en la tarjeta «Estables o revisadas»
   * del semáforo (línea 371, con grosor 2). Por eso el grosor es una propiedad
   * y no se duplica el trazado.
   */
  check: <path d="m20 6-11 11-5-5" />,
  /*
   * Extensión mínima para «Novedades» (TASK-003H-04, FR-02.6).
   *
   * `medicamento` es el trazado exacto de la novedad de bitácora (prototipo,
   * línea 632, `icPill`). Ninguna otra vista lo dibuja, por eso no se reutiliza
   * ningún trazado existente.
   */
  medicamento: (
    <>
      <path d="m10.5 20.5 10-10a5 5 0 0 0-7-7l-10 10a5 5 0 0 0 7 7z" />
      <path d="m8.5 8.5 7 7" />
    </>
  ),
  /*
   * Extensión mínima para «Gestión financiera» (TASK-003H-06, apartado 6).
   *
   * El prototipo oficial no dibuja el módulo financiero, así que estos nueve
   * trazados no reproducen ninguna línea suya: se trazan en el mismo sistema
   * visual del resto —caja `0 0 24 24`, `fill="none"`, `currentColor`, grosor 2
   * y las mismas terminaciones— y cubren exactamente la semántica que la Task
   * enumera: flecha entrante, flecha saliente, candado, saldo, credencial,
   * edificio, caja, acuerdo y enlace. No sustituyen ni alteran ningún trazado
   * existente y no se añade ninguna librería de iconos.
   */
  ingreso: (
    <>
      <path d="M12 4v13" />
      <path d="m6 11 6 6 6-6" />
      <path d="M4 21h16" />
    </>
  ),
  egreso: (
    <>
      <path d="M12 20V7" />
      <path d="m6 13 6-6 6 6" />
      <path d="M4 3h16" />
    </>
  ),
  candado: (
    <>
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </>
  ),
  saldo: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v10" />
      <path d="M15 9.5A2.5 2.5 0 0 0 12.5 8h-1a2 2 0 0 0 0 4h1a2 2 0 0 1 0 4h-1A2.5 2.5 0 0 1 9 14.5" />
    </>
  ),
  credencial: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="9" cy="11" r="2" />
      <path d="M6 16a3 3 0 0 1 6 0" />
      <path d="M15 10h4M15 14h4" />
    </>
  ),
  edificio: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 7h2M14 7h2M8 11h2M14 11h2M8 15h2M14 15h2" />
      <path d="M10 21v-3h4v3" />
    </>
  ),
  caja: (
    <>
      <path d="M3 8h18v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="M3 8 5 3h14l2 5" />
      <path d="M10 12h4" />
    </>
  ),
  acuerdo: (
    <>
      <path d="M3 8h4l3 3" />
      <path d="M21 8h-4l-4 4 2 2 3-3" />
      <path d="m7 11 3 3 2 2 2 2" />
      <path d="M3 8v8h2M21 8v8h-2" />
    </>
  ),
  enlace: (
    <>
      <path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1" />
      <path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1" />
    </>
  ),
  menu: (
    <>
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="18" x2="20" y2="18" />
    </>
  ),
  cerrar: (
    <>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </>
  ),
};

/**
 * Iconos que en la referencia declaran únicamente `stroke-linecap="round"`
 * (buscador y campana de la topbar). El resto declara además
 * `stroke-linejoin="round"`.
 */
const SIN_LINEJOIN: ReadonlySet<HospitalIconName> = new Set<HospitalIconName>(['buscar', 'campana']);

export function HospitalIcon({
  name,
  size = 18,
  strokeWidth = 2,
  relleno = false,
}: {
  readonly name: HospitalIconName;
  readonly size?: number;
  /** Grosor de trazo; solo la referencia lo cambia (2.4 en las condiciones). */
  readonly strokeWidth?: number;
  /**
   * Variante rellena. La referencia solo la usa en la estrella de los
   * comentarios de «Calidad y experiencia» (prototipo, línea 613), que declara
   * `fill="currentColor" stroke="none"` sobre el mismo trazado.
   */
  readonly relleno?: boolean;
}): ReactNode {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={relleno ? 'currentColor' : 'none'}
      stroke={relleno ? 'none' : 'currentColor'}
      strokeWidth={relleno ? undefined : strokeWidth}
      strokeLinecap={relleno ? undefined : 'round'}
      strokeLinejoin={relleno || SIN_LINEJOIN.has(name) ? undefined : 'round'}
    >
      {PATHS[name]}
    </svg>
  );
}
