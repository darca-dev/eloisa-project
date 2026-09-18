import { resolvePublicApiBaseUrl } from '@/config/environment';

/**
 * Cliente tipado de Visitas domiciliarias
 * (HOSPITAL-VISITS-01 packet A, sobre VISITS-CORE-01 MP04).
 *
 * Frontera ÚNICA entre Hospital y las TRES rutas reales de MP04. No existe
 * ninguna otra: no hay listado, ni agenda propia, ni superficie de cuidador o
 * paciente, ni notas, evidencia, dirección, ubicación, archivo ni cancelación.
 * Enumerar visitas revelaría a quién atiende quién, y por eso el servidor no
 * ofrece esa operación: este cliente tampoco la simula.
 *
 * Reglas heredadas de los cuatro clientes Hospital ya aprobados:
 *
 * - NO envía tenant, institución, paciente, profesional, actor, rol ni marca de
 *   tiempo. El contexto lo resuelve ÍNTEGRAMENTE el servidor desde la sesión, y
 *   los cuerpos de MP04 rechazan con `400` cualquier campo fuera de su
 *   allowlist. La AUSENCIA de `professionalId` es justamente la garantía de que
 *   nadie puede ejecutar la visita de otra persona desde el navegador;
 * - NO contiene credenciales: la sesión viaja en una cookie `HttpOnly` que este
 *   código no puede leer ni escribir, y por eso todas las peticiones piden
 *   `credentials: 'include'`;
 * - NO guarda nada en el navegador y pide `cache: 'no-store'`;
 * - NUNCA lanza: devuelve un desenlace tipado para que la interfaz muestre un
 *   estado accesible y permita reintentar;
 * - NO tiene repliegue a los datos demostrativos de `hospitalVisitsConfig.ts`:
 *   un fallo es un fallo, y así se comunica.
 *
 * DOS SUPERFICIES, DOS IDENTIDADES DISJUNTAS. Materializar es un acto
 * ADMINISTRATIVO de la identidad institucional; iniciar, completar o dar por no
 * realizada una visita es el acto de la PERSONA profesional autenticada. Este
 * cliente no las mezcla ni deduce una de la otra: cada guard del servidor mira
 * solo su propia cookie.
 *
 * `fetchImpl` se recibe por parámetro, con `fetch` como valor por defecto: es
 * lo que permite probar rutas, cuerpos, cancelación y cada código de estado sin
 * jsdom y sin red.
 */

/* -------------------------------------------------------------------------- */
/* Contrato de estados                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Estado operativo de una visita.
 *
 * NO es un dato clínico: no describe el resultado de la atención y no acredita
 * que ninguna atención se haya prestado.
 */
export type HospitalVisitaEstado =
  | 'SCHEDULED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'NOT_COMPLETED';

/**
 * Estados destino que la persona profesional puede pedir.
 *
 * `SCHEDULED` NO aparece —y no puede aparecer—: ese estado es la CREACIÓN, que
 * pertenece a la materialización institucional. La máquina de transiciones es
 * CERRADA y vive ENTERA en el servidor: este cliente no la reimplementa, no
 * anticipa qué transición será admitida y no bloquea ninguna por su cuenta.
 */
export type HospitalVisitaDestino = 'IN_PROGRESS' | 'COMPLETED' | 'NOT_COMPLETED';

/** Los tres destinos del contrato, en el orden en que el servidor los declara. */
export const HOSPITAL_VISITA_DESTINOS: readonly HospitalVisitaDestino[] = [
  'IN_PROGRESS',
  'COMPLETED',
  'NOT_COMPLETED',
];

/* -------------------------------------------------------------------------- */
/* Contrato de respuesta                                                       */
/* -------------------------------------------------------------------------- */

/** Respuesta de la materialización institucional. Una visita nace SCHEDULED. */
export interface HospitalVisitaMaterializadaDto {
  readonly homeVisitId: string;
  readonly appointmentId: string;
  readonly status: 'SCHEDULED';
  /** Versión vigente. Es la que debe enviar el siguiente cambio de estado. */
  readonly version: number;
  readonly creationTransitionId: string;
  readonly createdAt: string;
}

/**
 * Visita autorizada de la persona profesional.
 *
 * Deliberadamente OPACA: no lleva paciente, profesional, persona, horario,
 * dirección, zona ni dato clínico, porque el servidor no los devuelve.
 */
export interface HospitalVisitaProfesionalDto {
  readonly homeVisitId: string;
  readonly appointmentId: string;
  readonly status: HospitalVisitaEstado;
  readonly version: number;
  readonly startedAt: string | null;
  readonly endedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Resultado de una transición ya ejecutada, con su versión incrementada. */
export interface HospitalVisitaTransicionDto {
  readonly homeVisitId: string;
  readonly fromStatus: HospitalVisitaEstado;
  readonly toStatus: HospitalVisitaDestino;
  /** Versión YA incrementada. Es la que el siguiente intento debe enviar. */
  readonly version: number;
  readonly transitionId: string;
  readonly occurredAt: string;
}

/* -------------------------------------------------------------------------- */
/* Rutas                                                                       */
/* -------------------------------------------------------------------------- */

const VISITAS_PATH = '/api/v1/visits';
const PROFESIONAL_PATH = '/api/v1/professional/visits';

/** Las TRES rutas de MP04. Expuestas para las pruebas de contrato. */
export const RUTAS_HOSPITAL_VISITAS = {
  materializar: `${VISITAS_PATH}/materialize`,
  visita: (visitId: string): string =>
    `${PROFESIONAL_PATH}/${encodeURIComponent(visitId)}`,
  estado: (visitId: string): string =>
    `${PROFESIONAL_PATH}/${encodeURIComponent(visitId)}/status`,
} as const;

/* -------------------------------------------------------------------------- */
/* Desenlaces                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Desenlace de una operación, ya traducido a lenguaje de interfaz.
 *
 * `cancelado` es un desenlace de primera clase: una operación abortada al
 * cambiar de pantalla NO es un error y no debe pintar un estado de fallo.
 *
 * `no-encontrado` cubre por igual la visita inexistente, la de otra institución
 * y aquella cuya asignación no corresponde a quien opera, porque el servidor
 * responde lo MISMO en los tres casos: la interfaz no debe deducir más ni
 * confirmar la existencia de un registro ajeno.
 *
 * `conflicto` cubre por igual la versión desactualizada y la transición no
 * admitida. El servidor no revela cuál de las dos fue, y la acción de la
 * persona es la misma: refrescar antes de volver a intentarlo.
 */
export type ResultadoVisita<T> =
  | { readonly kind: 'ok'; readonly datos: T }
  | { readonly kind: 'solicitud-invalida' }
  | { readonly kind: 'sin-sesion' }
  | { readonly kind: 'sin-permiso' }
  | { readonly kind: 'no-encontrado' }
  | { readonly kind: 'conflicto' }
  | { readonly kind: 'no-disponible' }
  | { readonly kind: 'cancelado' };

/** Desenlaces que NO son un éxito. Alimentan el mensaje y el refresco. */
export type HospitalVisitaFallo = Exclude<ResultadoVisita<unknown>['kind'], 'ok'>;

/* -------------------------------------------------------------------------- */
/* Textos de producto                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Mensajes visibles, centralizados aquí.
 *
 * Ninguno expone código de estado, código estable del servidor, nombre de ruta,
 * capa técnica ni detalle interno alguno. Ninguno afirma ni niega la existencia
 * de un registro ajeno, y ninguno describe qué regla concreta falló: el
 * servidor tampoco lo hace, y repetirlo aquí filtraría lo que él protege.
 */
const MENSAJES: Record<Exclude<HospitalVisitaFallo, 'cancelado'>, string> = {
  'solicitud-invalida':
    'No fue posible completar la solicitud. Revise la información e inténtelo de nuevo.',
  'sin-sesion': 'Su sesión no está activa. Vuelva a entrar para continuar.',
  'sin-permiso': 'No tiene permiso para realizar esta acción.',
  'no-encontrado': 'La visita no está disponible en este momento.',
  conflicto:
    'La visita cambió de estado. Actualice la información antes de volver a intentarlo.',
  'no-disponible':
    'El servicio no está disponible en este momento. Inténtelo de nuevo más tarde.',
};

/**
 * Mensaje visible de un desenlace, o `null` cuando no hay nada que anunciar.
 *
 * El éxito y la cancelación devuelven `null` a propósito: anunciar un error
 * porque la persona cambió de pantalla sería falso y solo confundiría.
 */
export function mensajeDeVisita(resultado: ResultadoVisita<unknown>): string | null {
  return resultado.kind === 'ok' || resultado.kind === 'cancelado'
    ? null
    : MENSAJES[resultado.kind];
}

/**
 * `true` cuando la interfaz debe releer la visita antes de reintentar.
 *
 * Solo el conflicto lo exige: la versión que la pantalla tiene ya no es la
 * vigente, y reenviarla volvería a fallar igual.
 */
export function requiereRefrescoDeVisita(resultado: ResultadoVisita<unknown>): boolean {
  return resultado.kind === 'conflicto';
}

/* -------------------------------------------------------------------------- */
/* Transporte                                                                  */
/* -------------------------------------------------------------------------- */

/** Distingue un abort deliberado de un fallo real de red. */
export function esCancelacionDeVisita(error: unknown, signal?: AbortSignal): boolean {
  if (signal?.aborted === true) {
    return true;
  }

  return error instanceof Error && error.name === 'AbortError';
}

/**
 * Traduce el estado HTTP al desenlace tipado del contrato.
 *
 * `401` y `403` se distinguen porque la acción de la persona es distinta: sin
 * sesión hay que abrirla; con sesión pero sin permiso, no hay nada que hacer
 * desde la interfaz. Ninguno de los dos revela por qué.
 *
 * `503` y cualquier otro fallo no previsto comparten desenlace: el servidor
 * falla cerrado ante un contexto de ejecución no confirmado y NO describe su
 * topología, de modo que la interfaz tampoco puede distinguir más.
 */
export function desenlaceDeEstadoVisita<T>(estado: number): ResultadoVisita<T> | null {
  switch (estado) {
    case 400:
      return { kind: 'solicitud-invalida' };
    case 401:
      return { kind: 'sin-sesion' };
    case 403:
      return { kind: 'sin-permiso' };
    case 404:
      return { kind: 'no-encontrado' };
    case 409:
      return { kind: 'conflicto' };
    default:
      return null;
  }
}

/** Opciones comunes: sesión por cookie, sin caché y sin cabecera fabricada. */
function peticion(
  method: 'GET' | 'POST' | 'PATCH',
  cuerpo: string | null,
  signal?: AbortSignal,
): RequestInit {
  return {
    method,
    // La cookie de sesión la administra el navegador: no se escribe aquí.
    credentials: 'include',
    headers:
      cuerpo === null
        ? { Accept: 'application/json' }
        : { 'Content-Type': 'application/json', Accept: 'application/json' },
    cache: 'no-store',
    ...(cuerpo === null ? {} : { body: cuerpo }),
    ...(signal === undefined ? {} : { signal }),
  };
}

/**
 * Ejecuta una operación y devuelve SIEMPRE un desenlace tipado.
 *
 * Un fallo de red y un cuerpo ilegible terminan en `no-disponible`, igual que
 * el `503`: en los tres casos la respuesta útil es la misma —el servicio no
 * devolvió algo utilizable— y no hay dato que mostrar. En ninguno se repliega a
 * datos demostrativos.
 */
async function operar<T>(
  path: string,
  init: RequestInit,
  fetchImpl: typeof fetch,
  signal?: AbortSignal,
): Promise<ResultadoVisita<T>> {
  let response: Response;

  try {
    response = await fetchImpl(`${resolvePublicApiBaseUrl()}${path}`, init);
  } catch (error) {
    return esCancelacionDeVisita(error, signal)
      ? { kind: 'cancelado' }
      : { kind: 'no-disponible' };
  }

  if (signal?.aborted === true) {
    return { kind: 'cancelado' };
  }

  const desenlace = desenlaceDeEstadoVisita<T>(response.status);

  if (desenlace !== null) {
    return desenlace;
  }

  if (!response.ok) {
    return { kind: 'no-disponible' };
  }

  try {
    return { kind: 'ok', datos: (await response.json()) as T };
  } catch {
    return { kind: 'no-disponible' };
  }
}

/* -------------------------------------------------------------------------- */
/* Operaciones                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Materializa la visita domiciliaria de una cita HOME ya ASSIGNED.
 *
 * Acto ADMINISTRATIVO de la identidad institucional: NO afirma que la atención
 * se haya prestado, no crea citas, no reprograma, no cancela, no asigna
 * profesionales y no aplica ninguna regla clínica.
 *
 * El cuerpo lleva EXACTAMENTE `appointmentId` y nada más: el tenant, la
 * identidad, el rol y el instante los resuelve el servidor.
 */
export async function materializarVisita(
  appointmentId: string,
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<ResultadoVisita<HospitalVisitaMaterializadaDto>> {
  return operar<HospitalVisitaMaterializadaDto>(
    RUTAS_HOSPITAL_VISITAS.materializar,
    // Objeto NUEVO y literal: nada del estado de la vista se filtra al cuerpo.
    peticion('POST', JSON.stringify({ appointmentId }), signal),
    fetchImpl,
    signal,
  );
}

/**
 * Consulta UNA visita asignada a la persona autenticada.
 *
 * La autorización se resuelve ENTERA en el servidor desde la sesión: perfil,
 * afiliación y asignación de cuidado vigentes. El cliente no envía profesional,
 * paciente ni institución, y no existe listado ni búsqueda.
 */
export async function consultarVisitaProfesional(
  visitId: string,
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<ResultadoVisita<HospitalVisitaProfesionalDto>> {
  return operar<HospitalVisitaProfesionalDto>(
    RUTAS_HOSPITAL_VISITAS.visita(visitId),
    peticion('GET', null, signal),
    fetchImpl,
    signal,
  );
}

/**
 * Inicia, completa o da por no realizada una visita asignada.
 *
 * Control OPTIMISTA de versión: `expectedVersion` es OBLIGATORIA y no tiene
 * valor por defecto, porque sin ella la escritura sería ciega. Debe ser la
 * `version` que devolvió la última lectura o la última transición.
 *
 * El cuerpo lleva EXACTAMENTE `status` y `expectedVersion`. No viaja actor,
 * rol, profesional, paciente, institución, instante, motivo, nota, evidencia ni
 * dato clínico alguno: MERDN no tiene aprobado ningún catálogo de causas y esta
 * superficie no lo inventa.
 */
export async function cambiarEstadoVisita(
  visitId: string,
  status: HospitalVisitaDestino,
  expectedVersion: number,
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<ResultadoVisita<HospitalVisitaTransicionDto>> {
  return operar<HospitalVisitaTransicionDto>(
    RUTAS_HOSPITAL_VISITAS.estado(visitId),
    peticion('PATCH', JSON.stringify({ status, expectedVersion }), signal),
    fetchImpl,
    signal,
  );
}
