/**
 * Utilidades compartidas por las pruebas Hospital (TASK-003H-03).
 *
 * Las vistas se renderizan con `react-dom/server`, igual que el resto del
 * frontend: el repositorio no incluye jsdom ni una librería de testing con DOM,
 * y esta tarea no autoriza añadir dependencias. Por eso las pruebas verifican
 * el marcado renderizado y la lógica de navegación y de selección local, que
 * están extraídas como funciones puras y como propiedades de montaje.
 */

import type { HospitalSesionDto } from './hospitalInstitutionClient';

/** Entidades que React escapa en el marcado y que estas pruebas comparan. */
const ENTIDADES: readonly (readonly [RegExp, string])[] = [
  [/&quot;/gu, '"'],
  [/&#x27;/gu, "'"],
  [/&lt;/gu, '<'],
  [/&gt;/gu, '>'],
  [/&amp;/gu, '&'],
];

/** Texto visible del marcado, con espacios normalizados. */
export function texto(html: string): string {
  const plano = html.replace(/<[^>]*>/gu, ' ');
  const decodificado = ENTIDADES.reduce(
    (acumulado, [patron, valor]) => acumulado.replace(patron, valor),
    plano,
  );

  return decodificado.replace(/\s+/gu, ' ').trim();
}

/** Contenido del único `<main>` del shell. */
export function main(html: string): string {
  return /<main[^>]*>(?<contenido>[\s\S]*)<\/main>/u.exec(html)?.groups?.contenido ?? '';
}

/** Número de apariciones de un patrón en el marcado. */
export function apariciones(html: string, patron: RegExp): number {
  return (html.match(patron) ?? []).length;
}

/**
 * Sesión institucional FICTICIA compartida por las pruebas Hospital.
 *
 * Desde MP-TODAY-02 el shell no monta Hospital sin una sesión resuelta: sin
 * ella muestra el estado neutral de comprobación, y sin sesión vigente muestra
 * el acceso. Las suites que verifican contenido Hospital inyectan ESTA sesión
 * por propiedad, que es la única fuente ficticia del repositorio para ese
 * contexto: así no se duplican identidades de prueba divergentes.
 *
 * Todos los valores son ficticios y ninguno corresponde a una institución, una
 * persona o un entorno real. El actor es IMPERSONAL a propósito: la credencial
 * institucional es compartida y no identifica a ninguna persona trabajadora.
 */
export const SESION_INSTITUCIONAL_FICTICIA: HospitalSesionDto = {
  role: 'HOSPITAL_PATIENT_VIEWER',
  expiresAt: '2026-08-22T20:00:00.000Z',
  institution: { name: 'Institución ficticia de pruebas' },
  actorDisplay: 'Acceso institucional',
};
