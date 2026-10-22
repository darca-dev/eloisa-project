import { Inject, Injectable } from '@nestjs/common';

import { CareContextService, type ManagedOrganization } from '../care-context/care-context.service';
import { CareConflictError } from '../care-context/care-mutation';
import { CareNotFoundError, CareValidationError } from '../care-context/care-request';
import { type PrismaTransaction } from '../database/prisma-transaction';
import { type HumanPrincipal } from '../identity-access/human-principal';

import {
  type AdminOverviewView,
  type CompetenceInput,
  type CreateContextInput,
  type GrantInput,
  type ManagedOrganizationView,
  type PersonReference,
} from './care-admin.contract';

interface Request {
  readonly principal: HumanPrincipal;
  readonly correlationId: string;
  readonly now: Date;
}

type AdminEvent =
  | 'CARE_ADMIN_CONTEXT_CREATED'
  | 'CARE_ADMIN_GRANT_ISSUED'
  | 'CARE_ADMIN_GRANT_REVOKED'
  | 'CARE_ADMIN_COMPETENCE_ATTESTED'
  | 'CARE_ADMIN_COMPETENCE_REVOKED';

const RESOURCE_BY_EVENT: Readonly<Record<AdminEvent, string>> = {
  CARE_ADMIN_CONTEXT_CREATED: 'PatientCareContext',
  CARE_ADMIN_GRANT_ISSUED: 'CareAuthorization',
  CARE_ADMIN_GRANT_REVOKED: 'CareAuthorization',
  CARE_ADMIN_COMPETENCE_ATTESTED: 'ClinicalCompetenceAttestation',
  CARE_ADMIN_COMPETENCE_REVOKED: 'ClinicalCompetenceAttestation',
};

/** Permisos que cada tipo de actor puede recibir (forma de MP01). */
const ALLOWED: Readonly<Record<GrantInput['actorKind'], readonly GrantInput['permission'][]>> = {
  CAREGIVER: ['VIEW_RECORDS', 'CONTRIBUTE_RECORDS', 'REQUEST_ALARM'],
  PROFESSIONAL: ['VIEW_RECORDS', 'CONTRIBUTE_RECORDS', 'REQUEST_ALARM', 'MANAGE_RULES', 'REVIEW_ALARMS'],
  HOSPITAL_REVIEWER: ['VIEW_RECORDS', 'REVIEW_ALARMS'],
};

/**
 * Administración de permisos de cuidado por el GESTOR (SPEC 055 / MP05b).
 *
 * Toda operación pasa por `withManagedOrganization`: sesión, organización y
 * capacidad de gestor vigente se verifican y bloquean en la misma transacción.
 * El gestor administra; no obtiene acceso clínico por ello. Cada concesión
 * exige el vínculo que MP01 pide —relación, asignación o competencia— y la
 * base vuelve a comprobarlo en el trigger de emisión.
 *
 * Personas por documento EXACTO normalizado; no hay listados del tenant. Las
 * respuestas solo nombran a las personas con nombre e inicial.
 */
@Injectable()
export class CareAdminService {
  constructor(@Inject(CareContextService) private readonly care: CareContextService) {}

  public organizations(request: Request): Promise<readonly ManagedOrganizationView[]> {
    return this.care.listManagedOrganizations(request.principal, request.now);
  }

  public overview(request: Request, organizationId: string): Promise<AdminOverviewView> {
    return this.care.withManagedOrganization(request.principal, organizationId, request.correlationId, request.now, async (tx, managed) => {
      await audit(tx, managed, request, 'CARE_ADMIN_READ', null);
      return this.readOverview(tx, managed);
    });
  }

  public createContext(request: Request, organizationId: string, input: CreateContextInput): Promise<AdminOverviewView> {
    return this.care.withManagedOrganization(request.principal, organizationId, request.correlationId, request.now, async (tx, managed) => {
      const personId = await personOf(tx, managed, input.patient);
      const patient = await tx.patient.findFirst({
        where: { tenantId: managed.tenantId, personId, status: 'ACTIVE' },
        select: { id: true },
      });

      if (patient === null) {
        throw new CareValidationError('patient', 'No hay un paciente activo con ese documento.');
      }

      const existing = await tx.patientCareContext.findFirst({
        where: { tenantId: managed.tenantId, organizationId: managed.organizationId, patientId: patient.id },
        select: { id: true },
      });

      if (existing !== null) {
        throw new CareConflictError('ALREADY_EXISTS');
      }

      const context = await tx.patientCareContext.create({
        data: {
          tenantId: managed.tenantId,
          organizationId: managed.organizationId,
          patientId: patient.id,
          authorizationReference: input.authorizationReference,
          createdByHumanAccountId: managed.humanAccountId,
        },
        select: { id: true },
      });

      await audit(tx, managed, request, 'CARE_ADMIN_CONTEXT_CREATED', context.id);
      return this.readOverview(tx, managed);
    });
  }

  public grant(request: Request, organizationId: string, contextId: string, input: GrantInput): Promise<AdminOverviewView> {
    return this.care.withManagedOrganization(request.principal, organizationId, request.correlationId, request.now, async (tx, managed) => {
      if (!ALLOWED[input.actorKind].includes(input.permission)) {
        throw new CareValidationError('permission', 'Ese permiso no corresponde a este tipo de participante.');
      }

      const context = await tx.patientCareContext.findFirst({
        where: { id: contextId, tenantId: managed.tenantId, organizationId: managed.organizationId, status: 'ACTIVE' },
        select: { id: true, patientId: true },
      });

      if (context === null) {
        throw new CareNotFoundError();
      }

      const personId = await personOf(tx, managed, input.person);
      const accountId = await accountOf(tx, managed, personId);
      const clinical = input.permission === 'MANAGE_RULES' || input.permission === 'REVIEW_ALARMS';

      if (clinical && accountId === managed.humanAccountId) {
        throw new CareValidationError('person', 'Nadie se concede a sí mismo reglas ni revisión.');
      }

      let caregiverRelationshipId: string | null = null;
      let careAssignmentId: string | null = null;
      let competenceAttestationId: string | null = null;

      if (input.actorKind === 'CAREGIVER') {
        const relationship = await tx.patientCaregiverRelationship.findFirst({
          where: {
            tenantId: managed.tenantId,
            patientId: context.patientId,
            caregiverPersonId: personId,
            status: 'ACTIVE',
            startsAt: { lte: request.now },
            OR: [{ endsAt: null }, { endsAt: { gt: request.now } }],
          },
          select: { id: true },
        });
        if (relationship === null) {
          throw new CareValidationError('person', 'Esa persona no tiene una relación de cuidado activa con este paciente.');
        }
        caregiverRelationshipId = relationship.id;
      }

      if (input.actorKind === 'PROFESSIONAL') {
        const assignment = await tx.careAssignment.findFirst({
          where: {
            tenantId: managed.tenantId,
            patientId: context.patientId,
            status: 'ACTIVE',
            startsAt: { lte: request.now },
            OR: [{ endsAt: null }, { endsAt: { gt: request.now } }],
            professional: { personId, status: 'ACTIVE' },
          },
          select: { id: true },
        });
        if (assignment === null) {
          throw new CareValidationError('person', 'Esa persona no tiene una asignación activa con este paciente.');
        }
        careAssignmentId = assignment.id;
      }

      if (clinical || input.actorKind === 'HOSPITAL_REVIEWER') {
        const competence = await tx.clinicalCompetenceAttestation.findFirst({
          where: {
            tenantId: managed.tenantId,
            organizationId: managed.organizationId,
            humanAccountId: accountId,
            status: 'ACTIVE',
            startsAt: { lte: request.now },
            OR: [{ endsAt: null }, { endsAt: { gt: request.now } }],
          },
          orderBy: { createdAt: 'desc' },
          select: { id: true },
        });
        if (competence === null) {
          throw new CareValidationError('person', 'Registre primero la competencia vigente de esa persona en esta organización.');
        }
        competenceAttestationId = competence.id;
      }

      const duplicate = await tx.careAuthorization.findFirst({
        where: { contextId: context.id, humanAccountId: accountId, actorKind: input.actorKind, permission: input.permission, status: 'ACTIVE' },
        select: { id: true },
      });

      if (duplicate !== null) {
        throw new CareConflictError('ALREADY_EXISTS');
      }

      const created = await tx.careAuthorization.create({
        data: {
          tenantId: managed.tenantId,
          organizationId: managed.organizationId,
          contextId: context.id,
          patientId: context.patientId,
          humanAccountId: accountId,
          actorKind: input.actorKind,
          permission: input.permission,
          purpose: 'CARE_RECORDING_AND_ALERTS',
          startsAt: request.now,
          endsAt: input.endsAt,
          caregiverRelationshipId,
          careAssignmentId,
          competenceAttestationId,
          authorizationReference: input.authorizationReference,
          grantedByHumanAccountId: managed.humanAccountId,
        },
        select: { id: true },
      });

      await audit(tx, managed, request, 'CARE_ADMIN_GRANT_ISSUED', created.id);
      return this.readOverview(tx, managed);
    });
  }

  public revokeGrant(request: Request, organizationId: string, grantId: string): Promise<AdminOverviewView> {
    return this.care.withManagedOrganization(request.principal, organizationId, request.correlationId, request.now, async (tx, managed) => {
      const updated = await tx.careAuthorization.updateMany({
        where: { id: grantId, tenantId: managed.tenantId, organizationId: managed.organizationId, status: 'ACTIVE' },
        data: { status: 'REVOKED', revokedAt: request.now },
      });
      if (updated.count !== 1) {
        throw new CareNotFoundError();
      }
      await audit(tx, managed, request, 'CARE_ADMIN_GRANT_REVOKED', grantId);
      return this.readOverview(tx, managed);
    });
  }

  public attestCompetence(request: Request, organizationId: string, input: CompetenceInput): Promise<AdminOverviewView> {
    return this.care.withManagedOrganization(request.principal, organizationId, request.correlationId, request.now, async (tx, managed) => {
      const accountId = await accountOf(tx, managed, await personOf(tx, managed, input.person));

      if (accountId === managed.humanAccountId) {
        throw new CareValidationError('person', 'Nadie valida su propia competencia.');
      }

      const created = await tx.clinicalCompetenceAttestation.create({
        data: {
          tenantId: managed.tenantId,
          organizationId: managed.organizationId,
          humanAccountId: accountId,
          evidenceReference: input.evidenceReference,
          validatedByHumanAccountId: managed.humanAccountId,
          startsAt: request.now,
          endsAt: input.endsAt,
        },
        select: { id: true },
      });

      await audit(tx, managed, request, 'CARE_ADMIN_COMPETENCE_ATTESTED', created.id);
      return this.readOverview(tx, managed);
    });
  }

  public revokeCompetence(request: Request, organizationId: string, competenceId: string): Promise<AdminOverviewView> {
    return this.care.withManagedOrganization(request.principal, organizationId, request.correlationId, request.now, async (tx, managed) => {
      const updated = await tx.clinicalCompetenceAttestation.updateMany({
        where: { id: competenceId, tenantId: managed.tenantId, organizationId: managed.organizationId, status: 'ACTIVE' },
        data: { status: 'REVOKED', revokedAt: request.now },
      });
      if (updated.count !== 1) {
        throw new CareNotFoundError();
      }
      await audit(tx, managed, request, 'CARE_ADMIN_COMPETENCE_REVOKED', competenceId);
      return this.readOverview(tx, managed);
    });
  }

  private async readOverview(tx: PrismaTransaction, managed: ManagedOrganization): Promise<AdminOverviewView> {
    const contexts = await tx.patientCareContext.findMany({
      where: { tenantId: managed.tenantId, organizationId: managed.organizationId },
      orderBy: { createdAt: 'asc' },
      take: 200,
      select: {
        id: true,
        status: true,
        authorizationReference: true,
        createdAt: true,
        patient: { select: { person: { select: { givenNames: true, familyNames: true } } } },
        authorizations: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            actorKind: true,
            permission: true,
            status: true,
            startsAt: true,
            endsAt: true,
            authorizationReference: true,
            account: { select: { person: { select: { givenNames: true, familyNames: true } } } },
          },
        },
      },
    });

    const competences = await tx.clinicalCompetenceAttestation.findMany({
      where: { tenantId: managed.tenantId, organizationId: managed.organizationId },
      orderBy: { createdAt: 'asc' },
      take: 200,
      select: {
        id: true,
        status: true,
        evidenceReference: true,
        startsAt: true,
        endsAt: true,
        account: { select: { person: { select: { givenNames: true, familyNames: true } } } },
      },
    });

    return {
      organizationId: managed.organizationId,
      organizationName: managed.organizationName,
      contexts: contexts.map((context) => ({
        contextId: context.id,
        patientLabel: label(context.patient.person),
        status: context.status,
        authorizationReference: context.authorizationReference,
        createdAt: context.createdAt.toISOString(),
        grants: context.authorizations.map((grant) => ({
          id: grant.id,
          actorKind: grant.actorKind,
          permission: grant.permission,
          personLabel: label(grant.account.person),
          status: grant.status,
          startsAt: grant.startsAt.toISOString(),
          endsAt: grant.endsAt?.toISOString() ?? null,
          authorizationReference: grant.authorizationReference,
        })),
      })),
      competences: competences.map((competence) => ({
        id: competence.id,
        personLabel: label(competence.account.person),
        status: competence.status,
        evidenceReference: competence.evidenceReference,
        startsAt: competence.startsAt.toISOString(),
        endsAt: competence.endsAt?.toISOString() ?? null,
      })),
    };
  }
}

/** Persona por documento exacto normalizado en el tenant, o error de campo. */
async function personOf(tx: PrismaTransaction, managed: ManagedOrganization, reference: PersonReference): Promise<string> {
  const person = await tx.person.findFirst({
    where: { tenantId: managed.tenantId, documentType: reference.documentType, documentNumberNormalized: reference.documentNumber },
    select: { id: true },
  });
  if (person === null) {
    throw new CareValidationError('person', 'No hay ninguna persona registrada con ese documento.');
  }
  return person.id;
}

/** La cuenta humana ACTIVA única de la persona. */
async function accountOf(tx: PrismaTransaction, managed: ManagedOrganization, personId: string): Promise<string> {
  const accounts = await tx.humanAccount.findMany({
    where: { tenantId: managed.tenantId, personId, status: 'ACTIVE' },
    select: { id: true },
    take: 2,
  });
  const [account] = accounts;
  if (accounts.length !== 1 || account === undefined) {
    throw new CareValidationError('person', 'Esa persona no tiene una cuenta activa única para ingresar.');
  }
  return account.id;
}

function label(person: { readonly givenNames: string; readonly familyNames: string }): string {
  const given = person.givenNames.trim().split(/\s+/u)[0] ?? '';
  const initial = person.familyNames.trim().charAt(0);
  return [given, initial === '' ? '' : `${initial}.`].filter((part) => part !== '').join(' ') || 'Persona';
}

async function audit(
  tx: PrismaTransaction,
  managed: ManagedOrganization,
  request: Request,
  eventType: AdminEvent | 'CARE_ADMIN_READ',
  resourceId: string | null,
): Promise<void> {
  await tx.auditEvent.create({
    data: {
      tenantId: managed.tenantId,
      organizationId: managed.organizationId,
      eventType,
      actorType: 'HUMAN_ACCOUNT',
      actorUserId: managed.humanAccountId,
      actorRole: null,
      resourceType: eventType === 'CARE_ADMIN_READ' ? 'CareOrganizationAdministration' : RESOURCE_BY_EVENT[eventType],
      resourceId,
      outcome: 'SUCCESS',
      endpoint: `internal:care-admin.${eventType.toLowerCase()}`,
      correlationId: request.correlationId,
      occurredAt: request.now,
    },
    select: { id: true },
  });
}
