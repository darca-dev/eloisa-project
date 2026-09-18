/**
 * Comprobación de origen de la única mutación con cookie
 * (TASK-HOSPITAL-CORE-02 §6.3).
 *
 * POR QUÉ EXISTE: la sesión institucional viaja en una cookie `HttpOnly`, y el
 * navegador la adjunta a las peticiones que salen de una página cualquiera. Sin
 * una comprobación de origen, una página ajena podría provocar una asignación
 * en nombre de una persona que solo tenía la sesión abierta.
 *
 * PATRÓN REUTILIZADO, NO INVENTADO: se valida contra `API_WEB_ORIGINS`, la
 * MISMA lista de orígenes web que la configuración ya declara y valida al
 * arrancar, y que CORS usa para admitir peticiones con credenciales. No se
 * introduce una lista nueva, un secreto nuevo, un token nuevo ni una cabecera
 * propietaria: el origen autorizado sigue siendo uno solo y sigue viviendo en
 * configuración del servidor.
 *
 * DENEGACIÓN POR DEFECTO: una petición sin `Origin` NI `Referer` se rechaza.
 * Aceptarla dejaría abierta exactamente la vía que esta comprobación cierra,
 * porque los clientes que no envían origen son también los que no están sujetos
 * a la política del navegador.
 *
 * LO QUE ESTA COMPROBACIÓN NO ES: no es autenticación, no es autorización y no
 * sustituye al guard de rol ni a Row Level Security. Es una barrera adicional
 * sobre una mutación con cookie, y las tres siguen siendo obligatorias.
 */

/** Origen de la petición, o `null` cuando no se pudo determinar. */
function requestOrigin(headers: {
  readonly origin?: unknown;
  readonly referer?: unknown;
}): string | null {
  const bruto = headers.origin ?? headers.referer;

  if (typeof bruto !== 'string' || bruto.trim().length === 0) {
    return null;
  }

  const valor = bruto.trim();

  // `Origin: null` es exactamente lo que envía un contexto opaco —un `iframe`
  // con `sandbox`, un documento `data:`—. No es un origen autorizado.
  if (valor === 'null') {
    return null;
  }

  try {
    return new URL(valor).origin;
  } catch {
    return null;
  }
}

/**
 * `true` cuando la petición procede de un origen web autorizado.
 *
 * La comparación es por ORIGEN completo —esquema, host y puerto—, nunca por
 * sufijo: comparar por sufijo admitiría `merdn.example.attacker.test`.
 */
export function isAllowedWebOrigin(
  headers: { readonly origin?: unknown; readonly referer?: unknown },
  allowedOrigins: readonly string[],
): boolean {
  const origen = requestOrigin(headers);

  if (origen === null) {
    return false;
  }

  return allowedOrigins.some((permitido) => permitido === origen);
}
