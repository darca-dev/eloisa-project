import { CUIDADOR_VACIO, VISITADOR_VACIO } from './inscripcionFlow';
import type { DatosCuidador, DatosVisitador } from './inscripcionFlow';

interface Demo<T> {
  readonly id: string;
  readonly etiqueta: string;
  readonly valores: T;
}

const ubicacion = { departamento: '25', municipio: '25754', corregimiento: 'Centro demo' };

const cuidadores = [
  ['1', 'Carlos', 'Demo Ruiz', '900200001', '1982-05-14', 44, '3002000001'],
  ['2', 'Lucía', 'Demo Vargas', '900200002', '1979-02-21', 47, '3002000002'],
  ['3', 'Elena', 'Demo Mora', '900200003', '1990-10-08', 35, '3002000003'],
] as const;

export const CUIDADORES_DEMO: readonly Demo<DatosCuidador>[] = cuidadores.map(
  ([id, nombres, apellidos, documento, fechaNacimiento, edad, telefono]) => ({
    id,
    etiqueta: `Cuidador demo ${id}`,
    valores: {
      ...CUIDADOR_VACIO,
      nombres, apellidos, documento, fechaNacimiento, edad, telefono,
      correo: `cuidador.demo${id}@example.test`,
      ubicacion: { ...ubicacion },
      direccion: `Dirección ficticia ${id}, Soacha`,
      tipoCuidador: 'Familiar',
      tieneFormacion: 'No',
      viveConPaciente: 'No',
      horarios: ['Mañana'],
      pacienteRegistrado: 'No',
      relacionPaciente: 'Madre',
      vecinoNombre: `Vecino Ficticio ${id}`,
      vecinoTelefono: `300200001${id}`,
      vecinoRelacion: 'Vecino',
      vecinoDireccion: `Casa ficticia ${id}`,
      autorizaVecino: true,
      autorizaDatos: true,
    },
  }),
);

const visitadores = [
  ['1', 'Andrés', 'Demo López', '900300001', '3003000001'],
  ['2', 'Paula', 'Demo Torres', '900300002', '3003000002'],
  ['3', 'Mateo', 'Demo Silva', '900300003', '3003000003'],
] as const;

export const VISITADORES_DEMO: readonly Demo<DatosVisitador>[] = visitadores.map(
  ([id, nombres, apellidos, documento, telefono]) => ({
    id,
    etiqueta: `Visitador demo ${id}`,
    valores: {
      ...VISITADOR_VACIO,
      nombres, apellidos, documento, telefono,
      correo: `visitador.demo${id}@example.test`,
      institucion: 'Hospital ficticio de demostración',
      ubicacionInstitucion: { ...ubicacion },
      ubicacion: { ...ubicacion },
      tiposAtencion: ['Visita médica domiciliaria'],
      zonas: ['Comuna urbana'],
      sector: `Sector ficticio ${id}`,
      autorizaDatos: true,
    },
  }),
);
