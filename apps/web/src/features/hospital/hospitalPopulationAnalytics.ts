import {
  POBLACION_CALCULATED_AT,
  POBLACION_FECHA_CORTE,
  POBLACION_INSTITUCION_DEMO,
  POBLACION_MUNICIPIO_SEDE,
  POBLACION_TENANT_DEMO,
} from './hospitalPopulationFixtures';
import {
  POBLACION_EDAD_MAYOR,
  POBLACION_ETIQUETA_PRIORIDAD,
  POBLACION_RANGOS_EDAD,
  POBLACION_SIN_ASIGNAR,
  POBLACION_SIN_CONDICION_PRINCIPAL,
  POBLACION_TAMANO_PAGINA_INICIAL,
  POBLACION_VERSION_DEFINICION,
  type PoblacionAsignacionProfesional,
  type PoblacionCelda,
  type PoblacionCuidadorVinculo,
  type PoblacionDistribucion,
  type PoblacionFiltros,
  type PoblacionFiltrosNormalizados,
  type PoblacionInterseccion,
  type PoblacionKpi,
  type PoblacionOrdenId,
  type PoblacionPaciente,
  type PoblacionSentido,
  type PopulationAnalyticsSnapshotV1,
} from './hospitalPopulationTypes';

/**
 * Selectores puros de población y analítica (TASK-003H-03B, §5 y §6).
 *
 * Es la ÚNICA implementación de las definiciones métricas versionadas
 * `population-v1`. `Pacientes` (H-03B) y `Reportes` (H-07) deben llamar a estas
 * funciones: ningún componente puede recalcular edades, porcentajes, rangos,
 * frecuencias de patología ni intersecciones por su cuenta.
 *
 * Todo es determinista y local: funciones puras sobre los fixtures ya cargados
 * en memoria. No hay consulta remota, índice, paginación de servidor, permisos,
 * aislamiento institucional ni auditoría; cuando exista backend, esta capa se
 * sustituye por un read model autorizado y reproducible.
 *
 * Que una persona aparezca en un resultado NO acredita asignación, relación
 * autorizada ni derecho de acceso a su información. Ninguna función de este
 * módulo emite diagnósticos, evalúa rangos clínicos ni genera alertas.
 */

/* ========================================================================== */
/* Edad derivada                                                              */
/* ========================================================================== */

/** Partes numéricas de una fecha AAAA-MM-DD, sin usar la fecha del sistema. */
function partesDeFecha(valor: string): readonly [number, number, number] {
  const [anio = 0, mes = 1, dia = 1] = valor.split('-').map((parte) => Number(parte));

  return [anio, mes, dia];
}

/**
 * Edad cumplida a la fecha de corte (§6). Se deriva siempre de la fecha de
 * nacimiento: no existe un valor de edad almacenado que pueda contradecirla.
 */
export function edadEnCorte(nacimiento: string, corte: string = POBLACION_FECHA_CORTE): number {
  const [anioN, mesN, diaN] = partesDeFecha(nacimiento);
  const [anioC, mesC, diaC] = partesDeFecha(corte);
  const cumplido = mesC > mesN || (mesC === mesN && diaC >= diaN);

  return anioC - anioN - (cumplido ? 0 : 1);
}

/** Identificador del rango de edad al que pertenece una edad (§6). */
export function rangoDeEdad(edad: number): string {
  const rango = POBLACION_RANGOS_EDAD.find(
    (candidato) => edad >= candidato.desde && (candidato.hasta === null || edad <= candidato.hasta),
  );

  return rango?.id ?? POBLACION_RANGOS_EDAD[0]?.id ?? '';
}

/* ========================================================================== */
/* Lecturas de la persona                                                     */
/* ========================================================================== */

/** Comparación insensible a mayúsculas, tildes y espacios extremos (§5). */
export function normalizar(valor: string): string {
  return valor
    .toLocaleLowerCase('es-CO')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim();
}

/** Universo: personas únicas con participación activa en el contexto (§6). */
export function universoDe(
  pacientes: readonly PoblacionPaciente[],
): readonly PoblacionPaciente[] {
  const vistos = new Set<string>();
  const universo: PoblacionPaciente[] = [];

  for (const paciente of pacientes) {
    /* Deduplicación por identificador estable dentro del tenant. */
    if (paciente.participacion === 'active' && !vistos.has(paciente.id)) {
      vistos.add(paciente.id);
      universo.push(paciente);
    }
  }

  return universo;
}

/** `true` cuando la clasificación de discapacidad está activa. */
export function tieneDiscapacidad(paciente: PoblacionPaciente): boolean {
  return paciente.clasificaciones.some(
    (registro) => registro.tipo === 'DISABILITY' && registro.activa,
  );
}

/** `true` cuando la clasificación de cuidados en casa está activa. */
export function requiereCuidadosEnCasa(paciente: PoblacionPaciente): boolean {
  return paciente.clasificaciones.some(
    (registro) => registro.tipo === 'HOME_CARE_REQUIRED' && registro.activa,
  );
}

/** `true` cuando la edad derivada alcanza el umbral de mayor de 60 (§6). */
export function esMayorDe60(paciente: PoblacionPaciente, corte?: string): boolean {
  return edadEnCorte(paciente.nacimiento, corte) >= POBLACION_EDAD_MAYOR;
}

/** Vínculos de cuidador activos y vigentes. */
export function cuidadoresVigentes(
  paciente: PoblacionPaciente,
): readonly PoblacionCuidadorVinculo[] {
  return paciente.cuidadores.filter((vinculo) => vinculo.activo && vinculo.vigente);
}

/** `true` cuando no hay ninguna relación paciente-cuidador activa y vigente. */
export function sinCuidador(paciente: PoblacionPaciente): boolean {
  return cuidadoresVigentes(paciente).length === 0;
}

/** Asignación principal activa y vigente; `null` cuando no existe. */
export function profesionalResponsable(
  paciente: PoblacionPaciente,
): PoblacionAsignacionProfesional | null {
  return (
    paciente.asignaciones.find(
      (asignacion) => asignacion.principal && asignacion.activa && asignacion.vigente,
    ) ?? null
  );
}

/** `true` cuando no hay ninguna asignación principal activa y vigente. */
export function sinProfesionalResponsable(paciente: PoblacionPaciente): boolean {
  return profesionalResponsable(paciente) === null;
}

/** Otros profesionales autorizados: asignaciones activas no principales. */
export function profesionalesAutorizados(
  paciente: PoblacionPaciente,
): readonly PoblacionAsignacionProfesional[] {
  return paciente.asignaciones.filter((asignacion) => !asignacion.principal && asignacion.activa);
}

/** Nombres de patologías con relación activa, sin repetir. */
export function patologiasActivas(paciente: PoblacionPaciente): readonly string[] {
  return [
    ...new Set(
      paciente.condiciones.filter((condicion) => condicion.activa).map((condicion) => condicion.nombre),
    ),
  ];
}

/**
 * Condición principal registrada. Nunca se elige por frecuencia: si ninguna
 * relación activa está marcada como principal, devuelve el texto acordado (§7).
 */
export function condicionPrincipal(paciente: PoblacionPaciente): string {
  const principal = paciente.condiciones.find(
    (condicion) => condicion.activa && condicion.principal,
  );

  return principal?.nombre ?? POBLACION_SIN_CONDICION_PRINCIPAL;
}

/** Prioridades activas de la persona, en el orden A, B, C. */
export function prioridadesDe(paciente: PoblacionPaciente, corte?: string): readonly string[] {
  const prioridades: string[] = [];

  if (esMayorDe60(paciente, corte)) {
    prioridades.push(POBLACION_ETIQUETA_PRIORIDAD.MAYOR_60);
  }

  if (tieneDiscapacidad(paciente)) {
    prioridades.push(POBLACION_ETIQUETA_PRIORIDAD.DISABILITY);
  }

  if (requiereCuidadosEnCasa(paciente)) {
    prioridades.push(POBLACION_ETIQUETA_PRIORIDAD.HOME_CARE_REQUIRED);
  }

  return prioridades;
}

/** Nombre del profesional responsable o el texto de ausencia de asignación. */
export function textoProfesional(paciente: PoblacionPaciente): string {
  return profesionalResponsable(paciente)?.nombre ?? POBLACION_SIN_ASIGNAR;
}

/** Primer cuidador vigente o el texto de ausencia de asignación. */
export function textoCuidador(paciente: PoblacionPaciente): string {
  const vigentes = cuidadoresVigentes(paciente);
  const primero = vigentes[0];

  if (primero === undefined) {
    return POBLACION_SIN_ASIGNAR;
  }

  return vigentes.length > 1 ? `${primero.nombre} +${String(vigentes.length - 1)}` : primero.nombre;
}

/** Programa visible; una persona puede no participar en ninguno. */
export function textoPrograma(paciente: PoblacionPaciente): string {
  return paciente.programas[0] ?? POBLACION_SIN_ASIGNAR;
}

/** Territorio visible: municipio y zona en una sola celda. */
export function textoZona(paciente: PoblacionPaciente): string {
  return `${paciente.municipio} · ${paciente.zona}`;
}

/**
 * Documento enmascarado. Fuera del panel de detalle solo se muestran los
 * últimos dígitos; el documento completo nunca se imprime en el listado (§8).
 */
export function documentoEnmascarado(documento: string): string {
  const digitos = documento.replace(/\D/gu, '');
  const cola = digitos.slice(-3);

  return cola === '' ? 'Documento reservado' : `Doc. ···${cola}`;
}

/** Próxima atención en texto; `Sin agendar` cuando no hay ninguna prevista. */
export function textoProxima(paciente: PoblacionPaciente): string {
  const proxima = paciente.proximaAtencion;

  return proxima === null ? 'Sin agendar' : `${proxima.fecha} · ${proxima.hora}`;
}

/* ========================================================================== */
/* Filtros                                                                    */
/* ========================================================================== */

/** Consulta vacía: sin texto, sin selectores y sin chips activos (§5). */
export const POBLACION_FILTROS_VACIOS: PoblacionFiltros = {
  texto: '',
  edadMin: '',
  edadMax: '',
  condicion: '',
  eps: '',
  patologia: '',
  profesional: '',
  cuidador: '',
  programa: '',
  municipio: '',
  estado: '',
  rapidos: { mayor60: false, discapacidad: false, cuidadosCasa: false },
};

/** `true` cuando la consulta no aplica ningún recorte. */
export function filtrosVacios(filtros: PoblacionFiltros): boolean {
  return (
    filtros.texto.trim() === '' &&
    filtros.edadMin === '' &&
    filtros.edadMax === '' &&
    filtros.condicion === '' &&
    filtros.eps === '' &&
    filtros.patologia === '' &&
    filtros.profesional === '' &&
    filtros.cuidador === '' &&
    filtros.programa === '' &&
    filtros.municipio === '' &&
    filtros.estado === '' &&
    !filtros.rapidos.mayor60 &&
    !filtros.rapidos.discapacidad &&
    !filtros.rapidos.cuidadosCasa
  );
}

/** Entero de un campo de texto; `null` cuando está vacío o no es numérico. */
function numeroOpcional(valor: string): number | null {
  if (valor.trim() === '') {
    return null;
  }

  const numero = Number(valor);

  return Number.isFinite(numero) ? Math.trunc(numero) : null;
}

/** Cadena recortada o `null` cuando el selector está en «todas». */
function textoOpcional(valor: string): string | null {
  const recortado = valor.trim();

  return recortado === '' ? null : recortado;
}

/** Filtros ya normalizados; forman parte del snapshot compartido (§6). */
export function normalizarFiltros(filtros: PoblacionFiltros): PoblacionFiltrosNormalizados {
  return {
    texto: normalizar(filtros.texto),
    edadMin: numeroOpcional(filtros.edadMin),
    edadMax: numeroOpcional(filtros.edadMax),
    condicion: textoOpcional(filtros.condicion),
    eps: textoOpcional(filtros.eps),
    patologia: textoOpcional(filtros.patologia),
    profesional: textoOpcional(filtros.profesional),
    cuidador: textoOpcional(filtros.cuidador),
    programa: textoOpcional(filtros.programa),
    municipio: textoOpcional(filtros.municipio),
    estado: textoOpcional(filtros.estado),
    rapidos: { ...filtros.rapidos },
  };
}

/** Textos de la persona sobre los que opera la búsqueda flexible (§4.1). */
function textosBuscables(paciente: PoblacionPaciente): readonly string[] {
  return [paciente.nombre, paciente.documento, paciente.id];
}

/**
 * `true` cuando la persona satisface TODOS los criterios activos.
 *
 * Los filtros se combinan con AND. Dentro de la persona, los valores
 * multivalor coinciden con OR: basta una patología, un programa o un cuidador
 * que cumpla. `Sin asignar` es un valor legítimo de profesional y de cuidador.
 */
export function coincide(
  paciente: PoblacionPaciente,
  filtros: PoblacionFiltrosNormalizados,
  corte?: string,
): boolean {
  if (filtros.texto !== '') {
    const encontrado = textosBuscables(paciente).some((valor) =>
      normalizar(valor).includes(filtros.texto),
    );

    if (!encontrado) {
      return false;
    }
  }

  const edad = edadEnCorte(paciente.nacimiento, corte);

  /* El rango de edad es inclusivo en ambos extremos. */
  if (filtros.edadMin !== null && edad < filtros.edadMin) {
    return false;
  }

  if (filtros.edadMax !== null && edad > filtros.edadMax) {
    return false;
  }

  if (filtros.condicion !== null && !prioridadesDe(paciente, corte).includes(filtros.condicion)) {
    return false;
  }

  if (filtros.eps !== null && paciente.afiliacion.eps !== filtros.eps) {
    return false;
  }

  if (filtros.patologia !== null && !patologiasActivas(paciente).includes(filtros.patologia)) {
    return false;
  }

  if (filtros.profesional !== null) {
    const responsable = profesionalResponsable(paciente);
    const nombre = responsable?.nombre ?? POBLACION_SIN_ASIGNAR;

    if (nombre !== filtros.profesional) {
      return false;
    }
  }

  if (filtros.cuidador !== null) {
    const vigentes = cuidadoresVigentes(paciente);
    const coincideCuidador =
      filtros.cuidador === POBLACION_SIN_ASIGNAR
        ? vigentes.length === 0
        : vigentes.some((vinculo) => vinculo.relacion === filtros.cuidador);

    if (!coincideCuidador) {
      return false;
    }
  }

  if (filtros.programa !== null) {
    const coincidePrograma =
      filtros.programa === POBLACION_SIN_ASIGNAR
        ? paciente.programas.length === 0
        : paciente.programas.includes(filtros.programa);

    if (!coincidePrograma) {
      return false;
    }
  }

  if (filtros.municipio !== null && paciente.municipio !== filtros.municipio) {
    return false;
  }

  if (filtros.estado !== null && paciente.estado !== filtros.estado) {
    return false;
  }

  /* Los tres chips son independientes y se exigen todos los que estén activos. */
  if (filtros.rapidos.mayor60 && !esMayorDe60(paciente, corte)) {
    return false;
  }

  if (filtros.rapidos.discapacidad && !tieneDiscapacidad(paciente)) {
    return false;
  }

  if (filtros.rapidos.cuidadosCasa && !requiereCuidadosEnCasa(paciente)) {
    return false;
  }

  return true;
}

/** Conjunto filtrado. El contador se calcula sobre él, antes de paginar (§5). */
export function filtrarPacientes(
  pacientes: readonly PoblacionPaciente[],
  filtros: PoblacionFiltros,
  corte?: string,
): readonly PoblacionPaciente[] {
  const normalizados = normalizarFiltros(filtros);

  return pacientes.filter((paciente) => coincide(paciente, normalizados, corte));
}

/* ========================================================================== */
/* Orden y paginación                                                         */
/* ========================================================================== */

/** Clave de comparación de cada criterio de orden. */
function clave(paciente: PoblacionPaciente, orden: PoblacionOrdenId, corte?: string): string {
  switch (orden) {
    case 'edad':
      return String(edadEnCorte(paciente.nacimiento, corte)).padStart(3, '0');
    case 'proxima':
      /* Sin próxima atención va al final del orden ascendente. */
      return paciente.proximaAtencion === null
        ? '9999-99-99 99:99'
        : `${paciente.proximaAtencion.fecha} ${paciente.proximaAtencion.hora}`;
    case 'estado':
      return paciente.estado;
    case 'nombre':
    default:
      return paciente.nombre;
  }
}

/**
 * Ordena una copia del conjunto. El nombre desempata siempre, de modo que el
 * orden es total y estable frente a valores repetidos.
 */
export function ordenarPacientes(
  pacientes: readonly PoblacionPaciente[],
  orden: PoblacionOrdenId,
  sentido: PoblacionSentido,
  corte?: string,
): readonly PoblacionPaciente[] {
  const signo = sentido === 'desc' ? -1 : 1;

  return [...pacientes].sort((a, b) => {
    const comparacion = clave(a, orden, corte).localeCompare(clave(b, orden, corte), 'es-CO');

    if (comparacion !== 0) {
      return comparacion * signo;
    }

    return a.nombre.localeCompare(b.nombre, 'es-CO');
  });
}

/** Recorte de página, con su rango visible y su total de páginas. */
export interface PoblacionPagina {
  readonly pagina: number;
  readonly paginas: number;
  readonly desde: number;
  readonly hasta: number;
  readonly total: number;
  readonly filas: readonly PoblacionPaciente[];
}

/**
 * Página solicitada, corregida de forma determinista: si un filtro deja la
 * página fuera de rango, se muestra la última existente en lugar de una vista
 * vacía sin explicación (§4.4).
 */
export function paginar(
  pacientes: readonly PoblacionPaciente[],
  pagina: number,
  tamano: number = POBLACION_TAMANO_PAGINA_INICIAL,
): PoblacionPagina {
  const total = pacientes.length;
  const paginas = Math.max(1, Math.ceil(total / tamano));
  const actual = Math.min(Math.max(1, pagina), paginas);
  const inicio = (actual - 1) * tamano;
  const filas = pacientes.slice(inicio, inicio + tamano);

  return {
    pagina: actual,
    paginas,
    desde: total === 0 ? 0 : inicio + 1,
    hasta: inicio + filas.length,
    total,
    filas,
  };
}

/* ========================================================================== */
/* Opciones de los selectores                                                 */
/* ========================================================================== */

/** Valores únicos ordenados alfabéticamente en español. */
function unicos(valores: readonly string[]): readonly string[] {
  return [...new Set(valores)].sort((a, b) => a.localeCompare(b, 'es-CO'));
}

/** Opciones de cada selector, derivadas del universo y no escritas a mano. */
export interface PoblacionOpciones {
  readonly condicion: readonly string[];
  readonly eps: readonly string[];
  readonly patologia: readonly string[];
  readonly profesional: readonly string[];
  readonly cuidador: readonly string[];
  readonly programa: readonly string[];
  readonly municipio: readonly string[];
  readonly estado: readonly string[];
}

export function opcionesDeFiltro(pacientes: readonly PoblacionPaciente[]): PoblacionOpciones {
  return {
    condicion: [
      POBLACION_ETIQUETA_PRIORIDAD.MAYOR_60,
      POBLACION_ETIQUETA_PRIORIDAD.DISABILITY,
      POBLACION_ETIQUETA_PRIORIDAD.HOME_CARE_REQUIRED,
    ],
    eps: unicos(pacientes.map((paciente) => paciente.afiliacion.eps)),
    patologia: unicos(pacientes.flatMap((paciente) => patologiasActivas(paciente))),
    profesional: [
      ...unicos(
        pacientes
          .map((paciente) => profesionalResponsable(paciente)?.nombre)
          .filter((nombre): nombre is string => nombre !== undefined),
      ),
      POBLACION_SIN_ASIGNAR,
    ],
    cuidador: [
      ...unicos(
        pacientes.flatMap((paciente) =>
          cuidadoresVigentes(paciente).map((vinculo) => vinculo.relacion),
        ),
      ),
      POBLACION_SIN_ASIGNAR,
    ],
    programa: [
      ...unicos(pacientes.flatMap((paciente) => paciente.programas)),
      POBLACION_SIN_ASIGNAR,
    ],
    municipio: unicos(pacientes.map((paciente) => paciente.municipio)),
    estado: unicos(pacientes.map((paciente) => paciente.estado)),
  };
}

/* ========================================================================== */
/* Definiciones métricas versionadas                                          */
/* ========================================================================== */

/** Porcentaje sobre el universo; `null` cuando el denominador es cero (§6). */
export function porcentaje(parte: number, universo: number): number | null {
  return universo === 0 ? null : (parte / universo) * 100;
}

/*
 * `textoPorcentaje` y `formatearNumero` se REEXPORTAN desde
 * `hospitalPopulationTypes.ts`, que no importa el fixture de población.
 *
 * TASK-HOSPITAL-CORE-01 §10.2 prohíbe que el árbol renderizado de Hospital →
 * Pacientes alcance `hospitalPopulationFixtures.ts`, y este módulo lo importa
 * para sus constantes de escenario. Moviéndolos allí, la vista conectada a
 * PostgreSQL puede usarlos sin arrastrar datos demostrativos, y Reportes (H-07)
 * y el resto de consumidores siguen importándolos de aquí sin cambio alguno.
 *
 * Es un traslado, NO una duplicación: sigue existiendo una sola implementación
 * de cada regla de formato.
 */
export { formatearNumero, textoPorcentaje } from './hospitalPopulationTypes';

/** Conteo de pacientes únicos que satisfacen un predicado. */
function contar(
  pacientes: readonly PoblacionPaciente[],
  predicado: (paciente: PoblacionPaciente) => boolean,
): number {
  return pacientes.filter((paciente) => predicado(paciente)).length;
}

/** Los seis KPI compactos, en el orden vinculante de la Task (§4.1). */
export function kpiDe(
  pacientes: readonly PoblacionPaciente[],
  corte?: string,
): readonly PoblacionKpi[] {
  const universo = pacientes.length;
  const definiciones: readonly (readonly [string, string, (p: PoblacionPaciente) => boolean])[] = [
    ['activePatients', 'Pacientes activos', () => true],
    ['age60Plus', 'Mayores de 60', (paciente) => esMayorDe60(paciente, corte)],
    ['withDisability', 'Con discapacidad', tieneDiscapacidad],
    ['homeCareRequired', 'Cuidados en casa', requiereCuidadosEnCasa],
    ['withoutCaregiver', 'Sin cuidador', sinCuidador],
    ['withoutResponsibleProfessional', 'Sin profesional', sinProfesionalResponsable],
  ];

  return definiciones.map(([id, etiqueta, predicado]) => {
    const valor = contar(pacientes, predicado);

    return { id, etiqueta, valor, porcentaje: porcentaje(valor, universo) };
  });
}

/** Celdas de una distribución, con su porcentaje sobre el universo. */
function celdasDe(
  conteo: ReadonlyMap<string, number>,
  universo: number,
  orden?: readonly string[],
): readonly PoblacionCelda[] {
  const entradas =
    orden === undefined
      ? [...conteo.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es-CO'))
      : orden.map((clave): readonly [string, number] => [clave, conteo.get(clave) ?? 0]);

  return entradas.map(([etiqueta, valor]) => ({
    id: etiqueta,
    etiqueta,
    valor,
    porcentaje: porcentaje(valor, universo),
  }));
}

/** Acumula un valor por clave dentro de un mapa de conteo. */
function acumular(conteo: Map<string, number>, clave: string): void {
  conteo.set(clave, (conteo.get(clave) ?? 0) + 1);
}

/** Número de patologías del listado «más frecuentes» (§4.1, punto 8). */
export const POBLACION_TOP_PATOLOGIAS = 8;

/**
 * Distribuciones de la columna analítica, en el orden vinculante.
 *
 * La frecuencia de patología cuenta PACIENTES ÚNICOS vinculados, no registros:
 * una persona cuenta una sola vez por patología y puede contar en varias. Por
 * eso las celdas de esa distribución no suman el universo y su nota lo dice.
 */
export function distribucionesDe(
  pacientes: readonly PoblacionPaciente[],
  corte?: string,
): readonly PoblacionDistribucion[] {
  const universo = pacientes.length;
  const edades = new Map<string, number>();
  const patologias = new Map<string, number>();
  const eps = new Map<string, number>();
  const municipios = new Map<string, number>();
  const programas = new Map<string, number>();
  let conCuidador = 0;
  let conProfesional = 0;

  for (const paciente of pacientes) {
    acumular(edades, rangoDeEdad(edadEnCorte(paciente.nacimiento, corte)));
    acumular(eps, paciente.afiliacion.eps);
    acumular(municipios, paciente.municipio);

    for (const patologia of patologiasActivas(paciente)) {
      acumular(patologias, patologia);
    }

    if (paciente.programas.length === 0) {
      acumular(programas, POBLACION_SIN_ASIGNAR);
    }

    for (const programa of new Set(paciente.programas)) {
      acumular(programas, programa);
    }

    if (!sinCuidador(paciente)) {
      conCuidador += 1;
    }

    if (!sinProfesionalResponsable(paciente)) {
      conProfesional += 1;
    }
  }

  const etiquetasEdad = POBLACION_RANGOS_EDAD.map((rango) => rango.id);
  const celdasEdad = celdasDe(edades, universo, etiquetasEdad).map((celda, indice) => ({
    ...celda,
    etiqueta: POBLACION_RANGOS_EDAD[indice]?.etiqueta ?? celda.etiqueta,
  }));

  return [
    {
      id: 'rangos-edad',
      titulo: 'Rangos de edad',
      nota: 'Tramos excluyentes derivados de la fecha de nacimiento. Suman el total de pacientes activos.',
      celdas: celdasEdad,
    },
    {
      id: 'patologias',
      titulo: 'Patologías más frecuentes',
      nota: 'Pacientes únicos con la condición registrada. Una persona puede aparecer en varias condiciones, por lo que estas cifras no suman el total.',
      celdas: celdasDe(patologias, universo).slice(0, POBLACION_TOP_PATOLOGIAS),
    },
    {
      id: 'eps',
      titulo: 'EPS',
      nota: 'Afiliación vigente registrada. Cada persona cuenta una sola vez.',
      celdas: celdasDe(eps, universo),
    },
    {
      id: 'municipio',
      titulo: 'Municipio y zona',
      nota: 'Municipio de residencia registrado. Cada persona cuenta una sola vez.',
      celdas: celdasDe(municipios, universo),
    },
    {
      id: 'programas',
      titulo: 'Programas',
      nota: 'Participación registrada. Una persona puede participar en varios programas, por lo que estas cifras no suman el total.',
      celdas: celdasDe(programas, universo),
    },
    {
      id: 'cuidador',
      titulo: 'Cuidador asignado',
      nota: 'Relación paciente-cuidador activa y vigente. Las dos celdas suman el total.',
      celdas: [
        {
          id: 'con-cuidador',
          etiqueta: 'Con cuidador',
          valor: conCuidador,
          porcentaje: porcentaje(conCuidador, universo),
        },
        {
          id: 'sin-cuidador',
          etiqueta: 'Sin cuidador',
          valor: universo - conCuidador,
          porcentaje: porcentaje(universo - conCuidador, universo),
        },
      ],
    },
    {
      id: 'profesional',
      titulo: 'Profesional asignado',
      nota: 'Asignación principal activa y vigente. Las dos celdas suman el total.',
      celdas: [
        {
          id: 'con-profesional',
          etiqueta: 'Con profesional',
          valor: conProfesional,
          porcentaje: porcentaje(conProfesional, universo),
        },
        {
          id: 'sin-profesional',
          etiqueta: 'Sin profesional',
          valor: universo - conProfesional,
          porcentaje: porcentaje(universo - conProfesional, universo),
        },
      ],
    },
  ];
}

/**
 * Las ocho celdas disjuntas de la matriz de intersecciones (§6).
 *
 * A = mayor de 60, B = discapacidad, C = cuidados en casa. Cada persona cae en
 * exactamente una celda, de modo que la suma de las ocho reconcilia el universo
 * y nunca duplica a nadie. Los KPI solapados NO deben sumarse para obtener la
 * población total.
 */
export function interseccionesDe(
  pacientes: readonly PoblacionPaciente[],
  corte?: string,
): readonly PoblacionInterseccion[] {
  const definiciones: readonly (readonly [string, string, boolean, boolean, boolean])[] = [
    ['solo-60', 'Solo 60+', true, false, false],
    ['60-discapacidad', '60+ y discapacidad', true, true, false],
    ['60-cuidados', '60+ y cuidados en casa', true, false, true],
    ['discapacidad-cuidados', 'Discapacidad y cuidados en casa', false, true, true],
    ['las-tres', 'Las tres condiciones', true, true, true],
    ['solo-discapacidad', 'Solo discapacidad', false, true, false],
    ['solo-cuidados', 'Solo cuidados en casa', false, false, true],
    ['ninguna', 'Ninguna de las tres', false, false, false],
  ];
  const universo = pacientes.length;
  const conteo = new Map<string, number>();

  for (const paciente of pacientes) {
    const a = esMayorDe60(paciente, corte);
    const b = tieneDiscapacidad(paciente);
    const c = requiereCuidadosEnCasa(paciente);

    acumular(conteo, `${String(a)}|${String(b)}|${String(c)}`);
  }

  return definiciones.map(([id, etiqueta, mayor60, discapacidad, cuidadosCasa]) => {
    const valor =
      conteo.get(`${String(mayor60)}|${String(discapacidad)}|${String(cuidadosCasa)}`) ?? 0;

    return {
      id,
      etiqueta,
      mayor60,
      discapacidad,
      cuidadosCasa,
      valor,
      porcentaje: porcentaje(valor, universo),
    };
  });
}

/* ========================================================================== */
/* Snapshot compartido                                                        */
/* ========================================================================== */

/**
 * `PopulationAnalyticsSnapshotV1` para el conjunto ya filtrado (§6).
 *
 * H-03B lo consume para pintar KPI, gráficos y matriz; H-07 debe consumir esta
 * misma función y este mismo fixture en lugar de recalcular nada. Los valores
 * son dato demostrativo: no son estadística oficial, no proceden de ninguna
 * fuente institucional y no acreditan cumplimiento de ninguna obligación.
 */
export function snapshotDePoblacion(
  pacientes: readonly PoblacionPaciente[],
  filtros: PoblacionFiltros = POBLACION_FILTROS_VACIOS,
  corte: string = POBLACION_FECHA_CORTE,
): PopulationAnalyticsSnapshotV1 {
  return {
    version: POBLACION_VERSION_DEFINICION,
    contexto: {
      tenantId: POBLACION_TENANT_DEMO,
      institucion: POBLACION_INSTITUCION_DEMO,
      municipioSede: POBLACION_MUNICIPIO_SEDE,
    },
    fechaCorte: corte,
    filtros: normalizarFiltros(filtros),
    universo: pacientes.length,
    kpi: kpiDe(pacientes, corte),
    distribuciones: distribucionesDe(pacientes, corte),
    intersecciones: interseccionesDe(pacientes, corte),
    procedencia: {
      clase: 'DATO DEMOSTRATIVO',
      origen: 'Conjunto ficticio local de la experiencia Hospital',
      nota: 'Cifras de demostración. No proceden de ninguna fuente oficial, de ninguna EPS ni de ninguna historia clínica.',
    },
    calculatedAt: POBLACION_CALCULATED_AT,
  };
}

/**
 * Snapshot agregado que una futura salida a Alcaldía podría consumir (§8).
 *
 * Devuelve exactamente el mismo contrato sin ninguna referencia nominal: es
 * agregado por construcción. NO existe hoy ninguna vista, ruta, exportación ni
 * canal que lo entregue, y publicarlo requerirá una política aprobada de
 * grupos pequeños, autorización server-side y auditoría.
 */
export function snapshotAgregadoParaAlcaldia(
  pacientes: readonly PoblacionPaciente[],
  corte?: string,
): PopulationAnalyticsSnapshotV1 {
  return snapshotDePoblacion(pacientes, POBLACION_FILTROS_VACIOS, corte);
}
