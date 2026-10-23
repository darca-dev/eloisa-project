import { describe, expect, it } from 'vitest';

import { type PrismaTransaction } from '../database/prisma-transaction';
import { type HumanPrincipal } from '../identity-access/human-principal';
import { type IdentityAccessService } from '../identity-access/identity-access.service';

import { CARE_PERMISSIONS, type CareContextPermission, PATIENT_SELF_PERMISSIONS } from './care-context.contract';
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
  const accessRequestWheres: Record<string, unknown>[] = [];
  const parameters: unknown[][] = [];

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
    $queryRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const text = strings.join('?');
      const table = TABLES.find((name) => text.includes(`FROM "${name}"`));
      if (table === undefined) {
        throw new Error(`consulta inesperada: ${text}`);
      }
      operations.push(`${table}${/FOR SHARE\s*$/u.test(text) ? ':share' : ''}`);
      sql.push(text);
      parameters.push(values);
      const rows = options.rows?.[table] ?? defaults[table];
      if (!text.includes('"permission"::text = ANY(')) {
        return rows;
      }
      // La concesión ficticia existe para cada acción pedida, con esa acción.
      const permissions =
        values.find((value): value is string[] => Array.isArray(value) && value.every((item) => (CARE_PERMISSIONS as readonly unknown[]).includes(item))) ?? [];
      return permissions.flatMap((permission) => rows.map((row) => ({ ...row, permission })));
    },
    accessRequest: {
      findFirst: async (args: { readonly where: Record<string, unknown> }) => {
        operations.push('access_request:read');
        accessRequestWheres.push(args.where);
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

  return { tx, operations, sql, accessRequestWheres, parameters };
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
    const { sql, parameters } = await decide({}, 'MANAGE_RULES');

    expect(sql[0]).toMatch(/"personId" = \?::uuid/u);
    expect(sql[0]).toContain('NOT "passwordRecoveryBlocked"');
    expect(sql[1]).toMatch(/"externalAuthIdentityId" = \?::uuid/u);
    expect(sql[1]).toContain('"revokedAt" IS NULL');
    expect(sql[2]).toContain('"status" = \'ACTIVE\'');
    expect(sql[5]).toMatch(/"permission"::text = ANY\(\?::text\[\]\)/u);
    expect(parameters[5]).toContainEqual(['MANAGE_RULES']);
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

describe('CareContextPolicy — varias acciones de un contexto (MP07B / B06)', () => {
  async function decideMany(options: SpyOptions, principal: HumanPrincipal = PRINCIPAL, instance = policy()) {
    const harness = spy(options);
    const granted = await instance.decideManyWithin(harness.tx, principal, RESOURCE, CARE_PERMISSIONS, NOW);

    return { granted, ...harness };
  }

  /** Lo que concede `decideWithin` llamado acción por acción, en el orden de CARE_PERMISSIONS. */
  async function oneByOne(options: SpyOptions, principal: HumanPrincipal = PRINCIPAL, instance = policy()) {
    const granted: [CareContextPermission, unknown][] = [];
    for (const permission of CARE_PERMISSIONS) {
      const { decision } = await decide(options, permission, principal, instance);
      if (decision.kind === 'granted') {
        granted.push([permission, decision.authorized]);
      }
    }
    return granted;
  }

  const ESCENARIOS: readonly [string, SpyOptions, HumanPrincipal, CareContextPermission[] | null, string | null][] = [
    ['profesional con competencia', {}, PRINCIPAL, null, null],
    ['cuidador', { grant: { actorKind: 'CAREGIVER', caregiverRelationshipId: RELATIONSHIP } }, PRINCIPAL, null, null],
    ['revisor institucional', { grant: { actorKind: 'HOSPITAL_REVIEWER', competenceAttestationId: COMPETENCE } }, PRINCIPAL, null, null],
    ['revisor con competencia revocada', { grant: { actorKind: 'HOSPITAL_REVIEWER', competenceAttestationId: COMPETENCE }, rows: { clinical_competence_attestation: [] } }, PRINCIPAL, [], null],
    ['emisor que no era manager', { manager: false }, PRINCIPAL, [], null],
    ['sin concesión', { grant: null }, PRINCIPAL, [], null],
    ['paciente propio sin concesión', { grant: null }, PRINCIPAL, [...PATIENT_SELF_PERMISSIONS], PATIENT],
    ['sesión revocada', { rows: { human_session: [] } }, PRINCIPAL, [], null],
    ['organización municipal', { rows: { organization: [{ id: ORG, kind: 'MUNICIPALITY', status: 'ACTIVE' }] } }, PRINCIPAL, [], null],
    ['contexto inactivo', { rows: { patient_care_context: [] } }, PRINCIPAL, [], null],
    ['principal sin vínculo', {}, { ...PRINCIPAL, externalAuthIdentityId: undefined }, [], null],
  ];

  for (const [nombre, options, principal, esperadas, propio] of ESCENARIOS) {
    it(`concede exactamente lo mismo que decidir acción por acción: ${nombre}`, async () => {
      const { granted } = await decideMany(options, principal, policy(propio));
      const referencia = await oneByOne(options, principal, policy(propio));

      expect([...granted.entries()]).toEqual(referencia);
      if (esperadas !== null) {
        expect([...granted.keys()]).toEqual(esperadas);
      }
    });
  }

  it('comprueba sesión, organización y contexto UNA vez y bloquea las concesiones de todas las acciones juntas, antes de sus fuentes', async () => {
    const { granted, operations, sql, parameters } = await decideMany({});

    // La concesión ficticia existe para cada acción: todas se conceden.
    expect([...granted.keys()]).toEqual([...CARE_PERMISSIONS]);
    const share = operations.filter((operation) => operation.endsWith(':share'));
    for (const unica of ['human_session:share', 'external_auth_identity:share', 'organization:share', 'patient_care_context:share', 'care_authorization:share']) {
      expect(share.filter((operation) => operation === unica)).toHaveLength(1);
    }
    // Orden MP01: cuenta → sesión → vínculo → organización → contexto → concesiones → fuentes.
    expect(share.slice(0, 6)).toEqual([
      'human_account:share',
      'human_session:share',
      'external_auth_identity:share',
      'organization:share',
      'patient_care_context:share',
      'care_authorization:share',
    ]);
    const indiceConcesiones = sql.findIndex((text) => text.includes('FROM "care_authorization"'));
    expect(parameters[indiceConcesiones]).toContainEqual([...CARE_PERMISSIONS]);
    expect(sql[indiceConcesiones]).toContain('ORDER BY "id"');
  });

  it('el paciente propio no bloquea concesiones de sus acciones propias; solo de las demás', async () => {
    const { operations, sql, parameters } = await decideMany({ grant: null }, PRINCIPAL, policy(PATIENT));
    const indiceConcesiones = sql.findIndex((text) => text.includes('FROM "care_authorization"'));

    expect(operations.filter((operation) => operation === 'care_authorization:share')).toHaveLength(1);
    expect(parameters[indiceConcesiones]).toContainEqual(CARE_PERMISSIONS.filter((permission) => !PATIENT_SELF_PERMISSIONS.includes(permission)));
  });

  it('sin acciones pedidas no consulta nada', async () => {
    const harness = spy({});
    const granted = await policy().decideManyWithin(harness.tx, PRINCIPAL, RESOURCE, [], NOW);

    expect(granted.size).toBe(0);
    expect(harness.operations).toEqual([]);
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

/* ======================================================================== */
/* MP07A / A09 — asignación: prebloqueo conjunto y elegibilidad sin sesión   */
/* ======================================================================== */

const RECIPIENT = '00000000-0000-4000-8000-0000000000b2';
const RECIPIENT_PERSON = '00000000-0000-4000-8000-0000000000b3';
const RECIPIENT_BINDING = '00000000-0000-4000-8000-0000000000b5';

const AUTHORIZED_ACTOR = {
  tenantId: PRINCIPAL.tenantId,
  organizationId: ORG,
  contextId: CONTEXT,
  patientId: PATIENT,
  humanAccountId: PRINCIPAL.humanAccountId,
  actorKind: 'HOSPITAL_REVIEWER' as const,
  permission: 'REVIEW_ALARMS' as const,
  careAuthorizationId: GRANT,
  caregiverRelationshipId: null,
  careAssignmentId: null,
  competenceAttestationId: COMPETENCE,
};

const PINNED = {
  bindingIds: [PRINCIPAL.externalAuthIdentityId ?? '', RECIPIENT_BINDING],
  grantIds: [GRANT],
  assignmentIds: [ASSIGNMENT],
  profileIds: [PROFESSIONAL],
  affiliationIds: ['afiliacion'],
  competenceIds: [COMPETENCE],
};

const RECIPIENT_ACCOUNT = { human_account: [{ personId: RECIPIENT_PERSON }] };

describe('CareContextPolicy — prebloqueo de una asignación (A09)', () => {
  it('las cuentas {actor, destinatario} se bloquean por id, deduplicadas y ordenadas, sin filtrar estado antes del bloqueo', async () => {
    const harness = spy();

    await policy().prelockAccountsWithin(harness.tx, PRINCIPAL.tenantId, [RECIPIENT, PRINCIPAL.humanAccountId, RECIPIENT]);

    expect(harness.operations).toEqual(['human_account:share']);
    expect(harness.sql[0]).not.toContain('"status"');
    expect(harness.sql[0]).toContain('ORDER BY "id"');
    expect(harness.parameters[0]).toContainEqual([PRINCIPAL.humanAccountId, RECIPIENT]);
  });

  it('el resto de fuentes de ambos se bloquea por clase en el orden contractual', async () => {
    const harness = spy({ rows: { care_assignment: [{ id: ASSIGNMENT, professionalId: PROFESSIONAL }] } });

    const pinned = await policy().prelockReviewSourcesWithin(harness.tx, PRINCIPAL, RESOURCE, RECIPIENT);

    expect(harness.operations).toEqual([
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
    // Las concesiones REVIEW_ALARMS de AMBAS cuentas, sin filtrar estado: una
    // revocación concurrente espera o ya se ve después del bloqueo.
    expect(harness.sql[4]).toContain('"permission" = \'REVIEW_ALARMS\'');
    expect(harness.sql[4]).not.toContain('"status"');
    expect(harness.parameters[4]).toContainEqual([PRINCIPAL.humanAccountId, RECIPIENT]);
    expect(pinned).toEqual({
      bindingIds: [PRINCIPAL.externalAuthIdentityId],
      grantIds: [GRANT],
      assignmentIds: [ASSIGNMENT],
      profileIds: [PROFESSIONAL],
      affiliationIds: ['afiliacion'],
      competenceIds: [COMPETENCE],
    });
  });

  it('con fuentes prebloqueadas, la decisión del actor no sale de ellas: un vínculo no prebloqueado deniega', async () => {
    const harness = spy();
    const decision = await policy().decideWithin(harness.tx, PRINCIPAL, RESOURCE, 'REVIEW_ALARMS', NOW, { ...PINNED, bindingIds: [] });

    expect(decision.kind).toBe('denied');
    expect(harness.operations).not.toContain('external_auth_identity:share');
    expect(harness.operations).not.toContain('care_authorization:share');
  });

  it('con fuentes prebloqueadas, las concesiones del actor se restringen a las ids fijadas', async () => {
    const grant = { actorKind: 'HOSPITAL_REVIEWER', competenceAttestationId: COMPETENCE };
    const harness = spy({ grant });
    const decision = await policy().decideWithin(harness.tx, PRINCIPAL, RESOURCE, 'REVIEW_ALARMS', NOW, PINNED);

    expect(decision.kind).toBe('granted');
    const concesiones = harness.parameters[harness.operations.indexOf('care_authorization:share')] ?? [];
    expect(JSON.stringify(concesiones)).toContain(GRANT);
  });
});

describe('CareContextPolicy — elegibilidad del destinatario (A09)', () => {
  const reviewerGrant = { actorKind: 'HOSPITAL_REVIEWER', competenceAttestationId: COMPETENCE };

  async function eligible(options: SpyOptions, instance = policy()) {
    const harness = spy({ ...options, rows: { ...RECIPIENT_ACCOUNT, external_auth_identity: [{ id: RECIPIENT_BINDING }], ...options.rows } });
    const result = await instance.reviewRecipientHoldsWithin(harness.tx, AUTHORIZED_ACTOR, RECIPIENT, PINNED, NOW);
    return { result, ...harness };
  }

  it('revisor hospitalario: cuenta, vínculo, concesión con emisor manager y competencia; SIN sesión ni experiencia de solicitante', async () => {
    const { result, operations } = await eligible({ grant: reviewerGrant, experience: false });

    expect(result).toBe(true);
    expect(operations).not.toContain('human_session:share');
    expect(operations).not.toContain('access_request:read');
    expect(operations.filter((operation) => operation.endsWith(':share'))).toEqual([
      'human_account:share',
      'external_auth_identity:share',
      'care_authorization:share',
      'clinical_competence_attestation:share',
    ]);
  });

  it('la consulta de cuenta exige ACTIVE y no bloqueada; la de vínculos solo los prebloqueados ACTIVE', async () => {
    const { sql } = await eligible({ grant: reviewerGrant });

    expect(sql[0]).toContain('"status" = \'ACTIVE\'');
    expect(sql[0]).toContain('NOT "passwordRecoveryBlocked"');
    expect(sql[1]).toContain('"status" = \'ACTIVE\'');
    expect(sql[1]).toContain('ANY(');
  });

  it.each([
    ['cuenta deshabilitada o con recuperación bloqueada', { human_account: [] }],
    ['sin vínculo ACTIVE', { external_auth_identity: [] }],
    ['concesión revocada, vencida o de otro contexto', { care_authorization: [] }],
    ['competencia revocada, vencida o propia', { clinical_competence_attestation: [] }],
  ] as const)('revisor: %s → no elegible', async (_caso, rows) => {
    expect((await eligible({ grant: reviewerGrant, rows })).result).toBe(false);
  });

  it('una concesión que el propio destinatario se emitió no lo habilita para revisar', async () => {
    const autoemitida = {
      care_authorization: [
        {
          id: GRANT,
          actorKind: 'HOSPITAL_REVIEWER',
          caregiverRelationshipId: null,
          careAssignmentId: null,
          competenceAttestationId: COMPETENCE,
          grantedByHumanAccountId: RECIPIENT,
          createdAt: new Date(NOW.getTime() - 86_400_000),
        },
      ],
    };

    expect((await eligible({ rows: autoemitida })).result).toBe(false);
  });

  it('una concesión emitida por quien no era manager vigente no habilita', async () => {
    expect((await eligible({ grant: reviewerGrant, manager: false })).result).toBe(false);
  });

  it('profesional: exige el vínculo que coincide EXACTAMENTE con su FIELD_PROFESSIONAL aprobada, asignación, perfil, afiliación y competencia', async () => {
    const { result, accessRequestWheres } = await eligible({});

    expect(result).toBe(true);
    expect(accessRequestWheres[0]).toMatchObject({
      humanAccountId: RECIPIENT,
      personId: RECIPIENT_PERSON,
      externalAuthIdentityId: RECIPIENT_BINDING,
      requestedProfile: 'FIELD_PROFESSIONAL',
      status: 'APPROVED',
    });
  });

  it.each([
    ['sin experiencia FIELD_PROFESSIONAL aprobada exacta', { experience: false }],
    ['asignación terminada o de otro paciente', { rows: { care_assignment: [] } }],
    ['perfil inactivo o de otra persona', { rows: { professional_profile: [] } }],
    ['sin afiliación vigente', { rows: { professional_affiliation: [] } }],
    ['sin competencia vigente', { rows: { clinical_competence_attestation: [] } }],
  ] as const)('profesional: %s → no elegible', async (_caso, options) => {
    expect((await eligible(options)).result).toBe(false);
  });

  it('sin autenticación humana aprovisionada nadie es elegible', async () => {
    expect((await eligible({ grant: reviewerGrant }, policy(null, null))).result).toBe(false);
  });
});
