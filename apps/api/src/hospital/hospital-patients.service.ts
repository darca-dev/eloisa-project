import { Inject, Injectable } from '@nestjs/common';

import { PrismaService } from '../database/prisma.service';
import { type PrismaTransaction } from '../database/prisma-transaction';
import {
  HOSPITAL_PATIENT_RESOURCES,
  InstitutionalAuditService,
  type HospitalPatientResource,
} from '../institutional-auth/institutional-audit.service';
import { type InstitutionalPrincipal } from '../institutional-auth/institutional-auth.service';

import {
  HOSPITAL_PATIENTS_SOURCE,
  HOSPITAL_POPULATION_DEFINITION_VERSION,
  type HospitalPatientAnalytics,
  type HospitalPatientDetail,
  type HospitalPatientList,
  type HospitalPatientListItem,
  toAsOfDate,
} from './hospital.contract';
import {
  type HospitalPatientsFilters,
  type HospitalPatientsListQuery,
} from './hospital-patients.query';
import {
  ageAt,
  distributionsOf,
  documentTypeLabel,
  fullNameOf,
  keyFiguresOf,
  initialsOf,
  intersectionsOf,
  maskDocument,
  prioritiesOf,
  statusLabel,
  territoryOf,
  toIsoDate,
  type HospitalPatientRow,
} from './hospital-patients.projection';

/**
 * Lectura hospitalaria de Pacientes (TASK-HOSPITAL-CORE-01 §8 y §9).
 *
 * Reglas aplicadas:
 * - el tenant llega del principal institucional resuelto en el SERVIDOR; el
 *   navegador nunca lo envía, no puede enviarlo —no está en la allowlist— y no
 *   existe selector de institución;
 * - toda consulta se ejecuta dentro de `PrismaService.withTenant()`, de modo que
 *   la sesión adopta el rol `merdn_runtime` y PostgreSQL aplica Row Level
 *   Security ADEMÁS del filtro explícito por `tenantId` que se conserva aquí:
 *   el aislamiento institucional no depende de una sola capa;
 * - la lectura y su evento de auditoría comparten transacción: no puede quedar
 *   una lectura nominal servida sin su rastro. Si el evento no se persiste, la
 *   transacción se aborta y la respuesta falla (FAIL-CLOSED, §9.8);
 * - solo se seleccionan las columnas imprescindibles. El teléfono, el correo, la
 *   dirección exacta, las indicaciones para llegar, el texto libre territorial,
 *   el consentimiento y el documento completo NO se seleccionan siquiera.
 *
 * REUTILIZACIÓN OBLIGATORIA: este servicio lee `Person` y `Patient`, que siguen
 * siendo las únicas entidades de persona y paciente del tenant. No existe
 * `HospitalPatient`, no existe una persona hospitalaria y no existe una base
 * paralela por institución.
 *
 * INTERCAMBIO ENTRE INSTITUCIONES: no existe. El Hospital solo ve pacientes
 * cuyo `tenantId` coincide con el de su sesión. Ver un paciente propiedad de
 * otro tenant exigiría una relación interinstitucional aprobada que esta Task
 * no diseña.
 */

/** Contexto mínimo de auditoría de una petición hospitalaria. */
export interface HospitalRequestContext {
  readonly principal: InstitutionalPrincipal;
  readonly correlationId: string;
  readonly endpoint: string;
  readonly now: Date;
}

/** Columnas EXACTAS que la proyección necesita. Nada más se lee. */
const SELECCION_MINIMA = {
  id: true,
  status: true,
  epsCode: true,
  epsNameControlled: true,
  person: {
    select: {
      givenNames: true,
      familyNames: true,
      birthDate: true,
      documentType: true,
      documentNumberNormalized: true,
    },
  },
  populationMemberships: { select: { populationType: true } },
  address: {
    select: {
      areaType: true,
      localityPendingNormalization: true,
      municipalityUnit: { select: { officialCode: true, displayName: true } },
      localUnit: { select: { displayName: true } },
    },
  },
} as const;

/**
 * Columnas EXACTAS que la ANALÍTICA necesita.
 *
 * Es deliberadamente MÁS ESTRECHA que la del listado: una cifra agregada no
 * muestra a nadie, de modo que leer el nombre o el documento de 3.000 personas
 * para contarlas sería un exceso de recolección sin ninguna finalidad. Aquí solo
 * se leen las columnas que efectivamente se agregan.
 *
 * La fecha de nacimiento se lee para DERIVAR un tramo de edad y un booleano de
 * 60 o más, y nunca sale del servidor.
 */
const SELECCION_ANALITICA = {
  epsCode: true,
  epsNameControlled: true,
  person: { select: { birthDate: true } },
  populationMemberships: { select: { populationType: true } },
  address: {
    select: {
      areaType: true,
      municipalityUnit: { select: { officialCode: true, displayName: true } },
    },
  },
} as const;

/** Forma devuelta por Prisma con `SELECCION_ANALITICA`. */
interface FilaAnalitica {
  readonly epsCode: string;
  readonly epsNameControlled: string;
  readonly person: { readonly birthDate: Date };
  readonly populationMemberships: readonly { readonly populationType: string }[];
  readonly address: {
    readonly areaType: string;
    readonly municipalityUnit: {
      readonly officialCode: string | null;
      readonly displayName: string;
    };
  } | null;
}

/** Forma devuelta por Prisma con `SELECCION_MINIMA`. */
interface FilaPrisma {
  readonly id: string;
  readonly status: string;
  readonly epsCode: string;
  readonly epsNameControlled: string;
  readonly person: {
    readonly givenNames: string;
    readonly familyNames: string;
    readonly birthDate: Date;
    readonly documentType: string;
    readonly documentNumberNormalized: string;
  };
  readonly populationMemberships: readonly { readonly populationType: string }[];
  readonly address: {
    readonly areaType: string;
    readonly localityPendingNormalization: boolean;
    readonly municipalityUnit: {
      readonly officialCode: string | null;
      readonly displayName: string;
    };
    readonly localUnit: { readonly displayName: string } | null;
  } | null;
}

@Injectable()
export class HospitalPatientsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(InstitutionalAuditService) private readonly audit: InstitutionalAuditService,
  ) {}

  /** Listado paginado, filtrado y ordenado ENTERAMENTE en PostgreSQL. */
  public async list(
    context: HospitalRequestContext,
    query: HospitalPatientsListQuery,
  ): Promise<HospitalPatientList> {
    const tenantId = context.principal.tenantId;
    const asOf = context.now;
    const where = this.buildWhere(tenantId, query.filters, asOf);

    return this.prisma.withTenant(tenantId, async (tx) => {
      const totalItems = await tx.patient.count({ where });
      const totalPages = Math.max(1, Math.ceil(totalItems / query.pageSize));
      /*
       * Página corregida de forma DETERMINISTA: una página fuera de rango
       * devuelve la última existente en lugar de una lista vacía sin
       * explicación. La corrección se publica en la respuesta.
       */
      const page = Math.min(Math.max(1, query.page), totalPages);

      const rows = (await tx.patient.findMany({
        where,
        select: SELECCION_MINIMA,
        orderBy: this.buildOrderBy(query),
        skip: (page - 1) * query.pageSize,
        take: query.pageSize,
      })) as unknown as readonly FilaPrisma[];

      await this.registrarAcceso(tx, context, HOSPITAL_PATIENT_RESOURCES.list);

      return {
        source: HOSPITAL_PATIENTS_SOURCE,
        asOfDate: toAsOfDate(asOf),
        generatedAt: asOf.toISOString(),
        page,
        pageSize: query.pageSize,
        totalItems,
        totalPages,
        items: rows.map((row) => this.toListItem(mapear(row), asOf)),
      };
    });
  }

  /**
   * Detalle de un paciente del tenant activo.
   *
   * Devuelve `null` de forma UNIFORME cuando el identificador no existe y cuando
   * existe pero pertenece a otra institución: el controlador traduce ambos casos
   * al mismo `404`, de modo que la respuesta jamás confirma la existencia de un
   * registro ajeno.
   */
  public async detail(
    context: HospitalRequestContext,
    patientId: string,
  ): Promise<HospitalPatientDetail | null> {
    const tenantId = context.principal.tenantId;
    const asOf = context.now;

    return this.prisma.withTenant(tenantId, async (tx) => {
      const row = (await tx.patient.findFirst({
        // El filtro explícito por tenant se conserva junto a Row Level Security.
        where: { id: patientId, tenantId },
        select: SELECCION_MINIMA,
      })) as unknown as FilaPrisma | null;

      if (row === null) {
        /*
         * Una lectura que no devuelve nada NO se audita como acceso concedido:
         * no hubo acceso a ningún dato. La denegación por ausencia tampoco se
         * audita con el recurso, para no convertir la traza en un oráculo de
         * existencia.
         */
        return null;
      }

      const fila = mapear(row);

      await this.registrarAcceso(
        tx,
        context,
        HOSPITAL_PATIENT_RESOURCES.detail,
        fila.patientId,
      );

      return {
        source: HOSPITAL_PATIENTS_SOURCE,
        asOfDate: toAsOfDate(asOf),
        generatedAt: asOf.toISOString(),
        patientId: fila.patientId,
        fullName: fullNameOf(fila),
        initials: initialsOf(fila),
        documentType: fila.documentType,
        documentTypeLabel: documentTypeLabel(fila.documentType),
        documentMasked: maskDocument(fila.documentType, fila.documentNumberNormalized),
        birthDate: toIsoDate(fila.birthDate),
        age: ageAt(fila.birthDate, asOf),
        epsCode: fila.epsCode,
        epsName: fila.epsNameControlled,
        priorities: prioritiesOf(fila, asOf),
        territory: territoryOf(fila),
        status: 'ACTIVE',
        statusLabel: statusLabel(fila.status),
        contactAvailability: 'No disponible con el permiso actual',
      };
    });
  }

  /**
   * Analítica del conjunto filtrado.
   *
   * Se calcula sobre las MISMAS condiciones normalizadas del listado, de modo
   * que ambas superficies reconcilian. El universo activo se cuenta aparte, con
   * el estado por defecto y sin ningún otro filtro, para poder mostrar el
   * conjunto del que procede el recorte.
   *
   * La agregación ocurre en el servidor sobre un conjunto ya acotado por tenant
   * y por filtros; el navegador NUNCA recibe el conjunto completo.
   */
  public async analytics(
    context: HospitalRequestContext,
    filters: HospitalPatientsFilters,
  ): Promise<HospitalPatientAnalytics> {
    const tenantId = context.principal.tenantId;
    const asOf = context.now;
    const where = this.buildWhere(tenantId, filters, asOf);

    return this.prisma.withTenant(tenantId, async (tx) => {
      const activeUniverse = await tx.patient.count({
        where: { tenantId, status: filters.patientStatus },
      });

      const rows = (await tx.patient.findMany({
        where,
        select: SELECCION_ANALITICA,
      })) as unknown as readonly FilaAnalitica[];

      const filas = rows.map(mapearAnalitica);

      await this.registrarAcceso(tx, context, HOSPITAL_PATIENT_RESOURCES.analytics);

      return {
        source: HOSPITAL_PATIENTS_SOURCE,
        asOfDate: toAsOfDate(asOf),
        generatedAt: asOf.toISOString(),
        definitionVersion: HOSPITAL_POPULATION_DEFINITION_VERSION,
        activeUniverse,
        filteredUniverse: filas.length,
        keyFigures: keyFiguresOf(filas, asOf),
        distributions: distributionsOf(filas, asOf),
        intersections: intersectionsOf(filas, asOf),
      };
    });
  }

  /* ---------------------------------------------------------------------- */
  /* Construcción de la consulta                                            */
  /* ---------------------------------------------------------------------- */

  /**
   * Condiciones de la consulta, combinadas con AND.
   *
   * Todo valor procede de `parseListQuery`/`parseAnalyticsQuery`, que ya
   * rechazaron cualquier parámetro fuera de la allowlist. Nada se interpola en
   * SQL: Prisma parametriza la consulta completa.
   */
  private buildWhere(
    tenantId: string,
    filters: HospitalPatientsFilters,
    asOf: Date,
  ): Record<string, unknown> {
    const personWhere: Record<string, unknown> = { tenantId };
    const birthDate: Record<string, Date> = {};

    /*
     * La edad NO está almacenada: el rango de edad se traduce a un rango de
     * FECHAS DE NACIMIENTO contra la fecha de corte. Así el filtro no puede
     * quedar obsoleto y la base puede resolverlo con un índice.
     *
     *   edad >= ageMin  ⟺  nacimiento <= corte − ageMin años
     *   edad <= ageMax  ⟺  nacimiento >  corte − (ageMax+1) años
     */
    if (filters.ageMin !== null) {
      birthDate['lte'] = minusYears(asOf, filters.ageMin);
    }

    if (filters.ageMax !== null) {
      birthDate['gt'] = minusYears(asOf, filters.ageMax + 1);
    }

    if (filters.older60 !== null) {
      const umbral = minusYears(asOf, 60);

      if (filters.older60) {
        // Con 60 o más: nace en el umbral o antes. Se combina con `ageMax`
        // eligiendo la cota más restrictiva, no sobrescribiendo.
        const actual = birthDate['lte'];
        birthDate['lte'] =
          actual === undefined || umbral.getTime() < actual.getTime() ? umbral : actual;
      } else {
        const actual = birthDate['gt'];
        birthDate['gt'] =
          actual === undefined || umbral.getTime() > actual.getTime() ? umbral : actual;
      }
    }

    if (Object.keys(birthDate).length > 0) {
      personWhere['birthDate'] = birthDate;
    }

    if (filters.search !== null) {
      const { tokens, documentForm } = filters.search;

      /*
       * Coincide por NOMBRE o por DOCUMENTO. En el nombre se exigen TODAS las
       * palabras del término, cada una en el nombre o en los apellidos, de modo
       * que «Ana Ejemplo» encuentre a «Ana María Ejemplo Ficticio».
       *
       * La comparación por documento usa la forma NORMALIZADA que CORE-01 ya
       * almacena. El documento completo no se devuelve nunca: buscar por él no
       * lo revela, solo permite localizar un registro que ya se conoce.
       */
      const porNombre = tokens.map((token) => ({
        OR: [
          { givenNames: { contains: token, mode: 'insensitive' } },
          { familyNames: { contains: token, mode: 'insensitive' } },
        ],
      }));

      const alternativas: Record<string, unknown>[] = [{ AND: porNombre }];

      if (documentForm.length > 0) {
        alternativas.push({ documentNumberNormalized: { contains: documentForm } });
      }

      personWhere['OR'] = alternativas;
    }

    const where: Record<string, unknown> = {
      tenantId,
      status: filters.patientStatus,
      person: personWhere,
    };

    if (filters.epsCode !== null) {
      where['epsCode'] = filters.epsCode;
    }

    if (filters.populationType !== null) {
      where['populationMemberships'] = {
        some: { tenantId, populationType: filters.populationType },
      };
    }

    const address: Record<string, unknown> = {};

    if (filters.municipalityOfficialCode !== null) {
      address['municipalityUnit'] = { officialCode: filters.municipalityOfficialCode };
    }

    if (filters.areaType !== null) {
      address['areaType'] = filters.areaType;
    }

    if (Object.keys(address).length > 0) {
      // Un registro sin dirección no satisface un filtro territorial: no se le
      // atribuye un territorio que no declaró.
      where['address'] = { tenantId, ...address };
    }

    return where;
  }

  /**
   * Orden TOTAL y estable.
   *
   * El identificador desempata siempre: sin él, dos personas con el mismo
   * apellido podrían aparecer dos veces —o desaparecer— al pasar de página,
   * porque PostgreSQL no garantiza un orden estable ante empates.
   */
  private buildOrderBy(query: HospitalPatientsListQuery): Record<string, unknown>[] {
    const dir = query.direction;

    switch (query.sort) {
      case 'age':
        /*
         * Mayor edad = fecha de nacimiento MÁS ANTIGUA. Ordenar por edad
         * ascendente equivale a ordenar por nacimiento descendente.
         */
        return [
          { person: { birthDate: dir === 'asc' ? 'desc' : 'asc' } },
          { id: 'asc' },
        ];
      case 'status':
        return [{ status: dir }, { id: 'asc' }];
      case 'name':
      default:
        return [
          { person: { familyNames: dir } },
          { person: { givenNames: dir } },
          { id: 'asc' },
        ];
    }
  }

  private toListItem(row: HospitalPatientRow, asOf: Date): HospitalPatientListItem {
    return {
      patientId: row.patientId,
      fullName: fullNameOf(row),
      initials: initialsOf(row),
      documentMasked: maskDocument(row.documentType, row.documentNumberNormalized),
      age: ageAt(row.birthDate, asOf),
      epsCode: row.epsCode,
      epsName: row.epsNameControlled,
      priorities: prioritiesOf(row, asOf),
      territory: territoryOf(row),
      status: 'ACTIVE',
      statusLabel: statusLabel(row.status),
    };
  }

  private async registrarAcceso(
    tx: PrismaTransaction,
    context: HospitalRequestContext,
    resource: HospitalPatientResource,
    patientId?: string,
  ): Promise<void> {
    await this.audit.recordHospitalPatientAccessWithin(
      tx,
      {
        tenantId: context.principal.tenantId,
        identityId: context.principal.identityId,

        ...(context.principal.humanAccountId === undefined ? {} : { humanAccountId: context.principal.humanAccountId }),
        role: context.principal.role,
        resource,
        endpoint: context.endpoint,
        correlationId: context.correlationId,
        ...(patientId === undefined ? {} : { patientId }),
      },
      context.now,
    );
  }
}

/** Traduce la fila de Prisma a la fila plana que consume la proyección. */
function mapear(row: FilaPrisma): HospitalPatientRow {
  const tiene = (tipo: string): boolean =>
    row.populationMemberships.some((membership) => membership.populationType === tipo);

  return {
    patientId: row.id,
    givenNames: row.person.givenNames,
    familyNames: row.person.familyNames,
    birthDate: row.person.birthDate,
    documentType: row.person.documentType,
    documentNumberNormalized: row.person.documentNumberNormalized,
    epsCode: row.epsCode,
    epsNameControlled: row.epsNameControlled,
    status: row.status,
    /*
     * `OLDER_ADULT_60_PLUS` NO se lee de las pertenencias a propósito: la edad se
     * deriva SIEMPRE de la fecha de nacimiento, porque la pertenencia persistida
     * queda obsoleta cuando alguien cumple 60 después de inscribirse.
     */
    disabilityDeclared: tiene('DISABILITY'),
    homeCareRequiredDeclared: tiene('HOME_CARE_REQUIRED'),
    municipalityOfficialCode: row.address?.municipalityUnit.officialCode ?? null,
    municipalityName: row.address?.municipalityUnit.displayName ?? null,
    areaType:
      row.address === null ? null : row.address.areaType === 'RURAL' ? 'RURAL' : 'URBAN',
    localUnitName: row.address?.localUnit?.displayName ?? null,
    localityPendingNormalization: row.address?.localityPendingNormalization ?? true,
  };
}

/**
 * Traduce una fila de analítica a la fila plana que consume la proyección.
 *
 * Los campos de IDENTIDAD se rellenan con cadenas vacías porque la analítica no
 * los lee de la base y no los necesita: agregar no requiere saber quién es
 * nadie. La proyección solo usa de esta fila la fecha de nacimiento, la EPS, las
 * pertenencias y el territorio.
 */
function mapearAnalitica(row: FilaAnalitica): HospitalPatientRow {
  const tiene = (tipo: string): boolean =>
    row.populationMemberships.some((membership) => membership.populationType === tipo);

  return {
    patientId: '',
    givenNames: '',
    familyNames: '',
    birthDate: row.person.birthDate,
    documentType: '',
    documentNumberNormalized: '',
    epsCode: row.epsCode,
    epsNameControlled: row.epsNameControlled,
    status: 'ACTIVE',
    disabilityDeclared: tiene('DISABILITY'),
    homeCareRequiredDeclared: tiene('HOME_CARE_REQUIRED'),
    municipalityOfficialCode: row.address?.municipalityUnit.officialCode ?? null,
    municipalityName: row.address?.municipalityUnit.displayName ?? null,
    areaType:
      row.address === null ? null : row.address.areaType === 'RURAL' ? 'RURAL' : 'URBAN',
    localUnitName: null,
    localityPendingNormalization: true,
  };
}

/**
 * Fecha de corte menos un número de años, en UTC.
 *
 * `Date.UTC` normaliza el 29 de febrero al 1 de marzo del año no bisiesto, que
 * es el comportamiento correcto para una cota de rango: nadie queda fuera del
 * conjunto por haber nacido ese día.
 */
function minusYears(asOf: Date, years: number): Date {
  return new Date(
    Date.UTC(
      asOf.getUTCFullYear() - years,
      asOf.getUTCMonth(),
      asOf.getUTCDate(),
      0,
      0,
      0,
      0,
    ),
  );
}
