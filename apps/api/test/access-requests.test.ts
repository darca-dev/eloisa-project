/**
 * Pruebas focales de `POST /api/v1/access-requests` (SPEC 038, MP02-C1;
 * MP04 añade contraseña y preparación de identidad).
 *
 * ALCANCE: SIMULADO, sobre HTTP real. No hay PostgreSQL, ni migraciones, ni
 * fixtures reales. La SPEC 025 sigue diferida, así que este archivo NO pretende
 * demostrar aislamiento real, RLS ni comportamiento del motor: pretende
 * demostrar la decisión de la aplicación, que es determinista y no necesita base
 * de datos. Se levanta la aplicación de Nest y se habla HTTP con `supertest`
 * porque las barreras de este endpoint —origen, límite, cuerpo cerrado— ocurren
 * ANTES de llegar al servicio, y probarlas llamando al método directamente las
 * dejaría sin ejercitar.
 *
 * FIDELIDAD DE LA DOBLE: la doble de persistencia reproduce a propósito las dos
 * reglas que sostienen la idempotencia —documento único por tenant y una sola
 * solicitud ABIERTA por persona y perfil— y lanza `P2002` como lo hace Prisma.
 * Sin esa fidelidad, la prueba de repetición no probaría nada.
 *
 * LO QUE QUEDA FUERA Y DEBE CONSTAR: `patient`, `professionalProfile`,
 * `patientCaregiverRelationship` y `enrollmentSession` no se escriben nunca.
 * `humanAccount` y `externalAuthIdentity` tampoco: la preparación de identidad
 * se SUSTITUYE aquí por un doble que solo registra llamadas, porque lo que hace
 * dentro —Keycloak, `sub`, cuentas deshabilitadas, auditoría de preparación y
 * redacción del secreto— tiene su propio archivo focal
 * (`access-provisioning.test.ts`). La doble no expone esos modelos, así que una
 * escritura no autorizada fallaría por ausencia de método, y no por una
 * aserción que pudiera omitirse.
 */

import { type HttpException, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { AccessProvisioningService } from '../src/access-requests/access-provisioning.service';
import { AccessRequestsController } from '../src/access-requests/access-request.controller';
import { ACCESS_REQUEST_REFERENCE_PATTERN } from '../src/access-requests/access-request.contract';
import { AccessRequestOriginGuard } from '../src/access-requests/access-request.origin.guard';
import { AccessRequestRateLimitGuard } from '../src/access-requests/access-request.rate-limit.guard';
import { AccessRequestsService } from '../src/access-requests/access-request.service';
import { AuditService } from '../src/audit/audit.service';
import { API_ENVIRONMENT } from '../src/config/api-environment.provider';
import { PrismaService } from '../src/database/prisma.service';
import { TenantContextService } from '../src/database/tenant-context.service';

/** Identificador del tenant que resuelve el servidor. */
const TENANT_ID = '11111111-1111-4111-8111-111111111111';

/** Origen web declarado en la configuración de la prueba. */
const ALLOWED_ORIGIN = 'http://127.0.0.1:3000';

/** Fecha futura usada para probar el rechazo. Está fuera de cualquier vida útil. */
const FUTURE_DATE = '2999-01-01';

/** Cuerpo válido mínimo. Todos los datos son ficticios. */
function validBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    requestedProfile: 'PATIENT',
    documentType: 'CEDULA_CIUDADANIA',
    documentNumber: '900000001',
    givenNames: 'Ana María',
    familyNames: 'Ejemplo Ficticio',
    birthDate: '1958-04-12',
    sexGenderCode: 'FEMENINO',
    phone: '311 220 3355',
    // MP04: contraseña FICTICIA. Vive el tiempo de la llamada y se entrega a la
    // preparación de identidad; nunca se persiste ni se devuelve.
    password: 'claveFicticia7',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Doble de preparación de identidad (MP04)
// ---------------------------------------------------------------------------

/**
 * Doble de `AccessProvisioningService` que solo registra las llamadas.
 *
 * Se usa un doble y NO el servicio real porque el objeto bajo prueba en ESTE
 * archivo es la barrera pública de `POST /api/v1/access-requests`: validación,
 * origen, límite e idempotencia. Lo que ocurre dentro de la preparación —Keycloak,
 * `sub`, cuentas, auditoría de preparación— tiene su propio archivo focal. Que
 * el doble copie la firma exacta es lo que hace legible una llamada inesperada.
 */
interface ProvisioningDouble {
  readonly calls: Array<Record<string, unknown>>;
  fail: boolean;
  prepararIdentidad: (input: Record<string, unknown>, now: Date) => Promise<void>;
}

function createProvisioningDouble(): ProvisioningDouble {
  const double: ProvisioningDouble = {
    calls: [],
    fail: false,
    prepararIdentidad: async (input) => {
      double.calls.push({ ...input });
      if (double.fail) {
        throw new Error('proveedor de identidad no disponible');
      }
    },
  };

  return double;
}

// ---------------------------------------------------------------------------
// Doble de persistencia en memoria
// ---------------------------------------------------------------------------

/** Estados que el índice parcial de la migración considera abiertos. */
const OPEN_STATUSES: readonly string[] = [
  'PENDING',
  'APPROVED_PENDING_PROVISIONING',
  'PROVISIONING_FAILED',
];

/** Error con la misma forma que Prisma para una violación de unicidad. */
class FakeUniqueViolation extends Error {
  public readonly code = 'P2002';
}

type Row = Record<string, unknown>;

interface Store {
  people: Row[];
  accessRequests: Row[];
  auditEvents: Row[];
  /** Consultas recibidas, para comprobar que ninguna viaja sin tenant. */
  queries: string[];
  /** Cuando está armado, la próxima creación de solicitud falla con `P2002`. */
  failNextAccessRequestCreate: { readonly reference: string } | null;
  /** Falla toda escritura, para probar el `503` opaco. */
  failEveryWrite: boolean;
  /** Cuando está armado, la próxima escritura de auditoría falla. */
  failNextAudit: boolean;
}

function createStore(): Store {
  return {
    people: [],
    accessRequests: [],
    auditEvents: [],
    queries: [],
    failNextAccessRequestCreate: null,
    failEveryWrite: false,
    failNextAudit: false,
  };
}

function matchesRow(row: Row, where: Row): boolean {
  return Object.entries(where).every(([key, expected]) => {
    if (typeof expected === 'object' && expected !== null && 'in' in expected) {
      const permitidos = (expected as { in: readonly string[] }).in;
      return permitidos.includes(String(row[key]));
    }

    return row[key] === expected;
  });
}

function pick(row: Row, select: Row | undefined): Row {
  if (select === undefined) {
    return { ...row };
  }

  const result: Row = {};
  for (const [key, wanted] of Object.entries(select)) {
    if (wanted === true) {
      result[key] = row[key];
    }
  }

  return result;
}

function buildTransaction(store: Store, nextId: () => string) {
  return {
    person: {
      findFirst: async (args: { where: Row; select?: Row }) => {
        store.queries.push('person.findFirst');
        const found = store.people.find((row) => matchesRow(row, args.where));
        return found === undefined ? null : pick(found, args.select);
      },

      create: async (args: { data: Row; select?: Row }) => {
        store.queries.push('person.create');

        if (store.failEveryWrite) {
          throw new Error('escritura no disponible');
        }

        const duplicada = store.people.some(
          (row) =>
            row['tenantId'] === args.data['tenantId'] &&
            row['documentType'] === args.data['documentType'] &&
            row['documentNumberNormalized'] === args.data['documentNumberNormalized'],
        );

        if (duplicada) {
          throw new FakeUniqueViolation('person duplicada');
        }

        const row: Row = { id: nextId(), ...args.data };
        store.people.push(row);
        return pick(row, args.select);
      },
    },

    accessRequest: {
      findFirst: async (args: { where: Row; select?: Row }) => {
        store.queries.push('accessRequest.findFirst');
        const found = store.accessRequests.find((row) => matchesRow(row, args.where));
        return found === undefined ? null : pick(found, args.select);
      },

      create: async (args: { data: Row; select?: Row }) => {
        store.queries.push('accessRequest.create');

        if (store.failEveryWrite) {
          throw new Error('escritura no disponible');
        }

        if (store.failNextAccessRequestCreate !== null) {
          const pendiente = store.failNextAccessRequestCreate;
          store.failNextAccessRequestCreate = null;

          /*
           * El vecino ganó la carrera: su fila ya está confirmada y el índice
           * parcial rechaza esta escritura. La fila se inserta con el mismo
           * `personId` que esta transacción iba a usar, porque la `Person` es
           * compartida y solo la solicitud compite.
           */
          store.accessRequests.push({
            id: 'request-vecino',
            tenantId: args.data['tenantId'],
            personId: args.data['personId'],
            requestedProfile: args.data['requestedProfile'],
            status: 'PENDING',
            provisioningStatus: 'NOT_STARTED',
            source: 'TEST_DATA',
            reference: pendiente.reference,
            version: 1,
            submittedAt: new Date(),
          });

          throw new FakeUniqueViolation('access_request_open_per_person_profile_unique');
        }

        const abierta = store.accessRequests.some(
          (row) =>
            row['tenantId'] === args.data['tenantId'] &&
            row['personId'] === args.data['personId'] &&
            row['requestedProfile'] === args.data['requestedProfile'] &&
            OPEN_STATUSES.includes(String(row['status'])),
        );

        if (abierta) {
          throw new FakeUniqueViolation('access_request_open_per_person_profile_unique');
        }

        const row: Row = { id: nextId(), ...args.data };
        store.accessRequests.push(row);
        return pick(row, args.select);
      },
    },

    auditEvent: {
      create: async (args: { data: Row; select?: Row }) => {
        store.queries.push('auditEvent.create');

        if (store.failEveryWrite) {
          throw new Error('escritura no disponible');
        }

        if (store.failNextAudit) {
          store.failNextAudit = false;
          throw new Error('auditoría no disponible');
        }

        const row: Row = { id: nextId(), ...args.data };
        store.auditEvents.push(row);
        return pick(row, args.select);
      },
    },

    /*
     * SQL crudo acotado a las columnas del expediente (MP04-C3). La doble solo
     * entiende los dos enunciados con marcador que el servicio emite: cualquier
     * otro SQL falla, de modo que una lectura o escritura fuera de alcance no
     * pasaría en silencio.
     */
    $queryRawUnsafe: async (sql: string, ...params: unknown[]) => {
      store.queries.push('$queryRawUnsafe');

      if (typeof sql === 'string' && sql.includes('access-request snapshot read')) {
        const [id, tenantId] = params as [string, string];
        const found = store.accessRequests.find(
          (row) => row['id'] === id && row['tenantId'] === tenantId,
        );

        if (found === undefined) {
          return [];
        }

        return [
          {
            registrationSchemaVersion: found['registrationSchemaVersion'] ?? null,
            registrationData: found['registrationData'] ?? null,
          },
        ];
      }

      throw new Error('SQL no reconocido por la doble de persistencia');
    },

    $executeRawUnsafe: async (sql: string, ...params: unknown[]) => {
      store.queries.push('$executeRawUnsafe');

      if (typeof sql === 'string' && sql.includes('access-request snapshot write')) {
        if (store.failEveryWrite) {
          throw new Error('escritura no disponible');
        }

        const [data, id, tenantId] = params as [string, string, string];
        const found = store.accessRequests.find(
          (row) => row['id'] === id && row['tenantId'] === tenantId,
        );

        if (found === undefined) {
          throw new Error('fila de solicitud inexistente');
        }

        found['registrationSchemaVersion'] = 1;
        found['registrationData'] = JSON.parse(data) as unknown;

        return 1;
      }

      throw new Error('SQL no reconocido por la doble de persistencia');
    },
  };
}

function buildPrismaDouble(store: Store) {
  return {
    withTenant: async (tenantId: string, work: (tx: unknown) => Promise<unknown>) => {
      store.queries.push(`withTenant:${tenantId}`);
      let sequence = 0;
      return work(buildTransaction(store, () => `id-${(sequence += 1)}`));
    },
  };
}

// ---------------------------------------------------------------------------
// Aplicación de pruebas
// ---------------------------------------------------------------------------

interface Harness {
  app: INestApplication;
  store: Store;
  provisioning: ProvisioningDouble;
}

async function createHarness(maxRequests: number): Promise<Harness> {
  const store = createStore();
  const provisioning = createProvisioningDouble();

  const moduleRef = await Test.createTestingModule({
    controllers: [AccessRequestsController],
    providers: [
      AccessRequestsService,
      AccessRequestOriginGuard,
      AccessRequestRateLimitGuard,
      AuditService,
      { provide: PrismaService, useValue: buildPrismaDouble(store) },
      { provide: AccessProvisioningService, useValue: provisioning },
      {
        provide: TenantContextService,
        useValue: { resolveActiveTenant: async () => ({ tenantId: TENANT_ID }) },
      },
      {
        provide: API_ENVIRONMENT,
        useValue: {
          webOrigins: [ALLOWED_ORIGIN],
          enrollmentRateLimit: { maxRequests, windowSeconds: 60 },
        },
      },
    ],
  }).compile();

  const app = moduleRef.createNestApplication();
  await app.init();

  return { app, store, provisioning };
}

describe('POST /api/v1/access-requests', () => {
  let harness: Harness;

  const server = () => request(harness.app.getHttpServer());

  const enviar = (body: unknown) => server().post('/api/v1/access-requests').set('Origin', ALLOWED_ORIGIN).send(body as object);

  beforeEach(async () => {
    harness = await createHarness(1000);
  });

  afterEach(async () => {
    await harness.app.close();
  });

  // --- Creación ------------------------------------------------------------

  it('responde 202 con solo referencia, estado y origen', async () => {
    const respuesta = await enviar(validBody()).expect(202);

    expect(Object.keys(respuesta.body).sort()).toEqual(['reference', 'source', 'status']);
    expect(respuesta.body.status).toBe('PENDING');
    expect(respuesta.body.source).toBe('TEST_DATA');
    expect(respuesta.body.reference).toMatch(ACCESS_REQUEST_REFERENCE_PATTERN);

    expect(harness.store.people).toHaveLength(1);
    expect(harness.store.accessRequests).toHaveLength(1);
    expect(harness.store.accessRequests[0]?.['status']).toBe('PENDING');
    expect(harness.store.accessRequests[0]?.['provisioningStatus']).toBe('NOT_STARTED');
    expect(harness.store.accessRequests[0]?.['source']).toBe('TEST_DATA');
    expect(harness.store.accessRequests[0]?.['version']).toBe(1);
    expect(harness.store.accessRequests[0]?.['reviewedByInstitutionalIdentityId']).toBeNull();
    expect(harness.store.accessRequests[0]?.['decidedAt']).toBeNull();
    expect(harness.store.accessRequests[0]?.['provisioningReference']).toBeNull();
  });

  it('no incluye ningún dato personal ni identificador interno en la respuesta', async () => {
    const respuesta = await enviar(validBody()).expect(202);
    const serializado = JSON.stringify(respuesta.body);

    for (const secreto of [
      '900000001',
      'Ana María',
      'Ejemplo Ficticio',
      '311 220 3355',
      '1958-04-12',
      'password',
      'token',
      'session',
      'personId',
      'tenantId',
    ]) {
      expect(serializado).not.toContain(secreto);
    }
  });

  it('acepta los tres perfiles del catálogo cerrado', async () => {
    for (const [indice, requestedProfile] of [
      'PATIENT',
      'CAREGIVER',
      'FIELD_PROFESSIONAL',
    ].entries()) {
      const respuesta = await enviar(
        validBody({ documentNumber: `90000010${indice}`, requestedProfile }),
      ).expect(202);

      expect(respuesta.body.status).toBe('PENDING');
    }

    expect(harness.store.accessRequests).toHaveLength(3);
  });

  it('normaliza el documento antes de buscar a la persona', async () => {
    await enviar(validBody({ documentNumber: '900.000.001' })).expect(202);
    await enviar(validBody({ documentNumber: '900000001' })).expect(202);

    expect(harness.store.people).toHaveLength(1);
    expect(harness.store.people[0]?.['documentNumberNormalized']).toBe('900000001');
    expect(harness.store.people[0]?.['documentNumber']).toBe('900.000.001');
  });

  it('resuelve el tenant en el servidor y abre la transacción con ese tenant', async () => {
    await enviar(validBody()).expect(202);

    expect(harness.store.queries[0]).toBe(`withTenant:${TENANT_ID}`);
    expect(harness.store.people[0]?.['tenantId']).toBe(TENANT_ID);
    expect(harness.store.accessRequests[0]?.['tenantId']).toBe(TENANT_ID);
    expect(harness.store.auditEvents[0]?.['tenantId']).toBe(TENANT_ID);
  });

  it('escribe ACCESS_REQUEST_CREATED sin dato personal', async () => {
    await enviar(validBody()).expect(202);

    expect(harness.store.auditEvents).toHaveLength(1);
    const evento = harness.store.auditEvents[0]!;

    expect(evento['eventType']).toBe('ACCESS_REQUEST_CREATED');
    expect(evento['actorType']).toBe('PUBLIC_SELF_ENROLLMENT');
    expect(evento['resourceType']).toBe('AccessRequest');
    expect(evento['resourceId']).toBe(harness.store.accessRequests[0]?.['id']);
    expect(evento['outcome']).toBe('SUCCESS');
    expect(evento['endpoint']).toBe('/api/v1/access-requests');

    const serializado = JSON.stringify(evento);
    for (const secreto of [
      '900000001',
      'Ana María',
      'Ejemplo Ficticio',
      '311 220 3355',
      '1958-04-12',
    ]) {
      expect(serializado).not.toContain(secreto);
    }
  });

  it('nunca actualiza una persona existente', async () => {
    await enviar(validBody({ givenNames: 'Nombre Original' })).expect(202);
    await enviar(validBody({ givenNames: 'Nombre Distinto' })).expect(202);

    expect(harness.store.people).toHaveLength(1);
    expect(harness.store.people[0]?.['givenNames']).toBe('Nombre Original');
    expect(harness.store.queries.filter((q) => q.startsWith('person.update'))).toHaveLength(0);
  });

  // --- Idempotencia --------------------------------------------------------

  it('devuelve la misma referencia y no duplica fila ni auditoría al repetir', async () => {
    const primera = await enviar(validBody()).expect(202);
    const segunda = await enviar(validBody()).expect(202);

    expect(segunda.body).toEqual(primera.body);
    expect(harness.store.people).toHaveLength(1);
    expect(harness.store.accessRequests).toHaveLength(1);
    expect(harness.store.auditEvents).toHaveLength(1);
  });

  it('crea una solicitud distinta por perfil para la misma persona', async () => {
    const paciente = await enviar(validBody({ requestedProfile: 'PATIENT' })).expect(202);
    const cuidador = await enviar(validBody({ requestedProfile: 'CAREGIVER' })).expect(202);

    expect(cuidador.body.reference).not.toBe(paciente.body.reference);
    expect(harness.store.people).toHaveLength(1);
    expect(harness.store.accessRequests).toHaveLength(2);
    expect(harness.store.auditEvents).toHaveLength(2);
  });

  it('resuelve la carrera del índice parcial releyendo y responde igual', async () => {
    harness.store.failNextAccessRequestCreate = { reference: 'AR-00000000000000000000ABCD' };

    const respuesta = await enviar(validBody()).expect(202);

    expect(respuesta.body.reference).toBe('AR-00000000000000000000ABCD');
    expect(respuesta.body.status).toBe('PENDING');
    // La escritura perdedora no existió, así que no dejó auditoría propia.
    expect(harness.store.auditEvents).toHaveLength(0);
    expect(harness.store.accessRequests).toHaveLength(1);
  });

  it('no revela el motivo de la carrera en la respuesta', async () => {
    harness.store.failNextAccessRequestCreate = { reference: 'AR-00000000000000000000ABCD' };

    const respuesta = await enviar(validBody()).expect(202);

    expect(JSON.stringify(respuesta.body)).not.toContain('P2002');
    expect(JSON.stringify(respuesta.body)).not.toContain('access_request');
  });

  // --- Preparación de identidad (MP04) -------------------------------------

  it('prepara la identidad DESPUÉS de confirmar, con la referencia y la contraseña', async () => {
    const respuesta = await enviar(validBody()).expect(202);

    expect(harness.provisioning.calls).toHaveLength(1);
    const llamada = harness.provisioning.calls[0]!;

    expect(llamada['tenantId']).toBe(TENANT_ID);
    expect(llamada['personId']).toBe(harness.store.people[0]?.['id']);
    expect(llamada['accessRequestId']).toBe(harness.store.accessRequests[0]?.['id']);
    expect(llamada['reference']).toBe(respuesta.body.reference);
    expect(llamada['password']).toBe('claveFicticia7');

    // La solicitud nace todavía sin cuenta: la preparación es quien la enlaza.
    // El doble refleja el payload del `create`, que NUNCA escribe la columna, y
    // por eso la fila ni siquiera la tiene —en la base es NULL.
    expect(harness.store.accessRequests[0]?.['humanAccountId']).toBeUndefined();
  });

  it('repite la preparación al repetir la misma solicitud', async () => {
    await enviar(validBody()).expect(202);
    await enviar(validBody()).expect(202);

    expect(harness.provisioning.calls).toHaveLength(2);
    expect(harness.provisioning.calls[0]?.['accessRequestId']).toBe(
      harness.provisioning.calls[1]?.['accessRequestId'],
    );
    expect(harness.store.accessRequests).toHaveLength(1);
  });

  it('devuelve 503 si la preparación de identidad no está disponible', async () => {
    harness.provisioning.fail = true;

    const respuesta = await enviar(validBody()).expect(503);

    expect(respuesta.body.code).toBe('ACCESS_REQUEST_UNAVAILABLE');

    // La solicitud SÍ quedó registrada: la referencia es válida y reintentar
    // el mismo formulario reanuda la preparación pendiente.
    expect(harness.store.accessRequests).toHaveLength(1);
    expect(harness.store.accessRequests[0]?.['status']).toBe('PENDING');
  });

  it('no filtra el motivo de la preparación ni la contraseña en el 503', async () => {
    harness.provisioning.fail = true;

    const respuesta = await enviar(validBody()).expect(503);
    const serializado = JSON.stringify(respuesta.body);

    expect(serializado).not.toContain('proveedor');
    expect(serializado).not.toContain('Keycloak');
    expect(serializado).not.toContain('claveFicticia7');
    expect(serializado).not.toContain(TENANT_ID);
  });

  it('la contraseña no aparece en la auditoría escrita', async () => {
    await enviar(validBody()).expect(202);

    const serializado = JSON.stringify(harness.store.auditEvents);
    expect(serializado).not.toContain('claveFicticia7');
    expect(serializado).not.toContain('password');
  });

  // --- Cuerpo cerrado ------------------------------------------------------

  const CLAVES_PROHIBIDAS: ReadonlyArray<readonly [string, Record<string, unknown>]> = [
    ['tenant', { tenantId: 'otro-tenant' }],
    ['cuenta humana', { humanAccountId: '22222222-2222-4222-8222-222222222222' }],
    ['token', { token: 'abc' }],
    ['cookie', { cookie: 'session=1' }],
    ['identidad OIDC', { sub: 'oidc-1', roles: ['ADMIN'] }],
    ['estado y origen', { status: 'APPROVED', source: 'PRODUCTION' }],
    ['referencia', { reference: 'AR-00000000000000000000ABCD' }],
    ['versión', { version: 9 }],
    ['revisor', { reviewedBy: 'x' }],
    ['decisión', { decisionReasonCode: 'aprobada' }],
    ['aprovisionamiento', { provisioningStatus: 'COMPLETED' }],
    ['texto libre', { notes: 'comentario del cliente' }],
    ['consentimiento', { consentAccepted: true }],
    ['población', { declaredPopulations: ['HOME_CARE_REQUIRED'] }],
  ];

  it.each(CLAVES_PROHIBIDAS)(
    'rechaza con 400 la clave no declarada: %s',
    async (_etiqueta, extra) => {
      const respuesta = await enviar(validBody(extra)).expect(400);

      expect(respuesta.body.code).toBe('ACCESS_REQUEST_INVALID_BODY');
      expect([...respuesta.body.fields].sort()).toEqual(Object.keys(extra).sort());
      expect(harness.store.people).toHaveLength(0);
      expect(harness.store.accessRequests).toHaveLength(0);
      expect(harness.store.auditEvents).toHaveLength(0);
    },
  );

  const CUERPOS_INVALIDOS: ReadonlyArray<readonly [string, Record<string, unknown>]> = [
    ['perfil fuera de catálogo', { requestedProfile: 'ADMIN' }],
    ['perfil vacío', { requestedProfile: '   ' }],
    ['perfil ausente', { requestedProfile: undefined }],
    ['tipo documental inválido', { documentType: 'LICENCIA_DE_CONDUCCION' }],
    ['documento no numérico para cédula', { documentNumber: 'ABC123' }],
    ['documento vacío', { documentNumber: '' }],
    ['documento demasiado largo', { documentNumber: '9'.repeat(64) }],
    ['fecha futura', { birthDate: FUTURE_DATE }],
    ['fecha imposible', { birthDate: '2025-02-30' }],
    ['fecha con formato ajeno', { birthDate: '12/04/1958' }],
    ['nombres con dígitos', { givenNames: 'Ana 123' }],
    ['sexo fuera de catálogo', { sexGenderCode: 'NO_BINARIO' }],
    ['sin contacto', { phone: undefined, email: undefined }],
    ['solo espacios en el contacto', { phone: '   ', email: '   ' }],
    ['teléfono con letras', { phone: 'llamar al 311' }],
    ['correo mal formado', { phone: undefined, email: 'ana@@correo' }],
    ['correo no texto', { email: 42 }],
    ['contraseña ausente', { password: undefined }],
    ['contraseña vacía', { password: '' }],
    ['contraseña demasiado corta', { password: 'Ab1' }],
    ['contraseña sin dígito', { password: 'Abcdefghij' }],
    ['contraseña sin letra', { password: '1234567890' }],
    ['contraseña con espacios de control', { password: 'clave\u0000Ficticia7' }],
    ['contraseña no texto', { password: 12345678 }],
  ];

  it.each(CUERPOS_INVALIDOS)('rechaza con 400 el cuerpo inválido: %s', async (_etiqueta, extra) => {
    const respuesta = await enviar(validBody(extra)).expect(400);

    expect(respuesta.body.code).toBe('ACCESS_REQUEST_INVALID_BODY');
    expect(Array.isArray(respuesta.body.fields)).toBe(true);
    expect(harness.store.accessRequests).toHaveLength(0);
    expect(harness.store.auditEvents).toHaveLength(0);
  });

  it('acepta el correo como único contacto', async () => {
    await enviar(
      validBody({ phone: undefined, email: 'ana.ejemplo@correo.ficticio' }),
    ).expect(202);

    expect(harness.store.people[0]?.['phone']).toBeNull();
    expect(harness.store.people[0]?.['email']).toBe('ana.ejemplo@correo.ficticio');
  });

  it('rechaza con 400 un cuerpo ausente o que no es un objeto', async () => {
    await server().post('/api/v1/access-requests').set('Origin', ALLOWED_ORIGIN).expect(400);
    await server()
      .post('/api/v1/access-requests')
      .set('Origin', ALLOWED_ORIGIN)
      .send('no-es-un-objeto')
      .expect(400);
  });

  it('devuelve los nombres de campo, nunca los valores recibidos', async () => {
    const respuesta = await enviar(validBody({ documentNumber: 'ABC123' })).expect(400);

    expect(respuesta.body.fields).toEqual(['documentNumber']);
    expect(JSON.stringify(respuesta.body)).not.toContain('ABC123');
  });

  // --- Origen --------------------------------------------------------------

  it('rechaza con 403 un origen no configurado', async () => {
    const respuesta = await server()
      .post('/api/v1/access-requests')
      .set('Origin', 'https://atacante.example.test')
      .send(validBody())
      .expect(403);

    expect(respuesta.body.code).toBe('ACCESS_REQUEST_ORIGIN_REJECTED');
    expect(harness.store.accessRequests).toHaveLength(0);
  });

  it('rechaza con 403 una petición sin origen ni referer', async () => {
    const respuesta = await server()
      .post('/api/v1/access-requests')
      .send(validBody())
      .expect(403);

    expect(respuesta.body.code).toBe('ACCESS_REQUEST_ORIGIN_REJECTED');
  });

  it('rechaza con 403 un origen opaco', async () => {
    await server()
      .post('/api/v1/access-requests')
      .set('Origin', 'null')
      .send(validBody())
      .expect(403);
  });

  it('no revela la lista de orígenes configurados', async () => {
    const respuesta = await server()
      .post('/api/v1/access-requests')
      .set('Origin', 'https://atacante.example.test')
      .send(validBody())
      .expect(403);

    const serializado = JSON.stringify(respuesta.body);
    expect(serializado).not.toContain(ALLOWED_ORIGIN);
    expect(serializado).not.toContain('127.0.0.1');
    expect(respuesta.body.fields).toBeUndefined();
  });

  // --- Fallo de persistencia ----------------------------------------------

  it('traduce un fallo de persistencia a un 503 opaco', async () => {
    harness.store.failEveryWrite = true;

    const respuesta = await enviar(validBody()).expect(503);

    expect(respuesta.body.code).toBe('ACCESS_REQUEST_UNAVAILABLE');
  });

  it('no filtra detalle técnico ni tenant en el 503', async () => {
    harness.store.failEveryWrite = true;

    const respuesta = await enviar(validBody()).expect(503);
    const serializado = JSON.stringify(respuesta.body);

    expect(serializado).not.toContain('escritura no disponible');
    expect(serializado).not.toContain(TENANT_ID);
    expect(serializado).not.toContain('P2002');
  });
});

// ---------------------------------------------------------------------------
// Expediente registration (SPEC 038, MP04-C3)
// ---------------------------------------------------------------------------

/** Expediente válido de Paciente. Todos los datos son ficticios. */
function validPatientRegistration(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    necesitaApoyo: 'SI',
    apoyos: ['MOVILIZARSE', 'ACOMPANAMIENTO'],
    condiciones: ['NINGUNA'],
    zona: 'URBANA',
    eps: 'NUEVA_EPS',
    direccion: 'Cra 45 # 32-16',
    contactoNombre: 'Carlos Ejemplo',
    contactoParentesco: 'Hijo',
    contactoTelefono: '311 220 3355',
    vecinoNombre: 'Rosa Ficticia',
    vecinoTelefono: '312 778 4410',
    vecinoAutorizado: true,
    autorizaDatos: true,
    ...overrides,
  };
}

/** Expediente válido de Cuidador. Todos los datos son ficticios. */
function validCaregiverRegistration(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    tipoCuidador: 'FAMILIAR',
    tieneFormacion: 'NO',
    viveConPaciente: 'SI',
    horarios: ['MANANA', 'NOCHE'],
    pacienteRegistrado: 'NO_SABE',
    relacionPaciente: 'MADRE',
    vecinoNombre: 'Rosa Ficticia',
    vecinoTelefono: '312 778 4410',
    vecinoRelacion: 'VECINO',
    vecinoDireccion: 'Casa de al lado',
    vecinoAutorizado: true,
    autorizaDatos: true,
    ...overrides,
  };
}

/** Expediente válido de Visitador médico. Todos los datos son ficticios. */
function validProfessionalRegistration(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    profesion: 'MEDICO',
    tiposAtencion: ['VISITA_MEDICA'],
    eps: 'NUEVA_EPS',
    institucionDepartamento: 'Cundinamarca',
    institucionMunicipio: 'Soacha',
    zonaDepartamento: 'Cundinamarca',
    zonaMunicipio: 'Soacha',
    zonas: ['COMUNA_URBANA'],
    autorizaDatos: true,
    ...overrides,
  };
}

describe('expediente registration de POST /api/v1/access-requests (MP04-C3)', () => {
  let harness: Harness;

  beforeEach(async () => {
    harness = await createHarness(1000);
  });

  afterEach(async () => {
    await harness.app.close();
  });

  const enviar = (body: unknown) =>
    request(harness.app.getHttpServer())
      .post('/api/v1/access-requests')
      .set('Origin', ALLOWED_ORIGIN)
      .send(body as object);

  it('acepta el expediente y responde el 202 exacto de tres claves', async () => {
    const respuesta = await enviar(
      validBody({ registration: validPatientRegistration() }),
    ).expect(202);

    expect(Object.keys(respuesta.body).sort()).toEqual(['reference', 'source', 'status']);
    expect(respuesta.body.status).toBe('PENDING');
    expect(respuesta.body.source).toBe('TEST_DATA');
  });

  it('persiste version 1 y datos sin password en la misma transaccion', async () => {
    await enviar(validBody({ registration: validPatientRegistration() })).expect(202);

    const fila = harness.store.accessRequests[0]!;
    expect(fila['registrationSchemaVersion']).toBe(1);

    const datos = fila['registrationData'] as Record<string, unknown>;
    expect(datos['necesitaApoyo']).toBe('SI');
    expect(datos['condiciones']).toEqual(['NINGUNA']);
    expect(JSON.stringify(datos)).not.toContain('claveFicticia7');
    expect('password' in datos).toBe(false);
  });

  it('no copia el expediente ni la clave a la auditoria', async () => {
    await enviar(validBody({ registration: validPatientRegistration() })).expect(202);

    const serializado = JSON.stringify(harness.store.auditEvents);
    expect(serializado).not.toContain('claveFicticia7');
    expect(serializado).not.toContain('MOVILIZARSE');
    expect(serializado).not.toContain('Cra 45');
  });

  it('acepta las tres ramas con sus formas propias', async () => {
    await enviar(
      validBody({ requestedProfile: 'CAREGIVER', registration: validCaregiverRegistration() }),
    ).expect(202);
    await enviar(
      validBody({
        requestedProfile: 'FIELD_PROFESSIONAL',
        documentNumber: '900000002',
        registration: validProfessionalRegistration(),
      }),
    ).expect(202);

    expect(harness.store.accessRequests).toHaveLength(2);
  });

  const EXPEDIENTES_INVALIDOS: ReadonlyArray<readonly [string, Record<string, unknown>]> = [
    ['no es un objeto', { registration: 'texto' }],
    ['clave extra', { registration: validPatientRegistration({ otraClave: 1 }) }],
    ['clave de otra rama', { registration: validPatientRegistration({ tipoCuidador: 'FAMILIAR' }) }],
    [
      'password infiltrada',
      { registration: validPatientRegistration({ password: 'claveFicticia7' }) },
    ],
    ['apoyos sin necesidad declarada', { registration: validPatientRegistration({ necesitaApoyo: 'NO' }) }],
    ['apoyos vacios con necesidad', { registration: validPatientRegistration({ apoyos: [] }) }],
    [
      'NINGUNA con otras condiciones',
      { registration: validPatientRegistration({ condiciones: ['NINGUNA', 'DIABETES'] }) },
    ],
    ['zona fuera de catalogo', { registration: validPatientRegistration({ zona: 'SELVA' }) }],
    ['direccion demasiado larga', { registration: validPatientRegistration({ direccion: 'C'.repeat(121) }) }],
    ['arreglo con duplicados', { registration: validPatientRegistration({ apoyos: ['MOVILIZARSE', 'MOVILIZARSE'] }) }],
    [
      'formacion sin institucion',
      {
        requestedProfile: 'CAREGIVER',
        registration: validCaregiverRegistration({ tieneFormacion: 'SI' }),
      },
    ],
    [
      'institucion sin formacion',
      {
        requestedProfile: 'CAREGIVER',
        registration: validCaregiverRegistration({
          tieneFormacion: 'NO',
          institucionFormacion: 'SENA',
        }),
      },
    ],
    [
      'otra EPS sin nombre',
      {
        requestedProfile: 'FIELD_PROFESSIONAL',
        documentNumber: '900000003',
        registration: validProfessionalRegistration({ eps: 'OTRA_EPS' }),
      },
    ],
    [
      'nombre de otra EPS sin marca',
      {
        requestedProfile: 'FIELD_PROFESSIONAL',
        documentNumber: '900000004',
        registration: validProfessionalRegistration({ otraEps: 'EPS Ficticia' }),
      },
    ],
  ];

  it.each(EXPEDIENTES_INVALIDOS)('rechaza con 400 el expediente inválido: %s', async (_etiqueta, extra) => {
    const respuesta = await enviar(validBody(extra)).expect(400);

    expect(respuesta.body.code).toBe('ACCESS_REQUEST_INVALID_BODY');
    expect(Array.isArray(respuesta.body.fields)).toBe(true);
    expect(JSON.stringify(respuesta.body)).not.toContain('claveFicticia7');
    expect(harness.store.accessRequests).toHaveLength(0);
    expect(harness.store.auditEvents).toHaveLength(0);
  });

  it('devuelve la misma referencia al repetir el expediente identico', async () => {
    const cuerpo = validBody({ registration: validPatientRegistration() });
    const primera = await enviar(cuerpo).expect(202);
    const segunda = await enviar(cuerpo).expect(202);

    expect(segunda.body.reference).toBe(primera.body.reference);
    expect(harness.store.accessRequests).toHaveLength(1);
    expect(harness.store.auditEvents).toHaveLength(1);

    // Un solo CREATED y ningún evento de conflicto en la repetición idéntica.
    const tipos = harness.store.auditEvents.map((evento) => evento['eventType']);
    expect(tipos).toEqual(['ACCESS_REQUEST_CREATED']);
  });

  it('responde 409 opaco ante un expediente materialmente distinto', async () => {
    const primera = await enviar(
      validBody({ registration: validPatientRegistration() }),
    ).expect(202);

    const respuesta = await enviar(
      validBody({ registration: validPatientRegistration({ apoyos: ['HIGIENE'] }) }),
    ).expect(409);

    expect(respuesta.body.code).toBe('ACCESS_REQUEST_REPLAY_CONFLICT');
    expect(JSON.stringify(respuesta.body)).not.toContain(primera.body.reference);
    expect(JSON.stringify(respuesta.body)).not.toContain('Ana María');
    expect(respuesta.body.fields).toEqual([]);

    // Ni otra fila, ni expediente sobrescrito.
    expect(harness.store.accessRequests).toHaveLength(1);
    const datos = harness.store.accessRequests[0]?.['registrationData'] as Record<string, unknown>;
    expect(datos['apoyos']).toEqual(['MOVILIZARSE', 'ACOMPANAMIENTO']);
  });

  it('el conflicto agrega exactamente un evento sin PII y conserva el de creacion', async () => {
    await enviar(validBody({ registration: validPatientRegistration() })).expect(202);
    await enviar(
      validBody({ registration: validPatientRegistration({ zona: 'RURAL' }) }),
    ).expect(409);

    const tipos = harness.store.auditEvents.map((evento) => evento['eventType']);
    expect(tipos).toEqual(['ACCESS_REQUEST_CREATED', 'ACCESS_REQUEST_REPLAY_CONFLICT']);

    const conflicto = harness.store.auditEvents[1]!;
    expect(conflicto['outcome']).toBe('DENIED');
    expect(conflicto['actorType']).toBe('PUBLIC_SELF_ENROLLMENT');
    expect(conflicto['resourceType']).toBe('AccessRequest');
    expect(conflicto['resourceId']).toBe(harness.store.accessRequests[0]?.['id']);

    const serializado = JSON.stringify(conflicto);
    expect(serializado).not.toContain('Ana María');
    expect(serializado).not.toContain('900000001');
    expect(serializado).not.toContain('MOVILIZARSE');
    expect(serializado).not.toContain('claveFicticia7');
    expect(serializado).not.toContain('RURAL');
  });

  it('si la auditoria del conflicto falla, la llamada falla cerrada sin 409', async () => {
    await enviar(validBody({ registration: validPatientRegistration() })).expect(202);

    harness.store.failNextAudit = true;

    const respuesta = await enviar(
      validBody({ registration: validPatientRegistration({ zona: 'RURAL' }) }),
    ).expect(503);

    expect(respuesta.body.code).toBe('ACCESS_REQUEST_UNAVAILABLE');
    expect(JSON.stringify(respuesta.body)).not.toContain('REPLAY_CONFLICT');
    expect(harness.store.accessRequests).toHaveLength(1);
    expect(
      harness.store.auditEvents.filter(
        (evento) => evento['eventType'] === 'ACCESS_REQUEST_REPLAY_CONFLICT',
      ),
    ).toHaveLength(0);
  });

  it('responde 409 cuando el reintento agrega un expediente inexistente', async () => {
    await enviar(validBody()).expect(202);

    await enviar(validBody({ registration: validPatientRegistration() })).expect(409);

    expect(harness.store.accessRequests).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Límite de peticiones
// ---------------------------------------------------------------------------

/**
 * Contexto de ejecución mínimo para probar el guard por separado.
 *
 * Se necesita porque la aplicación de pruebas NO habilita `trust proxy`, y sin
 * él `request.ip` es siempre la dirección del socket. Probar la separación por
 * cliente con cabeceras `X-Forwarded-For` sobre esta aplicación sería teatro:
 * probaría una configuración que este despliegue no tiene.
 */
function contextoDe(ip: string) {
  return { switchToHttp: () => ({ getRequest: () => ({ ip, socket: {} }) }) } as never;
}

describe('límite de peticiones de POST /api/v1/access-requests', () => {
  let harness: Harness;

  beforeEach(async () => {
    harness = await createHarness(2);
  });

  afterEach(async () => {
    await harness.app.close();
  });

  it('devuelve 429 al superar la ventana configurada', async () => {
    const enviar = () =>
      request(harness.app.getHttpServer())
        .post('/api/v1/access-requests')
        .set('Origin', ALLOWED_ORIGIN)
        .send(validBody({ documentNumber: '900000009' }));

    await enviar().expect(202);
    await enviar().expect(202);

    const tercera = await enviar().expect(429);
    expect(tercera.body.code).toBe('ACCESS_REQUEST_RATE_LIMITED');
    expect(harness.store.accessRequests).toHaveLength(1);
  });

  it('cuenta por cliente: agotar una dirección no afecta a otra', () => {
    const guard = harness.app.get(AccessRequestRateLimitGuard);

    expect(guard.canActivate(contextoDe('203.0.113.9'))).toBe(true);
    expect(guard.canActivate(contextoDe('203.0.113.9'))).toBe(true);

    try {
      guard.canActivate(contextoDe('203.0.113.9'));
      throw new Error('debería limitar la tercera petición de la misma dirección');
    } catch (error) {
      expect((error as HttpException).getStatus()).toBe(429);
    }

    expect(guard.canActivate(contextoDe('198.51.100.4'))).toBe(true);
  });

  /*
   * ORDEN DE BARRERAS (SPEC 038, MP02-C1-C1).
   *
   * El defecto que este paquete corrige es de ORDEN, no de lógica: con la
   * comprobación de origen dentro de la acción, una página ajena agotaba el
   * cupo de una persona que comparte salida de red antes de recibir el `403`.
   * La prueba usa un cupo de 2 y tres peticiones denegadas —ajeno, ausente y
   * opaco—, de modo que solo el orden correcto puede producir los dos `202`
   * siguientes y el `429` final: si alguna denegada consumiera cupo, el tercer
   * admitting sería el que caería.
   *
   * SuperTest habla siempre desde la misma dirección, así que las peticiones
   * admitidas y las denegadas comparten contador. Eso es justo lo que hace
   * observable el defecto.
   */
  it('un origen denegado no consume el cupo de la ventana', async () => {
    const cuerpo = validBody({ documentNumber: '900000007' });

    const denegadas: ReadonlyArray<readonly [string, string | null]> = [
      ['ajeno', 'https://atacante.example.test'],
      ['ausente', null],
      ['opaco', 'null'],
    ];

    for (const [etiqueta, origen] of denegadas) {
      const peticion = request(harness.app.getHttpServer())
        .post('/api/v1/access-requests')
        .send(cuerpo);

      if (origen !== null) {
        peticion.set('Origin', origen);
      }

      const respuesta = await peticion.expect(403);

      expect(respuesta.body.code, etiqueta).toBe('ACCESS_REQUEST_ORIGIN_REJECTED');
    }

    // Ninguna denegada llegó a persistir nada.
    expect(harness.store.people).toHaveLength(0);
    expect(harness.store.accessRequests).toHaveLength(0);
    expect(harness.store.auditEvents).toHaveLength(0);

    const admitido = () =>
      request(harness.app.getHttpServer())
        .post('/api/v1/access-requests')
        .set('Origin', ALLOWED_ORIGIN)
        .send(cuerpo);

    await admitido().expect(202);
    await admitido().expect(202);
    await admitido().expect(429);
  });
});
