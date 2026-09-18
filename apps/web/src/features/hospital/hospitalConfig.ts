import { branding } from '@/config/branding';

import type { HospitalIconName } from './HospitalIcon';

/**
 * Configuración tipada del Shell Hospital (TASK-003H-01, FR-02).
 *
 * Fuente única de los datos demostrativos que muestran el sidebar y la topbar.
 * Ningún componente repite estos literales: todos los reciben por propiedades,
 * de modo que otra institución y otro usuario ficticios se representan sin
 * cambiar la estructura.
 *
 * Alcance: presentación. Esto NO es el modelo institucional definitivo, no crea
 * contexto global, tenant, persistencia, red ni permisos. La presencia visual de
 * una opción de menú no concede ninguna capacidad ni permiso.
 */

/** Ranura preparada para el logo institucional; el prototipo no define ninguno. */
export interface HospitalLogo {
  readonly src: string;
  readonly alt: string;
}

export interface HospitalInstitution {
  /** Nombre visible de la institución demostrativa. */
  readonly nombre: string;
  /** Tipo institucional (por ejemplo, `ESE`). */
  readonly tipo: string;
  /** Municipio de la institución. */
  readonly municipio: string;
  /** Logo institucional cuando exista; `null` reproduce el prototipo. */
  readonly logo: HospitalLogo | null;
}

export interface HospitalUser {
  readonly nombre: string;
  readonly rol: string;
  readonly iniciales: string;
}

export interface HospitalNavItemConfig {
  readonly id: string;
  readonly etiqueta: string;
  readonly icono: HospitalIconName;
  /** Conteo demostrativo; se omite cuando la opción no lleva badge. */
  readonly badge?: number;
  /** Separador visual que precede a las opciones institucionales/comerciales. */
  readonly separadorAntes?: boolean;
}

export interface HospitalShellConfig {
  readonly institucion: HospitalInstitution;
  readonly usuario: HospitalUser;
  readonly navegacion: readonly HospitalNavItemConfig[];
  /** Identificador de la opción que se muestra activa. */
  readonly itemActivoId: string;
  /** Conteo demostrativo compartido por el badge del menú y el de la campana. */
  readonly novedades: number;
  /** Texto exacto del buscador aprobado. */
  readonly textoBuscador: string;
}

/** Conteo demostrativo único del prototipo (menú «Novedades» y campana). */
export const HOSPITAL_NOVEDADES_DEMO = 7;

/**
 * Menú completo, en el orden vinculante de la especificación.
 *
 * Decisión final de la Product Owner (TASK-003H-05): «Membresías y servicios»
 * deja de ser una opción principal del menú y permanece dentro de
 * `Configuración`, como una de sus pestañas. En su lugar la zona inferior queda
 * exactamente `Gestión financiera`, `Reportes` y `Configuración`, con
 * `Gestión financiera` inmediatamente encima de `Reportes`.
 *
 * Que la opción exista no significa que el módulo exista: `Gestión financiera`
 * abre por ahora un destino provisional y su contenido pertenece a
 * TASK-003H-06.
 */
export const HOSPITAL_NAV_ITEMS: readonly HospitalNavItemConfig[] = [
  { id: 'inicio', etiqueta: 'Inicio', icono: 'inicio' },
  { id: 'agenda', etiqueta: 'Agenda y citas', icono: 'agenda' },
  { id: 'pacientes', etiqueta: 'Pacientes', icono: 'pacientes' },
  { id: 'alarmas', etiqueta: 'Semáforo de alarmas', icono: 'alarmas' },
  { id: 'profesionales', etiqueta: 'Profesionales', icono: 'profesionales' },
  { id: 'visitas', etiqueta: 'Visitas domiciliarias', icono: 'visitas' },
  { id: 'virtuales', etiqueta: 'Consultas virtuales', icono: 'virtuales' },
  { id: 'calificaciones', etiqueta: 'Calificaciones', icono: 'calificaciones' },
  { id: 'novedades', etiqueta: 'Novedades', icono: 'novedades', badge: HOSPITAL_NOVEDADES_DEMO },
  {
    id: 'financiera',
    etiqueta: 'Gestión financiera',
    icono: 'financiera',
    separadorAntes: true,
  },
  { id: 'reportes', etiqueta: 'Reportes', icono: 'reportes' },
  { id: 'configuracion', etiqueta: 'Configuración', icono: 'configuracion' },
];

/**
 * Etiqueta de plataforma del sidebar. Procede del branding visible ya
 * centralizado (`src/config/branding.ts`) y no se redefine aquí.
 */
export const HOSPITAL_ETIQUETA_PLATAFORMA = branding.platformDisplayName;

/**
 * Datos demostrativos del prototipo oficial. Son ficticios, no persisten y no
 * constituyen la identidad definitiva de MERDN ni de ninguna institución real.
 */
export const hospitalShellDemo: HospitalShellConfig = {
  institucion: {
    nombre: 'Hospital San Rafael',
    tipo: 'ESE',
    municipio: 'Soacha',
    logo: null,
  },
  usuario: {
    nombre: 'Claudia Vargas',
    rol: 'Coordinación domiciliaria',
    iniciales: 'CV',
  },
  navegacion: HOSPITAL_NAV_ITEMS,
  itemActivoId: 'inicio',
  novedades: HOSPITAL_NOVEDADES_DEMO,
  textoBuscador: 'Buscar paciente, documento, profesional, cita, atención o municipio',
};
