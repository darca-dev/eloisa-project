import { describe, expect, it, vi } from 'vitest';

import { type PrismaTransaction } from '../database/prisma-transaction';

import {
  AuditService,
  PATIENT_SELF_RESOURCES,
  type PatientSelfAccessAuditInput,
  type PatientSelfResource,
} from './audit.service';

/**
 * Pruebas del acceso propio del Paciente en el servicio de auditoría existente
 * (spec 021 «Paciente MVP operativo» §9, §16; MICRO-PACKET 1).
 *
 * ALCANCE DE ESTE ARCHIVO. Comprueba el CONTRATO DEL EVENTO sin base de datos:
 * qué campos se escriben, con qué valores, qué NO se escribe nunca, qué ocurre
 * cuando falta el principal humano y qué ocurre cuando la escritura obligatoria
 * falla. Los dos desenlaces del rollback y la migración hacia adelante se
 * verifican contra PostgreSQL, fuera de este archivo, porque son
 * comportamiento del motor y no del servicio.
 *
 * Los identificadores usados son FICTICIOS y opacos. No hay ningún dato real de
 * paciente, ningún secreto y ninguna salida a servicio externo.
 */

/** Identificadores ficticios y opacos. No describen a nadie. */
const TENANT_FICTICIO = '00000000-0000-4000-8000-0000000000aa';
const CUENTA_HUMANA_FICTICIA = '00000000-0000-4000-8000-0000000000bb';
const CORRELACION_FICTICIA = 'corr-0000-ficticia';
const MOMENTO = new Date('2026-08-26T12:00:00.000Z');

/** Conjunto EXACTO de campos que un evento de esta familia puede escribir. */
const CAMPOS_PERMITIDOS = [
  'tenantId',
  'eventType',
  'actorType',
  'actorUserId',
  'actorRole',
  'resourceType',
  'resourceId',
  'outcome',
  'endpoint',
  'correlationId',
  'occurredAt',
] as const;

/** Rutas lógicas esperadas, una por proyección (spec 021 §6.6-e, §9.1). */
const ENDPOINT_ESPERADO: Record<PatientSelfResource, string> = {
  PatientSelfSummary: '/api/v1/patient-self/summary',
  PatientSelfAppointments: '/api/v1/patient-self/appointments',
  PatientSelfVisits: '/api/v1/patient-self/visits',
};

interface TransaccionDoble {
  readonly tx: PrismaTransaction;
  readonly eventosCreados: readonly Record<string, unknown>[];
  readonly mutaciones: readonly string[];
}

/**
 * Doble de transacción que registra lo escrito y DELATA cualquier operación
 * mutante sobre `audit_event`. La tabla es append-only: si el servicio llamara
 * a `update`, `delete`, `updateMany`, `deleteMany` o `upsert`, la prueba de
 * inmutabilidad lo vería.
 */
function crearTransaccionDoble(opciones: { readonly fallaLaEscritura?: boolean } = {}): TransaccionDoble {
  const eventosCreados: Record<string, unknown>[] = [];
  const mutaciones: string[] = [];

  const delatar =
    (nombre: string) =>
    (): Promise<never> => {
      mutaciones.push(nombre);

      return Promise.reject(new Error(`operación mutante prohibida: ${nombre}`));
    };

  const auditEvent = {
    create: vi.fn(
      async ({ data }: { readonly data: Record<string, unknown> }): Promise<{ id: string }> => {
        if (opciones.fallaLaEscritura === true) {
          throw new Error('audit_event: la escritura obligatoria no pudo persistirse');
        }

        eventosCreados.push(data);

        return { id: 'evt-ficticio-0001' };
      },
    ),
    update: vi.fn(delatar('update')),
    updateMany: vi.fn(delatar('updateMany')),
    delete: vi.fn(delatar('delete')),
    deleteMany: vi.fn(delatar('deleteMany')),
    upsert: vi.fn(delatar('upsert')),
  };

  return {
    tx: { auditEvent } as unknown as PrismaTransaction,
    eventosCreados,
    mutaciones,
  };
}

function entrada(
  resource: PatientSelfResource,
  sobrescribir: Partial<PatientSelfAccessAuditInput> = {},
): PatientSelfAccessAuditInput {
  return {
    tenantId: TENANT_FICTICIO,
    humanAccountId: CUENTA_HUMANA_FICTICIA,
    resource,
    correlationId: CORRELACION_FICTICIA,
    ...sobrescribir,
  };
}

describe('AuditService — acceso propio del Paciente (spec 021 §9)', () => {
  describe('T4.14 — acceso CONCEDIDO', () => {
    it('registra PATIENT_SELF_ACCESS_GRANTED con outcome SUCCESS', async () => {
      const doble = crearTransaccionDoble();
      const service = new AuditService();

      const id = await service.recordPatientSelfAccessGrantedWithin(
        doble.tx,
        entrada(PATIENT_SELF_RESOURCES.summary),
        MOMENTO,
      );

      expect(id).toBe('evt-ficticio-0001');
      expect(doble.eventosCreados).toHaveLength(1);
      expect(doble.eventosCreados[0]).toStrictEqual({
        tenantId: TENANT_FICTICIO,
        eventType: 'PATIENT_SELF_ACCESS_GRANTED',
        actorType: 'HUMAN_ACCOUNT',
        actorUserId: CUENTA_HUMANA_FICTICIA,
        actorRole: null,
        resourceType: 'PatientSelfSummary',
        resourceId: null,
        outcome: 'SUCCESS',
        endpoint: '/api/v1/patient-self/summary',
        correlationId: CORRELACION_FICTICIA,
        occurredAt: MOMENTO,
      });
    });
  });

  describe('T4.15 — acceso DENEGADO', () => {
    it('registra PATIENT_SELF_ACCESS_DENIED con outcome DENIED', async () => {
      const doble = crearTransaccionDoble();
      const service = new AuditService();

      await service.recordPatientSelfAccessDeniedWithin(
        doble.tx,
        entrada(PATIENT_SELF_RESOURCES.appointments),
        MOMENTO,
      );

      expect(doble.eventosCreados[0]).toMatchObject({
        eventType: 'PATIENT_SELF_ACCESS_DENIED',
        outcome: 'DENIED',
        resourceType: 'PatientSelfAppointments',
        endpoint: '/api/v1/patient-self/appointments',
      });
    });

    it('no registra el motivo de la denegación ni ningún campo adicional', async () => {
      const doble = crearTransaccionDoble();
      const service = new AuditService();

      await service.recordPatientSelfAccessDeniedWithin(
        doble.tx,
        entrada(PATIENT_SELF_RESOURCES.visits),
        MOMENTO,
      );

      expect(Object.keys(doble.eventosCreados[0] ?? {}).sort()).toStrictEqual(
        [...CAMPOS_PERMITIDOS].sort(),
      );
    });
  });

  describe('T4.6 / T4.1 — diferenciación por resourceType y endpoint, no por más enum', () => {
    it('las tres proyecciones producen resourceType y endpoint distintos', async () => {
      const doble = crearTransaccionDoble();
      const service = new AuditService();

      for (const resource of Object.values(PATIENT_SELF_RESOURCES)) {
        await service.recordPatientSelfAccessGrantedWithin(doble.tx, entrada(resource), MOMENTO);
      }

      expect(doble.eventosCreados.map((evento) => evento['resourceType'])).toStrictEqual([
        'PatientSelfSummary',
        'PatientSelfAppointments',
        'PatientSelfVisits',
      ]);
      expect(doble.eventosCreados.map((evento) => evento['endpoint'])).toStrictEqual([
        ENDPOINT_ESPERADO.PatientSelfSummary,
        ENDPOINT_ESPERADO.PatientSelfAppointments,
        ENDPOINT_ESPERADO.PatientSelfVisits,
      ]);
    });

    it('las seis combinaciones usan EXACTAMENTE dos valores de enum', async () => {
      const doble = crearTransaccionDoble();
      const service = new AuditService();

      for (const resource of Object.values(PATIENT_SELF_RESOURCES)) {
        await service.recordPatientSelfAccessGrantedWithin(doble.tx, entrada(resource), MOMENTO);
        await service.recordPatientSelfAccessDeniedWithin(doble.tx, entrada(resource), MOMENTO);
      }

      const tipos = new Set(doble.eventosCreados.map((evento) => evento['eventType']));

      expect(doble.eventosCreados).toHaveLength(6);
      expect([...tipos].sort()).toStrictEqual([
        'PATIENT_SELF_ACCESS_DENIED',
        'PATIENT_SELF_ACCESS_GRANTED',
      ]);
    });

    it('el endpoint se deriva del servicio: la entrada no lo puede suministrar', async () => {
      const doble = crearTransaccionDoble();
      const service = new AuditService();

      await service.recordPatientSelfAccessGrantedWithin(
        doble.tx,
        entrada(PATIENT_SELF_RESOURCES.visits),
        MOMENTO,
      );

      expect(Object.keys(entrada(PATIENT_SELF_RESOURCES.visits)).sort()).toStrictEqual([
        'correlationId',
        'humanAccountId',
        'resource',
        'tenantId',
      ]);
      expect(doble.eventosCreados[0]?.['endpoint']).toBe(ENDPOINT_ESPERADO.PatientSelfVisits);
    });

    it('el endpoint registrado es una ruta lógica, sin parámetros ni consulta', async () => {
      const doble = crearTransaccionDoble();
      const service = new AuditService();

      for (const resource of Object.values(PATIENT_SELF_RESOURCES)) {
        await service.recordPatientSelfAccessGrantedWithin(doble.tx, entrada(resource), MOMENTO);
      }

      for (const evento of doble.eventosCreados) {
        const endpoint = String(evento['endpoint']);

        expect(endpoint).toMatch(/^\/api\/v1\/patient-self\/(summary|appointments|visits)$/);
        expect(endpoint).not.toContain('?');
        expect(endpoint).not.toContain('=');
        expect(endpoint).not.toContain('&');
      }
    });
  });

  describe('T4.5 / T4.16 — actor HUMAN_ACCOUNT opaco y actorRole nulo', () => {
    it('escribe actorType HUMAN_ACCOUNT, actorUserId opaco y actorRole nulo', async () => {
      const doble = crearTransaccionDoble();
      const service = new AuditService();

      await service.recordPatientSelfAccessGrantedWithin(
        doble.tx,
        entrada(PATIENT_SELF_RESOURCES.summary),
        MOMENTO,
      );
      await service.recordPatientSelfAccessDeniedWithin(
        doble.tx,
        entrada(PATIENT_SELF_RESOURCES.summary),
        MOMENTO,
      );

      for (const evento of doble.eventosCreados) {
        expect(evento['actorType']).toBe('HUMAN_ACCOUNT');
        expect(evento['actorUserId']).toBe(CUENTA_HUMANA_FICTICIA);
        expect(evento['actorRole']).toBeNull();
      }
    });

    it('nunca registra actorType institucional, público ni no autenticado', async () => {
      const doble = crearTransaccionDoble();
      const service = new AuditService();

      await service.recordPatientSelfAccessDeniedWithin(
        doble.tx,
        entrada(PATIENT_SELF_RESOURCES.appointments),
        MOMENTO,
      );

      expect(doble.eventosCreados[0]?.['actorType']).not.toBe('UNAUTHENTICATED');
      expect(doble.eventosCreados[0]?.['actorType']).not.toBe('PUBLIC_SELF_ENROLLMENT');
      expect(doble.eventosCreados[0]?.['actorType']).not.toBe('INSTITUTIONAL_IDENTITY');
    });
  });

  describe('T4.8 — sin actor ficticio: sin principal humano no hay evento', () => {
    const ausentes = ['', '   '];

    for (const valor of ausentes) {
      it(`rechaza y NO escribe cuando humanAccountId es ${JSON.stringify(valor)}`, async () => {
        const doble = crearTransaccionDoble();
        const service = new AuditService();

        await expect(
          service.recordPatientSelfAccessDeniedWithin(
            doble.tx,
            entrada(PATIENT_SELF_RESOURCES.summary, { humanAccountId: valor }),
            MOMENTO,
          ),
        ).rejects.toThrow(/humanAccountId/);

        expect(doble.eventosCreados).toHaveLength(0);
      });
    }

    it('rechaza y NO escribe cuando falta el tenant o la correlación', async () => {
      const service = new AuditService();

      for (const campo of ['tenantId', 'correlationId'] as const) {
        const doble = crearTransaccionDoble();

        await expect(
          service.recordPatientSelfAccessGrantedWithin(
            doble.tx,
            entrada(PATIENT_SELF_RESOURCES.summary, { [campo]: '' }),
            MOMENTO,
          ),
        ).rejects.toThrow(new RegExp(campo));

        expect(doble.eventosCreados).toHaveLength(0);
      }
    });

    it('el mensaje del rechazo no expone ningún valor de la petición', async () => {
      const doble = crearTransaccionDoble();
      const service = new AuditService();

      const error = await service
        .recordPatientSelfAccessGrantedWithin(
          doble.tx,
          entrada(PATIENT_SELF_RESOURCES.summary, { humanAccountId: '' }),
          MOMENTO,
        )
        .catch((causa: unknown) => causa);

      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).not.toContain(TENANT_FICTICIO);
      expect((error as Error).message).not.toContain(CORRELACION_FICTICIA);
    });
  });

  describe('T4.9 / T4.17 — ausencia de PII y de contenido clínico, campo a campo', () => {
    it('el evento solo contiene los once campos permitidos', async () => {
      const doble = crearTransaccionDoble();
      const service = new AuditService();

      for (const resource of Object.values(PATIENT_SELF_RESOURCES)) {
        await service.recordPatientSelfAccessGrantedWithin(doble.tx, entrada(resource), MOMENTO);
        await service.recordPatientSelfAccessDeniedWithin(doble.tx, entrada(resource), MOMENTO);
      }

      for (const evento of doble.eventosCreados) {
        expect(Object.keys(evento).sort()).toStrictEqual([...CAMPOS_PERMITIDOS].sort());
      }
    });

    it('cada valor del evento es opaco, constante cerrada, nulo o el momento', async () => {
      const doble = crearTransaccionDoble();
      const service = new AuditService();

      for (const resource of Object.values(PATIENT_SELF_RESOURCES)) {
        await service.recordPatientSelfAccessGrantedWithin(doble.tx, entrada(resource), MOMENTO);
        await service.recordPatientSelfAccessDeniedWithin(doble.tx, entrada(resource), MOMENTO);
      }

      const valoresAdmitidos = new Set<unknown>([
        TENANT_FICTICIO,
        CUENTA_HUMANA_FICTICIA,
        CORRELACION_FICTICIA,
        'PATIENT_SELF_ACCESS_GRANTED',
        'PATIENT_SELF_ACCESS_DENIED',
        'HUMAN_ACCOUNT',
        'SUCCESS',
        'DENIED',
        ...Object.values(PATIENT_SELF_RESOURCES),
        ...Object.values(ENDPOINT_ESPERADO),
        null,
        MOMENTO,
      ]);

      for (const evento of doble.eventosCreados) {
        for (const valor of Object.values(evento)) {
          expect(valoresAdmitidos.has(valor)).toBe(true);
        }
      }
    });

    it('ningún campo del evento transporta dato personal ni clínico', async () => {
      const doble = crearTransaccionDoble();
      const service = new AuditService();

      await service.recordPatientSelfAccessGrantedWithin(
        doble.tx,
        entrada(PATIENT_SELF_RESOURCES.appointments),
        MOMENTO,
      );

      /*
       * La aserción recorre el evento SERIALIZADO, de modo que ningún campo
       * quede sin mirar. Los términos son los que la spec 021 §9.2-5 prohíbe.
       */
      const serializado = JSON.stringify(doble.eventosCreados[0]).toLowerCase();

      for (const prohibido of [
        'documento',
        'nombre',
        'iniciales',
        'direccion',
        'dirección',
        'territorio',
        'eps',
        'birth',
        'nacimiento',
        'sexo',
        'genero',
        'género',
        'diagnos',
        'clinic',
        'clínic',
        'patientid',
        'personid',
        'modalidad',
        'token',
        'cookie',
      ]) {
        expect(serializado).not.toContain(prohibido);
      }
    });
  });

  describe('T4.10 / T4.18 — fail-closed de la auditoría obligatoria', () => {
    it('propaga el fallo de la escritura y no devuelve identificador alguno', async () => {
      const doble = crearTransaccionDoble({ fallaLaEscritura: true });
      const service = new AuditService();

      await expect(
        service.recordPatientSelfAccessGrantedWithin(
          doble.tx,
          entrada(PATIENT_SELF_RESOURCES.summary),
          MOMENTO,
        ),
      ).rejects.toThrow(/no pudo persistirse/);

      expect(doble.eventosCreados).toHaveLength(0);
    });

    it('también falla cerrado en el desenlace denegado', async () => {
      const doble = crearTransaccionDoble({ fallaLaEscritura: true });
      const service = new AuditService();

      await expect(
        service.recordPatientSelfAccessDeniedWithin(
          doble.tx,
          entrada(PATIENT_SELF_RESOURCES.visits),
          MOMENTO,
        ),
      ).rejects.toThrow(/no pudo persistirse/);
    });
  });

  describe('T4.19 — inmutabilidad: la aplicación solo crea eventos', () => {
    it('no ejecuta update, delete ni upsert sobre audit_event', async () => {
      const doble = crearTransaccionDoble();
      const service = new AuditService();

      for (const resource of Object.values(PATIENT_SELF_RESOURCES)) {
        await service.recordPatientSelfAccessGrantedWithin(doble.tx, entrada(resource), MOMENTO);
        await service.recordPatientSelfAccessDeniedWithin(doble.tx, entrada(resource), MOMENTO);
      }

      expect(doble.mutaciones).toStrictEqual([]);
    });
  });

  describe('Auditoría preexistente — sin cambio de comportamiento', () => {
    it('la inscripción sigue registrando PATIENT_ENROLLMENT_CREATED igual que antes', async () => {
      const doble = crearTransaccionDoble();
      const service = new AuditService();

      await service.recordPatientEnrollmentCreatedWithin(
        doble.tx,
        { tenantId: TENANT_FICTICIO, patientId: '00000000-0000-4000-8000-0000000000cc' },
        MOMENTO,
      );

      expect(doble.eventosCreados[0]).toStrictEqual({
        tenantId: TENANT_FICTICIO,
        eventType: 'PATIENT_ENROLLMENT_CREATED',
        actorType: 'PUBLIC_SELF_ENROLLMENT',
        actorUserId: null,
        resourceType: 'Patient',
        resourceId: '00000000-0000-4000-8000-0000000000cc',
        outcome: 'SUCCESS',
        occurredAt: MOMENTO,
      });
    });

    it('la transición profesional de visita conserva su forma', async () => {
      const doble = crearTransaccionDoble();
      const service = new AuditService();

      await service.recordHomeVisitTransitionWithin(
        doble.tx,
        {
          tenantId: TENANT_FICTICIO,
          humanAccountId: CUENTA_HUMANA_FICTICIA,
          homeVisitId: '00000000-0000-4000-8000-0000000000dd',
          toStatus: 'COMPLETED',
        },
        MOMENTO,
      );

      expect(doble.eventosCreados[0]).toMatchObject({
        eventType: 'HOME_VISIT_COMPLETED',
        actorType: 'HUMAN_ACCOUNT',
        actorRole: null,
      });
    });
  });
});
