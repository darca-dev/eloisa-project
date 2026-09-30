import { describe, expect, it } from 'vitest';

import { type AuditService } from '../audit/audit.service';
import { type PrismaService } from '../database/prisma.service';
import { RuntimeContextUnavailableError } from '../database/runtime-context.error';

import { ApprovedExperiencesService, APPROVED_EXPERIENCE_ORDER } from './approved-experiences.service';
import { type HumanPrincipal } from './human-principal';
import { type IdentityAccessService } from './identity-access.service';

/**
 * Resolución de EXPERIENCIAS aprobadas (SPEC 038, MP04 §8 y §12).
 *
 * Se prueba la DECISIÓN, no la persistencia: `PrismaService`,
 * `IdentityAccessService` y `AuditService` se sustituyen por dobles que
 * registran qué se preguntó y en qué orden.
 *
 * Lo que aquí importa es que:
 * 1. la cuenta DESHABILITADA no obtiene experiencia aunque sus solicitudes
 *    sigan diciendo `APPROVED`;
 * 2. `CAREGIVER` se concede SIN relación —la portada de cuidador vive de esto—
 *    mientras que `PATIENT` y `FIELD_PROFESSIONAL` exigen su participación;
 * 3. solo el estado `APPROVED` cuenta, y siempre de la MISMA cuenta y tenant;
 * 4. el desenlace se audita DENTRO de la misma transacción que la lectura;
 * 5. un fallo de contexto runtime se propaga y nunca se convierte en lista.
 *
 * Todos los identificadores son ficticios y opacos.
 */

const PRINCIPAL: HumanPrincipal = {
  sessionId: '00000000-0000-0000-0000-0000000000a1',
  humanAccountId: '00000000-0000-0000-0000-0000000000a2',
  personId: '00000000-0000-0000-0000-0000000000a3',
  tenantId: '00000000-0000-0000-0000-0000000000a4',
};

const AHORA = new Date('2026-09-30T12:00:00.000Z');
const CORRELACION = 'corr-opaca-0001';

type Perfil = (typeof APPROVED_EXPERIENCE_ORDER)[number];

interface Doble {
  readonly service: ApprovedExperiencesService;
  readonly tenants: string[];
  /** `where` de la consulta de cuenta, o `null` si no se consultó. */
  whereCuenta: Record<string, unknown> | null;
  /** `where` de la consulta de solicitudes, o `null` si no se consultó. */
  whereSolicitudes: Record<string, unknown> | null;
  /** Modelos consultados dentro de `withTenant`, en orden. */
  readonly modelos: string[];
  /** Entradas de auditoría recibidas, en orden. */
  readonly auditorias: Record<string, unknown>[];
  /** Si la transacción de lectura y auditoría fue la MISMA. */
  mismaTransaccion: boolean;
}

interface Opciones {
  readonly cuentaActiva: boolean;
  readonly perfiles: readonly Perfil[];
  readonly pacienteVivo: boolean;
  readonly profesionalVivo: boolean;
}

function crearDoble(opciones: Opciones): Doble {
  const tenants: string[] = [];
  const modelos: string[] = [];
  const auditorias: Record<string, unknown>[] = [];

  const doble = {
    service: null as unknown as ApprovedExperiencesService,
    tenants,
    whereCuenta: null as Record<string, unknown> | null,
    whereSolicitudes: null as Record<string, unknown> | null,
    modelos,
    auditorias,
    mismaTransaccion: false,
  };

  const tx = {
    humanAccount: {
      findFirst: async (args: { where: Record<string, unknown> }) => {
        modelos.push('humanAccount');
        doble.whereCuenta = args.where;

        return opciones.cuentaActiva ? { id: PRINCIPAL.humanAccountId } : null;
      },
    },
    accessRequest: {
      findMany: async (args: { where: Record<string, unknown> }) => {
        modelos.push('accessRequest');
        doble.whereSolicitudes = args.where;

        return opciones.perfiles.map((perfil) => ({ requestedProfile: perfil }));
      },
    },
  };

  const prisma = {
    withTenant: async (tenantId: string, work: (transaccion: unknown) => Promise<unknown>) => {
      tenants.push(tenantId);

      return work(tx);
    },
  } as unknown as PrismaService;

  const identity = {
    resolvePatient: async () => (opciones.pacienteVivo ? { patientId: 'pac-ficticio' } : null),
    resolveProfessional: async () =>
      opciones.profesionalVivo ? { professionalId: 'prof-ficticio' } : null,
  } as unknown as IdentityAccessService;

  const audit = {
    recordExperienceAccessWithin: async (
      transaccion: unknown,
      entrada: Record<string, unknown>,
      _occurredAt: Date,
    ) => {
      doble.mismaTransaccion = transaccion === tx;
      auditorias.push(entrada);

      return 'audit-ficticio';
    },
  } as unknown as AuditService;

  doble.service = new ApprovedExperiencesService(prisma, identity, audit);

  return doble;
}

describe('ApprovedExperiencesService.resolve', () => {
  it('devuelve las tres experiencias en el orden CERRADO del contrato', async () => {
    const doble = crearDoble({
      cuentaActiva: true,
      perfiles: ['FIELD_PROFESSIONAL', 'PATIENT', 'CAREGIVER'],
      pacienteVivo: true,
      profesionalVivo: true,
    });

    await expect(
      doble.service.resolve(PRINCIPAL, AHORA, CORRELACION),
    ).resolves.toEqual(['PATIENT', 'CAREGIVER', 'FIELD_PROFESSIONAL']);
  });

  it('aplica la misma lista literal a la consulta y a la salida', async () => {
    expect(APPROVED_EXPERIENCE_ORDER).toEqual([
      'PATIENT',
      'CAREGIVER',
      'FIELD_PROFESSIONAL',
    ]);
  });

  it('concede CAREGIVER sin ninguna relación ni participación de paciente', async () => {
    const doble = crearDoble({
      cuentaActiva: true,
      perfiles: ['CAREGIVER'],
      pacienteVivo: false,
      profesionalVivo: false,
    });

    await expect(
      doble.service.resolve(PRINCIPAL, AHORA, CORRELACION),
    ).resolves.toEqual(['CAREGIVER']);
    // La existencia de la participación NO es condición para cuidador.
    expect(doble.modelos).toEqual(['humanAccount', 'accessRequest']);
  });

  it('no concede PATIENT aprobado si la cuenta no tiene paciente vivo', async () => {
    const doble = crearDoble({
      cuentaActiva: true,
      perfiles: ['PATIENT'],
      pacienteVivo: false,
      profesionalVivo: false,
    });

    await expect(
      doble.service.resolve(PRINCIPAL, AHORA, CORRELACION),
    ).resolves.toEqual([]);
  });

  it('no concede FIELD_PROFESSIONAL aprobado sin perfil y afiliación vigentes', async () => {
    const doble = crearDoble({
      cuentaActiva: true,
      perfiles: ['FIELD_PROFESSIONAL'],
      pacienteVivo: false,
      profesionalVivo: false,
    });

    await expect(
      doble.service.resolve(PRINCIPAL, AHORA, CORRELACION),
    ).resolves.toEqual([]);
  });

  it('la cuenta DESHABILITADA no obtiene experiencia y ni siquiera se consultan solicitudes', async () => {
    const doble = crearDoble({
      cuentaActiva: false,
      perfiles: ['PATIENT', 'CAREGIVER', 'FIELD_PROFESSIONAL'],
      pacienteVivo: true,
      profesionalVivo: true,
    });

    await expect(
      doble.service.resolve(PRINCIPAL, AHORA, CORRELACION),
    ).resolves.toEqual([]);

    expect(doble.modelos).toEqual(['humanAccount']);
    expect(doble.whereSolicitudes).toBeNull();
    expect(doble.auditorias).toEqual([
      {
        tenantId: PRINCIPAL.tenantId,
        humanAccountId: PRINCIPAL.humanAccountId,
        granted: false,
        correlationId: CORRELACION,
      },
    ]);
  });

  it('solo cuenta el estado APPROVED y SIEMPRE de la misma cuenta y tenant', async () => {
    const doble = crearDoble({
      cuentaActiva: true,
      perfiles: ['CAREGIVER'],
      pacienteVivo: false,
      profesionalVivo: false,
    });

    await doble.service.resolve(PRINCIPAL, AHORA, CORRELACION);

    expect(doble.tenants).toEqual([PRINCIPAL.tenantId]);
    expect(doble.whereCuenta).toEqual({
      id: PRINCIPAL.humanAccountId,
      tenantId: PRINCIPAL.tenantId,
      status: 'ACTIVE',
    });
    expect(doble.whereSolicitudes).toEqual({
      tenantId: PRINCIPAL.tenantId,
      humanAccountId: PRINCIPAL.humanAccountId,
      status: 'APPROVED',
      requestedProfile: { in: [...APPROVED_EXPERIENCE_ORDER] },
    });
  });

  it('audita concedido y denegado dentro de la MISMA transacción de lectura', async () => {
    const concedido = crearDoble({
      cuentaActiva: true,
      perfiles: ['CAREGIVER'],
      pacienteVivo: false,
      profesionalVivo: false,
    });
    await concedido.service.resolve(PRINCIPAL, AHORA, CORRELACION);

    expect(concedido.auditorias).toHaveLength(1);
    expect(concedido.auditorias[0]?.['granted']).toBe(true);
    expect(concedido.mismaTransaccion).toBe(true);

    const denegado = crearDoble({
      cuentaActiva: false,
      perfiles: [],
      pacienteVivo: false,
      profesionalVivo: false,
    });
    await denegado.service.resolve(PRINCIPAL, AHORA, CORRELACION);

    expect(denegado.auditorias[0]?.['granted']).toBe(false);
    expect(denegado.mismaTransaccion).toBe(true);
  });

  it('el evento de auditoría no copia cuáles experiencias había ni cuáles faltaban', async () => {
    const doble = crearDoble({
      cuentaActiva: true,
      perfiles: ['PATIENT', 'CAREGIVER', 'FIELD_PROFESSIONAL'],
      pacienteVivo: true,
      profesionalVivo: false,
    });

    await doble.service.resolve(PRINCIPAL, AHORA, CORRELACION);

    const serializado = JSON.stringify(doble.auditorias[0]);
    expect(serializado).not.toContain('PATIENT');
    expect(serializado).not.toContain('FIELD_PROFESSIONAL');
    expect(serializado).not.toContain('experiencias');
  });

  it('es fail-closed: propaga el fallo de contexto runtime en vez de devolver una lista', async () => {
    const prisma = {
      withTenant: async () => {
        throw new RuntimeContextUnavailableError('el rol efectivo no es merdn_runtime');
      },
    } as unknown as PrismaService;
    const identity = {
      resolvePatient: async () => null,
      resolveProfessional: async () => null,
    } as unknown as IdentityAccessService;
    const audit = {
      recordExperienceAccessWithin: async () => 'nunca',
    } as unknown as AuditService;

    const service = new ApprovedExperiencesService(prisma, identity, audit);

    await expect(service.resolve(PRINCIPAL, AHORA, CORRELACION)).rejects.toBeInstanceOf(
      RuntimeContextUnavailableError,
    );
  });

  it('no recibe identificadores de paciente ni de profesional: solo el principal', async () => {
    const doble = crearDoble({
      cuentaActiva: true,
      perfiles: ['PATIENT'],
      pacienteVivo: true,
      profesionalVivo: false,
    });

    // La firma admite exactamente tres parámetros: principal, instante y
    // correlación. No hay hueco para un identificador que venga del cliente.
    expect(doble.service.resolve).toHaveLength(3);

    await doble.service.resolve(PRINCIPAL, AHORA, CORRELACION);

    const serializado = JSON.stringify([doble.whereCuenta, doble.whereSolicitudes]);
    expect(serializado).not.toContain(PRINCIPAL.personId);
    expect(serializado).not.toContain('patientId');
    expect(serializado).not.toContain('professionalId');
  });
});
