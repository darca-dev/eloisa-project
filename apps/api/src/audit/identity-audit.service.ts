import { Injectable } from '@nestjs/common';

import { type PrismaTransaction } from '../database/prisma-transaction';

/**
 * Auditoría de identidad humana y de relación Paciente–Cuidador
 * (IDENTITY-RELATIONSHIPS-CORE-01 §10).
 *
 * ALCANCE DECLARADO: escribe eventos append-only de vinculación y
 * desvinculación de identidad, deshabilitación de cuenta, creación y revocación
 * de sesión humana, y creación, validación y revocación de relación. NO es el
 * sistema completo de auditoría de MERDN: no conserva valores anteriores y
 * posteriores, no ofrece consulta y no registra lecturas.
 *
 * LO QUE NUNCA SE REGISTRA, deliberadamente:
 * - claims, `issuer`, `subject`, `code`, tokens, cookies ni verifier PKCE;
 * - nombres, documentos, fechas de nacimiento ni datos de contacto;
 * - `authorizationReference`, que es una referencia de soporte y no pertenece a
 *   la traza técnica;
 * - cuerpos de petición, parámetros, filtros ni direcciones IP.
 *
 * LO QUE SÍ SE REGISTRA: identificadores OPACOS —cuenta humana, sesión,
 * relación, identidad institucional—, tenant, tipo de evento, resultado,
 * endpoint lógico, momento y correlación técnica.
 *
 * ATRIBUCIÓN, según §10:
 * - persona autenticada: `HUMAN_ACCOUNT` con `actorUserId = HumanAccount.id` y
 *   `actorRole` nulo. La cuenta es opaca: no es un nombre ni un `subject`;
 * - operador de relaciones: `INSTITUTIONAL_IDENTITY` con el identificador de la
 *   identidad y el rol `CAREGIVER_RELATIONSHIP_MANAGER`. Es una credencial
 *   COMPARTIDA de institución y no identifica a ninguna persona trabajadora;
 * - provisioning administrativo: `SYSTEM`, sin actor y sin rol. NUNCA se finge
 *   que un proceso sea una persona humana.
 *
 * Todos los métodos escriben DENTRO de la transacción que ejecuta la mutación
 * material, de modo que no pueda existir una mutación sin su evento: si el
 * evento no puede persistirse, la transacción se aborta completa.
 */

/** Contexto técnico común a todo evento de esta Task. */
export interface IdentityAuditContext {
  readonly tenantId: string;
  /** Ruta lógica. Sin parámetros, cuerpo ni cadena de consulta. */
  readonly endpoint: string;
  /** Correlación técnica opaca, sin datos personales ni de red. */
  readonly correlationId: string;
}

@Injectable()
export class IdentityAuditService {
  /**
   * Sesión humana creada.
   *
   * El recurso es la SESIÓN, nunca el token ni su hash. El actor es la cuenta
   * humana opaca: es la primera vez que MERDN puede atribuir un acto a una
   * persona concreta sin nombrarla.
   */
  public async recordHumanSessionCreatedWithin(
    tx: PrismaTransaction,
    context: IdentityAuditContext,
    input: { readonly humanAccountId: string; readonly sessionId: string },
    occurredAt: Date,
  ): Promise<void> {
    await tx.auditEvent.create({
      data: {
        tenantId: context.tenantId,
        eventType: 'HUMAN_SESSION_CREATED',
        actorType: 'HUMAN_ACCOUNT',
        actorUserId: input.humanAccountId,
        actorRole: null,
        resourceType: 'HumanSession',
        resourceId: input.sessionId,
        outcome: 'SUCCESS',
        endpoint: context.endpoint,
        correlationId: context.correlationId,
        occurredAt,
      },
      select: { id: true },
    });
  }

  /**
   * Sesión humana revocada.
   *
   * Cubre las cuatro causas —cierre de sesión, rotación por login nuevo, cuenta
   * deshabilitada y vínculo desvinculado— con el MISMO evento: la traza dice que
   * la sesión dejó de valer, no por qué motivo interno, que no aporta a la
   * auditoría y sí describiría el estado de la cuenta.
   */
  public async recordHumanSessionRevokedWithin(
    tx: PrismaTransaction,
    context: IdentityAuditContext,
    input: { readonly humanAccountId: string; readonly sessionId: string },
    occurredAt: Date,
  ): Promise<void> {
    await tx.auditEvent.create({
      data: {
        tenantId: context.tenantId,
        eventType: 'HUMAN_SESSION_REVOKED',
        actorType: 'HUMAN_ACCOUNT',
        actorUserId: input.humanAccountId,
        actorRole: null,
        resourceType: 'HumanSession',
        resourceId: input.sessionId,
        outcome: 'SUCCESS',
        endpoint: context.endpoint,
        correlationId: context.correlationId,
        occurredAt,
      },
      select: { id: true },
    });
  }

  /**
   * Relación creada por el operador institucional.
   *
   * NO registra `patientId`, `caregiverPersonId` ni `authorizationReference`: el
   * recurso creado es la RELACIÓN, y nombrar a sus dos extremos convertiría la
   * traza técnica en un directorio de quién cuida a quién.
   */
  public async recordCaregiverRelationshipCreatedWithin(
    tx: PrismaTransaction,
    context: IdentityAuditContext,
    input: { readonly identityId: string; readonly relationshipId: string },
    occurredAt: Date,
  ): Promise<void> {
    await this.recordRelationshipEvent(
      tx,
      context,
      'CAREGIVER_RELATIONSHIP_CREATED',
      input,
      occurredAt,
    );
  }

  /** Relación validada: pasó de `PENDING_VALIDATION` a `ACTIVE`. */
  public async recordCaregiverRelationshipValidatedWithin(
    tx: PrismaTransaction,
    context: IdentityAuditContext,
    input: { readonly identityId: string; readonly relationshipId: string },
    occurredAt: Date,
  ): Promise<void> {
    await this.recordRelationshipEvent(
      tx,
      context,
      'CAREGIVER_RELATIONSHIP_VALIDATED',
      input,
      occurredAt,
    );
  }

  /**
   * Relación revocada.
   *
   * El MOTIVO vive en la fila de la relación, que es su lugar: es un valor de
   * catálogo cerrado y forma parte del registro material, no de la traza.
   */
  public async recordCaregiverRelationshipRevokedWithin(
    tx: PrismaTransaction,
    context: IdentityAuditContext,
    input: { readonly identityId: string; readonly relationshipId: string },
    occurredAt: Date,
  ): Promise<void> {
    await this.recordRelationshipEvent(
      tx,
      context,
      'CAREGIVER_RELATIONSHIP_REVOKED',
      input,
      occurredAt,
    );
  }

  private async recordRelationshipEvent(
    tx: PrismaTransaction,
    context: IdentityAuditContext,
    eventType:
      | 'CAREGIVER_RELATIONSHIP_CREATED'
      | 'CAREGIVER_RELATIONSHIP_VALIDATED'
      | 'CAREGIVER_RELATIONSHIP_REVOKED',
    input: { readonly identityId: string; readonly relationshipId: string },
    occurredAt: Date,
  ): Promise<void> {
    await tx.auditEvent.create({
      data: {
        tenantId: context.tenantId,
        eventType,
        actorType: 'INSTITUTIONAL_IDENTITY',
        actorUserId: input.identityId,
        actorRole: 'CAREGIVER_RELATIONSHIP_MANAGER',
        resourceType: 'PatientCaregiverRelationship',
        resourceId: input.relationshipId,
        outcome: 'SUCCESS',
        endpoint: context.endpoint,
        correlationId: context.correlationId,
        occurredAt,
      },
      select: { id: true },
    });
  }

  /**
   * Spec 027: Revocación de sesión de inscripción al migrar a sesión humana persistente.
   *
   * Se escribe con actor HUMAN_ACCOUNT (la cuenta que inicia sesión) porque es la
   * acción de esa persona la que invalida la sesión temporal de inscripción.
   */
  public async recordEnrollmentSessionRevokedWithin(
    tx: PrismaTransaction,
    context: IdentityAuditContext,
    input: { readonly enrollmentSessionId: string; readonly patientId: string },
    occurredAt: Date,
  ): Promise<void> {
    await tx.auditEvent.create({
      data: {
        tenantId: context.tenantId,
        eventType: 'ENROLLMENT_SESSION_REVOKED',
        actorType: 'HUMAN_ACCOUNT',
        actorUserId: null,
        actorRole: null,
        resourceType: 'EnrollmentSession',
        resourceId: input.enrollmentSessionId,
        outcome: 'SUCCESS',
        endpoint: context.endpoint,
        correlationId: context.correlationId,
        occurredAt,
      },
      select: { id: true },
    });
  }
}
