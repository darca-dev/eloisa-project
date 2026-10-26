import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { MunicipalDocument } from '@merdn/shared';
import { MunicipalityEntries } from './MunicipalityManagedSection';
import { MunicipalitySources } from './MunicipalitySources';
import { municipalManagement } from './municipalityManagementClient';

const document: MunicipalDocument = { section: 'programas', version: 1, payloadSchemaVersion: 1, updatedAt: '2026-10-15T12:00:00Z', entries: [{ id: '00000000-0000-4000-8000-000000000053', title: 'Programa ficticio de prueba', period: '2026', provenance: 'INSTITUTIONAL', sourceUrl: '', asOf: '', notes: 'Nota de prueba', values: { objetivo: 'Objetivo declarado de prueba' } }] };
describe('053 — registros y fuentes municipales', () => {
  it('muestra solo registros guardados y su procedencia; vacío no fabrica cifras', () => {
    const html = renderToStaticMarkup(<MunicipalityEntries document={document} />);
    expect(html).toContain(document.entries[0]!.title); expect(html).toContain('Declaración institucional'); expect(html).toContain('Objetivo declarado de prueba');
    const empty = renderToStaticMarkup(<MunicipalityEntries document={{ ...document, version: 0, updatedAt: null, entries: [] }} />);
    expect(empty).toContain('No hay registros guardados'); expect(empty).not.toContain('<dd>');
  });
  it('enlaza fuentes oficiales reales, sin declarar importación o puntajes', () => {
    const html = renderToStaticMarkup(<MunicipalitySources section="adres" />);
    expect(html).toContain('https://www.adres.gov.co/entidades-territoriales'); expect(html).toContain('lma-resultados-por-entidad-municipio-o-eps');
    expect(html).toContain('Los enlaces no significan que los datos estén importados'); expect(html).toContain('noopener noreferrer');
    expect(html).not.toContain('778.412'); expect(html).not.toContain('396.204');
  });
  it('cliente escribe exclusivamente el documento versionado y usa cookies/no-store', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(document), { status: 200 }));
    const input = { expectedVersion: 0, payloadSchemaVersion: 1 as const, entries: document.entries };
    const result = await municipalManagement('programas', input, undefined, fetchImpl);
    expect(result.kind).toBe('ok'); const [url, options] = fetchImpl.mock.calls[0]!;
    expect(String(url)).toContain('/api/v1/municipality/management/programas'); expect(options).toMatchObject({ method: 'PUT', cache: 'no-store', credentials: 'include' }); expect(JSON.parse(String(options?.body))).toEqual(input);
  });
  it('denegación/conflicto/error y respuesta de otro apartado nunca se convierten en datos vacíos', async () => {
    for (const [status, kind] of [[401,'unauthorized'],[403,'forbidden'],[409,'conflict'],[503,'error']] as const) expect((await municipalManagement('programas', undefined, undefined, vi.fn<typeof fetch>().mockResolvedValue(new Response('{}', { status })))).kind).toBe(kind);
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ ...document, section: 'indicadores' }), { status: 200 }));
    expect((await municipalManagement('programas', undefined, undefined, fetchImpl)).kind).toBe('error');
  });
  it('PE-04: respuesta con valores null o no textuales es error y no llega al editor', async () => {
    const row = document.entries[0]!;
    for (const entries of [[{ ...row, values: { ...row.values, poblacion: null } }], [{ ...row, values: { objetivo: 7 } }], [{ ...row, notes: null }]]) {
      const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ ...document, entries }), { status: 200 }));
      const result = await municipalManagement('programas', undefined, undefined, fetchImpl);
      expect(result.kind).toBe('error'); expect(result).not.toHaveProperty('document');
    }
  });
  it('PE-04: guardado válido, lectura y edición posterior conservan la versión', async () => {
    const edited: MunicipalDocument = { ...document, version: 2, entries: [{ ...document.entries[0]!, values: { objetivo: 'Objetivo editado de prueba', poblacion: '' } }] };
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(JSON.stringify(document), { status: 200 })).mockResolvedValueOnce(new Response(JSON.stringify(document), { status: 200 })).mockResolvedValueOnce(new Response(JSON.stringify(edited), { status: 200 }));
    expect(await municipalManagement('programas', { expectedVersion: 0, payloadSchemaVersion: 1, entries: document.entries }, undefined, fetchImpl)).toEqual({ kind: 'ok', document });
    const read = await municipalManagement('programas', undefined, undefined, fetchImpl);
    if (read.kind !== 'ok') throw new Error('lectura esperada');
    const input = { expectedVersion: read.document.version, payloadSchemaVersion: 1 as const, entries: edited.entries };
    expect(await municipalManagement('programas', input, undefined, fetchImpl)).toEqual({ kind: 'ok', document: edited });
    expect(JSON.parse(String(fetchImpl.mock.calls[2]![1]?.body))).toEqual({ ...input, expectedVersion: 1 });
  });
});
