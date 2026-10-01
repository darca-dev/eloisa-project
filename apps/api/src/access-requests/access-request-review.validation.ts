/**
 * Validación de la entrada de la revisión hospitalaria
 * (SPEC 038, MP03-C1, ampliado por MP04).
 *
 * QUÉ HACE: acota y valida EN EL SERVIDOR lo que la superficie de revisión
 * acepta —los filtros del listado, el identificador de la ruta y el cuerpo de la
 * decisión, incluidas las seis acciones de MP04— antes de que nada llegue a la
 * base de datos.
 *
 * POR QUÉ ESTA VALIDACIÓN NO ES DEFENSIVA: es la frontera. La OpenAPI describe
 * el contrato, pero un cliente HTTP no es la OpenAPI: cualquiera puede llamar a
 * la ruta directamente con un `limit` enorme, un `status` inventado, un `cursor`
 * alterado o un cuerpo con texto libre en el motivo. Sin esta capa, un cliente
 * hostil —no un error de programación— elegiría el tamaño de la respuesta, el
 * catálogo de estados o la transición aplicada.
 *
 * QUÉ NO HACE: NO consulta la base de datos, NO resuelve tenant y NO autoriza.
 * El tenant, la identidad y el rol los resuelve el guard a partir de la sesión,
 * y esta validación nunca acepta un tenant del cliente ni lo compara con ninguno.
 */

import {
  ACCESS_REQUEST_DECISION,
  ACCESS_REQUEST_DECISION_REASON_CODES,
  ACCESS_REQUEST_REVIEW_ACTIONS,
  ACCESS_REQUEST_REVIEW_CURSOR_PATTERN,
  ACCESS_REQUEST_REVIEW_DEFAULT_LIMIT,
  ACCESS_REQUEST_REVIEW_FILTER_PROFILES,
  ACCESS_REQUEST_REVIEW_FILTER_STATUSES,
  ACCESS_REQUEST_REVIEW_MAX_LIMIT,
  ACCESS_REQUEST_REVIEW_MAX_QUERY_LENGTH,
  ACCESS_REQUEST_REVIEW_MIN_LIMIT,
  ACCESS_REQUEST_REQUEST_ID_PATTERN,
  type AccessRequestDecisionReasonCode,
  type AccessRequestReviewAction,
  type AccessRequestReviewFilterProfile,
  type AccessRequestReviewFilterStatus,
} from './access-request-review.contract';

/** Filtros ya validados del listado. */
export interface ValidatedAccessRequestReviewQuery {
  readonly status?: AccessRequestReviewFilterStatus;
  readonly profile?: AccessRequestReviewFilterProfile;
  /** Término de búsqueda YA recortado y acotado en longitud. */
  readonly q?: string;
  /**
   * Variante DOCUMENTAL de `q`, derivada en el servidor.
   *
   * Es `q` sin espacios, puntos ni guiones: la forma con la que una persona
   * escribe su documento (`CC 44.556.677`) no es la forma con la que se
   * normaliza para comparar (`44556677`). Existe para que la comparación sea
   * del servidor y no dependa de que el cliente adivine el formato. Se declara
   * aquí y no en el servicio porque es parte de la ENTRADA validada, y porque
   * cualquier otro consumidor de estos filtros hereda la misma derivación.
   *
   * Se Ausenta cuando al quitar los separadores no queda nada utilizable —por
   * ejemplo `---`—, en cuyo caso la búsqueda documental se hace solo con la
   * forma declarada.
   */
  readonly qDocumento?: string;
  readonly limit: number;
  /** Cursor ya validado y decodificado. */
  readonly cursor?: { readonly submittedAt: Date; readonly id: string };
}

export type AccessRequestReviewQueryValidation =
  | { readonly ok: true; readonly value: ValidatedAccessRequestReviewQuery }
  | { readonly ok: false; readonly fields: readonly string[] };

/**
 * Forma admitida de los parámetros de consulta.
 *
 * Es una `Record` ABIERTA a propósito: una clave desconocida no se ignora, se
 * rechaza. Ignorar un parámetro no reconocido haría que un cliente creyera estar
 * filtrando por algo que el servidor no ha aplicado —`?statuss=PENDING` leería
 * el backlog completo y lo presentaría como el filtrado pedido—, y esa
 * discrepancia silenciosa es un defecto de autorización disfrazado de detalle.
 */
function esParametroConocido(clave: string): boolean {
  return (
    clave === 'status' ||
    clave === 'profile' ||
    clave === 'q' ||
    clave === 'limit' ||
    clave === 'cursor'
  );
}

/**
 * Lectura de un parámetro de consulta, distinguiendo tres casos.
 *
 * La distinción importa. Un parámetro AUSENTE toma el valor por defecto o
 * desactiva el filtro; un parámetro declarado pero vacío se trata como ausente,
 * porque `?status=` no es una consulta de estado: es un cliente que construyó la
 * URL sin saber qué quería. Y un parámetro declarado con un valor que no es texto
 * —un array por repetición, un objeto— NO puede tratarse como ausente: ignorarlo
 * haría que el cliente creyera estar limitando o filtrando por algo que el
 * servidor no aplicó. Se rechaza, y se rechaza nombrando el campo.
 */
interface LecturaParametro {
  /** El cliente declaró el parámetro, aunque fuera con un valor vacío. */
  readonly declarado: boolean;
  /** Texto recortado, o `null` si no hay valor utilizable. */
  readonly valor: string | null;
  /** El valor declarado no es texto: array por repetición u objeto anidado. */
  readonly invalido: boolean;
}

function parametro(query: Record<string, unknown>, nombre: string): LecturaParametro {
  if (!Object.prototype.hasOwnProperty.call(query, nombre)) {
    return { declarado: false, valor: null, invalido: false };
  }

  const bruto = query[nombre];

  if (bruto === undefined || bruto === null) {
    return { declarado: true, valor: null, invalido: false };
  }

  /*
   * Un parámetro REPETIDO llega como array. No se toma el primero: aceptar el
   * primero haría que `?limit=20&limit=5000` se ejecutara con el valor que el
   * cliente puso primero y no con el que el proxy o el cliente final cree que
   * manda. Se rechaza y el cliente declara un único valor.
   */
  if (Array.isArray(bruto) || typeof bruto !== 'string') {
    return { declarado: true, valor: null, invalido: true };
  }

  const recortado = bruto.trim();

  return {
    declarado: true,
    valor: recortado.length === 0 ? null : recortado,
    invalido: false,
  };
}

/**
 * Resuelve un parámetro contra un catálogo cerrado.
 *
 * Se separa de la lógica de `status` y `profile` porque los dos comparten la
 * misma estructura y la misma respuesta ante un valor fuera del catálogo: se
 * registra el NOMBRE del campo y no el valor recibido. Repetir esa comparación
 * en dos bloques idénticos solo daría dos lugares donde olvidarse del nombre.
 */
function resolverCatalogo<T extends string>(
  leido: LecturaParametro,
  catalogo: readonly T[],
  campos: string[],
  nombre: string,
): T | undefined {
  if (leido.invalido) {
    campos.push(nombre);
    return undefined;
  }

  if (leido.valor === null || leido.valor === undefined) {
    return undefined;
  }

  if (!catalogo.includes(leido.valor as T)) {
    campos.push(nombre);
    return undefined;
  }

  return leido.valor as T;
}

/**
 * Valida los filtros del listado.
 *
 * Devuelve el NOMBRE del campo inválido, nunca el valor recibido: un motivo de
 * rechazo que repitiera el valor filtrado convertiría un `400` en un canal de
 * reflejo hacia quien lo envía.
 */
export function validateAccessRequestReviewQuery(
  query: unknown,
): AccessRequestReviewQueryValidation {
  if (typeof query !== 'object' || query === null || Array.isArray(query)) {
    return { ok: false, fields: ['query'] };
  }

  const registro = query as Record<string, unknown>;
  const campos: string[] = [];

  for (const clave of Object.keys(registro)) {
    if (!esParametroConocido(clave)) {
      campos.push(clave);
    }
  }

  if (campos.length > 0) {
    return { ok: false, fields: campos.sort() };
  }

  const status = resolverCatalogo(
    parametro(registro, 'status'),
    ACCESS_REQUEST_REVIEW_FILTER_STATUSES,
    campos,
    'status',
  );

  const profile = resolverCatalogo(
    parametro(registro, 'profile'),
    ACCESS_REQUEST_REVIEW_FILTER_PROFILES,
    campos,
    'profile',
  );

  let q: string | undefined;
  let qDocumento: string | undefined;
  const qLeido = parametro(registro, 'q');

  if (qLeido.invalido) {
    campos.push('q');
  } else if (qLeido.valor !== null && qLeido.valor !== undefined) {
    /*
     * La longitud se comprueba ANTES de cualquier normalización. Un término
     * larguísimo se rechaza por su longitud, no porque su forma no coincida con
     * una expresión regular: permitirlo convertiría la búsqueda en un trabajo de
     * CPU proporcional a lo que el cliente quiera enviar.
     */
    if (qLeido.valor.length > ACCESS_REQUEST_REVIEW_MAX_QUERY_LENGTH) {
      campos.push('q');
    } else {
      q = normalizarTermino(qLeido.valor);
      qDocumento = derivarTerminoDocumental(q);
    }
  }

  let limit = ACCESS_REQUEST_REVIEW_DEFAULT_LIMIT;
  const limitLeido = parametro(registro, 'limit');

  if (limitLeido.invalido) {
    campos.push('limit');
  } else if (limitLeido.valor !== null && limitLeido.valor !== undefined) {
    if (!/^\d{1,3}$/u.test(limitLeido.valor)) {
      campos.push('limit');
    } else {
      const parsed = Number.parseInt(limitLeido.valor, 10);

      if (parsed < ACCESS_REQUEST_REVIEW_MIN_LIMIT || parsed > ACCESS_REQUEST_REVIEW_MAX_LIMIT) {
        campos.push('limit');
      } else {
        limit = parsed;
      }
    }
  }

  let cursor: ValidatedAccessRequestReviewQuery['cursor'];
  const cursorLeido = parametro(registro, 'cursor');

  if (cursorLeido.invalido) {
    campos.push('cursor');
  } else if (cursorLeido.valor !== null && cursorLeido.valor !== undefined) {
    const decodificado = decodificarCursor(cursorLeido.valor);

    if (decodificado === null) {
      campos.push('cursor');
    } else {
      cursor = decodificado;
    }
  }

  if (campos.length > 0) {
    return { ok: false, fields: campos.sort() };
  }

  return {
    ok: true,
    value: {
      ...(status === undefined ? {} : { status }),
      ...(profile === undefined ? {} : { profile }),
      ...(q === undefined ? {} : { q }),
      ...(qDocumento === undefined ? {} : { qDocumento }),
      ...(cursor === undefined ? {} : { cursor }),
      limit,
    },
  };
}

/**
 * Deriva la variante DOCUMENTAL de un término de búsqueda.
 *
 * El mismo documento se escribe de varias maneras —`44.556.677`, `44-556-677`,
 * `44556677`— y solo una de ellas es la que se guarda normalizada para comparar.
 * Sin esta derivación, buscar el documento exigiría que el cliente acertara el
 * formato, y la bandeja parecería vacía ante un documento que sí existe: un
 * fallo de búsqueda se dressing de fallo de datos.
 *
 * Se eliminan ESPACIOS, PUNTOS y GUIONES porque son los separadores que el
 * propio servidor descarta al normalizar un documento; con esa misma regla, la
 * comparación del servidor y la del cliente coinciden por construcción en lugar
 * de por convención.
 *
 * NO se eliminan las LETRAS ni se conserva un prefijo de tipo de documento: el
 * término se compara tal cual contra la forma DECLARADA, y la forma NORMALIZADA
 * se consulta con lo que queda. Si tras quitar los separadores no queda nada
 * utilizable —un término formado solo por guiones, por ejemplo— se devuelve
 * `undefined` y la búsqueda documental se resuelve solo con la forma declarada,
 * en vez de buscar una cadena vacía que coincide con todo.
 */
function derivarTerminoDocumental(termino: string): string | undefined {
  const derivado = termino.replace(/[\s.-]/gu, '');

  return derivado.length === 0 ? undefined : derivado;
}

/**
 * Normaliza el término de búsqueda para compararlo.
 *
 * Se recortan los espacios de los extremos y se colapsan los interiores. NO se
 * pasa a minúsculas aquí: la comparación se hace en PostgreSQL con `mode:
 * 'insensitive'`, que usa la colación del servidor y no la del proceso de Node.
 * Dos reglas de casación distintas en dos capas distintas producirían
 * resultados diferentes según dónde se ejecute la comparación.
 */
function normalizarTermino(termino: string): string {
  return termino.replace(/\s+/gu, ' ').trim();
}

/**
 * Cursor opaco de paginación por clave.
 *
 * Codifica el ÚLTIMO par `(submittedAt, id)` de la página anterior, que es
 * exactamente por donde debe continuar la siguiente. `id` no es ordenable por sí
 * solo, así que el desempate por `id` es lo que hace el orden `submittedAt DESC,
 * id DESC` ESTABLE: sin él, dos solicitudes con la misma marca de tiempo podrían
 * aparecer en dos páginas distintas o perderse al reordenar.
 *
 * `submittedAt` se transporta en milisegundos ISO-8601 UTC. Es una FECHA DE
 * SERVIDOR, no un dato de la persona, y no se compara con nada del cliente: solo
 * se usa para reanudar la lectura.
 *
 * El cursor NO es una firma ni un token de sesión: no lleva credencial y no
 * autoriza nada. Aun así se valida su forma y se rechaza un cursor alterado en
 * lugar de ignorarlo, para que un cliente corrupto reciba un `400` y no un
 * listado que empieza por un punto arbitrario.
 *
 * SE EXIGE LA FORMA EXACTA que emite `encodeAccessRequestReviewCursor`: dos
 * segmentos, fecha UTC canónica e identificador admitido. El cursor no es un
 * secreto —cualquiera que lo posea puede usarlo—, así que la razón de exigir su
 * forma exacta no es la confidencialidad sino la COHERENCIA: un cursor describe
 * una posición, y una posición que el servidor nunca emitió no describe nada.
 * Reinterpretarla devolvería al cliente una página distinta de la que su cursor
 * afirma, y el error aparecería como filas ausentes y no como un `400`.
 */
function decodificarCursor(
  cursor: string,
): { readonly submittedAt: Date; readonly id: string } | null {
  if (!ACCESS_REQUEST_REVIEW_CURSOR_PATTERN.test(cursor)) {
    return null;
  }

  let decodificado: string;

  try {
    decodificado = Buffer.from(cursor, 'base64url').toString('utf8');
  } catch {
    return null;
  }

  const segmentos = decodificado.split('|');

  /*
   * EXACTAMENTE DOS SEGMENTOS. Antes se leían los dos primeros y se ignoraba el
   * resto, de modo que un cursor con un tercer segmento —cualquiera, incluso uno
   * con la fecha o el identificador de OTRA fila dentro— se aceptaba como si
   * fuera el que el servidor emitió. Un cursor es una CONTABILIZACIÓN de página,
   * no una sugerencia: si su forma difiere de la que el servidor produce,
   * ninguna de las formas parecidas es la que el servidor produjo, y aceptarla
   * daría al cliente una página que el servidor nunca describió.
   */
  if (segmentos.length !== 2) {
    return null;
  }

  const [marca, id] = segmentos;

  /*
   * `ACCESS_REQUEST_REQUEST_ID_PATTERN` es INSENSIBLE a mayúsculas porque
   * admite el mismo identificador en la ruta, y allí el cliente lo teclea. En el
   * cursor no es admisible: el emisor escribe el identificador tal como lo
   * entrega la fila, siempre en minúsculas, así que un cursor en mayúsculas no
   * salió de aquí. Aceptarlo convertiría encursor válido un texto que el
   * servidor jamás emitió, y esa es exactamente la clase de cursor que este
   * filtro existe para rechazar.
   */
  if (!ACCESS_REQUEST_REQUEST_ID_PATTERN.test(id) || id !== id.toLowerCase()) {
    return null;
  }

  const instante = new Date(marca);

  /*
   * FECHA CANÓNICA O NADA. Que la fecha sea PARSEABLE no basta y por eso no es
   * lo que se exige: `new Date()` acepta `2026-09-01`, `2026-09-01T10:00:00Z` o
   * `2026-09-01T12:00:00+02:00`, tres textos distintos para el mismo instante. Se
   * exige que la cadena recibida SEA la que produce
   * `Date.prototype.toISOString()`, que es exactamente lo que escribe
   * `encodeAccessRequestReviewCursor`. Si al normalizar a UTC el texto cambia, el
   * texto no era canónico y por tanto no salió de este servidor: se rechaza en
   * lugar de reinterpretarlo, porque reinterpretarlo devolvería al cliente una
   * página distinta de la que su cursor describe.
   */
  if (Number.isNaN(instante.getTime()) || instante.toISOString() !== marca) {
    return null;
  }

  return { submittedAt: instante, id: id.toLowerCase() };
}

/** Emite el cursor que reanuda la lectura justo después de una fila. */
export function encodeAccessRequestReviewCursor(row: {
  readonly submittedAt: Date;
  readonly id: string;
}): string {
  return Buffer.from(`${row.submittedAt.toISOString()}|${row.id}`, 'utf8').toString('base64url');
}

/* -------------------------------------------------------------------------- */
/* Identificador de la ruta                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Valida el identificador de la ruta.
 *
 * La forma se comprueba en el SERVIDOR y no solo en la ruta de NestJS. Un
 * identificador mal formado NO debe recibir el mismo `404` opaco que uno
 * ajeno: ese `404` afirma «no existe nada que mostrar», y para un identificador
 * que nunca pudo existir la respuesta honesta es `400`. Lo contrario dejaría al
 * cliente sin poder distinguir un `404` de un recurso de otro tenant de un `404`
 * de un identificador corrupto.
 */
export function isAccessRequestIdWellFormed(requestId: string): boolean {
  return ACCESS_REQUEST_REQUEST_ID_PATTERN.test(requestId);
}

/* -------------------------------------------------------------------------- */
/* Cuerpo de la decisión                                                       */
/* -------------------------------------------------------------------------- */

export interface ValidatedAccessRequestDecision {
  readonly action: AccessRequestReviewAction;
  readonly expectedVersion: number;
  readonly reasonCode: AccessRequestDecisionReasonCode;
}

export type AccessRequestDecisionValidation =
  | { readonly ok: true; readonly value: ValidatedAccessRequestDecision }
  | { readonly ok: false; readonly fields: readonly string[] };

/** Versión esperada máxima admitida. Acota el trabajo y descarta valores absurdos. */
const MAX_EXPECTED_VERSION = 1_000_000;

/**
 * Valida el cuerpo de la decisión.
 *
 * Las reglas que NO se negocian:
 * - el cuerpo tiene EXACTAMENTE las tres claves del contrato. Una clave
 *   desconocida se rechaza en lugar de ignorarse, porque ignorarla significaría
 *   que el servidor aplicaría una decisión que el cliente no cree haber enviado;
 * - `action` y `reasonCode` deben ser la pareja que declara el catálogo cerrado.
 *   Un `APPROVE` con motivo de rechazo se rechaza, no se "corrige";
 * - `expectedVersion` es un entero positivo: es el control de concurrencia
 *   optimista, y aceptarlo ausente o nulo dejaría la última escritura gana.
 */
export function validateAccessRequestDecisionBody(
  body: unknown,
): AccessRequestDecisionValidation {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { ok: false, fields: ['body'] };
  }

  const registro = body as Record<string, unknown>;
  const campos: string[] = [];

  for (const clave of Object.keys(registro)) {
    if (clave !== 'action' && clave !== 'expectedVersion' && clave !== 'reasonCode') {
      campos.push(clave);
    }
  }

  let action: AccessRequestReviewAction | undefined;
  const actionBruto = registro['action'];

  if (typeof actionBruto !== 'string') {
    campos.push('action');
  } else if (
    !ACCESS_REQUEST_REVIEW_ACTIONS.includes(actionBruto as AccessRequestReviewAction)
  ) {
    campos.push('action');
  } else {
    action = actionBruto as AccessRequestReviewAction;
  }

  let reasonCode: AccessRequestDecisionReasonCode | undefined;
  const reasonBruto = registro['reasonCode'];

  if (typeof reasonBruto !== 'string') {
    campos.push('reasonCode');
  } else if (
    !ACCESS_REQUEST_DECISION_REASON_CODES.includes(reasonBruto as AccessRequestDecisionReasonCode)
  ) {
    campos.push('reasonCode');
  } else {
    reasonCode = reasonBruto as AccessRequestDecisionReasonCode;
  }

  let expectedVersion: number | undefined;
  const versionBruta = registro['expectedVersion'];

  if (typeof versionBruta !== 'number' || !Number.isInteger(versionBruta)) {
    campos.push('expectedVersion');
  } else if (versionBruta < 1 || versionBruta > MAX_EXPECTED_VERSION) {
    campos.push('expectedVersion');
  } else {
    expectedVersion = versionBruta;
  }

  if (action !== undefined && reasonCode !== undefined) {
    if (ACCESS_REQUEST_DECISION[action].reasonCode !== reasonCode) {
      campos.push('reasonCode');
      reasonCode = undefined;
    }
  }

  if (campos.length > 0) {
    return { ok: false, fields: campos.sort() };
  }

  /*
   * Los tres campos han superado su validación individual y, si los había, la
   * de su pareja. Los `undefined` que quedan narrowed away no se comprueban otra
   * vez: sería una segunda copia de la misma comprobación.
   */
  return {
    ok: true,
    value: {
      action: action as AccessRequestReviewAction,
      expectedVersion: expectedVersion as number,
      reasonCode: reasonCode as AccessRequestDecisionReasonCode,
    },
  };
}
