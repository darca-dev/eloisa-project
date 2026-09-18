import type { HospitalIconName } from './HospitalIcon';
import type { HospitalTonoId } from './hospitalTonos';
import type { HospitalDestino } from './hospitalViews';

/**
 * Contrato tipado y fixtures de la vista `Inicio` del Hospital
 * (TASK-003H-02, FR-02; TASK-003H-02B, FR-02 y FR-10).
 *
 * Fuente visual vinculante: `prototype-claude/Eligeme-Hospital.dc.html`,
 * vista `Dashboard / Inicio` (líneas 105–131 para la anatomía y 1419–1427 para
 * la configuración demostrativa).
 *
 * Alcance: presentación. Los totales y desgloses son fixtures ficticios de
 * fidelidad visual, NO indicadores oficiales ni métricas productivas. No tienen
 * fuente, fórmula, periodo, propietario ni linaje aprobados; no se calculan, no
 * se consultan, no se persisten y no deben presentarse como dato real.
 *
 * Los valores se tipan como texto de presentación para no imponer hoy formato,
 * unidad ni precisión productiva.
 */

/** Fila de desglose de una tarjeta: par etiqueta/valor, en orden de entrada. */
export interface HospitalKpiBreakdownRow {
  readonly label: string;
  readonly value: string;
}

/**
 * Configuración de una tarjeta KPI. La tarjeta es genérica: no conoce
 * categorías, no suma, no deriva estados y no aplica reglas por tipo de KPI.
 */
export interface HospitalKpiConfig {
  /** Identificador estable de la tarjeta dentro de la cuadrícula. */
  readonly id: string;
  /** Etiqueta visible; es el nombre accesible de la tarjeta. */
  readonly label: string;
  /** Total demostrativo, ya formateado como texto de presentación. */
  readonly value: string;
  /** Color de énfasis (borde superior, total e icono). Token del sistema. */
  readonly accentColor: string;
  /** Fondo del contenedor del icono. Token del sistema. */
  readonly iconBackground: string;
  /** Icono decorativo del catálogo local. */
  readonly icon: HospitalIconName;
  /** Filas de desglose, en el orden exacto de la referencia. */
  readonly breakdown: readonly HospitalKpiBreakdownRow[];
  /**
   * Vista local que abre la tarjeta y, si la declara, la intención de lectura
   * que transporta (TASK-003H-02B, FR-02). No es una ruta ni un permiso.
   */
  readonly destino: HospitalDestino;
  /**
   * Texto visible del pie de la tarjeta. Enuncia a dónde lleva y, cuando hay
   * intención, con qué contexto; nunca afirma que se aplicó un filtro.
   */
  readonly pie: string;
}

/**
 * Encabezado del Dashboard. La fecha llega como contenido de presentación: no
 * hay reloj, formateador, zona horaria ni dependencia de la fecha del sistema.
 */
export interface HospitalDashboardHeaderConfig {
  readonly etiqueta: string;
  readonly titulo: string;
  readonly fecha: string;
}

export interface HospitalDashboardConfig {
  readonly encabezado: HospitalDashboardHeaderConfig;
  readonly kpis: readonly HospitalKpiConfig[];
}


/* --------- Centro de control operativo de Inicio (TASK-003H-02B) ---------- */

/*
 * Contratos de presentación de las secciones que TASK-003H-02B añade a Inicio.
 *
 * Ninguno describe un modelo de dominio definitivo. Son formas de UI: sus datos
 * se componen con selectores puros a partir de los fixtures Hospital que ya
 * existen (`hospitalDashboardOperacion.ts`), de modo que mañana puedan
 * sustituirse por consultas autorizadas sin tocar los componentes. Ninguna
 * sección calcula, prioriza, evalúa ni deriva reglas clínicas: el orden es
 * orden de presentación del fixture y los estados son textos ya escritos allí.
 */

/** Acción única de una fila o de un acceso. Solo navega dentro del shell. */
export interface HospitalAccionDestino {
  /** Texto visible del control. */
  readonly etiqueta: string;
  readonly destino: HospitalDestino;
  /** Complemento invisible del nombre accesible cuando la etiqueta es breve. */
  readonly detalleAccesible: string;
}

/** Fila de `Necesita atención ahora`. */
export interface HospitalAtencionItem {
  readonly id: string;
  /** Severidad o tipo de situación, siempre legible como texto. */
  readonly severidad: string;
  /** Persona o caso al que se refiere la situación. */
  readonly titulo: string;
  /** Contexto mínimo útil ya redactado por el fixture de origen. */
  readonly contexto: string;
  /** Antigüedad, hora o estado que el fixture ya declara. */
  readonly prioridad: string;
  readonly tono: HospitalTonoId;
  readonly accion: HospitalAccionDestino;
}

/** Control compacto de `Acciones rápidas`. Abre un módulo; no crea registros. */
export interface HospitalAccionRapida {
  readonly id: string;
  readonly etiqueta: string;
  readonly icono: HospitalIconName;
  readonly destino: HospitalDestino;
  /** Qué hace realmente el control, sin prometer la operación. */
  readonly detalle: string;
}

/** Fila de `Agenda próxima`: hora, paciente, modalidad y profesional. */
export interface HospitalAgendaProximaFila {
  readonly id: string;
  readonly hora: string;
  readonly paciente: string;
  readonly modalidad: string;
  /** Nombre del profesional o el texto `Sin asignar` del fixture. */
  readonly profesional: string;
  /** `true` cuando el fixture declara `Sin asignar`. */
  readonly sinAsignar: boolean;
}

/** Fila de `Alarmas recientes`. */
export interface HospitalAlarmaRecienteFila {
  readonly id: string;
  readonly severidad: string;
  readonly paciente: string;
  readonly motivo: string;
  readonly cuando: string;
  readonly estado: string;
  readonly tono: HospitalTonoId;
  readonly accion: HospitalAccionDestino;
}

/** Conteo del resumen de profesionales. No calcula disponibilidad real. */
export interface HospitalProfesionalConteo {
  readonly id: string;
  readonly etiqueta: string;
  readonly valor: string;
}

/** Acceso de la sección `Ir a`, derivado del menú del shell. */
export interface HospitalAccesoDirecto {
  readonly id: string;
  readonly etiqueta: string;
  readonly icono: HospitalIconName;
  /** Vista local que abre; `null` cuando el módulo no tiene vista implementada. */
  readonly destino: HospitalDestino | null;
}

/** Sección con título propio y, cuando aplica, un acceso al módulo completo. */
export interface HospitalSeccionInicio<T> {
  readonly titulo: string;
  readonly nota?: string;
  readonly items: readonly T[];
  readonly verTodo?: HospitalAccionDestino;
}

/** Composición completa de la vista Inicio. */
export interface HospitalInicioConfig {
  readonly atencion: HospitalSeccionInicio<HospitalAtencionItem>;
  readonly acciones: HospitalSeccionInicio<HospitalAccionRapida>;
  readonly agenda: HospitalSeccionInicio<HospitalAgendaProximaFila>;
  readonly alarmas: HospitalSeccionInicio<HospitalAlarmaRecienteFila>;
  readonly profesionales: HospitalSeccionInicio<HospitalProfesionalConteo>;
  readonly accesos: HospitalSeccionInicio<HospitalAccesoDirecto>;
  /** Texto del estado `no disponible` de `Ir a`. */
  readonly textoNoDisponible: string;
}


/** Encabezado demostrativo exacto de la referencia. */
export const hospitalDashboardHeaderDemo: HospitalDashboardHeaderConfig = {
  etiqueta: 'CENTRO DE CONTROL OPERATIVO',
  titulo: 'Atención domiciliaria de hoy',
  fecha: 'Lunes 17 de agosto de 2026 · 9:05 a. m.',
};

/**
 * Los siete KPIs demostrativos, en el orden vinculante. Cada color usa el token
 * del sistema cuyo valor coincide exactamente con el de la referencia Hospital.
 */
export const hospitalKpisDemo: readonly HospitalKpiConfig[] = [
  {
    id: 'citas-hoy',
    label: 'CITAS DE HOY',
    value: '24',
    accentColor: 'var(--b-azul)',
    iconBackground: 'var(--b-celeste)',
    icon: 'agenda',
    breakdown: [
      { label: 'Presenciales', value: '6' },
      { label: 'Virtuales', value: '7' },
      { label: 'Domiciliarias', value: '11' },
    ],
    destino: { vista: 'agenda' },
    pie: 'Abrir Agenda y citas',
  },
  {
    id: 'visitas-casa-hoy',
    label: 'VISITAS EN CASA HOY',
    value: '11',
    accentColor: 'var(--b-petroleo)',
    iconBackground: 'var(--b-celeste)',
    icon: 'visitas',
    breakdown: [
      { label: 'Programadas', value: '4' },
      { label: 'En camino', value: '2' },
      { label: 'En atención', value: '2' },
      { label: 'Finalizadas', value: '3' },
    ],
    destino: { vista: 'visitas' },
    pie: 'Abrir Visitas domiciliarias',
  },
  {
    id: 'consultas-virtuales-hoy',
    label: 'CONSULTAS VIRTUALES HOY',
    value: '7',
    accentColor: 'var(--b-petroleo)',
    iconBackground: 'var(--b-celeste)',
    icon: 'virtuales',
    breakdown: [
      { label: 'En espera', value: '1' },
      { label: 'En curso', value: '2' },
      { label: 'Finalizadas', value: '4' },
    ],
    destino: { vista: 'virtuales' },
    pie: 'Abrir Consultas virtuales',
  },
  {
    id: 'alarmas-activas',
    label: 'ALARMAS ACTIVAS',
    value: '7',
    accentColor: 'var(--b-rojo)',
    iconBackground: 'var(--b-rojo-fondo)',
    icon: 'alarmas',
    breakdown: [
      { label: 'Rojas', value: '3' },
      { label: 'Amarillas', value: '4' },
    ],
    destino: { vista: 'alarmas' },
    pie: 'Abrir Semáforo de alarmas',
  },
  {
    id: 'pacientes-activos',
    label: 'PACIENTES ACTIVOS',
    value: '412',
    accentColor: 'var(--b-azul)',
    iconBackground: 'var(--b-celeste)',
    icon: 'usuarios',
    breakdown: [
      { label: 'Con cuidador', value: '298' },
      { label: 'Nuevos del mes', value: '38' },
    ],
    destino: { vista: 'pacientes' },
    pie: 'Abrir Pacientes',
  },
  {
    id: 'profesionales-turno',
    label: 'PROFESIONALES EN TURNO',
    value: '9',
    accentColor: 'var(--b-verde)',
    iconBackground: 'var(--b-verde-fondo)',
    icon: 'profesionales',
    breakdown: [
      { label: 'Disponibles', value: '4' },
      { label: 'En visita', value: '3' },
      { label: 'En consulta', value: '2' },
    ],
    destino: { vista: 'profesionales' },
    pie: 'Abrir Profesionales',
  },
  {
    id: 'citas-pendientes-asignacion',
    label: 'CITAS PENDIENTES DE ASIGNACIÓN',
    value: '4',
    accentColor: 'var(--b-amarillo)',
    iconBackground: 'var(--b-amarillo-fondo)',
    icon: 'reloj',
    breakdown: [
      { label: 'Prioritaria hospital', value: '1' },
      { label: 'Visita en casa', value: '2' },
      { label: 'Virtual', value: '1' },
    ],
    destino: { vista: 'agenda', intencion: 'pendientes-asignacion' },
    pie: 'Abrir Agenda · intención: pendientes de asignación',
  },
];

/** Configuración demostrativa completa del bloque superior del Dashboard. */
export const hospitalDashboardDemo: HospitalDashboardConfig = {
  encabezado: hospitalDashboardHeaderDemo,
  kpis: hospitalKpisDemo,
};
