import { Injectable } from '@nestjs/common';

import { type PrismaTransaction } from '../database/prisma-transaction';

import { type InstitutionalRoleCode } from './institutional-auth.contract';

/**
 * Auditoría institucional, municipal y hospitalaria
 * (TASK-MUNICIPALITY-CORE-01 §Audit; TASK-HOSPITAL-CORE-01 §9.8).
 *
 * ALCANCE DECLARADO: escribe eventos append-only de creación y revocación de
 * sesión institucional, de acceso municipal agregado y de acceso hospitalario a
 * la superficie de Pacientes. NO es el sistema completo de auditoría de MERDN:
 * no conserva valores anteriores y posteriores, no ofrece consulta y no registra
 * lecturas de otros dominios.
 *
 * Lo que NO se registra, deliberadamente:
 * - credenciales, tokens ni sus hashes;
 * - conteos, ni siquiera agregados, y mucho menos de grupos pequeños;
 * - cuerpos de petición, parámetros, SQL ni datos individuales;
 * - direcciones IP ni cabeceras del cliente.
 *
 * Lo que sí se registra: identificador OPACO del actor institucional, tenant,
 * rol, endpoint lógico, resultado, momento y un identificador de correlación.
 *
 * En el acceso hospitalario se añade UNA excepción acotada: la lectura de
 * DETALLE registra el `patientId` OPACO como recurso, porque el evento describe
 * exactamente el acceso a ese registro. Nunca se registra `personId`, nombre,
 * documento, contacto, filtro ni término de búsqueda.
 */

/** Superficies municipales agregadas auditables. */
export const MUNICIPAL_AGGREGATE_RESOURCES = {
  populationSummary: 'MunicipalPopulationSummary',
  territorySummary: 'MunicipalTerritorySummary',
} as const;

export type MunicipalAggregateResource =
  (typeof MUNICIPAL_AGGREGATE_RESOURCES)[keyof typeof MUNICIPAL_AGGREGATE_RESOURCES];

/** Superficies hospitalarias auditables (TASK-HOSPITAL-CORE-01 §9.8). */
export const HOSPITAL_PATIENT_RESOURCES = {
  list: 'HospitalPatientList',
  detail: 'HospitalPatientDetail',
  analytics: 'HospitalPatientAnalytics',
} as const;

export type HospitalPatientResource =
  (typeof HOSPITAL_PATIENT_RESOURCES)[keyof typeof HOSPITAL_PATIENT_RESOURCES];

/** Evento concedido correspondiente a cada superficie hospitalaria. */
const HOSPITAL_GRANTED_EVENT = {
  HospitalPatientList: 'HOSPITAL_PATIENT_LIST_ACCESS_GRANTED',
  HospitalPatientDetail: 'HOSPITAL_PATIENT_DETAIL_ACCESS_GRANTED',
  HospitalPatientAnalytics: 'HOSPITAL_PATIENT_ANALYTICS_ACCESS_GRANTED',
} as const;

export interface InstitutionalSessionAuditInput {
  readonly tenantId: string;
  readonly identityId: string;
  readonly role: InstitutionalRoleCode;
  readonly sessionId: string;
  readonly endpoint: string;
  readonly correlationId: string;
}

export interface HospitalPatientAccessAuditInput {
  readonly tenantId: string;
  /** `null` cuando la petición no llegó con una identidad institucional válida. */
  readonly identityId: string | null;
  readonly role: InstitutionalRoleCode | null;
  readonly resource: HospitalPatientResource;
  readonly endpoint: string;
  readonly correlationId: string;
  /**
   * Identificador OPACO del paciente leído. SOLO se admite en la lectura de
   * detalle: el listado y la analítica no describen un recurso concreto y no
   * pueden sustituirlo por un identificador inventado.
   */
  readonly patientId?: string;
}

export interface MunicipalAccessAuditInput {
  readonly tenantId: string;
  /** `null` cuando la petición no llegó con una identidad institucional válida. */
  readonly identityId: string | null;
  readonly role: InstitutionalRoleCode | null;
  readonly resource: MunicipalAggregateResource;
  readonly endpoint: string;
  readonly correlationId: string;
}

@Injectable()
export class InstitutionalAuditService {
  /** Sesión institucional creada. El recurso es la sesión, nunca el token. */
  public async recordSessionCreatedWithin(
    tx: PrismaTransaction,
    input: InstitutionalSessionAuditInput,
    occurredAt: Date,
  ): Promise<void> {
    await tx.auditEvent.create({
      data: {
        tenantId: input.tenantId,
        eventType: 'INSTITUTIONAL_SESSION_CREATED',
        actorType: 'INSTITUTIONAL_IDENTITY',
        actorUserId: input.identityId,
        actorRole: input.role,
        resourceType: 'InstitutionalSession',
        resourceId: input.sessionId,
        outcome: 'SUCCESS',
        endpoint: input.endpoint,
        correlationId: input.correlationId,
        occurredAt,
      },
      select: { id: true },
    });
  }

  /** Sesión institucional revocada. La fila de la sesión se conserva. */
  public async recordSessionRevokedWithin(
    tx: PrismaTransaction,
    input: InstitutionalSessionAuditInput,
    occurredAt: Date,
  ): Promise<void> {
    await tx.auditEvent.create({
      data: {
        tenantId: input.tenantId,
        eventType: 'INSTITUTIONAL_SESSION_REVOKED',
        actorType: 'INSTITUTIONAL_IDENTITY',
        actorUserId: input.identityId,
        actorRole: input.role,
        resourceType: 'InstitutionalSession',
        resourceId: input.sessionId,
        outcome: 'SUCCESS',
        endpoint: input.endpoint,
        correlationId: input.correlationId,
        occurredAt,
      },
      select: { id: true },
    });
  }

  /**
   * Acceso hospitalario a Pacientes, concedido.
   *
   * Se escribe DENTRO de la misma transacción que sirve los datos, de modo que
   * no pueda existir una lectura nominal servida sin su evento: si el evento no
   * puede persistirse, la transacción se aborta y la respuesta falla. Es el
   * comportamiento FAIL-CLOSED exigido por TASK-HOSPITAL-CORE-01 §9.8.
   *
   * NO se registra la consulta, el término de búsqueda, los filtros, el número
   * de resultados, la página ni el cuerpo de la respuesta.
   */
  public async recordHospitalPatientAccessWithin(
    tx: PrismaTransaction,
    input: HospitalPatientAccessAuditInput,
    occurredAt: Date,
  ): Promise<void> {
    await tx.auditEvent.create({
      data: {
        tenantId: input.tenantId,
        eventType: HOSPITAL_GRANTED_EVENT[input.resource],
        actorType: 'INSTITUTIONAL_IDENTITY',
        actorUserId: input.identityId,
        actorRole: input.role,
        resourceType: input.resource,
        /*
         * Solo el detalle nombra un recurso. El listado y la analítica dejan
         * `null` a propósito: un acceso a una superficie no crea recurso y no se
         * sustituye por un identificador inventado.
         */
        resourceId:
          input.resource === HOSPITAL_PATIENT_RESOURCES.detail
            ? (input.patientId ?? null)
            : null,
        outcome: 'SUCCESS',
        endpoint: input.endpoint,
        correlationId: input.correlationId,
        occurredAt,
      },
      select: { id: true },
    });
  }

  /**
   * Acceso hospitalario a Pacientes, DENEGADO.
   *
   * No registra recurso ni causa detallada: una denegación no debe permitir
   * deducir si el recurso existe, a qué institución pertenece ni por qué se
   * rechazó. El actor y el rol solo se registran cuando ya se conocían.
   */
  public async recordHospitalPatientDenialWithin(
    tx: PrismaTransaction,
    input: HospitalPatientAccessAuditInput,
    occurredAt: Date,
  ): Promise<void> {
    await tx.auditEvent.create({
      data: {
        tenantId: input.tenantId,
        eventType: 'HOSPITAL_PATIENT_ACCESS_DENIED',
        actorType: input.identityId === null ? 'UNAUTHENTICATED' : 'INSTITUTIONAL_IDENTITY',
        actorUserId: input.identityId,
        actorRole: input.identityId === null ? null : input.role,
        resourceType: input.resource,
        resourceId: null,
        outcome: 'DENIED',
        endpoint: input.endpoint,
        correlationId: input.correlationId,
        occurredAt,
      },
      select: { id: true },
    });
  }

  /**
   * Acceso municipal agregado, concedido o denegado.
   *
   * `resourceId` queda nulo: el acceso no crea ni modifica ningún recurso
   * identificable, y no se sustituye por un identificador inventado.
   */
  public async recordMunicipalAccessWithin(
    tx: PrismaTransaction,
    input: MunicipalAccessAuditInput,
    granted: boolean,
    occurredAt: Date,
  ): Promise<void> {
    await tx.auditEvent.create({
      data: {
        tenantId: input.tenantId,
        eventType: granted
          ? 'MUNICIPAL_AGGREGATE_ACCESS_GRANTED'
          : 'MUNICIPAL_AGGREGATE_ACCESS_DENIED',
        actorType: input.identityId === null ? 'UNAUTHENTICATED' : 'INSTITUTIONAL_IDENTITY',
        actorUserId: input.identityId,
        actorRole: input.identityId === null ? null : input.role,
        resourceType: input.resource,
        resourceId: null,
        outcome: granted ? 'SUCCESS' : 'DENIED',
        endpoint: input.endpoint,
        correlationId: input.correlationId,
        occurredAt,
      },
      select: { id: true },
    });
  }
}
