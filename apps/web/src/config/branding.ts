/**
 * Configuración de branding visible definitiva (TASK-BRAND-01).
 *
 * MERDN es el nombre técnico interno y confidencial del proyecto y NO se
 * muestra en pantalla en ninguna superficie.
 *
 * El Product Owner aprobó como identidad definitiva `Eloisa` para la
 * plataforma e `Isa` para la asistente virtual, y ordenó eliminar sin
 * reemplazo el antiguo eslogan «Evidencia · Local · Inteligente». Los nombres
 * anteriores no se conservan en ninguna superficie visible.
 *
 * Reglas aplicadas:
 * - Fuente única: ningún componente repite estos literales.
 * - Sin secretos, sin variables de entorno, sin comportamiento por tenant,
 *   sin red y sin JSX (AC-23).
 * - Centralizar el nombre NO autoriza cambiar textos, assets ni composición
 *   del diseño aprobado (AD-14): los identificadores técnicos internos
 *   (`ExperienciaMerdn`, `Eli*`, `/eli/*.png`, `merdn-sr-only`, `MERDN_*`)
 *   conservan su nombre porque no son texto visible.
 */

/** Contrato de identidad visible definitiva. */
export interface BrandingConfig {
  /** Nombre visible de la plataforma. */
  readonly platformDisplayName: string;
  /** Bajada institucional que acompaña al nombre en el prototipo. */
  readonly platformTagline: string;
  /** Nombre visible de la asistente virtual. */
  readonly aiDisplayName: string;
}

/**
 * Valores definitivos aprobados por el Product Owner (TASK-BRAND-01,
 * decisiones aprobadas 1 y 2).
 *
 * `platformTagline` conserva la bajada institucional aprobada del prototipo y
 * no forma parte de la migración de marca: «Atención domiciliaria» sigue
 * siendo una capacidad legítima del producto.
 *
 * El encabezado de INSCRIPCIÓN ya no lleva subtítulo: el antiguo
 * `inscriptionSubtitle` se retiró del contrato y del runtime sin reemplazo.
 */
export const branding: BrandingConfig = {
  platformDisplayName: 'Eloisa',
  platformTagline: 'ATENCIÓN DOMICILIARIA',
  aiDisplayName: 'Isa',
};

/**
 * Compone frases donde el nombre de la plataforma forma parte del texto.
 * Mantener la composición aquí evita romper gramática, acentos ni el nombre
 * accesible al sustituir la marca (FR-16).
 *
 * El wordmark y la forma en frase coinciden en la marca definitiva, pero la
 * función se conserva para que un futuro nombre en versalitas siga
 * produciendo una forma capitalizada correcta dentro de una oración.
 */
export function platformNameInSentence(config: BrandingConfig = branding): string {
  const [first = '', ...rest] = [...config.platformDisplayName];
  return first + rest.join('').toLocaleLowerCase('es-CO');
}
