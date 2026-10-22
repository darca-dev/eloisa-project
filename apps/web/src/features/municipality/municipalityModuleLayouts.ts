import { branding } from '@/config/branding';

import type { MunicipalityModuloId } from './municipalityViews';

export type MunicipalityPendingModule = Exclude<MunicipalityModuloId, 'inicio' | 'poblacion' | 'territorio'>;
interface ModuleSection {
  readonly title: string;
  readonly description: string;
  readonly columns?: readonly string[];
  readonly items?: readonly string[];
  readonly steps?: readonly string[];
}
interface ModuleLayout {
  readonly title: string;
  readonly description: string;
  readonly metrics?: readonly string[];
  readonly notice?: string;
  readonly sections: readonly ModuleSection[];
}

/** Visual structure from Eligeme-Alcaldia; labels only, never records or statistics. */
export const MUNICIPALITY_MODULE_LAYOUTS: Readonly<Record<MunicipalityPendingModule, ModuleLayout>> = {
  programas: {
    title: 'Programas', description: 'Programas municipales, poblaciones beneficiarias, ejecución y evidencia.',
    sections: [{ title: 'Programas municipales', description: 'La consulta de programas aún no está habilitada. No hay programas consultados que presentar.' },
      { title: 'Seguimiento de cada programa', description: 'Estos son los ámbitos previstos para el seguimiento; sus datos todavía no pueden consultarse.', items: ['Poblaciones beneficiarias', 'Entidades responsables y ejecutoras', 'Ejecución presupuestal', 'Metas y resultados', 'Soportes documentales', 'Cierre del programa'] }],
  },
  presupuesto: {
    title: 'Presupuesto y ejecución', description: 'De la asignación al soporte documental, con seguimiento por población.',
    metrics: ['Asignado', 'Ejecutado', 'Comprometido', 'Disponible', 'Costo promedio por beneficiario'],
    sections: [{ title: 'Ejecución total del periodo', description: 'La ejecución y sus porcentajes requieren movimientos presupuestales consultables. Todavía no están disponibles.' },
      { title: 'Por población', description: 'Distribución presupuestal agregada. La consulta aún no está habilitada.', columns: ['Población', 'Asignado', 'Ejecutado', 'Comprometido', 'Disponible'] }],
  },
  evidencias: {
    title: 'Evidencias de ejecución', description: 'Trazabilidad entre presupuesto, actividad, beneficiarios y soportes institucionales.',
    metrics: ['Actividades', 'Con soporte documental', 'Soportes pendientes', 'Cobertura documental'],
    sections: [{ title: 'Facturas y soportes', description: 'La consulta documental aún no está habilitada; no se ha consultado ningún soporte.', columns: ['Documento', 'Programa', 'Entidad', 'Valor', 'Estado'] },
      { title: 'Presupuesto, actividad, beneficiario y resultado', description: 'Cadena de trazabilidad prevista; no acredita una ejecución o evidencia registrada.', steps: ['Presupuesto', 'Actividad', 'Beneficiarios', 'Soporte', 'Resultado'] }],
  },
  furag: {
    title: 'FURAG y MIPG', description: 'Resultados oficiales y organización de evidencias para la gestión institucional.',
    notice: 'No hay una consulta oficial FURAG conectada. La organización de evidencias no equivale a una calificación oficial ni acredita cumplimiento.',
    sections: [{ title: 'Resultado oficial FURAG', description: 'Se requiere un resultado oficial con fuente, vigencia y fecha de actualización.' },
      { title: 'Mapa de evidencias por política de MIPG', description: 'La consulta de políticas y soportes institucionales aún no está habilitada.', columns: ['Política', 'Evidencia', 'Responsable institucional', 'Estado'] }],
  },
  adres: {
    title: 'ADRES', description: 'Información oficial y contraste agregado con los registros municipales.',
    notice: 'No hay una fuente ADRES conectada. No se presentan afiliaciones, recursos o coincidencias como verificados.',
    sections: [{ title: 'Información oficial disponible', description: 'La información debe provenir de una fuente autorizada, con fecha de corte y trazabilidad.' },
      { title: `Población en ${branding.platformDisplayName} frente a la información oficial`, description: 'El contraste agregado aún no está disponible.', columns: ['Dato agregado', 'Registro en plataforma', 'Fuente oficial', 'Fecha de corte'] }],
  },
  cuidado: {
    title: 'Seguimiento al derecho al cuidado', description: 'Acciones, evidencia y seguimiento institucional de la atención y el cuidado.',
    notice: 'Esta sección no acredita cumplimiento normativo. El seguimiento requiere acciones y soportes consultables.',
    sections: [{ title: 'Acciones registradas', description: 'La consulta de acciones aún no está habilitada. No se afirma ausencia de acciones.' },
      { title: 'Matriz de seguimiento', description: 'Seguimiento administrativo agregado, sin historias clínicas individuales.', columns: ['Componente', 'Acción', 'Evidencia', 'Responsable institucional', 'Estado'] }],
  },
  brechas: {
    title: '¿Qué nos falta atender?', description: 'Lectura agregada de necesidades de cobertura, ejecución, evidencia y seguimiento.',
    sections: [{ title: 'Brechas de gestión', description: 'Ámbitos previstos para la consulta. Todavía no hay una consulta habilitada que permita afirmar una brecha.', items: ['Cobertura poblacional', 'Continuidad de la atención', 'Ejecución presupuestal', 'Soportes documentales', 'Formación de cuidadores', 'Cierres operativos'] }],
  },
  cuidadores: {
    title: 'Cuidadores y formación', description: 'Identificación agregada de cuidadores y seguimiento de la ruta de formación.',
    sections: [{ title: 'Cuidadores identificados', description: 'La consulta agregada aún no está habilitada. No se muestran identidades ni vínculos individuales.' },
      { title: 'Ruta de formación', description: 'Etapas previstas para el seguimiento. No se afirma matrícula, evaluación o certificación.', steps: ['Identificación', 'Formación', 'Evaluación', 'Certificación'] }],
  },
  indicadores: {
    title: 'Indicadores y resultados', description: 'Metas, resultados y comparación de periodos con fuente y fórmula verificables.',
    notice: 'No se calculan indicadores sin fuente, fórmula y periodo definidos. La consulta comparativa aún no está habilitada.',
    sections: [{ title: 'Comparación de periodos', description: 'Las comparaciones requieren resultados publicados para ambos periodos.', columns: ['Indicador', 'Periodo anterior', 'Periodo actual', 'Variación'] },
      { title: 'Satisfacción agregada', description: 'La consulta de resultados de satisfacción aún no está habilitada.' }],
  },
  reportes: {
    title: 'Reportes ejecutivos', description: 'Tipos de informe previstos para la gestión municipal, con fuentes y fechas de actualización.',
    sections: [{ title: 'Informes municipales', description: 'La generación y descarga de estos informes aún no está disponible.', items: ['Informe de gestión', 'Informe de población beneficiada', 'Informe de ejecución presupuestal', 'Informe de evidencias', 'Informe de atención domiciliaria', 'Informe de cuidadores', 'Informe de indicadores', 'Carpeta de evidencias para FURAG y MIPG', 'Reporte de seguimiento al derecho al cuidado'] }],
  },
};
