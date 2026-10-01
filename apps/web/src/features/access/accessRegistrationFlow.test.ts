import { describe, expect, it } from 'vitest';

import {
  cambiarPaso,
  construirCuerpo,
  construirRegistro,
  crearBloqueoEnvio,
  edadEnAnios,
  elegirPerfil,
  ESTADO_INICIAL,
  idDeCampo,
  pasoDeCampo,
  purgarCondicionales,
  registroVacio,
  validarPaso,
  validarPasoFinal,
  volverAlSelector,
  type CaregiverRegDraft,
  type PatientRegDraft,
  type ProfessionalRegDraft,
  type RegistrationState,
} from './accessRegistrationFlow';

type Rama = Extract<RegistrationState, { pantalla: 'rama' }>;

const BASE_COMPLETA = {
  documentType: 'CEDULA_CIUDADANIA',
  documentNumber: '900100001',
  givenNames: 'Aurora',
  familyNames: 'Demo Salcedo',
  birthDate: '1950-03-16',
  sexGenderCode: 'FEMENINO',
  phone: '3001000001',
  email: 'aurora.demo1@example.test',
} as const;

describe('estado de la inscripcion de cinco pasos', () => {
  it('empieza en el selector, sin rama ni datos', () => {
    expect(ESTADO_INICIAL).toEqual({ pantalla: 'selector' });
  });

  it('elegir perfil abre su rama en el paso 1 con todo vacio', () => {
    for (const perfil of ['PATIENT', 'CAREGIVER', 'FIELD_PROFESSIONAL'] as const) {
      const estado = elegirPerfil(perfil);

      expect(estado).toEqual({
        pantalla: 'rama',
        perfil,
        paso: 1,
        base: {
          documentType: 'CEDULA_CIUDADANIA',
          documentNumber: '',
          givenNames: '',
          familyNames: '',
          birthDate: '',
          sexGenderCode: 'FEMENINO',
          phone: '',
          email: '',
        },
        password: '',
        reg: registroVacio(perfil),
      });
    }
  });

  it('moverse entre los cinco pasos conserva la rama', () => {
    let estado = elegirPerfil('PATIENT') as Rama;

    for (const paso of [2, 3, 4, 5, 4, 3, 2, 1] as const) {
      estado = cambiarPaso(estado, paso) as Rama;
      expect(estado.paso).toBe(paso);
      expect(estado.perfil).toBe('PATIENT');
    }
  });

  it('cambiar de perfil borra todo: no queda borrador, paso, clave ni errores', () => {
    expect(volverAlSelector()).toEqual({ pantalla: 'selector' });
  });
});
describe('validacion del paso 1 (identidad y contacto)', () => {
  it('exige documento, nombres, apellidos, nacimiento y un contacto en orden', () => {
    const vacia = elegirPerfil('PATIENT') as Rama;

    expect(validarPaso('PATIENT', 1, vacia.base, vacia.reg, '')).toBe('documentNumber');
    expect(
      validarPaso(
        'PATIENT',
        1,
        { ...vacia.base, documentNumber: '1', givenNames: 'A', familyNames: 'B', birthDate: '2000-01-01' },
        vacia.reg,
        '',
      ),
    ).toBe('phone');
    expect(validarPaso('PATIENT', 1, { ...BASE_COMPLETA }, vacia.reg, '')).toBeNull();
  });
});
describe('validacion paciente', () => {
  const reg = registroVacio('PATIENT') as PatientRegDraft;

  it('el paso 2 exige necesidad, apoyos condicionales y condiciones', () => {
    expect(validarPaso('PATIENT', 2, BASE_COMPLETA, reg, '')).toBe('necesitaApoyo');
    expect(
      validarPaso('PATIENT', 2, BASE_COMPLETA, { ...reg, necesitaApoyo: 'SI' }, ''),
    ).toBe('apoyos');
    expect(
      validarPaso(
        'PATIENT',
        2,
        BASE_COMPLETA,
        { ...reg, necesitaApoyo: 'NO', condiciones: ['NINGUNA'] },
        '',
      ),
    ).toBeNull();
  });

  it('el paso 3 exige zona, eps y direccion', () => {
    expect(validarPaso('PATIENT', 3, BASE_COMPLETA, reg, '')).toBe('zona');
    expect(
      validarPaso('PATIENT', 3, BASE_COMPLETA, { ...reg, zona: 'URBANA' }, ''),
    ).toBe('direccion');
  });

  it('el paso 4 exige contactos y autorizacion del vecino', () => {
    const incompleto: PatientRegDraft = {
      ...reg,
      necesitaApoyo: 'NO',
      condiciones: ['NINGUNA'],
      zona: 'URBANA',
      direccion: 'Cra 1',
      contactoNombre: 'Carlos',
      contactoParentesco: 'Hijo',
      contactoTelefono: '300',
      vecinoNombre: 'Rosa',
      vecinoTelefono: '311',
      vecinoAutorizado: false,
    };

    expect(validarPaso('PATIENT', 4, BASE_COMPLETA, incompleto, '')).toBe('vecinoAutorizado');
    expect(
      validarPaso('PATIENT', 4, BASE_COMPLETA, { ...incompleto, vecinoAutorizado: true }, ''),
    ).toBeNull();
  });
});

describe('validacion cuidador', () => {
  const reg = registroVacio('CAREGIVER') as CaregiverRegDraft;

  it('el paso 2 exige formacion, convivencia y horarios', () => {
    expect(validarPaso('CAREGIVER', 2, BASE_COMPLETA, reg, '')).toBe('tieneFormacion');
    expect(
      validarPaso('CAREGIVER', 2, BASE_COMPLETA, { ...reg, tieneFormacion: 'NO' }, ''),
    ).toBe('viveConPaciente');
    expect(
      validarPaso(
        'CAREGIVER',
        2,
        BASE_COMPLETA,
        { ...reg, tieneFormacion: 'NO', viveConPaciente: 'SI' },
        '',
      ),
    ).toBe('horarios');
  });

  it('el paso 3 exige el estado del registro del paciente', () => {
    expect(validarPaso('CAREGIVER', 3, BASE_COMPLETA, reg, '')).toBe('pacienteRegistrado');
    expect(
      validarPaso('CAREGIVER', 3, BASE_COMPLETA, { ...reg, pacienteRegistrado: 'NO' }, ''),
    ).toBeNull();
  });

  it('el paso 4 exige contacto cercano con autorizacion', () => {
    expect(validarPaso('CAREGIVER', 4, BASE_COMPLETA, reg, '')).toBe('vecinoNombre');
  });
});

describe('validacion visitador', () => {
  const reg = registroVacio('FIELD_PROFESSIONAL') as ProfessionalRegDraft;

  it('el paso 2 no bloquea: profesion con valor y atencion opcional', () => {
    expect(validarPaso('FIELD_PROFESSIONAL', 2, BASE_COMPLETA, reg, '')).toBeNull();
  });

  it('el paso 3 exige ubicacion institucional y otra EPS condicional', () => {
    expect(validarPaso('FIELD_PROFESSIONAL', 3, BASE_COMPLETA, reg, '')).toBe(
      'institucionDepartamento',
    );
    expect(
      validarPaso(
        'FIELD_PROFESSIONAL',
        3,
        BASE_COMPLETA,
        { ...reg, institucionDepartamento: 'Cundinamarca', institucionMunicipio: 'Soacha' },
        '',
      ),
    ).toBeNull();
    expect(
      validarPaso(
        'FIELD_PROFESSIONAL',
        3,
        BASE_COMPLETA,
        {
          ...reg,
          eps: 'OTRA_EPS',
          institucionDepartamento: 'Cundinamarca',
          institucionMunicipio: 'Soacha',
        },
        '',
      ),
    ).toBe('otraEps');
  });

  it('el paso 4 exige la zona de atencion', () => {
    expect(validarPaso('FIELD_PROFESSIONAL', 4, BASE_COMPLETA, reg, '')).toBe('zonaDepartamento');
  });
});

describe('validacion del paso 5', () => {
  it('exige clave valida y autorizacion en las tres ramas', () => {
    for (const perfil of ['PATIENT', 'CAREGIVER', 'FIELD_PROFESSIONAL'] as const) {
      const reg = registroVacio(perfil);

      expect(validarPaso(perfil, 5, BASE_COMPLETA, reg, '')).toBe('password');
      expect(validarPaso(perfil, 5, BASE_COMPLETA, reg, 'ClaveDemo123')).toBe('autorizaDatos');
    }
  });

  it('detalla el problema de la clave sin exponerla', () => {
    expect(validarPasoFinal('corta1', false)).toEqual({ campo: 'password', problema: 'tooShort' });
    expect(validarPasoFinal('ClaveDemo123', false)).toEqual({ campo: 'autorizaDatos' });
    expect(validarPasoFinal('ClaveDemo123', true)).toBeNull();
  });
});

describe('condicionales: ocultar implica eliminar', () => {
  it('apoyos se vacia sin necesidad declarada', () => {
    const reg = registroVacio('PATIENT') as PatientRegDraft;
    const purgado = purgarCondicionales('PATIENT', {
      ...reg,
      necesitaApoyo: 'NO',
      apoyos: ['MOVILIZARSE'],
    }) as PatientRegDraft;

    expect(purgado.apoyos).toEqual([]);
  });

  it('institucion se restablece sin formacion y el vecino se borra sin autorizacion', () => {
    const reg = registroVacio('CAREGIVER') as CaregiverRegDraft;
    const purgado = purgarCondicionales('CAREGIVER', {
      ...reg,
      tieneFormacion: 'NO',
      institucionFormacion: 'SENA',
      vecinoAutorizado: false,
      vecinoNombre: 'Rosa',
      vecinoTelefono: '311',
      vecinoDireccion: 'Casa',
    }) as CaregiverRegDraft;

    expect(purgado.institucionFormacion).toBe('SENA');
    expect(purgado.vecinoNombre).toBe('');
    expect(purgado.vecinoTelefono).toBe('');
    expect(purgado.vecinoDireccion).toBe('');
  });

  it('otra EPS se borra sin su marca', () => {
    const reg = registroVacio('FIELD_PROFESSIONAL') as ProfessionalRegDraft;
    const purgado = purgarCondicionales('FIELD_PROFESSIONAL', {
      ...reg,
      eps: 'NUEVA_EPS',
      otraEps: 'EPS Ficticia',
    }) as ProfessionalRegDraft;

    expect(purgado.otraEps).toBe('');
  });
});

describe('regreso ante un invalid del servidor', () => {
  it('cada campo pertenece a su paso segun la rama', () => {
    expect(pasoDeCampo('PATIENT', 'apoyos')).toBe(2);
    expect(pasoDeCampo('PATIENT', 'direccion')).toBe(3);
    expect(pasoDeCampo('PATIENT', 'vecinoNombre')).toBe(4);
    expect(pasoDeCampo('PATIENT', 'password')).toBe(5);
    expect(pasoDeCampo('CAREGIVER', 'horarios')).toBe(2);
    expect(pasoDeCampo('CAREGIVER', 'relacionPaciente')).toBe(3);
    expect(pasoDeCampo('CAREGIVER', 'vecinoDireccion')).toBe(4);
    expect(pasoDeCampo('FIELD_PROFESSIONAL', 'tiposAtencion')).toBe(2);
    expect(pasoDeCampo('FIELD_PROFESSIONAL', 'cargo')).toBe(3);
    expect(pasoDeCampo('FIELD_PROFESSIONAL', 'zonas')).toBe(4);
    expect(pasoDeCampo('FIELD_PROFESSIONAL', 'autorizaDatos')).toBe(5);
  });

  it('un nombre desconocido no pertenece a ningun paso', () => {
    expect(pasoDeCampo('PATIENT', 'tenantId')).toBeNull();
    expect(pasoDeCampo('CAREGIVER', '')).toBeNull();
  });

  it('cada campo tiene su identificador DOM', () => {
    expect(idDeCampo('apoyos')).toBe('registro-apoyos');
    expect(idDeCampo('password')).toBe('registro-password');
  });
});

describe('cuerpo del POST', () => {
  const paciente: PatientRegDraft = {
    ...(registroVacio('PATIENT') as PatientRegDraft),
    necesitaApoyo: 'SI',
    apoyos: ['MOVILIZARSE'],
    condiciones: ['NINGUNA'],
    zona: 'URBANA',
    eps: 'NUEVA_EPS',
    direccion: 'Cra 45 # 32-16',
    contactoNombre: 'Carlos Ejemplo',
    contactoParentesco: 'Hijo',
    contactoTelefono: '311 220 3355',
    vecinoNombre: 'Rosa Ficticia',
    vecinoTelefono: '312 778 4410',
    vecinoAutorizado: true,
    autorizaDatos: true,
  };

  it('cada tarjeta deriva su codigo tecnico con expediente canonico', () => {
    const cuerpo = construirCuerpo('PATIENT', { ...BASE_COMPLETA }, 'ClaveDemo123', paciente);

    expect(cuerpo.requestedProfile).toBe('PATIENT');
    expect(Object.keys(cuerpo).sort()).toEqual(
      [
        'birthDate',
        'documentNumber',
        'documentType',
        'email',
        'familyNames',
        'givenNames',
        'password',
        'phone',
        'registration',
        'requestedProfile',
        'sexGenderCode',
      ].sort(),
    );

    const expediente = cuerpo.registration as Record<string, unknown>;
    expect(expediente['necesitaApoyo']).toBe('SI');
    expect(expediente['vecinoAutorizado']).toBe(true);
    expect('password' in expediente).toBe(false);
  });

  it('omite los opcionales vacios del visitador', () => {
    const visitador: ProfessionalRegDraft = {
      ...(registroVacio('FIELD_PROFESSIONAL') as ProfessionalRegDraft),
      institucionDepartamento: 'Cundinamarca',
      institucionMunicipio: 'Soacha',
      zonaDepartamento: 'Cundinamarca',
      zonaMunicipio: 'Soacha',
    };
    const expediente = construirRegistro('FIELD_PROFESSIONAL', visitador);

    expect('otraEps' in expediente).toBe(false);
    expect('institucion' in expediente).toBe(false);
    expect('cargo' in expediente).toBe(false);
    expect('sector' in expediente).toBe(false);
    expect(expediente['tiposAtencion']).toEqual([]);
  });

  it('el borrado por desautorizacion llega al cuerpo', () => {
    const sinVecino = purgarCondicionales('PATIENT', {
      ...paciente,
      vecinoAutorizado: false,
      vecinoNombre: 'Rosa',
      vecinoTelefono: '311',
    }) as PatientRegDraft;
    const expediente = construirRegistro('PATIENT', sinVecino) as Record<string, unknown>;

    expect(expediente['vecinoNombre']).toBe('');
    expect(expediente['vecinoTelefono']).toBe('');
  });
});

describe('edad derivada solo para UI', () => {
  it('calcula años cumplidos sin viajar en el cuerpo', () => {
    expect(edadEnAnios('1950-03-16', '2026-10-01')).toBe(76);
    expect(edadEnAnios('2000-12-31', '2026-01-01')).toBe(25);
    expect(edadEnAnios('', '2026-10-01')).toBeNull();
    expect(edadEnAnios('no-fecha', '2026-10-01')).toBeNull();
    expect(edadEnAnios('2025-02-30', '2026-10-01')).toBeNull();
    expect(edadEnAnios('2999-01-01', '2026-10-01')).toBeNull();
  });

  it('el cuerpo no incluye edad ni indicador', () => {
    const cuerpo = construirCuerpo('PATIENT', { ...BASE_COMPLETA }, 'ClaveDemo123', {
      ...(registroVacio('PATIENT') as PatientRegDraft),
      necesitaApoyo: 'NO',
      condiciones: ['NINGUNA'],
      zona: 'URBANA',
      eps: 'NUEVA_EPS',
      direccion: 'Cra 1',
      contactoNombre: 'A',
      contactoParentesco: 'B',
      contactoTelefono: '300',
      vecinoNombre: 'C',
      vecinoTelefono: '311',
      vecinoAutorizado: true,
      autorizaDatos: true,
    });

    expect('edad' in cuerpo).toBe(false);
    expect(JSON.stringify(cuerpo)).not.toContain('76');
  });
});

describe('bloqueo de envio', () => {
  it('el segundo intento en curso se rechaza y tras liberar se acepta', () => {
    const bloqueo = crearBloqueoEnvio();

    expect(bloqueo.intentar()).toBe(true);
    expect(bloqueo.intentar()).toBe(false);

    bloqueo.liberar();
    expect(bloqueo.intentar()).toBe(true);
  });
});
