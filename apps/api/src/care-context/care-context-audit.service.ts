import { Injectable } from '@nestjs/common';

import { type PrismaTransaction } from '../database/prisma-transaction';

import { CARE_CONTEXT_AUDIT } from './care-context.contract';

export interface CareContextGrantedAuditInput {
  readonly tenantId: string;
  readonly organizationId: string;
  readonly contextId: string;
  readonly humanAccountId: string;
  readonly correlationId: string | null;
}

export interface CareContextDeniedAuditInput {
  readonly tenantId: string;
  /** Organización YA resuelta de forma confiable en el tenant; nunca inventada. */
  readonly organizationId: string;
  readonly humanAccountId: string;
  readonly correlationId: string | null;
}

export interface CareMutationAuditInput {
  readonly tenantId: string;
  readonly organizationId: string;
  readonly humanAccountId: string;
  readonly eventType:
    | 'CARE_OBSERVABLE_VALIDATED'
    | 'CARE_RECORD_CREATED'
    | 'CARE_RECORD_AMENDED'
    | 'CARE_ALARM_CREATED'
    | 'CARE_ALARM_TRANSITIONED'
    | 'CARE_CRITERION_VALIDATED'
    | 'CARE_CRITERION_RETIRED';
  readonly resourceType:
    | 'CareObservableDefinition'
    | 'CareRecord'
    | 'CareRecordAmendment'
    | 'CareAlarm'
    | 'CareAlarmTransition'
    | 'CareAlarmCriterion'
    | 'CareAlarmCriterionVersion';
  readonly resourceId: string;
  /** Ruta lógica constante, sin identificadores. */
  readonly endpoint: string;
  readonly correlationId: string | null;
}

export interface CareContextUnresolvedDeniedAuditInput {
  readonly tenantId: string;
  readonly humanAccountId: string;
  readonly correlationId: string | null;
}

/**
 * Auditoría de la familia `CARE_CONTEXT_*` (SPEC 055 / MP01 §5).
 *
 * Reutiliza `audit_event` append-only. Ambos métodos escriben DENTRO de la
 * transacción recibida: el evento concedido se confirma o revierte junto con
 * el trabajo, y el denegado se confirma antes de lanzar la denegación.
 *
 * El evento NO copia permiso, actor clínico, paciente, relación, asignación,
 * competencia, cuerpo, respuesta ni motivo de denegación. Actor = cuenta humana
 * opaca con `actorRole` NULO; nunca un actor institucional compartido.
 */
@Injectable()
export class CareContextAuditService {
  public async recordGrantedWithin(
    tx: PrismaTransaction,
    input: CareContextGrantedAuditInput,
    now: Date,
  ): Promise<void> {
    await tx.auditEvent.create({
      data: {
        tenantId: input.tenantId,
        organizationId: input.organizationId,
        eventType: 'CARE_CONTEXT_ACCESS_GRANTED',
        actorType: 'HUMAN_ACCOUNT',
        actorUserId: input.humanAccountId,
        actorRole: null,
        resourceType: CARE_CONTEXT_AUDIT.resourceType,
        resourceId: input.contextId,
        outcome: 'SUCCESS',
        endpoint: CARE_CONTEXT_AUDIT.endpoint,
        correlationId: input.correlationId,
        occurredAt: now,
      },
      select: { id: true },
    });
  }

  public async recordDeniedWithin(
    tx: PrismaTransaction,
    input: CareContextDeniedAuditInput,
    now: Date,
  ): Promise<void> {
    await tx.auditEvent.create({
      data: {
        tenantId: input.tenantId,
        organizationId: input.organizationId,
        eventType: 'CARE_CONTEXT_ACCESS_DENIED',
        actorType: 'HUMAN_ACCOUNT',
        actorUserId: input.humanAccountId,
        actorRole: null,
        resourceType: CARE_CONTEXT_AUDIT.resourceType,
        // Nunca el contexto solicitado: no se revela su existencia.
        resourceId: null,
        outcome: 'DENIED',
        endpoint: CARE_CONTEXT_AUDIT.endpoint,
        correlationId: input.correlationId,
        occurredAt: now,
      },
      select: { id: true },
    });
  }

  /**
   * Denegación cuando la organización solicitada NO se resolvió en el tenant:
   * inexistente, de otro tenant, mal formada o no visible. Una organización
   * ajena nunca se convierte en FK de auditoría, así que se usa el evento
   * genérico existente con organización y recurso nulos. El evento es idéntico
   * en todos esos casos: no confirma la existencia de nada.
   */
  public async recordUnresolvedOrganizationDeniedWithin(
    tx: PrismaTransaction,
    input: CareContextUnresolvedDeniedAuditInput,
    now: Date,
  ): Promise<void> {
    await tx.auditEvent.create({
      data: {
        tenantId: input.tenantId,
        organizationId: null,
        eventType: 'EXPERIENCE_ACCESS_DENIED',
        actorType: 'HUMAN_ACCOUNT',
        actorUserId: input.humanAccountId,
        actorRole: null,
        resourceType: CARE_CONTEXT_AUDIT.resourceType,
        resourceId: null,
        outcome: 'DENIED',
        endpoint: CARE_CONTEXT_AUDIT.endpoint,
        correlationId: input.correlationId,
        occurredAt: now,
      },
      select: { id: true },
    });
  }

  /**
   * Mutación de bitácora o alarma ya autorizada. Nombra solo el recurso creado;
   * nunca copia nota, valor, motivo, severidad ni cuerpo.
   */
  public async recordMutationWithin(
    tx: PrismaTransaction,
    input: CareMutationAuditInput,
    now: Date,
  ): Promise<void> {
    await tx.auditEvent.create({
      data: {
        tenantId: input.tenantId,
        organizationId: input.organizationId,
        eventType: input.eventType,
        actorType: 'HUMAN_ACCOUNT',
        actorUserId: input.humanAccountId,
        actorRole: null,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        outcome: 'SUCCESS',
        endpoint: input.endpoint,
        correlationId: input.correlationId,
        occurredAt: now,
      },
      select: { id: true },
    });
  }

  /** Lectura del directorio de contextos propios. Sin organización ni recurso. */
  public async recordDirectoryReadWithin(
    tx: PrismaTransaction,
    input: CareContextUnresolvedDeniedAuditInput,
    now: Date,
  ): Promise<void> {
    await tx.auditEvent.create({
      data: {
        tenantId: input.tenantId,
        organizationId: null,
        eventType: 'CARE_CONTEXT_DIRECTORY_READ',
        actorType: 'HUMAN_ACCOUNT',
        actorUserId: input.humanAccountId,
        actorRole: null,
        resourceType: 'CareContextDirectory',
        resourceId: null,
        outcome: 'SUCCESS',
        endpoint: 'GET /api/v1/care/contexts',
        correlationId: input.correlationId,
        occurredAt: now,
      },
      select: { id: true },
    });
  }
}
