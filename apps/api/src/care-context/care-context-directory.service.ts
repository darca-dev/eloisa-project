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

/** Máximo de contextos CANDIDATOS por página del directorio y de la cola. */
export const CARE_DIRECTORY_PAGE_LIMIT = 50;

/**
 * Contexto ya decidido por MP01 dentro de la transacción del consumidor, con la
 * autorización de la acción pedida y TODAS las acciones que la política
 * concede hoy (MP07B / A06), para abrirlo sin inferirlas desde el perfil.
 */
export interface AuthorizedDirectoryEntry {
  readonly authorized: AuthorizedCareContext;
  readonly entry: CareDirectoryEntry;
  readonly organizationName: string;
  readonly patientLabel: string;
}

/** Página de contextos autorizados para una acción. */
export interface AuthorizedDirectoryPage {
  readonly entries: readonly AuthorizedDirectoryEntry[];
  /** Último candidato examinado; `null` solo cuando no quedan candidatos. */
  readonly nextCursor: string | null;
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
   *
   * MP07B / A06: la página recorre a lo sumo `limit` CANDIDATOS en orden de id
   * (desempate total). Los que no conceden nada se descartan, así que una
   * página puede llegar vacía y con `nextCursor`: eso NO significa que no haya
   * más espacios. Solo `nextCursor: null` indica que no quedan candidatos.
   */
  public async listWithin(
    tx: PrismaTransaction,
    principal: HumanPrincipal,
    cursor: string | null,
    limit: number,
    now: Date,
  ): Promise<CareDirectoryPage> {
    const { decided, nextCursor } = await this.decidePageWithin(tx, principal, cursor, limit, now);
    return { items: decided.map((item) => item.entry), nextCursor };
  }

  /**
   * Página de contextos propios en los que MP01 concede `permission`
   * (MP07B / A06). Misma paginación por candidatos que el directorio: cada
   * página vuelve a decidir cada contexto con la política, sin abrir RLS del
   * tenant. Devuelve la autorización de `permission` para que el trabajo opere
   * con ella dentro de la misma transacción, junto con la entrada completa.
   */
  public async listAuthorizedPageWithin(
    tx: PrismaTransaction,
    principal: HumanPrincipal,
    permission: CareContextPermission,
    cursor: string | null,
    limit: number,
    now: Date,
  ): Promise<AuthorizedDirectoryPage> {
    const { decided, nextCursor } = await this.decidePageWithin(tx, principal, cursor, limit, now);
    const entries: AuthorizedDirectoryEntry[] = [];

    for (const item of decided) {
      const authorized = item.granted.get(permission);
      if (authorized !== undefined) {
        entries.push({
          authorized,
          entry: item.entry,
          organizationName: item.entry.organizationName,
          patientLabel: item.entry.patientLabel,
        });
      }
    }

    return { entries, nextCursor };
  }

  /**
   * Candidatos de UNA página y su decisión completa por MP01. Deja el ámbito
   * de organización limpio al terminar, también si algo falla después.
   */
  private async decidePageWithin(
    tx: PrismaTransaction,
    principal: HumanPrincipal,
    cursor: string | null,
    limit: number,
    now: Date,
  ): Promise<{
    readonly decided: readonly {
      readonly entry: CareDirectoryEntry;
      readonly granted: ReadonlyMap<CareContextPermission, AuthorizedCareContext>;
    }[];
    readonly nextCursor: string | null;
  }> {
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
    const decided: {
      readonly entry: CareDirectoryEntry;
      readonly granted: ReadonlyMap<CareContextPermission, AuthorizedCareContext>;
    }[] = [];

    for (const candidate of page) {
      await tx.$executeRaw`SELECT set_config('merdn.organization_id', ${candidate.organizationId}, true)`;

      // Una pasada por candidato: mismas concesiones que decidir acción por
      // acción, sin repetir sesión, organización ni contexto (MP07B / B06).
      const granted = await this.policy.decideManyWithin(
        tx,
        principal,
        { organizationId: candidate.organizationId, contextId: candidate.id },
        CARE_PERMISSIONS,
        now,
      );
      const actorKind = granted.values().next().value?.actorKind ?? null;

      if (actorKind === null) {
        continue;
      }

      decided.push({
        entry: {
          contextId: candidate.id,
          organizationId: candidate.organizationId,
          organizationName: candidate.organizationName,
          patientLabel: actorKind === 'PATIENT' ? 'Mi cuidado' : await this.patientLabel(tx, principal, candidate.patientId),
          actorKind,
          actions: [...granted.keys()],
        },
        granted,
      });
    }

    await tx.$executeRaw`SELECT set_config('merdn.organization_id', '', true)`;

    const last = page.at(-1);
    return { decided, nextCursor: candidates.length > pageSize && last !== undefined ? last.id : null };
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
