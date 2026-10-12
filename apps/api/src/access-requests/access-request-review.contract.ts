/**
 * Contrato de la revisión hospitalaria de solicitudes de acceso
 * (SPEC 038; MP03-C1, ampliado por MP04; capacidad `HOSPITAL_ACCESS_REVIEWER`).
 *
 * QUÉ ES ESTE ARCHIVO: la lista CERRADA de lo que la superficie Hospital puede
 * pedir y devolver, y la correspondencia cerrada entre la acción pedida, el
 * estado destino y el motivo aceptado. No contiene tipos Prisma, ni consultas,
 * ni autorización, ni los motivos en texto libre.
 *
 * QUÉ NO ES —y no debe crecer sin un paquete aprobado—:
 * - NO es el catálogo de estados completo de `AccessRequest`. Aquí se nombran
 *   los estados ORIGEN que cada acción exige, el estado que su PRIMERA
 *   transacción escribe y los estados en los que la acción queda concluida.
 *   MP04 añade `APPROVED`, `SUSPENDED` y `REVOKED` como destinos alcanzables
 *   desde este catálogo.
 * - NO concede acceso por sí mismo. Aprobar deja la solicitud en
 *   `APPROVED_PENDING_PROVISIONING`; `APPROVED` lo escribe la saga de provisión
 *   (MP04) SÓLO cuando la cuenta, el vínculo OIDC y la participación mínima
 *   están confirmados. Este paquete no crea perfil, vínculo, sesión ni
 *   asignación.
 * - NO acepta texto libre. El motivo es un CÓDIGO de un catálogo cerrado: un
 *   texto libre permitiría razonar sobre la vida de una persona y acabaría
 *   copiado en pantallas, exportaciones y errores.
 */

/* -------------------------------------------------------------------------- */
/* Filtros de lectura                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Estados por los que se puede FILTRAR el backlog.
 *
 * Lista CERRADA y deliberadamente corta: los cuatro estados terminalES
 * (`REJECTED`, `SUSPENDED`, `REVOKED`) y el de provisión fallida
 * (`PROVISIONING_FAILED`) no son backlog pendiente, y `APPROVED` tampoco: una
 * solicitud ya aprovisionada no está esperando decisión de nadie. Filtrar por
 * cualquiera de ellos devolvería un histórico vacío de trabajo.
 *
 * Aceptarlos NO cambiaría el resultado —la consulta devolvería cero filas— pero
 * rechazarlos con `400` hace imposible que un cliente concluding que existe un
 * hueco en la cobertura del catálogo.
 */
export const ACCESS_REQUEST_REVIEW_FILTER_STATUSES = ['PENDING'] as const;

export type AccessRequestReviewFilterStatus =
  (typeof ACCESS_REQUEST_REVIEW_FILTER_STATUSES)[number];

/** Perfiles por los que se puede filtrar. Catálogo CERRADO, sin valores nuevos. */
export const ACCESS_REQUEST_REVIEW_FILTER_PROFILES = [
  'PATIENT',
  'CAREGIVER',
  'FIELD_PROFESSIONAL',
] as const;

export type AccessRequestReviewFilterProfile =
  (typeof ACCESS_REQUEST_REVIEW_FILTER_PROFILES)[number];

/** Tamaño de página por defecto del listado. */
export const ACCESS_REQUEST_REVIEW_DEFAULT_LIMIT = 20;

/** Tamaño de página máximo. Acota el trabajo del servidor y la respuesta. */
export const ACCESS_REQUEST_REVIEW_MAX_LIMIT = 50;

/** Tamaño de página mínimo. Un límite de 0 no devuelve nada y no es un listado. */
export const ACCESS_REQUEST_REVIEW_MIN_LIMIT = 1;

/**
 * Longitud máxima del término de búsqueda.
 *
 * Un término más largo no es una búsqueda: es un intento de convertir el
 * endpoint en un oráculo de comparación de cadenas. Se acota en el SERVIDOR y no
 * solo en el cliente.
 */
export const ACCESS_REQUEST_REVIEW_MAX_QUERY_LENGTH = 80;

/** Forma admitida del identificador de solicitud en la ruta. */
export const ACCESS_REQUEST_REQUEST_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

/** Forma admitida del cursor opaco emitido por el listado. */
export const ACCESS_REQUEST_REVIEW_CURSOR_PATTERN = /^[A-Za-z0-9_-]{1,256}$/u;

/* -------------------------------------------------------------------------- */
/* Decisión                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Acciones admitidas. Catálogo CERRADO.
 *
 * MP04 amplía el par `APPROVE`/`REJECT` con las cuatro acciones de ciclo de
 * vida de la cuenta. No existe ninguna otra: no hay «aprobar y volver», no hay
 * «suspender temporalmente sin motivo» y no hay «reabrir una solicitud
 * rechazada». `REJECTED` y `REVOKED` son TERMINALES y ninguna acción de este
 * catálogo los toca.
 */
export const ACCESS_REQUEST_REVIEW_ACTIONS = [
  'APPROVE',
  'REJECT',
  'RETRY_PROVISIONING',
  'SUSPEND',
  'REACTIVATE',
  'REVOKE',
] as const;

export type AccessRequestReviewAction = (typeof ACCESS_REQUEST_REVIEW_ACTIONS)[number];

/**
 * Catálogo CERRADO de motivos de decisión.
 *
 * Cada acción exige EXACTAMENTE el motivo de su fila en `ACCESS_REQUEST_DECISION`:
 * un `APPROVE` con el motivo del rechazo se rechaza, no se «corrige». Los cuatro
 * motivos nuevos nombran la ACCIÓN, no a la persona ni a un juicio sobre ella:
 * un motivo describiendo la vida de alguien acabaría copiado en pantallas,
 * exportaciones y errores.
 */
export const ACCESS_REQUEST_DECISION_REASON_CODES = [
  'ACCESS_APPROVED',
  'ACCESS_REJECTED',
  'PROVISIONING_RETRIED',
  'ACCESS_SUSPENDED',
  'ACCESS_REACTIVATED',
  'ACCESS_REVOKED',
] as const;

export type AccessRequestDecisionReasonCode =
  (typeof ACCESS_REQUEST_DECISION_REASON_CODES)[number];

/**
 * Acciones que ejecutan la SAGA de provisión.
 *
 * Para estas, la transacción 1 solo deja la solicitud en
 * `APPROVED_PENDING_PROVISIONING`: `APPROVED` lo escribe —o no— la saga, en una
 * transacción DISTINTA de la llamada externa. Afirmar `APPROVED` en la transacción
 * 1 sería mentir mientras el proveedor todavía no ha respondido.
 */
export const ACCESS_REQUEST_SAGA_ACTIONS = ['APPROVE', 'RETRY_PROVISIONING', 'REACTIVATE'] as const;

/** Acción que ejecuta la saga. */
export type AccessRequestSagaAction = (typeof ACCESS_REQUEST_SAGA_ACTIONS)[number];

/** Estados desde los que cada acción puede aplicarse. Catálogo CERRADO. */
export type AccessRequestDecisionSourceStatus =
  | 'PENDING'
  | 'PROVISIONING_FAILED'
  | 'APPROVED'
  | 'SUSPENDED';

/**
 * Estados que la PRIMERA transacción de una acción puede escribir.
 *
 * Es el origen MÁS `APPROVED_PENDING_PROVISIONING`, que es el estado de
 * espera que abren las tres acciones de saga y que ninguna acción puede usarse
 * como origen: quien pide `APPROVE` sobre una solicitud que ya espera provisión
 * está repitiendo una decisión que otra transacción ya abrió, y eso es un
 * conflicto, no una segunda aprobación.
 */
export type AccessRequestDecisionTargetStatus =
  | AccessRequestDecisionSourceStatus
  | 'APPROVED_PENDING_PROVISIONING'
  | 'REJECTED'
  | 'SUSPENDED'
  | 'REVOKED';

/**
 * Estados en los que cada acción queda CONCLUIDA, para detectar repeticiones.
 *
 * Una acción de SAGA concluye en DOS filas posibles: `APPROVED`, si el
 * proveedor confirmó, y `PROVISIONING_FAILED`, si no. Ninguna de las dos es un
 * error: son los dos desenlaces legítimos de la misma decisión, y el cliente
 * que la perdió debe poder reconocer ambos.
 */
export type AccessRequestDecisionSettledStatus =
  | 'APPROVED'
  | 'PROVISIONING_FAILED'
  | 'REJECTED'
  | 'SUSPENDED'
  | 'REVOKED';

/**
 * Transiciones y motivo por acción. Correspondencia CERRADA.
 *
 * Es un `Record` COMPLETO del tipo de acción: añadir una acción al catálogo de
 * arriba sin su transición y su motivo NO compila, y no hay ninguna rama por
 * defecto que pudiera aprobar una solicitud con el motivo del rechazo o dejar
 * una acción sin escribir estado.
 *
 * El motivo NO es independiente de la acción. Aprobar y suspender son actos
 * distintos con justificación distinta, y aceptar cualquier par dejaría que una
 * decisión pudiera llevar a la vez la etiqueta de elegible y el efecto de una
 * suspensión.
 *
 * `targetStatus` es el estado que escribe la PRIMERA transacción, no el final:
 * en la saga el estado final lo decide el proveedor y no puede fijarse aquí.
 * `settledStatuses` es lo que la fila puede mostrar DESPUÉS de la acción, y es
 * lo que una repetición exacta debe encontrar para devolverse a sí misma en vez
 * de responder `409` a un cliente que perdió la respuesta.
 */
export const ACCESS_REQUEST_DECISION: Record<
  AccessRequestReviewAction,
  {
    readonly sourceStatuses: readonly AccessRequestDecisionSourceStatus[];
    readonly targetStatus: AccessRequestDecisionTargetStatus;
    readonly settledStatuses: readonly AccessRequestDecisionSettledStatus[];
    readonly reasonCode: AccessRequestDecisionReasonCode;
    readonly eventType:
      | 'ACCESS_REQUEST_APPROVED'
      | 'ACCESS_REQUEST_REJECTED'
      | 'ACCESS_REQUEST_SUSPENDED'
      | 'ACCESS_REQUEST_REVOKED'
      | 'ACCESS_REQUEST_REACTIVATED'
      | null;
    /** `true` cuando la acción delega el estado final en la saga de provisión. */
    readonly runsSaga: boolean;
    /** `true` cuando la acción no admite ninguna transición posterior. */
    readonly terminal: boolean;
  }
> = {
  APPROVE: {
    sourceStatuses: ['PENDING'],
    targetStatus: 'APPROVED_PENDING_PROVISIONING',
    settledStatuses: ['APPROVED', 'PROVISIONING_FAILED'],
    reasonCode: 'ACCESS_APPROVED',
    eventType: 'ACCESS_REQUEST_APPROVED',
    runsSaga: true,
    terminal: false,
  },
  REJECT: {
    sourceStatuses: ['PENDING', 'PROVISIONING_FAILED'],
    targetStatus: 'REJECTED',
    settledStatuses: ['REJECTED'],
    reasonCode: 'ACCESS_REJECTED',
    eventType: 'ACCESS_REQUEST_REJECTED',
    runsSaga: false,
    terminal: true,
  },
  RETRY_PROVISIONING: {
    sourceStatuses: ['PROVISIONING_FAILED'],
    targetStatus: 'APPROVED_PENDING_PROVISIONING',
    settledStatuses: ['APPROVED', 'PROVISIONING_FAILED'],
    reasonCode: 'PROVISIONING_RETRIED',
    /* La traza del reintento son los `ACCESS_PROVISIONING_*` de la saga. */
    eventType: null,
    runsSaga: true,
    terminal: false,
  },
  SUSPEND: {
    sourceStatuses: ['APPROVED'],
    targetStatus: 'SUSPENDED',
    settledStatuses: ['SUSPENDED'],
    reasonCode: 'ACCESS_SUSPENDED',
    eventType: 'ACCESS_REQUEST_SUSPENDED',
    runsSaga: false,
    terminal: false,
  },
  REACTIVATE: {
    sourceStatuses: ['SUSPENDED'],
    targetStatus: 'APPROVED_PENDING_PROVISIONING',
    settledStatuses: ['APPROVED', 'PROVISIONING_FAILED'],
    reasonCode: 'ACCESS_REACTIVATED',
    eventType: 'ACCESS_REQUEST_REACTIVATED',
    runsSaga: true,
    terminal: false,
  },
  REVOKE: {
    sourceStatuses: ['APPROVED', 'SUSPENDED'],
    targetStatus: 'REVOKED',
    settledStatuses: ['REVOKED'],
    reasonCode: 'ACCESS_REVOKED',
    eventType: 'ACCESS_REQUEST_REVOKED',
    runsSaga: false,
    terminal: true,
  },
};

/**
 * Acciones que, además de la transición, desactivan la CUENTA humana.
 *
 * Suspender y revocar son las únicas. Rechazar NO toca ninguna cuenta —una
 * solicitud rechazada nunca llegó a tener una— y aprobar justamente la activa.
 */
export const ACCESS_REQUEST_DEACTIVATING_ACTIONS = ['SUSPEND', 'REVOKE'] as const;

/** Acción que desactiva cuenta. */
export type AccessRequestDeactivatingAction = (typeof ACCESS_REQUEST_DEACTIVATING_ACTIONS)[number];

/**
 * ¿Es esta acción de las que además desactivan la cuenta?
 *
 * Se declara como PREDICADO con narrowing y no como una comprobación suelta en
 * el servicio: así, el tipo de la acción queda estrechado a `SUSPEND | REVOKE`
 * dentro de la rama y cualquier uso posterior de `action === 'REVOKE'` compila
 * contra un catálogo, no contra una comparación que alguien puede cambiar.
 */
export function isDeactivatingAction(
  action: AccessRequestReviewAction,
): action is AccessRequestDeactivatingAction {
  return (ACCESS_REQUEST_DEACTIVATING_ACTIONS as readonly AccessRequestReviewAction[]).includes(
    action,
  );
}

/* -------------------------------------------------------------------------- */
/* Códigos de error                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Códigos de error de la superficie de revisión.
 *
 * Son estables, cerrados y deliberadamente pobres en información. En particular
 * `notFound` NO distingue entre un identificador inexistente y uno que pertenece
 * a otro tenant: esa diferencia sería un oráculo de existencia.
 */
export const ACCESS_REQUEST_REVIEW_ERROR_CODES = {
  /** Filtros o cuerpo de decisión ausentes, mal formados o fuera de catálogo. */
  invalidRequest: 'ACCESS_REQUEST_REVIEW_INVALID_REQUEST',
  /** No hay sesión institucional vigente. */
  sessionRequired: 'INSTITUTIONAL_SESSION_REQUIRED',
  /** La identidad autenticada no es `HOSPITAL_ACCESS_REVIEWER`, u origen ajeno. */
  forbidden: 'ACCESS_REQUEST_REVIEW_FORBIDDEN',
  /** Origen no permitido en la decisión. */
  originRejected: 'INSTITUTIONAL_ORIGIN_REJECTED',
  /** Identificador inexistente o ajeno al tenant. Idéntico en ambos casos. */
  notFound: 'ACCESS_REQUEST_REVIEW_NOT_FOUND',
  /** Estado ya no transicionable o versión vencida. */
  conflict: 'ACCESS_REQUEST_REVIEW_CONFLICT',
  /** El contexto de ejecución seguro no pudo confirmarse. */
  unavailable: 'ACCESS_REQUEST_REVIEW_UNAVAILABLE',
} as const;

/* -------------------------------------------------------------------------- */
/* Proyecciones de salida                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Item del listado.
 *
 * Contiene lo mínimo para IDENTIFICAR y ORDENAR una solicitud en la bandeja: su
 * identificador opaco, su referencia, el perfil, el estado, la versión de
 * concurrencia, la fecha de envío y los nombres de la persona solicitante.
 *
 * NO contiene: `tenantId`, `personId`, documento, fecha de nacimiento, sexo,
 * teléfono, correo, estado de provisión, revisor, ni nada de auditoría. El
 * listado NO es el detalle: quien necesita el documento abre el detalle, y esa
 * apertura queda auditada como tal.
 */
export interface AccessRequestReviewListItem {
  readonly requestId: string;
  readonly reference: string;
  readonly requestedProfile: string;
  readonly status: string;
  readonly version: number;
  readonly submittedAt: string;
  readonly givenNames: string;
  readonly familyNames: string;
}

/** Página del listado, con su cursor siguiente. */
export interface AccessRequestReviewListDto {
  readonly items: readonly AccessRequestReviewListItem[];
  /** `null` cuando no hay más páginas: ausencia de cursor, no cadena vacía. */
  readonly nextCursor: string | null;
}

/**
 * Detalle de UNA solicitud.
 *
 * Es la proyección de los campos del listado MÁS los que solo hacen falta para
 * revisar: tipo y número de documento, fecha de nacimiento, sexo-género,
 * contacto, estado de provisión y los datos de la decisión ya tomada.
 *
 * NO devuelve identificadores internos relacionados —`tenantId`, `personId`,
 * `reviewedByInstitutionalIdentityId`—, ni secretos, ni issuer, ni `subject`
 * OIDC, ni username, ni contraseña, ni token, ni datos de otro tenant.
 * `decisionReasonCode` y `provisioningErrorCode` son CÓDIGOS cerrados, no el
 * texto de un motivo ni un cuerpo del proveedor.
 *
 * `provisioningAttempts` y `provisioningErrorCode` existen desde MP04 para que
 * la bandeja pueda ofrecer SÓLO las acciones todavía disponibles: sin el
 * contador, un `RETRY_PROVISIONING` agotado se ofrecería igual que uno utilizable.
 */
export interface AccessRequestReviewDetailDto extends AccessRequestReviewListItem {
  readonly documentType: string;
  readonly documentNumber: string;
  /** Fecha sin componente horario: `YYYY-MM-DD`. */
  readonly birthDate: string;
  readonly sexGenderCode: string;
  readonly phone: string | null;
  readonly email: string | null;
  readonly provisioningStatus: string;
  /** Intentos de provisión ya ejecutados. Cero si nunca se intentó. */
  readonly provisioningAttempts: number;
  /** Código CERRADO del último fallo, o `null` sin fallo. */
  readonly provisioningErrorCode: string | null;
  /** `null` mientras la solicitud no tenga decisión. */
  readonly decidedAt: string | null;
  /** `null` mientras la solicitud no tenga decisión. */
  readonly decisionReasonCode: string | null;
  /**
   * Versión del esquema del expediente ficticio. `null` en solicitudes sin
   * expediente. Solo el detalle protegido la devuelve; el listado no.
   */
  readonly registrationSchemaVersion: number | null;
  /**
   * Expediente ficticio declarado. Solo el detalle protegido lo devuelve, por
   * secciones en la bandeja y nunca como JSON crudo. Son declaraciones, no
   * diagnósticos validados. `null` sin expediente.
   */
  readonly registration: Record<string, unknown> | null;
}

/** Respuesta de una decisión aplicada. Devuelve el estado vigente resultante. */
export interface AccessRequestReviewDecisionDto {
  readonly requestId: string;
  readonly reference: string;
  readonly status: string;
  /** Versión ya incrementada. El cliente la reenvía como `expectedVersion`. */
  readonly version: number;
  readonly decisionReasonCode: string;
  readonly decidedAt: string;
}
