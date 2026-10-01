/**
 * ProvisiÃ³n de cuentas (SPEC 038, MP04).
 *
 * Dos objetos distintos y ninguno de ellos es la base de datos real:
 *
 * 1. `AccessProvisioningIdentityClient` â€” contra un `fetch` sustituido, para
 *    verificar LO QUE SE ENVÃA al proveedor, CUÃNTAS veces y con quÃ©
 *    clasificaciÃ³n de fallo. Es el Ãºnico archivo que puede afirmar que la
 *    contraseÃ±a sale una sola vez y no vuelve a aparecer.
 * 2. `AccessProvisioningService` â€” con dobles de Prisma, auditorÃ­a y cliente,
 *    para verificar las TRES fases de la saga, los desenlaces cerrados y los
 *    lÃ­mites de reintento.
 *
 * La evidencia sobre PostgreSQL real (FK, RLS, unicidad y revocaciÃ³n atÃ³mica)
 * queda DIFERIDA: este archivo no la sustituye y no la pretende.
 */

import { afterEach, describe, expect, it } from 'vitest';

import { type ApiEnvironmentProvider } from '../src/config/api-environment.provider';
import { type AccessProvisioningConfig } from '../src/config/environment';
import {
  ACCESS_PROVISIONING_ERROR_CODES,
  ACCESS_PROVISIONING_MARKER_ATTRIBUTE,
  ACCESS_PROVISIONING_MAX_ATTEMPTS,
  ACCESS_PROVISIONING_REQUEST_MAX_ATTEMPTS,
  ACCESS_PROVISIONING_RETRY_BASE_BACKOFF_MS,
  ACCESS_PROVISIONING_USERNAME_PATTERN,
} from '../src/access-requests/access-provisioning.contract';
import {
  AccessProvisioningIdentityClient,
  AccessProvisioningIdentityError,
  type AccessProvisioningBackoff,
} from '../src/access-requests/access-provisioning-identity.client';
import { AccessProvisioningService } from '../src/access-requests/access-provisioning.service';
import { type AuditService } from '../src/audit/audit.service';
import { type PrismaService } from '../src/database/prisma.service';

/* -------------------------------------------------------------------------- */
/* Entorno y secretos de prueba                                               */
/* -------------------------------------------------------------------------- */

/** Contrase\u00f1a ficticia. Se usa como CENTINELA: su aparici\u00f3n fuera del
 * cuerpo de creaci\u00f3n es un defecto de secreto, no un dato de prueba. */
const CENTINELA = 'clave-Ficticia-No-Archivar-7';

const CONFIG: AccessProvisioningConfig = {
  issuer: 'https://identidad.test/realms/merdn-local',
  adminUrl: 'https://identidad.test',
  realm: 'merdn-local',
  clientId: 'merdn-administracion',
  clientSecret: 'secreto-de-prueba-administrativa',
};

const TENANT = 'tenant-0000-4000-8000-000000000001';
const PERSONA = 'person-0000-4000-8000-000000000001';
const SOLICITUD = 'aaaaaaa1-0000-4000-8000-000000000001';
const REFERENCIA = 'AR-AAAAAAAAAAAAAAAAAAAAAAAA';
const SUBJECT = 'sub-real-0001';
const AHORA = new Date('2026-09-30T12:00:00.000Z');

const entorno = (config?: AccessProvisioningConfig): ApiEnvironmentProvider =>
  ({ accessProvisioning: config }) as unknown as ApiEnvironmentProvider;

/* -------------------------------------------------------------------------- */
/* Utilidades comunes                                                          */
/* -------------------------------------------------------------------------- */

type Row = Record<string, unknown>;

let contador = 0;

const siguienteId = (): string => {
  contador += 1;
  return `00000000-0000-4000-8000-${String(contador).padStart(12, '0')}`;
};

function coincide(row: Row, where: Row): boolean {
  return Object.entries(where).every(([clave, esperado]) => {
    const actual = row[clave];

    if (esperado === null) {
      return actual === null || actual === undefined;
    }

    if (esperado instanceof Date) {
      return actual instanceof Date && actual.getTime() === esperado.getTime();
    }

    if (typeof esperado === 'object') {
      const condicion = esperado as Row;

      if ('lt' in condicion) {
        return typeof actual === 'number' && actual < (condicion['lt'] as number);
      }

      if ('in' in condicion) {
        return (condicion['in'] as readonly unknown[]).includes(actual);
      }
    }

    return actual === esperado;
  });
}

function aplicar(row: Row, data: Row): void {
  for (const [clave, valor] of Object.entries(data)) {
    if (
      valor !== null &&
      typeof valor === 'object' &&
      !(valor instanceof Date) &&
      'increment' in (valor as Row)
    ) {
      row[clave] = (row[clave] as number) + ((valor as Row)['increment'] as number);
      continue;
    }

    row[clave] = valor;
  }
}

function proyectar(row: Row, select?: Row): Row {
  if (select === undefined) {
    return { ...row };
  }

  const salida: Row = {};

  for (const [clave, activo] of Object.entries(select)) {
    if (activo === true) {
      salida[clave] = row[clave];
    }
  }

  return salida;
}

/* -------------------------------------------------------------------------- */
/* 1. Cliente administrativo contra un `fetch` sustituido                      */
/* -------------------------------------------------------------------------- */

interface Llamada {
  readonly method: string;
  readonly url: string;
  readonly headers: Record<string, string>;
  readonly body: string | undefined;
}

type Responder = (llamada: Llamada) => Response;

/** El `fetch` real de proceso, capturado UNA vez para poder restaurarlo. */
const fetchOriginal = globalThis.fetch;

let restaurarFetch: (() => void) | null = null;

/** Sustituye `fetch` durante UNA prueba y devuelve las llamadas registradas. */
function conFetch(responder: Responder): Llamada[] {
  const llamadas: Llamada[] = [];

  globalThis.fetch = (async (
    input: Parameters<typeof fetch>[0],
    init?: Parameters<typeof fetch>[1],
  ) => {
    const url =
      input instanceof URL
        ? input.toString()
        : typeof (input as { readonly url?: unknown }).url === 'string'
          ? String((input as { readonly url?: string }).url)
          : String(input);

    const cabeceras: Record<string, string> = {};

    if (init?.headers !== undefined && typeof init.headers !== 'function') {
      for (const [clave, valor] of Object.entries(init.headers as Record<string, string>)) {
        cabeceras[clave] = valor;
      }
    }

    const llamada: Llamada = {
      method: init?.method ?? 'GET',
      url,
      headers: cabeceras,
      body: typeof init?.body === 'string' ? init.body : undefined,
    };

    llamadas.push(llamada);
    return responder(llamada);
  }) as typeof fetch;

  restaurarFetch = () => {
    globalThis.fetch = fetchOriginal;
  };

  return llamadas;
}

afterEach(() => {
  restaurarFetch?.();
  restaurarFetch = null;
});

class BackoffFalso implements AccessProvisioningBackoff {
  public readonly esperas: number[] = [];

  public async wait(milliseconds: number): Promise<void> {
    this.esperas.push(milliseconds);
  }
}

const respuesta = (estado: number, cuerpo?: unknown): Response =>
  new Response(cuerpo === undefined ? null : JSON.stringify(cuerpo), {
    status: estado,
    headers: { 'Content-Type': 'application/json' },
  });

/** Representaci\u00f3n remota de la identidad creada: lo que `setEnabled` relee. */
const usuarioRemoto = (referencia = REFERENCIA, marcador = SOLICITUD): Row => ({
  id: SUBJECT,
  username: referencia,
  enabled: false,
  firstName: 'DEMO',
  lastName: 'PACIENTE',
  attributes: { [ACCESS_PROVISIONING_MARKER_ATTRIBUTE]: [marcador] },
});

/** Manejador por DEFECTO: token correcto, creaci\u00f3n 201 y b\u00fasqueda unitaria. */
function manejadorPorDefecto(referencia = REFERENCIA, marcador = SOLICITUD): Responder {
  return (llamada) => {
    if (llamada.url.includes('/protocol/openid-connect/token')) {
      return respuesta(200, { access_token: 'tok-administrativo', expires_in: 60 });
    }

    if (llamada.method === 'POST' && llamada.url.endsWith('/users')) {
      return respuesta(201);
    }

    if (llamada.method === 'GET' && llamada.url.includes('/users?')) {
      return respuesta(200, [
        {
          id: SUBJECT,
          username: referencia,
          enabled: false,
          attributes: { [ACCESS_PROVISIONING_MARKER_ATTRIBUTE]: [marcador] },
        },
      ]);
    }

    if (llamada.method === 'GET') {
      return respuesta(200, usuarioRemoto(referencia, marcador));
    }

    return respuesta(204);
  };
}

/**
 * Construye UN cliente sobre el `fetch` instalado por `conFetch`.
 *
 * El manejador se pasa a `conFetch`, no aqu\u00ed: as\u00ed una prueba puede encadenar
 * dos escenarios distintos instalando el segundo manejador antes del segundo
 * cliente, sin que el constructor sobrescriba nada.
 */
function crearCliente(
  config: AccessProvisioningConfig | undefined,
): { readonly cliente: AccessProvisioningIdentityClient; readonly backoff: BackoffFalso } {
  const backoff = new BackoffFalso();
  const cliente = new AccessProvisioningIdentityClient(entorno(config), backoff);
  return { cliente, backoff };
}

describe('cliente administrativo de identidad (MP04)', () => {
  it('crea el usuario DESHABILITADO con la referencia exacta y su marcador', async () => {
    const llamadas = conFetch(manejadorPorDefecto());
    const { cliente } = crearCliente(CONFIG);

    const creado = await cliente.createDisabledUser({
      username: REFERENCIA,
      marker: SOLICITUD,
      password: CENTINELA,
    });

    expect(creado).toStrictEqual({ id: SUBJECT });

    const creacion = llamadas.find(
      (l) => l.method === 'POST' && l.url.endsWith('/users'),
    );
    expect(creacion).toBeDefined();

    const cuerpo = JSON.parse(creacion!.body ?? '{}') as Row;
    expect(cuerpo['username']).toBe(REFERENCIA);
    expect(cuerpo['enabled']).toBe(false);
    expect(cuerpo['credentials']).toStrictEqual([
      { type: 'password', value: CENTINELA, temporary: false },
    ]);
    expect(cuerpo['attributes']).toStrictEqual({ [ACCESS_PROVISIONING_MARKER_ATTRIBUTE]: [SOLICITUD] });

    // El username que sale es EXACTAMENTE la referencia, sin prefijo ni caso alterado.
    expect(ACCESS_PROVISIONING_USERNAME_PATTERN.test(String(cuerpo['username']))).toBe(true);

    const confirmacion = llamadas.find(
      (l) => l.method === 'GET' && l.url.includes('/users?'),
    );
    expect(confirmacion?.url).toContain(`username=${REFERENCIA}`);
    expect(confirmacion?.url).toContain('exact=true');
    expect(confirmacion?.url).toContain('max=2');
  });

  it('la contrase\u00f1a aparece UNA sola vez y s\u00f3lo en el cuerpo de creaci\u00f3n', async () => {
    const llamadas = conFetch(manejadorPorDefecto());
    const { cliente } = crearCliente(CONFIG);

    await cliente.createDisabledUser({
      username: REFERENCIA,
      marker: SOLICITUD,
      password: CENTINELA,
    });

    const serializado = JSON.stringify(llamadas);
    const apariciones = serializado.split(CENTINELA).length - 1;
    expect(apariciones).toBe(1);

    // Ni en las cabeceras, ni en la URL, ni en la petici\u00f3n de token.
    for (const llamada of llamadas) {
      expect(llamada.url).not.toContain(CENTINELA);
      expect(JSON.stringify(llamada.headers)).not.toContain(CENTINELA);
    }

    const token = llamadas.find((l) => l.url.includes('/protocol/openid-connect/token'));
    expect(token?.body).not.toContain(CENTINELA);
    expect(token?.headers['Authorization']).toBeUndefined();
  });

  it('un 409 con marcador PROPIO es idempotente; con marcador ajeno es colisi\u00f3n', async () => {
    const conMarcador = (marcador: string | null): Responder => (llamada) => {
      if (llamada.url.includes('/protocol/openid-connect/token')) {
        return respuesta(200, { access_token: 'tok', expires_in: 60 });
      }

      if (llamada.method === 'POST') {
        return respuesta(409);
      }

      return respuesta(
        200,
        marcador === null
          ? [{ id: SUBJECT, username: REFERENCIA }]
          : [{ id: SUBJECT, username: REFERENCIA, attributes: { [ACCESS_PROVISIONING_MARKER_ATTRIBUTE]: [marcador] } }],
      );
    };

    conFetch(conMarcador(SOLICITUD));
    const propio = crearCliente(CONFIG);
    await expect(
      propio.cliente.createDisabledUser({
        username: REFERENCIA,
        marker: SOLICITUD,
        password: CENTINELA,
      }),
    ).resolves.toStrictEqual({ id: SUBJECT });

    conFetch(conMarcador('aaaaaaa1-0000-4000-8000-00000000ffff'));
    const ajeno = crearCliente(CONFIG);
    const rechazo = await ajeno.cliente
      .createDisabledUser({
        username: REFERENCIA,
        marker: SOLICITUD,
        password: CENTINELA,
      })
      .catch((error: unknown) => error);

    expect(rechazo).toBeInstanceOf(AccessProvisioningIdentityError);
    expect((rechazo as AccessProvisioningIdentityError).code).toBe(
      ACCESS_PROVISIONING_ERROR_CODES.identityCollision,
    );
    // El mensaje nombra la causa, nunca el cuerpo ni el identificador ajeno.
    expect(String((rechazo as Error).message)).not.toContain(SUBJECT);
    expect(String((rechazo as Error).message)).not.toContain(CENTINELA);
  });

  it('una b\u00fasqueda con dos usuarios es colisi\u00f3n, nunca una elecci\u00f3n', async () => {
    conFetch((llamada) =>
      llamada.url.includes('/protocol/openid-connect/token')
        ? respuesta(200, { access_token: 'tok', expires_in: 60 })
        : respuesta(200, [
            { id: 'sub-1', username: REFERENCIA },
            { id: 'sub-2', username: REFERENCIA },
          ]),
    );

    const { cliente } = crearCliente(CONFIG);
    const error = await cliente.findUserByUsername(REFERENCIA).catch((e: unknown) => e);

    expect((error as AccessProvisioningIdentityError).code).toBe(
      ACCESS_PROVISIONING_ERROR_CODES.identityCollision,
    );
  });

  it('setEnabled RELEE y reescribe la representaci\u00f3n completa, marcador incluido', async () => {
    const llamadas = conFetch((llamada) => {
      if (llamada.url.includes('/protocol/openid-connect/token')) {
        return respuesta(200, { access_token: 'tok', expires_in: 60 });
      }

      if (llamada.method === 'GET') {
        return respuesta(200, {
          id: SUBJECT,
          username: REFERENCIA,
          enabled: false,
          attributes: { [ACCESS_PROVISIONING_MARKER_ATTRIBUTE]: [SOLICITUD] },
        });
      }

      return respuesta(204);
    });

    const { cliente } = crearCliente(CONFIG);
    await cliente.setEnabled(SUBJECT, true);

    const escritura = llamadas.find((l) => l.method === 'PUT');
    expect(escritura).toBeDefined();
    expect(escritura!.url).toContain(`/users/${SUBJECT}`);

    const cuerpo = JSON.parse(escritura!.body ?? '{}') as Row;
    expect(cuerpo['enabled']).toBe(true);
    expect(cuerpo['username']).toBe(REFERENCIA);
    // Perder el marcador en un SUSPEND dejar\u00eda a la solicitud sin su prueba.
    expect(cuerpo['attributes']).toStrictEqual({
      [ACCESS_PROVISIONING_MARKER_ATTRIBUTE]: [SOLICITUD],
    });
  });

  it('un 5xx se reintenta UNA vez con backoff; un 4xx nunca se reintenta', async () => {
    /*
     * `setEnabled` LEE antes de ESCRIBIR: la lectura es siempre correcta y el
     * fallo se inyecta s\u00f3lo en la escritura, para que el reintento se mida
     * sobre la operaci\u00f3n que lo merece y no sobre una lectura previa.
     */
    let intentos = 0;
    conFetch((llamada) => {
      if (llamada.url.includes('/protocol/openid-connect/token')) {
        return respuesta(200, { access_token: 'tok', expires_in: 60 });
      }

      if (llamada.method === 'GET') {
        return respuesta(200, usuarioRemoto());
      }

      intentos += 1;
      return intentos === 1 ? respuesta(503) : respuesta(204);
    });

    const reintento = crearCliente(CONFIG);
    await reintento.cliente.setEnabled(SUBJECT, true);

    expect(intentos).toBe(2);
    expect(reintento.backoff.esperas).toEqual([ACCESS_PROVISIONING_RETRY_BASE_BACKOFF_MS]);

    let rechazos = 0;
    conFetch((llamada) => {
      if (llamada.url.includes('/protocol/openid-connect/token')) {
        return respuesta(200, { access_token: 'tok', expires_in: 60 });
      }

      if (llamada.method === 'GET') {
        return respuesta(200, usuarioRemoto());
      }

      rechazos += 1;
      return respuesta(400);
    });

    const directo = crearCliente(CONFIG);
    const error = await directo.cliente.setEnabled(SUBJECT, true).catch((e: unknown) => e);

    expect(rechazos).toBe(1);
    expect(directo.backoff.esperas).toEqual([]);
    expect(error).toBeInstanceOf(AccessProvisioningIdentityError);
    // Frase FIJA: sin estado, sin host, sin cuerpo, sin palabra "400".
    expect(String((error as Error).message)).toBe(
      'La administraci\u00f3n de identidad no pudo procesar la operaci\u00f3n.',
    );
    expect(String((error as Error).message)).not.toContain('400');
  });

  it('un fallo de red se clasifica como indisponibilidad con mensaje fijo', async () => {
    let intentos = 0;
    conFetch((llamada) => {
      if (llamada.url.includes('/protocol/openid-connect/token')) {
        return respuesta(200, { access_token: 'tok', expires_in: 60 });
      }

      intentos += 1;
      throw new TypeError('fetch failed: https://identidad.test/admin/realms/merdn-local');
    });

    const { cliente, backoff } = crearCliente(CONFIG);
    const error = await cliente.setEnabled(SUBJECT, true).catch((e: unknown) => e);

    expect(intentos).toBe(ACCESS_PROVISIONING_REQUEST_MAX_ATTEMPTS);
    expect(backoff.esperas).toHaveLength(1);
    expect((error as AccessProvisioningIdentityError).code).toBe(
      ACCESS_PROVISIONING_ERROR_CODES.unavailable,
    );
    // El mensaje no reproduce la excepci\u00f3n de red: esa s\u00ed lleva el host.
    expect(String((error as Error).message)).not.toContain('identidad.test');
    expect(String((error as Error).message)).not.toContain('fetch failed');
  });

  it('sin configuraci\u00f3n no sale ninguna petici\u00f3n', async () => {
    const llamadas = conFetch(manejadorPorDefecto());
    const { cliente } = crearCliente(undefined);

    const error = await cliente
      .createDisabledUser({ username: REFERENCIA, marker: SOLICITUD, password: CENTINELA })
      .catch((e: unknown) => e);

    expect((error as AccessProvisioningIdentityError).code).toBe(
      ACCESS_PROVISIONING_ERROR_CODES.notConfigured,
    );
    expect(llamadas).toHaveLength(0);
  });

  it('el token administrativo se cachea: uno solo para varias llamadas', async () => {
    const llamadas = conFetch(manejadorPorDefecto());
    const { cliente } = crearCliente(CONFIG);

    await cliente.setEnabled(SUBJECT, true);
    await cliente.getUser(SUBJECT);
    await cliente.setEnabled(SUBJECT, false);

    const intercambios = llamadas.filter((l) =>
      l.url.includes('/protocol/openid-connect/token'),
    );
    expect(intercambios).toHaveLength(1);

    // Las llamadas administrativas llevan el token; la de intercambio, no.
    const administrativas = llamadas.filter(
      (l) => !l.url.includes('/protocol/openid-connect/token'),
    );
    expect(administrativas.length).toBeGreaterThan(0);

    for (const llamada of administrativas) {
      expect(llamada.headers['Authorization']).toBe('Bearer tok-administrativo');
    }
  });

  it('el token de intercambio lleva el secreto del cliente y jam\u00e1s la contrase\u00f1a', async () => {
    const llamadas = conFetch(manejadorPorDefecto());
    const { cliente } = crearCliente(CONFIG);

    await cliente.createDisabledUser({
      username: REFERENCIA,
      marker: SOLICITUD,
      password: CENTINELA,
    });

    const token = llamadas.find((l) => l.url.includes('/protocol/openid-connect/token'));
    expect(token?.body).toContain(`client_secret=${CONFIG.clientSecret}`);
    expect(token?.body).toContain('grant_type=client_credentials');
    expect(token?.body).not.toContain(CENTINELA);
  });
});

/* -------------------------------------------------------------------------- */
/* 2. Saga de provisi\u00f3n (servicio) con dobles                             */
/* -------------------------------------------------------------------------- */

interface Store {
  persons: Row[];
  accessRequests: Row[];
  humanAccounts: Row[];
  externalAuthIdentities: Row[];
  humanSessions: Row[];
  patients: Row[];
  professionalProfiles: Row[];
  professionalAffiliations: Row[];
  auditEvents: Row[];
  queries: string[];
  /** La pr\u00f3xima escritura de `accessRequest` simula una carrera perdida. */
  fallarProximaEscritura: boolean;
}

function crearStore(): Store {
  return {
    persons: [],
    accessRequests: [],
    humanAccounts: [],
    externalAuthIdentities: [],
    humanSessions: [],
    patients: [],
    professionalProfiles: [],
    professionalAffiliations: [],
    auditEvents: [],
    queries: [],
    fallarProximaEscritura: false,
  };
}

function modelo(store: Store, nombre: string, filas: Row[]): Row {
  return {
    findFirst: async (args: { where: Row; select?: Row; orderBy?: unknown }) => {
      store.queries.push(`${nombre}.findFirst`);
      const encontrada = filas.find((fila) => coincide(fila, args.where));
      return encontrada === undefined ? null : proyectar(encontrada, args.select);
    },
    findMany: async (args: { where: Row; select?: Row; orderBy?: unknown }) => {
      store.queries.push(`${nombre}.findMany`);
      return filas
        .filter((fila) => coincide(fila, args.where))
        .map((fila) => proyectar(fila, args.select));
    },
    create: async (args: { data: Row; select?: Row }) => {
      store.queries.push(`${nombre}.create`);
      const fila: Row = { id: siguienteId(), ...args.data };
      filas.push(fila);
      return proyectar(fila, args.select);
    },
    updateMany: async (args: { where: Row; data: Row }) => {
      store.queries.push(`${nombre}.updateMany`);

      if (nombre === 'accessRequest' && store.fallarProximaEscritura) {
        store.fallarProximaEscritura = false;
        return { count: 0 };
      }

      const afectadas = filas.filter((fila) => coincide(fila, args.where));

      for (const fila of afectadas) {
        aplicar(fila, args.data);
      }

      return { count: afectadas.length };
    },
  };
}

function crearTx(store: Store): Row {
  return {
    $queryRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => {
      store.queries.push(`$queryRaw:${strings.join('?')}`);
      const [personId, tenantId] = values as [string, string];
      return store.persons
        .filter((persona) => persona['id'] === personId && persona['tenantId'] === tenantId)
        .map((persona) => ({ id: persona['id'] }));
    },
    accessRequest: modelo(store, 'accessRequest', store.accessRequests),
    humanAccount: modelo(store, 'humanAccount', store.humanAccounts),
    externalAuthIdentity: modelo(store, 'externalAuthIdentity', store.externalAuthIdentities),
    humanSession: modelo(store, 'humanSession', store.humanSessions),
    patient: modelo(store, 'patient', store.patients),
    professionalProfile: modelo(store, 'professionalProfile', store.professionalProfiles),
    professionalAffiliation: modelo(store, 'professionalAffiliation', store.professionalAffiliations),
  };
}

/** Auditor\u00eda registrada POR PAYLOAD, que es lo que hay que inspeccionar. */
interface AuditoriaRegistrada {
  readonly metodo: string;
  readonly payload: string;
}

function crearAuditoria(store: Store): {
  readonly service: AuditService;
  readonly registradas: AuditoriaRegistrada[];
} {
  const registradas: AuditoriaRegistrada[] = [];

  const registrar =
    (metodo: string, eventType: string) =>
    async (_tx: Row, entrada: Record<string, unknown>, _now: Date): Promise<void> => {
      const payload = JSON.stringify(entrada);
      registradas.push({ metodo, payload });
      store.auditEvents.push({ id: siguienteId(), eventType, ...entrada });
    };

  const service = {
    recordAccessIdentityPreparedWithin: registrar(
      'recordAccessIdentityPreparedWithin',
      'ACCESS_IDENTITY_PREPARED',
    ),
    recordAccessIdentityPreparationFailedWithin: registrar(
      'recordAccessIdentityPreparationFailedWithin',
      'ACCESS_IDENTITY_PREPARATION_FAILED',
    ),
    recordAccessProvisioningSucceededWithin: registrar(
      'recordAccessProvisioningSucceededWithin',
      'ACCESS_PROVISIONING_SUCCEEDED',
    ),
    recordAccessProvisioningFailedWithin: registrar(
      'recordAccessProvisioningFailedWithin',
      'ACCESS_PROVISIONING_FAILED',
    ),
  };

  return { service: service as unknown as AuditService, registradas };
}

interface ClienteFalso {
  readonly createCalls: Row[];
  readonly getUserCalls: string[];
  readonly enabledCalls: [string, boolean][];
  fallaCrear: Error | null;
  fallaEnabled: Error | null;
}

function crearClienteFalso(): ClienteFalso {
  const createCalls: Row[] = [];
  const getUserCalls: string[] = [];
  const enabledCalls: [string, boolean][] = [];

  const doble = {
    createCalls,
    getUserCalls,
    enabledCalls,
    fallaCrear: null as Error | null,
    fallaEnabled: null as Error | null,
    async createDisabledUser(input: { username: string; marker: string; password: string }) {
      createCalls.push({ ...input });
      if (doble.fallaCrear !== null) {
        throw doble.fallaCrear;
      }
      return { id: SUBJECT };
    },
    async getUser(userId: string) {
      getUserCalls.push(userId);
      return { id: userId, marker: SOLICITUD };
    },
    async setEnabled(userId: string, enabled: boolean) {
      enabledCalls.push([userId, enabled]);
      if (doble.fallaEnabled !== null) {
        throw doble.fallaEnabled;
      }
    },
  };

  return doble as unknown as ClienteFalso;
}

function sembrarSolicitud(store: Store, cambios: Row = {}): void {
  store.persons.push({
    id: PERSONA,
    tenantId: TENANT,
    documentNumberNormalized: '9999000001',
  });

  store.accessRequests.push({
    id: SOLICITUD,
    tenantId: TENANT,
    personId: PERSONA,
    reference: REFERENCIA,
    requestedProfile: 'PATIENT',
    status: 'APPROVED_PENDING_PROVISIONING',
    provisioningAttempts: 0,
    provisioningStatus: 'PENDING',
    provisioningErrorCode: null,
    humanAccountId: null,
    version: 2,
    ...cambios,
  });
}

function montarServicio(store: Store): {
  readonly servicio: AccessProvisioningService;
  readonly identity: ClienteFalso;
  readonly auditoria: AuditoriaRegistrada[];
} {
  const identity = crearClienteFalso();
  const { service: audit, registradas } = crearAuditoria(store);

  const prisma = {
    withTenant: async <T>(_tenantId: string, work: (tx: Row) => Promise<T>): Promise<T> =>
      work(crearTx(store)),
  };

  const servicio = new AccessProvisioningService(
    prisma as unknown as PrismaService,
    audit,
    identity as unknown as AccessProvisioningIdentityClient,
    entorno(CONFIG),
  );

  return { servicio, identity, auditoria: registradas };
}

describe('saga de provisi\u00f3n de cuentas (MP04)', () => {
  /* --- 1. Preparaci\u00f3n en el registro ---------------------------------- */

  it('prepara: cuenta DESHABILITADA, usuario deshabilitado y v\u00ednculo con el sub real', async () => {
    const store = crearStore();
    sembrarSolicitud(store);
    const { servicio, identity, auditoria } = montarServicio(store);

    await servicio.prepararIdentidad(
      {
        tenantId: TENANT,
        personId: PERSONA,
        accessRequestId: SOLICITUD,
        reference: REFERENCIA,
        password: CENTINELA,
      },
      AHORA,
    );

    expect(identity.createCalls).toHaveLength(1);
    expect(identity.createCalls[0]).toStrictEqual({
      username: REFERENCIA,
      marker: SOLICITUD,
      password: CENTINELA,
    });

    // Nace deshabilitada: la aprobaci\u00f3n es lo que la activa, y s\u00f3lo ella.
    expect(store.humanAccounts).toHaveLength(1);
    expect(store.humanAccounts[0]?.['status']).toBe('DISABLED');

    expect(store.externalAuthIdentities).toHaveLength(1);
    expect(store.externalAuthIdentities[0]?.['subject']).toBe(SUBJECT);
    expect(store.externalAuthIdentities[0]?.['issuer']).toBe(CONFIG.issuer);
    expect(store.externalAuthIdentities[0]?.['status']).toBe('ACTIVE');

    expect(store.accessRequests[0]?.['humanAccountId']).toBe(
      store.humanAccounts[0]?.['id'],
    );

    expect(store.auditEvents.map((e) => e['eventType'])).toContain(
      'ACCESS_IDENTITY_PREPARED',
    );

    // Ni la base ni la auditor\u00eda guardan la contrase\u00f1a.
    expect(JSON.stringify(store)).not.toContain(CENTINELA);
    expect(auditoria.map((a) => a.payload).join('|')).not.toContain(CENTINELA);
    expect(JSON.stringify(identity.createCalls[0]!['password'])).toBe(
      JSON.stringify(CENTINELA),
    );
  });

  it('repetir la preparaci\u00f3n no vuelve a tocar el proveedor', async () => {
    const store = crearStore();
    sembrarSolicitud(store);
    const { servicio, identity } = montarServicio(store);

    const contexto = {
      tenantId: TENANT,
      personId: PERSONA,
      accessRequestId: SOLICITUD,
      reference: REFERENCIA,
      password: CENTINELA,
    };

    await servicio.prepararIdentidad(contexto, AHORA);
    await servicio.prepararIdentidad(contexto, AHORA);

    expect(identity.createCalls).toHaveLength(1);
    expect(store.humanAccounts).toHaveLength(1);
    expect(store.externalAuthIdentities).toHaveLength(1);
  });

  it('si el proveedor falla, queda cuenta SIN v\u00ednculo y la traza del fallo', async () => {
    const store = crearStore();
    sembrarSolicitud(store);
    const { servicio, identity, auditoria } = montarServicio(store);

    identity.fallaCrear = new AccessProvisioningIdentityError(
      ACCESS_PROVISIONING_ERROR_CODES.unavailable,
      'No fue posible contactar con la administraci\u00f3n de identidad.',
    );

    const error = await servicio
      .prepararIdentidad(
        {
          tenantId: TENANT,
          personId: PERSONA,
          accessRequestId: SOLICITUD,
          reference: REFERENCIA,
          password: CENTINELA,
        },
        AHORA,
      )
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(AccessProvisioningIdentityError);

    // Se escribe ANTES que el v\u00ednculo: cuenta visible y reintentable, no
    // un v\u00ednculo apuntando a una cuenta que quiz\u00e1 no exista.
    expect(store.humanAccounts).toHaveLength(1);
    expect(store.externalAuthIdentities).toHaveLength(0);
    expect(store.accessRequests[0]?.['humanAccountId']).toBeNull();

    expect(store.auditEvents.map((e) => e['eventType'])).toContain(
      'ACCESS_IDENTITY_PREPARATION_FAILED',
    );
    expect(auditoria.map((a) => a.payload).join('|')).not.toContain(CENTINELA);
    expect(JSON.stringify(error)).not.toContain(CENTINELA);
  });

  /* --- 2. Fases de la saga ------------------------------------------------- */

  it('aprovisiona en tres fases: intento, proveedor y participaci\u00f3n + APPROVED', async () => {
    const store = crearStore();
    sembrarSolicitud(store);
    const { servicio, identity, auditoria } = montarServicio(store);

    const cuenta = siguienteId();
    store.humanAccounts.push({
      id: cuenta,
      tenantId: TENANT,
      personId: PERSONA,
      status: 'DISABLED',
    });
    store.accessRequests[0]!['humanAccountId'] = cuenta;
    store.externalAuthIdentities.push({
      id: siguienteId(),
      tenantId: TENANT,
      humanAccountId: cuenta,
      issuer: CONFIG.issuer,
      subject: SUBJECT,
      status: 'ACTIVE',
    });

    const resultado = await servicio.aprovisionar(
      { tenantId: TENANT, accessRequestId: SOLICITUD, endpoint: 'POST /decisi\u00f3n' },
      AHORA,
    );

    expect(resultado).toStrictEqual({ ok: true, status: 'APPROVED' });

    const fila = store.accessRequests[0]!;
    expect(fila['status']).toBe('APPROVED');
    expect(fila['provisioningStatus']).toBe('SUCCEEDED');
    expect(fila['provisioningErrorCode']).toBeNull();
    expect(fila['provisioningAttempts']).toBe(1);

    expect(store.humanAccounts[0]?.['status']).toBe('ACTIVE');

    // Participaci\u00f3n m\u00ednima de PATIENT, con cat\u00e1logo del servidor.
    expect(store.patients).toHaveLength(1);
    expect(store.patients[0]?.['epsCode']).toBe('NO_SABE');
    expect(store.patients[0]?.['origin']).toBe('PUBLIC_SELF_ENROLLMENT');
    expect(store.patients[0]?.['status']).toBe('ACTIVE');

    expect(identity.getUserCalls).toEqual([SUBJECT]);
    expect(identity.enabledCalls).toEqual([[SUBJECT, true]]);

    expect(store.auditEvents.map((e) => e['eventType'])).toContain(
      'ACCESS_PROVISIONING_SUCCEEDED',
    );
    expect(auditoria.map((a) => a.payload).join('|')).not.toContain(CENTINELA);
  });

  it('CAREGIVER no crea participaci\u00f3n alguna', async () => {
    const store = crearStore();
    sembrarSolicitud(store, { requestedProfile: 'CAREGIVER' });
    const { servicio } = montarServicio(store);

    const cuenta = siguienteId();
    store.humanAccounts.push({ id: cuenta, tenantId: TENANT, personId: PERSONA, status: 'DISABLED' });
    store.accessRequests[0]!['humanAccountId'] = cuenta;
    store.externalAuthIdentities.push({
      id: siguienteId(),
      tenantId: TENANT,
      humanAccountId: cuenta,
      issuer: CONFIG.issuer,
      subject: SUBJECT,
      status: 'ACTIVE',
    });

    const resultado = await servicio.aprovisionar(
      { tenantId: TENANT, accessRequestId: SOLICITUD, endpoint: 'POST /decisi\u00f3n' },
      AHORA,
    );

    expect(resultado).toStrictEqual({ ok: true, status: 'APPROVED' });
    expect(store.patients).toHaveLength(0);
    expect(store.professionalProfiles).toHaveLength(0);
    expect(store.professionalAffiliations).toHaveLength(0);
  });

  it('FIELD_PROFESSIONAL crea perfil y aficiaci\u00f3n, nunca asignaci\u00f3n', async () => {
    const store = crearStore();
    sembrarSolicitud(store, { requestedProfile: 'FIELD_PROFESSIONAL' });
    const { servicio } = montarServicio(store);

    const cuenta = siguienteId();
    store.humanAccounts.push({ id: cuenta, tenantId: TENANT, personId: PERSONA, status: 'DISABLED' });
    store.accessRequests[0]!['humanAccountId'] = cuenta;
    store.externalAuthIdentities.push({
      id: siguienteId(),
      tenantId: TENANT,
      humanAccountId: cuenta,
      issuer: CONFIG.issuer,
      subject: SUBJECT,
      status: 'ACTIVE',
    });

    await servicio.aprovisionar(
      { tenantId: TENANT, accessRequestId: SOLICITUD, endpoint: 'POST /decisi\u00f3n' },
      AHORA,
    );

    expect(store.professionalProfiles).toHaveLength(1);
    expect(store.professionalProfiles[0]?.['professionCode']).toBe('MEDICINA_GENERAL');
    expect(store.professionalAffiliations).toHaveLength(1);
    expect(store.professionalAffiliations[0]?.['engagementType']).toBe('THIRD_PARTY');
    expect(store.professionalAffiliations[0]?.['status']).toBe('ACTIVE');
    expect(store.patients).toHaveLength(0);
  });

  it('un fallo del proveedor deja PROVISIONING_FAILED, cuenta cerrada y c\u00f3digo cerrado', async () => {
    const store = crearStore();
    sembrarSolicitud(store);
    const { servicio, identity } = montarServicio(store);

    const cuenta = siguienteId();
    store.humanAccounts.push({ id: cuenta, tenantId: TENANT, personId: PERSONA, status: 'DISABLED' });
    store.accessRequests[0]!['humanAccountId'] = cuenta;
    store.externalAuthIdentities.push({
      id: siguienteId(),
      tenantId: TENANT,
      humanAccountId: cuenta,
      issuer: CONFIG.issuer,
      subject: SUBJECT,
      status: 'ACTIVE',
    });

    identity.fallaEnabled = new AccessProvisioningIdentityError(
      ACCESS_PROVISIONING_ERROR_CODES.unauthorized,
      'No fue posible obtener la autorizaci\u00f3n administrativa.',
    );

    const resultado = await servicio.aprovisionar(
      { tenantId: TENANT, accessRequestId: SOLICITUD, endpoint: 'POST /decisi\u00f3n' },
      AHORA,
    );

    expect(resultado).toStrictEqual({
      ok: false,
      status: 'PROVISIONING_FAILED',
      code: ACCESS_PROVISIONING_ERROR_CODES.unauthorized,
    });

    const fila = store.accessRequests[0]!;
    expect(fila['status']).toBe('PROVISIONING_FAILED');
    expect(fila['provisioningStatus']).toBe('FAILED');
    expect(fila['provisioningErrorCode']).toBe(ACCESS_PROVISIONING_ERROR_CODES.unauthorized);
    expect(fila['provisioningAttempts']).toBe(1);
    // Nunca deja acceso utilizable: la cuenta se cierra con el fallo.
    expect(store.humanAccounts[0]?.['status']).toBe('DISABLED');
    expect(store.patients).toHaveLength(0);
    expect(store.auditEvents.map((e) => e['eventType'])).toContain(
      'ACCESS_PROVISIONING_FAILED',
    );
  });

  /* --- 3. L\u00edmites y estados de origen ---------------------------------- */

  it('sin cuenta preparada la saga se niega: no hay contrase\u00f1a que reutilizar', async () => {
    const store = crearStore();
    sembrarSolicitud(store, { humanAccountId: null });
    const { servicio, identity } = montarServicio(store);

    const resultado = await servicio.aprovisionar(
      { tenantId: TENANT, accessRequestId: SOLICITUD, endpoint: 'POST /decisi\u00f3n' },
      AHORA,
    );

    expect(resultado).toStrictEqual({
      ok: false,
      status: 'PROVISIONING_FAILED',
      code: ACCESS_PROVISIONING_ERROR_CODES.passwordUnavailable,
    });
    expect(identity.getUserCalls).toHaveLength(0);
    expect(identity.enabledCalls).toHaveLength(0);
  });

  it(`agota en ${ACCESS_PROVISIONING_MAX_ATTEMPTS} intentos y el l\u00edmite no insiste`, async () => {
    const store = crearStore();
    sembrarSolicitud(store, { provisioningAttempts: ACCESS_PROVISIONING_MAX_ATTEMPTS });
    const { servicio, identity } = montarServicio(store);

    const cuenta = siguienteId();
    store.humanAccounts.push({ id: cuenta, tenantId: TENANT, personId: PERSONA, status: 'DISABLED' });
    store.accessRequests[0]!['humanAccountId'] = cuenta;

    const resultado = await servicio.aprovisionar(
      { tenantId: TENANT, accessRequestId: SOLICITUD, endpoint: 'POST /decisi\u00f3n' },
      AHORA,
    );

    expect(resultado).toStrictEqual({
      ok: false,
      status: 'PROVISIONING_FAILED',
      code: ACCESS_PROVISIONING_ERROR_CODES.retryLimitReached,
    });
    // El proveedor no se toca y el contador no sube m\u00e1s all\u00e1 del l\u00edmite.
    expect(identity.getUserCalls).toHaveLength(0);
    expect(store.accessRequests[0]?.['provisioningAttempts']).toBe(
      ACCESS_PROVISIONING_MAX_ATTEMPTS,
    );
    expect(store.accessRequests[0]?.['status']).toBe('PROVISIONING_FAILED');
  });

  it('una solicitud que no espera provisi\u00f3n no transita', async () => {
    const store = crearStore();
    sembrarSolicitud(store, { status: 'REVOKED' });
    const { servicio, identity } = montarServicio(store);

    const resultado = await servicio.aprovisionar(
      { tenantId: TENANT, accessRequestId: SOLICITUD, endpoint: 'POST /decisi\u00f3n' },
      AHORA,
    );

    expect(resultado).toMatchObject({
      ok: false,
      code: ACCESS_PROVISIONING_ERROR_CODES.identityNotFound,
    });
    expect(identity.getUserCalls).toHaveLength(0);
    // Una solicitud revocada no vuelve a ser aprobada por la saga: la escritura
    // condicionada a `APPROVED_PENDING_PROVISIONING` no encuentra fila y NO la
    // reabre ni la reescribe.
    expect(store.accessRequests[0]?.['status']).toBe('REVOKED');
  });

  it('sin v\u00ednculo activo no hay identidad que habilitar', async () => {
    const store = crearStore();
    sembrarSolicitud(store);
    const { servicio, identity } = montarServicio(store);

    const cuenta = siguienteId();
    store.humanAccounts.push({ id: cuenta, tenantId: TENANT, personId: PERSONA, status: 'DISABLED' });
    store.accessRequests[0]!['humanAccountId'] = cuenta;

    const resultado = await servicio.aprovisionar(
      { tenantId: TENANT, accessRequestId: SOLICITUD, endpoint: 'POST /decisi\u00f3n' },
      AHORA,
    );

    expect(resultado).toMatchObject({
      ok: false,
      code: ACCESS_PROVISIONING_ERROR_CODES.identityNotFound,
    });
    expect(identity.getUserCalls).toHaveLength(0);
    expect(store.patients).toHaveLength(0);
  });

  it('otra saga que gan\u00f3 la carrera devuelve su resultado sin tocar al proveedor', async () => {
    const store = crearStore();
    sembrarSolicitud(store);
    const { servicio, identity } = montarServicio(store);

    const cuenta = siguienteId();
    store.humanAccounts.push({ id: cuenta, tenantId: TENANT, personId: PERSONA, status: 'DISABLED' });
    store.accessRequests[0]!['humanAccountId'] = cuenta;
    store.externalAuthIdentities.push({
      id: siguienteId(),
      tenantId: TENANT,
      humanAccountId: cuenta,
      issuer: CONFIG.issuer,
      subject: SUBJECT,
      status: 'ACTIVE',
    });

    store.fallarProximaEscritura = true;

    const resultado = await servicio.aprovisionar(
      { tenantId: TENANT, accessRequestId: SOLICITUD, endpoint: 'POST /decisi\u00f3n' },
      AHORA,
    );

    expect(identity.getUserCalls).toHaveLength(0);
    expect(identity.enabledCalls).toHaveLength(0);
    // La fila sigui\u00f3 esperando, as\u00ed que no hay resultado propio que declarar.
    expect(resultado).toStrictEqual({
      ok: false,
      status: 'PROVISIONING_FAILED',
      code: ACCESS_PROVISIONING_ERROR_CODES.unavailable,
    });
    expect(store.patients).toHaveLength(0);
  });

  /* --- 4. Desactivaci\u00f3n y sincronizaci\u00f3n --------------------------- */

  it('desactivar cierra la cuenta y revoca TODAS sus sesiones en la misma transacci\u00f3n', async () => {
    const store = crearStore();
    const cuenta = siguienteId();

    store.humanAccounts.push({ id: cuenta, tenantId: TENANT, personId: PERSONA, status: 'ACTIVE' });
    store.humanSessions.push(
      { id: siguienteId(), tenantId: TENANT, humanAccountId: cuenta, revokedAt: null },
      { id: siguienteId(), tenantId: TENANT, humanAccountId: cuenta, revokedAt: null },
      { id: siguienteId(), tenantId: TENANT, humanAccountId: 'otra-cuenta', revokedAt: null },
    );
    store.externalAuthIdentities.push({
      id: siguienteId(),
      tenantId: TENANT,
      humanAccountId: cuenta,
      issuer: CONFIG.issuer,
      subject: SUBJECT,
      status: 'ACTIVE',
    });

    const { servicio, identity } = montarServicio(store);

    const resultado = await servicio.desactivarCuentaWithin(
      crearTx(store) as never,
      { tenantId: TENANT, humanAccountId: cuenta, unlinkIdentity: false },
      AHORA,
    );

    expect(store.humanAccounts[0]?.['status']).toBe('DISABLED');

    const mias = store.humanSessions.filter((s) => s['humanAccountId'] === cuenta);
    expect(mias.every((s) => s['revokedAt'] instanceof Date)).toBe(true);

    // La sesi\u00f3n de OTRA cuenta queda intacta: el alcance es la cuenta decidida.
    const ajena = store.humanSessions.find((s) => s['humanAccountId'] === 'otra-cuenta');
    expect(ajena?.['revokedAt']).toBeNull();

    expect(resultado.sessionsRevoked).toBe(true);
    expect(resultado.externalSubjects).toEqual([SUBJECT]);

    // Suspender NO desvincula: el v\u00ednculo sigue activo para poder reactivar.
    expect(store.externalAuthIdentities[0]?.['status']).toBe('ACTIVE');
    // La sincronizaci\u00f3n externa no forma parte de la transacci\u00f3n.
    expect(identity.enabledCalls).toHaveLength(0);
  });

  it('revocar desvincula la identidad y devuelve los asuntos a sincronizar', async () => {
    const store = crearStore();
    const cuenta = siguienteId();

    store.humanAccounts.push({ id: cuenta, tenantId: TENANT, personId: PERSONA, status: 'ACTIVE' });
    store.externalAuthIdentities.push({
      id: siguienteId(),
      tenantId: TENANT,
      humanAccountId: cuenta,
      issuer: CONFIG.issuer,
      subject: SUBJECT,
      status: 'ACTIVE',
    });

    const { servicio } = montarServicio(store);

    const resultado = await servicio.desactivarCuentaWithin(
      crearTx(store) as never,
      { tenantId: TENANT, humanAccountId: cuenta, unlinkIdentity: true },
      AHORA,
    );

    expect(store.externalAuthIdentities[0]?.['status']).toBe('UNLINKED');
    expect(store.externalAuthIdentities[0]?.['unlinkedAt']).toBeInstanceOf(Date);
    expect(resultado.externalSubjects).toEqual([SUBJECT]);
  });

  it('la sincronizaci\u00f3n es best-effort: reporta sin lanzar ni decidir nada', async () => {
    const store = crearStore();
    const { servicio, identity } = montarServicio(store);

    await expect(servicio.sincronizarDeshabilitacion([SUBJECT])).resolves.toBe(true);
    expect(identity.enabledCalls).toEqual([[SUBJECT, false]]);

    identity.fallaEnabled = new AccessProvisioningIdentityError(
      ACCESS_PROVISIONING_ERROR_CODES.unavailable,
      'No fue posible contactar con la administraci\u00f3n de identidad.',
    );

    await expect(servicio.sincronizarDeshabilitacion([SUBJECT])).resolves.toBe(false);
    // Un proveedor ca\u00eddo no desbloquea nada: el resultado es booleano y nada m\u00e1s.
    expect(store.humanAccounts).toHaveLength(0);
  });
});
