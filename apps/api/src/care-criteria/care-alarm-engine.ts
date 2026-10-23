import { Inject, Injectable } from '@nestjs/common';

import { CareContextAuditService } from '../care-context/care-context-audit.service';
import { type AuthorizedCareContext } from '../care-context/care-context.contract';
import { type PrismaTransaction } from '../database/prisma-transaction';
import { Prisma } from '../generated/prisma/client';

import { type Candidate, type CriterionSpec, evaluate } from './criterion-evaluator';

export interface EngineOutcome {
  /** Episodios nuevos abiertos por este registro. */
  readonly alarmsOpened: number;
  /** Coincidencias agregadas como evidencia a episodios ya abiertos. */
  readonly evidenceAdded: number;
}

interface CandidateRow {
  readonly observationId: string;
  readonly occurrenceKey: string;
  readonly occurredAt: Date;
  readonly valueBoolean: boolean | null;
  readonly valueNumber: string | null;
  readonly valueChoice: string | null;
  /** Enmienda cuyo reemplazo es el valor efectivo, o `null` si rige el original. */
  readonly amendmentId: string | null;
  /** Última secuencia de enmiendas del registro en este instante (0 = ninguna). */
  readonly amendmentSequence: number;
  readonly alreadyEvidence: boolean;
  readonly amended: boolean;
}

const ENDPOINT = 'POST /api/v1/care/contexts/{contextId}/records';

/**
 * Motor SÍNCRONO de alarmas automáticas (SPEC 055 / MP04, D04–D05, D07;
 * corregido en MP07A: A03, A04 y A07).
 *
 * Se invoca DENTRO de la transacción que creó el registro, después del bloqueo
 * de negocio del contexto: decisión de MP01, registro, evaluación, alarma,
 * evidencia y auditoría confirman o revierten juntos. Sin worker, sin cola y sin
 * notificaciones externas.
 *
 * - A03: solo evalúa versiones ACTIVE vigentes de criterios ACTIVE que citan la
 *   definición EXACTA y vigente de una observación canónica nueva del registro.
 *   Una versión legada sin definición, o cuya definición fue reemplazada, no se
 *   evalúa: no se trasladan reglas ni se convierten unidades.
 * - A04: lo consumido se decide por la identidad del evento (contexto + código
 *   del observable + `occurrenceKey`) en cualquier alarma del criterio. Tras un
 *   episodio cerrado solo cuenta lo ocurrido estrictamente después del cierre,
 *   también al agregar evidencia al episodio siguiente.
 * - A07: cada evidencia nueva fija el valor efectivo evaluado, la definición, la
 *   enmienda vigente y la secuencia de enmiendas del registro.
 *
 * Una enmienda NO llama al motor (D04.5, ver contrato MP04–05 §4).
 */
@Injectable()
export class CareAlarmEngine {
  constructor(@Inject(CareContextAuditService) private readonly audit: CareContextAuditService) {}

  public async evaluateWithin(
    tx: PrismaTransaction,
    authorized: AuthorizedCareContext,
    recordId: string,
    correlationId: string | null,
    now: Date,
  ): Promise<EngineOutcome> {
    const record = await tx.careRecord.findFirstOrThrow({
      where: { id: recordId, contextId: authorized.contextId },
      select: {
        receivedAt: true,
        // Una observación vinculada a un evento ya registrado no es una ocurrencia nueva.
        observations: { where: { canonicalObservationId: null }, select: { definitionId: true } },
      },
    });

    const definitionIds = [...new Set(record.observations.map((observation) => observation.definitionId))];

    if (definitionIds.length === 0) {
      return { alarmsOpened: 0, evidenceAdded: 0 };
    }

    const versions = await tx.careAlarmCriterionVersion.findMany({
      where: {
        ...scope(authorized),
        status: 'ACTIVE',
        observableDefinitionId: { in: definitionIds },
        observableDefinition: { status: 'ACTIVE' },
        activatedAt: { lte: record.receivedAt },
        OR: [{ validUntil: null }, { validUntil: { gt: record.receivedAt } }],
        criterion: { status: 'ACTIVE' },
      },
      orderBy: { id: 'asc' },
    });

    let alarmsOpened = 0;
    let evidenceAdded = 0;

    for (const version of versions) {
      const definitionId = version.observableDefinitionId;

      if (definitionId === null) {
        // Inalcanzable por el filtro; una versión legada nunca se evalúa.
        continue;
      }

      const spec: CriterionSpec = {
        valueType: version.valueType,
        comparator: version.comparator,
        numberValue: version.numberValue?.toString() ?? null,
        booleanValue: version.booleanValue,
        choiceValues: Array.isArray(version.choiceValues) ? version.choiceValues.filter((item): item is string => typeof item === 'string') : null,
        requiredCount: version.requiredCount,
        windowMinutes: version.windowMinutes,
        activatedAt: version.activatedAt,
        validUntil: version.validUntil,
      };

      const lastClosure = await tx.careAlarm.aggregate({
        where: { ...scope(authorized), criterionId: version.criterionId, origin: 'AUTOMATIC', state: 'CERRADA' },
        _max: { closedAt: true },
      });
      const closedBoundary = lastClosure._max.closedAt;

      const rows = await this.candidates(tx, authorized, version.criterionId, definitionId, spec, record.receivedAt);
      const byObservation = new Map(rows.map((row) => [row.observationId, row]));
      const candidates = rows.map(
        (row): Candidate => ({
          observationId: row.observationId,
          occurrenceKey: row.occurrenceKey,
          occurredAt: row.occurredAt,
          value: row.valueBoolean ?? row.valueNumber ?? row.valueChoice,
          alreadyEvidence: row.alreadyEvidence,
          amended: row.amended,
        }),
      );

      const result = evaluate(spec, candidates, record.receivedAt, closedBoundary);

      const addEvidence = async (alarmId: string, observationId: string): Promise<void> => {
        const row = byObservation.get(observationId);

        if (row === undefined) {
          throw new Error('care-alarm-engine: coincidencia sin fila de candidato');
        }

        await tx.careAlarmEvidence.create({
          data: {
            ...scope(authorized),
            alarmId,
            observationId,
            criterionVersionId: version.id,
            ...snapshotOf(definitionId, row),
          },
          select: { id: true },
        });
      };

      const open = await tx.careAlarm.findFirst({
        where: { ...scope(authorized), criterionId: version.criterionId, origin: 'AUTOMATIC', state: { not: 'CERRADA' } },
        select: { id: true },
      });

      if (open !== null) {
        // Episodio abierto: las coincidencias nuevas son evidencia, no otra alarma.
        for (const match of result.matching) {
          await addEvidence(open.id, match.observationId);
          evidenceAdded += 1;
        }
        continue;
      }

      if (!result.met) {
        continue;
      }

      const previous = await tx.careAlarm.findFirst({
        where: { ...scope(authorized), criterionId: version.criterionId, origin: 'AUTOMATIC', state: 'CERRADA' },
        orderBy: { closedAt: 'desc' },
        select: { id: true },
      });

      const alarm = await tx.careAlarm.create({
        data: {
          ...scope(authorized),
          origin: 'AUTOMATIC',
          initiatedByHumanAccountId: authorized.humanAccountId,
          reasonCode: 'CRITERION_MET',
          severity: version.severity,
          criterionId: version.criterionId,
          criterionVersionId: version.id,
          previousAlarmId: previous?.id ?? null,
        },
        select: { id: true },
      });

      await tx.careAlarmTransition.create({
        data: {
          ...scope(authorized),
          alarmId: alarm.id,
          actorHumanAccountId: authorized.humanAccountId,
          action: 'CREATE',
          stateBefore: null,
          stateAfter: 'NUEVA',
          severityBefore: null,
          severityAfter: version.severity,
          reason: 'Se cumplió un criterio individual definido por el profesional.',
        },
        select: { id: true },
      });

      for (const match of result.matching) {
        await addEvidence(alarm.id, match.observationId);
      }

      await this.audit.recordMutationWithin(
        tx,
        {
          tenantId: authorized.tenantId,
          organizationId: authorized.organizationId,
          humanAccountId: authorized.humanAccountId,
          eventType: 'CARE_ALARM_CREATED',
          resourceType: 'CareAlarm',
          resourceId: alarm.id,
          endpoint: ENDPOINT,
          correlationId,
        },
        now,
      );

      alarmsOpened += 1;
    }

    return { alarmsOpened, evidenceAdded };
  }

  /**
   * Observaciones canónicas de la definición EXACTA en la ventana, con su valor
   * EFECTIVO (último reemplazo de enmienda o el original), la enmienda y la
   * secuencia vigentes, y si su IDENTIDAD de evento ya es evidencia de alguna
   * alarma de este criterio.
   */
  private candidates(
    tx: PrismaTransaction,
    authorized: AuthorizedCareContext,
    criterionId: string,
    definitionId: string,
    spec: CriterionSpec,
    receivedAt: Date,
  ): Promise<CandidateRow[]> {
    const start = new Date(receivedAt.getTime() - spec.windowMinutes * 60_000);

    return tx.$queryRaw<CandidateRow[]>`
      SELECT o."id" AS "observationId",
             o."occurrenceKey"::text AS "occurrenceKey",
             r."occurredAt",
             COALESCE(last."replacementBoolean", CASE WHEN last."id" IS NULL THEN o."valueBoolean" END) AS "valueBoolean",
             COALESCE(last."replacementNumber", CASE WHEN last."id" IS NULL THEN o."valueNumber" END)::text AS "valueNumber",
             COALESCE(last."replacementChoice", CASE WHEN last."id" IS NULL THEN o."valueChoice" END) AS "valueChoice",
             last."id" AS "amendmentId",
             COALESCE((
               SELECT max(s."sequence")
                 FROM "care_record_amendment" s
                WHERE s."recordId" = o."recordId" AND s."contextId" = o."contextId"
             ), 0)::int AS "amendmentSequence",
             EXISTS (
               SELECT 1
                 FROM "care_alarm_evidence" e
                 JOIN "care_alarm" a ON a."id" = e."alarmId" AND a."contextId" = e."contextId"
                 JOIN "care_observation" eo ON eo."id" = e."observationId" AND eo."contextId" = e."contextId"
                 JOIN "care_observable_definition" ed ON ed."id" = eo."definitionId" AND ed."contextId" = eo."contextId"
                WHERE e."contextId" = o."contextId"
                  AND a."criterionId" = ${criterionId}::uuid
                  AND ed."code" = d."code"
                  AND eo."occurrenceKey" = o."occurrenceKey"
             ) AS "alreadyEvidence",
             EXISTS (
               SELECT 1 FROM "care_record_amendment" am
                WHERE am."observationId" = o."id" AND am."contextId" = o."contextId"
             ) AS "amended"
        FROM "care_observation" o
        JOIN "care_record" r ON r."id" = o."recordId" AND r."contextId" = o."contextId"
        JOIN "care_observable_definition" d ON d."id" = o."definitionId" AND d."contextId" = o."contextId"
        LEFT JOIN LATERAL (
          SELECT am."id", am."replacementBoolean", am."replacementNumber", am."replacementChoice"
            FROM "care_record_amendment" am
           WHERE am."observationId" = o."id" AND am."contextId" = o."contextId"
             AND num_nonnulls(am."replacementBoolean", am."replacementNumber", am."replacementChoice") = 1
           ORDER BY am."sequence" DESC
           LIMIT 1
        ) last ON true
       WHERE o."tenantId" = ${authorized.tenantId}::uuid
         AND o."organizationId" = ${authorized.organizationId}::uuid
         AND o."contextId" = ${authorized.contextId}::uuid
         AND o."canonicalObservationId" IS NULL
         AND o."definitionId" = ${definitionId}::uuid
         AND r."occurredAt" >= ${start}::timestamptz
         AND r."occurredAt" <= ${receivedAt}::timestamptz
       ORDER BY r."occurredAt", o."id"`;
  }
}

/** Snapshot tipado de lo evaluado (A07). Sin texto clínico. */
function snapshotOf(definitionId: string, row: CandidateRow) {
  return {
    observableDefinitionId: definitionId,
    evaluatedValueBoolean: row.valueBoolean,
    evaluatedValueNumber: row.valueNumber === null ? null : new Prisma.Decimal(row.valueNumber),
    evaluatedValueChoice: row.valueChoice,
    evaluatedAmendmentId: row.amendmentId,
    amendmentSequenceAtEvaluation: row.amendmentSequence,
  };
}

function scope(authorized: AuthorizedCareContext) {
  return {
    tenantId: authorized.tenantId,
    organizationId: authorized.organizationId,
    contextId: authorized.contextId,
    patientId: authorized.patientId,
  };
}
