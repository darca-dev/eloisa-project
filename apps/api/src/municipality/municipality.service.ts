import { Inject, Injectable } from '@nestjs/common';

import { PrismaService } from '../database/prisma.service';
import { type PrismaTransaction } from '../database/prisma-transaction';
import {
  InstitutionalAuditService,
  MUNICIPAL_AGGREGATE_RESOURCES,
  type MunicipalAggregateResource,
} from '../institutional-auth/institutional-audit.service';
import { type InstitutionalPrincipal } from '../institutional-auth/institutional-auth.service';

import {
  type PopulationSummary,
  type TerritorySummary,
} from './municipality.contract';
import { type PopulationRow, buildPopulationSummary } from './population-summary';
import { type TerritoryRow, buildTerritorySummary } from './territory-summary';

/**
 * Consulta de los agregados municipales (TASK-MUNICIPALITY-CORE-01, FR-02,
 * FR-03, FR-06 y §Permisos 2 y 3).
 *
 * Reglas aplicadas:
 * - el tenant llega del principal institucional resuelto en el servidor; el
 *   navegador nunca lo envía ni lo selecciona;
 * - toda consulta se ejecuta dentro de `PrismaService.withTenant()`, de modo
 *   que la sesión adopta el rol `merdn_runtime` y PostgreSQL aplica Row Level
 *   Security además del filtro explícito por `tenantId`;
 * - la lectura y el evento de auditoría comparten transacción: no puede quedar
 *   un acceso servido sin su rastro;
 * - solo se seleccionan las columnas imprescindibles. La fecha de nacimiento se
 *   lee para derivar un booleano de edad y NUNCA sale del servidor; la
 *   dirección exacta, las indicaciones y el texto libre de localidad no se
 *   seleccionan siquiera.
 *
 * No existe superficie nominal: este servicio no sabe recuperar un paciente, no
 * acepta identificadores, no filtra por persona y no ofrece drill-down.
 */

/** Contexto mínimo de auditoría de una petición municipal. */
export interface MunicipalRequestContext {
  readonly principal: InstitutionalPrincipal;
  readonly correlationId: string;
  readonly endpoint: string;
  readonly now: Date;
}

@Injectable()
export class MunicipalityService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(InstitutionalAuditService) private readonly audit: InstitutionalAuditService,
  ) {}

  /** Resumen de población beneficiaria del tenant activo. */
  public async populationSummary(
    context: MunicipalRequestContext,
  ): Promise<PopulationSummary> {
    const tenantId = context.principal.tenantId;

    return this.prisma.withTenant(tenantId, async (tx) => {
      const patients = await tx.patient.findMany({
        where: { tenantId, status: 'ACTIVE' },
        select: {
          person: { select: { birthDate: true } },
          populationMemberships: { select: { populationType: true } },
        },
      });

      const territoryPendingNormalization = await tx.patientAddress.count({
        where: {
          tenantId,
          patient: { tenantId, status: 'ACTIVE' },
          OR: [{ localUnitId: null }, { localityPendingNormalization: true }],
        },
      });

      const rows: PopulationRow[] = patients.map((patient) => ({
        birthDate: patient.person.birthDate,
        disabilityDeclared: tieneMembresia(patient.populationMemberships, 'DISABILITY'),
        homeCareRequiredDeclared: tieneMembresia(
          patient.populationMemberships,
          'HOME_CARE_REQUIRED',
        ),
      }));

      await this.registrarAcceso(
        tx,
        context,
        MUNICIPAL_AGGREGATE_RESOURCES.populationSummary,
      );

      return buildPopulationSummary({
        rows,
        territoryPendingNormalization,
        asOf: context.now,
        generatedAt: context.now,
      });
    });
  }

  /** Resumen territorial agregado del tenant activo. */
  public async territorySummary(
    context: MunicipalRequestContext,
  ): Promise<TerritorySummary> {
    const tenantId = context.principal.tenantId;

    return this.prisma.withTenant(tenantId, async (tx) => {
      const addresses = await tx.patientAddress.findMany({
        where: { tenantId, patient: { tenantId, status: 'ACTIVE' } },
        select: {
          areaType: true,
          localUnitId: true,
          localityPendingNormalization: true,
          municipalityUnit: { select: { officialCode: true, displayName: true } },
          localUnit: { select: { displayName: true } },
          patient: {
            select: {
              person: { select: { birthDate: true } },
              populationMemberships: { select: { populationType: true } },
            },
          },
        },
      });

      const rows: TerritoryRow[] = addresses.map((address) => {
        /*
         * Invariante de CORE-01: una localidad pendiente de normalización no
         * tiene unidad canónica. Se comprueban ambas señales y basta con una
         * para tratar el registro como pendiente: ante una incoherencia se elige
         * NO atribuirlo a un territorio canónico que quizá no le corresponde.
         */
        const pendiente =
          address.localUnitId === null || address.localityPendingNormalization;

        return {
          municipalityCode: address.municipalityUnit.officialCode,
          municipalityName: address.municipalityUnit.displayName,
          areaType: address.areaType,
          localUnitId: pendiente ? null : address.localUnitId,
          localUnitName: pendiente ? null : (address.localUnit?.displayName ?? null),
          birthDate: address.patient.person.birthDate,
          disabilityDeclared: tieneMembresia(
            address.patient.populationMemberships,
            'DISABILITY',
          ),
          homeCareRequiredDeclared: tieneMembresia(
            address.patient.populationMemberships,
            'HOME_CARE_REQUIRED',
          ),
        };
      });

      await this.registrarAcceso(
        tx,
        context,
        MUNICIPAL_AGGREGATE_RESOURCES.territorySummary,
      );

      return buildTerritorySummary({
        rows,
        asOf: context.now,
        generatedAt: context.now,
      });
    });
  }

  private async registrarAcceso(
    tx: PrismaTransaction,
    context: MunicipalRequestContext,
    resource: MunicipalAggregateResource,
  ): Promise<void> {
    await this.audit.recordMunicipalAccessWithin(
      tx,
      {
        tenantId: context.principal.tenantId,
        identityId: context.principal.identityId,
        role: context.principal.role,
        resource,
        endpoint: context.endpoint,
        correlationId: context.correlationId,
      },
      true,
      context.now,
    );
  }
}

/**
 * Pertenencia DECLARADA a una población.
 *
 * `OLDER_ADULT_60_PLUS` no se consulta aquí a propósito: la edad se deriva
 * siempre de la fecha de nacimiento (FR-04), porque la pertenencia persistida
 * queda obsoleta cuando alguien cumple 60 después de inscribirse.
 */
function tieneMembresia(
  memberships: readonly { readonly populationType: string }[],
  populationType: 'DISABILITY' | 'HOME_CARE_REQUIRED',
): boolean {
  return memberships.some((membership) => membership.populationType === populationType);
}
