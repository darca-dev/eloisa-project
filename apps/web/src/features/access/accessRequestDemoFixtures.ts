import type { AccessRequestSubmission } from './accessRequestClient';

export interface AccessRequestDemoFixture {
  readonly id: string;
  readonly label: string;
  readonly submission: AccessRequestSubmission;
}

/** Personas ficticias que se cargan solo al pulsar un botón del formulario. */
export const ACCESS_REQUEST_DEMOS: readonly AccessRequestDemoFixture[] = [
  {
    id: 'paciente-1',
    label: 'Paciente demo 1',
    submission: {
      requestedProfile: 'PATIENT', documentType: 'CEDULA_CIUDADANIA',
      documentNumber: '900100001', givenNames: 'Aurora', familyNames: 'Demo Salcedo',
      birthDate: '1950-03-16', sexGenderCode: 'FEMENINO',
      phone: '3001000001', email: 'aurora.demo1@example.test',
    },
  },
  {
    id: 'paciente-2',
    label: 'Paciente demo 2',
    submission: {
      requestedProfile: 'PATIENT', documentType: 'CEDULA_CIUDADANIA',
      documentNumber: '900100002', givenNames: 'Bruno', familyNames: 'Demo Ríos',
      birthDate: '1962-08-24', sexGenderCode: 'MASCULINO',
      phone: '3001000002', email: 'bruno.demo2@example.test',
    },
  },
  {
    id: 'paciente-3',
    label: 'Paciente demo 3',
    submission: {
      requestedProfile: 'PATIENT', documentType: 'CEDULA_CIUDADANIA',
      documentNumber: '900100003', givenNames: 'Celia', familyNames: 'Demo Pardo',
      birthDate: '1947-11-09', sexGenderCode: 'FEMENINO',
      phone: '3001000003', email: 'celia.demo3@example.test',
    },
  },
  {
    id: 'cuidador-1',
    label: 'Cuidador demo 1',
    submission: {
      requestedProfile: 'CAREGIVER', documentType: 'CEDULA_CIUDADANIA',
      documentNumber: '900200001', givenNames: 'Carlos', familyNames: 'Demo Ruiz',
      birthDate: '1982-05-14', sexGenderCode: 'MASCULINO',
      phone: '3002000001', email: 'carlos.cuidador1@example.test',
    },
  },
  {
    id: 'cuidador-2',
    label: 'Cuidador demo 2',
    submission: {
      requestedProfile: 'CAREGIVER', documentType: 'CEDULA_CIUDADANIA',
      documentNumber: '900200002', givenNames: 'Lucía', familyNames: 'Demo Vargas',
      birthDate: '1979-02-21', sexGenderCode: 'FEMENINO',
      phone: '3002000002', email: 'lucia.cuidador2@example.test',
    },
  },
  {
    id: 'cuidador-3',
    label: 'Cuidador demo 3',
    submission: {
      requestedProfile: 'CAREGIVER', documentType: 'CEDULA_CIUDADANIA',
      documentNumber: '900200003', givenNames: 'Elena', familyNames: 'Demo Mora',
      birthDate: '1990-10-08', sexGenderCode: 'FEMENINO',
      phone: '3002000003', email: 'elena.cuidador3@example.test',
    },
  },
  {
    id: 'visitador-1',
    label: 'Visitador demo 1',
    submission: {
      requestedProfile: 'FIELD_PROFESSIONAL', documentType: 'CEDULA_CIUDADANIA',
      documentNumber: '900300001', givenNames: 'Andrés', familyNames: 'Demo López',
      birthDate: '1985-06-10', sexGenderCode: 'MASCULINO',
      phone: '3003000001', email: 'andres.visitador1@example.test',
    },
  },
  {
    id: 'visitador-2',
    label: 'Visitador demo 2',
    submission: {
      requestedProfile: 'FIELD_PROFESSIONAL', documentType: 'CEDULA_CIUDADANIA',
      documentNumber: '900300002', givenNames: 'Paula', familyNames: 'Demo Torres',
      birthDate: '1988-09-27', sexGenderCode: 'FEMENINO',
      phone: '3003000002', email: 'paula.visitador2@example.test',
    },
  },
  {
    id: 'visitador-3',
    label: 'Visitador demo 3',
    submission: {
      requestedProfile: 'FIELD_PROFESSIONAL', documentType: 'CEDULA_CIUDADANIA',
      documentNumber: '900300003', givenNames: 'Mateo', familyNames: 'Demo Silva',
      birthDate: '1992-12-03', sexGenderCode: 'MASCULINO',
      phone: '3003000003', email: 'mateo.visitador3@example.test',
    },
  },
];
