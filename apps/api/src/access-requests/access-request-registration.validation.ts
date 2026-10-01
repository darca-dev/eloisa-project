/**
 * Validación del expediente `registration` de `POST /api/v1/access-requests`
 * (SPEC 038, MP04-C3).
 *
 * COMO EL RESTO DE LA API: funciones puras, sin decoradores, sin acceso a
 * configuración y sin efectos. La unión es DISCRIMINADA por `requestedProfile`:
 * cada rama admite EXACTAMENTE sus claves. Claves de otra rama, claves extra,
 * arreglos sin límite, valores fuera de catálogo y textos fuera de longitud se
 * rechazan nombrando el campo y NUNCA su valor.
 *
 * LO QUE ESTE MÓDULO NO HACE: no comprueba unicidad, no consulta el tenant y no
 * decide idempotencia. La comparación material con el expediente existente
 * ocurre en la transacción (`access-request.service.ts`), no antes.
 *
 * PROHIBICIONES ESTRUCTURALES: `password` dentro del expediente se rechaza
 * aunque por lo demás fuera válido (el servicio además la excluye y la
 * columna la prohíbe por CHECK). Los contactos cercanos solo existen con
 * autorización marcada: la interfaz purga sus valores al desmarcarla, y aquí
 * `vecinoAutorizado` debe ser literalmente `true`.
 */

import type { RequestedProfileCode } from './access-request.contract';
import {
  REGISTRATION_APOYOS,
  REGISTRATION_CONDICIONES,
  REGISTRATION_CONDICION_NINGUNA,
  REGISTRATION_DIRECCION_MAX_LENGTH,
  REGISTRATION_EPS_PACIENTE,
  REGISTRATION_EPS_VISITADOR,
  REGISTRATION_HORARIOS,
  REGISTRATION_INSTITUCION_FORMACION,
  REGISTRATION_NECESITA_APOYO,
  REGISTRATION_NOMBRE_MAX_LENGTH,
  REGISTRATION_OTRA_EPS,
  REGISTRATION_PACIENTE_REGISTRADO,
  REGISTRATION_PROFESION,
  REGISTRATION_RELACION_PACIENTE,
  REGISTRATION_SI_NO,
  REGISTRATION_TEXTO_CORTO_MAX_LENGTH,
  REGISTRATION_TIPOS_ATENCION,
  REGISTRATION_TIPO_CUIDADOR,
  REGISTRATION_VECINO_RELACION,
  REGISTRATION_ZONAS_COBERTURA,
  REGISTRATION_ZONA,
  type ValidatedRegistrationData,
} from './access-request-registration.contract';

export interface RegistrationValidationSuccess {
  readonly ok: true;
  /** Expediente normalizado en orden canónico, listo para persistir y comparar. */
  readonly value: ValidatedRegistrationData;
}

export interface RegistrationValidationFailure {
  readonly ok: false;
  /** Nombres de campo con problema. Nunca contiene valores recibidos. */
  readonly fields: readonly string[];
}

export type RegistrationValidationResult =
  | RegistrationValidationSuccess
  | RegistrationValidationFailure;

const PHONE_PATTERN = /^[\d+.\s()-]+$/u;
const PHONE_MAX_LENGTH = 32;
const NAMES_PATTERN = /^[\p{L}\p{M}\p{Zs}.'-]+$/u;

function hasControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);

    if (code <= 0x1f || code === 0x7f) {
      return true;
    }
  }

  return false;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isOneOf<T extends string>(value: string, allowed: readonly T[]): value is T {
  return (allowed as readonly string[]).includes(value);
}

/** Texto recortado y colapsado dentro del límite, o `null` si no sirve. */
function readText(source: Record<string, unknown>, key: string, maxLength: number): string | null {
  const raw = source[key];

  if (typeof raw !== 'string' || hasControlCharacter(raw)) {
    return null;
  }

  const collapsed = raw.trim().replace(/\s+/gu, ' ');

  if (collapsed.length === 0 || collapsed.length > maxLength) {
    return null;
  }

  return collapsed;
}

/** Texto opcional: ausente o vacío equivale a ausente; presente exige forma. */
function readOptionalText(
  source: Record<string, unknown>,
  key: string,
  maxLength: number,
): string | undefined | null {
  const raw = source[key];

  if (raw === undefined) {
    return undefined;
  }

  if (typeof raw !== 'string') {
    return null;
  }

  if (raw.trim() === '') {
    return undefined;
  }

  return readText(source, key, maxLength);
}

/** Teléfono declarado con la misma regla del contrato base. */
function readPhone(source: Record<string, unknown>, key: string): string | null {
  const value = readText(source, key, PHONE_MAX_LENGTH);

  if (value === null || !PHONE_PATTERN.test(value)) {
    return null;
  }

  return value;
}

function readCatalog<T extends string>(
  source: Record<string, unknown>,
  key: string,
  allowed: readonly T[],
): T | null {
  const value = readText(source, key, 64);

  if (value === null || !isOneOf(value, allowed)) {
    return null;
  }

  return value;
}

/**
 * Arreglo cerrado: debe ser arreglo, sin duplicados, dentro del límite del
 * catálogo y con cada elemento dentro del catálogo.
 */
function readCatalogList<T extends string>(
  source: Record<string, unknown>,
  key: string,
  allowed: readonly T[],
): readonly T[] | null {
  const raw = source[key];

  if (!Array.isArray(raw)) {
    return null;
  }

  if (raw.length > allowed.length) {
    return null;
  }

  const valores: T[] = [];

  for (const item of raw) {
    if (typeof item !== 'string' || !isOneOf(item, allowed) || valores.includes(item)) {
      return null;
    }

    valores.push(item);
  }

  return valores;
}

/** Literal `true` exigido para autorizaciones. Ausente o falso es inválido. */
function readTrue(source: Record<string, unknown>, key: string): true | null {
  return source[key] === true ? true : null;
}

interface BranchSpec {
  /** Claves admitidas en esta rama. Todo lo demás se rechaza por su nombre. */
  readonly allowed: readonly string[];
  readonly validate: (
    source: Record<string, unknown>,
    fields: Set<string>,
  ) => ValidatedRegistrationData | null;
}

function validatePatient(
  source: Record<string, unknown>,
  fields: Set<string>,
): ValidatedRegistrationData | null {
  const necesitaApoyo = readCatalog(source, 'necesitaApoyo', REGISTRATION_NECESITA_APOYO);
  if (necesitaApoyo === null) {
    fields.add('necesitaApoyo');
  }

  const apoyos = readCatalogList(source, 'apoyos', REGISTRATION_APOYOS);
  if (apoyos === null || (necesitaApoyo === 'SI') !== (apoyos.length > 0)) {
    fields.add('apoyos');
  }

  const condiciones = readCatalogList(source, 'condiciones', REGISTRATION_CONDICIONES);
  if (
    condiciones === null ||
    condiciones.length === 0 ||
    (condiciones.includes(REGISTRATION_CONDICION_NINGUNA) && condiciones.length > 1)
  ) {
    fields.add('condiciones');
  }

  const zona = readCatalog(source, 'zona', REGISTRATION_ZONA);
  if (zona === null) {
    fields.add('zona');
  }

  const eps = readCatalog(source, 'eps', REGISTRATION_EPS_PACIENTE);
  if (eps === null) {
    fields.add('eps');
  }

  const direccion = readText(source, 'direccion', REGISTRATION_DIRECCION_MAX_LENGTH);
  if (direccion === null) {
    fields.add('direccion');
  }

  const contactoNombre = readText(source, 'contactoNombre', REGISTRATION_NOMBRE_MAX_LENGTH);
  if (contactoNombre === null || !NAMES_PATTERN.test(contactoNombre)) {
    fields.add('contactoNombre');
  }

  const contactoParentesco = readText(
    source,
    'contactoParentesco',
    REGISTRATION_NOMBRE_MAX_LENGTH,
  );
  if (contactoParentesco === null || !NAMES_PATTERN.test(contactoParentesco)) {
    fields.add('contactoParentesco');
  }

  const contactoTelefono = readPhone(source, 'contactoTelefono');
  if (contactoTelefono === null) {
    fields.add('contactoTelefono');
  }

  const vecinoNombre = readText(source, 'vecinoNombre', REGISTRATION_NOMBRE_MAX_LENGTH);
  if (vecinoNombre === null || !NAMES_PATTERN.test(vecinoNombre)) {
    fields.add('vecinoNombre');
  }

  const vecinoTelefono = readPhone(source, 'vecinoTelefono');
  if (vecinoTelefono === null) {
    fields.add('vecinoTelefono');
  }

  if (readTrue(source, 'vecinoAutorizado') === null) {
    fields.add('vecinoAutorizado');
  }

  if (readTrue(source, 'autorizaDatos') === null) {
    fields.add('autorizaDatos');
  }

  if (fields.size > 0) {
    return null;
  }

  return {
    necesitaApoyo: necesitaApoyo as string,
    apoyos: apoyos as readonly string[],
    condiciones: condiciones as readonly string[],
    zona: zona as string,
    eps: eps as string,
    direccion: direccion as string,
    contactoNombre: contactoNombre as string,
    contactoParentesco: contactoParentesco as string,
    contactoTelefono: contactoTelefono as string,
    vecinoNombre: vecinoNombre as string,
    vecinoTelefono: vecinoTelefono as string,
    vecinoAutorizado: true,
    autorizaDatos: true,
  };
}

function validateCaregiver(
  source: Record<string, unknown>,
  fields: Set<string>,
): ValidatedRegistrationData | null {
  const tipoCuidador = readCatalog(source, 'tipoCuidador', REGISTRATION_TIPO_CUIDADOR);
  if (tipoCuidador === null) {
    fields.add('tipoCuidador');
  }

  const tieneFormacion = readCatalog(source, 'tieneFormacion', REGISTRATION_SI_NO);
  if (tieneFormacion === null) {
    fields.add('tieneFormacion');
  }

  // Condicional: la institución solo existe con formación declarada.
  let institucionFormacion: string | undefined;
  if (tieneFormacion === 'SI') {
    const institucion = readCatalog(
      source,
      'institucionFormacion',
      REGISTRATION_INSTITUCION_FORMACION,
    );
    if (institucion === null) {
      fields.add('institucionFormacion');
    } else {
      institucionFormacion = institucion;
    }
  } else if (source['institucionFormacion'] !== undefined) {
    fields.add('institucionFormacion');
  }

  const viveConPaciente = readCatalog(source, 'viveConPaciente', REGISTRATION_SI_NO);
  if (viveConPaciente === null) {
    fields.add('viveConPaciente');
  }

  const horarios = readCatalogList(source, 'horarios', REGISTRATION_HORARIOS);
  if (horarios === null || horarios.length === 0) {
    fields.add('horarios');
  }

  const pacienteRegistrado = readCatalog(
    source,
    'pacienteRegistrado',
    REGISTRATION_PACIENTE_REGISTRADO,
  );
  if (pacienteRegistrado === null) {
    fields.add('pacienteRegistrado');
  }

  const relacionPaciente = readCatalog(source, 'relacionPaciente', REGISTRATION_RELACION_PACIENTE);
  if (relacionPaciente === null) {
    fields.add('relacionPaciente');
  }

  const vecinoNombre = readText(source, 'vecinoNombre', REGISTRATION_NOMBRE_MAX_LENGTH);
  if (vecinoNombre === null || !NAMES_PATTERN.test(vecinoNombre)) {
    fields.add('vecinoNombre');
  }

  const vecinoTelefono = readPhone(source, 'vecinoTelefono');
  if (vecinoTelefono === null) {
    fields.add('vecinoTelefono');
  }

  const vecinoRelacion = readCatalog(source, 'vecinoRelacion', REGISTRATION_VECINO_RELACION);
  if (vecinoRelacion === null) {
    fields.add('vecinoRelacion');
  }

  const vecinoDireccion = readText(source, 'vecinoDireccion', REGISTRATION_DIRECCION_MAX_LENGTH);
  if (vecinoDireccion === null) {
    fields.add('vecinoDireccion');
  }

  if (readTrue(source, 'vecinoAutorizado') === null) {
    fields.add('vecinoAutorizado');
  }

  if (readTrue(source, 'autorizaDatos') === null) {
    fields.add('autorizaDatos');
  }

  if (fields.size > 0) {
    return null;
  }

  return {
    tipoCuidador: tipoCuidador as string,
    tieneFormacion: tieneFormacion as string,
    ...(institucionFormacion === undefined ? {} : { institucionFormacion }),
    viveConPaciente: viveConPaciente as string,
    horarios: horarios as readonly string[],
    pacienteRegistrado: pacienteRegistrado as string,
    relacionPaciente: relacionPaciente as string,
    vecinoNombre: vecinoNombre as string,
    vecinoTelefono: vecinoTelefono as string,
    vecinoRelacion: vecinoRelacion as string,
    vecinoDireccion: vecinoDireccion as string,
    vecinoAutorizado: true,
    autorizaDatos: true,
  };
}

function validateProfessional(
  source: Record<string, unknown>,
  fields: Set<string>,
): ValidatedRegistrationData | null {
  const profesion = readCatalog(source, 'profesion', REGISTRATION_PROFESION);
  if (profesion === null) {
    fields.add('profesion');
  }

  const tiposAtencion = readCatalogList(source, 'tiposAtencion', REGISTRATION_TIPOS_ATENCION);
  if (tiposAtencion === null) {
    fields.add('tiposAtencion');
  }

  const eps = readCatalog(source, 'eps', REGISTRATION_EPS_VISITADOR);
  if (eps === null) {
    fields.add('eps');
  }

  // Condicional: otra EPS solo existe cuando se declara OTRA_EPS.
  let otraEps: string | undefined;
  if (eps === REGISTRATION_OTRA_EPS) {
    const declarada = readText(source, 'otraEps', REGISTRATION_TEXTO_CORTO_MAX_LENGTH);
    if (declarada === null) {
      fields.add('otraEps');
    } else {
      otraEps = declarada;
    }
  } else if (source['otraEps'] !== undefined && source['otraEps'] !== '') {
    fields.add('otraEps');
  }

  const institucion = readOptionalText(source, 'institucion', REGISTRATION_TEXTO_CORTO_MAX_LENGTH);
  if (institucion === null) {
    fields.add('institucion');
  }

  const institucionDepartamento = readText(
    source,
    'institucionDepartamento',
    REGISTRATION_TEXTO_CORTO_MAX_LENGTH,
  );
  if (institucionDepartamento === null) {
    fields.add('institucionDepartamento');
  }

  const institucionMunicipio = readText(
    source,
    'institucionMunicipio',
    REGISTRATION_TEXTO_CORTO_MAX_LENGTH,
  );
  if (institucionMunicipio === null) {
    fields.add('institucionMunicipio');
  }

  const cargo = readOptionalText(source, 'cargo', REGISTRATION_TEXTO_CORTO_MAX_LENGTH);
  if (cargo === null) {
    fields.add('cargo');
  }

  const zonaDepartamento = readText(
    source,
    'zonaDepartamento',
    REGISTRATION_TEXTO_CORTO_MAX_LENGTH,
  );
  if (zonaDepartamento === null) {
    fields.add('zonaDepartamento');
  }

  const zonaMunicipio = readText(source, 'zonaMunicipio', REGISTRATION_TEXTO_CORTO_MAX_LENGTH);
  if (zonaMunicipio === null) {
    fields.add('zonaMunicipio');
  }

  const zonas = readCatalogList(source, 'zonas', REGISTRATION_ZONAS_COBERTURA);
  if (zonas === null) {
    fields.add('zonas');
  }

  const sector = readOptionalText(source, 'sector', REGISTRATION_TEXTO_CORTO_MAX_LENGTH);
  if (sector === null) {
    fields.add('sector');
  }

  if (readTrue(source, 'autorizaDatos') === null) {
    fields.add('autorizaDatos');
  }

  if (fields.size > 0) {
    return null;
  }

  // Los opcionales llegan como `string | undefined | null`; aquí ya se sabe
  // que no son `null` (habrían marcado campo), de modo que se normalizan a
  // `string | undefined` para la forma canónica.
  const institucionClara: string | undefined = institucion ?? undefined;
  const cargoClaro: string | undefined = cargo ?? undefined;
  const sectorClaro: string | undefined = sector ?? undefined;

  return {
    profesion: profesion as string,
    tiposAtencion: tiposAtencion as readonly string[],
    eps: eps as string,
    ...(otraEps === undefined ? {} : { otraEps }),
    ...(institucionClara === undefined ? {} : { institucion: institucionClara }),
    institucionDepartamento: institucionDepartamento as string,
    institucionMunicipio: institucionMunicipio as string,
    ...(cargoClaro === undefined ? {} : { cargo: cargoClaro }),
    zonaDepartamento: zonaDepartamento as string,
    zonaMunicipio: zonaMunicipio as string,
    zonas: zonas as readonly string[],
    ...(sectorClaro === undefined ? {} : { sector: sectorClaro }),
    autorizaDatos: true,
  };
}

const BRANCHES: Readonly<Record<RequestedProfileCode, BranchSpec>> = {
  PATIENT: {
    allowed: [
      'necesitaApoyo',
      'apoyos',
      'condiciones',
      'zona',
      'eps',
      'direccion',
      'contactoNombre',
      'contactoParentesco',
      'contactoTelefono',
      'vecinoNombre',
      'vecinoTelefono',
      'vecinoAutorizado',
      'autorizaDatos',
    ],
    validate: validatePatient,
  },
  CAREGIVER: {
    allowed: [
      'tipoCuidador',
      'tieneFormacion',
      'institucionFormacion',
      'viveConPaciente',
      'horarios',
      'pacienteRegistrado',
      'relacionPaciente',
      'vecinoNombre',
      'vecinoTelefono',
      'vecinoRelacion',
      'vecinoDireccion',
      'vecinoAutorizado',
      'autorizaDatos',
    ],
    validate: validateCaregiver,
  },
  FIELD_PROFESSIONAL: {
    allowed: [
      'profesion',
      'tiposAtencion',
      'eps',
      'otraEps',
      'institucion',
      'institucionDepartamento',
      'institucionMunicipio',
      'cargo',
      'zonaDepartamento',
      'zonaMunicipio',
      'zonas',
      'sector',
      'autorizaDatos',
    ],
    validate: validateProfessional,
  },
};

/**
 * Valida el expediente de la rama del perfil solicitado.
 *
 * La credencial está estructuralmente prohibida aquí: si aparece `password`
 * se informa `registration` sin distinguirla, para no sugerir que sería
 * aceptable en otro campo.
 */
export function validateRegistration(
  profile: RequestedProfileCode,
  value: unknown,
): RegistrationValidationResult {
  if (!isPlainObject(value)) {
    return { ok: false, fields: ['registration'] };
  }

  if ('password' in value) {
    return { ok: false, fields: ['registration'] };
  }

  const spec = BRANCHES[profile];
  const fields = new Set<string>();

  for (const key of Object.keys(value)) {
    if (!spec.allowed.includes(key)) {
      fields.add(key);
    }
  }

  const validated = spec.validate(value, fields);

  if (validated === null) {
    return { ok: false, fields: [...fields].sort() };
  }

  return { ok: true, value: validated };
}
