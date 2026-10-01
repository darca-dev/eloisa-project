/**
 * Pruebas focales de la superficie institucional de revisión de solicitudes de
 * acceso (SPEC 038 §6.4, MP03-C1).
 *
 * ALCANCE: SIMULADO, sobre HTTP real. No hay PostgreSQL, migraciones, RLS, seed
 * ni Keycloak. La SPEC 025 sigue diferida, así que este archivo NO pretende
 * demostrar el comportamiento del motor: demuestra la decisión de la aplicación,
 * que es determinista. Se levanta la aplicación de Nest y se habla HTTP con
 * `supertest` porque las barreras de esta superficie —sesión, rol exacto, origen—
 * ocurren ANTES de llegar al servicio, y probarlas llamando al método directamente
 * las dejaría sin ejercitar.
 *
 * LO QUE LA DOBLE REPRODUCE A PROPÓSITO, y no por comodidad:
 * - el aislamiento por `tenantId` en lectura, en detalle y en escritura;
 * - el `where` compuesto de la actualización optimista, de modo que la prueba de
 *   concurrencia sea real y no una simulación de `updateMany` que siempre
 *   escribiera;
 * - la ATOMICIDAD: `withTenant` toma una instantánea y la RESTAURA si el trabajo
 *   lanza. Sin esa restauración, la prueba de auditoría atómica comprobaría que
 *   el servicio pide el evento, no que la fila y el evento se escriben juntos.
 * - el `P2002`, la colisión de clave y los errores de persistencia, para que el
 *   `503` opaco se pueda provocar sin tocar el servicio.
 *
 * LO QUE QUEDA FUERA Y DEBE CONSTAR: `humanAccount`, `professionalProfile`,
 * `patient`, `patientCaregiverRelationship`, `institutionalSession` y
 * `externalAuthIdentity` NO están en la doble. Una escritura de provisión fallaría
 * por AUSENCIA de método, y no por una aserción que pudiera omitirse.
 */

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { HospitalAccessRequestReviewController } from '../src/access-requests/access-request-review.controller';
import { HospitalAccessReviewerGuard } from '../src/access-requests/access-request-review.guard';
import { AccessRequestReviewService } from '../src/access-requests/access-request-review.service';
import { AccessProvisioningService } from '../src/access-requests/access-provisioning.service';
import { AuditService } from '../src/audit/audit.service';
import { API_ENVIRONMENT } from '../src/config/api-environment.provider';
import { PrismaService } from '../src/database/prisma.service';
import { TenantContextService } from '../src/database/tenant-context.service';
import { InstitutionalSameOriginGuard } from '../src/institutional-auth/institutional-same-origin.guard';
import { InstitutionalAuthService } from '../src/institutional-auth/institutional-auth.service';

const TENANT_A = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
const TENANT_B = 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb';

const REVISOR_A = '11111111-1111-4111-8111-111111111111';
const REVISOR_B = '22222222-2222-4222-8222-222222222222';
const REVISOR_A_OTRO = '33333333-3333-4333-8333-333333333333';

const ALLOWED_ORIGIN = 'http://127.0.0.1:3000';

const TOKEN_REVISOR_A = 'token-revisor-a';
const TOKEN_REVISOR_B = 'token-revisor-b';
const TOKEN_REVISOR_A_OTRO = 'token-revisor-a-otro';
const TOKEN_MUNICIPAL = 'token-municipal';
const TOKEN_PACIENT = 'token-paciente';

type Row = Record<string, unknown>;

interface Person extends Row {
  id: string;
  tenantId: string;
  documentNumberNormalized: string;
}

interface Store {
  people: Person[];
  accessRequests: Row[];
  auditEvents: Row[];
  /** Cuentas humanas. Solo las tocan SUSPEND y REVOKE, dentro de la transacción. */
  humanAccounts: Row[];
  /** Sesiones humanas. Se revocan TODAS en la misma transacción que la decisión. */
  humanSessions: Row[];
  /** Vínculos externos. Solo los desvincula REVOKE. */
  externalIdentities: Row[];
  /** Consultas registradas, para comprobar que ninguna viaja sin tenant. */
  queries: string[];
  /** Cuando está armado, la próxima escritura de auditoría falla. */
  failNextAudit: boolean;
  /** Falla toda escritura de auditoría, para probar la atomicidad. */
  failEveryAudit: boolean;
}

function createStore(): Store {
  return {
    people: [],
    accessRequests: [],
    auditEvents: [],
    humanAccounts: [],
    humanSessions: [],
    externalIdentities: [],
    queries: [],
    failNextAudit: false,
    failEveryAudit: false,
  };
}

/* --------------------------------------------------------------------------- */
/* Doble de persistencia                                                      */
/* --------------------------------------------------------------------------- */

/**
 * Coincidencia de una fila con un `where`.
 *
 * Deliberadamente ESTRICTA: un operador o una forma de filtro que la doble no
 * conoce lanza un error en vez de devolver `true`. Una doble permisiva es peor
 * que no tener doble, porque convierte un filtro mal escrito —o mal soportado—
 * en un `200` con datos que el test lee como correctos.
 *
 * `mode: 'insensitive'` se acepta y se comprueba, porque la doble compara
 * siempre sin distinguir mayúsculas y esa es la única semántica que esta
 * superficie permite: si el servicio dejara de declararla, la comparación
 * real cambiaría sin que nada aquí lo notara.
 *
 * Resuelve SOLO las formas que el servicio emite —igualdad, `in`, `lt`,
 * `contains` con insensibilidad, `AND` y `OR`— y falla ruidosamente ante
 * cualquier otra. Una doble que aceptara un `where` desconocido en silencio
 * dejaría pasar un filtro que el servidor real no aplicaría, y la prueba
 * afirmativa sobre ella no probaría el filtro.
 */
function matchesRow(row: Row, where: Row | undefined): boolean {
  if (where === undefined) {
    return true;
  }

  return Object.entries(where).every(([key, expected]) => {
    if (key === 'AND') {
      return (expected as Row[]).every((condicion) => matchesRow(row, condicion));
    }

    if (key === 'OR') {
      return (expected as Row[]).some((condicion) => matchesRow(row, condicion));
    }

    const actual = row[key];

    if (key === 'person') {
      return matchesRow((row['person'] ?? {}) as Row, expected as Row);
    }

    /*
     * Una IGUALDAD a `Date` —`{ submittedAt: cursor.submittedAt }`— llega como
     * objeto, igual que un filtro con operadores. Si se tratara como filtro, sus
     * entradas serían cero y `every` devolvería `true` para TODA fila: la
     * comparación de fecha del cursor no estaría probando nada y una fila con
     * otra fecha pasaría por la rama del empate exacto.
     */
    if (expected instanceof Date) {
      return actual instanceof Date && actual.getTime() === expected.getTime();
    }

    if (typeof expected === 'object' && expected !== null && !Array.isArray(expected)) {
      const filtros = expected as Row;

      return Object.entries(filtros).every(([operador, valor]) => {
        if (operador === 'mode') {
          if (valor !== 'insensitive') {
            throw new Error(`modo no soportado por la doble: ${String(valor)}`);
          }

          return true;
        }

        if (operador === 'contains') {
          const haystack = String(actual ?? '').toLowerCase();
          return haystack.includes(String(valor).toLowerCase());
        }

        if (operador === 'lt') {
          if (valor instanceof Date) {
            return actual instanceof Date && actual.getTime() < valor.getTime();
          }

          return String(actual ?? '') < String(valor);
        }

        if (operador === 'in') {
          return (valor as string[]).includes(String(actual));
        }

        throw new Error(`operador no soportado por la doble: ${operador}`);
      });
    }

    return row[key] === expected;
  });
}

/** Proyección por `select`, incluidos los `select` anidados de una relación. */
function pick(row: Row, select: Row | undefined): Row {
  if (select === undefined) {
    return structuredClone(row);
  }

  const result: Row = {};

  for (const [key, wanted] of Object.entries(select)) {
    if (wanted === true) {
      result[key] = structuredClone(row[key]);
      continue;
    }

    if (typeof wanted === 'object' && wanted !== null && 'select' in wanted) {
      result[key] = pick((row[key] ?? {}) as Row, (wanted as { select: Row }).select);
    }
  }

  return result;
}

/** Orden estable `(submittedAt DESC, id DESC)`. */
function ordenar(rows: Row[]): Row[] {
  return [...rows].sort((izquierda, derecha) => {
    const fecha = (derecha['submittedAt'] as Date).getTime() - (izquierda['submittedAt'] as Date).getTime();

    if (fecha !== 0) {
      return fecha;
    }

    return String(derecha['id']).localeCompare(String(izquierda['id']));
  });
}

let secuenciaUuid = 0;

function nextUuid(): string {
  secuenciaUuid += 1;
  const sufijo = secuenciaUuid.toString(16).padStart(12, '0');

  return `00000000-0000-4000-8000-${sufijo}`;
}

function buildTransaction(store: Store) {
  return {
    accessRequest: {
      findMany: async (args: { where: Row; select?: Row; orderBy?: unknown; take?: number }) => {
        store.queries.push('accessRequest.findMany');

        const coincidencias = store.accessRequests.filter((row) => matchesRow(row, args.where));
        const ordenadas = ordenar(coincidencias);

        return ordenar(coincidencias)
          .slice(0, args.take ?? ordenadas.length)
          .map((row) => pick(row, args.select));
      },

      findFirst: async (args: { where: Row; select?: Row }) => {
        store.queries.push('accessRequest.findFirst');
        const found = store.accessRequests.find((row) => matchesRow(row, args.where));

        return found === undefined ? null : pick(found, args.select);
      },

      updateMany: async (args: { where: Row; data: Row }) => {
        store.queries.push('accessRequest.updateMany');

        const affected = store.accessRequests.filter((row) => matchesRow(row, args.where));

        for (const row of affected) {
          // Escrituras directas. Cada una es una columna que el servicio real
          // actualiza; omitir una aquí haría que una prueba leyera el valor
          // VIEJO y creyera que la escritura no ocurrió.
          const directas: readonly string[] = [
            'status',
            'decisionReasonCode',
            'provisioningStatus',
            'provisioningErrorCode',
            'humanAccountId',
          ];

          for (const campo of directas) {
            if (campo in args.data) {
              row[campo] = args.data[campo];
            }
          }

          const temporales: readonly string[] = ['decidedAt', 'provisioningStartedAt', 'provisioningLastErrorAt'];

          for (const campo of temporales) {
            if (args.data[campo] instanceof Date) {
              row[campo] = args.data[campo];
            }
          }

          if (typeof args.data['reviewedByInstitutionalIdentityId'] === 'string') {
            row['reviewedByInstitutionalIdentityId'] =
              args.data['reviewedByInstitutionalIdentityId'];
          }

          const incremento = args.data['version'] as { increment?: number } | undefined;

          if (incremento !== undefined) {
            row['version'] = (row['version'] as number) + (incremento.increment ?? 0);
          }
        }

        return { count: affected.length };
      },
    },

    auditEvent: {
      create: async (args: { data: Row; select?: Row }) => {
        store.queries.push('auditEvent.create');

        if (store.failEveryAudit || store.failNextAudit) {
          store.failNextAudit = false;
          throw new Error('auditoría no disponible');
        }

        const row: Row = { id: nextUuid(), ...args.data };
        store.auditEvents.push(row);

        return pick(row, args.select);
      },
    },

    /*
     * SQL crudo acotado al expediente (MP04-C3). Igual que en la prueba del
     * registro: solo entiende la lectura con marcador del servicio.
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

      throw new Error('SQL no reconocido por la doble de revisión');
    },
  };
}

function buildPrismaDouble(store: Store) {
  return {
    withTenant: async (tenantId: string, work: (tx: unknown) => Promise<unknown>) => {
      store.queries.push(`withTenant:${tenantId}`);

      /*
       * Instantánea y restauración. Es lo que hace que la transacción sea una
       * transacción: si el trabajo lanza, la escritura previa —incluida una
       * actualización de estado que ya se había aplicado— desaparece. Sin esto,
       * una prueba de atomicidad solo probaría que se lanzó una excepción.
       */
      const copia = {
        people: structuredClone(store.people),
        accessRequests: structuredClone(store.accessRequests),
        auditEvents: structuredClone(store.auditEvents),
        humanAccounts: structuredClone(store.humanAccounts),
        humanSessions: structuredClone(store.humanSessions),
        externalIdentities: structuredClone(store.externalIdentities),
      };

      try {
        return await work(buildTransaction(store));
      } catch (error) {
        store.people = copia.people;
        store.accessRequests = copia.accessRequests;
        store.auditEvents = copia.auditEvents;
        store.humanAccounts = copia.humanAccounts;
        store.humanSessions = copia.humanSessions;
        store.externalIdentities = copia.externalIdentities;
        throw error;
      }
    },
  };
}

/* --------------------------------------------------------------------------- */
/* Datos de partida                                                            */
/* --------------------------------------------------------------------------- */

interface Seed {
  readonly id: string;
  readonly tenantId: string;
  readonly reference: string;
  readonly requestedProfile: string;
  readonly status?: string;
  readonly provisioningStatus?: string;
  readonly provisioningAttempts?: number;
  readonly provisioningErrorCode?: string | null;
  /** `false` cuando la solicitud no llegó a preparar identidad. */
  readonly cuenta?: boolean;
  /** `true` cuando la cuenta quedó deshabilitada por una suspensión previa. */
  readonly cuentaDeshabilitada?: boolean;
  readonly version?: number;
  readonly submittedAt: string;
  readonly givenNames: string;
  readonly familyNames: string;
  readonly documentNumber: string;
  readonly documentNumberNormalized: string;
  readonly phone?: string | null;
  readonly email?: string | null;
  readonly decidedAt?: string | null;
  readonly decisionReasonCode?: string | null;
  readonly reviewedBy?: string | null;
  /** Expediente ficticio de la rama (MP04-C3). Ausente equivale a sin expediente. */
  readonly expediente?: Record<string, unknown> | null;
}

function sembrar(store: Store, semillas: readonly Seed[]): void {
  for (const semilla of semillas) {
    const personId = nextUuid();

    store.people.push({
      id: personId,
      tenantId: semilla.tenantId,
      documentType: 'CEDULA_CIUDADANIA',
      documentNumber: semilla.documentNumber,
      documentNumberNormalized: semilla.documentNumberNormalized,
      givenNames: semilla.givenNames,
      familyNames: semilla.familyNames,
      birthDate: new Date('1985-04-12T00:00:00.000Z'),
      sexGenderCode: 'FEMENINO',
      phone: semilla.phone ?? null,
      email: semilla.email ?? null,
    });

    /*
     * Casi toda solicitud ya tiene cuenta: la preparación de identidad ocurre
     * durante el REGISTRO, no durante la aprobación. Por eso las semillas PENDING
     * también la llevan, y por eso SUSPEND y REVOKE tienen algo que desactivar.
     */
    const humanAccountId = semilla.cuenta === false ? null : nextUuid();

    if (humanAccountId !== null) {
      store.humanAccounts.push({
        id: humanAccountId,
        tenantId: semilla.tenantId,
        personId,
        status: semilla.cuentaDeshabilitada === true ? 'DISABLED' : 'ACTIVE',
      });

      // Dos sesiones vivas por cuenta: el número que se revoca debe poder
      // observarse, no asumirse. Una cuenta suspendida conserva aquí sesiones
      // vivas para que REACTIVATE tenga algo que restaurar con la saga.
      store.humanSessions.push(
        { id: nextUuid(), tenantId: semilla.tenantId, humanAccountId, revokedAt: null },
        { id: nextUuid(), tenantId: semilla.tenantId, humanAccountId, revokedAt: null },
      );

      store.externalIdentities.push({
        id: nextUuid(),
        tenantId: semilla.tenantId,
        humanAccountId,
        subject: `sub-opaco-${humanAccountId.slice(0, 8)}`,
        status: 'ACTIVE',
      });
    }

    store.accessRequests.push({
      id: semilla.id,
      tenantId: semilla.tenantId,
      personId,
      requestedProfile: semilla.requestedProfile,
      status: semilla.status ?? 'PENDING',
      provisioningStatus: semilla.provisioningStatus ?? 'NOT_STARTED',
      provisioningAttempts: semilla.provisioningAttempts ?? 0,
      provisioningErrorCode: semilla.provisioningErrorCode ?? null,
      humanAccountId,
      source: 'TEST_DATA',
      reference: semilla.reference,
      version: semilla.version ?? 1,
      submittedAt: new Date(semilla.submittedAt),
      reviewedByInstitutionalIdentityId: semilla.reviewedBy ?? null,
      decidedAt:
        semilla.decidedAt === undefined || semilla.decidedAt === null
          ? null
          : new Date(semilla.decidedAt),
      decisionReasonCode: semilla.decisionReasonCode ?? null,
      provisioningReference: null,
      createdAt: new Date(semilla.submittedAt),
      updatedAt: new Date(semilla.submittedAt),
      person: structuredClone(store.people[store.people.length - 1]),
      ...(semilla.expediente === undefined || semilla.expediente === null
        ? {}
        : { registrationSchemaVersion: 1, registrationData: semilla.expediente }),
    });
  }
}

/**
 * Nueve solicitudes del tenant A.
 *
 * Las primeras cinco cubren el listado, la búsqueda y el rechazo. Las cuatro
 * siguientes existen porque MP04 añade transiciones: cada una nace YA en el
 * estado de origen que una acción nueva necesita —`APPROVED`,
 * `PROVISIONING_FAILED`, `SUSPENDED` y otra `APPROVED`— de modo que cada prueba
 * ejerza SU transición y no arrastre el estado que dejó la anterior. Todas son
 * `PATIENT` y llevan apellidos distintos de «Álvarez», para que los filtros de
 * perfil y de búsqueda sigan midiendo lo que afirman medir.
 */
const SEMILLAS_A: readonly Seed[] = [
  {
    id: 'aaaaaaa1-0000-4000-8000-000000000001',
    tenantId: TENANT_A,
    reference: 'AR-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    requestedProfile: 'PATIENT',
    submittedAt: '2026-09-01T10:00:00.000Z',
    givenNames: 'Ana María',
    familyNames: 'Álvarez Fiction',
    documentNumber: 'CC 44.556.677',
    documentNumberNormalized: '44556677',
    phone: '311 000 0001',
    email: 'ana@example.invalid',
  },
  {
    id: 'aaaaaaa1-0000-4000-8000-000000000002',
    tenantId: TENANT_A,
    reference: 'AR-BBBBBBBBBBBBBBBBBBBBBBBBBBBB',
    requestedProfile: 'CAREGIVER',
    submittedAt: '2026-09-02T10:00:00.000Z',
    givenNames: 'Bruno',
    familyNames: 'Restrepo Fiction',
    documentNumber: 'CC 2.222.222',
    documentNumberNormalized: '2222222',
    expediente: {
      tipoCuidador: 'FAMILIAR',
      tieneFormacion: 'NO',
      viveConPaciente: 'SI',
      horarios: ['MANANA'],
      pacienteRegistrado: 'NO_SABE',
      relacionPaciente: 'MADRE',
      vecinoNombre: 'Rosa Ficticia',
      vecinoTelefono: '312 778 4410',
      vecinoRelacion: 'VECINO',
      vecinoDireccion: 'Casa de al lado',
      vecinoAutorizado: true,
      autorizaDatos: true,
    },
  },
  {
    id: 'aaaaaaa1-0000-4000-8000-000000000003',
    tenantId: TENANT_A,
    reference: 'AR-CCCCCCCCCCCCCCCCCCCCCCCCCCCC',
    requestedProfile: 'FIELD_PROFESSIONAL',
    submittedAt: '2026-09-03T10:00:00.000Z',
    givenNames: 'Camila',
    familyNames: 'Soto Fiction',
    documentNumber: 'CC 3.333.333',
    documentNumberNormalized: '3333333',
  },
  {
    id: 'aaaaaaa1-0000-4000-8000-000000000004',
    tenantId: TENANT_A,
    reference: 'AR-DDDDDDDDDDDDDDDDDDDDDDDDDDDD',
    requestedProfile: 'PATIENT',
    submittedAt: '2026-09-04T10:00:00.000Z',
    givenNames: 'Diego',
    familyNames: 'Álvarez Fiction',
    documentNumber: 'CC 4.444.444',
    documentNumberNormalized: '4444444',
  },
  {
    id: 'aaaaaaa1-0000-4000-8000-000000000005',
    tenantId: TENANT_A,
    reference: 'AR-EEEEEEEEEEEEEEEEEEEEEEEEEEEE',
    requestedProfile: 'CAREGIVER',
    status: 'REJECTED',
    provisioningStatus: 'NOT_STARTED',
    version: 2,
    submittedAt: '2026-09-05T10:00:00.000Z',
    givenNames: 'Elena',
    familyNames: 'Pardo Fiction',
    documentNumber: 'CC 5.555.555',
    documentNumberNormalized: '5555555',
    decidedAt: '2026-09-06T10:00:00.000Z',
    decisionReasonCode: 'DEMO_NOT_ELIGIBLE',
    reviewedBy: REVISOR_A,
  },
  {
    id: 'aaaaaaa1-0000-4000-8000-000000000006',
    tenantId: TENANT_A,
    reference: 'AR-FFFFFFFFFFFFFFFFFFFFFFFF',
    requestedProfile: 'PATIENT',
    status: 'APPROVED',
    provisioningStatus: 'SUCCEEDED',
    version: 3,
    submittedAt: '2026-08-01T10:00:00.000Z',
    givenNames: 'Felipe',
    familyNames: 'Gómez Fiction',
    documentNumber: 'CC 6.666.666',
    documentNumberNormalized: '6666666',
    decidedAt: '2026-08-02T10:00:00.000Z',
    decisionReasonCode: 'DEMO_ELIGIBLE',
    reviewedBy: REVISOR_A,
  },
  {
    id: 'aaaaaaa1-0000-4000-8000-000000000007',
    tenantId: TENANT_A,
    reference: 'AR-111111111111111111111111',
    requestedProfile: 'PATIENT',
    status: 'PROVISIONING_FAILED',
    provisioningStatus: 'FAILED',
    provisioningAttempts: 1,
    provisioningErrorCode: 'UNAVAILABLE',
    version: 2,
    submittedAt: '2026-08-02T10:00:00.000Z',
    givenNames: 'Gina',
    familyNames: 'Herrera Fiction',
    documentNumber: 'CC 7.777.777',
    documentNumberNormalized: '7777777',
    decidedAt: '2026-08-03T10:00:00.000Z',
    decisionReasonCode: 'DEMO_ELIGIBLE',
    reviewedBy: REVISOR_A,
  },
  {
    id: 'aaaaaaa1-0000-4000-8000-000000000008',
    tenantId: TENANT_A,
    reference: 'AR-222222222222222222222222',
    requestedProfile: 'PATIENT',
    status: 'SUSPENDED',
    provisioningStatus: 'SUCCEEDED',
    version: 4,
    cuentaDeshabilitada: true,
    submittedAt: '2026-08-03T10:00:00.000Z',
    givenNames: 'Hugo',
    familyNames: 'Ibáñez Fiction',
    documentNumber: 'CC 8.888.888',
    documentNumberNormalized: '8888888',
    decidedAt: '2026-08-04T10:00:00.000Z',
    decisionReasonCode: 'DEMO_ACCESS_SUSPENDED',
    reviewedBy: REVISOR_A,
  },
  {
    id: 'aaaaaaa1-0000-4000-8000-000000000009',
    tenantId: TENANT_A,
    reference: 'AR-333333333333333333333333',
    requestedProfile: 'PATIENT',
    status: 'APPROVED',
    provisioningStatus: 'SUCCEEDED',
    version: 3,
    submittedAt: '2026-08-04T10:00:00.000Z',
    givenNames: 'Irene',
    familyNames: 'Jaramillo Fiction',
    documentNumber: 'CC 1.010.101',
    documentNumberNormalized: '1010101',
    decidedAt: '2026-08-05T10:00:00.000Z',
    decisionReasonCode: 'DEMO_ELIGIBLE',
    reviewedBy: REVISOR_A,
  },
];

const SEMILLA_B: Seed = {
  id: '22222222-0000-4000-8000-000000000001',
  tenantId: TENANT_B,
  reference: 'AR-ZZZZZZZZZZZZZZZZZZZZZZZZZZZZ',
  requestedProfile: 'PATIENT',
  submittedAt: '2026-09-01T09:00:00.000Z',
  givenNames: 'Zulma',
  familyNames: 'Ajena Fiction',
  documentNumber: 'CC 9.999.999',
  documentNumberNormalized: '9999999',
};

/* --------------------------------------------------------------------------- */
/* Aplicación de pruebas                                                       */
/* --------------------------------------------------------------------------- */

interface Harness {
  app: INestApplication;
  store: Store;
  provisioning: ProvisioningDouble;
}

const PRINCIPALES: Record<string, { role: string; identityId: string; tenantId: string }> = {
  [TOKEN_REVISOR_A]: { role: 'HOSPITAL_ACCESS_REVIEWER', identityId: REVISOR_A, tenantId: TENANT_A },
  [TOKEN_REVISOR_A_OTRO]: {
    role: 'HOSPITAL_ACCESS_REVIEWER',
    identityId: REVISOR_A_OTRO,
    tenantId: TENANT_A,
  },
  [TOKEN_REVISOR_B]: { role: 'HOSPITAL_ACCESS_REVIEWER', identityId: REVISOR_B, tenantId: TENANT_B },
  [TOKEN_MUNICIPAL]: { role: 'MUNICIPAL_VIEWER', identityId: REVISOR_A, tenantId: TENANT_A },
  [TOKEN_PACIENT]: { role: 'HOSPITAL_PATIENT_VIEWER', identityId: REVISOR_A, tenantId: TENANT_A },
};

/* --------------------------------------------------------------------------- */
/* Doble de la saga de provisión (MP04)                                        */
/* --------------------------------------------------------------------------- */

/**
 * Doble de `AccessProvisioningService` que aplica sobre la doble de persistencia
 * EXACTAMENTE los efectos de base que el servicio real produce.
 *
 * No es un doble que «siempre tiene razón»: reproduce la doble partición que
 * sostiene la saga —la transición es de la decisión, el cierre es de la
 * provisión, y los DOS escriben `version`— y reproduce los dos desenlaces
 * legítimos, `APPROVED` y `PROVISIONING_FAILED`. Sin eso, ninguna prueba de
 * esta superficie podría afirmar que una aprobación terminó, que un reintento
 * recupera o que una versión se mueve dos veces.
 *
 * Lo que NO reproduce es la llamada HTTP a Keycloak ni la redacción de la
 * contraseña: eso pertenece a `access-provisioning.test.ts`.
 */
interface ProvisioningDouble {
  /** `true` en la próxima provisión: fuerza `PROVISIONING_FAILED`. */
  failNext: boolean;
  /** `true` en la próxima sincronización externa: fuerza un fallo best-effort. */
  failSync: boolean;
  readonly aprovisionarCalls: string[];
  readonly syncCalls: readonly string[][];
  aprovisionar: (
    input: { tenantId: string; accessRequestId: string; endpoint: string },
    now: Date,
  ) => Promise<{ status: string; provisioningStatus: string }>;
  desactivarCuentaWithin: (
    tx: unknown,
    input: { tenantId: string; humanAccountId: string; unlinkIdentity: boolean },
    now: Date,
  ) => Promise<{ sessionsRevoked: boolean; externalSubjects: readonly string[] }>;
  sincronizarDeshabilitacion: (subjects: readonly string[]) => Promise<boolean>;
  prepararIdentidad: (input: Record<string, unknown>, now: Date) => Promise<void>;
}

function createProvisioningDouble(store: Store): ProvisioningDouble {
  const double: ProvisioningDouble = {
    failNext: false,
    failSync: false,
    aprovisionarCalls: [],
    syncCalls: [],

    aprovisionar: async ({ tenantId, accessRequestId }) => {
      double.aprovisionarCalls.push(accessRequestId);

      const fila = store.accessRequests.find(
        (row) => row['id'] === accessRequestId && row['tenantId'] === tenantId,
      );

      if (fila === undefined) {
        throw new Error('la solicitud a aprovisionar no existe en el tenant');
      }

      fila['provisioningAttempts'] = (fila['provisioningAttempts'] as number) + 1;

      if (double.failNext) {
        double.failNext = false;
        fila['status'] = 'PROVISIONING_FAILED';
        fila['provisioningStatus'] = 'FAILED';
        fila['provisioningErrorCode'] = 'UNAVAILABLE';
        fila['version'] = (fila['version'] as number) + 1;

        // Un proveedor que no confirma deja la cuenta CERRADA: entre una
        // aprobación que no terminó y un acceso abierto, la puerta es la que
        // se cierra. El reintento es quien vuelve a abrirla.
        const cuenta = store.humanAccounts.find((row) => row['id'] === fila['humanAccountId']);

        if (cuenta !== undefined) {
          cuenta['status'] = 'DISABLED';
        }

        store.auditEvents.push({
          id: nextUuid(),
          tenantId,
          eventType: 'ACCESS_PROVISIONING_FAILED',
          outcome: 'FAILURE',
          resourceType: 'AccessRequest',
          resourceId: accessRequestId,
        });
        return { status: 'PROVISIONING_FAILED', provisioningStatus: 'FAILED' };
      }

      fila['status'] = 'APPROVED';
      fila['provisioningStatus'] = 'SUCCEEDED';
      fila['provisioningErrorCode'] = null;
      fila['version'] = (fila['version'] as number) + 1;

      // Reactivar no es solo cambiar el estado de la solicitud: la saga reabre
      // la cuenta, que es lo que el `SUSPEND` anterior cerró.
      const cuenta = store.humanAccounts.find((row) => row['id'] === fila['humanAccountId']);

      if (cuenta !== undefined) {
        cuenta['status'] = 'ACTIVE';
      }

      store.auditEvents.push({
        id: nextUuid(),
        tenantId,
        eventType: 'ACCESS_PROVISIONING_SUCCEEDED',
        outcome: 'SUCCESS',
        resourceType: 'AccessRequest',
        resourceId: accessRequestId,
      });

      return { status: 'APPROVED', provisioningStatus: 'SUCCEEDED' };
    },

    desactivarCuentaWithin: async (
      _tx,
      { tenantId, humanAccountId, unlinkIdentity },
      now,
    ) => {
      const cuenta = store.humanAccounts.find(
        (row) => row['id'] === humanAccountId && row['tenantId'] === tenantId,
      );

      if (cuenta !== undefined) {
        cuenta['status'] = 'DISABLED';
      }

      const vivas = store.humanSessions.filter(
        (row) => row['humanAccountId'] === humanAccountId && row['revokedAt'] === null,
      );

      for (const sesion of vivas) {
        sesion['revokedAt'] = now;
      }

      const subjects: string[] = [];

      if (unlinkIdentity) {
        for (const vinculo of store.externalIdentities) {
          if (vinculo['humanAccountId'] === humanAccountId) {
            vinculo['status'] = 'UNLINKED';
            subjects.push(String(vinculo['subject'] ?? 'sub-opaco'));
          }
        }
      }

      return { sessionsRevoked: vivas.length > 0, externalSubjects: subjects };
    },

    sincronizarDeshabilitacion: async (subjects) => {
      (double.syncCalls as string[][]).push([...subjects]);
      return !double.failSync;
    },

    prepararIdentidad: async () => {
      // La preparación ocurrió en el registro, que este archivo no ejercita.
    },
  };

  return double;
}

async function createHarness(): Promise<Harness> {
  const store = createStore();
  sembrar(store, SEMILLAS_A);
  sembrar(store, [SEMILLA_B]);
  const provisioning = createProvisioningDouble(store);

  const moduleRef = await Test.createTestingModule({
    controllers: [HospitalAccessRequestReviewController],
    providers: [
      AccessRequestReviewService,
      HospitalAccessReviewerGuard,
      InstitutionalSameOriginGuard,
      AuditService,
      { provide: PrismaService, useValue: buildPrismaDouble(store) },
      { provide: AccessProvisioningService, useValue: provisioning },
      /*
       * El guard resuelve el tenant de la traza de un `401` por AQUÍ, no por la
       * petición. La doble devuelve siempre el tenant configurado, y las pruebas
       * comprueban que una cabecera que intenta elegir tenant no cambia el
       * resultado: es la forma de demostrar que la atribución no la elige el
       * cliente.
       */
      {
        provide: TenantContextService,
        useValue: {
          resolveActiveTenant: async () => ({ tenantId: TENANT_A, tenantCode: 'ALCALDIA_PRUEBA' }),
        },
      },
      {
        provide: InstitutionalAuthService,
        useValue: {
          validate: async (token: string | null) => {
            if (token === null) {
              return null;
            }

            const principal = PRINCIPALES[token];

            return principal === undefined
              ? null
              : {
                  sessionId: `session-${token}`,
                  identityId: principal.identityId,
                  tenantId: principal.tenantId,
                  role: principal.role,
                };
          },
        },
      },
      {
        provide: API_ENVIRONMENT,
        useValue: {
          webOrigins: [ALLOWED_ORIGIN],
          enrollmentRateLimit: { maxRequests: 1000, windowSeconds: 60 },
        },
      },
    ],
  }).compile();

  const app = moduleRef.createNestApplication();
  await app.init();

  return { app, store, provisioning };
}

describe('superficie institucional de revisión de solicitudes (SPEC 038 MP03-C1/MP04)', () => {
  let harness: Harness;

  const server = () => request(harness.app.getHttpServer());

  const como = (token: string) => (peticion: request.Test) => peticion.set('Cookie', `merdn_institutional_session=${token}`);

  const list = (token: string, query = '') =>
    como(token)(server().get(`/api/v1/hospital/access-requests${query}`));

  const detalle = (token: string, id: string) => como(token)(server().get(`/api/v1/hospital/access-requests/${id}`));

  const decision = (token: string, id: string, body: unknown, origin: string | null = ALLOWED_ORIGIN) => {
    const peticion = como(token)(
      server().post(`/api/v1/hospital/access-requests/${id}/decision`).send(body as object),
    );

    return origin === null ? peticion : peticion.set('Origin', origin);
  };

  const eventosDe = (tipo: string): Row[] =>
    harness.store.auditEvents.filter((row) => row['eventType'] === tipo);

  /*
   * Puentes hacia la cuenta humana que una decisión desactiva.
   *
   * Se resuelven DESDE la solicitud, no se toman prestadas del seed: así, si la
   * decisión dejara de leer `humanAccountId` —o la semilla dejara de
   * tenerla—, estas consultas fallarían en lugar de seguir dando una cuenta
   * que ya no tiene nada que ver con lo que se está probando.
   */
  const humanAccountIdDe = (requestId: string): unknown =>
    harness.store.accessRequests.find((row) => row['id'] === requestId)?.['humanAccountId'];

  const cuentaDe = (requestId: string): Row | undefined =>
    harness.store.humanAccounts.find((row) => row['id'] === humanAccountIdDe(requestId));

  /** Estado de cada sesión de la cuenta: `null` significa «todavía viva». */
  const sesionesDe = (requestId: string): (string | null)[] =>
    harness.store.humanSessions
      .filter((row) => row['humanAccountId'] === humanAccountIdDe(requestId))
      .map((row) => (row['revokedAt'] instanceof Date ? row['revokedAt'].toISOString() : null));

  const vinculosDe = (requestId: string): unknown[] =>
    harness.store.externalIdentities
      .filter((row) => row['humanAccountId'] === humanAccountIdDe(requestId))
      .map((row) => row['status']);

  beforeEach(async () => {
    harness = await createHarness();
  });

  afterEach(async () => {
    await harness.app.close();
  });

  // --- Rol exacto y sesión ---------------------------------------------------

  it('401 sin sesión: audita el intento sin atribuir actor y sin tocar el backlog', async () => {
    const respuesta = await server()
      .get('/api/v1/hospital/access-requests?q=Ana&limit=5000')
      .expect(401);

    expect(respuesta.body.code).toBe('INSTITUTIONAL_SESSION_REQUIRED');

    // Auditar el intento no es un pretexto para consultar el backlog: un `401`
    // que leyera filas para poder registrar la denegación ya habría revelado que
    // la superficie tiene algo que leer.
    expect(harness.store.queries).not.toContain('accessRequest.findMany');
    expect(harness.store.queries).not.toContain('accessRequest.findFirst');

    const denegaciones = eventosDe('ACCESS_REQUEST_LIST_DENIED');

    expect(denegaciones).toHaveLength(1);

    const evento = denegaciones[0]!;

    // Sin identidad demostrada no se inventa una: actor y rol NULOS.
    expect(evento['actorType']).toBe('UNAUTHENTICATED');
    expect(evento['actorUserId']).toBeNull();
    expect(evento['actorRole']).toBeNull();
    expect(evento['outcome']).toBe('DENIED');
    expect(evento['resourceId']).toBeNull();
    expect(evento['tenantId']).toBe(TENANT_A);
    expect(evento['endpoint']).toBe('GET /api/v1/hospital/access-requests');
    expect(evento['correlationId']).toBe('sin-correlacion');

    // Ni el término buscado, ni los filtros, ni el límite, ni datos personales.
    const traza = JSON.stringify(evento);

    expect(traza).not.toContain('Ana');
    expect(traza).not.toContain('44556677');
    expect(traza).not.toContain('CC 44.556.677');
    expect(traza).not.toContain('AR-');
    expect(traza).not.toContain('5000');

    // Y la respuesta tampoco dice qué se quiso ver.
    expect(JSON.stringify(respuesta.body)).not.toContain('Ana');
  });

  it('401 con cookie ajena al formato institucional o token inválido: el mismo evento, sin credenciales', async () => {
    await server()
      .get('/api/v1/hospital/access-requests')
      .set('Cookie', 'merdn_enrollment_session=valor-de-otra-superficie')
      .expect(401);

    await como('token-que-no-existe')(
      server().get('/api/v1/hospital/access-requests'),
    ).expect(401);

    const denegaciones = eventosDe('ACCESS_REQUEST_LIST_DENIED');

    expect(denegaciones).toHaveLength(2);

    for (const evento of denegaciones) {
      expect(evento['actorType']).toBe('UNAUTHENTICATED');
      expect(evento['actorUserId']).toBeNull();
      expect(evento['actorRole']).toBeNull();
      expect(evento['outcome']).toBe('DENIED');
    }

    // Ni la cookie de otra superficie ni el token recibido quedan en la traza.
    const trazas = JSON.stringify(denegaciones);

    expect(trazas).not.toContain('merdn_enrollment_session');
    expect(trazas).not.toContain('valor-de-otra-superficie');
    expect(trazas).not.toContain('token-que-no-existe');
  });

  it('el tenant de la traza sale de la configuración, no de una cabecera del cliente', async () => {
    await server()
      .get('/api/v1/hospital/access-requests')
      .set('X-Tenant-Id', TENANT_B)
      .set('X-Request-Id', 'correlacion-de-prueba')
      .expect(401);

    const evento = eventosDe('ACCESS_REQUEST_LIST_DENIED')[0]!;

    expect(evento['tenantId']).toBe(TENANT_A);
    expect(harness.store.queries).toContain(`withTenant:${TENANT_A}`);
    expect(harness.store.queries).not.toContain(`withTenant:${TENANT_B}`);
    // La correlación sí se acepta cuando tiene forma admisible, y se sustituye
    // cuando no la tiene: nunca se copia una cadena libre en la traza.
    expect(evento['correlationId']).toBe('correlacion-de-prueba');
  });

  it('si la auditoría del intento anónimo falla, el 401 sigue siendo el mismo', async () => {
    harness.store.failEveryAudit = true;

    const respuesta = await server().get('/api/v1/hospital/access-requests').expect(401);

    expect(respuesta.body.code).toBe('INSTITUTIONAL_SESSION_REQUIRED');
    expect(harness.store.auditEvents).toHaveLength(0);
  });

  it('403 para cada rol que no es el revisor, y audita la denegación sin PII', async () => {
    for (const token of [TOKEN_MUNICIPAL, TOKEN_PACIENT]) {
      const respuesta = await list(token).expect(403);

      expect(respuesta.body.code).toBe('ACCESS_REQUEST_REVIEW_FORBIDDEN');
      // La denegación no revela que existen solicitudes ni cuántas.
      expect(JSON.stringify(respuesta.body)).not.toContain('AR-');
    }

    const denegaciones = eventosDe('ACCESS_REQUEST_LIST_DENIED');

    expect(denegaciones).toHaveLength(2);

    for (const evento of denegaciones) {
      // Aquí sí hay identidad, y es la REAL: la que salió de la sesión validada.
      expect(evento['actorType']).toBe('INSTITUTIONAL_IDENTITY');
      expect(evento['actorUserId']).toBe(REVISOR_A);
      expect(evento['outcome']).toBe('DENIED');
      expect(evento['resourceId']).toBeNull();
      expect(evento['endpoint']).toBe('GET /api/v1/hospital/access-requests');
      expect(JSON.stringify(evento)).not.toContain('Ana María');
      expect(JSON.stringify(evento)).not.toContain('44556677');
    }

    /*
     * El ROL es lo que distingue un intento del otro, porque en esta doble los
     * dos tokens prohibidos comparten identidad a propósito —para que la prueba
     * no pueda pasar por el actor—. Por eso se compara la lista de roles
     * enteros, en orden: una aserción que derivara el rol esperado del propio
     * evento compararía el valor consigo mismo y no probaría nada.
     */
    expect(denegaciones.map((evento) => evento['actorRole'])).toEqual([
      'MUNICIPAL_VIEWER',
      'HOSPITAL_PATIENT_VIEWER',
    ]);

    expect(harness.store.queries).not.toContain('accessRequest.findMany');
  });

  it('el revisor de otro rol no gana ninguna escritura aunque conozca el identificador', async () => {
    await list(TOKEN_PACIENT, `?q=Ana`).expect(403);
    await detalle(TOKEN_PACIENT, SEMILLAS_A[0]!.id).expect(403);
    await decision(TOKEN_PACIENT, SEMILLAS_A[0]!.id, {
      action: 'APPROVE',
      expectedVersion: 1,
      reasonCode: 'DEMO_ELIGIBLE',
    }).expect(403);

    expect(harness.store.accessRequests[0]?.['status']).toBe('PENDING');
  });

  // --- Listado: minimización y orden ----------------------------------------

  it('devuelve solo los ocho campos del item y nada del detalle', async () => {
    const respuesta = await list(TOKEN_REVISOR_A).expect(200);

    expect(respuesta.body.items).toHaveLength(9);

    for (const item of respuesta.body.items) {
      expect(Object.keys(item).sort()).toEqual([
        'familyNames',
        'givenNames',
        'reference',
        'requestId',
        'requestedProfile',
        'status',
        'submittedAt',
        'version',
      ]);
    }

    const serializado = JSON.stringify(respuesta.body);

    for (const prohibido of [
      TENANT_A,
      '44556677',
      'CC 44.556.677',
      '311 000 0001',
      'ana@example.invalid',
      '1985-04-12',
      'personId',
      'tenantId',
      'provisioningStatus',
      'decisionReasonCode',
      'documentNumber',
    ]) {
      expect(serializado).not.toContain(prohibido);
    }
  });

  it('ordena por fecha descendente con desempate estable e idempotente', async () => {
    const primera = await list(TOKEN_REVISOR_A).expect(200);
    const segunda = await list(TOKEN_REVISOR_A).expect(200);

    const orden = primera.body.items.map((item: Row) => item['reference']);

    expect(orden).toEqual([
      'AR-EEEEEEEEEEEEEEEEEEEEEEEEEEEE',
      'AR-DDDDDDDDDDDDDDDDDDDDDDDDDDDD',
      'AR-CCCCCCCCCCCCCCCCCCCCCCCCCCCC',
      'AR-BBBBBBBBBBBBBBBBBBBBBBBBBBBB',
      'AR-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      'AR-333333333333333333333333',
      'AR-222222222222222222222222',
      'AR-111111111111111111111111',
      'AR-FFFFFFFFFFFFFFFFFFFFFFFF',
    ]);
    expect(segunda.body.items.map((item: Row) => item['reference'])).toEqual(orden);
  });

  it('pagina con cursor sin repetir ni perder filas', async () => {
    const vistas: string[] = [];
    let cursor: string | null = null;
    let paginas = 0;

    do {
      const query = cursor === null ? '?limit=4' : `?limit=4&cursor=${encodeURIComponent(cursor)}`;
      const pagina = await list(TOKEN_REVISOR_A, query).expect(200);

      for (const item of pagina.body.items as Row[]) {
        vistas.push(String(item['requestId']));
      }

      cursor = pagina.body.nextCursor as string | null;
      paginas += 1;
      expect(paginas).toBeLessThan(10);
    } while (cursor !== null);

    expect(paginas).toBe(3);
    expect(new Set(vistas).size).toBe(9);
    expect(vistas).toHaveLength(9);
  });

  it('el cursor se combina con la búsqueda en vez de anularla', async () => {
    const conFiltro = await list(TOKEN_REVISOR_A, '?q=Álvarez').expect(200);

    expect(conFiltro.body.items).toHaveLength(2);

    const conFiltroYPagina = await list(TOKEN_REVISOR_A, '?q=Álvarez&limit=1').expect(200);

    expect(conFiltroYPagina.body.items).toHaveLength(1);
    expect(conFiltroYPagina.body.nextCursor).toEqual(expect.any(String));

    const siguiente = await list(
      TOKEN_REVISOR_A,
      `?q=Álvarez&limit=1&cursor=${encodeURIComponent(conFiltroYPagina.body.nextCursor)}`,
    ).expect(200);

    expect(siguiente.body.items).toHaveLength(1);
    expect(siguiente.body.nextCursor).toBeNull();
    expect(siguiente.body.items[0].requestId).not.toBe(conFiltroYPagina.body.items[0].requestId);
  });

  it('busca por referencia, nombres y documento en sus dos formas, solo dentro del tenant', async () => {
    const porReferencia = await list(TOKEN_REVISOR_A, '?q=BBBB').expect(200);
    expect(porReferencia.body.items).toHaveLength(1);
    expect(porReferencia.body.items[0].requestId).toBe(SEMILLAS_A[1]!.id);

    const porNombre = await list(TOKEN_REVISOR_A, '?q=camila').expect(200);
    expect(porNombre.body.items).toHaveLength(1);
    expect(porNombre.body.items[0].requestId).toBe(SEMILLAS_A[2]!.id);

    // Documento ya normalizado: es la forma con la que se guarda.
    const porDocumento = await list(TOKEN_REVISOR_A, '?q=4444444').expect(200);
    expect(porDocumento.body.items).toHaveLength(1);
    expect(porDocumento.body.items[0].requestId).toBe(SEMILLAS_A[3]!.id);

    /*
     * Documento CON separadores de formato, que es como se dicta y se teclea.
     * `44556677` es lo que se guarda y `44.556.677` es lo que el revisor escribe:
     * sin derivar la variante documental en el servidor, esta búsqueda —la más
     * natural de todas— devolvería vacío y parecería que el documento no existe.
     */
    const porDocumentoSeparado = await list(TOKEN_REVISOR_A, '?q=44.556.677').expect(200);
    expect(porDocumentoSeparado.body.items).toHaveLength(1);
    expect(porDocumentoSeparado.body.items[0].requestId).toBe(SEMILLAS_A[0]!.id);

    const porDocumentoConGuiones = await list(TOKEN_REVISOR_A, '?q=44-556-677').expect(200);
    expect(porDocumentoConGuiones.body.items).toHaveLength(1);
    expect(porDocumentoConGuiones.body.items[0].requestId).toBe(SEMILLAS_A[0]!.id);

    // Documento DECLARADO, con el prefijo de tipo tal como lo escribió la persona.
    const porDocumentoDeclarado = await list(
      TOKEN_REVISOR_A,
      `?q=${encodeURIComponent('CC 44.556.677')}`,
    ).expect(200);
    expect(porDocumentoDeclarado.body.items).toHaveLength(1);
    expect(porDocumentoDeclarado.body.items[0].requestId).toBe(SEMILLAS_A[0]!.id);

    // Un término que solo existe en el otro tenant no devuelve nada.
    const ajeno = await list(TOKEN_REVISOR_A, '?q=Zulma').expect(200);
    expect(ajeno.body.items).toHaveLength(0);

    // Y desde el otro tenant, su propia solicitud sigue siendo suya.
    const propia = await list(TOKEN_REVISOR_B).expect(200);
    expect(propia.body.items).toHaveLength(1);
    expect(propia.body.items[0].requestId).toBe(SEMILLA_B.id);
  });

  it('busca el documento normalizado en la persona correcta, no en cualquier fila del tenant', async () => {
    // El documento normalizado de la persona del tenant B no se encuentra desde
    // el tenant A aunque ambos compartan el mismo valor buscado: la búsqueda
    // documental no puede ser la puerta de atrás del aislamiento.
    const delOtroTenant = await list(TOKEN_REVISOR_A, '?q=9999999').expect(200);
    expect(delOtroTenant.body.items).toHaveLength(0);

    const propia = await list(TOKEN_REVISOR_B, '?q=9.999.999').expect(200);
    expect(propia.body.items).toHaveLength(1);
    expect(propia.body.items[0].requestId).toBe(SEMILLA_B.id);
  });

  it('filtra por estado y por perfil contra el catálogo cerrado', async () => {
    const porPerfil = await list(TOKEN_REVISOR_A, '?profile=CAREGIVER').expect(200);
    expect(porPerfil.body.items.map((item: Row) => item['status']).sort()).toEqual([
      'PENDING',
      'REJECTED',
    ]);

    const porEstado = await list(TOKEN_REVISOR_A, '?status=PENDING').expect(200);
    expect(porEstado.body.items.every((item: Row) => item['status'] === 'PENDING')).toBe(true);

    const estadoNoCatalogo = await list(TOKEN_REVISOR_A, '?status=APPROVED').expect(400);
    expect(estadoNoCatalogo.body.code).toBe('ACCESS_REQUEST_REVIEW_INVALID_REQUEST');
    expect(estadoNoCatalogo.body.fields).toEqual(['status']);
  });

  it('rechaza parámetros desconocidos, repetidos, fuera de rango y cursores alterados', async () => {
    await list(TOKEN_REVISOR_A, '?statuss=PENDING').expect(400);
    await list(TOKEN_REVISOR_A, '?limit=0').expect(400);
    await list(TOKEN_REVISOR_A, '?limit=51').expect(400);
    await list(TOKEN_REVISOR_A, '?limit=abc').expect(400);
    await list(TOKEN_REVISOR_A, '?limit=1&limit=5').expect(400);
    await list(TOKEN_REVISOR_A, `?q=${'a'.repeat(81)}`).expect(400);
    await list(TOKEN_REVISOR_A, '?cursor=!!!').expect(400);

    const alterado = Buffer.from('2026-09-01T10:00:00.000Z|no-es-un-uuid', 'utf8').toString('base64url');
    await list(TOKEN_REVISOR_A, `?cursor=${encodeURIComponent(alterado)}`).expect(400);
  });

  /*
   * El cursor se valida contra la FORMA EXACTA que emite el servidor. Antes se
   * leían los dos primeros segmentos y se ignoraba el resto, y la fecha solo
   * necesitaba ser parseable: tres textos distintos para el mismo instante pasaban
   * como si los hubiera emitido el servidor. Cada caso de esta lista es una forma
   * que `encodeAccessRequestReviewCursor` NO puede producir, y todas deben ser un
   * `400` opaco en lugar de una página que empieza donde el cliente no pidió.
   */
  it('rechaza todo cursor que el servidor no pudo emitir', async () => {
    const fila = SEMILLAS_A[0]!;

    const idVálido = fila.id;
    const marcaCanónica = '2026-09-01T10:00:00.000Z';

    const noProducidos: readonly string[] = [
      // Un tercer segmento con OTRA fila dentro.
      `${marcaCanónica}|${idVálido}|${SEMILLAS_A[1]!.id}`,
      // Un segmento de más, vacío, que no alteraría el resultado pero tampoco
      // es una forma que el emisor produzca.
      `${marcaCanónica}|${idVálido}|`,
      // Sin milisegundos: mismo instante, texto distinto.
      `2026-09-01T10:00:00Z|${idVálido}`,
      // Con desplazamiento: el mismo instante escrito de otra manera.
      `2026-09-01T12:00:00+02:00|${idVálido}`,
      // Solo la fecha, sin hora: es un instante distinto al que se emitió.
      `2026-09-01|${idVálido}`,
      // Orden invertido: la fila y la fecha en el orden que el emisor no usa.
      `${idVálido}|${marcaCanónica}`,
      // Identificador en mayúsculas: el mismo UUID, pero no es la forma que
      // escribe el emisor, que toma el identificador tal como lo entrega la fila.
      `${marcaCanónica}|${idVálido.toUpperCase()}`,
    ];

    for (const carga of noProducidos) {
      const cursor = Buffer.from(carga, 'utf8').toString('base64url');
      const respuesta = await list(
        TOKEN_REVISOR_A,
        `?cursor=${encodeURIComponent(cursor)}`,
      ).expect(400);

      expect(respuesta.body.fields).toEqual(['cursor']);
      expect(JSON.stringify(respuesta.body)).not.toContain(idVálido);
    }

    // El `400` no lee el backlog: un cursor inválido se rechaza ANTES de leer.
    expect(harness.store.queries).not.toContain('accessRequest.findMany');

    // Y el cursor que el servidor emite sigue funcionando, con la misma fila.
    // El orden es `submittedAt DESC`, así que tras la primera página de la fila
    // más reciente sigue la inmediatamente anterior.
    const primera = await list(TOKEN_REVISOR_A, '?limit=1').expect(200);
    const emitido = primera.body.nextCursor as string;
    const segunda = await list(
      TOKEN_REVISOR_A,
      `?cursor=${encodeURIComponent(emitido)}&limit=1`,
    ).expect(200);

    expect(primera.body.items[0].requestId).toBe(SEMILLAS_A[4]!.id);
    expect(segunda.body.items[0].requestId).toBe(SEMILLAS_A[3]!.id);
  });

  it('el error de filtro nombra el campo y nunca su valor', async () => {
    const respuesta = await list(TOKEN_REVISOR_A, '?profile=ADMIN').expect(400);

    expect(respuesta.body.fields).toEqual(['profile']);
    expect(JSON.stringify(respuesta.body)).not.toContain('ADMIN');
  });

  it('audita la concesión del listado sin nombrar recurso, filtros ni conteos', async () => {
    await list(TOKEN_REVISOR_A, '?q=Ana&limit=1').expect(200);

    const concesiones = eventosDe('ACCESS_REQUEST_LIST_GRANTED');

    expect(concesiones).toHaveLength(1);
    expect(concesiones[0]?.['outcome']).toBe('SUCCESS');
    expect(concesiones[0]?.['resourceId']).toBeNull();
    expect(concesiones[0]?.['actorRole']).toBe('HOSPITAL_ACCESS_REVIEWER');
    expect(concesiones[0]?.['tenantId']).toBe(TENANT_A);
    expect(JSON.stringify(concesiones[0])).not.toContain('Ana');
    expect(JSON.stringify(concesiones[0])).not.toContain('limit');
  });

  // --- Detalle ---------------------------------------------------------------

  it('devuelve el detalle con los campos de revisión y sin identificadores internos', async () => {
    const respuesta = await detalle(TOKEN_REVISOR_A, SEMILLAS_A[0]!.id).expect(200);

    expect(Object.keys(respuesta.body).sort()).toEqual([
      'birthDate',
      'decidedAt',
      'decisionReasonCode',
      'documentNumber',
      'documentType',
      'email',
      'familyNames',
      'givenNames',
      'phone',
      'provisioningAttempts',
      'provisioningErrorCode',
      'provisioningStatus',
      'reference',
      'registration',
      'registrationSchemaVersion',
      'requestId',
      'requestedProfile',
      'sexGenderCode',
      'status',
      'submittedAt',
      'version',
    ]);

    expect(respuesta.body.documentNumber).toBe('CC 44.556.677');
    expect(respuesta.body.birthDate).toBe('1985-04-12');
    expect(respuesta.body.provisioningStatus).toBe('NOT_STARTED');
    expect(respuesta.body.provisioningAttempts).toBe(0);
    expect(respuesta.body.provisioningErrorCode).toBeNull();
    expect(respuesta.body.decidedAt).toBeNull();
    expect(respuesta.body.decisionReasonCode).toBeNull();
    expect(respuesta.body.registrationSchemaVersion).toBeNull();
    expect(respuesta.body.registration).toBeNull();

    const serializado = JSON.stringify(respuesta.body);
    expect(serializado).not.toContain(TENANT_A);
    expect(serializado).not.toContain('personId');
    expect(serializado).not.toContain('humanAccountId');
    expect(serializado).not.toContain('reviewedByInstitutionalIdentityId');
    expect(serializado).not.toContain(REVISOR_A);
  });

  it('audita la consulta del detalle nombrando el recurso', async () => {
    await detalle(TOKEN_REVISOR_A, SEMILLAS_A[1]!.id).expect(200);

    const vistos = eventosDe('ACCESS_REQUEST_VIEWED');

    expect(vistos).toHaveLength(1);
    expect(vistos[0]?.['resourceId']).toBe(SEMILLAS_A[1]!.id);
    expect(vistos[0]?.['endpoint']).toBe('GET /api/v1/hospital/access-requests/:requestId');
    expect(JSON.stringify(vistos[0])).not.toContain('Restrepo');
  });

  it('el detalle con expediente devuelve version y datos sin exponer password', async () => {
    const respuesta = await detalle(TOKEN_REVISOR_A, SEMILLAS_A[1]!.id).expect(200);

    expect(respuesta.body.registrationSchemaVersion).toBe(1);
    expect(respuesta.body.registration).toStrictEqual({
      tipoCuidador: 'FAMILIAR',
      tieneFormacion: 'NO',
      viveConPaciente: 'SI',
      horarios: ['MANANA'],
      pacienteRegistrado: 'NO_SABE',
      relacionPaciente: 'MADRE',
      vecinoNombre: 'Rosa Ficticia',
      vecinoTelefono: '312 778 4410',
      vecinoRelacion: 'VECINO',
      vecinoDireccion: 'Casa de al lado',
      vecinoAutorizado: true,
      autorizaDatos: true,
    });

    const serializado = JSON.stringify(respuesta.body);
    expect(serializado).not.toContain('password');
    expect(serializado).not.toContain('tenantId');
  });

  it('el listado no incluye el expediente aunque la fila lo tenga', async () => {
    const respuesta = await como(TOKEN_REVISOR_A)(
      server().get('/api/v1/hospital/access-requests'),
    ).expect(200);

    const bruno = (respuesta.body.items as Array<Record<string, unknown>>).find(
      (item) => item['reference'] === 'AR-BBBBBBBBBBBBBBBBBBBBBBBBBBBB',
    );

    expect(bruno).toBeDefined();
    expect('registration' in (bruno as Record<string, unknown>)).toBe(false);
    expect('registrationSchemaVersion' in (bruno as Record<string, unknown>)).toBe(false);
  });

  it('404 idéntico para un identificador ajeno y para uno inexistente', async () => {
    const ajeno = await detalle(TOKEN_REVISOR_A, SEMILLA_B.id).expect(404);
    const inexistente = await detalle(
      TOKEN_REVISOR_A,
      '99999999-9999-4999-8999-999999999999',
    ).expect(404);

    expect(ajeno.body).toStrictEqual(inexistente.body);
    expect(ajeno.body.code).toBe('ACCESS_REQUEST_REVIEW_NOT_FOUND');
    expect(JSON.stringify(ajeno.body)).not.toContain(SEMILLA_B.reference);
    expect(eventosDe('ACCESS_REQUEST_VIEWED')).toHaveLength(0);
  });

  it('400 para un identificador mal formado, que es un fallo distinto del 404', async () => {
    const respuesta = await detalle(TOKEN_REVISOR_A, 'no-es-un-uuid').expect(400);

    expect(respuesta.body.code).toBe('ACCESS_REQUEST_REVIEW_INVALID_REQUEST');
    expect(respuesta.body.fields).toEqual(['requestId']);
  });

  // --- Decisión: transición --------------------------------------------------

  it('APRUEBA ejecutando la saga: el 200 describe la fila FINAL, no la intermedia', async () => {
    const respuesta = await decision(TOKEN_REVISOR_A, SEMILLAS_A[0]!.id, {
      action: 'APPROVE',
      expectedVersion: 1,
      reasonCode: 'DEMO_ELIGIBLE',
    }).expect(200);

    expect(respuesta.body).toStrictEqual({
      requestId: SEMILLAS_A[0]!.id,
      reference: SEMILLAS_A[0]!.reference,
      status: 'APPROVED',
      version: 3,
      decisionReasonCode: 'DEMO_ELIGIBLE',
      decidedAt: expect.any(String),
    });

    const fila = harness.store.accessRequests.find(
      (row) => row['id'] === SEMILLAS_A[0]!.id,
    );

    expect(fila?.['status']).toBe('APPROVED');
    // DOS incrementos: transición de la decisión y cierre de la provisión.
    expect(fila?.['version']).toBe(3);
    expect(fila?.['reviewedByInstitutionalIdentityId']).toBe(REVISOR_A);
    expect(fila?.['decidedAt']).toBeInstanceOf(Date);
    expect(fila?.['provisioningStatus']).toBe('SUCCEEDED');
    expect(fila?.['provisioningAttempts']).toBe(1);
    expect(fila?.['provisioningErrorCode']).toBeNull();
    expect(fila?.['provisioningReference']).toBeNull();

    expect(harness.provisioning.aprovisionarCalls).toEqual([SEMILLAS_A[0]!.id]);

    const aprobaciones = eventosDe('ACCESS_REQUEST_APPROVED');
    expect(aprobaciones).toHaveLength(1);
    expect(aprobaciones[0]?.['resourceId']).toBe(SEMILLAS_A[0]!.id);
    expect(aprobaciones[0]?.['actorRole']).toBe('HOSPITAL_ACCESS_REVIEWER');
    expect(JSON.stringify(aprobaciones[0])).not.toContain('DEMO_ELIGIBLE');
    expect(eventosDe('ACCESS_PROVISIONING_SUCCEEDED')).toHaveLength(1);
  });

  it('un fallo del proveedor deja PROVISIONING_FAILED y el reintento recupera', async () => {
    harness.provisioning.failNext = true;

    const fallo = await decision(TOKEN_REVISOR_A, SEMILLAS_A[2]!.id, {
      action: 'APPROVE',
      expectedVersion: 1,
      reasonCode: 'DEMO_ELIGIBLE',
    }).expect(200);

    expect(fallo.body.status).toBe('PROVISIONING_FAILED');
    expect(eventosDe('ACCESS_PROVISIONING_FAILED')).toHaveLength(1);

    const reintento = await decision(TOKEN_REVISOR_A, SEMILLAS_A[2]!.id, {
      action: 'RETRY_PROVISIONING',
      expectedVersion: 3,
      reasonCode: 'DEMO_PROVISIONING_RETRIED',
    }).expect(200);

    expect(reintento.body.status).toBe('APPROVED');
    // La aprobación fallida ya había consumido DOS incrementos (transición y
    // cierre fallido); el reintento suma otros dos.
    expect(reintento.body.version).toBe(5);

    const fila = harness.store.accessRequests.find((row) => row['id'] === SEMILLAS_A[2]!.id);
    expect(fila?.['status']).toBe('APPROVED');
    expect(fila?.['provisioningAttempts']).toBe(2);
    expect(fila?.['provisioningErrorCode']).toBeNull();
    // El fallo había cerrado la cuenta; el reintento la vuelve a abrir.
    expect(cuentaDe(SEMILLAS_A[2]!.id)?.['status']).toBe('ACTIVE');
    // El reintento no es una decisión nueva: no escribe un evento `APPROVED`.
    expect(eventosDe('ACCESS_REQUEST_APPROVED')).toHaveLength(1);
  });

  it('SUSPEND deshabilita la cuenta y revoca sus sesiones en la MISMA transacción', async () => {
    const cuenta = cuentaDe(SEMILLAS_A[5]!.id);
    expect(cuenta?.['status']).toBe('ACTIVE');

    const suspender = await decision(TOKEN_REVISOR_A, SEMILLAS_A[5]!.id, {
      action: 'SUSPEND',
      expectedVersion: 3,
      reasonCode: 'DEMO_ACCESS_SUSPENDED',
    }).expect(200);

    expect(suspender.body.status).toBe('SUSPENDED');

    expect(cuenta?.['status']).toBe('DISABLED');
    expect(sesionesDe(SEMILLAS_A[5]!.id)).toEqual([
      expect.any(String),
      expect.any(String),
    ]);
    expect(sesionesDe(SEMILLAS_A[5]!.id).every((valor) => typeof valor === 'string')).toBe(true);
    expect(eventosDe('ACCESS_REQUEST_SUSPENDED')).toHaveLength(1);
    expect(eventosDe('HUMAN_ACCOUNT_DISABLED')).toHaveLength(1);
    expect(eventosDe('HUMAN_SESSION_REVOKED')).toHaveLength(1);

    // Best-effort: la sincronización externa ocurre DESPUÉS de la decisión.
    expect(harness.provisioning.syncCalls).toHaveLength(1);
  });

  it('REACTIVATE vuelve a ejecutar la saga desde SUSPENDED', async () => {
    const cuenta = cuentaDe(SEMILLAS_A[7]!.id);
    expect(cuenta?.['status']).toBe('DISABLED');

    // El detalle es el único sitio donde la bandeja ve por qué un reintento
    // está o no disponible: sin `provisioningErrorCode` ofrecería el mismo
    // botón a una solicitud agotada y a una utilizable.
    const fallo = await detalle(TOKEN_REVISOR_A, SEMILLAS_A[6]!.id).expect(200);
    expect(fallo.body.status).toBe('PROVISIONING_FAILED');
    expect(fallo.body.provisioningAttempts).toBe(1);
    expect(fallo.body.provisioningErrorCode).toBe('UNAVAILABLE');

    const reactivar = await decision(TOKEN_REVISOR_A, SEMILLAS_A[7]!.id, {
      action: 'REACTIVATE',
      expectedVersion: 4,
      reasonCode: 'DEMO_ACCESS_REACTIVATED',
    }).expect(200);

    expect(reactivar.body.status).toBe('APPROVED');
    // Transición (5) y cierre de la saga (6): dos incrementos, no uno.
    expect(reactivar.body.version).toBe(6);
    expect(cuenta?.['status']).toBe('ACTIVE');
    expect(eventosDe('ACCESS_REQUEST_REACTIVATED')).toHaveLength(1);
    expect(harness.provisioning.aprovisionarCalls).toEqual([SEMILLAS_A[7]!.id]);
  });

  it('REVOKE deshabilita, revoca y desvincula en la misma transacción', async () => {
    const cuenta = cuentaDe(SEMILLAS_A[8]!.id);
    expect(cuenta?.['status']).toBe('ACTIVE');
    expect(vinculosDe(SEMILLAS_A[8]!.id)).toEqual(['ACTIVE']);

    const revocar = await decision(TOKEN_REVISOR_A, SEMILLAS_A[8]!.id, {
      action: 'REVOKE',
      expectedVersion: 3,
      reasonCode: 'DEMO_ACCESS_REVOKED',
    }).expect(200);

    expect(revocar.body.status).toBe('REVOKED');
    expect(cuenta?.['status']).toBe('DISABLED');
    expect(sesionesDe(SEMILLAS_A[8]!.id).every((valor) => typeof valor === 'string')).toBe(true);
    expect(vinculosDe(SEMILLAS_A[8]!.id)).toEqual(['UNLINKED']);
    expect(eventosDe('ACCESS_REQUEST_REVOKED')).toHaveLength(1);

    // Los vínculos desactivados se sincronizan FUERA de la transacción.
    expect(harness.provisioning.syncCalls).toHaveLength(1);
    expect(harness.provisioning.syncCalls[0]?.length).toBeGreaterThan(0);
  });

  it('las acciones de saga no admiten estados de origen que no les corresponden', async () => {
    // REACTIVATE solo desde SUSPENDED.
    await decision(TOKEN_REVISOR_A, SEMILLAS_A[5]!.id, {
      action: 'REACTIVATE',
      expectedVersion: 3,
      reasonCode: 'DEMO_ACCESS_REACTIVATED',
    }).expect(409);

    // RETRY_PROVISIONING solo desde PROVISIONING_FAILED.
    await decision(TOKEN_REVISOR_A, SEMILLAS_A[0]!.id, {
      action: 'RETRY_PROVISIONING',
      expectedVersion: 1,
      reasonCode: 'DEMO_PROVISIONING_RETRIED',
    }).expect(409);

    // SUSPEND solo desde APPROVED.
    await decision(TOKEN_REVISOR_A, SEMILLAS_A[0]!.id, {
      action: 'SUSPEND',
      expectedVersion: 1,
      reasonCode: 'DEMO_ACCESS_SUSPENDED',
    }).expect(409);

    expect(harness.provisioning.aprovisionarCalls).toHaveLength(0);
  });

  it('REJECTED y REVOKED son terminales: ninguna acción posterior se aplica', async () => {
    const rechazada = SEMILLAS_A[4]!.id;

    for (const cuerpo of [
      { action: 'APPROVE', reasonCode: 'DEMO_ELIGIBLE' },
      { action: 'REJECT', reasonCode: 'DEMO_NOT_ELIGIBLE' },
      { action: 'SUSPEND', reasonCode: 'DEMO_ACCESS_SUSPENDED' },
      { action: 'REVOKE', reasonCode: 'DEMO_ACCESS_REVOKED' },
    ]) {
      await decision(TOKEN_REVISOR_A, rechazada, { ...cuerpo, expectedVersion: 2 }).expect(409);
    }

    const revocada = SEMILLAS_A[8]!.id;
    await decision(TOKEN_REVISOR_A, revocada, {
      action: 'REVOKE',
      expectedVersion: 3,
      reasonCode: 'DEMO_ACCESS_REVOKED',
    }).expect(200);

    await decision(TOKEN_REVISOR_A, revocada, {
      action: 'APPROVE',
      expectedVersion: 4,
      reasonCode: 'DEMO_ELIGIBLE',
    }).expect(409);

    expect(harness.provisioning.aprovisionarCalls).toHaveLength(0);
  });

  it('RECHAZA cerrando la solicitud', async () => {
    const respuesta = await decision(TOKEN_REVISOR_A, SEMILLAS_A[1]!.id, {
      action: 'REJECT',
      expectedVersion: 1,
      reasonCode: 'DEMO_NOT_ELIGIBLE',
    }).expect(200);

    expect(respuesta.body.status).toBe('REJECTED');
    expect(respuesta.body.decisionReasonCode).toBe('DEMO_NOT_ELIGIBLE');
    expect(eventosDe('ACCESS_REQUEST_REJECTED')).toHaveLength(1);
  });

  it('exige el origen permitido en la decisión y no escribe sin él', async () => {
    const sinCabecera = await decision(
      TOKEN_REVISOR_A,
      SEMILLAS_A[2]!.id,
      { action: 'APPROVE', expectedVersion: 1, reasonCode: 'DEMO_ELIGIBLE' },
      null,
    ).expect(403);

    expect(sinCabecera.body.code).toBe('INSTITUTIONAL_ORIGIN_REJECTED');

    const ajeno = await decision(
      TOKEN_REVISOR_A,
      SEMILLAS_A[2]!.id,
      { action: 'APPROVE', expectedVersion: 1, reasonCode: 'DEMO_ELIGIBLE' },
      'http://sitio-ajeno.example',
    ).expect(403);

    expect(ajeno.body.code).toBe('INSTITUTIONAL_ORIGIN_REJECTED');

    const fila = harness.store.accessRequests.find((row) => row['id'] === SEMILLAS_A[2]!.id);
    expect(fila?.['status']).toBe('PENDING');
    expect(fila?.['version']).toBe(1);
    expect(eventosDe('ACCESS_REQUEST_APPROVED')).toHaveLength(0);

    // Las lecturas no exigen origen: no cambian nada.
    await list(TOKEN_REVISOR_A).expect(200);
    await detalle(TOKEN_REVISOR_A, SEMILLAS_A[2]!.id).expect(200);
  });

  it('rechaza un cuerpo fuera del contrato y nunca acepta texto libre', async () => {
    const fila = SEMILLAS_A[0]!.id;

    await decision(TOKEN_REVISOR_A, fila, {
      action: 'APPROVE',
      expectedVersion: 1,
      reasonCode: 'DEMO_ELIGIBLE',
      motivo: 'porque sí',
    }).expect(400);

    await decision(TOKEN_REVISOR_A, fila, {
      action: 'APPROVE',
      expectedVersion: 1,
      reasonCode: 'DEMO_NOT_ELIGIBLE',
    }).expect(400);

    await decision(TOKEN_REVISOR_A, fila, {
      action: 'REJECT',
      expectedVersion: 1,
      reasonCode: 'DEMO_ELIGIBLE',
    }).expect(400);

    await decision(TOKEN_REVISOR_A, fila, {
      action: 'SUSPEND',
      expectedVersion: 1,
      reasonCode: 'DEMO_ELIGIBLE',
    }).expect(400);

    await decision(TOKEN_REVISOR_A, fila, { action: 'APPROVE', reasonCode: 'DEMO_ELIGIBLE' }).expect(400);

    await decision(TOKEN_REVISOR_A, fila, {
      action: 'APPROVE',
      expectedVersion: 0,
      reasonCode: 'DEMO_ELIGIBLE',
    }).expect(400);

    await decision(TOKEN_REVISOR_A, fila, {
      action: 'APPROVE',
      expectedVersion: 1.5,
      reasonCode: 'DEMO_ELIGIBLE',
    }).expect(400);

    // `expectedVersion` llega como texto: la versión es un entero y un texto no
    // se convierte a entero por cortesía, porque "1" y 1 no son la misma cosa en
    // un control de concurrencia que decide si dos revisores chocaron.
    const personaIncorrecta = await decision(TOKEN_REVISOR_A, fila, {
      action: 'APPROVE',
      expectedVersion: '1',
      reasonCode: 'DEMO_ELIGIBLE',
    }).expect(400);
    expect(personaIncorrecta.body.fields).toEqual(['expectedVersion']);

    const tras = harness.store.accessRequests.find((row) => row['id'] === fila);
    expect(tras?.['status']).toBe('PENDING');
    expect(tras?.['version']).toBe(1);
    expect(harness.store.auditEvents).toHaveLength(0);
  });

  // --- Decisión: replay, conflicto y concurrencia ----------------------------

  it('una repetición exacta devuelve el resultado vigente sin escribir ni auditar de nuevo', async () => {
    const cuerpo = { action: 'APPROVE', expectedVersion: 1, reasonCode: 'DEMO_ELIGIBLE' };

    const primera = await decision(TOKEN_REVISOR_A, SEMILLAS_A[3]!.id, cuerpo).expect(200);
    const repeticion = await decision(TOKEN_REVISOR_A, SEMILLAS_A[3]!.id, cuerpo).expect(200);

    expect(repeticion.body).toStrictEqual(primera.body);

    const fila = harness.store.accessRequests.find((row) => row['id'] === SEMILLAS_A[3]!.id);
    // Tres, no dos: la primera llamada ejecutó la saga y la repetición no la
    // ejecuta de nuevo —ni ni un cuarto incremento ni una segunda provisión.
    expect(fila?.['version']).toBe(3);
    expect(harness.provisioning.aprovisionarCalls).toHaveLength(1);
    expect(eventosDe('ACCESS_REQUEST_APPROVED')).toHaveLength(1);
  });

  it('una versión vencida produce 409 sin segundo cambio ni segundo evento', async () => {
    await decision(TOKEN_REVISOR_A, SEMILLAS_A[3]!.id, {
      action: 'APPROVE',
      expectedVersion: 1,
      reasonCode: 'DEMO_ELIGIBLE',
    }).expect(200);

    const vencida = await decision(TOKEN_REVISOR_A, SEMILLAS_A[3]!.id, {
      action: 'REJECT',
      expectedVersion: 1,
      reasonCode: 'DEMO_NOT_ELIGIBLE',
    }).expect(409);

    expect(vencida.body.code).toBe('ACCESS_REQUEST_REVIEW_CONFLICT');
    // El conflicto no distingue el motivo: ni el estado ni la versión se nombran.
    expect(JSON.stringify(vencida.body)).not.toContain('version');
    expect(JSON.stringify(vencida.body)).not.toContain('PENDING');

    const fila = harness.store.accessRequests.find((row) => row['id'] === SEMILLAS_A[3]!.id);
    expect(fila?.['status']).toBe('APPROVED');
    expect(fila?.['version']).toBe(3);
    expect(eventosDe('ACCESS_REQUEST_REJECTED')).toHaveLength(0);
  });

  it('otro actor que repite la acción con la versión vencida NO es una repetición', async () => {
    const cuerpo = { action: 'APPROVE', expectedVersion: 1, reasonCode: 'DEMO_ELIGIBLE' };
    // Una solicitud PENDING: repetir la acción sobre una ya cerrada probaría el
    // conflicto de estado, no la identidad de la decisión.
    const pendiente = SEMILLAS_A[1]!;

    await decision(TOKEN_REVISOR_A, pendiente.id, cuerpo).expect(200);

    // Misma acción y misma versión, pero otro revisor: no es la misma decisión.
    await decision(TOKEN_REVISOR_A_OTRO, pendiente.id, cuerpo).expect(409);
  });

  it('una solicitud ya decidida no se vuelve a decidir', async () => {
    /*
     * `expectedVersion` es la versión VIGENTE, no la que tenía cuando se decidió.
     * Con la versión vigente no hay repetición exacta que reconocer —la
     * repetición exige haber enviado la versión anterior— así que lo que se
     * comprueba es que una solicitud cerrada rechaza cualquier decisión nueva.
     */
    await decision(TOKEN_REVISOR_A, SEMILLAS_A[4]!.id, {
      action: 'REJECT',
      expectedVersion: 2,
      reasonCode: 'DEMO_NOT_ELIGIBLE',
    }).expect(409);

    const fila = harness.store.accessRequests.find((row) => row['id'] === SEMILLAS_A[4]!.id);
    expect(fila?.['status']).toBe('REJECTED');
    expect(fila?.['version']).toBe(2);
  });

  it('decisiones concurrentes con la misma versión: como máximo una se aplica', async () => {
    const [primera, segunda] = await Promise.all([
      decision(TOKEN_REVISOR_A, SEMILLAS_A[0]!.id, {
        action: 'APPROVE',
        expectedVersion: 1,
        reasonCode: 'DEMO_ELIGIBLE',
      }),
      decision(TOKEN_REVISOR_A_OTRO, SEMILLAS_A[0]!.id, {
        action: 'REJECT',
        expectedVersion: 1,
        reasonCode: 'DEMO_NOT_ELIGIBLE',
      }),
    ]);

    const exitos = [primera, segunda].filter((respuesta) => respuesta.status === 200);
    const conflictos = [primera, segunda].filter((respuesta) => respuesta.status === 409);

    expect(exitos).toHaveLength(1);
    expect(conflictos).toHaveLength(1);

    const fila = harness.store.accessRequests.find((row) => row['id'] === SEMILLAS_A[0]!.id);
    // Gane quien gane, sólo uno de los dos escribió: `APPROVE` deja la fila en
    // `APPROVED` con TRES incrementos (transición y saga), `REJECT` en
    // `REJECTED` con dos. Ninguna de las dos ramas deja la solicitud a medias.
    expect(['APPROVED', 'REJECTED']).toContain(fila?.['status']);
    expect([2, 3]).toContain(fila?.['version']);

    const decisiones = [...eventosDe('ACCESS_REQUEST_APPROVED'), ...eventosDe('ACCESS_REQUEST_REJECTED')];
    expect(decisiones).toHaveLength(1);
  });

  it('no se puede decidir una solicitud de otro tenant y el 404 es opaco', async () => {
    const respuesta = await decision(TOKEN_REVISOR_A, SEMILLA_B.id, {
      action: 'APPROVE',
      expectedVersion: 1,
      reasonCode: 'DEMO_ELIGIBLE',
    }).expect(404);

    expect(respuesta.body.code).toBe('ACCESS_REQUEST_REVIEW_NOT_FOUND');
    expect(harness.store.accessRequests.find((row) => row['id'] === SEMILLA_B.id)?.['status']).toBe(
      'PENDING',
    );
    expect(eventosDe('ACCESS_REQUEST_APPROVED')).toHaveLength(0);
  });

  // --- Atomicidad ------------------------------------------------------------

  it('si la auditoría falla, la decisión se revierte entera', async () => {
    harness.store.failNextAudit = true;

    const respuesta = await decision(TOKEN_REVISOR_A, SEMILLAS_A[2]!.id, {
      action: 'APPROVE',
      expectedVersion: 1,
      reasonCode: 'DEMO_ELIGIBLE',
    }).expect(503);

    expect(respuesta.body.code).toBe('ACCESS_REQUEST_REVIEW_UNAVAILABLE');
    expect(JSON.stringify(respuesta.body)).not.toContain('auditoría');

    const fila = harness.store.accessRequests.find((row) => row['id'] === SEMILLAS_A[2]!.id);
    expect(fila?.['status']).toBe('PENDING');
    expect(fila?.['version']).toBe(1);
    expect(fila?.['decidedAt']).toBeNull();
    expect(fila?.['reviewedByInstitutionalIdentityId']).toBeNull();
    expect(harness.store.auditEvents).toHaveLength(0);
  });

  it('un fallo de auditoría de la lista tampoco sirve la lectura', async () => {
    harness.store.failNextAudit = true;

    const respuesta = await list(TOKEN_REVISOR_A).expect(503);

    expect(respuesta.body.code).toBe('ACCESS_REQUEST_REVIEW_UNAVAILABLE');
    expect(harness.store.auditEvents).toHaveLength(0);
  });
});
