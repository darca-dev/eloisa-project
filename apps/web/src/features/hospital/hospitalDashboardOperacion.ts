import { hospitalAgendaDemo } from './hospitalAgendaConfig';
import { hospitalAlertsDemo } from './hospitalAlertsConfig';
import { HOSPITAL_NAV_ITEMS } from './hospitalConfig';
import { hospitalKpisDemo } from './hospitalDashboardConfig';
import type {
  HospitalAccesoDirecto,
  HospitalAccionRapida,
  HospitalAgendaProximaFila,
  HospitalAlarmaRecienteFila,
  HospitalAtencionItem,
  HospitalInicioConfig,
  HospitalProfesionalConteo,
} from './hospitalDashboardConfig';
import { hospitalVirtualesDemo } from './hospitalVirtualConfig';
import { hospitalVisitasDemo } from './hospitalVisitsConfig';
import { destinoDeItem } from './hospitalViews';

/**
 * Selectores de composición de la vista `Inicio` del Hospital
 * (TASK-003H-02B, FR-03 a FR-08 y FR-10).
 *
 * Inicio no tiene datos propios: cada sección se compone aquí, con funciones
 * puras, a partir de los fixtures Hospital que ya existen —Agenda, Semáforo de
 * alarmas, Visitas domiciliarias, Consultas virtuales y los KPI de
 * TASK-003H-02—. Así no hay una segunda copia que pueda divergir de las vistas
 * destino y, cuando estos fixtures se sustituyan por consultas autorizadas,
 * solo cambia el origen: los componentes de presentación no se tocan.
 *
 * Alcance: presentación. No hay red, persistencia, estado global, cálculo de
 * totales ni reconciliación. El orden de las filas es el orden en que los
 * fixtures ya están escritos, no una priorización clínica: no se evalúan
 * rangos, no se generan alarmas, no se calcula disponibilidad, no se infiere
 * urgencia y no se produce ninguna recomendación. Los textos de severidad,
 * estado y antigüedad son literales del fixture de origen.
 *
 * Los datos son ficticios y demostrativos. No son historia clínica, indicador
 * oficial, evidencia institucional ni información de una persona real.
 */

/** Nivel textual que el fixture del semáforo escribe para una alarma roja. */
const NIVEL_ROJO = 'ROJA';
/** Nivel textual que el fixture del semáforo escribe para una alarma amarilla. */
const NIVEL_AMARILLO = 'AMARILLA';
/** Texto exacto con que los fixtures declaran que no hay profesional. */
const SIN_ASIGNAR = 'Sin asignar';
/** Estado con que `Consultas virtuales` declara que el paciente ya espera. */
const ESTADO_EN_ESPERA = 'Paciente en espera';

/**
 * Máximo de filas por tipo de situación en `Necesita atención ahora`.
 *
 * Es un límite de densidad de la pantalla, no un criterio clínico: recorta
 * cuántas filas se dibujan, nunca qué es importante. La nota de la sección lo
 * declara de forma visible para que nadie lea la lista como si fuera completa.
 */
const MAXIMO_POR_TIPO = 2;

/** Filas visibles de `Alarmas recientes` (FR-06.1: entre 3 y 4). */
const MAXIMO_ALARMAS_RECIENTES = 4;

/**
 * Texto de estado de una alarma según su tono.
 *
 * Se toma del resumen del propio semáforo (`Rojas · requieren atención`,
 * `Amarillas · requieren seguimiento`), quedándose con el tramo posterior al
 * separador. No se inventa un estado de flujo de trabajo ni se afirma que
 * alguien la haya atendido, escalado o cerrado.
 */
const ESTADO_POR_TONO: Readonly<Record<string, string>> = Object.fromEntries(
  hospitalAlertsDemo.resumen.map((fila) => [fila.tono, fila.etiqueta.split('· ')[1] ?? fila.etiqueta]),
);

function estadoDeAlarma(tono: string): string {
  return ESTADO_POR_TONO[tono] ?? '';
}

/* --------------------------- Necesita atención ahora ---------------------- */

/** Alarmas del semáforo con el nivel textual indicado, ya limitadas. */
function alarmasDeNivel(nivel: string): readonly HospitalAtencionItem[] {
  return hospitalAlertsDemo.bandeja.items
    .filter((alarma) => alarma.nivel === nivel)
    .slice(0, MAXIMO_POR_TIPO)
    .map((alarma) => ({
      id: `alarma-${alarma.id}`,
      severidad: `Alarma ${alarma.nivel.toLowerCase()}`,
      titulo: alarma.paciente,
      contexto: alarma.motivo,
      prioridad: alarma.cuando,
      tono: alarma.tono,
      accion: {
        etiqueta: alarma.nivel === NIVEL_ROJO ? 'Ver' : 'Revisar',
        destino: {
          vista: 'alarmas' as const,
          intencion: alarma.nivel === NIVEL_ROJO ? ('rojas' as const) : ('amarillas' as const),
        },
        detalleAccesible: `la alarma de ${alarma.paciente} en Semáforo de alarmas`,
      },
    }));
}

/**
 * Solicitudes que la Agenda ya agrupa bajo «Solicitudes pendientes de
 * asignación»: por definición del propio fixture no tienen profesional.
 */
function casosSinProfesional(): readonly HospitalAtencionItem[] {
  return hospitalAgendaDemo.solicitudes.items.slice(0, MAXIMO_POR_TIPO).map((solicitud) => ({
    id: `solicitud-${solicitud.id}`,
    severidad: 'Sin profesional',
    titulo: solicitud.paciente,
    contexto: `${solicitud.tipo} · solicitado por ${solicitud.origen}`,
    prioridad: `Solicitada ${solicitud.cuando}`,
    tono: solicitud.tono,
    accion: {
      etiqueta: 'Asignar',
      destino: { vista: 'agenda' as const, intencion: 'pendientes-asignacion' as const },
      detalleAccesible: `la solicitud de ${solicitud.paciente} en Agenda y citas`,
    },
  }));
}

/** Consultas virtuales cuyo estado escrito en el fixture es `Paciente en espera`. */
function pacientesEnEsperaVirtual(): readonly HospitalAtencionItem[] {
  return hospitalVirtualesDemo.consultas
    .filter((consulta) => consulta.estado === ESTADO_EN_ESPERA)
    .slice(0, MAXIMO_POR_TIPO)
    .map((consulta) => ({
      id: `virtual-${consulta.id}`,
      severidad: consulta.estado,
      titulo: consulta.paciente,
      contexto: `Consulta virtual con ${consulta.profesional}`,
      prioridad: `Programada ${consulta.hora}`,
      tono: consulta.tono,
      accion: {
        etiqueta: 'Abrir cola',
        destino: { vista: 'virtuales' as const, intencion: 'en-espera' as const },
        detalleAccesible: `la cola de Consultas virtuales de ${consulta.paciente}`,
      },
    }));
}

/**
 * Situaciones que Inicio muestra como prioritarias, en el orden de presentación
 * de los fixtures: alarmas rojas, alarmas amarillas, casos sin profesional y
 * pacientes esperando consulta virtual.
 */
export function componerAtencion(): readonly HospitalAtencionItem[] {
  return [
    ...alarmasDeNivel(NIVEL_ROJO),
    ...alarmasDeNivel(NIVEL_AMARILLO),
    ...casosSinProfesional(),
    ...pacientesEnEsperaVirtual(),
  ];
}

/* -------------------------------- Agenda próxima -------------------------- */

/** Origen de una fila de `Agenda próxima` dentro de un fixture ya existente. */
interface OrigenAgendaProxima {
  readonly fuente: 'visitas' | 'virtuales';
  /** Identificador de la fila en su fixture de origen. */
  readonly id: string;
  /** Modalidad legible; el fixture de origen la expresa por su tipo de vista. */
  readonly modalidad: string;
}

/**
 * Composición de `Agenda próxima` (FR-05.5).
 *
 * Los fixtures existentes no contienen una agenda homogénea con hora, paciente,
 * modalidad y profesional en una sola estructura, así que Inicio referencia
 * filas concretas de Visitas domiciliarias y de Consultas virtuales por su
 * identificador. Los valores no se copian: se leen del fixture de origen, de
 * modo que no puede aparecer una divergencia con la vista destino.
 */
const AGENDA_PROXIMA_ORIGEN: readonly OrigenAgendaProxima[] = [
  { fuente: 'visitas', id: '17-1000', modalidad: 'Visita domiciliaria' },
  { fuente: 'visitas', id: '17-1100', modalidad: 'Visita domiciliaria' },
  { fuente: 'virtuales', id: '1130', modalidad: 'Consulta virtual' },
  { fuente: 'visitas', id: '17-1400', modalidad: 'Visita domiciliaria' },
  { fuente: 'virtuales', id: '1515', modalidad: 'Consulta virtual' },
];

/** Hora de una visita: el tramo posterior al separador de `17 ago · 10:00`. */
function horaDeVisita(fecha: string): string {
  return fecha.split('· ')[1] ?? fecha;
}

export function componerAgendaProxima(): readonly HospitalAgendaProximaFila[] {
  return AGENDA_PROXIMA_ORIGEN.flatMap((origen) => {
    const fila =
      origen.fuente === 'visitas'
        ? hospitalVisitasDemo.visitas.find((visita) => visita.id === origen.id)
        : hospitalVirtualesDemo.consultas.find((consulta) => consulta.id === origen.id);

    if (fila === undefined) {
      return [];
    }

    const hora = 'fecha' in fila ? horaDeVisita(fila.fecha) : fila.hora;

    return [
      {
        id: `${origen.fuente}-${origen.id}`,
        hora,
        paciente: fila.paciente,
        modalidad: origen.modalidad,
        profesional: fila.profesional,
        sinAsignar: fila.profesional === SIN_ASIGNAR,
      },
    ];
  });
}

/* ------------------------------ Alarmas recientes ------------------------- */

export function componerAlarmasRecientes(): readonly HospitalAlarmaRecienteFila[] {
  return hospitalAlertsDemo.bandeja.items.slice(0, MAXIMO_ALARMAS_RECIENTES).map((alarma) => ({
    id: alarma.id,
    severidad: alarma.nivel,
    paciente: alarma.paciente,
    motivo: alarma.motivo,
    cuando: alarma.cuando,
    estado: estadoDeAlarma(alarma.tono),
    tono: alarma.tono,
    accion: {
      etiqueta: alarma.nivel === NIVEL_ROJO ? 'Ver' : 'Revisar',
      destino: {
        vista: 'alarmas' as const,
        intencion: alarma.nivel === NIVEL_ROJO ? ('rojas' as const) : ('amarillas' as const),
      },
      detalleAccesible: `la alarma de ${alarma.paciente} en Semáforo de alarmas`,
    },
  }));
}

/* --------------------------- Resumen de profesionales --------------------- */

/**
 * Resumen de profesionales (FR-07): reutiliza literalmente el desglose de la
 * tarjeta `PROFESIONALES EN TURNO` aprobada en TASK-003H-02, en vez de repetir
 * los valores. No calcula disponibilidad, no asigna turnos y no cambia estados.
 */
export function componerProfesionales(): readonly HospitalProfesionalConteo[] {
  const kpi = hospitalKpisDemo.find((tarjeta) => tarjeta.id === 'profesionales-turno');

  return (kpi?.breakdown ?? []).map((fila) => ({
    id: fila.label,
    etiqueta: fila.label,
    valor: fila.value,
  }));
}

/* ---------------------------------- Ir a ---------------------------------- */

/**
 * Accesos de la sección `Ir a` (FR-08): se derivan del mismo menú del shell,
 * en su mismo orden y con sus mismos identificadores, etiquetas e iconos. No
 * existe un segundo mapa de navegación que pueda divergir del sidebar, y la
 * disponibilidad es exactamente la misma verdad funcional que resuelve
 * `destinoDeItem`: un módulo sin vista implementada se muestra, pero no navega.
 * TASK-003H-05 no cambia esta sección: al existir la vista administrativa,
 * `Membresías y servicios` y `Configuración` pasan a tener destino por la misma
 * regla que ya usaba el sidebar, y `Reportes` sigue sin módulo.
 */
export function componerAccesos(): readonly HospitalAccesoDirecto[] {
  return HOSPITAL_NAV_ITEMS.filter((item) => item.id !== 'inicio').map((item) => ({
    id: item.id,
    etiqueta: item.etiqueta,
    icono: item.icono,
    destino: destinoDeItem(item.id),
  }));
}

/* ------------------------------ Acciones rápidas -------------------------- */

/**
 * Acciones rápidas (FR-04). Cada control abre un módulo dentro del shell: no
 * crea citas, no busca, no asigna, no programa y no registra novedades. El
 * rótulo expresa la intención de acceso, nunca una operación ejecutada.
 *
 * `Buscar paciente` solo abre `Pacientes`: esa vista no expone hoy un control
 * de búsqueda reutilizable al que enfocar, y esta tarea no autoriza crear uno.
 */
export const HOSPITAL_ACCIONES_RAPIDAS: readonly HospitalAccionRapida[] = [
  {
    id: 'nueva-cita',
    etiqueta: 'Nueva cita',
    icono: 'agenda',
    destino: { vista: 'agenda' },
    detalle: 'Abre Agenda y citas',
  },
  {
    id: 'buscar-paciente',
    etiqueta: 'Buscar paciente',
    icono: 'buscar',
    destino: { vista: 'pacientes' },
    detalle: 'Abre Pacientes',
  },
  {
    id: 'asignar-profesional',
    etiqueta: 'Asignar profesional',
    icono: 'profesionales',
    destino: { vista: 'agenda', intencion: 'pendientes-asignacion' },
    detalle: 'Abre Agenda con la intención de pendientes de asignación',
  },
  {
    id: 'programar-visita',
    etiqueta: 'Programar visita',
    icono: 'visitas',
    destino: { vista: 'visitas' },
    detalle: 'Abre Visitas domiciliarias',
  },
  {
    id: 'crear-novedad',
    etiqueta: 'Crear novedad',
    icono: 'novedades',
    destino: { vista: 'novedades' },
    detalle: 'Abre Novedades',
  },
];

/* ------------------------------ Composición final ------------------------- */

/** Configuración demostrativa completa del centro de control de Inicio. */
export const hospitalInicioDemo: HospitalInicioConfig = {
  atencion: {
    titulo: 'Necesita atención ahora',
    nota: `Hasta ${String(MAXIMO_POR_TIPO)} situaciones por tipo, en el orden en que están escritas en los datos demostrativos. No es una priorización clínica.`,
    items: componerAtencion(),
  },
  acciones: {
    titulo: 'Acciones rápidas',
    nota: 'Cada control abre el módulo correspondiente. Aquí no se crea, asigna ni guarda nada.',
    items: HOSPITAL_ACCIONES_RAPIDAS,
  },
  agenda: {
    titulo: 'Agenda próxima',
    items: componerAgendaProxima(),
    verTodo: {
      etiqueta: 'Ver agenda completa',
      destino: { vista: 'agenda' },
      detalleAccesible: 'Agenda y citas',
    },
  },
  alarmas: {
    titulo: 'Alarmas recientes',
    items: componerAlarmasRecientes(),
    verTodo: {
      etiqueta: 'Ver semáforo',
      destino: { vista: 'alarmas' },
      detalleAccesible: 'Semáforo de alarmas',
    },
  },
  profesionales: {
    titulo: 'Profesionales en turno',
    items: componerProfesionales(),
    verTodo: {
      etiqueta: 'Ver profesionales',
      destino: { vista: 'profesionales' },
      detalleAccesible: 'Profesionales',
    },
  },
  accesos: {
    titulo: 'Ir a',
    items: componerAccesos(),
  },
  textoNoDisponible: 'No disponible',
};
