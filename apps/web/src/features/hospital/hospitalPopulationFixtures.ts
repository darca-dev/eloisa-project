import {
  POBLACION_EDAD_MAYOR,
  type PoblacionAsignacionProfesional,
  type PoblacionAtencion,
  type PoblacionClasificacionRegistro,
  type PoblacionCondicionRegistro,
  type PoblacionCuidadorVinculo,
  type PoblacionPaciente,
  type PoblacionProcedencia,
  type PoblacionSemaforo,
  type PoblacionTono,
} from './hospitalPopulationTypes';

/**
 * Conjunto demostrativo de población atendida (TASK-003H-03B, §12).
 *
 * Genera de forma DETERMINISTA más de 3.000 personas ficticias con
 * identificadores únicos y con casos que cubren 0, 1, 2 y 3 clasificaciones
 * prioritarias, varias patologías, varios cuidadores y ausencias de asignación.
 *
 * Determinismo: la secuencia procede de un generador congruente sembrado con
 * una constante. No se usa `Math.random` ni la fecha del sistema, de modo que
 * dos ejecuciones producen exactamente el mismo conjunto y las pruebas pueden
 * comparar totales exactos.
 *
 * TODOS los datos son ficticios. No proceden de ninguna persona real, de
 * ninguna EPS, de ninguna historia clínica ni de ninguna integración: las
 * patologías son información registrada de escenario, no diagnósticos, y el
 * semáforo es un texto del propio fixture, no una regla clínica evaluada.
 *
 * Este módulo es la fuente ÚNICA de datos de población: `Pacientes` (H-03B) y
 * `Reportes` (H-07) deben consumir `pacientesPoblacionDemo()` y no duplicar
 * fixtures paralelos.
 */

/* ========================================================================== */
/* Contexto del conjunto                                                      */
/* ========================================================================== */

/** Tenant demostrativo. No es un identificador productivo ni un secreto. */
export const POBLACION_TENANT_DEMO = 'demo-hospital-san-rafael';

/** Institución del escenario, coherente con el shell Hospital. */
export const POBLACION_INSTITUCION_DEMO = 'Hospital San Rafael';

export const POBLACION_MUNICIPIO_SEDE = 'Soacha';

/**
 * Fecha de corte del conjunto, con formato AAAA-MM-DD. Toda edad se deriva de
 * ella: el fixture no almacena edades y no existe un valor manual que pueda
 * contradecir la fecha de nacimiento (§6).
 */
export const POBLACION_FECHA_CORTE = '2026-08-20';

/** Fecha de corte redactada para la interfaz. */
export const POBLACION_FECHA_CORTE_TEXTO = 'Corte 20 de agosto de 2026';

/**
 * Marca de cálculo del snapshot. Es una constante del fixture: el módulo no
 * lee la fecha del sistema y la marca no acredita ninguna ejecución real.
 */
export const POBLACION_CALCULATED_AT = '2026-08-20T06:00:00-05:00';

/** Número de personas generadas, antes de aplicar el universo. */
export const POBLACION_TOTAL_GENERADO = 3240;

/** Semilla del generador. Cambiarla cambia el conjunto completo. */
const SEMILLA = 20260820;

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

/* ========================================================================== */
/* Catálogos ficticios                                                        */
/* ========================================================================== */

const NOMBRES: readonly string[] = [
  'María',
  'José',
  'Ana',
  'Carlos',
  'Luz',
  'Jorge',
  'Rosa',
  'Pedro',
  'Gloria',
  'Miguel',
  'Marta',
  'Álvaro',
  'Beatriz',
  'Hernán',
  'Consuelo',
  'Fabio',
  'Esperanza',
  'Ramiro',
  'Teresa',
  'Gustavo',
  'Amparo',
  'Efraín',
  'Blanca',
  'Nelson',
  'Dora',
  'Óscar',
  'Aracely',
  'Wilson',
  'Nubia',
  'Édgar',
  'Yolanda',
  'Camilo',
  'Sandra',
  'Andrés',
  'Paula',
  'Julián',
  'Diana',
  'Sebastián',
  'Laura',
  'Mateo',
  'Valentina',
  'Santiago',
  'Isabela',
  'Emilio',
  'Lucía',
  'Tomás',
  'Antonia',
  'Samuel',
];

const APELLIDOS_1: readonly string[] = [
  'Gómez',
  'Rodríguez',
  'Martínez',
  'López',
  'Sánchez',
  'Ramírez',
  'Torres',
  'Flórez',
  'Rivera',
  'Castro',
  'Vargas',
  'Rojas',
  'Moreno',
  'Muñoz',
  'Álvarez',
  'Romero',
  'Suárez',
  'Herrera',
  'Aguilar',
  'Medina',
  'Cárdenas',
  'Peña',
  'Guerrero',
  'Salazar',
  'Mejía',
  'Bermúdez',
  'Quintero',
  'Zapata',
  'Cifuentes',
  'Beltrán',
  'Naranjo',
  'Pardo',
  'Ossa',
  'Lozano',
  'Bustos',
  'Camargo',
  'Duarte',
  'Escobar',
  'Fajardo',
  'Galindo',
];

const APELLIDOS_2: readonly string[] = [
  'Osorio',
  'Pérez',
  'Díaz',
  'Cortés',
  'Ríos',
  'Prieto',
  'Bonilla',
  'Cuervo',
  'Amaya',
  'Solano',
  'Rincón',
  'Vega',
  'Mora',
  'Cano',
  'Silva',
  'Arias',
  'Franco',
  'Buitrago',
  'Sierra',
  'Ávila',
  'Barrera',
  'Chaparro',
  'Delgado',
  'Espinosa',
  'Forero',
  'Granados',
  'Hurtado',
  'Ibarra',
  'Jiménez',
  'Leal',
  'Marín',
  'Nieto',
  'Olarte',
  'Parra',
  'Quiroga',
  'Reyes',
  'Sepúlveda',
  'Tovar',
  'Urrego',
  'Velásquez',
];

/**
 * EPS del escenario. Salvo `Nueva EPS`, que ya figura en los fixtures Hospital
 * aprobados, son denominaciones inventadas para la demostración: ninguna
 * describe una entidad real, una afiliación real ni una integración existente.
 */
const EPS: readonly string[] = [
  'Nueva EPS',
  'EPS Salud Andina',
  'EPS Vida Integral',
  'EPS Prevención Total',
  'EPS Horizonte Sur',
  'EPS Confiar Salud',
];

/**
 * Patologías/condiciones registradas del escenario. Son información
 * REGISTRADA con procedencia ficticia: no son diagnósticos emitidos por la
 * plataforma, no se infieren y no habilitan ninguna decisión clínica.
 */
const PATOLOGIAS: readonly string[] = [
  'Hipertensión arterial',
  'Diabetes tipo 2',
  'Enfermedad renal crónica',
  'Enfermedad pulmonar obstructiva crónica',
  'Insuficiencia cardíaca',
  'Artrosis',
  'Secuelas de evento cerebrovascular',
  'Deterioro cognitivo',
  'Cáncer en seguimiento',
  'Obesidad',
  'Depresión',
  'Osteoporosis',
  'Asma',
  'Enfermedad de Parkinson',
  'Úlceras por presión',
  'Hipotiroidismo',
];

const PROGRAMAS: readonly string[] = [
  'Atención domiciliaria',
  'Crónicos',
  'Rehabilitación funcional',
  'Cuidado paliativo',
  'Salud mental comunitaria',
  'Materno perinatal',
  'Niñez y adolescencia',
];

const MUNICIPIOS: readonly string[] = [
  'Soacha',
  'Sibaté',
  'Granada',
  'Silvania',
  'San Antonio del Tequendama',
];

const ZONAS: readonly string[] = [
  'Comuna 1',
  'Comuna 2',
  'Comuna 3',
  'Comuna 4',
  'Comuna 5',
  'Comuna 6',
  'Zona rural',
];

/** Profesionales del escenario; los cuatro primeros existen en Profesionales. */
const PROFESIONALES: readonly { readonly nombre: string; readonly profesion: string }[] = [
  { nombre: 'Dra. Laura Gómez', profesion: 'Medicina general' },
  { nombre: 'Enf. Carlos Ruiz', profesion: 'Enfermería' },
  { nombre: 'Ft. Diana Salas', profesion: 'Fisioterapia' },
  { nombre: 'Dr. Juan Pérez', profesion: 'Medicina general' },
  { nombre: 'Dra. Marcela Ríos', profesion: 'Medicina interna' },
  { nombre: 'Enf. Sofía Cárdenas', profesion: 'Enfermería' },
  { nombre: 'Dr. Andrés Peña', profesion: 'Geriatría' },
  { nombre: 'Ps. Natalia Franco', profesion: 'Psicología' },
  { nombre: 'Ft. Julián Amaya', profesion: 'Fisioterapia' },
  { nombre: 'Nut. Paola Nieto', profesion: 'Nutrición' },
  { nombre: 'Dra. Clara Bonilla', profesion: 'Medicina familiar' },
  { nombre: 'Enf. Diego Solano', profesion: 'Enfermería' },
];

const RELACIONES_CUIDADOR: readonly string[] = [
  'hija',
  'hijo',
  'cónyuge',
  'hermana',
  'nieta',
  'sobrino',
  'vecina',
  'cuidadora formal',
];

const ESTADOS: readonly string[] = ['Activo', 'En seguimiento', 'En control', 'En alta domiciliaria'];

const SEMAFOROS: readonly PoblacionSemaforo[] = [
  {
    etiqueta: 'Verde',
    texto: 'Verde · sin novedades registradas',
    tono: 'verde',
  },
  {
    etiqueta: 'Amarillo',
    texto: 'Amarillo · requiere seguimiento',
    tono: 'amarillo',
  },
  {
    etiqueta: 'Rojo',
    texto: 'Rojo · atención prioritaria registrada',
    tono: 'rojo',
  },
];

const MODALIDADES: readonly string[] = [
  'Visita domiciliaria',
  'Consulta virtual',
  'Cita presencial',
];

const ESTADOS_ATENCION: readonly { readonly estado: string; readonly tono: PoblacionTono }[] = [
  { estado: 'Finalizada', tono: 'verde' },
  { estado: 'Programada', tono: 'azul' },
  { estado: 'Reprogramada', tono: 'amarillo' },
  { estado: 'En revisión', tono: 'petroleo' },
];

/** Fuentes ficticias de procedencia. Ninguna describe una integración real. */
const FUENTES: readonly string[] = [
  'Registro institucional demostrativo',
  'Inscripción domiciliaria demostrativa',
  'Reporte del equipo de campo (demostrativo)',
];

/* ========================================================================== */
/* Utilidades del generador                                                   */
/* ========================================================================== */

/** Elemento de un catálogo según el siguiente valor de la secuencia. */
function elegir<T>(lista: readonly T[], siguiente: () => number): T {
  const indice = Math.floor(siguiente() * lista.length) % lista.length;

  /* La lista nunca está vacía: los catálogos son constantes de este módulo. */
  return lista[indice] as T;
}

/** Entero entre `min` y `max`, ambos incluidos. */
function entero(siguiente: () => number, min: number, max: number): number {
  return min + Math.floor(siguiente() * (max - min + 1));
}

/** Fecha AAAA-MM-DD compuesta con sus tres partes ya validadas por rango. */
function fecha(anio: number, mes: number, dia: number): string {
  const mm = String(mes).padStart(2, '0');
  const dd = String(dia).padStart(2, '0');

  return `${String(anio)}-${mm}-${dd}`;
}

/** Iniciales de un nombre compuesto, para el avatar textual del listado. */
function inicialesDe(nombre: string, apellido: string): string {
  return `${nombre.slice(0, 1)}${apellido.slice(0, 1)}`.toLocaleUpperCase('es-CO');
}

/** Documento ficticio con formato colombiano; nunca es un documento real. */
function documentoDe(indice: number, siguiente: () => number): string {
  const base = 10000000 + indice * 613 + entero(siguiente, 0, 599);
  const texto = String(base);

  return `CC ${texto.slice(0, 2)}.${texto.slice(2, 5)}.${texto.slice(5)}`;
}

/** Teléfono ficticio de contacto. */
function telefonoDe(siguiente: () => number): string {
  return `3${String(entero(siguiente, 10, 24))} ${String(entero(siguiente, 100, 999))} ${String(
    entero(siguiente, 1000, 9999),
  )}`;
}

/** Procedencia ficticia con fuente, fecha y estado. */
function procedenciaDe(siguiente: () => number): PoblacionProcedencia {
  return {
    fuente: elegir(FUENTES, siguiente),
    fecha: fecha(entero(siguiente, 2024, 2026), entero(siguiente, 1, 12), entero(siguiente, 1, 28)),
    estado: elegir(['Vigente', 'En revisión'], siguiente),
  };
}

/**
 * Año de nacimiento que sitúa a la persona en la edad objetivo respecto de la
 * fecha de corte. El mes y el día se eligen dentro del año para que la edad
 * derivada sea exactamente la buscada y no dependa de un valor almacenado.
 */
function nacimientoParaEdad(edad: number, siguiente: () => number): string {
  const [anioCorte = 0, mesCorte = 1, diaCorte = 1] = POBLACION_FECHA_CORTE.split('-').map(Number);
  const cumplido = siguiente() < 0.62;

  if (cumplido) {
    /* Ya cumplió años este año: nace antes del corte dentro del año. */
    const mes = entero(siguiente, 1, Math.max(1, mesCorte - 1));

    return fecha(anioCorte - edad, mes, entero(siguiente, 1, 28));
  }

  /* Aún no cumple: nace después del corte, así que resta un año al calendario. */
  const mes = entero(siguiente, Math.min(12, mesCorte + 1), 12);

  return fecha(anioCorte - edad - 1, mes, Math.min(28, Math.max(1, diaCorte)));
}

/**
 * Edad objetivo del conjunto. La distribución está sesgada hacia la población
 * mayor porque el escenario es de atención domiciliaria, pero conserva tramos
 * pediátricos y adultos jóvenes para que los seis rangos tengan datos.
 */
function edadObjetivo(siguiente: () => number): number {
  const dado = siguiente();

  if (dado < 0.08) {
    return entero(siguiente, 1, 17);
  }

  if (dado < 0.2) {
    return entero(siguiente, 18, 39);
  }

  if (dado < 0.36) {
    return entero(siguiente, 40, 59);
  }

  if (dado < 0.68) {
    return entero(siguiente, 60, 74);
  }

  if (dado < 0.89) {
    return entero(siguiente, 75, 84);
  }

  return entero(siguiente, 85, 99);
}

/* ========================================================================== */
/* Composición de una persona                                                 */
/* ========================================================================== */

/** Clasificaciones registradas. Pueden ser ninguna, una o las dos. */
function clasificacionesDe(
  siguiente: () => number,
  edad: number,
): readonly PoblacionClasificacionRegistro[] {
  const registros: PoblacionClasificacionRegistro[] = [];
  /* La probabilidad crece con la edad; sigue habiendo casos en toda edad. */
  const sesgo = edad >= POBLACION_EDAD_MAYOR ? 0.18 : 0;

  if (siguiente() < 0.24 + sesgo) {
    registros.push({
      tipo: 'DISABILITY',
      activa: true,
      desde: fecha(entero(siguiente, 2018, 2025), entero(siguiente, 1, 12), entero(siguiente, 1, 28)),
      hasta: null,
      procedencia: procedenciaDe(siguiente),
    });
  }

  if (siguiente() < 0.27 + sesgo) {
    registros.push({
      tipo: 'HOME_CARE_REQUIRED',
      activa: true,
      desde: fecha(entero(siguiente, 2021, 2026), entero(siguiente, 1, 12), entero(siguiente, 1, 28)),
      hasta: null,
      procedencia: procedenciaDe(siguiente),
    });
  }

  /* Un pequeño grupo conserva una clasificación cerrada: ya no es vigente. */
  if (siguiente() < 0.05) {
    registros.push({
      tipo: 'HOME_CARE_REQUIRED',
      activa: false,
      desde: fecha(2019, entero(siguiente, 1, 12), entero(siguiente, 1, 28)),
      hasta: fecha(2023, entero(siguiente, 1, 12), entero(siguiente, 1, 28)),
      procedencia: procedenciaDe(siguiente),
    });
  }

  return registros;
}

/**
 * Condiciones registradas. Una persona puede tener varias y como máximo una
 * relación activa marcada como principal; parte del conjunto no tiene ninguna
 * marcada, de modo que la vista debe escribir «Sin condición principal
 * registrada» en lugar de elegir una por frecuencia.
 */
function condicionesDe(
  siguiente: () => number,
  edad: number,
): readonly PoblacionCondicionRegistro[] {
  const cantidad = edad >= POBLACION_EDAD_MAYOR ? entero(siguiente, 0, 4) : entero(siguiente, 0, 2);
  const nombres = new Set<string>();

  for (let i = 0; i < cantidad; i += 1) {
    nombres.add(elegir(PATOLOGIAS, siguiente));
  }

  const lista = [...nombres];
  /* Solo la primera puede quedar marcada como principal, y no siempre. */
  const conPrincipal = lista.length > 0 && siguiente() < 0.82;

  return lista.map((nombre, indice) => ({
    nombre,
    activa: true,
    principal: conPrincipal && indice === 0,
    procedencia: procedenciaDe(siguiente),
  }));
}

/** Cuidadores vinculados. Puede no haber ninguno, o haber hasta tres. */
function cuidadoresDe(siguiente: () => number): readonly PoblacionCuidadorVinculo[] {
  const dado = siguiente();
  const cantidad = dado < 0.19 ? 0 : dado < 0.72 ? 1 : dado < 0.94 ? 2 : 3;
  const vinculos: PoblacionCuidadorVinculo[] = [];

  for (let i = 0; i < cantidad; i += 1) {
    const nombre = `${elegir(NOMBRES, siguiente)} ${elegir(APELLIDOS_1, siguiente)}`;
    /* El tercer vínculo del conjunto se registra ya vencido. */
    const vigente = i < 2 || siguiente() < 0.4;

    vinculos.push({
      nombre,
      relacion: elegir(RELACIONES_CUIDADOR, siguiente),
      contacto: telefonoDe(siguiente),
      activo: true,
      vigente,
    });
  }

  return vinculos;
}

/** Asignaciones de profesional: como máximo una principal vigente. */
function asignacionesDe(siguiente: () => number): readonly PoblacionAsignacionProfesional[] {
  const asignaciones: PoblacionAsignacionProfesional[] = [];
  const tienePrincipal = siguiente() < 0.86;

  if (tienePrincipal) {
    const principal = elegir(PROFESIONALES, siguiente);

    asignaciones.push({ ...principal, principal: true, activa: true, vigente: true });
  }

  if (siguiente() < 0.45) {
    const apoyo = elegir(PROFESIONALES, siguiente);

    if (!asignaciones.some((asignacion) => asignacion.nombre === apoyo.nombre)) {
      asignaciones.push({ ...apoyo, principal: false, activa: true, vigente: true });
    }
  }

  return asignaciones;
}

/** Programas en los que la persona participa. Puede no haber ninguno. */
function programasDe(siguiente: () => number): readonly string[] {
  const cantidad = entero(siguiente, 0, 2);
  const programas = new Set<string>();

  for (let i = 0; i < cantidad; i += 1) {
    programas.add(elegir(PROGRAMAS, siguiente));
  }

  return [...programas];
}

/** Próxima atención prevista; parte del conjunto no tiene ninguna agendada. */
function proximaDe(
  siguiente: () => number,
  indice: number,
  profesional: string,
): PoblacionAtencion | null {
  if (siguiente() < 0.22) {
    return null;
  }

  return {
    id: `prox-${String(indice)}`,
    fecha: fecha(2026, 8, entero(siguiente, 20, 31)),
    hora: `${String(entero(siguiente, 7, 17)).padStart(2, '0')}:${elegir(['00', '15', '30', '45'], siguiente)}`,
    modalidad: elegir(MODALIDADES, siguiente),
    profesional,
    estado: 'Programada',
    tono: 'azul',
  };
}

/** Últimas atenciones registradas, de la más reciente a la más antigua. */
function ultimasDe(
  siguiente: () => number,
  indice: number,
  profesional: string,
): readonly PoblacionAtencion[] {
  const cantidad = entero(siguiente, 0, 3);
  const atenciones: PoblacionAtencion[] = [];

  for (let i = 0; i < cantidad; i += 1) {
    const marca = elegir(ESTADOS_ATENCION, siguiente);

    atenciones.push({
      id: `ult-${String(indice)}-${String(i)}`,
      fecha: fecha(2026, entero(siguiente, 5, 8), entero(siguiente, 1, 19)),
      hora: `${String(entero(siguiente, 7, 17)).padStart(2, '0')}:${elegir(['00', '20', '40'], siguiente)}`,
      modalidad: elegir(MODALIDADES, siguiente),
      profesional,
      estado: marca.estado,
      tono: marca.tono,
    });
  }

  return atenciones;
}

/* ========================================================================== */
/* Conjunto completo                                                          */
/* ========================================================================== */

/**
 * Persona fija del escenario Hospital. Conserva la identidad, la EPS, el
 * municipio y las tres clasificaciones de la ficha ya aprobada en
 * TASK-003H-03, de modo que `Profesionales` y `Pacientes` siguen describiendo
 * a la misma persona demostrativa.
 */
function pacienteDeReferencia(): PoblacionPaciente {
  const procedencia: PoblacionProcedencia = {
    fuente: 'Registro institucional demostrativo',
    fecha: '2026-08-14',
    estado: 'Vigente',
  };

  return {
    id: 'pac-000001',
    tenantId: POBLACION_TENANT_DEMO,
    nombre: 'María Gómez Osorio',
    iniciales: 'MG',
    documento: 'CC 24.556.812',
    /* 76 años cumplidos a la fecha de corte. */
    nacimiento: '1950-03-11',
    contacto: '310 445 8821',
    municipio: 'Soacha',
    zona: 'Comuna 4',
    participacion: 'active',
    estado: 'En seguimiento',
    semaforo: {
      etiqueta: 'Amarillo',
      texto: 'Amarillo · requiere seguimiento',
      tono: 'amarillo',
    },
    afiliacion: { eps: 'Nueva EPS', desde: '2019-02-01', estado: 'Vigente' },
    clasificaciones: [
      { tipo: 'DISABILITY', activa: true, desde: '2021-05-04', hasta: null, procedencia },
      { tipo: 'HOME_CARE_REQUIRED', activa: true, desde: '2024-09-16', hasta: null, procedencia },
    ],
    condiciones: [
      { nombre: 'Hipertensión arterial', activa: true, principal: true, procedencia },
      { nombre: 'Artrosis', activa: true, principal: false, procedencia },
    ],
    asignaciones: [
      {
        nombre: 'Dra. Laura Gómez',
        profesion: 'Medicina general',
        principal: true,
        activa: true,
        vigente: true,
      },
      {
        nombre: 'Ft. Diana Salas',
        profesion: 'Fisioterapia',
        principal: false,
        activa: true,
        vigente: true,
      },
    ],
    cuidadores: [
      {
        nombre: 'Ana López',
        relacion: 'hija',
        contacto: '312 887 4410',
        activo: true,
        vigente: true,
      },
      {
        nombre: 'Rosa Marín',
        relacion: 'vecina',
        contacto: '320 551 7788',
        activo: true,
        vigente: true,
      },
    ],
    programas: ['Atención domiciliaria', 'Crónicos'],
    proximaAtencion: {
      id: 'prox-000001',
      fecha: '2026-08-24',
      hora: '10:00',
      modalidad: 'Visita domiciliaria',
      profesional: 'Dra. Laura Gómez',
      estado: 'Programada',
      tono: 'azul',
    },
    ultimasAtenciones: [
      {
        id: 'ult-000001-0',
        fecha: '2026-08-16',
        hora: '10:06',
        modalidad: 'Visita domiciliaria',
        profesional: 'Dra. Laura Gómez',
        estado: 'Finalizada',
        tono: 'verde',
      },
      {
        id: 'ult-000001-1',
        fecha: '2026-08-15',
        hora: '07:42',
        modalidad: 'Seguimiento domiciliario',
        profesional: 'Enf. Carlos Ruiz',
        estado: 'En revisión',
        tono: 'petroleo',
      },
    ],
  };
}

/** Construye una persona del conjunto a partir de la secuencia determinista. */
function construir(indice: number, siguiente: () => number): PoblacionPaciente {
  const nombre = elegir(NOMBRES, siguiente);
  const apellido1 = elegir(APELLIDOS_1, siguiente);
  const apellido2 = elegir(APELLIDOS_2, siguiente);
  const edad = edadObjetivo(siguiente);
  const asignaciones = asignacionesDe(siguiente);
  const principal = asignaciones.find((asignacion) => asignacion.principal);
  const responsable = principal?.nombre ?? elegir(PROFESIONALES, siguiente).nombre;
  /* Una fracción pequeña queda fuera del universo: participación no activa. */
  const activo = siguiente() >= 0.037;

  return {
    id: `pac-${String(indice + 1).padStart(6, '0')}`,
    tenantId: POBLACION_TENANT_DEMO,
    nombre: `${nombre} ${apellido1} ${apellido2}`,
    iniciales: inicialesDe(nombre, apellido1),
    documento: documentoDe(indice, siguiente),
    nacimiento: nacimientoParaEdad(edad, siguiente),
    contacto: telefonoDe(siguiente),
    municipio: elegir(MUNICIPIOS, siguiente),
    zona: elegir(ZONAS, siguiente),
    participacion: activo ? 'active' : 'inactive',
    estado: activo ? elegir(ESTADOS, siguiente) : 'Inactivo',
    semaforo: elegir(SEMAFOROS, siguiente),
    afiliacion: {
      eps: elegir(EPS, siguiente),
      desde: fecha(entero(siguiente, 2015, 2025), entero(siguiente, 1, 12), entero(siguiente, 1, 28)),
      estado: 'Vigente',
    },
    clasificaciones: clasificacionesDe(siguiente, edad),
    condiciones: condicionesDe(siguiente, edad),
    asignaciones,
    cuidadores: cuidadoresDe(siguiente),
    programas: programasDe(siguiente),
    proximaAtencion: proximaDe(siguiente, indice, responsable),
    ultimasAtenciones: ultimasDe(siguiente, indice, responsable),
  };
}

/** Conjunto memorizado: se construye una sola vez por proceso. */
let conjunto: readonly PoblacionPaciente[] | null = null;

/**
 * Conjunto demostrativo completo, incluidas las personas cuya participación no
 * está activa. El universo analítico se obtiene con `universoDe` en
 * `hospitalPopulationAnalytics.ts`; este módulo no decide pertenencia.
 */
export function pacientesPoblacionDemo(): readonly PoblacionPaciente[] {
  if (conjunto === null) {
    const siguiente = crearSecuencia(SEMILLA);
    const personas: PoblacionPaciente[] = [pacienteDeReferencia()];

    for (let indice = 1; indice < POBLACION_TOTAL_GENERADO; indice += 1) {
      personas.push(construir(indice, siguiente));
    }

    conjunto = personas;
  }

  return conjunto;
}
