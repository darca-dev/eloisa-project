import { describe, expect, it } from 'vitest';
import { isMunicipalSourceUrl, validateMunicipalWrite, type MunicipalEntry } from './municipality-management';
const entry: MunicipalEntry = { id: '00000000-0000-4000-8000-000000000053', title: 'Registro de prueba', period: '2026', provenance: 'INSTITUTIONAL', sourceUrl: '', asOf: '', notes: '', values: { objetivo: 'Objetivo ficticio de prueba' } };
const body = (value = entry) => ({ expectedVersion: 0, payloadSchemaVersion: 1, entries: [value] });
describe('053 — contrato de captura municipal', () => {
  it('distingue apartado vacío de campos requeridos y admite texto administrativo válido', () => {
    expect(validateMunicipalWrite('programas', { ...body(), entries: [] })).toBeNull();
    expect(validateMunicipalWrite('programas', body())).toBeNull();
    expect(validateMunicipalWrite('programas', body({ ...entry, values: {} }))).not.toBeNull();
  });
  it('rechaza campos extras, identidades nominales estructuradas, HTML y tamaños excesivos', () => {
    for (const input of [{ ...body(), tenantId: 'foreign' }, { ...body(), entries: [{ ...entry, patientId: 'foreign' }] }, body({ ...entry, values: { objetivo: 'Prueba', documentoPaciente: '123' } }), body({ ...entry, title: '<script>alert(1)</script>' }), body({ ...entry, notes: 'x'.repeat(2001) })]) expect(validateMunicipalWrite('programas', input)).not.toBeNull();
  });
  it('fuente externa exige dominio oficial exacto o subdominio, HTTPS sin credenciales y corte válido', () => {
    const external = { ...entry, provenance: 'EXTERNAL_TRANSCRIPTION' as const, sourceUrl: 'https://www.funcionpublica.gov.co/resultados', asOf: '2026-10-15', values: { indice: 'Índice de prueba', puntaje: '75.5' } };
    expect(validateMunicipalWrite('furag', body(external))).toBeNull();
    for (const sourceUrl of ['https://funcionpublica.gov.co.attacker.invalid/resultados', 'javascript:alert(1)', 'http://www.funcionpublica.gov.co/', 'https://actor:secret@www.funcionpublica.gov.co/', '']) expect(validateMunicipalWrite('furag', body({ ...external, sourceUrl }))).not.toBeNull();
    expect(validateMunicipalWrite('furag', body({ ...external, asOf: '2026-02-30' }))).not.toBeNull();
    expect(validateMunicipalWrite('furag', body({ ...external, provenance: 'INSTITUTIONAL' }))).not.toBeNull();
    expect(isMunicipalSourceUrl('https://[::1]/')).toBe(false);
  });
  it('conserva montos exactos sin coerción, diferencia vacío y cero, limita puntajes', () => {
    expect(validateMunicipalWrite('presupuesto', body({ ...entry, values: { programa: 'Prueba', asignado: '1000.01', ejecutado: '0' } }))).toBeNull();
    for (const asignado of ['', '-1', '1,000', '1e9', '12.345', 'Infinity']) expect(validateMunicipalWrite('presupuesto', body({ ...entry, values: { programa: 'Prueba', asignado } }))).not.toBeNull();
    expect(validateMunicipalWrite('furag', body({ ...entry, provenance: 'EXTERNAL_TRANSCRIPTION', sourceUrl: 'https://www.funcionpublica.gov.co/', asOf: '2026-10-15', values: { indice: 'Prueba', puntaje: '100.0001' } }))).not.toBeNull();
  });
  it('rechaza revisión insegura, registros repetidos y fechas invertidas sin fabricar datos', () => {
    for (const expectedVersion of [-1, 0.5, Number.MAX_SAFE_INTEGER, '0']) expect(validateMunicipalWrite('programas', { ...body(), expectedVersion })).not.toBeNull();
    expect(validateMunicipalWrite('programas', { ...body(), entries: [entry, entry] })).not.toBeNull();
    expect(validateMunicipalWrite('programas', body({ ...entry, values: { objetivo: 'Prueba', inicio: '2026-10-15', fin: '2026-10-14' } }))).not.toBeNull();
  });
});
