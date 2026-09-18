import type { HospitalVistaEncabezado } from './hospitalAgendaConfig';
import type { HospitalTonoId } from './hospitalTonos';
import type { HospitalEstadoConteo } from './HospitalViewPieces';

/**
 * Contrato tipado y fixtures de la vista «Consultas virtuales»
 * (TASK-003H-04, alcance C).
 *
 * Fuente visual vinculante: `prototype-claude/Eligeme-Hospital.dc.html`,
 * vista `vVirtuales` (líneas 517–546) y sus datos demostrativos
 * (líneas 1586–1599).
 *
 * Alcance: presentación. No hay sala, enlace, proveedor, audio, vídeo, chat,
 * grabación, consentimiento, WhatsApp ni conexión en tiempo real. Los estados
 * `Paciente en espera`, `En curso` y `Confirmada` son literales de la
 * referencia: no reflejan presencia, conexión ni actividad de nadie. La nota
 * sobre WhatsApp es copia visual del prototipo y no describe funcionalidad
 * implementada.
 */

/** Consulta de la lista «En curso y en espera» (prototipo, líneas 533–541). */
export interface HospitalConsultaVirtual {
  readonly id: string;
  readonly hora: string;
  readonly paciente: string;
  readonly profesional: string;
  readonly estado: string;
  readonly tono: HospitalTonoId;
}

export interface HospitalVirtualConfig {
  readonly encabezado: HospitalVistaEncabezado;
  readonly estados: readonly HospitalEstadoConteo[];
  readonly listaTitulo: string;
  readonly consultas: readonly HospitalConsultaVirtual[];
  /** Nota del prototipo sobre integración futura; no hay envío real. */
  readonly notaIntegracion: string;
}

/** Configuración demostrativa completa de la vista «Consultas virtuales». */
export const hospitalVirtualesDemo: HospitalVirtualConfig = {
  encabezado: {
    titulo: 'Consultas virtuales',
    descripcion:
      'Integradas a la agenda maestra. La estructura queda lista para conectar el proveedor de videollamada cuando se defina.',
  },
  estados: [
    { id: 'programadas', etiqueta: 'Programadas', valor: '7', color: 'var(--b-azul)' },
    {
      id: 'paciente-esperando',
      etiqueta: 'Paciente esperando',
      valor: '1',
      color: 'var(--b-amarillo)',
    },
    {
      id: 'profesional-conectado',
      etiqueta: 'Profesional conectado',
      valor: '2',
      color: 'var(--b-petroleo-texto)',
    },
    { id: 'en-curso', etiqueta: 'En curso', valor: '2', color: 'var(--b-petroleo-texto)' },
    { id: 'finalizadas', etiqueta: 'Finalizadas', valor: '4', color: 'var(--b-verde)' },
    { id: 'canceladas', etiqueta: 'Canceladas', valor: '0', color: 'var(--b-rojo)' },
  ],
  listaTitulo: 'En curso y en espera',
  consultas: [
    {
      id: '1130',
      hora: '11:30',
      paciente: 'Juan Pérez Mora',
      profesional: 'Dra. Laura Gómez',
      estado: 'Paciente en espera',
      tono: 'amarillo',
    },
    {
      id: '1100',
      hora: '11:00',
      paciente: 'Beatriz Sanín',
      profesional: 'Dr. Juan Pérez',
      estado: 'En curso',
      tono: 'petroleo',
    },
    {
      id: '1030',
      hora: '10:30',
      paciente: 'Álvaro Mesa',
      profesional: 'Dr. Juan Pérez',
      estado: 'En curso',
      tono: 'petroleo',
    },
    {
      id: '1515',
      hora: '3:15 p',
      paciente: 'Rosa Marín Cifuentes',
      profesional: 'Dr. Juan Pérez',
      estado: 'Confirmada',
      tono: 'verde',
    },
  ],
  notaIntegracion:
    'WhatsApp queda preparado con plantillas, estados, eventos y registro de envíos. No se envían mensajes reales hasta configurar proveedor y API.',
};
