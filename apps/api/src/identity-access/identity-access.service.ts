import { Inject, Injectable } from '@nestjs/common';

import { type PrismaTransaction } from '../database/prisma-transaction';
import { PrismaService } from '../database/prisma.service';

import { type HumanPrincipal } from './human-principal';

export interface ResolvedPatient {
  readonly patientId: string;
}

export interface ResolvedProfessional {
  readonly professionalId: string;
}

/**
 * Resuelve participaciones de la persona autenticada desde el principal emitido
 * por la sesión. Los identificadores de paciente y profesional nunca llegan
 * desde el cliente y cada consulta conserva el contexto de tenant fail-closed.
 */
@Injectable()
export class IdentityAccessService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  public async resolvePatient(principal: HumanPrincipal): Promise<ResolvedPatient | null> {
    const patient = await this.prisma.withTenant(principal.tenantId, async (tx) =>
      tx.patient.findFirst({
        where: { tenantId: principal.tenantId, personId: principal.personId, status: 'ACTIVE' },
        select: { id: true },
      }),
    );

    return patient === null ? null : { patientId: patient.id };
  }

  /**
   * Resuelve el paciente que esta cuenta puede abrir como experiencia propia.
   *
   * A diferencia de `resolvePatient`, esta es una decisión de AUTORIZACIÓN:
   * exige la cuenta y el vínculo exactos de la sesión, una solicitud PATIENT
   * aprobada para ambos y la participación activa de la misma persona. La
   * transacción la aporta el consumidor para que decisión, lectura y auditoría
   * tengan un solo punto de commit.
   */
  public async resolveApprovedPatientWithin(
    tx: PrismaTransaction,
    principal: HumanPrincipal,
  ): Promise<ResolvedPatient | null> {
    const externalAuthIdentityId = principal.externalAuthIdentityId;

    if (externalAuthIdentityId === undefined) {
      return null;
    }

    /*
     * El bloqueo compartido serializa esta lectura contra deshabilitación,
     * recuperación y revocación de cuenta. No se bloquea AccessRequest: los
     * flujos de revisión toman primero esa fila y después la cuenta.
     */
    const accounts = await tx.$queryRaw<{ readonly id: string }[]>`
      SELECT "id"
        FROM "human_account"
       WHERE "id" = ${principal.humanAccountId}::uuid
         AND "tenantId" = ${principal.tenantId}::uuid
         AND "personId" = ${principal.personId}::uuid
         AND "status" = 'ACTIVE'
         AND NOT "passwordRecoveryBlocked"
       FOR SHARE
    `;

    if (accounts.length !== 1) {
      return null;
    }

    const approved = await tx.accessRequest.findFirst({
      where: {
        tenantId: principal.tenantId,
        personId: principal.personId,
        humanAccountId: principal.humanAccountId,
        externalAuthIdentityId,
        requestedProfile: 'PATIENT',
        status: 'APPROVED',
        externalIdentity: {
          id: externalAuthIdentityId,
          tenantId: principal.tenantId,
          humanAccountId: principal.humanAccountId,
          status: 'ACTIVE',
        },
      },
      select: { id: true },
    });

    if (approved === null) {
      return null;
    }

    const patient = await tx.patient.findFirst({
      where: {
        tenantId: principal.tenantId,
        personId: principal.personId,
        status: 'ACTIVE',
      },
      select: { id: true },
    });

    return patient === null ? null : { patientId: patient.id };
  }

  public async resolveProfessional(
    principal: HumanPrincipal,
    now: Date,
  ): Promise<ResolvedProfessional | null> {
    const today = toUtcDate(now);

    const profile = await this.prisma.withTenant(principal.tenantId, async (tx) =>
      tx.professionalProfile.findFirst({
        where: {
          tenantId: principal.tenantId,
          personId: principal.personId,
          status: 'ACTIVE',
          affiliations: {
            some: {
              tenantId: principal.tenantId,
              status: 'ACTIVE',
              startsOn: { lte: today },
              OR: [{ endsOn: null }, { endsOn: { gte: today } }],
            },
          },
        },
        select: { id: true },
      }),
    );

    return profile === null ? null : { professionalId: profile.id };
  }

  /**
   * Confirma en una única consulta tenant-scoped que la persona autenticada es
   * el profesional activo, afiliado y asignado de forma vigente al paciente.
   * Los errores de `withTenant` se propagan y nunca se convierten en permiso.
   */
  public async hasActiveAssignmentOverPatient(
    principal: HumanPrincipal,
    patientId: string,
    now: Date,
  ): Promise<boolean> {
    const today = toUtcDate(now);

    const assignment = await this.prisma.withTenant(principal.tenantId, async (tx) =>
      tx.careAssignment.findFirst({
        where: {
          tenantId: principal.tenantId,
          patientId,
          status: 'ACTIVE',
          startsAt: { lte: now },
          OR: [{ endsAt: null }, { endsAt: { gt: now } }],
          professional: {
            tenantId: principal.tenantId,
            personId: principal.personId,
            status: 'ACTIVE',
            affiliations: {
              some: {
                tenantId: principal.tenantId,
                status: 'ACTIVE',
                startsOn: { lte: today },
                OR: [{ endsOn: null }, { endsOn: { gte: today } }],
              },
            },
          },
        },
        select: { id: true },
      }),
    );

    return assignment !== null;
  }
}

function toUtcDate(value: Date): Date {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );
}
