/**
 * El contexto de ejecución seguro no pudo establecerse
 * (corrección final de CORE-01, bloqueante 1).
 *
 * Se lanza cuando la API opera en modo `enforce` y NO puede confirmar que la
 * transacción se está ejecutando bajo el rol `merdn_runtime` con el tenant
 * activo fijado.
 *
 * Su efecto es FAIL-CLOSED: aborta la transacción antes de ejecutar cualquier
 * consulta de negocio. Nunca se degrada a continuar con privilegios superiores,
 * porque hacerlo dejaría los datos de todas las instituciones al alcance de una
 * consulta sin Row Level Security.
 *
 * El mensaje es técnico y no contiene datos personales, identificadores de
 * paciente ni fragmentos de la cadena de conexión: se registra en el servidor y
 * jamás se devuelve al cliente.
 */
export class RuntimeContextUnavailableError extends Error {
  constructor(reason: string) {
    super(
      `No se pudo establecer el contexto de ejecución seguro: ${reason}. ` +
        'La operación se abortó sin ejecutar ninguna consulta de negocio.',
    );
    this.name = 'RuntimeContextUnavailableError';
  }
}
