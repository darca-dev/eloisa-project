/**
 * Recorrido de presentación local de las experiencias humanas.
 *
 * Es una configuración del servidor, cerrada por defecto. No se lee en el
 * navegador ni puede activarse con parámetros de URL, almacenamiento local o
 * una credencial. Al apagarse, las rutas vuelven a sus puertas OIDC normales.
 */
export function humanAccessDemoLocalEnabled(): boolean {
  return process.env.MERDN_HUMAN_ACCESS_DEMO_LOCAL === 'true';
}
