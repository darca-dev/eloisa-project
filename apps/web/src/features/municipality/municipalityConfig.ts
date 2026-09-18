import { branding, platformNameInSentence } from '@/config/branding';

import type { MunicipalityIconName } from './MunicipalityIcon';
import type { MunicipalityModuloId, MunicipalityPeriodoId } from './municipalityViews';

/**
 * Configuración tipada de la experiencia Alcaldía (TASK-ALCALDIA-A-01, FR-04).
 *
 * Fuente única de los datos demostrativos que muestran el shell y la pantalla
 * Inicio, tomados literalmente de la referencia aprobada
 * `prototype-claude/Eligeme-Alcaldia.dc.html` (líneas 24–101 y 757–802). Ningún
 * componente repite estos literales: todos los reciben por propiedades, de modo
 * que otra institución y otro perfil ficticios se representan sin cambiar la
 * estructura.
 *
 * Naturaleza de los datos: TODO lo que aparece aquí es fixture de diseño,
 * ficticio y local. No es dato productivo, no es dato agregado real de la red
 * de prestadores y no procede de ninguna fuente oficial externa. Estas tres
 * procedencias permanecen conceptualmente separadas: cuando existan datos
 * internos autorizados o información oficial externa, llegarán por un contrato
 * aprobado que conserve fuente, periodo, agregación y linaje, y sustituirán
 * estos fixtures sin que ninguna etiqueta de fuente aquí escrita pruebe que ya
 * existe una integración activa.
 *
 * Alcance: presentación. Esto NO es el modelo municipal definitivo, no crea
 * contexto global, tenant, persistencia, red ni permisos.
 */

/** Identidad institucional visible en el sidebar. */
export interface MunicipalityIdentity {
  /** Marca pública de la plataforma. */
  readonly plataforma: string;
  /** Entidad territorial demostrativa. */
  readonly entidad: string;
  /** Bajada institucional de la entidad. */
  readonly bajada: string;
}

/**
 * Perfil institucional de la sesión visible en la topbar.
 *
 * Representa la identidad institucional agregada bajo la que se consulta. NO es
 * un acceso, un enlace ni un control para conectarse con la secretaría, y no
 * concede ninguna capacidad: la autorización real será server-side.
 */
export interface MunicipalityProfile {
  readonly iniciales: string;
  readonly nombre: string;
  readonly perfil: string;
}

export interface MunicipalityNavItemConfig {
  readonly id: MunicipalityModuloId;
  readonly etiqueta: string;
  readonly icono: MunicipalityIconName;
}

/** Tono del semáforo institucional; nunca es el único portador del significado. */
export type MunicipalityTono = 'azul' | 'teal' | 'verde' | 'amarillo' | 'rojo';

export interface MunicipalityKpi {
  readonly id: string;
  readonly valor: string;
  readonly titulo: string;
  readonly aclaracion: string;
}

export interface MunicipalityEtapa {
  readonly id: string;
  readonly etapa: string;
  readonly valor: string;
  readonly aclaracion: string;
  readonly tono: MunicipalityTono;
}

export interface MunicipalityPendiente {
  readonly id: string;
  readonly texto: string;
  readonly nivel: string;
  readonly tono: MunicipalityTono;
}

export interface MunicipalityAcceso {
  readonly id: string;
  readonly etiqueta: string;
  /** Módulo local al que cambia el shell. No ejecuta ninguna operación. */
  readonly destino: MunicipalityModuloId;
}

export interface MunicipalityActividad {
  readonly id: string;
  readonly texto: string;
  /** Momento y origen declarados como fixture; no prueban integración alguna. */
  readonly cuando: string;
  readonly tono: MunicipalityTono;
}

export interface MunicipalityPeriodoConfig {
  readonly id: MunicipalityPeriodoId;
  readonly etiqueta: string;
}

export interface MunicipalityInicioConfig {
  readonly titularesTitulo: string;
  readonly kpis: readonly MunicipalityKpi[];
  readonly cadenaTitulo: string;
  readonly cadena: readonly MunicipalityEtapa[];
  readonly cadenaAclaracion: string;
  readonly pendientesTitulo: string;
  readonly pendientes: readonly MunicipalityPendiente[];
  readonly pendientesAclaracion: string;
  readonly accesosTitulo: string;
  readonly accesos: readonly MunicipalityAcceso[];
  readonly actividadesTitulo: string;
  readonly actividades: readonly MunicipalityActividad[];
}

/* ------------ Procedencia, territorio y atribución (A-02, §7 y §8) -------- */

/**
 * Categoría de procedencia de un dato municipal (TASK-ALCALDIA-A-02, FR-07).
 *
 * Las tres categorías permanecen separadas a propósito y NO son intercambiables:
 * un fixture nunca se convierte en dato interno autorizado ni en fuente oficial
 * por el hecho de mostrarse. A-02 solo produce `FIXTURE_DEMO`; las otras dos
 * existen para que un contrato posterior pueda distinguirlas sin rediseñar la
 * configuración.
 */
export type MunicipalityProcedencia =
  /** Fixture local de diseño: ficticio, sin valor oficial ni productivo. */
  | 'FIXTURE_DEMO'
  /** Dato interno autorizado y agregado, con tenant, municipio, periodo y linaje. */
  | 'AGREGADO_INTERNO'
  /** Dato publicado por una entidad externa, con dataset, versión y vigencia. */
  | 'FUENTE_OFICIAL_EXTERNA';

/**
 * Estado de sincronización de una fuente futura. A-02 declara únicamente
 * `SIN_INTEGRACION`: no consume, no simula y no muestra ninguna integración,
 * porque el diseño aprobado no contiene ese estado.
 */
export type MunicipalitySincronizacion =
  | 'SIN_INTEGRACION'
  | 'PENDIENTE'
  | 'ACTUALIZADO'
  | 'DESACTUALIZADO'
  | 'ERROR';

/**
 * Procedencia mínima que un contrato futuro debe poder representar: categoría,
 * fuente, fecha de corte (`asOf`) y estado de sincronización. Preparación
 * frontend; no es un DTO de API ni un modelo de persistencia.
 */
export interface MunicipalityProcedenciaRef {
  readonly categoria: MunicipalityProcedencia;
  /** Origen declarado. Un literal de origen no prueba oficialidad ni consulta. */
  readonly fuente: string;
  /** Fecha de corte del dato. `null` mientras no exista una fuente real. */
  readonly asOf: string | null;
  readonly sincronizacion: MunicipalitySincronizacion;
}

/** Niveles de la jerarquía territorial aprobada (A-02, §8.3). */
export type MunicipalityNivelTerritorial = 'MUNICIPIO' | 'URBANO_RURAL' | 'BARRIO' | 'VEREDA';

/** Estado del catálogo territorial. A-02 solo usa `DEMO`. */
export type MunicipalityEstadoCatalogo = 'DEMO' | 'VIGENTE' | 'HISTORICO';

/**
 * Referencia territorial normalizada: `Municipio → Urbana/Rural →
 * Barrio/Vereda`.
 *
 * Existe para que un barrio o una vereda NO se identifiquen únicamente por
 * texto libre, de modo que `San Luis`, `san luis` y `Vereda San Luis` no
 * terminen siendo tres lugares distintos. El identificador es opaco y estable;
 * el nombre es solo presentación.
 *
 * Preparación frontend: A-02 no crea catálogo maestro, identificadores
 * productivos, CRUD, geocodificación ni migración. La dirección exacta es un
 * dato personal restringido, vive separada y nunca forma parte de la respuesta
 * agregada de Alcaldía.
 */
export interface MunicipalityTerritorioRef {
  /** Identificador opaco y estable. No es una coordenada ni una dirección. */
  readonly id: string;
  readonly nivel: MunicipalityNivelTerritorial;
  /** Nombre de presentación. Nunca es la identidad del lugar. */
  readonly nombre: string;
  /** Identificador del nivel superior; `null` solo en el municipio. */
  readonly padreId: string | null;
  /** Municipio de contexto; sostendrá el aislamiento por tenant y territorio. */
  readonly municipioId: string;
  readonly estadoCatalogo: MunicipalityEstadoCatalogo;
  readonly procedencia: MunicipalityProcedenciaRef;
  readonly vigenciaDesde: string | null;
  readonly vigenciaHasta: string | null;
}

/**
 * Referencia opcional entre población, territorio, programa y una futura
 * atribución financiera (A-02, §9).
 *
 * Conserva estructuralmente la cadena `POBLACIÓN → TERRITORIO → PROGRAMA →
 * PRESUPUESTO → EJECUCIÓN → EVIDENCIA` sin incorporar montos: A-02 no muestra
 * dinero, no calcula, no prorratea y no atribuye gasto. Solo podrá mostrarse
 * dinero cuando exista una metodología aprobada con fuente, regla, periodo,
 * versión, responsable, evidencia y linaje; mientras tanto `metodologiaId`
 * permanece en `null` y esa ausencia significa exactamente que no hay
 * atribución posible. Que una persona pertenezca a varias poblaciones nunca
 * autoriza duplicar gasto.
 */
export interface MunicipalityAtribucionRef {
  readonly poblacionId: string | null;
  readonly territorioId: string | null;
  readonly programaId: string | null;
  /** `null` mientras no exista metodología de atribución aprobada. */
  readonly metodologiaId: string | null;
  readonly metodologiaVersion: string | null;
}

/* ---------------- Población beneficiaria (A-02, FR-02 a FR-04) ------------ */

/** Indicador de población objetivo y cobertura. */
export interface MunicipalityPoblacionIndicador {
  readonly id: string;
  readonly valor: string;
  readonly titulo: string;
  /**
   * Aclaración de origen tomada literalmente del fixture visual. NO prueba
   * fuente oficial, consulta, validación ni integración activa.
   */
  readonly fuente: string;
  readonly tono: MunicipalityTono;
}

/** Cobertura agregada. El porcentaje solo dibuja la barra decorativa. */
export interface MunicipalityCoberturaConfig {
  readonly titulo: string;
  /** Valor escrito y anunciado; la barra nunca es el único portador. */
  readonly valor: string;
  readonly porcentaje: number;
}

/** Acento del segmento de intersección; acompaña al texto, no lo sustituye. */
export type MunicipalitySegmentoTono =
  | 'aguamarina'
  | 'azul'
  | 'rosa'
  | 'petroleo'
  | 'fucsia'
  | 'tinta';

/**
 * Segmento exclusivo de la representación de intersecciones.
 *
 * Para este conteo una persona pertenece a exactamente un segmento exclusivo, y
 * quien cumple las tres condiciones cuenta una sola vez en el total único. Los
 * valores son configuración estática declarada: no se diagnostica, no se
 * infiere y no se aplica ninguna regla a personas. La lógica productiva de
 * identidad, matching, fuentes autoritativas y deduplicación queda pendiente y
 * no puede inferirse de este fixture.
 */
export interface MunicipalitySegmento {
  readonly id: string;
  readonly titulo: string;
  readonly valor: string;
  /** El mismo número que `valor`, para verificar la suma sin leer texto. */
  readonly personas: number;
  readonly tono: MunicipalitySegmentoTono;
}

/** Números rotulados sobre el diagrama decorativo, en su posición aprobada. */
export interface MunicipalityDiagramaEtiqueta {
  readonly id: 'mayor' | 'discapacidad' | 'cuidados' | 'todas';
  readonly valor: string;
}

export interface MunicipalityInterseccionesConfig {
  readonly titulo: string;
  /** Siete segmentos exclusivos cuya suma es el total de únicos. */
  readonly segmentos: readonly MunicipalitySegmento[];
  /** Total de beneficiarios únicos, mostrado una sola vez. */
  readonly total: MunicipalitySegmento;
  readonly aclaracion: string;
  /** Alternativa del diagrama; la lista es la representación canónica. */
  readonly alternativaDiagrama: string;
  readonly diagrama: readonly MunicipalityDiagramaEtiqueta[];
}

/** Indicador administrativo de calidad del registro. Nunca es calidad clínica. */
export interface MunicipalityCalidadIndicador {
  readonly id: string;
  readonly valor: string;
  readonly titulo: string;
  readonly tono: MunicipalityTono;
}

export interface MunicipalityPoblacionConfig {
  readonly titulo: string;
  readonly descripcion: string;
  readonly objetivoTitulo: string;
  readonly objetivo: readonly MunicipalityPoblacionIndicador[];
  readonly cobertura: MunicipalityCoberturaConfig;
  readonly intersecciones: MunicipalityInterseccionesConfig;
  readonly calidadTitulo: string;
  readonly calidad: readonly MunicipalityCalidadIndicador[];
  readonly calidadAclaracion: string;
  readonly procedencia: MunicipalityProcedenciaRef;
  readonly atribucion: MunicipalityAtribucionRef;
}

/* ------------------------ Territorio (A-02, FR-05) ------------------------ */

/** Encabezados visibles de la distribución territorial, en su orden aprobado. */
export interface MunicipalityTerritorioColumnas {
  readonly zona: string;
  readonly personas: string;
  readonly visitas: string;
  readonly alertas: string;
  readonly cobertura: string;
}

/**
 * Fila territorial agregada. La zona se identifica por una referencia
 * normalizada, no por su texto: el nombre solo se presenta.
 */
export interface MunicipalityZona {
  readonly id: string;
  readonly territorio: MunicipalityTerritorioRef;
  readonly personas: string;
  readonly visitas: string;
  /** Conteo de pendientes administrativos de gestión de la zona. */
  readonly alertas: string;
  readonly cobertura: string;
  readonly coberturaPorcentaje: number;
  readonly tonoCobertura: MunicipalityTono;
  readonly tonoAlertas: MunicipalityTono;
}

export interface MunicipalityTerritorioConfig {
  readonly titulo: string;
  readonly descripcion: string;
  readonly columnas: MunicipalityTerritorioColumnas;
  /** Resumen de la tabla para tecnologías de asistencia. */
  readonly tablaResumen: string;
  readonly zonas: readonly MunicipalityZona[];
  /** Rótulo que identifica la lectura como demostrativa y administrativa. */
  readonly insightEtiqueta: string;
  readonly insight: string;
  readonly alertasAclaracion: string;
  /** Catálogo demostrativo con los cuatro niveles de la jerarquía aprobada. */
  readonly catalogo: readonly MunicipalityTerritorioRef[];
  readonly procedencia: MunicipalityProcedenciaRef;
  readonly atribucion: MunicipalityAtribucionRef;
}

/* --------------------------- Programas (A-03) ----------------------------- */

/**
 * Identificador de una población base (TASK-ALCALDIA-A-03, §7.1).
 *
 * Es deliberadamente un `string` opaco y NO una unión cerrada de las tres
 * poblaciones iniciales: el catálogo vive separado de la entidad Programa, de
 * modo que una población adicional configurada en el futuro no obligue a
 * reescribir las tarjetas ni el formulario. Estas poblaciones son declarativas:
 * no se derivan de la edad, del estado de salud ni de ningún dato individual, y
 * no existe regla, algoritmo ni registro base detrás de ellas.
 */
export type MunicipalityPoblacionBaseId = string;

/** Entrada del catálogo de poblaciones base. */
export interface MunicipalityPoblacionBase {
  readonly id: MunicipalityPoblacionBaseId;
  /** Etiqueta de presentación. Nunca es la identidad de la población. */
  readonly etiqueta: string;
}

/**
 * Origen del programa (§7.3). Catálogo MVP exacto de cuatro valores.
 *
 * `origen`, `entidadFormuladora` y `entidadResponsable` son datos distintos e
 * independientes: ninguno se infiere de otro y ninguno afirma adopción oficial,
 * convenio ni integración con Nación, Departamento o Secretaría.
 */
export type MunicipalityProgramaOrigen =
  | 'NACIONAL'
  | 'DEPARTAMENTAL'
  | 'MUNICIPAL'
  | 'INSTITUCIONAL_OTRO';

export interface MunicipalityProgramaOrigenConfig {
  readonly id: MunicipalityProgramaOrigen;
  readonly etiqueta: string;
}

/**
 * Estado del programa (§7.5). Catálogo MVP cerrado para esta tarea.
 *
 * `BORRADOR → APROBADO → ACTIVO → SUSPENDIDO → FINALIZADO` expresa el ciclo
 * nominal aprobado; NO es una máquina de estados productiva, no define
 * transiciones excepcionales, no autoriza a nadie a aprobar, activar, suspender
 * ni cerrar, y ninguna acción de esta vista cambia el estado de un programa.
 * El estado siempre se escribe: el color solo lo acompaña.
 */
export type MunicipalityProgramaEstado =
  | 'BORRADOR'
  | 'APROBADO'
  | 'ACTIVO'
  | 'SUSPENDIDO'
  | 'FINALIZADO';

export interface MunicipalityProgramaEstadoConfig {
  readonly id: MunicipalityProgramaEstado;
  readonly etiqueta: string;
  readonly tono: MunicipalityTono;
}

/**
 * Tipo de participación visible de un ejecutor (§7.4).
 *
 * Describe la clase de organización que ejecuta, no su identidad. La relación
 * productiva programa–ejecutor (identificadores, rol de participación, vigencia
 * y estado), su auditoría y la recepción automática en Hospital/ESE pertenecen
 * a H-06B y a decisiones pendientes: A-03 no las implementa ni concede acceso.
 */
export type MunicipalityEjecutorTipo =
  | 'HOSPITAL_ESE'
  | 'FUNDACION'
  | 'OPERADOR'
  | 'OTRA_ENTIDAD';

export interface MunicipalityEjecutorTipoConfig {
  readonly id: MunicipalityEjecutorTipo;
  readonly etiqueta: string;
}

/**
 * Organización ejecutora vinculada a un programa. El identificador es opaco y
 * estable; el nombre solo se presenta. Aparecer aquí no otorga permisos, no
 * crea contrato y no habilita a la organización a crear programas municipales.
 */
export interface MunicipalityEjecutor {
  readonly id: string;
  readonly nombre: string;
  readonly tipo: MunicipalityEjecutorTipo;
}

/** Vigencia demostrativa del programa. No hay calendario ni periodo oficial. */
export interface MunicipalityVigencia {
  /** Fecha declarada de inicio, en formato `AAAA-MM-DD`. */
  readonly inicio: string;
  /** Fecha declarada de fin, en formato `AAAA-MM-DD`. */
  readonly fin: string;
  /** Texto de presentación del periodo. */
  readonly etiqueta: string;
}

/** Ámbito territorial agregado del programa; nunca una ubicación individual. */
export interface MunicipalityProgramaTerritorio {
  /** Identificadores del catálogo territorial normalizado de A-02. */
  readonly ambitoIds: readonly string[];
  readonly resumen: string;
}

/**
 * Cobertura agregada del programa. El porcentaje solo existe cuando el
 * denominador está declarado: no se deriva, no se calcula y su ausencia
 * significa exactamente que no hay denominador aprobado.
 */
export interface MunicipalityProgramaCobertura {
  readonly valor: string;
  readonly denominador: string | null;
  readonly porcentajeTexto: string | null;
}

/**
 * Avance físico declarado (FR-05).
 *
 * Meta y resultado son valores absolutos con su unidad; el porcentaje es un
 * fixture declarado. El componente no aplica fórmula, redondeo, corte ni
 * valoración de eficiencia, y `resultadoFisico`/`porcentaje` en `null`
 * significan «sin registro», nunca cero cumplido.
 */
export interface MunicipalityAvanceFisico {
  readonly metaFisica: number;
  readonly resultadoFisico: number | null;
  /** Unidad de la meta y del resultado; ambas comparten unidad. */
  readonly unidad: string;
  /** Etiqueta del resultado: `Atendidas`, `Certificados emitidos`, etc. */
  readonly resultadoEtiqueta: string;
  readonly porcentaje: number | null;
  readonly porcentajeTexto: string | null;
  readonly tono: MunicipalityTono;
}

/** Presupuesto declarado del programa. No es contabilidad ni movimiento. */
export interface MunicipalityPresupuesto {
  /** Moneda visible junto al monto. */
  readonly moneda: string;
  readonly asignado: string;
}

/**
 * Avance financiero declarado (FR-06).
 *
 * `comprometido`, `ejecutado`, `disponible` y el porcentaje son literales
 * demostrativos independientes: A-03 no deriva el disponible, no calcula el
 * porcentaje, no confunde ejecutado con pagado y no califica eficiencia. La
 * cadena fuente → asignación → compromiso → causado/obligado → pago → evidencia
 * → saldo, con su semántica contable, pertenece a A-04.
 */
export interface MunicipalityAvanceFinanciero {
  /** Monto comprometido cuando el fixture lo declara; `null` cuando no existe. */
  readonly comprometido: string | null;
  readonly ejecutado: string | null;
  readonly disponible: string | null;
  readonly porcentaje: number | null;
  readonly porcentajeTexto: string | null;
  readonly tono: MunicipalityTono;
}

/**
 * Resumen documental agregado (FR-07). Son conteos: no hay documento, archivo,
 * enlace, factura, proveedor ni carga real, y ningún dato identifica a nadie.
 */
export interface MunicipalityEvidenciaResumen {
  readonly registradas: string;
  readonly pendientes: string;
  readonly actividadesConSoporte: string;
  readonly estadoDocumental: string;
  readonly tono: MunicipalityTono;
}

/**
 * Cierre preparado de un programa finalizado (FR-09).
 *
 * Reúne los once datos exigidos para poder presentar un cierre completo. A-03
 * no cierra programas, no genera ni almacena informe y no declara cumplimiento:
 * un informe ausente se muestra siempre como pendiente.
 */
export interface MunicipalityProgramaCierre {
  readonly presupuestoAsignado: string;
  readonly ejecutado: string;
  readonly saldo: string;
  readonly porcentajeFinancieroTexto: string;
  readonly meta: string;
  readonly resultado: string;
  readonly porcentajeFisicoTexto: string;
  readonly beneficiariosUnicos: string;
  readonly evidenciasCompletas: string;
  readonly evidenciasFaltantes: string;
  /** Estado o referencia demostrativa del informe final; nunca un archivo. */
  readonly informeFinal: string;
  readonly nota: string;
}

/** Dato adicional declarado de la cuadrícula: atenciones, certificados, etc. */
export interface MunicipalityProgramaActividad {
  readonly etiqueta: string;
  readonly valor: string;
}

/**
 * Programa de la vista Alcaldía (§7.2).
 *
 * Entidad de presentación, no DTO, esquema Prisma ni contrato de API. El
 * programa pertenece a una organización dentro de un tenant (`organizacionId`)
 * y NO a una clase fija `Alcaldía`: `municipioId` puede ser `null` para que una
 * organización autorizada distinta del municipio pueda representarse en el
 * futuro sin cambiar la estructura ni la interfaz municipal.
 *
 * Todos los valores son `FIXTURE_DEMO`: ficticios, sin fuente oficial, sin
 * integración y sin fecha productiva.
 */
export interface MunicipalityPrograma {
  /** Identificador opaco y estable. */
  readonly id: string;
  /** Organización propietaria dentro del tenant. No implica municipio. */
  readonly organizacionId: string;
  /** Municipio de contexto cuando aplica; `null` cuando no es municipal. */
  readonly municipioId: string | null;
  readonly nombre: string;
  readonly objetivo: string;
  /** Una o varias poblaciones base. La relación es muchos a muchos. */
  readonly poblacionIds: readonly MunicipalityPoblacionBaseId[];
  readonly origen: MunicipalityProgramaOrigen;
  readonly entidadFormuladora: string;
  readonly entidadResponsable: string;
  /** Colección no vacía en los fixtures completos. */
  readonly ejecutores: readonly MunicipalityEjecutor[];
  readonly vigencia: MunicipalityVigencia;
  readonly presupuesto: MunicipalityPresupuesto;
  readonly avanceFisico: MunicipalityAvanceFisico;
  readonly avanceFinanciero: MunicipalityAvanceFinanciero;
  readonly territorio: MunicipalityProgramaTerritorio;
  readonly cobertura: MunicipalityProgramaCobertura;
  readonly beneficiariosUnicos: string;
  readonly poblacionAtendida: string;
  readonly actividad: MunicipalityProgramaActividad;
  readonly evidencias: MunicipalityEvidenciaResumen;
  readonly estado: MunicipalityProgramaEstado;
  /** Cierre preparado; solo lo declara un programa finalizado. */
  readonly cierre: MunicipalityProgramaCierre | null;
  readonly procedencia: MunicipalityProcedenciaRef;
}

/** Campos del formulario local, para asociar cada error con su control. */
export type MunicipalityProgramaCampo =
  | 'nombre'
  | 'poblaciones'
  | 'origen'
  | 'entidadFormuladora'
  | 'entidadResponsable'
  | 'ejecutores'
  | 'vigenciaInicio'
  | 'vigenciaFin'
  | 'presupuesto'
  | 'meta';

/** Etiquetas visibles del formulario local. */
export interface MunicipalityProgramaFormularioConfig {
  readonly titulo: string;
  readonly descripcion: string;
  readonly campos: Record<MunicipalityProgramaCampo, string>;
  readonly grupoVigencia: string;
  readonly estadoInicialEtiqueta: string;
  /** Estado con el que nace todo alta local. No es escalable desde este flujo. */
  readonly estadoInicial: MunicipalityProgramaEstado;
  readonly estadoInicialAyuda: string;
  readonly moneda: string;
  readonly unidadMeta: string;
  readonly requerido: string;
  readonly resumenErroresTitulo: string;
  readonly errores: Record<MunicipalityProgramaCampo, string>;
  /** Error específico del orden de las dos fechas de vigencia. */
  readonly errorVigenciaOrden: string;
  readonly cancelar: string;
  readonly crear: string;
  readonly anuncioCreado: string;
  readonly resultadoEtiqueta: string;
  readonly actividadEtiqueta: string;
}

/** Etiquetas visibles de las tarjetas de programa. */
export interface MunicipalityProgramaEtiquetas {
  readonly origen: string;
  readonly entidadFormuladora: string;
  readonly entidadResponsable: string;
  readonly poblaciones: string;
  readonly ejecutores: string;
  readonly beneficiariosUnicos: string;
  readonly poblacionAtendida: string;
  readonly cobertura: string;
  readonly territorio: string;
  readonly vigencia: string;
  readonly avanceFinanciero: string;
  readonly presupuestoAsignado: string;
  readonly comprometido: string;
  readonly ejecutado: string;
  readonly disponible: string;
  readonly moneda: string;
  readonly avanceFisico: string;
  readonly meta: string;
  readonly evidencias: string;
  readonly evidenciasRegistradas: string;
  readonly evidenciasPendientes: string;
  readonly actividadesConSoporte: string;
  readonly estadoDocumental: string;
  readonly cierre: string;
  readonly cierreSaldo: string;
  readonly cierreInformeFinal: string;
  readonly cierreEvidenciasCompletas: string;
  readonly cierreEvidenciasFaltantes: string;
  /** Texto único para todo dato que el fixture no declara. */
  readonly sinRegistro: string;
  /** Aclaración cuando la cobertura no tiene denominador declarado. */
  readonly sinDenominador: string;
}

/** Configuración completa de la vista Programas. */
export interface MunicipalityProgramasConfig {
  readonly titulo: string;
  readonly descripcion: string;
  /** Símbolo decorativo de la acción primaria; se oculta a lectores. */
  readonly accionNuevoSimbolo: string;
  readonly accionNuevo: string;
  /** Aclaración obligatoria de deduplicación (FR-04). */
  readonly deduplicacion: string;
  /** Resumen de la lista para tecnologías de asistencia. */
  readonly listaResumen: string;
  /** Límite explícito frente a A-04: aquí solo hay resumen. */
  readonly limiteFinanciero: string;
  readonly etiquetas: MunicipalityProgramaEtiquetas;
  readonly poblacionesBase: readonly MunicipalityPoblacionBase[];
  readonly origenes: readonly MunicipalityProgramaOrigenConfig[];
  readonly estados: readonly MunicipalityProgramaEstadoConfig[];
  readonly tiposEjecutor: readonly MunicipalityEjecutorTipoConfig[];
  /** Organizaciones ejecutoras seleccionables en el alta local demostrativa. */
  readonly ejecutoresDisponibles: readonly MunicipalityEjecutor[];
  readonly programas: readonly MunicipalityPrograma[];
  readonly formulario: MunicipalityProgramaFormularioConfig;
  readonly procedencia: MunicipalityProcedenciaRef;
  readonly atribucion: MunicipalityAtribucionRef;
}

export interface MunicipalityDemoAviso {
  /** Etiqueta corta y visible que identifica la pantalla como demostrativa. */
  readonly etiqueta: string;
  /** Frase que impide leer los valores como oficiales o productivos. */
  readonly aclaracion: string;
  /** Aclaración del selector temporal: la selección no recalcula nada. */
  readonly notaPeriodo: string;
}

export interface MunicipalityConfig {
  readonly identidad: MunicipalityIdentity;
  readonly perfil: MunicipalityProfile;
  /** Encabezado del panel. */
  readonly encabezado: string;
  /** Aviso de privacidad municipal, siempre visible en la topbar. */
  readonly avisoPrivacidad: string;
  readonly periodos: readonly MunicipalityPeriodoConfig[];
  readonly navegacion: readonly MunicipalityNavItemConfig[];
  readonly demo: MunicipalityDemoAviso;
  readonly inicio: MunicipalityInicioConfig;
  readonly poblacion: MunicipalityPoblacionConfig;
  readonly territorio: MunicipalityTerritorioConfig;
  readonly programas: MunicipalityProgramasConfig;
  readonly presupuesto: MunicipalityPresupuestoConfig;
  readonly evidencias: MunicipalityEvidenciasConfig;
  /* TASK-ALCALDIA-DEMO-FINAL: los siete módulos que cierran la demostración. */
  readonly furag: MunicipalityFuragConfig;
  readonly adres: MunicipalityAdresConfig;
  readonly cuidado: MunicipalityCuidadoConfig;
  readonly brechas: MunicipalityBrechasConfig;
  readonly cuidadores: MunicipalityCuidadoresConfig;
  readonly indicadores: MunicipalityIndicadoresConfig;
  readonly reportes: MunicipalityReportesConfig;
}

/**
 * Menú completo, en el orden vinculante de la referencia aprobada
 * (líneas 30–82). Ninguna opción se omite ni se reordena.
 */
export const MUNICIPALITY_NAV_ITEMS: readonly MunicipalityNavItemConfig[] = [
  { id: 'inicio', etiqueta: 'Inicio', icono: 'inicio' },
  { id: 'poblacion', etiqueta: 'Población beneficiaria', icono: 'poblacion' },
  { id: 'territorio', etiqueta: 'Territorio', icono: 'territorio' },
  { id: 'programas', etiqueta: 'Programas', icono: 'programas' },
  { id: 'presupuesto', etiqueta: 'Presupuesto y ejecución', icono: 'presupuesto' },
  { id: 'evidencias', etiqueta: 'Evidencias', icono: 'evidencias' },
  { id: 'furag', etiqueta: 'FURAG y MIPG', icono: 'furag' },
  { id: 'adres', etiqueta: 'ADRES', icono: 'adres' },
  { id: 'cuidado', etiqueta: 'Derecho al cuidado', icono: 'cuidado' },
  { id: 'brechas', etiqueta: 'Brechas', icono: 'brechas' },
  { id: 'cuidadores', etiqueta: 'Cuidadores y formación', icono: 'cuidadores' },
  { id: 'indicadores', etiqueta: 'Indicadores y resultados', icono: 'indicadores' },
  { id: 'reportes', etiqueta: 'Reportes ejecutivos', icono: 'reportes' },
];

/** Periodos del selector temporal, en el orden aprobado. */
export const MUNICIPALITY_PERIODOS_CONFIG: readonly MunicipalityPeriodoConfig[] = [
  { id: 'mes', etiqueta: 'Este mes' },
  { id: 'trimestre', etiqueta: 'Trimestre' },
  { id: 'semestre', etiqueta: 'Semestre' },
  { id: 'ano', etiqueta: 'Año' },
  { id: 'personalizado', etiqueta: 'Personalizado' },
];

/**
 * Frase única del estado «Próximamente». No adelanta contenido, formularios,
 * tablas ni indicadores del módulo correspondiente.
 */
export const MUNICIPALITY_TEXTO_PROXIMAMENTE =
  'Este módulo se implementará en una tarea posterior.';

/**
 * Límites institucionales que deben acompañar a dos estados próximos concretos
 * (TASK-ALCALDIA-A-01, §12). No implementan contenido interno del módulo: solo
 * impiden que su sola presencia en el menú sugiera un significado que la
 * plataforma no tiene.
 *
 * FURAG/MIPG: la plataforma organiza evidencia; el resultado oficial pertenece
 * a la autoridad competente. ADRES: administrador y fuente autorizada de
 * información y recursos, no regulador ni evaluador.
 */
export const MUNICIPALITY_NOTA_PROXIMAMENTE: Partial<Record<MunicipalityModuloId, string>> = {
  furag: `${platformNameInSentence()} organizará evidencia; no calcula el resultado FURAG ni declara cumplimiento.`,
  adres: `La información futura conservará su fuente oficial; ${platformNameInSentence()} no actúa como regulador.`,
};

/**
 * Procedencia de TODO lo que A-02 muestra: fixture local de diseño.
 *
 * No hay fuente interna autorizada, no hay fuente oficial externa y no hay
 * integración: por eso `asOf` es `null` y la sincronización es
 * `SIN_INTEGRACION`. Ningún literal de origen escrito en los fixtures
 * («Proyección oficial», «RLCPD», «municipio y la red») prueba lo contrario.
 */
export const MUNICIPALITY_PROCEDENCIA_DEMO: MunicipalityProcedenciaRef = {
  categoria: 'FIXTURE_DEMO',
  fuente: 'Fixture local de diseño',
  asOf: null,
  sincronizacion: 'SIN_INTEGRACION',
};

/**
 * Atribución financiera de A-02: ninguna.
 *
 * La cadena `POBLACIÓN → TERRITORIO → PROGRAMA → PRESUPUESTO → EJECUCIÓN →
 * EVIDENCIA` se conserva como estructura, pero sin metodología aprobada no hay
 * atribución posible y estas vistas no muestran, calculan ni prorratean dinero.
 */
export const MUNICIPALITY_ATRIBUCION_PENDIENTE: MunicipalityAtribucionRef = {
  poblacionId: null,
  territorioId: null,
  programaId: null,
  metodologiaId: null,
  metodologiaVersion: null,
};

/** Identificador del municipio demostrativo; raíz del catálogo territorial. */
const TERRITORIO_MUNICIPIO_ID = 'ter-demo-municipio';

/** Construye una entrada demostrativa del catálogo territorial. */
function territorioDemo(
  id: string,
  nivel: MunicipalityNivelTerritorial,
  nombre: string,
  padreId: string | null,
): MunicipalityTerritorioRef {
  return {
    id,
    nivel,
    nombre,
    padreId,
    municipioId: TERRITORIO_MUNICIPIO_ID,
    estadoCatalogo: 'DEMO',
    procedencia: MUNICIPALITY_PROCEDENCIA_DEMO,
    vigenciaDesde: null,
    vigenciaHasta: null,
  };
}

/**
 * Catálogo territorial demostrativo con los cuatro niveles aprobados.
 *
 * `Municipio → Urbana/Rural → Barrio/Vereda`. Cada zona de la vista Territorio
 * apunta a una de estas entradas por identificador estable, de modo que la
 * jerarquía no dependa del texto del nombre. Es preparación frontend: no es
 * catálogo maestro, no tiene códigos oficiales, no geocodifica y no contiene
 * ninguna ubicación individual.
 */
const TERRITORIO_MUNICIPIO = territorioDemo(
  TERRITORIO_MUNICIPIO_ID,
  'MUNICIPIO',
  'Soacha',
  null,
);
const TERRITORIO_URBANA = territorioDemo(
  'ter-demo-urbana',
  'URBANO_RURAL',
  'Zona urbana',
  TERRITORIO_MUNICIPIO_ID,
);
const TERRITORIO_RURAL = territorioDemo(
  'ter-demo-rural',
  'URBANO_RURAL',
  'Zona rural',
  TERRITORIO_MUNICIPIO_ID,
);
const TERRITORIO_COMPARTIR = territorioDemo(
  'ter-demo-compartir',
  'BARRIO',
  'Comuna 1 · Compartir',
  TERRITORIO_URBANA.id,
);
const TERRITORIO_CENTRO = territorioDemo(
  'ter-demo-centro',
  'BARRIO',
  'Comuna 2 · Soacha centro',
  TERRITORIO_URBANA.id,
);
const TERRITORIO_DESPENSA = territorioDemo(
  'ter-demo-despensa',
  'BARRIO',
  'Comuna 3 · La Despensa',
  TERRITORIO_URBANA.id,
);
const TERRITORIO_CAZUCA = territorioDemo(
  'ter-demo-cazuca',
  'BARRIO',
  'Comuna 4 · Cazucá',
  TERRITORIO_URBANA.id,
);
const TERRITORIO_SAN_HUMBERTO = territorioDemo(
  'ter-demo-san-humberto',
  'BARRIO',
  'Comuna 6 · San Humberto',
  TERRITORIO_URBANA.id,
);
const TERRITORIO_EL_CHARQUITO = territorioDemo(
  'ter-demo-el-charquito',
  'VEREDA',
  'Zona rural · El Charquito',
  TERRITORIO_RURAL.id,
);

export const MUNICIPALITY_CATALOGO_TERRITORIAL_DEMO: readonly MunicipalityTerritorioRef[] = [
  TERRITORIO_MUNICIPIO,
  TERRITORIO_URBANA,
  TERRITORIO_RURAL,
  TERRITORIO_COMPARTIR,
  TERRITORIO_CENTRO,
  TERRITORIO_DESPENSA,
  TERRITORIO_CAZUCA,
  TERRITORIO_SAN_HUMBERTO,
  TERRITORIO_EL_CHARQUITO,
];

/**
 * Población beneficiaria demostrativa (líneas 172–235 y 803–830 de la
 * referencia aprobada).
 *
 * Todos los valores son fixtures declarados. Ninguna función deriva aquí una
 * condición de edad, discapacidad o necesidad de cuidado a partir de una
 * persona: no hay personas, no hay registros base y no hay algoritmo.
 */
export const municipalityPoblacionDemo: MunicipalityPoblacionConfig = {
  titulo: 'Población beneficiaria',
  descripcion:
    '3.050 personas identificadas y vinculadas a programas. Las categorías se cruzan: los totales no suman categorías, deduplican personas.',
  objetivoTitulo: 'Población objetivo identificada y cobertura',
  objetivo: [
    {
      id: 'total-municipio',
      valor: '812.400',
      titulo: 'Población total del municipio',
      fuente: 'Proyección oficial',
      tono: 'azul',
    },
    {
      id: 'mayores',
      valor: '6.117',
      titulo: 'Personas de 60 años o más',
      fuente: 'Población objetivo priorizada',
      tono: 'azul',
    },
    {
      id: 'discapacidad',
      valor: '2.845',
      titulo: 'Personas con discapacidad',
      fuente: '1.912 en el RLCPD',
      tono: 'azul',
    },
    {
      id: 'cuidado',
      valor: '1.640',
      titulo: 'Requieren cuidado domiciliario',
      fuente: 'Identificadas por el municipio y la red',
      tono: 'teal',
    },
    {
      id: 'deduplicada',
      valor: '8.142',
      titulo: 'Población objetivo deduplicada',
      fuente: 'Unión de las tres poblaciones, sin doble conteo',
      tono: 'teal',
    },
    {
      id: 'registradas',
      valor: '3.050',
      titulo: `Registradas en ${branding.platformDisplayName}`,
      fuente: 'Beneficiarios únicos',
      tono: 'verde',
    },
    {
      id: 'no-vinculadas',
      valor: '5.092',
      titulo: 'Aún no vinculadas',
      fuente: 'Brecha de vinculación',
      tono: 'amarillo',
    },
  ],
  cobertura: {
    titulo: `Cobertura ${branding.platformDisplayName} sobre población objetivo`,
    valor: '37,5 %',
    porcentaje: 37.5,
  },
  intersecciones: {
    titulo: 'Intersección de poblaciones',
    segmentos: [
      {
        id: 'solo-mayor',
        titulo: 'Solo persona mayor de 60',
        valor: '1.284',
        personas: 1284,
        tono: 'aguamarina',
      },
      {
        id: 'solo-discapacidad',
        titulo: 'Solo discapacidad',
        valor: '452',
        personas: 452,
        tono: 'azul',
      },
      {
        id: 'solo-cuidados',
        titulo: 'Solo cuidados en casa',
        valor: '268',
        personas: 268,
        tono: 'rosa',
      },
      {
        id: 'mayor-discapacidad',
        titulo: 'Mayor de 60 y discapacidad',
        valor: '386',
        personas: 386,
        tono: 'petroleo',
      },
      {
        id: 'mayor-cuidados',
        titulo: 'Mayor de 60 y cuidados en casa',
        valor: '448',
        personas: 448,
        tono: 'petroleo',
      },
      {
        id: 'discapacidad-cuidados',
        titulo: 'Discapacidad y cuidados en casa',
        valor: '134',
        personas: 134,
        tono: 'petroleo',
      },
      {
        id: 'tres-condiciones',
        titulo: 'Las tres condiciones',
        valor: '78',
        personas: 78,
        tono: 'fucsia',
      },
    ],
    total: {
      id: 'total-unicos',
      titulo: 'Total de beneficiarios únicos',
      valor: '3.050',
      personas: 3050,
      tono: 'tinta',
    },
    aclaracion:
      'Una persona de 76 años con discapacidad y cuidados en casa aparece en las tres poblaciones y cuenta como un beneficiario único en el total municipal.',
    alternativaDiagrama:
      'Diagrama decorativo de tres poblaciones que se cruzan. Repite cuatro de los valores de la lista siguiente, que es la representación completa de los siete segmentos y de su total.',
    diagrama: [
      { id: 'mayor', valor: '1.284' },
      { id: 'discapacidad', valor: '452' },
      { id: 'cuidados', valor: '268' },
      { id: 'todas', valor: '78' },
    ],
  },
  calidadTitulo: 'Calidad de la información',
  calidad: [
    {
      id: 'sin-eps',
      valor: '64',
      titulo: 'Personas sin EPS identificada',
      tono: 'amarillo',
    },
    { id: 'documentos', valor: '112', titulo: 'Documentos pendientes', tono: 'amarillo' },
    { id: 'afiliaciones', valor: '87', titulo: 'Afiliaciones por verificar', tono: 'amarillo' },
    { id: 'duplicados', valor: '19', titulo: 'Duplicados potenciales', tono: 'rojo' },
    { id: 'completos', valor: '94,2 %', titulo: 'Registros completos', tono: 'verde' },
  ],
  calidadAclaracion:
    'Son indicadores administrativos del registro, no una valoración de salud. «Duplicados potenciales» señala una revisión pendiente, no una duplicidad confirmada. Desde este panel no se identifica, no se abre ni se corrige el registro de ninguna persona.',
  procedencia: MUNICIPALITY_PROCEDENCIA_DEMO,
  atribucion: MUNICIPALITY_ATRIBUCION_PENDIENTE,
};

/**
 * Territorio demostrativo (líneas 237–268 y 833–840 de la referencia
 * aprobada).
 *
 * Distribución agregada por zona. Ninguna fila corresponde a una persona,
 * ninguna zona expone ubicación individual y no existe mapa, coordenada ni
 * drill-down.
 */
export const municipalityTerritorioDemo: MunicipalityTerritorioConfig = {
  titulo: '¿Dónde están nuestros beneficiarios?',
  descripcion:
    'Información agregada por zona. No se muestran direcciones individuales. Sirve para detectar concentración, baja cobertura y zonas sin servicio.',
  columnas: {
    zona: 'ZONA',
    personas: 'PERSONAS',
    visitas: 'VISITAS',
    alertas: 'ALERTAS',
    cobertura: 'COBERTURA',
  },
  tablaResumen:
    'Distribución agregada por zona: personas, visitas, alertas de gestión y cobertura. Todos los valores son demostrativos.',
  zonas: [
    {
      id: 'zona-compartir',
      territorio: TERRITORIO_COMPARTIR,
      personas: '742',
      visitas: '318',
      alertas: '12',
      cobertura: '82 %',
      coberturaPorcentaje: 82,
      tonoCobertura: 'verde',
      tonoAlertas: 'amarillo',
    },
    {
      id: 'zona-centro',
      territorio: TERRITORIO_CENTRO,
      personas: '688',
      visitas: '286',
      alertas: '9',
      cobertura: '76 %',
      coberturaPorcentaje: 76,
      tonoCobertura: 'verde',
      tonoAlertas: 'amarillo',
    },
    {
      id: 'zona-despensa',
      territorio: TERRITORIO_DESPENSA,
      personas: '596',
      visitas: '241',
      alertas: '14',
      cobertura: '61 %',
      coberturaPorcentaje: 61,
      tonoCobertura: 'teal',
      tonoAlertas: 'amarillo',
    },
    {
      id: 'zona-cazuca',
      territorio: TERRITORIO_CAZUCA,
      personas: '604',
      visitas: '198',
      alertas: '31',
      cobertura: '44 %',
      coberturaPorcentaje: 44,
      tonoCobertura: 'amarillo',
      tonoAlertas: 'rojo',
    },
    {
      id: 'zona-san-humberto',
      territorio: TERRITORIO_SAN_HUMBERTO,
      personas: '284',
      visitas: '142',
      alertas: '7',
      cobertura: '58 %',
      coberturaPorcentaje: 58,
      tonoCobertura: 'teal',
      tonoAlertas: 'amarillo',
    },
    {
      id: 'zona-el-charquito',
      territorio: TERRITORIO_EL_CHARQUITO,
      personas: '136',
      visitas: '99',
      alertas: '18',
      cobertura: '31 %',
      coberturaPorcentaje: 31,
      tonoCobertura: 'amarillo',
      tonoAlertas: 'rojo',
    },
  ],
  insightEtiqueta: 'Lectura administrativa demostrativa',
  insight:
    'Cazucá y la zona rural concentran la mayor necesidad con la menor cobertura. Son las dos zonas donde el municipio debería enfocar la vinculación.',
  alertasAclaracion:
    'Las alertas son pendientes administrativos de gestión de cada zona y no expresan una valoración individual. Esta lectura es demostrativa: no procede de una regla calculada ni de una conclusión oficial.',
  catalogo: MUNICIPALITY_CATALOGO_TERRITORIAL_DEMO,
  procedencia: MUNICIPALITY_PROCEDENCIA_DEMO,
  atribucion: MUNICIPALITY_ATRIBUCION_PENDIENTE,
};

/* ----------------------- Programas (A-03, §7 y FR-03) --------------------- */

/**
 * Catálogo inicial de poblaciones base (§7.1).
 *
 * Son POBLACIONES, no programas: un programa declara una o varias mediante
 * `poblacionIds`. El catálogo vive aquí, separado de la entidad Programa, para
 * que añadir una población futura no obligue a tocar tarjetas ni formulario.
 * Ninguna pertenencia se deriva de un dato individual.
 */
export const MUNICIPALITY_POBLACIONES_BASE: readonly MunicipalityPoblacionBase[] = [
  { id: 'MAYORES_60', etiqueta: 'Personas mayores de 60 años' },
  { id: 'DISCAPACIDAD', etiqueta: 'Personas en situación de discapacidad' },
  { id: 'CUIDADO_EN_CASA', etiqueta: 'Personas que requieren cuidados en casa' },
];

/** Catálogo exacto de orígenes (§7.3). No todos los programas nacen en Alcaldía. */
export const MUNICIPALITY_PROGRAMA_ORIGENES: readonly MunicipalityProgramaOrigenConfig[] = [
  { id: 'NACIONAL', etiqueta: 'Nacional' },
  { id: 'DEPARTAMENTAL', etiqueta: 'Departamental' },
  { id: 'MUNICIPAL', etiqueta: 'Municipal' },
  { id: 'INSTITUCIONAL_OTRO', etiqueta: 'Institucional/Otro' },
];

/**
 * Catálogo exacto de estados (§7.5), en el orden del ciclo nominal aprobado.
 *
 * Los textos del prototipo («En ejecución», «Requiere seguimiento», «Ejecución
 * baja») NO son estados canónicos y no aparecen: el seguimiento bajo se lee en
 * las métricas declaradas, sin inferir eficiencia ni crear un sexto estado.
 */
export const MUNICIPALITY_PROGRAMA_ESTADOS: readonly MunicipalityProgramaEstadoConfig[] = [
  { id: 'BORRADOR', etiqueta: 'Borrador', tono: 'azul' },
  { id: 'APROBADO', etiqueta: 'Aprobado', tono: 'teal' },
  { id: 'ACTIVO', etiqueta: 'Activo', tono: 'verde' },
  { id: 'SUSPENDIDO', etiqueta: 'Suspendido', tono: 'amarillo' },
  { id: 'FINALIZADO', etiqueta: 'Finalizado', tono: 'azul' },
];

/** Tipos de participación admitidos por los fixtures (§7.4). */
export const MUNICIPALITY_EJECUTOR_TIPOS: readonly MunicipalityEjecutorTipoConfig[] = [
  { id: 'HOSPITAL_ESE', etiqueta: 'Hospital/ESE' },
  { id: 'FUNDACION', etiqueta: 'Fundación' },
  { id: 'OPERADOR', etiqueta: 'Operador' },
  { id: 'OTRA_ENTIDAD', etiqueta: 'Otra entidad autorizada' },
];

/**
 * Organizaciones ejecutoras demostrativas.
 *
 * Es una lista de configuración, no un catálogo maestro de organizaciones: la
 * identidad de organizaciones y los términos de vinculación de ejecutores son
 * decisiones materiales pendientes. Ninguna de estas entidades adquiere aquí
 * permisos, contrato, acceso ni capacidad de crear programas municipales.
 */
const EJECUTOR_HOSPITAL: MunicipalityEjecutor = {
  id: 'org-demo-ese',
  nombre: 'Hospital San Rafael (ESE)',
  tipo: 'HOSPITAL_ESE',
};
const EJECUTOR_FUNDACION: MunicipalityEjecutor = {
  id: 'org-demo-fundacion',
  nombre: 'Fundación Raíces del Cuidado (demostrativa)',
  tipo: 'FUNDACION',
};
const EJECUTOR_OPERADOR_SOCIAL: MunicipalityEjecutor = {
  id: 'org-demo-operador-social',
  nombre: 'Operador social (demostrativo)',
  tipo: 'OPERADOR',
};
const EJECUTOR_OPERADOR_FORMACION: MunicipalityEjecutor = {
  id: 'org-demo-operador-formacion',
  nombre: 'Operador de formación (demostrativo)',
  tipo: 'OPERADOR',
};
const EJECUTOR_ENTIDAD_FORMADORA: MunicipalityEjecutor = {
  id: 'org-demo-entidad-formadora',
  nombre: 'Entidad de formación (demostrativa)',
  tipo: 'OTRA_ENTIDAD',
};

export const MUNICIPALITY_EJECUTORES_DEMO: readonly MunicipalityEjecutor[] = [
  EJECUTOR_HOSPITAL,
  EJECUTOR_FUNDACION,
  EJECUTOR_OPERADOR_SOCIAL,
  EJECUTOR_OPERADOR_FORMACION,
  EJECUTOR_ENTIDAD_FORMADORA,
];

/**
 * Organización propietaria demostrativa de los cinco programas iniciales.
 *
 * Es un identificador opaco de organización dentro de un tenant. El tipo base
 * `MunicipalityPrograma` no exige que sea una alcaldía: `municipioId` es
 * opcional y ninguna función de esta feature condiciona su comportamiento a que
 * el programa sea municipal.
 */
const PROGRAMA_ORGANIZACION_DEMO = 'org-demo-alcaldia';

/**
 * Cinco programas demostrativos (FR-03), fieles a los ejemplos de las líneas
 * 841–852 de la referencia aprobada.
 *
 * Son fixtures configurables, NO el catálogo cerrado de programas que la
 * plataforma podrá admitir. Toda cifra, entidad, fecha y fuente es ficticia y
 * demostrativa: no es información oficial, no procede de ninguna integración y
 * no prueba adopción, convenio ni certificación.
 *
 * Los importes conservan los montos del prototipo y declaran además el monto
 * comprometido que el prototipo no mostraba. Son literales independientes: esta
 * vista no deriva el disponible, no calcula porcentajes y no atribuye semántica
 * contable, que pertenece a A-04.
 */
export const municipalityProgramasDemo: readonly MunicipalityPrograma[] = [
  {
    id: 'pro-demo-domiciliaria',
    organizacionId: PROGRAMA_ORGANIZACION_DEMO,
    municipioId: TERRITORIO_MUNICIPIO_ID,
    nombre: 'Atención domiciliaria',
    objetivo:
      'Garantizar valoración, atención y seguimiento en el hogar de personas con dependencia.',
    poblacionIds: ['MAYORES_60', 'DISCAPACIDAD', 'CUIDADO_EN_CASA'],
    origen: 'MUNICIPAL',
    entidadFormuladora: 'Secretaría de Salud',
    entidadResponsable: 'Secretaría de Salud',
    ejecutores: [EJECUTOR_HOSPITAL],
    vigencia: {
      inicio: '2026-01-01',
      fin: '2026-12-31',
      etiqueta: '1 ene 2026 – 31 dic 2026',
    },
    presupuesto: { moneda: 'COP', asignado: '$680 M' },
    avanceFisico: {
      metaFisica: 540,
      resultadoFisico: 412,
      unidad: 'personas',
      resultadoEtiqueta: 'Atendidas',
      porcentaje: 76,
      porcentajeTexto: '76 %',
      tono: 'verde',
    },
    avanceFinanciero: {
      comprometido: '$160 M',
      ejecutado: '$402 M',
      disponible: '$118 M',
      porcentaje: 59,
      porcentajeTexto: '59 %',
      tono: 'verde',
    },
    territorio: {
      ambitoIds: [TERRITORIO_MUNICIPIO_ID],
      resumen: 'Todo el municipio',
    },
    cobertura: {
      valor: '412 personas',
      denominador: '1.640 que requieren cuidado domiciliario',
      porcentajeTexto: '25 %',
    },
    beneficiariosUnicos: '412',
    poblacionAtendida: '412 personas',
    actividad: { etiqueta: 'ATENCIONES', valor: '1.204' },
    evidencias: {
      registradas: '96',
      pendientes: '5',
      actividadesConSoporte: '96 de 101',
      estadoDocumental: 'Con pendientes de carga',
      tono: 'amarillo',
    },
    estado: 'ACTIVO',
    cierre: null,
    procedencia: MUNICIPALITY_PROCEDENCIA_DEMO,
  },
  {
    id: 'pro-demo-adulto-mayor',
    organizacionId: PROGRAMA_ORGANIZACION_DEMO,
    municipioId: TERRITORIO_MUNICIPIO_ID,
    nombre: 'Adulto mayor',
    objetivo:
      'Envejecimiento saludable, identificación y acompañamiento de personas mayores de 60 años.',
    poblacionIds: ['MAYORES_60'],
    origen: 'NACIONAL',
    entidadFormuladora: 'Entidad nacional formuladora (demostrativa)',
    entidadResponsable: 'Secretaría de Integración Social',
    ejecutores: [EJECUTOR_HOSPITAL, EJECUTOR_FUNDACION],
    vigencia: {
      inicio: '2026-01-01',
      fin: '2026-12-31',
      etiqueta: '1 ene 2026 – 31 dic 2026',
    },
    presupuesto: { moneda: 'COP', asignado: '$420 M' },
    avanceFisico: {
      metaFisica: 3560,
      resultadoFisico: 2196,
      unidad: 'personas',
      resultadoEtiqueta: 'Atendidas',
      porcentaje: 62,
      porcentajeTexto: '62 %',
      tono: 'teal',
    },
    avanceFinanciero: {
      comprometido: '$100 M',
      ejecutado: '$248 M',
      disponible: '$72 M',
      porcentaje: 59,
      porcentajeTexto: '59 %',
      tono: 'verde',
    },
    territorio: {
      ambitoIds: [TERRITORIO_MUNICIPIO_ID],
      resumen: 'Todo el municipio',
    },
    cobertura: {
      valor: '2.196 personas',
      denominador: '6.117 personas de 60 años o más',
      porcentajeTexto: '36 %',
    },
    beneficiariosUnicos: '2.196',
    poblacionAtendida: '2.196 personas',
    actividad: { etiqueta: 'ATENCIONES', valor: '3.140' },
    evidencias: {
      registradas: '62',
      pendientes: '4',
      actividadesConSoporte: '62 de 66',
      estadoDocumental: 'Con pendientes de carga',
      tono: 'amarillo',
    },
    estado: 'ACTIVO',
    cierre: null,
    procedencia: MUNICIPALITY_PROCEDENCIA_DEMO,
  },
  {
    id: 'pro-demo-discapacidad',
    organizacionId: PROGRAMA_ORGANIZACION_DEMO,
    municipioId: TERRITORIO_MUNICIPIO_ID,
    nombre: 'Discapacidad',
    objetivo:
      'Caracterización, atención y apoyos para personas con discapacidad y sus familias.',
    poblacionIds: ['DISCAPACIDAD'],
    origen: 'DEPARTAMENTAL',
    entidadFormuladora: 'Gobernación departamental (demostrativa)',
    entidadResponsable: 'Secretaría de Salud',
    ejecutores: [EJECUTOR_HOSPITAL, EJECUTOR_OPERADOR_SOCIAL],
    vigencia: {
      inicio: '2026-02-01',
      fin: '2026-12-31',
      etiqueta: '1 feb 2026 – 31 dic 2026',
    },
    presupuesto: { moneda: 'COP', asignado: '$260 M' },
    avanceFisico: {
      metaFisica: 2580,
      resultadoFisico: 1050,
      unidad: 'personas',
      resultadoEtiqueta: 'Atendidas',
      porcentaje: 41,
      porcentajeTexto: '41 %',
      tono: 'amarillo',
    },
    avanceFinanciero: {
      comprometido: '$60 M',
      ejecutado: '$134 M',
      disponible: '$66 M',
      porcentaje: 52,
      porcentajeTexto: '52 %',
      tono: 'amarillo',
    },
    territorio: {
      ambitoIds: [TERRITORIO_URBANA.id, TERRITORIO_RURAL.id],
      resumen: 'Zona urbana y zona rural',
    },
    cobertura: {
      valor: '1.050 personas',
      denominador: '2.845 personas con discapacidad',
      porcentajeTexto: '37 %',
    },
    beneficiariosUnicos: '1.050',
    poblacionAtendida: '1.050 personas',
    actividad: { etiqueta: 'ATENCIONES', valor: '1.688' },
    evidencias: {
      registradas: '41',
      pendientes: '3',
      actividadesConSoporte: '41 de 44',
      estadoDocumental: 'Con pendientes de carga',
      tono: 'amarillo',
    },
    estado: 'SUSPENDIDO',
    cierre: null,
    procedencia: MUNICIPALITY_PROCEDENCIA_DEMO,
  },
  {
    id: 'pro-demo-cuidado-en-casa',
    organizacionId: PROGRAMA_ORGANIZACION_DEMO,
    municipioId: TERRITORIO_MUNICIPIO_ID,
    nombre: 'Cuidado en casa',
    objetivo:
      'Apoyo a hogares que sostienen cuidados permanentes y alivio para el cuidador.',
    poblacionIds: ['CUIDADO_EN_CASA', 'MAYORES_60'],
    origen: 'MUNICIPAL',
    entidadFormuladora: 'Secretaría de Integración Social',
    entidadResponsable: 'Secretaría de Integración Social',
    ejecutores: [EJECUTOR_HOSPITAL],
    vigencia: {
      inicio: '2026-01-01',
      fin: '2026-12-31',
      etiqueta: '1 ene 2026 – 31 dic 2026',
    },
    presupuesto: { moneda: 'COP', asignado: '$150 M' },
    avanceFisico: {
      metaFisica: 1940,
      resultadoFisico: 928,
      unidad: 'personas',
      resultadoEtiqueta: 'Atendidas',
      porcentaje: 48,
      porcentajeTexto: '48 %',
      tono: 'amarillo',
    },
    avanceFinanciero: {
      comprometido: '$50 M',
      ejecutado: '$68 M',
      disponible: '$32 M',
      porcentaje: 45,
      porcentajeTexto: '45 %',
      tono: 'amarillo',
    },
    territorio: {
      ambitoIds: [TERRITORIO_URBANA.id],
      resumen: 'Zona urbana',
    },
    cobertura: {
      valor: '928 personas',
      denominador: '1.640 que requieren cuidado domiciliario',
      porcentajeTexto: '57 %',
    },
    beneficiariosUnicos: '928',
    poblacionAtendida: '928 personas',
    actividad: { etiqueta: 'ATENCIONES', valor: '968' },
    evidencias: {
      registradas: '25',
      pendientes: '2',
      actividadesConSoporte: '25 de 27',
      estadoDocumental: 'Con pendientes de carga',
      tono: 'amarillo',
    },
    estado: 'ACTIVO',
    cierre: null,
    procedencia: MUNICIPALITY_PROCEDENCIA_DEMO,
  },
  {
    id: 'pro-demo-formacion-cuidadores',
    organizacionId: PROGRAMA_ORGANIZACION_DEMO,
    municipioId: TERRITORIO_MUNICIPIO_ID,
    nombre: 'Formación de cuidadores',
    objetivo:
      'Fortalecer capacidades de quienes cuidan, con formación y certificación.',
    poblacionIds: ['CUIDADO_EN_CASA'],
    origen: 'INSTITUCIONAL_OTRO',
    entidadFormuladora: 'Entidad de formación (demostrativa)',
    entidadResponsable: 'Secretaría de Desarrollo Social',
    ejecutores: [EJECUTOR_ENTIDAD_FORMADORA, EJECUTOR_OPERADOR_FORMACION],
    vigencia: {
      inicio: '2025-02-01',
      fin: '2025-12-31',
      etiqueta: '1 feb 2025 – 31 dic 2025',
    },
    presupuesto: { moneda: 'COP', asignado: '$70 M' },
    avanceFisico: {
      metaFisica: 1500,
      resultadoFisico: 442,
      unidad: 'certificados',
      resultadoEtiqueta: 'Certificados emitidos',
      porcentaje: 29,
      porcentajeTexto: '29 %',
      tono: 'rojo',
    },
    avanceFinanciero: {
      comprometido: '$40 M',
      ejecutado: '$18 M',
      disponible: '$12 M',
      porcentaje: 26,
      porcentajeTexto: '26 %',
      tono: 'rojo',
    },
    territorio: {
      ambitoIds: [TERRITORIO_MUNICIPIO_ID],
      resumen: 'Todo el municipio',
    },
    cobertura: {
      valor: '1.164 cuidadores vinculados',
      denominador: null,
      porcentajeTexto: null,
    },
    beneficiariosUnicos: '1.164',
    poblacionAtendida: '1.164 cuidadores vinculados',
    actividad: { etiqueta: 'CERTIFICADOS', valor: '442' },
    evidencias: {
      registradas: '8',
      pendientes: '4',
      actividadesConSoporte: '8 de 12',
      estadoDocumental: 'Incompleto al cierre',
      tono: 'rojo',
    },
    estado: 'FINALIZADO',
    cierre: {
      presupuestoAsignado: '$70 M',
      ejecutado: '$18 M',
      saldo: '$12 M',
      porcentajeFinancieroTexto: '26 %',
      meta: '1.500 certificados',
      resultado: '442 certificados',
      porcentajeFisicoTexto: '29 %',
      beneficiariosUnicos: '1.164 cuidadores vinculados',
      evidenciasCompletas: '8',
      evidenciasFaltantes: '4',
      informeFinal: 'Pendiente',
      nota: 'Un programa finalizado sin informe final no acredita cumplimiento. Esta pantalla no genera, no almacena y no firma el informe final.',
    },
    procedencia: MUNICIPALITY_PROCEDENCIA_DEMO,
  },
];

/**
 * Vista Programas demostrativa (líneas 271–315 y 841–852 de la referencia
 * aprobada), con la ampliación aprobada **+ Nuevo programa**.
 *
 * Privacidad municipal: solo agregados institucionales. No hay nombre de
 * persona, documento, contacto, ubicación individual, información clínica
 * nominativa ni compensación individual, y ninguna tarjeta abre drill-down,
 * búsqueda ni acceso a un registro.
 */
export const municipalityProgramasConfigDemo: MunicipalityProgramasConfig = {
  titulo: 'Programas',
  descripcion: 'Beneficiarios, cobertura, ejecución y cumplimiento de meta por programa.',
  accionNuevoSimbolo: '+',
  accionNuevo: 'Nuevo programa',
  deduplicacion:
    'Una persona puede estar en varios programas y cuenta una sola vez en el total municipal. Las tarjetas no se suman: el total de beneficiarios únicos vive en Población beneficiaria.',
  listaResumen:
    'Lista de programas demostrativos. Cada tarjeta reúne poblaciones, entidades, ejecutores, estado, avance físico, avance financiero y resumen documental.',
  limiteFinanciero:
    'El presupuesto se presenta como resumen declarado. Esta pantalla no registra movimientos financieros ni gestión documental, y no califica la ejecución de ningún programa. El detalle financiero y documental completo se implementará en una tarea posterior.',
  etiquetas: {
    origen: 'Origen',
    entidadFormuladora: 'entidad formuladora',
    entidadResponsable: 'entidad responsable',
    poblaciones: 'Poblaciones objetivo',
    ejecutores: 'Ejecutores',
    beneficiariosUnicos: 'BENEFICIARIOS ÚNICOS',
    poblacionAtendida: 'POBLACIÓN ATENDIDA',
    cobertura: 'COBERTURA',
    territorio: 'TERRITORIO',
    vigencia: 'VIGENCIA',
    avanceFinanciero: 'Ejecución financiera',
    presupuestoAsignado: 'Presupuesto asignado',
    comprometido: 'Comprometido',
    ejecutado: 'Ejecutado',
    disponible: 'Disponible',
    moneda: 'Moneda',
    avanceFisico: 'Cumplimiento físico',
    meta: 'Meta',
    evidencias: 'Evidencias',
    evidenciasRegistradas: 'Evidencias registradas',
    evidenciasPendientes: 'Evidencias pendientes',
    actividadesConSoporte: 'Actividades con soporte',
    estadoDocumental: 'Estado documental',
    cierre: 'Cierre del programa',
    cierreSaldo: 'Saldo',
    cierreInformeFinal: 'Informe final',
    cierreEvidenciasCompletas: 'Evidencias completas',
    cierreEvidenciasFaltantes: 'Evidencias faltantes',
    sinRegistro: 'Sin registro',
    sinDenominador: 'sin denominador declarado',
  },
  poblacionesBase: MUNICIPALITY_POBLACIONES_BASE,
  origenes: MUNICIPALITY_PROGRAMA_ORIGENES,
  estados: MUNICIPALITY_PROGRAMA_ESTADOS,
  tiposEjecutor: MUNICIPALITY_EJECUTOR_TIPOS,
  ejecutoresDisponibles: MUNICIPALITY_EJECUTORES_DEMO,
  programas: municipalityProgramasDemo,
  formulario: {
    titulo: 'Nuevo programa',
    descripcion:
      'Crea un borrador local y demostrativo. No aprueba, no activa, no guarda y no envía nada: el borrador desaparece al recargar la página.',
    campos: {
      nombre: 'Nombre',
      poblaciones: 'Población(es)',
      origen: 'Origen',
      entidadFormuladora: 'Entidad formuladora',
      entidadResponsable: 'Entidad responsable',
      ejecutores: 'Ejecutor(es)',
      vigenciaInicio: 'Inicio de la vigencia',
      vigenciaFin: 'Fin de la vigencia',
      presupuesto: 'Presupuesto',
      meta: 'Meta',
    },
    grupoVigencia: 'Vigencia',
    estadoInicialEtiqueta: 'Estado inicial',
    estadoInicial: 'BORRADOR',
    estadoInicialAyuda:
      'Todo programa creado aquí nace en Borrador. Desde este formulario no se puede aprobar ni activar.',
    moneda: 'COP',
    unidadMeta: 'personas',
    requerido: 'obligatorio',
    resumenErroresTitulo: 'Revisa estos datos antes de crear el borrador',
    errores: {
      nombre: 'Escribe el nombre del programa.',
      poblaciones: 'Selecciona al menos una población.',
      origen: 'Selecciona el origen del programa.',
      entidadFormuladora: 'Escribe la entidad formuladora.',
      entidadResponsable: 'Escribe la entidad responsable.',
      ejecutores: 'Selecciona al menos un ejecutor.',
      vigenciaInicio: 'Indica la fecha de inicio de la vigencia.',
      vigenciaFin: 'Indica la fecha de fin de la vigencia.',
      presupuesto: 'Escribe el presupuesto en números, sin valores negativos.',
      meta: 'Escribe la meta en números, sin valores negativos.',
    },
    errorVigenciaOrden: 'La fecha de fin no puede ser anterior a la de inicio.',
    cancelar: 'Cancelar',
    crear: 'Crear borrador',
    anuncioCreado:
      'Programa borrador creado de forma demostrativa. No fue aprobado, activado ni guardado: desaparece al recargar la página.',
    resultadoEtiqueta: 'Atendidas',
    actividadEtiqueta: 'ACTIVIDADES',
  },
  procedencia: MUNICIPALITY_PROCEDENCIA_DEMO,
  atribucion: MUNICIPALITY_ATRIBUCION_PENDIENTE,
};

/* ============ TASK-ALCALDIA-A-04: presupuesto, movimientos y evidencias ==== */

/**
 * Modelo demostrativo de presupuesto, movimientos financieros y evidencias
 * (TASK-ALCALDIA-A-04, §6).
 *
 * Naturaleza: TODO lo que sigue es fixture local de diseño, ficticio y
 * configurable. No es contabilidad, no es un asiento, no es un movimiento
 * bancario, no procede de ninguna fuente oficial y no prueba ninguna
 * integración activa. Los nombres de estos tipos son orientativos para el
 * frontend: NO son contratos productivos, DTO de API ni esquema de base de
 * datos.
 *
 * Semántica demostrativa aprobada (FR-03 y FR-06), válida SOLO para esta demo:
 *
 * - `ASIGNADO`: presupuesto aprobado/asignado al programa.
 * - `COMPROMETIDO`: recurso reservado o comprometido que todavía no se pagó.
 * - `EJECUTADO`: dinero pagado Y validado en el fixture.
 * - `DISPONIBLE`: saldo demostrativo restante del fixture.
 *
 * Una factura, una cuenta de cobro o un soporte cargado NO convierten por sí
 * solos un movimiento en pagado ni en ejecutado, y no mueven ninguna métrica.
 * La secuencia contable futura (`ASIGNADO → COMPROMETIDO → CAUSADO/OBLIGADO →
 * PAGADO`), sus transiciones, periodos, cierres, correcciones, aprobadores y
 * autoridad del sistema maestro son decisiones materiales pendientes: aquí solo
 * se enuncian, no se implementan ni se ejecutan.
 */

/**
 * Importe declarado del fixture (§6, regla de integridad 6).
 *
 * El texto es la etiqueta formateada que se muestra y `millones` es el valor
 * numérico declarado en millones de pesos, que existe únicamente para que las
 * pruebas locales verifiquen coherencia. Ninguna vista parsea el texto ni
 * deriva el número: son dos declaraciones del mismo fixture.
 */
export interface MunicipalityMonto {
  readonly texto: string;
  /** Valor declarado en millones de COP. Solo verificación local. */
  readonly millones: number;
}

/** Clase de fuente de financiación del catálogo demostrativo (FR-05). */
export type MunicipalityFuenteTipo =
  | 'SGP'
  | 'RECURSOS_PROPIOS'
  | 'NACION'
  | 'DEPARTAMENTO'
  | 'ADRES'
  | 'CONVENIO'
  | 'OTRA';

/**
 * Fuente de financiación configurable.
 *
 * `isAdresRelated` significa exactamente que el recurso se administra o se gira
 * mediante ADRES en este fixture. NO significa que ADRES sea propietario,
 * financiador universal, aprobador, evaluador ni origen de todo el presupuesto
 * municipal, y no habilita ninguna consulta a ADRES.
 */
export interface MunicipalityFuenteFinanciacion {
  readonly id: string;
  readonly etiqueta: string;
  readonly tipo: MunicipalityFuenteTipo;
  readonly isAdresRelated: boolean;
  /** Marca explícita de fixture; ninguna fuente aquí es oficial. */
  readonly demo: true;
}

/**
 * Estado financiero del movimiento (FR-06.1).
 *
 * Enuncia la secuencia conceptual futura. No es una máquina de estados
 * productiva: esta vista no aplica transiciones, no causa, no obliga, no paga y
 * no cierra periodos.
 */
export type MunicipalityEstadoFinanciero =
  | 'ASIGNADO'
  | 'COMPROMETIDO'
  | 'CAUSADO_OBLIGADO'
  | 'PAGADO';

/**
 * Estado del soporte/validación del movimiento (FR-06.2).
 *
 * Es un estado ADMINISTRATIVO del soporte, distinto e independiente del estado
 * financiero: un movimiento pagado puede seguir en revisión y un movimiento con
 * factura puede no estar pagado.
 */
export type MunicipalityEstadoValidacion =
  | 'PENDIENTE'
  | 'EN_REVISION'
  | 'FALTA_SOPORTE'
  | 'VALIDADA';

/** Estado demostrativo de una evidencia (FR-11). Nunca es un estado financiero. */
export type MunicipalityEvidenciaEstado =
  | 'COMPLETA'
  | 'PENDIENTE'
  | 'FALTA_SOPORTE'
  | 'EN_REVISION'
  | 'VALIDADA'
  | 'REQUIERE_CORRECCION';

/** Tipo demostrativo de soporte autorizado (FR-11). */
export type MunicipalityEvidenciaTipo =
  | 'FACTURA'
  | 'CUENTA_DE_COBRO'
  | 'RECIBO'
  | 'COMPROBANTE_DE_PAGO'
  | 'CONTRATO'
  | 'CONVENIO'
  | 'ORDEN'
  | 'FOTOGRAFIA'
  | 'CONSTANCIA'
  | 'OTRO_SOPORTE';

/**
 * Origen visible del dato (FR-08).
 *
 * Declarar un origen NO prueba que exista conexión, importación, sincronización
 * ni acuerdo con ese sistema: describe de dónde dice proceder el fixture.
 */
export type MunicipalityMovimientoOrigen =
  | 'ELIGEME'
  | 'SISTEMA_HOSPITAL'
  | 'SISTEMA_ALCALDIA'
  | 'IMPORTADO'
  | 'FUENTE_OFICIAL_EXTERNA';

/**
 * Estado de sincronización preparatorio (§13).
 *
 * Los seis valores existen como semántica futura. Los fixtures de A-04 solo
 * declaran `NOT_CONNECTED` y `NOT_APPLICABLE`, porque no hay integración: los
 * cuatro restantes describirían un resultado de conciliación que aquí no
 * ocurre y que esta tarea no implementa.
 */
export type MunicipalityMovimientoSyncStatus =
  | 'NOT_CONNECTED'
  | 'NOT_APPLICABLE'
  | 'PENDING'
  | 'MATCHED'
  | 'DIFFERENCE'
  | 'CONFLICT';

/**
 * Referencia a un registro en otro sistema (FR-09.2).
 *
 * `externalId` es opcional y NO es identidad global ni identidad interna: la
 * identidad, la idempotencia, el matching y la deduplicación productiva siguen
 * pendientes y requerirán tenant/institución, sistema fuente y una estrategia
 * gobernada.
 */
export interface MunicipalityReferenciaExterna {
  readonly sourceSystem: string;
  /** Institución demostrativa; no implementa tenant ni concede acceso. */
  readonly institutionId: string;
  readonly externalId: string | null;
}

/**
 * Metadatos preparatorios de procedencia y sincronización (FR-13.2).
 *
 * Existen para que una conexión futura no obligue a rediseñar el modelo. No
 * hay red, no hay reintento, no hay cola, no hay conflicto y no hay
 * conciliación: cuando `syncStatus` es `NOT_CONNECTED`, la interfaz lo escribe
 * como «Conexión no habilitada» y `lastSyncedAt` permanece en `null`.
 */
export interface MunicipalityMovimientoSync {
  readonly masterSystem: string;
  readonly syncStatus: MunicipalityMovimientoSyncStatus;
  readonly lastSyncedAt: string | null;
  readonly referencias: readonly MunicipalityReferenciaExterna[];
}

/**
 * Quién y cuándo, en términos institucionales (FR-08).
 *
 * Se registra el ROL o la dependencia, nunca una persona identificada: el
 * movimiento municipal es un dato administrativo agregado y no necesita
 * identificar a nadie para ser trazable en esta demo.
 */
export interface MunicipalityRegistroRef {
  readonly rol: string;
  readonly fecha: string;
}

/**
 * Contexto de visibilidad de un registro financiero (FR-09.1).
 *
 * Un movimiento es UN solo registro canónico que puede ser visible para varias
 * experiencias; no se copia por audiencia. Declarar una audiencia aquí NO
 * concede permiso: la autorización real será server-side, por tenant,
 * organización, municipio, programa, finalidad, periodo y relación, y con
 * denegación por defecto.
 */
export type MunicipalityAudiencia = 'ALCALDIA' | 'HOSPITAL';

/**
 * Movimiento financiero demostrativo (§6).
 *
 * Registro único: no existe una copia para Alcaldía y otra para Hospital. La
 * conexión real con Hospital, su contrato, su mapeo y su conciliación
 * corresponden a H-06B y no se implementan aquí.
 */
export interface MunicipalityMovimientoFinanciero {
  /** Identificador interno opaco. No es el `externalId` de ningún sistema. */
  readonly id: string;
  /** Fecha de presentación del fixture. */
  readonly fecha: string;
  /** Misma fecha en formato `AAAA-MM-DD`, para orden y verificación local. */
  readonly fechaIso: string;
  /** Referencia visible de la factura, cuenta u orden. */
  readonly referencia: string;
  readonly tipoSoporte: MunicipalityEvidenciaTipo;
  /** Concepto administrativo; no es visible en la tabla. */
  readonly concepto: string;
  /** Actividad soportada, tal como la nombra el fixture. */
  readonly actividad: string;
  /** Debe resolver contra un programa de A-03. */
  readonly programaId: string;
  /** Debe resolver contra el catálogo de fuentes. */
  readonly fuenteId: string;
  /** Proveedor o entidad; siempre una organización ficticia, nunca una persona. */
  readonly entidad: string;
  readonly valorTexto: string;
  /** Valor declarado en pesos. Solo verificación local; nadie parsea el texto. */
  readonly valorPesos: number;
  readonly moneda: string;
  readonly estadoFinanciero: MunicipalityEstadoFinanciero;
  readonly estadoValidacion: MunicipalityEstadoValidacion;
  readonly origen: MunicipalityMovimientoOrigen;
  readonly registro: MunicipalityRegistroRef;
  /** Revisión declarada; `null` cuando el fixture no la declara. */
  readonly revision: MunicipalityRegistroRef | null;
  readonly sync: MunicipalityMovimientoSync;
  /** Contextos de visibilidad del MISMO registro; no son copias. */
  readonly audiencias: readonly MunicipalityAudiencia[];
  readonly procedencia: MunicipalityProcedenciaRef;
  readonly tono: MunicipalityTono;
}

/**
 * Evidencia demostrativa (§6).
 *
 * Solo metadatos: no hay archivo, blob, enlace, miniatura, versión, checksum,
 * antimalware ni almacenamiento. La evidencia referencia su movimiento por
 * identificador y nunca lo duplica.
 */
export interface MunicipalityEvidenciaFinanciera {
  readonly id: string;
  readonly referencia: string;
  readonly tipo: MunicipalityEvidenciaTipo;
  /** Debe resolver contra un movimiento existente. */
  readonly movimientoId: string;
  readonly entidad: string;
  readonly programaId: string;
  readonly fuenteId: string;
  readonly valorTexto: string;
  readonly valorPesos: number;
  readonly moneda: string;
  readonly estado: MunicipalityEvidenciaEstado;
  /** Actividad que el soporte respalda. */
  readonly actividad: string;
  /** Institución dueña del objeto soportado. */
  readonly institucion: string;
  readonly origen: MunicipalityMovimientoOrigen;
  readonly registro: MunicipalityRegistroRef;
  readonly revision: MunicipalityRegistroRef | null;
  readonly procedencia: MunicipalityProcedenciaRef;
  readonly tono: MunicipalityTono;
}

/**
 * Aprobación futura de una redistribución (FR-10.3).
 *
 * La política de segunda aprobación es configurable y NO está decidida: no hay
 * umbral, no hay monto fijo, no hay aprobador designado y no hay flujo. Por eso
 * `requiereSegundaAprobacion`, `politicaId` y `politicaVersion` son nulos: la
 * ausencia significa exactamente que la decisión sigue pendiente.
 */
export interface MunicipalityRedistribucionAprobacion {
  readonly requiereSegundaAprobacion: boolean | null;
  readonly politicaId: string | null;
  readonly politicaVersion: string | null;
  readonly aprobadores: readonly string[];
}

/**
 * Contrato frontend de una redistribución presupuestal futura (FR-10).
 *
 * A-04 NO implementa redistribución: no hay botón, formulario, diálogo,
 * borrador, instancia, persistencia ni efecto sobre ningún saldo. Este tipo
 * existe únicamente para que una tarea posterior pueda implementarla sin
 * rediseñar el modelo. Validación, trazabilidad, auditoría y efectos sobre
 * saldos corresponden a esa tarea.
 */
export interface MunicipalityRedistribucionContrato {
  readonly programaOrigenId: string;
  readonly programaDestinoId: string;
  readonly valorPesos: number;
  readonly moneda: string;
  readonly motivo: string;
  /** Rol institucional responsable; nunca una persona identificada. */
  readonly responsableRol: string;
  readonly fecha: string;
  readonly aprobacion: MunicipalityRedistribucionAprobacion;
}

/** Asignación declarada de una fuente a un programa (FR-04.2 y FR-05). */
export interface MunicipalityAsignacionFuente {
  readonly fuenteId: string;
  readonly monto: MunicipalityMonto;
}

/** Composición agregada del presupuesto por fuente. */
export interface MunicipalityFuenteAgregada {
  readonly fuenteId: string;
  readonly monto: MunicipalityMonto;
  readonly porcentaje: number;
  readonly porcentajeTexto: string;
}

/**
 * Costo promedio declarado (FR-14.5).
 *
 * Solo existe cuando el fixture declara numerador, denominador y metodología.
 * No se deriva, no se calcula en la vista y su ausencia significa exactamente
 * que no puede presentarse. La metodología aquí escrita es demostrativa: la
 * metodología municipal de atribución y de beneficiarios únicos sigue siendo
 * una decisión material pendiente.
 */
export interface MunicipalityCostoPromedio {
  readonly texto: string;
  readonly numerador: string;
  readonly denominador: string;
  readonly metodologia: string;
}

/**
 * Presupuesto de un programa (FR-04).
 *
 * Solo declara lo que A-03 no tiene: el desglose por fuente, el costo promedio
 * y los importes numéricos de verificación. Los importes visibles, la meta
 * física y los porcentajes se leen del programa de A-03 por `programaId`: esta
 * vista NO recalcula, NO reinterpreta y NO duplica la entidad Programa.
 */
export interface MunicipalityProgramaPresupuesto {
  readonly programaId: string;
  readonly fuentes: readonly MunicipalityAsignacionFuente[];
  /** Importes en millones de COP; existen solo para verificación local. */
  readonly montos: {
    readonly asignado: number;
    readonly comprometido: number;
    readonly ejecutado: number;
    readonly disponible: number;
  };
  readonly costoPromedio: MunicipalityCostoPromedio | null;
}

/**
 * Resumen presupuestal general (FR-03).
 *
 * `identidadContable` documenta explícitamente la única identidad que este
 * fixture satisface (`asignado = comprometido + ejecutado + disponible`). Es
 * una coherencia interna del fixture, NO una fórmula contable universal ni una
 * regla oficial: la fórmula productiva sigue pendiente.
 */
export interface MunicipalityPresupuestoResumen {
  readonly asignado: MunicipalityMonto;
  readonly ejecutado: MunicipalityMonto;
  readonly comprometido: MunicipalityMonto;
  readonly disponible: MunicipalityMonto;
  readonly porcentajeEjecucion: number;
  readonly porcentajeEjecucionTexto: string;
  readonly porcentajeComprometido: number;
  readonly porcentajeComprometidoTexto: string;
  readonly identidadContable: string;
}

/** Métrica del resumen, en el orden conceptual aprobado. */
export interface MunicipalityPresupuestoMetrica {
  readonly id: 'asignado' | 'ejecutado' | 'comprometido' | 'disponible' | 'ejecucion';
  readonly titulo: string;
  readonly valor: string;
  readonly aclaracion: string;
  readonly tono: MunicipalityTono;
}

/** Definición escrita de un término financiero demostrativo. */
export interface MunicipalityDefinicion {
  readonly id: string;
  readonly termino: string;
  readonly definicion: string;
}

/** Entrada de la leyenda de la barra de ejecución. */
export interface MunicipalityLeyendaItem {
  readonly id: string;
  readonly etiqueta: string;
  readonly valor: string;
  readonly tono: MunicipalityTono;
}

/**
 * Desglose por población base (FR-14.1).
 *
 * Adulto mayor, Discapacidad y Cuidado en casa son POBLACIONES del catálogo
 * base, no programas. Los importes son literales del fixture: esta vista no
 * prorratea, no atribuye gasto a ninguna persona por pertenecer a una
 * población y no suma poblaciones para obtener beneficiarios.
 */
export interface MunicipalityPresupuestoPoblacion {
  readonly poblacionId: MunicipalityPoblacionBaseId;
  readonly etiqueta: string;
  readonly asignado: MunicipalityMonto;
  readonly ejecutado: MunicipalityMonto;
  readonly beneficiariosUnicos: string;
  readonly costoPromedio: MunicipalityCostoPromedio | null;
  readonly atribucion: MunicipalityAtribucionRef;
}

/** Encabezados de la tabla «Por población», en su orden aprobado. */
export interface MunicipalityPoblacionPresupuestoColumnas {
  readonly poblacion: string;
  readonly asignado: string;
  readonly ejecutado: string;
  readonly beneficiarios: string;
  readonly costoPromedio: string;
}

/** Encabezados de la tabla de composición por fuente. */
export interface MunicipalityFuenteColumnas {
  readonly fuente: string;
  readonly monto: string;
  readonly participacion: string;
}

/** Etiquetas visibles del desglose por programa. */
export interface MunicipalityPresupuestoEtiquetas {
  readonly asignado: string;
  readonly comprometido: string;
  readonly ejecutado: string;
  readonly disponible: string;
  readonly ejecucionFinanciera: string;
  readonly metaFisica: string;
  readonly cumplimientoFisico: string;
  readonly fuentes: string;
  readonly beneficiariosUnicos: string;
  readonly costoPromedio: string;
  readonly actividad: string;
  readonly evidencias: string;
  readonly resultado: string;
  readonly moneda: string;
  readonly sinRegistro: string;
  readonly numerador: string;
  readonly denominador: string;
  readonly metodologia: string;
}

/** Configuración completa de la vista «Presupuesto y ejecución». */
export interface MunicipalityPresupuestoConfig {
  readonly titulo: string;
  readonly descripcion: string;
  readonly resumenTitulo: string;
  readonly resumenAccesible: string;
  readonly resumen: MunicipalityPresupuestoResumen;
  readonly metricas: readonly MunicipalityPresupuestoMetrica[];
  readonly ejecucionTitulo: string;
  readonly leyenda: readonly MunicipalityLeyendaItem[];
  readonly semanticaTitulo: string;
  readonly semantica: readonly MunicipalityDefinicion[];
  readonly secuenciaTitulo: string;
  readonly secuencia: readonly string[];
  readonly secuenciaNota: string;
  readonly facturaNota: string;
  readonly fuentesTitulo: string;
  readonly fuentesResumen: string;
  readonly fuentesColumnas: MunicipalityFuenteColumnas;
  readonly fuentesAgregadas: readonly MunicipalityFuenteAgregada[];
  readonly fuentesNota: string;
  readonly adresNota: string;
  readonly programasTitulo: string;
  readonly programasResumen: string;
  readonly programasNota: string;
  readonly cadenaNota: string;
  readonly etiquetas: MunicipalityPresupuestoEtiquetas;
  readonly programas: readonly MunicipalityProgramaPresupuesto[];
  readonly poblacionTitulo: string;
  readonly poblacionResumen: string;
  readonly poblacionColumnas: MunicipalityPoblacionPresupuestoColumnas;
  readonly poblacion: readonly MunicipalityPresupuestoPoblacion[];
  readonly poblacionNota: string;
  readonly poblacionAtribucionNota: string;
  readonly redistribucionNota: string;
  readonly procedencia: MunicipalityProcedenciaRef;
}

/** Nivel de evidencia agregado de la vista Evidencias (FR-11). */
export interface MunicipalityNivelEvidencia {
  readonly titulo: string;
  readonly porcentaje: number;
  readonly porcentajeTexto: string;
  readonly actividadesConSoporte: number;
  readonly actividadesEjecutadas: number;
  readonly pendientes: number;
  readonly detalle: string;
}

/** Encabezados de la tabla «Facturas y soportes», en su orden aprobado. */
export interface MunicipalityMovimientoColumnas {
  readonly fecha: string;
  readonly referencia: string;
  readonly entidad: string;
  readonly programa: string;
  readonly fuente: string;
  readonly valor: string;
  readonly estado: string;
  readonly soporte: string;
  readonly origen: string;
  readonly accion: string;
}

/** Etiquetas visibles del detalle local de un movimiento (FR-08). */
export interface MunicipalityDetalleEtiquetas {
  readonly titulo: string;
  readonly idInterno: string;
  readonly referencia: string;
  readonly fecha: string;
  readonly concepto: string;
  readonly tipoSoporte: string;
  readonly programa: string;
  readonly fuente: string;
  readonly entidad: string;
  readonly valor: string;
  readonly moneda: string;
  readonly estadoFinanciero: string;
  readonly estadoValidacion: string;
  readonly origen: string;
  readonly sistemaMaestro: string;
  readonly referenciaExterna: string;
  readonly sistemaFuente: string;
  readonly institucion: string;
  readonly sincronizacion: string;
  readonly ultimaSincronizacion: string;
  readonly registradoPor: string;
  readonly revisadoPor: string;
  readonly audiencias: string;
  readonly evidencias: string;
  readonly evidenciaTipo: string;
  readonly evidenciaEstado: string;
  readonly evidenciaActividad: string;
  readonly evidenciaInstitucion: string;
  readonly procedencia: string;
  readonly cerrar: string;
  readonly sinRegistro: string;
  readonly sinSincronizacion: string;
  readonly sinReferenciaExterna: string;
}

/** Eslabón de la cadena presupuesto → resultado (FR-04.3). */
export interface MunicipalityCadenaEslabon {
  readonly id: string;
  readonly clave: string;
  readonly valor: string;
  readonly detalle: string;
  readonly tono: MunicipalityTono;
}

/** Configuración completa de la vista «Evidencias de ejecución». */
export interface MunicipalityEvidenciasConfig {
  readonly titulo: string;
  readonly descripcion: string;
  readonly nivel: MunicipalityNivelEvidencia;
  readonly movimientosTitulo: string;
  readonly movimientosResumen: string;
  readonly movimientosNota: string;
  readonly movimientosColumnas: MunicipalityMovimientoColumnas;
  readonly movimientos: readonly MunicipalityMovimientoFinanciero[];
  readonly evidencias: readonly MunicipalityEvidenciaFinanciera[];
  readonly estadosTitulo: string;
  readonly estadosSoporteTitulo: string;
  readonly estadosSoporte: readonly MunicipalityDefinicion[];
  readonly estadosEvidenciaTitulo: string;
  readonly estadosEvidencia: readonly MunicipalityDefinicion[];
  readonly estadosNota: string;
  readonly tiposTitulo: string;
  readonly tiposNota: string;
  readonly cadenaTitulo: string;
  readonly cadenaProgramaId: string;
  readonly cadena: readonly MunicipalityCadenaEslabon[];
  readonly cadenaNota: string;
  readonly alAbrirTitulo: string;
  readonly alAbrirTexto: string;
  readonly sinArchivoNota: string;
  readonly conciliacionNota: string;
  readonly detalle: MunicipalityDetalleEtiquetas;
  readonly procedencia: MunicipalityProcedenciaRef;
}

/* --------------------------- Catálogos A-04 ------------------------------- */

/**
 * Catálogo base exacto de fuentes de financiación (FR-05).
 *
 * Son las siete opciones demostrativas aprobadas. NO son una lista productiva
 * cerrada: el catálogo real de fuentes autorizadas, sus conectores, su
 * frecuencia de actualización y su semántica jurídica siguen pendientes.
 */
export const MUNICIPALITY_FUENTES_FINANCIACION: readonly MunicipalityFuenteFinanciacion[] = [
  { id: 'fue-sgp-salud-publica', etiqueta: 'SGP Salud Pública', tipo: 'SGP', isAdresRelated: false, demo: true },
  { id: 'fue-recursos-propios', etiqueta: 'Recursos propios', tipo: 'RECURSOS_PROPIOS', isAdresRelated: false, demo: true },
  { id: 'fue-nacion', etiqueta: 'Recursos Nación', tipo: 'NACION', isAdresRelated: false, demo: true },
  { id: 'fue-departamento', etiqueta: 'Recursos Departamento', tipo: 'DEPARTAMENTO', isAdresRelated: false, demo: true },
  {
    id: 'fue-adres',
    etiqueta: 'ADRES / recurso administrado o girado mediante ADRES',
    tipo: 'ADRES',
    isAdresRelated: true,
    demo: true,
  },
  { id: 'fue-convenios', etiqueta: 'Convenios', tipo: 'CONVENIO', isAdresRelated: false, demo: true },
  { id: 'fue-otra', etiqueta: 'Otra fuente', tipo: 'OTRA', isAdresRelated: false, demo: true },
];

/** Etiquetas escritas de los estados financieros. El color nunca los sustituye. */
export const MUNICIPALITY_ESTADOS_FINANCIEROS: Record<MunicipalityEstadoFinanciero, string> = {
  ASIGNADO: 'Asignado',
  COMPROMETIDO: 'Comprometido',
  CAUSADO_OBLIGADO: 'Causado/Obligado',
  PAGADO: 'Pagado',
};

/** Etiquetas escritas de los estados de soporte/validación del movimiento. */
export const MUNICIPALITY_ESTADOS_VALIDACION: Record<MunicipalityEstadoValidacion, string> = {
  PENDIENTE: 'Pendiente',
  EN_REVISION: 'En revisión',
  FALTA_SOPORTE: 'Falta soporte',
  VALIDADA: 'Validada',
};

/** Etiquetas escritas de los seis estados demostrativos de evidencia. */
export const MUNICIPALITY_ESTADOS_EVIDENCIA: Record<MunicipalityEvidenciaEstado, string> = {
  COMPLETA: 'Completa',
  PENDIENTE: 'Pendiente',
  FALTA_SOPORTE: 'Falta soporte',
  EN_REVISION: 'En revisión',
  VALIDADA: 'Validada',
  REQUIERE_CORRECCION: 'Requiere corrección',
};

/** Tipos demostrativos de soporte autorizados (FR-11). */
export const MUNICIPALITY_TIPOS_EVIDENCIA: Record<MunicipalityEvidenciaTipo, string> = {
  FACTURA: 'Factura',
  CUENTA_DE_COBRO: 'Cuenta de cobro',
  RECIBO: 'Recibo',
  COMPROBANTE_DE_PAGO: 'Comprobante de pago',
  CONTRATO: 'Contrato',
  CONVENIO: 'Convenio',
  ORDEN: 'Orden',
  FOTOGRAFIA: 'Fotografía',
  CONSTANCIA: 'Constancia',
  OTRO_SOPORTE: 'Otro soporte autorizado',
};

/**
 * Etiquetas de los cinco orígenes visibles aprobados (FR-08).
 *
 * `Elígeme` usa la marca pública centralizada. Ninguna de estas etiquetas
 * prueba conexión, importación ni acuerdo con el sistema nombrado.
 */
export const MUNICIPALITY_ORIGENES_MOVIMIENTO: Record<MunicipalityMovimientoOrigen, string> = {
  ELIGEME: platformNameInSentence(),
  SISTEMA_HOSPITAL: 'Sistema del Hospital',
  SISTEMA_ALCALDIA: 'Sistema de Alcaldía',
  IMPORTADO: 'Importado',
  FUENTE_OFICIAL_EXTERNA: 'Fuente oficial externa',
};

/**
 * Etiquetas de los estados de sincronización preparatorios (§13).
 *
 * Cuando no hay conexión la interfaz escribe «Conexión no habilitada»: nunca
 * fabrica una fecha, un éxito ni un dato externo.
 */
export const MUNICIPALITY_SYNC_ETIQUETAS: Record<MunicipalityMovimientoSyncStatus, string> = {
  NOT_CONNECTED: 'Conexión no habilitada',
  NOT_APPLICABLE: 'No aplica',
  PENDING: 'Pendiente de conciliación',
  MATCHED: 'Conciliado',
  DIFFERENCE: 'Con diferencia',
  CONFLICT: 'En conflicto',
};

/** Etiquetas de los contextos de visibilidad del registro único. */
export const MUNICIPALITY_AUDIENCIAS: Record<MunicipalityAudiencia, string> = {
  ALCALDIA: 'Alcaldía',
  HOSPITAL: 'Hospital',
};

/**
 * `true` solo cuando el movimiento está pagado Y validado (FR-03 y FR-06).
 *
 * Es la única condición que alimenta `EJECUTADO` en esta demo. Una factura, una
 * cuenta de cobro o un soporte cargado no la satisfacen por sí solos, y esta
 * función NO es una regla contable productiva: la fórmula oficial de ejecución
 * sigue siendo una decisión material pendiente.
 */
export function movimientoAlimentaEjecutado(
  movimiento: MunicipalityMovimientoFinanciero,
): boolean {
  return movimiento.estadoFinanciero === 'PAGADO' && movimiento.estadoValidacion === 'VALIDADA';
}

/** Fuente del catálogo, por identificador. `undefined` si no resuelve. */
export function fuenteMunicipal(
  fuenteId: string,
  fuentes: readonly MunicipalityFuenteFinanciacion[] = MUNICIPALITY_FUENTES_FINANCIACION,
): MunicipalityFuenteFinanciacion | undefined {
  return fuentes.find((fuente) => fuente.id === fuenteId);
}

/** Programa de A-03, por identificador. `undefined` si no resuelve. */
export function programaMunicipal(
  programaId: string,
  programas: readonly MunicipalityPrograma[] = municipalityProgramasDemo,
): MunicipalityPrograma | undefined {
  return programas.find((programa) => programa.id === programaId);
}

/** Evidencias declaradas de un movimiento, por `movimientoId`. */
export function evidenciasDeMovimiento(
  movimientoId: string,
  evidencias: readonly MunicipalityEvidenciaFinanciera[],
): readonly MunicipalityEvidenciaFinanciera[] {
  return evidencias.filter((evidencia) => evidencia.movimientoId === movimientoId);
}

/* ------------------------- Procedencia y responsables --------------------- */

/**
 * Procedencia de todo lo que A-04 muestra: fixture local de diseño, sin fuente
 * oficial, sin integración y sin fecha de corte.
 */
const PROCEDENCIA_A04 = MUNICIPALITY_PROCEDENCIA_DEMO;

/** Institución demostrativa dueña del contexto municipal. */
const INSTITUCION_ALCALDIA = 'org-demo-alcaldia';

/** Institución demostrativa del prestador relacionado. */
const INSTITUCION_HOSPITAL = 'org-demo-ese';

/* ----------------------------- Fixtures A-04 ------------------------------ */

/**
 * Ocho movimientos financieros demostrativos.
 *
 * Son una SELECCIÓN de movimientos, no el libro completo del municipio: su
 * suma no reproduce el ejecutado de ningún programa y esta vista no lo
 * pretende. Cuatro están pagados y validados; cuatro no lo están, incluida una
 * factura con soporte faltante, para que quede verificable que una factura no
 * equivale por sí sola a ejecución.
 *
 * Los proveedores y las entidades son organizaciones ficticias. No hay nombre
 * de persona, documento, contacto, ubicación individual, información clínica ni
 * compensación individual, y ningún movimiento identifica a un paciente.
 */
export const municipalityMovimientosDemo: readonly MunicipalityMovimientoFinanciero[] = [
  {
    id: 'mov-demo-001',
    fecha: '11 ago 2026',
    fechaIso: '2026-08-11',
    referencia: 'FAC-2026-125',
    tipoSoporte: 'FACTURA',
    concepto: 'Insumos de apoyo domiciliario',
    actividad: 'Entrega de insumos a 240 hogares',
    programaId: 'pro-demo-cuidado-en-casa',
    fuenteId: 'fue-sgp-salud-publica',
    entidad: 'Fundación Raíces del Cuidado (demostrativa)',
    valorTexto: '$12.500.000',
    valorPesos: 12500000,
    moneda: 'COP',
    estadoFinanciero: 'PAGADO',
    estadoValidacion: 'VALIDADA',
    origen: 'ELIGEME',
    registro: { rol: 'Secretaría de Integración Social', fecha: '11 ago 2026' },
    revision: { rol: 'Secretaría de Hacienda', fecha: '12 ago 2026' },
    sync: {
      masterSystem: platformNameInSentence(),
      syncStatus: 'NOT_APPLICABLE',
      lastSyncedAt: null,
      referencias: [],
    },
    audiencias: ['ALCALDIA'],
    procedencia: PROCEDENCIA_A04,
    tono: 'verde',
  },
  {
    id: 'mov-demo-002',
    fecha: '7 ago 2026',
    fechaIso: '2026-08-07',
    referencia: 'FAC-2026-140',
    tipoSoporte: 'FACTURA',
    concepto: 'Dotación de equipos de medición',
    actividad: 'Dotación de equipos de medición',
    programaId: 'pro-demo-adulto-mayor',
    fuenteId: 'fue-recursos-propios',
    entidad: 'Proveedor de dotación (demostrativo)',
    valorTexto: '$18.900.000',
    valorPesos: 18900000,
    moneda: 'COP',
    estadoFinanciero: 'PAGADO',
    estadoValidacion: 'VALIDADA',
    origen: 'SISTEMA_ALCALDIA',
    registro: { rol: 'Secretaría de Salud', fecha: '7 ago 2026' },
    revision: { rol: 'Secretaría de Hacienda', fecha: '8 ago 2026' },
    sync: {
      masterSystem: 'Sistema de Alcaldía',
      syncStatus: 'NOT_CONNECTED',
      lastSyncedAt: null,
      referencias: [
        {
          sourceSystem: 'Sistema de Alcaldía',
          institutionId: INSTITUCION_ALCALDIA,
          externalId: 'ALC-2026-000140',
        },
      ],
    },
    audiencias: ['ALCALDIA'],
    procedencia: PROCEDENCIA_A04,
    tono: 'verde',
  },
  {
    id: 'mov-demo-003',
    fecha: '10 ago 2026',
    fechaIso: '2026-08-10',
    referencia: 'CC-2026-088',
    tipoSoporte: 'CUENTA_DE_COBRO',
    concepto: 'Terapias domiciliarias del periodo',
    actividad: 'Terapia domiciliaria en zona rural',
    programaId: 'pro-demo-domiciliaria',
    fuenteId: 'fue-sgp-salud-publica',
    entidad: 'Operador de terapias domiciliarias (demostrativo)',
    valorTexto: '$6.400.000',
    valorPesos: 6400000,
    moneda: 'COP',
    estadoFinanciero: 'PAGADO',
    estadoValidacion: 'VALIDADA',
    origen: 'SISTEMA_HOSPITAL',
    registro: { rol: 'Hospital San Rafael (ESE)', fecha: '10 ago 2026' },
    revision: { rol: 'Secretaría de Salud', fecha: '11 ago 2026' },
    sync: {
      masterSystem: 'Sistema del Hospital',
      syncStatus: 'NOT_CONNECTED',
      lastSyncedAt: null,
      referencias: [
        {
          sourceSystem: 'Sistema del Hospital',
          institutionId: INSTITUCION_HOSPITAL,
          externalId: 'HOS-CC-2026-088',
        },
      ],
    },
    /* Un único registro visible para dos experiencias; no hay copia municipal. */
    audiencias: ['ALCALDIA', 'HOSPITAL'],
    procedencia: PROCEDENCIA_A04,
    tono: 'verde',
  },
  {
    id: 'mov-demo-004',
    fecha: '9 ago 2026',
    fechaIso: '2026-08-09',
    referencia: 'FAC-2026-131',
    tipoSoporte: 'FACTURA',
    concepto: 'Material impreso del programa',
    actividad: 'Cartillas del cuidador',
    programaId: 'pro-demo-formacion-cuidadores',
    fuenteId: 'fue-recursos-propios',
    entidad: 'Imprenta (proveedor demostrativo)',
    valorTexto: '$3.200.000',
    valorPesos: 3200000,
    moneda: 'COP',
    /* Factura existente y causada que NO está pagada ni validada. */
    estadoFinanciero: 'CAUSADO_OBLIGADO',
    estadoValidacion: 'FALTA_SOPORTE',
    origen: 'ELIGEME',
    registro: { rol: 'Secretaría de Desarrollo Social', fecha: '9 ago 2026' },
    revision: null,
    sync: {
      masterSystem: platformNameInSentence(),
      syncStatus: 'NOT_APPLICABLE',
      lastSyncedAt: null,
      referencias: [],
    },
    audiencias: ['ALCALDIA'],
    procedencia: PROCEDENCIA_A04,
    tono: 'amarillo',
  },
  {
    id: 'mov-demo-005',
    fecha: '2 ago 2026',
    fechaIso: '2026-08-02',
    referencia: 'ORD-2026-118',
    tipoSoporte: 'ORDEN',
    concepto: 'Traslado a zona rural dispersa',
    actividad: 'Transporte de equipos a zona rural',
    programaId: 'pro-demo-domiciliaria',
    fuenteId: 'fue-sgp-salud-publica',
    entidad: 'Operador de transporte (demostrativo)',
    valorTexto: '$4.100.000',
    valorPesos: 4100000,
    moneda: 'COP',
    estadoFinanciero: 'COMPROMETIDO',
    estadoValidacion: 'PENDIENTE',
    origen: 'SISTEMA_ALCALDIA',
    registro: { rol: 'Secretaría de Salud', fecha: '2 ago 2026' },
    revision: null,
    sync: {
      masterSystem: 'Sistema de Alcaldía',
      syncStatus: 'NOT_CONNECTED',
      lastSyncedAt: null,
      referencias: [
        {
          sourceSystem: 'Sistema de Alcaldía',
          institutionId: INSTITUCION_ALCALDIA,
          externalId: 'ALC-2026-000118',
        },
      ],
    },
    audiencias: ['ALCALDIA'],
    procedencia: PROCEDENCIA_A04,
    tono: 'amarillo',
  },
  {
    id: 'mov-demo-006',
    fecha: '5 ago 2026',
    fechaIso: '2026-08-05',
    referencia: 'CONV-2026-014',
    tipoSoporte: 'CONVENIO',
    concepto: 'Aporte del convenio de formación',
    actividad: 'Formación de cuidadores del periodo',
    programaId: 'pro-demo-formacion-cuidadores',
    fuenteId: 'fue-convenios',
    entidad: 'Entidad de formación (demostrativa)',
    valorTexto: '$9.800.000',
    valorPesos: 9800000,
    moneda: 'COP',
    estadoFinanciero: 'COMPROMETIDO',
    estadoValidacion: 'EN_REVISION',
    origen: 'IMPORTADO',
    registro: { rol: 'Secretaría de Desarrollo Social', fecha: '5 ago 2026' },
    revision: { rol: 'Secretaría de Hacienda', fecha: '6 ago 2026' },
    sync: {
      masterSystem: 'Sistema de Alcaldía',
      syncStatus: 'NOT_CONNECTED',
      lastSyncedAt: null,
      referencias: [
        {
          sourceSystem: 'Archivo institucional (demostrativo)',
          institutionId: INSTITUCION_ALCALDIA,
          externalId: 'IMP-CONV-2026-014',
        },
      ],
    },
    audiencias: ['ALCALDIA'],
    procedencia: PROCEDENCIA_A04,
    tono: 'amarillo',
  },
  {
    id: 'mov-demo-007',
    fecha: '4 ago 2026',
    fechaIso: '2026-08-04',
    referencia: 'CP-2026-031',
    tipoSoporte: 'COMPROBANTE_DE_PAGO',
    concepto: 'Apoyos técnicos del programa',
    actividad: 'Entrega de apoyos técnicos',
    programaId: 'pro-demo-discapacidad',
    /* Única fuente relacionada con ADRES del fixture; no domina el presupuesto. */
    fuenteId: 'fue-adres',
    entidad: 'Entidad administradora de recursos (demostrativa)',
    valorTexto: '$7.300.000',
    valorPesos: 7300000,
    moneda: 'COP',
    estadoFinanciero: 'PAGADO',
    estadoValidacion: 'VALIDADA',
    origen: 'FUENTE_OFICIAL_EXTERNA',
    registro: { rol: 'Secretaría de Hacienda', fecha: '4 ago 2026' },
    revision: { rol: 'Secretaría de Salud', fecha: '5 ago 2026' },
    sync: {
      masterSystem: 'Fuente oficial externa',
      syncStatus: 'NOT_CONNECTED',
      lastSyncedAt: null,
      referencias: [
        {
          sourceSystem: 'Fuente oficial externa',
          institutionId: INSTITUCION_ALCALDIA,
          externalId: null,
        },
      ],
    },
    audiencias: ['ALCALDIA'],
    procedencia: PROCEDENCIA_A04,
    tono: 'verde',
  },
  {
    id: 'mov-demo-008',
    fecha: '13 ago 2026',
    fechaIso: '2026-08-13',
    referencia: 'CC-2026-149',
    tipoSoporte: 'CUENTA_DE_COBRO',
    concepto: 'Acompañamiento social del periodo',
    actividad: 'Acompañamiento a hogares con apoyos',
    programaId: 'pro-demo-discapacidad',
    fuenteId: 'fue-departamento',
    entidad: 'Operador social (demostrativo)',
    valorTexto: '$5.600.000',
    valorPesos: 5600000,
    moneda: 'COP',
    estadoFinanciero: 'CAUSADO_OBLIGADO',
    estadoValidacion: 'EN_REVISION',
    origen: 'SISTEMA_HOSPITAL',
    registro: { rol: 'Hospital San Rafael (ESE)', fecha: '13 ago 2026' },
    revision: null,
    sync: {
      masterSystem: 'Sistema del Hospital',
      syncStatus: 'NOT_CONNECTED',
      lastSyncedAt: null,
      referencias: [
        {
          sourceSystem: 'Sistema del Hospital',
          institutionId: INSTITUCION_HOSPITAL,
          externalId: 'HOS-CC-2026-149',
        },
      ],
    },
    audiencias: ['ALCALDIA', 'HOSPITAL'],
    procedencia: PROCEDENCIA_A04,
    tono: 'amarillo',
  },
];

/**
 * Nueve evidencias demostrativas.
 *
 * Cada evidencia referencia su movimiento por `movimientoId` y NO lo duplica.
 * Solo hay metadatos: no existe archivo, enlace, miniatura, versión, checksum
 * ni almacenamiento, y ningún dato identifica a una persona atendida.
 *
 * Los seis estados demostrativos de evidencia están representados. Un estado de
 * evidencia nunca es un estado financiero: `mov-demo-004` tiene factura y sigue
 * sin estar pagado ni validado.
 */
export const municipalityEvidenciasDemo: readonly MunicipalityEvidenciaFinanciera[] = [
  {
    id: 'evi-demo-001',
    referencia: 'FAC-2026-125',
    tipo: 'FACTURA',
    movimientoId: 'mov-demo-001',
    entidad: 'Fundación Raíces del Cuidado (demostrativa)',
    programaId: 'pro-demo-cuidado-en-casa',
    fuenteId: 'fue-sgp-salud-publica',
    valorTexto: '$12.500.000',
    valorPesos: 12500000,
    moneda: 'COP',
    estado: 'COMPLETA',
    actividad: 'Entrega de insumos a 240 hogares',
    institucion: 'Alcaldía de Soacha',
    origen: 'ELIGEME',
    registro: { rol: 'Secretaría de Integración Social', fecha: '11 ago 2026' },
    revision: { rol: 'Secretaría de Hacienda', fecha: '12 ago 2026' },
    procedencia: PROCEDENCIA_A04,
    tono: 'verde',
  },
  {
    id: 'evi-demo-002',
    referencia: 'FAC-2026-140',
    tipo: 'FACTURA',
    movimientoId: 'mov-demo-002',
    entidad: 'Proveedor de dotación (demostrativo)',
    programaId: 'pro-demo-adulto-mayor',
    fuenteId: 'fue-recursos-propios',
    valorTexto: '$18.900.000',
    valorPesos: 18900000,
    moneda: 'COP',
    estado: 'COMPLETA',
    actividad: 'Dotación de equipos de medición',
    institucion: 'Alcaldía de Soacha',
    origen: 'SISTEMA_ALCALDIA',
    registro: { rol: 'Secretaría de Salud', fecha: '7 ago 2026' },
    revision: { rol: 'Secretaría de Hacienda', fecha: '8 ago 2026' },
    procedencia: PROCEDENCIA_A04,
    tono: 'verde',
  },
  {
    id: 'evi-demo-003',
    referencia: 'CC-2026-088',
    tipo: 'CUENTA_DE_COBRO',
    movimientoId: 'mov-demo-003',
    entidad: 'Operador de terapias domiciliarias (demostrativo)',
    programaId: 'pro-demo-domiciliaria',
    fuenteId: 'fue-sgp-salud-publica',
    valorTexto: '$6.400.000',
    valorPesos: 6400000,
    moneda: 'COP',
    estado: 'VALIDADA',
    actividad: 'Terapia domiciliaria en zona rural',
    institucion: 'Hospital San Rafael (ESE)',
    origen: 'SISTEMA_HOSPITAL',
    registro: { rol: 'Hospital San Rafael (ESE)', fecha: '10 ago 2026' },
    revision: { rol: 'Secretaría de Salud', fecha: '11 ago 2026' },
    procedencia: PROCEDENCIA_A04,
    tono: 'verde',
  },
  {
    id: 'evi-demo-004',
    referencia: 'FAC-2026-131',
    tipo: 'FACTURA',
    movimientoId: 'mov-demo-004',
    entidad: 'Imprenta (proveedor demostrativo)',
    programaId: 'pro-demo-formacion-cuidadores',
    fuenteId: 'fue-recursos-propios',
    valorTexto: '$3.200.000',
    valorPesos: 3200000,
    moneda: 'COP',
    /* La factura existe; falta el soporte obligatorio y nada se da por pagado. */
    estado: 'FALTA_SOPORTE',
    actividad: 'Cartillas del cuidador',
    institucion: 'Alcaldía de Soacha',
    origen: 'ELIGEME',
    registro: { rol: 'Secretaría de Desarrollo Social', fecha: '9 ago 2026' },
    revision: null,
    procedencia: PROCEDENCIA_A04,
    tono: 'amarillo',
  },
  {
    id: 'evi-demo-005',
    referencia: 'ORD-2026-118',
    tipo: 'ORDEN',
    movimientoId: 'mov-demo-005',
    entidad: 'Operador de transporte (demostrativo)',
    programaId: 'pro-demo-domiciliaria',
    fuenteId: 'fue-sgp-salud-publica',
    valorTexto: '$4.100.000',
    valorPesos: 4100000,
    moneda: 'COP',
    estado: 'PENDIENTE',
    actividad: 'Transporte de equipos a zona rural',
    institucion: 'Alcaldía de Soacha',
    origen: 'SISTEMA_ALCALDIA',
    registro: { rol: 'Secretaría de Salud', fecha: '2 ago 2026' },
    revision: null,
    procedencia: PROCEDENCIA_A04,
    tono: 'amarillo',
  },
  {
    id: 'evi-demo-006',
    referencia: 'CONV-2026-014',
    tipo: 'CONVENIO',
    movimientoId: 'mov-demo-006',
    entidad: 'Entidad de formación (demostrativa)',
    programaId: 'pro-demo-formacion-cuidadores',
    fuenteId: 'fue-convenios',
    valorTexto: '$9.800.000',
    valorPesos: 9800000,
    moneda: 'COP',
    estado: 'EN_REVISION',
    actividad: 'Formación de cuidadores del periodo',
    institucion: 'Alcaldía de Soacha',
    origen: 'IMPORTADO',
    registro: { rol: 'Secretaría de Desarrollo Social', fecha: '5 ago 2026' },
    revision: { rol: 'Secretaría de Hacienda', fecha: '6 ago 2026' },
    procedencia: PROCEDENCIA_A04,
    tono: 'amarillo',
  },
  {
    id: 'evi-demo-007',
    referencia: 'CP-2026-031',
    tipo: 'COMPROBANTE_DE_PAGO',
    movimientoId: 'mov-demo-007',
    entidad: 'Entidad administradora de recursos (demostrativa)',
    programaId: 'pro-demo-discapacidad',
    fuenteId: 'fue-adres',
    valorTexto: '$7.300.000',
    valorPesos: 7300000,
    moneda: 'COP',
    estado: 'VALIDADA',
    actividad: 'Entrega de apoyos técnicos',
    institucion: 'Alcaldía de Soacha',
    origen: 'FUENTE_OFICIAL_EXTERNA',
    registro: { rol: 'Secretaría de Hacienda', fecha: '4 ago 2026' },
    revision: { rol: 'Secretaría de Salud', fecha: '5 ago 2026' },
    procedencia: PROCEDENCIA_A04,
    tono: 'verde',
  },
  {
    id: 'evi-demo-008',
    referencia: 'CC-2026-149',
    tipo: 'CONSTANCIA',
    movimientoId: 'mov-demo-008',
    entidad: 'Operador social (demostrativo)',
    programaId: 'pro-demo-discapacidad',
    fuenteId: 'fue-departamento',
    valorTexto: '$5.600.000',
    valorPesos: 5600000,
    moneda: 'COP',
    estado: 'REQUIERE_CORRECCION',
    actividad: 'Acompañamiento a hogares con apoyos',
    institucion: 'Hospital San Rafael (ESE)',
    origen: 'SISTEMA_HOSPITAL',
    registro: { rol: 'Hospital San Rafael (ESE)', fecha: '13 ago 2026' },
    revision: { rol: 'Secretaría de Salud', fecha: '14 ago 2026' },
    procedencia: PROCEDENCIA_A04,
    tono: 'amarillo',
  },
  {
    /* Segundo soporte del mismo movimiento: un movimiento no se duplica. */
    id: 'evi-demo-009',
    referencia: 'FOT-2026-125',
    tipo: 'FOTOGRAFIA',
    movimientoId: 'mov-demo-001',
    entidad: 'Fundación Raíces del Cuidado (demostrativa)',
    programaId: 'pro-demo-cuidado-en-casa',
    fuenteId: 'fue-sgp-salud-publica',
    valorTexto: '$12.500.000',
    valorPesos: 12500000,
    moneda: 'COP',
    estado: 'COMPLETA',
    actividad: 'Registro de la entrega de insumos',
    institucion: 'Alcaldía de Soacha',
    origen: 'ELIGEME',
    registro: { rol: 'Secretaría de Integración Social', fecha: '11 ago 2026' },
    revision: null,
    procedencia: PROCEDENCIA_A04,
    tono: 'verde',
  },
];

/**
 * Presupuesto por programa (FR-04).
 *
 * Cada entrada resuelve por `programaId` contra los cinco programas de A-03 y
 * NO repite su nombre, su meta ni sus importes visibles: solo declara el
 * desglose por fuente, el costo promedio y los importes numéricos de
 * verificación local. La suma declarada de las fuentes de cada programa iguala
 * su asignado, y la suma de los cinco asignados iguala el asignado general.
 */
export const municipalityProgramasPresupuestoDemo: readonly MunicipalityProgramaPresupuesto[] = [
  {
    programaId: 'pro-demo-domiciliaria',
    fuentes: [
      { fuenteId: 'fue-sgp-salud-publica', monto: { texto: '$420 M', millones: 420 } },
      { fuenteId: 'fue-recursos-propios', monto: { texto: '$150 M', millones: 150 } },
      { fuenteId: 'fue-departamento', monto: { texto: '$110 M', millones: 110 } },
    ],
    montos: { asignado: 680, comprometido: 160, ejecutado: 402, disponible: 118 },
    costoPromedio: {
      texto: '$975.700',
      numerador: 'Ejecutado declarado $402 M',
      denominador: '412 beneficiarios únicos declarados',
      metodologia:
        'Ejecutado declarado del fixture dividido entre los beneficiarios únicos declarados del mismo programa, redondeado a centenas. Es una cifra demostrativa: la metodología municipal de atribución y de beneficiarios únicos sigue pendiente.',
    },
  },
  {
    programaId: 'pro-demo-adulto-mayor',
    fuentes: [
      { fuenteId: 'fue-nacion', monto: { texto: '$220 M', millones: 220 } },
      { fuenteId: 'fue-sgp-salud-publica', monto: { texto: '$120 M', millones: 120 } },
      { fuenteId: 'fue-recursos-propios', monto: { texto: '$80 M', millones: 80 } },
    ],
    montos: { asignado: 420, comprometido: 100, ejecutado: 248, disponible: 72 },
    costoPromedio: {
      texto: '$112.900',
      numerador: 'Ejecutado declarado $248 M',
      denominador: '2.196 beneficiarios únicos declarados',
      metodologia:
        'Ejecutado declarado del fixture dividido entre los beneficiarios únicos declarados del mismo programa, redondeado a centenas. Es una cifra demostrativa: la metodología municipal de atribución y de beneficiarios únicos sigue pendiente.',
    },
  },
  {
    programaId: 'pro-demo-discapacidad',
    fuentes: [
      { fuenteId: 'fue-departamento', monto: { texto: '$120 M', millones: 120 } },
      { fuenteId: 'fue-sgp-salud-publica', monto: { texto: '$80 M', millones: 80 } },
      { fuenteId: 'fue-adres', monto: { texto: '$60 M', millones: 60 } },
    ],
    montos: { asignado: 260, comprometido: 60, ejecutado: 134, disponible: 66 },
    costoPromedio: {
      texto: '$127.600',
      numerador: 'Ejecutado declarado $134 M',
      denominador: '1.050 beneficiarios únicos declarados',
      metodologia:
        'Ejecutado declarado del fixture dividido entre los beneficiarios únicos declarados del mismo programa, redondeado a centenas. Es una cifra demostrativa: la metodología municipal de atribución y de beneficiarios únicos sigue pendiente.',
    },
  },
  {
    programaId: 'pro-demo-cuidado-en-casa',
    fuentes: [
      { fuenteId: 'fue-recursos-propios', monto: { texto: '$90 M', millones: 90 } },
      { fuenteId: 'fue-convenios', monto: { texto: '$60 M', millones: 60 } },
    ],
    montos: { asignado: 150, comprometido: 50, ejecutado: 68, disponible: 32 },
    costoPromedio: {
      texto: '$73.300',
      numerador: 'Ejecutado declarado $68 M',
      denominador: '928 beneficiarios únicos declarados',
      metodologia:
        'Ejecutado declarado del fixture dividido entre los beneficiarios únicos declarados del mismo programa, redondeado a centenas. Es una cifra demostrativa: la metodología municipal de atribución y de beneficiarios únicos sigue pendiente.',
    },
  },
  {
    programaId: 'pro-demo-formacion-cuidadores',
    fuentes: [
      { fuenteId: 'fue-convenios', monto: { texto: '$40 M', millones: 40 } },
      { fuenteId: 'fue-otra', monto: { texto: '$30 M', millones: 30 } },
    ],
    montos: { asignado: 70, comprometido: 40, ejecutado: 18, disponible: 12 },
    /*
     * Sin costo promedio: el denominador declarado son cuidadores vinculados,
     * no beneficiarios del servicio, y el fixture no declara una metodología
     * que permita compararlos. La ausencia significa exactamente eso.
     */
    costoPromedio: null,
  },
];

/**
 * Contrato de redistribución preparado para una tarea posterior (FR-10).
 *
 * Es un EJEMPLO DE FORMA, no una instancia ejecutable: no se muestra en
 * pantalla, no tiene control asociado, no se valida, no se guarda y no afecta
 * ningún saldo. `requiereSegundaAprobacion`, `politicaId` y `politicaVersion`
 * son nulos porque la política de segunda aprobación y su umbral son decisiones
 * materiales pendientes; A-04 no fija ningún monto.
 */
export const MUNICIPALITY_REDISTRIBUCION_CONTRATO: MunicipalityRedistribucionContrato = {
  programaOrigenId: '',
  programaDestinoId: '',
  valorPesos: 0,
  moneda: 'COP',
  motivo: '',
  responsableRol: '',
  fecha: '',
  aprobacion: {
    requiereSegundaAprobacion: null,
    politicaId: null,
    politicaVersion: null,
    aprobadores: [],
  },
};

/**
 * Vista «Presupuesto y ejecución» demostrativa (líneas 316–370 de la referencia
 * aprobada).
 *
 * Privacidad municipal: solo agregados institucionales y metadatos
 * administrativos. No hay información clínica, identidad de personas atendidas,
 * ubicación individual ni compensación individual, y ninguna cifra se presenta
 * como oficial, contable ni verificada.
 */
export const municipalityPresupuestoDemo: MunicipalityPresupuestoConfig = {
  titulo: 'Presupuesto y ejecución',
  descripcion:
    'De la asignación al soporte documental, con costo promedio por beneficiario.',
  resumenTitulo: 'Resumen presupuestal del periodo',
  resumenAccesible:
    'Resumen presupuestal demostrativo: asignado, ejecutado, comprometido, disponible y porcentaje de ejecución financiera.',
  resumen: {
    asignado: { texto: '$1.580 M', millones: 1580 },
    ejecutado: { texto: '$870 M', millones: 870 },
    comprometido: { texto: '$410 M', millones: 410 },
    disponible: { texto: '$300 M', millones: 300 },
    porcentajeEjecucion: 55,
    porcentajeEjecucionTexto: '55 %',
    porcentajeComprometido: 26,
    porcentajeComprometidoTexto: '26 %',
    identidadContable:
      'Coherencia interna de este fixture: asignado = comprometido + ejecutado + disponible ($1.580 M = $410 M + $870 M + $300 M). Es una identidad del fixture, no una fórmula contable universal ni una regla oficial.',
  },
  metricas: [
    {
      id: 'asignado',
      titulo: 'ASIGNADO',
      valor: '$1.580 M',
      aclaracion: 'Presupuesto aprobado o asignado a los programas del fixture.',
      tono: 'azul',
    },
    {
      id: 'ejecutado',
      titulo: 'EJECUTADO Y PAGADO',
      valor: '$870 M',
      aclaracion: 'Solo dinero pagado y validado en el fixture.',
      tono: 'teal',
    },
    {
      id: 'comprometido',
      titulo: 'COMPROMETIDO',
      valor: '$410 M',
      aclaracion: 'Recurso reservado o comprometido que todavía no se pagó.',
      tono: 'amarillo',
    },
    {
      id: 'disponible',
      titulo: 'DISPONIBLE',
      valor: '$300 M',
      aclaracion: 'Saldo demostrativo restante declarado por el fixture.',
      tono: 'verde',
    },
    {
      id: 'ejecucion',
      titulo: 'EJECUCIÓN FINANCIERA',
      valor: '55 %',
      aclaracion: 'Porcentaje declarado del ejecutado sobre el asignado.',
      tono: 'teal',
    },
  ],
  ejecucionTitulo: 'Ejecución total del periodo',
  leyenda: [
    { id: 'ejecutado', etiqueta: 'Ejecutado', valor: '$870 M · 55 %', tono: 'teal' },
    { id: 'comprometido', etiqueta: 'Comprometido', valor: '$410 M · 26 %', tono: 'amarillo' },
    { id: 'disponible', etiqueta: 'Disponible', valor: '$300 M · 19 %', tono: 'verde' },
  ],
  semanticaTitulo: 'Qué significa cada cifra en esta demostración',
  semantica: [
    {
      id: 'asignado',
      termino: 'Asignado',
      definicion: 'Presupuesto aprobado o asignado al programa.',
    },
    {
      id: 'comprometido',
      termino: 'Comprometido',
      definicion: 'Recurso reservado o comprometido que todavía no está pagado.',
    },
    {
      id: 'ejecutado',
      termino: 'Ejecutado',
      definicion:
        'Dinero pagado y validado, únicamente para efectos de esta demostración.',
    },
    {
      id: 'disponible',
      termino: 'Disponible',
      definicion: 'Saldo demostrativo restante, coherente con los datos del fixture.',
    },
  ],
  secuenciaTitulo: 'Secuencia conceptual preparada para el futuro',
  secuencia: ['Asignado', 'Comprometido', 'Causado/Obligado', 'Pagado'],
  secuenciaNota:
    'La secuencia se enuncia para preparar el modelo. Esta pantalla no aplica transiciones, no causa, no obliga, no paga, no cierra periodos y no registra asientos: el significado oficial, las fórmulas, los estados y sus transiciones siguen siendo decisiones pendientes.',
  facturaNota:
    'Una factura, una cuenta de cobro o un soporte cargado no convierten por sí solos un movimiento en pagado ni en ejecutado, y no cambian ninguna de estas cifras. Solo los movimientos marcados como pagados y validados alimentan el ejecutado de esta demostración.',
  fuentesTitulo: 'Fuentes de financiación',
  fuentesResumen:
    'Composición demostrativa del presupuesto asignado por fuente de financiación, con monto y participación.',
  fuentesColumnas: {
    fuente: 'FUENTE',
    monto: 'ASIGNADO',
    participacion: 'PARTICIPACIÓN',
  },
  fuentesAgregadas: [
    {
      fuenteId: 'fue-sgp-salud-publica',
      monto: { texto: '$620 M', millones: 620 },
      porcentaje: 39.2,
      porcentajeTexto: '39,2 %',
    },
    {
      fuenteId: 'fue-recursos-propios',
      monto: { texto: '$320 M', millones: 320 },
      porcentaje: 20.3,
      porcentajeTexto: '20,3 %',
    },
    {
      fuenteId: 'fue-nacion',
      monto: { texto: '$220 M', millones: 220 },
      porcentaje: 13.9,
      porcentajeTexto: '13,9 %',
    },
    {
      fuenteId: 'fue-departamento',
      monto: { texto: '$230 M', millones: 230 },
      porcentaje: 14.6,
      porcentajeTexto: '14,6 %',
    },
    {
      fuenteId: 'fue-adres',
      monto: { texto: '$60 M', millones: 60 },
      porcentaje: 3.8,
      porcentajeTexto: '3,8 %',
    },
    {
      fuenteId: 'fue-convenios',
      monto: { texto: '$100 M', millones: 100 },
      porcentaje: 6.3,
      porcentajeTexto: '6,3 %',
    },
    {
      fuenteId: 'fue-otra',
      monto: { texto: '$30 M', millones: 30 },
      porcentaje: 1.9,
      porcentajeTexto: '1,9 %',
    },
  ],
  fuentesNota:
    'Cada asignación, movimiento y evidencia conserva su fuente. El catálogo es configurable y demostrativo: no es la lista cerrada de fuentes autorizadas, y ninguna etiqueta prueba que exista un giro, un convenio o una consulta real.',
  adresNota:
    'ADRES aparece únicamente como una fuente posible cuando el recurso se administra o se gira mediante ADRES. No es el origen de todo el presupuesto municipal, no es propietario, no aprueba y no evalúa: en este fixture representa $60 M de $1.580 M. El módulo específico se implementará en una tarea posterior.',
  programasTitulo: 'Presupuesto por programa',
  programasResumen:
    'Presupuesto demostrativo de cada programa: dinero asignado, comprometido, ejecutado y disponible, meta física, cumplimiento, fuentes, beneficiarios únicos, actividad, evidencias y resultado.',
  programasNota:
    'Los programas, sus importes visibles, sus metas y sus porcentajes son los mismos que registra la pantalla Programas y se resuelven por identificador: esta vista no los recalcula, no los reinterpreta y no crea otra lista de programas.',
  cadenaNota:
    'La cadena programa → dinero → actividad → evidencia → resultado se conserva visible por programa. Solo es válida cuando el fixture declara cada eslabón: relacionar dinero con un resultado exige una metodología aprobada, con fuente, regla, periodo, versión, responsable y linaje, que sigue pendiente.',
  etiquetas: {
    asignado: 'Asignado',
    comprometido: 'Comprometido',
    ejecutado: 'Ejecutado y pagado',
    disponible: 'Disponible',
    ejecucionFinanciera: 'Ejecución financiera',
    metaFisica: 'Meta física',
    cumplimientoFisico: 'Cumplimiento físico',
    fuentes: 'Fuentes de financiación',
    beneficiariosUnicos: 'Beneficiarios únicos',
    costoPromedio: 'Costo promedio por beneficiario',
    actividad: 'Actividad',
    evidencias: 'Actividades con soporte',
    resultado: 'Resultado físico',
    moneda: 'Moneda',
    sinRegistro: 'Sin registro',
    numerador: 'Numerador',
    denominador: 'Denominador',
    metodologia: 'Metodología declarada',
  },
  programas: municipalityProgramasPresupuestoDemo,
  poblacionTitulo: 'Por población',
  poblacionResumen:
    'Desglose demostrativo por población base, con asignado, ejecutado, beneficiarios únicos y costo promedio declarado.',
  poblacionColumnas: {
    poblacion: 'POBLACIÓN',
    asignado: 'ASIGNADO',
    ejecutado: 'EJECUTADO',
    beneficiarios: 'BENEFICIARIOS ÚNICOS',
    costoPromedio: 'COSTO PROMEDIO',
  },
  poblacion: [
    {
      poblacionId: 'MAYORES_60',
      etiqueta: 'Adulto mayor',
      asignado: { texto: '$420 M', millones: 420 },
      ejecutado: { texto: '$248 M', millones: 248 },
      beneficiariosUnicos: '2.196',
      costoPromedio: {
        texto: '$112.900',
        numerador: 'Ejecutado declarado $248 M',
        denominador: '2.196 beneficiarios únicos declarados',
        metodologia:
          'Ejecutado declarado dividido entre beneficiarios únicos declarados, redondeado a centenas. Cifra demostrativa del fixture; no es la metodología municipal de atribución, que sigue pendiente.',
      },
      atribucion: MUNICIPALITY_ATRIBUCION_PENDIENTE,
    },
    {
      poblacionId: 'DISCAPACIDAD',
      etiqueta: 'Discapacidad',
      asignado: { texto: '$260 M', millones: 260 },
      ejecutado: { texto: '$134 M', millones: 134 },
      beneficiariosUnicos: '1.050',
      costoPromedio: {
        texto: '$127.600',
        numerador: 'Ejecutado declarado $134 M',
        denominador: '1.050 beneficiarios únicos declarados',
        metodologia:
          'Ejecutado declarado dividido entre beneficiarios únicos declarados, redondeado a centenas. Cifra demostrativa del fixture; no es la metodología municipal de atribución, que sigue pendiente.',
      },
      atribucion: MUNICIPALITY_ATRIBUCION_PENDIENTE,
    },
    {
      poblacionId: 'CUIDADO_EN_CASA',
      etiqueta: 'Cuidado en casa',
      asignado: { texto: '$150 M', millones: 150 },
      ejecutado: { texto: '$68 M', millones: 68 },
      beneficiariosUnicos: '928',
      costoPromedio: {
        texto: '$73.300',
        numerador: 'Ejecutado declarado $68 M',
        denominador: '928 beneficiarios únicos declarados',
        metodologia:
          'Ejecutado declarado dividido entre beneficiarios únicos declarados, redondeado a centenas. Cifra demostrativa del fixture; no es la metodología municipal de atribución, que sigue pendiente.',
      },
      atribucion: MUNICIPALITY_ATRIBUCION_PENDIENTE,
    },
  ],
  poblacionNota:
    'Cuando una persona pertenece a varias poblaciones el gasto no se duplica: se distribuye según la metodología definida por el municipio. Las filas no se suman entre sí ni con los programas, y los beneficiarios únicos del municipio viven en Población beneficiaria.',
  poblacionAtribucionNota:
    'Adulto mayor, Discapacidad y Cuidado en casa son poblaciones base, distintas de los programas. Este desglose no asigna gasto a ninguna persona por pertenecer a una población, no abre ficha individual y no permite identificar a nadie.',
  redistribucionNota:
    'Esta pantalla no redistribuye presupuesto entre programas y no ofrece ninguna acción para hacerlo. La redistribución, su validación, su aprobación y su efecto sobre los saldos se implementarán en una tarea posterior.',
  procedencia: PROCEDENCIA_A04,
};

/**
 * Vista «Evidencias de ejecución» demostrativa (líneas 373–435 de la referencia
 * aprobada).
 *
 * La tabla aprobada «Facturas y soportes» actúa como historial demostrativo de
 * movimientos financieros: no se crea una pantalla ni una subsección
 * «Movimientos», y no existe conciliación operativa ni sincronización.
 *
 * Privacidad municipal: solo metadatos administrativos y entidades ficticias.
 * No hay historia clínica, diagnóstico, identidad de personas atendidas,
 * ubicación individual ni compensación individual.
 */
export const municipalityEvidenciasConfigDemo: MunicipalityEvidenciasConfig = {
  titulo: 'Evidencias de ejecución',
  descripcion:
    'Qué se hizo, para quién, cuándo, quién lo hizo, cuánto costó, de qué presupuesto salió, quién recibió el pago, cuál es el soporte y qué resultado produjo.',
  nivel: {
    titulo: 'NIVEL DE EVIDENCIA',
    porcentaje: 92.8,
    porcentajeTexto: '92,8 %',
    actividadesConSoporte: 232,
    actividadesEjecutadas: 250,
    pendientes: 18,
    detalle:
      '232 de 250 actividades ejecutadas tienen soporte cargado. 18 pendientes.',
  },
  movimientosTitulo: 'Facturas y soportes',
  movimientosResumen:
    'Historial demostrativo de movimientos financieros: fecha, factura o cuenta, proveedor o entidad, programa, fuente, valor, estado financiero y de validación, estado del soporte, origen del dato y detalle de la evidencia.',
  movimientosNota:
    'Es una selección demostrativa de movimientos, no el libro completo del municipio: su suma no reproduce el ejecutado de ningún programa. El estado del soporte es administrativo y es distinto del estado financiero: una factura registrada no implica pago ni ejecución validada.',
  movimientosColumnas: {
    fecha: 'FECHA',
    referencia: 'FACTURA O CUENTA',
    entidad: 'PROVEEDOR O ENTIDAD',
    programa: 'PROGRAMA',
    fuente: 'FUENTE',
    valor: 'VALOR',
    estado: 'ESTADO FINANCIERO',
    soporte: 'ESTADO DEL SOPORTE',
    origen: 'ORIGEN DEL DATO',
    accion: 'DETALLE',
  },
  movimientos: municipalityMovimientosDemo,
  evidencias: municipalityEvidenciasDemo,
  estadosTitulo: 'Estados del movimiento y de la evidencia',
  estadosSoporteTitulo: 'Estados de validación del movimiento',
  estadosSoporte: [
    { id: 'PENDIENTE', termino: 'Pendiente', definicion: 'El soporte todavía no se revisó.' },
    { id: 'EN_REVISION', termino: 'En revisión', definicion: 'El soporte está en revisión administrativa.' },
    { id: 'FALTA_SOPORTE', termino: 'Falta soporte', definicion: 'El movimiento no tiene todavía el soporte obligatorio.' },
    { id: 'VALIDADA', termino: 'Validada', definicion: 'El soporte fue revisado y aceptado en el fixture.' },
  ],
  estadosEvidenciaTitulo: 'Estados de la evidencia',
  estadosEvidencia: [
    { id: 'COMPLETA', termino: 'Completa', definicion: 'La evidencia declarada está completa.' },
    { id: 'PENDIENTE', termino: 'Pendiente', definicion: 'La evidencia se espera y todavía no llega.' },
    { id: 'FALTA_SOPORTE', termino: 'Falta soporte', definicion: 'Falta el soporte obligatorio de la actividad.' },
    { id: 'EN_REVISION', termino: 'En revisión', definicion: 'La evidencia está en revisión administrativa.' },
    { id: 'VALIDADA', termino: 'Validada', definicion: 'La evidencia fue revisada y aceptada en el fixture.' },
    { id: 'REQUIERE_CORRECCION', termino: 'Requiere corrección', definicion: 'La evidencia necesita una corrección antes de aceptarse.' },
  ],
  estadosNota:
    'Los estados de validación y de evidencia son administrativos y nunca son estados financieros. Un movimiento con evidencia faltante puede permanecer pendiente, pero nunca aparece como pagado y validado.',
  tiposTitulo: 'Tipos de soporte admitidos en la demostración',
  tiposNota:
    'Los requisitos obligatorios de evidencia por tipo, estado y movimiento, junto con retención, versión, integridad y disposición documental, son decisiones pendientes y no se implementan aquí.',
  cadenaTitulo: 'Presupuesto, programa, actividad, beneficiario y resultado',
  cadenaProgramaId: 'pro-demo-domiciliaria',
  cadena: [
    {
      id: 'presupuesto',
      clave: 'PRESUPUESTO',
      valor: '$680 M',
      detalle: 'Asignado declarado del programa',
      tono: 'azul',
    },
    {
      id: 'programa',
      clave: 'PROGRAMA',
      valor: 'Atención domiciliaria',
      detalle: 'Ejecuta Hospital San Rafael (ESE)',
      tono: 'azul',
    },
    {
      id: 'actividad',
      clave: 'ACTIVIDAD Y MOVIMIENTO',
      valor: '1.204 atenciones',
      detalle: 'Movimientos del historial: CC-2026-088 y ORD-2026-118',
      tono: 'teal',
    },
    {
      id: 'beneficiarios',
      clave: 'BENEFICIARIOS ÚNICOS',
      valor: '412',
      detalle: 'Deduplicados por persona',
      tono: 'teal',
    },
    {
      id: 'evidencia',
      clave: 'EVIDENCIA',
      valor: '96 de 101',
      detalle: 'Actividades con soporte declarado',
      tono: 'verde',
    },
    {
      id: 'resultado',
      clave: 'RESULTADO',
      valor: '76 %',
      detalle: '412 de 540 personas atendidas',
      tono: 'verde',
    },
  ],
  cadenaNota:
    'Los seis eslabones son valores declarados del mismo programa de la pantalla Programas y no se recalculan aquí. La cadena solo es válida cuando el fixture declara cada eslabón: atribuir dinero a un resultado exige una metodología aprobada, con fuente, regla, periodo, versión, responsable y linaje, que sigue pendiente.',
  alAbrirTitulo: 'AL ABRIR UNA EVIDENCIA',
  alAbrirTexto:
    'Factura, cuenta de cobro, recibo, comprobante de pago, contrato, convenio, orden, fotografía, constancia u otro soporte autorizado; fecha de registro, rol que la registró, revisión, programa relacionado, fuente, movimiento asociado y actividad soportada.',
  sinArchivoNota:
    'El detalle muestra únicamente metadatos ficticios. En esta demostración no hay archivo real, no se puede adjuntar un documento, no se puede abrir un adjunto y no existe ningún enlace a un repositorio: el almacenamiento, la integridad, el control de versiones y los permisos documentales corresponden a una tarea posterior.',
  conciliacionNota:
    'No existe conciliación operativa ni sincronización con ningún otro sistema. Los metadatos de origen, identificador externo, sistema maestro y estado de sincronización solo preparan una conexión futura; cuando no hay conexión, el detalle escribe «Conexión no habilitada» y no muestra ninguna fecha de sincronización.',
  detalle: {
    titulo: 'Detalle del movimiento y su evidencia',
    idInterno: 'Identificador interno',
    referencia: 'Factura o cuenta',
    fecha: 'Fecha del movimiento',
    concepto: 'Concepto',
    tipoSoporte: 'Tipo de soporte',
    programa: 'Programa',
    fuente: 'Fuente de financiación',
    entidad: 'Proveedor o entidad',
    valor: 'Valor',
    moneda: 'Moneda',
    estadoFinanciero: 'Estado financiero',
    estadoValidacion: 'Estado de validación',
    origen: 'Origen del dato',
    sistemaMaestro: 'Sistema maestro',
    referenciaExterna: 'Identificador externo',
    sistemaFuente: 'Sistema fuente',
    institucion: 'Institución',
    sincronizacion: 'Estado de sincronización',
    ultimaSincronizacion: 'Última sincronización',
    registradoPor: 'Registrado por',
    revisadoPor: 'Revisado por',
    audiencias: 'Visible para',
    evidencias: 'Evidencias relacionadas',
    evidenciaTipo: 'Tipo',
    evidenciaEstado: 'Estado',
    evidenciaActividad: 'Actividad soportada',
    evidenciaInstitucion: 'Institución',
    procedencia: 'Procedencia',
    cerrar: 'Cerrar',
    sinRegistro: 'Sin registro',
    sinSincronizacion: 'Sin sincronización',
    sinReferenciaExterna: 'Sin identificador externo',
  },
  procedencia: PROCEDENCIA_A04,
};

/* ============ TASK-ALCALDIA-DEMO-FINAL (A-05): siete módulos ============== */

/**
 * Contrato de los siete módulos que cierran la demostración de Alcaldía:
 * FURAG y MIPG, ADRES, Derecho al cuidado, Brechas, Cuidadores y formación,
 * Indicadores y resultados y Reportes ejecutivos.
 *
 * Naturaleza de TODO lo que sigue: fixture local de diseño. Ningún valor
 * procede de una fuente oficial, de una integración, de una consulta ni de un
 * cálculo. Que un concepto mencione FURAG, MIPG, ADRES, BDUA, LMA, SENA o la
 * Sentencia T-319 de 2025 no convierte el valor en oficial: la referencia
 * institucional y el origen técnico del dato son dos cosas distintas y aquí se
 * declaran por separado.
 *
 * No se reimplementan población, territorio, programas, presupuesto,
 * movimientos ni evidencias: cuando un resumen representa el mismo concepto ya
 * definido por A-01–A-04, esta configuración referencia el dato existente en
 * lugar de repetirlo o recalcularlo.
 */

/**
 * Estados visibles de conexión (§17). La demostración declara únicamente
 * ausencia de conexión: no existe conector, adaptador, credencial ni consulta,
 * y ninguna pantalla afirma haber importado, consultado, sincronizado o
 * verificado nada.
 */
export const MUNICIPALITY_ESTADOS_CONEXION = {
  SIN_CONEXION: 'Conexión no habilitada',
  SIN_DATO_OFICIAL: 'Dato oficial no disponible',
  SIN_INTEGRACION_TECNICA: 'Sin integración técnica',
  SIN_GENERACION: 'Generación no habilitada',
} as const;

export type MunicipalityEstadoConexion = keyof typeof MUNICIPALITY_ESTADOS_CONEXION;

/**
 * Fuente de referencia institucional de un valor, separada de su procedencia
 * técnica real.
 *
 * `referencia` nombra el marco conceptual del que ese dato provendría si
 * existiera una fuente autorizada; `procedencia` describe de dónde sale el
 * valor que hoy se muestra, que siempre es un fixture. Un contrato futuro
 * podrá sustituir el fixture por un dato con dataset, versión y vigencia sin
 * cambiar la composición.
 */
export interface MunicipalityFuenteReferencia {
  /** Marco o entidad citada. Nunca prueba oficialidad del valor mostrado. */
  readonly referencia: string;
  /** Origen técnico real del valor visible. */
  readonly procedencia: MunicipalityProcedenciaRef;
  /** Estado de conexión declarado; siempre es de ausencia. */
  readonly estadoConexion: MunicipalityEstadoConexion;
}

/** Encabezado común de las siete vistas de esta tarea. */
export interface MunicipalityVistaEncabezado {
  readonly titulo: string;
  readonly descripcion: string;
  /** Frases que fijan el límite institucional de la pantalla. */
  readonly limites: readonly string[];
}

/* ------------------------------ FURAG y MIPG ------------------------------ */

/** Barra del histórico demostrativo. El valor siempre está escrito. */
export interface MunicipalityFuragHistorico {
  readonly id: string;
  readonly vigencia: string;
  readonly valor: string;
  /** Altura relativa de la barra, en porcentaje. Es decorativa. */
  readonly altura: number;
  readonly tono: MunicipalityTono;
}

/**
 * Resultado institucional de referencia.
 *
 * `valor` es un fixture inequívoco: la plataforma no lo calcula, no lo importó
 * y no lo consultó. `resultadoOficial` queda preparado para el día en que una
 * fuente autorizada lo aporte y hoy es `null`.
 */
export interface MunicipalityFuragResultado {
  readonly titulo: string;
  readonly valor: string;
  readonly contexto: string;
  readonly vigencia: string;
  /** Resultado publicado por la autoridad competente. Hoy no existe. */
  readonly resultadoOficial: string | null;
  readonly fuente: MunicipalityFuenteReferencia;
  readonly nota: string;
}

/** Estado de la evidencia disponible para una política o tema de MIPG. */
export type MunicipalityFuragEstado = 'COMPLETA' | 'PARCIAL' | 'PENDIENTE';

/**
 * Fila del mapa de evidencias por política de MIPG.
 *
 * Describe qué evidencia está disponible para soportar la gestión, nunca si el
 * municipio «cumple». `brecha` y `accionMejora` quedan declarados para que una
 * pasada posterior pueda trabajarlos sin rediseñar la configuración.
 */
export interface MunicipalityFuragPolitica {
  readonly id: string;
  readonly dimension: string;
  readonly politica: string;
  readonly evidencia: string;
  readonly responsable: string;
  readonly periodo: string;
  readonly estado: MunicipalityFuragEstado;
  readonly tono: MunicipalityTono;
  readonly brecha: string | null;
  readonly accionMejora: string | null;
  readonly fuente: MunicipalityFuenteReferencia;
}

export interface MunicipalityFuragConfig extends MunicipalityVistaEncabezado {
  readonly queEsTitulo: string;
  readonly queEsTexto: string;
  readonly resultado: MunicipalityFuragResultado;
  readonly historicoTitulo: string;
  readonly historicoResumen: string;
  readonly historico: readonly MunicipalityFuragHistorico[];
  readonly disponibleTitulo: string;
  readonly disponibles: readonly MunicipalityKpi[];
  readonly matrizTitulo: string;
  readonly matrizResumen: string;
  readonly matrizColumnas: {
    readonly politica: string;
    readonly evidencia: string;
    readonly responsable: string;
    readonly periodo: string;
    readonly estado: string;
  };
  readonly matriz: readonly MunicipalityFuragPolitica[];
  readonly estadosEtiquetas: Record<MunicipalityFuragEstado, string>;
  readonly notaInstitucional: string;
  readonly procedencia: MunicipalityProcedenciaRef;
}

/* ---------------------------------- ADRES --------------------------------- */

/** Agregado demostrativo de aseguramiento o financiación de referencia. */
export interface MunicipalityAdresAgregado {
  readonly id: string;
  readonly valor: string;
  readonly titulo: string;
  readonly fuente: MunicipalityFuenteReferencia;
  readonly tono: MunicipalityTono;
}

/**
 * Fila de la comparación administrativa.
 *
 * Las tres columnas son fixtures. La diferencia es una observación para
 * revisión administrativa: no es un error, no corrige la fuente oficial y no
 * habilita ninguna acción sobre ella.
 */
export interface MunicipalityAdresComparacion {
  readonly id: string;
  readonly concepto: string;
  readonly enPlataforma: string;
  readonly oficial: string;
  readonly diferencia: string;
  readonly tono: MunicipalityTono;
}

export interface MunicipalityAdresConfig extends MunicipalityVistaEncabezado {
  readonly agregadosTitulo: string;
  readonly agregados: readonly MunicipalityAdresAgregado[];
  readonly comparacionTitulo: string;
  readonly comparacionResumen: string;
  readonly comparacionColumnas: {
    readonly concepto: string;
    readonly plataforma: string;
    readonly oficial: string;
    readonly diferencia: string;
  };
  readonly comparacion: readonly MunicipalityAdresComparacion[];
  readonly notaRevision: string;
  readonly notaPresupuesto: string;
  readonly procedencia: MunicipalityProcedenciaRef;
}

/* --------------------- Seguimiento al derecho al cuidado ------------------ */

/** Fila de la matriz de seguimiento por componente. */
export interface MunicipalityCuidadoComponente {
  readonly id: string;
  readonly componente: string;
  readonly identificada: string;
  readonly atendida: string;
  readonly seguimiento: string;
  readonly pendiente: string;
}

export interface MunicipalityCuidadoConfig extends MunicipalityVistaEncabezado {
  /** Denominación exacta y única de la sentencia aplicable. */
  readonly normaReferencia: string;
  readonly normaTexto: string;
  readonly accionesTitulo: string;
  readonly acciones: readonly MunicipalityKpi[];
  readonly matrizTitulo: string;
  readonly matrizResumen: string;
  readonly matrizColumnas: {
    readonly componente: string;
    readonly identificada: string;
    readonly atendida: string;
    readonly seguimiento: string;
    readonly pendiente: string;
  };
  readonly matriz: readonly MunicipalityCuidadoComponente[];
  readonly notaLenguaje: string;
  readonly fuente: MunicipalityFuenteReferencia;
  readonly procedencia: MunicipalityProcedenciaRef;
}

/* --------------------------------- Brechas -------------------------------- */

/**
 * Prioridad administrativa de una brecha. Es una prioridad de gestión
 * documental del municipio y nunca una clasificación sobre una persona.
 */
export type MunicipalityBrechaEstado = 'PRIORITARIO' | 'SEGUIMIENTO';

export interface MunicipalityBrecha {
  readonly id: string;
  readonly valor: string;
  readonly titulo: string;
  readonly detalle: string;
  readonly estado: MunicipalityBrechaEstado;
  readonly tono: MunicipalityTono;
}

export interface MunicipalityBrechasConfig extends MunicipalityVistaEncabezado {
  readonly estados: Record<MunicipalityBrechaEstado, string>;
  readonly listaResumen: string;
  readonly brechas: readonly MunicipalityBrecha[];
  readonly notaAdministrativa: string;
  readonly procedencia: MunicipalityProcedenciaRef;
}

/* --------------------------- Cuidadores y formación ----------------------- */

/** Paso de la ruta de formación. El valor y el porcentaje están escritos. */
export interface MunicipalityRutaFormacion {
  readonly id: string;
  readonly etapa: string;
  readonly valor: string;
  readonly porcentaje: number;
  readonly porcentajeTexto: string;
  readonly tono: MunicipalityTono;
}

export interface MunicipalityCuidadoresConfig extends MunicipalityVistaEncabezado {
  readonly agregadosTitulo: string;
  readonly agregados: readonly MunicipalityKpi[];
  readonly rutaTitulo: string;
  readonly rutaResumen: string;
  readonly ruta: readonly MunicipalityRutaFormacion[];
  readonly senaTitulo: string;
  readonly senaTexto: string;
  readonly verificacionTexto: string;
  readonly fuenteFormadora: MunicipalityFuenteReferencia;
  readonly procedencia: MunicipalityProcedenciaRef;
}

/* ------------------------- Indicadores y resultados ----------------------- */

/**
 * Indicador comparado entre dos periodos.
 *
 * La variación es una observación descriptiva del fixture. No hay fórmula,
 * meta, método de cálculo ni responsable aprobados: esos campos quedan
 * declarados y vacíos para que un catálogo posterior los complete sin
 * rediseñar la vista.
 */
export interface MunicipalityIndicador {
  readonly id: string;
  readonly nombre: string;
  readonly definicion: string;
  readonly unidad: string;
  readonly periodoAnterior: string;
  readonly periodoActual: string;
  readonly variacion: string;
  readonly tono: MunicipalityTono;
  /** Fórmula oficial. Pendiente de decisión material; nunca se inventa. */
  readonly formula: string | null;
  /** Responsable del indicador en la entidad. Pendiente de definición. */
  readonly responsable: string | null;
  /** Método de cálculo aprobado. Pendiente de definición. */
  readonly metodo: string | null;
  readonly version: string;
  readonly fuente: MunicipalityFuenteReferencia;
  /** Linaje del valor. Pendiente mientras no exista fuente autorizada. */
  readonly linaje: string | null;
}

export interface MunicipalityIndicadoresConfig extends MunicipalityVistaEncabezado {
  /** Frase exacta exigida por la Task para la lectura de la variación. */
  readonly variacionFrase: string;
  readonly comparacionTitulo: string;
  readonly comparacionResumen: string;
  readonly comparacionColumnas: {
    readonly indicador: string;
    readonly anterior: string;
    readonly actual: string;
    readonly variacion: string;
  };
  readonly indicadores: readonly MunicipalityIndicador[];
  readonly satisfaccionTitulo: string;
  readonly satisfaccion: readonly MunicipalityKpi[];
  readonly notaCausalidad: string;
  readonly notaSatisfaccion: string;
  readonly procedencia: MunicipalityProcedenciaRef;
}

/* --------------------------- Reportes ejecutivos -------------------------- */

/** Estado de disponibilidad de un informe. La demo solo declara ausencia. */
export type MunicipalityReporteEstado = 'NO_DISPONIBLE_DEMO';

/** Clave y valor de la portada. Cada valor referencia su origen declarado. */
export interface MunicipalityPortadaDato {
  readonly id: string;
  readonly clave: string;
  readonly valor: string;
  /** Módulo de A-01–A-04 que ya declara ese valor, cuando aplica. */
  readonly origenDeclarado: string;
}

/**
 * Informe ejecutivo del catálogo.
 *
 * Los formatos son referencia visual del diseño aprobado: no generan archivo,
 * no producen mensaje de éxito y no ejecutan ninguna acción.
 */
export interface MunicipalityReporte {
  readonly id: string;
  readonly titulo: string;
  readonly descripcion: string;
  readonly formatos: readonly string[];
  readonly estado: MunicipalityReporteEstado;
  readonly estadoTexto: string;
  readonly fuente: MunicipalityFuenteReferencia;
}

export interface MunicipalityReportesConfig extends MunicipalityVistaEncabezado {
  /** Aviso inequívoco de que la generación no está habilitada. */
  readonly aviso: string;
  readonly portadaEtiqueta: string;
  readonly portadaTitulo: string;
  readonly portadaResumen: string;
  readonly portada: readonly MunicipalityPortadaDato[];
  readonly catalogoTitulo: string;
  readonly reportes: readonly MunicipalityReporte[];
  readonly formatosEtiqueta: string;
  readonly notaFormatos: string;
  readonly notaFuentes: string;
  readonly procedencia: MunicipalityProcedenciaRef;
}

/* ---------------------------- Fixtures A-05 ------------------------------- */

/**
 * Procedencia de TODO lo que muestran los siete módulos de esta tarea: fixture
 * local de diseño, sin fecha de corte y sin integración. Se reutiliza la misma
 * constante de A-02 en lugar de declarar otra categoría.
 */
const PROCEDENCIA_A05 = MUNICIPALITY_PROCEDENCIA_DEMO;

/**
 * Construye una fuente de referencia: separa el marco institucional citado del
 * origen técnico real del valor, que siempre es el fixture.
 */
function referenciaInstitucional(
  referencia: string,
  estadoConexion: MunicipalityEstadoConexion,
): MunicipalityFuenteReferencia {
  return { referencia, procedencia: PROCEDENCIA_A05, estadoConexion };
}

/** Valor ya declarado por A-02 en la población objetivo; aquí solo se cita. */
function valorPoblacionObjetivo(id: string): string {
  return municipalityPoblacionDemo.objetivo.find((item) => item.id === id)?.valor ?? '';
}

/* ------------------------------ FURAG y MIPG ------------------------------ */

export const municipalityFuragDemo: MunicipalityFuragConfig = {
  titulo: 'FURAG y MIPG',
  descripcion: `${branding.platformDisplayName} organiza la evidencia, muestra qué información está disponible e identifica brechas para que el municipio documente su gestión.`,
  limites: [
    `${platformNameInSentence()} no calcula el puntaje FURAG, no declara cumplimiento, no certifica mejora y no produce ninguna clasificación oficial entre municipios.`,
    'La medición y su resultado corresponden exclusivamente a la autoridad competente.',
    'No hay conexión con Función Pública ni con ningún sistema de reporte: esta pantalla no realiza importación, consulta ni sincronización de ninguna fuente.',
  ],
  queEsTitulo: 'Qué es FURAG',
  queEsTexto:
    'FURAG es el Formulario Único de Reporte y Avance de Gestión. La información que las entidades reportan allí alimenta la Medición del Desempeño Institucional, que realiza la autoridad competente. El Modelo Integrado de Planeación y Gestión (MIPG) organiza esa gestión por dimensiones y políticas.',
  resultado: {
    titulo: 'Resultado institucional de referencia',
    valor: '71,4',
    contexto: 'Vigencia 2025 · Medición del Desempeño Institucional',
    vigencia: '2025',
    resultadoOficial: null,
    fuente: referenciaInstitucional('Marco de referencia: FURAG y MIPG', 'SIN_CONEXION'),
    nota: `Valor de fixture demostrativo. No es un resultado oficial, no fue publicado por ninguna entidad y ${platformNameInSentence()} no lo genera. El resultado oficial y su fecha de actualización se mostrarán únicamente cuando exista una fuente autorizada.`,
  },
  historicoTitulo: 'Serie demostrativa por vigencia',
  historicoResumen:
    'Serie demostrativa de tres vigencias. Cada valor está escrito junto a su barra: la altura es decorativa y no aporta información adicional.',
  historico: [
    { id: 'v2023', vigencia: '2023', valor: '64,1', altura: 63, tono: 'azul' },
    { id: 'v2024', vigencia: '2024', valor: '68,3', altura: 83, tono: 'teal' },
    { id: 'v2025', vigencia: '2025', valor: '71,4', altura: 100, tono: 'azul' },
  ],
  disponibleTitulo: `Evidencia disponible en ${branding.platformDisplayName}`,
  disponibles: [
    {
      id: 'documentos',
      valor: '486',
      titulo: 'Documentos de soporte',
      aclaracion: 'Soportes registrados como evidencia disponible para la gestión',
    },
    {
      id: 'indicadores',
      valor: '38',
      titulo: 'Indicadores estructurados',
      aclaracion: 'Indicadores con definición y periodo declarados en el fixture',
    },
    {
      id: 'programas',
      valor: '5',
      titulo: 'Programas documentados',
      aclaracion: 'Los mismos programas declarados en la pantalla Programas',
    },
    {
      id: 'actividades',
      valor: '232',
      titulo: 'Actividades con evidencia',
      aclaracion: 'Actividades ejecutadas con soporte registrado',
    },
    {
      id: 'reportes',
      valor: '14',
      titulo: 'Estructuras de reporte preparadas',
      aclaracion: 'Informes previstos en el catálogo; su generación no está habilitada',
    },
    {
      id: 'brechas',
      valor: '9',
      titulo: 'Brechas identificadas',
      aclaracion: 'Pendientes administrativos abiertos en la pantalla Brechas',
    },
  ],
  matrizTitulo: 'Mapa de evidencias por política de MIPG',
  matrizResumen:
    'Mapa demostrativo de evidencia disponible por política de MIPG, con responsable, periodo y estado de la evidencia. El estado describe la evidencia, no el cumplimiento.',
  matrizColumnas: {
    politica: 'POLÍTICA O TEMA',
    evidencia: 'EVIDENCIA DISPONIBLE',
    responsable: 'RESPONSABLE',
    periodo: 'PERIODO',
    estado: 'ESTADO',
  },
  matriz: [
    {
      id: 'pol-informacion',
      dimension: 'Información y comunicación',
      politica: 'Gestión de la información',
      evidencia: 'Registros estructurados de población, atención y seguimiento',
      responsable: 'Secretaría de Salud',
      periodo: '2026',
      estado: 'COMPLETA',
      tono: 'verde',
      brecha: null,
      accionMejora: null,
      fuente: referenciaInstitucional('Política de MIPG', 'SIN_CONEXION'),
    },
    {
      id: 'pol-servicio',
      dimension: 'Gestión con valores para resultados',
      politica: 'Servicio al ciudadano',
      evidencia: 'Evaluaciones de atención agregadas del periodo',
      responsable: 'Secretaría de Salud',
      periodo: '2026',
      estado: 'COMPLETA',
      tono: 'verde',
      brecha: null,
      accionMejora: null,
      fuente: referenciaInstitucional('Política de MIPG', 'SIN_CONEXION'),
    },
    {
      id: 'pol-participacion',
      dimension: 'Gestión con valores para resultados',
      politica: 'Participación ciudadana',
      evidencia: 'Actas de comité de cuidadores pendientes de registrar',
      responsable: 'Desarrollo Social',
      periodo: '2026',
      estado: 'PARCIAL',
      tono: 'amarillo',
      brecha: 'Faltan actas del último comité en el registro documental.',
      accionMejora: 'Registrar las actas pendientes antes del cierre de la vigencia.',
      fuente: referenciaInstitucional('Política de MIPG', 'SIN_CONEXION'),
    },
    {
      id: 'pol-seguimiento',
      dimension: 'Evaluación de resultados',
      politica: 'Seguimiento y evaluación',
      evidencia: 'Indicadores por programa con variación declarada',
      responsable: 'Planeación',
      periodo: '2026',
      estado: 'COMPLETA',
      tono: 'verde',
      brecha: null,
      accionMejora: null,
      fuente: referenciaInstitucional('Política de MIPG', 'SIN_CONEXION'),
    },
    {
      id: 'pol-presupuestal',
      dimension: 'Direccionamiento estratégico y planeación',
      politica: 'Gestión presupuestal',
      evidencia: 'Soportes y fuente de financiación por actividad',
      responsable: 'Hacienda',
      periodo: '2026',
      estado: 'PARCIAL',
      tono: 'amarillo',
      brecha: 'Actividades ejecutadas sin soporte registrado en el periodo.',
      accionMejora: 'Completar los soportes de las actividades pendientes.',
      fuente: referenciaInstitucional('Política de MIPG', 'SIN_CONEXION'),
    },
    {
      id: 'pol-conocimiento',
      dimension: 'Gestión del conocimiento y la innovación',
      politica: 'Gestión del conocimiento',
      evidencia: 'Sin documentación registrada en el periodo',
      responsable: 'Planeación',
      periodo: '2026',
      estado: 'PENDIENTE',
      tono: 'rojo',
      brecha: 'No hay evidencia registrada para esta política.',
      accionMejora: 'Definir responsable y documentar la gestión del periodo.',
      fuente: referenciaInstitucional('Política de MIPG', 'SIN_CONEXION'),
    },
  ],
  estadosEtiquetas: {
    COMPLETA: 'Completa',
    PARCIAL: 'Parcial',
    PENDIENTE: 'Pendiente',
  },
  notaInstitucional:
    'El lenguaje de esta pantalla es «evidencia disponible para soporte de gestión», nunca «cumple FURAG». El estado describe qué evidencia existe en la demostración y no anticipa ninguna medición.',
  procedencia: PROCEDENCIA_A05,
};

/* ---------------------------------- ADRES --------------------------------- */

export const municipalityAdresDemo: MunicipalityAdresConfig = {
  titulo: 'ADRES',
  descripcion:
    'Información de referencia sobre aseguramiento y financiación territorial, presentada de forma agregada para revisión administrativa.',
  limites: [
    'ADRES administra recursos e información del aseguramiento en salud. No es un regulador, no emite una calificación municipal y no evalúa a la entidad territorial.',
    `${platformNameInSentence()} no determina ni gestiona los recursos que administra o gira ADRES, no modifica la información oficial y no corrige ninguna fuente externa.`,
    'La información de aseguramiento no equivale al presupuesto municipal ni lo sustituye: el presupuesto de esta demostración vive en «Presupuesto y ejecución».',
    'No hay conexión con ninguna base de afiliación ni con ningún sistema de liquidación: esta pantalla no realiza importación, consulta ni sincronización de ninguna fuente.',
  ],
  agregadosTitulo: 'Información de referencia disponible',
  agregados: [
    {
      id: 'afiliada',
      valor: '778.412',
      titulo: 'Población afiliada del municipio',
      fuente: referenciaInstitucional('Concepto de referencia: base de afiliación', 'SIN_CONEXION'),
      tono: 'azul',
    },
    {
      id: 'subsidiado',
      valor: '396.204',
      titulo: 'Régimen subsidiado',
      fuente: referenciaInstitucional('Concepto de referencia: base de afiliación', 'SIN_CONEXION'),
      tono: 'azul',
    },
    {
      id: 'contributivo',
      valor: '382.208',
      titulo: 'Régimen contributivo',
      fuente: referenciaInstitucional('Concepto de referencia: base de afiliación', 'SIN_CONEXION'),
      tono: 'azul',
    },
    {
      id: 'eps',
      valor: '11',
      titulo: 'EPS con afiliados reportados en el municipio',
      fuente: referenciaInstitucional('Concepto de referencia: base de afiliación', 'SIN_CONEXION'),
      tono: 'azul',
    },
    {
      id: 'lma',
      valor: '394.860',
      titulo: 'Afiliados de la liquidación mensual de referencia',
      fuente: referenciaInstitucional(
        'Concepto de referencia: liquidación mensual de afiliados (LMA)',
        'SIN_CONEXION',
      ),
      tono: 'teal',
    },
    {
      id: 'upc',
      valor: '$41.284 M',
      titulo: 'Valor liquidado del periodo por unidad de pago por capitación',
      fuente: referenciaInstitucional(
        'Concepto de referencia: financiación del aseguramiento',
        'SIN_CONEXION',
      ),
      tono: 'teal',
    },
    {
      id: 'fuentes',
      valor: '4',
      titulo: 'Fuentes de financiación de referencia reportadas',
      fuente: referenciaInstitucional(
        'Concepto de referencia: financiación del aseguramiento',
        'SIN_CONEXION',
      ),
      tono: 'teal',
    },
    {
      id: 'actualizacion',
      valor: 'Dato oficial no disponible',
      titulo: 'Fecha de actualización de la fuente oficial',
      fuente: referenciaInstitucional('Sin fuente autorizada conectada', 'SIN_DATO_OFICIAL'),
      tono: 'amarillo',
    },
  ],
  comparacionTitulo: `Población en ${branding.platformDisplayName} frente a la información de referencia`,
  comparacionResumen:
    'Comparación demostrativa por concepto. Las tres columnas son fixtures y la diferencia solo señala trabajo administrativo pendiente.',
  comparacionColumnas: {
    concepto: 'CONCEPTO',
    plataforma: `EN ${branding.platformDisplayName.toLocaleUpperCase('es-CO')}`,
    oficial: 'OFICIAL',
    diferencia: 'DIFERENCIA',
  },
  comparacion: [
    {
      id: 'mayores',
      concepto: 'Personas de 60 años o más registradas',
      enPlataforma: '2.196',
      oficial: '6.117',
      diferencia: '3.921 por vincular',
      tono: 'amarillo',
    },
    {
      id: 'eps',
      concepto: 'Personas con aseguradora identificada',
      enPlataforma: '2.986',
      oficial: '3.050',
      diferencia: '64 por identificar',
      tono: 'amarillo',
    },
    {
      id: 'subsidiado',
      concepto: 'Personas del régimen subsidiado',
      enPlataforma: '2.412',
      oficial: '2.468',
      diferencia: '56 por revisar',
      tono: 'amarillo',
    },
    {
      id: 'discapacidad',
      concepto: 'Personas con discapacidad registradas',
      enPlataforma: '1.050',
      oficial: '1.912',
      diferencia: '862 por caracterizar',
      tono: 'amarillo',
    },
    {
      id: 'coinciden',
      concepto: 'Registros que coinciden plenamente',
      enPlataforma: '2.986',
      oficial: '2.986',
      diferencia: 'Sin diferencia',
      tono: 'verde',
    },
  ],
  notaRevision:
    'Las diferencias se muestran para revisión administrativa. No son errores de la fuente oficial, no la corrigen y no habilitan ninguna acción sobre ella.',
  notaPresupuesto:
    'La columna «OFICIAL» es un fixture demostrativo mientras no exista una fuente autorizada conectada: hoy no hay dato oficial disponible y ninguna de estas cifras forma parte del presupuesto municipal de la demostración.',
  procedencia: PROCEDENCIA_A05,
};

/* --------------------- Seguimiento al derecho al cuidado ------------------ */

export const municipalityCuidadoDemo: MunicipalityCuidadoConfig = {
  titulo: 'Seguimiento al derecho al cuidado',
  descripcion:
    'Evidencia agregada de las acciones municipales e institucionales en identificación, valoración, atención domiciliaria, seguimiento y corresponsabilidad.',
  limites: [
    `${platformNameInSentence()} documenta acciones, cobertura, evidencia, pendientes y seguimiento. No certifica el cumplimiento de ningún derecho: esa determinación corresponde a la autoridad competente.`,
    'Toda la información es agregada. Ninguna cifra identifica personas ni permite consultar registros individuales.',
  ],
  normaReferencia: 'Sentencia T-319 de 2025',
  normaTexto:
    'Marco de referencia citado: Sentencia T-319 de 2025. La aplicabilidad, el alcance y la evidencia exigida por ese marco son decisiones materiales pendientes y esta demostración no las interpreta.',
  accionesTitulo: 'Acciones registradas',
  acciones: [
    {
      id: 'mayores',
      valor: '2.196',
      titulo: 'Personas mayores registradas',
      aclaracion: 'Agregado del municipio',
    },
    {
      id: 'necesidad',
      valor: '1.640',
      titulo: 'Personas con necesidad de cuidado',
      aclaracion: 'Identificadas por el municipio y la red',
    },
    {
      id: 'con-cuidador',
      valor: '1.164',
      titulo: 'Personas con cuidador registrado',
      aclaracion: 'Relación de cuidado declarada en el fixture',
    },
    {
      id: 'sin-cuidador',
      valor: '476',
      titulo: 'Personas sin cuidador identificado',
      aclaracion: 'Pendiente de caracterización administrativa',
    },
    {
      id: 'domiciliaria',
      valor: '412',
      titulo: 'Con atención domiciliaria activa',
      aclaracion: 'Agregado del periodo',
    },
    {
      id: 'valoracion',
      valor: '386',
      titulo: 'Con valoración profesional registrada',
      aclaracion: 'Registro agregado de la acción, sin contenido asistencial',
    },
    {
      id: 'seguimiento',
      valor: '358',
      titulo: 'Con seguimiento vigente',
      aclaracion: 'Agregado del periodo',
    },
    {
      id: 'visitas',
      valor: '1.284',
      titulo: 'Visitas domiciliarias del año',
      aclaracion: 'En lo corrido del año',
    },
    {
      id: 'virtuales',
      valor: '386',
      titulo: 'Consultas virtuales del año',
      aclaracion: 'En lo corrido del año',
    },
    {
      id: 'interdisciplinarias',
      valor: '142',
      titulo: 'Valoraciones interdisciplinarias',
      aclaracion: 'Agregado del periodo',
    },
    {
      id: 'educacion',
      valor: '744',
      titulo: 'Cuidadores con educación registrada',
      aclaracion: 'Acompañamiento formativo documentado',
    },
    {
      id: 'alertas',
      valor: '233 de 248',
      titulo: 'Avisos de gestión atendidos',
      aclaracion: 'Pendientes administrativos cerrados sobre el total generado',
    },
  ],
  matrizTitulo: 'Matriz de seguimiento',
  matrizResumen:
    'Matriz demostrativa por componente: población identificada, atendida, en seguimiento y pendiente. Todos los valores son agregados.',
  matrizColumnas: {
    componente: 'COMPONENTE',
    identificada: 'IDENTIFICADA',
    atendida: 'ATENDIDA',
    seguimiento: 'EN SEGUIMIENTO',
    pendiente: 'PENDIENTE',
  },
  matriz: [
    {
      id: 'mayores',
      componente: 'Mayores de 60',
      identificada: '6.117',
      atendida: '2.196',
      seguimiento: '1.664',
      pendiente: '3.921',
    },
    {
      id: 'discapacidad',
      componente: 'Discapacidad',
      identificada: '2.845',
      atendida: '1.050',
      seguimiento: '762',
      pendiente: '1.795',
    },
    {
      id: 'cuidado-casa',
      componente: 'Cuidado en casa',
      identificada: '1.640',
      atendida: '928',
      seguimiento: '744',
      pendiente: '712',
    },
  ],
  notaLenguaje:
    'Lenguaje de esta pantalla: evidencias registradas, acciones implementadas, cobertura alcanzada, pendientes identificados y seguimiento documentado.',
  fuente: referenciaInstitucional('Marco de referencia: Sentencia T-319 de 2025', 'SIN_CONEXION'),
  procedencia: PROCEDENCIA_A05,
};

/* --------------------------------- Brechas -------------------------------- */

export const municipalityBrechasDemo: MunicipalityBrechasConfig = {
  titulo: '¿Qué nos falta atender?',
  descripcion:
    'Pendientes administrativos y documentales del periodo, ordenados por prioridad de gestión.',
  limites: [
    'Cada brecha es un pendiente de gestión del municipio, expresado como agregado. No es una valoración de salud, no clasifica a ninguna persona y no orienta ninguna decisión asistencial.',
    'La prioridad es administrativa: indica qué trabajo documental o de vinculación conviene atender antes, y está escrita además del color.',
  ],
  estados: {
    PRIORITARIO: 'PRIORITARIO',
    SEGUIMIENTO: 'SEGUIMIENTO',
  },
  listaResumen:
    'Nueve brechas administrativas demostrativas, cada una con su valor, su detalle y su prioridad escrita.',
  brechas: [
    {
      id: 'sin-vincular',
      valor: '5.092',
      titulo: `Personas identificadas sin vincular a ${branding.platformDisplayName}`,
      detalle: 'La mayor concentración está en la zona de Cazucá y en la zona rural',
      estado: 'PRIORITARIO',
      tono: 'rojo',
    },
    {
      id: 'sin-cuidador',
      valor: '476',
      titulo: 'Personas con necesidad de cuidado sin cuidador identificado',
      detalle: 'Requieren caracterización administrativa y ruta de apoyo',
      estado: 'PRIORITARIO',
      tono: 'rojo',
    },
    {
      id: 'sin-seguimiento',
      valor: '27',
      titulo: 'Personas sin seguimiento reciente',
      detalle: 'Sin registro de seguimiento en los últimos 45 días',
      estado: 'PRIORITARIO',
      tono: 'rojo',
    },
    {
      id: 'avisos-abiertos',
      valor: '15',
      titulo: 'Avisos de gestión abiertos sin cierre documentado',
      detalle: '4 con prioridad alta y 11 en seguimiento documental',
      estado: 'SEGUIMIENTO',
      tono: 'amarillo',
    },
    {
      id: 'cobertura-zonas',
      valor: '2',
      titulo: 'Zonas con cobertura inferior al 50 %',
      detalle: 'Cazucá con 44 % y zona rural con 31 %',
      estado: 'SEGUIMIENTO',
      tono: 'amarillo',
    },
    {
      id: 'cuidadores-sin-formacion',
      valor: '722',
      titulo: 'Cuidadores sin formación registrada',
      detalle: 'Sin constancia de formación en el registro del municipio',
      estado: 'SEGUIMIENTO',
      tono: 'amarillo',
    },
    {
      id: 'programa-baja-ejecucion',
      valor: '1',
      titulo: 'Programa con ejecución muy baja',
      detalle: 'Formación de cuidadores con 26 % de ejecución declarada',
      estado: 'SEGUIMIENTO',
      tono: 'amarillo',
    },
    {
      id: 'presupuesto-sin-ejecutar',
      valor: '$300 M',
      titulo: 'Presupuesto sin ejecutar',
      detalle: 'Saldo disponible declarado en Presupuesto y ejecución; quedan cuatro meses del periodo',
      estado: 'SEGUIMIENTO',
      tono: 'amarillo',
    },
    {
      id: 'actividades-sin-soporte',
      valor: '18',
      titulo: 'Actividades sin soporte documental',
      detalle: 'Afectan el nivel de evidencia declarado del municipio',
      estado: 'SEGUIMIENTO',
      tono: 'amarillo',
    },
  ],
  notaAdministrativa:
    'Las nueve brechas son pendientes administrativos y documentales de gestión municipal, siempre agregados. Ninguna corresponde a una persona identificable y ninguna expresa una valoración individual.',
  procedencia: PROCEDENCIA_A05,
};

/* --------------------------- Cuidadores y formación ----------------------- */

export const municipalityCuidadoresDemo: MunicipalityCuidadoresConfig = {
  titulo: 'Cuidadores y formación',
  descripcion:
    'Desarrollo de capacidades en el territorio, con la ruta de formación y el estado agregado de la certificación.',
  limites: [
    'Toda la información es agregada. No se muestran personas, ni condiciones de contratación, ni compensación individual.',
    'Ningún certificado registrado prueba por sí mismo cumplimiento institucional ni resultado alguno de la Medición del Desempeño Institucional.',
  ],
  agregadosTitulo: 'Cuidadores identificados',
  agregados: [
    {
      id: 'identificados',
      valor: '1.164',
      titulo: 'Cuidadores identificados',
      aclaracion: 'Agregado del municipio',
    },
    {
      id: 'familiares',
      valor: '886',
      titulo: 'Cuidadores familiares',
      aclaracion: 'Relación de cuidado familiar declarada',
    },
    {
      id: 'remunerados',
      valor: '278',
      titulo: 'Cuidadores con vinculación remunerada',
      aclaracion: 'Agregado; la demostración no muestra condiciones económicas individuales',
    },
    {
      id: 'con-formacion',
      valor: '442',
      titulo: 'Con formación registrada',
      aclaracion: 'Constancia de formación registrada en el fixture',
    },
    {
      id: 'sin-formacion',
      valor: '722',
      titulo: 'Sin formación registrada',
      aclaracion: 'Brecha administrativa abierta',
    },
    {
      id: 'en-capacitacion',
      valor: '164',
      titulo: 'En capacitación',
      aclaracion: 'Proceso de formación en curso',
    },
    {
      id: 'certificados',
      valor: '442',
      titulo: 'Con certificación registrada',
      aclaracion: 'Certificados registrados, sin verificación de autenticidad',
    },
    {
      id: 'certificados-sena',
      valor: '318',
      titulo: 'Con certificación registrada del SENA',
      aclaracion: 'El SENA aparece como entidad formadora declarada en el fixture',
    },
    {
      id: 'certificados-otras',
      valor: '124',
      titulo: 'Con certificación de otras instituciones',
      aclaracion: 'Otras entidades formadoras declaradas en el fixture',
    },
  ],
  rutaTitulo: 'Ruta de formación',
  rutaResumen:
    'Cinco etapas de la ruta de formación. Cada etapa muestra su valor y su porcentaje escritos: la barra solo acompaña al número.',
  ruta: [
    {
      id: 'orientados',
      etapa: 'Cuidadores orientados a formación',
      valor: '612',
      porcentaje: 53,
      porcentajeTexto: '53 %',
      tono: 'teal',
    },
    {
      id: 'inscritos',
      etapa: 'Inscritos en un proceso',
      valor: '386',
      porcentaje: 33,
      porcentajeTexto: '33 %',
      tono: 'teal',
    },
    {
      id: 'en-formacion',
      etapa: 'En formación',
      valor: '164',
      porcentaje: 14,
      porcentajeTexto: '14 %',
      tono: 'teal',
    },
    {
      id: 'certificacion-cargada',
      etapa: 'Certificación registrada',
      valor: '442',
      porcentaje: 38,
      porcentajeTexto: '38 %',
      tono: 'verde',
    },
    {
      id: 'certificacion-verificada',
      etapa: 'Certificación verificada',
      valor: '304',
      porcentaje: 26,
      porcentajeTexto: '26 %',
      tono: 'verde',
    },
  ],
  senaTitulo: 'El SENA en esta demostración',
  senaTexto:
    'El SENA es una entidad formadora posible y una fuente de referencia para la certificación de cuidadores. No existe integración técnica con el SENA: no hay consulta, envío, validación automática ni intercambio de información con esa entidad.',
  verificacionTexto:
    '«Certificación verificada» es un estado de fixture. Un certificado registrado no prueba su autenticidad: una verificación productiva futura exigirá autoridad competente, método acordado, fecha, responsable y trazabilidad, y esa decisión sigue pendiente.',
  fuenteFormadora: referenciaInstitucional(
    'Entidad formadora de referencia: SENA',
    'SIN_INTEGRACION_TECNICA',
  ),
  procedencia: PROCEDENCIA_A05,
};

/* ------------------------- Indicadores y resultados ----------------------- */

/** Fuente de referencia común de los indicadores demostrativos. */
const FUENTE_INDICADOR = referenciaInstitucional(
  'Registro agregado de la demostración',
  'SIN_CONEXION',
);

export const municipalityIndicadoresDemo: MunicipalityIndicadoresConfig = {
  titulo: 'Indicadores y resultados',
  descripcion:
    'Comparación demostrativa entre el periodo anterior y el periodo actual, con la satisfacción agregada del servicio.',
  limites: [
    `La variación es una observación descriptiva del fixture: no atribuye causalidad a ${branding.platformDisplayName} ni a ninguna intervención concreta.`,
    'No existe catálogo de indicadores aprobado: definición, unidad, fórmula, meta, responsable, método y linaje quedan declarados y pendientes, y ninguno se inventa aquí.',
  ],
  variacionFrase: 'Variación observada durante el periodo',
  comparacionTitulo: 'Comparación de periodos',
  comparacionResumen:
    'Ocho indicadores demostrativos con su valor en el periodo anterior, su valor en el periodo actual y la variación observada.',
  comparacionColumnas: {
    indicador: 'INDICADOR',
    anterior: 'PERIODO ANTERIOR',
    actual: 'PERIODO ACTUAL',
    variacion: 'VARIACIÓN',
  },
  indicadores: [
    {
      id: 'cobertura',
      nombre: 'Cobertura de población objetivo',
      definicion: 'Proporción declarada de la población objetivo con registro en la plataforma.',
      unidad: 'Porcentaje',
      periodoAnterior: '19,8 %',
      periodoActual: '37,5 %',
      variacion: '+17,7 pp',
      tono: 'verde',
      formula: null,
      responsable: null,
      metodo: null,
      version: 'demo-1',
      fuente: FUENTE_INDICADOR,
      linaje: null,
    },
    {
      id: 'visitas',
      nombre: 'Visitas domiciliarias',
      definicion: 'Número declarado de visitas domiciliarias registradas en el periodo.',
      unidad: 'Conteo',
      periodoAnterior: '742',
      periodoActual: '1.284',
      variacion: '+73 %',
      tono: 'verde',
      formula: null,
      responsable: null,
      metodo: null,
      version: 'demo-1',
      fuente: FUENTE_INDICADOR,
      linaje: null,
    },
    {
      id: 'virtuales',
      nombre: 'Consultas virtuales',
      definicion: 'Número declarado de consultas virtuales registradas en el periodo.',
      unidad: 'Conteo',
      periodoAnterior: '96',
      periodoActual: '386',
      variacion: '+302 %',
      tono: 'verde',
      formula: null,
      responsable: null,
      metodo: null,
      version: 'demo-1',
      fuente: FUENTE_INDICADOR,
      linaje: null,
    },
    {
      id: 'seguimiento',
      nombre: 'Personas con seguimiento vigente',
      definicion: 'Número declarado de personas con seguimiento vigente al cierre del periodo.',
      unidad: 'Conteo',
      periodoAnterior: '188',
      periodoActual: '358',
      variacion: '+90 %',
      tono: 'verde',
      formula: null,
      responsable: null,
      metodo: null,
      version: 'demo-1',
      fuente: FUENTE_INDICADOR,
      linaje: null,
    },
    {
      id: 'respuesta',
      nombre: 'Tiempo promedio de respuesta a avisos de gestión',
      definicion: 'Tiempo promedio declarado entre la apertura y la atención de un aviso.',
      unidad: 'Tiempo',
      periodoAnterior: '6 h 20 min',
      periodoActual: '41 min',
      variacion: '−89 %',
      tono: 'verde',
      formula: null,
      responsable: null,
      metodo: null,
      version: 'demo-1',
      fuente: FUENTE_INDICADOR,
      linaje: null,
    },
    {
      id: 'cuidadores',
      nombre: 'Cuidadores identificados',
      definicion: 'Número declarado de cuidadores identificados en el municipio.',
      unidad: 'Conteo',
      periodoAnterior: '404',
      periodoActual: '1.164',
      variacion: '+188 %',
      tono: 'verde',
      formula: null,
      responsable: null,
      metodo: null,
      version: 'demo-1',
      fuente: FUENTE_INDICADOR,
      linaje: null,
    },
    {
      id: 'certificados',
      nombre: 'Cuidadores con certificación registrada',
      definicion: 'Número declarado de cuidadores con certificación registrada.',
      unidad: 'Conteo',
      periodoAnterior: '96',
      periodoActual: '442',
      variacion: '+360 %',
      tono: 'verde',
      formula: null,
      responsable: null,
      metodo: null,
      version: 'demo-1',
      fuente: FUENTE_INDICADOR,
      linaje: null,
    },
    {
      id: 'evidencia',
      nombre: 'Actividades con evidencia documental',
      definicion: 'Proporción declarada de actividades ejecutadas con soporte registrado.',
      unidad: 'Porcentaje',
      periodoAnterior: '61,4 %',
      periodoActual: '92,8 %',
      variacion: '+31,4 pp',
      tono: 'verde',
      formula: null,
      responsable: null,
      metodo: null,
      version: 'demo-1',
      fuente: FUENTE_INDICADOR,
      linaje: null,
    },
  ],
  satisfaccionTitulo: 'Satisfacción agregada',
  satisfaccion: [
    {
      id: 'general',
      valor: '4,4',
      titulo: 'Calificación general',
      aclaracion: 'Promedio agregado sobre 5, declarado por el fixture',
    },
    {
      id: 'evaluaciones',
      valor: '628',
      titulo: 'Evaluaciones recibidas',
      aclaracion: 'Total agregado del periodo',
    },
    {
      id: 'puntualidad',
      valor: '4,0',
      titulo: 'Puntualidad',
      aclaracion: 'Promedio agregado sobre 5',
    },
    {
      id: 'comunicacion',
      valor: '4,7',
      titulo: 'Comunicación',
      aclaracion: 'Promedio agregado sobre 5',
    },
    {
      id: 'empatia',
      valor: '4,8',
      titulo: 'Empatía',
      aclaracion: 'Promedio agregado sobre 5',
    },
    {
      id: 'orientacion',
      valor: '4,1',
      titulo: 'Orientación al cuidador',
      aclaracion: 'Promedio agregado sobre 5',
    },
  ],
  notaCausalidad: `Variación observada durante el periodo. Es una lectura descriptiva del fixture y no establece causa ni efecto: no se atribuye causalidad automática a ${branding.platformDisplayName}, y no hay meta, fórmula ni método de cálculo aprobados.`,
  notaSatisfaccion:
    'La satisfacción se muestra solo agregada. Esta pantalla no muestra comentarios individuales, no califica a personas concretas y no ordena a ningún profesional.',
  procedencia: PROCEDENCIA_A05,
};

/* --------------------------- Reportes ejecutivos -------------------------- */

/** Formatos del diseño aprobado. Son etiquetas visuales, no acciones. */
const FORMATOS_REPORTE: readonly string[] = ['PDF', 'Excel', 'CSV'];

/** Estado único de los informes de la demostración: no disponible. */
const ESTADO_REPORTE_TEXTO = 'Disponible en una fase futura';

/** Fuente de referencia común de los informes. */
const FUENTE_REPORTE = referenciaInstitucional(
  'Estructura de informe prevista',
  'SIN_GENERACION',
);

/** Construye una tarjeta de informe con su estado no disponible. */
function reporteDemo(id: string, titulo: string, descripcion: string): MunicipalityReporte {
  return {
    id,
    titulo,
    descripcion,
    formatos: FORMATOS_REPORTE,
    estado: 'NO_DISPONIBLE_DEMO',
    estadoTexto: ESTADO_REPORTE_TEXTO,
    fuente: FUENTE_REPORTE,
  };
}

export const municipalityReportesDemo: MunicipalityReportesConfig = {
  titulo: 'Reportes ejecutivos',
  descripcion:
    'Estructura de los informes previstos para comités, rendición de cuentas y procesos de gestión.',
  limites: [
    'Esta pantalla muestra la estructura del informe, no un informe producido. No se genera ningún archivo y ninguna acción de la pantalla produce un documento.',
    'La generación real, su auditoría, su publicación y la separación de funciones son decisiones materiales pendientes.',
  ],
  aviso: 'Vista demostrativa · generación no habilitada',
  portadaEtiqueta: 'PORTADA DEL INFORME',
  portadaTitulo: 'Informe de gestión · atención y cuidado · agosto de 2026',
  portadaResumen:
    'Portada demostrativa del informe. Cada valor reproduce un dato ya declarado por otra pantalla y no se recalcula aquí.',
  portada: [
    { id: 'municipio', clave: 'MUNICIPIO', valor: 'Soacha', origenDeclarado: 'Identidad institucional demostrativa' },
    { id: 'periodo', clave: 'PERIODO', valor: 'Agosto de 2026', origenDeclarado: 'Periodo declarado del fixture' },
    {
      id: 'objetivo',
      clave: 'POBLACIÓN OBJETIVO',
      valor: valorPoblacionObjetivo('deduplicada'),
      origenDeclarado: 'Población beneficiaria',
    },
    {
      id: 'beneficiarios',
      clave: 'BENEFICIARIOS',
      valor: valorPoblacionObjetivo('registradas'),
      origenDeclarado: 'Población beneficiaria',
    },
    {
      id: 'presupuesto',
      clave: 'PRESUPUESTO',
      valor: municipalityPresupuestoDemo.resumen.asignado.texto,
      origenDeclarado: 'Presupuesto y ejecución',
    },
    {
      id: 'ejecucion',
      clave: 'EJECUCIÓN',
      valor: municipalityPresupuestoDemo.resumen.porcentajeEjecucionTexto,
      origenDeclarado: 'Presupuesto y ejecución',
    },
    {
      id: 'evidencia',
      clave: 'NIVEL DE EVIDENCIA',
      valor: municipalityEvidenciasConfigDemo.nivel.porcentajeTexto,
      origenDeclarado: 'Evidencias',
    },
    {
      id: 'brechas',
      clave: 'BRECHAS ABIERTAS',
      valor: String(municipalityBrechasDemo.brechas.length),
      origenDeclarado: 'Brechas',
    },
  ],
  catalogoTitulo: 'Informes previstos',
  reportes: [
    reporteDemo(
      'gestion',
      'Informe de gestión',
      'Resumen ejecutivo del periodo con cobertura, atención y evidencia',
    ),
    reporteDemo(
      'poblacion',
      'Informe de población beneficiada',
      'Poblaciones, intersecciones y distribución territorial',
    ),
    reporteDemo(
      'presupuesto',
      'Informe de ejecución presupuestal',
      'Asignado, ejecutado, comprometido y disponible por programa',
    ),
    reporteDemo(
      'evidencias',
      'Informe de evidencias',
      'Actividades, soportes y cobertura documental',
    ),
    reporteDemo(
      'domiciliaria',
      'Informe de atención domiciliaria',
      'Visitas, consultas virtuales y seguimiento',
    ),
    reporteDemo(
      'cuidadores',
      'Informe de cuidadores',
      'Identificación, formación y certificación',
    ),
    reporteDemo(
      'indicadores',
      'Informe de indicadores',
      'Definición, periodos y variación observada',
    ),
    reporteDemo(
      'carpeta-furag',
      'Carpeta de evidencias para FURAG y MIPG',
      'Documentos organizados por política, con estado y responsable',
    ),
    reporteDemo(
      'cuidado',
      'Reporte de seguimiento al derecho al cuidado',
      'Acciones registradas, cobertura alcanzada y pendientes',
    ),
  ],
  formatosEtiqueta: 'Formatos previstos',
  notaFormatos:
    'Los formatos son una referencia visual del diseño aprobado y permanecen inactivos: no producen archivo, no abren nada y no confirman ninguna operación.',
  notaFuentes: `Cuando exista una fuente autorizada, cada indicador del informe conservará su fecha de actualización y su origen: registro propio de ${branding.platformDisplayName}, información del prestador, información de referencia sobre aseguramiento o resultado publicado por la autoridad competente. Hoy ninguna de esas fuentes está conectada.`,
  procedencia: PROCEDENCIA_A05,
};

/**
 * Datos demostrativos de la referencia aprobada. Son ficticios, no persisten y
 * no identifican a ninguna entidad, persona, factura ni fuente real.
 */
export const municipalityDemo: MunicipalityConfig = {
  identidad: {
    plataforma: branding.platformDisplayName,
    entidad: 'Alcaldía de Soacha',
    bajada: 'Gestión territorial y evidencia',
  },
  perfil: {
    iniciales: 'SS',
    nombre: 'Secretaría de Salud',
    perfil: 'Perfil de consulta agregada',
  },
  encabezado: 'PANEL DE GESTIÓN TERRITORIAL, RESULTADOS Y EVIDENCIA',
  avisoPrivacidad:
    'Datos agregados y anonimizados · sin acceso a historias clínicas individuales',
  periodos: MUNICIPALITY_PERIODOS_CONFIG,
  navegacion: MUNICIPALITY_NAV_ITEMS,
  demo: {
    etiqueta: 'Datos demostrativos',
    aclaracion:
      'Todas las cifras, fechas y fuentes de esta pantalla son ficticias y sirven solo para revisar el diseño. No son información oficial ni productiva.',
    notaPeriodo:
      'El periodo cambia solo la selección: las cifras demostrativas permanecen iguales y no se consulta ninguna fuente.',
  },
  inicio: {
    titularesTitulo: 'ASÍ ESTAMOS CUIDANDO NUESTRA POBLACIÓN',
    kpis: [
      {
        id: 'personas',
        valor: '3.050',
        titulo: 'Personas beneficiadas',
        aclaracion: 'Beneficiarios únicos, sin doble conteo',
      },
      {
        id: 'cobertura',
        valor: '37,5 %',
        titulo: 'Cobertura de la población objetivo',
        aclaracion: 'De 8.142 personas, unión deduplicada de las tres poblaciones',
      },
      {
        id: 'visitas',
        valor: '1.284',
        titulo: 'Visitas domiciliarias realizadas',
        aclaracion: 'En lo corrido del año',
      },
      {
        id: 'evidencia',
        valor: '92,8 %',
        titulo: 'Actividades con evidencia',
        aclaracion: '232 de 250 con soporte cargado',
      },
      {
        id: 'presupuesto',
        valor: '55 %',
        titulo: 'Presupuesto ejecutado',
        aclaracion: '$870 M de $1.580 M asignados',
      },
    ],
    cadenaTitulo: 'De la persona a la evidencia',
    cadena: [
      {
        id: 'personas',
        etapa: 'PERSONAS',
        valor: '3.050',
        aclaracion: 'Identificadas y vinculadas',
        tono: 'azul',
      },
      {
        id: 'atencion',
        etapa: 'ATENCIÓN',
        valor: '1.670',
        aclaracion: 'Visitas y consultas realizadas',
        tono: 'teal',
      },
      {
        id: 'dinero',
        etapa: 'DINERO',
        valor: '$870 M',
        aclaracion: 'Ejecutado en el periodo',
        tono: 'teal',
      },
      {
        id: 'evidencia',
        etapa: 'EVIDENCIA',
        valor: '232',
        aclaracion: 'Actividades con soporte',
        tono: 'verde',
      },
      {
        id: 'resultado',
        etapa: 'RESULTADO',
        valor: '94 %',
        aclaracion: 'Alertas atendidas a tiempo',
        tono: 'verde',
      },
      {
        id: 'pendiente',
        etapa: 'PENDIENTE',
        valor: '18',
        aclaracion: 'Soportes por cargar',
        tono: 'amarillo',
      },
    ],
    cadenaAclaracion:
      'Los totales deduplican por persona. Alguien puede aparecer en tres poblaciones y sigue siendo un beneficiario único.',
    pendientesTitulo: 'Alertas y pendientes de gestión',
    pendientes: [
      {
        id: 'facturas',
        texto: '3 facturas pendientes de aprobación',
        nivel: 'Alta',
        tono: 'rojo',
      },
      {
        id: 'evidencias',
        texto: '5 evidencias pendientes de carga',
        nivel: 'Alta',
        tono: 'rojo',
      },
      {
        id: 'discapacidad',
        texto: 'Programa de discapacidad con ejecución por debajo de la meta',
        nivel: 'Seguimiento',
        tono: 'amarillo',
      },
      {
        id: 'seguimiento',
        texto: '27 personas identificadas sin seguimiento reciente',
        nivel: 'Seguimiento',
        tono: 'amarillo',
      },
      {
        id: 'capacitacion',
        texto: '12 cuidadores requieren capacitación',
        nivel: 'Seguimiento',
        tono: 'amarillo',
      },
      {
        id: 'operativos',
        texto: '4 pendientes operativos sin cierre',
        nivel: 'Seguimiento',
        tono: 'amarillo',
      },
    ],
    pendientesAclaracion:
      'Son pendientes administrativos. Las alertas clínicas individuales se gestionan en el hospital.',
    accesosTitulo: 'Accesos rápidos',
    accesos: [
      { id: 'ver-beneficiarios', etiqueta: 'Ver beneficiarios', destino: 'poblacion' },
      { id: 'ver-programas', etiqueta: 'Ver programas', destino: 'programas' },
      { id: 'registrar-programa', etiqueta: 'Registrar programa', destino: 'programas' },
      { id: 'ver-presupuesto', etiqueta: 'Ver presupuesto', destino: 'presupuesto' },
      { id: 'subir-evidencia', etiqueta: 'Subir evidencia', destino: 'evidencias' },
      { id: 'ver-furag', etiqueta: 'Ver FURAG', destino: 'furag' },
      { id: 'ver-adres', etiqueta: 'Ver ADRES', destino: 'adres' },
      { id: 'generar-informe', etiqueta: 'Generar informe', destino: 'reportes' },
    ],
    actividadesTitulo: 'Actividades recientes',
    actividades: [
      {
        id: 'beneficiario',
        texto: 'Nuevo beneficiario registrado en Cazucá',
        cuando: `Hoy 8:20 a. m. · fuente ${branding.platformDisplayName}`,
        tono: 'teal',
      },
      {
        id: 'factura',
        texto: 'Evidencia cargada para la factura FAC-2026-140',
        cuando: 'Ayer 4:10 p. m. · Secretaría de Salud',
        tono: 'verde',
      },
      {
        id: 'meta',
        texto: 'Programa de cuidadores actualizó su meta anual',
        cuando: '15 ago 2026 · Secretaría de Salud',
        tono: 'azul',
      },
      {
        id: 'informe',
        texto: 'Informe de ejecución presupuestal generado',
        cuando: '14 ago 2026 · Hacienda',
        tono: 'azul',
      },
      {
        id: 'furag',
        texto: 'Resultado oficial FURAG 2025 importado',
        cuando: '14 jul 2026 · Función Pública',
        tono: 'azul',
      },
      {
        id: 'certificados',
        texto: '38 certificados de cuidadores cargados',
        cuando: '10 ago 2026 · fuente hospital',
        tono: 'verde',
      },
    ],
  },
  poblacion: municipalityPoblacionDemo,
  territorio: municipalityTerritorioDemo,
  programas: municipalityProgramasConfigDemo,
  presupuesto: municipalityPresupuestoDemo,
  evidencias: municipalityEvidenciasConfigDemo,
  furag: municipalityFuragDemo,
  adres: municipalityAdresDemo,
  cuidado: municipalityCuidadoDemo,
  brechas: municipalityBrechasDemo,
  cuidadores: municipalityCuidadoresDemo,
  indicadores: municipalityIndicadoresDemo,
  reportes: municipalityReportesDemo,
};
