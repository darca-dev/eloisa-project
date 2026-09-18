import type { HospitalVistaEncabezado } from './hospitalAgendaConfig';
import type { HospitalTonoId } from './hospitalTonos';

/**
 * Copy y estructura visual de la vista «Profesionales», ya CONECTADA a la API
 * (TASK-HOSPITAL-CORE-02 §8.1; paquete final de corrección §2.1).
 *
 * QUÉ CAMBIÓ. Este archivo dejaba de ser un contrato visual y se había
 * convertido en la FUENTE de los datos: componía fichas de profesionales
 * derivando pacientes, agenda, disponibilidad, conflictos y calificaciones de
 * los fixtures de «Pacientes», «Visitas domiciliarias» y «Consultas virtuales».
 * Todo eso se retiró del runtime de Profesionales: la vista lee ahora
 * `GET /api/v1/hospital/professionals` y su detalle, y aquí solo queda copy,
 * catálogos controlados y estructura NO factual.
 *
 * En consecuencia han desaparecido de esta superficie, porque la plataforma no
 * los modela y publicarlos sería inventarlos:
 *
 * - zona, disponibilidad inferida, conflicto de agenda y calificación numérica;
 * - documentos, contrato, salario, honorarios, periodicidad y modalidad de
 *   cobro, que pasan a declararse `No disponible en este módulo`;
 * - la muestra de pacientes derivada de otras vistas, sustituida por las
 *   personas con asignación de cuidado ACTIVA que devuelve la API.
 *
 * Los fixtures de las otras vistas NO se borraron: siguen sirviendo a sus
 * propios módulos. Simplemente ya no los importa Profesionales.
 *
 * RECUPERACIÓN VISUAL (HOSPITAL-VISUAL-RECOVERY-01-B). La composición vuelve a
 * ser el DIRECTORIO DE TARJETAS de la referencia original, con la jerarquía
 * iniciales → nombre → profesión → estado del perfil. Recuperar la composición
 * no recupera sus cifras: las columnas del listado lineal desaparecen junto con
 * las métricas que la referencia pintaba en cada tarjeta —pacientes, visitas de
 * hoy, próxima cita y calificación—, porque son afirmaciones sobre una persona
 * que esta superficie no debe publicar. Lo que queda en la tarjeta es
 * exclusivamente identidad, profesión, estado del perfil y vínculo declarado, y
 * todo ello procede de la respuesta servida.
 *
 * Cuando un dato no está registrado se declara con copy de producto —`Sin
 * información registrada`, `Información no disponible`— y nunca con lenguaje
 * interno del proyecto.
 */

/* ========================================================================== */
/* Compatibilidad con «Administración institucional»                          */
/* ========================================================================== */

/**
 * Estados neutros para todo campo sin fuente. Ninguno afirma un dato: declaran
 * expresamente que el dato todavía no existe.
 *
 * Se conserva porque `hospitalAdministrationConfig.ts` lo consume; ese módulo
 * queda fuera del alcance de esta corrección y no debe cambiar.
 */
export const HOSPITAL_SIN_FUENTE = {
  porConfirmar: 'Por confirmar',
  noDisponible: 'No disponible en el prototipo',
  noAplica: 'No aplica',
  demostrativo: 'Dato demostrativo',
} as const;

export type HospitalDatoSinFuente = (typeof HOSPITAL_SIN_FUENTE)[keyof typeof HOSPITAL_SIN_FUENTE];

/** Modalidades de vinculación reconocidas por la interfaz institucional. */
export type HospitalVinculacionModalidad = 'empleado' | 'independiente' | 'convenio';

/* ========================================================================== */
/* Catálogos controlados                                                      */
/* ========================================================================== */

/**
 * Texto FIJO de ausencia de esta superficie.
 *
 * No es un valor vacío ni un cero: dice que el dato no está registrado. Es copy
 * de producto —sin lenguaje interno— y nunca una cifra: un cero junto al nombre
 * de una persona se leería como una afirmación sobre ella.
 */
export const HOSPITAL_PROFESIONALES_NO_DISPONIBLE = 'Sin información registrada';

/** Profesiones del catálogo controlado del SERVIDOR. No es un registro oficial. */
export const HOSPITAL_PROFESIONES: readonly {
  readonly code: string;
  readonly etiqueta: string;
}[] = [
  { code: 'MEDICINA_GENERAL', etiqueta: 'Medicina general' },
  { code: 'ENFERMERIA', etiqueta: 'Enfermería' },
  { code: 'FISIOTERAPIA', etiqueta: 'Fisioterapia' },
  { code: 'TERAPIA_OCUPACIONAL', etiqueta: 'Terapia ocupacional' },
  { code: 'PSICOLOGIA', etiqueta: 'Psicología' },
  { code: 'NUTRICION_Y_DIETETICA', etiqueta: 'Nutrición y dietética' },
  { code: 'TRABAJO_SOCIAL', etiqueta: 'Trabajo social' },
];

/**
 * Tipos de vínculo operativo DECLARADO.
 *
 * La etiqueta describe el vínculo declarado y nada más: no acredita relación
 * laboral, contrato, nómina, honorarios, habilitación ni documento verificado.
 */
export const HOSPITAL_TIPOS_VINCULO: readonly {
  readonly code: 'EMPLOYEE' | 'INDEPENDENT' | 'THIRD_PARTY';
  readonly etiqueta: string;
}[] = [
  { code: 'EMPLOYEE', etiqueta: 'Personal vinculado a la entidad' },
  { code: 'INDEPENDENT', etiqueta: 'Prestación de servicios' },
  { code: 'THIRD_PARTY', etiqueta: 'Tercero / convenio' },
];

/** Estado del PERFIL en la institución. NO es disponibilidad ni turno. */
export const HOSPITAL_ESTADOS_PERFIL: readonly {
  readonly code: 'ACTIVE' | 'INACTIVE';
  readonly etiqueta: string;
  readonly tono: HospitalTonoId;
}[] = [
  { code: 'ACTIVE', etiqueta: 'Perfil vigente', tono: 'verde' },
  { code: 'INACTIVE', etiqueta: 'Perfil no vigente', tono: 'amarillo' },
];

/** Estado del vínculo declarado. */
export const HOSPITAL_ESTADOS_VINCULO: readonly {
  readonly code: 'ACTIVE' | 'INACTIVE' | 'ENDED';
  readonly etiqueta: string;
}[] = [
  { code: 'ACTIVE', etiqueta: 'Vigente' },
  { code: 'INACTIVE', etiqueta: 'Suspendido' },
  { code: 'ENDED', etiqueta: 'Terminado' },
];

/** Modalidad de agenda de una cita. NO abre Visitas ni Consultas virtuales. */
export const HOSPITAL_MODALIDADES_CITA: readonly {
  readonly code: 'ON_SITE' | 'HOME' | 'VIRTUAL';
  readonly etiqueta: string;
  readonly tono: HospitalTonoId;
}[] = [
  { code: 'ON_SITE', etiqueta: 'Presencial en sede', tono: 'petroleo' },
  { code: 'HOME', etiqueta: 'En domicilio', tono: 'azul' },
  { code: 'VIRTUAL', etiqueta: 'Virtual', tono: 'verde' },
];

/* ========================================================================== */
/* Copy de la vista                                                           */
/* ========================================================================== */

/** Acción visible pero DESHABILITADA, con su ayuda accesible declarada. */
export interface HospitalAccionDeshabilitada {
  readonly etiqueta: string;
  readonly ayuda: string;
}

/** Textos de cada desenlace de la consulta. Ninguno muestra datos previos. */
export interface HospitalEstadosTexto {
  readonly cargando: string;
  readonly vacio: string;
  readonly sinResultados: string;
  readonly sinSesion: string;
  readonly sinPermiso: string;
  readonly noEncontrado: string;
  readonly consultaInvalida: string;
  readonly noDisponible: string;
  readonly error: string;
  readonly reintentar: string;
}

export interface HospitalProfessionalsCopy {
  readonly encabezado: HospitalVistaEncabezado;
  readonly busqueda: {
    readonly etiqueta: string;
    readonly ayuda: string;
    readonly limpiar: string;
  };
  readonly filtros: {
    readonly profesion: string;
    readonly vinculo: string;
    readonly estado: string;
  };
  readonly opcionTodas: string;
  readonly accionVer: string;
  readonly listaTitulo: string;
  readonly resumen: string;
  readonly paginacion: {
    readonly etiqueta: string;
    readonly anterior: string;
    readonly siguiente: string;
  };
  readonly estados: HospitalEstadosTexto;
  readonly panel: {
    readonly cerrar: string;
    readonly sinHora: string;
    readonly tituloAcciones: string;
    readonly tituloPacientes: string;
    readonly vacioPacientes: string;
    readonly notaPacientes: string;
    readonly tituloAgenda: string;
    readonly vacioAgenda: string;
    readonly etiquetaVentana: string;
    readonly tituloVinculo: string;
    readonly sinVinculo: string;
    readonly etiquetaTipo: string;
    readonly etiquetaEstadoVinculo: string;
    readonly etiquetaInicio: string;
    readonly etiquetaFin: string;
    readonly tituloNoModelado: string;
    readonly noModelados: readonly string[];
    readonly acciones: readonly HospitalAccionDeshabilitada[];
  };
  readonly nota: string;
}

/** Ayuda accesible común a toda acción que este slice no habilita. */
const AYUDA_ETAPA_POSTERIOR = 'Disponible en una etapa posterior.';

/** Copy de la vista conectada. No contiene ningún dato de ninguna persona. */
export const hospitalProfesionalesCore: HospitalProfessionalsCopy = {
  encabezado: {
    titulo: 'Profesionales en salud',
    descripcion: 'Equipo registrado de la institución y su actividad agendada.',
  },
  busqueda: {
    etiqueta: 'Buscar profesional',
    ayuda: 'Busca por nombre dentro del equipo registrado de esta institución.',
    limpiar: 'Limpiar búsqueda y filtros',
  },
  filtros: {
    profesion: 'Profesión',
    vinculo: 'Tipo de vinculación',
    estado: 'Estado del perfil',
  },
  opcionTodas: 'Todas',
  accionVer: 'Ver detalle',
  listaTitulo: 'Equipo de profesionales',
  resumen: 'profesionales',
  paginacion: {
    etiqueta: 'Paginación del directorio',
    anterior: 'Página anterior',
    siguiente: 'Página siguiente',
  },
  estados: {
    cargando: 'Consultando el directorio de profesionales…',
    vacio: 'Esta institución todavía no tiene profesionales registrados.',
    sinResultados: 'Ningún profesional coincide con la búsqueda o los filtros aplicados.',
    sinSesion: 'La sesión institucional no está vigente. Vuelva a abrirla para consultar.',
    sinPermiso: 'Esta sesión institucional no tiene acceso a la agenda hospitalaria.',
    noEncontrado: 'No fue posible encontrar el profesional indicado.',
    consultaInvalida: 'La consulta no es válida. Revise la búsqueda y los filtros.',
    noDisponible: 'El servicio no está disponible en este momento.',
    error: 'No fue posible completar la consulta.',
    reintentar: 'Reintentar',
  },
  panel: {
    cerrar: 'Cerrar detalle del profesional',
    sinHora: 'Sin hora registrada',
    tituloAcciones: 'Acciones no disponibles por ahora',
    tituloPacientes: 'Pacientes a cargo',
    vacioPacientes: 'Este profesional no tiene asignaciones de cuidado activas.',
    notaPacientes:
      'Personas con asignación de cuidado ACTIVA. Aparecer aquí no acredita necesidad individual de conocer ni concede acceso a información clínica.',
    tituloAgenda: 'Agenda del profesional',
    vacioAgenda: 'Sin citas registradas en la ventana consultada.',
    etiquetaVentana: 'Ventana consultada',
    tituloVinculo: 'Vinculación',
    sinVinculo: 'Sin vínculo vigente registrado.',
    etiquetaTipo: 'Tipo de vínculo declarado',
    etiquetaEstadoVinculo: 'Estado del vínculo',
    etiquetaInicio: 'Inicio declarado',
    etiquetaFin: 'Fin declarado',
    tituloNoModelado: 'Información no disponible',
    noModelados: [
      'Documentos y soportes profesionales',
      'Contrato, nómina, honorarios y periodicidad',
    ],
    acciones: [
      { etiqueta: 'Asignar nueva visita', ayuda: AYUDA_ETAPA_POSTERIOR },
      { etiqueta: 'Reprogramar', ayuda: AYUDA_ETAPA_POSTERIOR },
      { etiqueta: 'Cambiar modalidad', ayuda: AYUDA_ETAPA_POSTERIOR },
      { etiqueta: 'Cancelar', ayuda: AYUDA_ETAPA_POSTERIOR },
    ],
  },
  nota: 'Directorio construido con los registros de esta institución. No acredita habilitación, contrato ni pago, no afirma disponibilidad y no autoriza ninguna decisión clínica.',
};
