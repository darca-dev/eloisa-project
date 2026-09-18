import type { HospitalVistaEncabezado } from './hospitalAgendaConfig';
import type { HospitalTonoId } from './hospitalTonos';
import type { HospitalEstadoConteo } from './HospitalViewPieces';

/**
 * Contrato tipado y fixtures de la vista «Visitas domiciliarias»
 * (TASK-003H-04, alcance B).
 *
 * Fuente visual vinculante: `prototype-claude/Eligeme-Hospital.dc.html`,
 * vista `vVisitas` (líneas 482–515) y sus datos demostrativos
 * (líneas 1570–1584).
 *
 * Alcance: presentación. Los filtros son etiquetas visuales: no filtran, no
 * ordenan y no consultan nada. No hay geolocalización, mapas, rutas, tracking,
 * despacho, check-in ni verificación de ubicación, y los conteos por estado son
 * literales de la referencia que no se derivan de la lista.
 */

/** Fila de la bandeja de visitas (prototipo, líneas 503–511 y 1578–1584). */
export interface HospitalVisitaFila {
  readonly id: string;
  /** Texto `día mes · hora` ya redactado por la referencia. */
  readonly fecha: string;
  readonly paciente: string;
  /** Ubicación o zona tal como la escribe la referencia. */
  readonly zona: string;
  readonly profesional: string;
  readonly estado: string;
  readonly tono: HospitalTonoId;
}

export interface HospitalVisitsConfig {
  readonly encabezado: HospitalVistaEncabezado;
  /** Etiquetas de filtro; no son controles y no filtran datos. */
  readonly filtros: readonly string[];
  readonly estados: readonly HospitalEstadoConteo[];
  readonly visitas: readonly HospitalVisitaFila[];
}

/** Configuración demostrativa completa de la vista «Visitas domiciliarias». */
export const hospitalVisitasDemo: HospitalVisitsConfig = {
  encabezado: {
    titulo: 'Visitas domiciliarias',
    descripcion:
      'Filtrables por fecha, profesional, paciente, municipio, zona, estado y semáforo.',
  },
  filtros: [
    'Fecha: hoy',
    'Profesional: todos',
    'Paciente: todos',
    'Municipio: Soacha',
    'Estado: todos',
    'Semáforo: todos',
  ],
  estados: [
    { id: 'programadas', etiqueta: 'Programadas', valor: '4', color: 'var(--b-azul)' },
    { id: 'en-camino', etiqueta: 'En camino', valor: '2', color: 'var(--b-petroleo-texto)' },
    { id: 'iniciadas', etiqueta: 'Iniciadas', valor: '2', color: 'var(--b-petroleo-texto)' },
    { id: 'finalizadas', etiqueta: 'Finalizadas', valor: '3', color: 'var(--b-verde)' },
    { id: 'canceladas', etiqueta: 'Canceladas', valor: '1', color: 'var(--b-rojo)' },
  ],
  visitas: [
    {
      id: '17-0800',
      fecha: '17 ago · 08:00',
      paciente: 'Arturo Calle Osorio',
      zona: 'La Esperanza, Soacha',
      profesional: 'Dra. Laura Gómez',
      estado: 'Finalizada',
      tono: 'verde',
    },
    {
      id: '17-1000',
      fecha: '17 ago · 10:00',
      paciente: 'María Gómez Osorio',
      zona: 'La Esperanza, Soacha',
      profesional: 'Dra. Laura Gómez',
      estado: 'En camino',
      tono: 'petroleo',
    },
    {
      id: '17-1100',
      fecha: '17 ago · 11:00',
      paciente: 'Carmen López Díaz',
      zona: 'Compartir, Soacha',
      profesional: 'Enf. Carlos Ruiz',
      estado: 'En camino',
      tono: 'petroleo',
    },
    {
      id: '17-1400',
      fecha: '17 ago · 14:00',
      paciente: 'Sara Nieto Vargas',
      zona: 'El Charquito',
      profesional: 'Sin asignar',
      estado: 'Pendiente de asignación',
      tono: 'amarillo',
    },
    {
      id: '16-0930',
      fecha: '16 ago · 09:30',
      paciente: 'Jorge Beltrán Ruiz',
      zona: 'San Mateo, Soacha',
      profesional: 'Ft. Diana Salas',
      estado: 'Cancelada',
      tono: 'rojo',
    },
  ],
};
