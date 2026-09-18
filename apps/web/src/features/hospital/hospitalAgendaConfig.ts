import {
  instanteDeFechaHora,
  type HospitalAgendaEscala,
  type HospitalCitaAgendaDto,
  type HospitalModalidadCita,
  type ResultadoAsignacion,
} from './hospitalAgendaClient';
import type { HospitalIconName } from './HospitalIcon';
import type { ResultadoOperaciones } from './hospitalProfessionalsClient';
import type { HospitalTonoId } from './hospitalTonos';

/**
 * Contrato tipado y fixtures de la vista «Agenda y citas» (TASK-003H-03, FR-02).
 *
 * Fuente visual vinculante: `prototype-claude/Eligeme-Hospital.dc.html`,
 * vista `vAgenda` (líneas 204–295) y sus datos demostrativos (líneas 1184 y
 * 1460–1512).
 *
 * Alcance: presentación. Las solicitudes, el calendario, los totales y los
 * estados son fixtures ficticios de fidelidad visual. No hay disponibilidad,
 * conflicto de horario, reserva, cobro, notificación, WhatsApp ni integración
 * de calendario: nada se calcula, se envía, se sincroniza ni se persiste. Los
 * textos del prototipo que mencionan actualización de vistas, novedades o
 * WhatsApp son copia visual y no describen funcionalidad implementada.
 */

/** Encabezado de una vista Hospital: título visible y párrafo explicativo. */
export interface HospitalVistaEncabezado {
  readonly titulo: string;
  readonly descripcion: string;
}

/** Solicitud pendiente de asignación, en el orden exacto de la referencia. */
export interface HospitalAgendaSolicitud {
  readonly id: string;
  readonly paciente: string;
  readonly tipo: string;
  readonly detalle: string;
  /** Complemento de «Solicitado por …». */
  readonly origen: string;
  /** Antigüedad demostrativa ya redactada. */
  readonly cuando: string;
  /** Estado de solicitud o de pago; se lee como texto, no solo como color. */
  readonly estado: string;
  readonly tono: HospitalTonoId;
  readonly icono: HospitalIconName;
}

/** Celda del calendario maestro; las celdas fuera del mes van vacías. */
export interface HospitalAgendaDia {
  readonly numero: string;
  /** Texto `N citas`; vacío cuando el día no registra citas o está fuera del mes. */
  readonly citas: string;
  readonly dentroDelMes: boolean;
  /** Día resaltado por la referencia (17 de agosto de 2026). */
  readonly esHoy: boolean;
  /** Fondo celeste que la referencia aplica a los días de más de 12 citas. */
  readonly destacado: boolean;
}

export interface HospitalAgendaTotal {
  readonly id: string;
  readonly valor: string;
  readonly etiqueta: string;
  /** Color de énfasis del total. Token del sistema. */
  readonly color: string;
}

export interface HospitalAgendaEstadoCita {
  readonly etiqueta: string;
  readonly tono: HospitalTonoId;
}

export interface HospitalAgendaPerspectiva {
  readonly rol: string;
  readonly texto: string;
  readonly icono: HospitalIconName;
}

export interface HospitalAgendaSolicitudesConfig {
  readonly titulo: string;
  readonly contador: string;
  readonly items: readonly HospitalAgendaSolicitud[];
  /** Opciones del selector de profesional, incluida la opción inicial vacía. */
  readonly profesionales: readonly string[];
  readonly acciones: {
    readonly asignar: string;
    readonly reprogramar: string;
    readonly rechazar: string;
  };
}

export interface HospitalAgendaCalendarioConfig {
  readonly titulo: string;
  readonly escalas: readonly string[];
  readonly diasSemana: readonly string[];
  /** Nombres completos de los días, solo para tecnologías de asistencia. */
  readonly diasSemanaNombres: readonly string[];
  readonly dias: readonly HospitalAgendaDia[];
  readonly totales: readonly HospitalAgendaTotal[];
}

export interface HospitalAgendaEstadosConfig {
  readonly titulo: string;
  readonly descripcion: string;
  readonly items: readonly HospitalAgendaEstadoCita[];
  readonly perspectivasTitulo: string;
  readonly perspectivas: readonly HospitalAgendaPerspectiva[];
}

export interface HospitalAgendaConfig {
  readonly encabezado: HospitalVistaEncabezado;
  readonly solicitudes: HospitalAgendaSolicitudesConfig;
  readonly calendario: HospitalAgendaCalendarioConfig;
  readonly estados: HospitalAgendaEstadosConfig;
}

/**
 * Citas por día de agosto de 2026 (referencia, línea 1184). Es un fixture
 * visual: no proviene de una agenda real y no se calcula.
 */
export const HOSPITAL_CITAS_AGOSTO: readonly number[] = [
  3, 0, 11, 14, 9, 16, 12, 5, 0, 13, 15, 8, 17, 10, 4, 0, 24, 19, 13, 16, 21, 7, 0, 12, 14, 11, 18,
  9, 6, 0, 10,
];

/** Celdas anteriores al 1 de agosto de 2026 (referencia, línea 1473: `n = i - 4`). */
const CELDAS_PREVIAS = 4;
/** Total de celdas de la cuadrícula (referencia, línea 1472). */
const CELDAS_CALENDARIO = 42;
/** Día resaltado por la referencia (línea 1475). */
const DIA_RESALTADO = 17;
/** Umbral del fondo celeste de la referencia (línea 1480). */
const UMBRAL_DESTACADO = 12;

/**
 * Construye la cuadrícula exactamente como la referencia (líneas 1471–1483).
 * Es determinista y no lee la fecha del sistema.
 */
function construirDias(): readonly HospitalAgendaDia[] {
  return Array.from({ length: CELDAS_CALENDARIO }, (_, indice) => {
    const numero = indice - CELDAS_PREVIAS;
    const dentroDelMes = numero >= 1 && numero <= HOSPITAL_CITAS_AGOSTO.length;
    const citas = dentroDelMes ? (HOSPITAL_CITAS_AGOSTO[numero - 1] ?? 0) : 0;

    return {
      numero: dentroDelMes ? String(numero) : '',
      citas: dentroDelMes && citas > 0 ? `${citas} citas` : '',
      dentroDelMes,
      esHoy: numero === DIA_RESALTADO,
      destacado: dentroDelMes && citas > UMBRAL_DESTACADO,
    };
  });
}

/** Configuración demostrativa completa de la vista «Agenda y citas». */
export const hospitalAgendaDemo: HospitalAgendaConfig = {
  encabezado: {
    titulo: 'Agenda y citas',
    descripcion:
      'Esta es la agenda maestra. Paciente, cuidador y profesional no crean citas aparte: todos ven y modifican la misma cita según sus permisos.',
  },
  solicitudes: {
    titulo: 'Solicitudes pendientes de asignación',
    contador: '4 solicitudes',
    items: [
      {
        id: 'sara-nieto-vargas',
        paciente: 'Sara Nieto Vargas',
        tipo: 'Visita médica en casa',
        detalle: 'Calle 12 # 7-40, vereda El Charquito · alerta roja abierta',
        origen: 'la cuidadora Ana López',
        cuando: 'hoy 7:20 a. m.',
        estado: 'Pago confirmado',
        tono: 'verde',
        icono: 'visitas',
      },
      {
        id: 'carmen-lopez-diaz',
        paciente: 'Carmen López Díaz',
        tipo: 'Cita prioritaria en el hospital',
        detalle: 'Sin cobro para la paciente · requiere horario de la ESE',
        origen: 'la paciente',
        cuando: 'hoy 6:48 a. m.',
        estado: 'Solicitud pendiente',
        tono: 'amarillo',
        icono: 'agenda',
      },
      {
        id: 'rosa-marin-cifuentes',
        paciente: 'Rosa Marín Cifuentes',
        tipo: 'Consulta virtual',
        detalle: 'Control después de remisión · se conecta con su hija',
        origen: 'el cuidador',
        cuando: 'ayer 5:10 p. m.',
        estado: 'Pago confirmado',
        tono: 'verde',
        icono: 'virtuales',
      },
      {
        id: 'jorge-beltran-ruiz',
        paciente: 'Jorge Beltrán Ruiz',
        tipo: 'Visita médica en casa',
        detalle: 'Cra 8 # 21-05, San Mateo · seguimiento de lesión de piel',
        origen: 'el profesional en salud',
        cuando: 'ayer 4:35 p. m.',
        estado: 'Pago pendiente',
        tono: 'amarillo',
        icono: 'visitas',
      },
    ],
    profesionales: [
      'Asignar profesional…',
      'Dra. Laura Gómez · medicina',
      'Enf. Carlos Ruiz · enfermería',
      'Ft. Diana Salas · fisioterapia',
    ],
    acciones: {
      asignar: 'Asignar',
      reprogramar: 'Reprogramar',
      rechazar: 'Rechazar con motivo',
    },
  },
  calendario: {
    titulo: 'Agosto 2026',
    escalas: ['Día', 'Semana', 'Mes'],
    diasSemana: ['L', 'M', 'M', 'J', 'V', 'S', 'D'],
    diasSemanaNombres: ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'],
    dias: construirDias(),
    totales: [
      { id: 'mes', valor: '318', etiqueta: 'Citas del mes', color: 'var(--b-azul)' },
      {
        id: 'presenciales',
        valor: '74',
        etiqueta: 'Presenciales',
        color: 'var(--b-petroleo-texto)',
      },
      { id: 'virtuales', valor: '96', etiqueta: 'Virtuales', color: 'var(--b-petroleo-texto)' },
      {
        id: 'domiciliarias',
        valor: '148',
        etiqueta: 'Domiciliarias',
        color: 'var(--b-petroleo-texto)',
      },
    ],
  },
  estados: {
    titulo: 'Estados de la cita',
    descripcion:
      'Se guardan estructurados, no como texto libre. Cambiarlos actualiza las cuatro vistas y dispara novedades y WhatsApp.',
    items: [
      { etiqueta: 'Solicitada', tono: 'amarillo' },
      { etiqueta: 'Pago pendiente', tono: 'amarillo' },
      { etiqueta: 'Pago confirmado', tono: 'verde' },
      { etiqueta: 'Pago rechazado', tono: 'rojo' },
      { etiqueta: 'Pendiente de asignación', tono: 'amarillo' },
      { etiqueta: 'Asignada', tono: 'azul' },
      { etiqueta: 'Confirmada', tono: 'verde' },
      { etiqueta: 'Profesional en camino', tono: 'petroleo' },
      { etiqueta: 'Paciente en espera', tono: 'petroleo' },
      { etiqueta: 'En atención', tono: 'petroleo' },
      { etiqueta: 'Finalizada', tono: 'verde' },
      { etiqueta: 'Cancelada', tono: 'rojo' },
      { etiqueta: 'Reprogramada', tono: 'amarillo' },
    ],
    perspectivasTitulo: 'Una cita, cuatro vistas',
    perspectivas: [
      { rol: 'Hospital', texto: 'Confirmada · Dra. Laura Gómez asignada', icono: 'membresias' },
      {
        rol: 'Profesional',
        texto: 'María Gómez · 10:00 a. m. · visita domiciliaria',
        icono: 'profesionales',
      },
      { rol: 'Paciente', texto: 'Próxima cita: 21 de agosto, 10:00 a. m.', icono: 'usuarios' },
      {
        rol: 'Cuidador',
        texto: 'Próxima cita de María: 21 de agosto, 10:00 a. m.',
        icono: 'usuarios',
      },
    ],
  },
};

/* ========================================================================== */
/* Superficie CONECTADA (TASK-HOSPITAL-CORE-02 §3.2)                          */
/* ========================================================================== */

/**
 * A partir de aquí vive la vista «Agenda y citas» ya conectada a la API.
 *
 * QUÉ CAMBIÓ. Todo lo anterior de este archivo —solicitudes nominales,
 * calendario de agosto de 2026, conteos, totales, estados de pago y las cuatro
 * perspectivas— es un fixture de fidelidad visual que `HospitalAgenda.tsx` YA NO
 * consume: la vista lee `GET /api/v1/hospital/agenda` y asigna con
 * `PATCH /api/v1/hospital/appointments/:id/assignment`. El fixture se conserva
 * intacto porque `hospitalDashboardOperacion.ts` —módulo `Inicio`, fuera del
 * alcance de esta corrección— sigue componiendo la vista de entrada con él.
 *
 * En consecuencia han desaparecido del runtime de Agenda, porque la plataforma
 * no los modela y publicarlos sería inventarlos:
 *
 * - nombres de personas demostrativas, direcciones y origen de la solicitud;
 * - estados y confirmaciones de pago;
 * - alertas clínicas asociadas a una solicitud;
 * - totales del mes, conteos por día inventados y el calendario de agosto;
 * - las perspectivas nominales de «Una cita, cuatro vistas».
 *
 * Lo que la vista publica procede EXCLUSIVAMENTE del DTO servido.
 */

/* -------------------------------------------------------------------------- */
/* Redacción determinista de fechas y horas                                   */
/* -------------------------------------------------------------------------- */

/**
 * Redacción de instantes SIN construir fechas.
 *
 * Estas funciones operan por corte de cadena sobre valores ISO-8601 en UTC que
 * ya sirvió el servidor. No leen el reloj, no cambian de zona horaria y no
 * infieren nada: la única transformación es reordenar caracteres. Por eso pueden
 * vivir fuera de `hospitalAgendaClient.ts`, que es el único punto autorizado a
 * construir un `Date` a partir de una entrada explícita.
 *
 * Marcar `UTC` no es un detalle técnico: sin la marca, una hora servida se
 * leería como hora local del dispositivo, que puede no ser la de la institución.
 */
export const HOSPITAL_MARCA_UTC = 'UTC';

/** `AAAA-MM-DD` → `DD/MM/AAAA`. Devuelve la entrada si no tiene esa forma. */
export function fechaLegible(valor: string): string {
  if (!/^\d{4}-\d{2}-\d{2}/u.test(valor)) {
    return valor;
  }

  return `${valor.slice(8, 10)}/${valor.slice(5, 7)}/${valor.slice(0, 4)}`;
}

/** Instante ISO-8601 → `DD/MM/AAAA, HH:MM UTC`. */
export function fechaHoraLegible(valor: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/u.test(valor)) {
    return valor;
  }

  return `${fechaLegible(valor)}, ${valor.slice(11, 16)} ${HOSPITAL_MARCA_UTC}`;
}

/** Ventana consultada, redactada como intervalo cerrado. */
export function ventanaLegible(desde: string, hasta: string): string {
  return desde === hasta
    ? fechaLegible(desde)
    : `${fechaLegible(desde)} – ${fechaLegible(hasta)}`;
}

/** Número de día de una fecha calendario, para la cuadrícula del calendario. */
export function diaDelMes(fecha: string): string {
  return /^\d{4}-\d{2}-\d{2}$/u.test(fecha) ? String(Number(fecha.slice(8, 10))) : fecha;
}

/* -------------------------------------------------------------------------- */
/* Copy de la vista conectada                                                  */
/* -------------------------------------------------------------------------- */

/** Escala del calendario, con la etiqueta visible de su identificador. */
export interface HospitalAgendaEscalaCopy {
  readonly id: HospitalAgendaEscala;
  readonly etiqueta: string;
}

/** Acción visible pero DESHABILITADA, con su ayuda accesible declarada. */
export interface HospitalAgendaAccionDeshabilitada {
  readonly id: string;
  readonly etiqueta: string;
  readonly ayuda: string;
  /**
   * Tratamiento visual de la acción en la referencia original.
   *
   * `rechazo` es la única que allí se dibuja con contorno rojo. Distinguirlas
   * recupera la agrupación reconocible de acciones SIN habilitar ninguna: las
   * dos siguen deshabilitadas, atenuadas y sin controlador, y su ayuda
   * accesible es la que declara que todavía no operan.
   */
  readonly variante: 'neutra' | 'rechazo';
}

/** Textos de cada desenlace de la consulta. Ninguno muestra datos previos. */
export interface HospitalAgendaEstadosTexto {
  readonly cargando: string;
  readonly vacio: string;
  readonly sinSesion: string;
  readonly sinPermiso: string;
  readonly noEncontrado: string;
  readonly consultaInvalida: string;
  readonly noDisponible: string;
  readonly error: string;
  readonly reintentar: string;
}

/** Textos de cada desenlace de la ÚNICA mutación del módulo. */
export interface HospitalAgendaAsignacionTexto {
  readonly exito: string;
  readonly conflictoVersion: string;
  readonly noAsignable: string;
  readonly datosInvalidos: string;
  readonly sinSesion: string;
  readonly sinPermiso: string;
  readonly noEncontrado: string;
  readonly noDisponible: string;
  readonly error: string;
  readonly incompleta: string;
  readonly enviando: string;
}

export interface HospitalAgendaCopy {
  readonly encabezado: HospitalVistaEncabezado;
  readonly controles: {
    readonly titulo: string;
    readonly etiquetaFecha: string;
    readonly ayudaFecha: string;
    readonly etiquetaEscala: string;
    readonly etiquetaVentana: string;
    readonly fechaInvalida: string;
  };
  readonly escalas: readonly HospitalAgendaEscalaCopy[];
  readonly solicitudes: {
    readonly titulo: string;
    readonly vacio: string;
    readonly resumen: string;
    readonly etiquetaProfesional: string;
    readonly opcionProfesional: string;
    readonly etiquetaFecha: string;
    readonly etiquetaHora: string;
    readonly etiquetaSolicitada: string;
    readonly asignar: string;
    readonly ayudaAsignar: string;
    readonly acciones: readonly HospitalAgendaAccionDeshabilitada[];
  };
  readonly calendario: {
    readonly titulo: string;
    readonly vacio: string;
    readonly etiquetaCuadricula: string;
    readonly sufijoCitas: string;
    readonly sufijoCita: string;
    readonly tituloTotales: string;
    readonly etiquetaTotal: string;
  };
  readonly citas: {
    readonly titulo: string;
    readonly vacio: string;
    readonly etiquetaLista: string;
    readonly sinHora: string;
  };
  readonly estados: HospitalAgendaEstadosTexto;
  readonly asignacion: HospitalAgendaAsignacionTexto;
  readonly nota: string;
}

/** Ayuda accesible común a toda acción que este slice no habilita. */
const AYUDA_ETAPA_POSTERIOR = 'Disponible en una etapa posterior.';

/** Copy de la vista conectada. No contiene ningún dato de ninguna persona. */
export const hospitalAgendaCore: HospitalAgendaCopy = {
  encabezado: {
    titulo: 'Agenda y citas',
    descripcion:
      'Solicitudes y citas registradas de esta institución en la ventana consultada. La agenda es una sola: cada rol la ve según sus permisos.',
  },
  controles: {
    titulo: 'Ventana de la agenda',
    etiquetaFecha: 'Fecha de referencia',
    ayudaFecha:
      'La ventana consultada se deriva de esta fecha y de la escala seleccionada. Cambiarla no modifica ninguna cita.',
    etiquetaEscala: 'Escala del calendario',
    etiquetaVentana: 'Ventana consultada',
    fechaInvalida: 'Indique una fecha de calendario válida para consultar la agenda.',
  },
  escalas: [
    { id: 'dia', etiqueta: 'Día' },
    { id: 'semana', etiqueta: 'Semana' },
    { id: 'mes', etiqueta: 'Mes' },
  ],
  solicitudes: {
    titulo: 'Solicitudes pendientes de asignación',
    vacio: 'No hay solicitudes pendientes de asignación en la ventana consultada.',
    resumen: 'solicitudes pendientes',
    etiquetaProfesional: 'Profesional asignado',
    opcionProfesional: 'Seleccione un profesional…',
    etiquetaFecha: 'Fecha de la cita',
    etiquetaHora: 'Hora de la cita',
    etiquetaSolicitada: 'Solicitada',
    asignar: 'Asignar',
    ayudaAsignar:
      'Requiere profesional, fecha y hora. Asignar registra la cita en el servidor.',
    acciones: [
      {
        id: 'reprogramar',
        etiqueta: 'Reprogramar',
        ayuda: AYUDA_ETAPA_POSTERIOR,
        variante: 'neutra',
      },
      {
        id: 'rechazar',
        etiqueta: 'Rechazar con motivo',
        ayuda: AYUDA_ETAPA_POSTERIOR,
        variante: 'rechazo',
      },
    ],
  },
  calendario: {
    titulo: 'Calendario de la ventana',
    vacio: 'Sin citas registradas en la ventana consultada.',
    etiquetaCuadricula: 'Citas registradas por día',
    sufijoCitas: 'citas',
    sufijoCita: 'cita',
    tituloTotales: 'Citas por modalidad',
    etiquetaTotal: 'Total de citas de la ventana',
  },
  citas: {
    titulo: 'Citas de la ventana',
    vacio: 'Sin citas registradas en la ventana consultada.',
    etiquetaLista: 'Citas registradas en la ventana consultada',
    sinHora: 'Sin hora registrada',
  },
  estados: {
    cargando: 'Consultando la agenda institucional…',
    vacio: 'La ventana consultada no registra solicitudes ni citas.',
    sinSesion: 'La sesión institucional no está vigente. Vuelva a abrirla para consultar.',
    sinPermiso: 'Esta sesión institucional no tiene acceso a la agenda hospitalaria.',
    noEncontrado: 'No fue posible encontrar la agenda solicitada.',
    consultaInvalida: 'La ventana solicitada no es válida. Revise la fecha y la escala.',
    noDisponible: 'El servicio no está disponible en este momento.',
    error: 'No fue posible completar la consulta.',
    reintentar: 'Reintentar',
  },
  asignacion: {
    exito: 'La solicitud quedó asignada y la agenda se actualizó.',
    conflictoVersion:
      'La solicitud cambió mientras se editaba. Se conservó lo indicado; vuelva a consultar la agenda antes de asignar.',
    noAsignable: 'La solicitud no admite esta asignación. Elija otro profesional u otra hora.',
    datosInvalidos:
      'El servidor rechazó los datos de la asignación. Revise profesional, fecha y hora.',
    sinSesion: 'La sesión institucional no está vigente. No se asignó nada.',
    sinPermiso: 'Esta sesión institucional no puede asignar citas. No se asignó nada.',
    noEncontrado: 'La solicitud ya no está disponible en esta institución.',
    noDisponible: 'El servicio no está disponible en este momento. No se asignó nada.',
    error: 'No fue posible completar la asignación.',
    incompleta: 'Indique profesional, fecha y hora válidas antes de asignar.',
    enviando: 'Asignando…',
  },
  nota: 'Agenda construida con los registros persistidos de esta institución. No confirma pagos, no evalúa disponibilidad, no detecta conflictos clínicos y no autoriza ninguna decisión clínica. La única operación habilitada es asignar una solicitud existente a un profesional existente.',
};

/* -------------------------------------------------------------------------- */
/* Estado de la consulta                                                       */
/* -------------------------------------------------------------------------- */

/** Estado de la vista, ya traducido desde el desenlace del cliente. */
export type HospitalAgendaEstado =
  | 'cargando'
  | 'listo'
  | 'sin-sesion'
  | 'sin-permiso'
  | 'no-encontrado'
  | 'consulta-invalida'
  | 'no-disponible'
  | 'error';

/**
 * Traduce el desenlace del cliente al estado de la vista.
 *
 * `cancelado` NO aparece: una consulta abortada por un cambio de ventana no es
 * un desenlace, y la vista debe conservar lo que ya está en pantalla hasta que
 * responda la consulta vigente.
 */
export function estadoDeDesenlaceAgenda(
  kind: Exclude<ResultadoOperaciones<unknown>['kind'], 'ok' | 'cancelado'>,
): HospitalAgendaEstado {
  return kind;
}

/** Texto del estado. Ninguno publica un dato servido previamente. */
export function textoDeEstadoAgenda(
  copy: HospitalAgendaEstadosTexto,
  estado: HospitalAgendaEstado,
): string {
  switch (estado) {
    case 'cargando':
      return copy.cargando;
    case 'listo':
      return '';
    case 'sin-sesion':
      return copy.sinSesion;
    case 'sin-permiso':
      return copy.sinPermiso;
    case 'no-encontrado':
      return copy.noEncontrado;
    case 'consulta-invalida':
      return copy.consultaInvalida;
    case 'no-disponible':
      return copy.noDisponible;
    case 'error':
    default:
      return copy.error;
  }
}

/**
 * `true` cuando reintentar puede cambiar el desenlace.
 *
 * Sin sesión y sin permiso NO lo ofrecen: repetir la consulta devolvería lo
 * mismo, y esta vista no abre sesión ni concede permisos.
 */
export function ofreceReintentoAgenda(estado: HospitalAgendaEstado): boolean {
  return estado === 'error' || estado === 'no-disponible' || estado === 'consulta-invalida';
}

/* -------------------------------------------------------------------------- */
/* Selección del formulario de asignación                                      */
/* -------------------------------------------------------------------------- */

/**
 * Selección local de una solicitud.
 *
 * Es exclusivamente lo que la persona escribió: ni el identificador de la
 * solicitud, ni su versión, ni ningún dato del paciente viven aquí.
 */
export interface HospitalAgendaSeleccion {
  readonly professionalId: string;
  readonly fecha: string;
  readonly hora: string;
}

export const HOSPITAL_AGENDA_SELECCION_VACIA: HospitalAgendaSeleccion = {
  professionalId: '',
  fecha: '',
  hora: '',
};

/**
 * Instante que la selección produce, o `null` si todavía no es asignable.
 *
 * Exige las tres piezas: sin profesional, sin fecha o sin hora válidas no se
 * envía nada. La conversión a instante la hace el cliente, que es el único
 * autorizado a construir fechas.
 */
export function instanteDeSeleccion(seleccion: HospitalAgendaSeleccion): string | null {
  if (seleccion.professionalId === '') {
    return null;
  }

  return instanteDeFechaHora(seleccion.fecha, seleccion.hora);
}

/** `true` cuando la selección está completa y no hay otro envío en curso. */
export function puedeAsignar(
  seleccion: HospitalAgendaSeleccion,
  enviando: string | null,
): boolean {
  return enviando === null && instanteDeSeleccion(seleccion) !== null;
}

/** Texto del desenlace de la asignación, incluido el éxito. */
export function textoDeAsignacion(
  copy: HospitalAgendaAsignacionTexto,
  kind: ResultadoAsignacion['kind'] | 'incompleta',
): string {
  switch (kind) {
    case 'ok':
      return copy.exito;
    case 'conflicto-version':
      return copy.conflictoVersion;
    case 'no-asignable':
      return copy.noAsignable;
    case 'datos-invalidos':
      return copy.datosInvalidos;
    case 'sin-sesion':
      return copy.sinSesion;
    case 'sin-permiso':
      return copy.sinPermiso;
    case 'no-encontrado':
      return copy.noEncontrado;
    case 'no-disponible':
      return copy.noDisponible;
    case 'incompleta':
      return copy.incompleta;
    case 'cancelado':
    case 'error':
    default:
      return copy.error;
  }
}

/**
 * `true` cuando la entrada de la persona debe CONSERVARSE tras el desenlace.
 *
 * Solo el éxito la limpia. Un `409` —o cualquier otro fallo— conserva lo
 * escrito: obligar a volver a teclear profesional, fecha y hora tras un
 * conflicto castiga a quien no cometió ningún error.
 */
export function conservaSeleccion(kind: ResultadoAsignacion['kind']): boolean {
  return kind !== 'ok';
}

/** Etiqueta visible de una modalidad de cita. */
export function etiquetaModalidad(modalidad: HospitalModalidadCita): string {
  return HOSPITAL_AGENDA_MODALIDADES[modalidad];
}

const HOSPITAL_AGENDA_MODALIDADES: Record<HospitalModalidadCita, string> = {
  ON_SITE: 'Presencial en sede',
  HOME: 'En domicilio',
  VIRTUAL: 'Virtual',
};

/**
 * Icono DECORATIVO de una modalidad servida
 * (HOSPITAL-VISUAL-RECOVERY-01-C, §2).
 *
 * Recupera el distintivo que la composición original coloca a la izquierda de
 * cada solicitud —casa, calendario y cámara— usando los MISMOS trazados que ya
 * viven en el módulo. No aporta ningún dato nuevo: la modalidad procede del DTO
 * y siempre se lee además como texto al lado, de modo que ningún estado se
 * comunica solo por icono ni solo por color.
 */
export function iconoDeModalidad(modalidad: HospitalModalidadCita): HospitalIconName {
  return HOSPITAL_AGENDA_ICONOS[modalidad];
}

const HOSPITAL_AGENDA_ICONOS: Record<HospitalModalidadCita, HospitalIconName> = {
  ON_SITE: 'agenda',
  HOME: 'visitas',
  VIRTUAL: 'virtuales',
};

/** Estado de una cita servida. NO es un estado de pago ni una alerta clínica. */
export function etiquetaEstadoCita(estado: HospitalCitaAgendaDto['status']): {
  readonly etiqueta: string;
  readonly tono: HospitalTonoId;
} {
  switch (estado) {
    case 'ASSIGNED':
      return { etiqueta: 'Asignada', tono: 'azul' };
    case 'CANCELLED':
      return { etiqueta: 'Cancelada', tono: 'rojo' };
    case 'REQUESTED':
    default:
      return { etiqueta: 'Solicitada', tono: 'amarillo' };
  }
}
