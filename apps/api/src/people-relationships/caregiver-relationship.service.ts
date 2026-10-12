import { Inject, Injectable } from '@nestjs/common';

import { IdentityAuditService } from '../audit/identity-audit.service';
import { PrismaService } from '../database/prisma.service';
import { type InstitutionalPrincipal } from '../institutional-auth/institutional-auth.service';

import {
  CAREGIVER_ERROR_CODES,
  CAREGIVER_RELATIONSHIP_PURPOSE,
  CAREGIVER_RELATIONSHIP_TYPE,
  CAREGIVER_SCOPE_VISITS_VIEW,
  CAREGIVER_VALIDATION_SOURCE,
  type CaregiverRelationshipStatus,
  type CaregiverRevocationReason,
} from './caregiver-relationship.contract';
import {
  type CaregiverActivateRequest,
  type CaregiverCreateRequest,
  type CaregiverRevokeRequest,
} from './caregiver-relationship.request';

/**
 * Ciclo de vida de la relación Paciente–Cuidador
 * (IDENTITY-RELATIONSHIPS-CORE-01 §6).
 *
 * Lo que hace, exactamente y nada más:
 *
 *   1. CREAR en `PENDING_VALIDATION`, con `version = 1`, tipo, finalidad, fuente
 *      y alcance `VISITS_VIEW` fijados por el SERVIDOR;
 *   2. ACTIVAR, solo desde `PENDING_VALIDATION`, exigiendo `expectedVersion`,
 *      inicio ya alcanzado y vigencia no terminada;
 *   3. REVOCAR, desde `PENDING_VALIDATION` o `ACTIVE`, exigiendo
 *      `expectedVersion` y un motivo del catálogo cerrado;
 *   4. CONSULTAR una relación del propio tenant.
 *
 * LO QUE NO HACE, deliberadamente:
 *
 * - NO reabre una relación terminada. `REVOKED` y `EXPIRED` son TERMINALES, y
 *   reautorizar crea un episodio NUEVO en lugar de reescribir la historia;
 * - NO concede ningún alcance distinto de `VISITS_VIEW`, y no existe endpoint
 *   genérico de alcances;
 * - NO valida la identidad de la persona cuidadora, no acredita representación
 *   legal y no interpreta ninguna norma;
 * - NO borra nada: el rol de ejecución ni siquiera tiene DELETE.
 *
 * ATOMICIDAD: cada mutación material y su evento de auditoría se confirman en la
 * MISMA transacción. Si el evento no puede escribirse, la mutación se revierte
 * completa: no puede existir una relación creada, activada o revocada sin su
 * traza.
 */

/** Desenlace de dominio con su código estable y su estado HTTP. */
export class CaregiverRelationshipError extends Error {
  public readonly code: string;

  public readonly status: 404 | 409;

  constructor(code: string, status: 404 | 409, message: string) {
    super(message);
    this.name = 'CaregiverRelationshipError';
    this.code = code;
    this.status = status;
  }
}

/** Proyección MINIMIZADA de la relación. Nunca un objeto Prisma. */
export interface CaregiverRelationshipView {
  readonly relationshipId: string;
  readonly patientId: string;
  readonly caregiverPersonId: string;
  readonly relationshipType: typeof CAREGIVER_RELATIONSHIP_TYPE;
  readonly purpose: typeof CAREGIVER_RELATIONSHIP_PURPOSE;
  readonly status: CaregiverRelationshipStatus;
  readonly startsAt: Date;
  readonly endsAt: Date | null;
  readonly validationSource: typeof CAREGIVER_VALIDATION_SOURCE;
  readonly validatedAt: Date | null;
  readonly revokedAt: Date | null;
  readonly revocationReason: CaregiverRevocationReason | null;
  readonly version: number;
  readonly scopes: readonly (typeof CAREGIVER_SCOPE_VISITS_VIEW)[];
}

/** Contexto de la operación: quién opera y con qué correlación técnica. */
export interface CaregiverOperationContext {
  readonly principal: InstitutionalPrincipal;
  readonly endpoint: string;
  readonly correlationId: string;
}

/** Violación de una restricción de exclusión de PostgreSQL. */
const EXCLUSION_VIOLATION = '23P01';

@Injectable()
export class CaregiverRelationshipService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(IdentityAuditService) private readonly audit: IdentityAuditService,
  ) {}

  /**
   * Crea una relación en `PENDING_VALIDATION` con su alcance `VISITS_VIEW`.
   *
   * El servidor fija tenant, tipo, finalidad, fuente, estado, versión y alcance.
   * El cliente solo aporta los dos extremos, la vigencia y la referencia opaca
   * del soporte.
   */
  public async create(
    context: CaregiverOperationContext,
    request: CaregiverCreateRequest,
    now: Date,
  ): Promise<CaregiverRelationshipView> {
    const tenantId = context.principal.tenantId;

    try {
      return await this.prisma.withTenant(tenantId, async (tx) => {
        /*
         * Los dos extremos deben existir en ESTE tenant. La clave foránea
         * compuesta ya lo impediría, pero comprobarlo antes permite responder
         * `404` UNIFORME en lugar de un error de integridad: un identificador de
         * otra institución y uno inexistente producen la misma respuesta.
         */
        const patient = await tx.patient.findFirst({
          where: { id: request.patientId, tenantId, status: 'ACTIVE' },
          select: { id: true, personId: true },
        });

        if (patient === null) {
          throw new CaregiverRelationshipError(
            CAREGIVER_ERROR_CODES.notFound,
            404,
            'No fue posible encontrar el paciente indicado.',
          );
        }

        const caregiver = await tx.person.findFirst({
          where: { id: request.caregiverPersonId, tenantId },
          select: { id: true },
        });

        if (caregiver === null) {
          throw new CaregiverRelationshipError(
            CAREGIVER_ERROR_CODES.notFound,
            404,
            'No fue posible encontrar la persona cuidadora indicada.',
          );
        }

        /*
         * Autorrelación: la comprobación definitiva vive en un trigger
         * TENANT-AWARE de la base. Aquí se adelanta para devolver un `409`
         * legible en lugar de un error de integridad.
         */
        if (patient.personId === request.caregiverPersonId) {
          throw new CaregiverRelationshipError(
            CAREGIVER_ERROR_CODES.invalidTransition,
            409,
            'La persona cuidadora no puede ser la propia persona del paciente.',
          );
        }

        const created = await tx.patientCaregiverRelationship.create({
          data: {
            tenantId,
            patientId: request.patientId,
            caregiverPersonId: request.caregiverPersonId,
            // Fijados por el SERVIDOR: el cliente no los envía ni puede hacerlo.
            relationshipType: CAREGIVER_RELATIONSHIP_TYPE,
            purpose: CAREGIVER_RELATIONSHIP_PURPOSE,
            status: 'PENDING_VALIDATION',
            validationSource: CAREGIVER_VALIDATION_SOURCE,
            startsAt: request.startsAt,
            endsAt: request.endsAt,
            authorizationReference: request.authorizationReference,
            version: 1,
          },
          select: RELATIONSHIP_SELECT,
        });

        /*
         * Alcance ÚNICO y explícito. Se crea aquí, junto a la relación y dentro
         * de la misma transacción: una relación sin alcance no autorizaría nada,
         * y una relación con un alcance añadido después habría existido un
         * instante sin él.
         */
        await tx.patientCaregiverRelationshipScope.create({
          data: {
            tenantId,
            relationshipId: created.id,
            scope: CAREGIVER_SCOPE_VISITS_VIEW,
          },
          select: { id: true },
        });

        await this.audit.recordCaregiverRelationshipCreatedWithin(
          tx,
          { tenantId, endpoint: context.endpoint, correlationId: context.correlationId },
          { ...context.principal, identityId: context.principal.identityId, relationshipId: created.id },
          now,
        );

        return toView(created, [CAREGIVER_SCOPE_VISITS_VIEW]);
      });
    } catch (error) {
      throw translateExclusion(error);
    }
  }

  /**
   * Activa una relación: `PENDING_VALIDATION -> ACTIVE`.
   *
   * Fija validador y fecha de validación, y aumenta la versión. La transición
   * es la ÚNICA admitida hacia `ACTIVE`: una relación revocada o expirada no
   * vuelve, y una ya activa no se reactiva.
   */
  public async activate(
    context: CaregiverOperationContext,
    relationshipId: string,
    request: CaregiverActivateRequest,
    now: Date,
  ): Promise<CaregiverRelationshipView> {
    const tenantId = context.principal.tenantId;

    try {
      return await this.prisma.withTenant(tenantId, async (tx) => {
        const actual = await this.loadForUpdate(tx, tenantId, relationshipId, request.expectedVersion);

        if (actual.status !== 'PENDING_VALIDATION') {
          throw new CaregiverRelationshipError(
            CAREGIVER_ERROR_CODES.invalidTransition,
            409,
            'La relación no admite esta operación en su estado actual.',
          );
        }

        if (actual.startsAt.getTime() > now.getTime()) {
          throw new CaregiverRelationshipError(
            CAREGIVER_ERROR_CODES.invalidTransition,
            409,
            'La relación no puede activarse antes de su fecha de inicio.',
          );
        }

        if (actual.endsAt !== null && actual.endsAt.getTime() <= now.getTime()) {
          throw new CaregiverRelationshipError(
            CAREGIVER_ERROR_CODES.invalidTransition,
            409,
            'La relación no puede activarse con su vigencia ya terminada.',
          );
        }

        /*
         * La condición `version` viaja en el WHERE, no solo en la lectura
         * previa: dos operadores simultáneos con la MISMA versión esperada
         * compiten aquí y exactamente uno actualiza una fila. El otro recibe
         * `count = 0` y termina en conflicto, sin haber escrito nada.
         */
        const actualizada = await tx.patientCaregiverRelationship.updateMany({
          where: {
            id: relationshipId,
            tenantId,
            version: request.expectedVersion,
            status: 'PENDING_VALIDATION',
          },
          data: {
            status: 'ACTIVE',
            validatedByInstitutionalIdentityId: context.principal.identityId,
            validatedAt: now,
            version: { increment: 1 },
          },
        });

        if (actualizada.count === 0) {
          throw new CaregiverRelationshipError(
            CAREGIVER_ERROR_CODES.versionConflict,
            409,
            'La relación cambió desde que se consultó. Vuelva a cargarla.',
          );
        }

        await this.audit.recordCaregiverRelationshipValidatedWithin(
          tx,
          { tenantId, endpoint: context.endpoint, correlationId: context.correlationId },
          { ...context.principal, identityId: context.principal.identityId, relationshipId },
          now,
        );

        return this.reload(tx, tenantId, relationshipId);
      });
    } catch (error) {
      throw translateExclusion(error);
    }
  }

  /**
   * Revoca una relación: `PENDING_VALIDATION | ACTIVE -> REVOKED`.
   *
   * La revocación es INMEDIATA: en cuanto la transacción confirma, la política
   * de autorización deja de conceder `VISITS_VIEW`, aunque la persona cuidadora
   * tenga una sesión humana viva. No se espera a que su sesión caduque.
   */
  public async revoke(
    context: CaregiverOperationContext,
    relationshipId: string,
    request: CaregiverRevokeRequest,
    now: Date,
  ): Promise<CaregiverRelationshipView> {
    const tenantId = context.principal.tenantId;

    return this.prisma.withTenant(tenantId, async (tx) => {
      const actual = await this.loadForUpdate(tx, tenantId, relationshipId, request.expectedVersion);

      if (actual.status !== 'PENDING_VALIDATION' && actual.status !== 'ACTIVE') {
        // `REVOKED` y `EXPIRED` son terminales.
        throw new CaregiverRelationshipError(
          CAREGIVER_ERROR_CODES.invalidTransition,
          409,
          'La relación no admite esta operación en su estado actual.',
        );
      }

      const actualizada = await tx.patientCaregiverRelationship.updateMany({
        where: {
          id: relationshipId,
          tenantId,
          version: request.expectedVersion,
          status: { in: ['PENDING_VALIDATION', 'ACTIVE'] },
        },
        data: {
          status: 'REVOKED',
          revokedByInstitutionalIdentityId: context.principal.identityId,
          revokedAt: now,
          revocationReason: request.reason,
          version: { increment: 1 },
        },
      });

      if (actualizada.count === 0) {
        throw new CaregiverRelationshipError(
          CAREGIVER_ERROR_CODES.versionConflict,
          409,
          'La relación cambió desde que se consultó. Vuelva a cargarla.',
        );
      }

      await this.audit.recordCaregiverRelationshipRevokedWithin(
        tx,
        { tenantId, endpoint: context.endpoint, correlationId: context.correlationId },
        { ...context.principal, identityId: context.principal.identityId, relationshipId },
        now,
      );

      return this.reload(tx, tenantId, relationshipId);
    });
  }

  /** Consulta una relación del propio tenant. `404` uniforme si no la hay. */
  public async findOne(
    context: CaregiverOperationContext,
    relationshipId: string,
  ): Promise<CaregiverRelationshipView> {
    const tenantId = context.principal.tenantId;

    return this.prisma.withTenant(tenantId, async (tx) =>
      this.reload(tx, tenantId, relationshipId),
    );
  }

  /**
   * Lee la relación y comprueba la versión esperada ANTES de intentar escribir.
   *
   * La comprobación se repite luego dentro del `WHERE` de la escritura: esta
   * lectura sirve para distinguir el desenlace —`404`, conflicto de versión o
   * transición inválida— y no es la que garantiza la exclusión mutua.
   */
  private async loadForUpdate(
    tx: Parameters<Parameters<PrismaService['withTenant']>[1]>[0],
    tenantId: string,
    relationshipId: string,
    expectedVersion: number,
  ): Promise<{
    readonly status: CaregiverRelationshipStatus;
    readonly startsAt: Date;
    readonly endsAt: Date | null;
  }> {
    const actual = await tx.patientCaregiverRelationship.findFirst({
      where: { id: relationshipId, tenantId },
      select: { status: true, startsAt: true, endsAt: true, version: true },
    });

    if (actual === null) {
      /*
       * `404` UNIFORME: no existe y pertenece a otra institución producen la
       * MISMA respuesta. Distinguirlas confirmaría la existencia de un registro
       * ajeno.
       */
      throw new CaregiverRelationshipError(
        CAREGIVER_ERROR_CODES.notFound,
        404,
        'No fue posible encontrar la relación indicada.',
      );
    }

    if (actual.version !== expectedVersion) {
      throw new CaregiverRelationshipError(
        CAREGIVER_ERROR_CODES.versionConflict,
        409,
        'La relación cambió desde que se consultó. Vuelva a cargarla.',
      );
    }

    return { status: actual.status, startsAt: actual.startsAt, endsAt: actual.endsAt };
  }

  private async reload(
    tx: Parameters<Parameters<PrismaService['withTenant']>[1]>[0],
    tenantId: string,
    relationshipId: string,
  ): Promise<CaregiverRelationshipView> {
    const fila = await tx.patientCaregiverRelationship.findFirst({
      where: { id: relationshipId, tenantId },
      select: { ...RELATIONSHIP_SELECT, scopes: { select: { scope: true } } },
    });

    if (fila === null) {
      throw new CaregiverRelationshipError(
        CAREGIVER_ERROR_CODES.notFound,
        404,
        'No fue posible encontrar la relación indicada.',
      );
    }

    return toView(
      fila,
      fila.scopes.map((entrada) => entrada.scope),
    );
  }
}

/** Columnas mínimas necesarias para la proyección. Nunca `select: *`. */
const RELATIONSHIP_SELECT = {
  id: true,
  patientId: true,
  caregiverPersonId: true,
  relationshipType: true,
  purpose: true,
  status: true,
  startsAt: true,
  endsAt: true,
  validationSource: true,
  validatedAt: true,
  revokedAt: true,
  revocationReason: true,
  version: true,
} as const;

interface RelationshipRow {
  readonly id: string;
  readonly patientId: string;
  readonly caregiverPersonId: string;
  readonly relationshipType: typeof CAREGIVER_RELATIONSHIP_TYPE;
  readonly purpose: typeof CAREGIVER_RELATIONSHIP_PURPOSE;
  readonly status: CaregiverRelationshipStatus;
  readonly startsAt: Date;
  readonly endsAt: Date | null;
  readonly validationSource: typeof CAREGIVER_VALIDATION_SOURCE;
  readonly validatedAt: Date | null;
  readonly revokedAt: Date | null;
  readonly revocationReason: CaregiverRevocationReason | null;
  readonly version: number;
}

/**
 * Proyección explícita.
 *
 * NO devuelve `tenantId`, `authorizationReference`, identidad validadora ni
 * identidad revocadora: el tenant es contexto del servidor, la referencia es un
 * soporte documental que no pertenece a la respuesta, y los identificadores de
 * identidad institucional no aportan nada a quien opera y sí describirían la
 * estructura interna del aprovisionamiento.
 */
function toView(
  fila: RelationshipRow,
  scopes: readonly (typeof CAREGIVER_SCOPE_VISITS_VIEW)[],
): CaregiverRelationshipView {
  return {
    relationshipId: fila.id,
    patientId: fila.patientId,
    caregiverPersonId: fila.caregiverPersonId,
    relationshipType: fila.relationshipType,
    purpose: fila.purpose,
    status: fila.status,
    startsAt: fila.startsAt,
    endsAt: fila.endsAt,
    validationSource: fila.validationSource,
    validatedAt: fila.validatedAt,
    revokedAt: fila.revokedAt,
    revocationReason: fila.revocationReason,
    version: fila.version,
    scopes,
  };
}

/**
 * Traduce la restricción de exclusión de PostgreSQL a un `409` del contrato.
 *
 * La garantía real contra solapamiento vive en el índice GiST: dos peticiones
 * concurrentes atravesarían cualquier comprobación previa de la aplicación, pero
 * no atraviesan el índice. Aquí solo se convierte ese fallo en una respuesta
 * legible; NO se sustituye la garantía por una comprobación de aplicación.
 *
 * La respuesta NO revela cuál es la relación en conflicto ni de quién es:
 * hacerlo permitiría reconstruir las autorizaciones ajenas probando fechas.
 */
function translateExclusion(error: unknown): unknown {
  const code = (error as { readonly code?: unknown } | null)?.code;
  const meta = (error as { readonly meta?: { readonly code?: unknown } } | null)?.meta;

  if (code === EXCLUSION_VIOLATION || meta?.code === EXCLUSION_VIOLATION) {
    return new CaregiverRelationshipError(
      CAREGIVER_ERROR_CODES.overlappingRelationship,
      409,
      'Ya existe una autorización vigente que se solapa con la indicada.',
    );
  }

  return error;
}
