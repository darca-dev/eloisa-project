import type { HospitalVistaEncabezado } from './hospitalAgendaConfig';
import type { HospitalPacienteDato } from './hospitalPatientsConfig';
import type { HospitalTonoId } from './hospitalTonos';

/**
 * Contrato tipado y fixtures de la vista «Semáforo de alarmas»
 * (TASK-003H-03, FR-04).
 *
 * Fuente visual vinculante: `prototype-claude/Eligeme-Hospital.dc.html`,
 * bandeja `Alarmas recientes` (líneas 183–200), vista `vAlarmas`
 * (líneas 361–417) y datos demostrativos (líneas 1438–1442, 1453–1458 y
 * 1540–1554).
 *
 * Alcance: presentación. No hay evaluación de rangos, generación automática de
 * alarmas, priorización, notificación, asignación, comentario, auditoría
 * productiva ni cierre de alertas. Los niveles y estados son literales de la
 * referencia, se leen como texto y no se derivan de ningún dato. La copia del
 * prototipo sobre automatización y trazabilidad es contenido demostrativo: no
 * describe funcionalidad implementada.
 */

/** Fila de la bandeja `Alarmas recientes`. */
export interface HospitalAlarmaBandeja {
  readonly id: string;
  readonly paciente: string;
  readonly motivo: string;
  /** Nivel textual de la referencia (`ROJA`, `AMARILLA`). */
  readonly nivel: string;
  /** Antigüedad demostrativa ya redactada. */
  readonly cuando: string;
  readonly tono: HospitalTonoId;
}

/** Tarjeta del resumen rojo/amarillo/verde. */
export interface HospitalAlarmaResumen {
  readonly id: string;
  readonly valor: string;
  readonly etiqueta: string;
  readonly tono: HospitalTonoId;
  /** `alarmas` para los niveles con alerta; `check` para el nivel estable. */
  readonly icono: 'alarmas' | 'check';
}

/** Nota de continuidad pendiente o atendida. */
export interface HospitalNotaContinuidad {
  readonly id: string;
  readonly texto: string;
  /** Ruta demostrativa `origen → destino · paciente`. */
  readonly meta: string;
  readonly estado: string;
  readonly tono: HospitalTonoId;
}

/** Variantes de botón que la referencia declara para las acciones (líneas 394–399). */
export type HospitalAccionVariante = 'primaria' | 'azul' | 'neutra' | 'roja' | 'verde';

/** Acción visible del detalle. No produce efecto: solo tiene apariencia. */
export interface HospitalAlertaAccion {
  readonly etiqueta: string;
  readonly variante: HospitalAccionVariante;
}

export interface HospitalAlertaDetalle {
  readonly etiqueta: string;
  readonly estado: string;
  readonly tono: HospitalTonoId;
  readonly titulo: string;
  readonly campos: readonly HospitalPacienteDato[];
  /** Acciones exclusivamente visuales, en el orden de la referencia. */
  readonly acciones: readonly HospitalAlertaAccion[];
  readonly nota: string;
}

export interface HospitalAlertsConfig {
  readonly encabezado: HospitalVistaEncabezado;
  readonly bandeja: {
    readonly titulo: string;
    readonly nota: string;
    readonly accionVer: string;
    readonly items: readonly HospitalAlarmaBandeja[];
  };
  readonly resumen: readonly HospitalAlarmaResumen[];
  readonly detalle: HospitalAlertaDetalle;
  readonly continuidad: {
    readonly titulo: string;
    readonly items: readonly HospitalNotaContinuidad[];
    readonly nota: string;
  };
}

/** Configuración demostrativa completa de la vista «Semáforo de alarmas». */
export const hospitalAlertsDemo: HospitalAlertsConfig = {
  encabezado: {
    titulo: 'Semáforo de alarmas',
    descripcion:
      'Las alarmas llegan solas desde la bitácora del paciente, la del cuidador, el registro del profesional o el motor de reglas. El hospital no las busca.',
  },
  bandeja: {
    titulo: 'Alarmas recientes',
    nota: 'Llegan automáticamente desde bitácoras, registros del profesional y el motor de reglas',
    accionVer: 'Ver',
    items: [
      {
        id: 'sara-nieto-vargas',
        paciente: 'Sara Nieto Vargas',
        motivo: 'Dificultad para respirar reportada en la bitácora',
        nivel: 'ROJA',
        cuando: 'Hace 12 minutos',
        tono: 'rojo',
      },
      {
        id: 'maria-rodriguez',
        paciente: 'María Rodríguez',
        motivo: 'Presión arterial fuera del rango configurado',
        nivel: 'ROJA',
        cuando: 'Hace 15 minutos',
        tono: 'rojo',
      },
      {
        id: 'maria-gomez-osorio',
        paciente: 'María Gómez Osorio',
        motivo: 'Presión 155/90, fuera del rango de la paciente',
        nivel: 'AMARILLA',
        cuando: 'Hace 1 hora',
        tono: 'amarillo',
      },
      {
        id: 'jorge-beltran-ruiz',
        paciente: 'Jorge Beltrán Ruiz',
        motivo: 'Dos dosis de losartán no tomadas por malestar',
        nivel: 'AMARILLA',
        cuando: 'Ayer 8:10 p. m.',
        tono: 'amarillo',
      },
    ],
  },
  resumen: [
    {
      id: 'rojas',
      valor: '3',
      etiqueta: 'Rojas · requieren atención',
      tono: 'rojo',
      icono: 'alarmas',
    },
    {
      id: 'amarillas',
      valor: '4',
      etiqueta: 'Amarillas · requieren seguimiento',
      tono: 'amarillo',
      icono: 'alarmas',
    },
    {
      id: 'estables',
      valor: '15',
      etiqueta: 'Estables o revisadas',
      tono: 'verde',
      icono: 'check',
    },
  ],
  detalle: {
    etiqueta: 'DETALLE DE LA ALERTA',
    estado: 'Roja · sin atender',
    tono: 'rojo',
    titulo: 'Sara Nieto Vargas · dificultad para respirar reportada en la bitácora',
    campos: [
      { etiqueta: 'PACIENTE', valor: 'Sara Nieto Vargas · 74 años' },
      { etiqueta: 'DATO REPORTADO', valor: 'Dificultad para respirar' },
      { etiqueta: 'QUIÉN LO REGISTRÓ', valor: 'Cuidador Andrés Nieto (hijo)' },
      { etiqueta: 'FECHA Y HORA', valor: 'Hoy, 7:05 a. m.' },
      { etiqueta: 'RANGO CONFIGURADO', valor: 'Evento de riesgo alto definido por el hospital' },
      { etiqueta: 'PROFESIONAL ASIGNADO', valor: 'Sin asignar' },
      { etiqueta: 'ÚLTIMA ATENCIÓN', valor: '12 de agosto · visita domiciliaria' },
      { etiqueta: 'ACCIONES REALIZADAS', valor: 'Ninguna todavía' },
    ],
    acciones: [
      { etiqueta: 'Asignar a profesional', variante: 'primaria' },
      { etiqueta: 'Marcar en revisión', variante: 'azul' },
      { etiqueta: 'Solicitar visita', variante: 'neutra' },
      { etiqueta: 'Solicitar consulta virtual', variante: 'neutra' },
      { etiqueta: 'Escalar', variante: 'roja' },
      { etiqueta: 'Registrar acción y cerrar', variante: 'verde' },
    ],
    nota: 'Cada acción guarda usuario, fecha, hora, comentario, estado anterior y estado nuevo.',
  },
  continuidad: {
    titulo: 'Notas de continuidad pendientes',
    items: [
      {
        id: 'presion-tecnica',
        texto: 'Revisar nuevamente la toma de presión y enseñar la técnica a la cuidadora.',
        meta: 'Enf. Carlos Ruiz → medicina · María Gómez',
        estado: 'Pendiente',
        tono: 'amarillo',
      },
      {
        id: 'cambio-medicamento',
        texto: 'Preguntar a María cómo se sintió después del cambio de medicamento.',
        meta: 'Dr. Andrés Peña → próximo profesional · María Gómez',
        estado: 'Pendiente',
        tono: 'amarillo',
      },
      {
        id: 'cambio-posicion',
        texto: 'Reforzar con la cuidadora el cambio de posición cada 3 horas.',
        meta: 'Ft. Diana Salas → enfermería · Sara Nieto',
        estado: 'Atendida',
        tono: 'verde',
      },
    ],
    nota: 'El hospital ve cuántas hay, quién las creó, quién debe atenderlas y su estado. No edita el contenido clínico original.',
  },
};
