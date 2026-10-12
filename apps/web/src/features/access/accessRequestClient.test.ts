/**
 * Pruebas focales del cliente de solicitudes de acceso (SPEC 038, MP02-C2).
 *
 * Se prueba la FRONTERA, no la red: `fetch` se inyecta, de modo que estas
 * pruebas no abren socket, no dependen de la API, no necesitan base de datos y
 * no requieren `.env`. La respuesta se fabrica a mano porque el punto crítico
 * es precisamente qué hace el cliente con una respuesta que NO es la esperada:
 * un `200` de un proxy, un `202` con campos de más, un cuerpo que no es JSON.
 */

import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { resolvePublicApiBaseUrl } from '@/config/environment';

import {
  ACCESS_REQUEST_PASSWORD_MAX_LENGTH,
  ACCESS_REQUEST_PASSWORD_MIN_LENGTH,
  accessRequestPasswordProblem,
  submitAccessRequest,
  type AccessRequestWithCredential,
} from './accessRequestClient';

const RUTA = '/api/v1/access-requests';

const CUERPO: AccessRequestWithCredential = {
  requestedProfile: 'PATIENT',
  documentType: 'CEDULA_CIUDADANIA',
  documentNumber: '900000001',
  givenNames: 'Ana María',
  familyNames: 'Ejemplo Ficticio',
  birthDate: '1958-04-12',
  sexGenderCode: 'FEMENINO',
  password: 'claveFicticia7',
  phone: '311 220 3355',
  registration: { necesitaApoyo: 'SI' },
};

const RESPUESTA_202 = {
  reference: 'AR-3F9C1D0B7A6E5248C1B0D2E9',
  status: 'PENDING',
  source: 'TEST_DATA',
};

interface Llamada {
  readonly url: string;
  readonly init: RequestInit;
}

function fetchQueDevuelve(
  status: number,
  body: unknown,
  registro?: Llamada[],
): typeof fetch {
  return (async (url: string, init: RequestInit) => {
    registro?.push({ url: String(url), init });

    if (String(url).endsWith('/registration-attempt')) return { status: 204 } as Response;

    return {
      status,
      json: async () => body,
    } as Response;
  }) as unknown as typeof fetch;
}

function fetchQueFalla(registro?: Llamada[]): typeof fetch {
  return (async (url: string, init: RequestInit) => {
    registro?.push({ url: String(url), init });
    throw new Error('red no disponible');
  }) as unknown as typeof fetch;
}

describe('cliente de POST /api/v1/access-requests', () => {
  it('presenta conflictos sin copiar detalles ni referencias ajenas', async () => {
    expect(await submitAccessRequest(CUERPO, fetchQueDevuelve(409, { reference: RESPUESTA_202.reference })))
      .toEqual({ kind: 'conflict' });
  });

  it.each(['PENDING', 'APPROVED_PENDING_PROVISIONING', 'PROVISIONING_FAILED'])('recupera referencia propia en %s', async status => {
    expect(await submitAccessRequest(CUERPO, fetchQueDevuelve(202, { ...RESPUESTA_202, source: 'SELF_REGISTRATION', status })))
      .toEqual({ kind: 'accepted', accepted: { ...RESPUESTA_202, source: 'SELF_REGISTRATION', status } });
  });
  it('llama exactamente a la ruta pública de solicitudes de acceso', async () => {
    const llamadas: Llamada[] = [];
    await submitAccessRequest(CUERPO, fetchQueDevuelve(202, RESPUESTA_202, llamadas));

    expect(llamadas).toHaveLength(2);
    expect(llamadas[0]?.url).toBe(`${resolvePublicApiBaseUrl()}${RUTA}/registration-attempt`);
    expect(llamadas[0]?.init.body).toBeUndefined();
    expect(llamadas[1]?.url).toBe(`${resolvePublicApiBaseUrl()}${RUTA}`);
    expect(llamadas[1]?.init.method).toBe('POST');
    expect(llamadas[1]?.init.headers).toEqual({ 'Content-Type': 'application/json' });
  });

  it('envía la cookie HttpOnly mediante credentials include sin leerla ni copiarla', async () => {
    const llamadas: Llamada[] = [];
    await submitAccessRequest(CUERPO, fetchQueDevuelve(202, RESPUESTA_202, llamadas));

    expect(llamadas[0]?.init.credentials).toBe('include');
    expect(llamadas[1]?.init.credentials).toBe('include');
    expect(JSON.stringify(llamadas[1]?.init.headers)).not.toContain('Cookie');
  });

  it('envía los diez campos del contrato más el expediente de la rama', async () => {
    const llamadas: Llamada[] = [];
    await submitAccessRequest(CUERPO, fetchQueDevuelve(202, RESPUESTA_202, llamadas));

    const enviado = JSON.parse(String(llamadas[1]?.init.body)) as Record<string, unknown>;

    expect(Object.keys(enviado).sort()).toStrictEqual([
      'birthDate',
      'documentNumber',
      'documentType',
      'familyNames',
      'givenNames',
      'password',
      'phone',
      'registration',
      'requestedProfile',
      'sexGenderCode',
    ]);
    expect((enviado['registration'] as Record<string, unknown>)['necesitaApoyo']).toBe('SI');
  });

  it('envía la credencial UNA sola vez y sólo dentro del cuerpo', async () => {
    const llamadas: Llamada[] = [];
    await submitAccessRequest(CUERPO, fetchQueDevuelve(202, RESPUESTA_202, llamadas));

    const serializado = JSON.stringify(llamadas);
    expect(serializado.split('claveFicticia7').length - 1).toBe(1);

    for (const llamada of llamadas) {
      expect(llamada.url).not.toContain('claveFicticia7');
      expect(JSON.stringify(llamada.init.headers ?? {})).not.toContain('claveFicticia7');
    }
  });

  it('no envía ningún campo de autoridad ni dato prohibido', async () => {
    const llamadas: Llamada[] = [];
    await submitAccessRequest(CUERPO, fetchQueDevuelve(202, RESPUESTA_202, llamadas));

    const enviado = String(llamadas[1]?.init.body);

    for (const prohibido of [
      'token',
      'cookie',
      'sub',
      'tenantId',
      'status',
      'source',
      'reference',
      'role',
      'decision',
      'reviewedBy',
      'provisioningStatus',
      'notes',
      'consent',
    ]) {
      expect(enviado).not.toContain(`"${prohibido}"`);
    }
  });

  it('interpreta un 202 válido como aceptado con referencia y estado', async () => {
    const desenlace = await submitAccessRequest(
      CUERPO,
      fetchQueDevuelve(202, RESPUESTA_202),
    );

    expect(desenlace).toStrictEqual({
      kind: 'accepted',
      accepted: {
        reference: 'AR-3F9C1D0B7A6E5248C1B0D2E9',
        status: 'PENDING',
        source: 'TEST_DATA',
      },
    });
  });

  it('replay: un 202 repetido devuelve la misma referencia sin segunda escritura', async () => {
    const llamadas: Llamada[] = [];
    const cliente = fetchQueDevuelve(202, RESPUESTA_202, llamadas);

    const primero = await submitAccessRequest(CUERPO, cliente);
    const segundo = await submitAccessRequest(CUERPO, cliente);

    expect(segundo).toStrictEqual(primero);
    expect(llamadas).toHaveLength(4);
    expect((llamadas[1]?.init.body as string)).toBe(llamadas[3]?.init.body as string);
  });

  it('asocia los campos señalados por un 400 sin repetir el valor recibido', async () => {
    const desenlace = await submitAccessRequest(
      CUERPO,
      fetchQueDevuelve(400, {
        code: 'ACCESS_REQUEST_INVALID_BODY',
        message: 'La solicitud no tiene una forma válida.',
        fields: ['documentNumber'],
      }),
    );

    expect(desenlace).toStrictEqual({ kind: 'invalid', fields: ['documentNumber'] });
    expect(JSON.stringify(desenlace)).not.toContain('900000001');
  });

  it('un 400 sin fields utilizables degrada a lista vacía', async () => {
    for (const cuerpo of [{}, { fields: 'documentNumber' }, { fields: [1, 2] }]) {
      const desenlace = await submitAccessRequest(CUERPO, fetchQueDevuelve(400, cuerpo));

      expect(desenlace).toStrictEqual({ kind: 'invalid', fields: [] });
    }
  });

  it('traduce 403, 429 y 503 a desenlaces propios y sin detalle', async () => {
    const cuerpoError = {
      code: 'ACCESS_REQUEST_ORIGIN_REJECTED',
      message: 'La solicitud no procede de un origen habilitado.',
    };

    for (const [status, kind] of [
      [403, 'forbidden'],
      [429, 'rateLimited'],
      [503, 'unavailable'],
    ] as const) {
      const desenlace = await submitAccessRequest(CUERPO, fetchQueDevuelve(status, cuerpoError));

      expect(desenlace).toStrictEqual({ kind });
      // El mensaje del servidor no se copia: el cliente no sigue otra prosa.
      expect(JSON.stringify(desenlace)).not.toContain('origen habilitado');
    }
  });

  it('un fallo de red se traduce en indisponibilidad sin datos técnicos', async () => {
    const desenlace = await submitAccessRequest(CUERPO, fetchQueFalla());

    expect(desenlace).toStrictEqual({ kind: 'unavailable' });
    expect(JSON.stringify(desenlace)).not.toContain('red no disponible');
  });

  it('rechaza un 202 cuyo status no sea exactamente PENDING', async () => {
    /*
     * Este endpoint solo emite `PENDING`. Un estado distinto —aprobado, rechazado,
     * revocado— pertenecería a un paquete posterior y no puede presentarse como si
     * ya se hubiera emitido aquí: la interfaz anunciaría un estado vigente que este
     * contrato no produce.
     */
    for (const status of ['APPROVED', 'REJECTED', 'REVOKED', 'pending', 'PENDING ', '']) {
      const desenlace = await submitAccessRequest(
        CUERPO,
        fetchQueDevuelve(202, { ...RESPUESTA_202, status }),
      );

      expect(desenlace).toStrictEqual({ kind: 'unavailable' });
    }
  });

  it('rechaza un 202 cuyo source no sea TEST_DATA o SELF_REGISTRATION', async () => {
    /*
     * La procedencia declara que el registro es ficticio. Aceptar otra —o una
     * cadena vacía que «parece» no decir nada— permitiría presentar como dato de
     * prueba un registro de otro origen.
     */
    for (const source of ['DEMONSTRATION', 'PRODUCTION', 'test_data', '']) {
      const desenlace = await submitAccessRequest(
        CUERPO,
        fetchQueDevuelve(202, { ...RESPUESTA_202, source }),
      );

      expect(desenlace).toStrictEqual({ kind: 'unavailable' });
    }
  });

  it('un 202 mal formado no se presenta como registro', async () => {
    const malformados: unknown[] = [
      null,
      {},
      { reference: 'AR-3F9C1D0B7A6E5248C1B0D2E9', status: 'PENDING' },
      { reference: 'no-es-una-referencia', status: 'PENDING', source: 'TEST_DATA' },
      { reference: RESPUESTA_202.reference, status: 202, source: 'TEST_DATA' },
      { reference: RESPUESTA_202.reference, status: 'PENDING', source: 'TEST_DATA', extra: 1 },
    ];

    for (const cuerpo of malformados) {
      const desenlace = await submitAccessRequest(CUERPO, fetchQueDevuelve(202, cuerpo));

      expect(desenlace).toStrictEqual({ kind: 'unavailable' });
    }
  });

  it('un cuerpo que no es JSON se trata como indisponibilidad', async () => {
    const cliente = (async () =>
      ({
        status: 202,
        json: async () => {
          throw new Error('cuerpo no es JSON');
        },
      }) as unknown as Response) as unknown as typeof fetch;

    expect(await submitAccessRequest(CUERPO, cliente)).toStrictEqual({ kind: 'unavailable' });
  });

  it('un estado que no es 202 no se presenta como registro', async () => {
    for (const status of [200, 201, 204, 404, 500]) {
      const desenlace = await submitAccessRequest(
        CUERPO,
        fetchQueDevuelve(status, RESPUESTA_202),
      );

      expect(desenlace).toStrictEqual({ kind: 'unavailable' });
    }
  });

  it('no persiste nada en el navegador ni anade datos a la URL', async () => {
    const llamadas: Llamada[] = [];
    await submitAccessRequest(CUERPO, fetchQueDevuelve(202, RESPUESTA_202, llamadas));

    const fuente = readFileSync(new URL('./accessRequestClient.ts', import.meta.url), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//gu, '')
      .replace(/\/\/.*$/gmu, '');

    for (const prohibido of [
      'localStorage',
      'sessionStorage',
      'indexedDB',
      'document.cookie',
      'Authorization',
    ]) {
      expect(fuente).not.toContain(prohibido);
    }

    expect(llamadas[1]?.url).not.toContain('?');
  });
});

describe('validación local de la credencial ficticia (OD-11)', () => {
  it('acepta exactamente lo que la API acepta', () => {
    for (const valor of [
      'claveFicticia7',
      '12345678a',
      'ñandú9abc',
      'a1'.repeat(4),
      'b2'.repeat(36),
      'clave con  espacios2',
    ]) {
      expect(accessRequestPasswordProblem(valor)).toBeNull();
    }
  });

  it('rechaza por longitud, clases de carácter y caracteres de control', () => {
    expect(accessRequestPasswordProblem('a1')).toBe('tooShort');
    expect(accessRequestPasswordProblem('abcdefg')).toBe('tooShort');
    expect(
      accessRequestPasswordProblem('a'.repeat(ACCESS_REQUEST_PASSWORD_MIN_LENGTH - 1)),
    ).toBe('tooShort');
    expect(accessRequestPasswordProblem('b'.repeat(ACCESS_REQUEST_PASSWORD_MAX_LENGTH + 1))).toBe(
      'tooLong',
    );
    expect(accessRequestPasswordProblem('12345678')).toBe('missingLetter');
    expect(accessRequestPasswordProblem('abcdefghij')).toBe('missingDigit');
    expect(accessRequestPasswordProblem(`claveFicticia7${String.fromCharCode(10)}`)).toBe(
      'controlCharacter',
    );
    expect(accessRequestPasswordProblem(`clave${String.fromCharCode(0)}icticia7`)).toBe(
      'controlCharacter',
    );
    expect(accessRequestPasswordProblem(`claveFicticia7${String.fromCharCode(127)}`)).toBe(
      'controlCharacter',
    );
  });

  it('nunca devuelve ni refleja el valor escrito', () => {
    const problema = accessRequestPasswordProblem('corto');

    /*
     * El motivo es una CATEGORÍA de una lista cerrada. Si algún día alguien
     * añadiera el valor al motivo, esta prueba es la que se entera.
     */
    expect(problema).not.toBeNull();
    expect(String(problema)).not.toContain('corto');
    expect(accessRequestPasswordProblem('claveFicticia7')).toBeNull();

    const fuente = readFileSync(new URL('./accessRequestClient.ts', import.meta.url), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//gu, '')
      .replace(/\/\/.*$/gmu, '');

    for (const prohibido of ['localStorage', 'sessionStorage', 'indexedDB', 'document.cookie']) {
      expect(fuente).not.toContain(prohibido);
    }
  });
});
