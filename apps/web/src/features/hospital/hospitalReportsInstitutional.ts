import { branding } from '@/config/branding';

import { formatearNumero } from './hospitalPopulationAnalytics';
import { normalizarFiltros } from './hospitalReportsConfig';
import { OPERACION_PERIODO_INICIAL } from './hospitalReportsOperationalFixtures';
import {
  EVIDENCIA_ESTADOS,
  INSTITUCIONAL_VERSION_DEFINICION,
  type EvidenciaEstadoId,
  type EvidenciaRegistro,
  type InstitutionalEvidenceSnapshotV1,
  type MarcoEspacio,
  type MarcoRegistro,
  type ReporteColumna,
  type ReporteFiltros,
  type ReportePunto,
} from './hospitalReportsTypes';

/**
 * Evidencias y espacios institucionales de Reportes, versionados
 * `institutional-v1` (TASK-003H-07, §3.7 y §4).
 *
 * Reúne el registro demostrativo de evidencias y los cinco espacios del bloque
 * institucional: gestión, FURAG/MIPG, ADRES, SENA y Sentencia T-319 de 2025.
 *
 * Delimitación de oficialidad, vinculante y siempre visible:
 * - la plataforma ORGANIZA información y evidencias; no asigna puntajes
 *   oficiales, no evalúa desempeño institucional y no certifica cumplimiento;
 * - ADRES administra recursos e información del sistema de salud y NO es el
 *   regulador de la plataforma; aquí no hay conexión, consulta ni dato suyo;
 * - la formación registrada con el SENA no prueba competencia ni cumplimiento
 *   integral;
 * - la trazabilidad frente a la Sentencia T-319 de 2025 no certifica
 *   cumplimiento judicial.
 *
 * Función Pública figura como fuente ÚNICAMENTE en los registros que la
 * declaran expresamente, y siempre dentro del rótulo demostrativo del fixture.
 *
 * Este slice nunca expone el documento real de una evidencia: solo su estado y
 * sus metadatos. No hay carga, descarga, validación ni firma.
 */

/* ========================================================================== */
/* Procedencias                                                               */
/* ========================================================================== */

const PLATAFORMA = branding.platformDisplayName;

const PROC_INSTITUCIONAL = 'Registro institucional demostrativo';
const PROC_PLATAFORMA = `Registro demostrativo en ${PLATAFORMA}`;
const PROC_FUNCION_PUBLICA = 'Declarado por el responsable como marco de Función Pública (demostrativo)';
const PROC_FORMACION = 'Registro demostrativo de formación declarada';

/** Marca de composición del snapshot institucional. */
export const INSTITUCIONAL_CALCULATED_AT = '2026-08-20T06:00:00-05:00';

/* ========================================================================== */
/* Evidencias                                                                 */
/* ========================================================================== */

/** Columnas del bloque principal de evidencias (§3.7). */
export const EVIDENCIA_COLUMNAS: readonly ReporteColumna[] = [
  { id: 'indicador', etiqueta: 'Indicador o movimiento' },
  { id: 'evidencia', etiqueta: 'Evidencia' },
  { id: 'tipo', etiqueta: 'Tipo' },
  { id: 'fecha', etiqueta: 'Fecha' },
  { id: 'responsable', etiqueta: 'Responsable' },
  { id: 'procedencia', etiqueta: 'Procedencia' },
  { id: 'estado', etiqueta: 'Estado' },
];

/** Construye un registro de evidencia con sus metadatos, sin documento. */
function evidencia(
  id: string,
  indicador: string,
  nombre: string,
  tipo: string,
  fecha: string,
  responsable: string,
  procedencia: string,
  estado: EvidenciaEstadoId,
  marco: EvidenciaRegistro['marco'],
  programa: string,
  municipio: string,
  periodo: string = OPERACION_PERIODO_INICIAL,
): EvidenciaRegistro {
  return {
    id,
    indicador,
    evidencia: nombre,
    tipo,
    fecha,
    responsable,
    procedencia,
    estado,
    marco,
    periodo,
    programa,
    municipio,
    metadatos: [
      { etiqueta: 'Referencia', valor: `Referencia opaca ${id}` },
      { etiqueta: 'Versión', valor: 'v1' },
      { etiqueta: 'Marco', valor: marco },
      { etiqueta: 'Periodo', valor: periodo },
      { etiqueta: 'Programa', valor: programa },
      { etiqueta: 'Territorio', valor: municipio },
      { etiqueta: 'Procedencia', valor: procedencia },
      { etiqueta: 'Estado documental', valor: estado },
      {
        etiqueta: 'Contenido',
        valor: 'El documento no se muestra en esta pantalla. Solo se consultan sus metadatos.',
      },
    ],
  };
}

/** Registro demostrativo de evidencias del escenario institucional. */
export const EVIDENCIAS_DEMO: readonly EvidenciaRegistro[] = [
  evidencia('ev-001', 'Cobertura de atención domiciliaria', 'Acta de comité de programa', 'Acta', '12 ago 2026', 'Coordinación de programa', PROC_INSTITUCIONAL, 'Validada', 'Gestión', 'Atención domiciliaria', 'Soacha'),
  evidencia('ev-002', 'Seguimiento a población priorizada', 'Informe de seguimiento del periodo', 'Informe', '10 ago 2026', 'Equipo de seguimiento', PROC_PLATAFORMA, 'Completa', 'Gestión', 'Crónicos', 'Soacha'),
  evidencia('ev-003', 'Ejecución del convenio municipal', 'Soporte de ejecución del convenio', 'Soporte', '08 ago 2026', 'Enlace institucional', PROC_INSTITUCIONAL, 'Pendiente', 'Gestión', 'Atención domiciliaria', 'Sibaté'),
  evidencia('ev-004', 'Rehabilitación funcional en zona rural', 'Registro de sesiones agregado', 'Registro', '06 ago 2026', 'Coordinación de programa', PROC_PLATAFORMA, 'Requiere corrección', 'Gestión', 'Rehabilitación funcional', 'Granada'),
  evidencia('ev-005', 'Política de gestión documental', 'Procedimiento documentado', 'Procedimiento', '04 ago 2026', 'Planeación institucional', PROC_FUNCION_PUBLICA, 'Completa', 'FURAG / MIPG', 'Atención domiciliaria', 'Soacha'),
  evidencia('ev-006', 'Participación ciudadana en la gestión', 'Evidencia de espacio de participación', 'Acta', '01 ago 2026', 'Planeación institucional', PROC_FUNCION_PUBLICA, 'Pendiente', 'FURAG / MIPG', 'Convenio municipal', 'Soacha'),
  evidencia('ev-007', 'Gestión del talento humano', 'Plan de bienestar del periodo', 'Plan', '28 jul 2026', 'Talento humano', PROC_INSTITUCIONAL, 'Validada', 'FURAG / MIPG', 'Atención domiciliaria', 'Soacha', 'Julio 2026'),
  evidencia('ev-008', 'Recursos del sistema de salud asignados al programa', 'Soporte de asignación de recursos', 'Soporte', '30 jul 2026', 'Área financiera', PROC_INSTITUCIONAL, 'Completa', 'ADRES', 'Convenio municipal', 'Soacha', 'Julio 2026'),
  evidencia('ev-009', 'Conciliación interna de recursos del periodo', 'Acta de conciliación interna', 'Acta', '05 ago 2026', 'Área financiera', PROC_INSTITUCIONAL, 'Pendiente', 'ADRES', 'Convenio municipal', 'Soacha'),
  evidencia('ev-010', 'Formación de cuidadores', 'Constancia de formación declarada', 'Constancia', '07 ago 2026', 'Formación y desarrollo', PROC_FORMACION, 'Completa', 'SENA', 'Crónicos', 'Soacha'),
  evidencia('ev-011', 'Verificación de constancias declaradas', 'Listado agregado de verificación', 'Registro', '09 ago 2026', 'Formación y desarrollo', PROC_FORMACION, 'Requiere corrección', 'SENA', 'Crónicos', 'Sibaté'),
  evidencia('ev-012', 'Ruta de atención para personas con discapacidad', 'Documento de ruta institucional', 'Documento', '11 ago 2026', 'Enlace institucional', PROC_INSTITUCIONAL, 'Validada', 'Sentencia T-319 de 2025', 'Cuidado paliativo', 'Soacha'),
  evidencia('ev-013', 'Seguimiento de acciones institucionales', 'Reporte de seguimiento agregado', 'Informe', '13 ago 2026', 'Enlace institucional', PROC_PLATAFORMA, 'Pendiente', 'Sentencia T-319 de 2025', 'Cuidado paliativo', 'Silvania'),
  evidencia('ev-014', 'Accesibilidad de los canales de atención', 'Diagnóstico interno de accesibilidad', 'Informe', '02 ago 2026', 'Planeación institucional', PROC_INSTITUCIONAL, 'Requiere corrección', 'Sentencia T-319 de 2025', 'Salud mental comunitaria', 'Soacha'),
  evidencia('ev-015', 'Cobertura de telesalud del periodo', 'Reporte agregado de telesalud', 'Informe', '14 ago 2026', 'Coordinación de programa', PROC_PLATAFORMA, 'Completa', 'Gestión', 'Crónicos', 'Soacha'),
];

/* ========================================================================== */
/* Espacios institucionales                                                   */
/* ========================================================================== */

/** Columnas comunes de los cuatro espacios de marco (§3.7). */
const MARCO_COLUMNAS: readonly ReporteColumna[] = [
  { id: 'tema', etiqueta: 'Tema o requisito' },
  { id: 'requisito', etiqueta: 'Qué se organiza' },
  { id: 'periodo', etiqueta: 'Periodo' },
  { id: 'evidencia', etiqueta: 'Evidencia' },
  { id: 'responsable', etiqueta: 'Responsable' },
  { id: 'brecha', etiqueta: 'Brecha declarada' },
  { id: 'procedencia', etiqueta: 'Procedencia' },
  { id: 'estado', etiqueta: 'Estado' },
];

function registro(
  id: string,
  tema: string,
  requisito: string,
  periodo: string,
  evidenciaNombre: string,
  responsable: string,
  brecha: string,
  procedencia: string,
  estado: EvidenciaEstadoId,
): MarcoRegistro {
  return { id, tema, requisito, periodo, evidencia: evidenciaNombre, responsable, brecha, procedencia, estado };
}

/** Texto de delimitación de FURAG/MIPG, obligatorio y siempre visible. */
export const LIMITE_FURAG = `${PLATAFORMA} organiza información y evidencias; no asigna puntajes oficiales ni certifica cumplimiento.`;

/** Texto de delimitación de ADRES, obligatorio y siempre visible. */
export const LIMITE_ADRES = `ADRES administra recursos e información del sistema de salud; no es el regulador de ${PLATAFORMA}. Esta pantalla no consulta ADRES, no tiene conexión con ADRES y no muestra ningún dato suyo.`;

/** Texto de delimitación del espacio SENA. */
export const LIMITE_SENA =
  'Formación y evidencia declaradas o verificadas por el responsable autorizado. El registro no prueba competencia profesional ni cumplimiento integral de ninguna obligación.';

/** Texto de delimitación del espacio de la Sentencia T-319 de 2025. */
export const LIMITE_T319 =
  'La trazabilidad no certifica cumplimiento judicial. La interpretación del requisito corresponde al responsable autorizado y queda registrada como tal.';

/** Texto de delimitación del espacio de gestión y evidencias. */
export const LIMITE_GESTION =
  'Estado documental de la evidencia. Esta pantalla no muestra el documento, no lo valida y no acredita por sí sola ninguna obligación institucional.';

/** Los cinco espacios institucionales, en el orden vinculante (§3.7). */
export const ESPACIOS_INSTITUCIONALES: readonly MarcoEspacio[] = [
  {
    id: 'gestion',
    marco: 'Gestión',
    titulo: 'Gestión y evidencias',
    descripcion:
      'Evidencias de la gestión de programas del contexto institucional, con su estado documental y su procedencia.',
    limite: LIMITE_GESTION,
    columnas: MARCO_COLUMNAS,
    registros: [
      registro('ge-001', 'Comité de programa', 'Acta del comité del periodo', OPERACION_PERIODO_INICIAL, 'Acta de comité de programa', 'Coordinación de programa', 'Sin brecha declarada', PROC_INSTITUCIONAL, 'Validada'),
      registro('ge-002', 'Seguimiento del periodo', 'Informe de seguimiento agregado', OPERACION_PERIODO_INICIAL, 'Informe de seguimiento del periodo', 'Equipo de seguimiento', 'Sin brecha declarada', PROC_PLATAFORMA, 'Completa'),
      registro('ge-003', 'Convenio municipal', 'Soporte de ejecución del convenio', OPERACION_PERIODO_INICIAL, 'Soporte de ejecución del convenio', 'Enlace institucional', 'Falta el soporte del último desembolso', PROC_INSTITUCIONAL, 'Pendiente'),
      registro('ge-004', 'Zona rural', 'Registro agregado de sesiones', OPERACION_PERIODO_INICIAL, 'Registro de sesiones agregado', 'Coordinación de programa', 'El registro requiere corrección de fechas', PROC_PLATAFORMA, 'Requiere corrección'),
    ],
    vacio: 'Sin evidencias de gestión para los filtros aplicados.',
  },
  {
    id: 'furag',
    marco: 'FURAG / MIPG',
    titulo: 'FURAG / MIPG',
    descripcion:
      'Espacio para organizar marco, tema o requisito, periodo, evidencia, responsable y brecha declarada. Es un espacio de organización interna, no un formulario oficial ni un resultado de medición.',
    limite: LIMITE_FURAG,
    columnas: MARCO_COLUMNAS,
    registros: [
      registro('fu-001', 'Gestión documental', 'Procedimiento documentado y su vigencia', OPERACION_PERIODO_INICIAL, 'Procedimiento documentado', 'Planeación institucional', 'Sin brecha declarada', PROC_FUNCION_PUBLICA, 'Completa'),
      registro('fu-002', 'Participación ciudadana', 'Evidencia del espacio de participación', OPERACION_PERIODO_INICIAL, 'Evidencia de espacio de participación', 'Planeación institucional', 'Falta el listado agregado de asistentes', PROC_FUNCION_PUBLICA, 'Pendiente'),
      registro('fu-003', 'Talento humano', 'Plan de bienestar del periodo', 'Julio 2026', 'Plan de bienestar del periodo', 'Talento humano', 'Sin brecha declarada', PROC_INSTITUCIONAL, 'Validada'),
      registro('fu-004', 'Control interno', 'Autodiagnóstico interno del área', 'Julio 2026', 'Autodiagnóstico interno', 'Control interno', 'Pendiente de revisión por el responsable', PROC_INSTITUCIONAL, 'Pendiente'),
    ],
    vacio: 'Sin registros organizados en este espacio para los filtros aplicados.',
  },
  {
    id: 'adres',
    marco: 'ADRES',
    titulo: 'ADRES',
    descripcion:
      'Espacio para organizar recursos, periodos y evidencias autorizados por el responsable del contexto institucional.',
    limite: LIMITE_ADRES,
    columnas: MARCO_COLUMNAS,
    registros: [
      registro('ad-001', 'Recursos asignados al programa', 'Soporte de asignación autorizado', 'Julio 2026', 'Soporte de asignación de recursos', 'Área financiera', 'Sin brecha declarada', PROC_INSTITUCIONAL, 'Completa'),
      registro('ad-002', 'Conciliación interna del periodo', 'Acta de conciliación interna', OPERACION_PERIODO_INICIAL, 'Acta de conciliación interna', 'Área financiera', 'Falta el acta firmada del periodo', PROC_INSTITUCIONAL, 'Pendiente'),
    ],
    vacio: 'Sin registros organizados en este espacio para los filtros aplicados.',
  },
  {
    id: 'sena',
    marco: 'SENA',
    titulo: 'SENA',
    descripcion:
      'Espacio para organizar formación y evidencia de cuidadores, con el estado declarado o verificado por el responsable autorizado.',
    limite: LIMITE_SENA,
    columnas: MARCO_COLUMNAS,
    registros: [
      registro('se-001', 'Formación de cuidadores', 'Constancia declarada por el responsable', OPERACION_PERIODO_INICIAL, 'Constancia de formación declarada', 'Formación y desarrollo', 'Sin brecha declarada', PROC_FORMACION, 'Completa'),
      registro('se-002', 'Verificación de constancias', 'Listado agregado de verificación', OPERACION_PERIODO_INICIAL, 'Listado agregado de verificación', 'Formación y desarrollo', 'Dos constancias requieren corrección de datos', PROC_FORMACION, 'Requiere corrección'),
    ],
    vacio: 'Sin registros organizados en este espacio para los filtros aplicados.',
  },
  {
    id: 't319',
    marco: 'Sentencia T-319 de 2025',
    titulo: 'Sentencia T-319 de 2025',
    descripcion:
      'Espacio para organizar norma o requisito institucional interpretado por el responsable autorizado, acción, evidencia y seguimiento o brecha.',
    limite: LIMITE_T319,
    columnas: MARCO_COLUMNAS,
    registros: [
      registro('t3-001', 'Ruta de atención', 'Documento de ruta institucional interpretado por el responsable', OPERACION_PERIODO_INICIAL, 'Documento de ruta institucional', 'Enlace institucional', 'Sin brecha declarada', PROC_INSTITUCIONAL, 'Validada'),
      registro('t3-002', 'Seguimiento de acciones', 'Reporte agregado de seguimiento', OPERACION_PERIODO_INICIAL, 'Reporte de seguimiento agregado', 'Enlace institucional', 'Falta el corte del último mes', PROC_PLATAFORMA, 'Pendiente'),
      registro('t3-003', 'Accesibilidad de canales', 'Diagnóstico interno de accesibilidad', OPERACION_PERIODO_INICIAL, 'Diagnóstico interno de accesibilidad', 'Planeación institucional', 'El diagnóstico requiere corrección de alcance', PROC_INSTITUCIONAL, 'Requiere corrección'),
    ],
    vacio: 'Sin registros organizados en este espacio para los filtros aplicados.',
  },
];

/* ========================================================================== */
/* Snapshot                                                                   */
/* ========================================================================== */

/** Evidencias recortadas por periodo, programa y territorio. */
export function filtrarEvidencias(
  evidencias: readonly EvidenciaRegistro[],
  filtros: ReporteFiltros,
): readonly EvidenciaRegistro[] {
  const { periodo, programa, municipio } = normalizarFiltros(filtros);

  return evidencias.filter((registroEvidencia) => {
    if (registroEvidencia.periodo !== periodo) {
      return false;
    }
    if (programa !== null && registroEvidencia.programa !== programa) {
      return false;
    }

    return municipio === null || registroEvidencia.municipio === municipio;
  });
}

/** Conteo por cada uno de los cuatro estados; ninguno se omite. */
export function conteoPorEstado(
  evidencias: readonly EvidenciaRegistro[],
): readonly ReportePunto[] {
  return EVIDENCIA_ESTADOS.map((estado) => {
    const valor = evidencias.filter((item) => item.estado === estado).length;

    return {
      id: `evidencia-${estado}`,
      etiqueta: estado,
      valor,
      texto: `${formatearNumero(valor)} evidencias`,
    };
  });
}

/** Espacios recortados por periodo y programa declarados en cada registro. */
function espaciosFiltrados(filtros: ReporteFiltros): readonly MarcoEspacio[] {
  const { periodo } = normalizarFiltros(filtros);

  return ESPACIOS_INSTITUCIONALES.map((espacio) => ({
    ...espacio,
    registros: espacio.registros.filter((item) => item.periodo === periodo),
  }));
}

/** `InstitutionalEvidenceSnapshotV1` (§4). */
export function snapshotInstitucional(
  filtros: ReporteFiltros,
  evidencias: readonly EvidenciaRegistro[] = EVIDENCIAS_DEMO,
): InstitutionalEvidenceSnapshotV1 {
  const normalizados = normalizarFiltros(filtros);
  const filtradas = filtrarEvidencias(evidencias, filtros);

  return {
    version: INSTITUCIONAL_VERSION_DEFINICION,
    periodo: normalizados.periodo,
    filtros: normalizados,
    evidencias: filtradas,
    conteoPorEstado: conteoPorEstado(filtradas),
    espacios: espaciosFiltrados(filtros),
    procedencia: 'Registro institucional y documental demostrativo',
    calculatedAt: INSTITUCIONAL_CALCULATED_AT,
    limitaciones:
      'Registros demostrativos de organización interna. No proceden de ninguna fuente oficial, no acreditan cumplimiento y no sustituyen ningún trámite ante ninguna entidad.',
  };
}
