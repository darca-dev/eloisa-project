import { Inject, Injectable } from '@nestjs/common';

import { CareContextAuditService } from '../care-context/care-context-audit.service';
import { type AuthorizedCareContext } from '../care-context/care-context.contract';
import { CareContextService } from '../care-context/care-context.service';
import { findReceipt, lockContextForWrite, payloadHash, writeReceipt } from '../care-context/care-mutation';
import { CareNotFoundError, CareValidationError, isChoiceCode, isDecimalText } from '../care-context/care-request';
import { type PrismaTransaction } from '../database/prisma-transaction';
import { Prisma } from '../generated/prisma/client';
import { type HumanPrincipal } from '../identity-access/human-principal';

import {
  type CriterionInput,
  type CriterionVersionView,
  type CriterionView,
  type ReviewQueueItem,
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
        const { idempotencyKey, ...content } = input;
        const hash = payloadHash({ ...content, validUntil: input.validUntil?.toISOString() ?? null });
        const replay = await findReceipt(tx, authorized, 'criterion.create', idempotencyKey, hash);

        if (replay !== null) {
          return this.readOne(tx, authorized, replay);
        }

        const definition = await tx.careObservableDefinition.findFirst({
          where: { ...scope(authorized), code: input.observableCode, status: 'ACTIVE' },
          select: { valueType: true, options: true },
        });

        if (definition === null) {
          throw new CareValidationError('observableCode', 'El dato no está habilitado en este contexto.');
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

  /** Alarmas abiertas de todos los contextos que la cuenta puede revisar. */
  public reviewQueue(request: Request): Promise<readonly ReviewQueueItem[]> {
    return this.care.withReviewableContexts(request.principal, request.correlationId, request.now, async (tx, contexts) => {
      const items: ReviewQueueItem[] = [];

      for (const { authorized, organizationName, patientLabel } of contexts) {
        await tx.$executeRaw`SELECT set_config('merdn.organization_id', ${authorized.organizationId}, true)`;
        const alarms = await tx.careAlarm.findMany({
          where: { ...scope(authorized), state: { not: 'CERRADA' } },
          orderBy: [{ createdAt: 'desc' }],
          take: 50,
          select: { id: true, origin: true, severity: true, state: true, createdAt: true, assignedReviewerHumanAccountId: true },
        });

        items.push({
          contextId: authorized.contextId,
          organizationName,
          patientLabel,
          semaphore: await semaphoreWithin(tx, authorized, request.now),
          alarms: alarms.map((alarm) => ({
            id: alarm.id,
            origin: alarm.origin,
            severity: alarm.severity,
            state: alarm.state,
            createdAt: alarm.createdAt.toISOString(),
            assignedToMe: alarm.assignedReviewerHumanAccountId === authorized.humanAccountId,
          })),
        });
      }

      return items;
    });
  }

  private async readAll(tx: PrismaTransaction, authorized: AuthorizedCareContext): Promise<readonly CriterionView[]> {
    const rows = await tx.careAlarmCriterion.findMany({
      where: scope(authorized),
      orderBy: [{ createdAt: 'asc' }],
      include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
    });
    return rows.map(criterionView);
  }

  private async readOne(tx: PrismaTransaction, authorized: AuthorizedCareContext, criterionId: string): Promise<CriterionView> {
    const row = await tx.careAlarmCriterion.findFirstOrThrow({
      where: { ...scope(authorized), id: criterionId },
      include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
    });
    return criterionView(row);
  }
}

/** Semáforo de un contexto: alarmas abiertas por clasificación y criterios vigentes. */
export async function semaphoreWithin(tx: PrismaTransaction, authorized: AuthorizedCareContext, now: Date): Promise<SemaphoreView> {
  const open = await tx.careAlarm.groupBy({
    by: ['severity'],
    where: { ...scope(authorized), state: { not: 'CERRADA' } },
    _count: { _all: true },
  });
  const activeCriteria = await tx.careAlarmCriterionVersion.count({
    where: { ...scope(authorized), status: 'ACTIVE', OR: [{ validUntil: null }, { validUntil: { gt: now } }], criterion: { status: 'ACTIVE' } },
  });

  const openAlarms = { ROJA: 0, AMARILLA: 0, ESTABLE: 0, SIN: 0 };
  for (const group of open) {
    openAlarms[group.severity ?? 'SIN'] += group._count._all;
  }

  const level = semaphoreLevel({ openBySeverity: openAlarms, activeCriteria });
  return { level, label: SEMAPHORE_LABELS[level], openAlarms, activeCriteria };
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

function versionView(row: {
  id: string;
  version: number;
  observableCode: string;
  valueType: 'BOOLEAN' | 'NUMBER' | 'CHOICE';
  comparator: 'EQ' | 'NEQ' | 'GT' | 'GTE' | 'LT' | 'LTE' | 'IN';
  numberValue: Prisma.Decimal | null;
  booleanValue: boolean | null;
  choiceValues: Prisma.JsonValue | null;
  requiredCount: number;
  windowMinutes: number;
  severity: 'ROJA' | 'AMARILLA' | 'ESTABLE';
  activatedAt: Date;
  validUntil: Date | null;
  status: 'ACTIVE' | 'SUPERSEDED' | 'RETIRED';
}): CriterionVersionView {
  return {
    id: row.id,
    version: row.version,
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

function criterionView(
  row: Prisma.CareAlarmCriterionGetPayload<{ include: { versions: true } }>,
): CriterionView {
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
