import { describe, expect, it } from 'vitest';

import {
  DIAGNOSTICO_NINGUNA,
  DIAGNOSTICO_OTROS,
  DIAGNOSTICOS,
  ESTADO_INICIAL,
  TOTAL_PASOS,
  campoOtroDiagnostico,
  edadEnAnios,
  inscripcionReducer,
  textoClasificacion,
  textoDiagnosticos,
  validarPaso,
} from './inscripcionFlow';
import type {
  DatosCuidador,
  DatosPaciente,
  InscripcionAction,
  InscripcionState,
  PerfilId,
} from './inscripcionFlow';

/** Aplica una secuencia de acciones sobre el estado inicial. */
function reducir(
  acciones: readonly InscripcionAction[],
  desde: InscripcionState = ESTADO_INICIAL,
): InscripcionState {
  return acciones.reduce(inscripcionReducer, desde);
}

function elegir(perfil: PerfilId): InscripcionAction {
  return { type: 'elegirPerfil', perfil };
}

/* Datos ficticios. Códigos reales del catálogo DIVIPOLA local. */
const CUNDINAMARCA = '25';
const SOACHA = '25754';
const ANTIOQUIA = '05';
const MEDELLIN = '05001';

/** Identificación mínima que las tres ramas comparten en el paso 1. */
const IDENTIFICACION_VALIDA = {
  documento: '1032455789',
  nombres: 'María',
  telefono: '300 456 7890',
} as const;

/** Paso 1 completo de la rama Paciente: todos sus datos son obligatorios. */
const PACIENTE_PASO_1: Partial<DatosPaciente> = {
  ...IDENTIFICACION_VALIDA,
  apellidos: 'Rodríguez',
  fechaNacimiento: '1958-04-12',
  telefonoAlterno: '601 234 5678',
  correo: 'maria.rodriguez@correo.com',
};

const PACIENTE_PASO_3: Partial<DatosPaciente> = {
  zona: 'URBAN',
  barrio: 'La Esperanza',
  direccion: 'Cra 45 # 32-16',
  indicaciones: 'Casa azul detrás de la iglesia.',
};

const PACIENTE_PASO_4: Partial<DatosPaciente> = {
  contactoNombre: 'Carlos Rodríguez',
  contactoParentesco: 'Hijo',
  contactoTelefono: '311 220 3355',
  vecinoNombre: 'Rosa Delgado',
  vecinoTelefono: '312 778 4410',
  vecinoDireccion: 'Casa de al lado, puerta verde',
  autorizaVecino: true,
};

const CUIDADOR_PASO_1: Partial<DatosCuidador> = {
  ...IDENTIFICACION_VALIDA,
  nombres: 'Lucía',
  apellidos: 'Castro',
  fechaNacimiento: '1990-02-20',
  correo: 'lucia.castro@correo.com',
  direccion: 'Calle 10 # 4-22',
};

function ubicacionCompleta(
  grupo: 'principal' | 'institucion',
  departamento: string,
  municipio: string,
): readonly InscripcionAction[] {
  return [
    { type: 'elegirDepartamento', grupo, codigo: departamento },
    { type: 'elegirMunicipio', grupo, codigo: municipio },
    { type: 'escribirCorregimiento', grupo, texto: 'San Antonio' },
  ];
}

function pacienteDe(state: InscripcionState): DatosPaciente {
  if (state.rama === null || state.rama.perfil !== 'paciente') {
    throw new Error('El estado no corresponde a la rama Paciente.');
  }
  return state.rama.valores;
}

function cuidadorDe(state: InscripcionState): DatosCuidador {
  if (state.rama === null || state.rama.perfil !== 'cuidador') {
    throw new Error('El estado no corresponde a la rama Cuidador.');
  }
  return state.rama.valores;
}

describe('selección de perfil (FR-02)', () => {
  it('no muestra ninguna rama antes de elegir', () => {
    expect(ESTADO_INICIAL.perfil).toBeNull();
    expect(ESTADO_INICIAL.rama).toBeNull();
  });

  it('cada opción abre exclusivamente su rama, en el paso 1', () => {
    for (const perfil of ['paciente', 'cuidador', 'visitador'] as const) {
      const state = reducir([elegir(perfil)]);
      expect(state.perfil).toBe(perfil);
      expect(state.rama?.perfil).toBe(perfil);
      expect(state.paso).toBe(1);
      expect(state.terminada).toBe(false);
    }
  });
});

describe('aislamiento y limpieza del estado (FR-03)', () => {
  it('cambiar de rol descarta por completo los valores de la rama anterior', () => {
    const conPaciente = reducir([
      elegir('paciente'),
      { type: 'actualizarPaciente', patch: PACIENTE_PASO_1 },
      { type: 'alternarClasificacion', clave: 'discapacidad' },
      ...ubicacionCompleta('principal', CUNDINAMARCA, SOACHA),
    ]);
    expect(pacienteDe(conPaciente).documento).toBe('1032455789');
    expect(pacienteDe(conPaciente).ubicacion.municipio).toBe(SOACHA);

    const trasCambiar = reducir([{ type: 'reiniciar' }, elegir('cuidador')], conPaciente);

    expect(trasCambiar.rama?.perfil).toBe('cuidador');
    expect(trasCambiar.rama?.valores.documento).toBe('');
    expect(trasCambiar.rama?.valores.nombres).toBe('');
    expect(cuidadorDe(trasCambiar).ubicacion).toEqual({
      departamento: '',
      municipio: '',
      corregimiento: '',
    });
  });

  it('volver a elegir la misma rama tampoco conserva valores', () => {
    const state = reducir([
      elegir('paciente'),
      { type: 'actualizarPaciente', patch: PACIENTE_PASO_1 },
      elegir('paciente'),
    ]);

    expect(pacienteDe(state).documento).toBe('');
  });

  it('«Atrás» desde el primer paso vuelve a la selección y limpia la rama', () => {
    const state = reducir([
      elegir('visitador'),
      { type: 'actualizarVisitador', patch: IDENTIFICACION_VALIDA },
      { type: 'atras' },
    ]);

    expect(state).toEqual(ESTADO_INICIAL);
  });
});

describe('recorrido de cinco pasos por rama', () => {
  it('la rama Paciente termina exactamente en el paso 5 con todos sus datos', () => {
    let state = reducir([
      elegir('paciente'),
      { type: 'actualizarPaciente', patch: PACIENTE_PASO_1 },
      { type: 'siguiente' },
    ]);
    expect(state.paso).toBe(2);

    state = reducir(
      [
        { type: 'alternarClasificacion', clave: 'mayor60' },
        { type: 'alternarDiagnostico', valor: 'Hipertensión' },
        { type: 'siguiente' },
      ],
      state,
    );
    expect(state.paso).toBe(3);

    state = reducir(
      [
        ...ubicacionCompleta('principal', CUNDINAMARCA, SOACHA),
        { type: 'actualizarPaciente', patch: PACIENTE_PASO_3 },
        { type: 'siguiente' },
      ],
      state,
    );
    expect(state.paso).toBe(4);

    state = reducir(
      [{ type: 'actualizarPaciente', patch: PACIENTE_PASO_4 }, { type: 'siguiente' }],
      state,
    );
    expect(state.paso).toBe(TOTAL_PASOS);
    expect(state.terminada).toBe(false);

    state = reducir(
      [
        { type: 'actualizarPaciente', patch: { autorizaDatos: true } },
        { type: 'siguiente' },
      ],
      state,
    );

    // TASK-MVP-CORE-01 §8.4: la rama Paciente no se da por terminada al
    // confirmar. Primero pasa a «enviando» y solo llega al cierre tras un 201.
    expect(state.terminada).toBe(false);
    expect(state.envio.estado).toBe('enviando');
    expect(state.paso).toBe(TOTAL_PASOS);

    state = inscripcionReducer(state, { type: 'envioExitoso' });

    expect(state.terminada).toBe(true);
    expect(state.envio.estado).toBe('inactivo');
    expect(state.paso).toBe(TOTAL_PASOS);
  });

  it('no permite saltar a un paso fuera del rango de la rama', () => {
    const base = reducir([elegir('cuidador')]);

    expect(inscripcionReducer(base, { type: 'irAPaso', paso: 6 }).paso).toBe(1);
    expect(inscripcionReducer(base, { type: 'irAPaso', paso: 0 }).paso).toBe(1);
    expect(inscripcionReducer(base, { type: 'irAPaso', paso: 4 }).paso).toBe(4);
  });

  it('retroceder conserva lo diligenciado', () => {
    const state = reducir([
      elegir('visitador'),
      { type: 'actualizarVisitador', patch: IDENTIFICACION_VALIDA },
      { type: 'siguiente' },
      { type: 'actualizarVisitador', patch: { profesion: 'Enfermero' } },
      { type: 'atras' },
    ]);

    expect(state.paso).toBe(1);
    expect(state.rama?.valores.documento).toBe('1032455789');
  });
});

describe('validación local (FR-04)', () => {
  it('bloquea el paso 1 sin documento, nombres ni teléfono, y señala el primer error', () => {
    const state = reducir([elegir('paciente'), { type: 'siguiente' }]);

    expect(state.paso).toBe(1);
    expect(state.errores['documento']).toBeDefined();
    expect(state.errores['nombres']).toBeDefined();
    expect(state.errores['telefono']).toBeDefined();
    expect(state.campoFoco).toBe('documento');
  });

  it('repite el foco en cada intento fallido', () => {
    const primero = reducir([elegir('paciente'), { type: 'siguiente' }]);
    const segundo = inscripcionReducer(primero, { type: 'siguiente' });

    expect(segundo.focoNonce).toBe(primero.focoNonce + 1);
  });

  it('rechaza un teléfono que no sea numérico', () => {
    const state = reducir([
      elegir('cuidador'),
      { type: 'actualizarCuidador', patch: { ...IDENTIFICACION_VALIDA, telefono: 'no sé' } },
      { type: 'siguiente' },
    ]);

    expect(state.paso).toBe(1);
    expect(state.errores['telefono']).toBe('Escriba el teléfono solo con números.');
  });

  it('exige la autorización de datos para terminar cualquier rama', () => {
    for (const perfil of ['paciente', 'cuidador', 'visitador'] as const) {
      const rama = reducir([elegir(perfil)]);
      expect(validarPaso(rama.rama!, 5)['autorizaDatos']).toBeDefined();
    }
  });
});

describe('todos los datos de Paciente y Cuidador son obligatorios (FR-04)', () => {
  it('el paso 1 del Paciente exige también apellidos, fecha y teléfono alterno', () => {
    const state = reducir([
      elegir('paciente'),
      { type: 'actualizarPaciente', patch: IDENTIFICACION_VALIDA },
      { type: 'siguiente' },
    ]);

    expect(state.paso).toBe(1);
    for (const campo of ['apellidos', 'fechaNacimiento', 'telefonoAlterno']) {
      expect(state.errores[campo]).toBeDefined();
    }
  });

  /*
   * TASK-MVP-CORE-01 §7 y decisión cerrada 18.7: el correo del Paciente pasa a
   * ser opcional. La rama Cuidador conserva su regla aprobada, porque su
   * persistencia está fuera del alcance de CORE-01.
   */
  it('el correo del Paciente es opcional y no bloquea el paso 1', () => {
    const state = reducir([
      elegir('paciente'),
      { type: 'actualizarPaciente', patch: { ...PACIENTE_PASO_1, correo: '' } },
      { type: 'siguiente' },
    ]);

    expect(state.errores['correo']).toBeUndefined();
    expect(state.paso).toBe(2);
  });

  it('el correo del Cuidador sigue siendo obligatorio', () => {
    const state = reducir([
      elegir('cuidador'),
      { type: 'actualizarCuidador', patch: IDENTIFICACION_VALIDA },
      { type: 'siguiente' },
    ]);

    expect(state.errores['correo']).toBeDefined();
  });

  it('rechaza un correo con formato inequívocamente inválido', () => {
    const state = reducir([
      elegir('paciente'),
      {
        type: 'actualizarPaciente',
        patch: { ...PACIENTE_PASO_1, correo: 'maria.rodriguez' },
      },
      { type: 'siguiente' },
    ]);

    expect(state.paso).toBe(1);
    expect(state.errores['correo']).toContain('nombre@dominio.com');
  });

  it('el paso 3 del Paciente exige declarar la zona urbana o rural', () => {
    const sinZona = reducir([
      elegir('paciente'),
      { type: 'irAPaso', paso: 3 },
      ...ubicacionCompleta('principal', CUNDINAMARCA, SOACHA),
      { type: 'actualizarPaciente', patch: { ...PACIENTE_PASO_3, zona: '' } },
      { type: 'siguiente' },
    ]);

    expect(sinZona.paso).toBe(3);
    expect(sinZona.errores['zona']).toBe('Indique si vive en zona urbana o rural.');

    const conZona = reducir([
      elegir('paciente'),
      { type: 'irAPaso', paso: 3 },
      ...ubicacionCompleta('principal', CUNDINAMARCA, SOACHA),
      { type: 'actualizarPaciente', patch: { ...PACIENTE_PASO_3, zona: 'RURAL' } },
      { type: 'siguiente' },
    ]);

    expect(conZona.errores['zona']).toBeUndefined();
    expect(conZona.paso).toBe(4);
  });

  it('el paso 3 del Paciente exige barrio, dirección e indicaciones', () => {
    const state = reducir([
      elegir('paciente'),
      { type: 'irAPaso', paso: 3 },
      ...ubicacionCompleta('principal', CUNDINAMARCA, SOACHA),
      { type: 'siguiente' },
    ]);

    expect(state.paso).toBe(3);
    for (const campo of ['barrio', 'direccion', 'indicaciones']) {
      expect(state.errores[campo]).toBeDefined();
    }
  });

  it('el paso 4 del Paciente exige el contacto familiar completo', () => {
    const state = reducir([
      elegir('paciente'),
      { type: 'irAPaso', paso: 4 },
      { type: 'siguiente' },
    ]);

    expect(state.paso).toBe(4);
    for (const campo of [
      'contactoNombre',
      'contactoParentesco',
      'contactoTelefono',
      'vecinoNombre',
      'vecinoTelefono',
      'vecinoDireccion',
      'autorizaVecino',
    ]) {
      expect(state.errores[campo]).toBeDefined();
    }
  });

  it('el Cuidador no avanza mientras falte cualquier dato de su paso 1', () => {
    const incompleto = reducir([
      elegir('cuidador'),
      { type: 'actualizarCuidador', patch: CUIDADOR_PASO_1 },
      { type: 'siguiente' },
    ]);

    expect(incompleto.paso).toBe(1);
    expect(incompleto.errores['cuidadorDepartamento']).toBeDefined();
    expect(incompleto.errores['cuidadorMunicipio']).toBeDefined();
    expect(incompleto.errores['cuidadorCorregimiento']).toBeDefined();

    const completo = reducir(
      [...ubicacionCompleta('principal', ANTIOQUIA, MEDELLIN), { type: 'siguiente' }],
      incompleto,
    );
    expect(completo.paso).toBe(2);
  });

  it('el paso 2 del Cuidador exige tipo, formación, convivencia y horarios', () => {
    const state = reducir([
      elegir('cuidador'),
      { type: 'irAPaso', paso: 2 },
      { type: 'siguiente' },
    ]);

    expect(state.paso).toBe(2);
    expect(state.errores['tieneFormacion']).toBeDefined();
    expect(state.errores['viveConPaciente']).toBeDefined();
    expect(state.errores['horarios']).toBeDefined();
  });
});

describe('campos condicionales: obligatorios mientras se ven, limpios al ocultarse (FR-04)', () => {
  it('marcar discapacidad exige el RLCPD y desmarcarla lo borra', () => {
    const conDiscapacidad = reducir([
      elegir('paciente'),
      { type: 'irAPaso', paso: 2 },
      { type: 'alternarClasificacion', clave: 'discapacidad' },
      { type: 'alternarDiagnostico', valor: DIAGNOSTICO_NINGUNA },
      { type: 'siguiente' },
    ]);

    expect(conDiscapacidad.paso).toBe(2);
    expect(conDiscapacidad.errores['registroRlcpd']).toBeDefined();

    const respondido = reducir(
      [{ type: 'actualizarPaciente', patch: { registroRlcpd: 'Sí' } }],
      conDiscapacidad,
    );
    expect(pacienteDe(respondido).registroRlcpd).toBe('Sí');

    const sinDiscapacidad = inscripcionReducer(respondido, {
      type: 'alternarClasificacion',
      clave: 'discapacidad',
    });
    expect(pacienteDe(sinDiscapacidad).registroRlcpd).toBe('');
    expect(sinDiscapacidad.errores).toEqual({});
  });

  it('requerir cuidados en casa exige cuidador y apoyos, y al desmarcarlo se limpian', () => {
    const marcado = reducir([
      elegir('paciente'),
      { type: 'irAPaso', paso: 2 },
      { type: 'alternarClasificacion', clave: 'requiereCuidadoCasa' },
      { type: 'alternarDiagnostico', valor: DIAGNOSTICO_NINGUNA },
      { type: 'siguiente' },
    ]);

    expect(marcado.errores['tieneCuidador']).toBeDefined();
    expect(marcado.errores['apoyos']).toBeDefined();

    const respondido = reducir(
      [
        {
          type: 'actualizarPaciente',
          patch: { tieneCuidador: 'Sí', apoyos: ['Alimentación'] },
        },
      ],
      marcado,
    );
    expect(pacienteDe(respondido).apoyos).toEqual(['Alimentación']);

    const desmarcado = inscripcionReducer(respondido, {
      type: 'alternarClasificacion',
      clave: 'requiereCuidadoCasa',
    });
    expect(pacienteDe(desmarcado).tieneCuidador).toBe('');
    expect(pacienteDe(desmarcado).apoyos).toEqual([]);
  });

  it('la formación del Cuidador se exige solo mientras está declarada', () => {
    const conFormacion = reducir([
      elegir('cuidador'),
      { type: 'irAPaso', paso: 2 },
      {
        type: 'actualizarCuidador',
        patch: { tieneFormacion: 'Sí', viveConPaciente: 'Sí', horarios: ['Mañana'] },
      },
      { type: 'siguiente' },
    ]);

    expect(conFormacion.paso).toBe(2);
    expect(conFormacion.errores['tipoCertificacion']).toBeDefined();
    expect(conFormacion.errores['fechaCertificacion']).toBeDefined();

    const conDatos = reducir(
      [
        {
          type: 'actualizarCuidador',
          patch: {
            tipoCertificacion: 'Cuidado del adulto mayor',
            fechaCertificacion: '2024-05-01',
          },
        },
      ],
      conFormacion,
    );
    expect(cuidadorDe(conDatos).tipoCertificacion).toBe('Cuidado del adulto mayor');

    const sinFormacion = reducir(
      [
        { type: 'actualizarCuidador', patch: { tieneFormacion: 'No' } },
        { type: 'siguiente' },
      ],
      conDatos,
    );
    expect(cuidadorDe(sinFormacion).tipoCertificacion).toBe('');
    expect(cuidadorDe(sinFormacion).fechaCertificacion).toBe('');
    expect(sinFormacion.paso).toBe(3);
  });
});

describe('ubicación territorial DIVIPOLA (FR-04A)', () => {
  it('Departamento y Municipio son obligatorios en las tres ramas', () => {
    const paciente = reducir([elegir('paciente'), { type: 'irAPaso', paso: 3 }]);
    expect(validarPaso(paciente.rama!, 3)['pacienteDepartamento']).toBeDefined();
    expect(validarPaso(paciente.rama!, 3)['pacienteMunicipio']).toBeDefined();

    const cuidador = reducir([elegir('cuidador')]);
    expect(validarPaso(cuidador.rama!, 1)['cuidadorDepartamento']).toBeDefined();

    const visitador = reducir([elegir('visitador')]);
    expect(validarPaso(visitador.rama!, 3)['institucionDepartamento']).toBeDefined();
    expect(validarPaso(visitador.rama!, 4)['zonaDepartamento']).toBeDefined();
  });

  it('el corregimiento es obligatorio en Paciente y Cuidador, no en Visitador', () => {
    const paciente = reducir([
      elegir('paciente'),
      { type: 'irAPaso', paso: 3 },
      ...ubicacionCompleta('principal', CUNDINAMARCA, SOACHA),
      { type: 'escribirCorregimiento', grupo: 'principal', texto: '' },
    ]);
    expect(validarPaso(paciente.rama!, 3)['pacienteCorregimiento']).toBeDefined();

    const visitador = reducir([
      elegir('visitador'),
      { type: 'irAPaso', paso: 4 },
      { type: 'elegirDepartamento', grupo: 'principal', codigo: CUNDINAMARCA },
      { type: 'elegirMunicipio', grupo: 'principal', codigo: SOACHA },
    ]);
    expect(validarPaso(visitador.rama!, 4)['zonaCorregimiento']).toBeUndefined();
  });

  it('cambiar de departamento descarta el municipio que ya no le pertenece', () => {
    const state = reducir([
      elegir('paciente'),
      ...ubicacionCompleta('principal', CUNDINAMARCA, SOACHA),
      { type: 'elegirDepartamento', grupo: 'principal', codigo: ANTIOQUIA },
    ]);

    const ubicacion = pacienteDe(state).ubicacion;
    expect(ubicacion.departamento).toBe(ANTIOQUIA);
    expect(ubicacion.municipio).toBe('');
    // El corregimiento es texto libre y no depende del código de departamento.
    expect(ubicacion.corregimiento).toBe('San Antonio');
  });

  it('volver a elegir el mismo departamento conserva su municipio', () => {
    const state = reducir([
      elegir('paciente'),
      ...ubicacionCompleta('principal', CUNDINAMARCA, SOACHA),
      { type: 'elegirDepartamento', grupo: 'principal', codigo: CUNDINAMARCA },
    ]);

    expect(pacienteDe(state).ubicacion.municipio).toBe(SOACHA);
  });

  it('los dos grupos de ubicación del Visitador son independientes', () => {
    const state = reducir([
      elegir('visitador'),
      { type: 'elegirDepartamento', grupo: 'institucion', codigo: ANTIOQUIA },
      { type: 'elegirMunicipio', grupo: 'institucion', codigo: MEDELLIN },
      { type: 'elegirDepartamento', grupo: 'principal', codigo: CUNDINAMARCA },
      { type: 'elegirMunicipio', grupo: 'principal', codigo: SOACHA },
    ]);

    if (state.rama?.perfil !== 'visitador') {
      throw new Error('El estado no corresponde a la rama Visitador.');
    }
    expect(state.rama.valores.ubicacionInstitucion.municipio).toBe(MEDELLIN);
    expect(state.rama.valores.ubicacion.municipio).toBe(SOACHA);
  });
});

describe('clasificación prioritaria no excluyente (FR-06)', () => {
  it('permite marcar las tres a la vez y ninguna modifica a las otras', () => {
    const state = reducir([
      elegir('paciente'),
      { type: 'alternarClasificacion', clave: 'mayor60' },
      { type: 'alternarClasificacion', clave: 'discapacidad' },
      { type: 'alternarClasificacion', clave: 'requiereCuidadoCasa' },
    ]);

    const valores = pacienteDe(state);
    expect(valores.mayor60).toBe(true);
    expect(valores.discapacidad).toBe(true);
    expect(valores.requiereCuidadoCasa).toBe(true);
    expect(textoClasificacion(valores)).toBe(
      'Mayor de 60 · Con discapacidad · Requiere cuidados en casa',
    );
  });

  it('desmarcar una deja intactas las otras dos', () => {
    const state = reducir([
      elegir('paciente'),
      { type: 'alternarClasificacion', clave: 'mayor60' },
      { type: 'alternarClasificacion', clave: 'discapacidad' },
      { type: 'alternarClasificacion', clave: 'requiereCuidadoCasa' },
      { type: 'alternarClasificacion', clave: 'discapacidad' },
    ]);

    const valores = pacienteDe(state);
    expect(valores.mayor60).toBe(true);
    expect(valores.discapacidad).toBe(false);
    expect(valores.requiereCuidadoCasa).toBe(true);
  });

  it('exige marcar al menos una situación antes de continuar', () => {
    const state = reducir([
      elegir('paciente'),
      { type: 'irAPaso', paso: 2 },
      { type: 'alternarDiagnostico', valor: DIAGNOSTICO_NINGUNA },
      { type: 'siguiente' },
    ]);

    expect(state.paso).toBe(2);
    expect(state.errores['clasificacion']).toBeDefined();
    expect(state.campoFoco).toBe('clasificacion');
  });

  it('la fecha de nacimiento marca «mayor de 60» sin tocar las otras casillas', () => {
    const hoy = new Date('2026-08-19T00:00:00');
    const edad = edadEnAnios('1950-03-10', hoy);

    const state = reducir([
      elegir('paciente'),
      { type: 'alternarClasificacion', clave: 'requiereCuidadoCasa' },
      { type: 'fechaNacimiento', valor: '1950-03-10', edad },
    ]);

    const valores = pacienteDe(state);
    expect(edad).toBe(76);
    expect(valores.mayor60).toBe(true);
    expect(valores.mayor60Automatico).toBe(true);
    expect(valores.discapacidad).toBe(false);
    expect(valores.requiereCuidadoCasa).toBe(true);
  });

  it('la fecha de nacimiento también calcula la edad del Cuidador', () => {
    const hoy = new Date('2026-08-19T00:00:00');
    const edad = edadEnAnios('1990-02-20', hoy);

    const state = reducir([
      elegir('cuidador'),
      { type: 'fechaNacimiento', valor: '1990-02-20', edad },
    ]);

    expect(cuidadorDe(state).edad).toBe(36);
  });
});

describe('diagnósticos dentro del paso 2 (FR-06)', () => {
  it('incluye «Otros» junto a las opciones ya aprobadas', () => {
    expect(DIAGNOSTICOS).toContain(DIAGNOSTICO_OTROS);
    for (const opcion of [
      'Hipertensión',
      'Diabetes',
      'Artritis',
      'EPOC',
      'Alzheimer',
      'Movilidad reducida',
      DIAGNOSTICO_NINGUNA,
    ]) {
      expect(DIAGNOSTICOS).toContain(opcion);
    }
  });

  it('«Otros» abre un campo y permite añadir y quitar varios diagnósticos', () => {
    let state = reducir([
      elegir('paciente'),
      { type: 'alternarDiagnostico', valor: DIAGNOSTICO_OTROS },
    ]);
    expect(pacienteDe(state).otrosDiagnosticos).toEqual(['']);

    state = reducir(
      [
        { type: 'escribirOtroDiagnostico', indice: 0, texto: 'Migraña' },
        { type: 'agregarOtroDiagnostico' },
        { type: 'escribirOtroDiagnostico', indice: 1, texto: 'Insomnio' },
      ],
      state,
    );
    expect(pacienteDe(state).otrosDiagnosticos).toEqual(['Migraña', 'Insomnio']);

    state = inscripcionReducer(state, { type: 'quitarOtroDiagnostico', indice: 0 });
    expect(pacienteDe(state).otrosDiagnosticos).toEqual(['Insomnio']);
  });

  it('deseleccionar «Otros» oculta y limpia sus valores', () => {
    const state = reducir([
      elegir('paciente'),
      { type: 'alternarDiagnostico', valor: DIAGNOSTICO_OTROS },
      { type: 'escribirOtroDiagnostico', indice: 0, texto: 'Migraña' },
      { type: 'alternarDiagnostico', valor: DIAGNOSTICO_OTROS },
    ]);

    const valores = pacienteDe(state);
    expect(valores.diagnosticos).not.toContain(DIAGNOSTICO_OTROS);
    expect(valores.otrosDiagnosticos).toEqual([]);
  });

  it('«Ninguna» es excluyente en ambos sentidos', () => {
    let state = reducir([
      elegir('paciente'),
      { type: 'alternarDiagnostico', valor: 'Hipertensión' },
      { type: 'alternarDiagnostico', valor: DIAGNOSTICO_OTROS },
      { type: 'escribirOtroDiagnostico', indice: 0, texto: 'Migraña' },
      { type: 'alternarDiagnostico', valor: DIAGNOSTICO_NINGUNA },
    ]);

    expect(pacienteDe(state).diagnosticos).toEqual([DIAGNOSTICO_NINGUNA]);
    expect(pacienteDe(state).otrosDiagnosticos).toEqual([]);

    state = inscripcionReducer(state, {
      type: 'alternarDiagnostico',
      valor: 'Diabetes',
    });
    expect(pacienteDe(state).diagnosticos).toEqual(['Diabetes']);
  });

  it('los diagnósticos no alteran la clasificación prioritaria', () => {
    const state = reducir([
      elegir('paciente'),
      { type: 'alternarClasificacion', clave: 'mayor60' },
      { type: 'alternarClasificacion', clave: 'discapacidad' },
      { type: 'alternarDiagnostico', valor: DIAGNOSTICO_NINGUNA },
      { type: 'alternarDiagnostico', valor: 'Diabetes' },
    ]);

    const valores = pacienteDe(state);
    expect(valores.mayor60).toBe(true);
    expect(valores.discapacidad).toBe(true);
    expect(valores.requiereCuidadoCasa).toBe(false);
  });

  it('exige marcar al menos un diagnóstico o «Ninguna»', () => {
    const state = reducir([
      elegir('paciente'),
      { type: 'irAPaso', paso: 2 },
      { type: 'alternarClasificacion', clave: 'mayor60' },
      { type: 'siguiente' },
    ]);

    expect(state.paso).toBe(2);
    expect(state.errores['diagnosticos']).toBeDefined();
  });

  it('exige el texto de cada fila visible de «Otros»', () => {
    const state = reducir([
      elegir('paciente'),
      { type: 'irAPaso', paso: 2 },
      { type: 'alternarClasificacion', clave: 'mayor60' },
      { type: 'alternarDiagnostico', valor: DIAGNOSTICO_OTROS },
      { type: 'escribirOtroDiagnostico', indice: 0, texto: 'Migraña' },
      { type: 'agregarOtroDiagnostico' },
      { type: 'siguiente' },
    ]);

    expect(state.paso).toBe(2);
    expect(state.errores[campoOtroDiagnostico(0)]).toBeUndefined();
    expect(state.errores[campoOtroDiagnostico(1)]).toBeDefined();
    expect(state.campoFoco).toBe(campoOtroDiagnostico(1));
  });

  it('resume los diagnósticos marcados y los escritos en «Otros»', () => {
    const state = reducir([
      elegir('paciente'),
      { type: 'alternarDiagnostico', valor: 'Diabetes' },
      { type: 'alternarDiagnostico', valor: DIAGNOSTICO_OTROS },
      { type: 'escribirOtroDiagnostico', indice: 0, texto: 'Migraña' },
    ]);

    expect(textoDiagnosticos(pacienteDe(state))).toBe('Diabetes · Migraña');
  });
});
