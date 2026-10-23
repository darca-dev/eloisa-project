import { Inject, Injectable } from '@nestjs/common';

import { CareContextAuditService } from '../care-context/care-context-audit.service';
import { type AuthorizedCareContext } from '../care-context/care-context.contract';
import { CareContextService } from '../care-context/care-context.service';
import { CareConflictError, findReceipt, lockContextForWrite, payloadHash, writeReceipt } from '../care-context/care-mutation';
import { CareNotFoundError, CareValidationError, isChoiceCode, isDecimalText } from '../care-context/care-request';
import { type PrismaTransaction } from '../database/prisma-transaction';
import { type CareObservableDefinition, Prisma } from '../generated/prisma/client';
import { type HumanPrincipal } from '../identity-access/human-principal';

import {
  type CriterionDefinitionView,
  type CriterionInput,
  type CriterionVersionView,
  type CriterionView,
  REVIEW_QUEUE_ALARM_PREVIEW,
  type ReviewQueueItem,
  type ReviewQueuePage,
  SEMAPHORE_LABELS,
  type SemaphoreView,
} from './care-criteria.contract';
import { semaphoreLevel } from './criterion-evaluator';

interface Request {
  readonly principal: HumanPrincipal;
  readonly correlationId: string;
  readonly now: Date;
}

const ENDPOINTS = {
  create: 'POST /api/v1/care/contexts/{contextId}/criteria',
  retire: 'POST /api/v1/care/contexts/{contextId}/criteria/{criterionId}/retire',
} as const;

/**
 * Criterios individuales, semáforo y cola de revisión (SPEC 055 / MP04–MP05).
 *
 * Definir, ajustar o retirar un criterio exige MANAGE_RULES con competencia
 * vigente para ESE contexto, decidido por MP01 en la misma transacción. Ningún
 * valor clínico se precarga ni se sugiere. Retirar un criterio NO cierra sus
 * alarmas abiertas: lo hace un revisor con motivo.
 */
@Injectable()
export class CareCriteriaService {
  constructor(
    @Inject(CareContextService) private readonly care: CareContextService,
    @Inject(CareContextAuditService) private readonly audit: CareContextAuditService,
  ) {}

  public list(request: Request, contextId: string): Promise<readonly CriterionView[]> {
    return this.care.withAuthorizedOwnContext(
      request.principal,
      contextId,
      ['MANAGE_RULES', 'REVIEW_ALARMS', 'VIEW_RECORDS'],
      request.correlationId,
      request.now,
      async (tx, authorized) => this.readAll(tx, authorized),
    );
  }

  public createVersion(request: Request, contextId: string, input: CriterionInput): Promise<CriterionView> {
    return this.care.withAuthorizedOwnContext(
      request.principal,
      contextId,
      ['MANAGE_RULES'],
      request.correlationId,
      request.now,
      async (tx, authorized) => {
        await lockContextForWrite(tx, authorized);
        const { idempotencyKey, observableDefinitionId, ...content } = input;
        // Sin definición explícita la huella es la misma que antes de MP07A.
        const hash = payloadHash({
          ...content,
          ...(observableDefinitionId === null ? {} : { observableDefinitionId }),
          validUntil: input.validUntil?.toISOString() ?? null,
        });
        const replay = await findReceipt(tx, authorized, 'criterion.create', idempotencyKey, hash);

        if (replay !== null) {
          return this.readOne(tx, authorized, replay);
        }

        // MP07A / A03: una validación NUEVA nombra la definición exacta que el
        // visitador vio; nunca se resuelve en silencio por código. Solo la
        // reproducción de un recibo ya confirmado (arriba) puede omitirla.
        if (observableDefinitionId === null) {
          throw new CareValidationError('observableDefinitionId', 'Indique la versión exacta del dato que validó.');
        }

        // Se compara con la definición vigente del código, bajo el mismo bloqueo
        // de negocio que reemplaza definiciones.
        const definition = await tx.careObservableDefinition.findFirst({
          where: { ...scope(authorized), code: input.observableCode, status: 'ACTIVE' },
          select: { id: true, valueType: true, options: true },
        });

        if (definition === null) {
          throw new CareValidationError('observableCode', 'El dato no está habilitado en este contexto.');
        }

        if (observableDefinitionId !== definition.id) {
          // El visitador validó otra versión del dato: no se le atribuye esta.
          throw new CareConflictError('VERSION_CONFLICT');
        }

        const value = typedCriterionValue(definition.valueType, input.comparator, input.value, definition.options);

        let criterionId = input.criterionId;
        let nextVersion = 1;

        if (criterionId !== null) {
          const existing = await tx.careAlarmCriterion.findFirst({
            where: { ...scope(authorized), id: criterionId, status: 'ACTIVE' },
            select: { id: true, versions: { orderBy: { version: 'desc' }, take: 1, select: { version: true } } },
          });

          if (existing === null) {
            throw new CareNotFoundError();
          }

          nextVersion = (existing.versions[0]?.version ?? 0) + 1;
          await tx.careAlarmCriterionVersion.updateMany({
            where: { ...scope(authorized), criterionId, status: 'ACTIVE' },
            data: { status: 'SUPERSEDED', supersededAt: request.now },
          });
        } else {
          const created = await tx.careAlarmCriterion.create({
            data: { ...scope(authorized), createdByHumanAccountId: authorized.humanAccountId },
            select: { id: true },
          });
          criterionId = created.id;
        }

        const version = await tx.careAlarmCriterionVersion.create({
          data: {
            ...scope(authorized),
            criterionId,
            version: nextVersion,
            observableDefinitionId: definition.id,
            observableCode: input.observableCode,
            valueType: definition.valueType,
            comparator: input.comparator,
            ...value,
            requiredCount: input.requiredCount,
            windowMinutes: input.windowMinutes,
            severity: input.severity,
            validUntil: input.validUntil,
            validatedByHumanAccountId: authorized.humanAccountId,
          },
          select: { id: true },
        });

        await writeReceipt(tx, authorized, 'criterion.create', idempotencyKey, hash, criterionId);
        await this.audit.recordMutationWithin(
          tx,
          {
            tenantId: authorized.tenantId,
            organizationId: authorized.organizationId,
            humanAccountId: authorized.humanAccountId,
            eventType: 'CARE_CRITERION_VALIDATED',
            resourceType: 'CareAlarmCriterionVersion',
            resourceId: version.id,
            endpoint: ENDPOINTS.create,
            correlationId: request.correlationId,
          },
          request.now,
        );

        return this.readOne(tx, authorized, criterionId);
      },
    );
  }

  public retire(request: Request, contextId: string, criterionId: string, reason: string): Promise<CriterionView> {
    return this.care.withAuthorizedOwnContext(
      request.principal,
      contextId,
      ['MANAGE_RULES'],
      request.correlationId,
      request.now,
      async (tx, authorized) => {
        await lockContextForWrite(tx, authorized);
        const criterion = await tx.careAlarmCriterion.findFirst({
          where: { ...scope(authorized), id: criterionId },
          select: { id: true, status: true },
        });

        if (criterion === null) {
          throw new CareNotFoundError();
        }

        if (criterion.status === 'RETIRED') {
          return this.readOne(tx, authorized, criterionId);
        }

        await tx.careAlarmCriterionVersion.updateMany({
          where: { ...scope(authorized), criterionId, status: 'ACTIVE' },
          data: { status: 'RETIRED', supersededAt: request.now },
        });
        await tx.careAlarmCriterion.update({
          where: { id: criterionId },
          data: { status: 'RETIRED', retiredAt: request.now, retiredByHumanAccountId: authorized.humanAccountId, retiredReason: reason },
        });
        await this.audit.recordMutationWithin(
          tx,
          {
            tenantId: authorized.tenantId,
            organizationId: authorized.organizationId,
            humanAccountId: authorized.humanAccountId,
            eventType: 'CARE_CRITERION_RETIRED',
            resourceType: 'CareAlarmCriterion',
            resourceId: criterionId,
            endpoint: ENDPOINTS.retire,
            correlationId: request.correlationId,
          },
          request.now,
        );

        return this.readOne(tx, authorized, criterionId);
      },
    );
  }

  public semaphore(request: Request, contextId: string): Promise<SemaphoreView> {
    return this.care.withAuthorizedOwnContext(
      request.principal,
      contextId,
      ['REVIEW_ALARMS', 'VIEW_RECORDS', 'MANAGE_RULES'],
      request.correlationId,
      request.now,
      async (tx, authorized) => semaphoreWithin(tx, authorized, request.now),
    );
  }

  /**
   * Una página de la cola: contextos que la cuenta puede revisar, cada uno con
   * su semáforo, el número de alarmas abiertas y un anticipo de las más
   * recientes (MP07B / A06). Nada se trunca en silencio: si el anticipo no
   * las incluye todas, `hasMoreOpenAlarms` lo dice y la bandeja del contexto
   * las recorre con su propio cursor.
   */
  public reviewQueue(request: Request, cursor: string | null, limit: number): Promise<ReviewQueuePage> {
    return this.care.withReviewableContexts(request.principal, cursor, limit, request.correlationId, request.now, async (tx, page) => {
      const items: ReviewQueueItem[] = [];

      for (const { authorized, entry } of page.entries) {
        await tx.$executeRaw`SELECT set_config('merdn.organization_id', ${authorized.organizationId}, true)`;
        const open = { ...scope(authorized), state: { not: 'CERRADA' as const } };
        const alarms = await tx.careAlarm.findMany({
          where: open,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: REVIEW_QUEUE_ALARM_PREVIEW + 1,
          select: { id: true, origin: true, severity: true, state: true, createdAt: true, assignedReviewerHumanAccountId: true },
        });
        const openAlarmCount = await tx.careAlarm.count({ where: open });
        const preview = alarms.slice(0, REVIEW_QUEUE_ALARM_PREVIEW);

        items.push({
          contextId: entry.contextId,
          organizationId: entry.organizationId,
          organizationName: entry.organizationName,
          patientLabel: entry.patientLabel,
          actorKind: entry.actorKind,
          actions: entry.actions,
          semaphore: await semaphoreWithin(tx, authorized, request.now),
          openAlarmCount,
          hasMoreOpenAlarms: alarms.length > REVIEW_QUEUE_ALARM_PREVIEW || openAlarmCount > preview.length,
          alarms: preview.map((alarm) => ({
            id: alarm.id,
            origin: alarm.origin,
            severity: alarm.severity,
            state: alarm.state,
            createdAt: alarm.createdAt.toISOString(),
            assignedToMe: alarm.assignedReviewerHumanAccountId === authorized.humanAccountId,
          })),
        });
      }

      await tx.$executeRaw`SELECT set_config('merdn.organization_id', '', true)`;
      return { items, nextCursor: page.nextCursor };
    });
  }

  private async readAll(tx: PrismaTransaction, authorized: AuthorizedCareContext): Promise<readonly CriterionView[]> {
    const rows = await tx.careAlarmCriterion.findMany({
      where: scope(authorized),
      orderBy: [{ createdAt: 'asc' }],
      include: LATEST_VERSION,
    });
    return rows.map(criterionView);
  }

  private async readOne(tx: PrismaTransaction, authorized: AuthorizedCareContext, criterionId: string): Promise<CriterionView> {
    const row = await tx.careAlarmCriterion.findFirstOrThrow({
      where: { ...scope(authorized), id: criterionId },
      include: LATEST_VERSION,
    });
    return criterionView(row);
  }
}

/** Última versión de cada criterio con su definición exacta, si la tiene. */
const LATEST_VERSION = {
  versions: { orderBy: { version: 'desc' }, take: 1, include: { observableDefinition: true } },
} as const satisfies Prisma.CareAlarmCriterionInclude;

/**
 * Semáforo de un contexto: alarmas abiertas por clasificación y criterios
 * vigentes, separando los evaluables de los que esperan revalidación (MP07A).
 * Un fallo de consulta se propaga: nunca se convierte en cero ni en estable.
 */
export async function semaphoreWithin(tx: PrismaTransaction, authorized: AuthorizedCareContext, now: Date): Promise<SemaphoreView> {
  const open = await tx.careAlarm.groupBy({
    by: ['severity'],
    where: { ...scope(authorized), state: { not: 'CERRADA' } },
    _count: { _all: true },
  });
  const vigentes = {
    ...scope(authorized),
    status: 'ACTIVE' as const,
    criterion: { status: 'ACTIVE' as const },
    OR: [{ validUntil: null }, { validUntil: { gt: now } }],
  };
  const activeCriteria = await tx.careAlarmCriterionVersion.count({
    where: { ...vigentes, observableDefinition: { status: 'ACTIVE' } },
  });
  const criteriaRequiringRevalidation = await tx.careAlarmCriterionVersion.count({
    where: {
      ...vigentes,
      AND: [{ OR: [{ observableDefinitionId: null }, { observableDefinition: { status: 'RETIRED' } }] }],
    },
  });

  const openAlarms = { ROJA: 0, AMARILLA: 0, ESTABLE: 0, SIN: 0 };
  for (const group of open) {
    openAlarms[group.severity ?? 'SIN'] += group._count._all;
  }

  const level = semaphoreLevel({ openBySeverity: openAlarms, activeCriteria, criteriaRequiringRevalidation });
  return { level, label: SEMAPHORE_LABELS[level], openAlarms, activeCriteria, criteriaRequiringRevalidation };
}

function scope(authorized: AuthorizedCareContext) {
  return {
    tenantId: authorized.tenantId,
    organizationId: authorized.organizationId,
    contextId: authorized.contextId,
    patientId: authorized.patientId,
  };
}

/** Valor tipado según la definición vigente. La comparación debe ser compatible. */
function typedCriterionValue(
  valueType: 'BOOLEAN' | 'NUMBER' | 'CHOICE',
  comparator: string,
  value: unknown,
  options: Prisma.JsonValue | null,
): { numberValue?: Prisma.Decimal; booleanValue?: boolean; choiceValues?: string[] } {
  if (valueType === 'BOOLEAN') {
    if (comparator !== 'EQ' || typeof value !== 'boolean') {
      throw new CareValidationError('value', 'Para un dato sí/no, elija «igual a» y la respuesta.');
    }
    return { booleanValue: value };
  }

  if (valueType === 'NUMBER') {
    if (comparator === 'IN' || !isDecimalText(value)) {
      throw new CareValidationError('value', 'Escriba un número válido y una comparación numérica.');
    }
    return { numberValue: new Prisma.Decimal(value) };
  }

  const allowed = new Set(
    (Array.isArray(options) ? options : [])
      .map((option) => (typeof option === 'object' && option !== null && !Array.isArray(option) ? option['code'] : null))
      .filter((code): code is string => typeof code === 'string'),
  );

  if (
    comparator !== 'IN' ||
    !Array.isArray(value) ||
    value.length === 0 ||
    value.length > 100 ||
    !value.every((item) => isChoiceCode(item) && allowed.has(item)) ||
    new Set(value).size !== value.length
  ) {
    throw new CareValidationError('value', 'Elija una o más opciones del dato.');
  }
  return { choiceValues: value as string[] };
}

function definitionView(row: CareObservableDefinition): CriterionDefinitionView {
  return {
    id: row.id,
    version: row.version,
    label: row.label,
    valueType: row.valueType,
    unit: row.unit,
    options: Array.isArray(row.options) ? (row.options as { code: string; label: string }[]) : null,
    status: row.status,
  };
}

function versionView(
  row: Prisma.CareAlarmCriterionVersionGetPayload<{ include: { observableDefinition: true } }>,
): CriterionVersionView {
  const definition = row.observableDefinition;

  return {
    id: row.id,
    version: row.version,
    observableDefinition: definition === null ? null : definitionView(definition),
    // Legado sin definición exacta o definición reemplazada: no se evalúa.
    requiresRevalidation: definition === null || definition.status !== 'ACTIVE',
    observableCode: row.observableCode,
    valueType: row.valueType,
    comparator: row.comparator,
    value:
      row.booleanValue ??
      row.numberValue?.toString() ??
      (Array.isArray(row.choiceValues) ? row.choiceValues.filter((item): item is string => typeof item === 'string') : []),
    requiredCount: row.requiredCount,
    windowMinutes: row.windowMinutes,
    severity: row.severity,
    activatedAt: row.activatedAt.toISOString(),
    validUntil: row.validUntil?.toISOString() ?? null,
    status: row.status,
  };
}

function criterionView(row: Prisma.CareAlarmCriterionGetPayload<{ include: typeof LATEST_VERSION }>): CriterionView {
  const latest = row.versions[0];
  return {
    id: row.id,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    retiredAt: row.retiredAt?.toISOString() ?? null,
    retiredReason: row.retiredReason,
    current: latest === undefined ? null : versionView(latest),
  };
}
