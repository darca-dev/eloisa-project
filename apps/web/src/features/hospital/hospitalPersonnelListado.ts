import type {
  HospitalPersonaAdministrativa,
  HospitalPersonalConsulta,
  HospitalPersonalIndicador,
  HospitalPersonalVinculacion,
} from './hospitalAdministrationConfig';
import { normalizar } from './hospitalProfessionalsListado';

/**
 * Búsqueda, filtrado y conteo local de «Personal y accesos» (corrección final
 * aprobada por la Product Owner para TASK-003H-05, apartado A).
 *
 * Son funciones puras sobre los fixtures ya cargados en memoria: no hay
 * consulta remota, índice, paginación de servidor, permisos ni aislamiento
 * institucional. Cuando exista backend, esta capa se sustituye por una consulta
 * autorizada; hasta entonces la pantalla solo recorre datos demostrativos
 * locales.
 *
 * Que una persona aparezca en un resultado NO acredita cuenta, acceso, relación
 * autorizada ni derecho a consultar su información. Los indicadores se cuentan
 * sobre esas mismas personas ficticias: no son cifras de producción.
 */

/** Consulta vacía: todas las personas visibles, sin texto ni filtros. */
export const HOSPITAL_PERSONAL_CONSULTA_INICIAL: HospitalPersonalConsulta = {
  texto: '',
  vinculacion: '',
  rol: '',
  entidad: '',
  estadoAcceso: '',
};

/**
 * Textos sobre los que opera la búsqueda: nombre, documento, código de personal,
 * cargo y entidad. El documento solo se compara; nunca se muestra completo.
 */
function textosBuscables(persona: HospitalPersonaAdministrativa): readonly string[] {
  return [persona.nombre, persona.documento, persona.codigo, persona.cargo, persona.entidad];
}

/** `true` cuando la persona coincide con el texto buscado. */
export function coincidePersona(
  persona: HospitalPersonaAdministrativa,
  texto: string,
): boolean {
  const buscado = normalizar(texto);

  if (buscado === '') {
    return true;
  }

  return textosBuscables(persona).some((valor) => normalizar(valor).includes(buscado));
}

/** Aplica la búsqueda y los cuatro filtros. El orden del fixture se conserva. */
export function filtrarPersonas(
  personas: readonly HospitalPersonaAdministrativa[],
  consulta: HospitalPersonalConsulta,
): readonly HospitalPersonaAdministrativa[] {
  return personas.filter(
    (persona) =>
      coincidePersona(persona, consulta.texto) &&
      (consulta.vinculacion === '' || persona.vinculacion === consulta.vinculacion) &&
      (consulta.rol === '' || persona.rol === consulta.rol) &&
      (consulta.entidad === '' || persona.entidad === consulta.entidad) &&
      (consulta.estadoAcceso === '' || persona.estadoAcceso === consulta.estadoAcceso),
  );
}

/** Valores únicos de un campo, en orden alfabético español. */
function opcionesDe(
  personas: readonly HospitalPersonaAdministrativa[],
  leer: (persona: HospitalPersonaAdministrativa) => string,
): readonly string[] {
  return [...new Set(personas.map(leer))].sort((a, b) => a.localeCompare(b, 'es-CO'));
}

/** Opciones disponibles para los filtros de rol, entidad y estado de acceso. */
export function opcionesDePersonal(personas: readonly HospitalPersonaAdministrativa[]): {
  readonly rol: readonly string[];
  readonly entidad: readonly string[];
  readonly estadoAcceso: readonly string[];
} {
  return {
    rol: opcionesDe(personas, (persona) => persona.rol),
    entidad: opcionesDe(personas, (persona) => persona.entidad),
    estadoAcceso: opcionesDe(personas, (persona) => persona.estadoAcceso),
  };
}

/**
 * Los ocho indicadores compactos de la cabecera, en el orden aprobado.
 *
 * Cada valor se cuenta sobre el conjunto completo, de modo que la cabecera no
 * cambia al filtrar el listado. `Suspendidos / bloqueados` reúne los dos
 * estados que impiden entrar, tal como pide la corrección.
 */
export function indicadoresDePersonal(
  personas: readonly HospitalPersonaAdministrativa[],
  vinculaciones: readonly HospitalPersonalVinculacion[],
  etiquetas: {
    readonly registrado: string;
    readonly activos: string;
    readonly pendientes: string;
    readonly suspendidos: string;
  },
): readonly HospitalPersonalIndicador[] {
  const contarEstado = (estado: string): number =>
    personas.filter((persona) => persona.estadoAcceso === estado).length;

  return [
    { id: 'registrado', etiqueta: etiquetas.registrado, valor: personas.length },
    ...vinculaciones.map((vinculacion) => ({
      id: vinculacion.id,
      etiqueta: vinculacion.plural,
      valor: personas.filter((persona) => persona.vinculacion === vinculacion.id).length,
    })),
    { id: 'activos', etiqueta: etiquetas.activos, valor: contarEstado('Activo') },
    { id: 'pendientes', etiqueta: etiquetas.pendientes, valor: contarEstado('Pendiente') },
    {
      id: 'suspendidos',
      etiqueta: etiquetas.suspendidos,
      valor: contarEstado('Suspendido') + contarEstado('Bloqueado'),
    },
  ];
}

/** `true` cuando la consulta no aplica ningún recorte. */
export function consultaPersonalVacia(consulta: HospitalPersonalConsulta): boolean {
  return (
    consulta.texto === '' &&
    consulta.vinculacion === '' &&
    consulta.rol === '' &&
    consulta.entidad === '' &&
    consulta.estadoAcceso === ''
  );
}
