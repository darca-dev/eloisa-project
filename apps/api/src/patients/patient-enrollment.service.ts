import { Inject, Injectable } from '@nestjs/common';

import { AuditService } from '../audit/audit.service';
import { ConsentService } from '../consents/consent.service';
import { PrismaService } from '../database/prisma.service';
import { TenantContextService } from '../database/tenant-context.service';
import { EnrollmentSessionService } from '../enrollment-sessions/enrollment-session.service';
import { TerritoryService } from '../territory/territory.service';

import {
  type PatientSummaryResponse,
  type PopulationCode,
  type PopulationSourceCode,
} from './enrollment.contract';
import { validateEnrollmentRequest } from './enrollment.validation';
import { deriveAgeInYears, derivePopulations } from './population-derivation';

/**
 * Caso de uso «Inscripción → Paciente persistente» (TASK-MVP-CORE-01 §6).
 *
 * Transacción única de creación, ejecutada bajo el rol `merdn_runtime` y con el
 * tenant activo fijado para Row Level Security:
 *
 *   BEGIN
 *     SET LOCAL ROLE merdn_runtime; set_config('merdn.tenant_id', …, true)
 *     0. resolución del territorio contra el catálogo controlado
 *     1. person                       (identidad mínima; unicidad por tenant)
 *     2. patient                      (perfil, EPS controlada, origen servidor)
 *     3. patient_population_membership (1..3 filas; 60+ derivada en servidor)
 *     4. patient_address              (territorio canónico + dirección sensible)
 *     5. consent_record               (versión y fecha del servidor)
 *     6. enrollment_session           (solo hash del token)
 *     7. audit_event                  (PATIENT_ENROLLMENT_CREATED, sin PII)
 *   COMMIT
 *
 * Cualquier fallo intermedio deshace TODO: no puede quedar una persona sin
 * paciente, un paciente sin territorio ni una sesión sin paciente.
 *
 * Resolución de actor y tenant:
 * - el tenant proviene EXCLUSIVAMENTE de la configuración del servidor;
 * - no hay actor autenticado: `origin = PUBLIC_SELF_ENROLLMENT` y
 *   `createdByUserId = null`. No se inventa un usuario ficticio.
 */

export type EnrollmentFailure =
  | { readonly kind: 'INVALID_BODY'; readonly fields: readonly string[] }
  | { readonly kind: 'VALIDATION'; readonly fields: readonly string[] }
  | { readonly kind: 'DOCUMENT_CONFLICT' };

export type EnrollmentResult =
  | {
      readonly ok: true;
      readonly patient: PatientSummaryResponse;
      readonly setCookieHeader: string;
    }
  | { readonly ok: false; readonly failure: EnrollmentFailure };

/** Código de violación de restricción única de PostgreSQL a través de Prisma. */
const PRISMA_UNIQUE_VIOLATION = 'P2002';

/**
 * Nombre de la restricción que impone la unicidad de documento por tenant.
 * Debe coincidir con `person_tenant_document_unique` de `prisma/schema.prisma`.
 */
const DOCUMENT_UNIQUE_CONSTRAINT = 'person_tenant_document_unique';

/** Columnas que componen esa restricción, tal como las nombra Prisma. */
const DOCUMENT_UNIQUE_FIELDS = [
  'tenantId',
  'documentType',
  'documentNumberNormalized',
] as const;

/**
 * Error interno que aborta la transacción cuando el territorio no resuelve.
 * No llega al cliente: se traduce a un `422` con el campo afectado.
 */
class TerritoryRejectedError extends Error {
  constructor(public readonly field: string) {
    super('Territorio no válido para la inscripción.');
    this.name = 'TerritoryRejectedError';
  }
}

@Injectable()
export class PatientEnrollmentService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TenantContextService) private readonly tenants: TenantContextService,
    @Inject(TerritoryService) private readonly territory: TerritoryService,
    @Inject(ConsentService) private readonly consents: ConsentService,
    @Inject(EnrollmentSessionService)
    private readonly sessions: EnrollmentSessionService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  public async enroll(body: unknown, now: Date): Promise<EnrollmentResult> {
    const validation = validateEnrollmentRequest(body, now);
    if (!validation.ok) {
      return {
        ok: false,
        failure:
          validation.kind === 'SHAPE'
            ? { kind: 'INVALID_BODY', fields: validation.fields }
            : { kind: 'VALIDATION', fields: validation.fields },
      };
    }

    const input = validation.value;
    const { tenantId } = await this.tenants.resolveActiveTenant();

    try {
      const created = await this.prisma.withTenant(tenantId, async (tx) => {
        // El territorio se resuelve DENTRO de la transacción: así se contrasta
        // contra el mismo estado del catálogo que verán las escrituras, y bajo
        // el rol runtime, que no puede ver unidades locales de otro tenant.
        const territory = await this.territory.resolve(tx, {
          tenantId,
          departmentCode: input.territory.departmentCode,
          municipalityCode: input.territory.municipalityCode,
          localUnitId: input.territory.localUnitId,
          declaredAreaType: input.territory.areaType,
        });

        if (!territory.ok) {
          throw new TerritoryRejectedError(territory.field);
        }

        const populations = derivePopulations(
          input.birthDate,
          now,
          input.declaredPopulations,
        );

        // Debe existir al menos una pertenencia (TASK-MVP-CORE-01 §4). Ocurre
        // cuando la persona no llega a 60 años y no declara ninguna situación.
        if (populations.length === 0) {
          throw new TerritoryRejectedError('declaredPopulations');
        }

        const pendingNormalization = territory.value.localUnit === null;

        const person = await tx.person.create({
          data: {
            tenantId,
            documentType: input.documentType,
            documentNumber: input.documentNumberDeclared,
            documentNumberNormalized: input.documentNumberNormalized,
            givenNames: input.givenNames,
            familyNames: input.familyNames,
            birthDate: input.birthDate,
            sexGenderCode: input.sexGenderCode,
            phone: input.phone,
            email: input.email,
          },
          select: { id: true },
        });

        const patient = await tx.patient.create({
          data: {
            tenantId,
            personId: person.id,
            epsCode: input.eps.code,
            epsNameControlled: input.eps.name,
            status: 'ACTIVE',
            origin: 'PUBLIC_SELF_ENROLLMENT',
            enrolledAt: now,
            createdByUserId: null,
          },
          select: { id: true, enrolledAt: true },
        });

        await tx.patientPopulationMembership.createMany({
          data: populations.map((population) => ({
            patientId: patient.id,
            tenantId,
            populationType: population.populationType,
            source: population.source,
          })),
        });

        await tx.patientAddress.create({
          data: {
            tenantId,
            patientId: patient.id,
            departmentUnitId: territory.value.department.id,
            municipalityUnitId: territory.value.municipality.id,
            localUnitId: territory.value.localUnit?.id ?? null,
            areaType: territory.value.areaType,
            localityPendingNormalization: pendingNormalization,
            localityUnverifiedText: pendingNormalization
              ? input.territory.localityDeclaredText
              : null,
            settlementUnverifiedText: input.territory.settlementDeclaredText,
            exactAddress: input.territory.exactAddress,
            directions: input.territory.directions,
          },
        });

        await this.consents.recordWithin(tx, { tenantId, patientId: patient.id }, now);

        const session = await this.sessions.createWithin(
          tx,
          { tenantId, patientId: patient.id },
          now,
        );

        await this.audit.recordPatientEnrollmentCreatedWithin(
          tx,
          { tenantId, patientId: patient.id },
          now,
        );

        return { patient, session, territory: territory.value, populations };
      });

      return {
        ok: true,
        setCookieHeader: created.session.setCookieHeader,
        patient: {
          status: 'ACTIVE',
          enrolledAt: created.patient.enrolledAt.toISOString(),
          givenNames: input.givenNames,
          familyNames: input.familyNames,
          age: deriveAgeInYears(input.birthDate, now),
          populations: created.populations.map((population) => ({
            populationType: population.populationType,
            source: population.source,
          })),
          territory: {
            departmentCode: created.territory.department.officialCode ?? '',
            departmentName: created.territory.department.displayName,
            municipalityCode: created.territory.municipality.officialCode ?? '',
            municipalityName: created.territory.municipality.displayName,
            localityName: created.territory.localUnit?.displayName ?? null,
            localityPendingNormalization: created.territory.localUnit === null,
            areaType: created.territory.areaType,
          },
          epsCode: input.eps.code,
          epsName: input.eps.name,
        },
      };
    } catch (error) {
      if (error instanceof TerritoryRejectedError) {
        return { ok: false, failure: { kind: 'VALIDATION', fields: [error.field] } };
      }

      // La restricción única de PostgreSQL es la barrera final contra duplicados
      // y contra carreras concurrentes: no se comprueba antes «por si acaso»,
      // porque una comprobación previa no sería atómica.
      if (isUniqueDocumentViolation(error)) {
        return { ok: false, failure: { kind: 'DOCUMENT_CONFLICT' } };
      }

      // Cualquier otra violación de unicidad es un defecto, no un duplicado de
      // documento: se propaga para que produzca un error interno visible en vez
      // de comunicarse como un conflicto que la persona no puede resolver.
      throw error;
    }
  }

  /**
   * Recupera el paciente asociado a una sesión válida.
   *
   * La consulta filtra por `patientId` Y por `tenantId`, y se ejecuta bajo el
   * rol runtime con el tenant fijado: aunque el filtro de aplicación fallara,
   * Row Level Security impediría devolver una fila de otra institución.
   *
   * La respuesta excluye documento, dirección exacta, indicaciones, teléfono,
   * correo y detalle interno del consentimiento.
   */
  public async findByPatientId(
    patientId: string,
    tenantId: string,
    now: Date,
  ): Promise<PatientSummaryResponse | null> {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const patient = await tx.patient.findFirst({
        where: { id: patientId, tenantId },
        select: {
          enrolledAt: true,
          epsCode: true,
          epsNameControlled: true,
          personId: true,
        },
      });

      if (patient === null) {
        return null;
      }

      const person = await tx.person.findFirst({
        where: { id: patient.personId, tenantId },
        select: { givenNames: true, familyNames: true, birthDate: true },
      });

      const address = await tx.patientAddress.findFirst({
        where: { patientId, tenantId },
        select: {
          areaType: true,
          localityPendingNormalization: true,
          departmentUnitId: true,
          municipalityUnitId: true,
          localUnitId: true,
        },
      });

      if (person === null || address === null) {
        return null;
      }

      const memberships = await tx.patientPopulationMembership.findMany({
        where: { patientId, tenantId },
        select: { populationType: true, source: true },
        orderBy: { populationType: 'asc' },
      });

      const unitIds = [
        address.departmentUnitId,
        address.municipalityUnitId,
        ...(address.localUnitId === null ? [] : [address.localUnitId]),
      ];
      const units = await tx.territorialUnit.findMany({
        where: { id: { in: unitIds } },
        select: { id: true, officialCode: true, displayName: true },
      });
      const unitById = new Map(units.map((unit) => [unit.id, unit]));
      const department = unitById.get(address.departmentUnitId);
      const municipality = unitById.get(address.municipalityUnitId);

      return {
        status: 'ACTIVE',
        enrolledAt: patient.enrolledAt.toISOString(),
        givenNames: person.givenNames,
        familyNames: person.familyNames,
        age: deriveAgeInYears(person.birthDate, now),
        populations: memberships.map((membership) => ({
          populationType: membership.populationType as PopulationCode,
          source: membership.source as PopulationSourceCode,
        })),
        territory: {
          departmentCode: department?.officialCode ?? '',
          departmentName: department?.displayName ?? '',
          municipalityCode: municipality?.officialCode ?? '',
          municipalityName: municipality?.displayName ?? '',
          localityName:
            address.localUnitId === null
              ? null
              : (unitById.get(address.localUnitId)?.displayName ?? null),
          localityPendingNormalization: address.localityPendingNormalization,
          areaType: address.areaType,
        },
        epsCode: patient.epsCode,
        epsName: patient.epsNameControlled,
      };
    });
  }
}

/**
 * Detecta EXCLUSIVAMENTE la violación de la unicidad de documento por tenant.
 *
 * Cualquier otro `P2002` —por ejemplo una colisión de hash de sesión— es un
 * defecto distinto y no debe presentarse a la persona como «documento
 * duplicado». Ante metadatos ausentes o irreconocibles se devuelve `false`.
 */
export function isUniqueDocumentViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const candidate = error as { code?: unknown; meta?: unknown };
  if (candidate.code !== PRISMA_UNIQUE_VIOLATION) {
    return false;
  }

  const meta = asRecord(candidate.meta);
  if (meta === null) {
    return false;
  }

  // Forma 1: Prisma nombra la restricción o sus campos en `meta.target`.
  if (matchesDocumentConstraint(meta['target'])) {
    return true;
  }

  // Forma 2: el adaptador de controlador detalla la restricción de PostgreSQL.
  const cause = asRecord(asRecord(meta['driverAdapterError'])?.['cause']);
  if (cause === null) {
    return false;
  }

  const constraint = asRecord(cause['constraint']);
  if (constraint !== null) {
    if (matchesDocumentConstraint(constraint['name'])) {
      return true;
    }
    if (matchesDocumentConstraint(constraint['fields'])) {
      return true;
    }
  }

  // Forma 3: solo queda el mensaje original de PostgreSQL. Se exige el nombre
  // exacto de la restricción; ninguna otra violación se acepta.
  const originalMessage = cause['originalMessage'];
  return (
    typeof originalMessage === 'string' &&
    originalMessage.includes(`"${DOCUMENT_UNIQUE_CONSTRAINT}"`)
  );
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * Comprueba que el descriptor recibido identifica EXACTAMENTE la unicidad de
 * documento por tenant: su nombre, o el conjunto completo de sus columnas.
 */
function matchesDocumentConstraint(value: unknown): boolean {
  if (typeof value === 'string') {
    return normalizeTarget(value) === DOCUMENT_UNIQUE_CONSTRAINT;
  }

  if (!Array.isArray(value)) {
    return false;
  }

  const entries = value
    .filter((entry): entry is string => typeof entry === 'string')
    .map(normalizeTarget);

  if (entries.length === 1 && entries[0] === DOCUMENT_UNIQUE_CONSTRAINT) {
    return true;
  }

  return (
    entries.length === DOCUMENT_UNIQUE_FIELDS.length &&
    DOCUMENT_UNIQUE_FIELDS.every((field) => entries.includes(field))
  );
}

/** Quita las comillas con las que algunos adaptadores envuelven las columnas. */
function normalizeTarget(value: string): string {
  return value.replace(/^["`]|["`]$/g, '');
}
