import { branding, platformNameInSentence } from '@/config/branding';

import type { HospitalVistaEncabezado } from './hospitalAgendaConfig';
import { HOSPITAL_SIN_FUENTE } from './hospitalProfessionalsConfig';
import type {
  HospitalDatoSinFuente,
  HospitalVinculacionModalidad,
} from './hospitalProfessionalsConfig';
import type { HospitalTonoId } from './hospitalTonos';

/**
 * Contratos tipados y fixtures demostrativos de «Administración institucional»
 * (TASK-003H-05).
 *
 * Fuente visual vinculante: `prototype-claude/Eligeme-Hospital.dc.html`,
 * contenedor `vConfig` (líneas 648–658) y sus bloques `Membresías` (660–727),
 * `Historia clínica` (729–778), `Personal y accesos` (780–824),
 * `Agenda y servicios` (862–875), `Institución e integraciones` (905–935) y
 * `Auditoría` (937–955), con los datos demostrativos de las líneas 1189 y
 * 1219–1323.
 *
 * Alcance: presentación. Nada de lo declarado aquí crea capacidad productiva.
 * No hay backend, red, persistencia, autenticación, permisos, pagos,
 * interoperabilidad de historia clínica, integraciones activas, nómina,
 * honorarios ni captura de auditoría. Los precios, personas, códigos, archivos,
 * conteos, parámetros y eventos son ficticios y proceden del prototipo: no son
 * reglas comerciales, clínicas, laborales, institucionales ni evidencia.
 *
 * La presencia de una vista, un rol, una pastilla o un botón no equivale a
 * autenticación, autorización, consentimiento, aislamiento institucional ni
 * trazabilidad: todo eso deberá autorizarse en servidor y capa de datos en una
 * tarea aprobada posterior.
 */

/**
 * Nombre visible de la plataforma dentro de los textos de esta vista.
 *
 * Procede del branding ya centralizado (`src/config/branding.ts`), que es la
 * única fuente del nombre mostrado en pantalla. El nombre técnico interno del
 * proyecto no se escribe en ningún texto visible.
 */
const PLATAFORMA = platformNameInSentence();

/* ========================================================================== */
/* Navegación interna del contenedor administrativo                           */
/* ========================================================================== */

/**
 * Pestañas locales del contenedor (prototipo, líneas 656–657 y 1224–1230).
 *
 * Se conservan los rótulos del prototipo. `Novedades` y `Semáforo y alertas`
 * quedan expresamente fuera de TASK-003H-05 (FR-01.7): sus experiencias
 * aprobadas ya existen en TASK-003H-04 y TASK-003H-03 y no se duplican aquí.
 *
 * La corrección final aprobada por la Product Owner separa `Roles y permisos`
 * de `Personal y accesos` (apartados A y E): `Personal y accesos` queda como la
 * pantalla operativa cotidiana —indicadores, buscador, filtros y listado— y
 * `Roles y permisos` como la lectura comprensible de qué puede y qué no puede
 * hacer cada rol. Siguen siendo dos bloques del mismo contenedor: no hay ruta
 * nueva ni arquitectura paralela.
 */
export const HOSPITAL_ADMIN_PESTANAS = [
  'Solicitudes de acceso',
  'Membresías',
  'Historia clínica',
  'Personal y accesos',
  'Roles y permisos',
  'Agenda y servicios',
  'Institución e integraciones',
  'Auditoría',
] as const;

/**
 * SPEC 055 / MP05b (decisión del PO «Pantalla del gestor»): pestaña REAL de la
 * sesión administrativa humana, fuera de las ocho pestañas demostrativas. Solo
 * se ofrece junto a «Solicitudes de acceso»; el servidor decide si la cuenta es
 * gestora de alguna organización.
 */
export const HOSPITAL_ADMIN_PESTANA_CUIDADO = 'Espacios de cuidado' as const;

export type HospitalAdminPestanaId =
  | (typeof HOSPITAL_ADMIN_PESTANAS)[number]
  | typeof HOSPITAL_ADMIN_PESTANA_CUIDADO;

/** Pestaña de partida cuando todavía no existe selección (FR-01.4). */
export const HOSPITAL_ADMIN_PESTANA_INICIAL: HospitalAdminPestanaId = 'Membresías';

/** `true` solo para las ocho pestañas autorizadas. */
export function esPestanaAdministracion(id: string): id is HospitalAdminPestanaId {
  return (HOSPITAL_ADMIN_PESTANAS as readonly string[]).includes(id) || id === HOSPITAL_ADMIN_PESTANA_CUIDADO;
}

/* ========================================================================== */
/* Piezas compartidas por los bloques administrativos                         */
/* ========================================================================== */

/**
 * Estado visible de toda acción no implementada. `Próximamente` y
 * `Demostración` son los dos únicos rótulos autorizados: ninguno afirma que la
 * acción exista, se haya ejecutado o vaya a ejecutarse.
 */
export const HOSPITAL_ADMIN_ESTADOS_ACCION = ['Próximamente', 'Demostración'] as const;

export type HospitalAdminEstadoAccion = (typeof HOSPITAL_ADMIN_ESTADOS_ACCION)[number];

/**
 * Acción exclusivamente visual. `disponible` es `false` por contrato y el
 * componente la renderiza deshabilitada: no guarda, no cobra, no compra, no
 * renueva, no abre selector de archivos, no muta el fixture, no navega, no
 * llama red y no simula éxito.
 */
export interface HospitalAdminAccion {
  readonly id: string;
  readonly etiqueta: string;
  readonly variante: 'primaria' | 'neutra';
  readonly estado: HospitalAdminEstadoAccion;
  readonly disponible: false;
}

/** Campo estructural futuro: nombra la dimensión y declara que no tiene valor. */
export interface HospitalAdminCampoFuturo {
  readonly id: string;
  readonly etiqueta: string;
  readonly estado: HospitalDatoSinFuente;
}

/** Bloque de preparación estructural: título, explicación y campos futuros. */
export interface HospitalAdminBloqueFuturo {
  readonly titulo: string;
  readonly descripcion: string;
  readonly campos: readonly HospitalAdminCampoFuturo[];
}

/** Campo de formulario demostrativo con etiqueta asociada y valor de partida. */
export interface HospitalAdminCampo {
  readonly id: string;
  readonly etiqueta: string;
  /** Valor demostrativo inicial; el estado local efímero puede cambiarlo. */
  readonly valor: string;
}

/** Campo de un formulario vacío: solo etiqueta, tipo y texto de ejemplo. */
export interface HospitalAdminCampoVacio {
  readonly id: string;
  readonly etiqueta: string;
  readonly tipo: 'texto' | 'fecha' | 'lista' | 'parrafo';
  /** Texto de ejemplo del prototipo; nunca es un valor guardado. */
  readonly ejemplo?: string;
  /** Opciones de una lista desplegable demostrativa. */
  readonly opciones?: readonly string[];
}

/** Columna de una tabla administrativa. */
export interface HospitalAdminColumna {
  readonly id: string;
  readonly etiqueta: string;
}

/* ========================================================================== */
/* FR-02 — Membresías y servicios                                             */
/* ========================================================================== */

/**
 * Versión y vigencia de un plan (prototipo, campo `version`).
 *
 * Contrato separado del plan (FR-02.6): un mismo plan podrá tener varias
 * versiones con su propia vigencia sin duplicar el plan ni sus precios. El
 * prototipo aporta una sola etiqueta ya redactada; el inicio, el fin y el
 * estado de cada versión todavía no existen como datos y no se inventan aquí.
 */
export interface HospitalPlanVersionVigencia {
  readonly etiqueta: string;
  /**
   * Fecha de vigencia tal como la redacta el prototipo. Cuando esa fecha no
   * existe se ocupa con un estado neutro: no se inventa ninguna.
   */
  readonly desde: string;
}

/**
 * Plan de membresía demostrativo (prototipo, líneas 666–681 y 1241–1245).
 *
 * `precio` y `periodo` son datos ficticios de presentación: no son tarifa
 * vigente, no habilitan cobro, compra, afiliación, renovación ni facturación y
 * no definen qué puede adquirir un paciente.
 */
export interface HospitalPlanMembresia {
  readonly id: string;
  readonly nombre: string;
  readonly descripcion: string;
  /** Visitas domiciliarias incluidas, tal como las enuncia el prototipo. */
  readonly visitas: string;
  /** Consultas virtuales incluidas. */
  readonly virtuales: string;
  /** Beneficios del plan, uno por línea. */
  readonly beneficios: readonly string[];
  /** Descuento del plan; `null` cuando el prototipo no declara ninguno. */
  readonly descuento: string | null;
  readonly precio: string;
  /** Periodicidad del cobro demostrativo: `Mensual`, `Trimestral`… */
  readonly periodicidad: string;
  /** Renovación declarada por el prototipo; `null` cuando no la declara. */
  readonly renovacion: string | null;
  readonly estado: string;
  readonly tono: HospitalTonoId;
  /** Versión y vigencia, en su propio contrato de presentación. */
  readonly version: HospitalPlanVersionVigencia;
  readonly accion: HospitalAdminAccion;
}

/**
 * Campos del formulario `Editar plan` (corrección aprobada, apartado H).
 *
 * Cada identificador nombra la dimensión editable de un plan. El formulario es
 * exclusivamente visual: se abre y se cierra con estado local efímero, parte de
 * los valores del plan y no guarda, no cobra y no versiona nada.
 */
export const HOSPITAL_PLAN_CAMPOS_EDITABLES = [
  'nombre',
  'descripcion',
  'precio',
  'periodicidad',
  'visitas',
  'virtuales',
  'beneficios',
  'descuento',
  'estado',
  'vigencia',
] as const;

export type HospitalPlanCampoEditable = (typeof HOSPITAL_PLAN_CAMPOS_EDITABLES)[number];

/** Campo del formulario de edición, con su etiqueta y su tipo de control. */
export interface HospitalPlanCampoEdicion {
  readonly id: HospitalPlanCampoEditable;
  readonly etiqueta: string;
  readonly tipo: 'texto' | 'parrafo' | 'lista';
  readonly opciones?: readonly string[];
}

/**
 * Valores de partida del formulario de edición de un plan.
 *
 * Es una proyección pura del fixture: no consulta, no deriva reglas y no
 * calcula precios. Un campo sin dato en el prototipo queda vacío en lugar de
 * recibir un valor inventado.
 */
export function valoresDelPlan(
  plan: HospitalPlanMembresia,
): Readonly<Record<HospitalPlanCampoEditable, string>> {
  return {
    nombre: plan.nombre,
    descripcion: plan.descripcion,
    precio: plan.precio,
    periodicidad: plan.periodicidad,
    visitas: plan.visitas,
    virtuales: plan.virtuales,
    beneficios: plan.beneficios.join('\n'),
    descuento: plan.descuento ?? '',
    estado: plan.estado,
    vigencia: plan.version.desde,
  };
}

/** Servicio configurable (prototipo, líneas 706–724 y 1246–1252). */
export interface HospitalServicioConfigurable {
  readonly id: string;
  readonly nombre: string;
  readonly precio: string;
  readonly duracion: string;
  readonly profesional: string;
  readonly cobertura: string;
  readonly tono: HospitalTonoId;
}

/**
 * Membresías y servicios.
 *
 * Decisión final de la Product Owner: «Gestión financiera» NO pertenece a
 * Configuración. Es un módulo principal e independiente del menú del Hospital y
 * su contenido lo crea TASK-003H-06, de modo que esta configuración no declara
 * ninguna referencia, acceso ni área financiera: nómina, honorarios, cuentas de
 * cobro, gastos, proveedores, insumos, convenios, presupuesto y ejecución no
 * aparecen aquí ni como anticipo.
 */
export interface HospitalMembresiasConfig {
  readonly titulo: string;
  readonly nota: string;
  readonly planes: readonly HospitalPlanMembresia[];
  /** Rótulos de cada dato dentro de la tarjeta de un plan. */
  readonly etiquetasPlan: {
    readonly visitas: string;
    readonly virtuales: string;
    readonly beneficios: string;
    readonly descuento: string;
    readonly vigencia: string;
  };
  readonly notaVersiones: string;
  readonly avisoAcciones: string;
  readonly formulario: {
    readonly titulo: string;
    readonly campos: readonly HospitalAdminCampoVacio[];
    readonly accion: HospitalAdminAccion;
  };
  /** Formulario visual de `Editar plan` (corrección aprobada, apartado H). */
  readonly edicion: {
    readonly titulo: string;
    readonly campos: readonly HospitalPlanCampoEdicion[];
    readonly guardar: HospitalAdminAccion;
    readonly cancelar: string;
    readonly nota: string;
  };
  readonly servicios: {
    readonly titulo: string;
    readonly columnas: readonly HospitalAdminColumna[];
    readonly items: readonly HospitalServicioConfigurable[];
    readonly nota: string;
  };
}

/* ========================================================================== */
/* FR-03 — Información clínica institucional autorizada/importada             */
/* ========================================================================== */

/** Naturaleza de la información tratada (prototipo, líneas 736–745). */
export interface HospitalClinicaBloque {
  readonly id: string;
  readonly titulo: string;
  readonly descripcion: string;
  readonly formatos: string;
}

/** Conteo del resumen de ejemplo (prototipo, líneas 754–759 y 1254–1260). */
export interface HospitalClinicaConteo {
  readonly id: string;
  readonly etiqueta: string;
  readonly valor: string;
  readonly tono: HospitalTonoId;
}

export interface HospitalClinicaConfig {
  readonly titulo: string;
  readonly descripcion: string;
  /** Aviso que impide leer la sección como una HCE completa o activa. */
  readonly aviso: string;
  readonly bloques: readonly HospitalClinicaBloque[];
  readonly archivo: {
    readonly etiquetaEjemplo: string;
    readonly nombre: string;
    readonly detalle: string;
    readonly accion: HospitalAdminAccion;
  };
  readonly resumen: {
    readonly titulo: string;
    readonly items: readonly HospitalClinicaConteo[];
    readonly nota: string;
  };
  readonly coincidencia: {
    readonly titulo: string;
    readonly descripcion: string;
    readonly acciones: readonly HospitalAdminAccion[];
  };
  readonly acciones: readonly HospitalAdminAccion[];
  /** Metadatos de procedencia futuros; ninguno tiene valor inventado. */
  readonly procedencia: HospitalAdminBloqueFuturo;
  readonly nota: string;
}

/* ========================================================================== */
/* FR-04 y FR-06 — Personal y accesos, roles y permisos                       */
/* ========================================================================== */

/**
 * Tipos de personal contemplados estructuralmente (FR-04.3).
 *
 * Es un catálogo conceptual y describe *qué clase de persona* es, no cómo está
 * vinculada. El prototipo no clasifica a sus personas demostrativas, de modo
 * que ninguna fila del listado recibe un tipo inventado.
 */
export const HOSPITAL_TIPOS_PERSONAL = [
  'Profesional',
  'Cuidador vinculado',
  'Administrativo',
  'Operador',
  'Otro personal autorizado',
] as const;

export type HospitalTipoPersonal = (typeof HOSPITAL_TIPOS_PERSONAL)[number];

/**
 * Tipos de vinculación del personal (corrección aprobada, apartado A).
 *
 * Es el eje operativo del listado: cada persona pertenece a uno y solo uno.
 * `interno` corresponde a la modalidad `empleado` ya aprobada en TASK-003H-04;
 * `independiente` y `convenio` conservan exactamente esa semántica; `externo`
 * es la persona autorizada que no pertenece a la institución. Empleado,
 * prestador independiente, tercero y externo siguen siendo relaciones
 * distintas: la plataforma no clasifica el vínculo jurídico, no aplica legislación
 * laboral y no calcula salario, honorarios, seguridad social ni retenciones.
 */
export const HOSPITAL_PERSONAL_VINCULACIONES = [
  'interno',
  'independiente',
  'convenio',
  'externo',
] as const;

export type HospitalPersonalVinculacionId = (typeof HOSPITAL_PERSONAL_VINCULACIONES)[number];

/** Descripción de un tipo de vinculación. */
export interface HospitalPersonalVinculacion {
  readonly id: HospitalPersonalVinculacionId;
  /** Rótulo completo del filtro y del bloque explicativo. */
  readonly etiqueta: string;
  /** Rótulo corto de la columna `Vinculación` del listado. */
  readonly corta: string;
  /** Rótulo del indicador de cabecera que cuenta este grupo. */
  readonly plural: string;
  readonly descripcion: string;
  /**
   * Modalidad equivalente ya aprobada en TASK-003H-04, cuando existe. `null`
   * para `externo`, que no es una modalidad de prestación de servicios.
   */
  readonly modalidad: HospitalVinculacionModalidad | null;
}

/**
 * Estados de acceso contemplados (corrección aprobada, apartados A y C).
 *
 * Describen el acceso a la plataforma, no la relación laboral ni la situación
 * asistencial de la persona. Ninguno concede, revoca ni verifica acceso real.
 */
export const HOSPITAL_ESTADOS_ACCESO = [
  'Activo',
  'Pendiente',
  'Suspendido',
  'Bloqueado',
] as const;

export type HospitalEstadoAcceso = (typeof HOSPITAL_ESTADOS_ACCESO)[number];

/**
 * Datos de acceso y credenciales visibles para la administración
 * (corrección aprobada, apartado C).
 *
 * Aquí no existe —ni podrá existir— ninguna contraseña: un administrador no
 * puede verla, no puede recuperarla en texto legible y no puede cambiarla por
 * otra persona. Solo se muestran señales de estado. Los valores son fixtures
 * demostrativos: no hay sesión, autenticación, segundo factor ni conteo real de
 * intentos.
 */
export interface HospitalAccesoPersona {
  readonly ultimoAcceso: string;
  readonly ultimoCambioCredenciales: string;
  readonly intentosFallidos: string;
  readonly segundoFactor: 'Pendiente' | 'Activo';
}

/**
 * Persona del listado administrativo (prototipo, líneas 793–806 y 1262–1268,
 * ampliado por la corrección aprobada, apartados A, B y C).
 *
 * Identidad institucional, código de personal, vinculación, rol descriptivo,
 * entidad y estado de acceso. No es una cuenta, no concede acceso, no define
 * relación laboral y no describe atención ni operación clínica.
 */
export interface HospitalPersonaAdministrativa {
  readonly id: string;
  /** Código de personal. Identifica a la persona; nunca es una contraseña. */
  readonly codigo: string;
  readonly nombre: string;
  readonly cargo: string;
  readonly rol: string;
  /** Institución, convenio u origen externo al que pertenece la persona. */
  readonly entidad: string;
  readonly vinculacion: HospitalPersonalVinculacionId;
  /** Zona o alcance territorial demostrativo del prototipo. */
  readonly zona: string;
  readonly estadoAcceso: HospitalEstadoAcceso;
  readonly tono: HospitalTonoId;
  /**
   * Documento ficticio. Solo alimenta la búsqueda local: nunca se muestra
   * completo, para no exponer un identificador personal sin necesidad.
   */
  readonly documento: string;
  /** Forma enmascarada que sí se muestra en el detalle. */
  readonly documentoEnmascarado: string;
  readonly acceso: HospitalAccesoPersona;
}

/** Indicador compacto de la cabecera. El valor se cuenta sobre el fixture. */
export interface HospitalPersonalIndicador {
  readonly id: string;
  readonly etiqueta: string;
  readonly valor: number;
}

/** Consulta local del listado. `''` significa «sin recorte». */
export interface HospitalPersonalConsulta {
  readonly texto: string;
  readonly vinculacion: string;
  readonly rol: string;
  readonly entidad: string;
  readonly estadoAcceso: string;
}

/**
 * Rol descriptivo (prototipo, líneas 815–821 y 1270–1278, reescrito por la
 * corrección aprobada, apartado E).
 *
 * La Product Owner retira la estructura técnica `rol / módulo / acción /
 * alcance / descripción` como experiencia principal y pide en su lugar una
 * lectura comprensible: qué puede y qué no puede hacer cada rol. Ambas listas
 * son demostrativas y no implementan ni garantizan autorización real.
 */
export interface HospitalRolDescriptivo {
  readonly id: string;
  readonly titulo: string;
  readonly puede: readonly string[];
  readonly noPuede: readonly string[];
}

/** Operación que exigirá confirmación reforzada y auditoría (apartado F). */
export interface HospitalAccionSensible {
  readonly id: string;
  readonly etiqueta: string;
  readonly detalle: string;
}

/** Paso de un flujo de alta futuro (apartado D). */
export interface HospitalFlujoAlta {
  readonly id: string;
  readonly titulo: string;
  readonly pasos: readonly string[];
}

export interface HospitalPersonalConfig {
  readonly personal: {
    readonly titulo: string;
    readonly accion: HospitalAdminAccion;
    readonly columnas: readonly HospitalAdminColumna[];
    readonly items: readonly HospitalPersonaAdministrativa[];
    readonly nota: string;
    readonly avisoAdministrativo: string;
    readonly accionVer: string;
    readonly vacio: string;
    readonly resumen: string;
  };
  /** Cabecera de indicadores compactos demostrativos (apartado A). */
  readonly indicadores: {
    readonly titulo: string;
    readonly nota: string;
    readonly etiquetas: {
      readonly registrado: string;
      readonly activos: string;
      readonly pendientes: string;
      readonly suspendidos: string;
    };
  };
  /** Buscador y filtros locales (apartado A). */
  readonly busqueda: {
    readonly etiqueta: string;
    readonly ayuda: string;
    readonly limpiar: string;
    readonly opcionTodas: string;
    readonly filtros: {
      readonly vinculacion: string;
      readonly rol: string;
      readonly entidad: string;
      readonly estadoAcceso: string;
    };
  };
  /** Explicación del código de personal automático (apartado B). */
  readonly codigo: {
    readonly titulo: string;
    readonly descripcion: string;
    readonly ejemplos: readonly string[];
    readonly reglas: readonly string[];
  };
  /** Detalle de acceso y credenciales de una persona (apartado C). */
  readonly credenciales: {
    readonly titulo: string;
    readonly aviso: string;
    readonly etiquetas: {
      readonly estadoAcceso: string;
      readonly ultimoAcceso: string;
      readonly ultimoCambio: string;
      readonly intentos: string;
      readonly segundoFactor: string;
    };
    readonly acciones: readonly HospitalAdminAccion[];
    readonly nota: string;
    readonly cerrar: string;
  };
  /** Identidad de la persona dentro del panel de detalle. */
  readonly detalle: {
    readonly etiquetas: {
      readonly codigo: string;
      readonly documento: string;
      readonly vinculacion: string;
      readonly rol: string;
      readonly entidad: string;
      readonly zona: string;
    };
  };
  /** Flujos de alta previstos (apartado D). */
  readonly alta: {
    readonly titulo: string;
    readonly descripcion: string;
    readonly flujos: readonly HospitalFlujoAlta[];
    readonly nota: string;
  };
  /** Vinculaciones y tipos de personal contemplados. */
  readonly vinculaciones: {
    readonly titulo: string;
    readonly descripcion: string;
    readonly items: readonly HospitalPersonalVinculacion[];
    readonly tiposTitulo: string;
    readonly tipos: readonly HospitalTipoPersonal[];
    readonly tiposEstado: HospitalDatoSinFuente;
  };
}

/** Bloque «Roles y permisos», ahora una pestaña propia (apartado E). */
export interface HospitalRolesConfig {
  readonly titulo: string;
  readonly descripcion: string;
  readonly aviso: string;
  readonly etiquetaPuede: string;
  readonly etiquetaNoPuede: string;
  readonly items: readonly HospitalRolDescriptivo[];
  readonly nota: string;
  readonly sensibles: {
    readonly titulo: string;
    readonly descripcion: string;
    readonly items: readonly HospitalAccionSensible[];
    readonly nota: string;
  };
}

/* ========================================================================== */
/* FR-07 — Configuración institucional                                        */
/* ========================================================================== */

export interface HospitalAgendaParametrosConfig {
  readonly titulo: string;
  readonly descripcion: string;
  readonly campos: readonly HospitalAdminCampo[];
  readonly nota: string;
}

export interface HospitalInstitucionDatosConfig {
  readonly titulo: string;
  readonly descripcion: string;
  readonly campos: readonly HospitalAdminCampo[];
  readonly logo: {
    readonly etiqueta: string;
    readonly accion: HospitalAdminAccion;
  };
  readonly nota: string;
}

/* ========================================================================== */
/* FR-08 — Integraciones                                                      */
/* ========================================================================== */

/**
 * Únicos estados autorizados (FR-08.4). Ninguno afirma conexión, convenio,
 * credencial, sincronización, disponibilidad ni actividad.
 */
export const HOSPITAL_ESTADOS_INTEGRACION = [
  'No configurada',
  'Pendiente',
  'Preparada para integración',
] as const;

export type HospitalEstadoIntegracion = (typeof HOSPITAL_ESTADOS_INTEGRACION)[number];

/**
 * Ranura visual de una integración futura. No hay endpoint, credencial, token,
 * SDK, iframe, script, OAuth, enlace de conexión ni llamada de red.
 */
export interface HospitalIntegracion {
  readonly id: string;
  readonly nombre: string;
  readonly detalle: string;
  readonly estado: HospitalEstadoIntegracion;
  readonly tono: HospitalTonoId;
}

export interface HospitalIntegracionesConfig {
  readonly titulo: string;
  readonly descripcion: string;
  readonly aviso: string;
  readonly items: readonly HospitalIntegracion[];
  readonly nota: string;
}

/* ========================================================================== */
/* FR-09 — Auditoría                                                          */
/* ========================================================================== */

/** Evento demostrativo (prototipo, líneas 941–953 y 1318–1323). */
export interface HospitalEventoAuditoria {
  readonly id: string;
  readonly usuario: string;
  readonly accion: string;
  readonly cuando: string;
  readonly antes: string;
  readonly despues: string;
}

export interface HospitalAuditoriaConfig {
  readonly titulo: string;
  readonly descripcion: string;
  readonly aviso: string;
  readonly etiquetaAntes: string;
  readonly etiquetaDespues: string;
  readonly items: readonly HospitalEventoAuditoria[];
  readonly estructuraFutura: HospitalAdminBloqueFuturo;
  readonly nota: string;
}

/* ========================================================================== */
/* Configuración completa del contenedor                                      */
/* ========================================================================== */

export interface HospitalAdministrationConfig {
  readonly encabezado: HospitalVistaEncabezado;
  readonly etiquetaPestanas: string;
  readonly pestanas: readonly HospitalAdminPestanaId[];
  readonly membresias: HospitalMembresiasConfig;
  readonly clinica: HospitalClinicaConfig;
  readonly personal: HospitalPersonalConfig;
  readonly roles: HospitalRolesConfig;
  readonly agenda: HospitalAgendaParametrosConfig;
  readonly institucion: HospitalInstitucionDatosConfig;
  readonly integraciones: HospitalIntegracionesConfig;
  readonly auditoria: HospitalAuditoriaConfig;
}

/* ========================================================================== */
/* Fixtures demostrativos                                                     */
/* ========================================================================== */

/** Acción deshabilitada. `disponible: false` es parte del contrato. */
function accion(
  id: string,
  etiqueta: string,
  variante: 'primaria' | 'neutra',
  estado: HospitalAdminEstadoAccion = 'Próximamente',
): HospitalAdminAccion {
  return { id, etiqueta, variante, estado, disponible: false };
}

/** Campo estructural sin valor. El estado neutro es siempre explícito. */
function futuro(
  id: string,
  etiqueta: string,
  estado: HospitalDatoSinFuente = HOSPITAL_SIN_FUENTE.porConfirmar,
): HospitalAdminCampoFuturo {
  return { id, etiqueta, estado };
}

/** Campo editable en estado local efímero, con su valor demostrativo. */
function campo(id: string, etiqueta: string, valor: string): HospitalAdminCampo {
  return { id, etiqueta, valor };
}

const membresias: HospitalMembresiasConfig = {
  titulo: 'Planes de membresía',
  nota: 'Precios y beneficios viven aquí, no en el código',
  planes: [
    {
      id: 'plan-basico',
      nombre: 'Plan Básico',
      descripcion: 'Seguimiento domiciliario con bitácora y semáforo',
      visitas: '1 visita domiciliaria',
      virtuales: '2 consultas virtuales',
      beneficios: ['Seguimiento domiciliario con bitácora y semáforo'],
      descuento: null,
      precio: '$48.000',
      periodicidad: 'Mensual',
      renovacion: 'Renovación automática',
      estado: 'Activo',
      tono: 'verde',
      version: { etiqueta: 'Versión 3 · vigente desde 1 ago 2026', desde: '1 ago 2026' },
      accion: accion('editar-plan-basico', 'Editar plan', 'neutra', 'Demostración'),
    },
    {
      id: 'plan-bienestar',
      nombre: 'Plan Bienestar',
      descripcion: 'Incluye fisioterapia y acompañamiento al cuidador',
      visitas: '2 visitas domiciliarias',
      virtuales: '4 consultas virtuales',
      beneficios: ['Fisioterapia incluida', 'Acompañamiento al cuidador'],
      descuento: '15 % en servicios adicionales',
      precio: '$68.000',
      periodicidad: 'Mensual',
      renovacion: 'Renovación automática',
      estado: 'Activo',
      tono: 'verde',
      version: { etiqueta: 'Versión 2 · vigente desde 1 jul 2026', desde: '1 jul 2026' },
      accion: accion('editar-plan-bienestar', 'Editar plan', 'neutra', 'Demostración'),
    },
    {
      id: 'plan-integral',
      nombre: 'Plan Integral',
      descripcion: 'Cobertura ampliada para cuidados permanentes',
      visitas: '4 visitas domiciliarias',
      virtuales: 'Consultas virtuales ilimitadas',
      beneficios: ['Cobertura ampliada para cuidados permanentes'],
      descuento: null,
      precio: '$132.000',
      periodicidad: 'Trimestral',
      renovacion: null,
      estado: 'Inactivo',
      tono: 'amarillo',
      version: {
        etiqueta: 'Versión 1 · cerrado a nuevas ventas',
        desde: HOSPITAL_SIN_FUENTE.noDisponible,
      },
      accion: accion('editar-plan-integral', 'Editar plan', 'neutra', 'Demostración'),
    },
  ],
  etiquetasPlan: {
    visitas: 'VISITAS INCLUIDAS',
    virtuales: 'CONSULTAS VIRTUALES INCLUIDAS',
    beneficios: 'BENEFICIOS',
    descuento: 'DESCUENTO',
    vigencia: 'VIGENCIA',
  },
  notaVersiones:
    'Modificar un plan no cambiará lo ya pagado: la versión anterior seguirá vigente hasta terminar el periodo. Así está previsto el comportamiento futuro; esta demostración no versiona, no cobra y no guarda nada.',
  avisoAcciones:
    'Precios, beneficios, vigencias y estados son datos ficticios de demostración. Ninguna acción de esta pestaña guarda, cobra, compra, afilia, renueva ni factura, y ninguna simula un resultado. Qué ofrece el hospital y qué podrá adquirir un paciente es una decisión pendiente de aprobación.',
  formulario: {
    titulo: 'Crear membresía',
    campos: [
      { id: 'nombre-plan', etiqueta: 'NOMBRE DEL PLAN', tipo: 'texto', ejemplo: 'Plan Bienestar' },
      { id: 'precio', etiqueta: 'PRECIO', tipo: 'texto', ejemplo: '$68.000' },
      {
        id: 'periodo',
        etiqueta: 'PERIODO',
        tipo: 'lista',
        opciones: ['Mensual', 'Trimestral', 'Anual', 'Otro'],
      },
      {
        id: 'visitas-incluidas',
        etiqueta: 'VISITAS DOMICILIARIAS INCLUIDAS',
        tipo: 'texto',
        ejemplo: '2',
      },
      {
        id: 'virtuales-incluidas',
        etiqueta: 'CONSULTAS VIRTUALES INCLUIDAS',
        tipo: 'texto',
        ejemplo: '4',
      },
      {
        id: 'tarifa-preferencial',
        etiqueta: 'TARIFA PREFERENCIAL ADICIONAL',
        tipo: 'texto',
        ejemplo: '15 % de descuento',
      },
      { id: 'inicio-vigencia', etiqueta: 'INICIO DE VIGENCIA', tipo: 'fecha' },
      { id: 'fin-vigencia', etiqueta: 'FIN DE VIGENCIA', tipo: 'fecha' },
      { id: 'renovacion', etiqueta: 'RENOVACIÓN', tipo: 'lista', opciones: ['Automática', 'Manual'] },
      {
        id: 'condiciones',
        etiqueta: 'CONDICIONES',
        tipo: 'parrafo',
        ejemplo: 'Condiciones del plan',
      },
    ],
    accion: accion('guardar-plan', 'Guardar plan', 'primaria'),
  },
  edicion: {
    titulo: 'Editar plan',
    campos: [
      { id: 'nombre', etiqueta: 'NOMBRE', tipo: 'texto' },
      { id: 'descripcion', etiqueta: 'DESCRIPCIÓN', tipo: 'parrafo' },
      { id: 'precio', etiqueta: 'PRECIO', tipo: 'texto' },
      {
        id: 'periodicidad',
        etiqueta: 'PERIODICIDAD',
        tipo: 'lista',
        opciones: ['Mensual', 'Trimestral', 'Anual'],
      },
      { id: 'visitas', etiqueta: 'VISITAS DOMICILIARIAS', tipo: 'texto' },
      { id: 'virtuales', etiqueta: 'CONSULTAS VIRTUALES', tipo: 'texto' },
      { id: 'beneficios', etiqueta: 'BENEFICIOS', tipo: 'parrafo' },
      { id: 'descuento', etiqueta: 'DESCUENTO', tipo: 'texto' },
      { id: 'estado', etiqueta: 'ESTADO', tipo: 'lista', opciones: ['Activo', 'Inactivo'] },
      { id: 'vigencia', etiqueta: 'FECHA DE VIGENCIA', tipo: 'texto' },
    ],
    guardar: accion('guardar-cambios-plan', 'Guardar cambios', 'primaria', 'Demostración'),
    cancelar: 'Cancelar',
    nota: 'Formulario visual. Nada se guarda y no hay cobro.',
  },
  servicios: {
    titulo: 'Servicios configurables',
    columnas: [
      { id: 'servicio', etiqueta: 'SERVICIO' },
      { id: 'precio', etiqueta: 'PRECIO' },
      { id: 'duracion', etiqueta: 'DURACIÓN' },
      { id: 'profesional', etiqueta: 'PROFESIONAL' },
      { id: 'cobertura', etiqueta: 'EN MEMBRESÍA' },
    ],
    items: [
      {
        id: 'cita-prioritaria',
        nombre: 'Cita prioritaria en el hospital',
        precio: 'Sin cobro',
        duracion: '30 min',
        profesional: 'Medicina',
        cobertura: 'Incluida',
        tono: 'verde',
      },
      {
        id: 'visita-domiciliaria',
        nombre: 'Visita domiciliaria',
        precio: '$68.000',
        duracion: '45 min',
        profesional: 'Medicina o enfermería',
        cobertura: 'Según plan',
        tono: 'petroleo',
      },
      {
        id: 'consulta-virtual',
        nombre: 'Consulta virtual',
        precio: '$32.000',
        duracion: '20 min',
        profesional: 'Medicina',
        cobertura: 'Según plan',
        tono: 'petroleo',
      },
      {
        id: 'enfermeria-domiciliaria',
        nombre: 'Enfermería domiciliaria',
        precio: '$54.000',
        duracion: '40 min',
        profesional: 'Enfermería',
        cobertura: 'No incluida',
        tono: 'amarillo',
      },
      {
        id: 'fisioterapia',
        nombre: 'Fisioterapia',
        precio: '$60.000',
        duracion: '45 min',
        profesional: 'Fisioterapia',
        cobertura: 'Plan Bienestar',
        tono: 'petroleo',
      },
      {
        id: 'trabajo-social',
        nombre: 'Trabajo social',
        precio: '$45.000',
        duracion: '60 min',
        profesional: 'Trabajo social',
        cobertura: 'No incluida',
        tono: 'amarillo',
      },
    ],
    nota: 'La cobertura describe el ejemplo del prototipo. No hay disponibilidad para pacientes, carrito, checkout, pasarela ni estado de pago detrás de ninguna fila.',
  },
};

const clinica: HospitalClinicaConfig = {
  titulo: 'Información clínica institucional',
  descripcion:
    `Demostración visual de cómo llegará a ${PLATAFORMA} la información clínica que una institución ya tiene en otro sistema y está autorizada a aportar. Los datos estructurados y los documentos históricos se tratan por separado.`,
  aviso:
    `${PLATAFORMA} no es una historia clínica electrónica ni sustituye la HCE de la institución: muestra información clínica institucional autorizada o importada. Esta pestaña es una demostración: no hay interoperabilidad, importación, lectura de archivos, conciliación ni escritura sobre ningún expediente.`,
  bloques: [
    {
      id: 'estructurados',
      titulo: 'Datos estructurados',
      descripcion:
        'Pacientes, diagnósticos, medicamentos, alergias, atenciones, profesionales y fechas.',
      formatos: 'CSV · Excel · JSON · API',
    },
    {
      id: 'documentos',
      titulo: 'Documentos históricos',
      descripcion: 'Epicrisis, resultados, soportes e imágenes que se conservan como archivo.',
      formatos: 'PDF · JPG · PNG',
    },
  ],
  archivo: {
    etiquetaEjemplo: 'Ejemplo del prototipo',
    nombre: 'pacientes_hsr_2019_2026.csv',
    detalle: 'Nombre y tamaño de ejemplo · 2,4 MB · ningún archivo fue seleccionado ni leído',
    accion: accion('cambiar-archivo', 'Cambiar archivo', 'neutra', 'Demostración'),
  },
  resumen: {
    titulo: 'Resultado de ejemplo',
    items: [
      { id: 'pacientes', etiqueta: 'Pacientes encontrados', valor: '150', tono: 'azul' },
      { id: 'registros', etiqueta: 'Registros clínicos', valor: '1.284', tono: 'azul' },
      { id: 'reconocidos', etiqueta: 'Campos reconocidos', valor: '22', tono: 'verde' },
      { id: 'sin-coincidencia', etiqueta: 'Campos sin coincidencia', valor: '3', tono: 'amarillo' },
      { id: 'errores', etiqueta: 'Errores de formato', valor: '7', tono: 'rojo' },
      { id: 'duplicados', etiqueta: 'Duplicados potenciales', valor: '4', tono: 'amarillo' },
    ],
    nota: 'Conteos ficticios del prototipo. No proceden de ninguna importación: nada se analizó, contó ni validó.',
  },
  coincidencia: {
    titulo: 'Paciente posiblemente existente (ejemplo)',
    descripcion:
      'CC 24.556.812 · María Gómez Osorio · 1950-03-14 coincide con un paciente ya registrado. Es un caso de ejemplo del prototipo, no un resultado de deduplicación.',
    acciones: [
      accion('relacionar-existente', 'Relacionar con el existente', 'neutra'),
      accion('crear-nuevo', 'Crear nuevo', 'neutra'),
      accion('omitir', 'Omitir', 'neutra'),
      accion('solicitar-revision', 'Solicitar revisión', 'neutra'),
    ],
  },
  acciones: [
    accion('revisar-importacion', 'Revisar importación', 'neutra'),
    accion('confirmar-importacion', 'Confirmar importación', 'primaria'),
  ],
  procedencia: {
    titulo: 'Procedencia y trazabilidad previstas',
    descripcion:
      `Cada registro de información clínica institucional deberá conservar su procedencia para distinguir lo aportado por otra institución de lo generado en ${PLATAFORMA}. La demostración no tiene ninguno de estos valores y no los inventa.`,
    campos: [
      futuro('origen', 'Origen de la información'),
      futuro('institucion', 'Institución que la aporta'),
      futuro('sistema', 'Archivo o sistema fuente', HOSPITAL_SIN_FUENTE.noDisponible),
      futuro('fecha-importacion', 'Fecha de incorporación'),
      futuro('fecha-original', 'Fecha original del registro'),
      futuro('profesional', 'Profesional responsable'),
      futuro('autorizacion', 'Autorización o consentimiento aplicable'),
      futuro('version', 'Versión del registro', HOSPITAL_SIN_FUENTE.noDisponible),
      futuro('usuario', 'Usuario que la incorpora'),
    ],
  },
  nota: 'La procedencia, la autorización, la deduplicación, la conciliación, la retención y el acceso a información clínica requieren decisiones aprobadas y controles en servidor. Esta pestaña no los implementa ni los anticipa.',
};

/**
 * Vinculaciones contempladas (corrección aprobada, apartado A).
 *
 * `interno`, `independiente` y `convenio` conservan la semántica de las
 * modalidades ya aprobadas en TASK-003H-04. `externo` no es una modalidad de
 * prestación de servicios: es la persona autorizada que no pertenece a la
 * institución.
 */
const vinculaciones: readonly HospitalPersonalVinculacion[] = [
  {
    id: 'interno',
    etiqueta: 'Interno / empleado',
    corta: 'Interno',
    plural: 'Internos',
    descripcion: 'Persona vinculada directamente por la institución.',
    modalidad: 'empleado',
  },
  {
    id: 'independiente',
    etiqueta: 'Prestación de servicios / independiente',
    corta: 'Prestación de servicios',
    plural: 'Prestadores independientes',
    descripcion: 'Persona que presta servicios sin vínculo laboral con la institución.',
    modalidad: 'independiente',
  },
  {
    id: 'convenio',
    etiqueta: 'Tercero / convenio',
    corta: 'Tercero / convenio',
    plural: 'Terceros / convenios',
    descripcion: 'Persona vinculada a través de otra entidad o de un convenio.',
    modalidad: 'convenio',
  },
  {
    id: 'externo',
    etiqueta: 'Externo autorizado',
    corta: 'Externo autorizado',
    plural: 'Externos autorizados',
    descripcion:
      'Persona ajena a la institución a la que se autorizaría un acceso acotado y temporal.',
    modalidad: null,
  },
];

/**
 * Personas demostrativas del listado.
 *
 * Las seis primeras son las del prototipo (líneas 1262–1268). Las seis
 * restantes las añade la corrección aprobada por la Product Owner, que exige
 * indicadores por vinculación y por estado de acceso: sin ellas, cuatro de los
 * ocho indicadores y tres de los cuatro filtros quedarían vacíos y la pantalla
 * no podría comprobarse. Todas son ficticias, ninguna corresponde a una persona
 * real y ninguna acredita relación, cuenta ni acceso.
 *
 * El estado `Inactivo` del prototipo pasa a `Suspendido` porque esta columna ya
 * no describe la relación con la institución sino el acceso a la plataforma.
 *
 * Los documentos son ficticios, solo alimentan la búsqueda local y nunca se
 * muestran completos.
 */
const personas: readonly HospitalPersonaAdministrativa[] = [
  {
    id: 'hsr-pro-0184',
    codigo: 'HSR-PRO-0184',
    nombre: 'Dra. Laura Gómez',
    cargo: 'Medicina general',
    rol: 'Profesional en salud',
    entidad: 'Hospital San Rafael',
    vinculacion: 'interno',
    zona: 'Comunas 3 y 4',
    estadoAcceso: 'Activo',
    tono: 'verde',
    documento: '1024567801',
    documentoEnmascarado: 'C.C. ······801',
    acceso: {
      ultimoAcceso: 'Hoy, 8:42 a. m.',
      ultimoCambioCredenciales: '2 ago 2026',
      intentosFallidos: '0',
      segundoFactor: 'Pendiente',
    },
  },
  {
    id: 'hsr-pro-0131',
    codigo: 'HSR-PRO-0131',
    nombre: 'Enf. Carlos Ruiz',
    cargo: 'Enfermería',
    rol: 'Profesional en salud',
    entidad: 'Hospital San Rafael',
    vinculacion: 'interno',
    zona: 'Comuna 1',
    estadoAcceso: 'Activo',
    tono: 'verde',
    documento: '1019874302',
    documentoEnmascarado: 'C.C. ······302',
    acceso: {
      ultimoAcceso: 'Hoy, 7:55 a. m.',
      ultimoCambioCredenciales: '18 jul 2026',
      intentosFallidos: '0',
      segundoFactor: 'Pendiente',
    },
  },
  {
    id: 'hsr-coo-0018',
    codigo: 'HSR-COO-0018',
    nombre: 'Claudia Vargas',
    cargo: 'Coordinación domiciliaria',
    rol: 'Coordinador clínico',
    entidad: 'Hospital San Rafael',
    vinculacion: 'interno',
    zona: 'Todas',
    estadoAcceso: 'Activo',
    tono: 'verde',
    documento: '52987110',
    documentoEnmascarado: 'C.C. ·····110',
    acceso: {
      ultimoAcceso: 'Hoy, 9:05 a. m.',
      ultimoCambioCredenciales: '5 ago 2026',
      intentosFallidos: '0',
      segundoFactor: 'Activo',
    },
  },
  {
    id: 'hsr-adm-0314',
    codigo: 'HSR-ADM-0314',
    nombre: 'Yohana Arenas',
    cargo: 'Administración',
    rol: 'Administrador hospital',
    entidad: 'Hospital San Rafael',
    vinculacion: 'interno',
    zona: 'Todas',
    estadoAcceso: 'Activo',
    tono: 'verde',
    documento: '39554218',
    documentoEnmascarado: 'C.C. ·····218',
    acceso: {
      ultimoAcceso: 'Hoy, 8:10 a. m.',
      ultimoCambioCredenciales: '1 ago 2026',
      intentosFallidos: '0',
      segundoFactor: 'Activo',
    },
  },
  {
    id: 'hsr-fin-0042',
    codigo: 'HSR-FIN-0042',
    nombre: 'Pedro Ramírez',
    cargo: 'Finanzas',
    rol: 'Finanzas',
    entidad: 'Hospital San Rafael',
    vinculacion: 'interno',
    zona: 'Todas',
    estadoAcceso: 'Activo',
    tono: 'verde',
    documento: '80123945',
    documentoEnmascarado: 'C.C. ·····945',
    acceso: {
      ultimoAcceso: 'Ayer, 5:20 p. m.',
      ultimoCambioCredenciales: '12 jul 2026',
      intentosFallidos: '1',
      segundoFactor: 'Activo',
    },
  },
  {
    id: 'hsr-pro-0098',
    codigo: 'HSR-PRO-0098',
    nombre: 'Dr. Andrés Peña',
    cargo: 'Medicina general',
    rol: 'Profesional en salud',
    entidad: 'Hospital San Rafael',
    vinculacion: 'interno',
    zona: 'Comuna 2',
    estadoAcceso: 'Suspendido',
    tono: 'amarillo',
    documento: '79445612',
    documentoEnmascarado: 'C.C. ·····612',
    acceso: {
      ultimoAcceso: '14 jul 2026, 11:32 a. m.',
      ultimoCambioCredenciales: '3 mar 2026',
      intentosFallidos: '0',
      segundoFactor: 'Pendiente',
    },
  },
  {
    id: 'hsr-ind-0057',
    codigo: 'HSR-IND-0057',
    nombre: 'Ft. Marcela Salazar',
    cargo: 'Fisioterapia',
    rol: 'Profesional en salud',
    entidad: 'Prestación de servicios',
    vinculacion: 'independiente',
    zona: 'Comunas 1 y 2',
    estadoAcceso: 'Activo',
    tono: 'verde',
    documento: '1015663470',
    documentoEnmascarado: 'C.C. ······470',
    acceso: {
      ultimoAcceso: 'Hoy, 7:40 a. m.',
      ultimoCambioCredenciales: '28 jul 2026',
      intentosFallidos: '0',
      segundoFactor: 'Pendiente',
    },
  },
  {
    id: 'hsr-ind-0063',
    codigo: 'HSR-IND-0063',
    nombre: 'Ps. Julián Mora',
    cargo: 'Psicología',
    rol: 'Profesional en salud',
    entidad: 'Prestación de servicios',
    vinculacion: 'independiente',
    zona: 'Comuna 4',
    estadoAcceso: 'Pendiente',
    tono: 'azul',
    documento: '1032889054',
    documentoEnmascarado: 'C.C. ······054',
    acceso: {
      ultimoAcceso: HOSPITAL_SIN_FUENTE.noAplica,
      ultimoCambioCredenciales: HOSPITAL_SIN_FUENTE.noAplica,
      intentosFallidos: '0',
      segundoFactor: 'Pendiente',
    },
  },
  {
    id: 'hsr-con-0012',
    codigo: 'HSR-CON-0012',
    nombre: 'Enf. Diana Castro',
    cargo: 'Enfermería domiciliaria',
    rol: 'Profesional en salud',
    entidad: 'Fundación Cuidar en Casa',
    vinculacion: 'convenio',
    zona: 'Comuna 3',
    estadoAcceso: 'Activo',
    tono: 'verde',
    documento: '1077452189',
    documentoEnmascarado: 'C.C. ······189',
    acceso: {
      ultimoAcceso: 'Hoy, 6:58 a. m.',
      ultimoCambioCredenciales: '20 jun 2026',
      intentosFallidos: '0',
      segundoFactor: 'Pendiente',
    },
  },
  {
    id: 'hsr-con-0021',
    codigo: 'HSR-CON-0021',
    nombre: 'Tomás Beltrán',
    cargo: 'Transporte asistencial',
    rol: 'Operador',
    entidad: 'Cooperativa Salud Móvil',
    vinculacion: 'convenio',
    zona: 'Todas',
    estadoAcceso: 'Pendiente',
    tono: 'azul',
    documento: '1006773421',
    documentoEnmascarado: 'C.C. ······421',
    acceso: {
      ultimoAcceso: HOSPITAL_SIN_FUENTE.noAplica,
      ultimoCambioCredenciales: HOSPITAL_SIN_FUENTE.noAplica,
      intentosFallidos: '0',
      segundoFactor: 'Pendiente',
    },
  },
  {
    id: 'hsr-ext-0037',
    codigo: 'HSR-EXT-0037',
    nombre: 'Lina Herrera',
    cargo: 'Enlace institucional',
    rol: 'Supervisor',
    entidad: 'Enlace institucional externo',
    vinculacion: 'externo',
    zona: 'Todas',
    estadoAcceso: 'Activo',
    tono: 'verde',
    documento: '52441097',
    documentoEnmascarado: 'C.C. ·····097',
    acceso: {
      ultimoAcceso: '18 ago 2026, 3:12 p. m.',
      ultimoCambioCredenciales: '10 ago 2026',
      intentosFallidos: '0',
      segundoFactor: 'Activo',
    },
  },
  {
    id: 'hsr-ext-0044',
    codigo: 'HSR-EXT-0044',
    nombre: 'Óscar Bermúdez',
    cargo: 'Auditoría externa',
    rol: 'Auditor',
    entidad: 'Auditoría externa contratada',
    vinculacion: 'externo',
    zona: 'Todas',
    estadoAcceso: 'Bloqueado',
    tono: 'rojo',
    documento: '19884503',
    documentoEnmascarado: 'C.C. ·····503',
    acceso: {
      ultimoAcceso: '2 ago 2026, 10:04 a. m.',
      ultimoCambioCredenciales: '2 ago 2026',
      intentosFallidos: '5',
      segundoFactor: 'Pendiente',
    },
  },
];

const personal: HospitalPersonalConfig = {
  personal: {
    titulo: 'Personal y accesos',
    accion: accion('registrar-persona', 'Registrar persona', 'primaria'),
    columnas: [
      { id: 'persona', etiqueta: 'PERSONA' },
      { id: 'codigo', etiqueta: 'CÓDIGO DE PERSONAL' },
      { id: 'vinculacion', etiqueta: 'VINCULACIÓN' },
      { id: 'rol', etiqueta: 'ROL' },
      { id: 'entidad', etiqueta: 'ENTIDAD' },
      { id: 'estado', etiqueta: 'ESTADO DE ACCESO' },
      { id: 'ultimo', etiqueta: 'ÚLTIMO ACCESO' },
      { id: 'accion', etiqueta: 'DETALLE' },
    ],
    items: personas,
    nota: 'Cada persona tendrá un código de personal individual que nunca se comparte: es lo que permitirá saber quién hizo cada cambio. Quien deja la institución pierde el acceso y su historial se conserva para auditoría. Así está previsto el comportamiento futuro; hoy no existen cuenta, alta, baja ni historial.',
    avisoAdministrativo:
      'Vista administrativa: identidad institucional, vinculación, rol, entidad y estado de acceso. La operación asistencial de cada profesional —agenda, atenciones, disponibilidad, calificaciones y «Vinculación y documentos»— sigue viviendo en «Profesionales» y no se duplica aquí. Ninguna acción crea usuarios, cuentas, accesos, altas ni bajas.',
    accionVer: 'Ver',
    vacio: 'Ninguna persona del ejemplo coincide con la búsqueda o los filtros aplicados.',
    resumen: 'personas visibles',
  },
  indicadores: {
    titulo: 'Resumen de personal y accesos',
    nota: 'Cifras demostrativas contadas sobre las personas ficticias de esta pantalla. No son datos reales de producción ni un indicador institucional.',
    etiquetas: {
      registrado: 'Personal registrado',
      activos: 'Accesos activos',
      pendientes: 'Pendientes',
      suspendidos: 'Suspendidos / bloqueados',
    },
  },
  busqueda: {
    etiqueta: 'Buscar por nombre, documento, código de personal, cargo o entidad',
    ayuda: 'La búsqueda recorre solo las personas ficticias ya cargadas en esta pantalla. No consulta ningún servicio y encontrar a alguien no acredita relación autorizada ni derecho de acceso a su información.',
    limpiar: 'Limpiar',
    opcionTodas: 'Todas',
    filtros: {
      vinculacion: 'TIPO DE VINCULACIÓN',
      rol: 'ROL',
      entidad: 'ENTIDAD',
      estadoAcceso: 'ESTADO DE ACCESO',
    },
  },
  codigo: {
    titulo: 'Código de personal',
    descripcion:
      'El sistema genera automáticamente un código único de personal. Se asigna al registrar o aprobar a una persona: el administrador no lo escribe ni lo elige.',
    ejemplos: ['HSR-PRO-0184', 'HSR-EXT-0037', 'HSR-CON-0012'],
    reglas: [
      'Identifica a la persona dentro de la institución.',
      'No es una contraseña ni sustituye a las credenciales.',
      'Puede consultarse administrativamente.',
      'Lo generará el backend en una tarea aprobada posterior; aquí los códigos son ejemplos.',
    ],
  },
  credenciales: {
    titulo: 'Acceso y credenciales',
    aviso:
      'Ningún administrador puede ver una contraseña, recuperarla en texto legible ni cambiar la de otra persona. Cada usuario crea y cambia las suyas. Aquí solo se muestran señales del estado del acceso.',
    etiquetas: {
      estadoAcceso: 'ESTADO DE ACCESO',
      ultimoAcceso: 'ÚLTIMO ACCESO',
      ultimoCambio: 'ÚLTIMO CAMBIO DE CREDENCIALES',
      intentos: 'INTENTOS FALLIDOS',
      segundoFactor: 'SEGUNDO FACTOR',
    },
    acciones: [
      accion('enviar-recuperacion', 'Enviar recuperación de acceso', 'neutra'),
      accion('forzar-cambio', 'Forzar cambio en próximo ingreso', 'neutra'),
      accion('suspender-acceso', 'Suspender acceso', 'neutra'),
      accion('reactivar-acceso', 'Reactivar acceso', 'neutra'),
    ],
    nota: 'Estas cuatro acciones son visuales y están deshabilitadas: no envían correo, no cambian credenciales, no suspenden ni reactivan nada. Cuando existan, quedarán registradas en Auditoría. No hay autenticación ni segundo factor implementados.',
    cerrar: 'Cerrar detalle',
  },
  detalle: {
    etiquetas: {
      codigo: 'CÓDIGO DE PERSONAL',
      documento: 'DOCUMENTO',
      vinculacion: 'VINCULACIÓN',
      rol: 'ROL',
      entidad: 'ENTIDAD',
      zona: 'ZONA O ALCANCE',
    },
  },
  alta: {
    titulo: 'Cómo se dará de alta a una persona',
    descripcion:
      'Recorrido previsto para una fase aprobada posterior. Ninguno de estos pasos está implementado y esta pantalla no ejecuta ninguno.',
    flujos: [
      {
        id: 'personal-institucional',
        titulo: 'Personal registrado por la administración',
        pasos: [
          'El administrador registra o aprueba a la persona.',
          'El sistema genera el código de personal.',
          'Se define el tipo de vinculación.',
          'Se asigna el rol.',
          'El sistema envía la invitación.',
          'La persona crea sus propias credenciales.',
          'El acceso queda activo.',
          'El evento queda registrado en Auditoría.',
        ],
      },
      {
        id: 'prestador-independiente',
        titulo: 'Prestador independiente que solicita vinculación',
        pasos: [
          'La solicitud llega desde la interfaz que corresponda.',
          'El hospital revisa los documentos.',
          'Aprueba, rechaza o solicita corrección.',
          'El sistema genera el código de personal.',
          'Se definen institución, rol y alcance.',
          'El acceso queda habilitado.',
        ],
      },
    ],
    nota: 'Las interfaces externas de solicitud no forman parte de esta tarea y no se modifican.',
  },
  vinculaciones: {
    titulo: 'Vinculaciones y tipos de personal contemplados',
    descripcion:
      `Interno, prestación de servicios, tercero o convenio y externo autorizado son relaciones distintas y se conservan separadas. ${PLATAFORMA} no clasifica el vínculo jurídico, no aplica legislación laboral y no calcula salario, honorarios, seguridad social ni retenciones.`,
    items: vinculaciones,
    tiposTitulo: 'Tipos de personal contemplados',
    tipos: HOSPITAL_TIPOS_PERSONAL,
    tiposEstado: HOSPITAL_SIN_FUENTE.porConfirmar,
  },
};

/**
 * Roles y permisos (corrección aprobada, apartado E).
 *
 * Cada rol se lee como qué puede y qué no puede hacer, no como una estructura
 * técnica de módulos y acciones. Las dos listas son descripciones
 * demostrativas: no protegen datos, no conceden ni revocan acceso y el modelo
 * definitivo sigue pendiente de aprobación.
 */
const roles: HospitalRolesConfig = {
  titulo: 'Roles y permisos',
  descripcion:
    'Qué puede y qué no puede hacer cada rol dentro del hospital. Sirve para decidir qué rol asignar a cada persona en «Personal y accesos».',
  aviso:
    'Estos ocho perfiles son descripciones demostrativas. No implementan ni garantizan autorización: hoy no protegen ningún dato, no conceden ni revocan acceso y asignar un rol no activa ni desactiva nada. El modelo definitivo de roles, permisos y mínimo privilegio sigue pendiente de aprobación y deberá aplicarse en servidor y en la capa de datos.',
  etiquetaPuede: 'Puede acceder a',
  etiquetaNoPuede: 'No puede acceder a',
  items: [
    {
      id: 'profesional-salud',
      titulo: 'Profesional en salud',
      puede: [
        'Sus pacientes asignados',
        'Registro de atenciones, órdenes y educación al cuidador',
        'Notas de continuidad del cuidado',
      ],
      noPuede: [
        'Pacientes que no le han sido asignados',
        'Membresías, servicios y parámetros de la institución',
        'Registro de personal y asignación de roles',
      ],
    },
    {
      id: 'coordinador-clinico',
      titulo: 'Coordinador clínico',
      puede: [
        'Asignación de profesionales',
        'Agenda y alertas de la institución',
        'Fichas de los pacientes de su institución',
      ],
      noPuede: [
        'Presupuesto, gastos y nómina',
        'Registro de personal y asignación de roles',
        'Información de otra institución',
      ],
    },
    {
      id: 'administrador-hospital',
      titulo: 'Administrador hospital',
      puede: [
        'Registro de personal y asignación de roles',
        'Membresías, servicios y parámetros de la institución',
        'Reglas del semáforo e integraciones',
      ],
      noPuede: [
        'Contraseñas de otras personas, que nunca son visibles ni recuperables',
        'Registro clínico detallado de un paciente sin relación autorizada',
        'Modificación de los eventos ya registrados en Auditoría',
      ],
    },
    {
      id: 'facturacion',
      titulo: 'Facturación',
      puede: [
        'Membresías y estados de cobro',
        'Registro de pagos',
        'Soportes de facturación',
      ],
      noPuede: [
        'Diagnósticos e información clínica',
        'Registro de personal y asignación de roles',
        'Parámetros clínicos del semáforo',
      ],
    },
    {
      id: 'finanzas',
      titulo: 'Finanzas',
      puede: [
        'Presupuesto, gastos y nómina',
        'Proveedores y soportes',
        'Reportes financieros',
      ],
      noPuede: [
        'Información clínica de los pacientes',
        'Registro de personal y asignación de roles',
        'Agenda y asignación de profesionales',
      ],
    },
    {
      id: 'auditor',
      titulo: 'Auditor',
      puede: [
        'Trazabilidad y registro de cambios',
        'Evidencias y soportes',
        'Consulta en modo solo lectura',
      ],
      noPuede: [
        'Modificación de cualquier registro',
        'Registro de personal y asignación de roles',
        'Cambios de configuración institucional',
      ],
    },
    {
      id: 'agenda',
      titulo: 'Agenda',
      puede: [
        'Programación, reprogramación y confirmación de citas',
        'Disponibilidad de los profesionales',
        'Datos de contacto necesarios para citar',
      ],
      noPuede: [
        'Registro clínico de los pacientes',
        'Presupuesto, gastos y nómina',
        'Registro de personal y asignación de roles',
      ],
    },
    {
      id: 'supervisor',
      titulo: 'Supervisor',
      puede: [
        'Indicadores agregados de la operación',
        'Calidad y desempeño del servicio',
        'Reportes ejecutivos',
      ],
      noPuede: [
        'Registro clínico individual de los pacientes',
        'Registro de personal y asignación de roles',
        'Cambios de configuración institucional',
      ],
    },
  ],
  nota: 'Conocer un código de personal no otorgará acceso: el rol definirá qué puede ver y modificar cada persona. Es el comportamiento previsto, no el actual.',
  sensibles: {
    titulo: 'Operaciones que exigirán confirmación reforzada',
    descripcion:
      'Antes de ejecutarse, estas operaciones pedirán una confirmación adicional y quedarán registradas en Auditoría. Todavía no están implementadas y aquí no se puede ejecutar ninguna.',
    items: [
      {
        id: 'otorgar-administrador',
        etiqueta: 'Otorgar el rol Administrador hospital',
        detalle: 'Da control sobre personal, roles y configuración de la institución.',
      },
      {
        id: 'otorgar-finanzas',
        etiqueta: 'Otorgar el rol Finanzas',
        detalle: 'Da acceso a presupuesto, gastos, nómina y soportes.',
      },
      {
        id: 'acceso-clinico',
        etiqueta: 'Conceder acceso clínico sensible',
        detalle: 'Amplía qué información de salud puede ver una persona.',
      },
      {
        id: 'exportacion-masiva',
        etiqueta: 'Exportar información de forma masiva',
        detalle: 'Extrae datos de muchas personas en una sola operación.',
      },
      {
        id: 'suspender-administrador',
        etiqueta: 'Suspender a otro administrador',
        detalle: 'Puede dejar a la institución sin quien administre la plataforma.',
      },
      {
        id: 'permisos-criticos',
        etiqueta: 'Modificar permisos críticos',
        detalle: 'Cambia qué puede hacer un rol completo.',
      },
    ],
    nota: 'La confirmación reforzada es una preparación visual. No hay segundo factor, no hay verificación de identidad y ninguna de estas operaciones existe todavía.',
  },
};

const agenda: HospitalAgendaParametrosConfig = {
  titulo: 'Agenda y servicios',
  descripcion:
    'Parámetros operativos de la institución: horarios, duraciones, capacidad, cobertura y modalidades. Son valores demostrativos del prototipo, no reglas universales.',
  campos: [
    campo('horario-operacion', 'HORARIO DE OPERACIÓN', '7:00 a. m. a 6:00 p. m.'),
    campo('dias-disponibles', 'DÍAS DISPONIBLES', 'Lunes a sábado'),
    campo('duracion-consulta', 'DURACIÓN ESTÁNDAR DE CONSULTA', '20 minutos'),
    campo('duracion-visita', 'DURACIÓN DE VISITA DOMICILIARIA', '45 minutos'),
    campo('tiempo-entre-citas', 'TIEMPO ENTRE CITAS', '15 minutos'),
    campo('desplazamiento-rural', 'TIEMPO DE DESPLAZAMIENTO EN ZONA RURAL', '40 minutos'),
    campo('capacidad-profesional', 'CAPACIDAD MÁXIMA POR PROFESIONAL', '6 atenciones al día'),
    campo('anticipacion-minima', 'ANTICIPACIÓN MÍNIMA PARA AGENDAR', '4 horas'),
    campo('regla-cancelacion', 'REGLA DE CANCELACIÓN', 'Hasta 12 horas antes sin costo'),
    campo('zonas-cobertura', 'ZONAS DE COBERTURA', 'Comunas 1 a 4 y zona rural'),
    campo('modalidades', 'MODALIDADES HABILITADAS', 'Presencial, domiciliaria y virtual'),
  ],
  nota: 'La intención del diseño es que estos parámetros se ajusten sin tocar el código. En esta demostración lo escrito solo vive en la pantalla montada: no se guarda, se pierde al recargar y no cambia la Agenda y citas ya aprobada.',
};

const institucion: HospitalInstitucionDatosConfig = {
  titulo: 'Datos de la institución',
  descripcion:
    'Identidad institucional demostrativa. Los datos operativos de agenda se configuran aparte, en «Agenda y servicios».',
  campos: [
    campo('nombre', 'NOMBRE', 'Hospital San Rafael'),
    campo('tipo', 'TIPO', 'ESE'),
    campo('nit', 'NIT', '890.123.456-7'),
    campo('municipio', 'MUNICIPIO', 'Soacha, Cundinamarca'),
    campo('direccion', 'DIRECCIÓN', 'Cra 7 # 12-40'),
    campo('telefono', 'TELÉFONO', '(601) 720 4400'),
    campo('correo', 'CORREO', 'domiciliaria@hsanrafael.gov.co'),
    campo('representante', 'REPRESENTANTE', 'Dr. Gustavo Herrera'),
    campo('zonas', 'ZONAS DE COBERTURA', 'Comunas 1 a 4 y zona rural'),
  ],
  logo: {
    etiqueta: 'Logo de la institución',
    accion: accion('cargar-logo', 'Cargar', 'neutra'),
  },
  nota: 'Institución ficticia del prototipo. Escribir en estos campos no guarda, no publica y no cambia la identidad que muestra el panel: al recargar vuelven los valores demostrativos.',
};

const integraciones: HospitalIntegracionesConfig = {
  titulo: 'Integraciones',
  descripcion:
    'Ranuras visuales de las integraciones previstas. Cada una reserva su lugar en la interfaz y nada más.',
  aviso:
    `Ninguna integración está conectada, configurada, sincronizada ni disponible. No hay credenciales, endpoints, SDK, OAuth, envíos ni llamadas de red, y ${PLATAFORMA} no afirma convenio, aval institucional ni cumplimiento con ninguna entidad o proveedor.`,
  items: [
    {
      id: 'google-calendar',
      nombre: 'Google Calendar',
      detalle: 'Ranura prevista para sincronizar agenda en una fase aprobada.',
      estado: 'No configurada',
      tono: 'amarillo',
    },
    {
      id: 'whatsapp',
      nombre: 'WhatsApp Business API',
      detalle: 'Ranura prevista para plantillas, destinatarios y estados de envío.',
      estado: 'No configurada',
      tono: 'amarillo',
    },
    {
      id: 'wompi',
      nombre: 'Wompi · pasarela de pagos',
      detalle: 'Ranura prevista para pagos. No hay cobro, checkout ni tokenización.',
      estado: 'No configurada',
      tono: 'amarillo',
    },
    {
      id: 'videollamada',
      nombre: 'Proveedor de videollamada',
      detalle: 'Punto de entrada previsto para las consultas virtuales.',
      estado: 'No configurada',
      tono: 'amarillo',
    },
    {
      id: 'hce',
      nombre: 'Historia clínica institucional',
      detalle:
        'Ranura prevista para recibir información clínica institucional autorizada. No hay interoperabilidad ni intercambio.',
      estado: 'Preparada para integración',
      tono: 'azul',
    },
    {
      id: 'funcion-publica',
      nombre: 'Función Pública · FURAG',
      detalle:
        `Espacio estructural. ${PLATAFORMA} no consulta, no reporta, no calcula puntajes y no acredita cumplimiento.`,
      estado: 'Pendiente',
      tono: 'amarillo',
    },
    {
      id: 'adres',
      nombre: 'ADRES',
      detalle:
        `Espacio estructural. ${PLATAFORMA} no consulta, no evalúa y no representa información oficial de la entidad.`,
      estado: 'Pendiente',
      tono: 'amarillo',
    },
    {
      id: 'sena',
      nombre: 'SENA',
      detalle:
        `Espacio estructural para formación y certificación de cuidadores. ${PLATAFORMA} no forma, no certifica y no verifica.`,
      estado: 'Pendiente',
      tono: 'amarillo',
    },
    {
      id: 'eli-openai',
      nombre: `${branding.aiDisplayName} · OpenAI`,
      detalle:
        'Espacio estructural. No hay IA conectada, no se envían datos y no se produce ninguna decisión clínica ni administrativa.',
      estado: 'Pendiente',
      tono: 'amarillo',
    },
  ],
  nota: 'Configurar una integración exigirá una tarea aprobada con credenciales, autorización, minimización de datos, manejo de fallos y auditoría propios. Nada de eso forma parte de esta demostración.',
};

const auditoria: HospitalAuditoriaConfig = {
  titulo: 'Auditoría del sistema',
  descripcion:
    'Así se verá el registro de una acción administrativa crítica: quién la hizo, cuándo, qué cambió y con qué valores.',
  aviso:
    'Los cinco registros son ejemplos ficticios del prototipo, no una bitácora real ni evidencia de cumplimiento. Esta pestaña no captura eventos, no persiste, no busca, no filtra, no exporta y no garantiza inmutabilidad ni retención.',
  etiquetaAntes: 'Antes',
  etiquetaDespues: 'Después',
  items: [
    {
      id: 'precio-bienestar',
      usuario: 'Yohana Arenas · administrador hospital',
      accion: 'Modificó el precio del Plan Bienestar',
      cuando: '16 ago 2026, 3:12 p. m.',
      antes: '$62.000',
      despues: '$68.000',
    },
    {
      id: 'importacion-csv',
      usuario: 'Yohana Arenas · administrador hospital',
      accion: 'Importó 150 historias clínicas desde archivo CSV',
      cuando: '14 ago 2026, 9:40 a. m.',
      antes: '0 registros importados',
      despues: '1.284 registros',
    },
    {
      id: 'asignacion-profesional',
      usuario: 'Claudia Vargas · coordinador clínico',
      accion: 'Asignó profesional a María Rodríguez',
      cuando: '17 ago 2026, 7:55 a. m.',
      antes: 'Sin asignar',
      despues: 'Dra. Laura Gómez',
    },
    {
      id: 'rango-amarillo',
      usuario: 'Claudia Vargas · coordinador clínico',
      accion: 'Cambió el rango amarillo de presión sistólica',
      cuando: '12 ago 2026, 11:20 a. m.',
      antes: '140 a 155',
      despues: '140 a 159',
    },
    {
      id: 'soporte-factura',
      usuario: 'Pedro Ramírez · finanzas',
      accion: 'Cargó soporte de la factura FAC-2026-125',
      cuando: '11 ago 2026, 4:05 p. m.',
      antes: 'Falta soporte',
      despues: 'Soporte cargado',
    },
  ],
  estructuraFutura: {
    titulo: 'Campos previstos de cada evento',
    descripcion:
      'Cuando exista registro real, cada evento deberá conservar estas dimensiones. Los ejemplos del prototipo no las traen y no se inventan aquí.',
    campos: [
      futuro('actor', 'Usuario o actor'),
      futuro('rol', 'Rol del actor'),
      futuro('momento', 'Fecha y hora'),
      futuro('accion', 'Acción'),
      futuro('modulo', 'Módulo'),
      futuro('objeto', 'Objeto afectado e identificador'),
      futuro('resultado', 'Resultado exitoso o fallido'),
      futuro('origen', 'Origen de la operación'),
      futuro('anterior', 'Valor anterior', HOSPITAL_SIN_FUENTE.demostrativo),
      futuro('nuevo', 'Valor nuevo', HOSPITAL_SIN_FUENTE.demostrativo),
      futuro('trazabilidad', 'Referencia de trazabilidad', HOSPITAL_SIN_FUENTE.noDisponible),
    ],
  },
  nota: 'Un registro real deberá minimizar datos: no expondrá información clínica, documentos, secretos ni valores sensibles completos, y su retención requerirá una política aprobada.',
};

/** Configuración demostrativa completa del contenedor administrativo. */
export const hospitalAdministracionDemo: HospitalAdministrationConfig = {
  encabezado: {
    titulo: 'Configuración',
    descripcion:
      `Aquí el hospital parametriza ${PLATAFORMA} sin tocar el código: planes y servicios, información clínica institucional, personal y accesos, roles, agenda, datos de la institución, integraciones y auditoría. Es una demostración visual: nada se guarda y no hay pagos, integraciones activas, permisos aplicados ni registro real de auditoría.`,
  },
  etiquetaPestanas: 'Secciones de administración institucional',
  pestanas: HOSPITAL_ADMIN_PESTANAS,
  membresias,
  clinica,
  personal,
  roles,
  agenda,
  institucion,
  integraciones,
  auditoria,
};
