import { type Request } from 'express';

/**
 * Principal HUMANO (IDENTITY-RELATIONSHIPS-CORE-01 §7.1).
 *
 * Describe a la persona autenticada y NADA más. Sus cuatro campos los resuelve
 * EXCLUSIVAMENTE el validador de `HumanSession` a partir del token opaco de la
 * cookie: ni el navegador, ni un controlador, ni un cuerpo, ni una cadena de
 * consulta, ni una cabecera aportan jamás ninguno.
 *
 * LO QUE NO LLEVA, deliberadamente:
 * - ni rol, ni permisos, ni contextos: tener una participación no es tener
 *   acceso, y cada operación vuelve a evaluar perfil, afiliación, asignación y
 *   relación contra la base;
 * - ni `patientId`, ni `professionalId`: esos los DERIVA el servidor desde
 *   `personId`, de modo que nadie pueda pedir el paciente de otra persona
 *   enviando su identificador;
 * - ni nombre, ni documento, ni contacto, ni `subject` OIDC.
 */
export interface HumanPrincipal {
  readonly sessionId: string;
  readonly humanAccountId: string;
  readonly personId: string;
  readonly tenantId: string;
  /** Exact external binding that authenticated this session; absent on historical sessions. */
  readonly externalAuthIdentityId?: string;
}

/**
 * Clave bajo la que el guard adjunta el principal a la petición.
 *
 * Es un `Symbol` a propósito: un cliente no puede inyectarla por JSON, por
 * cadena de consulta ni por cabecera, porque ninguna de esas vías produce una
 * propiedad con clave simbólica. Con una clave de texto, un cuerpo con el
 * nombre adecuado podría llegar a colisionar con ella.
 */
export const HUMAN_PRINCIPAL_KEY: unique symbol = Symbol('merdn.humanPrincipal');

/** Petición que puede llevar un principal humano ya resuelto por el guard. */
export type RequestWithHumanPrincipal = Request & {
  [HUMAN_PRINCIPAL_KEY]?: HumanPrincipal;
};

/**
 * Recupera el principal adjuntado por el guard.
 *
 * Devuelve `null` cuando no hay ninguno. NUNCA construye uno: solo el validador
 * de sesión puede crearlo, y esa es la garantía que impide que un controlador
 * fabrique una identidad.
 */
export function humanPrincipalOf(
  request: RequestWithHumanPrincipal,
): HumanPrincipal | null {
  return request[HUMAN_PRINCIPAL_KEY] ?? null;
}
