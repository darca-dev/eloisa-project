import { ApiProperty } from '@nestjs/swagger';

import { type HomeVisitStatus } from '../generated/prisma/client';

import { type HomeVisitTransitionTarget } from './home-visit-transition.service';

/**
 * Contrato HTTP de la superficie de Visitas domiciliarias
 * (VISITS-CORE-01 MP04).
 *
 * Contiene TRES cosas y ninguna más: los códigos de fallo propios de la capa
 * HTTP, el análisis de los dos cuerpos admitidos y las clases DTO que describen
 * las respuestas. Viven juntas porque la allowlist de MP04 autoriza exactamente
 * cuatro archivos nuevos de Visitas y NO autoriza crear un archivo de contrato
 * ni uno de análisis de peticiones. Consolidarlos en piezas separadas es trabajo
 * de seguimiento explícito, no una decisión de esta tarea.
 *
 * NINGÚN DTO refleja un modelo Prisma: la respuesta es un contrato propio, no un
 * reflejo del almacenamiento.
 *
 * LO QUE NINGUNA RESPUESTA DEVUELVE, deliberadamente: `tenantId`, `patientId`,
 * `professionalId`, `careAssignmentId`, identidad institucional creadora, cuenta
 * humana actora, persona, nombre, documento, contacto, dirección, horario, zona,
 * motivo, nota, evidencia ni dato clínico. Nada de eso pertenece a esta
 * superficie, y varios de esos datos ni siquiera se persisten en la visita.
 *
 * LO QUE NINGÚN CUERPO ADMITE, deliberadamente: `tenantId`, `patientId`,
 * `professionalId`, actor, rol, identidad, `status` de creación ni marca de
 * tiempo. El tenant y la identidad salen del principal que resuelve el guard, y
 * el instante lo fija el SERVIDOR. Un `professionalId` recibido sería
 * exactamente la vía por la que una persona ejecutaría la visita de otra: aquí
 * no existe ese campo, y su AUSENCIA es la garantía.
 */

/* -------------------------------------------------------------------------- */
/* Códigos de fallo propios de la capa HTTP                                    */
/* -------------------------------------------------------------------------- */

/**
 * Códigos que NACEN en el borde HTTP.
 *
 * Los desenlaces de dominio —`HOME_VISIT_APPOINTMENT_NOT_FOUND`,
 * `HOME_VISIT_APPOINTMENT_NOT_MATERIALIZABLE`, `HOME_VISIT_ALREADY_MATERIALIZED`,
 * `HOME_VISIT_NOT_FOUND`, `HOME_VISIT_VERSION_CONFLICT` y
 * `HOME_VISIT_TRANSITION_NOT_ALLOWED`— los declaran los servicios de MP02 y MP03
 * y esta capa los PROPAGA sin renombrarlos ni reinterpretarlos.
 */
export const VISITS_API_ERROR_CODES = {
  /** Identificador de ruta mal formado. */
  invalidPath: 'VISITS_INVALID_PATH',
  /** Cuerpo ausente, con campos desconocidos o mal formados. */
  invalidBody: 'VISITS_INVALID_BODY',
  /** Cadena de consulta ausente, con parámetros desconocidos o mal formados. */
  invalidQuery: 'VISITS_INVALID_QUERY',
  /** Contexto de ejecución seguro no confirmado. Nunca describe la topología. */
  unavailable: 'VISITS_SERVICE_UNAVAILABLE',
} as const;

/** Forma canónica de un identificador opaco. */
export const VISITS_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

/* -------------------------------------------------------------------------- */
/* Análisis de los cuerpos admitidos                                           */
/* -------------------------------------------------------------------------- */

/** Error de validación del cuerpo. Nombra el campo, NUNCA su valor. */
export class VisitsBodyError extends Error {
  public readonly field: string;

  constructor(field: string, reason: string) {
    super(`El campo «${field}» ${reason}.`);
    this.name = 'VisitsBodyError';
    this.field = field;
  }
}

/** Campos EXACTOS admitidos al materializar. */
export const VISITS_MATERIALIZE_FIELDS = ['appointmentId'] as const;

/** Campos EXACTOS admitidos al cambiar de estado. */
export const VISITS_STATUS_CHANGE_FIELDS = ['status', 'expectedVersion'] as const;

/**
 * Estados destino admitidos, derivados del tipo de MP03.
 *
 * Se construyen desde un `Record` COMPLETO del tipo: omitir un estado destino o
 * añadir uno inexistente no compila. No hay por tanto forma de que la allowlist
 * del cuerpo y la máquina de transiciones diverjan en silencio.
 *
 * `SCHEDULED` NO aparece —y no puede aparecer—: ese estado es la CREACIÓN, que
 * pertenece a la materialización institucional y no a la persona profesional.
 */
const DESTINOS: Record<HomeVisitTransitionTarget, true> = {
  IN_PROGRESS: true,
  COMPLETED: true,
  NOT_COMPLETED: true,
};

export const HOME_VISIT_TRANSITION_TARGETS = Object.keys(
  DESTINOS,
) as readonly HomeVisitTransitionTarget[];

/** Cuerpo de materialización ya validado. Es lo ÚNICO que llega al servicio. */
export interface MaterializeHomeVisitRequest {
  readonly appointmentId: string;
}

/** Cuerpo de cambio de estado ya validado. */
export interface HomeVisitStatusChangeRequest {
  readonly status: HomeVisitTransitionTarget;
  readonly expectedVersion: number;
}

/**
 * Comprueba que el cuerpo es un objeto JSON y que NINGÚN campo cae fuera de la
 * allowlist. El rechazo es por construcción y no por filtrado posterior: un
 * campo desconocido produce `400` en lugar de ignorarse en silencio.
 */
function asObject(
  raw: unknown,
  allowed: readonly string[],
): Readonly<Record<string, unknown>> {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new VisitsBodyError('body', 'debe ser un objeto JSON');
  }

  const cuerpo = raw as Readonly<Record<string, unknown>>;

  for (const nombre of Object.keys(cuerpo)) {
    if (!allowed.includes(nombre)) {
      throw new VisitsBodyError(nombre, 'no está admitido en esta operación');
    }
  }

  return cuerpo;
}

export function parseMaterializeBody(raw: unknown): MaterializeHomeVisitRequest {
  const cuerpo = asObject(raw, VISITS_MATERIALIZE_FIELDS);
  const appointmentId = cuerpo['appointmentId'];

  if (typeof appointmentId !== 'string' || !VISITS_UUID_PATTERN.test(appointmentId)) {
    throw new VisitsBodyError('appointmentId', 'debe ser un identificador válido');
  }

  return { appointmentId };
}

export function parseStatusChangeBody(raw: unknown): HomeVisitStatusChangeRequest {
  const cuerpo = asObject(raw, VISITS_STATUS_CHANGE_FIELDS);
  const status = cuerpo['status'];

  if (
    typeof status !== 'string' ||
    !(HOME_VISIT_TRANSITION_TARGETS as readonly string[]).includes(status)
  ) {
    throw new VisitsBodyError('status', 'debe ser uno de los estados destino admitidos');
  }

  const expectedVersion = cuerpo['expectedVersion'];

  /*
   * Sin versión esperada la escritura sería CIEGA y el control optimista
   * dejaría de proteger nada. No tiene valor por defecto a propósito.
   */
  if (
    typeof expectedVersion !== 'number' ||
    !Number.isSafeInteger(expectedVersion) ||
    expectedVersion < 1
  ) {
    throw new VisitsBodyError(
      'expectedVersion',
      'debe ser un número entero mayor o igual que 1',
    );
  }

  return { status: status as HomeVisitTransitionTarget, expectedVersion };
}

/* -------------------------------------------------------------------------- */
/* DTOs                                                                        */
/* -------------------------------------------------------------------------- */

export class MaterializeHomeVisitRequestDto {
  @ApiProperty({
    description:
      'Identificador OPACO de la cita HOME ya ASSIGNED. Debe pertenecer a la institución que ' +
      'el servidor ya resolvió desde la sesión: una cita de otra institución produce el MISMO ' +
      '404 que una inexistente. Es el ÚNICO campo admitido; cualquier otro produce 400.',
    format: 'uuid',
    example: '0191f1a0-0000-7000-8000-000000000001',
  })
  public appointmentId!: string;
}

export class MaterializedHomeVisitDto {
  @ApiProperty({
    description: 'Identificador OPACO de la visita domiciliaria creada.',
    format: 'uuid',
    example: '0191f1a0-0000-7000-8000-000000000010',
  })
  public homeVisitId!: string;

  @ApiProperty({
    description: 'Identificador OPACO de la cita que la materializó.',
    format: 'uuid',
    example: '0191f1a0-0000-7000-8000-000000000001',
  })
  public appointmentId!: string;

  @ApiProperty({
    description:
      'Estado inicial. Una visita nace SCHEDULED, sin inicio ni fin: la materialización es un ' +
      'acto administrativo y no afirma que la atención haya ocurrido.',
    enum: ['SCHEDULED'],
    example: 'SCHEDULED',
  })
  public status!: 'SCHEDULED';

  @ApiProperty({
    description: 'Versión vigente. Es la que debe enviar el siguiente cambio de estado.',
    minimum: 1,
    example: 1,
  })
  public version!: number;

  @ApiProperty({
    description:
      'Transición de CREACIÓN escrita en la MISMA transacción. No lleva actor humano: quien ' +
      'materializa es la identidad institucional OPACA que opera, NUNCA la persona visitadora.',
    format: 'uuid',
    example: '0191f1a0-0000-7000-8000-000000000020',
  })
  public creationTransitionId!: string;

  @ApiProperty({
    description: 'Instante de creación, fijado por el SERVIDOR.',
    example: '2026-08-24T16:00:00.000Z',
  })
  public createdAt!: string;
}

export class ProfessionalHomeVisitDto {
  @ApiProperty({
    description: 'Identificador OPACO de la visita.',
    format: 'uuid',
    example: '0191f1a0-0000-7000-8000-000000000010',
  })
  public homeVisitId!: string;

  @ApiProperty({
    description:
      'Identificador OPACO de la cita de origen. Appointment sigue siendo la ÚNICA agenda: ' +
      'esta superficie no reprograma, no cancela y no crea citas.',
    format: 'uuid',
    example: '0191f1a0-0000-7000-8000-000000000001',
  })
  public appointmentId!: string;

  @ApiProperty({
    description:
      'Estado operativo de la visita. NO es un dato clínico, no describe el resultado de la ' +
      'atención y no acredita que ninguna atención se haya prestado.',
    enum: ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'NOT_COMPLETED'],
    example: 'SCHEDULED',
  })
  public status!: HomeVisitStatus;

  @ApiProperty({
    description: 'Versión vigente. Es la que debe enviar el siguiente cambio de estado.',
    minimum: 1,
    example: 1,
  })
  public version!: number;

  @ApiProperty({
    description: 'Instante de inicio, o null si la visita todavía no ha empezado.',
    nullable: true,
    example: null,
  })
  public startedAt!: string | null;

  @ApiProperty({
    description: 'Instante de cierre, o null mientras la visita no sea terminal.',
    nullable: true,
    example: null,
  })
  public endedAt!: string | null;

  @ApiProperty({
    description: 'Instante de creación, fijado por el SERVIDOR.',
    example: '2026-08-24T16:00:00.000Z',
  })
  public createdAt!: string;

  @ApiProperty({
    description: 'Instante de la última escritura, fijado por el SERVIDOR.',
    example: '2026-08-24T16:00:00.000Z',
  })
  public updatedAt!: string;
}

export class HomeVisitStatusChangeRequestDto {
  @ApiProperty({
    description:
      'Estado destino. La máquina es CERRADA: IN_PROGRESS solo desde SCHEDULED, COMPLETED solo ' +
      'desde IN_PROGRESS y NOT_COMPLETED desde SCHEDULED o IN_PROGRESS. Los estados terminales ' +
      'son inmutables: no hay reapertura, reversión ni cancelación en esta superficie.',
    enum: HOME_VISIT_TRANSITION_TARGETS,
    example: 'IN_PROGRESS',
  })
  public status!: HomeVisitTransitionTarget;

  @ApiProperty({
    description:
      'Versión que quien opera cree vigente. Es OBLIGATORIA y no tiene valor por defecto: sin ' +
      'ella la escritura sería ciega y el control optimista dejaría de proteger nada.',
    minimum: 1,
    example: 1,
  })
  public expectedVersion!: number;
}

export class HomeVisitTransitionResultDto {
  @ApiProperty({
    description: 'Identificador OPACO de la visita transicionada.',
    format: 'uuid',
    example: '0191f1a0-0000-7000-8000-000000000010',
  })
  public homeVisitId!: string;

  @ApiProperty({
    description: 'Estado desde el que se transicionó.',
    enum: ['SCHEDULED', 'IN_PROGRESS'],
    example: 'SCHEDULED',
  })
  public fromStatus!: HomeVisitStatus;

  @ApiProperty({
    description: 'Estado alcanzado.',
    enum: HOME_VISIT_TRANSITION_TARGETS,
    example: 'IN_PROGRESS',
  })
  public toStatus!: HomeVisitTransitionTarget;

  @ApiProperty({
    description: 'Versión YA incrementada. Es la que el siguiente intento debe enviar.',
    minimum: 1,
    example: 2,
  })
  public version!: number;

  @ApiProperty({
    description:
      'Transición escrita en la MISMA transacción, con la cuenta humana que actuó. El historial ' +
      'es APPEND-ONLY: no se reescribe ni se borra.',
    format: 'uuid',
    example: '0191f1a0-0000-7000-8000-000000000021',
  })
  public transitionId!: string;

  @ApiProperty({
    description: 'Instante de la transición, fijado por el SERVIDOR.',
    example: '2026-08-24T16:30:00.000Z',
  })
  public occurredAt!: string;
}

export class VisitsErrorDto {
  @ApiProperty({
    description: 'Código estable del desenlace. No describe la causa concreta.',
    example: 'HOME_VISIT_NOT_FOUND',
  })
  public code!: string;

  @ApiProperty({
    description: 'Mensaje para la persona usuaria. No revela detalle técnico.',
    example: 'No fue posible encontrar la visita indicada.',
  })
  public message!: string;
}

/* -------------------------------------------------------------------------- */
/* Worklist profesional: análisis de la consulta                               */
/* (VISITADOR-CORE-01 MP01)                                                    */
/* -------------------------------------------------------------------------- */

/**
 * ALLOWLIST CERRADA de la worklist profesional. EXACTAMENTE dos parámetros.
 *
 * Lo que NO figura aquí produce `400` y no se ignora en silencio: ignorar un
 * parámetro que quien llama creyó aplicar devolvería registros distintos de los
 * esperados. `tenantId`, `professionalId`, `patientId`, `careAssignmentId`,
 * `status`, actor, rol y afiliación están PROHIBIDOS por construcción —no
 * aparecen en la lista— y su ausencia es la garantía: el servidor deriva la
 * institución y la profesional desde el principal de la sesión, y de ningún
 * otro sitio.
 */
export const PROFESSIONAL_WORKLIST_QUERY_PARAMETERS = ['from', 'to'] as const;

/**
 * Ventana máxima INCLUSIVA, en días naturales.
 *
 * Acota cuánta agenda propia se materializa en una sola respuesta. No es una
 * regla de negocio ni un periodo institucional: es un límite técnico del
 * contrato.
 */
export const PROFESSIONAL_WORKLIST_MAX_WINDOW_DAYS = 31;

/** Error de validación de la consulta. Nombra el parámetro, NUNCA su valor. */
export class VisitsQueryError extends Error {
  public readonly parameter: string;

  constructor(parameter: string, reason: string) {
    super(`El parámetro «${parameter}» ${reason}.`);
    this.name = 'VisitsQueryError';
    this.parameter = parameter;
  }
}

/** Ventana de calendario ya validada. Es lo ÚNICO que llega al servicio. */
export interface ProfessionalWorklistWindow {
  readonly from: string;
  readonly to: string;
}

/** Fecha `AAAA-MM-DD` en UTC. La ventana no depende de la zona del navegador. */
function diaUtc(instante: Date): string {
  return instante.toISOString().slice(0, 10);
}

/**
 * Instante de INICIO del día UTC indicado.
 *
 * La ventana se expresa en fechas de CALENDARIO y se resuelve en UTC, que es la
 * zona en la que la plataforma almacena y compara sus instantes. NO se aplica
 * ninguna zona institucional: MERDN no tiene modelada ninguna, e inventarla
 * desplazaría en silencio qué citas entran y salen de la ventana.
 */
export function startOfUtcDay(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

/**
 * Instante EXCLUSIVO de fin del día UTC indicado.
 *
 * Se usa la cota exclusiva —el inicio del día siguiente— en lugar de
 * `23:59:59.999`: así ninguna cita programada en el último milisegundo del día
 * queda fuera de la ventana por un redondeo.
 */
export function endOfUtcDayExclusive(date: string): Date {
  return new Date(startOfUtcDay(date).getTime() + 24 * 60 * 60 * 1000);
}

/** Días naturales INCLUSIVOS entre dos fechas `AAAA-MM-DD` UTC. */
function diasInclusivos(from: string, to: string): number {
  const diferencia = startOfUtcDay(to).getTime() - startOfUtcDay(from).getTime();

  return Math.floor(diferencia / (24 * 60 * 60 * 1000)) + 1;
}

/**
 * Valor ÚNICO de un parámetro.
 *
 * Un arreglo significa que llegó repetido y un objeto que llegó con sintaxis
 * anidada (`?from[x]=y`): ambos se rechazan, porque elegir uno de los valores
 * recibidos sería una decisión inventada.
 */
function valorUnico(raw: Readonly<Record<string, unknown>>, name: string): string {
  const value = raw[name];

  if (value === undefined) {
    throw new VisitsQueryError(name, 'es obligatorio en esta consulta');
  }

  if (Array.isArray(value)) {
    throw new VisitsQueryError(name, 'no admite valores repetidos');
  }

  if (typeof value !== 'string') {
    throw new VisitsQueryError(name, 'debe ser un valor simple');
  }

  const recortado = value.trim();

  if (recortado.length === 0) {
    throw new VisitsQueryError(name, 'es obligatorio en esta consulta');
  }

  return recortado;
}

/**
 * Fecha `AAAA-MM-DD` estricta y REAL.
 *
 * No basta con la forma: `2026-02-31` tiene forma válida y no existe. Se
 * comprueba que la fecha reconstruida en UTC coincida con la recibida, de modo
 * que una fecha inexistente produzca `400` en lugar de desplazarse en silencio
 * al mes siguiente.
 */
function fechaCalendario(raw: Readonly<Record<string, unknown>>, name: string): string {
  const value = valorUnico(raw, name);

  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) {
    throw new VisitsQueryError(name, 'debe tener la forma AAAA-MM-DD');
  }

  const instante = startOfUtcDay(value);

  if (Number.isNaN(instante.getTime()) || diaUtc(instante) !== value) {
    throw new VisitsQueryError(name, 'no es una fecha real del calendario');
  }

  return value;
}

/**
 * Analiza la consulta de la worklist profesional.
 *
 * La ventana es OBLIGATORIA y no tiene valor por defecto. Una worklist sin
 * ventana explícita tendría que elegir un periodo por su cuenta —el día del
 * servidor, la semana en curso— y cualquier elección acabaría presentándose
 * como «la agenda» sin que nadie la hubiera pedido. Exigirla obliga a que la
 * interfaz declare siempre qué periodo está mostrando.
 *
 * Deliberadamente NO se toma ninguna fecha por defecto del CLIENTE: dejarla en
 * manos del navegador permitiría que el reloj del dispositivo decidiera qué
 * registros se leen.
 */
export function parseWorklistQuery(raw: unknown): ProfessionalWorklistWindow {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new VisitsQueryError('query', 'debe ser una cadena de consulta válida');
  }

  const consulta = raw as Readonly<Record<string, unknown>>;

  for (const nombre of Object.keys(consulta)) {
    if (!(PROFESSIONAL_WORKLIST_QUERY_PARAMETERS as readonly string[]).includes(nombre)) {
      throw new VisitsQueryError(nombre, 'no está admitido en esta consulta');
    }
  }

  const from = fechaCalendario(consulta, 'from');
  const to = fechaCalendario(consulta, 'to');

  if (from > to) {
    throw new VisitsQueryError('from', 'no puede ser posterior a «to»');
  }

  if (diasInclusivos(from, to) > PROFESSIONAL_WORKLIST_MAX_WINDOW_DAYS) {
    throw new VisitsQueryError(
      'to',
      `no puede abarcar más de ${PROFESSIONAL_WORKLIST_MAX_WINDOW_DAYS} días desde «from»`,
    );
  }

  return { from, to };
}

/* -------------------------------------------------------------------------- */
/* Worklist profesional: DTOs                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Persona atendida, MINIMIZADA a lo estrictamente necesario para reconocerla en
 * la propia agenda.
 *
 * NO lleva —y no puede llevar— identificador de paciente ni de persona,
 * documento, fecha de nacimiento, teléfono, correo, dirección, indicaciones,
 * contacto, programa, diagnóstico, alerta, semáforo, nota ni ningún dato
 * clínico. La visita domiciliaria no es Historia Clínica Electrónica y esta
 * superficie no acredita ninguna necesidad de conocer más que ésta.
 */
export class ProfessionalWorklistPatientDto {
  @ApiProperty({
    description:
      'Nombre mostrable de la persona atendida. Es una proyección de PRESENTACIÓN y no un ' +
      'identificador: no se puede buscar por él en esta superficie.',
    example: 'Persona Ejemplo Ficticio',
  })
  public displayName!: string;

  @ApiProperty({
    description:
      'Iniciales del primer nombre y el primer apellido. Abreviatura de PRESENTACIÓN, nunca ' +
      'un identificador.',
    example: 'PE',
  })
  public initials!: string;
}

/** Estado OPERATIVO de la visita ya materializada. Nada más. */
export class ProfessionalWorklistVisitDto {
  @ApiProperty({
    description:
      'Identificador OPACO de la visita. Sirve EXCLUSIVAMENTE para abrir su detalle o ' +
      'ejecutar su transición; no debe mostrarse como texto en ninguna interfaz.',
    format: 'uuid',
    example: '0191f1a0-0000-7000-8000-000000000010',
  })
  public homeVisitId!: string;

  @ApiProperty({
    description:
      'Estado operativo. NO es un dato clínico, no describe el resultado de la atención y no ' +
      'acredita que ninguna atención se haya prestado.',
    enum: ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'NOT_COMPLETED'],
    example: 'SCHEDULED',
  })
  public status!: HomeVisitStatus;

  @ApiProperty({
    description: 'Versión vigente. Es la que debe enviar el siguiente cambio de estado.',
    minimum: 1,
    example: 1,
  })
  public version!: number;

  @ApiProperty({
    description: 'Instante de inicio, o null si la visita todavía no ha empezado.',
    nullable: true,
    example: null,
  })
  public startedAt!: string | null;

  @ApiProperty({
    description: 'Instante de cierre, o null mientras la visita no sea terminal.',
    nullable: true,
    example: null,
  })
  public endedAt!: string | null;

  @ApiProperty({
    description: 'Instante de la última escritura, fijado por el SERVIDOR.',
    example: '2026-08-24T16:00:00.000Z',
  })
  public updatedAt!: string;
}

/** Una cita HOME asignada de la persona autenticada, con su visita si existe. */
export class ProfessionalWorklistItemDto {
  @ApiProperty({
    description:
      'Identificador OPACO de la cita. Appointment sigue siendo la ÚNICA agenda: esta ' +
      'superficie no crea, no reprograma y no cancela citas.',
    format: 'uuid',
    example: '0191f1a0-0000-7000-8000-000000000001',
  })
  public appointmentId!: string;

  @ApiProperty({
    description:
      'Instante EXACTO de inicio programado, tal como lo persiste la agenda. NO se modela ' +
      'duración, solapamiento, desplazamiento ni zona.',
    example: '2026-08-24T16:00:00.000Z',
  })
  public scheduledStart!: string;

  @ApiProperty({
    description: 'Modalidad de la cita. Esta superficie devuelve EXCLUSIVAMENTE HOME.',
    enum: ['HOME'],
    example: 'HOME',
  })
  public modality!: 'HOME';

  @ApiProperty({
    description: 'Persona atendida, minimizada.',
    type: ProfessionalWorklistPatientDto,
  })
  public patient!: ProfessionalWorklistPatientDto;

  @ApiProperty({
    description:
      'Visita ya materializada, o null cuando la agenda hospitalaria todavía no la ha ' +
      'materializado. Un null NO autoriza a la persona profesional a materializarla: la ' +
      'materialización es un acto institucional y esta superficie no la ofrece.',
    type: ProfessionalWorklistVisitDto,
    nullable: true,
  })
  public visit!: ProfessionalWorklistVisitDto | null;
}

/** Ventana de calendario EXACTAMENTE como se solicitó. */
export class ProfessionalWorklistWindowDto {
  @ApiProperty({ description: 'Primer día UTC de la ventana.', example: '2026-08-24' })
  public from!: string;

  @ApiProperty({
    description: 'Último día UTC de la ventana, inclusive.',
    example: '2026-08-24',
  })
  public to!: string;
}

export class ProfessionalVisitWorklistDto {
  @ApiProperty({
    description: 'Ventana declarada en la consulta. El servidor no la amplía ni la recorta.',
    type: ProfessionalWorklistWindowDto,
  })
  public window!: ProfessionalWorklistWindowDto;

  @ApiProperty({
    description:
      'Citas HOME ASSIGNED de las asignaciones de cuidado ACTIVAS y VIGENTES de la persona ' +
      'autenticada, dentro de la ventana. Una lista VACÍA es la respuesta honesta cuando no ' +
      'hay perfil, afiliación, asignación ni citas: nunca revela si otra persona sí las tiene.',
    type: [ProfessionalWorklistItemDto],
  })
  public items!: readonly ProfessionalWorklistItemDto[];
}
