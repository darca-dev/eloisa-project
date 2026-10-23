import { randomUUID } from 'node:crypto';

import { type ApiEnvironment } from '../src/config/environment';
import { type PrismaClient } from '../src/generated/prisma/client';
import { type HumanPrincipal } from '../src/identity-access/human-principal';

import {
  crearCuentaHumana,
  crearPacienteFicticio,
  crearPersona,
  crearSesionHumana,
  identidadValidadoraFicticia,
} from './identity-relationships-fixtures';

/**
 * Fixtures FICTICIAS de la custodia institucional de cuidado (SPEC 055 / MP01).
 *
 * Todo se siembra con el cliente PROPIETARIO y se registra en `CareSeed` para
 * retirarlo después. Ninguna fila acredita título, habilitación, RETHUS ni
 * decisión institucional real: las referencias son códigos técnicos de prueba y
 * las competencias son declaraciones sintéticas. No se copian datos, reglas ni
 * umbrales del prototipo.
 *
 * `audit_event` es append-only: las organizaciones que llegaron a auditarse no
 * se pueden retirar (FK RESTRICT) y quedan como datos ficticios en la base de
 * pruebas aislada, igual que sus eventos.
 */

/** Prefijo de los códigos de organización de esta suite. */
export const CARE_ORG_PREFIX = 'mp01-pruebas-';

/** Referencia técnica opaca y ficticia. Cumple la forma exigida por CHECK. */
export function referenciaFicticia(tipo: string): string {
  return `PRUEBAS.${tipo}.${randomUUID().slice(0, 8).toUpperCase()}`;
}

/** Configuración mínima de `PrismaService` en modo `enforce`. Valores ficticios. */
export function entornoEnforce(): ApiEnvironment {
  return {
    merdnEnvironment: 'test',
    port: 3001,
    openApiPath: 'docs',
    runtimeRoleMode: 'enforce',
    hasSeparateRuntimeConnection: false,
    activeTenantCode: process.env['MERDN_ACTIVE_TENANT_CODE'] ?? 'merdn-mvp',
    activeTenantId: process.env['MERDN_ACTIVE_TENANT_ID'],
    consent: { version: 'paciente-tratamiento-datos-v1', purpose: 'INSCRIPCION_PACIENTE_MERDN' },
    enrollmentSession: {
      cookieName: 'merdn_enrollment_session',
      sameSite: 'lax',
      secure: false,
      domain: undefined,
      ttlSeconds: 3600,
    },
    webOrigins: ['http://127.0.0.1:3000'],
    enrollmentRateLimit: { maxRequests: 1000, windowSeconds: 900 },
  };
}

/** Identificadores sembrados, en el orden inverso en que deben retirarse. */
export class CareSeed {
  public readonly authorizations = new Set<string>();
  public readonly competences = new Set<string>();
  public readonly contexts = new Set<string>();
  public readonly managers = new Set<string>();
  public readonly organizations = new Set<string>();
  public readonly assignments = new Set<string>();
  public readonly relationships = new Set<string>();
  public readonly patients = new Set<string>();
  public readonly professionals = new Set<string>();
  public readonly accounts = new Set<string>();
  public readonly persons = new Set<string>();

  constructor(private readonly owner: PrismaClient) {}

  public async organizacion(
    tenantId: string,
    kind: 'HOSPITAL' | 'MUNICIPALITY' | 'PROVIDER' = 'HOSPITAL',
  ): Promise<string> {
    const organization = await this.owner.organization.create({
      data: {
        tenantId,
        code: `${CARE_ORG_PREFIX}${randomUUID().slice(0, 12)}`,
        displayName: 'Organización ficticia de pruebas',
        kind,
      },
      select: { id: true },
    });

    this.organizations.add(organization.id);
    return organization.id;
  }

  /** Persona ficticia con cuenta humana, vínculo externo ACTIVE y sesión vigente. */
  public async cuenta(tenantId: string, nombres = 'Persona'): Promise<CuentaFicticia> {
    const { personId, documentNumber } = await crearPersona(this.owner, tenantId, nombres);
    this.persons.add(personId);

    const cuenta = await crearCuentaHumana(this.owner, { tenantId, personId });
    this.accounts.add(cuenta.humanAccountId);

    const sesion = await crearSesionHumana(this.owner, {
      tenantId,
      humanAccountId: cuenta.humanAccountId,
      externalAuthIdentityId: cuenta.bindingId,
    });

    return {
      tenantId,
      personId,
      humanAccountId: cuenta.humanAccountId,
      bindingId: cuenta.bindingId,
      sessionId: sesion.sessionId,
      sessionToken: sesion.token,
      documentNumber,
    };
  }

  /** Solicitud APROBADA exacta para la cuenta y su vínculo. */
  public async aprobar(
    cuenta: CuentaFicticia,
    requestedProfile: 'PATIENT' | 'CAREGIVER' | 'FIELD_PROFESSIONAL',
  ): Promise<void> {
    await this.owner.accessRequest.create({
      data: {
        tenantId: cuenta.tenantId,
        personId: cuenta.personId,
        requestedProfile,
        status: 'APPROVED',
        provisioningStatus: 'SUCCEEDED',
        source: 'TEST_DATA',
        reference: `AR-MP01-${randomUUID()}`,
        humanAccountId: cuenta.humanAccountId,
        externalAuthIdentityId: cuenta.bindingId,
      },
      select: { id: true },
    });
  }

  /** Participación de paciente ACTIVE de la persona de la cuenta. */
  public async paciente(cuenta: CuentaFicticia): Promise<string> {
    const patient = await this.owner.patient.create({
      data: {
        tenantId: cuenta.tenantId,
        personId: cuenta.personId,
        epsCode: 'NUEVA_EPS',
        epsNameControlled: 'Nueva EPS',
        origin: 'PUBLIC_SELF_ENROLLMENT',
      },
      select: { id: true },
    });

    this.patients.add(patient.id);
    return patient.id;
  }

  /** Perfil profesional ACTIVE y afiliación vigente de la persona de la cuenta. */
  public async profesional(cuenta: CuentaFicticia): Promise<string> {
    const profile = await this.owner.professionalProfile.create({
      data: {
        tenantId: cuenta.tenantId,
        personId: cuenta.personId,
        professionCode: 'MEDICINA_GENERAL',
        professionNameControlled: 'Medicina general',
        status: 'ACTIVE',
      },
      select: { id: true },
    });

    this.professionals.add(profile.id);

    const ayer = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await this.owner.professionalAffiliation.create({
      data: {
        tenantId: cuenta.tenantId,
        professionalId: profile.id,
        engagementType: 'EMPLOYEE',
        status: 'ACTIVE',
        startsOn: new Date(Date.UTC(ayer.getUTCFullYear(), ayer.getUTCMonth(), ayer.getUTCDate())),
        endsOn: null,
      },
      select: { id: true },
    });

    return profile.id;
  }

  public async asignacion(tenantId: string, patientId: string, professionalId: string): Promise<string> {
    const identityId = await identidadValidadoraFicticia(this.owner, tenantId);
    const assignment = await this.owner.careAssignment.create({
      data: {
        tenantId,
        patientId,
        professionalId,
        role: 'PRIMARY',
        status: 'ACTIVE',
        startsAt: new Date(Date.now() - 60 * 60 * 1000),
        createdByIdentityId: identityId,
      },
      select: { id: true },
    });

    this.assignments.add(assignment.id);
    return assignment.id;
  }

  /** Relación ACTIVE con su alcance antiguo `VISITS_VIEW`. */
  public async relacion(tenantId: string, patientId: string, caregiverPersonId: string): Promise<string> {
    const identityId = await identidadValidadoraFicticia(this.owner, tenantId);
    const relationship = await this.owner.patientCaregiverRelationship.create({
      data: {
        tenantId,
        patientId,
        caregiverPersonId,
        relationshipType: 'DECLARED_CARE_SUPPORT',
        purpose: 'HOME_CARE_COORDINATION',
        status: 'ACTIVE',
        validationSource: 'CONTROLLED_MVP_OPERATOR_ASSERTION',
        startsAt: new Date(Date.now() - 60 * 60 * 1000),
        authorizationReference: 'SOPORTE.FICTICIO-PRUEBAS',
        validatedByInstitutionalIdentityId: identityId,
        validatedAt: new Date(),
      },
      select: { id: true },
    });

    await this.owner.patientCaregiverRelationshipScope.create({
      data: { tenantId, relationshipId: relationship.id, scope: 'VISITS_VIEW' },
      select: { id: true },
    });

    this.relationships.add(relationship.id);
    return relationship.id;
  }

  public async manager(
    tenantId: string,
    organizationId: string,
    humanAccountId: string,
    grantedByHumanAccountId: string,
    options: { readonly startsAt?: Date; readonly endsAt?: Date | null } = {},
  ): Promise<string> {
    const manager = await this.owner.organizationCareManager.create({
      data: {
        tenantId,
        organizationId,
        humanAccountId,
        grantedByHumanAccountId,
        startsAt: options.startsAt ?? new Date(Date.now() - 24 * 60 * 60 * 1000),
        endsAt: options.endsAt ?? null,
        authorizationReference: referenciaFicticia('MANAGER'),
      },
      select: { id: true },
    });

    this.managers.add(manager.id);
    return manager.id;
  }

  /**
   * Paciente FICTICIO sin cuenta humana (MP07B / A06): solo para sembrar
   * muchos contextos de paginación sin crear sesiones que no se usan.
   */
  public async pacienteFicticio(tenantId: string): Promise<string> {
    const { patientId, personId } = await crearPacienteFicticio(this.owner, tenantId);
    this.persons.add(personId);
    this.patients.add(patientId);
    return patientId;
  }

  /**
   * `id` opcional (MP07B / A06): fija el orden de los candidatos, que el
   * directorio recorre por id, sin depender del azar de los UUID.
   */
  public async contexto(
    tenantId: string,
    organizationId: string,
    patientId: string,
    createdByHumanAccountId: string,
    options: { readonly id?: string } = {},
  ): Promise<string> {
    const context = await this.owner.patientCareContext.create({
      data: {
        ...(options.id === undefined ? {} : { id: options.id }),
        tenantId,
        organizationId,
        patientId,
        createdByHumanAccountId,
        authorizationReference: referenciaFicticia('CUSTODIA'),
      },
      select: { id: true },
    });

    this.contexts.add(context.id);
    return context.id;
  }

  public async competencia(
    tenantId: string,
    organizationId: string,
    humanAccountId: string,
    validatedByHumanAccountId: string,
    options: { readonly startsAt?: Date; readonly endsAt?: Date | null } = {},
  ): Promise<string> {
    const attestation = await this.owner.clinicalCompetenceAttestation.create({
      data: {
        tenantId,
        organizationId,
        humanAccountId,
        validatedByHumanAccountId,
        evidenceReference: referenciaFicticia('COMPETENCIA'),
        startsAt: options.startsAt ?? new Date(Date.now() - 24 * 60 * 60 * 1000),
        endsAt: options.endsAt ?? null,
      },
      select: { id: true },
    });

    this.competences.add(attestation.id);
    return attestation.id;
  }

  public async concesion(input: ConcesionFicticia): Promise<string> {
    const authorization = await this.owner.careAuthorization.create({
      data: {
        tenantId: input.tenantId,
        organizationId: input.organizationId,
        contextId: input.contextId,
        patientId: input.patientId,
        humanAccountId: input.humanAccountId,
        actorKind: input.actorKind,
        permission: input.permission,
        purpose: 'CARE_RECORDING_AND_ALERTS',
        startsAt: input.startsAt ?? new Date(Date.now() - 60 * 60 * 1000),
        endsAt: input.endsAt ?? null,
        caregiverRelationshipId: input.caregiverRelationshipId ?? null,
        careAssignmentId: input.careAssignmentId ?? null,
        competenceAttestationId: input.competenceAttestationId ?? null,
        authorizationReference: referenciaFicticia('CONCESION'),
        grantedByHumanAccountId: input.grantedByHumanAccountId,
      },
      select: { id: true },
    });

    this.authorizations.add(authorization.id);
    return authorization.id;
  }

  /**
   * Retira lo sembrado en orden de FK RESTRICT. Las organizaciones con eventos
   * de auditoría se conservan; los eventos nunca se tocan.
   */
  public async retirar(): Promise<void> {
    const ids = (set: ReadonlySet<string>): string[] => [...set];
    const owner = this.owner;

    await owner.careAuthorization.deleteMany({ where: { id: { in: ids(this.authorizations) } } });
    await owner.clinicalCompetenceAttestation.deleteMany({ where: { id: { in: ids(this.competences) } } });
    await owner.patientCareContext.deleteMany({ where: { id: { in: ids(this.contexts) } } });
    await owner.organizationCareManager.deleteMany({ where: { id: { in: ids(this.managers) } } });
    await owner.organization.deleteMany({
      where: { id: { in: ids(this.organizations) }, auditEvents: { none: {} } },
    });
    await owner.careAssignment.deleteMany({ where: { id: { in: ids(this.assignments) } } });
    await owner.patientCaregiverRelationshipScope.deleteMany({
      where: { relationshipId: { in: ids(this.relationships) } },
    });
    await owner.patientCaregiverRelationship.deleteMany({ where: { id: { in: ids(this.relationships) } } });
    await owner.patient.deleteMany({ where: { id: { in: ids(this.patients) } } });
    await owner.professionalAffiliation.deleteMany({
      where: { professionalId: { in: ids(this.professionals) } },
    });
    await owner.professionalProfile.deleteMany({ where: { id: { in: ids(this.professionals) } } });
    await owner.accessRequest.deleteMany({ where: { humanAccountId: { in: ids(this.accounts) } } });
    await owner.humanSession.deleteMany({ where: { humanAccountId: { in: ids(this.accounts) } } });
    await owner.externalAuthIdentity.deleteMany({ where: { humanAccountId: { in: ids(this.accounts) } } });
    await owner.humanAccount.deleteMany({ where: { id: { in: ids(this.accounts) } } });
    await owner.person.deleteMany({ where: { id: { in: ids(this.persons) } } });
  }
}

export interface CuentaFicticia {
  readonly tenantId: string;
  readonly personId: string;
  readonly humanAccountId: string;
  readonly bindingId: string;
  readonly sessionId: string;
  /** Token en claro de la sesión. Solo existe en memoria de la prueba. */
  readonly sessionToken: string;
  /** Documento FICTICIO (cédula, ya normalizado). */
  readonly documentNumber: string;
}

export interface ConcesionFicticia {
  readonly tenantId: string;
  readonly organizationId: string;
  readonly contextId: string;
  readonly patientId: string;
  readonly humanAccountId: string;
  readonly actorKind: 'CAREGIVER' | 'PROFESSIONAL' | 'HOSPITAL_REVIEWER';
  readonly permission: 'VIEW_RECORDS' | 'CONTRIBUTE_RECORDS' | 'REQUEST_ALARM' | 'MANAGE_RULES' | 'REVIEW_ALARMS';
  readonly grantedByHumanAccountId: string;
  readonly caregiverRelationshipId?: string;
  readonly careAssignmentId?: string;
  readonly competenceAttestationId?: string;
  readonly startsAt?: Date;
  readonly endsAt?: Date | null;
}

/** Principal tal como lo construiría `HumanSessionGuard` para esa sesión. */
export function principalDe(cuenta: CuentaFicticia): HumanPrincipal {
  return {
    sessionId: cuenta.sessionId,
    humanAccountId: cuenta.humanAccountId,
    personId: cuenta.personId,
    tenantId: cuenta.tenantId,
    externalAuthIdentityId: cuenta.bindingId,
  };
}
