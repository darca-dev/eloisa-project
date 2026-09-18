import type { ReactNode } from 'react';

/**
 * Iconos del menú de Alcaldía (TASK-ALCALDIA-A-01, §8.2).
 *
 * Reproducen la geometría de los SVG inline de la referencia aprobada
 * `prototype-claude/Eligeme-Alcaldia.dc.html` (líneas 30–82): misma caja
 * `0 0 24 24`, `fill="none"`, trazo `currentColor`, grosor `2` y las mismas
 * terminaciones redondeadas. No se añade ninguna librería de iconos y no se
 * sustituye ningún trazado por emojis, caracteres Unicode ni aproximaciones.
 *
 * Son decorativos (`aria-hidden`, `focusable="false"`): la etiqueta de texto
 * contigua ya comunica la función y duplicarla generaría ruido en lectores de
 * pantalla.
 */

export type MunicipalityIconName =
  | 'inicio'
  | 'poblacion'
  | 'territorio'
  | 'programas'
  | 'presupuesto'
  | 'evidencias'
  | 'furag'
  | 'adres'
  | 'cuidado'
  | 'brechas'
  | 'cuidadores'
  | 'indicadores'
  | 'reportes';

const PATHS: Record<MunicipalityIconName, ReactNode> = {
  inicio: (
    <>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
    </>
  ),
  poblacion: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.9" />
    </>
  ),
  territorio: (
    <>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" />
      <circle cx="12" cy="10" r="3" />
    </>
  ),
  programas: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M8 4v16M3 10h18" />
    </>
  ),
  presupuesto: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v10M9.5 9.5h5M9.5 14.5h5" />
    </>
  ),
  evidencias: (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="m9 15 2 2 4-4" />
    </>
  ),
  furag: (
    <>
      <path d="M3 3v18h18" />
      <path d="m7 15 4-5 3 3 4-6" />
    </>
  ),
  adres: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 10h18M8 15h4" />
    </>
  ),
  cuidado: (
    <path d="M19 14c1.5-1.5 3-3.3 3-5.5A5.5 5.5 0 0 0 12 5.5 5.5 5.5 0 0 0 2 8.5C2 13 12 21 12 21" />
  ),
  brechas: (
    <>
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
      <path d="M12 9v4M12 17h.01" />
    </>
  ),
  cuidadores: (
    <>
      <path d="M22 9 12 5 2 9l10 4z" />
      <path d="M6 11v5c0 1.5 3 3 6 3s6-1.5 6-3v-5" />
    </>
  ),
  indicadores: (
    <>
      <rect x="4" y="12" width="3" height="8" />
      <rect x="10.5" y="7" width="3" height="13" />
      <rect x="17" y="3" width="3" height="17" />
    </>
  ),
  reportes: (
    <>
      <path d="M6 2h9l5 5v15a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" />
      <path d="M9 12h6M9 16h6M9 8h3" />
    </>
  ),
};

export function MunicipalityIcon({
  name,
  size = 17,
}: {
  readonly name: MunicipalityIconName;
  /** Tamaño de la caja; la referencia dibuja el menú a 17 px. */
  readonly size?: number;
}): ReactNode {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {PATHS[name]}
    </svg>
  );
}
