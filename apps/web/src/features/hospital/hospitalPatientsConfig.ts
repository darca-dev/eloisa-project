import { branding } from '@/config/branding';

import type { HospitalVistaEncabezado } from './hospitalAgendaConfig';
import type { HospitalTonoId } from './hospitalTonos';

/**
 * Contrato tipado y fixtures de la vista «Pacientes» (TASK-003H-03, FR-03).
 *
 * Fuente visual vinculante: `prototype-claude/Eligeme-Hospital.dc.html`,
 * vista `vPacientes` (líneas 297–359) y sus datos demostrativos
 * (líneas 1514–1538).
 *
 * Alcance: presentación. Es una ficha demostrativa de fidelidad visual, NO una
 * Historia Clínica Electrónica, no define expediente productivo y no valida ni
 * ejecuta reglas, diagnósticos, rangos, medicamentos ni decisiones clínicas. El
 * estado de semáforo mostrado es un literal de la referencia: no se deriva de
 * los datos ni se recalcula. Los datos son ficticios pero representativos de
 * información sensible de salud y no deben sustituirse por datos reales.
 */

/** Par etiqueta/valor de los datos operativos y de contacto. */
export interface HospitalPacienteDato {
  readonly etiqueta: string;
  readonly valor: string;
}

/** Evento del historial, con hora, descripción, origen y estado textual. */
export interface HospitalPacienteEvento {
  readonly id: string;
  readonly hora: string;
  readonly texto: string;
  readonly origen: string;
  readonly estado: string;
  readonly tono: HospitalTonoId;
}

/** Día del historial con sus eventos, en el orden de la referencia. */
export interface HospitalPacienteDiaHistorial {
  readonly fecha: string;
  readonly eventos: readonly HospitalPacienteEvento[];
}

export interface HospitalPacienteFicha {
  readonly iniciales: string;
  readonly nombre: string;
  /** Línea única `edad · identificación · EPS · municipio` de la referencia. */
  readonly meta: string;
  /** Estado de semáforo tal como lo escribe la referencia; no se calcula. */
  readonly semaforo: {
    readonly etiqueta: string;
    readonly tono: HospitalTonoId;
  };
  readonly condiciones: readonly string[];
  readonly datos: readonly HospitalPacienteDato[];
}

export interface HospitalPacientesConfig {
  readonly encabezado: HospitalVistaEncabezado;
  readonly ficha: HospitalPacienteFicha;
  readonly historial: {
    readonly titulo: string;
    readonly nota: string;
    readonly dias: readonly HospitalPacienteDiaHistorial[];
  };
}

/** Configuración demostrativa completa de la vista «Pacientes». */
export const hospitalPacientesDemo: HospitalPacientesConfig = {
  encabezado: {
    titulo: 'Pacientes',
    descripcion:
      'Un solo expediente por persona. Cada interfaz muestra una parte del mismo expediente según permisos: no existen historias paralelas.',
  },
  ficha: {
    iniciales: 'MG',
    nombre: 'María Gómez Osorio',
    meta: '76 años · CC 24.556.812 · Nueva EPS · Soacha',
    semaforo: {
      etiqueta: 'Amarillo · requiere seguimiento',
      tono: 'amarillo',
    },
    condiciones: ['Mayor de 60 años', 'Persona con discapacidad', 'Requiere cuidados en casa'],
    datos: [
      { etiqueta: 'DIRECCIÓN', valor: 'Cra 45 # 32-16, La Esperanza, Soacha' },
      {
        etiqueta: 'CÓMO LLEGAR',
        valor: 'Casa azul detrás de la iglesia, entrada por el andén del costado',
      },
      { etiqueta: 'TELÉFONO', valor: '310 445 8821' },
      { etiqueta: 'CUIDADORA', valor: 'Ana López (hija) · 312 887 4410' },
      { etiqueta: 'CONTACTO CERCANO', valor: 'Rosa Marín (vecina) · 320 551 7788' },
      { etiqueta: 'PROFESIONAL ASIGNADO', valor: 'Dra. Laura Gómez · medicina' },
    ],
  },
  historial: {
    titulo: 'Historial clínico',
    nota: 'Línea de tiempo única. Nada se borra al actualizar: queda la trazabilidad',
    dias: [
      {
        fecha: '15 de agosto',
        eventos: [
          {
            id: '15-0742',
            hora: '7:42 a',
            texto: 'Bitácora registrada con presión 155/90',
            origen: 'Cuidadora Ana López · origen CUIDADOR',
            estado: 'Amarillo',
            tono: 'amarillo',
          },
          {
            id: '15-0743',
            hora: '7:43 a',
            texto: 'Alerta amarilla generada por el motor de reglas',
            origen: 'Sistema · rango configurado por el visitador',
            estado: 'Alerta',
            tono: 'amarillo',
          },
        ],
      },
      {
        fecha: '16 de agosto',
        eventos: [
          {
            id: '16-0910',
            hora: '9:10 a',
            texto: 'Profesional revisa la alerta y solicita visita',
            origen: 'Dra. Laura Gómez · origen PROFESIONAL',
            estado: 'En revisión',
            tono: 'azul',
          },
          {
            id: '16-1006',
            hora: '10:06 a',
            texto: 'Visita domiciliaria realizada · presión 128/80',
            origen: 'Dra. Laura Gómez · visita firmada',
            estado: 'Finalizada',
            tono: 'verde',
          },
          {
            id: '16-1048',
            hora: '10:48 a',
            texto: 'Medicamento ajustado y nueva indicación registrada',
            origen: 'Dra. Laura Gómez · queda en el registro clínico',
            estado: 'Vigente',
            tono: 'azul',
          },
          {
            id: '16-1052',
            hora: '10:52 a',
            texto: 'Se activó la calificación en paciente y cuidador',
            origen: 'Sistema · una evaluación por usuario autorizado',
            estado: 'Activada',
            tono: 'petroleo',
          },
        ],
      },
      {
        fecha: '17 de agosto',
        eventos: [
          {
            id: '17-0730',
            hora: '7:30 a',
            texto: 'Bitácora registrada por la paciente · valor dentro de rango',
            origen: 'María Gómez · origen PACIENTE',
            estado: 'Verde',
            tono: 'verde',
          },
          {
            id: '17-0731',
            hora: '7:31 a',
            texto: 'Seguimiento de la alerta cerrado',
            origen: 'Sistema · trazabilidad conservada',
            estado: 'Cerrada',
            tono: 'verde',
          },
        ],
      },
    ],
  },
};

/* ========================================================================== */
/* TASK-003H-03B — Textos de la vista de segmentación poblacional             */
/* ========================================================================== */

/**
 * Textos visibles de «Pacientes, segmentación y analítica poblacional».
 *
 * TASK-003H-03B amplía y sustituye la sección Pacientes de TASK-003H-03: la
 * vista deja de ser una ficha única y pasa a ser un listado compacto con
 * filtros combinables, analítica poblacional y panel de detalle. Los fixtures
 * anteriores permanecen en este archivo porque otras vistas ya aprobadas los
 * consumen; la vista no los monta.
 *
 * Marca visible: exclusivamente ELÍGEME. Ningún texto de esta configuración
 * nombra la terminología interna del proyecto.
 */

/** Columna del listado compacto. */
export interface HospitalPoblacionColumna {
  readonly id: string;
  readonly etiqueta: string;
  /** Solo para lectores de pantalla: la columna de acción no lleva rótulo. */
  readonly soloLectores?: boolean;
}

export interface HospitalPoblacionConfig {
  readonly encabezado: HospitalVistaEncabezado;
  readonly badgeDatos: string;
  readonly avisoHistoria: string;
  readonly avisoAlcaldia: string;
  readonly nota: string;
  readonly columnas: readonly HospitalPoblacionColumna[];
}

/** Columnas vinculantes del listado (TASK-003H-03B, §4.1, punto 6). */
export const HOSPITAL_POBLACION_COLUMNAS: readonly HospitalPoblacionColumna[] = [
  { id: 'paciente', etiqueta: 'Paciente' },
  { id: 'edad', etiqueta: 'Edad' },
  { id: 'eps', etiqueta: 'EPS' },
  { id: 'prioridades', etiqueta: 'Prioridades' },
  { id: 'condicion', etiqueta: 'Condición principal' },
  { id: 'profesional', etiqueta: 'Profesional' },
  { id: 'cuidador', etiqueta: 'Cuidador' },
  { id: 'programa', etiqueta: 'Programa' },
  { id: 'zona', etiqueta: 'Zona/municipio' },
  { id: 'estado', etiqueta: 'Estado' },
  { id: 'semaforo', etiqueta: 'Semáforo' },
  { id: 'accion', etiqueta: 'Detalle del paciente', soloLectores: true },
];

/**
 * Aviso de la sección de salud del panel. El nombre visible procede del
 * branding ya centralizado (`src/config/branding.ts`): esta vista no repite
 * ningún literal de marca.
 */
export const HOSPITAL_POBLACION_AVISO_HISTORIA = `Información autorizada; ${branding.platformDisplayName} no reemplaza la historia clínica`;

/* ========================================================================== */
/* TASK-HOSPITAL-CORE-01 — Textos de la vista conectada a CORE-01             */
/* ========================================================================== */

/**
 * Texto ÚNICO de un dominio que CORE-01 no modela (§4.3).
 *
 * Es deliberadamente distinto de `Sin asignar`, de un cero y de un porcentaje.
 * La diferencia importa: `Sin asignar` afirmaría que se comprobó y no hay nadie
 * asignado, y un cero afirmaría una medición. CORE-01 no contiene cuidadores,
 * profesionales, programas, condiciones, atenciones ni alertas, de modo que la
 * plataforma NO PUEDE distinguir «no tiene» de «no está modelado». Decirlo así
 * es la única lectura honesta.
 */
export const HOSPITAL_POBLACION_NO_DISPONIBLE = 'Información no disponible';

/**
 * Ayuda accesible de un control que la composición aprobada conserva pero que
 * todavía no puede operar (§4.3).
 *
 * El control permanece VISIBLE y deshabilitado, con esta explicación asociada:
 * ocultarlo escondería una capacidad prevista del diseño; habilitarlo prometería
 * un filtrado que no existe.
 */
export const HOSPITAL_POBLACION_AYUDA_DESHABILITADO =
  'Disponible cuando el módulo correspondiente esté conectado';

/**
 * Procedencia REAL de las cifras.
 *
 * Sustituye al badge `Datos demostrativos` únicamente en esta vista. Declara que
 * el dato proviene de los registros persistidos de la propia plataforma: NO es
 * una estadística oficial, no procede de ninguna EPS, de ADRES ni de ninguna
 * historia clínica, y no acredita el cumplimiento de ninguna obligación.
 */
export const HOSPITAL_POBLACION_PROCEDENCIA = 'Registros ELOISA';

/** Estados de la vista conectada. Ninguno sustituye datos por fixtures. */
export const HOSPITAL_POBLACION_ESTADOS = {
  cargando: 'Consultando pacientes…',
  vacio: 'Todavía no hay pacientes registrados en esta institución.',
  sinResultados: 'Sin resultados para los filtros aplicados. Los filtros se conservan.',
  sinSesion: 'Sesión institucional requerida',
  sinSesionDetalle:
    'No hay una sesión institucional vigente. No se muestra ninguna información de pacientes.',
  sinPermiso: 'Sin permiso para consultar pacientes',
  sinPermisoDetalle:
    'La identidad institucional de esta sesión no tiene acceso a la consulta de pacientes.',
  error: 'No fue posible consultar los pacientes.',
  errorDetalle:
    'La consulta no pudo completarse. No se muestran cifras anteriores ni datos de demostración.',
  detalleAusente:
    'El registro seleccionado ya no está disponible en esta institución.',
  reintentar: 'Reintentar',
} as const;

/**
 * Nota al pie de la vista conectada.
 *
 * Sustituye a la nota demostrativa: ya no hay condiciones registradas ni
 * semáforo que matizar, porque esos dominios no existen en esta fuente.
 */
export const HOSPITAL_POBLACION_NOTA_CORE =
  'Las cifras proceden de los registros persistidos de esta institución. La discapacidad y el cuidado en casa son datos DECLARADOS por la persona en su inscripción: no son diagnósticos, certificaciones oficiales ni valoraciones clínicas. Los módulos de condiciones, profesionales, cuidadores, programas, agenda y alertas no están conectados y por eso aparecen como no disponibles.';

/** Configuración demostrativa de la vista de población. */
export const hospitalPoblacionDemo: HospitalPoblacionConfig = {
  encabezado: {
    titulo: 'Pacientes',
    descripcion: 'Gestión y segmentación de población atendida',
  },
  badgeDatos: 'Datos demostrativos',
  avisoHistoria: HOSPITAL_POBLACION_AVISO_HISTORIA,
  avisoAlcaldia:
    'La Alcaldía no consume este listado ni esta ficha: su salida autorizada es únicamente información agregada.',
  nota: 'Las condiciones registradas son información autorizada con procedencia, no un diagnóstico automático. El semáforo es un estado ya registrado: no se calcula aquí y no constituye una regla clínica.',
  columnas: HOSPITAL_POBLACION_COLUMNAS,
};

/**
 * Configuración de la vista CONECTADA a CORE-01.
 *
 * Conserva la composición, el encabezado y las columnas aprobadas, y cambia
 * exclusivamente lo que la fuente real obliga a cambiar: la procedencia deja de
 * ser demostrativa y la nota deja de hablar de dominios que no existen.
 */
export const hospitalPoblacionCore: HospitalPoblacionConfig = {
  ...hospitalPoblacionDemo,
  badgeDatos: HOSPITAL_POBLACION_PROCEDENCIA,
  nota: HOSPITAL_POBLACION_NOTA_CORE,
};
