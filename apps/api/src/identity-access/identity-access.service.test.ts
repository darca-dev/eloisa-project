import { describe, expect, it } from 'vitest';

import { type PrismaService } from '../database/prisma.service';
import { RuntimeContextUnavailableError } from '../database/runtime-context.error';

import { type HumanPrincipal } from './human-principal';
import { IdentityAccessService } from './identity-access.service';

/**
 * Puerta PROFESIONAL sobre un paciente concreto
 * (IDENTITY-RELATIONSHIPS-CORE-01 §7.2, corrección MP-01).
 *
 * Se prueba la DECISIÓN, no la persistencia: `PrismaService` se sustituye por un
 * doble que registra el `where` recibido y el número de operaciones abiertas. Lo
 * que aquí importa es que la decisión se tome en UNA sola transacción, que las
 * condiciones viajen todas dentro de esa consulta y que un fallo de contexto
 * runtime NO se traduzca en un booleano.
 *
 * Todos los identificadores son ficticios y opacos.
 */

const PRINCIPAL: HumanPrincipal = {
  sessionId: '00000000-0000-0000-0000-0000000000a1',
  humanAccountId: '00000000-0000-0000-0000-0000000000a2',
  personId: '00000000-0000-0000-0000-0000000000a3',
  tenantId: '00000000-0000-0000-0000-0000000000a4',
};

const PACIENTE = '00000000-0000-0000-0000-0000000000b1';
const AHORA = new Date('2026-05-14T15:30:00.000Z');
const HOY_UTC = new Date('2026-05-14T00:00:00.000Z');

interface Espia {
  readonly prisma: PrismaService;
  /** Tenants con los que se abrió `withTenant`, en orden. */
  readonly tenants: string[];
  /** Modelos consultados, en orden: detecta consultas previas al gate. */
  readonly modelos: string[];
  /** `where` recibido por cada `findFirst`, en orden. */
  readonly wheres: Record<string, unknown>[];
}

/**
 * Doble de `PrismaService` que ejecuta el trabajo con un `tx` instrumentado.
 *
 * `careAssignment.findFirst` devuelve `encontrado`. Cualquier OTRO modelo
 * consultado queda registrado en `modelos` y devuelve `null`: si la
 * implementación volviera a resolver antes el profesional, la prueba lo vería.
 */
function espiar(encontrado: { readonly id: string } | null): Espia {
  const tenants: string[] = [];
  const modelos: string[] = [];
  const wheres: Record<string, unknown>[] = [];

  const registrar =
    (modelo: string, resultado: { readonly id: string } | null) =>
    async (args: { where: Record<string, unknown> }) => {
      modelos.push(modelo);
      wheres.push(args.where);

      return resultado;
    };

  const tx = {
    careAssignment: { findFirst: registrar('careAssignment', encontrado) },
    professionalProfile: { findFirst: registrar('professionalProfile', null) },
    patient: { findFirst: registrar('patient', null) },
  };

  const prisma = {
    withTenant: async (tenantId: string, work: (tx: unknown) => Promise<unknown>) => {
      tenants.push(tenantId);

      return work(tx);
    },
  } as unknown as PrismaService;

  return { prisma, tenants, modelos, wheres };
}

/** `where` de la única consulta emitida, ya tipado como estructura anidada. */
function whereUnico(espia: Espia): {
  readonly tenantId: string;
  readonly patientId: string;
  readonly status: string;
  readonly startsAt: { readonly lte: Date };
  readonly OR: readonly Record<string, unknown>[];
  readonly professional: {
    readonly tenantId: string;
    readonly personId: string;
    readonly status: string;
    readonly affiliations: {
      readonly some: {
        readonly tenantId: string;
        readonly status: string;
        readonly startsOn: { readonly lte: Date };
        readonly OR: readonly Record<string, unknown>[];
      };
    };
  };
} {
  expect(espia.wheres).toHaveLength(1);

  return espia.wheres[0] as never;
}

/**
 * Aplica la cláusula de vigencia del `where` a una asignación concreta.
 *
 * Reproduce lo que PostgreSQL haría con `OR [endsAt IS NULL, endsAt > now]`. Si
 * la implementación dejara de emitir la cláusula, aquí no habría nada que
 * filtrar y la fila pasaría: por eso las pruebas de borde detectan su ausencia
 * además de su forma.
 */
function vigenciaSatisfecha(
  where: { readonly OR?: readonly Record<string, unknown>[] },
  endsAt: Date | null,
): boolean {
  if (where.OR === undefined) {
    // Sin cláusula no hay filtro: cualquier asignación pasaría.
    return true;
  }

  return where.OR.some((rama) => {
    const condicion = rama['endsAt'];

    if (condicion === null) {
      return endsAt === null;
    }

    if (endsAt === null || condicion === undefined || typeof condicion !== 'object') {
      return false;
    }

    const { gt, gte } = condicion as { gt?: Date; gte?: Date };

    if (gt !== undefined) {
      return endsAt.getTime() > gt.getTime();
    }

    if (gte !== undefined) {
      return endsAt.getTime() >= gte.getTime();
    }

    return false;
  });
}

/**
 * Doble cuya asignación existe con el `endsAt` indicado y solo se devuelve si
 * la propia consulta la considera vigente.
 */
function espiarAsignacionCon(endsAt: Date | null): Espia {
  const espia = espiar({ id: '00000000-0000-0000-0000-0000000000c4' });
  const encontrada = { id: '00000000-0000-0000-0000-0000000000c4' };

  const prisma = {
    withTenant: async (tenantId: string, work: (tx: unknown) => Promise<unknown>) => {
      espia.tenants.push(tenantId);

      return work({
        careAssignment: {
          findFirst: async (args: { where: Record<string, unknown> }) => {
            espia.modelos.push('careAssignment');
            espia.wheres.push(args.where);

            return vigenciaSatisfecha(args.where, endsAt) ? encontrada : null;
          },
        },
      });
    },
  } as unknown as PrismaService;

  return { ...espia, prisma };
}

describe('IdentityAccessService.hasActiveAssignmentOverPatient', () => {
  it('decide en UNA sola operación withTenant y sin resolver antes al profesional', async () => {
    const espia = espiar({ id: '00000000-0000-0000-0000-0000000000c1' });
    const service = new IdentityAccessService(espia.prisma);

    await expect(
      service.hasActiveAssignmentOverPatient(PRINCIPAL, PACIENTE, AHORA),
    ).resolves.toBe(true);

    expect(espia.tenants).toEqual([PRINCIPAL.tenantId]);
    // Ni `professionalProfile` ni ningún otro modelo se consultan por separado.
    expect(espia.modelos).toEqual(['careAssignment']);
  });

  it('exige todas las condiciones dentro de la MISMA consulta', async () => {
    const espia = espiar({ id: '00000000-0000-0000-0000-0000000000c2' });
    const service = new IdentityAccessService(espia.prisma);

    await service.hasActiveAssignmentOverPatient(PRINCIPAL, PACIENTE, AHORA);

    const where = whereUnico(espia);

    // Asignación: mismo tenant, mismo paciente, activa y ya iniciada.
    expect(where.tenantId).toBe(PRINCIPAL.tenantId);
    expect(where.patientId).toBe(PACIENTE);
    expect(where.status).toBe('ACTIVE');
    expect(where.startsAt).toEqual({ lte: AHORA });
    expect(where.OR).toEqual([{ endsAt: null }, { endsAt: { gt: AHORA } }]);

    // Profesional: el de la persona autenticada, activo y en el mismo tenant.
    expect(where.professional.tenantId).toBe(PRINCIPAL.tenantId);
    expect(where.professional.personId).toBe(PRINCIPAL.personId);
    expect(where.professional.status).toBe('ACTIVE');

    // Afiliación: activa, iniciada y no finalizada, comparada contra fecha UTC.
    const afiliacion = where.professional.affiliations.some;
    expect(afiliacion.tenantId).toBe(PRINCIPAL.tenantId);
    expect(afiliacion.status).toBe('ACTIVE');
    expect(afiliacion.startsOn).toEqual({ lte: HOY_UTC });
    expect(afiliacion.OR).toEqual([{ endsOn: null }, { endsOn: { gte: HOY_UTC } }]);
  });

  it('deniega cuando la consulta no encuentra asignación que cumpla todo', async () => {
    const espia = espiar(null);
    const service = new IdentityAccessService(espia.prisma);

    await expect(
      service.hasActiveAssignmentOverPatient(PRINCIPAL, PACIENTE, AHORA),
    ).resolves.toBe(false);

    expect(espia.modelos).toEqual(['careAssignment']);
  });

  it('nunca toma el profesional de un argumento: solo del principal', async () => {
    const espia = espiar({ id: '00000000-0000-0000-0000-0000000000c3' });
    const service = new IdentityAccessService(espia.prisma);

    // La firma admite exactamente tres parámetros: principal, paciente e
    // instante. No hay hueco para un `professionalId` del cliente.
    expect(service.hasActiveAssignmentOverPatient).toHaveLength(3);

    await service.hasActiveAssignmentOverPatient(PRINCIPAL, PACIENTE, AHORA);

    const where = whereUnico(espia);
    expect(where.professional.personId).toBe(PRINCIPAL.personId);
    expect(JSON.stringify(where)).not.toContain('professionalId');
  });

  it('permite cuando la asignación termina en el futuro', async () => {
    const espia = espiarAsignacionCon(new Date('2026-05-14T15:30:00.001Z'));
    const service = new IdentityAccessService(espia.prisma);

    await expect(
      service.hasActiveAssignmentOverPatient(PRINCIPAL, PACIENTE, AHORA),
    ).resolves.toBe(true);
  });

  it('deniega cuando la asignación ya venció', async () => {
    const espia = espiarAsignacionCon(new Date('2026-05-14T15:29:59.999Z'));
    const service = new IdentityAccessService(espia.prisma);

    await expect(
      service.hasActiveAssignmentOverPatient(PRINCIPAL, PACIENTE, AHORA),
    ).resolves.toBe(false);
  });

  it('deniega cuando la asignación termina EXACTAMENTE en el instante evaluado', async () => {
    // El borde se cierra: `endsAt === now` no autoriza.
    const espia = espiarAsignacionCon(new Date(AHORA.getTime()));
    const service = new IdentityAccessService(espia.prisma);

    await expect(
      service.hasActiveAssignmentOverPatient(PRINCIPAL, PACIENTE, AHORA),
    ).resolves.toBe(false);
  });

  it('permite cuando la asignación no tiene fecha de fin', async () => {
    const espia = espiarAsignacionCon(null);
    const service = new IdentityAccessService(espia.prisma);

    await expect(
      service.hasActiveAssignmentOverPatient(PRINCIPAL, PACIENTE, AHORA),
    ).resolves.toBe(true);
  });

  it('es fail-closed: propaga el fallo de contexto runtime en vez de devolver un booleano', async () => {
    const prisma = {
      withTenant: async () => {
        throw new RuntimeContextUnavailableError('el rol efectivo no es merdn_runtime');
      },
    } as unknown as PrismaService;

    const service = new IdentityAccessService(prisma);

    await expect(
      service.hasActiveAssignmentOverPatient(PRINCIPAL, PACIENTE, AHORA),
    ).rejects.toBeInstanceOf(RuntimeContextUnavailableError);
  });
});
