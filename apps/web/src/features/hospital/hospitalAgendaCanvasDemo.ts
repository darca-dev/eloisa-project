import type { HospitalVistaEncabezado } from './hospitalAgendaConfig';
import type { HospitalIconName } from './HospitalIcon';
import type { HospitalTonoId } from './hospitalTonos';

export interface HospitalAgendaDemoSolicitud {
  readonly id: string;
  readonly persona: string;
  readonly tipo: string;
  readonly detalle: string;
  readonly cuando: string;
  readonly estado: string;
  readonly tono: HospitalTonoId;
  readonly icono: HospitalIconName;
}

export interface HospitalAgendaDemoDia {
  readonly id: string;
  readonly numero: string;
  readonly citas: string;
  readonly hoy?: boolean;
  readonly destacado?: boolean;
}

const CONTEOS_DEMO = [0, 1, 0, 2, 1, 0, 1, 0, 2, 1, 0, 1, 2, 0, 1, 0, 2, 1, 0, 1, 2, 2, 0, 1, 0, 1, 1, 0, 1, 1] as const;

/**
 * Convierte los conteos de septiembre de muestra en 35 celdas de lunes a
 * domingo. Es un calendario de presentación, no consulta la fecha ni agenda
 * institucional alguna.
 */
function diasDeMuestra(): readonly HospitalAgendaDemoDia[] {
  return Array.from({ length: 35 }, (_, indice) => {
    const dia = indice;
    const dentroDelMes = dia >= 1 && dia <= 30;
    const conteo = dentroDelMes ? (CONTEOS_DEMO[dia - 1] ?? 0) : 0;

    return {
      id: `agenda-demo-${String(indice)}`,
      numero: dentroDelMes ? String(dia) : '',
      citas: conteo === 0 ? '' : `${String(conteo)} ${conteo === 1 ? 'cita' : 'citas'}`,
      hoy: dia === 22,
      destacado: conteo >= 2,
    };
  });
}

/** Datos exclusivamente ficticios de la composición visual demo de Agenda. */
export const hospitalAgendaCanvasDemo: {
  readonly encabezado: HospitalVistaEncabezado;
  readonly solicitudes: readonly HospitalAgendaDemoSolicitud[];
  readonly diasSemana: readonly string[];
  readonly dias: readonly HospitalAgendaDemoDia[];
  readonly totales: readonly { readonly id: string; readonly valor: string; readonly etiqueta: string }[];
  readonly estados: readonly { readonly id: string; readonly etiqueta: string; readonly tono: HospitalTonoId }[];
  readonly perspectivas: readonly { readonly id: string; readonly rol: string; readonly texto: string; readonly icono: HospitalIconName }[];
} = {
  encabezado: {
    titulo: 'Agenda y citas',
    descripcion:
      'Agenda visual de demostración local. Las solicitudes, el calendario y sus estados son ejemplos ficticios de solo lectura.',
  },
  solicitudes: [
    {
      id: 'agenda-demo-solicitud-01',
      persona: 'Persona Demo 01',
      tipo: 'Visita domiciliaria',
      detalle: 'Solicitud ficticia para mostrar la asignación visual.',
      cuando: 'Muestra · 08:00',
      estado: 'Pendiente de asignación',
      tono: 'amarillo',
      icono: 'visitas',
    },
    {
      id: 'agenda-demo-solicitud-02',
      persona: 'Persona Demo 02',
      tipo: 'Cita en sede',
      detalle: 'Solicitud ficticia para mostrar la agenda maestra.',
      cuando: 'Muestra · 09:30',
      estado: 'Solicitada',
      tono: 'amarillo',
      icono: 'agenda',
    },
    {
      id: 'agenda-demo-solicitud-03',
      persona: 'Persona Demo 03',
      tipo: 'Consulta virtual',
      detalle: 'Solicitud ficticia para mostrar otra modalidad.',
      cuando: 'Muestra · 11:00',
      estado: 'Pendiente de confirmación',
      tono: 'azul',
      icono: 'virtuales',
    },
    {
      id: 'agenda-demo-solicitud-04',
      persona: 'Persona Demo 04',
      tipo: 'Visita domiciliaria',
      detalle: 'Solicitud ficticia para completar la bandeja de muestra.',
      cuando: 'Muestra · 14:00',
      estado: 'Pendiente de asignación',
      tono: 'amarillo',
      icono: 'visitas',
    },
  ],
  diasSemana: ['L', 'M', 'M', 'J', 'V', 'S', 'D'],
  dias: diasDeMuestra(),
  totales: [
    { id: 'mes', valor: '23', etiqueta: 'Citas de muestra' },
    { id: 'sede', valor: '8', etiqueta: 'En sede' },
    { id: 'virtuales', valor: '6', etiqueta: 'Virtuales' },
    { id: 'domicilio', valor: '9', etiqueta: 'Domiciliarias' },
  ],
  estados: [
    { id: 'solicitada', etiqueta: 'Solicitada', tono: 'amarillo' },
    { id: 'asignacion', etiqueta: 'Pendiente de asignación', tono: 'amarillo' },
    { id: 'asignada', etiqueta: 'Asignada', tono: 'azul' },
    { id: 'confirmada', etiqueta: 'Confirmada', tono: 'verde' },
    { id: 'reprogramada', etiqueta: 'Reprogramada', tono: 'amarillo' },
    { id: 'finalizada', etiqueta: 'Finalizada', tono: 'verde' },
    { id: 'cancelada', etiqueta: 'Cancelada', tono: 'rojo' },
  ],
  perspectivas: [
    { id: 'hospital', rol: 'Hospital', texto: 'Estado administrativo de muestra', icono: 'membresias' },
    { id: 'profesional', rol: 'Profesional', texto: 'Lectura visual de ejemplo', icono: 'profesionales' },
    { id: 'paciente', rol: 'Paciente', texto: 'Próxima cita de muestra', icono: 'usuarios' },
    { id: 'cuidador', rol: 'Cuidador', texto: 'Acompañamiento de muestra', icono: 'usuarios' },
  ],
};
