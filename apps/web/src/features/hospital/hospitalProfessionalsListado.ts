import { fechaHoraLegible, fechaLegible, ventanaLegible } from './hospitalAgendaConfig';
import {
  HOSPITAL_ESTADOS_PERFIL,
  HOSPITAL_ESTADOS_VINCULO,
  HOSPITAL_MODALIDADES_CITA,
  HOSPITAL_PROFESIONALES_NO_DISPONIBLE,
  HOSPITAL_PROFESIONES,
  HOSPITAL_TIPOS_VINCULO,
  type HospitalEstadosTexto,
} from './hospitalProfessionalsConfig';
import type {
  HospitalCitaProfesionalDto,
  HospitalProfesionalesListaDto,
  HospitalVentanaDto,
  HospitalVinculoDto,
  ResultadoOperaciones,
} from './hospitalProfessionalsClient';
import type { HospitalTonoId } from './hospitalTonos';

/**
 * Lectura del directorio de profesionales YA SERVIDO
 * (TASK-HOSPITAL-CORE-02 §3.1; paquete de continuación §3.1).
 *
 * QUÉ CAMBIÓ. Este archivo filtraba, ordenaba y contaba sobre un universo de
 * fixtures cargado en memoria. Ese universo ya no existe en el runtime de
 * Profesionales: la búsqueda, los filtros, el orden y la paginación los resuelve
 * el SERVIDOR, acotados al tenant institucional que él mismo determina, y la
 * vista solo envía la allowlist declarada en `hospitalProfessionalsClient.ts`.
 *
 * Lo que queda aquí son funciones PURAS de lectura sobre el DTO servido:
 * traducen códigos del catálogo controlado a su etiqueta visible, redactan
 * fechas de forma determinista y traducen el desenlace del cliente a estado de
 * interfaz. Ninguna infiere, calcula ni completa un dato ausente: cuando la
 * plataforma no modela algo, se declara `No disponible en este módulo`.
 *
 * Que un profesional aparezca en un resultado NO acredita habilitación,
 * contrato, disponibilidad ni derecho de acceso a información de nadie.
 */

/**
 * Normaliza para comparar: minúsculas y sin diacríticos, de modo que `Gomez`
 * encuentre a `Gómez` y `perez` a `Pérez`.
 *
 * NO se usa para buscar en este módulo —la búsqueda es del servidor—: se
 * conserva porque `hospitalPersonnelListado.ts`, que sigue siendo demostrativo
 * y queda fuera del alcance de esta corrección, la consume.
 */
export function normalizar(valor: string): string {
  return valor
    .toLocaleLowerCase('es-CO')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim();
}

/* -------------------------------------------------------------------------- */
/* Catálogos controlados                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Etiqueta de un código de profesión.
 *
 * Un código que el catálogo local no conoce se muestra TAL CUAL: inventarle un
 * nombre afirmaría una profesión que nadie declaró.
 */
export function etiquetaProfesion(code: string, nombreServido: string): string {
  return (
    HOSPITAL_PROFESIONES_POR_CODIGO.get(code) ??
    (nombreServido === '' ? code : nombreServido)
  );
}

const HOSPITAL_PROFESIONES_POR_CODIGO = new Map<string, string>(
  HOSPITAL_PROFESIONES.map((profesion) => [profesion.code, profesion.etiqueta]),
);

/** Etiqueta del tipo de vínculo DECLARADO. No acredita contrato ni nómina. */
export function etiquetaVinculo(code: HospitalVinculoDto['engagementType']): string {
  return HOSPITAL_TIPOS_VINCULO.find((tipo) => tipo.code === code)?.etiqueta ?? code;
}

/** Etiqueta del estado del vínculo declarado. */
export function etiquetaEstadoVinculo(code: HospitalVinculoDto['status']): string {
  return HOSPITAL_ESTADOS_VINCULO.find((estado) => estado.code === code)?.etiqueta ?? code;
}

/** Estado del PERFIL, con su tono. NO es disponibilidad ni turno. */
export function estadoPerfil(code: 'ACTIVE' | 'INACTIVE'): {
  readonly etiqueta: string;
  readonly tono: HospitalTonoId;
} {
  const encontrado = HOSPITAL_ESTADOS_PERFIL.find((estado) => estado.code === code);

  return encontrado ?? { etiqueta: code, tono: 'amarillo' };
}

/** Modalidad de una cita de la agenda del profesional, con su tono. */
export function modalidadCita(code: HospitalCitaProfesionalDto['modality']): {
  readonly etiqueta: string;
  readonly tono: HospitalTonoId;
} {
  const encontrada = HOSPITAL_MODALIDADES_CITA.find((modalidad) => modalidad.code === code);

  return encontrada ?? { etiqueta: code, tono: 'petroleo' };
}

/** Estado de una cita de la agenda del profesional. */
export function estadoCita(code: HospitalCitaProfesionalDto['status']): {
  readonly etiqueta: string;
  readonly tono: HospitalTonoId;
} {
  switch (code) {
    case 'ASSIGNED':
      return { etiqueta: 'Asignada', tono: 'azul' };
    case 'CANCELLED':
      return { etiqueta: 'Cancelada', tono: 'rojo' };
    case 'REQUESTED':
    default:
      return { etiqueta: 'Solicitada', tono: 'amarillo' };
  }
}

/* -------------------------------------------------------------------------- */
/* Redacción determinista                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Texto de un instante opcional servido por el API.
 *
 * `null` NO se convierte en un cero ni en una fecha: se declara no disponible,
 * porque «sin próxima cita registrada» y «cita a las 00:00» son afirmaciones
 * distintas.
 */
export function textoInstante(valor: string | null): string {
  return valor === null ? HOSPITAL_PROFESIONALES_NO_DISPONIBLE : fechaHoraLegible(valor);
}

/** Texto de una fecha calendario opcional. */
export function textoFecha(valor: string | null): string {
  return valor === null ? HOSPITAL_PROFESIONALES_NO_DISPONIBLE : fechaLegible(valor);
}

/** Texto de la ventana que el SERVIDOR consultó para el detalle. */
export function textoVentana(ventana: HospitalVentanaDto): string {
  return ventanaLegible(ventana.from, ventana.to);
}

/** Rango de la página servida, en base 1 e inclusivo. Vacío cuando no hay filas. */
export function rangoDePagina(lista: HospitalProfesionalesListaDto): {
  readonly desde: number;
  readonly hasta: number;
} {
  if (lista.totalItems === 0 || lista.items.length === 0) {
    return { desde: 0, hasta: 0 };
  }

  const desde = (lista.page - 1) * lista.pageSize + 1;

  return { desde, hasta: desde + lista.items.length - 1 };
}

/* -------------------------------------------------------------------------- */
/* Estado de la consulta                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Estado de la vista, ya traducido desde el desenlace del cliente.
 *
 * `listo` no dice cuántas filas llegaron: la vista distingue aparte «esta
 * institución no registró profesionales» de «los filtros no encontraron
 * ninguno», porque confundirlos haría leer un recorte estrecho como una
 * institución sin equipo.
 */
export type HospitalProfesionalesEstado =
  | 'cargando'
  | 'listo'
  | 'sin-sesion'
  | 'sin-permiso'
  | 'no-encontrado'
  | 'consulta-invalida'
  | 'no-disponible'
  | 'error';

/**
 * Traduce el desenlace del cliente al estado de la vista.
 *
 * `cancelado` NO aparece: una consulta abortada por un cambio de filtro no es un
 * desenlace, y la vista debe esperar a la consulta vigente.
 */
export function estadoDeDesenlace(
  kind: Exclude<ResultadoOperaciones<unknown>['kind'], 'ok' | 'cancelado'>,
): HospitalProfesionalesEstado {
  return kind;
}

/** Texto del estado. Ninguno publica un dato servido previamente. */
export function textoDeEstado(
  copy: HospitalEstadosTexto,
  estado: HospitalProfesionalesEstado,
): string {
  switch (estado) {
    case 'cargando':
      return copy.cargando;
    case 'listo':
      return '';
    case 'sin-sesion':
      return copy.sinSesion;
    case 'sin-permiso':
      return copy.sinPermiso;
    case 'no-encontrado':
      return copy.noEncontrado;
    case 'consulta-invalida':
      return copy.consultaInvalida;
    case 'no-disponible':
      return copy.noDisponible;
    case 'error':
    default:
      return copy.error;
  }
}

/**
 * `true` cuando reintentar puede cambiar el desenlace.
 *
 * Sin sesión y sin permiso NO lo ofrecen: repetir la consulta devolvería lo
 * mismo, y esta vista no abre sesión ni concede permisos.
 */
export function ofreceReintento(estado: HospitalProfesionalesEstado): boolean {
  return estado === 'error' || estado === 'no-disponible' || estado === 'consulta-invalida';
}
