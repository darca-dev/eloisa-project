import { describe, expect, it } from 'vitest';

import { type PrismaTransaction } from '../database/prisma-transaction';
import { type HumanPrincipal } from '../identity-access/human-principal';
import { type IdentityAccessService } from '../identity-access/identity-access.service';

import { type CareContextPermission } from './care-context.contract';
import { CareContextPolicy } from './care-context.policy';

const PRINCIPAL: HumanPrincipal = {
  sessionId: '00000000-0000-4000-8000-000000000001',
  humanAccountId: '00000000-0000-4000-8000-000000000002',
  personId: '00000000-0000-4000-8000-000000000003',
  tenantId: '00000000-0000-4000-8000-000000000004',
  externalAuthIdentityId: '00000000-0000-4000-8000-000000000005',
};

const ORG = '00000000-0000-4000-8000-0000000000a1';
const CONTEXT = '00000000-0000-4000-8000-0000000000c1';
const PATIENT = '00000000-0000-4000-8000-0000000000d1';
const GRANT = '00000000-0000-4000-8000-0000000000e1';
const RELATIONSHIP = '00000000-0000-4000-8000-0000000000f1';
const ASSIGNMENT = '00000000-0000-4000-8000-0000000000f2';
const PROFESSIONAL = '00000000-0000-4000-8000-0000000000f3';
const COMPETENCE = '00000000-0000-4000-8000-0000000000f4';
const MANAGER = '00000000-0000-4000-8000-0000000000f5';

const NOW = new Date('2026-10-21T12:00:00.000Z');
const RESOURCE = { organizationId: ORG, contextId: CONTEXT };

/** Tablas en el orden de bloqueo contractual. */
const TABLES = [
  'human_account',
  'human_session',
  'external_auth_identity',
  'organization',
  'patient_care_context',
  'care_authorization',
  'patient_caregiver_relationship',
  'care_assignment',
  'professional_profile',
  'professional_affiliation',
  'clinical_competence_attestation',
] as const;

type Table = (typeof TABLES)[number];

interface GrantRow {
  readonly actorKind: string;
  readonly caregiverRelationshipId?: string | null;
  readonly careAssignmentId?: string | null;
  readonly competenceAttestationId?: string | null;
}

interface SpyOptions {
  readonly rows?: Partial<Record<Table, readonly Record<string, unknown>[]>>;
  readonly grant?: GrantRow | null;
  readonly experience?: boolean;
  readonly manager?: boolean;
  readonly organizationExists?: boolean;
}

function spy(options: SpyOptions = {}) {
  const operations: string[] = [];
  const sql: string[] = [];

  const defaults: Record<Table, readonly Record<string, unknown>[]> = {
    human_account: [{ authenticationNotBefore: null }],
    human_session: [{ createdAt: new Date(NOW.getTime() - 60_000), lastUsedAt: null, expiresAt: new Date(NOW.getTime() + 3_600_000) }],
    external_auth_identity: [{ id: PRINCIPAL.externalAuthIdentityId }],
    organization: [{ id: ORG, kind: 'HOSPITAL', status: 'ACTIVE' }],
    patient_care_context: [{ id: CONTEXT, patientId: PATIENT }],
    care_authorization:
      options.grant === null
        ? []
        : [
            {
              id: GRANT,
              actorKind: options.grant?.actorKind ?? 'PROFESSIONAL',
              caregiverRelationshipId: options.grant?.caregiverRelationshipId ?? null,
              careAssignmentId: options.grant === undefined ? ASSIGNMENT : (options.grant.careAssignmentId ?? null),
              competenceAttestationId: options.grant === undefined ? COMPETENCE : (options.grant.competenceAttestationId ?? null),
              grantedByHumanAccountId: MANAGER,
              createdAt: new Date(NOW.getTime() - 86_400_000),
            },
          ],
    patient_caregiver_relationship: [{ id: RELATIONSHIP }],
    care_assignment: [{ professionalId: PROFESSIONAL }],
    professional_profile: [{ id: PROFESSIONAL }],
    professional_affiliation: [{ id: 'afiliacion' }],
    clinical_competence_attestation: [{ id: COMPETENCE }],
  };

  const tx = {
    $queryRaw: async (strings: TemplateStringsArray) => {
      const text = strings.join('?');
      const table = TABLES.find((name) => text.includes(`FROM "${name}"`));
      if (table === undefined) {
        throw new Error(`consulta inesperada: ${text}`);
      }
      operations.push(`${table}${/FOR SHARE\s*$/u.test(text) ? ':share' : ''}`);
      sql.push(text);
      return options.rows?.[table] ?? defaults[table];
    },
    accessRequest: {
      findFirst: async () => {
        operations.push('access_request:read');
        return options.experience === false ? null : { id: 'aprobada' };
      },
    },
    organizationCareManager: {
      findFirst: async () => {
        operations.push('organization_care_manager:read');
        return options.manager === false ? null : { id: 'manager' };
      },
    },
    organization: {
      findFirst: async () => {
        operations.push('organization:read');
        return options.organizationExists === false ? null : { id: ORG };
      },
    },
  } as unknown as PrismaTransaction;

  return { tx, operations, sql };
}

function policy(ownPatient: string | null = null, limits: { idleSeconds: number } | null = { idleSeconds: 3_600 }) {
  const identity = {
    resolveApprovedPatientWithin: async () => (ownPatient === null ? null : { patientId: ownPatient }),
  } as unknown as IdentityAccessService;

  return new CareContextPolicy(identity, limits);
}

async function decide(
  options: SpyOptions,
  permission: CareContextPermission,
  principal: HumanPrincipal = PRINCIPAL,
  instance = policy(),
) {
  const harness = spy(options);
  const decision = await instance.decideWithin(harness.tx, principal, RESOURCE, permission, NOW);

  return { decision, ...harness };
}

describe('CareContextPolicy — orden de bloqueo', () => {
  it('profesional con MANAGE_RULES: cuenta → sesión → vínculo → organización → contexto → concesión → asignación → perfil → afiliación → competencia', async () => {
    const { decision, operations } = await decide({}, 'MANAGE_RULES');

    expect(decision).toEqual({
      kind: 'granted',
      authorized: {
        tenantId: PRINCIPAL.tenantId,
        organizationId: ORG,
        contextId: CONTEXT,
        patientId: PATIENT,
        humanAccountId: PRINCIPAL.humanAccountId,
        actorKind: 'PROFESSIONAL',
        permission: 'MANAGE_RULES',
        careAuthorizationId: GRANT,
        caregiverRelationshipId: null,
        careAssignmentId: ASSIGNMENT,
        competenceAttestationId: COMPETENCE,
      },
    });
    expect(operations.filter((operation) => operation.endsWith(':share'))).toEqual([
      'human_account:share',
      'human_session:share',
      'external_auth_identity:share',
      'organization:share',
      'patient_care_context:share',
      'care_authorization:share',
      'care_assignment:share',
      'professional_profile:share',
      'professional_affiliation:share',
      'clinical_competence_attestation:share',
    ]);
  });

  it('las consultas de identidad fijan cuenta, persona, tenant, sesión y vínculo exactos', async () => {
    const { sql } = await decide({}, 'MANAGE_RULES');

    expect(sql[0]).toMatch(/"personId" = \?::uuid/u);
    expect(sql[0]).toContain('NOT "passwordRecoveryBlocked"');
    expect(sql[1]).toMatch(/"externalAuthIdentityId" = \?::uuid/u);
    expect(sql[1]).toContain('"revokedAt" IS NULL');
    expect(sql[2]).toContain('"status" = \'ACTIVE\'');
    expect(sql[5]).toMatch(/"permission"::text = \?/u);
    expect(sql[5]).toMatch(/"purpose"::text = \?/u);
    expect(sql[5]).toContain('ORDER BY "id"');
  });

  it('el paciente propio no necesita concesión y no bloquea concesiones', async () => {
    const { decision, operations } = await decide({}, 'VIEW_RECORDS', PRINCIPAL, policy(PATIENT));

    expect(decision.kind).toBe('granted');
    expect(decision.kind === 'granted' ? decision.authorized.actorKind : null).toBe('PATIENT');
    expect(operations).not.toContain('care_authorization:share');
  });
});

describe('CareContextPolicy — denegaciones', () => {
  it('sin vínculo exacto en el principal no bloquea nada y deniega', async () => {
    const { decision, operations } = await decide({}, 'VIEW_RECORDS', { ...PRINCIPAL, externalAuthIdentityId: undefined });

    expect(decision).toEqual({ kind: 'denied', organizationId: ORG });
    expect(operations).toEqual(['organization:read']);
  });

  it('sin límites de sesión aprovisionados deniega', async () => {
    const { decision } = await decide({}, 'VIEW_RECORDS', PRINCIPAL, policy(null, null));

    expect(decision.kind).toBe('denied');
  });

  it.each([
    ['cuenta no activa', { human_account: [] }],
    ['sesión revocada o de otro vínculo', { human_session: [] }],
    ['vínculo desvinculado', { external_auth_identity: [] }],
    ['sesión caducada exactamente ahora', { human_session: [{ createdAt: new Date(NOW.getTime() - 60_000), lastUsedAt: null, expiresAt: NOW }] }],
    ['sesión inactiva', { human_session: [{ createdAt: new Date(NOW.getTime() - 7_200_000), lastUsedAt: new Date(NOW.getTime() - 3_600_000), expiresAt: new Date(NOW.getTime() + 3_600_000) }] }],
    ['sesión anterior al corte de autenticación', { human_account: [{ authenticationNotBefore: new Date(NOW.getTime() - 30_000) }] }],
  ] as const)('%s → deniega', async (_caso, rows) => {
    const { decision, operations } = await decide({ rows }, 'MANAGE_RULES');

    expect(decision.kind).toBe('denied');
    expect(operations).not.toContain('organization:share');
  });

  it('organización inexistente en el tenant: denegación sin organización atribuible', async () => {
    const { decision } = await decide({ rows: { organization: [] } }, 'VIEW_RECORDS');

    expect(decision).toEqual({ kind: 'denied', organizationId: null });
  });

  it('organización MUNICIPALITY nunca habilita, aunque exista una concesión', async () => {
    const { decision, operations } = await decide(
      { rows: { organization: [{ id: ORG, kind: 'MUNICIPALITY', status: 'ACTIVE' }] } },
      'VIEW_RECORDS',
      PRINCIPAL,
      policy(PATIENT),
    );

    expect(decision).toEqual({ kind: 'denied', organizationId: ORG });
    expect(operations).not.toContain('patient_care_context:share');
  });

  it('organización deshabilitada deniega', async () => {
    const { decision } = await decide({ rows: { organization: [{ id: ORG, kind: 'HOSPITAL', status: 'DISABLED' }] } }, 'VIEW_RECORDS');

    expect(decision).toEqual({ kind: 'denied', organizationId: ORG });
  });

  it('contexto ausente, revocado o de otra organización deniega', async () => {
    const { decision } = await decide({ rows: { patient_care_context: [] } }, 'VIEW_RECORDS', PRINCIPAL, policy(PATIENT));

    expect(decision).toEqual({ kind: 'denied', organizationId: ORG });
  });

  it('el paciente propio no obtiene MANAGE_RULES ni REVIEW_ALARMS sin concesión', async () => {
    for (const permission of ['MANAGE_RULES', 'REVIEW_ALARMS'] as const) {
      const { decision } = await decide({ grant: null }, permission, PRINCIPAL, policy(PATIENT));

      expect(decision.kind).toBe('denied');
    }
  });

  it('el paciente de OTRO contexto no se beneficia del acceso propio', async () => {
    const { decision } = await decide({ grant: null }, 'VIEW_RECORDS', PRINCIPAL, policy('00000000-0000-4000-8000-00000000ffff'));

    expect(decision.kind).toBe('denied');
  });

  it('sin concesión (p. ej. manager o permiso antiguo solo) deniega', async () => {
    const { decision } = await decide({ grant: null }, 'VIEW_RECORDS');

    expect(decision).toEqual({ kind: 'denied', organizationId: ORG });
  });

  it('una concesión emitida por quien no era manager vigente no autoriza', async () => {
    const { decision } = await decide({ manager: false }, 'CONTRIBUTE_RECORDS');

    expect(decision.kind).toBe('denied');
  });

  it('cuidador: exige experiencia CAREGIVER aprobada exacta', async () => {
    const grant = { actorKind: 'CAREGIVER', caregiverRelationshipId: RELATIONSHIP, careAssignmentId: null, competenceAttestationId: null };

    expect((await decide({ grant }, 'CONTRIBUTE_RECORDS')).decision.kind).toBe('granted');
    expect((await decide({ grant, experience: false }, 'CONTRIBUTE_RECORDS')).decision.kind).toBe('denied');
  });

  it('cuidador: relación revocada, vencida, de otro paciente o de otra persona deniega', async () => {
    const grant = { actorKind: 'CAREGIVER', caregiverRelationshipId: RELATIONSHIP, careAssignmentId: null, competenceAttestationId: null };
    const { decision, sql } = await decide({ grant, rows: { patient_caregiver_relationship: [] } }, 'VIEW_RECORDS');

    expect(decision.kind).toBe('denied');
    const relacion = sql.find((text) => text.includes('FROM "patient_caregiver_relationship"')) ?? '';
    expect(relacion).toMatch(/"patientId" = \?::uuid/u);
    expect(relacion).toMatch(/"caregiverPersonId" = \?::uuid/u);
    expect(relacion).toMatch(/"endsAt" > \?::timestamptz/u);
  });

  it('cuidador nunca obtiene MANAGE_RULES ni REVIEW_ALARMS, aunque la fila existiera', async () => {
    const grant = { actorKind: 'CAREGIVER', caregiverRelationshipId: RELATIONSHIP, careAssignmentId: null, competenceAttestationId: null };

    expect((await decide({ grant }, 'MANAGE_RULES')).decision.kind).toBe('denied');
    expect((await decide({ grant }, 'REVIEW_ALARMS')).decision.kind).toBe('denied');
  });

  it.each([
    ['asignación terminada o de otro paciente', { care_assignment: [] }],
    ['perfil inactivo o de otra persona', { professional_profile: [] }],
    ['sin afiliación vigente', { professional_affiliation: [] }],
  ] as const)('profesional: %s → deniega', async (_caso, rows) => {
    const { decision } = await decide({ rows }, 'CONTRIBUTE_RECORDS');

    expect(decision.kind).toBe('denied');
  });

  it('profesional: competencia ausente o vencida deniega MANAGE_RULES pero no CONTRIBUTE_RECORDS', async () => {
    const rows = { clinical_competence_attestation: [] };

    expect((await decide({ rows }, 'MANAGE_RULES')).decision.kind).toBe('denied');
    expect((await decide({ rows }, 'CONTRIBUTE_RECORDS')).decision.kind).toBe('granted');
  });

  it('profesional: exige experiencia FIELD_PROFESSIONAL aprobada exacta', async () => {
    expect((await decide({ experience: false }, 'CONTRIBUTE_RECORDS')).decision.kind).toBe('denied');
  });

  it('revisor: REVIEW_ALARMS y VIEW_RECORDS exigen competencia; no necesita experiencia de solicitante', async () => {
    const grant = { actorKind: 'HOSPITAL_REVIEWER', caregiverRelationshipId: null, careAssignmentId: null, competenceAttestationId: COMPETENCE };

    expect((await decide({ grant, experience: false }, 'REVIEW_ALARMS')).decision.kind).toBe('granted');
    expect((await decide({ grant, experience: false }, 'VIEW_RECORDS')).decision.kind).toBe('granted');
    expect((await decide({ grant, rows: { clinical_competence_attestation: [] } }, 'REVIEW_ALARMS')).decision.kind).toBe('denied');
    expect((await decide({ grant }, 'CONTRIBUTE_RECORDS')).decision.kind).toBe('denied');
  });
});
