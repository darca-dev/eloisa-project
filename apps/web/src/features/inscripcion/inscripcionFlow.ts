/**
 * Modelo local del flujo oficial de inscripción (TASK-002A).
 *
 * Fuente vinculante: `prototype-claude/Eligeme-Inscripcion.dc.html`, inspeccionado
 * solo en lectura y reconstruido aquí. No se ejecuta ni se importa `.dc.html`,
 * `support.js` ni su estado inline.
 *
 * Reglas del modelo:
 * - El perfil se elige una sola vez y determina la rama (FR-02).
 * - Cada rama tiene sus propios valores; cambiar de rol descarta por completo
 *   los de la rama anterior, de modo que ninguna filtra datos a otra (FR-03).
 * - Todo vive en memoria: no hay red, cookies, `localStorage`, `sessionStorage`,
 *   IndexedDB, URL, logs ni telemetría (FR-03).
 * - La validación es local, de completitud y formato inequívoco (FR-04): no
 *   expresa reglas clínicas, institucionales ni regulatorias.
 * - En Paciente y Cuidador todos los datos solicitados son obligatorios, y un
 *   campo condicional es obligatorio mientras esté visible. Al desactivarse su
 *   condición, el campo se oculta y su valor se elimina del estado (FR-04).
 * - La ubicación usa el catálogo local DANE DIVIPOLA de `@/data/divipola`
 *   (FR-04A): Departamento, Municipio dependiente y Nombre del corregimiento.
 */

import { municipioPerteneceA } from '@/data/divipola';

export type PerfilId = 'paciente' | 'cuidador' | 'visitador';

export interface PerfilOpcion {
  readonly id: PerfilId;
  readonly titulo: string;
  readonly descripcion: string;
}

/** Las tres opciones de «¿Cómo se va a registrar?», en el orden aprobado. */
export const PERFILES: readonly PerfilOpcion[] = [
  {
    id: 'paciente',
    titulo: 'Paciente',
    descripcion: 'Recibo o necesito atención en casa',
  },
  {
    id: 'cuidador',
    titulo: 'Cuidador',
    descripcion: 'Cuido a una o más personas',
  },
  {
    id: 'visitador',
    titulo: 'Visitador médico',
    descripcion: 'Profesional que realiza visitas domiciliarias',
  },
];

/** Cada rama tiene exactamente cinco pasos. */
export const TOTAL_PASOS = 5;

export const TITULOS_PASO: Record<PerfilId, readonly string[]> = {
  paciente: [
    'Datos personales',
    'Condición y necesidades',
    'Ubicación y EPS',
    'Contactos',
    'Confirmación',
  ],
  cuidador: [
    'Datos personales',
    'Perfil del cuidador',
    'Vincular paciente',
    'Contacto cercano',
    'Confirmación',
  ],
  visitador: [
    'Datos personales',
    'Información profesional',
    'EPS e institución',
    'Zona de atención',
    'Verificación',
  ],
};

export const ETIQUETA_RAMA: Record<PerfilId, string> = {
  paciente: 'INSCRIPCIÓN COMO PACIENTE',
  cuidador: 'INSCRIPCIÓN COMO CUIDADOR',
  visitador: 'INSCRIPCIÓN COMO VISITADOR MÉDICO',
};

export const ACCION_FINAL: Record<PerfilId, string> = {
  paciente: 'Terminar mi inscripción',
  cuidador: 'Terminar la inscripción como cuidador',
  visitador: 'Solicitar registro como visitador',
};

/* -------------------------------------------------------------------------- */
/* Valores de cada rama                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Grupo de ubicación de FR-04A. `departamento` y `municipio` guardan códigos
 * oficiales DIVIPOLA; `corregimiento` es texto libre escrito por la persona.
 */
export interface Ubicacion {
  readonly departamento: string;
  readonly municipio: string;
  readonly corregimiento: string;
}

export const UBICACION_VACIA: Ubicacion = {
  departamento: '',
  municipio: '',
  corregimiento: '',
};

export interface DatosPersonales {
  readonly tipoDocumento: string;
  readonly documento: string;
  readonly nombres: string;
  readonly apellidos: string;
  readonly fechaNacimiento: string;
  /** Edad calculada al escribir la fecha; `null` mientras no haya fecha válida. */
  readonly edad: number | null;
  readonly telefono: string;
  readonly correo: string;
}

/** Zona de la dirección. Coincide con `AreaType` del contrato de la API. */
export type ZonaId = 'URBAN' | 'RURAL';

/** Opciones de zona en el orden aprobado, con su etiqueta visible. */
export const ZONAS: readonly { readonly id: ZonaId; readonly etiqueta: string }[] = [
  { id: 'URBAN', etiqueta: 'Urbana' },
  { id: 'RURAL', etiqueta: 'Rural' },
];

export interface DatosPaciente extends DatosPersonales {
  readonly sexo: string;
  readonly telefonoAlterno: string;

  /* Paso 2 · clasificación prioritaria, no excluyente. */
  readonly mayor60: boolean;
  /** La casilla de mayor de 60 se marcó a partir de la fecha de nacimiento. */
  readonly mayor60Automatico: boolean;
  readonly discapacidad: boolean;
  readonly tipoDiscapacidad: string;
  readonly registroRlcpd: string;
  readonly requiereCuidadoCasa: boolean;
  readonly tieneCuidador: string;
  readonly apoyos: readonly string[];

  /* Paso 2 · diagnósticos, independientes de la clasificación. */
  readonly diagnosticos: readonly string[];
  readonly otrosDiagnosticos: readonly string[];

  /* Paso 3 */
  readonly ubicacion: Ubicacion;
  /**
   * Zona urbana o rural de la dirección (TASK-MVP-CORE-01, corrección final).
   * La declara la persona; nunca se deduce del texto de la dirección.
   */
  readonly zona: ZonaId | '';
  readonly barrio: string;
  readonly direccion: string;
  readonly indicaciones: string;
  readonly eps: string;

  /* Paso 4 */
  readonly contactoNombre: string;
  readonly contactoParentesco: string;
  readonly contactoTelefono: string;
  readonly vecinoNombre: string;
  readonly vecinoTelefono: string;
  readonly vecinoRelacion: string;
  readonly vecinoDireccion: string;
  readonly autorizaVecino: boolean;

  /* Paso 5 */
  readonly autorizaDatos: boolean;
}

export interface DatosCuidador extends DatosPersonales {
  readonly ubicacion: Ubicacion;
  readonly direccion: string;

  readonly tipoCuidador: string;
  readonly tieneFormacion: string;
  readonly institucionFormacion: string;
  readonly tipoCertificacion: string;
  readonly fechaCertificacion: string;
  readonly viveConPaciente: string;
  readonly horarios: readonly string[];

  readonly pacienteRegistrado: string;
  readonly relacionPaciente: string;

  readonly vecinoNombre: string;
  readonly vecinoTelefono: string;
  readonly vecinoRelacion: string;
  readonly vecinoDireccion: string;
  readonly autorizaVecino: boolean;

  readonly autorizaDatos: boolean;
}

export interface DatosVisitador extends DatosPersonales {
  readonly profesion: string;
  readonly tarjetaProfesional: string;
  readonly registroProfesional: string;
  readonly tiposAtencion: readonly string[];

  readonly eps: string;
  readonly otraEps: string;
  readonly institucion: string;
  /** Ubicación de la institución donde trabaja. */
  readonly ubicacionInstitucion: Ubicacion;
  readonly cargo: string;

  /** Zona de atención que cubre. */
  readonly ubicacion: Ubicacion;
  readonly zonas: readonly string[];
  readonly sector: string;

  readonly autorizaDatos: boolean;
}

const DATOS_PERSONALES_VACIOS: DatosPersonales = {
  tipoDocumento: 'Cédula de ciudadanía',
  documento: '',
  nombres: '',
  apellidos: '',
  fechaNacimiento: '',
  edad: null,
  telefono: '',
  correo: '',
};

export const PACIENTE_VACIO: DatosPaciente = {
  ...DATOS_PERSONALES_VACIOS,
  sexo: 'Femenino',
  telefonoAlterno: '',
  mayor60: false,
  mayor60Automatico: false,
  discapacidad: false,
  tipoDiscapacidad: 'Física',
  registroRlcpd: '',
  requiereCuidadoCasa: false,
  tieneCuidador: '',
  apoyos: [],
  diagnosticos: [],
  otrosDiagnosticos: [],
  ubicacion: UBICACION_VACIA,
  zona: '',
  barrio: '',
  direccion: '',
  indicaciones: '',
  eps: 'Nueva EPS',
  contactoNombre: '',
  contactoParentesco: '',
  contactoTelefono: '',
  vecinoNombre: '',
  vecinoTelefono: '',
  vecinoRelacion: 'Vecino',
  vecinoDireccion: '',
  autorizaVecino: false,
  autorizaDatos: false,
};

export const CUIDADOR_VACIO: DatosCuidador = {
  ...DATOS_PERSONALES_VACIOS,
  ubicacion: UBICACION_VACIA,
  direccion: '',
  tipoCuidador: 'Familiar',
  tieneFormacion: '',
  institucionFormacion: 'Formación SENA',
  tipoCertificacion: '',
  fechaCertificacion: '',
  viveConPaciente: '',
  horarios: [],
  pacienteRegistrado: '',
  relacionPaciente: 'Madre',
  vecinoNombre: '',
  vecinoTelefono: '',
  vecinoRelacion: 'Vecino',
  vecinoDireccion: '',
  autorizaVecino: false,
  autorizaDatos: false,
};

export const VISITADOR_VACIO: DatosVisitador = {
  ...DATOS_PERSONALES_VACIOS,
  profesion: 'Médico',
  tarjetaProfesional: '',
  registroProfesional: '',
  tiposAtencion: [],
  eps: 'Nueva EPS',
  otraEps: '',
  institucion: '',
  ubicacionInstitucion: UBICACION_VACIA,
  cargo: '',
  ubicacion: UBICACION_VACIA,
  zonas: [],
  sector: '',
  autorizaDatos: false,
};

/** Valores de la rama activa. `null` mientras no se ha elegido perfil. */
export type DatosRama =
  | { readonly perfil: 'paciente'; readonly valores: DatosPaciente }
  | { readonly perfil: 'cuidador'; readonly valores: DatosCuidador }
  | { readonly perfil: 'visitador'; readonly valores: DatosVisitador };

function ramaVacia(perfil: PerfilId): DatosRama {
  switch (perfil) {
    case 'paciente':
      return { perfil, valores: PACIENTE_VACIO };
    case 'cuidador':
      return { perfil, valores: CUIDADOR_VACIO };
    case 'visitador':
      return { perfil, valores: VISITADOR_VACIO };
  }
}

/* -------------------------------------------------------------------------- */
/* Diagnósticos (FR-06)                                                        */
/* -------------------------------------------------------------------------- */

/** Opción excluyente: al marcarla se desmarcan las demás. */
export const DIAGNOSTICO_NINGUNA = 'Ninguna';

/** Opción que abre uno o más campos de texto libre. */
export const DIAGNOSTICO_OTROS = 'Otros';

/**
 * Lista aprobada en TASK-002 más «Otros». La opción excluyente se conserva al
 * final para que quede junto al resto sin romper el patrón existente.
 */
export const DIAGNOSTICOS: readonly string[] = [
  'Hipertensión',
  'Diabetes',
  'Artritis',
  'EPOC',
  'Alzheimer',
  'Movilidad reducida',
  DIAGNOSTICO_OTROS,
  DIAGNOSTICO_NINGUNA,
];

/* -------------------------------------------------------------------------- */
/* Validación local                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Errores del paso actual, indexados por el identificador del campo o grupo.
 * El orden de inserción es el orden visual: el primer error es el que recibe
 * el foco.
 */
export type Errores = Readonly<Partial<Record<string, string>>>;

type ErroresMutables = Record<string, string>;

const SOLO_DIGITOS_Y_SEPARADORES = /^[\d+.\s()-]+$/u;
const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u;

function tieneDigito(valor: string): boolean {
  return /\d/u.test(valor);
}

function exigirTexto(
  errores: ErroresMutables,
  campo: string,
  valor: string,
  mensaje: string,
): void {
  if (valor.trim().length === 0) {
    errores[campo] = mensaje;
  }
}

function exigirTelefono(
  errores: ErroresMutables,
  campo: string,
  valor: string,
  mensajeVacio: string,
): void {
  const telefono = valor.trim();
  if (telefono.length === 0) {
    errores[campo] = mensajeVacio;
  } else if (!SOLO_DIGITOS_Y_SEPARADORES.test(telefono) || !tieneDigito(telefono)) {
    errores[campo] = 'Escriba el teléfono solo con números.';
  }
}

function exigirCorreo(errores: ErroresMutables, campo: string, valor: string): void {
  const correo = valor.trim();
  if (correo.length === 0) {
    errores[campo] = 'Escriba un correo electrónico para continuar.';
  } else if (!CORREO.test(correo)) {
    errores[campo] = 'Escriba el correo con el formato nombre@dominio.com.';
  }
}

/**
 * Correo opcional (TASK-MVP-CORE-01 §7, decisión cerrada 18.7).
 *
 * Dejarlo vacío es válido. Si la persona escribe algo, se sigue exigiendo un
 * formato inequívoco para no enviar al servidor un valor que sabemos inválido.
 * Solo aplica a la rama Paciente: las demás ramas conservan su regla aprobada.
 */
function validarCorreoOpcional(
  errores: ErroresMutables,
  campo: string,
  valor: string,
): void {
  const correo = valor.trim();
  if (correo.length > 0 && !CORREO.test(correo)) {
    errores[campo] = 'Escriba el correo con el formato nombre@dominio.com.';
  }
}

function exigirLista(
  errores: ErroresMutables,
  campo: string,
  valores: readonly string[],
  mensaje: string,
): void {
  if (valores.length === 0) {
    errores[campo] = mensaje;
  }
}

/** Identificadores estables de los tres controles de un grupo de ubicación. */
export function camposUbicacion(prefijo: string): {
  readonly departamento: string;
  readonly municipio: string;
  readonly corregimiento: string;
} {
  return {
    departamento: `${prefijo}Departamento`,
    municipio: `${prefijo}Municipio`,
    corregimiento: `${prefijo}Corregimiento`,
  };
}

/**
 * Departamento y Municipio son obligatorios en las tres ramas siempre que
 * aparezca el grupo (FR-04A). El corregimiento solo lo es en Paciente y
 * Cuidador, por la regla de que todos sus datos solicitados lo son.
 */
function exigirUbicacion(
  errores: ErroresMutables,
  prefijo: string,
  ubicacion: Ubicacion,
  corregimientoObligatorio: boolean,
): void {
  const campos = camposUbicacion(prefijo);
  exigirTexto(errores, campos.departamento, ubicacion.departamento, 'Elija el departamento.');
  exigirTexto(errores, campos.municipio, ubicacion.municipio, 'Elija el municipio.');
  if (corregimientoObligatorio) {
    exigirTexto(
      errores,
      campos.corregimiento,
      ubicacion.corregimiento,
      'Escriba el nombre del corregimiento.',
    );
  }
}

const ERROR_AUTORIZACION = 'Marque la autorización de tratamiento de datos para terminar.';

/** Identificación común a las tres ramas (paso 1). */
function validarIdentificacion(errores: ErroresMutables, valores: DatosPersonales): void {
  exigirTexto(errores, 'documento', valores.documento, 'Escriba su número de documento para continuar.');
  exigirTexto(errores, 'nombres', valores.nombres, 'Escriba sus nombres para continuar.');
  exigirTelefono(errores, 'telefono', valores.telefono, 'Ingrese un número de teléfono para continuar.');
}

function validarContactoCercano(
  errores: ErroresMutables,
  valores: {
    readonly vecinoNombre: string;
    readonly vecinoTelefono: string;
    readonly vecinoDireccion: string;
    readonly autorizaVecino: boolean;
  },
): void {
  exigirTexto(errores, 'vecinoNombre', valores.vecinoNombre, 'Escriba el nombre del contacto cercano.');
  exigirTelefono(errores, 'vecinoTelefono', valores.vecinoTelefono, 'Escriba el teléfono del contacto cercano.');
  exigirTexto(
    errores,
    'vecinoDireccion',
    valores.vecinoDireccion,
    'Escriba la dirección o una referencia del contacto cercano.',
  );
  if (!valores.autorizaVecino) {
    errores['autorizaVecino'] = 'Marque la autorización de uso de este contacto.';
  }
}

function validarPaciente(valores: DatosPaciente, paso: number): ErroresMutables {
  const errores: ErroresMutables = {};

  if (paso === 1) {
    validarIdentificacion(errores, valores);
    exigirTexto(errores, 'apellidos', valores.apellidos, 'Escriba sus apellidos para continuar.');
    exigirTexto(errores, 'fechaNacimiento', valores.fechaNacimiento, 'Indique su fecha de nacimiento.');
    exigirTelefono(
      errores,
      'telefonoAlterno',
      valores.telefonoAlterno,
      'Escriba un segundo teléfono de contacto.',
    );
    validarCorreoOpcional(errores, 'correo', valores.correo);
    return errores;
  }

  if (paso === 2) {
    if (!valores.mayor60 && !valores.discapacidad && !valores.requiereCuidadoCasa) {
      errores['clasificacion'] =
        'Marque al menos una situación. Puede marcar una, dos o las tres.';
    }
    if (valores.discapacidad) {
      exigirTexto(
        errores,
        'registroRlcpd',
        valores.registroRlcpd,
        'Indique si está inscrito en el RLCPD.',
      );
    }
    if (valores.requiereCuidadoCasa) {
      exigirTexto(
        errores,
        'tieneCuidador',
        valores.tieneCuidador,
        'Indique si actualmente tiene cuidador.',
      );
      exigirLista(
        errores,
        'apoyos',
        valores.apoyos,
        'Marque al menos un tipo de apoyo que necesita.',
      );
    }
    exigirLista(
      errores,
      'diagnosticos',
      valores.diagnosticos,
      'Marque al menos una opción. Si no tiene ninguna, marque «Ninguna».',
    );
    valores.otrosDiagnosticos.forEach((texto, indice) => {
      exigirTexto(
        errores,
        campoOtroDiagnostico(indice),
        texto,
        'Escriba el diagnóstico o quite esta fila.',
      );
    });
    return errores;
  }

  if (paso === 3) {
    exigirUbicacion(errores, 'paciente', valores.ubicacion, true);
    if (valores.zona.length === 0) {
      errores['zona'] = 'Indique si vive en zona urbana o rural.';
    }
    exigirTexto(errores, 'barrio', valores.barrio, 'Escriba el barrio o la vereda.');
    exigirTexto(errores, 'direccion', valores.direccion, 'Escriba la dirección completa.');
    exigirTexto(
      errores,
      'indicaciones',
      valores.indicaciones,
      'Escriba las indicaciones para llegar.',
    );
    exigirTexto(errores, 'eps', valores.eps, 'Elija la EPS a la que pertenece.');
    return errores;
  }

  if (paso === 4) {
    exigirTexto(
      errores,
      'contactoNombre',
      valores.contactoNombre,
      'Escriba el nombre del contacto familiar.',
    );
    exigirTexto(
      errores,
      'contactoParentesco',
      valores.contactoParentesco,
      'Escriba el parentesco del contacto familiar.',
    );
    exigirTelefono(
      errores,
      'contactoTelefono',
      valores.contactoTelefono,
      'Escriba el teléfono del contacto familiar.',
    );
    validarContactoCercano(errores, valores);
    return errores;
  }

  if (paso === 5 && !valores.autorizaDatos) {
    errores['autorizaDatos'] = ERROR_AUTORIZACION;
  }
  return errores;
}

function validarCuidador(valores: DatosCuidador, paso: number): ErroresMutables {
  const errores: ErroresMutables = {};

  if (paso === 1) {
    validarIdentificacion(errores, valores);
    exigirTexto(errores, 'apellidos', valores.apellidos, 'Escriba sus apellidos para continuar.');
    exigirTexto(errores, 'fechaNacimiento', valores.fechaNacimiento, 'Indique su fecha de nacimiento.');
    exigirCorreo(errores, 'correo', valores.correo);
    exigirUbicacion(errores, 'cuidador', valores.ubicacion, true);
    exigirTexto(errores, 'direccion', valores.direccion, 'Escriba su dirección de residencia.');
    return errores;
  }

  if (paso === 2) {
    exigirTexto(errores, 'tipoCuidador', valores.tipoCuidador, 'Elija qué tipo de cuidador es.');
    exigirTexto(
      errores,
      'tieneFormacion',
      valores.tieneFormacion,
      'Indique si cuenta con formación o certificación.',
    );
    if (valores.tieneFormacion === 'Sí') {
      exigirTexto(
        errores,
        'institucionFormacion',
        valores.institucionFormacion,
        'Elija la institución donde se formó.',
      );
      exigirTexto(
        errores,
        'tipoCertificacion',
        valores.tipoCertificacion,
        'Escriba el tipo de certificación.',
      );
      exigirTexto(
        errores,
        'fechaCertificacion',
        valores.fechaCertificacion,
        'Indique la fecha de la certificación.',
      );
    }
    exigirTexto(
      errores,
      'viveConPaciente',
      valores.viveConPaciente,
      'Indique si vive con el paciente.',
    );
    exigirLista(errores, 'horarios', valores.horarios, 'Marque al menos un horario de cuidado.');
    return errores;
  }

  if (paso === 3) {
    exigirTexto(
      errores,
      'pacienteRegistrado',
      valores.pacienteRegistrado,
      'Indique si el paciente ya está registrado.',
    );
    exigirTexto(
      errores,
      'relacionPaciente',
      valores.relacionPaciente,
      'Elija su relación con el paciente.',
    );
    return errores;
  }

  if (paso === 4) {
    validarContactoCercano(errores, valores);
    return errores;
  }

  if (paso === 5 && !valores.autorizaDatos) {
    errores['autorizaDatos'] = ERROR_AUTORIZACION;
  }
  return errores;
}

/**
 * La rama Visitador conserva la obligatoriedad definida por su flujo aprobado.
 * Solo se añade lo que FR-04A exige en las tres ramas: departamento y municipio
 * de cada grupo de ubicación. No se inventan requisitos de acreditación.
 */
function validarVisitador(valores: DatosVisitador, paso: number): ErroresMutables {
  const errores: ErroresMutables = {};

  if (paso === 1) {
    validarIdentificacion(errores, valores);
    return errores;
  }

  if (paso === 3) {
    exigirUbicacion(errores, 'institucion', valores.ubicacionInstitucion, false);
    return errores;
  }

  if (paso === 4) {
    exigirUbicacion(errores, 'zona', valores.ubicacion, false);
    return errores;
  }

  if (paso === 5 && !valores.autorizaDatos) {
    errores['autorizaDatos'] = ERROR_AUTORIZACION;
  }
  return errores;
}

/** Validación local del paso indicado dentro de su rama. */
export function validarPaso(rama: DatosRama, paso: number): Errores {
  switch (rama.perfil) {
    case 'paciente':
      return validarPaciente(rama.valores, paso);
    case 'cuidador':
      return validarCuidador(rama.valores, paso);
    case 'visitador':
      return validarVisitador(rama.valores, paso);
  }
}

/** Identificador estable de la fila `indice` de «Otros» en Diagnósticos. */
export function campoOtroDiagnostico(indice: number): string {
  return `otroDiagnostico-${indice}`;
}

/* -------------------------------------------------------------------------- */
/* Estado y reductor                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Estado del envío de la inscripción a la API (TASK-MVP-CORE-01 §8).
 *
 * Solo la rama Paciente envía: al confirmar el último paso pasa a `enviando` y
 * únicamente llega a «Inscripción completada» tras un `201` real. Las ramas
 * Cuidador y Visitador conservan su cierre local aprobado, porque su
 * persistencia está expresamente fuera del alcance de CORE-01.
 */
export type EnvioEstado = 'inactivo' | 'enviando' | 'error' | 'conflicto';

export interface EnvioState {
  readonly estado: EnvioEstado;
  /** Mensaje accesible para la persona. Nunca contiene detalle técnico. */
  readonly mensaje: string | null;
  /** Se incrementa en cada desenlace fallido para repetir foco y anuncio. */
  readonly nonce: number;
}

export const ENVIO_INACTIVO: EnvioState = {
  estado: 'inactivo',
  mensaje: null,
  nonce: 0,
};

export interface InscripcionState {
  /** `null` mientras se muestra «¿Cómo se va a registrar?». */
  readonly perfil: PerfilId | null;
  readonly paso: number;
  readonly terminada: boolean;
  readonly rama: DatosRama | null;
  readonly errores: Errores;
  /** Primer control con error tras intentar avanzar; el cliente le da foco. */
  readonly campoFoco: string | null;
  /** Se incrementa en cada intento fallido para repetir el foco y el anuncio. */
  readonly focoNonce: number;
  /** Estado del envío a la API. Solo lo usa la rama Paciente. */
  readonly envio: EnvioState;
}

export const ESTADO_INICIAL: InscripcionState = {
  perfil: null,
  paso: 1,
  terminada: false,
  rama: null,
  errores: {},
  campoFoco: null,
  focoNonce: 0,
  envio: ENVIO_INACTIVO,
};

/** Grupos de ubicación existentes, por rama. */
export type UbicacionId = 'principal' | 'institucion';

export type InscripcionAction =
  | { readonly type: 'elegirPerfil'; readonly perfil: PerfilId }
  | { readonly type: 'siguiente' }
  | { readonly type: 'atras' }
  | { readonly type: 'irAPaso'; readonly paso: number }
  | { readonly type: 'reiniciar' }
  | { readonly type: 'actualizarPaciente'; readonly patch: Partial<DatosPaciente> }
  | { readonly type: 'actualizarCuidador'; readonly patch: Partial<DatosCuidador> }
  | { readonly type: 'actualizarVisitador'; readonly patch: Partial<DatosVisitador> }
  | {
      readonly type: 'elegirDepartamento';
      readonly grupo: UbicacionId;
      readonly codigo: string;
    }
  | { readonly type: 'elegirMunicipio'; readonly grupo: UbicacionId; readonly codigo: string }
  | {
      readonly type: 'escribirCorregimiento';
      readonly grupo: UbicacionId;
      readonly texto: string;
    }
  | {
      readonly type: 'fechaNacimiento';
      readonly valor: string;
      readonly edad: number | null;
    }
  | { readonly type: 'alternarClasificacion'; readonly clave: ClasificacionId }
  | { readonly type: 'alternarDiagnostico'; readonly valor: string }
  | { readonly type: 'agregarOtroDiagnostico' }
  | { readonly type: 'escribirOtroDiagnostico'; readonly indice: number; readonly texto: string }
  | { readonly type: 'quitarOtroDiagnostico'; readonly indice: number }
  /* Desenlaces del envío de la rama Paciente a la API. */
  | { readonly type: 'envioExitoso' }
  | { readonly type: 'envioFallido'; readonly mensaje: string }
  | { readonly type: 'envioConflicto'; readonly mensaje: string };

export type ClasificacionId = 'mayor60' | 'discapacidad' | 'requiereCuidadoCasa';

function primerError(errores: Errores): string | null {
  const [primero] = Object.keys(errores);
  return primero ?? null;
}

function conValoresPaciente(
  state: InscripcionState,
  actualizar: (valores: DatosPaciente) => DatosPaciente,
): InscripcionState {
  if (state.rama === null || state.rama.perfil !== 'paciente') {
    return state;
  }
  return {
    ...state,
    rama: { perfil: 'paciente', valores: actualizar(state.rama.valores) },
    errores: {},
    campoFoco: null,
    // Corregir un dato reabre la posibilidad de reintentar el envío.
    envio: state.envio.estado === 'enviando' ? state.envio : ENVIO_INACTIVO,
  };
}

/** Alterna la pertenencia de un valor en una lista de selección múltiple. */
export function alternarEnLista(lista: readonly string[], valor: string): readonly string[] {
  return lista.includes(valor)
    ? lista.filter((item) => item !== valor)
    : [...lista, valor];
}

/**
 * Aplica la regla de diagnósticos (FR-06): «Ninguna» es excluyente y «Otros»
 * limpia sus textos al deseleccionarse. No altera la clasificación prioritaria.
 */
function alternarDiagnostico(valores: DatosPaciente, valor: string): DatosPaciente {
  if (valor === DIAGNOSTICO_NINGUNA) {
    const marcada = valores.diagnosticos.includes(DIAGNOSTICO_NINGUNA);
    return {
      ...valores,
      diagnosticos: marcada ? [] : [DIAGNOSTICO_NINGUNA],
      otrosDiagnosticos: [],
    };
  }

  const seleccionados = alternarEnLista(
    valores.diagnosticos.filter((item) => item !== DIAGNOSTICO_NINGUNA),
    valor,
  );

  const activaOtros = seleccionados.includes(DIAGNOSTICO_OTROS);
  return {
    ...valores,
    diagnosticos: seleccionados,
    otrosDiagnosticos: activaOtros
      ? valores.otrosDiagnosticos.length === 0
        ? ['']
        : valores.otrosDiagnosticos
      : [],
  };
}

/**
 * Al cambiar de departamento se descarta cualquier municipio que ya no le
 * pertenezca, para que la pareja nunca quede inconsistente (FR-04A).
 */
function conDepartamento(ubicacion: Ubicacion, codigo: string): Ubicacion {
  return {
    ...ubicacion,
    departamento: codigo,
    municipio: municipioPerteneceA(ubicacion.municipio, codigo) ? ubicacion.municipio : '',
  };
}

function transformarUbicacion(
  rama: DatosRama,
  grupo: UbicacionId,
  transformar: (ubicacion: Ubicacion) => Ubicacion,
): DatosRama {
  if (rama.perfil === 'visitador' && grupo === 'institucion') {
    return {
      perfil: 'visitador',
      valores: {
        ...rama.valores,
        ubicacionInstitucion: transformar(rama.valores.ubicacionInstitucion),
      },
    };
  }
  if (grupo === 'institucion') {
    return rama;
  }
  switch (rama.perfil) {
    case 'paciente':
      return {
        perfil: 'paciente',
        valores: { ...rama.valores, ubicacion: transformar(rama.valores.ubicacion) },
      };
    case 'cuidador':
      return {
        perfil: 'cuidador',
        valores: { ...rama.valores, ubicacion: transformar(rama.valores.ubicacion) },
      };
    case 'visitador':
      return {
        perfil: 'visitador',
        valores: { ...rama.valores, ubicacion: transformar(rama.valores.ubicacion) },
      };
  }
}

function conUbicacion(
  state: InscripcionState,
  grupo: UbicacionId,
  transformar: (ubicacion: Ubicacion) => Ubicacion,
): InscripcionState {
  if (state.rama === null) {
    return state;
  }
  return {
    ...state,
    rama: transformarUbicacion(state.rama, grupo, transformar),
    errores: {},
    campoFoco: null,
  };
}

/**
 * La fecha de nacimiento del paciente marca la casilla de mayor de 60 años, tal
 * como indica la referencia («Marcado automáticamente por su fecha de
 * nacimiento»). Solo desmarca lo que ella misma marcó y nunca toca las otras
 * dos casillas de clasificación.
 */
function conFechaNacimientoPaciente(
  valores: DatosPaciente,
  fecha: string,
  edad: number | null,
): DatosPaciente {
  if (edad !== null && edad >= 60) {
    return {
      ...valores,
      fechaNacimiento: fecha,
      edad,
      mayor60: true,
      mayor60Automatico: true,
    };
  }
  return {
    ...valores,
    fechaNacimiento: fecha,
    edad,
    mayor60: valores.mayor60Automatico ? false : valores.mayor60,
    mayor60Automatico: false,
  };
}

/** Registra la fecha de nacimiento en la rama activa, sea cual sea. */
function conFechaNacimiento(
  rama: DatosRama,
  valor: string,
  edad: number | null,
): DatosRama {
  switch (rama.perfil) {
    case 'paciente':
      return {
        perfil: 'paciente',
        valores: conFechaNacimientoPaciente(rama.valores, valor, edad),
      };
    case 'cuidador':
      return {
        perfil: 'cuidador',
        valores: { ...rama.valores, fechaNacimiento: valor, edad },
      };
    case 'visitador':
      return {
        perfil: 'visitador',
        valores: { ...rama.valores, fechaNacimiento: valor, edad },
      };
  }
}

/**
 * Limpia los campos condicionales que dejaron de estar visibles tras un cambio
 * de valores (FR-04): si la condición se desactiva, el campo se oculta, su
 * error desaparece y su valor se elimina del estado local.
 */
function limpiarCondicionalesPaciente(valores: DatosPaciente): DatosPaciente {
  const sinDiscapacidad = valores.discapacidad
    ? valores
    : { ...valores, tipoDiscapacidad: PACIENTE_VACIO.tipoDiscapacidad, registroRlcpd: '' };

  return sinDiscapacidad.requiereCuidadoCasa
    ? sinDiscapacidad
    : { ...sinDiscapacidad, tieneCuidador: '', apoyos: [] };
}

function limpiarCondicionalesCuidador(valores: DatosCuidador): DatosCuidador {
  return valores.tieneFormacion === 'Sí'
    ? valores
    : {
        ...valores,
        institucionFormacion: CUIDADOR_VACIO.institucionFormacion,
        tipoCertificacion: '',
        fechaCertificacion: '',
      };
}

function limpiarCondicionalesVisitador(valores: DatosVisitador): DatosVisitador {
  return valores.eps === 'Otra EPS' ? valores : { ...valores, otraEps: '' };
}

export function inscripcionReducer(
  state: InscripcionState,
  action: InscripcionAction,
): InscripcionState {
  switch (action.type) {
    // Elegir perfil descarta cualquier rama anterior: no se hereda ningún valor.
    case 'elegirPerfil':
      return {
        ...ESTADO_INICIAL,
        perfil: action.perfil,
        rama: ramaVacia(action.perfil),
      };

    case 'siguiente': {
      if (state.rama === null || state.terminada) {
        return state;
      }
      const errores = validarPaso(state.rama, state.paso);
      const campo = primerError(errores);
      if (campo !== null) {
        return { ...state, errores, campoFoco: campo, focoNonce: state.focoNonce + 1 };
      }
      if (state.paso >= TOTAL_PASOS) {
        // La rama Paciente no se da por terminada aquí: primero debe
        // persistirse en el servidor. La pantalla de cierre solo aparece tras
        // un 201 real (TASK-MVP-CORE-01 §8.4).
        if (state.rama.perfil === 'paciente') {
          if (state.envio.estado === 'enviando') {
            return state;
          }
          return {
            ...state,
            errores: {},
            campoFoco: null,
            envio: { estado: 'enviando', mensaje: null, nonce: state.envio.nonce },
          };
        }
        return { ...state, terminada: true, errores: {}, campoFoco: null };
      }
      return { ...state, paso: state.paso + 1, errores: {}, campoFoco: null };
    }

    // Desde el primer paso, «Atrás» vuelve a la selección y limpia la rama.
    case 'atras': {
      if (state.paso <= 1) {
        return ESTADO_INICIAL;
      }
      return { ...state, paso: state.paso - 1, errores: {}, campoFoco: null };
    }

    case 'irAPaso': {
      if (
        state.rama === null ||
        state.terminada ||
        action.paso < 1 ||
        action.paso > TOTAL_PASOS ||
        action.paso === state.paso
      ) {
        return state;
      }
      return { ...state, paso: action.paso, errores: {}, campoFoco: null };
    }

    case 'reiniciar':
      return ESTADO_INICIAL;

    case 'actualizarPaciente':
      return conValoresPaciente(state, (valores) =>
        limpiarCondicionalesPaciente({ ...valores, ...action.patch }),
      );

    case 'actualizarCuidador': {
      if (state.rama === null || state.rama.perfil !== 'cuidador') {
        return state;
      }
      return {
        ...state,
        rama: {
          perfil: 'cuidador',
          valores: limpiarCondicionalesCuidador({ ...state.rama.valores, ...action.patch }),
        },
        errores: {},
        campoFoco: null,
      };
    }

    case 'actualizarVisitador': {
      if (state.rama === null || state.rama.perfil !== 'visitador') {
        return state;
      }
      return {
        ...state,
        rama: {
          perfil: 'visitador',
          valores: limpiarCondicionalesVisitador({ ...state.rama.valores, ...action.patch }),
        },
        errores: {},
        campoFoco: null,
      };
    }

    case 'elegirDepartamento':
      return conUbicacion(state, action.grupo, (ubicacion) =>
        conDepartamento(ubicacion, action.codigo),
      );

    case 'elegirMunicipio':
      return conUbicacion(state, action.grupo, (ubicacion) => ({
        ...ubicacion,
        municipio: action.codigo,
      }));

    case 'escribirCorregimiento':
      return conUbicacion(state, action.grupo, (ubicacion) => ({
        ...ubicacion,
        corregimiento: action.texto,
      }));

    case 'fechaNacimiento': {
      if (state.rama === null) {
        return state;
      }
      return {
        ...state,
        rama: conFechaNacimiento(state.rama, action.valor, action.edad),
        errores: {},
        campoFoco: null,
      };
    }

    /*
     * Las tres clasificaciones son independientes y no excluyentes: alternar
     * una nunca modifica el valor de las otras dos ni los diagnósticos.
     */
    case 'alternarClasificacion':
      return conValoresPaciente(state, (valores) => {
        if (action.clave === 'mayor60') {
          return limpiarCondicionalesPaciente({
            ...valores,
            mayor60: !valores.mayor60,
            mayor60Automatico: false,
          });
        }
        if (action.clave === 'discapacidad') {
          return limpiarCondicionalesPaciente({
            ...valores,
            discapacidad: !valores.discapacidad,
          });
        }
        return limpiarCondicionalesPaciente({
          ...valores,
          requiereCuidadoCasa: !valores.requiereCuidadoCasa,
        });
      });

    case 'alternarDiagnostico':
      return conValoresPaciente(state, (valores) =>
        alternarDiagnostico(valores, action.valor),
      );

    case 'agregarOtroDiagnostico':
      return conValoresPaciente(state, (valores) =>
        valores.diagnosticos.includes(DIAGNOSTICO_OTROS)
          ? { ...valores, otrosDiagnosticos: [...valores.otrosDiagnosticos, ''] }
          : valores,
      );

    case 'escribirOtroDiagnostico':
      return conValoresPaciente(state, (valores) => ({
        ...valores,
        otrosDiagnosticos: valores.otrosDiagnosticos.map((texto, indice) =>
          indice === action.indice ? action.texto : texto,
        ),
      }));

    case 'quitarOtroDiagnostico':
      return conValoresPaciente(state, (valores) => {
        const restantes = valores.otrosDiagnosticos.filter(
          (_texto, indice) => indice !== action.indice,
        );
        return { ...valores, otrosDiagnosticos: restantes.length === 0 ? [''] : restantes };
      });

    case 'envioExitoso':
      return {
        ...state,
        terminada: true,
        errores: {},
        campoFoco: null,
        envio: ENVIO_INACTIVO,
      };

    case 'envioFallido':
      return {
        ...state,
        terminada: false,
        envio: {
          estado: 'error',
          mensaje: action.mensaje,
          nonce: state.envio.nonce + 1,
        },
      };

    case 'envioConflicto':
      return {
        ...state,
        terminada: false,
        envio: {
          estado: 'conflicto',
          mensaje: action.mensaje,
          nonce: state.envio.nonce + 1,
        },
      };

    default:
      return state;
  }
}

/* -------------------------------------------------------------------------- */
/* Derivados de presentación                                                   */
/* -------------------------------------------------------------------------- */

/** Edad cumplida entre dos fechas. Solo aritmética de calendario. */
export function edadEnAnios(fechaIso: string, hoy: Date): number | null {
  if (fechaIso.trim().length === 0) {
    return null;
  }
  const nacimiento = new Date(`${fechaIso}T00:00:00`);
  if (Number.isNaN(nacimiento.getTime())) {
    return null;
  }
  let anios = hoy.getFullYear() - nacimiento.getFullYear();
  const meses = hoy.getMonth() - nacimiento.getMonth();
  if (meses < 0 || (meses === 0 && hoy.getDate() < nacimiento.getDate())) {
    anios -= 1;
  }
  return anios >= 0 && anios < 130 ? anios : null;
}

export function textoEdad(edad: number | null): string {
  return edad === null ? 'Edad —' : `Edad ${edad} años`;
}

export function nombreCompleto(valores: DatosPersonales): string {
  const nombre = `${valores.nombres} ${valores.apellidos}`.trim();
  return nombre.length === 0 ? 'Sin nombre registrado' : nombre;
}

/** Iniciales visibles del nombre registrado; «P» cuando no hay nombre. */
export function inicialesDe(valores: DatosPersonales): string {
  const inicial = (texto: string): string =>
    texto.trim().length === 0 ? '' : texto.trim()[0]!.toLocaleUpperCase('es-CO');
  const iniciales = `${inicial(valores.nombres)}${inicial(valores.apellidos)}`;
  return iniciales.length === 0 ? 'P' : iniciales;
}

/** Nombre corto para saludar en la experiencia posterior. */
export function primerNombre(valores: DatosPersonales): string {
  const [primero] = valores.nombres.trim().split(/\s+/u);
  return primero === undefined || primero.length === 0 ? 'paciente' : primero;
}

/** Etiqueta visible de la zona declarada. */
export function textoZona(zona: ZonaId | ''): string {
  return ZONAS.find((opcion) => opcion.id === zona)?.etiqueta ?? 'Sin indicar';
}

/** Resumen textual de la clasificación prioritaria marcada. */
export function textoClasificacion(valores: DatosPaciente): string {
  const partes = [
    valores.mayor60 ? 'Mayor de 60' : null,
    valores.discapacidad ? 'Con discapacidad' : null,
    valores.requiereCuidadoCasa ? 'Requiere cuidados en casa' : null,
  ].filter((parte): parte is string => parte !== null);

  return partes.length === 0 ? 'Sin clasificación marcada' : partes.join(' · ');
}

/** Resumen textual de los diagnósticos marcados, incluidos los de «Otros». */
export function textoDiagnosticos(valores: DatosPaciente): string {
  const marcados = valores.diagnosticos.filter((item) => item !== DIAGNOSTICO_OTROS);
  const otros = valores.otrosDiagnosticos
    .map((texto) => texto.trim())
    .filter((texto) => texto.length > 0);
  const total = [...marcados, ...otros];
  return total.length === 0 ? 'Sin diagnósticos registrados' : total.join(' · ');
}
