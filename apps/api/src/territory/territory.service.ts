import { Injectable } from '@nestjs/common';

import { type PrismaTransaction } from '../database/prisma-transaction';
import { type AreaTypeCode } from '../patients/enrollment.contract';

/**
 * Resolución del territorio contra el catálogo controlado del servidor
 * (TASK-MVP-CORE-01 §3, §7).
 *
 * El servidor NO confía en los nombres territoriales que envía el navegador:
 * solo acepta códigos oficiales y los contrasta con las filas de
 * `territorial_unit` cargadas por la migración de datos de referencia.
 *
 * El texto libre declarado por una persona jamás crea una unidad territorial.
 *
 * Todas las consultas reciben la transacción activa: se ejecutan bajo el rol
 * runtime y el tenant fijado por `PrismaService.withTenant()`, de modo que una
 * unidad local de otra institución es invisible incluso si se conoce su
 * identificador.
 */

/** Unidad territorial resuelta. */
export interface ResolvedTerritorialUnit {
  readonly id: string;
  readonly displayName: string;
  readonly officialCode: string | null;
}

/** Territorio resuelto y coherente, listo para persistir. */
export interface ResolvedTerritory {
  readonly department: ResolvedTerritorialUnit;
  readonly municipality: ResolvedTerritorialUnit;
  readonly localUnit: ResolvedTerritorialUnit | null;
  /** Área efectiva: la declarada, ya validada contra la unidad canónica. */
  readonly areaType: AreaTypeCode;
}

export type TerritoryResolutionFailureReason =
  | 'DEPARTMENT_NOT_FOUND'
  | 'MUNICIPALITY_NOT_FOUND'
  | 'MUNICIPALITY_NOT_IN_DEPARTMENT'
  | 'LOCAL_UNIT_NOT_FOUND'
  | 'LOCAL_UNIT_NOT_IN_MUNICIPALITY'
  | 'AREA_TYPE_MISMATCH';

export interface TerritoryResolutionSuccess {
  readonly ok: true;
  readonly value: ResolvedTerritory;
}

export interface TerritoryResolutionFailure {
  readonly ok: false;
  readonly reason: TerritoryResolutionFailureReason;
  readonly field: string;
}

export type TerritoryResolutionResult =
  | TerritoryResolutionSuccess
  | TerritoryResolutionFailure;

export interface TerritoryResolutionInput {
  readonly tenantId: string;
  readonly departmentCode: string;
  readonly municipalityCode: string;
  /** `null` cuando la localidad queda pendiente de normalización. */
  readonly localUnitId: string | null;
  /** Área urbana o rural declarada por la persona. Obligatoria. */
  readonly declaredAreaType: AreaTypeCode;
}

@Injectable()
export class TerritoryService {
  public async resolve(
    tx: PrismaTransaction,
    input: TerritoryResolutionInput,
  ): Promise<TerritoryResolutionResult> {
    const department = await tx.territorialUnit.findFirst({
      where: {
        type: 'DEPARTMENT',
        officialCode: input.departmentCode,
        status: 'ACTIVE',
      },
      select: { id: true, displayName: true, officialCode: true },
    });

    if (department === null) {
      return {
        ok: false,
        reason: 'DEPARTMENT_NOT_FOUND',
        field: 'territory.departmentCode',
      };
    }

    const municipality = await tx.territorialUnit.findFirst({
      where: {
        type: 'MUNICIPALITY',
        officialCode: input.municipalityCode,
        status: 'ACTIVE',
      },
      select: { id: true, displayName: true, officialCode: true, parentId: true },
    });

    if (municipality === null) {
      return {
        ok: false,
        reason: 'MUNICIPALITY_NOT_FOUND',
        field: 'territory.municipalityCode',
      };
    }

    if (municipality.parentId !== department.id) {
      return {
        ok: false,
        reason: 'MUNICIPALITY_NOT_IN_DEPARTMENT',
        field: 'territory.municipalityCode',
      };
    }

    if (input.localUnitId === null) {
      // Localidad pendiente de normalización: no hay unidad canónica contra la
      // que contrastar, así que vale el área declarada por la persona.
      return {
        ok: true,
        value: {
          department: toResolved(department),
          municipality: toResolved(municipality),
          localUnit: null,
          areaType: input.declaredAreaType,
        },
      };
    }

    // La unidad local es administrada por el tenant: la consulta filtra por
    // tenant y por municipio padre, de modo que no puede referenciarse una
    // unidad de otra institución ni de otro municipio.
    const localUnit = await tx.territorialUnit.findFirst({
      where: {
        id: input.localUnitId,
        tenantId: input.tenantId,
        status: 'ACTIVE',
        type: { in: ['NEIGHBORHOOD', 'RURAL_SETTLEMENT'] },
      },
      select: { id: true, displayName: true, officialCode: true, parentId: true, type: true },
    });

    if (localUnit === null) {
      return {
        ok: false,
        reason: 'LOCAL_UNIT_NOT_FOUND',
        field: 'territory.localUnitId',
      };
    }

    if (localUnit.parentId !== municipality.id) {
      return {
        ok: false,
        reason: 'LOCAL_UNIT_NOT_IN_MUNICIPALITY',
        field: 'territory.localUnitId',
      };
    }

    const areaTypeOfUnit: AreaTypeCode =
      localUnit.type === 'NEIGHBORHOOD' ? 'URBAN' : 'RURAL';

    // El tipo de la unidad canónica manda: si el área declarada no concuerda, la
    // petición se rechaza en lugar de sobrescribir en silencio lo que dijo la
    // persona. La base impone la misma regla como última barrera.
    if (input.declaredAreaType !== areaTypeOfUnit) {
      return {
        ok: false,
        reason: 'AREA_TYPE_MISMATCH',
        field: 'territory.areaType',
      };
    }

    return {
      ok: true,
      value: {
        department: toResolved(department),
        municipality: toResolved(municipality),
        localUnit: toResolved(localUnit),
        areaType: areaTypeOfUnit,
      },
    };
  }
}

function toResolved(unit: {
  id: string;
  displayName: string;
  officialCode: string | null;
}): ResolvedTerritorialUnit {
  return {
    id: unit.id,
    displayName: unit.displayName,
    officialCode: unit.officialCode,
  };
}
