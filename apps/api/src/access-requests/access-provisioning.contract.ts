/**
 * Contrato cerrado de la provisión de cuentas (SPEC 038, paquete MP04).
 *
 * QUÉ ES ESTE ARCHIVO: la lista CERRADA de lo que la capa de provisión declara
 * —códigos de diagnóstico, límites, catálogos y tipos— sin importar Prisma, sin
 * leer configuración y sin ejecutar efectos. Es la frontera normativa de MP04,
 * del mismo modo que `access-request.contract.ts` lo es del registro público.
 *
 * QUÉ NO ES —y no debe crecer sin un paquete aprobado—:
 * - NO contiene la contraseña: la contraseña NO es parte de este contrato
 *   porque la contraseña no vive en ningún estado persistido. Se valida en
 *   `access-request.validation.ts`, viaja UNA vez hacia el proveedor y desaparece.
 * - NO declara transiciones de `AccessRequest`: esas viven en
 *   `access-request-review.contract.ts`, que es quien gobierna la máquina de
 *   estados de la bandeja hospitalaria.
 * - NO declara emisor, `subject`, username ni ningún valor que se haya de
 *   persistir: esos pertenecen al servicio, no al contrato.
 *
 * LOS CÓDIGOS SON DIAGNÓSTICO, NO MENSAJE. Un código nombra una CAUSA
 * operacional para que un revisor sepa qué reintentar; nunca se deriva de un
 * cuerpo, de una respuesta o de un texto del proveedor, y por eso su catálogo
 * no puede crecer con lo que el proveedor decida responder mañana.
 */

/* -------------------------------------------------------------------------- */
/* Diagnóstico cerrado                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Códigos de diagnóstico de provisión.
 *
 * Se persisten en `AccessRequest.provisioningErrorCode`, cuyo CHECK admite de 1
 * a 64 caracteres: cada valor de este catálogo cumple ese límite. No son códigos
 * de error HTTP ni sustituyen a los de `ACCESS_REQUEST_REVIEW_ERROR_CODES`: un
 * `409` de la bandeja SIGNIFICA que la acción no se aplicó, y este código
 * explica POR QUÉ la provisión quedó como quedó.
 *
 * NINGÚN valor contiene un host, un realm, un identificador, un estado HTTP ni
 * texto del proveedor. Tres códigos distintos describen fallos de red, de
 * autorización y de configuración sin nombrar cuál de los tres hostiles pudo
 * observar.
 */
export const ACCESS_PROVISIONING_ERROR_CODES = {
  /** La configuración administrativa OIDC está ausente o no es utilizable. */
  notConfigured: 'ACCESS_PROVISIONING_NOT_CONFIGURED',
  /** El token administrativo no pudo obtenerse o fue rechazado. */
  unauthorized: 'ACCESS_PROVISIONING_UNAUTHORIZED',
  /** Red, tiempo de espera o respuesta inesperada del proveedor. */
  unavailable: 'ACCESS_PROVISIONING_UNAVAILABLE',
  /** La identidad esperada no existe en el proveedor. */
  identityNotFound: 'ACCESS_PROVISIONING_IDENTITY_NOT_FOUND',
  /** El username existe pero no corresponde a ESTA solicitud. */
  identityCollision: 'ACCESS_PROVISIONING_IDENTITY_COLLISION',
  /** Fallo al escribir la participación mínima dentro de la transacción. */
  participationFailed: 'ACCESS_PROVISIONING_PARTICIPATION_FAILED',
  /** La cuenta no puede activarse sin una contraseña que nunca se guarda. */
  passwordUnavailable: 'ACCESS_PROVISIONING_PASSWORD_UNAVAILABLE',
  /** Se agotó el límite de intentos de provisión de esta solicitud. */
  retryLimitReached: 'ACCESS_PROVISIONING_RETRY_LIMIT',
} as const;

export type AccessProvisioningErrorCode =
  (typeof ACCESS_PROVISIONING_ERROR_CODES)[keyof typeof ACCESS_PROVISIONING_ERROR_CODES];

/* -------------------------------------------------------------------------- */
/* Límites                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Intentos totales de provisión de UNA solicitud.
 *
 * El límite es del CONTADOR persistido —`provisioningAttempts`— y no de la
 * llamada HTTP: cada saga lo incrementa antes de tocar el proveedor. Cinco
 * intentos cubren dos caídas de red, un colapso momentáneo del proveedor y un
 * reintento humano, y a partir de ahí seguir insistiendo convierte una indisponibilidad
 * en carga sostenida sobre el proveedor sin ninguna expectativa razonable de
 * éxito. Un agotado deja `PROVISIONING_FAILED` con
 * `ACCESS_PROVISIONING_RETRY_LIMIT` y no vuelve a transitar.
 */
export const ACCESS_PROVISIONING_MAX_ATTEMPTS = 5;

/**
 * Intentos TOTALES de UNA operación contra el proveedor.
 *
 * `1` inicial + `1` reintento. No hay recursión y no hay bucle abierto: una
 * segunda iteración solo ocurre si la primera falló por red o por un `5xx`, y
 * ambas condiciones se comprueban antes de dormir. Un `4xx` nunca se reintenta:
 * repetir una petición que el proveedor rechazó por su forma solo produce el
 * mismo rechazo con el doble de tráfico.
 */
export const ACCESS_PROVISIONING_REQUEST_MAX_ATTEMPTS = 2;

/** Tiempo máximo de UNA petición al proveedor, en milisegundos. */
export const ACCESS_PROVISIONING_REQUEST_TIMEOUT_MS = 5_000;

/** Espera base entre intentos, en milisegundos. El servicio la hace crecer. */
export const ACCESS_PROVISIONING_RETRY_BASE_BACKOFF_MS = 250;

/**
 * Máximo de filas que la búsqueda exacta de usuario está dispuesta a leer.
 *
 * Dos. Uno es el usuario esperado; el segundo existe SOLO para poder afirmar que
 * la búsqueda devolvió un ÚNICO usuario y no para enumerar coincidencias. Con
 * `max=1` una colisión real sería indistinguible de un éxito, y esa ambigüedad
 * es exactamente lo que el límite de idempotencia está diseñado para cerrar.
 */
export const ACCESS_PROVISIONING_USERNAME_SEARCH_MAX = 2;

/* -------------------------------------------------------------------------- */
/* Catálogos opacos                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Forma EXACTA del username enviado al proveedor.
 *
 * Es la referencia `AR-...` de la solicitud, sin transformación. La decisión
 * del paquete es que la referencia ES el identificador con el que la persona se
 * autenticará, de modo que derivar un username distinto —con prefijo, con
 * minúsculas, con separador propio— crearía dos identificadores que alguien
 * tendría que reconciliar. Un username que no cumpla esta forma se rechaza ANTES
 * de salir: un valor inesperado jamás viaja al proveedor.
 */
export const ACCESS_PROVISIONING_USERNAME_PATTERN = /^AR-[0-9A-F]{24}$/u;

/**
 * Atributo del usuario del proveedor que actúa como marcador de idempotencia.
 *
 * Es la ÚNICA pieza de información adicional que este paquete escribe en el
 * proveedor, y su valor es el identificador INTERNO de la solicitud: opaco, sin
 * persona, sin documento y sin tenant. Existe porque un `409` de creación solo
 * puede tratarse como idempotente si la búsqueda exacta devuelve UN usuario y
 * ese usuario declara el marcador de ESTA solicitud; sin él, un username
 * preexistente de origen desconocido pasaría por una repetición legítima.
 */
export const ACCESS_PROVISIONING_MARKER_ATTRIBUTE = 'merdnAccessRequest';

/**
 * Máximo de longitud admitido para el marcador.
 *
 * El identificador de la solicitud es un UUID de 36 caracteres. El límite existe
 * para que una ampliación futura del marcador no pueda rechazarse dentro del
 * proveedor con un error que este paquete no sabría clasificar.
 */
export const ACCESS_PROVISIONING_MARKER_MAX_LENGTH = 64;

/* -------------------------------------------------------------------------- */
/* Tipos de paso                                                               */
/* -------------------------------------------------------------------------- */

/** Identidad local ya preparada, lista para vincularse. */
export interface AccessProvisioningPreparedIdentity {
  /** `sub` REAL emitido por el proveedor. Se persiste solo en el vínculo. */
  readonly subject: string;
}

/** Resultado de la fase EXTERNA de la saga: el proveedor respondió. */
export type AccessProvisioningExternalResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: AccessProvisioningErrorCode };

/** Desenlace COMPLETO de una ejecución de la saga. */
export type AccessProvisioningOutcome =
  | { readonly ok: true; readonly status: 'APPROVED' }
  | {
      readonly ok: false;
      readonly status: 'PROVISIONING_FAILED';
      readonly code: AccessProvisioningErrorCode;
    };
