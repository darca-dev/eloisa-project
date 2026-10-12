import { describe, expect, it } from 'vitest';
import { consultarAdministrador, cerrarSesionAdministrador } from './institutionalAdministratorClient';

const context = { experience: 'HOSPITAL', administrator: true, expiresAt: '2026-10-12T18:00:00.000Z', institution: { name: 'Institución de prueba' } };
const responder = (value: unknown, status = 200): typeof fetch => (async () => new Response(JSON.stringify(value), { status })) as typeof fetch;
describe('sesión del primer administrador', () => {
  it('consulta al servidor con cookie, sin caché ni identidad declarada', async () => {
    let request: RequestInit | undefined;
    const result = await consultarAdministrador('hospital', (async (_url, init) => { request = init; return new Response(JSON.stringify(context)); }) as typeof fetch);
    expect(request?.credentials).toBe('include'); expect(request?.cache).toBe('no-store'); expect(request?.body).toBeUndefined();
    expect(result.kind).toBe('ok'); if (result.kind === 'ok') expect(result.datos.administrator).toBe(true);
  });
  it.each([{ ...context, administrator: false }, { ...context, experience: 'MUNICIPALITY' }, { ...context, expiresAt: 'invalid' }, {}, null])('rechaza contexto incompleto o ajeno %j', async value => {
    expect(await consultarAdministrador('hospital', responder(value))).toEqual({ kind: 'error' });
  });
  it('no usa otro acceso cuando el servidor rechaza la sesión', async () => {
    expect(await consultarAdministrador('hospital', responder({}, 401))).toEqual({ kind: 'sin-sesion' });
    expect(await consultarAdministrador('hospital', responder({}, 503))).toEqual({ kind: 'error' });
  });
  it('propaga aborto y no confirma logout si no lo confirmó el servidor', async () => {
    const fail = (async () => { throw new Error('network'); }) as typeof fetch;
    expect(await cerrarSesionAdministrador(fail)).toEqual({ kind: 'error' });
    const controller = new AbortController(); controller.abort();
    expect(await consultarAdministrador('hospital', fail, controller.signal)).toEqual({ kind: 'cancelado' });
  });
});
