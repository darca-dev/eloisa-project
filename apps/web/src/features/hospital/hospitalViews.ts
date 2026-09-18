/**
 * Estado de navegación local del Shell Hospital (TASK-003H-03, FR-01;
 * TASK-003H-04, FR-01; TASK-003H-05, FR-01; TASK-003H-07, §3).
 *
 * Reproduce el estado `view` y el handler `go(view)` del prototipo oficial
 * (`prototype-claude/Eligeme-Hospital.dc.html`, líneas 1189 y 1208–1219), pero
 * limitado a las vistas que estas tareas autorizan. TASK-003H-05 añade
 * `administracion`, el contenedor administrativo al que llega `Configuración`
 * —«Membresías y servicios» ya no es una opción del menú y vive dentro de él—,
 * y `financiera`, el destino provisional de `Gestión financiera`. TASK-003H-07
 * añade `reportes`, el dashboard ejecutivo con sus dos audiencias, y con ello
 * todas las opciones del menú tienen módulo.
 *
 * Alcance: presentación. No hay rutas nuevas, no cambia la URL, no persiste, no
 * consulta red ni almacenamiento y no concede permisos. Que una opción del menú
 * sea visible no significa que su módulo exista.
 */

/** Vistas implementadas, en el orden del menú aprobado. */
export const HOSPITAL_VISTAS_IMPLEMENTADAS = [
  'inicio',
  'agenda',
  'pacientes',
  'alarmas',
  'profesionales',
  'visitas',
  'virtuales',
  'calificaciones',
  'novedades',
  'financiera',
  'reportes',
  'administracion',
] as const;

export type HospitalVistaId = (typeof HOSPITAL_VISTAS_IMPLEMENTADAS)[number];

/** Vista inicial de `/hospital`: el Dashboard/KPIs aprobado en TASK-003H-02. */
export const HOSPITAL_VISTA_INICIAL: HospitalVistaId = 'inicio';

/** `true` solo para los identificadores de vista implementada. */
export function esVistaImplementada(id: string): id is HospitalVistaId {
  return (HOSPITAL_VISTAS_IMPLEMENTADAS as readonly string[]).includes(id);
}

/**
 * Transición de navegación. Un identificador sin vista implementada conserva la
 * vista actual: los demás elementos del menú no abren módulo nuevo ni dejan el
 * contenido principal vacío.
 */
export function siguienteVista(actual: HospitalVistaId, solicitada: string): HospitalVistaId {
  return esVistaImplementada(solicitada) ? solicitada : actual;
}

/* ---------------- Accesos del menú a la vista administrativa -------------- */

/**
 * Item del sidebar que se muestra activo para cada vista (TASK-003H-05, FR-01).
 *
 * Solo `administracion` difiere de su propio identificador: `Configuración` es
 * el item que queda activo cuando el contenedor administrativo está abierto
 * (prototipo, líneas 69–79 y 1220).
 */
export const HOSPITAL_ITEM_ACTIVO_POR_VISTA: Record<HospitalVistaId, string> = {
  inicio: 'inicio',
  agenda: 'agenda',
  pacientes: 'pacientes',
  alarmas: 'alarmas',
  profesionales: 'profesionales',
  visitas: 'visitas',
  virtuales: 'virtuales',
  calificaciones: 'calificaciones',
  novedades: 'novedades',
  financiera: 'financiera',
  reportes: 'reportes',
  administracion: 'configuracion',
};

/** Identificadores del menú que abren un módulo, en el orden del menú. */
export const HOSPITAL_ITEMS_NAVEGABLES: readonly string[] = [
  'inicio',
  'agenda',
  'pacientes',
  'alarmas',
  'profesionales',
  'visitas',
  'virtuales',
  'calificaciones',
  'novedades',
  'financiera',
  'reportes',
  'configuracion',
];

/* ------------------ Intención de navegación (TASK-003H-02B, FR-09) --------- */

/**
 * Intenciones contextuales que el centro de control de Inicio puede transportar
 * hacia una vista ya implementada.
 *
 * Una intención NO es un filtro: no consulta, no recorta, no reordena y no
 * modifica los fixtures de la vista destino. Es un contexto de lectura efímero
 * que vive en el estado local del shell, se pierde al recargar y nunca viaja
 * por URL, almacenamiento, red ni estado global.
 */
export const HOSPITAL_INTENCIONES = [
  'rojas',
  'amarillas',
  'pendientes-asignacion',
  'en-espera',
] as const;

export type HospitalIntencionId = (typeof HOSPITAL_INTENCIONES)[number];

/** Intenciones que cada vista puede recibir. El resto de vistas no acepta ninguna. */
const INTENCIONES_POR_VISTA: Partial<Record<HospitalVistaId, readonly HospitalIntencionId[]>> = {
  alarmas: ['rojas', 'amarillas'],
  agenda: ['pendientes-asignacion'],
  virtuales: ['en-espera'],
};

/**
 * Texto visible de cada intención. Se redacta como lo que realmente ocurre
 * («mostrando intención»), no como un filtro aplicado.
 */
export const HOSPITAL_ETIQUETA_INTENCION: Record<HospitalIntencionId, string> = {
  rojas: 'alarmas rojas',
  amarillas: 'alarmas amarillas',
  'pendientes-asignacion': 'citas pendientes de asignación',
  'en-espera': 'pacientes en espera de consulta virtual',
};

/**
 * Destino de un control del menú o de Inicio: vista y, opcionalmente, una
 * intención de lectura.
 */
export interface HospitalDestino {
  readonly vista: HospitalVistaId;
  readonly intencion?: HospitalIntencionId;
}

/**
 * Destino de un identificador del menú. `null` cuando esa opción todavía no
 * tiene módulo, de modo que sidebar y `Ir a` comparten una sola verdad
 * funcional.
 */
export function destinoDeItem(id: string): HospitalDestino | null {
  if (esVistaImplementada(id)) {
    return { vista: id };
  }

  if (id === 'configuracion') {
    return { vista: 'administracion' };
  }

  return null;
}

/** Estado de navegación local del shell. `intencion` es siempre efímera. */
export interface HospitalNavegacion {
  readonly vista: HospitalVistaId;
  readonly intencion: HospitalIntencionId | null;
}

/** Estado inicial de `/hospital`: Inicio y sin ninguna intención. */
export const HOSPITAL_NAVEGACION_INICIAL: HospitalNavegacion = {
  vista: HOSPITAL_VISTA_INICIAL,
  intencion: null,
};

/** `true` solo cuando esa vista declara esa intención. */
export function esIntencionSoportada(vista: HospitalVistaId, intencion: string): boolean {
  const soportadas: readonly string[] = INTENCIONES_POR_VISTA[vista] ?? [];

  return soportadas.includes(intencion);
}

/**
 * Transición de navegación con intención (FR-09).
 *
 * - Un identificador sin vista implementada no navega y conserva el estado tal
 *   cual: los accesos sin módulo no dejan Inicio ni vacían el contenido.
 * - Navegar sin intención —sidebar, `Ir a`, KPI o acción rápida simple— limpia
 *   siempre la intención anterior, de modo que no queda contexto obsoleto.
 * - Una intención que la vista destino no declara se descarta y la navegación
 *   ocurre igualmente sin contexto.
 */
export function siguienteNavegacion(
  actual: HospitalNavegacion,
  solicitado: string | HospitalDestino,
): HospitalNavegacion {
  const vista = typeof solicitado === 'string' ? solicitado : solicitado.vista;
  const intencion = typeof solicitado === 'string' ? undefined : solicitado.intencion;

  if (!esVistaImplementada(vista)) {
    return actual;
  }

  return {
    vista,
    intencion:
      intencion !== undefined && esIntencionSoportada(vista, intencion) ? intencion : null,
  };
}
