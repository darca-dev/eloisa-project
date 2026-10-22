import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';

import { CareContextAuditService } from '../care-context/care-context-audit.service';
import { type CareDirectoryPage } from '../care-context/care-context-directory.service';
import { type AuthorizedCareContext } from '../care-context/care-context.contract';
import { CareContextService } from '../care-context/care-context.service';
import { CareAlarmEngine } from '../care-criteria/care-alarm-engine';
import { CareConflictError, findReceipt, lockContextForWrite, payloadHash, writeReceipt } from '../care-context/care-mutation';
import {
  CareNotFoundError,
  CareValidationError,
  encodeCursor,
  isChoiceCode,
  isDecimalText,
} from '../care-context/care-request';
import { type PrismaTransaction } from '../database/prisma-transaction';
import { Prisma } from '../generated/prisma/client';
import { type HumanPrincipal } from '../identity-access/human-principal';

import {
  type AmendmentInput,
  type CareObservableView,
  type CareRecordCreatedView,
  type CareRecordPage,
  type CareRecordView,
  type ObservableInput,
  type RecordInput,
} from './care-records.contract';

const ENDPOINTS = {
  observables: 'POST /api/v1/care/contexts/{contextId}/observables',
  records: 'POST /api/v1/care/contexts/{contextId}/records',
  amendments: 'POST /api/v1/care/contexts/{contextId}/records/{recordId}/amendments',
} as const;

const SOURCE_BY_ACTOR = {
  PATIENT: 'PATIENT',
  CAREGIVER: 'CAREGIVER',
  PROFESSIONAL: 'PROFESSIONAL',
} as const;

interface Request {
  readonly principal: HumanPrincipal;
  readonly correlationId: string;
  readonly now: Date;
}

/**
 * Bitácoras persistentes de un contexto de cuidado (SPEC 055 / MP02).
 *
 * Toda operación pasa por `CareContextService.withAuthorizedOwnContext`: el
 * contexto llega por la ruta, la organización se resuelve con el directorio
 * propio y la política de MP01 decide, bloquea y audita en la MISMA
 * transacción que la escritura. Ninguna severidad se deduce de un texto, ningún
 * valor se convierte en silencio y no existe catálogo clínico precargado.
 */
@Injectable()
export class CareRecordsService {
  constructor(
    @Inject(CareContextService) private readonly care: CareContextService,
    @Inject(CareContextAuditService) private readonly audit: CareContextAuditService,
    @Inject(CareAlarmEngine) private readonly engine: CareAlarmEngine,
  ) {}

  public directory(request: Request, cursor: string | null, limit: number): Promise<CareDirectoryPage> {
    return this.care.listDirectory(request.principal, cursor, limit, request.correlationId, request.now);
  }

  /** Definiciones ACTIVE del contexto. Las ve quien puede ver, aportar o definir. */
  public listObservables(request: Request, contextId: string): Promise<readonly CareObservableView[]> {
    return this.care.withAuthorizedOwnContext(
      request.principal,
      contextId,
      ['VIEW_RECORDS', 'CONTRIBUTE_RECORDS', 'MANAGE_RULES'],
      request.correlationId,
      request.now,
      async (tx, authorized) => {
        const rows = await tx.careObservableDefinition.findMany({
          where: scopeOf(authorized, { status: 'ACTIVE' as const }),
          orderBy: [{ code: 'asc' }],
        });
        return rows.map(observableView);
      },
    );
  }

  /**
   * Nueva versión validada por el profesional con MANAGE_RULES y competencia.
   * Retira la versión ACTIVE anterior del mismo código en la misma transacción;
   * los registros previos siguen apuntando a la suya.
   */
  public createObservable(request: Request, contextId: string, input: ObservableInput): Promise<CareObservableView> {
    return this.care.withAuthorizedOwnContext(
      request.principal,
      contextId,
      ['MANAGE_RULES'],
      request.correlationId,
      request.now,
      async (tx, authorized) => {
        await lockContextForWrite(tx, authorized);
        const { idempotencyKey, ...content } = input;
        const hash = payloadHash(content);
        const replay = await findReceipt(tx, authorized, 'observable.create', idempotencyKey, hash);

        if (replay !== null) {
          return observableView(await tx.careObservableDefinition.findFirstOrThrow({ where: scopeOf(authorized, { id: replay }) }));
        }

        const previous = await tx.careObservableDefinition.findFirst({
          where: scopeOf(authorized, { code: input.code }),
          orderBy: { version: 'desc' },
          select: { id: true, version: true, status: true },
        });

        if (previous?.status === 'ACTIVE') {
          await tx.careObservableDefinition.update({
            where: { id: previous.id },
            data: { status: 'RETIRED', retiredAt: request.now, retiredByHumanAccountId: authorized.humanAccountId },
          });
        }

        const created = await tx.careObservableDefinition.create({
          data: {
            ...contextColumns(authorized),
            code: input.code,
            version: (previous?.version ?? 0) + 1,
            label: input.label,
            valueType: input.valueType,
            unit: input.unit,
            options: input.options === null ? Prisma.DbNull : input.options.map((option) => ({ ...option })),
            validatedByHumanAccountId: authorized.humanAccountId,
          },
        });

        await writeReceipt(tx, authorized, 'observable.create', idempotencyKey, hash, created.id);
        await this.audit.recordMutationWithin(
          tx,
          mutation(authorized, request, 'CARE_OBSERVABLE_VALIDATED', 'CareObservableDefinition', created.id, ENDPOINTS.observables),
          request.now,
        );

        return observableView(created);
      },
    );
  }

  /**
   * Registros del contexto, recientes primero. VIEW_RECORDS ve todos; quien
   * solo puede aportar ve únicamente los suyos.
   */
  public listRecords(
    request: Request,
    contextId: string,
    cursor: { readonly at: Date; readonly id: string } | null,
    limit: number,
  ): Promise<CareRecordPage> {
    return this.care.withAuthorizedOwnContext(
      request.principal,
      contextId,
      ['VIEW_RECORDS', 'CONTRIBUTE_RECORDS'],
      request.correlationId,
      request.now,
      async (tx, authorized) => {
        const rows = await tx.careRecord.findMany({
          where: scopeOf(authorized, {
            ...(authorized.permission === 'VIEW_RECORDS' ? {} : { authorHumanAccountId: authorized.humanAccountId }),
            ...(cursor === null
              ? {}
              : { OR: [{ receivedAt: { lt: cursor.at } }, { receivedAt: cursor.at, id: { lt: cursor.id } }] }),
          }),
          orderBy: [{ receivedAt: 'desc' }, { id: 'desc' }],
          take: limit + 1,
          include: {
            observations: { include: { definition: true }, orderBy: { createdAt: 'asc' } },
            amendments: { orderBy: { sequence: 'asc' } },
          },
        });

        const page = rows.slice(0, limit);
        const last = page.at(-1);

        return {
          items: page.map((row) => recordView(row, authorized.humanAccountId)),
          nextCursor: rows.length > limit && last !== undefined ? encodeCursor(last.receivedAt, last.id) : null,
        };
      },
    );
  }

  /** Registro atribuido con observaciones tipadas. La recepción la fija la base. */
  public createRecord(request: Request, contextId: string, input: RecordInput): Promise<CareRecordCreatedView> {
    return this.care.withAuthorizedOwnContext(
      request.principal,
      contextId,
      ['CONTRIBUTE_RECORDS'],
      request.correlationId,
      request.now,
      async (tx, authorized) => {
        const source = SOURCE_BY_ACTOR[authorized.actorKind as keyof typeof SOURCE_BY_ACTOR];

        if (source === undefined) {
          throw new CareValidationError('source', 'Esta cuenta no aporta registros en este contexto.');
        }

        await lockContextForWrite(tx, authorized);
        const { idempotencyKey, ...content } = input;
        const hash = payloadHash({ ...content, occurredAt: input.occurredAt.toISOString() });
        const replay = await findReceipt(tx, authorized, 'record.create', idempotencyKey, hash);

        if (replay !== null) {
          return { ...(await this.readRecord(tx, authorized, replay)), evaluation: null };
        }

        const definitions = await tx.careObservableDefinition.findMany({
          where: scopeOf(authorized, { id: { in: input.observations.map((item) => item.definitionId) }, status: 'ACTIVE' as const }),
        });

        const record = await tx.careRecord.create({
          data: {
            ...contextColumns(authorized),
            authorHumanAccountId: authorized.humanAccountId,
            source,
            occurredAt: input.occurredAt,
            note: input.note,
          },
          select: { id: true },
        });

        for (const [index, item] of input.observations.entries()) {
          const definition = definitions.find((candidate) => candidate.id === item.definitionId);

          if (definition === undefined) {
            throw new CareValidationError(`observations.${index}.definitionId`, 'El dato no está habilitado en este contexto.');
          }

          await tx.careObservation.create({
            data: {
              ...contextColumns(authorized),
              recordId: record.id,
              definitionId: definition.id,
              occurrenceKey: item.occurrenceKey ?? randomUUID(),
              canonicalObservationId: item.canonicalObservationId,
              ...typedValue(definition, item.value, `observations.${index}.value`),
            },
            select: { id: true },
          });
        }

        await writeReceipt(tx, authorized, 'record.create', idempotencyKey, hash, record.id);
        await this.audit.recordMutationWithin(
          tx,
          mutation(authorized, request, 'CARE_RECORD_CREATED', 'CareRecord', record.id, ENDPOINTS.records),
          request.now,
        );

        // MP04: evaluación síncrona de los criterios individuales vigentes.
        const evaluation = await this.engine.evaluateWithin(tx, authorized, record.id, request.correlationId, request.now);

        return { ...(await this.readRecord(tx, authorized, record.id)), evaluation };
      },
    );
  }

  /**
   * Enmienda append-only. Solo el autor del registro, con permiso de aportar
   * vigente. `expectedSequence` evita perder una corrección concurrente.
   */
  public createAmendment(
    request: Request,
    contextId: string,
    recordId: string,
    input: AmendmentInput,
  ): Promise<CareRecordView> {
    return this.care.withAuthorizedOwnContext(
      request.principal,
      contextId,
      ['CONTRIBUTE_RECORDS'],
      request.correlationId,
      request.now,
      async (tx, authorized) => {
        await lockContextForWrite(tx, authorized);
        const { idempotencyKey, ...content } = input;
        const hash = payloadHash({ ...content, recordId });
        const replay = await findReceipt(tx, authorized, 'record.amend', idempotencyKey, hash);

        if (replay !== null) {
          return this.readRecord(tx, authorized, recordId);
        }

        const record = await tx.careRecord.findFirst({
          where: scopeOf(authorized, { id: recordId }),
          select: { id: true, authorHumanAccountId: true },
        });

        if (record === null || record.authorHumanAccountId !== authorized.humanAccountId) {
          // Otra persona no edita autoría ajena; tampoco se revela si existe.
          throw new CareNotFoundError();
        }

        const latest = await tx.careRecordAmendment.findFirst({
          where: { recordId, contextId: authorized.contextId },
          orderBy: { sequence: 'desc' },
          select: { sequence: true },
        });

        if ((latest?.sequence ?? 0) !== input.expectedSequence) {
          throw new CareConflictError('VERSION_CONFLICT');
        }

        let replacement = {};

        if (input.observationId !== null) {
          const observation = await tx.careObservation.findFirst({
            where: scopeOf(authorized, { id: input.observationId, recordId }),
            include: { definition: true },
          });

          if (observation === null) {
            throw new CareValidationError('observationId', 'El dato a corregir no pertenece a este registro.');
          }

          if (input.replacement !== undefined) {
            replacement = renamedValue(typedValue(observation.definition, input.replacement, 'replacement'));
          }
        } else if (input.replacement !== undefined) {
          throw new CareValidationError('replacement', 'Indique qué dato corrige.');
        }

        if (Object.keys(replacement).length === 0 && input.note === null) {
          throw new CareValidationError('note', 'Indique el valor corregido o una nota.');
        }

        const amendment = await tx.careRecordAmendment.create({
          data: {
            ...contextColumns(authorized),
            recordId,
            observationId: input.observationId,
            authorHumanAccountId: authorized.humanAccountId,
            sequence: input.expectedSequence + 1,
            reason: input.reason,
            note: input.note,
            ...replacement,
          },
          select: { id: true },
        });

        await writeReceipt(tx, authorized, 'record.amend', idempotencyKey, hash, amendment.id);
        await this.audit.recordMutationWithin(
          tx,
          mutation(authorized, request, 'CARE_RECORD_AMENDED', 'CareRecordAmendment', amendment.id, ENDPOINTS.amendments),
          request.now,
        );

        return this.readRecord(tx, authorized, recordId);
      },
    );
  }

  private async readRecord(tx: PrismaTransaction, authorized: AuthorizedCareContext, recordId: string): Promise<CareRecordView> {
    const row = await tx.careRecord.findFirstOrThrow({
      where: scopeOf(authorized, { id: recordId }),
      include: {
        observations: { include: { definition: true }, orderBy: { createdAt: 'asc' } },
        amendments: { orderBy: { sequence: 'asc' } },
      },
    });
    return recordView(row, authorized.humanAccountId);
  }
}

/** Filtro explícito por el contexto autorizado, además de RLS. */
function scopeOf<T extends object>(authorized: AuthorizedCareContext, extra: T) {
  return {
    tenantId: authorized.tenantId,
    organizationId: authorized.organizationId,
    contextId: authorized.contextId,
    patientId: authorized.patientId,
    ...extra,
  };
}

function contextColumns(authorized: AuthorizedCareContext) {
  return {
    tenantId: authorized.tenantId,
    organizationId: authorized.organizationId,
    contextId: authorized.contextId,
    patientId: authorized.patientId,
  };
}

function mutation(
  authorized: AuthorizedCareContext,
  request: Request,
  eventType: 'CARE_OBSERVABLE_VALIDATED' | 'CARE_RECORD_CREATED' | 'CARE_RECORD_AMENDED',
  resourceType: 'CareObservableDefinition' | 'CareRecord' | 'CareRecordAmendment',
  resourceId: string,
  endpoint: string,
) {
  return {
    tenantId: authorized.tenantId,
    organizationId: authorized.organizationId,
    humanAccountId: authorized.humanAccountId,
    eventType,
    resourceType,
    resourceId,
    endpoint,
    correlationId: request.correlationId,
  };
}

interface DefinitionShape {
  readonly valueType: 'BOOLEAN' | 'NUMBER' | 'CHOICE';
  readonly options: Prisma.JsonValue | null;
}

/** Valor tipado según la definición. Nada se convierte en silencio. */
function typedValue(
  definition: DefinitionShape,
  value: unknown,
  field: string,
): { valueBoolean?: boolean; valueNumber?: Prisma.Decimal; valueChoice?: string } {
  if (definition.valueType === 'BOOLEAN') {
    if (typeof value !== 'boolean') {
      throw new CareValidationError(field, 'Responda sí o no.');
    }
    return { valueBoolean: value };
  }

  if (definition.valueType === 'NUMBER') {
    if (!isDecimalText(value)) {
      throw new CareValidationError(field, 'Escriba un número válido (use punto para decimales).');
    }
    return { valueNumber: new Prisma.Decimal(value) };
  }

  const options = Array.isArray(definition.options) ? definition.options : [];
  const allowed = options.some(
    (option) => typeof option === 'object' && option !== null && !Array.isArray(option) && option['code'] === value,
  );

  if (!isChoiceCode(value) || !allowed) {
    throw new CareValidationError(field, 'Elija una de las opciones disponibles.');
  }
  return { valueChoice: value };
}

function renamedValue(value: { valueBoolean?: boolean; valueNumber?: Prisma.Decimal; valueChoice?: string }) {
  return {
    ...(value.valueBoolean === undefined ? {} : { replacementBoolean: value.valueBoolean }),
    ...(value.valueNumber === undefined ? {} : { replacementNumber: value.valueNumber }),
    ...(value.valueChoice === undefined ? {} : { replacementChoice: value.valueChoice }),
  };
}

function observableView(row: {
  id: string;
  code: string;
  version: number;
  label: string;
  valueType: 'BOOLEAN' | 'NUMBER' | 'CHOICE';
  unit: string | null;
  options: Prisma.JsonValue | null;
  validatedAt: Date;
}): CareObservableView {
  return {
    id: row.id,
    code: row.code,
    version: row.version,
    label: row.label,
    valueType: row.valueType,
    unit: row.unit,
    options: Array.isArray(row.options) ? (row.options as { code: string; label: string }[]) : null,
    validatedAt: row.validatedAt.toISOString(),
  };
}

function shownValue(row: { valueBoolean: boolean | null; valueNumber: Prisma.Decimal | null; valueChoice: string | null }) {
  if (row.valueBoolean !== null) return row.valueBoolean;
  if (row.valueNumber !== null) return row.valueNumber.toString();
  return row.valueChoice;
}

function recordView(
  row: Prisma.CareRecordGetPayload<{
    include: { observations: { include: { definition: true } }; amendments: true };
  }>,
  viewer: string,
): CareRecordView {
  return {
    id: row.id,
    source: row.source,
    authoredByMe: row.authorHumanAccountId === viewer,
    occurredAt: row.occurredAt.toISOString(),
    receivedAt: row.receivedAt.toISOString(),
    note: row.note,
    observations: row.observations.map((observation) => ({
      id: observation.id,
      definitionId: observation.definitionId,
      code: observation.definition.code,
      version: observation.definition.version,
      label: observation.definition.label,
      valueType: observation.definition.valueType,
      unit: observation.definition.unit,
      value: shownValue(observation),
      occurrenceKey: observation.occurrenceKey,
      canonicalObservationId: observation.canonicalObservationId,
    })),
    amendments: row.amendments.map((amendment) => ({
      id: amendment.id,
      sequence: amendment.sequence,
      observationId: amendment.observationId,
      reason: amendment.reason,
      note: amendment.note,
      replacement: shownValue({
        valueBoolean: amendment.replacementBoolean,
        valueNumber: amendment.replacementNumber,
        valueChoice: amendment.replacementChoice,
      }),
      createdAt: amendment.createdAt.toISOString(),
      authoredByMe: amendment.authorHumanAccountId === viewer,
    })),
  };
}

