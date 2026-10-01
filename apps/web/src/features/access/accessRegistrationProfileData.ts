import type { RequestedProfile } from './accessRequestClient';

/**
 * Datos de presentación de la inscripción guiada de cinco pasos
 * (SPEC 038, MP04-C3).
 *
 * Este módulo es SOLO presentación: títulos exactos por rama, catálogos con
 * rótulo visible, ayudas de Elí por paso y mapas de etiquetas para el resumen
 * y la bandeja. Los CÓDIGOS son los del contrato del servidor; los rótulos son
 * los aprobados de la referencia. Nada aquí valida ni persiste.
 */

export interface CatalogOption {
  readonly code: string;
  readonly label: string;
}

function catalogo(pares: ReadonlyArray<readonly [string, string]>): ReadonlyArray<CatalogOption> {
  return pares.map(([code, label]) => ({ code, label }));
}

export const NECESITA_APOYO_OPCIONES = catalogo([
  ['SI', 'Sí'],
  ['NO', 'No'],
  ['NO_SABE', 'No sabe'],
]);

export const APOYOS_OPCIONES = catalogo([
  ['MOVILIZARSE', 'Ayuda para movilizarse'],
  ['MEDICAMENTOS', 'Administración de medicamentos'],
  ['ALIMENTACION', 'Alimentación'],
  ['HIGIENE', 'Higiene personal'],
  ['ACOMPANAMIENTO', 'Acompañamiento'],
  ['SUPERVISION', 'Supervisión permanente'],
]);

export const CONDICIONES_OPCIONES = catalogo([
  ['HIPERTENSION', 'Hipertensión'],
  ['DIABETES', 'Diabetes'],
  ['ARTRITIS', 'Artritis'],
  ['EPOC', 'EPOC'],
  ['ALZHEIMER', 'Alzheimer'],
  ['MOVILIDAD_REDUCIDA', 'Movilidad reducida'],
  ['NINGUNA', 'Ninguna'],
]);

export const ZONA_OPCIONES = catalogo([
  ['URBANA', 'Urbana'],
  ['RURAL', 'Rural'],
]);

export const EPS_PACIENTE_OPCIONES = catalogo([
  ['NUEVA_EPS', 'Nueva EPS'],
  ['SANITAS', 'Sanitas'],
  ['SURA', 'Sura'],
  ['SALUD_TOTAL', 'Salud Total'],
  ['COMPENSAR', 'Compensar'],
  ['FAMISANAR', 'Famisanar'],
  ['OTRA_EPS', 'Otra EPS'],
  ['NO_SABE', 'No sabe'],
  ['SIN_EPS', 'No tiene EPS'],
]);

export const TIPO_CUIDADOR_OPCIONES = catalogo([
  ['FAMILIAR', 'Familiar'],
  ['INFORMAL', 'Cuidador informal'],
  ['REMUNERADO', 'Cuidador remunerado'],
  ['AUXILIAR_ENFERMERIA', 'Auxiliar de enfermería'],
  ['PROFESIONAL_SALUD', 'Profesional de salud'],
  ['OTRO', 'Otro'],
]);

export const SI_NO_OPCIONES = catalogo([
  ['SI', 'Sí'],
  ['NO', 'No'],
]);

export const INSTITUCION_FORMACION_OPCIONES = catalogo([
  ['SENA', 'Formación SENA'],
  ['SUPERIOR', 'Institución de educación superior'],
  ['FUNDACION_ONG', 'Fundación u ONG'],
  ['HOSPITAL_ESE', 'Hospital o ESE'],
  ['OTRA', 'Otra'],
]);

export const HORARIOS_OPCIONES = catalogo([
  ['MANANA', 'Mañana'],
  ['TARDE', 'Tarde'],
  ['NOCHE', 'Noche'],
  ['TODO_EL_DIA', 'Todo el día'],
  ['DIAS_ESPECIFICOS', 'Días específicos'],
]);

export const PACIENTE_REGISTRADO_OPCIONES = catalogo([
  ['SI', 'Sí'],
  ['NO', 'No'],
  ['NO_SABE', 'No sabe'],
]);

export const RELACION_PACIENTE_OPCIONES = catalogo([
  ['MADRE', 'Madre'],
  ['PADRE', 'Padre'],
  ['HIJO', 'Hijo'],
  ['HIJA', 'Hija'],
  ['CONYUGE', 'Cónyuge'],
  ['HERMANO', 'Hermano'],
  ['HERMANA', 'Hermana'],
  ['OTRO_FAMILIAR', 'Otro familiar'],
  ['CONTRATADO', 'Cuidador contratado'],
  ['OTRO', 'Otro'],
]);

export const VECINO_RELACION_OPCIONES = catalogo([
  ['VECINO', 'Vecino'],
  ['FAMILIAR', 'Familiar'],
  ['ADMINISTRADOR', 'Administrador'],
  ['PORTERO', 'Portero'],
  ['LIDER', 'Líder comunitario'],
  ['OTRO', 'Otro'],
]);

export const PROFESION_OPCIONES = catalogo([
  ['MEDICO', 'Médico'],
  ['ENFERMERO', 'Enfermero'],
  ['AUXILIAR_ENFERMERIA', 'Auxiliar de enfermería'],
  ['FISIOTERAPEUTA', 'Fisioterapeuta'],
  ['TERAPEUTA_OCUPACIONAL', 'Terapeuta ocupacional'],
  ['TRABAJADOR_SOCIAL', 'Trabajador social'],
  ['PSICOLOGO', 'Psicólogo'],
  ['NUTRICIONISTA', 'Nutricionista'],
  ['OTRO', 'Otro'],
]);

export const TIPOS_ATENCION_OPCIONES = catalogo([
  ['VISITA_MEDICA', 'Visita médica domiciliaria'],
  ['SEGUIMIENTO', 'Seguimiento al paciente'],
  ['ENFERMERIA', 'Enfermería'],
  ['VALORACION', 'Valoración inicial'],
  ['MEDICAMENTOS', 'Control de medicamentos'],
  ['REHABILITACION', 'Rehabilitación'],
  ['TRABAJO_SOCIAL', 'Trabajo social'],
  ['VERIFICACION', 'Verificación de condiciones domiciliarias'],
  ['OTRO', 'Otro'],
]);

export const EPS_VISITADOR_OPCIONES = catalogo([
  ['NUEVA_EPS', 'Nueva EPS'],
  ['SANITAS', 'Sanitas'],
  ['SURA', 'Sura'],
  ['SALUD_TOTAL', 'Salud Total'],
  ['COMPENSAR', 'Compensar'],
  ['FAMISANAR', 'Famisanar'],
  ['OTRA_EPS', 'Otra EPS'],
]);

export const ZONAS_COBERTURA_OPCIONES = catalogo([
  ['COMUNA_URBANA', 'Comuna urbana'],
  ['CABECERA', 'Cabecera municipal'],
  ['CENTRO_POBLADO', 'Centro poblado'],
  ['RURAL_DISPERSA', 'Zona rural dispersa'],
]);

/** Valor que activa el campo condicional de otra EPS. Espejo del contrato. */
export const REGISTRATION_OTRA_EPS = 'OTRA_EPS';

/** Rótulo visible de un código dentro de su catálogo. */
export function etiquetaDe(opciones: ReadonlyArray<CatalogOption>, codigo: string): string {
  return opciones.find((opcion) => opcion.code === codigo)?.label ?? codigo;
}

/* -------------------------------------------------------------------------- */
/* Ramas y pasos                                                                */
/* -------------------------------------------------------------------------- */

export interface PasoMeta {
  readonly paso: 1 | 2 | 3 | 4 | 5;
  readonly titulo: string;
  /** Orientación amistosa de Elí al inicio del paso. */
  readonly ayudaEli: string;
  /** Etiqueta de sección en mayúsculas dentro de la tarjeta de contenido. */
  readonly seccion: string;
}

export interface RamaMeta {
  readonly perfil: RequestedProfile;
  readonly titulo: string;
  readonly bajada: string;
  readonly ayuda: string;
  readonly tituloRama: string;
  readonly pasos: readonly [PasoMeta, PasoMeta, PasoMeta, PasoMeta, PasoMeta];
}

export const RAMAS_INSCRIPCION: readonly [RamaMeta, RamaMeta, RamaMeta] = [
  {
    perfil: 'PATIENT',
    titulo: 'Paciente',
    bajada: 'Recibo o necesito atención en casa',
    ayuda: 'Cuéntanos quién recibirá la atención en casa. Usa solo datos ficticios de prueba.',
    tituloRama: 'INSCRIPCIÓN COMO PACIENTE',
    pasos: [
      { paso: 1, titulo: 'Datos personales', ayudaEli: 'Empecemos con tus datos personales. Te acompaño campo por campo.', seccion: 'A · DATOS PERSONALES' },
      { paso: 2, titulo: 'Condición y necesidades', ayudaEli: 'Cuéntanos qué apoyo necesitas. Son declaraciones tuyas, no diagnósticos validados.', seccion: 'B · CONDICIÓN Y NECESIDADES' },
      { paso: 3, titulo: 'Ubicación y EPS', ayudaEli: '¿Dónde vives y cuál es tu EPS? Solo datos ficticios de prueba.', seccion: 'C · UBICACIÓN Y EPS' },
      { paso: 4, titulo: 'Contactos', ayudaEli: 'Personas a las que podemos acudir si no te localizamos.', seccion: 'D · CONTACTOS' },
      { paso: 5, titulo: 'Confirmación', ayudaEli: 'Revisa tu información y registra tu solicitud.', seccion: 'E · CONFIRMACIÓN' },
    ],
  },
  {
    perfil: 'CAREGIVER',
    titulo: 'Cuidador',
    bajada: 'Cuido a una o más personas',
    ayuda: 'Cuéntanos quién eres como persona cuidadora. Usa solo datos ficticios de prueba.',
    tituloRama: 'INSCRIPCIÓN COMO CUIDADOR',
    pasos: [
      { paso: 1, titulo: 'Datos personales', ayudaEli: 'Primero tú como persona. Después hablamos del paciente que cuidas.', seccion: 'A · DATOS PERSONALES' },
      { paso: 2, titulo: 'Perfil del cuidador', ayudaEli: 'Cuéntanos tu experiencia y disponibilidad como cuidador.', seccion: 'B · PERFIL DEL CUIDADOR' },
      { paso: 3, titulo: 'Vincular paciente', ayudaEli: 'Indícanos si el paciente ya está registrado. Aquí no se crea ningún vínculo real.', seccion: 'C · VINCULAR PACIENTE' },
      { paso: 4, titulo: 'Contacto cercano', ayudaEli: 'Alguien que viva cerca del paciente y pueda ayudar a localizarlo.', seccion: 'D · CONTACTO CERCANO' },
      { paso: 5, titulo: 'Confirmación', ayudaEli: 'Revisa tu información y registra tu solicitud.', seccion: 'E · CONFIRMACIÓN' },
    ],
  },
  {
    perfil: 'FIELD_PROFESSIONAL',
    titulo: 'Visitador médico',
    bajada: 'Profesional que realiza visitas domiciliarias',
    ayuda: 'Cuéntanos quién realiza las visitas. Usa solo datos ficticios de prueba.',
    tituloRama: 'INSCRIPCIÓN COMO VISITADOR MÉDICO',
    pasos: [
      { paso: 1, titulo: 'Datos personales', ayudaEli: 'Empecemos con tus datos personales.', seccion: 'A · DATOS PERSONALES' },
      { paso: 2, titulo: 'Información profesional', ayudaEli: 'Tu profesión y el tipo de atención que realizas.', seccion: 'B · INFORMACIÓN PROFESIONAL' },
      { paso: 3, titulo: 'EPS e institución', ayudaEli: 'La EPS y la institución son datos separados.', seccion: 'C · EPS E INSTITUCIÓN' },
      { paso: 4, titulo: 'Zona de atención', ayudaEli: 'El departamento y el municipio principal que cubres.', seccion: 'D · ZONA DE ATENCIÓN' },
      { paso: 5, titulo: 'Verificación', ayudaEli: 'Revisa tu información. Quedará pendiente de verificación.', seccion: 'E · VERIFICACIÓN' },
    ],
  },
];

export function ramaDe(perfil: RequestedProfile): RamaMeta {
  const rama = RAMAS_INSCRIPCION.find((candidata) => candidata.perfil === perfil);

  if (rama === undefined) {
    throw new Error('perfil de inscripción desconocido');
  }

  return rama;
}
