import { Inject, Injectable } from '@nestjs/common';

import { CareContextAuditService } from '../care-context/care-context-audit.service';
import { type AuthorizedCareContext } from '../care-context/care-context.contract';
import { CareContextService } from '../care-context/care-context.service';
import { CareConflictError, findReceipt, lockContextForWrite, payloadHash, writeReceipt } from '../care-context/care-mutation';
import { CareNotFoundError, CareValidationError, encodeCursor } from '../care-context/care-request';
import { type PrismaTransaction } from '../database/prisma-transaction';
import { type Prisma } from '../generated/prisma/client';
import { type HumanPrincipal } from '../identity-access/human-principal';

import { applyTransition } from './care-alarm-transitions';
import {
  type CareAlarmDetailView,
  type CareAlarmPage,
  type CareAlarmView,
  MANUAL_RECEIPT_MESSAGE,
  type ManualAlarmCreatedView,
  type ManualAlarmInput,
  type ResolutionReportInput,
  type TransitionInput,
} from './care-alerts.contract';

interface Request {
  readonly principal: HumanPrincipal;
  readonly correlationId: string;
  readonly now: Date;
}

const ENDPOINTS = {
  create: 'POST /api/v1/care/contexts/{contextId}/alarms',
  transition: 'POST /api/v1/care/contexts/{contextId}/alarms/{alarmId}/transitions',
  report: 'POST /api/v1/care/contexts/{contextId}/alarms/{alarmId}/resolution-reports',
} as const;

const TRANSITION_MESSAGES = {
  STATE: 'La alarma ya no está en un estado que permita esa acción.',
  REASON_REQUIRED: 'Escriba el motivo de esta acción.',
  SEVERITY_REQUIRED: 'Elija la clasificación.',
  ASSIGNEE_REQUIRED: 'Indique a quién se asigna.',
} as const;

/**
 * Alarmas manuales y su seguimiento (SPEC 055 / MP03, D05–D06).
 *
 * Pedir ayuda exige REQUEST_ALARM; revisar, clasificar, asignar, resolver,
 * cerrar o reabrir exige REVIEW_ALARMS con competencia vigente, comprobado por
 * la política de MP01 en la misma transacción. La alarma manual se persiste
 * NUEVA y sin clasificación, visible al instante en la bandeja autorizada; no
 * se envía WhatsApp ni correo y no se afirma que alguien la haya visto.
 */
@Injectable()
export class CareAlertsService {
  constructor(
    @Inject(CareContextService) private readonly care: CareContextService,
    @Inject(CareContextAuditService) private readonly audit: CareContextAuditService,
  ) {}

  /** Revisor: todas las del contexto. Solicitante: solo las que inició. */
  public list(
    request: Request,
    contextId: string,
    cursor: { readonly at: Date; readonly id: string } | null,
    limit: number,
  ): Promise<CareAlarmPage> {
    return this.care.withAuthorizedOwnContext(
      request.principal,
      contextId,
      ['REVIEW_ALARMS', 'REQUEST_ALARM'],
      request.correlationId,
      request.now,
      async (tx, authorized) => {
        const rows = await tx.careAlarm.findMany({
          where: {
            ...scopeOf(authorized),
            ...visibleTo(authorized),
            ...(cursor === null
              ? {}
              : { OR: [{ createdAt: { lt: cursor.at } }, { createdAt: cursor.at, id: { lt: cursor.id } }] }),
          },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: limit + 1,
        });
        const page = rows.slice(0, limit);
        const last = page.at(-1);

        return {
          items: page.map((row) => alarmView(row, authorized.humanAccountId)),
          nextCursor: rows.length > limit && last !== undefined ? encodeCursor(last.createdAt, last.id) : null,
          canReview: authorized.permission === 'REVIEW_ALARMS',
        };
      },
    );
  }

  public detail(request: Request, contextId: string, alarmId: string): Promise<CareAlarmDetailView> {
    return this.care.withAuthorizedOwnContext(
      request.principal,
      contextId,
      ['REVIEW_ALARMS', 'REQUEST_ALARM'],
      request.correlationId,
      request.now,
      async (tx, authorized) => this.readDetail(tx, authorized, alarmId),
    );
  }

  /** Solicitud manual idempotente. Sin regla, sin severidad y sin estado del cliente. */
  public createManual(request: Request, contextId: string, input: ManualAlarmInput): Promise<ManualAlarmCreatedView> {
    return this.care.withAuthorizedOwnContext(
      request.principal,
      contextId,
      ['REQUEST_ALARM'],
      request.correlationId,
      request.now,
      async (tx, authorized) => {
        await lockContextForWrite(tx, authorized);
        const { idempotencyKey, ...content } = input;
        const hash = payloadHash(content);
        const replay = await findReceipt(tx, authorized, 'alarm.create', idempotencyKey, hash);

        if (replay !== null) {
          const existing = await tx.careAlarm.findFirstOrThrow({ where: { ...scopeOf(authorized), id: replay } });
          return { alarm: alarmView(existing, authorized.humanAccountId), receiptMessage: MANUAL_RECEIPT_MESSAGE };
        }

        const alarm = await tx.careAlarm.create({
          data: {
            ...scopeOf(authorized),
            origin: 'MANUAL',
            initiatedByHumanAccountId: authorized.humanAccountId,
            reasonCode: input.reasonCode,
            note: input.note,
          },
        });

        await tx.careAlarmTransition.create({
          data: {
            ...scopeOf(authorized),
            alarmId: alarm.id,
            actorHumanAccountId: authorized.humanAccountId,
            action: 'CREATE',
            stateBefore: null,
            stateAfter: 'NUEVA',
          },
          select: { id: true },
        });

        await writeReceipt(tx, authorized, 'alarm.create', idempotencyKey, hash, alarm.id);
        await this.audit.recordMutationWithin(
          tx,
          {
            ...auditBase(authorized, request),
            eventType: 'CARE_ALARM_CREATED',
            resourceType: 'CareAlarm',
            resourceId: alarm.id,
            endpoint: ENDPOINTS.create,
          },
          request.now,
        );

        return { alarm: alarmView(alarm, authorized.humanAccountId), receiptMessage: MANUAL_RECEIPT_MESSAGE };
      },
    );
  }

  /**
   * Transición del revisor con CAS sobre `version`. Una carrera devuelve
   * conflicto; estado, historia y auditoría cambian en la misma transacción.
   */
  public transition(
    request: Request,
    contextId: string,
    alarmId: string,
    input: TransitionInput,
  ): Promise<CareAlarmDetailView> {
    return this.care.withAuthorizedOwnContext(
      request.principal,
      contextId,
      ['REVIEW_ALARMS'],
      request.correlationId,
      request.now,
      async (tx, authorized) => {
        await lockContextForWrite(tx, authorized);
        const alarm = await tx.careAlarm.findFirst({ where: { ...scopeOf(authorized), id: alarmId } });

        if (alarm === null) {
          throw new CareNotFoundError();
        }

        if (alarm.version !== input.expectedVersion) {
          throw new CareConflictError('VERSION_CONFLICT');
        }

        const assignee =
          input.assignee === undefined
            ? undefined
            : input.assignee === 'self'
              ? authorized.humanAccountId
              : input.assignee;

        if (assignee !== undefined && !(await reviewerHolds(tx, authorized, assignee, request.now))) {
          throw new CareValidationError('assignee', 'Esa persona no puede revisar alarmas en este contexto.');
        }

        const outcome = applyTransition(
          { state: alarm.state, severity: alarm.severity, assignedReviewerHumanAccountId: alarm.assignedReviewerHumanAccountId },
          {
            action: input.action,
            reason: input.reason,
            ...(input.severity === undefined ? {} : { severity: input.severity }),
            ...(assignee === undefined ? {} : { assigneeHumanAccountId: assignee }),
          },
        );

        if (!outcome.ok) {
          throw new CareValidationError(outcome.reason === 'STATE' ? 'action' : 'reason', TRANSITION_MESSAGES[outcome.reason]);
        }

        const updated = await tx.careAlarm.updateMany({
          where: { ...scopeOf(authorized), id: alarm.id, version: input.expectedVersion },
          data: {
            state: outcome.next.state,
            severity: outcome.next.severity,
            assignedReviewerHumanAccountId: outcome.next.assignedReviewerHumanAccountId,
            version: { increment: 1 },
            ...(outcome.resolvedNow ? { resolvedAt: request.now } : {}),
            ...(outcome.closedNow ? { closedAt: request.now } : {}),
            ...(input.action === 'REOPEN' ? { closedAt: null } : {}),
          },
        });

        if (updated.count !== 1) {
          throw new CareConflictError('VERSION_CONFLICT');
        }

        const transition = await tx.careAlarmTransition.create({
          data: {
            ...scopeOf(authorized),
            alarmId: alarm.id,
            actorHumanAccountId: authorized.humanAccountId,
            action: input.action,
            stateBefore: alarm.state,
            stateAfter: outcome.next.state,
            severityBefore: alarm.severity,
            severityAfter: outcome.next.severity,
            assignedBefore: alarm.assignedReviewerHumanAccountId,
            assignedAfter: outcome.next.assignedReviewerHumanAccountId,
            reason: input.reason,
          },
          select: { id: true },
        });

        await this.audit.recordMutationWithin(
          tx,
          {
            ...auditBase(authorized, request),
            eventType: 'CARE_ALARM_TRANSITIONED',
            resourceType: 'CareAlarmTransition',
            resourceId: transition.id,
            endpoint: ENDPOINTS.transition,
          },
          request.now,
        );

        return this.readDetail(tx, authorized, alarm.id);
      },
    );
  }

  /**
   * El iniciador informa que se resolvió. Queda en la historia; NO cambia el
   * estado ni la severidad: un profesional autorizado lo confirma.
   */
  public reportResolution(
    request: Request,
    contextId: string,
    alarmId: string,
    input: ResolutionReportInput,
  ): Promise<CareAlarmDetailView> {
    return this.care.withAuthorizedOwnContext(
      request.principal,
      contextId,
      ['REQUEST_ALARM'],
      request.correlationId,
      request.now,
      async (tx, authorized) => {
        await lockContextForWrite(tx, authorized);
        const { idempotencyKey, ...content } = input;
        const hash = payloadHash({ ...content, alarmId });
        const replay = await findReceipt(tx, authorized, 'alarm.report', idempotencyKey, hash);

        if (replay !== null) {
          return this.readDetail(tx, authorized, alarmId);
        }

        const alarm = await tx.careAlarm.findFirst({
          where: { ...scopeOf(authorized), id: alarmId, initiatedByHumanAccountId: authorized.humanAccountId },
        });

        if (alarm === null) {
          throw new CareNotFoundError();
        }

        const transition = await tx.careAlarmTransition.create({
          data: {
            ...scopeOf(authorized),
            alarmId: alarm.id,
            actorHumanAccountId: authorized.humanAccountId,
            action: 'REPORT_RESOLUTION',
            stateBefore: alarm.state,
            stateAfter: alarm.state,
            severityBefore: alarm.severity,
            severityAfter: alarm.severity,
            assignedBefore: alarm.assignedReviewerHumanAccountId,
            assignedAfter: alarm.assignedReviewerHumanAccountId,
            reason: input.note,
          },
          select: { id: true },
        });

        await writeReceipt(tx, authorized, 'alarm.report', idempotencyKey, hash, transition.id);
        await this.audit.recordMutationWithin(
          tx,
          {
            ...auditBase(authorized, request),
            eventType: 'CARE_ALARM_TRANSITIONED',
            resourceType: 'CareAlarmTransition',
            resourceId: transition.id,
            endpoint: ENDPOINTS.report,
          },
          request.now,
        );

        return this.readDetail(tx, authorized, alarm.id);
      },
    );
  }

  private async readDetail(
    tx: PrismaTransaction,
    authorized: AuthorizedCareContext,
    alarmId: string,
  ): Promise<CareAlarmDetailView> {
    const alarm = await tx.careAlarm.findFirst({
      where: { ...scopeOf(authorized), ...visibleTo(authorized), id: alarmId },
      include: {
        transitions: { orderBy: { createdAt: 'asc' } },
        evidence: {
          orderBy: { createdAt: 'asc' },
          include: {
            observation: {
              include: {
                definition: true,
                record: { select: { occurredAt: true } },
                amendments: { select: { id: true }, take: 1 },
              },
            },
          },
        },
      },
    });

    if (alarm === null) {
      throw new CareNotFoundError();
    }

    return {
      ...alarmView(alarm, authorized.humanAccountId),
      evidence: alarm.evidence.map((item) => ({
        label: item.observation.definition.label,
        unit: item.observation.definition.unit,
        valueType: item.observation.definition.valueType,
        value: item.observation.valueBoolean ?? item.observation.valueNumber?.toString() ?? item.observation.valueChoice,
        occurredAt: item.observation.record.occurredAt.toISOString(),
        // D04.5: una corrección posterior no retira la evidencia; se señala.
        correctedAfterwards: item.observation.amendments.length > 0,
      })),
      transitions: alarm.transitions.map((transition) => ({
        id: transition.id,
        action: transition.action,
        stateBefore: transition.stateBefore,
        stateAfter: transition.stateAfter,
        severityBefore: transition.severityBefore,
        severityAfter: transition.severityAfter,
        reason: transition.reason,
        createdAt: transition.createdAt.toISOString(),
        byMe: transition.actorHumanAccountId === authorized.humanAccountId,
      })),
    };
  }
}

/**
 * La persona a la que se asigna debe poder revisar ESTE contexto: concesión
 * REVIEW_ALARMS vigente y competencia vigente validada por otra persona. Se
 * bloquean ambas filas hasta el commit.
 */
async function reviewerHolds(
  tx: PrismaTransaction,
  authorized: AuthorizedCareContext,
  humanAccountId: string,
  now: Date,
): Promise<boolean> {
  const rows = await tx.$queryRaw<{ readonly id: string }[]>`
    SELECT a."id"
      FROM "care_authorization" a
      JOIN "clinical_competence_attestation" c
        ON c."id" = a."competenceAttestationId"
       AND c."tenantId" = a."tenantId"
       AND c."organizationId" = a."organizationId"
       AND c."humanAccountId" = a."humanAccountId"
     WHERE a."tenantId" = ${authorized.tenantId}::uuid
       AND a."organizationId" = ${authorized.organizationId}::uuid
       AND a."contextId" = ${authorized.contextId}::uuid
       AND a."humanAccountId" = ${humanAccountId}::uuid
       AND a."permission" = 'REVIEW_ALARMS'
       AND a."status" = 'ACTIVE'
       AND a."startsAt" <= ${now}::timestamptz
       AND (a."endsAt" IS NULL OR a."endsAt" > ${now}::timestamptz)
       AND c."status" = 'ACTIVE'
       AND c."validatedByHumanAccountId" <> c."humanAccountId"
       AND c."startsAt" <= ${now}::timestamptz
       AND (c."endsAt" IS NULL OR c."endsAt" > ${now}::timestamptz)
     ORDER BY a."id"
     FOR SHARE`;

  return rows.length > 0;
}

function scopeOf(authorized: AuthorizedCareContext) {
  return {
    tenantId: authorized.tenantId,
    organizationId: authorized.organizationId,
    contextId: authorized.contextId,
    patientId: authorized.patientId,
  };
}

/** El solicitante sin REVIEW_ALARMS solo ve las alarmas que inició. */
function visibleTo(authorized: AuthorizedCareContext): Prisma.CareAlarmWhereInput {
  return authorized.permission === 'REVIEW_ALARMS' ? {} : { initiatedByHumanAccountId: authorized.humanAccountId };
}

function auditBase(authorized: AuthorizedCareContext, request: Request) {
  return {
    tenantId: authorized.tenantId,
    organizationId: authorized.organizationId,
    humanAccountId: authorized.humanAccountId,
    correlationId: request.correlationId,
  };
}

function alarmView(
  row: {
    id: string;
    origin: 'MANUAL' | 'AUTOMATIC';
    reasonCode: string;
    note: string | null;
    severity: 'ROJA' | 'AMARILLA' | 'ESTABLE' | null;
    state: 'NUEVA' | 'EN_GESTION' | 'RESUELTA' | 'CERRADA';
    assignedReviewerHumanAccountId: string | null;
    initiatedByHumanAccountId: string;
    version: number;
    createdAt: Date;
    updatedAt: Date;
    resolvedAt: Date | null;
    closedAt: Date | null;
  },
  viewer: string,
): CareAlarmView {
  return {
    id: row.id,
    origin: row.origin,
    reasonCode: row.reasonCode,
    note: row.note,
    severity: row.severity,
    state: row.state,
    assigned: row.assignedReviewerHumanAccountId !== null,
    assignedToMe: row.assignedReviewerHumanAccountId === viewer,
    initiatedByMe: row.initiatedByHumanAccountId === viewer,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    closedAt: row.closedAt?.toISOString() ?? null,
  };
}
