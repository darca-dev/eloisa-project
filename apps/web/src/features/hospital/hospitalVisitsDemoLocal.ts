import type { HospitalVistaEncabezado } from './hospitalAgendaConfig';
import type { HospitalTonoId } from './hospitalTonos';
import type { HospitalEstadoConteo } from './HospitalViewPieces';

/**
 * Datos deterministas para la bandeja de demostración local de visitas.
 *
 * Esta fuente no comparte contratos, clientes ni datos con la operación real.
 * Sus estados son ejemplos de avance operativo; no describen atención clínica.
 */
export interface HospitalVisitaDemoLocal {
  readonly id: string;
  readonly fecha: string;
  readonly persona: string;
  readonly zona: string;
  readonly profesional: string;
  readonly estado: string;
  readonly tono: HospitalTonoId;
}

export const hospitalVisitasDemoLocal: {
  readonly encabezado: HospitalVistaEncabezado;
  readonly filtros: readonly string[];
  readonly estados: readonly HospitalEstadoConteo[];
  readonly visitas: readonly HospitalVisitaDemoLocal[];
} = {
  encabezado: {
    titulo: 'Visitas domiciliarias',
    descripcion:
      'Bandeja local de demostración con ejemplos operativos ficticios. No representa atención ni registros institucionales.',
  },
  filtros: [
    'Fecha: muestra local',
    'Profesional: todos',
    'Persona: todas',
    'Zona: demostración',
    'Estado: todos',
  ],
  estados: [
    { id: 'programadas', etiqueta: 'Programadas', valor: '1', color: 'var(--b-azul)' },
    { id: 'preparacion', etiqueta: 'En preparación', valor: '1', color: 'var(--b-petroleo-texto)' },
    { id: 'curso', etiqueta: 'En curso', valor: '1', color: 'var(--b-petroleo-texto)' },
    { id: 'completadas', etiqueta: 'Completadas', valor: '1', color: 'var(--b-verde)' },
    { id: 'no-realizadas', etiqueta: 'No realizadas', valor: '1', color: 'var(--b-amarillo-texto)' },
  ],
  visitas: [
    {
      id: 'demo-visita-01',
      fecha: 'Muestra 1 · 08:00',
      persona: 'Persona Demo 01',
      zona: 'Zona ficticia Norte',
      profesional: 'Profesional Demo A',
      estado: 'Completada',
      tono: 'verde',
    },
    {
      id: 'demo-visita-02',
      fecha: 'Muestra 2 · 09:30',
      persona: 'Persona Demo 02',
      zona: 'Zona ficticia Centro',
      profesional: 'Profesional Demo A',
      estado: 'En curso',
      tono: 'petroleo',
    },
    {
      id: 'demo-visita-03',
      fecha: 'Muestra 3 · 11:00',
      persona: 'Persona Demo 03',
      zona: 'Zona ficticia Oriente',
      profesional: 'Profesional Demo B',
      estado: 'En preparación',
      tono: 'petroleo',
    },
    {
      id: 'demo-visita-04',
      fecha: 'Muestra 4 · 14:00',
      persona: 'Persona Demo 04',
      zona: 'Zona ficticia Sur',
      profesional: 'Profesional Demo B',
      estado: 'Programada',
      tono: 'azul',
    },
    {
      id: 'demo-visita-05',
      fecha: 'Muestra 5 · 15:30',
      persona: 'Persona Demo 05',
      zona: 'Zona ficticia Occidente',
      profesional: 'Profesional Demo C',
      estado: 'No realizada',
      tono: 'amarillo',
    },
  ],
};
