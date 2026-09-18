/**
 * Utilidades de las pruebas de Alcaldía (TASK-ALCALDIA-A-01, §18).
 *
 * Las vistas se renderizan con `react-dom/server`, igual que el resto del
 * frontend: el repositorio no incluye jsdom ni una librería de testing con DOM,
 * y esta tarea no autoriza añadir dependencias. Por eso las pruebas verifican
 * el marcado renderizado y la lógica de navegación y de selección local, que
 * están extraídas como funciones puras y como propiedades de montaje.
 *
 * Estas utilidades son locales a la feature a propósito: Alcaldía no importa
 * módulos de Hospital ni acopla sus pruebas a otra experiencia.
 */

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

/** Etiquetas de texto de los botones del marcado, en orden de aparición. */
export function etiquetasDeBotones(html: string): readonly string[] {
  return [...html.matchAll(/<button\b[^>]*>(?<contenido>[\s\S]*?)<\/button>/gu)].map((coincidencia) =>
    texto(coincidencia.groups?.contenido ?? ''),
  );
}
