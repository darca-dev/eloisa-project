import type { HospitalVistaEncabezado } from './hospitalAgendaConfig';
import type { HospitalIconName } from './HospitalIcon';
import type { HospitalTonoId } from './hospitalTonos';

/**
 * Contrato tipado y fixtures de la vista «Novedades» (TASK-003H-04, alcance E).
 *
 * Fuente visual vinculante: `prototype-claude/Eligeme-Hospital.dc.html`,
 * vista `vNovedades` (líneas 624–645) y sus datos demostrativos
 * (líneas 1632–1640).
 *
 * Alcance: presentación. El punto fucsia significa únicamente «hay algo nuevo»
 * y su valor es un literal de la referencia: no se calcula, no cambia al
 * interactuar y no se persiste. No hay apertura, lectura, marcado, WhatsApp,
 * correo, notificaciones push, destinatarios reales, colas ni registro de
 * envíos.
 */

/** Novedad de la bandeja (prototipo, líneas 631–639 y 1632–1640). */
export interface HospitalNovedad {
  readonly id: string;
  readonly titulo: string;
  /** Metadatos y destinatario contextual ya redactados por la referencia. */
  readonly meta: string;
  /** Naturaleza o tipo de la novedad; también se lee como texto. */
  readonly tipo: string;
  /** Antigüedad demostrativa ya redactada; no se calcula con la fecha real. */
  readonly cuando: string;
  /** `true` cuando la referencia dibuja el punto fucsia «hay algo nuevo». */
  readonly sinLeer: boolean;
  readonly icono: HospitalIconName;
  readonly tono: HospitalTonoId;
}

export interface HospitalUpdatesConfig {
  readonly encabezado: HospitalVistaEncabezado;
  /** Texto accesible del indicador fucsia. */
  readonly etiquetaSinLeer: string;
  readonly novedades: readonly HospitalNovedad[];
}

/** Configuración demostrativa completa de la vista «Novedades». */
export const hospitalNovedadesDemo: HospitalUpdatesConfig = {
  encabezado: {
    titulo: 'Novedades',
    descripcion:
      'El fucsia solo significa «hay algo nuevo». Al abrir la novedad desaparece y queda su color por naturaleza: azul información, turquesa recordatorio, amarillo seguimiento, rojo alerta.',
  },
  etiquetaSinLeer: 'Sin leer',
  novedades: [
    {
      id: 'solicitud-sara',
      titulo: 'Nueva solicitud de visita en casa · Sara Nieto Vargas',
      meta: 'Pago confirmado · requiere asignación',
      tipo: 'Solicitud',
      cuando: 'Hace 8 min',
      sinLeer: true,
      icono: 'visitas',
      tono: 'amarillo',
    },
    {
      id: 'alerta-sara',
      titulo: 'Alerta roja · dificultad para respirar',
      meta: 'Sara Nieto Vargas · reportada por el cuidador',
      tipo: 'Alerta',
      cuando: 'Hace 12 min',
      sinLeer: true,
      icono: 'alarmas',
      tono: 'rojo',
    },
    {
      id: 'calificacion-carlos',
      titulo: 'Nueva calificación recibida · 5 estrellas',
      meta: 'Enf. Carlos Ruiz · visita del 8 de agosto',
      tipo: 'Calificación',
      cuando: 'Hace 40 min',
      sinLeer: true,
      icono: 'calificaciones',
      tono: 'verde',
    },
    {
      id: 'nota-continuidad',
      titulo: 'Nota de continuidad pendiente para medicina',
      meta: 'Enf. Carlos Ruiz · María Gómez',
      tipo: 'Nota',
      cuando: 'Hace 2 h',
      sinLeer: true,
      icono: 'membresias',
      tono: 'petroleo',
    },
    {
      id: 'bitacora-jorge',
      titulo: 'Bitácora relevante · dos dosis no tomadas',
      meta: 'Jorge Beltrán Ruiz · reportado por el cuidador',
      tipo: 'Seguimiento',
      cuando: 'Ayer',
      sinLeer: false,
      icono: 'medicamento',
      tono: 'amarillo',
    },
    {
      id: 'cancelacion-diana',
      titulo: 'Profesional canceló una atención',
      meta: 'Ft. Diana Salas · visita del 16 de agosto',
      tipo: 'Agenda',
      cuando: 'Ayer',
      sinLeer: false,
      icono: 'agenda',
      tono: 'rojo',
    },
    {
      id: 'recordatorio-maria',
      titulo: 'Recordatorio enviado por WhatsApp',
      meta: 'María Gómez · cita del 21 de agosto',
      tipo: 'Recordatorio',
      cuando: 'Ayer',
      sinLeer: false,
      icono: 'novedades',
      tono: 'petroleo',
    },
  ],
};
