import { Inject, Injectable } from '@nestjs/common';

import { type PrismaTransaction } from '../database/prisma-transaction';
import { type HumanPrincipal } from '../identity-access/human-principal';
import { IdentityAccessService } from '../identity-access/identity-access.service';

import {
  type AuthorizedCareContext,
  CARE_PERMISSIONS,
  type CareContextActorKind,
  type CareContextPermission,
} from './care-context.contract';
import { CareContextPolicy } from './care-context.policy';

/** Máximo de contextos por página del directorio. */
export const CARE_DIRECTORY_PAGE_LIMIT = 50;

/** Máximo de contextos que recorre la cola de revisión en una consulta. */
export const CARE_DIRECTORY_SCAN_LIMIT = 200;

/** Contexto ya decidido por MP01 dentro de la transacción del consumidor. */
export interface AuthorizedDirectoryEntry {
  readonly authorized: AuthorizedCareContext;
  readonly organizationName: string;
  readonly patientLabel: string;
}

/** Entrada mínima del directorio: lo justo para elegir un contexto. */
export interface CareDirectoryEntry {
  readonly contextId: string;
  readonly organizationId: string;
  readonly organizationName: string;
  /** Etiqueta mínima: «Mi cuidado» para el paciente propio; nombre e inicial si no. */
  readonly patientLabel: string;
  readonly actorKind: CareContextActorKind;
  readonly actions: readonly CareContextPermission[];
}

export interface CareDirectoryPage {
  readonly items: readonly CareDirectoryEntry[];
  readonly nextCursor: string | null;
}

interface Candidate {
  readonly id: string;
  readonly organizationId: string;
  readonly patientId: string;
  readonly organizationName: string;
}

/**
 * Directorio de contextos PROPIOS (SPEC 055 / MP02–MP03).
 *
 * Existe para que nadie tenga que escribir un UUID. Fija, solo durante la
 * consulta de candidatos, los GUC `merdn.discovery_account_id` y
 * `merdn.discovery_patient_id` con la cuenta del principal y el paciente
 * propio que el servidor resolvió; las políticas de descubrimiento muestran
 * entonces metadatos de las concesiones de ESA cuenta y de los contextos de
 * ESE paciente, y nada más. Los GUC se limpian antes de cualquier otra
 * consulta.
 *
 * Un candidato NO es una autorización: cada contexto se vuelve a decidir con la
 * política de MP01, bajo su organización, antes de proyectarlo; los que no
 * conceden ninguna acción no se devuelven. No se lee ningún registro,
 * observación ni alarma.
 */
@Injectable()
export class CareContextDirectoryService {
  constructor(
    @Inject(IdentityAccessService) private readonly identity: IdentityAccessService,
    @Inject(CareContextPolicy) private readonly policy: CareContextPolicy,
  ) {}

  /** Organización de un contexto propio, o `null` si no es descubrible. */
  public async resolveOrganizationWithin(
    tx: PrismaTransaction,
    principal: HumanPrincipal,
    contextId: string,
  ): Promise<string | null> {
    const candidates = await this.withDiscovery(tx, principal, async () =>
      tx.$queryRaw<{ readonly organizationId: string }[]>`
        SELECT "organizationId"
          FROM "patient_care_context"
         WHERE "id" = ${contextId}::uuid
           AND "tenantId" = ${principal.tenantId}::uuid
           AND "status" = 'ACTIVE'`,
    );

    return candidates.length === 1 ? (candidates[0]?.organizationId ?? null) : null;
  }

  /**
   * Página del directorio. Debe ejecutarse dentro de `withTenant`: fija y
   * cambia el ámbito de organización por candidato para decidir con MP01.
   */
  public async listWithin(
    tx: PrismaTransaction,
    principal: HumanPrincipal,
    cursor: string | null,
    limit: number,
    now: Date,
  ): Promise<CareDirectoryPage> {
    const pageSize = Math.max(1, Math.min(limit, CARE_DIRECTORY_PAGE_LIMIT));

    const candidates = await this.withDiscovery(tx, principal, async () =>
      tx.$queryRaw<Candidate[]>`
        SELECT c."id", c."organizationId", c."patientId", o."displayName" AS "organizationName"
          FROM "patient_care_context" c
          JOIN "organization" o ON o."id" = c."organizationId" AND o."tenantId" = c."tenantId"
         WHERE c."tenantId" = ${principal.tenantId}::uuid
           AND c."status" = 'ACTIVE'
           AND (${cursor}::uuid IS NULL OR c."id" > ${cursor}::uuid)
         ORDER BY c."id"
         LIMIT ${pageSize + 1}`,
    );

    const page = candidates.slice(0, pageSize);
    const items: CareDirectoryEntry[] = [];

    for (const candidate of page) {
      await tx.$executeRaw`SELECT set_config('merdn.organization_id', ${candidate.organizationId}, true)`;

      const actions: CareContextPermission[] = [];
      let actorKind: CareContextActorKind | null = null;

      for (const permission of CARE_PERMISSIONS) {
        const decision = await this.policy.decideWithin(
          tx,
          principal,
          { organizationId: candidate.organizationId, contextId: candidate.id },
          permission,
          now,
        );

        if (decision.kind === 'granted') {
          actions.push(permission);
          actorKind ??= decision.authorized.actorKind;
        }
      }

      if (actorKind === null) {
        continue;
      }

      items.push({
        contextId: candidate.id,
        organizationId: candidate.organizationId,
        organizationName: candidate.organizationName,
        patientLabel: actorKind === 'PATIENT' ? 'Mi cuidado' : await this.patientLabel(tx, principal, candidate.patientId),
        actorKind,
        actions,
      });
    }

    await tx.$executeRaw`SELECT set_config('merdn.organization_id', '', true)`;

    const last = page.at(-1);
    return { items, nextCursor: candidates.length > pageSize && last !== undefined ? last.id : null };
  }

  /**
   * Todos los contextos propios en los que MP01 concede `permission`, hasta
   * `CARE_DIRECTORY_SCAN_LIMIT`. Devuelve la autorización decidida para que el
   * trabajo opere con ella dentro de la misma transacción.
   */
  public async listAuthorizedWithin(
    tx: PrismaTransaction,
    principal: HumanPrincipal,
    permission: CareContextPermission,
    now: Date,
  ): Promise<readonly AuthorizedDirectoryEntry[]> {
    const candidates = await this.withDiscovery(tx, principal, async () =>
      tx.$queryRaw<Candidate[]>`
        SELECT c."id", c."organizationId", c."patientId", o."displayName" AS "organizationName"
          FROM "patient_care_context" c
          JOIN "organization" o ON o."id" = c."organizationId" AND o."tenantId" = c."tenantId"
         WHERE c."tenantId" = ${principal.tenantId}::uuid
           AND c."status" = 'ACTIVE'
         ORDER BY c."id"
         LIMIT ${CARE_DIRECTORY_SCAN_LIMIT}`,
    );

    const entries: AuthorizedDirectoryEntry[] = [];

    for (const candidate of candidates) {
      await tx.$executeRaw`SELECT set_config('merdn.organization_id', ${candidate.organizationId}, true)`;
      const decision = await this.policy.decideWithin(
        tx,
        principal,
        { organizationId: candidate.organizationId, contextId: candidate.id },
        permission,
        now,
      );

      if (decision.kind === 'granted') {
        entries.push({
          authorized: decision.authorized,
          organizationName: candidate.organizationName,
          patientLabel:
            decision.authorized.actorKind === 'PATIENT' ? 'Mi cuidado' : await this.patientLabel(tx, principal, candidate.patientId),
        });
      }
    }

    await tx.$executeRaw`SELECT set_config('merdn.organization_id', '', true)`;
    return entries;
  }

  /** Nombre de pila e inicial del apellido. Sin documento ni otro dato. */
  private async patientLabel(tx: PrismaTransaction, principal: HumanPrincipal, patientId: string): Promise<string> {
    const patient = await tx.patient.findFirst({
      where: { id: patientId, tenantId: principal.tenantId },
      select: { person: { select: { givenNames: true, familyNames: true } } },
    });

    if (patient === null) {
      return 'Paciente';
    }

    const given = patient.person.givenNames.trim().split(/\s+/u)[0] ?? '';
    const initial = patient.person.familyNames.trim().charAt(0);

    return [given, initial === '' ? '' : `${initial}.`].filter((part) => part !== '').join(' ') || 'Paciente';
  }

  /**
   * Ejecuta la consulta de candidatos con los GUC de descubrimiento fijados y
   * los limpia SIEMPRE después, también si la consulta falla.
   */
  private async withDiscovery<T>(tx: PrismaTransaction, principal: HumanPrincipal, query: () => Promise<T>): Promise<T> {
    const ownPatient = await this.identity.resolveApprovedPatientWithin(tx, principal);

    await tx.$executeRaw`SELECT set_config('merdn.discovery_account_id', ${principal.humanAccountId}, true)`;
    await tx.$executeRaw`SELECT set_config('merdn.discovery_patient_id', ${ownPatient?.patientId ?? ''}, true)`;

    try {
      return await query();
    } finally {
      await tx.$executeRaw`SELECT set_config('merdn.discovery_account_id', '', true)`;
      await tx.$executeRaw`SELECT set_config('merdn.discovery_patient_id', '', true)`;
    }
  }
}
