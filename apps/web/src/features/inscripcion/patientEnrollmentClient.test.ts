import { describe, expect, it } from 'vitest';

import { PACIENTE_VACIO } from './inscripcionFlow';
import type { DatosPaciente } from './inscripcionFlow';
import {
  LOCAL_UNIT_PENDING_NORMALIZATION,
  buildPatientEnrollmentRequest,
  fetchCurrentPatient,
  submitPatientEnrollment,
} from './patientEnrollmentClient';
import type { PatientEnrollmentRequest, PatientSummary } from './patientEnrollmentClient';

/**
 * Cliente de inscripción (TASK-MVP-CORE-01 §8, §12).
 *
 * Todos los datos son ficticios.
 */

const PACIENTE: DatosPaciente = {
  ...PACIENTE_VACIO,
  tipoDocumento: 'Cédula de ciudadanía',
  documento: ' 99.990.001 ',
  nombres: '  Ana María  ',
  apellidos: ' Ejemplo Ficticio ',
  fechaNacimiento: '1958-04-12',
  edad: 68,
  sexo: 'Femenino',
  telefono: ' 311 220 3355 ',
  telefonoAlterno: '604 444 5566',
  correo: ' Ana.Ejemplo@Correo.Ficticio ',
  mayor60: true,
  mayor60Automatico: true,
  discapacidad: true,
  tipoDiscapacidad: 'Física',
  registroRlcpd: 'Sí',
  requiereCuidadoCasa: true,
  tieneCuidador: 'No',
  apoyos: ['Ayuda para movilizarse'],
  diagnosticos: ['Hipertensión', 'Diabetes'],
  otrosDiagnosticos: ['Artrosis ficticia'],
  ubicacion: { departamento: '05', municipio: '05001', corregimiento: ' San Cristóbal ' },
  zona: 'RURAL',
  barrio: ' La Esperanza ',
  direccion: ' Cra 45 # 32-16 ',
  indicaciones: ' Casa azul detrás de la iglesia. ',
  eps: 'Nueva EPS',
  contactoNombre: 'Carlos Rodríguez',
  contactoParentesco: 'Hijo',
  contactoTelefono: '311 220 3355',
  vecinoNombre: 'Marta Vecina',
  vecinoTelefono: '311 111 2222',
  vecinoRelacion: 'Vecino',
  vecinoDireccion: 'Casa de al lado',
  autorizaVecino: true,
  autorizaDatos: true,
};

function respuesta(status: number, body: unknown = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('buildPatientEnrollmentRequest', () => {
  const request = buildPatientEnrollmentRequest(PACIENTE);

  it('traduce los catálogos de la interfaz a los códigos del contrato', () => {
    expect(request.documentType).toBe('CEDULA_CIUDADANIA');
    expect(request.sexGenderCode).toBe('FEMENINO');
    expect(request.epsCode).toBe('NUEVA_EPS');
  });

  it('recorta los textos y conserva la fecha de nacimiento', () => {
    expect(request.documentNumber).toBe('99.990.001');
    expect(request.givenNames).toBe('Ana María');
    expect(request.familyNames).toBe('Ejemplo Ficticio');
    expect(request.birthDate).toBe('1958-04-12');
    expect(request.phone).toBe('311 220 3355');
    expect(request.email).toBe('Ana.Ejemplo@Correo.Ficticio');
  });

  it('declara solo discapacidad y cuidado en casa, nunca la persona mayor', () => {
    expect(request.declaredPopulations).toStrictEqual([
      'DISABILITY',
      'HOME_CARE_REQUIRED',
    ]);
    expect(request.declaredPopulations).not.toContain('OLDER_ADULT_60_PLUS');
  });

  it('envía la zona declarada sin inferirla', () => {
    expect(request.territory.areaType).toBe('RURAL');
    expect(
      buildPatientEnrollmentRequest({ ...PACIENTE, zona: 'URBAN' }).territory.areaType,
    ).toBe('URBAN');
  });

  it('envía el barrio como texto declarado pendiente de normalización', () => {
    expect(request.territory.localUnitId).toBe(LOCAL_UNIT_PENDING_NORMALIZATION);
    expect(request.territory.localityDeclaredText).toBe('La Esperanza');
    expect(request.territory.settlementDeclaredText).toBe('San Cristóbal');
    expect(request.territory.departmentCode).toBe('05');
    expect(request.territory.municipalityCode).toBe('05001');
    expect(request.territory.exactAddress).toBe('Cra 45 # 32-16');
    expect(request.territory.directions).toBe('Casa azul detrás de la iglesia.');
  });

  it('omite el correo cuando la persona no lo escribe', () => {
    const sinCorreo = buildPatientEnrollmentRequest({ ...PACIENTE, correo: '   ' });
    expect('email' in sinCorreo).toBe(false);
  });

  it('omite las indicaciones y el corregimiento cuando están vacíos', () => {
    const minimo = buildPatientEnrollmentRequest({
      ...PACIENTE,
      indicaciones: '',
      ubicacion: { ...PACIENTE.ubicacion, corregimiento: '' },
    });

    expect('directions' in minimo.territory).toBe(false);
    expect('settlementDeclaredText' in minimo.territory).toBe(false);
  });

  it('no envía edad, clasificación derivada, tenant, estado ni procedencia', () => {
    const claves = Object.keys(request);

    for (const prohibida of [
      'edad',
      'age',
      'mayor60',
      'mayor60Automatico',
      'tenantId',
      'status',
      'origin',
      'createdBy',
      'enrolledAt',
    ]) {
      expect(claves).not.toContain(prohibida);
    }
  });

  it('no envía datos clínicos ni contactos fuera del mínimo aprobado', () => {
    const serializado = JSON.stringify(request);

    for (const dato of [
      'Hipertensión',
      'Diabetes',
      'Artrosis ficticia',
      'Física',
      'Ayuda para movilizarse',
      'Carlos Rodríguez',
      'Marta Vecina',
      'Casa de al lado',
      '604 444 5566',
    ]) {
      expect(serializado).not.toContain(dato);
    }

    const clavesTerritorio = Object.keys(request.territory);
    expect(clavesTerritorio).toStrictEqual([
      'departmentCode',
      'municipalityCode',
      'localUnitId',
      'localityDeclaredText',
      'areaType',
      'settlementDeclaredText',
      'exactAddress',
      'directions',
    ]);
  });

  it('traslada la aceptación del consentimiento sin inventar versión', () => {
    expect(request.consentAccepted).toBe(true);
    expect(JSON.stringify(request)).not.toContain('consentVersion');
    expect(JSON.stringify(request)).not.toContain('Ley 1581');
  });
});

describe('submitPatientEnrollment', () => {
  const request: PatientEnrollmentRequest = buildPatientEnrollmentRequest(PACIENTE);

  it('envía las credenciales de cookie y el cuerpo JSON', async () => {
    let capturado: RequestInit | undefined;

    await submitPatientEnrollment(request, (async (_url: string, init?: RequestInit) => {
      capturado = init;
      return respuesta(201, { status: 'ACTIVE' });
    }) as unknown as typeof fetch);

    expect(capturado?.method).toBe('POST');
    expect(capturado?.credentials).toBe('include');
    expect(JSON.parse(String(capturado?.body))).toStrictEqual(
      JSON.parse(JSON.stringify(request)),
    );
  });

  it('devuelve el paciente creado ante un 201', async () => {
    const resultado = await submitPatientEnrollment(request, (async () =>
      respuesta(201, { status: 'ACTIVE', givenNames: 'Ana María' })) as typeof fetch);

    expect(resultado.kind).toBe('created');
    expect(resultado.kind === 'created' && resultado.patient.givenNames).toBe('Ana María');
  });

  it('traduce el 409 a un conflicto con lenguaje claro y sin datos ajenos', async () => {
    const resultado = await submitPatientEnrollment(request, (async () =>
      respuesta(409, { code: 'PATIENT_DOCUMENT_CONFLICT' })) as typeof fetch);

    expect(resultado.kind).toBe('conflict');
    expect(resultado.kind === 'conflict' && resultado.message).toContain(
      'ya está inscrito',
    );
  });

  it('traduce 400 y 422 a un error recuperable', async () => {
    for (const status of [400, 422]) {
      const resultado = await submitPatientEnrollment(request, (async () =>
        respuesta(status, { code: 'ENROLLMENT_VALIDATION_FAILED' })) as typeof fetch);

      expect(resultado.kind).toBe('error');
      expect(resultado.kind === 'error' && resultado.message).toContain('Revise');
    }
  });

  it('traduce el 429 a un aviso de demasiados intentos', async () => {
    const resultado = await submitPatientEnrollment(request, (async () =>
      respuesta(429, { code: 'ENROLLMENT_RATE_LIMITED' })) as typeof fetch);

    expect(resultado.kind).toBe('error');
    expect(resultado.kind === 'error' && resultado.message).toContain('demasiados');
  });

  it('no lanza cuando la red falla', async () => {
    const resultado = await submitPatientEnrollment(request, (async () => {
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof fetch);

    expect(resultado.kind).toBe('error');
    expect(resultado.kind === 'error' && resultado.message).toContain('conectar');
  });

  it('no expone detalle técnico del servidor en el mensaje', async () => {
    const resultado = await submitPatientEnrollment(request, (async () =>
      respuesta(500, {
        message: 'PrismaClientKnownRequestError en postgres://usuario@host',
      })) as typeof fetch);

    expect(resultado.kind).toBe('error');
    const mensaje = resultado.kind === 'error' ? resultado.message : '';
    expect(mensaje).not.toContain('Prisma');
    expect(mensaje).not.toContain('postgres');
  });
});

describe('fetchCurrentPatient', () => {
  const PACIENTE_API: PatientSummary = {
    status: 'ACTIVE',
    enrolledAt: '2026-08-21T15:04:05.000Z',
    givenNames: 'Ana María',
    familyNames: 'Ejemplo Ficticio',
    age: 68,
    populations: [
      { populationType: 'OLDER_ADULT_60_PLUS', source: 'DERIVED_BIRTH_DATE' },
    ],
    territory: {
      departmentCode: '05',
      departmentName: 'ANTIOQUIA',
      municipalityCode: '05001',
      municipalityName: 'MEDELLÍN',
      localityName: null,
      localityPendingNormalization: true,
      areaType: 'URBAN',
    },
    epsCode: 'NUEVA_EPS',
    epsName: 'Nueva EPS',
  };

  it('pide la sesión por cookie y sin caché', async () => {
    let capturado: RequestInit | undefined;

    await fetchCurrentPatient((async (_url: string, init?: RequestInit) => {
      capturado = init;
      return respuesta(200, PACIENTE_API);
    }) as unknown as typeof fetch);

    expect(capturado?.method).toBe('GET');
    expect(capturado?.credentials).toBe('include');
    expect(capturado?.cache).toBe('no-store');
  });

  it('devuelve el paciente de la sesión vigente', async () => {
    const paciente = await fetchCurrentPatient((async () =>
      respuesta(200, PACIENTE_API)) as typeof fetch);

    expect(paciente?.givenNames).toBe('Ana María');
  });

  it('devuelve null ante 401 y ante fallo de red, sin distinguirlos', async () => {
    const sinSesion = await fetchCurrentPatient((async () =>
      respuesta(401, { code: 'ENROLLMENT_SESSION_REQUIRED' })) as typeof fetch);
    const sinRed = await fetchCurrentPatient((async () => {
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof fetch);

    expect(sinSesion).toBeNull();
    expect(sinRed).toBeNull();
  });
});
