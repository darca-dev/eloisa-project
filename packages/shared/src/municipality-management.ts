/** 053: bounded administrative capture; never canonical patient or official scoring data. */
export interface MunicipalField { readonly key: string; readonly label: string; readonly kind?: 'text' | 'textarea' | 'date' | 'money' | 'integer' | 'score' | 'url' | 'year'; readonly required?: boolean }
export interface MunicipalSection { readonly title: string; readonly description: string; readonly fields: readonly MunicipalField[]; readonly officialOnly?: boolean }
const field = (key: string, label: string, kind: MunicipalField['kind'] = 'text', required = false): MunicipalField => ({ key, label, kind, required });
export const MUNICIPAL_MANAGEMENT_SECTIONS = {
  institucion: { title: 'Identificación institucional', description: 'Información declarada por Alcaldía. No modifica permisos ni el territorio canónico.', fields: [field('entidad', 'Nombre de la entidad', 'text', true), field('departamento', 'Departamento', 'text', true), field('municipio', 'Municipio', 'text', true), field('codigoDivipola', 'Código DANE del municipio (5 dígitos)'), field('vigencia', 'Vigencia', 'year', true)] },
  programas: { title: 'Programas', description: 'Programas propios, objetivos y dependencia responsable.', fields: [field('objetivo', 'Objetivo', 'textarea', true), field('poblacion', 'Población objetivo, sin nombres individuales'), field('dependencia', 'Dependencia responsable'), field('inicio', 'Fecha de inicio', 'date'), field('fin', 'Fecha de finalización', 'date')] },
  presupuesto: { title: 'Presupuesto y ejecución', description: 'Montos declarados en COP. No son un cálculo contable ni una autorización de gasto.', fields: [field('programa', 'Programa o rubro', 'text', true), field('asignado', 'Monto asignado (COP)', 'money', true), field('ejecutado', 'Monto ejecutado declarado (COP)', 'money'), field('referencia', 'Referencia del acto o soporte'), field('dependencia', 'Dependencia responsable')] },
  evidencias: { title: 'Evidencias', description: 'Referencias documentales institucionales; este formulario no carga archivos ni comprueba su autenticidad.', fields: [field('tipo', 'Tipo de soporte', 'text', true), field('referencia', 'Código o referencia del soporte', 'text', true), field('programa', 'Programa o actividad relacionada'), field('soporteUrl', 'Enlace institucional del soporte', 'url'), field('dependencia', 'Dependencia responsable')] },
  furag: { title: 'FURAG y MIPG', description: 'Resultado transcrito de publicación oficial y referencias de gestión. Eloisa no calcula ni certifica puntajes.', officialOnly: true, fields: [field('indice', 'Índice, dimensión o política', 'text', true), field('puntaje', 'Puntaje publicado (0 a 100)', 'score'), field('evidencia', 'Referencia de evidencia institucional'), field('dependencia', 'Dependencia responsable')] },
  adres: { title: 'ADRES', description: 'Información agregada transcrita de una fuente oficial. No incluye afiliaciones individuales.', officialOnly: true, fields: [field('concepto', 'Concepto de la publicación', 'text', true), field('valor', 'Valor publicado, con unidad', 'text', true), field('referencia', 'Referencia de publicación o documento')] },
  cuidado: { title: 'Derecho al cuidado', description: 'Acciones y seguimiento administrativo. Registrar una acción no acredita cumplimiento normativo.', fields: [field('accion', 'Acción institucional', 'textarea', true), field('dependencia', 'Dependencia responsable', 'text', true), field('estado', 'Estado declarado'), field('evidencia', 'Referencia de evidencia')] },
  brechas: { title: 'Brechas de gestión', description: 'Necesidades identificadas por la institución y su acción prevista.', fields: [field('necesidad', 'Necesidad identificada', 'textarea', true), field('accion', 'Acción prevista', 'textarea'), field('dependencia', 'Dependencia responsable'), field('seguimiento', 'Fecha de seguimiento', 'date')] },
  cuidadores: { title: 'Cuidadores y formación', description: 'Actividades y cantidades agregadas. No se registran identidades ni se certifica formación.', fields: [field('formacion', 'Actividad de formación', 'text', true), field('entidad', 'Entidad formadora'), field('participantes', 'Número agregado de participantes', 'integer'), field('estado', 'Estado de la actividad'), field('referencia', 'Referencia del soporte')] },
  indicadores: { title: 'Indicadores y resultados', description: 'Resultados declarados con unidad y metodología. Sin cálculo automático ni calificación oficial.', fields: [field('valor', 'Resultado declarado', 'text', true), field('unidad', 'Unidad', 'text', true), field('metodologia', 'Metodología o fórmula de la fuente', 'textarea', true), field('dependencia', 'Dependencia responsable')] },
  reportes: { title: 'Referencias de informes', description: 'Informes existentes y enlaces a soportes. No se simula generación o exportación.', fields: [field('tipo', 'Tipo de informe', 'text', true), field('referencia', 'Código o referencia', 'text', true), field('informeUrl', 'Enlace institucional del informe', 'url'), field('dependencia', 'Dependencia responsable')] },
} satisfies Record<string, MunicipalSection>;
export type MunicipalSectionId = keyof typeof MUNICIPAL_MANAGEMENT_SECTIONS;
export const isMunicipalSection = (value: string): value is MunicipalSectionId => Object.hasOwn(MUNICIPAL_MANAGEMENT_SECTIONS, value);
export interface MunicipalEntry { readonly id: string; readonly title: string; readonly period: string; readonly provenance: 'INSTITUTIONAL' | 'EXTERNAL_TRANSCRIPTION'; readonly sourceUrl: string; readonly asOf: string; readonly notes: string; readonly values: Readonly<Record<string, string>> }
export interface MunicipalDocument { readonly section: MunicipalSectionId; readonly version: number; readonly payloadSchemaVersion: 1; readonly entries: readonly MunicipalEntry[]; readonly updatedAt: string | null }
export interface MunicipalWrite { readonly expectedVersion: number; readonly payloadSchemaVersion: 1; readonly entries: readonly MunicipalEntry[] }
export const MUNICIPAL_OFFICIAL_SOURCES = [
  { title: 'DANE · certificados de población', url: 'https://sitios.dane.gov.co/certificados-poblacion/', sections: ['institucion', 'indicadores'] },
  { title: 'DANE · proyecciones de población', url: 'https://sitios.dane.gov.co/visor-de-proyecciones-de-poblacion/', sections: ['indicadores'] },
  { title: 'Función Pública · resultados FURAG/MIPG', url: 'https://www.funcionpublica.gov.co/resultados-medici%C3%B3n-del-desempe%C3%B1o-institucional', sections: ['furag'] },
  { title: 'Función Pública · diligenciamiento FURAG', url: 'https://furag.funcionpublica.gov.co/furag', sections: ['furag'] },
  { title: 'ADRES · entidades territoriales', url: 'https://www.adres.gov.co/entidades-territoriales', sections: ['adres'] },
  { title: 'ADRES · resultados LMA por municipio o EPS (requiere acceso habilitado)', url: 'https://www.adres.gov.co/tramites/otras-instituciones/lma-resultados-por-entidad-municipio-o-eps', sections: ['adres'] },
  { title: 'SENA · oferta educativa Betowa', url: 'https://betowa.sena.edu.co/', sections: ['cuidadores'] },
  { title: 'SENA · consulta de certificados', url: 'https://certificados.sena.edu.co/', sections: ['cuidadores'] },
  { title: 'Corte Constitucional · Sentencia T-319/25', url: 'https://www.corteconstitucional.gov.co/relatoria/2025/t-319-25.htm', sections: ['cuidado'] },
] as const;
export const MUNICIPAL_SOURCES_CHECKED_ON = '2026-10-15';
const OFFICIAL_DOMAINS = ['dane.gov.co', 'funcionpublica.gov.co', 'adres.gov.co', 'sena.edu.co', 'corteconstitucional.gov.co'];
export function isMunicipalSourceUrl(value: string, official = false): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username !== '' || url.password !== '' || url.port !== '' || !/^[a-z0-9.-]+\.[a-z]{2,}$/iu.test(url.hostname)) return false;
    return !official || OFFICIAL_DOMAINS.some(domain => url.hostname === domain || url.hostname.endsWith(`.${domain}`));
  } catch { return false; }
}
function validDate(value: string): boolean { return /^\d{4}-\d{2}-\d{2}$/u.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value; }
function cleanText(value: unknown, max: number, required = false): value is string {
  return typeof value === 'string' && value.length <= max && value === value.trim() && (!required || value.length > 0) && !/[<>]/u.test(value) && !Array.from(value).some(character => character.charCodeAt(0) < 32 && ![9, 10, 13].includes(character.charCodeAt(0)));
}
/** Neutral errors contain no submitted values. Same contract on server and browser. */
export function validateMunicipalWrite(section: MunicipalSectionId, input: unknown): string | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return 'Revise los datos del apartado.';
  const body = input as Record<string, unknown>;
  if (Object.keys(body).some(k => !['expectedVersion', 'payloadSchemaVersion', 'entries'].includes(k)) || !Number.isSafeInteger(body.expectedVersion) || (body.expectedVersion as number) < 0 || (body.expectedVersion as number) >= 2147483647 || body.payloadSchemaVersion !== 1 || !Array.isArray(body.entries) || body.entries.length > (section === 'institucion' ? 1 : 50)) return 'Revise la versión y el número de registros.';
  if (new TextEncoder().encode(JSON.stringify(body)).length > 64000) return 'El apartado supera el tamaño permitido.';
  const definition: MunicipalSection = MUNICIPAL_MANAGEMENT_SECTIONS[section];
  const ids = new Set<string>();
  for (const entry of body.entries) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return 'Revise los registros.';
    const row = entry as Record<string, unknown>;
    if (Object.keys(row).length !== 8 || Object.keys(row).some(k => !['id', 'title', 'period', 'provenance', 'sourceUrl', 'asOf', 'notes', 'values'].includes(k))) return 'El registro contiene campos no admitidos.';
    if (!cleanText(row.id, 36, true) || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(row.id) || ids.has(row.id) || !cleanText(row.title, 160, true) || !cleanText(row.period, 80, true) || !cleanText(row.notes, 2000) || !cleanText(row.sourceUrl, 1000) || !cleanText(row.asOf, 10)) return 'Revise título, periodo, fechas y longitudes.';
    ids.add(row.id);
    const external = row.provenance === 'EXTERNAL_TRANSCRIPTION';
    if ((!external && row.provenance !== 'INSTITUTIONAL') || (definition.officialOnly && !external)) return 'Este apartado requiere una transcripción con fuente oficial.';
    if ((row.asOf !== '' && !validDate(row.asOf)) || (external && (!validDate(row.asOf) || !isMunicipalSourceUrl(row.sourceUrl, true))) || (row.sourceUrl !== '' && !isMunicipalSourceUrl(row.sourceUrl))) return 'Indique una URL HTTPS válida y la fecha de corte; las transcripciones requieren dominio oficial.';
    if (!row.values || typeof row.values !== 'object' || Array.isArray(row.values)) return 'Revise los campos del formulario.';
    const values = row.values as Record<string, unknown>;
    if (Object.keys(values).some(k => !definition.fields.some(f => f.key === k))) return 'El formulario contiene campos no admitidos.';
    for (const descriptor of definition.fields) {
      const value = values[descriptor.key] ?? '';
      if (!cleanText(value, descriptor.kind === 'textarea' ? 2000 : descriptor.kind === 'url' ? 1000 : 255, descriptor.required)) return `Revise ${descriptor.label}.`;
      if (value === '') continue;
      if ((descriptor.kind === 'date' && !validDate(value)) || (descriptor.kind === 'year' && !/^(19|20|21)\d{2}$/u.test(value)) || (descriptor.kind === 'money' && !/^(0|[1-9]\d{0,14})(\.\d{1,2})?$/u.test(value)) || (descriptor.kind === 'integer' && !/^(0|[1-9]\d{0,8})$/u.test(value)) || (descriptor.kind === 'score' && (!/^(0|[1-9]\d{0,2})(\.\d{1,4})?$/u.test(value) || Number(value) > 100)) || (descriptor.kind === 'url' && !isMunicipalSourceUrl(value))) return `Revise ${descriptor.label}.`;
    }
    if (section === 'institucion' && values.codigoDivipola && !/^\d{5}$/u.test(values.codigoDivipola as string)) return 'El código DANE debe tener cinco dígitos.';
    if (section === 'programas' && values.inicio && values.fin && String(values.inicio) > String(values.fin)) return 'La finalización no puede ser anterior al inicio.';
  }
  return null;
}
