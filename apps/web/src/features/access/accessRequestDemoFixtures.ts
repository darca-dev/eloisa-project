import type { AccessRequestSubmission } from './accessRequestClient';
import type { RequestedProfile } from './accessRequestClient';

export interface AccessRequestDemoFixture {
  readonly id: string;
  readonly label: string;
  readonly submission: AccessRequestSubmission;
}

/** Personas ficticias que se cargan solo al pulsar un botón del formulario. */
export const ACCESS_REQUEST_DEMOS: readonly AccessRequestDemoFixture[] = [
  {
    id: 'paciente-1',
    label: 'Paciente test 1',
    submission: {
      requestedProfile: 'PATIENT', documentType: 'CEDULA_CIUDADANIA',
      documentNumber: '900100001', givenNames: 'Aurora', familyNames: 'Demo Salcedo',
      birthDate: '1950-03-16', sexGenderCode: 'FEMENINO',
      phone: '3001000001', email: 'aurora.demo1@example.test',
    },
  },
  {
    id: 'paciente-2',
    label: 'Paciente test 2',
    submission: {
      requestedProfile: 'PATIENT', documentType: 'CEDULA_CIUDADANIA',
      documentNumber: '900100002', givenNames: 'Bruno', familyNames: 'Demo Ríos',
      birthDate: '1962-08-24', sexGenderCode: 'MASCULINO',
      phone: '3001000002', email: 'bruno.demo2@example.test',
    },
  },
  {
    id: 'paciente-3',
    label: 'Paciente test 3',
    submission: {
      requestedProfile: 'PATIENT', documentType: 'CEDULA_CIUDADANIA',
      documentNumber: '900100003', givenNames: 'Celia', familyNames: 'Demo Pardo',
      birthDate: '1947-11-09', sexGenderCode: 'FEMENINO',
      phone: '3001000003', email: 'celia.demo3@example.test',
    },
  },
  {
    id: 'cuidador-1',
    label: 'Cuidador test 1',
    submission: {
      requestedProfile: 'CAREGIVER', documentType: 'CEDULA_CIUDADANIA',
      documentNumber: '900200001', givenNames: 'Carlos', familyNames: 'Demo Ruiz',
      birthDate: '1982-05-14', sexGenderCode: 'MASCULINO',
      phone: '3002000001', email: 'carlos.cuidador1@example.test',
    },
  },
  {
    id: 'cuidador-2',
    label: 'Cuidador test 2',
    submission: {
      requestedProfile: 'CAREGIVER', documentType: 'CEDULA_CIUDADANIA',
      documentNumber: '900200002', givenNames: 'Lucía', familyNames: 'Demo Vargas',
      birthDate: '1979-02-21', sexGenderCode: 'FEMENINO',
      phone: '3002000002', email: 'lucia.cuidador2@example.test',
    },
  },
  {
    id: 'cuidador-3',
    label: 'Cuidador test 3',
    submission: {
      requestedProfile: 'CAREGIVER', documentType: 'CEDULA_CIUDADANIA',
      documentNumber: '900200003', givenNames: 'Elena', familyNames: 'Demo Mora',
      birthDate: '1990-10-08', sexGenderCode: 'FEMENINO',
      phone: '3002000003', email: 'elena.cuidador3@example.test',
    },
  },
  {
    id: 'visitador-1',
    label: 'Visitador test 1',
    submission: {
      requestedProfile: 'FIELD_PROFESSIONAL', documentType: 'CEDULA_CIUDADANIA',
      documentNumber: '900300001', givenNames: 'Andrés', familyNames: 'Demo López',
      birthDate: '1985-06-10', sexGenderCode: 'MASCULINO',
      phone: '3003000001', email: 'andres.visitador1@example.test',
    },
  },
  {
    id: 'visitador-2',
    label: 'Visitador test 2',
    submission: {
      requestedProfile: 'FIELD_PROFESSIONAL', documentType: 'CEDULA_CIUDADANIA',
      documentNumber: '900300002', givenNames: 'Paula', familyNames: 'Demo Torres',
      birthDate: '1988-09-27', sexGenderCode: 'FEMENINO',
      phone: '3003000002', email: 'paula.visitador2@example.test',
    },
  },
  {
    id: 'visitador-3',
    label: 'Visitador test 3',
    submission: {
      requestedProfile: 'FIELD_PROFESSIONAL', documentType: 'CEDULA_CIUDADANIA',
      documentNumber: '900300003', givenNames: 'Mateo', familyNames: 'Demo Silva',
      birthDate: '1992-12-03', sexGenderCode: 'MASCULINO',
      phone: '3003000003', email: 'mateo.visitador3@example.test',
    },
  },
];

/**
 * Fixtures COMPLETOS del flujo guiado de cinco pasos (SPEC 038, MP04-C3).
 *
 * Cada fixture aporta los datos test de los cinco pasos. La contraseña no se
 * versiona: se genera con Web Crypto al pulsar la precarga. El arreglo
 * anterior (`ACCESS_REQUEST_DEMOS`) queda intacto: solo cubre identidad y
 * contacto base.
 */
export interface AccessRegistrationDemoFixture {
  readonly id: string;
  readonly label: string;
  readonly perfil: RequestedProfile;
  readonly base: AccessRequestSubmission;
  /** Expediente sin contraseña, con la forma de la rama. */
  readonly registro: Record<string, unknown>;
}

const REGISTRO_PACIENTE: Record<string, Record<string, unknown>> = {
  'paciente-1': {
    necesitaApoyo: 'SI',
    apoyos: ['MOVILIZARSE', 'ACOMPANAMIENTO'],
    condiciones: ['HIPERTENSION'],
    zona: 'URBANA',
    eps: 'NUEVA_EPS',
    direccion: 'Cra 45 # 32-16',
    contactoNombre: 'Carlos Demo',
    contactoParentesco: 'Hijo',
    contactoTelefono: '3001000001',
    vecinoNombre: 'Rosa Delgado',
    vecinoTelefono: '312 778 4410',
    vecinoAutorizado: true,
    autorizaDatos: true,
  },
  'paciente-2': {
    necesitaApoyo: 'NO',
    apoyos: [],
    condiciones: ['NINGUNA'],
    zona: 'RURAL',
    eps: 'SANITAS',
    direccion: 'Vereda El Recreo',
    contactoNombre: 'Bruno Demo',
    contactoParentesco: 'Hermano',
    contactoTelefono: '3001000002',
    vecinoNombre: 'Pedro Ficticio',
    vecinoTelefono: '312 778 4411',
    vecinoAutorizado: true,
    autorizaDatos: true,
  },
  'paciente-3': {
    necesitaApoyo: 'NO_SABE',
    apoyos: [],
    condiciones: ['DIABETES', 'MOVILIDAD_REDUCIDA'],
    zona: 'URBANA',
    eps: 'SURA',
    direccion: 'Calle 20 # 8-14',
    contactoNombre: 'Celia Demo',
    contactoParentesco: 'Hija',
    contactoTelefono: '3001000003',
    vecinoNombre: 'Ana Vecina',
    vecinoTelefono: '312 778 4412',
    vecinoAutorizado: true,
    autorizaDatos: true,
  },
};

const REGISTRO_CUIDADOR: Record<string, Record<string, unknown>> = {
  'cuidador-1': {
    tipoCuidador: 'FAMILIAR',
    tieneFormacion: 'NO',
    viveConPaciente: 'SI',
    horarios: ['MANANA', 'NOCHE'],
    pacienteRegistrado: 'NO_SABE',
    relacionPaciente: 'MADRE',
    vecinoNombre: 'Rosa Delgado',
    vecinoTelefono: '312 778 4410',
    vecinoRelacion: 'VECINO',
    vecinoDireccion: 'Casa de al lado',
    vecinoAutorizado: true,
    autorizaDatos: true,
  },
  'cuidador-2': {
    tipoCuidador: 'REMUNERADO',
    tieneFormacion: 'SI',
    institucionFormacion: 'SENA',
    viveConPaciente: 'NO',
    horarios: ['TODO_EL_DIA'],
    pacienteRegistrado: 'SI',
    relacionPaciente: 'CONTRATADO',
    vecinoNombre: 'Luis Ficticio',
    vecinoTelefono: '312 778 4421',
    vecinoRelacion: 'PORTERO',
    vecinoDireccion: 'Portería norte',
    vecinoAutorizado: true,
    autorizaDatos: true,
  },
  'cuidador-3': {
    tipoCuidador: 'AUXILIAR_ENFERMERIA',
    tieneFormacion: 'SI',
    institucionFormacion: 'HOSPITAL_ESE',
    viveConPaciente: 'SI',
    horarios: ['TARDE', 'DIAS_ESPECIFICOS'],
    pacienteRegistrado: 'NO',
    relacionPaciente: 'OTRO_FAMILIAR',
    vecinoNombre: 'Marta Vecina',
    vecinoTelefono: '312 778 4422',
    vecinoRelacion: 'LIDER',
    vecinoDireccion: 'Salón comunal',
    vecinoAutorizado: true,
    autorizaDatos: true,
  },
};

const REGISTRO_VISITADOR: Record<string, Record<string, unknown>> = {
  'visitador-1': {
    profesion: 'MEDICO',
    tiposAtencion: ['VISITA_MEDICA', 'SEGUIMIENTO'],
    eps: 'NUEVA_EPS',
    institucion: 'ESE Hospital municipal',
    institucionDepartamento: '25',
    institucionMunicipio: '25754',
    cargo: 'Médico domiciliario',
    zonaDepartamento: '25',
    zonaMunicipio: '25754',
    zonas: ['COMUNA_URBANA'],
    sector: 'Sector nororiental',
    autorizaDatos: true,
  },
  'visitador-2': {
    profesion: 'ENFERMERO',
    tiposAtencion: ['ENFERMERIA', 'MEDICAMENTOS'],
    eps: 'OTRA_EPS',
    otraEps: 'EPS Test',
    institucion: 'Institución Test 2',
    cargo: 'Enfermería domiciliaria',
    sector: 'Sector Test 2',
    institucionDepartamento: '25',
    institucionMunicipio: '25740',
    zonaDepartamento: '25',
    zonaMunicipio: '25740',
    zonas: ['CABECERA', 'CENTRO_POBLADO'],
    autorizaDatos: true,
  },
  'visitador-3': {
    profesion: 'FISIOTERAPEUTA',
    tiposAtencion: [],
    eps: 'SANITAS',
    institucion: 'Institución Test 3',
    cargo: 'Fisioterapia domiciliaria',
    sector: 'Sector Test 3',
    institucionDepartamento: '25',
    institucionMunicipio: '25175',
    zonaDepartamento: '25',
    zonaMunicipio: '25175',
    zonas: ['RURAL_DISPERSA'],
    autorizaDatos: true,
  },
};

export const ACCESS_REGISTRATION_DEMOS: readonly AccessRegistrationDemoFixture[] = [
  ...ACCESS_REQUEST_DEMOS.map((fixture) => ({
    id: fixture.id,
    label: fixture.label,
    perfil: fixture.submission.requestedProfile,
    base: fixture.submission,
    registro:
      fixture.submission.requestedProfile === 'PATIENT'
        ? (REGISTRO_PACIENTE[fixture.id] as Record<string, unknown>)
        : fixture.submission.requestedProfile === 'CAREGIVER'
          ? (REGISTRO_CUIDADOR[fixture.id] as Record<string, unknown>)
          : (REGISTRO_VISITADOR[fixture.id] as Record<string, unknown>),
  })),
];
