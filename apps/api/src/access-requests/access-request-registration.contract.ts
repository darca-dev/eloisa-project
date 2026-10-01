/**
 * Contrato del expediente ficticio de solicitud (SPEC 038, MP04-C3).
 *
 * ESTE MÓDULO ES FRONTERA NORMATIVA como `access-request.contract.ts`: no
 * importa Prisma, no lee configuración y no ejecuta efectos. Solo declara la
 * versión del expediente, los catálogos cerrados por rama, las formas
 * canónicas y el código de conflicto de reintento.
 *
 * QUÉ ES EL EXPEDIENTE: los datos adicionales declarados de los pasos 2 a 4
 * del flujo guiado de cinco pasos más los consentimientos del paso 5. No
 * duplica la `Person` (identidad y contacto base viven en su fila), no
 * contiene password, referencia, tenant, estados, revisor, tokens, `sub` ni
 * errores, y nunca es historia clínica ni regla clínica: son declaraciones
 * ficticias para revisión del Hospital.
 *
 * UNIÓN DISCRIMINADA POR `requestedProfile`: el cuerpo trae `registration` con
 * la forma de SU rama. Claves de otra rama, claves extra, arreglos sin límite,
 * valores fuera de catálogo y textos fuera de longitud se rechazan.
 */

/** Versión del esquema del expediente. Este paquete solo emite la 1. */
export const ACCESS_REQUEST_REGISTRATION_SCHEMA_VERSION = 1;

/**
 * Conflicto de reintento con expediente materialmente distinto.
 *
 * La reutilización devuelve la solicitud abierta SIN sobrescribir su
 * expediente; un cuerpo materialmente distinto no puede crear otra fila (el
 * índice parcial lo impediría) ni pisar el expediente, de modo que recibe un
 * `409` opaco. El servicio lo emite lanzando `ConflictException` con este
 * código: el controlador deja pasar las `HttpException` sin tocarlas, así que
 * no necesita ningún cambio para responder el conflicto.
 */
export const ACCESS_REQUEST_REGISTRATION_REPLAY_CONFLICT =
  'ACCESS_REQUEST_REPLAY_CONFLICT';

/* -------------------------------------------------------------------------- */
/* Catálogos cerrados                                                           */
/* -------------------------------------------------------------------------- */

/** ¿La persona declara necesitar apoyo en casa? */
export const REGISTRATION_NECESITA_APOYO = ['SI', 'NO', 'NO_SABE'] as const;

/** Apoyos declarados. Límite: el tamaño del catálogo. */
export const REGISTRATION_APOYOS = [
  'MOVILIZARSE',
  'MEDICAMENTOS',
  'ALIMENTACION',
  'HIGIENE',
  'ACOMPANAMIENTO',
  'SUPERVISION',
] as const;

/**
 * Condiciones DECLARADAS, no diagnósticos validados. `NINGUNA` es excluyente:
 * si aparece, va sola. La bandeja las rotula como declaraciones y nunca deriva
 * de ellas alertas, prioridades ni decisiones.
 */
export const REGISTRATION_CONDICIONES = [
  'HIPERTENSION',
  'DIABETES',
  'ARTRITIS',
  'EPOC',
  'ALZHEIMER',
  'MOVILIDAD_REDUCIDA',
  'NINGUNA',
] as const;

/** Condición que desactiva todo el grupo cuando se declara. */
export const REGISTRATION_CONDICION_NINGUNA = 'NINGUNA';

/** Zona declarada de residencia. */
export const REGISTRATION_ZONA = ['URBANA', 'RURAL'] as const;

/** EPS declaradas para Paciente (incluye desconocimiento y ausencia). */
export const REGISTRATION_EPS_PACIENTE = [
  'NUEVA_EPS',
  'SANITAS',
  'SURA',
  'SALUD_TOTAL',
  'COMPENSAR',
  'FAMISANAR',
  'OTRA_EPS',
  'NO_SABE',
  'SIN_EPS',
] as const;

/** Tipo de cuidador declarado. */
export const REGISTRATION_TIPO_CUIDADOR = [
  'FAMILIAR',
  'INFORMAL',
  'REMUNERADO',
  'AUXILIAR_ENFERMERIA',
  'PROFESIONAL_SALUD',
  'OTRO',
] as const;

/** Respuestas cerradas de sí/no. */
export const REGISTRATION_SI_NO = ['SI', 'NO'] as const;

/** Institución de formación declarada (solo si hay formación). */
export const REGISTRATION_INSTITUCION_FORMACION = [
  'SENA',
  'SUPERIOR',
  'FUNDACION_ONG',
  'HOSPITAL_ESE',
  'OTRA',
] as const;

/** Horarios de cuidado declarados. Al menos uno. */
export const REGISTRATION_HORARIOS = [
  'MANANA',
  'TARDE',
  'NOCHE',
  'TODO_EL_DIA',
  'DIAS_ESPECIFICOS',
] as const;

/** Estado del registro del paciente vinculado (declarado, sin búsqueda). */
export const REGISTRATION_PACIENTE_REGISTRADO = ['SI', 'NO', 'NO_SABE'] as const;

/** Relación declarada con el paciente. Etiqueta, no vínculo. */
export const REGISTRATION_RELACION_PACIENTE = [
  'MADRE',
  'PADRE',
  'HIJO',
  'HIJA',
  'CONYUGE',
  'HERMANO',
  'HERMANA',
  'OTRO_FAMILIAR',
  'CONTRATADO',
  'OTRO',
] as const;

/** Relación declarada del contacto cercano con el paciente. */
export const REGISTRATION_VECINO_RELACION = [
  'VECINO',
  'FAMILIAR',
  'ADMINISTRADOR',
  'PORTERO',
  'LIDER',
  'OTRO',
] as const;

/** Profesión declarada del visitador. */
export const REGISTRATION_PROFESION = [
  'MEDICO',
  'ENFERMERO',
  'AUXILIAR_ENFERMERIA',
  'FISIOTERAPEUTA',
  'TERAPEUTA_OCUPACIONAL',
  'TRABAJADOR_SOCIAL',
  'PSICOLOGO',
  'NUTRICIONISTA',
  'OTRO',
] as const;

/** Tipos de atención declarados. Opcionales, sin límite más allá del catálogo. */
export const REGISTRATION_TIPOS_ATENCION = [
  'VISITA_MEDICA',
  'SEGUIMIENTO',
  'ENFERMERIA',
  'VALORACION',
  'MEDICAMENTOS',
  'REHABILITACION',
  'TRABAJO_SOCIAL',
  'VERIFICACION',
  'OTRO',
] as const;

/** EPS declaradas para Visitador (sin desconocimiento: es dato profesional). */
export const REGISTRATION_EPS_VISITADOR = [
  'NUEVA_EPS',
  'SANITAS',
  'SURA',
  'SALUD_TOTAL',
  'COMPENSAR',
  'FAMISANAR',
  'OTRA_EPS',
] as const;

/** Valor que activa el campo condicional de otra EPS. */
export const REGISTRATION_OTRA_EPS = 'OTRA_EPS';

/** Zonas de cobertura declaradas. Opcionales. */
export const REGISTRATION_ZONAS_COBERTURA = [
  'COMUNA_URBANA',
  'CABECERA',
  'CENTRO_POBLADO',
  'RURAL_DISPERSA',
] as const;

/* -------------------------------------------------------------------------- */
/* Límites de texto                                                             */
/* -------------------------------------------------------------------------- */

/** Nombres y etiquetas declaradas. */
export const REGISTRATION_NOMBRE_MAX_LENGTH = 80;

/** Direcciones y referencias declaradas. */
export const REGISTRATION_DIRECCION_MAX_LENGTH = 120;

/** Textos institucionales opcionales (institución, cargo, sector, otra EPS). */
export const REGISTRATION_TEXTO_CORTO_MAX_LENGTH = 80;

/* -------------------------------------------------------------------------- */
/* Formas canónicas                                                             */
/* -------------------------------------------------------------------------- */

/** Expediente de Paciente, ya normalizado y en orden canónico de claves. */
export interface PatientRegistrationData {
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
  readonly vecinoAutorizado: true;
  readonly autorizaDatos: true;
}

/** Expediente de Cuidador, ya normalizado y en orden canónico de claves. */
export interface CaregiverRegistrationData {
  readonly tipoCuidador: string;
  readonly tieneFormacion: string;
  readonly institucionFormacion?: string;
  readonly viveConPaciente: string;
  readonly horarios: readonly string[];
  readonly pacienteRegistrado: string;
  readonly relacionPaciente: string;
  readonly vecinoNombre: string;
  readonly vecinoTelefono: string;
  readonly vecinoRelacion: string;
  readonly vecinoDireccion: string;
  readonly vecinoAutorizado: true;
  readonly autorizaDatos: true;
}

/** Expediente de Visitador médico, ya normalizado y en orden canónico. */
export interface ProfessionalRegistrationData {
  readonly profesion: string;
  readonly tiposAtencion: readonly string[];
  readonly eps: string;
  readonly otraEps?: string;
  readonly institucion?: string;
  readonly institucionDepartamento: string;
  readonly institucionMunicipio: string;
  readonly cargo?: string;
  readonly zonaDepartamento: string;
  readonly zonaMunicipio: string;
  readonly zonas: readonly string[];
  readonly sector?: string;
  readonly autorizaDatos: true;
}

export type ValidatedRegistrationData =
  | PatientRegistrationData
  | CaregiverRegistrationData
  | ProfessionalRegistrationData;

/**
 * Forma canónica para comparar expedientes.
 *
 * Ordena las claves recursivamente de modo que dos objetos materialmente
 * iguales comparen igual aunque el orden de inserción difiera. Los arreglos
 * SÍ conservan su orden: el orden de selección declarado es parte del dato.
 */
export function canonicalRegistration(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalRegistration).join(',')}]`;
  }

  if (typeof value === 'object' && value !== null) {
    const claves = Object.keys(value).sort();
    const pares = claves.map((clave) => {
      const contenido = canonicalRegistration((value as Record<string, unknown>)[clave]);
      return `${JSON.stringify(clave)}:${contenido}`;
    });

    return `{${pares.join(',')}}`;
  }

  return JSON.stringify(value) ?? 'null';
}
