import { nombreDepartamento, nombreMunicipio } from '@/data/divipola';

import {
  accessRequestPasswordProblem,
  type AccessRequestDocumentType,
  type AccessRequestPasswordProblem,
  type AccessRequestSexGender,
  type AccessRequestWithCredential,
  type RequestedProfile,
} from './accessRequestClient';
import { REGISTRATION_OTRA_EPS } from './accessRegistrationProfileData';

/**
 * Máquina de estados PURA de la inscripción guiada de cinco pasos
 * (SPEC 038, MP04-C3).
 *
 * Todo lo que aquí vive es determinista y síncrono: no hay React, no hay red,
 * no hay DOM ni storage. Las únicas dependencias son el validador de
 * credencial del cliente (función pura del contrato) y los catálogos de
 * presentación (solo sus códigos). Este módulo no modifica ninguno de los dos.
 */

export type RegistrationStep = 1 | 2 | 3 | 4 | 5;
export type RegistrationProfile = RequestedProfile;

/** Identidad y contacto base: los diez campos del contrato sin credencial. */
export interface BaseDraft {
  readonly documentType: AccessRequestDocumentType;
  readonly documentNumber: string;
  readonly givenNames: string;
  readonly familyNames: string;
  readonly birthDate: string;
  readonly sexGenderCode: AccessRequestSexGender;
  readonly phone: string;
  readonly email: string;
}

export function baseVacio(): BaseDraft {
  return {
    documentType: 'CEDULA_CIUDADANIA',
    documentNumber: '',
    givenNames: '',
    familyNames: '',
    birthDate: '',
    sexGenderCode: 'FEMENINO',
    phone: '',
    email: '',
  };
}

export interface PatientRegDraft {
  readonly necesitaApoyo: string;
  readonly apoyos: readonly string[];
  readonly condiciones: readonly string[];
  readonly zona: string;
  readonly eps: string;
  readonly direccion: string;
  readonly contactoNombre: string;
  readonly contactoParentesco: string;
  readonly contactoTelefono: string;
  readonly vecinoNombre: string;
  readonly vecinoTelefono: string;
  readonly vecinoAutorizado: boolean;
  readonly autorizaDatos: boolean;
}

export interface CaregiverRegDraft {
  readonly tipoCuidador: string;
  readonly tieneFormacion: string;
  readonly institucionFormacion: string;
  readonly viveConPaciente: string;
  readonly horarios: readonly string[];
  readonly pacienteRegistrado: string;
  readonly relacionPaciente: string;
  readonly vecinoNombre: string;
  readonly vecinoTelefono: string;
  readonly vecinoRelacion: string;
  readonly vecinoDireccion: string;
  readonly vecinoAutorizado: boolean;
  readonly autorizaDatos: boolean;
}

export interface ProfessionalRegDraft {
  readonly profesion: string;
  readonly tiposAtencion: readonly string[];
  readonly eps: string;
  readonly otraEps: string;
  readonly institucion: string;
  readonly institucionDepartamento: string;
  readonly institucionMunicipio: string;
  readonly cargo: string;
  readonly zonaDepartamento: string;
  readonly zonaMunicipio: string;
  readonly zonas: readonly string[];
  readonly sector: string;
  readonly autorizaDatos: boolean;
}

export type RegDraft = PatientRegDraft | CaregiverRegDraft | ProfessionalRegDraft;

export function registroVacio(perfil: RegistrationProfile): RegDraft {
  if (perfil === 'PATIENT') {
    return {
      necesitaApoyo: '',
      apoyos: [],
      condiciones: [],
      zona: '',
      eps: 'NUEVA_EPS',
      direccion: '',
      contactoNombre: '',
      contactoParentesco: '',
      contactoTelefono: '',
      vecinoNombre: '',
      vecinoTelefono: '',
      vecinoAutorizado: false,
      autorizaDatos: false,
    };
  }

  if (perfil === 'CAREGIVER') {
    return {
      tipoCuidador: 'FAMILIAR',
      tieneFormacion: '',
      institucionFormacion: 'SENA',
      viveConPaciente: '',
      horarios: [],
      pacienteRegistrado: '',
      relacionPaciente: 'MADRE',
      vecinoNombre: '',
      vecinoTelefono: '',
      vecinoRelacion: 'VECINO',
      vecinoDireccion: '',
      vecinoAutorizado: false,
      autorizaDatos: false,
    };
  }

  return {
    profesion: 'MEDICO',
    tiposAtencion: [],
    eps: 'NUEVA_EPS',
    otraEps: '',
    institucion: '',
    institucionDepartamento: '',
    institucionMunicipio: '',
    cargo: '',
    zonaDepartamento: '',
    zonaMunicipio: '',
    zonas: [],
    sector: '',
    autorizaDatos: false,
  };
}

export type RegistrationState =
  | { readonly pantalla: 'selector' }
  | {
      readonly pantalla: 'rama';
      readonly perfil: RegistrationProfile;
      readonly paso: RegistrationStep;
      readonly base: BaseDraft;
      readonly reg: RegDraft;
      readonly password: string;
    };

export const ESTADO_INICIAL: RegistrationState = { pantalla: 'selector' };

export function elegirPerfil(perfil: RegistrationProfile): RegistrationState {
  return { pantalla: 'rama', perfil, paso: 1, base: baseVacio(), password: '', reg: registroVacio(perfil) };
}

export function volverAlSelector(): RegistrationState {
  return { pantalla: 'selector' };
}

export function cambiarPaso(
  estado: Extract<RegistrationState, { pantalla: 'rama' }>,
  paso: RegistrationStep,
): RegistrationState {
  if (estado.paso === paso) {
    return estado;
  }

  return { ...estado, paso };
}

/* -------------------------------------------------------------------------- */
/* Condicionales: ocultar implica eliminar                                     */
/* -------------------------------------------------------------------------- */

/**
 * Purga los valores de los condicionales ocultos.
 *
 * Un condicional oculto NO es un valor en espera: se elimina del estado antes
 * de pintar y antes de construir el cuerpo. Así, desmarcar la autorización del
 * contacto cercano borra sus valores y cambiar la EPS borra la otra EPS.
 */
export function purgarCondicionales(perfil: RegistrationProfile, reg: RegDraft): RegDraft {
  if (perfil === 'PATIENT' && 'apoyos' in reg) {
    const autorizado = reg.vecinoAutorizado;
    return {
      ...reg,
      apoyos: reg.necesitaApoyo === 'SI' ? reg.apoyos : [],
      vecinoNombre: autorizado ? reg.vecinoNombre : '',
      vecinoTelefono: autorizado ? reg.vecinoTelefono : '',
    };
  }

  if (perfil === 'CAREGIVER' && 'horarios' in reg) {
    const conFormacion = reg.tieneFormacion === 'SI';
    const autorizado = reg.vecinoAutorizado;
    return {
      ...reg,
      institucionFormacion: conFormacion ? reg.institucionFormacion : 'SENA',
      vecinoNombre: autorizado ? reg.vecinoNombre : '',
      vecinoTelefono: autorizado ? reg.vecinoTelefono : '',
      vecinoRelacion: autorizado ? reg.vecinoRelacion : 'VECINO',
      vecinoDireccion: autorizado ? reg.vecinoDireccion : '',
    };
  }

  if (perfil === 'FIELD_PROFESSIONAL' && 'zonas' in reg) {
    return {
      ...reg,
      otraEps: reg.eps === REGISTRATION_OTRA_EPS ? reg.otraEps : '',
    };
  }

  return reg;
}

/* -------------------------------------------------------------------------- */
/* Validación por paso                                                         */
/* -------------------------------------------------------------------------- */

function vacio(valor: string): boolean {
  return valor.trim() === '';
}

/** Primer campo base vacío del paso 1, o `null` si está completo. */
function validarBase(base: BaseDraft): string | null {
  for (const campo of ['documentNumber', 'givenNames', 'familyNames', 'birthDate'] as const) {
    if (vacio(base[campo])) {
      return campo;
    }
  }

  if (vacio(base.phone) && vacio(base.email)) {
    return 'phone';
  }

  return null;
}

function validarPaciente(
  paso: RegistrationStep,
  base: BaseDraft,
  reg: PatientRegDraft,
  password: string,
): string | null {
  if (paso === 1) {
    return validarBase(base);
  }

  if (paso === 2) {
    if (reg.necesitaApoyo === '') {
      return 'necesitaApoyo';
    }

    if (reg.necesitaApoyo === 'SI' && reg.apoyos.length === 0) {
      return 'apoyos';
    }

    if (reg.condiciones.length === 0) {
      return 'condiciones';
    }

    return null;
  }

  if (paso === 3) {
    if (reg.zona === '') {
      return 'zona';
    }

    if (reg.eps === '') {
      return 'eps';
    }

    if (vacio(reg.direccion)) {
      return 'direccion';
    }

    return null;
  }

  if (paso === 4) {
    for (const campo of [
      'contactoNombre',
      'contactoParentesco',
      'contactoTelefono',
      'vecinoNombre',
      'vecinoTelefono',
    ] as const) {
      if (vacio(reg[campo])) {
        return campo;
      }
    }

    if (!reg.vecinoAutorizado) {
      return 'vecinoAutorizado';
    }

    return null;
  }

  return validarPaso5(password, reg.autorizaDatos);
}

function validarCuidador(
  paso: RegistrationStep,
  base: BaseDraft,
  reg: CaregiverRegDraft,
  password: string,
): string | null {
  if (paso === 1) {
    return validarBase(base);
  }

  if (paso === 2) {
    if (reg.tieneFormacion === '') {
      return 'tieneFormacion';
    }

    if (reg.viveConPaciente === '') {
      return 'viveConPaciente';
    }

    if (reg.horarios.length === 0) {
      return 'horarios';
    }

    return null;
  }

  if (paso === 3) {
    if (reg.pacienteRegistrado === '') {
      return 'pacienteRegistrado';
    }

    return null;
  }

  if (paso === 4) {
    for (const campo of ['vecinoNombre', 'vecinoTelefono', 'vecinoDireccion'] as const) {
      if (vacio(reg[campo])) {
        return campo;
      }
    }

    if (!reg.vecinoAutorizado) {
      return 'vecinoAutorizado';
    }

    return null;
  }

  return validarPaso5(password, reg.autorizaDatos);
}

function validarVisitador(
  paso: RegistrationStep,
  base: BaseDraft,
  reg: ProfessionalRegDraft,
  password: string,
): string | null {
  if (paso === 1) {
    return validarBase(base);
  }

  if (paso === 2) {
    // La profesión trae valor y los tipos de atención son opcionales.
    return null;
  }

  if (paso === 3) {
    if (reg.eps === 'OTRA_EPS' && vacio(reg.otraEps)) {
      return 'otraEps';
    }

    if (vacio(reg.institucionDepartamento)) {
      return 'institucionDepartamento';
    }

    if (vacio(reg.institucionMunicipio)) {
      return 'institucionMunicipio';
    }

    return null;
  }

  if (paso === 4) {
    if (vacio(reg.zonaDepartamento)) {
      return 'zonaDepartamento';
    }

    if (vacio(reg.zonaMunicipio)) {
      return 'zonaMunicipio';
    }

    return null;
  }

  return validarPaso5(password, reg.autorizaDatos);
}

/** Paso 5 (todas las ramas): clave válida y autorización marcada. */
function validarPaso5(password: string, autorizaDatos: boolean): string | null {
  if (accessRequestPasswordProblem(password) !== null) {
    return 'password';
  }

  if (!autorizaDatos) {
    return 'autorizaDatos';
  }

  return null;
}

export type ProblemaPaso5 =
  | { readonly campo: 'password'; readonly problema: AccessRequestPasswordProblem }
  | { readonly campo: 'autorizaDatos' };

/** Detalle del paso 5 para mensajes específicos sin exponer la clave. */
export function validarPasoFinal(
  password: string,
  autorizaDatos: boolean,
): ProblemaPaso5 | null {
  const fallo = accessRequestPasswordProblem(password);

  if (fallo !== null) {
    return { campo: 'password', problema: fallo };
  }

  if (!autorizaDatos) {
    return { campo: 'autorizaDatos' };
  }

  return null;
}

/**
 * Primer campo inválido del paso, para enfocarlo. `null` deja avanzar.
 *
 * El orden de comprobación es el orden de foco de la pantalla.
 */
export function validarPaso(
  perfil: RegistrationProfile,
  paso: RegistrationStep,
  base: BaseDraft,
  reg: RegDraft,
  password: string,
): string | null {
  if (perfil === 'PATIENT' && 'condiciones' in reg) {
    return validarPaciente(paso, base, reg, password);
  }

  if (perfil === 'CAREGIVER' && 'horarios' in reg) {
    return validarCuidador(paso, base, reg, password);
  }

  if (perfil === 'FIELD_PROFESSIONAL' && 'zonas' in reg) {
    return validarVisitador(paso, base, reg, password);
  }

  return 'documentNumber';
}

/* -------------------------------------------------------------------------- */
/* Regreso ante un `invalid` del servidor                                      */
/* -------------------------------------------------------------------------- */

const PASO_DE_CAMPO_PACIENTE: Readonly<Record<string, RegistrationStep>> = {
  requestedProfile: 1,
  documentType: 1,
  documentNumber: 1,
  givenNames: 1,
  familyNames: 1,
  birthDate: 1,
  sexGenderCode: 1,
  phone: 1,
  email: 1,
  necesitaApoyo: 2,
  apoyos: 2,
  condiciones: 2,
  zona: 3,
  eps: 3,
  direccion: 3,
  contactoNombre: 4,
  contactoParentesco: 4,
  contactoTelefono: 4,
  vecinoNombre: 4,
  vecinoTelefono: 4,
  vecinoAutorizado: 4,
  password: 5,
  autorizaDatos: 5,
};

const PASO_DE_CAMPO_CUIDADOR: Readonly<Record<string, RegistrationStep>> = {
  requestedProfile: 1,
  documentType: 1,
  documentNumber: 1,
  givenNames: 1,
  familyNames: 1,
  birthDate: 1,
  sexGenderCode: 1,
  phone: 1,
  email: 1,
  tipoCuidador: 2,
  tieneFormacion: 2,
  institucionFormacion: 2,
  viveConPaciente: 2,
  horarios: 2,
  pacienteRegistrado: 3,
  relacionPaciente: 3,
  vecinoNombre: 4,
  vecinoTelefono: 4,
  vecinoRelacion: 4,
  vecinoDireccion: 4,
  vecinoAutorizado: 4,
  password: 5,
  autorizaDatos: 5,
};

const PASO_DE_CAMPO_VISITADOR: Readonly<Record<string, RegistrationStep>> = {
  requestedProfile: 1,
  documentType: 1,
  documentNumber: 1,
  givenNames: 1,
  familyNames: 1,
  birthDate: 1,
  sexGenderCode: 1,
  phone: 1,
  email: 1,
  profesion: 2,
  tiposAtencion: 2,
  eps: 3,
  otraEps: 3,
  institucion: 3,
  institucionDepartamento: 3,
  institucionMunicipio: 3,
  cargo: 3,
  zonaDepartamento: 4,
  zonaMunicipio: 4,
  zonas: 4,
  sector: 4,
  password: 5,
  autorizaDatos: 5,
};

export function pasoDeCampo(perfil: RegistrationProfile, campo: string): RegistrationStep | null {
  if (perfil === 'PATIENT') {
    return PASO_DE_CAMPO_PACIENTE[campo] ?? null;
  }

  if (perfil === 'CAREGIVER') {
    return PASO_DE_CAMPO_CUIDADOR[campo] ?? null;
  }

  return PASO_DE_CAMPO_VISITADOR[campo] ?? null;
}

/** Identificador DOM del control de cada campo. Prefijo propio del wizard. */
export function idDeCampo(campo: string): string {
  return `registro-${campo}`;
}

/**
 * Edad en años cumplidos a partir de una fecha `AAAA-MM-DD`.
 *
 * SOLO UI: el indicador acompaña al campo de nacimiento y jamás viaja en el
 * cuerpo ni se persiste. `null` con fecha vacía, mal formada o futura.
 */
export function edadEnAnios(fechaISO: string, hoyISO: string): number | null {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(fechaISO.trim());
  const hoyPartes = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(hoyISO.trim());

  if (partes === null || hoyPartes === null) {
    return null;
  }

  const nacimiento = Date.UTC(
    Number(partes[1]),
    Number(partes[2]) - 1,
    Number(partes[3]),
  );
  const hoy = Date.UTC(Number(hoyPartes[1]), Number(hoyPartes[2]) - 1, Number(hoyPartes[3]));

  if (!Number.isFinite(nacimiento) || !Number.isFinite(hoy) || nacimiento > hoy) {
    return null;
  }

  const prueba = new Date(nacimiento);
  if (
    prueba.getUTCFullYear() !== Number(partes[1]) ||
    prueba.getUTCMonth() !== Number(partes[2]) - 1 ||
    prueba.getUTCDate() !== Number(partes[3])
  ) {
    return null;
  }

  let edad = Number(hoyPartes[1]) - Number(partes[1]);

  if (
    Number(hoyPartes[2]) < Number(partes[2]) ||
    (Number(hoyPartes[2]) === Number(partes[2]) && Number(hoyPartes[3]) < Number(partes[3]))
  ) {
    edad -= 1;
  }

  return edad;
}

/* -------------------------------------------------------------------------- */
/* Cuerpo                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Construye el expediente canónico de la rama: pasos 2 a 4 más consentimientos
 * del paso 5. Sin password, sin identidad duplicada y con los condicionales
 * ocultos ya purgados. Los opcionales vacíos se omiten.
 */
export function construirRegistro(
  perfil: RegistrationProfile,
  reg: RegDraft,
): Record<string, unknown> {
  const purgado = purgarCondicionales(perfil, reg);

  if (perfil === 'PATIENT' && 'condiciones' in purgado) {
    return {
      necesitaApoyo: purgado.necesitaApoyo,
      apoyos: [...purgado.apoyos],
      condiciones: [...purgado.condiciones],
      zona: purgado.zona,
      eps: purgado.eps,
      direccion: purgado.direccion.trim(),
      contactoNombre: purgado.contactoNombre.trim(),
      contactoParentesco: purgado.contactoParentesco.trim(),
      contactoTelefono: purgado.contactoTelefono.trim(),
      vecinoNombre: purgado.vecinoNombre.trim(),
      vecinoTelefono: purgado.vecinoTelefono.trim(),
      vecinoAutorizado: true,
      autorizaDatos: true,
    };
  }

  if (perfil === 'CAREGIVER' && 'horarios' in purgado) {
    return {
      tipoCuidador: purgado.tipoCuidador,
      tieneFormacion: purgado.tieneFormacion,
      ...(purgado.tieneFormacion === 'SI'
        ? { institucionFormacion: purgado.institucionFormacion }
        : {}),
      viveConPaciente: purgado.viveConPaciente,
      horarios: [...purgado.horarios],
      pacienteRegistrado: purgado.pacienteRegistrado,
      relacionPaciente: purgado.relacionPaciente,
      vecinoNombre: purgado.vecinoNombre.trim(),
      vecinoTelefono: purgado.vecinoTelefono.trim(),
      vecinoRelacion: purgado.vecinoRelacion,
      vecinoDireccion: purgado.vecinoDireccion.trim(),
      vecinoAutorizado: true,
      autorizaDatos: true,
    };
  }

  if (perfil === 'FIELD_PROFESSIONAL' && 'zonas' in purgado) {
    /*
     * El estado guarda CÓDIGOS DIVIPOLA (lo que los selects entregan); el
     * expediente guarda NOMBRES oficiales (lo que el Hospital lee). Un código
     * desconocido produce cadena vacía y la validación lo rechaza.
     */
    return {
      profesion: purgado.profesion,
      tiposAtencion: [...purgado.tiposAtencion],
      eps: purgado.eps,
      ...(purgado.eps === REGISTRATION_OTRA_EPS && purgado.otraEps.trim() !== ''
        ? { otraEps: purgado.otraEps.trim() }
        : {}),
      ...(purgado.institucion.trim() === '' ? {} : { institucion: purgado.institucion.trim() }),
      institucionDepartamento: nombreDepartamento(purgado.institucionDepartamento),
      institucionMunicipio: nombreMunicipio(purgado.institucionMunicipio),
      ...(purgado.cargo.trim() === '' ? {} : { cargo: purgado.cargo.trim() }),
      zonaDepartamento: nombreDepartamento(purgado.zonaDepartamento),
      zonaMunicipio: nombreMunicipio(purgado.zonaMunicipio),
      zonas: [...purgado.zonas],
      ...(purgado.sector.trim() === '' ? {} : { sector: purgado.sector.trim() }),
      autorizaDatos: true,
    };
  }

  throw new Error('expediente de perfil desconocido');
}

export interface CuerpoRegistro extends AccessRequestWithCredential {
  readonly registration: Record<string, unknown>;
}

/**
 * Construye el cuerpo EXACTO del contrato: los diez campos vigentes más el
 * expediente de la rama. `requestedProfile` sale de la tarjeta elegida.
 * Teléfono y correo viajan solo con contenido; la credencial viaja tal cual.
 */
export function construirCuerpo(
  perfil: RegistrationProfile,
  base: BaseDraft,
  password: string,
  reg: RegDraft,
): CuerpoRegistro {
  return {
    requestedProfile: perfil,
    documentType: base.documentType,
    documentNumber: base.documentNumber.trim(),
    givenNames: base.givenNames.trim(),
    familyNames: base.familyNames.trim(),
    birthDate: base.birthDate.trim(),
    sexGenderCode: base.sexGenderCode,
    password,
    ...(base.phone.trim() === '' ? {} : { phone: base.phone.trim() }),
    ...(base.email.trim() === '' ? {} : { email: base.email.trim() }),
    registration: construirRegistro(perfil, reg),
  };
}

/* -------------------------------------------------------------------------- */
/* Bloqueo de envío                                                            */
/* -------------------------------------------------------------------------- */

export interface BloqueoEnvio {
  intentar(): boolean;
  liberar(): void;
}

export function crearBloqueoEnvio(): BloqueoEnvio {
  let enCurso = false;

  return {
    intentar(): boolean {
      if (enCurso) {
        return false;
      }

      enCurso = true;
      return true;
    },
    liberar(): void {
      enCurso = false;
    },
  };
}
