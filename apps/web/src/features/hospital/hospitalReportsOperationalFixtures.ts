import {
  POBLACION_FECHA_CORTE,
  POBLACION_TENANT_DEMO,
  pacientesPoblacionDemo,
} from './hospitalPopulationFixtures';
import { profesionalResponsable } from './hospitalPopulationAnalytics';
import { POBLACION_SIN_ASIGNAR, type PoblacionPaciente } from './hospitalPopulationTypes';
import {
  OPERACION_ESTADOS,
  OPERACION_MODALIDADES,
  type OperacionAlarma,
  type OperacionEstadoId,
  type OperacionEvento,
  type OperacionModalidadId,
} from './hospitalReportsTypes';

/**
 * Conjunto operativo demostrativo de «Reportes» (TASK-003H-07, §4).
 *
 * Genera de forma DETERMINISTA los eventos operativos —citas, visitas
 * domiciliarias y consultas virtuales—, las vinculaciones a programa que
 * definen la población beneficiaria y las alarmas operativas del escenario.
 *
 * Cada evento se ancla a una persona del conjunto de H-03B mediante su
 * `pacienteId`, y toma de ella programa, municipio, zona y profesional
 * responsable. Por eso Reportes no mantiene un padrón paralelo: filtrar por
 * programa, municipio, EPS o condición prioritaria recorta exactamente las
 * mismas personas que en Pacientes.
 *
 * Determinismo: la secuencia procede de un generador congruente sembrado con
 * una constante. No se usa `Math.random`, no se lee la fecha del sistema y dos
 * ejecuciones producen exactamente el mismo conjunto.
 *
 * TODOS los datos son ficticios. Ningún evento describe una atención real, un
 * resultado clínico, una prestación facturable ni una integración existente.
 * Una alarma operativa organiza trabajo pendiente: no es una alerta clínica,
 * no evalúa rangos y no emite recomendación alguna.
 */

/* ========================================================================== */
/* Contexto del conjunto operativo                                            */
/* ========================================================================== */

/** Periodos representados, del más antiguo al más reciente. */
export const OPERACION_PERIODOS: readonly string[] = ['Junio 2026', 'Julio 2026', 'Agosto 2026'];

/** Periodo abierto por defecto: el más reciente del conjunto. */
export const OPERACION_PERIODO_INICIAL = 'Agosto 2026';

/** Fecha de corte del conjunto operativo; coincide con la de población. */
export const OPERACION_FECHA_CORTE = POBLACION_FECHA_CORTE;

/** Fecha de corte redactada para la interfaz. */
export const OPERACION_FECHA_CORTE_TEXTO = 'Corte 20 de agosto de 2026';

/** Marca de composición del snapshot. No acredita ninguna ejecución real. */
export const OPERACION_CALCULATED_AT = '2026-08-20T06:00:00-05:00';

/** Procedencia única de todo el conjunto operativo. */
export const OPERACION_PROCEDENCIA = 'Registro operativo demostrativo de la experiencia Hospital';

/** Semilla del generador. Cambiarla cambia el conjunto operativo completo. */
const SEMILLA = 20260807;

/** Tramos de antigüedad de los pendientes, en el orden de lectura. */
export const OPERACION_TRAMOS_ANTIGUEDAD: readonly string[] = [
  '0 a 7 días',
  '8 a 15 días',
  '16 a 30 días',
  'Más de 30 días',
];

/* ========================================================================== */
/* Generador determinista                                                     */
/* ========================================================================== */

/**
 * Generador congruente lineal de 32 bits. Es un contador reproducible, no una
 * fuente de aleatoriedad criptográfica: nunca debe usarse para secretos.
 */
function crearSecuencia(semilla: number): () => number {
  let estado = semilla >>> 0;

  return () => {
    estado = (Math.imul(estado, 1664525) + 1013904223) >>> 0;

    return estado / 4294967296;
  };
}

/** Elemento de un catálogo según la secuencia. */
function elegir<T>(catalogo: readonly T[], siguiente: () => number): T {
  const indice = Math.floor(siguiente() * catalogo.length);

  return catalogo[Math.min(indice, catalogo.length - 1)] as T;
}

/** Entero entre `desde` y `hasta`, ambos incluidos. */
function entero(siguiente: () => number, desde: number, hasta: number): number {
  return desde + Math.floor(siguiente() * (hasta - desde + 1));
}

/* ========================================================================== */
/* Vinculaciones a programa                                                   */
/* ========================================================================== */

/**
 * Vinculación registrada de una persona a un programa dentro de un periodo.
 *
 * Es el ÚNICO hecho que convierte a alguien en población beneficiaria del
 * periodo (§3.3). Una cita, una visita o una consulta NO crean vinculación:
 * `Población beneficiaria` y `Paciente activo` son conjuntos distintos y el
 * fixture los declara por separado.
 */
export interface OperacionVinculacion {
  readonly id: string;
  readonly tenantId: string;
  readonly pacienteId: string;
  readonly programa: string;
  readonly periodo: string;
  readonly procedencia: string;
}

/* ========================================================================== */
/* Construcción del conjunto                                                  */
/* ========================================================================== */

/** Programa de la persona para el evento, o `Sin asignar` cuando no tiene. */
function programaDe(paciente: PoblacionPaciente, siguiente: () => number): string {
  return paciente.programas.length === 0
    ? POBLACION_SIN_ASIGNAR
    : elegir(paciente.programas, siguiente);
}

/**
 * Duración del evento en minutos.
 *
 * Una fracción de los eventos realizados no tiene timestamps válidos y
 * devuelve `null`: la mediana los excluye y la cobertura se declara. Los
 * eventos no realizados nunca tienen duración.
 */
function duracionDe(estado: OperacionEstadoId, siguiente: () => number): number | null {
  if (estado !== 'Realizada') {
    return null;
  }

  return siguiente() < 0.12 ? null : entero(siguiente, 18, 76);
}

/** Estado del evento según el periodo: el periodo en curso deja pendientes. */
function estadoDe(periodo: string, siguiente: () => number): OperacionEstadoId {
  const valor = siguiente();

  if (periodo === OPERACION_PERIODO_INICIAL) {
    if (valor < 0.56) {
      return 'Realizada';
    }
    if (valor < 0.74) {
      return 'Programada';
    }

    return valor < 0.88 ? 'Pendiente' : 'Cancelada';
  }

  if (valor < 0.82) {
    return 'Realizada';
  }

  return valor < 0.93 ? 'Cancelada' : 'Pendiente';
}

/** Eventos de una persona dentro del conjunto demostrativo. */
function eventosDe(
  paciente: PoblacionPaciente,
  siguiente: () => number,
  indice: number,
): readonly OperacionEvento[] {
  const responsable = profesionalResponsable(paciente);
  const eventos: OperacionEvento[] = [];
  let secuencia = 0;

  for (const periodo of OPERACION_PERIODOS) {
    const cantidad = siguiente() < 0.42 ? 0 : entero(siguiente, 1, 2);

    for (let evento = 0; evento < cantidad; evento += 1) {
      const estado = estadoDe(periodo, siguiente);

      eventos.push({
        id: `ope-${String(indice).padStart(6, '0')}-${String(secuencia)}`,
        tenantId: paciente.tenantId,
        pacienteId: paciente.id,
        periodo,
        modalidad: elegir(OPERACION_MODALIDADES, siguiente) as OperacionModalidadId,
        estado,
        programa: programaDe(paciente, siguiente),
        municipio: paciente.municipio,
        zona: paciente.zona,
        profesionalId: responsable?.nombre ?? POBLACION_SIN_ASIGNAR,
        profesion: responsable?.profesion ?? POBLACION_SIN_ASIGNAR,
        duracionMinutos: duracionDe(estado, siguiente),
        procedencia: OPERACION_PROCEDENCIA,
      });
      secuencia += 1;
    }
  }

  return eventos;
}

/** Vinculaciones a programa de una persona dentro del conjunto. */
function vinculacionesDe(
  paciente: PoblacionPaciente,
  siguiente: () => number,
  indice: number,
): readonly OperacionVinculacion[] {
  const vinculaciones: OperacionVinculacion[] = [];
  const programas = paciente.programas.length === 0 ? [POBLACION_SIN_ASIGNAR] : paciente.programas;
  let secuencia = 0;

  for (const periodo of OPERACION_PERIODOS) {
    /* No toda persona del padrón queda vinculada en todos los periodos. */
    if (siguiente() < 0.34) {
      continue;
    }

    vinculaciones.push({
      id: `vin-${String(indice).padStart(6, '0')}-${String(secuencia)}`,
      tenantId: paciente.tenantId,
      pacienteId: paciente.id,
      programa: elegir(programas, siguiente),
      periodo,
      procedencia: OPERACION_PROCEDENCIA,
    });
    secuencia += 1;
  }

  return vinculaciones;
}

/* ========================================================================== */
/* Alarmas operativas                                                         */
/* ========================================================================== */

const ASUNTOS_ALARMA: readonly string[] = [
  'Visita domiciliaria sin confirmación de ejecución',
  'Cita reprogramada dos veces sin nueva fecha',
  'Consulta virtual sin acta de cierre registrada',
  'Bitácora del periodo sin revisión del equipo',
  'Asignación de profesional pendiente',
  'Evidencia operativa del programa sin cargar',
];

/** Alarmas operativas del escenario, contadas por su estado al corte. */
function construirAlarmas(
  pacientes: readonly PoblacionPaciente[],
  siguiente: () => number,
): readonly OperacionAlarma[] {
  const alarmas: OperacionAlarma[] = [];
  const total = 64;

  for (let indice = 0; indice < total; indice += 1) {
    const paciente = pacientes[Math.floor(siguiente() * pacientes.length)];

    if (paciente === undefined) {
      continue;
    }

    const abierta = siguiente() < 0.58;

    alarmas.push({
      id: `alr-${String(indice).padStart(4, '0')}`,
      tenantId: paciente.tenantId,
      periodo: elegir(OPERACION_PERIODOS, siguiente),
      programa: programaDe(paciente, siguiente),
      municipio: paciente.municipio,
      zona: paciente.zona,
      estadoAlCorte: abierta ? 'Abierta' : 'Cerrada',
      antiguedad: `${String(entero(siguiente, 1, 46))} días`,
      tramoAntiguedad: elegir(OPERACION_TRAMOS_ANTIGUEDAD, siguiente),
      asunto: elegir(ASUNTOS_ALARMA, siguiente),
      procedencia: OPERACION_PROCEDENCIA,
    });
  }

  return alarmas;
}

/* ========================================================================== */
/* Conjunto memorizado                                                        */
/* ========================================================================== */

interface ConjuntoOperativo {
  readonly eventos: readonly OperacionEvento[];
  readonly vinculaciones: readonly OperacionVinculacion[];
  readonly alarmas: readonly OperacionAlarma[];
}

let conjunto: ConjuntoOperativo | null = null;

/** Construye una sola vez por proceso el conjunto operativo completo. */
function construir(): ConjuntoOperativo {
  const siguiente = crearSecuencia(SEMILLA);
  const pacientes = pacientesPoblacionDemo();
  const eventos: OperacionEvento[] = [];
  const vinculaciones: OperacionVinculacion[] = [];

  for (const [indice, paciente] of pacientes.entries()) {
    eventos.push(...eventosDe(paciente, siguiente, indice));
    vinculaciones.push(...vinculacionesDe(paciente, siguiente, indice));
  }

  return {
    eventos,
    vinculaciones,
    alarmas: construirAlarmas(pacientes, siguiente),
  };
}

function conjuntoOperativo(): ConjuntoOperativo {
  if (conjunto === null) {
    conjunto = construir();
  }

  return conjunto;
}

/** Eventos operativos del escenario demostrativo. */
export function eventosOperativosDemo(): readonly OperacionEvento[] {
  return conjuntoOperativo().eventos;
}

/** Vinculaciones a programa que definen la población beneficiaria. */
export function vinculacionesDemo(): readonly OperacionVinculacion[] {
  return conjuntoOperativo().vinculaciones;
}

/** Alarmas operativas del escenario demostrativo. */
export function alarmasOperativasDemo(): readonly OperacionAlarma[] {
  return conjuntoOperativo().alarmas;
}

/** Tenant del conjunto operativo; es el mismo de población. */
export const OPERACION_TENANT_DEMO = POBLACION_TENANT_DEMO;

/** Catálogo de estados, reexportado para las opciones de la interfaz. */
export const OPERACION_CATALOGO_ESTADOS = OPERACION_ESTADOS;
